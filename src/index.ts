import { createServer } from 'http';
import { app } from './app';
import { env, connectDatabase, disconnectDatabase, disconnectRedis } from './config';
import { logger } from './utils/logger';
import { initializeWebSocket } from './services/websocket';

const httpServer = createServer(app);

// Initialize WebSocket server
initializeWebSocket(httpServer);

async function bootstrap(): Promise<void> {
  try {
    // Connect to database
    await connectDatabase();
    logger.info('Database connected');

    // Start HTTP server
    httpServer.listen(env.PORT, () => {
      logger.info(`TaskFlow server running on port ${env.PORT}`, {
        environment: env.NODE_ENV,
        port: env.PORT,
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  httpServer.close(async () => {
    logger.info('HTTP server closed');

    await disconnectDatabase();
    logger.info('Database disconnected');

    await disconnectRedis();
    logger.info('Redis disconnected');

    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled rejection', { reason });
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

bootstrap();
