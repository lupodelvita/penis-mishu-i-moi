'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ArrowLeft, Plus, Users, Crown } from 'lucide-react';
import Link from 'next/link';

export default function TeamsPage() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: '', description: '', avatar: '' });

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const res = await api.get('/teams');
      setTeams(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch teams', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async () => {
    try {
      await api.post('/teams', newTeam);
      setShowCreateModal(false);
      setNewTeam({ name: '', description: '', avatar: '' });
      fetchTeams();
    } catch (err) {
      alert('Failed to create team');
    }
  };

  if (loading) return <div className="p-8 text-white">Loading Teams...</div>;

  return (
    <div className="min-h-screen bg-black text-white p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/">
            <button className="p-2 hover:bg-slate-800 rounded-lg transition">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Команды</h1>
            <p className="text-slate-400 text-sm">Управление командами для совместной работы</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          Создать команду
        </button>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team) => (
          <div
            key={team.id}
            className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 hover:border-purple-500/50 transition"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {team.avatar ? (
                  <div className="text-3xl">{team.avatar}</div>
                ) : (
                  <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-purple-400" />
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-lg">{team.name}</h3>
                  {team.ownerId === user?.id && (
                    <span className="text-xs text-yellow-500 flex items-center gap-1">
                      <Crown className="w-3 h-3" /> Owner
                    </span>
                  )}
                </div>
              </div>
            </div>

            {team.description && (
              <p className="text-sm text-slate-400 mb-4">{team.description}</p>
            )}

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <Users className="w-4 h-4" />
                <span>{team._count?.members || 0} участников</span>
              </div>
              <Link href={`/teams/${team.id}`}>
                <button className="text-purple-400 hover:text-purple-300 transition">
                  Открыть →
                </button>
              </Link>
            </div>
          </div>
        ))}

        {teams.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500">
            <Users className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p>У вас пока нет команд</p>
            <p className="text-sm">Создайте команду для совместной работы</p>
          </div>
        )}
      </div>

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-[480px] shadow-2xl">
            <h3 className="text-xl font-bold mb-4">Создать команду</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-2">Название команды</label>
                <input
                  type="text"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-3 outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Моя команда"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-2">Описание (опционально)</label>
                <textarea
                  value={newTeam.description}
                  onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-3 outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  rows={3}
                  placeholder="О чем ваша команда..."
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-2">Эмоджи (опционально)</label>
                <input
                  type="text"
                  value={newTeam.avatar}
                  onChange={(e) => setNewTeam({ ...newTeam, avatar: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-3 outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="🚀"
                  maxLength={2}
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white transition"
                >
                  Отмена
                </button>
                <button
                  onClick={handleCreateTeam}
                  disabled={!newTeam.name.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Создать
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
