# Render Deployment Guide — NodeWeaver (Ручной деплой)

Полный деплой NodeWeaver на Render с Docker и Node.js.

## 🎯 Обзор сервисов

1. **PostgreSQL Database** (`nodeweaver-db`) — база данных
2. **API Service** (`nodeweaver-api`) — Docker (nmap, whois, WebSocket)
3. **Web Service** (`nodeweaver-web`) — Node.js (Next.js frontend)

---

## 📋 Шаг 1: PostgreSQL Database

1. [Render Dashboard](https://dashboard.render.com) → **New** → **PostgreSQL**
2. **Настройки**:
   ```
   Name: nodeweaver-db
   Database: nodeweaver
   User: nodeweaver
   Region: Frankfurt (или ближайший)
   Plan: Free
   ```
3. **Create Database**
4. ✅ После создания скопируй **Internal Connection String**:
   ```
   postgresql://nodeweaver:password@dpg-xxxxx-a.frankfurt-postgres.render.com/nodeweaver
   ```
   ⚠️ Сохрани этот URL — понадобится для API сервиса!

---

## 📋 Шаг 2: API Service (Docker)

1. [Render Dashboard](https://dashboard.render.com) → **New** → **Web Service**
2. **Connect Repository**: `lupodelvita/penis-mishu-i-moi`
3. **Настройки**:

### Basic Settings:
```
Name: nodeweaver-api
Region: Frankfurt (тот же что и база)
Branch: main
```

### Build Settings:
```
Root Directory: apps/api
Runtime: Docker
```

⚠️ **ВАЖНО**: Render автоматически найдет `apps/api/Dockerfile` и использует команды из него:
- **Build**: `RUN npm install && npm run build` (из Dockerfile)
- **Start**: `CMD npx prisma migrate deploy && npm start` (из Dockerfile)

**НЕ НУЖНО** вводить Build Command или Start Command — Docker все делает сам!

### Advanced Settings:
```
Docker Build Context Directory: apps/api
Dockerfile Path: Dockerfile
Health Check Path: /health
Auto-Deploy: Yes
Plan: Free
```

### Environment Variables:

Добавь следующие переменные (**Environment** → **Add Environment Variable**):

```bash
# Database (скопируй из Шага 1)
DATABASE_URL=postgresql://nodeweaver:password@dpg-xxxxx.frankfurt-postgres.render.com/nodeweaver

# Server
PORT=4000
NODE_ENV=production

# Security (сгенерируй случайные строки 32+ символов)
JWT_SECRET=<генерируй ниже>
SESSION_SECRET=<генерируй ниже>
MASTER_KEY=<генерируй ниже>
```

**Генерация секретов в PowerShell**:
```powershell
# Запусти 3 раза для каждого ключа
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

**Опциональные OSINT API ключи** (добавь если есть):
```bash
SHODAN_API_KEY=your_shodan_key
VIRUSTOTAL_API_KEY=your_virustotal_key
HUNTER_API_KEY=your_hunter_key
HIBP_API_KEY=your_hibp_key
SECURITYTRAILS_API_KEY=your_securitytrails_key
```

4. **Create Web Service**
5. ⏳ Ожидай 5-8 минут пока Docker билдится
6. ✅ После деплоя скопируй URL сервиса:
   ```
   https://nodeweaver-api.onrender.com
   ```

---

## 📋 Шаг 3: Web Service (Node.js)

1. [Render Dashboard](https://dashboard.render.com) → **New** → **Web Service**
2. **Connect Repository**: `lupodelvita/penis-mishu-i-moi`
3. **Настройки**:

### Basic Settings:
```
Name: nodeweaver-web
Region: Frankfurt (тот же что и API)
Branch: main
```

### Build Settings:
```
Root Directory: (оставь пустым)
Runtime: Node
```

### Build & Start Commands:

**Build Command**:
```bash
cd apps/web && npm install && npx prisma generate && npm run build
```

**Start Command**:
```bash
cd apps/web && npm start
```

⚠️ **ВАЖНО**: `cd apps/web` нужен потому что Root Directory пустой (монорепо)

### Advanced Settings:
```
Auto-Deploy: Yes
Plan: Free
```

### Environment Variables:

Добавь переменные (**Environment** → **Add Environment Variable**):

```bash
# API URL (вставь URL из Шага 2)
NEXT_PUBLIC_API_URL=https://nodeweaver-api.onrender.com

# Environment
NODE_ENV=production
```

⚠️ **БЕЗ** trailing slash в `NEXT_PUBLIC_API_URL`!

4. **Create Web Service**
5. ⏳ Ожидай 3-5 минут (Next.js build)
6. ✅ После деплоя получишь URL:
   ```
   https://nodeweaver-web.onrender.com
   ```

---

## ✅ Проверка работы

### 1. API Health Check
```bash
curl https://nodeweaver-api.onrender.com/health
# Ответ: {"status":"ok","timestamp":"..."}
```

### 2. API Auth Status
```bash
curl https://nodeweaver-api.onrender.com/api/auth/status
# Ответ: {"authenticated":false}
```

### 3. Frontend
Открой в браузере: `https://nodeweaver-web.onrender.com`

### 4. Тест Docker (Nmap)
1. Зайди на frontend
2. Создай граф
3. Создай IP entity: `8.8.8.8`
4. Правый клик → **Security** → **Nmap Quick Scan**
5. ✅ Должно работать (Docker с nmap установлен)

### 5. Тест WebSocket (Collaboration)
1. Открой два окна браузера
2. Зайди на один граф в обоих
3. CollaborationPanel (справа) → должно показать **Онлайн** (зеленая точка)
4. Добавь entity в одном окне → второе видит real-time
5. ✅ WebSocket работает!

---

## 📝 Итоговая конфигурация

### API Service (nodeweaver-api):
```
Runtime: Docker
Root Directory: apps/api
Dockerfile: apps/api/Dockerfile (auto-detected)
Build: Docker RUN commands
Start: npx prisma migrate deploy && npm start
Health Check: /health
URL: https://nodeweaver-api.onrender.com
```

### Web Service (nodeweaver-web):
```
Runtime: Node
Root Directory: (empty - monorepo)
Build: cd apps/web && npm install && npx prisma generate && npm run build
Start: cd apps/web && npm start
URL: https://nodeweaver-web.onrender.com
```

### Database (nodeweaver-db):
```
Type: PostgreSQL
Database: nodeweaver
Plan: Free (1GB)
Connection: Internal (auto-secure)
```

---

## 🐛 Troubleshooting

### Проблема: API "Build failed"
**Причина**: Docker build упал

**Решение**:
1. Render Dashboard → nodeweaver-api → **Manual Deploy** → **Clear build cache & deploy**
2. Проверь логи билда — должны быть строки:
   ```
   ✓ Installing nmap, whois, dnsutils
   ✓ npm install
   ✓ npm run build
   ✓ Server running on port 4000
   ```

### Проблема: Web "Module not found: @prisma/client"
**Причина**: Забыл `npx prisma generate` в Build Command

**Решение**:
1. Settings → Build Command → исправь на:
   ```bash
   cd apps/web && npm install && npx prisma generate && npm run build
   ```
2. Redeploy

### Проблема: "Database connection refused"
**Причина**: Неправильный `DATABASE_URL`

**Решение**:
1. Render Dashboard → nodeweaver-db → **Info** → скопируй **Internal Connection String**
2. Render Dashboard → nodeweaver-api → **Environment** → обнови `DATABASE_URL`
3. **Save Changes** → redeploy

### Проблема: Web не подключается к API (CORS)
**Причина**: Неправильный `NEXT_PUBLIC_API_URL`

**Решение**:
1. Скопируй точный URL API: `https://nodeweaver-api.onrender.com`
2. Render Dashboard → nodeweaver-web → **Environment** → `NEXT_PUBLIC_API_URL`
3. Убедись что **БЕЗ** trailing slash
4. **Save Changes** → redeploy

### Проблема: "Service spun down" (Free tier)
**Причина**: Render Free засыпает после 15 минут неактивности

**Решение**:
- Первый запрос после сна: ~30 секунд холодного старта
- Для production: апгрейд на **Starter plan** ($7/месяц) — всегда активен
- Для бесплатного keep-alive: используй [UptimeRobot](https://uptimerobot.com) для пинга каждые 5 минут

---

## 🔄 Auto Deployments

После первой настройки Render автоматически деплоит при push:

```bash
git add .
git commit -m "feature: new OSINT transform"
git push origin main
```

→ Render автоматически:
1. Билдит Docker image (API)
2. Билдит Next.js production (Web)
3. Запускает migrations
4. Zero-downtime deploy

---

## 💰 Pricing

**Free Tier (текущий)**:
- ✅ 750 часов/месяц на все сервисы
- ✅ PostgreSQL 1GB
- ⚠️ Спит после 15 минут неактивности
- ⚠️ Холодный старт ~30 секунд

**Starter Plan ($7/месяц на сервис)**:
- ✅ Всегда активен (no sleep)
- ✅ Больше CPU/RAM
- ✅ Приоритетный билд

**Рекомендация**:
- API: **Starter** ($7) — критично для WebSocket
- Web: **Free** — статика быстрая и на Free tier
- DB: **Free** — 1GB достаточно

---

## 🎯 Готово!

Теперь у тебя:
- ✅ Docker API с nmap, whois, всеми OSINT инструментами
- ✅ WebSocket collaboration работает
- ✅ PostgreSQL база
- ✅ Next.js frontend
- ✅ Автоматические деплои
- ✅ HTTPS из коробки

**Production ready! 🚀**

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
