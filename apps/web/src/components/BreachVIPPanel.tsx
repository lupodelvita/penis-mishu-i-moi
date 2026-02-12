'use client';

import { useState } from 'react';
import { Search, Shield, AlertTriangle, Database, Loader2, Check, X } from 'lucide-react';

interface BreachVIPResult {
  source: string;
  categories: string | string[];
  [key: string]: any;
}

interface BreachVIPResponse {
  results: BreachVIPResult[];
  total: number;
  term: string;
  fields: string[];
}

interface BreachVIPPanelProps {
  onDataFetched?: (data: any) => void;
  onClose?: () => void;
}

const SEARCH_FIELDS = [
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'username', label: 'Username', icon: '👤' },
  { value: 'domain', label: 'Domain', icon: '🌐' },
  { value: 'phone', label: 'Phone', icon: '📱' },
  { value: 'ip', label: 'IP Address', icon: '🔌' },
  { value: 'name', label: 'Name', icon: '📝' },
  { value: 'discordid', label: 'Discord ID', icon: '💬' },
  { value: 'steamid', label: 'Steam ID', icon: '🎮' },
  { value: 'uuid', label: 'UUID', icon: '🔑' },
  { value: 'password', label: 'Password', icon: '🔒' },
];

export default function BreachVIPPanel({ onDataFetched, onClose }: BreachVIPPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>(['email']);
  const [wildcard, setWildcard] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BreachVIPResponse | null>(null);
  const [error, setError] = useState('');
  const [rateLimit, setRateLimit] = useState<{ used: number; limit: number; remaining: number } | null>(null);

  const toggleField = (field: string) => {
    if (selectedFields.includes(field)) {
      if (selectedFields.length > 1) {
        setSelectedFields(selectedFields.filter(f => f !== field));
      }
    } else {
      if (selectedFields.length < 10) {
        setSelectedFields([...selectedFields, field]);
      }
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setError('Please enter a search term');
      return;
    }

    if (selectedFields.length === 0) {
      setError('Please select at least one field');
      return;
    }

    setLoading(true);
    setError('');
    setData(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/osint/breachvip/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          term: searchTerm,
          fields: selectedFields,
          wildcard,
          case_sensitive: caseSensitive,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to search BreachVIP');
      }

      setData(result.data);
      setRateLimit(result.rateLimitStatus);
      
      if (onDataFetched) {
        onDataFetched(result.data);
      }
    } catch (err: any) {
      console.error('BreachVIP search error:', err);
      setError(err.message || 'Failed to search breach data');
    } finally {
      setLoading(false);
    }
  };

  const formatCategories = (categories: string | string[]): string => {
    if (Array.isArray(categories)) {
      return categories.join(', ');
    }
    return categories;
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 bg-gradient-to-r from-red-600/20 to-orange-600/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-400" />
            <h3 className="font-semibold text-white">BreachVIP Search</h3>
          </div>
          <div className="flex items-center gap-3">
            {rateLimit && (
              <div className="text-xs text-slate-400">
                {rateLimit.remaining}/{rateLimit.limit} requests left
              </div>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-1">Search leaked data across multiple breach databases</p>
      </div>

      {/* Search Fields Selection */}
      <div className="p-4 border-b border-slate-700">
        <div className="text-xs text-slate-400 mb-2">Search in fields (max 10):</div>
        <div className="flex flex-wrap gap-2">
          {SEARCH_FIELDS.map((field) => (
            <button
              key={field.value}
              onClick={() => toggleField(field.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedFields.includes(field.value)
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              <span className="mr-1">{field.icon}</span>
              {field.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search Input */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Enter search term..."
            disabled={loading}
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 text-white rounded-lg transition-colors flex items-center gap-2 font-medium disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Search
              </>
            )}
          </button>
        </div>

        {/* Options */}
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={wildcard}
              onChange={(e) => setWildcard(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-red-600 focus:ring-red-500"
            />
            <span className="text-slate-300">Wildcard (* ?)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-red-600 focus:ring-red-500"
            />
            <span className="text-slate-300">Case Sensitive</span>
          </label>
        </div>

        {wildcard && (
          <div className="mt-2 text-xs text-slate-500">
            <strong>Wildcard operators:</strong> * (zero or more chars), ? (one char). Cannot start with * or ?
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-900/20 border-b border-red-800">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Results */}
      {data && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-slate-300">
              Found <span className="font-bold text-white">{data.total}</span> results for{' '}
              <span className="font-mono text-red-400">{data.term}</span>
            </div>
            {data.total >= 10000 && (
              <div className="text-xs text-yellow-500">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                Max 10,000 results
              </div>
            )}
          </div>

          {data.total === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No breaches found</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {data.results.map((result, index) => (
                <div
                  key={index}
                  className="p-3 bg-slate-800 hover:bg-slate-750 rounded-lg border border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-semibold text-white flex items-center gap-2">
                      <Database className="w-4 h-4 text-red-400" />
                      {result.source}
                    </div>
                    <div className="text-xs px-2 py-1 bg-red-900/30 text-red-400 rounded">
                      {formatCategories(result.categories)}
                    </div>
                  </div>

                  {/* Display all fields from result */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(result)
                      .filter(([key]) => key !== 'source' && key !== 'categories')
                      .map(([key, value]) => (
                        <div key={key} className="flex items-start gap-2">
                          <span className="text-slate-500 font-medium min-w-[80px]">{key}:</span>
                          <span className="text-slate-300 font-mono break-all">{String(value)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info Footer */}
      {!data && !loading && (
        <div className="p-4 bg-slate-800/50 text-xs text-slate-500">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-slate-400">Rate Limit:</strong> 15 requests per minute. 
              Results limited to 10,000 records per search.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
