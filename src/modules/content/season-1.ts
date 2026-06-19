import type { ClassStage, Die, Enemy, Hero, Season, SeasonEvent } from "./schema";

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

type ClassStageInput = Readonly<{
  id: string;
  name: string;
  sides: ClassStage["sides"];
  xpThreshold: number;
  role: ClassStage["role"];
  nextStageIds: readonly string[];
}>;

const roleWeights: Record<ClassStage["role"], ClassStage["aiWeights"]> = {
  balanced: { attack: 45, defense: 45, magic: 10 },
  assault: { attack: 75, defense: 20, magic: 5 },
  defense: { attack: 25, defense: 70, magic: 5 },
  counter: { attack: 55, defense: 40, magic: 5 },
  support: { attack: 25, defense: 45, magic: 30 },
};

function classStage(input: ClassStageInput): ClassStage {
  return {
    ...input,
    heroId: "squire",
    nextStageIds: [...input.nextStageIds],
    aiWeights: roleWeights[input.role],
    faces: Array.from({ length: input.sides }, (_, index) => {
      const rank = Math.floor(index / 2) + 1;
      const attackFocused = input.role === "assault" || input.role === "counter";
      const defenseFocused = input.role === "defense" || input.role === "support";
      return {
        id: `${input.id}-face-${index + 1}`,
        label: `${input.name} ${index + 1}`,
        damage: Math.max(1, rank + (attackFocused ? 1 : 0)),
        block: Math.max(1, rank + (defenseFocused ? 1 : 0)),
        healing: input.role === "support" && index >= input.sides - 2 ? rank : 0,
      };
    }),
  };
}

const classStageInputs: ClassStageInput[] = [
  { id: "squire-d4", name: "Escudeiro", sides: 4, xpThreshold: 60, role: "balanced", nextStageIds: ["warrior-d6", "guardian-d6"] },
  { id: "warrior-d6", name: "Guerreiro", sides: 6, xpThreshold: 160, role: "assault", nextStageIds: ["duelist-d8", "knight-d8"] },
  { id: "guardian-d6", name: "Guardião", sides: 6, xpThreshold: 160, role: "defense", nextStageIds: ["paladin-d8", "bastion-d8"] },
  { id: "duelist-d8", name: "Duelista", sides: 8, xpThreshold: 280, role: "counter", nextStageIds: ["blade-dancer-d10", "riposte-master-d10"] },
  { id: "knight-d8", name: "Cavaleiro", sides: 8, xpThreshold: 280, role: "balanced", nextStageIds: ["royal-lancer-d10", "iron-marshal-d10"] },
  { id: "paladin-d8", name: "Paladino", sides: 8, xpThreshold: 280, role: "support", nextStageIds: ["sun-templar-d10", "oathkeeper-d10"] },
  { id: "bastion-d8", name: "Bastião", sides: 8, xpThreshold: 280, role: "defense", nextStageIds: ["fortress-d10", "thorn-warden-d10"] },
  { id: "blade-dancer-d10", name: "Dançarino de Lâminas", sides: 10, xpThreshold: 430, role: "assault", nextStageIds: ["storm-of-steel-d12", "fate-duelist-d12"] },
  { id: "riposte-master-d10", name: "Mestre da Réplica", sides: 10, xpThreshold: 430, role: "counter", nextStageIds: ["perfect-counter-d12", "mirror-blade-d12"] },
  { id: "royal-lancer-d10", name: "Lanceiro Real", sides: 10, xpThreshold: 430, role: "assault", nextStageIds: ["dragon-lancer-d12", "kings-vanguard-d12"] },
  { id: "iron-marshal-d10", name: "Marechal de Ferro", sides: 10, xpThreshold: 430, role: "defense", nextStageIds: ["adamant-general-d12", "war-citadel-d12"] },
  { id: "sun-templar-d10", name: "Templário Solar", sides: 10, xpThreshold: 430, role: "support", nextStageIds: ["solar-paragon-d12", "dawn-saint-d12"] },
  { id: "oathkeeper-d10", name: "Guardião do Juramento", sides: 10, xpThreshold: 430, role: "balanced", nextStageIds: ["eternal-oath-d12", "mercy-crown-d12"] },
  { id: "fortress-d10", name: "Fortaleza", sides: 10, xpThreshold: 430, role: "defense", nextStageIds: ["living-fortress-d12", "world-shield-d12"] },
  { id: "thorn-warden-d10", name: "Guardião dos Espinhos", sides: 10, xpThreshold: 430, role: "counter", nextStageIds: ["iron-thorns-d12", "retribution-king-d12"] },
  { id: "storm-of-steel-d12", name: "Tempestade de Aço", sides: 12, xpThreshold: 0, role: "assault", nextStageIds: [] },
  { id: "fate-duelist-d12", name: "Duelista do Destino", sides: 12, xpThreshold: 0, role: "counter", nextStageIds: [] },
  { id: "perfect-counter-d12", name: "Contra-Ataque Perfeito", sides: 12, xpThreshold: 0, role: "counter", nextStageIds: [] },
  { id: "mirror-blade-d12", name: "Lâmina-Espelho", sides: 12, xpThreshold: 0, role: "balanced", nextStageIds: [] },
  { id: "dragon-lancer-d12", name: "Lanceiro Dracônico", sides: 12, xpThreshold: 0, role: "assault", nextStageIds: [] },
  { id: "kings-vanguard-d12", name: "Vanguarda do Rei", sides: 12, xpThreshold: 0, role: "balanced", nextStageIds: [] },
  { id: "adamant-general-d12", name: "General Adamantino", sides: 12, xpThreshold: 0, role: "defense", nextStageIds: [] },
  { id: "war-citadel-d12", name: "Cidadela de Guerra", sides: 12, xpThreshold: 0, role: "defense", nextStageIds: [] },
  { id: "solar-paragon-d12", name: "Paragão Solar", sides: 12, xpThreshold: 0, role: "support", nextStageIds: [] },
  { id: "dawn-saint-d12", name: "Santo da Alvorada", sides: 12, xpThreshold: 0, role: "support", nextStageIds: [] },
  { id: "eternal-oath-d12", name: "Juramento Eterno", sides: 12, xpThreshold: 0, role: "balanced", nextStageIds: [] },
  { id: "mercy-crown-d12", name: "Coroa da Misericórdia", sides: 12, xpThreshold: 0, role: "support", nextStageIds: [] },
  { id: "living-fortress-d12", name: "Fortaleza Viva", sides: 12, xpThreshold: 0, role: "defense", nextStageIds: [] },
  { id: "world-shield-d12", name: "Escudo do Mundo", sides: 12, xpThreshold: 0, role: "defense", nextStageIds: [] },
  { id: "iron-thorns-d12", name: "Espinhos de Ferro", sides: 12, xpThreshold: 0, role: "counter", nextStageIds: [] },
  { id: "retribution-king-d12", name: "Rei da Retribuição", sides: 12, xpThreshold: 0, role: "counter", nextStageIds: [] },
];
const classStages: ClassStage[] = classStageInputs.map(classStage);

const heroes: Hero[] = [
  { id: "squire", name: "Escudeiro", class: "guardian", rarity: "common", maxHp: 24, startingDiceIds: ["rusty-sword", "wooden-shield"], rootClassStageId: "squire-d4", unlock: { kind: "starter" } },
  { id: "archer", name: "Arqueira", class: "ranger", rarity: "rare", maxHp: 18, startingDiceIds: ["short-bow", "wooden-shield"], unlock: { kind: "achievement", achievementId: "steady-aim" } },
  { id: "mage", name: "Maga", class: "mage", rarity: "rare", maxHp: 16, startingDiceIds: ["ember-orb", "mending-light"], unlock: { kind: "achievement", achievementId: "arcane-audit" } },
];

const enemies: Enemy[] = [
  ["receipt-slime", "Slime de Recibo", "common", 8, 2],
  ["late-fee-slime", "Slime de Mora", "common", 10, 3],
  ["ink-goblin", "Goblin de Tinteiro", "common", 9, 3],
  ["form-mimic", "Mímico Formulário", "common", 12, 3],
  ["stamp-bat", "Morcego Carimbador", "common", 7, 4],
  ["deduction-rat", "Rato de Dedução", "common", 8, 3],
  ["invoice-wisp", "Fogo-Fátuo de Nota", "common", 9, 4],
  ["collector-orc", "Orc Cobrador", "common", 14, 4],
  ["gelatinous-inspector", "Inspetor Gelatinoso", "elite", 28, 6],
  ["senior-auditor", "Auditor Sênior", "elite", 32, 7],
  ["gelatinous-supervisor", "Supervisor Gelatinoso", "boss", 64, 9],
].map(([id, name, rank, maxHp, damage]) => ({ id, name, rank, maxHp, damage })) as Enemy[];

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
  name: "A Rebelião dos Slimes Tributários",
  heroes,
  classStages,
  dice,
  enemies,
  events,
} satisfies Season;
