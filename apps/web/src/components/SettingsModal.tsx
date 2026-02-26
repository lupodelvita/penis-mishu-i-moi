import { useState, useEffect } from 'react';
import { X, Save, Key } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://nodeweaver-api.onrender.com';

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [discordToken, setDiscordToken] = useState('');
  const [discordChannelId, setDiscordChannelId] = useState('');
  const [apiUrl, setApiUrl] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDiscordToken(localStorage.getItem('nw_discord_token') || '');
      setDiscordChannelId(localStorage.getItem('nw_discord_channel') || '');
      setApiUrl(localStorage.getItem('nw_api_url') || '');
    }
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('nw_discord_token', discordToken);
    localStorage.setItem('nw_discord_channel', discordChannelId);
    if (apiUrl.trim()) {
      localStorage.setItem('nw_api_url', apiUrl.trim().replace(/\/$/, ''));
    } else {
      localStorage.removeItem('nw_api_url');
    }
    alert('Settings saved!');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-900 border border-purple-500/20 rounded-xl w-full max-w-md p-6 shadow-2xl animate-fade-in-up">
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-purple-400">
            <Key className="w-5 h-5" />
            <h2 className="text-xl font-bold text-white">Settings</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">API Server URL</label>
            <input 
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder={DEFAULT_API_URL}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
            <p className="text-xs text-slate-500 mt-1">Leave empty to use the default server. Changes apply immediately.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Discord Bot Token</label>
            <input 
              type="password"
              value={discordToken}
              onChange={(e) => setDiscordToken(e.target.value)}
              placeholder="Enter your Bot Token"
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Channel ID</label>
            <input 
              type="text"
              value={discordChannelId}
              onChange={(e) => setDiscordChannelId(e.target.value)}
              placeholder="Enter your Channel ID"
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors font-medium shadow-lg shadow-purple-500/20"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>

      </div>
    </div>
  );
}

