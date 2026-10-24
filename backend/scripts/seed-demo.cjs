const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');
const { loadEnvFile } = require('node:process');
const { resolve } = require('node:path');

async function seedDemo(prisma) {
  const passwordHash = await hash('EntregaLocal123!', 12);
  const baseFee = Number(process.env.DELIVERY_BASE_FEE ?? 10);
  const perKm = Number(process.env.DELIVERY_PER_KM ?? 2);
  if (
    ![baseFee, perKm].every((value) => Number.isFinite(value) && value >= 0)
  ) {
    throw new Error(
      'As tarifas de demonstração precisam ser números positivos.',
    );
  }
  const amount = (distance) => (baseFee + perKm * distance).toFixed(2);
  const hoursAgo = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000);

  await prisma.$transaction(
    async (tx) => {
      async function user(email, name, role, courier) {
        return tx.user.upsert({
          where: { email },
          update: {},
          create: {
            email,
            name,
            passwordHash,
            phone: '(85) 99999-0000',
            role,
            ...(role !== 'ADMIN' ? { customerProfile: { create: {} } } : {}),
            ...(courier
              ? {
                  courierProfile: {
                    create: {
                      isApproved: courier === 'approved',
                      isAvailable: false,
                    },
                  },
                }
              : {}),
          },
          include: { customerProfile: true, courierProfile: true },
        });
      }

      const admin = await user(
        'admin@entregaja.local',
        'Administrador EntregaJá',
        'ADMIN',
      );
      const customer = await user(
        'cliente@entregaja.local',
        'Marina Costa',
        'CUSTOMER',
      );
      const courier = await user(
        'motoboy@entregaja.local',
        'Lucas Oliveira',
        'COURIER',
        'approved',
      );
      await user(
        'candidato@entregaja.local',
        'Rafael Almeida',
        'CUSTOMER',
        'pending',
      );

      // Contas existentes nunca são promovidas, nem têm suas senhas ou perfis alterados.
      if (!customer.customerProfile) return;
      const pendingOrders = [
        {
          id: 'd1000000-0000-4000-8000-000000000001',
          pickupAddress: 'Rua das Palmeiras, 120 — Centro',
          dropoffAddress: 'Avenida Beira Mar, 580 — Meireles',
          pickupReference: 'Retirar na recepção do Mercado Vila Azul',
          dropoffReference: 'Portaria principal',
          recipientName: 'Ana Beatriz',
          recipientPhone: '(85) 99999-0101',
          packageDescription: 'Uma sacola de compras, até 3 kg',
          distanceKm: '4.5',
        },
        {
          id: 'd1000000-0000-4000-8000-000000000002',
          pickupAddress: 'Rua do Sol, 45 — Aldeota',
          dropoffAddress: 'Avenida Santos Dumont, 920 — Papicu',
          pickupReference: 'Loja de presentes, balcão de retirada',
          dropoffReference: 'Entregar em mãos',
          recipientName: 'Pedro Santos',
          recipientPhone: '(85) 99999-0202',
          packageDescription: 'Uma caixa de presente pequena',
          distanceKm: '3.2',
        },
      ];
      for (const [index, order] of pendingOrders.entries()) {
        const createdAt = new Date(Date.now() - (25 - index * 10) * 60 * 1000);
        await tx.delivery.upsert({
          where: { id: order.id },
          update: {},
          create: {
            ...order,
            customerId: customer.customerProfile.id,
            status: 'SEARCHING',
            totalAmount: amount(Number(order.distanceKm)),
            createdAt,
            events: {
              create: {
                status: 'SEARCHING',
                actorId: customer.id,
                note: 'Pedido de demonstração criado.',
                createdAt,
              },
            },
          },
        });
      }

      if (courier.courierProfile?.isApproved && admin.role === 'ADMIN') {
        await tx.courierShift.upsert({
          where: { id: 'a1000000-0000-4000-8000-000000000001' },
          update: {},
          create: {
            id: 'a1000000-0000-4000-8000-000000000001',
            courierId: courier.courierProfile.id,
            openedById: admin.id,
            closedById: admin.id,
            openedAt: hoursAgo(28),
            closedAt: hoursAgo(22),
          },
        });
        await tx.delivery.upsert({
          where: { id: 'd1000000-0000-4000-8000-000000000003' },
          update: {},
          create: {
            id: 'd1000000-0000-4000-8000-000000000003',
            customerId: customer.customerProfile.id,
            courierId: courier.courierProfile.id,
            pickupAddress: 'Rua das Flores, 80 — Centro',
            dropoffAddress: 'Rua da Paz, 210 — Cocó',
            recipientName: 'Juliana Lima',
            recipientPhone: '(85) 99999-0303',
            packageDescription: 'Documentos em envelope lacrado',
            distanceKm: '6.5',
            totalAmount: amount(6.5),
            status: 'DELIVERED',
            createdAt: hoursAgo(25),
            events: {
              create: [
                {
                  status: 'SEARCHING',
                  actorId: customer.id,
                  createdAt: hoursAgo(25),
                  note: 'Pedido criado.',
                },
                {
                  status: 'ASSIGNED',
                  actorId: courier.id,
                  createdAt: hoursAgo(24.9),
                  note: 'Motoboy aceitou a entrega.',
                },
                {
                  status: 'PICKED_UP',
                  actorId: courier.id,
                  createdAt: hoursAgo(24.7),
                  note: 'Encomenda coletada.',
                },
                {
                  status: 'IN_TRANSIT',
                  actorId: courier.id,
                  createdAt: hoursAgo(24.6),
                  note: 'Em deslocamento ao destino.',
                },
                {
                  status: 'DELIVERED',
                  actorId: courier.id,
                  createdAt: hoursAgo(24.2),
                  note: 'Entrega concluída.',
                },
              ],
            },
          },
        });
      }
    },
    { timeout: 30_000 },
  );
}

async function main() {
  try {
    loadEnvFile(resolve(__dirname, '..', '.env'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (process.env.SEED_DEMO !== 'true') {
    console.log(
      'Demonstração desabilitada. Para criar os dados locais, defina SEED_DEMO=true.',
    );
    return;
  }
  const prisma = new PrismaClient();
  try {
    await seedDemo(prisma);
    console.log(
      'Demonstração local preparada. Contas e pedidos existentes foram preservados.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch(() => {
    console.error(
      'Não foi possível preparar a demonstração. Verifique a conexão, as tarifas e as migrações do banco.',
    );
    process.exitCode = 1;
  });
}

module.exports = { seedDemo };
