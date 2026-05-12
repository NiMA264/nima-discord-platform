# Domain Event Governance

## Architecture Invariants

- Events are immutable after persistence.
- Event types are stable and must not be renamed in place.
- Breaking changes require a new event contract version.
- Read models are derived exclusively from persisted `domain_events`.
- Projection logic must be idempotent.
- Payload evolution is additive-only within the same version.
- Read models must not depend on live external APIs.

## Event Naming Convention

- Pattern: `<bounded-context>.<entity-or-topic>[.<action>]`
- Examples:
  - `github.push`
  - `github.pull_request.opened`
  - `github.issue.opened`
- Names are append-only. Avoid renaming existing types.

## Contract Versioning

- Contracts are versioned under `src/domain/events/contracts/v{n}/`.
- Version changes are mandatory for breaking payload or semantics changes.
- Non-breaking additions:
  - adding optional payload/metadata fields
  - adding new event types
- Breaking changes:
  - changing meaning of existing fields
  - removing required fields
  - reusing an existing type for different semantics

## Deprecation Strategy

- Mark event type or field as deprecated in contract docs.
- Keep producers and consumers compatible during deprecation window.
- Introduce replacement event type/version before removal.
- Remove only after all projections/consumers migrate.

## Metadata Standard

Persisted event metadata should include enough context for deterministic projections.
Recommended metadata fields:

- `deliveryId`
- `repositoryFullName`
- `sender`
- `action`
- `ref`
- `url`

## Envelope Guidance (v1)

Envelope shape is defined in:
`src/domain/events/contracts/v1/event-envelope.schema.json`

Core fields:

- `eventId`
- `eventType`
- `eventVersion`
- `occurredAt`
- `source`
- `payload`

Current validator is non-breaking guardrail logic and should be adopted incrementally.
