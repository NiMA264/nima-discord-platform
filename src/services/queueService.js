class QueueService {
    constructor(adapter) {
        this.adapter = adapter;
    }

    async enqueue(queueName, message, metadata = {}) {
        return this.adapter.enqueue(queueName, message, metadata);
    }

    async dequeue(queueName, limit = 20) {
        return this.adapter.dequeue(queueName, limit);
    }

    async ack(queueName, messageId) {
        return this.adapter.ack(queueName, messageId);
    }

    async fail(queueName, messageId, errorMessage = null) {
        return this.adapter.fail(queueName, messageId, errorMessage);
    }
}

module.exports = {
    QueueService
};
