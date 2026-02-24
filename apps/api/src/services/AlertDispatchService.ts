import {
  observabilityAccessService,
  ObservabilityScopeValue,
  TelegramScopeRecipient,
} from './ObservabilityAccessService';

interface TelegramReportSender {
  sendReport(chatId: string | null, message: string): Promise<boolean>;
}

export interface TelegramDispatchResult {
  scope: ObservabilityScopeValue;
  totalRecipients: number;
  attemptedRecipients: number;
  deliveredRecipients: number;
  failedRecipients: Array<{
    userId: string;
    username: string;
    chatId: string;
    reason: string;
  }>;
}

interface DispatchTelegramToScopeParams {
  bot: TelegramReportSender;
  message: string;
  scope?: ObservabilityScopeValue;
  requireAtLeastOneSuccess?: boolean;
}

class AlertDispatchService {
  private readonly telegramSafeChunkSize = 3900;

  private splitTelegramMessage(message: string): string[] {
    if (!message) {
      return [''];
    }

    if (message.length <= this.telegramSafeChunkSize) {
      return [message];
    }

    const chunks: string[] = [];
    const lines = message.split('\n');
    let currentChunk = '';

    for (const line of lines) {
      const candidate = currentChunk ? `${currentChunk}\n${line}` : line;
      if (candidate.length <= this.telegramSafeChunkSize) {
        currentChunk = candidate;
        continue;
      }

      if (currentChunk) {
        chunks.push(currentChunk);
      }

      if (line.length <= this.telegramSafeChunkSize) {
        currentChunk = line;
        continue;
      }

      let index = 0;
      while (index < line.length) {
        const part = line.slice(index, index + this.telegramSafeChunkSize);
        chunks.push(part);
        index += this.telegramSafeChunkSize;
      }
      currentChunk = '';
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks.length ? chunks : [''];
  }

  public async dispatchTelegramToScope(params: DispatchTelegramToScopeParams): Promise<TelegramDispatchResult> {
    const scope = params.scope ?? 'RECEIVE_TELEGRAM_ALERTS';
    const recipients: TelegramScopeRecipient[] = await observabilityAccessService.getTelegramRecipients(scope);

    const uniqueRecipients = Array.from(
      new Map<string, TelegramScopeRecipient>(
        recipients.map((recipient) => [recipient.chatId, recipient]),
      ).values(),
    );

    const result: TelegramDispatchResult = {
      scope,
      totalRecipients: uniqueRecipients.length,
      attemptedRecipients: 0,
      deliveredRecipients: 0,
      failedRecipients: [],
    };

    if (!uniqueRecipients.length) {
      if (params.requireAtLeastOneSuccess !== false) {
        throw new Error(`No approved Telegram recipients with scope ${scope}`);
      }
      return result; // 0 recipients — return empty result gracefully
    }

    const chunks = this.splitTelegramMessage(params.message);

    for (const recipient of uniqueRecipients) {
      result.attemptedRecipients += 1;

      try {
        for (const chunk of chunks) {
          await params.bot.sendReport(recipient.chatId, chunk);
        }
        result.deliveredRecipients += 1;
      } catch (error: any) {
        result.failedRecipients.push({
          userId: recipient.userId,
          username: recipient.username,
          chatId: recipient.chatId,
          reason: error?.message || 'Unknown Telegram delivery error',
        });
      }
    }

    if (params.requireAtLeastOneSuccess !== false && result.deliveredRecipients === 0) {
      throw new Error(`Telegram delivery failed for all approved recipients (scope: ${scope})`);
    }

    return result;
  }
}

export const alertDispatchService = new AlertDispatchService();
