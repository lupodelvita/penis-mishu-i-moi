import dns from 'dns';
import { promisify } from 'util';

const resolveDns = promisify(dns.resolve);
const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);
const resolveCname = promisify(dns.resolveCname);

export interface WhoisResult {
  domain: string;
  registrar?: string;
  registrant?: {
    name?: string;
    organization?: string;
    email?: string;
  };
  createdDate?: string;
  expiresDate?: string;
  updatedDate?: string;
  nameServers?: string[];
  dnssec?: boolean;
  status?: string[];
}

export interface DNSRecords {
  a?: string[];
  aaaa?: string[];
  mx?: Array<{ exchange: string; priority: number }>;
  txt?: string[][];
  cname?: string[];
  ns?: string[];
}

export class WhoisService {
  private ip2whoisApiKey = process.env.IP2WHOIS_API_KEY;
  private ip2whoisUrl = 'https://api.ip2whois.com/v2';

  /**
   * Perform WHOIS lookup using IP2WHOIS API
   */
  async whoisLookup(domain: string): Promise<WhoisResult | null> {
    // Try API first if key exists
    if (this.ip2whoisApiKey) {
      try {
        const url = `${this.ip2whoisUrl}?key=${this.ip2whoisApiKey}&domain=${domain}`;
        const response = await fetch(url);
        
        if (response.ok) {
          const data: any = await response.json();
          return {
            domain: data.domain || domain,
            registrar: data.registrar,
            registrant: {
              name: data.registrant?.name,
              organization: data.registrant?.organization,
              email: data.registrant?.email,
            },
            createdDate: data.create_date,
            expiresDate: data.expire_date,
            updatedDate: data.update_date,
            nameServers: data.nameservers || [],
            dnssec: data.dnssec === 'yes',
            status: data.status || [],
          };
        }
      } catch (error) {
        console.warn('[WhoisService] IP2WHOIS API failed, falling back to system whois', error);
      }
    }

    // Fallback to system WHOIS
    return this.systemWhoisLookup(domain);
  }

  /**
   * Execute system whois command and parse output
   */
  private async systemWhoisLookup(domain: string): Promise<WhoisResult | null> {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      // Timeout 10s
      const { stdout } = await execAsync(`whois ${domain}`, { timeout: 10000 });
      
      const text = stdout as string;
      
      // Basic Regex Parsing for common fields
      const registrar = text.match(/Registrar:\s*(.+)/i)?.[1]?.trim() || 
                        text.match(/Registrar Name:\s*(.+)/i)?.[1]?.trim();
                        
      const createdDate = text.match(/Creation Date:\s*(.+)/i)?.[1]?.trim() || 
                          text.match(/Registered on:\s*(.+)/i)?.[1]?.trim();
                          
      const expiresDate = text.match(/Registry Expiry Date:\s*(.+)/i)?.[1]?.trim() || 
                          text.match(/Expires on:\s*(.+)/i)?.[1]?.trim();
                          
      const updatedDate = text.match(/Updated Date:\s*(.+)/i)?.[1]?.trim() || 
                          text.match(/Last Updated on:\s*(.+)/i)?.[1]?.trim();

      const nameServers: string[] = [];
      const nsRegex = /Name Server:\s*(.+)/gi;
      let match;
      while ((match = nsRegex.exec(text)) !== null) {
        nameServers.push(match[1].trim().toLowerCase());
      }

      return {
        domain,
        registrar,
        createdDate,
        expiresDate,
        updatedDate,
        nameServers: [...new Set(nameServers)], // unique
        status: ['Active'], // Assumption if whois succeeds
        registrant: {
           organization: text.match(/Registrant Organization:\s*(.+)/i)?.[1]?.trim()
        }
      };

    } catch (error) {
      console.error('[WhoisService] System WHOIS failed:', error);
      return null;
    }
  }

  /**
   * Get DNS records for a domain
   */
  async getDNSRecords(domain: string): Promise<DNSRecords> {
    const records: DNSRecords = {};

    try {
      // A records (IPv4)
      try {
        records.a = await resolveDns(domain, 'A') as string[];
      } catch (e) {
        // Domain might not have A records
      }

      // AAAA records (IPv6)
      try {
        records.aaaa = await resolveDns(domain, 'AAAA') as string[];
      } catch (e) {
        // Domain might not have AAAA records
      }

      // MX records (Mail servers)
      try {
        records.mx = await resolveMx(domain);
      } catch (e) {
        // No MX records
      }

      // TXT records
      try {
        records.txt = await resolveTxt(domain);
      } catch (e) {
        // No TXT records
      }

      // CNAME records
      try {
        records.cname = await resolveCname(domain);
      } catch (e) {
        // No CNAME
      }

      // NS records (Nameservers)
      try {
        records.ns = await resolveDns(domain, 'NS') as string[];
      } catch (e) {
        // No NS records
      }

    } catch (error) {
      console.error('[WhoisService] DNS resolution failed:', error);
    }

    return records;
  }

  /**
   * Combine WHOIS and DNS data for comprehensive domain intelligence
   */
  async getDomainIntelligence(domain: string) {
    const [whois, dns] = await Promise.all([
      this.whoisLookup(domain),
      this.getDNSRecords(domain),
    ]);

    return {
      domain,
      whois,
      dns,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Convert domain intelligence to graph entities
   */
  convertToEntities(domainIntel: any) {
    const entities: any[] = [];
    const links: any[] = [];
    const { domain, whois, dns } = domainIntel;

    const domainId = `domain-${domain}`;

    // Domain entity
    entities.push({
      id: domainId,
      type: 'domain',
      value: domain,
      data: {
        label: domain,
        registrar: whois?.registrar,
        created: whois?.createdDate,
        expires: whois?.expiresDate,
        color: '#3b82f6', // blue
      },
    });

    // Registrar entity
    if (whois?.registrar) {
      const registrarId = `org-${whois.registrar.replace(/\s+/g, '-')}`;
      entities.push({
        id: registrarId,
        type: 'organization',
        value: whois.registrar,
        data: {
          label: whois.registrar,
          role: 'Registrar',
          color: '#8b5cf6', // purple
        },
      });

      links.push({
        id: `link-${domainId}-${registrarId}`,
        source: domainId,
        target: registrarId,
        label: 'registered by',
      });
    }

    // Registrant organization
    if (whois?.registrant?.organization) {
      const orgId = `org-${whois.registrant.organization.replace(/\s+/g, '-')}`;
      entities.push({
        id: orgId,
        type: 'organization',
        value: whois.registrant.organization,
        data: {
          label: whois.registrant.organization,
          role: 'Registrant',
          color: '#8b5cf6',
        },
      });

      links.push({
        id: `link-${domainId}-${orgId}`,
        source: domainId,
        target: orgId,
        label: 'owned by',
      });
    }

    // Registrant email
    if (whois?.registrant?.email) {
      const emailId = `email-${whois.registrant.email}`;
      entities.push({
        id: emailId,
        type: 'email_address',
        value: whois.registrant.email,
        data: {
          label: whois.registrant.email,
          source: 'WHOIS',
          color: '#ec4899', // pink
        },
      });

      links.push({
        id: `link-${domainId}-${emailId}`,
        source: domainId,
        target: emailId,
        label: 'contact email',
      });
    }

    // Nameservers
    if (whois?.nameServers) {
      for (const ns of whois.nameServers.slice(0, 4)) {
        const nsId = `ns-${ns}`;
        entities.push({
          id: nsId,
          type: 'domain',
          value: ns,
          data: {
            label: ns,
            recordType: 'NS',
            color: '#10b981', // green
          },
        });

        links.push({
          id: `link-${domainId}-${nsId}`,
          source: domainId,
          target: nsId,
          label: 'nameserver',
        });
      }
    }

    // A records (IP addresses)
    if (dns?.a) {
      for (const ip of dns.a) {
        const ipId = `ip-${ip}`;
        entities.push({
          id: ipId,
          type: 'ip_address',
          value: ip,
          data: {
            label: ip,
            recordType: 'A',
            color: '#f59e0b', // orange
          },
        });

        links.push({
          id: `link-${domainId}-${ipId}`,
          source: domainId,
          target: ipId,
          label: 'resolves to',
        });
      }
    }

    // MX records (Mail servers)
    if (dns?.mx) {
      for (const mx of dns.mx.slice(0, 3)) {
        const mxId = `mx-${mx.exchange}`;
        entities.push({
          id: mxId,
          type: 'domain',
          value: mx.exchange,
          data: {
            label: mx.exchange,
            recordType: 'MX',
            priority: mx.priority,
            color: '#06b6d4', // cyan
          },
        });

        links.push({
          id: `link-${domainId}-${mxId}`,
          source: domainId,
          target: mxId,
          label: `mail (priority ${mx.priority})`,
        });
      }
    }

    return { entities, links };
  }
}

export const whoisService = new WhoisService();
