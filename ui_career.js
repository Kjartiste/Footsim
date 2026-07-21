// ============================================================
// UI_CAREER.JS — extrait de ui.js (scope global partagé)
// Lignes 9511–12331 de l'ui.js d'origine.
// ============================================================

function _calSetFamily(dateKey, familyKey){
  window._calPlannerFamily = familyKey;
  renderCareerDirectorTab('calendar');
}

// Change le style du coach (réoriente les prochains plannings auto de l'IA).
function _calSetCoachStyle(style){
  if(!careerV2 || !careerV2.club) return;
  careerV2.club.coachStyle = style;
  // Régénérer le planning hebdo par défaut si le joueur n'a rien verrouillé.
  if(!careerV2.weekPlanLockedByUser && typeof TRAINING!=='undefined'){
    careerV2.weekPlan = TRAINING.generateWeekPlan(careerV2.club, {});
  }
  saveCareerV2();
  renderCareerDirectorTab('calendar');
}

// Met toute la journée au repos (créneaux ouverts → repos).
function _calRestDay(dateKey){
  if(!careerV2) return;
  const C = careerV2;
  if(!C.dayPlans) C.dayPlans = {};
  const slots = {};
  (TRAINING_CONFIG.slots.order||['evening']).forEach(function(sk){
    slots[sk] = TRAINING.slotOpen(C.club, sk) ? { type:'rest' } : null;
  });
  C.dayPlans[dateKey] = { type:'day', slots:slots };
  C.weekPlanLockedByUser = true;
  saveCareerV2();
  window._calPlannerKey = null;
  renderCareerDirectorTab('calendar');
}

// Laisse l'IA générer la journée (copie la journée hebdo correspondante).
function _calAutoDay(dateKey){
  if(!careerV2 || typeof TRAINING==='undefined') return;
  const C = careerV2;
  const parts = String(dateKey).split('-');
  const d = { year:+parts[0], month:+parts[1], day:+parts[2] };
  const dow = (typeof _dayOfWeek==='function') ? _dayOfWeek(d) : 0;
  // Régénère un planning frais et prend la journée voulue.
  const fresh = TRAINING.generateWeekPlan(C.club, {});
  if(C.dayPlans) delete C.dayPlans[dateKey]; // retire l'override → suit l'hebdo
  if(!C.weekPlan) C.weekPlan = fresh;
  C.weekPlan[dow] = fresh[dow];
  saveCareerV2();
  window._calPlannerKey = null;
  renderCareerDirectorTab('calendar');
}

// Rend la main à l'IA : supprime les overrides et déverrouille le planning.
function _calUnlockWeek(){
  if(!careerV2 || typeof TRAINING==='undefined') return;
  const C = careerV2;
  C.weekPlanLockedByUser = false;
  C.dayPlans = C.dayPlans || {};
  // Ne retire que les overrides d'entraînement (garde amicaux/matchs).
  Object.keys(C.dayPlans).forEach(function(k){
    const p = C.dayPlans[k];
    if(p && (p.slots || p.type==='training' || p.type==='recovery' || p.type==='social' || p.type==='magie' || p.type==='rest' || p.type==='video' || p.type==='matchprep')){
      if(!(p.type==='friendly')) delete C.dayPlans[k];
    }
  });
  C.weekPlan = TRAINING.generateWeekPlan(C.club, {});
  saveCareerV2();
  window._calPlannerKey = null;
  renderCareerDirectorTab('calendar');
}

// Sélectionne le créneau (matin/après-midi/soir) en cours d'édition.
function _calSetSlot(dateKey, slotKey){
  window._calPlannerSlot = slotKey;
  window._calPlannerFamily = null; // réinitialise l'onglet famille
  renderCareerDirectorTab('calendar');
}
// Premier créneau ouvert pour le statut du club (défaut d'édition).
function _calFirstOpenSlot(club){
  const order = (TRAINING_CONFIG.slots&&TRAINING_CONFIG.slots.order)||['evening'];
  for(const sk of order){ if(TRAINING.slotOpen(club, sk)) return sk; }
  return 'evening';
}
// Compte les séances d'effort de la semaine contenant dateKey (override + hebdo).
function _calCountWeekEffort(dateKey){
  const C = careerV2; if(!C) return 0;
  const wk = _weekOfDateKey(dateKey);
  const freeTypes = (TRAINING_CONFIG.slots.freeTypes||[]);
  let n = 0;
  // Overrides posés par le joueur sur des dates de cette semaine.
  const seen = {};
  Object.keys(C.dayPlans||{}).forEach(function(k){
    if(_weekOfDateKey(k)!==wk) return;
    const d = C.dayPlans[k];
    seen[k] = true;
    if(d && d.slots){
      Object.keys(d.slots).forEach(function(s){
        const sl=d.slots[s];
        if(sl&&sl.type&&sl.type!=='rest'&&sl.type!=='match'&&freeTypes.indexOf(sl.type)<0) n++;
      });
    } else if(d && d.type==='training'){ n++; }
  });
  return n;
}

// Assigne une séance à un créneau précis du jour (crée un dayPlan à slots).
// Respecte le plafond hebdo : refuse un créneau d'effort au-delà de la limite.
function _calPlanSlotSession(dateKey, slotKey, dtype, family, session){
  if(!careerV2) return;
  const C = careerV2;
  const freeTypes = (TRAINING_CONFIG.slots.freeTypes||[]);
  const isEffort = freeTypes.indexOf(dtype) < 0;

  // Récupère (ou initialise depuis le planning hebdo) la journée à slots.
  if(!C.dayPlans) C.dayPlans = {};
  let day = C.dayPlans[dateKey];
  if(!day || !day.slots){
    // Repartir de la journée hebdo correspondante si elle existe.
    const parts = String(dateKey).split('-');
    const d = { year:+parts[0], month:+parts[1], day:+parts[2] };
    const dow = (typeof _dayOfWeek==='function') ? _dayOfWeek(d) : 0;
    const base = (C.weekPlan && C.weekPlan[dow] && C.weekPlan[dow].slots) ? C.weekPlan[dow] : null;
    day = { type:'day', slots: base ? JSON.parse(JSON.stringify(base.slots)) : {} };
  }

  // Contrôle du plafond si on ajoute une séance d'effort sur un créneau vide.
  const already = day.slots[slotKey] && day.slots[slotKey].type && day.slots[slotKey].type!=='rest';
  if(isEffort && !already){
    const cap = TRAINING.maxSessions(C.club);
    const wkCount = _calCountWeekEffort(dateKey);
    if(wkCount >= cap){
      logEvent('❌ Plafond atteint : club '+TRAINING.statusLabel(C.club).toLowerCase()+' → '+cap+' séance(s)/semaine max.','#e02030');
      return;
    }
  }
  // Toggle : recliquer la même séance = vider le créneau.
  const c = day.slots[slotKey];
  if(c && c.family===family && c.session===session){ day.slots[slotKey] = { type:'rest' }; }
  else { day.slots[slotKey] = { type:dtype, family:family, session:session }; }

  C.dayPlans[dateKey] = day;
  C.weekPlanLockedByUser = true;
  saveCareerV2();
  renderCareerDirectorTab('calendar');
}

// Planifie une séance précise (famille + type) sur un jour, en respectant le
// plafond de séances du statut du club (empêche p.ex. un amateur d'en abuser).
function _calPlanSession(dateKey, type, family, session){
  if(!careerV2) return;
  const C = careerV2;
  // Contrôle du plafond hebdo : compte les séances déjà planifiées cette semaine.
  if(type==='training' && typeof TRAINING!=='undefined'){
    const cap = TRAINING.maxSessions(C.club);
    const wk = _weekOfDateKey(dateKey);
    let count = 0;
    Object.keys(C.dayPlans||{}).forEach(function(k){
      const p = C.dayPlans[k];
      if(p && p.type==='training' && _weekOfDateKey(k)===wk && k!==dateKey) count++;
    });
    if(count >= cap){
      logEvent('❌ Plafond atteint : un club '+TRAINING.statusLabel(C.club).toLowerCase()+' ne peut programmer que '+cap+' séance(s)/semaine.','#e02030');
      return;
    }
  }
  const ok = _planDay(dateKey, type, null, { family:family, session:session });
  if(!ok){ logEvent('❌ Un match est déjà prévu ce jour-là.','#e02030'); return; }
  C.weekPlanLockedByUser = true; // l'IA ne réécrase plus le planning cette semaine
  saveCareerV2();
  window._calPlannerKey = null;
  window._calFriendlyPickerKey = null;
  renderCareerDirectorTab('calendar');
}

// Numéro de semaine ISO-approché d'un dateKey 'Y-MM-DD', pour compter les séances.
function _weekOfDateKey(dateKey){
  const parts = String(dateKey).split('-');
  const d = { year:+parts[0], month:+parts[1], day:+parts[2] };
  if(typeof _dateToOrdinal==='function') return Math.floor(_dateToOrdinal(d)/7);
  return d.year*52 + d.month*4 + Math.floor(d.day/7);
}

// Ouvre / ferme le sélecteur d'adversaire d'amical pour une date donnée.
function _calToggleFriendlyPicker(dateKey){
  window._calFriendlyPickerKey = (window._calFriendlyPickerKey===dateKey) ? null : dateKey;
  window._calFriendlyOppFilter = window._calFriendlyOppFilter || '';
  renderCareerDirectorTab('calendar');
}
function _calSetFriendlyFilter(v){
  window._calFriendlyOppFilter = v||'';
  renderCareerDirectorTab('calendar');
  // Redonner le focus au champ après re-render.
  setTimeout(function(){ const el=document.getElementById('friendly-opp-filter'); if(el){ el.focus(); el.value=window._calFriendlyOppFilter; } },0);
}
// HTML du sélecteur d'adversaire : recherche + liste cliquable des clubs.
function _calFriendlyPickerHTML(dateKey){
  const C = careerV2;
  const all = (typeof _friendlyOpponents==='function') ? _friendlyOpponents() : [];
  const filter = (window._calFriendlyOppFilter||'').toLowerCase();
  const list = (filter ? all.filter(function(t){ return t.name.toLowerCase().indexOf(filter)>=0; }) : all).slice(0, 40);
  let h = '<div style="margin-top:8px;border-top:1px dashed #00bcd4;padding-top:8px">';
  h += '<div style="font-size:9px;color:var(--muted);margin-bottom:6px">Choisis l\'adversaire de l\'amical :</div>';
  h += '<input id="friendly-opp-filter" type="text" placeholder="Rechercher un club..." value="'+(window._calFriendlyOppFilter||'').replace(/"/g,'&quot;')+'" oninput="_calSetFriendlyFilter(this.value)" style="width:100%;box-sizing:border-box;background:var(--dark);border:1px solid var(--b1);border-radius:6px;color:var(--fg);padding:6px 8px;font-size:11px;margin-bottom:6px">';
  if(!list.length){
    h += '<div style="font-size:9px;color:var(--muted);padding:6px">Aucun club trouvé.</div>';
  } else {
    h += '<div style="display:flex;flex-direction:column;gap:3px;max-height:200px;overflow-y:auto">';
    list.forEach(function(t){
      const lvlLabel = t.level ? String(t.level).replace('valcourt_','V-').replace('brumefer_','B-').replace('district','D').toUpperCase() : '';
      h += '<div onclick="_calPlanFriendly(\''+dateKey+'\',\''+t.name.replace(/'/g,"\'").replace(/"/g,'&quot;')+'\')" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;background:var(--dark);border:1px solid var(--b1)">';
      h += '<span style="width:18px;height:18px;border-radius:50%;background:'+(t.color||'#888')+'33;border:2px solid '+(t.color||'#888')+';flex-shrink:0"></span>';
      h += '<span style="flex:1;font-size:11px;font-weight:700;color:'+(t.color||'var(--fg)')+'">'+t.name+'</span>';
      if(lvlLabel) h += '<span style="font-size:8px;color:var(--muted)">'+lvlLabel+'</span>';
      h += '</div>';
    });
    h += '</div>';
  }
  h += '</div>';
  return h;
}
// Planifie un amical avec l'adversaire choisi, à la date donnée.
function _calPlanFriendly(dateKey, oppName){
  if(!careerV2) return;
  const all = (typeof _friendlyOpponents==='function') ? _friendlyOpponents() : [];
  const opp = all.find(function(t){ return t.name===oppName; });
  if(!opp){ logEvent('Adversaire introuvable.','#e02030'); return; }
  const ok = _planDay(dateKey, 'friendly', null, {
    oppName: opp.name, oppLevel: opp.level, oppColor: opp.color||null, oppBadge: opp.badge||null,
  });
  if(!ok){ logEvent('❌ Un match est déjà prévu ce jour-là.','#e02030'); return; }
  careerLog('🤝 Amical programmé le '+dateKey.split('-').reverse().join('/')+' contre '+opp.name+'.', '#00bcd4');
  saveCareerV2();
  window._calFriendlyPickerKey = null;
  window._calPlannerKey = null;
  window._calFriendlyOppFilter = '';
  renderCareerDirectorTab('calendar');
}



// ── Rendu principal Manager ───────────────────────────────────────────
function renderCareerManager(el){
  const C = careerV2;
  const mgr = C.manager;
  let h = '<div style="padding:8px;max-width:600px;margin:0 auto">';
  h += '<div style="background:var(--panel);border:2px solid #8840e0;border-radius:10px;padding:10px;margin-bottom:10px">';
  h += '<div style="display:flex;align-items:center;gap:10px">';
  h += '<div style="font-size:28px">🧑</div>';
  h += '<div><div style="font-size:14px;font-weight:900">'+mgr.name+'</div>';
  h += '<div style="font-size:9px;color:var(--muted)">Licence '+mgr.license+' · Reputation '+mgr.reputation+'/100</div>';
  h += '<div style="font-size:9px;color:'+(mgr.unemployed?'#e06060':'#18c860')+'">'+(mgr.unemployed?'🔴 Sans club':'🟢 '+( C.club ? C.club.name : ''))+'</div>';
  h += '</div></div></div>';
  if(mgr.unemployed){
    h += '<div class="ccard">';
    h += '<div style="font-size:10px;font-weight:700;color:var(--gold);margin-bottom:8px">📬 Offres d\'emploi</div>';
    if(!C.job_offers || C.job_offers.length === 0){
      h += '<div style="color:var(--muted);font-size:9px">Aucune offre. Avancez d\'une semaine.</div>';
    } else {
      C.job_offers.forEach(function(offer, i){
        h += '<div style="background:var(--panel);border-radius:6px;padding:8px;margin-bottom:6px">';
        h += '<div style="font-size:11px;font-weight:700;color:var(--fg)">'+offer.club+'</div>';
        h += '<div style="font-size:9px;color:var(--muted)">'+offer.region+' · '+offer.level.toUpperCase()+'</div>';
        h += '<div style="font-size:9px;color:#18c860">Salaire : 🪙 '+_fmtMoney(offer.salary)+'/semaine</div>';
        h += '<div style="font-size:9px;color:#f0c028">Objectif : '+(offer.objectives[0] ? offer.objectives[0].desc : '?')+'</div>';
        h += '<div style="display:flex;gap:6px;margin-top:6px">';
        h += '<button class="btn btng" onclick="acceptManagerJob('+i+')" style="font-size:9px;flex:1">✅ Accepter</button>';
        h += '<button class="btn" onclick="rejectManagerJob('+i+')" style="font-size:9px;padding:2px 8px">❌</button>';
        h += '</div></div>';
      });
    }
    h += '</div>';
  }
  h += '<div style="display:flex;gap:6px;margin-top:8px">';
  h += '<button class="btn btng" onclick="advanceCareerWeek()" style="flex:1;font-size:10px">⏩ Semaine suivante</button>';
  h += '<button class="btn" onclick="abandonCareerV2()" style="font-size:9px;color:#e06060;border-color:#e06060">✕ Abandonner</button>';
  h += '</div></div>';
  el.innerHTML = h;
}


// ── Actions carrière ──────────────────────────────────────────────────
// Exécute tous les systèmes à cadence hebdomadaire (économie, infra, coupe,
// mercato, événements...). Appelé soit par le saut rapide de semaine, soit
// automatiquement par _advanceOneDay() dès qu'on franchit une frontière de
// semaine calendaire.
function _runWeeklySystems(){
  if(!careerV2) return;
  const C = careerV2;

  // ── RÉCUPÉRATION DES BLESSURES (carrière V2) ───────────────────────────
  // Le décompte hebdomadaire n'existait que pour l'ancienne carrière (V1) :
  // en V2, un joueur blessé restait indisponible INDÉFINIMENT. On décrémente
  // ici chaque semaine et on rétablit le joueur quand le compteur atteint 0.
  [].concat(C.players||[], C.bench||[], C.reserves||[]).forEach(function(p){
    if(!p || !(p._injWeeks>0)) return;
    p._injWeeks--;
    if(p._injWeeks<=0){
      p._injWeeks=0; p._missNextMatch=false; p.injLevel=0; p.injT=0; p._injLevelCareer=0;
      try{ logEvent('✅ '+p.name+' est rétabli et de nouveau disponible.', '#18c860'); }catch(e){}
    } else {
      p._missNextMatch=true;
    }
  });

  if(!C.freeAgents || C.freeAgents.length === 0){
    _generateFreeAgents();
  }

  _applyWeeklyEconomy();
  // Le board surveille la masse salariale (plafond wage_budget).
  try{ if(typeof _boardCheckWageBill==='function') _boardCheckWageBill(); }catch(e){ console.error('wage bill:',e); }
  // Décompte des contrats (semi-pro) : expirations, départs libres.
  try{ if(typeof _tickContracts==='function') _tickContracts(); }catch(e){ console.error('contracts:',e); }
  // Les clubs PNJ s'échangent des joueurs : le marché vit sans vous.
  try{ if(typeof _runNpcTransfers==='function') _runNpcTransfers(); }catch(e){ console.error('npc transfers:',e); }
  // Salaire personnel du manager (son pécule, distinct du budget du club).
  try{ if(typeof _managerWeeklyPay==='function') _managerWeeklyPay(); }catch(e){ console.error('manager pay:',e); }
  // Événement de saison éventuel (dilemme ou fait marquant).
  try{ if(typeof _maybeSeasonEvent==='function') _maybeSeasonEvent(); }catch(e){ console.error('season event:',e); }
  // Académie personnelle du manager (entretien + prospects).
  try{ if(typeof _tickManagerAcademy==='function') _tickManagerAcademy(); }catch(e){ console.error('mgr academy:',e); }

  // ── Simulation automatique en fond de TOUS les matchs PNJ échus ──────────
  // Le classement reste vivant journée après journée sans action du joueur.
  try{ if(typeof _runBackgroundNpcSim==='function') _runBackgroundNpcSim(); }catch(e){ console.error('npc bg sim:',e); }

  try{ if(typeof _advanceInfraWorks==='function') _advanceInfraWorks(); }catch(e){ console.error('works:',e); }
  try{ if(typeof _advanceNationalCup==='function') _advanceNationalCup(); }catch(e){ console.error('cup:',e); }
  try{ if(typeof _advanceLeagueCup==='function') _advanceLeagueCup(); }catch(e){ console.error('leaguecup:',e); }
  try{ if(typeof _advanceHouseCup==='function') _advanceHouseCup(); }catch(e){ console.error('housecup:',e); }

  if(C.week % 4 === 0){
    _generateFreeAgents();
    logEvent('🔄 Nouveaux joueurs libres disponibles !','#00bcd4');
  }

  const isPro = C.club && ['d1','d2','d3'].includes(C.club.level);
  if(isPro){
    _checkMercatoWindow();
  }

  // ── Mercato : offres entrantes pour vos joueurs ─────────────────────────
  // Expiration d'abord (libère la place), puis génération d'une éventuelle
  // nouvelle offre. Sans effet hors fenêtre de transfert / club amateur.
  try{ if(typeof _boardExpireOffers==='function') _boardExpireOffers(); }catch(e){ console.error('offers expire:',e); }
  try{ if(typeof _boardGenerateOffers==='function') _boardGenerateOffers(); }catch(e){ console.error('offers gen:',e); }

  _triggerRegionEvent();
  _triggerWeeklyEvent();

  // ── Planning d'entraînement hebdomadaire (IA) ───────────────────────────
  // L'IA régénère un planning respectant le statut du club et le style du
  // coach. Le joueur reste libre de déplacer/écraser les séances via l'UI.
  try{
    if(typeof TRAINING!=='undefined' && C.club){
      const congested = !!(C.fixtures||[]).find(function(f){
        return !f.played && (f.homeIsPlayer||f.awayIsPlayer) && f.week===C.week;
      });
      const squadAll = (C.players||[]).concat(C.bench||[]);
      const avgForm = squadAll.length ? squadAll.reduce(function(s,p){return s+(p._fm||0);},0)/squadAll.length : 0;
      if(!C.weekPlanLockedByUser){
        C.weekPlan = TRAINING.generateWeekPlan(C.club, { congested:congested, avgForm:avgForm });
      }
    }
  }catch(e){ console.error('weekly training plan:', e); }
}

// Saut rapide d'une semaine entière (conservé pour compatibilité / usage
// ponctuel — ex. carrière manager sans effectif à entraîner). Fait avancer
// C.date de 7 jours d'un coup sans résoudre les plans jour par jour.
function advanceCareerWeek(){
  if(!careerV2) return;
  const C = careerV2;

  if(!C.fixtures || C.fixtures.length === 0){
    _generateSeasonFixtures();
  }

  C.week++;
  C.date = _addDays(C.date, 7);
  _runWeeklySystems();

  saveCareerV2();
  renderCareerV2();
}

// ── Avancement jour par jour ────────────────────────────────────────────
// Cœur du nouveau calendrier : fait avancer la carrière d'UNE journée.
// - Si un match du club joueur (championnat ou coupe) tombe aujourd'hui, on
//   ne fait PAS avancer la date : on signale le match en attente et le
//   joueur doit explicitement Jouer ou Simuler avant de pouvoir continuer.
// - Sinon, on résout le plan du jour (entraînement / repos / amical), on
//   avance la date d'un jour, on recalcule la semaine, et si on vient de
//   franchir une nouvelle semaine on déclenche les systèmes hebdomadaires.
function _advanceOneDay(){
  if(!careerV2) return;
  const C = careerV2;
  if(!C.fixtures || C.fixtures.length === 0) _generateSeasonFixtures();
  if(!C.seasonStartDate) C.seasonStartDate = Object.assign({}, C.date);

  // Résoudre en fond tous les matchs PNJ échus jusqu'à aujourd'hui, pour que
  // le classement reflète les résultats du jour même avant tout affichage.
  try{ if(typeof _simulateBackgroundNpcFixtures==='function') _simulateBackgroundNpcFixtures(C.date); }catch(e){ console.error('npc bg sim:',e); }

  const todayKey = _dateKey(C.date);
  const pending = _matchOnDateKey(todayKey);
  if(pending){
    if(pending.cup) C._pendingMatch = {cup:true};
    else if(pending.playoff) C._pendingMatch = {playoff:true};
    else if(pending.barrage) C._pendingMatch = {barrage:true};
    else if(pending.friendly) C._pendingMatch = {friendly:true, dateKey:pending.dateKey};
    else C._pendingMatch = {fixtureId:pending.id};
    saveCareerV2();
    renderCareerV2();
    return;
  }

  // Résoudre le plan du jour (entraînement/repos/amical) puis avancer.
  if(C.type==='director'){
    const msg = _resolveDayPlan(todayKey);
    if(msg) careerLog(msg, '#00bcd4');
  }
  if(C.dayPlans) delete C.dayPlans[todayKey];

  C.date = _addDays(C.date, 1);
  const elapsedDays = _daysBetween(C.seasonStartDate, C.date);
  const newWeek = Math.max(1, Math.floor(elapsedDays/7) + 1);
  if(newWeek !== C.week){
    C.week = newWeek;
    _runWeeklySystems();
  }

  saveCareerV2();
  renderCareerV2();
}


function _checkMercatoWindow(){
  if(!careerV2) return;
  const month = careerV2.date.month;
  const wasOpen = careerV2.mercato.window_open;

  // Été : mois 6-7 / Hiver : mois 12-1
  const isOpen = [6,7,12,1].includes(month);
  const type = [6,7].includes(month) ? 'summer' : 'winter';

  if(isOpen && !wasOpen){
    careerV2.mercato.window_open = true;
    careerV2.mercato.window_type = type;
    logEvent('Fenetre de transferts '+(type==='summer'?'estivale':'hivernale')+' ouverte !','#f0c028');
  } else if(!isOpen && wasOpen){
    careerV2.mercato.window_open = false;
    careerV2.mercato.window_type = null;
    logEvent('🔒 Fenêtre de transferts fermée.','#e06060');
  }
}


function _triggerWeeklyEvent(){
  if(!careerV2 || careerV2.type !== 'director') return;
  const C = careerV2;
  const level = C.club.level;
  const isPro = ['d1','d2','d3'].includes(level);

  // Blessure aléatoire d'un joueur (5%)
  if(Math.random() < 0.05){
    const allP = (C.players||[]).concat(C.bench||[]).filter(function(p){ return !p._missNextMatch && p.injLevel < 2; });
    if(allP.length > 0){
      const p = allP[Math.floor(Math.random()*allP.length)];
      p.injLevel = 1;
      p.injT = (2 + Math.floor(Math.random()*3)) * 7; // 2-4 semaines
      logEvent('🤕 ' + p.name + ' est blessé pour ' + Math.ceil(p.injT/7) + ' semaine(s) !','#f0c028');
    }
  }

  // Récupération blessures
  (C.players||[]).concat(C.bench||[]).forEach(function(p){
    if(p.injLevel > 0 && p.injT > 0){
      p.injT = Math.max(0, p.injT - 7);
      if(p.injT === 0){
        p.injLevel = 0;
        logEvent('💪 ' + p.name + ' est remis de sa blessure !','#18c860');
      }
    }
  });

  // Amateur : un joueur part (2%) — il a trouvé autre chose
  if(!isPro && Math.random() < 0.02 && (C.players||[]).length > 7){
    const arr = C.players || [];
    const idx = 1 + Math.floor(Math.random()*(arr.length-1)); // pas le GB
    const p = arr[idx];
    if(p){
      arr.splice(idx, 1);
      logEvent('😢 ' + p.name + ' quitte le club (raisons personnelles).','#e06060');
    }
  }
}

function _triggerRegionEvent(){
  if(!careerV2 || careerV2.type !== 'director') return;
  const region = WORLDS.getRegion('panthalassa',careerV2.club.region);
  if(!region) return;

  // Événements positifs (Les Mers Bénies)
  if(region.traits?.positive_events && Math.random() < 0.15){
    const events = [
      '🌊 Une vague de bonne fortune — un joueur récupère plus vite de sa blessure !',
      '🌊 Les dieux marins sourient — moral de l\'équipe au maximum cette semaine !',
      '🌊 Journée bénie — un sponsor offre un bonus inattendu !',
    ];
    logEvent(events[Math.floor(Math.random()*events.length)],'#18c860');
    if(Math.random() < 0.3) _addFinanceLog('Bonus surprise (Les Mers Bénies)', 500);
  }

  // Risque de corruption (Maï)
  if(region.traits?.corruption_risk && Math.random() < 0.08){
    careerV2.pending_events.push({
      type: 'corruption_offer',
      desc: 'Une proposition douteuse vous est soumise...',
      deadline: careerV2.week + 2,
    });
    logEvent('⚠️ Une proposition suspecte est arrivée dans votre bureau...','#e06020');
  }

  // Pépite (Nérïa) — un bon recruteur (staff.js) multiplie les chances.
  const _gemMul = (typeof STAFF!=='undefined' && careerV2) ? STAFF.gemChanceMul(careerV2.club) : 1;
  if(region.traits?.gem_chance && Math.random() < 0.03 * _gemMul){
    const gemName = ['Mystara','Arcania','Crystana','Runalia','Sigilia'][Math.floor(Math.random()*5)];
    // Génère la pépite via la vraie fabrique (WORLDS.generateGem), selon la
    // nation du club. Position tirée au sort pour varier les profils.
    const gemPos = ['ATT','MC','DEF'][Math.floor(Math.random()*3)];
    let gem = null;
    try{
      const nat = (careerV2.club && careerV2.club.nation) ? careerV2.club.nation : 'panthalassa';
      gem = WORLDS.generateGem(nat, gemPos, gemName);
    }catch(e){ console.error('generateGem:', e); }
    if(gem){
      careerV2.pending_events.push({
        type: 'gem_discovered',
        desc: 'Le scout a découvert une pépite : '+gemName+' !',
        player: gem,
      });
      logEvent('💎 Pépite découverte : '+gemName,'#9c27b0');
    }
  }
}

function _addFinanceLog(desc, amount){
  if(!careerV2) return;
  careerV2.finances.log.push({desc, amount, week: careerV2.week});
  if(amount < 0) careerV2.finances.total_spent += Math.abs(amount);
  else careerV2.finances.total_earned += amount;
}

function upgradeInfraV2(key){
  if(!careerV2 || careerV2.type !== 'director') return;
  const club = careerV2.club;
  const lvl = (club.infra[key]||0);
  const cost = Math.round(1000 * Math.pow(3, lvl));
  if(club.budget < cost){ logEvent('❌ Budget insuffisant','#e02030'); return; }
  club.budget -= cost;
  club.infra[key] = lvl + 1;
  _addFinanceLog('Amelioration '+key+' niv.'+(lvl+1), -cost);
  logEvent('Infrastructure amelioree niveau '+(lvl+1)+'!','#18c860');
  saveCareerV2();
  renderCareerDirectorTab('infra');
}

function openTransferMarket(){
  logEvent('🔄 Marché des transferts — fonctionnalité à venir !','#f0c028');
}

function acceptManagerJob(i){
  if(!careerV2 || careerV2.type !== 'manager') return;
  const offer = careerV2.job_offers[i];
  if(!offer) return;

  // ── UNIFICATION DES DEUX CARRIÈRES ─────────────────────────────────────
  // Avant : accepter une offre créait un club SQUELETTE (nom, région, niveau,
  // couleur — et RIEN d'autre : ni effectif, ni budget, ni mercato, ni board).
  // Le mode « manager » n'avait donc aucun gameplay une fois embauché, et tout
  // le mode carrière riche (effectif, finances, licence, board) vivait
  // uniquement côté « director ». Deux carrières parallèles, une seule jouable.
  //
  // On unifie : accepter une offre lance une VRAIE carrière de directeur au
  // club proposé, en conservant la progression du manager (licence, XP,
  // palmarès, historique). Le « manager nomade » devient ainsi une couche
  // par-dessus le mode director — on dirige un vrai club, et les offres
  // permettent d'en changer.
  const carriedManager = careerV2.manager;         // licence, xp, palmarès
  const carriedHistory = careerV2.history || [];
  const nation = careerV2.nation || 'panthalassa';

  // Construit une carrière director complète au club de l'offre.
  startCareerDirector(offer.region, offer.club, nation);
  if(!careerV2 || careerV2.type !== 'director'){
    logEvent('❌ Impossible de rejoindre '+offer.club, '#e02030');
    return;
  }

  // Reprise de la carrière personnelle du manager par-dessus le nouveau club.
  if(carriedManager){
    careerV2.manager = carriedManager;
    careerV2.manager.unemployed = false;
    careerV2.manager.contract = { club: offer.club, salary: offer.salary, years: offer.contract_years || 2, objectives: offer.objectives || [] };
  }
  // On garde la trace des clubs précédents.
  careerV2.history = carriedHistory;
  // On mémorise qu'on est en carrière « manager nomade » (les offres
  // continueront d'arriver, cf. _boardMaybeJobOffer, désormais unifié).
  careerV2._nomad = true;
  // RÔLE : on est ENTRAÎNEUR, pas dirigeant. On ne contrôle que le sportif ;
  // les infrastructures et sponsors relèvent des dirigeants (voir _careerRole).
  careerV2.role = 'manager';
  // Périmètre d'équipe : première équipe par défaut, ou réserve si l'offre
  // le précise. Entraîner une réserve, c'est ne s'occuper que de la réserve.
  careerV2.teamScope = offer.teamScope || 'first';

  // ── ÉQUIPE RÉSERVE RÉELLE ──────────────────────────────────────────────
  // Si on est nommé à la réserve, on n'hérite PAS de l'effectif première : on
  // dirige un groupe distinct, plus jeune et plus faible (des joueurs à former).
  // Avant, « réserve » n'était qu'un libellé — on gérait quand même la 1re
  // équipe. On construit ici un vrai effectif de réserve.
  if(careerV2.teamScope === 'reserve'){
    try{ _buildReserveSquad(careerV2); }catch(e){ console.error('reserve squad:', e); }
    careerV2.club.name = offer.club;   // le nom porte déjà « (Réserve) »
  }

  logEvent('✅ Vous prenez les rênes de '+offer.club+' !','#18c860');
  saveCareerV2();
  renderCareerV2();
}

function rejectManagerJob(i){
  if(!careerV2) return;
  careerV2.job_offers.splice(i, 1);
  saveCareerV2();
  renderCareerV2();
}


// Applique le bonus staff (staff.js) au moral/cohésion/concentration des
// joueurs alignés au coup d'envoi : manager + adjoint (moral/cohésion) et
// analyste vidéo (petit boost de forme = concentration de 1re mi-temps).
function _applyStaffMatchdayBonus(club, starters, matchBench){
  if(typeof STAFF==='undefined' || !club) return;
  // Coups de pied arrêtés : le coach spécialisé règle l'efficacité offensive
  // (>1) et défensive (<1) de l'équipe du joueur (team 0). Lu par ia.js.
  try{
    if(teams && teams[0]){
      teams[0]._setpAtk = STAFF.setPieceAttackMul(club);
      teams[0]._setpDef = STAFF.setPieceDefenseMul(club);
    }
  }catch(e){}
  const mB = STAFF.matchMoraleBonus(club);
  const cB = STAFF.matchCohesionBonus(club);
  const aB = STAFF.analystMatchBonus(club);
  if(mB<=0 && cB<=0 && aB<=0) return;
  (starters||[]).concat(matchBench||[]).forEach(function(p){
    if(!p) return;
    p._hm  = Math.max(-10, Math.min(10, (p._hm||0) + mB));
    p._coh = Math.max(0,  Math.min(100,(p._coh!=null?p._coh:50) + cB));
    if(aB>0) p._fm = Math.max(-10, Math.min(10, (p._fm||0) + aB));
  });
}

// ── Match en carrière Dirigeant ───────────────────────────────────────
function playCareerMatchV2(){
  if(!careerV2) return;
  const C = careerV2;
  const fix = C._pendingMatch && C._pendingMatch.fixtureId
    ? (C.fixtures||[]).find(function(f){ return f.id===C._pendingMatch.fixtureId; })
    : (C.fixtures||[]).find(function(f){ return !f.played; });
  if(!fix){ logEvent('Aucun match à jouer !','#e02030'); return; }

  const isHome = fix.homeIsPlayer;
  const oppName = isHome ? fix.awayName : fix.homeName;
  const level   = C.club.level;
  const nation  = C.nation || 'panthalassa';
  const region  = C.club.region;

  // ── Format de match actif (5v5 / 7v7 / 11v11) ───────────────────────
  // AVANT : le joueur envoyait TOUT son effectif de carrière sur le
  // terrain (jusqu'à 18 joueurs en D1) alors que l'adversaire IA était
  // toujours généré en 7v7 fixe (7 titulaires) → un joueur en mode 11v11
  // se retrouvait à jouer 18 (ou 11) contre 7. On aligne maintenant les
  // deux équipes sur le format réellement actif (window.gameMode).
  const mode = window.gameMode || '7v7';
  const XI_POS = mode==='11v11' ? ['GB','DD','DC','DC','DG','MC','MC','MC','MC','ATT','ATT']
               : mode==='5v5'   ? ['GB','DC','MOG','MOD','ATT']
               :                  ['GB','DC','DD','DG','MC','MC','ATT'];
  const BENCH_POS = mode==='11v11' ? ['GB','DC','MC','MC','ATT','DD','DG']
                  : mode==='5v5'   ? ['GB','DC','MC','ATT','DC']
                  :                  ['GB','MC','ATT','DC','MC'];
  const xiSize = XI_POS.length;

  // ── Équipe du joueur (team 0) : on compose une XI + un banc de la bonne
  // taille (celle du format actif) à partir des MEILLEURS joueurs de
  // l'effectif complet de carrière. AVANT : tout le reste de l'effectif
  // (jusqu'à 18 joueurs) finissait sur le banc du match → banc énorme et
  // déséquilibré face à l'adversaire IA (banc normal). Maintenant, le banc
  // du match a la même taille que celui de l'IA (BENCH_POS) ; le surplus
  // part en réservistes (pas utilisé ce match, mais toujours dans le club).
  const benchSize = BENCH_POS.length;
  // Un joueur blessé ou suspendu est ÉCARTÉ de la feuille de match : il ne peut
  // être ni titulaire, ni remplaçant, ni réserviste alignable. On le retire donc
  // du vivier avant toute composition (avant, aucun filtre n'existait côté V2 :
  // un blessé pouvait être aligné). Les indisponibles sont listés à part pour
  // l'affichage « infirmerie », mais jamais dans teams[0].
  const _isUnavailable = function(p){ return p && ((p._injWeeks||0) > 0 || (p._suspMatches||0) > 0 || p._missNextMatch || (p.yc>=2) || p.red); };
  const injuredOut = (C.players||[]).concat(C.bench||[]).concat(C.reserves||[]).filter(_isUnavailable);

  // ── ON RESPECTE LA SÉLECTION MANUELLE DU JOUEUR ────────────────────────
  // C.players = tes titulaires choisis dans l'onglet Effectif, C.bench = ton
  // banc, C.reserves = écartés (jamais alignés). AVANT, on fusionnait tout et
  // on re-triait par OVR → tes choix étaient ignorés. Maintenant, on part de
  // TA compo : titulaires sains d'abord, puis banc, puis réservistes en
  // dernier recours (si des blessures dépeuplent l'effectif). L'ordre que tu
  // as défini est conservé.
  const clone = function(p){ return Object.assign({}, p); };
  const chosenStarters = (C.players||[]).filter(function(p){ return !_isUnavailable(p); }).map(clone);
  const chosenBench    = (C.bench||[]).filter(function(p){ return !_isUnavailable(p); }).map(clone);
  const chosenReserves = (C.reserves||[]).filter(function(p){ return !_isUnavailable(p); }).map(clone);

  // Titulaires : d'abord TES titulaires, complétés depuis le banc puis la
  // réserve UNIQUEMENT s'il en manque (blessures, format plus grand).
  const starters = [];
  const _pushUnique = function(p){ if(p && starters.indexOf(p)<0 && starters.length<xiSize) starters.push(p); };
  chosenStarters.forEach(_pushUnique);
  // S'il manque des titulaires (indisponibilités), on complète par le banc puis la réserve.
  if(starters.length < xiSize){ chosenBench.forEach(_pushUnique); }
  if(starters.length < xiSize){ chosenReserves.forEach(_pushUnique); }
  // Filet de sécurité gardien : si aucun GB titulaire, on en fait monter un.
  if(!starters.some(function(p){ return p.pos==='GB'; })){
    const gk = chosenBench.concat(chosenReserves).find(function(p){ return p.pos==='GB'; });
    if(gk){ if(starters.length>=xiSize) starters.pop(); starters.unshift(gk); }
  }

  // Banc du match : TON banc uniquement (moins ceux montés titulaires). On NE
  // remonte PAS les réservistes sur le banc — tu les as écartés volontairement.
  // La réserve ne sert qu'à compléter le XI en cas de blessures (ci-dessus).
  const usedForXI = starters.slice();
  const matchBench = [];
  const _pushBench = function(p){ if(p && usedForXI.indexOf(p)<0 && matchBench.indexOf(p)<0 && matchBench.length<benchSize) matchBench.push(p); };
  chosenBench.forEach(_pushBench);
  // Si tu as désigné plus de titulaires que le format n'en accueille, le surplus
  // va sur le banc (c'est TON choix). Les réservistes, eux, n'y vont jamais.
  if(matchBench.length < benchSize){ chosenStarters.forEach(_pushBench); }

  const usedIds = starters.concat(matchBench);
  const fullSquad = chosenStarters.concat(chosenBench, chosenReserves);
  const surplus = fullSquad.filter(function(p){ return usedIds.indexOf(p) < 0; });

  // IMPORTANT : (ré)initialiser onBench/subbedOut sur les joueurs qu'on vient
  // de répartir. Sans ça, un joueur venant du pool "titulaires" (C.players,
  // jamais marqué onBench) qui atterrit sur le banc du match gardait
  // onBench=false → l'écran d'avant-match l'affichait "Indispo" et
  // empêchait tout changement manuel avec lui.
  starters.forEach(function(p){ if(p){ p.onBench=false; p.subbedOut=false; } });
  matchBench.forEach(function(p){ if(p){ p.onBench=true; p.subbedOut=false; } });
  try{ _applyStaffMatchdayBonus(C.club, starters, matchBench); }catch(e){}

  teams[0] = {
    name:    C.club.name,
    color:   C.club.color || '#e02030',
    img:     C.club.img   || '',
    strat:   C.club.strat || '321',
    players: starters,
    bench:   matchBench,
    reserves: surplus,
  };

  // ── Équipe adversaire IA (team 1) — générée au même format et niveau ─
  const aiSquad = _applyDifficultyToSquad(WORLDS.generateSquad(nation, region, {
    positions: XI_POS,
    bench: BENCH_POS,
    reserves: [],
    level: level,
  }));
  // Noms depuis la région ou génériques
  const regionObj = WORLDS.getRegion(nation, region);
  let aiColor   = regionObj ? regionObj.color : '#1878e8';
  let aiBadge   = null;
  // Si l'adversaire est une équipe Valoria (au classement), on récupère sa
  // couleur et son blason propres pour un rendu fidèle.
  const oppStanding = (C.standings||[]).find(function(s){ return s.name===oppName && !s.isPlayer; });
  if(oppStanding){ if(oppStanding.color) aiColor=oppStanding.color; if(oppStanding.badge) aiBadge=oppStanding.badge; }

  teams[1] = {
    name:    oppName,
    color:   aiColor,
    img:     '',
    badge:   aiBadge,
    strat:   '321',
    players: aiSquad.players,
    bench:   aiSquad.bench,
    reserves: [],
  };

  // Appliquer les formations
  applyFormationRoles(0);
  applyFormationRoles(1);

  // Mémoriser le fix en cours pour enregistrer le résultat après match
  window._careerFixPlaying = fix;

  // Réinitialiser l'état moteur AVANT le pré-match, sinon un match précédent
  // laissé en phase 'END' bloque le lancement suivant (le bouton semble inerte).
  nav('match');
  resetMatch();
  // resetMatch() remet leagueMode=false : on (re)pose donc les flags APRÈS.
  G.leagueMode = true; // pour que endMatch sache qu'il faut enregistrer
  G._humanTeams = [true, false]; // le joueur dirige team0 ; l'IA coache team1
  try{ if(typeof resetManagerAi==='function') resetManagerAi(); }catch(e){}
  syncHUD(); renderTB(0); renderTB(1);
  // Lancer le pré-match normal
  showPreMatch(null);
}

// Accumule les buts marqués par l'effectif du joueur pendant le match qui
// vient d'être joué (teams[0], encore intact à ce stade) dans
// C.season_stats.scorers — sert à afficher le meilleur buteur de la saison
// dans l'historique de carrière.
function _accumulateSeasonScorers(C){
  if(!C.season_stats) return;
  if(!C.season_stats.scorers) C.season_stats.scorers = {};
  try{
    (teams[0] && teams[0].players || []).forEach(function(p){
      if(p && p.mG>0) C.season_stats.scorers[p.name] = (C.season_stats.scorers[p.name]||0) + p.mG;
    });
  }catch(e){}
}

function _recordCareerV2MatchResult(){
  if(!careerV2 || !window._careerFixPlaying) return;
  const fix  = window._careerFixPlaying;
  const s0   = G.scores[0]; // notre score (team 0)
  const s1   = G.scores[1]; // adversaire (team 1)
  const C    = careerV2;

  fix.played = true;
  fix.sh = fix.homeIsPlayer ? s0 : s1;
  fix.sa = fix.homeIsPlayer ? s1 : s0;

  // team 0 est TOUJOURS l'équipe du joueur (même affichée à l'extérieur) : nos
  // buts = s0, ceux de l'adversaire = s1, quel que soit le statut dom/ext.
  // (Avant, on permutait selon homeIsPlayer, ce qui inversait le résultat des
  //  matchs à l'extérieur : un 4-0 gagné à l'extérieur était lu comme perdu.)
  const myG = s0;
  const aiG = s1;

  C.season_stats.goals_for     += myG;
  C.season_stats.goals_against += aiG;
  if(myG > aiG){ C.season_stats.wins++;   C.season_stats.points += 3; }
  else if(myG === aiG){ C.season_stats.draws++; C.season_stats.points++; }
  else { C.season_stats.losses++; }
  try{ if(typeof _trackUnbeaten==='function') _trackUnbeaten(myG>aiG, myG===aiG); }catch(e){}
  // Derby : enjeu accru si l'adversaire est le rival.
  try{ if(typeof isRivalFixture==='function' && isRivalFixture(fix) && typeof _resolveRivalResult==='function') _resolveRivalResult(myG, aiG); }catch(e){ console.error('derby:',e); }
  // Presse : titre généré selon le résultat et le contexte.
  try{ if(typeof _pressAfterMatch==='function') _pressAfterMatch(fix, myG, aiG); }catch(e){ console.error('press:',e); }
  try{ if(typeof _socialAfterMatch==='function') _socialAfterMatch(fix, myG, aiG); }catch(e){ console.error('social:',e); }
  try{ if(typeof _maybeInterview==='function') _maybeInterview(fix, myG, aiG); }catch(e){ console.error('interview:',e); }
  // Confiance du board : petite variation à chaque match (silencieuse).
  try{ if(typeof _boardOnMatch==='function') _boardOnMatch(myG, aiG); }catch(e){ console.error('board match:',e); }

  _updateCareerStandings(fix);
  _accumulateSeasonScorers(C);

  const opp = fix.homeIsPlayer ? fix.awayName : fix.homeName;
  const res = myG > aiG ? '✅ Victoire' : myG === aiG ? '🟡 Nul' : '❌ Défaite';
  const col = myG > aiG ? '#18c860' : myG === aiG ? '#f0c028' : '#e06060';
  logEvent(res+' ! '+C.club.name+' '+myG+'-'+aiG+' '+opp, col);

  const rev = fix.homeIsPlayer ? Math.round(50 + C.club.fanbase * 0.05) : 10;
  C.club.budget += rev;
  _addFinanceLog('Recettes match vs '+opp, rev);

  // ── RÉCUPÉRATION DES BLESSURES DU MATCH ────────────────────────────────
  // teams[0] est un CLONE de l'effectif : les blessures survenues pendant le
  // match (injLevel posé sur le clone) doivent être recopiées sur les vrais
  // joueurs de la carrière et converties en indisponibilité (au moins 1 match).
  // Sans ça, une blessure de match disparaissait à la fin de la rencontre.
  try{
    const squad = (C.players||[]).concat(C.bench||[], C.reserves||[]);
    (teams[0] && teams[0].players || []).forEach(function(mp){
      if(!mp || !(mp.injLevel>0)) return;
      // Retrouver le vrai joueur (par id, sinon par nom).
      const real = squad.find(function(rp){
        return rp && ((mp.id!=null && rp.id===mp.id) || rp.name===mp.name);
      });
      if(!real) return;
      if((real._injWeeks||0) > 0) return;              // déjà blessé
      if(typeof _applyCareerInjury==='function'){
        _applyCareerInjury(real, mp.injLevel);         // pose _injWeeks + _missNextMatch + moral
      } else {
        real._injWeeks = Math.max(real._injWeeks||0, 1);
        real._missNextMatch = true; real.injLevel = mp.injLevel;
      }
    });
  }catch(e){ console.error('harvest injuries:', e); }

  // ── SUSPENSIONS SUR CARTON ROUGE / DOUBLE JAUNE ────────────────────────
  // Symétrique aux blessures : un joueur expulsé pendant le match (red ou
  // yc>=2 sur le clone) doit être SUSPENDU au(x) match(s) suivant(s). Sans ça,
  // le carton restait sur le clone jeté et l'expulsé rejouait aussitôt.
  //   rouge direct → 2 matchs · double jaune → 1 match.
  try{
    const squad = (C.players||[]).concat(C.bench||[], C.reserves||[]);
    (teams[0] && teams[0].players || []).forEach(function(mp){
      if(!mp) return;
      const sentOff = mp.red || (mp.yc>=2);
      if(!sentOff) return;
      const real = squad.find(function(rp){
        return rp && ((mp.id!=null && rp.id===mp.id) || rp.name===mp.name);
      });
      if(!real) return;
      const ban = mp.red ? 2 : 1;                       // rouge direct plus lourd
      real._suspMatches = Math.max(real._suspMatches||0, ban);
      real._missNextMatch = true;
      if(typeof careerLog==='function'){
        careerLog('🟥 '+real.name+' est suspendu '+ban+' match'+(ban>1?'s':'')+'.', '#e02030');
      }
    });
  }catch(e){ console.error('harvest cards:', e); }

  // Purge d'une journée de suspension : après CE match, chaque joueur suspendu
  // a purgé un match. Quand le compteur tombe à 0, il redevient disponible.
  try{
    (C.players||[]).concat(C.bench||[], C.reserves||[]).forEach(function(p){
      if(!p || !(p._suspMatches>0)) return;
      // On ne purge que ceux qui n'ont pas ÉTÉ expulsés à l'instant (déjà remis
      // à leur pleine sanction ci-dessus). Les autres suspendus purgent 1 match.
      const justSentOff = (teams[0]&&teams[0].players||[]).some(function(mp){
        return mp && (mp.red||mp.yc>=2) && ((mp.id!=null&&mp.id===p.id)||mp.name===p.name);
      });
      if(justSentOff) return;
      p._suspMatches = Math.max(0, (p._suspMatches||0) - 1);
      if(p._suspMatches===0){
        // Plus suspendu : on lève le drapeau seulement s'il n'est pas blessé.
        if(!(p._injWeeks>0)) p._missNextMatch = false;
        if(typeof careerLog==='function') careerLog('✅ '+p.name+' a purgé sa suspension.', '#18c860');
      }
    });
  }catch(e){ console.error('suspension purge:', e); }

  window._careerFixPlaying = null;
  // Le match du jour est réglé : on peut désormais avancer au jour suivant.
  if(C._pendingMatch) C._pendingMatch = null;
  saveCareerV2();
}

// ── MATCH AMICAL (planifié librement par le dirigeant) ─────────────────────
// Construit l'équipe du joueur + l'adversaire choisi (à SON niveau), lance le
// match jouable, et n'affecte que le moral/la forme (jamais le classement).
function playCareerFriendlyMatch(){
  if(!careerV2) return;
  const C = careerV2;
  const pm = C._pendingMatch;
  const dk = (pm && pm.friendly) ? pm.dateKey : _dateKey(C.date);
  const plan = C.dayPlans && C.dayPlans[dk];
  if(!plan || plan.type!=='friendly' || !plan.oppName){ logEvent('Aucun amical prévu aujourd\'hui.','#e02030'); return; }

  const nation = C.nation || 'panthalassa';
  const region = C.club.region;
  const oppLevel = (typeof _friendlyOppEngineLevel==='function') ? _friendlyOppEngineLevel(plan) : (plan.oppLevel||'r2');

  const mode = window.gameMode || '7v7';
  const XI_POS = mode==='11v11' ? ['GB','DD','DC','DC','DG','MC','MC','MC','MC','ATT','ATT']
               : mode==='5v5'   ? ['GB','DC','MOG','MOD','ATT']
               :                  ['GB','DC','DD','DG','MC','MC','ATT'];
  const BENCH_POS = mode==='11v11' ? ['GB','DC','MC','MC','ATT','DD','DG']
                  : mode==='5v5'   ? ['GB','DC','MC','ATT','DC']
                  :                  ['GB','MC','ATT','DC','MC'];
  const xiSize = XI_POS.length, benchSize = BENCH_POS.length;

  // Équipe du joueur (mêmes règles que le championnat).
  const fullSquad = (C.players||[]).map(function(p){ return Object.assign({}, p); })
    .concat((C.bench||[]).map(function(p){ return Object.assign({}, p); }));
  const gkPool = fullSquad.filter(function(p){ return p && p.pos==='GB'; }).sort(function(a,b){ return _playerOvr(b)-_playerOvr(a); });
  const outfieldPool = fullSquad.filter(function(p){ return p && p.pos!=='GB'; }).sort(function(a,b){ return _playerOvr(b)-_playerOvr(a); });
  const starters = [];
  if(gkPool[0]) starters.push(gkPool[0]);
  outfieldPool.forEach(function(p){ if(starters.length < xiSize) starters.push(p); });
  const leftoverGk  = gkPool.slice(1);
  const leftoverOut = outfieldPool.filter(function(p){ return starters.indexOf(p) < 0; });
  const matchBench = [];
  if(leftoverGk[0]) matchBench.push(leftoverGk[0]);
  leftoverGk.slice(1).concat(leftoverOut).forEach(function(p){ if(matchBench.length < benchSize) matchBench.push(p); });
  const usedIds = starters.concat(matchBench);
  const surplus = fullSquad.filter(function(p){ return usedIds.indexOf(p) < 0; });
  starters.forEach(function(p){ if(p){ p.onBench=false; p.subbedOut=false; } });
  matchBench.forEach(function(p){ if(p){ p.onBench=true; p.subbedOut=false; } });
  try{ _applyStaffMatchdayBonus(C.club, starters, matchBench); }catch(e){}

  teams[0] = {
    name: C.club.name, color: C.club.color||'#e02030', img: C.club.img||'',
    strat: C.club.strat||'321',
    players: starters, bench: matchBench,
    reserves: surplus.concat((C.reserves||[]).map(function(p){ return Object.assign({}, p); })),
  };

  let aiSquad;
  try{
    aiSquad = _applyDifficultyToSquad(WORLDS.generateSquad(nation, region, { positions: XI_POS, bench: BENCH_POS, reserves: [], level: oppLevel }));
  }catch(e){
    console.error('friendly ai squad:', e);
    logEvent('⚠️ Impossible de générer l\'adversaire amical. Match simulé à la place.','#e0a020');
    simCareerFriendlyMatch(); return;
  }
  if(!aiSquad || !(aiSquad.players||[]).length){ simCareerFriendlyMatch(); return; }

  teams[1] = {
    name: plan.oppName, color: plan.oppColor||'#1878e8', img:'', badge: plan.oppBadge||null,
    strat:'321', players: aiSquad.players, bench: aiSquad.bench, reserves: [],
  };

  applyFormationRoles(0);
  applyFormationRoles(1);

  window._careerFriendlyPlaying = { dateKey: dk, oppName: plan.oppName };

  nav('match');
  resetMatch();
  G.leagueMode = true; // pour router endMatch() vers l'enregistrement carrière
  G._humanTeams = [true, false];
  try{ if(typeof resetManagerAi==='function') resetManagerAi(); }catch(e){}
  syncHUD(); renderTB(0); renderTB(1);
  showPreMatch(null);
}

// Simule un amical sans le jouer (résultat rapide, effets moral/forme).
function simCareerFriendlyMatch(){
  if(!careerV2) return;
  const C = careerV2;
  const pm = C._pendingMatch;
  const dk = (pm && pm.friendly) ? pm.dateKey : _dateKey(C.date);
  const plan = C.dayPlans && C.dayPlans[dk];
  if(!plan || plan.type!=='friendly'){ return; }
  // Force du joueur = OVR moyen de l'effectif ramené sur 0..1.
  const _sq = (C.players||[]).concat(C.bench||[]);
  const myStr = _sq.length
    ? Math.min(0.95, Math.max(0.2, (_sq.reduce(function(a,p){ return a+_playerOvr(p); },0)/_sq.length)/100))
    : 0.6;
  const oppLvl = (typeof _friendlyOppEngineLevel==='function') ? _friendlyOppEngineLevel(plan) : 'r2';
  const oppStr = ({d1:0.9,d2:0.8,d3:0.7,r1:0.6,r2:0.5,r3:0.4,dh:0.3})[oppLvl] || 0.5;
  const gf = Math.max(0, Math.round(myStr*3 + Math.random()*1.6 - 1));
  const ga = Math.max(0, Math.round(oppStr*3 + Math.random()*1.6 - 1));
  _applyFriendlyOutcome(gf, ga, plan.oppName);
  if(C.dayPlans) delete C.dayPlans[dk];
  if(C._pendingMatch) C._pendingMatch = null;
  saveCareerV2();
  renderCareerV2();
}

// Effets d'un amical (moral + forme + petites blessures), SANS toucher au
// classement ni aux finances de championnat.
function _applyFriendlyOutcome(gf, ga, oppName){
  const C = careerV2; if(!C) return;
  const win = gf>ga, draw = gf===ga;
  const _mDrop = (typeof STAFF!=='undefined') ? STAFF.moraleDropMul(C.club) : 1;
  const squad = (C.players||[]).concat(C.bench||[]).concat(C.reserves||[]);
  squad.forEach(function(p){
    if(!p) return;
    let dm = win?1.0:draw?0.3:-0.4;
    if(dm < 0) dm *= _mDrop; // préparateur mental : atténue les baisses de moral
    p._hm = Math.max(-10, Math.min(10, (p._hm||0) + dm));
    p._fm = Math.min(10, (p._fm||0) + 0.4); // un match entretient la forme
    if(Math.random()<0.008 && (p.injLevel||0)===0){ p.injLevel=1; p.injT=1+Math.floor(Math.random()*2); }
  });
  const res = win?'✅ victoire':draw?'🟡 nul':'❌ défaite';
  const col = win?'#18c860':draw?'#f0c028':'#e06060';
  careerLog('🤝 Amical : '+C.club.name+' '+gf+'-'+ga+' '+(oppName||'')+' — '+res+' (moral & forme ajustés).', col);
}

function _recordCareerV2FriendlyResult(){
  if(!careerV2 || !window._careerFriendlyPlaying) return;
  const ref = window._careerFriendlyPlaying;
  window._careerFriendlyPlaying = null;
  const C = careerV2;
  try{ _applyFriendlyOutcome(G.scores[0], G.scores[1], ref.oppName); }catch(e){ console.error('friendly record:', e); }
  if(C.dayPlans && ref.dateKey) delete C.dayPlans[ref.dateKey];
  if(C._pendingMatch) C._pendingMatch = null;
  saveCareerV2();
}
// Charge l'adversaire de coupe (potentiellement d'une AUTRE division que le
// club joueur) au bon niveau, lance le match interactif, et mémorise la paire
// du bracket à résoudre à la fin. Corrige deux bugs :
//   1) la coupe n'était jamais jouable (seul « Simuler » existait) ;
//   2) l'adversaire était généré au niveau du joueur → incohérences/plantages
//      silencieux quand il venait d'une autre division. On lit son vrai level.
function playCareerCupMatch(){
  if(!careerV2) return;
  const C = careerV2;
  const cup = C.cup;
  if(!cup || cup.winner || cup.playerOut){ logEvent('Aucun tour de coupe à jouer.','#e02030'); return; }
  const bracket = cup.bracket || [];
  // Trouver la confrontation du joueur, encore à jouer, dans le tour courant.
  const m = bracket.find(function(x){ return !x.played && ((x.a&&x.a.isPlayer)||(x.b&&x.b.isPlayer)); });
  if(!m){ logEvent('Aucun match de coupe en attente pour votre club.','#e02030'); return; }

  const me  = (m.a&&m.a.isPlayer) ? m.a : m.b;
  const opp = (m.a&&m.a.isPlayer) ? m.b : m.a;

  // Tour exempt (bye) : pas d'adversaire → on résout directement sans terrain.
  if(!opp){
    _resolveCareerCupPlayerPair(m, null, null);
    if(C._pendingMatch) C._pendingMatch = null;
    saveCareerV2();
    renderCareerV2();
    return;
  }

  const nation = C.nation || 'panthalassa';
  const region = C.club.region;
  // Niveau RÉEL de l'adversaire : celui stocké dans le bracket (sa division),
  // pas celui du club joueur. Fallback prudent sur le niveau du joueur.
  const oppLevel = opp.level || C.club.level || 'dh';

  const mode = window.gameMode || '7v7';
  const XI_POS = mode==='11v11' ? ['GB','DD','DC','DC','DG','MC','MC','MC','MC','ATT','ATT']
               : mode==='5v5'   ? ['GB','DC','MOG','MOD','ATT']
               :                  ['GB','DC','DD','DG','MC','MC','ATT'];
  const BENCH_POS = mode==='11v11' ? ['GB','DC','MC','MC','ATT','DD','DG']
                  : mode==='5v5'   ? ['GB','DC','MC','ATT','DC']
                  :                  ['GB','MC','ATT','DC','MC'];
  const xiSize = XI_POS.length, benchSize = BENCH_POS.length;

  // Équipe du joueur (mêmes règles que le championnat).
  const fullSquad = (C.players||[]).map(function(p){ return Object.assign({}, p); })
    .concat((C.bench||[]).map(function(p){ return Object.assign({}, p); }));
  const gkPool = fullSquad.filter(function(p){ return p && p.pos==='GB'; }).sort(function(a,b){ return _playerOvr(b)-_playerOvr(a); });
  const outfieldPool = fullSquad.filter(function(p){ return p && p.pos!=='GB'; }).sort(function(a,b){ return _playerOvr(b)-_playerOvr(a); });
  const starters = [];
  if(gkPool[0]) starters.push(gkPool[0]);
  outfieldPool.forEach(function(p){ if(starters.length < xiSize) starters.push(p); });
  const leftoverGk  = gkPool.slice(1);
  const leftoverOut = outfieldPool.filter(function(p){ return starters.indexOf(p) < 0; });
  const matchBench = [];
  if(leftoverGk[0]) matchBench.push(leftoverGk[0]);
  leftoverGk.slice(1).concat(leftoverOut).forEach(function(p){ if(matchBench.length < benchSize) matchBench.push(p); });
  const usedIds = starters.concat(matchBench);
  const surplus = fullSquad.filter(function(p){ return usedIds.indexOf(p) < 0; });
  starters.forEach(function(p){ if(p){ p.onBench=false; p.subbedOut=false; } });
  matchBench.forEach(function(p){ if(p){ p.onBench=true; p.subbedOut=false; } });
  try{ _applyStaffMatchdayBonus(C.club, starters, matchBench); }catch(e){}

  const isHome = !!(m.a && m.a.isPlayer); // convention : m.a joue à domicile
  teams[0] = {
    name: C.club.name, color: C.club.color || '#e02030', img: C.club.img || '',
    strat: C.club.strat || '321',
    players: starters, bench: matchBench,
    reserves: surplus.concat((C.reserves||[]).map(function(p){ return Object.assign({}, p); })),
  };

  // Adversaire généré à SON niveau de division (fix bug 2).
  let aiSquad;
  try{
    aiSquad = _applyDifficultyToSquad(WORLDS.generateSquad(nation, region, {
      positions: XI_POS, bench: BENCH_POS, reserves: [], level: oppLevel,
    }));
  }catch(e){
    console.error('cup ai squad:', e);
    logEvent('⚠️ Impossible de générer l\'adversaire de coupe. Match simulé à la place.','#e0a020');
    // Repli sûr : on simule ce tour plutôt que de planter silencieusement.
    try{ _advanceNationalCup(true); }catch(e2){ console.error('cup fallback:',e2); }
    if(C._pendingMatch) C._pendingMatch = null;
    saveCareerV2(); renderCareerV2();
    return;
  }
  if(!aiSquad || !(aiSquad.players||[]).length){
    logEvent('⚠️ Adversaire de coupe invalide. Match simulé à la place.','#e0a020');
    try{ _advanceNationalCup(true); }catch(e2){ console.error('cup fallback:',e2); }
    if(C._pendingMatch) C._pendingMatch = null;
    saveCareerV2(); renderCareerV2();
    return;
  }

  teams[1] = {
    name: opp.name, color: opp.color || '#1878e8', img: '', badge: opp.badge || null,
    strat: '321', players: aiSquad.players, bench: aiSquad.bench, reserves: [],
  };

  applyFormationRoles(0);
  applyFormationRoles(1);

  // Mémoriser la paire de coupe à résoudre après le match.
  window._careerCupPlaying = { match: m, isHome: isHome };

  // Réinitialiser l'état moteur AVANT le pré-match (sinon un match précédent en
  // phase 'END' bloque le lancement).
  nav('match');
  resetMatch();
  // resetMatch() remet leagueMode=false : on (re)pose donc les flags APRÈS.
  G.leagueMode = true; // route endMatch() vers _recordCareerV2CupMatchResult
  G._humanTeams = [true, false]; // le joueur dirige team0 ; l'IA coache team1
  try{ if(typeof resetManagerAi==='function') resetManagerAi(); }catch(e){}
  syncHUD(); renderTB(0); renderTB(1);
  showPreMatch(null);
}

// Résout la paire de coupe du joueur (scores myG/oppG déjà connus), applique
// primes/élimination puis fait avancer le reste du tour et le bracket.
function _resolveCareerCupPlayerPair(m, myG, oppG){
  const C = careerV2; const cup = C.cup; if(!cup) return;
  const roundIdx = cup.round;
  const me  = (m.a&&m.a.isPlayer) ? m.a : m.b;
  const opp = (m.a&&m.a.isPlayer) ? m.b : m.a;

  if(!opp){
    // Bye : qualification directe.
    m.played = true; m.winner = me;
    const prime = _prizeCupRound(roundIdx, cup.roundNames.length, 'national');
    _prizePay(prime, cup.name+' — '+cup.roundNames[roundIdx]+' (exempt)', '#18c860');
    careerLog('🏆 '+cup.name+' ('+cup.roundNames[roundIdx]+') — exempt, qualification directe ! Prime '+fmtG(prime), '#18c860');
  } else {
    // Renseigner le score dans le bon sens (m.a = home).
    const aIsPlayer = !!(m.a && m.a.isPlayer);
    let ga = aIsPlayer ? myG : oppG;
    let gb = aIsPlayer ? oppG : myG;
    if(ga===gb){ // pas de nul en coupe : léger avantage au joueur pour la séance de tirs
      if(Math.random() < 0.5) { aIsPlayer?ga++:gb++; } else { aIsPlayer?gb++:ga++; }
    }
    m.ga = ga; m.gb = gb; m.played = true;
    m.winner = (ga>gb) ? m.a : m.b;
    const playerWon = m.winner && m.winner.isPlayer;
    if(playerWon){
      const prime = _prizeCupRound(roundIdx, cup.roundNames.length, 'national');
      _prizePay(prime, cup.name+' — '+cup.roundNames[roundIdx]+' remporté', '#18c860');
      careerLog('🏆 '+cup.name+' ('+cup.roundNames[roundIdx]+') — VICTOIRE '+myG+'-'+oppG+' vs '+opp.name+' ! Prime '+fmtG(prime), '#18c860');
    } else {
      cup.playerOut = true;
      careerLog('🏆 '+cup.name+' ('+cup.roundNames[roundIdx]+') — élimination '+myG+'-'+oppG+' vs '+opp.name+'.', '#e06060');
    }
  }

  // Résoudre les AUTRES matchs du tour (simulés) puis avancer le bracket.
  const survivors = [];
  cup.bracket.forEach(function(x){
    if(x.played){ if(x.winner) survivors.push(x.winner); return; }
    const res = _cupSimMatch(x.a, x.b);
    if(res.winner){ x.winner=res.winner; x.ga=res.ga; x.gb=res.gb; x.played=true; survivors.push(res.winner); }
  });
  cup.round++;
  _finalizeCupRound(C, cup, survivors);
}

function _recordCareerV2CupMatchResult(){
  if(!careerV2 || !window._careerCupPlaying) return;
  const ref = window._careerCupPlaying;
  window._careerCupPlaying = null;
  const s0 = G.scores[0]; // joueur (team 0)
  const s1 = G.scores[1]; // adversaire (team 1)
  try{
    _resolveCareerCupPlayerPair(ref.match, s0, s1);
    _accumulateSeasonScorers(careerV2);
  }catch(e){ console.error('cup record:', e); }
  if(careerV2._pendingMatch) careerV2._pendingMatch = null;
  saveCareerV2();
}

function simCareerMatchDirector(){
  if(!careerV2) return;
  const C = careerV2;
  if(C._pendingMatch && C._pendingMatch.cup){
    try{ _advanceNationalCup(); }catch(e){ console.error('cup:',e); }
    C._pendingMatch = null;
    saveCareerV2();
    renderCareerV2();
    return;
  }
  const fix = C._pendingMatch && C._pendingMatch.fixtureId
    ? (C.fixtures||[]).find(function(f){ return f.id===C._pendingMatch.fixtureId; })
    : (C.fixtures||[]).find(function(f){ return !f.played; });
  if(!fix){ logEvent('Aucun match a simuler !','#e02030'); return; }

  const myPlayers = C.players || [];
  const myStr = myPlayers.reduce(function(s,p){
    return s + ((p.s&&p.s.sht||10)+(p.s&&p.s.spd||10)+(p.s&&p.s.tec||10))/3;
  }, 0) / Math.max(1, myPlayers.length);

  const aiStr = _careerOppStrength(fix, myStr);
  const isHome = fix.homeIsPlayer;
  const myGoals = _poissonGoals((myStr/Math.max(1,aiStr)) * (isHome?1.1:0.9) * 0.8);
  const aiGoals = _poissonGoals((aiStr/Math.max(1,myStr)) * (isHome?0.9:1.1) * 0.8);

  fix.played = true;
  fix.sh = isHome ? myGoals : aiGoals;
  fix.sa = isHome ? aiGoals : myGoals;

  const myG = isHome ? fix.sh : fix.sa;
  const aiG = isHome ? fix.sa : fix.sh;
  C.season_stats.goals_for  += myG;
  C.season_stats.goals_against += aiG;
  if(myG > aiG){ C.season_stats.wins++;   C.season_stats.points += 3; }
  else if(myG === aiG){ C.season_stats.draws++; C.season_stats.points++; }
  else { C.season_stats.losses++; }
  try{ if(typeof _trackUnbeaten==='function') _trackUnbeaten(myG>aiG, myG===aiG); }catch(e){}
  // Derby : enjeu accru si l'adversaire est le rival.
  try{ if(typeof isRivalFixture==='function' && isRivalFixture(fix) && typeof _resolveRivalResult==='function') _resolveRivalResult(myG, aiG); }catch(e){ console.error('derby:',e); }
  // Presse : titre généré selon le résultat et le contexte.
  try{ if(typeof _pressAfterMatch==='function') _pressAfterMatch(fix, myG, aiG); }catch(e){ console.error('press:',e); }
  try{ if(typeof _socialAfterMatch==='function') _socialAfterMatch(fix, myG, aiG); }catch(e){ console.error('social:',e); }
  try{ if(typeof _maybeInterview==='function') _maybeInterview(fix, myG, aiG); }catch(e){ console.error('interview:',e); }
  // Confiance du board : petite variation à chaque match (silencieuse).
  try{ if(typeof _boardOnMatch==='function') _boardOnMatch(myG, aiG); }catch(e){ console.error('board match:',e); }

  _updateCareerStandings(fix);

  const opp = isHome ? fix.awayName : fix.homeName;
  const res = myG > aiG ? 'Victoire' : myG === aiG ? 'Nul' : 'Defaite';
  const col = myG > aiG ? '#18c860' : myG === aiG ? '#f0c028' : '#e06060';
  logEvent(res+' ! '+C.club.name+' '+myG+'-'+aiG+' '+opp, col);

  const rev = isHome ? Math.round(50 + C.club.fanbase * 0.1) : 20;
  C.club.budget += rev;
  _addFinanceLog('Recettes match vs '+opp, rev);

  if(C._pendingMatch) C._pendingMatch = null;
  saveCareerV2();
  renderCareerV2();
}

function _poissonGoals(lambda){
  lambda = Math.max(0.2, Math.min(4, lambda));
  var L = Math.exp(-lambda), k = 0, p = 1;
  do { k++; p *= Math.random(); } while(p > L);
  return k - 1;
}

// Force réelle de l'adversaire d'un fixture — le bug « toujours 4-0 » venait de
// ce que le bloc « Simuler » calculait l'adversaire comme myStr*(0.7..1.3),
// donc jamais la vraie équipe : si TON effectif était un peu fort, l'adversaire
// l'était tout autant en proportion, sauf que les autres multiplicateurs
// faisaient dériver le résultat. On calcule désormais une vraie force à partir
// de l'effectif adverse (opponentSquads) ou, à défaut, de son rang au
// classement.
function _careerOppStrength(fix, myStr){
  var C = careerV2;
  if(!C || !fix) return myStr;
  var oppId   = fix.homeIsPlayer ? fix.away : fix.home;
  var oppName = fix.homeIsPlayer ? fix.awayName : fix.homeName;

  // 1) Effectif adverse connu → moyenne de ses stats offensives (même mesure
  //    que myStr, pour une comparaison honnête).
  var entry = (C.opponentSquads || {})[oppName];
  if(entry && entry.squad && entry.squad.players && entry.squad.players.length){
    var ps = entry.squad.players;
    var s = ps.reduce(function(acc,p){
      return acc + ((p.s&&p.s.sht||10)+(p.s&&p.s.spd||10)+(p.s&&p.s.tec||10))/3;
    }, 0) / ps.length;
    if(s > 0) return s;
  }

  // 2) Sinon, dérivée du rang au classement : un club haut placé est plus fort.
  var st = C.standings || [];
  var sorted = st.slice().sort(function(a,b){ return (b.Pts||0)-(a.Pts||0); });
  var idx = sorted.findIndex(function(x){ return x.id===oppId || x.name===oppName; });
  if(idx >= 0 && sorted.length > 1){
    // Meilleur rang (idx petit) → force plus haute, autour de myStr ±25%.
    var frac = idx / (sorted.length - 1);           // 0 = 1er, 1 = dernier
    return myStr * (1.25 - frac * 0.5);
  }

  // 3) Dernier recours : force proche de la nôtre, légèrement aléatoire.
  return myStr * (0.85 + Math.random() * 0.3);
}

function _updateCareerStandings(fix){
  if(!careerV2 || !careerV2.standings) return;
  function upd(id, gf, ga){
    var s = careerV2.standings.find(function(x){ return x.id === id; });
    if(!s) return;
    s.P++; s.GF += gf; s.GA += ga;
    if(gf > ga){ s.W++; s.Pts += 3; }
    else if(gf === ga){ s.D++; s.Pts++; }
    else s.L++;
  }
  upd(fix.home, fix.sh, fix.sa);
  upd(fix.away, fix.sa, fix.sh);
  // Les autres matchs PNJ de la journée (et tous ceux en retard) sont résolus
  // par la simulation de fond, basée sur la force réelle des équipes.
  try{
    if(typeof _simulateBackgroundNpcFixtures==='function'){
      const upTo = fix.date || careerV2.date;
      _simulateBackgroundNpcFixtures(upTo);
    }
  }catch(e){ console.error('npc bg sim:',e); }
}

// Compare deux niveaux de la pyramide : renvoie true si `a` est un échelon
// SUPÉRIEUR (meilleur) que `b`. Sert à détecter promotion vs relégation.
function _levelRankBetter(a, b){
  try{
    const C = careerV2;
    const pyramid = WORLDS.getPyramid((C&&C.nation)||'panthalassa') || [];
    const levels = pyramid.map(function(p){ return p.id; });
    const ia = levels.indexOf(a), ib = levels.indexOf(b);
    if(ia<0 || ib<0) return false;
    return ia < ib; // index plus petit = division plus haute
  }catch(e){ return false; }
}

// ── BARRAGE DE DISTRICT (Valoria) — match JOUABLE ───────────────────────────
// Construit l'équipe du joueur + l'adversaire réel de la poule (à SON niveau
// de division) et lance le match sur le terrain, exactement comme un tour de
// coupe. Le résultat est ensuite enregistré par _recordCareerV2PlayoffMatchResult.
function playCareerPlayoffMatch(){
  if(!careerV2) return;
  const C = careerV2;
  const po = C.playoffs;
  if(!po || !po.active || po.done){ logEvent('Aucun barrage à jouer.','#e02030'); return; }
  const m = po.matches[po.idx];
  if(!m || m.played){ logEvent('Aucun barrage en attente.','#e02030'); return; }

  const nation = C.nation || 'valoria';
  const region = C.club.region;
  const oppLevel = m.oppLevel || C.club.level || 'dh';

  const mode = window.gameMode || '7v7';
  const XI_POS = mode==='11v11' ? ['GB','DD','DC','DC','DG','MC','MC','MC','MC','ATT','ATT']
               : mode==='5v5'   ? ['GB','DC','MOG','MOD','ATT']
               :                  ['GB','DC','DD','DG','MC','MC','ATT'];
  const BENCH_POS = mode==='11v11' ? ['GB','DC','MC','MC','ATT','DD','DG']
                  : mode==='5v5'   ? ['GB','DC','MC','ATT','DC']
                  :                  ['GB','MC','ATT','DC','MC'];
  const xiSize = XI_POS.length, benchSize = BENCH_POS.length;

  const fullSquad = (C.players||[]).map(function(p){ return Object.assign({}, p); })
    .concat((C.bench||[]).map(function(p){ return Object.assign({}, p); }));
  const gkPool = fullSquad.filter(function(p){ return p && p.pos==='GB'; }).sort(function(a,b){ return _playerOvr(b)-_playerOvr(a); });
  const outfieldPool = fullSquad.filter(function(p){ return p && p.pos!=='GB'; }).sort(function(a,b){ return _playerOvr(b)-_playerOvr(a); });
  const starters = [];
  if(gkPool[0]) starters.push(gkPool[0]);
  outfieldPool.forEach(function(p){ if(starters.length < xiSize) starters.push(p); });
  const leftoverGk  = gkPool.slice(1);
  const leftoverOut = outfieldPool.filter(function(p){ return starters.indexOf(p) < 0; });
  const matchBench = [];
  if(leftoverGk[0]) matchBench.push(leftoverGk[0]);
  leftoverGk.slice(1).concat(leftoverOut).forEach(function(p){ if(matchBench.length < benchSize) matchBench.push(p); });
  const usedIds = starters.concat(matchBench);
  const surplus = fullSquad.filter(function(p){ return usedIds.indexOf(p) < 0; });
  starters.forEach(function(p){ if(p){ p.onBench=false; p.subbedOut=false; } });
  matchBench.forEach(function(p){ if(p){ p.onBench=true; p.subbedOut=false; } });
  try{ _applyStaffMatchdayBonus(C.club, starters, matchBench); }catch(e){}

  teams[0] = {
    name: C.club.name, color: C.club.color || '#e02030', img: C.club.img || '',
    strat: C.club.strat || '321',
    players: starters, bench: matchBench,
    reserves: surplus.concat((C.reserves||[]).map(function(p){ return Object.assign({}, p); })),
  };

  let aiSquad;
  try{
    aiSquad = _applyDifficultyToSquad(WORLDS.generateSquad(nation, region, {
      positions: XI_POS, bench: BENCH_POS, reserves: [], level: oppLevel,
    }));
  }catch(e){
    console.error('playoff ai squad:', e);
    logEvent('⚠️ Impossible de générer l\'adversaire du barrage. Match simulé à la place.','#e0a020');
    simCareerPlayoffMatch();
    return;
  }
  if(!aiSquad || !(aiSquad.players||[]).length){
    logEvent('⚠️ Adversaire du barrage invalide. Match simulé à la place.','#e0a020');
    simCareerPlayoffMatch();
    return;
  }

  teams[1] = {
    name: m.oppName, color: '#1878e8', img: '', badge: null,
    strat: '321', players: aiSquad.players, bench: aiSquad.bench, reserves: [],
  };

  applyFormationRoles(0);
  applyFormationRoles(1);

  window._careerPlayoffPlaying = { matchIndex: po.idx };

  nav('match');
  resetMatch();
  G.leagueMode = true; // route endMatch() vers _recordCareerV2PlayoffMatchResult
  G._humanTeams = [true, false];
  try{ if(typeof resetManagerAi==='function') resetManagerAi(); }catch(e){}
  syncHUD(); renderTB(0); renderTB(1);
  showPreMatch(null);
}

// Version rapide (bouton "⚡ Simuler") : résout le match du joueur par force
// + aléa au lieu de le jouer sur le terrain, puis enregistre le résultat par
// le même chemin que le match joué.
function simCareerPlayoffMatch(){
  if(!careerV2) return;
  const C = careerV2;
  const po = C.playoffs;
  if(!po || !po.active || po.done){ logEvent('Aucun barrage à simuler.','#e02030'); return; }
  const m = po.matches[po.idx];
  if(!m || m.played){ logEvent('Aucun barrage en attente.','#e02030'); return; }

  const myPlayers = C.players || [];
  const myStr = myPlayers.reduce(function(s,p){
    return s + ((p.s&&p.s.sht||10)+(p.s&&p.s.spd||10)+(p.s&&p.s.tec||10))/3;
  }, 0) / Math.max(1, myPlayers.length);
  const oppStr = m.oppStrength || myStr;
  const isHome = !!m.isHome;
  const myGoals = _poissonGoals((myStr/Math.max(1,oppStr)) * (isHome?1.1:0.9) * 0.8);
  const oppGoals = _poissonGoals((oppStr/Math.max(1,myStr)) * (isHome?0.9:1.1) * 0.8);

  _recordPlayoffLegResult(myGoals, oppGoals);
  saveCareerV2();
  renderCareerV2();
}

// Cœur commun : enregistre le score d'un match de barrage (joué ou simulé),
// avance au match suivant, et finalise la poule au bout des 3 matchs.
function _recordPlayoffLegResult(myG, oppG){
  const C = careerV2; if(!C || !C.playoffs) return;
  const po = C.playoffs;
  const m = po.matches[po.idx];
  if(!m) return;
  m.played = true; m.scoreMe = myG; m.scoreOpp = oppG;

  const res = myG > oppG ? '✅ Victoire' : myG === oppG ? '🟡 Nul' : '❌ Défaite';
  const col = myG > oppG ? '#18c860' : myG === oppG ? '#f0c028' : '#e06060';
  logEvent(res+' (barrage) ! '+C.club.name+' '+myG+'-'+oppG+' '+m.oppName, col);

  po.idx++;
  if(po.idx >= po.matches.length){
    if(po.stage === 'final'){
      try{ _valoriaFinalizeDistrictFinal(C); }catch(e){ console.error('finalize final:',e); }
      if(po.promoted){ logEvent('🎉 Poule finale remportée ! '+po.detail, C.club.color||'#f0c028'); }
      else { logEvent('⚔️ Poule finale terminée : '+po.detail, C.club.color||'#f0c028'); }
    } else {
      try{ _valoriaFinalizeDistrictPlayoffs(C); }catch(e){ console.error('finalize playoffs:',e); }
      if(po.done && !po.promoted){
        logEvent('⚔️ Barrages de district : '+po.detail, C.club.color||'#f0c028');
      } else if(po.stage === 'final'){
        logEvent('🏟️ '+po.detail+' Les matchs de la poule finale arrivent.', C.club.color||'#f0c028');
      }
    }
  }
  if(C._pendingMatch) C._pendingMatch = null;
}

// Appelé par endMatch() (visual.js) quand le match joué était un barrage.
function _recordCareerV2PlayoffMatchResult(){
  if(!careerV2 || !window._careerPlayoffPlaying) return;
  const s0 = G.scores[0]; // notre score (team 0 = toujours le joueur ici)
  const s1 = G.scores[1]; // adversaire
  _accumulateSeasonScorers(careerV2);
  _recordPlayoffLegResult(s0, s1);
  window._careerPlayoffPlaying = null;
  saveCareerV2();
}

// ── BARRAGE D'ACCESSION (Pilier) — match JOUABLE ────────────────────────────
// Construit l'équipe du joueur + l'adversaire réel du barrage (le dernier du
// bloc visé, à SON niveau de division) et lance le match sur le terrain,
// exactement comme un tour de coupe. Le résultat est ensuite enregistré par
// _recordCareerV2BarrageMatchResult.
function playCareerBarrageMatch(){
  if(!careerV2) return;
  const C = careerV2;
  const br = C.barrage;
  if(!br || !br.active || br.done){ logEvent('Aucun barrage à jouer.','#e02030'); return; }
  const g = br.games[br.idx];
  if(!g || g.played){ logEvent('Aucune manche de barrage en attente.','#e02030'); return; }

  const nation = C.nation || 'pilier';
  const region = C.club.region;
  const oppLevel = br.oppLevel || C.club.level || 'dh';

  const mode = window.gameMode || '7v7';
  const XI_POS = mode==='11v11' ? ['GB','DD','DC','DC','DG','MC','MC','MC','MC','ATT','ATT']
               : mode==='5v5'   ? ['GB','DC','MOG','MOD','ATT']
               :                  ['GB','DC','DD','DG','MC','MC','ATT'];
  const BENCH_POS = mode==='11v11' ? ['GB','DC','MC','MC','ATT','DD','DG']
                  : mode==='5v5'   ? ['GB','DC','MC','ATT','DC']
                  :                  ['GB','MC','ATT','DC','MC'];
  const xiSize = XI_POS.length, benchSize = BENCH_POS.length;

  const fullSquad = (C.players||[]).map(function(p){ return Object.assign({}, p); })
    .concat((C.bench||[]).map(function(p){ return Object.assign({}, p); }));
  const gkPool = fullSquad.filter(function(p){ return p && p.pos==='GB'; }).sort(function(a,b){ return _playerOvr(b)-_playerOvr(a); });
  const outfieldPool = fullSquad.filter(function(p){ return p && p.pos!=='GB'; }).sort(function(a,b){ return _playerOvr(b)-_playerOvr(a); });
  const starters = [];
  if(gkPool[0]) starters.push(gkPool[0]);
  outfieldPool.forEach(function(p){ if(starters.length < xiSize) starters.push(p); });
  const leftoverGk  = gkPool.slice(1);
  const leftoverOut = outfieldPool.filter(function(p){ return starters.indexOf(p) < 0; });
  const matchBench = [];
  if(leftoverGk[0]) matchBench.push(leftoverGk[0]);
  leftoverGk.slice(1).concat(leftoverOut).forEach(function(p){ if(matchBench.length < benchSize) matchBench.push(p); });
  const usedIds = starters.concat(matchBench);
  const surplus = fullSquad.filter(function(p){ return usedIds.indexOf(p) < 0; });
  starters.forEach(function(p){ if(p){ p.onBench=false; p.subbedOut=false; } });
  matchBench.forEach(function(p){ if(p){ p.onBench=true; p.subbedOut=false; } });
  try{ _applyStaffMatchdayBonus(C.club, starters, matchBench); }catch(e){}

  teams[0] = {
    name: C.club.name, color: C.club.color || '#e02030', img: C.club.img || '',
    strat: C.club.strat || '321',
    players: starters, bench: matchBench,
    reserves: surplus.concat((C.reserves||[]).map(function(p){ return Object.assign({}, p); })),
  };

  let aiSquad;
  try{
    aiSquad = _applyDifficultyToSquad(WORLDS.generateSquad(nation, region, {
      positions: XI_POS, bench: BENCH_POS, reserves: [], level: oppLevel,
    }));
  }catch(e){
    console.error('barrage ai squad:', e);
    logEvent('⚠️ Impossible de générer l\'adversaire du barrage. Match simulé à la place.','#e0a020');
    simCareerBarrageMatch();
    return;
  }
  if(!aiSquad || !(aiSquad.players||[]).length){
    logEvent('⚠️ Adversaire du barrage invalide. Match simulé à la place.','#e0a020');
    simCareerBarrageMatch();
    return;
  }

  teams[1] = {
    name: br.oppName, color: br.oppColor || '#1878e8', img: '', badge: br.oppBadge || null,
    strat: '321', players: aiSquad.players, bench: aiSquad.bench, reserves: [],
  };

  applyFormationRoles(0);
  applyFormationRoles(1);

  window._careerBarragePlaying = { gameIndex: br.idx };

  nav('match');
  resetMatch();
  G.leagueMode = true; // route endMatch() vers _recordCareerV2BarrageMatchResult
  G._humanTeams = [true, false];
  try{ if(typeof resetManagerAi==='function') resetManagerAi(); }catch(e){}
  syncHUD(); renderTB(0); renderTB(1);
  showPreMatch(null);
}

// Version rapide (bouton "⚡ Simuler") : résout la manche par force + aléa.
function simCareerBarrageMatch(){
  if(!careerV2) return;
  const C = careerV2;
  const br = C.barrage;
  if(!br || !br.active || br.done){ logEvent('Aucun barrage à simuler.','#e02030'); return; }
  const g = br.games[br.idx];
  if(!g || g.played){ logEvent('Aucune manche de barrage en attente.','#e02030'); return; }

  const myPlayers = C.players || [];
  const myStr = myPlayers.reduce(function(s,p){
    return s + ((p.s&&p.s.sht||10)+(p.s&&p.s.spd||10)+(p.s&&p.s.tec||10))/3;
  }, 0) / Math.max(1, myPlayers.length);
  const oppStr = br.oppStrength || myStr;
  const isHome = !!g.isHome;
  const myGoals = _poissonGoals((myStr/Math.max(1,oppStr)) * (isHome?1.1:0.9) * 0.8);
  const oppGoals = _poissonGoals((oppStr/Math.max(1,myStr)) * (isHome?0.9:1.1) * 0.8);

  _recordBarrageLegResult(myGoals, oppGoals);
  saveCareerV2();
  renderCareerV2();
}

// Cœur commun : enregistre le score d'une manche de barrage (jouée ou
// simulée), avance au score de la série, et finalise dès que le sort est joué
// (3 victoires ou 3 défaites).
function _recordBarrageLegResult(myG, oppG){
  const C = careerV2; if(!C || !C.barrage) return;
  const br = C.barrage;
  const g = br.games[br.idx];
  if(!g) return;
  g.played = true; g.scoreMe = myG; g.scoreOpp = oppG;

  if(myG > oppG) br.wins++;
  else if(myG < oppG) br.losses++;
  // Un nul ne compte ni pour ni contre — il faut trancher lors d'une manche
  // suivante (le barrage se joue jusqu'à ce qu'un camp atteigne 3 victoires).

  const res = myG > oppG ? '✅ Victoire' : myG === oppG ? '🟡 Nul' : '❌ Défaite';
  const col = myG > oppG ? '#18c860' : myG === oppG ? '#f0c028' : '#e06060';
  logEvent(res+' (barrage, manche '+(br.idx+1)+') ! '+C.club.name+' '+myG+'-'+oppG+' '+br.oppName+' — score de série '+br.wins+'-'+br.losses, col);

  br.idx++;
  let decided = false;
  // Barrage générique (nations sans système dédié) : finalisation propre,
  // qui applique br.newLevel déjà calculé à la création.
  if(br.generic){
    if(br.wins >= br.winsNeeded || br.losses >= br.winsNeeded){
      br.done = true; br.active = false;
      br.promoted = br.wins > br.losses;
      if(br.promoted){
        br.message = '🏆 Barrage remporté ! Promotion en ' + br.targetDivName + ' !';
        C.club.level = br.newLevel;
      } else {
        br.message = '⚔️ Barrage perdu. Maintien cette saison.';
      }
      decided = true;
    }
  } else {
    try{ decided = _pilierFinalizeBarrageIfDecided(C); }catch(e){ console.error('finalize barrage:',e); }
  }
  if(decided){
    logEvent(br.message, C.club.color||'#f0c028');
  } else if(br.idx >= br.games.length){
    // Filet de sécurité : 5 manches jouées sans qu'un camp atteigne 3 victoires
    // (ne devrait pas arriver puisqu'on ne compte que gagne/perd) — on tranche
    // au nombre de victoires acquises.
    br.done = true; br.active = false;
    br.promoted = br.wins > br.losses;
    br.message = br.promoted ? '🏆 Barrage remporté aux points !' : '⚔️ Barrage perdu aux points.';
    if(br.promoted){ br.newLevel = PILIER_DIVISIONS[br.targetDiv].level; br.newDivId = br.targetDiv; }
    logEvent(br.message, C.club.color||'#f0c028');
  }
  if(C._pendingMatch) C._pendingMatch = null;
}

// Appelé par endMatch() (visual.js) quand le match joué était une manche de barrage.
function _recordCareerV2BarrageMatchResult(){
  if(!careerV2 || !window._careerBarragePlaying) return;
  const s0 = G.scores[0]; // notre score (team 0 = toujours le joueur ici)
  const s1 = G.scores[1]; // adversaire
  _accumulateSeasonScorers(careerV2);
  _recordBarrageLegResult(s0, s1);
  window._careerBarragePlaying = null;
  saveCareerV2();
}

function endCareerSeasonDirector(){
  if(!careerV2) return;
  const C = careerV2;
  let _seasonBarrageResolved = false;   // vrai si un barrage/play-off vient d'être joué
  // Des barrages de district sont en cours et pas encore terminés : il faut
  // d'abord les jouer jusqu'au bout avant de pouvoir clôturer la saison.
  if(C.playoffs && C.playoffs.active && !C.playoffs.done){
    logEvent('Terminez d\'abord les barrages de district avant de continuer.','#e0a020');
    renderCareerV2();
    return;
  }
  // Idem pour un barrage d'accession du Pilier en cours.
  if(C.barrage && C.barrage.active && !C.barrage.done){
    logEvent('Terminez d\'abord le barrage d\'accession avant de continuer.','#e0a020');
    renderCareerV2();
    return;
  }
  // Barrage générique déjà JOUÉ : on applique son verdict et on empêche qu'il
  // soit recréé par la logique de promotion ci-dessous.
  if(C.barrage && C.barrage.generic && C.barrage.done){
    C._genericBarrage = true;   // marqueur : ne pas régénérer un barrage
    // Le niveau AVANT le barrage a été mémorisé à sa création (_levelAtStart).
    // On l'utilise pour détecter correctement la promotion : sinon, comme le
    // level a déjà changé, la comparaison echouait et la promotion via barrage
    // n'était PAS reconnue (→ confiance non créditée → licenciement injuste).
    window._levelBeforeSeasonEnd = C.barrage._levelAtStart || (C.club && C.club.level);
    _seasonBarrageResolved = true;
  }
  // Barrage de district (Valoria) déjà joué : même logique.
  if(C.playoffs && C.playoffs.done && C.playoffs._levelAtStart){
    window._levelBeforeSeasonEnd = C.playoffs._levelAtStart;
    _seasonBarrageResolved = true;
  }
  // Mémorise le niveau AVANT résolution (promo/relégation le modifient) pour
  // évaluer les objectifs des sponsors en fin de fonction. On NE l'écrase PAS
  // si un barrage/play-off vient d'être résolu (on garde le niveau d'avant).
  if(!_seasonBarrageResolved){
    window._levelBeforeSeasonEnd = C.club && C.club.level;
  }
  // ── Contexte figé AVANT résolution, pour l'historique de carrière ──────
  const _histSeasonNumber = C.season;
  const _histDivisionStart = C.divisionName || (C.club && C.club.divisionName) || (C.club && C.club.level) || '?';
  const _histLevelStart = C.club && C.club.level;
  let seasonOutcomeMsg = null;
  const sorted = (C.standings||[]).slice().sort(function(a,b){
    return b.Pts - a.Pts || (b.GF-b.GA)-(a.GF-a.GA);
  });
  const myPos = sorted.findIndex(function(s){ return s.isPlayer; }) + 1;
  const total = sorted.length;
  // ── RÈGLES VALORIA (promo/relégation détaillées) ───────────────────────
  // Si la carrière se déroule en Valoria et que le moteur de saisons dédié est
  // chargé, on applique les règles complètes (R3, play-offs district, équité
  // R1→Pro). Sinon on garde la logique générique (top 2 = montée).
  if((C.nation==='valoria') && typeof valoriaResolvePlayerSeason==='function' && C.club && C.club.level && !(C.playoffs && C.playoffs.done)){
    try{
      const res = valoriaResolvePlayerSeason(C, myPos, total);
      if(res && res.needsPlayoffs){
        // Qualifié pour les barrages de district : on les génère (JOUABLES,
        // moteur de match, dates réelles) et on suspend la fin de saison
        // jusqu'à ce qu'ils soient joués — plus de tirage au sort.
        const lvl = valoriaNormalizeLevel(C.club.level, _valRegionName(C.club.region));
        try{ valoriaSetupDistrictPlayoffs(C, lvl, myPos); }catch(e2){ console.error('valoriaSetupDistrictPlayoffs:',e2); }
        window._levelBeforeSeasonEnd = null;
        logEvent('🏟️ Qualifié pour les barrages de district ! Ils se joueront dans les prochaines semaines.', C.club.color||'#f0c028');
        saveCareerV2();
        renderCareerV2();
        return;
      }
      if(res){
        if(res.newLevel && res.newLevel!==C.club.level){ C.club.level = res.newLevel; }
        if(res.message){ logEvent(res.message, C.club.color||'#f0c028'); seasonOutcomeMsg = res.message; }
      }
    }catch(e){ console.error('valoriaResolvePlayerSeason:',e); }
  } else if((C.nation==='pilier') && typeof pilierResolveSeason==='function' && C.club && C.club.level){
    // Système à 3 blocs fermés du Pilier (+ barrages inter-blocs).
    try{
      const res = pilierResolveSeason(C.club, myPos, total);
      if(res){
        if(res.playoff){
          if(C.barrage && C.barrage.done){
            // Le barrage a déjà été joué sur le terrain : on applique le
            // résultat acquis (plus de tirage au sort).
            if(C.barrage.promoted && C.barrage.newLevel){ C.club.level = C.barrage.newLevel; C.club.pilierDivId = C.barrage.newDivId; }
            logEvent(C.barrage.message, C.club.color||'#f0c028');
            seasonOutcomeMsg = C.barrage.message;
            C.barrage = null;
          } else {
            // Barrage d'accession : on génère un vrai adversaire (le dernier
            // du bloc visé) et une série JOUABLE en 5 manches maximum (le
            // premier à 3 victoires monte), puis on suspend la fin de saison.
            try{ pilierSetupBarrage(C, res.playoff); }catch(e2){ console.error('pilierSetupBarrage:',e2); }
            window._levelBeforeSeasonEnd = null;
            logEvent('⚔️ Barrage d\'accession programmé ! Il se jouera dans les prochaines semaines.', C.club.color||'#f0c028');
            saveCareerV2();
            renderCareerV2();
            return;
          }
        } else {
          if(res.newLevel && res.newLevel!==C.club.level){ C.club.level = res.newLevel; C.club.pilierDivId = res.newDivId; }
          if(res.message){ logEvent(res.message, C.club.color||'#f0c028'); seasonOutcomeMsg = res.message; }
        }
      }
    }catch(e){ console.error('pilierResolveSeason:',e); }
  } else if(myPos <= 2){
    const pyramid = WORLDS.getPyramid(C.nation||'panthalassa');
    const levels = pyramid.map(function(p){ return p.id; });
    const idx = levels.indexOf(C.club.level);
    if(idx > 0){
      C.club.level = levels[idx-1];
      seasonOutcomeMsg = '🎉 PROMOTION ! Vous montez en '+pyramid[idx-1].name+' !';
      logEvent(seasonOutcomeMsg,'#f0c028');
    }
  } else if(myPos >= 3 && myPos <= 6 && !C._genericBarrage){
    // ── BARRAGES D'ACCESSION GÉNÉRIQUES ────────────────────────────────
    // Finir 3e-6e ne donnait RIEN dans les nations sans système dédié : la
    // montée directe s'arrêtait au top 2, et il n'y avait pas de barrage pour
    // les suivants. On en crée un, jouable, contre un adversaire virtuel de
    // force proche : gagner 2 matchs sur 3 = promotion.
    const pyramid = WORLDS.getPyramid(C.nation||'panthalassa');
    const levels = pyramid.map(function(p){ return p.id; });
    const idx = levels.indexOf(C.club.level);
    if(idx > 0){
      // Force du joueur → l'adversaire du barrage est légèrement supérieur
      // (il vient de la division au-dessus).
      const myPlayers = C.players || [];
      const myStr = myPlayers.reduce(function(s,p){
        return s + ((p.s&&p.s.sht||10)+(p.s&&p.s.spd||10)+(p.s&&p.s.tec||10))/3;
      }, 0) / Math.max(1, myPlayers.length);
      const oppName = _genericBarrageOpp(C, sorted, myPos);
      // Même structure que les barrages Pilier/Valoria → réutilise tout le
      // moteur de jeu/simulation/résolution existant. Série au meilleur des 3
      // (premier à 2 victoires). Manches à domicile/extérieur alternées.
      C.barrage = {
        active: true, done: false, generic: true,
        oppName: oppName,
        oppStrength: myStr * 1.08,
        winsNeeded: 2,
        wins: 0, losses: 0, idx: 0,
        games: [ {isHome:true, played:false}, {isHome:false, played:false}, {isHome:true, played:false} ],
        targetDivName: pyramid[idx-1].name,
        newLevel: levels[idx-1],
        _levelAtStart: C.club.level,   // niveau avant le barrage, pour détecter la promotion
        message: null,
      };
      window._levelBeforeSeasonEnd = null;
      logEvent('⚔️ Vous finissez '+myPos+'e — barrage d\'accession vers '+pyramid[idx-1].name+' ! (2 victoires sur 3)','#f0c028');
      saveCareerV2();
      renderCareerV2();
      return;
    }
  } else if(myPos >= total-1){
    seasonOutcomeMsg = 'Saison difficile — attention la prochaine fois.';
    logEvent(seasonOutcomeMsg,'#e06060');
  }

  // ── Primes d'objectif des sponsors ─────────────────────────────────────
  // On évalue chaque contrat sponsor porteur d'un objectif sportif et on verse
  // la prime si l'objectif est atteint. `_levelBeforeSeasonEnd` est capturé au
  // début de la résolution ci-dessus (promotion/relégation modifient le level).
  // Calculé une fois ici, réutilisé par les sponsors ET le verdict du board.
  let _seasonPromoted = false, _seasonRelegated = false;
  try{
    const _b = window._levelBeforeSeasonEnd;
    _seasonPromoted = !!(_b && C.club && C.club.level!==_b && _levelRankBetter(C.club.level, _b));
    _seasonRelegated = !!(_b && C.club && C.club.level!==_b && !_levelRankBetter(C.club.level, _b));
  }catch(e){}

  if(typeof SPONSORS!=='undefined' && C.club && C.club.sponsors){
    try{
      const promoted = _seasonPromoted;
      const relegated = _seasonRelegated;
      const wins = (C.season_stats && C.season_stats.wins) || 0;
      const stats = { relegated:relegated, promoted:promoted, rank:myPos, wins:wins };
      SPONSORS.active(C.club).forEach(function(c){
        if(c.objective && SPONSORS.objectiveMet(c.objective.id, stats)){
          C.club.budget += c.objective.bonus;
          try{ _addFinanceLog('Prime objectif sponsor : '+c.name, c.objective.bonus); }catch(e){}
          logEvent('🎯 Objectif sponsor atteint ('+c.name+') — prime '+_fmtMoney(c.objective.bonus)+' !','#18c860');
        }
      });
    }catch(e){ console.error('sponsor objectives:', e); }
  }
  window._levelBeforeSeasonEnd = null;

  // ── RÉCOMPENSE DE MONTÉE : +1 partout à tout l'effectif ────────────────
  // Monter de division galvanise et fait grandir le groupe : chaque joueur
  // gagne +1 sur toutes ses statistiques (borné à 99). Petit mais sensible,
  // et cumulable au fil des montées successives.
  if(_seasonPromoted && C.club){
    const squad = [].concat(C.players||[], C.bench||[], C.reserves||[]);
    let boosted = 0;
    squad.forEach(function(p){
      if(!p || !p.s) return;
      Object.keys(p.s).forEach(function(k){
        if(typeof p.s[k] === 'number') p.s[k] = Math.min(99, p.s[k] + 1);
      });
      if(p.s2){ Object.keys(p.s2).forEach(function(k){ if(typeof p.s2[k]==='number') p.s2[k]=Math.min(99,p.s2[k]+1); }); }
      boosted++;
    });
    if(boosted){ logEvent('📈 Montée fêtée : tout l\'effectif progresse (+1 partout) !', '#18c860'); }
  }

  // ── Archivage dans l'historique de carrière ─────────────────────────────
  // On fige un résumé complet de la saison qui vient de se terminer AVANT de
  // remettre season_stats à zéro et de régénérer le calendrier (qui écrase
  // C.divisionName avec celui de la NOUVELLE saison).
  try{
    let divisionNameEnd = _histDivisionStart;
    if(C.club && C.club.level!==_histLevelStart){
      if(C.nation==='valoria' && typeof _valDivName==='function' && typeof valoriaNormalizeLevel==='function'){
        divisionNameEnd = _valDivName(valoriaNormalizeLevel(C.club.level, _valRegionName(C.club.region)));
      } else if(C.nation==='pilier' && typeof PILIER_DIVISIONS!=='undefined'){
        const did = C.club.pilierDivId || (typeof _pilierDivOfLevel==='function' ? _pilierDivOfLevel(C.club.level) : null);
        divisionNameEnd = (did && PILIER_DIVISIONS[did]) ? PILIER_DIVISIONS[did].name : C.club.level;
      } else {
        const pyr = WORLDS.getPyramid(C.nation||'panthalassa').find(function(p){ return p.id===C.club.level; });
        divisionNameEnd = pyr ? pyr.name : C.club.level;
      }
    }

    let cupSummary = null;
    if(C.cup){
      if(C.cup.winner && C.cup.winner.isPlayer){
        cupSummary = '🏆 Vainqueur de la '+C.cup.name;
      } else if(C.cup.playerOut){
        const rn = (C.cup.roundNames && C.cup.roundNames[C.cup.round-1]) || null;
        cupSummary = 'Éliminé'+(rn?(' en '+rn):'')+' ('+C.cup.name+')';
      } else {
        cupSummary = C.cup.name+' non disputée jusqu\'au bout';
      }
    }

    let topScorer = null;
    if(C.season_stats && C.season_stats.scorers){
      const entries = Object.entries(C.season_stats.scorers).sort(function(a,b){ return b[1]-a[1]; });
      if(entries.length) topScorer = { name:entries[0][0], goals:entries[0][1] };
    }

    const histEntry = {
      season: _histSeasonNumber,
      clubName: C.club.name,
      divisionStart: _histDivisionStart, divisionEnd: divisionNameEnd,
      levelStart: _histLevelStart, levelEnd: C.club.level,
      pos: myPos, total: total,
      wins: C.season_stats.wins, draws: C.season_stats.draws, losses: C.season_stats.losses,
      gf: C.season_stats.goals_for, ga: C.season_stats.goals_against, pts: C.season_stats.points,
      outcome: seasonOutcomeMsg, cup: cupSummary, topScorer: topScorer,
    };
    if(!Array.isArray(C.history)) C.history = [];
    C.history.unshift(histEntry); // le plus récent en premier
    if(C.history.length > 50) C.history.length = 50; // garde-fou anti-croissance infinie
  }catch(e){ console.error('archive season history:', e); }

  // ── DOTATIONS DE FIN DE SAISON ──────────────────────────────────────────
  // Pro : prime de classement (dégressive du 1er au dernier).
  // Amateur/semi-pro : subvention annuelle (formation, licenciés, résultats).
  try{ if(typeof _prizeOnSeasonEnd==='function') _prizeOnSeasonEnd(myPos, total); }catch(e){ console.error('season prizes:', e); }

  // ── VERDICT DU BOARD ────────────────────────────────────────────────────
  // Évalué APRÈS l'archivage de l'historique (pour que l'écran de licenciement
  // puisse afficher le bilan complet) mais AVANT la nouvelle saison.
  try{
    const cupWon = !!(C.cup && C.cup.winner && C.cup.winner.isPlayer);
    const ctx = { promoted:_seasonPromoted, relegated:_seasonRelegated,
                  pos:myPos, total:total, cupWon:cupWon };
    // Objectif fixé par le board en début de saison : prime + impact sur la
    // confiance, puis régénération pour la saison à venir.
    if(typeof _boardCheckObjectives==='function'){
      _boardCheckObjectives({ promoted:_seasonPromoted, relegated:_seasonRelegated,
                              rank:myPos, total:total,
                              wins:(C.season_stats&&C.season_stats.wins)||0 });
    }
    if(typeof _boardOnSeasonEnd==='function') _boardOnSeasonEnd(ctx);
    // Bilan du contrat personnel du manager (salaire déjà versé, objectifs
    // évalués, prolongation ou fin de contrat).
    if(typeof _managerContractReview==='function') _managerContractReview(ctx);
    // Licenciement : on stoppe tout, la carrière s'arrête ici.
    if(typeof _boardCheckSack==='function' && _boardCheckSack()){
      saveCareerV2();
      renderCareerV2();
      return;
    }
    // Sinon, un autre club peut vous approcher.
    if(typeof _boardMaybeJobOffer==='function') _boardMaybeJobOffer(ctx);
  }catch(e){ console.error('board season end:', e); }

  C.season++; C.week = 1;
  C.date = {year:(C.date&&C.date.year||1)+1, month:8, day:1};
  C.seasonStartDate = null; // ré-ancrée par _generateSeasonFixtures() ci-dessous
  C.dayPlans = {}; // planning de la saison écoulée purgé
  C.season_stats = {wins:0, draws:0, losses:0, goals_for:0, goals_against:0, points:0, scorers:{}};
  // Remise à zéro des compteurs d'objectifs secondaires.
  C._curUnbeaten = 0; C._bestUnbeaten = 0; C._cupBestRound = 0; C._youthPromotedThisSeason = 0;
  // Nettoyage des barrages de la saison écoulée (générique).
  C._genericBarrage = false;
  if(C.barrage && C.barrage.generic && C.barrage.done) C.barrage = null;
  // Nettoyage des barrages de district Valoria une fois la saison bouclée.
  if(C.playoffs && C.playoffs.done) C.playoffs = null;
  logEvent('Saison '+C.season+' — Nouveau depart !', C.club.color||'#18c860');
  // IA de gestion : les clubs adverses vieillissent, progressent/déclinent et
  // font quelques mouvements de mercato avant que la nouvelle saison démarre.
  try{ _evolveOpponentSquads(); }catch(e){ console.error('evolve opponents:',e); }
  // VOTRE effectif vit selon les mêmes règles (vieillissement, progression,
  // déclin, retraites) + progression des jeunes vers leur potentiel. Sans ça,
  // seule l'IA se régénérait et votre équipe décrochait mécaniquement.
  try{
    if(typeof _evolvePlayerSquad==='function'){
      const _rep = _evolvePlayerSquad();
      if(typeof _logSquadEvolution==='function') _logSquadEvolution(_rep);
    }
  }catch(e){ console.error('evolve player squad:',e); }
  _generateSeasonFixtures();
  _generateFreeAgents();
  _generateYouthIntake();
  C.club.weekly_costs = _weeklyCareerCosts();
  saveCareerV2();
  renderCareerV2();
}

function abandonCareerV2(){
  if(!confirm('Abandonner cette carrière ? Cette action est irréversible.')) return;
  careerV2 = null;
  localStorage.removeItem('footsim_careerV2');
  renderCareerV2Choice();
}

// ── Helpers ───────────────────────────────────────────────────────────
function _fmtMoney(n){
  if(n === undefined || n === null) return '0';
  const abs = Math.abs(n);
  if(abs >= 1000000) return (n/1000000).toFixed(1)+'M';
  if(abs >= 1000) return (n/1000).toFixed(0)+'k';
  return String(Math.round(n));
}

function _reputationLabel(rep){
  if(rep >= 80) return 'Légendaire';
  if(rep >= 65) return 'Réputé';
  if(rep >= 50) return 'Connu';
  if(rep >= 35) return 'Modeste';
  if(rep >= 20) return 'Inconnu';
  return 'Amateur';
}

// ═══════════════════════════════════════════════════════════
// EXPORT / IMPORT
// ═══════════════════════════════════════════════════════════
// ── Sélecteur d'approche tactique avant un match de carrière ────────────
// Trois approches lisibles (défensif / équilibré / offensif) qui mappent sur
// des formations réelles du moteur (STRATS). L'effet passe par C.club.strat,
// injecté dans team0 par playCareerMatchV2. Le style n'est PAS gratuit : une
// approche offensive marque plus mais encaisse plus, et inversement.
function _renderMatchTacticPicker(club){
  const cur = club.strat || '321';
  // On propose un sous-ensemble parlant des STRATS, du plus prudent au plus fou.
  const options = [
    { id:'411', icon:'🛡️', label:'Défensif',  desc:'Bloc bas, on protège le résultat' },
    { id:'321', icon:'⚖️', label:'Équilibré', desc:'Le standard, sans prise de risque' },
    { id:'231', icon:'🎯', label:'Possession',desc:'Milieu renforcé, on garde le ballon' },
    { id:'33',  icon:'⚔️', label:'Offensif',  desc:'Pressing haut, on cherche à marquer' },
  ];
  let h = '<div style="margin-bottom:10px">';
  h += '<div style="font-size:9px;color:var(--muted);margin-bottom:4px;font-weight:700">🧠 Votre approche</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">';
  options.forEach(function(o){
    const on = o.id === cur;
    h += '<button onclick="setMatchTactic(\'' + o.id + '\')" style="text-align:left;padding:6px 8px;border-radius:8px;cursor:pointer;border:2px solid ' + (on?'var(--gold)':'var(--b1)') + ';background:' + (on?'rgba(240,192,40,.14)':'var(--dark)') + ';color:' + (on?'var(--gold)':'var(--muted)') + '">';
    h += '<div style="font-size:10px;font-weight:900">' + o.icon + ' ' + o.label + '</div>';
    h += '<div style="font-size:7px;color:var(--muted);margin-top:1px;line-height:1.3">' + o.desc + '</div>';
    h += '</button>';
  });
  h += '</div></div>';
  return h;
}

function setMatchTactic(stratId){
  if(!careerV2 || !careerV2.club) return;
  careerV2.club.strat = stratId;
  saveCareerV2();
  try{ renderCareerV2(); }catch(e){}
}

// ── Classement des buteurs de la division (Soulier d'or) ────────────────
// Les buts étaient comptés (les tiens par match, ceux des PNJ via la sim) mais
// aucun classement de buteurs n'existait — seul TON meilleur buteur apparaissait
// en fin de saison. On agrège ici une vraie course au Soulier d'or :
//   • tes buteurs réels (season_stats.scorers), exacts ;
//   • pour chaque club adverse, une estimation stable : ses buts marqués
//     (standings.GF) répartis sur ses meilleurs attaquants, avec une part
//     dominante au buteur n°1. L'estimation est déterministe (graine = nom)
//     pour ne pas gigoter d'un affichage à l'autre.
function _seededRand(str){
  let h = 2166136261;
  for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return function(){ h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t>>>15), t|1); t ^= t + Math.imul(t ^ (t>>>7), t|61); return ((t ^ (t>>>14))>>>0)/4294967296; };
}

function _leagueScorers(){
  const C = careerV2;
  if(!C) return [];
  const list = [];

  // 1) Tes buteurs — exacts.
  const mine = (C.season_stats && C.season_stats.scorers) || {};
  Object.keys(mine).forEach(function(name){
    list.push({ name:name, club:C.club.name, goals:mine[name], isPlayer:true, mine:true });
  });

  // 2) Estimation pour chaque club adverse à partir de ses buts marqués.
  const squads = C.opponentSquads || {};
  (C.standings || []).forEach(function(st){
    if(st.isPlayer) return;
    const gf = st.GF || 0;
    if(gf <= 0) return;
    const entry = squads[st.name];
    // Attaquants du club (ou postes offensifs), triés par niveau.
    let attackers = [];
    if(entry && entry.squad){
      attackers = [].concat(entry.squad.players||[], entry.squad.bench||[])
        .filter(function(p){ return p && ['ATT','MO','MOG','MOD','MC'].includes(p.pos); })
        .sort(function(a,b){ return (_pOvr(b)) - (_pOvr(a)); });
    }
    const rnd = _seededRand(st.name + '|' + C.season);
    if(attackers.length){
      // Le buteur n°1 prend ~45-55% des buts, le reste se répartit.
      const share1 = 0.45 + rnd()*0.12;
      const g1 = Math.round(gf * share1);
      if(g1 > 0) list.push({ name:attackers[0].name, club:st.name, goals:g1, isPlayer:false });
      let rem = gf - g1;
      for(let i=1;i<Math.min(3,attackers.length) && rem>0;i++){
        const g = Math.round(rem * (0.5 + rnd()*0.2));
        if(g > 0) list.push({ name:attackers[i].name, club:st.name, goals:g, isPlayer:false });
        rem -= g;
      }
    } else {
      // Pas d'effectif détaillé : un buteur anonyme porte l'essentiel.
      list.push({ name:'Buteur de ' + st.name, club:st.name, goals:Math.round(gf*0.5), isPlayer:false });
    }
  });

  return list.sort(function(a,b){ return b.goals - a.goals; }).slice(0, 20);
}

function _renderDirectorScorers(){
  const C = careerV2;
  const scorers = _leagueScorers();
  let h = '<div style="padding:4px">';
  h += '<div style="font-size:12px;font-weight:900;color:var(--gold);margin-bottom:8px">⚽ Course au Soulier d\'or</div>';
  if(!scorers.length){
    h += '<div style="font-size:10px;color:var(--muted)">Aucun but marqué pour l\'instant cette saison.</div></div>';
    return h;
  }
  h += '<div style="background:var(--dark);border:1px solid var(--b1);border-radius:8px;overflow:hidden">';
  scorers.forEach(function(sc, i){
    const rankCol = i===0?'#f0c028':i===1?'#c0c0c0':i===2?'#cd7f32':'var(--muted)';
    const bg = sc.mine ? 'rgba(24,200,96,.08)' : 'transparent';
    h += '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid var(--b1);background:' + bg + '">';
    h += '<div style="width:20px;font-weight:900;font-size:11px;color:' + rankCol + '">' + (i+1) + '</div>';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-size:10px;font-weight:700' + (sc.mine?';color:#18c860':'') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + sc.name + (sc.mine?' <span style="font-size:7px;color:#18c860">(vous)</span>':'') + '</div>';
    h += '<div style="font-size:8px;color:var(--muted)">' + sc.club + '</div>';
    h += '</div>';
    h += '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:15px;font-weight:900;color:' + rankCol + '">' + sc.goals + '</div>';
    h += '</div>';
  });
  h += '</div>';
  h += '<div style="font-size:7px;color:var(--muted);margin-top:6px;font-style:italic">Tes buts sont exacts ; ceux des adversaires sont estimés d\'après leurs buts d\'équipe.</div>';
  h += '</div>';
  return h;
}

// ── Onglet COMPÉTITIONS : brackets et résultats de toutes les coupes ────
// Avant, on ne voyait que SON prochain adversaire de coupe, jamais le tableau
// complet ni les résultats des autres confrontations. Cet onglet consolide
// tout : coupe nationale, coupe de la ligue, et barrages en cours, avec les
// brackets tour par tour et les scores.
function _renderDirectorCompetitions(){
  const C = careerV2;
  let h = '<div style="padding:4px">';
  h += '<div style="font-size:12px;font-weight:900;color:var(--gold);margin-bottom:8px">🏆 Compétitions</div>';

  let any = false;

  // 1) Coupe nationale.
  if(C.cup){ h += _renderCupBracket(C.cup, '#f0c028'); any = true; }
  // 2) Coupe de la ligue.
  if(C.leagueCup){ h += _renderLeagueCupBlock(C.leagueCup, '#c060e0'); any = true; }
  // 3) Barrages / play-offs en cours.
  if(C.barrage){ h += _renderBarrageBlock(C.barrage); any = true; }
  if(C.playoffs){ h += _renderPlayoffBlock(C.playoffs); any = true; }

  if(!any){
    h += '<div class="ccard"><div class="ctxt-sm">Aucune compétition en cours pour l\'instant. Les coupes et barrages apparaîtront ici avec leurs tableaux et résultats.</div></div>';
  }
  h += '</div>';
  return h;
}

// Un match du bracket, avec score si joué.
function _compMatchRow(m){
  const nameA = m.a ? m.a.name : '(exempt)';
  const nameB = m.b ? m.b.name : '(exempt)';
  const meA = m.a && m.a.isPlayer, meB = m.b && m.b.isPlayer;
  let sA = '', sB = '';
  if(m.played){
    // ga = buts de a, gb = buts de b (convention du moteur de coupe).
    sA = (m.ga != null ? m.ga : (m.winner===m.a?'✓':'')) + '';
    sB = (m.gb != null ? m.gb : (m.winner===m.b?'✓':'')) + '';
  }
  const wA = m.played && m.winner===m.a, wB = m.played && m.winner===m.b;
  let h = '<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;border-bottom:1px solid var(--b1);font-size:10px">';
  h += '<div style="flex:1;text-align:right;color:'+(meA?'var(--gold)':wA?'#18c860':'var(--fg)')+';font-weight:'+(meA||wA?'900':'400')+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+nameA+'</div>';
  h += '<div style="min-width:34px;text-align:center;font-weight:900;color:var(--muted)">'+(m.played? (sA+'–'+sB) : 'vs')+'</div>';
  h += '<div style="flex:1;color:'+(meB?'var(--gold)':wB?'#18c860':'var(--fg)')+';font-weight:'+(meB||wB?'900':'400')+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+nameB+'</div>';
  h += '</div>';
  return h;
}

function _renderCupBracket(cup, accent){
  let h = '<div class="ccard" style="border-left:3px solid '+accent+'">';
  h += '<div class="ccard-title" style="color:'+accent+'">🏆 '+cup.name+'</div>';
  if(cup.winner){
    h += '<div class="ctxt-sm" style="color:'+(cup.winner.isPlayer?accent:'var(--fg)')+';font-weight:800;margin-bottom:6px">'+(cup.winner.isPlayer?'👑 Vous avez remporté cette coupe !':('Vainqueur : '+cup.winner.name))+'</div>';
  } else {
    const rn = (cup.roundNames && cup.roundNames[cup.round]) || 'Tour';
    h += '<div class="ctxt-xs" style="margin-bottom:6px">Tour actuel : <b style="color:var(--fg)">'+rn+'</b>'+(cup.playerOut?' · <span style="color:#e06060">vous êtes éliminé</span>':'')+'</div>';
  }
  // Bracket du tour courant.
  if(Array.isArray(cup.bracket) && cup.bracket.length){
    h += '<div class="ctxt-xs" style="margin:6px 0 2px;color:var(--muted)">Confrontations du tour :</div>';
    cup.bracket.forEach(function(m){ h += _compMatchRow(m); });
  }
  h += '</div>';
  return h;
}

function _renderLeagueCupBlock(lc, accent){
  let h = '<div class="ccard" style="border-left:3px solid '+accent+'">';
  h += '<div class="ccard-title" style="color:'+accent+'">🏵️ '+lc.name+'</div>';
  if(lc.winner){
    h += '<div class="ctxt-sm" style="font-weight:800">'+(lc.winner.isPlayer?'🏆 Vous l\'avez remportée !':('Vainqueur : '+lc.winner.name))+'</div>';
  } else if(lc.phase==='pools' && Array.isArray(lc.pools)){
    // Poule du joueur : mini-classement.
    const mine = lc.pools.find(function(pl){ return (pl.standings||[]).some(function(s){ return s.isPlayer; }); });
    if(mine){
      h += '<div class="ctxt-xs" style="margin-bottom:4px;color:var(--muted)">Votre poule :</div>';
      const sorted = (mine.standings||[]).slice().sort(function(a,b){ return (b.Pts||0)-(a.Pts||0); });
      sorted.forEach(function(s, i){
        h += '<div style="display:flex;justify-content:space-between;font-size:10px;padding:3px 6px;border-bottom:1px solid var(--b1);'+(s.isPlayer?'background:'+accent+'18;border-radius:4px':'')+'">';
        h += '<span style="color:'+(s.isPlayer?accent:'var(--fg)')+';font-weight:'+(s.isPlayer?'900':'400')+'">'+(i+1)+'. '+s.name+'</span><span style="font-weight:900">'+(s.Pts||0)+' pts</span>';
        h += '</div>';
      });
    }
  } else if(Array.isArray(lc.bracket)){
    lc.bracket.forEach(function(m){ h += _compMatchRow(m); });
  }
  h += '</div>';
  return h;
}

function _renderBarrageBlock(br){
  let h = '<div class="ccard ccard-amber">';
  h += '<div class="ccard-title">⚔️ Barrage d\'accession</div>';
  if(br.done){
    h += '<div class="ctxt-sm" style="color:'+(br.promoted?'#18c860':'#e06060')+';font-weight:700">'+(br.message||(br.promoted?'Promotion obtenue !':'Barrage perdu.'))+'</div>';
  } else {
    h += '<div class="ctxt-sm">Adversaire : <b>'+(br.oppName||'?')+'</b></div>';
    if(br.winsNeeded){
      h += '<div class="ctxt-xs" style="margin-top:2px">Victoires nécessaires : '+(br.playerWins||0)+' / '+br.winsNeeded+'</div>';
    }
  }
  h += '</div>';
  return h;
}

function _renderPlayoffBlock(po){
  let h = '<div class="ccard ccard-amber">';
  const stageLbl = po.stage==='final' ? 'Poule finale' : 'Barrages de district';
  h += '<div class="ccard-title">⚔️ '+stageLbl+' → R3</div>';
  h += '<div class="ctxt-xs" style="margin-bottom:6px">Format : 2 poules de 4 → poule finale des qualifiés (2 premiers de chaque poule). Seul le 1er de la poule finale monte en R3.</div>';

  if(po.done){
    h += '<div class="ctxt-sm" style="color:'+(po.promoted?'#18c860':'#e06060')+';font-weight:700;margin-bottom:6px">'+(po.detail||(po.promoted?'Promu !':'Éliminé.'))+'</div>';
  }

  // Petit tableau de poule réutilisable.
  function poolTable(title, rows, qualifyTop){
    if(!rows || !rows.length) return '';
    let t = '<div class="ctxt-xs" style="margin:6px 0 2px;color:var(--muted);font-weight:700">'+title+'</div>';
    rows.forEach(function(r, i){
      const q = qualifyTop && i < qualifyTop;
      const me = r.isPlayer;
      t += '<div style="display:flex;justify-content:space-between;font-size:10px;padding:3px 6px;border-bottom:1px solid var(--b1);'+(me?'background:rgba(240,192,40,.14);border-radius:4px':'')+'">';
      t += '<span style="color:'+(me?'var(--gold)':q?'#18c860':'var(--fg)')+';font-weight:'+(me||q?'900':'400')+'">'+(i+1)+'. '+r.name+(q?' ✓':'')+'</span>';
      t += '<span style="font-weight:900">'+(r.pts||0)+' pts</span>';
      t += '</div>';
    });
    return t;
  }

  if(po.stage === 'final'){
    // Classement de la poule finale (si calculé) sinon liste des finalistes +
    // matchs restants du joueur.
    if(po.finalTable){
      h += poolTable('Poule finale', po.finalTable, 1);
    } else {
      if(Array.isArray(po.finalists)){
        h += '<div class="ctxt-xs" style="margin:6px 0 2px;color:var(--muted);font-weight:700">Finalistes</div>';
        po.finalists.forEach(function(t){
          h += '<div style="font-size:10px;padding:2px 6px;color:'+(t.isPlayer?'var(--gold)':'var(--fg)')+';font-weight:'+(t.isPlayer?'900':'400')+'">• '+t.name+'</div>';
        });
      }
      // Matchs du joueur dans la poule finale.
      if(Array.isArray(po.matches)){
        h += '<div class="ctxt-xs" style="margin:6px 0 2px;color:var(--muted)">Vos matchs :</div>';
        po.matches.forEach(function(m){
          const score = m.played ? (m.scoreMe+'–'+m.scoreOpp) : (m.isHome?'🏠 vs':'✈️ vs');
          h += '<div style="display:flex;justify-content:space-between;font-size:10px;padding:3px 6px;border-bottom:1px solid var(--b1)"><span>'+m.oppName+'</span><span style="font-weight:900;color:var(--muted)">'+score+'</span></div>';
        });
      }
    }
  } else {
    // Étape de poules : afficher LES DEUX poules en entier.
    // Filet pour les carrières créées avant la refonte : si myPoolTable n'a pas
    // été calculé, on le reconstruit à partir des matchs joués + otherPts.
    let myTable = po.myPoolTable;
    if(!myTable && Array.isArray(po.matches)){
      let myPts=0, myGf=0, myGa=0;
      po.matches.forEach(function(m){
        if(!m.played) return;
        myGf+=m.scoreMe||0; myGa+=m.scoreOpp||0;
        if(m.scoreMe>m.scoreOpp) myPts+=3; else if(m.scoreMe===m.scoreOpp) myPts+=1;
      });
      const seen={}; myTable=[];
      po.matches.forEach(function(m){
        if(seen[m.oppName]) return; seen[m.oppName]=true;
        myTable.push({ name:m.oppName, pts:(po.otherPts&&po.otherPts[m.oppName])||0, gd:0 });
      });
      myTable.push({ name:po.myName||'Mon club', pts:myPts, gd:myGf-myGa, isPlayer:true });
      myTable.sort(function(a,b){ return (b.pts-a.pts)||((b.gd||0)-(a.gd||0)); });
    }
    if(myTable){
      h += poolTable('Votre '+(po.poolLabel||'poule'), myTable, 2);
    } else if(Array.isArray(po.myPoolTeams)){
      h += '<div class="ctxt-xs" style="margin:6px 0 2px;color:var(--muted);font-weight:700">Votre '+(po.poolLabel||'poule')+'</div>';
      po.myPoolTeams.forEach(function(t){
        h += '<div style="font-size:10px;padding:2px 6px;color:'+(t.isPlayer?'var(--gold)':'var(--fg)')+';font-weight:'+(t.isPlayer?'900':'400')+'">• '+t.name+'</div>';
      });
    }
    // Tes matchs joués (toujours utile).
    if(Array.isArray(po.matches)){
      h += '<div class="ctxt-xs" style="margin:6px 0 2px;color:var(--muted)">Vos matchs :</div>';
      po.matches.forEach(function(m){
        const score = m.played ? (m.scoreMe+'–'+m.scoreOpp) : (m.isHome?'🏠 vs':'✈️ vs');
        h += '<div style="display:flex;justify-content:space-between;font-size:10px;padding:3px 6px;border-bottom:1px solid var(--b1)"><span>'+m.oppName+'</span><span style="font-weight:900;color:var(--muted)">'+score+'</span></div>';
      });
    }
    // L'AUTRE poule, en entier (seulement si disponible — carrières récentes).
    if(po.otherPoolTable){
      h += poolTable(po.otherPoolLabel||'Autre poule', po.otherPoolTable, 2);
    } else {
      h += '<div class="ctxt-xs" style="margin-top:6px;font-style:italic;color:var(--muted)">L\'autre poule s\'affichera en entier sur les nouvelles saisons (cette phase a démarré avant la mise à jour).</div>';
    }
  }
  h += '</div>';
  return h;
}

// Nom de l'adversaire d'un barrage générique : un club plausible de la
// division supérieure (on évite de réutiliser un club déjà dans la division).
function _genericBarrageOpp(C, sorted, myPos){
  const pyramid = WORLDS.getPyramid(C.nation||'panthalassa');
  const levels = pyramid.map(function(p){ return p.id; });
  const idx = levels.indexOf(C.club.level);
  const upName = (idx > 0 && pyramid[idx-1]) ? pyramid[idx-1].name : 'la division supérieure';
  // Un nom générique mais crédible, dérivé de la division du dessus.
  const prefixes = ['Avant-dernier de', 'Barragiste de', 'Rescapé de'];
  const pre = prefixes[Math.floor(Math.random()*prefixes.length)];
  return pre + ' ' + upName;
}

// Nomme le manager à la tête d'une VRAIE équipe réserve. Les réserves existent
// déjà dans l'univers (branches d'une Maison du Pilier — domestiques, gardes… —
// ou équipes affiliées d'un club), avec leur propre effectif à leur niveau réel
// (souvent DH, jeunes ou sans potentiel). On récupère cet effectif existant
// plutôt que d'affaiblir artificiellement la première équipe.
function _buildReserveSquad(C){
  if(!C || !C.club) return;
  // 1) Cherche une équipe affiliée/réserve déjà construite pour ce club.
  const affs = C.affiliates || [];
  // Préfère une branche de rôle « réserve » (gardes, domestiques…) ; sinon la
  // première équipe affiliée non vide.
  let res = affs.find(function(a){ return a && (a.players||[]).length && /réserve|reserve|garde|domestique|U23|académie/i.test(a.role||''); })
         || affs.find(function(a){ return a && (a.players||[]).length; });

  if(res){
    // Bascule : la réserve DEVIENT l'équipe dirigée, la première équipe passe
    // « au-dessus » (on ne la gère plus). On adopte l'effectif réel existant.
    C.players = (res.players||[]).slice();
    C.bench   = (res.bench||[]).slice();
    C.reserves = [];
    C.club.level = res.level || C.club.level;   // niveau réel de la réserve (souvent DH)
    // Cette équipe n'est plus listée comme affiliée (on la dirige).
    C.affiliates = affs.filter(function(a){ return a !== res; });
    return;
  }

  // 2) Aucune réserve pré-existante (nations sans système de branches) :
  //    on génère un effectif de niveau DH, jeune, à faible potentiel — ce que
  //    sont ces équipes dans l'univers (domestiques, gardes…), PAS des cadres.
  try{
    if(window.WORLDS && WORLDS.generateSquad){
      const sq = WORLDS.generateSquad(C.nation, C.club.region, {
        positions: ['GB','DC','DD','DG','MC','MC','ATT'],
        bench: ['GB','DC','MC','ATT'], reserves: [], level: 'dh',
      });
      if(sq && sq.players){
        C.players = sq.players; C.bench = sq.bench||[]; C.reserves = [];
        C.club.level = 'dh';
      }
    }
  }catch(e){ console.error('reserve squad gen:', e); }
}

// ── ONGLET « Z » : réseau social immersif ───────────────────────────────
// Remplace les petites lignes de la Vue par un vrai fil façon réseau social :
// avatars colorés, nom + @pseudo, date, texte, et compteurs d'engagement
// (commentaires, reposts, likes). Le fil mêle réactions des supporters
// (C.social) et manchettes de la presse (C.press) présentées comme des posts
// de comptes médias.
const _Z_AVATAR_COLORS = ['#1878e8','#8840e0','#18c860','#e0a020','#e02030','#00b0b0','#e060a0','#6070e0'];

function _zAvatar(seed, letter){
  const col = _Z_AVATAR_COLORS[(seed||0) % _Z_AVATAR_COLORS.length];
  return '<div style="width:40px;height:40px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,'+col+','+col+'99);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px;color:#fff">'+(letter||'?').toUpperCase()+'</div>';
}

function _zFmtNum(n){
  if(n >= 1000) return (n/1000).toFixed(1).replace('.0','')+'K';
  return ''+n;
}

// Icônes d'action (SVG inline, style épuré comme la maquette).
function _zActionIcons(post){
  const ic = function(path, val, col){
    return '<div style="display:flex;align-items:center;gap:6px;color:'+(col||'var(--muted)')+';font-size:12px">'+
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+path+'</svg>'+
      '<span>'+val+'</span></div>';
  };
  const comment = '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>';
  const repost = '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>';
  const like = '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>';
  let h = '<div style="display:flex;justify-content:space-between;max-width:320px;margin-top:8px">';
  h += ic(comment, _zFmtNum(post.comments||0));
  h += ic(repost, _zFmtNum(post.reposts||0), post.tone==='good'?'var(--green)':'var(--muted)');
  h += ic(like, _zFmtNum(post.likes||0), post.tone==='bad'?'var(--muted)':'#e0608a');
  h += '<div style="display:flex;align-items:center;color:var(--muted)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></div>';
  h += '</div>';
  return h;
}

// Un post (supporter ou média) rendu comme une carte de fil.
function _zRenderPost(post, isMedia){
  const name = post.name || (isMedia ? '📰 Média Sport' : 'Supporter');
  const handle = post.who || (isMedia ? '@mediasport' : '@fan');
  const letter = (name||'?').replace(/[^A-Za-zÀ-ÿ]/g,'').charAt(0) || 'Z';
  const seed = isMedia ? 4 : (post.avatar||0);
  const dateLbl = 'S'+(post.season||1)+' · J'+(post.week||0);
  const accent = post.tone==='good' ? 'var(--green)' : post.tone==='bad' ? 'var(--red)' : 'transparent';

  let h = '<div style="display:flex;gap:12px;padding:12px 14px;border-bottom:1px solid var(--b1);'+(accent!=='transparent'?'border-left:2px solid '+accent+';':'')+'">';
  h += _zAvatar(seed, isMedia ? '📰' : letter);
  h += '<div style="flex:1;min-width:0">';
  // En-tête : nom · @handle · date + badge média.
  h += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">';
  h += '<span style="font-weight:800;color:var(--fg);font-size:13px">'+name+'</span>';
  if(isMedia) h += '<span style="font-size:9px;background:var(--blue);color:#fff;padding:0 5px;border-radius:8px;font-weight:700">Média</span>';
  h += '<span style="color:var(--muted);font-size:12px">'+handle+' · '+dateLbl+'</span>';
  h += '</div>';
  // Corps du post.
  h += '<div style="color:var(--fg);font-size:13px;line-height:1.5;margin-top:3px;white-space:pre-wrap">'+post.text+'</div>';
  // Barre d'actions.
  h += _zActionIcons(post);
  h += '</div></div>';
  return h;
}

function _renderDirectorSocial(){
  const C = careerV2;
  const social = (C.social||[]);
  const press = (C.press||[]);

  // En-tête « Z ».
  let h = '<div style="max-width:600px">';
  h += '<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:2px solid var(--b1);position:sticky;top:0;background:var(--dark);z-index:2">';
  h += '<div style="width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,#1878e8,#8840e0);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:22px;color:#fff;font-family:\'Barlow Condensed\',sans-serif">Z</div>';
  h += '<div><div style="font-weight:900;font-size:16px;color:var(--fg);letter-spacing:.5px">Z</div>';
  h += '<div style="font-size:9px;color:var(--muted)">L\'actu de votre club, en direct</div></div>';
  // Note contextuelle : au niveau amateur, la médiatisation est faible — le fil
  // est surtout animé par les supporters, pas par la presse.
  try{
    if(typeof _hasFormalMedia==='function' && !_hasFormalMedia()){
      h += '<div style="padding:6px 14px;font-size:9px;color:var(--muted);font-style:italic;border-bottom:1px solid var(--b1)">📻 À ce niveau, peu de médias suivent le club : ce sont surtout vos supporters qui font vivre le fil.</div>';
    }
  }catch(e){}
  // Panneau chaîne vidéo (création / publication / stats).
  try{ if(typeof _renderChannelPanel==='function') h += _renderChannelPanel(); }catch(e){}
  h += '</div>';

  if(!social.length && !press.length){
    h += '<div style="padding:40px 20px;text-align:center;color:var(--muted)">';
    h += '<div style="font-size:32px;margin-bottom:8px">💬</div>';
    h += '<div style="font-size:12px">Aucun post pour l\'instant.</div>';
    h += '<div style="font-size:10px;margin-top:4px">Jouez des matchs : supporters et médias réagiront ici.</div>';
    h += '</div></div>';
    return h;
  }

  // On fusionne supporters + presse en un seul fil, trié du plus récent au
  // plus ancien (par saison puis journée).
  const feed = [];
  social.forEach(function(p){ feed.push({ post:p, isMedia:false, s:p.season||0, w:p.week||0 }); });
  press.forEach(function(p){
    // La presse n'a pas d'engagement : on lui en fabrique un, façon compte média.
    const likes = 200 + Math.floor(Math.random()*3000);
    feed.push({ post:{ name:'📰 '+(p.source||'Sport Info'), who:'@sportinfo', text:p.text, tone:p.tone,
      likes:likes, reposts:Math.round(likes*0.2), comments:Math.round(likes*0.08),
      season:p.season, week:p.week }, isMedia:true, s:p.season||0, w:p.week||0 });
  });
  feed.sort(function(a,b){ return (b.s-a.s) || (b.w-a.w); });

  feed.forEach(function(item){ h += _zRenderPost(item.post, item.isMedia); });
  h += '</div>';
  return h;
}

// Aperçu compact du fil « Z » en Vue : le dernier post + un bouton vers l'onglet.
function _renderSocialTeaser(){
  const C = careerV2;
  const social = (C && C.social) || [];
  if(!social.length) return '';
  const last = social[0];
  const letter = (last.name||'Z').charAt(0).toUpperCase();
  let h = '<div class="ccard ccard-blue" style="cursor:pointer" onclick="renderCareerDirectorTab(\'social\')">';
  h += '<div class="ccard-title">💬 Z <span style="font-size:8px;color:var(--muted);font-weight:400">— toucher pour ouvrir</span></div>';
  h += '<div style="display:flex;gap:8px;align-items:flex-start">';
  h += '<div style="width:28px;height:28px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,#1878e8,#8840e0);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;color:#fff">'+letter+'</div>';
  h += '<div style="flex:1;min-width:0">';
  h += '<div style="font-size:10px;font-weight:700;color:var(--fg)">'+(last.name||'Supporter')+' <span style="color:var(--muted);font-weight:400">'+(last.who||'')+'</span></div>';
  h += '<div style="font-size:10px;color:var(--fg);line-height:1.4;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">'+last.text+'</div>';
  h += '</div></div>';
  if(social.length>1) h += '<div style="font-size:8px;color:var(--muted);margin-top:5px">+ '+(social.length-1)+' autres posts dans Z</div>';
  h += '</div>';
  return h;
}

// ── BLASON GÉNÉRÉ ────────────────────────────────────────────────────────
// Petit écusson SVG dérivé du nom + de la couleur du club, pour donner une
// identité visuelle aux clubs sans blason importé. Déterministe (même club →
// même blason). Rendu inline, sans dépendance.
function _clubCrest(name, color, size){
  size = size || 16;
  const nm = (name||'?').trim();
  // Couleur : celle du club, sinon dérivée du nom (teinte stable).
  let col = color;
  if(!col){
    let hash = 0; for(let i=0;i<nm.length;i++) hash = (hash*31 + nm.charCodeAt(i)) & 0xffffff;
    col = 'hsl(' + (hash % 360) + ',55%,45%)';
  }
  const initial = (nm.replace(/[^A-Za-zÀ-ÿ0-9]/g,'').charAt(0) || '?').toUpperCase();
  // Forme d'écusson (blason) : rectangle à base pointue.
  const s = size, w = s, hgt = s;
  const fs = Math.round(s*0.58);
  let svg = '<svg width="'+w+'" height="'+hgt+'" viewBox="0 0 20 22" style="flex-shrink:0;vertical-align:middle" xmlns="http://www.w3.org/2000/svg">';
  svg += '<path d="M2 2 H18 V13 Q18 19 10 21 Q2 19 2 13 Z" fill="'+col+'" stroke="rgba(255,255,255,0.25)" stroke-width="0.8"/>';
  // Barre horizontale décorative (héraldique simple).
  svg += '<path d="M2 8 H18" stroke="rgba(255,255,255,0.18)" stroke-width="1.4"/>';
  svg += '<text x="10" y="'+(fs*0.5+5)+'" text-anchor="middle" font-size="9" font-weight="900" fill="#fff" font-family="sans-serif" dominant-baseline="middle">'+initial+'</text>';
  svg += '</svg>';
  return '<span style="display:inline-flex;width:'+size+'px;height:'+size+'px;align-items:center;justify-content:center;flex-shrink:0">'+svg+'</span>';
}

// ── LANCER UN MATCH DE FUTSAL 5v5 (jouable) ──────────────────────────────
// Réutilise le moteur 5v5 avec l'ÉQUIPE FUTSAL du club contre l'adversaire du
// jour de la compétition futsal. À la fin, le résultat est enregistré dans le
// classement futsal (pas dans le championnat principal).
function playFutsalMatch(){
  const C = careerV2;
  if(!C || !C.futsal || !C.futsal.active){ logEvent('Aucune saison de futsal en cours.','#e02030'); return; }
  const F = C.futsal;
  // Adversaire du jour : match de playoff si on y est, sinon fixture régulière.
  let oppName, oppRef;
  if(F.phase==='playoffs'){
    const m = (typeof _futsalMyPlayoffMatch==='function') ? _futsalMyPlayoffMatch() : null;
    if(!m){ logEvent('Aucun match de playoff à jouer.','#e0a020'); return; }
    const other=(m.a&&m.a.isPlayer)?m.b:m.a;
    oppName=other?other.name:'Adversaire'; oppRef=other;
  } else {
    const fix = F.fixtures[F.idx];
    if(!fix){ logEvent('Saison de futsal terminée.','#e0a020'); return; }
    oppName=fix.oppName; oppRef=F.opps.find(function(o){ return o.name===oppName; });
  }
  const squad = (C.futsalSquad||[]).filter(function(p){ return p && !((p._injWeeks||0)>0 || (p._suspMatches||0)>0); });
  if(squad.length < 5){ logEvent('⚽ Il faut 5 joueurs futsal valides pour jouer.','#e06060'); return; }

  // Passage en mode 5v5.
  window.gameMode = '5v5';
  try{ if(typeof _applyMode5v5==='function') _applyMode5v5(); }catch(e){}
  try{ if(typeof resize==='function') resize(); }catch(e){}

  const clone = function(p){ return Object.assign({}, p); };
  const XI_POS = ['GB','DC','MOG','MOD','ATT'];
  const BENCH_POS = ['GB','DC','ATT'];
  // Compo du club : 5 titulaires + banc depuis l'effectif futsal.
  const pool = squad.map(clone);
  const gk = pool.find(function(p){ return p.pos==='GB'; });
  const starters = [];
  if(gk) starters.push(gk);
  pool.forEach(function(p){ if(starters.indexOf(p)<0 && starters.length<5) starters.push(p); });
  const matchBench = pool.filter(function(p){ return starters.indexOf(p)<0; }).slice(0,3);

  teams[0] = {
    name: C.club.name + ' Futsal', color: C.club.color||'#1878e8', img:'',
    strat5:'121', players: starters, bench: matchBench, reserves:[],
  };

  // Adversaire futsal au niveau de sa force.
  const opp = oppRef || { name:oppName, strength:55, color:'#8840e0' };
  const lvl = (opp.strength||55)>=65 ? 'r2' : (opp.strength||55)>=52 ? 'r3' : 'dh';
  const aiSquad = WORLDS.generateSquad(C.nation||'panthalassa', C.club.region||'', {
    positions: XI_POS, bench: BENCH_POS, reserves:[], level: lvl,
  });
  teams[1] = {
    name: opp.name||oppName, color: opp.color||'#8840e0', img:'', strat5:'121',
    players: aiSquad.players, bench: aiSquad.bench, reserves:[],
  };

  applyFormationRoles(0);
  applyFormationRoles(1);
  window._futsalPlaying = true;
  window._careerFixPlaying = null;   // ce n'est PAS un match de championnat

  nav('match');
  resetMatch();
  G.leagueMode = true;
  G._humanTeams = [true, false];
  G._isFutsalMatch = true;
  try{ if(typeof resetManagerAi==='function') resetManagerAi(); }catch(e){}
  syncHUD(); renderTB(0); renderTB(1);
  showPreMatch(null);
}

// Appelé par endMatch quand le match joué était un match de futsal.
function _recordFutsalMatchResult(){
  const C = careerV2;
  if(!C || !window._futsalPlaying) return;
  const s0 = (G.scores && G.scores[0]) || 0;
  const s1 = (G.scores && G.scores[1]) || 0;
  window._futsalPlaying = null;
  G._isFutsalMatch = false;
  try{ if(typeof futsalRecordResult==='function') futsalRecordResult(s0, s1); }catch(e){ console.error('futsal result:',e); }
  // Retour au mode par défaut du club.
  window.gameMode = window._clubDefaultMode || '7v7';
}

// ── ONGLET FUTSAL : compétition 5v5 du club ──────────────────────────────
function _renderDirectorFutsal(){
  const C = careerV2;
  const F = C.futsal;
  const squadN = (C.futsalSquad||[]).length;
  let h = '<div style="padding:4px">';
  h += '<div style="font-size:12px;font-weight:900;color:#1878e8;margin-bottom:8px">⚽ Futsal 5v5</div>';

  // Effectif futsal insuffisant.
  if(squadN < 5){
    h += '<div class="ccard ccard-blue"><div class="ctxt-sm">Votre équipe futsal compte <b>'+squadN+'</b> joueur(s). Il en faut au moins <b>5</b> pour disputer une compétition.</div>';
    h += '<div class="ctxt-xs" style="margin-top:6px;color:var(--muted)">Envoyez des joueurs au futsal depuis l\'onglet Effectif (fiche d\'un joueur → « ⚽ Envoyer au futsal 5v5 »).</div></div>';
    h += '</div>';
    return h;
  }

  // Pas de saison en cours : proposer d'en lancer une.
  if(!F || (!F.active && !F.done)){
    const divId=(F&&F.divId)||'d2';
    const divName=(FUTSAL_DIVISIONS[divId]||FUTSAL_DIVISIONS.d2).name;
    h += '<div class="ccard ccard-blue"><div class="ctxt-sm" style="margin-bottom:8px">Votre équipe futsal est prête (<b>'+squadN+'</b> joueurs) — division actuelle : <b>'+divName+'</b>. Poule de '+FUTSAL_POOL_SIZE+', aller-retour, puis playoffs.</div>';
    h += '<button class="btn btng" onclick="futsalStartSeason()" style="width:100%;font-size:11px;padding:8px">🚀 Lancer une saison</button></div>';
    h += _futsalPalmaresBlock(F);
    h += '</div>';
    return h;
  }

  const div=FUTSAL_DIVISIONS[F.divId]||FUTSAL_DIVISIONS.d2;
  h += '<div style="font-size:9px;color:var(--muted);margin:-4px 0 8px">'+div.name+' · saison '+(F.season||1)+'</div>';

  // ── PHASE PLAYOFFS ─────────────────────────────────────────────────────
  if(F.phase==='playoffs' && F.playoffs){
    const po=F.playoffs;
    h += '<div class="ccard ccard-gold"><div class="ccard-title">🏆 Playoffs</div>';
    const showM=function(m,label){
      if(!m) return '';
      const wa=m.winner&&m.winner===m.a, wb=m.winner&&m.winner===m.b;
      const nm=function(t,w){ return '<span style="color:'+(t&&t.isPlayer?'#1878e8':w?'#18c860':'var(--fg)')+';font-weight:'+(t&&t.isPlayer||w?'900':'400')+'">'+(t?t.name:'?')+'</span>'; };
      return '<div style="display:flex;justify-content:space-between;font-size:10px;padding:4px 4px;border-bottom:1px solid var(--b1)"><span>'+label+' : '+nm(m.a,wa)+' vs '+nm(m.b,wb)+'</span><span style="font-weight:900;color:var(--muted)">'+(m.score||'')+'</span></div>';
    };
    h += showM(po.semis[0],'Demi 1');
    h += showM(po.semis[1],'Demi 2');
    if(po.final) h += showM(po.final,'🏆 Finale');
    h += '</div>';
    const my=(typeof _futsalMyPlayoffMatch==='function')?_futsalMyPlayoffMatch():null;
    if(my && !F.done){
      const other=(my.a&&my.a.isPlayer)?my.b:my.a;
      h += '<div class="ccard ccard-blue"><div class="ccard-title">'+(po.round==='final'?'Finale':'Demi-finale')+'</div>';
      h += '<div style="text-align:center;margin:8px 0;font-size:11px"><b style="color:#1878e8">'+C.club.name+'</b> vs <b>'+(other?other.name:'?')+'</b></div>';
      h += '<button class="btn btng" onclick="playFutsalMatch()" style="width:100%;font-size:12px;padding:10px;background:#1878e8;color:#fff;border:none">▶️ Jouer '+(po.round==='final'?'la finale':'la demi-finale')+'</button></div>';
    }
    h += _futsalScorersBlock(F);
    h += '</div>';
    return h;
  }

  // ── CLASSEMENT (saison régulière ou terminée) ──────────────────────────
  const table = (F.finalTable) ? F.finalTable : (F.opps||[]).concat([F.myStats]).sort(function(a,b){ return (b.Pts-a.Pts)||((b.GF-b.GA)-(a.GF-a.GA)); });
  h += '<div class="ccard"><div class="ccard-title">Classement</div>';
  table.forEach(function(t, i){
    const me = t.isPlayer;
    const zone = i<4 ? '#f0c028' : (i>=FUTSAL_POOL_SIZE-1 ? '#e06060' : 'transparent'); // top4 playoffs, dernier relégable
    const rowBg = me ? 'background:rgba(24,120,232,.14);border-radius:6px;' : (i%2?'background:rgba(255,255,255,.02);':'');
    h += '<div style="display:grid;grid-template-columns:20px 1fr 24px 24px 24px 30px 28px;gap:0;align-items:center;padding:5px 4px;border-bottom:1px solid var(--b1);border-left:3px solid '+zone+';font-size:10px;'+rowBg+'">';
    h += '<div style="color:var(--muted)">'+(i+1)+'</div>';
    h += '<div style="display:flex;align-items:center;gap:5px;min-width:0">'+((typeof _clubCrest==='function')?_clubCrest(t.name,t.color,14):'')+'<span style="font-weight:'+(me?'900':'600')+';color:'+(me?'#1878e8':'var(--fg)')+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+t.name+'</span></div>';
    h += '<div style="text-align:center;color:var(--muted)">'+t.P+'</div>';
    h += '<div style="text-align:center;color:#18c860">'+t.W+'</div>';
    h += '<div style="text-align:center;color:#e06060">'+t.L+'</div>';
    h += '<div style="text-align:center;font-size:9px;color:var(--muted)">'+t.GF+':'+t.GA+'</div>';
    h += '<div style="text-align:center;font-weight:900;color:'+(me?'#1878e8':'var(--fg)')+'">'+t.Pts+'</div>';
    h += '</div>';
  });
  h += '<div style="display:flex;gap:12px;margin-top:6px;font-size:8px;color:var(--muted)"><span><span style="display:inline-block;width:8px;height:8px;background:#f0c028;border-radius:2px;vertical-align:middle;margin-right:3px"></span>Playoffs (top 4)</span><span><span style="display:inline-block;width:8px;height:8px;background:#e06060;border-radius:2px;vertical-align:middle;margin-right:3px"></span>Relégable</span></div>';
  h += '</div>';

  if(F.done){
    const myRank = table.findIndex(function(t){ return t.isPlayer; })+1;
    h += '<div class="ccard ccard-gold"><div class="ccard-title">🏁 Saison terminée</div>';
    h += '<div class="ctxt-sm">Champion : <b>'+(F.champion||'?')+'</b>'+(F.lastTopScorer?(' · Soulier d\'or : <b>'+F.lastTopScorer.name+'</b> ('+F.lastTopScorer.goals+')'):'')+'</div>';
    h += '<button class="btn btng" onclick="futsalStartSeason()" style="width:100%;font-size:11px;padding:8px;margin-top:8px">🔄 Nouvelle saison</button></div>';
  } else {
    const fix = F.fixtures[F.idx];
    if(fix){
      h += '<div class="ccard ccard-blue"><div class="ccard-title">Prochain match ('+(F.idx+1)+'/'+F.fixtures.length+')</div>';
      h += '<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin:8px 0">';
      h += '<span style="font-weight:800;color:#1878e8">'+C.club.name+'</span>';
      h += '<span style="color:var(--muted);font-size:10px">'+(fix.isHome?'🏠 vs':'✈️ vs')+'</span>';
      h += '<span style="font-weight:800;color:var(--fg)">'+fix.oppName+'</span>';
      h += '</div>';
      h += '<button class="btn btng" onclick="playFutsalMatch()" style="width:100%;font-size:12px;padding:10px;background:#1878e8;color:#fff;border:none">▶️ Jouer le match</button></div>';
    }
  }

  h += _futsalScorersBlock(F);
  h += _futsalPalmaresBlock(F);

  // Résultats passés (saison régulière).
  const played = (F.fixtures||[]).filter(function(f){ return f.played; });
  if(played.length){
    h += '<div class="ccard"><div class="ccard-title">Résultats</div>';
    played.forEach(function(f){
      const win = f.gf>f.ga, draw=f.gf===f.ga;
      const col = win?'#18c860':draw?'#f0c028':'#e06060';
      h += '<div style="display:flex;justify-content:space-between;font-size:10px;padding:4px 4px;border-bottom:1px solid var(--b1)"><span>'+(f.isHome?'🏠':'✈️')+' '+f.oppName+'</span><span style="font-weight:900;color:'+col+'">'+f.gf+'–'+f.ga+'</span></div>';
    });
    h += '</div>';
  }

  h += '</div>';
  return h;
}

// Bloc buteurs de la saison en cours.
function _futsalScorersBlock(F){
  const sc=F.seasonScorers||{};
  const arr=Object.keys(sc).map(function(k){ return {name:k,g:sc[k]}; }).sort(function(a,b){ return b.g-a.g; }).slice(0,5);
  if(!arr.length) return '';
  let h='<div class="ccard"><div class="ccard-title">⚽ Buteurs (saison)</div>';
  arr.forEach(function(s,i){
    h+='<div style="display:flex;justify-content:space-between;font-size:10px;padding:3px 4px;border-bottom:1px solid var(--b1)"><span>'+(i===0?'🥇 ':(i+1)+'. ')+s.name+'</span><span style="font-weight:900;color:#1878e8">'+s.g+'</span></div>';
  });
  h+='</div>';
  return h;
}

// Bloc palmarès (titres passés).
function _futsalPalmaresBlock(F){
  if(!F || !F.palmares || !F.palmares.length) return '';
  let h='<div class="ccard ccard-gold"><div class="ccard-title">🏆 Palmarès futsal</div>';
  F.palmares.slice(0,6).forEach(function(p){
    h+='<div style="font-size:10px;padding:3px 4px;border-bottom:1px solid var(--b1)">🏆 Saison '+p.season+' — <b>'+p.title+'</b> ('+p.div+')</div>';
  });
  h+='</div>';
  return h;
}
