import React, { useState } from 'react';
import { Settings, Key, X, Save, Crown, Activity } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface SeoConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SeoConsole({ isOpen, onClose }: SeoConsoleProps) {
  const { user } = useAuth();
  const [keys, setKeys] = useState({
    ahrefs: localStorage.getItem('seo_key_ahrefs') || '',
    semrush: localStorage.getItem('seo_key_semrush') || '',
    gsc: localStorage.getItem('seo_key_gsc') || ''
  });

  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    setSaving(true);
    // In a real app, save to DB user.settings
    localStorage.setItem('seo_key_ahrefs', keys.ahrefs);
    localStorage.setItem('seo_key_semrush', keys.semrush);
    localStorage.setItem('seo_key_gsc', keys.gsc);
    
    setTimeout(() => {
      setSaving(false);
      alert('SEO Keys Updated Successfully');
    }, 800);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center backdrop-blur-sm">
      <div className="bg-background border-2 border-yellow-500/50 rounded-xl w-[600px] shadow-2xl shadow-yellow-500/20 overflow-hidden">
        {/* Header */}
        <div className="bg-yellow-500/10 border-b border-yellow-500/30 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Crown className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-yellow-500 tracking-wider">CEO CONSOLE</h2>
              <p className="text-xs text-yellow-500/60 uppercase font-mono">SEO Intelligence Directorate</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status Bar */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 bg-secondary/50 p-3 rounded-lg border border-border flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <div>
                <div className="text-xs text-muted-foreground">System Status</div>
                <div className="font-mono text-sm font-semibold">ONLINE</div>
              </div>
            </div>
            <div className="flex-1 bg-secondary/50 p-3 rounded-lg border border-border flex items-center gap-3">
              <Activity className="w-4 h-4 text-blue-500" />
              <div>
                 <div className="text-xs text-muted-foreground">Daily Quota</div>
                 <div className="font-mono text-sm font-semibold">8,420 / 10,000</div>
              </div>
            </div>
          </div>

          {/* API Keys Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <span className="w-24 text-muted-foreground">Ahrefs Key</span>
                <input 
                  type="password"
                  value={keys.ahrefs}
                  onChange={e => setKeys(prev => ({...prev, ahrefs: e.target.value}))}
                  className="flex-1 bg-black/40 border border-border rounded px-3 py-2 font-mono text-sm focus:border-yellow-500/50 focus:outline-none transition-colors"
                  placeholder="ahr_..."
                />
              </label>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <span className="w-24 text-muted-foreground">SEMRush Key</span>
                <input 
                  type="password"
                  value={keys.semrush}
                  onChange={e => setKeys(prev => ({...prev, semrush: e.target.value}))}
                  className="flex-1 bg-black/40 border border-border rounded px-3 py-2 font-mono text-sm focus:border-yellow-500/50 focus:outline-none transition-colors"
                  placeholder="sem_..."
                />
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <span className="w-24 text-muted-foreground">Google SC</span>
                <input 
                  type="password"
                  value={keys.gsc}
                  onChange={e => setKeys(prev => ({...prev, gsc: e.target.value}))}
                  className="flex-1 bg-black/40 border border-border rounded px-3 py-2 font-mono text-sm focus:border-yellow-500/50 focus:outline-none transition-colors"
                  placeholder="AIza..."
                />
              </label>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
               onClick={handleSave}
               disabled={saving}
               className="flex items-center gap-2 px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-semibold rounded-lg transition-all shadow-lg shadow-yellow-900/40"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
