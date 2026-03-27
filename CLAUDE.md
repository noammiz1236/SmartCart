# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SmartCart** is an Israeli grocery price comparison and collaborative shopping list app. It supports family accounts, real-time list updates, barcode scanning, and price history tracking across Israeli retail chains.

## Commands

### Frontend (`frontend/`)
```bash
npm run dev      # Dev server on port 5173 (0.0.0.0)
npm run build    # Production build
npm run lint     # ESLint
npm run preview  # Preview production build
```

### Backend (`server/`)
```bash
node server.js          # Start backend on port 3000
npx nodemon server.js   # Auto-restart during development
```

### Database
```bash
docker-compose up -d    # Start PostgreSQL 16 + pgAdmin (port 8080)
```

### Production (PM2)
```bash
pm2 start ecosystem.config.cjs  # Start frontend + backend
pm2 monit                        # Monitor processes
```

## Environment Variables

**Backend (`server/.env`):**
```
PORT=3000
DATABASE_URL=postgresql://user:pass@host/dbname
JWT_SECRET=<64-byte-hex>
JWT_REFRESH_SECRET=<64-byte-hex>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=app-password
FRONTEND_URL=http://localhost:5173
LOG_LEVEL=info
```

**Frontend (`frontend/.env`):**
```
VITE_API_URL=http://localhost:3000
```

## Architecture

### Frontend (`frontend/src/`)
- **`App.jsx`** — main router; `PrivateRoute` with optional `parentOnly` flag blocks child accounts from Templates and FamilySettings pages
- **`context/AuthContext.jsx`** — JWT auth state; access token in localStorage, refresh token in httpOnly cookie; auto-refresh on 401
- **`context/ThemeContext.jsx`** — dark/light mode, persisted in localStorage
- **`api.js`** — Axios instance with request interceptor (injects Bearer token) and response interceptor (transparent token refresh)
- **`socket.js`** — Socket.io client for real-time list updates and notifications

### Backend (`server/`)
- **`server.js`** — Express + Socket.io entry point; mounts all routers, middleware stack: Morgan → CORS → JSON → cookies → rate limiter
- **`routes/auth.js`** — Register, login, refresh, logout, password reset, email verification
- **`routes/lists.js`** — Shopping list CRUD, members, items, activity log
- **`routes/family.js`** — Parent/child account management
- **`routes/products.js`** / **`simplified_products.js`** — Product catalog, search, barcode lookup
- **`middleware/auth.js`** — JWT verification; injects `req.userId`
- **`middleware/rateLimiter.js`** — Auth: 5 req/15min; search: 30 req/min

### Database (PostgreSQL, schemas `app` and `app2`)
- **`app2.users`** — accounts; `parent_id` for family hierarchy; `isLinkedChild` distinguishes child accounts
- **`app2.tokens`** — refresh token store with `used` flag (rotation prevents reuse)
- **`app.list` / `app.list_members` / `app.list_items`** — shopping lists with roles and per-item metadata (paid_by, note_by, assigned_to)
- **`app.items` / `app.prices` / `app.chains` / `app.branches`** — product catalog with price-per-chain-branch
- **`app.activity_log`** — list activity tracking
- Schema init: `Database/init.sql/init.sql`

### Authentication Flow
1. Login returns access token (15m JWT) + refresh token (7d, stored in DB and sent as httpOnly cookie)
2. Refresh token JWT contains `jti` matching a DB row; marked `used` after one use
3. `authenticateToken` middleware verifies access token and sets `req.userId`
4. Frontend auto-refreshes on 401 via Axios interceptor; session restored from localStorage on page load

### Key Patterns
- **Family accounts:** Parent account creates child accounts. `isLinkedChild` flag restricts access. Child shares lists with parent.
- **Real-time:** Socket.io emits list-update events; `NotificationBell` subscribes to user-specific rooms.
- **Product search:** `DISTINCT ON` + `ILIKE` PostgreSQL query; infinite scroll (offset/limit); recent searches in localStorage; barcode lookup via `html5-qrcode`.
- **Price history:** Stored per chain/branch in `app.prices`; visualized with Chart.js in `PriceHistoryChart`.
- **PWA:** Service worker registered in `index.html`; manifest in `public/`.
