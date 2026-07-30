const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const tasks = await prisma.task.findMany({
    where: {
      section: {
        project: {
          isTemplate: true
        }
      },
      assigneeId: { not: null }
    },
    include: {
      section: {
        include: {
          project: true
        }
      }
    }
  });
  console.log(JSON.stringify(tasks, null, 2));
}

run();
