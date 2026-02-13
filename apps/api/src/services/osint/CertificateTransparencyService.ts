/**
 * Certificate Transparency (crt.sh) Integration
 * Find subdomains via SSL certificate logs
 * API: https://crt.sh (Free, no API key required)
 */

export interface CertificateEntry {
  id: number;
  issuer_ca_id: number;
  issuer_name: string;
  name_value: string;
  min_cert_id: number;
  min_entry_timestamp: string;
  not_before: string;
  not_after: string;
}

export class CertificateTransparencyService {
  private baseUrl = 'https://crt.sh';

  /**
   * Search for certificates by domain
   */
  async searchDomain(domain: string): Promise<CertificateEntry[]> {
    try {
      const url = `${this.baseUrl}/?q=%.${domain}&output=json`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'NodeWeaver-OSINT',
        },
      });

      if (!response.ok) {
        throw new Error(`crt.sh API error: ${response.status}`);
      }

      const certs: CertificateEntry[] = await response.json();
      return certs;
    } catch (error: any) {
      console.error('[CertificateTransparency] Search failed:', error.message);
      throw error;
    }
  }

  /**
   * Extract unique subdomains from certificates
   */
  extractSubdomains(certs: CertificateEntry[], baseDomain: string): string[] {
    const subdomains = new Set<string>();

    certs.forEach((cert) => {
      const names = cert.name_value.split('\n');
      names.forEach((name) => {
        // Remove wildcards and clean up
        const cleaned = name.replace(/^\*\./, '').trim().toLowerCase();
        
        // Only include if it's a subdomain of base domain
        if (cleaned.endsWith(baseDomain) && cleaned !== baseDomain) {
          subdomains.add(cleaned);
        }
      });
    });

    return Array.from(subdomains);
  }

  /**
   * Convert certificate data to graph entities
   */
  convertToEntities(domain: string, certs: CertificateEntry[]): {
    entities: any[];
    links: any[];
  } {
    const entities: any[] = [];
    const links: any[] = [];
    const subdomains = this.extractSubdomains(certs, domain);

    // Create subdomain entities
    subdomains.forEach((subdomain) => {
      const subdomainEntity = {
        id: `domain-${subdomain}`,
        type: 'domain',
        value: subdomain,
        properties: {
          parent: domain,
          discoveryMethod: 'Certificate Transparency',
        },
        metadata: {
          source: 'crt.sh',
          created: new Date().toISOString(),
        },
      };

      entities.push(subdomainEntity);

      // Link to parent domain
      links.push({
        id: `link-${domain}-${subdomain}`,
        source: domain,
        target: subdomainEntity.id,
        label: 'subdomain',
      });
    });

    // Create issuer entities (Certificate Authorities)
    const issuers = new Map<string, number>();
    certs.forEach((cert) => {
      const count = issuers.get(cert.issuer_name) || 0;
      issuers.set(cert.issuer_name, count + 1);
    });

    issuers.forEach((count, issuerName) => {
      const issuerEntity = {
        id: `ca-${issuerName.replace(/[^a-zA-Z0-9]/g, '-')}`,
        type: 'certificate_authority',
        value: issuerName,
        properties: {
          certCount: count,
        },
        metadata: {
          source: 'crt.sh',
          created: new Date().toISOString(),
        },
      };

      entities.push(issuerEntity);

      links.push({
        id: `link-${domain}-${issuerEntity.id}`,
        source: domain,
        target: issuerEntity.id,
        label: 'issued_by',
      });
    });

    return { entities, links };
  }
}

export const certificateTransparencyService = new CertificateTransparencyService();
