// Générateur DÉTERMINISTE des effectifs figés (Valoria + Pilier) → roster.js
// Lancé une seule fois hors-ligne. Tout est seedé sur le nom → reproductible.
const fs = require('fs');
global.window = {};
// Toutes les deps peuplent le même window global.
require('./races.js');
require('./valoria_teams.js');
require('./pilier_teams.js');

// spellForPos (copié de data.js pour éviter d'exécuter tout data.js au require).
window.spellForPos = function(pos, seed){
  const P={ GK:['main','shield','peaupierre'], DEF:['shield','peaupierre','pass','tacle_mauvais'],
    MID:['pass','tech','soin','illusion'], FWD:['fire','tech','illusion','fireball'] };
  let g='MID';
  if(pos==='GB'||pos==='GK') g='GK';
  else if(/^(DC|DD|DG|DCD|DCG|LB|RB|FIXO|MDC)/.test(pos)) g='DEF';
  else if(/^(AG|AD|ALA|ATT|ATT2|PIVOT|MO)/.test(pos)) g=(/^(ATT|PIVOT|MO)/.test(pos))?'FWD':'MID';
  const opts=P[g]||P.MID;
  let h=0; const s=String(seed); for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;
  return [opts[h%opts.length]];
};

const VALORIA = window.VALORIA_TEAMS || [];
const VDIV = window.VALORIA_DIVISIONS || {};
const PILIER = window.PILIER_TEAMS || [];
const pickRaceForRegion = window.pickRaceForRegion;
const pickRaceForPilier = window.pickRaceForPilier;

// ── RNG déterministe seedé (mulberry32) ────────────────────────────────
function seedNum(str){ let h=2166136261>>>0; str=String(str);
  for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return h>>>0; }
function rng(seedStr){ let a=seedNum(seedStr);
  return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

// ── Barème OVR par niveau (identique à ui_teams._OVR_BY_LEVEL) ──────────
const OVR_BY_LEVEL       = { d1:88, d2:80, d3:73, r1:60, r2:50, r3:42, dh:33 };
const OVR_BY_LEVEL_PILIER= { d1:84, d2:79, d3:74 };
// Valoria = niveau championnat croate (HNL) : élite plus modeste que le Pilier.
// Top (Dinamo/Hajduk) ~74-78, gros clubs européens ~70-74, reste 62-70.
const OVR_BY_LEVEL_VALORIA = { d1:74, d2:68, d3:63 };

const ROLE7 = ['GB','DC','DD','DG','MC','MC','ATT'];  // 7 titulaires
const BENCH_POS = ['GB','DC','MC','MO','ATT'];         // 5 remplaçants
const RES_POS   = ['DC','DD','MC','MO','ATT','DG','MC','ATT','MC','DC']; // réserve

// Niveau d'un club (level explicite pour Pilier, dérivé pour Valoria).
function levelOf(t){
  if(t.level && OVR_BY_LEVEL[t.level]) return t.level;
  const tier=t.tier||'regional';
  const div=String(t.division||'');
  const m=div.match(/(\d+)/); const n=m?parseInt(m[1],10):1;
  if(tier==='pro')      return 'd1';               // Valoria : 1 seule ligue pro = élite locale
  if(tier==='regional') return ['r1','r2','r3'][Math.min(n-1,2)]||'r2';
  if(tier==='district') return 'dh';
  return 'r2';
}
function centerFor(t, lvl){
  if(t.region==='Le Pilier' && OVR_BY_LEVEL_PILIER[lvl]!=null) return OVR_BY_LEVEL_PILIER[lvl];
  if(t.nation==='Valoria' || t.country==='Valoria' || VALORIA.includes(t)){
    if(OVR_BY_LEVEL_VALORIA[lvl]!=null) return OVR_BY_LEVEL_VALORIA[lvl];
  }
  return OVR_BY_LEVEL[lvl]!=null ? OVR_BY_LEVEL[lvl] : 55;
}

// Convertit un OVR cible en bloc de 6 stats cohérent avec le poste.
function statsForOvr(ovr, pos, rand){
  // Profils : chaque poste privilégie certaines stats.
  const P = {
    GB:  {def:1.15,res:1.10,tec:.85,sht:.70,spd:.90,stam:1.0},
    DC:  {def:1.20,res:1.05,tec:.85,sht:.75,spd:.95,stam:1.0},
    DD:  {def:1.10,spd:1.10,res:1.0,tec:.95,sht:.85,stam:1.05},
    DG:  {def:1.10,spd:1.10,res:1.0,tec:.95,sht:.85,stam:1.05},
    MC:  {tec:1.15,stam:1.10,def:1.0,res:1.0,sht:.95,spd:1.0},
    MO:  {tec:1.20,sht:1.05,spd:1.05,stam:1.0,def:.85,res:.95},
    ATT: {sht:1.25,spd:1.10,tec:1.05,res:.95,def:.75,stam:1.0},
  };
  const prof = P[pos] || P.MC;
  const keys=['spd','sht','def','stam','tec','res'];
  const out={};
  keys.forEach(k=>{
    const mult = prof[k]||1.0;
    // Bruit ±5 autour de l'OVR, puis pondéré par le profil de poste.
    const noisy = ovr + (rand()*10-5);
    let v = Math.round(noisy * mult);
    out[k] = Math.max(20, Math.min(99, v));
  });
  return out;
}
// OVR effectif d'un bloc de stats (même formule que _statAvg côté jeu).
function ovrOfStats(s){ return Math.round((s.sht+s.spd+s.def+s.stam+s.tec+s.res)/6); }

// Noms (mêmes pools d'inspiration que le jeu, élargis).
const FIRST_BY_RACE = {
  angel:['Seraphiel','Uriel','Cassiel','Raziel','Camael','Zadkiel','Nathaniel','Ariel','Gabriel','Israfel'],
  demon:['Malphas','Voryn','Azraq','Belial','Nyx','Kael','Drathen','Morvar','Sethis','Abaddon'],
  human:['Marco','Luka','Ivan','Ante','Josip','Mateo','Nikola','Petar','Dario','Tomislav',
         'Léo','Hugo','Enzo','Théo','Noah','Adem','Youssef','Karim','Bruno','Diego'],
  orc:['Grum','Thrak','Ozgar','Mruk','Karg'], goblin:['Zik','Nib','Griz','Snek','Pok'],
  dwarf:['Balin','Durn','Thori','Grimm','Kazad'], vampire:['Vlad','Sanguin','Nocturn','Draven','Mircea'],
  lycan:['Fenrir','Rurik','Ulfar','Greymane','Bjorn'],
};
const LAST = ['Horvat','Kovač','Novak','Marić','Jurić','Babić','Knežević','Perić','Božić','Vuković',
  'Radić','Šimić','Petrović','Blažević','Tomić','Grgić','Lovren','Modrić','Rakitić','Kovačić',
  'Silva','Costa','Ferreira','Santos','Almeida','Pereira','Rocha','Neves','Dias','Fonseca'];

function pickName(race, rand, used){
  const fpool = FIRST_BY_RACE[race] || FIRST_BY_RACE.human;
  for(let tries=0; tries<20; tries++){
    const f = fpool[Math.floor(rand()*fpool.length)];
    const l = LAST[Math.floor(rand()*LAST.length)];
    const full = (race==='angel'||race==='demon') ? f : (f+' '+l);
    if(!used.has(full)){ used.add(full); return full; }
  }
  return (fpool[0]+' '+Math.floor(rand()*999));
}
function raceFor(club, lvl, seed){
  if(club.region==='Le Pilier' && pickRaceForPilier) return pickRaceForPilier(lvl, seed);
  if(pickRaceForRegion) return pickRaceForRegion(club.region||'', seed);
  return 'human';
}

// Combien de réservistes : dépend de la "richesse" (niveau + variation).
// Élite = effectif garni (jusqu'à 10) ; bas-fonds = souvent 1-3.
function reserveCount(lvl, rand){
  const rank = {d1:6,d2:5,d3:4,r1:3,r2:2,r3:2,dh:1}[lvl] ?? 2;
  // base + variation, borné 1..8, avec ~15% de "clubs qui ont craqué" → jusqu'à 10.
  let n = rank + Math.floor(rand()*3);        // rank..rank+2
  n = Math.max(1, Math.min(8, n));
  if((lvl==='d1'||lvl==='d2') && rand()<0.18) n = 9 + Math.floor(rand()*2); // 9-10
  return n;
}

function makePlayer(club, lvl, pos, idx, rand, used, center){
  const seed = club.name+'|'+pos+'|'+idx;
  const race = raceFor(club, lvl, seed);
  const name = pickName(race, rand, used);
  // OVR individuel : centre du club ±6, gardien/pièce maîtresse un peu au-dessus.
  const indiv = Math.max(20, Math.min(97, Math.round(center + (rand()*12-6))));
  const s = statsForOvr(indiv, pos, rand);
  const ini = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const spells = window.spellForPos ? window.spellForPos(pos, seed) : [];
  return { name, pos, ini, race, s, spells };
}

function buildSquad(club){
  const lvl = levelOf(club);
  const center = centerFor(club, lvl);
  const rand = rng('ROSTER|'+club.name);
  const used = new Set();
  const players = ROLE7.map((pos,i)=>makePlayer(club,lvl,pos,i,rand,used,center));
  const bench   = BENCH_POS.map((pos,i)=>makePlayer(club,lvl,pos,i+7,rand,used,center-2));
  const nRes    = reserveCount(lvl, rand);
  const reserves= [];
  for(let i=0;i<nRes;i++){ reserves.push(makePlayer(club,lvl,RES_POS[i%RES_POS.length],i+12,rand,used,center-4)); }
  // OVR d'équipe réel (moyenne titulaires) pour vérif.
  const teamOvr = Math.round(players.reduce((a,p)=>a+ovrOfStats(p.s),0)/players.length);
  return { players, bench, reserves, _ovr:teamOvr, _lvl:lvl, _n:players.length+bench.length+reserves.length };
}

// ── Génère et écrit roster.js ──────────────────────────────────────────
const roster = {};
const report = {};
[...VALORIA, ...PILIER].forEach(club=>{
  const sq = buildSquad(club);
  roster[club.name] = { players:sq.players, bench:sq.bench, reserves:sq.reserves };
  const k = (club.region==='Le Pilier'?'PIL:':'VAL:')+sq._lvl;
  (report[k]=report[k]||[]).push(sq._ovr);
});

// Rapport de calibrage (min/moy/max par groupe-niveau).
console.log('=== Calibrage OVR par groupe/niveau ===');
Object.keys(report).sort().forEach(k=>{
  const a=report[k]; const mn=Math.min(...a),mx=Math.max(...a),av=Math.round(a.reduce((x,y)=>x+y,0)/a.length);
  console.log('  '+k.padEnd(9)+' n='+String(a.length).padStart(3)+'  OVR min '+mn+' / moy '+av+' / max '+mx);
});
// Réserves : distribution des tailles.
const resSizes={}; Object.values(roster).forEach(r=>{const n=r.reserves.length;resSizes[n]=(resSizes[n]||0)+1;});
console.log('=== Tailles de réserve (nb clubs) ===');
Object.keys(resSizes).sort((a,b)=>a-b).forEach(n=>console.log('  '+n+' réservistes : '+resSizes[n]+' clubs'));

const header = '// ═══════════════════════════════════════════════════════════════════\n'
  + '// ROSTER.JS — Effectifs FIGÉS (Valoria + Pilier). Généré déterministe.\n'
  + '// Données persistantes uniquement (name/pos/ini/race/s/spells) ; le bloc\n'
  + '// runtime (positions, animation, buffs) est ajouté à la volée par\n'
  + '// hydratePlayer() dans ui_teams.js au chargement. NE PAS éditer à la main :\n'
  + '// relancer build_roster.js pour régénérer.\n'
  + '// ═══════════════════════════════════════════════════════════════════\n';
const body = 'const FIXED_ROSTERS = ' + JSON.stringify(roster) + ';\n'
  + 'if(typeof window!==\'undefined\'){ window.FIXED_ROSTERS = FIXED_ROSTERS; }\n';
fs.writeFileSync('roster.js', header+body);
const kb = Math.round(fs.statSync('roster.js').size/1024);
console.log('\nroster.js écrit : '+Object.keys(roster).length+' clubs, '+kb+' Ko');
