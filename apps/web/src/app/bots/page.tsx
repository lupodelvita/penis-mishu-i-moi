'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Bot, Plus, Trash, MessageSquare, Send, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function BotsPage() {
  const { user } = useAuth();
  const [bots, setBots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newBot, setNewBot] = useState({ 
    name: '', 
    token: '', 
    type: 'DISCORD',
    autoStart: true,
    settings: { channelId: '', chatId: '' }
  });

  useEffect(() => {
    fetchBots();
  }, []);

  const fetchBots = async () => {
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
    try {
      const res = await api.post('/bots', newBot);
      if (res.data.success) {
        setBots([...bots, res.data.data]);
        setShowAdd(false);
        setNewBot({ 
          name: '', 
          token: '', 
          type: 'DISCORD',
          autoStart: true,
          settings: { channelId: '', chatId: '' }
        });
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Не удалось добавить бота');
    }
  };

  const toggleBot = async (id: string, updates: any) => {
    try {
      const res = await api.patch(`/bots/${id}/toggle`, updates);
      if (res.data.success) {
        setBots(bots.map(b => b.id === id ? { ...b, ...updates } : b));
      }
    } catch (err) {
      alert('Не удалось обновить статус бота');
    }
  };

  const deleteBot = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этого бота?')) return;
    try {
      await api.delete(`/bots/${id}`);
      setBots(bots.filter(b => b.id !== id));
    } catch (err) {
      alert('Не удалось удалить бота');
    }
  };

  if (!user) return <div className="p-8 text-white">Пожалуйста, войдите в систему.</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 text-white">
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
        <button 
          onClick={() => setShowAdd(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          <span>Добавить Бота</span>
        </button>
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
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500 uppercase font-bold">Chat ID (для отчетов - необяз.)</label>
                    <input 
                      placeholder="Chat ID"
                      value={newBot.settings.chatId}
                      onChange={(e) => setNewBot({...newBot, settings: { ...newBot.settings, chatId: e.target.value }})}
                      className="w-full bg-gray-950 border border-gray-800 p-3 rounded outline-none focus:border-blue-500"
                    />
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
                   <button type="submit" className="flex-1 bg-blue-600 py-2.5 rounded-lg hover:bg-blue-500 transition font-bold">Сохранить</button>
                   <button type="button" onClick={() => setShowAdd(false)} className="flex-1 bg-gray-800 py-2.5 rounded-lg hover:bg-gray-700 transition">Отмена</button>
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
                     <button onClick={() => deleteBot(bot.id)} className="text-gray-600 hover:text-red-500 transition">
                        <Trash className="w-4 h-4" />
                     </button>
                  </div>

                  <div className="space-y-3">
                     <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Статус</span>
                        <span className={bot.isActive ? 'text-green-400 font-bold' : 'text-gray-600'}>
                           {bot.isActive ? 'Онлайн' : 'Оффлайн'}
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
                        onClick={() => toggleBot(bot.id, { isActive: !bot.isActive })}
                        className={`flex-1 py-1.5 rounded text-sm font-medium transition ${bot.isActive ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-green-600 hover:bg-green-500'}`}
                     >
                        {bot.isActive ? 'Остановить' : 'Запустить'}
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
                   onClick={() => setShowAdd(true)}
                   className="border-2 border-dashed border-gray-800 rounded-xl flex flex-col items-center justify-center p-12 text-gray-500 hover:text-white hover:border-gray-600 cursor-pointer transition col-span-full"
                >
                   <Plus className="w-12 h-12 mb-2" />
                   <span>Добавьте своего первого бота</span>
                </div>
            )}
          </div>
      )}
    </div>
  );
}
