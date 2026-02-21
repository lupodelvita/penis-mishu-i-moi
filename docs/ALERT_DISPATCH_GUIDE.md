# Alert Dispatch Guide

Этот документ фиксирует единый способ отправки алертов в NodeWeaver так, чтобы работала модель доступа Observability Access.

## Главное правило

Любая новая Telegram-рассылка должна идти через `alertDispatchService`.

Файл: `apps/api/src/services/AlertDispatchService.ts`

Это гарантирует:
- отправку **только** в approved recipients из `ObservabilityAccess`;
- фильтрацию по scope (`RECEIVE_TELEGRAM_ALERTS` и др.);
- дедупликацию `chat_id`;
- безопасную отправку длинных сообщений (chunking);
- единый формат результата доставки.

## Базовый шаблон использования

```ts
import { alertDispatchService } from '../services/AlertDispatchService';
import { TelegrafBot } from '../services/TelegrafBot';

const result = await alertDispatchService.dispatchTelegramToScope({
  bot: telegramBotInstance,
  message: textMessage,
  scope: 'RECEIVE_TELEGRAM_ALERTS',
});
```

## Что не делать

- Не отправлять Telegram напрямую в `chatId`, пришедший извне, если это alert/observability поток.
- Не дублировать логику выборки recipients по проекту.
- Не обходить scope-проверку вручную.

## Anti-bypass guard

В репозитории включена автоматическая проверка обходов:

- локально: `npm run validate:alert-dispatch`
- CI: workflow `Validate Alert Dispatch Guard` (`.github/workflows/validate-alert-dispatch.yml`)

Проверка валит билд, если находит:
- прямой `TelegrafBot` import в неразрешённых местах;
- прямой `telegram.sendMessage(...)` вне `TelegrafBot`;
- прямой `observabilityAccessService.getTelegramRecipients(...)` вне централизованных файлов.

## Для будущих каналов

При добавлении новых каналов (например, email/push):
1. Добавить методы в `AlertDispatchService`.
2. Использовать ту же access/scope-модель из `ObservabilityAccessService`.
3. Подключать новые фичи только через этот сервис, а не прямыми вызовами SDK.
