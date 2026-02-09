import { create } from 'zustand';

interface DiscordSettings {
  webhookUrl: string;
  enabled: boolean;
  autoExport: boolean;
}

interface SettingsStore {
  discord: DiscordSettings;
  apiUrl: string;
  theme: 'light' | 'dark' | 'auto';
  
  // Actions
  setDiscordWebhook: (url: string) => void;
  setDiscordEnabled: (enabled: boolean) => void;
  setDiscordAutoExport: (autoExport: boolean) => void;
  setApiUrl: (url: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  
  // Discord export functions
  exportGraphToDiscord: (graph: any) => Promise<boolean>;
  exportTransformToDiscord: (transformResult: any) => Promise<boolean>;
  testDiscordWebhook: () => Promise<boolean>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  discord: {
    webhookUrl: '',
    enabled: false,
    autoExport: false,
  },
  apiUrl: API_URL,
  theme: 'dark',
  
  setDiscordWebhook: (url) => {
    set((state) => ({
      discord: { ...state.discord, webhookUrl: url },
    }));
  },
  
  setDiscordEnabled: (enabled) => {
    set((state) => ({
      discord: { ...state.discord, enabled },
    }));
  },
  
  setDiscordAutoExport: (autoExport) => {
    set((state) => ({
      discord: { ...state.discord, autoExport },
    }));
  },
  
  setApiUrl: (url) => {
    set({ apiUrl: url });
  },
  
  setTheme: (theme) => {
    set({ theme });
  },
  
  exportGraphToDiscord: async (graph) => {
    const { discord, apiUrl } = get();
    
    if (!discord.enabled || !discord.webhookUrl) {
      console.error('Discord webhook not configured');
      return false;
    }
    
    try {
      const response = await fetch(`${apiUrl}/api/discord/export-graph`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: discord.webhookUrl,
          graph,
          format: 'embed',
        }),
      });
      
      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Failed to export to Discord:', error);
      return false;
    }
  },
  
  exportTransformToDiscord: async (transformResult) => {
    const { discord, apiUrl } = get();
    
    if (!discord.enabled || !discord.webhookUrl) {
      return false;
    }
    
    try {
      const response = await fetch(`${apiUrl}/api/discord/export-transform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: discord.webhookUrl,
          transformResult,
        }),
      });
      
      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Failed to export transform to Discord:', error);
      return false;
    }
  },
  
  testDiscordWebhook: async () => {
    const { discord, apiUrl } = get();
    
    if (!discord.webhookUrl) {
      return false;
    }
    
    try {
      const response = await fetch(`${apiUrl}/api/discord/test-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: discord.webhookUrl,
        }),
      });
      
      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Failed to test webhook:', error);
      return false;
    }
  },
}));
