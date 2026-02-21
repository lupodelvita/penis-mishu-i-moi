import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireObservabilityAccess, requireObservabilityScope } from '../middleware/observability';
import { observabilityAccessService } from '../services/ObservabilityAccessService';

const router = Router();

const previewInviteSchema = z.object({
  inviteToken: z.string().min(32).max(256),
});

const acceptInviteSchema = z.object({
  inviteToken: z.string().min(32).max(256),
  telegramChatId: z.string().min(1).max(64).optional(),
});

const updateTelegramSchema = z.object({
  telegramChatId: z.string().min(1).max(64).nullable(),
});

router.use(authenticateToken);

router.post('/invites/preview', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const payload = previewInviteSchema.parse(req.body);

    const data = await observabilityAccessService.previewInvite(userId, payload.inviteToken);

    res.json({
      success: true,
      data: {
        invite: {
          id: data.invite.id,
          scopes: data.invite.scopes,
          status: data.invite.status,
          expiresAt: data.invite.expiresAt,
          invitedBy: data.invite.invitedBy,
          invitedUsername: data.invite.invitedUsername,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/invites/accept', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const payload = acceptInviteSchema.parse(req.body);

    const result = await observabilityAccessService.acceptInvite({
      userId,
      inviteToken: payload.inviteToken,
      telegramChatId: payload.telegramChatId,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireObservabilityAccess, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.userId;
    const access = await observabilityAccessService.getAccess(userId);

    res.json({ success: true, data: access });
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/me/telegram',
  requireObservabilityAccess,
  requireObservabilityScope('RECEIVE_TELEGRAM_ALERTS'),
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.user!.userId;
      const payload = updateTelegramSchema.parse(req.body);

      const access = await observabilityAccessService.updateOwnTelegramChat(
        userId,
        payload.telegramChatId ?? null,
      );

      res.json({ success: true, data: access });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
