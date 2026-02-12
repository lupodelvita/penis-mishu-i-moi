import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

interface Collaborator {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  selectedEntity?: string;
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
          lastActivity: Date.now(),
        };
        
        socket.emit('join-graph', { graphId, user });
        set({ isConnected: true, currentUser: { ...user, id: socket.id! }, graphId });
        hasJoined = true;

        // Fetch command history from server
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
              // Endpoint not yet available or migration not deployed
              console.debug('[Collab] Command history endpoint not available (migration may not be deployed)');
            } else {
              console.warn('[Collab] Failed to fetch command history:', response.status);
            }
          } catch (error) {
            // Network error - don't log as it's expected in development
          }
        };
        fetchHistory();
      }
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
      set((state) => ({
        commandHistory: [...state.commandHistory, command],
      }));
    });
    
    socket.on('cursor-update', ({ userId, x, y }: any) => {
      set((state) => ({
        collaborators: state.collaborators.map(c =>
          c.id === userId ? { ...c, cursor: { x, y }, lastActivity: Date.now() } : c
        ),
      }));
    });
    
    socket.on('entity-select', ({ userId, entityId }: any) => {
      set((state) => ({
        collaborators: state.collaborators.map(c =>
          c.id === userId ? { ...c, selectedEntity: entityId, lastActivity: Date.now() } : c
        ),
      }));
    });

    socket.on('invitation-received', (invitation: GraphInvitation) => {
      set((state) => ({
        invitations: [...state.invitations, invitation],
      }));
    });

    socket.on('collaborator-promoted', ({ userId, isLeader }: any) => {
      if (socket.id === userId) {
        set({ isLeader });
      }
      set((state) => ({
        collaborators: state.collaborators.map(c =>
          c.id === userId ? { ...c, isLeader } : c
        ),
      }));
    });

    socket.on('user-left', ({ userId }: any) => {
      set((state) => ({
        collaborators: state.collaborators.filter(c => c.id !== userId),
      }));
    });
    
    set({ socket });
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
      // Note: Don't add to state here - 'command-received' event will handle it
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
      // Note: Don't add to state here - 'command-received' event will handle it
    }
  },

  loadHistoricalCommands: async (graphId: string) => {
    try {
      const response = await fetch(`${API_URL}/graphs/${graphId}/commands?limit=100`, {
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
        graphName: graphId, // We can enhance this when graph names are available
      });
    }
  },

  acceptInvitation: (invitationId: string, graphId: string) => {
    const { socket, currentUser } = get();
    if (socket && socket.connected) {
      socket.emit('accept-invitation', { invitationId, graphId });
      // Join the graph
      set((state) => ({
        invitations: state.invitations.filter(inv => inv.id !== invitationId),
        graphId,
        isLeader: false, // Accepting invitation means you're not the leader
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
}));

