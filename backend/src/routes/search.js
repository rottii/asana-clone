const express = require('express');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const router = express.Router();
const prisma = new PrismaClient();
const { JWT_SECRET } = require('../config/env');

const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q || q.trim().length < 2) {
      return res.json({ tasks: [], projects: [], users: [], portfolios: [], goals: [] });
    }

    const searchQuery = { contains: q, mode: 'insensitive' };
    const userId = req.user.userId;

    // Reusable filter: projects the user owns or is a member of
    const userProjectFilter = {
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } }
      ]
    };

    // Parallel fetch for speed — all scoped to user's access
    const [tasks, projects, users, portfolios, goals] = await Promise.all([
      // Tasks: only in projects the user is a member/owner of
      prisma.task.findMany({
        where: {
          title: searchQuery,
          section: { project: userProjectFilter }
        },
        take: 5,
        select: { id: true, title: true, isCompleted: true, section: { select: { project: { select: { id: true, name: true } } } } }
      }),
      // Projects: only those the user is a member/owner of
      prisma.project.findMany({
        where: {
          name: searchQuery,
          isArchived: false,
          ...userProjectFilter
        },
        take: 5,
        select: { id: true, name: true }
      }),
      // Users: safe to return (finding collaborators)
      prisma.user.findMany({
        where: { OR: [{ name: searchQuery }, { email: searchQuery }] },
        take: 5,
        select: { id: true, name: true, email: true }
      }),
      // Portfolios: only owned by the user
      prisma.portfolio.findMany({
        where: { name: searchQuery, ownerId: userId },
        take: 5,
        select: { id: true, name: true }
      }),
      // Goals: only owned by the user
      prisma.goal.findMany({
        where: { title: searchQuery, ownerId: userId },
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
