'use strict';
// ══════════════════════════════════════════════════════════════════════
//  RACES.JS — Système de races strictement PHYSIOLOGIQUE & MAGIQUE
//
//  Principe anti-essentialisme (cf. brief) : une race ne modifie JAMAIS
//  l'intelligence, la discipline, la créativité, la loyauté, le courage,
//  le leadership, le style de jeu ni la qualité technique APPRISE. Elle ne
//  touche qu'au corps et à la magie. Les multiplicateurs restent faibles
//  (0.85–1.15) : l'entraînement et les stats individuelles priment toujours.
//
//  Les 6 stats du jeu (spd/sht/def/stam/tec/res) sont dérivées des axes
//  physiologiques du brief :
//    spd  ← accélération + vitesse max
//    sht  ← force de frappe / puissance
//    def  ← force / masse / résistance aux chocs (utile au duel défensif)
//    stam ← endurance
//    res  ← résistance physique / récupération
//    tec  ← agilité / coordination / équilibre (finesse MOTRICE, pas la
//           technique apprise — celle-ci reste individuelle)
//  magicCapacity module la magie via les helpers de stats_ext.js.
// ══════════════════════════════════════════════════════════════════════

const RACE_MODIFIERS = {
  human:      { name:'Humain',      emoji:'👤', spd:1.00, sht:1.00, def:1.00, stam:1.00, res:1.00, tec:1.00, magic:1.00 },
  demon:      { name:'Démon',       emoji:'😈', spd:1.00, sht:1.12, def:1.10, stam:1.00, res:0.92, tec:1.00, magic:1.12 },
  angel:      { name:'Ange',        emoji:'😇', spd:1.05, sht:0.94, def:0.94, stam:1.00, res:1.05, tec:1.10, magic:1.10 },
  half_dragon:{ name:'Demi-dragon', emoji:'🐲', spd:0.90, sht:1.12, def:1.12, stam:1.00, res:1.10, tec:0.90, magic:1.05 },
  elf:        { name:'Elfe',        emoji:'🧝', spd:1.03, sht:0.98, def:0.92, stam:1.03, res:0.95, tec:1.12, magic:1.05 },
  siren:      { name:'Sirène',      emoji:'🧜', spd:0.97, sht:0.95, def:0.95, stam:1.12, res:1.08, tec:1.05, magic:1.05 },
  vampire:    { name:'Vampire',     emoji:'🧛', spd:1.10, sht:1.00, def:0.98, stam:0.95, res:1.05, tec:1.05, magic:1.05 },
  leyak:      { name:'Leyak',       emoji:'👺', spd:1.05, sht:0.98, def:0.85, stam:1.00, res:0.88, tec:1.12, magic:1.12 },
  goblin:     { name:'Gobelin',     emoji:'👺', spd:1.12, sht:0.90, def:0.95, stam:1.00, res:0.95, tec:1.10, magic:1.00 },
  hobgoblin:  { name:'Hobgobelin',  emoji:'👹', spd:1.02, sht:1.05, def:1.05, stam:1.02, res:1.05, tec:1.00, magic:1.00 },
  orc:        { name:'Orc',         emoji:'🧌', spd:0.90, sht:1.10, def:1.12, stam:1.02, res:1.10, tec:0.88, magic:0.95 },
  dwarf:      { name:'Nain',        emoji:'🧔', spd:0.85, sht:1.02, def:1.10, stam:1.05, res:1.12, tec:1.02, magic:1.00 },
  lycan:      { name:'Lycan',       emoji:'🐺', spd:1.10, sht:1.02, def:1.00, stam:1.12, res:1.05, tec:1.00, magic:0.95 },
  fairy:      { name:'Fée',         emoji:'🧚', spd:1.05, sht:0.88, def:0.82, stam:1.00, res:0.85, tec:1.15, magic:1.10 },
  giant:      { name:'Géant',       emoji:'🗿', spd:0.85, sht:1.15, def:1.12, stam:0.90, res:1.10, tec:0.82, magic:1.00 },
};

// ── RÉPARTITION DES SEXES PAR RACE ─────────────────────────────────────
// Le sexe dépend de la RACE, pas du pays : une sirène reste ~90 % féminine
// qu'elle joue à Panthalassa ou au Rorang. F = femme, M = homme, X = autre /
// non-genré. Ces ratios priment sur le sexRatio de nation (fallback si la race
// est inconnue). Certaines races sont mono-sexes de par leur nature (leyak,
// fées → féminines dans ce monde).
const RACE_SEX_RATIO = {
  human:      { F:0.50, M:0.50, X:0.00 },
  siren:      { F:0.90, M:0.08, X:0.02 },   // sirènes très majoritairement féminines
  leyak:      { F:1.00, M:0.00, X:0.00 },   // leyaks : exclusivement féminines
  fairy:      { F:1.00, M:0.00, X:0.00 },   // fées : exclusivement féminines
  elf:        { F:0.40, M:0.60, X:0.00 },   // elfes : légère majorité masculine
  dwarf:      { F:0.20, M:0.80, X:0.00 },   // nains : forte majorité masculine
  vampire:    { F:0.45, M:0.55, X:0.00 },
  angel:      { F:0.55, M:0.35, X:0.10 },
  demon:      { F:0.45, M:0.45, X:0.10 },
  half_dragon:{ F:0.45, M:0.55, X:0.00 },
  goblin:     { F:0.35, M:0.65, X:0.00 },
  hobgoblin:  { F:0.30, M:0.70, X:0.00 },
  orc:        { F:0.25, M:0.75, X:0.00 },
  lycan:      { F:0.40, M:0.60, X:0.00 },
  giant:      { F:0.30, M:0.70, X:0.00 },
};

// Tire un sexe pour une race. Si la race est absente de la table, on retombe
// sur `fallbackRatio` (celui de la nation) ou 50/50. Renvoie 'F' | 'M' | 'X'.
function pickSexForRace(race, fallbackRatio){
  const sr = RACE_SEX_RATIO[race] || fallbackRatio || { F:0.5, M:0.5, X:0 };
  const r = Math.random();
  const pF = sr.F||0, pM = sr.M||0;
  if(r < pF) return 'F';
  if(r < pF+pM) return 'M';
  return 'X';
}

// Liste ordonnée (pour l'UI / la génération pondérée).
const RACE_IDS = Object.keys(RACE_MODIFIERS);

// Applique le modificateur de race à une valeur de stat déjà calculée.
// Ne fait rien pour un humain ou une race inconnue (repli neutre) → le jeu se
// comporte exactement comme avant pour les joueurs sans race définie.
function applyRaceStat(race, statKey, value){
  const m = RACE_MODIFIERS[race];
  if(!m || race==='human') return value;
  const mul = m[statKey];
  if(mul==null || mul===1) return value;
  return Math.max(1, Math.min(99, Math.round(value * mul)));
}

// Multiplicateur magique de la race (consommé par les helpers de magie).
function raceMagicMul(race){
  const m = RACE_MODIFIERS[race];
  return (m && m.magic!=null) ? m.magic : 1;
}

// Métadonnées d'affichage.
function raceMeta(race){
  return RACE_MODIFIERS[race] || RACE_MODIFIERS.human;
}

// ── Composition de population par région Valoria ──────────────────────
// Valoria est cosmopolite : ~40% de non-humains. Valcourt (capitale) est
// plus mélangée ; Brumefer (industriel, dur au mal) penche vers les races
// robustes. Poids = fréquence relative. Déterminé par région pour coller au
// lore, mais AUCUN lien race↔personnalité (anti-essentialisme).
const RACE_WEIGHTS_BY_REGION = {
  valcourt: { // capitale cosmopolite : grande diversité
    human:60, elf:8, angel:5, fairy:5, siren:4, vampire:4, demon:3,
    half_dragon:2, leyak:2, goblin:2, lycan:2, dwarf:1, orc:1, hobgoblin:1, giant:0,
  },
  brumefer: { // bassin industriel : races robustes et endurantes
    human:60, orc:7, dwarf:7, hobgoblin:5, giant:4, lycan:4, half_dragon:3,
    demon:3, goblin:2, elf:1, vampire:1, siren:1, angel:1, leyak:1, fairy:0,
  },
  _default: { // sélection nationale / inconnu : mélange équilibré ~40% non-humain
    human:60, elf:4, angel:3, fairy:3, siren:3, vampire:3, demon:3, half_dragon:3,
    leyak:3, goblin:3, hobgoblin:3, orc:3, dwarf:3, lycan:2, giant:1,
  },

  // ── RORANG (équivalent Cambodge) : humains majoritaires, forte minorité
  // de Leyaks (esprits féminins), quelques fées/sirènes, et un peu d'autres
  // peuples d'Asie (elfes, nains, vampires…). Pas d'anges/démons/géants ici.
  krong: { // capitale : plus de Leyaks urbaines, un peu de tout
    human:60, leyak:16, fairy:5, siren:4, elf:5, vampire:4, dwarf:3, goblin:2, lycan:1,
  },
  phsar: { // Nord marchand : humains + diaspora, moins d'esprits
    human:68, leyak:10, elf:6, dwarf:6, vampire:4, siren:2, fairy:2, goblin:2,
  },
  tonle: { // Est lacustre : plus de sirènes près des eaux
    human:58, siren:14, leyak:12, fairy:6, elf:4, dwarf:2, vampire:2, lycan:2,
  },
  prey: { // Ouest forestier : terres d'esprits, Leyaks/fées nombreuses
    human:52, leyak:22, fairy:10, siren:4, elf:5, goblin:3, lycan:2, vampire:2,
  },
};

// Tire une race pour une région donnée. seed → déterministe (presets stables).
function pickRaceForRegion(region, seed){
  const table = RACE_WEIGHTS_BY_REGION[(region||'').toLowerCase()] || RACE_WEIGHTS_BY_REGION._default;
  const entries = Object.entries(table).filter(([,w])=>w>0);
  const total = entries.reduce((s,[,w])=>s+w,0);
  let r;
  if(seed!=null){
    let h=2166136261>>>0; const s=String(seed);
    for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; }
    // Avalanche finale (xorshift) → bonne dispersion même pour des seeds proches
    h^=h>>>16; h=Math.imul(h,2246822507)>>>0; h^=h>>>13; h=Math.imul(h,3266489909)>>>0; h^=h>>>16;
    r=(h>>>0)/4294967296*total;
  } else r=Math.random()*total;
  for(const [race,w] of entries){ r-=w; if(r<=0) return race; }
  return 'human';
}

// ── PILIER CÉLESTE : races par ALTITUDE (division), pas par région ─────────
// Le Pilier n'a qu'une région mais une répartition verticale : anges dominants
// aux sommets, démons dominants aux fondations. On choisit donc la table de
// poids selon le `level` de la division. ~5 % de peuples « autres » n'existent
// que dans les basses divisions (r3/dh), jamais dans l'élite.
const PILIER_RACE_WEIGHTS_BY_LEVEL = {
  d1: { angel:80, demon:20 },                         // Grand Trône Divin : anges
  d2: { angel:70, demon:30 },                         // Zénith
  d3: { angel:58, demon:42 },                         // 1re Céleste : équilibre
  r1: { angel:45, demon:55 },                         // 2e Céleste
  r2: { angel:32, demon:63, human:2, orc:1, goblin:1, vampire:1 }, // 3e Céleste : autres apparaissent
  r3: { angel:20, demon:73, human:3, orc:1, goblin:1, dwarf:1, lycan:1 }, // 4e Céleste
  dh: { angel:12, demon:78, human:4, orc:2, goblin:2, dwarf:1, lycan:1 }, // Fondations : ~10 % autres
};
function pickRaceForPilier(level, seed){
  const table = PILIER_RACE_WEIGHTS_BY_LEVEL[level] || PILIER_RACE_WEIGHTS_BY_LEVEL.dh;
  const entries = Object.entries(table).filter(([,w])=>w>0);
  const total = entries.reduce((s,[,w])=>s+w,0);
  let r;
  if(seed!=null){
    let h=2166136261>>>0; const s=String(seed);
    for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; }
    h^=h>>>16; h=Math.imul(h,2246822507)>>>0; h^=h>>>13; h=Math.imul(h,3266489909)>>>0; h^=h>>>16;
    r=(h>>>0)/4294967296*total;
  } else r=Math.random()*total;
  for(const [race,w] of entries){ r-=w; if(r<=0) return race; }
  return 'demon';
}

// Migration : attribue une race aux joueurs d'une save antérieure au système
// (ceux sans champ `race`). Déterministe par nom pour rester stable.
function ensurePlayerRace(p, region){
  if(!p) return;
  if(p.race && RACE_MODIFIERS[p.race]) return; // déjà une race valide
  p.race = pickRaceForRegion(region||'', (p.name||'')+(p.pos||''));
}
function ensureTeamRaces(team){
  if(!team) return;
  const region = team.region || team.regionId || '';
  ['players','bench','reserves'].forEach(key=>{
    if(Array.isArray(team[key])) team[key].forEach(p=>ensurePlayerRace(p, region));
  });
}

// ── ESPÉRANCE DE CARRIÈRE PAR RACE ──────────────────────────────────────
// Purement physiologique (cf. principe anti-essentialisme en tête de
// fichier). Deux cas particuliers de lore à respecter :
//   • RACES IMMORTELLES (démon, vampire, ange, fée) : le corps ne se
//     dégrade pas avec l'âge — pas de déclin de stats, pas de retraite
//     forcée liée à l'âge (peakEnd/declineEnd = Infinity, retire = []).
//     Une carrière peut prendre fin pour d'autres raisons (transfert,
//     choix personnel…) mais jamais "l'âge" en tant que tel.
//   • GOBELIN : maturité quasi immédiate (dès ~8 ans) — pas de vraie phase
//     de progression "jeune pousse" dans la tranche d'âge jouée (16-34) ;
//     un gobelin de 16 ans est déjà un adulte fait.
// Seuils en "âge de joueur" (mêmes unités que p.age) :
//   youthEnd    : fin de la forte progression (jeunes pousses)
//   earlyEnd    : fin de la progression modérée
//   peakEnd     : fin du pic de forme (stats stables)
//   declineEnd  : fin du déclin léger (au-delà : déclin marqué)
//   retire      : paliers [{age, chance}] de retraite en fin de saison
const RACE_AGE_PROFILES = {
  human:       { youthEnd:20, earlyEnd:23, peakEnd:28, declineEnd:31, retire:[{age:32,chance:0.12},{age:34,chance:0.45},{age:36,chance:0.90}] },
  // Immortelles : jamais de déclin physique ni de retraite liée à l'âge.
  demon:       { youthEnd:19, earlyEnd:21, peakEnd:Infinity, declineEnd:Infinity, retire:[] },
  angel:       { youthEnd:21, earlyEnd:24, peakEnd:Infinity, declineEnd:Infinity, retire:[] },
  vampire:     { youthEnd:23, earlyEnd:26, peakEnd:Infinity, declineEnd:Infinity, retire:[] },
  fairy:       { youthEnd:18, earlyEnd:20, peakEnd:Infinity, declineEnd:Infinity, retire:[] },
  half_dragon: { youthEnd:21, earlyEnd:24, peakEnd:30, declineEnd:33, retire:[{age:34,chance:0.10},{age:37,chance:0.40},{age:40,chance:0.85}] },
  elf:         { youthEnd:22, earlyEnd:25, peakEnd:33, declineEnd:36, retire:[{age:37,chance:0.10},{age:40,chance:0.40},{age:44,chance:0.85}] },
  siren:       { youthEnd:21, earlyEnd:24, peakEnd:29, declineEnd:32, retire:[{age:33,chance:0.12},{age:36,chance:0.42},{age:39,chance:0.85}] },
  leyak:       { youthEnd:19, earlyEnd:21, peakEnd:24, declineEnd:27, retire:[{age:27,chance:0.15},{age:30,chance:0.50},{age:33,chance:0.90}] },
  // Maturité quasi immédiate (~8 ans) : déjà adulte fait à l'entrée en jeu.
  goblin:      { youthEnd:8,  earlyEnd:10, peakEnd:23, declineEnd:26, retire:[{age:26,chance:0.15},{age:29,chance:0.50},{age:32,chance:0.90}] },
  hobgoblin:   { youthEnd:20, earlyEnd:23, peakEnd:28, declineEnd:31, retire:[{age:32,chance:0.12},{age:34,chance:0.45},{age:36,chance:0.90}] },
  orc:         { youthEnd:19, earlyEnd:21, peakEnd:25, declineEnd:28, retire:[{age:28,chance:0.15},{age:31,chance:0.50},{age:34,chance:0.90}] },
  dwarf:       { youthEnd:21, earlyEnd:24, peakEnd:31, declineEnd:34, retire:[{age:35,chance:0.10},{age:38,chance:0.40},{age:42,chance:0.85}] },
  lycan:       { youthEnd:20, earlyEnd:23, peakEnd:27, declineEnd:30, retire:[{age:30,chance:0.14},{age:33,chance:0.48},{age:36,chance:0.90}] },
  giant:       { youthEnd:20, earlyEnd:22, peakEnd:25, declineEnd:28, retire:[{age:28,chance:0.16},{age:31,chance:0.52},{age:34,chance:0.90}] },
};

// Profil d'âge d'une race (repli humain si race inconnue/absente — sûr pour
// les sauvegardes antérieures au système de races).
function raceAgeProfile(race){
  return RACE_AGE_PROFILES[race] || RACE_AGE_PROFILES.human;
}

// Chance de retraite en fin de saison pour un âge donné, selon le profil de
// la race (le palier le plus élevé encore atteint par l'âge s'applique).
function raceRetireChance(race, age){
  const profile = raceAgeProfile(race);
  let chance = 0;
  (profile.retire||[]).forEach(function(step){ if(age >= step.age) chance = step.chance; });
  return chance;
}

if(typeof window!=='undefined'){
  window.RACE_MODIFIERS = RACE_MODIFIERS;
  window.RACE_IDS = RACE_IDS;
  window.applyRaceStat = applyRaceStat;
  window.raceMagicMul = raceMagicMul;
  window.raceMeta = raceMeta;
  window.RACE_WEIGHTS_BY_REGION = RACE_WEIGHTS_BY_REGION;
  window.pickRaceForRegion = pickRaceForRegion;
  window.pickRaceForPilier = pickRaceForPilier;
  window.ensurePlayerRace = ensurePlayerRace;
  window.ensureTeamRaces = ensureTeamRaces;
  window.RACE_AGE_PROFILES = RACE_AGE_PROFILES;
  window.raceAgeProfile = raceAgeProfile;
  window.raceRetireChance = raceRetireChance;
}
