'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Bot, Plus, Trash, MessageSquare, Send, ArrowLeft, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function BotsPage() {
  const { user } = useAuth();
  const getDefaultBotState = () => ({
    name: '',
    token: '',
    type: 'DISCORD' as 'DISCORD' | 'TELEGRAM',
    autoStart: true,
    settings: { channelId: '', chatId: '', localServer: '', proxy: '' }
  });
  const [bots, setBots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newBot, setNewBot] = useState(getDefaultBotState);
  const [submitting, setSubmitting] = useState(false);
  const [botToDelete, setBotToDelete] = useState<{ id: string; name: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [pendingBots, setPendingBots] = useState<Map<string, 'starting' | 'stopping'>>(new Map());

  const setPending = (id: string, state: 'starting' | 'stopping' | null) =>
    setPendingBots(prev => { const m = new Map(prev); state ? m.set(id, state) : m.delete(id); return m; });

  const showToast = (message: string, type: 'error' | 'success' = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const resetForm = () => {
    setNewBot(getDefaultBotState());
    setSubmitting(false);
  };

  useEffect(() => {
    fetchBots();
  }, []);

  const fetchBots = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bots');
      if (res.data.success) {
        setBots(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch bots', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await api.post('/bots', newBot);
      const created = res.data?.data ?? res.data;
      setBots(prev => (created ? [...prev, created] : prev));
      setShowAdd(false);
      resetForm();
      fetchBots();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Не удалось добавить бота');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleBot = async (id: string, updates: any) => {
    if (pendingBots.has(id)) return;
    const starting = updates.isActive === true;
    const stopping = updates.isActive === false;
    if (starting) setPending(id, 'starting');
    if (stopping) setPending(id, 'stopping');
    try {
      const res = await api.patch(`/bots/${id}/toggle`, updates);
      if (res.data.success) {
        setBots(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
        if (stopping) {
          setTimeout(() => {
            setPending(id, null);
            showToast('Бот остановлен', 'success');
          }, 2000);
        }
        if (starting) {
          setTimeout(async () => {
            try {
              const refreshed = await api.get('/bots');
              if (refreshed.data.success) {
                const updated = refreshed.data.data as any[];
                setBots(updated);
                const bot = updated.find(b => b.id === id);
                if (bot?.status === 'ONLINE' || bot?.isActive) {
                  showToast('Бот успешно запущен', 'success');
                } else {
                  showToast('Не удалось запустить бота. Проверьте токен.', 'error');
                }
              }
            } catch (_) {}
            setPending(id, null);
          }, 7000);
        }
      }
    } catch (err) {
      setPending(id, null);
      showToast('Не удалось обновить статус бота');
    }
  };

  const deleteBot = async (id: string) => {
    try {
      await api.delete(`/bots/${id}`);
      setBots(bots.filter(b => b.id !== id));
    } catch (err) {
      showToast('Не удалось удалить бота');
    }
  };

  const confirmDelete = async () => {
    if (!botToDelete) return;
    await deleteBot(botToDelete.id);
    setBotToDelete(null);
  };

  if (!user) return <div className="p-8 text-white">Пожалуйста, войдите в систему.</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 text-white">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[100] flex items-start space-x-3 px-5 py-4 rounded-xl shadow-2xl border backdrop-blur-sm animate-in slide-in-from-top-2 fade-in transition-all max-w-sm ${
          toast.type === 'error'
            ? 'bg-red-950/90 border-red-500/40 text-red-200'
            : 'bg-green-950/90 border-green-500/40 text-green-200'
        }`}>
          {toast.type === 'error'
            ? <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            : <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />}
          <div className="flex-1">
            <div className="text-sm font-medium leading-snug">{toast.message}</div>
          </div>
          <button onClick={() => setToast(null)} className="text-gray-500 hover:text-white transition shrink-0">✕</button>
        </div>
      )}
      <Link href="/" className="inline-flex items-center space-x-2 text-gray-400 hover:text-white transition group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>Вернуться на главную</span>
      </Link>

      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-3">
             <Bot className="w-8 h-8 text-blue-500" />
             <span>Менеджер Ботов</span>
          </h1>
          <p className="text-gray-400">Управляйте вашими интеграциями с Discord и Telegram.</p>
        </div>
        {!loading && bots.length > 0 && (
          <button 
            onClick={() => { resetForm(); setShowAdd(true); }}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить Бота</span>
          </button>
        )}
      </header>

      {/* Add Bot Modal */}
      {showAdd && (
          <div className="bg-gray-900 p-6 rounded-xl border border-blue-500/30 shadow-2xl space-y-4 animate-in fade-in slide-in-from-top-4">
             <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Новый Бот</h2>
                <div className="flex bg-gray-950 p-1 rounded-lg border border-gray-800">
                   <button 
                      onClick={() => setNewBot({...newBot, type: 'DISCORD'})}
                      className={`px-4 py-1.5 rounded-md text-sm transition ${newBot.type === 'DISCORD' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                   >
                      Discord
                   </button>
                   <button 
                      onClick={() => setNewBot({...newBot, type: 'TELEGRAM'})}
                      className={`px-4 py-1.5 rounded-md text-sm transition ${newBot.type === 'TELEGRAM' ? 'bg-blue-500 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                   >
                      Telegram
                   </button>
                </div>
             </div>

             <form onSubmit={handleAddBot} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-xs text-gray-500 uppercase font-bold">Название</label>
                      <input 
                        placeholder="Напр. OSINT Crawler"
                        value={newBot.name}
                        onChange={(e) => setNewBot({...newBot, name: e.target.value})}
                        className="w-full bg-gray-950 border border-gray-800 p-3 rounded outline-none focus:border-blue-500"
                        required
                      />
                   </div>
                   <div className="space-y-1">
                      <label className="text-xs text-gray-500 uppercase font-bold">Токен</label>
                      <input 
                        placeholder="Bot Token"
                        type="password"
                        value={newBot.token}
                        onChange={(e) => setNewBot({...newBot, token: e.target.value})}
                        className="w-full bg-gray-950 border border-gray-800 p-3 rounded outline-none focus:border-blue-500"
                        required
                      />
                   </div>
                </div>

                {newBot.type === 'DISCORD' && (
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500 uppercase font-bold">ID Канала (для отчетов)</label>
                    <input 
                      placeholder="Channel ID"
                      value={newBot.settings.channelId}
                      onChange={(e) => setNewBot({...newBot, settings: { ...newBot.settings, channelId: e.target.value }})}
                      className="w-full bg-gray-950 border border-gray-800 p-3 rounded outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                {newBot.type === 'TELEGRAM' && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500 uppercase font-bold">Chat ID (для отчетов — необяз.)</label>
                      <input 
                        placeholder="Chat ID"
                        value={newBot.settings.chatId}
                        onChange={(e) => setNewBot({...newBot, settings: { ...newBot.settings, chatId: e.target.value }})}
                        className="w-full bg-gray-950 border border-gray-800 p-3 rounded outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500 uppercase font-bold">Local Bot API Server (необяз.)</label>
                      <input 
                        placeholder="http://localhost:8081"
                        value={newBot.settings.localServer}
                        onChange={(e) => setNewBot({...newBot, settings: { ...newBot.settings, localServer: e.target.value }})}
                        className="w-full bg-gray-950 border border-gray-800 p-3 rounded outline-none focus:border-blue-500"
                      />
                      <div className="text-[11px] text-gray-600">Только если Telegram заблокирован провайдером. Требует запущенного docker-контейнера telegram-bot-api с вашими API_ID/HASH.</div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500 uppercase font-bold">Proxy (необяз.)</label>
                      <input 
                        placeholder="socks5://user:pass@host:port  или  http://host:port"
                        value={newBot.settings.proxy}
                        onChange={(e) => setNewBot({...newBot, settings: { ...newBot.settings, proxy: e.target.value }})}
                        className="w-full bg-gray-950 border border-gray-800 p-3 rounded outline-none focus:border-blue-500"
                      />
                      <div className="text-[11px] text-gray-600">Используется только если не задан Local Server. Поддерживаются HTTP/HTTPS и SOCKS5.</div>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                   <input 
                     type="checkbox" 
                     id="autostart"
                     checked={newBot.autoStart}
                     onChange={(e) => setNewBot({...newBot, autoStart: e.target.checked})}
                   />
                   <label htmlFor="autostart" className="text-sm text-gray-400">Автозапуск при старте сервера</label>
                </div>
                <div className="flex space-x-2 pt-2">
                   <button 
                     type="submit" 
                     disabled={submitting}
                     className={`flex-1 bg-blue-600 py-2.5 rounded-lg transition font-bold ${submitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-500'}`}
                   >
                     {submitting ? 'Сохранение...' : 'Сохранить'}
                   </button>
                   <button 
                     type="button" 
                     onClick={() => { resetForm(); setShowAdd(false); }}
                     className="flex-1 bg-gray-800 py-2.5 rounded-lg hover:bg-gray-700 transition"
                   >
                     Отмена
                   </button>
                </div>
             </form>
          </div>
      )}

      {loading ? (
          <div className="text-center py-20 text-gray-500 animate-pulse">Загрузка ботов...</div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {bots.map(bot => (
               <div key={bot.id} className="bg-gray-900 border border-gray-800 p-6 rounded-xl relative group hover:border-blue-500/50 transition shadow-lg">
                  <div className="flex justify-between items-start mb-4">
                     <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${bot.isActive ? 'bg-green-500/10 text-green-500' : 'bg-gray-800 text-gray-500'}`}>
                           {bot.type === 'DISCORD' ? <MessageSquare className="w-5 h-5" /> : <Send className="w-5 h-5" />}
                        </div>
                        <div>
                           <h3 className="font-bold text-lg leading-none">{bot.name}</h3>
                           <span className="text-[10px] text-gray-600 uppercase font-black tracking-widest">{bot.type}</span>
                        </div>
                     </div>
                    <button onClick={() => setBotToDelete({ id: bot.id, name: bot.name })} className="text-gray-600 hover:text-red-500 transition">
                        <Trash className="w-4 h-4" />
                     </button>
                  </div>

                  <div className="space-y-3">
                     <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Статус</span>
                        <span className={`font-bold flex items-center space-x-1 ${
                          pendingBots.get(bot.id) === 'starting' ? 'text-yellow-400'
                          : pendingBots.get(bot.id) === 'stopping' ? 'text-orange-400'
                          : bot.isActive ? 'text-green-400' : 'text-gray-600'
                        }`}>
                          {pendingBots.has(bot.id) && <Loader2 className="w-3 h-3 animate-spin" />}
                          <span>{
                            pendingBots.get(bot.id) === 'starting' ? 'Подключение...'
                            : pendingBots.get(bot.id) === 'stopping' ? 'Остановка...'
                            : bot.isActive ? 'Онлайн' : 'Оффлайн'
                          }</span>
                        </span>
                     </div>
                     <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Автозапуск</span>
                        <span className={bot.autoStart ? 'text-blue-400' : 'text-gray-600'}>
                           {bot.autoStart ? 'Вкл' : 'Выкл'}
                        </span>
                     </div>
                  </div>

                  <div className="mt-6 flex space-x-2">
                     <button 
                        onClick={() => !pendingBots.has(bot.id) && toggleBot(bot.id, { isActive: !bot.isActive })}
                        disabled={pendingBots.has(bot.id)}
                        className={`flex-1 py-1.5 rounded text-sm font-medium transition flex items-center justify-center space-x-1.5 ${
                          pendingBots.has(bot.id)
                            ? 'bg-gray-800 text-gray-500 cursor-wait'
                            : bot.isActive
                              ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                              : 'bg-green-600 hover:bg-green-500'
                        }`}
                     >
                        {pendingBots.has(bot.id) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>{
                          pendingBots.get(bot.id) === 'starting' ? 'Запустить'
                          : pendingBots.get(bot.id) === 'stopping' ? 'Остановить'
                          : bot.isActive ? 'Остановить' : 'Запустить'
                        }</span>
                     </button>
                     <button 
                        onClick={() => toggleBot(bot.id, { autoStart: !bot.autoStart })}
                        className={`flex-1 py-1.5 rounded text-sm font-medium transition ${bot.autoStart ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                     >
                        Авто
                     </button>
                  </div>
               </div>
            ))}
            
            {bots.length === 0 && !showAdd && (
                <div 
                  onClick={() => { resetForm(); setShowAdd(true); }}
                  className="col-span-full rounded-2xl border border-blue-500/20 bg-gradient-to-r from-gray-900 via-gray-950 to-slate-900 p-12 text-center cursor-pointer transition hover:border-blue-500/50 hover:shadow-[0_20px_80px_-40px_rgba(59,130,246,0.6)]"
                >
                  <div className="text-sm uppercase tracking-[0.35em] text-gray-500 mb-4">Bots</div>
                  <div className="text-3xl font-bold text-white mb-3">Добавьте своего первого бота</div>
                  <p className="text-gray-400 max-w-2xl mx-auto">Подключите Discord или Telegram, чтобы получать отчеты и уведомления прямо в ваших чатах.</p>
                </div>
            )}
          </div>
      )}

      {botToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-sm text-gray-500 uppercase font-semibold">Удаление бота</div>
                <div className="text-xl font-bold text-white">{botToDelete.name}</div>
              </div>
              <button
                onClick={() => setBotToDelete(null)}
                className="text-gray-500 hover:text-white transition"
              >
                ✕
              </button>
            </div>
            <p className="text-gray-400 mb-6">Вы уверены, что хотите удалить этого бота? Его соединение будет отключено.</p>
            <div className="flex space-x-3">
              <button
                onClick={confirmDelete}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold py-2.5 rounded-lg transition"
              >
                Удалить
              </button>
              <button
                onClick={() => setBotToDelete(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold py-2.5 rounded-lg transition"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
