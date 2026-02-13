/**
 * BinaryEdge Service
 * 
 * Internet-scale scanning platform with host, domain, and risk scoring data.
 * 
 * API Documentation: https://docs.binaryedge.io/
 * Free Tier: 250 queries/month
 * API Key: https://app.binaryedge.io/sign-up (free registration)
 * 
 * Features:
 * - Host information (open ports, services, vulnerabilities)
 * - Domain DNS and subdomains
 * - Risk scoring
 * - CVE/vulnerability detection on services
 * - Torrent/dataleaks associations
 */

interface BinaryEdgeHostTarget {
  port: number;
  protocol: string;
  results: Array<{
    target: { ip: string; port: number; protocol: string };
    result: {
      data: {
        service: {
          name: string;
          product?: string;
          version?: string;
          banner?: string;
          cpe?: string[];
        };
        state: { state: string };
      };
    };
  }>;
}

interface BinaryEdgeHostResponse {
  total: number;
  query: string;
  events: BinaryEdgeHostTarget[];
}

interface BinaryEdgeDomainResponse {
  query: string;
  page: number;
  pagesize: number;
  total: number;
  events: string[];
}

interface BinaryEdgeRiskScore {
  normalized_ip_score: number;
  normalized_ip_score_detailed: {
    cve: number;
    attack_surface: number;
    encryption: number;
    rms: number;
    storage: number;
    web: number;
    torrent: number;
  };
  results_detailed: {
    ports: Array<{ port: number; protocol: string; score: number }>;
    cve: Array<{ cve: string; cvss: number }>;
  };
  ip: string;
}

interface BinaryEdgeDomainDNS {
  query: string;
  events: Array<{
    A?: string[];
    AAAA?: string[];
    MX?: string[];
    NS?: string[];
    updated_at: string;
  }>;
}

export class BinaryEdgeService {
  private apiKey?: string;
  private baseUrl = 'https://api.binaryedge.io/v2';

  constructor() {
    this.apiKey = process.env.BINARYEDGE_API_KEY;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get host information (ports, services, vulnerabilities)
   */
  async getHost(ip: string): Promise<BinaryEdgeHostResponse | null> {
    if (!this.apiKey) throw new Error('BinaryEdge API key not configured');

    try {
      const response = await fetch(`${this.baseUrl}/query/ip/${ip}`, {
        headers: { 'X-Key': this.apiKey }
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`BinaryEdge API error: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('BinaryEdge host lookup failed:', error.message);
      return null;
    }
  }

  /**
   * Get risk score for an IP
   */
  async getRiskScore(ip: string): Promise<BinaryEdgeRiskScore | null> {
    if (!this.apiKey) throw new Error('BinaryEdge API key not configured');

    try {
      const response = await fetch(`${this.baseUrl}/query/score/ip/${ip}`, {
        headers: { 'X-Key': this.apiKey }
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`BinaryEdge API error: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('BinaryEdge risk score failed:', error.message);
      return null;
    }
  }

  /**
   * Get subdomains for a domain
   */
  async getSubdomains(domain: string, page: number = 1): Promise<BinaryEdgeDomainResponse | null> {
    if (!this.apiKey) throw new Error('BinaryEdge API key not configured');

    try {
      const response = await fetch(`${this.baseUrl}/query/domains/subdomain/${domain}?page=${page}`, {
        headers: { 'X-Key': this.apiKey }
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`BinaryEdge API error: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('BinaryEdge subdomains failed:', error.message);
      return null;
    }
  }

  /**
   * Get DNS records for a domain
   */
  async getDomainDNS(domain: string): Promise<BinaryEdgeDomainDNS | null> {
    if (!this.apiKey) throw new Error('BinaryEdge API key not configured');

    try {
      const response = await fetch(`${this.baseUrl}/query/domains/dns/${domain}`, {
        headers: { 'X-Key': this.apiKey }
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`BinaryEdge API error: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('BinaryEdge DNS failed:', error.message);
      return null;
    }
  }

  /**
   * Search hosts by query
   */
  async searchHosts(query: string, page: number = 1): Promise<BinaryEdgeHostResponse | null> {
    if (!this.apiKey) throw new Error('BinaryEdge API key not configured');

    try {
      const response = await fetch(`${this.baseUrl}/query/search?query=${encodeURIComponent(query)}&page=${page}`, {
        headers: { 'X-Key': this.apiKey }
      });

      if (!response.ok) {
        throw new Error(`BinaryEdge API error: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('BinaryEdge search failed:', error.message);
      return null;
    }
  }

  /**
   * Convert host data to graph entities
   */
  convertHostToEntities(data: BinaryEdgeHostResponse, sourceIP: string, riskScore?: BinaryEdgeRiskScore | null): { entities: any[]; links: any[] } {
    const entities: any[] = [];
    const links: any[] = [];
    const seen = new Set<string>();

    // Services and ports
    for (const event of data.events) {
      const portKey = `${event.port}/${event.protocol}`;
      if (!seen.has(portKey)) {
        seen.add(portKey);
        const firstResult = event.results?.[0]?.result?.data?.service;
        entities.push({
          type: 'port',
          value: portKey,
          data: { label: `${firstResult?.name || 'unknown'} (${portKey})` },
          properties: {
            source: 'BinaryEdge',
            service: firstResult?.name,
            product: firstResult?.product,
            version: firstResult?.version,
            cpe: firstResult?.cpe
          },
          link: { label: 'open port' }
        });
      }
    }

    // Risk score entity
    if (riskScore) {
      entities.push({
        type: 'threat_intel',
        value: `Risk Score: ${(riskScore.normalized_ip_score * 100).toFixed(0)}%`,
        properties: {
          source: 'BinaryEdge',
          cve_score: riskScore.normalized_ip_score_detailed.cve,
          attack_surface: riskScore.normalized_ip_score_detailed.attack_surface,
          encryption: riskScore.normalized_ip_score_detailed.encryption
        },
        link: { label: 'risk assessment' }
      });

      // CVEs
      if (riskScore.results_detailed?.cve) {
        for (const cve of riskScore.results_detailed.cve.slice(0, 15)) {
          if (!seen.has(cve.cve)) {
            seen.add(cve.cve);
            entities.push({
              type: 'vulnerability',
              value: cve.cve,
              properties: { source: 'BinaryEdge', cvss: cve.cvss },
              link: { label: 'vulnerable to' }
            });
          }
        }
      }
    }

    return { entities, links };
  }

  /**
   * Convert subdomains to graph entities
   */
  convertSubdomainsToEntities(data: BinaryEdgeDomainResponse, parentDomain: string): { entities: any[]; links: any[] } {
    const entities: any[] = [];
    const links: any[] = [];

    for (const subdomain of data.events.slice(0, 50)) {
      entities.push({
        type: 'subdomain',
        value: subdomain,
        properties: { source: 'BinaryEdge', parent_domain: parentDomain },
        link: { label: 'subdomain' }
      });
    }

    return { entities, links };
  }

  /**
   * Convert DNS to entities
   */
  convertDNSToEntities(data: BinaryEdgeDomainDNS, domain: string): { entities: any[]; links: any[] } {
    const entities: any[] = [];
    const links: any[] = [];
    const seen = new Set<string>();

    for (const event of data.events) {
      // A records
      if (event.A) {
        for (const ip of event.A) {
          if (!seen.has(ip)) {
            seen.add(ip);
            entities.push({
              type: 'ip_address',
              value: ip,
              properties: { source: 'BinaryEdge', record_type: 'A', updated_at: event.updated_at },
              link: { label: 'resolves to' }
            });
          }
        }
      }

      // MX records
      if (event.MX) {
        for (const mx of event.MX) {
          if (!seen.has(mx)) {
            seen.add(mx);
            entities.push({
              type: 'domain',
              value: mx,
              properties: { source: 'BinaryEdge', record_type: 'MX' },
              link: { label: 'mail server' }
            });
          }
        }
      }

      // NS records
      if (event.NS) {
        for (const ns of event.NS) {
          if (!seen.has(ns)) {
            seen.add(ns);
            entities.push({
              type: 'domain',
              value: ns,
              properties: { source: 'BinaryEdge', record_type: 'NS' },
              link: { label: 'name server' }
            });
          }
        }
      }
    }

    return { entities, links };
  }
}

export const binaryEdgeService = new BinaryEdgeService();
