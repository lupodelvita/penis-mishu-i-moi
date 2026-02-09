import { create } from 'zustand';

interface GraphStats {
  totalEntities: number;
  totalLinks: number;
  entityTypes: Record<string, number>;
  avgConnections: number;
  density: number;
  clusters: number;
  centralNodes: Array<{ id: string; value: string; connections: number }>;
}

interface AnalyticsStore {
  stats: GraphStats | null;
  heatmapData: Array<{ id: string; value: number }>;
  timelineData: Array<{ date: Date; event: string; entityId: string }>;
  
  // Actions
  calculateStats: (graph: any) => void;
  generateHeatmap: (graph: any, metric: 'connections' | 'age' | 'activity') => void;
  generateTimeline: (graph: any) => void;
  exportReport: (format: 'pdf' | 'html' | 'csv') => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsStore>((set, get) => ({
  stats: null,
  heatmapData: [],
  timelineData: [],
  
  calculateStats: (graph: any) => {
    const entities = graph.entities || [];
    const links = graph.links || [];
    
    // Entity types count
    const entityTypes: Record<string, number> = {};
    entities.forEach((e: any) => {
      entityTypes[e.type] = (entityTypes[e.type] || 0) + 1;
    });
    
    // Connection counts
    const connections = new Map<string, number>();
    links.forEach((link: any) => {
      connections.set(link.source, (connections.get(link.source) || 0) + 1);
      connections.set(link.target, (connections.get(link.target) || 0) + 1);
    });
    
    // Average connections
    const avgConnections = entities.length > 0
      ? Array.from(connections.values()).reduce((a, b) => a + b, 0) / entities.length
      : 0;
    
    // Density
    const maxLinks = entities.length * (entities.length - 1);
    const density = maxLinks > 0 ? links.length / maxLinks : 0;
    
    // Central nodes (top 5 by connections)
    const centralNodes = Array.from(connections.entries())
      .map(([id, count]) => {
        const entity = entities.find((e: any) => e.id === id);
        return { id, value: entity?.value || 'Unknown', connections: count };
      })
      .sort((a, b) => b.connections - a.connections)
      .slice(0, 5);
    
    // Simple clustering (entities with >3 connections)
    const clusters = Array.from(connections.values()).filter(c => c > 3).length;
    
    const stats: GraphStats = {
      totalEntities: entities.length,
      totalLinks: links.length,
      entityTypes,
      avgConnections,
      density,
      clusters,
      centralNodes,
    };
    
    set({ stats });
  },
  
  generateHeatmap: (graph: any, metric: 'connections' | 'age' | 'activity') => {
    const entities = graph.entities || [];
    const links = graph.links || [];
    
    const heatmapData: Array<{ id: string; value: number }> = [];
    
    if (metric === 'connections') {
      const connections = new Map<string, number>();
      links.forEach((link: any) => {
        connections.set(link.source, (connections.get(link.source) || 0) + 1);
        connections.set(link.target, (connections.get(link.target) || 0) + 1);
      });
      
      entities.forEach((entity: any) => {
        heatmapData.push({
          id: entity.id,
          value: connections.get(entity.id) || 0,
        });
      });
    } else if (metric === 'age') {
      const now = Date.now();
      entities.forEach((entity: any) => {
        const created = new Date(entity.created || now).getTime();
        const ageInDays = (now - created) / (1000 * 60 * 60 * 24);
        heatmapData.push({
          id: entity.id,
          value: ageInDays,
        });
      });
    }
    
    set({ heatmapData });
  },
  
  generateTimeline: (graph: any) => {
    const entities = graph.entities || [];
    const links = graph.links || [];
    
    const timelineData: Array<{ date: Date; event: string; entityId: string }> = [];
    
    // Entity creation events
    entities.forEach((entity: any) => {
      if (entity.created) {
        timelineData.push({
          date: new Date(entity.created),
          event: `Created ${entity.type}: ${entity.value}`,
          entityId: entity.id,
        });
      }
    });
    
    // Link creation events
    links.forEach((link: any) => {
      if (link.created) {
        timelineData.push({
          date: new Date(link.created),
          event: `Linked entities`,
          entityId: link.source,
        });
      }
    });
    
    // Sort by date
    timelineData.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    set({ timelineData });
  },
  
  exportReport: async (format: 'pdf' | 'html' | 'csv') => {
    const { stats } = get();
    
    if (!stats) {
      console.error('No stats available to export');
      return;
    }
    
    // Mock export - в production генерировать реальные отчеты
    const reportData = {
      format,
      stats,
      generatedAt: new Date().toISOString(),
    };
    
    console.log('Exporting report:', reportData);
    
    // Создать blob и скачать
    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nodeweaver-report-${Date.now()}.${format === 'csv' ? 'csv' : 'json'}`;
    a.click();
    URL.revokeObjectURL(url);
  },
}));
