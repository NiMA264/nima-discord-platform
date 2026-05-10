# Alpha Release Checklist (v0.1.0)

## Preconditions
- Clean working tree for release files only.
- `.env` present with required runtime values.
- Database backup created before migration.

## Release Gate
Run in order:

```bash
npm ci
npm test
npx prisma validate
npx prisma migrate deploy
node src/deploy-commands.js
npm start
```

Pass criteria:
- Tests green.
- Prisma validation and migrations successful.
- Slash command deployment successful.
- Runtime reaches ready log state without startup errors.

## Test Guild Smoke Flow
Execute in a dedicated test guild:

1. `/setup channels`
2. `/help publish`
3. `/project create`
4. `/task create`
5. `/sprint start`
6. `/project feed`
7. `/ai summarize project`
8. `/ai changelog`
9. `/project repair`

Pass criteria:
- Setup stores channel IDs and help publish posts in configured help channel (or current channel fallback).
- Project/task/sprint lifecycle commands execute successfully.
- Feed and AI summaries return deterministic output when AI is unavailable.
- Repair reports integrity state and proposed fixes.

## Rollback Notes
- If migration fails: restore DB backup and rerun previous version.
- If slash command deploy fails: fix token/scope and redeploy commands.
- If runtime fails: inspect startup logs, environment validation output, and recent release commit.
