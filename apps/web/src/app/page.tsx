'use client';

import { useState, useEffect } from 'react';
import { EntityType } from '@nodeweaver/shared-types';
import { useGraphStore } from '@/store';
import GraphCanvas from '@/components/GraphCanvasV2';
import EntityPalette from '@/components/EntityPalette';
import TransformPanel from '@/components/TransformPanel';
import DetailPanel from '@/components/DetailPanel';
import Toolbar from '@/components/Toolbar';
import AIAssistant from '@/components/AIAssistant';
import CollaborationPanel from '@/components/CollaborationPanel';
import SettingsModal from '@/components/SettingsModal';
import SeoConsole from '@/components/SeoConsole';
import TransformBuilder from '@/components/TransformBuilder';
import { useCollaborationStore } from '@/store';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  const [showAI, setShowAI] = useState(false);
  const [showCollab, setShowCollab] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSeoConsole, setShowSeoConsole] = useState(false);
  const [actionInput, setActionInput] = useState<{ type: 'nmap' | 'whois', isOpen: boolean }>({ type: 'nmap', isOpen: false });
  const [inputValue, setInputValue] = useState('');
  
  const { addEntity, selectEntity } = useGraphStore();
  const { connect } = useCollaborationStore();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  // Handle Electron Menu Events
  useEffect(() => {
    const win = window as any;
    if (typeof window !== 'undefined' && win.electron) {
      const handleNmap = () => {
          setInputValue('');
          setActionInput({ type: 'nmap', isOpen: true });
      };

      const handleWhois = () => {
          setInputValue('');
          setActionInput({ type: 'whois', isOpen: true });
      };

      const handleApiKeys = () => alert('API Keys management is not yet implemented.');
      const handleSettings = () => alert('Settings are not yet implemented.');
      const handleTransformManager = () => setShowBuilder(true);

      const events = [
        ['menu:nmap-scan', handleNmap],
        ['menu:whois-lookup', handleWhois],
        ['menu:api-keys', handleApiKeys],
        ['menu:settings', handleSettings],
        ['menu:transform-manager', handleTransformManager]
      ] as const;

      events.forEach(([evt, handler]) => win.electron.onMenuEvent(evt, handler));

      return () => {
         events.forEach(([evt]) => win.electron.removeMenuListener(evt));
      };
    }
    return undefined;
  }, [addEntity, selectEntity]);

  // Auto-connect to collaboration on mount
  useEffect(() => {
    if (user) {
      const graphId = 'default-graph';
      const userName = user.username || `User-${Math.floor(Math.random() * 1000)}`;
      connect(graphId, userName);
      
      // CRITICAL: Cleanup on unmount to prevent duplicates
      return () => {
        // disconnect(); // Don't disconnect on every re-render, only on unmount
      };
    }
    return undefined;
  }, [user]); // Removed 'connect' from deps to prevent reconnection loops

  if (loading || !user) {
    return <div className="h-screen w-screen bg-black flex items-center justify-center text-white">Loading NodeWeaver...</div>;
  }



  const handleActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue) return;

    const id = crypto.randomUUID();
    let type = EntityType.Domain;
    let transformId = '';

    if (actionInput.type === 'nmap') {
        const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(inputValue);
        type = isIp ? EntityType.IPAddress : EntityType.Domain;
        transformId = 'network.port_scan';
    } else {
        type = EntityType.Domain;
        transformId = 'whois.domain';
    }

    const entity = {
        id,
        type,
        value: inputValue,
        data: { label: inputValue },
        properties: {},
        metadata: { created: new Date().toISOString() }
    };

    addEntity(entity);
    setActionInput({ ...actionInput, isOpen: false });

    // Run
    setTimeout(() => {
        selectEntity(entity);
        setSelectedEntityId(id);
        // Auto-run transform
        window.dispatchEvent(new CustomEvent('node-weaver:run-transform', { detail: { transformId } }));
    }, 200);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Top Toolbar */}
      <Toolbar 
        onToggleCollaboration={() => setShowCollab(!showCollab)}
        onToggleAI={() => setShowAI(!showAI)}
        onToggleSeoConsole={() => setShowSeoConsole(!showSeoConsole)}
        onToggleTerminal={() => {}}
      />
      
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
      
      <SeoConsole isOpen={showSeoConsole} onClose={() => setShowSeoConsole(false)} />

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden flex">
        {/* Left Sidebar - Entity Palette */}
        <EntityPalette />

        {/* Center - Graph Canvas */}
        <div className="flex-1 relative">
          <GraphCanvas 
            onEntitySelect={setSelectedEntityId}
          />
        </div>

        {/* Right Sidebar - Transform Panel & Details */}
        <div className="w-80 flex flex-col border-l border-border">
          <TransformPanel 
            selectedEntityId={selectedEntityId}
          />
          <DetailPanel selectedEntityId={selectedEntityId} />
        </div>
      </div>

      {/* Floating Components */}
      {showCollab && <CollaborationPanel />}
      {showBuilder && <TransformBuilder onClose={() => setShowBuilder(false)} />}
      
      {/* Action Input Modal */}
      {actionInput.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <form onSubmit={handleActionSubmit} className="bg-background border border-border rounded-lg p-4 w-96 shadow-lg">
             <h3 className="font-semibold mb-4">
               {actionInput.type === 'nmap' ? 'Nmap Scan' : 'WHOIS Lookup'}
             </h3>
             <input 
               type="text" 
               autoFocus
               value={inputValue}
               onChange={(e) => setInputValue(e.target.value)}
               placeholder={actionInput.type === 'nmap' ? 'IP Address or Domain' : 'Domain Name'}
               className="w-full px-3 py-2 bg-secondary border border-border rounded mb-4 focus:outline-none focus:ring-1 focus:ring-primary"
             />
             <div className="flex justify-end gap-2">
               <button 
                 type="button" 
                 onClick={() => setActionInput({ ...actionInput, isOpen: false })}
                 className="px-3 py-1 text-sm hover:bg-muted rounded"
               >
                 Cancel
               </button>
               <button 
                 type="submit" 
                 className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
               >
                 Run
               </button>
             </div>
          </form>
        </div>
      )}

      {/* AI Assistant - controlled by toolbar only - Moved to Right to avoid blocking Palette */}
      {showAI && (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] pointer-events-none">
          <div className="pointer-events-auto h-full">
             <AIAssistant isOpen={showAI} onToggle={() => setShowAI(!showAI)} />
          </div>
        </div>
      )}
    </div>
  );
}
