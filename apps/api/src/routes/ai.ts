import { Router } from 'express';
import { osintAgent } from '../services/ai/OSINTAgent';
import { authenticateToken } from '../middleware/auth';
import { licenseService } from '../services/LicenseService';

const router = Router();

// Middleware: Check AI Access
const requireAi = async (req: any, res: any, next: any) => {
    try {
        const limits = await licenseService.getLimits(req.user.userId);
        if (!limits.canExportAi) {
            return res.status(403).json({ success: false, error: 'AI features require Operative tier or higher.' });
        }
        next();
    } catch (e) { next(e); }
};

router.use(authenticateToken);
router.use(requireAi);

// Generic chat endpoint
router.post('/chat', async (req, res, next) => {
  try {
    const { message } = req.body;
    const response = await osintAgent.processRequest({
      type: 'chat',
      content: { message }
    });
    
    // Имитация задержки обработки
    await new Promise(resolve => setTimeout(resolve, 500));
    
    res.json({ success: true, response });
  } catch (error) {
    next(error);
  }
});

// Analyze graph
router.post('/analyze-graph', async (req, res, next) => {
  try {
    const { graph } = req.body;
    const analysis = await osintAgent.processRequest({
      type: 'analysis',
      content: { graph }
    });
    
    res.json({ success: true, analysis });
  } catch (error) {
    next(error);
  }
});

// Suggest transforms
router.post('/suggest-transforms', async (req, res, next) => {
  try {
    const { entity } = req.body;
    const suggestions = await osintAgent.processRequest({
      type: 'suggestion',
      content: { entity }
    });
    
    res.json({ success: true, suggestions });
  } catch (error) {
    next(error);
  }
});

// Find patterns
router.post('/find-patterns', async (req, res, next) => {
  try {
    const { graph } = req.body;
    const patterns = await osintAgent.processRequest({
      type: 'pattern',
      content: { graph }
    });
    
    res.json({ success: true, patterns });
  } catch (error) {
    next(error);
  }
});

// Explain entity
router.post('/explain-entity', async (req, res, next) => {
  try {
    const { entity } = req.body;
    const explanation = await osintAgent.processRequest({
      type: 'explanation',
      content: { entity }
    });
    
    res.json({ success: true, explanation });
  } catch (error) {
    next(error);
  }
});

// Feedback endpoint (Training)
router.post('/feedback', async (req, res, next) => {
  try {
    const { requestType, content, response, rating } = req.body;
    await osintAgent.saveFeedback({ type: requestType, content }, response, rating);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
