# Hostinger Temporary Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar uma prévia estática testável do Dice Invoker para hospedagem PHP compartilhada na Hostinger, sem publicar APIs, segredos ou aceitar score competitivo.

**Architecture:** O Next.js continua sendo a aplicação principal com backend autoritário. Um construtor específico remove temporariamente as rotas de API durante o export estático, ativa imagens sem otimização de servidor, restaura os fontes mesmo em caso de erro e produz uma pasta/ZIP exclusiva para `public_html`. A prévia exibe um aviso claro de modo demonstração.

**Tech Stack:** Next.js 16, React 19, TypeScript, Node.js test runner, PowerShell/ZIP para entrega Hostinger.

---

### Task 1: Regras seguras do pacote

**Files:**
- Create: `tools/hostinger-preview.test.mjs`
- Create: `tools/hostinger-preview-lib.mjs`

- [ ] Escrever testes que rejeitem variáveis privadas, rotas `/api` e CORS aberto.
- [ ] Executar `node --test tools/hostinger-preview.test.mjs` e confirmar falha por módulo ausente.
- [ ] Implementar geração do `.htaccess` e auditoria do pacote.
- [ ] Executar novamente e confirmar aprovação.

### Task 2: Modo visual de demonstração

**Files:**
- Modify: `src/components/game/CombatStage.tsx`
- Modify: `src/app/globals.css`
- Test: `src/components/game/CombatStage.test.tsx`

- [ ] Escrever teste exigindo o aviso “Prévia de demonstração”.
- [ ] Confirmar falha do teste.
- [ ] Renderizar o aviso somente com `NEXT_PUBLIC_HOSTINGER_PREVIEW=1`.
- [ ] Confirmar aprovação do teste.

### Task 3: Export estático reproduzível

**Files:**
- Modify: `next.config.ts`
- Modify: `package.json`
- Create: `tools/build-hostinger-preview.mjs`
- Create: `docs/deployment/hostinger.md`

- [ ] Adicionar configuração condicional `output: "export"` e imagens sem otimização.
- [ ] Criar construtor que isola `src/app/api`, executa o build, restaura as rotas e audita `out`.
- [ ] Gerar `dist/dice-invoker-hostinger-preview.zip` contendo somente arquivos públicos.
- [ ] Documentar upload para `public_html` e deixar explícito que login/ranking requerem hospedagem Node separada.

### Task 4: Verificação e publicação

**Files:**
- Modify: `docs/deployment/hostinger.md`

- [ ] Executar testes, lint, typecheck e build normal.
- [ ] Executar o build Hostinger e inspecionar o ZIP contra segredos e rotas de API.
- [ ] Servir `out` localmente e testar desktop/mobile no navegador.
- [ ] Publicar o artefato/branch autorizado e testar `https://sandybrown-dog-375291.hostingersite.com/`.

