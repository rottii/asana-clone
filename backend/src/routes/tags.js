const express = require('express');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const router = express.Router();
const prisma = new PrismaClient();
const { JWT_SECRET } = require('../config/env');

const { authenticateToken } = require('../middleware/auth');

// GET /api/tags -> Get all tags
router.get('/', authenticateToken, async (req, res) => {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(tags);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Etiketler alınamadı.' });
  }
});

// POST /api/tags -> Create a tag
router.post('/', authenticateToken, async (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Etiket adı gereklidir.' });

  try {
    const existing = await prisma.tag.findUnique({ where: { name } });
    if (existing) {
      return res.status(400).json({ error: 'Bu etiket zaten var.', tag: existing });
    }

    const tag = await prisma.tag.create({
      data: { 
        name, 
        color: color || '#9CA3AF' 
      }
    });
    res.status(201).json(tag);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Etiket oluşturulamadı.' });
  }
});

module.exports = router;
