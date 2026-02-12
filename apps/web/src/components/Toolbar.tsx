'use client';

import { useState, useRef } from 'react';
import { Save, FolderOpen, Upload, Download, Users, Sparkles, Bot, Shield, LogOut, Crown, Database } from 'lucide-react';
import { useGraphStore } from '@/store';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import Link from 'next/link';

interface ToolbarProps {
  onToggleCollaboration?: () => void;
  onToggleAI?: () => void;
  onToggleSeoConsole?: () => void;
  onToggleTerminal?: () => void;
  onToggleBreachVIP?: () => void;
}


export default function Toolbar({ onToggleCollaboration, onToggleAI, onToggleSeoConsole, onToggleTerminal, onToggleBreachVIP }: ToolbarProps) {
  const { currentGraph, exportGraph, importGraph } = useGraphStore();
  const { user, logout } = useAuth();
  const [graphName, setGraphName] = useState('Untitled Graph');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNew = () => {
    if (confirm('Create new graph? Current work will be lost if not saved.')) {
      window.location.reload();
    }
  };

  const handleSave = () => {
    const data = exportGraph();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${graphName.replace(/[^a-z0-9]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpen = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result as string;
        importGraph(data);
      };
      reader.readAsText(file);
    }
  };



  const handleDownloadReport = async () => {
    if (!currentGraph || !currentGraph.id) {
        alert('Please save the graph first to generate a report.');
        return;
    }

    if (user?.licenseTier === 'OBSERVER') {
        alert('Your current plan (Observer) does not support PDF exports. Please upgrade in the License Hub.');
        return;
    }


    try {
        const response = await api.post(`/reports/generate/${currentGraph.id}`, {}, {
            responseType: 'blob'
        });
        
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `report-${graphName}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
    } catch (e: any) {
        console.error(e);
        alert(e.response?.data?.error || 'Failed to generate report');
    }
  };

  const handleExport = () => {
    const menu = document.createElement('div');
    menu.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1000;background:rgba(15,23,42,0.95);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:16px;box-shadow:0 20px 60px rgba(0,0,0,0.5)';
    menu.innerHTML = `
      <div style="color:white;font-size:16px;font-weight:600;margin-bottom:12px">Export Graph</div>
      <button style="width:100%;padding:10px;margin:4px 0;background:rgba(59,130,246,0.2);border:1px solid rgba(59,130,246,0.3);border-radius:8px;color:#60a5fa;cursor:pointer;transition:all 0.2s" onmouseover="this.style.background='rgba(59,130,246,0.3)'" onmouseout="this.style.background='rgba(59,130,246,0.2)'">Export as JSON</button>
      <button style="width:100%;padding:10px;margin:4px 0;background:rgba(236,72,153,0.2);border:1px solid rgba(236,72,153,0.3);border-radius:8px;color:#f472b6;cursor:pointer;transition:all 0.2s" onmouseover="this.style.background='rgba(236,72,153,0.3)'" onmouseout="this.style.background='rgba(236,72,153,0.2)'">Generate PDF Report</button>
      <button style="width:100%;padding:10px;margin:8px 0 0 0;background:rgba(71,85,105,0.2);border:1px solid rgba(71,85,105,0.3);border-radius:8px;color:#94a3b8;cursor:pointer;transition:all 0.2s" onmouseover="this.style.background='rgba(71,85,105,0.3)'" onmouseout="this.style.background='rgba(71,85,105,0.2)'">Cancel</button>
    `;
    document.body.appendChild(menu);
    
    menu.children[1].addEventListener('click', () => { handleSave(); document.body.removeChild(menu); });
    menu.children[2].addEventListener('click', () => { handleDownloadReport(); document.body.removeChild(menu); });
    menu.children[3].addEventListener('click', () => document.body.removeChild(menu));
  };

  return (
    <div className="h-14 border-b border-border glass flex items-center justify-between px-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Left section - Logo & Title */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">NW</span>
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            NodeWeaver
          </h1>
        </div>

        <div className="h-6 w-px bg-border" />

        {/* File operations */}
        <div className="flex items-center gap-1">
          <button 
            onClick={handleNew}
            className="p-2 hover:bg-accent rounded-md transition-colors group relative" 
            title="Новый граф (Ctrl+N)"
          >
            <FolderOpen className="w-4 h-4" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-slate-900 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Новый
            </span>
          </button>
          <button 
            onClick={handleOpen}
            className="p-2 hover:bg-accent rounded-md transition-colors group relative" 
            title="Открыть (Ctrl+O)"
          >
            <Upload className="w-4 h-4" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-slate-900 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Открыть
            </span>
          </button>
          <button 
            onClick={handleSave}
            className="p-2 hover:bg-accent rounded-md transition-colors group relative" 
            title="Сохранить (Ctrl+S)"
          >
            <Save className="w-4 h-4" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-slate-900 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Сохранить
            </span>
          </button>

          <button 
            onClick={handleExport}
            className="p-2 hover:bg-accent rounded-md transition-colors group relative" 
            title="Экспорт"
          >
            <Download className="w-4 h-4" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-slate-900 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Экспорт
            </span>
          </button>
        </div>

        <div className="h-6 w-px bg-border" />

        {/* Tools */}
        <div className="flex items-center gap-1">
          <button 
            onClick={onToggleCollaboration}
            className="p-2 hover:bg-accent rounded-md transition-colors group relative" 
            title="Коллаборация"
          >
            <Users className="w-4 h-4" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-slate-900 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Коллаборация
            </span>
          </button>
          <button 
            onClick={onToggleAI}
            className="p-2 hover:bg-accent rounded-md transition-colors group relative" 
            title="AI Ассистент"
          >
            <Sparkles className="w-4 h-4" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-slate-900 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              AI Ассистент
            </span>
          </button>
          <button 
            onClick={onToggleBreachVIP}
            className="p-2 hover:bg-accent rounded-md transition-colors group relative" 
            title="BreachVIP OSINT"
          >
            <Database className="w-4 h-4 text-red-400" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-slate-900 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              BreachVIP
            </span>
          </button>

        </div>
      </div>

      {/* Center section - Graph name */}
      <div className="flex-1 flex justify-center">
        <input
          type="text"
          value={graphName}
          onChange={(e) => setGraphName(e.target.value)}
          className="bg-transparent border-none outline-none text-center text-sm font-medium hover:bg-accent/50 px-4 py-1 rounded-md transition-colors max-w-xs"
        />
      </div>

      {/* Right section - View controls & Auth */}
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-1 mr-4">
            {/* Terminal Toggle - DISABLED */}
            {/* <button 
              onClick={onToggleTerminal}
              className="p-2 hover:bg-accent rounded-md transition-colors group relative"
              title="Terminal Console (Ctrl+`)"
            >
               <span className="w-4 h-4 flex items-center justify-center font-mono font-bold text-xs pointer-events-none">&gt;_</span>
            </button> */}
            
            {/* CEO Console Button */}
            {user?.licenseTier === 'CEO' && (
              <button 
                onClick={onToggleSeoConsole}
                className="p-2 hover:bg-yellow-500/20 text-yellow-500 rounded-md transition-colors group relative border border-yellow-500/50 mr-1"
                title="CEO Console (SEO Manager)"
              >
                <div className="absolute inset-0 bg-yellow-400/20 blur-sm rounded-full animate-pulse opacity-0 group-hover:opacity-100" />
                <Crown className="w-4 h-4" />
              </button>
            )}
           {(user?.role === 'ADMIN' || user?.licenseTier === 'CEO') && (
             <Link href="/admin" className="p-2 hover:bg-red-500/10 rounded-md transition-colors group relative" title="Admin Panel">
                <Shield className="w-4 h-4 text-red-500" />
             </Link>
           )}
           <Link href="/bots" className="p-2 hover:bg-accent rounded-md transition-colors group relative" title="Bots">
              <Bot className="w-4 h-4 text-blue-400" />
           </Link>
           <Link href="/license" className="p-2 hover:bg-accent rounded-md transition-colors group relative" title="License">
              <Shield className="w-4 h-4 text-yellow-500" />
           </Link>
        </div>

        {user && (
           <div className="flex items-center gap-3 border-l border-border pl-4">
              <div className="hidden md:block">
                 {/* Color-coded tier badge */}
                 <div className={`text-[10px] font-black uppercase tracking-widest ${
                   user.licenseTier === 'CEO' ? 'text-yellow-400' :
                   user.licenseTier === 'ENTERPRISE' ? 'text-purple-400' :
                   user.licenseTier === 'DEVELOPER' ? 'text-orange-400' :
                   user.licenseTier === 'OPERATIVE' ? 'text-green-400' :
                   user.licenseTier === 'ANALYST' ? 'text-blue-400' :
                   'text-gray-400'
                 }`}>
                   {user.licenseTier}
                   {user.role === 'ADMIN' && ' • ADMIN'}
                 </div>
                 <div className="text-sm font-medium">{user.username}</div>
              </div>
              <button onClick={logout} className="p-2 hover:bg-red-500/10 text-gray-500 hover:text-red-500 rounded-md transition-colors">
                 <LogOut className="w-4 h-4" />
              </button>
           </div>
        )}
      </div>
    </div>
  );
}
