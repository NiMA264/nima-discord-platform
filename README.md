# NiMa Discord

Discord bot platform with project/task/sprint workflows, AI-assisted knowledge retrieval, and operational workers.

## Tech Stack
- Node.js (CommonJS)
- discord.js
- SQLite (`better-sqlite3`)
- OpenAI API
- Vitest

## Main Areas
- Bot runtime: `src/index.js`
- Commands: `src/commands/*`
- Systems/services: `src/systems/*`, `src/services/*`
- Persistence: `src/database/*`, `src/repositories/*`, `prisma/*`
- Dashboard: `dashboard/*`
- Tests: `test/*`

## Local Run
1. Install dependencies:
```bash
npm ci
```
2. Run tests:
```bash
npm test
```
3. Start in dev mode:
```bash
npm run dev
```

## Release Gate (Phase 2)
Follow:
- `docs/phase-2-release-runbook.md`
- `docs/operations/production-startup-checklist.md`

Expected gate sequence:
1. `npm ci`
2. `npm test`
3. `node src/deploy-commands.js`
4. `npx prisma migrate deploy`
5. `npm start`
