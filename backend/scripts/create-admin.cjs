const { loadEnvFile } = require('node:process');
const { resolve } = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');

class AdminSetupError extends Error {}

function loadLocalEnvironment() {
  try {
    loadEnvFile(resolve(__dirname, '..', '.env'));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw new AdminSetupError(
        'Não foi possível carregar o arquivo backend/.env.',
      );
    }
  }
}

function getAdminCredentials(environment = process.env) {
  const email = environment.ADMIN_EMAIL?.trim().toLowerCase();
  const password = environment.ADMIN_PASSWORD;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AdminSetupError('Informe um e-mail válido em ADMIN_EMAIL.');
  }

  if (!password || password.length < 12) {
    throw new AdminSetupError(
      'Informe ADMIN_PASSWORD com pelo menos 12 caracteres.',
    );
  }

  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new AdminSetupError(
      'ADMIN_PASSWORD deve ter no máximo 72 bytes em UTF-8.',
    );
  }

  return { email, password };
}

async function createAdmin(prisma, credentials) {
  const { email, password } = getAdminCredentials({
    ADMIN_EMAIL: credentials.email,
    ADMIN_PASSWORD: credentials.password,
  });

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    throw new AdminSetupError(
      'Este e-mail já possui uma conta. Utilize um e-mail diferente.',
    );
  }

  try {
    return await prisma.user.create({
      data: {
        name: 'Administrador EntregaJá',
        email,
        passwordHash: await hash(password, 12),
        role: 'ADMIN',
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new AdminSetupError(
        'Este e-mail já possui uma conta. Utilize um e-mail diferente.',
      );
    }

    throw error;
  }
}

async function main() {
  loadLocalEnvironment();
  const credentials = getAdminCredentials();
  const prisma = new PrismaClient();

  try {
    const admin = await createAdmin(prisma, credentials);
    console.log('Administrador criado:', admin);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      error instanceof AdminSetupError
        ? error.message
        : 'Não foi possível criar o administrador. Verifique DATABASE_URL, as migrações e a conexão com o banco.',
    );
    process.exitCode = 1;
  });
}

module.exports = { createAdmin, getAdminCredentials };
