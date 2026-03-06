import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dnsReconService } from '../../services/osint/DNSReconService';

const router = Router();

// Subdomain enumeration (legacy simple endpoint)
router.post('/subdomain-enum', async (req, res, next) => {
  try {
    const { domain } = req.body;
    if (!domain) throw new Error('Domain is required');
    
    const commonSubdomains = ['www', 'mail', 'ftp', 'admin', 'dev', 'api', 'app', 'cdn', 'static', 'docs'];
    const results = commonSubdomains.map(sub => ({
        id: uuidv4(),
        type: 'domain',
        value: `${sub}.${domain}`,
        properties: { subdomain: sub, parent: domain },
        link: { label: 'subdomain' },
    }));
    
    res.json({ success: true, data: { results } });
  } catch (error) {
    next(error);
  }
});

// DNS Reconnaissance (Subdomain Enumeration)
router.post('/dns-recon', async (req, res, _next) => {
  try {
    const { domain, customWordlist } = req.body;

    if (!domain) {
      return res.status(400).json({
        success: false,
        error: 'Domain is required'
      });
    }

    console.log(`[DNSRecon] Starting enumeration for ${domain}`);

    const dnsRecon = await dnsReconService.enumerateSubdomains(domain, customWordlist);
    const graphData = dnsReconService.convertToEntities(dnsRecon);

    return res.json({
      success: true,
      data: {
        domain: dnsRecon.domain,
        totalFound: dnsRecon.totalFound,
        subdomains: dnsRecon.subdomains,
        results: graphData.entities,
        links: graphData.links
      }
    });
  } catch (error: any) {
    console.error('[DNSRecon] Enumeration error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to enumerate subdomains'
    });
  }
});

export default router;
