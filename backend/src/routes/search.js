const express = require('express');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'asana_gizli_anahtar_123';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Giriş yapmanız gerekiyor.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Geçersiz token.' });
    req.user = user;
    next();
  });
};

router.get('/', authenticateToken, async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q || q.trim().length < 2) {
      return res.json({ tasks: [], projects: [], users: [], portfolios: [], goals: [] });
    }

    const searchQuery = { contains: q, mode: 'insensitive' };

    // Parallel fetch for speed
    const [tasks, projects, users, portfolios, goals] = await Promise.all([
      prisma.task.findMany({
        where: { title: searchQuery },
        take: 5,
        select: { id: true, title: true, isCompleted: true, section: { select: { project: { select: { id: true, name: true } } } } }
      }),
      prisma.project.findMany({
        where: { name: searchQuery, isArchived: false },
        take: 5,
        select: { id: true, name: true }
      }),
      prisma.user.findMany({
        where: { OR: [{ name: searchQuery }, { email: searchQuery }] },
        take: 5,
        select: { id: true, name: true, email: true }
      }),
      prisma.portfolio.findMany({
        where: { name: searchQuery },
        take: 5,
        select: { id: true, name: true }
      }),
      prisma.goal.findMany({
        where: { title: searchQuery },
        take: 5,
        select: { id: true, title: true, status: true }
      })
    ]);

    res.json({ tasks, projects, users, portfolios, goals });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Arama sırasında hata oluştu.' });
  }
});

module.exports = router;
