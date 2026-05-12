# Event: github.push

- Contract version: `v1`
- Event type: `github.push`
- Producer: `src/integrations/github/githubWebhookService.js`
- Persisted in: `domain_events`

## Trigger

GitHub webhook `push` events for mapped repositories.

## Envelope/Payload Shape

Persisted metadata keys (required by contract):

- `deliveryId`
- `repositoryFullName`
- `sender`
- `ref`
- `url`

Optional metadata keys:

- `action`
- `pullRequestNumber`
- `issueNumber`

## Consumers

- Projection runtime via registry mapping (`github.push`)
- GitHub insights read-model derivation

## Projection Impact

- increments repository activity counts
- increments `contributionCounts.push`
- contributes to recent GitHub events list

## Version History

- `v1`: initial contract and projection support
