import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

export class ObservabilityAccessService {
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

  public async createAuditLog(params: {
    action:
      | 'INVITE_CREATED'
      | 'INVITE_ACCEPTED'
      | 'INVITE_REVOKED'
      | 'ACCESS_GRANTED'
      | 'ACCESS_REVOKED'
      | 'TELEGRAM_CHAT_LINKED'
      | 'TELEGRAM_CHAT_UNLINKED'
      | 'SCOPES_UPDATED';
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
