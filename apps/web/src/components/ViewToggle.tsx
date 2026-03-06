'use client';

import { memo } from 'react';
import { Map, Network } from 'lucide-react';

interface ViewToggleProps {
  currentView: 'graph' | 'map';
  onChange: (view: 'graph' | 'map') => void;
}

export default memo(function ViewToggle({ currentView, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center bg-background border border-border rounded-none overflow-hidden">
      <button
        onClick={() => onChange('graph')}
        className={`flex items-center gap-1.5 px-3 py-1.5 transition-all text-xs font-medium border-r border-border ${
          currentView === 'graph'
            ? 'bg-sky-500/12 text-sky-300'
            : 'text-slate-500 hover:text-slate-300 hover:bg-accent/50'
        }`}
      >
        <Network className="w-3.5 h-3.5" />
        Graph
      </button>
      <button
        onClick={() => onChange('map')}
        className={`flex items-center gap-1.5 px-3 py-1.5 transition-all text-xs font-medium ${
          currentView === 'map'
            ? 'bg-emerald-500/12 text-emerald-300'
            : 'text-slate-500 hover:text-slate-300 hover:bg-accent/50'
        }`}
      >
        <Map className="w-3.5 h-3.5" />
        Map
      </button>
    </div>
  );
});
