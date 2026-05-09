# Dashboard v1 (Phase 3A / Commit 1)

## Scope
This scaffold provides:
- Discord OAuth login
- Session handling
- Minimal protected layout
- Server/Guild list view
- API client boundary (`src/lib/apiClient.js`)

It intentionally excludes project detail pages, activity feed views, role management UI, analytics, kanban, and AI UI.

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
5. Protected routes (`/app`, `/api/guilds`) read data through session.

## Architecture Boundary
Dashboard does not perform domain decisions.
Dashboard consumes boundary APIs/routes and OAuth client abstractions.
