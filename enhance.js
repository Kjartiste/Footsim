// ═══════════════════════════════════════════════════════════════════════
// ENHANCE.JS — Pack d'améliorations gameplay + visuel (additif, non destructif)
// ═══════════════════════════════════════════════════════════════════════
// Chargé APRÈS ia.js / visual.js. On n'édite aucune fonction existante : on
// les enveloppe (monkey-patch) et on ajoute des couches de rendu par-dessus.
// Tout est encapsulé et tolérant aux absences (typeof-guards) pour ne jamais
// casser une partie ou un enregistrement en cours.
//
//  1. WOODWORK    — poteaux / barre transversale : une part des tirs "hors
//                   cadre" frappe désormais le bois (drame + rebond).
//  2. MOMENTUM    — élan de match calculé en continu, barre live dans le HUD
//                   + commentaires "pression qui monte".
//  3. SHOT FEEL   — gerbe d'herbe au tir, léger zoom sur les grosses occasions.
//  4. CINÉMA      — vignette douce + bloom de projecteurs pour la profondeur.
// ═══════════════════════════════════════════════════════════════════════

(function(){
'use strict';

// Petit utilitaire : accès stat robuste (miroir de _S dans ia.js).
function _st(p,k){
  try{ if(typeof statOf==='function') return statOf(p,k); }catch(e){}
  return (p && p.s && p.s[k]!=null) ? p.s[k] : 50;
}
function _num(v,d){ return (typeof v==='number' && isFinite(v)) ? v : d; }

// ────────────────────────────────────────────────────────────────────────
// 1) WOODWORK — poteaux & barre
// ────────────────────────────────────────────────────────────────────────
// doShot() décide but / arrêt / hors-cadre. On enveloppe logEvent le temps
// d'un tir pour intercepter la ligne "Tir ... hors cadre" et, une fois sur
// quelques-uns, la transformer en poteau/barre : rebond du ballon + secousse
// + label. Approche : on n'a pas besoin de réécrire doShot ; on wrappe la
// fonction et on écoute son résultat via un flag posé juste avant.

const WOOD_CHANCE = 0.28; // part des tirs non cadrés qui trouvent le bois

// Effet visuel + sonore-visuel d'un contact avec le bois, à la position du but.
function _woodworkFx(goalX, gy, teamCol){
  try{
    const gyy = _num(gy, (typeof PCY==='number'?PCY:20));
    // gerbe d'étincelles blanches au point d'impact
    if(G && G.ptcl){
      for(let i=0;i<10;i++){
        const a=Math.random()*Math.PI*2, s=1.2+Math.random()*2.2;
        G.ptcl.push({t:'s',x:goalX,y:gyy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
          l:26,m:26,col:i%2?'#fff':'#ffe58a',sz:0.22+Math.random()*0.28});
      }
      G.ptcl.push({t:'ring_expand',x:goalX,y:gyy,col:'#ffffff',maxR:3.2,l:20,m:20});
      G.ptcl.push({t:'lbl',x:goalX,y:gyy-3,tx:'🪵 POTEAU !',col:'#ffd24a',l:60,m:60,sz:1.9});
    }
    if(typeof triggerShake==='function') triggerShake('MEDIUM', 260);
    if(typeof triggerFlash==='function') triggerFlash('#ffffff', 0.14, 220);
  }catch(e){/* rendu best-effort */}
}

// Enveloppe doShot : on pose un contexte, puis on patche logEvent le temps de
// l'appel pour attraper le message "hors cadre".
if(typeof window.doShot==='function' && !window._enhWoodPatched){
  window._enhWoodPatched = true;
  const _origDoShot = window.doShot;
  window.doShot = function(sh, ati, dti, def2, gk, goalX){
    // Contexte pour l'intercepteur ci-dessous.
    window._enhShotCtx = { sh, ati, dti, goalX, active:true };
    try{
      return _origDoShot.apply(this, arguments);
    } finally {
      // doShot programme sa résolution via setTimeout ; on garde le contexte
      // vivant un court instant pour que l'intercepteur de logEvent l'utilise.
      const ctx = window._enhShotCtx;
      setTimeout(()=>{ if(ctx) ctx.active=false; }, 900/(window.speedMult||1)+120);
    }
  };
}

// Enveloppe logEvent pour détecter la ligne "hors cadre" et, statistiquement,
// la promouvoir en poteau/barre avec rebond du ballon.
if(typeof window.logEvent==='function' && !window._enhLogPatched){
  window._enhLogPatched = true;
  const _origLog = window.logEvent;
  window.logEvent = function(msg, col){
    try{
      const ctx = window._enhShotCtx;
      if(ctx && ctx.active && typeof msg==='string' && /hors cadre/i.test(msg)
         && Math.random() < WOOD_CHANCE){
        ctx.active=false; // consommé
        const goalX = ctx.goalX;
        const gyBase = (typeof PCY==='number'?PCY:20);
        // Le ballon vient d'être frappé vers la cage (kickTo dans doShot) ;
        // on le fait revenir en jeu (rebond) plutôt que sortir en dégagement.
        const gy = clamp(gyBase + rng(-3,3),
                          (typeof GY1==='number'?GY1:gyBase-4),
                          (typeof GY2==='number'?GY2:gyBase+4));
        _woodworkFx(goalX, gy, (teams&&teams[ctx.ati]?teams[ctx.ati].color:'#fff'));
        const post = Math.random()<0.5 ? 'le poteau' : 'la barre transversale';
        _origLog.call(this, `🪵 ${ctx.sh?ctx.sh.name:'Le tir'} trouve ${post} !`,
                       '#ffd24a');
        // Rebond : le ballon repart vers le terrain avec un angle aléatoire,
        // possession disputée (on rend au camp défensif dans la majorité des
        // cas, comme un vrai renvoi de la défense).
        try{
          const fwd = (ctx.ati===0? -1 : 1); // vers le milieu, dos au but
          if(typeof G==='object' && G.ball){
            G.ball.x = goalX + fwd*1.6;
            G.ball.y = gy;
            G.ball.vx = fwd*(1.4+Math.random()*1.4);
            G.ball.vy = (Math.random()-0.5)*2.2;
            if(typeof freeB==='function') freeB();
          }
          // Balle en jeu, phase ouverte : celui qui récupère le fait naturellement.
          if(typeof setPhase==='function') setPhase('TRANSITION');
        }catch(e){}
        return; // on n'émet PAS le "hors cadre" d'origine
      }
    }catch(e){/* si quoi que ce soit rate, on retombe sur le log normal */}
    return _origLog.apply(this, arguments);
  };
}

// ────────────────────────────────────────────────────────────────────────
// 2) MOMENTUM — élan de match
// ────────────────────────────────────────────────────────────────────────
// Score d'élan dans [-1,1] : +1 = domination totale équipe 0 (rouge),
// -1 = domination équipe 1 (bleu). Alimenté par les événements marquants
// (tirs, corners, buts) avec décroissance continue vers 0. Affiché comme une
// barre live insérée sous la barre de possession du HUD.

const MOM = {
  v: 0,            // valeur lissée affichée
  target: 0,       // cible instantanée
  lastMsgMin: -99, // anti-spam commentaire
};
window._enhMomentum = MOM;

// Impulsion d'élan pour l'équipe `ti` (0/1), intensité `amt` (0..1).
function momPush(ti, amt){
  const dir = ti===0 ? 1 : -1;
  MOM.target = clamp(MOM.target + dir*amt, -1.4, 1.4);
}
window._enhMomPush = momPush;

// On raccroche aux évènements via le wrapper logEvent déjà en place : plutôt
// que de re-patcher, on lit les stats du match à chaque frame (voir tick).
// Mais buts & tirs sont plus fiables capturés à la source : on enveloppe
// goalScored et on lit les compteurs de tirs par différence.
let _lastShots=[0,0], _lastCorners=[0,0], _lastFouls=[0,0];

if(typeof window.goalScored==='function' && !window._enhGoalPatched){
  window._enhGoalPatched=true;
  const _origGoal = window.goalScored;
  window.goalScored = function(scorer, ati, goalX, assister){
    try{ momPush(ati, 0.85); }catch(e){}
    return _origGoal.apply(this, arguments);
  };
}

function _momMsg(txt, col){
  try{
    const el=document.getElementById('tmsg'); if(!el) return;
    el.textContent = txt;
    const dot=document.getElementById('tdot'); if(dot) dot.style.background=col;
  }catch(e){}
}

// Boucle d'élan : appelée par notre hook de frame. dt en secondes.
function momTick(dt){
  if(typeof G!=='object' || !G) return;
  // Capturer les nouveaux événements depuis les compteurs du moteur.
  const sh=G.shots||[0,0], co=G.corners||[0,0], fo=G.fouls||[0,0];
  for(let ti=0;ti<2;ti++){
    if(sh[ti] > (_lastShots[ti]||0))  momPush(ti, 0.18*(sh[ti]-(_lastShots[ti]||0)));
    if(co[ti] > (_lastCorners[ti]||0))momPush(ti, 0.12*(co[ti]-(_lastCorners[ti]||0)));
    if(fo[ti] > (_lastFouls[ti]||0))  momPush(ti===0?1:0, 0.05); // faute subie = léger élan adverse
  }
  _lastShots=[sh[0]||0, sh[1]||0];
  _lastCorners=[co[0]||0, co[1]||0];
  _lastFouls=[fo[0]||0, fo[1]||0];

  // Élan basé aussi sur la position du ballon (camp adverse = pression).
  if(G.ball && typeof WW==='number' && G.running && G.phase!=='HALFTIME' && G.phase!=='END'){
    const rel=(G.ball.x/WW - 0.5)*2; // -1 (but équipe0) .. +1 (but équipe1)
    MOM.target = lerp(MOM.target, MOM.target + rel*0.5, clamp(dt*0.6,0,1));
  }

  // Décroissance continue vers 0 (l'élan retombe si rien ne se passe).
  MOM.target = lerp(MOM.target, 0, clamp(dt*0.35,0,1));
  MOM.target = clamp(MOM.target, -1.4, 1.4);
  // Lissage de l'affichage.
  MOM.v = lerp(MOM.v, clamp(MOM.target,-1,1), clamp(dt*2.2,0,1));

  _renderMomBar();

  // Commentaire "pression" quand l'élan est fort et stable, throttlé par minute.
  const min = _num(G.minute,0);
  if(G.running && Math.abs(MOM.v)>0.62 && min - MOM.lastMsgMin >= 4){
    MOM.lastMsgMin = min;
    const ti = MOM.v>0 ? 0 : 1;
    const nm = (teams && teams[ti]) ? teams[ti].name : (ti===0?'Rouges':'Bleus');
    const col = (teams && teams[ti]) ? teams[ti].color : '#f0c028';
    const lines = Math.abs(MOM.v)>0.95
      ? [`🔥 ${nm} étouffe complètement l'adversaire !`,
         `🔥 ${nm} pousse, l'étau se resserre !`,
         `🔥 Vague rouge — ${nm} assiège la surface !`.replace('rouge', col==='#1878e8'?'bleue':'rouge')]
      : [`📈 La pression monte pour ${nm}.`,
         `📈 ${nm} prend le dessus.`,
         `📈 ${nm} installe son jeu.`];
    _momMsg(lines[(Math.random()*lines.length)|0], col);
  }
}
window._enhMomTick = momTick;

// Injection de la barre d'élan dans le HUD (une fois), sous la possession.
let _momBarEl=null;
function _ensureMomBar(){
  if(_momBarEl && document.body.contains(_momBarEl)) return _momBarEl;
  const posWrap=document.querySelector('#sp-match .posbar-wrap');
  if(!posWrap) return null;
  const wrap=document.createElement('div');
  wrap.className='mom-wrap';
  wrap.style.cssText='margin-top:8px';
  wrap.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">'+
      '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:9px;font-weight:700;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase">Élan</span>'+
      '<span id="mom-lead" style="font-family:\'Barlow Condensed\',sans-serif;font-size:9px;font-weight:800;letter-spacing:.5px;color:var(--muted)"></span>'+
    '</div>'+
    '<div style="position:relative;height:6px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden">'+
      '<div id="mom-fill" style="position:absolute;top:0;bottom:0;border-radius:3px;transition:none"></div>'+
      '<div style="position:absolute;left:50%;top:-1px;bottom:-1px;width:1px;background:rgba(255,255,255,.35)"></div>'+
    '</div>';
  posWrap.insertAdjacentElement('afterend', wrap);
  _momBarEl=wrap;
  return wrap;
}

function _renderMomBar(){
  const el=_ensureMomBar(); if(!el) return;
  const fill=el.querySelector('#mom-fill');
  const lead=el.querySelector('#mom-lead');
  if(!fill) return;
  const v=clamp(MOM.v,-1,1);
  const colR=(teams&&teams[0]?teams[0].color:'#e02030');
  const colB=(teams&&teams[1]?teams[1].color:'#1878e8');
  // La barre part du centre (50%) et s'étend vers le camp qui domine.
  const half=Math.abs(v)*50;
  if(v>=0){
    fill.style.left='50%'; fill.style.right='auto';
    fill.style.width=half+'%';
    fill.style.background='linear-gradient(90deg,'+colR+'55,'+colR+')';
  } else {
    fill.style.right='50%'; fill.style.left='auto';
    fill.style.width=half+'%';
    fill.style.background='linear-gradient(270deg,'+colB+'55,'+colB+')';
  }
  if(lead){
    if(Math.abs(v)<0.12){ lead.textContent='équilibré'; lead.style.color='var(--muted)'; }
    else {
      const ti=v>0?0:1;
      lead.textContent=(teams&&teams[ti]?teams[ti].name:(ti?'Bleus':'Rouges'));
      lead.style.color=(ti===0?colR:colB);
    }
  }
}

// Réinitialise l'élan à chaque coup d'envoi.
if(typeof window.placeKickoff==='function' && !window._enhKickPatched){
  window._enhKickPatched=true;
  const _origKick=window.placeKickoff;
  window.placeKickoff=function(){
    MOM.v=0; MOM.target=0; MOM.lastMsgMin=-99;
    _lastShots=[0,0];_lastCorners=[0,0];_lastFouls=[0,0];
    return _origKick.apply(this,arguments);
  };
}

// ────────────────────────────────────────────────────────────────────────
// 3) SHOT FEEL — gerbe d'herbe + micro-zoom occasion
// ────────────────────────────────────────────────────────────────────────
// À chaque tir (repéré via wrapper doShot ci-dessus), on ajoute une petite
// gerbe de pelouse au point de frappe et, pour les grosses occasions (tir
// proche du but), un léger zoom caméra sur la cage.
if(typeof window.doShot==='function' && !window._enhShotFeelPatched){
  window._enhShotFeelPatched=true;
  const _prev=window.doShot;
  window.doShot=function(sh, ati, dti, def2, gk, goalX){
    try{
      if(sh && G && G.ptcl){
        // gerbe d'herbe : petites mottes vertes projetées vers l'arrière
        const back = (ati===0? -1 : 1);
        for(let i=0;i<6;i++){
          const a=Math.PI + back*0.0 + (Math.random()-0.5)*1.4;
          const s=0.8+Math.random()*1.6;
          G.ptcl.push({t:'s',x:sh.x,y:sh.y+0.4,
            vx:Math.cos(a)*s*back*-1, vy:-(0.4+Math.random()*1.2),
            l:20,m:20,col:Math.random()<0.5?'#3a7d34':'#57a24a',sz:0.14+Math.random()*0.16});
        }
        // grosse occasion : tir depuis la surface → petit zoom dramatique
        const dGoal=Math.abs(sh.x-goalX);
        const box=(typeof PA_W==='number'&&PA_W>0)?PA_W:8;
        if(dGoal < box*1.15 && typeof triggerZoom==='function'){
          triggerZoom(clamp(goalX,2,(typeof WW==='number'?WW-2:98)),
                      (typeof PCY==='number'?PCY:20),
                      {scale:1.06, durMs:520});
        }
      }
    }catch(e){}
    return _prev.apply(this, arguments);
  };
}

// ────────────────────────────────────────────────────────────────────────
// 4) CINÉMA — vignette + bloom de projecteurs (couche par-dessus la scène)
// ────────────────────────────────────────────────────────────────────────
// Dessinée dans le hook de frame, après le rendu du jeu. Purement esthétique,
// respecte le réglage utilisateur (désactivable) et se met en veille si le
// canvas est trop petit. Cache le dégradé pour ne pas le recréer à chaque frame.

let _vigCache=null, _vigW=0, _vigH=0;
function _buildVignette(w,h){
  const oc=document.createElement('canvas'); oc.width=w; oc.height=h;
  const c=oc.getContext('2d');
  // Vignette radiale douce : centre transparent, bords assombris.
  const g=c.createRadialGradient(w/2,h/2, Math.min(w,h)*0.35, w/2,h/2, Math.max(w,h)*0.72);
  g.addColorStop(0,'rgba(0,0,0,0)');
  g.addColorStop(0.7,'rgba(0,0,0,0)');
  g.addColorStop(1,'rgba(0,0,0,0.34)');
  c.fillStyle=g; c.fillRect(0,0,w,h);
  return oc;
}

function drawCinema(){
  try{
    if(window._enhCinemaOff) return;
    if(!cvs || cvs.width<4 || cvs.height<4) return;
    // (re)construire la vignette si taille changée
    if(!_vigCache || _vigW!==cvs.width || _vigH!==cvs.height){
      _vigCache=_buildVignette(cvs.width,cvs.height);
      _vigW=cvs.width; _vigH=cvs.height;
    }
    ctx.save();
    ctx.globalCompositeOperation='source-over';
    ctx.globalAlpha=1;
    ctx.drawImage(_vigCache,0,0);
    // Bloom de projecteurs : deux halos froids diagonaux, additifs et très
    // discrets, qui donnent l'impression d'un stade éclairé de nuit.
    ctx.globalCompositeOperation='lighter';
    const t=Date.now()*0.0004;
    const halo=(cx,cy,rad,alpha,hue)=>{
      const gg=ctx.createRadialGradient(cx,cy,0,cx,cy,rad);
      gg.addColorStop(0,'rgba('+hue+','+alpha+')');
      gg.addColorStop(1,'rgba('+hue+',0)');
      ctx.fillStyle=gg; ctx.beginPath(); ctx.arc(cx,cy,rad,0,Math.PI*2); ctx.fill();
    };
    const pulse=0.5+0.5*Math.sin(t*6);
    halo(cvs.width*0.24, cvs.height*0.12, Math.min(cvs.width,cvs.height)*0.5,
         (0.05+pulse*0.02).toFixed(3), '190,210,255');
    halo(cvs.width*0.78, cvs.height*0.10, Math.min(cvs.width,cvs.height)*0.5,
         (0.05+(1-pulse)*0.02).toFixed(3), '210,225,255');
    ctx.restore();
  }catch(e){ try{ctx.restore();}catch(_){} }
}
window._enhDrawCinema=drawCinema;

// ────────────────────────────────────────────────────────────────────────
// HOOK DE FRAME — on enveloppe frame() pour injecter momTick + drawCinema
// SANS toucher au corps de frame(). On appelle l'original, puis nos couches.
// ────────────────────────────────────────────────────────────────────────
if(typeof window.frame==='function' && !window._enhFramePatched){
  window._enhFramePatched=true;
  const _origFrame=window.frame;
  let _lastTs=performance.now();
  window.frame=function(ts){
    const r=_origFrame.apply(this,arguments);
    try{
      const now=(typeof ts==='number')?ts:performance.now();
      const dt=Math.min(Math.max((now-_lastTs)/1000,0),0.05);
      _lastTs=now;
      // Cinéma : dessiné en dernier, par-dessus toute la scène déjà rendue.
      drawCinema();
      // Élan : mis à jour même en pause pour un affichage stable.
      momTick(dt);
    }catch(e){/* ne jamais casser la boucle de rendu */}
    return r;
  };
  // frame() se ré-appelle via requestAnimationFrame(frame) en interne, en
  // capturant la référence globale `frame`. Comme on réassigne window.frame
  // AVANT le prochain rAF, la version enveloppée prend le relais toute seule.
}

// ────────────────────────────────────────────────────────────────────────
// RÉGLAGE UTILISATEUR — interrupteur "Effets cinéma" persistant.
// ────────────────────────────────────────────────────────────────────────
try{
  const saved=localStorage.getItem('footsim_cinema_off');
  window._enhCinemaOff = saved==='1';
}catch(e){}
window.toggleCinemaFx=function(){
  window._enhCinemaOff=!window._enhCinemaOff;
  try{ localStorage.setItem('footsim_cinema_off', window._enhCinemaOff?'1':'0'); }catch(e){}
  return !window._enhCinemaOff;
};

})();
