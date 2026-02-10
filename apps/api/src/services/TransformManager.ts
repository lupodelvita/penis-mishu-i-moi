import { nmapService } from './osint/NmapService';
import { whoisService } from './osint/WhoisService';
import { techStackService } from './osint/TechStackService';
import { dnsReconService } from './osint/DNSReconService';
import { shodanService } from './osint/ShodanService';
import { oathNetService } from './osint/OathNetService';
import { geoLocationService } from './osint/GeoLocationService';
import * as dns from 'dns/promises';

export interface Transform {
  id: string;
  name: string;
  description: string;
  category: string;
  inputTypes: string[]; // Entity types this transform accepts
  outputTypes: string[]; // Entity types this transform produces
  icon?: string;
  requiresApiKey?: boolean;
  execute: (input: any, params?: any) => Promise<TransformResult>;
}

export interface TransformResult {
  success: boolean;
  entities?: any[];
  links?: any[];
  error?: string;
  metadata?: any;
}

export class TransformManager {
  private transforms: Map<string, Transform> = new Map();

  constructor() {
    this.registerDefaultTransforms();
  }

  /**
   * Register all default OSINT transforms
   */
  private registerDefaultTransforms() {
    // Network Intelligence
    this.registerTransform({
      id: 'nmap_quick_scan',
      name: 'Nmap Quick Scan',
      description: 'Fast port scan (top 100 ports, ~10s)',
      category: 'Network Intelligence',
      inputTypes: ['ip_address', 'domain'],
      outputTypes: ['port', 'vulnerability'],
      icon: '🔍',
      execute: async (input) => {
        try {
          const target = input.value;
          const result = await nmapService.scan({ target, scanType: 'quick' });
          
          if (!result.success) {
            return { success: false, error: result.error };
          }

          const graphData = nmapService.convertToEntities(result);
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: { duration: result.duration }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'nmap_full_scan',
      name: 'Nmap Full Scan',
      description: 'Complete scan with OS detection (2-5 min)',
      category: 'Network Intelligence',
      inputTypes: ['ip_address', 'domain'],
      outputTypes: ['port', 'vulnerability'],
      icon: '🔬',
      execute: async (input) => {
        try {
          const target = input.value;
          const result = await nmapService.scan({ target, scanType: 'full' });
          
          if (!result.success) {
            return { success: false, error: result.error };
          }

          const graphData = nmapService.convertToEntities(result);
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: { duration: result.duration, os: result.host?.os }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'shodan_lookup',
      name: 'Shodan IoT Lookup',
      description: 'Search Shodan for host information and vulnerabilities',
      category: 'Network Intelligence',
      inputTypes: ['ip_address'],
      outputTypes: ['port', 'vulnerability', 'organization'],
      icon: '🌐',
      requiresApiKey: true,
      execute: async (input) => {
        try {
          if (!shodanService.isConfigured()) {
            return { success: false, error: 'Shodan API key not configured' };
          }

          const hostInfo = await shodanService.getHostInfo(input.value);
          
          if (!hostInfo) {
            return { success: false, error: 'No information found for this IP' };
          }

          const graphData = shodanService.convertToEntities(hostInfo);
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: { 
              organization: hostInfo.organization,
              country: hostInfo.country,
              vulnsCount: hostInfo.vulns?.length || 0
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'dns_resolve',
      name: 'Domain to IP',
      description: 'Resolve domain to IP address',
      category: 'DNS',
      inputTypes: ['domain'],
      outputTypes: ['ip_address'],
      icon: '🌐',
      execute: async (input) => {
        try {
          const domain = input.value;
          const addresses = await dns.resolve4(domain);
          
          if (!addresses || addresses.length === 0) {
            return { success: false, error: 'No IP addresses found' };
          }

          const entities = addresses.map(ip => ({
            id: `ip-${ip}`, // Deterministic ID to prevent duplicates
            type: 'ip_address',
            value: ip,
            data: { label: ip, type: 'ip_address', color: '#f59e0b' },
            properties: { source: 'DNS' }
          }));

          const links = entities.map(entity => ({
            id: `link-${input.id}-${entity.id}`,
            source: input.id,
            target: entity.id,
            label: 'resolves to'
          }));

          return { success: true, entities, links, metadata: { count: addresses.length } };
        } catch (error: any) {
             return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'username_search',
      name: 'Username Search (Maigret-lite)',
      description: 'Check username availability across platforms (15+ sites)',
      category: 'Social',
      inputTypes: ['username', 'person'],
      outputTypes: ['social_profile'],
      icon: '🕵️',
      execute: async (input) => {
        try {
          const username = input.value;
          const platforms = [
            { name: 'Twitter/X', url: 'https://twitter.com/', checkUrl: 'https://nitter.net/', icon: '𝕏' },
            { name: 'GitHub', url: 'https://github.com/', checkUrl: 'https://github.com/', icon: '💻' },
            { name: 'Instagram', url: 'https://instagram.com/', checkUrl: 'https://www.instagram.com/', icon: '📷' },
            { name: 'Facebook', url: 'https://facebook.com/', checkUrl: 'https://www.facebook.com/', icon: '👥' },
            { name: 'Telegram', url: 'https://t.me/', checkUrl: 'https://t.me/', icon: '✈️' },
            { name: 'Reddit', url: 'https://reddit.com/user/', checkUrl: 'https://www.reddit.com/user/', icon: '🤖' },
            { name: 'YouTube', url: 'https://youtube.com/@', checkUrl: 'https://www.youtube.com/@', icon: '📺' },
            { name: 'Twitch', url: 'https://twitch.tv/', checkUrl: 'https://m.twitch.tv/', icon: '🎮' },
            { name: 'Pinterest', url: 'https://pinterest.com/', checkUrl: 'https://www.pinterest.com/', icon: '📌' },
            { name: 'TikTok', url: 'https://tiktok.com/@', checkUrl: 'https://www.tiktok.com/@', icon: '🎵' },
            { name: 'Vimeo', url: 'https://vimeo.com/', checkUrl: 'https://vimeo.com/', icon: '🎥' },
            { name: 'SoundCloud', url: 'https://soundcloud.com/', checkUrl: 'https://soundcloud.com/', icon: '☁️' },
            { name: 'DeviantArt', url: 'https://deviantart.com/', checkUrl: 'https://www.deviantart.com/', icon: '🎨' },
            { name: 'About.me', url: 'https://about.me/', checkUrl: 'https://about.me/', icon: '👤' },
            { name: 'Flickr', url: 'https://flickr.com/people/', checkUrl: 'https://www.flickr.com/people/', icon: '📷' }
          ];

          const results: any[] = [];
          
          // Concurrent checks with batching
          const batchSize = 5;
          for (let i = 0; i < platforms.length; i += batchSize) {
             const batch = platforms.slice(i, i + batchSize);
             const promises = batch.map(async (p) => {
                 try {
                     const targetUrl = p.checkUrl + username;
                     const response = await fetch(targetUrl, { 
                         method: 'HEAD',
                         redirect: 'follow', // Follow redirects for accurate status
                         signal: AbortSignal.timeout(5000) // 5s timeout
                     }).catch(() => null); // Catch network errors

                     // Basic status check (200 OK usually means exists, 404 means free/banned)
                     // Note: Many sites block HEAD or require headers, this is "best effort"
                     if (response && response.status === 200) {
                         return { ...p, found: true, actualUrl: p.url + username };
                     }
                 } catch (e) {
                     // Ignore errors
                 }
                 return null;
             });
             
             const batchResults = await Promise.all(promises);
             results.push(...batchResults.filter(r => r !== null));
             
             // Tiny delay to avoid aggressive rate limiting
             await new Promise(r => setTimeout(r, 500)); 
          }

          if (results.length === 0) {
              return { success: true, entities: [], links: [], metadata: { message: 'No profiles found (or blocked)' } };
          }

          const entities = results.map(p => ({
             id: `social-${username}-${p.name}-${Date.now()}`,
             type: 'social_profile',
             value: p.name,
             data: { 
                 label: `${p.name}: ${username}`, 
                 type: 'social_profile', 
                 color: '#06b6d4',
                 url: p.actualUrl,
                 platform: p.name
             },
             properties: { platform: p.name, username, url: p.actualUrl, status: 'verified' }
          }));

          const links = entities.map(entity => ({
             id: `link-${input.id}-${entity.id}`,
             source: input.id,
             target: entity.id,
             label: 'profile found'
          }));

          return { success: true, entities, links, metadata: { count: entities.length } };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    // Domain Intelligence
    this.registerTransform({
      id: 'whois_lookup',
      name: 'WHOIS Lookup',
      description: 'Get domain registration information and DNS records',
      category: 'Domain Intelligence',
      inputTypes: ['domain'],
      outputTypes: ['organization', 'email_address', 'ip_address', 'domain'],
      icon: '📋',
      execute: async (input) => {
        try {
          const intelligence = await whoisService.getDomainIntelligence(input.value);
          const graphData = whoisService.convertToEntities(intelligence);
          
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              registrar: intelligence.whois?.registrar,
              created: intelligence.whois?.createdDate
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'tech_stack_detection',
      name: 'Tech Stack Detection',
      description: 'Identify technologies used by a website',
      category: 'Domain Intelligence',
      inputTypes: ['domain', 'url'],
      outputTypes: ['technology'],
      icon: '⚙️',
      execute: async (input) => {
        try {
          const url = input.type === 'url' ? input.value : `https://${input.value}`;
          const techStack = await techStackService.detectTechnologies(url);
          const graphData = techStackService.convertToEntities(techStack);
          
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              technologiesFound: techStack.technologies.length,
              categories: [...new Set(techStack.technologies.flatMap(t => t.categories))]
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'subdomain_enumeration',
      name: 'Subdomain Enumeration',
      description: 'Discover subdomains using DNS bruteforce (75+ wordlist)',
      category: 'Domain Intelligence',
      inputTypes: ['domain'],
      outputTypes: ['domain', 'ip_address'],
      icon: '🔎',
      execute: async (input) => {
        try {
          const dnsRecon = await dnsReconService.enumerateSubdomains(input.value);
          const graphData = dnsReconService.convertToEntities(dnsRecon);
          
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              totalFound: dnsRecon.totalFound,
              subdomains: dnsRecon.subdomains.map(s => s.subdomain)
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    // OathNet Transforms (Breach & OSINT)
    this.registerTransform({
      id: 'oathnet_breach_check',
      name: 'Breach Database Check',
      description: 'Search for data breaches (Email/Username/Phone)',
      category: 'OSINT',
      inputTypes: ['email_address', 'username', 'phone_number', 'ip_address'],
      outputTypes: ['breach', 'credentials'],
      icon: '🔓',
      requiresApiKey: true,
      execute: async (input) => {
        try {
          // Map transform input type to OathNet type
          let type: 'email' | 'username' | 'phone' | 'ip' = 'email';
          if (input.type === 'username') type = 'username';
          if (input.type === 'phone_number') type = 'phone';
          if (input.type === 'ip_address') type = 'ip';

          // For email type, double check it looks like an email, otherwise assume username
          if (input.type === 'email_address' && !input.value.includes('@')) {
             type = 'username';
          }

          const response = await oathNetService.searchBreach(input.value, type);
          
          if (!response.success && response.message !== 'No results found') {
             return { success: false, error: response.message };
          }

          const graphData = oathNetService.convertBreachToEntities(input.value, response.data?.results || []);
          
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              lookupsLeft: response.lookups_left,
              resultsCount: response.data?.results_found || 0
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'oathnet_discord_lookup',
      name: 'Discord User Lookup',
      description: 'Get Discord profile info from User ID',
      category: 'OSINT',
      inputTypes: ['discord_id', 'username'],
      outputTypes: ['social_profile'],
      icon: '🎮',
      requiresApiKey: true,
      execute: async (input) => {
        try {
          // Only works if input is numeric ID (snowflake)
          if (!/^\d+$/.test(input.value)) {
            return { success: false, error: 'Input must be a valid Discord User ID (numeric)' };
          }

          const response = await oathNetService.discordLookup(input.value);
          const data = response.data;

          if (!data) {
             return { success: false, error: 'Discord user not found' };
          }

          // Create Discord Entity
          const entities = [{
            id: `discord-${data.id}`,
            type: 'social_profile',
            value: data.username,
            data: {
              label: `${data.username}${data.discriminator && data.discriminator !== '0' ? '#' + data.discriminator : ''}`,
              platform: 'Discord',
              userId: data.id,
              avatar: data.avatar,
              banner: data.banner,
              badges: data.badges || [],
              created: data.created_at,
              color: '#5865F2'
            }
          }];

          return {
            success: true,
            entities,
            links: [],
            metadata: { badges: data.public_flags_array }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    // Additional DNS Transforms (from original file)
    this.registerTransform({
      id: 'dns_mx_records',
      name: 'MX Records Lookup',
      description: 'Get mail server records for domain',
      category: 'DNS',
      inputTypes: ['domain'],
      outputTypes: ['domain'],
      icon: '📧',
      execute: async (input) => {
        try {
          const domain = input.value;
          const records = await dns.resolveMx(domain);
          
          if (!records || records.length === 0) {
            return { success: false, error: 'No MX records found' };
          }

          const entities = records.map(record => ({
            id: `domain-${record.exchange}`, // Deterministic ID
            type: 'domain',
            value: record.exchange,
            data: { label: record.exchange, type: 'domain', color: '#3b82f6' },
            properties: { priority: record.priority, source: 'MX Record' }
          }));

          const links = entities.map(entity => ({
            id: `link-${input.id}-${entity.id}`,
            source: input.id,
            target: entity.id,
            label: `MX (prio ${entity.properties.priority})`
          }));

          return { success: true, entities, links, metadata: { count: records.length } };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'dns_txt_records',
      name: 'TXT Records Lookup',
      description: 'Get TXT records (SPF, DKIM, DMARC)',
      category: 'DNS',
      inputTypes: ['domain'],
      outputTypes: ['text'],
      icon: '📝',
      execute: async (input) => {
        return { success: false, error: 'Not yet implemented - coming soon' };
      }
    });

    // Security Transforms (placeholders from original file)
    this.registerTransform({
      id: 'security_headers_check',
      name: 'Security Headers Analysis',
      description: 'Check for critical security headers (HSTS, CSP, X-Frame, etc.)',
      category: 'Security',
      inputTypes: ['domain', 'url'],
      outputTypes: ['vulnerability'],
      icon: '🛡️',
      execute: async (input) => {
        try {
            const url = input.type === 'url' ? input.value : `https://${input.value}`;
            const response = await fetch(url, { method: 'HEAD' });
            const headers = response.headers;
            
            const vulnerabilities: any[] = [];
            
            const criticalHeaders = [
                { name: 'Strict-Transport-Security', missingSeverity: 'Medium' },
                { name: 'Content-Security-Policy', missingSeverity: 'High' },
                { name: 'X-Frame-Options', missingSeverity: 'Medium' },
                { name: 'X-Content-Type-Options', missingSeverity: 'Low' },
                { name: 'Referrer-Policy', missingSeverity: 'Low' }
            ];

            criticalHeaders.forEach(check => {
                if (!headers.has(check.name.toLowerCase())) {
                    vulnerabilities.push({
                        id: `vuln-${check.name}-${Date.now()}`,
                        type: 'vulnerability',
                        value: `Missing ${check.name}`,
                        data: {
                            label: `Missing ${check.name}`,
                            severity: check.missingSeverity,
                            description: `The ${check.name} header is missing, which could expose the site to attacks.`,
                            color: check.missingSeverity === 'High' ? '#ef4444' : '#f59e0b'
                        }
                    });
                }
            });

            const links = vulnerabilities.map(v => ({
                id: `link-${input.id}-${v.id}`,
                source: input.id,
                target: v.id,
                label: 'vulnerability'
            }));

            return { 
                success: true, 
                entities: vulnerabilities, 
                links, 
                metadata: { score: 100 - (vulnerabilities.length * 20) } 
            };
        } catch (e: any) {
            return { success: false, error: 'Failed to access site headers: ' + e.message };
        }
      }
    });

    this.registerTransform({
      id: 'security_ssl_check',
      name: 'SSL Certificate Analysis',
      description: 'Check SSL/TLS certificate validity and configuration',
      category: 'Security',
      inputTypes: ['domain'],
      outputTypes: ['vulnerability', 'organization'],
      icon: '🔐',
      execute: async (input) => {
        return { success: false, error: 'Not yet implemented - SSL analysis coming soon' };
      }
    });

    // Blockchain Transforms (placeholders from original file)
    this.registerTransform({
      id: 'crypto_btc_balance',
      name: 'Bitcoin Balance Check',
      description: 'Check Bitcoin address balance and transactions',
      category: 'Blockchain',
      inputTypes: ['crypto_address'],
      outputTypes: ['transaction'],
      icon: '₿',
      execute: async (input) => {
        return { success: false, error: 'Not yet implemented - blockchain integration coming soon' };
      }
    });

    this.registerTransform({
      id: 'crypto_eth_balance',
      name: 'Ethereum Balance Check',
      description: 'Check Ethereum address balance and tokens',
      category: 'Blockchain',
      inputTypes: ['crypto_address'],
      outputTypes: ['transaction'],
      icon: 'Ξ',
      execute: async (input) => {
        return { success: false, error: 'Not yet implemented - blockchain integration coming soon' };
      }
    });

    // Geolocation Transforms
    this.registerTransform({
      id: 'geo_ip_location',
      name: 'IP Geolocation',
      description: 'Get geographical location from IP address',
      category: 'Geolocation',
      inputTypes: ['ip_address'],
      outputTypes: ['location'],
      icon: '🌍',
      execute: async (input) => {
        try {
          const geoData = await geoLocationService.getLocationFromIP(input.value);
          
          if (!geoData) {
            return { success: false, error: 'Could not determine location for this IP' };
          }

          const graphData = geoLocationService.ipToLocationEntity(input.value, geoData);
          
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              city: geoData.city,
              country: geoData.country,
              coordinates: `${geoData.latitude}, ${geoData.longitude}`,
              isp: geoData.isp
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });
  }

  /**
   * Register a new transform
   */
  registerTransform(transform: Transform) {
    this.transforms.set(transform.id, transform);
  }

  /**
   * Get all available transforms
   */
  getAllTransforms(): Transform[] {
    return Array.from(this.transforms.values());
  }

  /**
   * Get transforms by category
   */
  getTransformsByCategory(category: string): Transform[] {
    return this.getAllTransforms().filter(t => t.category === category);
  }

  /**
   * Get transforms available for an entity type
   */
  getTransformsForEntityType(entityType: string): Transform[] {
    return this.getAllTransforms().filter(t => 
      t.inputTypes.includes(entityType)
    );
  }

  /**
   * Get transform by ID
   */
  getTransform(id: string): Transform | undefined {
    return this.transforms.get(id);
  }

  /**
   * Execute a transform
   */
  async executeTransform(transformId: string, input: any, params?: any): Promise<TransformResult> {
    const transform = this.getTransform(transformId);
    
    if (!transform) {
      return {
        success: false,
        error: `Transform ${transformId} not found`
      };
    }

    // Check if input type is valid
    if (!transform.inputTypes.includes(input.type)) {
      return {
        success: false,
        error: `Transform ${transform.name} does not accept ${input.type} entities`
      };
    }

    try {
      return await transform.execute(input, params);
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Transform execution failed'
      };
    }
  }

  /**
   * Get all categories
   */
  getCategories(): string[] {
    const categories = new Set<string>();
    this.getAllTransforms().forEach(t => categories.add(t.category));
    return Array.from(categories).sort();
  }
}

export const transformManager = new TransformManager();
