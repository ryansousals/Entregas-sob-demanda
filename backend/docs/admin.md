# Administração dos motoboys — Etapa 11

O administrador pode consultar solicitações pendentes e aprovar o cadastro de um
motoboy. A aprovação muda o papel do usuário de `CUSTOMER` para `COURIER` e define
`isApproved: true`, mantendo `isAvailable: false`. As alterações são feitas na
mesma transação; aprovar um cadastro não abre um turno.

O cadastro público continua criando somente clientes. A criação de uma conta
administrativa é um procedimento local, sem rota HTTP pública para escolher o
papel `ADMIN`.

## Criar a primeira conta administrativa

Execute os comandos na pasta `backend`, com Node.js 24, as dependências instaladas,
o Prisma Client gerado e as migrações já aplicadas. O script carrega o arquivo
`backend/.env` quando ele existe e preserva as variáveis já definidas no terminal.
`DATABASE_URL` precisa apontar para o banco de desenvolvimento que você pretende
usar. Não adicione `.env`, senhas ou tokens ao Git.

No PowerShell, informe um e-mail que ainda não tenha uma conta e uma senha
exclusiva com pelo menos 12 caracteres. O bcrypt aceita no máximo 72 bytes em
UTF-8; letras acentuadas podem ocupar mais de um byte.

```powershell
$env:ADMIN_EMAIL = Read-Host "E-mail do administrador"
$senhaSegura = Read-Host "Senha do administrador" -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new("", $senhaSegura).Password

try {
    npm run admin:create
}
finally {
    Remove-Item Env:\ADMIN_EMAIL -ErrorAction SilentlyContinue
    Remove-Item Env:\ADMIN_PASSWORD -ErrorAction SilentlyContinue
    Remove-Variable senhaSegura -ErrorAction SilentlyContinue
}
```

O resultado exibe apenas `id`, `email` e `role`. Uma conta com e-mail já existente
é recusada, inclusive se for de administrador: o script não promove clientes,
não redefine senhas e não altera contas existentes. Execute-o apenas no
desenvolvimento local; ele não precisa fazer parte do processo de implantação.

## Rotas administrativas

As duas rotas exigem `Authorization: Bearer <accessToken>`. O `JwtAuthGuard`
autentica o usuário e consulta seu papel atual no banco; depois o `AdminGuard`
exige o papel `ADMIN`.

| Método  | Rota                          | Resultado                                                                |
| ------- | ----------------------------- | ------------------------------------------------------------------------ |
| `GET`   | `/admin/couriers/pending`     | Lista os perfis com `isApproved: false`, do mais antigo ao mais recente. |
| `PATCH` | `/admin/couriers/:id/approve` | Aprova o perfil e mantém o entregador fora de serviço.                   |

O parâmetro `:id` é o `id` de **CourierProfile** retornado pela listagem,
não o `user.id`. A aprovação não exige corpo na requisição. Nenhuma resposta
dessas rotas retorna `passwordHash`.

## Testar no PowerShell

Inicie o backend em um terminal:

```powershell
npm run start:dev
```

Em outro terminal, faça login como administrador. Os exemplos usam a porta 3000;
ajuste-a se `PORT` estiver configurada com outro valor.

```powershell
$emailAdmin = Read-Host "E-mail do administrador"
$senhaSegura = Read-Host "Senha" -AsSecureString
$body = @{
    email = $emailAdmin
    password = [System.Net.NetworkCredential]::new("", $senhaSegura).Password
} | ConvertTo-Json

try {
    $login = Invoke-RestMethod `
        -Uri "http://localhost:3000/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body
}
finally {
    Remove-Variable body -ErrorAction SilentlyContinue
    Remove-Variable senhaSegura -ErrorAction SilentlyContinue
}

$adminHeaders = @{ Authorization = "Bearer $($login.accessToken)" }
$pendentes = Invoke-RestMethod `
    -Uri "http://localhost:3000/admin/couriers/pending" `
    -Headers $adminHeaders

$pendentes | ConvertTo-Json -Depth 4
```

Uma lista vazia `[]` é válida quando não há perfis pendentes. Esta etapa usa
os perfis `CourierProfile` já existentes; o repositório ainda não possui uma
rota para solicitar o cadastro de motoboy.

Quando houver um perfil pendente, copie o `id` dele e execute:

```powershell
$courierId = Read-Host "ID do perfil do motoboy"
Invoke-RestMethod `
    -Uri "http://localhost:3000/admin/couriers/$courierId/approve" `
    -Method PATCH `
    -Headers $adminHeaders
```

A resposta deve informar sucesso e retornar o perfil com `isApproved: true` e
`isAvailable: false`. O perfil deixa de aparecer na listagem de pendentes.

Confira também os bloqueios:

| Situação                                                 | HTTP esperado      |
| -------------------------------------------------------- | ------------------ |
| Sem token, token inválido ou expirado                    | `401 Unauthorized` |
| Token válido de cliente ou motoboy                       | `403 Forbidden`    |
| Administrador informa um ID que não é UUID               | `400 Bad Request`  |
| Administrador informa UUID de perfil inexistente         | `404 Not Found`    |
| Perfil já aprovado ou usuário incompatível com aprovação | `409 Conflict`     |

Para verificar o `403`, repita o login com uma conta de cliente e tente consultar
`/admin/couriers/pending` usando o token desse cliente. Não use o token
administrativo nesse teste. Ao terminar, remova as variáveis com os tokens do
terminal:

```powershell
Remove-Variable login, adminHeaders -ErrorAction SilentlyContinue
```

## Testes automatizados

Os testes HTTP usam um PostgreSQL separado, com as migrações do projeto
aplicadas. Defina `TEST_DATABASE_URL` para esse banco; a suíte administrativa
exige essa variável e remove somente os dados que ela própria cria.

```powershell
$env:TEST_DATABASE_URL = Read-Host "URL do PostgreSQL exclusivo de testes"
npm run test:e2e -- --runInBand admin.e2e-spec.ts
node --test scripts/create-admin.test.cjs
```

A suíte verifica autenticação, autorização, dados retornados e aprovação no
banco, incluindo duas aprovações simultâneas do mesmo perfil: uma retorna `200`
e a outra `409`. Os testes do script verificam a validação das credenciais e
que contas existentes não são promovidas ou alteradas.

A abertura e o fechamento de turnos, com histórico e bloqueio de turnos
duplicados, ficam para a próxima etapa.
