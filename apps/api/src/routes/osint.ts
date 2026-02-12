import { Router } from 'express';
import https from 'https';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth';
import { requireLicense } from '../middleware/license';
import { nmapService } from '../services/osint/NmapService';
import { whoisService } from '../services/osint/WhoisService';
import { techStackService } from '../services/osint/TechStackService';
import { dnsReconService } from '../services/osint/DNSReconService';
import { shodanService } from '../services/osint/ShodanService';
import { oathNetService } from '../services/osint/OathNetService';
import { breachVIPService } from '../services/osint/BreachVIPService';

const router = Router();

router.use(authenticateToken);
router.use(requireLicense);

// WHOIS lookup using external API
async function whoisLookup(domain: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=at_free&domainName=${domain}&outputFormat=JSON`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

const socialPlatforms = [
  { name: 'Twitter/X', url: 'https://twitter.com/', icon: '𝕏' },
  { name: 'GitHub', url: 'https://github.com/', icon: '💻' },
  { name: 'Instagram', url: 'https://instagram.com/', icon: '📷' },
  { name: 'LinkedIn', url: 'https://linkedin.com/in/', icon: '💼' },
  { name: 'Reddit', url: 'https://reddit.com/user/', icon: '🤖' },
  { name: 'YouTube', url: 'https://youtube.com/@', icon: '📺' },
  { name: 'TikTok', url: 'https://tiktok.com/@', icon: '🎵' },
  { name: 'Facebook', url: 'https://facebook.com/', icon: '👥' },
  { name: 'Medium', url: 'https://medium.com/@', icon: '📝' },
  { name: 'Telegram', url: 'https://t.me/', icon: '✈️' },
  { name: 'Discord', url: 'https://discord.com/users/', icon: '💬' },
  { name: 'VK', url: 'https://vk.com/', icon: '🔵' },
  { name: 'Patreon', url: 'https://patreon.com/', icon: '🎨' },
];

// WHOIS domain lookup
router.post('/whois-domain', async (req, res, next) => {
  try {
    const { domain } = req.body;
    if (!domain) throw new Error('Domain is required');
    
    const whoisData = await whoisLookup(domain);
    const results: any[] = [];
    
    if (whoisData.WhoisRecord?.registrarName) {
      results.push({
        id: uuidv4(),
        type: 'organization',
        value: whoisData.WhoisRecord.registrarName,
        properties: { role: 'Registrar' },
        link: { label: 'registered by' },
      });
    }
    
    if (whoisData.WhoisRecord?.registrant?.organization) {
      results.push({
        id: uuidv4(),
        type: 'organization',
        value: whoisData.WhoisRecord.registrant.organization,
        properties: { role: 'Registrant' },
        link: { label: 'owned by' },
      });
    }
    
    if (whoisData.WhoisRecord?.contactEmail) {
      results.push({
        id: uuidv4(),
        type: 'email_address',
        value: whoisData.WhoisRecord.contactEmail,
        properties: { source: 'WHOIS' },
        link: { label: 'contact email' },
      });
    }
    
    if (whoisData.WhoisRecord?.nameServers?.hostNames) {
      for (const ns of whoisData.WhoisRecord.nameServers.hostNames.slice(0, 4)) {
        results.push({
          id: uuidv4(),
          type: 'domain',
          value: ns,
          properties: { recordType: 'NS', source: 'WHOIS' },
          link: { label: 'nameserver' },
        });
      }
    }
    
    results.push({
      id: uuidv4(),
      type: 'text',
      value: `Created: ${whoisData.WhoisRecord?.createdDate || 'Unknown'}`,
      properties: { fullData: whoisData },
      link: { label: 'WHOIS info' },
    });
    
    res.json({ success: true, data: { results } });
  } catch (error) {
    next(error);
  }
});

// Username search across social platforms
router.post('/username-search', async (req, res, next) => {
  try {
    const { username } = req.body;
    if (!username) throw new Error('Username is required');
    
    const results = socialPlatforms.slice(0, 5).map(platform => ({
        id: uuidv4(),
        type: 'social_profile',
        value: `${platform.icon} ${platform.name}: ${username}`,
        properties: { platform: platform.name, username: username, url: platform.url + username },
        link: { label: `possible ${platform.name} profile` },
    }));
    
    res.json({ success: true, data: { results } });
  } catch (error) {
    next(error);
  }
});

// Email to social profiles
router.post('/email-to-social', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) throw new Error('Email is required');
    
    const username = email.split('@')[0];
    const platforms = [
      { name: 'Gravatar', url: `https://gravatar.com/${email}` },
      { name: 'GitHub', url: `https://github.com/${username}` },
      { name: 'LinkedIn', url: `https://linkedin.com/in/${username}` },
    ];
    
    const results = platforms.map(p => ({
        id: uuidv4(),
        type: 'social_profile',
        value: `${p.name}: ${username}`,
        properties: { platform: p.name, email: email, url: p.url },
        link: { label: `possible ${p.name}` },
    }));
    
    res.json({ success: true, data: { results } });
  } catch (error) {
    next(error);
  }
});

// Subdomain enumeration
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

// HaveIBeenPwned check
router.post('/hibp-check', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) throw new Error('Email is required');
    
    res.json({
      success: true,
      data: {
        results: [{
          id: uuidv4(),
          type: 'text',
          value: 'HIBP check required (API key missing)',
          properties: { email },
          link: { label: 'breach check' },
        }],
      },
    });
  } catch (error) {
    next(error);
  }
});

// Nmap port scanning
router.post('/nmap/scan', async (req, res, next) => {
  try {
    const { target, scanType = 'quick' } = req.body;
    
    if (!target) {
      return res.status(400).json({ 
        success: false, 
        error: 'Target (domain or IP) is required' 
      });
    }

    // Validate scan type
    const validScanTypes = ['quick', 'full', 'vuln'];
    if (!validScanTypes.includes(scanType)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid scan type. Must be one of: ${validScanTypes.join(', ')}` 
      });
    }

    // Execute nmap scan
    const scanResult = await nmapService.scan({ target, scanType });

    if (!scanResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: scanResult.error 
      });
    }

    // Convert scan results to graph entities
    const graphData = nmapService.convertToEntities(scanResult);

    res.json({
      success: true,
      data: {
        scan: {
          target: scanResult.target,
          scanType: scanResult.scanType,
          duration: scanResult.duration,
          startTime: scanResult.startTime,
          endTime: scanResult.endTime,
        },
        host: scanResult.host,
        results: graphData.entities,
        links: graphData.links
      },
    });
  } catch (error) {
    console.error('[Nmap] Scan error:', error);
    next(error);
  }
});

// WHOIS + DNS Domain Intelligence
router.post('/whois/domain', async (req, res, next) => {
  try {
    const { domain } = req.body;

    if (!domain) {
      return res.status(400).json({
        success: false,
        error: 'Domain is required'
      });
    }

    // Get comprehensive domain intelligence
    const intelligence = await whoisService.getDomainIntelligence(domain);

    if (!intelligence.whois && !intelligence.dns) {
      return res.status(404).json({
        success: false,
        error: 'No data found for this domain'
      });
    }

    // Convert to graph entities
    const graphData = whoisService.convertToEntities(intelligence);

    res.json({
      success: true,
      data: {
        domain: intelligence.domain,
        whois: intelligence.whois,
        dns: intelligence.dns,
        results: graphData.entities,
        links: graphData.links
      }
    });
  } catch (error) {
    console.error('[WHOIS] Domain intelligence error:', error);
    next(error);
  }
});

// Tech Stack Detection
router.post('/tech-stack', async (req, res, _next) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    // Detect technologies
    const techStack = await techStackService.detectTechnologies(url);

    // Convert to graph entities
    const graphData = techStackService.convertToEntities(techStack);

    return res.json({
      success: true,
      data: {
        url: techStack.url,
        technologies: techStack.technologies,
        meta: techStack.meta,
        results: graphData.entities,
        links: graphData.links
      }
    });
  } catch (error: any) {
    console.error('[TechStack] Detection error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to detect technologies'
    });
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

    // Enumerate subdomains
    const dnsRecon = await dnsReconService.enumerateSubdomains(domain, customWordlist);

    // Convert to graph entities
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

// Shodan Host Lookup
router.post('/shodan/host', async (req, res, _next) => {
  try {
    const { ip } = req.body;

    if (!ip) {
      return res.status(400).json({
        success: false,
        error: 'IP address is required'
      });
    }

    if (!shodanService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Shodan API key not configured'
      });
    }

    // Get host information
    const hostInfo = await shodanService.getHostInfo(ip);

    if (!hostInfo) {
      return res.status(404).json({
        success: false,
        error: 'No information found for this IP'
      });
    }

    // Convert to graph entities
    const graphData = shodanService.convertToEntities(hostInfo);

    return res.json({
      success: true,
      data: {
        host: hostInfo,
        results: graphData.entities,
        links: graphData.links
      }
    });
  } catch (error: any) {
    console.error('[Shodan] Host lookup error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to lookup host'
    });
  }
});

// OathNet Breach Search
router.post('/oathnet/breach', async (req, res, _next) => {
  try {
    const { query, type = 'email' } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }

    if (!oathNetService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'OathNet API key not configured'
      });
    }

    // Execute breach search
    const response = await oathNetService.searchBreach(query, type);

    if (!response.success && response.message !== 'No results found') {
      return res.status(404).json({
        success: false,
        error: response.message || 'No breaches found'
      });
    }

    // Convert results to graph entities
    const graphData = oathNetService.convertBreachToEntities(query, response.data?.results || []);

    return res.json({
      success: true,
      data: {
        query,
        type,
        results: response.data,
        entities: graphData.entities,
        links: graphData.links,
        lookupsLeft: response.lookups_left
      }
    });
  } catch (error: any) {
    console.error('[OathNet] Breach search error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Breach lookup failed'
    });
  }
});

// OathNet Discord Lookup
router.post('/oathnet/discord', async (req, res, _next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    if (!oathNetService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'OathNet API key not configured'
      });
    }

    const response = await oathNetService.discordLookup(userId);

    return res.json({
      success: true,
      data: response.data
    });
  } catch (error: any) {
    console.error('[OathNet] Discord lookup error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Discord lookup failed'
    });
  }
});

// email validation
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
    const dns = require('dns').promises;
    let hasMX = false;
    
    try {
      const mxRecords = await dns.resolveMx(domain);
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

// ===== BreachVIP OSINT =====

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
