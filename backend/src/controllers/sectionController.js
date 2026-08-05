const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {
    getProjectRole,
    getProjectRoleFromSection,
    hasRole,
    fullProjectInclude,
    fullTaskInclude
} = require('../utils/projectHelpers');

// ═══════════════════════════════════════════════════════════════════════════════
//  SECTIONS
// ═══════════════════════════════════════════════════════════════════════════════

exports.createSection = async (req, res) => {
    try {
        const { name, projectId } = req.body;
        if (!name || !projectId) return res.status(400).json({ error: 'name ve projectId zorunludur.' });

        const role = await getProjectRole(req.user.userId, projectId);
        if (!hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok. (Editor veya üstü gerekli)' });
        }

        // Determine next order value
        const lastSection = await prisma.section.findFirst({
            where: { projectId },
            orderBy: { order: 'desc' }
        });
        const nextOrder = lastSection ? lastSection.order + 1 : 1;

        const newSection = await prisma.section.create({
            data: { name: name.trim(), projectId, order: nextOrder },
            include: { tasks: true }
        });

        // Emit real-time event
        const io = req.app.get('io');
        if (io) io.to(projectId).emit('section_created', newSection);

        res.status(201).json(newSection);
    } catch (error) {
        console.error('Error creating section:', error);
        res.status(500).json({ error: 'Bölüm oluşturulurken hata oluştu.', details: error.message });
    }
};

exports.moveSection = async (req, res) => {
    try {
        const { orderedSectionIds, projectId } = req.body;
        if (!orderedSectionIds || !projectId) {
            return res.status(400).json({ error: 'orderedSectionIds ve projectId zorunludur.' });
        }

        const role = await getProjectRole(req.user.userId, projectId);
        if (!hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok. (Editor veya üstü gerekli)' });
        }

        // Update each section's order
        await Promise.all(
            orderedSectionIds.map((sectionId, index) =>
                prisma.section.update({
                    where: { id: sectionId },
                    data: { order: index + 1 }
                })
            )
        );

        const updatedProject = await prisma.project.findUnique({
            where: { id: projectId },
            include: fullProjectInclude
        });

        const io = req.app.get('io');
        if (io) io.to(projectId).emit('section_moved', updatedProject);

        res.json(updatedProject);
    } catch (error) {
        console.error('Error reordering sections:', error);
        res.status(500).json({ error: 'Bölüm sıralaması güncellenirken hata oluştu.', details: error.message });
    }
};

exports.renameSection = async (req, res) => {
    try {
        const role = await getProjectRoleFromSection(req.user.userId, req.params.sectionId);
        if (!hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok. (Editor veya üstü gerekli)' });
        }

        const { name } = req.body;
        const updatedSection = await prisma.section.update({
            where: { id: req.params.sectionId },
            data: { name: name?.trim() },
            include: {
                tasks: {
                    orderBy: { order: 'asc' },
                    include: fullTaskInclude
                }
            }
        });

        const io = req.app.get('io');
        if (io) io.to(updatedSection.projectId).emit('section_updated', updatedSection);

        res.json(updatedSection);
    } catch (error) {
        console.error('Error renaming section:', error);
        res.status(500).json({ error: 'Bölüm yeniden adlandırılırken hata oluştu.', details: error.message });
    }
};

exports.deleteSection = async (req, res) => {
    try {
        const role = await getProjectRoleFromSection(req.user.userId, req.params.sectionId);
        if (!hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok. (Editor veya üstü gerekli)' });
        }

        const section = await prisma.section.findUnique({ where: { id: req.params.sectionId } });
        if (!section) return res.status(404).json({ error: 'Bölüm bulunamadı.' });

        await prisma.section.delete({ where: { id: req.params.sectionId } });

        const io = req.app.get('io');
        if (io) io.to(section.projectId).emit('section_deleted', { sectionId: req.params.sectionId });

        res.json({ message: 'Bölüm başarıyla silindi.' });
    } catch (error) {
        console.error('Error deleting section:', error);
        res.status(500).json({ error: 'Bölüm silinirken hata oluştu.', details: error.message });
    }
};
