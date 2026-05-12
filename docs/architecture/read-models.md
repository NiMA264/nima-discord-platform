# Read Models

## Core Rule

Read models are derived exclusively from persisted domain_events.

## Intent

The analytics layer is a projection over immutable domain event history.
This keeps query paths deterministic, testable, and decoupled from external APIs.

## Query Rules

- Read models must not call external providers (GitHub, Discord, etc.).
- Read models may aggregate and filter persisted event streams.
- Read models may join internal mapping data when needed (for example repository-workspace mapping).
- If data is missing in `domain_events`, ingestion contracts must be expanded instead of adding live queries.

## Operational Benefits

- Deterministic results for a given persisted state.
- Reproducible historical and temporal analysis.
- Easier replay/backfill when introducing new projections.
- Stable testability with fixture event streams.

## Projection Guidance

`src/projections/analytics/` is reserved for projection-specific modules.
Initial rollout keeps current service/repository placement and avoids breaking changes.
