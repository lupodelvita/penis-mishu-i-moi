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

// Create new graph
router.post('/', authenticateToken, requireGraphLimit, async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const { name, description } = req.body;
    
    const newGraph = await prisma.graph.create({
        data: {
            name: name || 'Untitled Graph',
            description: description || '',
            userId: userId
        },
        include: {
            entities: true,
            links: true
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
        if (!existingGraph || existingGraph.userId !== userId) {
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

export default router;
