import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

interface Collaborator {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  selectedEntity?: string;
  graphId: string;
}

interface GraphUpdate {
  type: 'entity_added' | 'entity_updated' | 'entity_deleted' | 'link_added' | 'link_deleted';
  data: any;
  userId: string;
  timestamp: Date;
}

class CollaborationService {
  private io: SocketIOServer | null = null;
  private collaborators: Map<string, Collaborator> = new Map();
  private graphRooms: Map<string, Set<string>> = new Map(); // graphId -> Set<socketId>

  initialize(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
      },
    });

    this.io.on('connection', (socket: Socket) => {
      console.log(`[Collab] Client connected: ${socket.id}`);

      // Join graph room
      socket.on('join-graph', ({ graphId, user }: { graphId: string; user: Omit<Collaborator, 'graphId'> }) => {
        const collaborator: Collaborator = { ...user, graphId, id: socket.id };
        
        socket.join(graphId);
        this.collaborators.set(socket.id, collaborator);

        if (!this.graphRooms.has(graphId)) {
          this.graphRooms.set(graphId, new Set());
        }
        this.graphRooms.get(graphId)!.add(socket.id);

        // CRITICAL FIX: Get collaborators for the room
        const roomCollaborators = this.getGraphCollaborators(graphId);
        
        // Send to everyone in the room (each client filters out themselves)
        this.io!.to(graphId).emit('collaborators-update', roomCollaborators);

        console.log(`[Collab] ${user.name} joined graph ${graphId}. Total: ${roomCollaborators.length}`);
      });

      // Graph updates
      socket.on('graph-update', (update: GraphUpdate) => {
        const collaborator = this.collaborators.get(socket.id);
        if (collaborator) {
          // Broadcast to others in the same graph
          socket.to(collaborator.graphId).emit('graph-update', {
            ...update,
            userId: socket.id,
            timestamp: new Date(),
          });
        }
      });

      // Cursor movements
      socket.on('cursor-move', ({ x, y }: { x: number; y: number }) => {
        const collaborator = this.collaborators.get(socket.id);
        if (collaborator) {
          collaborator.cursor = { x, y };
          socket.to(collaborator.graphId).emit('cursor-update', {
            userId: socket.id,
            x,
            y,
          });
        }
      });

      // Entity selection
      socket.on('entity-select', ({ entityId }: { entityId: string | null }) => {
        const collaborator = this.collaborators.get(socket.id);
        if (collaborator) {
          collaborator.selectedEntity = entityId || undefined;
          socket.to(collaborator.graphId).emit('entity-select', {
            userId: socket.id,
            entityId,
          });
        }
      });

      // Disconnect
      socket.on('disconnect', () => {
        const collaborator = this.collaborators.get(socket.id);
        
        if (collaborator) {
          const { graphId, name } = collaborator;
          
          // Remove from data structures
          this.collaborators.delete(socket.id);
          const room = this.graphRooms.get(graphId);
          if (room) {
            room.delete(socket.id);
            if (room.size === 0) {
              this.graphRooms.delete(graphId);
            }
          }
          
          // Notify remaining users
          const remainingCollaborators = this.getGraphCollaborators(graphId);
          this.io!.to(graphId).emit('collaborators-update', remainingCollaborators);
          
          console.log(`[Collab] ${name} left graph ${graphId}. Remaining: ${remainingCollaborators.length}`);
        }
        
        console.log(`[Collab] Client disconnected: ${socket.id}`);
      });
    });

    console.log('[Collab] WebSocket server initialized');
  }

  private getGraphCollaborators(graphId: string): Collaborator[] {
    const room = this.graphRooms.get(graphId);
    if (!room) return [];

    return Array.from(room)
      .map(socketId => this.collaborators.get(socketId))
      .filter((c): c is Collaborator => c !== undefined);
  }

  getIO() {
    return this.io;
  }
}

export const collaborationService = new CollaborationService();
