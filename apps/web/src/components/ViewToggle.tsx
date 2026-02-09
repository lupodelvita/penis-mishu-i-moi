'use client';

import { Map, Network } from 'lucide-react';

interface ViewToggleProps {
  currentView: 'graph' | 'map';
  onChange: (view: 'graph' | 'map') => void;
}

export default function ViewToggle({ currentView, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1 border border-slate-700">
      <button
        onClick={() => onChange('graph')}
        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
          currentView === 'graph'
            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
            : 'text-slate-400 hover:text-white hover:bg-slate-700'
        }`}
      >
        <Network className="w-4 h-4" />
        <span className="text-sm font-medium">Graph</span>
      </button>
      
      <button
        onClick={() => onChange('map')}
        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
          currentView === 'map'
            ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg'
            : 'text-slate-400 hover:text-white hover:bg-slate-700'
        }`}
      >
        <Map className="w-4 h-4" />
        <span className="text-sm font-medium">Map</span>
      </button>
    </div>
  );
}
