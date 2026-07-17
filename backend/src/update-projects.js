const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const team = await prisma.team.findFirst();
    if (team) {
        await prisma.project.updateMany({
            where: { teamId: null },
            data: { teamId: team.id }
        });
        console.log('Updated projects to team ' + team.name);
    }
}

run().finally(() => prisma.$disconnect());
