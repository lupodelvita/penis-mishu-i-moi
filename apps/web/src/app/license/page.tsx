'use client';

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const TIER_FEATURES = {
  OBSERVER: { name: 'Observer', color: 'text-gray-400', limits: '1 Graph, 50 Entities, No Export' },
  ANALYST: { name: 'Analyst', color: 'text-blue-400', limits: '3 Graphs, 150 Entities, PDF Export' },
  OPERATIVE: { name: 'Operative', color: 'text-green-400', limits: '10 Graphs, 500 Entities, Extended Reports' },
  DEVELOPER: { name: 'Developer', color: 'text-orange-400', limits: 'Unlimited Graphs, API Access' },
  ENTERPRISE: { name: 'Enterprise', color: 'text-purple-400', limits: 'Full Access, Priority Support' },
  CEO: { name: 'CEO', color: 'text-yellow-400', limits: 'God Mode, Full Management' },
};

export default function LicensePage() {
  const { user } = useAuth();
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await api.post('/auth/activate-license', { licenseKey });
      if (res.data.success) {
        setMessage({ type: 'success', text: 'License activated successfully! Please refresh or re-login.' });
        setLicenseKey('');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Activation failed' });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <div className="p-8 text-white">Please login to view your license.</div>;

  const currentTier = (TIER_FEATURES as any)[user.licenseTier] || TIER_FEATURES.OBSERVER;

  return (
    <div className="p-8 max-w-4xl mx-auto text-white space-y-8">
      <Link href="/" className="inline-flex items-center space-x-2 text-gray-400 hover:text-white transition group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>Вернуться на главную</span>
      </Link>
      
      <header>
        <h1 className="text-3xl font-bold">License Management</h1>
        <p className="text-gray-400">Manage your subscription and unlock advanced features.</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Current Status */}
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-gray-300">Current Plan</h2>
          <div className="flex items-center space-x-4">
             <div className={`text-4xl font-black ${currentTier.color}`}>
                {user.licenseTier}
             </div>
          </div>
          <p className="mt-4 text-sm text-gray-400">
             <strong>Limits:</strong> {currentTier.limits}
          </p>
        </div>

        {/* Activation Form */}
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-gray-300">Activate New Key</h2>
          <form onSubmit={handleActivate} className="space-y-4">
            <input 
              type="text" 
              placeholder="NW-XXXX-XXXX-XXXX"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
              className="w-full p-3 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              required
            />
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition disabled:opacity-50"
            >
              {loading ? 'Activating...' : 'Activate License'}
            </button>
          </form>
          {message.text && (
            <p className={`mt-4 text-sm ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
              {message.text}
            </p>
          )}
        </div>
      </section>

      {/* Tiers Comparison */}
      <section className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-lg overflow-x-auto">
        <h2 className="text-xl font-semibold mb-6 text-gray-300 text-center">Plan Comparison</h2>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-sm uppercase">
              <th className="pb-4 pr-4">Tier</th>
              <th className="pb-4">Features & Limits</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {Object.entries(TIER_FEATURES).map(([key, info]) => (
              <tr key={key} className={key === user.licenseTier ? 'bg-blue-900/10' : ''}>
                <td className={`py-4 pr-4 font-bold ${info.color}`}>{info.name}</td>
                <td className="py-4 text-gray-400 text-sm">{info.limits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
