// ═══════════════════════════════════════════════════
// VISUAL.JS — Canvas, rendu, particules, animations
// ═══════════════════════════════════════════════════
function spawnGoal(gx,gy,col,ati){
  for(let i=0;i<40;i++){
    const a=Math.random()*Math.PI*2,s=rng(.4,1.4);
    G.ptcl.push({t:'s',x:gx,y:gy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.5,l:90,m:90,col,sz:rng(.25,.9)});
  }
  for(let i=0;i<4;i++)G.ptcl.push({t:'r',x:PCX,y:PCY,r:.5,vr:.5+i*.25,col,l:55,m:55});
  G.ptcl.push({t:'lbl',x:PCX,y:PCY-5,tx:'BUT !',col:'#f0c028',l:120,m:120,sz:4.5});
  const teamName=ati!==undefined?teams[ati]?.name:(teams[G.atkTi]?.name||'');
  G.ptcl.push({t:'lbl',x:PCX,y:PCY+1,tx:teamName,col,l:100,m:100,sz:2.2});
  // ── SPEEDLINES (façon manga) ────────────────────────────────────────────
  // Rafale de traits radiants qui jaillissent du point de but, façon
  // "impact frame" manga, pour marquer le split-second du but. Très courtes
  // (l petit) : elles claquent puis disparaissent, contrairement aux
  // confettis qui, eux, retombent lentement.
  const nLines=22;
  for(let i=0;i<nLines;i++){
    const ang=(i/nLines)*Math.PI*2+rng(-.12,.12);
    G.ptcl.push({t:'speedline',x:gx,y:gy,vx:0,vy:0,ang,inner:rng(2,4),len:rng(16,26),
      lw:rng(.18,.4),col:pick(['#fff','#f0c028',col]),l:16,m:16});
  }
  // ── CONFETTIS ────────────────────────────────────────────────────────────
  // Pluie de confettis colorés depuis le haut du terrain, qui retombent
  // naturellement (gravité générique du moteur de particules) en tournant.
  for(let i=0;i<55;i++){
    G.ptcl.push({t:'confetti',x:PCX+rng(-9,9),y:PCY-9+rng(-3,3),
      vx:rng(-1.3,1.3),vy:rng(-2.6,-1.0),
      col:pick(['#f0c028','#e63946','#2a9d8f','#ffffff','#457b9d',col]),
      w:rng(.35,.7),h:rng(.16,.3),rot0:rng(0,Math.PI*2),spin:rng(-.3,.3),
      l:150,m:150});
  }
  // ── TEMPS FORT : secousse d'écran + flash coloré ───────────────────────
  triggerShake('HEAVY');        // preset intensité forte
  triggerFlash(col, 0.32, 420); // couleur de l'équipe, opacité pic, durée
  // La tribune de l'équipe qui marque explose de joie (flashs blancs).
  triggerStandsCheer(ati!==undefined?ati:(G.atkTi||0));
}

// ── SCREEN SHAKE (enrichi) ───────────────────────────────────────────────
// Secousse d'écran pour les temps forts. Version étendue : plusieurs presets
// d'intensité, respect de prefers-reduced-motion, réglage utilisateur, axes
// configurables et décroissance douce. N'altère JAMAIS les coordonnées du
// monde — c'est un simple décalage visuel appliqué au rendu du canvas.
const SHAKE_PRESETS = {
  LIGHT:     { mag:0.5, dur:220 },
  MEDIUM:    { mag:1.0, dur:380 },
  HEAVY:     { mag:1.8, dur:520 },
  IMPACT:    { mag:2.4, dur:300 },
  EXPLOSION: { mag:3.2, dur:650 },
  EARTHQUAKE:{ mag:4.0, dur:1100 },
};
let _shake={t:0, dur:0, mag:0, axis:'both'};
// Réglage utilisateur (persisté) : les secousses peuvent être coupées.
function _shakeEnabled(){
  if(typeof G!=='undefined' && G && G._shakeOff) return false;
  try{ if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false; }catch(e){}
  return true;
}
// trigger(preset|mag, durMs?, {axis}) — accepte un nom de preset ou un nombre.
function triggerShake(preset='MEDIUM', durMs, opts){
  if(!_shakeEnabled()) return;
  let mag, dur, axis=(opts&&opts.axis)||'both';
  if(typeof preset==='string' && SHAKE_PRESETS[preset]){
    mag=SHAKE_PRESETS[preset].mag; dur=durMs||SHAKE_PRESETS[preset].dur;
  } else {
    mag=(typeof preset==='number')?preset:1.0; dur=durMs||500;
  }
  // Sur petit écran (mobile), on atténue pour rester confortable.
  if(cvs && cvs.width<560) mag*=0.6;
  _shake={t:performance.now(), dur, mag, axis};
}
function _shakeOffset(){
  if(!_shake.dur) return {x:0,y:0};
  const el=performance.now()-_shake.t;
  if(el>=_shake.dur){ _shake.dur=0; return {x:0,y:0}; }
  // Décroissance easeOut (plus naturelle qu'un linéaire).
  const k=Math.pow(1-el/_shake.dur, 2);
  const amp=_shake.mag*8*k;
  const x=(_shake.axis==='vertical')?0:(Math.random()*2-1)*amp;
  const y=(_shake.axis==='horizontal')?0:(Math.random()*2-1)*amp;
  return { x, y };
}

// ── CAMÉRA : ZOOM DRAMATIQUE (sur un joueur, ex. lancement de sort) ───────
// Zoom cinématique léger et doux : la vue se rapproche d'un point (souvent le
// lanceur d'un sort), tient un instant, puis revient. Purement visuel : on
// applique scale+translate autour de la couche dynamique du canvas. Respecte
// aussi prefers-reduced-motion / le toggle utilisateur.
let _zoom={active:false, t0:0, inMs:220, holdMs:260, outMs:340, scale:1.55, wx:PCX, wy:PCY};
function triggerZoom(worldX, worldY, opts){
  if(!_shakeEnabled()) return; // même réglage que les secousses (confort)
  opts=opts||{};
  _zoom={
    active:true, t0:performance.now(),
    inMs:opts.inMs||220, holdMs:opts.holdMs||260, outMs:opts.outMs||340,
    scale:opts.scale||1.55, wx:worldX, wy:worldY
  };
}
// Renvoie le facteur de zoom courant (1 = pas de zoom) et le centre écran.
function _zoomState(){
  if(!_zoom.active) return null;
  const el=performance.now()-_zoom.t0;
  const total=_zoom.inMs+_zoom.holdMs+_zoom.outMs;
  if(el>=total){ _zoom.active=false; return null; }
  let f; // 0→1 progression de l'intensité du zoom
  if(el<_zoom.inMs) f=_ease(el/_zoom.inMs);
  else if(el<_zoom.inMs+_zoom.holdMs) f=1;
  else f=1-_ease((el-_zoom.inMs-_zoom.holdMs)/_zoom.outMs);
  const scale=1+(_zoom.scale-1)*f;
  return { scale, cx:wx(_zoom.wx), cy:wy(_zoom.wy), f };
}
function _ease(t){ return t<0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; } // easeInOut

// ── FLASH plein écran (coloré) ──────────────────────────────────────────
// Bref voile coloré (couleur de l'équipe qui marque) pour ponctuer le but.
let _goalFlash={t:0, dur:0, peak:0, col:'#fff'};
function triggerFlash(col='#fff', peak=0.3, durMs=400){ _goalFlash={t:performance.now(), dur:durMs, peak, col}; }
function drawGoalFlash(){
  if(!_goalFlash.dur) return;
  const el=performance.now()-_goalFlash.t;
  if(el>=_goalFlash.dur){ _goalFlash.dur=0; return; }
  const k=1-el/_goalFlash.dur;
  ctx.save();
  ctx.globalAlpha=_goalFlash.peak*k;
  ctx.fillStyle=_goalFlash.col;
  ctx.fillRect(0,0,cvs.width,cvs.height);
  ctx.restore();
}
function spawnCyclon(x,y,goalX){
  G.ptcl.push({t:'beam',x,y,tx:goalX,ty:PCY,col:'#80deea',w:.8,l:24,m:24});
  for(let i=0;i<30;i++){const a=i/30*Math.PI*8,r=rng(.5,6)*(1-i/30)+.5;G.ptcl.push({t:'spiral',cx:x,cy:y,ang0:a,rad:r,spd:5,col:pick(['#80deea','#e0f7fa','#fff']),l:50,m:50});}
  G.ptcl.push({t:'ring_expand',x,y,col:'#80deea',maxR:14,l:40,m:40});
  G.ptcl.push({t:'lbl',x,y:y-3,tx:'CYCLONE',col:'#00bcd4',l:52,m:52,sz:1.8});
}
function spawnTelekib(tx,ty){
  G.ptcl.push({t:'ring_expand',x:tx,y:ty,col:'#7e57c2',maxR:8,l:35,m:35});
  G.ptcl.push({t:'ring_expand',x:tx,y:ty,col:'#ede7f6',maxR:4,l:25,m:25});
  for(let i=0;i<15;i++)G.ptcl.push({t:'s',x:tx,y:ty,vx:rng(-1.5,1.5),vy:rng(-1.5,1.5),l:30,m:30,col:'#7e57c2',sz:rng(.2,.6)});
  G.ptcl.push({t:'lbl',x:tx,y:ty-3,tx:'TELEKIN !',col:'#7e57c2',l:48,m:48,sz:1.7});
}
function spawnSpinDash(x,y,goalX){
  // Spirale bleue qui file vers le but
  const steps=18;
  for(let i=0;i<steps;i++){
    const t=i/steps;
    const px=x+(goalX-x)*t, py=y+Math.sin(t*Math.PI*4)*3;
    G.ptcl.push({t:'s',x:px,y:py,vx:rng(-.2,.2),vy:rng(-.2,.2),l:22,m:22,col:pick(['#2979ff','#82b1ff','#e3f2fd','#fff']),sz:rng(.25,.7)});
  }
  G.ptcl.push({t:'ring_expand',x,y,col:'#2979ff',maxR:6,l:28,m:28});
  G.ptcl.push({t:'ring_expand',x,y,col:'#82b1ff',maxR:3,l:20,m:20});
  G.ptcl.push({t:'beam',x,y,tx:goalX,ty:PCY,col:'#2979ff',w:.5,l:18,m:18});
  G.ptcl.push({t:'lbl',x:x+(goalX-x)*.4,y:y-4,tx:'SPIN DASH !',col:'#82b1ff',l:45,m:45,sz:1.8});
}
function spawnDragon(x,y){
  // Aura de feu massive - anneaux concentriques + flammes
  for(let r=4;r<=20;r+=4) G.ptcl.push({t:'ring_expand',x,y,col:r<10?'#ff1744':'#ff6d00',maxR:r,l:50+r,m:50+r});
  // Particules de flamme en spirale
  for(let i=0;i<36;i++){
    const a=i/36*Math.PI*6, r=rng(2,12);
    G.ptcl.push({t:'spiral',cx:x,cy:y,ang0:a,rad:r,spd:4,col:pick(['#e02030','#ff6d00','#ff9800','#ffd700','#ff1744']),l:70,m:70});
  }
  // Écailles/fragments projetés
  for(let i=0;i<24;i++){
    const a=Math.random()*Math.PI*2;
    G.ptcl.push({t:'s',x,y,vx:Math.cos(a)*rng(1,3),vy:Math.sin(a)*rng(1,3),l:60,m:60,col:pick(['#e02030','#ff6d00','#b71c1c','#ffd700']),sz:rng(.3,.8)});
  }
  G.ptcl.push({t:'lbl',x,y:y-6,tx:'🐉 DRAGON !',col:'#ff1744',l:80,m:80,sz:2.5});
}
function spawnDeluge(x,y){
  for(let i=0;i<40;i++){const ix=Math.random()*WW,iy=Math.random()*WH;G.ptcl.push({t:'s',x:ix,y:iy,vx:0,vy:rng(.2,.6),l:80,m:80,col:pick(['#1565c0','#42a5f5','#bbdefb']),sz:rng(.1,.35)});}
  G.ptcl.push({t:'ring_expand',x,y,col:'#1565c0',maxR:20,l:50,m:50});
  G.ptcl.push({t:'lbl',x:PCX,y:PCY-5,tx:'DELUGE !',col:'#1565c0',l:65,m:65,sz:2.2});
}
function spawnTerreur(x,y){
  G.ptcl.push({t:'ring_expand',x,y,col:'#b71c1c',maxR:18,l:45,m:45});
  G.ptcl.push({t:'ring_expand',x,y,col:'#ff5252',maxR:10,l:35,m:35});
  for(let i=0;i<20;i++)G.ptcl.push({t:'s',x,y,vx:rng(-2,2),vy:rng(-2,2),l:40,m:40,col:pick(['#b71c1c','#ff5252','#ff8a80']),sz:rng(.25,.7)});
  G.ptcl.push({t:'lbl',x,y:y-4,tx:'TERREUR !',col:'#ff5252',l:55,m:55,sz:2.0});
}
function spawnEpuise(x,y){
  G.ptcl.push({t:'ring_expand',x,y,col:'#546e7a',maxR:8,l:35,m:35});
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2,r=rng(2,10);G.ptcl.push({t:'spiral',cx:x,cy:y,ang0:a,rad:r,spd:-2,col:'#546e7a',l:45,m:45});}
  G.ptcl.push({t:'lbl',x,y:y-3,tx:'EPUISEMENT',col:'#546e7a',l:48,m:48,sz:1.5});
}
function spawnMaledic(x,y,tx,ty){
  G.ptcl.push({t:'beam',x,y,tx,ty,col:'#4a148c',w:.6,l:28,m:28});
  G.ptcl.push({t:'ring_expand',x:tx,y:ty,col:'#7b1fa2',maxR:6,l:32,m:32});
  for(let i=0;i<12;i++)G.ptcl.push({t:'s',x:tx+rng(-3,3),y:ty+rng(-2,2),vx:0,vy:rng(-.5,0),l:45,m:45,col:pick(['#4a148c','#7b1fa2','#ce93d8']),sz:rng(.2,.55)});
  G.ptcl.push({t:'lbl',x:tx,y:ty-3,tx:'MALEDICTION',col:'#7b1fa2',l:50,m:50,sz:1.5});
}
function spawnTranse(x,y){
  for(let i=0;i<20;i++){const a=i/20*Math.PI*6,r=rng(1,8);G.ptcl.push({t:'spiral',cx:x,cy:y,ang0:a,rad:r,spd:3,col:pick(['#ff6f00','#ffa000','#ffd54f']),l:50,m:50});}
  G.ptcl.push({t:'ring_expand',x,y,col:'#ff6f00',maxR:12,l:38,m:38});
  G.ptcl.push({t:'lbl',x,y:y-4,tx:'TRANSE !',col:'#ff6f00',l:55,m:55,sz:2.0});
}
function spawnFolie(x,y,tx,ty){
  G.ptcl.push({t:'beam',x,y,tx,ty,col:'#e040fb',w:.5,l:22,m:22});
  G.ptcl.push({t:'ring_expand',x:tx,y:ty,col:'#e040fb',maxR:5,l:28,m:28});
  for(let i=0;i<14;i++){const a=Math.random()*Math.PI*2;G.ptcl.push({t:'s',x:tx+rng(-2,2),y:ty+rng(-1,1),vx:Math.cos(a)*rng(.4,1.2),vy:Math.sin(a)*rng(.4,1.2),l:35,m:35,col:pick(['#e040fb','#ea80fc','#fff']),sz:rng(.2,.5)});}
  G.ptcl.push({t:'lbl',x:tx,y:ty-3,tx:'FOLIE !',col:'#e040fb',l:48,m:48,sz:1.7});
}
function spawnDivine(x,y,tx,ty){
  G.ptcl.push({t:'beam',x,y,tx,ty,col:'#ffd700',w:.8,l:28,m:28});
  G.ptcl.push({t:'ring_expand',x:tx,y:ty,col:'#ffd700',maxR:9,l:40,m:40});
  G.ptcl.push({t:'ring_expand',x:tx,y:ty,col:'#fffde7',maxR:5,l:30,m:30});
  for(let i=0;i<20;i++){const a=i/20*Math.PI*2;G.ptcl.push({t:'spiral',cx:tx,cy:ty,ang0:a,rad:rng(1.5,5),spd:3,col:pick(['#ffd700','#fff9c4','#fff']),l:55,m:55});}
  G.ptcl.push({t:'lbl',x:tx,y:ty-4,tx:'PUISSANCE DIVINE',col:'#ffd700',l:65,m:65,sz:1.6});
}
function spawnPlaisir(x,y){
  for(let i=0;i<16;i++){const a=Math.random()*Math.PI*2,r=rng(2,10);G.ptcl.push({t:'s',x:x+Math.cos(a)*r,y:y+Math.sin(a)*r*.6,vx:0,vy:rng(-.4,-.1),l:55,m:55,col:pick(['#f48fb1','#f06292','#ce93d8','#fff']),sz:rng(.25,.6)});}
  G.ptcl.push({t:'ring_expand',x,y,col:'#f48fb1',maxR:12,l:38,m:38});
  G.ptcl.push({t:'lbl',x,y:y-4,tx:'PLAISIR ET BEAUTE',col:'#f48fb1',l:55,m:55,sz:1.5});
}
function spawnSylvestre(x,y){
  for(let i=0;i<25;i++){const ix=Math.random()*WW,iy=Math.random()*WH;G.ptcl.push({t:'s',x:ix,y:iy,vx:0,vy:0,l:90,m:90,col:pick(['#43a047','#66bb6a','#a5d6a7','#c8e6c9']),sz:rng(.2,.55)});}
  G.ptcl.push({t:'ring_expand',x,y,col:'#43a047',maxR:15,l:45,m:45});
  G.ptcl.push({t:'lbl',x:PCX,y:PCY-4,tx:'MARCHE SYLVESTRE',col:'#43a047',l:60,m:60,sz:1.6});
}
function spawnFleurs(zx,zy){
  for(let i=0;i<50;i++){const a=Math.random()*Math.PI*2,r=rng(0,15);G.ptcl.push({t:'s',x:zx+Math.cos(a)*r,y:zy+Math.sin(a)*r*.5,vx:0,vy:0,l:180,m:180,col:pick(['#ab47bc','#ce93d8','#f48fb1','#fff9c4','#a5d6a7']),sz:rng(.2,.6)});}
  G.ptcl.push({t:'ring_expand',x:zx,y:zy,col:'#ab47bc',maxR:18,l:50,m:50});
  G.ptcl.push({t:'lbl',x:zx,y:zy-5,tx:'PARTERRE DE FLEURS',col:'#ab47bc',l:70,m:70,sz:1.7});
}
function spawnSixsens(x,y){
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;G.ptcl.push({t:'spiral',cx:x,cy:y,ang0:a,rad:rng(2,6),spd:-3,col:pick(['#00acc1','#b2ebf2','#e0f7fa']),l:45,m:45});}
  G.ptcl.push({t:'ring_expand',x,y,col:'#00acc1',maxR:8,l:35,m:35});
  G.ptcl.push({t:'lbl',x,y:y-3,tx:'6EME SENS',col:'#00acc1',l:50,m:50,sz:1.6});
}
function spawnAile(x,y,tx,ty){
  G.ptcl.push({t:'beam',x,y,tx,ty,col:'#29b6f6',w:.6,l:24,m:24});
  for(let i=0;i<20;i++){const a=Math.random()*Math.PI*2;G.ptcl.push({t:'s',x:tx,y:ty,vx:Math.cos(a)*rng(.5,2),vy:Math.sin(a)*rng(.2,1),l:40,m:40,col:pick(['#29b6f6','#b3e5fc','#fff']),sz:rng(.2,.55)});}
  G.ptcl.push({t:'ring_expand',x:tx,y:ty,col:'#29b6f6',maxR:7,l:32,m:32});
  G.ptcl.push({t:'lbl',x:tx,y:ty-3.5,tx:'AILES !',col:'#29b6f6',l:52,m:52,sz:1.8});
}
function spawnEsprit(x,y){
  for(let i=0;i<30;i++){const a=i/30*Math.PI*6,r=rng(.5,8);G.ptcl.push({t:'spiral',cx:x,cy:y,ang0:a,rad:r,spd:4,col:pick(['#66bb6a','#a5d6a7','#c8e6c9','#fff']),l:50,m:50});}
  G.ptcl.push({t:'ring_expand',x,y,col:'#66bb6a',maxR:20,l:50,m:50});
  G.ptcl.push({t:'lbl',x:PCX,y:PCY-5,tx:'ESPRIT-OISEAU',col:'#66bb6a',l:60,m:60,sz:1.9});
}

// Generic fallback spawnSpell
function spawnSpell(x,y,sp){
  for(let i=0;i<18;i++){
    const a=Math.random()*Math.PI*2,s=rng(.25,1.0);
    G.ptcl.push({t:'s',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,l:42,m:42,col:sp.pc||'#fff',sz:rng(.18,.6)});
  }
  G.ptcl.push({t:'lbl',x,y:y-2.5,tx:sp.n||'?',col:sp.col||'#fff',l:48,m:48,sz:1.6});
}

// ── Spawn animations par sort ────────────────────────────
function spawnFire(x,y,goalX){
  // Flammes qui s'élancent vers le but
  G.ptcl.push({t:'ring_expand',x,y,col:'#ff4500',maxR:6,l:28,m:28});
  G.ptcl.push({t:'ring_expand',x,y,col:'#ff9800',maxR:4,l:20,m:20});
  G.ptcl.push({t:'beam',x,y,tx:goalX,ty:PCY,col:'#ff4500',w:.6,l:22,m:22});
  for(let i=0;i<22;i++){
    const a=rng(-0.4,0.4)+(goalX>x?0:Math.PI);const s=rng(1.5,3.0);
    G.ptcl.push({t:'s',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s+rng(-.5,.5),l:38,m:38,col:pick(['#ff4500','#ff9800','#ffd740']),sz:rng(.3,.8)});
  }
  G.ptcl.push({t:'lbl',x,y:y-2.5,tx:'🔥',col:'#ff4500',l:50,m:50,sz:2.0});
}

function spawnFireball(x,y,goalX){
  G.ptcl.push({t:'ring_expand',x,y,col:'#ff4500',maxR:10,l:35,m:35});
  G.ptcl.push({t:'ring_expand',x,y,col:'#ffd740',maxR:7,l:28,m:28});
  G.ptcl.push({t:'beam',x,y,tx:goalX,ty:PCY,col:'#ff6d00',w:1.2,l:30,m:30});
  for(let i=0;i<35;i++){
    const a=Math.random()*Math.PI*2,s=rng(.8,2.8);
    G.ptcl.push({t:'s',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,l:55,m:55,col:pick(['#ff4500','#ff9800','#ffd740','#fff176']),sz:rng(.4,1.0)});
  }
  G.ptcl.push({t:'lbl',x,y:y-3,tx:'💥 BOULE DE FEU',col:'#ff6d00',l:60,m:60,sz:1.8});
}

function spawnIce(x,y,goalX){
  G.ptcl.push({t:'beam',x,y,tx:goalX,ty:PCY,col:'#80d8ff',w:.5,l:20,m:20});
  G.ptcl.push({t:'ring_expand',x,y,col:'#80d8ff',maxR:5,l:25,m:25});
  for(let i=0;i<20;i++){
    const a=Math.random()*Math.PI*2,s=rng(.4,1.5);
    G.ptcl.push({t:'s',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,l:35,m:35,col:pick(['#80d8ff','#b3e5fc','#e1f5fe','#fff']),sz:rng(.2,.6)});
  }
  G.ptcl.push({t:'lbl',x,y:y-2.5,tx:'❄️',col:'#1878e8',l:45,m:45,sz:2.0});
}

function spawnThunder(x,y,goalX){
  // Eclair vers le but
  G.ptcl.push({t:'lightning',x,y,tx:goalX,ty:PCY,col:'#ffd740',l:18,m:18});
  G.ptcl.push({t:'lightning',x,y,tx:goalX,ty:PCY+rng(-3,3),col:'#fff176',l:14,m:14});
  G.ptcl.push({t:'ring_expand',x,y,col:'#ffd740',maxR:5,l:22,m:22});
  for(let i=0;i<18;i++){
    G.ptcl.push({t:'s',x,y,vx:rng(-2,2),vy:rng(-2,2),l:28,m:28,col:pick(['#ffd740','#fff176','#fff9c4']),sz:rng(.2,.6)});
  }
  G.ptcl.push({t:'lbl',x,y:y-2.5,tx:'⚡',col:'#f0c028',l:45,m:45,sz:2.2});
}

function spawnEldritch(x,y,goalX){
  // Rayon violet + ondes de choc
  G.ptcl.push({t:'beam',x,y,tx:goalX,ty:PCY,col:'#9c27b0',w:1.0,l:28,m:28});
  G.ptcl.push({t:'ring_expand',x,y,col:'#9c27b0',maxR:12,l:40,m:40});
  G.ptcl.push({t:'ring_expand',x,y,col:'#e040fb',maxR:8,l:32,m:32});
  G.ptcl.push({t:'ring_expand',x,y,col:'#d1c4e9',maxR:5,l:22,m:22});
  for(let i=0;i<30;i++){
    const a=Math.random()*Math.PI*2,s=rng(.6,2.5);
    G.ptcl.push({t:'s',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,l:50,m:50,col:pick(['#9c27b0','#e040fb','#ce93d8','#fff']),sz:rng(.25,.7)});
  }
  G.ptcl.push({t:'lbl',x,y:y-3,tx:'✨ ELDRITCH',col:'#e040fb',l:55,m:55,sz:1.8});
}

function spawnIllusion(x,y,goalX){
  // Copies fantômes qui partent dans plusieurs directions
  for(let i=0;i<3;i++){
    const ang=(i/3)*Math.PI-.3;const dist=rng(4,8);
    G.ptcl.push({t:'beam',x,y,tx:x+Math.cos(ang)*dist*(goalX>x?1:-1),ty:y+Math.sin(ang)*dist,col:'#ff9800',w:.4,l:18,m:18});
  }
  G.ptcl.push({t:'beam',x,y,tx:goalX,ty:PCY,col:'#ff9800',w:.7,l:24,m:24});
  for(let i=0;i<20;i++){
    const a=Math.random()*Math.PI*2,s=rng(.5,1.8);
    G.ptcl.push({t:'s',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,l:38,m:38,col:pick(['#ff9800','#ffe0b2','#fff9c4']),sz:rng(.2,.6)});
  }
  G.ptcl.push({t:'lbl',x,y:y-2.5,tx:'👁 ILLUSION',col:'#ff9800',l:50,m:50,sz:1.6});
}

function spawnMouton(x,y){
  // Chaos de particules marron + spirale
  for(let i=0;i<16;i++){
    const ang=i/16*Math.PI*2;
    G.ptcl.push({t:'spiral',cx:x,cy:y,ang0:ang,rad:rng(2,5),spd:rng(1.5,3),col:pick(['#a1887f','#d7ccc8','#fff']),l:45,m:45});
  }
  for(let i=0;i<20;i++){
    G.ptcl.push({t:'s',x,y,vx:rng(-2,2),vy:rng(-2,2),l:40,m:40,col:pick(['#795548','#d7ccc8','#fff9c4']),sz:rng(.3,.8)});
  }
  G.ptcl.push({t:'lbl',x,y:y-2.5,tx:'🐑 MOUTON',col:'#795548',l:55,m:55,sz:1.8});
}

function spawnPass(x1,y1,x2,y2){
  G.ptcl.push({t:'beam',x:x1,y:y1,tx:x2,ty:y2,col:'#00bcd4',w:.8,l:30,m:30});
  G.ptcl.push({t:'ring_expand',x:x2,y:y2,col:'#00bcd4',maxR:6,l:28,m:28});
  for(let i=0;i<14;i++){
    const a=Math.random()*Math.PI*2;
    G.ptcl.push({t:'s',x:x2,y:y2,vx:Math.cos(a)*rng(.5,1.5),vy:Math.sin(a)*rng(.5,1.5),l:35,m:35,col:'#80deea',sz:rng(.2,.5)});
  }
  G.ptcl.push({t:'lbl',x:x2,y:y2-2.5,tx:'✨ PASSE',col:'#00bcd4',l:45,m:45,sz:1.6});
}

function spawnTornade(x,y){
  for(let i=0;i<40;i++){
    const a=i/40*Math.PI*6,r=rng(.5,5)*(1-i/40)+0.5;
    G.ptcl.push({t:'spiral',cx:x,cy:y,ang0:a,rad:r,spd:4,col:pick(['#80cbc4','#e0f2f1','#b2dfdb','#fff']),l:55,m:55});
  }
  G.ptcl.push({t:'ring_expand',x,y,col:'#80cbc4',maxR:9,l:35,m:35});
  G.ptcl.push({t:'ring_expand',x,y,col:'#e0f2f1',maxR:5,l:25,m:25});
  G.ptcl.push({t:'lbl',x,y:y-3,tx:'🌪️ TORNADE',col:'#4db6ac',l:55,m:55,sz:1.8});
}

function spawnSuggest(x,y,tx,ty){
  G.ptcl.push({t:'beam',x,y,tx,ty,col:'#1abc9c',w:.6,l:25,m:25});
  G.ptcl.push({t:'ring_expand',x:tx,y:ty,col:'#1abc9c',maxR:5,l:30,m:30});
  for(let i=0;i<5;i++)G.ptcl.push({t:'spiral',cx:tx,cy:ty,ang0:i/5*Math.PI*2,rad:rng(2,4),spd:2,col:'#aefde8',l:40,m:40});
  G.ptcl.push({t:'lbl',x:tx,y:ty-2.5,tx:'🌀 SUGGESTION',col:'#1abc9c',l:50,m:50,sz:1.5});
}

function spawnCharm(x,y,tx,ty){
  G.ptcl.push({t:'beam',x,y,tx,ty,col:'#e91e63',w:.5,l:22,m:22});
  for(let i=0;i<8;i++)G.ptcl.push({t:'s',x:tx+rng(-2,2),y:ty+rng(-1,1),vx:rng(-.2,.2),vy:rng(-.4,-.1),l:50+i*5,m:60,col:'#f48fb1',sz:rng(.25,.6)});
  G.ptcl.push({t:'ring_expand',x:tx,y:ty,col:'#f48fb1',maxR:6,l:30,m:30});
  G.ptcl.push({t:'lbl',x:tx,y:ty-3,tx:'CHARME',col:'#e91e63',l:50,m:50,sz:1.6});
}

function spawnIce2(ati){
  // Vague de glace sur le demi-terrain adverse
  const startX=ati===0?PCX:0;
  const endX=ati===0?WW:PCX;
  for(let i=0;i<35;i++){
    const ix=startX+Math.random()*(endX-startX);
    const iy=Math.random()*WH;
    const delay=Math.abs(ix-startX)/(WW/2)*40;
    G.ptcl.push({t:'ring_expand',x:ix,y:iy,col:'#4fc3f7',maxR:rng(2,5),l:60+delay,m:80});
    G.ptcl.push({t:'s',x:ix,y:iy,vx:0,vy:0,l:100,m:100,col:'#b3e5fc',sz:rng(.25,.6)});
  }
  G.ptcl.push({t:'lbl',x:PCX,y:PCY-4,tx:'🧊 SOL GLISSANT',col:'#4fc3f7',l:70,m:70,sz:2.0});
}

function spawnAmitie(px,py){
  for(let i=0;i<12;i++){
    const ang=Math.random()*Math.PI*2;const dist=rng(3,15);
    G.ptcl.push({t:'s',x:px+Math.cos(ang)*dist,y:py+Math.sin(ang)*dist,vx:rng(-.2,.2),vy:rng(-.5,-.1),l:70+i*5,m:80,col:'#f48fb1',sz:rng(.3,.7)});
  }
  G.ptcl.push({t:'ring_expand',x:PCX,y:PCY,col:'#ff80ab',maxR:20,l:55,m:55});
  G.ptcl.push({t:'lbl',x:PCX,y:PCY-5,tx:'AMITIE !',col:'#ff80ab',l:70,m:70,sz:2.2});
}

function spawnSoin(tx,ty){
  G.ptcl.push({t:'ring_expand',x:tx,y:ty,col:'#69f0ae',maxR:7,l:40,m:40});
  G.ptcl.push({t:'ring_expand',x:tx,y:ty,col:'#ccff90',maxR:4,l:30,m:30});
  for(let i=0;i<18;i++)G.ptcl.push({t:'s',x:tx,y:ty,vx:rng(-.5,.5),vy:rng(-1.2,-.2),l:50,m:50,col:pick(['#69f0ae','#ccff90','#b9f6ca']),sz:rng(.25,.65)});
  G.ptcl.push({t:'lbl',x:tx,y:ty-3,tx:'💚 SOIN',col:'#69f0ae',l:55,m:55,sz:1.8});
}

function spawnPacif(x,y,tx,ty){
  G.ptcl.push({t:'beam',x,y,tx,ty,col:'#ce93d8',w:.5,l:22,m:22});
  G.ptcl.push({t:'ring_expand',x:tx,y:ty,col:'#ce93d8',maxR:5,l:30,m:30});
  for(let i=0;i<3;i++)G.ptcl.push({t:'lbl',x:tx+rng(-2,2),y:ty-rng(1,3),tx:'😴',col:'#ce93d8',l:55+i*10,m:65,sz:1.4});
  G.ptcl.push({t:'lbl',x:tx,y:ty-3.5,tx:'PACIFICATION',col:'#ba68c8',l:50,m:50,sz:1.5});
}
function spawnTech(x,y,goalX){
  // Dribble magique — traînée violette + spirales + rayon
  G.ptcl.push({t:'beam',x,y,tx:goalX,ty:PCY,col:'#8840e0',w:.7,l:24,m:24});
  G.ptcl.push({t:'ring_expand',x,y,col:'#8840e0',maxR:5,l:25,m:25});
  for(let i=0;i<12;i++){
    const ang=i/12*Math.PI*2;
    G.ptcl.push({t:'spiral',cx:x,cy:y,ang0:ang,rad:rng(1.5,4),spd:2.5,col:pick(['#8840e0','#d090ff','#fff']),l:38,m:38});
  }
  for(let i=0;i<16;i++){
    const a=Math.random()*Math.PI*2,s=rng(.4,1.5);
    G.ptcl.push({t:'s',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,l:32,m:32,col:pick(['#8840e0','#d090ff','#ce93d8']),sz:rng(.2,.6)});
  }
  G.ptcl.push({t:'lbl',x,y:y-2.5,tx:'✨ DRIBBLE',col:'#d090ff',l:48,m:48,sz:1.6});
}
function spawnTackle(x,y){
  for(let i=0;i<14;i++){const a=Math.random()*Math.PI*2;G.ptcl.push({t:'s',x,y,vx:Math.cos(a)*.7,vy:Math.sin(a)*.7,l:26,m:26,col:'#f0c028',sz:rng(.18,.48)});}
}

// ═══════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════
// Injury constants (used by both INJURIES and RENDER sections)
const INJ_LABELS=['','🤕 Légère','🚑 Sérieuse','🆘 Grave'];
const INJ_COLORS=['','#f0c028','#ff7020','#e02030'];
// Cache du terrain pré-rendu (voir _buildPitchCache plus bas). Déclaré ici,
// avant resize(), pour éviter toute zone morte temporelle (TDZ).
let _pitchCache=null, _pitchW=0, _pitchH=0;
let _standsCache=null, _standsW=0, _standsH=0; // déclaré tôt : resize() y touche avant le module tribunes

// ── SPRITE DE LUEUR PRÉ-RENDU (perf particules) ──────────────────────────
// Reconstruire un createRadialGradient par étincelle par frame était le
// principal responsable des chutes de FPS pendant les sorts. On rend le halo
// UNE seule fois par couleur sur un petit canvas hors-écran (64×64) puis on
// se contente d'un drawImage teinté — quasi gratuit et visuellement identique.
const _glowSpriteCache=new Map();
function _getGlowSprite(col){
  let s=_glowSpriteCache.get(col);
  if(s) return s;
  // Étendre les hex courts (#fff → #ffffff) pour que l'ajout d'alpha (+'88')
  // produise un #rrggbbaa valide plutôt qu'une valeur ignorée par le canvas.
  let base=col||'#fff';
  if(/^#[0-9a-fA-F]{3}$/.test(base)){
    base='#'+base[1]+base[1]+base[2]+base[2]+base[3]+base[3];
  }
  const D=64, oc=document.createElement('canvas');
  oc.width=D; oc.height=D;
  const c=oc.getContext('2d');
  const g=c.createRadialGradient(D/2,D/2,0,D/2,D/2,D/2);
  g.addColorStop(0,base);
  g.addColorStop(0.4,base+'88');
  g.addColorStop(1,base+'00');
  c.fillStyle=g;
  c.fillRect(0,0,D,D);
  _glowSpriteCache.set(col,oc);
  return oc;
}

// ── SPRITE DE CORPS PRÉ-RENDU (perf joueurs) ─────────────────────────────
// bodyGrd était recréé pour chaque joueur à chaque frame (~22×60/s = ~1300
// gradients/s) alors qu'il n'y a que 2 couleurs d'équipe et un dégradé radial
// identique. On le rend une fois par couleur à résolution fixe (128px) et on
// le drawImage scalé — le scaling d'un disque radial est invisible à l'œil.
const _bodySpriteCache=new Map();
function _getBodySprite(col){
  let s=_bodySpriteCache.get(col);
  if(s) return s;
  const D=128, oc=document.createElement('canvas');
  oc.width=D; oc.height=D;
  const c=oc.getContext('2d');
  const cx=D/2, cy=D/2, R=D/2;
  // Reproduit l'ancien dégradé : reflet clair en haut-gauche, teinte pleine au bord.
  const g=c.createRadialGradient(cx-R*.3,cy-R*.3,0,cx,cy,R);
  g.addColorStop(0,lighten(col,.35));
  g.addColorStop(1,col);
  c.fillStyle=g;
  c.beginPath();c.arc(cx,cy,R,0,Math.PI*2);c.fill();
  _bodySpriteCache.set(col,oc);
  return oc;
}
function resize(){
  // Gel pendant l'enregistrement vidéo (record.js) : voir commentaire sur
  // window._recLocked dans frame(). On bloque ici la fonction elle-même,
  // pas seulement son appelant dans frame(), pour couvrir aussi le
  // window.addEventListener('resize', resize) de save.js et l'appel de
  // setGameMode() dans data.js.
  if(window._recLocked) return;
  const wrap=document.getElementById('canvas-wrap');
  // ── RÉSOLUTION NATIVE (anti-flou / anti-déformation) ───────────────────
  // Le backing store suit la densité de pixels de l'écran, tandis que la
  // taille CSS reste celle du wrap. Sans ça, en plein écran sur un écran
  // hi-DPI (Retina, mobile), le canvas était étiré depuis une résolution
  // trop basse → image floue. Le ratio d'aspect, lui, est déjà préservé par
  // _s=Math.min(sx,sy) + le centrage (_ox/_oy) : le terrain n'est jamais
  // étiré, il est mis à l'échelle uniformément et lettterboxé.
  // Pendant l'enregistrement, la caméra de diffusion ne recopie qu'une FENÊTRE
  // du canvas (~40% de sa largeur) et l'étire sur 1080 px : on suréchantillonne
  // donc le rendu pour que le recadrage reste net (sinon ×2,7 d'agrandissement
  // = bouillie). Coût accepté car ponctuel, et le canvas est figé (_recLocked)
  // pendant toute la capture.
  const _ss=(window._recSuperSample||1);
  const dpr=Math.min((window.devicePixelRatio||1)*_ss, 3); // borné : au-delà, coût GPU inutile
  const cw=Math.max(1, wrap.offsetWidth), ch=Math.max(1, wrap.offsetHeight);
  cvs.style.width=cw+'px';
  cvs.style.height=ch+'px';
  cvs.width=Math.round(cw*dpr);
  cvs.height=Math.round(ch*dpr);
  // ── POURTOUR DU STADE (en mètres monde) ────────────────────────────────
  // La marge n'est plus un % du canvas (ce qui rétrécissait le terrain quand
  // on agrandissait les tribunes) mais une bande exprimée dans la MÊME unité
  // que le terrain : des mètres. Conséquences :
  //   • le terrain occupe presque tout le cadre (rendu « plein cadre ») ;
  //   • la bande est fine, comme sur une vraie vue aérienne ;
  //   • tribunes, sièges et cages sont automatiquement à l'échelle des
  //     joueurs, puisque tout partage le même facteur _s.
  // WW/WH restent intouchés : gameplay, IA et collisions identiques.
  const bandM=_standBandM();                 // profondeur du pourtour, en mètres
  const totW=WW+bandM*2, totH=WH+bandM*2;    // monde + pourtour
  _s=Math.min(cvs.width/totW, cvs.height/totH);
  _ox=(cvs.width-WW*_s)/2;
  _oy=(cvs.height-WH*_s)/2;
  _pitchCache=null; // le terrain doit être re-préparé à la nouvelle taille
  _standsCache=null; // les gradins dépendent de la taille → à reconstruire
}

// ── Profondeur du pourtour, en MÈTRES ───────────────────────────────────
// Décomposition derrière un but (le côté le plus contraint) :
//   2,4 m de cage + 3,0 m de dégagement + ~4,6 m de tribunes = 10 m.
// Derrière les lignes de touche il n'y a pas de cage : la même bande y laisse
// 2,5 m de dégagement + le reste en tribunes.
function _standBandM(){
  if(typeof stadiumTheme==='function' && stadiumTheme()==='classic') return 0.6;
  if(typeof stadiumStands==='function' && !stadiumStands()) return 0.6;
  const cssW=cvs?(cvs.clientWidth||cvs.width):1000;
  return cssW<560 ? 7.5 : 10.0;  // mobile : bande un peu plus fine
}

// Dégagement (pelouse/piste nue) entre le jeu et la première rangée, en mètres.
// Derrière les buts on ajoute la profondeur de la cage : les tribunes doivent
// commencer APRÈS le filet, jamais le toucher.
const RUNOFF_SIDE = 2.5;   // le long des lignes de touche
const RUNOFF_GOAL = 3.0;   // derrière les buts, EN PLUS des 2,4 m de cage
// Sur mobile la bande totale est plus fine : on resserre les dégagements,
// sinon ils la consommeraient entièrement et les tribunes disparaîtraient.
function _runoffScale(){
  const cssW=cvs?(cvs.clientWidth||cvs.width):1000;
  return cssW<560 ? 0.6 : 1.0;
}
function _goalApronM(){ return 2.4 + RUNOFF_GOAL*_runoffScale(); }
function _runoffM(dir){
  return (dir==='left'||dir==='right') ? _goalApronM() : RUNOFF_SIDE*_runoffScale();
}

// Fraction du canvas occupée par le pourtour (informatif : vignettage, etc.).
function _standRatio(){
  const b=_standBandM();
  if(b<=0.6) return 0;
  if(!cvs || !_s) return 0.06;
  return (b*_s)/cvs.width;
}
// Le pourtour est-il assez profond pour dessiner de vraies tribunes ?
// On raisonne désormais en MÈTRES, pas en % de canvas : une bande de 6 m est
// large (plusieurs rangées de sièges) même si elle ne représente que ~5 % de
// la largeur du canvas. L'ancien seuil `_standRatio()>=0.08` désactivait donc
// les gradins par erreur.
function _standsVisible(){
  const b=_standBandM();
  if(b<=1.5) return false;
  // Ce qui compte, c'est ce qui RESTE une fois le dégagement derrière les buts
  // retiré (le côté le plus contraint) : sinon on annoncerait des tribunes
  // alors qu'il n'y a plus la place d'y loger une seule rangée.
  const usable=(b-_goalApronM())*(_s||0);
  return usable >= 10;
}


// ── Toggle tribunes on/off (persistant) ─────────────────────────────────
// Certains joueurs préfèrent un terrain plein cadre : ce réglage ramène la
// marge à 8px (rendu legacy) sans toucher au thème choisi.
function stadiumStands(){ return window._standsEnabled !== false; }
function setStadiumStands(on){
  window._standsEnabled = !!on;
  try{ localStorage.setItem('footsim_stands', on?'1':'0'); }catch(e){}
  _pitchCache=null; _standsCache=null;
  if(typeof resize==='function') resize();
  if(typeof renderSettings==='function' && document.getElementById('settings-out')) renderSettings();
}
(function _restoreStadiumStands(){
  try{ if(localStorage.getItem('footsim_stands')==='0') window._standsEnabled=false; }catch(e){}
})();

const GRASS_A='#1a5c1a',GRASS_B='#1e6b1e',LINE='rgba(255,255,255,.46)';
// Couleur d'encrage manga (identique à --ink de theme.css) utilisée pour les
// contours des joueurs, afin que le canvas reste cohérent avec le reste de l'UI.
const INK_COL='#12161c';

// ═══════════════════════════════════════════════════════════
// THÈME DE STADE / TERRAIN
// 9 styles sélectionnables (avant-match, réglages, carrière > infra) :
//  - classic   : terrain sobre d'origine, sans tribunes ni panneaux.
//  - modern    : tribunes texturées, panneaux LED, projecteurs.
//  - synthetic : pelouse synthétique (bandes tondues bien droites, vert vif).
//  - snow      : terrain enneigé, lignes assombries pour rester lisibles,
//                + chute de neige/vent en overlay (voir drawSnow()).
//  - greek     : sol en marbre façon Grèce antique, veines grises/or, PAS de
//                pelouse — surface dallée claire.
//  - forest    : clairière très boisée, verts profonds, panneaux bois.
//  - bamboo    : bambouseraie, bandes vert/jaune façon tiges de bambou.
//  - handball  : parquet bois façon salle de handball, lattes claires/foncées.
//  - city      : city-stade urbain, bitume/béton, marquages au sol colorés.
// ═══════════════════════════════════════════════════════════
const STADIUM_THEMES=['classic','modern','synthetic','snow','greek','forest','bamboo','handball','city'];
function stadiumTheme(){
  const t=window._stadiumTheme;
  return STADIUM_THEMES.includes(t)?t:'modern';
}
function setStadiumTheme(t){
  if(!STADIUM_THEMES.includes(t))return;
  window._stadiumTheme=t;
  try{ localStorage.setItem('footsim_stadium', t); }catch(e){}
  _pitchCache=null; _standsCache=null; // force la reconstruction terrain + tribunes
  // Re-render les écrans qui affichent le sélecteur, s'ils sont ouverts.
  if(typeof renderSettings==='function' && document.getElementById('settings-out')) renderSettings();
  if(typeof _renderDirectorInfra==='function' && (document.getElementById('career-director-content')?.innerHTML||'').indexOf('Infrastructures')>=0){
    try{ renderCareerDirectorTab('infra'); }catch(e){}
  }
  if(document.getElementById('prematch-modal')?.classList.contains('on') && typeof showPreMatch==='function'){
    try{ showPreMatch(window._prematchOnStart); }catch(e){}
  }
}
(function _restoreStadiumTheme(){
  try{
    const t=localStorage.getItem('footsim_stadium');
    if(STADIUM_THEMES.includes(t)) window._stadiumTheme=t;
  }catch(e){}
})();

function _stadiumPalette(theme){
  const BASE_BOARDS=['#e63946','#f0c028','#2a9d8f','#457b9d','#ffffff'];
  const BASE_CROWD=['#1c222c','#242b38','#161b24','#2c3444'];
  if(theme==='classic'){
    return { bg:'#0f2a0f', a:'#1c5f1c', b:'#217021', line:LINE, net:'rgba(255,255,255,.82)',
      netFaint:'rgba(255,255,255,.12)', faint:'rgba(255,255,255,.3)',
      stripes:false, snowGround:false, border:false };
  }
  if(theme==='synthetic'){
    return { bg:'#0f2418', a:'#1f9d3c', b:'#24b347', line:'rgba(255,255,255,.5)', net:'rgba(255,255,255,.82)',
      netFaint:'rgba(255,255,255,.12)', faint:'rgba(255,255,255,.3)',
      stripes:true, snowGround:false, border:true,
      stands:{kind:'seats', apron:'#2b2f36', aisle:.30},
      boardCols:BASE_BOARDS, crowdShades:BASE_CROWD, crowdBg:'#0a0e14', floodlight:'rgba(255,241,201,.10)' };
  }
  if(theme==='snow'){
    return { bg:'#c9d6de', a:'#eef3f6', b:'#e6edf1', wornColor:'#4f7a56', line:'rgba(22,32,45,.55)',
      net:'rgba(30,40,55,.78)', netFaint:'rgba(30,40,55,.16)', faint:'rgba(30,40,55,.32)',
      stripes:false, snowGround:true, border:true,
      stands:{kind:'seats', apron:'#dfe8ee', snowy:true, aisle:.22},
      boardCols:['#8ecae6','#ffffff','#219ebc','#adb5bd','#e0f7ff'],
      crowdShades:['#3a4552','#48566a','#2e3742','#55637a'], crowdBg:'#1b232c', floodlight:'rgba(210,230,255,.12)' };
  }
  if(theme==='greek'){
    // Grèce antique : PAS de pelouse — un sol dallé en marbre clair, veiné
    // de gris et d'or, façon péristyle antique. Lignes de jeu tracées en
    // noir/or dessus, panneaux terracotta/or, projecteurs chauds.
    return { bg:'#1c1608', a:'#e8e2d4', b:'#d8d0bc', line:'rgba(30,26,18,.75)',
      net:'rgba(30,26,18,.75)', netFaint:'rgba(30,26,18,.14)', faint:'rgba(30,26,18,.35)',
      stripes:false, snowGround:false, marble:true, veinCol:'rgba(160,140,90,.5)', border:true,
      stands:{kind:'columns', apron:'#cfc6ad', colCol:'#e8e2d4', aisle:0},
      boardCols:['#c9a05a','#e8d9b0','#a8542f','#8c6b3f','#f0e4c0'],
      crowdShades:['#3a2f1e','#4a3c26','#2e2517','#57472c'], crowdBg:'#140f08',
      floodlight:'rgba(255,214,140,.14)' };
  }
  if(theme==='forest'){
    // Clairière très boisée : verts profonds et humides, panneaux façon bois
    // brut, lumière tamisée vert-jaune comme filtrée par les frondaisons.
    return { bg:'#08150c', a:'#0f3d1e', b:'#154d26', line:'rgba(214,232,210,.55)',
      net:'rgba(214,232,210,.75)', netFaint:'rgba(214,232,210,.12)', faint:'rgba(214,232,210,.28)',
      stripes:false, snowGround:false, border:true,
      stands:{kind:'canopy', apron:'#16351d', aisle:0},
      boardCols:['#4b3621','#2e4d24','#6b4a2c','#3a5c2f','#5c4128'],
      crowdShades:['#12200f','#1a2b14','#0c1a0a','#223318'], crowdBg:'#081108',
      floodlight:'rgba(184,224,150,.10)' };
  }
  if(theme==='bamboo'){
    // Bambouseraie : bandes tondues façon tiges alignées, vert vif à jaune
    // tendre, panneaux clairs bois clair/bambou.
    return { bg:'#132312', a:'#3fae4a', b:'#c9d94a', line:'rgba(255,255,255,.55)',
      net:'rgba(255,255,255,.82)', netFaint:'rgba(255,255,255,.12)', faint:'rgba(255,255,255,.3)',
      stripes:true, snowGround:false, border:true,
      stands:{kind:'bamboo', apron:'#24401c', aisle:0},
      boardCols:['#e8e0a8','#8fbf3f','#d9c96a','#4f9a3f','#f2edc8'],
      crowdShades:['#2a3a20','#35472a','#213018','#3e4f2c'], crowdBg:'#101c0e',
      floodlight:'rgba(230,244,180,.12)' };
  }
  if(theme==='handball'){
    // Salle de handball : parquet bois clair/foncé en lattes, lignes de jeu
    // rouge façon vraie salle, panneaux publicitaires classiques indoor.
    return { bg:'#1a1410', a:'#c9975f', b:'#b8804a', line:'rgba(178,34,34,.85)',
      net:'rgba(240,240,240,.85)', netFaint:'rgba(240,240,240,.14)', faint:'rgba(30,60,140,.5)',
      stripes:false, snowGround:false, parquet:true, border:true,
      stands:{kind:'seats', apron:'#8a5a32', indoor:true, aisle:.34},
      boardCols:['#e63946','#1d3557','#f0c028','#ffffff','#2a9d8f'],
      crowdShades:['#241a12','#2e2216','#1c140d','#37291a'], crowdBg:'#120d09',
      floodlight:'rgba(255,244,214,.14)' };
  }
  if(theme==='city'){
    // City-stade urbain : bitume/béton craquelé, marquages au sol défraîchis,
    // grillage et graffitis en panneaux périphériques.
    return { bg:'#15171a', a:'#5a6068', b:'#4c5158', line:'rgba(240,224,90,.7)',
      net:'rgba(200,200,200,.7)', netFaint:'rgba(200,200,200,.1)', faint:'rgba(240,224,90,.28)',
      stripes:false, snowGround:false, city:true, border:true,
      stands:{kind:'fence', apron:'#3a3d42', aisle:0},
      boardCols:['#e63946','#f0c028','#2a9d8f','#8840e0','#ff8a3d'],
      crowdShades:['#202226','#2a2c30','#1a1c1f','#34363a'], crowdBg:'#101113',
      floodlight:'rgba(220,230,255,.10)' };
  }
  // modern (par défaut)
  return { bg:'#0f2a0f', a:'#1c5f1c', b:'#217021', line:LINE, net:'rgba(255,255,255,.82)',
    netFaint:'rgba(255,255,255,.12)', faint:'rgba(255,255,255,.3)',
    stripes:false, snowGround:false, border:true,
    stands:{kind:'seats', apron:'#2b2f36', aisle:.30},
    boardCols:BASE_BOARDS, crowdShades:BASE_CROWD, crowdBg:'#0a0e14', floodlight:'rgba(255,241,201,.10)' };
}

// ═══════════════════════════════════════════════════════════
// TERRAIN PRÉ-RENDU (perf + beauté)
// Le terrain est statique : au lieu de le redessiner à chaque frame (bandes,
// lignes, arcs, filets…), on le peint UNE fois sur un canvas hors-écran puis
// on le recopie d'un seul blit par frame. Gain net de perf, et ça libère le
// budget pour les effets joueurs/ballon. Le cache se reconstruit seulement si
// la taille du canvas change (resize).

function _buildPitchCache(){
  // Ne rien construire tant que le canvas n'a pas de dimensions valides :
  // un canvas 0×0 ferait planter le drawImage ultérieur.
  if(!cvs || cvs.width<2 || cvs.height<2){ _pitchCache=null; return; }
  const oc=document.createElement('canvas');
  oc.width=cvs.width; oc.height=cvs.height;
  const c=oc.getContext('2d');
  const pal=_stadiumPalette(stadiumTheme());
  const LINE=pal.line; // masque le const module-level pour ce build

  // Fond profond
  c.fillStyle=pal.bg;
  c.fillRect(0,0,oc.width,oc.height);

  // ── SURFACE (damier naturel / bandes synthétiques / neige / autres sols) ─
  if(pal.marble){
    // Marbre (Grèce antique) : dallage clair en larges dalles carrées avec
    // léger jointoiement, puis un réseau de veines fines pour casser la
    // platitude — aucune pelouse, aucune texture verte.
    c.fillStyle=pal.a; c.fillRect(wx(0),wy(0),ws(WW)+1,ws(WH)+1);
    const tileN=6, tw=WW/tileN, th=WH/4;
    for(let ix=0; ix<tileN; ix++){
      for(let iy=0; iy<4; iy++){
        if((ix+iy)%2===0){
          c.fillStyle=pal.b;
          c.fillRect(wx(ix*tw), wy(iy*th), ws(tw)+1, ws(th)+1);
        }
      }
    }
    c.save();
    c.strokeStyle=pal.veinCol||'rgba(160,140,90,.5)'; c.lineWidth=ws(.05);
    for(let i=0;i<26;i++){
      let x=rng(0,WW), y=rng(0,WH);
      c.beginPath();c.moveTo(wx(x),wy(y));
      const segs=Math.floor(rng(2,4));
      for(let s=0;s<segs;s++){
        x+=rng(-6,6); y+=rng(-4,4);
        c.lineTo(wx(x),wy(y));
      }
      c.globalAlpha=rng(.4,.9);
      c.stroke();
    }
    c.globalAlpha=1;
    c.restore();
    // Jointoiement des dalles (fines lignes grises entre les carreaux)
    c.save();
    c.strokeStyle='rgba(90,80,60,.25)'; c.lineWidth=ws(.04);
    for(let ix=1; ix<tileN; ix++){ c.beginPath();c.moveTo(wx(ix*tw),wy(0));c.lineTo(wx(ix*tw),wy(WH));c.stroke(); }
    for(let iy=1; iy<4; iy++){ c.beginPath();c.moveTo(wx(0),wy(iy*th));c.lineTo(wx(WW),wy(iy*th));c.stroke(); }
    c.restore();
  } else if(pal.parquet){
    // Parquet (salle de handball) : lattes de bois horizontales, décalées en
    // quinconce comme un vrai plancher de salle, alternance de teintes.
    const rowH=WH/14;
    for(let iy=0; iy<14; iy++){
      const offset = (iy%2===0) ? 0 : WW*0.045;
      const plankW=WW*0.09;
      let x=-offset;
      let k=0;
      while(x<WW){
        c.fillStyle = k%2===0 ? pal.a : pal.b;
        c.fillRect(wx(x), wy(iy*rowH), ws(Math.min(plankW,WW-x))+1, ws(rowH)+1);
        c.strokeStyle='rgba(60,40,20,.25)'; c.lineWidth=ws(.03);
        c.strokeRect(wx(x), wy(iy*rowH), ws(Math.min(plankW,WW-x)), ws(rowH));
        x+=plankW; k++;
      }
    }
  } else if(pal.city){
    // City-stade : bitume/béton gris avec grain fin + quelques fissures et
    // taches d'usure, aucune texture organique.
    c.fillStyle=pal.a; c.fillRect(wx(0),wy(0),ws(WW)+1,ws(WH)+1);
    for(let i=0;i<220;i++){
      c.fillStyle= Math.random()<0.5 ? pal.b : 'rgba(0,0,0,.12)';
      c.globalAlpha=rng(.2,.5);
      const rx=rng(0,WW), ry=rng(0,WH);
      c.fillRect(wx(rx), wy(ry), ws(rng(.3,1)), ws(rng(.3,1)));
    }
    c.globalAlpha=1;
    c.save();
    c.strokeStyle='rgba(0,0,0,.3)'; c.lineWidth=ws(.04);
    for(let i=0;i<6;i++){
      let x=rng(0,WW), y=rng(0,WH);
      c.beginPath();c.moveTo(wx(x),wy(y));
      const segs=Math.floor(rng(3,6));
      for(let s=0;s<segs;s++){ x+=rng(-8,8); y+=rng(-5,5); c.lineTo(wx(x),wy(y)); }
      c.stroke();
    }
    c.restore();
  } else if(pal.stripes){
    // Pelouse synthétique : bandes tondues bien droites façon terrain synthé,
    // plus saturées et régulières qu'une vraie pelouse.
    const stripeCount=12, sw=WW/stripeCount;
    for(let i=0;i<stripeCount;i++){
      c.fillStyle= i%2===0 ? pal.a : pal.b;
      c.fillRect(wx(i*sw), wy(0), ws(sw)+1, ws(WH)+1);
    }
  } else if(pal.snowGround){
    // Terrain enneigé : surface pâle quasi uniforme + quelques plaques
    // d'herbe usée qui perce sous la neige, pour ne pas rester trop plate.
    c.fillStyle=pal.a; c.fillRect(wx(0),wy(0),ws(WW)+1,ws(WH)+1);
    for(let i=0;i<16;i++){
      c.fillStyle=pal.b; c.globalAlpha=.6;
      c.beginPath();c.ellipse(wx(rng(0,WW)),wy(rng(0,WH)),ws(rng(3,7)),ws(rng(1.2,2.6)),rng(0,Math.PI),0,Math.PI*2);c.fill();
      c.globalAlpha=1;
    }
    for(let i=0;i<9;i++){
      c.fillStyle=pal.wornColor; c.globalAlpha=.18;
      c.beginPath();c.ellipse(wx(rng(0,WW)),wy(rng(0,WH)),ws(rng(2,4)),ws(rng(1,2)),rng(0,Math.PI),0,Math.PI*2);c.fill();
      c.globalAlpha=1;
    }
  } else {
    // ── TONTE EN DAMIER (façon stade) ──────────────────────────────────────
    // Alternance de carrés clairs/foncés dans les deux sens plutôt que de
    // simples bandes : rend la pelouse bien plus « vraie ». Teintes douces pour
    // rester subtil et ne pas fatiguer l'œil.
    const cols=10, rows=7;
    const cw=WW/cols, chh=WH/rows;
    for(let ix=0; ix<cols; ix++){
      for(let iy=0; iy<rows; iy++){
        const even=(ix+iy)%2===0;
        c.fillStyle= even ? pal.a : pal.b;
        c.fillRect(wx(ix*cw), wy(iy*chh), ws(cw)+1, ws(chh)+1);
      }
    }
  }
  // Reflet de tonte : léger dégradé vertical qui simule la lumière rasante.
  const lg=c.createLinearGradient(0,wy(0),0,wy(WH));
  lg.addColorStop(0,'rgba(255,255,255,.05)');
  lg.addColorStop(0.5,'rgba(255,255,255,0)');
  lg.addColorStop(1,'rgba(0,0,0,.06)');
  c.fillStyle=lg;
  c.fillRect(wx(0),wy(0),ws(WW),ws(WH));

  // ── LIGNES ─────────────────────────────────────────────────────────────
  c.save();
  c.strokeStyle=LINE; c.lineWidth=ws(.18);
  c.strokeRect(wx(0),wy(0),ws(WW),ws(WH));
  c.beginPath();c.moveTo(wx(PCX),wy(0));c.lineTo(wx(PCX),wy(WH));c.stroke();
  c.beginPath();c.arc(wx(PCX),wy(PCY),ws(7),0,Math.PI*2);c.stroke();
  c.beginPath();c.arc(wx(PCX),wy(PCY),ws(.32),0,Math.PI*2);c.fillStyle=LINE;c.fill();

  [[0,true],[WW,false]].forEach(([gx,left])=>{
    c.strokeStyle=LINE; c.lineWidth=ws(.18);
    c.strokeRect(wx(left?0:WW-PA_W),wy(PCY-PA_H/2),ws(PA_W),ws(PA_H));
    const sbW=4,sbH=14;
    c.strokeRect(wx(left?0:WW-sbW),wy(PCY-sbH/2),ws(sbW),ws(sbH));
    // ── But + filet ──────────────────────────────────────────────────────
    // La cage déborde de 2,4 m derrière la ligne (profondeur réelle d'un but).
    // Le pourtour étant désormais large de plusieurs mètres, elle tient
    // ENTIÈREMENT dans le cadre au lieu d'être rognée par la marge de 8 px.
    // Fond clair sous le filet : sans lui, la cage disparaîtrait sur le gris
    // sombre des tribunes qui commencent juste derrière.
    c.save();
    const gw=2.4,gh=GY2-GY1;
    const gX=left?wx(-gw):wx(WW);
    c.fillStyle='rgba(255,255,255,.13)';
    c.fillRect(gX,wy(GY1),ws(gw),ws(gh));
    c.strokeStyle=pal.net;c.lineWidth=ws(.28);
    c.strokeRect(gX,wy(GY1),ws(gw),ws(gh));
    c.strokeStyle=pal.netFaint;c.lineWidth=ws(.06);
    for(let k=0;k<=3;k++){
      const ny=GY1+(gh/3)*k;
      c.beginPath();c.moveTo(left?wx(-gw):wx(WW),wy(ny));c.lineTo(left?wx(0):wx(WW),wy(ny));c.stroke();
    }
    // Filet vertical aussi (maillage plus riche)
    for(let k=0;k<=4;k++){
      const nx=(left? -gw : WW) + (gw/4)*k;
      c.beginPath();c.moveTo(wx(nx),wy(GY1));c.lineTo(wx(nx),wy(GY2));c.stroke();
    }
    c.restore();
    c.beginPath();c.arc(wx(left?PSX:WW-PSX),wy(PCY),ws(.35),0,Math.PI*2);c.fillStyle=LINE;c.fill();
    c.beginPath();
    c.arc(wx(left?PSX:WW-PSX),wy(PCY),ws(7),
      left?-Math.PI*.55:Math.PI*.45, left?Math.PI*.55:Math.PI*1.55);
    c.strokeStyle=pal.faint;c.stroke();
  });
  // Arcs de corner
  [[0,0,0,Math.PI/2],[WW,0,Math.PI/2,Math.PI],[0,WH,-Math.PI/2,0],[WW,WH,Math.PI,-Math.PI/2]].forEach(([cx,cy,a1,a2])=>{
    c.beginPath();c.arc(wx(cx),wy(cy),ws(1),a1,a2);c.strokeStyle=pal.faint;c.lineWidth=ws(.15);c.stroke();
  });
  c.restore();

  // ── AMBIANCE DE STADE (bordure autour du terrain) ───────────────────────
  // La marge entre le terrain et le bord du canvas (variable selon le ratio
  // d'aspect de l'écran) accueille un panneau publicitaire périphérique façon
  // LED de stade + une texture de foule discrète + des projecteurs dans les
  // coins hauts, pour ancrer la scène dans un vrai stade. Absent en thème
  // "classique" (terrain sobre d'origine, sans décor). Tout est pré-calculé
  // ici, donc gratuit à l'exécution (un seul blit par frame comme le reste).
  if(pal.border) (function drawStadiumBorder(){
    const px0=wx(0), py0=wy(0), px1=wx(WW), py1=wy(WH);
    const leftM=px0, rightM=oc.width-px1, topM=py0, bottomM=oc.height-py1;

    // ── GRADINS ────────────────────────────────────────────────────────────
    // Remplace l'ancienne texture de points aléatoires par de vrais gradins
    // en perspective (voir _buildStandsCache plus bas). Le cache est construit
    // à part puis composité ici, dans le même canvas hors-écran : le coût
    // par frame reste d'un seul blit.
    // Sur mobile la marge est trop fine pour des gradins lisibles : on garde
    // seulement le fond uni + les panneaux LED, qui eux restent nets.
    if(_standsVisible()){
      const st=_buildStandsCache();
      if(st) c.drawImage(st,0,0);
    } else {
      c.fillStyle=pal.crowdBg||'#0a0e14';
      c.fillRect(0,0,leftM,oc.height);
      c.fillRect(px1,0,rightM,oc.height);
      c.fillRect(0,0,oc.width,topM);
      c.fillRect(0,py1,oc.width,bottomM);
    }

    // Panneaux LED publicitaires : fine bande colorée collée au pourtour du
    // terrain (toujours visible même quand la marge est petite).
    // Épaisseur proportionnelle à la marge disponible : avec des tribunes
    // agrandies, une bande figée à 7px paraîtrait collée au sol. On la borne
    // pour qu'elle reste une bande LED et n'empiète pas sur les gradins.
    const _bpx=Math.min(window.devicePixelRatio||1, 2); // cf. _buildStand
    const boardT=Math.max(3*_bpx, Math.min(14*_bpx, Math.min(leftM,topM)*0.22+3*_bpx));
    const drawBoard=(x,y,w,h,horiz)=>{
      if(w<=0||h<=0)return;
      const n=Math.max(1,Math.round((horiz?w:h)/Math.max(26*_bpx, boardT*4)));
      const step=(horiz?w:h)/n;
      for(let i=0;i<n;i++){
        c.fillStyle=pal.boardCols[i%pal.boardCols.length];
        if(horiz) c.fillRect(x+i*step,y,step-1,h);
        else c.fillRect(x,y+i*step,w,step-1);
      }
    };
    // Haut/bas du terrain (bande horizontale juste au-dessus/en dessous des lignes)
    drawBoard(Math.max(0,px0-2), Math.max(0,py0-boardT), (px1-px0)+4, boardT, true);
    drawBoard(Math.max(0,px0-2), py1, (px1-px0)+4, Math.min(boardT,bottomM), true);

    // Projecteurs de stade : lueur discrète depuis les coins hauts (teinte
    // chaude en temps normal, plus froide/bleutée sous la neige).
    c.save();
    c.globalCompositeOperation='lighter';
    [[0,0],[oc.width,0]].forEach(([fx,fy])=>{
      const rad=Math.max(oc.width,oc.height)*.4;
      const fg=c.createRadialGradient(fx,fy,0,fx,fy,rad);
      fg.addColorStop(0,pal.floodlight);
      fg.addColorStop(1,pal.floodlight.replace(/[\d.]+\)$/,'0)'));
      c.fillStyle=fg;c.fillRect(0,0,oc.width,oc.height);
    });
    c.restore();
  })();

  // ── VIGNETTAGE ─────────────────────────────────────────────────────────
  // Assombrit légèrement les bords → profondeur, et l'œil est guidé vers le
  // centre du jeu. Radial doux, peu coûteux car pré-calculé une seule fois.
  const cx0=oc.width/2, cy0=oc.height/2;
  const rad=Math.max(oc.width,oc.height)*0.75;
  // NB : avec les tribunes, le vignettage tomberait pile sur les gradins et
  // annulerait le travail de détail. On l'atténue quand le décor est actif.
  const vgMax=_standsVisible() ? .16 : .28;
  const vg=c.createRadialGradient(cx0,cy0,rad*0.35,cx0,cy0,rad);
  vg.addColorStop(0,'rgba(0,0,0,0)');
  vg.addColorStop(1,'rgba(0,0,0,'+vgMax+')');
  c.fillStyle=vg;
  c.fillRect(0,0,oc.width,oc.height);

  _pitchCache=oc; _pitchW=oc.width; _pitchH=oc.height;
}

// ── NEIGE AMBIANTE (thème "snow") ────────────────────────────────────────
// Chute de neige + vent, dessinée par-dessus le terrain, indépendante du
// moteur de particules du match (donc active même à l'arrêt/en pause).
let _snowFlakes=null;
function _ensureSnowFlakes(){
  if(_snowFlakes) return;
  _snowFlakes=[];
  for(let i=0;i<70;i++){
    _snowFlakes.push({x:rng(0,WW),y:rng(0,WH),r:rng(.15,.45),sp:rng(.5,1.3),
      sway:rng(0,Math.PI*2),swaySpd:rng(.6,1.6)});
  }
}
function drawSnow(rawDt){
  if(stadiumTheme()!=='snow') return;
  _ensureSnowFlakes();
  const WIND=0.7; // dérive latérale constante du vent
  ctx.save();
  _snowFlakes.forEach(f=>{
    f.sway+=f.swaySpd*rawDt;
    f.y+=f.sp*rawDt*9;
    f.x+=(WIND+Math.sin(f.sway)*.35)*rawDt*9;
    if(f.y>WH){ f.y=-1; f.x=rng(0,WW); }
    if(f.x>WW+1) f.x=-1; else if(f.x<-1) f.x=WW+1;
    const gx=wx(f.x), gy=wy(f.y);
    if(!isFinite(gx)||!isFinite(gy))return;
    ctx.globalAlpha=.5+Math.sin(f.sway)*.2;
    ctx.fillStyle='#fff';
    ctx.beginPath();ctx.arc(gx,gy,ws(f.r),0,Math.PI*2);ctx.fill();
  });
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════
// TRIBUNES — gradins en perspective, liés à la simulation
// ═══════════════════════════════════════════════════════════════════════════
// Remplace la texture de points aléatoires de l'ancien crowdBand() par de
// vrais gradins : rangées qui se resserrent vers l'extérieur (perspective),
// sièges alignés, spectateurs présents sur une fraction des sièges seulement
// (les trous font le réalisme). Le nombre de rangées, la présence d'un toit
// et le taux de remplissage sont dérivés de club.stadium_capacity et de
// l'affluence — le joueur VOIT sa progression de carrière.
//
// Tout est pré-calculé dans _standsCache (un seul canvas hors-écran, blitté
// une fois par frame comme le terrain) : coût d'exécution nul. Seule la
// couche "vivante" (ola, explosion de joie sur but) est dessinée par frame.


// ── Profil de stade dérivé de la carrière ───────────────────────────────
// Renvoie {rows, fill, roof, cap} — degré d'équipement du stade.
// Hors carrière (match d'exhibition), on retombe sur un stade moyen.
function _stadiumProfile(){
  let cap=null, rep=55;
  try{
    if(typeof careerV2!=='undefined' && careerV2 && careerV2.club){
      cap=careerV2.club.stadium_capacity;
      rep=careerV2.club.reputation!=null?careerV2.club.reputation:55;
    }
  }catch(e){}
  if(!cap||!isFinite(cap)) cap=12000; // exhibition : stade de milieu de tableau

  // Rangées : échelle logarithmique — 800 places → 2 rangées, 35 000 → 6.
  const rows=Math.max(2, Math.min(6, Math.round(Math.log10(Math.max(cap,500))*2.15-4.0)));
  // Toit : seulement à partir d'un stade déjà sérieux (~R1/D3 et au-dessus).
  const roof=cap>=8000;
  // Remplissage : même formule que l'affluence de save.js:765, bornée pour
  // rester lisible (un stade jamais vide à moins de 20%, jamais 100% plein).
  const fill=Math.max(0.2, Math.min(0.95, 0.25+rep/120));
  return {rows, fill, roof, cap};
}

// ── Couleurs des virages ────────────────────────────────────────────────
// Les tribunes derrière chaque but prennent la teinte de l'équipe qui y joue,
// ce qui personnalise gratuitement chaque affiche.
function _standTint(side, pal){
  try{
    const t=teams[side===0?0:1];
    if(t && t.color) return t.color;
  }catch(e){}
  return pal.crowdBg;
}

// Mélange une couleur hex vers du sombre (les gradins sont dans l'ombre).
function _darken(hex, k){
  const m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex||'');
  if(!m) return 'rgba(20,24,32,1)';
  const r=Math.round(parseInt(m[1],16)*k), g=Math.round(parseInt(m[2],16)*k), b=Math.round(parseInt(m[3],16)*k);
  return `rgb(${r},${g},${b})`;
}

// Éclaircit une couleur hex vers le blanc (inverse de _darken).
function _lighten(hex, k){
  const m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex||'');
  if(!m) return 'rgb(60,70,60)';
  const f=(v)=>Math.round(v+(255-v)*k);
  return `rgb(${f(parseInt(m[1],16))},${f(parseInt(m[2],16))},${f(parseInt(m[3],16))})`;
}

// ── Construction d'une tribune (une face du stade) — VUE DU DESSUS ──────
// Le match est vu au zénith : d'en haut on ne voit PAS des gradins en
// perspective, on voit un damier de sièges à plat, chaque spectateur formant
// un petit point. Tout est dimensionné en MÈTRES puis converti par `sc`
// (pixels par mètre) : les spectateurs sont donc automatiquement à l'échelle
// des joueurs (rayon joueur ≈ 1,1–1,55 m ; tête vue de haut ≈ 0,45 m).
//   (x,y,w,h) = zone du pourtour à remplir, en pixels.
//   dir       = côté du stade ('up','down','left','right').
//   sc        = échelle _s (px/m).
function _buildStand(c, x, y, w, h, dir, prof, pal, tint, sc){
  if(w<2||h<2) return;
  const horiz=(dir==='up'||dir==='down');
  const depth=horiz?h:w;      // profondeur du pourtour (px)
  const span =horiz?w:h;      // longueur le long du terrain (px)
  if(depth<2) return;

  c.save();
  c.beginPath(); c.rect(x,y,w,h); c.clip();

  // Fond : le béton/asphalte qui ceinture le terrain.
  c.fillStyle=pal.crowdBg||'#0a0e14';
  c.fillRect(x,y,w,h);

  // ── Géométrie réelle, en mètres ────────────────────────────────────────
  const M       = (m)=>m*sc;      // mètres → pixels
  // Dégagement : plus profond derrière les buts (il doit contenir la cage).
  const TRACK   = M(_runoffM(dir));
  // ── Échelle des spectateurs ────────────────────────────────────────────
  // Choix ASSUMÉ de lisibilité contre réalisme : un vrai spectateur vu de
  // haut ferait ~0,5 m (≈3 px), soit une poussière illisible qui donnait un
  // aspect « buggé ». On dessine donc des supporters à la taille des joueurs
  // (rayon ≈ 1,1 m contre 1,55 m pour un joueur) et, en contrepartie, on en
  // met beaucoup moins : sièges espacés de 3,2 m. La foule se lit comme une
  // foule, à la même échelle visuelle que le terrain.
  const SEAT    = M(3.2);         // pas entre deux supporters
  const DOT     = M(1.1);         // rayon d'un supporter (≈ celui d'un joueur)
  const standDepth = depth - TRACK;
  if(standDepth < SEAT*0.8){ c.restore(); return; }

  // Bande de dégagement (piste) : couleur donnée par le thème (marbre, neige,
  // sous-bois, bitume…) plutôt qu'un voile blanc universel.
  c.fillStyle=(pal.stands&&pal.stands.apron) || 'rgba(255,255,255,.045)';
  if(dir==='up')        c.fillRect(x, y+h-TRACK, w, TRACK);
  else if(dir==='down') c.fillRect(x, y, w, TRACK);
  else if(dir==='left') c.fillRect(x+w-TRACK, y, TRACK, h);
  else                  c.fillRect(x, y, TRACK, h);

  // Origine des gradins = bord extérieur de la piste, en s'éloignant du terrain.
  const rows=Math.max(1, Math.floor(standDepth/SEAT));
  const cols=Math.max(1, Math.floor(span/SEAT));

  const KIND=(pal.stands&&pal.stands.kind)||'seats';

  // Assise / sol du pourtour, selon le thème.
  const seatBed = KIND==='seats' ? _darken(tint, 0.22) : (pal.crowdBg||'#0a0e14');
  c.fillStyle=seatBed;
  if(dir==='up')        c.fillRect(x, y, w, h-TRACK);
  else if(dir==='down') c.fillRect(x, y+TRACK, w, h-TRACK);
  else if(dir==='left') c.fillRect(x, y, w-TRACK, h);
  else                  c.fillRect(x+TRACK, y, w-TRACK, h);

  // ── Placement d'une cellule du pourtour ────────────────────────────────
  // Convertit (le long du stade, profondeur depuis le terrain) → (px,py),
  // quel que soit le côté. Toutes les décorations de thème passent par là :
  // elles n'ont donc pas à connaître l'orientation.
  const cell=(along, deep)=>{
    if(dir==='up')        return [x+along,  y+h-deep];
    if(dir==='down')      return [x+along,  y+deep];
    if(dir==='left')      return [x+w-deep, y+along];
    return                       [x+deep,   y+along];
  };

  // Parcourt la grille du pourtour (quinconce) et appelle cb(px,py,r,k).
  const eachCell=(step, cb)=>{
    const rows=Math.max(1, Math.floor(standDepth/step));
    const cols=Math.max(1, Math.floor(span/step));
    for(let r=0;r<rows;r++) for(let k=0;k<cols;k++){
      const along=(k+0.5+(r%2)*0.5)*step + rng(-step*0.10, step*0.10);
      if(along>span) continue;
      const deep = TRACK + (r+0.5)*step + rng(-step*0.08, step*0.08);
      const [px,py]=cell(along,deep);
      cb(px,py,r,k);
    }
  };

  // ── Décor du pourtour, propre à chaque thème ───────────────────────────
  if(KIND==='seats'){
    // Tribunes : supporters vus de haut. En salle (handball) la foule est
    // plus dense et les teintes club plus rares (public assis, neutre).
    const indoor=!!pal.stands.indoor;
    // 1) Rangées de sièges : fines bandes alternées pour donner du relief au
    //    gradin (marches), avant même de poser les spectateurs. Ça évite
    //    l'aspect « soupe de points » sur un fond plat.
    const rowStep = SEAT;
    const rowCount = Math.max(1, Math.floor(standDepth/rowStep));
    for(let r=0;r<rowCount;r++){
      const d0 = TRACK + r*rowStep;
      const shade = (r%2===0) ? 'rgba(255,255,255,0.028)' : 'rgba(0,0,0,0.06)';
      c.fillStyle = shade;
      if(dir==='up')        c.fillRect(x, y+h-d0-rowStep, w, rowStep*0.5);
      else if(dir==='down') c.fillRect(x, y+d0, w, rowStep*0.5);
      else if(dir==='left') c.fillRect(x+w-d0-rowStep, y, rowStep*0.5, h);
      else                  c.fillRect(x+d0, y, rowStep*0.5, h);
    }
    // 2) Séparations de tribunes (allées) : quelques lignes sombres le long du
    //    virage, comme les vomitoires/escaliers d'un vrai stade.
    const aisleN = Math.max(2, Math.round(span/M(18)));
    c.fillStyle='rgba(0,0,0,0.22)';
    for(let a=1;a<aisleN;a++){
      const along=(a/aisleN)*span, aw=Math.max(1,DOT*0.5);
      const [ax,ay]=cell(along, TRACK); const [bx,by]=cell(along, TRACK+standDepth);
      c.save(); c.strokeStyle='rgba(0,0,0,0.22)'; c.lineWidth=aw;
      c.beginPath(); c.moveTo(ax,ay); c.lineTo(bx,by); c.stroke(); c.restore();
    }
    // 3) Les spectateurs : disque de base + petit reflet clair pour le volume
    //    (une tête n'est plus un point plat). Des grappes de couleur club
    //    parsèment la foule (écharpes, maillots) pour l'animer.
    eachCell(SEAT, (px,py,r,k)=>{
      if(Math.random()>prof.fill) return;   // siège vide
      // Grappe couleur club (~10%) : plus vif, plus grand.
      const clubCluster = Math.random() < (indoor?0.05:0.12);
      let col;
      if(clubCluster){ col = _lighten(tint, 0.15); }
      else { col = Math.random()<(indoor?0.12:0.22) ? _darken(tint,0.9)
                                                     : pick(pal.crowdShades||['#2c3444']); }
      c.fillStyle = col;
      c.beginPath(); c.arc(px,py,DOT,0,Math.PI*2); c.fill();
      // Reflet : petite calotte claire décalée = volume de la tête/épaules.
      c.fillStyle='rgba(255,255,255,0.14)';
      c.beginPath(); c.arc(px-DOT*0.28, py-DOT*0.28, DOT*0.42, 0, Math.PI*2); c.fill();
    });
    // Neige : les rangées extérieures sont poudrées.
    if(pal.stands.snowy){
      eachCell(SEAT*1.6, (px,py)=>{
        if(Math.random()>0.5) return;
        c.fillStyle='rgba(255,255,255,.5)';
        c.beginPath(); c.arc(px,py,DOT*0.7,0,Math.PI*2); c.fill();
      });
    }
  } else if(KIND==='columns'){
    // Grèce antique : péristyle. Vu du zénith, une colonne est un disque
    // clair posé sur le marbre + son ombre portée. Pas de foule.
    eachCell(M(4.2), (px,py)=>{
      c.fillStyle='rgba(0,0,0,.28)';
      c.beginPath(); c.arc(px+DOT*0.28, py+DOT*0.28, DOT*0.92, 0, Math.PI*2); c.fill();
      c.fillStyle=pal.stands.colCol||'#e8e2d4';
      c.beginPath(); c.arc(px,py,DOT*0.85,0,Math.PI*2); c.fill();
      c.strokeStyle='rgba(120,100,60,.45)'; c.lineWidth=Math.max(1,DOT*0.10);
      c.beginPath(); c.arc(px,py,DOT*0.55,0,Math.PI*2); c.stroke();
    });
  } else if(KIND==='canopy'){
    // Forêt : pas de gradins, le stade est en clairière. On voit la cime des
    // arbres — des disques verts irréguliers, plus clairs au centre.
    eachCell(M(3.6), (px,py)=>{
      const R=DOT*rng(0.9,1.5);
      c.fillStyle=pick(['#12200f','#1a2b14','#0c1a0a','#223318']);
      c.beginPath(); c.arc(px,py,R,0,Math.PI*2); c.fill();
      c.fillStyle='rgba(150,200,120,.16)';
      c.beginPath(); c.arc(px-R*0.22,py-R*0.22,R*0.45,0,Math.PI*2); c.fill();
    });
  } else if(KIND==='bamboo'){
    // Bambouseraie : touffes de tiges vues d'en haut (petits disques clairs
    // groupés) sur un sous-bois sombre.
    eachCell(M(3.0), (px,py)=>{
      const n=2+Math.floor(Math.random()*3);
      for(let i=0;i<n;i++){
        const a=Math.random()*Math.PI*2, d=Math.random()*DOT*0.8;
        c.fillStyle=pick(['#8fbf3f','#c9d94a','#4f9a3f','#6faa35']);
        c.beginPath(); c.arc(px+Math.cos(a)*d, py+Math.sin(a)*d, DOT*rng(0.16,0.28), 0, Math.PI*2); c.fill();
      }
    });
  } else if(KIND==='fence'){
    // City-stade : pas de tribunes, un grillage et du bitume. Le grillage se
    // lit comme un quadrillage fin ; quelques spectateurs debout contre.
    c.strokeStyle='rgba(200,210,220,.18)'; c.lineWidth=Math.max(1,M(0.08));
    const gstep=M(1.6);
    for(let d0=TRACK; d0<depth; d0+=gstep){
      const [ax,ay]=cell(0,d0), [bx,by]=cell(span,d0);
      c.beginPath(); c.moveTo(ax,ay); c.lineTo(bx,by); c.stroke();
    }
    for(let a0=0; a0<span; a0+=gstep){
      const [ax,ay]=cell(a0,TRACK), [bx,by]=cell(a0,depth);
      c.beginPath(); c.moveTo(ax,ay); c.lineTo(bx,by); c.stroke();
    }
    eachCell(SEAT*1.5, (px,py)=>{
      if(Math.random()>prof.fill*0.5) return;
      c.fillStyle = Math.random()<0.3 ? _darken(tint,0.95) : pick(pal.crowdShades||['#2c3444']);
      c.beginPath(); c.arc(px,py,DOT*0.85,0,Math.PI*2); c.fill();
    });
  }

  // ── Escaliers / vomitoires ─────────────────────────────────────────────
  // Allées régulières : d'en haut, ce sont des couloirs vides dans la foule.
  // Une forêt ou un péristyle n'a pas d'escalier : l'opacité vient du thème
  // (`aisle:0` ⇒ aucun tracé).
  const aisleA=(pal.stands&&pal.stands.aisle!=null)?pal.stands.aisle:0.30;
  if(aisleA>0){
  const aisle=Math.max(M(18), span/3);
  c.fillStyle='rgba(0,0,0,'+aisleA+')';
  for(let a=aisle*0.5; a<span; a+=aisle){
    if(horiz) c.fillRect(x+a-M(0.6), (dir==='up'?y:y+TRACK), M(1.2), h-TRACK);
    else      c.fillRect((dir==='left'?x:x+TRACK), y+a-M(0.6), w-TRACK, M(1.2));
  }
  }

  // ── Toit ───────────────────────────────────────────────────────────────
  // Vu du dessus, le toit masque les rangées les plus extérieures : une bande
  // sombre sur le bord extérieur suffit à lire « tribune couverte ».
  if(prof.roof && KIND==='seats' && standDepth > SEAT*1.8){
    const rt=Math.min(standDepth*0.20, M(1.8));
    let bx,by,bw,bh,gx0,gy0,gx1,gy1;
    if(dir==='up')        { bx=x; by=y;        bw=w;  bh=rt; gx0=0;gy0=y;      gx1=0;gy1=y+rt; }
    else if(dir==='down') { bx=x; by=y+h-rt;   bw=w;  bh=rt; gx0=0;gy0=y+h;    gx1=0;gy1=y+h-rt; }
    else if(dir==='left') { bx=x; by=y;        bw=rt; bh=h;  gx0=x;gy0=0;      gx1=x+rt;gy1=0; }
    else                  { bx=x+w-rt; by=y;   bw=rt; bh=h;  gx0=x+w;gy0=0;    gx1=x+w-rt;gy1=0; }
    const rg=c.createLinearGradient(gx0,gy0,gx1,gy1);
    rg.addColorStop(0,'rgba(0,0,0,.72)');
    rg.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=rg; c.fillRect(bx,by,bw,bh);
  }

  c.restore();
}

// ── Construction du cache complet des tribunes ──────────────────────────
function _buildStandsCache(){
  if(!cvs||cvs.width<2||cvs.height<2) return null;
  const prof=_stadiumProfile();
  const pal=_stadiumPalette(stadiumTheme());
  const oc=document.createElement('canvas');
  oc.width=cvs.width; oc.height=cvs.height;
  const c=oc.getContext('2d');

  const px0=wx(0), py0=wy(0), px1=wx(WW), py1=wy(WH);
  const leftM=px0, rightM=oc.width-px1, topM=py0, bottomM=oc.height-py1;

  // Virages (derrière les buts) : teintés aux couleurs des deux équipes.
  _buildStand(c, 0, 0, leftM, oc.height, 'left',  prof, pal, _standTint(0,pal), _s);
  _buildStand(c, px1, 0, rightM, oc.height, 'right', prof, pal, _standTint(1,pal), _s);

  // ── Dégagement derrière les cages ──────────────────────────────────────
  // Les buts débordent de 2,4 m derrière la ligne : on efface les gradins sur
  // cette emprise (+ une marge de respiration) pour que la cage se détache
  // entièrement, comme sur une vraie vue aérienne. Sans ça, les spectateurs
  // seraient dessinés SOUS le filet et la cage deviendrait illisible.
  // Le dégagement derrière les buts est déjà réservé par _runoffM('left'/'right')
  // dans _buildStand : les tribunes commencent après la cage. On repeint ici
  // la bande correspondante en « pelouse d'en-but » pour que la cage se
  // détache nettement (et non sur du béton de tribune).
  const APRON=_goalApronM();
  c.fillStyle=(pal.stands&&pal.stands.apron) || _lighten(pal.crowdBg||'#0a0e14', 0.20);
  c.fillRect(wx(-APRON), 0, ws(APRON), oc.height);
  c.fillRect(wx(WW),     0, ws(APRON), oc.height);
  // Tribunes latérales : neutres (mélange des deux camps). On les teinte d'un
  // gris béton clair plutôt que du fond quasi-noir, sinon les marches et les
  // spectateurs disparaissent complètement dans l'ombre.
  const NEUTRAL='#8a94a6';
  _buildStand(c, px0, 0, px1-px0, topM, 'up',   prof, pal, NEUTRAL, _s);
  _buildStand(c, px0, py1, px1-px0, bottomM, 'down', prof, pal, NEUTRAL, _s);

  _standsCache=oc; _standsW=oc.width; _standsH=oc.height;
  return oc;
}

// ── Couche vivante : ola + explosion de joie sur but ────────────────────
// Dessinée par frame PAR-DESSUS le cache statique. Volontairement légère :
// une poignée de rectangles en `lighter`, pas de recalcul de foule.
let _standsCheer={t:0, dur:0, side:0};
function triggerStandsCheer(side){ _standsCheer={t:performance.now(), dur:900, side:side|0}; }

function drawStandsLive(){
  if(!_standsVisible() || !_standsCache) return;
  const px0=wx(0), py0=wy(0), px1=wx(WW), py1=wy(WH);
  const now=performance.now();
  ctx.save();
  ctx.globalCompositeOperation='lighter';

  // ── OLA ────────────────────────────────────────────────────────────────
  // Un sinus qui balaie horizontalement et module l'alpha de colonnes de
  // tribune. Discret : c'est une respiration, pas un clignotement.
  const wave=(now/1000)*0.55;
  const colW=Math.max(26, (px1-px0)/14);
  for(let x=0;x<ctx.canvas.width;x+=colW){
    const phase=Math.sin(wave - (x/ctx.canvas.width)*Math.PI*3);
    if(phase<0.6) continue;
    const a=(phase-0.6)/0.4*0.07;
    ctx.fillStyle=`rgba(255,255,255,${a.toFixed(3)})`;
    if(py0>6)                   ctx.fillRect(x,0,colW-2,py0);
    if(ctx.canvas.height-py1>6) ctx.fillRect(x,py1,colW-2,ctx.canvas.height-py1);
  }

  // ── EXPLOSION DE JOIE (sur but) ────────────────────────────────────────
  // Flashs blancs aléatoires dans la tribune de l'équipe qui vient de marquer.
  if(_standsCheer.dur){
    const el=now-_standsCheer.t;
    if(el>=_standsCheer.dur){ _standsCheer.dur=0; }
    else{
      const k=1-el/_standsCheer.dur;                 // décroissance
      const side=_standsCheer.side;
      const zx=side===0?0:px1, zw=side===0?px0:(ctx.canvas.width-px1);
      if(zw>4){
        for(let i=0;i<26;i++){
          if(Math.random()>k) continue;
          ctx.fillStyle=`rgba(255,255,255,${(0.5*k).toFixed(3)})`;
          ctx.fillRect(zx+Math.random()*zw, Math.random()*ctx.canvas.height, 2, 2);
        }
      }
    }
  }
  ctx.restore();
}

function drawPitch(){
  // Si le canvas n'a pas encore de taille (page Équipes affichée, canvas masqué,
  // avant un resize…), on ne dessine rien : construire/blitter un canvas 0×0
  // lève une InvalidStateError. On retentera à la frame suivante.
  if(!cvs || cvs.width<2 || cvs.height<2) return;
  // (Re)construit le cache si absent ou si la taille a changé, sinon simple blit.
  if(!_pitchCache || _pitchW!==cvs.width || _pitchH!==cvs.height){
    _buildPitchCache();
  }
  // Sécurité : ne blitter que si le cache est valide et non nul.
  if(_pitchCache && _pitchCache.width>0 && _pitchCache.height>0){
    ctx.drawImage(_pitchCache,0,0);
  }
}

function drawShadow(x,y,r){
  ctx.save();ctx.globalAlpha=.2;
  ctx.fillStyle='#000';
  ctx.beginPath();ctx.ellipse(wx(x),wy(y+r*.7),ws(r*.95),ws(r*.28),0,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function drawPlayer(T,p){
  if(!p||p.red||p.hp<=0)return;
  // Sécurité : ignorer les joueurs avec coordonnées invalides
  if(!isFinite(p.x)||!isFinite(p.y)||p.x==null||p.y==null) return;
  const px=wx(p.x),py=wy(p.y);
  if(!isFinite(px)||!isFinite(py))return;
  // Taille des joueurs adaptée au mode (11v11 = terrain plus grand = joueurs plus petits)
  const r=ws(window.gameMode==='11v11' ? 1.1 : 1.55);
  if(r<=0)return;

  drawShadow(p.x,p.y,1.55);

  // Declare safeBob FIRST before any use
  const bob=Math.sin(p.bobPhase||0)*ws(.12);
  const safeBob=isFinite(bob)?bob:0;
  const runSpd=Math.hypot(p.vx||0,p.vy||0);

  // ── TRAÎNÉE DE VITESSE ─────────────────────────────────────────────────
  // Quand un joueur sprinte, on laisse quelques pastilles fantômes derrière
  // lui (échantillonnées sur ses positions récentes) pour donner une vraie
  // sensation de vitesse. On garde un petit historique par joueur, mis à jour
  // ici. Léger : 5 échantillons max, dessinés seulement au-dessus d'un seuil.
  if(!p._trail) p._trail=[];
  // On n'enregistre que si le joueur bouge assez, et on limite la longueur.
  if(runSpd>2.2){
    p._trail.push({x:px,y:py+safeBob});
    if(p._trail.length>6) p._trail.shift();
  } else if(p._trail.length){
    p._trail.shift(); // se résorbe quand il ralentit
  }
  const SPRINT=window.gameMode==='11v11'?3.4:4.2;
  if(runSpd>SPRINT && p._trail.length>1){
    ctx.save();
    for(let i=0;i<p._trail.length-1;i++){
      const t=p._trail[i];
      const a=(i/p._trail.length)*0.30; // plus ancien = plus transparent
      ctx.globalAlpha=a;
      ctx.fillStyle=T.color;
      ctx.beginPath();ctx.arc(t.x,t.y,r*(0.5+0.5*i/p._trail.length),0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }

  // Aura ring for ball holder
  if(p.hasBall){
    ctx.save();
    // Pulsation douce pour que le porteur soit toujours facile à suivre.
    const pulse=0.5+0.5*Math.sin((performance.now()/1000)*4);
    const r1=r*.5,r2=r*(2.4+pulse*0.5);
    if(r2>r1){
      const grd=ctx.createRadialGradient(px,py,r1,px,py,r2);
      grd.addColorStop(0,T.color+'55');grd.addColorStop(1,T.color+'00');
      ctx.fillStyle=grd;ctx.beginPath();ctx.arc(px,py+safeBob,r2,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=0.55+pulse*0.35;
    ctx.strokeStyle=T.color;ctx.lineWidth=ws(.18);ctx.beginPath();ctx.arc(px,py+safeBob,r*1.7,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  }

  // Shadow / direction arrow when running
  if(runSpd>1.5){
    const n=norm(p.vx,p.vy);
    ctx.save();ctx.globalAlpha=.28;
    ctx.strokeStyle=T.color;ctx.lineWidth=ws(.14);
    ctx.beginPath();ctx.moveTo(px,py+safeBob);ctx.lineTo(px+n.x*ws(1.8),py+safeBob+n.y*ws(1.8));ctx.stroke();
    ctx.restore();
  }

  // Body — sprite pré-rendu (voir _getBodySprite) au lieu d'un gradient par frame.
  if(r>0){
    const spr=_getBodySprite(T.color);
    ctx.drawImage(spr,px-r,py+safeBob-r,r*2,r*2);
  } else {
    ctx.fillStyle=T.color;
    ctx.beginPath();ctx.arc(px,py+safeBob,r,0,Math.PI*2);ctx.fill();
  }
  // Contour encré (cohérence avec la direction artistique manga du reste de
  // l'UI, cf. --ink dans theme.css) + fin liseré clair par-dessus pour le volume.
  ctx.beginPath();ctx.arc(px,py+safeBob,r,0,Math.PI*2);
  ctx.strokeStyle=INK_COL;ctx.lineWidth=ws(.32);ctx.stroke();
  ctx.beginPath();ctx.arc(px,py+safeBob,r-ws(.14),0,Math.PI*2);
  ctx.strokeStyle='rgba(255,255,255,.45)';ctx.lineWidth=ws(.09);ctx.stroke();

  // Stun
  if(p.stunT>0){
    ctx.save();ctx.globalAlpha=.35;
    ctx.beginPath();ctx.arc(px,py+safeBob,r,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.restore();
  }

  // Photo or initials
  if(p.img){
    if(!p._img){p._img=new Image();p._img.src=p.img;}
    if(p._img.complete&&p._img.naturalWidth>0){
      ctx.save();ctx.beginPath();ctx.arc(px,py+safeBob,r*.88,0,Math.PI*2);ctx.clip();
      ctx.drawImage(p._img,px-r*.88,py+safeBob-r*.88,r*1.76,r*1.76);ctx.restore();
    } else drawInitials(px,py+safeBob,r,p.ini);
  } else drawInitials(px,py+safeBob,r,p.ini);

  // Badge de race (non-humains seulement) — pastille circulaire discrète
  if(p.race && p.race!=='human' && typeof raceMeta==='function'){
    const meta=raceMeta(p.race);
    const em=meta.emoji;
    if(em){
      const bx=px+r*0.72, by=py+safeBob-r*0.72; // coin haut-droit
      const br=r*0.52;
      ctx.save();
      // fond de la pastille
      ctx.beginPath();ctx.arc(bx,by,br,0,Math.PI*2);
      ctx.fillStyle='rgba(12,14,20,.82)';ctx.fill();
      ctx.lineWidth=Math.max(0.6,r*0.09);
      ctx.strokeStyle='rgba(255,255,255,.55)';ctx.stroke();
      // emoji centré dans la pastille
      ctx.font=(br*1.35|0)+'px serif';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(em, bx, by+br*0.08);
      ctx.restore();
    }
  }

  // HP bar (above player, more visible)
  const hp=clamp(p.hp,0,100);
  const mp=clamp(p.mp,0,100);
  const barW=r*2.2,barH=ws(.22),barX=px-r*1.1,barY=py+safeBob-r-ws(.42);
  // HP bar
  ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(barX,barY,barW,barH);
  const hc=hp>55?'#18c860':hp>28?'#f08030':'#e02030';
  ctx.fillStyle=hc;ctx.fillRect(barX,barY,barW*(hp/100),barH);
  // MP bar (plus fine, juste sous HP, bleue/violette)
  const mpBarH=ws(.16),mpBarY=barY+barH+ws(.06);
  ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(barX,mpBarY,barW,mpBarH);
  ctx.fillStyle=mp>60?'#8840e0':mp>30?'#5c6bc0':'#3949ab';
  ctx.fillRect(barX,mpBarY,barW*(mp/100),mpBarH);

  // Injury indicator ring
  if(p.injLevel>0){
    const injC=INJ_COLORS[p.injLevel];
    ctx.save();
    ctx.strokeStyle=injC;
    ctx.lineWidth=ws(.18);
    ctx.globalAlpha=.7+.3*Math.sin(Date.now()*.006*(p.injLevel+1));
    ctx.beginPath();ctx.arc(px,py+safeBob,r*1.55,0,Math.PI*2);ctx.stroke();
    ctx.restore();
    // Medical cross above player
    const cx2=px+r*.7,cy2=py+safeBob-r*1.2,cs=ws(.22);
    ctx.save();ctx.globalAlpha=.92;
    ctx.fillStyle=injC;
    ctx.fillRect(cx2-cs*.4,cy2-cs,cs*.8,cs*2);
    ctx.fillRect(cx2-cs,cy2-cs*.4,cs*2,cs*.8);
    ctx.restore();
  }
  // ── Indicateurs de fatigue (masqués si blessé, la blessure prime) ──
  if(p.injLevel>0){}
  else {
    const lowStam=(p.s?.stam??99)<=55;   // 55 inclus
    const exhausted=p.hp<30;
    // Placé BIEN au-dessus du joueur et de la barre d'énergie pour rester visible.
    const iy=py+safeBob-r*2.4;
    const gap=ws(.55);
    // Décale horizontalement si les deux icônes sont présentes.
    let slots=[]; if(lowStam)slots.push('bolt'); if(exhausted)slots.push('drop');
    slots.forEach((kind,idx)=>{
      const ox=(idx-(slots.length-1)/2)*gap;
      const cx=px+ox, cy=iy;
      const cs=ws(.42);
      // Pastille de fond sombre pour trancher sur le terrain / la barre verte
      ctx.save();
      ctx.globalAlpha=.85;
      ctx.fillStyle='rgba(15,20,25,.9)';
      ctx.beginPath();ctx.arc(cx,cy,cs*.95,0,Math.PI*2);ctx.fill();
      ctx.restore();
      if(kind==='bolt'){
        // Éclair jaune — faible endurance de base
        ctx.save();ctx.globalAlpha=1;
        ctx.fillStyle='#ffee00';
        ctx.beginPath();
        ctx.moveTo(cx+cs*.15,cy-cs*.7);
        ctx.lineTo(cx-cs*.45,cy+cs*.1);
        ctx.lineTo(cx-cs*.05,cy+cs*.1);
        ctx.lineTo(cx-cs*.2,cy+cs*.7);
        ctx.lineTo(cx+cs*.5,cy-cs*.15);
        ctx.lineTo(cx+cs*.1,cy-cs*.15);
        ctx.closePath();ctx.fill();
        ctx.strokeStyle='#c79100';ctx.lineWidth=ws(.05);ctx.stroke();
        ctx.restore();
      } else {
        // Goutte orange clignotante — épuisé ce match
        const pulse=.6+.4*Math.sin(Date.now()*.008);
        ctx.save();ctx.globalAlpha=pulse;
        ctx.fillStyle='#ff9800';
        ctx.beginPath();
        ctx.arc(cx,cy+cs*.25,cs*.55,0,Math.PI*2);
        ctx.moveTo(cx-cs*.32,cy+cs*.05);ctx.lineTo(cx,cy-cs*.65);ctx.lineTo(cx+cs*.32,cy+cs*.05);
        ctx.closePath();ctx.fill();
        ctx.globalAlpha=pulse*.8;ctx.fillStyle='#fff3e0';
        ctx.beginPath();ctx.arc(cx-cs*.18,cy+cs*.15,cs*.16,0,Math.PI*2);ctx.fill();
        ctx.restore();
      }
    });
  }

  // ── Spell auras ──────────────────────────────────────────
  const now2=Date.now()*.001;
  // Sol Glissant — glace pulsante bleue + cristaux
  if(p._spdDebuff>0){
    const pulse=.55+.45*Math.sin(now2*4);
    ctx.save();ctx.globalAlpha=.55*pulse;
    ctx.strokeStyle='#4fc3f7';ctx.lineWidth=ws(.22);
    ctx.beginPath();ctx.arc(px,py+safeBob,r*1.9,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='#b3e5fc';ctx.lineWidth=ws(.10);
    ctx.beginPath();ctx.arc(px,py+safeBob,r*1.4,0,Math.PI*2);ctx.stroke();
    // Cristaux fixes autour
    for(let i=0;i<6;i++){
      const a=i/6*Math.PI*2+now2*.5;const cr=r*2.1;
      const ix=px+Math.cos(a)*cr,iy=py+safeBob+Math.sin(a)*cr*.6;
      ctx.fillStyle='#b3e5fc';ctx.beginPath();
      ctx.moveTo(ix,iy-ws(.35));ctx.lineTo(ix+ws(.22),iy+ws(.22));ctx.lineTo(ix-ws(.22),iy+ws(.22));
      ctx.closePath();ctx.fill();
    }
    ctx.restore();
  }
  // Charme — cercles roses orbitants
  if(p._charmed>0){
    const pulse=.6+.4*Math.sin(now2*3.5);
    ctx.save();ctx.globalAlpha=.7*pulse;
    ctx.strokeStyle='#f48fb1';ctx.lineWidth=ws(.20);
    ctx.setLineDash([ws(.4),ws(.4)]);
    ctx.beginPath();ctx.arc(px,py+safeBob,r*2.0,0,Math.PI*2);ctx.stroke();
    ctx.setLineDash([]);
    // Small pink circles orbiting
    for(let i=0;i<3;i++){
      const a=i/3*Math.PI*2+now2*2;const hr=r*1.8;
      const hx=px+Math.cos(a)*hr,hy=py+safeBob+Math.sin(a)*hr*.7;
      ctx.fillStyle='#f48fb1';
      ctx.beginPath();ctx.arc(hx,hy,ws(.35),0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  // Pacification — spirales violettes
  if(p._pacified>0){
    const pulse=.5+.5*Math.sin(now2*2);
    ctx.save();ctx.globalAlpha=.6*pulse;
    ctx.strokeStyle='#ce93d8';ctx.lineWidth=ws(.18);
    ctx.beginPath();ctx.arc(px,py+safeBob,r*1.7,0,Math.PI*2);ctx.stroke();
    // Small dots floating up
    for(let i=0;i<3;i++){
      const phase=((now2*.8+i*.33)%1);
      ctx.fillStyle='#ce93d8';ctx.globalAlpha=.8*(1-phase)*pulse;
      ctx.beginPath();ctx.arc(px+r*(.6+i*.25),py+safeBob-r-phase*ws(3),ws(.22),0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  // Amitié — halo doré chaud + étoiles canvas
  if(p._atkBuff>0){
    const pulse=.4+.6*Math.abs(Math.sin(now2*5));
    ctx.save();ctx.globalAlpha=.5*pulse;
    if(r>0){
      const ag=ctx.createRadialGradient(px,py+safeBob,r,px,py+safeBob,r*2.8);
      ag.addColorStop(0,'#ff80ab80');ag.addColorStop(1,'transparent');
      ctx.fillStyle=ag;ctx.beginPath();ctx.arc(px,py+safeBob,r*2.8,0,Math.PI*2);ctx.fill();
    }
    ctx.strokeStyle='#ff80ab';ctx.lineWidth=ws(.14);
    ctx.beginPath();ctx.arc(px,py+safeBob,r*1.6,0,Math.PI*2);ctx.stroke();
    // Small diamond shapes orbiting
    for(let i=0;i<4;i++){
      const a=i/4*Math.PI*2+now2*3;const sr=r*2.0;
      const sx=px+Math.cos(a)*sr,sy=py+safeBob+Math.sin(a)*sr*.7;
      ctx.fillStyle='#ffd740';ctx.globalAlpha=.9*pulse;
      ctx.save();ctx.translate(sx,sy);ctx.rotate(now2*2);
      const ds=ws(.35);
      ctx.beginPath();ctx.moveTo(0,-ds);ctx.lineTo(ds,0);ctx.lineTo(0,ds);ctx.lineTo(-ds,0);ctx.closePath();
      ctx.fill();ctx.restore();
    }
    ctx.restore();
  }
  // Folie — spirales chaotiques multicolores
  if(p._folie>0){
    const pulse=.5+.5*Math.sin(now2*7);
    ctx.save();ctx.globalAlpha=.65*pulse;
    ctx.strokeStyle='#e040fb';ctx.lineWidth=ws(.20);
    ctx.setLineDash([ws(.3),ws(.5)]);
    ctx.beginPath();ctx.arc(px,py+safeBob,r*1.9,now2*3,now2*3+Math.PI*1.5);ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle='#ea80fc';ctx.lineWidth=ws(.12);
    ctx.beginPath();ctx.arc(px,py+safeBob,r*2.3,-now2*4,-now2*4+Math.PI*1.3);ctx.stroke();
    ctx.restore();
  }
  // Ailes / Sylvestre / Esprit-oiseau — traînée bleue/verte de vitesse
  if(p._aile>0||p._sylvestre>0){
    const col=p._sylvestre>0?'#66bb6a':'#29b6f6';
    const pulse=.4+.6*Math.abs(Math.sin(now2*6));
    ctx.save();ctx.globalAlpha=.55*pulse;
    // Halo de vitesse
    const vg=ctx.createRadialGradient(px,py+safeBob,r*.5,px,py+safeBob,r*2.5);
    if(r>0){
      vg.addColorStop(0,col+'60');vg.addColorStop(1,col+'00');
      ctx.fillStyle=vg;ctx.beginPath();ctx.arc(px,py+safeBob,r*2.5,0,Math.PI*2);ctx.fill();
    }
    // Ailes stylisées (deux arcs)
    ctx.strokeStyle=col;ctx.lineWidth=ws(.18);
    ctx.beginPath();ctx.arc(px-r,py+safeBob,r*1.4,Math.PI*.8,Math.PI*1.8);ctx.stroke();
    ctx.beginPath();ctx.arc(px+r,py+safeBob,r*1.4,-.2*Math.PI,.8*Math.PI);ctx.stroke();
    ctx.restore();
  }
  // Sixième Sens — ring cyan pulsant sur le gardien/défenseurs
  if(p._sixsens>0){
    const pulse=.5+.5*Math.sin(now2*4);
    ctx.save();ctx.globalAlpha=.6*pulse;
    ctx.strokeStyle='#00acc1';ctx.lineWidth=ws(.18);
    ctx.beginPath();ctx.arc(px,py+safeBob,r*1.8,0,Math.PI*2);ctx.stroke();
    // Points cardinaux
    for(let i=0;i<4;i++){
      const a=i/4*Math.PI*2+now2*1.5;
      ctx.fillStyle='#00acc1';ctx.beginPath();
      ctx.arc(px+Math.cos(a)*r*1.8,py+safeBob+Math.sin(a)*r*1.8,ws(.25),0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  
  // ── AURAS SIMPLES : afficher les buffs/debuffs majeurs ──────────────────
  const now3=Date.now()*.001;
  const auraConfig={
    _auraDivine:   {col:'#ffd700',sym:'✨'},
    _aideDivine:   {col:'#87ceeb',sym:'⭐'},
    _aile:         {col:'#29b6f6',sym:'🪶'},
    _sylvestre:    {col:'#66bb6a',sym:'🌿'},
    _esprit:       {col:'#a0a0ff',sym:'👁️'},
    _sixsens:      {col:'#00bcd4',sym:'📡'},
    _dragon:       {col:'#ff6b00',sym:'🐉'},
    _charmed:      {col:'#f48fb1',sym:'💗'},
    _folie:        {col:'#e040fb',sym:'😵'},
    _pacified:     {col:'#ffd700',sym:'😴'},
    _dominated:    {col:'#9c27b0',sym:'🧠'},
    _invis:        {col:'#dcdcdc',sym:'👻'},
    _spdDebuff:    {col:'#00ced1',sym:'❄️'},
    _atkBuff:      {col:'#ff6347',sym:'⚡'},
  };
  
  for(const [flag, config] of Object.entries(auraConfig)){
    if(p[flag]>0){
      const pulse=.5+.5*Math.sin(now3*4);
      ctx.save();ctx.globalAlpha=.6*pulse;
      ctx.strokeStyle=config.col;ctx.lineWidth=ws(.2);
      ctx.beginPath();ctx.arc(px,py+safeBob,r*2.2,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=1;ctx.font=`bold ${ws(0.7)}px Arial`;
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(config.sym,px,py+safeBob-r*2.2);
      ctx.restore();
      break; // une seule aura à la fois pour pas surcharger
    }
  }

  // Yellow card
  if(p.yc===1){ctx.fillStyle='#f0c028';ctx.fillRect(px+r*.55,py+safeBob-r*1.5,ws(.32),ws(.44));}

  // Name tag (bigger, more legible)
  const fontSize=ws(window.gameMode==='11v11'?.38:.52);
  ctx.font=`700 ${fontSize}px Barlow Condensed,sans-serif`;
  ctx.textAlign='center';ctx.textBaseline='top';
  // Drop shadow for readability
  ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillText(p.name,px+ws(.04),py+safeBob+r+ws(.16)+ws(.04));
  ctx.fillStyle='rgba(255,255,255,.9)';ctx.fillText(p.name,px,py+safeBob+r+ws(.16));

  // Position badge (tiny)
  const pfs=ws(.38);
  ctx.font=`700 ${pfs}px Barlow Condensed,sans-serif`;
  ctx.fillStyle=T.color+'cc';
  ctx.fillText(p.pos,px,py+safeBob+r+ws(.16)+fontSize+ws(.06));
}

function drawInitials(px,py,r,ini){
  ctx.fillStyle='rgba(255,255,255,.95)';
  ctx.font=`800 ${r*.9}px Barlow Condensed,sans-serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(ini,px,py);
}

function lighten(hex,amt){
  hex=String(hex||'#000');
  // Étendre les hex courts (#fff → #ffffff) avant de découper les canaux.
  if(/^#[0-9a-fA-F]{3}$/.test(hex)) hex='#'+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3];
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return`rgb(${Math.min(255,r+255*amt)},${Math.min(255,g+255*amt)},${Math.min(255,b+255*amt)})`;
}

function drawBall(){
  const b=G.ball;
  const bx=wx(b.x),by=wy(b.y);
  const r=ws(1.0);
  const spd=Math.hypot(b.vx||0,b.vy||0);
  // ── TRAÎNÉE (renforcée à haute vitesse) ────────────────────────────────
  // Plus le ballon file vite, plus la traînée est marquée et lumineuse, ce
  // qui rend les passes et tirs bien plus lisibles et dynamiques.
  const fast=Math.min(1, spd/6);
  for(let i=1;i<b.trail.length;i++){
    const a=(i/b.trail.length)*(.35+fast*.4);
    const lw=(i/b.trail.length)*ws(.4)*(1+fast*0.8);
    ctx.beginPath();ctx.moveTo(wx(b.trail[i-1].x),wy(b.trail[i-1].y));
    ctx.lineTo(wx(b.trail[i].x),wy(b.trail[i].y));
    // Halo doré léger quand ça va vite, blanc sinon.
    ctx.strokeStyle= fast>0.4 ? `rgba(255,235,150,${a})` : `rgba(255,255,255,${a})`;
    ctx.lineWidth=lw;ctx.lineCap='round';ctx.stroke();
  }
  drawShadow(b.x,b.y,.75);
  // Ball — léger étirement dans le sens du mouvement à grande vitesse.
  const now=Date.now()*.001;
  ctx.save();ctx.translate(bx,by);
  if(fast>0.25 && spd>0.01){
    const ang=Math.atan2(b.vy,b.vx);
    ctx.rotate(ang);
    ctx.scale(1+fast*0.35, 1-fast*0.12); // squash & stretch
    ctx.rotate(-ang);
  }
  ctx.rotate(b.spin*.05+now);
  ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);
  ctx.fillStyle='#f2f2f2';ctx.fill();
  ctx.strokeStyle='#2a2a2a';ctx.lineWidth=ws(.07);ctx.stroke();
  // Panels
  const patches=[[0,-r*.58],[r*.5,-r*.28],[-r*.5,-r*.28],[r*.5,r*.3],[-r*.5,r*.3],[0,r*.55]];
  ctx.fillStyle='#303030';
  patches.forEach(([ox,oy])=>{ctx.beginPath();ctx.arc(ox,oy,ws(.11),0,Math.PI*2);ctx.fill();});
  ctx.restore();
}

function drawParticles(){
  const now=Date.now()*.001;
  G.ptcl.forEach(p=>{
    const a=clamp(p.l/p.m,0,1);
    if(a<=0)return;
    ctx.save();ctx.globalAlpha=a;
    try{
    if(p.t==='s'){
      const sz=ws((p.sz||0.3)*Math.sqrt(a));
      if(sz>0&&isFinite(wx(p.x))&&isFinite(wy(p.y))){
        const gx=wx(p.x), gy=wy(p.y);
        // Lueur additive via sprite pré-rendu (voir _getGlowSprite) : rendu
        // identique à l'ancien gradient mais sans le recréer à chaque frame.
        ctx.globalCompositeOperation='lighter';
        const glowR=sz*2.6;
        const spr=_getGlowSprite(p.col||'#fff');
        ctx.globalAlpha=a*0.55;
        ctx.drawImage(spr,gx-glowR,gy-glowR,glowR*2,glowR*2);
        // Cœur brillant
        ctx.globalAlpha=a;
        ctx.fillStyle=p.col||'#fff';
        ctx.beginPath();ctx.arc(gx,gy,sz,0,Math.PI*2);ctx.fill();
        ctx.globalCompositeOperation='source-over';
      }
    } else if(p.t==='r'){
      const rr=ws(p.r||1);
      if(rr>0&&isFinite(wx(p.x))){
        ctx.globalCompositeOperation='lighter';
        ctx.strokeStyle=p.col||'#fff';ctx.lineWidth=ws(.18)*a;
        ctx.beginPath();ctx.arc(wx(p.x),wy(p.y),rr,0,Math.PI*2);ctx.stroke();
        ctx.globalCompositeOperation='source-over';
      }
    } else if(p.t==='lbl'){
      const fsz=ws(p.sz||1.4);
      if(fsz>=1&&p.tx&&isFinite(wx(p.x))&&isFinite(wy(p.y))){
        const lx=wx(p.x), ly=wy(p.y)-(1-a)*ws(4);
        ctx.font=`900 ${fsz}px Barlow Condensed,sans-serif`;
        ctx.textAlign='center';ctx.textBaseline='middle';
        // Contour sombre pour la lisibilité + léger halo de la couleur.
        ctx.lineWidth=ws(.12);
        ctx.strokeStyle='rgba(0,0,0,.6)';
        ctx.strokeText(p.tx,lx,ly);
        ctx.fillStyle=p.col||'#fff';
        ctx.fillText(p.tx,lx,ly);
      }
    } else if(p.t==='ring_expand'){
      const prog=1-a;const curR=ws(p.maxR||4)*prog;
      if(curR>0&&isFinite(wx(p.x))){
        ctx.globalCompositeOperation='lighter';
        ctx.strokeStyle=p.col||'#fff';ctx.lineWidth=ws(.3)*(1-prog);
        ctx.globalAlpha=a*0.9;
        ctx.beginPath();ctx.arc(wx(p.x),wy(p.y),curR,0,Math.PI*2);ctx.stroke();
        ctx.globalCompositeOperation='source-over';
      }
    } else if(p.t==='beam'){
      const bx1=wx(p.x),by1=wy(p.y),bx2=wx(p.tx),by2=wy(p.ty);
      if(isFinite(bx1)&&isFinite(bx2)&&(Math.abs(bx2-bx1)+Math.abs(by2-by1))>0){
        const grd=ctx.createLinearGradient(bx1,by1,bx2,by2);
        grd.addColorStop(0,(p.col||'#fff')+'ff');
        grd.addColorStop(.5,(p.col||'#fff')+'cc');
        grd.addColorStop(1,(p.col||'#fff')+'00');
        ctx.strokeStyle=grd;ctx.lineWidth=ws(p.w||.5)*a;
        ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(bx1,by1);ctx.lineTo(bx2,by2);ctx.stroke();
      }
    } else if(p.t==='spiral'){
      const ang=(p.ang0||0)+(1-a)*(p.spd||1)*Math.PI*4;
      const rad=ws((p.rad||2)*(a*.5+.5));
      const sx=wx(p.cx||0)+Math.cos(ang)*rad,sy=wy(p.cy||0)+Math.sin(ang)*rad;
      if(isFinite(sx)&&rad>0){
        const psz=Math.max(.5,ws(.3)*a);
        ctx.globalCompositeOperation='lighter';
        const glow=ctx.createRadialGradient(sx,sy,0,sx,sy,psz*2.4);
        glow.addColorStop(0,(p.col||'#fff'));
        glow.addColorStop(1,(p.col||'#fff')+'00');
        ctx.globalAlpha=a*0.6;ctx.fillStyle=glow;
        ctx.beginPath();ctx.arc(sx,sy,psz*2.4,0,Math.PI*2);ctx.fill();
        ctx.globalAlpha=a;ctx.fillStyle=p.col||'#fff';
        ctx.beginPath();ctx.arc(sx,sy,psz,0,Math.PI*2);ctx.fill();
        ctx.globalCompositeOperation='source-over';
      }
    } else if(p.t==='confetti'){
      const gx=wx(p.x), gy=wy(p.y);
      if(isFinite(gx)&&isFinite(gy)){
        const rot=(p.rot0||0)+(p.m-p.l)*(p.spin||.2);
        const cw=ws(p.w||.5), ch=ws(p.h||.25);
        ctx.translate(gx,gy);ctx.rotate(rot);
        ctx.fillStyle=p.col||'#fff';
        ctx.fillRect(-cw/2,-ch/2,cw,ch);
      }
    } else if(p.t==='speedline'){
      const gx=wx(p.x), gy=wy(p.y);
      if(isFinite(gx)&&isFinite(gy)){
        const ang=p.ang||0;
        const inner=ws(p.inner||3), outer=inner+ws(p.len||20);
        const x1=gx+Math.cos(ang)*inner, y1=gy+Math.sin(ang)*inner;
        const x2=gx+Math.cos(ang)*outer, y2=gy+Math.sin(ang)*outer;
        ctx.globalCompositeOperation='lighter';
        ctx.strokeStyle=p.col||'#fff';ctx.lineWidth=ws(p.lw||.3)*a;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
        ctx.globalCompositeOperation='source-over';
      }
    } else if(p.t==='heart'){
      // Pink circle (safe fallback - no emoji)
      const rr=ws((p.sz||.8)*.4)*a;
      if(rr>0&&isFinite(wx(p.x))){
        ctx.fillStyle=p.col||'#f48fb1';
        ctx.beginPath();ctx.arc(wx(p.x),wy(p.y)-(1-a)*ws(6),rr,0,Math.PI*2);ctx.fill();
      }
    } else if(p.t==='lightning'){
      const lx1=wx(p.x),ly1=wy(p.y),lx2=wx(p.tx||p.x),ly2=wy(p.ty||p.y);
      if(isFinite(lx1)&&isFinite(lx2)){
        ctx.strokeStyle=p.col||'#fff';ctx.lineWidth=ws(.28)*a;ctx.lineCap='round';
        ctx.shadowColor=p.col||'#fff';ctx.shadowBlur=ws(1.5)*a;
        ctx.beginPath();ctx.moveTo(lx1,ly1);
        for(let i=1;i<5;i++){
          const t=i/5;
          ctx.lineTo(lx1+(lx2-lx1)*t+(Math.random()-.5)*ws(2)*(1-Math.abs(t-.5)*2),
                     ly1+(ly2-ly1)*t+(Math.random()-.5)*ws(2)*(1-Math.abs(t-.5)*2));
        }
        ctx.lineTo(lx2,ly2);ctx.stroke();
        ctx.shadowBlur=0;ctx.shadowColor='transparent';
      }
    }
    }catch(e){/* silently skip bad particles */}
    ctx.restore();
  });
}

function drawFlash(){
  if(G.flash<=0)return;
  ctx.save();ctx.globalAlpha=G.flash*.2;
  ctx.fillStyle=G.flashCol;ctx.fillRect(0,0,cvs.width,cvs.height);
  ctx.restore();
}

// ── ÉCLAIRAGE DYNAMIQUE DU BALLON ────────────────────────────────────────
// Halo chaud qui suit le ballon en permanence (pas seulement le porteur),
// comme un projecteur de stade discret qui accompagne l'action. S'agrandit
// légèrement quand le ballon va vite (tir, dégagement) pour souligner les
// temps forts sans gêner la lisibilité du jeu.
function drawBallLight(){
  const b=G.ball;
  if(!b)return;
  const bx=wx(b.x), by=wy(b.y);
  if(!isFinite(bx)||!isFinite(by))return;
  const spd=Math.hypot(b.vx||0,b.vy||0);
  const r=ws(9)*(1+Math.min(spd/9,0.55));
  if(r<=0)return;
  ctx.save();
  ctx.globalCompositeOperation='lighter';
  ctx.globalAlpha=.08+Math.min(spd/40,.05);
  const grd=ctx.createRadialGradient(bx,by,0,bx,by,r);
  grd.addColorStop(0,'#fff6d8');
  grd.addColorStop(.55,'#ffe19a');
  grd.addColorStop(1,'rgba(255,225,154,0)');
  ctx.fillStyle=grd;
  ctx.beginPath();ctx.arc(bx,by,r,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function drawGlow(){
  const own=ownerP();
  if(!own||!G.running)return;
  const r=ws(15);
  if(r<=0)return;
  ctx.save();ctx.globalAlpha=.055;
  const grd=ctx.createRadialGradient(wx(own.x),wy(own.y),0,wx(own.x),wy(own.y),r);
  grd.addColorStop(0,teams[G.atkTi].color);grd.addColorStop(1,'transparent');
  ctx.fillStyle=grd;ctx.fillRect(0,0,cvs.width,cvs.height);
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════
// INJURIES
// ═══════════════════════════════════════════════════════════

function injurePlayer(ti,p,fromContact){
  if(!p||p.injLevel>=3||p.injT>0)return;
  // Une blessure de FATIGUE / aléatoire (non-contact) reste légère à modérée :
  // elle ne peut PAS devenir grave (niveau 3 = sortie auto). Seuls les vrais
  // chocs (fautes, tacles) peuvent causer une blessure grave.
  const maxLvl=fromContact?3:2;
  const newLvl=Math.min(maxLvl, fromContact?Math.min(3,p.injLevel+(Math.random()<0.35?2:1)):p.injLevel+1);
  p.injLevel=newLvl;
  p.injT=180;
  G._injuryCount=(G._injuryCount||0)+1; // alimente le calcul du temps additionnel
  const msg=`${INJ_LABELS[newLvl]} — ${p.name} blessé !`;
  logEvent(msg,INJ_COLORS[newLvl]);
  spawnTackle(p.x,p.y);  // reuse tackle particles for injury effect
  if(newLvl===3){
    logEvent(`❗ ${p.name} doit sortir !`,'#e02030');
    const freeBi=teams[ti].bench.findIndex(b=>b.onBench&&(b.injLevel||0)<2&&!b.subbedOut);
    const pi=teams[ti].players.indexOf(p);
    if(freeBi>=0&&pi>=0){
      pendingSubs.push({ti,pi,bi:freeBi});
    } else {
      logEvent(`Aucun remplaçant disponible pour ${p.name} !`,'#e02030');
    }
  }
  renderInjuryPanel();
}

let pendingSubs=[];
function processPendingSubs(){
  while(pendingSubs.length){
    const{ti,pi,bi}=pendingSubs.shift();
    const p=teams[ti]?.players[pi];
    const b=teams[ti]?.bench[bi];
    if(p&&b&&b.onBench&&(b.injLevel||0)<2&&!b.subbedOut&&p.injLevel>=3)doSub(ti,pi,bi,'bench');
  }
}

// ── BLESSURE DE GARDIEN SUR GROS SORT DE TIR ─────────────────────────
// Quand un sort de tir puissant (>50 de puissance) rentre, il y a une petite
// chance que le gardien qui l'encaisse soit blessé, et une chance TRÈS TRÈS
// faible que la blessure soit grave. Le risque monte avec la puissance du
// sort et le tir de l'attaquant, et descend avec la résistance et
// l'endurance du gardien.
function maybeInjureGKOnBigShot(dti,gk,sp,shooter){
  if(!gk||!sp||!(sp.pow>=50))return;
  if(gk.injLevel>=3||gk.injT>0)return; // déjà gravement blessé / encore sonné
  const shSht=(shooter&&shooter.s&&shooter.s.sht)||50;
  const gkRes=(gk.s&&gk.s.res)||50;
  const gkStam=(gk.s&&gk.s.stam)||50;
  // Excès de puissance au-dessus du seuil de 50 (0 → ~1 pour pow 50→90).
  // À exactement 50 (Séisme, Tir Licorne, Tir Céleste), overPow=0 : seule la
  // chance plancher (très faible) s'applique — cohérent avec "faible chance".
  const overPow=Math.min(1,(sp.pow-50)/40);
  // Le tir de l'attaquant amplifie le choc encaissé par le gardien.
  const shooterFactor=0.6+shSht/99*0.8; // ~0.6 à 1.4
  // Résistance + endurance du gardien protègent contre la blessure.
  const gkDefFactor=Math.max(0.15,1-(gkRes*0.55+gkStam*0.45)/99*0.88);
  // Chance de blessure (légère/sérieuse) : reste faible même dans le pire cas (~10%).
  const injChance=Math.min(0.10,0.015+overPow*0.10)*shooterFactor*gkDefFactor;
  if(Math.random()>=injChance)return;
  // Une fois la blessure déclenchée : chance TRÈS TRÈS faible qu'elle soit grave (~5% max).
  const severeChance=Math.min(0.05,overPow*0.06)*shooterFactor*gkDefFactor;
  const severe=Math.random()<severeChance;
  const wasLevel=gk.injLevel||0;
  if(severe){
    gk.injLevel=3;gk.injT=180;
    logEvent(`🚨 ${gk.name} est GRIÈVEMENT blessé en encaissant ${sp.n} !`,'#e02030');
    spawnTackle(gk.x,gk.y);
    const freeBi=teams[dti].bench.findIndex(b=>b.onBench&&(b.injLevel||0)<2&&!b.subbedOut);
    const pi=teams[dti].players.indexOf(gk);
    if(freeBi>=0&&pi>=0){pendingSubs.push({ti:dti,pi,bi:freeBi});}
    else{logEvent(`Aucun remplaçant disponible pour ${gk.name} !`,'#e02030');}
  }else{
    const newLvl=Math.min(2,wasLevel+1);
    gk.injLevel=newLvl;gk.injT=180;
    logEvent(`🤕 ${gk.name} — ${INJ_LABELS[newLvl]} en encaissant ${sp.n} !`,INJ_COLORS[newLvl]);
    spawnTackle(gk.x,gk.y);
  }
  renderInjuryPanel();
}

// ── GARDIEN DE FORTUNE ────────────────────────────────────────────────
// Si LE gardien titulaire (pos GB) doit sortir en cours de match (blessure
// grave, expulsion, ou toute autre raison passant par doSub) et qu'aucun
// vrai gardien n'est disponible pour le remplacer, le joueur qui entre
// prend les gants au pied levé — mais avec un malus, car ce n'est pas son
// poste habituel et il n'a pas les réflexes/technique d'un gardien.
function applyEmergencyGKMalus(p){
  if(!p||p._emergencyGK)return; // déjà en gardien de fortune
  p._origPos=p.pos;
  p._origStatsGK={def:p.s.def,tec:p.s.tec};
  p.pos='GB';
  p.s.def=Math.max(12,Math.round(p.s.def*0.55));
  p.s.tec=Math.max(12,Math.round(p.s.tec*0.80));
  p._emergencyGK=true;
}
function revertEmergencyGKMalus(p){
  if(!p||!p._emergencyGK)return;
  if(p._origStatsGK){p.s.def=p._origStatsGK.def;p.s.tec=p._origStatsGK.tec;}
  if(p._origPos)p.pos=p._origPos;
  delete p._origPos;delete p._origStatsGK;delete p._emergencyGK;
}
// Point d'entrée commun utilisé par TOUTE substitution qui peut concerner le
// gardien : remplacement forcé (blessure), changement au banc à la mi-temps
// ou avant match, réserviste qui rentre... Que ce soit automatique ou fait
// à la main par le joueur, la règle est la même : hors pré-match, si celui
// qui part était gardien et que celui qui arrive n'en est pas un, il prend
// les gants avec le malus. Celui qui sort retrouve son poste d'origine s'il
// jouait lui-même en gardien de fortune.
function _handleGKMalusOnSwap(outgoing,incoming,preMatch){
  if(!outgoing||!incoming||outgoing.pos!=='GB'||preMatch)return;
  if(incoming.pos!=='GB'){
    applyEmergencyGKMalus(incoming);
    logEvent(`🧤⚠️ ${incoming.name} n'est pas gardien de formation — il prend les gants avec un malus !`,'#f0c028');
  }
  if(outgoing._emergencyGK)revertEmergencyGKMalus(outgoing);
}

function doSub(ti,pi,bi,source='bench'){
  const arr=source==='bench'?teams[ti].bench:null;
  if(!arr)return;
  const incoming=arr[bi];
  const outgoing=teams[ti].players[pi];
  if(!incoming||!outgoing)return;

  // ── Limite de 3 changements en 11v11 (sauf pré-match) ──────────────
  const preMatch=_isPreMatch();
  if(window.gameMode==='11v11' && !preMatch){
    if(!canSub11v11(ti)){
      logEvent(`❌ ${teams[ti].name} a déjà utilisé ses 3 changements !`,'#e02030');
      return;
    }
    doSub11v11(ti); // incrémenter le compteur
    logEvent(`🔄 Changement ${G_11V11.subs_used[ti]}/3 — ${incoming.name} remplace ${outgoing.name}`,teams[ti].color);
  }

  incoming.x=outgoing.x;incoming.y=outgoing.y;
  incoming.vx=0;incoming.vy=0;incoming.tx=outgoing.x;incoming.ty=outgoing.y;
  incoming.onBench=false;incoming.subbedOut=false;
  incoming.stunT=0;incoming.tackleCool=0;incoming.runT=0;incoming.runCool=0;
  incoming._spdDebuff=0;incoming._charmed=0;incoming._atkBuff=0;incoming._pacified=0;
  incoming._invis=0;incoming._folie=0;incoming._aile=0;incoming._sixsens=0;incoming._sylvestre=0;incoming._flee=0;
  outgoing.onBench=true;outgoing.hasBall=false;
  outgoing.subbedOut=!preMatch;
  if(G.owner===outgoing.id)freeB();
  outgoing.x=-10;outgoing.y=PCY;
  teams[ti].players[pi]=incoming;
  arr[bi]=outgoing;
  _handleGKMalusOnSwap(outgoing,incoming,preMatch);
  if(window.gameMode!=='11v11'){
    logEvent(preMatch?`🔧 ${incoming.name} entre à la place de ${outgoing.name} (compo)`:`🔄 ${incoming.name} remplace ${outgoing.name}`,teams[ti].color);
  }
  renderInjuryPanel();
  if(document.getElementById('htmodal').classList.contains('on'))renderHtTeams();
  _refreshPrematchIfOpen();
}
// Recalcule et réaffiche l'OVR, les pronostics et la compo du pré-match en
// direct après un changement, si l'écran de pré-match est ouvert.
function _refreshPrematchIfOpen(){
  const pm=document.getElementById('prematch-modal');
  if(pm&&pm.classList.contains('on')){
    const activeTab=['match','compo','prono','tac'].find(t=>{
      const p=document.getElementById('pm-panel-'+t);return p&&p.style.display!=='none';
    })||'match';
    try{ showPreMatch(window._prematchOnStart); pmTab(activeTab); }catch(e){ console.error('refresh prematch:',e); }
  }
}
// Vrai tant que le match n'a jamais démarré (préparation de la composition).
function _isPreMatch(){
  return G.minute===0 && !G.running && G.phase!=='END' && (G._everStarted!==true);
}

function renderInjuryPanel(){
  const panel=document.getElementById('inj-panel');if(!panel)return;
  const injured=[];
  teams.forEach((T,ti)=>{
    T.players.forEach((p,pi)=>{
      if(p.injLevel>0)injured.push({T,ti,p,pi,kind:'inj'});
      else if(p.hp<30)injured.push({T,ti,p,pi,kind:'tired'});
      else if((p.s?.stam??99)<=55)injured.push({T,ti,p,pi,kind:'lowstam'});
    });
  });
  if(!injured.length){panel.style.display='none';return;}
  panel.style.display='block';
  const hasInj=injured.some(x=>x.kind==='inj');
  const hasTired=injured.some(x=>x.kind==='tired');
  const hasLow=injured.some(x=>x.kind==='lowstam');
  const parts=[]; if(hasInj)parts.push('🚑 Blessures'); if(hasTired)parts.push('💧 Épuisement'); if(hasLow)parts.push('⚡ Endurance faible');
  const title=parts.join(' / ');
  panel.innerHTML=`
    <div class="log-title" style="margin-bottom:4px">${title}</div>
    ${injured.map(({T,ti,p,pi,kind})=>{
      const freeBi=teams[ti].bench.findIndex(b=>b.onBench&&(b.injLevel||0)<2&&!b.subbedOut);
      const canSub=freeBi>=0;
      const col=kind==='inj'?INJ_COLORS[p.injLevel]:kind==='tired'?'#ff9800':'#fdd835';
      const label=kind==='inj'?INJ_LABELS[p.injLevel]:kind==='tired'?'Épuisé '+Math.round(p.hp)+'%':'Endu '+(p.s?.stam??'?');
      const emoji=kind==='tired'?'💧 ':kind==='lowstam'?'⚡ ':'';
      return `<div style="display:flex;align-items:center;gap:5px;padding:4px 5px;background:${col}18;border:1px solid ${col}44;border-radius:5px;margin-bottom:3px">
        <div style="width:6px;height:6px;border-radius:50%;background:${T.color};flex-shrink:0"></div>
        <span style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;flex:1">${emoji}${p.name}</span>
        <span style="font-size:9px;color:${col};font-weight:700">${label}</span>
        ${canSub?`<button class="btn" style="padding:2px 6px;font-size:9px;border-color:${col}66;color:${col}" onclick="openSubModal(${ti},${pi})">🔄</button>`:''}
      </div>`;
    }).join('')}
  `;
}

let subModal_ti=-1,subModal_pi=-1;
function openSubModal(ti,pi){
  subModal_ti=ti;subModal_pi=pi;
  const T=teams[ti];const p=T.players[pi];
  const avail=T.bench.map((b,bi)=>({b,bi})).filter(({b})=>b.onBench&&(b.injLevel||0)<2&&!b.subbedOut);
  if(!avail.length){logEvent('Aucun remplaçant disponible !','#e02030');return;}
  document.getElementById('subm-content').innerHTML=`
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:12px;color:var(--muted);margin-bottom:8px">
      Remplacer <b style="color:#fff">${p.name}</b> <span style="color:${INJ_COLORS[p.injLevel]}">(${INJ_LABELS[p.injLevel]||'blessé'})</span> par :</div>
    ${avail.map(({b,bi})=>`
      <div class="prow" onclick="confirmSub(${ti},${pi},${bi})" style="cursor:pointer">
        <div class="av" style="width:24px;height:24px;border-color:${T.color}50;background:${T.color}22;flex-shrink:0">
          <span style="font-size:8px;font-weight:700;color:${T.color}">${b.ini}</span>
        </div>
        <div class="pi"><div class="pn">${b.name}</div><div class="pp">${b.pos}</div></div>
        <span style="font-size:9px;color:var(--green)">✓ Dispo</span>
      </div>`).join('')}
  `;
  document.getElementById('sub-modal').classList.add('on');
}
function confirmSub(ti,pi,bi){
  doSub(ti,pi,bi,'bench');
  document.getElementById('sub-modal').classList.remove('on');
}
function closeSubModal(){document.getElementById('sub-modal').classList.remove('on');}

// ═══════════════════════════════════════════════════════════
// MAIN LOOP
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// GIF EXPORT — enregistre la mi-temps en cours et l'exporte en GIF
// ═══════════════════════════════════════════════════════════
let _gifRec={active:false,frames:[],lastCap:0,interval:90,maxFrames:260,startHalf:null,offCv:null,offCx:null};
let _gifEncMod=null; // cached dynamic import of the gifenc library
let _gifArmNext=false;
function _gifPanelHTML(showArm){
  if(_gifRec.active){
    return `<div style="background:rgba(224,32,48,.12);border:1px solid var(--red);border-radius:8px;padding:7px 10px;margin-bottom:10px;font-size:10px;color:var(--red);text-align:center">🔴 Enregistrement GIF en cours (${_gifRec.frames.length} images) — l'export se lance automatiquement à la fin de la période.</div>`;
  }
  if(_gifRec.frames.length>0){
    return `<button class="btn btng" style="width:100%;justify-content:center;font-size:11px;margin-bottom:10px" onclick="exportGif()">📥 Télécharger le GIF de cette période (${_gifRec.frames.length} images)</button>`;
  }
  if(showArm){
    return `<label style="display:flex;align-items:center;gap:6px;font-size:10px;color:var(--muted);margin-bottom:10px;cursor:pointer;justify-content:center">
      <input type="checkbox" id="gifArmNext" ${_gifArmNext?'checked':''} onchange="_gifArmNext=this.checked" style="accent-color:var(--gold)">
      🎬 Enregistrer la période suivante en GIF
    </label>`;
  }
  return `<div style="font-size:9px;color:var(--muted);text-align:center;margin-bottom:10px">Aucun enregistrement GIF effectué pour ce match.</div>`;
}
function _gifArmIfNeeded(){
  if(_gifArmNext && !_gifRec.active) startGifRecord();
}
function _gifEnsureOffscreen(){
  const w=260,h=Math.round(260*((cvs.height||720)/(cvs.width||1280)));
  if(_gifRec.offCv && _gifRec.offCv.width===w && _gifRec.offCv.height===h) return;
  _gifRec.offCv=document.createElement('canvas');
  _gifRec.offCv.width=w;_gifRec.offCv.height=h;
  _gifRec.offCx=_gifRec.offCv.getContext('2d');
}
function toggleGifRecord(){ _gifRec.active?stopGifRecord(true):startGifRecord(); }
function startGifRecord(){
  if(G.phase==='END'){alert('Le match est terminé — lance une nouvelle mi-temps pour enregistrer.');return;}
  _gifEnsureOffscreen();
  // Intervalle porté de 90 à 110 ms : chaque capture déclenche un getImageData
  // synchrone (lecture GPU→CPU coûteuse) qui bloque le thread et provoque des
  // à-coups. Un poil moins de captures = enregistrement nettement plus fluide,
  // pour un GIF au rendu quasi identique (~9 fps au lieu de ~11).
  _gifRec.active=true;_gifRec.frames=[];_gifRec.lastCap=0;_gifRec.interval=110;_gifRec.maxFrames=240;
  _gifRec.startHalf=G.half;
  const btn=document.getElementById('gifBtn');
  if(btn){btn.textContent='⏹ Arrêter & exporter';btn.style.background='rgba(224,32,48,.25)';btn.style.borderColor='var(--red)';}
  const st=document.getElementById('gifStatus');if(st)st.textContent='● REC 0';
}
function _gifTruncName(n,max){
  n=String(n||'');
  return n.length>max ? n.slice(0,max-1)+'…' : n;
}
function _gifDrawOverlay(cx,W,H){
  const barH=Math.max(15,Math.round(H*0.11));
  cx.save();
  cx.fillStyle='rgba(5,14,26,0.78)';
  cx.fillRect(0,0,W,barH);
  const fontSz=Math.max(9,Math.round(barH*0.46));
  cx.font=`bold ${fontSz}px Arial, sans-serif`;
  cx.textBaseline='middle';
  const s0=(G.scores&&G.scores[0])||0, s1=(G.scores&&G.scores[1])||0;
  const minute=G.minute||0;
  const n0=_gifTruncName(teams[0]&&teams[0].name||'A',7);
  const n1=_gifTruncName(teams[1]&&teams[1].name||'B',7);
  const col0=(teams[0]&&teams[0].color)||'#e02030';
  const col1=(teams[1]&&teams[1].color)||'#1878e8';
  cx.textAlign='left';
  cx.fillStyle=col0;
  cx.fillText(`${n0} ${s0}`, 5, barH/2+1);
  cx.textAlign='right';
  cx.fillStyle=col1;
  cx.fillText(`${s1} ${n1}`, W-5, barH/2+1);
  cx.textAlign='center';
  cx.fillStyle='#fff';
  cx.fillText(`${minute}'`, W/2, barH/2+1);
  cx.restore();
}
function _gifCaptureFrame(ts){
  if(!_gifRec.active||!G.running)return;
  if(ts-_gifRec.lastCap<_gifRec.interval)return;
  _gifRec.lastCap=ts;
  _gifEnsureOffscreen();
  const W=_gifRec.offCv.width,H=_gifRec.offCv.height,cx=_gifRec.offCx;
  if(!cvs||cvs.width<2||cvs.height<2||W<2||H<2)return; // source/cible non prêtes
  cx.drawImage(cvs,0,0,W,H);
  _gifDrawOverlay(cx,W,H);
  _gifRec.frames.push(cx.getImageData(0,0,W,H));
  const st=document.getElementById('gifStatus');if(st)st.textContent='● REC '+_gifRec.frames.length;
  if(_gifRec.frames.length>_gifRec.maxFrames){
    _gifRec.frames=_gifRec.frames.filter((_,i)=>i%2===0);
    _gifRec.interval*=2;
  }
}
function stopGifRecord(autoExport){
  if(!_gifRec.active)return;
  _gifRec.active=false;
  const btn=document.getElementById('gifBtn');
  if(btn){btn.textContent='🎬 Enregistrer la mi-temps en GIF';btn.style.background='';btn.style.borderColor='';}
  const st=document.getElementById('gifStatus');if(st)st.textContent='';
  if(autoExport&&_gifRec.frames.length>2)exportGif();
}
async function _gifLoadEncoder(){
  if(_gifEncMod) return _gifEncMod;
  // Try a few CDNs serving the library's actual prebuilt ESM file directly
  // (no on-the-fly bundling/transform step, which is more failure-prone than
  // esm.sh's transform pipeline — some networks/extensions also block esm.sh).
  const urls=[
    'https://unpkg.com/gifenc@1.0.3/dist/gifenc.esm.js',
    'https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js',
    'https://esm.sh/gifenc@1.0.3'
  ];
  let lastErr=null;
  for(const u of urls){
    try{ _gifEncMod=await import(/* webpackIgnore: true */ u); return _gifEncMod; }
    catch(err){ lastErr=err; console.warn('GIF encoder: échec de chargement depuis',u,err); }
  }
  throw lastErr;
}
async function exportGif(){
  if(!_gifRec.frames.length){alert('Aucune image enregistrée pour le moment.');return;}
  const wrap=document.getElementById('gif-progress-wrap'),bar=document.getElementById('gif-progress-bar'),lbl=document.getElementById('gif-progress-lbl');
  wrap.style.display='block';bar.style.width='0%';lbl.textContent="Chargement de l'encodeur…";
  let mod;
  try{ mod=await _gifLoadEncoder(); }
  catch(err){
    lbl.textContent="Erreur : impossible de charger l'encodeur GIF (connexion internet requise pour cette étape). Réessaie.";
    console.error(err);
    setTimeout(()=>{wrap.style.display='none';},4000);
    return;
  }
  const {GIFEncoder,quantize,applyPalette}=mod;
  const gif=GIFEncoder();
  const w=_gifRec.offCv.width,h=_gifRec.offCv.height;
  const frames=_gifRec.frames;
  const total=frames.length;
  const delay=Math.max(60,_gifRec.interval);
  let i=0;
  lbl.textContent='Génération du GIF… 0%';
  function step(){
    const t0=performance.now();
    // Process frames in small time-boxed batches so the UI (and progress bar) stays responsive.
    while(i<total && performance.now()-t0<35){
      const data=frames[i].data;
      const palette=quantize(data,128);
      const index=applyPalette(data,palette);
      gif.writeFrame(index,w,h,{palette,delay});
      i++;
    }
    const pct=Math.round((i/total)*100);
    bar.style.width=pct+'%';lbl.textContent='Génération du GIF… '+pct+'%';
    if(i<total){ setTimeout(step,0); } else finish();
  }
  function finish(){
    gif.finish();
    const blob=new Blob([gif.bytes()],{type:'image/gif'});
    const url=URL.createObjectURL(blob);
    const n0=(teams[0]&&teams[0].name||'EquA').replace(/\s+/g,'_');
    const n1=(teams[1]&&teams[1].name||'EquB').replace(/\s+/g,'_');
    const a=document.createElement('a');
    a.href=url;a.download=`mitemps_${n0}_vs_${n1}_h${_gifRec.startHalf||1}.gif`;
    document.body.appendChild(a);a.click();a.remove();
    lbl.textContent='✓ GIF téléchargé !';bar.style.width='100%';
    setTimeout(()=>{wrap.style.display='none';},2200);
    _gifRec.frames=[];
  }
  step();
}

// ── AFFICHAGE HORLOGE + BADGE TEMPS ADDITIONNEL ─────────────────────────
// Au-delà de 45'/90', l'horloge affiche "45+2'" (style TV) au lieu de "47'".
function _updateClockDisplay(){
  const el=document.getElementById('hclock'); if(!el) return;
  let txt=G.minute+"'";
  if(G.half===1 && G.minute>=45) txt='45+'+(G.minute-45)+"'";
  else if(G.half===2 && G.minute>=90) txt='90+'+(G.minute-90)+"'";
  else if(G.half===3 && G.minute>=105) txt='105+'+(G.minute-105)+"'";
  else if(G.half===4 && G.minute>=120) txt='120+'+(G.minute-120)+"'";
  el.textContent=txt;
}
// Petit badge "+N" façon 4e arbitre, affiché à l'entrée du temps additionnel.
function _showAddedTimeBadge(mins){
  let el=document.getElementById('added-time-badge');
  if(!el){
    el=document.createElement('div');
    el.id='added-time-badge';
    el.style.cssText='position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:40;'
      +'background:#f0c028;color:#1a1a1a;font-weight:800;font-family:Barlow Condensed,sans-serif;'
      +'font-size:16px;padding:3px 12px;border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,.5);'
      +'letter-spacing:1px;pointer-events:none;opacity:0;transition:opacity .3s';
    const wrap=document.getElementById('canvas-wrap');
    (wrap||document.body).appendChild(el);
  }
  el.textContent='+'+mins+' MIN';
  el.style.display='block';
  requestAnimationFrame(()=>{el.style.opacity='1';});
}
function _hideAddedTimeBadge(){
  const el=document.getElementById('added-time-badge');
  if(el){ el.style.opacity='0'; setTimeout(()=>{if(el)el.style.display='none';},350); }
}

let _resizeCheckT=0;
function frame(ts){
  raf=requestAnimationFrame(frame);
  const rawDt=Math.min((ts-lastTs)/1000,.05);lastTs=ts;
  const dt=rawDt*speedMult;
  // Bouton de secours "reprendre" visible seulement quand le match est en pause
  // de période (mi-temps / prolongation) et non en train de jouer.
  const rescueBtn=document.getElementById('resume-rescue');
  if(rescueBtn){const showR=(G.phase==='HALFTIME'&&!G.running);rescueBtn.style.display=showR?'inline-flex':'none';}

  // Resize check — lire offsetWidth/offsetHeight force un reflow de layout
  // synchrone : le faire à chaque frame (60×/s) était un coût inutile. On ne
  // vérifie que ~4×/s, ce qui reste largement assez réactif pour un resize.
  _resizeCheckT=(_resizeCheckT||0)+rawDt;
  if(_resizeCheckT>=0.25){
    _resizeCheckT=0;
    const wrap=document.getElementById('canvas-wrap');
    // Pendant un enregistrement (record.js), on gèle volontairement la taille
    // du canvas : un resize en cours d'enregistrement changerait la résolution
    // de la vidéo capturée par MediaRecorder et la corromprait.
    if(wrap && !window._recLocked && (cvs.width!==wrap.offsetWidth||cvs.height!==wrap.offsetHeight))resize();
  }

  if(G.running&&G.phase!=='HALFTIME'&&G.phase!=='END'){
    G.minTick+=rawDt*speedMult;
    if(G.minTick>=SEC_PER_MIN){
      G.minTick=0;G.minute++;
      // Coach IA de l'équipe adverse : réévalue mentalité/changements chaque
      // minute simulée (ne touche qu'aux équipes non-humaines).
      try{ if(typeof managerAiTick==='function') managerAiTick(); }catch(e){ console.error('managerAiTick:',e); }
      // Affichage horloge : au-delà de 45/90, on montre "45+2'" façon TV.
      _updateClockDisplay();
      // ── TEMPS ADDITIONNEL ────────────────────────────────────────────────
      // À la 1re fois qu'on atteint 45' (mi-temps) ou 90' (fin), on calcule un
      // temps additionnel réaliste plutôt que de couper net. Sources classiques
      // d'arrêts de jeu : buts, blessures, cartons. On borne à 1..6 minutes.
      const computeAdded=()=>{
        const goals=(G.scores?.[0]||0)+(G.scores?.[1]||0);
        const injuries=(G._injuryCount||0);
        const cards=((G.fouls?.[0]||0)+(G.fouls?.[1]||0));
        // Fourchette élargie à +1..+15 : chaque événement (but, blessure, faute)
        // pèse plus lourd, et une part aléatoire simule les autres pertes de
        // temps (célébrations, VAR, remplacements…). Un match calme reste bas
        // (~2-3'), un match hachu par les événements peut grimper très haut.
        let m = 1 + goals*0.9 + injuries*1.6 + cards*0.35 + Math.random()*2.5;
        return Math.max(1, Math.min(15, Math.round(m)));
      };
      if(G.half===1){
        if(G.minute>=45 && G._addedH1==null){
          G._addedH1=computeAdded();
          logEvent(`⏱ ${G._addedH1} min de temps additionnel`,'#f0c028');
          _showAddedTimeBadge(G._addedH1);
        }
        if(G.minute>=45+(G._addedH1||0)){
          G.half=2;G.running=false;
          // ── Remise de l'horloge à 45' ──────────────────────────────────
          // Le temps additionnel de la 1re période NE se reporte PAS sur la
          // seconde : dans un vrai match, 45+5 est suivi d'une reprise à 45',
          // pas à 50'. Sans cette remise, G.minute restait à 50 et la 2e
          // mi-temps, qui s'arrête à 90+add, ne durait plus que 40 minutes.
          // On enregistre au passage la durée réelle jouée en 1re période
          // (utile pour les stats et l'affichage).
          G._h1EndMinute=G.minute;
          G.minute=45;
          G.minTick=0;
          G._firstHalfKickoffTi=G._kickoffTi??G.atkTi;
          logEvent('⏸ Mi-temps !','#f0c028');
          G.phase='HALFTIME';
          G._halfLog=G.log.slice();
          document.getElementById('hphase').textContent='MI-TEMPS';
          _hideAddedTimeBadge();
          if(_gifRec.active)stopGifRecord(true);
          setTimeout(()=>{try{openHalftime();}catch(e){console.error('openHalftime failed:',e);document.getElementById('htmodal')?.classList.add('on');}},600/speedMult);
        } else if(G.minute<45){
          updateStats();
          renderInjuryPanel();
        }
      } else if(G.half===2){
        if(G.minute>=90 && G._addedH2==null){
          G._addedH2=computeAdded();
          logEvent(`⏱ ${G._addedH2} min de temps additionnel`,'#f0c028');
          _showAddedTimeBadge(G._addedH2);
        }
        if(G.minute>=90+(G._addedH2||0)){
          _hideAddedTimeBadge();
          onFinalWhistle();
        } else if(G.minute<90){
          updateStats();
          renderInjuryPanel();
        } else {
          updateStats(); // pendant le temps additionnel, on continue de rafraîchir
        }
      } else {
        // Prolongations (half 3/4) : géré plus bas, pas de temps additionnel ici.
        updateStats();
        renderInjuryPanel();
      }
    }
    G.aiTick+=rawDt*speedMult;
    if(G.aiTick>=AI_INTERVAL){G.aiTick=0;aiDecide(dt);}
    physStep(dt,rawDt);
    processPendingSubs();
    _concertTick(rawDt);
  }
  // Extra time handling (outside minTick block — checked every frame when running)
  if(G.running){
    if(G.half===3&&G.minute>=105){
      G.half=4;G.running=false;
      logEvent('⏸ Fin de la 1ère prolongation !','#f0c028');
      G.phase='HALFTIME';
      document.getElementById('hphase').textContent='PAUSE PROLONG.';
      // Ouvrir le panneau mi-temps entre les deux prolongations
      setTimeout(()=>{
        _restituerAideDivine(3);
        openHalftime(false,'prolong2');
      },600/speedMult);
    } else if(G.half===4&&G.minute>=120){
      onFinalWhistle();
    }
  }
  // Otherwise: total freeze — pre-kickoff, paused, celebrating a goal, half-time, end.
  // Players were placed by placeKickoff() and stay perfectly still until the match starts.

  // Draw
  ctx.clearRect(0,0,cvs.width,cvs.height);
  const sh=_shakeOffset();
  const zm=_zoomState();
  // Le ZOOM (caméra) s'applique à TOUTE la scène, terrain compris, pour un
  // vrai effet de rapprochement. La SECOUSSE ne s'applique qu'à la couche
  // dynamique (pas au terrain) pour éviter les bords vides.
  const zooming = !!zm;
  if(zooming){
    ctx.save();
    ctx.translate(zm.cx, zm.cy);
    ctx.scale(zm.scale, zm.scale);
    ctx.translate(-zm.cx, -zm.cy);
  }
  drawPitch();
  drawStandsLive(); // ola + explosion de joie, par-dessus les gradins statiques
  const shaking = (sh.x||sh.y);
  if(shaking){ ctx.save(); ctx.translate(sh.x, sh.y); }
  drawBallLight();
  drawGlow();
  teams.forEach(T=>T.players.forEach(p=>{if(p)drawPlayer(T,p);}));
  drawBall();
  drawParticles();
  if(shaking) ctx.restore();
  if(zooming) ctx.restore();
  drawGoalFlash(); // flash plein écran, hors transformation
  drawFlash();
  drawSnow(rawDt);
  _gifCaptureFrame(ts);
}

// ═══════════════════════════════════════════════════════════
// MATCH CONTROL
// ═══════════════════════════════════════════════════════════
function placeKickoff(atkTi){
  G.atkTi=atkTi;
  G._kickoffTi=atkTi; // remember for halftime second-half kickoff logic
  freeB();
  G.ball.x=PCX;G.ball.y=PCY;G.ball.vx=0;G.ball.vy=0;G.ball.trail=[];G.ball.spin=0;
  teams.forEach((T,ti)=>T.players.forEach((p,pi)=>{
    const b=formBase(ti,pi);
    // Clamp strictly to own half at kickoff (team0=left, team1=right)
    const ownMin=ti===0?0.5:PCX+0.4;
    const ownMax=ti===0?PCX-0.4:WW-0.5;
    p.x=clamp(b.x+(Math.random()-.5)*0.8,ownMin,ownMax);
    p.y=clamp(b.y+(Math.random()-.5)*0.8,0.5,WH-0.5);
    p.vx=0;p.vy=0;p.tx=p.x;p.ty=p.y;p.hasBall=false;
    // Cancel any in-progress off-the-ball run from before the restart
    p.runT=0;p.runCool=1+Math.random()*2;
  }));
}

function resetMatch(){
  if(_gifRec.active)stopGifRecord(false);
  _gifRec.frames=[];
  G.tacMode=[null,null];
  G.gegenT=[0,0];
  G.gkCoolT=0;
  try{ if(typeof resetManagerAi==='function') resetManagerAi(); }catch(e){}
  showTacBtns(false);
  document.getElementById('prematch-modal')?.classList.remove('on');
  G.running=false;G._paused=false;G._celebrating=false;G._everStarted=false;
  G.minute=0;G.half=1;G.scores=[0,0];G.shots=[0,0];G.tackles=[0,0];G.corners=[0,0];G.throwins=[0,0];G.fouls=[0,0];
  G._addedH1=null;G._addedH2=null;G._injuryCount=0;_hideAddedTimeBadge();
  G.possT=[0,0];G.ptcl=[];G.phase='KICKOFF';G.phTick=0;G.minTick=0;G.aiTick=0;G.flash=0;G.log=[];
  G.leagueMode=false;G.penaltyWinner=undefined;G._kickoffTi=Math.random()<.5?0:1;G._firstHalfKickoffTi=G._kickoffTi;
  G._customScore=[0,0];G._singleHalf=false;
  G._lastPasser=[null,null]; G.matchEvents=[]; G._kickoffBuild=undefined;
  teams.forEach(T=>{
    const resetP=(p,bench=false)=>{
      p.hp=100;p.mp=100;p.yc=0;p.red=false;p.stunT=0;p.hasBall=false;
      p.mG=0;p.mSh=0;p.mTk=0;p.mSp=0;p.mA=0;p._img=null;
      p.injLevel=0;p.injT=0;p.subbedOut=false;p._auraDivine=0;p._auraDivineActive=false;p._aideDivine=[];p._missNextMatch=false;
      // Clear spell buffs/debuffs
      p._spdDebuff=0;p._charmed=0;p._atkBuff=0;p._pacified=0;p._invis=0;p._folie=0;p._aile=0;p._sixsens=0;p._sylvestre=0;
      p._concertActive=false;p._concertTimer=0;p._concertBuffs=[];
      // Un nouveau match repart de la vraie composition : plus de gardien de fortune.
      if(p._emergencyGK)revertEmergencyGKMalus(p);
      if(bench){p.onBench=true;p.x=-10;p.y=PCY;p.vx=0;p.vy=0;}
    };
    T.players.forEach(p=>resetP(p,false));
    T.bench.forEach(p=>resetP(p,true));
    // reserves: just reset stats, they never go on field
    if(T.reserves)T.reserves.forEach(p=>{p.hp=100;p.mp=100;p.injLevel=0;});
    // Régénérer moral caché (_hm) et forme cachée (_fm) à chaque match
    [...(T.players||[]),...(T.bench||[]),...(T.reserves||[])].forEach(p=>{
      if(p){
        const bell=()=>Math.round(Math.max(-10,Math.min(10,(Math.random()+Math.random()-1)*10)));
        p._hm=bell(); p._fm=bell();
      }
    });
  });
  // Appliquer les postes selon la formation (après que players soient réinitialisés)
  applyFormationRoles(0); applyFormationRoles(1);
  // (Le placement des joueurs se fait une seule fois plus bas, juste avant
  // updateStats — inutile d'appeler placeKickoff deux fois.)
  document.getElementById('hs0').textContent='0';document.getElementById('hs1').textContent='0';
  document.getElementById('hclock').textContent="0'";document.getElementById('hphase').textContent="COUP D'ENVOI";
  document.getElementById('mbtn').textContent='▶ Démarrer';
  document.getElementById('logbox').innerHTML='';
  logEvent("Prêt pour le coup d'envoi",'#18c860');
  // Random kickoff team for fairness (no team always starts with the ball).
  placeKickoff(Math.random()<.5?0:1);updateStats();
}

let _lastNav='setup'; // track where we came from before match

function navBack(){
  if(G.running){G.running=false;G._paused=true;const b=document.getElementById('mbtn');if(b)b.textContent='▶ Reprendre';}
  document.getElementById('prematch-modal')?.classList.remove('on');
  if(G.careerMode){G.careerMode=false;if(window._careerFixRef){window._careerFixRef=null;window._careerOppClub=null;}}
  if(G.careerCupMode){G.careerCupMode=false;window._careerCupRef=null;window._careerCupKey=null;window._careerIsHome=null;window._careerOppClub=null;}
  nav(_lastNav||'setup');
}

function navMatch(){
  _lastNav='setup';
  nav('match');
  // If game hasn't started yet (not running, not paused, not mid-game), show prematch
  if(!G.running&&!G._paused&&G.phase!=='END'){
    syncHUD();renderTB(0);renderTB(1);
    showPreMatch();
  }
}

function handleMatchBtn(){
  // If already running or paused mid-game, just toggle pause
  if(G.running||G._paused){toggleMatch();return;}
  // Bloqué à la mi-temps / avant prolongation / avant tirs au but : ré-ouvrir la
  // fenêtre de reprise (le score et le déroulé du match sont conservés).
  if(G.phase==='HALFTIME'){
    let mode='halftime';
    if(G.half===4)mode='prolong2'; else if(G.half>=3)mode='prolong1';
    else if(G.half===2&&G.minute>=90)mode='penalties';
    try{openHalftime(false,mode);}catch(e){console.error(e);document.getElementById('htmodal')?.classList.add('on');}
    return;
  }
  // Ensure match page is visible
  nav('match');
  // After a match ends, reset first
  if(G.phase==='END'){resetMatch();}
  syncHUD();renderTB(0);renderTB(1);
  showPreMatch();
}

// Reprise directe de la 2e période sans repasser par la fenêtre (secours).
function forceResumeMatch(){
  document.getElementById('htmodal')?.classList.remove('on');
  document.getElementById('prematch-modal')?.classList.remove('on');
  if(G.phase==='HALFTIME'){
    if(G.half>=3){ // prolongations
      G.running=true;G._paused=false;setPhase('KICKOFF');
      try{_triggerAuraDivine();_triggerConcert();}catch(e){}
    } else {
      resumeSecondHalf();
    }
  } else if(!G.running){
    G.running=true;G._paused=false;
  }
  const b=document.getElementById('mbtn');if(b)b.textContent='⏸ Pause';
}

function toggleMatch(){
  if(G.running){G.running=false;G._paused=true;document.getElementById('mbtn').textContent='▶ Reprendre';}
  else{
    if(G.phase==='END'){resetMatch();return;}
    G.running=true;G._paused=false;G._everStarted=true;document.getElementById('mbtn').textContent='⏸ Pause';
    _gifArmIfNeeded(); // démarre l'enregistrement GIF si coché avant le coup d'envoi
    if(G.minute===0&&!teams.some(T=>T.players.some(p=>p&&p._concertActive)))_triggerConcert();
    renderInjuryPanel(); // afficher d'emblée blessés / épuisés / faible endurance
  }
}
function setSpd(v){speedMult=parseInt(v);document.getElementById('spdv').textContent='×'+v;}

function updateStats(){
  const t=G.possT[0]+G.possT[1]||1;
  const p0=Math.round(G.possT[0]/t*100);
  document.getElementById('pos0').textContent=p0+'%';
  document.getElementById('pos1').textContent=(100-p0)+'%';
  document.getElementById('posbar').style.width=p0+'%';
  document.getElementById('posbar').style.background=teams[0].color;
  [['sh','shots'],['tk','tackles'],['co','corners'],['fo','fouls']].forEach(([k,key])=>{
    [0,1].forEach(i=>{const el=document.getElementById(k+i);if(el)el.textContent=G[key][i];});
  });
}

function endMatch(){
  // Reset effets temporaires (dragon, etc.)
  teams.forEach(t=>{
    [...(t.players||[]),...(t.bench||[]),...(t.reserves||[])].forEach(p=>{
      if(p._dragon>0){ p._dragon=0; if(p._dragonBoosted){p.s.sht=Math.max(20,p.s.sht-30); p.s.spd=Math.max(20,p.s.spd-20); p._dragonBoosted=false;} }
      if(p._auraDivine){ const b=p._auraDivine; p.s.sht-=b; p.s.spd-=b; p.s.def-=b; p.s.tec-=b; p._auraDivine=0; p._auraDivineActive=false; }
      // Restituer tous les buffs Aide Divine encore actifs
      (p._aideDivine||[]).forEach(b=>{ b.keys.forEach(k=>{p.s[k]=Math.max(1,p.s[k]-b.boost);}); });
      p._aideDivine=[];
      // Fin de domination éventuelle : restituer les stats et l'appartenance
      if(p._domDebuffApplied){
        if(p._domSavedSht!=null)p.s.sht=p._domSavedSht;
        if(p._domSavedSpd!=null)p.s.spd=p._domSavedSpd;
        p._domDebuffApplied=false;p._domSavedSht=null;p._domSavedSpd=null;
      }
      p._dominated=0;p._dominatedBy=null;
      // Blessure grave → indisponible au prochain match
      if((p.injLevel||0)>=3) p._missNextMatch=true;
    });
  });
  _clearConcertBuffs();
  document.getElementById('prematch-modal')?.classList.remove('on');
  G.running=false;G._paused=false;G._celebrating=false;
  G.phase='END';
  document.getElementById('hphase').textContent='FIN DU MATCH';
  const[s0,s1]=G.scores;
  let winner=-1;
  if(G.penaltyWinner!==undefined&&G.penaltyWinner>=0)winner=G.penaltyWinner;
  else if(s0>s1)winner=0;else if(s1>s0)winner=1;
  const wName=winner>=0?teams[winner].name:null;
  const msg=wName?`🏆 ${wName} gagne !`:`Match nul ${s0}–${s1}`;
  logEvent(`FIN ! ${msg}`,'#f0c028');
  document.getElementById('mbtn').textContent='↺ Rejouer';
  if(G.leagueMode){
    G.leagueMode=false;
    // Enregistrer résultat carrière si match carrière
    if(window._careerFixPlaying){
      _recordCareerV2MatchResult();
      showEndMatchRecap();
      return;
    }
    if(window._careerCupPlaying){
      _recordCareerV2CupMatchResult();
      showEndMatchRecap();
      return;
    }
    if(window._careerPlayoffPlaying){
      _recordCareerV2PlayoffMatchResult();
      showEndMatchRecap();
      return;
    }
    if(window._careerBarragePlaying){
      _recordCareerV2BarrageMatchResult();
      showEndMatchRecap();
      return;
    }
    if(window._careerFriendlyPlaying){
      _recordCareerV2FriendlyResult();
      showEndMatchRecap();
      return;
    }
    // Figer le récap AVANT toute restauration/navigation (teams[] = équipes du match)
    const _recapSnap=_captureRecapSnapshot();
    // Tracker les stats joueurs avant tout (teams[] encore intacts)
    if(leagueState){
      if(!leagueState.playerStats) leagueState.playerStats={};
      const ps=leagueState.playerStats;
      [0,1].forEach(ti=>{
        (teams[ti]?.players||[]).forEach(p=>{
          if(!p.mG&&!p.mA&&!p.yc&&!p.red) return;
          const key=p.name+'|'+ti;
          const col=teams[ti]?.color||'#888';
          if(!ps[key]) ps[key]={name:p.name,col,G:0,A:0,YC:0,RC:0};
          ps[key].G+=p.mG||0; ps[key].A+=p.mA||0; ps[key].YC+=p.yc||0;
          if(p.red) ps[key].RC=(ps[key].RC||0)+1;
        });
      });
    }
    // Coupe aussi (si match coupe joué en leagueMode)
    if(cupState&&cupCurrentMatch!==null){
      if(!cupState.playerStats) cupState.playerStats={};
      const cps=cupState.playerStats;
      [0,1].forEach(ti=>{
        (teams[ti]?.players||[]).forEach(p=>{
          if(!p.mG&&!p.mA&&!p.yc&&!p.red) return;
          const key=p.name+'|'+ti;
          if(!cps[key]) cps[key]={name:p.name,col:teams[ti]?.color||'#888',G:0,A:0,YC:0,RC:0};
          cps[key].G+=p.mG||0; cps[key].A+=p.mA||0; cps[key].YC+=p.yc||0;
          if(p.red) cps[key].RC=(cps[key].RC||0)+1;
        });
      });
    }
    if(cupCurrentMatch!==null){
      recordCupResult(s0,s1);
    } else {
      recordLeagueResult(s0,s1);
      if(_leagueUserTeamBackup){
        teams[0]=_leagueUserTeamBackup[0];teams[1]=_leagueUserTeamBackup[1];_leagueUserTeamBackup=null;
      }
      renderTB(0);renderTB(1);syncHUD();nav('league');
    }
    // Afficher le récap de fin de match avec les bonnes équipes (coupe/ligue)
    showEndMatchRecap(_recapSnap);
  } else if(G.careerMode){
    G.careerMode=false;
    const _recapSnap=_captureRecapSnapshot();
    recordCareerMatchResult(s0,s1);
    if(_leagueUserTeamBackup){teams[0]=_leagueUserTeamBackup[0];teams[1]=_leagueUserTeamBackup[1];_leagueUserTeamBackup=null;}
    renderTB(0);renderTB(1);syncHUD();nav('career');
    showEndMatchRecap(_recapSnap);
  } else if(G.careerCupMode){
    G.careerCupMode=false;
    const _recapSnap=_captureRecapSnapshot();
    recordCareerCupResult(s0,s1);
    if(_leagueUserTeamBackup){teams[0]=_leagueUserTeamBackup[0];teams[1]=_leagueUserTeamBackup[1];_leagueUserTeamBackup=null;}
    renderTB(0);renderTB(1);syncHUD();nav('career');
    showEndMatchRecap(_recapSnap);
  } else {
    showEndMatchRecap();
  }
}

function _captureRecapSnapshot(){
  // Fige les données du récap (équipes, buteurs, passeurs) AVANT toute
  // restauration de teams[], pour que l'écran de fin affiche les bonnes
  // équipes du match (coupe/ligue) et pas les Rouges/Bleus principaux.
  const [s0,s1]=G.scores;
  const winner=s0>s1?0:s1>s0?1:-1;
  const events=(G.matchEvents||[]).slice();
  const teamData=[0,1].map(ti=>{
    const ps=(teams[ti]?.players)||[];
    const goals=events.filter(e=>e.type==='goal'&&e.team===ti);
    const scorers=ps.filter(p=>p.mG>0).sort((a,b)=>b.mG-a.mG).map(p=>({name:p.name,mG:p.mG}));
    const passeurs=ps.filter(p=>p.mA>0).sort((a,b)=>b.mA-a.mA).map(p=>({name:p.name,mA:p.mA}));
    const cartons=ps.filter(p=>p.yc>0||p.red).map(p=>({name:p.name,yc:p.yc,red:p.red}));
    const mvpP=ps.reduce((best,p)=>{const score=p.mG*3+(p.mA||0)*2+(p.mTk||0)*.5+(p.mSp||0)*.3;return score>(best._score||0)?{name:p.name,mG:p.mG,mA:p.mA||0,_score:score}:best;},{_score:-1});
    return {ti,goals,scorers,passeurs,cartons,mvp:mvpP,col:teams[ti]?.color||'#888',name:teams[ti]?.name||'—',score:G.scores[ti]};
  });
  return {teamData,winner};
}

function showEndMatchRecap(snapshot){
  const snap=snapshot||_captureRecapSnapshot();
  const winner=snap.winner;
  const teamData=snap.teamData;

  const miniGoalLog=data=>data.goals.length
    ?data.goals.map(e=>`<div style="display:flex;align-items:center;gap:5px;padding:2px 0">
        <span style="font-size:9px;color:var(--muted);min-width:20px">${e.min}'</span>
        <span>⚽</span>
        <span style="font-size:10px;font-weight:700;color:${data.col}">${e.scorer}</span>
        ${e.assister?`<span style="font-size:8px;color:var(--muted)">↩${e.assister}</span>`:''}
      </div>`).join('')
    :`<div style="font-size:9px;color:var(--muted);padding:2px 0">—</div>`;

  const miniList=(items,fn)=>items.length
    ?items.slice(0,3).map(fn).join('')
    :`<div style="font-size:9px;color:var(--muted)">—</div>`;

  const teamCard=data=>`
    <div style="flex:1;background:var(--card);border:1px solid ${data.col}33;border-radius:10px;padding:10px;min-width:0">
      <!-- En-tête équipe -->
      <div style="font-size:9px;font-weight:700;letter-spacing:1px;color:${data.col};text-transform:uppercase;margin-bottom:2px">${data.name}</div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:42px;font-weight:900;color:${data.col};line-height:1;margin-bottom:8px">${data.score}</div>
      ${winner===data.ti?`<div style="font-size:9px;font-weight:700;color:${data.col};background:${data.col}22;border-radius:4px;padding:2px 6px;display:inline-block;margin-bottom:8px">🏆 VICTOIRE</div>`
        :winner===-1?`<div style="font-size:9px;color:var(--muted);margin-bottom:8px">MATCH NUL</div>`
        :`<div style="font-size:9px;color:var(--muted);margin-bottom:8px">DÉFAITE</div>`}
      <!-- Buts -->
      <div style="font-size:8px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:3px">⚽ Buts</div>
      ${miniGoalLog(data)}
      <!-- Passes -->
      <div style="font-size:8px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin:6px 0 3px">🎯 Passes déc.</div>
      ${miniList(data.passeurs,p=>`<div style="font-size:10px;font-weight:700;color:${data.col};padding:1px 0">${p.name} <span style="color:var(--muted);font-size:9px">×${p.mA}</span></div>`)}
      <!-- Cartons -->
      ${data.cartons.length?`
      <div style="font-size:8px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin:6px 0 3px">🟨 Cartons</div>
      ${data.cartons.map(p=>`<div style="font-size:9px;padding:1px 0">${p.red?'🟥':'🟨'} ${p.name}</div>`).join('')}`:''}
      <!-- MVP -->
      ${data.mvp._score>0?`
      <div style="font-size:8px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin:6px 0 3px">⭐ MVP</div>
      <div style="font-size:10px;font-weight:700;color:${data.col}">${data.mvp.name}</div>
      <div style="font-size:8px;color:var(--muted)">${data.mvp.mG>0?data.mvp.mG+' but'+(data.mvp.mG>1?'s':''):''}${data.mvp.mA>0?' · '+(data.mvp.mA)+' passe(s)':''}</div>`:''}
    </div>`;

  let modal=document.getElementById('endmatch-modal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='endmatch-modal';
    modal.style.cssText='position:fixed;inset:0;background:rgba(5,14,26,.94);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:8px;overflow-y:auto;-webkit-overflow-scrolling:touch';
    document.body.appendChild(modal);
  }

  modal.innerHTML=`<div style="background:var(--dark);border:1px solid var(--b2);border-radius:14px;padding:12px;max-width:420px;width:100%;margin-top:4px">
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:9px;letter-spacing:3px;color:var(--muted);text-transform:uppercase;text-align:center;margin-bottom:10px">FIN DU MATCH</div>
    <!-- Deux colonnes équipes -->
    <div style="display:flex;gap:8px;margin-bottom:10px">
      ${teamCard(teamData[0])}
      ${teamCard(teamData[1])}
    </div>
    ${_gifPanelHTML(false)}
    <button class="btn ht-copy-btn" style="width:100%;justify-content:center;font-size:10px;margin-bottom:8px" onclick="copyMatchLog('live')">📋 Copier le journal du match</button>
    <button class="btn btng" style="width:100%;justify-content:center;font-size:12px;padding:10px" onclick="document.getElementById('endmatch-modal').style.display='none';nav('stats');renderStats()">📊 Stats complètes</button>
  </div>`;
  modal.style.display='flex';
  G.matchEvents=[];
}

// ═══════════════════════════════════════════════════════════
// HALFTIME
// ═══════════════════════════════════════════════════════════