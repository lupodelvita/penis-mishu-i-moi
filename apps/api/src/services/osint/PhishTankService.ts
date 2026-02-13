/**
 * PhishTank Service
 * 
 * PhishTank is a free community site where anyone can submit, verify,
 * track and share phishing data. Useful for checking if URLs are known phishing sites.
 * 
 * API Documentation: https://www.phishtank.com/api_info.php
 * Free Tier: Available (requires API key for commercial use, optional for non-commercial)
 * API Key: https://www.phishtank.com/register.php
 * 
 * Features:
 * - Check if URL is a known phishing site
 * - Get phish details (target brand, submission date, etc.)
 * - Verification status
 */

interface PhishTankResult {
  url: string;
  phish_id: number;
  phish_detail_url: string;
  submission_time: string;
  verified: string; // 'yes' or 'no'
  verification_time?: string;
  online: string; // 'yes' or 'no'
  target?: string; // Target brand (PayPal, Google, etc.)
  details: Array<{
    ip_address: string;
    cidr_block: string;
    announcing_network: string;
    rir: string;
    country: string;
    detail_time: string;
  }>;
}

export class PhishTankService {
  private apiKey?: string;
  private baseUrl = 'https://checkurl.phishtank.com/checkurl/';

  constructor() {
    this.apiKey = process.env.PHISHTANK_API_KEY;
  }

  isConfigured(): boolean {
    return true; // Works without API key for non-commercial use
  }

  /**
   * Check if URL is a known phishing site
   */
  async checkURL(url: string): Promise<PhishTankResult | null> {
    try {
      const formData = new URLSearchParams();
      formData.append('url', url);
      formData.append('format', 'json');
      
      if (this.apiKey) {
        formData.append('app_key', this.apiKey);
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'NodeWeaver OSINT'
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`PhishTank API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Returns null if not in database
      if (!data.results || !data.results.in_database) {
        return null;
      }

      return data.results;
    } catch (error: any) {
      console.error('PhishTank lookup failed:', error.message);
      return null;
    }
  }

  /**
   * Convert PhishTank result to graph entities
   */
  convertToEntities(result: PhishTankResult, url: string): { entities: any[], links: any[] } {
    const entities: any[] = [];
    const links: any[] = [];

    // Phishing threat entity
    const threatId = `phish-${result.phish_id}-${Date.now()}`;
    
    const isVerified = result.verified === 'yes';
    const isOnline = result.online === 'yes';

    entities.push({
      id: threatId,
      type: 'threat',
      value: 'Phishing Site',
      data: {
        label: `PhishTank: Phishing ${isOnline ? '(ACTIVE)' : '(Offline)'}`,
        type: 'threat',
        color: isOnline ? '#ef4444' : '#f59e0b'
      },
      properties: {
        source: 'PhishTank',
        phish_id: result.phish_id,
        verified: isVerified,
        online: isOnline,
        target: result.target,
        submitted: result.submission_time,
        verified_at: result.verification_time,
        detail_url: result.phish_detail_url
      }
    });

    links.push({
      id: `link-url-${threatId}`,
      source: `url-${url}`,
      target: threatId,
      label: 'identified as'
    });

    // Target brand entity (if available)
    if (result.target) {
      const targetId = `brand-${result.target.replace(/\s+/g, '-')}-${Date.now()}`;
      entities.push({
        id: targetId,
        type: 'organization',
        value: result.target,
        data: {
          label: `Target: ${result.target}`,
          type: 'organization',
          color: '#ef4444'
        },
        properties: {
          role: 'phishing_target'
        }
      });

      links.push({
        id: `link-${threatId}-${targetId}`,
        source: threatId,
        target: targetId,
        label: 'impersonates'
      });
    }

    // IP entities from details
    if (result.details && result.details.length > 0) {
      result.details.slice(0, 3).forEach((detail, idx) => {
        const ipId = `ip-${detail.ip_address}`;
        
        entities.push({
          id: ipId,
          type: 'ip_address',
          value: detail.ip_address,
          data: {
            label: detail.ip_address,
            type: 'ip_address',
            color: '#f59e0b'
          },
          properties: {
            country: detail.country,
            asn: detail.announcing_network,
            rir: detail.rir,
            cidr: detail.cidr_block
          }
        });

        links.push({
          id: `link-${threatId}-${ipId}-${idx}`,
          source: threatId,
          target: ipId,
          label: 'hosted on'
        });
      });
    }

    return { entities, links };
  }
}

export const phishTankService = new PhishTankService();
