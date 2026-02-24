import { prisma } from '../lib/prisma';
import { DiscordBot } from './DiscordBot';
import { TelegrafBot } from './TelegrafBot';
import { BotType } from '@prisma/client';
import { alertDispatchService } from './AlertDispatchService';

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
          const statusInfo = bot.getStatus ? bot.getStatus() : undefined;
          const tag = statusInfo?.tag || statusInfo?.type || '';
          const label = type === BotType.DISCORD ? 'Discord' : type === BotType.TELEGRAM ? 'Telegram' : 'Bot';
          console.log(`🤖 ${label} Bot (${botId}) Started${tag ? ` as ${tag}` : ''}`);

          // Notify all Telegram recipients that the bot came online (fire-and-forget)
          if (type === BotType.TELEGRAM && bot instanceof TelegrafBot) {
            const botTag = (statusInfo as any)?.tag || botId;
            const now = new Date().toLocaleString('ru-RU', { timeZone: 'UTC' });
            const startMsg =
              `▸ *NODEWEAVER SOC — АГЕНТ АКТИВИРОВАН*\n\n` +
              `АГЕНТ      : \`${botTag}\`\n` +
              `СОБЫТИЕ    : MONITORING STARTED\n` +
              `ВРЕМЯ      : ${now} UTC\n\n` +
              `Система мониторинга NodeWeaver переведена в активный режим.\n` +
              `Все инциденты, аномалии и критические события подлежат регистрации и передаче.\n\n` +
              `Уклонение от мониторинга является основанием для эскалации инцидента.\n\n` +
              `— _NodeWeaver Security Operations Center_`;
            alertDispatchService.dispatchTelegramToScope({
              bot: bot as TelegrafBot,
              message: startMsg,
              scope: 'RECEIVE_TELEGRAM_ALERTS',
              requireAtLeastOneSuccess: false,
            }).catch((err: any) => {
              console.warn(`[BotManager] Failed to send startup notification for bot ${botId}:`, err?.message);
            });
          }

          return bot;
      } catch (error) {
          if ((error as any)?.response?.error_code === 409) {
              console.error(`Failed to start bot ${botId}: Telegram reports another instance is polling (409 conflict). Stop other process or hosting that uses this token.`);
          } else {
              console.error(`Failed to start bot ${botId}:`, error);
          }
          return null;
      }
  }

  public async stopBot(botId: string) {
      const bot = this.bots.get(botId);
      if (bot) {
          // Notify all Telegram recipients that the bot is going offline (fire-and-forget)
          if (bot instanceof TelegrafBot) {
            const statusInfo = (bot as TelegrafBot).getStatus();
            const botTag = statusInfo?.tag || botId;
            const now = new Date().toLocaleString('ru-RU', { timeZone: 'UTC' });
            const stopMsg =
              `▸ *NODEWEAVER SOC — АГЕНТ ДЕАКТИВИРОВАН*\n\n` +
              `АГЕНТ      : \`${botTag}\`\n` +
              `СОБЫТИЕ    : MONITORING HALTED\n` +
              `ВРЕМЯ      : ${now} UTC\n\n` +
              `Система мониторинга переведена в режим ожидания.\n` +
              `Доставка алертов приостановлена до следующего запуска.\n\n` +
              `Если остановка не была инициирована вами — незамедлительно свяжитесь с администратором.\n\n` +
              `— _NodeWeaver Security Operations Center_`;
            try {
              await alertDispatchService.dispatchTelegramToScope({
                bot: bot as TelegrafBot,
                message: stopMsg,
                scope: 'RECEIVE_TELEGRAM_ALERTS',
                requireAtLeastOneSuccess: false,
              });
            } catch (_) { /* best-effort */ }
          }
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
