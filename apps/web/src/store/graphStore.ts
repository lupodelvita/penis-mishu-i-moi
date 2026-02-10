import { create } from 'zustand';

interface Entity {
  id: string;
  type: string;
  value: string;
  data?: Record<string, any>; // For Cytoscape syncing
  properties?: Record<string, any>;
  metadata?: {
    created?: string;
    source?: string;
    confidence?: number;
  };
}

interface Link {
  id: string;
  source: string;
  target: string;
  label?: string;
}

interface Graph {
  id: string;
  name: string;
  entities: Entity[];
  links: Link[];
  metadata?: {
    created?: string;
    updated?: string;
  };
}

interface GraphStore {
  currentGraph: Graph | null;
  selectedEntities: Entity[];
  
  // Actions
  setGraph: (graph: Graph) => void;
  addEntity: (entity: Entity) => void;
  updateEntity: (id: string, updates: Partial<Entity>) => void;
  deleteEntity: (id: string) => void;
  addLink: (link: Link) => void;
  deleteLink: (id: string) => void;
  selectEntity: (entity: Entity) => void;
  clearSelection: () => void;
  exportGraph: () => string;
  importGraph: (data: string) => void;
}



export const useGraphStore = create<GraphStore>((set, get) => ({
  currentGraph: {
    id: 'default',
    name: 'New Graph',
    entities: [],
    links: [],
  },
  selectedEntities: [],
  
  setGraph: (graph) => set({ currentGraph: graph }),
  
  addEntity: (entity) => set((state) => {
    if (!state.currentGraph) return {};
    // Deduplicate: Don't add if ID exists
    if (state.currentGraph.entities.some(e => e.id === entity.id)) {
        return {}; 
    }
    return {
      currentGraph: {
        ...state.currentGraph,
        entities: [...state.currentGraph.entities, entity],
      }
    };
  }),
  
  updateEntity: (id, updates) => set((state) => ({
    currentGraph: state.currentGraph ? {
      ...state.currentGraph,
      entities: state.currentGraph.entities.map(e =>
        e.id === id ? { ...e, ...updates } : e
      ),
    } : null,
  })),
  
  deleteEntity: (id) => set((state) => ({
    currentGraph: state.currentGraph ? {
      ...state.currentGraph,
      entities: state.currentGraph.entities.filter(e => e.id !== id),
      links: state.currentGraph.links.filter(l => l.source !== id && l.target !== id),
    } : null,
    selectedEntities: state.selectedEntities.filter(e => e.id !== id),
  })),
  
  addLink: (link) => set((state) => {
    if (!state.currentGraph) return {};
    // Deduplicate: Don't add if ID exists
    if (state.currentGraph.links.some(l => l.id === link.id)) {
        return {};
    }
    return {
      currentGraph: {
        ...state.currentGraph,
        links: [...state.currentGraph.links, link],
      }
    };
  }),
  
  deleteLink: (id) => set((state) => ({
    currentGraph: state.currentGraph ? {
      ...state.currentGraph,
      links: state.currentGraph.links.filter(l => l.id !== id),
    } : null,
  })),
  
  selectEntity: (entity) => set({ selectedEntities: [entity] }),
  
  clearSelection: () => set({ selectedEntities: [] }),
  
  exportGraph: () => {
    const { currentGraph } = get();
    return JSON.stringify(currentGraph, null, 2);
  },
  
  importGraph: (data) => {
    try {
      const graph = JSON.parse(data);
      set({ currentGraph: graph });
    } catch (error) {
      console.error('Failed to import graph:', error);
    }
  },
}));
