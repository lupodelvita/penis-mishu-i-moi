/**
 * URLScan.io API Integration
 * Website scanner for security analysis
 * API: https://urlscan.io/docs/api/
 */

export interface URLScanResult {
  uuid: string;
  url: string;
  domain: string;
  ip: string;
  country: string;
  server: string;
  technologies: string[];
  certificates: any[];
  verdicts: {
    overall: {
      score: number;
      malicious: boolean;
      categories: string[];
    };
  };
  screenshot: string;
}

export interface URLScanSubmission {
  uuid: string;
  message: string;
  url: string;
  api: string;
  result: string;
}

export class URLScanService {
  private baseUrl = 'https://urlscan.io/api/v1';
  private apiKey = process.env.URLSCAN_API_KEY; // Free tier available

  /**
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Submit URL for scanning
   */
  async submitScan(url: string, visibility: 'public' | 'unlisted' | 'private' = 'unlisted'): Promise<URLScanSubmission> {
    if (!this.isConfigured()) {
      throw new Error('URLSCAN_API_KEY not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/scan/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'API-Key': this.apiKey!,
        },
        body: JSON.stringify({ url, visibility }),
      });

      if (!response.ok) {
        throw new Error(`URLScan.io API error: ${response.status}`);
      }

      const submission: URLScanSubmission = await response.json();
      return submission;
    } catch (error: any) {
      console.error('[URLScan] Submission failed:', error.message);
      throw error;
    }
  }

  /**
   * Get scan result
   */
  async getResult(uuid: string): Promise<URLScanResult | null> {
    try {
      const url = `${this.baseUrl}/result/${uuid}/`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'NodeWeaver-OSINT',
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`URLScan.io API error: ${response.status}`);
      }

      const result: any = await response.json();

      return {
        uuid: result.task.uuid,
        url: result.task.url,
        domain: result.page?.domain || '',
        ip: result.page?.ip || '',
        country: result.page?.country || '',
        server: result.page?.server || '',
        technologies: result.lists?.technologies || [],
        certificates: result.lists?.certificates || [],
        verdicts: result.verdicts || { overall: { score: 0, malicious: false, categories: [] } },
        screenshot: result.task?.screenshotURL || '',
      };
    } catch (error: any) {
      console.error('[URLScan] Result fetch failed:', error.message);
      return null;
    }
  }

  /**
   * Search for existing scans
   */
  async search(query: string): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/search/?q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'NodeWeaver-OSINT',
        },
      });

      if (!response.ok) {
        throw new Error(`URLScan.io API error: ${response.status}`);
      }

      const data: any = await response.json();
      return data.results || [];
    } catch (error: any) {
      console.error('[URLScan] Search failed:', error.message);
      return [];
    }
  }

  /**
   * Convert URLScan result to graph entities
   */
  convertToEntities(scanResult: URLScanResult): {
    entities: any[];
    links: any[];
  } {
    const entities: any[] = [];
    const links: any[] = [];

    // Create IP entity
    if (scanResult.ip) {
      const ipEntity = {
        id: `ip-${scanResult.ip}`,
        type: 'ip_address',
        value: scanResult.ip,
        properties: {
          country: scanResult.country,
        },
        metadata: {
          source: 'URLScan.io',
          created: new Date().toISOString(),
        },
      };

      entities.push(ipEntity);

      links.push({
        id: `link-${scanResult.domain}-${ipEntity.id}`,
        source: scanResult.domain,
        target: ipEntity.id,
        label: 'resolves_to',
      });
    }

    // Create technology entities
    scanResult.technologies.forEach((tech) => {
      const techEntity = {
        id: `tech-${tech.replace(/[^a-zA-Z0-9]/g, '-')}`,
        type: 'technology',
        value: tech,
        properties: {
          category: 'web_technology',
        },
        metadata: {
          source: 'URLScan.io',
          created: new Date().toISOString(),
        },
      };

      if (!entities.find((e) => e.id === techEntity.id)) {
        entities.push(techEntity);
      }

      links.push({
        id: `link-${scanResult.domain}-${techEntity.id}`,
        source: scanResult.domain,
        target: techEntity.id,
        label: 'uses',
      });
    });

    // Create threat verdict entity if malicious
    if (scanResult.verdicts.overall.malicious) {
      const threatEntity = {
        id: `threat-${scanResult.uuid}`,
        type: 'threat',
        value: 'Malicious Site Detected',
        properties: {
          score: scanResult.verdicts.overall.score,
          categories: scanResult.verdicts.overall.categories,
          screenshot: scanResult.screenshot,
        },
        metadata: {
          source: 'URLScan.io',
          created: new Date().toISOString(),
        },
      };

      entities.push(threatEntity);

      links.push({
        id: `link-${scanResult.domain}-${threatEntity.id}`,
        source: scanResult.domain,
        target: threatEntity.id,
        label: 'threat_detected',
      });
    }

    return { entities, links };
  }
}

export const urlScanService = new URLScanService();
