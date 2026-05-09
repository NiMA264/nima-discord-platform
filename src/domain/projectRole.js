const ProjectRole = Object.freeze({
    PROJECT_LEAD: 'PROJECT_LEAD',
    MAINTAINER: 'MAINTAINER',
    REVIEWER: 'REVIEWER',
    CONTRIBUTOR: 'CONTRIBUTOR'
});

function isValidProjectRole(role) {
    return Object.values(ProjectRole).includes(role);
}

module.exports = {
    ProjectRole,
    isValidProjectRole
};
