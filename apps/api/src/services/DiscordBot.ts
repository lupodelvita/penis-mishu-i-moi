import { Client, GatewayIntentBits, TextChannel } from 'discord.js';

export class DiscordBot {
  private client: Client;
  private isReady: boolean = false;
  private token: string;
  private settings: any;
  public botId: string; // Database ID mapping

  constructor(botId: string, token: string, settings: any = {}) {
    this.botId = botId;
    this.token = token;
    this.settings = settings;
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds],
    });

    this.client.on('ready', () => {
      this.isReady = true;
      console.log(`🤖 Discord Bot (${this.botId}) Logged in as ${this.client.user?.tag}`);
      this.client.user?.setActivity('NodeWeaver OSINT', { type: 0 });
    });

    this.client.on('error', (err) => {
      console.error(`Discord Client Error (${this.botId}):`, err);
    });
  }

  public async connect() {
    if (this.isReady) return;

    try {
      await this.client.login(this.token);
    } catch (error) {
      console.error(`Failed to login bot ${this.botId}:`, error);
      this.isReady = false;
      throw error;
    }
  }

  public async disconnect() {
      if (this.isReady) {
          await this.client.destroy();
          this.isReady = false;
      }
  }

  public async sendReport(channelId: string | null, embedData: any) {
    if (!this.isReady) {
       throw new Error('Bot is not connected.');
    }

    const targetChannelId = channelId || this.settings?.channelId;
    if (!targetChannelId) throw new Error('No channel ID provided');

    try {
      const channel = await this.client.channels.fetch(targetChannelId);
      if (!channel || !(channel instanceof TextChannel)) {
        throw new Error('Channel not found or is not a text channel.');
      }

      await channel.send({ embeds: [embedData] });
      return true;
    } catch (error) {
      console.error(`Bot ${this.botId} failed to send report:`, error);
      throw error;
    }
  }
  
  public getClient() {
      return this.client;
  }

  public getStatus() {
      return {
          id: this.botId,
          ready: this.isReady,
          tag: this.client.user?.tag
      };
  }
}
