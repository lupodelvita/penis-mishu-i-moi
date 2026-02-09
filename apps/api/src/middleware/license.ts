import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { licenseService } from '../services/LicenseService';

export const requireGraphLimit = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
         res.sendStatus(401);
         return; 
    }

    const canCreate = await licenseService.canCreateGraph(userId);
    if (!canCreate) {
        res.status(403).json({ 
            success: false, 
            error: 'Graph limit reached for your license tier. Please upgrade.' 
        });
        return;
    }
    next();
  } catch (error) {
    res.status(500).json({ success: false, error: 'License check failed' });
  }
};

export const requireBotLimit = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
         res.sendStatus(401);
         return;
    }

    const canAdd = await licenseService.canAddBot(userId);
    if (!canAdd) {
        res.status(403).json({ 
            success: false, 
            error: 'Bot limit reached. Upgrade to add more bots.' 
        });
        return;
    }
    next();
  } catch (error) {
    res.status(500).json({ success: false, error: 'License check failed' });
  }
};

export const requireLicense = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
             res.sendStatus(401);
             return;
        }
        await licenseService.getLimits(userId);
        next();
    } catch (error) {
        res.status(500).json({ success: false, error: 'License check failed' });
    }
};

export const requireEntityLimit = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.userId;
        const graphId = (req as any).params?.id;
        if (!userId) {
             res.sendStatus(401);
             return;
        }

        const canAdd = await licenseService.canAddEntity(userId, graphId);
        if (!canAdd) {
            res.status(403).json({ 
                success: false, 
                error: 'Entity limit reached for this graph in your license tier. Please upgrade.' 
            });
            return;
        }
        next();
    } catch (error) {
        res.status(500).json({ success: false, error: 'License check failed' });
    }
};
