import { autoUpdater, UpdateCheckResult } from 'electron-updater';
import { BrowserWindow, dialog, app } from 'electron';
import * as log from 'electron-log';

// Configure logging
autoUpdater.logger = log;
(autoUpdater.logger as any).transports.file.level = 'info';

// Auto-download and auto-install updates silently
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow: BrowserWindow | null = null;

export function initAutoUpdater(window: BrowserWindow) {
  mainWindow = window;

  // Check for updates on startup (after a delay)
  setTimeout(() => {
    checkForUpdates(false);
  }, 5000);

  // Check every 4 hours
  setInterval(() => {
    checkForUpdates(false);
  }, 4 * 60 * 60 * 1000);

  // ---- Events ----

  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info.version, '- Auto-downloading...');
    // Автоматически скачиваем обновление (autoDownload = true)
    // Уведомление отправляется в renderer process для индикации
    mainWindow?.webContents.send('updater:downloading', { version: info.version });
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('No updates available. Current version:', app.getVersion());
  });

  autoUpdater.on('download-progress', (progress) => {
    log.info(`Download speed: ${progress.bytesPerSecond} - Downloaded ${progress.percent.toFixed(1)}%`);
    mainWindow?.webContents.send('updater:progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info.version, '- Installing and restarting...');
    
    // Автоматически устанавливаем и перезапускаем приложение
    // Параметры: quitAndInstall(isSilent, isForceRunAfter)
    // isSilent = false: закрыть окна перед установкой
    // isForceRunAfter = true: запустить приложение после установки
    setTimeout(() => {
      autoUpdater.quitAndInstall(false, true);
    }, 1000); // Задержка 1 сек для завершения текущих операций
  });

  autoUpdater.on('error', (error) => {
    log.error('Auto-updater error:', error);
  });
}

export async function checkForUpdates(showNoUpdateDialog: boolean = true): Promise<void> {
  try {
    const result: UpdateCheckResult | null = await autoUpdater.checkForUpdates();
    
    if (showNoUpdateDialog && !result?.updateInfo?.version) {
      dialog.showMessageBox(mainWindow!, {
        type: 'info',
        title: 'Обновления',
        message: 'У вас последняя версия NodeWeaver.',
        detail: `Версия: v${app.getVersion()}`,
      });
    }
  } catch (error) {
    log.error('Failed to check for updates:', error);
    if (showNoUpdateDialog) {
      dialog.showMessageBox(mainWindow!, {
        type: 'error',
        title: 'Ошибка проверки обновлений',
        message: 'Не удалось проверить обновления.',
        detail: 'Проверьте подключение к интернету и попробуйте позже.',
      });
    }
  }
}
