// ═══════════════════════════════════════════════════════════
// ENREGISTREMENT VIDÉO DU MATCH — format "short" vertical (9:16)
// ═══════════════════════════════════════════════════════════
// Principe : le canvas #cvs (le terrain, en paysage) est déjà dessiné à
// 60fps par la boucle de jeu (visual.js / frame()). Plutôt que d'enregistrer
// ce canvas tel quel (ce qui donnait une vidéo muette : ni score, ni
// chrono, ni mi-temps, puisque le HUD est en HTML au-dessus du canvas, hors
// de portée de captureStream()), on compose CHAQUE frame dans un second
// canvas hors-écran au format vertical 1080×1920 :
//   - un bandeau haut avec noms d'équipe, score et chrono/mi-temps (repris
//     directement des éléments HTML du HUD, qui sont déjà tenus à jour) ;
//   - le terrain, centré ;
//   - un bandeau bas de habillage ;
//   - un générique d'intro (2,2s) et un générique de fin (2,6s) avec le
//     score final ;
//   - un effet "BUT !" (zoom + bannière animée + flash) synchronisé sur la
//     pause de célébration déjà existante dans le moteur (G._celebrating,
//     ~2,2s) : les joueurs sont déjà figés à ce moment-là, donc le zoom
//     dramatique donne un vrai effet d'arrêt sur image façon replay, sans
//     avoir à tamponner de vraies frames pour un ralenti interpolé.
// C'est CE second canvas (recCanvas) qui est capturé par MediaRecorder.
//
// Limite honnête (inchangée) : MediaRecorder ne produit du vrai
// H.264-in-MP4 que si le navigateur embarque un encodeur H.264. À défaut,
// VP9-in-MP4, puis en dernier recours .webm. Le nom de fichier reflète
// toujours ce qui a réellement été produit.

(function(){
  let recorder=null;
  let chunks=[];
  let recStartTs=0;
  let outExt='mp4';

  // Ordre de préférence : H.264-in-MP4, puis VP9-in-MP4, puis VP9/VP8-in-WebM.
  const CANDIDATES=[
    {mime:'video/mp4;codecs=avc1.42E01E',ext:'mp4'},
    {mime:'video/mp4;codecs=h264',ext:'mp4'},
    {mime:'video/mp4;codecs=vp9',ext:'mp4'},
    {mime:'video/mp4',ext:'mp4'},
    {mime:'video/webm;codecs=vp9',ext:'webm'},
    {mime:'video/webm;codecs=vp8',ext:'webm'},
    {mime:'video/webm',ext:'webm'},
  ];

  function pickMime(){
    if(typeof MediaRecorder==='undefined') return null;
    for(const c of CANDIDATES){
      if(MediaRecorder.isTypeSupported(c.mime)) return c;
    }
    return null;
  }

  function canvasCaptureSupported(){
    return typeof HTMLCanvasElement!=='undefined'
      && typeof HTMLCanvasElement.prototype.captureStream==='function';
  }

  function sanitize(s){
    return String(s||'Equipe').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'')||'Equipe';
  }

  function buildFilename(ext){
    // `teams` et `G` sont déclarés avec `let`/`const` en haut de data.js et
    // engine.js : ce ne sont PAS des propriétés de `window`, donc
    // `window.teams` est toujours undefined même quand `teams` est
    // parfaitement accessible en tant que variable globale du script.
    const T=(typeof teams!=='undefined')?teams:null;
    const Gv=(typeof G!=='undefined')?G:null;
    const n0=sanitize(T && T[0] && T[0].name);
    const n1=sanitize(T && T[1] && T[1].name);
    const s0=(Gv && Gv.scores && Gv.scores[0])||0;
    const s1=(Gv && Gv.scores && Gv.scores[1])||0;
    const d=new Date();
    const pad=n=>String(n).padStart(2,'0');
    const stamp=`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
    return `${n0}_${s0}-${s1}_${n1}_${stamp}_short.${ext}`;
  }

  function fmtTime(sec){
    const m=Math.floor(sec/60), s=Math.floor(sec%60);
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  // ── Messages visibles (remplace alert(), silencieusement bloqué dans pas
  // mal de webviews/iframes) ──────────────────────────────────────────────
  let msgTimeout=null;
  function showMsg(text){
    console.warn('[record.js]',text);
    const btn=document.getElementById('rec-btn');
    if(!btn) return;
    let bubble=document.getElementById('rec-msg');
    if(!bubble){
      bubble=document.createElement('div');
      bubble.id='rec-msg';
      (btn.parentNode||document.body).appendChild(bubble);
    }
    bubble.textContent=text;
    bubble.classList.add('rec-msg-show');
    clearTimeout(msgTimeout);
    msgTimeout=setTimeout(()=>bubble.classList.remove('rec-msg-show'),4500);
  }

  function checkSupport(){
    const btn=document.getElementById('rec-btn');
    if(!btn) return;
    const cvs=document.getElementById('cvs');
    let reason=null;
    if(!cvs) reason='Canvas introuvable.';
    else if(!canvasCaptureSupported()) reason='Ce navigateur ne prend pas en charge l\'enregistrement du canvas (captureStream indisponible).';
    else if(!pickMime()) reason='Aucun format vidéo supporté par ce navigateur (MediaRecorder indisponible).';
    if(reason){
      btn.disabled=true;
      btn.classList.add('rec-disabled');
      btn.title='Enregistrement indisponible : '+reason;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // COMPOSITEUR VERTICAL (recCanvas 1080×1920)
  // ═══════════════════════════════════════════════════════════
  const REC_W=1080, REC_H=1920;
  const TOP_H=210;   // bandeau score/chrono
  const BOT_H=100;   // bandeau habillage bas
  const INTRO_MS=2200, OUTRO_MS=2600;
  const FONT='Barlow Condensed, sans-serif';

  let recCanvas=null, rctx=null, recRAF=null;
  let recState='idle'; // idle | intro | live | outro
  let stateStart=0;
  let goalCeleb=null;  // {team,scorer,start,dur}

  function ensureRecCanvas(){
    if(recCanvas) return;
    recCanvas=document.createElement('canvas');
    recCanvas.width=REC_W; recCanvas.height=REC_H;
    // Hors écran mais dans le DOM (certains navigateurs capturent mal un
    // canvas jamais attaché) — position fixe hors du viewport visible.
    recCanvas.style.cssText='position:fixed;left:-99999px;top:0;pointer-events:none;';
    document.body.appendChild(recCanvas);
    rctx=recCanvas.getContext('2d');
  }

  function teamInfo(ti){
    const T=(typeof teams!=='undefined')?teams:null;
    const t=T&&T[ti];
    return {
      name:(t&&t.name)||(ti===0?'Équipe A':'Équipe B'),
      color:(t&&t.color)||(ti===0?'#e02030':'#1878e8'),
    };
  }

  function domTxt(id,fallback){
    const el=document.getElementById(id);
    return (el&&el.textContent)?el.textContent:fallback;
  }

  function shortName(n){
    n=String(n||'');
    return n.length>14 ? n.slice(0,13)+'…' : n;
  }

  function easeOutBack(x){
    const c1=1.70158, c3=c1+1;
    return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2);
  }

  function drawIntro(t){
    const ctx=rctx;
    const c0=teamInfo(0), c1=teamInfo(1);
    ctx.clearRect(0,0,REC_W,REC_H);
    const g=ctx.createLinearGradient(0,0,0,REC_H);
    g.addColorStop(0,'#05070a'); g.addColorStop(1,'#161b22');
    ctx.fillStyle=g; ctx.fillRect(0,0,REC_W,REC_H);

    const ease=Math.min(1,t*1.6);
    ctx.save();
    ctx.globalAlpha=0.85*ease;
    ctx.fillStyle=c0.color; ctx.fillRect(0,REC_H*0.34,REC_W,REC_H*0.14);
    ctx.fillStyle=c1.color; ctx.fillRect(0,REC_H*0.52,REC_W,REC_H*0.14);
    ctx.restore();

    const pop=easeOutBack(Math.min(1,t/0.5));
    ctx.save();
    ctx.globalAlpha=Math.min(1,t*2);
    ctx.translate(REC_W/2,REC_H*0.44);
    ctx.scale(0.7+0.3*pop,0.7+0.3*pop);
    ctx.translate(-REC_W/2,-REC_H*0.44);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='#fff';
    ctx.font='700 60px '+FONT;
    ctx.fillText(shortName(c0.name).toUpperCase(), REC_W/2, REC_H*0.40);
    ctx.font='700 38px '+FONT;
    ctx.fillStyle='#ffd54f';
    ctx.fillText('VS', REC_W/2, REC_H*0.48);
    ctx.font='700 60px '+FONT;
    ctx.fillStyle='#fff';
    ctx.fillText(shortName(c1.name).toUpperCase(), REC_W/2, REC_H*0.56);
    ctx.restore();

    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.globalAlpha=Math.min(1,t*2);
    ctx.font='600 26px '+FONT;
    ctx.fillStyle='rgba(255,255,255,.65)';
    ctx.fillText('⚽ FOOTSIM', REC_W/2, REC_H*0.90);
    ctx.globalAlpha=1;
  }

  function drawScoreboard(ctx){
    const c0=teamInfo(0), c1=teamInfo(1);
    const s0=domTxt('hs0','0'), s1=domTxt('hs1','0');
    const clock=domTxt('hclock',"0'");
    const phase=domTxt('hphase','');
    ctx.save();
    ctx.fillStyle='rgba(8,10,14,.85)';
    ctx.fillRect(0,0,REC_W,TOP_H);
    ctx.fillStyle=c0.color; ctx.fillRect(0,0,REC_W*0.5,6);
    ctx.fillStyle=c1.color; ctx.fillRect(REC_W*0.5,0,REC_W*0.5,6);

    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font='700 36px '+FONT;
    ctx.fillStyle='#fff';
    ctx.fillText(shortName(c0.name), REC_W*0.22, TOP_H*0.40);
    ctx.fillText(shortName(c1.name), REC_W*0.78, TOP_H*0.40);

    ctx.font='800 76px '+FONT;
    ctx.fillStyle=c0.color;
    ctx.fillText(String(s0), REC_W*0.40, TOP_H*0.58);
    ctx.fillStyle='rgba(255,255,255,.5)';
    ctx.fillText('-', REC_W*0.5, TOP_H*0.58);
    ctx.fillStyle=c1.color;
    ctx.fillText(String(s1), REC_W*0.60, TOP_H*0.58);

    ctx.font='700 30px '+FONT;
    ctx.fillStyle='#ffd54f';
    ctx.fillText(clock, REC_W*0.5, TOP_H*0.83);
    if(phase){
      ctx.font='700 19px '+FONT;
      ctx.fillStyle='rgba(255,255,255,.75)';
      ctx.fillText(phase.toUpperCase(), REC_W*0.5, TOP_H*0.97);
    }
    ctx.restore();
  }

  function drawBranding(ctx){
    ctx.save();
    ctx.fillStyle='rgba(8,10,14,.75)';
    ctx.fillRect(0,REC_H-BOT_H,REC_W,BOT_H);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font='700 25px '+FONT;
    ctx.fillStyle='rgba(255,255,255,.55)';
    ctx.fillText('⚽ FOOTSIM', REC_W/2, REC_H-BOT_H/2);
    ctx.restore();
  }

  function drawGoalBanner(ctx, celeb, now){
    const t=(now-celeb.start)/celeb.dur;
    const info=teamInfo(celeb.team);
    const popIn=Math.min(1,t/0.18);
    const scale=0.6+0.4*easeOutBack(popIn);
    const fadeOut=t>0.82 ? Math.max(0,1-(t-0.82)/0.18) : 1;
    const cy=REC_H*0.42;
    ctx.save();
    ctx.globalAlpha=fadeOut;
    const rg=ctx.createRadialGradient(REC_W/2,cy,10,REC_W/2,cy,REC_W*0.75);
    rg.addColorStop(0,info.color+'aa'); rg.addColorStop(1,'transparent');
    ctx.fillStyle=rg; ctx.fillRect(0,TOP_H,REC_W,REC_H-TOP_H-BOT_H);

    ctx.translate(REC_W/2,cy); ctx.scale(scale,scale); ctx.translate(-REC_W/2,-cy);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font='900 128px '+FONT;
    ctx.lineWidth=6; ctx.strokeStyle=info.color;
    ctx.strokeText('BUT !', REC_W/2, cy);
    ctx.fillStyle='#fff';
    ctx.fillText('BUT !', REC_W/2, cy);
    if(celeb.scorer){
      ctx.font='700 42px '+FONT;
      ctx.fillStyle=info.color;
      ctx.fillText(celeb.scorer, REC_W/2, cy+92);
    }
    ctx.restore();
  }

  function drawLive(cvs, now){
    const ctx=rctx;
    ctx.clearRect(0,0,REC_W,REC_H);
    const bg=ctx.createLinearGradient(0,0,0,REC_H);
    bg.addColorStop(0,'#05070a'); bg.addColorStop(1,'#0d1116');
    ctx.fillStyle=bg; ctx.fillRect(0,0,REC_W,REC_H);

    const midY=TOP_H, midH=REC_H-TOP_H-BOT_H;
    const sw=cvs.width, sh=cvs.height;
    const inCeleb=goalCeleb && (now-goalCeleb.start)<goalCeleb.dur;

    if(sw>0 && sh>0){
      let scale=REC_W/sw, drawW=REC_W, drawH=sh*scale;
      if(drawH>midH){ scale=midH/sh; drawW=sw*scale; drawH=midH; }
      const dx=(REC_W-drawW)/2, dy=midY+(midH-drawH)/2;
      const cx=REC_W/2, cy=midY+midH/2;
      ctx.save();
      if(inCeleb){
        const p=(now-goalCeleb.start)/goalCeleb.dur;
        const ramp=1-Math.pow(1-Math.min(1,p*3),2);
        const zoom=1+0.18*ramp;
        ctx.translate(cx,cy); ctx.scale(zoom,zoom); ctx.translate(-cx,-cy);
      }
      ctx.drawImage(cvs,0,0,sw,sh,dx,dy,drawW,drawH);
      ctx.restore();
    }

    drawScoreboard(ctx);
    drawBranding(ctx);
    if(inCeleb) drawGoalBanner(ctx, goalCeleb, now);
  }

  function drawOutro(t){
    const ctx=rctx;
    const c0=teamInfo(0), c1=teamInfo(1);
    const s0=domTxt('hs0','0'), s1=domTxt('hs1','0');
    ctx.clearRect(0,0,REC_W,REC_H);
    const g=ctx.createLinearGradient(0,0,0,REC_H);
    g.addColorStop(0,'#05070a'); g.addColorStop(1,'#12161c');
    ctx.fillStyle=g; ctx.fillRect(0,0,REC_W,REC_H);

    const pop=easeOutBack(Math.min(1,t/0.4));
    ctx.save();
    ctx.translate(REC_W/2,REC_H*0.42);
    ctx.scale(0.7+0.3*pop,0.7+0.3*pop);
    ctx.translate(-REC_W/2,-REC_H*0.42);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font='700 32px '+FONT;
    ctx.fillStyle='rgba(255,255,255,.7)';
    ctx.fillText('SIFFLET FINAL', REC_W/2, REC_H*0.30);
    ctx.font='700 44px '+FONT;
    ctx.fillStyle='#fff';
    ctx.fillText(shortName(c0.name), REC_W/2, REC_H*0.38);
    ctx.font='800 116px '+FONT;
    ctx.fillStyle='#fff';
    ctx.fillText(`${s0} - ${s1}`, REC_W/2, REC_H*0.46);
    ctx.font='700 44px '+FONT;
    ctx.fillText(shortName(c1.name), REC_W/2, REC_H*0.54);
    ctx.restore();

    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font='600 24px '+FONT;
    ctx.fillStyle='rgba(255,255,255,.5)';
    ctx.fillText('⚽ FOOTSIM', REC_W/2, REC_H*0.90);
  }

  // ── Boucle d'enregistrement (indépendante de la boucle de jeu) ─────────
  function recLoop(){
    recRAF=requestAnimationFrame(recLoop);
    const now=performance.now();
    const cvs=document.getElementById('cvs');
    const btn=document.getElementById('rec-btn');

    if(recState==='intro'){
      drawIntro(Math.min(1,(now-stateStart)/INTRO_MS));
      if(now-stateStart>=INTRO_MS){ recState='live'; stateStart=now; setBtnUI('recording'); }
    } else if(recState==='live'){
      if(cvs) drawLive(cvs, now);
      if(btn) btn.textContent='⏺ '+fmtTime((now-recStartTs)/1000);
    } else if(recState==='outro'){
      drawOutro(Math.min(1,(now-stateStart)/OUTRO_MS));
      if(now-stateStart>=OUTRO_MS) finalizeRecording();
    }
  }

  function onGoalEvent(e){
    if(recState!=='live') return; // pas de bannière pendant intro/outro
    const d=e.detail||{};
    goalCeleb={ team:d.team, scorer:d.scorer, start:performance.now(), dur:2200 };
  }

  function setBtnUI(state){
    const btn=document.getElementById('rec-btn');
    if(!btn) return;
    btn.classList.remove('rec-active');
    if(state==='idle'){
      btn.textContent='⏺ REC';
      btn.title='Enregistrer le match en format vertical (score, chrono, générique et effet sur les buts inclus)';
    } else if(state==='intro'){
      btn.classList.add('rec-active');
      btn.textContent='● Intro…';
      btn.title='Préparation de l\'enregistrement…';
    } else if(state==='recording'){
      btn.classList.add('rec-active');
      btn.title='Cliquer pour arrêter et générer la vidéo';
    } else if(state==='outro'){
      btn.classList.add('rec-active');
      btn.textContent='● Générique…';
      btn.title='Finalisation de la vidéo…';
    }
  }

  function startRecording(){
    const cvs=document.getElementById('cvs');
    if(!cvs){ showMsg('Canvas introuvable.'); return; }
    if(!canvasCaptureSupported()){
      showMsg('Ce navigateur ne prend pas en charge l\'enregistrement du canvas (captureStream indisponible).');
      return;
    }
    const choice=pickMime();
    if(!choice){
      showMsg('Aucun format vidéo supporté par ce navigateur (MediaRecorder indisponible).');
      return;
    }
    outExt=choice.ext;
    ensureRecCanvas();

    // Gèle la taille du canvas de jeu pour toute la durée de l'enregistrement
    // (voir le guard sur window._recLocked dans visual.js resize()/frame()).
    window._recLocked=true;

    const stream=recCanvas.captureStream(30);
    chunks=[];
    try{
      recorder=new MediaRecorder(stream,{mimeType:choice.mime,videoBitsPerSecond:6_000_000});
    }catch(e){
      window._recLocked=false;
      showMsg('Impossible de démarrer l\'enregistrement : '+e.message);
      return;
    }
    recorder.ondataavailable=e=>{ if(e.data && e.data.size>0) chunks.push(e.data); };
    recorder.onstop=onRecordingStopped;
    recorder.onerror=e=>{ console.error('MediaRecorder error:',e); };
    recorder.start(1000); // chunk toutes les secondes : évite de tout perdre en cas de crash

    recStartTs=performance.now();
    recState='intro'; stateStart=recStartTs; goalCeleb=null;
    setBtnUI('intro');
    window.addEventListener('footsim:goal', onGoalEvent);
    recRAF=requestAnimationFrame(recLoop);
  }

  function requestStop(){
    if(recState!=='intro' && recState!=='live') return;
    recState='outro'; stateStart=performance.now();
    setBtnUI('outro');
  }

  function finalizeRecording(){
    if(recRAF){ cancelAnimationFrame(recRAF); recRAF=null; }
    window.removeEventListener('footsim:goal', onGoalEvent);
    recState='idle'; goalCeleb=null;
    if(recorder && recorder.state!=='inactive') recorder.stop();
    else onRecordingStopped(); // filet de sécurité si le recorder a déjà planté
  }

  function onRecordingStopped(){
    window._recLocked=false;
    // Le wrap a pu changer de taille pendant qu'on était gelé (fenêtre
    // redimensionnée, panneau ouvert…) : on réaligne le canvas de jeu
    // maintenant que ça n'affecte plus la vidéo déjà enregistrée.
    if(typeof resize==='function') resize();

    const mimeType=(recorder&&recorder.mimeType)||'video/mp4';
    const blob=new Blob(chunks,{type:mimeType});
    chunks=[];
    const url=URL.createObjectURL(blob);
    const filename=buildFilename(outExt);
    const a=document.createElement('a');
    a.href=url; a.download=filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),10000);

    setBtnUI('idle');

    if(outExt!=='mp4'){
      console.warn('Enregistrement produit en .webm : ce navigateur ne sait pas encoder de MP4 lisible. Le fichier reste une vidéo valide, juste dans un autre conteneur.');
    }
  }

  window.toggleMatchRecording=function(){
    if(recState==='idle') startRecording();
    else if(recState==='intro' || recState==='live') requestStop();
    // pendant le générique de fin ('outro') : clic ignoré, la vidéo se
    // finalise toute seule dans l'instant qui suit.
  };

  // Sécurité : si l'utilisateur quitte la page/l'onglet en cours
  // d'enregistrement, on tente de finaliser proprement pour ne pas perdre
  // les chunks déjà capturés (on saute le générique de fin : pas le temps).
  window.addEventListener('beforeunload',()=>{
    if(recState!=='idle' && recorder && recorder.state==='recording'){
      if(recRAF){ cancelAnimationFrame(recRAF); recRAF=null; }
      recorder.stop();
    }
  });

  // Vérifie les capacités dès que le DOM (donc le bouton #rec-btn) existe.
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',checkSupport);
  } else {
    checkSupport();
  }
})();
