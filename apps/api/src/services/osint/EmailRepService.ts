/**
 * EmailRep Service
 * 
 * Email reputation and risk scoring based on real-world data.
 * 
 * API Documentation: https://docs.emailrep.io/
 * Free Tier: Unlimited (no key needed for basic queries)
 * API Key: https://emailrep.io/key (optional, unlocks full details)
 * 
 * Features:
 * - Email reputation score (high/medium/low/none)
 * - Risk assessment (suspicious, spam, spoofable, etc.)
 * - Domain age and registration info
 * - Presence on data breaches
 * - Social media profile detection
 * - Disposable/free email detection
 * - Deliverability check
 */

interface EmailRepResponse {
  email: string;
  reputation: 'high' | 'medium' | 'low' | 'none';
  suspicious: boolean;
  references: number;
  details: {
    blacklisted: boolean;
    malicious_activity: boolean;
    malicious_activity_recent: boolean;
    credentials_leaked: boolean;
    credentials_leaked_recent: boolean;
    data_breach: boolean;
    first_seen: string | null;
    last_seen: string | null;
    domain_exists: boolean;
    domain_reputation: 'high' | 'medium' | 'low' | 'n/a';
    new_domain: boolean;
    days_since_domain_creation: number | null;
    suspicious_tld: boolean;
    spam: boolean;
    free_provider: boolean;
    disposable: boolean;
    deliverable: boolean;
    accept_all: boolean;
    valid_mx: boolean;
    primary_mx: string | null;
    spoofable: boolean;
    spf_strict: boolean;
    dmarc_enforced: boolean;
    profiles: string[];
  };
}

export class EmailRepService {
  private apiKey?: string;
  private baseUrl = 'https://emailrep.io';

  constructor() {
    this.apiKey = process.env.EMAILREP_API_KEY;
  }

  isConfigured(): boolean {
    // Works without key, key unlocks more details
    return true;
  }

  /**
   * Get email reputation and risk assessment
   */
  async getReputation(email: string): Promise<EmailRepResponse | null> {
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'User-Agent': 'NodeWeaver OSINT Platform'
      };

      if (this.apiKey) {
        headers['Key'] = this.apiKey;
      }

      const response = await fetch(`${this.baseUrl}/${encodeURIComponent(email)}`, {
        headers
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        if (response.status === 429) throw new Error('Rate limited - try again later');
        throw new Error(`EmailRep API error: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('EmailRep lookup failed:', error.message);
      return null;
    }
  }

  /**
   * Convert reputation data to graph entities
   */
  convertToEntities(data: EmailRepResponse, sourceEmail: string): { entities: any[]; links: any[] } {
    const entities: any[] = [];
    const links: any[] = [];
    const seen = new Set<string>();

    // Reputation summary entity
    const riskFactors: string[] = [];
    if (data.details.blacklisted) riskFactors.push('Blacklisted');
    if (data.details.malicious_activity) riskFactors.push('Malicious activity detected');
    if (data.details.credentials_leaked) riskFactors.push('Credentials leaked');
    if (data.details.data_breach) riskFactors.push('Data breach found');
    if (data.details.spam) riskFactors.push('Spam source');
    if (data.details.disposable) riskFactors.push('Disposable email');
    if (data.details.spoofable) riskFactors.push('Spoofable (no SPF/DMARC)');
    if (data.suspicious) riskFactors.push('Suspicious');

    entities.push({
      type: 'threat_intel',
      value: `EmailRep: ${data.reputation} reputation`,
      data: {
        label: `Reputation: ${data.reputation.toUpperCase()}${data.suspicious ? ' ⚠️ SUSPICIOUS' : ''}`,
        color: data.reputation === 'high' ? '#22c55e' : data.reputation === 'medium' ? '#f59e0b' : '#ef4444'
      },
      properties: {
        source: 'EmailRep',
        reputation: data.reputation,
        suspicious: data.suspicious,
        references: data.references,
        risk_factors: riskFactors,
        first_seen: data.details.first_seen,
        last_seen: data.details.last_seen,
        deliverable: data.details.deliverable,
        free_provider: data.details.free_provider,
        disposable: data.details.disposable
      },
      link: { label: 'reputation' }
    });

    // Breach/leak entity if detected
    if (data.details.credentials_leaked || data.details.data_breach) {
      entities.push({
        type: 'breach',
        value: `${sourceEmail} - credentials leaked`,
        properties: {
          source: 'EmailRep',
          credentials_leaked: data.details.credentials_leaked,
          credentials_leaked_recent: data.details.credentials_leaked_recent,
          data_breach: data.details.data_breach
        },
        link: { label: 'breach detected' }
      });
    }

    // Domain information
    if (data.details.primary_mx && !seen.has(data.details.primary_mx)) {
      seen.add(data.details.primary_mx);
      entities.push({
        type: 'domain',
        value: data.details.primary_mx,
        properties: {
          source: 'EmailRep',
          record_type: 'MX',
          domain_reputation: data.details.domain_reputation,
          domain_age_days: data.details.days_since_domain_creation,
          valid_mx: data.details.valid_mx,
          spf_strict: data.details.spf_strict,
          dmarc_enforced: data.details.dmarc_enforced
        },
        link: { label: 'mail server' }
      });
    }

    // Social profiles detected
    if (data.details.profiles && data.details.profiles.length > 0) {
      for (const profile of data.details.profiles.slice(0, 10)) {
        if (!seen.has(profile)) {
          seen.add(profile);
          entities.push({
            type: 'social_profile',
            value: `${profile}: ${sourceEmail}`,
            data: { label: `${profile} account` },
            properties: { source: 'EmailRep', platform: profile },
            link: { label: `${profile} account` }
          });
        }
      }
    }

    return { entities, links };
  }
}

export const emailRepService = new EmailRepService();
