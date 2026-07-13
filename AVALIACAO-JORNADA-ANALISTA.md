# Avaliação da jornada do analista de consórcio — mycon-test

Avaliação da experiência do analista que comprova a renda do contemplado para liberar o crédito.
Três eixos: (1) a jornada supre a necessidade do analista, (2) os dados exibidos estão corretos,
(3) a forma de exibição é adequada. Base: código das telas e da camada de domínio (não o backend).

Fluxo avaliado: `LoginScreen` → `PocContempladosScreen` (fila) → `CaseDrawer` (caso) →
`ScreenCliente` (análise) → `ScreenComposicao` (composição detalhada). Também `ClientListScreen` → `ScreenCliente`.

---

## 1. Veredito

A jornada está bem desenhada como narrativa visual (passos numerados, evidências, exportações,
identidade consistente), mas **falha no ponto central do produto: a métrica que o analista lê como
"renda" não é renda** — é a soma bruta de entradas, incluindo transferências entre contas do próprio
titular. Além disso, a **recomendação de aprovar/complementar ignora o valor da renda** e se apoia em
um único booleano. Para um analista de consórcio que precisa *comprovar renda*, isso é um risco de
decisão, não só de UX.

Há também divergências de cálculo entre a tela de análise, a composição e o Excel para os *mesmos*
indicadores, e o contexto de consórcio (grupo/cota/produto/valor da carta) desaparece justamente na
tela de análise.

Classificação por severidade: **3 bloqueadores conceituais**, **6 inconsistências de dado**,
**7 ajustes de exibição/jornada**.

---

## 2. A jornada supre a necessidade do analista?

### 2.1 O que já funciona bem

A fila operacional (`PocContempladosScreen`) dá visão de pipeline com métricas, filtros por estágio,
busca e pendências estruturadas — o analista sabe onde agir. O `CaseDrawer` concentra status de
consentimento, coleta, evidências, histórico e exportações num só lugar. A `ScreenCliente` conta uma
história de 5 passos (contexto → resumo → evidências → explicação → decisão) e a `ScreenComposicao`
permite auditar lançamento a lançamento. Estados de carregando/erro/retry e exportação Excel/PDF
existem e são consistentes. Isso cobre bem a parte de *acompanhamento e auditoria*.

### 2.2 Lacunas que impedem o analista de decidir

**A. O contexto de consórcio some na tela de análise.** `ScreenCliente` recebe apenas `clientId`
(App.jsx, linha 47-53) e monta `clienteFormatado` com `grupo`, `produto`, `contemplacao`,
`valor da carta`, `consultor`, `prioridade`, `telefone` **fixos em `—`** (linhas 101-123). Ou seja: ao
clicar "Abrir cliente" no drawer, o analista perde exatamente os dados do consórcio que justificam a
análise. Esses campos existem no `caseItem` (usados no Drawer e no Excel), mas não trafegam para a
análise.

**B. A "Decisão sugerida" não deixa decidir.** `onAprovar` e `onRevisaoManual` não são passados por
`App.jsx`, então os botões "Aprovar comprovação" e "Enviar para revisão manual" ficam desabilitados
(`disabled`, cursor `not-allowed`, título "Ação indisponível nesta POC"). O ápice da jornada é
inerte. O link "Renda não comprovada - revisar" é `href="#"`. Aceitável para POC, mas a tela se
vende como decisória.

**C. Falta o "porquê" acionável no caso negativo.** Quando não há renda recorrente, a orientação é
"solicitar complemento", sem dizer *quanto* falta nem *qual* evidência derrubou a comprovação. O
analista precisaria abrir a composição e inferir sozinho.

---

## 3. Os dados exibidos estão corretos? (validação)

### 3.1 Bloqueadores conceituais

**B1 — "Receita" inclui transferências entre contas do próprio titular.**
Em `ScreenCliente`, `m.total = num(mo.totalCredits)` e todas as métricas de "Receita" (média 3m, 12m,
volatilidade, capacidade de poupança) derivam desse total. O próprio info-tip admite: *"incluindo
transferências entre contas"* (linha 324). Para **comprovação de renda**, somar transferências do
titular para ele mesmo **infla a renda** e distorce a decisão. Já existem campos mais corretos —
`validatedIncome` (`val`), `recurring` (`rec`) e `computeRecurringIncome` — porém a tela de análise
usa o bruto. A métrica-título do produto não é a métrica certa.

**B2 — A recomendação de aprovar ignora o valor da renda.**
`DecisaoSugerida` e o card "Recomendação" decidem só por `cliente.fontes > 0`, que é
`insights.incomeDetected ? 1 : 0` — um booleano. Um cliente com renda recorrente de R$ 800 e
Débito/Receita 10× recebe "Aprovar comprovação de renda". Não entram no critério: valor da renda,
Débito/Receita, volatilidade, nº de meses recorrentes. A recomendação é rasa para o risco que carrega.

**B3 — A narrativa de metodologia não corresponde ao cálculo.**
A aba de Auditoria do Excel afirma: *"renda verificada = mediana do total mensal de créditos de
pagadores recorrentes (presentes em ≥4 meses)"* (exportExcel.js, linhas 414 e 574). **Essa mediana não
é calculada em lugar nenhum** — nem na UI, nem no export. A UI mostra médias de entradas totais; a
"renda validada" (`validatedIncome`) da API praticamente não é exibida. O documento de auditoria
promete um método que o sistema não executa — problema sério num artefato que se pretende
rastreável/auditável.

### 3.2 Inconsistências de dado

**D1 — Débito/Receita mistura duas bases.** (`ScreenCliente`, linhas 74-78)
`dividaTotal = debtToIncomeRatio × avgMonthlyIncome3m`, mas `debitoReceita = dividaTotal / receita3m`,
onde `receita3m` é a média das *entradas totais* (inclui transferências). Numerador vem da renda,
denominador vem das entradas brutas — bases diferentes. O resultado não é nem o DTI original nem um
múltiplo limpo.

**D2 — `debtToIncomeRatio` tem contrato não confirmado.** O próprio código comenta a incerteza
(exportExcel.js, linha 404). No Excel é exibido como percentual (`pct1`); em `ScreenCliente` é tratado
como fator e multiplicado por renda. Se a API mudar a convenção (0.35 vs 35 vs 2.0), o card
"Débito/Receita" quebra silenciosamente.

**D3 — "Capacidade de poupança" da tela ≠ da API/Excel.** (`ScreenCliente`, linhas 79-82)
`poupanca = receita3m − (avgMonthlyIncome3m − savingsCapacity3m) = savingsCapacity3m + (receita3m −
avgMonthlyIncome3m)`. Como `receita3m` (entradas totais) tende a ser maior que a renda, a tela mostra
uma poupança **inflada** frente ao `savingsCapacity3m` real — que é o que o Excel exibe direto (linha
387). Mesmo indicador, dois valores conforme a superfície.

**D4 — "Recorrência" tem três definições diferentes na mesma jornada.**
- Info-tips de `ScreenCliente`: *"pagador recorrente (créditos em ≥4 meses)"*.
- `CriterioCard` (composição): *"valor repetido em 2+ meses consecutivos ou mesma fonte em 3+ meses
  consecutivos"*.
- `domain.computeRecurringIncome`: implementa exatamente a segunda (≥2 consecutivos por valor OU ≥3
  por fonte).
- Excel (auditoria): *"pagadores recorrentes (presentes em ≥4 meses)"*.

E `cliente.fontes` vem de `insights.incomeDetected`, cujo critério de backend é um quarto,
desconhecido. O analista lê critérios que não batem entre si — corrói a confiança na análise.

**D5 — "Receita trimestral": soma numa tela, média na outra.**
`ScreenComposicao` mostra `receitaTrimestral` = **soma** dos últimos 3 meses (domain.ts, linha 436).
`ScreenCliente` mostra "Receita trimestral"/"Receita (3m)" = **média** mensal (linha 70-72). Mesmo
rótulo, conceitos diferentes → o analista compara maçãs com laranjas.

**D6 — Ordenação de meses assumida, não garantida.** `ScreenCliente` faz `slice(-3)`/`slice(-12)` sem
ordenar (`mesesIncome`), enquanto `domain.receitaTrimestral` ordena por `id` antes do slice. Se a API
não devolver os meses em ordem cronológica, "últimos 3 meses" da análise e da composição podem
apontar meses diferentes. Efeito subsequente concreto.

### 3.3 Cálculos derivados frágeis

- **`avgEntry` / `pixTotal`** (composição): `avgEntry = totalCredits / entryCount`, mas `entryCount` é
  o nº de linhas de `detail`. Se `detail` não cobrir todos os créditos que somam `totalCredits`, o
  "valor médio de entrada" (coluna destacada em azul, como métrica-chave) fica inflado. `pixTotal`
  (soma dos PIX de `detail`) pode não ser comparável ao `total` (todos os créditos). Vale validar se
  `detail` é sempre a base completa do `total`.
- **`confianca`** em `ScreenCliente`: `healthScore ? (>75?'Alta':'Média') : 'Baixa'` — praticamente
  nunca cai em "Baixa" (só com score falsy). Enquanto a composição usa `summary.confidence` da API.
  Duas noções de confiança convivem.
- **`mesesAnalisados`**: `media12m = somaEntradas / (summary.monthsAnalyzed || nº de meses)`. Se
  `monthsAnalyzed=12` mas só houver 5 meses com dado, a média é diluída (subestima a renda) — ou o
  contrário. Depende do contrato do `monthsAnalyzed`; hoje é assumido.

---

## 4. A forma de exibição é adequada?

### 4.1 Pontos fortes
Passos numerados, info-tips por indicador, tabela mensal com totais, detalhamento expansível por mês,
zebra/hover, badges de status com tom semântico, identidade Lizard consistente. Boa legibilidade de
alto nível.

### 4.2 Ajustes de exibição

**E1 — Redundância na `ScreenCliente`.** "Receita" e "Débito/Receita" aparecem em 3 blocos (Resumo
visual, Explicação para o operador, Informações do cliente) e a "Recomendação" em 2 (Resumo + Decisão)
com a mesma lógica. Muita repetição sem informação nova; alonga a rolagem e dilui a hierarquia.

**E2 — Mascaramento de CPF inconsistente e mais exposto.** `ScreenCliente` usa
`cpf.slice(-5).padStart(11,'●')` → mostra os **5 últimos dígitos**; Drawer/Excel usam o `maskCpf`
compartilhado. Padronizar no `maskCpf` (menos exposição, consistência).

**E3 — Rótulo do gráfico perde precisão.** `IncomeChart`: `R$ ${Math.round(v/1000)} mil`. R$ 1.400 →
"R$ 1 mil"; R$ 300 → "R$ 0 mil" com barra visível. Para valores baixos fica enganoso. Use 1 casa
("R$ 1,4 mil") ou o valor cheio no eixo/tooltip.

**E4 — `AccountTag` mostra subtítulo fixo.** Em `CaseDrawer`, `deriveAccountTags` calcula label
"Recebe renda"/"Conta de apoio", mas o subtítulo do card é sempre `"Conta considerada"` hardcoded
(linha 771). A distinção calculada só aparece na pílula lateral; o subtítulo ignora o resultado.

**E5 — Elementos inertes visíveis.** Sino de notificações sem ação (`Topbar`), links `href="#"`,
botões de decisão desabilitados. Numa demo com analista, sinalizar "em breve" ou ocultar evita a
sensação de quebrado.

**E6 — Densidade tipográfica.** Muitos textos em 10.5–11px com `textSubtle`/`textMuted`. Para uso
operacional prolongado e acessibilidade (WCAG AA), revisar contraste e piso de tamanho em rótulos e
subtextos.

**E7 — Nomear a métrica pelo que ela é.** Enquanto a base incluir transferências, o rótulo honesto é
"Entradas totais", não "Receita"/"Renda". Separar visualmente "Entradas totais" de "Renda comprovável
(recorrente)" alinha o vocabulário à decisão do analista.

---

## 5. Efeitos adjacentes/subsequentes a observar

- Corrigir B1 (excluir transferências da "Receita") **muda todos os números** exibidos e o Excel;
  precisa de reteste visual e de aprovação de negócio sobre a nova base.
- Se B2 virar recomendação multifator, definir os limiares com o time de risco/consórcio (renda
  mínima, teto de Débito/Receita, volatilidade máxima) — hoje inexistentes.
- Padronizar recorrência (D4) implica alinhar UI + `domain.ts` + texto do Excel + contrato do
  `incomeDetected` no backend, senão a divergência reaparece.
- Trafegar o contexto de consórcio para `ScreenCliente` (lacuna A) exige passar `caseItem`/params além
  do `clientId` — toca `App.jsx` e as assinaturas das telas.

---

## 6. Recomendações priorizadas

**P0 — Corrigir a base da renda (bloqueadores)**
1. Separar "Entradas totais" de "Renda comprovável" e basear a decisão na renda recorrente/validada,
   não no bruto (B1, B3, E7).
2. Tornar a recomendação multifator: renda + Débito/Receita + volatilidade + meses recorrentes (B2).
3. Unificar UMA definição de recorrência em UI, domínio, Excel e backend (D4).

**P1 — Coerência dos indicadores**
4. Débito/Receita e Capacidade de poupança: usar a mesma base em tela e Excel; confirmar o contrato de
   `debtToIncomeRatio` e `monthsAnalyzed` com o backend (D1, D2, D3, item 3.3).
5. Unificar "Receita trimestral" (soma vs média) e ordenar meses por `yearMonth` antes de qualquer
   `slice` na `ScreenCliente` (D5, D6).

**P2 — Jornada**
6. Levar grupo/cota/produto/valor da carta/contemplação para a tela de análise (lacuna A).
7. Habilitar (ou rotular claramente como "em breve") as ações de decisão e remover elementos inertes
   (lacunas B, E5).

**P3 — Exibição**
8. Padronizar máscara de CPF (E2), corrigir rótulo do gráfico (E3) e o subtítulo do `AccountTag` (E4),
   reduzir redundância na `ScreenCliente` (E1), revisar contraste/tamanho (E6).

---

*Escopo: avaliação da camada de apresentação e domínio no front. Os contratos reais da API
(`debtToIncomeRatio`, `monthsAnalyzed`, `validatedIncome`, critério de `incomeDetected`) precisam ser
confirmados no backend para fechar os itens marcados como "assumido".*
