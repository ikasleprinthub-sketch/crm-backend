import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from '../config/logger';
import { env } from '../config/env';

let io: SocketServer;

export const initSocket = (server: HttpServer) => {
  io = new SocketServer(server, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    logger.info(`🔌 New socket connection: ${socket.id}`);

    // Join a room based on userId for targeted notifications
    socket.on('join', (userId: string) => {
      socket.join(userId);
      logger.info(`👤 User ${userId} joined their notification room`);
    });

    socket.on('disconnect', () => {
      logger.info(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

/**
 * Send a notification to a specific user
 */
export const emitNotification = (userId: string, data: any) => {
  if (io) {
    io.to(userId).emit('notification', data);
    logger.info(`🔔 Notification emitted to user ${userId}`);
  }
};
