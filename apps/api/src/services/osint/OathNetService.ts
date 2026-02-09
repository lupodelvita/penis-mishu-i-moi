import { fetch } from 'undici';

export interface BreachResult {
  email: string;
  password?: string;
  source: string;
  date: string;
  ip?: string;
  username?: string;
}

export interface OathNetResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  lookups_left?: number;
}

export class OathNetService {
  private apiKey = process.env.OATHNET_API_KEY;
  private baseUrl = 'https://oathnet.org/api';

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private getHeaders() {
    return {
      'x-api-key': this.apiKey || '',
      'Content-Type': 'application/json',
    };
  }

  /**
   * Search for breaches by email, username, IP, or phone
   */
  async searchBreach(query: string, type: 'email' | 'username' | 'ip' | 'phone' = 'email'): Promise<OathNetResponse<any>> {
    if (!this.isConfigured()) throw new Error('OathNet API key not configured');

    let endpoint = `/service/${query}`;
    if (type === 'ip') endpoint = `/service/ip/${query}`;
    if (type === 'username') endpoint = `/service/username/${query}`;
    if (type === 'phone') endpoint = `/service/phone/${query}`;

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`OathNet API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as OathNetResponse<any>;
      return data;
    } catch (error) {
      console.error('[OathNet] Breach search error:', error);
      throw error;
    }
  }

  /**
   * Search Stealer Logs (Victims)
   */
  async searchStealerLogs(filters: any): Promise<OathNetResponse<any>> {
    if (!this.isConfigured()) throw new Error('OathNet API key not configured');

    try {
      const response = await fetch(`${this.baseUrl}/search/victims`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(filters),
      });

      if (!response.ok) {
        throw new Error(`OathNet API Error: ${response.status}`);
      }

      return await response.json() as OathNetResponse<any>;
    } catch (error) {
      console.error('[OathNet] Stealer search error:', error);
      throw error;
    }
  }

  /**
   * Discord User Lookup by ID
   */
  async discordLookup(userId: string): Promise<OathNetResponse<any>> {
    if (!this.isConfigured()) throw new Error('OathNet API key not configured');

    try {
      const response = await fetch(`${this.baseUrl}/discord/${userId}`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`OathNet API Error: ${response.status}`);
      }

      return await response.json() as OathNetResponse<any>;
    } catch (error) {
      console.error('[OathNet] Discord lookup error:', error);
      throw error;
    }
  }

  /**
   * Convert Breach results to Graph Entities
   */
  convertBreachToEntities(query: string, results: BreachResult[]) {
    const entities: any[] = [];
    const links: any[] = [];

    // Target Entity
    const targetId = `target-${query.replace(/[^a-zA-Z0-9]/g, '-')}`;
    entities.push({
      id: targetId,
      type: query.includes('@') ? 'email_address' : 'username', // Simple heuristic
      value: query,
      data: { label: query, color: '#ef4444' }
    });

    results.forEach((breach, index) => {
      // Breach Source Entity
      const sourceId = `leak-${breach.source.replace(/[^a-zA-Z0-9]/g, '-')}`;
      
      // Avoid duplicate source entities if possible, but distinct leaks might be better
      if (!entities.find(e => e.id === sourceId)) {
        entities.push({
          id: sourceId,
          type: 'breach', // You might need to add this type or use generic
          value: breach.source,
          data: {
            label: `Leak: ${breach.source}`,
            date: breach.date,
            color: '#dc2626' // Darker red
          }
        });
      }

      links.push({
        id: `link-${targetId}-${sourceId}-${index}`,
        source: targetId,
        target: sourceId,
        label: 'leaked in'
      });

      // If there is a password (hashed or plain), add it potentially
      if (breach.password) {
        const passId = `pass-${index}-${query.replace(/[^a-zA-Z0-9]/g, '-')}`;
        entities.push({
          id: passId,
          type: 'credentials',
          value: breach.password, // Be careful with displaying this
          data: {
            label: 'Password/Hash',
            color: '#f97316'
          }
        });
        links.push({
          id: `link-${sourceId}-${passId}`,
          source: sourceId,
          target: passId,
          label: 'contains data'
        });
      }
    });

    return { entities, links };
  }
}

export const oathNetService = new OathNetService();
