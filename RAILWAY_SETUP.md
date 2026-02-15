# Railway Deployment Guide — NodeWeaver API

Railway деплой с полной поддержкой Docker, WebSocket, Nmap, и всех OSINT инструментов.

## 🚀 Шаг 1: Создание проекта на Railway

1. Зайди на [railway.app](https://railway.app)
2. Логинься через GitHub
3. **New Project** → **Deploy from GitHub repo**
4. Выбери репозиторий: `lupodelvita/penis-mishu-i-moi`
5. Railway автоматически определит Dockerfile

## ⚙️ Шаг 2: Настройка Root Directory

Railway определит репозиторий, но нужно указать где находится API:

1. В Railway проекте → **Settings**
2. **Build & Deploy** → **Root Directory**
3. Установи: `apps/api`
4. **Deploy Trigger Path**: `apps/api/**` (деплойтся только при изменениях в API)

## 🔐 Шаг 3: Environment Variables

В Railway проекте → **Variables** → добавь переменные:

### Обязательные:
```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=super-secret-jwt-key-min-32-chars-random-string
SESSION_SECRET=super-secret-session-key-min-32-chars-random
PORT=4000
NODE_ENV=production
```

### Опциональные (для OSINT сервисов):
```bash
# Shodan API
SHODAN_API_KEY=your_shodan_key

# VirusTotal API
VIRUSTOTAL_API_KEY=your_virustotal_key

# Hunter.io (email verification)
HUNTER_API_KEY=your_hunter_key

# Have I Been Pwned
HIBP_API_KEY=your_hibp_key

# SecurityTrails (DNS history)
SECURITYTRAILS_API_KEY=your_securitytrails_key
```

## 🗄️ Шаг 4: Database Setup (3 опции)

### Опция A: Использовать существующий Neon PostgreSQL
Просто скопируй `DATABASE_URL` из Vercel переменных → вставь в Railway Variables.

### Опция B: Railway PostgreSQL Plugin
1. Railway проект → **New** → **Database** → **PostgreSQL**
2. Railway сам создаст переменную `DATABASE_URL`
3. Migrations запустятся автоматически при старте (`CMD` в Dockerfile)

### Опция C: External PostgreSQL
Любой другой PostgreSQL (Supabase, AWS RDS, etc.) — просто укажи `DATABASE_URL`.

## 🌐 Шаг 5: Получить домен

После успешного деплоя:

1. Railway проект → **Settings** → **Networking**
2. **Generate Domain** → получишь: `your-project-production.up.railway.app`
3. Скопируй этот домен

**Или** подключи кастомный домен:
- **Custom Domain** → `api.nodeweaver.io` (если есть домен)
- Настрой DNS: CNAME → `your-project-production.up.railway.app`

## 🔗 Шаг 6: Обновить Frontend (Vercel Web)

После получения Railway домена:

1. Зайди в **Vercel Dashboard** → твой проект web
2. **Settings** → **Environment Variables**
3. Измени `NEXT_PUBLIC_API_URL`:
   ```bash
   # Было:
   NEXT_PUBLIC_API_URL=https://core-phi-mocha.vercel.app
   
   # Стало:
   NEXT_PUBLIC_API_URL=https://your-project-production.up.railway.app
   ```
4. **Redeploy** web на Vercel

## ✅ Шаг 7: Проверка деплоя

### 1. Проверь логи Railway:
```bash
# В Railway Dashboard → Deployments → последний деплой → View Logs
```

Должен увидеть:
```
✓ Migrations deployed successfully
✓ Server running on port 4000
✓ Health check passed
```

### 2. Проверь API эндпоинты:
```bash
# Health check
curl https://your-project-production.up.railway.app/health

# Auth endpoint
curl https://your-project-production.up.railway.app/api/auth/status
```

### 3. Тест Nmap (Docker feature):
```bash
# В NodeWeaver frontend → создай IP entity → запусти Nmap Quick Scan
# Должно работать (на Railway есть Docker, на Vercel нет)
```

## 🐛 Troubleshooting

### Проблема: Migrations failed
```bash
# Railway проект → Variables → проверь DATABASE_URL
# Должен быть формат: postgresql://user:pass@host:5432/dbname?sslmode=require
```

### Проблема: Port binding error
```bash
# Railway проект → Variables → убедись что PORT=4000
# И в src/index.ts используется process.env.PORT
```

### Проблема: WebSocket не работает
Railway поддерживает WebSocket из коробки, но проверь:
```typescript
// В apps/web/src/components/CollaborationPanel.tsx
const WS_URL = process.env.NEXT_PUBLIC_API_URL?.replace('https://', 'wss://') || 'ws://localhost:4000';
```

### Проблема: CORS ошибки
Railway деплой использует тот же `src/index.ts` с raw CORS headers — должно работать.
Если нет, проверь в Railway Variables нет ли `ALLOWED_ORIGINS` (должно быть `*` или твой frontend домен).

## 🎯 Итог

**Railway API (Full Features):**
- ✅ Docker: nmap, whois, dnsutils, sqlmap
- ✅ WebSocket: real-time collaboration
- ✅ Database: PostgreSQL с migrations
- ✅ CORS: настроен для работы с Vercel frontend

**Vercel Web (Static Frontend):**
- ✅ Next.js SSR/SSG оптимизация
- ✅ Быстрая CDN доставка
- ✅ Automatic deployments при push

**Лучшее из обоих миров!** 🚀
