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

  // Mené : on pousse. Plus on est mené et tard, plus on est agressif.
  if(gd<=-2 && late) return 'attack';
  if(gd<=-1){
    if(veryLate) return 'attack';
    if(late)     return 'attack';
    return 'press';           // mené tôt : on presse pour récupérer vite
  }
  // À égalité : équilibré, avec un pressing léger en fin de match pour tenter
  // d'arracher la victoire.
  if(gd===0){
    if(veryLate) return 'press';
    return null;              // neutre
  }
  // En tête : on gère. Plus l'avance est courte et le temps avancé, plus on
  // ferme le jeu.
  if(gd===1){
    if(veryLate) return 'defend';
    if(late)     return 'defend';
    return null;              // avance d'un but tôt : on reste normal
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
  if(mn<55) return false;                 // pas de changement tactique avant l'heure de jeu
  if(!G._mgrSubAt) G._mgrSubAt=[-99,-99];
  if(mn - G._mgrSubAt[ti] < 12) return false; // espacer les changements
  if(!G._mgrSubCount) G._mgrSubCount=[0,0];
  const maxSubs = window.gameMode==='11v11' ? 3 : 3; // borne raisonnable
  if(G._mgrSubCount[ti] >= maxSubs) return false;
  return true;
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
      _mgrApplyMentality(ti);          // ajuste la mentalité au score/temps
      _mgrMaybeSub(ti);                // éventuel changement tactique
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
  }catch(e){}
}

// Expose globalement (scripts classiques, non-module).
if(typeof window!=='undefined'){
  window.managerAiTick=managerAiTick;
  window.resetManagerAi=resetManagerAi;
  window._mgrHumanTeams=_mgrHumanTeams;
}
