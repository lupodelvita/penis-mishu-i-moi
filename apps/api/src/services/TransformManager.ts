import { nmapService } from './osint/NmapService';
import { whoisService } from './osint/WhoisService';
import { techStackService } from './osint/TechStackService';
import { dnsReconService } from './osint/DNSReconService';
import { shodanService } from './osint/ShodanService';
import { oathNetService } from './osint/OathNetService';
import { geoLocationService } from './osint/GeoLocationService';
import { haveIBeenPwnedService } from './osint/HaveIBeenPwnedService';
import { alienVaultService } from './osint/AlienVaultService';
import { certificateTransparencyService } from './osint/CertificateTransparencyService';
import { urlScanService } from './osint/URLScanService';
import { hunterService } from './osint/HunterService';
import { threatCrowdService } from './osint/ThreatCrowdService';
import { breachVIPService } from './osint/BreachVIPService';
import { virusTotalService } from './osint/VirusTotalService';
import { greyNoiseService } from './osint/GreyNoiseService';
import { abuseIPDBService } from './osint/AbuseIPDBService';
import { gitHubService } from './osint/GitHubService';
import { phishTankService } from './osint/PhishTankService';
import { clearbitService } from './osint/ClearbitService';
import { securityTrailsService } from './osint/SecurityTrailsService';
import { censysService } from './osint/CensysService';
import { binaryEdgeService } from './osint/BinaryEdgeService';
import { fullContactService } from './osint/FullContactService';
import { emailRepService } from './osint/EmailRepService';
import { rateLimitTracker } from './RateLimitTracker';
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
      inputTypes: ['discord_id', 'username', 'person'],
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
      id: 'dns.mx_records',
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
        try {
          const domain = input.value;
          const txtRecords = await dns.resolveTxt(domain);
          
          if (!txtRecords || txtRecords.length === 0) {
            return { success: true, entities: [], links: [], metadata: { message: 'No TXT records found' } };
          }

          const entities: any[] = [];
          const links: any[] = [];

          txtRecords.forEach((record, index) => {
            const value = record.join('');
            let recordType = 'TXT';
            let color = '#64748b';
            
            if (value.startsWith('v=spf1')) { recordType = 'SPF'; color = '#22c55e'; }
            else if (value.startsWith('v=DMARC1')) { recordType = 'DMARC'; color = '#3b82f6'; }
            else if (value.startsWith('v=DKIM1')) { recordType = 'DKIM'; color = '#8b5cf6'; }
            else if (value.includes('google-site-verification')) { recordType = 'Google Verification'; color = '#f59e0b'; }
            else if (value.includes('MS=')) { recordType = 'Microsoft Verification'; color = '#0ea5e9'; }
            else if (value.includes('docusign')) { recordType = 'DocuSign'; color = '#ec4899'; }

            const entityId = `txt-${domain}-${index}-${Date.now()}`;
            entities.push({
              id: entityId,
              type: 'text',
              value: value.length > 80 ? value.substring(0, 77) + '...' : value,
              data: {
                label: `${recordType}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`,
                type: 'text',
                color,
                recordType,
                fullValue: value,
              },
              properties: { recordType, domain, fullValue: value }
            });

            links.push({
              id: `link-${input.id}-${entityId}`,
              source: input.id,
              target: entityId,
              label: recordType
            });
          });

          return { success: true, entities, links, metadata: { count: txtRecords.length } };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

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
            let url = input.type === 'url' ? input.value : `https://${input.value}`;
            if (!url.startsWith('http')) url = `https://${url}`;
            
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(url, { 
              method: 'GET',
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              },
              redirect: 'follow',
              signal: controller.signal
            });
            clearTimeout(timeout);
            
            const headers = response.headers;
            const vulnerabilities: any[] = [];
            
            const criticalHeaders = [
                { name: 'Strict-Transport-Security', missingSeverity: 'Medium', description: 'HSTS not enabled. Allows downgrade attacks to HTTP.' },
                { name: 'Content-Security-Policy', missingSeverity: 'High', description: 'No CSP. Site vulnerable to XSS and data injection attacks.' },
                { name: 'X-Frame-Options', missingSeverity: 'Medium', description: 'Clickjacking possible. Site can be embedded in iframes.' },
                { name: 'X-Content-Type-Options', missingSeverity: 'Low', description: 'MIME sniffing possible. Server should send nosniff.' },
                { name: 'Referrer-Policy', missingSeverity: 'Low', description: 'No referrer policy. May leak sensitive URL data.' },
                { name: 'Permissions-Policy', missingSeverity: 'Low', description: 'No permissions policy. Browser features unrestricted.' }
            ];

            const presentHeaders: string[] = [];

            criticalHeaders.forEach(check => {
                const headerValue = headers.get(check.name.toLowerCase());
                if (!headerValue) {
                    vulnerabilities.push({
                        id: `vuln-${check.name}-${Date.now()}`,
                        type: 'vulnerability',
                        value: `Missing ${check.name}`,
                        data: {
                            label: `⚠ Missing: ${check.name}`,
                            severity: check.missingSeverity,
                            description: check.description,
                            color: check.missingSeverity === 'High' ? '#ef4444' : check.missingSeverity === 'Medium' ? '#f59e0b' : '#64748b'
                        },
                        properties: { headerName: check.name, severity: check.missingSeverity, description: check.description }
                    });
                } else {
                    presentHeaders.push(`${check.name}: ${headerValue.substring(0, 60)}`);
                }
            });

            // Also check server header (info leak)
            const serverHeader = headers.get('server');
            if (serverHeader) {
                vulnerabilities.push({
                    id: `vuln-server-info-${Date.now()}`,
                    type: 'vulnerability',
                    value: `Server: ${serverHeader}`,
                    data: {
                        label: `ℹ Server Disclosure: ${serverHeader}`,
                        severity: 'Info',
                        description: `Server header reveals: ${serverHeader}. May help attackers fingerprint the server.`,
                        color: '#64748b'
                    },
                    properties: { headerName: 'Server', value: serverHeader, severity: 'Info' }
                });
            }

            const links = vulnerabilities.map(v => ({
                id: `link-${input.id}-${v.id}`,
                source: input.id,
                target: v.id,
                label: 'vulnerability'
            }));

            const score = Math.max(0, 100 - (vulnerabilities.filter(v => v.data.severity !== 'Info').length * 15));
            return { 
                success: true, 
                entities: vulnerabilities, 
                links, 
                metadata: { score, presentHeaders, missingCount: vulnerabilities.length } 
            };
        } catch (e: any) {
            if (e.name === 'AbortError') {
                return { success: false, error: 'Таймаут подключения к сайту (10 сек)' };
            }
            return { success: false, error: 'Не удалось подключиться: ' + (e.cause?.code || e.message) };
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
        try {
          const tls = require('tls');
          const domain = input.value.replace(/^https?:\/\//, '').split('/')[0];
          
          const certData = await new Promise<any>((resolve, reject) => {
            const socket = tls.connect(443, domain, { servername: domain, rejectUnauthorized: false }, () => {
              const cert = socket.getPeerCertificate(true);
              socket.end();
              resolve(cert);
            });
            socket.setTimeout(10000, () => { socket.destroy(); reject(new Error('Connection timeout')); });
            socket.on('error', (err: Error) => reject(err));
          });

          if (!certData || !certData.subject) {
            return { success: false, error: 'Could not retrieve SSL certificate' };
          }

          const entities: any[] = [];
          const links: any[] = [];
          const now = new Date();
          const validFrom = new Date(certData.valid_from);
          const validTo = new Date(certData.valid_to);
          const daysLeft = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const isExpired = daysLeft < 0;
          const isExpiringSoon = daysLeft >= 0 && daysLeft <= 30;

          // Certificate entity
          const certId = `ssl-cert-${domain}-${Date.now()}`;
          entities.push({
            id: certId,
            type: 'scan_result',
            value: `SSL: ${domain}`,
            data: {
              label: `🔐 SSL Certificate`,
              type: 'scan_result',
              color: isExpired ? '#ef4444' : isExpiringSoon ? '#f59e0b' : '#22c55e',
            },
            properties: {
              subject: certData.subject?.CN || domain,
              issuer: certData.issuer?.O || certData.issuer?.CN || 'Unknown',
              validFrom: validFrom.toISOString(),
              validTo: validTo.toISOString(),
              daysRemaining: daysLeft,
              serialNumber: certData.serialNumber,
              fingerprint: certData.fingerprint256?.substring(0, 30),
              protocol: 'TLS',
              status: isExpired ? 'EXPIRED' : isExpiringSoon ? 'EXPIRING SOON' : 'VALID',
              altNames: (certData.subjectaltname || '').split(', ').filter((s: string) => s.startsWith('DNS:')).map((s: string) => s.replace('DNS:', '')).join(', '),
            }
          });
          links.push({ id: `link-${input.id}-${certId}`, source: input.id, target: certId, label: 'ssl certificate' });

          // Issuer organization
          const issuerName = certData.issuer?.O || certData.issuer?.CN;
          if (issuerName) {
            const issuerId = `ca-${issuerName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;
            entities.push({
              id: issuerId,
              type: 'certificate_authority',
              value: issuerName,
              data: { label: `🏛 ${issuerName}`, type: 'certificate_authority', color: '#a3e635' },
              properties: { role: 'Certificate Authority', country: certData.issuer?.C }
            });
            links.push({ id: `link-${certId}-${issuerId}`, source: certId, target: issuerId, label: 'issued by' });
          }

          // Warnings
          if (isExpired) {
            const warnId = `vuln-ssl-expired-${Date.now()}`;
            entities.push({
              id: warnId, type: 'vulnerability', value: `SSL EXPIRED (${Math.abs(daysLeft)} days ago)`,
              data: { label: `🚨 SSL Expired`, severity: 'Critical', color: '#ef4444' },
              properties: { severity: 'Critical', expiredDays: Math.abs(daysLeft) }
            });
            links.push({ id: `link-${certId}-${warnId}`, source: certId, target: warnId, label: 'issue' });
          } else if (isExpiringSoon) {
            const warnId = `vuln-ssl-expiring-${Date.now()}`;
            entities.push({
              id: warnId, type: 'vulnerability', value: `SSL expires in ${daysLeft} days`,
              data: { label: `⚠ Expires in ${daysLeft}d`, severity: 'Medium', color: '#f59e0b' },
              properties: { severity: 'Medium', daysRemaining: daysLeft }
            });
            links.push({ id: `link-${certId}-${warnId}`, source: certId, target: warnId, label: 'warning' });
          }

          return { success: true, entities, links, metadata: { daysRemaining: daysLeft, issuer: issuerName, expired: isExpired } };
        } catch (error: any) {
          return { success: false, error: 'SSL analysis failed: ' + (error.code || error.message) };
        }
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

    // WHOIS IP Lookup — reverse lookup info for IP addresses
    this.registerTransform({
      id: 'whois_ip_lookup',
      name: 'WHOIS IP Lookup',
      description: 'Get WHOIS information for an IP address (owner, ASN, network)',
      category: 'Network Intelligence',
      inputTypes: ['ip_address'],
      outputTypes: ['organization', 'domain'],
      icon: '📋',
      execute: async (input) => {
        try {
          const ip = input.value;
          
          // Use ip-api.com (free, no key required, 45 req/min)
          const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,reverse,query`, {
            signal: AbortSignal.timeout(8000)
          });
          
          if (!response.ok) {
            return { success: false, error: 'WHOIS IP lookup failed: API error' };
          }
          
          const data = await response.json();
          
          if (data.status !== 'success') {
            return { success: false, error: data.message || 'IP not found in WHOIS database' };
          }

          const entities: any[] = [];
          const links: any[] = [];

          // ISP/Organization entity
          if (data.isp || data.org) {
            const orgId = `org-isp-${(data.isp || data.org).replace(/[\s.]/g, '-').toLowerCase()}-${Date.now()}`;
            entities.push({
              id: orgId,
              type: 'organization',
              value: data.isp || data.org,
              data: {
                label: data.isp || data.org,
                type: 'organization',
                color: '#8b5cf6',
              },
              properties: {
                role: 'ISP',
                organization: data.org,
                isp: data.isp,
                asn: data.as,
                asnName: data.asname,
              }
            });
            links.push({ id: `link-${input.id}-${orgId}`, source: input.id, target: orgId, label: 'owned by' });
          }

          // Reverse DNS entity
          if (data.reverse) {
            const reverseId = `domain-reverse-${data.reverse}-${Date.now()}`;
            entities.push({
              id: reverseId,
              type: 'domain',
              value: data.reverse,
              data: {
                label: data.reverse,
                type: 'domain',
                color: '#10b981',
              },
              properties: { source: 'Reverse DNS', ip }
            });
            links.push({ id: `link-${input.id}-${reverseId}`, source: input.id, target: reverseId, label: 'reverse DNS' });
          }

          // ASN entity
          if (data.as) {
            const asnId = `asn-${data.as.split(' ')[0]}-${Date.now()}`;
            entities.push({
              id: asnId,
              type: 'organization',
              value: data.as,
              data: {
                label: `🌐 ${data.as}`,
                type: 'organization',
                color: '#06b6d4',
              },
              properties: { asn: data.as, asnName: data.asname }
            });
            links.push({ id: `link-${input.id}-${asnId}`, source: input.id, target: asnId, label: 'ASN' });
          }

          return {
            success: true,
            entities,
            links,
            metadata: {
              isp: data.isp,
              org: data.org,
              asn: data.as,
              reverse: data.reverse,
              country: data.country,
              city: data.city
            }
          };
        } catch (error: any) {
          return { success: false, error: 'WHOIS IP lookup failed: ' + error.message };
        }
      }
    });

    // Breach Intelligence
    this.registerTransform({
      id: 'hibp_breach_check',
      name: 'HaveIBeenPwned Breach Check',
      description: 'Check if email appears in known data breaches',
      category: 'Breach Intelligence',
      inputTypes: ['email_address'],
      outputTypes: ['breach', 'data_leak', 'paste'],
      icon: '🔓',
      requiresApiKey: true,
      execute: async (input) => {
        try {
          if (!haveIBeenPwnedService.isConfigured()) {
            return { success: false, error: 'HaveIBeenPwned API key not configured (requires commercial tier)' };
          }

          const breaches = await haveIBeenPwnedService.getBreachesByEmail(input.value);
          const pastes = await haveIBeenPwnedService.getPastesByEmail(input.value);
          
          if (breaches.length === 0 && pastes.length === 0) {
            return { success: true, entities: [], links: [], metadata: { message: 'No breaches or pastes found' } };
          }

          const breachData = haveIBeenPwnedService.convertToEntities(input.value, breaches, pastes);
          
          return {
            success: true,
            entities: breachData.entities,
            links: breachData.links,
            metadata: {
              breachCount: breaches.length,
              pasteCount: pastes.length,
              totalPwnCount: breaches.reduce((sum, b) => sum + b.pwnCount, 0)
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'breachvip_email',
      name: 'BreachVIP Email Search',
      description: 'Search BreachVIP database by email',
      category: 'Breach Intelligence',
      inputTypes: ['email_address'],
      outputTypes: ['breach', 'credentials'],
      icon: '🔍',
      execute: async (input) => {
        try {
          const results = await breachVIPService.searchByEmail(input.value);
          const graphData = breachVIPService.convertToEntities(results, input.value);
          
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: { resultsCount: results.total }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'breachvip_username',
      name: 'BreachVIP Username Search',
      description: 'Search BreachVIP database by username',
      category: 'Breach Intelligence',
      inputTypes: ['username', 'person'],
      outputTypes: ['breach', 'credentials'],
      icon: '🔍',
      execute: async (input) => {
        try {
          const results = await breachVIPService.searchByUsername(input.value);
          const graphData = breachVIPService.convertToEntities(results, input.value);
          
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: { resultsCount: results.total }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'breachvip_phone',
      name: 'BreachVIP Phone Search',
      description: 'Search BreachVIP database by phone number',
      category: 'Breach Intelligence',
      inputTypes: ['phone_number'],
      outputTypes: ['breach', 'credentials'],
      icon: '📱',
      execute: async (input) => {
        try {
          const results = await breachVIPService.searchByPhone(input.value);
          const graphData = breachVIPService.convertToEntities(results, input.value);
          
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: { resultsCount: results.total }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'breachvip_domain',
      name: 'BreachVIP Domain Search',
      description: 'Find breached emails from domain',
      category: 'Breach Intelligence',
      inputTypes: ['domain'],
      outputTypes: ['breach', 'email_address'],
      icon: '🌐',
      execute: async (input) => {
        try {
          const results = await breachVIPService.searchByDomain(input.value);
          const graphData = breachVIPService.convertToEntities(results, input.value);
          
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: { resultsCount: results.total }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'breachvip_ip',
      name: 'BreachVIP IP Search',
      description: 'Search BreachVIP database by IP address',
      category: 'Breach Intelligence',
      inputTypes: ['ip_address'],
      outputTypes: ['breach', 'credentials'],
      icon: '🌐',
      execute: async (input) => {
        try {
          const results = await breachVIPService.searchByIP(input.value);
          const graphData = breachVIPService.convertToEntities(results, input.value);
          
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: { resultsCount: results.total }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    // Threat Intelligence
    this.registerTransform({
      id: 'alienvault_domain',
      name: 'AlienVault OTX Domain',
      description: 'Get threat intelligence for domain from AlienVault',
      category: 'Threat Intelligence',
      inputTypes: ['domain'],
      outputTypes: ['threat_intel', 'malware'],
      icon: '🛡️',
      execute: async (input) => {
        try {
          const indicator = await alienVaultService.getIndicator(input.value, 'domain');
          
          if (!indicator || !indicator.pulses || indicator.pulses.length === 0) {
            return { success: true, entities: [], links: [], metadata: { message: 'No threat intelligence found' } };
          }

          const graphData = alienVaultService.convertToEntities(input.value, indicator);
          
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              pulseCount: indicator.pulses.length,
              malwareFamilies: indicator.pulses.flatMap(p => p.malwareFamilies || [])
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'alienvault_ip',
      name: 'AlienVault OTX IP',
      description: 'Get threat intelligence and reputation for IP from AlienVault',
      category: 'Threat Intelligence',
      inputTypes: ['ip_address'],
      outputTypes: ['threat_intel', 'malware', 'location'],
      icon: '🛡️',
      execute: async (input) => {
        try {
          const [indicator, reputation] = await Promise.all([
            alienVaultService.getIndicator(input.value, 'IPv4'),
            alienVaultService.getIPReputation(input.value)
          ]);
          
          if (!indicator && !reputation) {
            return { success: true, entities: [], links: [], metadata: { message: 'No threat intelligence found' } };
          }

          const entities: any[] = [];
          const links: any[] = [];

          if (indicator) {
            const graphData = alienVaultService.convertToEntities(input.value, indicator);
            entities.push(...graphData.entities);
            links.push(...graphData.links);
          }
          
          return {
            success: true,
            entities,
            links,
            metadata: {
              reputation: reputation?.reputation,
              country: reputation?.country,
              pulseCount: indicator?.pulses?.length || 0
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'threatcrowd_domain',
      name: 'ThreatCrowd Domain',
      description: 'Get passive DNS, subdomains, and emails from ThreatCrowd',
      category: 'Threat Intelligence',
      inputTypes: ['domain'],
      outputTypes: ['ip_address', 'subdomain', 'email_address'],
      icon: '👥',
      execute: async (input) => {
        try {
          const data = await threatCrowdService.searchDomain(input.value);
          
          if (!data) {
            return { success: true, entities: [], links: [], metadata: { message: 'No data found' } };
          }

          const graphData = threatCrowdService.convertDomainToEntities(input.value, data);
          
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              ipsFound: data.resolutions?.length || 0,
              subdomainsFound: data.subdomains?.length || 0,
              emailsFound: data.emails?.length || 0
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'threatcrowd_ip',
      name: 'ThreatCrowd IP',
      description: 'Get domains and malware hashes associated with IP',
      category: 'Threat Intelligence',
      inputTypes: ['ip_address'],
      outputTypes: ['domain', 'file_hash'],
      icon: '👥',
      execute: async (input) => {
        try {
          const data = await threatCrowdService.searchIP(input.value);
          
          if (!data) {
            return { success: true, entities: [], links: [], metadata: { message: 'No data found' } };
          }

          const graphData = threatCrowdService.convertIPToEntities(input.value, data);
          
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              domainsFound: data.resolutions?.length || 0,
              hashesFound: data.hashes?.length || 0
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    // Domain Intelligence - Additional
    this.registerTransform({
      id: 'cert_transparency',
      name: 'Certificate Transparency',
      description: 'Find subdomains via SSL certificate logs (crt.sh)',
      category: 'Domain Intelligence',
      inputTypes: ['domain'],
      outputTypes: ['subdomain', 'certificate_authority'],
      icon: '🔐',
      execute: async (input) => {
        try {
          const certificates = await certificateTransparencyService.searchDomain(input.value);
          
          if (!certificates || certificates.length === 0) {
            return { success: true, entities: [], links: [], metadata: { message: 'No certificates found' } };
          }

          const graphData = certificateTransparencyService.convertToEntities(input.value, certificates);
          
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              certificatesFound: certificates.length,
              subdomainsFound: graphData.entities.filter(e => e.type === 'subdomain').length
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'hunter_email_finder',
      name: 'Hunter Email Finder',
      description: 'Find email addresses associated with domain',
      category: 'Domain Intelligence',
      inputTypes: ['domain'],
      outputTypes: ['email_address', 'person'],
      icon: '🎯',
      requiresApiKey: true,
      execute: async (input) => {
        try {
          if (!hunterService.isConfigured()) {
            return { success: false, error: 'Hunter.io API key not configured (25 searches/month free)' };
          }

          const data = await hunterService.searchDomain(input.value);
          
          if (!data || !data.emails || data.emails.length === 0) {
            return { success: true, entities: [], links: [], metadata: { message: 'No emails found for this domain' } };
          }

          const graphData = hunterService.convertToEntities(data);
          
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              emailsFound: data.emails.length,
              pattern: data.pattern,
              organization: data.organization
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    // Security - Website Analysis
    this.registerTransform({
      id: 'urlscan_website',
      name: 'URLScan Website Analysis',
      description: 'Scan website for security, tech stack, and threats',
      category: 'Security',
      inputTypes: ['domain', 'url'],
      outputTypes: ['ip_address', 'technology', 'threat'],
      icon: '🔬',
      requiresApiKey: true,
      execute: async (input) => {
        try {
          if (!urlScanService.isConfigured()) {
            return { success: false, error: 'URLScan.io API key not configured (free tier available)' };
          }

          const url = input.type === 'url' ? input.value : `https://${input.value}`;
          const scan = await urlScanService.submitScan(url, 'public');
          
          if (!scan || !scan.uuid) {
            return { success: false, error: 'Failed to submit scan' };
          }

          // Wait for scan to complete (max 60 seconds)
          let result = null;
          for (let i = 0; i < 12; i++) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            result = await urlScanService.getResult(scan.uuid);
            if (result) break;
          }

          if (!result) {
            return { success: false, error: 'Scan timeout - try searching for existing results instead' };
          }

          const graphData = urlScanService.convertToEntities(result);
          
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              screenshot: result.screenshot,
              malicious: result.verdicts?.overall?.malicious || false,
              score: result.verdicts?.overall?.score
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    // Advanced Threat Intelligence
    this.registerTransform({
      id: 'virustotal_domain',
      name: 'VirusTotal Domain Scan',
      description: 'Check domain reputation across 70+ engines',
      category: 'Threat Intelligence',
      inputTypes: ['domain'],
      outputTypes: ['threat', 'category'],
      icon: '🦠',
      requiresApiKey: true,
      execute: async (input) => {
        try {
          if (!virusTotalService.isConfigured()) {
            return { success: false, error: 'VirusTotal API key not configured (free tier: 4 req/min, 500/day)' };
          }

          const report = await virusTotalService.analyzeDomain(input.value);
          
          if (!report) {
            return { success: true, entities: [], links: [], metadata: { message: 'Domain not found in VirusTotal' } };
          }

          const graphData = virusTotalService.convertDomainToEntities(report, input.value);
          
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              reputation: report.attributes.reputation,
              malicious: report.attributes.last_analysis_stats.malicious,
              suspicious: report.attributes.last_analysis_stats.suspicious,
              harmless: report.attributes.last_analysis_stats.harmless
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'virustotal_ip',
      name: 'VirusTotal IP Scan',
      description: 'Check IP reputation across 70+ engines',
      category: 'Threat Intelligence',
      inputTypes: ['ip_address'],
      outputTypes: ['threat', 'organization'],
      icon: '🦠',
      requiresApiKey: true,
      execute: async (input) => {
        try {
          if (!virusTotalService.isConfigured()) {
            return { success: false, error: 'VirusTotal API key not configured (free tier: 4 req/min, 500/day)' };
          }

          const report = await virusTotalService.analyzeIP(input.value);
          
          if (!report) {
            return { success: true, entities: [], links: [], metadata: { message: 'IP not found in VirusTotal' } };
          }

          const graphData = virusTotalService.convertIPToEntities(report, input.value);
          
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              reputation: report.attributes.reputation,
              malicious: report.attributes.last_analysis_stats.malicious,
              country: report.attributes.country,
              asn: report.attributes.asn
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'virustotal_url',
      name: 'VirusTotal URL Scan',
      description: 'Scan URL for malware and phishing',
      category: 'Security',
      inputTypes: ['url'],
      outputTypes: ['threat'],
      icon: '🦠',
      requiresApiKey: true,
      execute: async (input) => {
        try {
          if (!virusTotalService.isConfigured()) {
            return { success: false, error: 'VirusTotal API key not configured (free tier: 4 req/min, 500/day)' };
          }

          const report = await virusTotalService.analyzeURL(input.value);
          
          if (!report) {
            return { success: false, error: 'URL not yet scanned - submitted for analysis, try again in 30 seconds' };
          }

          const graphData = virusTotalService.convertURLToEntities(report, input.value);
          
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              malicious: report.attributes.last_analysis_stats.malicious,
              suspicious: report.attributes.last_analysis_stats.suspicious
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'greynoise_ip',
      name: 'GreyNoise IP Context',
      description: 'Identify internet noise vs targeted attacks',
      category: 'Threat Intelligence',
      inputTypes: ['ip_address'],
      outputTypes: ['threat_intel', 'service', 'organization'],
      icon: '🔇',
      execute: async (input) => {
        try {
          const data = await greyNoiseService.getCommunityData(input.value);
          
          if (!data) {
            return { success: true, entities: [], links: [], metadata: { message: 'IP not observed by GreyNoise' } };
          }

          const graphData = greyNoiseService.convertCommunityToEntities(data, input.value);
          
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              classification: data.classification,
              noise: data.noise,
              riot: data.riot,
              service: data.name
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'abuseipdb_check',
      name: 'AbuseIPDB Reputation',
      description: 'Check IP against abuse database',
      category: 'Threat Intelligence',
      inputTypes: ['ip_address'],
      outputTypes: ['threat_intel', 'organization', 'threat'],
      icon: '🚫',
      requiresApiKey: true,
      execute: async (input) => {
        try {
          if (!abuseIPDBService.isConfigured()) {
            return { success: false, error: 'AbuseIPDB API key not configured (1000 requests/day free)' };
          }

          const report = await abuseIPDBService.checkIP(input.value, 90, true);
          
          if (!report) {
            return { success: false, error: 'Failed to check IP' };
          }

          const graphData = abuseIPDBService.convertToEntities(report, input.value);
          
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              abuseScore: report.abuseConfidenceScore,
              totalReports: report.totalReports,
              country: report.countryName,
              isp: report.isp
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'phishtank_url',
      name: 'PhishTank URL Check',
      description: 'Check if URL is a known phishing site',
      category: 'Security',
      inputTypes: ['url', 'domain'],
      outputTypes: ['threat', 'organization', 'ip_address'],
      icon: '🎣',
      execute: async (input) => {
        try {
          const url = input.type === 'url' ? input.value : `https://${input.value}`;
          const result = await phishTankService.checkURL(url);
          
          if (!result) {
            return { success: true, entities: [], links: [], metadata: { message: 'Not found in PhishTank database' } };
          }

          const graphData = phishTankService.convertToEntities(result, url);
          
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              verified: result.verified === 'yes',
              online: result.online === 'yes',
              target: result.target,
              phish_id: result.phish_id
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    // People Intelligence
    this.registerTransform({
      id: 'github_user',
      name: 'GitHub User Lookup',
      description: 'Find GitHub profile and repositories',
      category: 'People Intelligence',
      inputTypes: ['username', 'person'],
      outputTypes: ['person', 'email_address', 'url', 'organization'],
      icon: '💻',
      execute: async (input) => {
        try {
          const user = await gitHubService.getUser(input.value);
          
          if (!user) {
            return { success: false, error: 'GitHub user not found' };
          }

          const graphData = gitHubService.convertUserToEntities(user);
          
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              repos: user.public_repos,
              followers: user.followers,
              location: user.location,
              company: user.company
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'github_code_search',
      name: 'GitHub Code Leak Search',
      description: 'Search for leaked credentials or secrets in code',
      category: 'Security',
      inputTypes: ['email_address', 'domain', 'api_key'],
      outputTypes: ['data_leak'],
      icon: '🔓',
      execute: async (input) => {
        try {
          const results = await gitHubService.searchCode(input.value);
          
          if (!results || results.length === 0) {
            return { success: true, entities: [], links: [], metadata: { message: 'No code leaks found' } };
          }

          const graphData = gitHubService.convertCodeSearchToEntities(results, input.value);
          
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              leaksFound: results.length
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'clearbit_company',
      name: 'Clearbit Company Enrichment',
      description: 'Enrich company data from domain',
      category: 'People Intelligence',
      inputTypes: ['domain'],
      outputTypes: ['organization', 'phone_number', 'email_address', 'technology'],
      icon: '🏢',
      requiresApiKey: true,
      execute: async (input) => {
        try {
          if (!clearbitService.isConfigured()) {
            return { success: false, error: 'Clearbit API key not configured' };
          }

          const company = await clearbitService.enrichCompany(input.value);
          
          if (!company) {
            return { success: true, entities: [], links: [], metadata: { message: 'Company not found' } };
          }

          const graphData = clearbitService.convertCompanyToEntities(company, input.value);
          
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              name: company.name,
              employees: company.metrics?.employees,
              industry: company.category?.industry,
              founded: company.foundedYear
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'clearbit_person',
      name: 'Clearbit Person Enrichment',
      description: 'Enrich person data from email',
      category: 'People Intelligence',
      inputTypes: ['email_address'],
      outputTypes: ['person', 'organization'],
      icon: '👤',
      requiresApiKey: true,
      execute: async (input) => {
        try {
          if (!clearbitService.isConfigured()) {
            return { success: false, error: 'Clearbit API key not configured' };
          }

          const person = await clearbitService.enrichPerson(input.value);
          
          if (!person) {
            return { success: true, entities: [], links: [], metadata: { message: 'Person not found' } };
          }

          const graphData = clearbitService.convertPersonToEntities(person, input.value);
          
          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              name: person.name.fullName,
              title: person.employment?.title,
              company: person.employment?.name
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    // ═══════════════════════════════════════════════════
    // SecurityTrails Transforms
    // ═══════════════════════════════════════════════════

    this.registerTransform({
      id: 'securitytrails_domain',
      name: 'SecurityTrails Domain Intel',
      description: 'Get DNS records, subdomains, and domain info',
      category: 'Domain Intelligence',
      inputTypes: ['domain'],
      outputTypes: ['ip_address', 'subdomain', 'domain'],
      icon: '🔐',
      requiresApiKey: true,
      execute: async (input) => {
        try {
          if (!securityTrailsService.isConfigured()) {
            return { success: false, error: 'SecurityTrails API key not configured (50 queries/month free)' };
          }

          const [domainInfo, subdomains] = await Promise.all([
            securityTrailsService.getDomain(input.value),
            securityTrailsService.getSubdomains(input.value)
          ]);

          const allEntities: any[] = [];
          const allLinks: any[] = [];

          if (domainInfo) {
            const dnsData = securityTrailsService.convertDomainToEntities(domainInfo, input.value);
            allEntities.push(...dnsData.entities);
            allLinks.push(...dnsData.links);
          }

          if (subdomains) {
            const subData = securityTrailsService.convertSubdomainsToEntities(subdomains, input.value);
            allEntities.push(...subData.entities);
            allLinks.push(...subData.links);
          }

          return {
            success: true,
            entities: allEntities,
            links: allLinks,
            metadata: {
              subdomainCount: subdomains?.subdomain_count || 0,
              aRecords: domainInfo?.current_dns?.a?.values?.length || 0
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'securitytrails_dns_history',
      name: 'SecurityTrails DNS History',
      description: 'Historical DNS records for a domain',
      category: 'Domain Intelligence',
      inputTypes: ['domain'],
      outputTypes: ['ip_address'],
      icon: '📜',
      requiresApiKey: true,
      execute: async (input) => {
        try {
          if (!securityTrailsService.isConfigured()) {
            return { success: false, error: 'SecurityTrails API key not configured' };
          }

          const history = await securityTrailsService.getDNSHistory(input.value, 'a');

          if (!history || !history.records?.length) {
            return { success: true, entities: [], links: [], metadata: { message: 'No DNS history found' } };
          }

          const graphData = securityTrailsService.convertDNSHistoryToEntities(history, input.value);

          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              totalRecords: history.records.length,
              pages: history.pages
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'securitytrails_associated',
      name: 'SecurityTrails Associated Domains',
      description: 'Find domains sharing same IP, NS, or MX',
      category: 'Domain Intelligence',
      inputTypes: ['domain'],
      outputTypes: ['domain'],
      icon: '🔗',
      requiresApiKey: true,
      execute: async (input) => {
        try {
          if (!securityTrailsService.isConfigured()) {
            return { success: false, error: 'SecurityTrails API key not configured' };
          }

          const data = await securityTrailsService.getAssociatedDomains(input.value);

          if (!data || !data.records?.length) {
            return { success: true, entities: [], links: [], metadata: { message: 'No associated domains found' } };
          }

          const graphData = securityTrailsService.convertAssociatedToEntities(data, input.value);

          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: { totalAssociated: data.record_count }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'securitytrails_ip_neighbors',
      name: 'SecurityTrails IP Neighbors',
      description: 'Find domains hosted on nearby IP addresses',
      category: 'Network Intelligence',
      inputTypes: ['ip_address'],
      outputTypes: ['domain'],
      icon: '🏘️',
      requiresApiKey: true,
      execute: async (input) => {
        try {
          if (!securityTrailsService.isConfigured()) {
            return { success: false, error: 'SecurityTrails API key not configured' };
          }

          const data = await securityTrailsService.getIPNeighbors(input.value);

          if (!data || !data.blocks || Object.keys(data.blocks).length === 0) {
            return { success: true, entities: [], links: [], metadata: { message: 'No IP neighbors found' } };
          }

          const graphData = securityTrailsService.convertIPNeighborsToEntities(data, input.value);

          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: { blocksFound: Object.keys(data.blocks).length }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    // ═══════════════════════════════════════════════════
    // Censys Transforms
    // ═══════════════════════════════════════════════════

    this.registerTransform({
      id: 'censys_host',
      name: 'Censys Host Scan',
      description: 'Get open ports, services, OS and ASN from Censys',
      category: 'Network Intelligence',
      inputTypes: ['ip_address'],
      outputTypes: ['port', 'technology', 'location', 'organization'],
      icon: '🌐',
      requiresApiKey: true,
      execute: async (input) => {
        try {
          if (!censysService.isConfigured()) {
            return { success: false, error: 'Censys API not configured (250 queries/month free)' };
          }

          const host = await censysService.getHost(input.value);

          if (!host) {
            return { success: true, entities: [], links: [], metadata: { message: 'Host not found in Censys' } };
          }

          const graphData = censysService.convertHostToEntities(host, input.value);

          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              servicesFound: host.services?.length || 0,
              country: host.location?.country,
              asn: host.autonomous_system?.asn,
              os: host.operating_system?.product
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'censys_domain_search',
      name: 'Censys Domain Hosts',
      description: 'Find hosts associated with a domain via Censys',
      category: 'Domain Intelligence',
      inputTypes: ['domain'],
      outputTypes: ['ip_address'],
      icon: '🔍',
      requiresApiKey: true,
      execute: async (input) => {
        try {
          if (!censysService.isConfigured()) {
            return { success: false, error: 'Censys API not configured' };
          }

          const result = await censysService.searchHosts(input.value);

          if (!result || !result.result?.hits?.length) {
            return { success: true, entities: [], links: [], metadata: { message: 'No hosts found' } };
          }

          const graphData = censysService.convertSearchToEntities(result, input.value);

          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: { totalHosts: result.result.total }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    // ═══════════════════════════════════════════════════
    // BinaryEdge Transforms
    // ═══════════════════════════════════════════════════

    this.registerTransform({
      id: 'binaryedge_host',
      name: 'BinaryEdge Host Intel',
      description: 'Get ports, services, CVEs, and risk score',
      category: 'Network Intelligence',
      inputTypes: ['ip_address'],
      outputTypes: ['port', 'vulnerability', 'threat_intel'],
      icon: '⚡',
      requiresApiKey: true,
      execute: async (input) => {
        try {
          if (!binaryEdgeService.isConfigured()) {
            return { success: false, error: 'BinaryEdge API key not configured (250 queries/month free)' };
          }

          const [host, risk] = await Promise.all([
            binaryEdgeService.getHost(input.value),
            binaryEdgeService.getRiskScore(input.value)
          ]);

          if (!host && !risk) {
            return { success: true, entities: [], links: [], metadata: { message: 'Host not found in BinaryEdge' } };
          }

          const graphData = binaryEdgeService.convertHostToEntities(host || { total: 0, query: input.value, events: [] }, input.value, risk);

          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              portsFound: host?.events?.length || 0,
              riskScore: risk ? (risk.normalized_ip_score * 100).toFixed(0) + '%' : 'N/A',
              cveCount: risk?.results_detailed?.cve?.length || 0
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'binaryedge_subdomains',
      name: 'BinaryEdge Subdomains',
      description: 'Discover subdomains via BinaryEdge scanning data',
      category: 'Domain Intelligence',
      inputTypes: ['domain'],
      outputTypes: ['subdomain'],
      icon: '🌐',
      requiresApiKey: true,
      execute: async (input) => {
        try {
          if (!binaryEdgeService.isConfigured()) {
            return { success: false, error: 'BinaryEdge API key not configured' };
          }

          const data = await binaryEdgeService.getSubdomains(input.value);

          if (!data || !data.events?.length) {
            return { success: true, entities: [], links: [], metadata: { message: 'No subdomains found' } };
          }

          const graphData = binaryEdgeService.convertSubdomainsToEntities(data, input.value);

          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: { subdomainsFound: data.total }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'binaryedge_dns',
      name: 'BinaryEdge DNS Records',
      description: 'Get DNS records from BinaryEdge scans',
      category: 'Domain Intelligence',
      inputTypes: ['domain'],
      outputTypes: ['ip_address', 'domain'],
      icon: '📡',
      requiresApiKey: true,
      execute: async (input) => {
        try {
          if (!binaryEdgeService.isConfigured()) {
            return { success: false, error: 'BinaryEdge API key not configured' };
          }

          const data = await binaryEdgeService.getDomainDNS(input.value);

          if (!data || !data.events?.length) {
            return { success: true, entities: [], links: [], metadata: { message: 'No DNS records found' } };
          }

          const graphData = binaryEdgeService.convertDNSToEntities(data, input.value);

          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: { eventsFound: data.events.length }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    // ═══════════════════════════════════════════════════
    // FullContact Transforms
    // ═══════════════════════════════════════════════════

    this.registerTransform({
      id: 'fullcontact_person',
      name: 'FullContact Person Enrichment',
      description: 'Find person info, social profiles, and employment from email',
      category: 'People Intelligence',
      inputTypes: ['email_address'],
      outputTypes: ['person', 'organization', 'social_profile', 'location'],
      icon: '👤',
      requiresApiKey: true,
      execute: async (input) => {
        try {
          if (!fullContactService.isConfigured()) {
            return { success: false, error: 'FullContact API key not configured (100 matches/month free)' };
          }

          const person = await fullContactService.enrichPerson(input.value);

          if (!person) {
            return { success: true, entities: [], links: [], metadata: { message: 'Person not found' } };
          }

          const graphData = fullContactService.convertPersonToEntities(person, input.value);

          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              name: person.fullName,
              organization: person.organization,
              location: person.location,
              profiles: person.details?.profiles ? Object.keys(person.details.profiles).length : 0
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'fullcontact_person_phone',
      name: 'FullContact Person by Phone',
      description: 'Find person info from phone number',
      category: 'People Intelligence',
      inputTypes: ['phone_number'],
      outputTypes: ['person', 'organization', 'social_profile', 'email_address'],
      icon: '📱',
      requiresApiKey: true,
      execute: async (input) => {
        try {
          if (!fullContactService.isConfigured()) {
            return { success: false, error: 'FullContact API key not configured' };
          }

          const person = await fullContactService.enrichPersonByPhone(input.value);

          if (!person) {
            return { success: true, entities: [], links: [], metadata: { message: 'Person not found' } };
          }

          const graphData = fullContactService.convertPersonToEntities(person, input.value);

          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              name: person.fullName,
              organization: person.organization
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    this.registerTransform({
      id: 'fullcontact_company',
      name: 'FullContact Company Enrichment',
      description: 'Enrich company data from domain',
      category: 'People Intelligence',
      inputTypes: ['domain'],
      outputTypes: ['organization', 'phone_number', 'social_profile', 'location', 'category'],
      icon: '🏢',
      requiresApiKey: true,
      execute: async (input) => {
        try {
          if (!fullContactService.isConfigured()) {
            return { success: false, error: 'FullContact API key not configured' };
          }

          const company = await fullContactService.enrichCompany(input.value);

          if (!company) {
            return { success: true, entities: [], links: [], metadata: { message: 'Company not found' } };
          }

          const graphData = fullContactService.convertCompanyToEntities(company, input.value);

          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              name: company.name,
              employees: company.employees,
              founded: company.founded,
              category: company.category
            }
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    });

    // ═══════════════════════════════════════════════════
    // EmailRep Transforms
    // ═══════════════════════════════════════════════════

    this.registerTransform({
      id: 'emailrep_check',
      name: 'EmailRep Reputation Check',
      description: 'Check email reputation, breach status, and social profiles',
      category: 'People Intelligence',
      inputTypes: ['email_address'],
      outputTypes: ['threat_intel', 'breach', 'social_profile', 'domain'],
      icon: '📧',
      execute: async (input) => {
        try {
          const data = await emailRepService.getReputation(input.value);

          if (!data) {
            return { success: false, error: 'Email not found' };
          }

          const graphData = emailRepService.convertToEntities(data, input.value);

          return {
            success: true,
            entities: graphData.entities,
            links: graphData.links,
            metadata: {
              reputation: data.reputation,
              suspicious: data.suspicious,
              references: data.references,
              breached: data.details.credentials_leaked || data.details.data_breach,
              profiles: data.details.profiles,
              deliverable: data.details.deliverable,
              disposable: data.details.disposable
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
   * Execute a transform with rate limiting
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

    // Rate limit check
    const provider = rateLimitTracker.getProviderForTransform(transformId);
    const { allowed, quota } = rateLimitTracker.consume(provider);

    if (!allowed) {
      const waitSeconds = Math.ceil(quota.waitMs / 1000);
      const windowInfo = quota.windows.find(w => w.remaining === 0);
      return {
        success: false,
        error: `Лимит запросов ${quota.displayName} исчерпан (${windowInfo?.label || ''}). Подождите ${waitSeconds} сек.`,
        metadata: { rateLimited: true, quota, waitMs: quota.waitMs }
      };
    }

    try {
      const startTime = Date.now();
      const result = await transform.execute(input, params);
      const executionTime = Date.now() - startTime;
      
      // Attach quota and timing info to result
      return {
        ...result,
        metadata: {
          ...result.metadata,
          quota,
          executionTimeMs: executionTime,
          provider: quota.displayName,
        }
      };
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
