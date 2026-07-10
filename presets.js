// ═══════════════════════════════════════════════════════════
// PRESETS.JS — Équipes préenregistrées (effectifs fixes)
// ═══════════════════════════════════════════════════════════
// Des équipes livrées AVEC le jeu, à effectif FIXE (mêmes joueurs à chaque
// fois), sélectionnables via un onglet filtrable par pays / type (club ou
// sélection nationale) / ligue — façon FIFA/PES.
//
// Ces équipes s'injectent dans le registre existant (savedTeams / localStorage
// 'footsim7v7_roster') au chargement, sans écraser les équipes créées par le
// joueur. Elles portent un drapeau _preset:true et un _presetId stable pour
// pouvoir les reconnaître / re-synchroniser.
//
// FORMAT (aligné sur serializeTeam/serializePlayer de ui.js) :
//   { presetId, name, color, country, kind:'club'|'nation', league, strat,
//     players:[ {name,pos,s:{spd,sht,def,stam,tec,res},spells?} x7 ] }
// Les champs runtime (x,y,hp,mp…) sont complétés à l'injection.
// ═══════════════════════════════════════════════════════════

// Petit helper interne pour écrire les joueurs de façon compacte :
// mk(nom, poste, [spd,sht,def,stam,tec,res], [sorts?])
function _mk(name, pos, [spd,sht,def,stam,tec,res], spells){
  return { name, pos, s:{spd,sht,def,stam,tec,res}, spells:spells||[] };
}

// Un 7v7 = 1 GB + 6 champ (formation 3-2-1 : GB, DC, DD, DG, MDC, MC, ATT).
// Équipes de la nation VALORIA (voir valoria.js) : humaine, cosmopolite, deux
// régions (Valcourt la capitale, Brumefer le bassin industriel meurtri) et une
// seule ligue pro, la Ligue Valorienne. Les "pays" du sélecteur sont les
// régions ; noms de clubs et de joueurs tirés du lore valorien.
const PRESET_TEAMS = [

  // ── VALCOURT (capitale cosmopolite) · Ligue Valorienne ─────────────────
  // RC Valcourt : grand club ambitieux de la capitale.
  {
    presetId:'rc_valcourt', name:'RC Valcourt', color:'#2e8b8b',
    country:'Valcourt', kind:'club', league:'Ligue Valorienne', strat:'321',
    players:[
      _mk('Yuki','GB',[64,32,74,80,60,70]),
      _mk('Marko','DC',[70,44,80,82,64,72]),
      _mk('Diego','DD',[82,50,68,80,72,64]),
      _mk('Rui','DG',[81,48,68,80,70,64]),
      _mk('Amir','MDC',[74,58,72,86,80,70]),
      _mk('Sofia','MC',[78,72,56,82,86,60]),
      _mk('Lena','ATT',[87,85,42,80,82,56]),
    ],
  },
  // AS Horizon : le club de ton histoire — jadis respecté, ruiné par la guerre,
  // aujourd'hui modeste mais fier. Effectif volontairement plus faible.
  {
    presetId:'as_horizon', name:'AS Horizon', color:'#c0392b',
    country:'Valcourt', kind:'club', league:'Ligue Valorienne', strat:'321',
    players:[
      _mk('Elias','GB',[58,28,66,76,54,64]),
      _mk('Tariq','DC',[62,40,70,78,56,66]),
      _mk('Kofi','DD',[74,44,60,76,60,58]),
      _mk('Milan','DG',[73,42,60,74,58,58]),
      _mk('Omar','MDC',[66,48,64,80,64,64]),
      _mk('Ines','MC',[70,58,52,76,70,54]),
      _mk('Sami','ATT',[80,72,40,74,68,52]),
    ],
  },

  // ── BRUMEFER (bassin industriel meurtri) · Ligue Valorienne ────────────
  // FC Brumefer : dur au mal, bloc bas, joueurs forgés par l'adversité.
  {
    presetId:'fc_brumefer', name:'FC Brumefer', color:'#7a5c3a',
    country:'Brumefer', kind:'club', league:'Ligue Valorienne', strat:'321',
    players:[
      _mk('Viktor','GB',[60,30,76,84,52,76]),
      _mk('Dragan','DC',[64,42,84,88,54,80]),
      _mk('Stefan','DD',[76,46,74,84,58,72]),
      _mk('Radek','DG',[75,44,74,84,56,72]),
      _mk('Kasimir','MDC',[68,54,78,90,64,76]),
      _mk('Bruno','MC',[72,66,64,86,72,68]),
      _mk('Mira','ATT',[82,80,48,82,72,64]),
    ],
  },

  // ── SÉLECTION NATIONALE · Valoria ──────────────────────────────────────
  {
    presetId:'sel_valoria', name:'Sélection de Valoria', color:'#1f6f6f',
    country:'Valoria', kind:'nation', league:'Sélections', strat:'321',
    players:[
      _mk('Yuki','GB',[66,34,78,84,62,76]),
      _mk('Dragan','DC',[72,46,86,88,60,80]),
      _mk('Diego','DD',[84,52,72,84,74,68]),
      _mk('Rui','DG',[84,50,72,84,72,68]),
      _mk('Amir','MDC',[76,60,78,90,82,74]),
      _mk('Sofia','MC',[80,74,60,84,88,62]),
      _mk('Lena','ATT',[90,88,44,82,84,60]),
    ],
  },

];

// ── INJECTION DANS LE REGISTRE ─────────────────────────────────────────
// Convertit un preset au format serialisé attendu par savedTeams, avec les
// champs runtime complétés. On réutilise serializePlayer si dispo (source de
// vérité du format), sinon on complète à la main.
function _presetToSavedTeam(preset){
  const toPlayer = (pl, idx) => {
    const base = {
      id: preset.presetId+'_'+idx,
      name: pl.name, pos: pl.pos,
      ini: (pl.name||'').slice(0,2).toUpperCase(),
      img:'', s:{...pl.s}, spells:[...(pl.spells||[])], onBench:false,
    };
    if(typeof serializePlayer==='function'){
      // Passe par le sérialiseur officiel pour hériter de tous les champs
      // runtime (hp, mp, timers…) et rester aligné si le format évolue.
      return serializePlayer(base);
    }
    return Object.assign(base,{x:0,y:0,vx:0,vy:0,tx:0,ty:0,hp:100,mp:100,yc:0,red:false,stunT:0,hasBall:false,injLevel:0,injT:0});
  };
  return {
    name: preset.name, color: preset.color, img: preset.img||'', strat: preset.strat||'321',
    players: preset.players.map(toPlayer),
    bench: [], reserves: [],
    isHuman: false,           // équipes PNJ par défaut (sélectionnables comme adversaire)
    _preset: true, _presetId: preset.presetId,
    // Métadonnées de filtrage pour l'onglet sélecteur
    country: preset.country, kind: preset.kind, league: preset.league,
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
  }));
}

// Exposer en global (chargé comme les autres fichiers du projet).
if(typeof window!=='undefined'){
  window.PRESET_TEAMS = PRESET_TEAMS;
  window.injectPresetTeams = injectPresetTeams;
  window.presetCatalog = presetCatalog;
  window._presetToSavedTeam = _presetToSavedTeam;
}
