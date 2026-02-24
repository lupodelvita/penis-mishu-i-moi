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

           if (!name || !token || !type) {
               res.status(400).json({ success: false, error: 'Name, type и token обязательны' });
               return;
           }

           if (!Object.values(BotType).includes(type)) {
               res.status(400).json({ success: false, error: 'Некорректный тип бота (DISCORD или TELEGRAM)' });
               return;
           }

           // Check for duplicate token
           const existingToken = await prisma.botConfig.findFirst({ where: { token } });
           if (existingToken) {
               res.status(409).json({ success: false, error: `Бот с таким токеном уже существует (${existingToken.name})` });
               return;
           }

           // Check for duplicate name (globally)
           const existingName = await prisma.botConfig.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
           if (existingName) {
               res.status(409).json({ success: false, error: `Бот с именем «${existingName.name}» уже существует` });
               return;
           }

        const newBot = await prisma.botConfig.create({
            data: {
                userId,
                name,
                type,
                token,
                autoStart: autoStart || false,
                isActive: true,
                settings: settings || {}
            }
        });

        // Start in background — do not await so the HTTP response returns immediately
        if (newBot.isActive) {
            botManager.startBot(newBot.id, newBot.type, newBot.token, newBot.settings)
                .catch((err: any) => console.error(`[BotManager] Background start failed for ${newBot.id}:`, err?.message ?? err));
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
            // Fire in background — eviction + launch takes several seconds
            botManager.startBot(id, updated.type, updated.token, updated.settings)
                .catch((err: any) => console.error(`[BotManager] Failed to start bot ${id}:`, err?.message ?? err));
        }

        res.json({ success: true, data: updated });
    } catch (error) {
        next(error);
    }
});

export default router;
