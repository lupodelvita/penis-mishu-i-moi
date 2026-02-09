'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ArrowLeft, Users, Database, Shield, Send, Plus, CheckCircle, XCircle, Trash2, Clock } from 'lucide-react';
import Link from 'next/link';

export default function AdminPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [genTier, setGenTier] = useState('OBSERVER');
  const [genDays, setGenDays] = useState(30);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [extendModal, setExtendModal] = useState<{isOpen: boolean, licenseKey: string | null, userId: string | null}>({isOpen: false, licenseKey: null, userId: null});
  const [extendDays, setExtendDays] = useState(30);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users')
      ]);
      setStats(statsRes.data.data);
      setUsers(usersRes.data.data);
    } catch (err) {
      console.error('Failed to fetch admin data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateKey = async () => {
    try {
      const res = await api.post('/admin/licenses', { tier: genTier, durationDays: genDays });
      if (res.data.success) {
        setNewKey(res.data.data.key);
        fetchAdminData();
      }
    } catch (err) {
      alert('Generation failed');
    }
  };

  const handleRevokeLicense = async (licenseKey: string) => {
    if (!confirm('Are you sure you want to PERMANENTLY DELETE this license? This action cannot be undone.')) return;
    
    try {
      await api.delete(`/admin/licenses/${licenseKey}`);
      alert('License deleted successfully');
      fetchAdminData();
    } catch (err) {
      alert('Failed to delete license');
    }
  };

  const handleExtendLicense = async () => {
    if (!extendModal.licenseKey || !extendDays) return;
    
    try {
      await api.patch(`/admin/licenses/${extendModal.licenseKey}/extend`, { additionalDays: extendDays });
      alert(`License extended by ${extendDays} days`);
      setExtendModal({isOpen: false, licenseKey: null, userId: null});
      setExtendDays(30);
      fetchAdminData();
    } catch (err) {
      alert('Failed to extend license');
    }
  };

  if (!user || (user.role !== 'ADMIN' && user.licenseTier !== 'CEO')) {
    return <div className="p-8 text-white">Доступ запрещен. Только для администраторов и CEO.</div>;
  }

  if (loading) return <div className="p-8 text-white">Loading Admin Panel...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto text-white space-y-10">
      <Link href="/" className="inline-flex items-center space-x-2 text-gray-400 hover:text-white transition group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>Вернуться на главную</span>
      </Link>

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent uppercase tracking-tighter">
            Control Center
          </h1>
          <p className="text-gray-400">NodeWeaver Administrative Dashboard</p>
        </div>
        <div className="text-right">
           <div className="text-xs font-bold text-gray-500">SYSTEM STATUS</div>
           <div className="flex items-center gap-2 text-green-500 font-bold">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              OPERATIONAL
           </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard icon={<Users className="text-blue-400"/>} label="Total Users" value={stats?.users || 0} />
        <StatCard icon={<Database className="text-purple-400"/>} label="Total Graphs" value={stats?.graphs || 0} />
        <StatCard icon={<Send className="text-green-400"/>} label="Active Bots" value={stats?.activeBots || 0} />
        <StatCard icon={<Shield className="text-yellow-400"/>} label="Issued Licenses" value={stats?.issuedLicenses || 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* License Generator */}
        <div className="lg:col-span-1 bg-gray-900/50 backdrop-blur-xl p-6 rounded-2xl border border-gray-800 shadow-2xl">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-500" /> Generate License
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-2">TIER</label>
              <select 
                value={genTier}
                onChange={(e) => setGenTier(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="OBSERVER">OBSERVER (Free)</option>
                <option value="ANALYST">ANALYST</option>
                <option value="OPERATIVE">OPERATIVE</option>
                <option value="DEVELOPER">DEVELOPER</option>
                <option value="ENTERPRISE">ENTERPRISE</option>
                <option value="CEO">CEO (God Mode)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-2">DURATION (DAYS)</label>
              <input 
                type="number" 
                value={genDays}
                onChange={(e) => setGenDays(parseInt(e.target.value))}
                className="w-full bg-gray-950 border border-gray-700 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button 
              onClick={handleGenerateKey}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg font-black hover:scale-[1.02] transition-transform shadow-lg shadow-blue-500/20"
            >
              CREATE NEW KEY
            </button>
            
            {newKey && (
              <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl relative group">
                <div className="text-[10px] font-bold text-green-500 mb-1">KEY GENERATED</div>
                <div className="font-mono text-sm break-all text-green-400">{newKey}</div>
                <button 
                  onClick={() => { navigator.clipboard.writeText(newKey); alert('Copied!'); }}
                  className="mt-2 text-[10px] underline text-gray-400 hover:text-white"
                >
                  COPY TO CLIPBOARD
                </button>
              </div>
            )}
          </div>
        </div>

        {/* User Management List */}
        <div className="lg:col-span-2 bg-gray-900/50 backdrop-blur-xl p-6 rounded-2xl border border-gray-800 shadow-2xl">
           <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-500" /> System Users
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-800 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                  <th className="pb-4">User</th>
                  <th className="pb-4">License</th>
                  <th className="pb-4 text-center">Status</th>
                  <th className="pb-4 text-right">Data</th>
                  <th className="pb-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {users.map((u: any) => (
                  <tr key={u.id} className="group hover:bg-white/5 transition-colors">
                    <td className="py-4">
                      <div className="font-bold flex items-center gap-2">
                        {u.username}
                        {u.role === 'ADMIN' && <span className="bg-red-500/20 text-red-500 text-[8px] px-1 rounded">ADMIN</span>}
                      </div>
                      <div className="text-[10px] text-gray-500">{u.id.substring(0,8)}...</div>
                    </td>
                    <td className="py-4">
                       <TierBadge tier={u.license?.tier || 'OBSERVER'} />
                       {u.license?.expiresAt && (
                         <div className="text-[9px] text-gray-500 mt-1">
                           Expires: {new Date(u.license.expiresAt).toLocaleDateString()}
                         </div>
                       )}
                    </td>
                    <td className="py-4 text-center">
                       {u.license?.isActive ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-gray-700 mx-auto" />}
                    </td>
                    <td className="py-4 text-right">
                       <div className="text-xs text-gray-400">
                          {u._count.graphs} Graphs <br/>
                          {u._count.bots} Bots
                       </div>
                    </td>
                    <td className="py-4 text-right">
                      {u.license && (
                        <div className="flex gap-1 justify-end">
                          <button 
                            onClick={() => setExtendModal({isOpen: true, licenseKey: u.license.key, userId: u.id})}
                            className="p-1.5 hover:bg-blue-500/10 text-blue-400 rounded transition"
                            title="Extend License"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleRevokeLicense(u.license.key)}
                            className="p-1.5 hover:bg-red-500/10 text-red-400 rounded transition"
                            title="Revoke License"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Extend License Modal */}
      {extendModal.isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-96 shadow-2xl">
            <h3 className="text-xl font-bold mb-4">Extend License</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-2">Additional Days</label>
                <input 
                  type="number"
                  value={extendDays}
                  onChange={(e) => setExtendDays(parseInt(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-700 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button 
                  onClick={() => setExtendModal({isOpen: false, licenseKey: null, userId: null})}
                  className="px-4 py-2 text-gray-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleExtendLicense}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition"
                >
                  Extend
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: any, label: string, value: any }) {
  return (
    <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800 flex items-center gap-4">
      <div className="p-3 bg-gray-950 rounded-xl">
        {icon}
      </div>
      <div>
        <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</div>
        <div className="text-2xl font-black">{value}</div>
      </div>
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
    const colors: any = {
        OBSERVER: 'text-gray-400 border-gray-400/30 bg-gray-400/5',
        ANALYST: 'text-blue-400 border-blue-400/30 bg-blue-400/5',
        OPERATIVE: 'text-green-400 border-green-400/30 bg-green-400/5',
        DEVELOPER: 'text-orange-400 border-orange-400/30 bg-orange-400/5',
        ENTERPRISE: 'text-purple-400 border-purple-400/30 bg-purple-400/5',
        CEO: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5',
    };
    return (
        <span className={`text-[10px] font-black px-2 py-1 rounded border ${colors[tier] || colors.OBSERVER}`}>
            {tier}
        </span>
    );
}
