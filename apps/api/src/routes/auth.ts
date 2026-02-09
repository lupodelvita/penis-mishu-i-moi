import { Router } from 'express';
import { authService } from '../services/AuthService';
import { userService } from '../services/UserService';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Register
router.post('/register', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const licenseKey = req.body.licenseKey?.trim();
    
    if (!username || !password) {
      res.status(400).json({ success: false, error: 'Username and password required' });
      return;
    }

    const token = await authService.register(username, password, licenseKey);
    res.json({ success: true, token });
  } catch (error: any) {
    next(error);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password);
    res.json({ success: true, data: result });
  } catch (error: any) {
    next(error);
  }
});

// Activate License
router.post('/activate-license', authenticateToken, async (req, res, next) => {
  try {
    const { key, licenseKey } = req.body;
    const finalKey = key || licenseKey;
    const userId = (req as AuthRequest).user!.userId;
    
    const license = await authService.activateLicense(userId, finalKey);
    res.json({ success: true, license });
  } catch (error: any) {
    next(error);
  }
});

// Get Current User
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const user = await userService.getWithLicense(userId);
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

export default router;
