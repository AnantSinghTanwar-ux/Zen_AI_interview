import 'dotenv/config';
import http from 'http';
import app from './app';
import { connectDB } from './config/database';
import redis from './config/redis';
import { initSocket } from './config/socket';

const PORT = parseInt(process.env.PORT || '5000', 10);

async function startServer() {
  try {
    await connectDB();

    // Test Redis (non-blocking for local Docker runs)
    try {
      // With lazyConnect enabled, connect explicitly.
      await redis.connect();
      await redis.ping();
      console.log('Redis connected');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`Redis not available, continuing without Redis connection (${message})`);
    }

    // Create HTTP server (required for Socket.io)
    const httpServer = http.createServer(app);

    // Initialise Socket.io
    initSocket(httpServer);
    console.log('Socket.io initialised');

    httpServer.listen(PORT, () => {
      console.log(
        `Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`,
      );
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// nodemon trigger
