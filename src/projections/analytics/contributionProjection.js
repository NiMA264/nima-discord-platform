function normalizeType(event) {
    return String(event?.type || event?.eventType || '').trim();
}

function applyContributionProjection(state, event) {
    const counts = {
        push: Number(state?.contributionCounts?.push || 0),
        pullRequestsOpened: Number(state?.contributionCounts?.pullRequestsOpened || 0),
        issuesOpened: Number(state?.contributionCounts?.issuesOpened || 0)
    };

    const type = normalizeType(event);
    if (type === 'github.push') counts.push += 1;
    if (type === 'github.pull_request.opened') counts.pullRequestsOpened += 1;
    if (type === 'github.issue.opened') counts.issuesOpened += 1;

    return {
        ...(state || {}),
        contributionCounts: counts
    };
}

module.exports = {
    applyContributionProjection
};
