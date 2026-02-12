import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authService } from '../services/AuthService';
import { userService } from '../services/UserService';
import { botManager } from '../services/BotManager';
// Prisma Enums are sometimes under $Enums in newer versions or just use strings for types


const Role = {
  USER: 'USER',
  ADMIN: 'ADMIN'
} as const;

const LicenseTier = {
  OBSERVER: 'OBSERVER',
  ANALYST: 'ANALYST',
  OPERATIVE: 'OPERATIVE',
  DEVELOPER: 'DEVELOPER',
  ENTERPRISE: 'ENTERPRISE',
  CEO: 'CEO'
} as const;

const router = Router();

// Middleware: Require CEO or ADMIN
const requireAdmin = async (req: AuthRequest, res: any, next: any) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ success: false, error: 'Unauthorized' });
            return;
        }

        const user = await userService.getWithLicense(userId);

        if (user?.role === Role.ADMIN || user?.license?.tier === LicenseTier.CEO) {
            next();
        } else {
            res.status(403).json({ success: false, error: 'Access Denied: CEO/Admin only' });
        }
    } catch (error) {
        next(error);
    }
};

router.use(authenticateToken);
router.use(requireAdmin);

// Dashboard Stats
router.get('/stats', async (_req, res, next) => {
    try {
        const [users, graphs, bots, licenses, activeBots] = await Promise.all([
            prisma.user.count(),
            prisma.graph.count(),
            prisma.botConfig.count(),
            prisma.license.count(),
            botManager.getAllActiveBots().length
        ]);

        res.json({
            success: true,
            data: {
                users,
                graphs,
                totalBots: bots,
                activeBots,
                issuedLicenses: licenses
            }
        });
    } catch (error) {
        next(error);
    }
});

// Generate License
router.post('/licenses', async (req, res, next) => {
    try {
        const { tier, durationDays } = req.body;
        const userId = (req as AuthRequest).user!.userId;
        
        const license = await authService.generateLicense(tier || LicenseTier.OBSERVER, userId, durationDays);
        res.json({ success: true, data: license });
    } catch (error) {
        next(error);
    }
});

// List Users
router.get('/users', async (_req, res, next) => {
    try {
        const users = await prisma.user.findMany({
            include: { license: true, _count: { select: { ownedGraphs: true, bots: true } } },
            orderBy: { created: 'desc' },
            take: 50
        });
        
        res.json({ success: true, data: users });
    } catch (error) {
        next(error);
    }
});

// Revoke (Delete) License
router.delete('/licenses/:key', async (req, res, next) => {
    try {
        const { key } = req.params;
        
        // Find and delete license
        const license = await prisma.license.findUnique({ where: { key } });
        
        if (!license) {
            res.status(404).json({ success: false, error: 'License not found' });
            return;
        }
        
        // Delete from database
        await prisma.license.delete({ where: { key } });
        
        res.json({ success: true, message: 'License revoked and deleted' });
    } catch (error) {
        next(error);
    }
});

// Extend License
router.patch('/licenses/:key/extend', async (req, res, next) => {
    try {
        const { key } = req.params;
        const { additionalDays } = req.body;
        
        if (!additionalDays || additionalDays < 1) {
            res.status(400).json({ success: false, error: 'additionalDays must be >= 1' });
            return;
        }
        
        const license = await prisma.license.findUnique({ where: { key } });
        
        if (!license) {
            res.status(404).json({ success: false, error: 'License not found' });
            return;
        }
        
        // Calculate new expiration date
        const now = new Date();
        const currentExpiry = license.expiresAt || now;
        const newExpiry = new Date(currentExpiry > now ? currentExpiry : now);
        newExpiry.setDate(newExpiry.getDate() + additionalDays);
        
        // Update license
        const updated = await prisma.license.update({
            where: { key },
            data: { 
                expiresAt: newExpiry,
                isActive: true  // Reactivate if it was inactive
            }
        });
        
        res.json({ success: true, data: updated, message: `License extended by ${additionalDays} days` });
    } catch (error) {
        next(error);
    }
});

export default router;
