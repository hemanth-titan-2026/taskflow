import { Request, Response, NextFunction } from 'express';
import { CacheService } from '../services/cache.service';

interface CacheOptions {
  ttl?: number;
  keyGenerator?: (req: Request) => string;
}

/**
 * Cache middleware for GET requests.
 * Caches the response body and serves from cache on subsequent requests.
 */
export function cache(options: CacheOptions = {}) {
  const { ttl = 300, keyGenerator } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = keyGenerator
      ? keyGenerator(req)
      : generateDefaultKey(req);

    try {
      const cached = await CacheService.get<CachedResponse>(cacheKey);

      if (cached) {
        res.set('X-Cache', 'HIT');
        res.status(cached.statusCode).json(cached.body);
        return;
      }

      // Intercept res.json to cache the response
      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const toCache: CachedResponse = {
            statusCode: res.statusCode,
            body,
          };
          CacheService.set(cacheKey, toCache, ttl).catch(() => {});
        }

        res.set('X-Cache', 'MISS');
        return originalJson(body);
      };

      next();
    } catch {
      // On cache error, just continue without caching
      next();
    }
  };
}

/**
 * Middleware to invalidate cache after write operations
 */
export function invalidateCache(patterns: ((req: Request) => string[])) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Intercept res.json to invalidate on success
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const cachePatterns = patterns(req);
        Promise.all(
          cachePatterns.map(pattern => CacheService.invalidatePattern(pattern))
        ).catch(() => {});
      }
      return originalJson(body);
    };

    next();
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface CachedResponse {
  statusCode: number;
  body: any;
}

function generateDefaultKey(req: Request): string {
  const orgId = req.organization?.id || 'global';
  const userId = req.user?.id || 'anon';
  return `cache:${orgId}:${userId}:${req.originalUrl}`;
}
