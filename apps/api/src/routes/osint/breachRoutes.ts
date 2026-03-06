import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { oathNetService } from '../../services/osint/OathNetService';

const router = Router();

// HaveIBeenPwned check
router.post('/hibp-check', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) throw new Error('Email is required');
    
    res.json({
      success: true,
      data: {
        results: [{
          id: uuidv4(),
          type: 'text',
          value: 'HIBP check required (API key missing)',
          properties: { email },
          link: { label: 'breach check' },
        }],
      },
    });
  } catch (error) {
    next(error);
  }
});

// OathNet Breach Search
router.post('/oathnet/breach', async (req, res, _next) => {
  try {
    const { query, type = 'email' } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }

    if (!oathNetService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'OathNet API key not configured'
      });
    }

    // Execute breach search
    const response = await oathNetService.searchBreach(query, type);

    if (!response.success && response.message !== 'No results found') {
      return res.status(404).json({
        success: false,
        error: response.message || 'No breaches found'
      });
    }

    // Convert results to graph entities
    const graphData = oathNetService.convertBreachToEntities(query, response.data?.results || []);

    return res.json({
      success: true,
      data: {
        query,
        type,
        results: response.data,
        entities: graphData.entities,
        links: graphData.links,
        lookupsLeft: response.lookups_left
      }
    });
  } catch (error: any) {
    console.error('[OathNet] Breach search error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Breach lookup failed'
    });
  }
});

// OathNet Discord Lookup
router.post('/oathnet/discord', async (req, res, _next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    if (!oathNetService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'OathNet API key not configured'
      });
    }

    const response = await oathNetService.discordLookup(userId);

    return res.json({
      success: true,
      data: response.data
    });
  } catch (error: any) {
    console.error('[OathNet] Discord lookup error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Discord lookup failed'
    });
  }
});

export default router;
