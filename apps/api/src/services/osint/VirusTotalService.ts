/**
 * VirusTotal Service
 * 
 * Analyzes domains, IPs, URLs, and file hashes for malware and threats using VirusTotal API.
 * 
 * API Documentation: https://developers.virustotal.com/reference/overview
 * Free Tier: 4 requests/minute, 500 requests/day
 * API Key: https://www.virustotal.com/gui/join-us (free registration)
 * 
 * Features:
 * - Domain reputation and malware detection
 * - IP address threat analysis
 * - URL scanning and categorization
 * - File hash lookup (MD5, SHA1, SHA256)
 * - Threat categories and tags
 */

interface VirusTotalDomainReport {
  id: string;
  attributes: {
    reputation: number;
    last_analysis_stats: {
      harmless: number;
      malicious: number;
      suspicious: number;
      undetected: number;
    };
    categories: Record<string, string>;
    tags: string[];
    last_analysis_results: Record<string, {
      category: string;
      result: string;
      engine_name: string;
    }>;
    whois?: string;
    whois_date?: number;
  };
}

interface VirusTotalIPReport {
  id: string;
  attributes: {
    reputation: number;
    last_analysis_stats: {
      harmless: number;
      malicious: number;
      suspicious: number;
      undetected: number;
    };
    country: string;
    as_owner?: string;
    asn?: number;
    tags: string[];
    categories: Record<string, string>;
  };
}

interface VirusTotalURLReport {
  id: string;
  attributes: {
    url: string;
    reputation: number;
    last_analysis_stats: {
      harmless: number;
      malicious: number;
      suspicious: number;
      undetected: number;
    };
    categories: Record<string, string>;
    tags: string[];
    threat_names: string[];
    total_votes: {
      harmless: number;
      malicious: number;
    };
  };
}

export class VirusTotalService {
  private apiKey?: string;
  private baseUrl = 'https://www.virustotal.com/api/v3';

  constructor() {
    this.apiKey = process.env.VIRUSTOTAL_API_KEY;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Analyze domain for threats and malware
   */
  async analyzeDomain(domain: string): Promise<VirusTotalDomainReport | null> {
    if (!this.apiKey) {
      throw new Error('VirusTotal API key not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/domains/${domain}`, {
        headers: {
          'x-apikey': this.apiKey
        }
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`VirusTotal API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error: any) {
      console.error('VirusTotal domain analysis failed:', error.message);
      return null;
    }
  }

  /**
   * Analyze IP address for threats
   */
  async analyzeIP(ip: string): Promise<VirusTotalIPReport | null> {
    if (!this.apiKey) {
      throw new Error('VirusTotal API key not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/ip_addresses/${ip}`, {
        headers: {
          'x-apikey': this.apiKey
        }
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`VirusTotal API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error: any) {
      console.error('VirusTotal IP analysis failed:', error.message);
      return null;
    }
  }

  /**
   * Analyze URL for threats (scans if needed)
   */
  async analyzeURL(url: string): Promise<VirusTotalURLReport | null> {
    if (!this.apiKey) {
      throw new Error('VirusTotal API key not configured');
    }

    try {
      // First try to get existing report
      const urlId = Buffer.from(url).toString('base64').replace(/=/g, '');
      const response = await fetch(`${this.baseUrl}/urls/${urlId}`, {
        headers: {
          'x-apikey': this.apiKey
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.data;
      }

      // If not found, submit for scanning (async)
      if (response.status === 404) {
        await this.submitURL(url);
        return null; // User should retry after a few seconds
      }

      throw new Error(`VirusTotal API error: ${response.status}`);
    } catch (error: any) {
      console.error('VirusTotal URL analysis failed:', error.message);
      return null;
    }
  }

  /**
   * Submit URL for scanning
   */
  async submitURL(url: string): Promise<{ id: string } | null> {
    if (!this.apiKey) {
      throw new Error('VirusTotal API key not configured');
    }

    try {
      const formData = new URLSearchParams();
      formData.append('url', url);

      const response = await fetch(`${this.baseUrl}/urls`, {
        method: 'POST',
        headers: {
          'x-apikey': this.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`VirusTotal API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error: any) {
      console.error('VirusTotal URL submission failed:', error.message);
      return null;
    }
  }

  /**
   * Convert domain report to graph entities
   */
  convertDomainToEntities(report: VirusTotalDomainReport, domain: string): { entities: any[], links: any[] } {
    const entities: any[] = [];
    const links: any[] = [];

    const stats = report.attributes.last_analysis_stats;
    const maliciousCount = stats.malicious + stats.suspicious;
    const totalEngines = stats.harmless + stats.malicious + stats.suspicious + stats.undetected;

    // Threat verdict entity
    if (maliciousCount > 0) {
      const threatId = `threat-vt-${domain}-${Date.now()}`;
      entities.push({
        id: threatId,
        type: 'threat',
        value: `${maliciousCount}/${totalEngines} engines flagged`,
        data: {
          label: `VirusTotal: ${maliciousCount}/${totalEngines} malicious`,
          type: 'threat',
          color: maliciousCount > totalEngines * 0.1 ? '#ef4444' : '#f59e0b'
        },
        properties: {
          source: 'VirusTotal',
          reputation: report.attributes.reputation,
          malicious: stats.malicious,
          suspicious: stats.suspicious,
          harmless: stats.harmless,
          undetected: stats.undetected
        },
        metadata: {
          tags: report.attributes.tags,
          categories: report.attributes.categories
        }
      });

      links.push({
        id: `link-domain-${threatId}`,
        source: `domain-${domain}`,
        target: threatId,
        label: 'threat detected'
      });
    }

    // Category entities (if categorized by engines)
    const categories = Object.values(report.attributes.categories || {});
    const uniqueCategories = [...new Set(categories)];

    uniqueCategories.slice(0, 5).forEach(category => {
      const categoryId = `category-${category}-${Date.now()}-${Math.random()}`;
      entities.push({
        id: categoryId,
        type: 'category',
        value: category,
        data: {
          label: category,
          type: 'category',
          color: '#8b5cf6'
        },
        properties: {
          source: 'VirusTotal'
        }
      });

      links.push({
        id: `link-domain-${categoryId}`,
        source: `domain-${domain}`,
        target: categoryId,
        label: 'categorized as'
      });
    });

    return { entities, links };
  }

  /**
   * Convert IP report to graph entities
   */
  convertIPToEntities(report: VirusTotalIPReport, ip: string): { entities: any[], links: any[] } {
    const entities: any[] = [];
    const links: any[] = [];

    const stats = report.attributes.last_analysis_stats;
    const maliciousCount = stats.malicious + stats.suspicious;
    const totalEngines = stats.harmless + stats.malicious + stats.suspicious + stats.undetected;

    // Threat verdict entity
    if (maliciousCount > 0) {
      const threatId = `threat-vt-${ip}-${Date.now()}`;
      entities.push({
        id: threatId,
        type: 'threat',
        value: `${maliciousCount}/${totalEngines} engines flagged`,
        data: {
          label: `VirusTotal: ${maliciousCount}/${totalEngines} malicious`,
          type: 'threat',
          color: maliciousCount > totalEngines * 0.1 ? '#ef4444' : '#f59e0b'
        },
        properties: {
          source: 'VirusTotal',
          reputation: report.attributes.reputation,
          malicious: stats.malicious,
          suspicious: stats.suspicious,
          harmless: stats.harmless,
          undetected: stats.undetected,
          country: report.attributes.country,
          asn: report.attributes.asn,
          as_owner: report.attributes.as_owner
        },
        metadata: {
          tags: report.attributes.tags,
          categories: report.attributes.categories
        }
      });

      links.push({
        id: `link-ip-${threatId}`,
        source: `ip-${ip}`,
        target: threatId,
        label: 'threat detected'
      });
    }

    // Organization entity (if ASN owner available)
    if (report.attributes.as_owner) {
      const orgId = `org-${report.attributes.asn}-${Date.now()}`;
      entities.push({
        id: orgId,
        type: 'organization',
        value: report.attributes.as_owner,
        data: {
          label: report.attributes.as_owner,
          type: 'organization',
          color: '#10b981'
        },
        properties: {
          asn: report.attributes.asn,
          country: report.attributes.country
        }
      });

      links.push({
        id: `link-ip-${orgId}`,
        source: `ip-${ip}`,
        target: orgId,
        label: 'owned by'
      });
    }

    return { entities, links };
  }

  /**
   * Convert URL report to graph entities
   */
  convertURLToEntities(report: VirusTotalURLReport, url: string): { entities: any[], links: any[] } {
    const entities: any[] = [];
    const links: any[] = [];

    const stats = report.attributes.last_analysis_stats;
    const maliciousCount = stats.malicious + stats.suspicious;
    const totalEngines = stats.harmless + stats.malicious + stats.suspicious + stats.undetected;

    // Threat verdict entity
    if (maliciousCount > 0) {
      const threatId = `threat-vt-url-${Date.now()}`;
      entities.push({
        id: threatId,
        type: 'threat',
        value: `${maliciousCount}/${totalEngines} engines flagged`,
        data: {
          label: `VirusTotal: ${maliciousCount}/${totalEngines} malicious`,
          type: 'threat',
          color: maliciousCount > totalEngines * 0.1 ? '#ef4444' : '#f59e0b'
        },
        properties: {
          source: 'VirusTotal',
          reputation: report.attributes.reputation,
          malicious: stats.malicious,
          suspicious: stats.suspicious,
          harmless: stats.harmless,
          undetected: stats.undetected,
          threat_names: report.attributes.threat_names,
          malicious_votes: report.attributes.total_votes.malicious,
          harmless_votes: report.attributes.total_votes.harmless
        },
        metadata: {
          tags: report.attributes.tags,
          categories: report.attributes.categories,
          url: report.attributes.url
        }
      });

      links.push({
        id: `link-url-${threatId}`,
        source: `url-${url}`,
        target: threatId,
        label: 'threat detected'
      });
    }

    return { entities, links };
  }
}

export const virusTotalService = new VirusTotalService();
