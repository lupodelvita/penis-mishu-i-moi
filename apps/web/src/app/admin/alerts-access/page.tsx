'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Shield, Plus, KeyRound, UserCheck, Clock3, Clipboard } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';

type Scope =
  | 'VIEW_DASHBOARDS'
  | 'VIEW_ERRORS'
  | 'MANAGE_ALERTS'
  | 'RECEIVE_TELEGRAM_ALERTS'
  | 'MANAGE_INTEGRATIONS';

const SCOPE_OPTIONS: Scope[] = [
  'VIEW_DASHBOARDS',
  'VIEW_ERRORS',
  'MANAGE_ALERTS',
  'RECEIVE_TELEGRAM_ALERTS',
  'MANAGE_INTEGRATIONS',
];

const DEFAULT_SCOPES: Scope[] = ['VIEW_DASHBOARDS', 'VIEW_ERRORS', 'RECEIVE_TELEGRAM_ALERTS'];

export default function AlertsAccessPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [overview, setOverview] = useState<any>(null);
  const [eligibleUsers, setEligibleUsers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [accesses, setAccesses] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [recipients, setRecipients] = useState<any[]>([]);

  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteHours, setInviteHours] = useState(72);
  const [inviteScopes, setInviteScopes] = useState<Scope[]>(DEFAULT_SCOPES);
  const [lastInviteToken, setLastInviteToken] = useState('');

  const [grantUserId, setGrantUserId] = useState('');
  const [grantScopes, setGrantScopes] = useState<Scope[]>(DEFAULT_SCOPES);
  const [grantChatId, setGrantChatId] = useState('');
  const [grantExpiresAt, setGrantExpiresAt] = useState('');

  const isAuthorized = useMemo(
    () => !!user && (user.role === 'ADMIN' || user.licenseTier === 'CEO'),
    [user],
  );

  useEffect(() => {
    if (!isAuthorized) {
      setLoading(false);
      return;
    }

    void loadAll();
  }, [isAuthorized]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [
        overviewRes,
        usersRes,
        invitesRes,
        accessRes,
        auditsRes,
        recipientsRes,
      ] = await Promise.all([
        api.get('/admin/observability/overview'),
        api.get('/admin/observability/users/eligible'),
        api.get('/admin/observability/invites'),
        api.get('/admin/observability/access'),
        api.get('/admin/observability/audit?limit=200'),
        api.get('/admin/observability/recipients/telegram'),
      ]);

      setOverview(overviewRes.data.data);
      setEligibleUsers(usersRes.data.data ?? []);
      setInvites(invitesRes.data.data ?? []);
      setAccesses(accessRes.data.data ?? []);
      setAudits(auditsRes.data.data ?? []);
      setRecipients(recipientsRes.data.data ?? []);
    } catch (error) {
      console.error('Failed to load observability admin data', error);
      alert('Не удалось загрузить данные observability access');
    } finally {
      setLoading(false);
    }
  };

  const toggleScope = (scope: Scope, selected: Scope[], setSelected: (value: Scope[]) => void) => {
    if (selected.includes(scope)) {
      const next = selected.filter((item) => item !== scope);
      setSelected(next.length ? next : [scope]);
      return;
    }
    setSelected([...selected, scope]);
  };

  const createInvite = async () => {
    if (!inviteUserId && !inviteUsername.trim()) {
      alert('Укажи userId или username для invite');
      return;
    }

    if (!inviteScopes.length) {
      alert('Выбери хотя бы один scope');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        scopes: inviteScopes,
        expiresInHours: inviteHours,
      };

      if (inviteUserId) payload.invitedUserId = inviteUserId;
      if (inviteUsername.trim()) payload.invitedUsername = inviteUsername.trim();

      const res = await api.post('/admin/observability/invites', payload);
      setLastInviteToken(res.data?.data?.inviteToken ?? '');
      setInviteUserId('');
      setInviteUsername('');
      await loadAll();
    } catch (error: any) {
      alert(error?.response?.data?.error || 'Не удалось создать invite');
    } finally {
      setSaving(false);
    }
  };

  const revokeInvite = async (inviteId: string) => {
    if (!confirm('Отозвать invite?')) return;

    setSaving(true);
    try {
      await api.post(`/admin/observability/invites/${inviteId}/revoke`);
      await loadAll();
    } catch (error: any) {
      alert(error?.response?.data?.error || 'Не удалось отозвать invite');
    } finally {
      setSaving(false);
    }
  };

  const grantAccess = async () => {
    if (!grantUserId) {
      alert('Выбери userId');
      return;
    }

    if (!grantScopes.length) {
      alert('Выбери хотя бы один scope');
      return;
    }

    setSaving(true);
    try {
      await api.post('/admin/observability/access/grant', {
        userId: grantUserId,
        scopes: grantScopes,
        telegramChatId: grantChatId || undefined,
        expiresAt: grantExpiresAt || undefined,
      });
      setGrantUserId('');
      setGrantChatId('');
      setGrantExpiresAt('');
      await loadAll();
    } catch (error: any) {
      alert(error?.response?.data?.error || 'Не удалось выдать access');
    } finally {
      setSaving(false);
    }
  };

  const revokeAccess = async (accessId: string) => {
    if (!confirm('Отозвать доступ?')) return;

    setSaving(true);
    try {
      await api.post(`/admin/observability/access/${accessId}/revoke`);
      await loadAll();
    } catch (error: any) {
      alert(error?.response?.data?.error || 'Не удалось отозвать доступ');
    } finally {
      setSaving(false);
    }
  };

  const updateAccessChat = async (accessId: string, currentChatId: string | null) => {
    const nextChatId = prompt('Введите Telegram Chat ID (пусто = удалить)', currentChatId || '');
    if (nextChatId === null) return;

    setSaving(true);
    try {
      await api.patch(`/admin/observability/access/${accessId}`, {
        telegramChatId: nextChatId.trim() ? nextChatId.trim() : null,
      });
      await loadAll();
    } catch (error: any) {
      alert(error?.response?.data?.error || 'Не удалось обновить chat_id');
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthorized) {
    return <div className="p-8 text-white">Доступ запрещен. Только для ADMIN/CEO.</div>;
  }

  if (loading) {
    return <div className="p-8 text-white">Загрузка Alerts Access...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto text-white space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/admin" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition">
          <ArrowLeft className="w-4 h-4" />
          <span>Назад в Control Center</span>
        </Link>

        <button
          onClick={() => void loadAll()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 hover:bg-white/5 transition"
          disabled={saving}
        >
          <RefreshCw className="w-4 h-4" />
          Обновить
        </button>
      </div>

      <div>
        <h1 className="text-3xl font-black bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          Alerts Access (CEO/Admin)
        </h1>
        <p className="text-gray-400 mt-1">
          Управление доступом к observability и Telegram alert routing только для разрешённых пользователей.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi icon={<KeyRound className="w-4 h-4 text-yellow-400" />} label="Pending Invites" value={overview?.pendingInvites ?? 0} />
        <Kpi icon={<UserCheck className="w-4 h-4 text-green-400" />} label="Active Access" value={overview?.activeAccesses ?? 0} />
        <Kpi icon={<Clock3 className="w-4 h-4 text-orange-400" />} label="Expiring Soon" value={overview?.expiringSoon ?? 0} />
        <Kpi icon={<Shield className="w-4 h-4 text-blue-400" />} label="Audit Events" value={overview?.totalAudits ?? 0} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Plus className="w-5 h-5 text-cyan-400" /> Create Invite
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={inviteUserId}
              onChange={(e) => setInviteUserId(e.target.value)}
              placeholder="invitedUserId (uuid)"
              className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2"
            />
            <input
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.target.value)}
              placeholder="или invitedUsername"
              className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2"
            />
            <input
              type="number"
              value={inviteHours}
              min={1}
              max={720}
              onChange={(e) => setInviteHours(Number(e.target.value))}
              className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2"
            />
          </div>

          <ScopeSelector selected={inviteScopes} onToggle={(scope) => toggleScope(scope, inviteScopes, setInviteScopes)} />

          <button
            onClick={() => void createInvite()}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 font-bold"
          >
            Create Invite
          </button>

          {lastInviteToken && (
            <div className="p-3 rounded-xl border border-green-500/30 bg-green-500/10 text-sm">
              <div className="text-green-400 font-bold mb-2">Invite token создан</div>
              <div className="break-all font-mono text-green-200">{lastInviteToken}</div>
              <button
                onClick={() => navigator.clipboard.writeText(lastInviteToken)}
                className="mt-2 inline-flex items-center gap-1 text-xs text-gray-300 hover:text-white"
              >
                <Clipboard className="w-3 h-3" /> Copy
              </button>
            </div>
          )}
        </section>

        <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-green-400" /> Grant Access
          </h2>

          <select
            value={grantUserId}
            onChange={(e) => setGrantUserId(e.target.value)}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2"
          >
            <option value="">Выбери пользователя</option>
            {eligibleUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username} ({u.license?.tier || 'NO_LICENSE'})
              </option>
            ))}
          </select>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={grantChatId}
              onChange={(e) => setGrantChatId(e.target.value)}
              placeholder="Telegram chat_id"
              className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2"
            />
            <input
              type="datetime-local"
              value={grantExpiresAt}
              onChange={(e) => setGrantExpiresAt(e.target.value)}
              className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2"
            />
          </div>

          <ScopeSelector selected={grantScopes} onToggle={(scope) => toggleScope(scope, grantScopes, setGrantScopes)} />

          <button
            onClick={() => void grantAccess()}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 font-bold"
          >
            Grant/Upsert Access
          </button>
        </section>
      </div>

      <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-lg font-bold mb-4">Active Telegram Recipients</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {recipients.map((r) => (
            <div key={`${r.userId}-${r.chatId}`} className="rounded-xl border border-gray-700 p-3">
              <div className="font-bold">{r.username}</div>
              <div className="text-xs text-gray-400">userId: {r.userId}</div>
              <div className="text-xs text-cyan-300">chat_id: {r.chatId}</div>
            </div>
          ))}
          {!recipients.length && <div className="text-gray-500 text-sm">No active recipients.</div>}
        </div>
      </section>

      <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-lg font-bold mb-4">Invites</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800">
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Target</th>
                <th className="text-left py-2">Scopes</th>
                <th className="text-left py-2">Expires</th>
                <th className="text-right py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.id} className="border-b border-gray-800/60">
                  <td className="py-2">{invite.status}</td>
                  <td className="py-2">{invite.invitedUser?.username || invite.invitedUsername || '-'}</td>
                  <td className="py-2 text-xs">{(invite.scopes || []).join(', ')}</td>
                  <td className="py-2 text-xs">{new Date(invite.expiresAt).toLocaleString()}</td>
                  <td className="py-2 text-right">
                    {invite.status === 'PENDING' && (
                      <button
                        onClick={() => void revokeInvite(invite.id)}
                        className="px-2 py-1 rounded bg-red-600/80 hover:bg-red-600 text-xs"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-lg font-bold mb-4">Access List</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800">
                <th className="text-left py-2">User</th>
                <th className="text-left py-2">Scopes</th>
                <th className="text-left py-2">Telegram</th>
                <th className="text-left py-2">Active</th>
                <th className="text-left py-2">Expires</th>
                <th className="text-right py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accesses.map((access) => (
                <tr key={access.id} className="border-b border-gray-800/60">
                  <td className="py-2">
                    {access.user?.username}
                    <div className="text-xs text-gray-500">{access.user?.license?.tier}</div>
                  </td>
                  <td className="py-2 text-xs">{(access.scopes || []).join(', ')}</td>
                  <td className="py-2 text-xs">{access.telegramChatId || '-'}</td>
                  <td className="py-2">{access.isActive ? 'YES' : 'NO'}</td>
                  <td className="py-2 text-xs">{access.expiresAt ? new Date(access.expiresAt).toLocaleString() : '-'}</td>
                  <td className="py-2 text-right space-x-2">
                    <button
                      onClick={() => void updateAccessChat(access.id, access.telegramChatId)}
                      className="px-2 py-1 rounded bg-blue-600/80 hover:bg-blue-600 text-xs"
                    >
                      Update chat
                    </button>
                    <button
                      onClick={() => void revokeAccess(access.id)}
                      className="px-2 py-1 rounded bg-red-600/80 hover:bg-red-600 text-xs"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-lg font-bold mb-4">Audit Log</h2>
        <div className="max-h-[420px] overflow-auto space-y-2">
          {audits.map((log) => (
            <div key={log.id} className="rounded-lg border border-gray-800 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-cyan-300">{log.action}</span>
                <span className="text-gray-500">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
              <div className="text-gray-300 mt-1">
                actor: {log.actorUser?.username || '-'} · subject: {log.subjectUser?.username || '-'}
              </div>
              {log.details && <pre className="mt-2 text-[11px] text-gray-400 whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</pre>}
            </div>
          ))}
          {!audits.length && <div className="text-gray-500 text-sm">No audit events yet.</div>}
        </div>
      </section>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
      <div className="p-2 rounded-xl bg-gray-950">{icon}</div>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-2xl font-black">{value}</div>
      </div>
    </div>
  );
}

function ScopeSelector({ selected, onToggle }: { selected: Scope[]; onToggle: (scope: Scope) => void }) {
  return (
    <div>
      <div className="text-xs text-gray-400 mb-2">Scopes</div>
      <div className="flex flex-wrap gap-2">
        {SCOPE_OPTIONS.map((scope) => {
          const active = selected.includes(scope);
          return (
            <button
              key={scope}
              type="button"
              onClick={() => onToggle(scope)}
              className={`px-2 py-1 rounded border text-xs transition ${
                active
                  ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                  : 'border-gray-700 bg-gray-900 text-gray-400 hover:text-white hover:border-gray-500'
              }`}
            >
              {scope}
            </button>
          );
        })}
      </div>
    </div>
  );
}
