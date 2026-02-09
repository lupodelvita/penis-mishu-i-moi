import { Entity } from './entity';
import { Link } from './transform';

/**
 * Graph data structure
 */
export interface Graph {
  id: string;
  name: string;
  description?: string;
  
  // Graph data
  entities: Entity[];
  links: Link[];
  
  // Metadata
  metadata: GraphMetadata;
  
  // Ownership & access
  ownerId: string;
  collaborators?: GraphCollaborator[];
  
  // Timestamps
  created: Date;
  updated: Date;
}

/**
 * Graph metadata
 */
export interface GraphMetadata {
  tags?: string[];
  category?: string;
  status?: 'active' | 'archived' | 'template';
  isPublic?: boolean;
  
  // Statistics
  stats?: GraphStats;
  
  // Layout
  layout?: GraphLayout;
  
  // View settings
  viewSettings?: GraphViewSettings;
}

/**
 * Graph statistics
 */
export interface GraphStats {
  entityCount: number;
  linkCount: number;
  entityTypeBreakdown: Record<string, number>;
  lastModified: Date;
  lastViewed?: Date;
  viewCount?: number;
}

/**
 * Graph layout configuration
 */
export interface GraphLayout {
  type: 'force' | 'hierarchical' | 'circular' | 'grid' | 'concentric' | 'breadthfirst' | 'cose' | 'random';
  options?: Record<string, any>;
}

/**
 * Graph view settings
 */
export interface GraphViewSettings {
  zoom?: number;
  pan?: { x: number; y: number };
  filters?: GraphFilters;
  highlightedEntities?: string[];
  selectedEntities?: string[];
  visibilityLayers?: Record<string, boolean>;
}

/**
 * Graph filters
 */
export interface GraphFilters {
  entityTypes?: string[];
  dateRange?: {
    from: Date;
    to: Date;
  };
  tags?: string[];
  searchQuery?: string;
  confidenceThreshold?: number;
}

/**
 * Graph collaborator
 */
export interface GraphCollaborator {
  userId: string;
  role: 'viewer' | 'editor' | 'admin';
  addedAt: Date;
  addedBy: string;
}

/**
 * Graph snapshot (for version history)
 */
export interface GraphSnapshot {
  id: string;
  graphId: string;
  name?: string;
  description?: string;
  data: {
    entities: Entity[];
    links: Link[];
  };
  createdBy: string;
  created: Date;
}

/**
 * Graph export formats
 */
export enum GraphExportFormat {
  JSON = 'json',
  CSV = 'csv',
  GraphML = 'graphml',
  GEXF = 'gexf',
  PDF = 'pdf',
  PNG = 'png',
  SVG = 'svg',
  HTML = 'html',
}

/**
 * Graph export options
 */
export interface GraphExportOptions {
  format: GraphExportFormat;
  includeMetadata?: boolean;
  includeImages?: boolean;
  filters?: GraphFilters;
  layout?: GraphLayout;
}

/**
 * Graph import data
 */
export interface GraphImportData {
  format?: GraphExportFormat;
  data: any;
  options?: {
    mergeStrategy?: 'replace' | 'merge' | 'append';
    autoLayout?: boolean;
  };
}

/**
 * Graph template
 */
export interface GraphTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  thumbnail?: string;
  
  // Template structure
  initialEntities?: Partial<Entity>[];
  initialLinks?: Partial<Link>[];
  suggestedTransforms?: string[];
  
  // Metadata
  author?: string;
  tags?: string[];
  usageCount?: number;
  
  created: Date;
  updated: Date;
}

/**
 * Graph creation input
 */
export interface CreateGraphInput {
  name: string;
  description?: string;
  templateId?: string;
  metadata?: Partial<GraphMetadata>;
  initialEntities?: Entity[];
  initialLinks?: Link[];
}

/**
 * Graph update input
 */
export interface UpdateGraphInput {
  id: string;
  name?: string;
  description?: string;
  metadata?: Partial<GraphMetadata>;
}

/**
 * Graph query options
 */
export interface GraphQueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'created' | 'updated' | 'name';
  sortOrder?: 'asc' | 'desc';
  filters?: GraphFilters;
  includeStats?: boolean;
}

/**
 * Graph search result
 */
export interface GraphSearchResult {
  graphs: Graph[];
  total: number;
  hasMore: boolean;
}

/**
 * Real-time graph update event
 */
export interface GraphUpdateEvent {
  graphId: string;
  type: 'entity_added' | 'entity_updated' | 'entity_removed' | 
        'link_added' | 'link_updated' | 'link_removed' |
        'metadata_updated' | 'collaborator_added' | 'collaborator_removed';
  payload: any;
  userId: string;
  timestamp: Date;
}

/**
 * Graph analysis result
 */
export interface GraphAnalysis {
  graphId: string;
  metrics: {
    density: number; // Edge density
    diameter?: number; // Graph diameter
    averageDegree: number;
    clusteringCoefficient?: number;
  };
  centralityScores?: {
    entityId: string;
    degreeCentrality: number;
    betweennessCentrality?: number;
    closenessCentrality?: number;
  }[];
  communities?: {
    id: string;
    entities: string[];
    strength: number;
  }[];
  patterns?: GraphPattern[];
}

/**
 * Detected graph pattern
 */
export interface GraphPattern {
  type: 'star' | 'chain' | 'cycle' | 'clique' | 'custom';
  entities: string[];
  links: string[];
  confidence: number;
  description?: string;
}
