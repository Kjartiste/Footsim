// ═══════════════════════════════════════════════════
// SAVE.JS — Sauvegarde, carrière, import/export
// ═══════════════════════════════════════════════════

// ═══════════════════════════════════════════════════
// SYSTÈME DE PROFILS
// Structure :
// profiles = {
//   'pid_xxx': {
//     id, name, avatar, created, lastPlayed,
//     cups:    { 'cup_xxx': {...}, ... },
//     leagues: { 'league_xxx': {...}, ... },
//     careers: { 'career_xxx': {...}, ... },
//   }
// }
// ═══════════════════════════════════════════════════

let profiles = {};          // tous les profils
let activeProfileId = null; // profil actif

const _genId = (prefix) => prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);

// ── Persistance profils ───────────────────────────────────────────────
// Passe par SaveCore (versioning + backup + récupération) quand disponible,
// avec repli sur _safeLSSet pour compatibilité.
function saveProfiles(){
  if(typeof SaveCore !== 'undefined'){
    SaveCore.store('footsim_profiles', profiles);
    SaveCore.store('footsim_activeProfile', {id: activeProfileId});
  } else {
    _safeLSSet('footsim_profiles', profiles);
    _safeLSSet('footsim_activeProfile', {id: activeProfileId});
  }
}

function loadProfiles(){
  // 1) Nouveau format versionné via SaveCore (inclut la récupération backup).
  if(typeof SaveCore !== 'undefined'){
    const p = SaveCore.load('footsim_profiles', null);
    if(p && typeof p === 'object'){ profiles = p; }
    const a = SaveCore.load('footsim_activeProfile', null);
    if(a && a.id){ activeProfileId = a.id; }
    if(profiles && Object.keys(profiles).length) return;
  }
  // 2) Repli : ancien format brut (migration transparente d'une save existante).
  try {
    const d = localStorage.getItem('footsim_profiles');
    if(d) profiles = JSON.parse(d) || {};
  } catch(e){ profiles = profiles || {}; }
  try {
    const a = localStorage.getItem('footsim_activeProfile');
    if(a){ const p = JSON.parse(a); activeProfileId = p?.id || activeProfileId || null; }
  } catch(e){ activeProfileId = activeProfileId || null; }
}

// ── Profil actif ──────────────────────────────────────────────────────
function activeProfile(){
  return activeProfileId ? profiles[activeProfileId] : null;
}

// ── Créer un profil ───────────────────────────────────────────────────
function createProfile(name, avatar='⚽'){
  const id = _genId('pid');
  profiles[id] = {
    id,
    name: name || 'Profil ' + (Object.keys(profiles).length + 1),
    avatar,
    created: new Date().toISOString(),
    lastPlayed: new Date().toISOString(),
    cups: {},
    leagues: {},
    careers: {},
  };
  saveProfiles();
  return id;
}

// ── Supprimer un profil ───────────────────────────────────────────────
function deleteProfile(pid){
  if(!profiles[pid]) return;
  delete profiles[pid];
  if(activeProfileId === pid) activeProfileId = null;
  saveProfiles();
}

// ── Sélectionner un profil ────────────────────────────────────────────
function selectProfile(pid){
  if(!profiles[pid]) return false;
  activeProfileId = pid;
  profiles[pid].lastPlayed = new Date().toISOString();
  // Charger les états dans les variables globales selon le dernier actif
  _syncGlobalsFromProfile(pid);
  saveProfiles();
  return true;
}

// ── Synchroniser les variables globales depuis le profil ──────────────
function _syncGlobalsFromProfile(pid){
  const p = profiles[pid];
  if(!p) return;
  // Restaurer le dernier cup/league/career actif si il y en a un
  const lastCupId = p._lastActiveCup;
  const lastLeagueId = p._lastActiveLeague;
  const lastCareerId = p._lastActiveCareer;
  if(lastCupId && p.cups[lastCupId]) cupState = p.cups[lastCupId].state;
  if(lastLeagueId && p.leagues[lastLeagueId]) leagueState = p.leagues[lastLeagueId].state;
  if(lastCareerId && p.careers[lastCareerId]) careerV2 = p.careers[lastCareerId].state;
}

// ── Sauvegarder une compétition dans le profil actif ─────────────────
function saveCompetition(type, id, state, name){
  const p = activeProfile();
  if(!p){ logEvent('❌ Aucun profil actif','#e02030'); return null; }
  const key = id || _genId(type);
  p[type+'s'][key] = {
    id: key,
    name: name || key,
    savedAt: new Date().toISOString(),
    state: JSON.parse(JSON.stringify(state)), // deep clone
  };
  p['_lastActive'+_capitalize(type)] = key;
  saveProfiles();
  return key;
}

// ── Charger une compétition depuis le profil ─────────────────────────
function loadCompetition(type, id){
  const p = activeProfile();
  if(!p) return null;
  const entry = p[type+'s']?.[id];
  if(!entry) return null;
  p['_lastActive'+_capitalize(type)] = id;
  saveProfiles();
  return entry.state;
}

// ── Supprimer une compétition ─────────────────────────────────────────
function deleteCompetition(type, id){
  const p = activeProfile();
  if(!p) return;
  delete p[type+'s']?.[id];
  saveProfiles();
}

// ── Lister les compétitions d'un profil ──────────────────────────────
function listCompetitions(type, pid){
  const p = pid ? profiles[pid] : activeProfile();
  if(!p) return [];
  return Object.values(p[type+'s'] || {});
}

// ── Wrappers pratiques ────────────────────────────────────────────────
function saveCupToProfile(name){
  if(!cupState){ logEvent('❌ Aucune coupe en cours','#e02030'); return; }
  const id = activeProfile()?._lastActiveCup || null;
  const key = saveCompetition('cup', id, cupState, name || 'Coupe');
  logEvent(`💾 Coupe sauvegardée : "${name || 'Coupe'}"`, '#18c860');
  return key;
}

function saveLeagueToProfile(name){
  if(!leagueState){ logEvent('❌ Aucune ligue en cours','#e02030'); return; }
  const id = activeProfile()?._lastActiveLeague || null;
  const key = saveCompetition('league', id, leagueState, name || 'Ligue');
  logEvent(`💾 Ligue sauvegardée : "${name || 'Ligue'}"`, '#18c860');
  return key;
}

function saveCareerToProfile(){
  if(!careerV2){ logEvent('❌ Aucune carrière en cours','#e02030'); return; }
  const id = activeProfile()?._lastActiveCareer || null;
  const club = careerV2.club?.name || 'Carrière';
  const key = saveCompetition('career', id, careerV2, club);
  logEvent(`💾 Carrière sauvegardée : "${club}"`, '#18c860');
  return key;
}

// ── Helper ────────────────────────────────────────────────────────────
function _capitalize(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

// ── Taille estimée d'un profil ────────────────────────────────────────
function _profileSize(pid){
  const p = profiles[pid];
  if(!p) return 0;
  const json = JSON.stringify(p);
  return json.length; // bytes approximatifs
}

function _fmtSize(bytes){
  if(bytes > 1000000) return (bytes/1000000).toFixed(1)+' MB';
  if(bytes > 1000) return (bytes/1000).toFixed(0)+' KB';
  return bytes+' B';
}

// ═══════════════════════════════════════════════════
// CARRIÈRE V2 — Manager & Dirigeant
// ═══════════════════════════════════════════════════

let careerV2 = null; // état complet de la carrière V2

function saveCareerV2(){
  saveCareerToProfile();
  // Fallback legacy
  _safeLSSet('footsim_careerV2', careerV2);
}

function loadCareerV2(){
  // Essayer d'abord depuis le profil actif
  const p = activeProfile();
  if(p?._lastActiveCareer){
    const state = loadCompetition('career', p._lastActiveCareer);
    if(state){ careerV2 = state; return; }
  }
  // Fallback legacy
  try {
    const d = localStorage.getItem('footsim_careerV2');
    if(d) careerV2 = JSON.parse(d);
  } catch(e){ careerV2 = null; }
}

// ── ÉQUIPES RÉSERVES AFFILIÉES (générique) ────────────────────────────────
// Construit careerV2.affiliates. Générique : pour le Pilier, on pré-remplit
// avec les autres branches de la Maison du club (Secundus = réserve, Academia
// = U23…), chacune dans SA division avec un effectif généré à son niveau. Pour
// les autres nations, aucune affiliée n'est créée ici (le joueur pourra en
// créer une à la main plus tard, même structure).
function _buildAffiliate(name, color, badge, level, divisionName, role, nationId, regionId){
  let squad = { players:[], bench:[], reserves:[] };
  try{
    squad = WORLDS.generateSquad(nationId, regionId, {
      positions: ['GB','DC','DD','DG','MC','MC','ATT'],
      bench: ['GB','DC','MC','ATT'],
      reserves: [],
      level: level,
    }) || squad;
  }catch(e){ console.error('generateSquad affiliate:',e); }
  return {
    id: 'aff_'+name.replace(/[^a-z0-9]/gi,'').slice(0,14)+'_'+Math.random().toString(36).slice(2,6),
    name, color, badge: badge||null,
    level, division: divisionName||'', role: role||'reserve',
    delegated: true,
    players: squad.players||[],
    bench: squad.bench||[],
    fixtures: [], standings: [],
    season_stats: { wins:0, draws:0, losses:0, goals_for:0, goals_against:0, points:0 },
  };
}

const _BRANCH_ROLE = { Secundus:'réserve', Academia:'U23 / académie', Custodes:'réserve défensive',
  Ferrum:'réserve', Sanctum:'réserve', Nova:'nouvelle branche', Ordo:'réserve', Legio:'réserve',
  Vigilia:'réserve', Mercatoria:'réserve', Excelsior:'réserve élite' };

function _buildAffiliates(clubName, nationId){
  if(!careerV2) return;
  careerV2.affiliates = careerV2.affiliates || [];
  if(nationId==='pilier' && typeof PILIER_TEAMS!=='undefined'){
    const me = PILIER_TEAMS.find(t=>t.name===clubName);
    if(!me || !me.house) return;
    const siblings = PILIER_TEAMS.filter(t=>t.house===me.house && t.name!==clubName);
    const divMap = (typeof PILIER_DIVISIONS!=='undefined') ? PILIER_DIVISIONS : {};
    const regionId = careerV2.club.region;
    siblings.forEach(function(sib){
      const divName = (divMap[sib.division] ? divMap[sib.division].name : '');
      const role = _BRANCH_ROLE[sib.branch] || 'réserve';
      const aff = _buildAffiliate(sib.name, sib.color, sib.badge, sib.level||'dh', divName, role, nationId, regionId);
      aff.house = me.house; aff.branch = sib.branch;
      careerV2.affiliates.push(aff);
    });
    if(careerV2.affiliates.length){
      careerV2.house = me.house;
      logEvent('🏛 Maison '+me.house+' : '+careerV2.affiliates.length+' équipes réserves rattachées.', careerV2.club.color);
      try{ if(typeof _setupHouseCup==='function') _setupHouseCup(); }catch(e){ console.error('housecup setup:',e); }
    }
  }
}

// ── Initialisation Carrière Dirigeant ────────────────────────────────
function startCareerDirector(regionId, clubId, nationId){
  nationId = nationId || 'panthalassa';
  const region = WORLDS.getRegion(nationId, regionId);
  if(!region){ logEvent('❌ Région introuvable','#e02030'); return; }

  const clubName  = clubId || region.clubNames[0];
  const clubColor = window._careerColor || region.color;
  // Si on reprend un club existant (Valoria ou Pilier), on récupère son blason.
  let clubBadge = null;
  if(nationId==='valoria' && typeof VALORIA_TEAMS!=='undefined'){
    const vt=VALORIA_TEAMS.find(function(t){ return t.name===clubName; });
    if(vt && vt.badge) clubBadge = vt.badge;
  } else if(nationId==='pilier' && typeof PILIER_TEAMS!=='undefined'){
    const pt=PILIER_TEAMS.find(function(t){ return t.name===clubName; });
    if(pt && pt.badge) clubBadge = pt.badge;
  }
  // Niveau de départ : si on REPREND un club existant, on prend SON niveau
  // réel (sa division), pas le plus bas de la région. Sinon (club créé), on
  // démarre en bas de la pyramide régionale.
  let startLevel = region.pyramid.district_groups > 0 ? 'dh' :
                   region.pyramid.has_r3 ? 'r3' : 'r2';
  let startDivName = null;
  let startPilierDivId = null;
  if(nationId==='pilier' && typeof PILIER_TEAMS!=='undefined'){
    const pt=PILIER_TEAMS.find(function(t){ return t.name===clubName; });
    if(pt){
      if(pt.level) startLevel = pt.level;
      startPilierDivId = pt.division;
      if(typeof PILIER_DIVISIONS!=='undefined' && PILIER_DIVISIONS[pt.division]) startDivName = PILIER_DIVISIONS[pt.division].name;
    }
  } else if(nationId==='valoria' && typeof VALORIA_TEAMS!=='undefined'){
    const vt=VALORIA_TEAMS.find(function(t){ return t.name===clubName; });
    if(vt && vt.tier){
      // Mapper le tier Valoria vers un niveau moteur si dispo.
      if(typeof valoriaNormalizeLevel==='function' && vt.division) startLevel = vt.division;
    }
  }
  // ── PROFIL DE DÉPART SELON LE NIVEAU ──────────────────────────────────
  // Un grand club (D1) démarre avec un gros effectif, un vrai budget et des
  // infrastructures déjà développées ; un club de district part de rien.
  // Budgets calés sur l'ÉCHELLE RÉELLE du jeu (joueur ≈ 300-1600 pièces, effectif
  // ≈ 20k) : un géant a ~30-50k pièces, un club de district quelques centaines.
  // Budgets calés sur la NOUVELLE échelle (1 pièce ≈ 100 €). Un club de L1 doit
  // couvrir ~10 000 pièces/sem de masse salariale (~52M€/an) + transferts, d'où
  // un budget de l'ordre du million de pièces (~100-150M€). Échelonné par niveau.
  const _lvlProfile = {
    d1: { squad:18, bench:7, reserves:3, budget:1500000, infra:{stadium:4,training:4,formation:3,medical:4,scout:3}, cap:35000, staff:true },
    d2: { squad:18, bench:6, reserves:3, budget:600000,  infra:{stadium:3,training:3,formation:3,medical:3,scout:2}, cap:22000, staff:true },
    d3: { squad:17, bench:6, reserves:2, budget:220000,  infra:{stadium:3,training:2,formation:2,medical:2,scout:2}, cap:14000, staff:true },
    r1: { squad:16, bench:5, reserves:2, budget:80000,   infra:{stadium:2,training:2,formation:1,medical:2,scout:1}, cap:8000,  staff:false },
    r2: { squad:15, bench:5, reserves:2, budget:28000,   infra:{stadium:2,training:1,formation:1,medical:1,scout:1}, cap:4500,  staff:false },
    r3: { squad:14, bench:4, reserves:1, budget:9000,    infra:{stadium:1,training:1,formation:0,medical:1,scout:0}, cap:2000,  staff:false },
    dh: { squad:13, bench:4, reserves:1, budget:3000,    infra:{stadium:0,training:0,formation:0,medical:0,scout:0}, cap:800,   staff:false },
  };
  const prof = _lvlProfile[startLevel] || _lvlProfile.dh;
  // Prestige du CHAMPIONNAT (nation) : tous les pays ne se valent pas. Le Pilier
  // est un grand championnat riche ; Valoria est modeste (petits budgets), sauf
  // une poignée de clubs "cadors" qui sortent du lot.
  const _nationPrestige = { pilier:1.0, valoria:0.15, panthalassa:0.5 };
  const _eliteClubs = {
    // Clubs "cadors" d'un petit championnat : gros budget malgré la nation modeste.
    valoria: ['SC Mystère','RC Tonnerre'], // les 2 grands de la Ligue Valorienne
  };
  const natMul = _nationPrestige[nationId] != null ? _nationPrestige[nationId] : 0.5;
  const isElite = (_eliteClubs[nationId]||[]).includes(clubName);
  const eliteMul = isElite ? 2.6 : 1.0; // un cador ~2.6× un club normal du même pays
  // Variation par club (±35%), déterministe par nom.
  let _bh=2166136261>>>0; for(let i=0;i<clubName.length;i++){ _bh^=clubName.charCodeAt(i); _bh=Math.imul(_bh,16777619)>>>0; }
  const _bvar = 0.65 + ((_bh>>>0)/4294967296)*0.70; // 0.65 .. 1.35
  const budget = Math.round(prof.budget * natMul * eliteMul * _bvar / 100) * 100;

  // Effectif complet cohérent avec le niveau (postes variés, banc, réserves).
  // ── Adapter la taille au format de jeu actif ────────────────────────
  // AVANT : le profil ci-dessus (pensé pour du 11v11, jusqu'à 28 joueurs en
  // D1) était utilisé tel quel quel que soit le mode. En 7v7 ou 5v5, ça
  // faisait beaucoup trop de monde par rapport à la taille d'une équipe sur
  // le terrain (et ça épuisait le pool de prénoms de la région, d'où des
  // noms génériques). On applique désormais des MINIMUMS par format (le
  // niveau du club peut toujours amener plus de monde qu'un petit club,
  // mais jamais moins que ce plancher) :
  //   11v11 → 11 titulaires / 7 banc / 3 réservistes minimum
  //   7v7   →  7 titulaires / 5 banc / 3 réservistes minimum
  //   5v5   →  5 titulaires / 5 banc / 3 réservistes minimum
  const _mode = window.gameMode || '7v7';
  const _xiMin      = _mode==='11v11' ? 11 : _mode==='5v5' ? 5 : 7;
  const _benchMin   = _mode==='11v11' ? 7  : 5;
  const _resMin     = 3;
  const _modeScale  = _mode==='11v11' ? 1 : _mode==='5v5' ? 0.4 : 0.55;
  const squadCount    = Math.max(_xiMin + 2, Math.round(prof.squad * _modeScale));
  const benchCount    = Math.max(_benchMin, Math.round(prof.bench * _modeScale));
  const reservesCount = Math.max(_resMin, Math.round(prof.reserves * _modeScale));

  const _mkPositions = (n)=>{
    // Compo réaliste : 1 GB + défenseurs + milieux + attaquants, complétée.
    const base = ['GB','DC','DC','DD','DG','MDC','MC','MC','MOG','MOD','ATT'];
    const extra = ['DC','MC','ATT','DD','DG','GB','MDC','MOG','ATT','MC'];
    const out = base.slice();
    for(let i=0; out.length<n; i++) out.push(extra[i%extra.length]);
    return out.slice(0,n);
  };
  const squad = WORLDS.generateSquad(nationId, regionId, {
    positions: _mkPositions(squadCount),
    bench: _mkPositions(benchCount),
    reserves: _mkPositions(reservesCount),
    level: startLevel,
  });

  careerV2 = {
    type: 'director',
    nation: nationId,
    season: 1,
    week: 1,
    date: { year: 1, month: 8, day: 1 },

    club: {
      id: 'player_club',
      name: clubName,
      region: regionId,
      nation: nationId,
      color: clubColor,
      badge: clubBadge,
      level: startLevel,
      divisionName: startDivName || null,
      pilierDivId: startPilierDivId || null,
      group: 0,
      budget: budget,
      transferBudget: Math.round(budget * 0.40),
      wage_budget: Math.round(budget * 0.45),
      weekly_costs: 0,
      reputation: WORLDS.startReputation(startLevel, region),
      fanbase: _startFanbase(region),
      infra: Object.assign({ stadium:0, training:0, formation:0, medical:0, scout:0 }, prof.infra),
      sponsor: null,
      stadium_capacity: prof.cap || (500 + region.population * 100),
      staff: prof.staff ? {
        manager:{name:'Entraîneur en poste', rating:3},
        scout:{name:'Recruteur', rating:3},
        physio:{name:'Préparateur physique', rating:3},
        coach:{name:'Adjoint', rating:3},
      } : { manager:null, scout:null, physio:null, coach:null },
      board_objectives: [],
      history: [],
    },

    // Effectif complet, dimensionné selon le niveau du club
    players:  squad.players,
    bench:    squad.bench,
    reserves: squad.reserves||[],

    mercato: {
      window_open: false, window_type: null,
      transfer_list: [], incoming_offers: [], outgoing_offers: [], loan_list: [],
    },
    fixtures: [],
    season_stats: { wins:0, draws:0, losses:0, goals_for:0, goals_against:0, points:0 },
    finances: { log:[], weekly_revenue:0, weekly_costs:0, total_earned:0, total_spent:0 },
    pending_events: [],
    director_reputation: 30,
    director_name: 'Vous',
    // Équipes réserves affiliées (générique, réutilisable pour toute nation).
    // Chaque affiliée : {id,name,color,badge,level,division,delegated,players,
    // bench,fixtures,standings,...}. Pré-remplies pour le Pilier (branches de la
    // Maison) ; vides ailleurs (le joueur peut en créer via la carrière manager).
    affiliates: [],
  };

  careerV2.club.board_objectives = _generateBoardObjectives(careerV2.club);
  // Pré-remplir les réserves affiliées si le club appartient à une Maison
  // (Pilier). Générique : n'a d'effet que si des branches affiliées existent.
  try{ _buildAffiliates(clubName, nationId); }catch(e){ console.error('affiliates:',e); }
  _generateSeasonFixtures();
  _generateFreeAgents();
  _generateYouthIntake();

  // Coûts hebdomadaires initiaux
  careerV2.club.weekly_costs = _weeklyCareerCosts();

  saveCareerV2();
  logEvent('🏟 Bienvenue au ' + clubName + ' ! Saison 1 commence.', clubColor);
  renderCareerV2();
}


// ── Initialisation Carrière Manager ──────────────────────────────────
function startCareerManager(regionId, nationId){
  nationId = nationId || window._careerNation || 'panthalassa';
  const region = WORLDS.getRegion(nationId, regionId);
  if(!region){ logEvent('❌ Région introuvable','#e02030'); return; }

  careerV2 = {
    type: 'manager',
    nation: nationId,
    season: 1,
    week: 1,
    date: { year: 1, month: 8, day: 1 },

    // Le manager lui-même
    manager: {
      name: 'Vous',
      reputation: 20,          // démarre bas
      license: 'C',            // C → B → A → Pro
      nationality: regionId,
      age: 35,
      history: [],             // clubs précédents
      achievements: [],
      contract: null,          // contrat actuel
      unemployed: true,
    },

    // Club actuel (null si sans club)
    club: null,

    // Offres d'embauche disponibles
    job_offers: _generateInitialJobOffers(regionId, nationId),

    // Événements en attente
    pending_events: [],
  };

  saveCareerV2();
  renderCareerV2();
}

// ── Helpers de génération ─────────────────────────────────────────────

function _startBudget(regionId){
  return WORLDS.startBudget('panthalassa', regionId);
}

function _startReputation(regionId, level){
  return WORLDS.startReputation(level, WORLDS.getRegion('panthalassa', regionId));
}

function _startFanbase(region){
  return Math.round(100 + (region?.population||2) * 50 + Math.random() * 200);
}

function _generateStartingSquad(regionId){
  const region = WORLDS.getRegion('panthalassa', regionId);
  const positions = ['GB','DC','DD','DG','MC','MC','ATT'];
  const names = _getRegionNames(regionId);
  return positions.map((pos, i) => {
    const isHuman = region.traits?.non_siren_players && Math.random() < (region.playerProfile?.non_siren_chance||0);
    return mkPlayerFromRegion(regionId, pos, names[i] || 'Joueur '+i, isHuman);
  });
}

function _generateBench(regionId){
  const positions = ['GB','MC','ATT','DC','MC'];
  const names = _getRegionNames(regionId, 7);
  return positions.map((pos, i) => {
    const p = mkPlayerFromRegion(regionId, pos, names[i] || 'Remplaçant '+i);
    p.onBench = true;
    return p;
  });
}

function _generateReserves(regionId){
  const positions = ['MC','ATT','DC'];
  const names = _getRegionNames(regionId, 12);
  return positions.map((pos, i) => {
    const p = mkPlayerFromRegion(regionId, pos, names[i] || 'Réserviste '+i);
    p.onBench = true;
    return p;
  });
}

function _getRegionNames(regionId, offset=0){
  // Noms de sirènes/fantaisie selon la région
  const namePools = {
    thalassyr: ['Nereis','Thaleia','Calypso','Amphitrite','Galatea','Sirena','Marinella','Ondine','Undine','Nixie','Lorelei','Melusine','Morgana','Nausicaa','Thessaly'],
    'coraïrai': ['Coralie','Iridessa','Aqualina','Crystelle','Perline','Saphira','Émera','Rubine','Topaze','Diamante'],
    mai: ['Maïa','Mairelle','Maïlys','Maïwenn','Maïna','Maïté','Maïlis','Maïka','Maïken','Maïlou'],
    neria: ['Nérissa','Nereid','Mystara','Arcania','Runalia','Sigilia','Crystana','Opalina','Amethys','Saphirelle'],
    mersbenie: ['Bénie','Grâcia','Lumina','Sérena','Harmonya','Pacifica','Tranquilla','Bénédice','Grâcielle','Lumielle'],
    velmara: ['Tempêta','Foudrine','Éclairia','Tornada','Chaosa','Délira','Foufella','Impréva','Turbula','Cyclona'],
    tydai: ['Duna','Miragea','Sabline','Ventara','Errantia','Horizona','Oasine','Désertine','Nomada','Vastine'],
    iledublob: ['Solida','Défense','Rempartia','Bouclina','Fortessa','Discipla','Gardienne','Robusta','Solidine','Fermina'],
    iledazur: ['Azurina','Cosmina','Métropola','Lumina','Élégance','Prestiga','Cristallina','Céruléa','Turquoise','Saphira','Topazina','Amétrine','Opalia','Perline','Nacrine','Émera'],
    solgrath: ['Solange','Grath','Équilia','Balancia','Normala','Stabina','Classica','Régula','Solide','Standard'],
    peiryn: ['Peïra','Comtesse','Locale','Rurale','Campagne','Clocher','Village','Hameau','Bourg','Canton'],
  };
  const pool = namePools[regionId] || namePools.solgrath;
  return pool.slice(offset, offset + 15);
}

function _generateBoardObjectives(club){
  const levelObjectives = {
    dh:  [{type:'promotion', desc:'Finir dans le top 2 du groupe', reward:2000}],
    r3:  [{type:'promotion', desc:'Accéder aux play-offs de montée', reward:3000}],
    r2:  [{type:'promotion', desc:'Finir dans le top 3', reward:5000}],
    r1:  [{type:'promotion', desc:'Accéder à la D3', reward:10000}],
    d3:  [{type:'mid_table', desc:'Assurer le maintien', reward:8000}],
    d2:  [{type:'mid_table', desc:'Top 10', reward:15000}],
    d1:  [{type:'top_half', desc:'Top 8', reward:25000}],
  };
  return levelObjectives[club.level] || [{type:'survive', desc:'Survivre la saison', reward:1000}];
}

// ═══════════════════════════════════════════════════════════
// SYSTÈME ÉCONOMIQUE AMATEUR — Licences, joueurs libres, jeunes
// ═══════════════════════════════════════════════════════════

// Coûts réalistes par niveau — TOUT coûte plus cher qu'avant
const LEVEL_COSTS = {
  //          license  weeklyBase  matchCost  youth  compFee  stadiumRent
  'dh_4': { license:8,   weeklyBase:30,   matchCost:10,  youth:3,  compFee:20,  stadiumRent:15  },
  'dh_3': { license:10,  weeklyBase:40,   matchCost:15,  youth:4,  compFee:25,  stadiumRent:20  },
  'dh_2': { license:12,  weeklyBase:55,   matchCost:20,  youth:5,  compFee:30,  stadiumRent:25  },
  'dh_1': { license:15,  weeklyBase:70,   matchCost:25,  youth:6,  compFee:40,  stadiumRent:30  },
  dh:     { license:12,  weeklyBase:55,   matchCost:20,  youth:5,  compFee:30,  stadiumRent:25  },
  r3:     { license:20,  weeklyBase:150,  matchCost:50,  youth:10, compFee:80,  stadiumRent:60  },
  r2:     { license:30,  weeklyBase:300,  matchCost:100, youth:20, compFee:150, stadiumRent:120 },
  r1:     { license:50,  weeklyBase:700,  matchCost:200, youth:40, compFee:300, stadiumRent:250 },
  d3:     { license:0,   weeklyBase:3000, matchCost:600, youth:150,compFee:800, stadiumRent:0   },
  d2:     { license:0,   weeklyBase:8000, matchCost:1500,youth:300,compFee:2000,stadiumRent:0   },
  d1:     { license:0,   weeklyBase:25000,matchCost:5000,youth:800,compFee:8000,stadiumRent:0   },
};

function _weeklyCareerRevenue(){
  if(!careerV2) return 0;
  const C = careerV2;
  const club = C.club;
  const level = club.level;
  const costs = LEVEL_COSTS[level] || LEVEL_COSTS['dh'];
  const isPro = ['d1','d2','d3'].includes(level);

  let revenue = 0;

  if(!isPro){
    // Revenus licences : chaque joueur cotise
    const nbPlayers = (C.players||[]).length + (C.bench||[]).length;
    revenue += nbPlayers * costs.license;

    // Subvention municipale selon réputation
    const municipal = Math.round(costs.weeklyBase * 0.3 * (0.8 + club.reputation/500));
    revenue += municipal;

    // Petite buvette/événements (aléatoire)
    if(Math.random() < 0.3){
      revenue += Math.round(costs.weeklyBase * 0.1 * Math.random());
    }
  } else {
    // Pro : billetterie
    const attendance = Math.round(club.stadium_capacity * Math.min(1, 0.25 + club.reputation/120));
    const ticketPrice = level==='d1' ? 10 : level==='d2' ? 6 : 4;
    revenue += Math.round(attendance * ticketPrice / 4); // par semaine
    // Sponsors
    revenue += Math.round(costs.weeklyBase * 0.4);
  }

  return revenue;
}

function _weeklyCareerCosts(){
  if(!careerV2) return 0;
  const C = careerV2;
  const level = C.club.level;
  const costs = LEVEL_COSTS[level] || LEVEL_COSTS['dh'];
  const isPro = ['d1','d2','d3'].includes(level);

  let total = 0;

  // Frais fixes hebdomadaires (déplacements, admin, électricité...)
  total += costs.weeklyBase * 0.4;

  // Loyer stade (amateurs louent leur terrain à la mairie)
  total += costs.stadiumRent || 0;

  // Frais de compétition : divisés sur 8 semaines (saison ~8 semaines)
  total += Math.round((costs.compFee || 0) / 8);

  if(isPro){
    // Salaires des joueurs
    const nbP = (C.players||[]).length + (C.bench||[]).length;
    total += nbP * Math.round(costs.weeklyBase * 0.06);
  }

  // Coûts infrastructure (chaque niveau coûte plus)
  const infra = C.club.infra || {};
  Object.values(infra).forEach(function(lvl){
    total += lvl * Math.round(costs.weeklyBase * 0.08);
  });

  // Frais de match si un match du club tombe dans les 6 jours autour
  // d'aujourd'hui (basé sur la date réelle, pas le numéro de journée — les
  // trêves internationales font diverger les deux au fil de la saison).
  const nextFix = (C.fixtures||[]).find(function(f){
    return !f.played && f.date && Math.abs(_daysBetween(C.date, f.date)) <= 6;
  });
  if(nextFix) total += costs.matchCost || 0;

  return Math.round(total);
}

// ── Générer des joueurs libres locaux ──────────────────────────────────
function _generateFreeAgents(){
  if(!careerV2) return;
  const C = careerV2;
  const nation = C.nation || 'panthalassa';
  const region = C.club.region;
  const level  = C.club.level;
  const nb = 5 + Math.floor(Math.random() * 4); // 5-8 joueurs libres

  const positions = ['GB','DC','DD','DG','MC','MC','ATT','MC','ATT','DC'];
  const regionObj = WORLDS.getRegion(nation, region);
  const names = regionObj ? [...(regionObj.names||[])].sort(function(){ return Math.random()-.5; }) : [];
  let ni = 0;

  careerV2.freeAgents = [];
  for(var i = 0; i < nb; i++){
    var pos = positions[Math.floor(Math.random()*positions.length)];
    var name = names[ni++] || ('Joueur '+(i+1));
    var p = WORLDS.generatePlayer(nation, region, pos, name, level);
    if(p) careerV2.freeAgents.push(p);
  }
}

// ── Générer des jeunes du club ──────────────────────────────────────────
// Appelé en début de saison — 1-3 jeunes arrivent
// 1 chance sur 1000 qu'un jeune ait un potentiel pro exceptionnel
function _generateYouthIntake(){
  if(!careerV2) return;
  const C = careerV2;
  const nation = C.nation || 'panthalassa';
  const region = C.club.region;
  const level  = C.club.level;
  const costs  = LEVEL_COSTS[level] || LEVEL_COSTS['dh'];

  if(!C.youthPool) C.youthPool = [];

  const nb = 1 + Math.floor(Math.random() * 3); // 1-3 jeunes
  const positions = ['MC','ATT','DC','DD','DG','MC'];
  const regionObj = WORLDS.getRegion(nation, region);
  const names = regionObj ? [...(regionObj.names||[])].sort(function(){ return Math.random()-.5; }) : [];
  let ni = 0;

  for(var i = 0; i < nb; i++){
    var pos = positions[Math.floor(Math.random()*positions.length)];
    var name = names[ni++] || ('Jeune '+(i+1));

    // Stats très basses — c'est un jeune (stats DH ou en dessous)
    var p = WORLDS.generatePlayer(nation, region, pos, name, 'dh');
    if(!p) continue;

    // Potentiel : combien il pourrait atteindre au max
    var pot = 15 + Math.floor(Math.random()*30); // 15-45 par défaut (resteront amateurs)

    // 1 chance sur 200 : talent régional (potentiel R1-D3)
    if(Math.random() < 0.005){
      pot = 50 + Math.floor(Math.random()*20);
      logEvent('⭐ '+name+' montre un potentiel régional prometteur !','#f0c028');
    }

    // 1 chance sur 1000 : PÉPITE PRO
    if(Math.random() < 0.001){
      pot = 72 + Math.floor(Math.random()*18); // 72-90 — niveau pro
      p._isPotentialPro = true;
      logEvent('💎💎💎 INCROYABLE ! '+name+' est une pépite de niveau professionnel ! Un club pro va vouloir le recruter...','#9c27b0');
    }

    p._potential = pot;
    p._age = 16 + Math.floor(Math.random()*3); // 16-18 ans
    p._isYouth = true;
    C.youthPool.push(p);
  }
}

// ── Appliquer les revenus/coûts hebdomadaires ─────────────────────────
function _applyWeeklyEconomy(){
  if(!careerV2 || careerV2.type !== 'director') return;
  const C = careerV2;
  const level = C.club.level;
  const costs = LEVEL_COSTS[level] || LEVEL_COSTS['dh'];
  const isPro = ['d1','d2','d3'].includes(level);

  const rev  = _weeklyCareerRevenue();
  const cost = _weeklyCareerCosts();
  C.club.budget += rev - cost;

  if(!isPro){
    const nb = (C.players||[]).length + (C.bench||[]).length;
    const licRev = nb * costs.license;
    if(licRev > 0) _addFinanceLog('Licences ('+nb+'x'+costs.license+')', licRev);
    const munRev = rev - licRev;
    if(munRev > 0) _addFinanceLog('Subvention municipale', Math.round(munRev));
  } else {
    _addFinanceLog('Revenus (billetterie + sponsors)', rev);
  }

  const fixedCost = Math.round(costs.weeklyBase * 0.4);
  const rentCost  = costs.stadiumRent || 0;
  const compCost  = Math.round((costs.compFee||0) / 8);
  if(fixedCost > 0) _addFinanceLog('Frais fixes', -fixedCost);
  if(rentCost  > 0) _addFinanceLog('Loyer terrain', -rentCost);
  if(compCost  > 0) _addFinanceLog('Frais competition', -compCost);

  const net = rev - cost;
  if(C.club.budget < 0){
    logEvent('🚨 Budget negatif ! ('+_fmtMoney(C.club.budget)+')','#e02030');
  } else if(net < 0 && C.club.budget < Math.abs(net) * 8){
    logEvent('⚠️ Tresorerie faible.','#f0c028');
  }
}


// ── EFFECTIF D'UN CLUB ADVERSE (généré en début de saison) ────────────────
// Génère un effectif complet (titulaires + banc + réserves) pour un club NPC,
// dimensionné selon son niveau. Sert à consulter l'adversaire et de base à
// l'IA de gestion. Compact pour ne pas alourdir la sauvegarde à l'excès.
// Résout un identifiant de région tolérant : certains clubs stockent le NOM
// affiché de la région (ex: 'Le Pilier') plutôt que son id interne (ex:
// 'le_pilier'), ce qui faisait échouer WORLDS.getRegion silencieusement (→
// effectif vide). On retombe sur la correspondance par nom, puis sur l'unique
// région de la nation si elle n'en a qu'une.
function _resolveRegionId(nationId, regionIdOrName){
  const nation = WORLDS.get(nationId);
  if(!nation) return regionIdOrName;
  const regions = nation.regions || [];
  if(regions.some(r=>r.id===regionIdOrName)) return regionIdOrName;
  const byName = regions.find(r=>r.name===regionIdOrName);
  if(byName) return byName.id;
  if(regions.length===1) return regions[0].id;
  return regionIdOrName;
}

function _buildOpponentSquad(nationId, regionId, level, clubName){
  const sizeByLevel = { d1:{s:14,b:5}, d2:{s:14,b:4}, d3:{s:13,b:4}, r1:{s:12,b:4}, r2:{s:12,b:3}, r3:{s:11,b:3}, dh:{s:11,b:3} };
  const sz = sizeByLevel[level] || sizeByLevel.dh;
  const mkPos = (n)=>{ const base=['GB','DC','DC','DD','DG','MDC','MC','MC','MOG','MOD','ATT']; const extra=['DC','MC','ATT','DD','GB','MDC','MOG']; const out=base.slice(); for(let i=0;out.length<n;i++) out.push(extra[i%extra.length]); return out.slice(0,n); };
  try{
    const resolvedRegion = _resolveRegionId(nationId, regionId);
    const sq = WORLDS.generateSquad(nationId, resolvedRegion, {
      positions: mkPos(sz.s), bench: mkPos(sz.b), reserves: mkPos(3), level: level,
    });
    return { players: sq.players||[], bench: sq.bench||[], reserves: sq.reserves||[] };
  }catch(e){ console.error('opponent squad:',e); return { players:[], bench:[], reserves:[] }; }
}

// ── IA DE GESTION DES CLUBS ADVERSES (vie entre saisons) ───────────────────
// Stockage persistant des effectifs adverses, indépendant des standings (qui
// sont régénérés avec de nouveaux ids chaque saison). Clé = nom du club, ce
// qui permet de retrouver et faire évoluer le même effectif saison après
// saison au lieu de le régénérer à neuf à chaque fois.
function _getOrBuildOpponentSquad(nationId, regionId, level, clubName){
  if(!careerV2.opponentSquads) careerV2.opponentSquads = {};
  let entry = careerV2.opponentSquads[clubName];
  if(!entry || !entry.squad){
    entry = { region: regionId, level: level, squad: _buildOpponentSquad(nationId, regionId, level, clubName) };
    careerV2.opponentSquads[clubName] = entry;
  } else {
    // Garder les infos à jour (au cas où région/niveau changeraient dans les données).
    entry.region = regionId; entry.level = level;
  }
  return entry.squad;
}

// Ajuste les stats d'un joueur adverse selon son âge ET sa race : chaque
// race mûrit, culmine et décline à un rythme différent (ex : un vampire
// quasi-immortel décline très tard, un gobelin ou une fée bien plus tôt) —
// cf. RACE_AGE_PROFILES dans races.js. Purement physiologique, comme le
// reste du système de races.
function _agePlayerStats(p){
  if(!p || !p.s) return;
  const age = p.age || 20;
  const profile = (typeof raceAgeProfile==='function') ? raceAgeProfile(p.race) : null;
  let delta;
  if(!profile){
    // Repli si races.js n'est pas chargé : ancienne courbe humaine unique.
    if(age <= 20)      delta = 2 + Math.random()*3;
    else if(age <= 23) delta = 1 + Math.random()*2;
    else if(age <= 28) delta = (Math.random()-0.4) * 1.5;
    else if(age <= 31) delta = -(0.5 + Math.random()*1.5);
    else               delta = -(1.5 + Math.random()*2.5);
  } else if(age <= profile.youthEnd)      delta = 2 + Math.random()*3;
  else if(age <= profile.earlyEnd)        delta = 1 + Math.random()*2;
  else if(age <= profile.peakEnd)         delta = (Math.random()-0.4) * 1.5;
  else if(age <= profile.declineEnd)      delta = -(0.5 + Math.random()*1.5);
  else                                    delta = -(1.5 + Math.random()*2.5);
  Object.keys(p.s).forEach(function(k){
    p.s[k] = Math.max(1, Math.min(99, Math.round(p.s[k] + delta + (Math.random()-0.5)*2)));
  });
}

// Génère un joueur de remplacement (retraite ou petit mouvement de mercato)
// pour occuper la place laissée par un joueur sortant.
function _buildReplacementPlayer(nationId, regionId, level, pos, grp){
  try{
    const tier = grp==='players' ? 'starter' : grp==='bench' ? 'bench' : 'reserve';
    const resolvedRegion = _resolveRegionId(nationId, regionId);
    const region = WORLDS.getRegion(nationId, resolvedRegion);
    const names = (region && region.names) || [];
    const name = names.length ? names[Math.floor(Math.random()*names.length)] : 'Recrue';
    const p = WORLDS.generatePlayer(nationId, resolvedRegion, pos || 'MC', name, level, tier);
    if(p && tier !== 'starter') p.onBench = true;
    return p || { age:18, pos:pos||'MC', name:'Recrue', s:{tec:30,spd:30,sht:30,def:30,stam:30,res:30} };
  }catch(e){
    console.error('replacement player:', e);
    return { age:18, pos:pos||'MC', name:'Recrue', s:{tec:30,spd:30,sht:30,def:30,stam:30,res:30} };
  }
}

// Fait vivre TOUS les effectifs adverses stockés d'une saison à l'autre :
// vieillissement, progression/déclin selon l'âge, retraites en fin de
// carrière, et un peu de mouvement de mercato (quelques joueurs remplacés
// même hors retraite, pour simuler des transferts). Appelée en fin de saison,
// avant que _generateSeasonFixtures() ne régénère le calendrier.
function _evolveOpponentSquads(){
  const C = careerV2;
  if(!C || !C.opponentSquads) return;
  const nation = C.nation || 'panthalassa';
  Object.keys(C.opponentSquads).forEach(function(name){
    const entry = C.opponentSquads[name];
    if(!entry || !entry.squad) return;
    const level = entry.level, region = entry.region;
    ['players','bench','reserves'].forEach(function(grp){
      const list = entry.squad[grp];
      if(!Array.isArray(list)) return;
      for(let i = 0; i < list.length; i++){
        const p = list[i];
        if(!p) continue;
        p.age = (p.age || 20) + 1;
        // Retraite : seuils propres à la race (un vampire ou un elfe joue
        // bien plus longtemps qu'un gobelin ou une fée).
        const retireChance = (typeof raceRetireChance==='function') ? raceRetireChance(p.race, p.age)
          : (p.age>=36 ? 0.9 : p.age>=34 ? 0.45 : p.age>=32 ? 0.12 : 0);
        if(Math.random() < retireChance){
          list[i] = _buildReplacementPlayer(nation, region, level, p.pos, grp);
          continue;
        }
        _agePlayerStats(p);
        // Petit mouvement de mercato : quelques joueurs partent même sans
        // prendre leur retraite (transfert vers un autre club du monde).
        if(Math.random() < 0.06){
          list[i] = _buildReplacementPlayer(nation, region, level, p.pos, grp);
        }
      }
    });
  });
}

function _generateSeasonFixtures(){
  if(!careerV2) return;

  const club = careerV2.club;
  const nation = careerV2.nation || 'panthalassa';
  const region = WORLDS.getRegion(nation, club.region);
  const level = club.level;

  // ── CAS VALORIA : adversaires = vraies équipes de la division du joueur ──
  // On pioche dans VALORIA_TEAMS la division exacte (Pro / R1 / R2 / R3 /
  // District N / Brumefer R1-R2) au lieu de noms génériques, pour que le
  // classement reflète la structure divisionnaire mise en place.
  if(nation==='valoria' && typeof VALORIA_TEAMS!=='undefined' && typeof valoriaNormalizeLevel==='function'){
    const divId = valoriaNormalizeLevel(level, club.region);
    // Normalise aussi le club pour la cohérence (level = id Valoria).
    if(club.level!==divId) club.level=divId;
    let divTeams = (typeof valoriaTeamsByDivision==='function')
      ? valoriaTeamsByDivision(divId).filter(t=>t.name!==club.name)
      : [];
    const opponents = divTeams.map(function(vt){
      return { id:'val_'+vt.name.replace(/[^a-z0-9]/gi,'').slice(0,12)+'_'+Math.random().toString(36).slice(2,6),
        name:vt.name, color:vt.color, badge:vt.badge||null,
        level:divId, region:vt.region, valoriaName:vt.name, tier:vt.tier };
    });
    const allClubs=[{id:'player_club', name:club.name, color:club.color, badge:club.badge||null, isPlayer:true}].concat(opponents);
    careerV2.standings = allClubs.map(function(c){
      return {id:c.id, name:c.name, color:c.color, badge:c.badge||null, isPlayer:!!c.isPlayer,
              region:c.region, P:0, W:0, D:0, L:0, GF:0, GA:0, Pts:0};
    });
    _buildRoundRobinFixtures(allClubs);
    careerV2.divisionName = (typeof _valDivName==='function')?_valDivName(divId):divId;
    return;
  }

  // ── CAS PILIER : adversaires = les 20 vrais clubs de la division ─────────
  if(nation==='pilier' && typeof PILIER_TEAMS!=='undefined' && typeof pilierTeamsByDivision==='function'){
    // Retrouver la division du club joueur (par son nom).
    const me = PILIER_TEAMS.find(t=>t.name===club.name);
    const divId = me ? me.division : null;
    if(divId){
      if(club.level!==(PILIER_DIVISIONS[divId]?PILIER_DIVISIONS[divId].level:club.level)){
        club.level = PILIER_DIVISIONS[divId].level;
      }
      const divTeams = pilierTeamsByDivision(divId).filter(t=>t.name!==club.name);
      const opponents = divTeams.map(function(pt){
        const opp = { id:'pil_'+pt.name.replace(/[^a-z0-9]/gi,'').slice(0,12)+'_'+Math.random().toString(36).slice(2,6),
          name:pt.name, color:pt.color, badge:pt.badge||null,
          level:pt.level, region:pt.region, valoriaName:pt.name, tier:pt.tier };
        // Effectif complet généré une fois puis conservé/évolué saison après
        // saison (consultable + base pour l'IA de gestion adverse).
        opp.squad = _getOrBuildOpponentSquad(nation, pt.region, pt.level, pt.name);
        return opp;
      });
      const allClubs=[{id:'player_club', name:club.name, color:club.color, badge:club.badge||null, isPlayer:true}].concat(opponents);
      careerV2.standings = allClubs.map(function(c){
        return {id:c.id, name:c.name, color:c.color, badge:c.badge||null, isPlayer:!!c.isPlayer,
                region:c.region, level:c.level, squad:c.squad||null, P:0, W:0, D:0, L:0, GF:0, GA:0, Pts:0};
      });
      _buildRoundRobinFixtures(allClubs);
      careerV2.divisionName = PILIER_DIVISIONS[divId] ? PILIER_DIVISIONS[divId].name : divId;
      return;
    }
  }

  // Générer 8-12 clubs adversaires du même niveau
  const nbOpponents = level === 'dh' ? 7 : level === 'r3' ? 9 : 11;
  const clubNames = (region && region.clubNames) ? [...region.clubNames] : [];

  // Retirer le club du joueur s'il y est
  const filteredNames = clubNames.filter(function(n){ return n !== club.name; });

  // Compléter avec des noms génériques si pas assez
  const prefixes = ['FC','AS','SC','RC','US','CA','EC','AC','SK','FK'];
  const suffixes = ['United','City','Athletic','Sporting','Rovers','Town','Warriors','Stars','Eagles','Lions'];
  let idx = 0;
  while(filteredNames.length < nbOpponents){
    const pre = prefixes[idx % prefixes.length];
    const suf = suffixes[Math.floor(idx / prefixes.length) % suffixes.length];
    const num = Math.floor(idx / (prefixes.length * suffixes.length)) + 1;
    const name = pre + ' ' + suf + (num > 1 ? ' ' + num : '');
    if(!filteredNames.includes(name) && name !== club.name) filteredNames.push(name);
    idx++;
  }

  const opponents = filteredNames.slice(0, nbOpponents).map(function(name){
    return {
      id: 'ai_'+Math.random().toString(36).slice(2),
      name: name,
      level: level,
      region: club.region,
    };
  });

  // Classement initial
  const allClubs = [{id:'player_club', name:club.name, isPlayer:true}].concat(opponents);
  careerV2.standings = allClubs.map(function(c){
    return {id:c.id, name:c.name, isPlayer:!!c.isPlayer,
            P:0, W:0, D:0, L:0, GF:0, GA:0, Pts:0};
  });

  _buildRoundRobinFixtures(allClubs);
}

// ═══════════════════════════════════════════════════════════
// CALENDRIER JOUR PAR JOUR — utilitaires de dates
// ───────────────────────────────────────────────────────────
// Modèle simplifié : 12 mois de 30 jours (360 jours/an), pour éviter toute
// gestion d'années bissextiles ou de mois à durée variable. { year, month
// (1-12), day (1-30) }.
// ═══════════════════════════════════════════════════════════
function _dateKey(d){
  if(!d) return '';
  return d.year+'-'+String(d.month).padStart(2,'0')+'-'+String(d.day).padStart(2,'0');
}
function _dateToOrdinal(d){
  return (d.year||1)*360 + ((d.month||1)-1)*30 + ((d.day||1)-1);
}
function _ordinalToDate(o){
  const year = Math.floor(o/360);
  let rem = o - year*360;
  const month = Math.floor(rem/30)+1;
  const day = (rem%30)+1;
  return { year:year, month:month, day:day };
}
function _addDays(d, n){
  return _ordinalToDate(_dateToOrdinal(d) + n);
}
function _daysBetween(d1, d2){
  return _dateToOrdinal(d2) - _dateToOrdinal(d1);
}
// ── Jours de semaine ─────────────────────────────────────────────────────
// Ancrage fixe : ordinal 0 (An1, 1 Jan) tombe un Lundi. Comme le modèle de
// dates est simplifié (semaines de 7 jours continues, sans exception), cet
// ancrage suffit à donner un jour de semaine cohérent et stable à toute date.
const _WEEKDAY_NAMES = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
function _dayOfWeek(d){
  const o = _dateToOrdinal(d);
  return ((o % 7) + 7) % 7; // 0=Lundi … 5=Samedi, 6=Dimanche
}
function _dayName(d){ return _WEEKDAY_NAMES[_dayOfWeek(d)]; }
// Avance (ou reste sur place) jusqu'au prochain jour ayant le jour de semaine visé.
function _nextWeekday(d, targetDow){
  const diff = (targetDow - _dayOfWeek(d) + 7) % 7;
  return _addDays(d, diff);
}

// ── Trêves internationales / hivernale ──────────────────────────────────
// Chaque entrée { after, weeks } insère `weeks` semaines de pause AVANT la
// journée `after+1` (donc directement après la journée `after`). Calé sur un
// rythme réaliste : trêves internationales de sept/oct/nov, coupure hivernale
// des fêtes, puis trêve internationale de mars.
const INTL_BREAKS = [
  { after: 5,  weeks: 1 }, // trêve internationale (septembre)
  { after: 9,  weeks: 1 }, // trêve internationale (octobre)
  { after: 13, weeks: 1 }, // trêve internationale (novembre)
  { after: 17, weeks: 2 }, // trêve hivernale (fêtes de fin d'année)
  { after: 30, weeks: 1 }, // trêve internationale (mars)
];
function _breakWeeksBefore(matchday){
  let extra = 0;
  INTL_BREAKS.forEach(function(b){ if(matchday > b.after) extra += b.weeks; });
  return extra;
}
// Vrai si une trêve démarre juste après cette journée (utile pour l'affichage).
function _isBreakAfter(matchday){
  return INTL_BREAKS.some(function(b){ return b.after === matchday; });
}

// Date calendaire d'une journée de championnat donnée, calculée à partir de
// la date de début de saison (ancrée, ne dérive pas si C.date avance). Les
// journées tombent toujours un SAMEDI, et les trêves internationales/hivernale
// décalent le calendrier d'autant de semaines pleines (l'ancrage Samedi est
// donc toujours préservé).
function _weekDate(week){
  const C = careerV2; if(!C) return {year:1,month:8,day:1};
  const start = C.seasonStartDate || C.date || {year:1,month:8,day:1};
  const wk = Math.max(1, week);
  const extraWeeks = _breakWeeksBefore(wk);
  return _addDays(start, (wk - 1 + extraWeeks) * 7);
}
// Date d'un tour de coupe associé à la même semaine de championnat : les
// coupes se jouent en semaine, le MERCREDI (3 jours avant le samedi de ligue).
function _cupWeekDate(week){
  return _addDays(_weekDate(week), -3);
}
function _fmtDateFr(d){
  const mois = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
  return d.day + ' ' + (mois[(d.month||1)-1]||'?') + ' An' + d.year;
}
// Variante longue avec le jour de semaine — utilisée pour les échéances
// (prochain match, prochain tour de coupe...).
function _fmtDateFrLong(d){
  if(!d) return '?';
  return _dayName(d) + ' ' + _fmtDateFr(d);
}
// Vrai si deux dates tombent dans la même semaine calendaire (fenêtre de 6
// jours) — sert à détecter les semaines à double match (ligue + coupe).
function _sameCalendarWeek(d1, d2){
  if(!d1 || !d2) return false;
  return Math.abs(_daysBetween(d1, d2)) <= 6;
}

// ═══════════════════════════════════════════════════════════
// PLANNING JOUR PAR JOUR — entraînements, repos, matchs amicaux
// ───────────────────────────────────────────────────────────
// C.dayPlans = { 'Y-MM-DD': { type:'training'|'rest'|'friendly',
//                             focus:'physique'|'technique'|'tactique'|'recuperation' } }
// ═══════════════════════════════════════════════════════════
function _planDay(dateKey, type, focus){
  const C = careerV2; if(!C) return false;
  if(!C.dayPlans) C.dayPlans = {};
  // Impossible de planifier sur un jour de match déjà fixé.
  if(_matchOnDateKey(dateKey)) return false;
  C.dayPlans[dateKey] = { type: type, focus: focus||null };
  return true;
}
function _unplanDay(dateKey){
  const C = careerV2; if(!C || !C.dayPlans) return;
  delete C.dayPlans[dateKey];
}
// Renvoie la fixture du club joueur programmée à une date donnée (non jouée), s'il y en a une.
function _matchOnDateKey(dateKey){
  const C = careerV2; if(!C) return null;
  const f = (C.fixtures||[]).find(function(f){
    return !f.played && (f.homeIsPlayer||f.awayIsPlayer) && f.date && _dateKey(f.date)===dateKey;
  });
  if(f) return f;
  // Coupe : un tour de coupe impliquant le joueur peut aussi tomber ce jour-là.
  if(C.cup && !C.cup.winner && Array.isArray(C.cup.weeks)){
    const roundIdx = C.cup.round;
    if(roundIdx < C.cup.weeks.length){
      const cupWeek = C.cup.weeks[roundIdx];
      const cupDate = _cupWeekDate(cupWeek);
      if(_dateKey(cupDate)===dateKey){
        const m = (C.cup.bracket||[]).find(function(m){ return !m.played && ((m.a&&m.a.isPlayer)||(m.b&&m.b.isPlayer)); });
        if(m) return { cup:true, week:cupWeek };
      }
    }
  }
  return null;
}
// Applique les effets du plan du jour (ou repos passif par défaut) sur
// l'effectif du joueur. Retourne un message pour le journal, ou null.
function _resolveDayPlan(dateKey){
  const C = careerV2; if(!C || C.type!=='director') return null;
  const plan = (C.dayPlans && C.dayPlans[dateKey]) || { type:'rest', focus:null };
  const squad = (C.players||[]).concat(C.bench||[]).concat(C.reserves||[]);
  if(!squad.length) return null;

  if(plan.type==='training'){
    const focus = plan.focus || 'physique';
    let msg = null;
    squad.forEach(function(p){
      if(!p) return;
      // Gain de forme, plafonné à 10 (échelle -10 à +10 existante).
      const gain = focus==='recuperation' ? 0.4 : 0.8;
      p._fm = Math.min(10, (p._fm||0) + gain);
      if(focus==='recuperation' && p.injLevel>0 && p.injT>0){
        p.injT = Math.max(0, p.injT - 2); // récup accélérée
        if(p.injT===0) p.injLevel=0;
      }
      if(focus==='technique' && p.age && p.age<23 && Math.random()<0.01){
        // Petite chance de progression permanente pour les jeunes.
        const keys=['tec','sht','pas','def','spd']; const k=keys[Math.floor(Math.random()*keys.length)];
        if(p.s && typeof p.s[k]==='number'){ p.s[k]=Math.min(99,p.s[k]+1); msg=(msg?msg+' ':'')+'✨ '+p.name+' progresse ('+k+' +1) !'; }
      }
      if(focus==='physique' && Math.random()<0.015 && p.injLevel===0){
        // Petit risque de surentraînement.
        p.injLevel=1; p.injT=2+Math.floor(Math.random()*3);
        msg=(msg?msg+' ':'')+'🤕 '+p.name+' se blesse à l\'entraînement !';
      }
    });
    const focusLabel = {physique:'physique', technique:'technique', tactique:'tactique', recuperation:'récupération'}[focus]||focus;
    return '🏃 Entraînement ('+focusLabel+') effectué.' + (msg?' '+msg:'');
  }

  if(plan.type==='friendly'){
    // Petit match amical simulé rapidement (impact minime, moral au résultat).
    const strength = 0.5 + Math.random()*0.3;
    const oppStrength = 0.4 + Math.random()*0.4;
    const gf = Math.max(0, Math.round(strength*3 + Math.random()*1.5 - 1));
    const ga = Math.max(0, Math.round(oppStrength*3 + Math.random()*1.5 - 1));
    const win = gf>ga, draw=gf===ga;
    squad.forEach(function(p){
      if(!p) return;
      p._hm = Math.max(-10, Math.min(10, (p._hm||0) + (win?1.2:draw?0.3:-0.6)));
      p._fm = Math.min(10, (p._fm||0) + 0.3);
      if(Math.random()<0.01 && p.injLevel===0){ p.injLevel=1; p.injT=1+Math.floor(Math.random()*2); }
    });
    return '⚽ Match amical : '+(C.club.name)+' '+gf+'-'+ga+' (adversaire local) — '+(win?'victoire, moral en hausse !':draw?'match nul.':'défaite, léger coup au moral.');
  }

  // Repos par défaut : récupération de forme douce, soin des blessures.
  squad.forEach(function(p){
    if(!p) return;
    p._fm = Math.min(10, (p._fm||0) + 0.3);
    if(p.injLevel>0 && p.injT>0){
      p.injT = Math.max(0, p.injT-1);
      if(p.injT===0) p.injLevel=0;
    }
  });
  return null; // pas de message pour ne pas polluer le journal chaque jour de repos
}

// Construit le calendrier aller-retour (round-robin) + le journal, à partir de
// la liste de clubs (avec id/name/isPlayer). Utilise la méthode du cercle pour
// garantir un seul match par club et par semaine (donc une date calendaire
// unique et régulière par match), au lieu d'un simple appariement séquentiel.
// Partagé par les deux chemins de génération (Valoria et générique).
function _buildRoundRobinFixtures(allClubs){
  // Ancrer la date de début de saison AVANT de calculer les dates de journées.
  // On la cale sur le prochain SAMEDI (jour traditionnel des matchs de ligue),
  // pour que toutes les journées tombent un samedi tout au long de la saison.
  if(careerV2 && !careerV2.seasonStartDate){
    const base = Object.assign({}, careerV2.date || {year:1,month:8,day:1});
    careerV2.seasonStartDate = _nextWeekday(base, 5); // 5 = Samedi
  }
  let clubs = allClubs.slice();
  if(clubs.length % 2 !== 0){ clubs.push({id:'__bye__', name:'(exempt)', isPlayer:false}); }
  const n = clubs.length;
  const rounds = n - 1;
  const half = n/2;
  const fixtures = [];
  let rot = clubs.slice();
  function pushLeg(week, swapHomeAway){
    for(let i=0; i<half; i++){
      const h = rot[i], a = rot[n-1-i];
      if(h.id==='__bye__' || a.id==='__bye__') continue;
      const home = swapHomeAway ? a : h;
      const away = swapHomeAway ? h : a;
      fixtures.push({
        id: 'fix_'+Math.random().toString(36).slice(2),
        week: week,
        home: home.id, homeName: home.name, homeIsPlayer: !!home.isPlayer,
        away: away.id, awayName: away.name, awayIsPlayer: !!away.isPlayer,
        played: false, sh: null, sa: null,
        date: _weekDate(week),
      });
    }
  }
  // Aller (semaines 1..rounds), alternance dom/ext pour équilibrer.
  for(let r=0; r<rounds; r++){
    pushLeg(r+1, r%2===1);
    rot = [rot[0]].concat([rot[n-1]], rot.slice(1, n-1));
  }
  // Retour (semaines rounds+1..2*rounds) : mêmes paires, dom/ext inversés.
  rot = clubs.slice();
  for(let r=0; r<rounds; r++){
    pushLeg(rounds + r + 1, r%2===0);
    rot = [rot[0]].concat([rot[n-1]], rot.slice(1, n-1));
  }
  fixtures.sort(function(a,b){ return a.week - b.week; });
  careerV2.fixtures = fixtures;
  logEvent('📅 Calendrier généré — '+fixtures.length+' matchs cette saison !','#18c860');
  // Générer la coupe nationale (Pilier) en parallèle du championnat.
  try{ _generateNationalCup(); }catch(e){ console.error('cup:',e); }
  // Générer la coupe de la ligue (4 poules de 5 → play-offs) pour le Pilier.
  try{ _generateLeagueCup(); }catch(e){ console.error('league cup:',e); }
}

// ── COUPE DE LA LIGUE (Pilier) : 4 poules de 5 → play-offs ────────────────
// Chaque ligue a sa propre coupe : les 20 clubs de la division sont répartis en
// 4 poules de 5 ; les 2 meilleurs de chaque poule (8 clubs) filent en play-offs
// à élimination directe (quarts → demies → finale).
function _generateLeagueCup(){
  const C = careerV2;
  if(!C || C.nation!=='pilier' || typeof PILIER_TEAMS==='undefined') return;
  const myDivId = C.club.pilierDivId || (typeof _pilierDivOfLevel==='function' ? _pilierDivOfLevel(C.club.level) : null);
  if(!myDivId || typeof pilierTeamsByDivision!=='function') return;
  const divName = (PILIER_DIVISIONS[myDivId] ? PILIER_DIVISIONS[myDivId].name : myDivId);
  // 20 clubs de la division (dont le joueur).
  let clubs = pilierTeamsByDivision(myDivId).map(t=>({
    name:t.name, color:t.color, badge:t.badge||null, level:t.level||'dh',
    isPlayer:(t.name===C.club.name), pts:0, gf:0, ga:0,
  }));
  if(clubs.length<8) return; // pas assez pour le format
  // Mélange puis répartition en 4 poules de 5.
  for(let i=clubs.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [clubs[i],clubs[j]]=[clubs[j],clubs[i]]; }
  const pools = [[],[],[],[]];
  clubs.slice(0,20).forEach(function(c,i){ pools[i%4].push(c); });
  C.leagueCup = {
    name: 'Coupe de '+divName, icon:'🏵️',
    phase: 'pools', pools, playoffWeeks:[8,11,14],
    bracket: null, round:0, roundNames:['Quarts','Demies','Finale'],
    winner:null, playerOut:false, poolsPlayed:false,
  };
  logEvent('🏵️ Coupe de la ligue : 4 poules de 5, les 2 premiers en play-offs !', C.club.color||'#f0c028');
}
// Joue toute la phase de poules d'un coup (simulation) et qualifie les 2 premiers.
function _playLeagueCupPools(){
  const C=careerV2; const lc=C.leagueCup; if(!lc || lc.poolsPlayed) return;
  const qualified=[];
  lc.pools.forEach(function(pool){
    // Round-robin simple dans la poule.
    pool.forEach(c=>{ c.pts=0; c.gf=0; c.ga=0; });
    for(let i=0;i<pool.length;i++){ for(let j=i+1;j<pool.length;j++){
      const res=_cupSimMatch(pool[i], pool[j]);
      // _cupSimMatch renvoie {winner,ga,gb} ou une équipe (bye)
      if(res && res.winner){
        const w=res.winner, l=(w===pool[i]?pool[j]:pool[i]);
        w.pts+=3; w.gf+=Math.max(res.ga,res.gb); w.ga+=Math.min(res.ga,res.gb);
        l.gf+=Math.min(res.ga,res.gb); l.ga+=Math.max(res.ga,res.gb);
      }
    }}
    pool.sort((a,b)=> b.pts-a.pts || (b.gf-b.ga)-(a.gf-a.ga));
    qualified.push(pool[0], pool[1]); // 2 premiers
    // Notifier si le joueur est qualifié/éliminé.
    const me=pool.find(c=>c.isPlayer);
    if(me){
      const q=(pool[0]===me||pool[1]===me);
      careerLog('🏵️ '+lc.name+' — phase de poules : '+(q?'QUALIFIÉ pour les play-offs !':'éliminé en poules.'), q?'#18c860':'#e06060');
      if(!q) lc.playerOut=true;
    }
  });
  lc.poolsPlayed=true;
  lc.phase='playoffs';
  // Mélange les 8 qualifiés pour le bracket.
  for(let i=qualified.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [qualified[i],qualified[j]]=[qualified[j],qualified[i]]; }
  lc.bracket=_cupPairUp(qualified);
}
// Fait avancer la coupe de ligue selon la semaine.
function _advanceLeagueCup(){
  const C=careerV2; const lc=C.leagueCup; if(!lc || lc.winner) return;
  // Phase de poules : jouée en une fois à la 1re semaine de play-off -1.
  if(lc.phase==='pools'){
    if(C.week >= (lc.playoffWeeks[0]-1)){ _playLeagueCupPools(); }
    return;
  }
  // Play-offs : un tour par semaine dédiée.
  const roundIdx=lc.round;
  if(roundIdx>=lc.playoffWeeks.length) return;
  if(C.week < lc.playoffWeeks[roundIdx]) return;
  const survivors=[];
  (lc.bracket||[]).forEach(function(m){
    if(m.played){ if(m.winner) survivors.push(m.winner); return; }
    const res=_cupSimMatch(m.a,m.b);
    if(res && res.winner){ m.winner=res.winner; m.played=true; survivors.push(res.winner);
      if((m.a&&m.a.isPlayer)||(m.b&&m.b.isPlayer)){
        const win=res.winner.isPlayer;
        careerLog('🏵️ '+lc.name+' ('+lc.roundNames[roundIdx]+') — '+(win?'VICTOIRE !':'élimination.'), win?'#18c860':'#e06060');
        if(!win) lc.playerOut=true;
      }
    }
  });
  lc.round++;
  if(survivors.length<=1){
    lc.winner=survivors[0]||null;
    if(lc.winner&&lc.winner.isPlayer){ C.club.budget+=15000; C.club.reputation=Math.min(100,(C.club.reputation||0)+5); careerLog('🏵️ VOUS REMPORTEZ LA '+lc.name.toUpperCase()+' ! Prime 🪙15K, réputation +5 !','#f0c028'); }
    else if(lc.winner){ careerLog('🏵️ '+lc.name+' remportée par '+lc.winner.name+'.','#f0c028'); }
  } else {
    lc.bracket=_cupPairUp(survivors);
  }
}

// ═══════════════════════════════════════════════════════════
// COUPE NATIONALE (Pilier : « Coupe du Pilier ») — élimination directe
// ───────────────────────────────────────────────────────────
// Une coupe à élimination directe qui se joue EN PARALLÈLE du championnat, à
// des semaines dédiées. Ton club affronte des clubs tirés au sort dans tout le
// Pilier (toutes divisions confondues) ; les autres confrontations sont
// simulées. Progresser rapporte du prestige et des primes.
// ───────────────────────────────────────────────────────────
function _cupTeamStrength(divLevel){
  // Force approximative d'un club selon le niveau de sa division (0-1).
  const map = { d1:0.92, d2:0.82, d3:0.72, r1:0.60, r2:0.48, r3:0.36, dh:0.26 };
  return map[divLevel] || 0.4;
}
function _generateNationalCup(){
  const C = careerV2;
  if(!C || C.nation!=='pilier' || typeof PILIER_TEAMS==='undefined') return;

  // La coupe dépend du BLOC du club joueur :
  //   Pro (gtd,zenith)        → Coupe des Étoiles (40 clubs pro)
  //   Célestes (cel1..cel4)   → Coupe de la Ligue Céleste (80 clubs régionaux)
  //   Fondations (fond1..4)   → Coupe des Fondations (80 clubs amateurs)
  const myDivId = C.club.pilierDivId || (typeof _pilierDivOfLevel==='function' ? _pilierDivOfLevel(C.club.level) : null);
  const block = (typeof _pilierBlockOf==='function' && myDivId) ? _pilierBlockOf(myDivId) : 'fondation';
  const blockDivs = (typeof PILIER_BLOCKS!=='undefined' && PILIER_BLOCKS[block]) ? PILIER_BLOCKS[block] : [];
  const cupInfo = {
    pro:       { name:'Coupe des Étoiles',        icon:'⭐' },
    celeste:   { name:'Coupe de la Ligue Céleste', icon:'✨' },
    fondation: { name:'Coupe des Fondations',      icon:'⚒️' },
  }[block] || { name:'Coupe des Fondations', icon:'⚒️' };

  // Participants : tous les clubs des divisions du bloc.
  let pool = PILIER_TEAMS.filter(t=>blockDivs.includes(t.division) && t.name!==C.club.name);
  // Mélange.
  for(let i=pool.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
  // Taille en puissance de 2 : 32 pour un grand bloc (80 clubs), 32 pour pro (40).
  const SIZE = pool.length >= 31 ? 32 : 16;
  const field = [{ name:C.club.name, color:C.club.color, badge:C.club.badge||null, level:C.club.level, isPlayer:true }]
    .concat(pool.slice(0, SIZE-1).map(t=>({ name:t.name, color:t.color, badge:t.badge||null, level:t.level||'dh', isPlayer:false })));
  // Noms de tours selon la taille.
  const roundNames = SIZE===32 ? ['32es','16es','8es','Quarts','Demies','Finale'] : ['16es','8es','Quarts','Demies','Finale'];
  const weeks = SIZE===32 ? [2,4,7,10,13,16] : [3,6,9,12,15];
  C.cup = {
    name: cupInfo.name, icon: cupInfo.icon, block,
    field, round: 0, roundNames, weeks,
    bracket: _cupPairUp(field),
    eliminated: false, winner: null, playerOut: false,
  };
  logEvent(cupInfo.icon+' '+C.cup.name+' : ton club entre en lice ('+field.length+' équipes) !', C.club.color||'#f0c028');
}
function _cupPairUp(teams){
  // Apparie la liste en paires successives pour le tour courant.
  const pairs=[];
  for(let i=0;i<teams.length;i+=2){ pairs.push({ a:teams[i], b:teams[i+1]||null, sa:null, sb:null, played:false, winner:null }); }
  return pairs;
}
// Simule un match de coupe entre deux équipes (par leur niveau de division).
function _cupSimMatch(a,b){
  if(!b) return a; // bye
  const sa=_cupTeamStrength(a.level), sb=_cupTeamStrength(b.level);
  // Buts ~ Poisson simplifié pondéré par la force + hasard de coupe.
  const gA=Math.max(0, Math.round((sa*2.2 + Math.random()*2.2) - sb*1.2));
  const gB=Math.max(0, Math.round((sb*2.2 + Math.random()*2.2) - sa*1.2));
  let ga=gA, gb=gB;
  if(ga===gb){ // pas de nul en coupe : tirs au but ~ favorise le plus fort
    if(Math.random() < 0.5 + (sa-sb)*0.5) ga++; else gb++;
  }
  return { winner: ga>gb?a:b, ga, gb };
}
// Fait avancer la coupe si la semaine courante est une semaine de coupe.
function _advanceNationalCup(){
  const C=careerV2; if(!C || !C.cup || C.cup.winner) return;
  const cup=C.cup;
  const roundIdx = cup.round;
  if(roundIdx>=cup.weeks.length) return;
  if(C.week < cup.weeks[roundIdx]) return; // pas encore l'heure de ce tour
  // Jouer tout le tour courant.
  const survivors=[];
  cup.bracket.forEach(function(m){
    if(m.played){ if(m.winner) survivors.push(m.winner); return; }
    const res=_cupSimMatch(m.a, m.b);
    if(res.winner){ m.winner=res.winner; m.ga=res.ga; m.gb=res.gb; m.played=true; survivors.push(res.winner); }
    // Notifier si le match concerne le joueur.
    if((m.a&&m.a.isPlayer)||(m.b&&m.b.isPlayer)){
      const me=m.a&&m.a.isPlayer?m.a:m.b; const opp=m.a&&m.a.isPlayer?m.b:m.a;
      const win = res.winner && res.winner.isPlayer;
      const myG = m.a&&m.a.isPlayer?res.ga:res.gb, opG = m.a&&m.a.isPlayer?res.gb:res.ga;
      if(win){
        const prime = 4000 + roundIdx*3000;
        C.club.budget += prime;
        careerLog('🏆 '+cup.name+' ('+cup.roundNames[roundIdx]+') — VICTOIRE '+myG+'-'+opG+' vs '+(opp?opp.name:'?')+' ! Prime '+fmtG(prime), '#18c860');
      } else {
        cup.playerOut=true;
        careerLog('🏆 '+cup.name+' ('+cup.roundNames[roundIdx]+') — élimination '+myG+'-'+opG+' vs '+(opp?opp.name:'?')+'.', '#e06060');
      }
    }
  });
  cup.round++;
  if(survivors.length<=1){
    cup.winner = survivors[0] || null;
    if(cup.winner && cup.winner.isPlayer){
      const prize=30000;
      C.club.budget += prize;
      C.club.reputation = Math.min(100, (C.club.reputation||0)+10);
      careerLog('👑 VOUS REMPORTEZ LA '+cup.name.toUpperCase()+' ! Prime '+fmtG(prize)+', réputation +10 !', '#f0c028');
    } else if(cup.winner){
      careerLog('🏆 '+cup.name+' remportée par '+cup.winner.name+'.', '#f0c028');
    }
  } else {
    // Préparer le tour suivant.
    cup.bracket = _cupPairUp(survivors);
  }
}


// Vrai si un tour de coupe (nationale ou de ligue) impliquant le club joueur
// tombe dans la même semaine calendaire que sa prochaine journée de
// championnat — utile pour prévenir le joueur d'un enchaînement à deux matchs.

// ═══════════════════════════════════════════════════════════
// COUPE DE MAISON (Pilier) — petite compétition interne entre les clubs
// d'une même Maison (le club joueur + ses filiales/réserves affiliées).
// Le joueur choisit le FORMAT avant que la coupe démarre :
//   - 'roundrobin' : championnat interne (tous contre tous, une seule manche)
//   - 'knockout'   : coupe à élimination directe
// Se joue en semaine (mercredi, comme les autres coupes), sur des créneaux
// qui évitent les semaines déjà prises par la coupe nationale / de ligue.
// Les matchs sont simulés automatiquement (compétition annexe, low-stakes).
// ═══════════════════════════════════════════════════════════

// Force approximative d'une équipe de la coupe de Maison, basée sur l'OVR
// moyen de son effectif (club joueur ou filiale affiliée) plutôt que sur le
// niveau de division (ce sont souvent des réserves/académies).
function _houseCupOvr(p){
  if(typeof _pOvr==='function') return _pOvr(p);
  if(typeof careerOvr==='function') return careerOvr(p);
  const s=p.s||{};
  return Math.round(((s.sht||50)+(s.spd||50)+(s.def||50)+(s.stam||50)+(s.tec||50)+(s.res||50))/6);
}
function _houseCupTeamStrength(team){
  const C = careerV2;
  let squad;
  if(team.isPlayer){ squad = [...(C.players||[]), ...(C.bench||[])]; }
  else { const aff = (C.affiliates||[])[team.affIdx]; squad = aff ? [...(aff.players||[]), ...(aff.bench||[])] : []; }
  if(!squad.length) return 0.35;
  const avg = squad.reduce(function(s,p){ return s+_houseCupOvr(p); },0) / squad.length;
  return Math.min(0.95, Math.max(0.15, avg/100));
}
// Simule un match de coupe de Maison entre deux équipes (objets {isPlayer,affIdx,...}).
function _houseCupSimMatch(a,b){
  if(!b) return { winner:a, ga:0, gb:0, bye:true }; // exempt
  const sa=_houseCupTeamStrength(a), sb=_houseCupTeamStrength(b);
  const gA=Math.max(0, Math.round((sa*2.4 + Math.random()*2.2) - sb*1.1));
  const gB=Math.max(0, Math.round((sb*2.4 + Math.random()*2.2) - sa*1.1));
  return { winner: gA>=gB?a:b, ga:gA, gb:gB };
}

// Choisit des semaines de coupe pour la Coupe de Maison, en évitant les
// semaines déjà occupées par la coupe nationale / la coupe de ligue.
function _pickHouseCupWeeks(nbRounds){
  const C = careerV2;
  const used = new Set(
    (((C.cup||{}).weeks)||[]).concat(((C.leagueCup||{}).playoffWeeks)||[])
  );
  const weeks = [];
  let w = 3;
  while(weeks.length < nbRounds && w <= 36){
    if(!used.has(w)) weeks.push(w);
    w += 2;
  }
  w = 3;
  while(weeks.length < nbRounds && w <= 37){
    if(!weeks.includes(w) && !used.has(w)) weeks.push(w);
    w++;
  }
  return weeks.sort(function(a,b){ return a-b; }).slice(0, nbRounds);
}

// Prépare la Coupe de Maison : identifie les équipes (club joueur + filiales
// de la même Maison) mais NE démarre PAS tant que le joueur n'a pas choisi
// le format. Appelée juste après _buildAffiliates.
function _setupHouseCup(){
  const C = careerV2; if(!C || !C.house || !(C.affiliates||[]).length) return;
  const teams = [{ ref:{isPlayer:true}, name:C.club.name, color:C.club.color, badge:C.club.badge||null, isPlayer:true }]
    .concat(C.affiliates.map(function(aff,i){
      return { ref:{affIdx:i}, name:aff.name, color:aff.color, badge:aff.badge||null, isPlayer:false };
    }));
  if(teams.length < 2) return;
  C.houseCup = {
    house: C.house, teams: teams,
    format: null, started: false,
    // Round-robin :
    rrFixtures: [], rrStandings: null,
    // Knockout :
    bracket: null, round: 0, roundNames: [],
    weeks: [], winner: null, playerOut: false,
  };
  logEvent('🏛 Coupe de la Maison '+C.house+' : '+teams.length+' équipes — choisissez le format dans l\'onglet Maison.', C.club.color||'#c060e0');
}

// Démarre la Coupe de Maison avec le format choisi par le joueur.
function _startHouseCup(format){
  const C = careerV2; const hc = C.houseCup; if(!hc || hc.started) return;
  hc.format = format;
  hc.started = true;
  const n = hc.teams.length;
  if(format === 'roundrobin'){
    // Championnat interne : une seule manche (tous contre tous une fois),
    // méthode du cercle pour garantir un seul match par équipe et par semaine.
    let clubs = hc.teams.map(function(t,i){ return Object.assign({idx:i}, t); });
    if(clubs.length % 2 !== 0) clubs.push({ idx:-1, bye:true });
    const nn = clubs.length, rounds = nn-1, half = nn/2;
    const weeks = _pickHouseCupWeeks(rounds);
    hc.weeks = weeks;
    let rot = clubs.slice();
    const fixtures = [];
    for(let r=0; r<rounds; r++){
      for(let i=0;i<half;i++){
        const h = rot[i], a = rot[nn-1-i];
        if(h.bye || a.bye) continue;
        fixtures.push({ round:r, week: weeks[r]||weeks[weeks.length-1], home:h.idx, away:a.idx, played:false, sh:null, sa:null });
      }
      rot = [rot[0]].concat([rot[nn-1]], rot.slice(1, nn-1));
    }
    hc.rrFixtures = fixtures;
    hc.rrStandings = hc.teams.map(function(t,i){ return { idx:i, name:t.name, isPlayer:t.isPlayer, P:0,W:0,D:0,L:0,GF:0,GA:0,Pts:0 }; });
    careerLog('🏛 Championnat de la Maison '+hc.house+' lancé — '+fixtures.length+' matchs internes !', C.club.color||'#c060e0');
  } else {
    // Élimination directe : mélange puis appariement, byes si nécessaire.
    let shuffled = hc.teams.map(function(t,i){ return Object.assign({idx:i}, t); });
    for(let i=shuffled.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]; }
    hc.bracket = _cupPairUp(shuffled);
    const rounds = Math.ceil(Math.log2(Math.max(2,shuffled.length)));
    const names = ['Finale'];
    if(rounds>=2) names.unshift('Demi-finale');
    if(rounds>=3) names.unshift('Quarts de finale');
    while(names.length < rounds) names.unshift('Tour '+(rounds-names.length));
    hc.roundNames = names;
    hc.weeks = _pickHouseCupWeeks(rounds);
    careerLog('🏛 Coupe à élimination directe de la Maison '+hc.house+' lancée — '+shuffled.length+' équipes !', C.club.color||'#c060e0');
  }
  try{ saveCareerV2(); }catch(e){}
}

// Fait avancer la Coupe de Maison si la semaine courante correspond à un tour.
function _advanceHouseCup(){
  const C = careerV2; const hc = C.houseCup; if(!hc || !hc.started || hc.winner) return;
  if(hc.format === 'roundrobin'){
    const due = (hc.rrFixtures||[]).filter(function(f){ return !f.played && f.week===C.week; });
    if(!due.length) return;
    due.forEach(function(f){
      const a = hc.teams[f.home], b = hc.teams[f.away];
      const res = _houseCupSimMatch(a,b);
      f.played = true; f.sh = res.ga; f.sa = res.gb;
      const sa = hc.rrStandings[f.home], sb = hc.rrStandings[f.away];
      sa.P++; sb.P++; sa.GF+=res.ga; sa.GA+=res.gb; sb.GF+=res.gb; sb.GA+=res.ga;
      if(res.ga>res.gb){ sa.W++; sa.Pts+=3; sb.L++; } else if(res.ga<res.gb){ sb.W++; sb.Pts+=3; sa.L++; } else { sa.D++; sb.D++; sa.Pts++; sb.Pts++; }
      if(a.isPlayer||b.isPlayer){
        const me=a.isPlayer?a:b, opp=a.isPlayer?b:a, myG=a.isPlayer?res.ga:res.gb, opG=a.isPlayer?res.gb:res.ga;
        careerLog('🏛 Maison ('+hc.house+') — '+(myG>opG?'Victoire':myG===opG?'Match nul':'Défaite')+' '+myG+'-'+opG+' vs '+opp.name+'.', myG>opG?'#18c860':myG===opG?'#f0c028':'#e06060');
      }
    });
    if((hc.rrFixtures||[]).every(function(f){ return f.played; })){
      const sorted = hc.rrStandings.slice().sort(function(x,y){ return y.Pts-x.Pts || (y.GF-y.GA)-(x.GF-x.GA); });
      hc.winner = hc.teams[sorted[0].idx];
      if(hc.winner.isPlayer){ C.club.budget+=3000; careerLog('🏛 VOUS REMPORTEZ LE CHAMPIONNAT DE LA MAISON '+hc.house.toUpperCase()+' ! Prime 🪙3K.', '#f0c028'); }
      else careerLog('🏛 Championnat de la Maison '+hc.house+' remporté par '+hc.winner.name+'.', '#c060e0');
    }
    return;
  }
  // Knockout
  const roundIdx = hc.round;
  if(roundIdx >= hc.weeks.length) return;
  if(C.week < hc.weeks[roundIdx]) return;
  const survivors = [];
  (hc.bracket||[]).forEach(function(m){
    if(m.played){ if(m.winner) survivors.push(m.winner); return; }
    const res = _houseCupSimMatch(m.a, m.b);
    m.winner = res.winner; m.ga=res.ga; m.gb=res.gb; m.played=true;
    survivors.push(res.winner);
    if(!res.bye && ((m.a&&m.a.isPlayer)||(m.b&&m.b.isPlayer))){
      const win = res.winner.isPlayer;
      const opp = (m.a&&m.a.isPlayer)?m.b:m.a;
      careerLog('🏛 Coupe de Maison ('+(hc.roundNames[roundIdx]||'Tour')+') — '+(win?'VICTOIRE':'élimination')+' vs '+(opp?opp.name:'?')+'.', win?'#18c860':'#e06060');
      if(!win) hc.playerOut = true;
    }
  });
  hc.round++;
  if(survivors.length <= 1){
    hc.winner = survivors[0] || null;
    if(hc.winner && hc.winner.isPlayer){ C.club.budget+=3000; careerLog('🏛 VOUS REMPORTEZ LA COUPE DE LA MAISON '+hc.house.toUpperCase()+' ! Prime 🪙3K.', '#f0c028'); }
    else if(hc.winner) careerLog('🏛 Coupe de la Maison '+hc.house+' remportée par '+hc.winner.name+'.', '#c060e0');
  } else {
    hc.bracket = _cupPairUp(survivors);
  }
  try{ saveCareerV2(); }catch(e){}
}

function _hasCupClashThisWeek(leagueWeek){
  const C = careerV2; if(!C || !leagueWeek) return false;
  if(C.cup && !C.cup.winner && !C.cup.playerOut){
    const idx = C.cup.round;
    if(idx < (C.cup.weeks||[]).length && C.cup.weeks[idx]===leagueWeek){
      const inBracket = (C.cup.bracket||[]).some(function(m){ return (m.a&&m.a.isPlayer)||(m.b&&m.b.isPlayer); });
      if(inBracket) return true;
    }
  }
  if(C.leagueCup && !C.leagueCup.winner && !C.leagueCup.playerOut && C.leagueCup.phase==='playoffs'){
    const idx = C.leagueCup.round;
    if(idx < (C.leagueCup.playoffWeeks||[]).length && C.leagueCup.playoffWeeks[idx]===leagueWeek){
      const inBracket = (C.leagueCup.bracket||[]).some(function(m){ return (m.a&&m.a.isPlayer)||(m.b&&m.b.isPlayer); });
      if(inBracket) return true;
    }
  }
  if(C.houseCup && C.houseCup.started && !C.houseCup.winner){
    const hc = C.houseCup;
    if(hc.format==='roundrobin'){
      const due = (hc.rrFixtures||[]).some(function(f){
        return !f.played && f.week===leagueWeek && (hc.teams[f.home].isPlayer || hc.teams[f.away].isPlayer);
      });
      if(due) return true;
    } else if(hc.format==='knockout' && !hc.playerOut){
      const idx = hc.round;
      if(idx < (hc.weeks||[]).length && hc.weeks[idx]===leagueWeek){
        const inBracket = (hc.bracket||[]).some(function(m){ return (m.a&&m.a.isPlayer)||(m.b&&m.b.isPlayer); });
        if(inBracket) return true;
      }
    }
  }
  return false;
}

function _generateInitialJobOffers(regionId, nationId){
  nationId = nationId || 'panthalassa';
  const region = WORLDS.getRegion(nationId, regionId);
  if(!region) return [];
  const offers = [];
  // En Valoria : proposer de vrais clubs des divisions basses de la région.
  if(nationId==='valoria' && typeof VALORIA_TEAMS!=='undefined'){
    const regName = (typeof _valRegionName==='function') ? _valRegionName(regionId) : (String(regionId).toLowerCase().indexOf('brum')>=0?'Brumefer':'Valcourt');
    const lowTeams = VALORIA_TEAMS.filter(function(t){
      return t.region===regName && (t.tier==='district' || t.division==='brumefer_r2' || t.division==='valcourt_r3');
    });
    const shuffled = lowTeams.slice().sort(function(){ return Math.random()-0.5; }).slice(0,3);
    shuffled.forEach(function(vt){
      offers.push({
        club: vt.name, region: regionId, valoriaName: vt.name, badge: vt.badge||null, color: vt.color,
        level: vt.division,
        salary: 200 + Math.round(Math.random()*300),
        contract_years: 1,
        objectives: [{type:'survive', desc:'Survivre la saison'}],
        deadline: 7,
      });
    });
    if(offers.length) return offers;
  }
  // Fallback générique (Panthalassa).
  for(let i=0; i<3; i++){
    const clubName = region.clubNames[Math.floor(Math.random()*region.clubNames.length)];
    offers.push({
      club: clubName,
      region: regionId,
      level: region.pyramid.district_groups > 0 ? 'dh' : 'r3',
      salary: 200 + Math.round(Math.random()*300),
      contract_years: 1,
      objectives: [{type:'survive', desc:'Survivre la saison'}],
      deadline: 7, // jours pour accepter
    });
  }
  return offers;
}

function exportData(){
  const payload={
    version:2,
    exportedAt:new Date().toISOString(),
    savedTeams,
    cupNPCPool:_cupNPCPool,
    leagueAIData:leagueAIData.length?leagueAIData:null,
    cupState:cupState||null,
    leagueState:leagueState||null,
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='footsim_sauvegarde_'+(new Date().toISOString().slice(0,10))+'.json';
  a.click();URL.revokeObjectURL(url);
  logEvent('💾 Export JSON téléchargé !','#18c860');
}

function importData(input){
  const file=input.files?.[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const d=JSON.parse(e.target.result);
      if(!d||typeof d!=='object')throw new Error('Format invalide');
      let imported=0;
      if(Array.isArray(d.savedTeams)){savedTeams=d.savedTeams;persistSavedTeams();imported++;}
      if(Array.isArray(d.cupNPCPool)){_cupNPCPool=d.cupNPCPool;saveCupNPCPool();imported++;}
      if(Array.isArray(d.leagueAIData)&&d.leagueAIData.length){leagueAIData=d.leagueAIData;imported++;}
      if(d.cupState?.format?.type){cupState=d.cupState;saveCup();imported++;}
      if(d.leagueState){leagueState=d.leagueState;saveLeague();imported++;}
      logEvent(`✅ Import réussi (${imported} blocs chargés) !`,'#18c860');
      // Refresh current view
      renderCup();renderLeague();
      if(document.getElementById('npc-list-area'))renderNPCList();
    }catch(err){
      logEvent('❌ Erreur import : '+err.message,'#e02030');
    }
  };
  reader.readAsText(file);
  input.value=''; // reset so same file can be re-imported
}

function setCupLegs(n){
  _cupGroupLegs=n;
  renderCupSetup(document.getElementById('cup-out'));
}
function setCupCount(n){
  _cupCount=Math.max(4,Math.min(16,n));
  renderCupSetup(document.getElementById('cup-out'));
}
function setCupPG(n){
  _cupPG=n;
  _cupAdvance=Math.min(_cupAdvance,Math.max(1,n-1));
  renderCupSetup(document.getElementById('cup-out'));
}
function setCupGC(n){
  _cupGC=Math.max(1,n);
  renderCupSetup(document.getElementById('cup-out'));
}
function setCupAdvance(n){
  _cupAdvance=Math.max(1,Math.min(n,_cupPG-1));
  renderCupSetup(document.getElementById('cup-out'));
}

// ── Manual Group Draw ─────────────────────────────────────
let _groupDraft=null; // {groups:[[id,...]], gc, pg} or null = auto

function openGroupDrawModal(){
  const fmt=CUP_FORMATS.find(f=>f.id===_cupFmt);
  if(!fmt||(fmt.type!=='groups_ko'&&fmt.type!=='round_robin')){
    logEvent('Le tirage manuel ne concerne que les formats avec poules.','#e02030');return;
  }
  document.getElementById('mttl').textContent='🎲 Tirage des groupes';
  document.getElementById('mcnt').innerHTML=`<div id="gd-area"></div>`;
  document.getElementById('pmodal').classList.add('on');
  // Build draft from current config
  const gc=fmt.type==='round_robin'?1:_cupGC;
  const pg=_cupPG;
  const totalTeams=gc*pg;
  // Build team list - include all selected saved teams
  // Since we can't rely on DOM checkboxes from the setup form here,
  // we read the checkbox state if available, otherwise include all saved teams
  const sel=savedTeams.map((_,i2)=>{
    const cb=document.getElementById('csc'+i2);
    return cb?cb.checked:true;// if no checkbox found, include by default
  }).map((v,i2)=>v?i2:-1).filter(i2=>i2>=0);
  const teams2=buildCupTeams(totalTeams,sel);
  // Init draft with random assignment
  const shuffled=[...teams2].sort(()=>Math.random()-.5);
  const groups=Array.from({length:gc},()=>[]);
  shuffled.forEach((t,i)=>groups[i%gc].push(t.id));
  _groupDraft={groups,gc,pg,teams:teams2,totalTeams};
  renderGroupDraw();
}

function renderGroupDraw(){
  const el=document.getElementById('gd-area');if(!el||!_groupDraft)return;
  const {groups,gc,pg,teams}=_groupDraft;
  const getTeam=id=>teams.find(t=>t.id===id);
  const groupNames='ABCDEFGHIJKLMNOP';
  let h=`<div style="font-size:9px;color:var(--muted);margin-bottom:8px">Glissez les équipes entre les groupes, ou cliquez sur ⟳ pour mélanger.</div>`;
  h+=`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">`;
  groups.forEach((gIds,gi)=>{
    h+=`<div style="flex:1;min-width:100px;background:var(--panel);border:1px solid var(--b1);border-radius:7px;padding:6px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;letter-spacing:1px;color:var(--gold);margin-bottom:5px">GROUPE ${groupNames[gi]}</div>`;
    gIds.forEach(id=>{
      const t=getTeam(id);if(!t)return;
      const isHuman=t.isUser||(t.isSaved&&savedTeams[t.savedIdx]?.isHuman);
      h+=`<div style="display:flex;align-items:center;gap:4px;padding:2px 4px;border-radius:4px;margin-bottom:2px;background:rgba(255,255,255,.03);cursor:pointer" 
        onclick="cycleGroup(${id},${gi})" title="Clic : déplacer au groupe suivant">
        <span style="width:6px;height:6px;border-radius:50%;background:${t.color};flex-shrink:0"></span>
        <span style="font-size:10px;font-weight:700;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.name}</span>
        ${isHuman?'<span style="font-size:8px;color:var(--gold)">👤</span>':''}
      </div>`;
    });
    h+=`</div>`;
  });
  h+=`</div>`;
  h+=`<div style="display:flex;gap:6px">
    <button class="btn" style="flex:1;justify-content:center;font-size:10px" onclick="reshuffleDraft()">⟳ Mélanger</button>
    <button class="btn btng" style="flex:2;justify-content:center;font-size:10px" onclick="createCupFromDraft()">✓ Créer avec ces groupes</button>
  </div>`;
  el.innerHTML=h;
}

function cycleGroup(teamId,fromGi){
  if(!_groupDraft)return;
  const {groups,gc}=_groupDraft;
  const toGi=(fromGi+1)%gc;
  // Remove from current group
  groups[fromGi]=groups[fromGi].filter(id=>id!==teamId);
  // Add to next group (but cap at pg)
  if(groups[toGi].length<_groupDraft.pg)
    groups[toGi].push(teamId);
  else{
    // Find a group with space
    const target=groups.findIndex((g,gi)=>gi!==fromGi&&g.length<_groupDraft.pg);
    if(target>=0)groups[target].push(teamId);
    else groups[fromGi].push(teamId);// no space, put back
  }
  renderGroupDraw();
}

function reshuffleDraft(){
  if(!_groupDraft)return;
  const {gc,pg,teams}=_groupDraft;
  const shuffled=[...teams].sort(()=>Math.random()-.5);
  _groupDraft.groups=Array.from({length:gc},()=>[]);
  shuffled.forEach((t,i)=>_groupDraft.groups[i%gc].push(t.id));
  renderGroupDraw();
}

function createCupFromDraft(){
  if(!_groupDraft)return;
  closeM();
  const {groups,gc,pg,teams}=_groupDraft;
  const fmt=CUP_FORMATS.find(f=>f.id===_cupFmt);
  if(!fmt)return;
  const adv=Math.max(1,Math.min(_cupAdvance,pg-1));
  const state={formatId:_cupFmt,format:fmt,teams,phase:'groups',champion:null,thirdPlaceMatch:null};
  state.groupCfg={gc,pg,advance:adv};
  state.groups=groups.map((gIds,gi)=>({
    id:gi,
    name:'Groupe '+'ABCDEFGHIJKLMNOP'[gi],
    teamIds:gIds,
    fixtures:mkFix(gIds,_cupGroupLegs),
    standings:mkStd(gIds),
    legs:_cupGroupLegs,
  })).filter(g=>g.teamIds.length>=2);
  state.bracket=null;
  if(fmt.thirdPlace)state.thirdPlaceMatch=mkTie(null,null,1);
  cupState=state;cupCurrentMatch=null;_groupDraft=null;
  saveCup();renderCup();
  logEvent('🎲 Groupes composés et coupe lancée !','#f0c028');
}

function setCupGroupCfg(key,val){
  if(key==='gc')_cupGC=val;
  else if(key==='pg'){_cupPG=val;_cupAdvance=Math.min(_cupAdvance,val-1)||1;}
  else if(key==='legs')_cupGroupLegs=val;
  else if(key==='advance')_cupAdvance=val;
  renderCupSetup(document.getElementById('cup-out'));
}

function setTotalCupTeams(total){
  // Find the best gc×pg split for the requested total
  const fmt=CUP_FORMATS.find(f=>f.id===_cupFmt);
  if(fmt?.type==='round_robin'){
    // Single group: just set pg to total
    _cupGC=1;_cupPG=total;
  } else {
    // groups_ko: find nice split (prefer equal groups of 3-5)
    const candidates=[
      {gc:1,pg:total},
      {gc:2,pg:Math.ceil(total/2)},
      {gc:3,pg:Math.ceil(total/3)},
      {gc:4,pg:Math.ceil(total/4)},
      {gc:5,pg:Math.ceil(total/5)},
      {gc:6,pg:Math.ceil(total/6)},
    ].filter(({gc,pg})=>gc*pg===total&&pg>=2&&pg<=8&&gc>=1&&gc<=6);
    if(candidates.length){
      // Prefer groups of 4-5
      const best=candidates.sort((a,b)=>Math.abs(a.pg-4)-Math.abs(b.pg-4))[0];
      _cupGC=best.gc;_cupPG=best.pg;
    } else {
      // No exact split: use closest
      const pg=Math.max(2,Math.min(8,Math.round(total/2)));
      _cupGC=Math.max(1,Math.round(total/pg));
      _cupPG=pg;
    }
  }
  renderCupSetup(document.getElementById('cup-out'));
}

function renderCupSetup(el){
  const fmtDesc=CUP_FORMATS.find(f=>f.id===_cupFmt)?.desc||'';
  let roHTML='';
  if(savedTeams.length){
    roHTML=`<div class="slbl" style="margin:10px 0 4px">Équipes sauvegardées</div>`;
    roHTML+=savedTeams.map((t,i)=>{
      const ovr=t.players?.length?_playerOvr({s:_avgStats([...(t.players||[]),...(t.bench||[])])}):null;
      const ovrCol=ovr==null?'var(--muted)':ovr>=75?'#18c860':ovr>=60?'#f0c028':'#e06060';
      return `<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:5px;cursor:pointer;background:var(--panel);border:1px solid var(--b1);margin-bottom:3px" onclick="if(event.target.type!=='checkbox'&&event.target.tagName!=='BUTTON'){const cb=document.getElementById('csc${i}');if(cb)cb.checked=!cb.checked;}">
        <input type="checkbox" id="csc${i}" style="accent-color:${t.color}" onclick="event.stopPropagation()">
        <div style="width:22px;height:22px;border-radius:50%;border:1px solid ${t.color};background:${t.color}22;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:900;color:${t.color};flex-shrink:0">
          ${t.img?`<img src="${t.img}" style="width:100%;height:100%;object-fit:cover">`:`${teamIni(t.name)}`}
        </div>
        <span style="font-size:11px;font-weight:700;flex:1;color:${t.color};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.name}</span>
        ${ovr!=null?`<span style="font-size:9px;font-weight:700;color:${ovrCol}">OVR ${ovr}</span>`:''}
        <button onclick="event.stopPropagation();openSavedTeamRoster(${i})" style="background:${t.color}22;border:1px solid ${t.color}44;color:#fff;border-radius:5px;padding:1px 6px;cursor:pointer;font-size:10px">✏️</button>
        <button onclick="event.stopPropagation();cteDeleteSavedTeam(${i})" style="background:transparent;border:1px solid #e0606044;color:#e06060;border-radius:5px;padding:1px 6px;cursor:pointer;font-size:10px">✕</button>
      </div>`;
    }).join('');
  }
  const npcCards=_cupNPCPool.map((npc,i)=>{
    const ovr=npc.players?.length?Math.round([...npc.players,...(npc.bench||[])].reduce((s,p)=>{const v=Object.values(p.s||{});return s+(v.length?v.reduce((a,b)=>a+b,0)/v.length:60);},0)/Math.max(1,npc.players.length+(npc.bench?.length||0))):npc.ovr||60;
    const ovrCol=ovr>=75?'#18c860':ovr>=60?'#f0c028':'#e06060';
    return `<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:5px;background:var(--panel);border:1px solid ${npc.color}33;margin-bottom:3px">
      <input type="checkbox" id="cnpc${i}" checked style="accent-color:${npc.color}">
      <div style="width:22px;height:22px;border-radius:50%;border:1px solid ${npc.color};background:${npc.color}22;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:900;color:${npc.color};flex-shrink:0">
        ${npc.img?`<img src="${npc.img}" style="width:100%;height:100%;object-fit:cover">`:`${teamIni(npc.name)}`}
      </div>
      <span style="font-size:11px;font-weight:700;flex:1;color:${npc.color}">${npc.name}</span>
      <span style="font-size:9px;color:${ovrCol};font-weight:700">OVR ${ovr}</span>
      <button onclick="cupInlineEdit(${i})" style="background:${npc.color}22;border:1px solid ${npc.color}44;color:#fff;border-radius:5px;padding:1px 6px;cursor:pointer;font-size:10px">✏️</button>
      <button onclick="cupInlineDelete(${i})" style="background:transparent;border:1px solid #e0606044;color:#e06060;border-radius:5px;padding:1px 6px;cursor:pointer;font-size:10px">✕</button>
    </div>`;
  }).join('');

  el.innerHTML=`<div style="padding:4px" id="cup-setup-main">
    <div style="display:flex;gap:6px;margin-bottom:10px">
      <button onclick="setGameMode('7v7');renderCup()" style="flex:1;padding:7px;border-radius:8px;border:2px solid ${gameMode==='7v7'?'var(--gold)':'var(--b1)'};background:${gameMode==='7v7'?'rgba(240,192,40,.15)':'var(--dark)'};color:${gameMode==='7v7'?'var(--gold)':'var(--muted)'};font-size:12px;font-weight:900;cursor:pointer">⚽ 7v7</button>
      <button onclick="setGameMode('11v11');renderCup()" style="flex:1;padding:7px;border-radius:8px;border:2px solid ${gameMode==='11v11'?'#18c860':'var(--b1)'};background:${gameMode==='11v11'?'rgba(24,200,96,.15)':'var(--dark)'};color:${gameMode==='11v11'?'#18c860':'var(--muted)'};font-size:12px;font-weight:900;cursor:pointer">⚽ 11v11</button>
    </div>
    ${(typeof VALORIA_DIVISIONS!=='undefined')?`
    <div style="border:1px solid rgba(240,192,40,.3);border-radius:10px;padding:10px;margin-bottom:12px;background:linear-gradient(180deg,rgba(240,192,40,.08),transparent)">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:900;letter-spacing:1px;color:var(--gold);margin-bottom:2px">🏆 COUPES DE VALORIA</div>
      <div style="font-size:9px;color:var(--muted);margin-bottom:8px">Compétitions à élimination directe préremplies avec les équipes de la nation.</div>
      <button class="btn btng" style="width:100%;justify-content:center;font-size:12px;padding:8px;margin-bottom:6px" onclick="startValoriaCup('national')">🏆 Coupe de Valoria <span style="opacity:.7;font-size:10px">— toutes les équipes du pays</span></button>
      <div class="slbl" style="margin-bottom:4px">Coupe de division</div>
      <div style="display:flex;gap:5px">
        <select class="inp" id="valoria-cup-div" style="flex:1">
          ${Object.entries(VALORIA_DIVISIONS).sort((a,b)=>((a[1].tier==='pro'?-1:0))-((b[1].tier==='pro'?-1:0))||a[1].order-b[1].order).map(([id,d])=>`<option value="${id}">${d.name}${d.region?' ('+d.region+')':''}</option>`).join('')}
        </select>
        <button class="btn btng" style="padding:6px 12px;font-size:12px" onclick="startValoriaCup('division', document.getElementById('valoria-cup-div').value)">Lancer</button>
      </div>
    </div>`:''}
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:900;letter-spacing:2px;color:var(--gold);margin-bottom:10px">NOUVELLE COUPE ${gameMode==='11v11'?'<span style="color:#18c860;font-size:11px">11v11</span>':'<span style="font-size:11px">7v7</span>'}</div>
    <div class="slbl" style="margin-bottom:5px">Format des règles</div>
    <select class="inp" id="cup-fmt-sel" style="width:100%;margin-bottom:4px" onchange="_cupFmt=this.value;var _fd=document.getElementById('cup-fmt-desc');if(_fd)_fd.textContent=CUP_FORMATS.find(f=>f.id===this.value)?.desc||'';var _hg=['groups_ko','round_robin'].includes(CUP_FORMATS.find(f=>f.id===this.value)?.type);var _gc=document.getElementById('cup-groups-cfg');if(_gc)_gc.style.display=_hg?'block':'none';" >
      ${CUP_FORMATS.map(f=>`<option value="${f.id}"${f.id===_cupFmt?' selected':''}>${f.name}</option>`).join('')}
    </select>
    <div id="cup-fmt-desc" style="font-size:9px;color:var(--muted);margin-bottom:10px;line-height:1.5">${fmtDesc}</div>
    <div class="slbl" style="margin-bottom:5px">Nombre d'équipes</div>
    <div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:10px">
      ${[4,5,6,7,8,9,10,11,12,13,14,15,16].map(n=>`<button id="cn${n}" class="btn${n===_cupCount?' btng':''}" style="min-width:28px;justify-content:center;padding:4px 6px;font-size:11px" onclick="setCupCount(${n})">${n}</button>`).join('')}
    </div>
    <div id="cup-groups-cfg" style="display:${['groups_ko','round_robin'].includes(CUP_FORMATS.find(f=>f.id===_cupFmt)?.type)?'block':'none'};margin-bottom:10px;">
      <div class="slbl" style="margin-bottom:5px">Nombre de groupes</div>
      <div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:2px">
        ${[1,2,3,4,5,6,7,8].map(n=>`<button class="btn${n===_cupGC?' btng':''}" style="min-width:28px;justify-content:center;padding:4px 6px;font-size:11px" onclick="setCupGC(${n})">${n}</button>`).join('')}
      </div>
      <div class="slbl" style="margin:8px 0 5px">Équipes par groupe</div>
      <div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:2px">
        ${[2,3,4,5,6,7,8].map(n=>`<button class="btn${n===_cupPG?' btng':''}" style="min-width:28px;justify-content:center;padding:4px 6px;font-size:11px" onclick="setCupPG(${n})">${n}</button>`).join('')}
      </div>
      <div class="slbl" style="margin:8px 0 5px">Qualifiés par groupe</div>
      <div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:2px">
        ${Array.from({length:_cupPG-1},(_,i)=>i+1).map(n=>`<button class="btn${n===_cupAdvance?' btng':''}" style="min-width:28px;justify-content:center;padding:4px 6px;font-size:11px" onclick="setCupAdvance(${n})">${n}</button>`).join('')}
      </div>
      <div style="font-size:9px;color:var(--gold);margin-top:4px">${_cupGC} groupe${_cupGC>1?'s':''} × ${_cupPG} équipes = <b>${_cupGC*_cupPG} équipes</b> — ${_cupGC*_cupAdvance} qualifié${_cupGC*_cupAdvance>1?'s':''} pour la phase K.O.</div>
      <div class="slbl" style="margin:8px 0 5px">Matchs de poule</div>
      <div style="display:flex;gap:6px">
        <button class="btn${_cupGroupLegs===1?' btng':''}" style="flex:1;justify-content:center;padding:5px 8px;font-size:11px" onclick="setCupLegs(1)">Aller seulement</button>
        <button class="btn${_cupGroupLegs===2?' btng':''}" style="flex:1;justify-content:center;padding:5px 8px;font-size:11px" onclick="setCupLegs(2)">Aller-Retour</button>
      </div>
    </div>
    <div class="slbl" style="margin-bottom:4px">Équipes joueur (toujours incluses)</div>
    ${[0,1].map(i=>`<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:5px;background:rgba(255,255,255,.04);border:1px solid var(--b2);margin-bottom:3px">
      <span style="width:7px;height:7px;border-radius:50%;background:${teams[i].color}"></span>
      <span style="font-size:11px;font-weight:700;color:${teams[i].color}">${teams[i].name}</span>
    </div>`).join('')}
    ${roHTML}
    <div style="display:flex;align-items:center;gap:6px;margin:10px 0 4px">
      <div class="slbl" style="flex:1;margin:0">Équipes PNJ</div>
      ${_cupNPCPool.length?`<button onclick="cupNPCSelAll(true)" style="background:var(--card);border:1px solid var(--b2);color:var(--muted);border-radius:4px;padding:1px 6px;cursor:pointer;font-size:9px">✓ Tout</button>
      <button onclick="cupNPCSelAll(false)" style="background:var(--card);border:1px solid var(--b2);color:var(--muted);border-radius:4px;padding:1px 6px;cursor:pointer;font-size:9px">✕ Tout</button>`:''}
    </div>
    <div id="cup-npc-list">${npcCards||'<div style="font-size:9px;color:var(--muted);padding:4px 0">Aucune équipe PNJ. Créez-en une ci-dessous.</div>'}</div>
    <button onclick="cupInlineAdd()" style="width:100%;background:var(--card);border:1px dashed var(--b2);color:#69f0ae;border-radius:6px;padding:5px;cursor:pointer;font-size:11px;margin-top:4px">＋ Nouvelle équipe PNJ</button>
    <button onclick="importCupSetupNPC()" style="width:100%;background:var(--card);border:1px dashed var(--b2);color:#18c860;border-radius:6px;padding:5px;cursor:pointer;font-size:11px;margin-top:4px">📥 Importer une équipe PNJ (.json)</button>
    <button class="btn btng" style="width:100%;justify-content:center;margin-top:10px" onclick="confirmCreateCup()">Créer la coupe</button>
  </div>`;
}

// Importe un ou plusieurs PNJ directement dans le pool utilisé par l'écran
// de configuration d'une nouvelle coupe (corrige l'ancien bouton cassé qui
// appelait par erreur importTeamJSON(), destiné aux équipes Rouges/Bleus).
function importCupSetupNPC(){
  const inp=document.createElement('input');
  inp.type='file'; inp.accept='.json';
  inp.onchange=e=>{
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const d=JSON.parse(ev.target.result);
        const arr=Array.isArray(d)?d:(Array.isArray(d?.cupNPCPool)?d.cupNPCPool:[d]);
        const valid=arr.filter(raw=>raw&&raw.name&&Array.isArray(raw.players));
        if(!valid.length){ logEvent('❌ JSON invalide : aucune équipe trouvée.','#e02030'); return; }
        valid.forEach(raw=>{
          const idx=_cupNPCPool.findIndex(n=>n.name===raw.name);
          const npc={
            id:idx>=0?_cupNPCPool[idx].id:_genNPCId(),
            name:raw.name, color:raw.color||'#4fc3f7', img:raw.img||'', strat:raw.strat||'321', ovr:raw.ovr||60,
            players:(raw.players||[]).map(p=>_importedPlayer(p,60)),
            bench:(raw.bench||[]).map(p=>_importedPlayer(p,55)),
            reserves:(raw.reserves||[]).map(p=>_importedPlayer(p,50))
          };
          if(idx>=0)_cupNPCPool[idx]=npc;else _cupNPCPool.push(npc);
        });
        saveCupNPCPool();
        logEvent('✅ '+valid.length+' équipe(s) PNJ importée(s) !','#18c860');
        renderCupSetup(document.getElementById('cup-out'));
      }catch(err){
        logEvent('❌ Erreur JSON : '+err.message,'#e02030');
      }
    };
    reader.readAsText(file);
  };
  inp.click();
}

function cupNPCSelAll(state){
  _cupNPCPool.forEach((_,i)=>{const cb=document.getElementById(`cnpc${i}`);if(cb)cb.checked=state;});
}

function cupInlineAdd(){
  _cupNPCPool.push({id:_genNPCId(),name:'Nouveau Club',color:'#4fc3f7',strat:'321',ovr:60,players:[],bench:[],reserves:[]});
  saveCupNPCPool();
  cupInlineEdit(_cupNPCPool.length-1);
}

function cupInlineDelete(i){
  const name=_cupNPCPool[i]?.name||'cette équipe';
  _confirmDialog(`Supprimer « ${name} » ?`,()=>{
    _cupNPCPool.splice(i,1);
    saveCupNPCPool();
    renderCupSetup(document.getElementById('cup-out'));
  });
}

function cupInlineEdit(i){
  const el=document.getElementById('cup-out');if(!el)return;
  const npc=_cupNPCPool[i];
  if(!npc.players?.length){const t=mkCupNPCTeamData(npc,i);npc.players=t.players;npc.bench=t.bench;npc.reserves=t.reserves;saveCupNPCPool();}

  const getOvr=p=>{const v=Object.values(p.s||{});return v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length):50;};

  const mkP=(p,src,pi)=>{
    const ovr=getOvr(p);
    const ovrCol=ovr>=75?'#18c860':ovr>=60?'#f0c028':'#e06060';
    const imgId=`cei-${src}-${pi}`;
    const detId=`ceid-${i}-${src}-${pi}`;
    const stats={sht:'⚽ Tir',def:'🛡 Déf',spd:'💨 Vit',tec:'🎯 Tec',stam:'❤️ End'};
    const statsH=Object.entries(stats).map(([k,lbl])=>{
      const v=p.s?.[k]||50;const col=v>=75?'#18c860':v>=55?'#f0c028':'#e06060';
      return `<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px">
        <span style="font-size:8px;color:var(--muted);width:40px;flex-shrink:0">${lbl}</span>
        <input type="range" min="1" max="99" value="${v}" style="flex:1" oninput="npcStatLive(${i},'${src}',${pi},'${k}',+this.value,this)">
        <span style="font-size:9px;font-weight:700;color:${col};width:22px;text-align:right">${v}</span>
      </div>`;
    }).join('');
    const spH=SPELLS.map(sp=>{
      const has=(p.spells||[]).includes(sp.id);
      return `<span onclick="npcSpellLive(${i},'${src}',${pi},'${sp.id}',this)" style="display:inline-block;padding:1px 4px;border-radius:3px;font-size:7px;cursor:pointer;margin:1px;background:${has?sp.col+'33':'var(--dark)'};border:1px solid ${has?sp.col+'66':'var(--b2)'};color:${has?sp.col:'var(--muted)'}">${sp.n}</span>`;
    }).join('');
    return `<div style="border-radius:7px;background:var(--card);border:1px solid var(--b1);margin-bottom:4px;overflow:hidden">
      <div onclick="npcToggle('${detId}',this.querySelector('.tog'))" style="display:flex;align-items:center;gap:6px;padding:5px 7px;cursor:pointer">
        <div onclick="event.stopPropagation();document.getElementById('${imgId}').click()" style="width:30px;height:30px;border-radius:50%;border:1px solid ${npc.color}55;background:${npc.color}18;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;color:${npc.color};cursor:pointer;flex-shrink:0">
          ${p.img?`<img src="${p.img}" style="width:100%;height:100%;object-fit:cover">`:`${p.ini||'?'}`}
        </div>
        <input type="file" id="${imgId}" accept="image/*" style="display:none" onchange="npcPlayerImg(event,${i},'${src}',${pi})">
        <input value="${p.name||''}" onclick="event.stopPropagation()" style="flex:1;background:var(--dark);border:1px solid var(--b2);border-radius:3px;color:#fff;font-size:10px;font-weight:700;padding:2px 4px" onchange="npcNameLive(${i},'${src}',${pi},this.value)">
        <select onclick="event.stopPropagation()" style="background:var(--dark);border:1px solid var(--b2);border-radius:3px;color:var(--muted);font-size:8px;padding:1px" onchange="npcPosLive(${i},'${src}',${pi},this.value)">
          ${['GB','DC','DD','DG','MDC','MC','MO','ATT','AG','AD'].map(pos=>`<option${p.pos===pos?' selected':''}>${pos}</option>`).join('')}
        </select>
        <span style="font-size:8px;font-weight:900;color:${ovrCol};min-width:18px;text-align:right">${ovr}</span>
        <button onclick="event.stopPropagation();cupNPCRemovePlayer(${i},'${src}',${pi})" style="background:transparent;border:1px solid #e0606044;color:#e06060;border-radius:4px;padding:0 5px;cursor:pointer;font-size:10px;flex-shrink:0">✕</button>
        <span class="tog" style="color:var(--muted);font-size:10px;flex-shrink:0">▼</span>
      </div>
      <div id="${detId}" style="display:none;padding:7px 9px;border-top:1px solid var(--b1)">
        ${statsH}
        <div style="font-size:7px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin:5px 0 3px">Sorts</div>
        <div style="display:flex;flex-wrap:wrap;gap:1px">${spH}</div>
      </div>
    </div>`;
  };

  const mkSec=(lbl,arr,src)=>`
    <div style="display:flex;align-items:center;gap:6px;margin:8px 0 4px">
      <div style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;flex:1">${lbl} (${arr.length})</div>
      <button onclick="cupNPCAddPlayer(${i},'${src}')" style="background:var(--card);border:1px dashed var(--b2);color:#69f0ae;border-radius:4px;padding:0 6px;cursor:pointer;font-size:10px">＋</button>
    </div>
    ${arr.map((p,pi)=>mkP(p,src,pi)).join('')}`;

  el.innerHTML=`<div style="padding:4px">
    <button onclick="renderCupSetup(document.getElementById('cup-out'))" style="background:var(--card);border:1px solid var(--b2);color:var(--muted);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px;margin-bottom:10px">← Retour</button>
    <!-- Header équipe -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <div>
        <div id="cei-badge" onclick="document.getElementById('cei-team-img').click()" style="width:48px;height:48px;border-radius:50%;border:2px solid ${npc.color};background:${npc.color}22;cursor:pointer;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:${npc.color}">
          ${npc.img?`<img src="${npc.img}" style="width:100%;height:100%;object-fit:cover">`:`${teamIni(npc.name)}`}
        </div>
        <input type="file" id="cei-team-img" accept="image/*" style="display:none" onchange="npcTeamImg(event,${i})">
      </div>
      <div style="flex:1">
        <input class="inp" value="${npc.name}" style="font-size:13px;font-weight:800;margin-bottom:5px;width:100%;box-sizing:border-box" oninput="npcFieldLive(${i},'name',this.value)">
        <div style="display:flex;gap:6px">
          <input type="color" value="${npc.color}" style="width:28px;height:26px;border:none;background:none;cursor:pointer;border-radius:4px" oninput="npcColorLive(${i},this.value)">
          <select class="inp" style="flex:1" onchange="npcFieldLive(${i},'strat',this.value)">
            ${STRATS.map(s=>`<option value="${s.id}"${(npc.strat||'321')===s.id?' selected':''}>${s.n}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
    <!-- OVR global -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:6px 8px;background:var(--card);border-radius:6px">
      <span style="font-size:9px;color:var(--muted);white-space:nowrap">Niveau global</span>
      <input type="range" min="1" max="99" value="${npc.ovr||60}" id="cei-ovr" oninput="document.getElementById('cei-ovr-v').textContent=this.value" style="flex:1">
      <span id="cei-ovr-v" style="font-size:11px;font-weight:900;color:#f0c028;min-width:22px;text-align:center">${npc.ovr||60}</span>
      <button onclick="ceiApplyOVR(${i})" style="background:#f0c02820;border:1px solid #f0c02844;color:#f0c028;border-radius:4px;padding:2px 7px;cursor:pointer;font-size:9px">Appliquer</button>
    </div>
    <!-- Actions -->
    <div style="display:flex;gap:5px;margin-bottom:10px">
      <button onclick="npcSaveToTeams(${i})" style="flex:1;background:var(--card);border:1px solid #69f0ae44;color:#69f0ae;border-radius:6px;padding:6px;cursor:pointer;font-size:10px">💾 → Mes équipes</button>
      <button onclick="cupInlineDelete(${i})" style="background:transparent;border:1px solid #e0606044;color:#e06060;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:10px">🗑 Supprimer</button>
    </div>
    <!-- Joueurs -->
    ${mkSec('⚽ Titulaires',npc.players,'players')}
    ${mkSec('🔄 Remplaçants',npc.bench||[],'bench')}
    ${mkSec('📋 Réservistes',npc.reserves||[],'reserves')}
    <div style="height:16px"></div>
  </div>`;
}

function npcToggle(id,togEl){
  const el=document.getElementById(id);
  if(!el)return;
  const open=el.style.display==='none'||el.style.display==='';
  el.style.display=open?'block':'none';
  if(togEl)togEl.textContent=open?'▲':'▼';
}

function cupNPCAddPlayer(npcIdx,src){
  const npc=_cupNPCPool[npcIdx];if(!npc)return;
  const arr=src==='bench'?npc.bench:src==='reserves'?npc.reserves:npc.players;
  const base=npc.ovr||60;
  const pNames=[...AI_NAMES].sort(()=>Math.random()-.5);
  const pos=src==='players'?'MC':src==='bench'?'ATT':'DC';
  arr.push({
    id:`cnpc${npcIdx}${src}${arr.length}`,name:pNames[arr.length%pNames.length]||'Nouveau',pos,
    ini:pNames[arr.length%pNames.length]?.slice(0,2)||'NJ',img:'',
    s:{spd:base,sht:base,def:base,stam:base,tec:base,res:base},
    spells:[],x:0,y:0,vx:0,vy:0,tx:0,ty:0,hp:100,mp:100,yc:0,red:false,
    stunT:0,hasBall:false,injLevel:0,injT:0,mG:0,mSh:0,mTk:0,mSp:0,
    bobPhase:Math.random()*Math.PI*2,wPhaseX:Math.random()*Math.PI*2,
    wPhaseY:Math.random()*Math.PI*2,wSpeed:1.6,runT:0,runCool:1,dribCurve:0,tackleCool:0
  });
  saveCupNPCPool();
  cupInlineEdit(npcIdx);
}

function cupNPCRemovePlayer(npcIdx,src,pi){
  const npc=_cupNPCPool[npcIdx];if(!npc)return;
  const arr=src==='bench'?npc.bench:src==='reserves'?npc.reserves:npc.players;
  if(arr.length<=1&&src==='players'){alert('Un titulaire minimum requis.');return;}
  arr.splice(pi,1);saveCupNPCPool();cupInlineEdit(npcIdx);
}

function ceiApplyOVR(i){
  const npc=_cupNPCPool[i];if(!npc)return;
  const ovr=parseInt(document.getElementById('cei-ovr')?.value||60);
  npc.ovr=ovr;
  [...(npc.players||[]),...(npc.bench||[]),...(npc.reserves||[])].forEach(p=>{
    if(p.s)Object.keys(p.s).forEach(k=>p.s[k]=Math.max(1,Math.min(99,ovr+Math.round((Math.random()-.5)*20))));
  });
  saveCupNPCPool();cupInlineEdit(i);
}

function confirmCreateCup(){
  const npcSel=_cupNPCPool.map((_,i)=>i).filter(i=>{const cb=document.getElementById(`cnpc${i}`);return cb?.checked;});
  const savedSel=savedTeams.map((_,i)=>i).filter(i=>{const cb=document.getElementById(`csc${i}`);return cb?.checked;});
  createCup(_cupFmt,_cupCount,savedSel,npcSel);
}

// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// SYSTÈME TACTIQUE
// ═══════════════════════════════════════════════════════════

let _tacTi=0;

function setTacTi(ti){
  _tacTi=ti;
  [0,1].forEach(i=>{
    const btn=document.getElementById('tacteam-'+i);
    if(!btn) return;
    btn.style.background=i===ti?(i===0?'rgba(224,32,48,0.35)':'rgba(24,120,232,0.35)'):'var(--card)';
    btn.style.color=i===ti?'#fff':'var(--muted)';
    btn.style.borderColor=i===ti?(i===0?'rgba(224,32,48,0.6)':'rgba(24,120,232,0.6)'):'var(--b1)';
  });
  updateTacBtnColors();
}

function setTacMode(ti,mode){
  if(!G.running) return;
  G.tacMode[ti]=mode;
  updateTacBtnColors();
  const lbl=document.getElementById('tac-lbl');
  if(lbl) lbl.textContent={
    'press':'Pressing — tu montes haut, tu perds en défense.',
    'defend':'Bloc défensif — tu encaisses moins mais tu attaques peu.',
    'attack':'Tout en attaque — risqué mais efficace pour renverser.',
    null:''
  }[mode]||'';
}

function updateTacBtnColors(){
  const mode=G.tacMode[_tacTi];
  ['press','defend','attack'].forEach(m=>{
    const btn=document.getElementById('tacb-'+m);
    if(!btn) return;
    const on=m===mode;
    btn.style.background=on?'var(--green)':'var(--card)';
    btn.style.color=on?'#000':'var(--text)';
    btn.style.borderColor=on?'var(--green)':'var(--b1)';
  });
  const rb=document.getElementById('tacb-reset');
  if(rb){ rb.style.background=mode===null?'rgba(255,255,255,0.12)':'var(--card)'; rb.style.color=mode===null?'#fff':'var(--muted)'; }
}

function showTacBtns(show){
  const el=document.getElementById('tac-btns');
  if(el) el.style.display=show?'flex':'none';
}

function renderTacSliders(ti, targetEl){
  const el = targetEl || document.getElementById('tac-sliders-'+ti);
  if(!el) return;
  if(!G.tacSliders) G.tacSliders=[{press:0.5,line:0,width:0,aggr:0,pressLine:0.5,style:'normal'},{press:0.5,line:0,width:0,aggr:0,pressLine:0.5,style:'normal'}];
  if(!G.tacSliders[ti]) G.tacSliders[ti]={press:0.5,line:0,width:0,aggr:0,pressLine:0.5,style:'normal'};
  const sl = G.tacSliders[ti];
  const T  = teams[ti];
  const col = T ? T.color : '#18c860';

  const row = (label, key, desc, mn=-1, mx=1, pct=false) => {
    const val = sl[key] !== undefined ? sl[key] : 0;
    const pctFill = Math.round((val - mn) / (mx - mn) * 100);
    const vc = pct ? (val > 0.6 ? '#69f0ae' : val > 0.3 ? '#ffd54f' : '#888')
                   : (val > 0 ? '#69f0ae' : val < 0 ? '#ef9a9a' : '#888');
    const display = pct ? pctFill + '%' : (val > 0 ? '+' : '') + val.toFixed(1);
    if(!el.id) el.id = 'tac-sl-'+ti+'-'+Date.now();
    const uid = 'tsl-' + ti + '-' + key + '-' + el.id;
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:10px;font-weight:600;color:#ccc">${label}</span>
        <span id="${uid}" style="font-size:9px;font-weight:700;color:${vc};min-width:36px;text-align:right">${display}</span>
      </div>
      <div style="position:relative;height:16px;display:flex;align-items:center">
        <div style="position:absolute;width:100%;height:4px;border-radius:2px;background:#333;overflow:hidden">
          <div id="${uid}-track" style="height:100%;width:${pctFill}%;background:${col};transition:width .05s"></div>
        </div>
        <input type="range" min="${mn}" max="${mx}" step="0.05" value="${val}"
          style="position:relative;width:100%;opacity:0;height:16px;cursor:pointer;margin:0;z-index:1"
          oninput="G.tacSliders[${ti}]['${key}']=parseFloat(this.value);const pf=Math.round((parseFloat(this.value)-(${mn}))/(${mx}-(${mn}))*100);const trk=document.getElementById('${uid}-track');if(trk)trk.style.width=pf+'%';const spn=document.getElementById('${uid}');if(spn){const v=parseFloat(this.value);const isPct=${pct};spn.textContent=isPct?pf+'%':(v>0?'+':'')+v.toFixed(1);spn.style.color=isPct?(pf>60?'#69f0ae':pf>30?'#ffd54f':'#888'):(v>0?'#69f0ae':v<0?'#ef9a9a':'#888');}">
      </div>
      <div style="font-size:8px;color:#666;margin-top:1px;font-style:italic">${desc}</div>
    </div>`;
  };

  const styleBtn = (s, label) => {
    const on = (sl.style || 'normal') === s;
    return `<button onclick="setTacStyle(${ti},'${s}',document.getElementById('${el.id}'))"
      style="flex:1;font-size:8px;padding:4px 2px;border-radius:4px;cursor:pointer;
             border:1px solid ${on ? col : '#333'};
             background:${on ? col + '33' : 'transparent'};
             color:${on ? col : '#666'};font-weight:${on ? '700' : '400'}">${label}</button>`;
  };

  el.innerHTML = `
    <div style="font-size:10px;font-weight:700;color:${col};margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">${T ? T.name : 'Equipe'}</div>
    <div style="margin-bottom:10px">
      <div style="font-size:9px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Style de jeu</div>
      <div style="display:flex;gap:3px">
        ${styleBtn('normal',    'Normal')}
        ${styleBtn('possession','Possession')}
        ${styleBtn('direct',    'Direct')}
        ${styleBtn('counter',   'Contre')}
      </div>
    </div>
    ${row('Pressing',       'press',     'Intensite : combien de joueurs foncent ensemble sur le porteur une fois dans la zone (bas = 1 seul, haut = groupe entier).',  0,   1, true)}
    ${row('Hauteur du pressing',  'pressLine', 'Bas = presse des que le ballon sort de sa propre surface (bloc bas). Haut = ne presse que tres haut, pres du but adverse (pressing haut / gegenpress).', 0, 1, true)}
    ${row('Ligne defensive','line',      '+ = hors-jeu tendus, - = bloc bas profond.')}
    ${row('Largeur',        'width',     '+ = jeu sur les ailes, - = jeu dans l axe.')}
    ${row('Agressivite',    'aggr',      '+ = plus d occasions et de fautes.')}
  `;
}

function renderPlayerRoles(ti, targetEl){
  const el = targetEl || document.getElementById('player-roles-'+ti);
  if(!el) return;
  const T=teams[ti];
  if(!T||!T.players.length){el.innerHTML='<div style="font-size:9px;color:var(--muted)">Pas de joueurs configurés.</div>';return;}
  if(typeof ensureRoleArrays==='function') ensureRoleArrays(ti);
  if(!G.playerRoles[ti]) G.playerRoles[ti]=T.players.map(()=>'normal');
  while(G.playerRoles[ti].length<T.players.length) G.playerRoles[ti].push('normal');
  const col=T.color||'#18c860';
  const scheme=(G.tacSliders?.[ti]?.defScheme)||'zone';
  const markMode=(G.tacSliders?.[ti]?.markMode)||'auto';

  // ── Bandeau d'équipe : schéma défensif (zone/homme) + mode de marquage ──
  const schemeBtn=(v,label)=>`<button onclick="setDefScheme(${ti},'${v}')"
    style="flex:1;font-size:8px;padding:3px 2px;border-radius:4px;cursor:pointer;border:1px solid ${scheme===v?col:'#333'};background:${scheme===v?col+'33':'transparent'};color:${scheme===v?col:'#666'};font-weight:${scheme===v?'700':'400'}">${label}</button>`;
  const markBtn=(v,label)=>`<button onclick="setMarkMode(${ti},'${v}')"
    style="flex:1;font-size:8px;padding:3px 2px;border-radius:4px;cursor:pointer;border:1px solid ${markMode===v?col:'#333'};background:${markMode===v?col+'33':'transparent'};color:${markMode===v?col:'#666'};font-weight:${markMode===v?'700':'400'}">${label}</button>`;

  let html='<div style="font-size:9px;font-weight:600;color:'+col+';text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">'+T.name+'</div>';
  html+=`<div style="margin-bottom:6px">
      <div style="font-size:8px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Schéma défensif</div>
      <div style="display:flex;gap:3px;margin-bottom:4px">${schemeBtn('zone','Zone')}${schemeBtn('homme','Individuel')}</div>
      <div style="font-size:8px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">Marquage</div>
      <div style="display:flex;gap:3px">${markBtn('auto','Auto')}${markBtn('manual','Manuel')}</div>
    </div>`;

  // Options du sélecteur de cible de marquage (adversaires), pour le mode manuel.
  const oppTeam=teams[1-ti];
  const oppOptions=(sel)=>{
    let o='<option value="">— aucun —</option>';
    if(oppTeam) oppTeam.players.forEach(op=>{
      o+=`<option value="${op.id}" ${sel===op.id?'selected':''}>${(op.name||'?')} (${op.pos||''})</option>`;
    });
    return o;
  };

  html+=T.players.map((p,i)=>{
    const r=G.playerRoles[ti][i]||'normal';
    const roleName=(typeof playerRoleOf==='function')?playerRoleOf(ti,i):'zone';
    const aggrBtn=(v,label)=>`<button onclick="setPlayerRole(${ti},${i},'${v}')"
      style="font-size:7px;padding:2px 5px;border-radius:3px;cursor:pointer;border:1px solid ${r===v?col:'var(--b1)'};background:${r===v?col+'33':'transparent'};color:${r===v?col:'var(--muted)'}">${label}</button>`;
    // Sélecteur de rôle nommé
    const roleOpts=(typeof rolesForPos==='function'?rolesForPos(p.pos):Object.keys(PLAYER_ROLES))
      .map(id=>`<option value="${id}" ${roleName===id?'selected':''}>${PLAYER_ROLES[id].name}</option>`).join('');
    const roleSelect=`<select onchange="setPlayerRoleName(${ti},${i},this.value)"
      style="font-size:7px;padding:1px 2px;border-radius:3px;background:var(--b0,#1a1a1a);color:${col};border:1px solid var(--b1,#333);max-width:120px">${roleOpts}</select>`;
    // Sélecteur de cible de marquage : visible seulement en marquage manuel
    // ET si le joueur joue individuel (rôle marqueur ou schéma homme).
    const showMark = markMode==='manual' && (roleName==='marqueur' || scheme==='homme') && p.pos!=='GB';
    const markSel = showMark
      ? `<select onchange="setPlayerMarkTarget(${ti},${i},this.value)" style="font-size:7px;padding:1px 2px;border-radius:3px;background:var(--b0,#1a1a1a);color:#ffb74d;border:1px solid var(--b1,#333);max-width:110px">${oppOptions(G.playerMarkTarget?.[ti]?.[i]||'')}</select>`
      : '';
    return `<div style="display:flex;flex-direction:column;gap:2px;margin-bottom:5px;padding-bottom:4px;border-bottom:1px solid var(--b1,#2a2a2a)">
      <div style="display:flex;align-items:center;gap:4px">
        <span style="font-size:8px;color:var(--text);width:58px;overflow:hidden;white-space:nowrap">${p.name||'?'}</span>
        <span style="font-size:7px;color:var(--muted);width:22px">${p.pos||''}</span>
        ${roleSelect}
      </div>
      <div style="display:flex;align-items:center;gap:4px;padding-left:80px">
        ${aggrBtn('def','Déf')}${aggrBtn('normal','Normal')}${aggrBtn('atk','Att')}
        ${markSel}
      </div>
    </div>`;
  }).join('');
  el.innerHTML=html;
}

function setPlayerRole(ti,pi,role){
  if(!G.playerRoles[ti]) G.playerRoles[ti]=[];
  G.playerRoles[ti][pi]=role;
  renderPlayerRoles(ti);
  persistTeamRoles(ti);
}
// ── Setters Niveau 3 ────────────────────────────────────────────────────
function setPlayerRoleName(ti,pi,roleId){
  if(typeof ensureRoleArrays==='function') ensureRoleArrays(ti);
  if(!PLAYER_ROLES[roleId]) return;
  G.playerRoleName[ti][pi]=roleId;
  // Si le joueur n'est plus en marquage, on nettoie sa cible manuelle.
  if(roleId!=='marqueur' && (G.tacSliders?.[ti]?.defScheme)!=='homme'){
    if(G.playerMarkTarget?.[ti]) G.playerMarkTarget[ti][pi]=null;
  }
  renderPlayerRoles(ti);
  persistTeamRoles(ti);
}
function setPlayerMarkTarget(ti,pi,oppId){
  if(typeof ensureRoleArrays==='function') ensureRoleArrays(ti);
  G.playerMarkTarget[ti][pi]= oppId || null;
  renderPlayerRoles(ti);
  persistTeamRoles(ti);
}
function setDefScheme(ti,scheme){
  if(!G.tacSliders[ti]) G.tacSliders[ti]={};
  G.tacSliders[ti].defScheme = (scheme==='homme')?'homme':'zone';
  renderPlayerRoles(ti);
  persistTeamRoles(ti);
}
function setMarkMode(ti,mode){
  if(!G.tacSliders[ti]) G.tacSliders[ti]={};
  G.tacSliders[ti].markMode = (mode==='manual')?'manual':'auto';
  renderPlayerRoles(ti);
  persistTeamRoles(ti);
}

// ══════════════════════════════════════════════════════════════════════
// PERSISTANCE DES RÔLES / SCHÉMA DÉFENSIF (Niveau 3, socle)
// Les tactiques n'étaient historiquement PAS sauvegardées (session seulement).
// Pour ne pas toucher à la sérialisation de carrière (risque de régression),
// on persiste ici la config par ÉQUIPE dans un store localStorage dédié, clé
// par nom d'équipe. C'est autonome, rétro-compatible, et sans effet sur les
// anciennes sauvegardes. Restauré par restoreTeamRoles() au chargement.
// ══════════════════════════════════════════════════════════════════════
const _ROLE_STORE_KEY='footsim_teamRoles_v1';
function _loadRoleStore(){
  try{ const d=localStorage.getItem(_ROLE_STORE_KEY); return d?JSON.parse(d):{}; }
  catch(e){ return {}; }
}
function _saveRoleStore(store){
  try{ localStorage.setItem(_ROLE_STORE_KEY, JSON.stringify(store)); }catch(e){}
}
function persistTeamRoles(ti){
  const T=teams[ti]; if(!T||!T.name) return;
  if(typeof ensureRoleArrays==='function') ensureRoleArrays(ti);
  const store=_loadRoleStore();
  const sl=G.tacSliders?.[ti]||{};
  // Sauver le rôle et la cible de marquage PAR NOM DE JOUEUR (robuste à un
  // changement d'ordre du roster) plus le schéma d'équipe.
  const perPlayer={};
  T.players.forEach((p,i)=>{
    if(!p||!p.name) return;
    perPlayer[p.name]={
      role: G.playerRoleName?.[ti]?.[i] || null,
      mark: G.playerMarkTarget?.[ti]?.[i] || null,
      aggr: G.playerRoles?.[ti]?.[i] || 'normal',
    };
  });
  store[T.name]={ defScheme:sl.defScheme||'zone', markMode:sl.markMode||'auto', players:perPlayer };
  _saveRoleStore(store);
}
function restoreTeamRoles(ti){
  const T=teams[ti]; if(!T||!T.name) return;
  if(typeof ensureRoleArrays==='function') ensureRoleArrays(ti);
  const store=_loadRoleStore();
  const rec=store[T.name];
  if(!rec) return; // rien de sauvé pour cette équipe → défauts par poste (déjà posés)
  if(!G.tacSliders[ti]) G.tacSliders[ti]={};
  if(rec.defScheme) G.tacSliders[ti].defScheme=rec.defScheme;
  if(rec.markMode)  G.tacSliders[ti].markMode=rec.markMode;
  T.players.forEach((p,i)=>{
    const pr=rec.players?.[p?.name];
    if(!pr) return;
    if(pr.role && PLAYER_ROLES[pr.role]) G.playerRoleName[ti][i]=pr.role;
    if(pr.mark!==undefined) G.playerMarkTarget[ti][i]=pr.mark||null;
    if(pr.aggr) G.playerRoles[ti][i]=pr.aggr;
  });
}

function setTacStyle(ti, style, containerEl){
  G.tacSliders[ti].style = style;
  if(style==='possession'){ G.tacSliders[ti].line=0.2;  G.tacSliders[ti].width=0.3;  G.tacSliders[ti].aggr=-0.2; }
  if(style==='direct')    { G.tacSliders[ti].line=0.1;  G.tacSliders[ti].width=-0.1; G.tacSliders[ti].aggr=0.4;  }
  if(style==='counter')   { G.tacSliders[ti].line=-0.6; G.tacSliders[ti].press=0.2;  G.tacSliders[ti].aggr=-0.1; }
  if(style==='normal')    { G.tacSliders[ti].line=0;    G.tacSliders[ti].width=0;    G.tacSliders[ti].aggr=0;    }
  renderTacSliders(ti, containerEl || null);
}

function updateSliderTrack(input,ti,key,col){
  const min=parseFloat(input.min),max=parseFloat(input.max),val=parseFloat(input.value);
  const pct=Math.round((val-min)/(max-min)*100);
  input.style.background='linear-gradient(to right,'+col+' '+pct+'%,#333 '+pct+'%)';
}

function setTacSlider(ti,key,val,min,max,isPct){
  G.tacSliders[ti][key]=val;
  const span=document.getElementById('tsl-'+ti+'-'+key);
  if(span){
    const col=val>0?'#69f0ae':val<0?'#ef9a9a':'#888';
    if(isPct){
      const m0=min||0,m1=max||1;
      span.textContent=Math.round((val-m0)/(m1-m0)*100)+'%';
      span.style.color=val>0.6?'#69f0ae':val>0.3?'#ffd54f':'#888';
    } else {
      span.textContent=(val>0?'+':'')+val.toFixed(1);
      span.style.color=col;
    }
  }
}

function updateLiveStatus(){
  const el=document.getElementById('live-status');
  if(!el) return;
  if(!G.running){ el.style.display='none'; return; }
  el.style.display='block';
  [0,1].forEach(ti=>{
    const cont=document.getElementById('live-p'+ti);
    if(!cont) return;
    const T=teams[ti];
    const players=teams[ti].players.filter(p=>!p.red&&(p.hp===undefined||p.hp>0));
    cont.innerHTML=players.map(p=>{
      const hp=Math.round(p.hp===undefined?100:p.hp);
      const mp=Math.round(p.mp===undefined?100:p.mp);
      const hpC=hp>60?'#69f0ae':hp>30?'#ffd54f':'#ef5350';
      const mpC=mp>60?'#7b3fff':mp>30?'#b39ddb':'#ef5350';
      return `<div style="display:flex;align-items:center;gap:3px;margin-bottom:1px">
        <span style="font-size:7px;color:${T?T.color:'#fff'};width:22px;overflow:hidden;white-space:nowrap;font-weight:600">${(p.name||'').split(' ')[0].slice(0,4)}</span>
        <div style="flex:1;height:3px;background:rgba(255,255,255,.08);border-radius:1px">
          <div style="height:100%;width:${hp}%;background:${hpC};border-radius:1px;transition:width .5s"></div>
        </div>
        <div style="width:22px;height:3px;background:rgba(255,255,255,.08);border-radius:1px;margin-left:1px">
          <div style="height:100%;width:${mp}%;background:${mpC};border-radius:1px;transition:width .5s"></div>
        </div>
      </div>`;
    }).join('');
  });
}

function exportTeamJSON(idx){
  const t=savedTeams[idx];
  if(!t){logEvent('Équipe introuvable.','#ef5350');return;}
  exportTeamData(t);
}

// Exporte n'importe quel objet équipe en JSON (équipes PNJ de coupe/ligue,
// équipes sauvegardées, etc.). Nettoie les champs runtime avant l'export.
function exportTeamData(t,nameOverride){
  if(!t){logEvent('Équipe introuvable.','#ef5350');return;}
  // Copie propre : on retire les états de match transitoires et l'uid interne.
  const clean=p=>{
    if(!p)return p;
    const{x,y,vx,vy,tx,ty,hp,mp,yc,red,stunT,hasBall,onBench,subbedOut,injLevel,injT,
      mG,mSh,mTk,mSp,mA,_img,_hm,_fm,_dominated,_dominatedBy,_domDebuffApplied,
      _domSavedSht,_domSavedSpd,_dragon,_dragonBoosted,_atkBuff,_spdDebuff,_pacified,
      _charmed,_sixsens,_sylvestre,_aile,_invis,_folie,_flee,_auraDivine,_auraDivineActive,
      _aideDivine,_dope_sht,_dope_spd,_dope_tec,_dope_def,_dopeT,_boingCount,_missNextMatch,
      ...keep}=p;
    return keep;
  };
  const out={
    name:nameOverride||t.name,
    color:t.color,
    img:t.img||'',
    strat:t.strat,
    stratAtk:t.stratAtk||null,
    players:(t.players||[]).map(clean),
    bench:(t.bench||[]).map(clean),
    reserves:(t.reserves||[]).map(clean),
  };
  const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=(out.name||'equipe').replace(/[^a-zA-Z0-9_-]/g,'_')+'.json';
  document.body.appendChild(a);a.click();
  document.body.removeChild(a);URL.revokeObjectURL(url);
  logEvent('📤 Export JSON : '+out.name,'#69f0ae');
}

// Export d'une équipe de COUPE par son id (résout PNJ / sauvegardée / user).
function exportCupTeamJSON(cupId){
  const data=getCupTeamData(cupId);
  const lt=cupState?.teams.find(t=>t.id===cupId);
  if(!data){logEvent('Données équipe introuvables.','#ef5350');return;}
  exportTeamData(data, lt?.name||data.name);
}
// Export de l'équipe actuellement ouverte dans l'éditeur de coupe (via son ref).
function exportCurrentCupEditTeam(ref){
  const r=_cteRef(ref);
  if(!r||!r.ref){logEvent('Impossible d\'exporter cette équipe.','#ef5350');return;}
  exportTeamData(r.ref);
}
// Export d'une équipe de LIGUE par son id.
function exportLeagueTeamJSON(lid){
  const data=getLeagueTeamData(lid);
  const lt=leagueState?.teams.find(t=>t.id===lid);
  if(!data){logEvent('Données équipe introuvables.','#ef5350');return;}
  exportTeamData(data, lt?.name||data.name);
}

function importTeamJSON(ti){
  // ti = 0 (Rouges) ou 1 (Bleus) — charge directement dans l'équipe active
  const inp=document.createElement('input');
  inp.type='file'; inp.accept='.json';
  inp.onchange=e=>{
    const file=e.target.files[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const d=JSON.parse(ev.target.result);
        const raw=Array.isArray(d)?d[0]:d;
        if(!raw||!raw.name||!raw.players){
          logEvent('❌ JSON invalide — champs manquants.','#ef5350'); return;
        }
        // Normaliser les positions du générateur vers des postes FootSim complets
        const normalizePos=pos=>({
          'GB':'GB','GK':'GB','DC':'DC','DEF':'DC','DD':'DD','DG':'DG',
          'MC':'MC','MDC':'MDC','MID':'MC','MO':'MO','MOG':'MOG','MOD':'MOD',
          'ATT':'ATT','AG':'AG','AD':'AD'
        }[pos]||'MC');
        const posGrpI=pos=>(pos==='GB'?0:['DC','DD','DG'].includes(pos)?1:['ATT','AG','AD'].includes(pos)?3:2);
        const normalizeStats=s=>{
          if(!s) return {spd:60,sht:60,def:60,stam:60,tec:60,res:60};
          return {spd:s.spd||s.speed||s.vit||60,sht:s.sht||s.shoot||s.tir||60,
            def:s.def||s.defense||60,stam:s.stam||s.stamina||s.end||60,
            tec:s.tec||s.tech||60,res:s.res||s.resistance||60};
        };
        const rebuild=(arr,pfx)=>(arr||[])
          .map(p=>({...p,pos:normalizePos(p.pos||'MC'),s:normalizeStats(p.s)}))
          .sort((a,b)=>posGrpI(a.pos)-posGrpI(b.pos))
          .map((p,i)=>serializePlayer({...p,id:`${pfx}${i}`,spells:p.spells||[],ini:p.ini||(p.name||'?').slice(0,2).toUpperCase()
        }));
        const team={
          name:raw.name,
          color:raw.color||'#e02030',
          img:raw.img||'',
          strat:raw.strat||'321',
          players:rebuild(raw.players,`t${ti}p`),
          bench:rebuild(raw.bench||[],`t${ti}b`),
          reserves:rebuild(raw.reserves||[],`t${ti}r`),
          isHuman:true
        };
        // Charger dans l'équipe active (0 ou 1)
        if(ti===0||ti===1){
          teams[ti]=team;
          renderTB(ti);
          renderPlayerRoles(ti);
          syncHUD();
          updateCompoPitch();
          placeKickoff(0);
        }
        // Compresser les images avant de sauvegarder dans le roster
        _compressTeamImages(team,()=>{
          const ri=savedTeams.findIndex(t=>t.name===team.name);
          if(ri>=0) savedTeams[ri]=team; else savedTeams.push(team);
          persistSavedTeams();
          if(ti===0||ti===1){renderTB(ti);syncHUD();}
        });
        logEvent('✅ '+team.name+' chargée en '+(ti===0?'Rouges':'Bleus'),team.color);
      }catch(err){
        logEvent('❌ Erreur import : '+err.message,'#ef5350');
        console.error(err);
      }
    };
    reader.readAsText(file);
  };
  inp.click();
}

// BOOT
// ═══════════════════════════════════════════════════════════
cvs=document.getElementById('cvs');
ctx=cvs.getContext('2d');
// ── Garde-fou anti-crash : un rayon négatif (ex: sur un pulse/sinus mal
// borné) faisait planter tout le rendu avec "IndexSizeError: The radius
// provided is negative". On clamp désormais systématiquement à 0 plutôt
// que de laisser le navigateur lever une exception non rattrapée.
(function(){
  const _origArc=CanvasRenderingContext2D.prototype.arc;
  CanvasRenderingContext2D.prototype.arc=function(x,y,r,a1,a2,ccw){
    return _origArc.call(this,x,y,Math.max(0,r||0),a1,a2,ccw);
  };
  const _origEllipse=CanvasRenderingContext2D.prototype.ellipse;
  CanvasRenderingContext2D.prototype.ellipse=function(x,y,rx,ry,rot,a1,a2,ccw){
    return _origEllipse.call(this,x,y,Math.max(0,rx||0),Math.max(0,ry||0),rot,a1,a2,ccw);
  };
})();
window.addEventListener('resize',resize);
window.addEventListener('orientationchange',()=>setTimeout(resize,200));
// Prevent default touch scroll on canvas to avoid rubber-band effect
document.getElementById('canvas-wrap')?.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
loadProfiles();loadLeague();loadSavedTeams();
if(typeof injectPresetTeams==='function'){ try{ injectPresetTeams(); }catch(e){ console.error('injectPresetTeams:',e); } }
if(typeof ensureValoriaBadges==='function'){ try{ ensureValoriaBadges(); }catch(e){ console.error('ensureValoriaBadges:',e); } }
loadCup();loadCareerV2();
renderTB(0);renderTB(1);renderTactics();syncHUD();renderTacSliders(0);renderTacSliders(1);renderPlayerRoles(0);renderPlayerRoles(1);
resize();placeKickoff(0);
requestAnimationFrame(frame);
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// MODE CARRIÈRE
// ═══════════════════════════════════════════════════════════════

// ── Constantes économie ─────────────────────────────────────────
const CAREER_BUDGET_START = 800;       // 🪙 départ (quelques centaines)
const CAREER_SEASON_MATCHES = 14;      // matchs aller par saison

const CAREER_MATCH_REVENUE = {
  home: { win:160, draw:70, loss:25 },
  away: { win:100, draw:45, loss:12 },
};

const CAREER_SPONSOR_CONTRACTS = [
  { id:'local',   name:'Sponsor local',    icon:'🏪', fee:60,  perWin:5,  condition:'none',   desc:'Petit commerçant local' },
  { id:'regional',name:'Sponsor régional', icon:'🏢', fee:150, perWin:12, condition:'d2top4', desc:'Terminer dans le top 4 en D2' },
  { id:'national',name:'Sponsor national', icon:'🏬', fee:400, perWin:25, condition:'d1',     desc:'Être en Division 1' },
  { id:'elite',   name:'Sponsor élite',    icon:'💎', fee:800, perWin:50, condition:'d1top3', desc:'Top 3 en Division 1' },
];

const INFRA_DEFS = {
  stadium:  { name:"Stade amélioré",      icon:'🏟️', desc:'+30% revenus billetterie/niv.', cost:500,  weekly:10, lvlMax:3 },
  training: { name:"Centre d'entraîn.",   icon:'⚽',  desc:'Débloque les séances payantes', cost:350,  weekly:8,  lvlMax:3 },
  formation:{ name:"Centre de formation", icon:'🌱',  desc:'Jeunes talents en fin de saison',cost:700,  weekly:12, lvlMax:2 },
  medical:  { name:"Centre médical",      icon:'🏥',  desc:'-50% blessures, +HP récup',     cost:450,  weekly:8,  lvlMax:2 },
};

// ═══════════════════════════════════════════════════════════
// CHANTIERS D'INFRASTRUCTURE (careerV2) — travaux réalistes
// ───────────────────────────────────────────────────────────
// Améliorer une infra n'est plus instantané : on lance un CHANTIER qui dure
// plusieurs semaines, passe par une phase d'AUTORISATION (permis) puis de
// CONSTRUCTION, se paie en TRANCHES hebdomadaires, et peut subir des RETARDS
// ou DÉPASSEMENTS de budget. L'effet (montée de niveau) ne s'applique qu'à la
// fin. Un chantier avance à chaque advanceCareerWeek().
// ───────────────────────────────────────────────────────────
const INFRA_V2_DEFS = {
  stadium:  { name:'Stade',              icon:'🏟️', max:5, permitWeeks:[0,2,3,3,4], buildWeeks:[0,4,6,8,10], baseCost:[0,14000,34000,80000,170000], effect:'+places · +revenus billetterie' },
  training: { name:"Centre d'entraînement", icon:'⚽', max:5, permitWeeks:[0,1,1,2,2], buildWeeks:[0,3,4,5,6],  baseCost:[0,10000,23000,50000,100000], effect:'+gain de stats à l\'entraînement' },
  formation:{ name:'Académie / centre jeunes', icon:'🌱', max:5, permitWeeks:[0,1,2,2,3], buildWeeks:[0,3,5,7,9],  baseCost:[0,12000,29000,62000,125000], effect:'+qualité et quantité des jeunes' },
  medical:  { name:'Centre médical',     icon:'🏥', max:5, permitWeeks:[0,1,1,2,2], buildWeeks:[0,2,4,5,6],  baseCost:[0,8000,19000,40000,80000], effect:'-blessures · +récupération' },
  scout:    { name:'Réseau de scouts',   icon:'🔭', max:5, permitWeeks:[0,0,1,1,1], buildWeeks:[0,2,3,4,5],  baseCost:[0,7000,16000,34000,68000], effect:'+découverte de talents' },
};

// Noms d'état lisibles selon la qualité (0-100) d'une installation.
function infraStateLabel(pct){
  if(pct>=75) return {txt:'🟢 Optimal', col:'#18c860'};
  if(pct>=45) return {txt:'🟡 À surveiller', col:'#f0c028'};
  return {txt:'🔴 Critique', col:'#e06060'};
}

// Lance un chantier d'amélioration vers le niveau suivant. Retourne un message.
function startInfraWork(key){
  const C = careerV2; if(!C) return;
  const def = INFRA_V2_DEFS[key]; if(!def){ logEvent('Infrastructure inconnue','#e02030'); return; }
  C.club.works = C.club.works || [];
  if(C.club.works.some(w=>w.key===key)){ logEvent('⚠️ Un chantier est déjà en cours sur cette installation.','#f0c028'); return; }
  const lvl = (C.club.infra&&C.club.infra[key])||0;
  const target = lvl+1;
  if(target>def.max){ logEvent('✅ Installation déjà au niveau maximum.','#18c860'); return; }
  const permit = def.permitWeeks[target]||0;
  const build  = def.buildWeeks[target]||0;
  const totalWeeks = permit+build;
  const totalCost = def.baseCost[target]||0;
  // Acompte au lancement (10%) — le reste est payé en tranches hebdomadaires.
  const deposit = Math.round(totalCost*0.10);
  if((C.club.budget||0) < deposit){ logEvent('💸 Budget insuffisant pour lancer les travaux (acompte '+_fmtMoney(deposit)+').','#e02030'); return; }
  C.club.budget -= deposit;
  const weeklyInstalment = Math.round((totalCost-deposit)/Math.max(1,totalWeeks));
  C.club.works.push({
    key, target, phase: permit>0?'permit':'build',
    permitLeft: permit, buildLeft: build,
    weeksTotal: totalWeeks, weeksLeft: totalWeeks,
    weeklyInstalment, paid: deposit, totalCost,
    delayed:false,
  });
  logEvent('🏗 Travaux lancés : '+def.name+' → niveau '+target+' ('+totalWeeks+' sem., acompte '+_fmtMoney(deposit)+').', C.club.color||'#f0c028');
  try{ saveCareerV2(); }catch(e){}
}

// Fait avancer TOUS les chantiers d'une semaine : paiement de la tranche,
// phases permis→build, aléas (retard, dépassement), et achèvement.
function _advanceInfraWorks(){
  const C = careerV2; if(!C || !C.club || !C.club.works || !C.club.works.length) return;
  const remaining = [];
  C.club.works.forEach(function(w){
    const def = INFRA_V2_DEFS[w.key]; if(!def){ return; }
    // Paiement de la tranche hebdomadaire (si budget le permet).
    if(w.weeksLeft>0 && w.weeklyInstalment>0){
      if((C.club.budget||0) >= w.weeklyInstalment){
        C.club.budget -= w.weeklyInstalment; w.paid += w.weeklyInstalment;
      } else {
        // Pas payé → chantier retardé cette semaine (les travaux s'arrêtent).
        w.delayed = true;
        if(typeof careerLog==='function') careerLog('⏸ Travaux ('+def.name+') suspendus : trésorerie insuffisante pour la tranche.','#e06060');
        remaining.push(w); return;
      }
    }
    w.delayed = false;
    // Phase autorisation d'abord.
    if(w.phase==='permit' && w.permitLeft>0){
      w.permitLeft--;
      // Petit risque de retard administratif (permis rallongé d'1 semaine).
      if(Math.random()<0.12){ w.permitLeft++; w.weeksLeft++; if(typeof careerLog==='function') careerLog('📋 Retard administratif sur '+def.name+' (+1 sem.).','#f0c028'); }
      if(w.permitLeft<=0){ w.phase='build'; if(typeof careerLog==='function') careerLog('✅ Permis accordé pour '+def.name+' — les travaux commencent !','#18c860'); }
      w.weeksLeft = Math.max(0, w.weeksLeft-1);
      remaining.push(w); return;
    }
    // Phase construction.
    if(w.buildLeft>0){
      w.buildLeft--;
      // Risque de dépassement (surcoût imprévu) + parfois retard.
      if(Math.random()<0.10){
        const extra = Math.round(w.totalCost*0.05);
        w.totalCost += extra; w.weeklyInstalment = Math.round((w.totalCost-w.paid)/Math.max(1,w.buildLeft+1));
        if(typeof careerLog==='function') careerLog('💰 Dépassement sur '+def.name+' : +'+_fmtMoney(extra)+' de surcoût.','#e06060');
      }
      if(Math.random()<0.08){ w.buildLeft++; w.weeksLeft++; if(typeof careerLog==='function') careerLog('🚧 Retard de chantier ('+def.name+') : +1 sem.','#f0c028'); }
      w.weeksLeft = Math.max(0, w.weeksLeft-1);
    }
    // Achèvement.
    if(w.buildLeft<=0 && w.phase==='build'){
      C.club.infra = C.club.infra || {};
      C.club.infra[w.key] = w.target;
      if(typeof careerLog==='function') careerLog('🎉 '+def.name+' terminé — niveau '+w.target+' ! ('+def.effect+')','#18c860');
    } else {
      remaining.push(w);
    }
  });
  C.club.works = remaining;
}


const TRAINING_SESSIONS = [
  { id:'light',    name:'Légère',        cost:12,  chance:.35, stats:['stam','res'],         desc:'Récupération endurance' },
  { id:'tactical', name:'Tactique',      cost:20,  chance:.30, stats:['tec','def'],          desc:'Technique & défense' },
  { id:'physical', name:'Physique',      cost:20,  chance:.30, stats:['spd','stam'],         desc:'Vitesse & condition' },
  { id:'shooting', name:'Tir',           cost:25,  chance:.25, stats:['sht','tec'],          desc:'Tir & technique' },
  { id:'elite',    name:'Élite (coach)', cost:60,  chance:.50, stats:['spd','sht','tec','def'], desc:'Coach pro · meilleur taux' },
];

const CAREER_DIV_NAMES = ['Division 1','Division 2','Division 3'];
const CAREER_DIV_SIZES = [8, 8, 8];
const CAREER_AGENT_NAMES = ['Marco Rossi','João Silva','Ahmed Kazi','Luca Brun','Piet Van Berg','Carlos Díaz'];

// ── Helpers ─────────────────────────────────────────────────────
let careerState = null;

const careerOvr = p => { const s=p.s||{}; return Math.round(((s.sht||50)+(s.spd||50)+(s.def||50)+(s.stam||50)+(s.tec||50)+(s.res||50))/6); };
// Échelle : 1 pièce d'or ≈ 100 €. Valeur EXPONENTIELLE de l'OVR (un crack vaut
// des dizaines de fois un joueur moyen), calée sur des ordres de grandeur réels :
// OVR40≈20k€, OVR70≈4M€, OVR80≈25M€, OVR88≈100M€, OVR92≈210M€.
const careerValue = p => { const o=careerOvr(p); return Math.round(200*Math.exp(0.178*(o-40))); };
// Salaire hebdo ≈ 12 % de la valeur / an. OVR70≈10k€/sem, OVR80≈57k€/sem, star≈240k€/sem.
const careerWeeklySalary = p => Math.max(1, Math.round(careerValue(p)*0.12/52));
const fmtG = n => {
  const abs=Math.abs(n); const sign=n<0?'-':'';
  if(abs>=1000000) return sign+'🪙'+(abs/1000000).toFixed(2).replace(/\.?0+$/,'')+'M';
  if(abs>=1000) return sign+'🪙'+(abs/1000).toFixed(1).replace(/\.0$/,'')+'K';
  return sign+'🪙'+abs;
};
const infraWeekly = C => Object.entries(C.playerClub?.infra||{}).reduce((s,[k,lvl])=>s+(lvl>0?((INFRA_DEFS[k]?.weekly||0)*lvl):0),0);
const totalWeekly = C => (C.weeklyWage||0) + infraWeekly(C);

const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function saveCareer(){ _safeLSSet('footsim7v7_career',careerState); }
function loadCareer(){
  try{
    const d=localStorage.getItem('footsim7v7_career');
    if(!d) return;
    const st=JSON.parse(d);
    if(!st?.playerClub) return; // corrupt
    // Migrate: ensure all expected fields exist
    const PC=st.playerClub;
    if(!PC.infra) PC.infra={stadium:0,training:0,formation:0,medical:0};
    if(!PC.sponsorId) PC.sponsorId='local';
    if(!st.seasonStats) st.seasonStats={wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0};
    if(!st.pendingOffers) st.pendingOffers=[];
    if(!st.trainingLog) st.trainingLog=[];
    if(!st.youthPlayers) st.youthPlayers=[];
    if(!st.transferMarket) st.transferMarket=[];
    if(!PC.strat) PC.strat='321'; // migration
    if(st._loanTaken===undefined) st._loanTaken=false;
    if(!st._loanAmount) st._loanAmount=0;
    if(!st.divCup) st.divCup=null;
    if(!st.natCup) st.natCup=null;
    if(!st.log) st.log=[];
    if(!st.divClubs) return; // corrupt
    careerState=st;
  }catch(e){console.warn('Career load error:',e);}
}
function rescueCareer(){
  // Lire ce qu'on peut de la save corrompue
  let st = null;
  try{ const d=localStorage.getItem('footsim7v7_career'); if(d) st=JSON.parse(d); }catch(e){}

  // Récupérer ce qu'on peut sauver
  const savedName  = st?.playerClub?.name  || teams[0]?.name  || 'Mon Club';
  const savedColor = st?.playerClub?.color || teams[0]?.color || '#18c860';
  const savedImg   = st?.playerClub?.img   || teams[0]?.img   || '';
  const savedDiv   = (st?.playerClub?.div >= 0 && st?.playerClub?.div <= 2) ? st.playerClub.div : 1;
  const savedSeason= (st?.season >= 1 && st?.season <= 50) ? st.season : 1;

  const msg = 'Reconstruire la carrière depuis zéro ?\n\nClub: '+savedName+'\nDivision: '+CAREER_DIV_NAMES[savedDiv]+'\nSaison: '+savedSeason+'\nBudget: 🪙2000\nEffectif: généré automatiquement\n\nTous les transferts et stats seront perdus.';
  showCareerConfirm(msg, ()=>_doRescueCareer(savedName,savedColor,savedImg,savedDiv,savedSeason));
}

function _doRescueCareer(savedName,savedColor,savedImg,savedDiv,savedSeason){
  const PC = {
    id: 'career_player',
    name: savedName,
    color: savedColor,
    img: savedImg,
    div: savedDiv,
    budget: 2000,
    players: mkCareerAIRoster('career_player_rescued', savedDiv===0?72:savedDiv===1?56:42),
    pts:0, w:0, d:0, l:0, gf:0, ga:0,
    isPlayer: true,
    infra: {stadium:0, training:0, formation:0, medical:0},
    sponsorId: 'local',
  };

  // Fixer les contrats/ages des joueurs générés
  PC.players.forEach(p=>{ p.contract=2; p.age=p.age||22; p.xp=0; p.goals=0; p.assists=0; p.matchesPlayed=0; });

  // Construire les divisions
  const D1=[{n:'Olympe FC',c:'#f0c028'},{n:'AS Tonnerre',c:'#e02030'},{n:'SC Lumière',c:'#00b8d4'},
    {n:'RC Victoire',c:'#8840e0'},{n:'FC Horizon',c:'#18c860'},{n:'US Phoenix',c:'#f07020'},
    {n:'AC Étoile',c:'#ff4081'},{n:'CS Titan',c:'#2979ff'}];
  const D2=[{n:'FC Verdun',c:'#69f0ae'},{n:'SC Mystère',c:'#ea80fc'},{n:'RC Tempête',c:'#ffab40'},
    {n:'US Renards',c:'#e040fb'},{n:'AS Delta',c:'#ff5252'},{n:'FC Zéphyr',c:'#40c4ff'},{n:'CS Loups',c:'#90a4ae'}];
  const D3=[{n:'FC Bouclier',c:'#c6ff00'},{n:'SC Navire',c:'#4db6ac'},{n:'AS Cosmos',c:'#7986cb'},
    {n:'FC Guerriers',c:'#dce775'},{n:'RC Marée',c:'#00bcd4'},{n:'US Gladiateurs',c:'#ff8a65'},
    {n:'AC Forge',c:'#ff6e40'},{n:'CS Citadelle',c:'#1de9b6'}];
  const divClubs = [
    D1.map(({n,c})=>mkCareerAIClub(n,c,0)),
    [PC, ...D2.map(({n,c})=>mkCareerAIClub(n,c,1))],
    D3.map(({n,c})=>mkCareerAIClub(n,c,2)),
  ];
  // Si D2, PC est déjà dedans; si D1 ou D3, le déplacer
  if(savedDiv !== 1){
    divClubs[1].shift(); // retirer PC de D2
    while(divClubs[savedDiv].length >= 8) divClubs[savedDiv].pop();
    divClubs[savedDiv].unshift(PC);
  }

  // Générer les fixtures
  const ids = divClubs[savedDiv].map(c=>c.id);
  const fixtures = mkFix(ids,2).map(f=>({...f,played:false,sh:null,sa:null}));

  // Construire le nouvel état propre
  const spons = CAREER_SPONSOR_CONTRACTS.find(s=>s.id==='local');
  PC.budget += spons.fee; // prime de signature

  const newState = {
    season: savedSeason,
    week: 1,
    playerClub: PC,
    divClubs,
    leagueFixtures: fixtures,
    weeklyWage: PC.players.reduce((s,p)=>s+careerWeeklySalary(p),0),
    transferMarket: [],
    pendingOffers: [],
    youthPlayers: [],
    trainingLog: [],
    log: [
      {txt:'🔧 Carrière réparée — '+savedName+' repart en '+CAREER_DIV_NAMES[savedDiv], col:'#f0c028'},
      {txt:'💰 Sponsor local : +'+fmtG(spons.fee)+' prime de signature', col:'#18c860'},
    ],
    phase: 'season',
    cupWins: 0,
    seasonStats: {wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0},
  };

  // Écraser la save corrompue
  careerState = newState;
  try{ localStorage.setItem('footsim7v7_career', JSON.stringify(newState)); }catch(e){
    alert('Erreur sauvegarde localStorage: '+e.message);
  }

  // Sync vers l'équipe jouée
  syncCareerToTeam();
  genCareerCups();
  nav('career');
}

function careerEmergencyLoan(){
  const C=careerState; const PC=C.playerClub;
  if(C._loanTaken){ showCareerConfirm('Pret deja pris cette saison.',()=>{}); return; }
  const loanAmount=Math.max(500,Math.abs(PC.budget)+300);
  const total=Math.round(loanAmount*1.25);
  showCareerConfirm('Pret urgence +'+fmtG(loanAmount)+'\nRemboursement fin saison: '+fmtG(total)+' (25%)', ()=>{
    PC.budget+=loanAmount; C._loanAmount=total; C._loanTaken=true;
    careerLog('Pret +'+fmtG(loanAmount)+' (remb. '+fmtG(total)+')', '#f0c028');
    saveCareer(); nav('career');
  });
}

function abandonCareer(){ showCareerConfirm('Abandonner la carrière en cours ?', clearCareer); }
function restartCareer(){ showCareerConfirm('Recommencer une nouvelle carrière ? La sauvegarde sera perdue.', clearCareer); }
function clearCareer(){ careerState=null; localStorage.removeItem('footsim7v7_career'); hideCareerConfirm(); nav('career'); }

function showCareerConfirm(msg, onYes){
  let modal = document.getElementById('career-confirm-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'career-confirm-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
    document.body.appendChild(modal);
  }
  modal.innerHTML = '';
  const box = document.createElement('div');
  box.style.cssText = 'background:var(--dark,#050e1a);border:1px solid var(--b1,#1a2a3a);border-radius:12px;padding:20px;max-width:320px;width:100%;text-align:center';
  const txt = document.createElement('div');
  txt.style.cssText = 'font-size:13px;margin-bottom:16px;line-height:1.5;color:var(--fg,#e0e8f0)';
  txt.textContent = msg;
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;justify-content:center';
  const btnY = document.createElement('button');
  btnY.className = 'btn';
  btnY.style.cssText = 'flex:1;justify-content:center;color:#e06060;border-color:#e0606066;font-weight:700';
  btnY.textContent = 'Oui, confirmer';
  btnY.onclick = ()=>{ hideCareerConfirm(); onYes(); };
  const btnN = document.createElement('button');
  btnN.className = 'btn btng';
  btnN.style.cssText = 'flex:1;justify-content:center';
  btnN.textContent = 'Annuler';
  btnN.onclick = hideCareerConfirm;
  row.appendChild(btnY); row.appendChild(btnN);
  box.appendChild(txt); box.appendChild(row);
  modal.appendChild(box);
  modal.style.display = 'flex';
}
function hideCareerConfirm(){
  const m = document.getElementById('career-confirm-modal');
  if(m) m.style.display = 'none';
}

function initCareerFooterBtns(){
  const abandon = document.getElementById('btn-abandon');
  const restart = document.getElementById('btn-restart');
  const rescue  = document.getElementById('btn-rescue');
  if(abandon) abandon.onclick = abandonCareer;
  if(restart) restart.onclick = restartCareer;
  if(rescue)  rescue.onclick  = rescueCareer;
}

// ── Génération équipes ───────────────────────────────────────────
function mkCareerAIClub(name, color, div){
  const ovr = div===0 ? 72+~~(Math.random()*14) : div===1 ? 56+~~(Math.random()*14) : 42+~~(Math.random()*14);
  const tid = `cai_${name.replace(/\s/g,'_')}`;
  return { id:tid, name, color, div, budget:500+~~(Math.random()*800),
    players: mkCareerAIRoster(tid, ovr), pts:0, w:0, d:0, l:0, gf:0, ga:0, isPlayer:false };
}

function mkCareerAIRoster(tid, base){
  const names = [...AI_NAMES].sort(()=>Math.random()-.5);
  const sc = () => Math.max(20, Math.min(99, base+~~((Math.random()-.5)*20)));
  return [...ROLE,...['MC','ATT','DC','DD','MC'],...['GB','DC','ATT']].map((pos,i) => ({
    id:`${tid}_${i}`, name:names[i%AI_NAMES.length]||'PNJ', pos,
    ini:(names[i%AI_NAMES.length]||'PJ').slice(0,2).toUpperCase(), img:'',
    s:{spd:sc(),sht:sc(),def:sc(),stam:sc(),tec:sc(),res:sc()},
    spells:spellForPos(pos,name),race:pickRaceForRegion('',name+pos), contract:1+~~(Math.random()*3), age:18+~~(Math.random()*14),
    xp:0, goals:0, assists:0, matchesPlayed:0,
    x:0,y:0,vx:0,vy:0,tx:0,ty:0,hp:100,mp:100,yc:0,red:false,stunT:0,hasBall:false,
    injLevel:0,injT:0,mG:0,mSh:0,mTk:0,mSp:0,_img:null,
    _hm:(()=>{const r=(Math.random()+Math.random()-1)*10;return Math.round(Math.max(-10,Math.min(10,r)));})(),
    _fm:(()=>{const r=(Math.random()+Math.random()-1)*10;return Math.round(Math.max(-10,Math.min(10,r)));})(),
    _spdDebuff:0,_charmed:0,_atkBuff:0,_pacified:0,_invis:0,_folie:0,_aile:0,_sixsens:0,_sylvestre:0,_dragon:0,
    bobPhase:Math.random()*Math.PI*2, wPhaseX:Math.random()*Math.PI*2, wPhaseY:Math.random()*Math.PI*2, wSpeed:1.4+Math.random()*1.2,
    runT:0,runTx:0,runTy:0,runCool:Math.random()*2,dribCurve:0,tackleCool:0 }));
}

function mkYouth(potBonus){
  const names = [...AI_NAMES].sort(()=>Math.random()-.5);
  const name = names[0]; const base = 28+~~(Math.random()*20);
  const pot = 50+(potBonus||0)+~~(Math.random()*38);
  return { id:`youth_${Date.now()}_${Math.random()|0}`, name, pos:pick([...ROLE,'MC','ATT']),
    ini:name.slice(0,2).toUpperCase(), img:'', age:15+~~(Math.random()*4), potential:pot,
    contract:0, s:{spd:base+~~(Math.random()*12),sht:base+~~(Math.random()*12),def:base+~~(Math.random()*12),
      stam:base+~~(Math.random()*12),tec:base+~~(Math.random()*12),res:base+~~(Math.random()*12)},
    spells:spellForPos(pos,name),race:pickRaceForRegion('',name+pos), xp:0, goals:0, assists:0, matchesPlayed:0,
    x:0,y:0,vx:0,vy:0,tx:0,ty:0,hp:100,mp:100,yc:0,red:false,stunT:0,hasBall:false,
    injLevel:0,injT:0,mG:0,mSh:0,mTk:0,mSp:0,_img:null,
    _spdDebuff:0,_charmed:0,_atkBuff:0,_pacified:0,_invis:0,_folie:0,_aile:0,_sixsens:0,_sylvestre:0,
    bobPhase:Math.random()*Math.PI*2, wPhaseX:Math.random()*Math.PI*2, wPhaseY:Math.random()*Math.PI*2, wSpeed:1.6,
    runT:0,runTx:0,runTy:0,runCool:0,dribCurve:0,tackleCool:0 };
}

// ── Démarrage carrière ───────────────────────────────────────────
function startCareer(){
  const PC = {
    id:'career_player', name:teams[0].name, color:teams[0].color, img:teams[0].img||'',
    div:1, budget:CAREER_BUDGET_START,
    players: [...teams[0].players,...teams[0].bench,...(teams[0].reserves||[])].map(p=>({
      ...p, contract:2, age:p.age||22, xp:0, goals:0, assists:0, matchesPlayed:0 })),
    pts:0, w:0, d:0, l:0, gf:0, ga:0, isPlayer:true,
    infra:{ stadium:0, training:0, formation:0, medical:0 },
    strat: teams[0].strat||'321',
    sponsorId: 'local', // contrat sponsor de départ
  };
  const D1 = [{n:'Olympe FC',c:'#f0c028'},{n:'AS Tonnerre',c:'#e02030'},{n:'SC Lumière',c:'#00b8d4'},
    {n:'RC Victoire',c:'#8840e0'},{n:'FC Horizon',c:'#18c860'},{n:'US Phoenix',c:'#f07020'},
    {n:'AC Étoile',c:'#ff4081'},{n:'CS Titan',c:'#2979ff'}];
  const D2 = [{n:'FC Verdun',c:'#69f0ae'},{n:'SC Mystère',c:'#ea80fc'},{n:'RC Tempête',c:'#ffab40'},
    {n:'US Renards',c:'#e040fb'},{n:'AS Delta',c:'#ff5252'},{n:'FC Zéphyr',c:'#40c4ff'},{n:'CS Loups',c:'#90a4ae'}];
  const D3 = [{n:'FC Bouclier',c:'#c6ff00'},{n:'SC Navire',c:'#4db6ac'},{n:'AS Cosmos',c:'#7986cb'},
    {n:'FC Guerriers',c:'#dce775'},{n:'RC Marée',c:'#00bcd4'},{n:'US Gladiateurs',c:'#ff8a65'},
    {n:'AC Forge',c:'#ff6e40'},{n:'CS Citadelle',c:'#1de9b6'}];
  const divClubs = [
    D1.map(({n,c})=>mkCareerAIClub(n,c,0)),
    [PC, ...D2.map(({n,c})=>mkCareerAIClub(n,c,1))],
    D3.map(({n,c})=>mkCareerAIClub(n,c,2)),
  ];
  const d2ids = divClubs[1].map(c=>c.id);
  careerState = {
    season:1, week:1,
    playerClub: PC,
    divClubs,
    leagueFixtures: mkFix(d2ids, 2).map(f=>({...f,played:false,sh:null,sa:null})),
    weeklyWage: PC.players.reduce((s,p)=>s+careerWeeklySalary(p), 0),
    transferMarket: [],
    pendingOffers: [],
    youthPlayers: [],
    trainingLog: [],
    log: [],
    phase: 'season',
    cupWins: 0,
    seasonStats: { wins:0, draws:0, losses:0, goalsFor:0, goalsAgainst:0 },
  };
  const spons = CAREER_SPONSOR_CONTRACTS.find(s=>s.id==='local');
  PC.budget += spons.fee;
  careerLog('Carriere lancee ! Contrat sponsor local signe.', '#f0c028');
  saveCareer();
  // Générer les coupes de la première saison
  genCareerCups();
  nav('career'); // shows tab and calls renderCareer()
}

// ── Classements ──────────────────────────────────────────────────
function getCareerStandings(div){
  const clubs=careerState?.divClubs?.[div];
  if(!clubs||!clubs.length) return [];
  return [...clubs].sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf);
}

// ── Rendu principal ──────────────────────────────────────────────
function renderCareer(){
  try{
  const el = document.getElementById('career-out'); if(!el) return;
  // Footer buttons: toujours visibles quand carrière active
  const footer = document.getElementById('career-footer-btns');
  if(footer) footer.style.display = careerState ? 'flex' : 'none';
  if(!careerState){
    const t0 = teams[0]||{color:'#18c860',name:'Mon Club',img:''};
    el.innerHTML = `<div style="padding:12px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;letter-spacing:2px;color:var(--gold);margin-bottom:8px">🎽 MODE CARRIÈRE</div>
      <div style="font-size:10px;color:var(--muted);line-height:1.7;margin-bottom:14px">
        Gérez votre club sur plusieurs saisons · Ligue + montée/descente<br>
        Mercato · Sponsors · Infrastructures · Entraînement · Jeunes
      </div>
      <div style="background:var(--panel);border:1px solid var(--b1);border-radius:8px;padding:10px;margin-bottom:12px">
        <div style="font-size:8px;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:5px">Votre club (équipe active)</div>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:36px;height:36px;border-radius:50%;background:${t0.color||'#18c860'};display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:13px;font-weight:900;color:#fff">
            ${t0.img?`<img src="${t0.img}" style="width:100%;height:100%;object-fit:cover">`:teamIni(t0.name||'Club')}
          </div>
          <div>
            <div style="font-weight:700;font-size:13px">${esc(t0.name||'Mon Club')}</div>
            <div style="font-size:9px;color:var(--muted)">Démarre en Division 2 · Budget: ${fmtG(CAREER_BUDGET_START)}</div>
          </div>
        </div>
      </div>
      <button class="btn btng" style="width:100%;justify-content:center;font-size:14px;padding:10px;margin-bottom:6px" onclick="renderCareerV2Choice()">🎽 Nouvelle Carrière</button>
      <button class="btn" style="width:100%;justify-content:center;font-size:11px;padding:7px;margin-bottom:4px" onclick="rescueCareer()">🔧 Réparer une carrière existante</button>
    </div>`;
    return;
  }
  const C = careerState; const PC = C.playerClub;
  if(!C.divClubs?.[PC.div]){el.innerHTML='<div style="padding:12px;color:var(--muted)">Chargement...</div>';return;}
  const divName = CAREER_DIV_NAMES[PC.div];
  const wage = C.weeklyWage||0; const infraW = infraWeekly(C);
  const spons = CAREER_SPONSOR_CONTRACTS.find(s=>s.id===PC.sponsorId)||CAREER_SPONSOR_CONTRACTS[0];
  const pending = (C.leagueFixtures||[]).filter(f=>!f.played&&f.home&&f.away&&(f.home===PC.id||f.away===PC.id));
  const nextFix = pending[0];
  const nextOppId = nextFix ? (nextFix.home===PC.id ? nextFix.away : nextFix.home) : null;
  const nextOpp = nextOppId ? (C.divClubs?.[PC.div]?.find(c=>c.id===nextOppId) || C.divClubs?.flat()?.find(c=>c.id===nextOppId)) : null;
  const standings = C.divClubs?.[PC.div] ? getCareerStandings(PC.div) : [];
  const myPos = standings.length ? (standings.findIndex(s=>s.id===PC.id)+1)||'?' : '?';
  const n = standings.length||1;

  // Build HTML safely - escape all user strings
  const e = esc; // shorthand

  let h = `<div style="padding:4px">
    <div style="background:linear-gradient(135deg,var(--gold)18,transparent);border:1px solid var(--gold)44;border-radius:10px;padding:9px 11px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:900;color:var(--gold)">SAISON ${C.season}</div>
          <div style="font-size:9px;color:var(--muted)">${e(divName)} · J${C.week}/${(C.leagueFixtures||[]).filter(f=>f.home===PC.id||f.away===PC.id).length||14}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:15px;font-weight:700;color:${PC.budget>=0?'#18c860':'#e02030'}">${fmtG(PC.budget)}</div>
          <div style="font-size:8px;color:var(--muted)">-${fmtG(wage+infraW)}/sem · ${spons.icon}+${fmtG(spons.perWin)}/V</div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:8px">
      <div style="background:var(--panel);border:1px solid var(--b1);border-radius:7px;padding:6px;text-align:center">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900;color:${myPos<=2?'var(--gold)':myPos<=4?'#18c860':'var(--fg)'}">${myPos}<sup style="font-size:9px">e</sup></div>
        <div style="font-size:8px;color:var(--muted)">Classement</div>
      </div>
      <div style="background:var(--panel);border:1px solid var(--b1);border-radius:7px;padding:6px;text-align:center">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900">${PC.pts}</div>
        <div style="font-size:8px;color:var(--muted)">Points</div>
      </div>
      <div style="background:var(--panel);border:1px solid var(--b1);border-radius:7px;padding:6px;text-align:center">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900">${PC.gf}-${PC.ga}</div>
        <div style="font-size:8px;color:var(--muted)">Buts</div>
      </div>
    </div>`;

  const nextOppReal = nextOpp;
  if(nextFix && nextOppReal){
    h += `<div style="background:var(--panel);border:1px solid var(--b1);border-radius:8px;padding:8px;margin-bottom:8px">
      <div style="font-size:8px;color:var(--muted);letter-spacing:.5px;margin-bottom:5px">PROCHAIN MATCH · ${nextFix.home===PC.id?'🏟️ Domicile':'✈️ Extérieur'}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:8px">
        <span style="font-size:12px;font-weight:700;color:${PC.color}">${e(PC.name)}</span>
        <span style="font-size:9px;color:var(--muted)">vs</span>
        <span style="font-size:12px;font-weight:700;color:${nextOppReal.color}">${e(nextOppReal.name)}</span>
      </div>
      <div style="display:flex;gap:4px">
        <button class="btn btng" style="flex:2;justify-content:center;font-size:11px" onclick="playCareerMatch()">▶ Jouer</button>
        <button class="btn" style="flex:1;justify-content:center;font-size:10px;color:#8840e0;border-color:#8840e044" onclick="simCareerMatch()">⚡ Sim.</button>
        <button class="btn" style="flex:1;justify-content:center;font-size:9px" onclick="simAllCareerNPC()">⚡⚡</button>
      </div>
    </div>`;
  } else if(!nextFix){
    h += `<div style="background:rgba(24,200,96,.06);border:1px solid rgba(24,200,96,.2);border-radius:8px;padding:10px;margin-bottom:8px;text-align:center">
      <div style="font-size:11px;font-weight:700;color:var(--green);margin-bottom:6px">✓ Tous les matchs joués !</div>
      <button class="btn btng" style="width:100%;justify-content:center" onclick="endCareerSeason()">→ Fin de saison</button>
    </div>`;
  }

  h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:8px">
      <button class="btn" style="justify-content:center;font-size:10px;padding:7px" onclick="openCareerTab('standings')">📊 Classement</button>
      <button class="btn" style="justify-content:center;font-size:10px;padding:7px" onclick="openCareerTab('squad')">👥 Effectif</button>
      <button class="btn" style="justify-content:center;font-size:10px;padding:7px" onclick="openCareerTab('finance')">💰 Finances</button>
      <button class="btn" style="justify-content:center;font-size:10px;padding:7px" onclick="openCareerTab('fixtures')">📅 Calendrier</button>
      <button class="btn" style="justify-content:center;font-size:10px;padding:7px" onclick="openCareerTab('infra')">🏗️ Infras</button>
      <button class="btn" style="justify-content:center;font-size:10px;padding:7px" onclick="openCareerTab('sponsors')">💼 Sponsors</button>
      <button class="btn" style="justify-content:center;font-size:10px;padding:7px" onclick="openCareerTab('transfer')">💸 Mercato</button>
      <button class="btn" style="justify-content:center;font-size:10px;padding:7px" onclick="openCareerTab('stats')">📈 Saison</button>
      <button class="btn" style="justify-content:center;font-size:10px;padding:7px;position:relative" onclick="openCareerTab('divcup')">🏆 Coupe Div.${C.divCup?.playerIn?`<span style="position:absolute;top:2px;right:4px;background:var(--gold);color:#000;border-radius:50%;width:8px;height:8px;font-size:6px;display:flex;align-items:center;justify-content:center">!</span>`:''}</button>
      <button class="btn" style="justify-content:center;font-size:10px;padding:7px;position:relative" onclick="openCareerTab('natcup')">🌍 Coupe Nat.${C.natCup?.playerIn?`<span style="position:absolute;top:2px;right:4px;background:var(--gold);color:#000;border-radius:50%;width:8px;height:8px;font-size:6px;display:flex;align-items:center;justify-content:center">!</span>`:''}</button>
      ${(PC.infra?.training||0)>0?`<button class="btn" style="justify-content:center;font-size:10px;padding:7px" onclick="openCareerTab('training')">⚽ Entraîn.</button>`:''}
      ${(PC.infra?.formation||0)>0?`<button class="btn" style="justify-content:center;font-size:10px;padding:7px;position:relative" onclick="openCareerTab('youth')">🌱 Jeunes${(C.youthPlayers||[]).length?`<span style="position:absolute;top:2px;right:4px;background:var(--gold);color:#000;border-radius:50%;width:13px;height:13px;font-size:7px;display:flex;align-items:center;justify-content:center">${C.youthPlayers.length}</span>`:''}</button>`:''}
    </div>`;

  // Pending offers - safe
  if((C.pendingOffers||[]).length){
    h += `<div style="background:rgba(240,80,80,.08);border:1px solid rgba(240,80,80,.2);border-radius:8px;padding:8px;margin-bottom:8px">
      <div style="font-size:9px;color:#e06060;font-weight:700;margin-bottom:5px">🔴 ${(C.pendingOffers||[]).length} offre(s)</div>`;
    C.pendingOffers.slice(0,2).forEach((o,oi)=>{
      h += `<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(240,80,80,.1)">
        <span style="font-size:10px">${e(o.agentName)}: <b>${fmtG(o.fee)}</b> pour <b>${e(o.playerName)}</b></span>
        <span style="display:flex;gap:3px">
          <button class="btn btng" style="padding:1px 6px;font-size:9px" onclick="acceptTransferOffer(${oi})">✓</button>
          <button class="btn" style="padding:1px 6px;font-size:9px" onclick="rejectTransferOffer(${oi})">✕</button>
        </span>
      </div>`;
    });
    h += '</div>';
  }

  // Journal placeholder + buttons placeholder (filled safely below)
  h += `<div id="career-log-area"></div>
    <div id="career-action-btns"></div>
    <div id="career-btns"></div>
  </div>`;

  el.innerHTML = h;

  // === Tout ce qui suit est injecté via DOM - 100% safe ===

  // Bannière faillite / crise (boutons DOM)
  const actionBtns = document.getElementById('career-action-btns');
  if(actionBtns){
    if(PC.budget < -500){
      const d=document.createElement('div');
      d.style.cssText='background:rgba(240,30,30,.15);border:2px solid #e02030;border-radius:8px;padding:10px;margin-bottom:8px';
      const title=document.createElement('div');title.style.cssText='font-size:13px;font-weight:900;color:#e02030;margin-bottom:4px';title.textContent='🚨 FAILLITE IMMINENTE';
      const sub=document.createElement('div');sub.style.cssText='font-size:9px;color:var(--muted);margin-bottom:8px';sub.textContent='Budget: '+fmtG(PC.budget)+' — charges suspendues.';
      const row=document.createElement('div');row.style.cssText='display:flex;gap:4px';
      [['Vendre/Licencier',()=>openCareerTab('squad'),'#888',''],
       ['Pret urgence',careerEmergencyLoan,'#f0c028','#f0c02844'],
       ['Reparer',rescueCareer,'#888','']].forEach(([txt,fn,col,bc])=>{
        const b=document.createElement('button');b.className='btn';
        b.style.cssText='flex:1;justify-content:center;font-size:9px'+(col?';color:'+col:'')+(bc?';border-color:'+bc:'');
        b.textContent=txt;b.onclick=fn;row.appendChild(b);
      });
      d.appendChild(title);d.appendChild(sub);d.appendChild(row);actionBtns.appendChild(d);
    } else if(PC.budget < -200){
      const d=document.createElement('div');
      d.style.cssText='background:rgba(240,80,80,.1);border:1px solid #e06060;border-radius:8px;padding:10px;margin-bottom:8px';
      const title=document.createElement('div');title.style.cssText='font-size:11px;font-weight:700;color:#e06060;margin-bottom:4px';title.textContent='💸 CRISE FINANCIÈRE';
      const sub=document.createElement('div');sub.style.cssText='font-size:9px;color:var(--muted);margin-bottom:8px';sub.textContent='Deficit: '+fmtG(Math.abs(PC.budget))+' — vendez des joueurs.';
      const row=document.createElement('div');row.style.cssText='display:flex;gap:4px';
      [['Vendre',()=>openCareerTab('squad')],['Sponsors',()=>openCareerTab('sponsors')],['Pret',careerEmergencyLoan]].forEach(([txt,fn])=>{
        const b=document.createElement('button');b.className='btn';b.style.cssText='flex:1;justify-content:center;font-size:9px';b.textContent=txt;b.onclick=fn;row.appendChild(b);
      });
      d.appendChild(title);d.appendChild(sub);d.appendChild(row);actionBtns.appendChild(d);
    }
    // Équipe insuffisante
    if((PC.players||[]).length < 7){
      const d=document.createElement('div');
      d.style.cssText='background:rgba(240,80,80,.1);border:1px solid #e06060;border-radius:8px;padding:10px;margin-bottom:8px;text-align:center';
      const title=document.createElement('div');title.style.cssText='font-size:12px;font-weight:700;color:#e06060;margin-bottom:4px';title.textContent='⚠️ Équipe insuffisante';
      const sub=document.createElement('div');sub.style.cssText='font-size:9px;color:var(--muted);margin-bottom:8px';sub.textContent=(PC.players||[]).length+'/7 joueurs minimum.';
      const b=document.createElement('button');b.className='btn btng';b.style.cssText='width:100%;justify-content:center;font-size:10px';b.textContent='💸 Mercato';b.onclick=()=>openCareerTab('transfer');
      d.appendChild(title);d.appendChild(sub);d.appendChild(b);actionBtns.appendChild(d);
    }
  }

  // Fill journal safely
  const logArea = document.getElementById('career-log-area');
  if(logArea && (C.log||[]).length){
    const title = document.createElement('div');
    title.style.cssText='font-size:8px;color:var(--muted);margin-bottom:3px;letter-spacing:.5px';
    title.textContent='JOURNAL';
    const box = document.createElement('div');
    box.style.cssText='background:var(--panel);border:1px solid var(--b1);border-radius:7px;padding:6px;font-size:9px;line-height:1.8;max-height:100px;overflow-y:auto';
    C.log.slice(-8).reverse().forEach(entry=>{
      const d=document.createElement('div');
      d.style.color=entry.col||'var(--fg)';
      d.textContent=entry.txt||'';
      box.appendChild(d);
    });
    logArea.appendChild(title);
    logArea.appendChild(box);
  }

  // Boutons Abandonner / Recommencer / Réparer
  const btnZone = document.getElementById('career-btns');
  if(btnZone){
    btnZone.style.cssText='display:flex;gap:4px;margin-top:8px';
    [['✕ Abandonner',abandonCareer,'#e06060','#e0606044'],
     ['↺ Recommencer',restartCareer,'',''],
     ['🔧 Réparer',rescueCareer,'#f0c028','#f0c02844']].forEach(([txt,fn,col,bc])=>{
      const b=document.createElement('button');b.className='btn';
      b.style.cssText='flex:1;justify-content:center;font-size:9px'+(col?';color:'+col:'')+(bc?';border-color:'+bc:'');
      b.textContent=txt;b.onclick=fn;btnZone.appendChild(b);
    });
  } else {
    // DEBUG: si career-btns n'existe pas, afficher une erreur visible
    console.error('career-btns introuvable - le template h est probablement cassé');
    const dbg=document.createElement('div');
    dbg.style.cssText='padding:8px;background:#e02030;color:#fff;font-size:10px;border-radius:6px;margin-top:8px';
    dbg.textContent='DEBUG: career-btns manquant. Voir console.';
    el.appendChild(dbg);
  }
  // Also add rescue button in catch block
  }catch(err){
    console.error('renderCareer error:',err);
    const el2=document.getElementById('career-out');
    if(el2){
      el2.innerHTML='';
      const errDiv=document.createElement('div');
      errDiv.style.cssText='padding:12px;color:#e06060';
      errDiv.textContent='Erreur carrière: '+(err.message||'inconnue');
      const bfix=document.createElement('button');
      bfix.className='btn';bfix.style.cssText='margin-top:8px;width:100%;justify-content:center;color:#f0c028;border-color:#f0c02844';
      bfix.textContent='🔧 Réparer la carrière';bfix.onclick=rescueCareer;
      const bclr=document.createElement('button');
      bclr.className='btn';bclr.style.cssText='margin-top:6px;width:100%;justify-content:center;color:#e06060;border-color:#e0606044';
      bclr.textContent='✕ Effacer et recommencer';bclr.onclick=clearCareer;
      el2.appendChild(errDiv);el2.appendChild(bfix);el2.appendChild(bclr);
    }
  }
}

function openCareerTab(tab){
  const el = document.getElementById('career-out'); if(!el) return;
  const C = careerState; if(!C||!C.playerClub){renderCareer();return;}
  const PC = C.playerClub;
  const e = s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const back = `<button class="btn" style="padding:2px 8px;font-size:10px;margin-bottom:8px" onclick="renderCareer()">← Retour</button>`;

  if(tab==='standings'){
    let h = `<div style="padding:4px">${back}`;
    CAREER_DIV_NAMES.forEach((dname,di)=>{
      const n = C.divClubs[di].length;
      h += `<div style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:900;color:var(--gold);letter-spacing:1px;margin:${di?10:0}px 0 4px">${e(dname)}</div>`;
      h += `<div style="background:var(--card);border:1px solid var(--b1);border-radius:8px;overflow:hidden;margin-bottom:4px">`;
      h += `<div style="display:grid;grid-template-columns:18px 1fr 22px 22px 22px 24px 28px;gap:0 2px;padding:3px 6px;border-bottom:1px solid var(--b1)">
        ${['','Club','V','N','D','GD','Pts'].map(l=>`<span style="font-size:7px;color:var(--muted);text-align:center">${l}</span>`).join('')}</div>`;
      getCareerStandings(di).forEach((club,ri)=>{
        const isMe = club.id===PC.id;
        const promo = di>0&&ri<2; const rel = di<2&&ri>=n-2;
        h += `<div style="display:grid;grid-template-columns:18px 1fr 22px 22px 22px 24px 28px;gap:0 2px;padding:4px 6px;border-bottom:1px solid var(--b1);background:${isMe?'var(--panel)':'transparent'}">
          <span style="font-size:9px;color:${ri===0?'var(--gold)':ri<3?'#aaa':'var(--muted)'}">${ri+1}</span>
          <span style="display:flex;align-items:center;gap:3px"><span style="width:5px;height:5px;border-radius:50%;background:${club.color}"></span>
          <span style="font-size:10px;font-weight:${isMe?900:400};color:${promo?'#18c860':rel?'#e06060':'var(--fg)'}">${e(club.name)}${isMe?' 👤':''}</span></span>
          ${[club.w,club.d,club.l,club.gf-club.ga].map(v=>`<span style="font-size:9px;text-align:center">${v}</span>`).join('')}
          <span style="font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:900;text-align:center">${club.pts}</span>
        </div>`;
      });
      h += '</div>';
    });
    h += `<div style="font-size:8px;color:var(--muted);padding:4px 2px"><span style="color:#18c860">■</span> Montée · <span style="color:#e06060">■</span> Descente</div></div>`;
    el.innerHTML = h;
  }

  else if(tab==='squad'){
    const all = PC.players||[];
    const mkRow = (p,i) => {
      const ovr=careerOvr(p); const sal=careerWeeklySalary(p);
      const starsHtml=renderStarsHtml(ovrToStars(ovr),ovr>=72?'var(--green)':ovr>=56?'var(--gold)':'#888',9);
      const expiring=(p.contract||0)<=1;
      const injured=(p.injLevel||0)>0;
      const suspended=p.yc>=2||p.red;
      return `<div style="display:flex;align-items:center;gap:5px;padding:5px 4px;border-bottom:1px solid var(--b1);background:${injured?'rgba(240,80,80,.04)':suspended?'rgba(240,192,0,.04)':'transparent'}">
        <div style="width:26px;height:26px;border-radius:50%;background:${PC.color}22;border:1px solid ${PC.color}44;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;color:${PC.color};overflow:hidden;flex-shrink:0">
          ${p.img?`<img src="${p.img}" style="width:100%;height:100%;object-fit:cover">`:`${e(p.ini)}`}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:10px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e(p.name)}${expiring?` <span style="color:#f0c028;font-size:8px">⏳${p.contract||0}an</span>`:''}</div>
          <div style="font-size:8px;color:var(--muted)">${e(p.pos)} · ${p.age||"?"}ans · ${starsHtml} · ${fmtG(sal)}/sem · ${p.goals||0}B${injured?` <span style="color:#e06060">🤕niv.${p.injLevel}</span>`:''} ${suspended?'<span style="color:#f0c028">🟨</span>':''}  </div>
        </div>
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:900;color:${ovr>=72?'var(--green)':ovr>=56?'var(--gold)':'var(--muted)'};flex-shrink:0">${ovr}</div>
        <div style="display:flex;flex-direction:column;gap:2px;flex-shrink:0">
          ${expiring?`<button class="btn" style="padding:1px 5px;font-size:8px;color:#18c860;border-color:#18c86044" onclick="renewContract(${i})">+1an</button>`:''}
          <button class="btn" style="padding:1px 5px;font-size:8px;color:#e06060;border-color:#e0606044" onclick="sellPlayer(${i})">Vendre</button>
          <button class="btn" style="padding:1px 5px;font-size:8px;color:#888;border-color:#44444444" onclick="firePlayer(${i})" title="Licencier (indemnité réduite)">Licencier</button>
        </div>
      </div>`;
    };
    const totalSal=all.reduce((s,p)=>s+careerWeeklySalary(p),0);
    el.innerHTML = `<div style="padding:4px">${back}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-size:9px;color:var(--muted)">Masse sal.: <b style="color:var(--fg)">${fmtG(totalSal)}/sem</b></div>
        <div style="font-size:9px;color:var(--muted)">Budget: <b style="color:#18c860">${fmtG(PC.budget)}</b></div>
      </div>
      <div class="slbl">Titulaires (⏳ = contrat court)</div>${all.slice(0,7).map((p,i)=>mkRow(p,i)).join('')}
      <div class="slbl" style="margin-top:6px">Banc</div>${all.slice(7,12).map((p,i)=>mkRow(p,i+7)).join('')}
      ${all.length>12?`<div class="slbl" style="margin-top:6px">Réservistes</div>${all.slice(12).map((p,i)=>mkRow(p,i+12)).join('')}`:''}
    </div>`;
  }

  else if(tab==='infra'){
    let h = `<div style="padding:4px">${back}
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:900;color:var(--gold);margin-bottom:4px">🏗️ Infrastructures</div>
      <div style="font-size:9px;color:var(--muted);margin-bottom:10px">Budget: <b style="color:var(--fg)">${fmtG(PC.budget)}</b> · Charges: <b style="color:#e06060">${fmtG(infraWeekly(C))}/sem</b></div>`;
    Object.entries(INFRA_DEFS).forEach(([key,def])=>{
      const lvl = (PC.infra||{})[key]||0;
      const maxed = lvl>=def.lvlMax;
      const upgCost = def.cost*(lvl+1);
      const canAfford = PC.budget>=upgCost;
      const stars = '★'.repeat(lvl)+'☆'.repeat(def.lvlMax-lvl);
      h += `<div style="background:var(--panel);border:1px solid var(--b1);border-radius:8px;padding:9px;margin-bottom:6px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <div><span style="font-size:16px;margin-right:5px">${def.icon}</span><span style="font-size:11px;font-weight:700">${e(def.name)}</span>
          <span style="font-size:10px;color:${lvl>0?'var(--gold)':'var(--muted)'};margin-left:5px">${stars}</span></div>
          <span style="font-size:9px;color:var(--muted)">Niv.${lvl}/${def.lvlMax}</span>
        </div>
        <div style="font-size:9px;color:var(--muted);margin-bottom:5px">${e(def.desc)}</div>
        ${lvl>0?`<div style="font-size:8px;color:#e06060;margin-bottom:5px">Charges: ${fmtG(def.weekly*lvl)}/sem</div>`:''}
        ${!maxed?`<button class="btn ${canAfford?'btng':''}" style="width:100%;justify-content:center;font-size:10px" onclick="buyInfra('${key}')" ${canAfford?'':'disabled'}>
          ${lvl===0?'🔨 Construire':'⬆️ Améliorer'} — ${fmtG(upgCost)}</button>`
        :`<div style="text-align:center;font-size:9px;color:var(--green)">✓ Niveau maximum</div>`}
      </div>`;
    });
    h += '</div>';
    el.innerHTML = h;
  }

  else if(tab==='sponsors'){
    const currentSpons = CAREER_SPONSOR_CONTRACTS.find(s=>s.id===PC.sponsorId)||CAREER_SPONSOR_CONTRACTS[0];
    const myDiv = PC.div;
    const myPos = (getCareerStandings(myDiv).findIndex(s=>s.id===PC.id)+1)||99;
    const isUnlocked = s => {
      if(s.condition==='none') return true;
      if(s.condition==='d2top4') return myDiv<=1&&myPos<=4;
      if(s.condition==='d1') return myDiv===0;
      if(s.condition==='d1top3') return myDiv===0&&myPos<=3;
      return false;
    };
    let h = `<div style="padding:4px">${back}
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:900;color:var(--gold);margin-bottom:4px">💼 Contrats sponsors</div>
      <div style="font-size:9px;color:var(--muted);margin-bottom:10px">Contrat actuel: <b style="color:var(--fg)">${currentSpons.icon} ${e(currentSpons.name)}</b> · ${fmtG(currentSpons.perWin)}/victoire</div>`;
    CAREER_SPONSOR_CONTRACTS.forEach(spons=>{
      const unlocked = isUnlocked(spons);
      const isCurrent = spons.id===PC.sponsorId;
      h += `<div style="background:var(--panel);border:1px solid ${isCurrent?'var(--gold)':'var(--b1)'};border-radius:8px;padding:9px;margin-bottom:6px;opacity:${unlocked?1:.5}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:15px;margin-right:5px">${spons.icon}</span>
          <div style="flex:1"><div style="font-size:11px;font-weight:700">${e(spons.name)}${isCurrent?' ✓':''}</div>
          <div style="font-size:9px;color:var(--muted)">${e(spons.desc)}</div></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:9px"><span style="color:#18c860">+${fmtG(spons.fee)}</span> à la signature · <span style="color:var(--gold)">+${fmtG(spons.perWin)}</span> par victoire</div>
          ${!isCurrent&&unlocked?`<button class="btn btng" style="padding:2px 10px;font-size:9px" onclick="signSponsor('${spons.id}')">Signer</button>`:''}
          ${!unlocked?`<span style="font-size:8px;color:var(--muted)">🔒 ${e(spons.desc)}</span>`:''}
        </div>
      </div>`;
    });
    h += '</div>';
    el.innerHTML = h;
  }

  else if(tab==='transfer'){
    if(!C.transferMarket?.length) C.transferMarket = generateTransferMarket();
    let h = `<div style="padding:4px">${back}
      <div style="font-size:11px;font-weight:700;margin-bottom:4px">💸 Mercato</div>
      <div style="font-size:9px;color:var(--muted);margin-bottom:8px">Budget: <b style="color:var(--fg)">${fmtG(PC.budget)}</b></div>`;
    C.transferMarket.forEach((p,ti)=>{
      const ovr = careerOvr(p); const canAfford = PC.budget>=p.fee;
      h += `<div style="background:var(--panel);border:1px solid var(--b1);border-radius:7px;padding:7px;margin-bottom:5px;display:flex;align-items:center;gap:6px">
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;font-weight:700">${e(p.name)} <span style="color:var(--muted);font-size:9px">${e(p.pos)}</span></div>
          <div style="font-size:8px;color:var(--muted)">${p.age||"?"}ans · ${e(p.agentName)} · ${fmtG(careerWeeklySalary(p))}/sem · ${p.contractOffer}an(s)</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:900;color:${ovr>=72?'var(--green)':ovr>=56?'var(--gold)':'var(--fg)'}">${ovr}</div>
          <div style="font-size:10px;font-weight:700;color:${canAfford?'var(--fg)':'#e06060'}">${fmtG(p.fee)}</div>
          <button class="btn ${canAfford?'btng':''}" style="padding:2px 7px;font-size:9px;margin-top:2px" onclick="buyPlayer(${ti})" ${canAfford?'':'disabled'}>Recruter</button>
        </div>
      </div>`;
    });
    if(!C.transferMarket.length) h += `<div style="text-align:center;color:var(--muted);font-size:10px;padding:12px">Marché vide</div>`;
    h += `<button class="btn" style="width:100%;justify-content:center;margin-top:6px;font-size:9px" onclick="careerState.transferMarket=[];openCareerTab('transfer')">↻ Actualiser</button></div>`;
    el.innerHTML = h;
  }

  else if(tab==='training'){
    const lvl = (PC.infra?.training)||0;
    if(!lvl){ el.innerHTML=`<div style="padding:12px;text-align:center;color:var(--muted)">${back}Centre non construit.</div>`; return; }
    let h = `<div style="padding:4px">${back}
      <div style="font-size:11px;font-weight:700;margin-bottom:2px">⚽ Entraînement Niv.${lvl}</div>
      <div style="font-size:9px;color:var(--muted);margin-bottom:8px">Budget: <b>${fmtG(PC.budget)}</b></div>
      <div style="font-size:9px;color:var(--muted);margin-bottom:4px">Joueur cible :</div>
      <select id="training-player" class="inp" style="width:100%;margin-bottom:10px">
        ${PC.players.slice(0,7+lvl*2).map((p,i)=>`<option value="${i}">${e(p.name)} (${e(p.pos)}) OVR${careerOvr(p)}</option>`).join('')}
      </select>`;
    TRAINING_SESSIONS.forEach((sess,si)=>{
      const bonus = lvl>=2?.1:lvl>=1?.05:0;
      const realChance = Math.round((sess.chance+bonus)*100);
      const canAfford = PC.budget>=sess.cost;
      h += `<div style="background:var(--panel);border:1px solid var(--b1);border-radius:7px;padding:8px;margin-bottom:5px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
          <span style="font-size:11px;font-weight:700">${e(sess.name)}</span>
          <span style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:900;color:var(--gold)">${fmtG(sess.cost)}</span>
        </div>
        <div style="font-size:9px;color:var(--muted);margin-bottom:4px">${e(sess.desc)} · ${sess.stats.join('/').toUpperCase()}</div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:9px;color:${realChance>=45?'var(--green)':realChance>=30?'var(--gold)':'var(--muted)'}">Réussite: ${realChance}%</span>
          <button class="btn ${canAfford?'btng':''}" style="padding:2px 10px;font-size:10px" onclick="runTraining(${si})" ${canAfford?'':'disabled'}>Entraîner</button>
        </div>
      </div>`;
    });
    if(C.trainingLog?.length) h += `<div style="font-size:8px;color:var(--muted);margin-top:8px;margin-bottom:3px">RÉSULTATS</div>
      <div id="training-log-box" style="background:var(--panel);border:1px solid var(--b1);border-radius:6px;padding:5px;font-size:9px;line-height:1.8"></div>`;
    h += '</div>';
    el.innerHTML = h;
    // Fill training log safely via DOM
    const tlb = document.getElementById('training-log-box');
    if(tlb && C.trainingLog?.length){
      C.trainingLog.slice(-5).reverse().forEach(entry=>{
        const d=document.createElement('div');
        d.style.color=entry.success?'var(--green)':'#666';
        d.textContent=entry.txt||'';
        tlb.appendChild(d);
      });
    }
  }

  else if(tab==='stats'){
    const ss=C.seasonStats||{wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0};
    const played=ss.wins+ss.draws+ss.losses;
    // Top scorers
    const scorers=[...PC.players].sort((a,b)=>(b.goals||0)-(a.goals||0)).slice(0,5);
    const assisters=[...PC.players].sort((a,b)=>(b.assists||0)-(a.assists||0)).slice(0,3);
    const mvp=[...PC.players].sort((a,b)=>(b.matchesPlayed||0)-(a.matchesPlayed||0)).slice(0,3);
    el.innerHTML=`<div style="padding:4px">${back}
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:900;color:var(--gold);margin-bottom:8px">📈 Statistiques Saison ${C.season}</div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:10px">
        ${[['Victoires','var(--green)',ss.wins],['Nuls','var(--gold)',ss.draws],['Défaites','#e06060',ss.losses],
           ['Buts marqués','var(--fg)',ss.goalsFor],['Buts encaissés','var(--muted)',ss.goalsAgainst],
           ['Matchs joués','var(--fg)',played]].map(([l,c,v])=>
          `<div style="background:var(--panel);border:1px solid var(--b1);border-radius:6px;padding:6px;text-align:center">
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;color:${c}">${v}</div>
            <div style="font-size:8px;color:var(--muted)">${l}</div>
          </div>`).join('')}
      </div>

      <div style="font-size:8px;color:var(--muted);letter-spacing:.5px;margin-bottom:4px">⚽ TOP BUTEURS</div>
      <div style="background:var(--panel);border:1px solid var(--b1);border-radius:8px;overflow:hidden;margin-bottom:8px">
        ${scorers.map((p,i)=>`<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;border-bottom:1px solid var(--b1)">
          <span style="font-size:9px;color:var(--muted);width:14px">${i+1}</span>
          <span style="font-size:10px;font-weight:700;flex:1">${e(p.name)}</span>
          <span style="font-size:9px;color:var(--muted)">${e(p.pos)}</span>
          <span style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:900;color:var(--green)">${p.goals||0}</span>
        </div>`).join('')}
        ${!scorers.length?`<div style="padding:8px;color:var(--muted);font-size:9px;text-align:center">Aucun but encore</div>`:''}
      </div>

      <div style="font-size:8px;color:var(--muted);letter-spacing:.5px;margin-bottom:4px">🎯 TOP PASSEURS</div>
      <div style="background:var(--panel);border:1px solid var(--b1);border-radius:8px;overflow:hidden;margin-bottom:8px">
        ${assisters.map((p,i)=>`<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;border-bottom:1px solid var(--b1)">
          <span style="font-size:9px;color:var(--muted);width:14px">${i+1}</span>
          <span style="font-size:10px;font-weight:700;flex:1">${e(p.name)}</span>
          <span style="font-size:9px;color:var(--muted)">${e(p.pos)}</span>
          <span style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:900;color:var(--gold)">${p.assists||0}</span>
        </div>`).join('')}
      </div>

      <div style="font-size:8px;color:var(--muted);letter-spacing:.5px;margin-bottom:4px">🏅 TEMPS DE JEU</div>
      <div style="background:var(--panel);border:1px solid var(--b1);border-radius:8px;overflow:hidden">
        ${mvp.map((p,i)=>`<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;border-bottom:1px solid var(--b1)">
          <span style="font-size:9px;color:var(--muted);width:14px">${i+1}</span>
          <span style="font-size:10px;font-weight:700;flex:1">${e(p.name)}</span>
          <span style="font-size:9px;color:var(--muted)">${e(p.pos)}</span>
          <span style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:900">${p.matchesPlayed||0}J</span>
        </div>`).join('')}
      </div>
    </div>`;
  }

  else if(tab==='divcup'){
    el.innerHTML=`<div style="padding:4px">${back}${renderCupTab(C.divCup,'divCup','🏆 Coupe de Division')}</div>`;
  }

  else if(tab==='natcup'){
    el.innerHTML=`<div style="padding:4px">${back}${renderCupTab(C.natCup,'natCup','🌍 Coupe Nationale')}</div>`;
  }

  else if(tab==='finance'){
    const ss=C.seasonStats||{};
    const played=(ss.wins||0)+(ss.draws||0)+(ss.losses||0);
    const avgRev=played>0?Math.round(
      ((ss.wins||0)*CAREER_MATCH_REVENUE.home.win+(ss.draws||0)*CAREER_MATCH_REVENUE.home.draw+(ss.losses||0)*CAREER_MATCH_REVENUE.home.loss)/played
    ):0;
    const spons=CAREER_SPONSOR_CONTRACTS.find(s=>s.id===PC.sponsorId)||CAREER_SPONSOR_CONTRACTS[0];
    const projWeekly=CAREER_MATCH_REVENUE.home.win + spons.perWin - totalWeekly(C);
    el.innerHTML=`<div style="padding:4px">${back}
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:900;color:var(--gold);margin-bottom:8px">💰 Finances</div>

      <div style="background:var(--panel);border:1px solid var(--b1);border-radius:8px;padding:10px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;margin-bottom:5px">
          <span style="font-size:10px;color:var(--muted)">Budget actuel</span>
          <span style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:900;color:${PC.budget>=0?'#18c860':'#e02030'}">${fmtG(PC.budget)}</span>
        </div>
        <div style="height:2px;background:var(--b1);border-radius:1px;margin-bottom:8px"></div>
        ${[
          ['Salaires joueurs',`-${fmtG(C.weeklyWage)}/sem`,'#e06060'],
          ['Infras (niv.'+Object.values(PC.infra||{}).reduce((s,v)=>s+v,0)+')',`-${fmtG(infraWeekly(C))}/sem`,'#e06060'],
          [spons.icon+' '+spons.name,`+${fmtG(spons.perWin)}/V`,'#18c860'],
          ['Bilan victoire dom.',`+${fmtG(CAREER_MATCH_REVENUE.home.win+spons.perWin-totalWeekly(C))}`,(CAREER_MATCH_REVENUE.home.win+spons.perWin-totalWeekly(C))>=0?'#18c860':'#e02030'],
        ].map(([l,v,col])=>`<div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="font-size:9px;color:var(--muted)">${l}</span>
          <span style="font-size:10px;font-weight:700;color:${col}">${v}</span>
        </div>`).join('')}
      </div>

      <div style="font-size:8px;color:var(--muted);letter-spacing:.5px;margin-bottom:4px">PRIMES FIN DE SAISON (preview)</div>
      <div style="background:var(--panel);border:1px solid var(--b1);border-radius:8px;padding:8px;margin-bottom:8px">
        ${[['🏆 Classement 1er','🪙300'],['🥈 Classement 2e','🪙180'],['🥉 3e','🪙100'],
           ['10+ victoires','🪙200'],['40+ buts','🪙150'],['<20 encaissés','🪙120'],
           [spons.icon+' Annuel sponsor',fmtG(Math.round(spons.fee*.5))],
           ['⬆️ Promotion D2→D1','🪙500']].map(([l,v])=>
          `<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid var(--b1)">
            <span style="font-size:9px;color:var(--muted)">${l}</span>
            <span style="font-size:9px;font-weight:700;color:var(--gold)">${v}</span>
          </div>`).join('')}
      </div>

      <div style="font-size:8px;color:var(--muted);letter-spacing:.5px;margin-bottom:4px">JOURNAL (${C.log?.length||0} entrées)</div>
      <div id="finance-log-box" style="background:var(--panel);border:1px solid var(--b1);border-radius:7px;padding:6px;font-size:9px;line-height:1.8;max-height:150px;overflow-y:auto"></div>
    </div>`;
    // Remplir le journal via DOM (données utilisateur non-sûres pour template)
    const flb=document.getElementById('finance-log-box');
    if(flb){
      const entries=C.log?.slice(-15).reverse()||[];
      if(!entries.length){flb.innerHTML='<span style="color:var(--muted)">Aucune entrée</span>';}
      else entries.forEach(entry=>{const d=document.createElement('div');d.style.color=entry.col||'var(--fg)';d.textContent=entry.txt||'';flb.appendChild(d);});
    }
  }

  else if(tab==='fixtures'){
    const allFix=C.leagueFixtures||[];
    const played=allFix.filter(f=>f.played&&(f.home===PC.id||f.away===PC.id));
    const pending=allFix.filter(f=>!f.played&&(f.home===PC.id||f.away===PC.id));
    const mkFixRow=(f,isPlayed)=>{
      const isHome=f.home===PC.id;
      const oppId=isHome?f.away:f.home;
      const opp=C.divClubs[PC.div].find(c=>c.id===oppId);
      if(!opp)return'';
      const oppName=String(opp.name||'?').replace(/</g,'&lt;');
      if(isPlayed){
        const sh=isHome?f.sh:f.sa; const sa=isHome?f.sa:f.sh;
        const col=sh>sa?'#18c860':sh===sa?'var(--gold)':'#e06060';
        return`<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 8px;border-bottom:1px solid var(--b1)">
          <span style="font-size:9px;color:var(--muted)">${isHome?'🏟️':'✈️'}</span>
          <span style="font-size:10px;font-weight:700;flex:1;margin-left:4px;color:${opp.color};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${oppName}</span>
          <span style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:900;color:${col}">${sh}-${sa}</span>
        </div>`;
      } else {
        return`<div style="display:flex;align-items:center;padding:4px 8px;border-bottom:1px solid var(--b1)">
          <span style="font-size:9px;color:var(--muted)">${isHome?'🏟️':'✈️'}</span>
          <span style="font-size:10px;font-weight:700;flex:1;margin-left:4px;color:${opp.color};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${oppName}</span>
          <span style="font-size:9px;color:var(--muted)">a jouer</span>
        </div>`;
      }
    };
    el.innerHTML=`<div style="padding:4px">${back}
      <div style="font-size:8px;color:var(--muted);letter-spacing:.5px;margin-bottom:4px">RÉSULTATS (${played.length})</div>
      <div style="background:var(--card);border:1px solid var(--b1);border-radius:8px;overflow:hidden;margin-bottom:8px">
        ${played.length?played.slice(-8).reverse().map(f=>mkFixRow(f,true)).join(''):'<div style="padding:8px;text-align:center;color:var(--muted);font-size:9px">Aucun match joue</div>'}
      </div>
      <div style="font-size:8px;color:var(--muted);letter-spacing:.5px;margin-bottom:4px">A VENIR (${pending.length})</div>
      <div style="background:var(--card);border:1px solid var(--b1);border-radius:8px;overflow:hidden">
        ${pending.length?pending.slice(0,8).map(f=>mkFixRow(f,false)).join(''):'<div style="padding:8px;text-align:center;color:var(--green);font-size:9px">Tous les matchs sont joues !</div>'}
      </div>
    </div>`;
  }

  else if(tab==='stats'){
    const ss=C.seasonStats||{wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0};
    const played=ss.wins+ss.draws+ss.losses;
    // Top scorers
    const scorers=[...PC.players].sort((a,b)=>(b.goals||0)-(a.goals||0)).slice(0,5);
    const assisters=[...PC.players].sort((a,b)=>(b.assists||0)-(a.assists||0)).slice(0,3);
    const mvp=[...PC.players].sort((a,b)=>(b.matchesPlayed||0)-(a.matchesPlayed||0)).slice(0,3);
    el.innerHTML=`<div style="padding:4px">${back}
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:900;color:var(--gold);margin-bottom:8px">📈 Statistiques Saison ${C.season}</div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:10px">
        ${[['Victoires','var(--green)',ss.wins],['Nuls','var(--gold)',ss.draws],['Défaites','#e06060',ss.losses],
           ['Buts marqués','var(--fg)',ss.goalsFor],['Buts encaissés','var(--muted)',ss.goalsAgainst],
           ['Matchs joués','var(--fg)',played]].map(([l,c,v])=>
          `<div style="background:var(--panel);border:1px solid var(--b1);border-radius:6px;padding:6px;text-align:center">
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;color:${c}">${v}</div>
            <div style="font-size:8px;color:var(--muted)">${l}</div>
          </div>`).join('')}
      </div>

      <div style="font-size:8px;color:var(--muted);letter-spacing:.5px;margin-bottom:4px">⚽ TOP BUTEURS</div>
      <div style="background:var(--panel);border:1px solid var(--b1);border-radius:8px;overflow:hidden;margin-bottom:8px">
        ${scorers.map((p,i)=>`<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;border-bottom:1px solid var(--b1)">
          <span style="font-size:9px;color:var(--muted);width:14px">${i+1}</span>
          <span style="font-size:10px;font-weight:700;flex:1">${e(p.name)}</span>
          <span style="font-size:9px;color:var(--muted)">${e(p.pos)}</span>
          <span style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:900;color:var(--green)">${p.goals||0}</span>
        </div>`).join('')}
        ${!scorers.length?`<div style="padding:8px;color:var(--muted);font-size:9px;text-align:center">Aucun but encore</div>`:''}
      </div>

      <div style="font-size:8px;color:var(--muted);letter-spacing:.5px;margin-bottom:4px">🎯 TOP PASSEURS</div>
      <div style="background:var(--panel);border:1px solid var(--b1);border-radius:8px;overflow:hidden;margin-bottom:8px">
        ${assisters.map((p,i)=>`<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;border-bottom:1px solid var(--b1)">
          <span style="font-size:9px;color:var(--muted);width:14px">${i+1}</span>
          <span style="font-size:10px;font-weight:700;flex:1">${e(p.name)}</span>
          <span style="font-size:9px;color:var(--muted)">${e(p.pos)}</span>
          <span style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:900;color:var(--gold)">${p.assists||0}</span>
        </div>`).join('')}
      </div>

      <div style="font-size:8px;color:var(--muted);letter-spacing:.5px;margin-bottom:4px">🏅 TEMPS DE JEU</div>
      <div style="background:var(--panel);border:1px solid var(--b1);border-radius:8px;overflow:hidden">
        ${mvp.map((p,i)=>`<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;border-bottom:1px solid var(--b1)">
          <span style="font-size:9px;color:var(--muted);width:14px">${i+1}</span>
          <span style="font-size:10px;font-weight:700;flex:1">${e(p.name)}</span>
          <span style="font-size:9px;color:var(--muted)">${e(p.pos)}</span>
          <span style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:900">${p.matchesPlayed||0}J</span>
        </div>`).join('')}
      </div>
    </div>`;
  }

  else if(tab==='finance'){
    const ss=C.seasonStats||{};
    const played=(ss.wins||0)+(ss.draws||0)+(ss.losses||0);
    const avgRev=played>0?Math.round(
      ((ss.wins||0)*CAREER_MATCH_REVENUE.home.win+(ss.draws||0)*CAREER_MATCH_REVENUE.home.draw+(ss.losses||0)*CAREER_MATCH_REVENUE.home.loss)/played
    ):0;
    const spons=CAREER_SPONSOR_CONTRACTS.find(s=>s.id===PC.sponsorId)||CAREER_SPONSOR_CONTRACTS[0];
    const projWeekly=CAREER_MATCH_REVENUE.home.win + spons.perWin - totalWeekly(C);
    el.innerHTML=`<div style="padding:4px">${back}
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:900;color:var(--gold);margin-bottom:8px">💰 Finances</div>

      <div style="background:var(--panel);border:1px solid var(--b1);border-radius:8px;padding:10px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;margin-bottom:5px">
          <span style="font-size:10px;color:var(--muted)">Budget actuel</span>
          <span style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:900;color:${PC.budget>=0?'#18c860':'#e02030'}">${fmtG(PC.budget)}</span>
        </div>
        <div style="height:2px;background:var(--b1);border-radius:1px;margin-bottom:8px"></div>
        ${[
          ['Salaires joueurs',`-${fmtG(C.weeklyWage)}/sem`,'#e06060'],
          ['Infras (niv.'+Object.values(PC.infra||{}).reduce((s,v)=>s+v,0)+')',`-${fmtG(infraWeekly(C))}/sem`,'#e06060'],
          [spons.icon+' '+spons.name,`+${fmtG(spons.perWin)}/V`,'#18c860'],
          ['Bilan victoire dom.',`+${fmtG(CAREER_MATCH_REVENUE.home.win+spons.perWin-totalWeekly(C))}`,(CAREER_MATCH_REVENUE.home.win+spons.perWin-totalWeekly(C))>=0?'#18c860':'#e02030'],
        ].map(([l,v,col])=>`<div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="font-size:9px;color:var(--muted)">${l}</span>
          <span style="font-size:10px;font-weight:700;color:${col}">${v}</span>
        </div>`).join('')}
      </div>

      <div style="font-size:8px;color:var(--muted);letter-spacing:.5px;margin-bottom:4px">PRIMES FIN DE SAISON (preview)</div>
      <div style="background:var(--panel);border:1px solid var(--b1);border-radius:8px;padding:8px;margin-bottom:8px">
        ${[['🏆 Classement 1er','🪙300'],['🥈 Classement 2e','🪙180'],['🥉 3e','🪙100'],
           ['10+ victoires','🪙200'],['40+ buts','🪙150'],['<20 encaissés','🪙120'],
           [spons.icon+' Annuel sponsor',fmtG(Math.round(spons.fee*.5))],
           ['⬆️ Promotion D2→D1','🪙500']].map(([l,v])=>
          `<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid var(--b1)">
            <span style="font-size:9px;color:var(--muted)">${l}</span>
            <span style="font-size:9px;font-weight:700;color:var(--gold)">${v}</span>
          </div>`).join('')}
      </div>

      <div style="font-size:8px;color:var(--muted);letter-spacing:.5px;margin-bottom:4px">JOURNAL (${C.log?.length||0} entrées)</div>
      <div id="finance-log-box" style="background:var(--panel);border:1px solid var(--b1);border-radius:7px;padding:6px;font-size:9px;line-height:1.8;max-height:150px;overflow-y:auto"></div>
    </div>`;
    // Remplir le journal via DOM (données utilisateur non-sûres pour template)
    const flb=document.getElementById('finance-log-box');
    if(flb){
      const entries=C.log?.slice(-15).reverse()||[];
      if(!entries.length){flb.innerHTML='<span style="color:var(--muted)">Aucune entrée</span>';}
      else entries.forEach(entry=>{const d=document.createElement('div');d.style.color=entry.col||'var(--fg)';d.textContent=entry.txt||'';flb.appendChild(d);});
    }
  }

  else if(tab==='fixtures'){
    const allFix=C.leagueFixtures||[];
    const played=allFix.filter(f=>f.played&&(f.home===PC.id||f.away===PC.id));
    const pending=allFix.filter(f=>!f.played&&(f.home===PC.id||f.away===PC.id));
    const mkFixRow=(f,isPlayed)=>{
      const isHome=f.home===PC.id;
      const oppId=isHome?f.away:f.home;
      const opp=C.divClubs[PC.div].find(c=>c.id===oppId);
      if(!opp)return'';
      const oppName=String(opp.name||'?').replace(/</g,'&lt;');
      if(isPlayed){
        const sh=isHome?f.sh:f.sa; const sa=isHome?f.sa:f.sh;
        const col=sh>sa?'#18c860':sh===sa?'var(--gold)':'#e06060';
        return`<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 8px;border-bottom:1px solid var(--b1)">
          <span style="font-size:9px;color:var(--muted)">${isHome?'🏟️':'✈️'}</span>
          <span style="font-size:10px;font-weight:700;flex:1;margin-left:4px;color:${opp.color};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${oppName}</span>
          <span style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:900;color:${col}">${sh}-${sa}</span>
        </div>`;
      } else {
        return`<div style="display:flex;align-items:center;padding:4px 8px;border-bottom:1px solid var(--b1)">
          <span style="font-size:9px;color:var(--muted)">${isHome?'🏟️':'✈️'}</span>
          <span style="font-size:10px;font-weight:700;flex:1;margin-left:4px;color:${opp.color};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${oppName}</span>
          <span style="font-size:9px;color:var(--muted)">a jouer</span>
        </div>`;
      }
    };
    el.innerHTML=`<div style="padding:4px">${back}
      <div style="font-size:8px;color:var(--muted);letter-spacing:.5px;margin-bottom:4px">RÉSULTATS (${played.length})</div>
      <div style="background:var(--card);border:1px solid var(--b1);border-radius:8px;overflow:hidden;margin-bottom:8px">
        ${played.length?played.slice(-8).reverse().map(f=>mkFixRow(f,true)).join(''):'<div style="padding:8px;text-align:center;color:var(--muted);font-size:9px">Aucun match joue</div>'}
      </div>
      <div style="font-size:8px;color:var(--muted);letter-spacing:.5px;margin-bottom:4px">A VENIR (${pending.length})</div>
      <div style="background:var(--card);border:1px solid var(--b1);border-radius:8px;overflow:hidden">
        ${pending.length?pending.slice(0,8).map(f=>mkFixRow(f,false)).join(''):'<div style="padding:8px;text-align:center;color:var(--green);font-size:9px">Tous les matchs sont joues !</div>'}
      </div>
    </div>`;
  }

  else if(tab==='youth'){
    const lvl = (PC.infra?.formation)||0;
    if(!lvl){ el.innerHTML=`<div style="padding:12px;text-align:center;color:var(--muted)">${back}Centre de formation non construit.</div>`; return; }
    let h = `<div style="padding:4px">${back}
      <div style="font-size:11px;font-weight:700;margin-bottom:2px">🌱 Centre de formation Niv.${lvl}</div>
      <div style="font-size:9px;color:var(--muted);margin-bottom:8px">Signer: <b>🪙15</b> · Budget: <b>${fmtG(PC.budget)}</b></div>`;
    if(!C.youthPlayers?.length) h += `<div style="text-align:center;color:var(--muted);font-size:10px;padding:16px">Aucun jeune disponible.<br>Nouveaux talents en fin de saison.</div>`;
    (C.youthPlayers||[]).forEach((p,yi)=>{
      const ovr=careerOvr(p); const canSign=PC.budget>=15;
      h += `<div style="background:var(--panel);border:1px solid var(--b1);border-radius:8px;padding:8px;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px">
          <div style="width:32px;height:32px;border-radius:50%;background:${PC.color}22;border:1px solid ${PC.color}44;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:${PC.color}">${e(p.ini)}</div>
          <div><div style="font-size:11px;font-weight:700">${e(p.name)} <span style="font-size:8px;color:var(--muted)">${e(p.pos)} · ${p.age}ans</span></div>
          <div style="font-size:8px;color:var(--gold)">Potentiel: ${p.potential} OVR</div></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:2px;margin-bottom:7px">
          ${['spd','sht','def','stam','tec','res'].map(k=>`<div style="text-align:center;background:var(--card);border-radius:3px;padding:2px 0"><div style="font-size:11px;font-weight:700">${p.s[k]}</div><div style="font-size:7px;color:var(--muted)">${k.toUpperCase()}</div></div>`).join('')}
        </div>
        <div style="display:flex;gap:5px">
          <button class="btn ${canSign?'btng':''}" style="flex:2;justify-content:center;font-size:10px" onclick="signYouth(${yi})" ${canSign?'':'disabled'}>Signer 🪙15</button>
          <button class="btn" style="flex:1;justify-content:center;font-size:10px" onclick="dismissYouth(${yi})">Refuser</button>
        </div>
      </div>`;
    });
    h += '</div>'; el.innerHTML = h;
  }
}

function renewContract(pi){
  const C=careerState; const PC=C.playerClub;
  const p=PC.players[pi]; if(!p) return;
  const cost=careerWeeklySalary(p)*4; // 4 semaines de salaire comme prime de signature
  if(PC.budget<cost){ careerLog('Budget insuffisant pour renouveler (-'+fmtG(cost)+')','#e06060'); return; }
  PC.budget-=cost;
  p.contract=(p.contract||0)+2;
  C.weeklyWage=PC.players.reduce((s,p2)=>s+careerWeeklySalary(p2),0);
  careerLog('🤝 '+p.name+' prolongé +2ans — '+fmtG(cost)+' prime','#18c860');
  saveCareer(); openCareerTab('squad');
}

function firePlayer(pi){
  const C=careerState; const PC=C.playerClub;
  if(PC.players.filter((_,i)=>i<7).length<=6&&pi<7){
    showCareerConfirm('Impossible: 7 titulaires minimum requis.',()=>{}); return;
  }
  const p=PC.players[pi]; if(!p) return;
  // Indemnité = 0 si budget négatif, sinon 20% de la valeur
  const indem = PC.budget < 0 ? 0 : Math.round(careerValue(p)*0.2);
  // Confirmation licenciement via modal
  showCareerConfirm('Licencier '+p.name+'?\nIndemnité: '+fmtG(indem)+' | Salaire: '+fmtG(careerWeeklySalary(p))+'/sem', ()=>{
    PC.budget += indem;
    PC.players.splice(pi,1);
    C.weeklyWage = PC.players.reduce((s,p2)=>s+careerWeeklySalary(p2),0);
    careerLog('🔴 '+p.name+' licencié (+'+fmtG(indem)+')', '#888');
    syncCareerToTeam(); saveCareer(); openCareerTab('squad');
  });
}

function sellPlayer(pi){
  const C=careerState; const PC=C.playerClub;
  if(PC.players.filter((_,i)=>i<7).length<=6&&pi<7){
    showCareerConfirm('Impossible: 7 titulaires minimum.',()=>{}); return;
  }
  const p=PC.players[pi]; if(!p) return;
  const val=careerValue(p);
  const fee=Math.round(val*(0.7+Math.random()*0.6));
  showCareerConfirm('Vendre '+p.name+' pour '+fmtG(fee)+' ?', ()=>{
    PC.budget+=fee; PC.players.splice(pi,1);
    C.weeklyWage=PC.players.reduce((s,p2)=>s+careerWeeklySalary(p2),0);
    careerLog('💸 '+p.name+' vendu pour '+fmtG(fee),'#18c860');
    syncCareerToTeam(); saveCareer(); openCareerTab('squad');
  });
}

// ── Sponsor ───────────────────────────────────────────────────────
function signSponsor(id){
  const C=careerState; const PC=C.playerClub;
  const spons = CAREER_SPONSOR_CONTRACTS.find(s=>s.id===id); if(!spons) return;
  PC.sponsorId = id;
  PC.budget += spons.fee;
  careerLog((spons.icon||"")+' Contrat "'+(spons.name||'')+'" signé ! +'+(spons.fee?fmtG(spons.fee):'')+' prime de signature', '#f0c028');
  saveCareer(); openCareerTab('sponsors');
}

// ── Infra ─────────────────────────────────────────────────────────
function buyInfra(key){
  const C=careerState; const PC=C.playerClub;
  const def=INFRA_DEFS[key]; if(!def) return;
  if(!PC.infra)PC.infra={stadium:0,training:0,formation:0,medical:0};
  const lvl=(PC.infra[key]||0);
  const cost=def.cost*(lvl+1);
  if(PC.budget<cost){ careerLog('Budget insuffisant: -'+fmtG(cost),'#e06060'); return; }
  if(lvl>=def.lvlMax){ return; }
  PC.budget-=cost; PC.infra[key]=(lvl+1);
  careerLog((def.icon||'')+' '+(def.name||'')+' '+(lvl===0?'construite':'améliorée')+' Niv.'+(lvl+1)+' — '+fmtG(cost), '#f0c028');
  saveCareer(); openCareerTab('infra');
}

// ── Entraînement ─────────────────────────────────────────────────
function runTraining(si){
  const C=careerState; const PC=C.playerClub;
  const sess=TRAINING_SESSIONS[si]; if(!sess) return;
  if(PC.budget<sess.cost){ careerLog('Budget insuffisant: -'+fmtG(sess.cost),'#e06060'); return; }
  const tpEl=document.getElementById('training-player'); if(!tpEl) return;
  const pi=parseInt(tpEl.value||0);
  const p=PC.players[pi]; if(!p) return;
  PC.budget-=sess.cost;
  const lvl=(PC.infra?.training)||1;
  const bonus=lvl>=2?.1:lvl>=1?.05:0;
  const success=Math.random()<(sess.chance+bonus);
  C.trainingLog=C.trainingLog||[];
  if(success){
    const statKey=pick(sess.stats);
    p.s[statKey]=Math.min(99,(p.s[statKey]||50)+1);
    const txt=`✅ ${p.name} +1 ${statKey.toUpperCase()} (${sess.name})`;
    C.trainingLog.push({txt,success:true});
    careerLog(txt,'#18c860');
  } else {
    const txt=`❌ ${p.name} — pas de progrès (${sess.name})`;
    C.trainingLog.push({txt,success:false});
    careerLog(txt,'#888');
  }
  if(C.trainingLog.length>20) C.trainingLog=C.trainingLog.slice(-20);
  saveCareer(); openCareerTab('training');
}

// ── Mercato ───────────────────────────────────────────────────────
function generateTransferMarket(){
  const PC=careerState?.playerClub;
  const myDiv=PC?.div||1;
  // Generate players appropriate for the current division
  const baseOvr=myDiv===0?62:myDiv===1?50:38;
  const market=[];
  const names=[...AI_NAMES].sort(()=>Math.random()-.5);
  const sc=(base)=>Math.max(20,Math.min(99,base+~~((Math.random()-.5)*20)));
  for(let i=0;i<8;i++){
    const base=baseOvr+~~((Math.random()-.5)*20);
    const pos=pick([...ROLE,...['MC','ATT','DC']]);
    const name=names[i%names.length]||'Joueur';
    const p={
      id:`market_${Date.now()}_${i}`,name,pos,
      ini:name.slice(0,2).toUpperCase(),img:'',
      age:18+~~(Math.random()*14),
      contract:0,potential:base+10,
      s:{spd:sc(base),sht:sc(base),def:sc(base),stam:sc(base),tec:sc(base),res:sc(base)},
      spells:spellForPos(pos,name),race:pickRaceForRegion('',name+pos),xp:0,goals:0,assists:0,matchesPlayed:0,
      x:0,y:0,vx:0,vy:0,tx:0,ty:0,hp:100,mp:100,yc:0,red:false,stunT:0,hasBall:false,
      injLevel:0,injT:0,mG:0,mSh:0,mTk:0,mSp:0,_img:null,
      _spdDebuff:0,_charmed:0,_atkBuff:0,_pacified:0,_invis:0,_folie:0,_aile:0,_sixsens:0,_sylvestre:0,
      bobPhase:Math.random()*Math.PI*2,wPhaseX:Math.random()*Math.PI*2,wPhaseY:Math.random()*Math.PI*2,wSpeed:1.4+Math.random()*1.2,
      runT:0,runTx:0,runTy:0,runCool:Math.random()*2,dribCurve:0,tackleCool:0,
    };
    p.fee=Math.round(careerValue(p)*(0.9+Math.random()*0.5));
    p.agentName=pick(CAREER_AGENT_NAMES);
    p.contractOffer=1+~~(Math.random()*3);
    market.push(p);
  }
  return market.sort((a,b)=>b.fee-a.fee);
}

function buyPlayer(ti){
  const C=careerState; const PC=C.playerClub;
  const p=C.transferMarket[ti]; if(!p) return;
  if(PC.budget<p.fee){ careerLog('Budget insuffisant pour signer ce joueur.','#e06060'); return; }
  PC.budget-=p.fee; p.contract=p.contractOffer||1; p.xp=0; p.goals=0; p.assists=0; p.matchesPlayed=0;
  PC.players.push(p); C.transferMarket.splice(ti,1);
  C.weeklyWage=PC.players.reduce((s,p2)=>s+careerWeeklySalary(p2),0);
  careerLog('💸 '+e(p.name)+' recruté '+fmtG(p.fee)+' · '+p.contract+'an', '#18c860');
  syncCareerToTeam(); saveCareer(); openCareerTab('transfer');
}

function signYouth(yi){
  const C=careerState; const PC=C.playerClub;
  if(PC.budget<15){ careerLog('Budget insuffisant (15🪙 min)','#e06060'); return; }
  const p=C.youthPlayers[yi]; if(!p) return;
  PC.budget-=15; p.contract=2; p.xp=0;
  PC.players.push(p); C.youthPlayers.splice(yi,1);
  C.weeklyWage=PC.players.reduce((s,p2)=>s+careerWeeklySalary(p2),0);
  careerLog('🌱 '+p.name+' signé !', '#f0c028');
  syncCareerToTeam(); saveCareer(); openCareerTab('youth');
}

function dismissYouth(yi){ careerState.youthPlayers.splice(yi,1); saveCareer(); openCareerTab('youth'); }

function generateIncomingOffers(){
  const C=careerState; const PC=C.playerClub;
  if((C.pendingOffers?.length||0)>=5) return; // cap at 5 pending offers
  if(PC.players.length <= 8) return; // trop peu de joueurs, pas d'offres
  PC.players.slice(0,12).forEach(p=>{
    if(Math.random()<.06){
      const fee=Math.round(careerValue(p)*(1.1+Math.random()*.5));
      C.pendingOffers=C.pendingOffers||[];
      C.pendingOffers.push({playerId:p.id,playerName:p.name,fee,agentName:pick(CAREER_AGENT_NAMES)});
    }
  });
}

function acceptTransferOffer(oi){
  const C=careerState; const PC=C.playerClub;
  const offer=C.pendingOffers[oi]; if(!offer) return;
  const pi=PC.players.findIndex(p=>p.id===offer.playerId);
  if(pi>=0){
    // Refuser si ça laisse moins de 8 joueurs ou moins de 7 titulaires
    if(PC.players.length <= 8 || (pi < 7 && PC.players.slice(0,7).length <= 7)){
      careerLog('❌ Offre refusée auto: effectif minimum requis','#e06060');
      C.pendingOffers.splice(oi,1); saveCareer(); renderCareer(); return;
    }
    PC.budget+=offer.fee; PC.players.splice(pi,1);
  }
  C.pendingOffers.splice(oi,1);
  C.weeklyWage=PC.players.reduce((s,p)=>s+careerWeeklySalary(p),0);
  careerLog('✓ '+(offer.playerName||'?')+' vendu '+fmtG(offer.fee), '#18c860');
  syncCareerToTeam(); saveCareer(); renderCareer();
}

function rejectTransferOffer(oi){
  const C=careerState;
  careerLog('✕ Offre refusée: '+(C.pendingOffers[oi]?.playerName||'?'), '#e06060');
  C.pendingOffers.splice(oi,1); saveCareer(); renderCareer();
}

// ── Synchro équipe ─────────────────────────────────────────────
function syncCareerToTeam(){
  const PC=careerState?.playerClub; if(!PC||!PC.players) return;
  const all=PC.players||[];
  teams[0].name=PC.name; teams[0].color=PC.color; teams[0].img=PC.img||'';
  teams[0].strat=PC.strat||'321';
  // Séparer les joueurs disponibles et indisponibles (blessés graves)
  const available=all.filter(p=>!p._missNextMatch);
  const unavailable=all.filter(p=>p._missNextMatch);
  teams[0].players=available.slice(0,7).map(p=>clonePlayer(p));
  teams[0].bench=[...available.slice(7,12),...unavailable.slice(0,Math.max(0,5-Math.max(0,available.length-7)))].slice(0,5).map(p=>({...clonePlayer(p),onBench:true,x:-10,y:PCY,tx:-10,ty:PCY}));
  teams[0].reserves=[...available.slice(12),...unavailable].map(p=>clonePlayer(p));
  syncHUD(); renderTB(0);
}

// ── Matchs ─────────────────────────────────────────────────────
function playCareerMatch(){
  const C=careerState;
  if(!C){nav('career');return;}
  const PC=C.playerClub;

  if(!PC.players||PC.players.length<7){
    showCareerConfirm('Recrutez au moins 7 joueurs avant de jouer.',()=>openCareerTab('transfer'));
    return;
  }

  const fix=(C.leagueFixtures||[]).find(f=>!f.played&&(f.home===PC.id||f.away===PC.id));
  if(!fix){saveCareer();nav('career');return;}

  const oppId = fix.home===PC.id ? fix.away : fix.home;
  const opp = C.divClubs.flat().find(cl=>cl.id===oppId);
  if(!opp){careerLog('Adversaire introuvable','#888');fix.played=true;saveCareer();nav('career');return;}

  // Préparer teams[0] (joueur)
  syncCareerToTeam();

  // Préparer teams[1] (adversaire)
  const oppAll = opp.players && opp.players.length>=7 ? opp.players : mkCareerAIRoster(oppId, opp.div===0?75:opp.div===1?62:50);
  teams[1] = {
    name:opp.name, color:opp.color, img:opp.img||'', strat:opp.strat||'321',
    players: oppAll.slice(0,7).map(p=>clonePlayer(p)),
    bench:   oppAll.slice(7,12).map(p=>({...clonePlayer(p),onBench:true,x:-10,y:PCY,tx:-10,ty:PCY})),
    reserves:oppAll.slice(12).map(p=>clonePlayer(p)),
  };

  // Backup pour restauration post-match
  _leagueUserTeamBackup = [deepCloneTeam(teams[0]), deepCloneTeam(teams[1])];

  // Stocker la ref pour recordCareerMatchResult
  window._careerFixRef = fix;
  window._careerOppClub = opp;
  window._careerIsHome = fix.home===PC.id;

  G.leagueMode=false; G.careerMode=true; G.careerCupMode=false;
  _lastNav='career';

  resetMatch();
  nav('match');
  syncHUD(); renderTB(0); renderTB(1);
  showPreMatch();
}

function simCareerMatch(){
  const C=careerState;
  if(!C){nav('career');return;}
  const PC=C.playerClub;

  // Guard joueurs
  if(!PC.players||PC.players.length<7){
    showCareerConfirm('Recrutez au moins 7 joueurs avant de simuler.',()=>openCareerTab('transfer'));
    return;
  }

  // Trouver le prochain match du joueur
  const fix=(C.leagueFixtures||[]).find(f=>!f.played&&(f.home===PC.id||f.away===PC.id));
  if(!fix){
    // Tous les matchs du joueur sont joués
    const allDone=(C.leagueFixtures||[]).every(f=>f.played);
    if(allDone){endCareerSeason();}
    else{saveCareer();nav('career');}
    return;
  }

  // Trouver l'adversaire dans toutes les divisions
  const oppId = fix.home===PC.id ? fix.away : fix.home;
  const opp = C.divClubs.flat().find(cl=>cl.id===oppId);
  if(!opp){
    // Fixture orpheline - la marquer comme jouée et passer
    fix.played=true; fix.sh=0; fix.sa=0;
    careerLog('Match annulé (adversaire introuvable)','#888');
    saveCareer(); nav('career'); return;
  }

  // Simuler
  const res = simulateCareerFixture(PC, opp);
  applyCareerFixResult(fix, res);

  const isHome = fix.home===PC.id;
  const myG = isHome ? res.sh : res.sa;
  const oppG = isHome ? res.sa : res.sh;
  applyCareerRevenue(myG, oppG, isHome, opp);

  // Charges hebdomadaires
  if(PC.budget>=-500){ PC.budget -= totalWeekly(C); }
  if(PC.budget<0){ careerLog('⚠️ Crise financière','#e02030'); }

  C.week++;
  generateIncomingOffers();

  // Fin de saison ?
  const allDone=(C.leagueFixtures||[]).every(f=>f.played);
  if(allDone||C.week>CAREER_SEASON_MATCHES*2){
    setTimeout(()=>endCareerSeason(),100);
    return;
  }

  saveCareer();
  nav('career');
}

function simAllCareerNPC(){
  const C=careerState; const PC=C.playerClub; if(!C.leagueFixtures?.length) return; let n=0;
  (C.leagueFixtures||[]).filter(f=>!f.played&&f.home!==PC.id&&f.away!==PC.id).forEach(fix=>{
    const h=C.divClubs[PC.div].find(c=>c.id===fix.home);
    const a=C.divClubs[PC.div].find(c=>c.id===fix.away);
    if(h&&a){ applyCareerFixResult(fix,simulateCareerFixture(h,a)); n++; }
  });
  if(n) careerLog('⚡ Matchs NPC simules.','#8840e0');
  saveCareer(); nav('career');
}

function simulateCareerFixture(home,away){
  // Bonus infra pour l'équipe joueur (stade = avantage domicile supplémentaire)
  const getInfraBonus = club => {
    if(!club?.infra) return 0;
    return (club.infra.stadium||0)*2 + (club.infra.training||0)*1.5 + (club.infra.medical||0)*1;
  };
  const hStr = teamStrength(home, getInfraBonus(home))/99 + 0.08;
  const aStr = teamStrength(away, getInfraBonus(away))/99;
  const hp   = hStr/(hStr+aStr);
  const hGoals = rGoals(hp)   + (Math.random()<hp*0.30?1:0);
  const aGoals = rGoals(1-hp) + (Math.random()<(1-hp)*0.30?1:0);
  const hSpell = simSpellBonus(home), aSpell = simSpellBonus(away);
  let sh = Math.max(0, Math.round(hGoals + hSpell));
  let sa = Math.max(0, Math.round(aGoals + aSpell));
  if(hp > 0.62 && sa > sh && Math.random() < 0.45){ const t=sh; sh=sa; sa=t; }
  if(hp < 0.38 && sh > sa && Math.random() < 0.45){ const t=sh; sh=sa; sa=t; }
  return{sh, sa};
}

function applyCareerFixResult(fix,{sh,sa}){
  const C=careerState;
  fix.played=true; fix.sh=sh; fix.sa=sa;
  const apply=(club,gs,gc)=>{
    if(!club) return;
    club.gf+=gs; club.ga+=gc;
    if(gs>gc){club.pts+=3;club.w++;}else if(gs===gc){club.pts+=1;club.d++;}else club.l++;
  };
  const allClubs=C.divClubs.flat();
  apply(allClubs.find(c=>c.id===fix.home),sh,sa);
  apply(allClubs.find(c=>c.id===fix.away),sa,sh);
}

function applyCareerRevenue(sh,sa,isHome,opp){
  const C=careerState; const PC=C.playerClub;
  const type=sh>sa?'win':sh===sa?'draw':'loss';
  const base=CAREER_MATCH_REVENUE[isHome?'home':'away'][type];
  const stadBonus=isHome?(PC.infra?.stadium||0)*.3:0;
  const earned=Math.round(base*(1+stadBonus));
  const spons=CAREER_SPONSOR_CONTRACTS.find(s=>s.id===PC.sponsorId)||CAREER_SPONSOR_CONTRACTS[0];
  const sponsBonus=type==='win'?spons.perWin:0;
  PC.budget+=earned+sponsBonus;
  const emoji=sh>sa?'✅':sh===sa?'🟡':'❌';
  careerLog(emoji+' '+sh+'-'+sa+' vs '+(opp?.name||'?')+' +'+fmtG(earned+sponsBonus));
  // Mise à jour stats saison
  C.seasonStats=C.seasonStats||{wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0};
  if(sh>sa)C.seasonStats.wins++;else if(sh===sa)C.seasonStats.draws++;else C.seasonStats.losses++;
  C.seasonStats.goalsFor+=sh; C.seasonStats.goalsAgainst+=sa;
}

function recordCareerMatchResult(s0,s1){
  const C=careerState; if(!C) return;
  const fix=window._careerFixRef; const opp=window._careerOppClub;
  if(!fix||!opp) return;
  if(fix.played){window._careerFixRef=null;window._careerOppClub=null;return;}// no double apply
  const isHome=window._careerIsHome;
  const sh=isHome?s0:s1; const sa=isHome?s1:s0;
  applyCareerFixResult(fix,{sh:fix.home===C.playerClub.id?sh:sa, sa:fix.home===C.playerClub.id?sa:sh});
  // Sync post-match player state back to PC (injuries, yc, stats)
  const syncBack = (pcArr, matchArr) => {
    if(!pcArr||!matchArr) return;
    matchArr.forEach(mp=>{
      const pp=pcArr.find(p=>p.id===mp.id);
      if(!pp) return;
      pp.injLevel=mp.injLevel||0; pp.injT=mp.injT||0;
      pp.yc=mp.yc||0; pp.red=mp.red||false;
      pp.hp=mp.hp||100; pp.mp=mp.mp||100;
      // ── BLESSURE DE CARRIÈRE ─────────────────────────────────────────
      // Une blessure contractée en match rend le joueur indisponible plusieurs
      // semaines selon sa gravité. La résistance aux blessures réduit la durée.
      if((mp.injLevel||0) > 0){
        const resStat = (pp.s2 && pp.s2.resBless!=null) ? pp.s2.resBless : (pp.s && pp.s.res!=null ? pp.s.res : 50);
        const resMul = 1 - (resStat/99)*0.4;              // bon "résistance" → guérit plus vite
        const baseWeeks = {1:[1,2], 2:[2,4], 3:[4,9]}[mp.injLevel] || [1,2];
        const wk = Math.max(1, Math.round((baseWeeks[0] + Math.random()*(baseWeeks[1]-baseWeeks[0])) * resMul));
        // On garde la blessure la plus longue si le joueur en avait déjà une
        pp._injWeeks = Math.max(pp._injWeeks||0, wk);
        pp._injLevelCareer = mp.injLevel;
        pp._missNextMatch = true;
        if(typeof careerLog==='function') careerLog(`🤕 ${pp.name} blessé — indisponible ${pp._injWeeks} sem.`, INJ_COLORS?.[mp.injLevel]||'#e06060');
      }
    });
  };
  syncBack(C.playerClub.players, teams[0]?.players);
  syncBack(C.playerClub.players, teams[0]?.bench);
  // XP, goals, assists
  C.playerClub.players.forEach(p=>{
    const mp=[...( teams[0]?.players||[]),...(teams[0]?.bench||[])].find(m=>m.id===p.id);
    if(!mp) return;
    p.matchesPlayed=(p.matchesPlayed||0)+1;
    p.goals=(p.goals||0)+(mp.mG||0);
    p.assists=(p.assists||0)+(mp.mTk||0); // mTk = tackles/passes as proxy for assists
    p.xp=(p.xp||0)+10+(mp.mG||0)*30+(mp.mTk||0)*8+(mp.mSp||0)*5;
  });
  applyCareerRevenue(s0,s1,isHome,opp);
  generateIncomingOffers();
  // Weekly charges: salaries + infra (suspendues si faillite)
  const PC=C.playerClub;
  if(PC.budget >= -500){
    PC.budget-=totalWeekly(C);
    careerLog('💼 -'+fmtG(totalWeekly(C))+' charges sem.'+C.week,'#444');
  }
  if(PC.budget<0){careerLog('⚠️ CRISE FINANCIERE ! Vendez des joueurs.','#e02030');}
  // ── RÉCUPÉRATION HEBDOMADAIRE DES BLESSÉS ────────────────────────────
  // Chaque semaine, les joueurs blessés se rapprochent du retour. Quand le
  // compteur atteint 0, le joueur est de nouveau disponible.
  (C.playerClub.players||[]).concat(C.playerClub.bench||[], C.playerClub.reserves||[]).forEach(p=>{
    if(p && p._injWeeks>0){
      p._injWeeks--;
      if(p._injWeeks<=0){
        p._injWeeks=0; p._missNextMatch=false; p.injLevel=0; p.injT=0; p._injLevelCareer=0;
        if(typeof careerLog==='function') careerLog(`✅ ${p.name} est rétabli et de nouveau disponible.`, '#18c860');
      } else {
        p._missNextMatch=true;
        // Guérison progressive du niveau affiché
        if(p._injWeeks<=1) p.injLevel=Math.min(p.injLevel||1,1);
      }
    }
  });
  C.week++;
  window._careerFixRef=null; window._careerOppClub=null;
  // Check if all matches played → auto end of season
  const allDone=(C.leagueFixtures||[]).every(f=>f.played);
  if(allDone){setTimeout(()=>endCareerSeason(),300);return;}
  saveCareer();
}

// ── Fin de saison ─────────────────────────────────────────────
function endCareerSeason(){
  const C=careerState; const PC=C.playerClub;
  const standings=getCareerStandings(PC.div);
  const myPos=(standings.findIndex(s=>s.id===PC.id)+1)||99;
  const n=standings.length;
  const divName=CAREER_DIV_NAMES[PC.div];

  // ── Joueurs en fin de contrat ─────────────────────────
  const expiring = PC.players.filter(p=>(p.contract||0)<=0);
  if(expiring.length>0){
    expiring.forEach(p=>{
      const starters = PC.players.slice(0,7);
      const isStarter = starters.indexOf(p) >= 0;
      // Si < 8 joueurs total ou < 7 titulaires, forcer la prolongation
      if(PC.players.length <= 8 || (isStarter && starters.length <= 7)){
        p.contract=1; careerLog('🤝 '+p.name+' prolongé (effectif minimum)','#888');
        return;
      }
      if(Math.random()<.7){
        const idx=PC.players.indexOf(p);
        if(idx>=0){ PC.players.splice(idx,1); careerLog('👋 '+p.name+' quitte le club (fin de contrat)','#e06060'); }
      } else {
        p.contract=1; careerLog('🤝 '+p.name+' prolonge 1 an','#888');
      }
    });
    C.weeklyWage=PC.players.reduce((s,p)=>s+careerWeeklySalary(p),0);
  }

  // Remboursement prêt d'urgence
  if(C._loanTaken && C._loanAmount){
    const repay = C._loanAmount;
    PC.budget -= repay;
    careerLog('🏦 Remboursement prêt: -'+fmtG(repay), '#e06060');
    C._loanTaken = false; C._loanAmount = 0;
  }

  careerLog('─── FIN DE SAISON '+C.season+' ───','var(--gold)');

  // ── Évolution joueurs (XP) ────────────────────────────
  let evolved=0;
  PC.players.forEach(p=>{
    const xp=p.xp||0; if(xp<100) return;
    const gains=Math.min(5,~~(xp/100));
    const pref=['ATT','MO','AG','AD'].includes(p.pos)?['sht','tec','spd']:
                ['GB','DC','DD','DG'].includes(p.pos)?['def','stam','res']:['tec','stam','spd'];
    for(let g=0;g<gains;g++){const k=pref[g%pref.length];p.s[k]=Math.min(99,(p.s[k]||50)+1);}
    p.xp=xp%100; evolved++;
    if(p.age)p.age++; if(p.contract>0)p.contract--;
  });
  if(evolved>0) careerLog('📈 '+evolved+' joueur(s) ont progressé grâce à leurs performances','#18c860');

  // ── Primes de classement ──────────────────────────────
  const rankPrimes=[300,180,100,60,40,20,10,5];
  const rankBonus=rankPrimes[Math.min(myPos-1,rankPrimes.length-1)]||5;
  PC.budget+=rankBonus;
  careerLog('🏆 Prime classement '+myPos+'e — +'+fmtG(rankBonus),'#f0c028');

  // ── Prime sponsor en fin de saison ────────────────────
  const spons=CAREER_SPONSOR_CONTRACTS.find(s=>s.id===PC.sponsorId)||CAREER_SPONSOR_CONTRACTS[0];
  const sponsEndBonus=Math.round(spons.fee*.5); // 50% de la prime de signature en bonus annuel
  PC.budget+=sponsEndBonus;
  careerLog((spons.icon||'')+' Prime annuelle sponsor +'+fmtG(sponsEndBonus),'#f0c028');

  // ── Performances saison ───────────────────────────────
  const ss=C.seasonStats||{wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0};
  if(ss.wins>=10){ const b=200; PC.budget+=b; careerLog('🔥 Prime perf. 10+ victoires — +'+fmtG(b),'#18c860'); }
  if(ss.goalsFor>=40){ const b=150; PC.budget+=b; careerLog('⚽ Prime buteur ('+ss.goalsFor+' buts) — +'+fmtG(b),'#18c860'); }
  if(ss.goalsAgainst<20){ const b=120; PC.budget+=b; careerLog('🧱 Prime solidité défensive — +'+fmtG(b),'#18c860'); }

  // ── Vérification contrats sponsors ────────────────────
  const myDiv=PC.div; const myStandings=getCareerStandings(myDiv);
  const myPosNew=(myStandings.findIndex(s=>s.id===PC.id)+1)||99;
  const isSponsorOk=(()=>{
    const sc=spons.condition;
    if(sc==='none') return true;
    if(sc==='d2top4') return myDiv<=1&&myPosNew<=4;
    if(sc==='d1') return myDiv===0;
    if(sc==='d1top3') return myDiv===0&&myPosNew<=3;
    return false;
  })();
  if(!isSponsorOk&&spons.id!=='local'){
    PC.sponsorId='local';
    careerLog('⚠️ Conditions sponsor non remplies → retour au sponsor local','#e06060');
  }

  // ── Montée / Descente ─────────────────────────────────
  let divChange=0;
  if(myPos<=2&&PC.div>0)divChange=-1;
  else if(myPos>=n-1&&PC.div<2)divChange=1;

  const oldDiv=PC.div;
  if(divChange<0){
    PC.div=Math.max(0,PC.div-1);
    const promoBonus=PC.div===0?500:250;
    PC.budget+=promoBonus;
    careerLog('🏆 PROMOTION en '+CAREER_DIV_NAMES[PC.div]+' ! +'+fmtG(promoBonus),'#f0c028');
  } else if(divChange>0){
    PC.div=Math.min(2,PC.div+1);
    careerLog('⬇️ Relégation en '+CAREER_DIV_NAMES[PC.div],'#e06060');
  } else {
    careerLog('✅ '+myPos+'e place en '+divName,'#888');
  }

  // ── Centre de formation → jeunes ─────────────────────
  const formLvl=(PC.infra?.formation)||0;
  if(formLvl>0){
    const nbYouths=formLvl+2;
    C.youthPlayers=Array.from({length:nbYouths},()=>mkYouth(formLvl*8));
    careerLog('🌱 '+nbYouths+' jeunes disponibles au centre de formation','#f0c028');
  }

  // ── Nouveau marché ────────────────────────────────────
  C.transferMarket=[];
  C.seasonStats={wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0};
  C.season++; C.week=1;

  // Déplace le joueur dans la bonne division
  C.divClubs.forEach(div=>{ const idx=div.findIndex(c=>c.id===PC.id); if(idx>=0)div.splice(idx,1); });
  const newArr=C.divClubs[PC.div];
  while(newArr.length>=CAREER_DIV_SIZES[PC.div])newArr.pop();
  newArr.push(PC);

  // Reset stats de saison de tous les clubs
  C.divClubs.forEach(arr=>arr.forEach(c=>{c.pts=0;c.w=0;c.d=0;c.l=0;c.gf=0;c.ga=0;}));
  const ids=C.divClubs[PC.div].map(c=>c.id);
  C.leagueFixtures=mkFix(ids,2).map(f=>({...f,played:false,sh:null,sa:null}));
  C.pendingOffers=[];
  // Reset effets temporaires en fin de saison
  PC.players.forEach(p=>{
    if(p._dragon>0){p._dragon=0;if(p._dragonBoosted){p.s.sht=Math.max(20,p.s.sht-30);p.s.spd=Math.max(20,p.s.spd-20);p._dragonBoosted=false;}}
    if(p._auraDivine){const b=p._auraDivine;p.s.sht-=b;p.s.spd-=b;p.s.def-=b;p.s.tec-=b;p._auraDivine=0;p._auraDivineActive=false;}
    (p._aideDivine||[]).forEach(b=>{b.keys.forEach(k=>{p.s[k]=Math.max(1,p.s[k]-b.boost);});});
    p._aideDivine=[];
  });
  C.weeklyWage=PC.players.reduce((s,p)=>s+careerWeeklySalary(p),0);

  syncCareerToTeam(); saveCareer();
  // Générer les coupes de la nouvelle saison
  genCareerCups();
  nav('career');
}

// ── COUPES CARRIÈRE ──────────────────────────────────────────────

function genCareerCups(){
  const C=careerState; const PC=C.playerClub;
  // Coupe de Division : 8 clubs de la division du joueur
  const divClubs = [...C.divClubs[PC.div]]; // 8 clubs dont PC
  const divSeeded = shuffleArr([...divClubs]);
  C.divCup = {
    active:true, round:'QF', playerIn:true, wins:0,
    bracket: [
      {home:divSeeded[0].id,away:divSeeded[1].id,hName:divSeeded[0].name,aName:divSeeded[1].name,sh:null,sa:null,played:false},
      {home:divSeeded[2].id,away:divSeeded[3].id,hName:divSeeded[2].name,aName:divSeeded[3].name,sh:null,sa:null,played:false},
      {home:divSeeded[4].id,away:divSeeded[5].id,hName:divSeeded[4].name,aName:divSeeded[5].name,sh:null,sa:null,played:false},
      {home:divSeeded[6].id,away:divSeeded[7].id,hName:divSeeded[6].name,aName:divSeeded[7].name,sh:null,sa:null,played:false},
    ]
  };
  // Coupe Nationale : top 4 de chaque division = 12 clubs → bracket 12 (avec 4 byes au 1er tour)
  const standings0=getCareerStandings(0), standings1=getCareerStandings(1), standings2=getCareerStandings(2);
  let natPool=[];
  [standings0,standings1,standings2].forEach(st=>{ natPool=[...natPool,...st.slice(0,Math.min(4,st.length))]; });
  // Compléter avec des clubs de D2 si pas assez
  while(natPool.length<12){ const extra=C.divClubs.flat().find(cl=>!natPool.find(p=>p.id===cl.id)); if(extra)natPool.push(extra); else break; }
  // S'assurer que PC est dans le pool (peut déjà y être si top 4)
  if(!natPool.find(cl=>cl.id===PC.id)){
    // Remplacer le dernier club de sa division par PC
    const lastOfDiv=natPool.slice().reverse().find(cl=>cl.div===PC.div);
    if(lastOfDiv){ const idx=natPool.indexOf(lastOfDiv); natPool[idx]=PC; }
    else natPool.push(PC);
  }
  natPool=natPool.slice(0,12);
  const natSeeded=shuffleArr([...natPool]);
  // 12 clubs → 4 matchs au 1er tour (8 clubs), 4 clubs exemptés
  // Structure: 8 premiers jouent QF, 4 derniers ont un bye direct en SF
  // Plus simple: 12 → 1er tour éliminatoire (6 matchs), puis QF (6 survivants + bye impossible)
  // Approche retenue: bracket de 16 avec 4 clubs "null" (walkover)
  // Plus simple encore: 12 clubs → round of 12 (6 matchs) → QF (6→4 non, 6 impair)
  // Solution propre: top 4 têtes de série exemptées du 1er tour, 8 autres jouent le 1er tour → 4 qualifiés + 4 têtes = 8 en QF
  const seeds   = natSeeded.slice(0,4);   // exemptés 1er tour
  const qualifs = natSeeded.slice(4,12);  // 8 clubs jouent le 1er tour
  // Guard: si qualifs < 8 (manque de clubs), compléter avec des seeds
  const q = (i) => qualifs[i] || seeds[i-qualifs.length] || {id:'bye'+i,name:'Bye'};
  C.natCup = {
    active:true, round:'PR', playerIn:true, wins:0,
    seeds: seeds.map(cl=>cl.id),
    seedNames: seeds.map(cl=>cl.name),
    bracket: [
      {home:q(0).id,away:q(1).id,hName:q(0).name,aName:q(1).name,sh:null,sa:null,played:false},
      {home:q(2).id,away:q(3).id,hName:q(2).name,aName:q(3).name,sh:null,sa:null,played:false},
      {home:q(4).id,away:q(5).id,hName:q(4).name,aName:q(5).name,sh:null,sa:null,played:false},
      {home:q(6).id,away:q(7).id,hName:q(6).name,aName:q(7).name,sh:null,sa:null,played:false},
    ]
  };
  // Vérifier si le joueur est dans les seeds (exempt) ou dans les qualifs
  const pcInSeeds = seeds.find(cl=>cl.id===PC.id);
  if(pcInSeeds) C.natCup.playerIn=true; // présent mais exempt au 1er tour
  const pcInQualifs = qualifs.find(cl=>cl.id===PC.id);
  if(!pcInQualifs&&!pcInSeeds) C.natCup.playerIn=false;
}

function shuffleArr(arr){ for(let i=arr.length-1;i>0;i--){const j=~~(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr; }

function simCupMatch(cup,idx){
  // Simule un match IA de coupe (non-joueur)
  const C=careerState;
  const m=cup.bracket[idx]; if(!m||m.played) return;
  const findClub=id=>C.divClubs.flat().find(cl=>cl.id===id)||{id,name:'?',players:[],div:0,pts:0,w:0,d:0,l:0,gf:0,ga:0};
  const h=findClub(m.home),a=findClub(m.away);
  const res=simulateCareerFixture(h,a);
  m.sh=res[0]; m.sa=res[1]; m.played=true;
}

function getCupMatchForPlayer(cup){
  // Retourne le match du joueur dans le bracket courant (non encore joué)
  if(!cup?.active||!cup.playerIn) return null;
  const PC=careerState.playerClub;
  return cup.bracket.find(m=>!m.played&&(m.home===PC.id||m.away===PC.id))||null;
}

function advanceCupRound(cup, cupName){
  const C=careerState; const PC=C.playerClub;
  if(cup.bracket.some(m=>!m.played)) return false;
  const winners=cup.bracket.map(m=>{
    if(m.sh>m.sa) return m.home;
    if(m.sa>m.sh) return m.away;
    return Math.random()<.5?m.home:m.away;
  });
  cup.playerIn=winners.includes(PC.id)||(cup.seeds||[]).includes(PC.id);
  const findName=id=>C.divClubs.flat().find(c=>c.id===id)?.name||id;

  if(cup.round==='PR'){
    // Pré-round: 4 vainqueurs + 4 têtes de série = 8 clubs pour les QF
    const qfClubs=[...winners,...(cup.seeds||[])];
    const qfShuffled=shuffleArr([...qfClubs]);
    cup.round='QF';
    cup.bracket=[
      {home:qfShuffled[0],away:qfShuffled[1],hName:findName(qfShuffled[0]),aName:findName(qfShuffled[1]),sh:null,sa:null,played:false},
      {home:qfShuffled[2],away:qfShuffled[3],hName:findName(qfShuffled[2]),aName:findName(qfShuffled[3]),sh:null,sa:null,played:false},
      {home:qfShuffled[4],away:qfShuffled[5],hName:findName(qfShuffled[4]),aName:findName(qfShuffled[5]),sh:null,sa:null,played:false},
      {home:qfShuffled[6],away:qfShuffled[7],hName:findName(qfShuffled[6]),aName:findName(qfShuffled[7]),sh:null,sa:null,played:false},
    ];
    cup.playerIn=qfShuffled.includes(PC.id);
    careerLog('🌍 Coupe Nationale: qualification pour les Quarts!','#8840e0');
  } else if(cup.round==='QF'){
    cup.round='SF';
    cup.bracket=[
      {home:winners[0],away:winners[1],hName:findName(winners[0]),aName:findName(winners[1]),sh:null,sa:null,played:false},
      {home:winners[2],away:winners[3],hName:findName(winners[2]),aName:findName(winners[3]),sh:null,sa:null,played:false},
    ];
    careerLog('🏆 '+(cupName==='div'?'Coupe Div':'Coupe Nat')+': Demi-finales!','#f0c028');
  } else if(cup.round==='SF'){
    cup.round='F';
    cup.bracket=[
      {home:winners[0],away:winners[1],hName:findName(winners[0]),aName:findName(winners[1]),sh:null,sa:null,played:false},
    ];
    careerLog('🏆 '+(cupName==='div'?'Coupe Div':'Coupe Nat')+': Finale!','#f0c028');
  } else if(cup.round==='F'){
    cup.round='done'; cup.active=false;
    const champId=winners[0];
    const champName=C.divClubs.flat().find(cl=>cl.id===champId)?.name||champId;
    cup.champion=champName;
    if(champId===PC.id){
      cup.wins=(cup.wins||0)+1;
      const prize=cupName==='div'?500:1500;
      PC.budget+=prize;
      careerLog('🏆 CHAMPION '+(cupName==='div'?'DE DIVISION':'NATIONAL')+'! +'+fmtG(prize),'#f0c028');
    } else {
      careerLog('🏆 Champion '+(cupName==='div'?'div':'national')+': '+champName,'#888');
    }
    C.cupWins=(C.cupWins||0)+(champId===PC.id?1:0);
  }
  return true;
}

function playCupMatchCareer(cupKey){
  const C=careerState; const PC=C.playerClub;
  const cup=C[cupKey]; if(!cup) return;
  const m=getCupMatchForPlayer(cup); if(!m){ careerLog('Pas de match de coupe disponible (peut-etre un bye).','#888'); nav('career'); return; }
  if(PC.players.length<7){ showCareerConfirm('Moins de 7 joueurs pour la coupe!',()=>openCareerTab('transfer')); return; }
  // Sim les matchs IA du round en cours d'abord
  cup.bracket.forEach((bm,i)=>{
    if(!bm.played&&bm.home!==PC.id&&bm.away!==PC.id) simCupMatch(cup,i);
  });
  // Préparer le match joueur
  const isHome=m.home===PC.id;
  const oppId=isHome?m.away:m.home;
  const opp=C.divClubs.flat().find(c=>c.id===oppId)||{id:oppId,name:'Adversaire',players:mkCareerAIRoster(oppId,60)};
  G.careerCupMode=false; G.careerMode=false; G.leagueMode=false; // reset avant
  window._careerCupRef=m;
  window._careerCupKey=cupKey;
  window._careerIsHome=isHome;
  window._careerOppClub=opp;
  syncCareerToTeam();
  // Préparer teams[1]
  const bench=(opp.players||[]).slice(7,12).map(p=>({...p,onBench:true}));
  teams[1]={...opp,players:(opp.players||[]).slice(0,7),bench,reserves:(opp.players||[]).slice(12)};
  _leagueUserTeamBackup=[deepCloneTeam(teams[0]),deepCloneTeam(teams[1])];
  G.leagueMode=false; G.careerMode=false; G.careerCupMode=true;
  nav('match');
}

function recordCareerCupResult(s0,s1){
  const C=careerState; if(!C) return;
  const m=window._careerCupRef; const cupKey=window._careerCupKey;
  if(!m||!cupKey) return;
  if(m.played) return;
  const cup=C[cupKey];
  m.sh=s0; m.sa=s1; m.played=true;
  const PC=C.playerClub;
  const isHome=window._careerIsHome;
  const won=(isHome&&s0>s1)||(!isHome&&s1>s0);
  const drew=(s0===s1);
  const emoji=won?'✅':drew?'🟡':'❌';
  const cupRevenue=s0>s1?120:s0===s1?40:15; // recette match de coupe
  PC.budget+=cupRevenue;
  careerLog(emoji+' Coupe '+(cupKey==='divCup'?'Div':'Nat')+': '+s0+'-'+s1+' +'+fmtG(cupRevenue),'#8840e0');
  window._careerCupRef=null; window._careerCupKey=null; window._careerIsHome=null; window._careerOppClub=null;
  // Vérifier si le round est terminé et avancer
  if(!cup.bracket.some(bm=>!bm.played)){
    advanceCupRound(cup, cupKey==='divCup'?'div':'nat');
  }
  saveCareer(); nav('career');
}

// ── Tab coupes ────────────────────────────────────────────────────
function renderCupTab(cup, cupKey, cupLabel){
  const C=careerState; const PC=C.playerClub;
  const e=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const ROUND_LABELS={'PR':'Tour Préliminaire','QF':'Quarts de finale','SF':'Demi-finales','F':'Finale','done':'Terminée'};
  if(!cup||!cup.active&&!cup.champion){
    return `<div style="text-align:center;padding:20px;color:var(--muted);font-size:11px">Coupe non disponible cette saison.</div>`;
  }
  let h=`<div style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:900;color:var(--gold);margin-bottom:8px">${cupLabel}</div>`;
  if(cup.champion){
    h+=`<div style="background:rgba(240,192,0,.1);border:1px solid var(--gold);border-radius:8px;padding:10px;text-align:center;margin-bottom:10px">
      <div style="font-size:12px;font-weight:700;color:var(--gold)">🏆 Champion: ${e(cup.champion)}</div>
    </div>`;
  }
  h+=`<div style="font-size:9px;color:var(--muted);margin-bottom:6px;font-weight:700;letter-spacing:1px">${ROUND_LABELS[cup.round]||cup.round}</div>`;
  if(cup.round==='PR'&&(cup.seedNames||[]).length){
    h+=`<div style="background:rgba(240,192,0,.08);border:1px solid #f0c02833;border-radius:7px;padding:6px;margin-bottom:8px;font-size:9px">
      <div style="color:var(--gold);font-weight:700;margin-bottom:3px">⭐ Têtes de série (exemptées)</div>
      ${cup.seedNames.map(n=>`<div style="color:var(--muted)">${e(n)}</div>`).join('')}
    </div>`;
  }
  cup.bracket.forEach((m,i)=>{
    const isPC=m.home===PC.id||m.away===PC.id;
    const bg=isPC?'rgba(136,64,224,.1)':'var(--panel)';
    const border=isPC?'#8840e044':'var(--b1)';
    if(m.played){
      const isHome=m.home===PC.id;
      const w=(m.sh>m.sa&&isPC&&isHome)||(m.sa>m.sh&&isPC&&!isHome);
      const l=(m.sh<m.sa&&isPC&&isHome)||(m.sa<m.sh&&isPC&&!isHome);
      const scoreCol=!isPC?'var(--fg)':w?'#18c860':l?'#e06060':'var(--gold)';
      h+=`<div style="background:${bg};border:1px solid ${border};border-radius:7px;padding:7px;margin-bottom:5px;display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:10px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e(m.hName)}</span>
        <span style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:900;color:${scoreCol};margin:0 8px">${m.sh}-${m.sa}</span>
        <span style="font-size:10px;flex:1;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e(m.aName)}</span>
      </div>`;
    } else {
      const btnHtml=isPC?`<button class="btn btng" style="font-size:9px;padding:2px 8px;margin-left:8px" onclick="playCupMatchCareer('${cupKey}')">▶ Jouer</button>`:'<span style="font-size:9px;color:var(--muted);margin-left:8px">IA</span>';
      h+=`<div style="background:${bg};border:1px solid ${border};border-radius:7px;padding:7px;margin-bottom:5px;display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:10px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e(m.hName)}</span>
        <span style="font-size:9px;color:var(--muted);margin:0 6px">vs</span>
        <span style="font-size:10px;flex:1;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e(m.aName)}</span>
        ${btnHtml}
      </div>`;
    }
  });
  // Bouton avancer si tous les matchs IA sont joués et le joueur aussi
  if(cup.active&&!cup.bracket.some(m=>!m.played)){
    h+=`<button class="btn btng" style="width:100%;justify-content:center;margin-top:6px" onclick="advanceCupRound(careerState['${cupKey}'],'${cupKey==='divCup'?'div':'nat'}');saveCareer();openCareerTab('${cupKey==='divCup'?'divcup':'natcup'}')">→ Passer au tour suivant</button>`;
  }
  return h;
}

function careerLog(txt,col='var(--fg)'){
  if(!careerState) return;
  careerState.log=careerState.log||[];
  careerState.log.push({txt,col});
  if(careerState.log.length>80) careerState.log=careerState.log.slice(-80);
}

// Chargement au démarrage
loadCareer();
loadCupNPCPool();
initCareerFooterBtns();


// ── DÉMARRAGE GLOBAL ───────────────────────────────────────────────────
// Exécuté après que TOUS les scripts sont chargés (save.js est le dernier)
try {
  loadProfiles();
  if(!activeProfileId || !profiles[activeProfileId]){
    renderProfileScreen();
  } else {
    nav('setup');
  }
} catch(e){
  console.error('Erreur démarrage:', e);
}
