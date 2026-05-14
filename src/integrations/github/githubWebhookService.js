const crypto = require('crypto');
const githubRepositoryMappingRepository = require('../../repositories/githubRepositoryMappingRepository');
const githubWebhookDeliveryRepository = require('../../repositories/githubWebhookDeliveryRepository');
const domainEventService = require('../../domain/events/domainEventService');
const metrics = require('../../lib/metrics');
const { info } = require('../../utils/logger');

const deliveryCache = new Map();

function pruneDeliveryCache(nowMs) {
    for (const [deliveryId, expiresAt] of deliveryCache.entries()) {
        if (expiresAt <= nowMs) deliveryCache.delete(deliveryId);
    }
}

function cacheDeliveryId(deliveryId, ttlSeconds) {
    const nowMs = Date.now();
    pruneDeliveryCache(nowMs);
    deliveryCache.set(deliveryId, nowMs + (ttlSeconds * 1000));
}

function isDeliveryInCache(deliveryId, ttlSeconds) {
    const nowMs = Date.now();
    pruneDeliveryCache(nowMs);
    const expiresAt = deliveryCache.get(deliveryId);
    if (!expiresAt) return false;
    if (expiresAt <= nowMs) {
        deliveryCache.delete(deliveryId);
        return false;
    }
    // extend on hit to guard rapid retries
    cacheDeliveryId(deliveryId, ttlSeconds);
    return true;
}

function verifySignature(rawBody, signatureHeader, secret) {
    if (!secret) return true;
    const signature = String(signatureHeader || '');
    if (!signature.startsWith('sha256=')) return false;
    const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody || '').digest('hex')}`;
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (sigBuffer.length !== expectedBuffer.length) return false;
    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

function normalizeGithubDomainEventType(eventName, body) {
    if (eventName === 'push') return 'github.push';
    if (eventName === 'pull_request' && String(body?.action || '') === 'opened') return 'github.pull_request.opened';
    if (eventName === 'issues' && String(body?.action || '') === 'opened') return 'github.issue.opened';
    return null;
}

function buildEventMetadata(body, deliveryId) {
    return {
        deliveryId: String(deliveryId || ''),
        repositoryFullName: body?.repository?.full_name || '',
        sender: body?.sender?.login || '',
        action: body?.action || '',
        ref: body?.ref || '',
        pullRequestNumber: body?.pull_request?.number || null,
        issueNumber: body?.issue?.number || null,
        url: body?.pull_request?.html_url || body?.issue?.html_url || body?.compare || body?.repository?.html_url || ''
    };
}

function extractOccurredAt(eventName, body) {
    if (eventName === 'push') {
        return body?.head_commit?.timestamp || body?.repository?.updated_at || '';
    }
    if (eventName === 'pull_request') {
        return body?.pull_request?.updated_at || body?.pull_request?.created_at || '';
    }
    if (eventName === 'issues') {
        return body?.issue?.updated_at || body?.issue?.created_at || '';
    }
    return '';
}

function isOlderThanWindow(occurredAt, maxAgeSeconds) {
    const ts = Date.parse(String(occurredAt || ''));
    if (!Number.isFinite(ts)) return false;
    return (Date.now() - ts) > (maxAgeSeconds * 1000);
}

function replayResponse(message) {
    return { ok: true, statusCode: 202, message };
}

async function ingestGithubWebhookSignal({ headers = {}, rawBody = '', body = {}, webhookSecret }) {
    const eventName = String(headers['x-github-event'] || '');
    if (!eventName) {
        return { ok: false, statusCode: 400, message: 'Missing x-github-event header' };
    }

    const isValid = verifySignature(rawBody, headers['x-hub-signature-256'], webhookSecret);
    if (!isValid) {
        return { ok: false, statusCode: 401, message: 'Invalid webhook signature' };
    }

    const deliveryId = String(headers['x-github-delivery'] || '').trim();
    if (!deliveryId) {
        return { ok: false, statusCode: 400, message: 'Missing x-github-delivery header' };
    }

    const replayCacheTtlSeconds = Number(process.env.GITHUB_WEBHOOK_REPLAY_CACHE_TTL_SECONDS || 900);
    if (isDeliveryInCache(deliveryId, replayCacheTtlSeconds)) {
        metrics.increment('webhook_delivery_deduplicated_total', 1, { source: 'github', reason: 'cache' });
        metrics.increment('webhook_replay_rejected_total', 1, { source: 'github', reason: 'cache' });
        return replayResponse('Replay detected (delivery id cache hit)');
    }

    const eventType = normalizeGithubDomainEventType(eventName, body);
    if (!eventType) {
        return { ok: true, statusCode: 202, message: 'Event ignored (unsupported type/action)' };
    }

    const maxAgeSeconds = Number(process.env.GITHUB_WEBHOOK_MAX_AGE_SECONDS || 86400);
    const occurredAt = extractOccurredAt(eventName, body);
    if (isOlderThanWindow(occurredAt, maxAgeSeconds)) {
        metrics.increment('webhook_replay_rejected_total', 1, { source: 'github', reason: 'stale_timestamp' });
        return replayResponse('Replay rejected (event timestamp outside allowed window)');
    }

    const repositoryFullName = String(body?.repository?.full_name || '').trim();
    if (!repositoryFullName) {
        return { ok: false, statusCode: 400, message: 'Missing repository full name' };
    }

    const workspaceId = githubRepositoryMappingRepository.findWorkspaceIdByRepositoryFullName(repositoryFullName);
    if (!workspaceId) {
        return { ok: true, statusCode: 202, message: 'Event ignored (repository not mapped)' };
    }

    const deliveryRegistration = githubWebhookDeliveryRepository.registerDelivery({
        deliveryId,
        eventName,
        repositoryFullName,
        workspaceId,
        firstSeenAt: new Date().toISOString()
    });
    if (!deliveryRegistration.inserted) {
        metrics.increment('webhook_delivery_deduplicated_total', 1, { source: 'github', reason: 'persistent' });
        metrics.increment('webhook_replay_rejected_total', 1, { source: 'github', reason: 'persistent' });
        cacheDeliveryId(deliveryId, replayCacheTtlSeconds);
        return replayResponse('Replay detected (delivery id already persisted)');
    }

    cacheDeliveryId(deliveryId, replayCacheTtlSeconds);

    const domainEvent = domainEventService.recordDomainEvent({
        workspaceId,
        type: eventType,
        entityType: 'repository',
        entityId: repositoryFullName,
        metadata: buildEventMetadata(body, deliveryId)
    });
    info('GitHub webhook accepted', { eventType, deliveryId, repositoryFullName, workspaceId });

    return {
        ok: true,
        statusCode: 202,
        message: 'Event ingested',
        eventUid: domainEvent.eventUid
    };
}

module.exports = {
    ingestGithubWebhookSignal,
    normalizeGithubDomainEventType,
    verifySignature
};
