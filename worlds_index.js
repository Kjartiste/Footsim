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
  nations: [
    PANTHALASSA,
    // AUTRE_NATION,  ← ajouter ici quand tu crées une nouvelle nation
  ],

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
  generatePlayer(nationId, regionId, pos, name){
    const nation = this.get(nationId);
    const region = this.getRegion(nationId, regionId);
    if(!nation || !region) return null;

    // Déterminer la race
    const nonSirenChance = region.statMods?.non_siren_chance || 0;
    const isNonSiren = Math.random() < nonSirenChance;
    const race = isNonSiren ? 'human' : 'siren';
    const baseStats = (isNonSiren && nation.races?.human?.statOverride)
      ? nation.races.human.statOverride
      : nation.baseStats;

    // Calculer les stats avec modificateurs de région
    const mods = region.statMods || {};
    const stat = (key) => {
      const b = baseStats[key] || {min:40, max:70};
      const mod = mods[key] || 0;
      const variance = mods.stat_variance ? (Math.random()-.5) * (mods.stat_variance/10) : 0;
      return Math.max(1, Math.min(99,
        Math.round(b.min + Math.random()*(b.max - b.min) + mod + variance + (Math.random()-.5)*8)
      ));
    };

    // Sorts selon la région
    const baseSpells = [...(nation.preferredSpells || [])];
    const regionSpells = region.spellBonus || [];
    const fullPool = [...new Set([...baseSpells, ...regionSpells])];

    // Nombre de sorts (Velmara en a plus)
    const extraSpells = mods.extra_spells || 0;
    const fewerSpells = mods.fewer_spells || false;
    const nbSpells = fewerSpells
      ? Math.max(0, 1 + extraSpells + Math.floor(Math.random()*1))
      : 1 + extraSpells + Math.floor(Math.random()*2);

    const spells = [...fullPool].sort(()=>Math.random()-.5).slice(0, Math.max(1, nbSpells));

    return {
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name,
      pos,
      nation: nationId,
      region: regionId,
      race,
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

    const names = [...(region.names || [])].sort(()=>Math.random()-.5);
    let nameIdx = 0;
    const nextName = () => names[nameIdx++] || `Joueuse${nameIdx}`;

    const positions = options.positions || ['GB','DC','DD','DG','MC','MC','ATT'];
    const benchPos  = options.bench    || ['GB','MC','ATT','DC','MC'];
    const resPos    = options.reserves || ['MC','ATT','DC'];

    const make = (pos, isBench=false) => {
      const p = this.generatePlayer(nationId, regionId, pos, nextName());
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

// Freeze le registre
Object.freeze(WORLDS);
