import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { prisma } from '../lib/prisma';

interface Collaborator {
  id: string;       // socket.id
  dbUserId: string; // database user ID for membership operations
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
  private graphLeaders: Map<string, string> = new Map(); // graphId -> first userId (leader)
  private userSockets: Map<string, string> = new Map(); // userId -> socketId (for direct messaging)
  private pendingInvitations: Map<string, any> = new Map(); // invitationId -> invitation data

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
      socket.on('join-graph', async ({ graphId, user }: { graphId: string; user: Omit<Collaborator, 'graphId'> }) => {
        try {
          // Validate graph exists and user is a member
          const graph = await prisma.graph.findUnique({
            where: { id: graphId },
            include: {
              members: {
                where: { userId: user.id },
              },
              leader: { select: { id: true, username: true } },
            },
          });

          if (!graph) {
            socket.emit('join-failed', { message: 'Graph not found' });
            console.log(`[Collab] Join-graph failed: Graph ${graphId} not found`);
            return;
          }

          if (graph.members.length === 0) {
            socket.emit('join-failed', { message: 'You are not a member of this graph' });
            console.log(`[Collab] Join-graph failed: User ${user.id} not a member of ${graphId}`);
            return;
          }

          const collaborator: Collaborator = { ...user, graphId, id: socket.id, dbUserId: user.id };
          
          socket.join(graphId);
          this.collaborators.set(socket.id, collaborator);

          if (!this.graphRooms.has(graphId)) {
            this.graphRooms.set(graphId, new Set());
          }
          this.graphRooms.get(graphId)!.add(socket.id);

          // Get collaborators for the room
          const roomCollaborators = this.getGraphCollaborators(graphId);
          
          // Confirm join to the client
          socket.emit('join-confirmed', { graphId });
          
          // Send to everyone in the room (each client filters out themselves)
          this.io!.to(graphId).emit('collaborators-update', roomCollaborators);
          
          // Send leader info from database
          if (graph.leader) {
            this.io!.to(graphId).emit('collaborator-promoted', {
              userId: graph.leader.id,
              isLeader: true,
            });
          }

          console.log(`[Collab] ${user.name} joined graph ${graphId}. Total: ${roomCollaborators.length}`);
        } catch (error) {
          console.error('[Collab] Error in join-graph:', error);
          socket.emit('join-failed', { message: 'Failed to join graph' });
        }
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

      // Send invitation
      socket.on('send-invitation', ({ graphId, targetUserId, fromUser, graphName }: any) => {
        const collaborator = this.collaborators.get(socket.id);
        if (collaborator) {
          const invitationId = `inv-${Date.now()}-${Math.random()}`;
          const invitation = {
            id: invitationId,
            graphId,
            graphName,
            fromUser,
            createdAt: new Date(),
            targetUserId,
          };

          this.pendingInvitations.set(invitationId, invitation);

          // Get first user in room (leader)
          const leader = this.getGraphLeader(graphId);
          if (!this.graphLeaders.has(graphId) && collaborator) {
            this.graphLeaders.set(graphId, collaborator.id);
          }

          // Broadcast to all in graph to update their UI
          this.io!.to(graphId).emit('invitation-sent', { invitationId, targetUserId });

          // TODO: Send to specific user when user service is available
          // For now, just broadcast to room
          console.log(`[Collab] Invitation sent from ${fromUser.name} to ${targetUserId} for graph ${graphId}`);
        }
      });

      // Accept invitation
      socket.on('accept-invitation', ({ invitationId, graphId }: any) => {
        const invitation = this.pendingInvitations.get(invitationId);
        if (invitation) {
          // Add user to graph room
          socket.join(graphId);

          const collaborator = this.collaborators.get(socket.id);
          if (collaborator) {
            collaborator.graphId = graphId;
            if (!this.graphRooms.has(graphId)) {
              this.graphRooms.set(graphId, new Set());
            }
            this.graphRooms.get(graphId)!.add(socket.id);

            // Mark current user as not leader (unless they're the first)
            const isLeader = this.graphRooms.get(graphId)!.size === 1;
            if (isLeader && !this.graphLeaders.has(graphId)) {
              this.graphLeaders.set(graphId, socket.id);
            }

            // Notify all in room
            const roomCollaborators = this.getGraphCollaborators(graphId);
            this.io!.to(graphId).emit('collaborators-update', roomCollaborators);
            this.io!.to(graphId).emit('collaborator-promoted', {
              userId: this.graphLeaders.get(graphId),
              isLeader: true,
            });

            this.pendingInvitations.delete(invitationId);
            console.log(`[Collab] ${collaborator.name} accepted invitation to ${graphId}`);
          }
        }
      });

      // Reject invitation
      socket.on('reject-invitation', ({ invitationId }: any) => {
        this.pendingInvitations.delete(invitationId);
        console.log(`[Collab] Invitation ${invitationId} rejected`);
      });

      // Leave graph
      socket.on('leave-graph', async ({ graphId }: any) => {
        const collaborator = this.collaborators.get(socket.id);
        if (collaborator && collaborator.graphId === graphId) {
          socket.leave(graphId);

          const room = this.graphRooms.get(graphId);
          if (room) {
            room.delete(socket.id);
            if (room.size === 0) {
              this.graphRooms.delete(graphId);
              this.graphLeaders.delete(graphId);
              this.commandHistory.delete(graphId);
            } else {
              // Notify remaining users
              const remainingCollaborators = this.getGraphCollaborators(graphId);
              this.io!.to(graphId).emit('collaborators-update', remainingCollaborators);
              this.io!.to(graphId).emit('user-left', { userId: socket.id });
            }
          }

          // DB cleanup: remove membership and delete graph if last member
          await this.cleanupMembership(collaborator.dbUserId, graphId);

          collaborator.graphId = ''; // Clear graph association
          console.log(`[Collab] ${collaborator.name} left graph ${graphId}`);
        }
      });

      // Kick user from graph (leader only)
      socket.on('kick-user', async ({ graphId, targetUserId }: { graphId: string; targetUserId: string }) => {
        try {
          const requester = this.collaborators.get(socket.id);
          if (!requester) return;

          // Verify requester is leader
          const graph = await prisma.graph.findUnique({
            where: { id: graphId },
            select: { leaderId: true },
          });

          if (graph?.leaderId !== requester.dbUserId) {
            socket.emit('error', { message: 'Only leaders can kick members' });
            console.log(`[Collab] Kick-user failed: ${requester.dbUserId} is not leader of ${graphId}`);
            return;
          }

          // Find target socket and remove from room
          const targetSocket = Array.from(this.collaborators.entries()).find(
            ([_, collab]) => collab.id === targetUserId && collab.graphId === graphId
          );

          if (targetSocket) {
            const [targetSocketId, targetCollab] = targetSocket;
            // Get the actual socket object
            const socketToKick = this.io?.sockets.sockets.get(targetSocketId);
            if (socketToKick) {
              socketToKick.leave(graphId);
              socketToKick.emit('kick-notification', { graphId, reason: 'You were removed from the graph by the leader' });
              
              this.collaborators.delete(targetSocketId);
              const room = this.graphRooms.get(graphId);
              if (room) {
                room.delete(targetSocketId);
              }

              // Notify remaining users
              const remainingCollaborators = this.getGraphCollaborators(graphId);
              this.io!.to(graphId).emit('collaborators-update', remainingCollaborators);
              this.io!.to(graphId).emit('user-left', { userId: targetUserId });
              
              console.log(`[Collab] ${targetCollab.name} was kicked from ${graphId} by ${requester.name}`);
            }
          }
        } catch (error) {
          console.error('[Collab] Error in kick-user:', error);
          socket.emit('error', { message: 'Failed to kick user' });
        }
      });

      // Disconnect
      socket.on('disconnect', async () => {
        const collaborator = this.collaborators.get(socket.id);
        
        if (collaborator) {
          const { graphId, name, dbUserId } = collaborator;
          
          // Remove from data structures
          this.collaborators.delete(socket.id);
          const room = this.graphRooms.get(graphId);
          if (room) {
            room.delete(socket.id);
            if (room.size === 0) {
              this.graphRooms.delete(graphId);
              this.graphLeaders.delete(graphId);
              this.commandHistory.delete(graphId);
            } else {
              // Notify remaining users
              const remainingCollaborators = this.getGraphCollaborators(graphId);
              this.io!.to(graphId).emit('collaborators-update', remainingCollaborators);
              this.io!.to(graphId).emit('user-left', { userId: socket.id });

              // If disconnected user was leader, promote first remaining user
              if (this.graphLeaders.get(graphId) === socket.id && room.size > 0) {
                const firstSocketId = Array.from(room)[0];
                this.graphLeaders.set(graphId, firstSocketId);
                this.io!.to(graphId).emit('collaborator-promoted', {
                  userId: firstSocketId,
                  isLeader: true,
                });
              }
            }
          }

          // DB cleanup: remove membership and delete graph if last member
          if (dbUserId && graphId) {
            await this.cleanupMembership(dbUserId, graphId);
          }
          
          console.log(`[Collab] ${name} disconnected from graph ${graphId}. Remaining: ${this.getGraphCollaborators(graphId).length}`);
        }
      });
    });
  }

  /**
   * Remove user from graph membership and delete graph if no members left
   */
  private async cleanupMembership(userId: string, graphId: string): Promise<void> {
    try {
      // Check membership exists
      const member = await prisma.graphMember.findUnique({
        where: { graphId_userId: { graphId, userId } },
      });

      if (!member) return;

      // Remove membership
      await prisma.graphMember.delete({
        where: { graphId_userId: { graphId, userId } },
      });

      // Check remaining members
      const remaining = await prisma.graphMember.count({
        where: { graphId },
      });

      if (remaining === 0) {
        // No members left — notify any remaining sockets and delete the graph
        if (this.io) {
          this.io.to(graphId).emit('graph-deleted', { graphId });
        }
        await prisma.graph.delete({ where: { id: graphId } });
        console.log(`[Collab] Graph ${graphId} deleted (no members remaining)`);
      } else {
        // If leaving user was leader, promote next member
        const graph = await prisma.graph.findUnique({
          where: { id: graphId },
          select: { leaderId: true },
        });

        if (graph?.leaderId === userId) {
          const nextMember = await prisma.graphMember.findFirst({
            where: { graphId },
            select: { userId: true },
          });

          if (nextMember) {
            await prisma.graph.update({
              where: { id: graphId },
              data: { leaderId: nextMember.userId },
            });
            console.log(`[Collab] Leadership transferred to ${nextMember.userId} in graph ${graphId}`);
          }
        }
      }
    } catch (error) {
      console.error('[Collab] Membership cleanup error:', error);
    }
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

  /**
   * Get graph leader (first user)
   */
  getGraphLeader(graphId: string): string | undefined {
    return this.graphLeaders.get(graphId);
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
