'use client';

import { useState } from 'react';
import { X, Wifi, Shield, Zap, AlertTriangle, Loader2 } from 'lucide-react';

interface NmapScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetEntity?: {
    id: string;
    type: string;
    value: string;
  };
  onScanComplete?: (results: any) => void;
}

type ScanType = 'quick' | 'full' | 'vuln';

interface ScanStatus {
  scanning: boolean;
  progress: string;
  error?: string;
}

export default function NmapScanModal({ 
  isOpen, 
  onClose, 
  targetEntity,
  onScanComplete 
}: NmapScanModalProps) {
  const [target, setTarget] = useState(targetEntity?.value || '');
  const [scanType, setScanType] = useState<ScanType>('quick');
  const [status, setStatus] = useState<ScanStatus>({ scanning: false, progress: '' });
  const [results, setResults] = useState<any>(null);

  if (!isOpen) return null;

  const scanTypes = [
    {
      id: 'quick',
      name: 'Quick Scan',
      icon: Zap,
      description: 'Fast scan of top 100 ports (~10s)',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      id: 'full',
      name: 'Full Scan',
      icon: Wifi,
      description: 'Complete scan with OS detection (2-5 min)',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      id: 'vuln',
      name: 'Vulnerability Scan',
      icon: Shield,
      description: 'Check for known vulnerabilities (1-3 min)',
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ];

  const handleScan = async () => {
    if (!target.trim()) {
      setStatus({ scanning: false, progress: '', error: 'Please enter a target' });
      return;
    }

    setStatus({ scanning: true, progress: 'Initializing scan...', error: undefined });
    setResults(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/osint/nmap/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ target, scanType }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Scan failed');
      }

      setStatus({ scanning: false, progress: 'Scan complete!' });
      setResults(data.data);
      
      if (onScanComplete) {
        onScanComplete(data.data);
      }
    } catch (error: any) {
      console.error('Nmap scan error:', error);
      setStatus({ 
        scanning: false, 
        progress: '', 
        error: error.message || 'Failed to execute scan' 
      });
    }
  };

  const selectedScanType = scanTypes.find(st => st.id === scanType)!;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg">
              <Wifi className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Nmap Port Scanner</h2>
              <p className="text-sm text-slate-400">Network reconnaissance tool</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Target Input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Target (Domain or IP)
            </label>
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="example.com or 93.184.216.34"
              disabled={status.scanning}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-green-500 transition-colors disabled:opacity-50"
            />
          </div>

          {/* Scan Type Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Scan Type
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {scanTypes.map((st) => (
                <button
                  key={st.id}
                  onClick={() => setScanType(st.id as ScanType)}
                  disabled={status.scanning}
                  className={`p-4 rounded-lg border-2 transition-all text-left disabled:opacity-50 ${
                    scanType === st.id
                      ? `border-green-500 ${st.bgColor}`
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <st.icon className={`w-5 h-5 ${st.color}`} />
                    <span className="font-medium text-white text-sm">{st.name}</span>
                  </div>
                  <p className="text-xs text-slate-400">{st.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          {(status.scanning || status.progress || status.error) && (
            <div className={`p-4 rounded-lg border ${
              status.error 
                ? 'bg-red-500/10 border-red-500/50' 
                : 'bg-green-500/10 border-green-500/50'
            }`}>
              <div className="flex items-center gap-3">
                {status.scanning && (
                  <Loader2 className="w-5 h-5 text-green-500 animate-spin" />
                )}
                {status.error && (
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                )}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    status.error ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {status.error || status.progress}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Results Preview */}
          {results && (
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h3 className="text-sm font-semibold text-white mb-3">Scan Results</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Target:</span>
                  <span className="text-white font-mono">{results.scan.target}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Duration:</span>
                  <span className="text-white">{(results.scan.duration / 1000).toFixed(2)}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Open Ports:</span>
                  <span className="text-green-400 font-semibold">
                    {results.host?.ports?.filter((p: any) => p.state === 'open').length || 0}
                  </span>
                </div>
                {results.host?.os && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">OS:</span>
                    <span className="text-white">{results.host.os}</span>
                  </div>
                )}
                {results.host?.vulnerabilities && results.host.vulnerabilities.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Vulnerabilities:</span>
                    <span className="text-orange-400 font-semibold">
                      {results.host.vulnerabilities.length} found
                    </span>
                  </div>
                )}
              </div>
              
              {/* Entities Added Info */}
              <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-xs text-slate-500">
                  ✓ {results.results?.length || 0} entities added to graph
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-700">
          <div className="text-xs text-slate-500">
            💡 Tip: Quick scans are faster but less accurate
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleScan}
              disabled={status.scanning || !target.trim()}
              className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-lg text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {status.scanning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <selectedScanType.icon className="w-4 h-4" />
                  Start Scan
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
