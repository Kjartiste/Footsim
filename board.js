// ═══════════════════════════════════════════════════════════
// BOARD.JS — Confiance du board, licenciement, offres d'emploi
//            et offres de mercato entrantes (ventes de joueurs)
// ═══════════════════════════════════════════════════════════
// S'appuie sur des champs déjà prévus dans save.js mais jusqu'ici inutilisés :
//   - careerV2.director_reputation  (0-100, init 30) → confiance du board
//   - careerV2.mercato.incoming_offers                → offres pour vos joueurs
// Tout est branché via des hooks appelés depuis ui.js (fin de saison, match,
// semaine). Aucune dépendance forte : chaque appel est protégé côté appelant.
// ═══════════════════════════════════════════════════════════

const BOARD = {
  // Seuils de confiance (0-100)
  SACK_THRESHOLD:    12,   // en dessous en fin de saison → licenciement
  WARN_THRESHOLD:    25,   // en dessous → avertissement affiché
  OFFER_THRESHOLD:   55,   // au dessus → d'autres clubs s'intéressent à vous

  label(v){
    if(v >= 80) return {txt:'Intouchable',  col:'#18c860'};
    if(v >= 60) return {txt:'Solide',       col:'#18c860'};
    if(v >= 40) return {txt:'Correcte',     col:'#f0c028'};
    if(v >= 25) return {txt:'Fragile',      col:'#e08040'};
    if(v >= 12) return {txt:'Très fragile', col:'#e06060'};
    return             {txt:'Siège éjectable', col:'#e02030'};
  },
};

// ── Lecture / écriture de la confiance ───────────────────────────────────
function _boardConf(){
  if(!careerV2) return 0;
  if(typeof careerV2.director_reputation !== 'number') careerV2.director_reputation = 30;
  return careerV2.director_reputation;
}

// Ajuste la confiance en la bornant à [0,100]. `reason` (optionnel) est
// journalisé pour que le joueur comprenne toujours POURQUOI ça bouge.
function _boardAdjust(delta, reason, color){
  if(!careerV2) return;
  const before = _boardConf();
  const after  = Math.max(0, Math.min(100, Math.round((before + delta) * 10) / 10));
  careerV2.director_reputation = after;
  if(reason && Math.abs(after - before) >= 0.5){
    const sign = delta > 0 ? '+' : '';
    try{ logEvent('🏛 Board : ' + reason + ' (' + sign + Math.round(delta) + ')',
      color || (delta > 0 ? '#18c860' : '#e06060')); }catch(e){}
  }
}

// ── Hook 1 : après chaque match du club joueur ───────────────────────────
// Petites variations pour que la jauge vive pendant la saison, sans jamais
// suffire à elle seule à faire virer (le vrai verdict tombe en fin de saison).
function _boardOnMatch(myG, aiG){
  if(!careerV2) return;
  let d = 0;
  if(myG > aiG)      d = 0.6 + Math.min(0.6, (myG - aiG) * 0.15); // victoire
  else if(myG === aiG) d = -0.1;                                   // nul
  else               d = -0.6 - Math.min(0.6, (aiG - myG) * 0.15); // défaite
  _boardAdjust(d, null); // silencieux : trop fréquent pour être journalisé
}

// ── Hook 2 : fin de saison — le vrai verdict ─────────────────────────────
// Appelé APRÈS résolution promo/relégation, avec le contexte déjà calculé
// par ui.js (on ne recalcule rien, on réutilise).
// ctx = { promoted, relegated, pos, total, cupWon, cupOut }
function _boardOnSeasonEnd(ctx){
  if(!careerV2) return;
  ctx = ctx || {};
  const pos = ctx.pos || 0, total = ctx.total || 0;
  let delta = 0;
  const bits = [];

  // ── XP de manager ───────────────────────────────────────────────────
  // Diriger plus bas rapporte moins : sinon on ferait carrière en District
  // pour décrocher la licence Pro sans jamais se confronter au niveau.
  try{
    const lvlRank = _levelRank(careerV2.club && careerV2.club.level);
    const lvlMul = Math.max(0.35, 1.4 - lvlRank * 0.16);   // D1 ×1.4 … DH ×0.44
    let xp = 20;                                            // saison terminée
    // Le label PRÉCISE la division : sans ça le palmarès affichait
    // « Promotion · Champion · Promotion · Promotion… », illisible.
    const lvlName = _divShortName(careerV2.club && careerV2.club.level);
    if(ctx.promoted)      { xp += 90; _mgrAchieve('promo_' + (careerV2.club&&careerV2.club.level), '⬆️ Promu de ' + lvlName); }
    if(pos === 1)         { xp += 70; _mgrAchieve('title_' + (careerV2.club&&careerV2.club.level), '🏆 Champion ' + lvlName); }
    else if(total && pos && pos <= Math.ceil(total*0.25)) xp += 35;
    if(ctx.cupWon)        { xp += 80; _mgrAchieve('cup_S' + (careerV2.season||1), '🏆 Coupe S' + (careerV2.season||1)); }
    if(ctx.relegated)     xp -= 30;
    managerAddXp(Math.round(xp * lvlMul), 'saison ' + (careerV2.season||1));
  }catch(e){ console.error('manager xp:', e); }

  if(ctx.promoted){        delta += 20; bits.push('promotion'); }
  else if(ctx.relegated){  delta -= 22; bits.push('relégation'); }
  else if(pos === 1){      delta += 14; bits.push('titre'); }
  else if(total && pos && pos <= Math.max(2, Math.ceil(total * 0.25))){
    delta += 8;  bits.push('haut de tableau');
  } else if(total && pos && pos >= total - 1){
    delta -= 10; bits.push('lutte pour le maintien');
  } else if(total && pos && pos > Math.ceil(total * 0.6)){
    delta -= 4;  bits.push('bas de tableau');
  } else {
    delta += 2;  bits.push('saison sans accroc');
  }

  if(ctx.cupWon){ delta += 10; bits.push('coupe remportée'); }

  _boardAdjust(delta, 'bilan de saison — ' + bits.join(', '),
    delta >= 0 ? '#18c860' : '#e06060');

  return _boardConf();
}

// ── Hook 3 : licenciement ────────────────────────────────────────────────
// Renvoie true si le joueur est viré (l'appelant doit alors STOPPER la
// transition de saison et laisser l'écran de licenciement s'afficher).
function _boardCheckSack(){
  if(!careerV2) return false;
  // Cohérence des rôles : un DIRIGEANT est propriétaire de son club — personne
  // ne peut le « virer », le club lui appartient. Seul un ENTRAÎNEUR (manager
  // salarié) peut être licencié. Pour le dirigeant, une confiance au plus bas
  // se traduit par une pression/avertissement, pas un renvoi.
  const isManager = (typeof _isManager === 'function') ? _isManager() : !!careerV2._nomad;
  const conf = _boardConf();
  if(!isManager){
    // Dirigeant propriétaire : jamais viré. On prévient seulement.
    if(conf < BOARD.WARN_THRESHOLD){
      try{ logEvent('⚠️ La grogne monte autour du projet, mais le club vous ' +
        'appartient : à vous de redresser la barre.', '#e08040'); }catch(e){}
    }
    return false;
  }
  if(conf > BOARD.SACK_THRESHOLD){
    // Pas viré, mais on prévient si ça sent le roussi.
    if(conf < BOARD.WARN_THRESHOLD){
      try{ logEvent('⚠️ Le board vous met en garde : une nouvelle saison comme ' +
        'celle-ci et vous êtes dehors.', '#e08040'); }catch(e){}
    }
    return false;
  }
  careerV2.sacked = {
    season: careerV2.season,
    clubName: careerV2.club ? careerV2.club.name : '?',
    confidence: conf,
  };
  try{ logEvent('❌ Vous avez été licencié par la direction du ' +
    (careerV2.club?careerV2.club.name:'club') + '.', '#e02030'); }catch(e){}
  try{ saveCareerV2(); }catch(e){}
  return true;
}

// ── Écran plein "Licencié" ───────────────────────────────────────────────
function _renderSackedScreen(el){
  const C = careerV2, s = C.sacked || {};
  let h = '<div style="padding:24px;max-width:520px;margin:40px auto;text-align:center">';
  h += '<div style="font-size:52px;margin-bottom:10px">📉</div>';
  h += '<div style="font-size:22px;font-weight:900;color:#e02030;letter-spacing:2px;margin-bottom:10px">LICENCIÉ</div>';
  h += '<div style="background:var(--panel);border:1px solid #e02030;border-radius:12px;padding:18px;margin-bottom:16px">';
  h += '<div style="font-size:11px;color:var(--muted);line-height:1.7">';
  h += 'Le board du <b style="color:#fff">' + (s.clubName||'club') + '</b> a mis fin à vos fonctions ';
  h += 'à l\'issue de la saison <b style="color:#fff">' + (s.season||C.season) + '</b>.<br>';
  h += 'Confiance finale : <b style="color:#e02030">' + Math.round(s.confidence||0) + '/100</b>.';
  h += '</div></div>';

  // Bilan de carrière (s'appuie sur C.history déjà en place)
  const hist = C.history || [];
  if(hist.length){
    h += '<div style="background:var(--dark);border:1px solid var(--b1);border-radius:8px;padding:12px;margin-bottom:16px;text-align:left">';
    h += '<div style="font-size:10px;font-weight:700;color:var(--gold);margin-bottom:8px">📖 Votre carrière</div>';
    hist.slice(0, 8).forEach(function(e){
      h += '<div style="display:flex;justify-content:space-between;font-size:9px;padding:3px 0;border-bottom:1px solid var(--b1)">';
      h += '<span style="color:var(--muted)">S' + e.season + ' · ' + (e.divisionEnd||'?') + '</span>';
      h += '<span>' + (e.pos||'?') + '/' + (e.total||'?') + ' · ' + e.pts + ' pts</span>';
      h += '</div>';
    });
    h += '</div>';
  }

  h += '<button class="btn btng" onclick="_sackedRestart()" style="font-size:12px;padding:10px 20px;font-weight:900">↻ Repartir à zéro</button>';
  h += '</div>';
  el.innerHTML = h;
}

function _sackedRestart(){
  if(!confirm('Recommencer une nouvelle carrière ? L\'actuelle sera effacée.')) return;
  careerV2 = null;
  try{ localStorage.removeItem('footsim_careerV2'); }catch(e){}
  renderCareerV2Choice();
}

// ═══════════════════════════════════════════════════════════
// OFFRES D'EMPLOI D'AUTRES CLUBS
// ═══════════════════════════════════════════════════════════
// En fin de saison, si la confiance est haute, un club de la pyramide peut
// vous approcher. Accepter = changer de club en gardant carrière/historique.

// Pioche un club plausible d'un niveau donné, en évitant le club actuel.
function _boardPickClub(levelId){
  const C = careerV2, nation = C.nation || 'panthalassa';
  const cur = C.club ? C.club.name : '';
  let pool = [];
  try{
    if(nation === 'valoria' && typeof valoriaTeamsByDivision === 'function' && typeof valoriaNormalizeLevel === 'function'){
      const divId = valoriaNormalizeLevel(levelId, C.club ? C.club.region : null);
      pool = (valoriaTeamsByDivision(divId) || []).map(function(t){
        return { name:t.name, color:t.color, badge:t.badge||null, region:t.region, level:divId, divisionName:(typeof _valDivName==='function'?_valDivName(divId):divId) };
      });
    } else if(nation === 'pilier' && typeof PILIER_TEAMS !== 'undefined'){
      pool = PILIER_TEAMS.filter(function(t){ return t.level === levelId; }).map(function(t){
        return { name:t.name, color:t.color, badge:t.badge||null, region:t.region, level:t.level,
                 pilierDivId:t.division,
                 divisionName:(typeof PILIER_DIVISIONS!=='undefined' && PILIER_DIVISIONS[t.division]) ? PILIER_DIVISIONS[t.division].name : t.level };
      });
    }
  }catch(e){ console.error('board pick club pool:', e); }

  pool = pool.filter(function(t){ return t.name !== cur; });
  if(pool.length) return pool[Math.floor(Math.random() * pool.length)];

  // Repli générique : club inventé au bon niveau (nations sans annuaire).
  const pyr = (WORLDS.getPyramid(nation) || []).find(function(p){ return p.id === levelId; });
  const regions = WORLDS.getRegions(nation) || [];
  const reg = regions.length ? regions[Math.floor(Math.random()*regions.length)] : null;
  const names = ['Union','Racing','Sporting','Athletic','Olympique','Cercle','Étoile','Real'];
  const nm = names[Math.floor(Math.random()*names.length)] + ' ' + (reg ? reg.name : 'City');
  return { name:nm, color:(reg&&reg.color)||'#f0c028', badge:null,
           region:(reg&&reg.id)||(C.club&&C.club.region), level:levelId,
           divisionName: pyr ? pyr.name : levelId };
}

// Génère (peut-être) une offre d'emploi en fin de saison.
function _boardMaybeJobOffer(ctx){
  if(!careerV2) return;
  const C = careerV2;
  const conf = _boardConf();
  if(conf < BOARD.OFFER_THRESHOLD) return;

  // Probabilité croissante avec la confiance, bonus si saison marquante.
  let chance = 0.18 + (conf - BOARD.OFFER_THRESHOLD) / 100 * 0.6;
  if(ctx && ctx.promoted) chance += 0.20;
  if(ctx && ctx.cupWon)   chance += 0.15;
  if(Math.random() > Math.min(0.85, chance)) return;

  // Cible : un cran au dessus si possible, sinon même niveau.
  const nation = C.nation || 'panthalassa';
  const pyramid = WORLDS.getPyramid(nation) || [];
  const levels = pyramid.map(function(p){ return p.id; });
  let idx = levels.indexOf(C.club.level);
  if(idx < 0) idx = levels.length - 1;
  let targetIdx = (idx > 0 && Math.random() < 0.7) ? idx - 1 : idx;
  // La licence plafonne les clubs qui peuvent vous recruter : c'est ce qui
  // donne un sens à la progression. Sans elle, on passait de District à D1
  // sans que rien ne le justifie.
  while(targetIdx < levels.length && !managerCanManage(levels[targetIdx])) targetIdx++;
  if(targetIdx >= levels.length) return;
  const target = _boardPickClub(levels[targetIdx]);
  if(!target) return;

  const budget = Math.round((C.club.budget || 10000) * (1.2 + Math.random() * 1.6));
  // ── Un SEUL format d'offre ─────────────────────────────────────────────
  // Il existait deux systèmes incompatibles : `job_offer` (singulier, budget +
  // isStepUp) créé ici, et `job_offers` (pluriel, salary + objectives) lu par
  // l'UI. L'UI ne voyait donc jamais les offres du board. On écrit désormais
  // dans `job_offers`, au format que l'écran sait afficher et accepter.
  if(!Array.isArray(C.job_offers)) C.job_offers = [];
  // Une seule offre à la fois du board en cours de saison (évite le spam).
  if(C.job_offers.some(function(o){ return o._fromBoard; })) return;
  // Certaines offres (surtout de clubs plus huppés) concernent leur ÉQUIPE
  // RÉSERVE : un tremplin où l'on n'entraîne que la réserve. Plus fréquent
  // quand on vise un club d'un niveau supérieur.
  const isReserveOffer = (targetIdx < idx) && Math.random() < 0.35;
  C.job_offers.push({
    club: target.name + (isReserveOffer ? ' (Réserve)' : ''),
    region: target.region || C.club.region,
    level: levels[targetIdx],
    color: target.color || '#888',
    badge: target.badge || null,
    salary: Math.round(budget * 0.002 * (isReserveOffer ? 0.6 : 1)),
    contract_years: 2,
    budget: budget,
    teamScope: isReserveOffer ? 'reserve' : 'first',
    objectives: [ isReserveOffer
      ? { type:'youth', target:2, desc:'Faire éclore les jeunes de la réserve' }
      : { type: (targetIdx < idx ? 'top_half' : 'mid_table'),
          desc: (targetIdx < idx ? 'Jouer le haut de tableau' : 'Stabiliser le club') } ],
    isStepUp: targetIdx < idx,
    season: C.season,
    _fromBoard: true,
  });
  try{ logEvent('📨 ' + target.name + (isReserveOffer?' (Réserve)':'') + ' vous propose de prendre les rênes !', '#9c27b0'); }catch(e){}
}

// Carte d'offre d'emploi (affichée en haut de la Vue).
// Lit désormais `job_offers` (pluriel) — la liste unifiée — au lieu de
// `job_offer` (singulier) que plus rien ne remplit.
function _renderJobOfferCard(){
  const C = careerV2;
  const offers = (C.job_offers || []).filter(function(o){ return o._fromBoard; });
  if(!offers.length) return '';
  let h = '';
  offers.forEach(function(o){
    const idx = C.job_offers.indexOf(o);
    h += '<div class="ccard ccard-purple">';
    h += '<div style="font-size:10px;font-weight:700;color:#9c27b0;margin-bottom:6px">📨 Offre d\'un autre club</div>';
    h += '<div style="font-size:11px;line-height:1.6;margin-bottom:8px">';
    h += '<b style="color:' + (o.color||'#fff') + '">' + (o.badge?o.badge+' ':'') + o.club + '</b> ';
    h += '(' + (o.level||'').toUpperCase() + ') souhaite vous nommer directeur.';
    if(o.isStepUp) h += ' <span style="color:#18c860">C\'est un échelon au dessus.</span>';
    h += '<br><span style="color:var(--muted)">Budget proposé : </span><b style="color:#18c860">' + _fmtMoney(o.budget||0) + '</b>';
    h += '</div>';
    h += '<div style="display:flex;gap:6px">';
    h += '<button class="btn btng" onclick="acceptBoardJobOffer(' + idx + ')" style="flex:1;font-size:9px;padding:5px">✅ Accepter</button>';
    h += '<button class="btn" onclick="declineBoardJobOffer(' + idx + ')" style="flex:1;font-size:9px;padding:5px">✕ Refuser</button>';
    h += '</div></div>';
  });
  return h;
}

// Accepter une offre du board depuis le mode director : on réutilise la
// bascule complète (nouveau club, effectif, budget) déjà écrite plus bas.
function acceptBoardJobOffer(idx){
  const C = careerV2;
  if(!C || !Array.isArray(C.job_offers)) return;
  const o = C.job_offers[idx];
  if(!o) return;
  // On reconstruit un objet au format attendu par acceptJobOffer.
  C.job_offer = {
    club: { name:o.club, color:o.color, badge:o.badge, region:o.region, level:o.level,
            divisionName:(o.level||'').toUpperCase() },
    budget: o.budget, isStepUp: o.isStepUp, season: o.season,
  };
  C.job_offers.splice(idx, 1);
  acceptJobOffer();
}
function declineBoardJobOffer(idx){
  const C = careerV2;
  if(!C || !Array.isArray(C.job_offers)) return;
  C.job_offers.splice(idx, 1);
  try{ logEvent('Vous déclinez l\'offre.', '#888'); }catch(e){}
  saveCareerV2();
  try{ renderCareerV2(); }catch(e){}
}

function acceptJobOffer(){
  if(!careerV2 || !careerV2.job_offer) return;
  const C = careerV2, o = C.job_offer, t = o.club;
  if(!confirm('Rejoindre ' + t.name + ' ? Vous quittez ' + C.club.name + ' (effectif non conservé).')) return;

  const oldName = C.club.name;

  // Nouveau club : on conserve l'identité de carrière (historique, confiance)
  // mais on repart avec la structure du club d'accueil.
  C.club.name = t.name;
  C.club.color = t.color || C.club.color;
  C.club.badge = t.badge || null;
  C.club.region = t.region || C.club.region;
  C.club.level = t.level;
  C.club.divisionName = t.divisionName || null;
  C.club.pilierDivId = t.pilierDivId || null;
  C.club.budget = o.budget;
  C.club.transferBudget = Math.round(o.budget * 0.40);
  C.club.wage_budget = Math.round(o.budget * 0.45);
  try{ C.club.reputation = Math.min(100, (C.club.reputation||30) + 10); }catch(e){}
  try{
    if(typeof TRAINING !== 'undefined'){
      C.club.status = TRAINING.clubStatus({ level:t.level, nation:C.nation });
    }
  }catch(e){}

  // Nouvel effectif au niveau du club d'accueil.
  try{
    const mk = function(n){
      const base = ['GB','DC','DC','DD','DG','MDC','MC','MC','MOG','MOD','ATT'];
      const extra = ['DC','MC','ATT','DD','DG','GB','MDC','MOG','ATT','MC'];
      const out = base.slice();
      for(let i=0; out.length<n; i++) out.push(extra[i%extra.length]);
      return out.slice(0, n);
    };
    const sq = WORLDS.generateSquad(C.nation, C.club.region, {
      positions: mk(11), bench: mk(7), reserves: mk(5), level: t.level,
    });
    if(sq){ C.players = sq.players||[]; C.bench = sq.bench||[]; C.reserves = sq.reserves||[]; }
  }catch(e){ console.error('job offer squad:', e); }

  C.job_offer = null;
  C.mercato.incoming_offers = [];
  _boardAdjust(-_boardConf() + 45, null); // repart sur une confiance neutre-haute
  try{ C.club.board_objectives = _generateBoardObjectives(C.club); }catch(e){}
  try{ if(typeof SPONSORS !== 'undefined') SPONSORS.ensure(C.club); }catch(e){}

  logEvent('🤝 Vous quittez ' + oldName + ' pour ' + t.name + ' !', t.color || '#9c27b0');
  _startNewSeasonAfterMove();
}

function declineJobOffer(){
  if(!careerV2 || !careerV2.job_offer) return;
  const o = careerV2.job_offer;
  careerV2.job_offer = null;
  _boardAdjust(4, 'fidélité récompensée — vous avez décliné ' + o.club.name, '#18c860');
  saveCareerV2();
  renderCareerV2();
}

// Régénère le contexte de saison après un changement de club.
function _startNewSeasonAfterMove(){
  const C = careerV2;
  C.standings = [];
  C.fixtures = [];
  C.cup = null;
  C.seasonStartDate = null;
  C.dayPlans = {};
  C.season_stats = {wins:0, draws:0, losses:0, goals_for:0, goals_against:0, points:0, scorers:{}};
  try{ _generateSeasonFixtures(); }catch(e){ console.error(e); }
  try{ _generateFreeAgents(); }catch(e){}
  try{ _generateYouthIntake(); }catch(e){}
  try{ C.club.weekly_costs = _weeklyCareerCosts(); }catch(e){}
  saveCareerV2();
  renderCareerV2();
}

// ═══════════════════════════════════════════════════════════
// OFFRES DE MERCATO ENTRANTES (on veut acheter vos joueurs)
// ═══════════════════════════════════════════════════════════

// ── Valeur d'un joueur ───────────────────────────────────────────────────
// Ne dépendait que de l'overall et de l'âge : deux joueurs du même effectif
// avec le même ovr valaient exactement pareil, alors qu'un gardien, un
// attaquant, un porteur de sort légendaire et un joueur sans trait n'ont rien
// de comparable. On pondère désormais par tout ce qui fait réellement la
// valeur d'un joueur dans CE jeu.

// Postes : rareté et impact. Un buteur coûte cher, un gardien est un poste
// clé mais un marché étroit, un latéral se remplace plus facilement.
const _POS_VALUE = {
  ATT:1.35, MO:1.20, MOG:1.15, MOD:1.15, MC:1.10, MDC:1.05,
  GB:1.00, GK:1.00, DC:0.95, DD:0.88, DG:0.88,
};

// Valeur ajoutée par les sorts : on somme la RARETÉ (1/prob), pas le nombre.
// Un sort à prob .01 est 7× plus rare qu'un sort à .07 — et vaut donc bien
// plus qu'un sort commun.
function _spellsValueMul(p){
  const ids = p.spells || [];
  if(!ids.length || typeof SPELLS === 'undefined') return 1;
  let score = 0;
  ids.forEach(function(sid){
    const sp = SPELLS.find(function(x){ return x.id === sid; });
    if(!sp) return;
    const prob = sp.prob || 0.07;
    score += Math.min(6, 0.07 / Math.max(0.005, prob)); // 1 = commun, ~6 = légendaire
  });
  return 1 + Math.min(1.6, score * 0.16);   // plafonné : +160% max
}

// Traits : chacun apporte un vrai comportement, mais rendement décroissant.
function _traitsValueMul(p){
  const n = Array.isArray(p.traits) ? p.traits.length : 0;
  return 1 + Math.min(0.30, n * 0.09);
}

function _boardPlayerValue(p){
  const ovr = (typeof _pOvr === 'function') ? _pOvr(p) : 50;
  const age = p.age || 24;
  // Base exponentielle sur l'overall : un 80 vaut beaucoup plus qu'un 60.
  let v = Math.pow(Math.max(1, ovr), 2.6) * 0.9;
  // Modulateur d'âge : un jeune coûte plus cher, un vétéran décote.
  if(age <= 21)      v *= 1.5;
  else if(age <= 25) v *= 1.25;
  else if(age <= 29) v *= 1.0;
  else if(age <= 32) v *= 0.6;
  else               v *= 0.3;
  // Potentiel : progressif plutôt qu'un palier brutal à +15.
  if(p._potential && p._potential > ovr){
    v *= 1 + Math.min(0.55, (p._potential - ovr) * 0.022);
  }
  v *= _POS_VALUE[p.pos] || 1.0;
  v *= _spellsValueMul(p);
  v *= _traitsValueMul(p);
  return Math.max(200, Math.round(v / 100) * 100);
}

// Génère les offres entrantes de la semaine.
function _boardGenerateOffers(){
  if(!careerV2) return;
  const C = careerV2;
  if(!C.mercato) C.mercato = {};
  if(!Array.isArray(C.mercato.incoming_offers)) C.mercato.incoming_offers = [];

  // Uniquement fenêtre ouverte (pro/semi-pro) — les amateurs n'ont pas de marché.
  const level = C.club.level;
  const isPro = ['d1','d2','d3'].includes(level);
  const isSemiPro = ['r1','r2'].includes(level);
  if(!isPro && !isSemiPro) return;
  if(!C.mercato.window_open) return;
  if(C.mercato.incoming_offers.length >= 3) return;

  const squad = (C.players || []).concat(C.bench || []);
  if(squad.length <= 12) return; // pas d'offre si l'effectif est déjà limite

  if(Math.random() > 0.45) return;

  // Cible : plutôt les meilleurs joueurs, mais pas systématiquement.
  const sorted = squad.slice().sort(function(a, b){ return _pOvr(b) - _pOvr(a); });
  const pickIdx = Math.floor(Math.pow(Math.random(), 1.8) * Math.min(8, sorted.length));
  const target = sorted[pickIdx];
  if(!target) return;
  // Pas deux offres simultanées sur le même joueur.
  if(C.mercato.incoming_offers.some(function(o){ return o.playerName === target.name; })) return;

  const pyramid = WORLDS.getPyramid(C.nation || 'panthalassa') || [];
  const levels = pyramid.map(function(p){ return p.id; });
  let idx = levels.indexOf(level);
  if(idx < 0) idx = levels.length - 1;
  // L'acheteur vient du même niveau ou d'un cran au dessus.
  const buyerIdx = (idx > 0 && Math.random() < 0.55) ? idx - 1 : idx;
  const buyer = _boardPickClub(levels[buyerIdx]);
  if(!buyer) return;

  const base = _boardPlayerValue(target);
  // Un club d'un cran au dessus paie plus cher.
  const mult = (buyerIdx < idx ? 1.3 : 1.0) * (0.75 + Math.random() * 0.7);
  // Même plafond qu'à l'achat (division de l'ACHETEUR, qui fixe ce qu'il peut
  // mettre) : sans ça on pourrait vendre un joueur de R1 des millions, et
  // l'asymétrie achat/vente deviendrait une machine à argent.
  const capL = (typeof _divPriceCap==='function') ? _divPriceCap(levels[buyerIdx]) : Infinity;
  const fee = Math.min(capL, Math.max(200, Math.round(base * mult / 100) * 100));

  C.mercato.incoming_offers.push({
    id: 'off_' + Math.random().toString(36).slice(2, 8),
    playerName: target.name,
    playerPos: target.pos,
    playerOvr: _pOvr(target),
    playerAge: target.age || null,
    buyerName: buyer.name,
    buyerColor: buyer.color || '#f0c028',
    buyerBadge: buyer.badge || null,
    buyerLevel: buyer.divisionName || buyer.level,
    fee: fee,
    value: base,
    expiresWeek: C.week + 2,
  });
  logEvent('📩 ' + buyer.name + ' offre ' + _fmtMoney(fee) + ' pour ' + target.name + ' !', buyer.color || '#00bcd4');
}

// Purge les offres expirées (appelé chaque semaine).
function _boardExpireOffers(){
  if(!careerV2 || !careerV2.mercato) return;
  const C = careerV2;
  const keep = [];
  (C.mercato.incoming_offers || []).forEach(function(o){
    if(C.week > o.expiresWeek){
      logEvent('⌛ ' + o.buyerName + ' retire son offre pour ' + o.playerName + '.', '#888');
    } else keep.push(o);
  });
  C.mercato.incoming_offers = keep;
  // Le marché des transferts respire au même rythme : les annonces périmées
  // disparaissent, et si le marché se vide il se repeuple.
  try{ _pruneTransferList(); }catch(e){}
}

function _boardFindOffer(id){
  return ((careerV2.mercato || {}).incoming_offers || []).find(function(o){ return o.id === id; });
}

function acceptTransferOffer(id){
  if(!careerV2) return;
  const C = careerV2, o = _boardFindOffer(id);
  if(!o) return;
  if(!confirm('Vendre ' + o.playerName + ' à ' + o.buyerName + ' pour ' + _fmtMoney(o.fee) + ' ?')) return;

  // Retirer le joueur de l'effectif (titulaires ou banc).
  let removed = false;
  ['players', 'bench'].forEach(function(key){
    if(removed) return;
    const i = (C[key] || []).findIndex(function(p){ return p.name === o.playerName; });
    if(i >= 0){ C[key].splice(i, 1); removed = true; }
  });
  if(!removed){
    logEvent('Joueur introuvable — offre annulée.', '#e02030');
    C.mercato.incoming_offers = C.mercato.incoming_offers.filter(function(x){ return x.id !== id; });
    saveCareerV2(); renderCareerDirectorTab('mercato');
    return;
  }

  C.club.budget += o.fee;
  C.club.transferBudget = (C.club.transferBudget || 0) + Math.round(o.fee * 0.5);
  try{ _addFinanceLog('Vente de ' + o.playerName + ' à ' + o.buyerName, o.fee); }catch(e){}
  // Vendre bien = bon point ; brader une pépite = le board grince.
  const ratio = o.fee / Math.max(1, o.value);
  if(ratio >= 1.15)     _boardAdjust(2,  'belle vente : ' + o.playerName, '#18c860');
  else if(ratio < 0.8)  _boardAdjust(-2, o.playerName + ' bradé', '#e06060');

  C.mercato.incoming_offers = C.mercato.incoming_offers.filter(function(x){ return x.id !== id; });
  logEvent('💰 ' + o.playerName + ' rejoint ' + o.buyerName + ' pour ' + _fmtMoney(o.fee) + '.', '#18c860');
  saveCareerV2();
  renderCareerDirectorTab('mercato');
}

function rejectTransferOffer(id){
  if(!careerV2) return;
  const C = careerV2, o = _boardFindOffer(id);
  if(!o) return;
  C.mercato.incoming_offers = C.mercato.incoming_offers.filter(function(x){ return x.id !== id; });
  logEvent('🚫 Offre de ' + o.buyerName + ' pour ' + o.playerName + ' refusée.', '#888');
  saveCareerV2();
  renderCareerDirectorTab('mercato');
}

// Négocier : demander plus. Le club peut accepter, réduire, ou se retirer.
function negotiateTransferOffer(id){
  if(!careerV2) return;
  const C = careerV2, o = _boardFindOffer(id);
  if(!o) return;
  const ask = Math.round(o.fee * 1.3 / 100) * 100;
  if(!confirm('Demander ' + _fmtMoney(ask) + ' à ' + o.buyerName + ' ?\n\nRisque : le club peut se retirer.')) return;

  const r = Math.random();
  if(r < 0.35){
    o.fee = ask;
    o.negotiated = true;
    logEvent('🤝 ' + o.buyerName + ' accepte de monter à ' + _fmtMoney(ask) + ' !', '#18c860');
  } else if(r < 0.75){
    const mid = Math.round((o.fee + ask) / 2 / 100) * 100;
    o.fee = mid;
    o.negotiated = true;
    logEvent('💬 ' + o.buyerName + ' propose un compromis : ' + _fmtMoney(mid) + '.', '#f0c028');
  } else {
    C.mercato.incoming_offers = C.mercato.incoming_offers.filter(function(x){ return x.id !== id; });
    logEvent('❌ ' + o.buyerName + ' se retire des négociations pour ' + o.playerName + '.', '#e06060');
  }
  saveCareerV2();
  renderCareerDirectorTab('mercato');
}

// Carte des offres entrantes (haut de l'onglet Mercato).
function _renderIncomingOffersCard(){
  const C = careerV2;
  const offers = (C.mercato || {}).incoming_offers || [];
  let h = '<div style="background:var(--dark);border:1px solid ' + (offers.length ? '#00bcd4' : 'var(--b1)') + ';border-radius:8px;padding:10px;margin-bottom:8px">';
  h += '<div style="font-size:10px;font-weight:700;color:' + (offers.length ? '#00bcd4' : 'var(--gold)') + ';margin-bottom:6px">📩 Offres reçues pour vos joueurs' + (offers.length ? ' (' + offers.length + ')' : '') + '</div>';

  if(!offers.length){
    const open = C.mercato && C.mercato.window_open;
    h += '<div style="font-size:9px;color:var(--muted)">' +
      (open ? 'Aucune offre en ce moment. Les clubs suivent vos meilleurs éléments…'
            : 'Le marché est fermé. Les offres arrivent pendant le mercato (été / hiver).') + '</div>';
    h += '</div>';
    return h;
  }

  offers.forEach(function(o){
    const ratio = o.fee / Math.max(1, o.value);
    const verdict = ratio >= 1.15 ? {t:'Offre généreuse', c:'#18c860'}
                  : ratio >= 0.85 ? {t:'Offre correcte',  c:'#f0c028'}
                                  : {t:'Offre basse',     c:'#e06060'};
    h += '<div style="border:1px solid var(--b1);border-radius:6px;padding:8px;margin-bottom:6px">';
    h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
    h += '<div style="width:24px;font-size:8px;color:var(--muted)">' + (o.playerPos||'?') + '</div>';
    h += '<div style="flex:1"><div style="font-size:10px;font-weight:700">' + o.playerName + '</div>';
    h += '<div style="font-size:8px;color:var(--muted)">' + (o.playerAge?o.playerAge+' ans · ':'') + 'Valeur estimée ' + _fmtMoney(o.value) + '</div></div>';
    h += '<div style="font-size:11px;font-weight:900;color:#f0c028;width:24px;text-align:center">' + o.playerOvr + '</div>';
    h += '</div>';
    h += '<div style="font-size:9px;color:var(--muted);margin-bottom:6px">';
    h += (o.buyerBadge?o.buyerBadge+' ':'') + '<b style="color:' + o.buyerColor + '">' + o.buyerName + '</b> (' + o.buyerLevel + ') offre ';
    h += '<b style="color:#18c860;font-size:11px">' + _fmtMoney(o.fee) + '</b> · <span style="color:' + verdict.c + '">' + verdict.t + '</span>';
    h += ' · <span style="color:#888">expire semaine ' + o.expiresWeek + '</span>';
    h += '</div>';
    h += '<div style="display:flex;gap:4px">';
    h += '<button class="btn btng" onclick="acceptTransferOffer(\'' + o.id + '\')" style="flex:1;font-size:8px;padding:3px">✅ Vendre</button>';
    h += '<button class="btn" onclick="negotiateTransferOffer(\'' + o.id + '\')" style="flex:1;font-size:8px;padding:3px' + (o.negotiated?';opacity:.4;pointer-events:none':'') + '">💬 Négocier</button>';
    h += '<button class="btn" onclick="rejectTransferOffer(\'' + o.id + '\')" style="font-size:8px;padding:3px 6px;color:#e06060;border-color:#e06060">✕</button>';
    h += '</div></div>';
  });
  h += '</div>';
  return h;
}

// ── Carte "Confiance du board" (haut de la Vue) ──────────────────────────
function _renderBoardCard(){
  const C = careerV2;
  const conf = _boardConf();
  const lab = BOARD.label(conf);
  const isManager = (typeof _isManager === 'function') ? _isManager() : !!(C && C._nomad);
  // Pour un ENTRAÎNEUR salarié, la sellette existe (il peut être viré). Pour un
  // DIRIGEANT propriétaire, non : c'est la confiance dans son PROJET (supporters,
  // partenaires) qui est en jeu, sans licenciement possible.
  const danger = isManager && conf < BOARD.WARN_THRESHOLD;

  const titleTxt = isManager ? '🏛 Confiance du board' : '📊 Confiance dans votre projet';

  let h = '<div style="background:var(--dark);border:1px solid ' + (danger ? '#e02030' : 'var(--b1)') + ';border-radius:8px;padding:10px;margin-bottom:10px">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">';
  h += '<div style="font-size:10px;font-weight:700;color:var(--gold)">' + titleTxt + '</div>';
  h += '<div style="font-size:10px;font-weight:900;color:' + lab.col + '">' + lab.txt + ' · ' + Math.round(conf) + '/100</div>';
  h += '</div>';
  // Jauge
  h += '<div style="height:8px;background:var(--panel);border-radius:4px;overflow:hidden;position:relative">';
  h += '<div style="height:100%;width:' + Math.max(2, conf) + '%;background:' + lab.col + ';transition:width .3s"></div>';
  // Repère du seuil de licenciement (uniquement pour un entraîneur).
  if(isManager){
    h += '<div style="position:absolute;left:' + BOARD.SACK_THRESHOLD + '%;top:0;bottom:0;width:1px;background:#e02030"></div>';
  }
  h += '</div>';
  if(danger){
    h += '<div style="font-size:9px;color:#e02030;margin-top:6px;line-height:1.5">⚠️ <b>Vous êtes sur la sellette.</b> Sous ' + BOARD.SACK_THRESHOLD + '/100 en fin de saison, la direction vous licenciera.</div>';
  } else if(!isManager && conf < BOARD.WARN_THRESHOLD){
    h += '<div style="font-size:9px;color:#e08040;margin-top:6px;line-height:1.5">⚠️ La confiance dans votre projet est au plus bas. Le club vous appartient — personne ne vous démettra, mais il faut redresser la barre.</div>';
  } else {
    h += '<div style="font-size:8px;color:var(--muted);margin-top:5px">Évolue avec vos résultats. Bilan complet en fin de saison.</div>';
  }

  // ── Objectifs de la saison + progression en direct ─────────────────────
  // On affiche TOUS les objectifs (principal + secondaire), pas seulement le
  // premier : le secondaire était généré et évalué mais jamais montré.
  const objs = (C.club.board_objectives || []);
  if(objs.length){
    const st = (C.standings || []).slice().sort(function(a, b){
      return b.Pts - a.Pts || (b.GF - b.GA) - (a.GF - a.GA);
    });
    const pos = st.findIndex(function(s){ return s.isPlayer; }) + 1;
    const total = st.length;
    h += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--b1)">';
    objs.forEach(function(obj, i){
      // Projection : tenu si la saison s'arrêtait maintenant ?
      let onTrack = null;
      if(pos && total){
        onTrack = _boardObjectiveMet(obj, { rank:pos, total:total, promoted:(pos<=2), relegated:(pos>=total-1) });
      }
      const tag = obj._secondary ? '<span style="font-size:7px;color:var(--muted)">2ndaire</span> ' : '';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px' + (i>0?';margin-top:4px':'') + '">';
      h += '<span style="font-size:9px;color:var(--muted)">' + (i===0?'🎯 ':'➕ ') + tag + '<b style="color:var(--fg)">' + obj.desc + '</b></span>';
      if(onTrack !== null){
        h += '<span style="font-size:8px;font-weight:700;color:' + (onTrack ? '#18c860' : '#e08040') + ';white-space:nowrap">' +
          (onTrack ? '✓ en bonne voie' : '✗ hors trajectoire') + '</span>';
      }
      h += '</div>';
      if(obj.reward){
        h += '<div style="font-size:8px;color:var(--muted);margin-top:2px">Prime : <b style="color:#18c860">' + _fmtMoney(obj.reward) + '</b></div>';
      }
    });
    h += '</div>';
  }

  // Résultats de la saison précédente (principal + secondaire).
  const lastList = (C._lastObjectives && C._lastObjectives.length) ? C._lastObjectives : (C._lastObjective ? [C._lastObjective] : []);
  if(lastList.length){
    h += '<div style="margin-top:6px">';
    lastList.forEach(function(lo){
      h += '<div style="font-size:8px;color:' + (lo.met ? '#18c860' : '#e06060') + '">';
      h += (lo.met ? '✓ Saison passée : « ' + lo.desc +' » tenu' + (lo.reward ? ' (+' + _fmtMoney(lo.reward) + ')' : '')
                   : '✗ Saison passée : « ' + lo.desc + ' » manqué');
      h += '</div>';
    });
    h += '</div>';
  }
  h += '</div>';
  return h;
}

// ═══════════════════════════════════════════════════════════
// PRIZES.JS — Dotations : coupes, primes de classement, subventions
// ═══════════════════════════════════════════════════════════
// Objectif : que l'argent gagné ait un sens au niveau du club. Toutes les
// dotations sont indexées sur LEVEL_COSTS[level].weeklyBase, qui est l'échelle
// économique réelle du jeu (District 55/sem → D1 25000/sem). Une prime
// exprimée en "semaines de fonctionnement" reste ainsi lisible et équilibrée à
// tous les étages de la pyramide, sans table de montants en dur à maintenir.
// ═══════════════════════════════════════════════════════════

const PRIZES = {
  // Bases de calcul, en multiples du budget hebdomadaire de fonctionnement.
  CUP_ROUND_WEEKS:   0.8,   // par tour de coupe nationale franchi
  CUP_WIN_WEEKS:     12,    // vainqueur de la coupe nationale
  CUP_FINAL_WEEKS:   5,     // finaliste malheureux
  LEAGUECUP_WIN_WEEKS: 5,   // vainqueur de la coupe de ligue
  LEAGUECUP_ROUND_WEEKS: 0.4,
  HOUSECUP_WIN_WEEKS: 2.5,  // coupe de Maison (Pilier) — compétition interne

  // Prime de classement (pro uniquement), en multiples du weeklyBase.
  // Barème dégressif : le champion touche gros, le dernier touche peu.
  RANK_TOP_WEEKS:    20,    // 1er
  RANK_LAST_WEEKS:   3,     // dernier
};

// Un club est-il professionnel ? Gère les niveaux moteur (d1/d2/d3) ET les
// ids de division Valoria (tier 'pro'), sinon un club de Ligue Valorienne
// serait traité comme un amateur et toucherait une subvention.
function _prizeIsPro(level){
  if(['d1','d2','d3'].includes(level)) return true;
  try{
    const VD = (typeof VALORIA_DIVISIONS !== 'undefined') ? VALORIA_DIVISIONS
             : (typeof window !== 'undefined' ? window.VALORIA_DIVISIONS : null);
    if(VD && VD[level] && VD[level].tier === 'pro') return true;
  }catch(e){}
  return false;
}

// Échelle économique d'un niveau. Repli prudent si le niveau est inconnu
// (nations custom, ids Valoria/Pilier non listés dans LEVEL_COSTS).
function _prizeBase(level){
  let c = null;
  try{ c = (typeof LEVEL_COSTS !== 'undefined') ? LEVEL_COSTS[level] : null; }catch(e){}

  // Valoria : club.level porte un id de division maison (pro, valcourt_r2,
  // brumefer_district3…) absent de LEVEL_COSTS. On le traduit vers le niveau
  // moteur équivalent via son tier/order, sinon tout Valoria serait payé au
  // tarif District.
  if(!c){
    try{
      const VD = (typeof VALORIA_DIVISIONS !== 'undefined') ? VALORIA_DIVISIONS
               : (typeof window !== 'undefined' ? window.VALORIA_DIVISIONS : null);
      const d = VD && VD[level];
      if(d){
        let mapped = 'dh';
        if(d.tier === 'pro')            mapped = 'd1';
        else if(d.tier === 'regional')  mapped = (d.order === 1) ? 'r1' : (d.order === 2) ? 'r2' : 'r3';
        else if(d.tier === 'district')  mapped = 'dh_' + Math.min(4, Math.max(1, (d.order || 4) - 3));
        c = (typeof LEVEL_COSTS !== 'undefined') ? LEVEL_COSTS[mapped] : null;
      }
    }catch(e){}
  }

  if(!c){
    // Repli : deviner par la position dans la pyramide de la nation.
    try{
      const nation = (careerV2 && careerV2.nation) || 'panthalassa';
      const pyr = WORLDS.getPyramid(nation) || [];
      const idx = pyr.findIndex(function(p){ return p.id === level; });
      if(idx >= 0){
        // Du bas (55) vers le haut (25000), progression géométrique.
        const depth = pyr.length - 1 - idx; // 0 = plus bas
        return Math.round(55 * Math.pow(2.6, depth));
      }
    }catch(e){}
    c = (typeof LEVEL_COSTS !== 'undefined') ? LEVEL_COSTS['dh'] : { weeklyBase: 55 };
  }
  return c.weeklyBase || 55;
}

// Arrondi "monnaie de jeu" : lisible, jamais 4 337.
function _prizeRound(n){
  if(n >= 10000) return Math.round(n / 1000) * 1000;
  if(n >= 1000)  return Math.round(n / 100) * 100;
  if(n >= 100)   return Math.round(n / 10) * 10;
  return Math.max(5, Math.round(n));
}

// Verse une dotation : budget + journal financier + log. Point d'entrée unique
// pour que TOUTE dotation apparaisse dans l'onglet Finances (ce n'était pas le
// cas des primes de coupe historiques, créditées en silence).
function _prizePay(amount, label, color){
  if(!careerV2 || !careerV2.club || !amount) return 0;
  const n = _prizeRound(amount);
  careerV2.club.budget += n;
  try{ _addFinanceLog(label, n); }catch(e){}
  try{ logEvent('💰 ' + label + ' : +' + _fmtMoney(n), color || '#18c860'); }catch(e){}
  return n;
}

// ── Coupes : montant d'un tour / d'un titre ──────────────────────────────
function _prizeCupRound(roundIdx, totalRounds, kind){
  const base = _prizeBase(careerV2 && careerV2.club ? careerV2.club.level : 'dh');
  const perRound = (kind === 'league') ? PRIZES.LEAGUECUP_ROUND_WEEKS : PRIZES.CUP_ROUND_WEEKS;
  // Les tours avancés rapportent davantage (progression linéaire douce).
  const growth = 1 + (roundIdx * 0.6);
  return _prizeRound(base * perRound * growth);
}

function _prizeCupTitle(kind){
  const base = _prizeBase(careerV2 && careerV2.club ? careerV2.club.level : 'dh');
  const w = kind === 'league' ? PRIZES.LEAGUECUP_WIN_WEEKS
          : kind === 'house'  ? PRIZES.HOUSECUP_WIN_WEEKS
          : PRIZES.CUP_WIN_WEEKS;
  return _prizeRound(base * w);
}

// ── Prime de classement de fin de saison (clubs pro) ─────────────────────
// Barème dégressif linéaire entre le 1er et le dernier. Les droits TV/la
// dotation de ligue n'existent qu'au niveau professionnel : en amateur, c'est
// la subvention (ci-dessous) qui prend le relais.
function _prizeSeasonRank(pos, total){
  if(!careerV2 || !careerV2.club) return 0;
  const level = careerV2.club.level;
  if(!_prizeIsPro(level) || !pos || !total || total < 2) return 0;

  const base = _prizeBase(level);
  const t = (total - pos) / (total - 1); // 1 = premier, 0 = dernier
  const weeks = PRIZES.RANK_LAST_WEEKS + (PRIZES.RANK_TOP_WEEKS - PRIZES.RANK_LAST_WEEKS) * t;
  const amount = _prizeRound(base * weeks);

  let divName = level;
  try{
    const VD = (typeof VALORIA_DIVISIONS !== 'undefined') ? VALORIA_DIVISIONS
             : (typeof window !== 'undefined' ? window.VALORIA_DIVISIONS : null);
    const pyr = WORLDS.getPyramid(careerV2.nation || 'panthalassa') || [];
    const hit = pyr.find(function(p){ return p.id === level; });
    if(VD && VD[level])                    divName = VD[level].name;
    else if(careerV2.club.divisionName)    divName = careerV2.club.divisionName;
    else if(hit)                           divName = hit.name;
  }catch(e){}
  _prizePay(amount, 'Dotation de fin de saison — ' + pos + (pos === 1 ? 'er' : 'e') + ' de ' + divName, '#f0c028');
  return amount;
}

// ── Subvention structurelle de fin de saison (petits clubs) ──────────────
// Les clubs amateurs/semi-pro ne touchent pas de droits TV. Une subvention
// annuelle (fédération + municipalité) récompense la structuration du club :
// formation des jeunes, effectif licencié, infrastructures. Volontairement
// modeste mais vitale à ces niveaux, et croissante si le club se structure.
function _prizeSeasonGrant(pos, total){
  if(!careerV2 || !careerV2.club) return 0;
  const C = careerV2, club = C.club, level = club.level;
  if(_prizeIsPro(level)) return 0;

  const base = _prizeBase(level);
  const parts = [];

  // 1) Dotation fédérale de base : ~10 semaines de fonctionnement.
  let total_ = base * 10;
  parts.push('dotation de base');

  // 2) Prime de formation : indexée sur le centre de formation + les jeunes.
  const infra = club.infra || {};
  const youthLvl = infra.formation || 0;
  const nbYouth = (C.youthPool || []).length;
  if(youthLvl > 0 || nbYouth > 0){
    const f = base * (youthLvl * 2 + Math.min(4, nbYouth * 0.5));
    if(f > 0){ total_ += f; parts.push('formation'); }
  }

  // 3) Prime au licencié : plus le club fait vivre de joueurs, plus il compte.
  const nbLic = (C.players || []).length + (C.bench || []).length + (C.reserves || []).length;
  let costs = null;
  try{ costs = (typeof LEVEL_COSTS !== 'undefined') ? LEVEL_COSTS[level] : null; }catch(e){}
  const perLic = (costs && costs.license) ? costs.license : 12;
  if(nbLic > 0){ total_ += nbLic * perLic * 6; parts.push(nbLic + ' licenciés'); }

  // 4) Bonus sportif modeste : une belle saison attire les subventions.
  if(pos && total && pos <= Math.max(1, Math.ceil(total * 0.3))){
    total_ += base * 4; parts.push('bons résultats');
  }

  const amount = _prizeRound(total_);
  _prizePay(amount, 'Subvention annuelle (' + parts.join(', ') + ')', '#00bcd4');
  return amount;
}

// ── Hook unique de fin de saison ─────────────────────────────────────────
// Appelé depuis endCareerSeasonDirector(), AVANT la remise à zéro des stats.
function _prizeOnSeasonEnd(pos, total){
  if(!careerV2 || !careerV2.club) return;
  if(_prizeIsPro(careerV2.club.level)) _prizeSeasonRank(pos, total);
  else                                 _prizeSeasonGrant(pos, total);
}

// ── Carte "Dotations" (onglet Finances) ──────────────────────────────────
// Rend le système lisible AVANT la fin de saison : le joueur voit ce que
// rapportent son classement actuel et la coupe, au lieu de découvrir un
// virement surprise au moment du bilan.
function _renderPrizesCard(){
  const C = careerV2; if(!C || !C.club) return '';
  const level = C.club.level;
  const pro = _prizeIsPro(level);

  // Classement courant (pour projeter la dotation).
  const st = (C.standings || []).slice().sort(function(a, b){
    return b.Pts - a.Pts || (b.GF - b.GA) - (a.GF - a.GA);
  });
  const pos = st.findIndex(function(s){ return s.isPlayer; }) + 1;
  const total = st.length;

  let h = '<div class="ccard ccard-flush" style="margin-top:8px">';
  h += '<div style="font-size:10px;font-weight:700;color:var(--gold);margin-bottom:8px">🏅 Dotations de fin de saison</div>';

  if(pro){
    if(pos && total){
      // Projection au classement actuel (sans verser quoi que ce soit).
      const base = _prizeBase(level);
      const t = (total - pos) / Math.max(1, total - 1);
      const weeks = PRIZES.RANK_LAST_WEEKS + (PRIZES.RANK_TOP_WEEKS - PRIZES.RANK_LAST_WEEKS) * t;
      const proj = _prizeRound(base * weeks);
      const champ = _prizeRound(base * PRIZES.RANK_TOP_WEEKS);
      h += '<div style="font-size:9px;color:var(--muted);line-height:1.6;margin-bottom:6px">Prime de classement (droits TV + dotation de ligue), versée au coup de sifflet final.</div>';
      h += '<div style="display:flex;justify-content:space-between;font-size:10px;padding:4px 0;border-bottom:1px solid var(--b1)">';
      h += '<span>Si vous finissez <b>' + pos + (pos === 1 ? 'er' : 'e') + '</b> (actuel)</span>';
      h += '<b style="color:#18c860">' + _fmtMoney(proj) + '</b></div>';
      h += '<div style="display:flex;justify-content:space-between;font-size:10px;padding:4px 0">';
      h += '<span style="color:var(--muted)">Si vous finissez champion</span>';
      h += '<b style="color:#f0c028">' + _fmtMoney(champ) + '</b></div>';
    } else {
      h += '<div style="font-size:9px;color:var(--muted)">Prime de classement versée en fin de saison.</div>';
    }
  } else {
    // Détail de la subvention : montre au joueur ce qui la fait monter.
    const base = _prizeBase(level);
    const infra = C.club.infra || {};
    const youthLvl = infra.formation || 0;
    const nbYouth = (C.youthPool || []).length;
    const nbLic = (C.players || []).length + (C.bench || []).length + (C.reserves || []).length;
    let costs = null;
    try{ costs = (typeof LEVEL_COSTS !== 'undefined') ? LEVEL_COSTS[level] : null; }catch(e){}
    const perLic = (costs && costs.license) ? costs.license : 12;

    const rows = [
      ['Dotation fédérale de base', _prizeRound(base * 10)],
      ['Formation (centre niv.' + youthLvl + ' · ' + nbYouth + ' jeunes)',
        _prizeRound(base * (youthLvl * 2 + Math.min(4, nbYouth * 0.5)))],
      ['Licenciés (' + nbLic + ')', _prizeRound(nbLic * perLic * 6)],
    ];
    h += '<div style="font-size:9px;color:var(--muted);line-height:1.6;margin-bottom:6px">Subvention annuelle (fédération + municipalité). Elle récompense la structuration du club — pas les résultats.</div>';
    let sum = 0;
    rows.forEach(function(r){
      sum += r[1];
      h += '<div style="display:flex;justify-content:space-between;font-size:9px;padding:3px 0;border-bottom:1px solid var(--b1)">';
      h += '<span style="color:var(--muted)">' + r[0] + '</span>';
      h += '<b style="color:' + (r[1] > 0 ? '#18c860' : '#666') + '">+' + _fmtMoney(r[1]) + '</b></div>';
    });
    h += '<div style="display:flex;justify-content:space-between;font-size:10px;padding:6px 0 0">';
    h += '<b>Total estimé</b><b style="color:#00bcd4">' + _fmtMoney(_prizeRound(sum)) + '</b></div>';
    h += '<div style="font-size:8px;color:var(--muted);margin-top:4px">💡 Améliorez le centre de formation et étoffez l\'effectif pour l\'augmenter.</div>';
  }

  // Coupe en cours : rappel de la dotation.
  if(C.cup && !C.cup.winner && !C.cup.playerOut){
    try{ _trackCupRound(C.cup.round || 0); }catch(e){}
    const nextRound = _prizeCupRound(C.cup.round || 0, (C.cup.roundNames || []).length, 'national');
    h += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--b1)">';
    h += '<div style="display:flex;justify-content:space-between;font-size:9px;padding:2px 0">';
    h += '<span style="color:var(--muted)">🏆 ' + C.cup.name + ' — prochain tour</span>';
    h += '<b style="color:#18c860">+' + _fmtMoney(nextRound) + '</b></div>';
    h += '<div style="display:flex;justify-content:space-between;font-size:9px;padding:2px 0">';
    h += '<span style="color:var(--muted)">🏆 Titre</span>';
    h += '<b style="color:#f0c028">+' + _fmtMoney(_prizeCupTitle('national')) + '</b></div>';
    h += '</div>';
  }

  h += '</div>';
  return h;
}

// ═══════════════════════════════════════════════════════════
// SQUAD.JS — Vieillissement & progression de VOTRE effectif
// ═══════════════════════════════════════════════════════════
// Correctif d'un déséquilibre majeur : _evolveOpponentSquads() ne bouclait que
// sur C.opponentSquads. Les effectifs adverses vieillissaient, progressaient,
// déclinaient et partaient à la retraite — mais PAS le vôtre, figé pour
// l'éternité. Sur 10 saisons, l'IA se régénérait pendant que votre équipe
// restait identique : décrochage mécanique, et surtout `_potential` (généré
// puis affiché sur les jeunes) n'était jamais utilisé pour les faire
// progresser. Recruter une pépite à 16 ans ne servait donc strictement à rien.
//
// On réutilise ici EXACTEMENT les mêmes règles que l'IA (_agePlayerStats,
// raceRetireChance) : mêmes courbes par race, même équité. Les races sans
// déclin (démons, anges, vampires, fées — peakEnd:Infinity, retire:[]) restent
// volontairement immortelles : c'est un choix de worldbuilding, pas un bug.
// ═══════════════════════════════════════════════════════════

// Progression d'un jeune du centre de formation vers son potentiel.
// Plus il est loin de son plafond, plus il progresse vite ; la qualité du
// centre de formation accélère le tout (ce qui donne enfin un intérêt concret
// à l'infra `formation` et à la subvention indexée dessus).
function _developYouth(p, formationLvl){
  if(!p || !p.s) return 0;
  const before = _squadOvr(p);
  const pot = p._potential || before;
  const room = pot - before;
  if(room <= 0) return 0;

  // Base 1-3 points, +0..2 selon le centre de formation (niv. 0-5), accéléré
  // si le joueur est très loin de son potentiel.
  let gain = 1 + Math.random()*2;
  gain += (formationLvl || 0) * 0.4;
  gain *= (room > 20) ? 1.4 : (room > 10) ? 1.1 : 0.6;
  gain = Math.min(gain, room); // jamais au-delà du potentiel

  Object.keys(p.s).forEach(function(k){
    p.s[k] = Math.max(1, Math.min(99, Math.round(p.s[k] + gain + (Math.random()-0.5))));
  });
  return _squadOvr(p) - before;
}

// Fait vivre VOTRE effectif d'une saison à l'autre. Renvoie un rapport pour
// que le joueur voie ce qui a changé plutôt que de le subir en silence.
function _evolvePlayerSquad(){
  const C = careerV2;
  if(!C || !C.club) return null;
  const nation = C.nation || 'panthalassa';
  const region = C.club.region;
  const level  = C.club.level;
  const formationLvl = (C.club.infra && C.club.infra.formation) || 0;

  const report = { retired: [], progressed: [], declined: [], youth: [] };

  ['players', 'bench', 'reserves'].forEach(function(grp){
    const list = C[grp];
    if(!Array.isArray(list)) return;
    for(let i = list.length - 1; i >= 0; i--){
      const p = list[i];
      if(!p) continue;
      const before = _squadOvr(p);
      p.age = (p.age || 20) + 1;

      // Gains d'entraînement accumulés pendant la saison (training.js), à
      // afficher séparément du vieillissement : les deux se compensent
      // souvent, et n'afficher que le net rendait le travail invisible.
      let trained = 0;
      if(p._trainGain){
        const nAttrs = Object.keys(p.s || {}).length || 1;
        const ticks = Object.values(p._trainGain).reduce(function(a, b){ return a + b; }, 0);
        trained = ticks / nAttrs; // en points d'overall
        delete p._trainGain;      // remis à zéro pour la saison à venir
      }

      // Retraite : mêmes seuils par race que l'IA. Contrairement à l'IA, on ne
      // remplace PAS le partant : c'est à vous de recruter (le trou dans
      // l'effectif est le coût du temps qui passe).
      const retireChance = (typeof raceRetireChance === 'function')
        ? raceRetireChance(p.race, p.age)
        : (p.age >= 36 ? 0.9 : p.age >= 34 ? 0.45 : p.age >= 32 ? 0.12 : 0);
      if(Math.random() < retireChance){
        report.retired.push({ name: p.name, age: p.age, ovr: before, pos: p.pos });
        list.splice(i, 1);
        continue;
      }

      _ensurePotential(p);
      _agePlayerStats(p);
      const after = _squadOvr(p);
      const d = after - before;
      const row = { name: p.name, age: p.age, from: before, to: after,
                    trained: Math.round(trained * 10) / 10 };
      if(d >= 2)       report.progressed.push(row);
      else if(d <= -2) report.declined.push(row);
      else if(trained >= 1) report.progressed.push(row); // travail visible même si net ≈ 0
    }
  });

  // ── Jeunes du centre de formation ──────────────────────────────────────
  (C.youthPool || []).forEach(function(p){
    if(!p) return;
    p.age = (p.age || p._age || 16) + 1;
    const gain = _developYouth(p, formationLvl);
    if(gain >= 1) report.youth.push({ name: p.name, age: p.age, gain: gain, ovr: _squadOvr(p), pot: p._potential });
  });

  C._squadReport = report;
  _ensureMinimumSquad(report);
  return report;
}

// ── Filet de sécurité : jamais moins de 11 joueurs ───────────────────────
// L'IA remplace automatiquement ses partants (_buildReplacementPlayer), pas
// vous : les places laissées vacantes sont le coût du temps qui passe, et
// c'est voulu. Mais un joueur passif finirait à 0 joueur et ne pourrait plus
// aligner d'équipe (soft-lock). En dessous du minimum, le club recrute donc
// d'office des joueurs libres — des bouche-trous médiocres, jamais un cadeau :
// mieux vaut recruter soi-même.
function _ensureMinimumSquad(report){
  const C = careerV2;
  if(!C || !C.club) return;
  const MIN = 11;
  const nb = (C.players || []).length + (C.bench || []).length;
  if(nb >= MIN) return;

  const need = MIN - nb;
  const nation = C.nation || 'panthalassa';
  const region = C.club.region;
  const level = C.club.level;
  const filled = [];

  for(let i = 0; i < need; i++){
    let p = null;
    // Réutilise le générateur de remplaçants de l'IA quand il est disponible,
    // pour garder des joueurs cohérents avec le niveau et la région.
    try{
      if(typeof _buildReplacementPlayer === 'function'){
        p = _buildReplacementPlayer(nation, region, level, 'MC', 'bench');
      }
    }catch(e){}
    if(!p){
      try{ p = WORLDS.generatePlayer(nation, region, 'MC', 'Recrue ' + (i+1), level); }catch(e){}
    }
    if(!p) break;
    p._emergency = true;
    if(!C.bench) C.bench = [];
    C.bench.push(p);
    filled.push(p.name);
  }

  if(filled.length){
    if(report) report.emergency = filled;
    try{ logEvent('🚨 Effectif sous le minimum : ' + filled.length +
      ' joueur(s) recruté(s) en urgence. Recrutez vous-même pour faire mieux !', '#e08040'); }catch(e){}
  }
}

// Journalise le rapport d'évolution (log de carrière) + le stocke pour la
// carte de fin de saison.
function _logSquadEvolution(r){
  if(!r) return;
  r.retired.forEach(function(x){
    try{ logEvent('🎖 ' + x.name + ' (' + x.age + ' ans) raccroche les crampons.', '#f0c028'); }catch(e){}
  });
  if(r.progressed.length){
    const top = r.progressed.slice().sort(function(a,b){ return (b.to-b.from)-(a.to-a.from); })[0];
    try{ logEvent('📈 ' + r.progressed.length + ' joueur(s) ont progressé — ' + top.name +
      ' ' + top.from + '→' + top.to + '.', '#18c860'); }catch(e){}
  }
  if(r.declined.length){
    try{ logEvent('📉 ' + r.declined.length + ' joueur(s) accusent le poids des années.', '#e08040'); }catch(e){}
  }
  r.youth.forEach(function(x){
    if(x.gain >= 4){
      try{ logEvent('🌱 ' + x.name + ' explose au centre de formation (' + x.ovr + ', potentiel ' + x.pot + ') !', '#9c27b0'); }catch(e){}
    }
  });
}

// ── Carte "Intersaison" (onglet Vue, 1re semaine de la saison) ───────────
// Affiche le bilan de l'évolution de l'effectif pour que les départs à la
// retraite et les progressions soient une information, pas une surprise.
function _renderSquadReportCard(){
  const C = careerV2;
  const r = C && C._squadReport;
  if(!r) return '';
  if(!r.retired.length && !r.progressed.length && !r.declined.length && !r.youth.length &&
     !(r.emergency && r.emergency.length)) return '';

  let h = '<div class="ccard">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
  h += '<div style="font-size:10px;font-weight:700;color:var(--gold)">🔄 Intersaison — évolution de l\'effectif</div>';
  h += '<button class="btn" onclick="_dismissSquadReport()" style="font-size:8px;padding:2px 8px">✕</button>';
  h += '</div>';

  if(r.retired.length){
    h += '<div style="font-size:9px;color:#f0c028;font-weight:700;margin:6px 0 3px">🎖 Fin de carrière (' + r.retired.length + ')</div>';
    r.retired.forEach(function(x){
      h += '<div style="display:flex;justify-content:space-between;font-size:9px;padding:2px 0;border-bottom:1px solid var(--b1)">';
      h += '<span>' + x.name + ' <span style="color:var(--muted)">· ' + x.pos + ' · ' + x.age + ' ans</span></span>';
      h += '<span style="color:var(--muted)">' + x.ovr + '</span></div>';
    });
    h += '<div style="font-size:8px;color:var(--muted);margin-top:4px">💡 Ces places sont vacantes — pensez à recruter.</div>';
  }
  if(r.emergency && r.emergency.length){
    h += '<div style="font-size:9px;color:#e08040;font-weight:700;margin:8px 0 3px">🚨 Recrutement d\'urgence (' + r.emergency.length + ')</div>';
    h += '<div style="font-size:8px;color:var(--muted);line-height:1.5">Votre effectif était descendu sous 11 joueurs : le club a signé ' +
      r.emergency.join(', ') + ' en catastrophe. Ce sont des bouche-trous — recrutez vous-même pour faire mieux.</div>';
  }
  // Ligne détaillée : sépare l'effet de l'ÂGE de celui de l'ENTRAÎNEMENT.
  // Les deux se compensent souvent (un trentenaire perd ~1.2/attribut mais en
  // regagne autant à l'entraînement) : n'afficher que le net donnait
  // l'impression que les joueurs évoluaient tout seuls.
  const _row = function(x, col){
    const net = x.to - x.from;
    const trained = x.trained || 0;
    const aged = Math.round((net - trained) * 10) / 10; // part imputable à l'âge
    let d = '<div style="padding:3px 0;border-bottom:1px solid var(--b1)">';
    d += '<div style="display:flex;justify-content:space-between;font-size:9px">';
    d += '<span>' + x.name + ' <span style="color:var(--muted)">· ' + x.age + ' ans</span></span>';
    d += '<span style="color:' + col + '">' + x.from + ' → <b>' + x.to + '</b></span></div>';
    if(trained > 0 || Math.abs(aged) >= 0.5){
      d += '<div style="font-size:8px;color:var(--muted);margin-top:1px">';
      const bits = [];
      if(Math.abs(aged) >= 0.5) bits.push('<span style="color:' + (aged >= 0 ? '#18c860' : '#e08040') + '">âge ' + (aged > 0 ? '+' : '') + aged + '</span>');
      if(trained > 0)           bits.push('<span style="color:#00bcd4">entraînement +' + trained + '</span>');
      d += bits.join(' · ') + '</div>';
    }
    d += '</div>';
    return d;
  };

  if(r.progressed.length){
    h += '<div style="font-size:9px;color:#18c860;font-weight:700;margin:8px 0 3px">📈 En progrès (' + r.progressed.length + ')</div>';
    r.progressed.slice(0, 5).forEach(function(x){ h += _row(x, '#18c860'); });
  }
  if(r.declined.length){
    h += '<div style="font-size:9px;color:#e08040;font-weight:700;margin:8px 0 3px">📉 En déclin (' + r.declined.length + ')</div>';
    r.declined.slice(0, 5).forEach(function(x){ h += _row(x, '#e08040'); });
    h += '<div style="font-size:8px;color:var(--muted);margin-top:3px">💡 L\'entraînement freine le déclin sans l\'annuler — un centre de formation de meilleur niveau aide.</div>';
  }
  if(r.youth.length){
    h += '<div style="font-size:9px;color:#9c27b0;font-weight:700;margin:8px 0 3px">🌱 Centre de formation (' + r.youth.length + ')</div>';
    r.youth.slice(0, 5).forEach(function(x){
      h += '<div style="display:flex;justify-content:space-between;font-size:9px;padding:2px 0;border-bottom:1px solid var(--b1)">';
      h += '<span>' + x.name + ' <span style="color:var(--muted)">· ' + x.age + ' ans</span></span>';
      h += '<span style="color:#9c27b0">+' + x.gain + ' → <b>' + x.ovr + '</b> <span style="color:var(--muted)">(pot. ' + (x.pot||'?') + ')</span></span></div>';
    });
  }
  h += '</div>';
  return h;
}

function _dismissSquadReport(){
  if(!careerV2) return;
  delete careerV2._squadReport;
  saveCareerV2();
  renderCareerV2();
}

// ═══════════════════════════════════════════════════════════
// OBJECTIFS DU BOARD — évaluation de fin de saison
// ═══════════════════════════════════════════════════════════
// `board_objectives` était généré au démarrage (_generateBoardObjectives, avec
// un `desc` ET une `reward` par niveau) et affiché dans la Vue… mais jamais
// évalué : la prime n'était jamais versée. On ferme la boucle ici, et on la
// relie à la confiance du board — un objectif est une promesse faite aux
// dirigeants, la tenir (ou non) doit compter.

// L'objectif est-il atteint ? `stats` = {promoted, relegated, rank, total, wins}
function _boardObjectiveMet(obj, stats){
  if(!obj || !stats) return false;
  const rank = stats.rank || 0, total = stats.total || 0;
  const ss = (careerV2 && careerV2.season_stats) || {};
  switch(obj.type){
    case 'promotion': return !!stats.promoted;
    case 'top_half':  return rank > 0 && total > 0 && rank <= Math.ceil(total/2);
    case 'mid_table': return !stats.relegated;
    case 'survive':   return !stats.relegated;
    // ── Objectifs SECONDAIRES (non basés sur le classement) ──────────────
    case 'cup_run':   return (careerV2 && careerV2._cupBestRound || 0) >= (obj.target || 2);
    case 'cup_win':   return !!stats.cupWon;
    case 'goals':     return (ss.goals_for || 0) >= (obj.target || 30);
    case 'wins':      return (ss.wins || 0) >= (obj.target || 10);
    case 'unbeaten':  return (careerV2 && careerV2._bestUnbeaten || 0) >= (obj.target || 5);
    case 'youth':     return (careerV2 && careerV2._youthPromotedThisSeason || 0) >= (obj.target || 1);
    case 'finance':   return (careerV2 && careerV2.club && (careerV2.club.budget || 0) >= (obj.target || 0));
    default:          return false;
  }
}

// Objectif secondaire, tiré d'un pool adapté au niveau. C'est ce qui sort le
// board du seul classement : un parcours en coupe, un buteur prolifique, une
// éclosion de jeune, une série d'invincibilité, un club dans le vert.
function _secondaryObjective(club){
  const lvl = club.level;
  const isPro = ['d1','d2','d3'].includes(lvl);
  const pool = [
    { type:'cup_run', target:2, desc:'Atteindre les 8es de coupe',        reward: isPro?6000:1500 },
    { type:'goals',   target:isPro?40:25, desc:'Marquer ' + (isPro?40:25) + ' buts en championnat', reward: isPro?5000:1200 },
    { type:'wins',    target:isPro?12:8,  desc:'Remporter ' + (isPro?12:8) + ' matchs',              reward: isPro?5000:1200 },
    { type:'unbeaten',target:5,  desc:'Une série de 5 matchs sans défaite', reward: isPro?7000:1800 },
    { type:'youth',   target:1,  desc:'Faire éclore un jeune de l\'académie', reward: isPro?8000:2500 },
  ];
  if(isPro) pool.push({ type:'cup_win', desc:'Remporter la coupe', reward:20000 });
  return pool[Math.floor(Math.random() * pool.length)];
}

// Évalue l'objectif de la saison écoulée, verse la prime, ajuste la confiance,
// puis régénère un objectif pour la saison à venir (le niveau a pu changer).
function _boardCheckObjectives(stats){
  const C = careerV2;
  if(!C || !C.club) return;
  const objs = (C.club.board_objectives || []);
  C._lastObjectives = [];
  objs.forEach(function(obj, i){
    if(!obj) return;
    const met = _boardObjectiveMet(obj, stats);
    // L'objectif principal pèse plus lourd que le secondaire.
    const weight = obj._secondary ? 5 : 8;
    if(met){
      if(obj.reward){
        try{ _prizePay(obj.reward, 'Prime d\'objectif — ' + obj.desc, '#18c860'); }catch(e){}
      }
      _boardAdjust(weight, 'objectif tenu : ' + obj.desc, '#18c860');
    } else {
      _boardAdjust(-weight, 'objectif manqué : ' + obj.desc, '#e06060');
    }
    C._lastObjectives.push({ desc: obj.desc, met: met, reward: met ? (obj.reward || 0) : 0, secondary: !!obj._secondary });
  });
  // Compat : l'ancien champ singulier reste renseigné (objectif principal).
  if(C._lastObjectives.length) C._lastObjective = C._lastObjectives[0];

  // Nouvel objectif, calé sur le niveau actuel (post promotion/relégation).
  try{
    if(typeof _generateBoardObjectives === 'function'){
      C.club.board_objectives = _generateBoardObjectives(C.club);
    }
  }catch(e){ console.error('regen board objectives:', e); }
}

// ═══════════════════════════════════════════════════════════
// POTENTIEL & ENTRAÎNEMENT — correctifs + focus individuel
// ═══════════════════════════════════════════════════════════
// Trois problèmes traités ici :
//
// 1) BUG DE CHAMP : training.js lit `player.potential`, alors que tout le
//    reste du jeu écrit `player._potential`. Le champ n'existant jamais, le
//    frein « proche du potentiel » retombait sur 99 → n'importe quel joueur
//    pouvait s'entraîner jusqu'à 99, quel que soit son talent. Le potentiel
//    d'une pépite ne voulait plus rien dire.
//
// 2) POTENTIEL ABSENT : `_potential` n'était posé QUE sur les jeunes du centre
//    (_generateYouthIntake). Les joueurs de l'effectif de départ, les agents
//    libres et les recrues n'en avaient aucun — corriger (1) seul leur aurait
//    donc laissé un plafond de 99. On backfille un potentiel cohérent.
//
// 3) LISIBILITÉ : le déclin de l'âge et les gains d'entraînement s'annulaient
//    presque exactement, et le bilan n'affichait que le net. Le joueur ne
//    voyait jamais que son entraînement avait compensé le vieillissement.
//    On sépare désormais les deux effets (cf. _evolvePlayerSquad).

// Potentiel d'un joueur, calculé à la demande et mémorisé. Sert de plafond à
// la progression (entraînement + vieillissement).
function _ensurePotential(p){
  if(!p || !p.s) return 99;
  if(typeof p._potential === 'number') return p._potential;

  const ovr = _squadOvr(p);
  const age = p.age || 24;
  // Un joueur déjà âgé a « fini » sa progression : son potentiel est proche de
  // son niveau actuel. Un jeune garde une marge, d'autant plus grande qu'il est
  // jeune (c'est le pari du recrutement).
  let margin;
  if(age <= 18)      margin = 18 + Math.random() * 22;  // 18-40 de marge
  else if(age <= 21) margin = 12 + Math.random() * 18;
  else if(age <= 24) margin = 6  + Math.random() * 12;
  else if(age <= 27) margin = 2  + Math.random() * 7;
  else               margin = Math.random() * 3;        // quasi fini

  p._potential = Math.max(ovr, Math.min(99, Math.round(ovr + margin)));
  return p._potential;
}

// Applique le correctif à tout l'effectif (idempotent : ne recalcule jamais un
// potentiel déjà posé). Appelé à l'ouverture de la carrière → les sauvegardes
// existantes sont migrées sans rien casser.
function _backfillPotentials(){
  const C = careerV2;
  if(!C) return 0;
  let n = 0;
  ['players', 'bench', 'reserves', 'youthPool', 'freeAgents'].forEach(function(grp){
    (C[grp] || []).forEach(function(p){
      if(p && p.s && typeof p._potential !== 'number'){ _ensurePotential(p); n++; }
    });
  });
  return n;
}


// ═══════════════════════════════════════════════════════════
// FOCUS D'ENTRAÎNEMENT INDIVIDUEL
// ═══════════════════════════════════════════════════════════
// Le style de coach (TRAINING_CONFIG.coachStyles) oriente déjà l'IA au niveau
// de l'ÉQUIPE. Il manquait le niveau INDIVIDUEL : dire « ce joueur travaille sa
// finition ». Le focus donne un bonus de progression sur l'attribut choisi, et
// une légère pénalité sur les autres (on ne peut pas tout travailler à la
// fois — c'est un arbitrage, pas un bonus gratuit).

const FOCUS = {
  BONUS:   2.2,   // multiplicateur de chance sur l'attribut ciblé
  MALUS:   0.75,  // sur les autres attributs
  OPTIONS: [
    { key:'sht',  label:'Finition',   icon:'🎯' },
    { key:'spd',  label:'Vitesse',    icon:'⚡' },
    { key:'def',  label:'Défense',    icon:'🛡' },
    { key:'stam', label:'Endurance',  icon:'🫀' },
    { key:'tec',  label:'Technique',  icon:'✨' },
    { key:'pas',  label:'Passe',      icon:'➤'  },
    { key:'res',  label:'Mental',     icon:'🧠' },
  ],
};

function _focusLabel(key){
  const o = FOCUS.OPTIONS.find(function(x){ return x.key === key; });
  return o ? (o.icon + ' ' + o.label) : '—';
}

// Applique le focus d'un joueur au multiplicateur de chance d'un attribut.
// Appelé depuis training.js (applySessionToPlayer).
function _focusMul(player, attrKey){
  if(!player || !player._focus) return 1;
  if(!player.s || typeof player.s[attrKey] !== 'number') return 1;
  return (player._focus === attrKey) ? FOCUS.BONUS : FOCUS.MALUS;
}

// Définit / retire le focus d'un joueur (UI).
function setPlayerFocus(playerName, attrKey){
  const C = careerV2;
  if(!C) return;
  const all = (C.players || []).concat(C.bench || [], C.reserves || []);
  const p = all.find(function(x){ return x.name === playerName; });
  if(!p) return;
  if(!attrKey || p._focus === attrKey){
    delete p._focus;
    try{ logEvent('🎓 ' + p.name + ' revient à un entraînement général.', '#888'); }catch(e){}
  } else {
    p._focus = attrKey;
    try{ logEvent('🎓 ' + p.name + ' travaille désormais : ' + _focusLabel(attrKey), '#00bcd4'); }catch(e){}
  }
  saveCareerV2();
  try{ renderCareerDirectorTab('squad'); }catch(e){}
}

// Sélecteur de focus pour la fiche joueur.
function _renderFocusSelector(p){
  if(!p || !p.s) return '';
  const cur = p._focus || '';
  const pot = _ensurePotential(p);
  const ovr = _squadOvr(p);
  const room = pot - ovr;

  let h = '<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--b1)">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">';
  h += '<span style="font-size:9px;font-weight:700;color:var(--gold)">🎓 Focus d\'entraînement</span>';
  h += '<span style="font-size:8px;color:var(--muted)">Potentiel <b style="color:' +
    (room > 10 ? '#18c860' : room > 3 ? '#f0c028' : '#888') + '">' + pot + '</b>' +
    (room > 0 ? ' · marge +' + room : ' · atteint') + '</span>';
  h += '</div>';

  if(room <= 0){
    h += '<div style="font-size:8px;color:var(--muted);margin-bottom:5px">Ce joueur a atteint son potentiel : l\'entraînement ne le fera plus progresser.</div>';
  }

  h += '<div style="display:flex;flex-wrap:wrap;gap:3px">';
  FOCUS.OPTIONS.forEach(function(o){
    if(typeof p.s[o.key] !== 'number') return;
    const on = cur === o.key;
    h += '<button class="btn' + (on ? ' btng' : '') + '" onclick="setPlayerFocus(\'' +
      String(p.name).replace(/'/g, "\'") + '\',\'' + o.key + '\')" ' +
      'style="font-size:8px;padding:2px 6px' + (on ? '' : ';opacity:.75') + '" ' +
      'title="' + o.label + ' — actuel ' + p.s[o.key] + '">' + o.icon + ' ' + p.s[o.key] + '</button>';
  });
  h += '</div>';
  h += '<div style="font-size:8px;color:var(--muted);margin-top:4px">' +
    (cur ? 'Travaille <b style="color:#00bcd4">' + _focusLabel(cur) + '</b> — progresse plus vite sur cet attribut, un peu moins sur les autres.'
         : 'Aucun focus : progression équilibrée. Cliquez un attribut pour le prioriser.') + '</div>';
  h += '</div>';
  return h;
}

// ═══════════════════════════════════════════════════════════
// MARCHÉ DES TRANSFERTS (achats)
// ═══════════════════════════════════════════════════════════
// Le mercato était à sens unique : des clubs venaient acheter VOS joueurs
// (incoming_offers), mais rien ne permettait d'en acheter. `transferBudget`
// était affiché dans 4 écrans, crédité à chaque vente… et jamais dépensé :
// le jeu montrait un budget inutilisable, pendant que les effectifs PNJ, eux,
// se régénéraient (_evolvePlayerSquad). Les onglets Semi-Pro et Pro
// annonçaient d'ailleurs « Marché — à développer prochainement ».
//
// On réutilise ici EXACTEMENT les briques existantes, pour que l'économie
// reste symétrique avec la vente :
//   • _boardPlayerValue()   → même barème que les offres entrantes
//   • careerV2.opponentSquads → les VRAIS effectifs adverses, persistants et
//     vieillissants : le joueur acheté quitte réellement son club. Un marché
//     qui génère des joueurs à la volée n'est qu'un catalogue.
//   • region.wealth (1..5)  → l'argent de la LIGUE fixe les prix, pas le seul
//     niveau sportif : une petite division riche coûte plus qu'une grande
//     division pauvre (cf. Transfermarkt).
//   • STAFF.gemChanceMul()  → le recruteur sert enfin à ça
// ═══════════════════════════════════════════════════════════

// ── Échelle économique du marché ─────────────────────────────────────────
// _boardPlayerValue() a été calibré pour la VENTE (on encaisse). Réutilisé tel
// quel à l'achat, il rendait le marché inutilisable en bas de pyramide : le
// barème `ovr^2.6` produit ~36k pour un joueur de R1, face à un budget
// transferts de 32k → strictement AUCUNE recrue abordable en R1, R2, R3 et DH.
// Or c'est là que les carrières commencent.
//
// On ancre donc le prix sur le budget du club plutôt que sur une constante :
// une recrue « au niveau du club » coûte ~1/4 du budget transferts, quel que
// soit l'échelon. Le marché reste tendu (on ne s'offre pas tout l'effectif)
// mais il existe partout. Les écarts de qualité entre joueurs, eux, restent
// pilotés par _boardPlayerValue : on ne fait que changer l'ÉCHELLE, pas la
// hiérarchie des prix.
function _marketScale(){
  const C = careerV2;
  if(!C || !C.club) return 1;
  const tb = C.club.transferBudget || 0;
  // Valeur de référence : un joueur typique du niveau du club.
  const ovrRef = _levelRefOvr(C.club.level);
  const ref = Math.pow(Math.max(1, ovrRef), 2.6) * 0.9;
  if(ref <= 0) return 1;
  // Cible : ~4 recrues de référence avec le budget plein.
  // On divise par la richesse de MA région : sinon un club riche et un club
  // pauvre du même niveau auraient la même échelle, et l'écart de richesse
  // — pourtant le cœur du sujet — s'annulerait. Ici, être riche veut dire
  // pouvoir s'offrir des joueurs venus de régions plus riches que la sienne.
  const myWealth = _regionWealth(C.nation || 'panthalassa', C.club.region);
  const target = Math.max(300, tb / 4);
  return Math.max(0.02, Math.min(3, (target / ref) / _wealthMul(myWealth)));
}

// Overall typique d'un joueur au niveau donné (dérivé de _cupTeamStrength,
// qui sert déjà de référence de force ailleurs dans le jeu).
function _levelRefOvr(level){
  const st = (typeof _cupTeamStrength === 'function') ? _cupTeamStrength(level) : 0.5;
  return Math.max(20, Math.round(st * 85));
}

// Prime demandée par un club vendeur : au-dessus de la valeur nue, car un club
// ne brade pas un joueur sous contrat (miroir du bonus qu'on touche en vendant
// à un club d'un cran au-dessus).
// ── Plafond ABSOLU par division ──────────────────────────────────────────
// _marketScale() est une échelle RELATIVE (ancrée sur le budget) : rien n'y
// borne le prix dans l'absolu. Un joueur de R1 d'une région riche pouvait
// ainsi atteindre 222 000 or, soit 22 M€ — grotesque pour du national amateur.
// Ces plafonds sont exprimés en OR (1 or ≈ 100 €) et bornent le prix selon la
// division où le joueur ÉVOLUE réellement.
const _DIV_PRICE_CAP = {
  d1: 250000,   // 25 M€ — une star de l'élite
  d2: 40000,    // 4 M€
  d3: 8000,     // 800 k€
  r1: 1500,     // 150 k€ — national amateur
  r2: 400,      // 40 k€
  r3: 120,      // 12 k€
  dh: 40,       // 4 k€ — district
};
// Compression asymptotique vers un plafond : conserve les écarts relatifs.
function _compressToCap(raw, cap){
  raw = Math.max(0, raw);
  return Math.max(300, Math.round((cap * raw / (raw + cap)) / 100) * 100);
}
function _divPriceCap(level){
  if(_DIV_PRICE_CAP[level] != null) return _DIV_PRICE_CAP[level];
  // Niveaux dérivés (dh_1, dh_2…) : on retombe sur la base avant l'underscore.
  const base = String(level || '').split('_')[0];
  return _DIV_PRICE_CAP[base] != null ? _DIV_PRICE_CAP[base] : 1500;
}

// `wealth` = richesse (1..5) de la région du club VENDEUR. Un club riche
// n'a pas besoin de vendre : il exige une prime. Un club pauvre brade.
// `level` = division du vendeur, qui borne le prix dans l'absolu.
function _askingPrice(p, wealth, level){
  const base = _boardPlayerValue(p) * _marketScale() * _wealthMul(wealth);
  const mult = 1.12 * (0.9 + Math.random() * 0.35);
  let raw = Math.max(300, base * mult);
  // ── Compression vers le plafond (et non troncature) ────────────────────
  // Un plafond DUR écrasait toute la hiérarchie : en R1, un vétéran médiocre
  // et une pépite tapaient tous les deux exactement 1500 or. On compresse donc
  // de façon asymptotique : le prix approche le plafond sans jamais le
  // dépasser, mais les écarts entre joueurs subsistent.
  //   f(x) = cap * x / (x + cap)  → f(0)=0, f(cap)=cap/2, f(∞)→cap
  const cap = _divPriceCap(level);
  const fee = cap * raw / (raw + cap);
  return Math.max(300, Math.round(fee / 100) * 100);
}

// ── Richesse d'une région (1..5) ─────────────────────────────────────────
// Les régions portent déjà un `wealth` utilisé par sponsors.js et par
// WORLDS.startBudget() (5k..300k, soit un facteur 60 entre la région la plus
// pauvre et la plus riche). Le marché des transferts DOIT s'y adosser : sans
// ça, un effectif d'une petite division riche coûterait autant qu'un effectif
// d'une grande division pauvre, ce qui est faux (une D1 galloise vaut une
// fraction d'une L2 française, alors qu'elle joue l'Europe).
function _regionWealth(nation, regionId){
  try{
    const r = WORLDS.getRegion(nation, regionId);
    if(r && r.wealth) return r.wealth;
  }catch(e){}
  return 2;
}
// Multiplicateur économique dérivé de la richesse. Calé sur la même échelle
// que WORLDS.startBudget() : c'est l'argent de la LIGUE qui fixe les prix,
// pas seulement le niveau sportif des joueurs.
function _wealthMul(wealth){
  return ({1:0.35, 2:0.6, 3:1.0, 4:1.8, 5:3.2})[wealth] || 0.6;
}

// ── Vivier réel : les effectifs PNJ persistants ──────────────────────────
// careerV2.opponentSquads contient les VRAIS effectifs adverses, keyés par nom
// de club, qui vieillissent et évoluent d'une saison à l'autre (_evolvePlayerSquad
// côté PNJ). C'est là qu'il faut piocher : un marché qui invente des joueurs à
// la volée n'est pas un marché, c'est un catalogue — le joueur acheté ne
// manquerait à personne et personne d'autre ne pourrait l'acheter.
function _marketCandidates(){
  const C = careerV2;
  const out = [];
  const squads = C.opponentSquads || {};
  const myClub = C.club ? C.club.name : '';
  Object.keys(squads).forEach(function(clubName){
    if(clubName === myClub) return;
    const entry = squads[clubName];
    if(!entry || !entry.squad) return;
    // On ne pioche que dans les joueurs réellement remplaçables : un club ne
    // vend pas ses 11 titulaires. Banc et réserves d'abord, quelques
    // titulaires ensuite (les moins bons).
    const pool = [];
    (entry.squad.bench || []).forEach(function(p){ pool.push(p); });
    (entry.squad.reserves || []).forEach(function(p){ pool.push(p); });
    const starters = (entry.squad.players || []).slice().sort(function(a,b){ return _pOvr(a)-_pOvr(b); });
    starters.slice(0, 3).forEach(function(p){ pool.push(p); });
    pool.forEach(function(p){
      if(p) out.push({ p: p, clubName: clubName, entry: entry });
    });
  });
  return out;
}

// Retire réellement un joueur de l'effectif de son club vendeur.
function _removeFromOpponentSquad(clubName, player){
  const C = careerV2;
  const entry = (C.opponentSquads || {})[clubName];
  if(!entry || !entry.squad) return false;
  let done = false;
  // On retire TOUTES les occurrences, sans s'arrêter à la première : si un
  // joueur figurait à la fois dans `players` et `bench` (données remaniées,
  // sauvegarde ancienne), une référence résiduelle le laisserait dans les deux
  // effectifs — il vieillirait deux fois et serait clone chez le vendeur.
  ['players','bench','reserves'].forEach(function(grp){
    const list = entry.squad[grp];
    if(!Array.isArray(list)) return;
    for(let i = list.length - 1; i >= 0; i--){
      if(list[i] === player){ list.splice(i, 1); done = true; }
    }
  });
  return done;
}

// Génère la liste des joueurs à vendre sur le marché, adaptée au niveau du
// club. On pioche dans les VRAIS effectifs adverses ; le prix dépend de la
// richesse de la région du club vendeur.
function generateTransferList(){
  if(!careerV2) return;
  const C = careerV2;
  if(!C.mercato) C.mercato = {};
  const nation = C.nation || 'panthalassa';

  const cands = _marketCandidates();
  if(!cands.length){ C.mercato.transfer_list = []; return; }

  const scoutMul = (typeof STAFF !== 'undefined') ? STAFF.gemChanceMul(C.club) : 1;
  const nb = Math.min(cands.length, 6 + Math.floor(Math.random() * 3) + (scoutMul > 1.4 ? 2 : scoutMul > 1.1 ? 1 : 0));

  // Mélange puis prise des N premiers : chaque club ne propose pas tout.
  const shuffled = cands.slice().sort(function(){ return Math.random() - 0.5; });
  const list = [];
  const seen = {};

  for(let i = 0; i < shuffled.length && list.length < nb; i++){
    const c = shuffled[i];
    if(seen[c.clubName]) continue;      // une annonce par club au maximum
    if(!c.p || !c.p.name) continue;
    seen[c.clubName] = true;

    const sellerRegion = c.entry.region;
    const wealth = _regionWealth(nation, sellerRegion);
    const fee = _askingPrice(c.p, wealth, c.entry.level);
    let sellerCol = '#888', sellerDiv = c.entry.level;
    try{
      const info = _boardPickClub(c.entry.level);
      if(info && info.divisionName) sellerDiv = info.divisionName;
    }catch(e){}

    list.push({
      id: 'tl_' + Math.random().toString(36).slice(2, 8),
      player: c.p,
      playerName: c.p.name,
      sellerName: c.clubName,
      sellerColor: sellerCol,
      sellerLevel: sellerDiv,
      sellerWealth: wealth,
      fee: fee,
      value: _compressToCap(_boardPlayerValue(c.p) * _marketScale() * _wealthMul(wealth), _divPriceCap(c.entry.level)),
      negotiated: false,
      expiresWeek: (C.week || 0) + 3,
    });
  }
  C.mercato.transfer_list = list;
}

// Purge des annonces expirées (appelé au fil des semaines).
function _pruneTransferList(){
  const C = careerV2;
  if(!C || !C.mercato || !Array.isArray(C.mercato.transfer_list)) return;
  const before = C.mercato.transfer_list.length;
  C.mercato.transfer_list = C.mercato.transfer_list.filter(function(t){
    return (t.expiresWeek || 0) > (C.week || 0);
  });
  if(C.mercato.transfer_list.length < before && C.mercato.transfer_list.length === 0){
    generateTransferList();
  }
}

// ── Négocier le prix d'une recrue ────────────────────────────────────────
// Miroir exact de la négociation de vente (_boardNegotiate) : on peut faire
// baisser le prix, mais le vendeur peut se braquer et retirer le joueur.
function negotiateTransferBuy(id){
  const C = careerV2;
  if(!C || !C.mercato) return;
  const t = (C.mercato.transfer_list || []).find(function(x){ return x.id === id; });
  if(!t) return;
  if(t.negotiated){ logEvent('Vous avez déjà négocié pour ' + t.player.name + '.', '#e06060'); return; }

  const offer = Math.round(t.fee * 0.82 / 100) * 100;
  if(!confirm('Proposer ' + _fmtMoney(offer) + ' au lieu de ' + _fmtMoney(t.fee) + ' pour ' + t.player.name + ' ?\n\nRisque : le club peut retirer le joueur du marché.')) return;

  t.negotiated = true;
  const roll = Math.random();
  if(roll < 0.45){
    t.fee = offer;
    logEvent('🤝 ' + t.sellerName + ' accepte ' + _fmtMoney(offer) + ' pour ' + t.player.name + '.', '#18c860');
  } else if(roll < 0.80){
    const mid = Math.round((t.fee + offer) / 2 / 100) * 100;
    t.fee = mid;
    logEvent('💬 ' + t.sellerName + ' contre-propose ' + _fmtMoney(mid) + ' pour ' + t.player.name + '.', '#f0c028');
  } else {
    C.mercato.transfer_list = C.mercato.transfer_list.filter(function(x){ return x.id !== id; });
    logEvent('❌ ' + t.sellerName + ' retire ' + t.player.name + ' du marché.', '#e02030');
  }
  saveCareerV2();
  try{ renderCareerDirectorTab('mercato'); }catch(e){}
}

// ── Acheter un joueur ────────────────────────────────────────────────────
// C'est ICI que `transferBudget` est enfin dépensé.
function buyTransferTarget(id){
  const C = careerV2;
  if(!C || !C.mercato) return;
  const t = (C.mercato.transfer_list || []).find(function(x){ return x.id === id; });
  if(!t){ logEvent('Annonce expirée.', '#e02030'); return; }

  // 1) Fenêtre de mercato (les clubs pros ne recrutent pas n'importe quand).
  if(C.mercato.window_open === false){
    logEvent('🔴 Fenêtre de transfert fermée.', '#e02030'); return;
  }
  // 2) Place dans l'effectif.
  const total = (C.players || []).length + (C.bench || []).length;
  const max = (typeof _careerSquadMax === 'function') ? _careerSquadMax() : 18;
  if(total >= max){ logEvent('Effectif plein ! (max ' + max + ')', '#e02030'); return; }
  // 3) Budget — le contrôle qui manquait.
  const budget = C.club.transferBudget || 0;
  if(t.fee > budget){
    logEvent('💸 Budget transferts insuffisant : ' + _fmtMoney(t.fee) + ' demandés, ' + _fmtMoney(budget) + ' disponibles.', '#e02030');
    return;
  }
  // 4) Plafond salarial : acheter, c'est aussi payer chaque semaine.
  const futureWage = (typeof careerV2WeeklySalary === 'function') ? careerV2WeeklySalary(t.player) : 0;
  if(!canAffordWage(futureWage)){
    logEvent('📉 Masse salariale : impossible d\'ajouter ' + _fmtMoney(futureWage) + '/sem sans dépasser le plafond du board.', '#e02030');
    return;
  }
  if(!confirm('Recruter ' + t.player.name + ' pour ' + _fmtMoney(t.fee) + ' ?\n\nSalaire estimé : ' + _fmtMoney(futureWage) + '/sem\nBudget restant après : ' + _fmtMoney(budget - t.fee))) return;

  // Le joueur QUITTE réellement son club : c'est ce qui distingue un marché
  // d'un catalogue. Si le retrait échoue (effectif remanié entre-temps,
  // joueur déjà parti à la retraite), on annule la transaction plutôt que de
  // cloner le joueur dans deux effectifs.
  if(!_removeFromOpponentSquad(t.sellerName, t.player)){
    logEvent('⌛ ' + (t.playerName || 'Ce joueur') + ' n\'est plus disponible.', '#e06060');
    C.mercato.transfer_list = C.mercato.transfer_list.filter(function(x){ return x.id !== id; });
    saveCareerV2();
    try{ renderCareerDirectorTab('mercato'); }catch(e){}
    return;
  }

  C.club.transferBudget = budget - t.fee;
  const p = t.player;
  p.onBench = true;
  if(!C.bench) C.bench = [];
  C.bench.push(p);
  C.mercato.transfer_list = C.mercato.transfer_list.filter(function(x){ return x.id !== id; });

  try{ _addFinanceLog('Achat de ' + p.name + ' (' + t.sellerName + ')', -t.fee); }catch(e){}

  // Le board juge le recrutement : payer bien plus que la valeur agace,
  // faire une bonne affaire rassure. Même barème que pour les ventes.
  const ratio = t.fee / Math.max(1, t.value);
  if(ratio <= 0.85)     _boardAdjust(2,  'belle recrue : ' + p.name, '#18c860');
  else if(ratio > 1.45) _boardAdjust(-2, p.name + ' payé trop cher', '#e06060');

  logEvent('✅ ' + p.name + ' rejoint le club pour ' + _fmtMoney(t.fee) + ' !', '#18c860');
  // Une recrue chère fait la une.
  try{
    if(typeof _pressEvent==='function' && t.fee >= (C.club.budget||0) * 0.15){
      _pressEvent('💰 Coup sur le marché : ' + C.club.name + ' s\'offre ' + p.name + ' pour ' + _fmtMoney(t.fee) + '.', 'good');
    }
  }catch(e){}
  saveCareerV2();
  try{ renderCareerDirectorTab('mercato'); }catch(e){}
}

// ═══════════════════════════════════════════════════════════
// CONTRATS (semi-pro : R1 / R2)
// ═══════════════════════════════════════════════════════════
// En semi-pro, un club n'a pas les moyens d'aligner des indemnités de
// transfert : il convainc les joueurs avec un CONTRAT (salaire + durée + prime
// à la signature). C'est le levier de recrutement propre à cet échelon, entre
// l'amateur (les joueurs viennent gratuitement) et le pro (on achète).
//
// Le joueur accepte ou non selon :
//   • le salaire proposé face à ce qu'il estime valoir ;
//   • la réputation du club (un club respecté peut payer un peu moins) ;
//   • la durée (un long contrat rassure un vétéran, effraie un jeune espoir).

// Salaire hebdomadaire qu'un joueur RÉCLAME (sa demande, pas ce qu'on paie).
function contractAskingWage(p){
  const C = careerV2;
  if(!C || !C.club) return 1;
  const base = (typeof careerV2WeeklySalary === 'function') ? careerV2WeeklySalary(p) : 1;
  // Un joueur libre demande un peu plus que le salaire "de marché" de
  // l'effectif : c'est sa marge de négociation.
  return Math.max(1, Math.round(base * 1.15));
}

// Probabilité d'acceptation (0..1) d'une offre de contrat.
function contractAcceptChance(p, wage, years){
  const C = careerV2;
  if(!C || !C.club) return 0;
  const ask = contractAskingWage(p);
  // Rapport salaire proposé / demandé : c'est le facteur dominant.
  const ratio = wage / Math.max(1, ask);
  let chance = Math.max(0, Math.min(1, (ratio - 0.6) / 0.7));  // 0.6x → 0%, 1.3x → 100%
  // Réputation du club : de -12% (inconnu) à +12% (respecté).
  const rep = (C.club.reputation || 20);
  chance += (rep - 50) / 400;
  // Durée : un jeune veut rester libre, un vétéran veut la sécurité.
  const age = p.age || 24;
  if(years >= 3)      chance += (age >= 30) ? 0.10 : -0.08;
  else if(years <= 1) chance += (age >= 30) ? -0.06 : 0.05;
  return Math.max(0.02, Math.min(0.97, chance));
}

// Proposer un contrat à un joueur libre (semi-pro).
function offerContract(idx, wage, years){
  const C = careerV2;
  if(!C || !C.club) return;
  const p = (C.freeAgents || [])[idx];
  if(!p){ logEvent('Joueur introuvable', '#e02030'); return; }

  const total = (C.players||[]).length + (C.bench||[]).length;
  const max = (typeof _careerSquadMax === 'function') ? _careerSquadMax() : 16;
  if(total >= max){ logEvent('Effectif plein ! (max ' + max + ')', '#e02030'); return; }

  wage = Math.max(1, Math.round(wage));
  years = Math.max(1, Math.min(4, Math.round(years)));

  // Prime à la signature = 4 semaines de salaire (comme en V1).
  const bonus = wage * 4;
  const budget = C.club.transferBudget || 0;
  if(bonus > budget){
    logEvent('💸 Prime à la signature : ' + _fmtMoney(bonus) + ' demandés, ' + _fmtMoney(budget) + ' disponibles.', '#e02030');
    return;
  }

  if(!canAffordWage(wage)){
    logEvent('📉 Ce salaire ferait dépasser le plafond salarial fixé par le board.', '#e02030');
    return;
  }
  const chance = contractAcceptChance(p, wage, years);
  if(!confirm('Proposer à ' + p.name + ' :\n\n' + _fmtMoney(wage) + '/semaine sur ' + years + ' an(s)\nPrime à la signature : ' + _fmtMoney(bonus) + '\n\nChances d\'acceptation : ' + Math.round(chance*100) + '%')) return;

  if(Math.random() > chance){
    // Refus : le joueur peut se braquer et quitter le marché local.
    logEvent('❌ ' + p.name + ' refuse votre offre.', '#e06060');
    if(Math.random() < 0.3){
      C.freeAgents.splice(idx, 1);
      logEvent('⌛ ' + p.name + ' signe ailleurs.', '#888');
    }
    saveCareerV2();
    try{ renderCareerDirectorTab('mercato'); }catch(e){}
    return;
  }

  C.club.transferBudget = budget - bonus;
  p.onBench = true;
  p._contractWage = wage;
  p._contractYears = years;
  if(!C.bench) C.bench = [];
  C.bench.push(p);
  C.freeAgents.splice(idx, 1);
  try{ _addFinanceLog('Prime à la signature — ' + p.name, -bonus); }catch(e){}
  logEvent('✅ ' + p.name + ' signe pour ' + years + ' an(s) (' + _fmtMoney(wage) + '/sem) !', '#18c860');
  saveCareerV2();
  try{ renderCareerDirectorTab('mercato'); }catch(e){}
}

// ═══════════════════════════════════════════════════════════
// CARRIÈRE DU MANAGER — licence, réputation, palmarès
// ═══════════════════════════════════════════════════════════
// `careerV2.manager` était déclaré avec 7 champs (name, reputation, license,
// age, history, achievements, contract) dont AUCUN n'était lu : 0 occurrence
// pour manager.license, manager.reputation, manager.age… Le commentaire
// « license: 'C',  // C → B → A → Pro » décrivait une progression entière,
// jamais implémentée. Le jeu utilisait `director_reputation` à la place.
//
// On branche donc ce qui était promis : une licence qui se gagne et qui
// conditionne les clubs pouvant vous embaucher. Sans elle, on pouvait passer
// de District à D1 sans que rien ne le justifie.

const MANAGER_LICENSES = {
  C:   { id:'C',   label:'Licence C', desc:'Amateur — District et Régional 3.',        maxLevel:'r3', xpNeeded:0   },
  B:   { id:'B',   label:'Licence B', desc:'Régional — jusqu\'en R1.',                 maxLevel:'r1', xpNeeded:120 },
  A:   { id:'A',   label:'Licence A', desc:'National — jusqu\'en D3.',                 maxLevel:'d3', xpNeeded:400 },
  PRO: { id:'PRO', label:'Licence Pro', desc:'Élite — aucun plafond.',                 maxLevel:'d1', xpNeeded:1000 },
};
const _LICENSE_ORDER = ['C','B','A','PRO'];

// Nom court et lisible d'une division, pour le palmarès.
function _divShortName(level){
  const base = String(level||'').split('_')[0];
  return ({d1:'D1', d2:'D2', d3:'D3', r1:'R1', r2:'R2', r3:'R3', dh:'District'})[base] || base.toUpperCase();
}

// Rang d'une division (0 = D1, plus le chiffre est haut, plus c'est bas).
function _levelRank(level){
  const order = ['d1','d2','d3','r1','r2','r3','dh'];
  const base = String(level||'').split('_')[0];
  const i = order.indexOf(base);
  return i < 0 ? order.length - 1 : i;
}

function _mgr(){
  const C = careerV2;
  if(!C) return null;
  if(!C.manager) C.manager = { name:'Vous', reputation:20, license:'C', age:35, history:[], achievements:[], xp:0 };
  if(C.manager.xp == null) C.manager.xp = 0;
  if(!C.manager.license) C.manager.license = 'C';
  if(!Array.isArray(C.manager.achievements)) C.manager.achievements = [];
  // Une SEULE réputation : `manager.reputation` reflète `director_reputation`
  // (la confiance réellement utilisée par le jeu). Avant, les deux existaient
  // et seule celle du director vivait — l'écran manager affichait un 20 figé.
  if(typeof C.director_reputation === 'number') C.manager.reputation = Math.round(C.director_reputation);
  return C.manager;
}

// Licence maximale atteignable avec l'XP courante.
function _licenseForXp(xp){
  let best = 'C';
  _LICENSE_ORDER.forEach(function(id){
    if(xp >= MANAGER_LICENSES[id].xpNeeded) best = id;
  });
  return best;
}

// Le manager peut-il diriger un club de ce niveau ?
function managerCanManage(level){
  const m = _mgr();
  if(!m) return true;
  const lic = MANAGER_LICENSES[m.license] || MANAGER_LICENSES.C;
  // On compare les rangs : un rang plus PETIT = division plus haute.
  return _levelRank(level) >= _levelRank(lic.maxLevel);
}

// Gain d'XP de manager. Appelé en fin de saison avec le contexte du board.
function managerAddXp(amount, reason){
  const m = _mgr();
  if(!m || !amount) return;
  m.xp = Math.max(0, Math.round((m.xp||0) + amount));
  const newLic = _licenseForXp(m.xp);
  if(newLic !== m.license && _LICENSE_ORDER.indexOf(newLic) > _LICENSE_ORDER.indexOf(m.license)){
    m.license = newLic;
    const L = MANAGER_LICENSES[newLic];
    try{
      logEvent('🎓 Vous obtenez la ' + L.label + ' ! ' + L.desc, '#f0c028');
      _mgrAchieve('license_' + newLic, '🎓 ' + L.label);
    }catch(e){}
  }
  if(reason){ try{ logEvent('📈 +' + amount + ' XP manager (' + reason + ')', '#00bcd4'); }catch(e){} }
}

// Palmarès : un fait marquant, enregistré une seule fois.
function _mgrAchieve(id, label){
  const m = _mgr();
  if(!m) return;
  if(m.achievements.some(function(a){ return a.id === id; })) return;
  m.achievements.push({ id:id, label:label, season:(careerV2.season||1) });
}

// ═══════════════════════════════════════════════════════════
// PLAFOND SALARIAL (wage_budget)
// ═══════════════════════════════════════════════════════════
// `wage_budget` (45 % du budget) était écrit dans save.js:544 et board.js:267,
// et lu NULLE PART. Rien n'empêchait de dépasser sa masse salariale : le
// plafond était une décoration. Maintenant que les salaires dépendent de la
// valeur de chaque joueur, ce plafond devient l'arbitrage central du mercato.

// Masse salariale projetée sur UNE SAISON.
// Attention au piège : le calendrier du jeu tourne sur ~8 semaines par saison,
// pas 52. Projeter les salaires hebdo sur une année civile donnait 148 % du
// plafond dès l'effectif de départ — le club aurait été en infraction avant
// même de recruter. `wage_budget` est un budget de saison : on compare donc
// une saison à une saison.
function wageBillAnnual(){
  const w = (typeof _weeklyWageBill === 'function') ? _weeklyWageBill() : 0;
  const weeks = (typeof _WEEKS_PER_SEASON !== 'undefined') ? _WEEKS_PER_SEASON : 8;
  return Math.round(w * weeks);
}
// Ratio masse/plafond. > 1 = dépassement.
function wageLoadRatio(){
  const C = careerV2;
  if(!C || !C.club) return 0;
  const cap = C.club.wage_budget || 0;
  if(cap <= 0) return 0;
  return wageBillAnnual() / cap;
}
// Le club peut-il encore absorber ce salaire hebdomadaire supplémentaire ?
function canAffordWage(extraWeekly){
  const C = careerV2;
  if(!C || !C.club) return true;
  const cap = C.club.wage_budget || 0;
  if(cap <= 0) return true;
  const weeks = (typeof _WEEKS_PER_SEASON !== 'undefined') ? _WEEKS_PER_SEASON : 8;
  return (wageBillAnnual() + Math.round((extraWeekly||0) * weeks)) <= cap * 1.10; // 10% de tolérance
}
// Vérification hebdomadaire : le board réagit au dépassement.
function _boardCheckWageBill(){
  const C = careerV2;
  if(!C || !C.club) return;
  const r = wageLoadRatio();
  if(r <= 1.10) { C._wageWarned = false; return; }
  if(C._wageWarned) return;             // une alerte par épisode de dépassement
  C._wageWarned = true;
  const over = Math.round((r - 1) * 100);
  _boardAdjust(-4, 'masse salariale dépassée de ' + over + '%', '#e06060');
  try{ logEvent('⚠️ Masse salariale dépassée de ' + over + '% — le board s\'inquiète.', '#e06060'); }catch(e){}
}

// ═══════════════════════════════════════════════════════════
// VIE DES CONTRATS (expiration, prolongation)
// ═══════════════════════════════════════════════════════════
// `_contractYears` était stocké à la signature… et jamais décompté : un
// contrat de 3 ans ne se terminait jamais. C'était un chiffre décoratif — le
// défaut exact qu'on corrige partout ailleurs. On le fait donc vivre :
// il se consomme au fil des saisons, alerte quand il touche à sa fin, puis
// libère le joueur s'il n'est pas prolongé.

// Semaines par saison (le calendrier tourne autour de ~8 semaines/saison).
const _WEEKS_PER_SEASON = 8;

// Décompte hebdomadaire (appelé par _runWeeklySystems).
function _tickContracts(){
  const C = careerV2;
  if(!C || !C.club) return;
  const squad = [].concat(C.players||[], C.bench||[]);
  squad.forEach(function(p){
    if(!p || !p._contractYears) return;
    p._contractWeeks = (p._contractWeeks == null)
      ? p._contractYears * _WEEKS_PER_SEASON
      : p._contractWeeks - 1;
    if(p._contractWeeks === 4){
      try{ logEvent('📄 Le contrat de ' + p.name + ' expire dans 4 semaines.', '#f0c028'); }catch(e){}
    }
    if(p._contractWeeks <= 0){
      _expireContract(p);
    }
  });
}

// Fin de contrat : le joueur part libre (il rejoint le vivier local, où on
// peut encore le re-signer… en négociant à nouveau).
function _expireContract(p){
  const C = careerV2;
  ['players','bench'].forEach(function(grp){
    const list = C[grp];
    if(!Array.isArray(list)) return;
    const i = list.indexOf(p);
    if(i >= 0) list.splice(i, 1);
  });
  delete p._contractWage; delete p._contractYears; delete p._contractWeeks;
  if(!C.freeAgents) C.freeAgents = [];
  C.freeAgents.push(p);
  try{ logEvent('📄 ' + p.name + ' arrive en fin de contrat et quitte le club.', '#e06060'); }catch(e){}
}

// Prolonger un contrat avant son terme (bouton dans l'effectif).
function renewContract(playerName){
  const C = careerV2;
  if(!C || !C.club) return;
  const p = [].concat(C.players||[], C.bench||[]).find(function(x){ return x && x.name === playerName; });
  if(!p){ logEvent('Joueur introuvable', '#e02030'); return; }
  const ask = (typeof contractAskingWage === 'function') ? contractAskingWage(p) : 1;
  // Prolonger coûte plus cher que signer : le joueur est en position de force.
  const wage = Math.round(ask * 1.1);
  if(!canAffordWage(wage - (p._contractWage||0))){
    logEvent('📉 Prolongation impossible : plafond salarial atteint.', '#e02030');
    return;
  }
  if(!confirm('Prolonger ' + p.name + ' de 2 ans à ' + _fmtMoney(wage) + '/sem ?')) return;
  const chance = (typeof contractAcceptChance === 'function') ? contractAcceptChance(p, wage, 2) : 0.6;
  if(Math.random() > chance){
    logEvent('❌ ' + p.name + ' refuse de prolonger pour l\'instant.', '#e06060');
    return;
  }
  p._contractWage = wage;
  p._contractYears = 2;
  p._contractWeeks = 2 * _WEEKS_PER_SEASON;
  logEvent('✅ ' + p.name + ' prolonge de 2 ans (' + _fmtMoney(wage) + '/sem).', '#18c860');
  saveCareerV2();
  try{ renderCareerV2(); }catch(e){}
}

// ═══════════════════════════════════════════════════════════
// MERCATO PNJ (les clubs adverses s'échangent des joueurs)
// ═══════════════════════════════════════════════════════════
// Vous étiez le SEUL acteur du mercato : aucune cible ne disparaissait avant
// que vous décidiez, et les effectifs adverses ne bougeaient qu'au
// vieillissement. Ici, chaque semaine, quelques clubs PNJ se volent des
// joueurs entre eux. Conséquences concrètes : une cible du marché peut
// partir ailleurs, et la hiérarchie des effectifs évolue sans vous.
function _runNpcTransfers(){
  const C = careerV2;
  if(!C || !C.opponentSquads) return;
  const names = Object.keys(C.opponentSquads).filter(function(n){
    return !C.club || n !== C.club.name;
  });
  if(names.length < 2) return;

  // 0 à 2 transferts PNJ par semaine : assez pour que le marché respire,
  // assez peu pour ne pas dissoudre les effectifs.
  const nb = Math.random() < 0.55 ? (Math.random() < 0.3 ? 2 : 1) : 0;
  for(let k = 0; k < nb; k++){
    const buyerName = names[Math.floor(Math.random() * names.length)];
    const sellerName = names[Math.floor(Math.random() * names.length)];
    if(buyerName === sellerName) continue;
    const buyer = C.opponentSquads[buyerName], seller = C.opponentSquads[sellerName];
    if(!buyer || !seller || !buyer.squad || !seller.squad) continue;

    // Un club achète chez un club de niveau égal ou inférieur (rang plus haut).
    if(_levelRank(seller.level) < _levelRank(buyer.level)) continue;

    const pool = [].concat(seller.squad.bench||[], seller.squad.reserves||[]);
    if(!pool.length) continue;
    const p = pool[Math.floor(Math.random() * pool.length)];
    if(!p) continue;
    // Le club vendeur doit garder un effectif viable…
    const sellerTotal = (seller.squad.players||[]).length + (seller.squad.bench||[]).length;
    if(sellerTotal <= 12) continue;
    // …et l'acheteur ne peut pas empiler indéfiniment : sans plafond, un club
    // gonflait à 20+ joueurs pendant qu'un autre tombait à 13.
    const buyerTotal = (buyer.squad.players||[]).length + (buyer.squad.bench||[]).length;
    if(buyerTotal >= 18) continue;

    // Transfert effectif.
    if(!_removeFromOpponentSquad(sellerName, p)) continue;
    if(!Array.isArray(buyer.squad.bench)) buyer.squad.bench = [];
    buyer.squad.bench.push(p);

    // Si le joueur était sur VOTRE marché, l'annonce disparaît : la cible
    // vous a filé sous le nez.
    if(C.mercato && Array.isArray(C.mercato.transfer_list)){
      const idx = C.mercato.transfer_list.findIndex(function(t){ return t.player === p; });
      if(idx >= 0){
        C.mercato.transfer_list.splice(idx, 1);
        try{ logEvent('⌛ ' + p.name + ' signe à ' + buyerName + ' — vous l\'avez laissé filer.', '#e06060'); }catch(e){}
      }
    }
  }
}


// Carte « Votre carrière » : licence, progression, palmarès.
function _renderManagerCard(){
  const C = careerV2;
  const m = _mgr();
  if(!m) return '';
  const lic = MANAGER_LICENSES[m.license] || MANAGER_LICENSES.C;
  const nextId = _LICENSE_ORDER[_LICENSE_ORDER.indexOf(m.license) + 1];
  const next = nextId ? MANAGER_LICENSES[nextId] : null;
  const xp = m.xp || 0;

  let h = '<div class="ccard ccard-gold">';
  h += '<div class="ccard-title">';
  h += '<span>🎓 Votre carrière</span>';
  h += '<div style="font-size:11px;font-weight:900;color:#f0c028">' + lic.label + '</div>';
  h += '</div>';
  h += '<div style="font-size:8px;color:var(--muted);margin-bottom:6px">' + lic.desc + '</div>';

  if(next){
    const span = Math.max(1, next.xpNeeded - lic.xpNeeded);
    const pct = Math.max(0, Math.min(100, Math.round((xp - lic.xpNeeded) / span * 100)));
    h += '<div style="font-size:8px;color:var(--muted);display:flex;justify-content:space-between">';
    h += '<span>' + xp + ' XP</span><span>' + next.label + ' à ' + next.xpNeeded + '</span></div>';
    h += '<div style="height:5px;background:var(--panel);border-radius:3px;overflow:hidden;margin-top:2px">';
    h += '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#f0c028,#18c860)"></div></div>';
  } else {
    h += '<div style="font-size:8px;color:#18c860">' + xp + ' XP — licence maximale atteinte.</div>';
  }

  const ach = m.achievements || [];
  if(ach.length){
    h += '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:3px">';
    ach.slice(-8).forEach(function(a){
      h += '<span style="font-size:7px;background:var(--panel);border:1px solid var(--b1);border-radius:4px;padding:2px 5px" title="Saison ' + a.season + '">' + a.label + '</span>';
    });
    h += '</div>';
  }

  // Masse salariale vs plafond du board — l'info qui manquait.
  const ratio = (typeof wageLoadRatio === 'function') ? wageLoadRatio() : 0;
  if(ratio > 0){
    const pct = Math.round(ratio * 100);
    const col = ratio > 1.1 ? '#e02030' : ratio > 0.9 ? '#f0c028' : '#18c860';
    h += '<div style="margin-top:8px;padding-top:6px;border-top:1px solid var(--b1)">';
    h += '<div style="font-size:8px;color:var(--muted);display:flex;justify-content:space-between">';
    h += '<span>Masse salariale</span><span style="color:' + col + ';font-weight:900">' + pct + '% du plafond</span></div>';
    h += '<div style="height:4px;background:var(--panel);border-radius:2px;overflow:hidden;margin-top:2px">';
    h += '<div style="height:100%;width:' + Math.min(100, pct) + '%;background:' + col + '"></div></div>';
    h += '</div>';
  }

  // ── Pécule personnel + académie du manager ─────────────────────────────
  // Le salaire du manager s'accumule ici et sert à financer SON académie.
  const wallet = m.wallet || 0;
  h += '<div style="margin-top:8px;padding-top:6px;border-top:1px solid var(--b1)">';
  h += '<div style="font-size:8px;color:var(--muted);display:flex;justify-content:space-between">';
  h += '<span>💰 Pécule personnel</span><span style="color:#f0c028;font-weight:900">' + _fmtMoney(wallet) + '</span></div>';

  const acad = C.manager_academy;
  if(!acad){
    h += '<button class="btn" onclick="openManagerAcademy()" style="width:100%;margin-top:6px;font-size:8px;padding:5px">🏫 Ouvrir mon académie (' + _fmtMoney(MANAGER_ACADEMY.openCost) + ')</button>';
    h += '<div style="font-size:7px;color:var(--muted);margin-top:2px;font-style:italic">Un centre de formation personnel, qui vous suit de club en club.</div>';
  } else {
    const nProsp = (acad.prospects||[]).length;
    h += '<div style="margin-top:6px;font-size:8px;color:var(--muted);display:flex;justify-content:space-between">';
    h += '<span>🏫 Académie niv. ' + acad.level + '</span><span>' + nProsp + ' prospect' + (nProsp>1?'s':'') + '</span></div>';
    (acad.prospects||[]).forEach(function(pr, i){
      const ov = (typeof _pOvr==='function') ? _pOvr(pr) : 40;
      h += '<div style="display:flex;align-items:center;gap:6px;font-size:8px;padding:3px 0;border-bottom:1px solid var(--b1)">';
      h += '<span style="flex:1">' + (pr.name||'?') + ' <span style="color:var(--muted)">' + (pr.pos||'') + ' · pot ' + (pr._potential||'?') + '</span></span>';
      h += '<button class="btn btng" onclick="promoteManagerProspect(' + i + ')" style="font-size:7px;padding:1px 6px">↑</button>';
      h += '</div>';
    });
    if(acad.level < MANAGER_ACADEMY.maxLevel){
      h += '<button class="btn" onclick="upgradeManagerAcademy()" style="width:100%;margin-top:4px;font-size:7px;padding:4px">⬆ Améliorer (' + _fmtMoney(MANAGER_ACADEMY.upgradeCostBase * acad.level) + ')</button>';
    }
    h += '<div style="font-size:7px;color:var(--muted);margin-top:2px">Entretien : ' + _fmtMoney(MANAGER_ACADEMY.weeklyCost) + '/sem sur le pécule.</div>';
  }
  h += '</div>';

  h += '</div>';
  return h;
}

// ═══════════════════════════════════════════════════════════
// CONTRAT DU MANAGER (salaire, objectifs personnels, offres)
// ═══════════════════════════════════════════════════════════
// `manager.contract` (salaire, durée, objectifs) et `_nomad` étaient stockés à
// l'embauche puis JAMAIS lus : le manager ne touchait pas son salaire, ses
// objectifs contractuels n'étaient jamais évalués, et une fois embauché il ne
// recevait plus d'offres. On rend tout ça vivant.

// Salaire hebdomadaire du manager, versé sur son pécule personnel (distinct du
// budget du club — c'est SON argent, pas celui du club).
function _managerWeeklyPay(){
  const C = careerV2;
  if(!C || !C.manager || !C.manager.contract) return;
  const sal = C.manager.contract.salary || 0;
  if(sal <= 0) return;
  C.manager.wallet = (C.manager.wallet || 0) + sal;
}

// Objectif personnel du contrat : évalué en fin de saison, séparément du board.
// Le tenir renforce la réputation et prolonge la confiance ; le rater
// rapproche du licenciement.
function _managerContractReview(ctx){
  const C = careerV2;
  if(!C || !C.manager || !C.manager.contract) return;
  const k = C.manager.contract;
  k.years = (k.years == null ? 2 : k.years) - 1;

  const objs = k.objectives || [];
  let met = true;
  objs.forEach(function(o){
    if(!_managerObjectiveMet(o, ctx)) met = false;
  });
  if(objs.length){
    if(met){
      managerAddXp(40, 'objectif de contrat tenu');
      _boardAdjust(6, 'objectif personnel tenu', '#18c860');
    } else {
      _boardAdjust(-6, 'objectif personnel manqué', '#e06060');
    }
  }

  if(k.years <= 0){
    // Fin de contrat : selon la confiance, le club prolonge ou vous laisse
    // partir (vous redevenez nomade, les offres reprennent).
    const conf = _boardConf();
    if(conf >= 45){
      k.years = 2;
      try{ logEvent('📄 Le club vous prolonge de 2 ans.', '#18c860'); }catch(e){}
    } else {
      C.manager.unemployed = true;
      C.manager.contract = null;
      try{ logEvent('📄 Votre contrat n\'est pas prolongé. Vous êtes libre.', '#f0c028'); }catch(e){}
    }
  }
}

function _managerObjectiveMet(o, ctx){
  if(!o || !o.type) return true;
  switch(o.type){
    case 'promotion': return !!ctx.promoted;
    case 'survive':   return !ctx.relegated;
    case 'top_half':  return ctx.total && ctx.rank && ctx.rank <= Math.ceil(ctx.total/2);
    case 'mid_table': return !ctx.relegated;
    case 'cup':       return !!ctx.cupWon;
    default:          return true;
  }
}


// ── Suivi de la série d'invincibilité (pour l'objectif 'unbeaten') ───────
function _trackUnbeaten(win, draw){
  const C = careerV2;
  if(!C) return;
  if(win || draw){
    C._curUnbeaten = (C._curUnbeaten || 0) + 1;
    C._bestUnbeaten = Math.max(C._bestUnbeaten || 0, C._curUnbeaten);
  } else {
    C._curUnbeaten = 0;
  }
}
// Meilleur tour de coupe atteint (pour 'cup_run' / 'cup_win').
function _trackCupRound(round){
  const C = careerV2;
  if(!C) return;
  C._cupBestRound = Math.max(C._cupBestRound || 0, round || 0);
}

// ═══════════════════════════════════════════════════════════
// ÉVÉNEMENTS DE SAISON
// ═══════════════════════════════════════════════════════════
// Une saison était une suite de matchs sans récit : le board sanctionnait,
// mais rien ne se PASSAIT entre les journées. On ajoute des événements
// hebdomadaires — certains à choix (dilemmes), d'autres automatiques (faits
// marquants) — qui touchent le vestiaire, les finances, la réputation ou un
// joueur. Chaque événement puise dans l'état réel du club (un vrai joueur de
// l'effectif, la trésorerie, le classement), pas dans du vide.

// Tire un joueur au hasard dans l'effectif (pour personnaliser un événement).
function _eventPickPlayer(){
  const C = careerV2;
  const squad = [].concat(C.players||[], C.bench||[]);
  if(!squad.length) return null;
  return squad[Math.floor(Math.random() * squad.length)];
}

// Applique un effet {conf, budget, morale, repute, playerStat} à l'état.
function _applyEventEffect(fx){
  const C = careerV2;
  if(!fx) return;
  if(fx.conf)   { try{ _boardAdjust(fx.conf, fx.reason || 'événement', fx.conf>0?'#18c860':'#e06060'); }catch(e){} }
  if(fx.budget) { try{ C.club.budget = (C.club.budget||0) + fx.budget; _addFinanceLog(fx.reason||'Événement', fx.budget); }catch(e){} }
  if(fx.morale) {
    // Applique un delta de moral (_fm) à tout l'effectif, borné.
    [].concat(C.players||[], C.bench||[]).forEach(function(p){
      if(p) p._fm = Math.max(-10, Math.min(10, (p._fm||0) + fx.morale));
    });
  }
  if(fx.repute && typeof C.director_reputation === 'number'){
    C.director_reputation = Math.max(0, Math.min(100, C.director_reputation + fx.repute));
  }
  if(fx.player && fx.playerStat){
    const p = fx.player, st = fx.playerStat;
    if(p.s && p.s[st.key] != null){
      p.s[st.key] = Math.max(1, Math.min(99, p.s[st.key] + st.delta));
    }
  }
}

// Catalogue d'événements. `when(C)` filtre selon l'état ; `build(C)` produit
// l'événement personnalisé (texte + choix + effets).
const SEASON_EVENTS = [
  {
    id:'locker_dispute', weight:3,
    when:function(C){ return ([].concat(C.players||[],C.bench||[])).length >= 4; },
    build:function(C){
      const p = _eventPickPlayer();
      return {
        title:'🗣️ Tension au vestiaire',
        text: p.name + ' conteste ouvertement vos choix tactiques. Le vestiaire observe votre réaction.',
        choices:[
          { label:'Le recadrer fermement', fx:{ morale:-1, conf:2, reason:'autorité affirmée' } },
          { label:'Discuter en privé',     fx:{ morale:1, reason:'apaisement' } },
          { label:'L\'ignorer',            fx:{ morale:-2, reason:'malaise persistant' } },
        ],
      };
    },
  },
  {
    id:'sponsor_bonus', weight:2,
    when:function(C){ return true; },
    build:function(C){
      const amt = Math.max(500, Math.round((C.club.budget||10000) * 0.05 / 100) * 100);
      return {
        title:'🤝 Proposition d\'un sponsor',
        text:'Une marque locale propose ' + _fmtMoney(amt) + ' en échange d\'un maillot floqué à son logo pour un match.',
        choices:[
          { label:'Accepter (' + _fmtMoney(amt) + ')', fx:{ budget:amt, repute:-1, reason:'accord sponsor' } },
          { label:'Refuser (image préservée)',          fx:{ repute:1, reason:'refus sponsor' } },
        ],
      };
    },
  },
  {
    id:'wonderkid_interest', weight:2,
    when:function(C){ return (C.youthPool||[]).length > 0; },
    build:function(C){
      const y = C.youthPool[0];
      const amt = Math.max(3000, Math.round((C.club.budget||10000)*0.15/100)*100);
      return {
        title:'👀 Un grand club s\'intéresse à votre pépite',
        text: (y.name||'Un jeune') + ' de votre académie attire l\'œil. On vous propose ' + _fmtMoney(amt) + '.',
        choices:[
          { label:'Vendre (' + _fmtMoney(amt) + ')', fx:{ budget:amt, morale:-1, reason:'vente d\'un espoir' },
            extra:function(C){ if(C.youthPool && C.youthPool.length) C.youthPool.shift(); } },
          { label:'Refuser, le garder',              fx:{ morale:1, repute:1, reason:'fidélité au projet' } },
        ],
      };
    },
  },
  {
    id:'injury_scare', weight:2,
    when:function(C){ return ([].concat(C.players||[])).length >= 3; },
    build:function(C){
      const p = _eventPickPlayer();
      return {
        title:'🏥 Alerte à l\'entraînement',
        text: p.name + ' ressent une gêne musculaire. Le staff médical est partagé.',
        choices:[
          { label:'Le ménager (repos préventif)', fx:{ reason:'prudence' },
            extra:function(){ p._injWeeks = Math.max(p._injWeeks||0, 1); p._missNextMatch = true; } },
          { label:'Le faire jouer quand même',    fx:{ conf:1, reason:'pari tenu' },
            extra:function(){ if(Math.random()<0.4){ p._injWeeks = Math.max(p._injWeeks||0, 3); p._missNextMatch = true; } } },
        ],
      };
    },
  },
  {
    id:'fan_pressure', weight:1,
    when:function(C){ return _boardConf() < 40; },
    build:function(C){
      return {
        title:'📣 Grogne des supporters',
        text:'Les résultats déçoivent. Les supporters réclament des explications.',
        choices:[
          { label:'Rassurer publiquement', fx:{ repute:1, conf:1, reason:'communication' } },
          { label:'Rester silencieux',     fx:{ conf:-2, reason:'silence mal perçu' } },
        ],
      };
    },
  },
  {
    id:'hot_streak', weight:1, auto:true,
    when:function(C){ return (C._curUnbeaten||0) >= 4; },
    build:function(C){
      return {
        title:'🔥 Série en cours !',
        text:'Votre équipe reste sur ' + C._curUnbeaten + ' matchs sans défaite. Le vestiaire est galvanisé.',
        auto:{ morale:1, conf:2, reason:'dynamique positive' },
      };
    },
  },
  {
    id:'media_rumor', weight:2,
    when:function(C){ return true; },
    build:function(C){
      const p = _eventPickPlayer();
      return {
        title:'📰 Rumeur médiatique',
        text: 'La presse affirme que ' + (p?p.name:'un cadre') + ' serait courtisé par un grand club. Comment réagir ?',
        choices:[
          { label:'Démentir fermement', fx:{ conf:1, reason:'communication maîtrisée' } },
          { label:'Ne pas commenter',   fx:{ morale:-1, reason:'flou entretenu' } },
          { label:'Avouer un intérêt', fx:{ morale:-2, budget:0, reason:'joueur déstabilisé' } },
        ],
      };
    },
  },
  {
    id:'fan_gift', weight:1,
    when:function(C){ return _boardConf() >= 50; },
    build:function(C){
      return {
        title:'🎁 Élan des supporters',
        text:'Les supporters organisent une collecte pour soutenir le club. Un joli geste.',
        choices:[
          { label:'Accepter avec gratitude', fx:{ budget:1500, morale:1, repute:1, reason:'soutien populaire' } },
          { label:'Rediriger vers l\'association du club', fx:{ repute:2, reason:'geste solidaire' } },
        ],
      };
    },
  },
  {
    id:'veteran_request', weight:1,
    when:function(C){ const sq=[].concat(C.players||[],C.bench||[]); return sq.some(function(p){return (p.age||0)>=32;}); },
    build:function(C){
      const sq=[].concat(C.players||[],C.bench||[]);
      const vet = sq.filter(function(p){return (p.age||0)>=32;})[0];
      return {
        title:'👴 Requête d\'un cadre',
        text: (vet?vet.name:'Un vétéran') + ' souhaite un rôle de mentor auprès des jeunes. Que décidez-vous ?',
        choices:[
          { label:'Accepter (il encadre les jeunes)', fx:{ morale:1, reason:'transmission' } },
          { label:'Refuser, il doit se concentrer sur le terrain', fx:{ morale:-1, reason:'demande rejetée' } },
        ],
      };
    },
  },
  {
    id:'sponsor_dispute', weight:1,
    when:function(C){ return (C.club.budget||0) > 5000; },
    build:function(C){
      const amt = Math.max(1000, Math.round((C.club.budget||10000)*0.08/100)*100);
      return {
        title:'⚖️ Litige avec un sponsor',
        text:'Un sponsor conteste une clause du contrat et menace de se retirer.',
        choices:[
          { label:'Négocier un compromis (-' + _fmtMoney(amt) + ')', fx:{ budget:-amt, repute:1, reason:'litige apaisé' } },
          { label:'Tenir bon (risque de rupture)', fx:{ conf:-1, reason:'bras de fer' } },
        ],
      };
    },
  },
  {
    id:'training_breakthrough', weight:1, auto:true,
    when:function(C){ return ([].concat(C.players||[],C.bench||[])).length >= 5; },
    build:function(C){
      const p = _eventPickPlayer();
      return {
        title:'💡 Déclic à l\'entraînement',
        text: (p?p.name:'Un joueur') + ' réalise des séances exceptionnelles. Son moral grimpe en flèche.',
        auto:{ morale:1, reason:'progression individuelle' },
      };
    },
  },
];

// Déclenche (au plus) un événement par semaine. Probabilité modérée pour ne
// pas noyer le joueur.
function _maybeSeasonEvent(){
  const C = careerV2;
  if(!C || !C.club || C.type !== 'director') return;
  if(C.pending_event) return;                 // un seul à la fois
  if(Math.random() > 0.28) return;            // ~1 semaine sur 3-4

  const eligible = SEASON_EVENTS.filter(function(e){
    try{ return e.when(C); }catch(err){ return false; }
  });
  if(!eligible.length) return;

  // Tirage pondéré.
  let totW = 0; eligible.forEach(function(e){ totW += (e.weight||1); });
  let r = Math.random() * totW, pick = eligible[0];
  for(let i=0;i<eligible.length;i++){ r -= (eligible[i].weight||1); if(r<=0){ pick = eligible[i]; break; } }

  let ev;
  try{ ev = pick.build(C); }catch(err){ return; }
  if(!ev) return;
  ev.id = pick.id;

  if(ev.auto || pick.auto){
    // Événement automatique : effet immédiat, simple notification.
    _applyEventEffect(ev.auto || {});
    try{ logEvent(ev.title + ' — ' + ev.text, '#00bcd4'); }catch(e){}
    return;
  }
  // Événement à choix : mis en attente, l'UI l'affiche et le joueur tranche.
  C.pending_event = ev;
  try{ logEvent('📌 ' + ev.title + ' — une décision vous attend.', '#f0c028'); }catch(e){}
}

// Résolution d'un choix (appelé par l'UI).
function resolveSeasonEvent(choiceIdx){
  const C = careerV2;
  if(!C || !C.pending_event) return;
  const ev = C.pending_event;
  const ch = (ev.choices || [])[choiceIdx];
  if(ch){
    _applyEventEffect(Object.assign({}, ch.fx, { }));
    if(typeof ch.extra === 'function'){ try{ ch.extra(C); }catch(e){} }
    try{ logEvent('✔️ ' + ev.title + ' : ' + ch.label, '#18c860'); }catch(e){}
  }
  C.pending_event = null;
  saveCareerV2();
  try{ renderCareerV2(); }catch(e){}
}

// Carte de l'événement en attente (dilemme à trancher).
function _renderSeasonEventCard(){
  const C = careerV2;
  if(!C || !C.pending_event) return '';
  const ev = C.pending_event;
  let h = '<div class="ccard ccard-amber">';
  h += '<div style="font-size:12px;font-weight:900;margin-bottom:4px">' + ev.title + '</div>';
  h += '<div style="font-size:10px;color:var(--fg);line-height:1.5;margin-bottom:8px">' + ev.text + '</div>';
  h += '<div style="display:flex;flex-direction:column;gap:5px">';
  (ev.choices || []).forEach(function(ch, i){
    // Aperçu de l'effet, pour que le choix soit informé.
    const hints = [];
    const fx = ch.fx || {};
    if(fx.budget) hints.push((fx.budget>0?'+':'') + _fmtMoney(fx.budget));
    if(fx.conf)   hints.push((fx.conf>0?'+':'') + fx.conf + ' confiance');
    if(fx.morale) hints.push((fx.morale>0?'moral +':'moral ') + fx.morale);
    if(fx.repute) hints.push((fx.repute>0?'+':'') + fx.repute + ' réputation');
    h += '<button class="btn" onclick="resolveSeasonEvent(' + i + ')" style="text-align:left;font-size:10px;padding:7px 10px">';
    h += '<span style="font-weight:700">' + ch.label + '</span>';
    if(hints.length) h += ' <span style="color:var(--muted);font-size:8px">(' + hints.join(' · ') + ')</span>';
    h += '</button>';
  });
  h += '</div></div>';
  return h;
}

// ═══════════════════════════════════════════════════════════
// ACADÉMIE PERSONNELLE DU MANAGER (financée par le pécule)
// ═══════════════════════════════════════════════════════════
// Le salaire du manager (manager.wallet) était crédité chaque semaine et JAMAIS
// dépensé ni affiché — un compteur fantôme. On lui donne un usage : le manager
// peut ouvrir SA propre académie de foot, avec son argent personnel. C'est une
// version « en moins bien » du centre de formation du club :
//   • le club forme des jeunes de la région, gratuitement, à haut niveau ;
//   • l'académie perso coûte cher au manager, produit moins et moins bon,
//     MAIS le suit de club en club (c'est SON académie, pas celle du club).
// Elle devient utile en carrière nomade : un patrimoine qui reste à toi.

const MANAGER_ACADEMY = {
  openCost: 15000,          // coût d'ouverture (pécule)
  weeklyCost: 300,          // entretien hebdomadaire
  upgradeCostBase: 8000,    // coût d'amélioration (× niveau)
  maxLevel: 3,
};

function _mgrAcademy(){
  const C = careerV2;
  if(!C) return null;
  return C.manager_academy || null;
}

// Ouvrir l'académie (dépense du pécule).
function openManagerAcademy(){
  const C = careerV2;
  const m = _mgr();
  if(!C || !m) return;
  if(C.manager_academy){ logEvent('Vous avez déjà une académie.', '#e06060'); return; }
  const cost = MANAGER_ACADEMY.openCost;
  if((m.wallet || 0) < cost){
    logEvent('💸 Il vous faut ' + _fmtMoney(cost) + ' de pécule personnel (vous avez ' + _fmtMoney(m.wallet||0) + ').', '#e02030');
    return;
  }
  if(!confirm('Ouvrir votre académie de foot pour ' + _fmtMoney(cost) + ' ?\n\nEntretien : ' + _fmtMoney(MANAGER_ACADEMY.weeklyCost) + '/semaine (sur votre pécule).\nElle vous suivra de club en club.')) return;
  m.wallet -= cost;
  C.manager_academy = { level: 1, prospects: [], founded: C.season || 1 };
  logEvent('🏫 Votre académie de foot ouvre ses portes !', '#18c860');
  _mgrAchieve('academy_open', '🏫 Fondateur d\'académie');
  saveCareerV2();
  try{ renderCareerV2(); }catch(e){}
}

// Améliorer l'académie (meilleur potentiel des prospects).
function upgradeManagerAcademy(){
  const C = careerV2;
  const m = _mgr();
  const a = _mgrAcademy();
  if(!C || !m || !a) return;
  if(a.level >= MANAGER_ACADEMY.maxLevel){ logEvent('Académie déjà au niveau maximum.', '#e06060'); return; }
  const cost = MANAGER_ACADEMY.upgradeCostBase * a.level;
  if((m.wallet || 0) < cost){
    logEvent('💸 Amélioration : ' + _fmtMoney(cost) + ' requis.', '#e02030');
    return;
  }
  if(!confirm('Améliorer l\'académie au niveau ' + (a.level+1) + ' pour ' + _fmtMoney(cost) + ' ?')) return;
  m.wallet -= cost;
  a.level++;
  logEvent('🏫 Académie améliorée au niveau ' + a.level + ' !', '#18c860');
  saveCareerV2();
  try{ renderCareerV2(); }catch(e){}
}

// Entretien hebdomadaire + production de prospects (appelé chaque semaine).
function _tickManagerAcademy(){
  const C = careerV2;
  const m = _mgr();
  const a = _mgrAcademy();
  if(!C || !m || !a) return;

  // Entretien proportionnel au niveau du club : un manager amateur gagne peu,
  // son académie doit rester abordable. On indexe sur le salaire du contrat
  // (≈ ce qu'il touche), plafonné par le coût de référence.
  const sal = (m.contract && m.contract.salary) || 0;
  const upkeep = Math.max(40, Math.min(MANAGER_ACADEMY.weeklyCost, Math.round(sal * 0.3)));
  m.wallet = (m.wallet || 0) - upkeep;
  if(m.wallet < 0){
    m.wallet = 0;
    C.manager_academy = null;
    try{ logEvent('🏫 Faute de moyens, votre académie a fermé.', '#e06060'); }catch(e){}
    return;
  }

  // Production : rare, et bien plus faible que le centre du club.
  // ~1 prospect toutes ~6 semaines, plafonné à 4 en réserve.
  if((a.prospects||[]).length >= 4) return;
  if(Math.random() > 0.16 + a.level * 0.04) return;

  try{
    const nation = C.nation || 'panthalassa';
    const region = (C.club && C.club.region) || 'r';
    const positions = ['MC','ATT','DC','DD','MC'];
    const pos = positions[Math.floor(Math.random()*positions.length)];
    const p = WORLDS.generatePlayer(nation, region, pos, null, 'dh');
    if(!p) return;
    // Potentiel PLUS FAIBLE que le club (base 10-25 + petit bonus de niveau,
    // contre 15-45 pour le club). C'est la version « en moins bien ».
    let pot = 10 + Math.floor(Math.random()*15) + a.level*3;
    // Chance très faible d'un bon potentiel (bien moindre que le club).
    if(Math.random() < 0.003 * a.level){
      pot = 45 + Math.floor(Math.random()*15);
      try{ logEvent('⭐ Un prospect prometteur émerge de votre académie !', '#f0c028'); }catch(e){}
    }
    p._potential = Math.min(80, pot);
    p._age = 15 + Math.floor(Math.random()*3);
    p._isYouth = true;
    p._fromMgrAcademy = true;
    a.prospects.push(p);
  }catch(e){}
}

// Faire monter un prospect de l'académie perso dans l'effectif du club.
function promoteManagerProspect(idx){
  const C = careerV2;
  const a = _mgrAcademy();
  if(!C || !a) return;
  const p = (a.prospects||[])[idx];
  if(!p) return;
  const total = (C.players||[]).length + (C.bench||[]).length;
  const max = (typeof _careerSquadMax === 'function') ? _careerSquadMax() : 18;
  if(total >= max){ logEvent('Effectif plein !', '#e02030'); return; }
  p.onBench = true;
  if(!C.bench) C.bench = [];
  C.bench.push(p);
  a.prospects.splice(idx, 1);
  if(C) C._youthPromotedThisSeason = (C._youthPromotedThisSeason || 0) + 1;
  logEvent('🎓 ' + p.name + ' rejoint l\'effectif depuis votre académie !', '#18c860');
  saveCareerV2();
  try{ renderCareerV2(); }catch(e){}
}

// ═══════════════════════════════════════════════════════════
// RIVALITÉS
// ═══════════════════════════════════════════════════════════
// Une saison n'avait aucun match qui compte PLUS qu'un autre. On désigne un
// club rival au sein de la division : les matchs contre lui portent un enjeu
// accru (moral, confiance du board, réputation selon le résultat) et
// alimentent la presse. Un embryon existait déjà (event 'derby_fervor' dans
// Rorang) — on en fait un vrai système.
//
// Le rival est choisi une fois par saison, de préférence un club de niveau
// proche (un « voisin » au classement, pas le plus faible ni le plus fort),
// et il PERSISTE d'une saison à l'autre tant qu'on reste dans la même division
// (une rivalité se construit dans la durée).

function _assignRival(){
  const C = careerV2;
  if(!C || !C.standings || C.type !== 'director') return;
  const others = C.standings.filter(function(s){ return !s.isPlayer; });
  if(!others.length){ C.rival = null; return; }

  // Rivalité persistante : si le rival actuel est toujours dans la division,
  // on le garde (la rivalité s'ancre dans le temps).
  if(C.rival){
    const still = others.find(function(s){ return s.id === C.rival.id || s.name === C.rival.name; });
    if(still){
      C.rival = { id:still.id, name:still.name, color:still.color||C.rival.color, badge:still.badge||C.rival.badge,
                  intensity:C.rival.intensity || 1, since:C.rival.since || C.season, wins:C.rival.wins||0, losses:C.rival.losses||0, draws:C.rival.draws||0 };
      return;
    }
  }

  // Nouveau rival : un club au hasard, pondéré vers ceux de force proche.
  // On n'a pas encore de résultats cette saison, donc on tire simplement un
  // adversaire, en évitant de reprendre un ancien rival juste quitté.
  const pool = others.filter(function(s){ return !C._exRival || s.name !== C._exRival; });
  const pick = (pool.length ? pool : others)[Math.floor(Math.random() * (pool.length ? pool.length : others.length))];
  C.rival = { id:pick.id, name:pick.name, color:pick.color||'#e02030', badge:pick.badge||null,
              intensity:1, since:C.season, wins:0, losses:0, draws:0 };
  try{ logEvent('🔥 Nouvelle rivalité : ' + pick.name + ' devient votre rival de la saison.', '#e02030'); }catch(e){}
}

// Un fixture oppose-t-il le joueur à son rival ?
function isRivalFixture(fix){
  const C = careerV2;
  if(!C || !C.rival || !fix) return false;
  const oppId = fix.homeIsPlayer ? fix.away : fix.home;
  const oppName = fix.homeIsPlayer ? fix.awayName : fix.homeName;
  return oppId === C.rival.id || oppName === C.rival.name;
}

// Résultat d'un derby : enjeu accru. Appelé après un match du joueur si
// l'adversaire est le rival.
function _resolveRivalResult(myG, oppG){
  const C = careerV2;
  if(!C || !C.rival) return;
  const r = C.rival;
  // L'intensité (1..5) module l'enjeu : plus la rivalité est chargée, plus le
  // résultat pèse. Un premier derby bouge peu ; un derby au sommet d'années de
  // rivalité fait basculer une saison. Facteur 1.0 (intensité 1) à 1.8 (5).
  const intens = Math.max(1, Math.min(5, r.intensity || 1));
  const mult = 1 + (intens - 1) * 0.2;
  const confSwing = Math.round(6 * mult);
  const moraleSwing = Math.round(2 * mult);
  if(myG > oppG){
    r.wins = (r.wins||0) + 1;
    r.intensity = Math.min(5, intens + 1);
    _boardAdjust(confSwing, 'victoire dans le derby contre ' + r.name, '#18c860');
    if(typeof C.director_reputation === 'number') C.director_reputation = Math.min(100, C.director_reputation + Math.round(3 * mult));
    [].concat(C.players||[], C.bench||[]).forEach(function(p){ if(p) p._fm = Math.min(10, (p._fm||0) + moraleSwing); });
    const intro = intens >= 4 ? '🔥🔥 DERBY AU SOMMET — ' : '🔥 ';
    try{ logEvent(intro + 'Vous dominez ' + r.name + ' ! Le vestiaire exulte (+' + confSwing + ' confiance).', '#18c860'); }catch(e){}
    _mgrAchieve('derby_win_' + r.name, '🔥 Bourreau de ' + r.name);
  } else if(myG < oppG){
    r.losses = (r.losses||0) + 1;
    r.intensity = Math.min(5, intens + 1);
    _boardAdjust(-confSwing, 'défaite dans le derby contre ' + r.name, '#e06060');
    if(typeof C.director_reputation === 'number') C.director_reputation = Math.max(0, C.director_reputation - Math.round(2 * mult));
    [].concat(C.players||[], C.bench||[]).forEach(function(p){ if(p) p._fm = Math.max(-10, (p._fm||0) - moraleSwing); });
    const intro = intens >= 4 ? '💔💔 DÉROUTE DANS LE DERBY AU SOMMET — ' : '💔 ';
    try{ logEvent(intro + 'Défaite contre ' + r.name + '. Le vestiaire est abattu (-' + confSwing + ' confiance).', '#e06060'); }catch(e){}
  } else {
    r.draws = (r.draws||0) + 1;
    try{ logEvent('🤝 Match nul dans le derby contre ' + r.name + '.', '#f0c028'); }catch(e){}
  }
}

// Carte rivalité (affichée dans la Vue). Montre le rival et le bilan.
function _renderRivalCard(){
  const C = careerV2;
  if(!C || !C.rival) return '';
  const r = C.rival;
  const flames = '🔥'.repeat(Math.max(1, Math.min(5, r.intensity||1)));
  // Prochain derby ?
  let nextDerby = null;
  (C.fixtures || []).forEach(function(f){
    if(!f.played && isRivalFixture(f) && nextDerby === null) nextDerby = f.week;
  });
  let h = '<div class="ccard ccard-red">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px">';
  h += '<div style="font-size:10px;font-weight:700;color:#e02030">' + flames + ' Rival : <b style="color:var(--fg)">' + r.name + '</b></div>';
  h += '<div style="font-size:8px;color:var(--muted)">depuis S' + (r.since||C.season) + '</div>';
  h += '</div>';
  const tot = (r.wins||0)+(r.losses||0)+(r.draws||0);
  if(tot){
    h += '<div style="font-size:8px;color:var(--muted);margin-top:3px">Bilan : <span style="color:#18c860">' + (r.wins||0) + 'V</span> · <span style="color:#f0c028">' + (r.draws||0) + 'N</span> · <span style="color:#e06060">' + (r.losses||0) + 'D</span></div>';
  }
  if(nextDerby !== null){
    h += '<div style="font-size:9px;color:#e08040;margin-top:4px;font-weight:700">⚔️ Prochain derby : journée ' + nextDerby + '</div>';
  }
  h += '</div>';
  return h;
}

// ═══════════════════════════════════════════════════════════
// PRESSE
// ═══════════════════════════════════════════════════════════
// Le board sanctionnait, les événements survenaient, mais rien ne RACONTAIT la
// saison. On ajoute une couche de presse : après les matchs marquants (gros
// score, derby, série, exploit ou humiliation), un titre est généré et archivé.
// C.press garde les derniers titres, affichés dans la Vue — la carrière devient
// un récit, pas une suite de résultats.

function _pressAdd(headline, tone){
  const C = careerV2;
  if(!C) return;
  if(!Array.isArray(C.press)) C.press = [];
  C.press.unshift({ text:headline, tone:tone||'neutral', week:C.week||0, season:C.season||1 });
  if(C.press.length > 12) C.press.length = 12;  // on garde les 12 derniers
}

// Génère (ou non) un titre après un match du joueur.
function _pressAfterMatch(fix, myG, oppG){
  const C = careerV2;
  if(!C || !C.club) return;
  const club = C.club.name;
  const oppName = fix.homeIsPlayer ? fix.awayName : fix.homeName;
  const diff = myG - oppG;
  const isDerby = (typeof isRivalFixture==='function') && isRivalFixture(fix);
  const streak = C._curUnbeaten || 0;

  // Priorité au derby (le plus « racontable »).
  if(isDerby){
    const pk = function(a){ return a[Math.floor(Math.random()*a.length)]; };
    if(diff > 0)      _pressAdd(pk([
      '🔥 DERBY — ' + club + ' fait tomber ' + oppName + ' (' + myG + '-' + oppG + ') !',
      '🔥 ' + club + ' remporte le choc face à ' + oppName + ' (' + myG + '-' + oppG + ')',
      '🔥 Derby maîtrisé : ' + club + ' domine ' + oppName + ' ' + myG + '-' + oppG ]), 'good');
    else if(diff < 0) _pressAdd(pk([
      '💔 DERBY — ' + oppName + ' humilie ' + club + ' (' + oppG + '-' + myG + ')',
      '💔 ' + club + ' tombe dans le derby face à ' + oppName + ' (' + oppG + '-' + myG + ')',
      '💔 Désillusion : ' + club + ' s incline dans le derby (' + oppG + '-' + myG + ')' ]), 'bad');
    else              _pressAdd(pk([
      '🤝 DERBY — ' + club + ' et ' + oppName + ' se neutralisent (' + myG + '-' + oppG + ')',
      '🤝 Derby indécis : ' + club + ' et ' + oppName + ' dos à dos (' + myG + '-' + oppG + ')' ]), 'neutral');
    return;
  }
  // Résultats marquants uniquement (on ne commente pas chaque match anodin).
  if(diff >= 4){
    _pressAdd(([
      '🎉 Démonstration : ' + club + ' écrase ' + oppName + ' ' + myG + '-' + oppG + ' !',
      '🎉 Récital offensif : ' + club + ' balaie ' + oppName + ' ' + myG + '-' + oppG,
      '🎉 ' + club + ' passe ' + myG + ' buts à ' + oppName + ' et régale ses supporters' ])[Math.floor(Math.random()*3)], 'good');
  } else if(diff <= -4){
    _pressAdd(([
      '😱 Naufrage : ' + club + ' sombre ' + oppG + '-' + myG + ' face à ' + oppName + '.',
      '😱 Soirée noire : ' + club + ' encaisse ' + oppG + ' buts contre ' + oppName,
      '😱 ' + club + ' humilié ' + oppG + '-' + myG + ', la crise couve' ])[Math.floor(Math.random()*3)], 'bad');
  } else if(streak === 5){
    _pressAdd('📈 En feu : ' + club + ' reste sur 5 matchs sans défaite.', 'good');
  } else if(streak >= 8 && diff >= 0){
    _pressAdd('🚀 ' + club + ' impressionne : ' + streak + ' matchs sans perdre !', 'good');
  } else if(diff > 0 && Math.random() < 0.15){
    _pressAdd('✅ ' + club + ' s\'impose ' + myG + '-' + oppG + ' contre ' + oppName + '.', 'good');
  } else if(diff < 0 && Math.random() < 0.15){
    _pressAdd('❌ ' + club + ' chute ' + oppG + '-' + myG + ' à ' + oppName + '.', 'bad');
  }
}

// Titres liés aux temps forts hors match (transferts, board, événements).
function _pressEvent(headline, tone){ _pressAdd(headline, tone); }

// ── RÉSEAUX SOCIAUX ──────────────────────────────────────────────────────
// La presse donne des TITRES officiels et posés. Les réseaux sociaux, eux,
// sont la voix des supporters : plus courts, plus vifs, plus émotionnels. On
// les tient dans un fil SÉPARÉ (C.social) avec son propre affichage.
function _socialAdd(text, tone){
  const C = careerV2;
  if(!C) return;
  if(!Array.isArray(C.social)) C.social = [];
  // Profils de supporters : pseudo affiché + @handle + graine d'avatar.
  const profiles = [
    { name:'Ultra du Kop',     handle:'@ultra_'+(C.club?.name||'fc').toLowerCase().replace(/[^a-z]/g,'').slice(0,6) },
    { name:'Tribune Sud',      handle:'@tribune_sud' },
    { name:'Marco',            handle:'@supporter71' },
    { name:'FootFan',          handle:'@footfan_' },
    { name:'Kop Officiel',     handle:'@kop_officiel' },
    { name:'Le 12ème Homme',   handle:'@le12emehomme' },
    { name:'Sophie',           handle:'@sosoft_' },
    { name:'Le Consultant',    handle:'@tacticoo' },
  ];
  const prof = profiles[Math.floor(Math.random()*profiles.length)];
  // Engagement pseudo-réaliste, plus fort quand le ton est marqué.
  const heat = tone==='good'?1.6 : tone==='bad'?1.4 : 1.0;
  const likes = Math.round((20 + Math.random()*480) * heat);
  const reposts = Math.round(likes * (0.05 + Math.random()*0.15));
  const comments = Math.round(likes * (0.03 + Math.random()*0.1));
  C.social.unshift({
    who: prof.handle, name: prof.name,
    avatar: (prof.handle.charCodeAt(1)+prof.handle.length) % 8, // graine 0-7 pour la couleur
    text: text, tone: tone||'neutral',
    likes: likes, reposts: reposts, comments: comments,
    week: C.week||0, season: C.season||1,
  });
  if(C.social.length > 30) C.social.length = 30;   // on garde un fil plus long pour l'onglet
}

// Réactions des supporters après un match (ton tranché selon le résultat).
function _socialAfterMatch(fix, myG, oppG){
  const C = careerV2;
  if(!C || !C.club) return;
  const diff = myG - oppG;
  const isDerby = (typeof isRivalFixture==='function') && isRivalFixture(fix);
  if(isDerby){
    const pick0 = function(arr){ return arr[Math.floor(Math.random()*arr.length)]; };
    const oppN = (fix.homeIsPlayer ? fix.awayName : fix.homeName) || 'l adversaire';
    if(diff > 0)      _socialAdd(pick0([
      'ON A GAGNÉ LE DERBY 🔥🔥🔥 quelle soirée les gars !!!',
      'LE DERBY EST À NOUS 😤💪 personne ne nous marche dessus',
      'battre ' + oppN + ' dans le derby, rien de meilleur 🔥',
      'j ai perdu ma voix mais on a gagné le derby, ça vaut le coup 🗣️❤️' ]), 'good');
    else if(diff < 0) _socialAdd(pick0([
      'perdre le derby... j ai pas de mots. honteux 😤',
      'comment on peut perdre CE match... inadmissible 😡',
      'le derby perdu, je vais pas dormir cette nuit 💔',
      'humiliés dans notre propre derby. le coach doit s expliquer.' ]), 'bad');
    else              _socialAdd(pick0([
      'nul dans le derby, frustrant mais on lâche rien 💪',
      'un partout dans le derby, on prend le point et on avance',
      'le derby se finit sur un nul, tension jusqu au bout ⚔️' ]), 'neutral');
    return;
  }
  const pickS = function(arr){ return arr[Math.floor(Math.random()*arr.length)]; };
  const oppNm = (fix.homeIsPlayer ? fix.awayName : fix.homeName) || 'l adversaire';
  if(diff >= 3)       _socialAdd(pickS([
    'MAIS QUELLE ÉQUIPE 🤩 ' + myG + '-' + oppG + ' on les a détruits',
    'démonstration totale 🔥 ' + myG + '-' + oppG + ', on régale',
    'c était un match ou un entraînement ? 😂 ' + myG + '-' + oppG,
    'pauvre ' + oppNm + ', on leur a mis ' + myG + ' buts 🙈' ]), 'good');
  else if(diff <= -3) _socialAdd(pickS([
    oppG + '-' + myG + '... on a touché le fond là. ça suffit 😡',
    'une honte pareille ' + oppG + '-' + myG + ', remboursez les billets 🎫',
    'je suis fan depuis 20 ans et là j ai mal 💔 ' + oppG + '-' + myG,
    'zéro envie, zéro jeu. ' + oppG + '-' + myG + ', ça devient grave.' ]), 'bad');
  else if(diff > 0 && Math.random()<0.5)  _socialAdd(pickS([
    '3 points de plus 👏 allez on continue !',
    'victoire propre contre ' + oppNm + ', on monte 📈',
    'pas flamboyant mais efficace, +3 points 💪',
    'on gagne et c est tout ce qui compte ✅' ]), 'good');
  else if(diff < 0 && Math.random()<0.5)  _socialAdd(pickS([
    'encore une défaite, ça devient compliqué 😔',
    'battus par ' + oppNm + '... faut réagir vite ⚠️',
    'on n y arrive plus en ce moment, inquiétant 😟',
    'match après match c est pareil. il faut du changement.' ]), 'bad');
  else if(diff === 0 && Math.random()<0.4) _socialAdd(pickS([
    'un nul... bof. on voulait les 3 points',
    'match nul contre ' + oppNm + ', on laisse filer des points 😕',
    'toujours ce manque de réalisme, 0-0 frustrant',
    'un point de pris, on fera avec 🤷' ]), 'neutral');
}

// (Ancienne carte « Réseaux sociaux » retirée : le fil complet vit maintenant
//  dans l'onglet « Z », avec un aperçu compact en Vue via _renderSocialTeaser.)

// Carte presse (les 4 derniers titres).
function _renderPressCard(){
  const C = careerV2;
  if(!C || !Array.isArray(C.press) || !C.press.length) return '';
  let h = '<div class="ccard">';
  h += '<div class="ccard-title">📰 La presse en parle</div>';
  C.press.slice(0, 4).forEach(function(p){
    const col = p.tone==='good' ? '#18c860' : p.tone==='bad' ? '#e06060' : 'var(--muted)';
    h += '<div style="font-size:9px;color:var(--fg);padding:4px 0;border-bottom:1px solid var(--b1);line-height:1.4">';
    h += '<span style="color:' + col + '">▍</span> ' + p.text;
    h += ' <span style="font-size:7px;color:var(--muted)">S' + p.season + ' J' + p.week + '</span>';
    h += '</div>';
  });
  h += '</div>';
  return h;
}

// ═══════════════════════════════════════════════════════════
// RÔLE DE CARRIÈRE : dirigeant vs manager (entraîneur)
// ═══════════════════════════════════════════════════════════
// En unifiant les deux carrières, on avait fait du « manager » une simple
// couche cosmétique par-dessus le mode dirigeant : un manager voyait et
// contrôlait TOUT (infrastructures, sponsors, finances d'investissement),
// ce qui n'a pas de sens. Un manager dirige une ÉQUIPE (le sportif :
// effectif, tactique, entraînement, recrutement sportif) ; les
// infrastructures, les sponsors et le budget d'investissement relèvent des
// DIRIGEANTS, à qui il doit faire des demandes.
//
// On introduit donc un rôle explicite :
//   • careerV2.role === 'director' → contrôle total du club.
//   • careerV2.role === 'manager'  → périmètre sportif uniquement.
// (Rétrocompat : sans role, on retombe sur l'ancien type.)

function _careerRole(){
  const C = careerV2;
  if(!C) return 'director';
  if(C.role) return C.role;
  // Migration douce : une carrière lancée en mode manager (nomade) devient
  // un manager ; sinon dirigeant.
  return C._nomad ? 'manager' : 'director';
}
function _isManager(){ return _careerRole() === 'manager'; }

// Onglets accessibles selon le rôle. Un manager n'a pas la main sur les
// infrastructures, les sponsors, ni les finances d'investissement du club.
const _MANAGER_TABS = ['overview','squad','mercato','academy','staff','calendar','scorers','history'];
function _tabAllowed(tab){
  if(!_isManager()) return true;                 // dirigeant : tout
  return _MANAGER_TABS.indexOf(tab) >= 0;
}

// Périmètre d'équipe : un manager peut être nommé à la 1re équipe ou à une
// réserve. `teamScope` = 'first' | 'reserve'. Sert au titre et, plus tard, à
// restreindre le vivier géré.
function _teamScopeLabel(){
  const C = careerV2;
  if(!C || !C.teamScope || C.teamScope === 'first') return '';
  return ' (Équipe réserve)';
}

// ═══════════════════════════════════════════════════════════
// DEMANDES AUX DIRIGEANTS (mode manager)
// ═══════════════════════════════════════════════════════════
// Un manager ne décide pas des investissements : il les DEMANDE aux dirigeants,
// qui acceptent ou refusent selon la confiance qu'ils lui portent et l'état des
// finances. Cela remplace le contrôle direct des infrastructures / du budget.

const BOARD_REQUESTS = {
  infra:   { label:'Améliorer une infrastructure', desc:'Demander aux dirigeants d\'investir dans le centre d\'entraînement.' },
  budget:  { label:'Renforcer le budget transferts', desc:'Demander une rallonge pour recruter.' },
  wages:   { label:'Relever le plafond salarial', desc:'Demander une marge salariale supplémentaire.' },
};

// Chance d'acceptation d'une demande : dominée par la confiance du board.
function _boardRequestChance(kind){
  const conf = _boardConf();              // 0..100
  let base = (conf - 30) / 70;            // 30 → 0%, 100 → 100%
  // Les demandes coûteuses sont plus dures à obtenir.
  if(kind === 'infra')  base -= 0.15;
  if(kind === 'budget') base -= 0.10;
  return Math.max(0.05, Math.min(0.95, base));
}

// Le manager soumet une demande. Résolue immédiatement (les dirigeants
// tranchent), avec un effet concret en cas d'accord.
function submitBoardRequest(kind){
  const C = careerV2;
  if(!C || !C.club) return;
  if(!_isManager()){ return; }            // les dirigeants agissent directement
  // Une demande par semaine, pour éviter le spam.
  if(C._boardRequestWeek === C.week){
    logEvent('Vous avez déjà sollicité les dirigeants cette semaine.', '#e06060');
    return;
  }
  C._boardRequestWeek = C.week;

  const chance = _boardRequestChance(kind);
  const ok = Math.random() < chance;
  if(!ok){
    logEvent('🏛 Les dirigeants déclinent votre demande pour l\'instant.', '#e06060');
    _boardAdjust(-1, 'demande refusée', '#e06060');
    saveCareerV2(); try{ renderCareerV2(); }catch(e){}
    return;
  }

  if(kind === 'infra'){
    // Les dirigeants améliorent une infra au hasard (c'est LEUR décision).
    const infra = C.club.infra || (C.club.infra = {});
    const keys = ['stadium','training','formation','medical','scout'];
    const pick = keys[Math.floor(Math.random()*keys.length)];
    infra[pick] = Math.min(5, (infra[pick]||0) + 1);
    logEvent('🏛 Les dirigeants investissent : ' + pick + ' amélioré au niveau ' + infra[pick] + ' !', '#18c860');
    try{ _pressEvent('🏗️ ' + C.club.name + ' investit dans ses infrastructures.', 'good'); }catch(e){}
  } else if(kind === 'budget'){
    const add = Math.max(1000, Math.round((C.club.budget||10000) * 0.15 / 100) * 100);
    C.club.transferBudget = (C.club.transferBudget||0) + add;
    logEvent('🏛 Les dirigeants débloquent ' + _fmtMoney(add) + ' pour le mercato !', '#18c860');
  } else if(kind === 'wages'){
    const add = Math.max(500, Math.round((C.club.wage_budget||10000) * 0.12 / 100) * 100);
    C.club.wage_budget = (C.club.wage_budget||0) + add;
    logEvent('🏛 Plafond salarial relevé de ' + _fmtMoney(add) + '.', '#18c860');
  }
  saveCareerV2(); try{ renderCareerV2(); }catch(e){}
}

// Carte « Demandes aux dirigeants » (affichée uniquement en mode manager).
function _renderBoardRequestsCard(){
  if(!_isManager()) return '';
  const C = careerV2;
  const done = (C._boardRequestWeek === C.week);
  let h = '<div class="ccard ccard-blue">';
  h += '<div class="ccard-title">🏛 Demandes aux dirigeants</div>';
  h += '<div class="ctxt-xs" style="margin-bottom:6px">En tant qu\'entraîneur, vous ne décidez pas des investissements : vous les sollicitez. Les dirigeants tranchent selon leur confiance.</div>';
  if(done){
    h += '<div class="ctxt-sm" style="color:#f0c028">Demande déjà soumise cette semaine.</div>';
  } else {
    Object.keys(BOARD_REQUESTS).forEach(function(k){
      const req = BOARD_REQUESTS[k];
      const ch = Math.round(_boardRequestChance(k) * 100);
      const col = ch>=60?'#18c860':ch>=35?'#f0c028':'#e06060';
      h += '<button class="btn" onclick="submitBoardRequest(\'' + k + '\')" style="width:100%;text-align:left;margin-bottom:4px;font-size:9px;padding:6px 8px">';
      h += '<span style="font-weight:700">' + req.label + '</span> <span style="color:' + col + '">(' + ch + '%)</span>';
      h += '</button>';
    });
  }
  h += '</div>';
  return h;
}

// ═══════════════════════════════════════════════════════════
// INTERVIEWS INTERACTIVES
// ═══════════════════════════════════════════════════════════
// Après un match marquant, un journaliste vous tend le micro. Votre réponse
// (parmi plusieurs tons) a des conséquences RÉELLES : moral du vestiaire,
// confiance du board, réputation, et surtout une réaction de la PRESSE et des
// RÉSEAUX. C'est un pont entre le jeu et l'immersion narrative demandée.

// Banques de questions selon le contexte du dernier match.
function _interviewQuestions(ctx){
  // ctx = { result:'win'|'loss'|'draw', diff, oppName, streak, isDerby }
  const Q = [];
  if(ctx.isDerby && ctx.result==='win'){
    Q.push({
      q:'Vous venez de remporter le derby. Un mot pour vos supporters ?',
      opts:[
        { label:'« Ce soir, la ville est à nous ! »', fx:{morale:2,repute:1}, press:'good', tweet:'good', ptext:'🎙️ Le coach enflamme les supporters après le derby.', ttext:'LE COACH A DIT CE SOIR LA VILLE EST À NOUS 🔥 LÉGENDE' },
        { label:'« Respect à l\'adversaire, mais on méritait. »', fx:{repute:2,conf:1}, press:'good', tweet:'neutral', ptext:'🎙️ Un discours humble et maîtrisé après la victoire.', ttext:'classe du coach en interview, respect 👏' },
        { label:'« Ils n\'ont jamais existé sur le terrain. »', fx:{morale:1,repute:-1}, press:'neutral', tweet:'good', ptext:'🎙️ Le coach provoque le rival après le derby.', ttext:'ahaha le coach a chambré le rival 😂😂' },
      ],
    });
  } else if(ctx.result==='loss' && ctx.diff<=-3){
    Q.push({
      q:'Lourde défaite ce soir. Comment l\'expliquez-vous ?',
      opts:[
        { label:'« J\'assume tout, c\'est ma responsabilité. »', fx:{repute:2,conf:1,morale:1}, press:'good', tweet:'good', ptext:'🎙️ Le coach assume publiquement la défaite.', ttext:'au moins le coach assume, respect 🙏' },
        { label:'« Mes joueurs n\'ont pas répondu présents. »', fx:{morale:-2,conf:-1}, press:'bad', tweet:'bad', ptext:'🎙️ Le coach pointe ses joueurs du doigt.', ttext:'le coach balance ses joueurs en public... ambiance 😬' },
        { label:'« L\'arbitrage a tout faussé. »', fx:{repute:-1,conf:-1}, press:'neutral', tweet:'neutral', ptext:'🎙️ Le coach conteste l\'arbitrage.', ttext:'encore les arbitres hein 🙄' },
      ],
    });
  } else if(ctx.result==='win'){
    Q.push({
      q:'Belle victoire. Sur quoi allez-vous travailler maintenant ?',
      opts:[
        { label:'« Rester humble et bosser dur. »', fx:{repute:1,conf:1}, press:'good', tweet:'neutral', ptext:'🎙️ Le coach garde les pieds sur terre.', ttext:'coach sérieux, on aime ce discours 👍' },
        { label:'« Viser le titre, pourquoi pas ! »', fx:{morale:1,conf:-1}, press:'good', tweet:'good', ptext:'🎙️ Le coach affiche de grandes ambitions.', ttext:'le coach parle de TITRE 👀🔥 on y croit' },
        { label:'« Un match à la fois. »', fx:{conf:1}, press:'neutral', tweet:'neutral', ptext:'🎙️ Le coach reste prudent.', ttext:'un match à la fois, classique du coach 😴' },
      ],
    });
  } else if(ctx.streak>=3 && ctx.result!=='loss'){
    Q.push({
      q:'Votre équipe est en pleine forme. Le secret ?',
      opts:[
        { label:'« Le travail, rien d\'autre. »', fx:{conf:1,repute:1}, press:'good', tweet:'neutral', ptext:'🎙️ Le coach crédite le travail du groupe.', ttext:'humble et efficace, ce coach 💪' },
        { label:'« On est les meilleurs, c\'est tout. »', fx:{morale:1,repute:-1}, press:'neutral', tweet:'good', ptext:'🎙️ Le coach affiche une confiance débordante.', ttext:'la confiance du coach 😂 j\'adore' },
      ],
    });
  } else {
    // Question générique (nul ou petite défaite/victoire).
    Q.push({
      q:'Que retenez-vous de ce match ?',
      opts:[
        { label:'« Du positif à confirmer. »', fx:{conf:1}, press:'neutral', tweet:'neutral', ptext:'🎙️ Le coach reste mesuré.', ttext:'RAS côté coach 🤷' },
        { label:'« On doit faire beaucoup mieux. »', fx:{morale:-1,conf:1}, press:'neutral', tweet:'neutral', ptext:'🎙️ Le coach hausse le ton.', ttext:'le coach pas content, ça va secouer à l\'entraînement 😅' },
      ],
    });
  }
  return Q[Math.floor(Math.random()*Q.length)];
}

// Déclenche une interview après un match marquant (~35% des matchs notables).
function _maybeInterview(fix, myG, oppG){
  const C = careerV2;
  if(!C || !C.club || C.pending_interview) return;
  const diff = myG - oppG;
  const isDerby = (typeof isRivalFixture==='function') && isRivalFixture(fix);
  const notable = isDerby || Math.abs(diff)>=3 || (C._curUnbeaten||0)>=3;
  if(!notable && Math.random()>0.15) return;    // matchs ordinaires : rare
  if(!isDerby && Math.abs(diff)<3 && Math.random()>0.5) return;
  const ctx = {
    result: diff>0?'win':diff<0?'loss':'draw', diff:diff,
    oppName:(fix.homeIsPlayer?fix.awayName:fix.homeName)||'l adversaire',
    streak:C._curUnbeaten||0, isDerby:isDerby,
  };
  const iv = _interviewQuestions(ctx);
  if(!iv) return;
  C.pending_interview = iv;
  try{ logEvent('🎙️ Un journaliste vous tend le micro après le match.', '#f0c028'); }catch(e){}
}

// Le joueur répond (appelé par l'UI).
function answerInterview(optIdx){
  const C = careerV2;
  if(!C || !C.pending_interview) return;
  const iv = C.pending_interview;
  const opt = (iv.opts||[])[optIdx];
  if(opt){
    const fx = opt.fx||{};
    if(fx.conf)   try{ _boardAdjust(fx.conf, 'interview', fx.conf>0?'#18c860':'#e06060'); }catch(e){}
    if(fx.repute && typeof C.director_reputation==='number') C.director_reputation = Math.max(0,Math.min(100,C.director_reputation+fx.repute));
    if(fx.morale) [].concat(C.players||[],C.bench||[]).forEach(function(p){ if(p) p._fm = Math.max(-10,Math.min(10,(p._fm||0)+fx.morale)); });
    if(fx.budget) { C.club.budget = (C.club.budget||0)+fx.budget; try{ _addFinanceLog('Interview', fx.budget); }catch(e){} }
    // Réactions presse + réseaux.
    if(opt.ptext) try{ _pressAdd(opt.ptext, opt.press||'neutral'); }catch(e){}
    if(opt.ttext) try{ _socialAdd(opt.ttext, opt.tweet||'neutral'); }catch(e){}
    try{ logEvent('🎙️ Vous : ' + opt.label, '#f0c028'); }catch(e){}
  }
  C.pending_interview = null;
  saveCareerV2();
  try{ renderCareerV2(); }catch(e){}
}

// Carte d'interview en attente.
function _renderInterviewCard(){
  const C = careerV2;
  if(!C || !C.pending_interview) return '';
  const iv = C.pending_interview;
  let h = '<div class="ccard ccard-gold">';
  h += '<div class="ccard-title">🎙️ Conférence de presse</div>';
  h += '<div style="font-size:11px;color:var(--fg);line-height:1.5;margin-bottom:8px;font-style:italic">« ' + iv.q + ' »</div>';
  h += '<div style="display:flex;flex-direction:column;gap:5px">';
  (iv.opts||[]).forEach(function(o, i){
    h += '<button class="btn" onclick="answerInterview(' + i + ')" style="text-align:left;font-size:10px;padding:7px 10px;line-height:1.4">' + o.label + '</button>';
  });
  h += '</div></div>';
  return h;
}
