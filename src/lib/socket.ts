import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from '../config/logger';
import { env } from '../config/env';

let io: SocketServer;

export const initSocket = (server: HttpServer) => {
  io = new SocketServer(server, {
    cors: {
      origin: env.NODE_ENV === 'development' ? true : env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    logger.info(`🔌 New socket connection: ${socket.id}`);

    // Join rooms based on userId, role, and departmentId for targeted real-time events
    socket.on('join', (data: string | { userId: string; role?: string; departmentId?: string }) => {
      let userId: string;
      let role: string | undefined;
      let departmentId: string | undefined;

      if (typeof data === 'string') {
        userId = data;
      } else {
        userId = data.userId;
        role = data.role;
        departmentId = data.departmentId;
      }

      console.log(`👤 [Socket] User ${userId} joining socket rooms`);
      socket.join(userId); // Join private user room

      if (role) {
        socket.join(`role-${role}`);
        console.log(`👤 [Socket] User joined room: role-${role}`);
      }
      if (departmentId) {
        socket.join(`dept-${departmentId}`);
        console.log(`👤 [Socket] User joined room: dept-${departmentId}`);
      }

      logger.info(`👤 User ${userId} joined their rooms`);
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
 * Emit an event to all connected clients
 */
export const emitGlobal = (event: string, data: any) => {
  if (io) {
    console.log(`📡 [Socket] Emitting global event ${event}`);
    io.emit(event, data);
  } else {
    console.warn(`⚠️ [Socket] IO not initialized, cannot emit global event ${event}`);
  }
};

/**
 * Emit an event to a specific room
 */
export const emitToRoom = (room: string, event: string, data: any) => {
  if (io) {
    console.log(`📡 [Socket] Emitting event ${event} to room ${room}`);
    io.to(room).emit(event, data);
  } else {
    console.warn(`⚠️ [Socket] IO not initialized, cannot emit to room ${room}`);
  }
};

/**
 * Send a notification to a specific user
 */
export const emitNotification = (userId: string, data: any) => {
  if (io) {
    console.log(`📡 [Socket] Emitting notification to user ${userId}:`, data.title);
    io.to(userId).emit('notification', data);
    logger.info(`🔔 Notification emitted to user ${userId}`);
  } else {
    console.warn(`⚠️ [Socket] IO not initialized, cannot emit to user ${userId}`);
  }
};
