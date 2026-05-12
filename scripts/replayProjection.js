#!/usr/bin/env node

const domainEventRepository = require('../src/repositories/domainEventRepository');
const { runProjection } = require('../src/projections/runtime/runProjection');
const { validateProjectionState } = require('../src/projections/validateProjectionState');

const PROJECTION_CONFIG = {
    githubActivity: {
        contractName: 'githubActivity',
        contractLabel: 'github-activity-read-model v1',
        filter: (event) => String(event?.type || '').startsWith('github.'),
        toOutput(state) {
            const counts = state?.repositoryEventCounts || {};
            const activeRepositories = Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([repositoryFullName, eventCount]) => ({ repositoryFullName, eventCount }));

            const recentGithubEvents = Array.isArray(state?.recentGithubEvents)
                ? state.recentGithubEvents
                : [];

            return {
                readModelVersion: 1,
                activeRepositories,
                recentGithubEvents
            };
        }
    }
};

function parseArgs(argv) {
    const args = { projection: 'githubActivity', workspaceId: 'default-workspace', limit: 2000 };

    for (let i = 0; i < argv.length; i += 1) {
        const current = argv[i];
        const next = argv[i + 1];

        if (current === '--projection' && next) {
            args.projection = next;
            i += 1;
            continue;
        }

        if (current === '--workspaceId' && next) {
            args.workspaceId = next;
            i += 1;
            continue;
        }

        if (current === '--limit' && next) {
            const parsed = Number.parseInt(next, 10);
            if (Number.isInteger(parsed) && parsed > 0) {
                args.limit = parsed;
            }
            i += 1;
            continue;
        }
    }

    return args;
}

function printHelp() {
    console.log('Usage: node scripts/replayProjection.js --projection githubActivity --workspaceId <id> [--limit 2000]');
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const projectionConfig = PROJECTION_CONFIG[args.projection];

    if (!projectionConfig) {
        console.error(`Unknown projection: ${args.projection}`);
        printHelp();
        process.exitCode = 1;
        return;
    }

    const rawEvents = domainEventRepository.listDomainEventsByWorkspace(args.workspaceId, args.limit);
    const events = rawEvents.filter(projectionConfig.filter);

    const result = runProjection(events);
    const outputState = projectionConfig.toOutput(result.state || {});
    const validation = validateProjectionState(projectionConfig.contractName, outputState);

    console.log(`Projection: ${args.projection}`);
    console.log(`Workspace: ${args.workspaceId}`);
    console.log(`Processed events: ${events.length}`);
    console.log(`Unknown events: ${result.unknownEvents.length}`);
    console.log(`Validation: ${validation.valid ? 'valid' : 'invalid'}`);
    console.log(`Output contract: ${projectionConfig.contractLabel}`);

    if (!validation.valid) {
        console.log('Validation errors:');
        for (const error of validation.errors) {
            console.log(`- ${error}`);
        }
    }
}

try {
    main();
} catch (error) {
    console.error('Replay failed due to technical error.');
    console.error(error?.stack || String(error));
    process.exitCode = 1;
}
