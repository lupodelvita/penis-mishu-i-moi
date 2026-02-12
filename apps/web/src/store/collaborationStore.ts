import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

interface Collaborator {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  selectedEntity?: string;
}

interface GraphUpdate {
  type: 'entity_added' | 'entity_updated' | 'entity_deleted' | 'link_added' | 'link_deleted';
  data: any;
  userId: string;
  timestamp: Date;
}

interface CollaborationStore {
  socket: Socket | null;
  isConnected: boolean;
  collaborators: Collaborator[];
  graphUpdates: GraphUpdate[];
  currentUser: Collaborator | null;
  
  // Actions
  connect: (graphId: string, userName: string) => void;
  disconnect: () => void;
  sendUpdate: (update: GraphUpdate) => void;
  updateCursor: (x: number, y: number) => void;
  selectEntity: (entityId: string | null) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export const useCollaborationStore = create<CollaborationStore>((set, get) => ({
  socket: null,
  isConnected: false,
  collaborators: [],
  graphUpdates: [],
  currentUser: null,
  
  connect: (graphId: string, userName: string) => {
    // CRITICAL: Disconnect existing socket if present to prevent duplicates
    const existingSocket = get().socket;
    if (existingSocket && existingSocket.connected) {
      existingSocket.off(); // Remove all listeners
      existingSocket.disconnect();
      set({ socket: null, isConnected: false, collaborators: [], currentUser: null });
    }
    
    const socket = io(API_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'],
    });
    
    let hasJoined = false;
    
    socket.on('connect', () => {
      if (!hasJoined) {
        const user: Collaborator = {
          id: socket.id || Math.random().toString(),
          name: userName,
          color: colors[Math.floor(Math.random() * colors.length)],
        };
        
        socket.emit('join-graph', { graphId, user });
        set({ isConnected: true, currentUser: { ...user, id: socket.id! } });
        hasJoined = true;
      }
    });
    
    socket.on('disconnect', () => {
      set({ isConnected: false, collaborators: [] });
    });
    
    socket.on('collaborators-update', (collaborators: Collaborator[]) => {
      // CRITICAL FIX: Get current user from state, not from outer scope
      const currentUser = get().currentUser;
      
      // Filter out current user from collaborators list
      const filtered = collaborators.filter(c => c.id !== currentUser?.id);
      set({ collaborators: filtered });
    });
    
    socket.on('graph-update', (update: GraphUpdate) => {
      set((state) => ({
        graphUpdates: [...state.graphUpdates, update],
      }));
    });
    
    socket.on('cursor-update', ({ userId, x, y }: any) => {
      set((state) => ({
        collaborators: state.collaborators.map(c =>
          c.id === userId ? { ...c, cursor: { x, y } } : c
        ),
      }));
    });
    
    socket.on('entity-select', ({ userId, entityId }: any) => {
      set((state) => ({
        collaborators: state.collaborators.map(c =>
          c.id === userId ? { ...c, selectedEntity: entityId } : c
        ),
      }));
    });
    
    set({ socket });
  },
  
  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false, collaborators: [], currentUser: null });
    }
  },
  
  sendUpdate: (update: GraphUpdate) => {
    const { socket } = get();
    if (socket && socket.connected) {
      socket.emit('graph-update', update);
    }
  },
  
  updateCursor: (x: number, y: number) => {
    const { socket } = get();
    if (socket && socket.connected) {
      socket.emit('cursor-move', { x, y });
    }
  },
  
  selectEntity: (entityId: string | null) => {
    const { socket } = get();
    if (socket && socket.connected) {
      socket.emit('entity-select', { entityId });
    }
  },
}));
