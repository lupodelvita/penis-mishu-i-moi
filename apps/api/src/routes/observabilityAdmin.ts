import { Router } from 'express';
import { z } from 'zod';
import { createHash, randomBytes } from 'crypto';
import { prisma } from '../lib/prisma';
import { observabilityAccessService } from '../services/ObservabilityAccessService';
import { alertDispatchService } from '../services/AlertDispatchService';
import { botManager } from '../services/BotManager';
import { BotType } from '@prisma/client';
import { TelegrafBot } from '../services/TelegrafBot';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// ---------------------------------------------------------------------------
// Audit → Telegram helper
// ---------------------------------------------------------------------------

async function _getActiveTelegramBot(): Promise<TelegrafBot | null> {
  const configs = await prisma.botConfig.findMany({
    where: { type: BotType.TELEGRAM, isActive: true },
    orderBy: { created: 'desc' },
  });
  for (const cfg of configs) {
    const live = botManager.getBot(cfg.id);
    if (live instanceof TelegrafBot) return live;
  }
  return null;
}

/** Fire-and-forget: dispatch an audit event notification to RECEIVE_TELEGRAM_ALERTS recipients */
function dispatchAuditTelegram(opts: {
  action: string;
  actorName: string;
  subjectName: string;
  details?: Record<string, unknown> | null;
}) {
  _getActiveTelegramBot().then((bot) => {
    if (!bot) return;
    const time = new Date().toLocaleString('ru-RU', { timeZone: 'UTC' });
    const lines: string[] = [
      `▸ *NODEWEAVER SOC — AUDIT LOG*`,
      '',
      `ACTION  : \`${opts.action}\``,
      `ACTOR   : \`${opts.actorName}\``,
      `SUBJECT : \`${opts.subjectName}\``,
      `TIME    : ${time} UTC`,
    ];
    if (opts.details) {
      const d = opts.details as any;
      if (Array.isArray(d.scopes) && d.scopes.length)
        lines.push(`SCOPES  : ${(d.scopes as string[]).join(', ')}`);
      if (d.telegramChatId)
        lines.push(`CHAT ID : ${d.telegramChatId}`);
    }
    lines.push('', '— _NodeWeaver Security Operations Center_');
    alertDispatchService.dispatchTelegramToScope({
      bot,
      message: lines.join('\n'),
      scope: 'RECEIVE_TELEGRAM_ALERTS',
      requireAtLeastOneSuccess: false,
    }).catch((e: any) => console.warn('[AuditTelegram] dispatch failed:', e?.message));
  }).catch(() => { /* best-effort */ });
}

const scopeEnum = z.enum([
  'VIEW_DASHBOARDS',
  'VIEW_ERRORS',
  'MANAGE_ALERTS',
  'RECEIVE_TELEGRAM_ALERTS',
  'MANAGE_INTEGRATIONS',
]);

const createInviteSchema = z.object({
  invitedUserId: z.string().uuid().optional(),
  invitedAccountCode: z.string().min(3).max(64).optional(),
  invitedUsername: z.string().min(2).max(64).optional(),
  scopes: z.array(scopeEnum).min(1),
  expiresInHours: z.number().int().min(1).max(720).default(72),
});

const grantAccessSchema = z.object({
  userId: z.string().uuid().optional(),
  accountCode: z.string().min(3).max(64).optional(),
  username: z.string().min(2).max(64).optional(),
  scopes: z.array(scopeEnum).min(1),
  telegramChatId: z.string().min(1).max(64).optional(),
  telegramBotId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().optional(),
  inviteId: z.string().uuid().optional(),
});

const updateAccessSchema = z.object({
  scopes: z.array(scopeEnum).min(1).optional(),
  telegramChatId: z.string().min(1).max(64).nullable().optional(),
  telegramBotId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

async function resolveUserByRef(refs: { userId?: string; accountCode?: string; username?: string }) {
  if (refs.userId) {
    const user = await prisma.user.findUnique({ where: { id: refs.userId }, include: { license: true } });
    if (user) return user;
  }

  if (refs.accountCode) {
    const user = await prisma.user.findUnique({ where: { accountCode: refs.accountCode }, include: { license: true } });
    if (user) return user;
  }

  if (refs.username) {
    const user = await prisma.user.findUnique({ where: { username: refs.username }, include: { license: true } });
    if (user) return user;
  }

  return null;
}

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

    if (!payload.invitedUserId && !payload.invitedUsername && !payload.invitedAccountCode) {
      res.status(400).json({ success: false, error: 'invitedUserId or invitedUsername or invitedAccountCode is required' });
      return;
    }

    let resolvedUserId = payload.invitedUserId;
    if (!resolvedUserId && (payload.invitedAccountCode || payload.invitedUsername)) {
      const candidate = await resolveUserByRef({ accountCode: payload.invitedAccountCode, username: payload.invitedUsername });
      if (candidate) {
        resolvedUserId = candidate.id;
      }
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const invite = await prisma.observabilityInvite.create({
      data: {
        tokenHash,
        invitedUserId: resolvedUserId,
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

    if (!payload.userId && !payload.accountCode && !payload.username) {
      res.status(400).json({ success: false, error: 'Provide userId or accountCode or username' });
      return;
    }

    if (payload.telegramChatId && !payload.telegramBotId) {
      res.status(400).json({ success: false, error: 'telegramBotId is required when linking Telegram chat' });
      return;
    }

    const user = await resolveUserByRef({ userId: payload.userId, accountCode: payload.accountCode, username: payload.username });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found by provided identifier' });
      return;
    }

    if (!user.license || !['DEVELOPER', 'CEO'].includes(user.license.tier)) {
      res.status(400).json({ success: false, error: 'User must have DEVELOPER or CEO license tier' });
      return;
    }

    let telegramBot: TelegrafBot | null = null;
    if (payload.telegramChatId) {
      const botConfig = await prisma.botConfig.findFirst({
        where: {
          id: payload.telegramBotId,
          type: BotType.TELEGRAM,
          isActive: true,
        },
      });

      if (!botConfig) {
        res.status(400).json({ success: false, error: 'Telegram bot not found or inactive' });
        return;
      }

      const existing = botManager.getBot(botConfig.id);
      telegramBot = (existing as TelegrafBot) || null;

      if (!telegramBot) {
        const started = await botManager.startBot(botConfig.id, botConfig.type, botConfig.token, botConfig.settings);
        if (!started || !(started instanceof TelegrafBot)) {
          res.status(400).json({ success: false, error: 'Failed to start Telegram bot for validation' });
          return;
        }
        telegramBot = started as TelegrafBot;
      }

      await telegramBot.validateChatAccess(payload.telegramChatId);
    }

    const access = await prisma.observabilityAccess.upsert({
      where: { userId: user.id },
      update: {
        scopes: payload.scopes,
        telegramChatId: payload.telegramChatId,
        isActive: true,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
        grantedById: actorUserId,
        inviteId: payload.inviteId,
      },
      create: {
        userId: user.id,
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
          invitedUserId: user.id,
        },
      });
    }

    await observabilityAccessService.createAuditLog({
      action: 'ACCESS_GRANTED',
      actorUserId,
      subjectUserId: user.id,
      accessId: access.id,
      inviteId: payload.inviteId,
      details: {
        scopes: payload.scopes,
        telegramChatId: payload.telegramChatId,
      },
    });

    res.json({ success: true, data: access });

    // Audit notification
    dispatchAuditTelegram({
      action: 'ACCESS_GRANTED',
      actorName: (req as any).user?.username || actorUserId,
      subjectName: user.username || user.accountCode || user.id,
      details: { scopes: payload.scopes, telegramChatId: payload.telegramChatId },
    });

    // Fire-and-forget: send welcome message via Telegram if chat linked
    if (telegramBot && payload.telegramChatId) {
      const userName = user.username || user.accountCode || 'UNKNOWN';
      const scopeList = payload.scopes.map((s: string) => `  › \`${s}\``).join('\n');
      const welcomeMsg =
        `▸ *NODEWEAVER SOC — УВЕДОМЛЕНИЕ О ДОСТУПЕ*\n\n` +
        `ПОЛУЧАТЕЛЬ : \`${userName}\`\n` +
        `СОБЫТИЕ    : ACCESS GRANTED\n` +
        `ГРИФ       : CONFIDENTIAL\n\n` +
        `*ВЫДАННЫЕ РАЗРЕШЕНИЯ:*\n${scopeList}\n\n` +
        `Все действия в системе протоколируются и хранятся в защищённом журнале аудита.\n` +
        `Передача учётных данных третьим лицам является основанием для немедленного\n` +
        `отзыва доступа и возбуждения инцидента безопасности.\n\n` +
        `Если получили по ошибке — незамедлительно сообщите администратору.\n\n` +
        `— _NodeWeaver Security Operations Center_`;
      telegramBot.sendReport(payload.telegramChatId, welcomeMsg).catch((err: any) => {
        console.warn('[ObservabilityAdmin] Failed to send welcome message:', err?.message);
      });
    }
  } catch (error) {
    next(error);
  }
});

router.get('/access', async (_req, res, next) => {
  try {
    const now = new Date();
    const accesses = await prisma.observabilityAccess.findMany({
      where: {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: {
        user: {
          select: {
            id: true,
              accountCode: true,
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

router.get('/recipients/telegram', async (_req, res, next) => {
  try {
    const recipients = await observabilityAccessService.getTelegramRecipients('RECEIVE_TELEGRAM_ALERTS');
    res.json({ success: true, data: recipients });
  } catch (error) {
    next(error);
  }
});

router.patch('/access/:accessId', async (req: any, res, next) => {
  try {
    const actorUserId = req.user?.userId as string;
    const { accessId } = req.params;
    const payload = updateAccessSchema.parse(req.body);

    if (payload.telegramChatId && !payload.telegramBotId) {
      res.status(400).json({ success: false, error: 'telegramBotId is required when linking Telegram chat' });
      return;
    }

    if (payload.telegramChatId) {
      const botConfig = await prisma.botConfig.findFirst({
        where: {
          id: payload.telegramBotId,
          type: BotType.TELEGRAM,
          isActive: true,
        },
      });

      if (!botConfig) {
        res.status(400).json({ success: false, error: 'Telegram bot not found or inactive' });
        return;
      }

      const existing = botManager.getBot(botConfig.id);
      let telegramBot: TelegrafBot | null = (existing as TelegrafBot) || null;

      if (!telegramBot) {
        const started = await botManager.startBot(botConfig.id, botConfig.type, botConfig.token, botConfig.settings);
        if (!started || !(started instanceof TelegrafBot)) {
          res.status(400).json({ success: false, error: 'Failed to start Telegram bot for validation' });
          return;
        }
        telegramBot = started as TelegrafBot;
      }

      await telegramBot.validateChatAccess(payload.telegramChatId);
    }

    const updated = await prisma.observabilityAccess.update({
      where: { id: accessId },
      data: {
        scopes: payload.scopes,
        isActive: payload.isActive,
        telegramChatId: payload.telegramChatId === null ? null : payload.telegramChatId,
        expiresAt: payload.expiresAt === null ? null : payload.expiresAt ? new Date(payload.expiresAt) : undefined,
      },
      include: { user: { select: { username: true, accountCode: true } } },
    });

    const updatedSubjectName = (updated as any).user?.username || (updated as any).user?.accountCode || updated.userId;

    if (payload.scopes) {
      await observabilityAccessService.createAuditLog({
        action: 'SCOPES_UPDATED',
        actorUserId,
        subjectUserId: updated.userId,
        accessId: updated.id,
        details: { scopes: payload.scopes },
      });
      dispatchAuditTelegram({
        action: 'SCOPES_UPDATED',
        actorName: (req as any).user?.username || actorUserId,
        subjectName: updatedSubjectName,
        details: { scopes: payload.scopes },
      });
    }

    if (payload.telegramChatId !== undefined) {
      const chatAction = payload.telegramChatId ? 'TELEGRAM_CHAT_LINKED' : 'TELEGRAM_CHAT_UNLINKED';
      await observabilityAccessService.createAuditLog({
        action: chatAction,
        actorUserId,
        subjectUserId: updated.userId,
        accessId: updated.id,
        details: { telegramChatId: payload.telegramChatId },
      });
      dispatchAuditTelegram({
        action: chatAction,
        actorName: (req as any).user?.username || actorUserId,
        subjectName: updatedSubjectName,
        details: payload.telegramChatId ? { telegramChatId: payload.telegramChatId } : null,
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
      include: { user: { select: { id: true, username: true, accountCode: true } } },
    });

    await observabilityAccessService.createAuditLog({
      action: 'ACCESS_REVOKED',
      actorUserId,
      subjectUserId: revoked.userId,
      accessId,
    });

    res.json({ success: true, data: revoked });

    // Audit notification
    dispatchAuditTelegram({
      action: 'ACCESS_REVOKED',
      actorName: (req as any).user?.username || actorUserId,
      subjectName: (revoked as any).user?.username || (revoked as any).user?.accountCode || revoked.userId,
    });

    // Fire-and-forget: notify user their access has been revoked
    if (revoked.telegramChatId) {
      const telegramConfigs = await prisma.botConfig.findMany({
        where: { type: BotType.TELEGRAM, isActive: true },
        orderBy: { created: 'desc' },
      });
      let revokeBot: TelegrafBot | undefined;
      for (const cfg of telegramConfigs) {
        const live = botManager.getBot(cfg.id);
        if (live instanceof TelegrafBot) { revokeBot = live; break; }
      }
      if (revokeBot) {
        const userName = (revoked as any).user?.username || (revoked as any).user?.accountCode || 'UNKNOWN';
        const revokeMsg =
          `▸ *NODEWEAVER SOC — ДОСТУП ПРЕКРАЩЁН*\n\n` +
          `СУБЪЕКТ    : \`${userName}\`\n` +
          `СОБЫТИЕ    : ACCESS REVOKED\n` +
          `ИНИЦИАТОР  : SYSTEM ADMINISTRATOR\n\n` +
          `Все активные разрешения аннулированы немедленно.\n` +
          `Дальнейшие обращения к системе будут отклонены и зарегистрированы.\n\n` +
          `Если считаете это ошибкой — обратитесь к куратору или в NodeWeaver Support.\n\n` +
          `— _NodeWeaver Security Operations Center_`;
        revokeBot.sendReport(revoked.telegramChatId, revokeMsg).catch((err: any) => {
          console.warn('[ObservabilityAdmin] Failed to send revoke notification:', err?.message);
        });
      }
    }
  } catch (error) {
    next(error);
  }
});

router.post('/access/:accessId/test-message', async (req, res, next) => {
  try {
    const { accessId } = req.params;

    const access = await prisma.observabilityAccess.findUnique({
      where: { id: accessId },
      include: { user: { select: { id: true, username: true, accountCode: true } } },
    });

    if (!access) {
      res.status(404).json({ success: false, error: 'Access record not found' });
      return;
    }

    if (!access.telegramChatId) {
      res.status(400).json({ success: false, error: 'No Telegram chat linked to this access record' });
      return;
    }

    // Find first running TelegrafBot by iterating DB configs
    const telegramConfigs = await prisma.botConfig.findMany({
      where: { type: BotType.TELEGRAM, isActive: true },
      orderBy: { created: 'desc' },
    });

    let telegramBot: TelegrafBot | undefined;
    for (const cfg of telegramConfigs) {
      const live = botManager.getBot(cfg.id);
      if (live instanceof TelegrafBot) {
        telegramBot = live;
        break;
      }
    }

    if (!telegramBot) {
      res.status(400).json({ success: false, error: 'No active Telegram bot is running' });
      return;
    }

    const userName = access.user?.username || access.user?.accountCode || 'UNKNOWN';
    const testMsg =
      `▸ *NODEWEAVER SOC — ПРОВЕРКА КАНАЛА*\n\n` +
      `ПОЛУЧАТЕЛЬ : \`${userName}\`\n` +
      `ПРОТОКОЛ   : TELEGRAM\n` +
      `СТАТУС     : CHANNEL OPERATIONAL\n\n` +
      `Технический тест канала доставки критических уведомлений завершён успешно.\n` +
      `Инцидентные алерты будут доставляться в этот чат в режиме реального времени.\n\n` +
      `— _NodeWeaver Security Operations Center_`;

    await telegramBot.sendReport(access.telegramChatId, testMsg);
    res.json({ success: true, message: 'Test message sent' });
  } catch (error) {
    next(error);
  }
});

// Test dispatch: send a sample alert to ALL recipients with a given scope
router.post('/test-dispatch', async (req, res, next) => {
  try {
    const { scope } = z.object({
      scope: scopeEnum,
    }).parse(req.body);

    const telegramConfigs = await prisma.botConfig.findMany({
      where: { type: BotType.TELEGRAM, isActive: true },
      orderBy: { created: 'desc' },
    });

    let telegramBot: TelegrafBot | undefined;
    for (const cfg of telegramConfigs) {
      const live = botManager.getBot(cfg.id);
      if (live instanceof TelegrafBot) { telegramBot = live; break; }
    }

    if (!telegramBot) {
      res.status(400).json({ success: false, error: 'No active Telegram bot is running' });
      return;
    }

    const scopeLabels: Record<string, string> = {
      VIEW_DASHBOARDS: 'Просмотр дашбордов',
      VIEW_ERRORS: 'Просмотр ошибок',
      MANAGE_ALERTS: 'Управление алертами',
      RECEIVE_TELEGRAM_ALERTS: 'Получение Telegram-алертов',
      MANAGE_INTEGRATIONS: 'Управление интеграциями',
    };

    const now = new Date().toLocaleString('ru-RU', { timeZone: 'UTC' });
    const testMsg =
      `▸ *NODEWEAVER SOC — ТЕСТ РАССЫЛКИ*\n\n` +
      `SCOPE      : \`${scope}\`\n` +
      `ОПИСАНИЕ   : ${scopeLabels[scope] ?? scope}\n` +
      `ВРЕМЯ      : ${now} UTC\n` +
      `СТАТУС     : CHANNEL OPERATIONAL\n\n` +
      `Тестовая рассылка по подписчикам данного scope.\n` +
      `Реальные события безопасности будут иметь аналогичный приоритет и формат.\n\n` +
      `— _NodeWeaver Security Operations Center_`;

    const result = await alertDispatchService.dispatchTelegramToScope({
      bot: telegramBot,
      message: testMsg,
      scope,
      requireAtLeastOneSuccess: false,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/telegram-bots', async (req, res, next) => {
  // Prevent 304 caching — bot status changes at runtime, must always be fresh
  res.setHeader('Cache-Control', 'no-store');
  try {
    const userId = (req as AuthRequest).user?.userId;

    const configs = await prisma.botConfig.findMany({
      where: {
        type: BotType.TELEGRAM,
        userId: userId,
      },
      orderBy: { created: 'desc' },
    });

    const bots = configs.map((config) => {
      // Only read live status — never attempt to start a bot from this endpoint
      const live = botManager.getBot(config.id);
      const status = (live as any)?.getStatus?.();
      // Bot is online if it exists in the active map (same logic as the bots page)
      const isOnline = !!live;
      return {
        id: config.id,
        name: config.name,
        isActive: config.isActive,
        isOnline,
        tag: status?.tag || status?.type || 'TELEGRAM',
      };
    });

    res.json({ success: true, data: bots });
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
