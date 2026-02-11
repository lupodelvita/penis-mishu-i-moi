import { Entity, EntityType } from './entity';

/**
 * Transform execution status
 */
export enum TransformStatus {
  Idle = 'idle',
  Running = 'running',
  Success = 'success',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

/**
 * Transform category
 */
export enum TransformCategory {
  DNS = 'dns',
  WHOIS = 'whois',
  Network = 'network',
  SocialMedia = 'social_media',
  Search = 'search',
  Crypto = 'crypto',
  Geolocation = 'geolocation',
  Email = 'email',
  Phone = 'phone',
  Document = 'document',
  Custom = 'custom',
}

/**
 * Transform definition
 */
export interface Transform {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: TransformCategory;
  version: string;
  
  // What entity types can this transform accept as input
  inputTypes: EntityType[];
  
  // What entity types can this transform produce
  outputTypes: EntityType[];
  
  // Configuration
  requiresAuth?: boolean; // Does it need API keys?
  requiresPaid?: boolean; // Is it a paid transform?
  rateLimit?: {
    requests: number;
    period: number; // in seconds
  };
  
  // Metadata
  author?: string;
  icon?: string;
  tags?: string[];
  
  created: Date;
  updated: Date;
}

/**
 * Transform execution request
 */
export interface TransformExecutionRequest {
  transformId: string;
  entityId: string; // The entity to run the transform on
  parameters?: Record<string, any>; // Optional transform parameters
  options?: TransformExecutionOptions;
}

/**
 * Transform execution options
 */
export interface TransformExecutionOptions {
  maxResults?: number; // Limit number of results
  timeout?: number; // Timeout in milliseconds
  useCache?: boolean; // Use cached results if available
  autoMerge?: boolean; // Auto-merge duplicate entities
}

/**
 * Transform execution result
 */
export interface TransformExecutionResult {
  id: string;
  transformId: string;
  entityId: string;
  status: TransformStatus;
  
  // Results
  entities: Entity[]; // New entities discovered
  links: Link[]; // Links to connect entities
  
  // Execution details
  startTime: Date;
  endTime?: Date;
  duration?: number; // in milliseconds
  
  // Metadata
  cached?: boolean; // Was this result from cache?
  creditsUsed?: number; // API credits consumed
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Link between entities
 */
export interface Link {
  id: string;
  sourceId: string; // Source entity ID
  targetId: string; // Target entity ID
  label?: string; // Link label/type
  properties?: Record<string, any>;
  metadata?: LinkMetadata;
  created: Date;
}

/**
 * Link metadata
 */
export interface LinkMetadata {
  weight?: number; // Link strength/weight
  confidence?: number; // Confidence score
  bidirectional?: boolean;
  color?: string;
  style?: 'solid' | 'dashed' | 'dotted';
  width?: number;
}

/**
 * Transform machine - automated sequence of transforms
 */
export interface TransformMachine {
  id: string;
  name: string;
  description?: string;
  steps: TransformMachineStep[];
  created: Date;
  updated: Date;
}

/**
 * Transform machine step
 */
export interface TransformMachineStep {
  order: number;
  transformId: string;
  entityFilter?: {
    types?: EntityType[]; // Only run on these types
    conditions?: Record<string, any>; // Additional conditions
  };
  options?: TransformExecutionOptions;
  continueOnError?: boolean;
}

/**
 * Transform machine execution
 */
export interface TransformMachineExecution {
  id: string;
  machineId: string;
  graphId: string;
  status: TransformStatus;
  currentStep: number;
  totalSteps: number;
  results: TransformExecutionResult[];
  startTime: Date;
  endTime?: Date;
  error?: {
    step: number;
    message: string;
  };
}

/**
 * Transform configuration (API keys, etc.)
 */
export interface TransformConfig {
  transformId: string;
  enabled: boolean;
  credentials?: Record<string, string>; // API keys, tokens, etc.
  settings?: Record<string, any>; // Transform-specific settings
}

/**
 * Built-in transform IDs (constants)
 */
export const BUILTIN_TRANSFORMS = {
  // DNS
  DNS_TO_IP: 'dns.domain_to_ip',
  IP_TO_DNS: 'dns.ip_to_domain',
  DNS_MX: 'dns.mx_records',
  DNS_NS: 'dns.ns_records',
  
  // WHOIS
  WHOIS_DOMAIN: 'whois.domain',
  WHOIS_IP: 'whois.ip',
  
  // Network
  PORT_SCAN: 'network.port_scan',
  SSL_CERT: 'network.ssl_certificate',
  REVERSE_IP: 'network.reverse_ip',
  
  // Email
  EMAIL_TO_SOCIAL: 'email.to_social_profiles',
  EMAIL_BREACH_CHECK: 'email.breach_check',
  
  // Social
  USERNAME_SEARCH: 'social.username_search',
  PROFILE_LOOKUP: 'social.profile_lookup',
  
  // Geolocation
  IP_TO_LOCATION: 'geo.ip_to_location',
  PHONE_TO_LOCATION: 'geo.phone_to_location',
  
  // Additional (registered in TransformManager)
  NMAP_QUICK: 'nmap_quick_scan',
  NMAP_FULL: 'nmap_full_scan',
  SHODAN_LOOKUP: 'shodan_lookup',
  DNS_RESOLVE: 'dns_resolve',
  WHOIS_LOOKUP: 'whois_lookup',
  USERNAME_SEARCH_LEGACY: 'username_search',
  TECH_STACK_DETECTION: 'tech_stack_detection',
  SUBDOMAIN_ENUM: 'subdomain_enumeration',
  OATHNET_BREACH: 'oathnet_breach_check',
  OATHNET_DISCORD: 'oathnet_discord_lookup',
  DNS_TXT: 'dns_txt_records',
  SECURITY_HEADERS: 'security_headers_check',
  SECURITY_SSL: 'security_ssl_check',
  CRYPTO_BTC: 'crypto_btc_balance',
  CRYPTO_ETH: 'crypto_eth_balance',
  GEO_IP_LOCATION: 'geo_ip_location',
} as const;
