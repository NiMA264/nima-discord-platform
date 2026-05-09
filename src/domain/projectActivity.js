function buildProjectActivity({ source, type, projectId, actor, title, url, summary, raw, occurredAt }) {
    return {
        source,
        type,
        projectId,
        actor,
        title,
        url,
        summary,
        raw,
        occurredAt
    };
}

module.exports = {
    buildProjectActivity
};
