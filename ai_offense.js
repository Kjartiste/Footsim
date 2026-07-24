// ═══════════════════════════════════════════════════════════════════════
// AI_OFFENSE.JS — Moteur de décision offensive probabiliste par utilité
// ═══════════════════════════════════════════════════════════════════════
// Remplace le choix par seuils cumulés (r<a, r<a+b…) du porteur par un vrai
// modèle utilité → softmax tempéré → échantillonnage, avec bruit contrôlé.
// Aucune règle "si X alors Y" dure : chaque action reçoit un score d'utilité
// dérivé des métriques offensives (proxies xG, xT, xA, entrées de surface,
// densité, pied fort…), converti en probabilité. À situation identique, le
// bruit gaussien produit une variation de ±5-10% sans jamais casser la somme
// à 100% (le softmax renormalise).
//
// Le moteur NE remplace PAS l'exécution (doShot, _attemptDribble, passes) :
// il choisit seulement QUELLE action tenter. L'IA existante exécute ensuite.
//
// Exposé : window.offensiveDecision(carrier, ati, dti, ctx) → { action, probs }
//   action ∈ 'shoot' | 'pass' | 'dribble' | 'cross' | 'through' | 'switch' | 'carry'
// ═══════════════════════════════════════════════════════════════════════

(function(){
'use strict';

function _clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function _stat(p,k){ try{ if(typeof statOf==='function') return statOf(p,k); }catch(e){} return (p&&p.s&&p.s[k]!=null)?p.s[k]:50; }

// ── PROXY xG ────────────────────────────────────────────────────────────
// Probabilité de marquer depuis la position du porteur. Calibré sur la forme
// connue de l'xG : décroît vite avec la distance, chute avec l'angle fermé et
// le nombre de défenseurs dans l'axe. Renvoie [0,1].
function _xg(carrier, oppGoalX, PCY, dp){
  const dx=Math.abs(oppGoalX-carrier.x);
  const dy=Math.abs(PCY-carrier.y);
  const dist=Math.hypot(dx,dy);
  // Base distance : ~0.45 à bout portant, ~0.03 à 25m (courbe exponentielle).
  let xg=0.55*Math.exp(-dist/9);
  // Angle : plus on est excentré, plus l'angle de tir est fermé.
  const angle=Math.atan2(dy, Math.max(1,dx));
  xg *= Math.cos(Math.min(angle, Math.PI/2*0.95));
  // Défenseurs dans le couloir de tir → réduisent l'xG.
  let blockers=0;
  const gx=oppGoalX, gy=PCY, dgx=gx-carrier.x, dgy=gy-carrier.y, dg=Math.hypot(dgx,dgy)||1;
  for(const o of (dp||[])){
    const t=((o.x-carrier.x)*dgx+(o.y-carrier.y)*dgy)/(dg*dg);
    if(t>0.05&&t<1){
      const px=carrier.x+dgx*t, py=carrier.y+dgy*t;
      if(Math.hypot(o.x-px,o.y-py)<3.5) blockers++;
    }
  }
  xg *= Math.pow(0.62, blockers); // chaque défenseur dans l'axe divise l'xG
  // Finition du tireur (léger) : un bon finisseur convertit un poil mieux.
  const fin=_stat(carrier,'sht');
  xg *= (0.8 + 0.4*(fin/99));
  return _clamp(xg, 0, 0.95);
}

// ── PROXY xT (menace attendue de la position) ───────────────────────────
// Grille implicite : la valeur monte vers le but adverse et culmine dans les
// demi-espaces et l'entrée de surface. Renvoie [0,1].
function _xt(x, y, ati, WW, WH, PCY){
  // Progression vers le but adverse (0 dans son camp → 1 au but adverse).
  const prog = ati===0 ? (x/WW) : (1 - x/WW);
  // Demi-espaces : deux bandes intérieures (~y à 30% et 70% de la largeur).
  const yn = y/WH;
  const halfSpace = Math.exp(-Math.pow((yn-0.30)/0.12,2)) + Math.exp(-Math.pow((yn-0.70)/0.12,2));
  const central = Math.exp(-Math.pow((yn-0.5)/0.18,2));
  const laneBonus = 0.6*central + 0.5*Math.min(1,halfSpace);
  // xT croît fortement dans le dernier tiers (courbe convexe).
  let xt = Math.pow(prog, 2.2) * (0.6 + 0.4*laneBonus);
  return _clamp(xt, 0, 1);
}

// ── OPTIONS DE PASSE + PROXY xA ─────────────────────────────────────────
// Récupère les meilleures cibles de passe et estime la meilleure valeur
// attendue d'assist (xA ≈ xG du receveur × probabilité de complétion), plus
// la meilleure progression d'xT disponible par une passe.
function _passLandscape(carrier, ati, dti, ctx){
  const {WW,WH,PCY,oppGoalX,dp}=ctx;
  let opts=[];
  try{
    if(typeof getBestPassOptions==='function'){
      opts=getBestPassOptions(carrier,ati,{maxDist:WW*0.6})||[];
    }
  }catch(e){ opts=[]; }
  // Repli : coéquipiers de champ démarqués.
  if(!opts.length){
    const ap=(typeof actP==='function')?actP(ati):[];
    opts=ap.filter(p=>p!==carrier && p.pos!=='GB' && !p.hasBall)
           .map(p=>({player:p,x:p.x,y:p.y}));
  }
  let bestXA=0, bestXTgain=0, boxEntry=0, throughVal=0, crossVal=0, switchVal=0, nOptions=0;
  const carrierXT=_xt(carrier.x,carrier.y,ati,WW,WH,PCY);
  const inBox=(x)=> ati===0 ? x>WW-(ctx.PA_W||WW*0.16) : x<(ctx.PA_W||WW*0.16);
  for(const o of opts){
    const tp=o.player||o;
    if(!tp || tp.x==null) continue;
    nOptions++;
    // proxy de complétion : distance + densité adverse autour de la cible.
    const d=Math.hypot(tp.x-carrier.x,tp.y-carrier.y);
    let pComp=_clamp(1 - d/(WW*0.75), 0.1, 0.97);
    // densité adverse locale autour du receveur
    let near=0; for(const o2 of (dp||[])){ if(Math.hypot(o2.x-tp.x,o2.y-tp.y)<4) near++; }
    pComp *= Math.pow(0.8, near);
    // xA : valeur si le receveur reçoit dans une position de frappe.
    const recXg=_xg(tp, oppGoalX, PCY, dp);
    bestXA=Math.max(bestXA, recXg*pComp);
    // gain d'xT de la passe.
    const gain=_xt(tp.x,tp.y,ati,WW,WH,PCY)-carrierXT;
    bestXTgain=Math.max(bestXTgain, gain*pComp);
    // entrée de surface.
    if(inBox(tp.x) && !inBox(carrier.x)) boxEntry=Math.max(boxEntry, pComp);
    // passe en profondeur (through ball) : cible plus avancée, dans l'axe.
    const forward = ati===0 ? (tp.x-carrier.x) : (carrier.x-tp.x);
    if(forward>WW*0.12) throughVal=Math.max(throughVal, (recXg*0.7+gain*0.3)*pComp);
    // renversement : cible sur le couloir opposé, loin latéralement.
    if(Math.abs(tp.y-carrier.y)>WH*0.4) switchVal=Math.max(switchVal, gain*pComp+0.1);
    // centre : cible dans la surface depuis un couloir large.
    const wide = carrier.y<WH*0.25 || carrier.y>WH*0.75;
    if(wide && inBox(tp.x)) crossVal=Math.max(crossVal, recXg*pComp);
  }
  return {bestXA,bestXTgain,boxEntry,throughVal,crossVal,switchVal,nOptions,carrierXT};
}

// ── DENSITÉ ADVERSE LOCALE autour du porteur ────────────────────────────
function _pressure(carrier, dp){
  let nearest=1e9, count=0;
  for(const o of (dp||[])){
    const d=Math.hypot(o.x-carrier.x,o.y-carrier.y);
    if(d<8) count++;
    if(d<nearest) nearest=d;
  }
  // 0 (aucune pression) → 1 (étouffé). Combine le plus proche et la densité.
  const byDist=_clamp(1 - nearest/8, 0, 1);
  const byCount=_clamp(count/3, 0, 1);
  return _clamp(0.6*byDist+0.4*byCount, 0, 1);
}

// ── SOFTMAX TEMPÉRÉ + BRUIT CONTRÔLÉ ────────────────────────────────────
function _gaussNoise(sigma){
  // Box-Muller
  let u=0,v=0; while(u===0)u=Math.random(); while(v===0)v=Math.random();
  return sigma*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}
function _softmax(utils, tau){
  const keys=Object.keys(utils);
  // stabilité numérique : soustraire le max
  let mx=-Infinity; for(const k of keys) mx=Math.max(mx, utils[k]);
  let sum=0; const exp={};
  for(const k of keys){ const e=Math.exp((utils[k]-mx)/tau); exp[k]=e; sum+=e; }
  const probs={}; for(const k of keys) probs[k]=exp[k]/(sum||1);
  return probs;
}
function _sample(probs){
  const r=Math.random(); let acc=0;
  for(const k of Object.keys(probs)){ acc+=probs[k]; if(r<acc) return k; }
  return Object.keys(probs)[Object.keys(probs).length-1];
}

// ── FONCTION PRINCIPALE ─────────────────────────────────────────────────
// ctx doit fournir : WW, WH, PCY, PCX, oppGoalX, dp (défenseurs), PA_W,
// style, canShoot, posTend {shoot,drib,pass}, styleTend {shoot,drib,pass},
// Δscore, tRem (min restantes), fatigue [0,1].
function offensiveDecision(carrier, ati, dti, ctx){
  const {WW,WH,PCY,oppGoalX,dp,style,canShoot,posTend,styleTend}=ctx;

  const xg   = _xg(carrier, oppGoalX, PCY, dp);
  const xt   = _xt(carrier.x, carrier.y, ati, WW, WH, PCY);
  const land = _passLandscape(carrier, ati, dti, ctx);
  const press= _pressure(carrier, dp);

  // Qualité du dernier contrôle (si suivie), sinon technique du joueur.
  const control = (carrier._lastControl!=null) ? carrier._lastControl : (_stat(carrier,'tec')/99);
  // Pied fort : un centre/tir du bon côté vaut plus. carrier.foot ∈ 'L'|'R'|'both'
  const onStrongSide=(()=>{
    // Pied fort : les remplaçants/réserves n'ont pas toujours le champ foot —
    // on le dérive alors à la volée (stable via l'id) pour rester cohérent.
    let f=carrier.foot;
    if(f==null){
      const h=(String(carrier.id||'').split('').reduce((a,c)=>a+c.charCodeAt(0),0))%100;
      f = h<3?'both': h<22?'L':'R';
      carrier.foot=f; // mémorisé
    }
    if(f==='both') return 1;
    const leftSide=carrier.y<WH*0.5;
    return (leftSide && f==='R')||(!leftSide && f==='L') ? 1.1 : 0.9;
  })();

  const dribSkill=(_stat(carrier,'tec')*0.6+_stat(carrier,'spd')*0.4)/99;

  // ── UTILITÉS (échelle ~[0,3]) ─────────────────────────────────────────
  // Chaque utilité combine sa métrique de valeur, la faisabilité, et les
  // biais de poste/style. Les priors de tendance (posTend/styleTend) entrent
  // en LOG pour agir comme des multiplicateurs doux dans le softmax.
  const bias=(m)=>Math.log(Math.max(0.05,m));

  const U={};
  // TIR : valeur = xG ; n'existe que si canShoot. Sur une GROSSE occasion
  // (xG élevé), l'utilité de tir domine nettement — un attaquant seul face au
  // but tire, il ne dribble pas. La courbe est convexe pour récompenser les
  // vraies occasions et décourager les tirs à faible xG.
  U.shoot = canShoot ? (4.2*xg + 1.4*Math.pow(xg,0.5) + bias(posTend.shoot*styleTend.shoot)) : -50;
  // PASSE (sûre / construction) : valeur = gain d'xT + conservation.
  U.pass = 1.4*Math.max(0,land.bestXTgain) + 0.5*(1-press) + 0.4 + bias(posTend.pass*styleTend.pass);
  // PASSE DANS LA SURFACE / DERNIÈRE PASSE : valeur = xA.
  U.through = land.throughVal>0 ? (2.2*land.throughVal + 0.2*land.boxEntry + bias(posTend.pass)) : -50;
  // CENTRE : valeur = xA depuis un couloir large, bonus pied fort. Favorisé
  // pour un joueur large (ailier/latéral) proche de la ligne de fond.
  U.cross = land.crossVal>0 ? (2.3*land.crossVal*onStrongSide + bias(styleTend.shoot*0.9+0.3)) : -50;
  // RENVERSEMENT : exploiter le côté faible ; utile si le jeu est bloqué d'un côté.
  U.switch = land.switchVal>0 ? (1.3*land.switchVal + 0.3*press + bias(posTend.pass*0.9)) : -50;
  // DRIBBLE : valeur = compétence × espace gagné potentiel. Un dribbleur en
  // position offensive (fort posTend.drib) tente plus ; pénalisé si aucun
  // adversaire à éliminer (rien à dribbler → autant conduire).
  U.dribble = 2.0*dribSkill*(0.35+0.65*press) + 0.9*xt + bias(posTend.drib*styleTend.drib) - 0.3;
  // CONDUITE (porter le ballon dans l'espace libre) : progresser sans
  // adversaire proche. Volontairement modérée pour ne pas éclipser dribble et
  // passe — porter le ballon n'est utile que s'il y a de l'espace ET peu
  // d'options de passe supérieures.
  U.carry = 0.9*(1-press)*(0.4+0.6*xt) + bias(posTend.drib*0.5+0.4);

  // ── MODULATION CONTEXTUELLE ───────────────────────────────────────────
  // Score / temps : une équipe menée en fin de match prend plus de risque
  // (tir, passe dans la surface, projection) ; une équipe qui mène conserve.
  const dScore=ctx.Δscore||0, tRem=ctx.tRem!=null?ctx.tRem:45;
  const urgency=_clamp((-dScore)*(1 - tRem/90), -1, 1); // >0 : mené + fin de match
  U.shoot   += 0.8*Math.max(0,urgency);
  U.through += 0.6*Math.max(0,urgency);
  U.pass    += 0.5*Math.max(0,-urgency); // en tête + fin → conserver
  U.switch  += 0.3*Math.max(0,-urgency);

  // Nombre de partenaires disponibles : peu d'options → moins de passes,
  // plus de conduite/dribble (on se débrouille seul).
  if(land.nOptions<=1){ U.pass-=0.6; U.through-=0.6; U.switch-=0.6; U.dribble+=0.3; U.carry+=0.3; }

  // Qualité du dernier contrôle : un mauvais contrôle (sous pression) rend le
  // dribble et le tir plus hasardeux → on sécurise.
  if(control<0.5){ U.dribble-=0.5*(0.5-control)*2; U.shoot-=0.4*(0.5-control)*2; U.pass+=0.3; }

  // ── TEMPÉRATURE DYNAMIQUE ─────────────────────────────────────────────
  // τ monte avec la pression et la fatigue (décisions plus dispersées, plus
  // d'erreurs), baisse avec la technique (joueur d'élite = choix plus nets).
  const fatigue=ctx.fatigue!=null?ctx.fatigue:_clamp(1-(carrier.hp||100)/100,0,1);
  const skillNorm=_stat(carrier,'tec')/99;
  const tau=_clamp(0.30*(1 + 0.5*press + 0.4*fatigue - 0.3*skillNorm), 0.12, 0.6);

  // ── BRUIT CONTRÔLÉ avant softmax ──────────────────────────────────────
  for(const k of Object.keys(U)){
    if(U[k]<=-40) continue; // action indisponible : on ne la bruite pas
    U[k]+=_gaussNoise(0.06*Math.max(0.5,Math.abs(U[k])));
  }

  const probs=_softmax(U, tau);
  const action=_sample(probs);
  return {action, probs, meta:{xg,xt,press,tau,land}};
}

window.offensiveDecision = offensiveDecision;
// Exposés pour tests / réutilisation éventuelle.
window._offXG = _xg;
window._offXT = _xt;

// ═══════════════════════════════════════════════════════════════════════
// MODULE DÉFENSIF — sélection probabiliste presser / marquer / couvrir
// ═══════════════════════════════════════════════════════════════════════
// Décide, pour un défenseur donné, un MÉLANGE de comportements (presser,
// couvrir, tenir la ligne, fermer une ligne de passe) via utilité → softmax.
// Ne remplace pas le positionnement fin de roleTarget : il fournit une
// INTENTION (poids) que roleTarget peut lire pour moduler l'agressivité.
//
// window.defensiveIntent(defender, dti, ctx) → { intent, probs }
//   intent ∈ 'press' | 'cover' | 'hold' | 'shadow' (fermer une ligne)

function defensiveIntent(defender, dti, ctx){
  const {WW,WH,PCY,ball,dp,ap,press,alreadyPressing,ballInDanger}=ctx;
  const dBall=Math.hypot(defender.x-ball.x, defender.y-ball.y);
  const fatigue=ctx.fatigue!=null?ctx.fatigue:_clamp(1-(defender.hp||100)/100,0,1);
  const defSkill=_stat(defender,'def')/99;

  // Menace du porteur : plus il est proche du but défendu, plus il faut agir.
  const myGoalX = dti===0 ? 0 : WW;
  const ballThreat = _xt(ball.x, ball.y, 1-dti, WW, WH, PCY); // xT de l'attaque adverse

  const U={};
  // PRESSER : monte si proche du ballon, si le curseur de pressing est haut,
  // en zone haute ; descend si un partenaire presse déjà (le doublage est rare)
  // et avec la fatigue.
  U.press = 1.8*Math.exp(-dBall/10) + 1.2*press + 0.6*ballThreat
            - (alreadyPressing?0.9:0) - 0.5*fatigue + 0.3*defSkill;
  // COUVRIR : monte si un partenaire presse déjà (on couvre derrière) et si le
  // danger est réel.
  U.cover = 0.9 + (alreadyPressing?1.0:0) + 0.8*ballThreat - 0.3*Math.exp(-dBall/10);
  // TENIR LA LIGNE : comportement par défaut, monte si le ballon est loin.
  U.hold = 1.1 + 0.8*(1-Math.exp(-dBall/14)) - 0.4*ballThreat;
  // FERMER UNE LIGNE DE PASSE (cover shadow) : monte si un partenaire presse
  // déjà et qu'il y a des receveurs à couvrir ; c'est le rôle intelligent du
  // second défenseur.
  U.shadow = 0.7 + (alreadyPressing?0.9:0) + 0.5*ballThreat - 0.4*fatigue;

  // Bloc désorganisé (danger + personne ne presse) → priorité à reformer /
  // presser plutôt que rester passif.
  if(ballInDanger && !alreadyPressing){ U.press+=0.6; U.hold-=0.4; }

  // Température : plus dispersé sous fatigue, plus net pour un bon défenseur.
  const tau=_clamp(0.28*(1 + 0.4*fatigue - 0.3*defSkill), 0.12, 0.55);
  for(const k of Object.keys(U)) U[k]+=_gaussNoise(0.06*Math.max(0.5,Math.abs(U[k])));
  const probs=_softmax(U, tau);
  return {intent:_sample(probs), probs};
}

// ── ASSIGNATION GLOBALE DE MARQUAGE (évite le croisement du glouton) ─────
// Résout une affectation défenseurs→attaquants qui minimise le coût total
// (distance + priorité au danger), plutôt que le glouton "plus proche d'abord"
// qui fait parfois se croiser deux défenseurs. Algorithme : amélioration
// itérative par échanges (2-opt) — léger, suffisant pour ≤11 joueurs, et sans
// dépendance externe. Renvoie une Map defenderId → attaquant.
function assignMarking(defenders, attackers, opts){
  opts=opts||{};
  const WW=opts.WW||105, PCY=opts.PCY||34, myGoalX=opts.myGoalX||0;
  const n=Math.min(defenders.length, attackers.length);
  if(!n) return {};
  // Trie les attaquants par danger décroissant (proximité du but défendu).
  const atk=[...attackers].sort((a,b)=>Math.abs(a.x-myGoalX)-Math.abs(b.x-myGoalX)).slice(0,n);
  const def=[...defenders];
  const cost=(d,a)=> Math.hypot(d.x-a.x,d.y-a.y) - 0.15*Math.abs(a.x-myGoalX)*0; // distance pure (danger déjà dans l'ordre)
  // Affectation initiale : glouton par danger.
  const used=new Set(); const pair=[];
  for(const a of atk){
    let best=-1,bd=1e9;
    for(let j=0;j<def.length;j++){ if(used.has(j))continue; const c=cost(def[j],a); if(c<bd){bd=c;best=j;} }
    if(best>=0){ used.add(best); pair.push([best,a]); }
  }
  // 2-opt : on échange deux affectations si ça réduit le coût total.
  let improved=true, guard=0;
  while(improved && guard++<50){
    improved=false;
    for(let i=0;i<pair.length;i++) for(let j=i+1;j<pair.length;j++){
      const [di,ai]=pair[i], [dj,aj]=pair[j];
      const before=cost(def[di],ai)+cost(def[dj],aj);
      const after =cost(def[di],aj)+cost(def[dj],ai);
      if(after<before-0.01){ pair[i]=[di,aj]; pair[j]=[dj,ai]; improved=true; }
    }
  }
  const map={};
  for(const [j,a] of pair) map[def[j].id]=a;
  return map;
}

window.defensiveIntent = defensiveIntent;
window.assignMarking = assignMarking;

})();
