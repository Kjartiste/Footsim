'use strict';
// ══════════════════════════════════════════════════════════════════════
//  SPONSORS.JS — Système de sponsors en carrière Dirigeant
//
//  Module ADDITIF et défensif : si careerV2 / le club n'existe pas, toutes
//  les fonctions renvoient des valeurs neutres et le jeu tourne comme avant.
//
//  Un club dispose de 4 EMPLACEMENTS de sponsoring, chacun pouvant accueillir
//  un contrat à la fois :
//    • maillot        (sponsor principal, face avant) — le plus lucratif
//    • manche         (sponsor de manche)
//    • equipementier  (fournisseur des maillots)
//    • stade          (naming / panneaux du stade)
//
//  Chaque contrat : { slot, name, weekly, signBonus, weeks, weeksLeft,
//                      objective|null }.
//  Un objectif optionnel verse une PRIME de fin de contrat s'il est atteint
//  (ex. « terminer dans le top 5 », « ne pas être relégué »).
//
//  Les paiements hebdomadaires s'ajoutent aux revenus (voir
//  _weeklyCareerRevenue) ; la prime de signature est créditée immédiatement.
// ══════════════════════════════════════════════════════════════════════

const SPONSORS = (function(){

  // ── Emplacements ───────────────────────────────────────────────────
  const SLOTS = [
    { key:'maillot',       label:'Sponsor maillot',   icon:'👕', weightMul:1.00 },
    { key:'manche',        label:'Sponsor manche',    icon:'🎽', weightMul:0.45 },
    { key:'equipementier', label:'Équipementier',     icon:'🥾', weightMul:0.60 },
    { key:'stade',         label:'Naming du stade',   icon:'🏟️', weightMul:0.70 },
  ];
  const SLOT_ORDER = SLOTS.map(function(s){ return s.key; });
  function slotDef(key){ return SLOTS.find(function(s){ return s.key===key; }) || SLOTS[0]; }

  // ── Banques de noms de marques (univers neutre / aquatique du jeu) ──
  const BRANDS = {
    maillot: ['AbyssTel','Marega','NyxCola','CoralBank','TritonAir','PelagosPay','OndaMobile','KrakenEnergy','LumenSea','VortexBet'],
    manche:  ['SelKa','BrumeVive','AquaPur','Récif+','MaréeFC','SonarPro','NacreCo'],
    equipementier: ['Squale','Méduse Sport','Nérite','FinTech Wear','Abysse Athletic','Vague9'],
    stade:   ['Arena Corail','Dôme Pélagique','Grand Bleu','Baie d\'Argent','Lagon Central','Fosse aux Requins'],
  };
  function randBrand(slot){
    const arr = BRANDS[slot] || BRANDS.maillot;
    return arr[Math.floor(Math.random()*arr.length)];
  }

  // ── Valeur de base hebdomadaire par niveau de club ─────────────────
  // Sert de référence : chaque emplacement applique son weightMul, la
  // réputation et un facteur aléatoire d'offre.
  const LEVEL_BASE = {
    'dh_4':20,'dh_3':28,'dh_2':40,'dh_1':60, dh:40,
    r3:180, r2:420, r1:1100, d3:5000, d2:15000, d1:55000,
  };
  function levelBase(level){ return LEVEL_BASE[level] || LEVEL_BASE.dh; }

  // ── Objectifs de contrat possibles (prime si atteint en fin de contrat) ─
  // Chaque objectif référence une fonction d'évaluation lue à l'expiration.
  const OBJECTIVES = [
    { id:'no_releg', label:'Éviter la relégation',      bonusMul:6 },
    { id:'top5',     label:'Terminer dans le top 5',    bonusMul:10 },
    { id:'promo',    label:'Monter en division',        bonusMul:16 },
    { id:'win8',     label:'Gagner au moins 8 matchs',  bonusMul:8 },
  ];
  function objectiveById(id){ return OBJECTIVES.find(function(o){ return o.id===id; }) || null; }

  // ── Génère une liste d'offres pour un emplacement donné ────────────
  // Renvoie 2-3 offres variées (durée / prime / objectif) adaptées au niveau
  // et à la réputation du club.
  function offersFor(club, slot){
    const level = (club && club.level) || 'dh';
    const rep   = (club && typeof club.reputation==='number') ? club.reputation : 50;
    const base  = levelBase(level) * slotDef(slot).weightMul;
    const repMul = 0.7 + Math.min(1.2, rep/120); // 0.7 .. ~1.9

    const templates = [
      // Court, sûr, sans objectif.
      { weeks:20, variance:0.85, objChance:0.0,  bonusW:2 },
      // Moyen, offre correcte, objectif modéré.
      { weeks:34, variance:1.00, objChance:0.6,  bonusW:4 },
      // Long, gros contrat, objectif ambitieux.
      { weeks:52, variance:1.20, objChance:0.9,  bonusW:6 },
    ];

    return templates.map(function(t){
      const weekly = Math.max(1, Math.round(base * t.variance * repMul * (0.9 + Math.random()*0.25)));
      const signBonus = Math.round(weekly * (t.bonusW + Math.random()*2));
      let objective = null;
      if(Math.random() < t.objChance){
        const o = OBJECTIVES[Math.floor(Math.random()*OBJECTIVES.length)];
        objective = { id:o.id, label:o.label, bonus: Math.round(weekly * o.bonusMul) };
      }
      return { slot:slot, name:randBrand(slot), weekly:weekly, signBonus:signBonus,
               weeks:t.weeks, weeksLeft:t.weeks, objective:objective };
    });
  }

  // ── Accès aux contrats actifs du club ──────────────────────────────
  function ensure(club){
    if(!club) return;
    if(!club.sponsors || typeof club.sponsors!=='object'){
      club.sponsors = { maillot:null, manche:null, equipementier:null, stade:null };
    }
    // Migration : ancien champ `sponsor` (unique) → emplacement maillot.
    if(club.sponsor && !club.sponsors.maillot){
      if(typeof club.sponsor==='object' && club.sponsor.weekly){
        club.sponsors.maillot = Object.assign({ slot:'maillot' }, club.sponsor);
      }
      club.sponsor = null;
    }
    SLOT_ORDER.forEach(function(k){ if(club.sponsors[k]===undefined) club.sponsors[k]=null; });
  }
  function active(club){
    if(!club || !club.sponsors) return [];
    return SLOT_ORDER.map(function(k){ return club.sponsors[k]; }).filter(Boolean);
  }

  // ── Revenu hebdomadaire total des sponsors ─────────────────────────
  function weeklyIncome(club){
    return active(club).reduce(function(sum,c){ return sum + (c.weekly||0); }, 0);
  }

  // ── Signature d'un contrat ─────────────────────────────────────────
  // Renvoie {ok, bonus} ; pose le contrat sur son emplacement (remplace
  // l'éventuel contrat existant) et crédite la prime de signature.
  function sign(club, deal){
    if(!club || !deal || !deal.slot) return { ok:false };
    ensure(club);
    club.sponsors[deal.slot] = {
      slot: deal.slot, name: deal.name, weekly: deal.weekly,
      signBonus: deal.signBonus, weeks: deal.weeks, weeksLeft: deal.weeks,
      objective: deal.objective || null,
    };
    return { ok:true, bonus: deal.signBonus||0 };
  }

  // Résiliation anticipée (avec pénalité = ~4 semaines de contrat).
  function terminationFee(deal){ return deal ? Math.round((deal.weekly||0) * 4) : 0; }

  // ── Évalue si l'objectif d'un contrat est atteint (fin de saison) ──
  // stats attendu : { relegated:bool, rank:int, promoted:bool, wins:int }.
  function objectiveMet(objId, stats){
    if(!objId || !stats) return false;
    switch(objId){
      case 'no_releg': return !stats.relegated;
      case 'top5':     return typeof stats.rank==='number' && stats.rank>0 && stats.rank<=5;
      case 'promo':    return !!stats.promoted;
      case 'win8':     return (stats.wins||0) >= 8;
      default: return false;
    }
  }

  // ── Décrément hebdomadaire + expiration ────────────────────────────
  // Renvoie la liste des contrats qui viennent d'expirer (pour notifier).
  function tickWeek(club){
    if(!club || !club.sponsors) return [];
    const expired = [];
    SLOT_ORDER.forEach(function(k){
      const c = club.sponsors[k];
      if(!c) return;
      c.weeksLeft = (typeof c.weeksLeft==='number' ? c.weeksLeft : c.weeks) - 1;
      if(c.weeksLeft <= 0){ expired.push(c); club.sponsors[k] = null; }
    });
    return expired;
  }

  return {
    SLOTS: SLOTS, SLOT_ORDER: SLOT_ORDER, slotDef: slotDef, OBJECTIVES: OBJECTIVES,
    offersFor: offersFor, ensure: ensure, active: active, weeklyIncome: weeklyIncome,
    sign: sign, terminationFee: terminationFee, objectiveMet: objectiveMet, tickWeek: tickWeek,
    objectiveById: objectiveById,
  };
})();

if(typeof window!=='undefined') window.SPONSORS = SPONSORS;
