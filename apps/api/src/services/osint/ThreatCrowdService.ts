/**
 * ThreatCrowd API Integration
 * Free threat intelligence aggregation
 * API: https://threatcrowd.org/
 */

export interface ThreatCrowdDomain {
  votes: number;
  resolutions: Array<{
    ip_address: string;
    last_resolved: string;
  }>;
  subdomains: string[];
  emails: string[];
  references: string[];
}

export interface ThreatCrowdIP {
  votes: number;
  resolutions: Array<{
    domain: string;
    last_resolved: string;
  }>;
  hashes: string[];
  references: string[];
}

export class ThreatCrowdService {
  private baseUrl = 'https://www.threatcrowd.org/searchApi/v2';

  /**
   * Search domain
   */
  async searchDomain(domain: string): Promise<ThreatCrowdDomain | null> {
    try {
      const url = `${this.baseUrl}/domain/report/?domain=${domain}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'NodeWeaver-OSINT',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data: any = await response.json();

      if (data.response_code !== '1') {
        return null;
      }

      return {
        votes: data.votes || 0,
        resolutions: data.resolutions || [],
        subdomains: data.subdomains || [],
        emails: data.emails || [],
        references: data.references || [],
      };
    } catch (error: any) {
      console.error('[ThreatCrowd] Domain search failed:', error.message);
      return null;
    }
  }

  /**
   * Search IP address
   */
  async searchIP(ip: string): Promise<ThreatCrowdIP | null> {
    try {
      const url = `${this.baseUrl}/ip/report/?ip=${ip}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'NodeWeaver-OSINT',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data: any = await response.json();

      if (data.response_code !== '1') {
        return null;
      }

      return {
        votes: data.votes || 0,
        resolutions: data.resolutions || [],
        hashes: data.hashes || [],
        references: data.references || [],
      };
    } catch (error: any) {
      console.error('[ThreatCrowd] IP search failed:', error.message);
      return null;
    }
  }

  /**
   * Convert ThreatCrowd domain data to graph entities
   */
  convertDomainToEntities(domain: string, data: ThreatCrowdDomain): {
    entities: any[];
    links: any[];
  } {
    const entities: any[] = [];
    const links: any[] = [];

    // Create IP entities from resolutions
    data.resolutions.slice(0, 10).forEach((resolution) => {
      const ipEntity = {
        id: `ip-${resolution.ip_address}`,
        type: 'ip_address',
        value: resolution.ip_address,
        properties: {
          lastResolved: resolution.last_resolved,
        },
        metadata: {
          source: 'ThreatCrowd',
          created: new Date().toISOString(),
        },
      };

      entities.push(ipEntity);

      links.push({
        id: `link-${domain}-${ipEntity.id}`,
        source: domain,
        target: ipEntity.id,
        label: 'resolves_to',
      });
    });

    // Create subdomain entities
    data.subdomains.slice(0, 20).forEach((subdomain) => {
      const subdomainEntity = {
        id: `domain-${subdomain}`,
        type: 'domain',
        value: subdomain,
        properties: {
          parent: domain,
        },
        metadata: {
          source: 'ThreatCrowd',
          created: new Date().toISOString(),
        },
      };

      entities.push(subdomainEntity);

      links.push({
        id: `link-${domain}-${subdomainEntity.id}`,
        source: domain,
        target: subdomainEntity.id,
        label: 'subdomain',
      });
    });

    // Create email entities
    data.emails.forEach((email) => {
      const emailEntity = {
        id: `email-${email}`,
        type: 'email',
        value: email,
        properties: {
          domain,
        },
        metadata: {
          source: 'ThreatCrowd',
          created: new Date().toISOString(),
        },
      };

      entities.push(emailEntity);

      links.push({
        id: `link-${domain}-${emailEntity.id}`,
        source: domain,
        target: emailEntity.id,
        label: 'associated_email',
      });
    });

    return { entities, links };
  }

  /**
   * Convert ThreatCrowd IP data to graph entities
   */
  convertIPToEntities(ip: string, data: ThreatCrowdIP): {
    entities: any[];
    links: any[];
  } {
    const entities: any[] = [];
    const links: any[] = [];

    // Create domain entities from resolutions
    data.resolutions.slice(0, 15).forEach((resolution) => {
      const domainEntity = {
        id: `domain-${resolution.domain}`,
        type: 'domain',
        value: resolution.domain,
        properties: {
          lastResolved: resolution.last_resolved,
        },
        metadata: {
          source: 'ThreatCrowd',
          created: new Date().toISOString(),
        },
      };

      entities.push(domainEntity);

      links.push({
        id: `link-${ip}-${domainEntity.id}`,
        source: ip,
        target: domainEntity.id,
        label: 'hosts',
      });
    });

    // Create hash entities (malware samples)
    data.hashes.slice(0, 10).forEach((hash) => {
      const hashEntity = {
        id: `hash-${hash}`,
        type: 'file_hash',
        value: hash,
        properties: {
          ipSource: ip,
        },
        metadata: {
          source: 'ThreatCrowd',
          created: new Date().toISOString(),
        },
      };

      entities.push(hashEntity);

      links.push({
        id: `link-${ip}-${hashEntity.id}`,
        source: ip,
        target: hashEntity.id,
        label: 'associated_malware',
      });
    });

    return { entities, links };
  }
}

export const threatCrowdService = new ThreatCrowdService();
