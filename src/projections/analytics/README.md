# Analytics Projections

This directory contains pure projection modules for analytics read models.

Architecture rule:

Projection runtime reads persisted `domain_events` and produces rebuildable read-model state.
It does not perform external API calls, writes, polling, or side effects.

Constraints:

- Projection functions are pure: `(state, event) => nextState`.
- Projection logic is idempotent and side-effect free.
- Runtime processes events in deterministic order.
- Unknown event types are skipped or collected and must not crash runtime.

Projection outputs are validated against versioned read-model contracts.
Validation is currently non-blocking and intended as an architectural guardrail.
