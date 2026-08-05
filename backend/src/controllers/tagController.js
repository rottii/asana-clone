const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getProjectRole, hasRole } = require('../utils/projectHelpers');

// ═══════════════════════════════════════════════════════════════════════════════
//  TAGS
// ═══════════════════════════════════════════════════════════════════════════════

exports.addTag = async (req, res) => {
    try {
        const { projectId, taskId } = req.params;
        const { name, color } = req.body;

        if (!name) return res.status(400).json({ error: 'Etiket adı zorunludur.' });

        const role = await getProjectRole(req.user.userId, projectId);
        if (!hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
        }

        // Find existing tag by name or create a new one
        let tag = await prisma.tag.findUnique({
            where: { name }
        });

        if (!tag) {
            tag = await prisma.tag.create({
                data: { name, color: color || '#808080' } // Default gray
            });
        }

        // Check if task already has this tag
        const taskWithTag = await prisma.task.findFirst({
            where: { id: taskId, tags: { some: { id: tag.id } } }
        });

        if (!taskWithTag) {
            await prisma.task.update({
                where: { id: taskId },
                data: {
                    tags: { connect: { id: tag.id } }
                }
            });
        }

        const io = req.app.get('io');
        if (io) {
            io.to(projectId).emit('tag_added', { taskId, tag });
        }

        res.status(201).json(tag);
    } catch (error) {
        console.error('Error adding tag to task:', error);
        res.status(500).json({ error: 'Etiket eklenirken hata oluştu.', details: error.message });
    }
};

exports.removeTag = async (req, res) => {
    try {
        const { projectId, taskId, tagId } = req.params;

        const role = await getProjectRole(req.user.userId, projectId);
        if (!hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
        }

        await prisma.task.update({
            where: { id: taskId },
            data: {
                tags: { disconnect: { id: tagId } }
            }
        });

        const io = req.app.get('io');
        if (io) {
            io.to(projectId).emit('tag_removed', { taskId, tagId });
        }

        res.json({ message: 'Etiket başarıyla kaldırıldı.' });
    } catch (error) {
        console.error('Error removing tag from task:', error);
        res.status(500).json({ error: 'Etiket kaldırılırken hata oluştu.', details: error.message });
    }
};
