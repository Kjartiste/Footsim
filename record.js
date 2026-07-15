// ═══════════════════════════════════════════════════════════
// ENREGISTREMENT VIDÉO DU MATCH (canvas → fichier .mp4/.webm)
// ═══════════════════════════════════════════════════════════
// Principe : le canvas #cvs est déjà dessiné à 60fps par la boucle de jeu
// (visual.js / frame()). On capture ce canvas avec captureStream() et on
// encode le flux avec MediaRecorder. Aucune ré-implémentation du rendu :
// on enregistre exactement ce que le joueur voit à l'écran.
//
// Limite honnête : MediaRecorder ne produit du vrai H.264-in-MP4 que si le
// navigateur embarque un encodeur H.264 (Chrome/Edge sur la plupart des
// postes, pas systématiquement sur Linux). À défaut, on retombe sur du
// VP9-in-MP4 (lisible par VLC/Chrome/Firefox, mais pas toujours par de
// vieux éditeurs comme Premiere/iMovie), puis en dernier recours sur du
// .webm si le conteneur MP4 lui-même n'est pas supporté par le navigateur.
// Le nom de fichier reste toujours en .mp4 ou .webm selon ce qui a
// réellement été produit — jamais un .mp4 mensonger contenant un flux
// que rien ne peut lire.

(function(){
  let recorder=null;
  let chunks=[];
  let recStartTs=0;
  let recTimerInt=null;
  let outExt='mp4';

  // Ordre de préférence : H.264-in-MP4 (le plus compatible avec les
  // éditeurs vidéo), puis VP9-in-MP4, puis VP9/VP8-in-WebM en dernier
  // recours si le navigateur ne sait pas du tout muxer en MP4.
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

  function sanitize(s){
    return String(s||'Equipe').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'')||'Equipe';
  }

  function buildFilename(ext){
    // `teams` et `G` sont déclarés avec `let`/`const` en haut de data.js et
    // engine.js : ce ne sont PAS des propriétés de `window` (contrairement à
    // `var`), donc `window.teams` est toujours undefined même quand `teams`
    // est parfaitement accessible en tant que variable globale du script. Il
    // faut les lire directement (avec un typeof pour rester safe si jamais
    // ce module se chargeait avant data.js/engine.js).
    const T=(typeof teams!=='undefined')?teams:null;
    const Gv=(typeof G!=='undefined')?G:null;
    const n0=sanitize(T && T[0] && T[0].name);
    const n1=sanitize(T && T[1] && T[1].name);
    const s0=(Gv && Gv.scores && Gv.scores[0])||0;
    const s1=(Gv && Gv.scores && Gv.scores[1])||0;
    const d=new Date();
    const pad=n=>String(n).padStart(2,'0');
    const stamp=`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
    return `${n0}_${s0}-${s1}_${n1}_${stamp}.${ext}`;
  }

  function fmtTime(sec){
    const m=Math.floor(sec/60), s=Math.floor(sec%60);
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  function setBtnUI(recording){
    const btn=document.getElementById('rec-btn');
    if(!btn) return;
    if(recording){
      btn.classList.add('rec-active');
      btn.title='Arrêter l\'enregistrement et télécharger la vidéo';
    } else {
      btn.classList.remove('rec-active');
      btn.textContent='⏺ REC';
      btn.title='Enregistrer le match en vidéo (.mp4)';
    }
  }

  function startRecording(){
    if(recorder && recorder.state==='recording') return stopRecording();
    const cvs=document.getElementById('cvs');
    if(!cvs){ alert('Canvas introuvable.'); return; }
    if(typeof cvs.captureStream!=='function'){
      alert('Ce navigateur ne prend pas en charge l\'enregistrement du canvas (captureStream indisponible).');
      return;
    }
    const choice=pickMime();
    if(!choice){
      alert('Aucun format vidéo supporté par ce navigateur (MediaRecorder indisponible).');
      return;
    }
    outExt=choice.ext;

    // Gèle la taille du canvas pour toute la durée de l'enregistrement :
    // voir le guard sur window._recLocked dans visual.js (resize()/frame()).
    window._recLocked=true;

    const stream=cvs.captureStream(30); // 30 fps, largement suffisant pour du 2D
    chunks=[];
    try{
      recorder=new MediaRecorder(stream,{mimeType:choice.mime,videoBitsPerSecond:6_000_000});
    }catch(e){
      window._recLocked=false;
      alert('Impossible de démarrer l\'enregistrement : '+e.message);
      return;
    }
    recorder.ondataavailable=e=>{ if(e.data && e.data.size>0) chunks.push(e.data); };
    recorder.onstop=onRecordingStopped;
    recorder.onerror=e=>{ console.error('MediaRecorder error:',e); };
    recorder.start(1000); // chunk toutes les secondes : évite de tout perdre en cas de crash

    recStartTs=performance.now();
    setBtnUI(true);
    const btn=document.getElementById('rec-btn');
    recTimerInt=setInterval(()=>{
      if(btn) btn.textContent='⏺ '+fmtTime((performance.now()-recStartTs)/1000);
    },500);
  }

  function stopRecording(){
    if(!recorder || recorder.state==='inactive') return;
    recorder.stop();
    clearInterval(recTimerInt);
    recTimerInt=null;
  }

  function onRecordingStopped(){
    window._recLocked=false;
    // Le wrap a pu changer de taille pendant qu'on était gelé (fenêtre
    // redimensionnée, panneau ouvert…) : on réaligne le canvas maintenant
    // que ça n'affecte plus la vidéo déjà enregistrée.
    if(typeof resize==='function') resize();

    const mimeType=recorder.mimeType||'video/mp4';
    const blob=new Blob(chunks,{type:mimeType});
    chunks=[];
    const url=URL.createObjectURL(blob);
    const filename=buildFilename(outExt);
    const a=document.createElement('a');
    a.href=url; a.download=filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),10000);

    setBtnUI(false);

    if(outExt!=='mp4'){
      console.warn('Enregistrement produit en .webm : ce navigateur ne sait pas encoder de MP4 lisible. Le fichier reste une vidéo valide, juste dans un autre conteneur.');
    }
  }

  window.toggleMatchRecording=function(){
    if(recorder && recorder.state==='recording') stopRecording();
    else startRecording();
  };

  // Sécurité : si l'utilisateur quitte la page/l'onglet en cours
  // d'enregistrement, on tente de finaliser proprement pour ne pas perdre
  // les chunks déjà capturés.
  window.addEventListener('beforeunload',()=>{
    if(recorder && recorder.state==='recording') recorder.stop();
  });
})();
