import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { reportService } from '../services/ReportService';
import { userService } from '../services/UserService';
import { LicenseTier } from '@prisma/client';

const router = Router();

// Generate PDF
router.post('/generate/:graphId', authenticateToken, async (req, res, next) => {
    try {
        const userId = (req as AuthRequest).user!.userId;
        const { graphId } = req.params;

        // 1. Fetch Graph & User Tier
        const [user, graph] = await Promise.all([
            userService.getWithLicense(userId),
            prisma.graph.findUnique({
                where: { id: graphId },
                include: { entities: true, links: true }
            })
        ]);

        if (!graph) {
             res.status(404).json({ success: false, error: 'Graph not found' });
             return;
        }

        // Verify Ownership (or Admin)
        if (graph.userId && graph.userId !== userId && user?.role !== 'ADMIN') {
             res.status(403).json({ success: false, error: 'Access Denied' });
             return;
        }

        // 2. Check License Capability
        const tier = user?.license?.tier || LicenseTier.OBSERVER;
        // Observer cannot export PDF
        if (tier === LicenseTier.OBSERVER) {
             res.status(403).json({ success: false, error: 'Upgrade to Analyst to export PDF.' });
             return;
        }

        // 3. Generate PDF
        const pdfBuffer = await reportService.generatePDF(graph, tier);

        // 4. Send Response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="report-${graph.name}.pdf"`);
        res.send(pdfBuffer);

    } catch (error) {
        next(error);
    }
});

export default router;
