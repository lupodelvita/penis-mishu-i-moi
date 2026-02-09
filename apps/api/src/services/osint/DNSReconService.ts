import dns from 'dns';
import { promisify } from 'util';

const resolveDns = promisify(dns.resolve);
const resolveDns4 = promisify(dns.resolve4);

export interface SubdomainResult {
  subdomain: string;
  ipAddresses: string[];
  exists: boolean;
}

export interface DNSReconResult {
  domain: string;
  totalFound: number;
  subdomains: SubdomainResult[];
  timestamp: string;
}

export class DNSReconService {
  /**
   * Common subdomain wordlist for bruteforce
   */
  private commonSubdomains = [
    'www', 'mail', 'remote', 'blog', 'webmail', 'server', 'ns', 'ns1', 'ns2',
    'smtp', 'secure', 'vpn', 'admin', 'portal', 'dev', 'staging', 'test',
    'api', 'cdn', 'ftp', 'mysql', 'ssh', 'shop', 'forum', 'beta', 'mobile',
    'mx', 'mx1', 'mx2', 'app', 'store', 'cloud', 'git', 'exchange', 'local',
    'static', 'files', 'upload', 'media', 'assets', 'img', 'images', 'video',
    'demo', 'old', 'new', 'backup', 'crm', 'cms', 'support', 'help', 'docs',
    'wiki', 'status', 'intranet', 'extranet', 'members', 'partner', 'partners',
    'billing', 'payment', 'checkout', 'cart', 'secure-payment', 'login',
    'register', 'dashboard', 'cpanel', 'webdisk', 'whm', 'autodiscover',
    'autoconfig', 'imap', 'pop', 'pop3', 'smtp', 'relay', 'gateway',
  ];

  /**
   * Enumerate subdomains for a given domain
   */
  async enumerateSubdomains(
    domain: string,
    customWordlist?: string[],
    maxConcurrent = 20
  ): Promise<DNSReconResult> {
    const wordlist = customWordlist || this.commonSubdomains;
    const results: SubdomainResult[] = [];

    console.log(`[DNSRecon] Starting enumeration for ${domain} with ${wordlist.length} subdomains`);

    // Process in batches to avoid overwhelming DNS resolver
    for (let i = 0; i < wordlist.length; i += maxConcurrent) {
      const batch = wordlist.slice(i, i + maxConcurrent);
      const batchResults = await Promise.allSettled(
        batch.map(sub => this.checkSubdomain(sub, domain))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value.exists) {
          results.push(result.value);
        }
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`[DNSRecon] Found ${results.length} valid subdomains`);

    return {
      domain,
      totalFound: results.length,
      subdomains: results,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check if a subdomain exists
   */
  private async checkSubdomain(subdomain: string, domain: string): Promise<SubdomainResult> {
    const fullDomain = `${subdomain}.${domain}`;

    try {
      const ipAddresses = await resolveDns4(fullDomain);
      
      return {
        subdomain: fullDomain,
        ipAddresses,
        exists: true,
      };
    } catch (error) {
      // Subdomain doesn't exist or DNS error
      return {
        subdomain: fullDomain,
        ipAddresses: [],
        exists: false,
      };
    }
  }

  /**
   * Reverse DNS lookup (PTR record)
   */
  async reverseDNS(ip: string): Promise<string[]> {
    try {
      const hostnames = await promisify(dns.reverse)(ip);
      return hostnames;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get all DNS record types for a subdomain
   */
  async getFullDNSInfo(subdomain: string) {
    const records: any = {};

    try {
      // A records
      try {
        records.a = await resolveDns(subdomain, 'A');
      } catch (e) {}

      // AAAA records
      try {
        records.aaaa = await resolveDns(subdomain, 'AAAA');
      } catch (e) {}

      // MX records
      try {
        records.mx = await promisify(dns.resolveMx)(subdomain);
      } catch (e) {}

      // TXT records
      try {
        records.txt = await promisify(dns.resolveTxt)(subdomain);
      } catch (e) {}

      // CNAME records
      try {
        records.cname = await promisify(dns.resolveCname)(subdomain);
      } catch (e) {}

      // NS records
      try {
        records.ns = await resolveDns(subdomain, 'NS');
      } catch (e) {}

    } catch (error) {
      console.error(`[DNSRecon] Full DNS info failed for ${subdomain}:`, error);
    }

    return records;
  }

  /**
   * Convert DNS recon results to graph entities
   */
  convertToEntities(dnsRecon: DNSReconResult) {
    const entities: any[] = [];
    const links: any[] = [];

    const domainId = `domain-${dnsRecon.domain}`;

    // Main domain entity
    entities.push({
      id: domainId,
      type: 'domain',
      value: dnsRecon.domain,
      data: {
        label: dnsRecon.domain,
        subdomainsFound: dnsRecon.totalFound,
        color: '#3b82f6', // blue
      },
    });

    // Subdomain entities
    for (const sub of dnsRecon.subdomains) {
      const subId = `subdomain-${sub.subdomain.replace(/\./g, '-')}`;
      
      entities.push({
        id: subId,
        type: 'domain',
        value: sub.subdomain,
        data: {
          label: sub.subdomain,
          isSubdomain: true,
          color: '#06b6d4', // cyan
        },
      });

      links.push({
        id: `link-${domainId}-${subId}`,
        source: domainId,
        target: subId,
        label: 'subdomain',
      });

      // IP addresses for each subdomain
      for (const ip of sub.ipAddresses) {
        const ipId = `ip-${ip.replace(/\./g, '-')}`;
        
        // Check if IP entity already exists
        if (!entities.find(e => e.id === ipId)) {
          entities.push({
            id: ipId,
            type: 'ip_address',
            value: ip,
            data: {
              label: ip,
              color: '#f59e0b', // orange
            },
          });
        }

        links.push({
          id: `link-${subId}-${ipId}`,
          source: subId,
          target: ipId,
          label: 'resolves to',
        });
      }
    }

    return { entities, links };
  }

  /**
   * Zone transfer attempt (usually blocked, but worth trying)
   */
  async attemptZoneTransfer(domain: string, nameserver: string): Promise<any> {
    // Note: Zone transfers are usually restricted
    // This would require AXFR query which Node.js dns module doesn't support
    // Would need a library like 'dns-packet' or external tool
    console.warn('[DNSRecon] Zone transfer not implemented (requires AXFR support)');
    return null;
  }
}

export const dnsReconService = new DNSReconService();
