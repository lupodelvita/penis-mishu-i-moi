export interface ShodanHost {
  ip: string;
  hostnames: string[];
  organization: string;
  isp: string;
  asn: string;
  country: string;
  city?: string;
  ports: number[];
  vulns?: string[];
  os?: string;
  tags?: string[];
  lastUpdate: string;
}

export interface ShodanPort {
  port: number;
  protocol: string;
  service?: string;
  version?: string;
  product?: string;
  data?: string;
}

export interface ShodanSearchResult {
  total: number;
  matches: ShodanHost[];
}

export class ShodanService {
  private apiKey = process.env.SHODAN_API_KEY;
  private baseUrl = 'https://api.shodan.io';

  /**
   * Check if Shodan API key is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get information about a specific host
   */
  async getHostInfo(ip: string): Promise<ShodanHost | null> {
    if (!this.isConfigured()) {
      console.warn('[ShodanService] SHODAN_API_KEY not configured');
      return null;
    }

    try {
      const url = `${this.baseUrl}/shodan/host/${ip}?key=${this.apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`[ShodanService] No information found for ${ip}`);
          return null;
        }
        throw new Error(`Shodan API error: ${response.status}`);
      }

      const data: any = await response.json();

      // Extract port information
      const ports: number[] = data.ports || [];
      const portDetails: ShodanPort[] = (data.data || []).map((item: any) => ({
        port: item.port,
        protocol: item.transport || 'tcp',
        service: item.product,
        version: item.version,
        data: item.data?.substring(0, 200), // Limit data
      }));

      // Extract vulnerabilities
      const vulns: string[] = [];
      if (data.vulns) {
        vulns.push(...Object.keys(data.vulns));
      }

      return {
        ip: data.ip_str,
        hostnames: data.hostnames || [],
        organization: data.org || 'Unknown',
        isp: data.isp || 'Unknown',
        asn: data.asn || '',
        country: data.country_name || data.country_code || 'Unknown',
        city: data.city,
        ports,
        vulns: vulns.length > 0 ? vulns : undefined,
        os: data.os,
        tags: data.tags,
        lastUpdate: data.last_update,
      };
    } catch (error) {
      console.error('[ShodanService] Host lookup failed:', error);
      throw error;
    }
  }

  /**
   * Search Shodan database
   */
  async search(query: string, page = 1): Promise<ShodanSearchResult | null> {
    if (!this.isConfigured()) {
      console.warn('[ShodanService] SHODAN_API_KEY not configured');
      return null;
    }

    try {
      const url = `${this.baseUrl}/shodan/host/search?key=${this.apiKey}&query=${encodeURIComponent(query)}&page=${page}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Shodan search error: ${response.status}`);
      }

      const data: any = await response.json();

      const matches: ShodanHost[] = (data.matches || []).map((match: any) => ({
        ip: match.ip_str,
        hostnames: match.hostnames || [],
        organization: match.org || 'Unknown',
        isp: match.isp || 'Unknown',
        asn: match.asn || '',
        country: match.location?.country_name || 'Unknown',
        city: match.location?.city,
        ports: match.port ? [match.port] : [],
        os: match.os,
        lastUpdate: match.timestamp,
      }));

      return {
        total: data.total || 0,
        matches,
      };
    } catch (error) {
      console.error('[ShodanService] Search failed:', error);
      throw error;
    }
  }

  /**
   * Get account information (API credits, plan)
   */
  async getAccountInfo(): Promise<any> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const url = `${this.baseUrl}/api-info?key=${this.apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Shodan API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[ShodanService] Account info failed:', error);
      return null;
    }
  }

  /**
   * Convert host info to graph entities
   */
  convertToEntities(host: ShodanHost) {
    const entities: any[] = [];
    const links: any[] = [];

    const hostId = `ip-${host.ip.replace(/\./g, '-')}`;

    // Host entity
    entities.push({
      id: hostId,
      type: 'ip_address',
      value: host.ip,
      data: {
        label: host.ip,
        organization: host.organization,
        isp: host.isp,
        country: host.country,
        city: host.city,
        os: host.os,
        asn: host.asn,
        portsCount: host.ports.length,
        color: '#10b981', // green
      },
    });

    // Organization entity
    if (host.organization && host.organization !== 'Unknown') {
      const orgId = `org-${host.organization.replace(/\s+/g, '-').toLowerCase()}`;
      entities.push({
        id: orgId,
        type: 'organization',
        value: host.organization,
        data: {
          label: host.organization,
          color: '#8b5cf6', // purple
        },
      });

      links.push({
        id: `link-${hostId}-${orgId}`,
        source: hostId,
        target: orgId,
        label: 'belongs to',
      });
    }

    // Port entities
    for (const port of host.ports.slice(0, 10)) { // Limit to 10 ports
      const portId = `port-${host.ip}-${port}`;
      entities.push({
        id: portId,
        type: 'port',
        value: `${port}/tcp`,
        data: {
          label: `Port ${port}`,
          port,
          color: '#3b82f6', // blue
        },
      });

      links.push({
        id: `link-${hostId}-${portId}`,
        source: hostId,
        target: portId,
        label: 'open',
      });
    }

    // Vulnerability entities
    if (host.vulns) {
      for (const vuln of host.vulns.slice(0, 5)) { // Limit to 5 vulns
        const vulnId = `vuln-${vuln.replace(/[^a-zA-Z0-9]/g, '-')}`;
        entities.push({
          id: vulnId,
          type: 'vulnerability',
          value: vuln,
          data: {
            label: vuln,
            cve: vuln,
            color: '#ef4444', // red
          },
        });

        links.push({
          id: `link-${hostId}-${vulnId}`,
          source: hostId,
          target: vulnId,
          label: 'vulnerable to',
        });
      }
    }

    // Hostname entities
    for (const hostname of host.hostnames.slice(0, 3)) {
      const hostnameId = `domain-${hostname.replace(/\./g, '-')}`;
      entities.push({
        id: hostnameId,
        type: 'domain',
        value: hostname,
        data: {
          label: hostname,
          color: '#06b6d4', // cyan
        },
      });

      links.push({
        id: `link-${hostId}-${hostnameId}`,
        source: hostId,
        target: hostnameId,
        label: 'hostname',
      });
    }

    return { entities, links };
  }
}

export const shodanService = new ShodanService();
