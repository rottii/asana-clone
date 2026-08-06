const express = require('express');
const router = express.Router({ mergeParams: true });
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const { JWT_SECRET } = require('../config/env');

const { authenticateToken } = require('../middleware/auth');
const { processMentions } = require('../utils/mentions');
const { getProjectRole, hasRole } = require('../utils/projectHelpers');

// GET /api/projects/:projectId/messages — Projenin tüm mesajlarını getir
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.params;

        // Authorization: must be at least VIEWER on the project
        const role = await getProjectRole(req.user.userId, projectId);
        if (!hasRole(role, 'VIEWER')) {
            return res.status(403).json({ error: 'Bu projenin mesajlarını görüntüleme yetkiniz yok.' });
        }

        const messages = await prisma.projectMessage.findMany({
            where: { projectId },
            include: {
                user: { select: { id: true, name: true, email: true } },
                replies: {
                    include: {
                        user: { select: { id: true, name: true, email: true } }
                    },
                    orderBy: { createdAt: 'asc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(messages);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Mesajlar alınırken sunucu hatası.' });
    }
});

// POST /api/projects/:projectId/messages — Projeye yeni bir mesaj gönder
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.params;
        const { subject, body } = req.body;

        if (!body) {
            return res.status(400).json({ error: 'Mesaj gövdesi (body) gereklidir.' });
        }

        // Authorization: must be at least COMMENTER on the project
        const role = await getProjectRole(req.user.userId, projectId);
        if (!hasRole(role, 'COMMENTER')) {
            return res.status(403).json({ error: 'Bu projede mesaj göndermek için yetkiniz yok.' });
        }

        // Check if project exists
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });

        const message = await prisma.projectMessage.create({
            data: {
                subject,
                body,
                projectId,
                userId: req.user.userId
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
                replies: {
                    include: {
                        user: { select: { id: true, name: true, email: true } }
                    }
                }
            }
        });

        // Process Mentions
        const notifiedIds = await processMentions({
            newHtml: body,
            oldHtml: '',
            actorId: req.user.userId,
            projectId,
            messagePrefix: 'Mentioned you in a message'
        });
        const io = req.app.get('io');
        if (io) {
            notifiedIds.forEach(id => {
                io.to(id).emit('new_notification');
            });
        }

        res.status(201).json(message);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Mesaj oluşturulurken sunucu hatası.' });
    }
});

// POST /api/projects/:projectId/messages/:messageId/replies — Mesaja cevap yaz
router.post('/:messageId/replies', authenticateToken, async (req, res) => {
    try {
        const { projectId, messageId } = req.params;
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Cevap metni (text) gereklidir.' });
        }

        // Authorization: must be at least COMMENTER on the project
        const role = await getProjectRole(req.user.userId, projectId);
        if (!hasRole(role, 'COMMENTER')) {
            return res.status(403).json({ error: 'Bu projede cevap yazmak için yetkiniz yok.' });
        }

        const reply = await prisma.projectMessageReply.create({
            data: {
                text,
                messageId,
                userId: req.user.userId
            },
            include: {
                user: { select: { id: true, name: true, email: true } }
            }
        });

        // Get projectId from message to pass to notification
        const message = await prisma.projectMessage.findUnique({ where: { id: messageId } });

        // Process Mentions
        const notifiedIds = await processMentions({
            newHtml: text,
            oldHtml: '',
            actorId: req.user.userId,
            projectId: message?.projectId,
            messagePrefix: 'Mentioned you in a reply'
        });
        const io = req.app.get('io');
        if (io) {
            notifiedIds.forEach(id => {
                io.to(id).emit('new_notification');
            });
        }

        res.status(201).json(reply);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Cevap oluşturulurken sunucu hatası.' });
    }
});

module.exports = router;
