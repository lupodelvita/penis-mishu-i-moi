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
            id: `ip-${ip}-${Date.now()}`,
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
      name: 'Username Search',
      description: 'Search for username across social platforms',
      category: 'Social',
      inputTypes: ['username', 'person'],
      outputTypes: ['social_profile'],
      icon: '👤',
      execute: async (input) => {
        try {
          const username = input.value;
          const socialPlatforms = [
            { name: 'Twitter/X', url: 'https://twitter.com/', icon: '𝕏' },
            { name: 'GitHub', url: 'https://github.com/', icon: '💻' },
            { name: 'Instagram', url: 'https://instagram.com/', icon: '📷' },
            { name: 'LinkedIn', url: 'https://linkedin.com/in/', icon: '💼' },
            { name: 'Reddit', url: 'https://reddit.com/user/', icon: '🤖' },
            { name: 'YouTube', url: 'https://youtube.com/@', icon: '📺' },
            { name: 'Facebook', url: 'https://facebook.com/', icon: '👥' },
            { name: 'Telegram', url: 'https://t.me/', icon: '✈️' }
          ];
          
          // Note: Real username search requires checking HTTP status codes which might be blocked by CORS/Rate limits if done from server without proxies.
          // This implementation assumes validity or should ideally use specific APIs.
          // For now, we return "Potential" profiles based on structure.
          
          const entities = socialPlatforms.map((platform, index) => ({
             id: `social-${username}-${index}-${Date.now()}`,
             type: 'social_profile',
             value: `${platform.icon} ${platform.name}: ${username}`,
             data: { 
                 label: `${platform.name}: ${username}`, 
                 type: 'social_profile', 
                 color: '#06b6d4',
                 url: platform.url + username
             },
             properties: { platform: platform.name, username, url: platform.url + username, status: 'potential' }
          }));

          const links = entities.map(entity => ({
             id: `link-${input.id}-${entity.id}`,
             source: input.id,
             target: entity.id,
             label: 'possible profile'
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
        return { success: false, error: 'Not yet implemented - coming soon' };
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
      name: 'Security Headers Check',
      description: 'Analyze HTTP security headers',
      category: 'Security',
      inputTypes: ['domain', 'url'],
      outputTypes: ['vulnerability'],
      icon: '🛡️',
      execute: async (input) => {
        return { success: false, error: 'Not yet implemented - security scan coming soon' };
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
