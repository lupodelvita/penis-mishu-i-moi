import { prisma } from '../lib/prisma';
import { LicenseTier, Role } from '@prisma/client';

// Define Limits Hardcoded for now
export const TIER_LIMITS = {
  [LicenseTier.OBSERVER]: {
    maxGraphs: 1,
    maxEntitiesPerGraph: 50,
    maxBots: 0,
    canExportPdf: false,
    canExportAi: false,
    hasApiAccess: false
  },
  [LicenseTier.ANALYST]: {
    maxGraphs: 3,
    maxEntitiesPerGraph: 150,
    maxBots: 1,
    canExportPdf: true,
    canExportAi: false,
    hasApiAccess: false
  },
  [LicenseTier.OPERATIVE]: {
    maxGraphs: 10,
    maxEntitiesPerGraph: 500,
    maxBots: 3,
    canExportPdf: true,
    canExportAi: true,
    hasApiAccess: false
  },
  [LicenseTier.DEVELOPER]: {
    maxGraphs: Infinity,
    maxEntitiesPerGraph: Infinity,
    maxBots: 10,
    canExportPdf: true,
    canExportAi: true,
    hasApiAccess: true
  },
  [LicenseTier.ENTERPRISE]: {
    maxGraphs: Infinity,
    maxEntitiesPerGraph: Infinity,
    maxBots: Infinity,
    canExportPdf: true,
    canExportAi: true,
    hasApiAccess: true
  },
  [LicenseTier.CEO]: {
    maxGraphs: Infinity,
    maxEntitiesPerGraph: Infinity,
    maxBots: Infinity,
    canExportPdf: true,
    canExportAi: true,
    hasApiAccess: true
  }
};

export class LicenseService {
  
  public async getLimits(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { license: true }
    });

    // 1. Determine base tier
    let tier = user?.license?.tier || LicenseTier.OBSERVER;
    
    // 2. Check Expiration and Active Status
    if (user?.license) {
        const isExpired = user.license.expiresAt && new Date() > user.license.expiresAt;
        if (!user.license.isActive || isExpired) {
            tier = LicenseTier.OBSERVER; // Revert to free if expired
        }
    }
    
    // CEO Override (Admins get CEO limits)
    if (user?.role === Role.ADMIN) return TIER_LIMITS[LicenseTier.CEO];

    return TIER_LIMITS[tier];
  }

  public async canCreateGraph(userId: string): Promise<boolean> {
    const limits = await this.getLimits(userId);
    if (limits.maxGraphs === Infinity) return true;

    const count = await prisma.graph.count({ where: { userId } });
    return count < limits.maxGraphs;
  }

  public async canAddBot(userId: string): Promise<boolean> {
    const limits = await this.getLimits(userId);
    if (limits.maxBots === Infinity) return true;

    const count = await prisma.botConfig.count({ where: { userId } });
    return count < limits.maxBots;
  }
  
  public async canAddEntity(userId: string, graphId: string): Promise<boolean> {
      const limits = await this.getLimits(userId);
      if (limits.maxEntitiesPerGraph === Infinity) return true;

      const count = await prisma.entity.count({ where: { graphId } });
      return count < limits.maxEntitiesPerGraph;
  }
}

export const licenseService = new LicenseService();
