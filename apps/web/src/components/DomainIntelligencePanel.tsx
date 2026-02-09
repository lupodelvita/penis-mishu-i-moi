// apps/web/src/components/DomainIntelligencePanel.tsx
'use client';

import { useState } from 'react';
import { Search, Globe, Server, Mail, Calendar, Shield, Loader2 } from 'lucide-react';

interface DomainIntelligencePanelProps {
  onDataFetched?: (data: any) => void;
}

export default function DomainIntelligencePanel({ onDataFetched }: DomainIntelligencePanelProps) {
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!domain.trim()) {
      setError('Please enter a domain');
      return;
    }

    setLoading(true);
    setError('');
    setData(null);

    try {
      const response = await fetch('http://localhost:4000/api/osint/whois/domain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ domain }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch domain intelligence');
      }

      setData(result.data);
      
      if (onDataFetched) {
        onDataFetched(result.data);
      }
    } catch (err: any) {
      console.error('Domain intelligence error:', err);
      setError(err.message || 'Failed to fetch domain data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 bg-gradient-to-r from-blue-600/20 to-purple-600/20">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-white">Domain Intelligence</h3>
        </div>
        <p className="text-xs text-slate-400 mt-1">WHOIS + DNS Analysis</p>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="example.com"
            disabled={loading}
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
          />
          <button
            onClick={handleSearch}
            disabled={loading || !domain.trim()}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Analyze
              </>
            )}
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-400 mt-2">⚠️ {error}</p>
        )}
      </div>

      {/* Results */}
      {data && (
        <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
          {/* WHOIS Data */}
          {data.whois && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                WHOIS Information
              </h4>
              <div className="bg-slate-800 rounded-lg p-3 space-y-2 text-sm">
                {data.whois.registrar && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Registrar:</span>
                    <span className="text-white font-medium">{data.whois.registrar}</span>
                  </div>
                )}
                {data.whois.registrant?.organization && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Organization:</span>
                    <span className="text-white">{data.whois.registrant.organization}</span>
                  </div>
                )}
                {data.whois.createdDate && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Created:
                    </span>
                    <span className="text-white">{new Date(data.whois.createdDate).toLocaleDateString()}</span>
                  </div>
                )}
                {data.whois.expiresDate && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Expires:
                    </span>
                    <span className="text-white">{new Date(data.whois.expiresDate).toLocaleDateString()}</span>
                  </div>
                )}
                {data.whois.dnssec !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">DNSSEC:</span>
                    <span className={data.whois.dnssec ? 'text-green-400' : 'text-red-400'}>
                      {data.whois.dnssec ? '✓ Enabled' : '✗ Disabled'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DNS Records */}
          {data.dns && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-purple-400 flex items-center gap-2">
                <Server className="w-4 h-4" />
                DNS Records
              </h4>
              <div className="bg-slate-800 rounded-lg p-3 space-y-2 text-sm">
                {data.dns.a && data.dns.a.length > 0 && (
                  <div>
                    <span className="text-slate-400 block mb-1">A Records (IPv4):</span>
                    {data.dns.a.map((ip: string, idx: number) => (
                      <div key={idx} className="text-white font-mono text-xs ml-2">• {ip}</div>
                    ))}
                  </div>
                )}
                {data.dns.aaaa && data.dns.aaaa.length > 0 && (
                  <div>
                    <span className="text-slate-400 block mb-1">AAAA Records (IPv6):</span>
                    {data.dns.aaaa.map((ip: string, idx: number) => (
                      <div key={idx} className="text-white font-mono text-xs ml-2 truncate">• {ip}</div>
                    ))}
                  </div>
                )}
                {data.dns.mx && data.dns.mx.length > 0 && (
                  <div>
                    <span className="text-slate-400 flex items-center gap-1 mb-1">
                      <Mail className="w-3 h-3" />
                      MX Records (Mail):
                    </span>
                    {data.dns.mx.map((mx: any, idx: number) => (
                      <div key={idx} className="text-white text-xs ml-2">
                        • {mx.exchange} <span className="text-slate-500">(priority: {mx.priority})</span>
                      </div>
                    ))}
                  </div>
                )}
                {data.dns.ns && data.dns.ns.length > 0 && (
                  <div>
                    <span className="text-slate-400 block mb-1">Nameservers:</span>
                    {data.dns.ns.map((ns: string, idx: number) => (
                      <div key={idx} className="text-white text-xs ml-2">• {ns}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Graph Stats */}
          <div className="bg-gradient-to-r from-green-600/10 to-emerald-600/10 rounded-lg p-3 border border-green-600/30">
            <p className="text-xs text-green-400">
              ✓ {data.results?.length || 0} entities added to graph
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !data && !error && (
        <div className="p-8 text-center text-slate-500">
          <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Enter a domain to analyze</p>
          <p className="text-xs mt-1">WHOIS, DNS, Registrar, Nameservers, etc.</p>
        </div>
      )}
    </div>
  );
}
