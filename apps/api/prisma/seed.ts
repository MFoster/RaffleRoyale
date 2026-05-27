import { KycStatus, PrismaClient, RaffleStatus } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const rafflerPasswordHash = await hash('raffler-password', 12);
  const buyerPasswordHash = await hash('buyer-password', 12);

  const raffler = await prisma.user.upsert({
    where: { email: 'raffler@example.com' },
    update: {},
    create: {
      email: 'raffler@example.com',
      passwordHash: rafflerPasswordHash,
      kycStatus: KycStatus.VERIFIED,
    },
  });

  const buyer = await prisma.user.upsert({
    where: { email: 'buyer@example.com' },
    update: {},
    create: {
      email: 'buyer@example.com',
      passwordHash: buyerPasswordHash,
      kycStatus: KycStatus.PENDING,
    },
  });

  const raffle = await prisma.raffle.create({
    data: {
      rafflerId: raffler.id,
      title: 'PlayStation 5 Bundle',
      description: 'Seed raffle for local development',
      totalTickets: 100,
      ticketPrice: 500,
      status: RaffleStatus.ACTIVE,
      endTime: new Date(Date.now() + 1000 * 60 * 60 * 24),
    },
  });

  await prisma.raffleEvent.create({
    data: {
      raffleId: raffle.id,
      eventType: 'CREATED',
      metadata: {
        source: 'seed',
        buyerId: buyer.id,
      },
    },
  });

  // eslint-disable-next-line no-console
  console.log('Seed complete', {
    rafflerId: raffler.id,
    buyerId: buyer.id,
    raffleId: raffle.id,
  });
}

void main()
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
