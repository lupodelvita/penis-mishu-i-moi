import { app, BrowserWindow, Menu, shell, ipcMain, dialog, nativeTheme, net, protocol } from 'electron';
import path from 'path';
import { pathToFileURL } from 'url';
import Store from 'electron-store';
import { initAutoUpdater, checkForUpdates } from './services/AutoUpdater';

// Register app:// as a privileged scheme — MUST be called before app.ready
// This lets the renderer load _next/static assets via app://renderer/... instead of
// broken absolute file:// paths that differ on every end-user machine.
protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
}]);

// Check if running in development
const isDev = !app.isPackaged;

// Enable hot reload in development
if (isDev) {
  process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'; // Suppress warnings
  try {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
      hardResetMethod: 'exit',
      awaitWriteFinish: true,
    });
  } catch (err) {
    console.log('electron-reload not available');
  }
}

// Initialize store for app settings
const store = new Store({
  defaults: {
    windowBounds: { width: 1400, height: 900 },
    theme: 'dark',
    apiUrl: 'http://localhost:4000',
    recentGraphs: [],
  },
});

// Initialize Terminal Service
import { TerminalService } from './services/TerminalService';
console.log('[Main] Initializing TerminalService...');
const terminalService = new TerminalService();

let mainWindow: BrowserWindow | null = null;


// Create the main application window
function createWindow() {
  const { width, height } = store.get('windowBounds') as { width: number; height: number };

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 1024,
    minHeight: 768,
    title: 'NodeWeaver',
    icon: path.join(__dirname, '../resources/icon.png'),
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the app
  if (isDev) {
    // In development, robustly check ports 3000 and 3001
    // This allows the desktop app to connect even if Next.js shifted to 3001
    const ports = [3000, 3001];
    const loadDevServer = async () => {
      for (const port of ports) {
        try {
          await new Promise<void>((resolve, reject) => {
            const req = require('http').get(`http://localhost:${port}`, (res: any) => {
              if (res.statusCode === 200) resolve();
              else reject();
            });
            req.on('error', reject);
            req.end();
          });
          console.log(`[Electron] Connected to Dev Server on port ${port}`);
          mainWindow?.loadURL(`http://localhost:${port}`);
          mainWindow?.webContents.openDevTools();
          return;
        } catch (e) {
          console.log(`[Electron] Port ${port} not available, trying next...`);
        }
      }
      // Fallback if both fail (though unlikely given npm run dev:all is up)
      console.log('[Electron] All ports failed, defaulting to 3000');
      mainWindow?.loadURL('http://localhost:3000');
    };
    loadDevServer();
  } else {
    // In production, serve via the app:// custom protocol so _next/ assets resolve correctly
    mainWindow.loadURL('app://renderer/index.html');
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();

    // Initialize auto-updater in production
    if (!isDev && mainWindow) {
      initAutoUpdater(mainWindow);
    }
  });

  // Save window size on resize
  mainWindow.on('resize', () => {
    if (mainWindow) {
      const { width, height } = mainWindow.getBounds();
      store.set('windowBounds', { width, height });
    }
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create application menu
  createMenu();
}

// Create application menu
function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Graph',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu:new-graph'),
        },
        {
          label: 'Open Graph...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow!, {
              filters: [
                { name: 'NodeWeaver Graph', extensions: ['nwg', 'json'] },
                { name: 'All Files', extensions: ['*'] },
              ],
              properties: ['openFile'],
            });
            if (!result.canceled && result.filePaths[0]) {
              mainWindow?.webContents.send('menu:open-graph', result.filePaths[0]);
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:save'),
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: async () => {
            const result = await dialog.showSaveDialog(mainWindow!, {
              filters: [
                { name: 'NodeWeaver Graph', extensions: ['nwg'] },
                { name: 'JSON', extensions: ['json'] },
              ],
            });
            if (!result.canceled && result.filePath) {
              mainWindow?.webContents.send('menu:save-as', result.filePath);
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Export',
          submenu: [
            {
              label: 'Export as PNG...',
              click: () => mainWindow?.webContents.send('menu:export', 'png'),
            },
            {
              label: 'Export as PDF...',
              click: () => mainWindow?.webContents.send('menu:export', 'pdf'),
            },
            {
              label: 'Export as CSV...',
              click: () => mainWindow?.webContents.send('menu:export', 'csv'),
            },
            { type: 'separator' },
            {
              label: 'Send to Discord...',
              click: () => mainWindow?.webContents.send('menu:export', 'discord'),
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { type: 'separator' },
        {
          label: 'Select All Entities',
          accelerator: 'CmdOrCtrl+A',
          click: () => mainWindow?.webContents.send('menu:select-all'),
        },
        {
          label: 'Delete Selected',
          accelerator: 'Delete',
          click: () => mainWindow?.webContents.send('menu:delete-selected'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => mainWindow?.webContents.send('menu:zoom', 'in'),
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => mainWindow?.webContents.send('menu:zoom', 'out'),
        },
        {
          label: 'Fit to Window',
          accelerator: 'CmdOrCtrl+0',
          click: () => mainWindow?.webContents.send('menu:zoom', 'fit'),
        },
        { type: 'separator' },
        {
          label: 'Toggle Entity Palette',
          accelerator: 'CmdOrCtrl+1',
          click: () => mainWindow?.webContents.send('menu:toggle-panel', 'entities'),
        },
        {
          label: 'Toggle Transform Panel',
          accelerator: 'CmdOrCtrl+2',
          click: () => mainWindow?.webContents.send('menu:toggle-panel', 'transforms'),
        },
        { type: 'separator' },
        {
          label: 'Dark Mode',
          type: 'checkbox',
          checked: store.get('theme') === 'dark',
          click: (menuItem) => {
            const theme = menuItem.checked ? 'dark' : 'light';
            store.set('theme', theme);
            mainWindow?.webContents.send('menu:theme', theme);
          },
        },
        { type: 'separator' },
        { label: 'Toggle Developer Tools', accelerator: 'F12', role: 'toggleDevTools' },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
      ],
    },
    {
      label: 'Investigate',
      submenu: [
        {
          label: 'Run All Transforms',
          accelerator: 'CmdOrCtrl+T',
          click: () => mainWindow?.webContents.send('menu:run-all-transforms'),
        },
        {
          label: 'Run Selected Transform',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => mainWindow?.webContents.send('menu:run-selected-transform'),
        },
        { type: 'separator' },
        {
          label: 'Add Entity...',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow?.webContents.send('menu:add-entity'),
        },
        {
          label: 'Create Link',
          accelerator: 'CmdOrCtrl+L',
          click: () => mainWindow?.webContents.send('menu:create-link'),
        },
      ],
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Transform Manager...',
          click: () => mainWindow?.webContents.send('menu:transform-manager'),
        },
        {
          label: 'API Keys...',
          click: () => mainWindow?.webContents.send('menu:api-keys'),
        },
        { type: 'separator' },
        {
          label: 'Nmap Scan...',
          click: () => mainWindow?.webContents.send('menu:nmap-scan'),
        },
        {
          label: 'WHOIS Lookup...',
          click: () => mainWindow?.webContents.send('menu:whois-lookup'),
        },
        { type: 'separator' },
        {
          label: 'Settings...',
          accelerator: 'CmdOrCtrl+,',
          click: () => mainWindow?.webContents.send('menu:settings'),
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates...',
          click: () => checkForUpdates(true),
        },
        { type: 'separator' },
        {
          label: 'Documentation',
          click: () => shell.openExternal('https://github.com/nodeweaver/docs'),
        },
        {
          label: 'Report Issue',
          click: () => shell.openExternal('https://github.com/nodeweaver/issues'),
        },
        { type: 'separator' },
        {
          label: 'About NodeWeaver',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About NodeWeaver',
              message: 'NodeWeaver',
              detail: `Version: ${app.getVersion()}\n\nOSINT Graph Visualization Tool\n\nWeave connections between data nodes to uncover hidden patterns.`,
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App ready
app.whenReady().then(() => {
  // Serve the exported Next.js renderer via app://renderer/* in production
  if (!isDev) {
    const rendererDir = path.normalize(path.join(__dirname, '../renderer'));
    protocol.handle('app', (request) => {
      const url = new URL(request.url);
      // url.host === 'renderer', url.pathname === '/_next/static/...' or '/index.html' etc.
      const pathname = decodeURIComponent(url.pathname);
      const resolved = path.normalize(path.join(rendererDir, pathname));

      // Security: block path traversal
      if (!resolved.startsWith(rendererDir)) {
        return new Response('Forbidden', { status: 403 });
      }

      // If path has no extension, serve directory index.html (for sub-routes)
      const fileUrl = /\.[a-zA-Z0-9]+$/.test(resolved)
        ? pathToFileURL(resolved).toString()
        : pathToFileURL(path.join(resolved, 'index.html')).toString();

      return net.fetch(fileUrl);
    });
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('get-store', (_, key) => store.get(key));
ipcMain.handle('set-store', (_, key, value) => store.set(key, value));

ipcMain.handle('show-save-dialog', async (_, options) => {
  return dialog.showSaveDialog(mainWindow!, options);
});

ipcMain.handle('show-open-dialog', async (_, options) => {
  return dialog.showOpenDialog(mainWindow!, options);
});

ipcMain.handle('get-app-version', () => app.getVersion());

// Handle dark/light mode
nativeTheme.themeSource = store.get('theme') as 'light' | 'dark' | 'system';
