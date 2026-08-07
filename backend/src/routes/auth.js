const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { OAuth2Client } = require('google-auth-library');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();
const { JWT_SECRET } = require('../config/env');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// Helper function to generate tokens and session
async function generateTokens(userId, rememberMe = false) {
  // Generate short-lived access token (e.g. 1 hour)
  const accessToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });
  
  // Generate a cryptographically secure random string for the refresh token
  const refreshToken = crypto.randomBytes(40).toString('hex');
  
  // Expiry for refresh token (30 days if rememberMe, otherwise 1 day)
  const days = rememberMe ? 30 : 1;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  // Save session in DB
  await prisma.session.create({
    data: {
      userId,
      refreshToken,
      expiresAt
    }
  });

  return { accessToken, refreshToken };
}

// 0. GOOGLE ILE GIRIŞ YAP VEYA KAYIT OL - POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    const { token, rememberMe } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Google token is required.' });
    }

    // Verify token with Google
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const { sub: googleId, email, name } = payload;

    // Check if user exists by googleId OR email
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId: googleId },
          { email: email }
        ]
      }
    });

    if (user) {
      // If user exists by email but doesn't have googleId linked, link it now
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: googleId }
        });
      }
    } else {
      // User doesn't exist, create them
      user = await prisma.user.create({
        data: {
          email,
          name,
          googleId,
        },
      });

      // Otomatik olarak Workspace ve Team oluşturma
      const workspace = await prisma.workspace.create({
        data: {
          name: `${user.name}'s Workspace`,
          members: {
            create: { userId: user.id, role: 'ADMIN' }
          },
          teams: {
            create: {
              name: 'Work',
              description: 'Default team',
              members: {
                create: { userId: user.id, role: 'ADMIN' }
              }
            }
          }
        },
        include: { teams: true }
      });

      const teamId = workspace.teams[0].id;

      // Otomatik olarak "My Tasks" projesi oluşturma (Aynı Register gibi)
      await prisma.project.create({
        data: {
          name: 'My Tasks',
          status: 'MY_TASKS',
          ownerId: user.id,
          workspaceId: workspace.id,
          teamId: teamId,
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
              userId: user.id,
              role: 'ADMIN'
            }
          }
        }
      });
    }

    // Generate Tokens
    const tokens = await generateTokens(user.id, rememberMe);

    res.json({
      message: 'Google login successful!',
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: { id: user.id, name: user.name, email: user.email, darkMode: user.darkMode }
    });

  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(500).json({ error: 'Google authentication failed.', details: error.message });
  }
});

// 1. KAYIT OL (REGISTER) - POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, rememberMe } = req.body;

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

    // Otomatik olarak Workspace ve Team oluşturma
    const workspace = await prisma.workspace.create({
      data: {
        name: `${newUser.name}'s Workspace`,
        members: {
          create: { userId: newUser.id, role: 'ADMIN' }
        },
        teams: {
          create: {
            name: 'Work',
            description: 'Default team',
            members: {
              create: { userId: newUser.id, role: 'ADMIN' }
            }
          }
        }
      },
      include: { teams: true }
    });

    const teamId = workspace.teams[0].id;

    // Otomatik olarak "My Tasks" projesi oluşturma
    await prisma.project.create({
      data: {
        name: 'My Tasks',
        status: 'MY_TASKS',
        ownerId: newUser.id,
        workspaceId: workspace.id,
        teamId: teamId,
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

    // Generate Tokens
    const tokens = await generateTokens(newUser.id, rememberMe);

    res.status(201).json({ 
      message: 'Kullanıcı başarıyla oluşturuldu.', 
      userId: newUser.id,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: { id: newUser.id, name: newUser.name, email: newUser.email, darkMode: newUser.darkMode }
    });
  } catch (error) {
    res.status(500).json({ error: 'Kayıt esnasında bir hata oluştu.', details: error.message });
  }
});

// 2. GİRİŞ YAP (LOGIN) - POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

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

    // Generate Tokens
    const tokens = await generateTokens(user.id, rememberMe);

    res.json({
      message: 'Giriş başarılı!',
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: { id: user.id, name: user.name, email: user.email, darkMode: user.darkMode }
    });
  } catch (error) {
    res.status(500).json({ error: 'Giriş esnasında bir hata oluştu.', details: error.message });
  }
});
// 3. REFRESH TOKEN - POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token is required.' });
    }

    // Find the session
    const session = await prisma.session.findUnique({
      where: { refreshToken }
    });

    if (!session) {
      return res.status(401).json({ error: 'Invalid refresh token.' });
    }

    // Check if expired
    if (new Date() > session.expiresAt) {
      // Clean up expired session
      await prisma.session.delete({ where: { id: session.id } });
      return res.status(401).json({ error: 'Refresh token expired.' });
    }

    // Generate new access token
    const newAccessToken = jwt.sign({ userId: session.userId }, JWT_SECRET, { expiresIn: '1h' });
    
    // Rotate refresh token for security
    const newRefreshToken = crypto.randomBytes(40).toString('hex');
    
    // Update session in DB
    await prisma.session.update({
      where: { id: session.id },
      data: { refreshToken: newRefreshToken }
    });

    res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    res.status(500).json({ error: 'Token refresh failed.', details: error.message });
  }
});

// 4. LOGOUT - POST /api/auth/logout
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      // Attempt to delete the session if it exists
      await prisma.session.deleteMany({
        where: { refreshToken }
      });
    }
    
    res.json({ message: 'Logged out successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed.', details: error.message });
  }
});

// 5. PREFERENCES - PATCH /api/auth/me/preferences
router.patch('/me/preferences', authenticateToken, async (req, res) => {
  try {
    const { darkMode } = req.body;
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { darkMode }
    });
    res.json({ message: 'Preferences updated', user: { id: updatedUser.id, name: updatedUser.name, email: updatedUser.email, darkMode: updatedUser.darkMode } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update preferences', details: error.message });
  }
});

module.exports = router;