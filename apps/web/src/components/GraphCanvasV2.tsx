import { useEffect, useRef, useState } from 'react';
import cytoscape, { Core, EventObject, NodeSingular } from 'cytoscape';
// Extensions managed by cytoscapeHelper
import { EntityType } from '@nodeweaver/shared-types';
import { Trash2, Link2, ZoomIn, ZoomOut, Maximize2, X, Wifi } from 'lucide-react';
import { useGraphStore, useCollaborationStore } from '@/store';
import NmapScanModal from './NmapScanModal';
import ViewToggle from './ViewToggle';
import dynamic from 'next/dynamic';

// Dynamic imports to prevent SSR issues and build crashes
const MapCanvas = dynamic(() => import('./MapCanvas'), { ssr: false });

import { registerCytoscapeExtensions } from '@/utils/cytoscapeHelper';

// Module-level flag removed (handled in helper)

interface GraphCanvasProps {
  onEntitySelect?: (entityId: string | null) => void;
}
export default function GraphCanvas({ onEntitySelect }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeHtmlEnabledRef = useRef(false);
  const prevNodeCountRef = useRef(0); // Track node count to detect additions
  const NODE_HTML_THRESHOLD = 40;

  // Helper to (re)initialize nodeHtmlLabel when needed
  const setupNodeHtml = (cy: Core) => {
    try {
      if (typeof (cy as any).nodeHtmlLabel !== 'function') return;
      (cy as any).nodeHtmlLabel([
        {
          query: 'node',
          halign: 'center',
          valign: 'center',
          halignBox: 'center',
          valignBox: 'center',
          cssClass: 'node-html-card',
          tpl: function(data: any) {
            if (!data) return '';
            const typeLabel = (data.type || 'CUSTOM').replace(/_/g, ' ').toUpperCase();
            const allFields: Array<{label: string; value: string}> = [];
            const idShort = (data.id && typeof data.id === 'string') 
              ? data.id.substring(data.id.lastIndexOf('-') + 1, data.id.lastIndexOf('-') + 9) 
              : '';
            if (idShort) allFields.push({ label: 'ID', value: idShort });
            const props = data.properties || {};
            if (props.port) allFields.push({ label: 'PORT', value: String(props.port) });
            if (props.service) allFields.push({ label: 'SERVICE', value: String(props.service) });
            if (props.version) allFields.push({ label: 'VERSION', value: String(props.version) });
            if (props.state) allFields.push({ label: 'STATE', value: String(props.state) });
            if (props.ip) allFields.push({ label: 'IP', value: String(props.ip) });
            if (props.country) allFields.push({ label: 'COUNTRY', value: String(props.country) });
            const d = data.data || {};
            if (d.port) allFields.push({ label: 'PORT', value: String(d.port) });
            if (d.service) allFields.push({ label: 'SERVICE', value: String(d.service) });
            if (props.platform) allFields.push({ label: 'PLATFORM', value: String(props.platform) });
            if (props.status) allFields.push({ label: 'STATUS', value: String(props.status) });
            const displayFields = allFields.slice(0, Math.min(3, allFields.length));
            if (displayFields.length === 0) {
              displayFields.push({ label: 'TYPE', value: typeLabel });
            }
            const fieldsHtml = displayFields.map(f => 
              `<div class="info-row"><span class="info-label">${f.label}</span><span class="info-value">${f.value}</span></div>`
            ).join('');
            const color = data.color || '#6b7280';
            const label = data.label || data.value || 'Unknown';
            return `\n              <div class="node-card" style="border-color: ${color}">\n                <div class="card-header" style="background: ${color}22">\n                  <span style="color: ${color}">${typeLabel}</span>\n                </div>\n                <div class="card-body">\n                  <div class="main-value">${label}</div>\n                  <div class="info-box">\n                    ${fieldsHtml}\n                  </div>\n                </div>\n              </div>\n            `;
          }
        }
      ]);
      nodeHtmlEnabledRef.current = true;
    } catch (e) {
      nodeHtmlEnabledRef.current = false;
      console.warn('[GraphCanvas] setupNodeHtml failed:', e);
    }
  };
  const cyRef = useRef<Core | null>(null);
  const isInitializedRef = useRef(false);
  const linkModeRef = useRef(false);
  const linkSourceRef = useRef<NodeSingular | null>(null);
  const { currentGraph, addEntity, deleteEntity, addLink, deleteLink, selectEntity, clearSelection } = useGraphStore();
  const { sendCommand, updateCursor, selectEntity: selectEntityCollab, isConnected, collaborators } = useCollaborationStore();
  const [linkMode, setLinkMode] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; target: any } | null>(null);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [pendingEntity, setPendingEntity] = useState<{ type: EntityType, x: number, y: number } | null>(null);
  const [newEntityName, setNewEntityName] = useState('');
  const [showNmapModal, setShowNmapModal] = useState(false);
  const [nmapTarget, setNmapTarget] = useState<any>(null);
  const [newEntityNote, setNewEntityNote] = useState('');
  const [currentView, setCurrentView] = useState<'graph' | 'map'>('graph');
  const nodeCount = currentGraph?.entities.length || 0;
  const edgeCount = currentGraph?.links.length || 0;
  useEffect(() => {
    if (currentView !== 'graph' || !containerRef.current || isInitializedRef.current) return;
    
    // Register extensions safely (async, client only) and then initialize Cytoscape
    (async () => {
      try {
        await registerCytoscapeExtensions();
      } catch (e) {
        console.warn('[GraphCanvas] registerCytoscapeExtensions failed:', e);
      }

      isInitializedRef.current = true;
      const cy = cytoscape({
        container: containerRef.current,
        style: [
          {
            selector: 'node',
            style: {
              'shape': 'roundrectangle',
              'width': 180,
              'height': 100,
              'background-color': '#1a1a24',
              'border-width': 2,
              'border-color': 'data(color)',
              'border-style': 'solid',
              'label': 'data(label)',
              'text-valign': 'center',
              'text-halign': 'center',
              'color': '#e5e7eb',
              'font-size': '13px',
              'font-weight': 500,
              'text-wrap': 'wrap',
              'text-max-width': '160px',
              'text-outline-color': '#0a0a0f',
              'text-outline-width': 2,
            },
          },
          {
            selector: 'node:selected',
            style: {
              'border-width': 3,
              'border-color': '#10b981',
            },
          },
          {
            selector: 'node.link-source',
            style: {
              'border-width': 4,
              'border-color': '#22c55e', // green-500
              'border-style': 'dashed',
            },
          },
          {
            selector: 'node.link-target-hover',
            style: {
              'border-width': 3,
              'border-color': '#10b981',
            },
          },
          {
            selector: 'edge',
            style: {
              'width': 2,
              'line-color': '#6366f1',
              'line-opacity': 0.6,
              'target-arrow-color': '#6366f1',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
              'label': 'data(label)',
              'font-size': '10px',
              'text-rotation': 'autorotate',
              'text-margin-y': -10,
              'color': '#9ca3af',
              'text-background-color': '#0a0a0f',
              'text-background-opacity': 0.8,
              'text-background-padding': '4px',
              'text-outline-color': '#000',
              'text-outline-width': 0.5,
            },
          },
          {
            selector: 'edge:selected',
            style: {
              'line-color': '#667eea',
              'target-arrow-color': '#667eea',
              'width': 3,
            },
          },
        ],
        // Use 'preset' layout - positions are managed by TransformPanel and stored in entities
        layout: { 
          name: 'preset',
          padding: 50
        } as any,
        // Limit zoom to reasonable range to avoid huge zooms on first node creation
        minZoom: 0.1,
        maxZoom: 3.0,
      });
      cyRef.current = cy;
      setTimeout(() => {
        cy.resize();
        // After initial load, fit to content with reasonable zoom
        if (cy.nodes().length > 0) {
          cy.fit(undefined, 60);
          const clamped = Math.min(Math.max(cy.zoom(), 0.4), 0.85);
          cy.zoom(clamped);
          cy.center();
        }
      }, 100);

// Safe extension initialization for nodeHtmlLabel (only for small initial graphs)
      const shouldEnableNodeHtml = (currentGraph && currentGraph.entities && currentGraph.entities.length <= NODE_HTML_THRESHOLD);
      if (shouldEnableNodeHtml) {
        setupNodeHtml(cy);
      } else {
        nodeHtmlEnabledRef.current = false;
      }

      // Syntax fix verified - Block cleaned
      cy.on('tap', 'node', (evt: EventObject) => {
        const node = evt.target;
        if (linkModeRef.current && linkSourceRef.current) {
          const sourceId = linkSourceRef.current.id();
          const targetId = node.id();
          if (sourceId !== targetId) {
            addLink({
              id: `edge-${Date.now()}`,
              source: sourceId,
              target: targetId,
              label: 'связан с'
            });
          }
          linkSourceRef.current.removeClass('link-source');
          linkSourceRef.current = null;
          linkModeRef.current = false;
          setLinkMode(false);
        } else {
          onEntitySelect?.(node.id());
        }
      });
      cy.on('tap', 'edge', () => {
          onEntitySelect?.(null); // Deselect nodes for now, or handle edge selection
      });
      cy.on('tap', (evt: EventObject) => {
        if (evt.target === cy) {
          onEntitySelect?.(null);
          setContextMenu(null);
          clearSelection();
        }
      });
      cy.on('cxttap', 'node', (evt: EventObject) => {
        evt.preventDefault();
        setContextMenu({ x: evt.renderedPosition.x, y: evt.renderedPosition.y, target: evt.target });
      });
      cy.on('dragfree', 'node', () => {
      });
      cy.on('mouseover', 'node', (evt: EventObject) => {
        if (linkModeRef.current && linkSourceRef.current && linkSourceRef.current.id() !== evt.target.id()) {
          evt.target.addClass('link-target-hover');
        }
      });
      cy.on('mouseout', 'node', (evt: EventObject) => {
        evt.target.removeClass('link-target-hover');
      });
      const handleKeyDown = (e: KeyboardEvent) => {
         if ((e.key === 'Delete' || (e.key === 'Backspace' && e.ctrlKey))) {
            const selected = cy.$(':selected');
            selected.forEach(ele => {
                if(ele.isNode()) deleteEntity(ele.id());
                if(ele.isEdge()) deleteLink(ele.id());
            });
            onEntitySelect?.(null);
         } else if (e.key === 'Escape') {
            handleCancelLink();
         } else if ((e.key === 'l' || e.key === 'L') && !linkModeRef.current) {
            const selected = cy.$('node:selected');
            if (selected.length === 1) {
               startLinkMode(selected[0]);
            }
         }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        if (cyRef.current) {
          cyRef.current.destroy();
          cyRef.current = null;
        }
        isInitializedRef.current = false;
      };
    })();
  }, []);

  // Track cursor position for collaboration
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isConnected) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      updateCursor(x, y);
    };

    container.addEventListener('mousemove', handleMouseMove);
    return () => container.removeEventListener('mousemove', handleMouseMove);
  }, [isConnected, updateCursor]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !currentGraph) return;
    // If sync is large, temporarily hide node-html container to reduce DOM churn
    let hidNodeHtml = false;
    let nodeHtmlRoot: HTMLElement | null = null;
    try {
      // If graph is large and nodeHtml is enabled, remove node-html elements and disable it
      if (containerRef.current && currentGraph.entities.length > NODE_HTML_THRESHOLD && nodeHtmlEnabledRef.current) {
        const roots = Array.from(containerRef.current.querySelectorAll('[class^="cy-node-html"]')) as HTMLElement[];
        roots.forEach(r => r.remove());
        nodeHtmlEnabledRef.current = false;
      } else if (containerRef.current && currentGraph.entities.length > NODE_HTML_THRESHOLD) {
        // If nodeHtml not enabled but DOM exists, remove any leftover
        nodeHtmlRoot = containerRef.current.querySelector('[class^="cy-node-html"]') as HTMLElement | null;
        if (nodeHtmlRoot) {
          nodeHtmlRoot.remove();
          hidNodeHtml = true;
        }
      }
    } catch (e) {
      /* ignore */
    }

    cy.batch(() => {
        (currentGraph.entities as any[]).forEach(entity => {
            if (cy.$id(entity.id).length === 0) {
        const position = entity.position || {
            x: Math.random() * 800 + 100,
            y: Math.random() * 600 + 100
        };
        cy.add({
            data: {
                id: entity.id,
                label: entity.data?.label || entity.value,
                color: entity.data?.color || '#64748b',
                type: entity.type,
                properties: entity.properties || {}, // Pass properties
                data: entity.data || {} // Pass data object
            },
            position: position,
        });
            } else {
                const node = cy.$id(entity.id);
                const newLabel = entity.data?.label || entity.value;
                if (node.data('label') !== newLabel) {
                    node.data('label', newLabel);
                }
                if (entity.data?.color && node.data('color') !== entity.data.color) {
                    node.data('color', entity.data.color);
                }
                if (entity.data?.type && node.data('type') !== entity.data.type) {
                    node.data('type', entity.data.type);
                }
            }
        });
        cy.nodes().forEach(node => {
            if (!currentGraph.entities.find(e => e.id === node.id())) {
                cy.remove(node);
            }
        });
        currentGraph.links.forEach(link => {
             if (cy.$id(link.id).length === 0) {
                 cy.add({
                     data: {
                         id: link.id,
                         source: link.source,
                         target: link.target,
                         label: link.label || ''
                     }
                 });
             }
        });
        cy.edges().forEach(edge => {
            if (!currentGraph.links.find(l => l.id === edge.id())) {
                cy.remove(edge);
            }
        });
    });
    // Smart auto-fit: Only fit view when NEW nodes are added, not on every sync
    // DO NOT re-run breadthfirst layout — positions are managed by TransformPanel
    try {
      const nodeCount = cy.nodes().length;
      const prevCount = prevNodeCountRef.current;
      const newNodesAdded = nodeCount > prevCount;
      prevNodeCountRef.current = nodeCount;
      
      if (newNodesAdded && nodeCount > 0) {
        // Fit all nodes into view with generous padding
        cy.fit(undefined, 80);
        
        // Clamp zoom to avoid extremes:
        // - Too zoomed in (single node fills screen) → cap at 0.85
        // - Too zoomed out (tiny dots) → floor at 0.3
        const curZoom = cy.zoom();
        let targetZoom = curZoom;
        
        if (nodeCount <= 2) {
          // Very few nodes: don't zoom in too much, show context
          targetZoom = Math.min(curZoom, 0.7);
        } else if (nodeCount <= 10) {
          targetZoom = Math.min(curZoom, 0.85);
        } else {
          // Many nodes: let fit decide but cap at 1.0
          targetZoom = Math.min(curZoom, 1.0);
        }
        targetZoom = Math.max(targetZoom, 0.3);
        
        if (Math.abs(targetZoom - curZoom) > 0.01) {
          cy.animate({ zoom: { level: targetZoom, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } }, duration: 400 });
        }
      }
    } catch (e) { /* ignore */ }

    // If graph has shrunk below threshold and nodeHtml isn't enabled yet, initialize it
    try {
      if (currentGraph.entities.length <= NODE_HTML_THRESHOLD && !nodeHtmlEnabledRef.current) {
        setupNodeHtml(cy);
      }
    } catch (e) { /* ignore */ }
    // cy.fit(undefined, 50); // Disabled dynamic auto-zoom at user request
  }, [currentGraph]);

  // Drag & drop handlers (fixed: previously misplaced block caused syntax error)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const entityType = e.dataTransfer.getData('entityType') as EntityType;
    if (!cyRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pan = cyRef.current.pan();
    const zoom = cyRef.current.zoom();
    const graphX = ((e.clientX - rect.left) - pan.x) / zoom;
    const graphY = ((e.clientY - rect.top) - pan.y) / zoom;
    setPendingEntity({ type: entityType, x: graphX, y: graphY });
    setNewEntityName(`Новый ${entityType}`);
    setShowNameDialog(true);
  };

  // Link mode helpers
  const startLinkMode = (node: NodeSingular) => {
    if (!node || !cyRef.current) return;
    linkModeRef.current = true;
    linkSourceRef.current = node;
    try { node.addClass('link-source'); } catch (e) { /* ignore */ }
    setLinkMode(true);
  };

  const handleStartLink = () => {
    const cy = cyRef.current;
    if (!cy) return;
    // If already in link mode, cancel it
    if (linkModeRef.current) {
      handleCancelLink();
      return;
    }
    const selected = cy.$('node:selected');
    if (selected.length === 1) {
      startLinkMode(selected[0]);
    }
  };

  const handleCancelLink = () => {
    if (linkSourceRef.current) {
      try { linkSourceRef.current.removeClass('link-source'); } catch (e) { /* ignore */ }
      linkSourceRef.current = null;
    }
    linkModeRef.current = false;
    setLinkMode(false);
  };

  const handleDelete = () => {
    const cy = cyRef.current;
    if (!cy) return;
    const selected = cy.$(':selected');
    selected.forEach((ele: any) => {
      if (ele.isNode && ele.isNode()) deleteEntity(ele.id());
      if (ele.isEdge && ele.isEdge()) deleteLink(ele.id());
    });
    onEntitySelect?.(null);
  };
  const confirmAddEntity = () => {
      if (!pendingEntity) return;
      const defaultName = `Новый ${pendingEntity.type}`;
      const finalName = newEntityName.trim() || defaultName;
      
      // Deterministic ID generation to prevent duplicates with Backend Transforms
      let prefix = 'node';
      if (pendingEntity.type === 'domain') prefix = 'domain';
      else if (pendingEntity.type === 'ip_address') prefix = 'ip';
      else if (pendingEntity.type === 'email_address') prefix = 'email';
      
      const newEntityId = prefix === 'node' ? `node-${Date.now()}` : `${prefix}-${finalName}`;
      const colorMap: Record<string, string> = {
        [EntityType.Domain]: '#3b82f6',
        [EntityType.IPAddress]: '#10b981',
        [EntityType.EmailAddress]: '#8b5cf6',
        [EntityType.Person]: '#eab308',
        [EntityType.Organization]: '#f97316',
        [EntityType.Location]: '#ef4444',
        [EntityType.PhoneNumber]: '#06b6d4',
      };
      const newEntity = {
          id: newEntityId,
          type: pendingEntity.type,
          value: finalName,
          data: {
              label: finalName,
              color: colorMap[pendingEntity.type] || '#64748b',
              note: newEntityNote,
              initialX: pendingEntity.x,
              initialY: pendingEntity.y,
          },
      };
      addEntity(newEntity);
      
      // Broadcast to collaborators
      if (isConnected) {
        sendCommand({
          type: 'add_entity',
          payload: newEntity,
          userId: 'local',
        });
      }
      
      setShowNameDialog(false);
      setPendingEntity(null);
      setNewEntityName('');
      setNewEntityNote('');
  };
  const handleContextAction = (action: 'link' | 'delete' | 'nmap' | 'geolocate') => {
      if(!contextMenu?.target) return;
      const target = contextMenu.target;
      if(action === 'delete') {
          if(target.isNode()) deleteEntity(target.id());
          if(target.isEdge()) deleteLink(target.id());
          onEntitySelect?.(null);
      } else if (action === 'link' && target.isNode()) {
          startLinkMode(target);
      } else if (action === 'nmap' && target.isNode()) {
          // Nmap scan - handled via modal
          const entity = currentGraph?.entities.find(e => e.id === target.id());
          if (entity && entity.type === EntityType.IPAddress) {
              setNmapTarget(entity);
              setShowNmapModal(true);
          }
      } else if (action === 'geolocate' && target.isNode()) {
          const entity = currentGraph?.entities.find(e => e.id === target.id());
          if (entity && entity.type === 'ip_address') {
              handleGeolocateIP(entity);
          }
      }
      setContextMenu(null);
  };
  const handleGeolocateIP = async (entity: any) => {
      try {
          const token = localStorage.getItem('token');
          const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
          const response = await fetch(`${API_URL}/api/transforms/geolocate`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ ipAddress: entity.value })
          });
          if (!response.ok) {
              console.error('Geolocation failed:', await response.text());
              return;
          }
          const result = await response.json();
          if (result.success && result.data) {
              const { updateEntity: update } = useGraphStore.getState();
              update(entity.id, {
                  data: {
                      ...entity.data,
                      lat: result.data.lat,
                      lon: result.data.lon,
                      country: result.data.country,
                      city: result.data.city,
                      regionName: result.data.regionName,
                      isp: result.data.isp
                  }
              });
          }
      } catch (error) {
          // Geolocation error silently handled
      }
  };

  // RE-ENFORCING ASYNC LOGIC for Nmap
  // RE-ENFORCING ASYNC LOGIC for Nmap
  const handleNmapScanComplete = async (scanData: any) => {
      // Logic Simplified: Backend now handles the topology (v2.1 Fix)
      // We entrust the backend to provide the correct entities and links structure.
      if (!scanData.results || !nmapTarget) {
          setShowNmapModal(false);
          setNmapTarget(null);
          return;
      }

      // 1. Add Entities (Host, Scan Result, Ports)
      if (Array.isArray(scanData.results)) {
          scanData.results.forEach((entity: any) => {
             // Ensure position is set if missing (though layout agent should handle it)
             // For now, we let the auto-layout or randomizer handle position if not provided
             addEntity(entity);
          });
      }

      // 2. Add Links (Host->Scan, Scan->Ports)
      if (Array.isArray(scanData.links)) {
          scanData.links.forEach((link: any) => {
              addLink(link);
          });
      }

      setShowNmapModal(false);
      setNmapTarget(null);
  };
  return (
    <div className="relative w-full h-full">
      <NmapScanModal
        isOpen={showNmapModal}
        onClose={() => {
            setShowNmapModal(false);
            setNmapTarget(null);
        }}
        targetEntity={nmapTarget}
        onScanComplete={handleNmapScanComplete}
      />
      {/* Version Marker for User Verification */}
      <div className="absolute bottom-4 right-4 text-xs text-slate-600 pointer-events-none select-none">
        GraphCanvas v2.1 (Backend Topology Fix)
      </div>
      {nodeCount === 0 && currentView === 'graph' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-4">
            <div className="text-xl font-medium text-slate-300">Начните расследование</div>
            <div className="text-sm space-y-2 text-slate-400">
              <div>1. Перетащите объекты из левой панели</div>
              <div>2. Нажмите L чтобы связать их</div>
              <div>3. Используйте трансформы для обогащения данных</div>
              <div className="text-xs mt-4 opacity-50">ПКМ - меню • Del - удаление</div>
            </div>
          </div>
        </div>
      )}
      {}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
        <ViewToggle currentView={currentView} onChange={setCurrentView} />
      </div>
      <div 
        ref={containerRef} 
        className="w-full h-full bg-slate-950"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: currentView === 'graph' ? 'block' : 'none'
        }}
      />

      {currentView === 'graph' && (
        <div className="absolute top-4 right-4 glass rounded-lg p-2 flex flex-col gap-2 z-20">
          <button onClick={() => cyRef.current?.zoom((cyRef.current?.zoom() || 1) * 1.2)} className="p-2 hover:bg-slate-700 rounded" title="Увеличить"><ZoomIn className="w-5 h-5 text-slate-300" /></button>
          <button onClick={() => cyRef.current?.zoom((cyRef.current?.zoom() || 1) * 0.8)} className="p-2 hover:bg-slate-700 rounded" title="Уменьшить"><ZoomOut className="w-5 h-5 text-slate-300" /></button>
          <button onClick={() => cyRef.current?.fit(undefined, 50)} className="p-2 hover:bg-slate-700 rounded" title="По размеру"><Maximize2 className="w-5 h-5 text-slate-300" /></button>
          <div className="h-px bg-slate-700 my-1" />
          <button onClick={handleStartLink} className={`p-2 hover:bg-slate-700 rounded ${linkMode ? 'bg-green-600' : ''}`} title="Создать связь (L)"><Link2 className="w-5 h-5 text-slate-300" /></button>
          <button onClick={handleDelete} className="p-2 hover:bg-red-600 rounded" title="Удалить (Del)"><Trash2 className="w-5 h-5 text-slate-300" /></button>
        </div>
      )}
      
      {/* Collaborator Cursors */}
      {collaborators.map((collab) => (
        collab.cursor && (
          <div
            key={collab.id}
            className="fixed z-30 pointer-events-none"
            style={{
              left: `${collab.cursor.x}px`,
              top: `${collab.cursor.y}px`,
            }}
          >
            <div className="flex flex-col items-start gap-1">
              {/* Cursor */}
              <div
                className="w-5 h-6 triangular-cursor"
                style={{
                  clipPath: 'polygon(0 0, 100% 0, 100% 85%, 65% 85%, 30% 100%, 0 85%)',
                  backgroundColor: collab.color,
                  filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.5))`,
                }}
              />
              {/* Name Label */}
              <div
                className="px-2 py-1 rounded text-xs font-semibold text-white whitespace-nowrap shadow-lg"
                style={{
                  backgroundColor: collab.color,
                  marginLeft: '4px',
                }}
              >
                {collab.name}
              </div>
            </div>
          </div>
        )
      ))}
      
      {contextMenu && (
        <div 
            className="fixed z-50 w-48 bg-card border border-border shadow-xl rounded-md overflow-hidden animate-in fade-in zoom-in duration-200"
            style={{ left: contextMenu.x, top: contextMenu.y }}
        >
            <button 
                className="w-full text-left px-4 py-2 text-sm hover:bg-accent flex items-center gap-2"
                onClick={() => handleContextAction('link')}
            >
                <Link2 className="w-4 h-4" /> Связать
            </button>
            {contextMenu.target.isNode() && (
                <>
                    <div className="h-px bg-border my-1" />
                    <button 
                        className="w-full text-left px-4 py-2 text-sm hover:bg-green-500/10 text-green-400 flex items-center gap-2"
                        onClick={() => handleContextAction('nmap')}
                    >
                        <Wifi className="w-4 h-4" /> Nmap Scan
                    </button>
                    {contextMenu.target.data().type === 'ip_address' && (
                      <button 
                          className="w-full text-left px-4 py-2 text-sm hover:bg-blue-500/10 text-blue-400 flex items-center gap-2"
                          onClick={() => handleContextAction('geolocate')}
                      >
                          🌍 Geolocate IP
                      </button>
                    )}
               </>
            )}
            <div className="h-px bg-border my-1" />
            <button 
                className="w-full text-left px-4 py-2 text-sm hover:bg-destructive/10 text-destructive hover:text-destructive flex items-center gap-2"
                onClick={() => handleContextAction('delete')}
            >
                <Trash2 className="w-4 h-4" /> Удалить
            </button>
        </div>
      )}

      {linkMode && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 glass px-6 py-3 rounded-xl shadow-2xl border-2 border-green-500/50 z-20">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" /><span className="text-green-400 font-semibold">Режим связи</span></div>
            <span className="text-slate-300 text-sm">Кликните по целевому узлу</span>
            <button onClick={handleCancelLink} className="px-3 py-1 bg-red-600/20 hover:bg-red-600/30 rounded-lg text-red-400 text-sm flex items-center gap-1"><X className="w-3 h-3" />Отмена (Esc)</button>
          </div>
        </div>
      )}

      {currentView === 'graph' ? (
        <>
          {}
          {}
          <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-sm p-3 rounded-lg border border-slate-700 text-sm">
            <div className="flex gap-4">
              <div className="text-slate-400">Объекты: <span className="text-blue-400 font-semibold">{nodeCount}</span></div>
              <div className="text-slate-400">Связи: <span className="text-green-400 font-semibold">{edgeCount}</span></div>
            </div>
          </div>
          {}
          <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
            {}
          </div>
          {}
          {linkMode && (
            <div className="absolute top-4 right-4 z-10 bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 rounded-lg shadow-lg animate-pulse">
              <p className="text-white text-sm font-medium flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                Link Mode Active - Click source then target
              </p>
            </div>
          )}
        </>
      ) : (
        <MapCanvas
          entities={(currentGraph?.entities || []).filter(e => e.data?.lat && e.data?.lon) as any}
          onEntityClick={(entity) => {
            const fullEntity = currentGraph?.entities.find(e => e.id === entity.id);
            if (fullEntity) selectEntity(fullEntity);
          }}
        />
      )}
      {}
      {contextMenu && (
        <div
          className="fixed bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-2 z-50"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {}
        </div>
      )}
      {}
      <NmapScanModal
        isOpen={showNmapModal}
        onClose={() => {
          setShowNmapModal(false);
          setNmapTarget(null);
        }}
        onScanComplete={(results) => {
          // Nmap scan completed handler
        }}
      />
      {}
      {showNameDialog && pendingEntity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-2xl w-80 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-semibold mb-4 text-white">Добавить сущность</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Имя / Значение</label>
                <input 
                  autoFocus
                  type="text" 
                  value={newEntityName} 
                  onChange={(e) => setNewEntityName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmAddEntity();
                    if (e.key === 'Escape') {
                      setShowNameDialog(false);
                      setPendingEntity(null);
                      setNewEntityName('');
                      setNewEntityNote('');
                    }
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white focus:border-purple-500 focus:outline-none mb-2"
                />
                <label className="text-xs text-slate-400 mb-1 block">Заметка (опционально)</label>
                <textarea 
                  value={newEntityNote}
                  onChange={(e) => setNewEntityNote(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white h-20 text-sm focus:border-purple-500 focus:outline-none resize-none"
                  placeholder="Комментарий..."
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button 
                  onClick={() => {
                    setShowNameDialog(false);
                    setPendingEntity(null);
                    setNewEntityName('');
                    setNewEntityNote('');
                  }} 
                  className="flex-1 px-3 py-2 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors">
                  Отмена
                </button>
                <button 
                  onClick={confirmAddEntity} 
                  className="flex-1 px-3 py-2 rounded bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/50">
                  Создать
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {}
      <style jsx global>{`
        .node-html-card {
          pointer-events: none;
        }
        .node-card {
          width: 200px;
          background: #1e1e2e;
          border: 2px solid;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
          font-family: system-ui, -apple-system, sans-serif;
        }
        .card-header {
          padding: 6px 12px;
          text-align: center;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .card-body {
          padding: 16px 12px 12px;
        }
        .main-value {
          color: #ffffff;
          font-size: 16px;
          font-weight: 600;
          text-align: center;
          margin-bottom: 12px;
          word-break: break-word;
          line-height: 1.3;
        }
        .info-box {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 8px;
          padding: 8px 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .info-label {
          color: #9ca3af;
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .info-value {
          color: #e5e7eb;
          font-size: 11px;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}

