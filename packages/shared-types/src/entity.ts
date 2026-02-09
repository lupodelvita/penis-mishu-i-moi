/**
 * Entity Types - Different types of data nodes in the graph
 */
export enum EntityType {
  // Network
  IPAddress = 'ip_address',
  Domain = 'domain',
  URL = 'url',
  EmailAddress = 'email_address',
  PhoneNumber = 'phone_number',
  MACAddress = 'mac_address',
  
  // People & Organizations
  Person = 'person',
  Organization = 'organization',
  Location = 'location',
  
  // Documents & Media
  Document = 'document',
  Image = 'image',
  
  // Social Media
  SocialProfile = 'social_profile',
  Username = 'username',
  
  // Crypto
  BitcoinAddress = 'bitcoin_address',
  EthereumAddress = 'ethereum_address',
  
  // Annotations
  TextNote = 'text_note', // For canvas text annotations
  
  // Custom
  Custom = 'custom',
}

/**
 * Base Entity interface
 */
export interface Entity {
  id: string;
  type: EntityType;
  value: string; // Main value/identifier
  displayName?: string; // Optional display name
  properties: Record<string, any>; // Additional properties
  metadata: EntityMetadata;
  created: Date;
  updated: Date;
}

/**
 * Entity metadata
 */
export interface EntityMetadata {
  source?: string; // Where this entity came from
  confidence?: number; // Confidence score 0-1
  tags?: string[]; // User-defined tags
  notes?: string; // User notes
  color?: string; // Custom color for visualization
  icon?: string; // Custom icon
  position?: { x: number; y: number }; // Position in graph
}

/**
 * Specific entity types
 */

export interface IPAddressEntity extends Entity {
  type: EntityType.IPAddress;
  properties: {
    version?: 4 | 6;
    country?: string;
    city?: string;
    isp?: string;
    asn?: string;
    isVPN?: boolean;
    isProxy?: boolean;
    threatScore?: number;
  };
}

export interface DomainEntity extends Entity {
  type: EntityType.Domain;
  properties: {
    registrar?: string;
    registrationDate?: Date;
    expirationDate?: Date;
    nameservers?: string[];
    whoisData?: Record<string, any>;
    dnsRecords?: {
      A?: string[];
      AAAA?: string[];
      MX?: string[];
      TXT?: string[];
      NS?: string[];
    };
  };
}

export interface EmailAddressEntity extends Entity {
  type: EntityType.EmailAddress;
  properties: {
    domain?: string;
    isValid?: boolean;
    isDisposable?: boolean;
    breaches?: string[]; // Known data breaches
    socialProfiles?: string[];
  };
}

export interface PersonEntity extends Entity {
  type: EntityType.Person;
  properties: {
    firstName?: string;
    lastName?: string;
    middleName?: string;
    age?: number;
    dateOfBirth?: Date;
    gender?: string;
    nationality?: string;
    occupation?: string;
    addresses?: string[];
    phoneNumbers?: string[];
    emails?: string[];
    socialProfiles?: Record<string, string>;
    photos?: string[];
  };
}

export interface SocialProfileEntity extends Entity {
  type: EntityType.SocialProfile;
  properties: {
    platform: string; // twitter, linkedin, facebook, etc.
    username: string;
    displayName?: string;
    url?: string;
    followers?: number;
    following?: number;
    bio?: string;
    verified?: boolean;
    avatarUrl?: string;
    joinDate?: Date;
  };
}

export interface LocationEntity extends Entity {
  type: EntityType.Location;
  properties: {
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
    placeId?: string;
  };
}

/**
 * Entity creation input
 */
export interface CreateEntityInput {
  type: EntityType;
  value: string;
  displayName?: string;
  properties?: Record<string, any>;
  metadata?: Partial<EntityMetadata>;
}

/**
 * Entity update input
 */
export interface UpdateEntityInput {
  id: string;
  value?: string;
  displayName?: string;
  properties?: Record<string, any>;
  metadata?: Partial<EntityMetadata>;
}
