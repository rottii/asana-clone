const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'asana_gizli_anahtar_123';

// 1. KAYIT OL (REGISTER) - POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Girdilerin kontrolü
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Lütfen tüm alanları doldurun.' });
    }

    // Email zaten var mı kontrolü
    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) {
      return res.status(400).json({ error: 'Bu email adresi zaten kullanımda.' });
    }

    // Şifreyi güvenli hale getirme
    const hashedPassword = await bcrypt.hash(password, 10);

    // Kullanıcıyı veritabanına kaydetme
    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
      },
    });

    // Otomatik olarak "My Tasks" projesi oluşturma
    await prisma.project.create({
      data: {
        name: 'My Tasks',
        status: 'MY_TASKS',
        ownerId: newUser.id,
        color: '#4F46E5',
        icon: '👤',
        sections: {
          create: [
            { name: 'Recently assigned', order: 1000 },
            { name: 'Do today', order: 2000 },
            { name: 'Do next week', order: 3000 },
            { name: 'Do later', order: 4000 }
          ]
        },
        members: {
          create: {
            userId: newUser.id,
            role: 'ADMIN'
          }
        }
      }
    });

    res.status(201).json({ message: 'Kullanıcı başarıyla oluşturuldu.', userId: newUser.id });
  } catch (error) {
    res.status(500).json({ error: 'Kayıt esnasında bir hata oluştu.', details: error.message });
  }
});

// 2. GİRİŞ YAP (LOGIN) - POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email ve şifre zorunludur.' });
    }

    // Kullanıcıyı bulma
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Geçersiz email veya şifre.' });
    }

    // Şifre eşleşiyor mu kontrolü
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Geçersiz email veya şifre.' });
    }

    // JWT Token üretme (1 gün geçerli)
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1d' });

    res.json({
      message: 'Giriş başarılı!',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ error: 'Giriş esnasında bir hata oluştu.', details: error.message });
  }
});

module.exports = router;