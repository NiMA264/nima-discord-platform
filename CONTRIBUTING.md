# Contributing

## Workflow
1. Create a branch from `master`.
2. Keep changes scoped to one concern.
3. Run tests locally before opening a PR.
4. Open a pull request with clear context and validation notes.

## Development Gate
```bash
npm ci
npm test
npx prisma validate
```

## Commit Style
Use conventional commits where possible:
- `feat: ...`
- `fix: ...`
- `refactor: ...`
- `chore: ...`
- `docs: ...`
- `test: ...`

## PR Requirements
- Description of behavior change
- Risk assessment / rollback note
- Test evidence (commands + output summary)
- No unrelated file changes
