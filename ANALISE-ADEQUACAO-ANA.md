# Análise de adequação — mycon-test (romulo) ao padrão do front ProdutoLizard (Ana)

Análise dos ajustes necessários para que o `mycon-test` siga a mesma lógica de implementação do `ProdutoLizard/front`, com foco em **maneira de interação** (navegação, dados, formulários, feedback) e **padrões de segurança** (autenticação, sessão, tratamento de erros).

Referências analisadas no front da Ana: `App.tsx`, `contexts/AuthContext.tsx`, `services/api.ts`, `pages/*` (uso de TanStack Query), `tailwind.config.ts`, `eslint.config.js`, configs de Vitest/Playwright.

---

## 1. O que o romulo JÁ tem alinhado

Antes dos gaps, é importante registrar o que já segue a lógica da Ana — não refazer:

| Item | Situação |
|---|---|
| Cliente HTTP centralizado (`services/api.ts`) | **Alinhado.** Mesmo desenho da Ana: `BASE_URL` via `VITE_API_URL`, tokens em `localStorage` (`access_token`/`refresh_token`), injeção de `Authorization: Bearer`, refresh single-flight (Promise compartilhada), retry único em 401 com limpeza de sessão e redirect, `ApiError` com `status`/`body`, evento `auth:tokens-updated`. |
| Timeout de requisição | **Romulo está à frente.** Usa `AbortSignal.timeout` + `AbortSignal.any` (30s default); a Ana não tem timeout. Manter. |
| Sincronização de sessão entre abas | Alinhado: listener de `storage` + evento customizado, igual ao `AuthContext` da Ana. |
| Cancelamento de fetch em unmount | `useApiResource` já usa `AbortController` corretamente (evita setState pós-unmount e race conditions). |

O gap, portanto, não está na camada HTTP/token — está na **camada de aplicação**: navegação, orquestração de dados, contexto de sessão e validação de entrada.

---

## 2. Maneira de interação — gaps e adequações

### 2.1 Navegação: estado manual → React Router com rotas protegidas

**Ana:** `BrowserRouter` + `Routes` declarativas em `App.tsx`; rotas privadas envolvidas por `<ProtectedRoute>` (que aguarda `isLoading` antes de decidir, evitando redirect falso no reload) e agrupadas sob um `<AppLayout>` com `<Outlet>`. URLs com parâmetro (`/clients/:id`, `/clients/:id/insights`).

**Romulo:** navegação por `useState` (`section`, `tela`, `selectedClientId`) em `App.jsx`. Sem URL navegável, sem histórico do browser, sem deep-link.

**Adequação:**

1. Adicionar `react-router-dom` (v6+) e converter o `App.jsx`:
   - `/` → `LoginScreen`
   - `/poc` → `PocContempladosScreen` (protegida)
   - `/clientes` → `ClientListScreen` (protegida)
   - `/clientes/:id` → `ScreenCliente` (protegida)
   - `/clientes/:id/composicao` → `ScreenComposicao` (protegida)
   - `*` → NotFound
2. Trocar as props de navegação (`onVoltar`, `onVerComposicao`, `onSelectClient`, `onNavigate`) por `useNavigate()`/`<Link>` e `useParams()` para o `clientId`.
3. Criar `ProtectedRoute` no mesmo molde da Ana: `if (isLoading) return null; if (!isAuthenticated) return <Navigate to="/" replace />`.
4. Extrair um `AppLayout` com a `Sidebar` + `<Outlet>` (hoje cada tela monta a própria Sidebar — o layout compartilhado elimina essa repetição, igual ao `AppLayout` da Ana).

*Efeito adjacente a verificar:* `BrowserRouter` exige fallback de SPA no servidor de produção (a Ana usa Vite preview/host que já trata isso); em deploy estático, configurar rewrite para `index.html`. O estado `backLabel` ("Voltar para POC" vs "Voltar para clientes") hoje depende de `section`; com router, derivar da rota de origem (ex.: `location.state.from`).

### 2.2 Dados: hook artesanal → TanStack Query

**Ana:** `QueryClientProvider` com `retry: 1` e `staleTime: 60s`; leituras via `useQuery({ queryKey, queryFn })`, escritas via `useMutation` com `queryClient.invalidateQueries` no `onSuccess` (padrão consistente em `Categories.tsx`, `ClientDetail.tsx`, `AddClient.tsx`).

**Romulo:** `useApiResource` próprio (bem feito, mas sem cache, sem deduplicação de requisições, sem invalidação declarativa) e mutações imperativas dentro dos componentes/`usePocCases`.

**Adequação:**

1. Adicionar `@tanstack/react-query` e envolver o app no `QueryClientProvider` com as mesmas `defaultOptions` da Ana.
2. Migrar hooks de leitura mantendo a interface pública onde possível:
   - `useClientList` → `useQuery({ queryKey: ['clients'] })`
   - `useClientData(clientId)` → `useQuery({ queryKey: ['client', clientId] })`
   - `useIncomeComposition`, `useCaseEvidence` → idem, com `enabled: !!clientId`
3. Converter escritas (criação de caso em `NewCaseModal`, decisões no `CaseDrawer`) em `useMutation` + invalidação das queryKeys afetadas.
4. Aposentar `useApiResource` ao final da migração (o cancelamento por `AbortSignal` é nativo do React Query — `queryFn` recebe `{ signal }`, repassar ao `api.ts`, que já aceita signal).
5. `usePocCases` persiste em `localStorage`: manter como está por ser estado local da POC, ou modelar como query com `initialData` — decidir quando houver backend para os casos.

*Efeito adjacente a verificar:* `staleTime: 60s` muda o comportamento atual (dados podem ficar 1 min sem refetch); o retry automático (1x) pode duplicar percepção de lentidão em erro de rede — os estados de `AsyncScreen` (loading/erro/retry) mapeiam direto para `isLoading`/`isError`/`refetch`, manter o componente.

### 2.3 Formulários e validação de entrada

**Ana:** possui `react-hook-form` + `zod` + `@hookform/resolvers` nas dependências e o wrapper shadcn `ui/form.tsx`, mas o uso efetivo nas páginas é majoritariamente estado controlado + validação no submit. Ou seja: o padrão *instalado* é RHF+zod; o padrão *praticado* é validação manual centralizada.

**Romulo:** apenas `required` nativo do HTML no `LoginScreen`; `NewCaseModal` valida manualmente.

**Adequação (recomendada para reproduzir a direção da Ana, não só o estado atual):**

1. Adicionar `zod` e definir schemas para as entradas do usuário: login (email válido, senha não vazia), novo contemplado (CPF com dígito verificador — a regra já existe em `services/domain.ts`, reaproveitar dentro do schema via `z.string().refine(isValidCpf)`).
2. Validar no submit com `schema.safeParse` e exibir erros por campo — isso replica a interação da Ana (erro junto ao campo, botão desabilitado durante submissão) sem trazer o RHF inteiro, que só vale a pena se os formulários crescerem.
3. Nunca confiar só no `required` do HTML: é contornável e não valida formato (recomendação OWASP de validação client-side como UX + server-side como segurança).

### 2.4 Feedback ao usuário

**Ana:** estados de loading/erro por query, `NotFound` para rota inválida, mensagens de erro extraídas do body da API (`message`/`error`).

**Romulo:** `AsyncScreen` cobre loading/erro de tela cheia — manter; falta feedback para **mutações** (sucesso/erro de criação de caso, decisão registrada).

**Adequação:** padronizar feedback de mutação (mensagem inline ou toast leve) usando a mensagem do `ApiError` — mesma fonte que a Ana usa (`extractMessage` do body).

---

## 3. Padrões de segurança — gaps e adequações

### 3.1 Sessão baseada em perfil, não em presença de token

**Ana:** `AuthProvider` valida a sessão chamando `GET /api/v1/bankers/me` após login e no boot; `isAuthenticated` reflete token **e** o perfil carregável; `isLoading` evita liberar/negar rota antes da validação.

**Romulo:** `useAuth` considera autenticado quem tem `access_token` no `localStorage` — um token expirado/inválido passa como "logado" até a primeira chamada falhar.

**Adequação:**

1. Criar `AuthContext` + `AuthProvider` no molde da Ana: no boot com token presente, chamar um endpoint `/me` (ou o endpoint mais barato disponível no backend da POC) para validar a sessão antes de renderizar rotas protegidas.
2. Expor `isLoading` e usar no `ProtectedRoute` (evita flash de tela protegida com sessão morta e redirect falso em reload com sessão válida).
3. Guardar o hook `useAuth` atual como base — a sincronização por eventos já está correta.

### 3.2 Logout com revogação no servidor

**Ana:** `logout()` do `AuthContext` chama a API (`authApi`) antes de limpar tokens — o refresh token é revogado no backend.

**Romulo:** `logout()` apenas limpa o `localStorage`. O refresh token continua válido no servidor até expirar — se vazar, a sessão é reutilizável.

**Adequação:** chamar `POST /api/v1/auth/logout` (com o refresh token) antes de `clearTokens()`; limpar localmente mesmo se a chamada falhar (padrão fail-safe da Ana).

### 3.3 Armazenamento de tokens

Ambos guardam tokens em `localStorage`, que é vulnerável a XSS (qualquer script injetado lê os tokens). Como o objetivo é reproduzir o padrão da Ana, **manter localStorage é aceitável e consistente**, mas registrar o risco compartilhado:

- Mitigações já presentes nos dois: rotação de refresh token a cada refresh, retry único, limpeza em falha.
- Mitigação adicional barata em ambos: nenhum uso de `dangerouslySetInnerHTML` no romulo (verificado — só a Ana tem um uso controlado em `ui/chart.tsx`), manter assim; não interpolar input do usuário em HTML.
- Evolução futura (para os dois projetos): refresh token em cookie `HttpOnly; Secure; SameSite=Strict` — exige mudança no backend, fica fora do escopo desta adequação.

### 3.4 Higiene de configuração e superfícies menores

1. **`.env`:** o `.env.example` do romulo já segue o padrão `VITE_API_URL`; adotar também a documentação de CORS/portas que a Ana mantém no dela (origens permitidas explícitas no backend — nunca `*` com credenciais).
2. **`exportPdf.js`:** usa `window.open(url, '_blank', 'noopener')` — `noopener` correto (evita tabnabbing). Conferir que todo conteúdo injetado no documento do popup é escapado, pois dados de transação vêm da API.
3. **Fuga de dados em logs:** garantir que `console.log` não imprima tokens/CPF em produção (a Ana não loga payloads sensíveis; revisar os services do romulo na migração).
4. **ESLint:** a Ana usa flat config com `typescript-eslint`, `react-hooks` e `react-refresh`. Adotar o mesmo `eslint.config.js` no romulo — `react-hooks/exhaustive-deps` é o guarda-corpo principal na migração para React Query e o eslint de TS pega `any` implícito nos arquivos `.ts` existentes.

---

## 4. Stack de suporte (para fechar os quesitos citados)

| Quesito | Ana | Romulo hoje | Ação |
|---|---|---|---|
| TypeScript | Integral (`.tsx`) | Parcial (services/hooks em TS; telas em JSX) | Migrar gradualmente: novas telas em `.tsx`; converter telas existentes quando forem tocadas. `tsconfig.json` já existe. |
| ESLint | Flat config + typescript-eslint + react-hooks | Ausente | Copiar `eslint.config.js` da Ana e adicionar script `"lint": "eslint ."`. |
| Testes unitários | Vitest + Testing Library | Vitest (só funções puras: `format`, `domain`) | Adicionar `@testing-library/react` e cobrir `ProtectedRoute`, `AuthContext` e um fluxo de mutação. |
| E2E | Playwright (config standalone) | Ausente | Adicionar Playwright com um smoke test: login → lista → detalhe. Copiar `playwright.standalone.config.ts` da Ana como base. |
| Router | react-router-dom v6 | Ausente | Seção 2.1. |
| Dados | TanStack Query v5 | Hook próprio | Seção 2.2. |
| Validação | zod (disponível) | HTML `required` | Seção 2.3. |

**Fora do escopo desta adequação:** shadcn/ui + Tailwind. A identidade visual do mycon-test é regida pelo guia do henrique (`PROMPT-restyle-visual.md` — tokens.js/lizard.css como fonte única). Trocar a camada visual conflitaria com esse guia; a lógica de interação e segurança da Ana é reproduzível sem tocar no visual.

---

## 5. Ordem de execução sugerida (menor risco primeiro)

1. **ESLint + scripts** — sem impacto de runtime; expõe problemas antes das mudanças.
2. **AuthContext + ProtectedRoute + logout com revogação** (seções 3.1, 3.2) — muda pouco código, maior ganho de segurança.
3. **React Router** (2.1) — mecânica, mas toca todas as telas; fazer com o AuthContext já pronto.
4. **TanStack Query** (2.2) — migrar um hook por vez, começando por `useClientList`.
5. **Validação com zod** (2.3) — login e NewCaseModal.
6. **Feedback de mutação** (2.4) e testes (unit + e2e smoke).

Cada etapa termina com `npm run build` (+ `npm run lint` a partir da etapa 1) verde, conforme o guia do projeto.

## 6. Riscos e efeitos colaterais consolidados

- Deep-link com router exige fallback SPA no host de produção.
- `staleTime`/retry do React Query alteram o timing percebido de carregamento e erro.
- A validação de sessão via `/me` no boot adiciona uma chamada por reload — o `isLoading` do ProtectedRoute cobre a UX, mas o backend da POC precisa expor um endpoint equivalente; se não existir, validar com a chamada mais barata já usada (ex.: lista de clientes) ou decodificar o `exp` do JWT localmente como fallback.
- Migração de hooks para React Query deve preservar as assinaturas consumidas por `ScreenCliente`/`ScreenComposicao` para não reabrir o risco de regressão visual coberto pelo guia do henrique.
