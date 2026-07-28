// ═══════════════════════════════════════════════════════════════════════
// DEVTOOLS.JS — Vue développeur (code Konami)
// ═══════════════════════════════════════════════════════════════════════
// Tape le code Konami (↑ ↑ ↓ ↓ ← → ← → B A) pour ouvrir un panneau d'outils
// de test : forcer un but, une exclusion, changer le score, la vitesse,
// déclencher un coup franc/corner, tester l'entrée des joueurs, etc.
// Purement pour tester — n'affecte pas le jeu tant qu'on ne l'ouvre pas.
// ═══════════════════════════════════════════════════════════════════════

(function(){
'use strict';

const SEQ=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let pos=0;

window.addEventListener('keydown', (e)=>{
  const k=(e.key||'').length===1 ? e.key.toLowerCase() : e.key;
  if(k===SEQ[pos]){
    pos++;
    if(pos===SEQ.length){ pos=0; toggleDevPanel(); }
  } else {
    pos = (k===SEQ[0]) ? 1 : 0;
  }
});

function el(id){ return document.getElementById(id); }

function toggleDevPanel(){
  let p=el('dev-panel');
  if(p){ p.remove(); return; }
  p=document.createElement('div');
  p.id='dev-panel';
  p.style.cssText='position:fixed;top:10px;right:10px;z-index:99999;background:rgba(12,16,20,.96);border:1px solid #3a4;border-radius:10px;padding:12px;width:250px;font-family:monospace;font-size:11px;color:#cfe;box-shadow:0 8px 30px rgba(0,0,0,.6);max-height:90vh;overflow-y:auto';
  p.innerHTML = `
    <div style="font-weight:bold;color:#6f9;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
      <span>⚙ DEV MODE</span>
      <span style="cursor:pointer;color:#f66" onclick="document.getElementById('dev-panel').remove()">✕</span>
    </div>
    <div id="dev-body"></div>
  `;
  document.body.appendChild(p);
  renderDevBody();
}

function btn(label, onclick){
  return `<button style="width:100%;margin:2px 0;padding:6px;background:#1a2a1a;border:1px solid #3a4;border-radius:5px;color:#cfe;cursor:pointer;font-family:monospace;font-size:11px" onclick="${onclick}">${label}</button>`;
}

function renderDevBody(){
  const b=el('dev-body'); if(!b) return;
  const s0=(G&&G.scores)?G.scores[0]:0, s1=(G&&G.scores)?G.scores[1]:0;
  b.innerHTML = `
    <div style="margin-bottom:6px;color:#9cf">Score : ${s0} — ${s1} | ${G?G.minute:0}' | ${G?G.phase:'?'}</div>
    <div style="color:#7a8;margin:6px 0 2px">— Match —</div>
    ${btn('⚽ But équipe 0', 'window._dev.goal(0)')}
    ${btn('⚽ But équipe 1', 'window._dev.goal(1)')}
    ${btn('🟥 Exclure un joueur éq.0', 'window._dev.redCard(0)')}
    ${btn('🟥 Exclure un joueur éq.1', 'window._dev.redCard(1)')}
    <div style="color:#7a8;margin:6px 0 2px">— Coups de pied arrêtés —</div>
    ${btn('Coup franc éq.0', 'window._dev.setPhase("FREEKICK",0)')}
    ${btn('Corner éq.0', 'window._dev.setPhase("CORNER",0)')}
    ${btn('Touche éq.0', 'window._dev.setPhase("THROWIN",0)')}
    <div style="color:#7a8;margin:6px 0 2px">— Vitesse —</div>
    <div style="display:flex;gap:3px">
      ${btn('×1', 'window._dev.speed(1)')}
      ${btn('×2', 'window._dev.speed(2)')}
      ${btn('×3', 'window._dev.speed(3)')}
      ${btn('×5', 'window._dev.speed(5)')}
    </div>
    <div style="color:#7a8;margin:6px 0 2px">— Divers —</div>
    ${btn('Rejouer l&#39;entrée des joueurs', 'window._dev.walkout()')}
    ${btn('Régénérer MP de tous', 'window._dev.refillMp()')}
    ${btn('Soigner tout le monde', 'window._dev.healAll()')}
    ${btn('Fin de match immédiate', 'window._dev.endMatch()')}
  `;
}

// ── ACTIONS ────────────────────────────────────────────────────────────
window._dev = {
  goal(ti){
    try{
      const sc=pick_(actP_(ti).filter(p=>p.pos!=='GB'))||actP_(ti)[0];
      if(sc && typeof goalScored==='function'){ goalScored(sc, ti, ti===0?WW:0, null); }
      else if(G&&G.scores){ G.scores[ti]++; }
      renderDevBody();
    }catch(e){ console.warn(e); }
  },
  redCard(ti){
    try{
      const victim=pick_(actP_(ti).filter(p=>p.pos!=='GB'));
      if(victim){
        victim.red=true;
        if(typeof showRedCard==='function') showRedCard(victim);
        if(typeof logEvent==='function') logEvent(`🟥 [DEV] ${victim.name} exclu`, '#e02030');
        if(typeof onPlayerSentOff==='function') onPlayerSentOff(ti);
      }
      renderDevBody();
    }catch(e){ console.warn(e); }
  },
  setPhase(ph, ti){
    try{ if(G){ G.atkTi=ti; } if(typeof setPhase==='function') setPhase(ph); }catch(e){}
  },
  speed(m){
    try{ window.speedMult=m; if(typeof speedMult!=='undefined'){ speedMult=m; } }catch(e){}
    try{ const inp=document.getElementById('speed-slider'); if(inp){ inp.value=m; inp.dispatchEvent(new Event('input')); } }catch(e){}
  },
  walkout(){
    try{
      if(typeof startWalkout==='function'){
        const atk=(G&&G._kickoffTi!=null)?G._kickoffTi:0;
        startWalkout(atk, ()=>{});
      }
    }catch(e){}
  },
  refillMp(){ try{ [0,1].forEach(ti=>teams[ti].players.forEach(p=>{if(p)p.mp=100;})); }catch(e){} },
  healAll(){ try{ [0,1].forEach(ti=>teams[ti].players.forEach(p=>{if(p){p.hp=100;p.stunT=0;p.injLevel=0;}})); }catch(e){} },
  endMatch(){ try{ if(G){ G.minute=90; } }catch(e){} },
};

// Helpers robustes (au cas où actP/pick ne soient pas globaux).
function actP_(ti){ try{ return (typeof actP==='function')?actP(ti):teams[ti].players.filter(p=>p&&!p.red&&p.hp>0); }catch(e){ return []; } }
function pick_(a){ return (a&&a.length)?a[Math.floor(Math.random()*a.length)]:null; }

})();
