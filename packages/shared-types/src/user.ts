/**
 * User account
 */
export interface User {
  id: string;
  email: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  
  // Subscription
  subscription: UserSubscription;
  
  // Preferences
  preferences: UserPreferences;
  
  // Timestamps
  created: Date;
  lastLogin?: Date;
}

/**
 * User subscription tiers
 */
export enum SubscriptionTier {
  Free = 'free',
  Pro = 'pro',
  Team = 'team',
  Enterprise = 'enterprise',
}

/**
 * User subscription
 */
export interface UserSubscription {
  tier: SubscriptionTier;
  status: 'active' | 'cancelled' | 'expired' | 'trial';
  
  // Limits
  limits: {
    maxGraphs: number;
    maxEntitiesPerGraph: number;
    maxCollaborators: number;
    monthlyCredits: number;
    creditsUsed: number;
    creditsResetDate: Date;
  };
  
  // Billing
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
}

/**
 * User preferences
 */
export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  
  // UI preferences
  defaultLayout?: string;
  enableAnimations?: boolean;
  enableSounds?: boolean;
  
  // Graph preferences
  autoSave?: boolean;
  defaultZoom?: number;
  
  // Notifications
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  
  // Privacy
  profileVisibility?: 'public' | 'private';
  shareAnalytics?: boolean;
}

/**
 * API key for programmatic access
 */
export interface APIKey {
  id: string;
  userId: string;
  name: string;
  key: string; // The actual API key (hashed in DB)
  permissions: string[];
  lastUsed?: Date;
  expiresAt?: Date;
  created: Date;
}

/**
 * Audit log entry
 */
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}
