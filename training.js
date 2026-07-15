// ═══════════════════════════════════════════════════════════════════════════
//  TRAINING.JS — Système d'entraînement générique, modulaire et piloté par les
//  données (inspiré de Football Manager).
//  ─────────────────────────────────────────────────────────────────────────
//  Objectifs :
//   • Statut de club (amateur / semi-pro / professionnel) → nombre de séances.
//   • Limite hebdo influencée par infrastructures, staff, calendrier, fatigue.
//   • Planning hebdomadaire réel (Lun→Dim) avec familles de séances.
//   • Génération automatique du planning par l'IA, biaisée par le style du coach.
//   • Impact concret : progression d'attributs, fatigue, moral, cohésion,
//     forme, risque de blessure — avec « une bonne séance vaut deux mauvaises ».
//   • AUCUNE valeur codée en dur dans le moteur : tout vient de TRAINING_CONFIG.
//   • Compatibilité totale avec les sauvegardes existantes (migration auto).
//
//  Ce fichier n'écrase RIEN : il expose un objet global `TRAINING` + une
//  config globale `TRAINING_CONFIG`. L'intégration dans le moteur de carrière
//  se fait via quelques points d'accroche minimalistes (voir save.js/ui.js).
// ═══════════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────────
//  CONFIGURATION — 100 % modifiable, aucune valeur en dur ailleurs.
// ───────────────────────────────────────────────────────────────────────────
const TRAINING_CONFIG = {
  // Version de schéma, sert à la migration des sauvegardes.
  version: 1,

  // ── Statuts & bornes de séances hebdomadaires ────────────────────────────
  status: {
    amateur:            { label: 'Amateur',            minSessions: 1, maxSessions: 3, doubleDays: 0 },
    semiProfessional:   { label: 'Semi-professionnel', minSessions: 3, maxSessions: 5, doubleDays: 1 },
    professional:       { label: 'Professionnel',      minSessions: 5, maxSessions: 6, doubleDays: 2 },
  },

  // Correspondance niveau moteur (d1..dh) → statut de club.
  // Sert UNIQUEMENT à la migration / au défaut : club.status prime toujours.
  levelToStatus: {
    d1: 'professional', d2: 'professional', d3: 'professional',
    r1: 'semiProfessional', r2: 'semiProfessional',
    r3: 'amateur', dh: 'amateur',
  },

  // ── Modulateurs de la limite de séances ──────────────────────────────────
  // La limite = base statut, bornée par [min,max], + somme des modificateurs.
  modifiers: {
    // Bonus si le centre d'entraînement est excellent (infra.training).
    trainingCentre: { attr: 'training', thresholds: [ {gte:4, delta:+1}, {gte:2, delta:0}, {gte:0, delta:-0} ] },
    // Nombre de terrains — approximé via infra.formation (terrains/structures).
    pitches:        { attr: 'formation', thresholds: [ {gte:4, delta:+1}, {gte:1, delta:0} ] },
    // Encadrement médical/physio de qualité autorise une charge un peu plus haute.
    medical:        { attr: 'medical', thresholds: [ {gte:4, delta:+1}, {gte:0, delta:0} ] },
    // Calendrier chargé : match dans la semaine → -1 séance possible.
    congestedFixtures: { delta: -1 },
    // Effectif fatigué : forme moyenne très basse → -1 séance possible.
    squadFatigue:      { delta: -1, avgFormBelow: -3 },
  },

  // ── Familles & types de séances ──────────────────────────────────────────
  // Chaque séance porte : durée (min), intensité (0-1), fatigue générée,
  // progression (attributs ciblés + facteur), risque de blessure de base.
  families: {
    physique: {
      label: 'Physique', icon: '💪', color: '#e0603c',
      sessions: {
        endurance: { label: 'Endurance', dur: 90, intensity: .70, fatigue: 7, attrs: ['stam','res'], gain: 1.0, injury: .010 },
        vitesse:   { label: 'Vitesse',   dur: 60, intensity: .85, fatigue: 8, attrs: ['spd'],         gain: 1.1, injury: .016 },
        puissance: { label: 'Puissance', dur: 75, intensity: .80, fatigue: 8, attrs: ['stam','def'],  gain: 1.0, injury: .014 },
      },
    },
    technique: {
      label: 'Technique', icon: '🎯', color: '#f0c028',
      sessions: {
        passe:    { label: 'Passe',     dur: 75, intensity: .50, fatigue: 4, attrs: ['pas','tec'], gain: 1.1, injury: .004 },
        controle: { label: 'Contrôle',  dur: 75, intensity: .50, fatigue: 4, attrs: ['tec'],       gain: 1.1, injury: .004 },
        finition: { label: 'Finition',  dur: 70, intensity: .55, fatigue: 4, attrs: ['sht'],       gain: 1.2, injury: .005 },
        centres:  { label: 'Centres',   dur: 70, intensity: .50, fatigue: 4, attrs: ['pas','sht'], gain: 1.0, injury: .004 },
        dribbles: { label: 'Dribbles',  dur: 70, intensity: .55, fatigue: 5, attrs: ['tec','spd'], gain: 1.1, injury: .006 },
      },
    },
    tactique: {
      label: 'Tactique', icon: '🧠', color: '#00bcd4',
      sessions: {
        pressing:    { label: 'Pressing',        dur: 80, intensity: .65, fatigue: 6, attrs: ['def','stam'], gain: .9, injury: .008, cohesion: .6 },
        possession:  { label: 'Possession',      dur: 80, intensity: .45, fatigue: 4, attrs: ['pas','tec'],  gain: .9, injury: .004, cohesion: .8 },
        transitions: { label: 'Transitions',     dur: 75, intensity: .60, fatigue: 5, attrs: ['spd','pas'],  gain: .8, injury: .006, cohesion: .6 },
        bloc:        { label: 'Bloc défensif',   dur: 75, intensity: .55, fatigue: 5, attrs: ['def'],        gain: .9, injury: .006, cohesion: .7 },
        cpa:         { label: 'Coups de pied arrêtés', dur: 45, intensity: .40, fatigue: 3, attrs: ['sht','def'], gain: .8, injury: .003, cohesion: .5 },
      },
    },
    gardien: {
      label: 'Gardien', icon: '🧤', color: '#9c27b0',
      goalkeeperOnly: true,
      sessions: {
        reflexes:  { label: 'Réflexes',   dur: 60, intensity: .60, fatigue: 5, attrs: ['def','spd'], gain: 1.2, injury: .006 },
        sorties:   { label: 'Sorties',    dur: 55, intensity: .55, fatigue: 5, attrs: ['def'],        gain: 1.1, injury: .006 },
        jeuAuPied: { label: 'Jeu au pied',dur: 50, intensity: .45, fatigue: 3, attrs: ['pas','tec'],  gain: 1.1, injury: .003 },
      },
    },
    mental: {
      label: 'Mental', icon: '🧘', color: '#3f8cff',
      sessions: {
        cohesion:      { label: 'Cohésion',      dur: 45, intensity: .30, fatigue: 2, attrs: ['res'], gain: .5, injury: .001, cohesion: 1.4, morale: .6 },
        concentration: { label: 'Concentration', dur: 40, intensity: .30, fatigue: 2, attrs: ['res'], gain: .6, injury: .001, morale: .3 },
        leadership:    { label: 'Leadership',    dur: 40, intensity: .30, fatigue: 2, attrs: ['res'], gain: .6, injury: .001, cohesion: .8, morale: .4 },
      },
    },
    recuperation: {
      label: 'Récupération', icon: '🩹', color: '#18c860',
      recovery: true,
      sessions: {
        soins:       { label: 'Soins',       dur: 30, intensity: .10, fatigue: -6, attrs: [], gain: 0, injury: 0, heal: 2 },
        cryotherapie:{ label: 'Cryothérapie',dur: 20, intensity: .05, fatigue: -8, attrs: [], gain: 0, injury: 0, heal: 2 },
        massages:    { label: 'Massages',    dur: 30, intensity: .05, fatigue: -6, attrs: [], gain: 0, injury: 0, heal: 1, morale: .2 },
        repos:       { label: 'Repos actif', dur: 0,  intensity: .00, fatigue: -5, attrs: [], gain: 0, injury: 0, heal: 1 },
      },
    },
    magie: {
      label: 'Magie', icon: '✨', color: '#8840e0',
      // Séances magiques : nécessitent le bâtiment `magic` (Tour de Magie).
      // Elles n'améliorent PAS de nouveaux sorts en priorité : elles montent la
      // PRÉCISION des sorts équipés (_spellPrec) et les stats liées à la magie
      // (mp max, régénération de mana), avec une faible chance d'apprendre un
      // nouveau sort si la Tour est de haut niveau.
      requiresBuilding: 'magic',
      sessions: {
        precision: { label: 'Précision des sorts', dur: 60, intensity: .40, fatigue: 4, attrs: [], gain: 0, injury: .003, magic:{ precision: 0.020, manaMax: 0.6 } },
        canalisation:{ label: 'Canalisation (mana)', dur: 55, intensity: .35, fatigue: 4, attrs: [], gain: 0, injury: .002, magic:{ manaMax: 1.4, manaRegen: 0.04 } },
        rituel:    { label: 'Rituel (nouveau sort)', dur: 70, intensity: .45, fatigue: 5, attrs: ['tec'], gain: .4, injury: .004, magic:{ precision: 0.006, learnSpell: true } },
      },
    },
    social: {
      label: 'Vie de groupe', icon: '🍻', color: '#ff80ab',
      // Activités extra-sportives : agissent sur cohésion + moral, jamais sur
      // les attributs. Certaines coûtent une journée / génèrent un risque.
      social: true,
      sessions: {
        repas:   { label: "Repas d'équipe",  dur: 120, intensity: .05, fatigue: 1,  attrs: [], gain: 0, injury: 0,    cohesion: 3.0, morale: 1.0, tier:'safe' },
        sortie:  { label: 'Sortie entre potes', dur: 240, intensity: .10, fatigue: 3, attrs: [], gain: 0, injury: 0,  cohesion: 6.0, morale: 2.0, tier:'day' },
        soiree:  { label: 'Soirée arrosée',   dur: 360, intensity: .15, fatigue: 6,  attrs: [], gain: 0, injury: .05, cohesion: 8.0, morale: 3.0, tier:'risky' },
      },
    },
  },

  // ── Journée du planning : types de contenu possibles ─────────────────────
  dayTypes: {
    training:   { label: 'Entraînement',      icon: '🏃' },
    recovery:   { label: 'Récupération',      icon: '🩹' },
    rest:       { label: 'Repos',             icon: '😴' },
    video:      { label: 'Vidéo',             icon: '📹', analysis: true },
    matchprep:  { label: 'Mise en place',     icon: '📋', prep: true },
    match:      { label: 'Match',             icon: '⚽' },
    social:     { label: 'Vie de groupe',     icon: '🍻', social: true },
    magie:      { label: 'Magie',             icon: '✨' },
  },

  // ── Créneaux (slots) façon Football Manager ──────────────────────────────
  // Chaque journée offre jusqu'à 3 créneaux : matin / après-midi / soir.
  // Le nombre réellement utilisable dépend du statut (amateur = surtout le soir,
  // pro = jusqu'à 3, doubles séances incluses). RÈGLE : tout créneau
  // d'ENTRAÎNEMENT rempli compte pour 1 séance dans le plafond hebdo du statut.
  slots: {
    order: ['morning','afternoon','evening'],
    labels: { morning:'Matin', afternoon:'Après-midi', evening:'Soir' },
    icons:  { morning:'🌅', afternoon:'☀️', evening:'🌙' },
    // Créneaux ouverts par statut (les autres sont grisés dans l'UI).
    byStatus: {
      amateur:          { morning:false, afternoon:false, evening:true  },
      semiProfessional: { morning:false, afternoon:true,  evening:true  },
      professional:     { morning:true,  afternoon:true,  evening:true  },
    },
    // Types de journée qui NE consomment PAS le plafond de séances d'effort.
    freeTypes: ['recovery','rest','video','matchprep','social'],
  },

  // ── Bâtiment lié à la magie (Tour de Magie) ──────────────────────────────
  // Débloque et améliore les séances magiques. Stocké dans club.infra.magic.
  magicBuilding: {
    key: 'magic', name: 'Tour de Magie', icon: '🔮', maxLevel: 5,
    // Niveau requis pour débloquer les séances magiques.
    unlockLevel: 1,
    // Coût de construction/amélioration par niveau (réutilise le système infra).
    baseCost: [0, 12000, 28000, 60000, 120000, 220000],
    buildWeeks: [0, 3, 4, 5, 6, 8],
    // Bonus de qualité magique par niveau (multiplie les gains de précision/mana).
    qualityPerLevel: 0.18,
    // Chance d'apprendre un nouveau sort au « Rituel » = base × niveau bâtiment.
    learnSpellChancePerLevel: 0.010,
  },

  // ── Progression : « une excellente séance vaut mieux que deux mauvaises » ─
  progression: {
    // Multiplicateur de gain selon la qualité de la séance (0-1).
    // La qualité dépend du centre, du staff, de la fraîcheur du joueur.
    qualityCurve: { poor: 0.35, ok: 0.7, good: 1.0, excellent: 1.5 },
    // Un joueur épuisé progresse mal et se blesse plus.
    fatiguePenaltyForm: -4,   // en-dessous de cette forme, gains réduits
    fatiguePenaltyMult: 0.45, // multiplicateur appliqué alors
    // Chance de base d'un +1 permanent d'attribut par séance ciblée.
    tickBaseChance: 0.055,
    // Les jeunes progressent davantage (bonus multiplicatif par jeunesse).
    youthAgeThreshold: 23,
    youthMult: 1.8,
    // Potentiel : au-delà du potentiel, la progression est fortement freinée.
    nearPotentialSlow: 0.25,
    // Le potentiel est un plafond SOUPLE, pas un mur (façon FIFA/PES) :
    // chaque point gagné au-delà du talent coûte ~35% plus cher que le
    // précédent (0.65^n), donc le coût explose vite.
    // Calibré (mesuré, ~120 séances ciblées/saison) :
    //   sans focus → +3 en ~3.6 saisons, +6 irréaliste (~15 ans) : le talent domine
    //   avec focus → +3 en ~0.3 saison, +6 en ~1.3, +10 en ~7.5 : le travail paie
    // Ainsi personne ne converge vers 99 : dépasser son don reste un choix coûteux.
    overPotentialDecay: 0.65,
    // Un focus individuel multiplie la chance de dépasser le talent : c'est
    // le « gros focus » qui permet de forcer un attribut au-delà du don naturel.
    overPotentialFocusMul: 4,
    // Bonus de qualité apporté par le niveau du centre d'entraînement.
    centreQualityPerLevel: 0.10,
    // Bonus de qualité apporté par le staff (nombre de préparateurs / coach).
    staffQualityPerRating: 0.05,
  },

  // ── Fatigue & forme ──────────────────────────────────────────────────────
  fatigue: {
    // Conversion fatigue générée → perte de forme (_fm, échelle -10..+10).
    perPoint: 0.10,
    formMin: -10, formMax: 10,
    // Récupération passive de forme un jour sans séance.
    passiveRecovery: 0.3,
    // Érosion passive de la cohésion un jour de repos (le groupe se délite
    // légèrement sans travail collectif ni vie de groupe). Garde la cohésion
    // dynamique et donne un intérêt durable aux sorties entre potes.
    cohesionDecay: 0.8,
  },

  // ── Styles de coach : biais de contenu pour l'IA ────────────────────────
  // Poids relatifs par famille. L'IA tire ses séances selon ces poids.
  coachStyles: {
    equilibre:  { label: 'Équilibré',  weights: { physique:1.0, technique:1.0, tactique:1.0, mental:0.6, recuperation:0.8, magie:0.6, social:0.4 } },
    physique:   { label: 'Physique',   weights: { physique:1.8, technique:0.8, tactique:0.8, mental:0.5, recuperation:0.9, magie:0.4, social:0.4 } },
    tacticien:  { label: 'Tacticien',  weights: { physique:0.7, technique:0.9, tactique:1.9, mental:0.7, recuperation:0.9, magie:0.5, social:0.4 } },
    technique:  { label: 'Technicien', weights: { physique:0.7, technique:1.9, tactique:0.9, mental:0.6, recuperation:0.8, magie:0.6, social:0.4 } },
    formateur:  { label: 'Formateur',  weights: { physique:0.9, technique:1.4, tactique:0.9, mental:1.0, recuperation:1.0, magie:0.7, social:0.6 } },
    mage:       { label: 'Mage',       weights: { physique:0.6, technique:0.9, tactique:0.8, mental:0.7, recuperation:0.9, magie:2.0, social:0.5 } },
  },

  // ── Modèles de planning hebdo par statut (généré par l'IA / défaut joueur) ─
  // Chaque entrée = type de journée. 'auto' = l'IA choisit une famille selon le
  // style du coach. La position d'un éventuel match écrase la journée.
  weekTemplates: {
    amateur:          ['rest','auto','rest','auto','rest','match','rest'],
    semiProfessional: ['recovery','auto','rest','auto','matchprep','match','rest'],
    professional:     ['recovery','auto','auto','auto','matchprep','match','rest'],
  },
};

// Jours de la semaine (Lundi=0 … Dimanche=6), cohérent avec _dayOfWeek du moteur.
const TRAINING_DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];

// ───────────────────────────────────────────────────────────────────────────
//  MOTEUR — API publique TRAINING.*
// ───────────────────────────────────────────────────────────────────────────
const TRAINING = (function(){
  const CFG = () => (typeof TRAINING_CONFIG !== 'undefined' ? TRAINING_CONFIG : {});

  // Résout le statut effectif d'un club (priorité : club.status explicite).
  function clubStatus(club){
    const cfg = CFG();
    if(club && club.status && cfg.status[club.status]) return club.status;
    const lvl = club && club.level;
    // Priorité au statut défini dans la pyramide de la nation (ex : au Rorang,
    // la D1 est semi-pro et non pro). On lit WORLDS si disponible.
    try{
      if(club && club.nation && lvl && typeof WORLDS!=='undefined' && WORLDS.getPyramid){
        const tier = (WORLDS.getPyramid(club.nation)||[]).find(function(t){ return t.id===lvl; });
        if(tier && tier.status && cfg.status[tier.status]) return tier.status;
      }
    }catch(e){}
    return (cfg.levelToStatus && cfg.levelToStatus[lvl]) || 'amateur';
  }

  function statusConfig(club){ return CFG().status[clubStatus(club)] || CFG().status.amateur; }

  // Nombre max de séances autorisées cette semaine pour un club donné.
  // opts: { congested:Boolean, avgForm:Number }
  function maxSessions(club, opts){
    opts = opts || {};
    const cfg = CFG();
    const st = statusConfig(club);
    const infra = (club && club.infra) || {};
    const mods = cfg.modifiers || {};
    let n = st.maxSessions; // on part du plafond du statut

    // Modulateurs d'infrastructure (on prend le 1er seuil satisfait).
    ['trainingCentre','pitches','medical'].forEach(function(key){
      const m = mods[key]; if(!m || !m.thresholds) return;
      const v = infra[m.attr] || 0;
      for(const t of m.thresholds){ if(v >= t.gte){ n += (t.delta||0); break; } }
    });
    // Calendrier chargé.
    if(opts.congested && mods.congestedFixtures) n += (mods.congestedFixtures.delta||0);
    // Fatigue de l'effectif.
    if(mods.squadFatigue && opts.avgForm != null && opts.avgForm < mods.squadFatigue.avgFormBelow){
      n += (mods.squadFatigue.delta||0);
    }
    // Bornes dures du statut : impossible d'aller au-delà, ni sous le min.
    return Math.max(st.minSessions, Math.min(st.maxSessions, n));
  }

  function minSessions(club){ return statusConfig(club).minSessions; }

  // Toutes les séances à plat : { familyKey, key, ...def }.
  function allSessions(){
    const out = [];
    const fams = CFG().families || {};
    Object.keys(fams).forEach(function(fk){
      const sess = fams[fk].sessions || {};
      Object.keys(sess).forEach(function(sk){
        out.push(Object.assign({ family:fk, key:sk, familyLabel:fams[fk].label, familyIcon:fams[fk].icon, familyColor:fams[fk].color }, sess[sk]));
      });
    });
    return out;
  }
  function familySessions(familyKey){
    const fam = (CFG().families||{})[familyKey]; if(!fam) return [];
    return Object.keys(fam.sessions).map(function(sk){
      return Object.assign({ family:familyKey, key:sk }, fam.sessions[sk]);
    });
  }
  function getSession(familyKey, sessionKey){
    const fam = (CFG().families||{})[familyKey]; if(!fam) return null;
    const s = fam.sessions[sessionKey]; if(!s) return null;
    return Object.assign({ family:familyKey, key:sessionKey, familyLabel:fam.label, familyIcon:fam.icon, familyColor:fam.color }, s);
  }

  // ── Qualité d'une séance pour un joueur (0..1+) ─────────────────────────
  // Combine niveau du centre, staff, et fraîcheur du joueur.
  function sessionQuality(club, player, session){
    const p = CFG().progression || {};
    const infra = (club && club.infra) || {};
    let q = 0.6;
    q += (infra.training || 0) * (p.centreQualityPerLevel || 0);
    const staff = (club && club.staff) || {};
    const staffRating = ((staff.physio && staff.physio.rating) || 0);
    q += staffRating * (p.staffQualityPerRating || 0);
    // Encadrement technique (staff.js) : bonus global de l'adjoint + bonus
    // de l'entraîneur SPÉCIALISÉ correspondant à la famille de la séance.
    if(typeof STAFF!=='undefined'){
      q *= STAFF.trainingQualityMul(club);
      if(session && session.family) q *= STAFF.familyTrainingMul(club, session.family);
    }
    // Joueur trop fatigué → séance de moins bonne qualité pour lui.
    const fm = (player && player._fm) != null ? player._fm : 0;
    if(fm < (p.fatiguePenaltyForm || -4)) q *= (p.fatiguePenaltyMult || 0.5);
    return Math.max(0.1, Math.min(1.6, q));
  }

  // ── Appliquer UNE séance à un joueur ────────────────────────────────────
  // Renvoie un objet effet { progressed:[keys], injured:Bool, healed:Bool }.
  function applySessionToPlayer(club, player, session){
    if(!player || !session) return {};
    const P = CFG().progression || {};
    const F = CFG().fatigue || {};
    const eff = { progressed: [], injured:false, healed:false, learnedSpell:null };
    const isGK = _isGoalkeeper(player);
    const fam = (CFG().families||{})[session.family] || {};

    // Séance gardien réservée aux GB ; les autres n'en profitent pas.
    if(fam.goalkeeperOnly && !isGK) return eff;

    // ── Séance sociale (repas / sortie / soirée) ───────────────────────────
    // Agit sur cohésion + moral. Les paliers « risky » peuvent générer un
    // contrecoup façon FM (perte de forme, petite blessure) si l'effectif abuse.
    if(fam.social){
      if(session.cohesion) player._coh = _clamp((player._coh||0) + session.cohesion, 0, 100);
      if(session.morale)   player._hm  = _clamp((player._hm||0)  + session.morale, -10, 10);
      // Fatigue légère de la sortie.
      if(session.fatigue)  player._fm  = _clamp((player._fm||0)  - (session.fatigue||0)*(F.perPoint||0.1), F.formMin, F.formMax);
      // Contrecoup aléatoire pour les soirées arrosées.
      if(session.tier === 'risky' && session.injury && player.injLevel===0 && Math.random() < session.injury){
        player.injLevel = 1; player.injT = 1 + Math.floor(Math.random()*3);
        player._fm = _clamp((player._fm||0) - 1.5, F.formMin, F.formMax);
        eff.injured = true;
      }
      return eff;
    }

    // ── Séance magique (précision des sorts, mana, apprentissage) ──────────
    if(session.magic){
      const mb = CFG().magicBuilding || {};
      const lvl = (club && club.infra && club.infra[mb.key||'magic']) || 0;
      // Sans bâtiment débloqué, la séance n'a aucun effet magique.
      if(lvl < (mb.unlockLevel||1)) { return eff; }
      const magQ = 1 + lvl * (mb.qualityPerLevel||0.15);
      const m = session.magic;
      // Fatigue de la séance.
      player._fm = _clamp((player._fm||0) - (session.fatigue||0)*(F.perPoint||0.1), F.formMin, F.formMax);
      // Précision des sorts (multiplicateur de déclenchement en match).
      if(m.precision){ player._spellPrec = _clamp((player._spellPrec||1) + m.precision*magQ, 0.5, 2.0); }
      // Mana max & régénération (stats liées à la magie).
      if(m.manaMax){ player._mpMax = _clamp((player._mpMax||100) + m.manaMax*magQ, 100, 200); }
      if(m.manaRegen){ player._mpRegen = _clamp((player._mpRegen||1) + m.manaRegen*magQ, 1, 3); }
      // Petit gain d'attribut technique éventuel (rituel).
      const attrs = (session.attrs||[]).filter(function(k){ return player.s && typeof player.s[k]==='number'; });
      attrs.forEach(function(k){
        if(Math.random() < (P.tickBaseChance||0.05)*(session.gain||0.4)*magQ && player.s[k]<99){
          player.s[k]++; eff.progressed.push(k);
        }
      });
      // Apprentissage d'un nouveau sort : faible chance, pour tout le monde,
      // proportionnelle au niveau de la Tour de Magie, dans la limite de 3 sorts.
      if(m.learnSpell && typeof SPELLS!=='undefined' && Array.isArray(player.spells) && player.spells.length < 3){
        const chance = (mb.learnSpellChancePerLevel||0.01) * lvl;
        if(Math.random() < chance){
          const known = new Set(player.spells);
          const pool = SPELLS.filter(function(s){ return s && s.mp>0 && !known.has(s.id); });
          if(pool.length){
            const learned = pool[Math.floor(Math.random()*pool.length)];
            player.spells.push(learned.id);
            eff.learnedSpell = learned.n || learned.id;
          }
        }
      }
      return eff;
    }

    // ── Récupération / soins ───────────────────────────────────────────────
    if(fam.recovery){
      player._fm = _clamp((player._fm||0) - (session.fatigue||0) * (F.perPoint||0.1), F.formMin, F.formMax);
      if(session.heal && player.injLevel > 0 && player.injT > 0){
        player.injT = Math.max(0, player.injT - session.heal);
        if(player.injT === 0){ player.injLevel = 0; eff.healed = true; }
      }
      if(session.morale) player._hm = _clamp((player._hm||0) + session.morale, -10, 10);
      return eff;
    }

    // ── Fatigue générée → perte de forme ──────────────────────────────────
    player._fm = _clamp((player._fm||0) - (session.fatigue||0) * (F.perPoint||0.1), F.formMin, F.formMax);

    // ── Moral / cohésion ──────────────────────────────────────────────────
    if(session.morale)   player._hm  = _clamp((player._hm||0)  + session.morale,   -10, 10);
    if(session.cohesion){ player._coh = _clamp((player._coh||0) + session.cohesion,   0, 100); }

    // ── Progression d'attributs ───────────────────────────────────────────
    const q = sessionQuality(club, player, session);        // qualité 0.1..1.6
    const young = (player.age != null && player.age < (P.youthAgeThreshold||23));
    const attrs = (session.attrs||[]).filter(function(k){ return player.s && typeof player.s[k]==='number'; });
    attrs.forEach(function(k){
      let chance = (P.tickBaseChance||0.05) * (session.gain||1) * q;
      if(young) chance *= (P.youthMult||1.5);
      // Focus individuel (board.js) : le joueur travaille en priorité un
      // attribut précis — bonus dessus, léger malus sur le reste. Arbitrage,
      // pas bonus gratuit.
      if(typeof _focusMul === 'function') chance *= _focusMul(player, k);
      // ── Plafond SOUPLE de potentiel ───────────────────────────────────
      // CORRECTIF : on lisait `player.potential`, un champ que RIEN n'écrit
      // dans le jeu (le générateur pose `_potential`). `pot` retombait donc
      // toujours sur 99 et ce frein ne se déclenchait jamais : n'importe quel
      // joueur pouvait s'entraîner jusqu'à 99, quel que soit son talent.
      const cur = player.s[k];
      const pot = (player._potential != null) ? player._potential
                : (player.potential != null) ? player.potential : 99;
      // Le potentiel n'est pas un mur (façon FIFA/PES) : c'est le point où les
      // rendements décroissent. On peut le dépasser, mais chaque point coûte
      // de plus en plus cher — et sans focus dédié, ça devient vite négligeable.
      // Le talent décide de ce qui est FACILE, le travail de ce qui est POSSIBLE.
      if(cur >= pot - 2){
        const over = Math.max(0, cur - pot);              // points au-dessus du talent
        // Décroissance exponentielle douce : -25% par point au-delà du potentiel.
        let slow = (P.nearPotentialSlow||0.25) * Math.pow(P.overPotentialDecay||0.75, over);
        // Un focus dédié permet de forcer le talent : le joueur bosse
        // spécifiquement ça, il peut aller au-delà de ce que son talent donne
        // naturellement (mais lentement, et au prix du reste de son jeu).
        if(player._focus === k) slow *= (P.overPotentialFocusMul||4);
        chance *= slow;
      }
      if(cur >= 99) return;
      if(Math.random() < chance){
        player.s[k] = Math.min(99, cur + 1);
        eff.progressed.push(k);
        // Comptabilise le gain pour le bilan d'intersaison : sans ça, le
        // déclin de l'âge et les gains d'entraînement s'annulaient et le
        // joueur ne voyait jamais que son travail avait payé.
        if(!player._trainGain) player._trainGain = {};
        player._trainGain[k] = (player._trainGain[k] || 0) + 1;
      }
    });

    // ── Risque de blessure ────────────────────────────────────────────────
    let injRisk = (session.injury||0) * (session.intensity!=null ? (0.5 + session.intensity) : 1);
    // Fatigue accentue le risque, bon staff médical le réduit.
    if((player._fm||0) < (P.fatiguePenaltyForm||-4)) injRisk *= 1.8;
    const med = ((club&&club.infra&&club.infra.medical)||0);
    injRisk *= Math.max(0.4, 1 - med*0.10);
    // Kiné / physio (staff.js) : réduit encore le risque de blessure.
    if(typeof STAFF!=='undefined') injRisk *= STAFF.injuryRiskMul(club);
    if(player.injLevel === 0 && Math.random() < injRisk){
      player.injLevel = 1; player.injT = 2 + Math.floor(Math.random()*4);
      eff.injured = true;
    }
    return eff;
  }

  // Applique une journée (type + éventuelle famille/séance) à tout l'effectif.
  // day: { type, family, session } . squad: array de joueurs.
  // Renvoie un résumé texte court (ou null).
  function applyDay(club, squad, day){
    if(!squad || !squad.length) return null;
    const cfg = CFG();
    const dt = (cfg.dayTypes||{})[day && day.type] || null;

    // Repos : récupération passive + soin léger.
    if(!day || day.type === 'rest'){
      squad.forEach(function(p){
        if(!p) return;
        // Préparateur physique (staff.js) : récupération de forme optimisée.
        const _rec = (cfg.fatigue.passiveRecovery||0.3) + ((typeof STAFF!=='undefined') ? STAFF.fitnessRecovery(club) : 0);
        p._fm = _clamp((p._fm||0) + _rec, cfg.fatigue.formMin, cfg.fatigue.formMax);
        if(cfg.fatigue.cohesionDecay) p._coh = _clamp((p._coh||50) - cfg.fatigue.cohesionDecay, 0, 100);
        // Convalescence : 1 jour de base + bonus physio (staff.js).
        const _heal = 1 + ((typeof STAFF!=='undefined') ? STAFF.healBonus(club) : 0);
        if(p.injLevel>0 && p.injT>0){ p.injT = Math.max(0, p.injT-_heal); if(p.injT===0) p.injLevel=0; }
      });
      return null;
    }

    // Vidéo / mise en place : pas de fatigue physique, un peu de cohésion/tactique.
    if(dt && (dt.analysis || dt.prep)){
      squad.forEach(function(p){
        if(!p) return;
        p._coh = _clamp((p._coh||0) + (dt.prep?1.2:0.8), 0, 100);
        if(dt.prep) p._hm = _clamp((p._hm||0) + 0.2, -10, 10);
      });
      return (dt.icon||'') + ' ' + dt.label + ' — cohésion tactique en hausse.';
    }

    // Entraînement / récupération : appliquer la séance choisie.
    let session = null;
    if(day.family && day.session) session = getSession(day.family, day.session);
    else if(day.family) session = (familySessions(day.family)[0]); // 1re séance de la famille
    if(!session){
      // Type 'recovery' sans séance → séance de repos actif par défaut.
      session = getSession('recuperation','repos');
    }
    if(!session) return null;

    let prog = 0, inj = 0, heal = 0, learned = [];
    squad.forEach(function(p){
      if(!p) return;
      const e = applySessionToPlayer(club, p, session);
      prog += (e.progressed||[]).length; if(e.injured) inj++; if(e.healed) heal++;
      if(e.learnedSpell) learned.push(p.name + ' → ' + e.learnedSpell);
    });
    const fam = (cfg.families||{})[session.family] || {};
    let msg = (fam.icon||'🏃') + ' ' + (fam.label||'Entraînement') + ' · ' + (session.label||'');
    const bits = [];
    if(prog) bits.push('✨ '+prog+' progression'+(prog>1?'s':''));
    if(heal) bits.push('💚 '+heal+' rétabli'+(heal>1?'s':''));
    if(inj)  bits.push('🤕 '+inj+' blessé'+(inj>1?'s':''));
    if(bits.length) msg += ' — ' + bits.join(', ') + '.';
    if(learned.length) msg += ' 🔮 Nouveau sort : ' + learned.join(', ') + ' !';
    return msg;
  }

  // Applique une JOURNÉE À SLOTS : day.slots = { morning, afternoon, evening },
  // chaque slot étant lui-même { type, family?, session? } ou null.
  // Renvoie un résumé texte agrégé (ou null). Rétro-compatible : si `day` n'a
  // pas de `slots`, on retombe sur applyDay classique (une séance).
  function applyDaySlots(club, squad, day){
    if(!day || !day.slots) return applyDay(club, squad, day);
    const cfg = CFG();
    const order = (cfg.slots && cfg.slots.order) || ['morning','afternoon','evening'];
    const msgs = [];
    order.forEach(function(slotKey){
      const s = day.slots[slotKey];
      if(!s || s.type==='rest' || !s.type) return;
      const m = applyDay(club, squad, s);
      if(m){ const lbl = (cfg.slots.icons&&cfg.slots.icons[slotKey])||''; msgs.push(lbl+' '+m); }
    });
    if(!msgs.length){
      // Journée entièrement au repos → récupération passive.
      applyDay(club, squad, { type:'rest' });
      return null;
    }
    return msgs.join('  ·  ');
  }

  // ── Génération automatique d'un planning hebdo par l'IA ─────────────────
  // Renvoie un tableau de 7 journées { type, family?, session? }, avec le match
  // placé si matchDayIndex est fourni (0=Lundi..6=Dimanche, ou null).
  function generateWeekPlan(club, opts){
    opts = opts || {};
    const cfg = CFG();
    const status = clubStatus(club);
    const template = (cfg.weekTemplates[status] || cfg.weekTemplates.amateur).slice();
    const style = coachStyleOf(club);
    const styleW = (cfg.coachStyles[style] || cfg.coachStyles.equilibre).weights;

    // Respecter le plafond de séances autorisé.
    const cap = maxSessions(club, opts);
    const minS = minSessions(club);
    const slotCfg = cfg.slots || { order:['evening'], byStatus:{} };
    const openSlots = (slotCfg.byStatus && slotCfg.byStatus[status]) || { evening:true };
    const magicUnlocked = _magicUnlocked(club);
    let placed = 0; // nb de créneaux d'ENTRAÎNEMENT d'effort placés (comptent au plafond)

    const plan = template.map(function(type, i){
      // Un match fixé écrase la journée.
      if((opts.matchDayIndex != null && i === opts.matchDayIndex) || type === 'match'){
        return { type:'match', slots:null };
      }
      const day = { type:'day', slots:{} };
      // Journées « fixes » du template (récup, mise en place) : on remplit le
      // dernier créneau ouvert avec l'activité, le reste au repos.
      if(type === 'recovery'){
        _fillDay(day, openSlots, { type:'recovery', family:'recuperation', session:_pickRecovery() });
        return day;
      }
      if(type === 'matchprep'){ _fillDay(day, openSlots, { type:'matchprep' }); return day; }
      if(type === 'video'){ _fillDay(day, openSlots, { type:'video' }); return day; }
      if(type === 'rest'){ _fillDay(day, openSlots, null); return day; }
      // type 'auto' → on remplit CHAQUE créneau ouvert d'une séance tant que le
      // plafond hebdo n'est pas atteint (double/triple séance possible en pro).
      (slotCfg.order||['evening']).forEach(function(sk){
        if(!openSlots[sk]){ day.slots[sk] = null; return; }
        if(placed >= cap){ day.slots[sk] = { type:'rest' }; return; }
        // Occasionnellement une famille magie/sociale non comptée au plafond.
        const fam = _weightedPickFamily(styleW, club, { magicUnlocked:magicUnlocked });
        const isFree = (cfg.slots.freeTypes||[]).indexOf(_dayTypeForFamily(fam)) >= 0;
        day.slots[sk] = _slotForFamily(fam);
        if(!isFree) placed++;
      });
      return day;
    });

    // Garantir le minimum de séances du statut sur des créneaux au repos.
    if(placed < minS){
      for(let i=0;i<plan.length && placed<minS;i++){
        const d = plan[i]; if(!d || !d.slots) continue;
        for(const sk of (slotCfg.order||[])){
          if(placed>=minS) break;
          if(openSlots[sk] && (!d.slots[sk] || d.slots[sk].type==='rest')){
            const fam = _weightedPickFamily(styleW, club, { magicUnlocked:magicUnlocked, effortOnly:true });
            d.slots[sk] = _slotForFamily(fam); placed++;
          }
        }
      }
    }
    return plan;
  }

  // ── Statistiques d'un planning à slots (pour l'UI / validation) ─────────
  function planStats(club, plan){
    const cfg = CFG();
    const freeTypes = (cfg.slots && cfg.slots.freeTypes) || [];
    let sessions=0, freeSlots=0, totalFatigue=0, totalDur=0, injRisk=0, socialCount=0, magicCount=0;
    _forEachSlot(plan, function(slot){
      if(!slot || !slot.type || slot.type==='rest' || slot.type==='match') return;
      const fam = (cfg.families||{})[slot.family] || {};
      const s = getSession(slot.family, slot.session);
      if(s){ totalFatigue += s.fatigue||0; totalDur += s.dur||0; injRisk += s.injury||0; }
      if(fam.social) socialCount++;
      if(slot.family==='magie') magicCount++;
      // Un créneau compte au plafond sauf s'il est de type « gratuit ».
      if(freeTypes.indexOf(slot.type) >= 0) freeSlots++;
      else sessions++;
    });
    const cap = maxSessions(club);
    return { sessions:sessions, freeSlots:freeSlots, social:socialCount, magic:magicCount,
             totalFatigue:totalFatigue, totalDur:totalDur,
             avgInjury: sessions? injRisk/sessions : 0,
             cap: cap, min: minSessions(club), overCap: sessions > cap };
  }

  // Compte les créneaux d'entraînement d'effort déjà posés sur une semaine
  // (utilisé par l'UI pour bloquer l'ajout au-delà du plafond).
  function countWeekSessions(plan){
    const cfg = CFG();
    const freeTypes = (cfg.slots && cfg.slots.freeTypes) || [];
    let n = 0;
    _forEachSlot(plan, function(slot){
      if(slot && slot.type && slot.type!=='rest' && slot.type!=='match' && freeTypes.indexOf(slot.type)<0) n++;
    });
    return n;
  }

  // Valide qu'un planning respecte le plafond du statut (empêche l'abus amateur).
  function validatePlan(club, plan){
    const st = planStats(club, plan);
    return !st.overCap;
  }

  // ── Helpers coach / familles ────────────────────────────────────────────
  function coachStyleOf(club){
    if(club && club.coachStyle && CFG().coachStyles[club.coachStyle]) return club.coachStyle;
    // Déduire du staff/manager si disponible, sinon équilibré.
    return 'equilibre';
  }
  function _weightedPickFamily(weights, club, o){
    o = o || {};
    const FAMS = CFG().families || {};
    const fams = Object.keys(FAMS).filter(function(f){
      // Ne pas planifier une famille gardien pour tout l'effectif.
      if(FAMS[f].goalkeeperOnly) return false;
      // Famille magie exclue si le bâtiment n'est pas débloqué.
      if(FAMS[f].requiresBuilding && !o.magicUnlocked) return false;
      // Pour garantir le minimum de séances, on ne tire que de l'effort réel.
      if(o.effortOnly && (FAMS[f].social || FAMS[f].recovery)) return false;
      return true;
    });
    let total=0; const bag=[];
    fams.forEach(function(f){ const w=(weights&&weights[f]!=null)?weights[f]:1; total+=w; bag.push([f,total]); });
    const r = Math.random()*total;
    for(const [f,c] of bag){ if(r<=c) return f; }
    return fams[0];
  }
  // Type de journée associé à une famille (pour savoir si le créneau est gratuit).
  function _dayTypeForFamily(fam){
    const F = (CFG().families||{})[fam] || {};
    if(F.recovery) return 'recovery';
    if(F.social)   return 'social';
    return 'training';
  }
  // Construit l'objet slot d'une famille tirée (type + séance).
  function _slotForFamily(fam){
    return { type:_dayTypeForFamily(fam), family:fam, session:_pickSessionInFamily(fam) };
  }
  // Remplit une journée : activité sur le dernier créneau ouvert, repos ailleurs.
  function _fillDay(day, openSlots, activity){
    const order = (CFG().slots && CFG().slots.order) || ['evening'];
    const opened = order.filter(function(sk){ return openSlots[sk]; });
    const target = opened[opened.length-1] || 'evening';
    order.forEach(function(sk){
      if(!openSlots[sk]){ day.slots[sk] = null; return; }
      day.slots[sk] = (sk===target && activity) ? activity : { type:'rest' };
    });
  }
  // Parcourt tous les slots d'un planning (gère aussi les anciens plans à 1 séance).
  function _forEachSlot(plan, fn){
    (plan||[]).forEach(function(d){
      if(!d) return;
      if(d.slots){ Object.keys(d.slots).forEach(function(k){ fn(d.slots[k]); }); }
      else fn(d); // rétro-compat : ancienne journée = une séance
    });
  }
  // La Tour de Magie est-elle débloquée pour ce club ?
  function _magicUnlocked(club){
    const mb = CFG().magicBuilding || {};
    const lvl = (club && club.infra && club.infra[mb.key||'magic']) || 0;
    return lvl >= (mb.unlockLevel||1);
  }
  function _pickSessionInFamily(familyKey){
    const keys = Object.keys((CFG().families[familyKey]||{}).sessions||{});
    return keys[Math.floor(Math.random()*keys.length)];
  }
  function _pickRecovery(){
    const keys = Object.keys((CFG().families.recuperation||{}).sessions||{});
    return keys[Math.floor(Math.random()*keys.length)];
  }

  // ── Migration d'une sauvegarde existante ────────────────────────────────
  // Ajoute club.status, club.coachStyle, _coh joueurs, et weekPlan si absent.
  // Idempotent : ne réécrit jamais des valeurs déjà présentes.
  function migrateCareer(C){
    if(!C || !C.club) return false;
    let changed = false;
    const club = C.club;
    if(!club.status){ club.status = clubStatus(club); changed = true; }
    if(!club.coachStyle){ club.coachStyle = 'equilibre'; changed = true; }
    if(club.trainingVersion !== (CFG().version||1)){ club.trainingVersion = (CFG().version||1); changed = true; }
    // Bâtiment magie : présent dans infra (niveau 0 = non construit).
    if(!club.infra) { club.infra = {}; changed = true; }
    const mbKey = (CFG().magicBuilding||{}).key || 'magic';
    if(club.infra[mbKey] == null){ club.infra[mbKey] = 0; changed = true; }
    // Cohésion + précision de sorts + mana sur les joueurs si absentes.
    const squad = (C.players||[]).concat(C.bench||[], C.reserves||[]);
    squad.forEach(function(p){
      if(!p) return;
      if(p._coh == null){ p._coh = 50; changed = true; }
      if(p._spellPrec == null){ p._spellPrec = 1; changed = true; }
      if(p._mpMax == null){ p._mpMax = 100; changed = true; }
    });
    // Planning hebdo par défaut (format à slots) si absent OU ancien format.
    if(!C.weekPlan || (C.weekPlan[0] && !C.weekPlan[0].slots && C.weekPlan[0].type!=='match')){
      C.weekPlan = generateWeekPlan(club, {}); changed = true;
    }
    return changed;
  }

  // ── Utils internes ──────────────────────────────────────────────────────
  function _isGoalkeeper(p){ return p && (p.pos==='GB' || p.pos==='GK' || p.pos==='G'); }
  function _clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  return {
    config: CFG,
    clubStatus, statusConfig, statusLabel: function(club){ return statusConfig(club).label; },
    maxSessions, minSessions,
    allSessions, familySessions, getSession,
    sessionQuality, applySessionToPlayer, applyDay, applyDaySlots,
    generateWeekPlan, planStats, validatePlan, coachStyleOf,
    countWeekSessions, magicUnlocked: _magicUnlocked,
    slotOpen: function(club, slotKey){
      const st = clubStatus(club); const cfg = CFG();
      return !!(cfg.slots && cfg.slots.byStatus[st] && cfg.slots.byStatus[st][slotKey]);
    },
    migrateCareer, DAYS: TRAINING_DAYS,
  };
})();

// Exposer en global pour les autres modules (chargés via <script>).
if(typeof window !== 'undefined'){
  window.TRAINING = TRAINING;
  window.TRAINING_CONFIG = TRAINING_CONFIG;
  window.TRAINING_DAYS = TRAINING_DAYS;
}
