/**
 * Hunter.io API Integration
 * Find email addresses associated with a domain
 * API: https://hunter.io/api-documentation
 */

export interface HunterEmailResult {
  email: string;
  firstName: string;
  lastName: string;
  position: string;
  department: string;
  confidence: number;
  sources: Array<{
    domain: string;
    uri: string;
    extracted_on: string;
  }>;
}

export interface HunterDomainSearch {
  domain: string;
  emails: HunterEmailResult[];
  pattern: string;
  organization: string;
}

export class HunterService {
  private baseUrl = 'https://api.hunter.io/v2';
  private apiKey = process.env.HUNTER_API_KEY; // Free tier: 25 searches/month

  /**
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Search for email addresses by domain
   */
  async searchDomain(domain: string, limit: number = 10): Promise<HunterDomainSearch | null> {
    if (!this.isConfigured()) {
      throw new Error('HUNTER_API_KEY not configured');
    }

    try {
      const url = `${this.baseUrl}/domain-search?domain=${domain}&limit=${limit}&api_key=${this.apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Hunter.io API error: ${response.status}`);
      }

      const data: any = await response.json();

      if (!data.data) {
        return null;
      }

      return {
        domain: data.data.domain,
        emails: (data.data.emails || []).map((email: any) => ({
          email: email.value,
          firstName: email.first_name,
          lastName: email.last_name,
          position: email.position,
          department: email.department,
          confidence: email.confidence,
          sources: email.sources || [],
        })),
        pattern: data.data.pattern,
        organization: data.data.organization,
      };
    } catch (error: any) {
      console.error('[Hunter] Domain search failed:', error.message);
      throw error;
    }
  }

  /**
   * Verify email address
   */
  async verifyEmail(email: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('HUNTER_API_KEY not configured');
    }

    try {
      const url = `${this.baseUrl}/email-verifier?email=${encodeURIComponent(email)}&api_key=${this.apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Hunter.io API error: ${response.status}`);
      }

      const data: any = await response.json();
      return data.data;
    } catch (error: any) {
      console.error('[Hunter] Email verification failed:', error.message);
      throw error;
    }
  }

  /**
   * Convert Hunter data to graph entities
   */
  convertToEntities(domainSearch: HunterDomainSearch): {
    entities: any[];
    links: any[];
  } {
    const entities: any[] = [];
    const links: any[] = [];

    // Create email entities
    domainSearch.emails.forEach((emailData) => {
      const emailEntity = {
        id: `email-${emailData.email}`,
        type: 'email',
        value: emailData.email,
        properties: {
          domain: domainSearch.domain,
          confidence: emailData.confidence,
        },
        metadata: {
          source: 'Hunter.io',
          created: new Date().toISOString(),
        },
      };

      entities.push(emailEntity);

      // Link email to domain
      links.push({
        id: `link-${domainSearch.domain}-${emailEntity.id}`,
        source: domainSearch.domain,
        target: emailEntity.id,
        label: 'has_email',
      });

      // Create person entity if name is available
      if (emailData.firstName || emailData.lastName) {
        const personName = `${emailData.firstName} ${emailData.lastName}`.trim();
        const personEntity = {
          id: `person-${personName.replace(/\s/g, '-')}`,
          type: 'person',
          value: personName,
          properties: {
            firstName: emailData.firstName,
            lastName: emailData.lastName,
            position: emailData.position,
            department: emailData.department,
            organization: domainSearch.organization,
          },
          metadata: {
            source: 'Hunter.io',
            created: new Date().toISOString(),
          },
        };

        entities.push(personEntity);

        // Link person to email
        links.push({
          id: `link-${personEntity.id}-${emailEntity.id}`,
          source: personEntity.id,
          target: emailEntity.id,
          label: 'owns',
        });
      }
    });

    return { entities, links };
  }
}

export const hunterService = new HunterService();
