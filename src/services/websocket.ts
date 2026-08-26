import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { redisSubscriber } from '../config/redis';
import { logger } from '../utils/logger';

let io: Server;

export function initializeWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGINS.split(','),
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // JWT Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string; email: string };

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, firstName: true, lastName: true },
      });

      if (!user) {
        return next(new Error('User not found'));
      }

      // Attach user data to socket
      (socket as any).user = user;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', handleConnection);

  // Subscribe to Redis pub/sub for cross-instance events
  setupRedisSubscriptions();

  logger.info('WebSocket server initialized');
  return io;
}

// ─── Connection Handler ──────────────────────────────────────────────────────

async function handleConnection(socket: Socket): Promise<void> {
  const user = (socket as any).user;
  logger.info('WebSocket client connected', { userId: user.id, socketId: socket.id });

  // Join user's personal room for notifications
  socket.join(`user:${user.id}`);

  // Handle joining organization rooms
  socket.on('join:organization', async (orgId: string) => {
    try {
      const membership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: { userId: user.id, organizationId: orgId },
        },
      });

      if (!membership) {
        socket.emit('error', { message: 'Not a member of this organization' });
        return;
      }

      socket.join(`org:${orgId}`);
      logger.debug('Socket joined org room', { userId: user.id, orgId });
    } catch (error) {
      socket.emit('error', { message: 'Failed to join organization' });
    }
  });

  // Handle joining project rooms
  socket.on('join:project', async (projectId: string) => {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { organizationId: true },
      });

      if (!project) {
        socket.emit('error', { message: 'Project not found' });
        return;
      }

      const membership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: { userId: user.id, organizationId: project.organizationId },
        },
      });

      if (!membership) {
        socket.emit('error', { message: 'Not authorized' });
        return;
      }

      socket.join(`project:${projectId}`);
      logger.debug('Socket joined project room', { userId: user.id, projectId });
    } catch (error) {
      socket.emit('error', { message: 'Failed to join project' });
    }
  });

  // Handle leaving rooms
  socket.on('leave:organization', (orgId: string) => {
    socket.leave(`org:${orgId}`);
  });

  socket.on('leave:project', (projectId: string) => {
    socket.leave(`project:${projectId}`);
  });

  // Handle typing indicators
  socket.on('typing:start', (data: { taskId: string; projectId: string }) => {
    socket.to(`project:${data.projectId}`).emit('typing:start', {
      taskId: data.taskId,
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName },
    });
  });

  socket.on('typing:stop', (data: { taskId: string; projectId: string }) => {
    socket.to(`project:${data.projectId}`).emit('typing:stop', {
      taskId: data.taskId,
      user: { id: user.id },
    });
  });

  // Handle presence
  socket.on('presence:active', () => {
    const rooms = Array.from(socket.rooms).filter(r => r.startsWith('org:'));
    for (const room of rooms) {
      socket.to(room).emit('presence:online', { userId: user.id });
    }
  });

  socket.on('disconnect', (reason) => {
    logger.debug('WebSocket client disconnected', { userId: user.id, reason });
    const rooms = Array.from(socket.rooms).filter(r => r.startsWith('org:'));
    for (const room of rooms) {
      socket.to(room).emit('presence:offline', { userId: user.id });
    }
  });
}

// ─── Redis Pub/Sub for Multi-Instance Support ────────────────────────────────

function setupRedisSubscriptions(): void {
  // Subscribe to notification channels
  redisSubscriber.psubscribe('notifications:*', (err) => {
    if (err) {
      logger.error('Failed to subscribe to notification channels', { error: err.message });
    }
  });

  redisSubscriber.on('pmessage', (_pattern, channel, message) => {
    const userId = channel.replace('notifications:', '');
    try {
      const data = JSON.parse(message);
      io.to(`user:${userId}`).emit('notification', data);
    } catch {
      // Ignore parse errors
    }
  });

  // Subscribe to real-time event channels
  redisSubscriber.psubscribe('events:*', (err) => {
    if (err) {
      logger.error('Failed to subscribe to event channels', { error: err.message });
    }
  });

  redisSubscriber.on('pmessage', (_pattern, channel, message) => {
    if (!channel.startsWith('events:')) return;

    try {
      const data = JSON.parse(message);
      const { room, event, payload } = data;
      if (room && event) {
        io.to(room).emit(event, payload);
      }
    } catch {
      // Ignore parse errors
    }
  });
}

// ─── Event Emitter (used by API routes/services) ─────────────────────────────

export class RealtimeService {
  /**
   * Emit event to a project room
   */
  static emitToProject(projectId: string, event: string, payload: any): void {
    if (io) {
      io.to(`project:${projectId}`).emit(event, payload);
    }
  }

  /**
   * Emit event to an organization room
   */
  static emitToOrg(orgId: string, event: string, payload: any): void {
    if (io) {
      io.to(`org:${orgId}`).emit(event, payload);
    }
  }

  /**
   * Emit event to a specific user
   */
  static emitToUser(userId: string, event: string, payload: any): void {
    if (io) {
      io.to(`user:${userId}`).emit(event, payload);
    }
  }

  /**
   * Broadcast to all connected clients (use sparingly)
   */
  static broadcast(event: string, payload: any): void {
    if (io) {
      io.emit(event, payload);
    }
  }

  /**
   * Get count of connected sockets in a room
   */
  static async getRoomSize(room: string): Promise<number> {
    if (!io) return 0;
    const sockets = await io.in(room).fetchSockets();
    return sockets.length;
  }

  /**
   * Get online users in an organization
   */
  static async getOnlineUsers(orgId: string): Promise<string[]> {
    if (!io) return [];
    const sockets = await io.in(`org:${orgId}`).fetchSockets();
    return [...new Set(sockets.map(s => (s as any).user?.id).filter(Boolean))];
  }
}

export function getIO(): Server {
  return io;
}
