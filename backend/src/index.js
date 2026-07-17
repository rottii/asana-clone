const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/project');
const rulesRoutes = require('./routes/rules');
const messagesRoutes = require('./routes/messages');
const portfolioRoutes = require('./routes/portfolio');
const notificationsRoutes = require('./routes/notifications');
const goalsRoutes = require('./routes/goals');
const tagsRoutes = require('./routes/tags');
const reportingRoutes = require('./routes/reporting');
const workspacesRoutes = require('./routes/workspaces');
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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Rotalar
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects/:projectId/rules', rulesRoutes);
app.use('/api/projects/:projectId/messages', messagesRoutes);
app.use('/api/portfolios', portfolioRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/reporting', reportingRoutes);
app.use('/api/search', require('./routes/search'));
app.use('/api/workspaces', workspacesRoutes);

// Health Check
app.get('/api/health', async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    res.json({ status: 'UP', message: `Sistemde ${userCount} kullanıcı var.` });
  } catch (error) {
    res.status(500).json({ status: 'DOWN', error: error.message });
  }
});

// --- Data Migration / Bootstrap for Workspaces & Teams ---
async function bootstrapData() {
  let retries = 5;
  while (retries > 0) {
    try {
      await prisma.$connect();
      break;
    } catch (error) {
      console.log(`Database not ready, retrying in 2 seconds... (${retries} retries left)`);
      retries -= 1;
      if (retries === 0) {
        console.error('Failed to connect to database after multiple retries.');
        return;
      }
      await new Promise(res => setTimeout(res, 2000));
    }
  }

  try {
    const usersWithoutWorkspace = await prisma.user.findMany({
      where: {
        workspaceMembers: {
          none: {}
        }
      }
    });

    for (const user of usersWithoutWorkspace) {
      console.log(`Creating default workspace and team for user: ${user.email}`);
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

      // Assign all projects owned by this user to this workspace and team
      await prisma.project.updateMany({
        where: { ownerId: user.id, workspaceId: null },
        data: { workspaceId: workspace.id, teamId: teamId }
      });
    }

    // Migration to rename existing "General" default teams to "Work"
    await prisma.team.updateMany({
      where: { name: 'General', description: 'Default team' },
      data: { name: 'Work' }
    });
  } catch (error) {
    console.error('Error during bootstrap:', error);
  }
}

httpServer.listen(PORT, async () => {
  console.log(`Server ${PORT} portunda başarıyla başlatıldı (HTTP & WebSocket).`);
  await bootstrapData();
  startCronScheduler();
  startReminderCron(io);
});