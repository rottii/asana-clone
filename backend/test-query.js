const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://asana_user:asana_password@localhost:5432/asana_db"
    }
  }
});

async function main() {
  const project = await prisma.project.findFirst({
    where: { name: 'yeni' }
  });
  console.log('--- PROJECT ---');
  console.log(project);

  const sections = await prisma.section.findMany({
    where: { projectId: project.id },
    select: {
        id: true,
        name: true,
        tasks: {
          select: { id: true, title: true }
        },
        secondaryTasks: {
          select: { task: { select: { id: true, title: true } } }
        }
    }
  });
  console.log('--- SECTIONS ---');
  console.log(JSON.stringify(sections, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
