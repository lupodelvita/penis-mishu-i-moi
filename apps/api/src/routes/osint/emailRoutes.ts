import { Router } from 'express';
import dns from 'dns';

const router = Router();

// Email validation
router.post('/email/validate', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }
    
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const valid = emailRegex.test(email);
    
    if (!valid) {
      return res.json({
        success: true,
        data: {
          email,
          valid: false,
          reason: 'Invalid email format'
        }
      });
    }
    
    // Extract domain
    const domain = email.split('@')[1];
    
    // Check MX records using DNS resolution
    let hasMX = false;
    
    try {
      const mxRecords = await dns.promises.resolveMx(domain);
      hasMX = mxRecords && mxRecords.length > 0;
    } catch (e) {
      hasMX = false;
    }
    
    return res.json({
      success: true,
      data: {
        email,
        valid: true,
        domain,
        hasMX,
        smtpCheck: hasMX ? 'Not performed (requires SMTP)' : 'No MX records',
        validatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Email validation failed'
    });
  }
});

export default router;
