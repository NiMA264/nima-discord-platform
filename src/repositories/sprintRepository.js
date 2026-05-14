const { getPrisma } = require('../lib/prisma');
const sqliteAdapter = require('./sprintRepository.sqlite');
const { nowIso } = require('../lib/clock');
const { newUuid } = require('../lib/uuidProvider');

function useFallback() {
    return process.env.PROJECT_REPO_ADAPTER === 'sqlite';
}

function rowOrNull(rows) {
    return rows.length ? rows[0] : null;
}

async function createSprintEntity({ projectUid, title, startedBy, startedAt, status }) {
    const sprintUid = newUuid();
    if (useFallback()) {
        await sqliteAdapter.createSprint({ sprintUid, projectUid, title, startedBy, startedAt, status });
        return sprintUid;
    }

    const prisma = getPrisma();
    await prisma.$executeRaw`
        INSERT INTO sprints (sprint_uid, project_uid, title, status, started_by, started_at)
        VALUES (${sprintUid}, ${projectUid}, ${title}, ${status || 'ACTIVE'}, ${startedBy}, ${startedAt || nowIso()})
    `;
    return sprintUid;
}

async function findSprintByUid(sprintUid) {
    if (useFallback()) return sqliteAdapter.findSprintByUid(sprintUid);
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw`SELECT * FROM sprints WHERE sprint_uid = ${sprintUid} LIMIT 1`;
    return rowOrNull(rows);
}

async function listSprintsByProject(projectUid, limit = 20) {
    if (useFallback()) return sqliteAdapter.listSprintsByProject(projectUid, limit);
    const prisma = getPrisma();
    return prisma.$queryRaw`SELECT * FROM sprints WHERE project_uid = ${projectUid} ORDER BY started_at DESC LIMIT ${limit}`;
}

async function closeSprint(sprintUid, closedBy) {
    if (useFallback()) return sqliteAdapter.closeSprint(sprintUid, closedBy);
    const prisma = getPrisma();
    return prisma.$executeRaw`
        UPDATE sprints SET status = 'CLOSED', closed_by = ${closedBy}, closed_at = ${nowIso()}
        WHERE sprint_uid = ${sprintUid}
    `;
}

module.exports = {
    createSprintEntity,
    findSprintByUid,
    listSprintsByProject,
    closeSprint
};
