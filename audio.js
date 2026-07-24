// ═══════════════════════════════════════════════════════════════════════
// AUDIO.JS — Son de match en direct (ambiance + événements)
// ═══════════════════════════════════════════════════════════════════════
// Le son existait déjà (record.js) mais uniquement branché sur l'enregistrement
// vidéo, jamais sur les haut-parleurs. Ce module ajoute un vrai son EN DIRECT :
// rumeur de foule continue, sifflets, bruits de frappe/passe, montée sur les
// buts. Tout est synthétisé (Web Audio, aucun fichier à charger), donc léger et
// sans téléchargement. Désactivé par défaut ; activable dans les Paramètres.
//
// Contrainte navigateur : l'AudioContext ne démarre qu'après une interaction
// utilisateur (clic). On l'initialise donc au premier clic, pas au chargement.
// ═══════════════════════════════════════════════════════════════════════

(function(){
'use strict';

let actx=null, master=null, crowdGain=null, crowdFilter=null, crowdSrc=null;
let enabled=false, started=false;
let _lastKick=0, _lastCrowdReact=0;

// Préférence persistante.
try{ enabled = localStorage.getItem('footsim_sound')==='1'; }catch(e){}

function _ensureContext(){
  if(actx) return true;
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC) return false;
  try{
    actx=new AC();
    master=actx.createGain();
    master.gain.value=0.7;
    master.connect(actx.destination); // ← HAUT-PARLEURS (diff. de record.js)

    // Rumeur de foule : bruit filtré, boucle continue à faible volume.
    const len=Math.floor(actx.sampleRate*4);
    const buf=actx.createBuffer(1, len, actx.sampleRate);
    const d=buf.getChannelData(0);
    let b0=0,b1=0,b2=0;
    for(let i=0;i<len;i++){
      const w=Math.random()*2-1;
      b0=0.99765*b0+w*0.0990460;
      b1=0.96300*b1+w*0.2965164;
      b2=0.57000*b2+w*1.0526913;
      d[i]=(b0+b1+b2+w*0.1848)*0.06;
    }
    crowdSrc=actx.createBufferSource();
    crowdSrc.buffer=buf; crowdSrc.loop=true;
    crowdFilter=actx.createBiquadFilter();
    crowdFilter.type='lowpass'; crowdFilter.frequency.value=680;
    crowdGain=actx.createGain(); crowdGain.gain.value=0.12;
    crowdSrc.connect(crowdFilter); crowdFilter.connect(crowdGain); crowdGain.connect(master);
    crowdSrc.start(0);
    return true;
  }catch(e){ actx=null; return false; }
}

function _resume(){ if(actx && actx.state==='suspended') actx.resume().catch(()=>{}); }

// ── SONS D'ÉVÉNEMENTS ────────────────────────────────────────────────────

// Frappe / passe : impact court et sec (bruit filtré + clic).
function kick(strength){
  if(!enabled||!actx) return;
  const now=performance.now();
  if(now-_lastKick<45) return; // anti-spam
  _lastKick=now;
  try{
    const t=actx.currentTime;
    const s=clampNum(strength,0.3,1);
    // Corps de l'impact : oscillateur grave qui chute vite.
    const o=actx.createOscillator(), g=actx.createGain();
    o.type='triangle';
    o.frequency.setValueAtTime(150+120*s, t);
    o.frequency.exponentialRampToValueAtTime(60, t+0.08);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18*s, t+0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t+0.12);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t+0.14);
    // Petit "thock" de contact : bruit très bref filtré.
    const nb=actx.createBufferSource();
    const L=Math.floor(actx.sampleRate*0.05);
    const b=actx.createBuffer(1,L,actx.sampleRate); const dd=b.getChannelData(0);
    for(let i=0;i<L;i++) dd[i]=(Math.random()*2-1)*Math.pow(1-i/L,3);
    nb.buffer=b;
    const nf=actx.createBiquadFilter(); nf.type='bandpass'; nf.frequency.value=1200; nf.Q.value=0.8;
    const ng=actx.createGain(); ng.gain.value=0.10*s;
    nb.connect(nf); nf.connect(ng); ng.connect(master);
    nb.start(t);
  }catch(e){}
}

// Sifflet de l'arbitre.
function whistle(long){
  if(!enabled||!actx) return;
  try{
    const t=actx.currentTime;
    const dur=long?0.9:0.5;
    const g=actx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.20, t+0.02);
    g.gain.linearRampToValueAtTime(0.20, t+dur-0.1);
    g.gain.linearRampToValueAtTime(0, t+dur);
    const lfo=actx.createOscillator(), lfoG=actx.createGain();
    lfo.frequency.value=24; lfoG.gain.value=65; lfo.connect(lfoG);
    [2100,2680].forEach(f=>{
      const o=actx.createOscillator(); o.type='sine'; o.frequency.value=f;
      lfoG.connect(o.frequency); o.connect(g); o.start(t); o.stop(t+dur+0.05);
    });
    lfo.start(t); lfo.stop(t+dur+0.05);
    g.connect(master);
  }catch(e){}
}

// Montée de foule (but marqué) : la rumeur enfle et s'ouvre dans les aigus.
function cheer(){
  if(!enabled||!actx||!crowdGain) return;
  try{
    const t=actx.currentTime;
    crowdGain.gain.cancelScheduledValues(t);
    crowdGain.gain.setValueAtTime(crowdGain.gain.value, t);
    crowdGain.gain.linearRampToValueAtTime(0.75, t+0.15);
    crowdGain.gain.linearRampToValueAtTime(0.12, t+5.5);
    crowdFilter.frequency.cancelScheduledValues(t);
    crowdFilter.frequency.setValueAtTime(crowdFilter.frequency.value, t);
    crowdFilter.frequency.linearRampToValueAtTime(3400, t+0.15);
    crowdFilter.frequency.linearRampToValueAtTime(680, t+5.5);
  }catch(e){}
}

// Réaction courte de foule (occasion, tir, corner) : petit "ooh".
function crowdReact(intensity){
  if(!enabled||!actx||!crowdGain) return;
  const now=performance.now();
  if(now-_lastCrowdReact<800) return;
  _lastCrowdReact=now;
  try{
    const t=actx.currentTime;
    const peak=0.12+clampNum(intensity,0,1)*0.35;
    crowdGain.gain.cancelScheduledValues(t);
    crowdGain.gain.setValueAtTime(crowdGain.gain.value, t);
    crowdGain.gain.linearRampToValueAtTime(peak, t+0.12);
    crowdGain.gain.linearRampToValueAtTime(0.12, t+1.6);
  }catch(e){}
}

function clampNum(v,a,b){ return Math.max(a,Math.min(b,typeof v==='number'&&isFinite(v)?v:a)); }

// ── API PUBLIQUE ─────────────────────────────────────────────────────────
window.gameAudio = {
  kick, whistle, cheer, crowdReact,
  isEnabled: ()=>enabled,
  // Bascule le son. Démarre l'AudioContext au besoin (dans le geste de clic).
  toggle(){
    enabled=!enabled;
    try{ localStorage.setItem('footsim_sound', enabled?'1':'0'); }catch(e){}
    if(enabled){ _ensureContext(); _resume(); }
    else if(actx){ try{ actx.suspend(); }catch(e){} }
    return enabled;
  },
  // À appeler sur le premier geste utilisateur pour débloquer l'audio.
  primeOnGesture(){
    if(!enabled) return;
    if(_ensureContext()) _resume();
  },
};

// Débloque l'audio au premier clic (exigence navigateur), si le son est activé.
window.addEventListener('pointerdown', ()=>{ if(enabled){ _ensureContext(); _resume(); } }, {once:false});

// ── BRANCHEMENT SUR LES ÉVÉNEMENTS DE JEU ────────────────────────────────
// On écoute l'événement de but déjà émis par le moteur.
window.addEventListener('footsim:goal', ()=>{ cheer(); whistle(false); });
window.addEventListener('footsim:matchend', ()=>{ whistle(true); });

})();
