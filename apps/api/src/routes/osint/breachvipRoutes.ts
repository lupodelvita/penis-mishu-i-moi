import { Router } from 'express';
import { breachVIPService } from '../../services/osint/BreachVIPService';

const router = Router();

// Generic search endpoint
router.post('/breachvip/search', async (req, res, next) => {
  try {
    if (!breachVIPService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'BreachVIP API not configured. Set BREACHVIP_API_KEY environment variable.',
      });
    }

    const { term, fields, categories, wildcard, case_sensitive } = req.body;

    if (!term || !fields) {
      return res.status(400).json({
        success: false,
        error: 'term and fields are required',
      });
    }

    const results = await breachVIPService.search({
      term,
      fields,
      categories,
      wildcard,
      case_sensitive,
    });

    res.json({
      success: true,
      data: results,
      rateLimitStatus: breachVIPService.getRateLimitStatus(),
    });
  } catch (error: any) {
    next(error);
  }
});

// Search by email
router.post('/breachvip/email', async (req, res, next) => {
  try {
    if (!breachVIPService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'BreachVIP API not configured',
      });
    }

    const { email, wildcard } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'email parameter is required',
      });
    }

    const results = await breachVIPService.searchByEmail(email, wildcard);

    res.json({
      success: true,
      data: results,
      rateLimitStatus: breachVIPService.getRateLimitStatus(),
    });
  } catch (error: any) {
    next(error);
  }
});

// Search by username
router.post('/breachvip/username', async (req, res, next) => {
  try {
    if (!breachVIPService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'BreachVIP API not configured',
      });
    }

    const { username, wildcard } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'username parameter is required',
      });
    }

    const results = await breachVIPService.searchByUsername(username, wildcard);

    res.json({
      success: true,
      data: results,
      rateLimitStatus: breachVIPService.getRateLimitStatus(),
    });
  } catch (error: any) {
    next(error);
  }
});

// Search by domain
router.post('/breachvip/domain', async (req, res, next) => {
  try {
    if (!breachVIPService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'BreachVIP API not configured',
      });
    }

    const { domain, wildcard } = req.body;

    if (!domain) {
      return res.status(400).json({
        success: false,
        error: 'domain parameter is required',
      });
    }

    const results = await breachVIPService.searchByDomain(domain, wildcard);

    res.json({
      success: true,
      data: results,
      rateLimitStatus: breachVIPService.getRateLimitStatus(),
    });
  } catch (error: any) {
    next(error);
  }
});

// Search by IP address
router.post('/breachvip/ip', async (req, res, next) => {
  try {
    if (!breachVIPService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'BreachVIP API not configured',
      });
    }

    const { ip } = req.body;

    if (!ip) {
      return res.status(400).json({
        success: false,
        error: 'ip parameter is required',
      });
    }

    const results = await breachVIPService.searchByIP(ip);

    res.json({
      success: true,
      data: results,
      rateLimitStatus: breachVIPService.getRateLimitStatus(),
    });
  } catch (error: any) {
    next(error);
  }
});

// Search by phone
router.post('/breachvip/phone', async (req, res, next) => {
  try {
    if (!breachVIPService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'BreachVIP API not configured',
      });
    }

    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'phone parameter is required',
      });
    }

    const results = await breachVIPService.searchByPhone(phone);

    res.json({
      success: true,
      data: results,
      rateLimitStatus: breachVIPService.getRateLimitStatus(),
    });
  } catch (error: any) {
    next(error);
  }
});

// Multi-field identity search
router.post('/breachvip/identity', async (req, res, next) => {
  try {
    if (!breachVIPService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'BreachVIP API not configured',
      });
    }

    const { term, wildcard } = req.body;

    if (!term) {
      return res.status(400).json({
        success: false,
        error: 'term parameter is required',
      });
    }

    const results = await breachVIPService.searchByIdentity(term, wildcard);

    res.json({
      success: true,
      data: results,
      rateLimitStatus: breachVIPService.getRateLimitStatus(),
    });
  } catch (error: any) {
    next(error);
  }
});

// Get rate limit status
router.get('/breachvip/status', async (req, res) => {
  try {
    const status = breachVIPService.getRateLimitStatus();
    
    res.json({
      success: true,
      configured: breachVIPService.isConfigured(),
      rateLimit: status,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
