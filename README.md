# Mycon — frontend com Firebase e gateway de tenant

O navegador autentica diretamente no Firebase Authentication e envia o ID token
ao gateway Node/TypeScript. O gateway valida assinatura, expiração/revogação e
tenant antes de encaminhar a chamada, com o mesmo método, path, query e corpo,
para o backend Spring.

## Desenvolvimento local

Pré-requisito: Node.js 22 LTS.

1. Copie `.env.example` para `.env.local` e preencha a configuração Web do
   Firebase.
2. Copie `gateway/.env.example` para `gateway/.env`.
3. Defina `GOOGLE_APPLICATION_CREDENTIALS` com o caminho absoluto da service
   account do Firebase.
4. Em dois terminais, execute:

```bash
npm run dev
npm run dev:gateway
```

Frontend: `http://localhost:5173`. Gateway: `http://localhost:3001`. Spring:
`http://localhost:8083`.

Para atribuir a claim `tenant_id` a um usuário:

```bash
cd gateway
npm run tenant:set -- usuario@empresa.com tenant-mycon
```

Use o tenant nativo do Firebase Authentication ou a custom claim `tenant_id`.
O detalhe do contrato de segurança com o Spring está em
[`docs/firebase-auth-gateway.md`](docs/firebase-auth-gateway.md).

## Validação

```bash
npm run typecheck
npm test
npm run build
npm run typecheck:gateway
npm run test:gateway
npm run build:gateway
```
