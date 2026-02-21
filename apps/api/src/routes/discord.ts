import { Router } from 'express';
import https from 'https';
import { botManager } from '../services/BotManager';
import { DiscordBot } from '../services/DiscordBot';
import { alertDispatchService } from '../services/AlertDispatchService';
import { prisma } from '../lib/prisma';

const router = Router();

// ... Interfaces (kept same) ...
interface DiscordWebhookPayload {
  content?: string;
  embeds?: any[];
  username?: string;
  avatar_url?: string;
}

// Helper: Classic Webhook Send
function sendToDiscord(webhookUrl: string, payload: DiscordWebhookPayload): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = new URL(webhookUrl);
    const data = JSON.stringify(payload);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };
    const req = https.request(options, (res) => {
      if (res.statusCode === 204 || res.statusCode === 200) resolve();
      else reject(new Error(`Webhook returned ${res.statusCode}`));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Export graph to Discord
router.post('/export-graph', async (req, res) => {
  try {
    const { webhookUrl, graph, botId, channelId } = req.body;
    
    // Validate inputs
    if (!webhookUrl && !botId) {
        res.status(400).json({ success: false, error: 'Either Webhook URL or Bot ID required' });
        return;
    }

    if (!graph) {
      res.status(400).json({ success: false, error: 'Graph data required' });
      return;
    }
    
    // Construct Embed (Simplified for brevity, assume same logic as before)
    const embed = {
      title: `📊 ${graph.name || 'Investigation Graph'}`,
      description: graph.description || 'OSINT Investigation Results',
      color: 0x8b5cf6,
      fields: [
        { name: '🔍 Entities', value: `${graph.entities?.length || 0}`, inline: true },
        { name: '🔗 Links', value: `${graph.links?.length || 0}`, inline: true },
        { name: '📅 Created', value: new Date(graph.created).toLocaleString(), inline: true }
      ],
      footer: { text: 'NodeWeaver OSINT' },
      timestamp: new Date().toISOString()
    };

    const payload: DiscordWebhookPayload = { username: 'NodeWeaver', embeds: [embed] };

    // Send Logic
    if (botId) {
        const bot = botManager.getBot(botId);
        if (!bot) {
             res.status(404).json({ success: false, error: 'Bot not found or not active' });
             return;
        }
        
           if (bot instanceof DiscordBot && !channelId) {
             res.status(400).json({ success: false, error: 'Channel ID required when using Discord Bot' });
             return;
           }

        if ('sendReport' in bot) {
            if (bot instanceof DiscordBot) {
                await bot.sendReport(channelId, embed);
            } else {
                const text = `📊 *${graph.name}*\n${graph.description}\n\n🔍 Entities: ${graph.entities?.length}\n🔗 Links: ${graph.links?.length}`;
                const dispatchResult = await alertDispatchService.dispatchTelegramToScope({
                  bot: bot as { sendReport(chatId: string | null, message: string): Promise<boolean> },
                  message: text,
                  scope: 'RECEIVE_TELEGRAM_ALERTS',
                });

                if (!dispatchResult.totalRecipients) {
                  res.status(403).json({
                    success: false,
                    error: 'No approved Telegram recipients with RECEIVE_TELEGRAM_ALERTS scope',
                  });
                  return;
                }

                res.json({
                  success: true,
                  message: `Exported to Telegram approved recipients: ${dispatchResult.deliveredRecipients}/${dispatchResult.totalRecipients}`,
                  data: {
                    delivered: dispatchResult.deliveredRecipients,
                    totalRecipients: dispatchResult.totalRecipients,
                    failedRecipients: dispatchResult.failedRecipients,
                  },
                });
                return;
            }
        }
    } else {
        await sendToDiscord(webhookUrl, payload);
    }
    
    res.json({ success: true, message: 'Exported successfully' });
    
  } catch (error: any) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// List Available Bots (For dropdown in UI)
router.get('/bots', async (_req, res) => {
    // In future: Filter by User ID from Auth
    const bots = await prisma.botConfig.findMany({ 
        where: { isActive: true },
        select: { id: true, name: true, type: true }
    });
    
    const status = bots.map((b: any) => {
        const active = botManager.getBot(b.id);
        const st = active?.getStatus() as any;
        return {
            ...b,
            isOnline: !!active,
            tag: st?.tag || st?.type || 'Online'
        };
    });

    res.json({ success: true, data: status });
});

export default router;
