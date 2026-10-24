# API EntregaJá

Backend NestJS com autenticação JWT, Prisma e PostgreSQL. O procedimento completo
para executar o sistema está no [README da raiz](../README.md). Para usar a
aplicação pronta localmente, execute `npm run local:init` na raiz do repositório.

## Desenvolvimento

Na raiz:

```bash
npm run setup
npm run dev
```

A API atende na porta 3000 por padrão. A interface Vite encaminha `/api` para a
API, removendo esse prefixo. No Docker, o nginx faz o mesmo encaminhamento.
As rotas do backend, portanto, não contêm `/api`.

## Rotas principais

- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`.
- `POST /couriers/apply`, `GET /couriers/me`.
- `GET /deliveries/pricing`, `POST /deliveries/quote`.
- `GET /deliveries`, `POST /deliveries`, `GET /deliveries/:id`.
- `GET /deliveries/available`, `PATCH /deliveries/:id/accept`.
- `PATCH /deliveries/:id/status`, `PATCH /deliveries/:id/cancel`.
- `PATCH /deliveries/:id/assign` para o administrador.
- `/admin/couriers`, `/admin/couriers/pending` e aprovação administrativa.
- `/admin/couriers/:id/shifts/open` e `/admin/couriers/:id/shifts/close`.
- `/admin/shifts`, `/admin/users`, `/admin/summary`.
- `GET /health/database` para verificar a conexão com o PostgreSQL.

As rotas operacionais exigem `Authorization: Bearer <accessToken>`. O papel é
consultado no banco em cada autenticação. As permissões são validadas no servidor.
A interface não escolhe o preço definitivo nem promove contas para administrador.

Os DTOs usam validação de tipos, limites e rejeição de campos não reconhecidos.
As aprovações, os turnos e a atribuição de entregas são transacionais. Índices
parciais no PostgreSQL protegem contra turnos e entregas ativas duplicadas.

## Banco e dados de demonstração

As migrações ficam em `prisma/migrations`. O startup Docker aplica as migrações
antes de iniciar a API. `scripts/seed-demo.cjs` cria a demonstração somente quando
`SEED_DEMO=true`; suas execuções seguintes preservam os registros existentes.

Para criar um administrador local sem dados de demonstração, siga
[Administração dos motoboys](docs/admin.md).

## Validação

```bash
npm run build
npm run lint
npm test -- --runInBand
node --test scripts/create-admin.test.cjs
```

Para os testes HTTP, forneça `TEST_DATABASE_URL` com as migrações aplicadas em um
PostgreSQL separado e execute:

```bash
npm run test:e2e -- --runInBand
```

O teste de saúde existente também precisa de `DATABASE_URL` e `JWT_SECRET`.
O comando `npm run test:e2e` da raiz prepara essas variáveis a partir da
`TEST_DATABASE_URL` e da configuração local.
