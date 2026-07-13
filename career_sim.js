// ═══════════════════════════════════════════════════════════════════════
// CAREER_SIM.JS — Simulation automatique en fond des matchs PNJ (carrière V2)
// ───────────────────────────────────────────────────────────────────────
// Objectif : en mode carrière, TOUS les matchs n'impliquant pas le club du
// joueur (matchs PNJ vs PNJ) sont simulés automatiquement, en fond, dès que
// leur date est atteinte ou dépassée sur le calendrier. Le classement reste
// donc toujours cohérent et vivant, journée après journée, sans que le joueur
// ait à cliquer sur quoi que ce soit.
//
// Points clés :
//  • Simulation basée sur la FORCE réelle des équipes (effectif si dispo,
//    sinon niveau/tier de division) — plus crédible qu'un simple hasard.
//  • Rattrapage : à chaque avancée de calendrier, on résout d'un coup tous les
//    matchs PNJ en retard (utile pour byes, trêves, sauts de semaine).
//  • Le match du JOUEUR n'est jamais simulé ici : il reste à jouer/simuler
//    explicitement par le joueur.
//  • Idempotent : un match déjà joué (played=true) n'est jamais rejoué.
// ═══════════════════════════════════════════════════════════════════════

// Force normalisée (0..1) d'un club de championnat, identifié par son entrée
// de classement. On privilégie l'effectif réel s'il a été généré (Pilier),
// sinon on retombe sur la force de division (niveau/tier).
function _npcClubStrength(standingEntry){
  if(!standingEntry) return 0.4;

  // 1) Effectif réel disponible → moyenne des notes des titulaires + banc.
  const sq = standingEntry.squad;
  if(sq && (sq.players || sq.bench)){
    const pool = [].concat(sq.players || [], sq.bench || []);
    if(pool.length){
      let sum = 0, n = 0;
      pool.forEach(function(p){
        if(!p || !p.s) return;
        const v = [p.s.sht, p.s.spd, p.s.def, p.s.stam, p.s.tec, p.s.res]
          .filter(function(x){ return typeof x === 'number'; });
        if(v.length){ sum += v.reduce(function(a,b){ return a+b; }, 0) / v.length; n++; }
      });
      if(n) return Math.max(0.12, Math.min(0.98, (sum / n) / 99));
    }
  }

  // 2) Sinon : force approximative selon le niveau de division.
  const lvl = standingEntry.level;
  if(lvl && typeof _cupTeamStrength === 'function'){
    return _cupTeamStrength(lvl);
  }

  // 3) Sinon : tier générique.
  const tierMap = { pro:0.85, regional:0.55, district:0.35, amateur:0.30 };
  if(standingEntry.tier && tierMap[standingEntry.tier] != null) return tierMap[standingEntry.tier];

  return 0.45;
}

// Tirage de buts type Poisson pondéré par un lambda (force offensive attendue).
function _simGoals(lambda){
  lambda = Math.max(0.15, Math.min(4.5, lambda));
  let L = Math.exp(-lambda), k = 0, p = 1;
  do { k++; p *= Math.random(); } while(p > L);
  return k - 1;
}

// Simule un seul match PNJ (home vs away) à partir de leurs forces (0..1) et
// renvoie {sh, sa}. Avantage du terrain léger pour l'équipe à domicile.
function _simNpcFixtureResult(hStr, aStr){
  const HOME_ADV = 0.10;
  const h = Math.max(0.05, hStr + HOME_ADV);
  const a = Math.max(0.05, aStr);
  const total = h + a;
  const hShare = h / total;
  // Lambda buts : équipe forte marque plus, le total reste réaliste (~2.6 buts).
  const base = 2.6;
  const sh = _simGoals(base * hShare * (0.75 + Math.random() * 0.5));
  const sa = _simGoals(base * (1 - hShare) * (0.75 + Math.random() * 0.5));
  return { sh: sh, sa: sa };
}

// Applique un résultat au classement V2 (met à jour P/W/D/L/GF/GA/Pts).
function _applyNpcStanding(id, gf, ga){
  const st = careerV2 && careerV2.standings;
  if(!st) return;
  const s = st.find(function(x){ return x.id === id; });
  if(!s) return;
  s.P++; s.GF += gf; s.GA += ga;
  if(gf > ga){ s.W++; s.Pts += 3; }
  else if(gf === ga){ s.D++; s.Pts++; }
  else s.L++;
}

// ── CŒUR : rattrape et simule tous les matchs PNJ échus ──────────────────
// Un match PNJ est "échu" si sa date est atteinte ou dépassée par la date
// courante de la carrière. On les résout tous d'un coup, dans l'ordre du
// calendrier, en mettant à jour le classement au passage.
//
// `upToDate` (optionnel) : simuler jusqu'à cette date incluse. Par défaut on
// utilise la date courante de la carrière (careerV2.date).
function _simulateBackgroundNpcFixtures(upToDate){
  const C = careerV2;
  if(!C || !Array.isArray(C.fixtures) || !C.fixtures.length) return 0;

  const limit = upToDate || C.date;
  if(!limit) return 0;
  const limitOrd = (typeof _dateToOrdinal === 'function') ? _dateToOrdinal(limit) : null;

  // Sélection des matchs PNJ non joués dont la date est atteinte/dépassée.
  const due = C.fixtures.filter(function(f){
    if(f.played) return false;
    if(f.homeIsPlayer || f.awayIsPlayer) return false; // jamais le match du joueur
    if(!f.date) return false;
    if(limitOrd == null) return true;
    return _dateToOrdinal(f.date) <= limitOrd;
  });
  if(!due.length) return 0;

  // Ordre chronologique (par sécurité) pour un classement cohérent.
  due.sort(function(a, b){ return _dateToOrdinal(a.date) - _dateToOrdinal(b.date); });

  // Cache des forces par id de club (évite de recalculer l'effectif à chaque match).
  const strCache = {};
  function strOf(id){
    if(strCache[id] != null) return strCache[id];
    const entry = (C.standings || []).find(function(s){ return s.id === id; });
    const v = _npcClubStrength(entry);
    strCache[id] = v;
    return v;
  }

  let count = 0;
  due.forEach(function(f){
    const res = _simNpcFixtureResult(strOf(f.home), strOf(f.away));
    f.played = true;
    f.sh = res.sh;
    f.sa = res.sa;
    f.autoSim = true; // marqueur : match résolu automatiquement en fond
    _applyNpcStanding(f.home, res.sh, res.sa);
    _applyNpcStanding(f.away, res.sa, res.sh);
    count++;
  });

  return count;
}

// Wrapper sûr appelé depuis les points d'avancement du calendrier.
// Ne lève jamais : une erreur de simulation ne doit pas bloquer la carrière.
function _runBackgroundNpcSim(){
  try {
    const n = _simulateBackgroundNpcFixtures();
    return n;
  } catch(e){
    console.error('background npc sim:', e);
    return 0;
  }
}

// Rend disponibles globalement (chargé après save.js ; ces fonctions y sont
// appelées via des hooks ajoutés dans save.js / ui.js).
if(typeof window !== 'undefined'){
  window._npcClubStrength = _npcClubStrength;
  window._simulateBackgroundNpcFixtures = _simulateBackgroundNpcFixtures;
  window._runBackgroundNpcSim = _runBackgroundNpcSim;
}
