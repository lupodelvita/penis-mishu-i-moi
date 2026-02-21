'use client';

import { useState, useRef } from 'react';
import { Save, FolderOpen, Upload, Download, Users, Sparkles, Bot, Shield, LogOut, Crown } from 'lucide-react';
import { useGraphStore } from '@/store';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import Link from 'next/link';

interface ToolbarProps {
  onToggleCollaboration?: () => void;
  onToggleAI?: () => void;
  onToggleSeoConsole?: () => void;
  onToggleTerminal?: () => void;
}


export default function Toolbar({ onToggleCollaboration, onToggleAI, onToggleSeoConsole, onToggleTerminal }: ToolbarProps) {
  const { currentGraph, exportGraph, importGraph } = useGraphStore();
  const { user, logout } = useAuth();
  const [graphName, setGraphName] = useState('Untitled Graph');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isLoadingBots, setIsLoadingBots] = useState(false);
  const [isSendingToBot, setIsSendingToBot] = useState(false);
  const [botExportStatus, setBotExportStatus] = useState('');
  const [exportBots, setExportBots] = useState<any[]>([]);
  const [selectedBotId, setSelectedBotId] = useState('');
  const [discordChannelId, setDiscordChannelId] = useState('');
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

  const buildGraphExportPayload = () => {
    const parsed = JSON.parse(exportGraph() || '{}');
    const graph = currentGraph || parsed;

    return {
      id: graph?.id || 'local-graph',
      name: graphName || graph?.name || 'Untitled Graph',
      description: graph?.description || 'OSINT Investigation Results',
      created: graph?.metadata?.created || new Date().toISOString(),
      entities: graph?.entities || [],
      links: graph?.links || [],
    };
  };

  const openExportModal = async () => {
    setIsExportModalOpen(true);
    setIsLoadingBots(true);
    setBotExportStatus('Загрузка активных ботов...');

    try {
      const botsRes = await api.get('/bots');
      const bots = Array.isArray(botsRes.data?.data) ? botsRes.data.data : [];
      const activeBots = bots.filter((bot: any) => bot?.isActive);

      setExportBots(activeBots);

      if (activeBots.length) {
        const firstBot = activeBots[0];
        setSelectedBotId(firstBot.id);
        setDiscordChannelId(firstBot.settings?.channelId || '');
        setBotExportStatus(`Найдено активных ботов: ${activeBots.length}`);
      } else {
        setSelectedBotId('');
        setDiscordChannelId('');
        setBotExportStatus('Нет активных ботов. Добавь и запусти бота в разделе Bots.');
      }
    } catch (error: any) {
      console.error('Failed to fetch bots for export:', error);
      setExportBots([]);
      setSelectedBotId('');
      setDiscordChannelId('');
      setBotExportStatus(error?.response?.data?.error || 'Не удалось загрузить список ботов');
    } finally {
      setIsLoadingBots(false);
    }
  };

  const handleExportToBot = async () => {
    try {
      if (!currentGraph) {
        setBotExportStatus('Нет активного графа для экспорта.');
        return;
      }

      if (!selectedBotId) {
        setBotExportStatus('Выбери бота для отправки.');
        return;
      }

      const selectedBot = exportBots.find((bot: any) => bot.id === selectedBotId);
      if (!selectedBot) {
        setBotExportStatus('Выбранный бот не найден. Обнови список.');
        return;
      }

      setIsSendingToBot(true);
      setBotExportStatus(`Отправка графа в ${selectedBot.name}...`);

      const payload: any = {
        botId: selectedBot.id,
        graph: buildGraphExportPayload(),
      };

      if (selectedBot.type === 'DISCORD') {
        const resolvedChannel = discordChannelId.trim() || selectedBot.settings?.channelId || '';
        if (!resolvedChannel.trim()) {
          setBotExportStatus('Для Discord нужен Channel ID. Укажи его ниже.');
          return;
        }

        payload.channelId = resolvedChannel.trim();
      }

      const response = await api.post('/discord/export-graph', payload);
      const message = response.data?.message || 'Граф успешно отправлен в бота';
      setBotExportStatus(`✅ ${message}`);
    } catch (error: any) {
      console.error('Failed to export graph to bot:', error);
      setBotExportStatus(`❌ ${error?.response?.data?.error || 'Не удалось отправить граф в бота'}`);
    } finally {
      setIsSendingToBot(false);
    }
  };

  const handleExport = openExportModal;

  return (
    <>
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

    {isExportModalOpen && (
      <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Export Graph</h3>
            <button
              onClick={() => setIsExportModalOpen(false)}
              className="text-slate-400 hover:text-white transition"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleSave}
              className="px-3 py-2 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 transition"
            >
              JSON
            </button>
            <button
              onClick={handleDownloadReport}
              className="px-3 py-2 rounded-lg bg-pink-500/20 border border-pink-500/30 text-pink-300 hover:bg-pink-500/30 transition"
            >
              PDF
            </button>
          </div>

          <div className="border-t border-slate-800 pt-4 space-y-3">
            <div className="text-sm font-semibold text-slate-200">Send to Bot (Discord/Telegram)</div>

            <button
              onClick={openExportModal}
              disabled={isLoadingBots}
              className="w-full px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition disabled:opacity-60"
            >
              {isLoadingBots ? 'Loading bots...' : 'Refresh bots'}
            </button>

            <select
              value={selectedBotId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedBotId(nextId);
                const bot = exportBots.find((item: any) => item.id === nextId);
                setDiscordChannelId(bot?.settings?.channelId || '');
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            >
              {!exportBots.length && <option value="">No active bots</option>}
              {exportBots.map((bot: any) => (
                <option key={bot.id} value={bot.id}>
                  {bot.name} [{bot.type}]
                </option>
              ))}
            </select>

            {(() => {
              const bot = exportBots.find((item: any) => item.id === selectedBotId);
              if (bot?.type !== 'DISCORD') return null;

              return (
                <input
                  value={discordChannelId}
                  onChange={(e) => setDiscordChannelId(e.target.value)}
                  placeholder="Discord Channel ID"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                />
              );
            })()}

            <button
              onClick={handleExportToBot}
              disabled={isSendingToBot || !exportBots.length}
              className="w-full px-3 py-2 rounded-lg bg-green-600 hover:bg-green-500 transition font-semibold disabled:opacity-60"
            >
              {isSendingToBot ? 'Sending...' : 'Send graph to bot'}
            </button>

            {!!botExportStatus && (
              <div className="text-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-300 whitespace-pre-wrap">
                {botExportStatus}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
