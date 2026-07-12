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

  generatePlayer(nationId, regionId, pos, name, level){
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

    // Calculer les stats avec modificateurs de région + niveau
    const mods = region.statMods || {};
    const stat = (key) => {
      // On part de la fourchette du niveau, pas de la fourchette de la nation
      const levelMin = levelRange.min;
      const levelMax = levelRange.max;
      // Les mods de région décalent dans cette fourchette (+10 tec pour Thalassyr reste cohérent)
      const mod = Math.round((mods[key] || 0) * 0.4); // réduit l'impact des mods sur les bas niveaux
      const variance = mods.stat_variance ? (Math.random()-.5) * (mods.stat_variance/20) : 0;
      // Certaines stats ont un bonus/malus selon le poste
      const posBonus = _statPosBonus(key, pos);
      return Math.max(1, Math.min(99,
        Math.round(levelMin + Math.random()*(levelMax - levelMin) + mod + variance + posBonus + (Math.random()-.5)*5)
      ));
    };

    // Sorts : limités en bas de la pyramide
    const baseSpells = [...(nation.preferredSpells || [])];
    const regionSpells = region.spellBonus || [];
    const fullPool = [...new Set([...baseSpells, ...regionSpells])];
    const extraSpells = mods.extra_spells || 0;
    const fewerSpells = mods.fewer_spells || false;
    // En bas niveau, les sorts sont plus rares
    const levelSpellChance = {dh:0.3, r3:0.45, r2:0.6, r1:0.75, d3:0.85, d2:0.9, d1:1.0};
    const spellChance = levelSpellChance[level] || 0.3;
    let nbSpells = 0;
    if(Math.random() < spellChance){
      nbSpells = fewerSpells ? 1 : 1 + extraSpells + Math.floor(Math.random()*2);
    }
    const spells = nbSpells > 0 ? [...fullPool].sort(()=>Math.random()-.5).slice(0, nbSpells) : [];

    return {
      id: 'p_'+Date.now()+'_'+Math.random().toString(36).slice(2),
      name,
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
      ini: (name||'??').slice(0,2).toUpperCase(),
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
    const nextName = () => names[nameIdx++] || 'Joueuse'+(nameIdx);

    const positions = options.positions || ['GB','DC','DD','DG','MC','MC','ATT'];
    const benchPos  = options.bench    || ['GB','MC','ATT'];
    const resPos    = options.reserves || [];

    const make = (pos, isBench=false) => {
      const p = this.generatePlayer(nationId, regionId, pos, nextName(), level);
      if(!p) return null;
      if(isBench) p.onBench = true;
      return p;
    };

    return {
      players:  positions.map(pos => make(pos)).filter(Boolean),
      bench:    benchPos.map(pos => make(pos, true)).filter(Boolean),
      reserves: resPos.map(pos => make(pos, true)).filter(Boolean),
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
