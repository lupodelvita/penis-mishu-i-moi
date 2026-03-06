'use client';

import { useState, useRef, memo } from 'react';
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


export default memo(function Toolbar({ onToggleCollaboration, onToggleAI, onToggleSeoConsole, onToggleTerminal }: ToolbarProps) {
  const { currentGraph, exportGraph, importGraph } = useGraphStore();
  const { user, logout } = useAuth();
  const [graphName, setGraphName] = useState('Untitled Graph');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isLoadingBots, setIsLoadingBots] = useState(false);
  const [isSendingToBot, setIsSendingToBot] = useState(false);
  const [isTestingSend, setIsTestingSend] = useState(false);
  const [botExportStatus, setBotExportStatus] = useState('');
  const [exportBots, setExportBots] = useState<any[]>([]);
  const [selectedBotId, setSelectedBotId] = useState('');
  const [discordChannelId, setDiscordChannelId] = useState('');
  const [tgRecipientsCount, setTgRecipientsCount] = useState<number | null>(null);
  const [tgRecipientsStatus, setTgRecipientsStatus] = useState('');
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
    setTgRecipientsCount(null);
    setTgRecipientsStatus('');

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

        if (firstBot.type === 'TELEGRAM') {
          await loadTelegramRecipients();
        }
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

  const loadTelegramRecipients = async () => {
    try {
      setTgRecipientsStatus('Проверяем получателей Telegram...');
      const res = await api.get('/admin/observability/recipients/telegram');
      const recipients = Array.isArray(res.data?.data) ? res.data.data : [];
      setTgRecipientsCount(recipients.length);
      setTgRecipientsStatus(recipients.length
        ? `Получателей: ${recipients.length}`
        : 'Получателей нет. Добавьте пользователей со scope RECEIVE_TELEGRAM_ALERTS и chatId.');
    } catch (error: any) {
      console.error('Failed to load Telegram recipients', error);
      setTgRecipientsCount(0);
      setTgRecipientsStatus(error?.response?.data?.error || 'Не удалось получить список получателей');
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

      if (selectedBot.type === 'TELEGRAM') {
        if (tgRecipientsCount === null) {
          await loadTelegramRecipients();
        }
        if (!tgRecipientsCount) {
          setBotExportStatus('Нет получателей Telegram (scope RECEIVE_TELEGRAM_ALERTS). Добавьте chatId или выдайте доступ.');
          return;
        }
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

  const handleTestSend = async () => {
    try {
      if (!selectedBotId) {
        setBotExportStatus('Выбери бота для тестовой отправки.');
        return;
      }

      const selectedBot = exportBots.find((bot: any) => bot.id === selectedBotId);
      if (!selectedBot) {
        setBotExportStatus('Выбранный бот не найден. Обнови список.');
        return;
      }

      if (selectedBot.type !== 'TELEGRAM') {
        setBotExportStatus('Тестовая отправка доступна только для Telegram бота.');
        return;
      }

      if (tgRecipientsCount === null) {
        await loadTelegramRecipients();
      }
      if (!tgRecipientsCount) {
        setBotExportStatus('Нет получателей Telegram для теста.');
        return;
      }

      setIsTestingSend(true);
      setBotExportStatus('Тестовая отправка...');

      const payload: any = {
        botId: selectedBot.id,
        graph: {
          id: 'test',
          name: 'Test Alert',
          description: 'Проверка доставки алертов',
          created: new Date().toISOString(),
          entities: [],
          links: [],
        },
      };

      const response = await api.post('/discord/export-graph', payload);
      const message = response.data?.message || 'Тестовое сообщение отправлено';
      setBotExportStatus(`✅ ${message}`);
    } catch (error: any) {
      console.error('Failed to send test alert', error);
      setBotExportStatus(`❌ ${error?.response?.data?.error || 'Не удалось отправить тестовое сообщение'}`);
    } finally {
      setIsTestingSend(false);
    }
  };

  const handleExport = openExportModal;

  return (
    <>
    <div className="h-12 shrink-0 border-b border-border bg-card/90 backdrop-blur-sm flex items-center justify-between px-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Left — Logo + File ops + Tools */}
      <div className="flex items-center gap-2.5">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="w-6 h-6 flex items-center justify-center border border-sky-400/50 bg-sky-400/10"
            style={{ boxShadow: '0 0 10px rgba(56,189,248,0.12)' }}
          >
            <span className="font-mono font-bold text-[10px] text-sky-400 leading-none tracking-tight">NW</span>
          </div>
          <span className="text-sm font-medium tracking-wide text-slate-200 hidden sm:block">NodeWeaver</span>
        </div>

        <div className="w-px h-5 bg-border" />

        {/* File operations */}
        <div className="flex items-center gap-0.5">
          <button onClick={handleNew} title="Новый граф (Ctrl+N)"
            className="p-1.5 rounded-none border border-transparent hover:bg-accent/70 hover:border-border text-slate-500 hover:text-sky-400 transition-all duration-150 group relative">
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-0.5 text-[10px] bg-card border border-border text-slate-400 rounded-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">Новый</span>
          </button>
          <button onClick={handleOpen} title="Открыть (Ctrl+O)"
            className="p-1.5 rounded-none border border-transparent hover:bg-accent/70 hover:border-border text-slate-500 hover:text-sky-400 transition-all duration-150 group relative">
            <Upload className="w-3.5 h-3.5" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-0.5 text-[10px] bg-card border border-border text-slate-400 rounded-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">Открыть</span>
          </button>
          <button onClick={handleSave} title="Сохранить (Ctrl+S)"
            className="p-1.5 rounded-none border border-transparent hover:bg-accent/70 hover:border-border text-slate-500 hover:text-sky-400 transition-all duration-150 group relative">
            <Save className="w-3.5 h-3.5" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-0.5 text-[10px] bg-card border border-border text-slate-400 rounded-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">Сохранить</span>
          </button>
          <button onClick={handleExport} title="Экспорт"
            className="p-1.5 rounded-none border border-transparent hover:bg-accent/70 hover:border-border text-slate-500 hover:text-sky-400 transition-all duration-150 group relative">
            <Download className="w-3.5 h-3.5" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-0.5 text-[10px] bg-card border border-border text-slate-400 rounded-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">Экспорт</span>
          </button>
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Tools */}
        <div className="flex items-center gap-0.5">
          <button onClick={onToggleCollaboration} title="Коллаборация"
            className="p-1.5 rounded-none border border-transparent hover:bg-accent/70 hover:border-border text-slate-500 hover:text-sky-400 transition-all duration-150 group relative">
            <Users className="w-3.5 h-3.5" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-0.5 text-[10px] bg-card border border-border text-slate-400 rounded-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">Коллаборация</span>
          </button>
          <button onClick={onToggleAI} title="AI Ассистент"
            className="p-1.5 rounded-none border border-transparent hover:bg-accent/70 hover:border-border text-slate-500 hover:text-sky-400 transition-all duration-150 group relative">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-0.5 text-[10px] bg-card border border-border text-slate-400 rounded-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">AI Ассистент</span>
          </button>
        </div>
      </div>

      {/* Center — graph name with monospace brackets */}
      <div className="flex-1 flex justify-center items-center gap-1">
        <span className="font-mono text-xs text-slate-700 select-none">[</span>
        <input
          type="text"
          value={graphName}
          onChange={(e) => setGraphName(e.target.value)}
          className="bg-transparent border-none outline-none text-center text-sm font-mono text-slate-400 hover:text-slate-200 focus:text-sky-300 px-1 py-0.5 transition-colors max-w-xs"
        />
        <span className="font-mono text-xs text-slate-700 select-none">]</span>
      </div>

      {/* Right — Nav + User */}
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-0.5">
          {user?.licenseTier === 'CEO' && (
            <button onClick={onToggleSeoConsole} title="CEO Console"
              className="p-1.5 hover:bg-amber-500/10 text-amber-400 border border-amber-500/40 hover:border-amber-400/60 transition-all mr-1">
              <Crown className="w-3.5 h-3.5" />
            </button>
          )}
          {(user?.role === 'ADMIN' || user?.licenseTier === 'CEO') && (
            <Link href="/admin" title="Admin"
              className="p-1.5 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 text-slate-500 hover:text-red-400 transition-all">
              <Shield className="w-3.5 h-3.5" />
            </Link>
          )}
          <Link href="/bots" title="Bots"
            className="p-1.5 hover:bg-accent/70 border border-transparent hover:border-border text-slate-500 hover:text-sky-400 transition-all">
            <Bot className="w-3.5 h-3.5" />
          </Link>
          <Link href="/license" title="License"
            className="p-1.5 hover:bg-accent/70 border border-transparent hover:border-border text-slate-500 hover:text-amber-400 transition-all">
            <Shield className="w-3.5 h-3.5" />
          </Link>
        </div>

        {user && (
          <div className="flex items-center gap-2 border-l border-border pl-3 ml-1">
            <div className="hidden md:flex flex-col items-end">
              <span className={`text-[9px] font-bold uppercase tracking-widest font-mono ${
                user.licenseTier === 'CEO'        ? 'text-amber-400'   :
                user.licenseTier === 'ENTERPRISE' ? 'text-violet-400'  :
                user.licenseTier === 'DEVELOPER'  ? 'text-orange-400'  :
                user.licenseTier === 'OPERATIVE'  ? 'text-emerald-400' :
                user.licenseTier === 'ANALYST'    ? 'text-sky-400'     :
                                                    'text-slate-600'
              }`}>
                {user.licenseTier}{user.role === 'ADMIN' && ' · ADMIN'}
              </span>
              <div className="flex items-center gap-1.5 mt-px">
                <span className="text-xs font-medium text-slate-300">{user.username}</span>
                {user.accountCode && (
                  <span className="px-1.5 py-px border border-sky-500/40 text-[9px] text-sky-400 bg-sky-500/10 font-mono">
                    {user.accountCode}
                  </span>
                )}
              </div>
            </div>
            <button onClick={logout}
              className="p-1.5 hover:bg-red-500/10 text-slate-600 hover:text-red-400 border border-transparent hover:border-red-500/30 transition-all">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>

    {isExportModalOpen && (
      <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-md border border-border bg-card shadow-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-xs font-semibold text-slate-300 font-mono uppercase tracking-widest">Export Graph</h3>
            <button onClick={() => setIsExportModalOpen(false)} className="text-slate-600 hover:text-slate-300 transition text-sm">✕</button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleSave}
              className="px-3 py-2 bg-sky-500/10 border border-sky-500/30 text-sky-300 hover:bg-sky-500/20 hover:border-sky-400/50 transition text-xs font-medium">
              JSON
            </button>
            <button onClick={handleDownloadReport}
              className="px-3 py-2 bg-pink-500/10 border border-pink-500/30 text-pink-300 hover:bg-pink-500/20 hover:border-pink-400/50 transition text-xs font-medium">
              PDF Report
            </button>
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <div className="text-[10px] font-semibold text-slate-500 font-mono uppercase tracking-widest">Send to Bot</div>

            <button onClick={openExportModal} disabled={isLoadingBots}
              className="w-full px-3 py-2 border border-border text-slate-500 hover:bg-accent hover:text-slate-300 text-xs transition disabled:opacity-60">
              {isLoadingBots ? 'Loading...' : 'Refresh bots'}
            </button>

            <select value={selectedBotId}
              onChange={async (e) => {
                const nextId = e.target.value;
                setSelectedBotId(nextId);
                const bot = exportBots.find((item: any) => item.id === nextId);
                setDiscordChannelId(bot?.settings?.channelId || '');
                if (bot?.type === 'TELEGRAM') await loadTelegramRecipients();
              }}
              className="w-full bg-background border border-border px-3 py-2 text-xs text-slate-300">
              {!exportBots.length && <option value="">No active bots</option>}
              {exportBots.map((bot: any) => (
                <option key={bot.id} value={bot.id}>{bot.name} [{bot.type}]</option>
              ))}
            </select>

            {exportBots.some((b: any) => b.type === 'TELEGRAM') ? (
              <div className="text-xs text-amber-300 bg-amber-500/8 border border-amber-500/25 px-3 py-2">
                Для Telegram: активный бот + получатели со scope RECEIVE_TELEGRAM_ALERTS.
              </div>
            ) : (
              <div className="text-xs text-red-300 bg-red-500/8 border border-red-500/25 px-3 py-2">
                Нет активных Telegram-ботов.
              </div>
            )}

            {tgRecipientsStatus && (
              <div className="text-xs border border-border bg-background px-3 py-2 text-slate-500 font-mono whitespace-pre-wrap">
                {tgRecipientsStatus}
              </div>
            )}

            {(() => {
              const bot = exportBots.find((item: any) => item.id === selectedBotId);
              if (bot?.type !== 'DISCORD') return null;
              return (
                <input value={discordChannelId} onChange={(e) => setDiscordChannelId(e.target.value)}
                  placeholder="Discord Channel ID"
                  className="w-full bg-background border border-border px-3 py-2 text-xs text-slate-300" />
              );
            })()}

            {exportBots.find((bot: any) => bot.id === selectedBotId)?.type === 'TELEGRAM' && (
              <button onClick={handleTestSend} disabled={isTestingSend || isSendingToBot}
                className="w-full px-3 py-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 transition text-xs font-medium disabled:opacity-60">
                {isTestingSend ? 'Testing...' : 'Test send'}
              </button>
            )}

            <button onClick={handleExportToBot} disabled={isSendingToBot || !exportBots.length}
              className="w-full px-3 py-2 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 transition text-xs font-semibold disabled:opacity-60">
              {isSendingToBot ? 'Sending...' : 'Send to bot →'}
            </button>

            {!!botExportStatus && (
              <div className="text-xs border border-border bg-background px-3 py-2 text-slate-500 font-mono whitespace-pre-wrap">
                {botExportStatus}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
});
