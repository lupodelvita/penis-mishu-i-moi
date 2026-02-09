import https from 'https';
import http from 'http';
import { URL } from 'url';

export interface Technology {
  name: string;
  categories: string[];
  version?: string;
  confidence?: number;
  website?: string;
  icon?: string;
}

export interface TechStackResult {
  url: string;
  technologies: Technology[];
  headers?: Record<string, string>;
  meta?: Record<string, string>;
  scripts?: string[];
  timestamp: string;
}

export class TechStackService {
  /**
   * Simple tech detection based on common patterns
   * (Wappalyzer npm package requires Puppeteer which is heavy)
   * This is a lightweight alternative using pattern matching
   */
  async detectTechnologies(url: string): Promise<TechStackResult> {
    const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    
    try {
      const { html, headers } = await this.fetchWebsite(parsedUrl);
      
      const technologies = this.analyzePage(html, headers);
      const meta = this.extractMetaTags(html);
      const scripts = this.extractScripts(html);

      return {
        url: parsedUrl.href,
        technologies,
        headers: headers as Record<string, string>,
        meta,
        scripts,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[TechStackService] Detection failed:', error);
      throw error;
    }
  }

  /**
   * Fetch website HTML and headers
   */
  private async fetchWebsite(url: URL): Promise<{ html: string; headers: http.IncomingHttpHeaders }> {
    return new Promise((resolve, reject) => {
      const client = url.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000,
      };

      const req = client.request(options, (res) => {
        let html = '';
        
        res.on('data', (chunk) => {
          html += chunk.toString();
        });

        res.on('end', () => {
          resolve({ html, headers: res.headers });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Analyze page for technology patterns
   */
  private analyzePage(html: string, headers: http.IncomingHttpHeaders): Technology[] {
    const technologies: Technology[] = [];
    const htmlLower = html.toLowerCase();

    // CMS Detection
    if (htmlLower.includes('/wp-content/') || htmlLower.includes('/wp-includes/')) {
      technologies.push({
        name: 'WordPress',
        categories: ['CMS'],
        website: 'https://wordpress.org',
        icon: '🔷',
      });
    }

    if (htmlLower.includes('joomla') || headers['x-content-encoded-by']?.includes('Joomla')) {
      technologies.push({
        name: 'Joomla',
        categories: ['CMS'],
        website: 'https://joomla.org',
        icon: '🔶',
      });
    }

    if (htmlLower.includes('drupal') || headers['x-generator']?.includes('Drupal')) {
      technologies.push({
        name: 'Drupal',
        categories: ['CMS'],
        website: 'https://drupal.org',
        icon: '🔵',
      });
    }

    // Frameworks
    if (htmlLower.includes('react') || htmlLower.includes('__react')) {
      technologies.push({
        name: 'React',
        categories: ['JavaScript Framework'],
        website: 'https://react.dev',
        icon: '⚛️',
      });
    }

    if (htmlLower.includes('vue') || htmlLower.includes('__vue')) {
      technologies.push({
        name: 'Vue.js',
        categories: ['JavaScript Framework'],
        website: 'https://vuejs.org',
        icon: '💚',
      });
    }

    if (htmlLower.includes('angular') || htmlLower.includes('ng-version')) {
      technologies.push({
        name: 'Angular',
        categories: ['JavaScript Framework'],
        website: 'https://angular.io',
        icon: '🅰️',
      });
    }

    if (htmlLower.includes('next') || headers['x-powered-by']?.includes('Next.js')) {
      technologies.push({
        name: 'Next.js',
        categories: ['JavaScript Framework', 'SSR'],
        website: 'https://nextjs.org',
        icon: '▲',
      });
    }

    // Analytics
    if (htmlLower.includes('google-analytics.com') || htmlLower.includes('gtag') || htmlLower.includes('ga.js')) {
      technologies.push({
        name: 'Google Analytics',
        categories: ['Analytics'],
        website: 'https://analytics.google.com',
        icon: '📊',
      });
    }

    if (htmlLower.includes('hotjar')) {
      technologies.push({
        name: 'Hotjar',
        categories: ['Analytics', 'Heatmap'],
        website: 'https://hotjar.com',
        icon: '🔥',
      });
    }

    // CDN
    if (headers['server']?.includes('cloudflare') || headers['cf-ray']) {
      technologies.push({
        name: 'Cloudflare',
        categories: ['CDN', 'Security'],
        website: 'https://cloudflare.com',
        icon: '☁️',
      });
    }

    if (htmlLower.includes('cdn.jsdelivr.net')) {
      technologies.push({
        name: 'jsDelivr',
        categories: ['CDN'],
        website: 'https://jsdelivr.com',
        icon: '📦',
      });
    }

    // Web Server
    if (headers['server']) {
      const server = headers['server'] as string;
      if (server.toLowerCase().includes('nginx')) {
        technologies.push({
          name: 'Nginx',
          categories: ['Web Server'],
          website: 'https://nginx.org',
          icon: '🟢',
        });
      } else if (server.toLowerCase().includes('apache')) {
        technologies.push({
          name: 'Apache',
          categories: ['Web Server'],
          website: 'https://apache.org',
          icon: '🪶',
        });
      }
    }

    // Programming Language (from headers)
    if (headers['x-powered-by']) {
      const poweredBy = headers['x-powered-by'] as string;
      if (poweredBy.includes('PHP')) {
        technologies.push({
          name: 'PHP',
          categories: ['Programming Language'],
          version: poweredBy.match(/PHP\/([\d.]+)/)?.[1],
          icon: '🐘',
        });
      } else if (poweredBy.includes('ASP.NET')) {
        technologies.push({
          name: 'ASP.NET',
          categories: ['Programming Language', 'Framework'],
          icon: '🔵',
        });
      }
    }

    // E-commerce
    if (htmlLower.includes('shopify')) {
      technologies.push({
        name: 'Shopify',
        categories: ['E-commerce'],
        website: 'https://shopify.com',
        icon: '🛒',
      });
    }

    if (htmlLower.includes('woocommerce')) {
      technologies.push({
        name: 'WooCommerce',
        categories: ['E-commerce'],
        website: 'https://woocommerce.com',
        icon: '🛍️',
      });
    }

    // Tag Managers
    if (htmlLower.includes('googletagmanager.com')) {
      technologies.push({
        name: 'Google Tag Manager',
        categories: ['Tag Manager'],
        website: 'https://tagmanager.google.com',
        icon: '🏷️',
      });
    }

    return technologies;
  }

  /**
   * Extract meta tags
   */
  private extractMetaTags(html: string): Record<string, string> {
    const meta: Record<string, string> = {};
    const metaRegex = /<meta\s+([^>]+)>/gi;
    let match;

    while ((match = metaRegex.exec(html)) !== null) {
      const attrs = match[1];
      const nameMatch = attrs.match(/name=["']([^"']+)["']/i);
      const contentMatch = attrs.match(/content=["']([^"']+)["']/i);
      
      if (nameMatch && contentMatch) {
        meta[nameMatch[1]] = contentMatch[1];
      }
    }

    return meta;
  }

  /**
   * Extract script sources
   */
  private extractScripts(html: string): string[] {
    const scripts: string[] = [];
    const scriptRegex = /<script[^>]+src=["']([^"']+)["']/gi;
    let match;

    while ((match = scriptRegex.exec(html)) !== null) {
      scripts.push(match[1]);
    }

    return scripts.slice(0, 20); // Limit to 20 scripts
  }

  /**
   * Convert tech stack to graph entities
   */
  convertToEntities(techStack: TechStackResult) {
    const entities: any[] = [];
    const links: any[] = [];

    const urlObj = new URL(techStack.url);
    const domain = urlObj.hostname;
    const domainId = `domain-${domain}`;

    // Domain entity (if not exists)
    entities.push({
      id: domainId,
      type: 'domain',
      value: domain,
      data: {
        label: domain,
        color: '#3b82f6',
      },
    });

    // Technology entities
    for (const tech of techStack.technologies) {
      const techId = `tech-${tech.name.replace(/\s+/g, '-').toLowerCase()}`;
      
      entities.push({
        id: techId,
        type: 'technology',
        value: tech.name,
        data: {
          label: `${tech.icon || '⚙️'} ${tech.name}`,
          categories: tech.categories,
          version: tech.version,
          website: tech.website,
          color: '#a855f7', // purple
        },
      });

      links.push({
        id: `link-${domainId}-${techId}`,
        source: domainId,
        target: techId,
        label: tech.categories[0] || 'uses',
      });
    }

    return { entities, links };
  }
}

export const techStackService = new TechStackService();
