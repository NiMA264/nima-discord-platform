const domainEventRepository = require('../../repositories/domainEventRepository');

function recordDomainEvent({ workspaceId, type, entityType, entityId, metadata }) {
    return domainEventRepository.recordDomainEvent({
        workspaceId,
        type,
        entityType,
        entityId,
        metadata
    });
}

module.exports = {
    recordDomainEvent
};
