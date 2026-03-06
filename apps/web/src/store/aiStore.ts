import { create } from 'zustand';
import { api } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIAssistantStore {
  messages: Message[];
  isProcessing: boolean;
  isEnabled: boolean;
  
  // Actions
  sendMessage: (content: string) => Promise<void>;
  clearHistory: () => void;
  toggleEnabled: (enabled: boolean) => void;
  
  // AI Analysis Functions
  analyzeGraph: (graph: any) => Promise<string>;
  suggestNextSteps: (selectedEntity: any) => Promise<string[]>;
  findPatterns: (graph: any) => Promise<any[]>;
  explainEntity: (entity: any) => Promise<string>;
  sendFeedback: (requestType: string, content: any, response: string, rating: number) => Promise<void>;
}

export const useAIAssistantStore = create<AIAssistantStore>((set, _get) => ({
  messages: [],
  isProcessing: false,
  isEnabled: false,
  
  sendMessage: async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    
    set((state) => ({
      messages: [...state.messages, userMessage],
      isProcessing: true,
    }));
    
    try {
      const { data } = await api.post('/ai/chat', { message: content });
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'Извините, но я столкнулся с ошибкой при обработке вашего запроса.',
        timestamp: new Date(),
      };
      
      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isProcessing: false,
      }));
    } catch (error: any) {
      console.error('AI Assistant error:', error);
      
      let errorText = 'Извините, я сейчас недоступен. Пожалуйста, попробуйте позже.';
      
      if (error.code === 'ERR_NETWORK') {
          errorText = 'Ошибка подключения к серверу API. Пожалуйста, убедитесь, что backend запущен (npm run dev:all).';
      } else if (error.response?.data?.error) {
          errorText = `Ошибка: ${error.response.data.error}`;
      } else if (error.message) {
          errorText = `Ошибка: ${error.message}`;
      }
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorText,
        timestamp: new Date(),
      };
      
      set((state) => ({
        messages: [...state.messages, errorMessage],
        isProcessing: false,
      }));
    }
  },
  
  clearHistory: () => {
    set({ messages: [] });
  },
  
  toggleEnabled: (enabled: boolean) => {
    set({ isEnabled: enabled });
  },
  
  analyzeGraph: async (graph: any) => {
    set({ isProcessing: true });
    
    try {
      const { data } = await api.post('/ai/analyze-graph', { graph });
      set({ isProcessing: false });
      return data.analysis || 'Анализ недоступен';
    } catch (error) {
      set({ isProcessing: false });
      return 'Ошибка анализа графа';
    }
  },
  
  suggestNextSteps: async (selectedEntity: any) => {
    set({ isProcessing: true });
    
    try {
      const { data } = await api.post('/ai/suggest-transforms', { entity: selectedEntity });
      set({ isProcessing: false });
      return data.suggestions || [];
    } catch (error) {
      set({ isProcessing: false });
      return [];
    }
  },
  
  findPatterns: async (graph: any) => {
    set({ isProcessing: true });
    
    try {
      const { data } = await api.post('/ai/find-patterns', { graph });
      set({ isProcessing: false });
      return data.patterns || [];
    } catch (error) {
      set({ isProcessing: false });
      return [];
    }
  },
  
  explainEntity: async (entity: any) => {
    set({ isProcessing: true });
    
    try {
      const { data } = await api.post('/ai/explain-entity', { entity });
      set({ isProcessing: false });
      return data.explanation || 'Объяснение недоступно';
    } catch (error) {
      set({ isProcessing: false });
      return 'Ошибка объяснения сущности';
    }
  },

  sendFeedback: async (requestType, content, response, rating) => {
    try {
      await api.post('/ai/feedback', { requestType, content, response, rating });
    } catch (error) {
      console.error('Error sending feedback:', error);
    }
  },
}));
