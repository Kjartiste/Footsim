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
  const conf = _boardConf();
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
  try{ logEvent('❌ Vous avez été licencié par le board du ' +
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
  const targetIdx = (idx > 0 && Math.random() < 0.7) ? idx - 1 : idx;
  const target = _boardPickClub(levels[targetIdx]);
  if(!target) return;

  const budget = Math.round((C.club.budget || 10000) * (1.2 + Math.random() * 1.6));
  C.job_offer = {
    club: target,
    budget: budget,
    season: C.season,
    isStepUp: targetIdx < idx,
  };
  try{ logEvent('📨 ' + target.name + ' vous propose de prendre les rênes !', '#9c27b0'); }catch(e){}
}

// Carte d'offre d'emploi (affichée en haut de la Vue).
function _renderJobOfferCard(){
  const C = careerV2, o = C.job_offer;
  if(!o) return '';
  let h = '<div style="background:linear-gradient(135deg,rgba(156,39,176,0.18),var(--dark));border:1px solid #9c27b0;border-radius:8px;padding:12px;margin-bottom:10px">';
  h += '<div style="font-size:10px;font-weight:700;color:#9c27b0;margin-bottom:6px">📨 Offre d\'un autre club</div>';
  h += '<div style="font-size:11px;line-height:1.6;margin-bottom:8px">';
  h += '<b style="color:' + (o.club.color||'#fff') + '">' + (o.club.badge?o.club.badge+' ':'') + o.club.name + '</b> ';
  h += '(' + (o.club.divisionName || o.club.level) + ') souhaite vous nommer directeur.';
  if(o.isStepUp) h += ' <span style="color:#18c860">C\'est un échelon au dessus.</span>';
  h += '<br><span style="color:var(--muted)">Budget proposé : </span><b style="color:#18c860">' + _fmtMoney(o.budget) + '</b>';
  h += '</div>';
  h += '<div style="display:flex;gap:6px">';
  h += '<button class="btn btng" onclick="acceptJobOffer()" style="flex:1;font-size:9px;padding:5px">✅ Accepter</button>';
  h += '<button class="btn" onclick="declineJobOffer()" style="flex:1;font-size:9px;padding:5px">✕ Refuser</button>';
  h += '</div></div>';
  return h;
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
  if(p._potential && p._potential > ovr + 15) v *= 1.3;
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
  const fee = Math.max(200, Math.round(base * mult / 100) * 100);

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
  const danger = conf < BOARD.WARN_THRESHOLD;

  let h = '<div style="background:var(--dark);border:1px solid ' + (danger ? '#e02030' : 'var(--b1)') + ';border-radius:8px;padding:10px;margin-bottom:10px">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">';
  h += '<div style="font-size:10px;font-weight:700;color:var(--gold)">🏛 Confiance du board</div>';
  h += '<div style="font-size:10px;font-weight:900;color:' + lab.col + '">' + lab.txt + ' · ' + Math.round(conf) + '/100</div>';
  h += '</div>';
  // Jauge
  h += '<div style="height:8px;background:var(--panel);border-radius:4px;overflow:hidden;position:relative">';
  h += '<div style="height:100%;width:' + Math.max(2, conf) + '%;background:' + lab.col + ';transition:width .3s"></div>';
  // Repère du seuil de licenciement
  h += '<div style="position:absolute;left:' + BOARD.SACK_THRESHOLD + '%;top:0;bottom:0;width:1px;background:#e02030"></div>';
  h += '</div>';
  if(danger){
    h += '<div style="font-size:9px;color:#e02030;margin-top:6px;line-height:1.5">⚠️ <b>Vous êtes sur la sellette.</b> Sous ' + BOARD.SACK_THRESHOLD + '/100 en fin de saison, le board vous licenciera.</div>';
  } else {
    h += '<div style="font-size:8px;color:var(--muted);margin-top:5px">Évolue avec vos résultats. Bilan complet en fin de saison.</div>';
  }

  // ── Objectif de la saison + progression en direct ──────────────────────
  const obj = (C.club.board_objectives || [])[0];
  if(obj){
    const st = (C.standings || []).slice().sort(function(a, b){
      return b.Pts - a.Pts || (b.GF - b.GA) - (a.GF - a.GA);
    });
    const pos = st.findIndex(function(s){ return s.isPlayer; }) + 1;
    const total = st.length;
    // Projection : l'objectif serait-il tenu si la saison s'arrêtait maintenant ?
    let onTrack = null;
    if(pos && total){
      onTrack = _boardObjectiveMet(obj, { rank:pos, total:total, promoted:(pos<=2), relegated:(pos>=total-1) });
    }
    h += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--b1)">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px">';
    h += '<span style="font-size:9px;color:var(--muted)">🎯 Objectif : <b style="color:var(--fg)">' + obj.desc + '</b></span>';
    if(onTrack !== null){
      h += '<span style="font-size:8px;font-weight:700;color:' + (onTrack ? '#18c860' : '#e08040') + ';white-space:nowrap">' +
        (onTrack ? '✓ en bonne voie' : '✗ hors trajectoire') + '</span>';
    }
    h += '</div>';
    if(obj.reward){
      h += '<div style="font-size:8px;color:var(--muted);margin-top:3px">Prime si atteint : <b style="color:#18c860">' + _fmtMoney(obj.reward) + '</b></div>';
    }
    h += '</div>';
  }

  // Résultat de l'objectif de la saison précédente (une fois, après le bilan).
  if(C._lastObjective){
    const lo = C._lastObjective;
    h += '<div style="margin-top:6px;font-size:8px;color:' + (lo.met ? '#18c860' : '#e06060') + '">';
    h += (lo.met ? '✓ Saison passée : « ' + lo.desc +' » tenu' + (lo.reward ? ' (+' + _fmtMoney(lo.reward) + ')' : '')
                 : '✗ Saison passée : « ' + lo.desc + ' » manqué');
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

  let h = '<div style="background:var(--dark);border:1px solid var(--b1);border-radius:8px;padding:10px;margin-top:8px">';
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

  let h = '<div style="background:var(--dark);border:1px solid var(--b1);border-radius:8px;padding:10px;margin-bottom:10px">';
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
  switch(obj.type){
    case 'promotion': return !!stats.promoted;
    case 'top_half':  return rank > 0 && total > 0 && rank <= Math.ceil(total/2);
    case 'mid_table': return !stats.relegated;
    case 'survive':   return !stats.relegated;
    default:          return false;
  }
}

// Évalue l'objectif de la saison écoulée, verse la prime, ajuste la confiance,
// puis régénère un objectif pour la saison à venir (le niveau a pu changer).
function _boardCheckObjectives(stats){
  const C = careerV2;
  if(!C || !C.club) return;
  const obj = (C.club.board_objectives || [])[0];

  if(obj){
    const met = _boardObjectiveMet(obj, stats);
    if(met){
      if(obj.reward){
        try{ _prizePay(obj.reward, 'Prime d\'objectif du board — ' + obj.desc, '#18c860'); }catch(e){}
      }
      _boardAdjust(8, 'objectif tenu : ' + obj.desc, '#18c860');
    } else {
      _boardAdjust(-8, 'objectif manqué : ' + obj.desc, '#e06060');
    }
    C._lastObjective = { desc: obj.desc, met: met, reward: met ? (obj.reward || 0) : 0 };
  }

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
      String(p.name).replace(/'/g, "\\'") + '\',\'' + o.key + '\')" ' +
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
