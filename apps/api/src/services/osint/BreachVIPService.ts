/**
 * BreachVIP OSINT Service
 * Search for leaked data across multiple breach databases
 * API Documentation: https://breachvip.com/api/docs
 */

export interface BreachVIPResult {
  source: string; // Breach name
  categories: string | string[]; // Categories of leak
  [key: string]: any; // Additional fields from the leak
}

export interface BreachVIPSearchRequest {
  term: string; // Search term (1-100 chars)
  fields: BreachVIPField[]; // Fields to search in (1-10)
  categories?: string[] | null; // Optional categories filter
  wildcard?: boolean; // Enable wildcard search (* and ?)
  case_sensitive?: boolean; // Case-sensitive search
}

export type BreachVIPField = 
  | 'domain' 
  | 'steamid' 
  | 'phone' 
  | 'name' 
  | 'email' 
  | 'username' 
  | 'password' 
  | 'ip' 
  | 'discordid' 
  | 'uuid';

export interface BreachVIPSearchResponse {
  results: BreachVIPResult[];
  total: number;
  term: string;
  fields: string[];
}

export class BreachVIPService {
  private baseUrl = 'https://api.breachvip.com';
  private rateLimit = 15; // 15 requests per minute
  private requestTimestamps: number[] = [];

  /**
   * BreachVIP API is open (no API key required per OpenAPI spec)
   */
  isConfigured(): boolean {
    return true;
  }

  /**
   * Check rate limit (15 requests per minute)
   */
  private canMakeRequest(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Remove old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);
    
    // Check if under limit
    return this.requestTimestamps.length < this.rateLimit;
  }

  /**
   * Record a request timestamp
   */
  private recordRequest(): void {
    this.requestTimestamps.push(Date.now());
  }

  /**
   * Search for leaked data
   * @param request Search parameters
   * @returns Search results
   */
  async search(request: BreachVIPSearchRequest): Promise<BreachVIPSearchResponse> {
    if (!this.canMakeRequest()) {
      throw new Error('Rate limit exceeded (15 requests per minute)');
    }

    // Validate input
    if (!request.term || request.term.length < 1 || request.term.length > 100) {
      throw new Error('Search term must be between 1-100 characters');
    }

    if (!request.fields || request.fields.length < 1 || request.fields.length > 10) {
      throw new Error('Must provide 1-10 search fields');
    }

    // Validate wildcard rules
    if (request.wildcard && (request.term.startsWith('*') || request.term.startsWith('?'))) {
      throw new Error('Wildcard search terms cannot begin with * or ?');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          term: request.term,
          fields: request.fields,
          categories: request.categories || null,
          wildcard: request.wildcard || false,
          case_sensitive: request.case_sensitive || false,
        }),
      });

      this.recordRequest();

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 429) {
          throw new Error('Rate limited - wait 1 minute before retrying');
        }
        
        throw new Error(errorData.error || `BreachVIP API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        results: data.results || [],
        total: data.results?.length || 0,
        term: request.term,
        fields: request.fields,
      };
    } catch (error: any) {
      console.error('[BreachVIPService] Search error:', error.message);
      throw error;
    }
  }

  /**
   * Quick search by email
   */
  async searchByEmail(email: string, wildcard = false): Promise<BreachVIPSearchResponse> {
    return this.search({
      term: email,
      fields: ['email'],
      wildcard,
    });
  }

  /**
   * Quick search by username
   */
  async searchByUsername(username: string, wildcard = false): Promise<BreachVIPSearchResponse> {
    return this.search({
      term: username,
      fields: ['username'],
      wildcard,
    });
  }

  /**
   * Quick search by domain
   */
  async searchByDomain(domain: string, wildcard = false): Promise<BreachVIPSearchResponse> {
    return this.search({
      term: domain,
      fields: ['domain'],
      wildcard,
    });
  }

  /**
   * Quick search by IP address
   */
  async searchByIP(ip: string): Promise<BreachVIPSearchResponse> {
    return this.search({
      term: ip,
      fields: ['ip'],
    });
  }

  /**
   * Quick search by phone number
   */
  async searchByPhone(phone: string): Promise<BreachVIPSearchResponse> {
    return this.search({
      term: phone,
      fields: ['phone'],
    });
  }

  /**
   * Multi-field search (email, username, phone)
   */
  async searchByIdentity(term: string, wildcard = false): Promise<BreachVIPSearchResponse> {
    return this.search({
      term,
      fields: ['email', 'username', 'phone', 'name'],
      wildcard,
    });
  }

  /**
   * Search Minecraft-specific leaks
   */
  async searchMinecraft(term: string, field: BreachVIPField): Promise<BreachVIPSearchResponse> {
    return this.search({
      term,
      fields: [field],
      categories: ['minecraft'],
    });
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus(): { used: number; limit: number; remaining: number } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);

    return {
      used: this.requestTimestamps.length,
      limit: this.rateLimit,
      remaining: this.rateLimit - this.requestTimestamps.length,
    };
  }
}

export const breachVIPService = new BreachVIPService();
