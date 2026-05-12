# Event: github.issue.opened

- Contract version: `v1`
- Event type: `github.issue.opened`
- Producer: `src/integrations/github/githubWebhookService.js`
- Persisted in: `domain_events`

## Trigger

GitHub webhook `issues` events where `action` is `opened` for mapped repositories.

## Envelope/Payload Shape

Persisted metadata keys (required by contract):

- `deliveryId`
- `repositoryFullName`
- `sender`
- `action`
- `issueNumber`
- `url`

Optional metadata keys:

- `ref`
- `pullRequestNumber`

## Consumers

- Projection runtime via registry mapping (`github.issue.opened`)
- GitHub insights read-model derivation

## Projection Impact

- increments repository activity counts
- increments `contributionCounts.issuesOpened`
- contributes to recent GitHub events list

## Version History

- `v1`: initial contract and projection support
