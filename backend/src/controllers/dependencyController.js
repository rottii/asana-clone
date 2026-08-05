const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {
    getProjectRoleFromTask,
    hasRole
} = require('../utils/projectHelpers');
const { evaluateRules } = require('../utils/ruleEngine');

// ═══════════════════════════════════════════════════════════════════════════════
//  DEPENDENCIES
// ═══════════════════════════════════════════════════════════════════════════════

exports.addDependency = async (req, res) => {
    try {
        const role = await getProjectRoleFromTask(req.user.userId, req.params.taskId);
        if (!hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok. (Editor veya üstü gerekli)' });
        }

        const { blockingId } = req.body;
        const blockedById = req.params.taskId;

        if (!blockingId) return res.status(400).json({ error: 'blockingId zorunludur.' });

        const dependency = await prisma.taskDependency.create({
            data: { blockingId, blockedById }
        });

        // Trigger rule engine - task became blocked
        const task = await prisma.task.findUnique({
            where: { id: blockedById },
            include: { section: true }
        });

        if (task?.section?.projectId) {
            try {
                await evaluateRules(task.section.projectId, blockedById, { type: 'task_blocked' });
            } catch (e) { console.error('Rule error:', e); }
        }

        const io = req.app.get('io');
        if (task && task.section && io) {
            io.to(task.section.projectId).emit('dependency_added', dependency);
        }

        res.status(201).json(dependency);
    } catch (error) {
        console.error('Error adding dependency:', error);
        res.status(500).json({ error: 'Bağımlılık eklenirken hata oluştu.', details: error.message });
    }
};

exports.removeDependency = async (req, res) => {
    try {
        const role = await getProjectRoleFromTask(req.user.userId, req.params.taskId);
        if (!hasRole(role, 'EDITOR')) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok. (Editor veya üstü gerekli)' });
        }

        await prisma.taskDependency.delete({
            where: { id: req.params.dependencyId }
        });

        // Trigger rule engine - check if task is now unblocked
        const blockedById = req.params.taskId;
        const remainingDependencies = await prisma.taskDependency.findMany({
            where: { blockedById },
            include: { blockingTask: true }
        });

        const allBlockersCompleted = remainingDependencies.every(dep => dep.blockingTask.isCompleted);
        
        const task = await prisma.task.findUnique({
            where: { id: blockedById },
            include: { section: true }
        });

        if (allBlockersCompleted && task?.section?.projectId) {
             try {
                 await evaluateRules(task.section.projectId, blockedById, { type: 'task_no_longer_blocked' });
             } catch (e) { console.error('Rule error:', e); }
        }

        const io = req.app.get('io');
        if (task && task.section && io) {
            io.to(task.section.projectId).emit('dependency_removed', { dependencyId: req.params.dependencyId, taskId: req.params.taskId });
        }

        res.json({ message: 'Bağımlılık başarıyla silindi.' });
    } catch (error) {
        console.error('Error removing dependency:', error);
        res.status(500).json({ error: 'Bağımlılık silinirken hata oluştu.', details: error.message });
    }
};
