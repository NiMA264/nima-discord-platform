# Dashboard v1 (Phase 3A)

## Scope
Current dashboard capabilities:
- Discord OAuth login
- Session handling
- Minimal protected layout
- Server/Guild list view
- Project list view
- Project detail view
- Activity feed view
- Task overview
- Sprint overview
- API client boundary (`src/lib/apiClient.js`)

It intentionally excludes edit flows, drag and drop, realtime updates, analytics, kanban, and AI widgets.

## Setup
1. Install dependencies:
```bash
cd dashboard
npm install
```
2. Copy env template:
```bash
copy .env.example .env
```
3. Fill required values:
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI` (must match Discord OAuth app config)
- `DASHBOARD_SESSION_SECRET`

## Run
```bash
npm run dev
```
Open: [http://localhost:3100](http://localhost:3100)

## OAuth Flow
1. User opens `/login`.
2. Dashboard creates `state` and redirects to Discord authorize endpoint.
3. Discord returns to `/auth/discord/callback`.
4. Dashboard verifies `state`, exchanges `code` for token, stores session.
5. Protected routes read data through API boundaries.

## Boundary Rules
- Dashboard does not perform domain decisions.
- Dashboard views only consume API/service boundaries.
- Dashboard has no direct database access in UI routes/components.
