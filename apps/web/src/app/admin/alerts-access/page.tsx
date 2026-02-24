'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Shield, Plus, KeyRound, UserCheck, Clock3, Clipboard, Zap } from 'lucide-react';
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
  const [telegramBots, setTelegramBots] = useState<any[]>([]);

  const [uiNotice, setUiNotice] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);

  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteHours, setInviteHours] = useState(72);
  const [inviteScopes, setInviteScopes] = useState<Scope[]>(DEFAULT_SCOPES);
  const [lastInviteToken, setLastInviteToken] = useState('');

  const [grantUserId, setGrantUserId] = useState('');
  const [grantScopes, setGrantScopes] = useState<Scope[]>(DEFAULT_SCOPES);
  const [grantChatId, setGrantChatId] = useState('');
  const [grantBotId, setGrantBotId] = useState('');
  const [grantExpiresAt, setGrantExpiresAt] = useState('');
  const [accountCodeFilter, setAccountCodeFilter] = useState('');

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

  // Poll bot status every 8s so online/offline reflects reality without a full reload
  useEffect(() => {
    if (!isAuthorized) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/admin/observability/telegram-bots?_t=${Date.now()}`);
        const bots = res.data.data ?? [];
        setTelegramBots(bots);
        setGrantBotId((prev) => {
          if (!prev && bots.length) {
            const preferOnline = bots.find((b: any) => b.isOnline) ?? bots[0];
            return preferOnline.id;
          }
          return prev;
        });
      } catch (_) { /* silent */ }
    }, 8000);
    return () => clearInterval(interval);
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
        botsRes,
      ] = await Promise.all([
        api.get('/admin/observability/overview'),
        api.get('/admin/observability/users/eligible'),
        api.get('/admin/observability/invites'),
        api.get('/admin/observability/access'),
        api.get('/admin/observability/audit?limit=200'),
        api.get('/admin/observability/recipients/telegram'),
        api.get(`/admin/observability/telegram-bots?_t=${Date.now()}`),
      ]);

      setOverview(overviewRes.data.data);
      setEligibleUsers(usersRes.data.data ?? []);
      setInvites(invitesRes.data.data ?? []);
      const accessData = accessRes.data.data ?? [];
      setAccesses(accessData);
      setAudits(auditsRes.data.data ?? []);
      setRecipients(recipientsRes.data.data ?? []);
      const bots = botsRes.data.data ?? [];
      setTelegramBots(bots);
      if (!grantBotId && bots.length) {
        const preferOnline = bots.find((b: any) => b.isOnline) ?? bots[0];
        setGrantBotId(preferOnline.id);
      }
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
      setUiNotice({ type: 'error', text: 'Выбери хотя бы один scope' });
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
      setUiNotice({ type: 'error', text: error?.response?.data?.error || 'Не удалось создать invite' });
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
      setUiNotice({ type: 'error', text: 'Выбери пользователя перед выдачей доступа' });
      return;
    }

    if (!grantScopes.length) {
      setUiNotice({ type: 'error', text: 'Выбери хотя бы один scope' });
      return;
    }

    if (grantChatId && !grantBotId) {
      setUiNotice({ type: 'error', text: 'Для Telegram chat_id выбери активного Telegram-бота' });
      return;
    }

    setSaving(true);
    try {
      await api.post('/admin/observability/access/grant', {
        userId: grantUserId,
        scopes: grantScopes,
        telegramChatId: grantChatId || undefined,
        telegramBotId: grantChatId ? grantBotId : undefined,
        expiresAt: grantExpiresAt || undefined,
      });
      setGrantUserId('');
      setGrantChatId('');
      setGrantExpiresAt('');
      setUiNotice({ type: 'success', text: 'Access сохранён' });
      await loadAll();
    } catch (error: any) {
      setUiNotice({ type: 'error', text: error?.response?.data?.error || 'Не удалось выдать access' });
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

    const trimmedChatId = nextChatId.trim();
    if (trimmedChatId && !grantBotId) {
      setUiNotice({ type: 'error', text: 'Выбери активного Telegram-бота (см. блок Grant Access)' });
      return;
    }

    setSaving(true);
    try {
      await api.patch(`/admin/observability/access/${accessId}`, {
        telegramChatId: trimmedChatId ? trimmedChatId : null,
        telegramBotId: trimmedChatId ? grantBotId : undefined,
      });
      setUiNotice({ type: 'success', text: 'Telegram chat обновлён' });
      await loadAll();
    } catch (error: any) {
      setUiNotice({ type: 'error', text: error?.response?.data?.error || 'Не удалось обновить chat_id' });
    } finally {
      setSaving(false);
    }
  };

  const sendTestMessage = async (accessId: string) => {
    setSaving(true);
    try {
      await api.post(`/admin/observability/access/${accessId}/test-message`);
      setUiNotice({ type: 'success', text: 'Тестовое сообщение отправлено ✅' });
    } catch (error: any) {
      setUiNotice({ type: 'error', text: error?.response?.data?.error || 'Не удалось отправить тест' });
    } finally {
      setSaving(false);
    }
  };

  const [dispatchResults, setDispatchResults] = useState<Record<string, any>>({});
  const [dispatchLoading, setDispatchLoading] = useState<string | null>(null);

  const testDispatch = async (scope: string) => {
    setDispatchLoading(scope);
    try {
      const res = await api.post('/admin/observability/test-dispatch', { scope });
      setDispatchResults((prev) => ({ ...prev, [scope]: { ok: true, data: res.data.data } }));
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Ошибка доставки';
      setDispatchResults((prev) => ({ ...prev, [scope]: { ok: false, error: msg } }));
    } finally {
      setDispatchLoading(null);
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

      <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Clipboard className="w-5 h-5 text-cyan-400" /> Create Invite
        </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={inviteUserId}
              onChange={(e) => setInviteUserId(e.target.value)}
              placeholder="invitedUserId (uuid или accountCode)"
              className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2"
            />
            <input
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.target.value)}
              placeholder="или invitedUsername"
              className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-gray-400">Срок действия инвайта (часы)</div>
              <input
                type="number"
                value={inviteHours}
                min={1}
                max={720}
                onChange={(e) => setInviteHours(Number(e.target.value))}
                className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2"
              />
              <div className="text-[11px] text-gray-500">По умолчанию 72 часа.</div>
            </div>
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

          {uiNotice && (
            <div
              className={`rounded-xl px-3 py-2 text-sm border flex items-start gap-2 ${
                uiNotice.type === 'error'
                  ? 'border-red-500/40 bg-red-500/10 text-red-200'
                  : uiNotice.type === 'success'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                  : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100'
              }`}
            >
              <span className="font-semibold">{uiNotice.type === 'error' ? 'Ошибка' : uiNotice.type === 'success' ? 'Готово' : 'Info'}</span>
              <span>{uiNotice.text}</span>
            </div>
          )}

          <select
            value={grantUserId}
            onChange={(e) => setGrantUserId(e.target.value)}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2"
          >
            <option value="">Выбери пользователя</option>
            {eligibleUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username} {u.accountCode ? `· ${u.accountCode}` : ''} ({u.license?.tier || 'NO_LICENSE'})
              </option>
            ))}
          </select>

          <ScopeSelector selected={grantScopes} onToggle={(scope) => toggleScope(scope, grantScopes, setGrantScopes)} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div className="space-y-1">
              <div className="text-xs text-gray-400">Активный Telegram-бот</div>
              <select
                value={grantBotId}
                onChange={(e) => setGrantBotId(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2"
                disabled={!telegramBots.length}
              >
                {!telegramBots.length && <option value="">— нет ботов —</option>}
                {telegramBots.map((bot) => (
                  <option key={bot.id} value={bot.id}>
                    {bot.name} {bot.isOnline ? '✓ онлайн' : '✗ оффлайн'}
                  </option>
                ))}
              </select>
              {telegramBots.length === 0 && (
                <div className="text-xs text-red-200 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 space-y-1">
                  <div className="font-semibold leading-tight">Нет Telegram-ботов</div>
                  <div className="text-[11px] text-red-100/80 leading-tight">Добавь Telegram-бота в разделе Bots и обнови страницу.</div>
                </div>
              )}
              {telegramBots.length > 0 && !telegramBots.some((b) => b.isOnline) && (
                <div className="text-xs text-yellow-200 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 space-y-1">
                  <div className="font-semibold leading-tight">Бот не запущен</div>
                  <div className="text-[11px] text-yellow-100/80 leading-tight">Запусти бота в разделе Bots — он должен быть онлайн чтобы отправлять алерты.</div>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="text-xs text-gray-400">Telegram chat_id</div>
              <input
                value={grantChatId}
                onChange={(e) => setGrantChatId(e.target.value)}
                placeholder="Telegram chat_id"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2"
              />
              <div className="text-[11px] text-gray-500">Бот должен быть в чате; chat_id обязателен для RECEIVE_TELEGRAM_ALERTS.</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-gray-400">Дата/время истечения (опционально)</div>
              <input
                type="datetime-local"
                value={grantExpiresAt}
                onChange={(e) => setGrantExpiresAt(e.target.value)}
                className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 placeholder:text-gray-600"
              />
              <div className="text-[11px] text-gray-500">Оставь пустым, если доступ бессрочный.</div>
            </div>
          </div>

          <button
            onClick={() => void grantAccess()}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 font-bold"
          >
            Grant/Upsert Access
          </button>
        </section>

      <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-lg font-bold mb-4">Active Telegram Recipients</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {recipients.map((r) => (
            <div key={`${r.userId}-${r.chatId}`} className="rounded-xl border border-gray-700 p-3">
              <div className="font-bold">{r.username}</div>
              <div className="text-xs text-gray-400">userId: {r.userId}</div>
              {r.accountCode && <div className="text-xs text-gray-400">accountCode: {r.accountCode}</div>}
              <div className="text-xs text-cyan-300">chat_id: {r.chatId}</div>
            </div>
          ))}
          {!recipients.length && <div className="text-gray-500 text-sm">No active recipients.</div>}
        </div>
      </section>

      <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" /> Тест доставки алертов
        </h2>
        <p className="text-xs text-gray-400">
          Отправляет тестовое сообщение всем получателям с выбранным scope. Убедитесь, что хотя бы один Telegram-бот запущен.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SCOPE_OPTIONS.map((scope) => {
            const result = dispatchResults[scope];
            const isLoading = dispatchLoading === scope;
            return (
              <div key={scope} className="rounded-xl border border-gray-700 bg-gray-950/60 p-3 space-y-2">
                <div className="text-[11px] font-mono text-cyan-300 truncate">{scope}</div>
                {result && (
                  <div className={`text-[11px] rounded-lg px-2 py-1.5 border font-mono ${
                    !result.ok
                      ? 'border-red-500/40 bg-red-500/10 text-red-300'
                      : result.data?.totalRecipients === 0
                      ? 'border-gray-600/60 bg-gray-800/60 text-gray-400'
                      : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  }`}>
                    {!result.ok
                      ? `FAILED — ${result.error}`
                      : result.data?.totalRecipients === 0
                      ? 'NO RECIPIENTS — нет подписчиков с данным scope'
                      : `OK — ${result.data?.deliveredRecipients}/${result.data?.totalRecipients} delivered`
                    }
                  </div>
                )}
                <button
                  onClick={() => void testDispatch(scope)}
                  disabled={isLoading || dispatchLoading !== null}
                  className="w-full px-3 py-1.5 rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20 hover:border-yellow-400 text-[11px] font-semibold transition disabled:opacity-40"
                >
                  {isLoading ? 'Отправка...' : 'Тест рассылки'}
                </button>
              </div>
            );
          })}
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
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <input
            value={accountCodeFilter}
            onChange={(e) => setAccountCodeFilter(e.target.value)}
            placeholder="Поиск по accountCode или username"
            className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm w-full md:w-96"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800">
                <th className="text-left py-2">User</th>
                <th className="text-left py-2">Account Code</th>
                <th className="text-left py-2">Scopes</th>
                <th className="text-left py-2">Telegram</th>
                <th className="text-left py-2">Active</th>
                <th className="text-left py-2">Expires</th>
                <th className="text-right py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accesses
                .filter((access) => {
                  if (!accountCodeFilter.trim()) return true;
                  const needle = accountCodeFilter.trim().toLowerCase();
                  return (
                    access.user?.accountCode?.toLowerCase().includes(needle) ||
                    access.user?.username?.toLowerCase().includes(needle)
                  );
                })
                .map((access) => (
                <tr key={access.id} className="border-b border-gray-800/60">
                  <td className="py-2">
                    {access.user?.username}
                    <div className="text-xs text-gray-500">{access.user?.license?.tier}</div>
                  </td>
                  <td className="py-2 text-xs text-cyan-200">
                    {access.user?.accountCode || '-'}
                  </td>
                  <td className="py-2 text-xs">{(access.scopes || []).join(', ')}</td>
                  <td className="py-2 text-xs">{access.telegramChatId || '-'}</td>
                  <td className="py-2">{access.isActive ? 'YES' : 'NO'}</td>
                  <td className="py-2 text-xs">{access.expiresAt ? new Date(access.expiresAt).toLocaleString() : '-'}</td>
                  <td className="py-2">
                    <div className="flex items-center justify-end gap-1.5">
                      {access.telegramChatId && (
                        <button
                          onClick={() => void sendTestMessage(access.id)}
                          disabled={saving}
                          className="px-2.5 py-1 rounded-lg border border-cyan-500/50 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400 text-[11px] font-medium transition disabled:opacity-40"
                        >
                          Тест
                        </button>
                      )}
                      <button
                        onClick={() => void updateAccessChat(access.id, access.telegramChatId)}
                        disabled={saving}
                        className="px-2.5 py-1 rounded-lg border border-blue-500/50 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 hover:border-blue-400 text-[11px] font-medium transition disabled:opacity-40"
                      >
                        Чат
                      </button>
                      <button
                        onClick={() => void revokeAccess(access.id)}
                        disabled={saving}
                        className="px-2.5 py-1 rounded-lg border border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:border-red-400 text-[11px] font-medium transition disabled:opacity-40"
                      >
                        Отозвать
                      </button>
                    </div>
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
              className={`px-3 py-[6px] rounded-md border text-[11px] tracking-tight font-semibold transition ${
                active
                  ? 'border-cyan-400/70 bg-cyan-500/15 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.35)]'
                  : 'border-gray-700 bg-gray-900 text-gray-300 hover:text-white hover:border-gray-500'
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
