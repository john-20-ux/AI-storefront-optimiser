import prisma from "../../app/db.server";

// Truncate all tables between integration tests for isolation.
export async function resetDb() {
  await prisma.oAuthState.deleteMany();
  await prisma.aiConnection.deleteMany();
  await prisma.scanSummary.deleteMany();
  await prisma.scanSettings.deleteMany();
  await prisma.shop.deleteMany();
  await prisma.session.deleteMany();
}

export { prisma };
