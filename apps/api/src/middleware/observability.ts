import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { observabilityAccessService, ObservabilityScopeValue } from '../services/ObservabilityAccessService';

export async function requireObservabilityAccess(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    await observabilityAccessService.requireAccess(userId);
    next();
  } catch (error: any) {
    const status = error?.status || 403;
    res.status(status).json({ success: false, error: error?.message || 'Observability access denied' });
  }
}

export function requireObservabilityScope(scope: ObservabilityScopeValue) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      await observabilityAccessService.requireScope(userId, scope);
      next();
    } catch (error: any) {
      const status = error?.status || 403;
      res.status(status).json({ success: false, error: error?.message || `Scope ${scope} is required` });
    }
  };
}
