/**
 * Censys Service
 * 
 * Internet-wide scan data for hosts, certificates, and websites.
 * 
 * API Documentation: https://search.censys.io/api
 * Free Tier: 250 queries/month
 * API Key: https://search.censys.io/register (free registration, provides API ID + Secret)
 * 
 * Features:
 * - Host search (open ports, services, banners)
 * - Certificate search and transparency
 * - IPv4 address lookup
 * - Domain-associated hosts
 * - Service/protocol discovery
 */

interface CensysHost {
  ip: string;
  services: Array<{
    port: number;
    service_name: string;
    transport_protocol: string;
    certificate?: string;
    banner?: string;
    software?: Array<{ product: string; vendor?: string; version?: string }>;
  }>;
  location?: {
    country: string;
    country_code: string;
    city?: string;
    coordinates?: { latitude: number; longitude: number };
  };
  autonomous_system?: {
    asn: number;
    name: string;
    description: string;
    country_code: string;
  };
  operating_system?: {
    product: string;
    vendor?: string;
    version?: string;
  };
  last_updated_at?: string;
}

interface CensysSearchResult {
  result: {
    query: string;
    total: number;
    hits: Array<{
      ip: string;
      services: Array<{
        port: number;
        service_name: string;
        transport_protocol: string;
      }>;
      location?: {
        country: string;
        country_code: string;
        city?: string;
      };
      autonomous_system?: {
        asn: number;
        name: string;
      };
    }>;
  };
}

interface CensysCertificate {
  fingerprint_sha256: string;
  parsed: {
    subject: {
      common_name?: string[];
      organization?: string[];
    };
    issuer: {
      common_name?: string[];
      organization?: string[];
    };
    validity: {
      start: string;
      end: string;
    };
    names?: string[];
    subject_alt_name?: {
      dns_names?: string[];
    };
  };
}

export class CensysService {
  private apiId?: string;
  private apiSecret?: string;
  private baseUrl = 'https://search.censys.io/api';

  constructor() {
    this.apiId = process.env.CENSYS_API_ID;
    this.apiSecret = process.env.CENSYS_API_SECRET;
  }

  isConfigured(): boolean {
    return !!(this.apiId && this.apiSecret);
  }

  private getAuthHeader(): string {
    return 'Basic ' + Buffer.from(`${this.apiId}:${this.apiSecret}`).toString('base64');
  }

  /**
   * Get host information by IP
   */
  async getHost(ip: string): Promise<CensysHost | null> {
    if (!this.isConfigured()) throw new Error('Censys API not configured');

    try {
      const response = await fetch(`${this.baseUrl}/v2/hosts/${ip}`, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Censys API error: ${response.status}`);
      }

      const data = await response.json();
      return data.result;
    } catch (error: any) {
      console.error('Censys host lookup failed:', error.message);
      return null;
    }
  }

  /**
   * Search hosts by query (e.g., domain, service, port)
   */
  async searchHosts(query: string, perPage: number = 25): Promise<CensysSearchResult | null> {
    if (!this.isConfigured()) throw new Error('Censys API not configured');

    try {
      const response = await fetch(`${this.baseUrl}/v2/hosts/search`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: query,
          per_page: perPage
        })
      });

      if (!response.ok) {
        throw new Error(`Censys API error: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Censys host search failed:', error.message);
      return null;
    }
  }

  /**
   * Search for certificates
   */
  async searchCertificates(domain: string, perPage: number = 25): Promise<CensysCertificate[] | null> {
    if (!this.isConfigured()) throw new Error('Censys API not configured');

    try {
      const response = await fetch(`${this.baseUrl}/v2/certificates/search`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: `parsed.names: ${domain}`,
          per_page: perPage
        })
      });

      if (!response.ok) {
        throw new Error(`Censys API error: ${response.status}`);
      }

      const data = await response.json();
      return data.result?.hits || [];
    } catch (error: any) {
      console.error('Censys certificate search failed:', error.message);
      return null;
    }
  }

  /**
   * Convert host data to graph entities
   */
  convertHostToEntities(host: CensysHost, sourceIP: string): { entities: any[]; links: any[] } {
    const entities: any[] = [];
    const links: any[] = [];
    const seen = new Set<string>();

    // Open ports and services
    if (host.services) {
      for (const service of host.services) {
        const portKey = `${service.port}/${service.transport_protocol}`;
        if (!seen.has(portKey)) {
          seen.add(portKey);
          entities.push({
            type: 'port',
            value: portKey,
            data: { label: `${service.service_name} (${portKey})` },
            properties: {
              source: 'Censys',
              service_name: service.service_name,
              port: service.port,
              protocol: service.transport_protocol,
              software: service.software?.map(s => `${s.vendor || ''} ${s.product} ${s.version || ''}`.trim())
            },
            link: { label: 'open port' }
          });
        }
      }
    }

    // Location
    if (host.location?.country) {
      const locKey = `${host.location.city || ''}, ${host.location.country}`.replace(/^, /, '');
      if (!seen.has(locKey)) {
        seen.add(locKey);
        entities.push({
          type: 'location',
          value: locKey,
          properties: {
            source: 'Censys',
            country_code: host.location.country_code,
            coordinates: host.location.coordinates
          },
          link: { label: 'located in' }
        });
      }
    }

    // AS Owner
    if (host.autonomous_system?.name) {
      const asKey = `AS${host.autonomous_system.asn}`;
      if (!seen.has(asKey)) {
        seen.add(asKey);
        entities.push({
          type: 'organization',
          value: `${host.autonomous_system.name} (${asKey})`,
          properties: {
            source: 'Censys',
            asn: host.autonomous_system.asn,
            description: host.autonomous_system.description
          },
          link: { label: 'AS owner' }
        });
      }
    }

    // Operating system
    if (host.operating_system?.product) {
      const osKey = host.operating_system.product;
      if (!seen.has(osKey)) {
        seen.add(osKey);
        entities.push({
          type: 'technology',
          value: `${host.operating_system.vendor || ''} ${host.operating_system.product} ${host.operating_system.version || ''}`.trim(),
          properties: { source: 'Censys' },
          link: { label: 'runs OS' }
        });
      }
    }

    return { entities, links };
  }

  /**
   * Convert search results to graph entities
   */
  convertSearchToEntities(result: CensysSearchResult, query: string): { entities: any[]; links: any[] } {
    const entities: any[] = [];
    const links: any[] = [];
    const seen = new Set<string>();

    for (const hit of result.result.hits.slice(0, 30)) {
      if (!seen.has(hit.ip)) {
        seen.add(hit.ip);
        const services = hit.services.map(s => `${s.service_name}:${s.port}`).join(', ');
        entities.push({
          type: 'ip_address',
          value: hit.ip,
          properties: {
            source: 'Censys',
            services,
            country: hit.location?.country,
            asn: hit.autonomous_system?.asn,
            as_name: hit.autonomous_system?.name
          },
          link: { label: 'hosts' }
        });
      }
    }

    return { entities, links };
  }
}

export const censysService = new CensysService();
