/**
 * SecurityTrails Service
 * 
 * Historical DNS and WHOIS data, domain intelligence, and IP associations.
 * 
 * API Documentation: https://securitytrails.com/corp/api
 * Free Tier: 50 queries/month
 * API Key: https://securitytrails.com/app/signup (free registration)
 * 
 * Features:
 * - Domain DNS history (A, AAAA, MX, NS, SOA, TXT records)
 * - Subdomain discovery
 * - WHOIS history
 * - Associated domains (same IP, NS, MX)
 * - IP neighbors
 * - Domain statistics
 */

interface SecurityTrailsDomainInfo {
  hostname: string;
  current_dns: {
    a?: { values: Array<{ ip: string; ip_count?: number }> };
    aaaa?: { values: Array<{ ipv6: string }> };
    mx?: { values: Array<{ hostname: string; priority: number }> };
    ns?: { values: Array<{ nameserver: string }> };
    soa?: { values: Array<{ email: string; ttl: number }> };
    txt?: { values: Array<{ value: string }> };
  };
  alexa_rank?: number;
  apex_domain?: string;
  subdomain_count?: number;
}

interface SecurityTrailsSubdomains {
  subdomains: string[];
  subdomain_count: number;
  endpoint: string;
}

interface SecurityTrailsDNSHistory {
  type: string;
  records: Array<{
    values: Array<{ ip?: string; ip_count?: number }>;
    organizations: string[];
    first_seen: string;
    last_seen: string;
  }>;
  pages: number;
}

interface SecurityTrailsAssociatedDomains {
  records: Array<{
    hostname: string;
    alexa_rank?: number;
    whois?: {
      registrar: string;
      created_date?: string;
    };
  }>;
  record_count: number;
}

interface SecurityTrailsIPNeighbors {
  blocks: Record<string, {
    hostnames: string[];
    sites: number;
  }>;
}

export class SecurityTrailsService {
  private apiKey?: string;
  private baseUrl = 'https://api.securitytrails.com/v1';

  constructor() {
    this.apiKey = process.env.SECURITYTRAILS_API_KEY;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get domain information including current DNS records
   */
  async getDomain(domain: string): Promise<SecurityTrailsDomainInfo | null> {
    if (!this.apiKey) throw new Error('SecurityTrails API key not configured');

    try {
      const response = await fetch(`${this.baseUrl}/domain/${domain}`, {
        headers: { 'APIKEY': this.apiKey, 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`SecurityTrails API error: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('SecurityTrails domain lookup failed:', error.message);
      return null;
    }
  }

  /**
   * List subdomains for a domain
   */
  async getSubdomains(domain: string): Promise<SecurityTrailsSubdomains | null> {
    if (!this.apiKey) throw new Error('SecurityTrails API key not configured');

    try {
      const response = await fetch(`${this.baseUrl}/domain/${domain}/subdomains?children_only=false`, {
        headers: { 'APIKEY': this.apiKey, 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`SecurityTrails API error: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('SecurityTrails subdomains failed:', error.message);
      return null;
    }
  }

  /**
   * Get DNS history for a domain (A records by default)
   */
  async getDNSHistory(domain: string, type: string = 'a'): Promise<SecurityTrailsDNSHistory | null> {
    if (!this.apiKey) throw new Error('SecurityTrails API key not configured');

    try {
      const response = await fetch(`${this.baseUrl}/history/${domain}/dns/${type}`, {
        headers: { 'APIKEY': this.apiKey, 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`SecurityTrails API error: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('SecurityTrails DNS history failed:', error.message);
      return null;
    }
  }

  /**
   * Get associated domains (same IP, NS, or MX)
   */
  async getAssociatedDomains(domain: string): Promise<SecurityTrailsAssociatedDomains | null> {
    if (!this.apiKey) throw new Error('SecurityTrails API key not configured');

    try {
      const response = await fetch(`${this.baseUrl}/domain/${domain}/associated`, {
        headers: { 'APIKEY': this.apiKey, 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`SecurityTrails API error: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('SecurityTrails associated domains failed:', error.message);
      return null;
    }
  }

  /**
   * Get IP neighbors (domains on nearby IPs)
   */
  async getIPNeighbors(ip: string): Promise<SecurityTrailsIPNeighbors | null> {
    if (!this.apiKey) throw new Error('SecurityTrails API key not configured');

    try {
      const response = await fetch(`${this.baseUrl}/ips/nearby/${ip}`, {
        headers: { 'APIKEY': this.apiKey, 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`SecurityTrails API error: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('SecurityTrails IP neighbors failed:', error.message);
      return null;
    }
  }

  /**
   * Convert domain info to graph entities
   */
  convertDomainToEntities(data: SecurityTrailsDomainInfo, sourceDomain: string): { entities: any[]; links: any[] } {
    const entities: any[] = [];
    const links: any[] = [];
    const seen = new Set<string>();

    // A records
    if (data.current_dns?.a?.values) {
      for (const record of data.current_dns.a.values.slice(0, 20)) {
        if (record.ip && !seen.has(record.ip)) {
          seen.add(record.ip);
          entities.push({
            type: 'ip_address',
            value: record.ip,
            properties: { source: 'SecurityTrails', record_type: 'A' },
            link: { label: 'resolves to' }
          });
        }
      }
    }

    // MX records
    if (data.current_dns?.mx?.values) {
      for (const record of data.current_dns.mx.values.slice(0, 10)) {
        if (record.hostname && !seen.has(record.hostname)) {
          seen.add(record.hostname);
          entities.push({
            type: 'domain',
            value: record.hostname,
            properties: { source: 'SecurityTrails', record_type: 'MX', priority: record.priority },
            link: { label: 'mail server' }
          });
        }
      }
    }

    // NS records
    if (data.current_dns?.ns?.values) {
      for (const record of data.current_dns.ns.values.slice(0, 10)) {
        if (record.nameserver && !seen.has(record.nameserver)) {
          seen.add(record.nameserver);
          entities.push({
            type: 'domain',
            value: record.nameserver,
            properties: { source: 'SecurityTrails', record_type: 'NS' },
            link: { label: 'name server' }
          });
        }
      }
    }

    return { entities, links };
  }

  /**
   * Convert subdomains to graph entities
   */
  convertSubdomainsToEntities(data: SecurityTrailsSubdomains, parentDomain: string): { entities: any[]; links: any[] } {
    const entities: any[] = [];
    const links: any[] = [];

    for (const subdomain of data.subdomains.slice(0, 50)) {
      const fullDomain = `${subdomain}.${parentDomain}`;
      entities.push({
        type: 'subdomain',
        value: fullDomain,
        properties: { source: 'SecurityTrails', parent_domain: parentDomain },
        link: { label: 'subdomain' }
      });
    }

    return { entities, links };
  }

  /**
   * Convert DNS history to graph entities
   */
  convertDNSHistoryToEntities(data: SecurityTrailsDNSHistory, domain: string): { entities: any[]; links: any[] } {
    const entities: any[] = [];
    const links: any[] = [];
    const seen = new Set<string>();

    for (const record of data.records.slice(0, 30)) {
      for (const value of record.values) {
        const ip = value.ip;
        if (ip && !seen.has(ip)) {
          seen.add(ip);
          entities.push({
            type: 'ip_address',
            value: ip,
            properties: {
              source: 'SecurityTrails',
              first_seen: record.first_seen,
              last_seen: record.last_seen,
              organizations: record.organizations
            },
            link: { label: `historical DNS (${record.first_seen} → ${record.last_seen})` }
          });
        }
      }
    }

    return { entities, links };
  }

  /**
   * Convert associated domains to graph entities
   */
  convertAssociatedToEntities(data: SecurityTrailsAssociatedDomains, sourceDomain: string): { entities: any[]; links: any[] } {
    const entities: any[] = [];
    const links: any[] = [];

    for (const record of data.records.slice(0, 30)) {
      if (record.hostname && record.hostname !== sourceDomain) {
        entities.push({
          type: 'domain',
          value: record.hostname,
          properties: {
            source: 'SecurityTrails',
            alexa_rank: record.alexa_rank,
            registrar: record.whois?.registrar,
            created_date: record.whois?.created_date
          },
          link: { label: 'associated domain' }
        });
      }
    }

    return { entities, links };
  }

  /**
   * Convert IP neighbors to graph entities
   */
  convertIPNeighborsToEntities(data: SecurityTrailsIPNeighbors, sourceIP: string): { entities: any[]; links: any[] } {
    const entities: any[] = [];
    const links: any[] = [];

    for (const [cidr, block] of Object.entries(data.blocks)) {
      for (const hostname of block.hostnames.slice(0, 20)) {
        entities.push({
          type: 'domain',
          value: hostname,
          properties: { source: 'SecurityTrails', cidr_block: cidr, sites_in_block: block.sites },
          link: { label: 'IP neighbor' }
        });
      }
    }

    return { entities, links };
  }
}

export const securityTrailsService = new SecurityTrailsService();
