import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld('electron', {
  // Store
  getStore: (key: string) => ipcRenderer.invoke('get-store', key),
  setStore: (key: string, value: any) => ipcRenderer.invoke('set-store', key, value),
  
  // Dialogs
  showSaveDialog: (options: any) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options: any) => ipcRenderer.invoke('show-open-dialog', options),
  
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Menu events
  onMenuEvent: (channel: string, callback: (data: any) => void) => {
    const validChannels = [
      'menu:new-graph',
      'menu:open-graph',
      'menu:save',
      'menu:save-as',
      'menu:export',
      'menu:select-all',
      'menu:delete-selected',
      'menu:zoom',
      'menu:toggle-panel',
      'menu:theme',
      'menu:run-all-transforms',
      'menu:run-selected-transform',
      'menu:add-entity',
      'menu:create-link',
      'menu:transform-manager',
      'menu:api-keys',
      'menu:nmap-scan',
      'menu:whois-lookup',
      'menu:settings',
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_, data) => callback(data));
    }
  },
  
  removeMenuListener: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
  
  // Platform info
  platform: process.platform,
  isElectron: true,

  // Auto-updater events
  onUpdaterEvent: (channel: string, callback: (data: any) => void) => {
    const validChannels = ['updater:downloading', 'updater:progress', 'updater:downloaded'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_, data) => callback(data));
    }
  },
  removeUpdaterListener: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },

  // Terminal - simplified API (no ID needed)
  terminal: {
    create: () => ipcRenderer.send('terminal:create'),
    write: (data: string) => ipcRenderer.send('terminal:write', data),
    resize: (cols: number, rows: number) => ipcRenderer.send('terminal:resize', cols, rows),
    onData: (callback: (data: string) => void) => {
        const subscription = (_: any, data: string) => callback(data);
        ipcRenderer.on('terminal:data', subscription);
        return () => ipcRenderer.removeListener('terminal:data', subscription);
    }
  }
});

// Types for TypeScript
declare global {
  interface Window {
    electron: {
      getStore: (key: string) => Promise<any>;
      setStore: (key: string, value: any) => Promise<void>;
      showSaveDialog: (options: any) => Promise<any>;
      showOpenDialog: (options: any) => Promise<any>;
      getAppVersion: () => Promise<string>;
      onMenuEvent: (channel: string, callback: (data: any) => void) => void;
      removeMenuListener: (channel: string) => void;
      platform: string;
      isElectron: boolean;
      terminal: {
        create: () => void;
        write: (data: string) => void;
        resize: (cols: number, rows: number) => void;
        onData: (callback: (data: string) => void) => () => void;
      };
    };
  }
}
