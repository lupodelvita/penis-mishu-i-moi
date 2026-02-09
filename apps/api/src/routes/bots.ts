import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { botManager } from '../services/BotManager';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireBotLimit } from '../middleware/license';
import { BotType } from '@prisma/client';

const router = Router();

// Get all bots for current user
router.get('/', authenticateToken, async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.userId;
        const data = await botManager.getBotsWithStatus(userId);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

// Add new bot
router.post('/', authenticateToken, requireBotLimit, async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.userId;
        const { name, type, token, autoStart, settings } = req.body;

        if (!name || !token) {
             res.status(400).json({ success: false, error: 'Name and Token required' });
             return;
        }

        const newBot = await prisma.botConfig.create({
            data: {
                userId,
                name,
                type: type || BotType.DISCORD,
                token,
                autoStart: autoStart || false,
                isActive: true,
                settings: settings || {}
            }
        });

        // Try to start immediately
        if (newBot.isActive) {
            await botManager.startBot(newBot.id, newBot.type, newBot.token, newBot.settings);
        }

        res.json({ success: true, data: newBot });
    } catch (error) {
        next(error);
    }
});

// Delete bot
router.delete('/:id', authenticateToken, async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.userId;
        const { id } = req.params;

        const bot = await prisma.botConfig.findUnique({ where: { id } });
        if (!bot || bot.userId !== userId) {
            res.status(404).json({ success: false, error: 'Bot not found' });
            return;
        }

        await botManager.stopBot(id);
        await prisma.botConfig.delete({ where: { id } });

        res.json({ success: true, message: 'Bot deleted' });
    } catch (error) {
        next(error);
    }
});

// Toggle Active/AutoStart
router.patch('/:id/toggle', authenticateToken, async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.userId;
        const { id } = req.params;
        const { isActive, autoStart } = req.body;

        const bot = await prisma.botConfig.findUnique({ where: { id } });
        if (!bot || bot.userId !== userId) {
             res.status(404).json({ success: false, error: 'Bot not found' });
             return;
        }

        const updated = await prisma.botConfig.update({
            where: { id },
            data: { 
                isActive: isActive ?? bot.isActive,
                autoStart: autoStart ?? bot.autoStart
            }
        });

        if (isActive === false) {
            await botManager.stopBot(id);
        } else if (isActive === true && !botManager.getBot(id)) {
            await botManager.startBot(id, updated.type, updated.token, updated.settings);
        }

        res.json({ success: true, data: updated });
    } catch (error) {
        next(error);
    }
});

export default router;
