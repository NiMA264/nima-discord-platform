const crypto = require('crypto');
const githubRepositoryMappingRepository = require('../../repositories/githubRepositoryMappingRepository');
const domainEventService = require('../../domain/events/domainEventService');

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

async function ingestGithubWebhookSignal({ headers = {}, rawBody = '', body = {}, webhookSecret }) {
    const eventName = String(headers['x-github-event'] || '');
    if (!eventName) {
        return { ok: false, statusCode: 400, message: 'Missing x-github-event header' };
    }

    const isValid = verifySignature(rawBody, headers['x-hub-signature-256'], webhookSecret);
    if (!isValid) {
        return { ok: false, statusCode: 401, message: 'Invalid webhook signature' };
    }

    const eventType = normalizeGithubDomainEventType(eventName, body);
    if (!eventType) {
        return { ok: true, statusCode: 202, message: 'Event ignored (unsupported type/action)' };
    }

    const repositoryFullName = String(body?.repository?.full_name || '').trim();
    if (!repositoryFullName) {
        return { ok: false, statusCode: 400, message: 'Missing repository full name' };
    }

    const workspaceId = githubRepositoryMappingRepository.findWorkspaceIdByRepositoryFullName(repositoryFullName);
    if (!workspaceId) {
        return { ok: true, statusCode: 202, message: 'Event ignored (repository not mapped)' };
    }

    const domainEvent = domainEventService.recordDomainEvent({
        workspaceId,
        type: eventType,
        entityType: 'repository',
        entityId: repositoryFullName,
        metadata: buildEventMetadata(body, headers['x-github-delivery'])
    });

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
