const { getDatabase } = require('../database/database');
const { ensurePhase1Persistence } = require('../database/phase1PersistenceMigration');

ensurePhase1Persistence();
const db = getDatabase();

const statements = {
    createSprint: db.prepare(`
        INSERT INTO sprints (sprint_uid, project_uid, title, status, started_by, started_at)
        VALUES (?, ?, ?, 'ACTIVE', ?, ?)
    `),
    findByUid: db.prepare(`
        SELECT * FROM sprints WHERE sprint_uid = ? LIMIT 1
    `),
    listByProject: db.prepare(`
        SELECT * FROM sprints WHERE project_uid = ? ORDER BY started_at DESC LIMIT ?
    `),
    closeSprint: db.prepare(`
        UPDATE sprints SET status = 'CLOSED', closed_by = ?, closed_at = ? WHERE sprint_uid = ?
    `)
};

async function createSprint(data) {
    return statements.createSprint.run(
        data.sprintUid,
        data.projectUid,
        data.title,
        data.startedBy,
        data.startedAt || new Date().toISOString()
    );
}

async function findSprintByUid(sprintUid) {
    return statements.findByUid.get(sprintUid) || null;
}

async function listSprintsByProject(projectUid, limit = 20) {
    return statements.listByProject.all(projectUid, limit);
}

async function closeSprint(sprintUid, closedBy) {
    return statements.closeSprint.run(closedBy, new Date().toISOString(), sprintUid);
}

module.exports = {
    createSprint,
    findSprintByUid,
    listSprintsByProject,
    closeSprint
};
