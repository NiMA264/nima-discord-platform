const { buildProjectActivity } = require('../../domain/projectActivity');

function resolveProjectId(payload) {
    return payload?.projectId || payload?.projectUid || payload?.project_id || null;
}

function normalizePushEvent(payload) {
    const actor = payload?.sender?.login || payload?.pusher?.name || 'unknown';
    const branch = payload?.ref ? payload.ref.replace('refs/heads/', '') : 'unknown';
    const commitCount = Array.isArray(payload?.commits) ? payload.commits.length : 0;
    const summary = `${commitCount} commit(s) pushed to ${branch}`;

    return buildProjectActivity({
        source: 'github',
        type: 'push',
        projectId: resolveProjectId(payload),
        actor,
        title: `${payload?.repository?.full_name || 'repository'} push`,
        url: payload?.compare || payload?.repository?.html_url || null,
        summary,
        raw: payload,
        occurredAt: payload?.head_commit?.timestamp || payload?.repository?.updated_at || new Date().toISOString()
    });
}

function normalizePullRequestEvent(payload) {
    const pr = payload?.pull_request || {};

    return buildProjectActivity({
        source: 'github',
        type: 'pull_request',
        projectId: resolveProjectId(payload),
        actor: payload?.sender?.login || pr?.user?.login || 'unknown',
        title: pr?.title || 'Pull request update',
        url: pr?.html_url || payload?.repository?.html_url || null,
        summary: `PR #${pr?.number || '?'} ${payload?.action || 'updated'}`,
        raw: payload,
        occurredAt: pr?.updated_at || pr?.created_at || new Date().toISOString()
    });
}

function normalizeIssueEvent(payload) {
    const issue = payload?.issue || {};

    return buildProjectActivity({
        source: 'github',
        type: 'issue',
        projectId: resolveProjectId(payload),
        actor: payload?.sender?.login || issue?.user?.login || 'unknown',
        title: issue?.title || 'Issue update',
        url: issue?.html_url || payload?.repository?.html_url || null,
        summary: `Issue #${issue?.number || '?'} ${payload?.action || 'updated'}`,
        raw: payload,
        occurredAt: issue?.updated_at || issue?.created_at || new Date().toISOString()
    });
}

function normalizeGithubEvent(eventName, payload) {
    if (eventName === 'push') return normalizePushEvent(payload);
    if (eventName === 'pull_request') return normalizePullRequestEvent(payload);
    if (eventName === 'issues') return normalizeIssueEvent(payload);
    return null;
}

module.exports = {
    normalizeGithubEvent
};
