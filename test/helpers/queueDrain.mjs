function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function errorWithState(message, state) {
    const err = new Error(`${message}; state=${JSON.stringify(state || {})}`);
    err.state = state || {};
    return err;
}

export async function eventually(assertionFn, options = {}) {
    const timeoutMs = Number(options.timeoutMs || 2000);
    const intervalMs = Number(options.intervalMs || 25);
    const describeState = typeof options.describeState === 'function' ? options.describeState : null;

    const started = Date.now();
    let lastError = null;

    while ((Date.now() - started) <= timeoutMs) {
        try {
            await assertionFn();
            return;
        } catch (err) {
            lastError = err;
            await sleep(intervalMs);
        }
    }

    const state = describeState ? await describeState() : {};
    const reason = lastError ? String(lastError.message || lastError) : 'condition not met';
    throw errorWithState(`eventually timeout after ${timeoutMs}ms: ${reason}`, state);
}

export async function waitForIdle(workerOrQueue, options = {}) {
    const timeoutMs = Number(options.timeoutMs || 4000);
    const intervalMs = Number(options.intervalMs || 25);
    const describeState = typeof options.describeState === 'function' ? options.describeState : null;

    function isIdleValue(target) {
        if (typeof target === 'function') return Boolean(target());
        if (target && typeof target.isIdle === 'function') return Boolean(target.isIdle());
        if (target && typeof target.getDepth === 'function') return Number(target.getDepth()) === 0;
        if (typeof target === 'boolean') return target;
        return false;
    }

    await eventually(async () => {
        const result = await (typeof workerOrQueue === 'function' ? workerOrQueue() : isIdleValue(workerOrQueue));
        if (!result) throw new Error('not idle yet');
    }, { timeoutMs, intervalMs, describeState });
}

export async function drainQueue(queue, options = {}) {
    const timeoutMs = Number(options.timeoutMs || 5000);
    const intervalMs = Number(options.intervalMs || 25);
    const maxIterations = Number(options.maxIterations || 250);
    const batchSize = Number(options.batchSize || 20);

    if (!queue || typeof queue.processBatch !== 'function') {
        throw new Error('drainQueue requires queue.processBatch(batchSize)');
    }

    const describeState = async () => {
        if (typeof options.describeState === 'function') return options.describeState();
        if (typeof queue.describeState === 'function') return queue.describeState();
        return {};
    };

    const started = Date.now();
    let iterations = 0;
    let processedTotal = 0;

    while ((Date.now() - started) <= timeoutMs) {
        iterations += 1;
        if (iterations > maxIterations) {
            throw errorWithState(`drainQueue exceeded max iterations ${maxIterations}`, await describeState());
        }

        const processed = Number(await queue.processBatch(batchSize)) || 0;
        processedTotal += processed;

        await waitForIdle(async () => {
            if (typeof queue.isIdle === 'function') return queue.isIdle();
            if (typeof queue.getDepth === 'function') return Number(queue.getDepth()) === 0;
            return processed === 0;
        }, { timeoutMs: intervalMs * 2, intervalMs, describeState });

        const idle = typeof queue.isIdle === 'function'
            ? await queue.isIdle()
            : (typeof queue.getDepth === 'function' ? Number(await queue.getDepth()) === 0 : processed === 0);
        if (idle) {
            return { processedTotal, iterations };
        }
        await sleep(intervalMs);
    }

    throw errorWithState(`drainQueue timeout after ${timeoutMs}ms`, await describeState());
}
