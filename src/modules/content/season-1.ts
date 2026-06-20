import type { DungeonPhase, EvolutionStage, Guardian, Invader, SeasonEvent, SeasonSource, Die } from "./schema";

type FaceInput = { label: string; kind: "damage" | "block" | "heal"; amount: number };

function d6(
  id: string,
  name: string,
  type: Die["type"],
  rarity: Die["rarity"],
  faceInputs: [FaceInput, FaceInput, FaceInput, FaceInput, FaceInput, FaceInput],
): Die {
  return {
    id,
    name,
    type,
    rarity,
    sides: 6,
    faces: faceInputs.map((face, index) => ({
      id: `${id}-${index + 1}`,
      label: face.label,
      effect: { kind: face.kind, amount: face.amount },
    })),
  };
}

const hit = (label: string, amount: number): FaceInput => ({ label, kind: "damage", amount });
const guard = (label: string, amount: number): FaceInput => ({ label, kind: "block", amount });
const heal = (label: string, amount: number): FaceInput => ({ label, kind: "heal", amount });

const dice: Die[] = [
  d6("rusty-sword", "Espada Enferrujada", "attack", "common", [hit("Cutucar", 1), hit("Corte", 2), hit("Corte", 2), hit("Golpe", 3), hit("Golpe", 3), hit("Heroísmo Acidental", 5)]),
  d6("wooden-shield", "Escudo de Madeira", "defense", "common", [guard("Abaixar", 1), guard("Aparar", 2), guard("Aparar", 2), guard("Firmar", 3), guard("Firmar", 3), guard("Muralha", 5)]),
  d6("short-bow", "Arco Curto", "attack", "common", [hit("Errar por Pouco", 1), hit("Flecha", 2), hit("Flecha", 2), hit("Tiro Certeiro", 3), hit("Tiro Certeiro", 3), hit("Olho de Águia", 5)]),
  d6("ember-orb", "Orbe de Brasa", "magic", "rare", [hit("Faísca", 1), hit("Brasa", 2), hit("Brasa", 2), hit("Chama", 4), hit("Chama", 4), hit("Bola de Fogo", 6)]),
  d6("mending-light", "Luz Remendadora", "magic", "rare", [heal("Curativo", 1), heal("Curativo", 1), heal("Alívio", 2), heal("Alívio", 2), heal("Restaurar", 3), heal("Milagre Modesto", 5)]),
  d6("tax-breaker", "Quebra-Tributo", "attack", "rare", [hit("Recurso", 2), hit("Recurso", 2), hit("Contestação", 3), hit("Contestação", 3), hit("Isenção", 5), hit("Sonegação Heroica", 7)]),
  d6("tower-shield", "Escudo-Torre", "defense", "rare", [guard("Cobrir", 2), guard("Cobrir", 2), guard("Fortificar", 4), guard("Fortificar", 4), guard("Bastião", 6), guard("Não Passa", 8)]),
  d6("arcane-ledger", "Livro-Caixa Arcano", "magic", "epic", [hit("Juros", 2), guard("Crédito", 3), hit("Multa", 4), guard("Crédito", 3), heal("Estorno", 3), hit("Auditoria Reversa", 8)]),
  d6("slime-hammer", "Martelo Gelatinoso", "attack", "epic", [hit("Ploft", 2), hit("Ploft", 2), hit("Quicar", 4), hit("Quicar", 4), hit("Esmagar", 6), hit("PLOFT!", 9)]),
  d6("mirror-ward", "Guarda-Espelho", "defense", "epic", [guard("Reflexo", 2), guard("Reflexo", 2), guard("Prisma", 4), guard("Prisma", 4), guard("Espelhar", 7), guard("Salão de Espelhos", 10)]),
  d6("star-arrow", "Flecha Estelar", "attack", "legendary", [hit("Cintilar", 3), hit("Cintilar", 3), hit("Cometa", 6), hit("Cometa", 6), hit("Supernova", 9), hit("Constelação", 12)]),
  d6("primordial-aegis", "Égide Primordial", "defense", "relic", [guard("Destino", 4), guard("Destino", 4), heal("Renovar", 4), guard("Inabalável", 8), heal("Renovar", 4), guard("Não Hoje", 14)]),
];

const guardians: Guardian[] = [{
  id: "caretaker-slime", name: "Slime Zelador", rarity: "common", maxHp: 28,
  naturalDefense: 1, startingDiceIds: ["slime-hammer"],
  rootEvolutionStageId: "caretaker-slime-d4", unlock: { kind: "starter" },
}];

const stageSides = [4, 6, 8, 10, 12, 20] as const;
const stageThresholds = [60, 160, 280, 430, 650, 0] as const;
const evolutionStages: EvolutionStage[] = [];
for (let depth = 0; depth < stageSides.length; depth += 1) {
  const count = 2 ** depth;
  for (let branch = 0; branch < count; branch += 1) {
    const suffix = depth === 0 ? "" : `-${branch + 1}`;
    const id = `caretaker-slime-d${stageSides[depth]}${suffix}`;
    const defensive = branch % 2 === 1;
    const nextSides = stageSides[depth + 1];
    evolutionStages.push({
      id,
      guardianId: "caretaker-slime",
      name: depth === 0 ? "Slime Zelador" : `${defensive ? "Bastião" : "Esmagador"} Gelatinoso ${branch + 1}`,
      sides: stageSides[depth],
      naturalDefense: 1 + (defensive ? depth : Math.floor(depth / 3)),
      xpThreshold: stageThresholds[depth],
      role: depth === 0 ? "balanced" : defensive ? "defense" : "assault",
      nextStageIds: nextSides === undefined ? [] : [
        `caretaker-slime-d${nextSides}-${branch * 2 + 1}`,
        `caretaker-slime-d${nextSides}-${branch * 2 + 2}`,
      ],
    });
  }
}

const invaders: Invader[] = [
  ["torch-bearer", "Portador de Tocha", "common", 9, 0, 4],
  ["lock-picker", "Arrombadora", "common", 12, 0, 6],
  ["veteran-raider", "Saqueador Veterano", "elite", 24, 1, 8],
  ["collection-squire", "Escudeiro Cobrador", "boss", 34, 1, 6],
  ["inspection-archer", "Arqueira de Vistoria", "boss", 42, 1, 8],
  ["registry-mage", "Maga Cartorial", "boss", 52, 2, 8],
  ["eviction-paladin", "Paladino de Despejo", "boss", 64, 3, 10],
  ["consultant-necromancer", "Necromante Consultor", "boss", 78, 3, 12],
  ["royal-auditor", "Auditor Real", "boss", 94, 4, 12],
  ["privatization-prince", "Príncipe da Privatização", "boss", 120, 5, 20],
].map(([id, name, rank, maxHp, naturalDefense, attackDie]) => ({
  id, name, rank, maxHp, naturalDefense, attackDie,
})) as Invader[];

const phaseInputs = [
  ["ransacked-entrance", "Entrada Saqueada", "collection-squire"],
  ["storage-galleries", "Galerias de Estoque", "inspection-archer"],
  ["forbidden-library", "Biblioteca Proibida", "registry-mage"],
  ["abandoned-forge", "Forja Abandonada", "eviction-paladin"],
  ["outsourced-crypt", "Cripta Terceirizada", "consultant-necromancer"],
  ["core-vaults", "Cofres do Núcleo", "royal-auditor"],
  ["dungeon-heart", "Coração da Dungeon", "privatization-prince"],
] as const;
const phases: DungeonPhase[] = phaseInputs.map(([id, name, bossInvaderId], offset) => ({
  id, name, bossInvaderId, index: offset + 1, roomCount: offset + 3, difficulty: offset + 1,
}));

const events: SeasonEvent[] = [
  { id: "goblin-insurance", title: "Goblin Vendedor de Seguro", description: "Cobertura total, exceto para tudo que costuma acontecer em uma dungeon.", options: [{ id: "buy", label: "Comprar seguro", consequence: "reward" }, { id: "ignore", label: "Ignorar", consequence: "safe" }, { id: "steal", label: "Roubar a apólice", consequence: "risk" }] },
  { id: "deduction-well", title: "Poço das Deduções", description: "Uma voz promete deduzir alguma coisa. Não especifica o quê.", options: [{ id: "drink", label: "Beber", consequence: "risk" }, { id: "coin", label: "Jogar uma moeda", consequence: "reward" }] },
  { id: "mandatory-break", title: "Intervalo Obrigatório", description: "Um esqueleto sindicalizado aponta para uma cadeira confortável.", options: [{ id: "rest", label: "Descansar", consequence: "reward" }, { id: "work", label: "Seguir trabalhando", consequence: "safe" }] },
  { id: "wrong-form", title: "O Formulário Errado", description: "Você trouxe o 7-B. O guichê exige o B-7.", options: [{ id: "argue", label: "Argumentar", consequence: "risk" }, { id: "return", label: "Voltar depois", consequence: "safe" }] },
  { id: "friendly-mimic", title: "Baú Suspeitosamente Educado", description: "Ele pergunta se pode mordê-lo antes de abrir.", options: [{ id: "consent", label: "Negociar", consequence: "reward" }, { id: "decline", label: "Recusar educadamente", consequence: "safe" }] },
  { id: "slime-protest", title: "Piquete Gelatinoso", description: "Slimes exigem adicional de insalubridade por aventureiro.", options: [{ id: "support", label: "Apoiar", consequence: "reward" }, { id: "cross", label: "Cruzar o piquete", consequence: "risk" }] },
];

export const seasonOne = {
  id: "season-1",
  version: "1.0.0",
  name: "A Privatização da Dungeon",
  guardians,
  evolutionStages,
  dice,
  invaders,
  events,
  phases,
} satisfies SeasonSource;
