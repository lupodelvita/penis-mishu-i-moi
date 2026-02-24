import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireGraphLimit, requireEntityLimit } from '../middleware/license';

const router = Router();

// Get all graphs
router.get('/', async (_req, res, next) => {
  try {
    const graphs = await prisma.graph.findMany({
        include: {
            _count: {
                select: { entities: true, links: true }
            }
        },
        orderBy: { updated: 'desc' }
    });
    
    // Transform to match frontend expected format
    const formatted = graphs.map((g: any) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        entityCount: g._count.entities,
        linkCount: g._count.links,
        created: g.created,
        updated: g.updated
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
});

// Get single graph
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const graph = await prisma.graph.findUnique({
        where: { id: req.params.id },
        include: {
            entities: true,
            links: true
        }
    });
    
    if (!graph) {
        res.status(404).json({ success: false, error: 'Graph not found' });
        return;
    }
    
    res.json({ success: true, data: graph });
  } catch (error) {
    next(error);
  }
});

// Create new graph (user becomes owner & leader)
router.post('/', authenticateToken, requireGraphLimit, async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const { name, description } = req.body;
    
    if (!name || name.trim().length === 0) {
      res.status(400).json({ success: false, error: 'Graph name is required' });
      return;
    }
    
    const newGraph = await prisma.graph.create({
        data: {
            name: name.trim() || 'Untitled Graph',
            description: description?.trim() || '',
            ownerId: userId,
            leaderId: userId,
            members: {
              create: {
                userId: userId,
                role: 'LEADER'
              }
            }
        },
        include: {
            entities: true,
            links: true,
            owner: { select: { id: true, username: true } },
            leader: { select: { id: true, username: true } },
            members: {
              include: {
                user: { select: { id: true, username: true } }
              }
            }
        }
    });
    
    res.status(201).json({ success: true, data: newGraph });
  } catch (error) {
    next(error);
  }
});

// Update graph (full save/sync)
router.put('/:id', authenticateToken, async (req, res, next) => {
    const { id } = req.params;
    const { name, description, entities, links } = req.body;
    const userId = (req as AuthRequest).user!.userId; // Added userId for potential validation

    try {
        // Optional: Verify graph ownership before updating
        const existingGraph = await prisma.graph.findUnique({ where: { id } });
        if (!existingGraph || existingGraph.ownerId !== userId) {
            res.status(403).json({ success: false, error: 'Access denied or Graph not found' });
            return;
        }

        await prisma.graph.update({
            where: { id },
            data: {
                name,
                description,
                updated: new Date()
            }
        });

        if (entities && links) {
            await prisma.$transaction([
                prisma.link.deleteMany({ where: { graphId: id } }),
                prisma.entity.deleteMany({ where: { graphId: id } }),
                
                prisma.entity.createMany({
                    data: entities.map((e: any) => ({
                        id: e.id,
                        graphId: id,
                        type: e.type,
                        value: e.value,
                        properties: e.properties || {},
                        metadata: {
                            ...(e.metadata || {}),
                            position: e.position
                        }
                    }))
                }),
                
                prisma.link.createMany({
                    data: links.map((l: any) => ({
                        id: l.id,
                        graphId: id,
                        sourceId: l.source || l.sourceId,
                        targetId: l.target || l.targetId,
                        label: l.label
                    }))
                })
            ]);
        }
        
        const finalGraph = await prisma.graph.findUnique({
            where: { id },
            include: { entities: true, links: true }
        });

        res.json({ success: true, data: finalGraph });
    } catch (error) {
        next(error);
    }
});

// Delete graph
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    await prisma.graph.delete({
        where: { id: req.params.id }
    });
    res.json({ success: true, message: 'Graph deleted' });
  } catch (error) {
    next(error);
  }
});

// Add entity to graph
router.post('/:id/entities', authenticateToken, requireEntityLimit, async (req, res, next) => {
  try {
    const { type, value, properties } = req.body;
    
    const newEntity = await prisma.entity.create({
        data: {
            graphId: req.params.id,
            type,
            value,
            properties: properties || {}
        }
    });
    
    res.status(201).json({ success: true, data: newEntity });
  } catch (error) {
    next(error);
  }
});

// Add link to graph
router.post('/:id/links', authenticateToken, async (req, res, next) => {
  try {
    const { sourceId, targetId, label } = req.body;
    
    const newLink = await prisma.link.create({
        data: {
            graphId: req.params.id,
            sourceId,
            targetId,
            label: label || ''
        }
    });
    
    res.status(201).json({ success: true, data: newLink });
  } catch (error) {
    next(error);
  }
});

// Update Entity Note
router.patch('/:id/entities/:entityId/note', authenticateToken, async (req, res, next) => {
  try {
    const { entityId } = req.params;
    const { note, noteColor } = req.body;
    const userId = (req as AuthRequest).user!.userId;

    const entity = await prisma.entity.update({
      where: { id: entityId },
      data: {
        note,
        noteColor: noteColor || '#FFEB3B',
        noteAuthor: userId,
        noteDate: new Date()
      }
    });

    res.json({ success: true, data: entity });
  } catch (error) {
    next(error);
  }
});

// Get command history for a graph
router.get('/:id/commands', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    // Verify graph exists
    const graph = await prisma.graph.findUnique({ where: { id } });
    if (!graph) {
      res.status(404).json({ success: false, error: 'Graph not found' });
      return;
    }

    // Load from database, then in-memory cache
    const dbCommands = await prisma.graphCommand.findMany({
      where: { graphId: id },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    // Also check in-memory cache for recent commands not yet saved
    const { collaborationService } = await import('../services/CollaborationService');
    const memoryCommands = collaborationService.getCommandHistory(id, limit);

    // Merge and deduplicate (memory has priority for latest)
    const allCommands = [...memoryCommands];
    const dbIds = new Set(memoryCommands.map(c => c.id));
    
    for (const dbCmd of dbCommands) {
      if (!dbIds.has(dbCmd.id as any)) {
        allCommands.push({
          id: dbCmd.id,
          type: dbCmd.type as any,
          payload: dbCmd.payload,
          userId: dbCmd.userId,
          actorId: (dbCmd.payload as any)?.actorId || dbCmd.userId,
          actorName: (dbCmd.payload as any)?.actorName || dbCmd.userName,
          actorAccountCode: (dbCmd.payload as any)?.actorAccountCode,
          timestamp: dbCmd.timestamp,
          graphId: dbCmd.graphId,
        });
      }
    }

    // Sort by timestamp descending, take limit
    allCommands.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const result = allCommands.slice(0, limit);

    res.json({ 
      success: true, 
      data: result,
      total: result.length
    });
  } catch (error) {
    next(error);
  }
});

// ===== MEMBERSHIP MANAGEMENT =====

// POST /graphs/:id/join - Join an existing graph
router.post('/:id/join', authenticateToken, async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const { id } = req.params;

    // Verify graph exists
    const graph = await prisma.graph.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!graph) {
      res.status(404).json({ success: false, error: 'Graph not found' });
      return;
    }

    // Check if user is already a member
    const existingMember = await prisma.graphMember.findUnique({
      where: { graphId_userId: { graphId: id, userId } },
    });

    if (existingMember) {
      res.status(400).json({ success: false, error: 'Already a member of this graph' });
      return;
    }

    // Add user to graph
    const member = await prisma.graphMember.create({
      data: {
        graphId: id,
        userId: userId,
        role: 'MEMBER',
      },
    });

    res.json({
      success: true,
      message: `Joined graph: ${graph.name}`,
      data: { graphId: id, role: member.role },
    });
  } catch (error: any) {
    next(error);
  }
});

// DELETE /graphs/:id/leave - Leave a graph
router.delete('/:id/leave', authenticateToken, async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const { id } = req.params;

    // Get graph info first
    const graph = await prisma.graph.findUnique({
      where: { id },
      select: { id: true, name: true, leaderId: true, ownerId: true },
    });

    if (!graph) {
      res.status(404).json({ success: false, error: 'Graph not found' });
      return;
    }

    // Check if user is member
    const member = await prisma.graphMember.findUnique({
      where: { graphId_userId: { graphId: id, userId } },
    });

    if (!member) {
      res.status(403).json({ success: false, error: 'Not a member of this graph' });
      return;
    }

    // Delete membership
    await prisma.graphMember.delete({
      where: { graphId_userId: { graphId: id, userId } },
    });

    // If leaving user was leader, promote another member or delete graph if only member
    if (graph.leaderId === userId) {
      const remainingMembers = await prisma.graphMember.findMany({
        where: { graphId: id },
        include: { user: true },
        take: 1,
      });

      if (remainingMembers.length > 0) {
        // Promote the next member to leader
        await prisma.graph.update({
          where: { id },
          data: { leaderId: remainingMembers[0].userId },
        });
      } else {
        // Delete empty graph
        await prisma.graph.delete({ where: { id } });
      }
    }

    res.json({
      success: true,
      message: `Left graph: ${graph.name}`,
    });
  } catch (error: any) {
    next(error);
  }
});

// POST /graphs/:id/kick/:userId - Remove a user from graph (leader only)
router.post('/:id/kick/:targetUserId', authenticateToken, async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const { id: graphId, targetUserId } = req.params;

    // Verify user is leader
    const graph = await prisma.graph.findUnique({
      where: { id: graphId },
      select: { id: true, leaderId: true, name: true },
    });

    if (!graph) {
      res.status(404).json({ success: false, error: 'Graph not found' });
      return;
    }

    if (graph.leaderId !== userId) {
      res.status(403).json({ success: false, error: 'Only leaders can kick members' });
      return;
    }

    // Can't kick yourself
    if (userId === targetUserId) {
      res.status(400).json({ success: false, error: 'Cannot kick yourself' });
      return;
    }

    // Check if target is member
    const targetMember = await prisma.graphMember.findUnique({
      where: { graphId_userId: { graphId, userId: targetUserId } },
      include: { user: true },
    });

    if (!targetMember) {
      res.status(404).json({ success: false, error: 'User is not a member of this graph' });
      return;
    }

    // Remove target from graph
    await prisma.graphMember.delete({
      where: { graphId_userId: { graphId, userId: targetUserId } },
    });

    res.json({
      success: true,
      message: `Removed ${targetMember.user.username} from graph`,
    });
  } catch (error: any) {
    next(error);
  }
});

// POST /graphs/:id/promote/:userId - Promote member to leader (current leader only)
router.post('/:id/promote/:targetUserId', authenticateToken, async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const { id: graphId, targetUserId } = req.params;

    // Verify user is current leader
    const graph = await prisma.graph.findUnique({
      where: { id: graphId },
      select: { id: true, leaderId: true, name: true },
    });

    if (!graph) {
      res.status(404).json({ success: false, error: 'Graph not found' });
      return;
    }

    if (graph.leaderId !== userId) {
      res.status(403).json({ success: false, error: 'Only leaders can promote members' });
      return;
    }

    // Check if target is member
    const targetMember = await prisma.graphMember.findUnique({
      where: { graphId_userId: { graphId, userId: targetUserId } },
      include: { user: true },
    });

    if (!targetMember) {
      res.status(404).json({ success: false, error: 'User is not a member of this graph' });
      return;
    }

    // Update target and current leader roles
    await prisma.$transaction([
      prisma.graphMember.update({
        where: { graphId_userId: { graphId, userId: targetUserId } },
        data: { role: 'LEADER' },
      }),
      prisma.graphMember.update({
        where: { graphId_userId: { graphId, userId } },
        data: { role: 'MEMBER' },
      }),
      prisma.graph.update({
        where: { id: graphId },
        data: { leaderId: targetUserId },
      }),
    ]);

    res.json({
      success: true,
      message: `Promoted ${targetMember.user.username} to leader`,
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;
