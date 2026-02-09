import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = express.Router();

// Create Team
router.post('/teams', authenticateToken, async (req, res, next) => {
  try {
    const { name, description, avatar } = req.body;
    const userId = (req as AuthRequest).user!.userId;

    const team = await prisma.team.create({
      data: {
        name,
        description,
        avatar,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: 'OWNER'
          }
        }
      },
      include: {
        members: { include: { user: true } }
      }
    });

    res.json({ success: true, data: team });
  } catch (error) {
    next(error);
  }
});

// Get User's Teams
router.get('/teams', authenticateToken, async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).user!.userId;

    const teams = await prisma.team.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } }
        ]
      },
      include: {
        owner: { select: { id: true, username: true } },
        members: {
          include: {
            user: { select: { id: true, username: true } }
          }
        },
        _count: { select: { members: true } }
      }
    });

    res.json({ success: true, data: teams });
  } catch (error) {
    next(error);
  }
});

// Invite Member
router.post('/teams/:id/invite', authenticateToken, async (req, res, next) => {
  try {
    const { id: teamId } = req.params;
    const { userId: invitedUserId, role } = req.body;
    const currentUserId = (req as AuthRequest).user!.userId;

    // Check if user is owner or admin
    const membership = await prisma.teamMember.findFirst({
      where: { teamId, userId: currentUserId, role: { in: ['OWNER', 'ADMIN'] } }
    });

    if (!membership) {
      res.status(403).json({ success: false, error: 'No permission to invite' });
      return;
    }

    const newMember = await prisma.teamMember.create({
      data: {
        teamId,
        userId: invitedUserId,
        role: role || 'MEMBER'
      },
      include: { user: true }
    });

    res.json({ success: true, data: newMember });
  } catch (error) {
    next(error);
  }
});

// Remove Member
router.delete('/teams/:teamId/members/:userId', authenticateToken, async (req, res, next) => {
  try {
    const { teamId, userId: targetUserId } = req.params;
    const currentUserId = (req as AuthRequest).user!.userId;

    const membership = await prisma.teamMember.findFirst({
      where: { teamId, userId: currentUserId, role: { in: ['OWNER', 'ADMIN'] } }
    });

    if (!membership) {
      res.status(403).json({ success: false, error: 'No permission' });
      return;
    }

    await prisma.teamMember.delete({
      where: {
        teamId_userId: { teamId, userId: targetUserId }
      }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
