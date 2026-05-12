const { applyGithubActivityProjection } = require('../analytics/githubActivityProjection');
const { applyContributionProjection } = require('../analytics/contributionProjection');

const githubProjectionRegistry = {
    'github.push': [applyGithubActivityProjection, applyContributionProjection],
    'github.pull_request.opened': [applyGithubActivityProjection, applyContributionProjection],
    'github.issue.opened': [applyGithubActivityProjection, applyContributionProjection]
};

function getProjectionsForEventType(eventType) {
    return githubProjectionRegistry[String(eventType || '').trim()] || [];
}

module.exports = {
    githubProjectionRegistry,
    getProjectionsForEventType
};
