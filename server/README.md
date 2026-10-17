# AI Mock Interview Platform — Backend Server

Production-ready REST API built with **Node.js · TypeScript · Express · PostgreSQL · Google Gemini**.

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- Redis 7+
- Google Gemini API Key ([get one here](https://aistudio.google.com/app/apikey))

### 1. Install dependencies
```bash
cd server
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Edit `.env` and fill in:
- `DATABASE_URL` — your PostgreSQL connection string
- `REDIS_URL` — your Redis connection string
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — random 32+ char strings
- `GEMINI_API_KEY` — your Google Gemini API key

### 3. Create the database
```bash
# In PostgreSQL:
createdb interview_db
# Then run the migration:
psql -d interview_db -f migrations/001_initial_schema.sql
```

### 4. Start development server
```bash
npm run dev
```
Server runs at `http://localhost:3001`

---

## API Overview

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | ❌ | Register new user |
| POST | `/api/auth/login` | ❌ | Login and get JWT |
| POST | `/api/auth/refresh` | ❌ | Rotate refresh token |
| GET | `/api/user/dashboard` | ✅ | User stats & history |
| GET | `/api/questions` | ✅ | List/filter questions |
| POST | `/api/interviews/start` | ✅ | Start interview session |
| POST | `/api/interviews/submit-answer` | ✅ | Submit answer (AI async) |
| POST | `/api/interviews/:id/complete` | ✅ | Mark interview complete |
| GET | `/api/interviews/:id/results` | ✅ | Get AI feedback results |
| GET | `/health` | ❌ | Health check |

All protected routes require: `Authorization: Bearer <access_token>`

---

## Project Structure

```
server/
├── src/
│   ├── app.ts                 # Express app + server bootstrap
│   ├── config/
│   │   ├── database.ts        # PostgreSQL pool + query helpers
│   │   └── redis.ts           # Redis client + cache helpers
│   ├── middleware/
│   │   ├── auth.middleware.ts # JWT verification
│   │   ├── validate.middleware.ts # Zod request validation
│   │   └── errorHandler.ts    # Global error handler
│   ├── modules/
│   │   ├── auth/              # Register, login, token refresh
│   │   ├── user/              # Dashboard
│   │   ├── questions/         # Question listing with cache
│   │   └── interview/         # Session management + AI integration
│   ├── ai/
│   │   ├── promptBuilder.ts   # Gemini prompt engineering
│   │   ├── geminiClient.ts    # API client with retry
│   │   └── responseParser.ts  # Zod-validated JSON parsing
│   ├── utils/logger.ts        # Winston structured logger
│   └── types/index.ts         # Shared TypeScript interfaces
├── migrations/
│   └── 001_initial_schema.sql # Full schema + seed data
├── .env.example
├── Dockerfile
├── package.json
└── tsconfig.json
```

## Production Build
```bash
npm run build
npm start
```

## Docker
```bash
docker build -t interview-backend .
docker run -p 3001:3001 --env-file .env interview-backend
```
