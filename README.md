# NiMa Discord Platform

Discord-native developer collaboration platform with project lifecycle, role-based permissions, GitHub event ingestion, activity feeds, and AI-assisted summaries.

## Highlights
- Persistent project domain (`projects`, members, tasks, milestones, logs)
- DB-first command flow (Discord is client, DB is source of truth)
- Role guard (`PROJECT_LEAD`, `MAINTAINER`, `REVIEWER`, `CONTRIBUTOR`)
- GitHub webhook ingest with normalized activity events
- Queue/worker runtime for async processing
- Reconciliation + repair flows for Discord↔DB integrity
- Notification pipeline via `NotificationService`
- Dashboard v1 scaffold with Discord OAuth boundary
- Help/setup onboarding (`/setup channels`, `/help publish`)

## Support Server Requirement
Bot usage is gated by support-server membership.

- Official invite: https://discord.gg/AXdpsawDYE
- Users not in the support server receive an ephemeral access message with invite link.
- Purpose: updates, help, setup guidance, and incident communication.

## Architecture
```txt
Discord Client / Dashboard Client
    -> Command/API Layer
    -> Service Layer
    -> Repository Layer
    -> Persistence (SQLite/Prisma)
    -> Queue + Workers
    -> Integrations (GitHub, AI)
```

## Repository Layout
- `src/commands/` slash commands (`/project`, `/task`, `/sprint`, `/ai`, `/setup`, `/help`)
- `src/services/` domain orchestration and boundaries
- `src/repositories/` persistence access
- `src/workers/` async workers
- `src/integrations/` external ingress/egress
- `src/database/`, `prisma/` schema + migrations
- `dashboard/` web client (Phase 3A)
- `docs/` runbooks and operational checklists
- `test/` vitest test suite

## Prerequisites
- Node.js 20+
- npm 10+
- Discord bot application

## Environment
Create `.env`:

```env
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_GUILD_ID=...
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY=...
SUPPORT_GUILD_ID=...
SUPPORT_INVITE_URL=https://discord.gg/...
GITHUB_WEBHOOK_ENABLED=false
GITHUB_WEBHOOK_SECRET=...
```

Notes:
- `OPENAI_API_KEY` is optional; AI commands fall back to deterministic summaries.
- `SUPPORT_GUILD_ID` is optional; when set, bot commands require membership in that support guild.
- Recommended invite for production: `https://discord.gg/AXdpsawDYE`
- If `GITHUB_WEBHOOK_ENABLED=true`, `GITHUB_WEBHOOK_SECRET` is required.

## Bot/App Description Copy
Use this copy in both bot description and Discord application description:

`NiMa is a Discord-native developer collaboration platform (projects, tasks, sprints, AI summaries). Support-server membership is required for usage: https://discord.gg/AXdpsawDYE`

## Local Development
```bash
npm ci
npm test
npx prisma validate
npx prisma migrate deploy
node src/deploy-commands.js
npm start
```

## Core Commands
- `/setup channels`
- `/help publish`
- `/project create`, `/project log`, `/project feed`, `/project repair`
- `/project member add`, `/project member remove`, `/project archive`
- `/task create`, `/task assign`, `/task close`
- `/sprint start`, `/sprint close`
- `/ai summarize project`, `/ai changelog`, `/ai blockers`

## Release
- Alpha checklist: `docs/alpha-release-checklist.md`
- Runbook: `docs/phase-2-release-runbook.md`
- Startup checklist: `docs/operations/production-startup-checklist.md`

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security
See [SECURITY.md](SECURITY.md).

## License
MIT
