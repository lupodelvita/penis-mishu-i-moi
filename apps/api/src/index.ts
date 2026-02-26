import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import dotenv from 'dotenv';
import path from 'path';

// Routes
import graphRoutes from './routes/graphs';
import transformRoutes from './routes/transforms';
import entityRoutes from './routes/entities';
import discordRoutes from './routes/discord';
import osintRoutes from './routes/osint';
import aiRoutes from './routes/ai';
import securityRoutes from './routes/security';
import authRoutes from './routes/auth';
import botRoutes from './routes/bots';
import adminRoutes from './routes/admin';
import reportRoutes from './routes/reports';
import uploadRoutes from './routes/upload';
import teamsRoutes from './routes/teams';
import observabilityRoutes from './routes/observability';
import { botManager } from './services/BotManager';
import { collaborationService } from './services/CollaborationService';
import { errorHandler } from './middleware/error';


// Load from monorepo root .env (works from both src/ and dist/)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
const httpServer = createServer(app);

// Initialize collaboration service
collaborationService.initialize(httpServer);

const PORT = process.env.PORT || 4000;
let isShuttingDown = false;

// Middleware
const ALLOWED_ORIGINS = [
  'app://renderer',          // Electron desktop (production)
  'http://localhost:3000',   // Next.js dev server
  'http://localhost:4000',   // API self
  'https://nodeweaver-site.pages.dev',
  /^http:\/\/localhost:\d+$/,
  /^https:\/\/.*\.nodeweaver-site\.pages\.dev$/,
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    const allowed = ALLOWED_ORIGINS.some((o) =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );
    if (allowed) return callback(null, true);
    // Also allow any Electron renderer scheme
    if (origin.startsWith('app://') || origin.startsWith('file://')) return callback(null, true);
    callback(new Error(`CORS: origin "${origin}" not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
}));
app.use(morgan('dev'));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/graphs', graphRoutes);
app.use('/api/transforms', transformRoutes);
app.use('/api/entities', entityRoutes);
app.use('/api/discord', discordRoutes);
app.use('/api/osint', osintRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/bots', botRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/observability', observabilityRoutes);

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Error handling
app.use(errorHandler);

function shutdown(signal: string, restartSignal?: NodeJS.Signals) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[API] Received ${signal}. Shutting down HTTP server...`);

  httpServer.close((error) => {
    if (error) {
      console.error('[API] Error during shutdown:', error);
      process.exit(1);
      return;
    }

    if (restartSignal) {
      process.kill(process.pid, restartSignal);
      return;
    }

    process.exit(0);
  });

  setTimeout(() => {
    console.error('[API] Forced shutdown timeout exceeded. Exiting.');
    process.exit(1);
  }, 5000).unref();
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGUSR2', () => shutdown('SIGUSR2', 'SIGUSR2'));

httpServer.on('error', (error: any) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`[API] Port ${PORT} is already in use. Stop the previous process and retry.`);
    process.exit(1);
    return;
  }

  console.error('[API] HTTP server error:', error);
  process.exit(1);
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════════╗
  ║     NodeWeaver API Server Started          ║
  ╠════════════════════════════════════════════╣
  ║  🌐 REST API: http://localhost:${PORT}        ║
  ║  🔌 WebSocket: ws://localhost:${PORT}         ║
  ║  📊 Health:   http://localhost:${PORT}/health ║
  ╚════════════════════════════════════════════╝
  `);
  
  // Initialize Multi-Bot Manager
  botManager.initialize().catch(e => console.error('BotManager init failed', e));
});

export default app;
