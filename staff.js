'use strict';
// ══════════════════════════════════════════════════════════════════════
//  STAFF.JS — Organigramme & staff de club en carrière Dirigeant
//
//  Ce module est ADDITIF et défensif : si careerV2 / le club n'existe pas,
//  toutes les fonctions renvoient des valeurs neutres (multiplicateurs à 1,
//  bonus à 0) et le jeu se comporte exactement comme avant.
//
//  Un club a un ORGANIGRAMME regroupé en départements, chaque poste ayant
//  un effet CONCRET sur la carrière. Chaque membre : { name, rating(1..5),
//  tier, wage }. Le rating pilote la force de l'effet ; les salaires
//  s'ajoutent aux coûts hebdomadaires (voir _weeklyCareerCosts).
//
//  DÉPARTEMENTS & POSTES
//  ─ Direction sportive
//      • manager (🧑)          moral/cohésion les jours de match + réputation
//      • assistant (🤝)        seconde le manager : bonus tactique de match
//  ─ Encadrement technique (entraîneurs par spécialité)
//      • coach_phys (🏃)       booste les séances PHYSIQUES
//      • coach_tech (🎯)       booste les séances TECHNIQUES
//      • coach_gk (🧤)         booste les séances de GARDIEN
//      • coach_setp (🎯🥅)     booste les coups de pied arrêtés (marqués + concédés)
//  ─ Analyse & recrutement
//      • analyst (🎥)          analyste vidéo : lit l'adversaire (bonus 1re mi-temps)
//      • scout (🔭)            meilleurs agents libres + chance de pépite
//      • data (📊)             analyste data : révèle mieux les potentiels (scouting)
//  ─ Performance & médical
//      • physio (🏥)           réduit les blessures + accélère la guérison
//      • fitness (💪)          préparateur physique : récupération de forme
//      • psycho (🧠)           préparateur mental : stabilise le moral
// ══════════════════════════════════════════════════════════════════════

const STAFF = (function(){

  // ── Départements (ordre d'affichage) ───────────────────────────────
  const DEPARTMENTS = [
    { key:'direction', label:'Direction sportive', icon:'🧑‍💼', roles:['manager','assistant'] },
    { key:'technique', label:'Encadrement technique', icon:'📋', roles:['coach_phys','coach_tech','coach_gk','coach_setp'] },
    { key:'lignes',    label:'Entraîneurs par ligne', icon:'📐', roles:['coach_att','coach_mid','coach_def'] },
    { key:'analyse',   label:'Analyse & recrutement', icon:'🔍', roles:['analyst','scout','data'] },
    { key:'perf',      label:'Performance & médical', icon:'🏥', roles:['physio','fitness','psycho'] },
  ];

  // ── Définition des postes ──────────────────────────────────────────
  const ROLES = {
    manager:    { key:'manager',    label:'Manager',              icon:'🧑',   desc:'Motive le vestiaire les jours de match (moral + cohésion) et pèse sur la réputation du club.' },
    assistant:  { key:'assistant',  label:'Entraîneur adjoint',   icon:'🤝',   desc:'Seconde le manager : petit bonus de cohésion de match et soutient la mise en place tactique.' },
    coach_phys: { key:'coach_phys', label:'Entraîneur physique',  icon:'🏃',   desc:'Spécialiste athlétique : accélère la progression lors des séances physiques (vitesse, endurance, puissance).' },
    coach_tech: { key:'coach_tech', label:'Entraîneur technique', icon:'🎯',   desc:'Travaille le geste : accélère la progression lors des séances techniques (passe, contrôle, finition, dribble).' },
    coach_gk:   { key:'coach_gk',   label:'Entraîneur des gardiens', icon:'🧤',desc:'Spécialiste du poste : accélère la progression des gardiens (réflexes, sorties, jeu au pied).' },
    coach_setp: { key:'coach_setp', label:'Coach coups de pied arrêtés', icon:'🥅', desc:'Travaille les phases arrêtées : améliore vos corners/coups francs et réduit ceux concédés.' },
    coach_att:  { key:'coach_att',  label:'Entraîneur des attaquants', icon:'⚔️', desc:'Spécialiste offensif : accélère la progression de vos attaquants et milieux offensifs.' },
    coach_mid:  { key:'coach_mid',  label:'Entraîneur des milieux',    icon:'🎩', desc:'Travaille l\'entrejeu : accélère la progression de vos milieux.' },
    coach_def:  { key:'coach_def',  label:'Entraîneur des défenseurs', icon:'🛡️', desc:'Spécialiste défensif : accélère la progression de vos défenseurs.' },
    analyst:    { key:'analyst',    label:'Analyste vidéo',       icon:'🎥',   desc:'Décortique l\'adversaire avant le match : vos joueurs démarrent plus concentrés (bonus de première mi-temps).' },
    scout:      { key:'scout',      label:'Recruteur',            icon:'🔭',   desc:'Déniche de meilleurs agents libres et augmente les chances de découvrir une pépite.' },
    data:       { key:'data',       label:'Analyste data',        icon:'📊',   desc:'Modélise les profils : révèle plus fidèlement le potentiel des recrues et jeunes repérés.' },
    physio:     { key:'physio',     label:'Kiné',                 icon:'🏥',   desc:'Réduit le risque de blessure à l\'entraînement et raccourcit les convalescences.' },
    fitness:    { key:'fitness',    label:'Préparateur physique', icon:'💪',   desc:'Optimise la charge : les joueurs récupèrent mieux leur forme entre les matchs.' },
    psycho:     { key:'psycho',     label:'Préparateur mental',   icon:'🧠',   desc:'Stabilise le vestiaire : limite les chutes de moral et soutient la cohésion sur la durée.' },
  };
  // Ordre à plat (dérivé des départements) pour les itérations globales.
  const ROLE_ORDER = DEPARTMENTS.reduce(function(acc,d){ return acc.concat(d.roles); }, []);

  // ── Paliers de qualité (rating) ────────────────────────────────────
  const TIERS = [
    { rating:1, label:'Débutant',   colorHi:'#8d99a6', wageMul:0.25 },
    { rating:2, label:'Correct',    colorHi:'#4caf82', wageMul:0.55 },
    { rating:3, label:'Confirmé',   colorHi:'#2f9e6e', wageMul:1.00 },
    { rating:4, label:'Expert',     colorHi:'#f0c028', wageMul:1.90 },
    { rating:5, label:'Renommée',   colorHi:'#e05aa8', wageMul:3.40 },
  ];
  function tierOf(rating){ return TIERS.find(function(t){ return t.rating===rating; }) || TIERS[2]; }

  // Coût hebdo de référence par niveau de club (avant wageMul du tier).
  const LEVEL_WAGE_BASE = {
    'dh_4':6, 'dh_3':8, 'dh_2':10, 'dh_1':14, dh:10,
    r3:30, r2:70, r1:170, d3:600, d2:1600, d1:5000,
  };
  function levelWageBase(level){ return LEVEL_WAGE_BASE[level] || LEVEL_WAGE_BASE.dh; }

  function hireFee(level, rating){
    return Math.round(levelWageBase(level) * tierOf(rating).wageMul * 6);
  }
  function weeklyWage(level, rating){
    return Math.round(levelWageBase(level) * tierOf(rating).wageMul);
  }

  // ── Générateur de noms de staff (neutre, par région si dispo) ───────
  const FALLBACK_NAMES = [
    'Diarra','Moreau','Okafor','Bianchi','Sørensen','Haddad','Ferreira','Novak',
    'Kovač','Andersson','Delacroix','Rossi','Petrov','Nakamura','Silva','Dubois',
    'Weiss','Marchetti','Costa','Björk','Lefevre','Adeyemi','Romano','Larsson',
  ];
  function randName(nation, region){
    try{
      if(typeof WORLDS!=='undefined' && WORLDS.getRegion){
        const r = WORLDS.getRegion(nation, region);
        if(r && r.names && r.names.length){
          return r.names[Math.floor(Math.random()*r.names.length)];
        }
      }
    }catch(e){}
    return FALLBACK_NAMES[Math.floor(Math.random()*FALLBACK_NAMES.length)];
  }

  function makeMember(role, rating, nation, region){
    return { role:role, name:randName(nation,region), rating:rating, tier:tierOf(rating).label };
  }

  // Rating max atteignable selon le niveau du club.
  const CAP_BY_LEVEL = {
    'dh_4':2,'dh_3':2,'dh_2':3,'dh_1':3, dh:3,
    r3:3, r2:4, r1:4, d3:4, d2:5, d1:5,
  };
  function levelCap(level){ return CAP_BY_LEVEL[level] || 3; }

  // ── Pool de candidats disponibles à l'embauche pour un poste ────────
  function candidatesFor(club, role){
    const level = (club && club.level) || 'dh';
    const nation = (typeof careerV2!=='undefined' && careerV2 && careerV2.nation) || 'panthalassa';
    const region = (club && club.region);
    const cap = levelCap(level);
    const lo = Math.max(1, cap-2);
    const ratings = [lo, Math.min(cap, lo+1), cap];
    return ratings.map(function(r){
      const m = makeMember(role, r, nation, region);
      m.hireFee = hireFee(level, r);
      m.wage = weeklyWage(level, r);
      return m;
    });
  }

  // ── Lecture défensive du rating d'un poste (0 si vacant) ────────────
  function rating(club, role){
    const s = club && club.staff && club.staff[role];
    return (s && typeof s.rating==='number') ? s.rating : 0;
  }

  // ── Total des salaires hebdomadaires du staff ───────────────────────
  function weeklyWages(club){
    if(!club || !club.staff) return 0;
    const level = club.level || 'dh';
    let total = 0;
    ROLE_ORDER.forEach(function(role){
      const s = club.staff[role];
      if(s && typeof s.rating==='number'){
        total += (typeof s.wage==='number') ? s.wage : weeklyWage(level, s.rating);
      }
    });
    return Math.round(total);
  }

  // Nombre de postes pourvus / total (pour l'affichage synthèse).
  function filledCount(club){
    if(!club || !club.staff) return 0;
    return ROLE_ORDER.filter(function(role){ return club.staff[role]; }).length;
  }

  // ══════════════════════════════════════════════════════════════════
  //  EFFETS GAMEPLAY (lus par training.js, save.js, ui.js, ia.js)
  // ══════════════════════════════════════════════════════════════════

  // Coach adjoint retiré du calcul entraînement : la progression dépend
  // désormais des entraîneurs SPÉCIALISÉS selon la famille de séance.
  const FAMILY_COACH = {
    physique: 'coach_phys',
    technique:'coach_tech',
    gardien:  'coach_gk',
    tactique: 'assistant',   // l'adjoint encadre le travail tactique collectif
  };

  // Qualité d'entraînement globale (base) : petit apport de l'adjoint qui
  // supervise l'ensemble. S'applique à TOUTES les séances.
  function trainingQualityMul(club){
    return 1 + rating(club,'assistant') * 0.04;
  }
  // Bonus SPÉCIFIQUE à la famille de séance (entraîneur spécialisé).
  function familyTrainingMul(club, family){
    const role = FAMILY_COACH[family];
    if(!role) return 1;
    return 1 + rating(club, role) * 0.10;
  }

  // ── Entraîneurs par LIGNE ────────────────────────────────────────────
  // À la différence des coachs par TYPE de séance (physique/technique), ces
  // coachs font progresser les joueurs de LEUR ligne, quel que soit le type
  // de séance. Un joueur bien encadré des deux côtés (bon coach technique ET
  // bon coach de sa ligne) progresse nettement plus vite.
  function _lineOf(pos){
    if(['ATT','MO','MOG','MOD','BU','AV'].indexOf(pos) >= 0) return 'att';
    if(['MC','MDC','MOC','MG','MD','MIL'].indexOf(pos) >= 0) return 'mid';
    if(['DC','DD','DG','DEF','LAT'].indexOf(pos) >= 0)       return 'def';
    return null; // gardiens : couverts par coach_gk
  }
  // Multiplicateur de progression pour UN joueur, selon sa ligne.
  function lineTrainingMul(club, player){
    if(!player) return 1;
    const line = _lineOf(player.pos);
    if(!line) return 1;
    const role = { att:'coach_att', mid:'coach_mid', def:'coach_def' }[line];
    return 1 + rating(club, role) * 0.09;
  }

  // Kiné : multiplicateur de risque de blessure (1..0.45) — plus bas = mieux.
  function injuryRiskMul(club){
    return Math.max(0.4, 1 - rating(club,'physio') * 0.11);
  }
  // Kiné : jours de convalescence gagnés par semaine.
  function healBonus(club){
    return rating(club,'physio') >= 3 ? 1 : 0;
  }
  // Préparateur physique : bonus de récupération de forme (_fm) par repos.
  function fitnessRecovery(club){
    return rating(club,'fitness') * 0.10;
  }

  // Recruteur : décalage de qualité appliqué aux agents libres générés.
  function freeAgentBoost(club){
    return rating(club,'scout') * 2;
  }
  // Recruteur : multiplicateur de chance de découvrir une pépite.
  function gemChanceMul(club){
    const r = rating(club,'scout');
    return r > 0 ? 1 + r * 0.5 : 1;
  }
  // Analyste data : fiabilité de lecture du potentiel (0..1) — pour l'UI scouting.
  function dataInsight(club){
    return Math.min(1, rating(club,'data') * 0.20);
  }

  // Manager + adjoint : bonus de moral/cohésion appliqué les jours de match.
  function matchMoraleBonus(club){
    return rating(club,'manager') * 0.4 + rating(club,'psycho') * 0.15;
  }
  function matchCohesionBonus(club){
    return rating(club,'manager') * 1.5 + rating(club,'assistant') * 0.8;
  }
  // Analyste vidéo : bonus de "concentration" en début de match (1re mi-temps).
  // Renvoie un petit boost de forme temporaire appliqué au coup d'envoi.
  function analystMatchBonus(club){
    return rating(club,'analyst') * 0.5;
  }
  // Coach coups de pied arrêtés : multiplicateur d'efficacité offensive sur
  // phases arrêtées (>1) et défensive sur celles concédées (<1).
  function setPieceAttackMul(club){
    return 1 + rating(club,'coach_setp') * 0.06;
  }
  function setPieceDefenseMul(club){
    return Math.max(0.7, 1 - rating(club,'coach_setp') * 0.05);
  }
  // Manager : bonus de réputation par saison bien menée.
  function reputationBonus(club){
    return rating(club,'manager') * 0.5;
  }
  // Préparateur mental : atténue les chutes de moral (facteur multiplicatif
  // appliqué aux pertes de moral, 1..0.6).
  function moraleDropMul(club){
    return Math.max(0.55, 1 - rating(club,'psycho') * 0.09);
  }

  // ── Init/migration : garantit un objet staff cohérent sur le club ───
  // Migre AUSSI l'ancien schéma (manager/coach/scout/physio) vers le nouveau.
  function ensureStaff(club){
    if(!club) return;
    if(!club.staff || typeof club.staff!=='object') club.staff = {};
    const level = club.level || 'dh';
    const st = club.staff;

    // ── Migration depuis l'ancien schéma à 4 postes ──────────────────
    // Ancien 'coach' (adjoint générique) → 'assistant'. Les entraîneurs
    // spécialisés héritent du niveau de l'ancien 'coach' pour ne pas
    // dévaloriser une save existante.
    if(st.coach !== undefined && st.assistant === undefined){
      const legacy = st.coach;
      let lr = 3, lname = null;
      if(legacy && typeof legacy==='object'){ lr = (typeof legacy.rating==='number')?legacy.rating:3; lname = legacy.name; }
      else if(typeof legacy==='string'){ lname = legacy; }
      st.assistant  = legacy ? { role:'assistant',  name:lname||randName(null,club.region), rating:lr } : null;
      st.coach_phys = legacy ? { role:'coach_phys', name:randName(null,club.region), rating:Math.max(1,lr-1) } : null;
      st.coach_tech = legacy ? { role:'coach_tech', name:randName(null,club.region), rating:Math.max(1,lr-1) } : null;
      st.coach_gk   = legacy ? { role:'coach_gk',   name:randName(null,club.region), rating:Math.max(1,lr-1) } : null;
      delete st.coach;
    }

    // Normalise chaque poste connu.
    ROLE_ORDER.forEach(function(role){
      const s = st[role];
      if(s === undefined || s === null){ st[role] = st[role]===undefined ? null : s; return; }
      if(typeof s === 'string'){
        st[role] = { role:role, name:s, rating:3, tier:tierOf(3).label, wage:weeklyWage(level,3) };
        return;
      }
      if(typeof s.rating!=='number') s.rating = 3;
      if(!s.role) s.role = role;
      s.tier = tierOf(s.rating).label;
      if(typeof s.wage!=='number') s.wage = weeklyWage(level, s.rating);
      if(!s.name) s.name = randName((typeof careerV2!=='undefined'&&careerV2&&careerV2.nation)||'panthalassa', club.region);
    });

    // Garantit que tous les postes existent au moins en clé (vacants = null).
    ROLE_ORDER.forEach(function(role){ if(st[role]===undefined) st[role]=null; });
  }

  // Effectif de staff par défaut à la création d'un club "avec staff".
  // On ne remplit pas TOUT (un club amateur promu n'a pas 11 employés) :
  // les postes clés sont pourvus, le reste est à recruter par le joueur.
  function defaultStaff(level, nation, region){
    const cap = levelCap(level);
    const base = Math.max(2, cap-1);
    function mk(role, r){ const m = makeMember(role, Math.min(cap, r), nation, region); m.wage = weeklyWage(level, m.rating); return m; }
    return {
      manager:    mk('manager',    base),
      assistant:  mk('assistant',  base),
      coach_phys: mk('coach_phys', base),
      coach_tech: mk('coach_tech', base),
      coach_gk:   mk('coach_gk',   Math.max(1,base-1)),
      coach_setp: null,
      analyst:    (cap>=3) ? mk('analyst', base) : null,
      scout:      mk('scout',      base),
      data:       null,
      physio:     mk('physio',     base),
      fitness:    (cap>=3) ? mk('fitness', Math.max(1,base-1)) : null,
      psycho:     null,
    };
  }

  return {
    DEPARTMENTS: DEPARTMENTS, ROLES: ROLES, ROLE_ORDER: ROLE_ORDER, TIERS: TIERS,
    tierOf: tierOf, hireFee: hireFee, weeklyWage: weeklyWage, levelCap: levelCap,
    candidatesFor: candidatesFor, makeMember: makeMember, defaultStaff: defaultStaff,
    rating: rating, weeklyWages: weeklyWages, filledCount: filledCount, ensureStaff: ensureStaff,
    trainingQualityMul: trainingQualityMul, familyTrainingMul: familyTrainingMul,
    lineTrainingMul: lineTrainingMul,
    injuryRiskMul: injuryRiskMul, healBonus: healBonus, fitnessRecovery: fitnessRecovery,
    freeAgentBoost: freeAgentBoost, gemChanceMul: gemChanceMul, dataInsight: dataInsight,
    matchMoraleBonus: matchMoraleBonus, matchCohesionBonus: matchCohesionBonus,
    analystMatchBonus: analystMatchBonus,
    setPieceAttackMul: setPieceAttackMul, setPieceDefenseMul: setPieceDefenseMul,
    reputationBonus: reputationBonus, moraleDropMul: moraleDropMul,
  };
})();

if(typeof window!=='undefined') window.STAFF = STAFF;
