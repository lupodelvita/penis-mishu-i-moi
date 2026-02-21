import { Router } from 'express';
import { z } from 'zod';
import { createHash, randomBytes } from 'crypto';
import { prisma } from '../lib/prisma';
import { observabilityAccessService } from '../services/ObservabilityAccessService';

const router = Router();

const scopeEnum = z.enum([
  'VIEW_DASHBOARDS',
  'VIEW_ERRORS',
  'MANAGE_ALERTS',
  'RECEIVE_TELEGRAM_ALERTS',
  'MANAGE_INTEGRATIONS',
]);

const createInviteSchema = z.object({
  invitedUserId: z.string().uuid().optional(),
  invitedUsername: z.string().min(2).max(64).optional(),
  scopes: z.array(scopeEnum).min(1),
  expiresInHours: z.number().int().min(1).max(720).default(72),
});

const grantAccessSchema = z.object({
  userId: z.string().uuid(),
  scopes: z.array(scopeEnum).min(1),
  telegramChatId: z.string().min(1).max(64).optional(),
  expiresAt: z.string().datetime().optional(),
  inviteId: z.string().uuid().optional(),
});

const updateAccessSchema = z.object({
  scopes: z.array(scopeEnum).min(1).optional(),
  telegramChatId: z.string().min(1).max(64).nullable().optional(),
  isActive: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

router.get('/overview', async (_req, res, next) => {
  try {
    const [pendingInvites, activeAccesses, expiringSoon, totalAudits] = await Promise.all([
      prisma.observabilityInvite.count({ where: { status: 'PENDING' } }),
      prisma.observabilityAccess.count({ where: { isActive: true } }),
      prisma.observabilityAccess.count({
        where: {
          isActive: true,
          expiresAt: {
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.observabilityAuditLog.count(),
    ]);

    res.json({
      success: true,
      data: {
        pendingInvites,
        activeAccesses,
        expiringSoon,
        totalAudits,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/users/eligible', async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        license: true,
        observabilityAccess: true,
      },
      where: {
        license: {
          tier: { in: ['DEVELOPER', 'CEO'] },
        },
      },
      orderBy: { created: 'desc' },
    });

    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});

router.post('/invites', async (req: any, res, next) => {
  try {
    const payload = createInviteSchema.parse(req.body);
    const actorUserId = req.user?.userId as string;

    if (!payload.invitedUserId && !payload.invitedUsername) {
      res.status(400).json({ success: false, error: 'invitedUserId or invitedUsername is required' });
      return;
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const invite = await prisma.observabilityInvite.create({
      data: {
        tokenHash,
        invitedUserId: payload.invitedUserId,
        invitedUsername: payload.invitedUsername,
        invitedById: actorUserId,
        scopes: payload.scopes,
        expiresAt: new Date(Date.now() + payload.expiresInHours * 60 * 60 * 1000),
      },
    });

    await observabilityAccessService.createAuditLog({
      action: 'INVITE_CREATED',
      actorUserId,
      subjectUserId: payload.invitedUserId,
      inviteId: invite.id,
      details: {
        scopes: payload.scopes,
        expiresInHours: payload.expiresInHours,
      },
    });

    res.json({
      success: true,
      data: {
        invite,
        inviteToken: token,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/invites', async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const where = status ? { status: status as any } : {};

    const invites = await prisma.observabilityInvite.findMany({
      where,
      include: {
        invitedUser: { select: { id: true, username: true } },
        invitedBy: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    res.json({ success: true, data: invites });
  } catch (error) {
    next(error);
  }
});

router.post('/invites/:inviteId/revoke', async (req: any, res, next) => {
  try {
    const actorUserId = req.user?.userId as string;
    const { inviteId } = req.params;

    const invite = await prisma.observabilityInvite.update({
      where: { id: inviteId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });

    await observabilityAccessService.createAuditLog({
      action: 'INVITE_REVOKED',
      actorUserId,
      subjectUserId: invite.invitedUserId ?? undefined,
      inviteId,
    });

    res.json({ success: true, data: invite });
  } catch (error) {
    next(error);
  }
});

router.post('/access/grant', async (req: any, res, next) => {
  try {
    const actorUserId = req.user?.userId as string;
    const payload = grantAccessSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { license: true },
    });

    if (!user || !user.license || !['DEVELOPER', 'CEO'].includes(user.license.tier)) {
      res.status(400).json({ success: false, error: 'User must have DEVELOPER or CEO license tier' });
      return;
    }

    const access = await prisma.observabilityAccess.upsert({
      where: { userId: payload.userId },
      update: {
        scopes: payload.scopes,
        telegramChatId: payload.telegramChatId,
        isActive: true,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
        grantedById: actorUserId,
        inviteId: payload.inviteId,
      },
      create: {
        userId: payload.userId,
        scopes: payload.scopes,
        telegramChatId: payload.telegramChatId,
        isActive: true,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
        grantedById: actorUserId,
        inviteId: payload.inviteId,
      },
    });

    if (payload.inviteId) {
      await prisma.observabilityInvite.update({
        where: { id: payload.inviteId },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          invitedUserId: payload.userId,
        },
      });
    }

    await observabilityAccessService.createAuditLog({
      action: 'ACCESS_GRANTED',
      actorUserId,
      subjectUserId: payload.userId,
      accessId: access.id,
      inviteId: payload.inviteId,
      details: {
        scopes: payload.scopes,
        telegramChatId: payload.telegramChatId,
      },
    });

    res.json({ success: true, data: access });
  } catch (error) {
    next(error);
  }
});

router.get('/access', async (_req, res, next) => {
  try {
    const accesses = await prisma.observabilityAccess.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            license: true,
          },
        },
        grantedBy: {
          select: {
            id: true,
            username: true,
          },
        },
        invite: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    res.json({ success: true, data: accesses });
  } catch (error) {
    next(error);
  }
});

router.patch('/access/:accessId', async (req: any, res, next) => {
  try {
    const actorUserId = req.user?.userId as string;
    const { accessId } = req.params;
    const payload = updateAccessSchema.parse(req.body);

    const updated = await prisma.observabilityAccess.update({
      where: { id: accessId },
      data: {
        scopes: payload.scopes,
        isActive: payload.isActive,
        telegramChatId: payload.telegramChatId === null ? null : payload.telegramChatId,
        expiresAt: payload.expiresAt === null ? null : payload.expiresAt ? new Date(payload.expiresAt) : undefined,
      },
    });

    if (payload.scopes) {
      await observabilityAccessService.createAuditLog({
        action: 'SCOPES_UPDATED',
        actorUserId,
        subjectUserId: updated.userId,
        accessId: updated.id,
        details: { scopes: payload.scopes },
      });
    }

    if (payload.telegramChatId !== undefined) {
      await observabilityAccessService.createAuditLog({
        action: payload.telegramChatId ? 'TELEGRAM_CHAT_LINKED' : 'TELEGRAM_CHAT_UNLINKED',
        actorUserId,
        subjectUserId: updated.userId,
        accessId: updated.id,
        details: { telegramChatId: payload.telegramChatId },
      });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.post('/access/:accessId/revoke', async (req: any, res, next) => {
  try {
    const actorUserId = req.user?.userId as string;
    const { accessId } = req.params;

    const revoked = await prisma.observabilityAccess.update({
      where: { id: accessId },
      data: {
        isActive: false,
        expiresAt: new Date(),
      },
    });

    await observabilityAccessService.createAuditLog({
      action: 'ACCESS_REVOKED',
      actorUserId,
      subjectUserId: revoked.userId,
      accessId,
    });

    res.json({ success: true, data: revoked });
  } catch (error) {
    next(error);
  }
});

router.get('/audit', async (req, res, next) => {
  try {
    const take = Math.min(Number(req.query.limit || 100), 500);

    const logs = await prisma.observabilityAuditLog.findMany({
      include: {
        actorUser: { select: { id: true, username: true } },
        subjectUser: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });

    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
});

export default router;
