import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import dotenv from 'dotenv';

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
import { botManager } from './services/BotManager';
import { collaborationService } from './services/CollaborationService';
import { errorHandler } from './middleware/error';
import { PrismaClient, LicenseTier } from '@prisma/client';


dotenv.config();

const app = express();
const httpServer = createServer(app);

// Initialize collaboration service
collaborationService.initialize(httpServer);

const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3001',
    'https://penis-mishu-i-moi-2.onrender.com'
  ],
  credentials: true
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

// TEMPORARY: Route to generate master keys (for initial setup on Render)
const prisma_temp = new PrismaClient();
app.get('/api/setup-keys', async (req, res) => {
  try {
    const count = parseInt(req.query.count as string) || 1;
    const keys: string[] = [];
    
    for (let i = 0; i < count; i++) {
        const tier = LicenseTier.CEO;
        const key = `NW-${tier}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(7).toUpperCase()}-MASTER`;
        
        await prisma_temp.license.create({
        data: {
            key,
            tier,
            isActive: true
        }
        });
        keys.push(key);
    }
    
    res.json({ success: true, keys, message: 'These keys are valid ONE-TIME use for registration.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate key', details: error });
  }
});
app.use('/api/reports', reportRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/upload', uploadRoutes);

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Error handling
app.use(errorHandler);

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

export { collaborationService };
