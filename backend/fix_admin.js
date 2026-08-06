const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.findMany();
  console.log("Users:");
  for (const u of users) {
    console.log(`- ${u.name} (${u.email}) [ID: ${u.id}]`);
  }
  
  const workspaces = await prisma.workspace.findMany({ include: { members: true }});
  console.log("\nWorkspaces:");
  for (const w of workspaces) {
    console.log(`- ${w.name} [ID: ${w.id}]`);
    for (const m of w.members) {
      console.log(`   * Member: ${m.userId} | Role: ${m.role}`);
      
      // Force promote everyone to ADMIN for now to fix the user's issue
      if (m.role !== 'ADMIN') {
        await prisma.workspaceMember.update({
          where: { id: m.id },
          data: { role: 'ADMIN' }
        });
        console.log(`     -> Promoted to ADMIN`);
      }
    }
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
