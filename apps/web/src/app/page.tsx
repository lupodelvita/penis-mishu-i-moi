'use client';

import { useState, useEffect, useCallback, lazy, Suspense, memo } from 'react';
import { Zap, Info } from 'lucide-react';
import { EntityType } from '@nodeweaver/shared-types';
import { useGraphStore } from '@/store';
import GraphCanvas from '@/components/GraphCanvasV2';
import EntityPalette from '@/components/EntityPalette';
import TransformPanel from '@/components/TransformPanel';
import DetailPanel from '@/components/DetailPanel';
import Toolbar from '@/components/Toolbar';
import CollaborationPanel from '@/components/CollaborationPanel';
import { InvitationModal } from '@/components/InvitationModal';
import { useCollaborationStore } from '@/store';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

// Lazy-loaded components (not needed on initial render)
const AIAssistant = lazy(() => import('@/components/AIAssistant'));
const SettingsModal = lazy(() => import('@/components/SettingsModal'));
const SeoConsole = lazy(() => import('@/components/SeoConsole'));
const TransformBuilder = lazy(() => import('@/components/TransformBuilder'));

const RightSidebar = memo(function RightSidebar({ selectedEntityId }: { selectedEntityId: string | null }) {
  const [activeTab, setActiveTab] = useState<'transforms' | 'details'>('transforms');

  return (
    <div className="w-80 flex flex-col border-l border-border overflow-hidden">
      {/* Tab Bar */}
      <div className="flex border-b border-border shrink-0">
        <button
          onClick={() => setActiveTab('transforms')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all ${
            activeTab === 'transforms'
              ? 'text-sky-300 border-b border-sky-400/60 bg-sky-500/5'
              : 'text-slate-500 hover:text-slate-300 hover:bg-accent/30'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          Трансформы
        </button>
        <button
          onClick={() => setActiveTab('details')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all ${
            activeTab === 'details'
              ? 'text-sky-300 border-b border-sky-400/60 bg-sky-500/5'
              : 'text-slate-500 hover:text-slate-300 hover:bg-accent/30'
          }`}
        >
          <Info className="w-3.5 h-3.5" />
          Детали
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'transforms' ? (
        <TransformPanel selectedEntityId={selectedEntityId} />
      ) : (
        <DetailPanel selectedEntityId={selectedEntityId} />
      )}
    </div>
  );
});

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

  // Stable callbacks for child components
  const handleToggleCollab = useCallback(() => setShowCollab(v => !v), []);
  const handleToggleAI = useCallback(() => setShowAI(v => !v), []);
  const handleToggleSeoConsole = useCallback(() => setShowSeoConsole(v => !v), []);
  const handleToggleTerminal = useCallback(() => {}, []);
  const handleEntitySelect = useCallback((id: string | null) => setSelectedEntityId(id), []);
  const handleCloseSettings = useCallback(() => setShowSettings(false), []);
  const handleCloseSeoConsole = useCallback(() => setShowSeoConsole(false), []);
  const handleCloseBuilder = useCallback(() => setShowBuilder(false), []);

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

  // Initialize Socket.IO connection on mount (don't auto-join a graph)
  useEffect(() => {
    if (user) {
      const userName = user.username || `User-${Math.floor(Math.random() * 1000)}`;
      const { initializeSocket } = useCollaborationStore.getState();
      initializeSocket(userName, user.id, user.accountCode);
      
      // CRITICAL: Cleanup on unmount to prevent duplicates
      return () => {
        // Socket cleanup handled by store
      };
    }
    return undefined;
  }, [user]);

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
        onToggleCollaboration={handleToggleCollab}
        onToggleAI={handleToggleAI}
        onToggleSeoConsole={handleToggleSeoConsole}
        onToggleTerminal={handleToggleTerminal}
      />
      
      <Suspense fallback={null}>
        {showSettings && (
          <SettingsModal 
            isOpen={showSettings} 
            onClose={handleCloseSettings} 
          />
        )}
      </Suspense>
      
      <Suspense fallback={null}>
        {showSeoConsole && <SeoConsole isOpen={showSeoConsole} onClose={handleCloseSeoConsole} />}
      </Suspense>

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden flex">
        {/* Left Sidebar - Entity Palette */}
        <EntityPalette />

        {/* Center - Graph Canvas */}
        <div className="flex-1 relative">
          <GraphCanvas 
            onEntitySelect={handleEntitySelect}
          />
        </div>

        {/* Right Sidebar - Tabbed Panel */}
        <RightSidebar selectedEntityId={selectedEntityId} />
      </div>

      {/* Floating Components */}
      {showCollab && <CollaborationPanel />}
      <InvitationModal />
      <Suspense fallback={null}>
        {showBuilder && <TransformBuilder onClose={handleCloseBuilder} />}
      </Suspense>
      
      {/* Action Input Modal */}
      {actionInput.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm">
          <form onSubmit={handleActionSubmit} className="bg-card border border-border w-80 shadow-2xl">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 font-mono uppercase tracking-widest">
                {actionInput.type === 'nmap' ? 'Nmap Scan' : 'WHOIS Lookup'}
              </span>
              <button type="button" onClick={() => setActionInput({ ...actionInput, isOpen: false })}
                className="text-slate-600 hover:text-slate-300 transition text-sm leading-none">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mb-1.5 block">
                  {actionInput.type === 'nmap' ? 'IP Address or Domain' : 'Domain Name'}
                </label>
                <input
                  type="text"
                  autoFocus
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={actionInput.type === 'nmap' ? 'e.g. 192.168.1.1' : 'e.g. example.com'}
                  className="w-full px-3 py-2 bg-background border border-border text-sm text-slate-200 focus:border-sky-500/60 focus:outline-none transition-colors"
                />
              </div>
            </div>
            <div className="px-4 pb-4 flex gap-2">
              <button type="button" onClick={() => setActionInput({ ...actionInput, isOpen: false })}
                className="flex-1 px-3 py-2 text-sm text-slate-400 border border-border hover:bg-accent hover:text-slate-200 transition-colors">
                Cancel
              </button>
              <button type="submit"
                className="flex-1 px-3 py-2 text-sm font-semibold bg-sky-500 text-slate-950 hover:bg-sky-400 transition-colors"
                style={{ boxShadow: '0 0 12px rgba(56,189,248,0.2)' }}>
                Run →
              </button>
            </div>
          </form>
        </div>
      )}

      {/* AI Assistant - controlled by toolbar only */}
      {showAI && (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] pointer-events-none">
          <div className="pointer-events-auto h-full">
            <Suspense fallback={null}>
              <AIAssistant isOpen={showAI} onToggle={handleToggleAI} />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}
