import { Telegraf } from 'telegraf';

export class TelegrafBot {
  private bot: Telegraf;
  private isReady: boolean = false;
  private botId: string;
  private settings: any;
  constructor(botId: string, token: string, settings: any = {}) {
    this.botId = botId;
    this.settings = settings;
    this.bot = new Telegraf(token);

    this.bot.catch((err: any) => {
      console.error(`Telegram Bot Error (${this.botId}):`, err);
    });
  }

  public async connect() {
    if (this.isReady) return;
    try {
      await this.bot.launch();
      this.isReady = true;
      console.log(`🤖 Telegram Bot (${this.botId}) Started`);
    } catch (error) {
      console.error(`Failed to launch Telegram bot ${this.botId}:`, error);
      throw error;
    }
  }

  public async disconnect() {
    if (this.isReady) {
      await this.bot.stop();
      this.isReady = false;
    }
  }

  public async sendReport(chatId: string | null, message: string) {
    if (!this.isReady) throw new Error('Bot is not connected');
    
    const targetChatId = chatId || this.settings?.chatId;
    if (!targetChatId) throw new Error('No Chat ID provided');

    try {
      await this.bot.telegram.sendMessage(targetChatId, message, { parse_mode: 'Markdown' });
      return true;
    } catch (error) {
      console.error(`Telegram Bot ${this.botId} failed to send report:`, error);
      throw error;
    }
  }

  public getStatus() {
    return {
      id: this.botId,
      ready: this.isReady,
      type: 'TELEGRAM'
    };
  }
}
