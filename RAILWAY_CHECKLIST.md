## Railway Deployment Checklist ✅

### Шаг 1: Сгенерировать секреты
```bash
cd apps/api
node generate-railway-secrets.js
```
Скопируй вывод — понадобится для Railway Variables.

---

### Шаг 2: Railway - Создать проект
1. ➡️ https://railway.app → Login with GitHub
2. 🆕 **New Project** → **Deploy from GitHub repo**
3. 🔍 Выбери репозиторий: `lupodelvita/penis-mishu-i-moi`
4. ⚙️ Railway автоматически определит Dockerfile

---

### Шаг 3: Railway - Настроить Root Directory
1. Открой проект на Railway
2. **Settings** → **Build & Deploy**
3. **Root Directory**: `apps/api` ⬅️ **ВАЖНО!**
4. **Watch Paths**: `apps/api/**` (опционально)
5. 💾 Save Changes

---

### Шаг 4: Railway - Environment Variables
1. **Variables** tab → **New Variable**
2. Вставь переменные из Шага 1:
   ```bash
   JWT_SECRET=... (из generate-railway-secrets.js)
   SESSION_SECRET=... (из generate-railway-secrets.js)
   MASTER_KEY=... (из generate-railway-secrets.js)
   PORT=4000
   NODE_ENV=production
   ```

3. **Database URL** (один из вариантов):
   
   **A) Использовать существующий Neon PostgreSQL:**
   - Скопируй `DATABASE_URL` из Vercel Dashboard
   - Вставь в Railway Variables
   
   **B) Создать Railway PostgreSQL:**
   - Railway проект → **New** → **Database** → **Add PostgreSQL**
   - Railway сам создаст переменную `DATABASE_URL`
   
   **C) Другая PostgreSQL:**
   - Вставь свой `DATABASE_URL`

4. **Frontend CORS** (опционально):
   ```bash
   FRONTEND_URL=https://penis-mishu-i-moi-web.vercel.app
   ```
   (CollaborationService уже имеет wildcard CORS, но для production лучше явно указать)

5. **OSINT API Keys** (опционально - добавь если есть):
   ```bash
   SHODAN_API_KEY=your_key
   VIRUSTOTAL_API_KEY=your_key
   HUNTER_API_KEY=your_key
   ```

---

### Шаг 5: Railway - Запустить деплой
1. 🚀 Railway автоматически запустит деплой после добавления переменных
2. 👀 Следи за логами: **Deployments** → последний деплой → **View Logs**
3. ⏱️ Ожидаемое время билда: ~5-8 минут

**Что должно произойти:**
```
✓ Building Docker image...
✓ Installing system dependencies (nmap, whois, dnsutils)...
✓ npm install...
✓ npm run build (TypeScript → JavaScript)
✓ prisma generate (Prisma Client)
✓ Starting container...
✓ Running migrations: npx prisma migrate deploy
✓ Server started on port 4000
✓ Health check passed ✓
```

---

### Шаг 6: Railway - Получить домен
1. **Settings** → **Networking**
2. **Generate Domain** → получишь: `your-project-production.up.railway.app`
3. 📋 **Скопируй этот домен!**

**Или подключи кастомный:**
- **Custom Domain** → `api.nodeweaver.io`
- Настрой DNS: CNAME → Railway домен

---

### Шаг 7: Vercel Web - Обновить API URL
1. ➡️ https://vercel.com → твой web проект
2. **Settings** → **Environment Variables**
3. Найди `NEXT_PUBLIC_API_URL`
4. **Edit**:
   ```bash
   # Старое значение:
   https://core-phi-mocha.vercel.app
   
   # Новое значение (Railway домен из Шага 6):
   https://your-project-production.up.railway.app
   ```
5. 💾 Save
6. 🔄 **Deployments** → **Redeploy** (выбери последний деплой → три точки → Redeploy)

---

### Шаг 8: Проверить работу

**8.1 Health Check:**
```bash
curl https://your-project-production.up.railway.app/health
# Должен вернуть: {"status":"ok","timestamp":"..."}
```

**8.2 API Endpoint:**
```bash
curl https://your-project-production.up.railway.app/api/auth/status
```

**8.3 Nmap (Docker feature - работает только на Railway!):**
1. Открой NodeWeaver frontend: https://penis-mishu-i-moi-web.vercel.app
2. Создай граф
3. Создай IP entity: `8.8.8.8`
4. Правый клик → **Security** → **Nmap Quick Scan**
5. **Должно работать!** (на Vercel API это выдавало ошибку)

**8.4 WebSocket (работает только на Railway!):**
1. Открой два браузера рядом
2. В обоих зайди на NodeWeaver → один граф
3. В CollaborationPanel справа → должно показать **Онлайн** (зеленая точка)
4. Попробуй добавить entity в одном браузере → второй браузер должен увидеть изменения real-time
5. **Работает!** (на Vercel Serverless WebSocket не поддерживается)

---

### Шаг 9: Git Push изменений

```bash
cd C:\Users\giuli\Desktop\progs\NodeWeaver

git add apps/api/railway.toml apps/api/.railwayignore apps/api/generate-railway-secrets.js RAILWAY_SETUP.md RAILWAY_CHECKLIST.md
git commit -m "feat: add Railway deployment config with Docker + WebSocket support"
git push origin HEAD
```

Railway автоматически задеплоит новую версию при push!

---

## Troubleshooting 🔧

### Проблема: "Migration failed"
**Причина:** DATABASE_URL неправильный или база недоступна

**Решение:**
1. Railway → Variables → проверь `DATABASE_URL`
2. Формат: `postgresql://user:pass@host:5432/dbname?sslmode=require`
3. Если Railway PostgreSQL: переменная должна быть автосоздана
4. Если Neon: убедись что IP Railway разрешен (Neon обычно разрешает все)

---

### Проблема: "Port already in use"
**Причина:** PORT неправильно прочитан

**Решение:**
1. Railway → Variables → `PORT=4000`
2. Убедись что в `src/index.ts` используется `process.env.PORT`
3. Redeploy

---

### Проблема: WebSocket не подключается
**Причина:** Frontend неправильный API URL

**Решение:**
1. Vercel Web → Environment Variables → `NEXT_PUBLIC_API_URL`
2. Должен быть Railway домен: `https://your-project.up.railway.app`
3. **БЕЗ trailing slash!**
4. Redeploy web на Vercel
5. Очисти кэш браузера (Ctrl+Shift+Del)

---

### Проблема: CORS ошибки
**Причина:** Vercel frontend не разрешен в Railway API

**Решение:**
Railway API уже имеет wildcard CORS (`*`), но для production:
1. Railway → Variables → добавь:
   ```bash
   FRONTEND_URL=https://penis-mishu-i-moi-web.vercel.app
   ```
2. Или обнови CORS в `src/index.ts`:
   ```typescript
   res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
   ```

---

### Проблема: Nmap не работает
**Причина:** Docker не установлен (маловероятно на Railway)

**Решение:**
1. Railway → Logs → проверь что Docker build прошел
2. Должна быть строка: `Installing nmap whois dnsutils`
3. SSH в контейнер (Railway → Shell):
   ```bash
   which nmap
   # Должен вернуть: /usr/bin/nmap
   ```

---

## Итоговая архитектура 🏗️

**Railway API (Production Backend):**
- ✅ Docker: nmap, whois, XSS fuzzer, SQL fuzzer
- ✅ WebSocket: real-time collaboration
- ✅ PostgreSQL: Neon или Railway DB
- ✅ OSINT APIs: Shodan, VirusTotal, Hunter
- 💰 $5/month (Hobby plan, 500 hours)

**Vercel Web (Production Frontend):**
- ✅ Next.js SSR/SSG
- ✅ CDN: global edge network
- ✅ Auto deployments
- 💰 Free (Hobby plan)

**Лучшее из обоих миров!** 🚀
- Railway → мощный backend с Docker
- Vercel → быстрый frontend на CDN
- WebSocket работает между ними
