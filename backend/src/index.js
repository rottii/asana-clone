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
const dashboardRoutes = require('./routes/dashboard');
const { startCronScheduler } = require('./utils/cronScheduler');
const { startReminderCron } = require('./utils/reminders');

const Sentry = require('@sentry/node');
const { ProfilingIntegration } = require('@sentry/profiling-node');

const app = express();

// Initialize Sentry early
Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  integrations: [
    // enable HTTP calls tracing
    new Sentry.Integrations.Http({ tracing: true }),
    // enable Express.js middleware tracing
    new Sentry.Integrations.Express({ app }),
    new ProfilingIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set sampling rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: 1.0,
});

// The request handler must be the first middleware on the app
app.use(Sentry.Handlers.requestHandler());
// TracingHandler creates a trace for every incoming request
app.use(Sentry.Handlers.tracingHandler());

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
  }
});

// Attach io to the app so routes can access it
app.set('io', io);
global.io = io;

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

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xssSanitizer = require('./middleware/xssSanitizer');
const auditLogger = require('./middleware/auditLogger');

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" } // allow images to be loaded
}));

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(xssSanitizer);
app.use(auditLogger);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per window
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});

app.use('/api', apiLimiter);

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
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/github', require('./routes/github'));
app.use('/api/ai', require('./routes/ai'));

// Health Check
app.get('/api/health', async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    res.json({ status: 'UP', message: `Sistemde ${userCount} kullanıcı var.` });
  } catch (error) {
    res.status(500).json({ status: 'DOWN', error: error.message });
  }
});

const globalErrorHandler = require('./middleware/errorHandler');

// The error handler must be before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

// Custom global error handler
app.use(globalErrorHandler);

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