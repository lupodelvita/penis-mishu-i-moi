import { Router } from 'express';
import { phoneIntelService } from '../../services/osint/PhoneIntelService';

const router = Router();

/**
 * POST /phone/lookup
 * Full phone intelligence: validation + carrier + HLR + messengers
 *
 * Body: { phone: string }
 * Returns graph-compatible entities + links
 */
router.post('/phone/lookup', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
      });
    }

    // Sanitize: only allow digits, +, -, (, ), spaces
    const sanitized = phone.replace(/[^\d+\-() ]/g, '').trim();
    if (sanitized.length < 7 || sanitized.length > 20) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number length (7–20 chars)',
      });
    }

    console.log(`[PhoneRoutes] Lookup: ${sanitized}`);

    const intel = await phoneIntelService.lookup(sanitized);
    const graphData = phoneIntelService.convertToEntities(intel);

    return res.json({
      success: true,
      data: {
        results: graphData.entities,
        links: graphData.links,
        intel, // raw data for detail panel
      },
    });
  } catch (err: any) {
    console.error('[PhoneRoutes] Lookup error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
});

/**
 * POST /phone/validate
 * Quick validation only (no API calls)
 */
router.post('/phone/validate', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
      });
    }

    const intel = await phoneIntelService.lookup(phone);

    return res.json({
      success: true,
      data: {
        valid: intel.validation.valid,
        e164: intel.validation.e164,
        international: intel.validation.international,
        country: intel.validation.country,
        type: intel.validation.type,
        carrier: intel.carrier?.carrier || null,
        lineType: intel.carrier?.lineType || null,
      },
    });
  } catch (err: any) {
    console.error('[PhoneRoutes] Validate error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
});

export default router;
