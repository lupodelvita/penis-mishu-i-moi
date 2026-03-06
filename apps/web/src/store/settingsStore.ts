import { create } from 'zustand';
import { api } from '@/lib/api';

interface DiscordSettings {
  webhookUrl: string;
  enabled: boolean;
  autoExport: boolean;
}

interface SettingsStore {
  discord: DiscordSettings;
  theme: 'light' | 'dark' | 'auto';
  
  // Actions
  setDiscordWebhook: (url: string) => void;
  setDiscordEnabled: (enabled: boolean) => void;
  setDiscordAutoExport: (autoExport: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  
  // Discord export functions
  exportGraphToDiscord: (graph: any) => Promise<boolean>;
  exportTransformToDiscord: (transformResult: any) => Promise<boolean>;
  testDiscordWebhook: () => Promise<boolean>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  discord: {
    webhookUrl: '',
    enabled: false,
    autoExport: false,
  },
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
  
  setTheme: (theme) => {
    set({ theme });
  },
  
  exportGraphToDiscord: async (graph) => {
    const { discord } = get();
    
    if (!discord.enabled || !discord.webhookUrl) {
      console.error('Discord webhook not configured');
      return false;
    }
    
    try {
      const { data } = await api.post('/discord/export-graph', {
        webhookUrl: discord.webhookUrl,
        graph,
        format: 'embed',
      });
      return data.success;
    } catch (error) {
      console.error('Failed to export to Discord:', error);
      return false;
    }
  },
  
  exportTransformToDiscord: async (transformResult) => {
    const { discord } = get();
    
    if (!discord.enabled || !discord.webhookUrl) {
      return false;
    }
    
    try {
      const { data } = await api.post('/discord/export-transform', {
        webhookUrl: discord.webhookUrl,
        transformResult,
      });
      return data.success;
    } catch (error) {
      console.error('Failed to export transform to Discord:', error);
      return false;
    }
  },
  
  testDiscordWebhook: async () => {
    const { discord } = get();
    
    if (!discord.webhookUrl) {
      return false;
    }
    
    try {
      const { data } = await api.post('/discord/test-webhook', {
        webhookUrl: discord.webhookUrl,
      });
      return data.success;
    } catch (error) {
      console.error('Failed to test webhook:', error);
      return false;
    }
  },
}));
