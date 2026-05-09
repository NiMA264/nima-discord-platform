import { describe, it, expect, vi, beforeEach } from 'vitest';

const service = await import('../src/services/notificationService.js');

describe('notificationService', () => {
    beforeEach(() => {
        service.clearNotificationAdapters();
    });

    it('dispatches domain events to registered adapters', async () => {
        const deliver = vi.fn(async () => {});
        service.registerNotificationAdapter({ name: 'test', deliver });

        await service.notifyDomainEvent('task.assigned', {
            projectId: 'p1',
            taskId: 't1'
        });

        expect(deliver).toHaveBeenCalledTimes(1);
        const callArg = deliver.mock.calls[0][0];
        expect(callArg.eventName).toBe('task.assigned');
        expect(callArg.projectId).toBe('p1');
    });
});
