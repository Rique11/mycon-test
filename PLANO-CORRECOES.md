# Plano de Correções — mycon-test

Decisões base: projeto tratado como **app Vite** (não biblioteca), adoção de **TypeScript real**, escopo inclui itens críticos + estruturais.

Ordem de execução em fases — cada fase depende da anterior e termina com o app compilando (`npm run build` + `tsc --noEmit`).

---

## Fase 0 — Higiene de repositório

**0.1 Normalizar fim de linha (CRLF/LF)**
Problema: 37 arquivos aparecem modificados no `git status` só por fim de linha.
Método: criar `.gitattributes` com `* text=auto`, rodar `git add --renormalize .` e commitar. Elimina o ruído permanente no diff.

**0.2 Remover PII real dos seeds**
Problema: `hooks/usePocCases.js:114-133` contém CPF, e-mail e telefone reais de cliente, versionados.
Método: substituir o seed `pc-2051-romulo-pereira` por dados sintéticos (CPF inválido por dígito verificador, e-mail `@example.com`, telefone fictício), cobrindo **também `cpfMasked` e `notes`** (o CPF mascarado fica em campo separado e o `notes` identifica o cliente como real). Os demais seeds passam a usar CPFs sinteticamente inválidos.
Atenção: o dado já está no histórico do git e no remoto (`origin`). Remoção definitiva exige `git filter-repo` + force push — decisão à parte, fora deste plano. Tratar o CPF como exposto.

## Fase 1 — Fundações TypeScript

**1.1 Instalar e configurar TS**
Método: `npm i -D typescript`; criar `tsconfig.json` com `strict: true`, `jsx: "react-jsx"`, `moduleResolution: "bundler"`, `noEmit: true`, `allowJs: true` (convivência com .jsx durante a migração). Adicionar script `"typecheck": "tsc --noEmit"` no package.json.

**1.2 Migrar `services/api.js` → `services/api.ts` com tipos reais**
Problema: hooks `.ts` importam tipos (`TokenPair`, `ClientResponse`, `ClientInsightsResponse`, `Page`) que não existem — typecheck impossível.
Método: converter para TS exportando interfaces reais baseadas nas respostas efetivas do backend. A renomeação quebra os imports existentes: o resolver do Vite não mapeia `.js` → `.ts` automaticamente (isso é comportamento do TS em `node16/nodenext`, não do bundler). Na mesma passada:
- atualizar todos os specifiers para extensionless (`'../services/api'`) em hooks, telas e services, unificando os imports duplos de valor/tipo;
- `request()` aceita `AbortSignal` externo e aplica timeout via `AbortSignal.timeout()` (pré-requisito da Fase 3);
- erro de rede (`TypeError` do fetch) vira `ApiError` com status 0 e mensagem própria, em vez de mascarar como 500;
- remover import morto `TokenPair` em `useAuth.ts`.

## Fase 2 — Camada compartilhada (elimina duplicações divergentes)

**2.1 Criar `lib/format.ts`**
Conteúdo: `fmtBRL` (com guarda contra NaN — hoje `ScreenCliente` renderiza "R$ NaN"), `fmtDate` (com validação de data inválida), `onlyDigits` (substitui o `normalizeCpf` usado para telefone), `maskCpf` com **política única** `XXX.***.***-XX`.
Problema resolvido: `fmtBRL`/`fmt`, `fmtDate`/`formatDate` duplicados com comportamentos diferentes; `maskCpf` divergente entre tela (3 primeiros + 2 últimos) e Excel (5 últimos) — combinados expõem 8 de 11 dígitos do CPF.
Método: criar o módulo, substituir todas as ocorrências em `ScreenCliente`, `ScreenComposicao`, `exportExcel`, `usePocCases`, remover as cópias locais.

**2.2 Criar `services/domain.ts`**
Conteúdo: `PRODUCT_LABELS` (hoje duplicado em `usePocCases.js` e `exportExcel.js`), constantes de status/fila, regras puras (`getQueueBusinessRules`, `isConsentAccepted`), regras de classificação de lançamentos (REC/PIX/ENT/NREC/ATIP hoje embutidas em `ScreenComposicao.jsx:46-79`).
Método: mover funções puras sem alterá-las; importar nos consumidores. Regras puras isoladas ficam testáveis.

## Fase 3 — Hooks de dados

**3.1 Criar `hooks/useApiResource.ts` genérico**
Problema: `useClientData`, `useClientList` e `useIncomeComposition` triplicam o mesmo esqueleto e nenhum cancela fetch — respostas fora de ordem podem exibir dados do cliente errado (contraria a doc oficial do React sobre fetch em `useEffect`).
Método: hook único `useApiResource(fetcher, deps)` com `AbortController` no cleanup do `useEffect`, estado `{ data, loading, error, retry }`. Reescrever os três hooks sobre ele.

**3.2 Corrigir estado stale com id nulo**
`useClientData` e `useIncomeComposition` passam a limpar `data` quando `clientId`/parâmetros viram `null`.

**3.3 `useAuth`: sincronizar entre abas**
Método: além do `CustomEvent` local, escutar o evento `storage` do window.

**3.4 Fatiar `usePocCases.js` (531 linhas, 4 responsabilidades)**
Método: seeds → `services/pocSeeds.ts` (já sem PII pela Fase 0); regras puras e constantes → `services/domain.ts` (Fase 2); o hook mantém só estado + persistência. Na mesma passada: `localStorage.setItem` protegido com try/catch (hoje quebra render em modo privado/quota) e `normalizeCpf(form.phone)` trocado por `onlyDigits`.

## Fase 4 — Telas

**4.1 Fatiar `PocContempladosScreen.jsx` (1.924 linhas)**
Método de extração, mantendo comportamento:
- `components/poc/CaseDrawer.jsx` (~420 linhas, 8 estados) e `components/poc/NewCaseModal.jsx`;
- lógica de evidências do drawer → hook `hooks/useCaseEvidence.ts` (resolve também as deps implícitas do `useEffect` atual, usando ref para `onUpdateCase`);
- `resolveClientForCase` → `services/api.ts` (documentando a limitação do match por nome em página de 100);
- `deriveAccountTags`/`deriveInstitutions` memoizados com `useMemo`;
- timers de mensagens/labels com cleanup no `useEffect`;
- corrigir z-index modal (50) vs drawer (40);
- remover hint "Ctrl K" não implementado e default hardcoded `letterValue: 'R$ 420.000,00'`;
- hash de evidência fallback `-MOCK` e `consentExpiresAt` inventado (+7 dias): exibir explicitamente como indisponível ("—") em vez de fabricar valor.

**4.2 `ScreenCliente.jsx`**
- Corrigir rótulo da renda: campo é `avgMonthlyIncome3m`, UI diz "Mediana semestral (6m)" → rotular "Média mensal (3m)" (ou trocar o campo, se o backend expuser a mediana 6m — verificar contrato antes);
- botões de decisão sem `onClick`: expor callbacks via props (`onAprovar`, `onRevisaoManual`, `onDetalhes`) com estado desabilitado quando ausentes — sem handler fantasma;
- falha de exportação: exibir mensagem na UI em vez de só `console.error`;
- KPI "Atípicos R$ 0,00" fabricado: exibir "—" quando não houver dado real.

**4.3 `screens/ClientListScreen.jsx`**
- Guardas de null no filtro: `(c.name ?? '')`, `(c.email ?? '')`, `(c.cpf ?? '')` — hoje um registro com campo nulo derruba a tela;
- mesmo guard em `client.name.charAt(0)` (e no `Avatar.jsx:16`, que também quebra com `name` undefined);
- filtro com `useMemo`; remover `':hover'` morto do style inline.

**4.4 `ScreenComposicao.jsx`**
- `setOpen({...open})` → update funcional `setOpen(c => ...)`;
- `groupDetail(lines)` memoizado (`useMemo`) e `MesDetail` com `React.memo`;
- classificação de lançamentos consumida de `services/domain.ts` (Fase 2);
- gate no botão Exportar enquanto `clientData` não carregou (hoje exporta dossiê com cliente `undefined`).

**4.5 Criar `components/AsyncScreen.jsx`**
Bloco loading/erro repetido em 4 telas com divergências → componente único com Sidebar consistente.

## Fase 5 — Exportação

**5.1 Separar `services/exportPdf.ts` de `exportExcel.js`**
`exportExtratoPdf` (HTML/print) sai do arquivo de Excel. Na extração:
- **escape de HTML obrigatório** em toda interpolação (`client.name`, `row.history`, `row.account`, ...) — dados Open Finance são externos e hoje permitem XSS com acesso ao localStorage (tokens);
- abrir o popup com `noopener` efetivo (gerar Blob URL em vez de `document.write` em janela de mesma origem).

**5.2 `exportExcel.js` → `.ts` com import dinâmico**
`const ExcelJS = (await import('exceljs')).default` dentro das funções — tira ~940 KB do bundle principal (recomendação Vite de code-splitting). Corrigir `downloadWorkbook`: anexar `<a>` ao DOM e adiar `URL.revokeObjectURL` (setTimeout). `maskCpf` passa a vir de `lib/format.ts`.

## Fase 6 — Configuração

**6.1 `package.json` perfil de app**
Remover `main`, `module`, `exports`, `files`, `sideEffects`, `peerDependencies`. Mover `react`/`react-dom` para `dependencies` fixando `^19.0.0` (o que está instalado — o `peerDependencies` atual diz `>=18`, mas o projeto roda React 19). Manter `private: true` e scripts. Remover `index.js` (entrypoint de lib) se nada mais o importar.

**6.2 `vite.config.js`**
Remover o proxy para `https://api.datalizard.tech` com `Origin` forjado (aponta dev local para produção burlando CORS, e está morto: `api.ts` usa URL absoluta de `VITE_API_URL`). Se proxy local for necessário, apontar para o backend de dev via variável de ambiente.

**6.3 Alinhar `.env.example` com o código**
Porta correta é **8083** (backend Spring financeapp, confirmado no projeto ProdutoLizard). Unificar `.env.example` para `http://localhost:8083`, alinhado ao fallback do código.

**6.4 Favicon**
Criar `public/` e mover `logo-app-icon.png` (hoje o `index.html` referencia `/logo-app-icon.png` que não é servido → 404).

## Fase 7 — Verificação final

1. `npm install` limpo;
2. `npm run typecheck` sem erros;
3. `npm run build` sem erros e sem ExcelJS no chunk principal;
4. smoke test `npm run dev`: login, lista de clientes (inclusive com campo nulo simulado), fila POC, drawer, RaioX, composição, exports Excel/PDF;
5. grep final: nenhuma ocorrência de PII (incluindo fragmentos do CPF mascarado, ex.: `529.` e `-90`), `normalizeCpf(form.phone)`, `PRODUCT_LABELS` duplicado, `document.write` sem escape;
6. **Vitest mínimo**: `npm i -D vitest`, script `"test": "vitest run"`, testes unitários apenas para `lib/format.ts` e `services/domain.ts` — concretiza o argumento das Fases 2-3 de que regras puras ficam testáveis.

---

## Fora de escopo (registrado)

- **Tokens em localStorage**: mover refresh token para cookie httpOnly exige mudança no backend Spring. Fica documentado como trade-off da POC; o risco imediato cai com o fix do XSS (5.1).
- **Reescrita do histórico git** para expurgar o CPF real (0.2) — exige coordenação com o remoto.
- **Match de cliente por nome** limitado a 100 registros (`resolveClientForCase`) — o fix correto é endpoint de busca por CPF no backend.
