'use strict';
// ══════════════════════════════════════════════════════════════════════
//  MANAGER_AI.JS — « Coach » de l'équipe adverse en IA vs Joueur
//  ─────────────────────────────────────────────────────────────────────
//  Le moteur (ia.js/engine.js) simule DÉJÀ le jeu des deux équipes sur le
//  terrain. Ce module ajoute la couche « banc de touche » qui manquait pour
//  l'adversaire : un entraîneur virtuel qui, comme un vrai coach, réagit au
//  score et au temps qui passe en changeant la MENTALITÉ de son équipe
//  (attaque / défense / pressing) et en effectuant des REMPLACEMENTS
//  (jambes fraîches, plus offensif quand il est mené, plus défensif quand il
//  mène tard).
//
//  Portée :
//   • Ne pilote QUE les équipes NON contrôlées par un humain (voir
//     _mgrHumanTeams()). Le joueur garde la main pleine sur sa propre équipe.
//   • Purement ADDITIF : si ce fichier n'est pas chargé, le jeu se comporte
//     exactement comme avant (mentalité neutre, aucun changement auto tactique).
//   • S'appuie sur les leviers EXISTANTS : G.tacMode[ti] (lu par data.js/ia.js)
//     et doSub(ti,pi,bi) (défini dans visual.js). N'invente aucune mécanique.
//   • Prudent : cadence lente, décisions espacées, respecte la limite de 3
//     changements du 11v11 (déléguée à doSub/canSub11v11).
// ══════════════════════════════════════════════════════════════════════

// Quelles équipes sont pilotées par un HUMAIN ce match ? Par convention, on
// lit G._humanTeams = [bool,bool] posé au lancement du match (voir hooks).
// Repli sûr : si l'info manque, on considère team0 = humain (cas carrière, le
// plus fréquent), team1 = IA. En match d'exhibition « humain vs humain », les
// lanceurs posent [true,true] → ce module ne fait alors rien.
function _mgrHumanTeams(){
  if(typeof G==='undefined') return [true,true];
  if(Array.isArray(G._humanTeams) && G._humanTeams.length===2) return G._humanTeams;
  return [true,false];
}
function _mgrIsAiTeam(ti){
  const hum=_mgrHumanTeams();
  return !hum[ti];
}

// OVR simple d'un joueur (moyenne de ses stats), tolérant aux données absentes.
function _mgrOvr(p){
  if(!p||!p.s) return 40;
  const v=[p.s.sht,p.s.spd,p.s.def,p.s.stam,p.s.tec,p.s.res].filter(x=>typeof x==='number');
  return v.length ? v.reduce((a,b)=>a+b,0)/v.length : 40;
}
// Un joueur est-il « disponible » sur le terrain (ni expulsé, ni gravement
// blessé, ni déjà sorti) ?
function _mgrOnPitchOk(p){
  return p && !p.red && (p.injLevel||0)<3 && (p.hp||0)>0;
}
// Un remplaçant est-il utilisable ?
function _mgrBenchOk(b){
  return b && b.onBench && !b.subbedOut && (b.injLevel||0)<2 && (b.hp==null || b.hp>25);
}

// Différence de buts DU POINT DE VUE de l'équipe ti (positif = elle mène).
function _mgrGoalDiff(ti){
  const s=G.scores||[0,0];
  return (s[ti]||0) - (s[1-ti]||0);
}

// Minute « effective » 0..90+ (les prolongations comptent comme fin de match).
function _mgrMinute(){
  const m=G.minute||0;
  if(G.half>=3) return Math.max(90, m); // prolongations = phase finale
  return m;
}

// ── CHOIX DE MENTALITÉ ────────────────────────────────────────────────
// Un coach ne change pas d'avis toutes les 30 secondes : on ne bascule la
// mentalité que par paliers de score/temps, et on mémorise la dernière valeur
// posée pour éviter le spam de logs.
function _mgrDesiredMentality(ti){
  const gd=_mgrGoalDiff(ti);
  const mn=_mgrMinute();
  const late = mn>=70;
  const veryLate = mn>=82;
  // Plan d'entame : tant que le score est nul et qu'on n'est pas en fin de
  // match, on conserve le plan de départ (bloc bas / pressing / équilibré)
  // plutôt que de retomber en neutre. Le contexte (mené/en tête) prend ensuite
  // le dessus dès qu'un but est marqué.
  const kickoffPlan = (Array.isArray(G._mgrPlan) ? G._mgrPlan[ti] : null) || null;

  // Mené : on pousse. Plus on est mené et tard, plus on est agressif.
  if(gd<=-2 && late) return 'attack';
  if(gd<=-1){
    if(veryLate) return 'attack';
    if(late)     return 'attack';
    return 'press';           // mené tôt : on presse pour récupérer vite
  }
  // À égalité : on garde le plan d'entame, avec un pressing en fin de match
  // pour tenter d'arracher la victoire.
  if(gd===0){
    if(veryLate) return 'press';
    return kickoffPlan;       // conserve l'intention de départ
  }
  // En tête : on gère. Plus l'avance est courte et le temps avancé, plus on
  // ferme le jeu.
  if(gd===1){
    if(veryLate) return 'defend';
    if(late)     return 'defend';
    return kickoffPlan;       // avance d'un but tôt : on garde le plan
  }
  // gd>=2 : large avance → bloc bas en fin de match, sinon normal (on ne se
  // découvre pas inutilement mais on n'a pas besoin de sur-défendre tôt).
  if(veryLate) return 'defend';
  if(late)     return 'defend';
  return null;
}

const _MGR_MENTALITY_LABEL = {
  attack:'passe à l\'offensive',
  press:'intensifie le pressing',
  defend:'referme le jeu',
  null:'revient à un bloc équilibré',
};

function _mgrApplyMentality(ti){
  const want=_mgrDesiredMentality(ti);
  if(!G._mgrLastMode) G._mgrLastMode=[undefined,undefined];
  const prev=G.tacMode ? G.tacMode[ti] : null;
  if(want===prev){ G._mgrLastMode[ti]=want; return; }
  // Appliquer.
  if(G.tacMode) G.tacMode[ti]=want;
  // Log discret, une seule fois par changement (et pas au tout premier tour,
  // pour ne pas polluer l'entame de match avec un « bloc équilibré »).
  if(G._mgrLastMode[ti]!==undefined){
    const name=(teams[ti]&&teams[ti].name)||'L\'adversaire';
    const verb=_MGR_MENTALITY_LABEL[want] || _MGR_MENTALITY_LABEL[null];
    const col=(teams[ti]&&teams[ti].color)||'#8090a0';
    try{ logEvent('🧠 '+name+' '+verb+'.', col); }catch(e){}
  }
  G._mgrLastMode[ti]=want;
  // Rafraîchir l'affichage des boutons tac si le panneau regarde cette équipe.
  try{ if(typeof _tacTi!=='undefined' && _tacTi===ti && typeof updateTacBtnColors==='function') updateTacBtnColors(); }catch(e){}
}

// ── REMPLACEMENTS ─────────────────────────────────────────────────────
// Cadence : au plus un changement toutes ~12 minutes de jeu, et seulement à
// partir de la 55e (comme un vrai coach). On mémorise combien de changements
// « tactiques » l'IA a faits pour ne pas vider tout le banc.
function _mgrCanSubNow(ti){
  const mn=_mgrMinute();
  const tier=_mgrTier();
  // Un coach plus relevé intervient plus tôt et enchaîne plus vite.
  const minMinute = tier>=3 ? 40 : tier>=2 ? 50 : 58;
  const spacing   = tier>=3 ? 8  : tier>=2 ? 10 : 14;
  if(mn<minMinute) return false;
  if(!G._mgrSubAt) G._mgrSubAt=[-99,-99];
  if(mn - G._mgrSubAt[ti] < spacing) return false;
  if(!G._mgrSubCount) G._mgrSubCount=[0,0];
  const maxSubs = 3;
  if(G._mgrSubCount[ti] >= maxSubs) return false;
  return true;
}

// Un joueur GRAVEMENT blessé (injLevel>=2) doit sortir immédiatement, quelle
// que soit la cadence — comme un vrai coach face à une blessure. Renvoie true
// si un remplacement d'urgence a été effectué.
function _mgrEmergencyInjurySub(ti){
  const starters=(teams[ti]&&teams[ti].players)||[];
  let worstIdx=-1, worstLvl=0;
  starters.forEach(function(p, i){
    if(p && p.pos!=='GB' && !p.subbedOut && (p.injLevel||0)>=2 && (p.injLevel||0)>worstLvl){
      worstLvl=p.injLevel; worstIdx=i;
    }
  });
  if(worstIdx<0) return false;
  if(!G._mgrSubCount) G._mgrSubCount=[0,0];
  if(G._mgrSubCount[ti] >= 3) return false;         // banc épuisé : on serre les dents
  const outP=starters[worstIdx];
  const inn=_mgrBestBenchFor(ti, outP.pos);
  if(!inn) return false;
  try{
    doSub(ti, worstIdx, inn.bi, 'bench');
    if(!G._mgrSubAt) G._mgrSubAt=[-99,-99];
    G._mgrSubAt[ti]=_mgrMinute();
    G._mgrSubCount[ti]++;
    const name=(teams[ti]&&teams[ti].name)||'L\'adversaire';
    const col=(teams[ti]&&teams[ti].color)||'#8090a0';
    try{ logEvent('🚑 '+name+' — sortie sur blessure ('+outP.name+').', col); }catch(e){}
    return true;
  }catch(e){ console.error('emergency sub:', e); return false; }
}

// Trouve le meilleur remplaçant du banc pour un poste donné (ou proche).
function _mgrBestBenchFor(ti, wantPos){
  const bench=(teams[ti]&&teams[ti].bench)||[];
  const usable=bench.map((b,bi)=>({b,bi})).filter(o=>_mgrBenchOk(o.b));
  if(!usable.length) return null;
  // Priorité : même poste, sinon même « groupe » (déf/mil/att), puis meilleur OVR.
  const grp=(typeof roleGroup==='function')?roleGroup:(pos=>pos);
  const wantG=grp(wantPos);
  usable.sort((x,y)=>{
    const xs=(x.b.pos===wantPos?2:(grp(x.b.pos)===wantG?1:0));
    const ys=(y.b.pos===wantPos?2:(grp(y.b.pos)===wantG?1:0));
    if(xs!==ys) return ys-xs;
    return _mgrOvr(y.b)-_mgrOvr(x.b);
  });
  return usable[0];
}

// Choisit le titulaire à sortir selon l'intention (tired / offensive / defensive)
// et renvoie {pi, wantPos} — ou null si rien de pertinent.
function _mgrPickStarterOut(ti, intent){
  const players=(teams[ti]&&teams[ti].players)||[];
  const idx=players.map((p,pi)=>({p,pi})).filter(o=>_mgrOnPitchOk(o.p) && o.p.pos!=='GB');
  if(!idx.length) return null;

  if(intent==='tired'){
    // Le plus fatigué (HP bas ou endurance basse) sort.
    idx.sort((a,b)=>{
      const fa=(a.p.hp!=null?a.p.hp:100) + (a.p.s&&a.p.s.stam||60)*0.5;
      const fb=(b.p.hp!=null?b.p.hp:100) + (b.p.s&&b.p.s.stam||60)*0.5;
      return fa-fb;
    });
    const worst=idx[0];
    // On ne remplace que si vraiment entamé.
    const tiredEnough = (worst.p.hp!=null && worst.p.hp<45) || ((worst.p.s&&worst.p.s.stam||99)<=50);
    if(!tiredEnough) return null;
    return { pi:worst.pi, wantPos:worst.p.pos };
  }

  if(intent==='offensive'){
    // Sortir un défenseur (le moins bon offensivement) pour un attaquant frais.
    const defs=idx.filter(o=>['DC','DD','DG','MDC','FIXO','LB','RB'].includes(o.p.pos));
    const pool=defs.length?defs:idx;
    pool.sort((a,b)=>_mgrOvr(a.p)-_mgrOvr(b.p)); // le plus faible sort
    return { pi:pool[0].pi, wantPos:'ATT' };
  }

  if(intent==='defensive'){
    // Sortir un attaquant (le moins bon défensivement) pour un défenseur frais.
    const atts=idx.filter(o=>['ATT','ATT2','MO','MOG','MOD','AG','AD','PIVOT'].includes(o.p.pos));
    const pool=atts.length?atts:idx;
    pool.sort((a,b)=>_mgrOvr(a.p)-_mgrOvr(b.p));
    return { pi:pool[0].pi, wantPos:'DC' };
  }
  return null;
}

// Décide et exécute AU PLUS un changement pour l'équipe IA ti.
function _mgrMaybeSub(ti){
  if(!_mgrCanSubNow(ti)) return;
  const gd=_mgrGoalDiff(ti);
  const mn=_mgrMinute();

  // Intention prioritaire selon le contexte :
  //  • Mené en fin de match → renfort offensif.
  //  • En tête tard → renfort défensif.
  //  • Sinon → jambes fraîches pour un joueur épuisé.
  let intent='tired';
  if(gd<=-1 && mn>=60) intent='offensive';
  else if(gd>=1 && mn>=75) intent='defensive';

  let out=_mgrPickStarterOut(ti, intent);
  // Si l'intention contextuelle ne donne rien (ex. pas de défenseur à sortir),
  // on retombe sur « jambes fraîches » qui est toujours pertinent.
  if(!out && intent!=='tired') out=_mgrPickStarterOut(ti, 'tired');
  if(!out) return;

  const inn=_mgrBestBenchFor(ti, out.wantPos);
  if(!inn) return;

  // Ne pas dégrader trop fortement : si le remplaçant est nettement moins bon
  // que le titulaire ET qu'on n'a pas de raison tactique forte, on s'abstient
  // (un coach ne sacrifie pas un cadre en pleine forme pour un banc faible).
  const outP=teams[ti].players[out.pi];
  if(intent==='tired'){
    const fresh = (outP.hp!=null && outP.hp<40) || ((outP.s&&outP.s.stam||99)<=45);
    if(!fresh && _mgrOvr(inn.b) < _mgrOvr(outP)-8) return;
  }

  try{
    doSub(ti, out.pi, inn.bi, 'bench');
    if(!G._mgrSubAt) G._mgrSubAt=[-99,-99];
    if(!G._mgrSubCount) G._mgrSubCount=[0,0];
    G._mgrSubAt[ti]=mn;
    G._mgrSubCount[ti]++;
    const name=(teams[ti]&&teams[ti].name)||'L\'adversaire';
    const col=(teams[ti]&&teams[ti].color)||'#8090a0';
    const why = intent==='offensive' ? 'renfort offensif' : intent==='defensive' ? 'verrou défensif' : 'jambes fraîches';
    try{ logEvent('🔁 '+name+' — changement tactique ('+why+').', col); }catch(e){}
  }catch(e){ console.error('manager sub:', e); }
}

// Force moyenne d'une équipe (OVR des titulaires) pour caler le plan d'entame.
function _mgrTeamStrength(ti){
  const ps=(teams[ti]&&teams[ti].players)||[];
  if(!ps.length) return 50;
  let s=0,n=0;
  ps.forEach(p=>{ const v=_mgrOvr(p); if(v){ s+=v; n++; } });
  return n ? s/n : 50;
}

// Plan de match d'ENTRÉE (posé au coup d'envoi, score 0-0) : un coach n'attend
// pas d'être mené pour avoir une idée. Une équipe nettement plus faible que son
// adversaire humain resserre les rangs (défense/contre) ; une équipe plus forte
// met un pressing haut d'entrée ; sinon, jeu équilibré.
function _mgrKickoffPlan(ti){
  const mine=_mgrTeamStrength(ti);
  const opp =_mgrTeamStrength(1-ti);
  const diff=mine-opp;
  if(diff <= -8) return 'defend';   // largement dominé : bloc bas + contres
  if(diff <= -3) return null;       // un peu plus faible : équilibré prudent
  if(diff >=  8) return 'press';    // largement supérieur : on étouffe d'entrée
  return null;                      // équilibré
}
const _MGR_PLAN_LABEL = {
  defend:'aborde le match en bloc bas, prêt à contrer',
  press:'attaque le match avec un pressing haut',
  attack:'entre plein pot',
  null:'aligne un plan équilibré',
};

// Pose le plan d'entame une seule fois, au premier tick du match.
function _mgrApplyKickoffPlan(ti){
  if(!G._mgrPlanSet) G._mgrPlanSet=[false,false];
  if(G._mgrPlanSet[ti]) return;
  G._mgrPlanSet[ti]=true;
  const plan=_mgrKickoffPlan(ti);
  if(!G._mgrPlan) G._mgrPlan=[null,null];
  G._mgrPlan[ti]=plan;             // mémoriser l'intention d'entame pour la suite
  if(G.tacMode) G.tacMode[ti]=plan;
  // Mémoriser pour que _mgrApplyMentality ne re-loggue pas ce même état ensuite.
  if(!G._mgrLastMode) G._mgrLastMode=[undefined,undefined];
  G._mgrLastMode[ti]=plan;
  const name=(teams[ti]&&teams[ti].name)||'L\'adversaire';
  const col=(teams[ti]&&teams[ti].color)||'#8090a0';
  try{ logEvent('🤖 '+name+' est dirigé par le coach IA — il '+(_MGR_PLAN_LABEL[plan]||_MGR_PLAN_LABEL[null])+'.', col); }catch(e){}
  try{ if(typeof _tacTi!=='undefined' && _tacTi===ti && typeof updateTacBtnColors==='function') updateTacBtnColors(); }catch(e){}
}

// ── NIVEAU DE COACHING SELON LA DIFFICULTÉ ───────────────────────────────
// L'intelligence de banc dépend de la difficulté. En Facile, le coach IA est
// passif (mentalité basique, peu de changements). En Légendaire, il exploite
// TOUS les leviers : philosophie de jeu (direct/possession/contre), consignes
// individuelles, remplacements proactifs (fatigue/blessure), au meilleur moment.
//   tier 0 = easy, 1 = normal, 2 = hard, 3 = legend
function _mgrTier(){
  let id='normal';
  try{ if(typeof difficultyLevel==='function') id=difficultyLevel(); }catch(e){}
  return {easy:0, normal:1, hard:2, legend:3}[id] != null ? {easy:0,normal:1,hard:2,legend:3}[id] : 1;
}

// ── PHILOSOPHIE DE JEU (direct / possession / contre) ────────────────────
// Disponible à partir de « Difficile ». Le coach adapte le STYLE selon le
// contexte : mené tard → direct (jeu vertical), en tête → contre (bloc + trans-
// itions), possession pour endormir une large avance à égalité de niveau.
function _mgrDesiredStyle(ti){
  if(_mgrTier() < 2) return null;                 // seulement hard/legend
  const gd=_mgrGoalDiff(ti), mn=_mgrMinute();
  const late = mn>=68;
  if(gd<=-1 && late)  return 'direct';            // mené tard : on balance devant
  if(gd<=-2)          return 'direct';
  if(gd>=1 && late)   return 'counter';           // on tient : contres
  if(gd>=2)           return 'counter';
  if(gd===0 && mn>=75 && _mgrTier()>=3) return 'possession'; // legend : gère le nul
  return 'normal';
}
function _mgrApplyStyle(ti){
  const want=_mgrDesiredStyle(ti);
  if(want==null) return;
  if(!G.tacSliders || !G.tacSliders[ti]) return;
  const prev=G.tacSliders[ti].style;
  if(want===prev) return;
  G.tacSliders[ti].style = want;
  if(!G._mgrLastStyle) G._mgrLastStyle=[undefined,undefined];
  if(G._mgrLastStyle[ti]!==undefined && G._mgrLastStyle[ti]!==want){
    const lbl={direct:'joue plus direct',counter:'passe en contre-attaque',possession:'temporise en possession',normal:'revient à un jeu équilibré'}[want]||'';
    const name=(teams[ti]&&teams[ti].name)||'L\'adversaire';
    const col=(teams[ti]&&teams[ti].color)||'#8090a0';
    try{ logEvent('📋 '+name+' '+lbl+'.', col); }catch(e){}
  }
  G._mgrLastStyle[ti]=want;
}

// ── CONSIGNES INDIVIDUELLES (axe d'agressivité par joueur) ────────────────
// Disponible en « Légendaire ». Le coach pousse ses milieux/attaquants en mode
// offensif quand il est mené, et bascule ses joueurs en mode défensif quand il
// protège un résultat. Utilise G.playerRoles[ti] (déjà lu par le moteur).
function _mgrApplyIndividualInstructions(ti){
  if(_mgrTier() < 3) return;                      // legend uniquement
  if(!G.playerRoles) G.playerRoles=[[],[]];
  const roles=G.playerRoles[ti]||(G.playerRoles[ti]=[]);
  const gd=_mgrGoalDiff(ti), mn=_mgrMinute();
  const pushing = gd<=-1;                         // mené : on pousse
  const holding = gd>=1 && mn>=70;                // on protège tard
  const onPitch=(teams[ti]&&teams[ti].players)||[];
  let changed=false;
  onPitch.forEach(function(p, i){
    if(!p || p.pos==='GB') return;
    const cat=_posCat(p.pos);
    let want='normal';
    if(pushing){
      // Milieux et attaquants plus offensifs ; défenseurs restent stables.
      if(cat==='att'||cat==='mid') want='atk';
    } else if(holding){
      // On resserre : milieux et défenseurs plus prudents.
      if(cat==='def'||cat==='mid') want='def';
    }
    if(roles[i]!==want){ roles[i]=want; changed=true; }
  });
  if(changed){
    if(!G._mgrLastInstr) G._mgrLastInstr=[0,0];
    // Log très espacé pour ne pas spammer (au plus une fois par mi-temps).
    if(mn - (G._mgrLastInstr[ti]||-99) >= 20){
      G._mgrLastInstr[ti]=mn;
      const name=(teams[ti]&&teams[ti].name)||'L\'adversaire';
      const col=(teams[ti]&&teams[ti].color)||'#8090a0';
      const txt = (gd<=-1) ? 'ordonne à ses milieux de se projeter' : 'demande à son bloc de se resserrer';
      try{ logEvent('🗣️ '+name+' '+txt+'.', col); }catch(e){}
    }
  }
}

// Catégorie de poste simplifiée (att/mid/def/gk).
function _posCat(pos){
  if(['ATT','ATT2','BU','AV','MO','MOG','MOD','AG','AD'].indexOf(pos)>=0) return 'att';
  if(['MC','MDC','MOC','MG','MD','MIL','MCD','MCG'].indexOf(pos)>=0) return 'mid';
  if(['DC','DD','DG','DEF','LAT','LB','RB','DCD','DCG'].indexOf(pos)>=0) return 'def';
  return 'mid';
}

// ── POINT D'ENTRÉE (appelé ~1×/minute simulée depuis la boucle) ───────────
// Ne lève jamais : une erreur du coach IA ne doit pas casser le match.
function managerAiTick(){
  try{
    if(typeof G==='undefined' || !G.running) return;
    if(G.phase==='HALFTIME' || G.phase==='END' || G._celebrating) return;
    // Rien à faire tant qu'aucune équipe n'est pilotée par l'IA.
    const hum=_mgrHumanTeams();
    for(let ti=0; ti<2; ti++){
      if(hum[ti]) continue;            // équipe humaine : le coach IA n'y touche pas
      _mgrApplyKickoffPlan(ti);        // plan d'entame (une fois, au coup d'envoi)
      _mgrApplyMentality(ti);          // ajuste la mentalité au score/temps
      _mgrApplyStyle(ti);              // philosophie de jeu (hard+)
      _mgrApplyIndividualInstructions(ti); // consignes individuelles (legend)
      // Blessure grave : sortie d'urgence à toutes les difficultés.
      if(!_mgrEmergencyInjurySub(ti)) _mgrMaybeSub(ti); // sinon, changement normal
    }
  }catch(e){ console.error('managerAiTick:', e); }
}

// Réinitialise l'état du coach IA (à appeler au coup d'envoi d'un match).
function resetManagerAi(){
  try{
    if(typeof G==='undefined') return;
    G._mgrLastMode=[undefined,undefined];
    G._mgrSubAt=[-99,-99];
    G._mgrSubCount=[0,0];
    G._mgrPlanSet=[false,false];
    G._mgrPlan=[null,null];
    G._mgrLastStyle=[undefined,undefined];
    G._mgrLastInstr=[0,0];
  }catch(e){}
}

// Expose globalement (scripts classiques, non-module).
if(typeof window!=='undefined'){
  window.managerAiTick=managerAiTick;
  window.resetManagerAi=resetManagerAi;
  window._mgrHumanTeams=_mgrHumanTeams;
}
