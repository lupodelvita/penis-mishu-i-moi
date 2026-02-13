import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireLicense } from '../middleware/license';
import { transformManager } from '../services/TransformManager';
import { ipGeolocationService } from '../services/osint/IpGeolocationService';
import { rateLimitTracker } from '../services/RateLimitTracker';
const router = Router();
router.use(authenticateToken);
router.use(requireLicense);
router.get('/', async (_req, res, next) => {
  try {
    const transforms = transformManager.getAllTransforms();
    res.json({
      success: true,
      data: {
        transforms: transforms.map(t => {
          const provider = rateLimitTracker.getProviderForTransform(t.id);
          const quota = rateLimitTracker.getQuota(provider);
          const estimate = rateLimitTracker.getEstimatedTime(t.id);
          return {
            id: t.id,
            name: t.name,
            description: t.description,
            category: t.category,
            inputTypes: t.inputTypes,
            outputTypes: t.outputTypes,
            icon: t.icon,
            requiresApiKey: t.requiresApiKey,
            provider: quota.displayName,
            providerKey: provider,
            estimatedTime: estimate.label,
            estimatedMs: estimate.estimatedMs,
            quota: {
              available: quota.available,
              configured: quota.configured,
              windows: quota.windows,
              waitMs: quota.waitMs,
              freeDescription: quota.freeDescription,
            },
          };
        }),
        total: transforms.length
      }
    });
  } catch (error) {
    next(error);
  }
});
router.get('/category/:category', async (_req, res, next) => {
  try {
    const { category } = _req.params;
    const transforms = transformManager.getTransformsByCategory(category);
    res.json({
      success: true,
      data: {
        category,
        transforms: transforms.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          icon: t.icon,
          inputTypes: t.inputTypes,
          outputTypes: t.outputTypes
        })),
        total: transforms.length
      }
    });
  } catch (error) {
    next(error);
  }
});
router.get('/for/:entityType', async (_req, res, next) => {
  try {
    const { entityType } = _req.params;
    const transforms = transformManager.getTransformsForEntityType(entityType);
    res.json({
      success: true,
      data: {
        entityType,
        transforms: transforms.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          category: t.category,
          icon: t.icon
        })),
        total: transforms.length
      }
    });
  } catch (error) {
    next(error);
  }
});
router.post('/execute', async (req, res, next) => {
  try {
    const { transformId, entity, params } = req.body;
    if (!transformId || !entity) {
      return res.status(400).json({
        success: false,
        error: 'transformId and entity are required'
      });
    }
    console.log(`[Transform] Executing ${transformId} on ${entity.type}:${entity.value}`);
    const result = await transformManager.executeTransform(transformId, entity, params);
    
    // Get provider info for response
    const provider = rateLimitTracker.getProviderForTransform(transformId);
    const quota = rateLimitTracker.getQuota(provider);
    
    res.json({
      success: result.success,
      data: result.success ? {
        entities: result.entities,
        links: result.links,
        metadata: result.metadata
      } : undefined,
      error: result.error,
      quota: {
        provider: quota.displayName,
        available: quota.available,
        windows: quota.windows,
        waitMs: quota.waitMs,
      },
      rateLimited: result.metadata?.rateLimited || false,
    });
  } catch (error: any) {
    console.error('[Transform] Execution error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Transform execution failed'
    });
  }
});
router.get('/categories', async (req, res, next) => {
  try {
    const categories = transformManager.getCategories();
    res.json({
      success: true,
      data: { categories }
    });
  } catch (error) {
    next(error);
  }
});
router.post('/geolocate', async (req, res, next) => {
  try {
    const { ipAddress } = req.body;
    if (!ipAddress) {
      return res.status(400).json({
        success: false,
        error: 'IP address is required'
      });
    }
    const geoData = await ipGeolocationService.getLocation(ipAddress);
    if (!geoData) {
      return res.status(404).json({
        success: false,
        error: 'Could not geolocate IP address'
      });
    }
    res.json({
      success: true,
      data: geoData
    });
  } catch (error) {
    next(error);
  }
});

// ═══════ Rate Limit / Quota Endpoints ═══════

/**
 * GET /transforms/quota — All provider quotas
 */
router.get('/quota', async (_req, res, next) => {
  try {
    const quotas = rateLimitTracker.getAllQuotas();
    res.json({
      success: true,
      data: {
        providers: quotas,
        timestamp: Date.now(),
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /transforms/quota/:provider — Single provider quota
 */
router.get('/quota/:provider', async (req, res, next) => {
  try {
    const { provider } = req.params;
    const quota = rateLimitTracker.getQuota(provider);
    res.json({
      success: true,
      data: quota
    });
  } catch (error) {
    next(error);
  }
});

export default router;

