'use client';
import { useState, useEffect, useCallback } from 'react';
import { Search, Play, Settings2 } from 'lucide-react';
import { useGraphStore } from '@/store';
import { EntityType } from '@nodeweaver/shared-types';
interface TransformPanelProps {
  selectedEntityId: string | null;
  onOpenTerminal?: (command: string) => void;
}
const SAMPLE_TRANSFORMS = [
  { id: 'dns_resolve', name: 'Domain to IP', category: 'DNS', icon: '🌐', inputTypes: ['domain'] },
  { id: 'whois_lookup', name: 'WHOIS Lookup', category: 'WHOIS', icon: '🔍', inputTypes: ['domain'] },
  { id: 'dns_mx_records', name: 'MX Records', category: 'DNS', icon: '📧', inputTypes: ['domain'] },
  { id: 'oathnet_breach_check', name: 'Breach Check', category: 'Email', icon: '🔒', inputTypes: ['email_address'] },
  { id: 'username_search', name: 'Username Search', category: 'Social', icon: '👤', inputTypes: ['username', 'person'] },
  { id: 'geo_ip_location', name: 'IP to Location', category: 'Geo', icon: '📍', inputTypes: ['ip_address'] },
  { id: 'nmap_quick_scan', name: 'Port Scan (Active)', category: 'Security', icon: '🛡️', inputTypes: ['domain', 'ip_address'] },
  { id: 'security.xss_scan', name: 'XSS Fuzzer (Active)', category: 'Security', icon: '☣️', inputTypes: ['url', 'domain'] },
  { id: 'security.sqli_scan', name: 'SQLi Fuzzer (Active)', category: 'Security', icon: '💉', inputTypes: ['url', 'domain'] },
];
export default function TransformPanel({ selectedEntityId, onOpenTerminal }: TransformPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { currentGraph, addEntity, addLink } = useGraphStore();
  
  const categories = Array.from(new Set(SAMPLE_TRANSFORMS.map((t) => t.category)));
  const filteredTransforms = SAMPLE_TRANSFORMS.filter((transform) => {
    const matchesSearch = transform.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || transform.category === selectedCategory;
    if (selectedEntityId) {
       const entity = currentGraph?.entities.find(e => e.id === selectedEntityId);
       if (entity) {
           let entityInputType = 'unknown';
           if (entity.type === EntityType.Domain) entityInputType = 'domain';
           else if (entity.type === EntityType.IPAddress) entityInputType = 'ip_address';
           else if (entity.type === EntityType.EmailAddress) entityInputType = 'email_address';
           else if (entity.type === EntityType.Person) entityInputType = 'username';
           else if (entity.type === EntityType.URL) entityInputType = 'url';
           return matchesSearch && matchesCategory && transform.inputTypes.includes(entityInputType);
       }
    }
    return matchesSearch && matchesCategory;
  });

  const handleRunTransform = useCallback(async (transformId: string) => {
    if (!selectedEntityId || !currentGraph) {
      alert('Выберите сущность');
      return;
    }
    const sourceEntity = currentGraph.entities.find((e) => e.id === selectedEntityId);
    if (!sourceEntity) return;

    // --- UNIFIED TERMINAL INTERCEPTOR ---
    // If the transform has a CLI equivalent, run it in terminal instead of API
    let cliCommand = '';
    // Generate terminal command for Nmap scans
    if (transformId === 'nmap_quick_scan') {
        const target = sourceEntity.value.replace(/^https?:\/\//, '').split('/')[0];
        cliCommand = `nmap -F -sV -T4 --script-args http.useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "${target}"`;
    }

    if (cliCommand && onOpenTerminal) {
        onOpenTerminal(cliCommand);
        // Do NOT return. Allow the API call to proceed so the graph is updated.
    }
    
    // ======================================
    // SECURITY SCANS (Port, XSS, SQLi) - ALL VIA TERMINAL
    // ======================================
    const isSecurityScan = transformId.startsWith('security.') || transformId.includes('nmap_quick_scan');
    if (isSecurityScan) {
      // Open terminal with preview command
      if (onOpenTerminal) {
        let previewCommand = '';
        if (transformId === 'security.xss_scan') {
          let url = sourceEntity.value;
          if (!url.startsWith('http')) url = `http://${url}`;
          previewCommand = `echo "Running XSS Fuzzer on ${url}..."`;
        } else if (transformId === 'security.sqli_scan') {
          let url = sourceEntity.value;
          if (!url.startsWith('http')) url = `http://${url}`;
          previewCommand = `echo "Running SQLi Fuzzer on ${url}..."`;
        }
        
        if (previewCommand) {
          console.log(`[TransformPanel] Opening terminal for ${transformId}`);
          onOpenTerminal(previewCommand);
        }
      }
      
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
      } else {
          console.log('Unknown security transform, falling back to legacy');
      }
      if (endpoint) {
          console.log(`Running REAL security scan: ${endpoint}`, body);
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
            
            console.log('[TransformPanel] Got API response:', transformId, data);
            
            // Write results to terminal
            if (typeof window !== 'undefined' && (window as any).electron?.terminal?.write) {
              const termWrite = (window as any).electron.terminal.write;
              console.log('[TransformPanel] Terminal write available, results:', data.data?.results?.length);
              
              if (data.success && data.data.results) {
                const results = data.data.results;
                
                // Format and write results to terminal
                if (transformId === 'security.xss_scan') {
                  termWrite(`\r\n[XSS Scan Results]\r\n`);
                  termWrite(`Target: ${body.url}\r\n`);
                  termWrite(`Parameters scanned: ${new URL(body.url).searchParams.size}\r\n`);
                  
                  if (results.length === 0) {
                    termWrite(`\x1b[32m✓ No XSS vulnerabilities found\x1b[0m\r\n`);
                  } else {
                    termWrite(`\x1b[31m✗ Found ${results.length} XSS vulnerabilities:\x1b[0m\r\n`);
                    results.forEach((vuln: any, i: number) => {
                      termWrite(`  ${i + 1}. Parameter: ${vuln.properties?.parameter}\r\n`);
                      termWrite(`     Payload: ${vuln.properties?.payload}\r\n`);
                      termWrite(`     Severity: ${vuln.properties?.severity}\r\n`);
                    });
                  }
                  termWrite(`\r\nNodeWeaver> `);
                  
                } else if (transformId === 'security.sqli_scan') {
                  termWrite(`\r\n[SQLi Scan Results]\r\n`);
                  termWrite(`Target: ${body.url}\r\n`);
                  termWrite(`Parameters scanned: ${new URL(body.url).searchParams.size}\r\n`);
                  
                  if (results.length === 0) {
                    termWrite(`\x1b[32m✓ No SQL Injection vulnerabilities found\x1b[0m\r\n`);
                  } else {
                    termWrite(`\x1b[31m✗ Found ${results.length} SQLi vulnerabilities:\x1b[0m\r\n`);
                    results.forEach((vuln: any, i: number) => {
                      termWrite(`  ${i + 1}. Parameter: ${vuln.properties?.parameter}\r\n`);
                      termWrite(`     Evidence: ${vuln.properties?.evidence}\r\n`);
                      termWrite(`     Severity: ${vuln.properties?.severity}\r\n`);
                    });
                  }
                  termWrite(`\r\nNodeWeaver> `);
                }
              } else {
                termWrite(`\r\n\x1b[31mScan failed: ${data.error?.message || typeof data.error === 'string' ? data.error : 'Unknown error'}\x1b[0m\r\n`);
                termWrite(`NodeWeaver> `);
              }
            }
            
            if (data.success && data.data.results) {
               console.log('[TransformPanel] ✅ Starting graph update. Results count:', data.data.results.length);

               if (data.data.results.length === 0) {
                   alert('Сканирование завершено: Уязвимости не найдены.');
                   return; // Exit early if no results
               }
               
               // HYBRID HANDLING: If backend provides specific links (Topology Aware), use them.
               // Otherwise, fall back to Star Topology (link all to source).
               const hasBackendLinks = data.data.links && Array.isArray(data.data.links) && data.data.links.length > 0;

               if (hasBackendLinks) {
                   // 1. TRUST BACKEND TOPOLOGY + SMART LAYOUT (Tree/Grid)
                   console.log('[TransformPanel] Using Backend Topology with Smart Layout:', data.data);
                   
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
                   console.log('[TransformPanel] Using Universal Grid Topology');
                   
                   const COLS = 5; 
                   const SPACING_X = 200; 
                   const SPACING_Y = 150;
                   const sourcePos = (sourceEntity as any).position || { x: 400, y: 400 };
                   
                   // Calculate grid start position centered on source
                   const totalItems = data.data.results.length;
                   const gridWidth = (Math.min(totalItems, COLS) - 1) * SPACING_X;
                   const startX = sourcePos.x - (gridWidth / 2);
                   const startY = sourcePos.y + 250; // Place below source

                   data.data.results.forEach((result: any, index: number) => {
                       const newEntityId = `node-${Date.now()}-${index}`;
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
                       
                       const row = Math.floor(index / COLS);
                       const col = index % COLS;

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
                         id: `link-${Date.now()}-${index}`,
                         source: selectedEntityId,
                         target: newEntityId,
                         label: result.link?.label || 'detected'
                       });
                   });
               }
            } else {
                console.error('Scan failed:', data.error);
                alert(`Ошибка сканирования: ${data.error?.message || (typeof data.error === 'string' ? data.error : 'Unknown error')}`);
            }
          } catch (err) {
              console.error('API Call failed:', err);
              alert('Ошибка соединения с API');
          }
          return; 
      }
    }
    try {
        console.log(`Running legacy transform ${transformId} on ${sourceEntity.value}`);
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:4000/api/transforms/execute', {
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
        console.log('Transform execution result:', json);
        if (json.success) {
            if (!json.data.entities || json.data.entities.length === 0) {
                alert('Трансформ завершен, но результатов не найдено.');
            } else {
                const results = json.data.entities;
                results.forEach((result: any, index: number) => {
                  const newEntityId = `node-${Date.now()}-${index}`;
                  let mappedType = EntityType.Custom;
                  let color = '#cbd5e1';
                  switch(result.type) {
                     case 'ip_address': mappedType = EntityType.IPAddress; color = '#f59e0b'; break;
                     case 'domain': mappedType = EntityType.Domain; color = '#10b981'; break;
                     case 'social_profile': mappedType = EntityType.SocialProfile; color = '#06b6d4'; break;
                     case 'email_address': mappedType = EntityType.EmailAddress; color = '#8b5cf6'; break;
                     default: mappedType = EntityType.Custom;
                  }
                  const sourcePos = (sourceEntity as any).position || { x: 400, y: 400 };
                  const newEntity = {
                      id: newEntityId,
                      type: mappedType,
                      value: result.value,
                      data: { label: result.value, type: mappedType, color, ...result.properties },
                      position: { 
                          x: sourcePos.x + Math.cos(index * (2 * Math.PI) / results.length) * 250, 
                          y: sourcePos.y + Math.sin(index * (2 * Math.PI) / results.length) * 250 
                      },
                      created: new Date().toISOString(),
                      updated: new Date().toISOString(),
                      properties: result.properties || {}
                  };
                  addEntity(newEntity as any);
                  addLink({
                      id: `link-${Date.now()}-${index}`,
                      source: selectedEntityId,
                      target: newEntityId,
                      label: result.link?.label || 'related'
                  });
             });
           }
        } else {
            alert(`Ошибка выполнения: ${json.error || 'Неизвестная ошибка'}`);
        }

        }
    } catch (err) {
       console.error('Failed to execute transform:', err);
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
    <div className="flex-1 border-b border-border flex flex-col">
      {}
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
      <div className="flex-1 overflow-y-auto p-2">
          {!selectedEntityId && (
             <div className="bg-primary/10 text-primary text-xs p-2 rounded mb-2 text-center">
                 Выберите ноду на графе для запуска
             </div>
          )}
          <div className="space-y-1">
            {filteredTransforms.map((transform) => (
              <div
                key={transform.id}
                className={`flex items-center gap-2 p-2 rounded-md hover:bg-accent group transition-colors cursor-pointer ${!selectedEntityId ? 'opacity-60 grayscale' : ''}`}
                onClick={() => handleRunTransform(transform.id)}
              >
                <span className="text-lg">{transform.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{transform.name}</div>
                  <div className="text-xs text-muted-foreground">{transform.category}</div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRunTransform(transform.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-primary/10 rounded transition-all"
                  title="Запустить"
                >
                  <Play className="w-4 h-4 text-primary" />
                </button>
              </div>
            ))}
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

