# Firebase Auth, gateway e isolamento por tenant

## Fluxo

```text
React -> Firebase Auth
React -> Node gateway -> Spring -> banco
         1. verifica ID token
         2. exige tenant assinado
         3. compara X-Tenant-ID, quando informado
         4. remove headers de identidade recebidos
         5. injeta identidade e tenant confiáveis
```

Todas as APIs já usadas pelo frontend continuam com os mesmos paths e contratos.
Somente `VITE_API_URL` passa a apontar para o gateway.

## Configuração Firebase

Ative o provedor E-mail/senha no Firebase Authentication e crie um app Web.
Copie sua configuração pública para `.env.local`.

O gateway aceita uma destas origens de tenant:

- Firebase Authentication multi-tenancy: claim nativa `firebase.tenant`;
- custom claim, por padrão `tenant_id`.

Se as duas claims existirem, elas precisam ser iguais. Quando o frontend envia
`X-Tenant-ID`, ele também precisa ser idêntico à claim. Um token válido sem
tenant recebe `403` com `REQUIRE_TENANT=true`.

Custom claims devem ser atribuídas somente em ambiente administrativo:

```bash
cd gateway
npm run tenant:set -- usuario@empresa.com tenant-mycon
```

O ID token deve ser renovado após a alteração (logout/login é suficiente).

## Contrato enviado ao Spring

Antes do proxy, o gateway descarta quaisquer valores fornecidos pelo cliente e
injeta:

| Header | Valor |
| --- | --- |
| `X-Tenant-ID` | tenant validado |
| `X-Authenticated-User-ID` | `uid` do Firebase |
| `X-Authenticated-User-Email` | e-mail verificado no token, quando presente |
| `X-Gateway-Timestamp` | instante da assinatura, quando há segredo |
| `X-Gateway-Signature` | HMAC-SHA256 da identidade, quando há segredo |

Payload da assinatura:

```text
timestamp\nuid\ntenantId\nemail
```

Configure o mesmo `GATEWAY_SHARED_SECRET` no gateway e no Spring. No Spring,
valide a assinatura com comparação de tempo constante, rejeite timestamps
antigos (por exemplo, mais de 30 segundos) e crie o contexto de tenant somente
depois dessa verificação.

## Autenticação entre gateway e Spring

`UPSTREAM_AUTH_MODE` permite adaptar a segurança existente:

- `forward-firebase` (padrão): mantém o ID token Firebase no `Authorization`;
- `service-token`: substitui por `UPSTREAM_SERVICE_TOKEN`;
- `none`: remove `Authorization`.

Para manter o Spring atual sem aceitar tokens Firebase, use `service-token` e
configure esse token como credencial interna, ou use `none` apenas se o Spring
estiver inacessível fora da rede privada e validar a assinatura do gateway.
Nunca exponha diretamente o Spring quando ele confia nesses headers.

## Isolamento de dados no Spring

A validação no gateway prova que o usuário pertence ao tenant informado. O
Spring ainda precisa aplicar `X-Tenant-ID` em toda consulta e mutação. Exemplo
conceitual:

```java
clientRepository.findByIdAndTenantId(clientId, tenantContext.requireTenantId());
```

Não use somente `findById(clientId)`: um identificador de cliente obtido de
outro tenant poderia atravessar o isolamento mesmo com um token válido.

Também mantenha `/api/v1/auth/login` e `/api/v1/auth/refresh` fora do fluxo do
frontend: login e renovação agora são responsabilidade do SDK Firebase.

## Produção

- execute o Spring em rede privada, aceitando tráfego somente do gateway;
- use HTTPS entre todas as camadas;
- mantenha `VERIFY_REVOKED_TOKENS=true`;
- restrinja `CORS_ORIGINS` aos domínios reais;
- use secrets do ambiente, nunca versione a service account;
- registre `uid`, tenant, método, path e status para auditoria, sem registrar o
  ID token.
