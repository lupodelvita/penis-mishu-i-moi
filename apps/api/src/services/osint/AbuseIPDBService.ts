/**
 * AbuseIPDB Service
 * 
 * Community-driven IP abuse reporting and blacklist database.
 * Tracks malicious activity from IPs including DDoS, spam, hacking attempts.
 * 
 * API Documentation: https://docs.abuseipdb.com/#introduction
 * Free Tier: 1000 requests/day
 * API Key: https://www.abuseipdb.com/register (free registration)
 * 
 * Features:
 * - IP reputation scoring (0-100%)
 * - Abuse categories (DDoS, port scan, spam, etc.)
 * - Report count and dates
 * - ISP and country information
 */

interface AbuseIPDBReport {
  ipAddress: string;
  isPublic: boolean;
  ipVersion: number;
  isWhitelisted: boolean;
  abuseConfidenceScore: number; // 0-100%
  countryCode: string;
  countryName: string;
  usageType: string;
  isp: string;
  domain: string;
  hostnames: string[];
  totalReports: number;
  numDistinctUsers: number;
  lastReportedAt: string;
  reports?: Array<{
    reportedAt: string;
    comment: string;
    categories: number[];
    reporterId: number;
    reporterCountryCode: string;
  }>;
}

export class AbuseIPDBService {
  private apiKey?: string;
  private baseUrl = 'https://api.abuseipdb.com/api/v2';

  // Category mapping
  private categories: Record<number, string> = {
    3: 'Fraud Orders',
    4: 'DDoS Attack',
    5: 'FTP Brute-Force',
    6: 'Ping of Death',
    7: 'Phishing',
    8: 'Fraud VoIP',
    9: 'Open Proxy',
    10: 'Web Spam',
    11: 'Email Spam',
    12: 'Blog Spam',
    13: 'VPN IP',
    14: 'Port Scan',
    15: 'Hacking',
    16: 'SQL Injection',
    17: 'Spoofing',
    18: 'Brute-Force',
    19: 'Bad Web Bot',
    20: 'Exploited Host',
    21: 'Web App Attack',
    22: 'SSH',
    23: 'IoT Targeted'
  };

  constructor() {
    this.apiKey = process.env.ABUSEIPDB_API_KEY;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Check IP for abuse reports
   */
  async checkIP(ip: string, maxAgeInDays: number = 90, verbose: boolean = false): Promise<AbuseIPDBReport | null> {
    if (!this.apiKey) {
      throw new Error('AbuseIPDB API key not configured');
    }

    try {
      const params = new URLSearchParams({
        ipAddress: ip,
        maxAgeInDays: maxAgeInDays.toString(),
        verbose: verbose ? 'true' : 'false'
      });

      const response = await fetch(`${this.baseUrl}/check?${params}`, {
        headers: {
          'Key': this.apiKey,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`AbuseIPDB API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error: any) {
      console.error('AbuseIPDB check failed:', error.message);
      return null;
    }
  }

  /**
   * Get blacklist (IPs with 100% confidence score)
   */
  async getBlacklist(limit: number = 100): Promise<string[] | null> {
    if (!this.apiKey) {
      throw new Error('AbuseIPDB API key not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/blacklist?limit=${limit}`, {
        headers: {
          'Key': this.apiKey,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`AbuseIPDB API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data.map((entry: any) => entry.ipAddress);
    } catch (error: any) {
      console.error('AbuseIPDB blacklist fetch failed:', error.message);
      return null;
    }
  }

  /**
   * Convert report to graph entities
   */
  convertToEntities(report: AbuseIPDBReport, ip: string): { entities: any[], links: any[] } {
    const entities: any[] = [];
    const links: any[] = [];

    // Main abuse report entity
    const score = report.abuseConfidenceScore;
    let color = '#10b981'; // Green for clean
    if (score > 25) color = '#f59e0b'; // Orange for suspicious
    if (score > 75) color = '#ef4444'; // Red for malicious

    const reportId = `abuseipdb-${ip}-${Date.now()}`;
    
    entities.push({
      id: reportId,
      type: 'threat_intel',
      value: `Abuse Score: ${score}%`,
      data: {
        label: `AbuseIPDB: ${score}% confidence`,
        type: 'threat_intel',
        color
      },
      properties: {
        source: 'AbuseIPDB',
        score: score,
        totalReports: report.totalReports,
        distinctReporters: report.numDistinctUsers,
        lastReported: report.lastReportedAt,
        country: report.countryName,
        isp: report.isp,
        domain: report.domain,
        usageType: report.usageType,
        whitelisted: report.isWhitelisted
      }
    });

    links.push({
      id: `link-ip-${reportId}`,
      source: `ip-${ip}`,
      target: reportId,
      label: score > 75 ? 'high abuse' : score > 25 ? 'moderate abuse' : 'low abuse'
    });

    // ISP entity
    if (report.isp) {
      const ispId = `isp-${report.isp.replace(/\s+/g, '-')}-${Date.now()}`;
      entities.push({
        id: ispId,
        type: 'organization',
        value: report.isp,
        data: {
          label: report.isp,
          type: 'organization',
          color: '#10b981'
        },
        properties: {
          country: report.countryName,
          domain: report.domain
        }
      });

      links.push({
        id: `link-ip-${ispId}`,
        source: `ip-${ip}`,
        target: ispId,
        label: 'belongs to'
      });
    }

    // Abuse category entities (from detailed reports if available)
    if (report.reports && report.reports.length > 0) {
      const allCategories = report.reports.flatMap(r => r.categories);
      const uniqueCategories = [...new Set(allCategories)];

      uniqueCategories.slice(0, 5).forEach(categoryNum => {
        const categoryName = this.categories[categoryNum] || `Unknown (${categoryNum})`;
        const categoryId = `abuse-cat-${categoryNum}-${Date.now()}`;

        entities.push({
          id: categoryId,
          type: 'threat',
          value: categoryName,
          data: {
            label: categoryName,
            type: 'threat',
            color: '#f59e0b'
          },
          properties: {
            category: categoryNum,
            occurrences: allCategories.filter(c => c === categoryNum).length
          }
        });

        links.push({
          id: `link-${reportId}-${categoryId}`,
          source: reportId,
          target: categoryId,
          label: 'reported for'
        });
      });
    }

    return { entities, links };
  }
}

export const abuseIPDBService = new AbuseIPDBService();
