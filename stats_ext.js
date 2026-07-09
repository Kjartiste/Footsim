'use strict';
// ══════════════════════════════════════════════════════════════════════
//  STATS ÉTENDUES + PARAMÈTRES  (Couche 1 — Étape A : données + affichage)
//  Le socle du moteur reste les 6 stats de base (p.s). Les stats détaillées
//  vivent dans p.s2 et sont, pour l'instant, purement informatives/visuelles.
//  Le branchement moteur (mode Complet influençant le match) viendra à l'étape B.
// ══════════════════════════════════════════════════════════════════════

// ── PARAMÈTRES GLOBAUX ────────────────────────────────────────────────
// Persistés en localStorage. Premier réglage : le mode d'affichage des stats.
const GS_DEFAULTS = {
  statMode: 'lite',   // 'lite' = 6 stats (jeu actuel) | 'complet' = stats détaillées
};
window.GS = Object.assign({}, GS_DEFAULTS);

function loadSettings(){
  try{
    const raw = localStorage.getItem('footsim_settings');
    if(raw){ Object.assign(window.GS, GS_DEFAULTS, JSON.parse(raw)); }
  }catch(e){ /* réglages par défaut */ }
  return window.GS;
}
function saveSettings(){
  try{ localStorage.setItem('footsim_settings', JSON.stringify(window.GS)); }catch(e){}
}
function setStatMode(mode){
  window.GS.statMode = (mode==='complet') ? 'complet' : 'lite';
  saveSettings();
  // Rafraîchir tout ce qui affiche des stats
  if(typeof renderSettings==='function' && document.getElementById('sp-settings')?.classList.contains('on')) renderSettings();
  if(typeof renderTB==='function'){ try{ renderTB(0); renderTB(1); }catch(e){} }
  if(typeof _reRenderOpenPlayerEditor==='function'){ try{ _reRenderOpenPlayerEditor(); }catch(e){} }
}
window.isComplet = ()=> window.GS && window.GS.statMode==='complet';

// Charger les réglages au plus tôt
loadSettings();

// ── DÉFINITION DES STATS ÉTENDUES ─────────────────────────────────────
// Chaque sous-stat appartient à une catégorie et "dérive" d'une des 6 stats
// de base (base) — ce qui permet de générer p.s2 pour tous les joueurs
// existants automatiquement, et servira de pont vers le moteur à l'étape B.
// {key, label, base}  — base ∈ spd|sht|def|stam|tec|res
const STAT_DEFS = {
  physique: {
    label: 'Physique', color: '#e0603c',
    stats: [
      {key:'accel',   label:'Accélération',            base:'spd'},
      {key:'vitesse', label:'Vitesse de pointe',       base:'spd'},
      {key:'agilite', label:'Agilité',                 base:'spd'},
      {key:'equilibre',label:'Équilibre',              base:'res'},
      {key:'force',   label:'Force',                   base:'res'},
      {key:'detente', label:'Détente',                 base:'spd'},
      {key:'endurance',label:'Endurance',              base:'stam'},
      {key:'resBless',label:'Résistance blessures',    base:'res'},
      {key:'recup',   label:'Récupération',            base:'stam'},
    ],
  },
  technique: {
    label: 'Technique', color: '#f0c028',
    stats: [
      {key:'controle', label:'Contrôle',               base:'tec'},
      {key:'dribble',  label:'Dribble',                base:'tec'},
      {key:'passeC',   label:'Passe courte',           base:'tec'},
      {key:'passeL',   label:'Passe longue',           base:'tec'},
      {key:'centre',   label:'Centre',                 base:'tec'},
      {key:'tir',      label:'Tir',                    base:'sht'},
      {key:'finition', label:'Finition',               base:'sht'},
      {key:'volee',    label:'Volée',                  base:'sht'},
      {key:'cf',       label:'Coups francs',           base:'sht'},
      {key:'corner',   label:'Corners',                base:'tec'},
      {key:'penalty',  label:'Penalty',                base:'sht'},
      {key:'tacle',    label:'Tacle',                  base:'def'},
      {key:'marquage', label:'Marquage',               base:'def'},
      {key:'tete',     label:'Jeu de tête',            base:'res'},
    ],
  },
  mental: {
    label: 'Mental', color: '#1878e8',
    stats: [
      {key:'vision',       label:'Vision',             base:'tec'},
      {key:'decision',     label:'Décision',           base:'tec'},
      {key:'anticipation', label:'Anticipation',       base:'def'},
      {key:'concentration',label:'Concentration',      base:'def'},
      {key:'sangFroid',    label:'Sang-froid',         base:'sht'},
      {key:'courage',      label:'Courage',            base:'res'},
      {key:'leadership',   label:'Leadership',         base:'res'},
      {key:'collectif',    label:'Collectif',          base:'tec'},
      {key:'placement',    label:'Placement',          base:'def'},
      {key:'activite',     label:'Activité (work rate)',base:'stam'},
      {key:'agressivite',  label:'Agressivité',        base:'def'},
      {key:'determination',label:'Détermination',      base:'res'},
      {key:'flair',        label:'Flair (créativité)', base:'tec'},
    ],
  },
  magie: {
    label: 'Magie', color: '#8840e0',
    stats: [
      {key:'affinite',     label:'Affinité magique',   base:'tec'},
      {key:'manaCtrl',     label:'Contrôle du mana',   base:'stam'},
      {key:'maitrise',     label:'Maîtrise des sorts', base:'tec'},
      {key:'resMagie',     label:'Résistance magique', base:'res'},
      {key:'manaRegen',    label:'Régén. de mana',     base:'stam'},
      {key:'instabilite',  label:'Instabilité',        base:'sht'},
      {key:'aura',         label:'Aura',               base:'res'},
    ],
  },
};

// Feuille de stats spécifique aux gardiens (poste GB) : remplace la catégorie
// "technique" par des attributs de gardien.
const GK_STAT_DEFS = {
  physique: STAT_DEFS.physique,
  gardien: {
    label: 'Gardien', color: '#18c860',
    stats: [
      {key:'reflexes',   label:'Réflexes',             base:'def'},
      {key:'degagement', label:'Dégagement',           base:'sht'},
      {key:'prises',     label:'Prises de balle',      base:'def'},
      {key:'sorties',    label:'Sorties aériennes',    base:'res'},
      {key:'unContreUn', label:'Un contre un',         base:'def'},
      {key:'placementGk',label:'Placement',            base:'def'},
      {key:'communication',label:'Communication',      base:'res'},
      {key:'relances',   label:'Relances',             base:'tec'},
      {key:'jeuPied',    label:'Jeu au pied',          base:'tec'},
    ],
  },
  mental: STAT_DEFS.mental,
  magie: STAT_DEFS.magie,
};

// Liste plate {key -> def} pour lookups rapides
const _ALL_STAT_LIST = (()=>{
  const out = {};
  [STAT_DEFS, GK_STAT_DEFS].forEach(group=>{
    Object.values(group).forEach(cat=>cat.stats.forEach(st=>{ out[st.key] = st; }));
  });
  return out;
})();

// Renvoie l'ensemble de catégories adapté au poste du joueur
function statDefsFor(p){
  return (p && p.pos==='GB') ? GK_STAT_DEFS : STAT_DEFS;
}

// ── GÉNÉRATION DES STATS DÉTAILLÉES (p.s2) ────────────────────────────
// Dérive chaque sous-stat de sa stat de base + variance déterministe, pour
// que deux joueurs de même OVR aient malgré tout des profils différents.
function _rndAround(base, spread){
  const v = Math.round(base + (Math.random()-0.5)*2*spread);
  return Math.max(1, Math.min(99, v));
}
function ensurePlayerS2(p){
  if(!p || !p.s) return;
  if(p.s2 && p._s2v===2) return; // déjà généré (version 2)
  const s2 = {};
  const defs = statDefsFor(p);
  Object.values(defs).forEach(cat=>{
    cat.stats.forEach(st=>{
      const baseVal = (p.s[st.base]!=null) ? p.s[st.base] : 50;
      // Si une valeur existait déjà (édition manuelle), la conserver
      if(p.s2 && p.s2[st.key]!=null){ s2[st.key] = p.s2[st.key]; }
      else { s2[st.key] = _rndAround(baseVal, 9); }
    });
  });
  p.s2 = s2;
  p._s2v = 2;
}
// Génère les s2 pour toutes les équipes actuellement en jeu (idempotent)
function ensureAllS2(){
  try{
    (window.teams||[]).forEach(T=>{
      if(!T) return;
      ['players','bench','reserves'].forEach(k=>{
        (T[k]||[]).forEach(ensurePlayerS2);
      });
    });
  }catch(e){}
}

// ── HELPERS D'AFFICHAGE ───────────────────────────────────────────────
function statColor(v){
  return v>=80?'#18c860':v>=65?'#8bc34a':v>=50?'#f0c028':v>=35?'#ff9800':'#e06060';
}
// Moyenne d'une catégorie pour un joueur (pour l'affichage résumé)
function catAverage(p, catKey){
  const defs = statDefsFor(p);
  const cat = defs[catKey];
  if(!cat || !p.s2) return null;
  const vals = cat.stats.map(st=>p.s2[st.key]).filter(v=>v!=null);
  if(!vals.length) return null;
  return Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
}

// ── PONT VERS LE MOTEUR (mode Complet) ────────────────────────────────
// En mode Lite : renvoie la stat de base telle quelle (jeu inchangé).
// En mode Complet : renvoie la stat de base AJUSTÉE par les sous-stats
// pertinentes de p.s2, pour que deux joueurs de même note se comportent
// différemment. L'ajustement est borné pour rester équilibré.
//
// Chaque stat de base est "affinée" par une petite sélection de sous-stats
// qui comptent vraiment pour cette facette du jeu.
const _STATOF_MAP = {
  // base : [sous-stats qui l'affinent]
  spd:  ['accel','vitesse','agilite'],
  sht:  ['finition','sangFroid','tir'],
  def:  ['tacle','marquage','anticipation','placement'],
  tec:  ['controle','dribble','passeC','vision','flair'],
  stam: ['endurance','activite','recup'],
  res:  ['force','equilibre','determination','resBless'],
};
// Version gardien : def/tec pointent vers les attributs de GB
const _STATOF_MAP_GK = {
  spd:  ['accel','agilite','reflexes'],
  sht:  ['degagement','relances'],
  def:  ['reflexes','prises','unContreUn','placementGk'],
  tec:  ['jeuPied','relances','communication'],
  stam: ['endurance','recup'],
  res:  ['force','sorties','courage'],
};

function statOf(p, baseKey){
  const base = (p && p.s && p.s[baseKey]!=null) ? p.s[baseKey] : 50;
  // Mode Lite → stat brute, moteur identique au jeu actuel
  if(!(window.GS && window.GS.statMode==='complet')) return base;
  if(!p || !p.s2) return base;
  const map = (p.pos==='GB') ? _STATOF_MAP_GK : _STATOF_MAP;
  const subs = map[baseKey];
  if(!subs || !subs.length) return base;
  let sum=0, n=0;
  for(const k of subs){ const v=p.s2[k]; if(v!=null){ sum+=v; n++; } }
  if(!n) return base;
  const detailed = sum/n;
  // Mélange : 55% détaillé + 45% base, pour que le socle reste cohérent
  // (un joueur à sht 80 ne devient pas soudainement médiocre) tout en
  // laissant les sous-stats peser réellement sur le comportement.
  const blended = detailed*0.55 + base*0.45;
  return Math.max(1, Math.min(99, Math.round(blended)));
}

window.statOf = statOf;
window._STATOF_MAP = _STATOF_MAP;
window._STATOF_MAP_GK = _STATOF_MAP_GK;

// ── HELPERS MAGIE (mode Complet) ──────────────────────────────────────
// Tous renvoient une valeur NEUTRE en mode Lite (le système de sorts reste
// exactement celui du jeu actuel). En Complet, ils modulent les sorts selon
// les attributs magiques du lanceur (p.s2).
function _mag(p, key, def){
  if(!(window.GS && window.GS.statMode==='complet')) return null; // neutre en Lite
  if(!p || !p.s2 || p.s2[key]==null) return null;
  return p.s2[key];
}
// Multiplicateur de PUISSANCE d'un sort (affinité) : 0.8 → 1.25
function magPowerMult(p){
  const v=_mag(p,'affinite'); if(v==null) return 1;
  return 0.8 + (v/99)*0.45;
}
// Multiplicateur de COÛT en mana (contrôle du mana) : 1.2 → 0.75
function magCostMult(p){
  const v=_mag(p,'manaCtrl'); if(v==null) return 1;
  return 1.2 - (v/99)*0.45;
}
// Multiplicateur de RÉGÉNÉRATION de mana : 0.7 → 1.6
function magRegenMult(p){
  const v=_mag(p,'manaRegen'); if(v==null) return 1;
  return 0.7 + (v/99)*0.9;
}
// Chance qu'un sort RATE à cause de l'instabilité (0 → ~18%), atténuée par la
// maîtrise. Renvoie une probabilité d'échec.
function magFizzleChance(p){
  const inst=_mag(p,'instabilite'); if(inst==null) return 0;
  const mait=_mag(p,'maitrise')||50;
  const raw=(inst/99)*0.18;                 // instabilité pure
  const control=(mait/99)*0.12;             // la maîtrise réduit le risque
  return Math.max(0, raw - control);
}
// Réduction de l'effet d'un sort SUBI (résistance magique) : 1 → 0.6
function magResistMult(target){
  const v=_mag(target,'resMagie'); if(v==null) return 1;
  return 1 - (v/99)*0.4;
}
Object.assign(window, { magPowerMult, magCostMult, magRegenMult, magFizzleChance, magResistMult });

// Exposer sur window pour les autres scripts
Object.assign(window, {
  GS_DEFAULTS, loadSettings, saveSettings, setStatMode,
  STAT_DEFS, GK_STAT_DEFS, statDefsFor, _ALL_STAT_LIST,
  ensurePlayerS2, ensureAllS2, statColor, catAverage,
});
