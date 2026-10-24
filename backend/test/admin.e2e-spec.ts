import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Administração dos motoboys (e2e com PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminToken: string;
  let customerToken: string;
  let passwordHash: string;
  let jwt: JwtService;
  const fixturePassword = 'SenhaExclusivaDosTestes123!';
  const userIds: string[] = [];
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousJwtSecret = process.env.JWT_SECRET;

  const api = () => request(app.getHttpServer());

  async function createUser(
    role: UserRole = UserRole.CUSTOMER,
    courier?: { isApproved: boolean; isAvailable: boolean },
  ) {
    const id = randomUUID();
    const user = await prisma.user.create({
      data: {
        id,
        name: 'Usuário de teste administrativo',
        email: `admin-e2e-${id}@example.test`,
        phone: '85999999999',
        passwordHash,
        role,
        customerProfile:
          role === UserRole.CUSTOMER ? { create: {} } : undefined,
        courierProfile: courier ? { create: courier } : undefined,
      },
      include: { customerProfile: true, courierProfile: true },
    });
    userIds.push(id);
    return user;
  }

  async function login(email: string) {
    const response = await api()
      .post('/auth/login')
      .send({ email, password: fixturePassword })
      .expect(201);
    const body = response.body as { accessToken: string };
    expect(typeof body.accessToken).toBe('string');
    return body.accessToken;
  }

  beforeAll(async () => {
    const testDatabaseUrl = process.env.TEST_DATABASE_URL;
    if (!testDatabaseUrl) {
      throw new Error(
        'Informe TEST_DATABASE_URL apontando para um PostgreSQL exclusivo de testes com as migrações aplicadas.',
      );
    }

    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.JWT_SECRET = 'segredo-exclusivo-da-suite-admin-e2e';
    // A URL explícita impede o uso acidental do DATABASE_URL carregado do .env.
    prisma = new PrismaClient({ datasourceUrl: testDatabaseUrl });
    await prisma.$connect();
    passwordHash = await hash(fixturePassword, 4);

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
    jwt = app.get(JwtService);

    const admin = await createUser(UserRole.ADMIN);
    const customer = await createUser();
    adminToken = await login(admin.email);
    customerToken = await login(customer.email);
  }, 30_000);

  afterAll(async () => {
    try {
      if (prisma && userIds.length > 0) {
        // Removemos somente as fixtures desta execução, preservando outros dados.
        await prisma.$transaction([
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

  it('retorna 401 sem token nas duas rotas e com token inválido', async () => {
    await api().get('/admin/couriers/pending').expect(401);
    await api().patch(`/admin/couriers/${randomUUID()}/approve`).expect(401);
    await api()
      .get('/admin/couriers/pending')
      .set('Authorization', 'Bearer token-invalido')
      .expect(401);
  });

  it('retorna 403 para cliente nas duas rotas sem aprovar o perfil', async () => {
    const candidate = await createUser(UserRole.CUSTOMER, {
      isApproved: false,
      isAvailable: false,
    });
    const profileId = candidate.courierProfile!.id;
    await api()
      .get('/admin/couriers/pending')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
    await api()
      .patch(`/admin/couriers/${profileId}/approve`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
    expect(
      await prisma.courierProfile.findUniqueOrThrow({
        where: { id: profileId },
      }),
    ).toMatchObject({ isApproved: false, isAvailable: false });
  });

  it('consulta a permissão atual no banco, mesmo com papel ADMIN no JWT', async () => {
    const user = await createUser(UserRole.ADMIN);
    const token = await jwt.signAsync({ sub: user.id, role: 'ADMIN' });
    await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.CUSTOMER },
    });
    await api()
      .get('/admin/couriers/pending')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('retorna 403 para entregador nas duas rotas administrativas', async () => {
    const courier = await createUser(UserRole.COURIER, {
      isApproved: true,
      isAvailable: false,
    });
    const token = await login(courier.email);
    await api()
      .get('/admin/couriers/pending')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await api()
      .patch(`/admin/couriers/${courier.courierProfile!.id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('lista pendentes para administrador e expõe somente os campos selecionados', async () => {
    const pending = await createUser(UserRole.CUSTOMER, {
      isApproved: false,
      isAvailable: false,
    });
    const approved = await createUser(UserRole.COURIER, {
      isApproved: true,
      isAvailable: false,
    });
    const response = await api()
      .get('/admin/couriers/pending')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const rows = response.body as Array<{
      id: string;
      createdAt: string;
    }>;
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.find((row) => row.id === pending.courierProfile!.id)).toEqual({
      id: pending.courierProfile!.id,
      isApproved: false,
      isAvailable: false,
      createdAt: pending.courierProfile!.createdAt.toISOString(),
      user: {
        id: pending.id,
        name: pending.name,
        email: pending.email,
        phone: pending.phone,
      },
    });
    expect(rows.some((row) => row.id === approved.courierProfile!.id)).toBe(
      false,
    );
    expect(rows.map((row) => row.createdAt)).toEqual(
      rows.map((row) => row.createdAt).sort(),
    );
    expect(JSON.stringify(rows)).not.toContain('passwordHash');
  });

  it('aprova usando o ID do perfil e mantém o entregador fora de serviço', async () => {
    const candidate = await createUser(UserRole.CUSTOMER, {
      isApproved: false,
      isAvailable: true,
    });
    const profileId = candidate.courierProfile!.id;
    const response = await api()
      .patch(`/admin/couriers/${profileId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(response.body).toMatchObject({
      courier: { id: profileId, isApproved: true, isAvailable: false },
    });
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: candidate.id },
      include: { customerProfile: true, courierProfile: true },
    });
    expect(user.role).toBe(UserRole.COURIER);
    expect(user.customerProfile?.id).toBe(candidate.customerProfile!.id);
    expect(user.courierProfile).toMatchObject({
      isApproved: true,
      isAvailable: false,
    });
    expect(
      await prisma.courierShift.count({ where: { courierId: profileId } }),
    ).toBe(0);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('retorna 400 para ID inválido e 404 para perfil inexistente', async () => {
    await api()
      .patch('/admin/couriers/nao-e-uuid/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
    await api()
      .patch(`/admin/couriers/${randomUUID()}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('retorna 409 ao repetir aprovação e preserva a disponibilidade existente', async () => {
    const courier = await createUser(UserRole.COURIER, {
      isApproved: true,
      isAvailable: true,
    });
    await api()
      .patch(`/admin/couriers/${courier.courierProfile!.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
    expect(
      await prisma.courierProfile.findUniqueOrThrow({
        where: { id: courier.courierProfile!.id },
      }),
    ).toMatchObject({ isApproved: true, isAvailable: true });
  });

  it.each([UserRole.ADMIN, UserRole.COURIER])(
    'retorna 409 para usuário %s sem alterar parcialmente o cadastro',
    async (role) => {
      const candidate = await createUser(role, {
        isApproved: false,
        isAvailable: true,
      });
      await api()
        .patch(`/admin/couriers/${candidate.courierProfile!.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: candidate.id },
        include: { courierProfile: true },
      });
      expect(user.role).toBe(role);
      expect(user.courierProfile).toMatchObject({
        isApproved: false,
        isAvailable: true,
      });
    },
  );

  it('confirma apenas uma de duas aprovações simultâneas', async () => {
    const candidate = await createUser(UserRole.CUSTOMER, {
      isApproved: false,
      isAvailable: false,
    });
    const profileId = candidate.courierProfile!.id;
    const responses = await Promise.all(
      [0, 1].map(() =>
        api()
          .patch(`/admin/couriers/${profileId}/approve`)
          .set('Authorization', `Bearer ${adminToken}`),
      ),
    );
    expect(
      responses.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([200, 409]);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: candidate.id },
      include: { courierProfile: true },
    });
    expect(user.role).toBe(UserRole.COURIER);
    expect(user.courierProfile).toMatchObject({
      isApproved: true,
      isAvailable: false,
    });
  });
});
