# Interactive Rooms and Enemy Attacks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar a run com contra-ataque inimigo, PV persistente, ouro, mercador, tesouro, eventos e variantes provisórias do slime elite/chefão.

**Architecture:** O motor puro calcula combate e economia; o reducer autoritativo mantém ofertas e fases pendentes; componentes DOM especializados exibem as salas contextuais; Phaser recebe somente eventos e a textura do inimigo. A prévia Hostinger usa o mesmo modelo de apresentação com estado local claramente não autoritativo.

**Tech Stack:** Next.js 16, React 19, TypeScript, Phaser 3, Vitest, Testing Library, Prisma/PostgreSQL, geração/edição raster com image_gen.

---

## Estrutura de arquivos

- `src/modules/game-engine/combat.ts`: resolver ataque do herói, defesa e contra-ataque inimigo.
- `src/modules/game-engine/economy.ts`: catálogo de itens, preços, compra e aplicação de efeitos.
- `src/modules/game-engine/rewards.ts`: ofertas de tesouro controladas e escolha única.
- `src/modules/game-engine/events.ts`: ofertas e consequências de evento.
- `src/modules/run/state.ts`: recursos, inventário e sala/oferta pendente.
- `src/modules/run/command-schema.ts`: comandos de intenção sem valores controlados pelo cliente.
- `src/modules/run/reducer.ts`: transições autoritativas e idempotentes das salas.
- `src/components/game/RoomOverlay.tsx`: moldura compartilhada das salas contextuais.
- `src/components/game/MerchantRoom.tsx`: ofertas, compra e saída.
- `src/components/game/TreasureRoom.tsx`: escolha única de recompensa.
- `src/components/game/EventRoom.tsx`: narrativa, escolhas e consequência.
- `src/components/game/CombatDiceOverlay.tsx`: terceiro dado de ataque inimigo.
- `src/components/game/use-auto-combat.ts`: apresentação local do ciclo completo.
- `src/components/game/CombatStage.tsx`: orquestração da prévia sem regras econômicas duplicadas.
- `src/components/game/PhaserBattle.tsx`: textura por rank e evento de ataque inimigo.
- `public/assets/characters/enemies/receipt-slime-elite.png`: slime vermelho provisório.
- `public/assets/characters/enemies/receipt-slime-boss.png`: slime dourado provisório.

### Task 1: Resolver contra-ataque inimigo no motor

**Files:**
- Modify: `src/modules/game-engine/combat.ts`
- Modify: `src/modules/game-engine/types.ts`
- Test: `src/modules/game-engine/combat.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Adicionar casos com a forma:

```ts
expect(resolveCombatExchange({ heroHp: 24, enemyHp: 18, heroDamage: 5, heroDefense: 2, enemyAttack: 6 }))
  .toEqual({ heroHp: 20, enemyHp: 13, damageDealt: 5, damageTaken: 4, victory: false, defeat: false });

expect(resolveCombatExchange({ heroHp: 24, enemyHp: 3, heroDamage: 5, heroDefense: 0, enemyAttack: 8 }).damageTaken)
  .toBe(0);
```

- [ ] **Step 2: Confirmar a falha**

Run: `npm test -- src/modules/game-engine/combat.test.ts`
Expected: FAIL porque `resolveCombatExchange` ainda não existe.

- [ ] **Step 3: Implementar a função pura**

```ts
export function resolveCombatExchange(input: CombatExchangeInput): CombatExchangeResult {
  const enemyHp = Math.max(0, input.enemyHp - input.heroDamage);
  const damageTaken = enemyHp === 0 ? 0 : Math.max(0, input.enemyAttack - input.heroDefense);
  const heroHp = Math.max(0, input.heroHp - damageTaken);
  return { heroHp, enemyHp, damageDealt: input.heroDamage, damageTaken, victory: enemyHp === 0, defeat: heroHp === 0 };
}
```

Validar todos os valores como inteiros seguros não negativos antes do cálculo.

- [ ] **Step 4: Rodar testes do motor**

Run: `npm test -- src/modules/game-engine/combat.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/game-engine/combat.ts src/modules/game-engine/combat.test.ts src/modules/game-engine/types.ts
git commit -m "feat: resolve enemy counter attacks"
```

### Task 2: Criar economia e catálogo de itens da run

**Files:**
- Create: `src/modules/game-engine/economy.ts`
- Create: `src/modules/game-engine/economy.test.ts`

- [ ] **Step 1: Escrever testes de compra e efeitos**

```ts
expect(purchaseItem({ gold: 10, heroHp: 18, heroMaxHp: 24, inventory: [] }, "sharp-sword"))
  .toMatchObject({ gold: 2, inventory: ["sharp-sword"] });
expect(() => purchaseItem({ gold: 2, heroHp: 24, heroMaxHp: 24, inventory: [] }, "sharp-sword"))
  .toThrow("not enough gold");
expect(applyCombatBonuses({ damage: 3, defense: 2 }, ["sharp-sword", "reinforced-shield"]))
  .toEqual({ damage: 4, defense: 3 });
expect(applyGoldBonus(10, ["tax-amulet"])).toBe(12);
```

- [ ] **Step 2: Confirmar a falha**

Run: `npm test -- src/modules/game-engine/economy.test.ts`
Expected: FAIL porque o módulo não existe.

- [ ] **Step 3: Implementar catálogo imutável e funções puras**

Definir `RUN_ITEMS` com:

```ts
{
  "sharp-sword": { id: "sharp-sword", name: "Espada Afiada", price: 8, kind: "passive" },
  "reinforced-shield": { id: "reinforced-shield", name: "Escudo Reforçado", price: 8, kind: "passive" },
  "healing-potion": { id: "healing-potion", name: "Poção", price: 6, kind: "consumable" },
  "tax-amulet": { id: "tax-amulet", name: "Amuleto Fiscal", price: 12, kind: "passive" }
}
```

`purchaseItem` consulta preço no catálogo, impede passivo duplicado e aplica a cura da poção sem exceder `heroMaxHp`.

- [ ] **Step 4: Rodar testes**

Run: `npm test -- src/modules/game-engine/economy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/game-engine/economy.ts src/modules/game-engine/economy.test.ts
git commit -m "feat: add temporary run economy"
```

### Task 3: Gerar ofertas controladas de mercador e tesouro

**Files:**
- Modify: `src/modules/game-engine/rewards.ts`
- Modify: `src/modules/game-engine/rewards.test.ts`
- Test: `src/modules/game-engine/rng.test.ts`

- [ ] **Step 1: Escrever testes determinísticos**

```ts
const merchant = createMerchantOffer("seed", 0, Object.keys(RUN_ITEMS));
expect(merchant.options).toHaveLength(3);
expect(new Set(merchant.options.map((option) => option.itemId)).size).toBe(3);

const treasure = createTreasureOffer("seed", 0, ["sharp-sword", "reinforced-shield"]);
expect(treasure.options.map((option) => option.kind)).toEqual(["gold", "item", "essence"]);
```

- [ ] **Step 2: Confirmar a falha**

Run: `npm test -- src/modules/game-engine/rewards.test.ts`
Expected: FAIL nas novas exportações.

- [ ] **Step 3: Implementar ofertas com o canal `reward`**

`createMerchantOffer` seleciona três itens únicos e copia apenas `offerId` e `itemId`. `createTreasureOffer` produz exatamente ouro, item e essência; quantidades são derivadas no servidor e ficam no objeto de oferta autoritativo.

- [ ] **Step 4: Verificar determinismo e isolamento**

Run: `npm test -- src/modules/game-engine/rewards.test.ts src/modules/game-engine/rng.test.ts`
Expected: PASS e cursores de outros canais inalterados.

- [ ] **Step 5: Commit**

```bash
git add src/modules/game-engine/rewards.ts src/modules/game-engine/rewards.test.ts src/modules/game-engine/rng.test.ts
git commit -m "feat: generate controlled room offers"
```

### Task 4: Estender estado e comandos autoritativos

**Files:**
- Modify: `src/modules/run/state.ts`
- Modify: `src/modules/run/create-run.ts`
- Modify: `src/modules/run/command-schema.ts`
- Modify: `src/modules/run/reducer.ts`
- Modify: `src/modules/run/reducer.test.ts`

- [ ] **Step 1: Escrever testes de transição e adulteração**

Cobrir:

```ts
expect(() => reduceRun(runAtMerchant, { type: "BUY_MERCHANT_ITEM", offerId: "forged", commandId: "c1" }))
  .toThrow("offer is not active");
expect(reduceRun(runAtTreasure, { type: "CHOOSE_TREASURE", offerId: activeOfferId, commandId: "c2" }).pendingRoom)
  .toBeNull();
expect(() => reduceRun(runAtEvent, { type: "CHOOSE_EVENT_OPTION", offerId: "missing", commandId: "c3" }))
  .toThrow();
```

Adicionar teste que repetir `commandId` não reaplica ouro, cura ou item.

- [ ] **Step 2: Confirmar a falha**

Run: `npm test -- src/modules/run/reducer.test.ts`
Expected: FAIL nos novos campos e comandos.

- [ ] **Step 3: Adicionar recursos e sala pendente ao estado**

```ts
type PendingRoom =
  | { kind: "merchant"; offer: MerchantOffer }
  | { kind: "treasure"; offer: TreasureOffer }
  | { kind: "event"; offer: EventOffer; result: EventChoiceResult | null }
  | null;
```

Adicionar `heroHp`, `heroMaxHp`, `gold`, `essence`, `inventory` e `pendingRoom`. Inicializar com 24 PV, 12 ouro, 2 essências e inventário vazio.

- [ ] **Step 4: Implementar comandos de intenção**

Schemas aceitos:

```ts
{ type: "BUY_MERCHANT_ITEM", offerId: string, commandId: string }
{ type: "LEAVE_MERCHANT", commandId: string }
{ type: "CHOOSE_TREASURE", offerId: string, commandId: string }
{ type: "CHOOSE_EVENT_OPTION", offerId: string, commandId: string }
{ type: "ACKNOWLEDGE_EVENT_RESULT", commandId: string }
```

Nenhum schema aceita preço, dano, saldo ou recompensa.

- [ ] **Step 5: Rodar testes de reducer e serviço**

Run: `npm test -- src/modules/run/reducer.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/run/state.ts src/modules/run/create-run.ts src/modules/run/command-schema.ts src/modules/run/reducer.ts src/modules/run/reducer.test.ts
git commit -m "feat: resolve interactive rooms authoritatively"
```

### Task 5: Integrar PV persistente e dado inimigo ao combate

**Files:**
- Modify: `src/modules/run/reducer.ts`
- Modify: `src/modules/run/reducer.test.ts`
- Modify: `src/components/game/use-auto-combat.ts`
- Modify: `src/components/game/use-auto-combat.test.tsx`
- Modify: `src/components/game/CombatDiceOverlay.tsx`
- Modify: `src/components/game/CombatDiceOverlay.test.tsx`

- [ ] **Step 1: Escrever testes do ciclo completo**

Verificar que normal usa D4, elite D6, chefe D8; que defesa mitiga ataque; que vitória impede contra-ataque; e que o overlay possui `aria-label="Dado de ataque inimigo D6, resultado 5"`.

- [ ] **Step 2: Confirmar a falha**

Run: `npm test -- src/modules/run/reducer.test.ts src/components/game/use-auto-combat.test.tsx src/components/game/CombatDiceOverlay.test.tsx`
Expected: FAIL pela ausência de `enemyAttack`.

- [ ] **Step 3: Gerar e resolver o terceiro dado no servidor**

O comando de início do turno grava `enemyAttack` usando o canal `combat` e os lados derivados do rank. O comando de resolução chama `resolveCombatExchange`, persiste PV e encerra a run quando `defeat` for verdadeiro.

- [ ] **Step 4: Atualizar apresentação local e overlay**

Retornar `enemyAttack` de `useAutoCombat` e renderizar o terceiro cartão sem botão de reroll. A mensagem de apresentação deve informar dano causado, bloqueado e recebido.

- [ ] **Step 5: Rodar testes focados**

Run: `npm test -- src/modules/run/reducer.test.ts src/components/game/use-auto-combat.test.tsx src/components/game/CombatDiceOverlay.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/run/reducer.ts src/modules/run/reducer.test.ts src/components/game/use-auto-combat.ts src/components/game/use-auto-combat.test.tsx src/components/game/CombatDiceOverlay.tsx src/components/game/CombatDiceOverlay.test.tsx
git commit -m "feat: show and resolve enemy attack dice"
```

### Task 6: Criar painéis interativos das salas

**Files:**
- Create: `src/components/game/RoomOverlay.tsx`
- Create: `src/components/game/MerchantRoom.tsx`
- Create: `src/components/game/TreasureRoom.tsx`
- Create: `src/components/game/EventRoom.tsx`
- Create: `src/components/game/RoomOverlay.test.tsx`
- Modify: `src/components/game/CombatStage.tsx`
- Modify: `src/components/game/CombatStage.test.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Escrever testes de interação**

Renderizar cada sala e verificar:

```ts
expect(screen.getByRole("dialog", { name: "Mercador Tributário" })).toBeInTheDocument();
fireEvent.click(screen.getByRole("button", { name: /Comprar Espada Afiada/i }));
expect(onBuy).toHaveBeenCalledWith(activeOfferId);
expect(screen.getByRole("button", { name: /Tesouro.*ouro/i })).toBeEnabled();
expect(screen.getByRole("button", { name: /Roubar/i })).toBeEnabled();
```

No `CombatStage`, verificar que dados do mapa estão desabilitados enquanto o diálogo está aberto.

- [ ] **Step 2: Confirmar a falha**

Run: `npm test -- src/components/game/RoomOverlay.test.tsx src/components/game/CombatStage.test.tsx`
Expected: FAIL porque os componentes não existem.

- [ ] **Step 3: Implementar componentes focados**

`RoomOverlay` fornece `role="dialog"`, título, recursos e região de cartões. Cada sala recebe dados já resolvidos e callbacks com apenas `offerId`; não calcula preço nem recompensa.

- [ ] **Step 4: Integrar ao `CombatStage`**

Substituir resolução imediata de `merchant`, `treasure` e `event` por um estado de sala pendente. Só preencher `availableRoomIds` após saída/confirmação. Exibir ouro, PV e essência no cabeçalho.

- [ ] **Step 5: Estilizar desktop, mobile e movimento reduzido**

Usar painel de pergaminho/metal sobre backdrop escuro. Em `max-width: 900px`, largura `calc(100% - 20px)`, cartões empilháveis e altura máxima com scroll interno. Manter foco visível e desativar animações em `prefers-reduced-motion`.

- [ ] **Step 6: Rodar testes de UI**

Run: `npm test -- src/components/game/RoomOverlay.test.tsx src/components/game/CombatStage.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/game/RoomOverlay.tsx src/components/game/MerchantRoom.tsx src/components/game/TreasureRoom.tsx src/components/game/EventRoom.tsx src/components/game/RoomOverlay.test.tsx src/components/game/CombatStage.tsx src/components/game/CombatStage.test.tsx src/app/globals.css
git commit -m "feat: add interactive merchant treasure and event rooms"
```

### Task 7: Criar e integrar variantes provisórias do slime

**Files:**
- Create: `public/assets/characters/enemies/receipt-slime-elite.png`
- Create: `public/assets/characters/enemies/receipt-slime-boss.png`
- Modify: `src/components/game/assets.ts`
- Modify: `src/components/game/assets.test.ts`
- Modify: `src/components/game/PhaserBattle.tsx`
- Modify: `src/components/game/CombatStage.tsx`

- [ ] **Step 1: Gerar duas edições não destrutivas**

Usar `public/assets/characters/enemies/receipt-slime.png` como alvo de edição. Preservar silhueta, rosto, recibo, pixel art e transparência. Alterar somente a paleta do corpo: vermelho/carmesim para elite e dourado/âmbar para chefe. Salvar nos nomes definidos acima.

- [ ] **Step 2: Validar arquivos e transparência**

Confirmar PNG, dimensões compatíveis, canal alfa e ausência de watermark/borda opaca. Inspecionar visualmente as duas imagens antes da integração.

- [ ] **Step 3: Escrever teste de manifesto**

```ts
expect(GAME_ASSETS.receiptSlimeElite).toBe("/assets/characters/enemies/receipt-slime-elite.png");
expect(GAME_ASSETS.receiptSlimeBoss).toBe("/assets/characters/enemies/receipt-slime-boss.png");
```

- [ ] **Step 4: Integrar textura por rank e animação inimiga**

Adicionar prop `enemyRank: "normal" | "elite" | "boss"` em `PhaserBattle`. Pré-carregar as três texturas e trocar `enemy.setTexture(...)` quando o rank mudar. Adicionar evento `enemy-hit` que avança o slime, treme o herói e retorna à posição inicial.

- [ ] **Step 5: Rodar testes de assets e UI**

Run: `npm test -- src/components/game/assets.test.ts src/components/game/CombatStage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add public/assets/characters/enemies/receipt-slime-elite.png public/assets/characters/enemies/receipt-slime-boss.png src/components/game/assets.ts src/components/game/assets.test.ts src/components/game/PhaserBattle.tsx src/components/game/CombatStage.tsx
git commit -m "feat: add provisional elite and boss slimes"
```

### Task 8: Segurança, regressão, playtest e publicação

**Files:**
- Modify: `src/modules/security/rate-limit.ts`
- Modify: `src/modules/run/run-command-handler.ts`
- Modify: `tools/hostinger-preview.test.mjs`
- Modify: `docs/superpowers/plans/2026-06-20-interactive-rooms-enemy-attacks.md`

- [ ] **Step 1: Adicionar testes de rate limit e payload mínimo**

Verificar que comandos de compra/escolha recebem limites próprios, recusam campos extras como `price`, `gold`, `damage` e `reward`, e não retornam seed nem oferta privada em erros.

- [ ] **Step 2: Rodar testes de segurança focados**

Run: `npm test -- src/modules/run/reducer.test.ts src/modules/security`
Expected: PASS e nenhum snapshot contendo seed.

- [ ] **Step 3: Rodar verificação completa**

Run, interrompendo na primeira falha:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run build:hostinger
npm run test:hostinger
```

Expected: todos os comandos com exit code 0.

- [ ] **Step 4: Playtest no navegador**

Validar em desktop e 390×844: combate normal, dano inimigo, mitigação, compra, falta de ouro, saída do mercador, escolha de tesouro, consequência de evento, elite vermelho, chefe dourado, bloqueio do mapa e ausência de overflow. Verificar console sem erros da aplicação.

- [ ] **Step 5: Revisar segurança da prévia**

Confirmar que `/api/*` não é exportado, score/ranking permanecem desativados e os headers incluem CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` e `Permissions-Policy`.

- [ ] **Step 6: Commit final de verificação**

```bash
git add src/modules/security/rate-limit.ts src/modules/run/run-command-handler.ts tools/hostinger-preview.test.mjs docs/superpowers/plans/2026-06-20-interactive-rooms-enemy-attacks.md
git commit -m "test: verify interactive run rooms"
```

- [ ] **Step 7: Publicar e validar**

Push da branch `feature/dice-invoker-vertical-slice`, aguardar `Publish Hostinger Preview`, confirmar conclusão `success` e repetir o smoke test em `https://saddlebrown-louse-542936.hostingersite.com/`.
