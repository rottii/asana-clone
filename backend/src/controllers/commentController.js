const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {
    getProjectRoleFromTask,
    hasRole,
    processMentions
} = require('../utils/projectHelpers');

// ═══════════════════════════════════════════════════════════════════════════════
//  COMMENTS & REACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

exports.createComment = async (req, res) => {
    try {
        const role = await getProjectRoleFromTask(req.user.userId, req.params.taskId);
        if (!hasRole(role, 'COMMENTER')) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok. (Commenter veya üstü gerekli)' });
        }

        const { content, attachments } = req.body;
        if (!content && (!attachments || attachments.length === 0)) {
            return res.status(400).json({ error: 'İçerik veya eklenti zorunludur.' });
        }

        const newComment = await prisma.comment.create({
            data: {
                content: content || '',
                taskId: req.params.taskId,
                userId: req.user.userId,
                attachments: attachments ? JSON.stringify(attachments) : null
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
                reactions: { include: { user: { select: { id: true, name: true, email: true } } } }
            }
        });

        const task = await prisma.task.findUnique({
            where: { id: req.params.taskId },
            include: { section: true, assignee: true, creator: true }
        });

        const io = req.app.get('io');
        if (task && task.section && io) {
            io.to(task.section.projectId).emit('comment_added', newComment);

            const notifiedMentions = await processMentions({
                newHtml: content,
                oldHtml: '',
                actorId: req.user.userId,
                taskId: task.id,
                projectId: task.section.projectId,
                messagePrefix: 'Mentioned you in a comment on'
            });

            // Notify assignee if not the commenter and not mentioned
            if (task.assigneeId && task.assigneeId !== req.user.userId && !notifiedMentions.includes(task.assigneeId)) {
                await prisma.notification.create({
                    data: {
                        type: 'COMMENT',
                        message: `New comment on task "${task.title}"`,
                        userId: task.assigneeId,
                        actorId: req.user.userId,
                        taskId: task.id,
                        projectId: task.section.projectId
                    }
                });
                io.to(task.assigneeId).emit('new_notification');
            }
            
            // Notify creator if not assignee, not commenter, and not mentioned
            if (task.creatorId && task.creatorId !== task.assigneeId && task.creatorId !== req.user.userId && !notifiedMentions.includes(task.creatorId)) {
                 await prisma.notification.create({
                    data: {
                        type: 'COMMENT',
                        message: `New comment on task "${task.title}"`,
                        userId: task.creatorId,
                        actorId: req.user.userId,
                        taskId: task.id,
                        projectId: task.section.projectId
                    }
                });
                io.to(task.creatorId).emit('new_notification');
            }
        }

        res.status(201).json(newComment);
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Yorum eklenirken hata oluştu.', details: error.message });
    }
};

exports.deleteComment = async (req, res) => {
    try {
        const { taskId, commentId } = req.params;
        
        // Find the comment first
        const comment = await prisma.comment.findUnique({
            where: { id: commentId }
        });
        
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }
        
        // Ensure user owns the comment OR has editor rights
        let hasPermission = false;
        if (comment.userId === req.user.userId) {
            hasPermission = true;
        } else {
            const role = await getProjectRoleFromTask(req.user.userId, taskId);
            if (hasRole(role, 'EDITOR')) {
                hasPermission = true;
            }
        }
        
        if (!hasPermission) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
        }
        
        await prisma.comment.delete({
            where: { id: commentId }
        });
        
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: { section: true }
        });

        const io = req.app.get('io');
        if (task && task.section && io) {
            io.to(task.section.projectId).emit('comment_deleted', { taskId, commentId });
        }
        
        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: 'Yorum silinirken hata oluştu.', details: error.message });
    }
};

exports.toggleReaction = async (req, res) => {
    try {
        const { taskId, commentId } = req.params;
        const { emoji } = req.body;
        const userId = req.user.userId;

        if (!emoji) return res.status(400).json({ error: 'emoji zorunludur.' });

        const existingReaction = await prisma.reaction.findFirst({
            where: { commentId, userId, emoji }
        });

        let result;
        if (existingReaction) {
            await prisma.reaction.delete({ where: { id: existingReaction.id } });
            result = { action: 'removed', emoji };
        } else {
            const newReaction = await prisma.reaction.create({
                data: { commentId, userId, emoji },
                include: { user: { select: { id: true, name: true, email: true } } }
            });
            result = { action: 'added', reaction: newReaction };

            // Create notification for comment owner
            const comment = await prisma.comment.findUnique({ where: { id: commentId } });
            const task = await prisma.task.findUnique({ where: { id: taskId }, include: { section: true }});
            if (comment && comment.userId !== userId && task) {
                 await prisma.notification.create({
                    data: {
                        type: 'LIKE',
                        message: `Reacted with ${emoji} to your comment`,
                        userId: comment.userId,
                        actorId: userId,
                        taskId: taskId,
                        projectId: task.section?.projectId
                    }
                });
                const io = req.app.get('io');
                if (io) io.to(comment.userId).emit('new_notification');
            }
        }

        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: { section: true }
        });
        const io = req.app.get('io');
        if (task && task.section && io) {
            io.to(task.section.projectId).emit('reaction_updated', { taskId, commentId, ...result, userId });
        }

        res.json(result);
    } catch (error) {
        console.error('Error toggling reaction:', error);
        res.status(500).json({ error: 'Reaksiyon güncellenirken hata oluştu.', details: error.message });
    }
};
