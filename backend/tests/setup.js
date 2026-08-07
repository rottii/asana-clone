const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

beforeAll(async () => {
  if (!process.env.DATABASE_URL.includes('test')) {
    throw new Error(`DANGER: Running tests against non-test database: ${process.env.DATABASE_URL}`);
  }
  
  // Clear all data before running the test suite
  const tablenames = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
  
  const tables = tablenames
    .map(({ tablename }) => tablename)
    .filter((name) => name !== '_prisma_migrations')
    .map((name) => `"public"."${name}"`)
    .join(', ');

  if (tables.length > 0) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
    } catch (error) {
      console.log('Error clearing database:', error);
    }
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});
