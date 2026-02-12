import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

interface Collaborator {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  selectedEntity?: string | null;
  lastActivity?: number;
  isLeader?: boolean;
}

interface GraphInvitation {
  id: string;
  fromUser: { id: string; name: string };
  graphId: string;
  graphName: string;
  createdAt: Date;
}

interface GraphUpdate {
  type: 'entity_added' | 'entity_updated' | 'entity_deleted' | 'link_added' | 'link_deleted';
  data: any;
  userId: string;
  timestamp: Date;
}

interface CollaborativeCommand {
  id: string;
  type: 'add_entity' | 'delete_entity' | 'update_entity' | 'add_link' | 'delete_link' | 'transform' | 'chat';
  payload: any;
  userId: string;
  timestamp: Date;
  graphId: string;
}

export type { Collaborator, GraphInvitation, GraphUpdate, CollaborativeCommand };
export type { CollaborationStore };

interface CollaborationStore {
  socket: Socket | null;
  isConnected: boolean;
  collaborators: Collaborator[];
  graphUpdates: GraphUpdate[];
  commandHistory: CollaborativeCommand[];
  currentUser: Collaborator | null;
  graphId: string | null;
  invitations: GraphInvitation[];
  isLeader: boolean;
  
  // Actions
  initializeSocket: (userName: string) => void;
  joinGraph: (graphId: string) => void;
  connect: (graphId: string, userName: string) => void;
  disconnect: () => void;
  sendUpdate: (update: GraphUpdate) => void;
  sendCommand: (command: Omit<CollaborativeCommand, 'id' | 'timestamp' | 'graphId'>) => void;
  updateCursor: (x: number, y: number) => void;
  selectEntity: (entityId: string | null) => void;
  broadcastChatMessage: (message: string) => void;
  loadHistoricalCommands: (graphId: string) => Promise<void>;
  inviteUser: (userId: string, userName: string) => void;
  acceptInvitation: (invitationId: string, graphId: string) => void;
  rejectInvitation: (invitationId: string) => void;
  leaveGraph: () => void;
  kickUser: (userId: string) => void;
  promoteToLeader: (userId: string) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export const useCollaborationStore = create<CollaborationStore>((set, get) => ({
  socket: null,
  isConnected: false,
  collaborators: [],
  graphUpdates: [],
  commandHistory: [],
  currentUser: null,
  graphId: null,
  invitations: [],
  isLeader: false,
  
  initializeSocket: (userName: string) => {
    const existingSocket = get().socket;
    if (existingSocket && existingSocket.connected) {
      existingSocket.off();
      existingSocket.disconnect();
      set({ socket: null, isConnected: false, collaborators: [], currentUser: null });
    }
    
    const socket = io(API_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'],
    });
    
    socket.on('connect', () => {
      const user: Collaborator = {
        id: socket.id || Math.random().toString(),
        name: userName,
        color: colors[Math.floor(Math.random() * colors.length)],
        lastActivity: Date.now(),
      };
      set({ isConnected: true, currentUser: { ...user, id: socket.id! } });
    });
    
    socket.on('disconnect', () => {
      set({ isConnected: false, collaborators: [] });
    });
    
    socket.on('collaborators-update', (collaborators: Collaborator[]) => {
      const currentUser = get().currentUser;
      const filtered = collaborators.filter(c => c.id !== currentUser?.id);
      set({ collaborators: filtered });
    });
    
    socket.on('graph-update', (update: GraphUpdate) => {
      set((state) => ({
        graphUpdates: [...state.graphUpdates, update],
      }));
    });
    
    socket.on('command-received', (command: CollaborativeCommand) => {
      set((state) => {
        const exists = state.commandHistory.some(c => c.id === command.id);
        if (exists) return state;
        return { commandHistory: [...state.commandHistory, command] };
      });
    });
    
    socket.on('cursor-update', (data: { collaboratorId: string; x: number; y: number }) => {
      set((state) => ({
        collaborators: state.collaborators.map(c =>
          c.id === data.collaboratorId
            ? { ...c, cursor: { x: data.x, y: data.y }, lastActivity: Date.now() }
            : c
        ),
      }));
    });
    
    socket.on('entity-selected', (data: { collaboratorId: string; entityId: string | null }) => {
      set((state) => ({
        collaborators: state.collaborators.map(c =>
          c.id === data.collaboratorId
            ? { ...c, selectedEntity: data.entityId }
            : c
        ),
      }));
    });
    
    socket.on('invitation-received', (invitation: GraphInvitation) => {
      set((state) => ({
        invitations: [...state.invitations, { ...invitation, createdAt: new Date(invitation.createdAt) }],
      }));
    });
    
    socket.on('collaborator-promoted', (data: { newLeader: string }) => {
      set((state) => ({
        isLeader: state.currentUser?.id === data.newLeader,
        collaborators: state.collaborators.map(c =>
          c.id === data.newLeader ? { ...c, isLeader: true } : { ...c, isLeader: false }
        ),
      }));
    });
    
    socket.on('user-left', (data: { userId: string }) => {
      set((state) => ({
        collaborators: state.collaborators.filter(c => c.id !== data.userId),
      }));
    });
    
    socket.on('error', (errorData: { message: string }) => {
      console.error('[Collab] Socket error:', errorData.message);
      // Optionally set error state to show in UI
    });
    
    socket.on('kick-notification', (data: { graphId: string; reason: string }) => {
      console.warn('[Collab] Kicked from graph:', data.reason);
      set({
        graphId: null,
        collaborators: [],
        commandHistory: [],
        isLeader: false,
      });
      // Optionally show toast notification
    });
    
    set({ socket });
  },
  
  joinGraph: (graphId: string) => {
    const state = get();
    const socket = state.socket;
    const currentUser = state.currentUser;
    
    if (!socket || !currentUser || !socket.connected) {
      console.error('[Collab] Socket not connected or user not initialized');
      return;
    }
    
    socket.emit('join-graph', { graphId, user: currentUser });
    set({ graphId });
    
    const fetchHistory = async () => {
      try {
        const response = await fetch(`${API_URL}/api/graphs/${graphId}/commands?limit=100`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          set({ commandHistory: data.data || [] });
        } else if (response.status === 404) {
          console.debug('[Collab] Command history endpoint not available');
        } else {
          console.warn('[Collab] Failed to fetch command history:', response.status);
        }
      } catch (error) {
        // ignore
      }
    };
    fetchHistory();
  },
  
  connect: (graphId: string, userName: string) => {
    get().initializeSocket(userName);
    const checkAndJoin = () => {
      const state = get();
      if (state.socket && state.socket.connected) {
        get().joinGraph(graphId);
      } else {
        setTimeout(checkAndJoin, 100);
      }
    };
    checkAndJoin();
  },
  
  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false, collaborators: [], currentUser: null, graphId: null });
    }
  },
  
  sendUpdate: (update: GraphUpdate) => {
    const { socket } = get();
    if (socket && socket.connected) {
      socket.emit('graph-update', update);
    }
  },
  
  sendCommand: (command: Omit<CollaborativeCommand, 'id' | 'timestamp' | 'graphId'>) => {
    const { socket, graphId, currentUser } = get();
    if (socket && socket.connected && graphId && currentUser) {
      const fullCommand: CollaborativeCommand = {
        ...command,
        id: `cmd-${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        graphId,
      };
      socket.emit('command', fullCommand);
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
  
  broadcastChatMessage: (message: string) => {
    const { socket, graphId, currentUser } = get();
    if (socket && socket.connected && graphId && currentUser) {
      const command: CollaborativeCommand = {
        id: `chat-${Date.now()}-${Math.random()}`,
        type: 'chat',
        payload: { message, sender: currentUser.name },
        userId: currentUser.id,
        timestamp: new Date(),
        graphId,
      };
      socket.emit('command', command);
    }
  },

  loadHistoricalCommands: async (graphId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/graphs/${graphId}/commands?limit=100`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        set({ commandHistory: data.data || [] });
      }
    } catch (error) {
      console.error('[Collab] Failed to load historical commands:', error);
    }
  },

  inviteUser: (targetUserId: string, targetUserName: string) => {
    const { socket, graphId, currentUser } = get();
    if (socket && socket.connected && graphId && currentUser) {
      socket.emit('send-invitation', {
        graphId,
        targetUserId,
        fromUser: {
          id: currentUser.id,
          name: currentUser.name,
        },
        graphName: graphId,
      });
    }
  },

  acceptInvitation: (invitationId: string, graphId: string) => {
    const { socket } = get();
    if (socket && socket.connected) {
      socket.emit('accept-invitation', { invitationId, graphId });
      set((state) => ({
        invitations: state.invitations.filter(inv => inv.id !== invitationId),
        graphId,
        isLeader: false,
      }));
    }
  },

  rejectInvitation: (invitationId: string) => {
    const { socket } = get();
    if (socket && socket.connected) {
      socket.emit('reject-invitation', { invitationId });
    }
    set((state) => ({
      invitations: state.invitations.filter(inv => inv.id !== invitationId),
    }));
  },

  leaveGraph: () => {
    const { socket, graphId } = get();
    if (socket && socket.connected && graphId) {
      socket.emit('leave-graph', { graphId });
      set({
        graphId: null,
        collaborators: [],
        commandHistory: [],
        isLeader: false,
      });
    }
  },
  
  kickUser: (targetUserId: string) => {
    const { socket, graphId } = get();
    if (socket && socket.connected && graphId) {
      socket.emit('kick-user', { graphId, targetUserId });
      // User will be removed from collaborators list via 'user-left' event
    }
  },
  
  promoteToLeader: (targetUserId: string) => {
    const { graphId } = get();
    if (!graphId) return;
    
    // Call API to promote user
    const token = localStorage.getItem('token');
    if (!token) return;
    
    fetch(`${API_URL}/api/graphs/${graphId}/promote/${targetUserId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }).then(response => {
      if (response.ok) {
        set({ isLeader: false });
      }
    }).catch(error => {
      console.error('[Collab] Failed to promote to leader:', error);
    });
  },
}));

