/**
 * HaveIBeenPwned API Integration
 * Check email addresses against known data breaches
 * API: https://haveibeenpwned.com/API/v3
 */

export interface HibpBreach {
  name: string;
  title: string;
  domain: string;
  breachDate: string;
  addedDate: string;
  pwnCount: number;
  description: string;
  dataClasses: string[];
  isVerified: boolean;
  isFabricated: boolean;
  isSensitive: boolean;
  isRetired: boolean;
  isSpamList: boolean;
  logoPath: string;
}

export interface HibpPaste {
  source: string;
  id: string;
  title: string;
  date: string;
  emailCount: number;
}

export class HaveIBeenPwnedService {
  private baseUrl = 'https://haveibeenpwned.com/api/v3';
  private apiKey = process.env.HIBP_API_KEY; // Commercial tier required for breach searches

  /**
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get all breaches for an email address
   */
  async getBreachesByEmail(email: string): Promise<HibpBreach[]> {
    if (!this.isConfigured()) {
      throw new Error('HIBP_API_KEY not configured');
    }

    try {
      const url = `${this.baseUrl}/breachedaccount/${encodeURIComponent(email)}`;
      const response = await fetch(url, {
        headers: {
          'hibp-api-key': this.apiKey!,
          'User-Agent': 'NodeWeaver-OSINT',
        },
      });

      if (response.status === 404) {
        // No breaches found
        return [];
      }

      if (!response.ok) {
        throw new Error(`HIBP API error: ${response.status}`);
      }

      const breaches: HibpBreach[] = await response.json();
      return breaches;
    } catch (error: any) {
      console.error('[HaveIBeenPwned] Email check failed:', error.message);
      throw error;
    }
  }

  /**
   * Get all pastes for an email address
   */
  async getPastesByEmail(email: string): Promise<HibpPaste[]> {
    try {
      const url = `${this.baseUrl}/pasteaccount/${encodeURIComponent(email)}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'NodeWeaver-OSINT',
        },
      });

      if (response.status === 404) {
        return [];
      }

      if (!response.ok) {
        throw new Error(`HIBP API error: ${response.status}`);
      }

      const pastes: HibpPaste[] = await response.json();
      return pastes;
    } catch (error: any) {
      console.error('[HaveIBeenPwned] Paste check failed:', error.message);
      throw error;
    }
  }

  /**
   * Convert HIBP breaches to graph entities
   */
  convertToEntities(email: string, breaches: HibpBreach[], pastes: HibpPaste[]): {
    entities: any[];
    links: any[];
  } {
    const entities: any[] = [];
    const links: any[] = [];

    // Create breach entities
    breaches.forEach((breach) => {
      const breachEntity = {
        id: `breach-${breach.name}`,
        type: 'breach',
        value: breach.title,
        properties: {
          name: breach.name,
          domain: breach.domain,
          breachDate: breach.breachDate,
          pwnCount: breach.pwnCount,
          description: breach.description,
          dataClasses: breach.dataClasses,
          isVerified: breach.isVerified,
          isSensitive: breach.isSensitive,
          logo: breach.logoPath,
        },
        metadata: {
          source: 'HaveIBeenPwned',
          created: new Date().toISOString(),
        },
      };

      entities.push(breachEntity);

      // Link email to breach
      links.push({
        id: `link-${email}-${breach.name}`,
        source: email, // Assuming email entity already exists
        target: breachEntity.id,
        label: 'pwned_in',
      });

      // Create data class entities
      breach.dataClasses.forEach((dataClass) => {
        const dataClassEntity = {
          id: `dataclass-${breach.name}-${dataClass}`,
          type: 'data_leak',
          value: dataClass,
          properties: {
            breach: breach.name,
            category: dataClass,
          },
          metadata: {
            source: 'HaveIBeenPwned',
            created: new Date().toISOString(),
          },
        };

        entities.push(dataClassEntity);

        links.push({
          id: `link-${breachEntity.id}-${dataClassEntity.id}`,
          source: breachEntity.id,
          target: dataClassEntity.id,
          label: 'leaked',
        });
      });
    });

    // Create paste entities
    pastes.forEach((paste) => {
      const pasteEntity = {
        id: `paste-${paste.source}-${paste.id}`,
        type: 'paste',
        value: paste.title || paste.id,
        properties: {
          source: paste.source,
          pasteId: paste.id,
          date: paste.date,
          emailCount: paste.emailCount,
        },
        metadata: {
          source: 'HaveIBeenPwned',
          created: new Date().toISOString(),
        },
      };

      entities.push(pasteEntity);

      links.push({
        id: `link-${email}-paste-${paste.id}`,
        source: email,
        target: pasteEntity.id,
        label: 'found_in_paste',
      });
    });

    return { entities, links };
  }
}

export const haveIBeenPwnedService = new HaveIBeenPwnedService();
