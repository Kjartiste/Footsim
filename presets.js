// ═══════════════════════════════════════════════════════════
// PRESETS.JS — Équipes préenregistrées (effectifs fixes)
// ═══════════════════════════════════════════════════════════
// Ce sont des équipes livrées avec le jeu, à effectif FIXE (mêmes joueurs à chaque
// fois), sélectionnables via un onglet filtrable par pays / type (club ou
// sélection nationale) / ligue comme FIFA/PES pour que ça fasse football manager en soit.
//
// Ces équipes s'injectent dans le registre existant (savedTeams / localStorage
// 'footsim7v7_roster') au chargement, sans écraser les équipes créées par le
// joueur. Elles portent un drapeau _preset:true et un _presetId stable pour
// pouvoir les reconnaître / re-synchroniser.
//
// FORMAT (aligné sur serializeTeam/serializePlayer de ui.js) :
//   { presetId, name, color, country, kind:'club'|'nation', league, strat,
//     players:[ {name,pos,s:{spd,sht,def,stam,tec,res},spells?} x7 ] }
// Les champs runtime (x,y,hp,mp…) sont complétés à l'injection. Attention j'ai pas encore fais pour les 5v5 et 11v11.
// J'ai demandé à claude de le faire pour l'instant pour voir ce que ça donnerait car c'est un très gros chantier.
// ═══════════════════════════════════════════════════════════

// Petit helper interne pour écrire les joueurs de façon compacte :
// mk(nom, poste, [spd,sht,def,stam,tec,res], [sorts?])
function _mk(name, pos, [spd,sht,def,stam,tec,res], spells){
  return { name, pos, s:{spd,sht,def,stam,tec,res}, spells:spells||[] };
}

// Un 7v7 = 1 GB + 6 champ (formation 3-2-1 : GB, DC, DD, DG, MDC, MC, ATT).
// ═══════════════════════════════════════════════════════════════════════
//  SORTS & TACTIQUES PRÉFAITS (dérivés du lore Valoria)
//  Valoria est un pays HUMAIN, sobre en magie (valoria.js preferredSpells).
//  → densité de sorts selon le NIVEAU du club (rare en district, dense en
//    pro / sélection nationale), et thème selon la RÉGION + le POSTE.
//  Tout est DÉTERMINISTE (hash stable du nom + presetId) : les équipes
//  livrées sont identiques à chaque chargement, aucune part d'aléatoire.
// ═══════════════════════════════════════════════════════════════════════

// Hash déterministe → [0,1)
function _presetHash(str){
  let h=2166136261>>>0;
  for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619)>>>0; }
  return (h>>>0)/4294967296;
}

// Nombre de joueurs porteurs de sorts selon le niveau du club.
// Valoria = sobre : même en pro on reste loin d'une équipe 100% mages.
function _spellDensityForTier(tier){
  switch(tier){
    case 'national_team': return 5; // élite : la sélection concentre les magiciens
    case 'pro':           return 3; // Ligue Valorienne : quelques joueurs dotés
    case 'regional':      return 2;
    case 'r1': case 'r2': return 2;
    default:              return 1; // district & amateur : la magie est rare
  }
}

// Répertoire de sorts par région × groupe de poste (cohérent avec statMods).
// Valcourt (tec+/spd+/sht+) : école technique & offensive, tirs travaillés.
// Brumefer (def+/stam+/res+) : durs au mal, magie défensive & de soin.
// Les ids doivent exister dans SPELLS (data.js).
const _PRESET_SPELL_POOL = {
  valcourt: {
    GK:   ['main','shield'],
    DEF:  ['shield','pass','tech'],
    MID:  ['tech','pass','illusion'],
    FWD:  ['illusion','fire','tech'],
  },
  brumefer: {
    GK:   ['main','peaupierre'],
    DEF:  ['peaupierre','shield','tacle_mauvais'],
    MID:  ['shield','soin','pass'],
    FWD:  ['tech','fire','soin'],
  },
  // Sélection nationale / défaut : les prédilections nationales sobres.
  _default: {
    GK:   ['main','shield'],
    DEF:  ['shield','pass'],
    MID:  ['tech','pass'],
    FWD:  ['tech','illusion','fire'],
  },
};

// Poste → groupe de sorts (aligné sur ROLE_GROUP de tactics.js, simplifié).
function _presetPosGroup(pos){
  if(pos==='GB'||pos==='GK') return 'GK';
  if(/^(DC|DD|DG|DCD|DCG|LB|RB|FIXO|MDC)/.test(pos)) return 'DEF';
  if(/^(MC|MCD|MCG|MO|MOG|MOD|AG|AD|ALA)/.test(pos)) return 'MID';
  return 'FWD';
}

// Tactique préfaite selon région + niveau (strats 7v7 valides : 321/231/222/133).
function _presetStratFor(region,tier){
  if(tier==='national_team') return '231';            // sélection : jeu ambitieux
  if(region==='valcourt')    return '231';            // capitale offensive
  if(region==='brumefer')    return '321';            // bloc bas, solide
  return '321';
}

// Attribue sorts + tactique à une équipe preset (renvoie une copie enrichie).
// N'écrase PAS des sorts déjà écrits explicitement dans la définition.
function _enrichPresetTeam(preset){
  const region=(preset.region||'').toLowerCase();
  const tier=preset.tier||'pro';
  const pool=_PRESET_SPELL_POOL[region]||_PRESET_SPELL_POOL._default;
  const density=_spellDensityForTier(tier);
  const roster=(preset.players||[]);

  // Classe les joueurs par "magabilité" déterministe (hash) pondérée par poste :
  // les joueurs créatifs/offensifs (MID/FWD) portent plus souvent la magie, sans
  // pour autant exclure un gardien ou un défenseur emblématique.
  const posWeight={ FWD:0.30, MID:0.22, DEF:0.05, GK:0.10 };
  const ranked=roster.map((pl,idx)=>{
    const grp=_presetPosGroup(pl.pos);
    const base=_presetHash(preset.presetId+'|'+pl.name+'|'+pl.pos);
    return { idx, score: base*0.7 + (posWeight[grp]||0.1) };
  }).sort((a,b)=>b.score-a.score);
  const chosen=new Set(ranked.slice(0,density).map(r=>r.idx));

  const players=roster.map((pl,idx)=>{
    // Race : cosmopolite (~40% non-humains), pondérée par région, déterministe.
    // Respecte une race déjà définie à la main.
    const withRace = pl.race ? pl : {
      ...pl,
      race:(typeof pickRaceForRegion==='function')
        ? pickRaceForRegion(region, preset.presetId+'|'+pl.name+'|race')
        : 'human'
    };
    // Respecte un sort déjà défini à la main.
    if(withRace.spells && withRace.spells.length) return withRace;
    if(!chosen.has(idx)) return withRace;
    const grp=_presetPosGroup(withRace.pos);
    const opts=pool[grp]||pool.MID||['tech'];
    const pick=opts[Math.floor(_presetHash(withRace.name+'|'+withRace.pos+'|'+preset.presetId)*opts.length)]||opts[0];
    return { ...withRace, spells:[pick] };
  });

  // La strat régionale remplace le '321' générique par défaut, mais respecte
  // toute strat non-321 explicitement choisie dans la définition du preset.
  const strat = (!preset.strat || preset.strat==='321')
    ? _presetStratFor(region,tier)
    : preset.strat;
  return { ...preset, players, strat };
}

// Équipes de la nation VALORIA (voir valoria.js) : humaine, cosmopolite, deux
// régions (Valcourt la capitale, Brumefer le bassin industriel meurtri) et une
// seule ligue pro, la Ligue Valorienne. Les "pays" du sélecteur sont les
// régions ; noms de clubs et de joueurs tirés du lore valorien.
const PRESET_TEAMS = [

  // ── VALCOURT (capitale cosmopolite) · Ligue Valorienne ─────────────────
  // RC Valcourt : grand club ambitieux de la capitale.
  {
    presetId:'rc_valcourt', name:'RC Valcourt', color:'#2e8b8b',
    nation:'Valoria', region:'Valcourt', tier:'pro',
    country:'Valoria', kind:'club', league:'Ligue Valorienne', strat:'321',
    badge:{shape:'shield_mod',border:'gold',background:'half_l',colors:['#2e8b8b','#f5f5f5','#ffd700'],icon:'griffin',iconColor:'#ffd700',iconY:-8,text:'RCV',year:'1922',stars:2,bgOpacity:1},
    players:[
      _mk('Yuki','GB',[64,32,74,80,60,70]),
      _mk('Marko','DC',[70,44,80,82,64,72]),
      _mk('Diego','DD',[82,50,68,80,72,64]),
      _mk('Rui','DG',[81,48,68,80,70,64]),
      _mk('Amir','MDC',[74,58,72,86,80,70]),
      _mk('Sofia','MC',[78,72,56,82,86,60]),
      _mk('Lena','ATT',[87,85,42,80,82,56]),
    ],
    bench:[
      _mk('Nadia','GB',[60,28,70,78,56,66]),
      _mk('Tariq','DC',[68,42,76,80,60,68]),
      _mk('Elias','DD',[76,44,64,78,64,60]),
      _mk('Nina','MC',[74,66,54,80,80,58]),
      _mk('Vera','ATT',[82,78,40,76,74,52]),
    ],
    reserves:[
      _mk('Omar','MDC',[70,52,68,82,72,66]),
      _mk('Kofi','DG',[75,42,60,76,60,56]),
      _mk('Sami','DC',[64,40,72,78,58,66]),
    ],
  },
  // AS Horizon : le club de ton histoire — jadis respecté, ruiné par la guerre,
  // aujourd'hui modeste mais fier. Effectif volontairement plus faible.
  {
    presetId:'as_horizon', name:'AS Horizon', color:'#c0392b',
    nation:'Valoria', region:'Valcourt', tier:'pro',
    country:'Valoria', kind:'club', league:'Ligue Valorienne', strat:'321',
    badge:{shape:'shield_fr',border:'vintage',background:'solid',colors:['#c0392b','#f8e9d6','#e8c547'],icon:'phoenix',iconColor:'#e8c547',iconY:-6,text:'ASH',year:'1901',stars:1,bgOpacity:1},
    players:[
      _mk('Elias','GB',[58,28,66,76,54,64]),
      _mk('Tariq','DC',[62,40,70,78,56,66]),
      _mk('Kofi','DD',[74,44,60,76,60,58]),
      _mk('Milan','DG',[73,42,60,74,58,58]),
      _mk('Omar','MDC',[66,48,64,80,64,64]),
      _mk('Ines','MC',[70,58,52,76,70,54]),
      _mk('Sami','ATT',[80,72,40,74,68,52]),
    ],
    bench:[
      _mk('Rui','GB',[54,26,62,74,50,60]),
      _mk('Amir','DC',[60,38,66,76,54,62]),
      _mk('Ines','DG',[70,40,56,72,56,54]),
      _mk('Kofi','MC',[66,54,50,74,62,52]),
      _mk('Milan','ATT',[74,66,38,72,62,48]),
    ],
    reserves:[
      _mk('Sami','MDC',[62,46,58,74,58,56]),
      _mk('Nadia','DD',[68,40,58,72,54,54]),
      _mk('Tariq','ATT',[72,64,38,70,60,48]),
    ],
  },

  // ── BRUMEFER (bassin industriel meurtri) · Ligue Valorienne ────────────
  // FC Brumefer : dur au mal, bloc bas, joueurs forgés par l'adversité.
  {
    presetId:'fc_brumefer', name:'FC Brumefer', color:'#7a5c3a',
    nation:'Valoria', region:'Brumefer', tier:'pro',
    country:'Valoria', kind:'club', league:'Ligue Valorienne', strat:'321',
    badge:{shape:'shield_en',border:'thick',background:'hstripes',colors:['#7a5c3a','#2e2e2e','#c9a227'],icon:'bear',iconColor:'#c9a227',iconY:-6,text:'FCB',year:'1898',stars:0,bgOpacity:1},
    players:[
      _mk('Viktor','GB',[60,30,76,84,52,76]),
      _mk('Dragan','DC',[64,42,84,88,54,80]),
      _mk('Stefan','DD',[76,46,74,84,58,72]),
      _mk('Radek','DG',[75,44,74,84,56,72]),
      _mk('Kasimir','MDC',[68,54,78,90,64,76]),
      _mk('Bruno','MC',[72,66,64,86,72,68]),
      _mk('Mira','ATT',[82,80,48,82,72,64]),
    ],
    bench:[
      _mk('Petra','GB',[56,28,72,84,50,76]),
      _mk('Anton','DC',[62,40,80,86,52,78]),
      _mk('Yara','DD',[72,42,72,82,54,70]),
      _mk('Selim','MC',[68,58,62,84,66,66]),
      _mk('Bruno','ATT',[78,74,52,82,66,66]),
    ],
    reserves:[
      _mk('Radek','DG',[70,42,70,82,52,68]),
      _mk('Kasimir','MDC',[66,52,74,88,62,74]),
      _mk('Mira','DC',[62,40,78,86,50,76]),
    ],
  },

  // ── SÉLECTION NATIONALE · Valoria ──────────────────────────────────────
  {
    presetId:'sel_valoria', name:'Sélection de Valoria', color:'#1f6f6f',
    nation:'Valoria', region:null, tier:'national_team',
    country:'Valoria', kind:'nation', league:'Sélections', strat:'321',
    badge:{shape:'circle_dbl',border:'gold',background:'quarters',colors:['#1f6f6f','#ffffff','#ffd700'],icon:'star',iconColor:'#ffd700',iconY:-6,text:'VAL',year:'',stars:0,bgOpacity:1},
    players:[
      _mk('Yuki','GB',[66,34,78,84,62,76]),
      _mk('Dragan','DC',[72,46,86,88,60,80]),
      _mk('Diego','DD',[84,52,72,84,74,68]),
      _mk('Rui','DG',[84,50,72,84,72,68]),
      _mk('Amir','MDC',[76,60,78,90,82,74]),
      _mk('Sofia','MC',[80,74,60,84,88,62]),
      _mk('Lena','ATT',[90,88,44,82,84,60]),
    ],
    bench:[
      _mk('Petra','GB',[64,32,76,84,58,74]),
      _mk('Marko','DC',[72,44,82,86,62,74]),
      _mk('Rui','DG',[80,48,70,82,68,64]),
      _mk('Sofia','MC',[78,72,58,82,86,60]),
      _mk('Mira','ATT',[84,82,46,80,74,62]),
    ],
    reserves:[
      _mk('Bruno','MDC',[74,60,72,86,76,70]),
      _mk('Diego','DD',[82,50,70,82,72,64]),
      _mk('Nina','MC',[76,68,56,80,82,58]),
    ],
  },

];

// ── INJECTION DANS LE REGISTRE ─────────────────────────────────────────
// Convertit un preset au format serialisé attendu par savedTeams, avec les
// champs runtime complétés. On réutilise serializePlayer si dispo (source de
// vérité du format), sinon on complète à la main.
function _presetToSavedTeam(rawPreset){
  const preset=_enrichPresetTeam(rawPreset);
  const toPlayer = (pl, idx, onBench) => {
    const base = {
      id: preset.presetId+'_'+idx,
      name: pl.name, pos: pl.pos,
      ini: (pl.name||'').slice(0,2).toUpperCase(),
      img:'', s:{...pl.s}, spells:[...(pl.spells||[])], onBench:!!onBench,
    };
    if(typeof serializePlayer==='function'){
      const sp=serializePlayer(base); sp.onBench=!!onBench; return sp;
    }
    return Object.assign(base,{x:0,y:0,vx:0,vy:0,tx:0,ty:0,hp:100,mp:100,yc:0,red:false,stunT:0,hasBall:false,injLevel:0,injT:0});
  };
  let idc=0;
  const players  = (preset.players||[]).map(pl=>toPlayer(pl, idc++, false));
  const bench    = (preset.bench||[]).map(pl=>toPlayer(pl, idc++, true));
  const reserves = (preset.reserves||[]).map(pl=>toPlayer(pl, idc++, true));
  return {
    name: preset.name, color: preset.color, img: preset.img||'', badge: preset.badge||null, strat: preset.strat||'321',
    players, bench, reserves,
    isHuman: false,           // équipes PNJ par défaut (sélectionnables comme adversaire)
    _preset: true, _presetId: preset.presetId,
    // Métadonnées de filtrage pour l'onglet sélecteur
    country: preset.country, kind: preset.kind, league: preset.league,
    nation: preset.nation||preset.country, region: preset.region||null, tier: preset.tier||'pro',
  };
}

// Injecte les presets manquants dans savedTeams et RESYNCHRONISE ceux qui
// existent déjà (si leur définition a changé : nom, effectif, région…). Retire
// aussi les anciens presets qui n'existent plus dans PRESET_TEAMS. Idempotent.
// À appeler APRÈS loadSavedTeams(). Ne touche jamais aux équipes du joueur.
function injectPresetTeams(){
  if(typeof savedTeams==='undefined' || !Array.isArray(savedTeams)) return;
  const validIds = new Set(PRESET_TEAMS.map(p=>p.presetId));
  let changed=false;
  // 1) Purger les presets obsolètes (supprimés du code).
  for(let i=savedTeams.length-1;i>=0;i--){
    const t=savedTeams[i];
    if(t && t._preset && !validIds.has(t._presetId)){ savedTeams.splice(i,1); changed=true; }
  }
  // 2) Ajouter/mettre à jour chaque preset courant.
  PRESET_TEAMS.forEach(preset=>{
    const idx = savedTeams.findIndex(t=>t && t._presetId===preset.presetId);
    const fresh = _presetToSavedTeam(preset);
    if(idx<0){ savedTeams.push(fresh); changed=true; }
    else {
      // Resync : on écrase les données du preset MAIS on préserve l'UID stable
      // et l'éventuel flag isHuman choisi par le joueur.
      const prev=savedTeams[idx];
      savedTeams[idx]=Object.assign(fresh, {
        _uid: prev._uid,
        isHuman: (typeof prev.isHuman==='boolean') ? prev.isHuman : fresh.isHuman,
      });
      changed=true;
    }
  });
  if(changed && typeof persistSavedTeams==='function'){
    try{ persistSavedTeams(); }catch(e){}
  }
  return changed;
}

// Liste des presets pour l'UI (métadonnées uniquement, pas les effectifs).
function presetCatalog(){
  return PRESET_TEAMS.map(p=>({
    presetId:p.presetId, name:p.name, color:p.color,
    country:p.country, kind:p.kind, league:p.league,
    nation:p.nation||p.country, region:p.region||null, tier:p.tier||'pro',
  }));
}

// Exposer en global (chargé comme les autres fichiers du projet).
if(typeof window!=='undefined'){
  window.PRESET_TEAMS = PRESET_TEAMS;
  window.injectPresetTeams = injectPresetTeams;
  window.presetCatalog = presetCatalog;
  window._presetToSavedTeam = _presetToSavedTeam;
  window._enrichPresetTeam = _enrichPresetTeam;
}
