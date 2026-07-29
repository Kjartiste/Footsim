// ═══════════════════════════════════════════════════════════════════════
// WALKOUT.JS — Entrée des joueurs avant le coup d'envoi
// ═══════════════════════════════════════════════════════════════════════
// Séquence d'immersion façon vrai match : au tout premier coup d'envoi, les
// joueurs entrent sur la pelouse depuis la ligne médiane, se mettent en RANG
// au centre, puis rejoignent leurs positions de formation. Le match ne démarre
// (sifflet + jeu) qu'une fois tout le monde placé.
//
// Piloté par un état G._walkout = { stage, t }.
//   stage 0 : entrée depuis le bord → rang aligné au centre
//   stage 1 : petite pause en rang (présentation)
//   stage 2 : dispersion vers les positions de formation
//   puis    : coup d'envoi normal (le jeu reprend la main)
//
// Désactivable : window._walkoutEnabled = false.
// ═══════════════════════════════════════════════════════════════════════

(function(){
'use strict';

window._walkoutEnabled = (window._walkoutEnabled !== false); // activé par défaut

function _clamp(v,a,b){return Math.max(a,Math.min(b,v));}

// Démarre la séquence d'entrée. Renvoie true si lancée, false si sautée.
// Appelée au premier coup d'envoi d'un match, à la place du démarrage direct.
window.startWalkout = function(atkTi, onDone){
  if(!window._walkoutEnabled || typeof G!=='object' || !G){
    if(onDone) onDone();
    return false;
  }
  const WWv = (typeof WW==='number')?WW:75;
  const WHv = (typeof WH==='number')?WH:50;
  const PCXv = WWv/2, PCYv = WHv/2;

  // Cibles finales de formation (là où placeKickoff mettra les joueurs).
  const finalPos = [];
  teams.forEach((T,ti)=>T.players.forEach((p,pi)=>{
    let bx=PCXv/2, by=PCYv;
    try{ const b=formBase(ti,pi); bx=b.x; by=b.y; }catch(e){}
    const ownMin=ti===0?0.5:PCXv+0.4, ownMax=ti===0?PCXv-0.4:WWv-0.5;
    finalPos.push({
      p, ti, pi,
      fx:_clamp(bx, ownMin, ownMax),
      fy:_clamp(by, 0.5, WHv-0.5),
    });
  }));

  // Position de départ : hors terrain, le long de la ligne médiane haute,
  // les deux équipes entrant l'une derrière l'autre (effet "tunnel").
  finalPos.forEach((fp,idx)=>{
    const perTeam = fp.pi;
    // File d'attente juste au-dessus de la ligne médiane, décalée par équipe.
    fp.p.x = PCXv + (fp.ti===0? -1 : 1) * (2 + perTeam*0.4);
    fp.p.y = -3 - perTeam*1.4;           // au-dessus du terrain (hors champ)
    fp.p.vx=0; fp.p.vy=0; fp.p.hasBall=false;
    // Cible de rang : alignés sur une rangée près du centre, par équipe.
    fp.rowx = PCXv + (fp.ti===0? -1 : 1) * (4 + perTeam*2.4);
    fp.rowy = PCYv + (fp.ti===0? -1 : 1) * 6;   // deux rangs face à face
  });

  G._walkout = { stage:0, t:0, list:finalPos, atkTi, onDone };
  G.phase='KICKOFF'; // pour que le rendu reste en mode match
  G.running=true;    // le moteur tourne (pour animer) mais aiDecide est bloqué
  G._paused=false;
  return true;
};

// Avance l'animation d'entrée. Appelée chaque frame par le hook de frame tant
// que G._walkout existe. Déplace les joueurs vers leur cible du stage courant.
window.tickWalkout = function(dt){
  const W = G._walkout; if(!W) return;
  W.t += (dt||0.016);

  // Vitesse en unités-terrain PAR SECONDE (proportionnelle à dt), pour une
  // durée d'entrée constante (~2-3 s) quel que soit le framerate.
  const speedPerSec = 38;
  const step0 = Math.min(3, speedPerSec * (dt||0.016)); // borné pour éviter les sauts
  let allArrived = true;

  W.list.forEach(fp=>{
    let tx, ty;
    if(W.stage===0){ tx=fp.rowx; ty=fp.rowy; }        // vers le rang
    else if(W.stage===1){ tx=fp.rowx; ty=fp.rowy; }   // pause en rang
    else { tx=fp.fx; ty=fp.fy; }                       // vers la formation

    const dx=tx-fp.p.x, dy=ty-fp.p.y, d=Math.hypot(dx,dy);
    if(d>0.4){
      allArrived=false;
      const step=Math.min(d, step0);
      fp.p.vx = (dx/d)*step;
      fp.p.vy = (dy/d)*step;
      fp.p.x += fp.p.vx;
      fp.p.y += fp.p.vy;
    } else {
      fp.p.vx*=0.6; fp.p.vy*=0.6;
    }
  });

  // Transitions de stage.
  if(W.stage===0 && allArrived){ W.stage=1; W.t=0; }
  else if(W.stage===1 && W.t>0.5){ W.stage=2; W.t=0; } // ~0,5 s de présentation
  else if(W.stage===2 && allArrived){
    // Tout le monde est placé : fin de l'entrée, on lance le vrai coup d'envoi.
    const done=W.onDone; const atkTi=W.atkTi;
    G._walkout=null;
    try{ if(typeof placeKickoff==='function') placeKickoff(atkTi); }catch(e){}
    if(done) done();
  }
};

})();
