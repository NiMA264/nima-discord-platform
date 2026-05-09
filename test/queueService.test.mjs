import { describe, it, expect, vi } from 'vitest';

const { QueueService } = await import('../src/services/queueService.js');

describe('QueueService', () => {
    it('delegates enqueue/dequeue/ack/fail to adapter', async () => {
        const adapter = {
            enqueue: vi.fn(async () => ({ id: 1 })),
            dequeue: vi.fn(async () => ([{ id: 1, payload: { a: 1 } }])),
            ack: vi.fn(async () => ({ ok: true })),
            fail: vi.fn(async () => ({ ok: true }))
        };

        const queue = new QueueService(adapter);

        await queue.enqueue('github_events', { test: true }, { projectId: 'p1' });
        const messages = await queue.dequeue('github_events', 10);
        await queue.ack('github_events', 1);
        await queue.fail('github_events', 2, 'boom');

        expect(adapter.enqueue).toHaveBeenCalledWith('github_events', { test: true }, { projectId: 'p1' });
        expect(adapter.dequeue).toHaveBeenCalledWith('github_events', 10);
        expect(adapter.ack).toHaveBeenCalledWith('github_events', 1);
        expect(adapter.fail).toHaveBeenCalledWith('github_events', 2, 'boom');
        expect(messages[0].payload.a).toBe(1);
    });
});
