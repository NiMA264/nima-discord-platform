# Production Startup Checklist

## Configuration
- [ ] `DISCORD_TOKEN` set
- [ ] `DISCORD_CLIENT_ID` set
- [ ] `DISCORD_GUILD_ID` set
- [ ] `DATABASE_URL` set
- [ ] `OPENAI_API_KEY` optional (warn-only when missing)
- [ ] If `GITHUB_WEBHOOK_ENABLED=true`: `GITHUB_WEBHOOK_SECRET` set

## Startup Sequence
- [ ] Install dependencies: `npm ci`
- [ ] Run tests: `npm test`
- [ ] Deploy slash commands: `node src/deploy-commands.js`
- [ ] Run schema migration: `npx prisma migrate deploy`
- [ ] Start application: `npm start`

## Runtime Verification
- [ ] Bot logs in and reaches ready state
- [ ] No startup env validation errors
- [ ] Webhook server starts when enabled
- [ ] Worker loop starts without repeated failures

## Critical Smoke
- [ ] `/project create` succeeds
- [ ] `/task create` succeeds for the project
- [ ] `/ai summarize project` returns summary
- [ ] GitHub test webhook is accepted and processed into `project_logs`

## Rollback Triggers
- [ ] Command deploy failure
- [ ] Migration failure
- [ ] Repeating worker failures
- [ ] Webhook signature validation mismatch

## Rollback Actions
- [ ] Stop runtime
- [ ] Roll back to last stable commit/build
- [ ] Restore previous env config
- [ ] Restore DB backup if required
