# Dice Invoker Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar uma run Normal completa de dez salas, com Escudeiro, dados manipuláveis por Essência, combate autoritário, mapa ramificado, chefe, score e progressão persistente.

**Architecture:** Monólito modular em Next.js com regras puras isoladas do React e do Phaser. O servidor mantém o estado oficial, resolve RNG, comandos e score; o cliente envia somente intenções e anima estados já validados.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Phaser, Auth.js, Prisma, PostgreSQL, Zod, Vitest, Testing Library e Playwright.

---

## Mapa de arquivos

- `src/app/`: rotas, layouts, telas e route handlers.
- `src/modules/game-engine/`: tipos, RNG determinístico, regras de combate e score.
- `src/modules/content/`: schemas Zod e pacote da Temporada 1.
- `src/modules/run/`: máquina de estados, comandos e serviço transacional.
- `src/modules/security/`: rate limiting, headers, idempotência e auditoria.
- `src/modules/progression/`: desbloqueios e direitos cosméticos.
- `src/components/game/`: HUD, dados, mapa e adaptador Phaser.
- `prisma/`: schema, migrações e seed.
- `tests/`: integração, segurança e fluxo completo.

## Task 1: Scaffold seguro e ferramentas de teste

**Files:**
- Create: `package.json`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Criar o projeto Next.js na raiz**

Run:

```powershell
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Expected: `package.json`, `src/app`, `tsconfig.json` e configuração Tailwind criados sem remover `docs/`.

- [ ] **Step 2: Instalar runtime e testes**

Run:

```powershell
npm install zod phaser next-auth @auth/prisma-adapter @prisma/client
npm install -D prisma vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @playwright/test
```

Expected: dependências registradas no `package-lock.json`.

- [ ] **Step 3: Configurar Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    coverage: { reporter: ["text", "html"], include: ["src/modules/**/*.ts"] },
  },
});
```

Create `tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Add scripts to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 4: Criar contrato de ambiente sem segredos**

Create `.env.example`:

```dotenv
DATABASE_URL=postgresql://user:password@localhost:5432/dice_invoker
AUTH_SECRET=replace-with-32-byte-random-secret
AUTH_GITHUB_ID=replace-with-github-oauth-app-id
AUTH_GITHUB_SECRET=replace-with-github-oauth-secret
RUN_SEED_SECRET=replace-with-independent-32-byte-random-secret
```

- [ ] **Step 5: Verificar scaffold**

Run:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: todos os comandos encerram com exit code 0.

- [ ] **Step 6: Commit**

```powershell
git add package.json package-lock.json src vitest.config.ts tests/setup.ts .env.example .gitignore
git commit -m "chore: scaffold secure Next.js application"
```

## Task 2: Tipos de domínio e pacote sazonal validado

**Files:**
- Create: `src/modules/content/schema.ts`
- Create: `src/modules/content/season-1.ts`
- Create: `src/modules/content/content-loader.ts`
- Test: `src/modules/content/content-loader.test.ts`

- [ ] **Step 1: Escrever teste de validação do conteúdo**

```ts
import { describe, expect, it } from "vitest";
import { loadSeason } from "./content-loader";
import { seasonOne } from "./season-1";

describe("loadSeason", () => {
  it("aceita ids únicos e faces dentro do dado", () => {
    const season = loadSeason(seasonOne);
    expect(season.id).toBe("season-1");
    expect(season.heroes[0]?.id).toBe("squire");
    expect(season.dice.every((die) => die.faces.length === die.sides)).toBe(true);
  });

  it("rejeita ids duplicados", () => {
    expect(() => loadSeason({ ...seasonOne, dice: [seasonOne.dice[0], seasonOne.dice[0]] }))
      .toThrow(/duplicate/i);
  });
});
```

- [ ] **Step 2: Confirmar falha**

Run: `npm test -- src/modules/content/content-loader.test.ts`  
Expected: FAIL porque os módulos ainda não existem.

- [ ] **Step 3: Implementar schemas fechados**

Create `src/modules/content/schema.ts` com schemas `.strict()` para `Effect`, `Die`, `Hero`, `Enemy`, `Event`, `Room` e `Season`. O contrato central deve ser:

```ts
import { z } from "zod";

export const effectSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("damage"), amount: z.number().int().positive() }).strict(),
  z.object({ kind: z.literal("block"), amount: z.number().int().positive() }).strict(),
  z.object({ kind: z.literal("heal"), amount: z.number().int().positive() }).strict(),
]);

export const dieSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(80),
  rarity: z.enum(["common", "rare", "epic", "legendary", "relic"]),
  sides: z.number().int().min(4).max(20),
  faces: z.array(z.object({ id: z.string(), label: z.string(), effect: effectSchema }).strict()),
}).strict().superRefine((die, ctx) => {
  if (die.faces.length !== die.sides) ctx.addIssue({ code: "custom", message: "faces must equal sides" });
});
```

- [ ] **Step 4: Criar conteúdo mínimo da Temporada 1**

Create `season-1.ts` exportando `seasonOne` com Escudeiro, Maga, Arqueira, doze dados, oito inimigos, dois elites, seis eventos e Supervisor Gelatinoso. Cada referência deve usar id validado, nunca nome livre.

- [ ] **Step 5: Implementar loader com unicidade**

```ts
import { seasonSchema, type Season } from "./schema";

function assertUnique(label: string, ids: string[]) {
  if (new Set(ids).size !== ids.length) throw new Error(`duplicate ${label} id`);
}

export function loadSeason(input: unknown): Season {
  const season = seasonSchema.parse(input);
  assertUnique("hero", season.heroes.map((item) => item.id));
  assertUnique("die", season.dice.map((item) => item.id));
  assertUnique("enemy", season.enemies.map((item) => item.id));
  return Object.freeze(season);
}
```

- [ ] **Step 6: Testar e commitar**

Run: `npm test -- src/modules/content/content-loader.test.ts`  
Expected: PASS.

```powershell
git add src/modules/content
git commit -m "feat: add validated season content model"
```

## Task 3: RNG verificável e motor de combate puro

**Files:**
- Create: `src/modules/game-engine/rng.ts`
- Create: `src/modules/game-engine/types.ts`
- Create: `src/modules/game-engine/combat.ts`
- Test: `src/modules/game-engine/rng.test.ts`
- Test: `src/modules/game-engine/combat.test.ts`

- [ ] **Step 1: Escrever testes de determinismo e resolução**

```ts
import { describe, expect, it } from "vitest";
import { createRollStream } from "./rng";

it("repete a sequência para a mesma seed e cursor", () => {
  const a = createRollStream("seed", 0);
  const b = createRollStream("seed", 0);
  expect([a.roll(6), a.roll(6), a.roll(8)]).toEqual([b.roll(6), b.roll(6), b.roll(8)]);
});
```

```ts
import { expect, it } from "vitest";
import { resolveTurn } from "./combat";

it("aplica bloqueio antes do dano inimigo", () => {
  const result = resolveTurn({ heroHp: 20, enemyHp: 12, block: 4, heroDamage: 6, enemyDamage: 7 });
  expect(result).toEqual({ heroHp: 17, enemyHp: 6, blockRemaining: 0, outcome: "ongoing" });
});
```

- [ ] **Step 2: Confirmar falha**

Run: `npm test -- src/modules/game-engine`  
Expected: FAIL por imports ausentes.

- [ ] **Step 3: Implementar stream HMAC**

`rng.ts` usa `createHmac("sha256", seed).update(String(cursor))` e rejection sampling para evitar viés de módulo. A API deve expor `{ roll(sides): number; cursor(): number }` e nunca aceitar resultados fornecidos pelo cliente.

- [ ] **Step 4: Implementar resolução sem renderer**

`combat.ts` recebe valores já derivados das faces, aplica dano, bloqueio, cura e outcome em funções puras. Não deve importar React, Phaser, Prisma ou APIs web.

- [ ] **Step 5: Testar propriedades**

Adicionar loops de 1.000 rolagens garantindo `1 <= result <= sides`, HP nunca negativo e mesma entrada produzindo mesma saída.

Run: `npm test -- src/modules/game-engine`  
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/modules/game-engine
git commit -m "feat: add deterministic authoritative combat engine"
```

## Task 4: Máquina de estados da run e comandos fechados

**Files:**
- Create: `src/modules/run/command-schema.ts`
- Create: `src/modules/run/state.ts`
- Create: `src/modules/run/reducer.ts`
- Create: `src/modules/run/create-run.ts`
- Test: `src/modules/run/reducer.test.ts`

- [ ] **Step 1: Escrever teste de ordem e Essência**

```ts
import { expect, it } from "vitest";
import { createRun } from "./create-run";
import { applyCommand } from "./reducer";

it("rejeita reroll antes de roll e debita Essência uma vez", () => {
  const run = createRun({ seed: "server-seed", heroId: "squire" });
  expect(() => applyCommand(run, { type: "REROLL", sequence: 1, dieIds: ["slash-d6"] }))
    .toThrow(/phase/i);
  const rolled = applyCommand(run, { type: "ROLL_DICE", sequence: 1 });
  const rerolled = applyCommand(rolled, { type: "REROLL", sequence: 2, dieIds: ["slash-d6"] });
  expect(rerolled.essence).toBe(rolled.essence - 1);
});
```

- [ ] **Step 2: Confirmar falha**

Run: `npm test -- src/modules/run/reducer.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Definir união discriminada de comandos**

```ts
export const runCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("CHOOSE_ROOM"), sequence: z.number().int().positive(), roomId: id }).strict(),
  z.object({ type: z.literal("ROLL_DICE"), sequence: z.number().int().positive() }).strict(),
  z.object({ type: z.literal("LOCK_RESULT"), sequence: z.number().int().positive(), dieId: id }).strict(),
  z.object({ type: z.literal("REROLL"), sequence: z.number().int().positive(), dieIds: z.array(id).min(1).max(12) }).strict(),
  z.object({ type: z.literal("ACTIVATE_RESULTS"), sequence: z.number().int().positive(), dieIds: z.array(id).min(1).max(12) }).strict(),
  z.object({ type: z.literal("CHOOSE_REWARD"), sequence: z.number().int().positive(), rewardId: id }).strict(),
  z.object({ type: z.literal("CHOOSE_EVENT_OPTION"), sequence: z.number().int().positive(), optionId: id }).strict(),
]);
```

- [ ] **Step 4: Implementar reducer exaustivo**

O reducer valida `sequence === state.sequence + 1`, fase permitida, propriedade do dado, Essência e ids oferecidos pelo estado. Use `assertNever(command)` no `default` para impedir comandos esquecidos.

- [ ] **Step 5: Cobrir replay e payload adulterado**

Adicionar testes que rejeitam sequência repetida, campos extras, dado não equipado e recompensa não oferecida.

Run: `npm test -- src/modules/run`  
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/modules/run
git commit -m "feat: add validated run state machine"
```

## Task 5: Persistência, Auth.js e transações autoritárias

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/auth.ts`
- Create: `src/modules/run/run-repository.ts`
- Create: `src/modules/run/run-service.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Test: `tests/integration/run-service.test.ts`

- [ ] **Step 1: Escrever teste de idempotência concorrente**

O teste cria uma run, envia duas vezes a mesma chave `command-1` e espera uma única linha `RunCommand` e a mesma resposta serializada.

```ts
const [a, b] = await Promise.all([
  service.execute(userId, runId, "command-1", { type: "ROLL_DICE", sequence: 1 }),
  service.execute(userId, runId, "command-1", { type: "ROLL_DICE", sequence: 1 }),
]);
expect(a).toEqual(b);
expect(await prisma.runCommand.count({ where: { runId } })).toBe(1);
```

- [ ] **Step 2: Criar schema Prisma**

Definir `User`, tabelas Auth.js, `Run`, `RunCommand`, `HeroUnlock`, `Achievement`, `CosmeticEntitlement` e `AuditEvent`. `Run` inclui `ownerId`, `version`, `status`, `sequence`, `seedCiphertext`, `stateJson`, `score`, `verificationStatus`, timestamps e `@@index([ownerId, status])`. `RunCommand` inclui `@@unique([runId, idempotencyKey])` e `@@unique([runId, sequence])`.

- [ ] **Step 3: Configurar Auth.js GitHub**

```ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/modules/db/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [GitHub],
  session: { strategy: "database" },
});
```

- [ ] **Step 4: Implementar transação do comando**

`run-service.ts` deve carregar a run por `id` e `ownerId`, verificar idempotência, aplicar o reducer, incrementar `version` com `updateMany({ where: { id, version } })`, gravar comando e auditoria na mesma transação. Se `count !== 1`, repetir a leitura no máximo uma vez e então retornar conflito.

- [ ] **Step 5: Rodar migração e testes**

Run:

```powershell
npx prisma validate
npx prisma migrate dev --name initial_authoritative_run
npm test -- tests/integration/run-service.test.ts
```

Expected: schema válido, migração aplicada e teste PASS.

- [ ] **Step 6: Commit**

```powershell
git add prisma src/auth.ts src/app/api/auth src/modules/run tests/integration
git commit -m "feat: persist authenticated authoritative runs"
```

## Task 6: API segura de runs

**Files:**
- Create: `src/app/api/runs/route.ts`
- Create: `src/app/api/runs/[runId]/route.ts`
- Create: `src/app/api/runs/[runId]/commands/route.ts`
- Create: `src/modules/security/rate-limit.ts`
- Create: `src/modules/security/request.ts`
- Test: `tests/security/run-api.test.ts`

- [ ] **Step 1: Escrever casos adversariais**

Testar `401` sem sessão, `404` para run de outro usuário, `400` para campo desconhecido, `409` para sequência incorreta, `429` após limite e resposta idêntica para mesma `Idempotency-Key`.

- [ ] **Step 2: Confirmar falha**

Run: `npm test -- tests/security/run-api.test.ts`  
Expected: FAIL porque handlers não existem.

- [ ] **Step 3: Implementar parsing defensivo**

`request.ts` exige `Content-Type: application/json`, limita corpo a 16 KiB, exige UUID em `Idempotency-Key`, usa schemas Zod `.strict()` e nunca inclui stack trace na resposta.

- [ ] **Step 4: Implementar rate limiting por operação**

Criar interface `RateLimitStore` e limites separados: criação de run 5/minuto por conta; comando 60/minuto por run e 180/minuto por conta. Produção deve usar armazenamento compartilhado; memória é permitida somente em teste/desenvolvimento.

- [ ] **Step 5: Implementar handlers**

Os handlers chamam `auth()`, validam entrada, aplicam rate limit, delegam a `runService` e retornam apenas `publicRunView`. `seedCiphertext`, dados internos de anomalia e logs nunca saem na resposta.

- [ ] **Step 6: Testar e commitar**

Run: `npm test -- tests/security/run-api.test.ts`  
Expected: PASS.

```powershell
git add src/app/api/runs src/modules/security tests/security
git commit -m "feat: expose hardened run command API"
```

## Task 7: Mapa ramificado, eventos e recompensas

**Files:**
- Create: `src/modules/game-engine/map.ts`
- Create: `src/modules/game-engine/rewards.ts`
- Create: `src/modules/game-engine/events.ts`
- Test: `src/modules/game-engine/map.test.ts`
- Test: `src/modules/game-engine/events.test.ts`

- [ ] **Step 1: Escrever invariantes do mapa**

Testar exatamente dez camadas, ao menos uma bifurcação, chefe somente na camada dez, conexão de todo nó ao próximo e nenhuma sala inalcançável.

- [ ] **Step 2: Implementar gerador determinístico**

`generateMap(seed)` usa o stream do Task 3 e retorna ids estáveis. As camadas 5 e 10 forçam elite e chefe; a camada 9 nunca gera combate elite.

- [ ] **Step 3: Implementar ofertas fechadas**

Recompensas e opções de evento recebem ids gerados no estado. `CHOOSE_REWARD` e `CHOOSE_EVENT_OPTION` aceitam somente ids presentes na oferta corrente.

- [ ] **Step 4: Criar o Goblin Vendedor de Seguro**

Opções: comprar seguro por ouro da run, ignorar, ou tentar roubar. O resultado do roubo usa RNG oficial e registra um evento de auditoria sem revelar probabilidade secreta no comando.

- [ ] **Step 5: Testar e commitar**

Run: `npm test -- src/modules/game-engine/map.test.ts src/modules/game-engine/events.test.ts`  
Expected: PASS.

```powershell
git add src/modules/game-engine
git commit -m "feat: add branching map events and rewards"
```

## Task 8: Interface Mesa Arcana e animação Phaser

**Files:**
- Create: `src/app/(game)/run/[runId]/page.tsx`
- Create: `src/components/game/CombatStage.tsx`
- Create: `src/components/game/PhaserBattle.tsx`
- Create: `src/components/game/DiceTray.tsx`
- Create: `src/components/game/HeroSheet.tsx`
- Create: `src/components/game/EssenceMeter.tsx`
- Create: `src/components/game/RunMap.tsx`
- Create: `src/components/game/use-run-command.ts`
- Test: `src/components/game/DiceTray.test.tsx`

- [ ] **Step 1: Gerar e aprovar conceito final com Image Gen**

Gerar tela completa da Mesa Arcana com campo superior, fichas, bandeja de dados, Essência, estados de bloqueio/rerrolagem, mapa e versão mobile horizontal. Salvar os conceitos em `docs/design/` e extrair tokens em `src/app/globals.css`.

- [ ] **Step 2: Escrever teste da bandeja**

```tsx
render(<DiceTray dice={dice} essence={1} onLock={onLock} onReroll={onReroll} onActivate={onActivate} />);
await user.click(screen.getByRole("button", { name: /travar corte/i }));
expect(onLock).toHaveBeenCalledWith("slash-d6");
expect(screen.getByRole("button", { name: /rerrolar/i })).toBeEnabled();
```

- [ ] **Step 3: Implementar HUD em React**

Controles possuem nomes acessíveis, foco visível, estados `disabled` derivados da fase oficial e nenhuma atualização otimista de HP, score ou Essência.

- [ ] **Step 4: Implementar adaptador Phaser**

`PhaserBattle` cria e destrói uma instância Phaser no ciclo do componente. Recebe somente `BattleAnimationEvent[]`; não importa reducer ou Prisma. Sprites usam manifest keys, nunca caminhos espalhados.

- [ ] **Step 5: Implementar sincronização de comandos**

`use-run-command.ts` gera UUID de idempotência, envia `sequence`, bloqueia novo envio até resposta e, em `409`, busca novamente o estado oficial antes de liberar os controles.

- [ ] **Step 6: Verificar responsividade e testes**

Run:

```powershell
npm test -- src/components/game
npm run typecheck
npm run build
```

Expected: PASS e build concluído.

- [ ] **Step 7: Commit**

```powershell
git add src/app src/components docs/design
git commit -m "feat: build Mesa Arcana run interface"
```

## Task 9: Score, desbloqueios e cosméticos sem poder

**Files:**
- Create: `src/modules/game-engine/score.ts`
- Create: `src/modules/progression/unlocks.ts`
- Create: `src/modules/progression/cosmetics.ts`
- Create: `src/app/(game)/results/[runId]/page.tsx`
- Create: `src/app/(game)/collection/page.tsx`
- Test: `src/modules/game-engine/score.test.ts`
- Test: `tests/security/cosmetic-isolation.test.ts`

- [ ] **Step 1: Escrever teste de score oficial**

```ts
expect(calculateScore({ rooms: 10, bosses: 1, elapsedSeconds: 900, difficulty: "normal", achievements: 2, randomStart: true }))
  .toEqual({ base: 1500, timeBonus: 300, achievementBonus: 200, multiplier: 1.05, total: 2100 });
```

- [ ] **Step 2: Implementar score inteiro e auditável**

Usar somente aritmética inteira até a etapa final e arredondamento documentado. O serviço calcula a partir do log persistido; nenhum endpoint aceita `score` no payload.

- [ ] **Step 3: Implementar requisitos de desbloqueio**

Maga e Arqueira usam predicates sobre fatos oficiais da run. `Destino Aleatório` aparece apenas quando todos os heróis do pacote estão desbloqueados e aplica +1 Essência máxima e multiplicador 1,05.

- [ ] **Step 4: Provar isolamento cosmético**

O teste cria dois usuários com a mesma run, concede cosméticos apenas a um e confirma estados de combate e score idênticos. Nenhum tipo de `CosmeticEntitlement` é importado por `game-engine`.

- [ ] **Step 5: Testar e commitar**

Run: `npm test -- src/modules/game-engine/score.test.ts tests/security/cosmetic-isolation.test.ts`  
Expected: PASS.

```powershell
git add src/modules/game-engine src/modules/progression src/app/(game)
git commit -m "feat: add server score unlocks and cosmetic isolation"
```

## Task 10: Headers, auditoria e detecção de anomalias

**Files:**
- Modify: `next.config.ts`
- Create: `src/modules/security/audit.ts`
- Create: `src/modules/security/anomaly.ts`
- Create: `src/modules/security/redact.ts`
- Test: `tests/security/headers.test.ts`
- Test: `tests/security/anomaly.test.ts`

- [ ] **Step 1: Escrever testes defensivos**

Verificar CSP sem `unsafe-eval` em produção, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, ausência de seed/segredo em logs e quarentena para frequência impossível.

- [ ] **Step 2: Configurar headers**

`next.config.ts` aplica headers a `/(.*)` e restringe `connect-src`, `img-src`, `script-src`, `frame-ancestors 'none'` e `base-uri 'self'`. Desenvolvimento pode liberar somente o necessário ao HMR.

- [ ] **Step 3: Implementar redação e auditoria**

`redact.ts` remove chaves que correspondam a `/secret|token|password|seed|cookie|authorization/i`. Auditoria registra ator, ação, recurso, resultado, IP com retenção limitada e correlation id.

- [ ] **Step 4: Implementar quarentena**

`anomaly.ts` retorna sinais, não banimento. Runs com sequência temporal impossível, sessões concorrentes ou score incompatível recebem `verificationStatus = "review"` e não entram no ranking.

- [ ] **Step 5: Rodar auditoria automatizada**

Run:

```powershell
npm audit --audit-level=high
npm test -- tests/security
npm run typecheck
npm run build
```

Expected: nenhuma vulnerabilidade high/critical sem mitigação registrada e todos os testes PASS.

- [ ] **Step 6: Commit**

```powershell
git add next.config.ts src/modules/security tests/security
git commit -m "security: harden runtime and quarantine suspicious runs"
```

## Task 11: Fluxo completo, playtest e preparação de deploy

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/complete-run.spec.ts`
- Create: `tests/simulation/run-simulation.test.ts`
- Create: `README.md`
- Create: `docs/deployment.md`

- [ ] **Step 1: Escrever E2E da jornada principal**

O teste autentica fixture local, inicia com Escudeiro, escolhe rota, rola, trava, rerrola, ativa resultados, completa dez salas e confirma resultado calculado pelo servidor.

```ts
await page.getByRole("button", { name: /iniciar run normal/i }).click();
await page.getByRole("button", { name: /rolar dados/i }).click();
await page.getByRole("button", { name: /travar/i }).first().click();
await page.getByRole("button", { name: /rerrolar/i }).click();
await expect(page.getByText(/essência 1/i)).toBeVisible();
```

- [ ] **Step 2: Simular 1.000 runs**

Executar bots com seeds fixas e estratégias simples. Falhar se houver estado impossível, run sem caminho ao chefe, HP negativo ou score não reproduzível.

- [ ] **Step 3: Fazer playtest no Browser**

Testar desktop 1440×900, mobile horizontal 844×390 e menu mobile retrato 390×844. Verificar fluxo, foco, toque, movimento reduzido, textos, assets e recuperação de reload.

- [ ] **Step 4: Comparar conceito e implementação**

Capturar a tela final e inspecionar conceito e screenshot com `view_image`. Corrigir hierarquia, cores, espaçamento, tipografia, estados de dados, enquadramento dos sprites e responsividade até não haver desvios materiais.

- [ ] **Step 5: Documentar deploy**

`docs/deployment.md` deve separar:

- Vercel/Node: aplicação Next.js completa.
- PostgreSQL gerenciado: migrações com `prisma migrate deploy`.
- Hostinger PHP compartilhado: incompatível com o servidor Next.js; pode hospedar apenas landing/export estático, nunca API autoritária.
- Segredos: cadastrados no provedor, nunca no Git.

- [ ] **Step 6: Verificação final**

Run:

```powershell
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run test:e2e
npm run build
```

Expected: todos os comandos exit 0; cobertura do motor e da máquina de estados >= 90% de branches.

- [ ] **Step 7: Commit**

```powershell
git add playwright.config.ts tests README.md docs/deployment.md
git commit -m "test: verify complete Dice Invoker vertical slice"
```

## Gate de entrega

Antes do push de release:

- [ ] Uma run Normal completa funciona com dez salas e chefe.
- [ ] Toda rolagem, dano, recompensa, desbloqueio e score vem do servidor.
- [ ] Replay, concorrência, payload adulterado e acesso cruzado falham com segurança.
- [ ] Cosméticos não alcançam o motor de poder.
- [ ] A interface corresponde ao conceito Mesa Arcana em desktop e mobile.
- [ ] Simulações, testes, build e auditoria de dependências passam.
- [ ] Deploy usa runtime Node compatível; Hostinger PHP não recebe o backend autoritário.

