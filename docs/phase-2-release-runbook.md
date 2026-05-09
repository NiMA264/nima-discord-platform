# Phase 2 Release Runbook

## Scope
This runbook covers the Phase 2 release flow for the Discord platform runtime without dashboard scope.

## Preconditions
- `.env` is present and validated at startup.
- Database is reachable via `DATABASE_URL`.
- Bot token and guild command credentials are valid.
- If GitHub webhook ingestion is enabled, `GITHUB_WEBHOOK_SECRET` is set.

## Release Steps
1. Install dependencies
```bash
npm ci
```
2. Run tests
```bash
npm test
```
3. Deploy slash commands
```bash
node src/deploy-commands.js
```
4. Run database migration
```bash
npx prisma migrate deploy
```
5. Start bot runtime
```bash
npm start
```

## Webhook Secret Verification
- Ensure GitHub webhook is configured with `sha256` signature.
- Ensure secret in GitHub equals `GITHUB_WEBHOOK_SECRET` in runtime env.
- Verify endpoint path is `/github/webhook` and method is `POST`.

## GitHub Event Ingest Check
1. Send test event (`push`, `pull_request`, `issues`) from GitHub webhook UI.
2. Confirm ingest response is `202`.
3. Confirm queue receives event.
4. Confirm worker writes a normalized `github.*` entry into `project_logs`.

## Smoke Flow
Run this user flow in a test guild:
1. `/project create`
2. `/task create`
3. `/ai summarize project`

Expected result:
- Project exists in persistence.
- Task is linked to project.
- Summary returns deterministic or AI output from normalized activity context.

## Rollback
If release validation fails:
1. Stop bot process.
2. Revert to previous stable runtime build/commit.
3. Restore previous environment values if changed.
4. If migration introduced incompatible schema behavior, restore DB backup and rerun prior release.
5. Redeploy previous slash commands if command contracts changed.
