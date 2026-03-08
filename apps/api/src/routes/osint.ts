import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireLicense } from '../middleware/license';
import networkRoutes from './osint/networkRoutes';
import whoisDomainRoutes from './osint/whoisDomainRoutes';
import dnsRoutes from './osint/dnsRoutes';
import socialRoutes from './osint/socialRoutes';
import emailRoutes from './osint/emailRoutes';
import breachRoutes from './osint/breachRoutes';
import breachvipRoutes from './osint/breachvipRoutes';
import phoneRoutes from './osint/phoneRoutes';

const router = Router();

// Apply auth & license middleware to all OSINT routes
router.use(authenticateToken);
router.use(requireLicense);

// Mount sub-routers
router.use(networkRoutes);
router.use(whoisDomainRoutes);
router.use(dnsRoutes);
router.use(socialRoutes);
router.use(emailRoutes);
router.use(breachRoutes);
router.use(breachvipRoutes);
router.use(phoneRoutes);

export default router;
