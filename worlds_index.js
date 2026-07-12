// ═══════════════════════════════════════════════════════════
// WORLDS/INDEX.JS — Agrégateur de toutes les nations
// Charge et expose le registre mondial WORLDS
// ═══════════════════════════════════════════════════════════
// Pour ajouter une nouvelle nation :
//   1. Créer un fichier worlds/[nation].js suivant le même format que panthalassa.js
//   2. Le charger dans index.html AVANT ce fichier
//   3. L'ajouter dans le tableau ci-dessous
// ═══════════════════════════════════════════════════════════

const WORLDS = {

  // ── Registre des nations ────────────────────────────────────────────
  // On n'inclut que les nations réellement définies : si un fichier de nation
  // n'a pas été chargé (404, ordre de script…), on l'ignore proprement au lieu
  // de planter tout le jeu sur un ReferenceError.
  nations: [
    typeof PANTHALASSA!=='undefined' ? PANTHALASSA : null,
    typeof VALORIA!=='undefined' ? VALORIA : null,
    typeof PILIER!=='undefined' ? PILIER : null,
    // AUTRE_NATION,  ← ajouter ici quand tu crées une nouvelle nation
  ].filter(Boolean),

  // ── Accès rapide par ID ─────────────────────────────────────────────
  get(nationId){
    return this.nations.find(n => n.id === nationId) || null;
  },

  // ── Récupérer une région dans une nation ────────────────────────────
  getRegion(nationId, regionId){
    const nation = this.get(nationId);
    if(!nation) return null;
    return nation.regions.find(r => r.id === regionId) || null;
  },

  // ── Toutes les régions d'une nation ─────────────────────────────────
  getRegions(nationId){
    return this.get(nationId)?.regions || [];
  },

  // ── La pyramide d'une nation ─────────────────────────────────────────
  getPyramid(nationId){
    return this.get(nationId)?.pyramid || [];
  },

  // ── Générer un joueur selon sa nation et sa région ──────────────────
  // ── Fourchettes de stats selon le niveau ─────────────────────────────
  // DH = District — les groupes les plus bas ont des stats proches de 0
  // On utilise le groupe (0=plus bas, 3=meilleur DH) pour varier
  LEVEL_STAT_RANGES: {
    'dh_4': {min:2,  max:12},   // District groupe 4 (le plus bas, fondation)
    'dh_3': {min:5,  max:15},   // District groupe 3
    'dh_2': {min:8,  max:18},   // District groupe 2
    'dh_1': {min:10, max:22},   // District groupe 1 (meilleur niveau district)
    dh:     {min:8,  max:20},   // District générique
    r3:     {min:15, max:32},   // Régional 3
    r2:     {min:25, max:42},   // Régional 2
    r1:     {min:35, max:55},   // Régional 1
    d3:     {min:48, max:65},   // Division 3
    d2:     {min:58, max:75},   // Division 2
    d1:     {min:70, max:90},   // Division 1 — élite
  },

  generatePlayer(nationId, regionId, pos, name, level, squadTier){
    const nation = this.get(nationId);
    const region = this.getRegion(nationId, regionId);
    if(!nation || !region) return null;

    // Déterminer la race
    let race, isNonSiren;
    if(nationId==='pilier' && typeof pickRaceForPilier==='function'){
      // Pilier Céleste : race choisie par altitude (division) → anges haut, démons bas.
      race = pickRaceForPilier(level, (name||'')+(pos||''));
      isNonSiren = true; // jamais de sirène ici
    } else {
      const nonSirenChance = region.statMods?.non_siren_chance || 0;
      isNonSiren = Math.random() < nonSirenChance;
      race = isNonSiren ? 'human' : 'siren';
    }
    const baseStats = (isNonSiren && nation.races?.human?.statOverride)
      ? nation.races.human.statOverride
      : nation.baseStats;

    // Fourchette selon le niveau — écrase les baseStats de la nation
    const levelRange = this.LEVEL_STAT_RANGES[level] || this.LEVEL_STAT_RANGES['dh'];

    // ── ÉCART TITULAIRE / RÉSERVISTE ──────────────────────────────────────
    // Un club n'aligne pas 25 joueurs du même niveau : les titulaires visent le
    // HAUT de la fourchette, les remplaçants le milieu, les réservistes/jeunes
    // le bas (et un peu en-dessous). On décale la fenêtre de tirage de chaque
    // joueur selon son statut dans l'effectif (squadTier).
    const span = levelRange.max - levelRange.min;
    const tierShift = {
      starter: { lo: 0.45, hi: 1.00 },   // titulaires : haut de fourchette
      bench:   { lo: 0.20, hi: 0.70 },   // banc : milieu
      reserve: { lo: -0.10, hi: 0.45 },  // réserve/jeunes : bas (peut descendre sous le min)
    }[squadTier] || { lo: 0.0, hi: 1.0 };
    const effMin = levelRange.min + span * tierShift.lo;
    const effMax = levelRange.min + span * tierShift.hi;

    // Calculer les stats avec modificateurs de région + niveau
    const mods = region.statMods || {};
    const stat = (key) => {
      // On part de la fourchette du niveau DÉCALÉE selon le statut du joueur
      const levelMin = effMin;
      const levelMax = effMax;
      // Les mods de région décalent dans cette fourchette (+10 tec pour Thalassyr reste cohérent)
      const mod = Math.round((mods[key] || 0) * 0.4); // réduit l'impact des mods sur les bas niveaux
      const variance = mods.stat_variance ? (Math.random()-.5) * (mods.stat_variance/20) : 0;
      // Certaines stats ont un bonus/malus selon le poste
      const posBonus = _statPosBonus(key, pos);
      return Math.max(1, Math.min(99,
        Math.round(levelMin + Math.random()*(levelMax - levelMin) + mod + variance + posBonus + (Math.random()-.5)*5)
      ));
    };

    // Sorts : plus le joueur est bon (niveau élevé + statut de titulaire), plus
    // il a de sorts. Un titulaire de D1 peut en avoir 3-4 ; un réserviste de
    // district 0-1. On combine la chance d'AVOIR des sorts et leur NOMBRE.
    const baseSpells = [...(nation.preferredSpells || [])];
    const regionSpells = region.spellBonus || [];
    const fullPool = [...new Set([...baseSpells, ...regionSpells])];
    const extraSpells = mods.extra_spells || 0;
    const fewerSpells = mods.fewer_spells || false;
    const levelSpellChance = {dh:0.25, r3:0.4, r2:0.55, r1:0.7, d3:0.85, d2:0.92, d1:1.0};
    const spellChance = levelSpellChance[level] || 0.3;
    // Nombre max de sorts selon le niveau du championnat.
    const levelMaxSpells = {dh:1, r3:1, r2:2, r1:2, d3:3, d2:3, d1:4};
    let maxSpells = levelMaxSpells[level] || 1;
    // Le statut module : les titulaires tirent vers le max, les réservistes vers le bas.
    const tierSpellBonus = { starter:1, bench:0, reserve:-1 }[squadTier] || 0;
    maxSpells = Math.max(0, Math.min(fullPool.length, maxSpells + tierSpellBonus + extraSpells));
    let nbSpells = 0;
    if(Math.random() < spellChance && maxSpells>0){
      if(fewerSpells){ nbSpells = 1; }
      else {
        // Tirage pondéré : au moins 1, souvent proche du max pour les bons joueurs.
        const roll = Math.random();
        const minS = squadTier==='starter' ? Math.max(1,Math.ceil(maxSpells*0.5)) : 1;
        nbSpells = minS + Math.floor(roll*roll*(maxSpells-minS+1));
        nbSpells = Math.min(maxSpells, Math.max(1, nbSpells));
      }
    }
    const spells = nbSpells > 0 ? [...fullPool].sort(()=>Math.random()-.5).slice(0, nbSpells) : [];

    // ── SEXE ──────────────────────────────────────────────────────────────
    // Répartition définie par la nation (sexRatio). Ex : le Pilier est très
    // majoritairement féminin. Valeurs : 'F' (femme), 'M' (homme), 'X' (non-genré
    // /autre). Défaut équilibré si la nation ne précise rien.
    const _sr = nation.sexRatio || { F:0.5, M:0.5, X:0 };
    let sex = 'F'; {
      const r = Math.random();
      const pF = _sr.F||0, pM = _sr.M||0;
      if(r < pF) sex='F'; else if(r < pF+pM) sex='M'; else sex='X';
    }

    // ── NATIONALITÉ + NOM DE LIGNÉE ───────────────────────────────────────
    // Chaque joueur a une nationalité. En pro, une petite fraction sont des
    // ÉTRANGERS (foreign_chance de la nation) : ils portent un nom d'un autre
    // style (foreignNames) et un tag de nationalité distinct — la structure est
    // prête pour quand d'autres pays existeront.
    const isPro = ['d1','d2','d3'].includes(level);
    const foreignChance = isPro ? (nation.foreignChance || 0) : 0;
    // Prénom cohérent avec le SEXE si la nation fournit des pools par sexe.
    // (Sinon on garde le `name` transmis par generateSquad.)
    let baseFirst = name;
    if(nation.firstNamesBySex){
      const pool = nation.firstNamesBySex[sex] || nation.firstNamesBySex.F || [];
      if(pool.length) baseFirst = pool[Math.floor(Math.random()*pool.length)];
    }
    let finalName = baseFirst;
    let nationality = nation.demonym || nation.name || nationId;
    if(Math.random() < foreignChance && Array.isArray(nation.foreignNames) && nation.foreignNames.length){
      // Joueur étranger : nom + nationalité d'ailleurs.
      const fn = nation.foreignNames[Math.floor(Math.random()*nation.foreignNames.length)];
      finalName = fn.name;
      nationality = fn.nat;
    } else {
      // Natif : une partie porte un NOM DE LIGNÉE (patronyme façon Maison), pas
      // seulement les joueurs de clubs pro — une lignée est indépendante du club.
      const lineages = nation.lineageNames || region.lineageNames || null;
      if(lineages && lineages.length && !/\s/.test(finalName) && Math.random() < (nation.lineageChance || 0.5)){
        finalName = finalName + ' ' + lineages[Math.floor(Math.random()*lineages.length)];
      }
    }

    return {
      id: 'p_'+Date.now()+'_'+Math.random().toString(36).slice(2),
      name: finalName,
      nationality,
      foreign: nationality !== (nation.demonym || nation.name || nationId),
      sex,
      pos,
      nation: nationId,
      region: regionId,
      race,
      level: level || 'dh',
      s: {
        tec:  stat('tec'),
        spd:  stat('spd'),
        sht:  stat('sht'),
        def:  stat('def'),
        stam: stat('stam'),
        res:  stat('res'),
      },
      spells,
      hp: 100, mp: 100,
      injLevel: 0, injT: 0,
      yc: 0, red: false,
      // Champs de position / mouvement — SANS EUX un joueur généré reste figé
      // (x/y undefined → NaN → aucune mise à jour de position).
      x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0,
      stunT: 0, hasBall: false,
      runT: 0, runCool: 0, tackleCool: 0,
      wPhaseX: Math.random(), wPhaseY: Math.random(), wSpeed: 1.2 + Math.random()*0.6,
      bobPhase: Math.random()*Math.PI*2,
      mSh: 0, mTk: 0, mPass: 0, mGoal: 0,
      _hm: Math.round((Math.random()+Math.random()-1)*8),
      _fm: Math.round(Math.random()*6),
      ini: (finalName||'??').slice(0,2).toUpperCase(),
      // Âge : distribution réaliste (16-34). Les jeunes ont un potentiel de
      // progression ; sert à repérer les pépites en réserve.
      age: (function(){ const r=Math.random(); return r<0.18?16+Math.floor(Math.random()*4) : r<0.75?20+Math.floor(Math.random()*9) : 29+Math.floor(Math.random()*6); })(),
      _isGem: false,
    };
  },

  // ── Générer une pépite (spécialité Nérïa) ───────────────────────────
  generateGem(nationId, pos, name){
    const p = this.generatePlayer(nationId, 'neria', pos, name);
    if(!p) return null;
    const gemSpells = ['fireball','eldritch','gaia','atk_demo','tir_licorne','tir_celeste'];
    p.spells = gemSpells.sort(()=>Math.random()-.5).slice(0,3);
    p.s.tec = Math.min(99, p.s.tec + 15);
    p.s.sht = Math.min(99, p.s.sht + 10);
    p._isGem = true;
    return p;
  },

  // ── Générer un effectif complet pour un club ─────────────────────────
  generateSquad(nationId, regionId, options={}){
    const region = this.getRegion(nationId, regionId);
    if(!region) return {players:[], bench:[], reserves:[]};
    const level = options.level || 'dh';

    const names = [...(region.names || [])].sort(()=>Math.random()-.5);
    let nameIdx = 0;
    // Rebouclage sur la liste de prénoms de la région une fois épuisée, au
    // lieu de basculer sur un nom générique hors-lore ("Joueuse21"…). Un gros
    // club (D1 : 18 titulaires + 7 banc + 3 réservistes = 28) dépasse vite le
    // pool de prénoms d'une région (souvent ~20 noms) : on préfère un prénom
    // déjà utilisé (avec un suffixe romain pour le distinguer) à un nom
    // générique qui casse l'immersion. On ne retombe sur 'Joueuse' que si la
    // région n'a strictement aucun prénom défini.
    const ROMAN = ['','II','III','IV','V','VI','VII','VIII'];
    const nextName = () => {
      if(!names.length) return 'Joueuse'+(nameIdx++ +1);
      const lap  = Math.floor(nameIdx / names.length);
      const base = names[nameIdx % names.length];
      nameIdx++;
      return lap>0 ? base+' '+(ROMAN[lap]||('#'+(lap+1))) : base;
    };

    const positions = options.positions || ['GB','DC','DD','DG','MC','MC','ATT'];
    const benchPos  = options.bench    || ['GB','MC','ATT'];
    const resPos    = options.reserves || [];

    const make = (pos, squadTier) => {
      const p = this.generatePlayer(nationId, regionId, pos, nextName(), level, squadTier);
      if(!p) return null;
      if(squadTier==='bench' || squadTier==='reserve') p.onBench = true;
      return p;
    };

    return {
      players:  positions.map(pos => make(pos, 'starter')).filter(Boolean),
      bench:    benchPos.map(pos => make(pos, 'bench')).filter(Boolean),
      reserves: resPos.map(pos => make(pos, 'reserve')).filter(Boolean),
    };
  },

  // ── Tirer un événement régional aléatoire ───────────────────────────
  rollRegionEvent(nationId, regionId){
    const events = this.get(nationId)?.regionEvents?.[regionId] || [];
    for(const ev of events){
      if(Math.random() < ev.prob) return ev;
    }
    return null;
  },

  // ── Budget de départ selon la richesse de la région ─────────────────
  startBudget(nationId, regionId){
    const region = this.getRegion(nationId, regionId);
    const wealth = region?.wealth || 2;
    return {1:5000, 2:15000, 3:40000, 4:100000, 5:300000}[wealth] || 15000;
  },

  // ── Réputation de départ selon le niveau ────────────────────────────
  startReputation(level, region){
    const base = {dh:5, r3:10, r2:15, r1:20, d3:35, d2:50, d1:70}[level] || 10;
    return base + (region?.wealth || 2) * 2;
  },

};

// Bonus/malus de stats selon le poste (gardien a plus de def, attaquant plus de tir etc.)
function _statPosBonus(key, pos){
  const posBonus = {
    GB:  {def:5, res:3, tec:-2, sht:-5, spd:-3},
    DC:  {def:5, res:3, stam:2, sht:-3},
    DD:  {def:4, spd:3, sht:-2},
    DG:  {def:4, spd:3, sht:-2},
    MC:  {tec:3, stam:3},
    MDC: {def:4, stam:4, sht:-2},
    MO:  {tec:4, sht:2},
    ATT: {sht:6, spd:4, def:-4, stam:-2},
    AG:  {spd:5, sht:4, def:-3},
    AD:  {spd:5, sht:4, def:-3},
  };
  return (posBonus[pos] && posBonus[pos][key]) || 0;
}

// Freeze le registre
Object.freeze(WORLDS);
