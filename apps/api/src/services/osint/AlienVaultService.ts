/**
 * AlienVault OTX (Open Threat Exchange) API Integration
 * Free threat intelligence platform
 * API: https://otx.alienvault.com/api
 */

export interface OTXIndicator {
  indicator: string;
  type: string;
  pulseCount: number;
  pulses: OTXPulse[];
}

export interface OTXPulse {
  id: string;
  name: string;
  description: string;
  author: string;
  created: string;
  modified: string;
  tags: string[];
  references: string[];
  malwareFamilies: string[];
  adversary: string;
}

export interface OTXIPReputation {
  reputation: number;
  asn: string;
  country: string;
  city: string;
  latitude: number;
  longitude: number;
  pulseCount: number;
}

export class AlienVaultService {
  private baseUrl = 'https://otx.alienvault.com/api/v1';
  private apiKey = process.env.ALIENVAULT_API_KEY; // Optional, higher rate limits with API key

  /**
   * Check if API key is configured (optional for read-only)
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get indicator information (Domain, IP, URL, Hash)
   */
  async getIndicator(indicator: string, type: 'domain' | 'IPv4' | 'IPv6' | 'url' | 'file'): Promise<OTXIndicator | null> {
    try {
      const url = `${this.baseUrl}/indicators/${type}/${encodeURIComponent(indicator)}/general`;
      const headers: any = { 'User-Agent': 'NodeWeaver-OSINT' };
      
      if (this.isConfigured()) {
        headers['X-OTX-API-KEY'] = this.apiKey;
      }

      const response = await fetch(url, { headers });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`AlienVault OTX API error: ${response.status}`);
      }

      const data: any = await response.json();

      return {
        indicator: data.indicator,
        type: data.type || type,
        pulseCount: data.pulse_info?.count || 0,
        pulses: (data.pulse_info?.pulses || []).slice(0, 10).map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          author: p.author_name,
          created: p.created,
          modified: p.modified,
          tags: p.tags || [],
          references: p.references || [],
          malwareFamilies: p.malware_families || [],
          adversary: p.adversary || '',
        })),
      };
    } catch (error: any) {
      console.error('[AlienVault] Indicator lookup failed:', error.message);
      throw error;
    }
  }

  /**
   * Get IP reputation
   */
  async getIPReputation(ip: string): Promise<OTXIPReputation | null> {
    try {
      const url = `${this.baseUrl}/indicators/IPv4/${ip}/reputation`;
      const headers: any = { 'User-Agent': 'NodeWeaver-OSINT' };
      
      if (this.isConfigured()) {
        headers['X-OTX-API-KEY'] = this.apiKey;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        return null;
      }

      const data: any = await response.json();

      return {
        reputation: data.reputation || 0,
        asn: data.asn || '',
        country: data.country_name || '',
        city: data.city || '',
        latitude: data.latitude || 0,
        longitude: data.longitude || 0,
        pulseCount: data.pulse_info?.count || 0,
      };
    } catch (error: any) {
      console.error('[AlienVault] IP reputation check failed:', error.message);
      return null;
    }
  }

  /**
   * Convert OTX data to graph entities
   */
  convertToEntities(indicator: string, otxData: OTXIndicator): {
    entities: any[];
    links: any[];
  } {
    const entities: any[] = [];
    const links: any[] = [];

    // Create pulse entities (threat intelligence)
    otxData.pulses.forEach((pulse) => {
      const pulseEntity = {
        id: `otx-pulse-${pulse.id}`,
        type: 'threat_intel',
        value: pulse.name,
        properties: {
          description: pulse.description,
          author: pulse.author,
          created: pulse.created,
          modified: pulse.modified,
          tags: pulse.tags,
          references: pulse.references,
          malwareFamilies: pulse.malwareFamilies,
          adversary: pulse.adversary,
        },
        metadata: {
          source: 'AlienVault OTX',
          created: new Date().toISOString(),
        },
      };

      entities.push(pulseEntity);

      // Link indicator to pulse
      links.push({
        id: `link-${indicator}-${pulse.id}`,
        source: indicator,
        target: pulseEntity.id,
        label: 'threat_intel',
      });

      // Create malware family entities
      pulse.malwareFamilies.forEach((malware) => {
        const malwareEntity = {
          id: `malware-${malware}`,
          type: 'malware',
          value: malware,
          properties: {
            family: malware,
          },
          metadata: {
            source: 'AlienVault OTX',
            created: new Date().toISOString(),
          },
        };

        // Only add if not duplicate
        if (!entities.find((e) => e.id === malwareEntity.id)) {
          entities.push(malwareEntity);
        }

        links.push({
          id: `link-${pulseEntity.id}-${malwareEntity.id}`,
          source: pulseEntity.id,
          target: malwareEntity.id,
          label: 'associated_malware',
        });
      });
    });

    return { entities, links };
  }
}

export const alienVaultService = new AlienVaultService();
