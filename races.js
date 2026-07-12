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

if(typeof window!=='undefined'){
  window.RACE_MODIFIERS = RACE_MODIFIERS;
  window.RACE_IDS = RACE_IDS;
  window.applyRaceStat = applyRaceStat;
  window.raceMagicMul = raceMagicMul;
  window.raceMeta = raceMeta;
  window.RACE_WEIGHTS_BY_REGION = RACE_WEIGHTS_BY_REGION;
  window.pickRaceForRegion = pickRaceForRegion;
  window.ensurePlayerRace = ensurePlayerRace;
  window.ensureTeamRaces = ensureTeamRaces;
}
