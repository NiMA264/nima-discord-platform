# Transition Backlog Exports (Extended)

## New files
- `docs/transition/jira-transition-backlog-external-keys.csv`
- `docs/transition/jira-external-key-mapping-template.csv`
- `docs/transition/jira-phase3-parent-id-template.csv`

## Why this variant
- Stable external keys for reimports and automation
- Machine-readable migration marker values (e.g. `MIGRATION_PHASE=A`)
- Two-phase import support with parent ID mapping

## Additional governance fields (new)
- `Lifecycle State`: `PROPOSED|APPROVED|ACTIVE|BLOCKED|VALIDATING|RELEASED|RETIRED`
- `Change Risk Score`: `LOW|MEDIUM|HIGH|CRITICAL`
- `Rollback Verified`: `true|false`
- `Constraint Test ID`: stable link to architecture constraint enforcement

## Recommended two-phase Jira import
1. Import Initiatives/Epics/Stories from `jira-transition-backlog-external-keys.csv`.
2. Export Jira keys and fill `jira-external-key-mapping-template.csv` (`External Key -> Jira Key`).
3. Populate `Parent Jira ID` in `jira-phase3-parent-id-template.csv` and import Tasks/Subtasks.

## Governance fields included
- `Exit Criteria Ref`
- `Architecture Constraint Ref`
- `Audit Requirement`
- `Replay Safety Required`
- `Feature Freeze Exempt`
- `Runbook Required`
- `Risk` (`P0..P3`)
- `Migration Phase` (`MIGRATION_PHASE=A/B/C/D`)

## Dedicated auditability epic
- Added `Auditability Stream` as separate epic in Jira and Linear exports.
