# Event: github.pull_request.opened

- Contract version: `v1`
- Event type: `github.pull_request.opened`
- Producer: `src/integrations/github/githubWebhookService.js`
- Persisted in: `domain_events`

## Trigger

GitHub webhook `pull_request` events where `action` is `opened` for mapped repositories.

## Envelope/Payload Shape

Persisted metadata keys (required by contract):

- `deliveryId`
- `repositoryFullName`
- `sender`
- `action`
- `pullRequestNumber`
- `url`

Optional metadata keys:

- `ref`
- `issueNumber`

## Consumers

- Projection runtime via registry mapping (`github.pull_request.opened`)
- GitHub insights read-model derivation

## Projection Impact

- increments repository activity counts
- increments `contributionCounts.pullRequestsOpened`
- contributes to recent GitHub events list

## Version History

- `v1`: initial contract and projection support
