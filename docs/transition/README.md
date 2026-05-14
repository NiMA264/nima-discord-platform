# Transition Backlog Exports

## Files
- `docs/transition/jira-transition-backlog.csv`
- `docs/transition/linear-transition-backlog.csv`

## Included scope
- Governance-compatible field set (Pflichtfelder + Zusatzfelder)
- Week 1-3 initial fill for critical path
- DRI / Secondary / Approval placeholders

## Import notes
- Jira: map `Issue Type`, `Summary`, `Description`, `Parent Summary`, and custom fields.
- Linear: import as CSV and map `Title`, `Description`, `Project`, `Parent`, labels and custom fields.
- Recommended first pass: import Epics/Stories first, then Tasks if your tool requires strict parent IDs.

## Priority order (Week 1-3)
1. API Auth Enforcement
2. Session Hardening
3. Test DB Isolation
4. Clock/UUID Abstractions
5. Release Gates
6. ADR-001 Persistence
7. ADR-002 Runtime Split
8. Separate Entrypoints
9. Health/Readiness
10. Constraint Test Baseline
