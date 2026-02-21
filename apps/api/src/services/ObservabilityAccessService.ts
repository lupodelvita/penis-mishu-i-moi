import { prisma } from '../lib/prisma';
import { Prisma, ObservabilityScope, ObservabilityInviteStatus, ObservabilityAuditAction } from '@prisma/client';
import { createHash } from 'crypto';

class ObservabilityError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type ObservabilityScopeValue =
  | 'VIEW_DASHBOARDS'
  | 'VIEW_ERRORS'
  | 'MANAGE_ALERTS'
  | 'RECEIVE_TELEGRAM_ALERTS'
  | 'MANAGE_INTEGRATIONS';

export class ObservabilityAccessService {
  private async assertEligibleTier(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { license: true },
    });

    const tier = user?.license?.tier;
    if (!user || !tier || (tier !== 'DEVELOPER' && tier !== 'CEO')) {
      throw new ObservabilityError('Observability access requires DEVELOPER or CEO license tier', 403);
    }
  }

  private isExpired(expiresAt?: Date | null): boolean {
    return !!expiresAt && expiresAt < new Date();
  }

  private toTokenHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  public async hasActiveAccess(userId: string): Promise<boolean> {
    const access = await prisma.observabilityAccess.findUnique({
      where: { userId },
      include: { user: { include: { license: true } } },
    });

    if (!access || !access.isActive) {
      return false;
    }

    if (access.expiresAt && access.expiresAt < new Date()) {
      return false;
    }

    const licenseTier = access.user.license?.tier;
    return licenseTier === 'DEVELOPER' || licenseTier === 'CEO';
  }

  public async requireAccess(userId: string): Promise<void> {
    const hasAccess = await this.hasActiveAccess(userId);
    if (!hasAccess) {
      throw new ObservabilityError('Observability access is not active for this account', 403);
    }
  }

  public async hasScope(userId: string, scope: ObservabilityScopeValue): Promise<boolean> {
    const access = await prisma.observabilityAccess.findUnique({
      where: { userId },
      include: { user: { include: { license: true } } },
    });

    if (!access || !access.isActive || this.isExpired(access.expiresAt)) {
      return false;
    }

    const tier = access.user.license?.tier;
    if (!tier || (tier !== 'DEVELOPER' && tier !== 'CEO')) {
      return false;
    }

    return access.scopes.includes(scope as ObservabilityScope);
  }

  public async requireScope(userId: string, scope: ObservabilityScopeValue): Promise<void> {
    const hasScope = await this.hasScope(userId, scope);
    if (!hasScope) {
      throw new ObservabilityError(`Scope ${scope} is required`, 403);
    }
  }

  public async getAccess(userId: string) {
    return prisma.observabilityAccess.findUnique({
      where: { userId },
      include: {
        invite: true,
        grantedBy: {
          select: { id: true, username: true },
        },
      },
    });
  }

  public async previewInvite(userId: string, inviteToken: string) {
    const tokenHash = this.toTokenHash(inviteToken);

    const [invite, user] = await Promise.all([
      prisma.observabilityInvite.findUnique({
        where: { tokenHash },
        include: {
          invitedBy: { select: { id: true, username: true } },
          invitedUser: { select: { id: true, username: true } },
        },
      }),
      prisma.user.findUnique({ where: { id: userId }, include: { license: true } }),
    ]);

    if (!invite) {
      throw new ObservabilityError('Invite token not found', 404);
    }

    if (invite.status !== ObservabilityInviteStatus.PENDING) {
      throw new ObservabilityError('Invite is not pending', 400);
    }

    if (this.isExpired(invite.expiresAt)) {
      throw new ObservabilityError('Invite has expired', 400);
    }

    if (!user) {
      throw new ObservabilityError('User not found', 404);
    }

    if (invite.invitedUserId && invite.invitedUserId !== userId) {
      throw new ObservabilityError('Invite is issued for another user', 403);
    }

    if (invite.invitedUsername && invite.invitedUsername !== user.username) {
      throw new ObservabilityError('Invite username does not match current account', 403);
    }

    return {
      invite,
      user,
    };
  }

  public async acceptInvite(params: {
    userId: string;
    inviteToken: string;
    telegramChatId?: string;
  }) {
    await this.assertEligibleTier(params.userId);

    const preview = await this.previewInvite(params.userId, params.inviteToken);
    const invite = preview.invite;

    const result = await prisma.$transaction(async (tx) => {
      const access = await tx.observabilityAccess.upsert({
        where: { userId: params.userId },
        update: {
          scopes: invite.scopes,
          isActive: true,
          inviteId: invite.id,
          grantedById: invite.invitedById,
          telegramChatId: params.telegramChatId,
          expiresAt: invite.expiresAt,
        },
        create: {
          userId: params.userId,
          scopes: invite.scopes,
          isActive: true,
          inviteId: invite.id,
          grantedById: invite.invitedById,
          telegramChatId: params.telegramChatId,
          expiresAt: invite.expiresAt,
        },
      });

      const acceptedInvite = await tx.observabilityInvite.update({
        where: { id: invite.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          invitedUserId: params.userId,
        },
      });

      await tx.observabilityAuditLog.create({
        data: {
          action: ObservabilityAuditAction.INVITE_ACCEPTED,
          actorUserId: params.userId,
          subjectUserId: params.userId,
          inviteId: invite.id,
          accessId: access.id,
        },
      });

      await tx.observabilityAuditLog.create({
        data: {
          action: ObservabilityAuditAction.ACCESS_GRANTED,
          actorUserId: invite.invitedById,
          subjectUserId: params.userId,
          inviteId: invite.id,
          accessId: access.id,
          details: {
            source: 'invite_accept',
            scopes: invite.scopes,
          } as Prisma.InputJsonValue,
        },
      });

      if (params.telegramChatId) {
        await tx.observabilityAuditLog.create({
          data: {
            action: ObservabilityAuditAction.TELEGRAM_CHAT_LINKED,
            actorUserId: params.userId,
            subjectUserId: params.userId,
            accessId: access.id,
            inviteId: invite.id,
            details: {
              telegramChatId: params.telegramChatId,
            } as Prisma.InputJsonValue,
          },
        });
      }

      return {
        access,
        invite: acceptedInvite,
      };
    });

    return result;
  }

  public async updateOwnTelegramChat(userId: string, telegramChatId: string | null) {
    await this.requireAccess(userId);

    const access = await prisma.observabilityAccess.update({
      where: { userId },
      data: {
        telegramChatId,
      },
    });

    await this.createAuditLog({
      action: telegramChatId ? 'TELEGRAM_CHAT_LINKED' : 'TELEGRAM_CHAT_UNLINKED',
      actorUserId: userId,
      subjectUserId: userId,
      accessId: access.id,
      details: {
        telegramChatId,
        source: 'self_service',
      },
    });

    return access;
  }

  public async getTelegramRecipients(scope: ObservabilityScopeValue = 'RECEIVE_TELEGRAM_ALERTS') {
    const accesses = await prisma.observabilityAccess.findMany({
      where: {
        isActive: true,
        telegramChatId: {
          not: null,
        },
        scopes: {
          has: scope as ObservabilityScope,
        },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        user: {
          include: {
            license: true,
          },
        },
      },
    });

    return accesses
      .filter((access) => {
        const tier = access.user.license?.tier;
        return tier === 'DEVELOPER' || tier === 'CEO';
      })
      .map((access) => ({
        userId: access.userId,
        username: access.user.username,
        chatId: access.telegramChatId as string,
        scopes: access.scopes,
      }));
  }

  public async createAuditLog(params: {
    action: ObservabilityAuditAction;
    actorUserId?: string;
    subjectUserId?: string;
    accessId?: string;
    inviteId?: string;
    details?: Record<string, unknown>;
  }) {
    return prisma.observabilityAuditLog.create({
      data: {
        action: params.action,
        actorUserId: params.actorUserId,
        subjectUserId: params.subjectUserId,
        accessId: params.accessId,
        inviteId: params.inviteId,
        details: params.details as Prisma.InputJsonValue | undefined,
      },
    });
  }
}

export const observabilityAccessService = new ObservabilityAccessService();
