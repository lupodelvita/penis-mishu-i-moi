import { prisma } from '../lib/prisma';
import { DiscordBot } from './DiscordBot';
import { TelegrafBot } from './TelegrafBot';
import { BotType } from '@prisma/client';

class BotManagerService {
  private bots: Map<string, DiscordBot | TelegrafBot> = new Map();

  // Initialize all auto-start bots
  public async initialize() {
    console.log('🤖 BotManager: Initializing auto-start bots...');
    const configs = await prisma.botConfig.findMany({
        where: { isActive: true, autoStart: true }
    });

    for (const config of configs) {
        await this.startBot(config.id, config.type, config.token, config.settings);
    }
    console.log(`🤖 BotManager: Started ${this.bots.size} bots.`);
  }

  public async startBot(botId: string, type: BotType, token: string, settings: any = {}) {
      if (this.bots.has(botId)) return this.bots.get(botId);

      let bot: any;
      if (type === BotType.DISCORD) {
          bot = new DiscordBot(botId, token, settings);
      } else if (type === BotType.TELEGRAM) {
          bot = new TelegrafBot(botId, token, settings);
      }

      if (!bot) return null;

      try {
          await bot.connect();
          this.bots.set(botId, bot);
          return bot;
      } catch (error) {
          console.error(`Failed to start bot ${botId}:`, error);
          return null;
      }
  }

  public async stopBot(botId: string) {
      const bot = this.bots.get(botId);
      if (bot) {
          await bot.disconnect();
          this.bots.delete(botId);
      }
  }

  public getBot(botId: string) {
      return this.bots.get(botId);
  }

  public getAllActiveBots() {
      return Array.from(this.bots.values()).map(b => b.getStatus());
  }

  public async getBotsWithStatus(userId: string) {
      const configs = await prisma.botConfig.findMany({
          where: { userId },
          orderBy: { created: 'desc' }
      });

      return configs.map(b => {
          const activeInstance = this.bots.get(b.id);
          const statusInfo = activeInstance?.getStatus() as any;
          return {
              ...b,
              status: activeInstance ? 'ONLINE' : 'OFFLINE',
              tag: statusInfo?.tag || statusInfo?.type || (activeInstance ? 'Ready' : null)
          };
      });
  }
}

export const botManager = new BotManagerService();
