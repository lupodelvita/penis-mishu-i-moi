import { autoUpdater, UpdateCheckResult } from 'electron-updater';
import { BrowserWindow, dialog, app } from 'electron';
import * as log from 'electron-log';

// Configure logging
autoUpdater.logger = log;
(autoUpdater.logger as any).transports.file.level = 'info';

// Don't auto-download — let user decide
autoUpdater.autoDownload = false;
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
    log.info('Update available:', info.version);
    
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'Доступно обновление',
      message: `Доступна новая версия NodeWeaver: v${info.version}`,
      detail: `Текущая версия: v${app.getVersion()}\nНовая версия: v${info.version}\n\nСкачать обновление?`,
      buttons: ['Скачать', 'Позже'],
      defaultId: 0,
      cancelId: 1,
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate();
        mainWindow?.webContents.send('updater:downloading');
      }
    });
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
    log.info('Update downloaded:', info.version);

    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'Обновление готово',
      message: `NodeWeaver v${info.version} скачан и готов к установке.`,
      detail: 'Приложение перезапустится для установки обновления.',
      buttons: ['Установить сейчас', 'Установить при закрытии'],
      defaultId: 0,
      cancelId: 1,
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
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
