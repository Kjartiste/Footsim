'use strict';
// ══════════════════════════════════════════════════════════════════════
//  TACTICS.JS — Couche IA tactique (réseau de passes pondéré, styles de
//  jeu, pressing intelligent, troisième homme, renversement)
//
//  Ce module est ADDITIF : il ne remplace ni data.js (bestPassTarget),
//  ni engine.js (roleTarget/pressing géométrique), ni ia.js (aiDecide).
//  Toutes les fonctions exposées ici ont un repli propre — si tactics.js
//  n'est pas chargé, le jeu se comporte exactement comme avant.
//
//  Portée couverte (voir brief tactique) :
//   1. Réseau de passes pondéré                → getBestPassOptions()
//   2. Formations 7v7 (3-2-1/2-3-1/3-2-2/1-3-3)
//      + 5v5/futsal (1-2-1/2-2/1-1-2/3-1/1-3)  → TACTICAL_SYSTEMS
//   3. Styles (possession/direct/pressing haut/
//      contre/tiki-taka)                       → STYLE_PROFILES
//   4. Pressing triggers                       → shouldPress()
//   5. Troisième homme                         → findThirdManOption()
//   6. Renversement                            → findSwitchOption()
// ══════════════════════════════════════════════════════════════════════

// ── GROUPES DE POSTES (génériques : valables 5v5 / 7v7 / 11v11) ───────
const ROLE_GROUP = {
  GB:'GK',
  DC:'DEF', DD:'DEF', DG:'DEF', DCD:'DEF', DCG:'DEF', LB:'DEF', RB:'DEF', FIXO:'DEF',
  MDC:'DM', MDC2:'DM',
  MC:'MID', MCD:'MID', MCG:'MID',
  MO:'AM', MOG:'AM', MOD:'AM',
  AG:'WIDE', AD:'WIDE', ALA_L:'WIDE', ALA_R:'WIDE',
  ATT:'FWD', ATT2:'FWD', PIVOT:'FWD',
};
function roleGroup(pos){ return ROLE_GROUP[pos] || 'MID'; }

// ── RÉSEAU DE PASSES GÉNÉRIQUE (poids de base par paire de groupes) ────
// Point de départ commun à tous les systèmes ; chaque formation applique
// ensuite ses propres multiplicateurs (netMul) pour styliser son identité
// (ex : 2-3-1 privilégie MID→WIDE→FWD, 1-3-3 privilégie DM→AM).
const BASE_PASS_NETWORK = {
  'GK-DEF':1.6, 'GK-DM':1.1, 'GK-MID':0.5,
  'DEF-DEF':1.2, 'DEF-DM':1.5, 'DEF-MID':1.1,
  'DM-DM':1.0, 'DM-MID':1.5, 'DM-AM':1.2, 'DM-DEF':1.3, 'DM-WIDE':0.9,
  'MID-MID':1.2, 'MID-AM':1.4, 'MID-WIDE':1.3, 'MID-FWD':1.2, 'MID-DM':1.1, 'MID-DEF':0.9,
  'AM-FWD':1.5, 'AM-WIDE':1.3, 'AM-AM':1.1, 'AM-MID':1.0,
  'WIDE-FWD':1.4, 'WIDE-AM':1.3, 'WIDE-WIDE':0.9, 'WIDE-MID':1.0,
  'FWD-FWD':1.2, 'FWD-AM':1.0, 'FWD-WIDE':1.0,
};
function baseNetworkWeight(gFrom,gTo){
  return BASE_PASS_NETWORK[gFrom+'-'+gTo] || BASE_PASS_NETWORK[gTo+'-'+gFrom] || 0.8;
}

// ── SYSTÈMES TACTIQUES PAR FORMATION ───────────────────────────────────
// Une "identité" par formation existante dans FootSim (7v7 dans STRATS,
// 5v5/futsal dans STRATS_5V5). netMul module BASE_PASS_NETWORK ;
// pressingRules/buildUpRules/transitionRules/riskProfile décrivent le
// comportement voulu (consommés par shouldPress()/tacticalPassDecision()
// et disponibles pour d'éventuels branchements futurs, ex. 11v11).
const TACTICAL_SYSTEMS = {
  // ── 7v7 ──────────────────────────────────────────────────────────
  '321':{
    name:'3-2-1', gameMode:'7v7',
    netMul:{ 'DEF-MID':1.05, 'MID-FWD':1.05, 'MID-MID':1.10 },
    pressingRules:{ style:'compact_block', joinBias:1.00 },
    buildUpRules:{ shortBuildPref:0.55, directPref:0.30 },
    transitionRules:{ counterPressSec:3 },
    riskProfile:{ passRisk:0.45, width:1.00 },
  },
  '231':{
    name:'2-3-1 Offensif', gameMode:'7v7',
    netMul:{ 'MID-WIDE':1.25, 'WIDE-FWD':1.30, 'DEF-MID':1.15 },
    pressingRules:{ style:'wide_press', joinBias:1.15 },
    buildUpRules:{ shortBuildPref:0.65, directPref:0.20 },
    transitionRules:{ counterPressSec:4 },
    riskProfile:{ passRisk:0.55, width:1.15 },
  },
  '222':{
    name:'3-2-2 Direct', gameMode:'7v7',
    netMul:{ 'MID-FWD':1.35, 'FWD-FWD':1.30, 'DEF-MID':0.95 },
    pressingRules:{ style:'high_intense', joinBias:1.25 },
    buildUpRules:{ shortBuildPref:0.30, directPref:0.55 },
    transitionRules:{ counterPressSec:5 },
    riskProfile:{ passRisk:0.65, width:0.85 },
  },
  '133':{
    name:'1-3-3 Milieu', gameMode:'7v7',
    netMul:{ 'DM-AM':1.35, 'DM-MID':1.20, 'MID-DEF':1.10 },
    pressingRules:{ style:'low_block', joinBias:0.55 },
    buildUpRules:{ shortBuildPref:0.70, directPref:0.10 },
    transitionRules:{ counterPressSec:2 },
    riskProfile:{ passRisk:0.30, width:0.80 },
  },
  // ── 5v5 / futsal ─────────────────────────────────────────────────
  '121':{ name:'1-2-1', gameMode:'5v5', netMul:{'MID-FWD':1.15,'MID-MID':1.15}, pressingRules:{style:'compact_block',joinBias:1.00}, buildUpRules:{shortBuildPref:0.60,directPref:0.20}, transitionRules:{counterPressSec:3}, riskProfile:{passRisk:0.45,width:1.00} },
  '22': { name:'2-2',   gameMode:'5v5', netMul:{'DEF-FWD':1.20,'DEF-DEF':1.10}, pressingRules:{style:'square_block',joinBias:1.00}, buildUpRules:{shortBuildPref:0.55,directPref:0.25}, transitionRules:{counterPressSec:3}, riskProfile:{passRisk:0.40,width:1.00} },
  '112':{ name:'1-1-2', gameMode:'5v5', netMul:{'MID-FWD':1.30,'FWD-FWD':1.30}, pressingRules:{style:'high_intense',joinBias:1.30}, buildUpRules:{shortBuildPref:0.25,directPref:0.55}, transitionRules:{counterPressSec:5}, riskProfile:{passRisk:0.60,width:1.10} },
  '31': { name:'3-1',   gameMode:'5v5', netMul:{'DEF-FWD':1.25,'DEF-DEF':1.15}, pressingRules:{style:'low_block',joinBias:0.50}, buildUpRules:{shortBuildPref:0.70,directPref:0.10}, transitionRules:{counterPressSec:2}, riskProfile:{passRisk:0.30,width:0.85} },
  '13': { name:'1-3',   gameMode:'5v5', netMul:{'MID-FWD':1.35,'FWD-FWD':1.35,'WIDE-FWD':1.30}, pressingRules:{style:'high_intense',joinBias:1.40}, buildUpRules:{shortBuildPref:0.20,directPref:0.60}, transitionRules:{counterPressSec:5}, riskProfile:{passRisk:0.65,width:1.20} },
};

function currentFormId(ti){
  const T=(typeof teams!=='undefined')?teams[ti]:null;
  if(!T) return '321';
  if(window.gameMode==='5v5') return T.strat5||'121';
  if(window.gameMode==='11v11') return T.strat11||'442'; // pas encore de TACTICAL_SYSTEMS dédié → repli 321
  return T.strat||'321';
}
function tacticalSystem(ti){
  return TACTICAL_SYSTEMS[currentFormId(ti)] || TACTICAL_SYSTEMS['321'];
}
function networkWeight(fromPos,toPos,ti){
  const gF=roleGroup(fromPos), gT=roleGroup(toPos);
  const base=baseNetworkWeight(gF,gT);
  const sys=tacticalSystem(ti);
  const mul=(sys.netMul && (sys.netMul[gF+'-'+gT]||sys.netMul[gT+'-'+gF])) || 1;
  return base*mul;
}

// ── STYLES DE JEU (§13 du brief) ────────────────────────────────────────
// S'appuie sur le style déjà choisi via les curseurs d'équipe
// (strat().style : 'normal'|'direct'|'possession'|'counter', voir data.js)
// et ajoute 'tikitaka' et 'pressing_high' comme profils de pondération de
// passes. 'chaos_magic' reste piloté par le système de sorts existant
// (fréquence/probabilité déjà gérées dans ia.js) : on ne le duplique pas ici.
const STYLE_PROFILES = {
  normal:       { safeBack:1.00, lateral:1.00, vertical:1.00, throughBall:1.00, switch:1.00, wallPass:1.00, pressing:1.00 },
  possession:   { safeBack:1.35, lateral:1.25, vertical:0.75, throughBall:0.75, switch:1.15, wallPass:1.10, pressing:0.90 },
  direct:       { safeBack:0.65, lateral:0.75, vertical:1.45, throughBall:1.45, switch:0.85, wallPass:0.75, pressing:1.00 },
  counter:      { safeBack:0.55, lateral:0.65, vertical:1.30, throughBall:1.60, switch:0.90, wallPass:0.80, pressing:0.60 },
  tikitaka:     { safeBack:1.20, lateral:1.15, vertical:0.85, throughBall:0.90, switch:1.05, wallPass:1.50, pressing:1.05 },
  pressing_high:{ safeBack:0.85, lateral:0.90, vertical:1.10, throughBall:1.15, switch:0.95, wallPass:1.00, pressing:1.60 },
};
function styleProfile(ti){
  const s=(typeof strat==='function')?strat(ti):null;
  const key=(s&&s.style)||'normal';
  return STYLE_PROFILES[key]||STYLE_PROFILES.normal;
}

// ── RÉSEAU DE PASSES PONDÉRÉ (§15) ──────────────────────────────────────
// Renvoie la liste des coéquipiers triés du meilleur au moins bon choix.
// score = démarquage + priorité tactique (réseau) + progression*style
//         + qualité du récepteur - lignes bloquées - distance - pression
function getBestPassOptions(carrier, ati, opts){
  opts=opts||{};
  const maxDist=opts.maxDist||(WW*0.60);
  const goalX=ati===0?WW:0;
  const mates=actP(ati).filter(p=>p&&p!==carrier&&!p.hasBall&&p.pos!=='GB');
  if(!mates.length) return [];
  const opps=actP(1-ati);
  const style=styleProfile(ati);

  let pressureOnPasser=0;
  for(const o of opps){
    const d=Math.hypot(o.x-carrier.x,o.y-carrier.y);
    if(d<6) pressureOnPasser=Math.max(pressureOnPasser,(6-d)/6);
  }

  const out=[];
  for(const m of mates){
    const dx=m.x-carrier.x, dy=m.y-carrier.y, dist=Math.hypot(dx,dy)||1;
    if(dist>maxDist || dist<3) continue;
    const prog = ati===0 ? (m.x-carrier.x) : (carrier.x-m.x);
    let nearOpp=1e9;
    for(const o of opps){ const dd=Math.hypot(o.x-m.x,o.y-m.y); if(dd<nearOpp)nearOpp=dd; }
    let blocked=0;
    for(const o of opps){
      const t=((o.x-carrier.x)*dx+(o.y-carrier.y)*dy)/(dist*dist);
      if(t>0.1&&t<0.95){
        const px=carrier.x+dx*t, py=carrier.y+dy*t;
        if(Math.hypot(o.x-px,o.y-py)<2.2) blocked++;
      }
    }
    const tacticalPriority = networkWeight(carrier.pos, m.pos, ati);
    const receiverQuality = ((m.s?.tec||50)+(m.s?.spd||50)*0.4)/1.4;
    const isThrough = prog>WW*0.14;
    const isLateral = Math.abs(prog)<=WW*0.05;
    const isSafeBack = prog<-WW*0.02;
    const typeMul = isThrough?style.throughBall : isLateral?style.lateral : isSafeBack?style.safeBack : style.vertical;
    const score = nearOpp*1.30
                + tacticalPriority*9
                + prog*0.55*typeMul
                + receiverQuality*0.12
                - blocked*24
                - dist*0.30
                - pressureOnPasser*4;
    const type = isThrough?'through_ball' : isLateral?'lateral' : isSafeBack?'safe_back' : 'vertical';
    const finalScore = score + (Math.abs(m.x-goalX)<WW*0.28 ? 10 : 0);
    out.push({player:m, score:finalScore, dist, prog, blocked, type});
  }
  out.sort((a,b)=>b.score-a.score);
  return out;
}
function bestPassOption(carrier, ati, opts){
  const list=getBestPassOptions(carrier,ati,opts);
  return list.length?list[0].player:null;
}
// Choisit un coéquipier dans un SOUS-ENSEMBLE donné (pool) en s'appuyant sur
// le score pondéré ci-dessus — utile pour remplacer un pick() aléatoire par
// un choix tactique tout en gardant les mêmes contraintes de poste appelantes.
// Garde un peu de variété : 70% le meilleur choix du pool, 30% un tirage
// parmi le top 3, pour ne pas rendre le jeu parfaitement déterministe.
function pickTactical(carrier, ati, pool){
  if(!pool||!pool.length) return null;
  const scored=getBestPassOptions(carrier,ati,{maxDist:WW}).filter(o=>pool.includes(o.player));
  if(!scored.length) return pool[~~(Math.random()*pool.length)];
  if(Math.random()<0.70) return scored[0].player;
  const top=scored.slice(0,3).map(o=>o.player);
  return top[~~(Math.random()*top.length)];
}

// ── TROISIÈME HOMME (§16) ───────────────────────────────────────────────
// A a le ballon ; B est proche mais serré marqué (mais technique correcte
// pour jouer en une touche) ; C est libre, avancé. Retourne {via:B, target:C}
// pour suggérer la combinaison A→B→C, ou null si le pattern n'est pas réuni.
function findThirdManOption(carrier, ati){
  const mates=actP(ati).filter(p=>p&&p!==carrier&&!p.hasBall&&p.pos!=='GB');
  if(mates.length<2) return null;
  const opps=actP(1-ati);
  const nearestOppTo=(pl)=>{ let n=1e9; for(const o of opps){ const d=Math.hypot(o.x-pl.x,o.y-pl.y); if(d<n)n=d; } return n; };
  let best=null, bestScore=-1e9;
  for(const b of mates){
    const distCB=Math.hypot(b.x-carrier.x,b.y-carrier.y);
    if(distCB>16) continue;                    // B doit être proche du porteur
    if(nearestOppTo(b)>=4.5) continue;          // B doit être serré marqué
    const bTech=(b.s2?.decision!=null ? (b.s2.decision+(b.s?.tec||50))/2 : (b.s?.tec||50));
    if(bTech<50) continue;                      // B a besoin de technique/décision pour jouer en 1 touche
    for(const c of mates){
      if(c===b) continue;
      const progC = ati===0 ? (c.x-carrier.x) : (carrier.x-c.x);
      if(progC<WW*0.10) continue;               // C doit être avancé par rapport au porteur
      const cFree=nearestOppTo(c);
      if(cFree<=8) continue;                    // C doit être libre
      const score = progC*0.8 + (10-nearestOppTo(b))*0.4 + cFree*0.6;
      if(score>bestScore){ bestScore=score; best={via:b, target:c, score}; }
    }
  }
  return best;
}

// ── RENVERSEMENT (§17) ──────────────────────────────────────────────────
// Si le côté du ballon est surchargé par l'adversaire, cherche un coéquipier
// libre côté opposé, atteignable par une passe longue.
function findSwitchOption(carrier, ati){
  const opps=actP(1-ati);
  const ballSide = carrier.y < PCY ? 'top' : 'bottom';
  const sideDensity = opps.filter(o=> ballSide==='top' ? o.y<PCY : o.y>=PCY).length;
  if(sideDensity<3) return null;                // pas de vraie surcharge
  const mates=actP(ati).filter(p=>p&&p!==carrier&&!p.hasBall&&p.pos!=='GB');
  const oppositeMates = mates.filter(m=> ballSide==='top' ? m.y>=PCY : m.y<PCY);
  if(!oppositeMates.length) return null;
  const canLong = (carrier.s?.tec||50) >= 45;    // aptitude minimale à la passe longue
  if(!canLong) return null;
  let best=null, bestScore=-1e9;
  for(const m of oppositeMates){
    const dist=Math.hypot(m.x-carrier.x,m.y-carrier.y);
    if(dist>WW*0.75) continue;
    let nearOppM=0;
    for(const o of opps){ if(Math.hypot(o.x-m.x,o.y-m.y)<7) nearOppM++; }
    const score = -nearOppM*6 - dist*0.15 + Math.abs(m.y-carrier.y)*0.30;
    if(score>bestScore){ bestScore=score; best=m; }
  }
  return best;
}

// ── PRESSING — LOGIQUE GÉNÉRALE (§14) ───────────────────────────────────
// Le pressing géométrique continu (roleTarget dans engine.js) gère déjà le
// placement défensif image par image. shouldPress() sert à affiner des
// DÉCISIONS PONCTUELLES (ex : un défenseur tente-t-il un tacle appuyé
// maintenant ?) en tenant compte des triggers du brief tactique : mauvaise
// touche/dos au jeu, ballon près de la ligne, technique adverse faible,
// endurance/agressivité du défenseur et intensité de pressing de l'équipe.
function pressTriggerValue(carrier, carrierTi){
  if(!carrier) return 0;
  let v=0.15; // base : il y a toujours une petite chance de presser
  const ownGoalX = carrierTi===0 ? 0 : WW;
  if(Math.abs(carrier.x-ownGoalX) < WW*0.30) v+=0.15;      // proche de son propre but = presser paie plus
  if(carrier.y<WH*0.14 || carrier.y>WH*0.86) v+=0.15;       // ballon près de la ligne de touche
  if((carrier.s?.tec||50)<45) v+=0.20;                      // technique adverse faible
  if(carrier.stunT>0) v+=0.25;                              // porteur déstabilisé (~mauvaise touche)
  return Math.min(1, v);
}
function shouldPress(player, carrier, myTi, oppTi){
  if(!player||!carrier) return {press:false, score:0};
  const trig=pressTriggerValue(carrier, oppTi);
  const myStrat=(typeof strat==='function')?(strat(myTi)||{press:.5}):{press:.5};
  const workRate=((player.s?.stam||50)/99);
  const aggression=(typeof hasTrait==='function' && hasTrait(player,'presseur')) ? 1.25 : 1.0;
  const teamIntensity=myStrat.press||0.5;
  const fatiguePenalty=(1-(player.hp!=null?player.hp:100)/100)*0.4;
  const dist=Math.hypot(player.x-carrier.x,player.y-carrier.y);
  const distancePenalty=Math.min(0.6, dist*0.03);
  const score = trig*(0.5+workRate*0.6)*(0.6+teamIntensity*0.8)*aggression - fatiguePenalty - distancePenalty;
  const threshold=0.22;
  return {press: score>threshold, score};
}

// ── DÉCISION DE PASSE DE HAUT NIVEAU ────────────────────────────────────
// Combine troisième homme > renversement > meilleure option pondérée, dans
// cet ordre de priorité (comme demandé au §16/§17 du brief). Utilisé par
// ia.js dans la branche de passe dominante d'ATTACK ; conserve un repli sur
// bestPassTarget (data.js) si jamais rien n'est trouvé ici.
function tacticalPassDecision(carrier, ati){
  if(!carrier) return null;
  // Style possession/tikitaka combine davantage ; direct/counter moins.
  const _style=(typeof strat==='function' && strat(ati) && strat(ati).style)||'normal';
  const _comboBias = ({possession:1.15,tikitaka:1.2,direct:0.8,counter:0.85}[_style])||1;
  // Usage relevé (troisième homme / renversement) : ~0.72 / ~0.78 de base au
  // lieu de 0.5 / 0.6 — quand le pattern est trouvé, on l'exploite bien plus
  // souvent, ce qui donne des séquences combinées reconnaissables.
  const tm=findThirdManOption(carrier,ati);
  if(tm && Math.random()<Math.min(0.9,0.72*_comboBias)) return {target:tm.via, kind:'third_man_setup', follow:tm.target};
  const sw=findSwitchOption(carrier,ati);
  if(sw && Math.random()<Math.min(0.92,0.78*_comboBias)) return {target:sw, kind:'switch'};
  const best=bestPassOption(carrier,ati,{forward:true});
  if(best) return {target:best, kind:'best'};
  return null;
}

// ── Exposition sur window (cohérent avec le reste du code base) ────────
Object.assign(window, {
  ROLE_GROUP, roleGroup, BASE_PASS_NETWORK, baseNetworkWeight,
  TACTICAL_SYSTEMS, currentFormId, tacticalSystem, networkWeight,
  STYLE_PROFILES, styleProfile,
  getBestPassOptions, bestPassOption, pickTactical,
  findThirdManOption, findSwitchOption,
  pressTriggerValue, shouldPress,
  tacticalPassDecision,
});
