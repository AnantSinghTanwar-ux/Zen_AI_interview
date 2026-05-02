import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';

let io: SocketServer;

const allowedOrigins = new Set(
  [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://jobyt.in',
    'https://www.jobyt.in',
    process.env.FRONTEND_URL,
  ].filter((origin): origin is string => Boolean(origin && origin.trim()))
);

const isAllowedOrigin = (origin: string): boolean => {
  if (allowedOrigins.has(origin)) return true;
  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
};

export const initSocket = (httpServer: HttpServer): SocketServer => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || isAllowedOrigin(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`Socket CORS blocked for origin: ${origin}`));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // JWT authentication middleware for socket connections
  io.use((socket: Socket, next) => {
    const token =
      socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = verifyToken(token as string);
      (socket as Socket & { user: typeof payload }).user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as Socket & { user: { userId: string; role: string } }).user;
    console.log(`[Socket] Connected: ${user.userId} (${user.role})`);

    // Each user joins their own private room for direct notifications
    socket.join(`user:${user.userId}`);

    // Join conversation rooms on request
    socket.on('join_conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${user.userId}`);
    });
  });

  return io;
};

// Emit a new message to a conversation room
export const emitMessage = (conversationId: string, message: object) => {
  io?.to(`conversation:${conversationId}`).emit('new_message', message);
};

// Emit a notification to a specific user
export const emitNotification = (userId: string, notification: object) => {
  io?.to(`user:${userId}`).emit('notification', notification);
};

export { io };
