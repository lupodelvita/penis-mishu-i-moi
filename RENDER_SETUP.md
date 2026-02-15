# Render Deployment Guide — NodeWeaver

Полный деплой NodeWeaver на Render с Docker, PostgreSQL, и всеми OSINT инструментами.

## 🚀 Быстрый старт (Blueprint автоматический деплой)

1. **Зайди на [render.com](https://render.com)**
2. **Логинься через GitHub**
3. **New** → **Blueprint**
4. **Выбери репозиторий**: `lupodelvita/penis-mishu-i-moi`
5. **Render автоматически**:
   - Прочитает `render.yaml` из корня репо
   - Создаст PostgreSQL базу (`nodeweaver-db`)
   - Создаст API сервис с Docker (`nodeweaver-api`)
   - Создаст Web сервис на Node.js (`nodeweaver-web`)
   - Сгенерирует секреты (JWT_SECRET, SESSION_SECRET, MASTER_KEY)
   - Подключит DATABASE_URL к базе автоматически

**Примерное время деплоя**: 5-8 минут (Docker build API может занять до 5 минут)

---

## 🛠️ Ручной деплой (если Blueprint не работает)

Если по какой-то причине Blueprint провалился, можно создать сервисы вручную:

### Шаг 1: Создай PostgreSQL базу

1. Render Dashboard → **New** → **PostgreSQL**
2. Name: `nodeweaver-db`
3. Database: `nodeweaver`
4. User: `nodeweaver`
5. Region: **Frankfurt** (или ближайший)
6. Plan: **Free**
7. **Create Database**
8. После создания скопируй **Internal Connection String**: `postgresql://nodeweaver:...@...`

### Шаг 2: Создай API сервис (Docker)

1. Render Dashboard → **New** → **Web Service**
2. Connect repository: `lupodelvita/penis-mishu-i-moi`
3. **Настройки**:
   - **Name**: `nodeweaver-api`
   - **Region**: Frankfurt
   - **Branch**: main
   - **Root Directory**: `apps/api`
   - **Environment**: **Docker**
   - **Dockerfile Path**: `Dockerfile` (относительно Root Directory)
   - **Plan**: Free
4. **Advanced Settings**:
   - **Health Check Path**: `/health`
   - **Auto-Deploy**: Yes
5. **Environment Variables** → Add:
   ```bash
   PORT=4000
   NODE_ENV=production
   DATABASE_URL=<вставь Internal Connection String из Шага 1>
   JWT_SECRET=<сгенерируй 32+ символов случайной строки>
   SESSION_SECRET=<сгенерируй 32+ символов случайной строки>
   MASTER_KEY=<сгенерируй 32+ символов случайной строки>
   ```
6. **Create Web Service**

**Генерация секретов (в PowerShell)**:
```powershell
# Генерируй 3 разных ключа для JWT_SECRET, SESSION_SECRET, MASTER_KEY
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

### Шаг 3: Создай Web сервис (Node.js)

1. Render Dashboard → **New** → **Web Service**
2. Connect repository: `lupodelvita/penis-mishu-i-moi`
3. **Настройки**:
   - **Name**: `nodeweaver-web`
   - **Region**: Frankfurt
   - **Branch**: main
   - **Root Directory**: `apps/web`
   - **Environment**: **Node**
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free
4. **Environment Variables** → Add:
   ```bash
   NEXT_PUBLIC_API_URL=https://nodeweaver-api.onrender.com
   NODE_ENV=production
   ```
   ⚠️ **ВАЖНО**: замени `nodeweaver-api` на фактическое имя твоего API сервиса из Шага 2
5. **Create Web Service**

## 📋 Что создастся автоматически:

### 1. PostgreSQL Database (`nodeweaver-db`)
- **Plan**: Free
- **Region**: Frankfurt  
- **Автосоздание**: База данных создастся первой
- **Connection String**: автоматически подтянется в API через `DATABASE_URL`

### 2. API Service (`nodeweaver-api`) — Docker
- **Type**: Web Service (**Docker**)
- **Dockerfile**: `apps/api/Dockerfile`
- **Root Directory**: `apps/api`
- **Port**: 4000
- **Health Check**: `/health`
- **Auto Deploy**: да (при push в main)
- **Build Command**: Docker build (из Dockerfile)
- **Start Command**: `npx prisma migrate deploy && npm start` (из Dockerfile CMD)
- **Features**:
  - ✅ Docker: nmap, whois, dnsutils установлены
  - ✅ WebSocket: real-time collaboration работает
  - ✅ Prisma migrations: автоматически при старте контейнера
  - ✅ OSINT tooling: все сервисы работают
  - ✅ Python + build tools: для native модулей

### 3. Web Service (`nodeweaver-web`) — Node.js
- **Type**: Web Service (**Node.js**)
- **Root Directory**: `apps/web`
- **Build Command**: `npm install && npx prisma generate && npm run build`
- **Start Command**: `npm start`
- **Auto Deploy**: да (при push в main)
- **Environment**:
  - `NEXT_PUBLIC_API_URL`: автоматически указывает на `https://nodeweaver-api.onrender.com`
  - `NODE_ENV`: production

## ⚙️ Environment Variables (автогенерация)

Render автоматически создаст все переменные из `render.yaml`:

```bash
# API Service
DATABASE_URL=postgresql://... (из nodeweaver-db)
JWT_SECRET=<auto-generated>
SESSION_SECRET=<auto-generated>
MASTER_KEY=<auto-generated>
PORT=4000
NODE_ENV=production

# Web Service  
NEXT_PUBLIC_API_URL=https://nodeweaver-api.onrender.com
```

## 🔐 Опциональные API ключи (добавь вручную)

После создания сервисов, добавь OSINT API ключи в Dashboard:

1. Render Dashboard → `nodeweaver-api` → **Environment**
2. Добавь переменные:

```bash
# Shodan
SHODAN_API_KEY=your_key

# VirusTotal
VIRUSTOTAL_API_KEY=your_key

# Hunter.io
HUNTER_API_KEY=your_key

# Have I Been Pwned
HIBP_API_KEY=your_key

# SecurityTrails
SECURITYTRAILS_API_KEY=your_key
```

3. **Save Changes** → Render автоматически редеплоит

## ✅ Проверка деплоя

### 1. Проверь логи
```bash
# Render Dashboard → nodeweaver-api → Logs
```

Должен увидеть:
```
✓ Migrations deployed successfully
✓ Server running on port 4000
✓ Health check passed
```

### 2. Тест API
```bash
curl https://nodeweaver-api.onrender.com/health
# Ответ: {"status":"ok","timestamp":"2026-02-15T..."}
```

### 3. Тест frontend
Открой в браузере: `https://nodeweaver-web.onrender.com`

### 4. Тест Docker фич (Nmap)
1. Зайди на frontend
2. Создай IP entity: `8.8.8.8`
3. Nmap Quick Scan → **должно работать!**

### 5. Тест WebSocket (Collaboration)
1. Открой два браузера рядом
2. Зайди на один граф
3. CollaborationPanel → **должно показать "Онлайн"**
4. Добавь entity в одном браузере → второй видит real-time

## 🐛 Troubleshooting

### Проблема: "Build failed" на API
**Причина**: Docker build упал

**Решение**:
1. Render Dashboard → nodeweaver-api → **Manual Deploy** → **Clear build cache & deploy**
2. Проверь логи билда — должен пройти все RUN команды из Dockerfile

### Проблема: "Database connection failed"
**Причина**: `DATABASE_URL` неправильный

**Решение**:
1. Dashboard → nodeweaver-db → **Connection** → скопируй Internal Connection String
2. Dashboard → nodeweaver-api → Environment → проверь `DATABASE_URL`
3. Должен быть формат: `postgresql://user:pass@host:5432/nodeweaver`

### Проблема: Web не подключается к API
**Причина**: `NEXT_PUBLIC_API_URL` неправильный

**Решение**:
1. Dashboard → nodeweaver-api → скопируй URL (например `https://nodeweaver-api.onrender.com`)
2. Dashboard → nodeweaver-web → Environment → `NEXT_PUBLIC_API_URL`
3. Убедись что **БЕЗ** trailing slash
4. Save Changes → redeploy

### Проблема: "Free instance spun down"
**Причина**: Render Free tier засыпает после 15 минут неактивности

**Решение**:
- Первый запрос после сна занимает ~30 секунд (cold start)
- Для production: апгрейд на Starter plan ($7/month) — инстанс всегда активен
- Или используй [UptimeRobot](https://uptimerobot.com) для пинга каждые 5 минут

## 💰 Pricing

**Free Tier (текущий):**
- ✅ 750 часов/месяц на все сервисы
- ✅ PostgreSQL 1GB
- ⚠️ Спит после 15 минут неактивности
- ⚠️ Холодный старт ~30 секунд

**Starter Plan ($7/month на сервис):**
- ✅ Всегда активен (no sleep)
- ✅ Больше CPU/RAM
- ✅ Приоритетный билд

**Рекомендация для production:**
- API: Starter ($7) — критично для real-time WebSocket
- Web: Free — статика работает нормально на Free tier
- DB: Free — 1GB достаточно для начала

## 🔄 Auto Deployments

Render автоматически деплоит при push в `main`:

```bash
git add .
git commit -m "feature: new OSINT service"
git push origin main
```

→ Render автоматически:
1. Билдит новый Docker image (API)
2. Билдит Next.js production (Web)
3. Запускает Prisma migrations
4. Деплоит новую версию
5. Health checks → переключает трафик

## 🎯 Итог

**Render (Production Ready):**
- ✅ Docker: nmap, whois, всё работает
- ✅ WebSocket: real-time collaboration
- ✅ PostgreSQL: managed database
- ✅ Auto deployments: при каждом push
- ✅ SSL/HTTPS: автоматически
- ✅ Health checks: zero-downtime deploys
- 💰 Free tier: отличный для MVP

**vs Vercel/Railway:**
- 🆚 Vercel: нет Docker, нет WebSocket → не подходит
- 🆚 Railway: отличный, но дорогой ($5/месяц minimum)
- ✅ Render: лучший баланс функций и цены для NodeWeaver

**Готово к использованию! 🚀**
