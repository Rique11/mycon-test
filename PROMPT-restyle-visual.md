# Prompt — Reestilizar o repositório `mycon-test` com o visual do POC-MYCON

Copie o bloco abaixo e cole em um novo chat (com acesso às duas pastas).

---

## Contexto

Tenho dois projetos conectados:

- **`mycon-test`** — pacote React (Vite) já funcional do PoC Open Finance da Mycon. Telas: `LoginScreen`, `ClientListScreen`, `ScreenCliente`, `ScreenComposicao`. Estilo atual em `lizard.css` + tokens em `tokens.js`. Componentes em `components/` (Avatar, Badge, Card, Icon, Sidebar, StepNumber). Hooks em `hooks/`, serviços em `services/`.
- **`Lizard design system` (POC-MYCON)** — protótipo visual de referência no arquivo `POC Open Finance - Contemplados.dc.html`, com screenshot em `screenshots/panel.png` e assets em `assets/` (`logo-app-icon.png`, `mark-white.png`). **Esta é a identidade visual que quero aplicar.**

## Objetivo

Reestilizar o `mycon-test` para que sua aparência fique **idêntica à identidade visual proposta no POC-MYCON** ("Lizard Intelligence"), **sem alterar o comportamento funcional** das telas (rotas, estados, chamadas de API, props e hooks permanecem). É uma migração de *look & feel*, não de lógica.

## Identidade visual de destino (extraída do HTML de referência)

Aplique exatamente estes tokens. Atualize `tokens.js` e `lizard.css` como fonte única de verdade e refatore os componentes para consumi-los (evite cores hard-coded espalhadas).

**Fundo e superfícies**
- Fundo da aplicação: `#F5F8FC`
- Superfície/cartão: `#FFFFFF`
- Superfícies suaves / inputs / hover: `#FAFBFE`, `#F2F5FA`, `#F7F9FC`

**Bordas**
- Borda padrão: `#E4EAF2`
- Borda mais forte: `#DDE5F0`

**Texto**
- Títulos fortes: `#101A33`
- Texto principal: `#1B2335` / `#141B2E`
- Texto secundário (muted): `#5F6F89`
- Texto sutil / placeholders: `#8A99B4`, `#A6B2C8`

**Marca / primária**
- Azul de ação (botões): `#2454D9` (hover `#1F4FE0`)
- Azul de destaque (links, item ativo do menu): `#1F4FE0`
- Fundo suave da primária (item ativo, chips): `#EAF0FE` (borda `#D4E0FB`)
- Azul-marinho da marca (logo, avatares, badges de iniciais): `#102A73`

**Estados (semânticos)**
- Sucesso: `#1B7F4B` / `#27A567`, fundo `#E6F6EE`
- Atenção/aviso: `#B7791F` / `#946312`, fundo `#FBF6E9` / `#FBF1DE`, borda `#F1E4C2`
- Erro/perigo: `#C13238` / `#E5484D`, fundo `#FBE9EA`

**Tipografia**
- Fonte de interface: **Inter** (400/500/600/700)
- Fonte numérica/monoespaçada (valores, datas, CPF, código): **JetBrains Mono** (400/500/600), com `font-variant-numeric: tabular-nums` (classe `.num`)

**Raios de borda**
- Padrão: `9px` · botões/cartões: `10–12px` · modais: `14–16px` · pills/badges: `999px`

**Sombras**
- Botão primário: `0 2px 6px rgba(36,84,217,.28)`
- Logo/elemento de marca: `0 1px 2px rgba(16,42,115,.18)`
- Modal: `0 24px 60px rgba(16,26,51,.28)`
- Slide-over (painel lateral): `-12px 0 40px rgba(16,26,51,.18)`

**Animações** (manter as do protótipo)
- `@keyframes panelIn` (entrada de modal/slide-over) e `@keyframes fadeIn`.

## Padrões de layout a reproduzir

- **Sidebar (248px)** branca com: logo "Lizard / INTELLIGENCE", seletor de workspace "Mycon Crédito · Ambiente PoC", navegação com ícones (Painel, POC Contemplados, Clientes, Relatórios, Configurações) — item ativo com fundo `#EAF0FE`, texto `#1F4FE0` e barra lateral de 3px `#2454D9`; rodapé com badge "Ambiente de testes · POC" (estilo aviso) e bloco de usuário com avatar de iniciais.
- **Topbar (60px)** branca com campo de busca (`#F2F5FA`), atalho `⌘K`, relógio em JetBrains Mono, botão de notificações com ponto vermelho e avatar.
- **Cabeçalho de página** com `<h1>` 24px peso 700 `#101A33`, chip "Mycon × Lizard" (pill azul suave) e subtítulo `#5F6F89`.
- **Cartões de métrica/KPI**, **tabela operacional** com hover de linha, **modal "Novo contemplado"** e **slide-over de detalhe** seguindo as sombras/animações acima.
- Reaproveite os ícones SVG (stroke, `stroke-width` ~1.75) já presentes em `tokens.js` (objeto `I`) e no HTML de referência.
- Use os assets de marca do POC-MYCON (`logo-app-icon.png`, `mark-white.png`) quando fizer sentido para a identidade.

## Restrições e cuidados (analisar antes de aplicar)

1. **Não altere a lógica**: mantenha props, estados, hooks (`useAuth`, `useClientData`, `useClientList`), serviços e o fluxo de navegação do `App.jsx` intactos. Mudança é apenas visual/CSS/markup de apresentação.
2. **Centralize os tokens** em `tokens.js`/`lizard.css` e faça os componentes consumirem-nos; não espalhe hex soltos.
3. **Acessibilidade**: garanta contraste adequado (texto sobre fundos suaves), estados de `:focus` visíveis e `aria` preservados.
4. **Responsividade**: verifique que a sidebar e a tabela não quebrem em larguras menores.
5. **Verifique efeitos colaterais**: analise se a troca de paleta/raios quebra algum componente compartilhado (Badge, Card, Avatar, Sidebar) em qualquer das 4 telas. Rode `npm install` e `npm run build` ao final e corrija erros.
6. **Convenção de comentários**: não adicione comentários relatando as modificações feitas; apenas um comentário no topo de cada arquivo explicando sua funcionalidade.
7. Siga as recomendações oficiais do React/Vite e da CSS moderna ao estruturar a solução.

## Entregáveis

- `tokens.js` e `lizard.css` atualizados com a nova identidade.
- Componentes e telas (`components/*`, `screens/*`, `ScreenCliente.jsx`, `ScreenComposicao.jsx`) reestilizados.
- Build passando (`npm run build`) e um resumo curto das mudanças visuais aplicadas, com antes/depois quando possível (screenshot).

Comece lendo `Lizard design system/POC Open Finance - Contemplados.dc.html`, `screenshots/panel.png` e os arquivos de estilo atuais do `mycon-test`, depois proponha o plano antes de editar.

---
