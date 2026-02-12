import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { prisma } from '../lib/prisma';

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

interface CollaborativeCommand {
  id: string;
  type: 'add_entity' | 'delete_entity' | 'update_entity' | 'add_link' | 'delete_link' | 'transform' | 'chat';
  payload: any;
  userId: string;
  timestamp: Date;
  graphId: string;
}

class CollaborationService {
  private io: SocketIOServer | null = null;
  private collaborators: Map<string, Collaborator> = new Map();
  private graphRooms: Map<string, Set<string>> = new Map(); // graphId -> Set<socketId>
  private commandHistory: Map<string, CollaborativeCommand[]> = new Map(); // graphId -> commands

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

        // Get collaborators for the room
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

      // Handle collaborative commands
      socket.on('command', async (command: Omit<CollaborativeCommand, 'id' | 'timestamp' | 'graphId'>) => {
        const collaborator = this.collaborators.get(socket.id);
        if (collaborator) {
          const fullCommand: CollaborativeCommand = {
            ...command,
            id: `cmd-${Date.now()}-${Math.random()}`,
            timestamp: new Date(),
            graphId: collaborator.graphId,
          };

          // Store in memory history
          if (!this.commandHistory.has(collaborator.graphId)) {
            this.commandHistory.set(collaborator.graphId, []);
          }
          this.commandHistory.get(collaborator.graphId)!.push(fullCommand);

          // Persist to database
          await this.persistCommand(fullCommand);

          // Broadcast to all in graph
          this.io!.to(collaborator.graphId).emit('command-received', fullCommand);
          console.log(`[Collab] Command ${command.type} in graph ${collaborator.graphId}`);
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
          
          console.log(`[Collab] ${name} disconnected from graph ${graphId}. Remaining: ${remainingCollaborators.length}`);
        }
      });
    });
  }

  /**
   * Persist command to database
   */
  private async persistCommand(command: CollaborativeCommand): Promise<void> {
    try {
      await prisma.graphCommand.create({
        data: {
          graphId: command.graphId,
          type: command.type,
          payload: command.payload,
          userId: command.userId,
          userName: command.payload?.sender || 'Unknown',
          timestamp: command.timestamp,
        },
      });
    } catch (error) {
      console.error('[Collab] Failed to persist command:', error);
    }
  }

  /**
   * Get collaborators in a graph room
   */
  getGraphCollaborators(graphId: string): Collaborator[] {
    if (!this.io) return [];

    const room = this.io.sockets.adapter.rooms.get(graphId);
    if (!room) return [];

    return Array.from(room)
      .map(socketId => this.collaborators.get(socketId))
      .filter((c): c is Collaborator => c !== undefined);
  }

  /**
   * Get command history for a graph
   */
  getCommandHistory(graphId: string, limit?: number): CollaborativeCommand[] {
    const history = this.commandHistory.get(graphId) || [];
    return limit ? history.slice(-limit) : history;
  }

  getIO() {
    return this.io;
  }

  private static instance: CollaborationService;

  static getInstance(): CollaborationService {
    if (!this.instance) {
      this.instance = new CollaborationService();
    }
    return this.instance;
  }
}

export const collaborationService = CollaborationService.getInstance();
