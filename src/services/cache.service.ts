import { redis } from '../config/redis';
import { logger } from '../utils/logger';

export class CacheService {
  private static readonly DEFAULT_TTL = 300; // 5 minutes

  /**
   * Get a cached value by key
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      logger.warn('Cache get error', { key, error });
      return null;
    }
  }

  /**
   * Set a cached value with optional TTL
   */
  static async set(key: string, value: unknown, ttl: number = this.DEFAULT_TTL): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl > 0) {
        await redis.setex(key, ttl, serialized);
      } else {
        await redis.set(key, serialized);
      }
    } catch (error) {
      logger.warn('Cache set error', { key, error });
    }
  }

  /**
   * Delete a cached value
   */
  static async del(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      logger.warn('Cache del error', { key, error });
    }
  }

  /**
   * Delete all keys matching a pattern (uses SCAN for safety)
   */
  static async invalidatePattern(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          await redis.del(...keys);
          logger.debug('Cache invalidated', { pattern, count: keys.length });
        }
      } while (cursor !== '0');
    } catch (error) {
      logger.warn('Cache invalidate pattern error', { pattern, error });
    }
  }

  /**
   * Get or set pattern: check cache first, if miss execute factory and cache result
   */
  static async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl: number = this.DEFAULT_TTL
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Increment a counter (for rate limiting, analytics)
   */
  static async increment(key: string, ttl?: number): Promise<number> {
    const count = await redis.incr(key);
    if (ttl && count === 1) {
      await redis.expire(key, ttl);
    }
    return count;
  }

  // ─── Key Builders ────────────────────────────────────────────────────────

  static keys = {
    task: (taskId: string) => `task:${taskId}`,
    projectTasks: (projectId: string, query: string) => `project:${projectId}:tasks:${query}`,
    project: (projectId: string) => `project:${projectId}`,
    orgProjects: (orgId: string) => `org:${orgId}:projects`,
    userNotifications: (userId: string) => `user:${userId}:notifications`,
    userOrgs: (userId: string) => `user:${userId}:orgs`,
  };

  // ─── Invalidation Helpers ────────────────────────────────────────────────

  static async invalidateTask(taskId: string, projectId: string): Promise<void> {
    await Promise.all([
      this.del(this.keys.task(taskId)),
      this.invalidatePattern(`project:${projectId}:tasks:*`),
    ]);
  }

  static async invalidateProject(projectId: string, orgId: string): Promise<void> {
    await Promise.all([
      this.del(this.keys.project(projectId)),
      this.del(this.keys.orgProjects(orgId)),
      this.invalidatePattern(`project:${projectId}:*`),
    ]);
  }

  static async invalidateOrg(orgId: string): Promise<void> {
    await this.invalidatePattern(`org:${orgId}:*`);
  }

  static async invalidateUser(userId: string): Promise<void> {
    await this.invalidatePattern(`user:${userId}:*`);
  }
}
