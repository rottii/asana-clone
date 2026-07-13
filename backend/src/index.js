const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/project');
const rulesRoutes = require('./routes/rules');
const portfolioRoutes = require('./routes/portfolio');
const notificationsRoutes = require('./routes/notifications');
const goalsRoutes = require('./routes/goals');
const tagsRoutes = require('./routes/tags');
const reportingRoutes = require('./routes/reporting');
const { startCronScheduler } = require('./utils/cronScheduler');
const { startReminderCron } = require('./utils/reminders');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
  }
});

// Attach io to the app so routes can access it
app.set('io', io);

io.on('connection', (socket) => {
  console.log(`User connected to socket: ${socket.id}`);

  // When a user opens a project, they join a room specific to that project
  socket.on('join_project', (projectId) => {
    socket.join(projectId);
    console.log(`Socket ${socket.id} joined project room: ${projectId}`);
  });

  socket.on('leave_project', (projectId) => {
    socket.leave(projectId);
    console.log(`Socket ${socket.id} left project room: ${projectId}`);
  });

  // Personal room for inbox notifications
  socket.on('join_user', (userId) => {
    socket.join(userId);
    console.log(`Socket ${socket.id} joined personal room: ${userId}`);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected from socket: ${socket.id}`);
  });
});

const prisma = new PrismaClient();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Rotalar
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects/:projectId/rules', rulesRoutes);
app.use('/api/portfolios', portfolioRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/reporting', reportingRoutes);
app.use('/api/search', require('./routes/search'));

// Health Check
app.get('/api/health', async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    res.json({ status: 'UP', message: `Sistemde ${userCount} kullanıcı var.` });
  } catch (error) {
    res.status(500).json({ status: 'DOWN', error: error.message });
  }
});

httpServer.listen(PORT, () => {
  console.log(`Server ${PORT} portunda başarıyla başlatıldı (HTTP & WebSocket).`);
  startCronScheduler();
  startReminderCron(io);
});