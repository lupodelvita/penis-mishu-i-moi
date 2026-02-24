import { Telegraf } from 'telegraf';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { Agent } from 'https';

function buildTelegramOptions(settings: any = {}): { apiRoot?: string; agent?: Agent } {
  // Per-bot settings take priority over global env vars so users never need to touch .env
  const localServer = (settings?.localServer as string | undefined)?.trim() || process.env.TELEGRAM_LOCAL_SERVER?.trim();
  if (localServer) {
    console.log(`🔌 Telegram: using local Bot API server at ${localServer}`);
    return { apiRoot: localServer };
  }

  const proxy = (settings?.proxy as string | undefined)?.trim() || process.env.TELEGRAM_PROXY?.trim();
  if (proxy) {
    if (proxy.startsWith('socks')) {
      console.log(`🔌 Telegram: using SOCKS proxy ${proxy}`);
      return { agent: new SocksProxyAgent(proxy) as unknown as Agent };
    }
    console.log(`🔌 Telegram: using HTTPS proxy ${proxy}`);
    return { agent: new HttpsProxyAgent(proxy) as unknown as Agent };
  }

  return {};
}

// Global mutex: only one Telegram bot may go through connect() at a time.
// This prevents two bots evicting each other during server startup.
let _telegramStartLock: Promise<void> = Promise.resolve();

export class TelegrafBot {
  private bot: Telegraf;
  private isReady: boolean = false;
  private botId: string;
  private settings: any;
  private botUsername?: string;
  constructor(botId: string, token: string, settings: any = {}) {
    this.botId = botId;
    this.settings = settings;
    const { apiRoot, agent } = buildTelegramOptions(settings);
    this.bot = new Telegraf(token, {
      telegram: {
        ...(apiRoot ? { apiRoot } : {}),
        ...(agent ? { agent } : {}),
      },
    });

    this.bot.catch((err: any) => {
      console.error(`Telegram Bot Error (${this.botId}):`, err);
    });
  }

  /**
   * Terminates any active long-poll for this token by issuing a competing
   * getUpdates(timeout=0) which beats the 50s poll, then clears webhook.
   * Called multiple times with a gap to be sure the slot is free.
   */
  private async evictExistingPoller() {
    for (let i = 0; i < 3; i++) {
      try {
        await this.bot.telegram.callApi('getUpdates' as any, { timeout: 0, limit: 1 } as any);
      } catch (_) { /* ignore */ }
      try {
        await this.bot.telegram.deleteWebhook({ drop_pending_updates: true });
      } catch (_) { /* ignore */ }
      if (i < 2) await new Promise(r => setTimeout(r, 800));
    }
    // Extra buffer after last eviction
    await new Promise(r => setTimeout(r, 1500));
  }

  public async connect() {
    if (this.isReady) return;

    // Acquire global start lock so only one telegram bot launches at a time
    let releaseLock!: () => void;
    const prevLock = _telegramStartLock;
    _telegramStartLock = new Promise<void>(resolve => { releaseLock = resolve; });

    try {
      await prevLock; // wait for previous bot to finish starting
      await this._doConnect();
    } finally {
      releaseLock();
    }
  }

  private async _doConnect() {
    // Skip eviction when using local Bot API server — it handles concurrent connections fine
    const usingLocalServer = !!(this.settings?.localServer as string | undefined)?.trim() || !!process.env.TELEGRAM_LOCAL_SERVER?.trim();
    if (!usingLocalServer) {
      await this.evictExistingPoller();
    }

    // bot.launch() starts an infinite polling loop and NEVER resolves — run it fire-and-forget.
    // We confirm connectivity separately via getMe().
    let launchError: any = null;
    this.bot.launch({ dropPendingUpdates: true }).catch((err: any) => {
      launchError = err;
    });

    // Give the bot time to establish the connection before checking
    await new Promise(r => setTimeout(r, 2000));

    if (launchError) {
      const code = launchError?.response?.error_code;
      if (code === 409 && !usingLocalServer) {
        console.warn(`Telegram bot ${this.botId} got 409, retrying after extra eviction...`);
        try { this.bot.stop('retry'); } catch (_) { /* ignore */ }
        await this.evictExistingPoller();
        launchError = null;
        this.bot.launch({ dropPendingUpdates: true }).catch((err: any) => { launchError = err; });
        await new Promise(r => setTimeout(r, 2000));
      }
      if (launchError) {
        console.error(`Failed to launch Telegram bot ${this.botId}:`, launchError);
        throw launchError;
      }
    }

    try {
      const me = await this.bot.telegram.getMe();
      this.botUsername = me.username;
      this.isReady = true;
      console.log(`🤖 Telegram Bot (${this.botId}) Logged in as @${me.username || 'unknown'} (id=${me.id})`);
    } catch (error) {
      console.error(`Failed to get bot info for ${this.botId}:`, error);
      throw error;
    }
  }

  public async disconnect() {
    try {
      await this.bot.stop();
    } catch (_) { /* ignore */ }
    try {
      await this.bot.telegram.deleteWebhook({ drop_pending_updates: true });
    } catch (_) { /* ignore */ }
    // Give Telegram 1s to free the polling slot before a new instance can connect
    await new Promise(r => setTimeout(r, 1000));
    this.isReady = false;
  }

  public async sendReport(chatId: string | null, message: string) {
    if (!this.isReady) throw new Error('Bot is not connected');
    
    const targetChatId = chatId || this.settings?.chatId;
    if (!targetChatId) throw new Error('No Chat ID provided');

    try {
      // Ensure bot is actually in the chat (user must have started the bot or added it to the group)
      await this.bot.telegram.getChat(targetChatId);
      await this.bot.telegram.sendMessage(targetChatId, message, { parse_mode: 'Markdown' });
      return true;
    } catch (error) {
      console.error(`Telegram Bot ${this.botId} failed to send report:`, error);
      throw error;
    }
  }

  public async validateChatAccess(chatId: string) {
    if (!this.isReady) throw new Error('Bot is not connected');
    if (!chatId) throw new Error('No Chat ID provided');

    // Only check membership/visibility without sending a message
    await this.bot.telegram.getChat(chatId);
    return true;
  }

  public getStatus() {
    return {
      id: this.botId,
      ready: this.isReady,
      type: 'TELEGRAM',
      tag: this.botUsername ? `@${this.botUsername}` : undefined,
    };
  }
}
