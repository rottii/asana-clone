const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { JWT_SECRET } = require('../config/env');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Giriş yapmanız gerekiyor. (Authentication required)' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if the user still exists in the database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return res.status(401).json({ 
        error: 'Oturumunuz geçersiz veya kullanıcınız silinmiş. Lütfen tekrar giriş yapın.' 
      });
    }

    // Attach decoded token to req.user (which includes userId)
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Geçersiz token.' });
  }
};

module.exports = { authenticateToken };
