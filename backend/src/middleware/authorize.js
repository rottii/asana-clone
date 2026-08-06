const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {
    getProjectRole,
    hasRole,
    getWorkspaceRole,
    hasWorkspaceRole
} = require('../utils/projectHelpers');

/**
 * Middleware: Require minimum project role.
 * Reads projectId from req.params.id or req.params.projectId.
 */
function requireProjectRole(minimumRole) {
    return async (req, res, next) => {
        try {
            const projectId = req.params.projectId || req.params.id;
            if (!projectId) {
                return res.status(400).json({ error: 'Project ID is required.' });
            }

            const role = await getProjectRole(req.user.userId, projectId);
            if (!hasRole(role, minimumRole)) {
                return res.status(403).json({
                    error: `Bu işlem için yetkiniz yok. (${minimumRole} veya üstü gerekli)`
                });
            }

            // Attach the role to the request for downstream use
            req.projectRole = role;
            next();
        } catch (err) {
            console.error('Authorization error (project role):', err);
            return res.status(500).json({ error: 'Yetkilendirme hatası.' });
        }
    };
}

/**
 * Middleware: Require workspace membership with a minimum role.
 * Reads workspaceId from req.params.workspaceId or req.query.workspaceId.
 */
function requireWorkspaceMember(minimumRole = 'GUEST') {
    return async (req, res, next) => {
        try {
            const workspaceId = req.params.workspaceId || req.query.workspaceId;
            if (!workspaceId) {
                return res.status(400).json({ error: 'Workspace ID is required.' });
            }

            const role = await getWorkspaceRole(req.user.userId, workspaceId);
            if (!hasWorkspaceRole(role, minimumRole)) {
                return res.status(403).json({
                    error: 'Bu çalışma alanına erişim yetkiniz yok.'
                });
            }

            req.workspaceRole = role;
            next();
        } catch (err) {
            console.error('Authorization error (workspace role):', err);
            return res.status(500).json({ error: 'Yetkilendirme hatası.' });
        }
    };
}

/**
 * Middleware: Require ownership of a resource.
 * Looks up the resource by req.params.id and checks ownerId matches req.user.userId.
 * @param {string} model - Prisma model name (e.g., 'portfolio', 'goal')
 */
function requireOwnership(model) {
    return async (req, res, next) => {
        try {
            const resourceId = req.params.id;
            if (!resourceId) {
                return res.status(400).json({ error: 'Resource ID is required.' });
            }

            const resource = await prisma[model].findUnique({
                where: { id: resourceId },
                select: { ownerId: true }
            });

            if (!resource) {
                return res.status(404).json({ error: 'Kaynak bulunamadı.' });
            }

            if (resource.ownerId !== req.user.userId) {
                return res.status(403).json({
                    error: 'Bu kaynağı sadece sahibi değiştirebilir.'
                });
            }

            next();
        } catch (err) {
            console.error('Authorization error (ownership):', err);
            return res.status(500).json({ error: 'Yetkilendirme hatası.' });
        }
    };
}

module.exports = {
    requireProjectRole,
    requireWorkspaceMember,
    requireOwnership
};
