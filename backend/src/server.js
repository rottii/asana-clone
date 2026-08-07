const { httpServer, bootstrapData } = require('./index');
const { startCronScheduler } = require('./utils/cronScheduler');
const { startReminderCron } = require('./utils/reminders');

const PORT = process.env.PORT || 5001;

httpServer.listen(PORT, async () => {
  console.log(`Server ${PORT} portunda başarıyla başlatıldı (HTTP & WebSocket).`);
  await bootstrapData();
  startCronScheduler();
  if (global.io) {
    startReminderCron(global.io);
  }
});
