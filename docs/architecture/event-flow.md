# Event Flow

## Architecture Rule

Read models are derived exclusively from persisted domain_events.

## End-to-End Flow

1. GitHub sends a webhook signal.
2. Ingestion verifies signature and maps repository to workspace.
3. Supported events are normalized to domain event types.
4. The event is persisted in `domain_events` with metadata.
5. Read-model services query persisted `domain_events` only.
6. API endpoints expose read-model output.
7. Dashboard consumes API responses.

## Scope of Ingestion

Current GitHub domain event types:

- `github.push`
- `github.pull_request.opened`
- `github.issue.opened`

Unsupported or unmapped events are intentionally acknowledged and ignored.

## Design Constraints

- No direct GitHub API calls in read-model computation.
- No state mutation inside dashboard paths.
- Read-model output must be reproducible from persisted events.
- Event metadata must stay sufficient for downstream projections.
