const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'asana_gizli_anahtar_123';

const { authenticateToken } = require('../middleware/auth');

// Get all notifications for the authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { id: true, name: true, email: true } },
        task: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } }
      }
    });
    res.json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

// Mark a specific notification as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const notification = await prisma.notification.updateMany({
      where: { id: notificationId, userId: req.user.userId },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to mark notification as read.' });
  }
});

// Mark all notifications as read for the user
router.patch('/read-all', authenticateToken, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.userId, isRead: false },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to mark all notifications as read.' });
  }
});

module.exports = router;
