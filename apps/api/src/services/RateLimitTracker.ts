/**
 * Rate Limit Tracker
 * 
 * Tracks API usage quotas for all OSINT providers.
 * Prevents requests when limits are exhausted and provides quota info to frontend.
 * 
 * Supports:
 * - Per-minute, per-hour, per-day, per-month windows
 * - Multiple rate limits per provider (e.g., VirusTotal: 4/min + 500/day)
 * - Estimated wait time calculation
 * - Quota status reporting
 */

export interface RateLimitWindow {
  maxRequests: number;
  windowMs: number;
  label: string; // e.g., "per minute", "per day", "per month"
}

export interface ProviderConfig {
  provider: string;
  displayName: string;
  windows: RateLimitWindow[];
  requiresKey: boolean;
  freeDescription?: string; // e.g., "100% free, no key"
}

export interface WindowState {
  label: string;
  remaining: number;
  total: number;
  resetAt: number; // unix timestamp ms
  used: number;
}

export interface ProviderQuota {
  provider: string;
  displayName: string;
  available: boolean;
  configured: boolean; // API key present if required
  windows: WindowState[];
  waitMs: number; // 0 if available, otherwise ms until next available slot
  freeDescription?: string;
}

interface UsageRecord {
  timestamps: number[]; // timestamps of requests within the window
}

// Time constants
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;

class RateLimitTracker {
  private providers: Map<string, ProviderConfig> = new Map();
  private usage: Map<string, UsageRecord[]> = new Map(); // provider -> usage per window

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    // ═══════ Network Intelligence (Local) ═══════
    this.register({
      provider: 'nmap',
      displayName: 'Nmap',
      windows: [], // Local tool, no API limits
      requiresKey: false,
      freeDescription: 'Локальный инструмент — без ограничений',
    });

    this.register({
      provider: 'whois',
      displayName: 'WHOIS',
      windows: [{ maxRequests: 30, windowMs: MINUTE, label: 'в минуту' }], // prevent abuse
      requiresKey: false,
      freeDescription: 'Бесплатный, но с защитой от abuse',
    });

    this.register({
      provider: 'dns',
      displayName: 'DNS Resolve',
      windows: [],
      requiresKey: false,
      freeDescription: 'Локальный DNS — без ограничений',
    });

    this.register({
      provider: 'techstack',
      displayName: 'Tech Stack',
      windows: [{ maxRequests: 20, windowMs: MINUTE, label: 'в минуту' }],
      requiresKey: false,
      freeDescription: 'Бесплатный',
    });

    // ═══════ Existing OSINT APIs ═══════
    this.register({
      provider: 'shodan',
      displayName: 'Shodan',
      windows: [
        { maxRequests: 1, windowMs: SECOND, label: 'в секунду' },
      ],
      requiresKey: true,
    });

    this.register({
      provider: 'oathnet',
      displayName: 'OathNet',
      windows: [
        { maxRequests: 10, windowMs: MINUTE, label: 'в минуту' },
      ],
      requiresKey: true,
    });

    this.register({
      provider: 'ipgeolocation',
      displayName: 'IP Geolocation',
      windows: [
        { maxRequests: 1000, windowMs: DAY, label: 'в день' },
      ],
      requiresKey: true,
    });

    // ═══════ Breach Intelligence ═══════
    this.register({
      provider: 'hibp',
      displayName: 'HaveIBeenPwned',
      windows: [
        { maxRequests: 10, windowMs: MINUTE, label: 'в минуту' },
      ],
      requiresKey: true,
    });

    this.register({
      provider: 'breachvip',
      displayName: 'BreachVIP',
      windows: [
        { maxRequests: 30, windowMs: MINUTE, label: 'в минуту' },
      ],
      requiresKey: false,
      freeDescription: 'Открытый API — без ключа',
    });

    // ═══════ Threat Intelligence ═══════
    this.register({
      provider: 'alienvault',
      displayName: 'AlienVault OTX',
      windows: [
        { maxRequests: 10, windowMs: MINUTE, label: 'в минуту' },
      ],
      requiresKey: false,
      freeDescription: 'Бесплатный (ключ опционален)',
    });

    this.register({
      provider: 'virustotal',
      displayName: 'VirusTotal',
      windows: [
        { maxRequests: 4, windowMs: MINUTE, label: 'в минуту' },
        { maxRequests: 500, windowMs: DAY, label: 'в день' },
      ],
      requiresKey: true,
    });

    this.register({
      provider: 'greynoise',
      displayName: 'GreyNoise',
      windows: [
        { maxRequests: 50, windowMs: DAY, label: 'в день' },
      ],
      requiresKey: false,
      freeDescription: 'Community API — 50 запросов/день',
    });

    this.register({
      provider: 'abuseipdb',
      displayName: 'AbuseIPDB',
      windows: [
        { maxRequests: 1000, windowMs: DAY, label: 'в день' },
      ],
      requiresKey: true,
    });

    this.register({
      provider: 'threatcrowd',
      displayName: 'ThreatCrowd',
      windows: [
        { maxRequests: 20, windowMs: MINUTE, label: 'в минуту' },
      ],
      requiresKey: false,
      freeDescription: '100% бесплатный',
    });

    // ═══════ Domain Intelligence ═══════
    this.register({
      provider: 'hunter',
      displayName: 'Hunter.io',
      windows: [
        { maxRequests: 25, windowMs: MONTH, label: 'в месяц' },
      ],
      requiresKey: true,
    });

    this.register({
      provider: 'cert_transparency',
      displayName: 'crt.sh',
      windows: [
        { maxRequests: 10, windowMs: MINUTE, label: 'в минуту' },
      ],
      requiresKey: false,
      freeDescription: '100% бесплатный',
    });

    this.register({
      provider: 'urlscan',
      displayName: 'URLScan.io',
      windows: [
        { maxRequests: 500, windowMs: DAY, label: 'в день' },
      ],
      requiresKey: true,
    });

    this.register({
      provider: 'securitytrails',
      displayName: 'SecurityTrails',
      windows: [
        { maxRequests: 50, windowMs: MONTH, label: 'в месяц' },
      ],
      requiresKey: true,
    });

    this.register({
      provider: 'censys',
      displayName: 'Censys',
      windows: [
        { maxRequests: 250, windowMs: MONTH, label: 'в месяц' },
      ],
      requiresKey: true,
    });

    this.register({
      provider: 'binaryedge',
      displayName: 'BinaryEdge',
      windows: [
        { maxRequests: 250, windowMs: MONTH, label: 'в месяц' },
      ],
      requiresKey: true,
    });

    // ═══════ Security ═══════
    this.register({
      provider: 'phishtank',
      displayName: 'PhishTank',
      windows: [
        { maxRequests: 30, windowMs: MINUTE, label: 'в минуту' },
      ],
      requiresKey: false,
      freeDescription: 'Бесплатный (ключ опционален)',
    });

    // ═══════ People Intelligence ═══════
    this.register({
      provider: 'github',
      displayName: 'GitHub',
      windows: [
        { maxRequests: 5000, windowMs: HOUR, label: 'в час' },
      ],
      requiresKey: false,
      freeDescription: '60/час без ключа, 5000/час с ключом',
    });

    this.register({
      provider: 'clearbit',
      displayName: 'Clearbit',
      windows: [
        { maxRequests: 50, windowMs: MONTH, label: 'в месяц' },
      ],
      requiresKey: true,
    });

    this.register({
      provider: 'fullcontact',
      displayName: 'FullContact',
      windows: [
        { maxRequests: 100, windowMs: MONTH, label: 'в месяц' },
      ],
      requiresKey: true,
    });

    this.register({
      provider: 'emailrep',
      displayName: 'EmailRep',
      windows: [
        { maxRequests: 20, windowMs: MINUTE, label: 'в минуту' },
      ],
      requiresKey: false,
      freeDescription: 'Бесплатный (ключ для расширенных данных)',
    });
  }

  /**
   * Register a rate limit configuration for a provider
   */
  register(config: ProviderConfig): void {
    this.providers.set(config.provider, config);
    // Initialize usage tracking per window
    this.usage.set(config.provider, config.windows.map(() => ({ timestamps: [] })));
  }

  /**
   * Try to consume a request slot. Returns true if allowed, false if rate limited.
   */
  consume(provider: string): { allowed: boolean; quota: ProviderQuota } {
    const config = this.providers.get(provider);
    if (!config) {
      // Unknown provider — allow by default
      return {
        allowed: true,
        quota: {
          provider,
          displayName: provider,
          available: true,
          configured: true,
          windows: [],
          waitMs: 0,
        },
      };
    }

    // No rate limits (local tools)
    if (config.windows.length === 0) {
      return {
        allowed: true,
        quota: this.getQuota(provider),
      };
    }

    const now = Date.now();
    const usageWindows = this.usage.get(provider)!;
    let maxWaitMs = 0;
    let blocked = false;

    // Check each window
    for (let i = 0; i < config.windows.length; i++) {
      const window = config.windows[i];
      const usage = usageWindows[i];

      // Prune expired timestamps
      usage.timestamps = usage.timestamps.filter(t => now - t < window.windowMs);

      if (usage.timestamps.length >= window.maxRequests) {
        blocked = true;
        // Calculate wait time: earliest timestamp + windowMs - now
        const oldest = usage.timestamps[0];
        const waitMs = (oldest + window.windowMs) - now;
        if (waitMs > maxWaitMs) {
          maxWaitMs = waitMs;
        }
      }
    }

    if (!blocked) {
      // Record the request in all windows
      for (const usage of usageWindows) {
        usage.timestamps.push(now);
      }
    }

    return {
      allowed: !blocked,
      quota: this.getQuota(provider),
    };
  }

  /**
   * Get current quota status for a provider
   */
  getQuota(provider: string): ProviderQuota {
    const config = this.providers.get(provider);
    if (!config) {
      return {
        provider,
        displayName: provider,
        available: true,
        configured: true,
        windows: [],
        waitMs: 0,
      };
    }

    const now = Date.now();
    const usageWindows = this.usage.get(provider) || [];
    const windowStates: WindowState[] = [];
    let maxWaitMs = 0;
    let available = true;

    for (let i = 0; i < config.windows.length; i++) {
      const window = config.windows[i];
      const usage = usageWindows[i] || { timestamps: [] };

      // Prune expired
      usage.timestamps = usage.timestamps.filter(t => now - t < window.windowMs);
      const used = usage.timestamps.length;
      const remaining = Math.max(0, window.maxRequests - used);

      let resetAt = now + window.windowMs;
      if (usage.timestamps.length > 0) {
        resetAt = usage.timestamps[0] + window.windowMs;
      }

      if (remaining === 0) {
        available = false;
        const waitMs = resetAt - now;
        if (waitMs > maxWaitMs) maxWaitMs = waitMs;
      }

      windowStates.push({
        label: window.label,
        remaining,
        total: window.maxRequests,
        resetAt,
        used,
      });
    }

    // Check if API key is configured for providers that need it
    const configured = !config.requiresKey || this.isProviderConfigured(provider);

    return {
      provider: config.provider,
      displayName: config.displayName,
      available: available && configured,
      configured,
      windows: windowStates,
      waitMs: maxWaitMs,
      freeDescription: config.freeDescription,
    };
  }

  /**
   * Get quota status for all providers
   */
  getAllQuotas(): ProviderQuota[] {
    return Array.from(this.providers.keys()).map(p => this.getQuota(p));
  }

  /**
   * Get estimated execution time for a transform (based on type)
   */
  getEstimatedTime(transformId: string): { estimatedMs: number; label: string } {
    // Nmap full scan is very slow
    if (transformId === 'nmap_full_scan') {
      return { estimatedMs: 120000, label: '~2 мин' };
    }
    // Nmap quick scans
    if (transformId.includes('nmap')) {
      return { estimatedMs: 15000, label: '~15 сек' };
    }
    // Security scans (XSS, SQLi)
    if (transformId.includes('xss') || transformId.includes('sqli')) {
      return { estimatedMs: 20000, label: '~20 сек' };
    }
    // WHOIS lookups can be slow
    if (transformId.includes('whois')) {
      return { estimatedMs: 5000, label: '~5 сек' };
    }
    // Tech stack analysis
    if (transformId.includes('techstack')) {
      return { estimatedMs: 8000, label: '~8 сек' };
    }
    // DNS/Cert lookups
    if (transformId.includes('dns') || transformId.includes('cert')) {
      return { estimatedMs: 3000, label: '~3 сек' };
    }
    // Security checks (headers, SSL)
    if (transformId.includes('security')) {
      return { estimatedMs: 10000, label: '~10 сек' };
    }
    // Maigret username search
    if (transformId.includes('maigret')) {
      return { estimatedMs: 30000, label: '~30 сек' };
    }
    // Most API transforms
    return { estimatedMs: 2000, label: '~2 сек' };
  }

  /**
   * Map transform IDs to their provider name
   */
  getProviderForTransform(transformId: string): string {
    const mapping: Record<string, string> = {
      // Nmap
      'nmap_quick_scan': 'nmap',
      'nmap_full_scan': 'nmap',
      'nmap_detailed_scan': 'nmap',
      'nmap_vuln_scan': 'nmap',
      // DNS
      'dns_resolve': 'dns',
      'dns.mx_records': 'dns',
      'dns_txt_records': 'dns',
      'dns_recon': 'dns',
      'subdomain_enum': 'dns',
      // WHOIS
      'whois_lookup': 'whois',
      'whois_ip_lookup': 'whois',
      // Security
      'security_headers_check': 'security',
      'security_ssl_check': 'security',
      // Maigret
      'maigret_lite': 'maigret',
      // Email
      'email_validate': 'email',
      // Tech Stack
      'techstack_analyze': 'techstack',
      // Shodan
      'shodan_host': 'shodan',
      'shodan_domain': 'shodan',
      // OathNet
      'oathnet_breach_check': 'oathnet',
      // Geo
      'geo_ip_location': 'ipgeolocation',
      // HIBP
      'hibp_breach_check': 'hibp',
      // BreachVIP
      'breachvip_email': 'breachvip',
      'breachvip_username': 'breachvip',
      'breachvip_phone': 'breachvip',
      'breachvip_domain': 'breachvip',
      'breachvip_ip': 'breachvip',
      // AlienVault
      'alienvault_domain': 'alienvault',
      'alienvault_ip': 'alienvault',
      // ThreatCrowd
      'threatcrowd_domain': 'threatcrowd',
      'threatcrowd_ip': 'threatcrowd',
      // Certificate Transparency
      'cert_transparency': 'cert_transparency',
      // Hunter
      'hunter_domain': 'hunter',
      // URLScan
      'urlscan_domain': 'urlscan',
      // VirusTotal
      'virustotal_domain': 'virustotal',
      'virustotal_ip': 'virustotal',
      'virustotal_url': 'virustotal',
      // GreyNoise
      'greynoise_ip': 'greynoise',
      // AbuseIPDB
      'abuseipdb_check': 'abuseipdb',
      // PhishTank
      'phishtank_url': 'phishtank',
      // GitHub
      'github_user': 'github',
      'github_code_search': 'github',
      // Clearbit
      'clearbit_company': 'clearbit',
      'clearbit_person': 'clearbit',
      // SecurityTrails
      'securitytrails_domain': 'securitytrails',
      'securitytrails_dns_history': 'securitytrails',
      'securitytrails_associated': 'securitytrails',
      'securitytrails_ip_neighbors': 'securitytrails',
      // Censys
      'censys_host': 'censys',
      'censys_domain_search': 'censys',
      // BinaryEdge
      'binaryedge_host': 'binaryedge',
      'binaryedge_subdomains': 'binaryedge',
      'binaryedge_dns': 'binaryedge',
      // FullContact
      'fullcontact_person': 'fullcontact',
      'fullcontact_person_phone': 'fullcontact',
      'fullcontact_company': 'fullcontact',
      // EmailRep
      'emailrep_check': 'emailrep',
    };

    return mapping[transformId] || 'unknown';
  }

  /**
   * Check if provider's API key is configured in environment
   */
  private isProviderConfigured(provider: string): boolean {
    const envMap: Record<string, string> = {
      shodan: 'SHODAN_API_KEY',
      oathnet: 'OATHNET_API_KEY',
      ipgeolocation: 'IPGEOLOCATION_API_KEY',
      hibp: 'HIBP_API_KEY',
      alienvault: 'ALIENVAULT_API_KEY',
      virustotal: 'VIRUSTOTAL_API_KEY',
      greynoise: 'GREYNOISE_API_KEY',
      abuseipdb: 'ABUSEIPDB_API_KEY',
      hunter: 'HUNTER_API_KEY',
      urlscan: 'URLSCAN_API_KEY',
      github: 'GITHUB_API_KEY',
      clearbit: 'CLEARBIT_API_KEY',
      securitytrails: 'SECURITYTRAILS_API_KEY',
      censys: 'CENSYS_API_ID',
      binaryedge: 'BINARYEDGE_API_KEY',
      fullcontact: 'FULLCONTACT_API_KEY',
      emailrep: 'EMAILREP_API_KEY',
      phishtank: 'PHISHTANK_API_KEY',
    };

    const envKey = envMap[provider];
    if (!envKey) return true; // Unknown provider, allow
    return !!process.env[envKey];
  }
}

export const rateLimitTracker = new RateLimitTracker();
