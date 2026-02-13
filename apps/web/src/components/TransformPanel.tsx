'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Play, Settings2, Loader2, Clock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useGraphStore, useCollaborationStore } from '@/store';
import { EntityType } from '@nodeweaver/shared-types';

interface QuotaWindow {
  label: string;
  remaining: number;
  total: number;
  resetAt: number;
  used: number;
}

interface TransformQuota {
  available: boolean;
  configured: boolean;
  windows: QuotaWindow[];
  waitMs: number;
  freeDescription?: string;
}

interface APITransform {
  id: string;
  name: string;
  description: string;
  category: string;
  inputTypes: string[];
  outputTypes: string[];
  icon?: string;
  requiresApiKey?: boolean;
  provider?: string;
  providerKey?: string;
  estimatedTime?: string;
  estimatedMs?: number;
  quota?: TransformQuota;
}

interface ProgressInfo {
  transformId: string;
  startTime: number;
  estimatedMs: number;
  provider: string;
}

interface TransformPanelProps {
  selectedEntityId: string | null;
}

// Hardcoded transforms that use special code paths
const LOCAL_TRANSFORMS: APITransform[] = [
  { id: 'dns_resolve', name: 'Domain to IP', description: 'Resolve domain DNS', category: 'DNS', icon: '🌐', inputTypes: ['domain'], outputTypes: ['ip_address'], estimatedTime: '~2 сек', estimatedMs: 2000 },
  { id: 'whois_lookup', name: 'WHOIS Lookup', description: 'WHOIS domain info', category: 'WHOIS', icon: '🔍', inputTypes: ['domain'], outputTypes: ['domain'], estimatedTime: '~5 сек', estimatedMs: 5000 },
  { id: 'dns.mx_records', name: 'MX Records', description: 'Mail server records', category: 'DNS', icon: '📧', inputTypes: ['domain'], outputTypes: ['domain'], estimatedTime: '~2 сек', estimatedMs: 2000 },
  { id: 'oathnet_breach_check', name: 'Breach Check', description: 'OathNet breach DB', category: 'Email', icon: '🔒', inputTypes: ['email_address'], outputTypes: ['breach'], estimatedTime: '~3 сек', estimatedMs: 3000 },
  { id: 'email_validate', name: 'Email Validator', description: 'Validate email', category: 'Email', icon: '✅', inputTypes: ['email_address'], outputTypes: ['email_address'], estimatedTime: '~3 сек', estimatedMs: 3000 },
  { id: 'username_search', name: 'Username Search', description: 'Search username across platforms', category: 'Social', icon: '👤', inputTypes: ['username', 'person'], outputTypes: ['social_profile'], estimatedTime: '~5 сек', estimatedMs: 5000 },
  { id: 'geo_ip_location', name: 'IP to Location', description: 'Geolocate IP', category: 'Geo', icon: '📍', inputTypes: ['ip_address'], outputTypes: ['location'], estimatedTime: '~2 сек', estimatedMs: 2000 },
  { id: 'nmap_quick_scan', name: 'Port Scan (Active)', description: 'Nmap quick scan', category: 'Security', icon: '🛡️', inputTypes: ['domain', 'ip_address'], outputTypes: ['port'], estimatedTime: '~15 сек', estimatedMs: 15000 },
  { id: 'security.xss_scan', name: 'XSS Fuzzer (Active)', description: 'XSS vulnerability scan', category: 'Security', icon: '☣️', inputTypes: ['url', 'domain'], outputTypes: ['vulnerability'], estimatedTime: '~20 сек', estimatedMs: 20000 },
  { id: 'security.sqli_scan', name: 'SQLi Fuzzer (Active)', description: 'SQL injection scan', category: 'Security', icon: '💉', inputTypes: ['url', 'domain'], outputTypes: ['vulnerability'], estimatedTime: '~20 сек', estimatedMs: 20000 },
];

export default function TransformPanel({ selectedEntityId }: TransformPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [apiTransforms, setApiTransforms] = useState<APITransform[]>([]);
  const [progressInfo, setProgressInfo] = useState<ProgressInfo | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { currentGraph, addEntity, addLink } = useGraphStore();
  const { sendCommand, isConnected } = useCollaborationStore();
  
  // Auto-hide toast after 4s
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [toastMessage]);

  // Fetch transforms from API (includes quota data)
  useEffect(() => {
    const fetchTransforms = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/transforms`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const json = await response.json();
          if (json.success && json.data?.transforms) {
            setApiTransforms(json.data.transforms);
          }
        }
      } catch (err) {
        console.warn('[TransformPanel] Failed to fetch transforms from API');
      }
    };
    fetchTransforms();
    // Refresh quota every 30 seconds
    const interval = setInterval(fetchTransforms, 30000);
    return () => clearInterval(interval);
  }, []);

  // Progress bar animation
  useEffect(() => {
    if (progressInfo) {
      const { startTime, estimatedMs } = progressInfo;
      setProgressPercent(0);
      
      progressTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const percent = Math.min(95, (elapsed / estimatedMs) * 100); // Cap at 95% until done
        setProgressPercent(percent);
      }, 100);
      
      return () => {
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      };
    } else {
      setProgressPercent(0);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    }
    return undefined;
  }, [progressInfo]);

  // Merge local + API transforms (API transforms override by ID)
  const allTransforms = (() => {
    const apiIds = new Set(apiTransforms.map(t => t.id));
    const localOnly = LOCAL_TRANSFORMS.filter(t => !apiIds.has(t.id));
    return [...localOnly, ...apiTransforms];
  })();
  
  const categories = Array.from(new Set(allTransforms.map((t) => t.category)));
  const filteredTransforms = allTransforms.filter((transform) => {
    const matchesSearch = transform.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (transform.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || transform.category === selectedCategory;
    if (selectedEntityId) {
       const entity = currentGraph?.entities.find(e => e.id === selectedEntityId);
       if (entity) {
           // Map entity type to input type string for matching
           let entityInputType = entity.type?.toLowerCase() || 'unknown';
           // Also check originalType and common aliases
           const aliases: Record<string, string[]> = {
             [EntityType.Domain]: ['domain'],
             [EntityType.IPAddress]: ['ip_address'],
             [EntityType.EmailAddress]: ['email_address'],
             [EntityType.Person]: ['username', 'person'],
             [EntityType.URL]: ['url'],
             [EntityType.Username]: ['username', 'person'],
             [EntityType.PhoneNumber]: ['phone_number'],
             [EntityType.SocialProfile]: ['social_profile'],
             [EntityType.Organization]: ['organization'],
           };
           const matchTypes = aliases[entity.type] || [entityInputType];
           // Also include originalType from data
           if (entity.data?.originalType) matchTypes.push(entity.data.originalType);
           return matchesSearch && matchesCategory && transform.inputTypes.some(t => matchTypes.includes(t));
       }
    }
    return matchesSearch && matchesCategory;
  });

  // Helper: get quota badge info for a transform
  const getQuotaBadge = (transform: APITransform): { text: string; color: string; warning: boolean } | null => {
    if (!transform.quota || !transform.quota.windows.length) return null;
    
    // Find the tightest window
    const tightest = transform.quota.windows.reduce((min, w) => {
      const ratio = w.remaining / w.total;
      const minRatio = min.remaining / min.total;
      return ratio < minRatio ? w : min;
    }, transform.quota.windows[0]);
    
    if (!transform.quota.configured) {
      return { text: '🔑', color: 'text-slate-500', warning: true };
    }
    
    const ratio = tightest.remaining / tightest.total;
    if (tightest.remaining === 0) {
      return { text: `0/${tightest.total}`, color: 'text-red-400', warning: true };
    }
    if (ratio <= 0.2) {
      return { text: `${tightest.remaining}/${tightest.total}`, color: 'text-yellow-400', warning: true };
    }
    return { text: `${tightest.remaining}/${tightest.total}`, color: 'text-slate-500', warning: false };
  };

  const startProgress = (transformId: string, estimatedMs: number, provider: string) => {
    setProgressInfo({ transformId, startTime: Date.now(), estimatedMs, provider });
  };

  const stopProgress = () => {
    setProgressInfo(null);
    setProgressPercent(100);
    setTimeout(() => setProgressPercent(0), 300);
  };

  const handleRunTransform = useCallback(async (transformId: string) => {
    if (!selectedEntityId || !currentGraph) {
      alert('Выберите сущность');
      return;
    }
    const sourceEntity = currentGraph.entities.find((e) => e.id === selectedEntityId);
    if (!sourceEntity) return;
    
    // Find transform for estimated time
    const transformInfo = allTransforms.find(t => t.id === transformId);
    const estimatedMs = transformInfo?.estimatedMs || 2000;
    const provider = transformInfo?.provider || '';
    
    // Check quota before even trying
    if (transformInfo?.quota && !transformInfo.quota.available) {
      if (!transformInfo.quota.configured) {
        setToastMessage({ text: `API ключ для ${provider} не настроен`, type: 'error' });
        return;
      }
      const waitSec = Math.ceil(transformInfo.quota.waitMs / 1000);
      setToastMessage({ text: `⏳ Лимит ${provider} исчерпан. Подождите ${waitSec} сек.`, type: 'error' });
      return;
    }
    
    // Set loading state with progress
    setLoadingId(transformId);
    startProgress(transformId, estimatedMs, provider);
    setToastMessage({ text: `Запуск "${transformInfo?.name || transformId}"... (~${Math.ceil(estimatedMs / 1000)} сек)`, type: 'info' });

    // --- UNIFIED TERMINAL INTERCEPTOR ---
    // If the transform has a CLI equivalent, run it in terminal instead of API
    let cliCommand = '';
    // Generate terminal command for Nmap scans
    if (transformId === 'nmap_quick_scan') {
        const target = sourceEntity.value.replace(/^https?:\/\//, '').split('/')[0];
        cliCommand = `nmap -F -sV -T4 --script-args http.useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "${target}"`;
    }

    // NOTE: Terminal opening completely disabled - all transforms use API callbacks instead
    
    // ======================================
    // SECURITY SCANS (Port, XSS, SQLi) - ALL VIA TERMINAL
    // ======================================
    const isSecurityScan = transformId.startsWith('security.') || transformId.includes('nmap_quick_scan');
    if (isSecurityScan) {
      // NOTE: Terminal opening skipped for security scans to avoid SES "Super constructor null" error
      // Results are added to graph via API callback instead
      
      // Background API call for data collection
      let endpoint = '';
      let body: any = {};
      if (transformId === 'nmap_quick_scan') {
        // FIXED: Use the new OSINT endpoint that returns correct graph topology
        endpoint = '/api/osint/nmap/scan';
        const target = sourceEntity.value.replace(/^https?:\/\//, '').split('/')[0];
        body = { target, scanType: 'quick' };
      } else if (transformId === 'security.xss_scan') {
        endpoint = '/api/security/xss-scan';
        let url = sourceEntity.value;
        if (!url.startsWith('http')) url = `http://${url}`;
        body = { url };
      } else if (transformId === 'security.sqli_scan') {
        endpoint = '/api/security/sqli-scan';
        let url = sourceEntity.value;
        if (!url.startsWith('http')) url = `http://${url}`;
        body = { url };
      }
      if (endpoint) {
          try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${endpoint}`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(body)
            });
            const data = await response.json();
            
            if (data.success && data.data.results) {
               setToastMessage({ text: `Найдено ${data.data.results.length} результатов`, type: 'success' });

               if (data.data.results.length === 0) {
                   // Suggest IP extraction for NMAP if running on domain
                   if (transformId === 'nmap_quick_scan' && sourceEntity.type === EntityType.Domain) {
                       alert('Сканирование завершено но результатов не найдено.\n\nПодсказка: Сначала извлеките IP адрес сайта используя "Domain to IP", затем запустите "Port Scan (Active)" на IP адресе.');
                   } else {
                       alert('Сканирование завершено: Результатов не найдено.');
                   }
                   setLoadingId(null);
                   return; // Exit early if no results
               }
               
               // Broadcast transform command to collaborators
               if (isConnected) {
                 sendCommand({
                   type: 'transform',
                   payload: { transformId, sourceEntity: sourceEntity.value, resultCount: data.data.results.length },
                   userId: 'local',
                 });
               }
               
               // HYBRID HANDLING: If backend provides specific links (Topology Aware), use them.
               // Otherwise, fall back to Star Topology (link all to source).
               const hasBackendLinks = data.data.links && Array.isArray(data.data.links) && data.data.links.length > 0;

               if (hasBackendLinks) {
                   // 1. TRUST BACKEND TOPOLOGY + SMART LAYOUT (Tree/Grid)
                   
                   const sourcePos = (sourceEntity as any).position || { x: 0, y: 0 };
                   const scanResult = data.data.results.find((e: any) => e.type === 'scan_result');
                   const ports = data.data.results.filter((e: any) => e.type === 'port');
                   
                   // DEDUPLICATION: Find the "Host" entity returned by Nmap (usually matches source)
                   // We want to link scan results to the EXISTING selectedEntityId, not a new duplicate node.
                   const hostEntity = data.data.results.find((e: any) => 
                       (e.type === 'domain' || e.type === 'ip_address') && e.id !== (scanResult?.id)
                   );

                   // Filter distinct entities to add (exclude the duplicate host)
                   const distinctEntities = data.data.results.filter((e: any) => {
                       if (hostEntity && e.id === hostEntity.id) return false; // Skip duplicate host
                       return true;
                   });
                   
                   const otherEntities = distinctEntities.filter((e: any) => e.type !== 'scan_result' && e.type !== 'port');

                   // 1. Position Scan Result (Level 1 - Below Source)
                   if (scanResult) {
                       scanResult.position = { x: sourcePos.x, y: sourcePos.y + 250 };
                       addEntity(scanResult);
                   }

                   // 2. Position Ports (Level 2 - Grid below Scan Result)
                   if (ports.length > 0) {
                        const COLS = 6; // Max ports per row
                        const SPACING_X = 220;
                        const SPACING_Y = 150;
                        const START_Y = sourcePos.y + 500;
                        // Center the grid relative to source
                        const gridWidth = (Math.min(ports.length, COLS) - 1) * SPACING_X;
                        const START_X = sourcePos.x - (gridWidth / 2);

                        ports.forEach((port: any, index: number) => {
                            const row = Math.floor(index / COLS);
                            const col = index % COLS;
                            port.position = {
                                x: START_X + (col * SPACING_X),
                                y: START_Y + (row * SPACING_Y)
                            };
                            addEntity(port);
                        });
                   }

                   // 3. Add any other non-duplicate entities
                   otherEntities.forEach((entity: any) => {
                        if (!entity.position) {
                            entity.position = { x: sourcePos.x + 200, y: sourcePos.y };
                        }
                        addEntity(entity);
                   });

                   // 4. Add Links (with Remapping)
                   data.data.links.forEach((link: any) => {
                       // If link points to the excluded hostEntity, point it to selectedEntityId instead
                       let sourceId = link.source;
                       let targetId = link.target;

                       if (hostEntity) {
                           if (sourceId === hostEntity.id) sourceId = selectedEntityId;
                           if (targetId === hostEntity.id) targetId = selectedEntityId;
                       }

                       addLink({
                           ...link,
                           source: sourceId,
                           target: targetId
                       });
                   });
               } else {
                   // 2. UNIVERSAL GRID TOPOLOGY (Fallback for XSS, SQLi, Whois, etc.)
                   // Replaces the old chaotic "Star/Spiral" with a neat Grid.
                   
                   const COLS = 5; 
                   const SPACING_X = 200; 
                   const SPACING_Y = 150;
                   const sourcePos = (sourceEntity as any).position || { x: 400, y: 400 };
                   
                   // Calculate grid start position centered on source
                   const totalItems = data.data.results.length;
                   const gridWidth = (Math.min(totalItems, COLS) - 1) * SPACING_X;
                   const startX = sourcePos.x - (gridWidth / 2);
                   const startY = sourcePos.y + 250; // Place below source

                   let addedCount = 0;
                   data.data.results.forEach((result: any, index: number) => {
                       // DEDUPLICATION: Check if entity with same value already exists
                       const existingEntity = currentGraph.entities.find(e => 
                           e.value.toLowerCase() === result.value.toLowerCase() && 
                           e.type === result.type
                       );
                       
                       if (existingEntity) {
                           // Skip duplicate, but link it if not already linked
                           // Don't create self-loop links
                           if (existingEntity.id === selectedEntityId) return;
                           const existingLink = currentGraph.links?.find(l => 
                               (l.source === selectedEntityId && l.target === existingEntity.id) ||
                               (l.source === existingEntity.id && l.target === selectedEntityId)
                           );
                           if (!existingLink) {
                               addLink({
                                   id: `link-${Date.now()}-${index}`,
                                   source: selectedEntityId,
                                   target: existingEntity.id,
                                   label: result.link?.label || 'related'
                               });
                           }
                           return;
                       }
                       
                       const newEntityId = `node-${Date.now()}-${addedCount}`;
                       let mappedType = EntityType.Custom; 
                       let color = '#cbd5e1'; // Default grey
                       
                       // Map types...
                       if (result.type === 'vulnerability') { mappedType = EntityType.Custom; color = '#ef4444'; }
                       else if (result.type === 'port') { mappedType = EntityType.Custom; color = '#10b981'; }
                       else if (result.type === 'scan_result') { mappedType = EntityType.Custom; color = '#3b82f6'; }
                       else if (result.type === 'ip_address') { mappedType = EntityType.IPAddress; color = '#f59e0b'; }
                       else if (result.type === 'domain') { mappedType = EntityType.Domain; color = '#10b981'; }
                       else if (result.type === 'email_address') { mappedType = EntityType.EmailAddress; color = '#8b5cf6'; }
                       else if (result.type === 'social_profile') { mappedType = EntityType.SocialProfile; color = '#06b6d4'; }
                       
                       const row = Math.floor(addedCount / COLS);
                       const col = addedCount % COLS;

                       const newEntity = {
                           id: newEntityId,
                           type: mappedType,
                           value: result.value,
                           data: { 
                               label: result.value, 
                               type: mappedType, 
                               color, 
                               ...result.properties 
                           },
                           position: { 
                               x: startX + (col * SPACING_X), 
                               y: startY + (row * SPACING_Y) 
                           },
                           created: new Date().toISOString(),
                           updated: new Date().toISOString(),
                           properties: result.properties || {}
                       };
                       addEntity(newEntity as any);
                       addLink({
                         id: `link-${Date.now()}-${addedCount}`,
                         source: selectedEntityId,
                         target: newEntityId,
                         label: result.link?.label || 'detected'
                       });
                       addedCount++;
                   });
               }
            } else {
                const errorMsg = data.error?.message || (typeof data.error === 'string' ? data.error : 'Unknown error');
                setToastMessage({ text: `Ошибка: ${errorMsg}`, type: 'error' });
                alert(`Ошибка сканирования: ${errorMsg}`);
            }
          } catch (err) {
              setToastMessage({ text: 'Ошибка соединения с API', type: 'error' });
              alert('Ошибка соединения с API');
          } finally {
              setLoadingId(null);
              stopProgress();
          }
          return; 
      }
    }
    
    // ======================================
    // EMAIL VALIDATION (Eyes)
    // ======================================
    if (transformId === 'email_validate') {
        try {
            const email = sourceEntity.value;
            const token = localStorage.getItem('token');
            
            // Call email validation endpoint
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/osint/email/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ email })
            });
            
            const data = await response.json();
            
            if (data.success && data.data) {
                const validationResult = data.data;
                setToastMessage({
                    text: validationResult.valid ? `✅ Email валиден: ${validationResult.domain}` : `❌ Email невалиден`,
                    type: validationResult.valid ? 'success' : 'error'
                });
                
                // Add validation entity and metadata
                if (validationResult.valid) {
                    const newEntity = {
                        id: `email-validation-${Date.now()}`,
                        type: EntityType.Custom,
                        value: `${email} (validated)`,
                        data: {
                            label: email,
                            type: EntityType.Custom,
                            color: '#22c55e',
                            validity: validationResult.valid,
                            domain: validationResult.domain,
                            hasMX: validationResult.hasMX,
                            smtpCheck: validationResult.smtpCheck
                        },
                        position: {
                            x: (sourceEntity as any).position?.x || 400,
                            y: ((sourceEntity as any).position?.y || 400) + 150
                        },
                        created: new Date().toISOString(),
                        updated: new Date().toISOString(),
                        properties: validationResult
                    };
                    addEntity(newEntity as any);
                    addLink({
                        id: `link-email-validate-${Date.now()}`,
                        source: selectedEntityId,
                        target: newEntity.id,
                        label: 'validated'
                    });
                }
            } else {
                setToastMessage({ text: data.error?.message || 'Email validation failed', type: 'error' });
            }
        } catch (err) {
            setToastMessage({ text: 'Email validation error', type: 'error' });
        } finally {
            setLoadingId(null);
            stopProgress();
        }
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/transforms/execute`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                transformId,
                entity: {
                    id: sourceEntity.id,
                    type: sourceEntity.type,
                    value: sourceEntity.value,
                    data: sourceEntity.data
                }
            })
        });
        const json = await response.json();
        if (json.success) {
            // Build quota suffix for toast
            const quotaSuffix = json.quota ? ` | Осталось: ${json.quota.windows?.[0]?.remaining ?? '?'}/${json.quota.windows?.[0]?.total ?? '?'}` : '';
            const execTime = json.executionTimeMs ? ` (${(json.executionTimeMs / 1000).toFixed(1)}с)` : '';
            if (!json.data.entities || json.data.entities.length === 0) {
                setToastMessage({ text: `Результатов не найдено${execTime}${quotaSuffix}`, type: 'info' });
            } else {
                setToastMessage({ text: `Добавлено ${json.data.entities.length} результатов${execTime}${quotaSuffix}`, type: 'success' });
                const results = json.data.entities;
                let addedCount = 0;
                results.forEach((result: any, index: number) => {
                  // For social profiles, only add if profile exists (skip explicitly non-existent)
                  if (result.type === 'social_profile' && result.properties?.exists === false) {
                      return; // Skip profiles explicitly marked as non-existent
                  }
                  
                  // DEDUPLICATION: Check if entity with same value already exists
                  // Compare against both original backend type AND mapped type for maximum coverage
                  const normalizedType = result.type?.toLowerCase();
                  const existingEntity = currentGraph.entities.find(e => {
                      const eVal = e.value?.toLowerCase();
                      const rVal = result.value?.toLowerCase();
                      if (eVal !== rVal) return false;
                      // Match if types are equal, or if either is the mapped version of the other
                      const eType = (e.data?.originalType || e.type)?.toLowerCase();
                      return eType === normalizedType || e.type === normalizedType || e.type === result.type;
                  });
                  
                  if (existingEntity) {
                      // Skip duplicate, but link it if not already linked
                      // Don't create self-loop links (source === target)
                      if (existingEntity.id === selectedEntityId) return;
                      const existingLink = currentGraph.links?.find(l => 
                          (l.source === selectedEntityId && l.target === existingEntity.id) ||
                          (l.source === existingEntity.id && l.target === selectedEntityId)
                      );
                      if (!existingLink) {
                          addLink({
                              id: `link-${Date.now()}-${index}`,
                              source: selectedEntityId,
                              target: existingEntity.id,
                              label: result.link?.label || 'related'
                          });
                      }
                      return;
                  }
                  
                  const newEntityId = `node-${Date.now()}-${addedCount}`;
                  // Extended type mapping for all OSINT entity types
                  const typeColorMap: Record<string, { type: string; color: string }> = {
                     'ip_address': { type: EntityType.IPAddress, color: '#f59e0b' },
                     'domain': { type: EntityType.Domain, color: '#10b981' },
                     'subdomain': { type: EntityType.Domain, color: '#22d3ee' },
                     'social_profile': { type: EntityType.SocialProfile, color: '#06b6d4' },
                     'email_address': { type: EntityType.EmailAddress, color: '#8b5cf6' },
                     'person': { type: EntityType.Person, color: '#3b82f6' },
                     'organization': { type: EntityType.Organization, color: '#10b981' },
                     'phone_number': { type: EntityType.PhoneNumber, color: '#f97316' },
                     'location': { type: EntityType.Location, color: '#ef4444' },
                     'url': { type: EntityType.URL, color: '#a855f7' },
                     'username': { type: EntityType.Username, color: '#ec4899' },
                     // Threat & Security types
                     'threat': { type: 'threat', color: '#ef4444' },
                     'threat_intel': { type: 'threat_intel', color: '#f97316' },
                     'vulnerability': { type: 'vulnerability', color: '#ef4444' },
                     'breach': { type: 'breach', color: '#dc2626' },
                     'data_leak': { type: 'data_leak', color: '#b91c1c' },
                     'paste': { type: 'paste', color: '#9333ea' },
                     'credentials': { type: 'credentials', color: '#dc2626' },
                     'malware': { type: 'malware', color: '#991b1b' },
                     'file_hash': { type: 'file_hash', color: '#78716c' },
                     // Infrastructure types
                     'port': { type: 'port', color: '#0ea5e9' },
                     'technology': { type: 'technology', color: '#8b5cf6' },
                     'service': { type: 'service', color: '#14b8a6' },
                     'certificate_authority': { type: 'certificate_authority', color: '#a3e635' },
                     'category': { type: 'category', color: '#c084fc' },
                     'repository': { type: 'repository', color: '#7c3aed' },
                     'scan_result': { type: 'scan_result', color: '#3b82f6' },
                  };
                  const mapped = typeColorMap[result.type] || { type: result.type || EntityType.Custom, color: result.data?.color || '#cbd5e1' };
                  const sourcePos = (sourceEntity as any).position || { x: 400, y: 400 };
                  
                  // TREE LAYOUT: Grid below source, centered horizontally
                  const TREE_COLS = 5;
                  const TREE_SPACING_X = 200;
                  const TREE_SPACING_Y = 150;
                  const totalToAdd = results.filter((r: any) => {
                      if (r.type === 'social_profile' && r.properties?.exists === false) return false;
                      const nt = r.type?.toLowerCase();
                      return !currentGraph.entities.find(e => {
                          const eVal = e.value?.toLowerCase();
                          return eVal === r.value?.toLowerCase() && ((e.data?.originalType || e.type)?.toLowerCase() === nt || e.type === nt);
                      });
                  }).length;
                  const treeGridWidth = (Math.min(totalToAdd, TREE_COLS) - 1) * TREE_SPACING_X;
                  const treeStartX = sourcePos.x - (treeGridWidth / 2);
                  const treeStartY = sourcePos.y + 200;
                  const treeRow = Math.floor(addedCount / TREE_COLS);
                  const treeCol = addedCount % TREE_COLS;
                  
                  const newEntity = {
                      id: newEntityId,
                      type: mapped.type,
                      value: result.value,
                      data: { 
                          label: result.data?.label || result.value, 
                          type: mapped.type, 
                          color: result.data?.color || mapped.color,
                          originalType: result.type, // Preserve original backend type for dedup
                          ...result.properties 
                      },
                      position: { 
                          x: treeStartX + (treeCol * TREE_SPACING_X), 
                          y: treeStartY + (treeRow * TREE_SPACING_Y) 
                      },
                      created: new Date().toISOString(),
                      updated: new Date().toISOString(),
                      properties: result.properties || {}
                  };
                  addEntity(newEntity as any);
                  addLink({
                      id: `link-${Date.now()}-${addedCount}`,
                      source: selectedEntityId,
                      target: newEntityId,
                      label: result.link?.label || 'related'
                  });
                  addedCount++;
             });
           }
        } else {
            // Handle rate limiting response
            if (json.rateLimited && json.quota) {
                const waitSec = Math.ceil((json.quota.waitMs || 0) / 1000);
                setToastMessage({ text: `⏳ Лимит исчерпан. Подождите ${waitSec} сек.`, type: 'error' });
            } else {
                setToastMessage({ text: `Ошибка: ${json.error || 'Неизвестная ошибка'}`, type: 'error' });
            }
        }
    } catch (err) {
       setToastMessage({ text: 'Ошибка выполнения трансформа', type: 'error' });
    } finally {
       setLoadingId(null);
       stopProgress();
    }
  }, [selectedEntityId, currentGraph, addEntity, addLink]);
  useEffect(() => {
    const handleAutoRun = ((e: CustomEvent) => {
        if (e.detail?.transformId) {
            handleRunTransform(e.detail.transformId);
        }
    }) as EventListener;
    window.addEventListener('node-weaver:run-transform', handleAutoRun);
    return () => window.removeEventListener('node-weaver:run-transform', handleAutoRun);
  }, [handleRunTransform]);
  return (
    <div className="flex-1 border-b border-border flex flex-col min-h-0 overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`px-4 py-2 border-b text-sm font-medium flex items-center gap-2 ${
          toastMessage.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' :
          toastMessage.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' :
          'bg-blue-50 text-blue-800 border-blue-200'
        }`}>
          {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
          {toastMessage.type === 'error' && <XCircle className="w-4 h-4 shrink-0" />}
          {toastMessage.type === 'info' && <Clock className="w-4 h-4 shrink-0" />}
          <span className="truncate">{toastMessage.text}</span>
        </div>
      )}
      
      {/* Progress Bar */}
      {progressInfo && (
        <div className="px-4 py-2 border-b border-border bg-accent/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span className="flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              {progressInfo.provider || 'Выполнение'}...
            </span>
            <span>~{Math.ceil(progressInfo.estimatedMs / 1000)} сек</span>
          </div>
          <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-200 ease-linear"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Трансформы</h2>
          <button className="p-1 hover:bg-accent rounded-md transition-colors text-muted-foreground" title="Настройки">
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
        {}
        <div className="relative mb-3">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Поиск трансформов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        {}
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              !selectedCategory ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
            }`}
          >
            Все
          </button>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                selectedCategory === category
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
      {}
      <div className="flex-1 overflow-y-auto p-2 min-h-0">
          {!selectedEntityId && (
             <div className="bg-primary/10 text-primary text-xs p-2 rounded mb-2 text-center">
                 Выберите ноду на графе для запуска
             </div>
          )}
          <div className="space-y-1">
            {filteredTransforms.map((transform) => {
              const quotaBadge = getQuotaBadge(transform);
              const isExhausted = quotaBadge && transform.quota && !transform.quota.available;
              
              return (
              <div
                key={transform.id}
                className={`flex items-center gap-2 p-2 rounded-md hover:bg-accent group transition-colors cursor-pointer ${!selectedEntityId ? 'opacity-60 grayscale' : ''} ${isExhausted ? 'opacity-50' : ''}`}
                onClick={() => handleRunTransform(transform.id)}
              >
                <span className="text-lg">{transform.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{transform.name}</span>
                    {quotaBadge && (
                      <span className={`text-[10px] font-mono ${quotaBadge.color} shrink-0`} title="Остаток квоты">
                        {quotaBadge.text}
                      </span>
                    )}
                    {isExhausted && (
                      <AlertTriangle className="w-3 h-3 text-yellow-500 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{transform.category}</span>
                    {transform.estimatedTime && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        {transform.estimatedTime}
                      </span>
                    )}
                    {transform.provider && (
                      <span className="text-[10px] opacity-60">{transform.provider}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRunTransform(transform.id);
                  }}
                  disabled={loadingId === transform.id}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-primary/10 rounded transition-all disabled:opacity-100"
                  title="Запустить"
                >
                  {loadingId === transform.id ? (
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 text-primary" />
                  )}
                </button>
              </div>
              );
            })}
            {filteredTransforms.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Трансформы не найдены
              </div>
            )}
          </div>
      </div>
    </div>
  );
}

