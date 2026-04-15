import 'dotenv/config';
import morgan from 'morgan';

import { buildApp } from './app.js';
import db from './config/database.js';
import { closeRabbitMQ } from './config/rabbitmq.js';
import { initializeQloAppsIntegration } from './integrations/qloapps/index.js';

const port = Number(process.env.PORT) || 8000;
const shutdownTimeoutMs = Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10_000;

let isShuttingDown = false;
let httpServer: import('node:http').Server | null = null;
let forcedExitTimer: NodeJS.Timeout | null = null;

async function gracefulShutdown(trigger: string, requestedExitCode = 0): Promise<void> {
  if (isShuttingDown) {
    console.log(`[Shutdown] Already in progress (trigger: ${trigger})`);
    return;
  }

  isShuttingDown = true;
  let exitCode = requestedExitCode;

  console.log(`[Shutdown] Triggered by ${trigger}`);

  forcedExitTimer = setTimeout(() => {
    console.error(`[Shutdown] Timeout after ${shutdownTimeoutMs}ms, forcing exit`);
    process.exit(1);
  }, shutdownTimeoutMs);
  forcedExitTimer.unref();

  if (httpServer) {
    try {
      await new Promise<void>((resolve, reject) => {
        httpServer?.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      console.log('[Shutdown] HTTP server closed');
    } catch (error) {
      exitCode = 1;
      console.error('[Shutdown] Error closing HTTP server:', error);
    }
  }

  try {
    await db.destroy();
    console.log('[Shutdown] Database connections closed');
  } catch (error) {
    exitCode = 1;
    console.error('[Shutdown] Error closing database connections:', error);
  }

  try {
    await closeRabbitMQ();
    console.log('[Shutdown] RabbitMQ connection closed');
  } catch (error) {
    exitCode = 1;
    console.error('[Shutdown] Error closing RabbitMQ connection:', error);
  }

  if (forcedExitTimer) {
    clearTimeout(forcedExitTimer);
    forcedExitTimer = null;
  }

  process.exit(exitCode);
}

console.log('[Init] Starting server...');

// Add handlers BEFORE app is created
process.on('uncaughtException', (error: Error) => {
  console.error('[FATAL] Uncaught Exception:', error.message);
  console.error(error.stack);
  void gracefulShutdown('uncaughtException', 1);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('[FATAL] Unhandled Rejection:', reason);
  if (reason instanceof Error) {
    console.error(reason.stack);
  }
  void gracefulShutdown('unhandledRejection', 1);
});

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM', 0);
});

process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT', 0);
});

console.log('[Init] Building app...');
const app = buildApp();

// Configure morgan logging based on environment.
const environment = process.env.NODE_ENV || 'development';
app.use(environment === 'development' ? morgan('dev') : morgan('tiny'));

console.log('[Init] Morgan logging configured');

// Initialize services and start the server
async function startServer() {
  try {
    console.log('[Init] Initializing QloApps...');
    await initializeQloAppsIntegration();
    console.log('[Init] QloApps integration initialized');
  } catch (error) {
    console.error('[Init] Failed to initialize QloApps integration:', error);
  }

  console.log('[Init] Starting HTTP server...');
  
  // Start the server and capture the returned Server instance.
  httpServer = app.listen(port, () => {
    console.log(`[Server] Listening on http://localhost:${port}`);
  });

  httpServer.on('clientError', (error, socket) => {
    console.error('[Server] Client error:', error.message);
    if (socket.writable) {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    }
  });

  httpServer.on('error', (error) => {
    console.error('[Server] Server error:', error.message);
    void gracefulShutdown('httpServer.error', 1);
  });
}

console.log('[Init] Calling startServer...');
startServer().catch((err) => {
  console.error('[FATAL] startServer failed:', err);
  void gracefulShutdown('startServer.catch', 1);
});