'use client';

import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';
import Link from 'next/link';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await api.post('/auth/register', { username, password, licenseKey });
      if (res.data.success) {
          login(res.data.token);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background nw-grid-bg flex items-center justify-center relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-sky-500/4 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent mb-10" />

        <div className="border border-border bg-card/80 backdrop-blur-sm p-8">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div
              className="w-8 h-8 flex items-center justify-center border border-sky-400/50 bg-sky-400/10"
              style={{ boxShadow: '0 0 14px rgba(56,189,248,0.12)' }}
            >
              <span className="font-mono font-bold text-sm text-sky-400">NW</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-200 tracking-wide">NodeWeaver</div>
              <div className="text-[10px] text-slate-600 font-mono">OSINT Investigation Platform</div>
            </div>
          </div>

          <h1 className="text-base font-semibold text-slate-100 mb-1">Create account</h1>
          <p className="text-xs text-slate-600 mb-6 font-mono">Register with your license key</p>

          {error && (
            <div className="mb-4 px-3 py-2 bg-red-500/8 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <span className="font-mono text-red-500 shrink-0">ERR</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-medium text-slate-600 uppercase tracking-widest mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border text-sm text-slate-200 placeholder-slate-700 focus:outline-none focus:border-sky-400/50 focus:ring-1 focus:ring-sky-400/15 transition-all font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-600 uppercase tracking-widest mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border text-sm text-slate-200 placeholder-slate-700 focus:outline-none focus:border-sky-400/50 focus:ring-1 focus:ring-sky-400/15 transition-all font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-600 uppercase tracking-widest mb-1.5">License Key <span className="text-slate-700 normal-case">(optional)</span></label>
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="NW-..."
                className="w-full px-3 py-2 bg-background border border-border text-sm text-slate-200 placeholder-slate-700 focus:outline-none focus:border-sky-400/50 focus:ring-1 focus:ring-sky-400/15 transition-all font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-2 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 hover:border-sky-400/60 text-sky-300 hover:text-sky-200 font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ boxShadow: loading ? 'none' : '0 0 20px rgba(56,189,248,0.07)' }}
            >
              {loading ? <span className="font-mono text-xs tracking-wider">Creating account...</span> : 'Register →'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-border flex items-center justify-center gap-1.5">
            <span className="text-xs text-slate-700">Have an account?</span>
            <Link href="/auth/login" className="text-xs text-sky-400 hover:text-sky-300 transition-colors">Sign in →</Link>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent mt-10" />
      </div>
    </div>
  );
}
