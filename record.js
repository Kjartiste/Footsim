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
  // Deux jeux de candidats : AVEC piste audio (codec audio déclaré) et SANS.
  // Un mime qui ne déclare que la vidéo (ex. 'avc1.42E01E' seul) peut faire
  // échouer MediaRecorder dès qu'on lui ajoute une piste audio : on déclare
  // donc explicitement mp4a/opus quand il y a du son, avec repli sur les
  // chaînes vidéo seules si le navigateur n'en veut pas.
  const CANDIDATES_AV=[
    {mime:'video/mp4;codecs=avc1.42E01E,mp4a.40.2',ext:'mp4'},
    {mime:'video/mp4;codecs=h264,aac',ext:'mp4'},
    {mime:'video/mp4',ext:'mp4'},
    {mime:'video/webm;codecs=vp9,opus',ext:'webm'},
    {mime:'video/webm;codecs=vp8,opus',ext:'webm'},
    {mime:'video/webm',ext:'webm'},
  ];
  const CANDIDATES=[
    {mime:'video/mp4;codecs=avc1.42E01E',ext:'mp4'},
    {mime:'video/mp4;codecs=h264',ext:'mp4'},
    {mime:'video/mp4;codecs=vp9',ext:'mp4'},
    {mime:'video/mp4',ext:'mp4'},
    {mime:'video/webm;codecs=vp9',ext:'webm'},
    {mime:'video/webm;codecs=vp8',ext:'webm'},
    {mime:'video/webm',ext:'webm'},
  ];

  function pickMime(withAudio){
    if(typeof MediaRecorder==='undefined') return null;
    const list=withAudio?CANDIDATES_AV:CANDIDATES;
    for(const c of list){
      if(MediaRecorder.isTypeSupported(c.mime)) return c;
    }
    // Repli : si aucun mime audio+vidéo n'est accepté, on retente sans audio.
    if(withAudio) return pickMime(false);
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

  // ═══════════════════════════════════════════════════════════
  // CAMÉRA DE DIFFUSION (suivi du ballon)
  // ═══════════════════════════════════════════════════════════
  // Le terrain est en paysage, la vidéo en 9:16 : coller l'un dans l'autre
  // laissait ~830 px de vide (le terrain n'occupait que 34% de l'image).
  // Ici on RECADRE dans le canvas source autour du ballon, comme une caméra
  // de télévision. Rien n'est touché côté jeu : on ne fait que choisir quelle
  // portion du canvas déjà dessiné on recopie.
  //
  // `camX/camY` sont en pixels du canvas source et suivent le ballon avec un
  // amortissement (lissage exponentiel) : une caméra qui colle au ballon au
  // pixel près donne un rendu nerveux et illisible. On vise légèrement DEVANT
  // le ballon (lead) pour que l'action entre dans le cadre, comme un cadreur.
  const CAM={x:0,y:0,z:1,init:false};
  function _camReset(){ CAM.init=false; }

  // ═══════════════════════════════════════════════════════════
  // AMBIANCE SONORE (synthétisée, aucun fichier requis)
  // ═══════════════════════════════════════════════════════════
  // Une vidéo muette passe mal en short. Plutôt que d'embarquer des samples
  // (poids, licences), on SYNTHÉTISE l'ambiance : un bruit filtré = une foule
  // (c'est physiquement ce qu'est une rumeur de stade), dont l'intensité monte
  // sur les buts. Le tout est mixé dans un MediaStreamDestination, branché sur
  // la même piste que la vidéo.
  let actx=null, audioDest=null, crowdGain=null, crowdFilter=null;

  function _audioInit(){
    if(actx) return true;
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC) return false;
    try{
      actx=new AC();
      audioDest=actx.createMediaStreamDestination();

      // Rumeur de foule : bruit rose approximé, passé dans un filtre passe-bas.
      const len=Math.floor(actx.sampleRate*4);
      const buf=actx.createBuffer(1, len, actx.sampleRate);
      const d=buf.getChannelData(0);
      let b0=0,b1=0,b2=0;
      for(let i=0;i<len;i++){
        const w=Math.random()*2-1;
        // Filtrage simple -> spectre plus grave, proche d'une rumeur.
        b0=0.99765*b0+w*0.0990460;
        b1=0.96300*b1+w*0.2965164;
        b2=0.57000*b2+w*1.0526913;
        d[i]=(b0+b1+b2+w*0.1848)*0.06;
      }
      const src=actx.createBufferSource();
      src.buffer=buf; src.loop=true;

      crowdFilter=actx.createBiquadFilter();
      crowdFilter.type='lowpass';
      crowdFilter.frequency.value=760;

      crowdGain=actx.createGain();
      crowdGain.gain.value=0.16;      // fond permanent

      src.connect(crowdFilter); crowdFilter.connect(crowdGain);
      crowdGain.connect(audioDest);
      src.start(0);
      return true;
    }catch(e){ actx=null; return false; }
  }

  // Montée de foule (but) : la rumeur enfle et s'ouvre dans les aigus.
  function _audioCheer(){
    if(!actx||!crowdGain) return;
    const t=actx.currentTime;
    try{
      crowdGain.gain.cancelScheduledValues(t);
      crowdGain.gain.setValueAtTime(crowdGain.gain.value, t);
      crowdGain.gain.linearRampToValueAtTime(0.85, t+0.18);
      crowdGain.gain.linearRampToValueAtTime(0.16, t+5.0);
      crowdFilter.frequency.cancelScheduledValues(t);
      crowdFilter.frequency.setValueAtTime(crowdFilter.frequency.value, t);
      crowdFilter.frequency.linearRampToValueAtTime(3200, t+0.18);
      crowdFilter.frequency.linearRampToValueAtTime(760, t+5.0);
    }catch(e){}
  }

  // Coup de sifflet : deux oscillateurs proches + vibrato = timbre de sifflet.
  function _audioWhistle(){
    if(!actx) return;
    try{
      const t=actx.currentTime;
      const g=actx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22, t+0.02);
      g.gain.linearRampToValueAtTime(0, t+0.55);
      const lfo=actx.createOscillator(), lfoG=actx.createGain();
      lfo.frequency.value=22; lfoG.gain.value=60;
      lfo.connect(lfoG);
      [2100, 2680].forEach(f=>{
        const o=actx.createOscillator();
        o.type='sine'; o.frequency.value=f;
        lfoG.connect(o.frequency);
        o.connect(g); o.start(t); o.stop(t+0.6);
      });
      lfo.start(t); lfo.stop(t+0.6);
      g.connect(audioDest);
    }catch(e){}
  }

  function _audioStop(){
    if(!actx) return;
    try{ actx.close(); }catch(e){}
    actx=null; audioDest=null; crowdGain=null; crowdFilter=null;
  }

  // ═══════════════════════════════════════════════════════════
  // TAMPON DE REPLAY (vrai ralenti)
  // ═══════════════════════════════════════════════════════════
  // Le zoom sur but était un ralenti SIMULÉ : le moteur fige déjà le jeu, on
  // ne faisait que zoomer sur une image fixe. Ici on garde en anneau les N
  // dernières frames du canvas (+ le rectangle caméra utilisé), ce qui permet
  // de REJOUER l'action du but au ralenti, comme un vrai replay TV.
  //
  // Coût mémoire maîtrisé : on stocke des vignettes à la taille du cadre de
  // sortie (1080×1610), pas le canvas source complet, et on réutilise les
  // mêmes canvas (pas d'allocation par frame).
  const REPLAY_SEC=2.4;             // durée d'action rejouée
  const REPLAY_FPS=24;              // fréquence d'échantillonnage du tampon
  // Le tampon est stocké en DEMI-résolution : 72 vignettes en 1080×1610 RGBA
  // pesaient ~478 Mo, de quoi faire tomber une machine modeste. En 0.5 on
  // divise l'empreinte par 4 (~90 Mo) ; à l'affichage le ralenti est étiré
  // ×2, ce qui reste net car une image de replay est déjà perçue comme un
  // plan « à part » (et le mouvement masque la perte de détail).
  const REPLAY_SCALE=0.5;
  const REPLAY_MAX=Math.round(REPLAY_SEC*REPLAY_FPS);
  const REPLAY_SLOWDOWN=2.6;        // 1 = vitesse réelle, 2.6 = bien ralenti
  let _rb=[], _rbHead=0, _rbLast=0, _rbReady=false;
  let replay=null;                  // {start, frames:[...]}

  function _rbInit(w,h){
    if(_rbReady) return;
    _rb=[];
    for(let i=0;i<REPLAY_MAX;i++){
      const c=document.createElement('canvas');
      c.width=Math.round(w*REPLAY_SCALE); c.height=Math.round(h*REPLAY_SCALE);
      _rb.push({c, ctx:c.getContext('2d'), t:0, used:false});
    }
    _rbHead=0; _rbReady=true;
  }
  function _rbReset(){ _rb.forEach(f=>f.used=false); _rbHead=0; _rbLast=0; }

  // Mémorise la frame courante (déjà recadrée) dans l'anneau.
  function _rbPush(srcCanvas, rect, now){
    if(!_rbReady) return;
    if(now-_rbLast < 1000/REPLAY_FPS) return;   // échantillonnage
    _rbLast=now;
    const f=_rb[_rbHead];
    f.ctx.clearRect(0,0,f.c.width,f.c.height);
    try{
      f.ctx.drawImage(srcCanvas, rect.x,rect.y,rect.w,rect.h, 0,0,f.c.width,f.c.height);
      f.t=now; f.used=true;
      _rbHead=(_rbHead+1)%REPLAY_MAX;
    }catch(e){}
  }

  // Frames du tampon, de la plus ancienne à la plus récente.
  function _rbOrdered(){
    const out=[];
    for(let i=0;i<REPLAY_MAX;i++){
      const f=_rb[(_rbHead+i)%REPLAY_MAX];
      if(f.used) out.push(f);
    }
    return out;
  }

  // Portion de la LARGEUR du canvas source visible dans le cadre.
  // 0.62 ≈ deux tiers du terrain : assez large pour lire le jeu, assez serré
  // pour que les joueurs soient nettement plus gros qu'en plan fixe.
  const CAM_SPAN=0.62;

  function _camTarget(){
    // Sans ballon (hors match), on reste au centre du canvas.
    if(typeof G==='undefined' || !G || !G.ball || typeof wx!=='function'){
      return {x:cvs.width/2, y:cvs.height/2};
    }
    const b=G.ball;
    if(!isFinite(b.x)||!isFinite(b.y)) return {x:cvs.width/2, y:cvs.height/2};
    // Anticipation : on regarde là où le ballon VA (borné, sinon la caméra
    // part en vrille sur un dégagement).
    const lead=0.28;
    const lx=b.x + Math.max(-9, Math.min(9, (b.vx||0)*lead));
    const ly=b.y + Math.max(-6, Math.min(6, (b.vy||0)*lead));
    return {x:wx(lx), y:wy(ly)};
  }

  // Applique la caméra et renvoie le rectangle source à recopier.
  function _camRect(dt, inCeleb){
    const AR=REC_W/(REC_H-TOP_H-BOT_H);   // ratio de la zone d'affichage (~0.73)
    // ── Dimensionnement de la fenêtre ──────────────────────────────────
    // La zone d'affichage est PLUS HAUTE que large, alors que le canvas source
    // est en paysage : une fenêtre calculée sur la largeur (0.62·W) serait plus
    // haute que le canvas et ne tiendrait pas. On part donc de la HAUTEUR
    // disponible — c'est elle qui contraint — puis on en déduit la largeur.
    // La fenêtre est ensuite bornée pour rester dans le canvas, en gardant son
    // ratio : sans ça, l'image serait ÉTIRÉE (le défaut qu'on veut éviter).
    let sh=cvs.height, sw=sh*AR;
    const maxW=cvs.width*CAM_SPAN;
    if(sw>maxW){ sw=maxW; sh=sw/AR; }
    // Zoom de célébration.
    const zTarget=inCeleb?0.80:1;
    CAM.z += (zTarget-CAM.z)*(1-Math.pow(0.02, Math.max(0.001,dt)));
    const z=Math.max(0.5, Math.min(1, CAM.z));
    sw*=z; sh*=z;
    // Jamais plus grand que la source (sinon bandes / étirement).
    if(sh>cvs.height){ sh=cvs.height; sw=sh*AR; }
    if(sw>cvs.width){  sw=cvs.width;  sh=sw/AR; }

    const t=_camTarget();
    if(!CAM.init){ CAM.x=t.x; CAM.y=t.y; CAM.z=1; CAM.init=true; }
    const k=1-Math.pow(0.0016, Math.max(0.001, dt));
    CAM.x += (t.x-CAM.x)*k;
    CAM.y += (t.y-CAM.y)*k;

    const x=Math.max(0, Math.min(cvs.width-sw,  CAM.x-sw/2));
    const y=Math.max(0, Math.min(cvs.height-sh, CAM.y-sh/2));
    return {x,y,w:sw,h:sh};
  }

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

  // Bandeau « REPLAY » + barre de progression, façon retransmission.
  function drawReplayChrome(ctx, midY, midH, p){
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,.45)';
    ctx.fillRect(0, midY, REC_W, 54);
    ctx.fillStyle='#e8324a';
    ctx.fillRect(0, midY, 8, 54);
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.font='800 30px '+FONT;
    ctx.fillStyle='#fff';
    // Point rouge clignotant, comme un bandeau télé.
    if(Math.floor(p*12)%2===0){
      ctx.beginPath(); ctx.arc(34, midY+27, 8, 0, Math.PI*2);
      ctx.fillStyle='#e8324a'; ctx.fill();
      ctx.fillStyle='#fff';
    }
    ctx.fillText('REPLAY — RALENTI', 54, midY+28);
    // Progression
    ctx.fillStyle='rgba(255,255,255,.25)';
    ctx.fillRect(0, midY+50, REC_W, 4);
    ctx.fillStyle='#f0c028';
    ctx.fillRect(0, midY+50, REC_W*p, 4);
    ctx.restore();
  }

  function drawLive(cvs, now, dtSec){
    const ctx=rctx;
    ctx.clearRect(0,0,REC_W,REC_H);
    const bg=ctx.createLinearGradient(0,0,0,REC_H);
    bg.addColorStop(0,'#05070a'); bg.addColorStop(1,'#0d1116');
    ctx.fillStyle=bg; ctx.fillRect(0,0,REC_W,REC_H);

    const midY=TOP_H, midH=REC_H-TOP_H-BOT_H;
    const sw=cvs.width, sh=cvs.height;
    const inCeleb=goalCeleb && (now-goalCeleb.start)<goalCeleb.dur;

    if(sw>0 && sh>0){
      // ── Caméra de diffusion ────────────────────────────────────────────
      // Au lieu de coller tout le terrain (qui ne remplissait que 34% de
      // l'image), on recopie une fenêtre qui suit le ballon et on l'étire sur
      // TOUTE la zone centrale. Le terrain occupe donc 100% du cadre et les
      // joueurs sont ~2x plus gros.
      const r=_camRect(dtSec, inCeleb);
      _rbInit(REC_W, midH);
      ctx.save();
      ctx.beginPath(); ctx.rect(0,midY,REC_W,midH); ctx.clip();

      if(replay){
        // ── REPLAY AU RALENTI ──────────────────────────────────────────
        // On rejoue les frames tamponnées AVANT le but, étalées dans le temps
        // (REPLAY_SLOWDOWN). Le jeu continue de tourner derrière : on ne
        // touche à rien, on affiche simplement le passé.
        const frames=replay.frames;
        const el=now-replay.start;
        const total=(REPLAY_SEC*1000)*REPLAY_SLOWDOWN;
        const p=Math.min(1, el/total);
        const idx=Math.min(frames.length-1, Math.floor(p*frames.length));
        const f=frames[idx];
        if(f) ctx.drawImage(f.c, 0,0,f.c.width,f.c.height, 0,midY,REC_W,midH);
        drawReplayChrome(ctx, midY, midH, p);
        if(el>=total) replay=null;
      } else {
        ctx.drawImage(cvs, r.x,r.y,r.w,r.h, 0,midY,REC_W,midH);
        // On ne tamponne que le jeu réel (jamais le replay lui-même).
        if(!inCeleb) _rbPush(cvs, r, now);
      }
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
  let _lastFrameTs=0;
  function recLoop(){
    recRAF=requestAnimationFrame(recLoop);
    const now=performance.now();
    // Δt en secondes, borné : après un onglet en arrière-plan, un dt énorme
    // ferait téléporter la caméra.
    const dtSec=_lastFrameTs ? Math.min(0.1,(now-_lastFrameTs)/1000) : 0.016;
    _lastFrameTs=now;
    const cvs=document.getElementById('cvs');
    const btn=document.getElementById('rec-btn');

    if(recState==='intro'){
      drawIntro(Math.min(1,(now-stateStart)/INTRO_MS));
      if(now-stateStart>=INTRO_MS){ recState='live'; stateStart=now; setBtnUI('recording'); }
    } else if(recState==='live'){
      if(cvs) drawLive(cvs, now, dtSec);
      if(btn) btn.textContent='⏺ '+fmtTime((now-recStartTs)/1000);
    } else if(recState==='outro'){
      drawOutro(Math.min(1,(now-stateStart)/OUTRO_MS));
      if(now-stateStart>=OUTRO_MS) finalizeRecording();
    }
  }

  function onGoalEvent(e){
    if(recState!=='live') return; // pas de bannière pendant intro/outro
    const d=e.detail||{};
    const t0=performance.now();
    goalCeleb={ team:d.team, scorer:d.scorer, start:t0, dur:2200 };
    _audioCheer();
    // Le replay démarre APRÈS la bannière de but : d'abord la joie, ensuite
    // « comment c'est arrivé » — l'ordre d'une vraie retransmission. On fige
    // ici une copie de la liste des frames : le tampon, lui, continue de
    // tourner (mais on ne le remplit plus tant que le replay joue).
    const frames=_rbOrdered();
    if(frames.length>4){
      setTimeout(()=>{
        if(recState!=='live') return;
        replay={ start:performance.now(), frames };
      }, 2300);
    }
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
    // Le mime dépend de la présence d'une piste audio : on tranche plus bas,
    // une fois qu'on sait si l'AudioContext a démarré.
    ensureRecCanvas();

    // Gèle la taille du canvas de jeu pour toute la durée de l'enregistrement
    // (voir le guard sur window._recLocked dans visual.js resize()/frame()).
    // On monte d'abord la résolution du canvas (supersampling) puis on fige :
    // la caméra recadre dans cette source haute définition.
    // Facteur calculé, pas deviné : on veut que la fenêtre caméra fasse au
    // moins REC_W pixels de large dans la source, sinon on agrandit (flou).
    // Petite fenêtre de jeu ⇒ facteur plus élevé. Borné à 2.5 pour ne pas
    // faire fondre le GPU sur les grands écrans.
    (function(){
      const c=document.getElementById('cvs');
      if(!c || !c.height){ window._recSuperSample=1.8; return; }
      const AR=REC_W/(REC_H-TOP_H-BOT_H);
      let sh=c.height, sw=sh*AR;
      const maxW=c.width*CAM_SPAN;
      if(sw>maxW) sw=maxW;
      const need=REC_W/Math.max(1,sw);          // agrandissement actuel
      window._recSuperSample=Math.max(1, Math.min(2.5, need*1.05));
    })();
    try{ if(typeof resize==='function') resize(); }catch(e){}
    window._recLocked=true;

    // 60 fps : la boucle de jeu tourne déjà à 60, capturer à 30 divisait la
    // fluidité par deux pour rien. Le débit suit (6 → 12 Mbps) : à 60 fps,
    // 6 Mbps donnerait des artefacts de compression sur les mouvements
    // rapides — exactement là où un short se juge.
    const stream=recCanvas.captureStream(60);
    // Piste audio : on la greffe sur le flux vidéo. Non bloquant — si le
    // navigateur refuse l'AudioContext, on enregistre en muet comme avant.
    let hasAudio=false;
    if(_audioInit() && audioDest){
      try{
        const tracks=audioDest.stream.getAudioTracks();
        if(tracks.length){
          tracks.forEach(t=>stream.addTrack(t));
          hasAudio=true;
          // Certains navigateurs suspendent l'AudioContext tant qu'il n'y a
          // pas eu d'interaction : le clic sur REC en est une.
          if(actx.state==='suspended') actx.resume().catch(()=>{});
        }
      }catch(e){ hasAudio=false; }
    }

    // Le mime est choisi APRÈS : il doit décrire les pistes réellement
    // présentes, sinon MediaRecorder refuse le flux.
    const choice=pickMime(hasAudio);
    if(!choice){
      window._recLocked=false; window._recSuperSample=1;
      try{ if(typeof resize==='function') resize(); }catch(e){}
      _audioStop();
      showMsg('Aucun format vidéo supporté par ce navigateur (MediaRecorder indisponible).');
      return;
    }
    outExt=choice.ext;
    chunks=[];
    try{
      recorder=new MediaRecorder(stream,{
        mimeType:choice.mime,
        videoBitsPerSecond:12_000_000,
        ...(hasAudio?{audioBitsPerSecond:128_000}:{})
      });
    }catch(e){
      window._recLocked=false; window._recSuperSample=1; _audioStop();
      try{ if(typeof resize==='function') resize(); }catch(e){}
      showMsg('Impossible de démarrer l\'enregistrement : '+e.message);
      return;
    }
    recorder.ondataavailable=e=>{ if(e.data && e.data.size>0) chunks.push(e.data); };
    recorder.onstop=onRecordingStopped;
    recorder.onerror=e=>{ console.error('MediaRecorder error:',e); };
    recorder.start(1000); // chunk toutes les secondes : évite de tout perdre en cas de crash

    recStartTs=performance.now();
    recState='intro'; stateStart=recStartTs; goalCeleb=null; replay=null; _lastFrameTs=0; _camReset(); _rbReset();
    if(hasAudio) setTimeout(()=>_audioWhistle(), INTRO_MS-250); // sifflet au coup d'envoi
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
    window._recLocked=false; window._recSuperSample=1; _audioStop();
    try{ if(typeof resize==='function') resize(); }catch(e){}
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
