// ═══════════════════════════════════════════════════════════════════════
// AUDIO.JS — Son de match en direct (ambiance + événements)
// ═══════════════════════════════════════════════════════════════════════
// Le son existait déjà (record.js) mais uniquement branché sur l'enregistrement
// vidéo, jamais sur les haut-parleurs. Ce module ajoute un vrai son EN DIRECT :
// rumeur de foule, sifflets, bruits de frappe/passe, montée sur les buts.
// DEUX SOURCES POSSIBLES :
//   1. VRAIS BRUITAGES si des fichiers existent dans sounds/ (voir sounds/
//      LISEZ-MOI.txt) — recommandé, bien plus réaliste.
//   2. Sinon SYNTHÈSE (Web Audio, aucun fichier) — repli automatique.
// Désactivé par défaut ; activable dans les Paramètres.
//
// Contrainte navigateur : l'AudioContext ne démarre qu'après une interaction
// utilisateur (clic). On l'initialise donc au premier clic, pas au chargement.
// ═══════════════════════════════════════════════════════════════════════

(function(){
'use strict';

let actx=null, master=null, crowdGain=null, crowdFilter=null, crowdSrc=null;
let enabled=false, started=false;
let _lastKick=0, _lastCrowdReact=0;
let volume=0.8; // volume utilisateur [0,1]

// ── VRAIS ÉCHANTILLONS AUDIO (optionnels) ──────────────────────────────
// Le jeu joue de VRAIS bruitages si tu déposes des fichiers dans le dossier
// sounds/ à côté d'index.html. Sinon il retombe sur la synthèse (moins beau
// mais toujours fonctionnel). Formats acceptés : mp3, ogg, wav.
//   sounds/whistle.mp3       → sifflet court (faute, engagement)
//   sounds/whistle_long.mp3  → sifflet long (mi-temps, fin de match)
//   sounds/kick.mp3          → frappe / passe (impact de balle)
//   sounds/crowd.mp3         → ambiance de foule en boucle (fond)
//   sounds/cheer.mp3         → clameur / but
//   sounds/ooh.mp3           → réaction d'occasion (facultatif)
// Tu peux en mettre certains seulement : chaque son manquant est synthétisé.
const SAMPLE_FILES={
  whistle:      ['sounds/whistle.mp3','sounds/whistle.ogg','sounds/whistle.wav'],
  whistle_long: ['sounds/whistle_long.mp3','sounds/whistle_long.ogg','sounds/whistle_long.wav'],
  kick:         ['sounds/kick.mp3','sounds/kick.ogg','sounds/kick.wav'],
  crowd:        ['sounds/crowd.mp3','sounds/crowd.ogg','sounds/crowd.wav'],
  cheer:        ['sounds/cheer.mp3','sounds/cheer.ogg','sounds/cheer.wav'],
  ooh:          ['sounds/ooh.mp3','sounds/ooh.ogg','sounds/ooh.wav'],
  click:        ['sounds/click.mp3','sounds/click.ogg','sounds/click.wav'],
  confirm:      ['sounds/confirm.mp3','sounds/confirm.ogg','sounds/confirm.wav'],
  // Ambiances de stade par monde (fond sonore thématique, en boucle).
  ambience_panthalassa: ['sounds/ambience_panthalassa.mp3'],
  ambience_valoria:     ['sounds/ambience_valoria.mp3'],
  ambience_pilier:      ['sounds/ambience_pilier.mp3'],
  ambience_rorang:      ['sounds/ambience_rorang.mp3'],
};
const _samples={};       // nom → AudioBuffer décodé (si trouvé)
let _samplesTried=false;
let _crowdSampleSrc=null; // source de l'ambiance échantillonnée (si présente)

// Essaie de charger chaque fichier ; ignore silencieusement les absents.
async function _loadSamples(){
  if(_samplesTried||!actx) return;
  _samplesTried=true;
  for(const key of Object.keys(SAMPLE_FILES)){
    for(const url of SAMPLE_FILES[key]){
      try{
        const res=await fetch(url);
        if(!res.ok) continue;
        const buf=await res.arrayBuffer();
        const decoded=await actx.decodeAudioData(buf);
        _samples[key]=decoded;
        break; // premier format trouvé pour cette clé
      }catch(e){ /* fichier absent ou format non supporté : on ignore */ }
    }
  }
  // Si une ambiance de foule échantillonnée existe, on remplace le murmure
  // synthétique par la vraie boucle.
  if(_samples.crowd && crowdGain){
    try{
      if(crowdSrc){ try{crowdSrc.stop();}catch(e){} }
      _crowdSampleSrc=actx.createBufferSource();
      _crowdSampleSrc.buffer=_samples.crowd; _crowdSampleSrc.loop=true;
      // on court-circuite le filtre passe-bas (le vrai son est déjà réaliste)
      _crowdSampleSrc.connect(crowdGain);
      _crowdSampleSrc.start(0);
      crowdGain.gain.value=0.25; // une vraie ambiance peut être un peu plus présente
    }catch(e){}
  }
  // Lance l'ambiance thématique du monde courant (jouée sous la foule).
  const w=_currentWorld();
  if(w) _setAmbience(w);
}

// Joue un échantillon décodé, avec gain. Renvoie true si joué, false sinon.
function _playSample(key, gain, rate){
  if(!actx||!_samples[key]) return false;
  try{
    const src=actx.createBufferSource();
    src.buffer=_samples[key];
    if(rate) src.playbackRate.value=rate;
    const g=actx.createGain(); g.gain.value=(gain==null?1:gain);
    src.connect(g); g.connect(master);
    src.start(0);
    return true;
  }catch(e){ return false; }
}

// ── AMBIANCE DE STADE PAR MONDE ──────────────────────────────────────────
// Chaque monde (Panthalassa=océan, Pilier=céleste/magie, Rorang=mystique,
// Valoria=nature) a sa propre couche sonore de fond, jouée EN BOUCLE très
// discrètement SOUS le murmure de foule. Donne une identité sonore au stade
// selon le thème, au lieu d'une foule générique partout.
let _ambSrc=null, _ambGain=null, _ambKey=null;
function _setAmbience(worldId){
  if(!actx) return;
  const key='ambience_'+worldId;
  if(_ambKey===key) return;             // déjà en cours
  // Coupe l'ambiance précédente en fondu.
  if(_ambSrc){
    try{
      const t=actx.currentTime;
      _ambGain.gain.cancelScheduledValues(t);
      _ambGain.gain.setValueAtTime(_ambGain.gain.value, t);
      _ambGain.gain.linearRampToValueAtTime(0, t+0.8);
      const old=_ambSrc; setTimeout(()=>{ try{old.stop();}catch(e){} }, 900);
    }catch(e){}
    _ambSrc=null;
  }
  _ambKey=key;
  if(!_samples[key]) return;             // pas de fichier pour ce monde → rien
  try{
    _ambSrc=actx.createBufferSource();
    _ambSrc.buffer=_samples[key]; _ambSrc.loop=true;
    _ambGain=actx.createGain(); _ambGain.gain.value=0;
    _ambSrc.connect(_ambGain); _ambGain.connect(master);
    _ambSrc.start(0);
    const t=actx.currentTime;
    _ambGain.gain.linearRampToValueAtTime(0.35, t+1.2); // fond discret
  }catch(e){ _ambSrc=null; }
}
// Détecte le monde courant (partie carrière), sinon rien.
function _currentWorld(){
  try{ if(typeof careerV2==='object' && careerV2 && careerV2.nation) return careerV2.nation; }catch(e){}
  return window._audioTheme||null;
}

// Préférences persistantes.
try{ enabled = localStorage.getItem('footsim_sound')==='1'; }catch(e){}
try{ const v=parseFloat(localStorage.getItem('footsim_volume')); if(isFinite(v)) volume=Math.max(0,Math.min(1,v)); }catch(e){}

function _ensureContext(){
  if(actx) return true;
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC) return false;
  try{
    actx=new AC();
    master=actx.createGain();
    master.gain.value=2.4*volume;      // headroom relevé pour que les réactions claquent
    master.connect(actx.destination);  // ← HAUT-PARLEURS

    // ── AMBIANCE DE STADE ────────────────────────────────────────────────
    // Un vrai public, hors action, c'est un MURMURE grave et discret, pas un
    // cri continu (comme dans FIFA/PES). On génère un bruit large bande, filtré
    // en passe-bas, gardé TRÈS bas par défaut (0.08). Ce sont les RÉACTIONS
    // (occasions, buts) qui montent au-dessus — ce sont elles qu'on entend.
    const len=Math.floor(actx.sampleRate*4);
    const buf=actx.createBuffer(1, len, actx.sampleRate);
    const d=buf.getChannelData(0);
    let b0=0,b1=0,b2=0;
    for(let i=0;i<len;i++){
      const w=Math.random()*2-1;
      b0=0.99765*b0+w*0.0990460;
      b1=0.96300*b1+w*0.2965164;
      b2=0.57000*b2+w*1.0526913;
      d[i]=(b0+b1+b2+w*0.1848)*0.08;
    }
    crowdSrc=actx.createBufferSource();
    crowdSrc.buffer=buf; crowdSrc.loop=true;
    crowdFilter=actx.createBiquadFilter();
    crowdFilter.type='lowpass'; crowdFilter.frequency.value=520; // sourd = lointain
    crowdGain=actx.createGain(); crowdGain.gain.value=0.08;       // murmure discret
    crowdSrc.connect(crowdFilter); crowdFilter.connect(crowdGain); crowdGain.connect(master);
    crowdSrc.start(0);

    // Tente de charger de vrais bruitages depuis sounds/ (asynchrone, sans
    // bloquer). S'ils existent, ils remplaceront la synthèse.
    _loadSamples();

    // "Respiration" du public : une LFO très lente fait légèrement onduler le
    // murmure, pour qu'il soit vivant sans jamais devenir un cri continu.
    try{
      const breath=actx.createOscillator(), breathG=actx.createGain();
      breath.frequency.value=0.08;   // ~une oscillation toutes les 12s
      breathG.gain.value=0.03;
      breath.connect(breathG); breathG.connect(crowdGain.gain);
      breath.start(0);
    }catch(e){}
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
  // Vrai échantillon si disponible (légère variation de hauteur pour éviter la
  // répétition mécanique), sinon synthèse.
  const s0=clampNum(strength,0.3,1);
  if(_playSample('kick', 0.5+0.5*s0, 0.92+Math.random()*0.16)) return;
  try{
    const t=actx.currentTime;
    const s=clampNum(strength,0.3,1);
    // Corps de l'impact : oscillateur grave qui chute vite.
    const o=actx.createOscillator(), g=actx.createGain();
    o.type='triangle';
    o.frequency.setValueAtTime(150+120*s, t);
    o.frequency.exponentialRampToValueAtTime(60, t+0.08);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.38*s, t+0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t+0.13);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t+0.15);
    // Petit "thock" de contact : bruit très bref filtré.
    const nb=actx.createBufferSource();
    const L=Math.floor(actx.sampleRate*0.05);
    const b=actx.createBuffer(1,L,actx.sampleRate); const dd=b.getChannelData(0);
    for(let i=0;i<L;i++) dd[i]=(Math.random()*2-1)*Math.pow(1-i/L,3);
    nb.buffer=b;
    const nf=actx.createBiquadFilter(); nf.type='bandpass'; nf.frequency.value=1200; nf.Q.value=0.8;
    const ng=actx.createGain(); ng.gain.value=0.22*s;   // relevé (était 0.10)
    nb.connect(nf); nf.connect(ng); ng.connect(master);
    nb.start(t);
  }catch(e){}
}

// Sifflet de l'arbitre.
function whistle(long){
  if(!enabled||!actx) return;
  // Vrai échantillon si disponible, sinon synthèse.
  if(_playSample(long?'whistle_long':'whistle', 0.9)) return;
  try{
    const t=actx.currentTime;
    const dur=long?0.9:0.5;
    const g=actx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.42, t+0.02);
    g.gain.linearRampToValueAtTime(0.42, t+dur-0.1);
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

// Montée de foule (but marqué) : un vrai RUGISSEMENT — le murmure explose,
// s'ouvre dans les aigus, avec une couche "vocale" par-dessus pour l'énergie.
function cheer(){
  if(!enabled||!actx||!crowdGain) return;
  // Vraie clameur de but si disponible : on la joue ET on fait légèrement
  // enfler l'ambiance de fond sous elle.
  const hasSample=_playSample('cheer', 0.95);
  if(hasSample){
    try{
      const t=actx.currentTime;
      crowdGain.gain.cancelScheduledValues(t);
      crowdGain.gain.setValueAtTime(crowdGain.gain.value, t);
      crowdGain.gain.linearRampToValueAtTime(0.6, t+0.15);
      crowdGain.gain.linearRampToValueAtTime(_samples.crowd?0.25:0.08, t+5.0);
    }catch(e){}
    return;
  }
  try{
    const t=actx.currentTime;
    // 1) La rumeur de fond explose brièvement puis retombe lentement.
    crowdGain.gain.cancelScheduledValues(t);
    crowdGain.gain.setValueAtTime(crowdGain.gain.value, t);
    crowdGain.gain.linearRampToValueAtTime(0.95, t+0.12);
    crowdGain.gain.linearRampToValueAtTime(0.08, t+6.0);
    crowdFilter.frequency.cancelScheduledValues(t);
    crowdFilter.frequency.setValueAtTime(crowdFilter.frequency.value, t);
    crowdFilter.frequency.linearRampToValueAtTime(4200, t+0.12); // s'ouvre (brillant)
    crowdFilter.frequency.linearRampToValueAtTime(520, t+6.0);
    // 2) Couche "vocale" : plusieurs bandes de bruit filtrées façon "AAAH" de
    // foule, avec une petite montée de hauteur — donne l'énergie du cri qui
    // manque au simple bruit filtré.
    const L=Math.floor(actx.sampleRate*2.2);
    const b=actx.createBuffer(1,L,actx.sampleRate); const dd=b.getChannelData(0);
    for(let i=0;i<L;i++) dd[i]=(Math.random()*2-1);
    const roar=actx.createBufferSource(); roar.buffer=b;
    const rf=actx.createBiquadFilter(); rf.type='bandpass'; rf.Q.value=0.7;
    rf.frequency.setValueAtTime(500, t);
    rf.frequency.linearRampToValueAtTime(1400, t+0.5);   // "montée" du cri
    rf.frequency.linearRampToValueAtTime(700, t+2.2);
    const rg=actx.createGain();
    rg.gain.setValueAtTime(0.0001, t);
    rg.gain.linearRampToValueAtTime(0.5, t+0.15);
    rg.gain.exponentialRampToValueAtTime(0.0001, t+2.2);
    roar.connect(rf); rf.connect(rg); rg.connect(master);
    roar.start(t); roar.stop(t+2.3);
  }catch(e){}
}

// Réaction courte de foule (occasion, tir, corner) : petit "ooh".
function crowdReact(intensity){
  if(!enabled||!actx||!crowdGain) return;
  const now=performance.now();
  if(now-_lastCrowdReact<800) return;
  _lastCrowdReact=now;
  const inten0=clampNum(intensity,0,1);
  // Vraie réaction "ooh" si disponible (volume selon l'intensité de l'occasion).
  if(inten0>0.35 && _playSample('ooh', 0.4+0.6*inten0)){ return; }
  try{
    const t=actx.currentTime;
    const inten=inten0;
    // "Ooh" d'anticipation : le murmure enfle un instant puis revient au calme
    // (baseline 0.08). Le filtre s'ouvre un peu pour un son plus présent.
    const peak=0.08+inten*0.5;
    crowdGain.gain.cancelScheduledValues(t);
    crowdGain.gain.setValueAtTime(crowdGain.gain.value, t);
    crowdGain.gain.linearRampToValueAtTime(peak, t+0.14);
    crowdGain.gain.linearRampToValueAtTime(0.08, t+1.8);
    crowdFilter.frequency.cancelScheduledValues(t);
    crowdFilter.frequency.setValueAtTime(crowdFilter.frequency.value, t);
    crowdFilter.frequency.linearRampToValueAtTime(1400+inten*1200, t+0.14);
    crowdFilter.frequency.linearRampToValueAtTime(520, t+1.8);
  }catch(e){}
}

function clampNum(v,a,b){ return Math.max(a,Math.min(b,typeof v==='number'&&isFinite(v)?v:a)); }

// ── API PUBLIQUE ─────────────────────────────────────────────────────────
window.gameAudio = {
  kick, whistle, cheer, crowdReact,
  // Son d'interface (clic bouton / validation). Léger, joué sur les
  // interactions de menu. Utilise de vrais échantillons si présents.
  ui(kind){
    if(!enabled) return;
    if(!_ensureContext()) return;
    _resume();
    _playSample(kind==='confirm'?'confirm':'click', kind==='confirm'?0.5:0.35, 0.98+Math.random()*0.06);
  },
  isEnabled: ()=>enabled,
  // Change l'ambiance de stade selon le monde ('panthalassa','valoria',
  // 'pilier','rorang'). Appelable à tout moment ; fondu automatique.
  setTheme(worldId){
    window._audioTheme=worldId||null;
    if(enabled && actx && worldId) _setAmbience(worldId);
  },
  getVolume: ()=>volume,
  // Règle le volume global [0,1], persistant, appliqué en direct.
  setVolume(v){
    volume=Math.max(0,Math.min(1, (typeof v==='number'&&isFinite(v))?v:0.8));
    try{ localStorage.setItem('footsim_volume', String(volume)); }catch(e){}
    if(master){ try{ master.gain.setTargetAtTime(2.4*volume, actx.currentTime, 0.05); }catch(e){ master.gain.value=2.4*volume; } }
    return volume;
  },
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
  // Joue un aperçu (pour régler le volume à l'oreille) : une frappe, une
  // réaction d'occasion, puis le rugissement de but.
  test(){ if(_ensureContext()){ _resume(); kick(0.9); setTimeout(()=>crowdReact(0.7),300); setTimeout(()=>cheer(),1100); } },
};

// Débloque l'audio au premier clic (exigence navigateur), si le son est activé.
window.addEventListener('pointerdown', ()=>{ if(enabled){ _ensureContext(); _resume(); } }, {once:false});

// ── SONS D'INTERFACE (ciblés) ────────────────────────────────────────────
// On ne sonorise PAS tous les boutons (ça devient vite fatigant) : seulement
// la NAVIGATION entre onglets (.ntab) et les ACTIONS FORTES (lancer un match,
// valider). Le reste des boutons reste silencieux.
window.addEventListener('pointerdown', (e)=>{
  if(!enabled) return;
  const el=e.target && e.target.closest ? e.target.closest('.ntab,button,.btn') : null;
  if(!el) return;
  const txt=(el.textContent||'').toLowerCase();
  const isTab=el.classList.contains('ntab');
  const isStrong=/jouer|lancer|valider|confirm|démarr|commenc|coup d.envoi|rejouer/.test(txt)
    || el.classList.contains('btn-primary') || el.classList.contains('play-btn');
  // Onglet → petit clic ; action forte → validation ; autres boutons → rien.
  if(isStrong){ try{ window.gameAudio.ui('confirm'); }catch(err){} }
  else if(isTab){ try{ window.gameAudio.ui('click'); }catch(err){} }
}, true);

// ── BRANCHEMENT SUR LES ÉVÉNEMENTS DE JEU ────────────────────────────────
// On écoute l'événement de but déjà émis par le moteur.
window.addEventListener('footsim:goal', ()=>{ cheer(); whistle(false); });
window.addEventListener('footsim:matchend', ()=>{ whistle(true); });

})();
