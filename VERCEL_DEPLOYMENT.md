# Инструкция деплоя на Vercel

## Структура проекта
NodeWeaver — это монорепо с двумя приложениями:
- **apps/api** — Express/Prisma backend
- **apps/web** — Next.js frontend

---

## Деплой apps/api (Backend)

### Шаг 1: Настройка на Vercel

1. Перейди на [vercel.com](https://vercel.com)
2. Нажми **"New Project"**
3. Выбери репозиторий NodeWeaver
4. В **Root Directory** установи: `apps/api`
5. Установи **Framework Preset**: `Express.js`
6. **Output Directory**: оставь `N/A` (или `dist`)

### Шаг 2: Build & Install Commands

В Vercel заполни эти поля:

- **Install Command:** `npm install --prefix ../.. && npm install`
- **Build Command:** `npx prisma generate && npm run build`

Остальное (Output Directory и т.д.) оставь как есть. **Start Command для Express на Vercel не требуется** — Vercel автоматически найдёт `npm start`.

### Шаг 3: Environment Variables

Добавь в **Environment Variables**:

```
DATABASE_URL=postgresql://user:password@host:5432/nodeweaver
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# API Keys (опционально, если нужны для OSINT)
SHODAN_API_KEY=
HUNTER_API_KEY=
VIRUSTOTAL_API_KEY=
GREYNOISE_API_KEY=
ABUSEIPDB_API_KEY=
SECURITYTRAILS_API_KEY=
CENSYS_API_ID=
BINARYEDGE_API_KEY=
FULLCONTACT_API_KEY=
CLEARBIT_API_KEY=
HIBP_API_KEY=
OATHNET_API_KEY=
ALIENVAULT_API_KEY=
IPGEOLOCATION_API_KEY=
EMAILREP_API_KEY=
PHISHTANK_API_KEY=
URLSCAN_API_KEY=

# Discord Bot (если используешь)
DISCORD_BOT_TOKEN=
DISCORD_WEBHOOK_URL=

# Email (если нужно)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=

# Session
SESSION_SECRET=your-session-secret-key
```

### Шаг 4: Команды после деплоя

После первого деплоя выполни в Vercel CLI или через Vercel Dashboard:

```bash
# Применить миграции к продакшн БД
npx prisma migrate deploy

# Если нужно заполнить данные
npx prisma db seed
```

---

## Деплой apps/web (Frontend)

### Шаг 1: Создай отдельный проект на Vercel

1. Нажми **"New Project"** (новый проект)
2. Выбери тот же репозиторий NodeWeaver
3. В **Root Directory** установи: `apps/web`
4. **Framework Preset** выберется автоматически как **Next.js** ✅

### Шаг 2: Build Commands

Vercel автоматически используется:
```
Install: npm install
Build: npm run build
```

### Шаг 3: Environment Variables

Добавь:

```
NEXT_PUBLIC_API_URL=https://your-api.vercel.app/api
# или если API на отдельном домене
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api

# Если нужны публичные ключи
NEXT_PUBLIC_SENTRY_DSN=
```

**ВАЖНО:** Переменные с префиксом `NEXT_PUBLIC_` доступны в браузере. Не добавляй туда секреты!

### Шаг 4: Проверь next.config.mjs

Убедись, что в `apps/web/next.config.mjs` есть:

```javascript
export default {
  reactStrictMode: true,
  swcMinify: true,
  // Если нужны редиректы/rewrite
  async rewrites() {
    return {
      fallback: [
        {
          source: '/api/:path*',
          destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/:path*`,
        },
      ],
    };
  },
};
```

---

## Деплой коннект между приложениями

### Вариант 1: Разные Vercel проекты (РЕКОМЕНДУЕТСЯ)

1. **Деплой API первым** (`apps/api`)
   - Получи его URL: `https://core-phi-mocha.vercel.app`

2. **Деплой Web вторым** (`apps/web`)
   - Установи `NEXT_PUBLIC_API_URL=https://core-phi-mocha.vercel.app/api`

3. Тестируй все API вызовы с корректным URL

### Вариант 2: Один Vercel проект (для root)

Если хочешь один проект для обоих приложений — нужен кастом `vercel.json`:

```json
{
  "buildCommand": "npm install && npm run build",
  "outputDirectory": "apps/web/.next",
  "installCommand": "npm install",
  "env": {
    "DATABASE_URL": "@DATABASE_URL",
    "JWT_SECRET": "@JWT_SECRET"
  },
  "functions": {
    "apps/api/**/*.ts": {
      "runtime": "nodejs18.x"
    }
  }
}
```

Не рекомендуется — сложно настраивать.

---

## Чек-лист перед деплоем

- [ ] DATABASE_URL указана и база доступна
- [ ] JWT_SECRET задан (сложный, 32+ символа)
- [ ] API и Web на корректных URL
- [ ] Миграции Prisma применены (`npx prisma migrate deploy`)
- [ ] Build локально работает (`npm run build`)
- [ ] Нет CI/CD ошибок в GitHub Actions
- [ ] .env.local не залит в git (в .gitignore)
- [ ] Все API ключи добавлены в Vercel (если нужны)
- [ ] CORS настроен для веб-приложения (если нужно)

---

## Если что-то сломалось

### API не запускается
```bash
# Проверь, есть ли dist папка
npx tsc --noEmit

# Переделай node_modules
rm -rf node_modules package-lock.json
npm install
npx prisma generate

# Запусти локально
npm run dev
```

### Web не строится
```bash
# Очистить Next.js cache
rm -rf .next
npm run build

# Проверить, что NEXT_PUBLIC_API_URL установлена
echo $NEXT_PUBLIC_API_URL
```

### Лог ошибок на Vercel
1. Открой проект на Vercel.com
2. Вкладка **"Deployments"**
3. Нажми на последний деплой
4. Вкладка **"Logs"** → смотри ошибки

---

## Продакшн оптимизация

### API (apps/api)
- Включи HTTPS только
- Настрой rate limiting (уже есть в коде)
- Логируй все ошибки
- Настрой CORS:
  ```javascript
  app.use(cors({
    origin: process.env.WEB_URL || 'https://yourdomain.com',
    credentials: true
  }));
  ```

### Web (apps/web)
- Включи Image Optimization на Vercel
- Настрой caching headers
- Добавь Sentry для ошибок (опционально)
- Проверь SEO мета-теги

---

## Как откатить деплой

На Vercel.com:
1. Деплойменты → выбери старую версию
2. Нажми **"Redeploy"**

Или через Vercel CLI:
```bash
vercel rollback
```

---

## Важные файлы

```
NodeWeaver/
├── apps/api/
│   ├── package.json          ← зависимости API
│   ├── prisma/
│   │   ├── schema.prisma      ← БД схема
│   │   └── migrations/        ← история миграций
│   ├── tsconfig.json
│   └── src/
│       └── index.ts           ← вход приложения
├── apps/web/
│   ├── package.json          ← зависимости Web
│   ├── next.config.mjs        ← конфиг Next.js
│   ├── tsconfig.json
│   └── src/
│       └── app/
│           └── layout.tsx     ← головной макет
└── VERCEL_DEPLOYMENT.md      ← этот файл
```

---

## Контакты поддержки

- **Vercel Docs**: https://vercel.com/docs
- **Prisma Docs**: https://www.prisma.io/docs
- **Next.js Docs**: https://nextjs.org/docs
