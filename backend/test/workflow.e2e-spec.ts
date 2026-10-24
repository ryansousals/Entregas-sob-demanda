import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

type Actor = {
  id: string;
  email: string;
  token: string;
  courierId?: string;
  customerId: string;
};

type DeliveryResponse = {
  id: string;
  status: string;
  totalAmount: string;
  courierId: string | null;
  events: Array<{ status: string }>;
};

describe('Operação completa de entregas (PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let admin: Actor;
  let customer: Actor;
  let otherCustomer: Actor;
  let passwordHash: string;
  const password = 'SenhaExclusivaWorkflow123!';
  const userIds: string[] = [];
  const deliveryIds: string[] = [];
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousJwtSecret = process.env.JWT_SECRET;
  const api = () => request(app.getHttpServer());

  async function login(email: string) {
    const response = await api()
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    return (response.body as { accessToken: string }).accessToken;
  }

  async function actor(role: UserRole = UserRole.CUSTOMER) {
    const id = randomUUID();
    const user = await prisma.user.create({
      data: {
        id,
        name: `Pessoa workflow ${id.slice(0, 8)}`,
        email: `workflow-${id}@example.test`,
        phone: '85999999999',
        passwordHash,
        role,
        customerProfile: { create: {} },
        courierProfile:
          role === UserRole.COURIER
            ? { create: { isApproved: true, isAvailable: false } }
            : undefined,
      },
      include: { customerProfile: true, courierProfile: true },
    });
    userIds.push(id);
    return {
      id,
      email: user.email,
      customerId: user.customerProfile!.id,
      courierId: user.courierProfile?.id,
      token: await login(user.email),
    } satisfies Actor;
  }

  function deliveryBody(distanceKm = 3.5) {
    return {
      pickupAddress: 'Rua da Coleta, 123, Centro',
      dropoffAddress: 'Avenida da Entrega, 456, Aldeota',
      recipientName: 'Destinatário de teste',
      recipientPhone: '(85) 98888-8888',
      packageDescription: 'Pacote pequeno de documentos',
      pickupReference: 'Portaria principal',
      dropoffReference: 'Entregar na recepção',
      distanceKm,
    };
  }

  async function delivery(owner = customer) {
    const response = await api()
      .post('/deliveries')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(deliveryBody())
      .expect(201);
    const created = response.body as DeliveryResponse;
    deliveryIds.push(created.id);
    return created;
  }

  async function openShift(courier: Actor) {
    return api()
      .post(`/admin/couriers/${courier.courierId}/shifts/open`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(201);
  }

  async function onDutyCourier() {
    const courier = await actor(UserRole.COURIER);
    await openShift(courier);
    return courier;
  }

  function accept(order: DeliveryResponse, courier: Actor) {
    return api()
      .patch(`/deliveries/${order.id}/accept`)
      .set('Authorization', `Bearer ${courier.token}`);
  }

  beforeAll(async () => {
    const testDatabaseUrl = process.env.TEST_DATABASE_URL;
    if (!testDatabaseUrl) {
      throw new Error(
        'Informe TEST_DATABASE_URL para um PostgreSQL exclusivo de testes com as migrações aplicadas.',
      );
    }
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.JWT_SECRET = 'segredo-exclusivo-da-suite-workflow';
    prisma = new PrismaClient({ datasourceUrl: testDatabaseUrl });
    await prisma.$connect();
    passwordHash = await hash(password, 4);

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    admin = await actor(UserRole.ADMIN);
    customer = await actor();
    otherCustomer = await actor();
  }, 30_000);

  afterAll(async () => {
    try {
      if (prisma && userIds.length > 0) {
        await prisma.$transaction([
          prisma.deliveryEvent.deleteMany({
            where: { deliveryId: { in: deliveryIds } },
          }),
          prisma.delivery.deleteMany({ where: { id: { in: deliveryIds } } }),
          prisma.courierShift.deleteMany({
            where: {
              OR: [
                { courier: { userId: { in: userIds } } },
                { openedById: { in: userIds } },
              ],
            },
          }),
          prisma.courierProfile.deleteMany({
            where: { userId: { in: userIds } },
          }),
          prisma.customerProfile.deleteMany({
            where: { userId: { in: userIds } },
          }),
          prisma.user.deleteMany({ where: { id: { in: userIds } } }),
        ]);
      }
    } finally {
      await app?.close();
      await prisma?.$disconnect();
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousDatabaseUrl;
      if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousJwtSecret;
    }
  }, 30_000);

  it('cadastra clientes pela API e rejeita injeção de papel administrativo', async () => {
    const email = `workflow-register-${randomUUID()}@example.test`;
    await api()
      .post('/auth/register')
      .send({ name: 'Cliente público', email, password, role: 'ADMIN' })
      .expect(400);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();

    await api()
      .post('/auth/register')
      .send({ name: 'Cliente público', email, password, phone: '--------' })
      .expect(400);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();

    const response = await api()
      .post('/auth/register')
      .send({
        name: 'Cliente público',
        email,
        password,
        phone: '(85) 99999-1234',
      })
      .expect(201);
    const created = response.body as { id: string; role: string };
    userIds.push(created.id);
    expect(created.role).toBe('CUSTOMER');
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    const profile = await prisma.customerProfile.findUnique({
      where: { userId: created.id },
    });
    expect(profile).not.toBeNull();
    expect(
      await prisma.user.findUniqueOrThrow({ where: { id: created.id } }),
    ).toMatchObject({ phone: '(85) 99999-1234' });
    const token = await login(email);
    await api()
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => expect(body.role).toBe('CUSTOMER'));
  });

  it('recebe candidatura, aprova e reconhece o novo papel usando o mesmo token', async () => {
    const candidate = await actor();
    await api().post('/couriers/apply').send({}).expect(401);
    const response = await api()
      .post('/couriers/apply')
      .set('Authorization', `Bearer ${candidate.token}`)
      .send({})
      .expect(201);
    const profile = response.body as { id: string; isApproved: boolean };
    expect(profile.isApproved).toBe(false);
    await api()
      .post('/couriers/apply')
      .set('Authorization', `Bearer ${candidate.token}`)
      .send({})
      .expect(409);
    await api()
      .post('/couriers/apply')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({})
      .expect(403);
    await api()
      .patch(`/admin/couriers/${profile.id}/approve`)
      .set('Authorization', `Bearer ${candidate.token}`)
      .expect(403);
    await api()
      .patch(`/admin/couriers/${profile.id}/approve`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    await api()
      .get('/auth/me')
      .set('Authorization', `Bearer ${candidate.token}`)
      .expect(200)
      .expect(({ body }) => expect(body.role).toBe('COURIER'));
    const me = await api()
      .get('/couriers/me')
      .set('Authorization', `Bearer ${candidate.token}`)
      .expect(200);
    expect(me.body.profile).toMatchObject({
      id: profile.id,
      isApproved: true,
      isAvailable: false,
    });
    expect(
      await prisma.customerProfile.findUnique({
        where: { userId: candidate.id },
      }),
    ).not.toBeNull();
  });

  it('calcula preço no servidor, valida distância e recusa preço enviado pelo cliente', async () => {
    await api().get('/deliveries/pricing').expect(401);
    const pricing = await api()
      .get('/deliveries/pricing')
      .set('Authorization', `Bearer ${customer.token}`)
      .expect(200);
    const tariff = pricing.body as { baseFee: number; perKm: number };
    const quote = await api()
      .post('/deliveries/quote')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ distanceKm: 3.5 })
      .expect(201);
    expect(Number(quote.body.totalAmount)).toBeCloseTo(
      tariff.baseFee + 3.5 * tariff.perKm,
      2,
    );
    await api()
      .post('/deliveries/quote')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ distanceKm: 0 })
      .expect(400);
    await api()
      .post('/deliveries')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ ...deliveryBody(), totalAmount: '0.01' })
      .expect(400);
    await api()
      .post('/deliveries')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ ...deliveryBody(), recipientPhone: '........' })
      .expect(400);
    const created = await delivery();
    expect(
      await prisma.delivery.findUniqueOrThrow({ where: { id: created.id } }),
    ).toMatchObject({ recipientPhone: '(85) 98888-8888' });
    expect(Number(created.totalAmount)).toBe(Number(quote.body.totalAmount));
    expect(created.status).toBe('SEARCHING');
    expect(created.events.map((event) => event.status)).toEqual(['SEARCHING']);
  });

  it('isola os pedidos de cada cliente e protege mutações de outros usuários', async () => {
    const order = await delivery();
    await api()
      .get(`/deliveries/${order.id}`)
      .set('Authorization', `Bearer ${otherCustomer.token}`)
      .expect(403);
    await api()
      .patch(`/deliveries/${order.id}/cancel`)
      .set('Authorization', `Bearer ${otherCustomer.token}`)
      .expect(403);
    await api()
      .patch(`/deliveries/${order.id}/accept`)
      .set('Authorization', `Bearer ${customer.token}`)
      .expect(403);
    const own = await api()
      .get('/deliveries')
      .set('Authorization', `Bearer ${customer.token}`)
      .expect(200);
    expect(
      (own.body as Array<{ id: string }>).some((row) => row.id === order.id),
    ).toBe(true);
    expect(JSON.stringify(own.body)).not.toContain('passwordHash');
    const other = await api()
      .get('/deliveries')
      .set('Authorization', `Bearer ${otherCustomer.token}`)
      .expect(200);
    expect(
      (other.body as Array<{ id: string }>).some((row) => row.id === order.id),
    ).toBe(false);
  });

  it('restringe turnos ao administrador e registra abertura e fechamento', async () => {
    const courier = await actor(UserRole.COURIER);
    await api()
      .post(`/admin/couriers/${courier.courierId}/shifts/open`)
      .set('Authorization', `Bearer ${customer.token}`)
      .expect(403);
    const opened = await openShift(courier);
    expect(opened.body).toMatchObject({
      courierId: courier.courierId,
      openedById: admin.id,
      closedAt: null,
    });
    await api()
      .post(`/admin/couriers/${courier.courierId}/shifts/open`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(409);
    const closed = await api()
      .post(`/admin/couriers/${courier.courierId}/shifts/close`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(201);
    expect(closed.body.closedById).toBe(admin.id);
    expect(closed.body.closedAt).not.toBeNull();
    await api()
      .post(`/admin/couriers/${courier.courierId}/shifts/close`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(409);
    expect(
      await prisma.courierProfile.findUniqueOrThrow({
        where: { id: courier.courierId },
      }),
    ).toMatchObject({ isAvailable: false });
    const history = await api()
      .get('/admin/shifts')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(
      (history.body as Array<{ id: string }>).some(
        (shift) => shift.id === opened.body.id,
      ),
    ).toBe(true);
  });

  it('impede dois turnos abertos em requisições simultâneas', async () => {
    const courier = await actor(UserRole.COURIER);
    const responses = await Promise.all(
      [0, 1].map(() =>
        api()
          .post(`/admin/couriers/${courier.courierId}/shifts/open`)
          .set('Authorization', `Bearer ${admin.token}`),
      ),
    );
    expect(
      responses.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([201, 409]);
    expect(
      await prisma.courierShift.count({
        where: { courierId: courier.courierId, closedAt: null },
      }),
    ).toBe(1);
  });

  it('conclui a entrega com histórico e bloqueia saltos, cancelamento tardio e fechamento em serviço', async () => {
    const courier = await actor(UserRole.COURIER);
    const outsider = await actor(UserRole.COURIER);
    const order = await delivery();
    await accept(order, courier).expect(409);
    await api()
      .get('/deliveries/available')
      .set('Authorization', `Bearer ${courier.token}`)
      .expect(403);
    await openShift(courier);
    const queue = await api()
      .get('/deliveries/available')
      .set('Authorization', `Bearer ${courier.token}`)
      .expect(200);
    expect(JSON.stringify(queue.body)).not.toContain(customer.email);
    await accept(order, courier).expect(200);
    await api()
      .patch(`/deliveries/${order.id}/status`)
      .set('Authorization', `Bearer ${courier.token}`)
      .send({ status: 'DELIVERED' })
      .expect(409);
    await api()
      .post(`/admin/couriers/${courier.courierId}/shifts/close`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(409);
    await api()
      .patch(`/deliveries/${order.id}/status`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ status: 'PICKED_UP' })
      .expect(403);
    await api()
      .patch(`/deliveries/${order.id}/status`)
      .set('Authorization', `Bearer ${courier.token}`)
      .send({ status: 'PICKED_UP' })
      .expect(200);
    await api()
      .patch(`/deliveries/${order.id}/cancel`)
      .set('Authorization', `Bearer ${customer.token}`)
      .expect(409);
    for (const status of ['IN_TRANSIT', 'DELIVERED']) {
      await api()
        .patch(`/deliveries/${order.id}/status`)
        .set('Authorization', `Bearer ${courier.token}`)
        .send({ status })
        .expect(200);
    }
    const completed = await api()
      .get(`/deliveries/${order.id}`)
      .set('Authorization', `Bearer ${customer.token}`)
      .expect(200);
    expect(
      (completed.body as DeliveryResponse).events.map((event) => event.status),
    ).toEqual([
      'SEARCHING',
      'ASSIGNED',
      'PICKED_UP',
      'IN_TRANSIT',
      'DELIVERED',
    ]);
    await api()
      .post(`/admin/couriers/${courier.courierId}/shifts/close`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(201);
  });

  it('cancela antes da coleta e libera o entregador para aceitar outro pedido', async () => {
    const courier = await onDutyCourier();
    const order = await delivery();
    await accept(order, courier).expect(200);
    await api()
      .patch(`/deliveries/${order.id}/cancel`)
      .set('Authorization', `Bearer ${customer.token}`)
      .expect(200);
    await api()
      .patch(`/deliveries/${order.id}/cancel`)
      .set('Authorization', `Bearer ${customer.token}`)
      .expect(409);
    const next = await delivery();
    await accept(next, courier).expect(200);
    expect(
      await prisma.delivery.findUniqueOrThrow({ where: { id: order.id } }),
    ).toMatchObject({ status: 'CANCELLED' });
  });

  it('permite atribuição administrativa apenas para motoboy elegível e sem outro pedido ativo', async () => {
    const courier = await onDutyCourier();
    const order = await delivery();
    await api()
      .patch(`/deliveries/${order.id}/assign`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ courierId: courier.courierId })
      .expect(403);
    await api()
      .patch(`/deliveries/${order.id}/assign`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ courierId: courier.courierId })
      .expect(200);
    const next = await delivery();
    await api()
      .patch(`/deliveries/${next.id}/assign`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ courierId: courier.courierId })
      .expect(409);
  });

  it('aceita somente um motoboy quando dois disputam a mesma entrega', async () => {
    const first = await onDutyCourier();
    const second = await onDutyCourier();
    const order = await delivery();
    const responses = await Promise.all([
      accept(order, first),
      accept(order, second),
    ]);
    expect(
      responses.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([200, 409]);
    expect(
      await prisma.deliveryEvent.count({
        where: { deliveryId: order.id, status: 'ASSIGNED' },
      }),
    ).toBe(1);
    const stored = await prisma.delivery.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect([first.courierId, second.courierId]).toContain(stored.courierId);
  });

  it('não atribui duas entregas ativas ao mesmo motoboy em paralelo', async () => {
    const courier = await onDutyCourier();
    const first = await delivery();
    const second = await delivery();
    const responses = await Promise.all([
      accept(first, courier),
      accept(second, courier),
    ]);
    expect(
      responses.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([200, 409]);
    expect(
      await prisma.delivery.count({
        where: {
          courierId: courier.courierId,
          status: { in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] },
        },
      }),
    ).toBe(1);
  });

  it('mantém consistência ao disputar fechamento de turno com aceite de pedido', async () => {
    const courier = await onDutyCourier();
    const order = await delivery();
    const [accepted, closed] = await Promise.all([
      accept(order, courier),
      api()
        .post(`/admin/couriers/${courier.courierId}/shifts/close`)
        .set('Authorization', `Bearer ${admin.token}`),
    ]);
    expect([
      [200, 409],
      [409, 201],
    ]).toContainEqual([accepted.status, closed.status]);
    const profile = await prisma.courierProfile.findUniqueOrThrow({
      where: { id: courier.courierId },
      include: { shifts: { where: { closedAt: null } } },
    });
    const stored = await prisma.delivery.findUniqueOrThrow({
      where: { id: order.id },
    });
    if (accepted.status === 200) {
      expect(profile.isAvailable).toBe(true);
      expect(profile.shifts).toHaveLength(1);
      expect(stored.status).toBe('ASSIGNED');
    } else {
      expect(profile.isAvailable).toBe(false);
      expect(profile.shifts).toHaveLength(0);
      expect(stored.status).toBe('SEARCHING');
    }
  });

  it('permite motoboy solicitar entrega, mas impede que execute o próprio pedido', async () => {
    const courier = await onDutyCourier();
    const order = await delivery(courier);
    await accept(order, courier).expect(409);
  });

  it('oferece resumo e cadastros administrativos sem expor hashes de senha', async () => {
    for (const path of ['/admin/summary', '/admin/users', '/admin/couriers']) {
      await api()
        .get(path)
        .set('Authorization', `Bearer ${customer.token}`)
        .expect(403);
      const response = await api()
        .get(path)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
      expect(JSON.stringify(response.body)).not.toContain('passwordHash');
      if (path === '/admin/summary') {
        expect(response.body).toEqual(
          expect.objectContaining({
            totalDeliveries: expect.any(Number),
            activeDeliveries: expect.any(Number),
            deliveredDeliveries: expect.any(Number),
            totalRevenue: expect.any(String),
          }),
        );
      }
    }
  });
});
