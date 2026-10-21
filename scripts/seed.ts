import { PrismaClient } from "@prisma/client";

// Minimal seed: one user, account, demo session and a couple of tags.
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "demo@backtest.lab" },
    update: {},
    create: { email: "demo@backtest.lab", name: "Demo Trader" },
  });

  const account = await prisma.account.create({
    data: { userId: user.id, name: "Demo Account", startingEquity: 10_000 },
  });

  await prisma.session.create({
    data: {
      userId: user.id,
      accountId: account.id,
      symbol: "EURUSD",
      timeframe: "15m",
      startTime: Math.floor(Date.UTC(2024, 0, 1) / 1000),
      endTime: Math.floor(Date.UTC(2024, 0, 15) / 1000),
    },
  });

  for (const label of ["Liquidity Sweep", "Order Block", "London"]) {
    await prisma.tag.upsert({
      where: { userId_label: { userId: user.id, label } },
      update: {},
      create: { userId: user.id, label, category: label === "London" ? "session" : "setup" },
    });
  }

  console.log("Seed complete:", { userId: user.id, accountId: account.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
