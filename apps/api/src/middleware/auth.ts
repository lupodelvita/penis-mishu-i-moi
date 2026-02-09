import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'nodeweaver-secret-key-change-in-prod';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
    username: string;
    licenseTier: string;
  };
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
     res.sendStatus(401); // Unauthorized
     return;
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
         res.sendStatus(403); // Forbidden
         return;
    }
    (req as AuthRequest).user = user;
    next();
  });
}
