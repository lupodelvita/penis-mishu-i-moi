import { Router } from 'express';
import https from 'https';
import { v4 as uuidv4 } from 'uuid';
import { whoisService } from '../../services/osint/WhoisService';
import { techStackService } from '../../services/osint/TechStackService';

const router = Router();

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

// WHOIS domain lookup (legacy endpoint)
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

    const intelligence = await whoisService.getDomainIntelligence(domain);

    if (!intelligence.whois && !intelligence.dns) {
      return res.status(404).json({
        success: false,
        error: 'No data found for this domain'
      });
    }

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

    const techStack = await techStackService.detectTechnologies(url);
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

export default router;
