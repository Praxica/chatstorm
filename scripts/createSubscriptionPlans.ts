import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createSubscriptionPlans() {
  const plans = [
    {
      name: 'Free',
      monthlyTokenLimit: 100000, // 100K tokens per month
      priceCents: 0,
      isActive: true
    },
    {
      name: 'Pro',
      monthlyTokenLimit: 1000000, // 1M tokens per month
      priceCents: 999, // $9.99
      isActive: true
    }
  ];

  console.log('Creating subscription plans...');

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
    console.log(`Created/updated plan: ${plan.name}`);
  }

  console.log('Subscription plans created successfully!');
}

createSubscriptionPlans()
  .catch(e => {
    console.error('Error creating subscription plans:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 