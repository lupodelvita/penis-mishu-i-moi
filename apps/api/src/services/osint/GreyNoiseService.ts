/**
 * GreyNoise Service
 * 
 * Provides intelligence about IPs - distinguishes internet noise (scanners, bots)
 * from targeted attacks. Helps answer "Should I be worried about this IP?"
 * 
 * API Documentation: https://docs.greynoise.io/reference/get_v3-community-ip
 * Free Tier: Community API (no auth required for basic lookups)
 * Premium: RIOT dataset, full context, tags
 * 
 * Features:
 * - IP classification (benign, malicious, unknown)
 * - Common business services identification (Google, Microsoft, etc.)
 * - Scanning activity detection
 * - Tags and metadata
 */

interface GreyNoiseCommunityResponse {
  ip: string;
  noise: boolean;
  riot: boolean; // Rule It Out Trust - known benign service
  classification: 'benign' | 'malicious' | 'unknown';
  name?: string; // Service name if RIOT
  link: string;
  last_seen: string;
  message?: string;
}

interface GreyNoiseContextResponse {
  ip: string;
  seen: boolean;
  classification: 'benign' | 'malicious' | 'unknown';
  first_seen?: string;
  last_seen?: string;
  actor?: string;
  tags: string[];
  metadata: {
    country?: string;
    country_code?: string;
    city?: string;
    organization?: string;
    asn?: string;
    category?: string;
    tor?: boolean;
    vpn?: boolean;
  };
  raw_data?: {
    scan?: Array<{
      port: number;
      protocol: string;
    }>;
    web?: {
      paths: string[];
      useragents: string[];
    };
    ja3?: Array<{
      fingerprint: string;
      port: number;
    }>;
  };
}

export class GreyNoiseService {
  private apiKey?: string;
  private communityUrl = 'https://api.greynoise.io/v3/community';
  private contextUrl = 'https://api.greynoise.io/v2/noise/context';

  constructor() {
    this.apiKey = process.env.GREYNOISE_API_KEY;
  }

  isConfigured(): boolean {
    // Community API works without key
    return true;
  }

  /**
   * Get community data for IP (works without API key)
   */
  async getCommunityData(ip: string): Promise<GreyNoiseCommunityResponse | null> {
    try {
      const response = await fetch(`${this.communityUrl}/${ip}`, {
        headers: this.apiKey ? { 'key': this.apiKey } : {}
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`GreyNoise API error: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('GreyNoise community lookup failed:', error.message);
      return null;
    }
  }

  /**
   * Get full context (requires API key)
   */
  async getContext(ip: string): Promise<GreyNoiseContextResponse | null> {
    if (!this.apiKey) {
      return null; // Fallback to community API
    }

    try {
      const response = await fetch(`${this.contextUrl}/${ip}`, {
        headers: { 'key': this.apiKey }
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`GreyNoise API error: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('GreyNoise context lookup failed:', error.message);
      return null;
    }
  }

  /**
   * Convert community data to graph entities
   */
  convertCommunityToEntities(data: GreyNoiseCommunityResponse, ip: string): { entities: any[], links: any[] } {
    const entities: any[] = [];
    const links: any[] = [];

    // Create classification entity
    const classId = `greynoise-${ip}-${Date.now()}`;
    
    let color = '#6b7280'; // Unknown gray
    if (data.classification === 'benign' || data.riot) color = '#10b981'; // Green
    if (data.classification === 'malicious') color = '#ef4444'; // Red

    let label = 'GreyNoise: ';
    if (data.riot) {
      label += `Known Service (${data.name || 'RIOT'})`;
    } else if (data.noise) {
      label += `Internet Noise (${data.classification})`;
    } else {
      label += `Not Observed`;
    }

    entities.push({
      id: classId,
      type: data.riot ? 'service' : 'threat_intel',
      value: label,
      data: {
        label,
        type: data.riot ? 'service' : 'threat_intel',
        color
      },
      properties: {
        source: 'GreyNoise',
        classification: data.classification,
        noise: data.noise,
        riot: data.riot,
        service_name: data.name,
        last_seen: data.last_seen,
        link: data.link
      }
    });

    links.push({
      id: `link-ip-${classId}`,
      source: `ip-${ip}`,
      target: classId,
      label: data.riot ? 'identified as' : 'classified as'
    });

    return { entities, links };
  }

  /**
   * Convert full context to graph entities
   */
  convertContextToEntities(data: GreyNoiseContextResponse, ip: string): { entities: any[], links: any[] } {
    const entities: any[] = [];
    const links: any[] = [];

    if (!data.seen) {
      return { entities, links }; // No data
    }

    // Main classification entity
    const classId = `greynoise-${ip}-${Date.now()}`;
    
    let color = '#6b7280';
    if (data.classification === 'benign') color = '#10b981';
    if (data.classification === 'malicious') color = '#ef4444';

    entities.push({
      id: classId,
      type: 'threat_intel',
      value: `GreyNoise: ${data.classification}`,
      data: {
        label: `GreyNoise: ${data.classification}`,
        type: 'threat_intel',
        color
      },
      properties: {
        source: 'GreyNoise',
        classification: data.classification,
        actor: data.actor,
        first_seen: data.first_seen,
        last_seen: data.last_seen,
        tags: data.tags,
        country: data.metadata.country,
        organization: data.metadata.organization,
        asn: data.metadata.asn,
        tor: data.metadata.tor,
        vpn: data.metadata.vpn
      }
    });

    links.push({
      id: `link-ip-${classId}`,
      source: `ip-${ip}`,
      target: classId,
      label: 'classified as'
    });

    // Organization entity
    if (data.metadata.organization) {
      const orgId = `org-greynoise-${data.metadata.organization}-${Date.now()}`;
      entities.push({
        id: orgId,
        type: 'organization',
        value: data.metadata.organization,
        data: {
          label: data.metadata.organization,
          type: 'organization',
          color: '#10b981'
        },
        properties: {
          asn: data.metadata.asn,
          country: data.metadata.country
        }
      });

      links.push({
        id: `link-ip-${orgId}`,
        source: `ip-${ip}`,
        target: orgId,
        label: 'owned by'
      });
    }

    // Scan activity entities (top 5 ports)
    if (data.raw_data?.scan) {
      data.raw_data.scan.slice(0, 5).forEach((scan, idx) => {
        const scanId = `scan-${ip}-port${scan.port}-${Date.now()}-${idx}`;
        entities.push({
          id: scanId,
          type: 'port',
          value: `${scan.port}/${scan.protocol}`,
          data: {
            label: `Port ${scan.port}/${scan.protocol}`,
            type: 'port',
            color: '#f59e0b'
          },
          properties: {
            port: scan.port,
            protocol: scan.protocol,
            activity: 'scanning'
          }
        });

        links.push({
          id: `link-${classId}-${scanId}`,
          source: classId,
          target: scanId,
          label: 'scans'
        });
      });
    }

    return { entities, links };
  }
}

export const greyNoiseService = new GreyNoiseService();
