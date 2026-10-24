const test = require('node:test');
const assert = require('node:assert/strict');
const { compare } = require('bcryptjs');
const { createAdmin, getAdminCredentials } = require('./create-admin.cjs');

test('normaliza o e-mail e preserva a senha informada', () => {
  const credentials = getAdminCredentials({
    ADMIN_EMAIL: '  Admin@Example.com  ',
    ADMIN_PASSWORD: '  senha-de-teste-com-espacos  ',
  });

  assert.deepEqual(credentials, {
    email: 'admin@example.com',
    password: '  senha-de-teste-com-espacos  ',
  });
});

test('recusa e-mail inválido e senhas incompatíveis com o bcrypt', () => {
  const valid = {
    ADMIN_EMAIL: 'admin@example.com',
    ADMIN_PASSWORD: 'senha-local-de-teste-123',
  };

  assert.throws(() => getAdminCredentials({}), /e-mail válido/);
  assert.throws(
    () => getAdminCredentials({ ...valid, ADMIN_EMAIL: 'sem-arroba' }),
    /e-mail válido/,
  );
  assert.throws(
    () => getAdminCredentials({ ...valid, ADMIN_PASSWORD: 'curta' }),
    /pelo menos 12/,
  );
  assert.throws(
    () => getAdminCredentials({ ...valid, ADMIN_PASSWORD: 'á'.repeat(37) }),
    /no máximo 72 bytes/,
  );
  assert.equal(
    getAdminCredentials({ ...valid, ADMIN_PASSWORD: 'á'.repeat(36) }).password,
    'á'.repeat(36),
  );
});

test('cria ADMIN com hash verificável e seleciona somente dados seguros', async () => {
  const password = 'senha-local-de-teste-123';
  const safeAdmin = {
    id: 'id-admin-teste',
    email: 'admin@example.com',
    role: 'ADMIN',
  };
  let createArguments;
  const prisma = {
    user: {
      async findUnique(arguments_) {
        assert.deepEqual(arguments_, {
          where: { email: 'admin@example.com' },
          select: { id: true },
        });
        return null;
      },
      async create(arguments_) {
        createArguments = arguments_;
        return safeAdmin;
      },
    },
  };

  const result = await createAdmin(prisma, {
    email: '  ADMIN@Example.com ',
    password,
  });

  assert.deepEqual(result, safeAdmin);
  assert.deepEqual(createArguments.select, {
    id: true,
    email: true,
    role: true,
  });
  assert.equal(createArguments.data.role, 'ADMIN');
  assert.equal(createArguments.data.email, 'admin@example.com');
  assert.notEqual(createArguments.data.passwordHash, password);
  assert.equal(
    await compare(password, createArguments.data.passwordHash),
    true,
  );
  assert.equal('password' in createArguments.data, false);
  assert.equal('passwordHash' in result, false);
});

test('não promove nem altera uma conta que já utiliza o e-mail', async () => {
  let writes = 0;
  const prisma = {
    user: {
      async findUnique() {
        return { id: 'cliente-existente' };
      },
      async create() {
        writes += 1;
      },
      async update() {
        writes += 1;
      },
    },
  };

  await assert.rejects(
    createAdmin(prisma, {
      email: 'cliente@example.com',
      password: 'senha-local-de-teste-123',
    }),
    /já possui uma conta/,
  );
  assert.equal(writes, 0);
});

test('trata também a disputa por e-mail ocorrida depois da consulta', async () => {
  const prisma = {
    user: {
      async findUnique() {
        return null;
      },
      async create() {
        throw Object.assign(new Error('unique constraint'), { code: 'P2002' });
      },
    },
  };

  await assert.rejects(
    createAdmin(prisma, {
      email: 'admin@example.com',
      password: 'senha-local-de-teste-123',
    }),
    /já possui uma conta/,
  );
});
