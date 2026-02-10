import { exec } from 'child_process';
import { promisify } from 'util';
import { parseString } from 'xml2js';

const execAsync = promisify(exec);
const parseXml = promisify(parseString);

export interface NmapScanOptions {
  target: string;
  scanType: 'quick' | 'full' | 'vuln' | 'custom';
  customArgs?: string;
}

export interface NmapPort {
  port: number;
  protocol: 'tcp' | 'udp';
  state: 'open' | 'closed' | 'filtered';
  service?: string;
  version?: string;
}

export interface NmapHost {
  ip: string;
  hostname?: string;
  status: 'up' | 'down';
  ports: NmapPort[];
  os?: string;
  vulnerabilities?: string[];
}

export interface NmapScanResult {
  success: boolean;
  target: string;
  scanType: string;
  startTime: Date;
  endTime: Date;
  duration: number; // milliseconds
  host?: NmapHost;
  rawXml?: string;
  error?: string;
}

export class NmapService {
  
  /**
   * Check if nmap is installed in the system
   */
  async isNmapInstalled(): Promise<boolean> {
    try {
      await execAsync('nmap --version');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate target to prevent scanning private/localhost addresses
   */
  private validateTarget(target: string): { valid: boolean; error?: string } {
    // Check for localhost
    if (target === 'localhost' || target === '127.0.0.1' || target === '::1') {
      return { valid: false, error: 'Scanning localhost is not allowed' };
    }

    // Check for private IP ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./, // Link-local
      /^224\./ // Multicast
    ];

    const isPrivate = privateRanges.some(regex => regex.test(target));
    if (isPrivate) {
      return { valid: false, error: 'Scanning private IP ranges is restricted' };
    }

    // Basic domain/IP format validation
    const domainRegex = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    
    if (!domainRegex.test(target) && !ipRegex.test(target)) {
      return { valid: false, error: 'Invalid target format' };
    }

    return { valid: true };
  }

  /**
   * Build nmap command based on scan type
   */
  private buildNmapCommand(options: NmapScanOptions): string {
    const { target, scanType, customArgs } = options;

    const baseCommand = 'nmap';
    const xmlOutput = '-oX -'; // Output XML to stdout

    switch (scanType) {
      case 'quick':
        // -sT: TCP Connect Scan (unprivileged)
        // -F: Fast scan (top 100 ports)
        // -sV: Service version detection
        // -T4: Aggressive timing
        return `${baseCommand} -sT -F -sV -T4 --script-args http.useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" ${xmlOutput} ${target}`;
      
      case 'full':
        // -sT: TCP Connect Scan (unprivileged)
        // -sV: Service version detection
        // -sC: Default scripts
        // -T4: Aggressive timing
        // -p-: Scan all 65535 ports
        // Removed -A because it includes -O (OS detection) which requires raw sockets
        return `${baseCommand} -sT -sV -sC -T4 -p- --script-args http.useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" ${xmlOutput} ${target}`;
      
      case 'vuln':
        // -sT: TCP Connect Scan (unprivileged)
        return `${baseCommand} -sT --script vuln -sV --script-args http.useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" ${xmlOutput} ${target}`;
      
      case 'custom':
        if (!customArgs) {
          throw new Error('Custom scan requires customArgs parameter');
        }
        // Sanitize custom args (basic protection against command injection)
        const sanitizedArgs = customArgs.replace(/[;&|`$()]/g, '');
        return `${baseCommand} ${sanitizedArgs} ${xmlOutput} ${target}`;
      
      default:
        throw new Error(`Unknown scan type: ${scanType}`);
    }
  }

  /**
   * Parse nmap XML output
   */
  private async parseNmapXml(xml: string): Promise<NmapHost | null> {
    try {
      const result: any = await parseXml(xml);
      const nmaprun = result.nmaprun;

      if (!nmaprun || !nmaprun.host || nmaprun.host.length === 0) {
        return null;
      }

      const hostData = nmaprun.host[0];
      const address = hostData.address?.[0]?.$?.addr || '';
      const hostname = hostData.hostnames?.[0]?.hostname?.[0]?.$?.name;
      const status = hostData.status?.[0]?.$?.state === 'up' ? 'up' : 'down';

      const ports: NmapPort[] = [];
      if (hostData.ports && hostData.ports[0].port) {
        for (const portData of hostData.ports[0].port) {
          const portAttrs = portData.$;
          const state = portData.state?.[0]?.$?.state;
          const service = portData.service?.[0]?.$;

          ports.push({
            port: parseInt(portAttrs.portid),
            protocol: portAttrs.protocol as 'tcp' | 'udp',
            state: state as 'open' | 'closed' | 'filtered',
            service: service?.name,
            version: service?.version ? `${service.product} ${service.version}` : undefined
          });
        }
      }

      // Extract OS detection
      const os = hostData.os?.[0]?.osmatch?.[0]?.$?.name;

      // Extract vulnerabilities from script output
      const vulnerabilities: string[] = [];
      if (hostData.hostscript && hostData.hostscript[0].script) {
        for (const script of hostData.hostscript[0].script) {
          if (script.$.id.includes('vuln')) {
            vulnerabilities.push(`${script.$.id}: ${script.$.output || 'Detected'}`);
          }
        }
      }

      return {
        ip: address,
        hostname,
        status,
        ports,
        os,
        vulnerabilities: vulnerabilities.length > 0 ? vulnerabilities : undefined
      };
    } catch (error) {
      console.error('Failed to parse Nmap XML:', error);
      return null;
    }
  }

  /**
   * Execute nmap scan
   */
  async scan(options: NmapScanOptions): Promise<NmapScanResult> {
    const startTime = new Date();

    // Validate nmap is installed
    const nmapInstalled = await this.isNmapInstalled();
    if (!nmapInstalled) {
      return {
        success: false,
        target: options.target,
        scanType: options.scanType,
        startTime,
        endTime: new Date(),
        duration: 0,
        error: 'Nmap is not installed on this system. Please install nmap to use this feature.'
      };
    }

    // Validate target
    const validation = this.validateTarget(options.target);
    if (!validation.valid) {
      return {
        success: false,
        target: options.target,
        scanType: options.scanType,
        startTime,
        endTime: new Date(),
        duration: 0,
        error: validation.error
      };
    }

    try {
      const command = this.buildNmapCommand(options);
      console.log(`[NmapService] Executing: ${command}`);

      // Execute with timeout (5 minutes max)
      const { stdout, stderr } = await execAsync(command, { 
        timeout: 300000, // 5 minutes
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      if (stderr && !stderr.includes('Warning')) {
        console.warn('[NmapService] Stderr output:', stderr);
      }

      // Parse results
      const host = await this.parseNmapXml(stdout);

      return {
        success: true,
        target: options.target,
        scanType: options.scanType,
        startTime,
        endTime,
        duration,
        host: host || undefined,
        rawXml: stdout
      };

    } catch (error: any) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      console.error('[NmapService] Scan failed:', error);
      
      return {
        success: false,
        target: options.target,
        scanType: options.scanType,
        startTime,
        endTime,
        duration,
        error: error.message || 'Failed to execute nmap scan'
      };
    }
  }

  /**
   * Convert scan results to graph entities
   */
  convertToEntities(scanResult: NmapScanResult) {
    if (!scanResult.success || !scanResult.host) {
      return { entities: [], links: [] };
    }

    const entities: any[] = [];
    const links: any[] = [];

    const host = scanResult.host;
    const hostId = `host-${host.ip}`;
    const scanId = `scan-${host.ip}-${Date.now()}`;

    // 1. Create host entity
    entities.push({
      id: hostId,
      type: 'domain', // Changed to domain to match frontend expectation or keep ip_address if accurate
      value: host.hostname || host.ip,
      data: {
        label: host.hostname || host.ip,
        color: '#10b981' // green
      }
    });

    // 2. Create Scan Result entity
    const openPortsCount = host.ports.filter(p => p.state === 'open').length;
    entities.push({
      id: scanId,
      type: 'scan_result',
      value: `Found ${openPortsCount} open ports`,
      data: {
        label: `Found ${openPortsCount} open ports`,
        color: '#3b82f6', // blue
        count: openPortsCount
      }
    });

    // 3. Link Host -> Scan Result
    links.push({
      id: `link-${hostId}-${scanId}`,
      source: hostId,
      target: scanId,
      label: 'Scan'
    });

    // 4. Create port entities and link to Scan Result
    for (const port of host.ports.filter(p => p.state === 'open')) {
      const portId = `port-${host.ip}-${port.port}`;
      entities.push({
        id: portId,
        type: 'port',
        value: `${port.port}/${port.protocol}`,
        data: {
          label: `Port ${port.port}`,
          port: port.port,
          protocol: port.protocol,
          service: port.service,
          version: port.version,
          color: '#3b82f6' // blue
        }
      });

      // Link Scan Result -> Port
      links.push({
        id: `link-${scanId}-${portId}`,
        source: scanId,
        target: portId,
        label: port.service || 'unknown'
      });
    }

    return { entities, links };
  }
}

export const nmapService = new NmapService();
