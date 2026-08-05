const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const path = require('path');
const fs = require('fs');
const { getProjectRoleFromTask, hasRole } = require('../utils/projectHelpers');

// ═══════════════════════════════════════════════════════════════════════════════
//  ATTACHMENTS
// ═══════════════════════════════════════════════════════════════════════════════

exports.uploadAttachment = async (req, res) => {
    try {
        const role = await getProjectRoleFromTask(req.user.userId, req.params.taskId);
        if (!hasRole(role, 'COMMENTER')) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok. (Commenter veya üstü gerekli)' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Dosya yüklenmedi.' });
        }

        const newAttachment = await prisma.attachment.create({
            data: {
                fileName: req.file.originalname,
                fileUrl: `/uploads/${req.file.filename}`,
                fileType: req.file.mimetype,
                fileSize: req.file.size,
                taskId: req.params.taskId,
                uploaderId: req.user.userId
            },
            include: {
                uploader: { select: { id: true, name: true, email: true } }
            }
        });

        // Trigger Socket.io event for real-time update
        const task = await prisma.task.findUnique({
            where: { id: req.params.taskId },
            include: { section: true }
        });

        const io = req.app.get('io');
        if (task && task.section && io) {
            io.to(task.section.projectId).emit('attachment_added', newAttachment);
        }

        res.status(201).json(newAttachment);
    } catch (error) {
        console.error('Error uploading attachment:', error);
        res.status(500).json({ error: 'Dosya yüklenirken hata oluştu.', details: error.message });
    }
};

exports.getAttachments = async (req, res) => {
    try {
        const attachments = await prisma.attachment.findMany({
            where: { taskId: req.params.taskId },
            include: {
                uploader: { select: { id: true, name: true, email: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(attachments);
    } catch (error) {
        console.error('Error fetching attachments:', error);
        res.status(500).json({ error: 'Eklentiler yüklenirken hata oluştu.', details: error.message });
    }
};

exports.deleteAttachment = async (req, res) => {
    try {
        const attachment = await prisma.attachment.findUnique({
            where: { id: req.params.attachmentId },
            include: {
                task: {
                    include: { section: true }
                }
            }
        });

        if (!attachment) {
            return res.status(404).json({ error: 'Eklenti bulunamadı.' });
        }

        let hasPermission = false;
        if (attachment.uploaderId === req.user.userId) {
            hasPermission = true;
        } else if (attachment.task) {
            const role = await getProjectRoleFromTask(req.user.userId, attachment.task.id);
            if (hasRole(role, 'EDITOR')) {
                hasPermission = true;
            }
        }

        if (!hasPermission) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
        }

        const filePath = path.join(__dirname, '..', '..', attachment.fileUrl);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await prisma.attachment.delete({
            where: { id: req.params.attachmentId }
        });

        const io = req.app.get('io');
        if (attachment.task && attachment.task.section && io) {
            io.to(attachment.task.section.projectId).emit('attachment_deleted', {
                taskId: attachment.task.id,
                attachmentId: req.params.attachmentId
            });
        }

        res.json({ message: 'Eklenti başarıyla silindi.' });
    } catch (error) {
        console.error('Error deleting attachment:', error);
        res.status(500).json({ error: 'Eklenti silinirken hata oluştu.', details: error.message });
    }
};
