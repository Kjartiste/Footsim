// ═══════════════════════════════════════════════════
// UI.JS — Interface, menus, modals, ligue, coupe
// ═══════════════════════════════════════════════════
let htSel={ti:-1,bi:-1}; // selected bench player

function pmTab(tab){
  ['match','compo','prono','tac'].forEach(t=>{
    const panel=document.getElementById('pm-panel-'+t);
    const btn=document.getElementById('pm-tab-'+t);
    if(panel) panel.style.display=t===tab?'':'none';
    if(btn){
      btn.style.background=t===tab?'var(--card)':'transparent';
      btn.style.color=t===tab?'var(--text)':'var(--muted)';
      btn.style.borderBottom=t===tab?'2px solid #18c860':'2px solid transparent';
    }
  });
  if(tab==='tac'){
    renderTacSlidersInto(0,'pm-tac-0');
    renderTacSlidersInto(1,'pm-tac-1');
    renderPlayerRolesInto(0,'pm-roles-0');
    renderPlayerRolesInto(1,'pm-roles-1');
  }
}

function renderPlayerRolesInto(ti, containerId){
  const targetEl = document.getElementById(containerId);
  if(!targetEl) return;
  renderPlayerRoles(ti, targetEl);
}

// Render sliders into any container (used by prematch modal + sp-tactic)
function renderTacSlidersInto(ti, containerId){
  const targetEl = document.getElementById(containerId);
  if(!targetEl) return;
  renderTacSliders(ti, targetEl);
}

function openPreMatchLineup(){
  document.getElementById('prematch-modal').classList.remove('on');
  openHalftime(true,'prematch');
}

function openHalftime(preMatch=false, mode='halftime'){
  const[s0,s1]=G.scores;
  const titles={
    halftime:'⏸ Mi-Temps',
    prolong1:'⏸ Avant 1re Prolongation',
    prolong2:'⏸ Pause Prolongation',
    prematch:'✏️ Composition',
    penalties:'⏸ Avant Tirs au But'
  };
  const btnLabels={
    halftime:'▶ Lancer la 2e mi-temps',
    prolong1:'▶ Lancer la 1re prolongation',
    prolong2:'▶ Lancer la 2e prolongation',
    prematch:'✓ Valider et retour',
    penalties:'⚽ Lancer les tirs au but'
  };

  document.querySelector('#htmodal .ht-title').textContent=titles[mode]||titles.halftime;
  document.getElementById('ht-score').innerHTML=preMatch
    ?`<span style="font-size:11px;color:var(--muted);font-weight:400">Composition avant le match</span>`
    :`<span style="color:${teams[0].color}">${s0}</span> <span style="color:var(--muted)">—</span> <span style="color:${teams[1].color}">${s1}</span>`;
  const gifPanel=document.getElementById('ht-gif-panel');
  if(gifPanel) gifPanel.innerHTML=_gifPanelHTML(true);
  const htCopy=document.getElementById('ht-copy-panel');
  if(htCopy && mode!=='prematch'){
    const isHalf1=mode==='halftime';
    htCopy.innerHTML=`<button class="btn ht-copy-btn" style="width:100%;justify-content:center;font-size:10px;margin-bottom:8px" onclick="copyMatchLog('${isHalf1?'half1':'live'}')">📋 Copier ce journal</button>`;
  }

  const resumeBtn=document.querySelector('#htmodal .btn.btng');
  if(resumeBtn){
    resumeBtn.textContent=btnLabels[mode]||btnLabels.halftime;
    const close=()=>document.getElementById('htmodal').classList.remove('on');
    resumeBtn.onclick=
      mode==='prematch'  ? ()=>{close();try{showPreMatch(window._prematchOnStart);}catch(e){document.getElementById('prematch-modal').classList.add('on');}} :
      mode==='prolong1'  ? ()=>{close();G.running=true;G._paused=false;_triggerAuraDivine();_triggerConcert();document.getElementById('mbtn').textContent='⏸ Pause';_gifArmIfNeeded();} :
      mode==='prolong2'  ? ()=>{close();placeKickoff(1-G._kickoffTi);setPhase('KICKOFF');G.running=true;G._paused=false;_triggerAuraDivine();_triggerConcert();document.getElementById('hphase').textContent='2e PROLONGATION';document.getElementById('mbtn').textContent='⏸ Pause';_gifArmIfNeeded();} :
      mode==='penalties' ? ()=>{close();startPenaltyShootout();} :
      resumeSecondHalf;
  }
  try{ renderHtTeams(); }catch(e){ console.error('renderHtTeams failed:',e); }
  try{ renderHtTactics(mode); }catch(e){ console.error('renderHtTactics failed:',e); const w=document.getElementById('ht-tactics-section'); if(w)w.innerHTML=''; }
  document.getElementById('htmodal').classList.add('on');
}

// Onglet tactique actif dans le modal de mi-temps
let _htTacTi=0;
function renderHtTactics(mode){
  const wrap=document.getElementById('ht-tactics-section');
  if(!wrap)return;
  if(mode==='penalties'){wrap.innerHTML='';return;} // pas de tactique avant les tirs au but
  const tab=(ti)=>{
    const on=_htTacTi===ti;const c=teams[ti]?.color||'#888';
    return `<button onclick="_htTacTi=${ti};renderHtTactics()" style="flex:1;font-size:11px;font-weight:800;padding:6px;border-radius:6px;cursor:pointer;border:1px solid ${on?c:'var(--b1)'};background:${on?c+'22':'transparent'};color:${on?c:'var(--muted)'}">${teams[ti]?.name||'—'}</button>`;
  };
  wrap.innerHTML=`
    <details style="background:var(--panel);border:1px solid var(--b1);border-radius:8px;padding:8px 10px;margin-bottom:10px" open>
      <summary style="cursor:pointer;font-size:11px;font-weight:800;color:var(--gold);letter-spacing:1px;list-style:none">♟ AJUSTER LA TACTIQUE</summary>
      <div style="display:flex;gap:5px;margin:8px 0">${tab(0)}${tab(1)}</div>
      <div id="ht-tac-sliders"></div>
    </details>`;
  renderTacSliders(_htTacTi, document.getElementById('ht-tac-sliders'));
}

function renderHtTeams(){
  htSel={ti:-1,bi:-1};
  document.getElementById('ht-teams').innerHTML=teams.slice(0,2).map((T,ti)=>`
    <div class="ht-team">
      <div class="ht-team-hd"><div style="width:8px;height:8px;border-radius:50%;background:${T.color};flex-shrink:0"></div>${T.name}</div>
      ${T.players.filter(Boolean).map((p,pi)=>{
        const hp=Math.round(p.hp),hc=hp>55?'#18c860':hp>28?'#f08030':'#e02030';
        const mp=Math.round(p.mp),mc=mp>60?'#8840e0':mp>30?'#5c6bc0':'#3949ab';
        const injBadge=p.injLevel>0?`<span style="color:${INJ_COLORS[p.injLevel]};font-size:10px;margin-left:2px">${['','🤕','🚑','🆘'][p.injLevel]}</span>`:'';
        const missBadge=p._missNextMatch?`<span style="font-size:9px;color:#e02030" title="Indisponible prochain match">🚫</span>`:'';
        const forceOut=p.injLevel>=3;
        const POSTES=['GB','DC','DD','DG','MC','MDC','MO','AD','AG','ATT'];
        return `<div class="ht-prow${forceOut?' sel-target':''}" id="ht-s${ti}-${pi}" onclick="htClickStarter(${ti},${pi})" style="${forceOut?'opacity:.55;cursor:not-allowed':'cursor:pointer'}">
          <select class="ht-pos" style="font-size:8px;color:var(--muted);font-weight:700;background:transparent;border:none;cursor:pointer;padding:0;min-width:36px;outline:none"
            onchange="htChangePos(${ti},${pi},this.value)" onclick="event.stopPropagation()">
            ${POSTES.map(pos=>`<option value="${pos}"${p.pos===pos?' selected':''}>${pos}</option>`).join('')}
          </select>
          <span class="ht-pname">${p.name}${injBadge}${missBadge}</span>
          <span style="font-size:8px;font-weight:700;color:${teams[ti].color};min-width:30px;text-align:center">${Math.round(Object.values(p.s||{}).reduce((a,v)=>a+v,0)/Math.max(1,Object.values(p.s||{}).length))}</span>
          <div style="display:flex;flex-direction:column;gap:2px;flex:1;max-width:44px">
            <div class="ht-hpbar"><div class="ht-hpfill" style="width:${hp}%;background:${hc}"></div></div>
            <div class="ht-hpbar"><div class="ht-hpfill" style="width:${mp}%;background:${mc}"></div></div>
          </div>
          <span style="font-size:8px;color:${forceOut?'var(--red)':'var(--muted)'};min-width:38px;text-align:right">${forceOut?'⚠️ Sort':hp+'% '+mp+'✨'}</span>
        </div>`;
      }).join('')}
      <div class="ht-bench-sep">🪑 Banc</div>
      ${(T.bench||[]).filter(Boolean).map((p,bi)=>{
        const avail=p.onBench&&(p.injLevel||0)<2&&!p.subbedOut;
        const injBadge=p.injLevel>0?`<span style="color:${INJ_COLORS[p.injLevel]};font-size:10px;margin-left:2px">${['','🤕','🚑','🆘'][p.injLevel]}</span>`:'';
        return `<div class="ht-prow" id="ht-b${ti}-${bi}" onclick="${avail?`htClickBench(${ti},${bi})`:'void(0)'}" style="${!avail?'opacity:.4;cursor:not-allowed':'cursor:pointer'}">
          <span class="ht-pos">${p.pos}</span>
          <span class="ht-pname">${p.name}${injBadge}</span>
          <div class="ht-hpbar"><div class="ht-hpfill" style="width:${Math.round(p.hp)}%;background:#18c860"></div></div>
          <span style="font-size:8px;color:${avail?'var(--green)':'var(--muted)'};min-width:38px;text-align:right">${p.subbedOut?'Sorti':avail?'✓ Dispo':'Indispo'}</span>
        </div>`;
      }).join('')}
      ${T.reserves?.filter(Boolean).length?`
      <div class="ht-bench-sep" style="opacity:.7">📋 Réservistes</div>
      ${T.reserves.filter(Boolean).map((p,ri)=>{
        const avail=(p.injLevel||0)<2&&!p.subbedOut;
        const injBadge=p.injLevel>0?`<span style="color:${INJ_COLORS[p.injLevel]};font-size:10px;margin-left:2px">${['','🤕','🚑','🆘'][p.injLevel]}</span>`:'';
        return `<div class="ht-prow" id="ht-r${ti}-${ri}" onclick="${avail?`htClickReserve(${ti},${ri})`:'void(0)'}" style="${!avail?'opacity:.4;cursor:not-allowed':'cursor:pointer;opacity:.85'}">
          <span class="ht-pos">${p.pos}</span>
          <span class="ht-pname">${p.name}${injBadge}</span>
          <div class="ht-hpbar"><div class="ht-hpfill" style="width:${Math.round(p.hp)}%;background:#69f0ae"></div></div>
          <span style="font-size:8px;color:${avail?'#69f0ae':'var(--muted)'};min-width:38px;text-align:right">${avail?'📋 Dispo':'Indispo'}</span>
        </div>`;
      }).join('')}`:''}
      <div class="ht-strat">
        <div class="ht-strat-lbl">Formation</div>
        ${STRATS.map(s=>`
          <div class="ht-sc${T.strat===s.id?' sel':''}" onclick="htSetStrat(${ti},'${s.id}',this)">
            <div style="width:6px;height:6px;border-radius:50%;background:${s.col};flex-shrink:0"></div>
            <span class="ht-sc-n">${s.n}</span>
            <span class="ht-sc-d"> — ${s.d}</span>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

function htClickReserve(ti,ri){
  // A reserve can SWAP with a bench player (promote reserve → bench slot)
  // Then the bench player can be used for substitution normally
  const reserve=teams[ti].reserves?.[ri];if(!reserve)return;
  if((reserve.injLevel||0)>=2||reserve.subbedOut){
    logEvent(`${reserve.name} est indisponible !`,'#e02030');return;
  }
  // If a bench player is already selected, do the swap (reserve↔bench)
  if(htSel.ti===ti&&htSel.bi>=0){
    const bench=teams[ti].bench[htSel.bi];
    // Swap reserve and bench
    teams[ti].reserves[ri]=bench;bench.onBench=true;
    teams[ti].bench[htSel.bi]=reserve;reserve.onBench=true;
    logEvent(`🔄 ${reserve.name} monte au banc (remplace ${bench.name})`,teams[ti].color);
    htSel={ti:-1,bi:-1};renderHtTeams();return;
  }
  // If a starter is selected (htSel.bi<0 but we need to check htSel differently)
  // Treat reserve click as: select this reserve as sub candidate
  // We'll re-use htSel with bi=-100-ri as a sentinel for reserves
  htSel={ti,bi:-100-ri};
  document.querySelectorAll('.ht-prow').forEach(el=>el.classList.remove('sel-bench','sel-target'));
  document.getElementById(`ht-r${ti}-${ri}`)?.classList.add('sel-bench');
  logEvent(`${reserve.name} sélectionné — cliquez sur un titulaire pour le remplacer`,teams[ti].color);
}

function htClickBench(ti,bi){
  if(!teams[ti]?.bench?.[bi])return; // guard: bench slot must exist
  htSel={ti,bi};
  // Clear all selections
  document.querySelectorAll('.ht-prow').forEach(el=>el.classList.remove('sel-bench','sel-target'));
  document.getElementById(`ht-b${ti}-${bi}`).classList.add('sel-bench');
}

function htChangePos(ti,pi,newPos){
  const p=teams[ti]?.players[pi];
  if(!p) return;
  const preMatch=_isPreMatch();
  // Il quitte le poste de gardien : s'il jouait en gardien de fortune, il
  // retrouve son poste et ses stats d'origine.
  if(p.pos==='GB'&&newPos!=='GB'&&p._emergencyGK) revertEmergencyGKMalus(p);
  // Il devient gardien en cours de match (pas en pré-match) sans en être un
  // de formation : il prend les gants avec le malus habituel.
  if(newPos==='GB'&&p.pos!=='GB'&&!preMatch&&!p._emergencyGK){
    applyEmergencyGKMalus(p); // fixe p.pos='GB' + applique le malus
    logEvent(`🧤⚠️ ${p.name} n'est pas gardien de formation — il prend les gants avec un malus !`,'#f0c028');
  } else {
    p.pos=newPos;
  }
  // Repositionner immédiatement selon le nouveau poste
  const posX={GB:.06,DC:.2,DD:.2,DG:.2,MC:.42,MDC:.38,MO:.58,AD:.68,AG:.68,ATT:.75};
  const posY={GB:.5,DC:.5,DD:.72,DG:.28,MC:.5,MDC:.5,MO:.5,AD:.72,AG:.28,ATT:.5};
  const baseX=(posX[newPos]||.5)*WW;
  const baseY=(posY[newPos]||.5)*WH;
  // Équipe 1 = symétrie horizontale
  p.tx = ti===0 ? baseX : WW-baseX;
  p.ty = baseY;
  logEvent(`🔄 ${p.name} → ${newPos}`,teams[ti].color);
}

function htClickStarter(ti,pi){
  if(htSel.ti===ti&&htSel.bi>=0){
    // Substitution banc → titulaire
    const bench=teams[ti].bench[htSel.bi];
    const starter=teams[ti].players[pi];
    if(bench.subbedOut){logEvent(`${bench.name} a déjà été remplacé !`,'#e02030');return;}
    bench.x=starter.x;bench.y=starter.y;bench.vx=0;bench.vy=0;bench.tx=starter.x;bench.ty=starter.y;
    bench.onBench=false;
    bench.stunT=0;bench.tackleCool=0;bench.runT=0;bench.runCool=0;
    bench._spdDebuff=0;bench._charmed=0;bench._atkBuff=0;bench._pacified=0;
    bench._invis=0;bench._folie=0;bench._aile=0;bench._sixsens=0;bench._sylvestre=0;
    starter.onBench=true;starter.hasBall=false;starter.subbedOut=!_isPreMatch();
    if(G.owner===starter.id)freeB();
    starter.x=-10;starter.y=PCY;
    teams[ti].players[pi]=bench;
    teams[ti].bench[htSel.bi]=starter;
    _handleGKMalusOnSwap(starter,bench,_isPreMatch());
    logEvent(`🔄 ${bench.name} remplace ${starter.name} !`,teams[ti].color);
    htSel={ti:-1,bi:-1};renderHtTeams();
  } else if(htSel.ti===ti&&htSel.bi<=-100){
    // Substitution réserviste → titulaire (direct)
    const ri=-100-htSel.bi;
    const reserve=teams[ti].reserves?.[ri];
    const starter=teams[ti].players[pi];
    if(!reserve){htSel={ti:-1,bi:-1};return;}
    reserve.x=starter.x;reserve.y=starter.y;reserve.vx=0;reserve.vy=0;reserve.tx=starter.x;reserve.ty=starter.y;
    reserve.onBench=false;
    reserve.stunT=0;reserve.tackleCool=0;reserve.runT=0;reserve.runCool=0;
    reserve._spdDebuff=0;reserve._charmed=0;reserve._atkBuff=0;reserve._pacified=0;
    reserve._invis=0;reserve._folie=0;reserve._aile=0;reserve._sixsens=0;reserve._sylvestre=0;
    starter.onBench=true;starter.hasBall=false;starter.subbedOut=!_isPreMatch();
    if(G.owner===starter.id)freeB();
    starter.x=-10;starter.y=PCY;
    teams[ti].players[pi]=reserve;
    teams[ti].reserves[ri]=starter;
    _handleGKMalusOnSwap(starter,reserve,_isPreMatch());
    logEvent(`🔄 ${reserve.name} (réserviste) remplace ${starter.name} !`,teams[ti].color);
    htSel={ti:-1,bi:-1};renderHtTeams();
  } else {
    document.querySelectorAll('.ht-prow').forEach(el=>el.classList.remove('sel-target'));
    if((htSel.bi>=0||htSel.bi<=-100)&&htSel.ti===ti)document.getElementById(`ht-s${ti}-${pi}`)?.classList.add('sel-target');
  }
}

function htSetStrat(ti,sid,el){
  teams[ti].strat=sid;
  applyFormationRoles(ti); // mettre à jour les postes selon la nouvelle formation
  el.closest('.ht-team').querySelectorAll('.ht-sc').forEach(e=>e.classList.remove('sel'));
  el.classList.add('sel');
  syncHUD();renderTactics();updateCompoPitch();
}

// ── Concert de Lumière : sort automatique d'entretien ────────────────
// Se déclenche au début de chaque période. Ensuite, toutes les 15 secondes
// (temps réel), un allié au hasard reçoit un boost aléatoire (+5 à +20) dans
// une stat aléatoire pendant 10 s. Chaque déclenchement puise fortement dans
// l'endurance du joueur qui a équipé le sort.
function _triggerConcert(){
  if(!G.ptcl)return;
  teams.forEach((T,ti)=>{
    T.players.forEach(p=>{
      if(!p||!(p.spells||[]).includes('concert_lumiere'))return;
      p._concertActive=true;
      p._concertTimer=0; // premier boost quasi immédiat au coup d'envoi
      G.ptcl.push({t:'lbl',x:p.x,y:p.y-5,tx:'🎆 CONCERT DE LUMIÈRE',col:'#ffe066',l:70,m:70,sz:1.4});
      for(let i=0;i<24;i++)G.ptcl.push({t:'s',x:p.x+rng(-6,6),y:p.y+rng(-4,4),vx:rng(-.4,.4),vy:-rng(.2,.7),l:rng(40,60),m:60,col:pick(['#ffe066','#fff59d','#4fc3f7','#ff8a80','#b39ddb','#81c784']),sz:rng(.2,.5)});
      logEvent('🎆 '+p.name+' — Concert de Lumière ! Spectacle lancé.','#ffe066');
    });
  });
}
const _CONCERT_STAT=['sht','spd','def','tec','stam'];
function _concertTick(rawDt){
  teams.forEach((T,ti)=>{
    T.players.forEach(caster=>{
      if(!caster||!caster._concertActive)return;
      if(caster.hp<=0||caster.red||(caster.injLevel||0)>=3){caster._concertActive=false;return;}
      caster._concertTimer=(caster._concertTimer||0)+rawDt;
      if(caster._concertTimer>=15){
        caster._concertTimer=0;
        // Coût d'endurance élevé pour le porteur (hp = énergie du match)
        caster.hp=Math.max(1,caster.hp-irng(10,16));
        // Choisir un allié actif au hasard (peut inclure le porteur)
        const allies=T.players.filter(q=>q&&!q.red&&q.hp>0&&(q.injLevel||0)<3);
        if(!allies.length)return;
        const tgt=pick(allies);
        const stat=pick(_CONCERT_STAT);
        const amount=irng(5,20);
        tgt.s[stat]=Math.min(99,(tgt.s[stat]||50)+amount);
        // Buff temporaire 10 s (réel) : on stocke pour restitution
        if(!tgt._concertBuffs)tgt._concertBuffs=[];
        tgt._concertBuffs.push({stat,amount,t:10});
        G.ptcl.push({t:'ring_expand',x:tgt.x,y:tgt.y,col:'#ffe066',maxR:7,l:35,m:35});
        G.ptcl.push({t:'lbl',x:tgt.x,y:tgt.y-4,tx:'✨ +'+amount+' '+stat.toUpperCase(),col:'#ffe066',l:45,m:45,sz:1.1});
        for(let i=0;i<8;i++)G.ptcl.push({t:'s',x:tgt.x,y:tgt.y,vx:rng(-.4,.4),vy:-rng(.2,.5),l:30,m:30,col:'#ffe066',sz:.2});
        logEvent('✨ '+caster.name+' (Concert) → +'+amount+' '+stat.toUpperCase()+' pour '+tgt.name+' (10s)','#ffe066');
      }
    });
    // Décrémenter les buffs temporaires de tous les joueurs et restituer
    T.players.forEach(p=>{
      if(!p||!p._concertBuffs||!p._concertBuffs.length)return;
      p._concertBuffs=p._concertBuffs.filter(b=>{
        b.t-=rawDt;
        if(b.t<=0){ p.s[b.stat]=Math.max(1,(p.s[b.stat]||0)-b.amount); return false; }
        return true;
      });
    });
  });
}
// Nettoyage : restitue tous les buffs Concert encore actifs (fin de match/reset)
function _clearConcertBuffs(){
  teams.forEach(T=>T.players.forEach(p=>{
    if(!p)return;
    (p._concertBuffs||[]).forEach(b=>{p.s[b.stat]=Math.max(1,(p.s[b.stat]||0)-b.amount);});
    p._concertBuffs=[];p._concertActive=false;p._concertTimer=0;
  }));
}

function _triggerAuraDivine(){
  if(!G.ptcl) return; // guard si appelé avant init match
  teams.forEach(T=>{
    T.players.forEach(p=>{
      if(!p) return;
      if(!(p.spells||[]).includes('aura_divine')) return;
      if(p._auraDivineActive) return; // déjà actif ce match, pas de double buff
      if(Math.random()<0.18){
        const boost=12;
        p.s.sht+=boost; p.s.spd+=boost; p.s.def+=boost; p.s.tec+=boost;
        p._auraDivine=(p._auraDivine||0)+boost;
        p._auraDivineActive=true; // marquer comme actif
        for(let i=0;i<20;i++) G.ptcl.push({t:'s',x:p.x+Math.random()*6-3,y:p.y-Math.random()*4,vx:(Math.random()-.5)*.5,vy:-Math.random()*.8,l:60,m:60,col:'#ffd700',sz:Math.random()*.4+.2});
        G.ptcl.push({t:'ring_expand',x:p.x,y:p.y,col:'#ffd700',maxR:8,l:50,m:50});
        G.ptcl.push({t:'lbl',x:p.x,y:p.y-5,tx:'✨ AURA DIVINE',col:'#ffd700',l:70,m:70,sz:1.4});
        logEvent('✨ '+p.name+' — AURA DIVINE ! +12 toutes stats','#ffd700');
      }
    });
  });
}
function _restituerAideDivine(half){
  teams.forEach(T=>T.players.forEach(p=>{
    if(!p||!p._aideDivine) return;
    p._aideDivine=p._aideDivine.filter(b=>{
      if(b.half===half){ b.keys.forEach(k=>{p.s[k]=Math.max(1,p.s[k]-b.boost);}); return false; }
      return true;
    });
  }));
}
function resumeSecondHalf(){
  try{
    document.getElementById('htmodal')?.classList.remove('on');
    document.getElementById('prematch-modal')?.classList.remove('on');
    // S'assurer que l'état de 2e mi-temps est bien posé (robuste pour la coupe)
    if(G.half<2)G.half=2;
    G.phase='KICKOFF';G.phTick=0;
    const secondHalfKickoff=1-(G._firstHalfKickoffTi??G.atkTi);
    try{placeKickoff(secondHalfKickoff);}catch(e){console.error('placeKickoff failed:',e);}
    setPhase('KICKOFF');
    G.running=true; G._paused=false;
    const btn=document.getElementById('mbtn');if(btn)btn.textContent='⏸ Pause';
    try{_restituerAideDivine(1);}catch(e){console.error('aideDivine:',e);}
    try{_triggerAuraDivine();}catch(e){console.error('auraDivine:',e);}
    try{_triggerConcert();}catch(e){console.error('concert:',e);}
    try{_gifArmIfNeeded();}catch(e){}
    G.log=[];
    const logbox=document.getElementById('logbox');if(logbox)logbox.innerHTML='';
  }catch(e){
    // En dernier recours : relancer le jeu coûte que coûte, sans perdre le score
    console.error('resumeSecondHalf fatal:',e);
    if(G.half<2)G.half=2;
    G.phase='KICKOFF';G.running=true;G._paused=false;
    document.getElementById('htmodal')?.classList.remove('on');
    const btn=document.getElementById('mbtn');if(btn)btn.textContent='⏸ Pause';
  }
}
function nav(p){
  // Close prematch modal if navigating away
  document.getElementById('prematch-modal')?.classList.remove('on');
  if(_leagueUserTeamBackup&&(p==='setup'||p==='tactic')){
    teams[0]=_leagueUserTeamBackup[0];
    teams[1]=_leagueUserTeamBackup[1];
    // Keep _leagueUserTeamBackup set so match can be properly ended
    renderTB(0);renderTB(1);syncHUD();
  }
  document.querySelectorAll('.ntab').forEach((el,i)=>el.classList.toggle('on',['setup','tactic','match','stats','league','cup','career'][i]===p));
  document.querySelectorAll('.spage').forEach(el=>el.classList.remove('on'));
  const sp=document.getElementById(`sp-${p}`);if(sp)sp.classList.add('on');
  if(p==='stats')renderStats();
  if(p==='tactic'){renderTactics();renderTacSliders(0);renderTacSliders(1);renderPlayerRoles(0);renderPlayerRoles(1);}
  if(p==='league')renderLeague();
  if(p==='cup')renderCup();
  if(p==='career')renderCareer();
}
// ── Pre-match screen (FIFA-style) ────────────────────────
function teamOvr(T){
  if(!T?.players?.length)return 50;
  return Math.round(T.players.reduce((s,p)=>{
    const st=p.s||{};
    return s+((st.sht||50)+(st.spd||50)+(st.def||50)+(st.stam||50)+(st.tec||50)+(st.res||50))/6;
  },0)/T.players.length);
}
function ovrToStars(ovr){
  // Demi-étoiles, notation stricte
  if(ovr>=88)return 5;
  if(ovr>=80)return 4.5;
  if(ovr>=72)return 4;
  if(ovr>=64)return 3.5;
  if(ovr>=56)return 3;
  if(ovr>=48)return 2.5;
  if(ovr>=40)return 2;
  if(ovr>=32)return 1.5;
  return 1;
}

// Rendu demi-étoiles HTML global
function renderStarsHtml(n, col, size){
  const sz = size||14;
  let s='';
  for(let i=0;i<5;i++){
    if(n>=i+1)      s+=`<span style="color:${col};font-size:${sz}px;line-height:1">&#9733;</span>`;
    else if(n>=i+.5)s+=`<span style="color:${col};font-size:${sz}px;line-height:1;opacity:.5">&#9733;</span>`;
    else             s+=`<span style="color:#333;font-size:${sz}px;line-height:1">&#9733;</span>`;
  }
  return s;
}
function teamStatBlock(T){
  const ps=[...(T?.players||[]),...(T?.bench||[])].filter(Boolean);
  if(!ps.length)return{att:50,mil:50,def:50};
  const avg=(positions,stat)=>{
    const group=ps.filter(p=>positions.includes(p.pos));
    if(!group.length)return 50;
    return Math.round(group.reduce((s,p)=>{
      const st=p.s||{};
      return s+(st[stat]||50);
    },0)/group.length);
  };
  // Attack: ATT+MO → rating = avg of sht+tec+spd
  const attPs=ps.filter(p=>['ATT','MO'].includes(p.pos));
  const milPs=ps.filter(p=>['MC','MDC','MO'].includes(p.pos)||p.pos==='MC');
  const defPs=ps.filter(p=>['GB','DC','DD','DG'].includes(p.pos));
  const ratingGroup=(group,weights)=>{
    if(!group.length)return 50;
    return Math.round(group.reduce((s,p)=>{
      const st=p.s||{};
      let r=0,w=0;
      Object.entries(weights).forEach(([k,wt])=>{r+=(st[k]||50)*wt;w+=wt;});
      return s+r/w;
    },0)/group.length);
  };
  return{
    att:ratingGroup(attPs.length?attPs:ps.filter(p=>p.pos!=='GB'),{sht:3,tec:2,spd:1}),
    mil:ratingGroup(milPs.length?milPs:ps.filter(p=>!['GB','DC','DD','DG','ATT'].includes(p.pos)),{tec:2,stam:2,def:1,spd:1}),
    def:ratingGroup(defPs.length?defPs:ps.filter(p=>['GB','DC','DD','DG'].includes(p.pos)),{def:3,stam:1,spd:1}),
  };
}
function renderStatBar(label,v0,v1,col0,col1){
  const max=Math.max(v0,v1,1);
  const w0=Math.round(v0/max*100),w1=Math.round(v1/max*100);
  const b0=v0>=v1?'font-weight:900':'font-weight:400';
  const b1=v1>=v0?'font-weight:900':'font-weight:400';
  return `<div style="display:grid;grid-template-columns:28px 1fr 36px 1fr 28px;align-items:center;gap:3px;margin-bottom:5px">
    <span style="font-family:'Barlow Condensed',sans-serif;font-size:12px;${b0};color:${col0};text-align:right">${v0}</span>
    <div style="height:5px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden">
      <div style="height:100%;width:${w0}%;background:${col0};border-radius:3px;float:right"></div>
    </div>
    <span style="font-family:'Barlow Condensed',sans-serif;font-size:8px;color:var(--muted);text-align:center;letter-spacing:.5px;text-transform:uppercase">${label}</span>
    <div style="height:5px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden">
      <div style="height:100%;width:${w1}%;background:${col1};border-radius:3px"></div>
    </div>
    <span style="font-family:'Barlow Condensed',sans-serif;font-size:12px;${b1};color:${col1}">${v1}</span>
  </div>`;
}

function renderStars(n,col){
  let h='';
  for(let i=0;i<5;i++)h+='<span style="color:'+(i<n?col:'rgba(255,255,255,.15)')+';font-size:14px">\u2605</span>';
  return h;
}

function showPreMatch(onStart){
  try{
    const T0=teams[0],T1=teams[1];
    if(!T0||!T1){if(onStart)onStart();else{G.running=true;G._paused=false;}return;}
    window._prematchOnStart=onStart||null;

    const ovr=T=>{
      const ps=(T.players||[]);if(!ps.length)return 50;
      return Math.round(ps.reduce((s,p)=>{const st=p.s||{};return s+((st.sht||50)+(st.spd||50)+(st.def||50)+(st.stam||50)+(st.tec||50))/5;},0)/ps.length);
    };
    const stars=(n,col)=>{
      let s='';
      for(let i=0;i<5;i++){
        if(n>=i+1) s+='<span style="color:'+col+';font-size:16px;line-height:1">&#9733;</span>';
        else if(n>=i+0.5) s+='<span style="color:'+col+';font-size:16px;line-height:1;opacity:.55">&#9733;</span>';
        else s+='<span style="color:#333;font-size:16px;line-height:1">&#9733;</span>';
      }
      return s;
    };
    const bar=(label,v0,v1,c0,c1)=>{
      const mx=Math.max(v0,v1,1);
      const p0=Math.round(v0/mx*100),p1=Math.round(v1/mx*100);
      const bw='font-weight:700',nw='font-weight:400';
      return '<div style="display:grid;grid-template-columns:32px 1fr 40px 1fr 32px;align-items:center;gap:4px;margin-bottom:7px">'
        +'<span style="font-size:13px;'+( v0>=v1?bw:nw)+';color:'+c0+';text-align:right">'+v0+'</span>'
        +'<div style="height:6px;background:#111;border-radius:3px;overflow:hidden"><div style="height:100%;width:'+p0+'%;background:'+c0+';border-radius:3px;float:right;transition:width .4s"></div></div>'
        +'<div style="font-size:8px;color:#666;text-align:center;letter-spacing:.5px;text-transform:uppercase">'+label+'</div>'
        +'<div style="height:6px;background:#111;border-radius:3px;overflow:hidden"><div style="height:100%;width:'+p1+'%;background:'+c1+';border-radius:3px;transition:width .4s"></div></div>'
        +'<span style="font-size:13px;'+(v1>=v0?bw:nw)+';color:'+c1+'">'+v1+'</span>'
        +'</div>';
    };
    const stat=T=>{
      const all=[...(T.players||[]),...(T.bench||[])].filter(Boolean);
      const titulaires=(T.players||[]).slice(0,7).filter(Boolean);
      const src=titulaires.length?titulaires:all;
      if(!src.length)return{att:50,mil:50,def:50};
      // Contribution offensive/défensive PONDÉRÉE par poste, mais calculée sur
      // TOUS les joueurs — ainsi une formation atypique (1-3-3 : 3 déf, 2 MDC,
      // 1 MO) n'est pas sous-évaluée offensivement juste parce qu'elle n'a
      // qu'un seul attaquant nominal. Les milieux comptent partiellement des
      // deux côtés, comme dans un vrai match.
      const wAtk=p=>{const pos=p.pos||'MC';
        if(['ATT','MO','AG','AD','MOG','MOD'].includes(pos))return 1.0;
        if(['MC','MDC'].includes(pos))return 0.55;      // les milieux participent à l'attaque
        if(['DD','DG'].includes(pos))return 0.30;       // latéraux qui montent
        if(['DC'].includes(pos))return 0.12;
        return 0.05;                                     // gardien
      };
      const wDef=p=>{const pos=p.pos||'MC';
        if(['GB','DC','DD','DG'].includes(pos))return 1.0;
        if(['MC','MDC'].includes(pos))return 0.55;      // les milieux participent à la défense
        if(['MO','MOG','MOD','AG','AD'].includes(pos))return 0.25;
        return 0.10;                                     // attaquant pur
      };
      // Note offensive individuelle (tir/technique/vitesse) et défensive (déf/endu/vitesse)
      const atkQ=p=>(p.s?.sht||50)*0.5+(p.s?.tec||50)*0.3+(p.s?.spd||50)*0.2;
      const defQ=p=>(p.s?.def||50)*0.6+(p.s?.stam||50)*0.2+(p.s?.spd||50)*0.2;
      const wavg=(qf,wf)=>{let sr=0,sw=0;src.forEach(p=>{const w=wf(p);sr+=qf(p)*w;sw+=w;});return sw?Math.round(sr/sw):50;};
      const mil=(()=>{const m=src.filter(p=>['MC','MDC','MO','MOG','MOD'].includes(p.pos));const g=m.length?m:src;
        return Math.round(g.reduce((s,p)=>s+((p.s?.tec||50)*0.4+(p.s?.stam||50)*0.3+(p.s?.def||50)*0.15+(p.s?.spd||50)*0.15),0)/g.length);})();
      return{ att:wavg(atkQ,wAtk), mil, def:wavg(defQ,wDef) };
    };
    // OVR affiché = force réelle de l'équipe (teamStrength) pour que l'OVR, la
    // « Force estimée », les facteurs clés et les probabilités racontent tous la
    // MÊME histoire (plus de contradiction OVR vs pronostic).
    const o0=Math.round(teamStrength(T0)),o1=Math.round(teamStrength(T1));
    const b0=teamOvr(T0),b1=teamOvr(T1); // moyenne brute des OVR joueurs (sans strat/forme/sorts)
    const s0=stat(T0),s1=stat(T1);
    const sv0=ovrToStars(o0),sv1=ovrToStars(o1);
    const st0=(STRATS.find(s=>s.id===(T0.strat||'321'))||STRATS[0]).n;
    const st1=(STRATS.find(s=>s.id===(T1.strat||'321'))||STRATS[0]).n;
    const spells=T=>{const seen=new Set();(T.players||[]).forEach(p=>(p.spells||[]).forEach(id=>seen.add(id)));return[...seen].slice(0,4).map(id=>SPELLS.find(x=>x.id===id)).filter(Boolean);};
    const chips=arr=>arr.length?arr.map(sp=>'<span style="font-size:8px;padding:2px 6px;border-radius:10px;border:1px solid '+sp.col+'66;color:'+sp.col+';background:'+sp.col+'18;white-space:nowrap">'+sp.n.split(' ')[0]+'</span>').join(' '):'<span style="color:#444;font-size:9px">—</span>';
    // Moral et Forme moyens (cachés mais affichés ici)
    // S'assurer que tous les joueurs ont _hm/_fm (sauvegardes anciennes)
    const bell=()=>Math.round(Math.max(-10,Math.min(10,(Math.random()+Math.random()-1)*10)));
    [T0,T1].forEach(T=>[...(T.players||[]),...(T.bench||[])].forEach(p=>{
      if(p&&p._hm===undefined) p._hm=bell();
      if(p&&p._fm===undefined) p._fm=bell();
    }));
    const avgHidden=(T,field)=>{
      const ps=(T.players||[]).filter(Boolean);
      if(!ps.length) return 0;
      // Utiliser !== undefined pour distinguer 0 de "manquant"
      return Math.round(ps.reduce((s,p)=>s+(p[field]!==undefined?p[field]:bell()),0)/ps.length);
    };
    const hmPill=(v,emoji,label)=>{
      const col=v>3?'#18c860':v<-3?'#e06060':'#f0c028';
      const bg=v>3?'rgba(24,200,96,.12)':v<-3?'rgba(224,96,96,.12)':'rgba(240,192,40,.10)';
      const sign=v>0?'+':'';
      const w=Math.round(Math.abs(v)/10*100);
      return '<div style="display:flex;align-items:center;gap:4px;margin-top:4px">'
        +'<span style="font-size:12px;flex-shrink:0">'+emoji+'</span>'
        +'<div style="flex:1;background:#0d1117;border-radius:4px;height:14px;overflow:hidden;position:relative">'
        +'<div style="position:absolute;inset:0;width:'+w+'%;'+(v<0?'margin-left:'+(100-w)+'%;':'')+'background:'+col+';opacity:.8;border-radius:4px;transition:width .5s"></div>'
        +'<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:900;color:#fff;letter-spacing:.5px;text-shadow:0 0 4px #000">'+label+' '+sign+v+'</div>'
        +'</div>'
        +'</div>';
    };
    const moodLabel=(hm,fm)=>{
      const avg=Math.round((hm+fm)/2);
      if(avg>=7) return {txt:'🔥 En feu',col:'#ff6d00'};
      if(avg>=4) return {txt:'⚡ Motivé',col:'#f0c028'};
      if(avg>=1) return {txt:'👍 Prêt',col:'#18c860'};
      if(avg>=-2) return {txt:'😐 Neutre',col:'#888'};
      if(avg>=-5) return {txt:'😓 Hésitant',col:'#f0c028'};
      return {txt:'❄️ En difficulté',col:'#e06060'};
    };
    const hm0=avgHidden(T0,'_hm'), hm1=avgHidden(T1,'_hm');
    const fm0=avgHidden(T0,'_fm'), fm1=avgHidden(T1,'_fm');
    const badge=T=>{
      if(T.img)return'<div style="width:52px;height:52px;border-radius:50%;overflow:hidden;margin:0 auto 8px;border:2px solid '+T.color+'88"><img src="'+T.img+'" style="width:100%;height:100%;object-fit:cover"></div>';
      return'<div style="width:52px;height:52px;border-radius:50%;background:'+T.color+';display:flex;align-items:center;justify-content:center;margin:0 auto 8px;font-size:17px;font-weight:900;color:#fff;font-family:sans-serif;border:2px solid '+T.color+'88">'+teamIni(T.name)+'</div>';
    };

    const col=(T,o,hm,fm,b)=>{
      const mood=moodLabel(hm,fm);
      const diff=o-b;
      const diffTxt=diff!==0?'<div style="font-size:9px;color:'+(diff>0?'#18c860':'#e06060')+';margin-top:1px" title="OVR effectif (stratégie/forme/moral/sorts inclus) vs moyenne brute des joueurs">'+(diff>0?'+':'')+diff+' vs moy. joueurs ('+b+')</div>':'<div style="font-size:9px;color:#555;margin-top:1px">= moy. joueurs</div>';
      return '<div style="flex:1;text-align:center;min-width:0">'
        +badge(T)
        +'<div style="font-size:12px;font-weight:700;color:'+T.color+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px">'+T.name+'</div>'
        +'<div style="margin-bottom:4px;line-height:1">'+stars(ovrToStars(o),T.color)+'</div>'
        +'<div style="font-size:22px;font-weight:900;color:'+T.color+'">'+o+' <span style="font-size:10px;font-weight:400;color:#555">OVR</span></div>'
        +diffTxt
        +'<div style="font-size:9px;font-weight:700;color:'+mood.col+';margin-top:4px;letter-spacing:.3px">'+mood.txt+'</div>'
        +'<div style="padding:4px 2px 0">'
        +hmPill(hm,'😤','MORAL')+hmPill(fm,'✨','FORME')
        +'</div>'
        +'</div>';
    };

    // Calcul pronostic
    const ts0=teamStrength(T0)/99, ts1=teamStrength(T1)/99;
    const hm0_bonus=Math.max(0,hm0)*0.005, hm1_bonus=Math.max(0,hm1)*0.005;
    const fm0_bonus=Math.max(0,fm0)*0.003, fm1_bonus=Math.max(0,fm1)*0.003;
    const str0=ts0+hm0_bonus+fm0_bonus, str1=ts1+hm1_bonus+fm1_bonus;
    // Elo : str0/str1 sont normalisés (÷99) → reconvertir en OVR pour le calcul
    const rawDiff=(str0-str1)*99;
    const ovrDiff=Math.abs(rawDiff);
    const eloK=ovrDiff/20;
    const favP=ovrDiff<0.5?0.5:1/(1+Math.pow(10,-eloK*1.0));
    const underP=1-favP;
    const pDraw=Math.max(0.04,0.20-eloK*0.06);
    const pWin0=rawDiff>=0?(favP*(1-pDraw)):(underP*(1-pDraw));
    const pWin1=rawDiff>=0?(underP*(1-pDraw)):(favP*(1-pDraw));
    const tot=pWin0+pDraw+pWin1;
    const pw0=Math.round(pWin0/tot*100), pd=Math.round(pDraw/tot*100), pw1=100-pw0-pd;
    // Estimation buts par modèle de buts attendus (xG / λ) :
    // chaque équipe a un nombre de buts ATTENDU dépendant de son attaque face à
    // la défense adverse. On en déduit le score entier le plus probable, ce qui
    // produit des scores variés et réalistes : 0-0, 2-3, 3-0, 3-3, etc.
    const rel0=str0/Math.max(0.01,str0+str1), rel1=1-rel0;
    // Attaque vs défense adverse (stats ~1..99). >1 = l'attaque prend le dessus.
    const ad0=(s0.att||55)/Math.max(20,(s1.def||55));
    const ad1=(s1.att||55)/Math.max(20,(s0.def||55));
    // λ = buts attendus. Base modulée par le rapport de force ET par le duel
    // attaque/défense (deux attaques fortes face à deux défenses faibles → gros
    // score type 3-3 ; deux grosses défenses → 0-0 / 1-0).
    const BASE=1.5;
    // Exposant 2.3 sur le rapport de force : accentue nettement les écarts
    // extrêmes pour qu'un gouffre de niveau (~40 OVR) puisse donner un vrai
    // massacre (10-0, 12-0), tout en gardant les matchs équilibrés à ~1.5.
    let lam0=BASE*Math.pow(rel0/0.5,2.3)*Math.pow(ad0,1.3);
    let lam1=BASE*Math.pow(rel1/0.5,2.3)*Math.pow(ad1,1.3);
    // Plafond dynamique : une équipe qui écrase (gros écart d'OVR) peut se
    // lâcher. Le cap monte avec le rapport de force — ~6 pour un match normal,
    // jusqu'à ~15+ pour un massacre total.
    const capFor=rel=>6+Math.max(0,(rel-0.55))*40; // rel .55→6, .8→16, .9→20
    lam0=Math.min(capFor(rel0),lam0);
    lam1=Math.min(capFor(rel1),lam1);
    // Score entier le plus probable (mode de Poisson ≈ arrondi de λ, avec λ
    // entier laissant le choix au plus proche).
    const modePoisson=l=>{ if(l<=0.35)return 0; const f=Math.floor(l); return (l-f>=0.5)?f+1:f; };
    let estG0=modePoisson(lam0), estG1=modePoisson(lam1);
    // COHÉRENCE STRICTE score ↔ probabilités : le favori (selon les %) ne peut
    // JAMAIS être donné perdant au score estimé. Un nul reste permis seulement
    // si le match est très serré (écart de probas < 8 points).
    const probGap=pw0-pw1;
    if(probGap>=8){            // Rouges favoris → ne doivent pas perdre
      if(estG0<estG1){ const t=estG0; estG0=estG1; estG1=t; }
    } else if(probGap<=-8){    // Bleus favoris → ne doivent pas perdre
      if(estG1<estG0){ const t=estG0; estG0=estG1; estG1=t; }
    }
    // Écart de probas net (>20) : interdire même le nul au score estimé.
    if(probGap>20 && estG0<=estG1){ estG0=estG1+1; }
    else if(probGap<-20 && estG1<=estG0){ estG1=estG0+1; }

    const pronoBar=(pct,col,label)=>`
      <div style="text-align:center;flex:${pct}">
        <div style="font-size:13px;font-weight:900;color:${col}">${pct}%</div>
        <div style="height:8px;background:${col};border-radius:3px;margin:2px 1px 2px"></div>
        <div style="font-size:8px;color:var(--muted);margin-top:1px">${label}</div>
      </div>`;

    const key=factor=>`<div style="display:flex;align-items:center;gap:5px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.04)">${factor}</div>`;
    const delta=(a,b,label)=>{
      const d=a-b; const col=d>3?T0.color:d<-3?T1.color:'#888';
      const sign=d>0?'+':''; const aname=d>0?T0.name:T1.name;
      return key(`<span style="font-size:9px;color:var(--muted);flex:1">${label}</span><span style="font-size:9px;font-weight:700;color:${col}">${d!==0?aname+' '+sign+d:'-'}</span>`);
    };

    let h='<div style="background:var(--dark,#050e1a);border-radius:14px;overflow:hidden;font-family:sans-serif">';

    // Tabs
    h+='<div style="display:flex;border-bottom:1px solid #111">'
      +'<button id="pm-tab-match" onclick="pmTab(\'match\')" style="flex:1;background:var(--card);border:none;color:var(--text);font-size:10px;font-weight:700;padding:8px 4px;cursor:pointer;border-bottom:2px solid #18c860">📊 Match</button>'
      +'<button id="pm-tab-compo" onclick="pmTab(\'compo\')" style="flex:1;background:transparent;border:none;color:var(--muted);font-size:10px;font-weight:700;padding:8px 4px;cursor:pointer;border-bottom:2px solid transparent">⚽ Compo</button>'
      +'<button id="pm-tab-prono" onclick="pmTab(\'prono\')" style="flex:1;background:transparent;border:none;color:var(--muted);font-size:10px;font-weight:700;padding:8px 4px;cursor:pointer;border-bottom:2px solid transparent">🔮 Prono</button>'
      +'<button id="pm-tab-tac" onclick="pmTab(\'tac\')" style="flex:1;background:transparent;border:none;color:var(--muted);font-size:10px;font-weight:700;padding:8px 4px;cursor:pointer;border-bottom:2px solid transparent">⚙️ Tac</button>'
      +'</div>';

    // Tab match
    h+='<div id="pm-panel-match">';
    // Header
    h+='<div style="background:linear-gradient(135deg,'+T0.color+'22,transparent 40%,'+T1.color+'22);padding:20px 16px 14px;display:flex;align-items:center;gap:8px">';
    h+=col(T0,o0,hm0,fm0,b0);
    h+='<div style="flex-shrink:0;font-size:22px;font-weight:900;color:#444;letter-spacing:3px">VS</div>';
    h+=col(T1,o1,hm1,fm1,b1);
    h+='</div>';
    // Stat bars
    h+='<div style="padding:12px 16px 8px;border-top:1px solid #111">';
    h+=bar('ATT',s0.att,s1.att,T0.color,T1.color);
    h+=bar('MIL',s0.mil,s1.mil,T0.color,T1.color);
    h+=bar('DEF',s0.def,s1.def,T0.color,T1.color);
    h+='</div>';
    // Tactics
    h+='<div style="display:grid;grid-template-columns:1fr auto 1fr;padding:6px 16px;align-items:center;gap:6px;border-top:1px solid #111">';
    h+='<span style="font-size:11px;font-weight:700;color:'+T0.color+'">'+st0+'</span>';
    h+='<span style="font-size:8px;color:#444;letter-spacing:.5px">TACTIQUE</span>';
    h+='<span style="font-size:11px;font-weight:700;color:'+T1.color+';text-align:right">'+st1+'</span>';
    h+='</div>';
    // Spells
    h+='<div style="display:grid;grid-template-columns:1fr auto 1fr;padding:6px 16px 10px;align-items:start;gap:6px;border-top:1px solid #111">';
    h+='<div style="display:flex;flex-wrap:wrap;gap:3px">'+chips(spells(T0))+'</div>';
    h+='<span style="font-size:8px;color:#444;letter-spacing:.5px;white-space:nowrap;padding-top:2px">SORTS</span>';
    h+='<div style="display:flex;flex-wrap:wrap;gap:3px;justify-content:flex-end">'+chips(spells(T1))+'</div>';
    h+='</div>';
    h+='</div>';

    // Tab compo — terrain avec les joueurs
    const pOvrQuick=p=>{const s=p.s||{};const v=Object.values(s);return v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length):50;};
    const playerDot=(p,col)=>{
      const ovr=pOvrQuick(p);
      const ovrCol=ovr>=75?'#18c860':ovr>=60?'#f0c028':'#e06060';
      const shortName=(p.name||'?').split(' ').map((w,i)=>i===0?w[0]+'.':w).join(' ');
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;width:46px">
        <div style="position:relative">
          <div style="width:36px;height:36px;border-radius:50%;border:2px solid ${col};overflow:hidden;background:${col}22;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.5)">
            ${p.img?`<img src="${p.img}" style="width:100%;height:100%;object-fit:cover">`:`<span style="font-size:11px;font-weight:900;color:${col}">${(p.ini||p.name||'?').slice(0,2).toUpperCase()}</span>`}
          </div>
          <div style="position:absolute;bottom:-2px;right:-2px;background:${ovrCol};border-radius:3px;padding:0 2px;font-size:7px;font-weight:900;color:#000;line-height:14px">${ovr}</div>
        </div>
        <div style="background:rgba(0,0,0,.65);border-radius:3px;padding:1px 3px;text-align:center;max-width:46px">
          <div style="font-size:7px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:44px">${shortName}</div>
          <div style="font-size:6px;color:${col};font-weight:700">${p.pos||''}</div>
        </div>
      </div>`;
    };
    // Grouper les joueurs par ligne de formation
    const groupByLine=(players,col)=>{
      const lines={GB:[],DEF:[],MID:[],ATT:[]};
      (players||[]).slice(0,7).forEach(p=>{
        const pos=p.pos||'MC';
        if(pos==='GB') lines.GB.push(p);
        else if(['DC','DD','DG'].includes(pos)) lines.DEF.push(p);
        else if(['MC','MDC','MO','AD','AG'].includes(pos)) lines.MID.push(p);
        else lines.ATT.push(p);
      });
      const row=(ps,label)=>ps.length?`<div style="display:flex;justify-content:space-evenly;align-items:flex-start;padding:4px 0;min-height:52px">${ps.map(p=>playerDot(p,col)).join('')}</div>`:'';
      return {GB:lines.GB,DEF:lines.DEF,MID:lines.MID,ATT:lines.ATT,row};
    };
    const g0=groupByLine(T0.players,T0.color);
    const g1=groupByLine(T1.players,T1.color);

    h+=`<div id="pm-panel-compo" style="display:none;padding:0;overflow:hidden">
      <div style="background:linear-gradient(180deg,#0d3d0d 0%,#0f4a0f 30%,#0d3d0d 50%,#0f4a0f 70%,#0d3d0d 100%);padding:8px 4px;position:relative;min-height:380px">
        <!-- Lignes de terrain -->
        <div style="position:absolute;inset:0;pointer-events:none">
          <div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(255,255,255,.15)"></div>
          <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:70px;height:70px;border-radius:50%;border:1px solid rgba(255,255,255,.15)"></div>
          <div style="position:absolute;left:8%;right:8%;top:6px;bottom:6px;border:1px solid rgba(255,255,255,.12);border-radius:3px"></div>
          <div style="position:absolute;left:25%;right:25%;top:6px;height:40px;border:1px solid rgba(255,255,255,.10);border-top:none"></div>
          <div style="position:absolute;left:25%;right:25%;bottom:6px;height:40px;border:1px solid rgba(255,255,255,.10);border-bottom:none"></div>
        </div>
        <!-- Équipe 0 (haut) -->
        <div id="compo-rows-0" style="position:relative;z-index:1">
          ${g0.row(g0.GB,'Gardien')}
          ${g0.row(g0.DEF,'Défense')}
          ${g0.row(g0.MID,'Milieu')}
          ${g0.row(g0.ATT,'Attaque')}
        </div>
        <!-- Séparateur mi-terrain -->
        <div style="display:flex;align-items:center;gap:6px;padding:2px 8px;position:relative;z-index:1;margin:2px 0">
          <div style="flex:1;height:1px;background:rgba(255,255,255,.2)"></div>
          <div style="display:flex;gap:8px">
            <span style="font-size:8px;font-weight:700;color:${T0.color}">${T0.name}</span>
            <span style="font-size:8px;color:var(--muted)">vs</span>
            <span style="font-size:8px;font-weight:700;color:${T1.color}">${T1.name}</span>
          </div>
          <div style="flex:1;height:1px;background:rgba(255,255,255,.2)"></div>
        </div>
        <!-- Équipe 1 (bas) -->
        <div id="compo-rows-1" style="position:relative;z-index:1">
          ${g1.row(g1.ATT,'Attaque')}
          ${g1.row(g1.MID,'Milieu')}
          ${g1.row(g1.DEF,'Défense')}
          ${g1.row(g1.GB,'Gardien')}
        </div>
      </div>
    </div>`;
    h+=`<div id="pm-panel-prono" style="display:none;padding:14px 16px">
      <!-- Noms -->
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:10px;font-weight:700;color:${T0.color}">${T0.name}</span>
        <span style="font-size:9px;color:var(--muted)">Pronostic</span>
        <span style="font-size:10px;font-weight:700;color:${T1.color}">${T1.name}</span>
      </div>
      <!-- Score estimé -->
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:10px;background:var(--card);border-radius:8px;padding:8px 12px">
        <span style="font-size:11px;font-weight:700;color:${T0.color}">${T0.name}</span>
        <div style="text-align:center">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:32px;font-weight:900;line-height:1">
            <span style="color:${T0.color}">${estG0}</span>
            <span style="color:var(--muted);font-size:20px"> — </span>
            <span style="color:${T1.color}">${estG1}</span>
          </div>
          <div style="font-size:8px;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-top:1px">Buts estimés</div>
        </div>
        <span style="font-size:11px;font-weight:700;color:${T1.color}">${T1.name}</span>
      </div>
      <!-- Barre probabilité -->
      <div style="display:flex;gap:2px;margin-bottom:10px;align-items:flex-end">
        ${pronoBar(pw0,T0.color,'Victoire')}
        ${pronoBar(pd,'#888','Nul')}
        ${pronoBar(pw1,T1.color,'Victoire')}
      </div>
      <!-- Facteurs clés -->
      <div style="font-size:8px;font-weight:700;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:5px">Facteurs clés</div>
      ${delta(o0,o1,'OVR global')}
      ${delta(s0.att,s1.att,'Attaque')}
      ${delta(s0.def,s1.def,'Défense')}
      ${delta(hm0,hm1,'Moral')}
      ${delta(fm0,fm1,'Forme')}
      ${delta((spells(T0).length),(spells(T1).length),'Sorts équipés')}
      <!-- Force estimée -->
      <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,.06)">
        <span style="font-size:9px;color:var(--muted)">Force estimée</span>
        <span style="font-size:9px;font-weight:700;color:${T0.color}">${Math.round(str0*99)}</span>
        <span style="font-size:9px;color:var(--muted)">vs</span>
        <span style="font-size:9px;font-weight:700;color:${T1.color}">${Math.round(str1*99)}</span>
      </div>
    </div>
    <div id="pm-panel-tac" style="display:none;padding:10px 12px;overflow-y:auto;overflow-x:hidden;max-height:360px">
      <div id="pm-tac-0" style="margin-bottom:10px"></div>
      <div id="pm-tac-1" style="margin-bottom:10px"></div>
      <div style="border-top:1px solid #222;margin-top:8px;padding-top:8px">
        <div style="font-size:9px;font-weight:700;letter-spacing:1px;color:#888;text-transform:uppercase;margin-bottom:6px">Instructions individuelles</div>
        <div id="pm-roles-0" style="margin-bottom:8px"></div>
        <div id="pm-roles-1"></div>
      </div>
    </div>`;

    // Option "Match personnalisé" : score de départ + une seule mi-temps
    h+='<details style="margin:2px 14px 6px;background:var(--card);border:1px solid var(--b1);border-radius:8px;padding:6px 10px">'
      +'<summary style="cursor:pointer;font-size:10px;font-weight:800;color:var(--gold);letter-spacing:1px;list-style:none">⚙️ MATCH PERSONNALISÉ</summary>'
      +'<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px">'
      +`<span style="font-size:10px;color:${teams[0].color};font-weight:700;max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${teams[0].name}</span>`
      +`<input type="number" min="0" max="30" value="${G._customScore?G._customScore[0]:0}" id="pm-score0" onchange="_setCustomScore(0,this.value)" style="width:42px;text-align:center;font-size:15px;font-weight:900;background:var(--dark);border:1px solid var(--b2);border-radius:5px;color:#fff;padding:3px">`
      +'<span style="font-size:12px;color:var(--muted)">—</span>'
      +`<input type="number" min="0" max="30" value="${G._customScore?G._customScore[1]:0}" id="pm-score1" onchange="_setCustomScore(1,this.value)" style="width:42px;text-align:center;font-size:15px;font-weight:900;background:var(--dark);border:1px solid var(--b2);border-radius:5px;color:#fff;padding:3px">`
      +`<span style="font-size:10px;color:${teams[1].color};font-weight:700;max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${teams[1].name}</span>`
      +'</div>'
      +'<label style="display:flex;align-items:center;gap:7px;justify-content:center;margin-top:8px;font-size:10px;color:var(--muted);cursor:pointer">'
      +`<input type="checkbox" ${G._singleHalf?'checked':''} onchange="G._singleHalf=this.checked" style="accent-color:var(--gold);width:14px;height:14px">`
      +'⏱️ Jouer une seule mi-temps</label>'
      +'<div style="font-size:8px;color:#666;text-align:center;margin-top:4px;font-style:italic">Score de départ et/ou mi-temps unique (idéal pour rejouer une fin de match).</div>'
      +'</details>';

    // Option GIF avant le coup d'envoi (pour ne pas louper les moments chauds)
    h+='<label style="display:flex;align-items:center;gap:7px;justify-content:center;padding:2px 14px 8px;font-size:11px;color:var(--muted);cursor:pointer">'
      +`<input type="checkbox" ${_gifArmNext?'checked':''} onchange="_gifArmNext=this.checked" style="accent-color:var(--gold);width:15px;height:15px">`
      +'🎬 Enregistrer la 1re mi-temps en GIF</label>';
    // Button
    h+='<div style="padding:0 14px 8px;display:flex;gap:8px">'
      +'<button onclick="openPreMatchLineup()" style="flex:1;background:var(--card);border:1px solid var(--b2);color:var(--text);font-size:11px;font-weight:700;padding:9px;border-radius:8px;cursor:pointer">✏️ Composition</button>'
      +'<button onclick="startMatchFromPreMatch()" style="flex:2;background:var(--green,#18c860);border:none;color:#fff;font-size:16px;font-weight:900;padding:9px;border-radius:8px;cursor:pointer;letter-spacing:2px;font-family:sans-serif">&#9654; COUP D&#39;ENVOI</button>'
      +'</div>';
    h+='</div>';

    const el=document.getElementById('prematch-content');
    if(el){el.innerHTML=h;}
    document.getElementById('prematch-modal').classList.add('on');
  }catch(err){
    console.error('showPreMatch error:',err);
    // Fallback: just start the match
    if(window._prematchOnStart){window._prematchOnStart();window._prematchOnStart=null;}
    else{G.running=true;G._paused=false;}
  }
}

function _setCustomScore(ti,val){
  if(!G._customScore)G._customScore=[0,0];
  G._customScore[ti]=Math.max(0,Math.min(30,parseInt(val)||0));
}

function startMatchFromPreMatch(){
  document.getElementById('prematch-modal').classList.remove('on');
  showTacBtns(true);
  G._everStarted=true; // le match démarre : fin des changements libres illimités
  // Appliquer un score de départ personnalisé s'il a été défini
  if(G._customScore&&(G._customScore[0]||G._customScore[1])){
    G.scores=[G._customScore[0]||0, G._customScore[1]||0];
    const e0=document.getElementById('hs0'),e1=document.getElementById('hs1');
    if(e0)e0.textContent=G.scores[0];
    if(e1)e1.textContent=G.scores[1];
    syncHUD();
  }
  // Mode "une seule mi-temps" : on démarre directement en 2e période (horloge à
  // 45') pour qu'une seule mi-temps soit jouée puis le coup de sifflet final.
  if(G._singleHalf){
    G.half=2;
    G.minute=45;
    G._firstHalfKickoffTi=G.atkTi;
    const hc=document.getElementById('hclock');if(hc)hc.textContent="45'";
  }
  _gifArmIfNeeded();   // démarre l'enregistrement GIF si l'option a été cochée
  _triggerConcert();   // Concert de Lumière : lancement au coup d'envoi
  const btn=document.getElementById('mbtn');
  if(window._prematchOnStart){
    window._prematchOnStart();
    window._prematchOnStart=null;
  } else {
    placeKickoff(G._kickoffTi!==undefined?G._kickoffTi:(Math.random()<.5?0:1));
    G.running=true;G._paused=false;
    if(btn)btn.textContent='⏸ Pause';
  }
}

function goMatch(){
  _lastNav='setup';nav('match');
  resetMatch();
  syncHUD();renderTB(0);renderTB(1);
  showPreMatch();
}
function syncHUD(){
  updateLiveStatus();
  ['0','1'].forEach(i=>{
    const T=teams[+i];
    const iconEl=document.getElementById('hicon'+i);
    if(iconEl){
      if(T.img)iconEl.innerHTML='<img src="'+T.img+'" style="width:16px;height:16px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:2px">';
      else iconEl.innerHTML='';
    }
    const nameEl=document.getElementById('hn'+i);
    if(nameEl){
      const span=nameEl.querySelector('span');
      if(span){[...nameEl.childNodes].forEach(n=>{if(n.nodeType===3)n.remove();});nameEl.appendChild(document.createTextNode(T.name));}
      else nameEl.textContent=T.name;
    }
    const scoreEl=document.getElementById('hs'+i);
    if(scoreEl)scoreEl.style.color=T.color;
  });
  const f0=document.getElementById('ftag0'),f1=document.getElementById('ftag1');
  if(f0)f0.textContent=strat(0).id.toUpperCase();
  if(f1)f1.textContent=strat(1).id.toUpperCase();
}

function promoteReserve(ti,ri){
  const T=teams[ti];
  if(!T.reserves?.[ri])return;
  const reserve=T.reserves[ri];
  // Move to bench (add at end, cap bench at 5)
  if(T.bench.length>=5){
    alert("Le banc est complet (5 joueurs max). Rétrogradez d'abord un remplaçant.");return;
  }
  T.bench.push(reserve);
  T.reserves.splice(ri,1);
  renderTB(ti);
}

function demoteToReserve(ti,bi){
  const T=teams[ti];
  if(!T.bench?.[bi])return;
  const bench=T.bench[bi];
  T.reserves=T.reserves||[];
  T.reserves.push(bench);
  T.bench.splice(bi,1);
  renderTB(ti);
}

function renderTB(ti){
  const T=teams[ti];
  // Spell type → CSS class
  const spellClass={
    fire:'cf',fireball:'cf',eldritch:'cf',illusion:'ct',thunder:'ct',
    ice:'ci',ice2:'ci',pass:'ci',tornado:'ci',
    tech:'cte',suggest:'cte',pacif:'cte',
    heal:'ch',soin:'ch',amitie:'ch',
    shield:'cs',mouton:'cs',charm:'cf',
    // Kraland
    cyclon:'ci',telekib:'cte',deluge:'ci',terreur:'cf',folie:'cte',
    divine:'ch',plaisir:'ch',sylvestre:'ch',fleurs:'ci',sixsens:'cte',
    aile:'ci',esprit:'ci',epuise:'cf',maledic:'cf',chance:'cte',
    hoquet:'cs',invis:'cs',peaupierre:'cs',transe:'ch',
    // Nouveaux
    spindash:'ci',dragon:'cf',aura_divine:'ch',aide_divine:'ch',cailloux:'cs',simulation:'cf',tacle_mauvais:'ce',tacle_malefique:'ce',atk_demo:'cf',subtilisation:'ci',vol:'ci',main:'cs',main_discrete:'cs',comedia:'cf',blizzard:'ci',seisme:'cf',domination:'cs',stase:'cs',maledic2:'cs',epuise2:'cs',laser_oculaire:'cf',
  };
  const pOvr=p=>{const s=p.s||{};const vals=Object.values(s);return vals.length?Math.round(vals.reduce((a,v)=>a+v,0)/vals.length):50;};
  const mkProw=(p,pi,source)=>{
    const miss=p._missNextMatch?'<span style="font-size:9px;color:#e02030" title="Blessé - indisponible prochain match"> 🚫</span>':'';
    const inj=p.injLevel>0?`<span style="font-size:9px;color:${INJ_COLORS[p.injLevel]}">${['','🤕','🚑','🆘'][p.injLevel]}</span>`:'';
    return `
    <div class="prow" style="display:flex;align-items:center;gap:4px">
      <div class="av" style="width:26px;height:26px;border-color:${T.color}50;background:${T.color}22;flex-shrink:0;cursor:pointer" onclick="openM(${ti},${pi},'${source}')">
        ${p.img?`<img src="${p.img}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`:`<span style="font-size:9px;font-weight:700;color:${T.color}">${p.ini}</span>`}
      </div>
      <div class="pi" style="flex:1;cursor:pointer" onclick="openM(${ti},${pi},'${source}')">
        <div class="pn">${p.name}${inj}${miss}</div>
        <div class="pp">${p.pos} <span style="color:${T.color};font-weight:700;font-size:9px">OVR ${pOvr(p)}</span>${(()=>{const eff=playerMatchOvr(p);const diff=eff-pOvr(p);return diff!==0?` <span style="color:${diff>0?'#18c860':'#e06060'};font-weight:700;font-size:8px" title="OVR effectif en match (forme/moral/sorts inclus)">→ ${eff}</span>`:'';})()}</div>
        <div class="sm">
          <span class="sb">V${p.s.spd}</span><span class="sb">T${p.s.sht}</span><span class="sb">D${p.s.def}</span>
          ${(p.spells||[]).slice(0,2).map(s=>{const sp=SPELLS.find(x=>x.id===s);return sp?`<span class="chip ${spellClass[sp.t]||'cf'}">${sp.n.split(' ')[0]}</span>`:''}).join('')}
        </div>
      </div>
      ${source==='reserve'?`<button onclick="promoteReserve(${ti},${pi})" style="background:none;border:1px solid var(--b2);border-radius:4px;color:#69f0ae;cursor:pointer;font-size:11px;padding:1px 5px;flex-shrink:0" title="Monter au banc">↑</button>`:''}
      ${source==='bench'?`<button onclick="demoteToReserve(${ti},${pi})" style="background:none;border:1px solid var(--b2);border-radius:4px;color:var(--muted);cursor:pointer;font-size:11px;padding:1px 5px;flex-shrink:0" title="Mettre en réserviste">↓</button>`:''}
    </div>`;
  };
  const sep=(icon,label)=>`<div style="font-family:'Barlow Condensed',sans-serif;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted);padding:5px 6px 2px;margin-top:2px;border-top:1px solid var(--b1)">${icon} ${label}</div>`;
  document.getElementById(`tblk${ti}`).innerHTML=`
  <div class="team-blk">
    <div class="team-hd">
      <div class="tdot2" style="background:${T.color}"></div>
      <input class="tname" value="${T.name}" onchange="teams[${ti}].name=this.value;syncHUD()">
      <input type="color" value="${T.color}" onchange="teams[${ti}].color=this.value;document.getElementById('hs${ti}').style.color=this.value;renderTB(${ti})">
    </div>
    <div style="padding:4px 6px 8px;border-bottom:1px solid var(--b1);display:flex;align-items:center;gap:10px">
      <div>
        <div id="tbadge${ti}" onclick="document.getElementById('tfup${ti}').click()" style="width:52px;height:52px;border-radius:50%;border:2px solid ${T.color}66;background:${T.color}22;cursor:pointer;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:22px" title="Cliquer pour importer un drapeau/logo">
          ${T.img?`<img src="${T.img}" style="width:100%;height:100%;object-fit:cover">`:`<span style="color:${T.color};font-size:17px;font-weight:900">${teamIni(T.name)}</span>`}
        </div>
        <input type="file" id="tfup${ti}" accept="image/*" style="display:none" onchange="handleTeamImg(event,${ti})">
        <div style="font-size:8px;color:var(--muted);text-align:center;margin-top:3px;letter-spacing:.5px;cursor:pointer" onclick="document.getElementById('tfup${ti}').click()">LOGO</div>
      </div>
      <div style="flex:1">
        <div style="font-size:9px;color:var(--muted);margin-bottom:4px">Logo / drapeau de l'équipe<br><span style="color:#333">Affiché dans le pré-match et les calendriers</span></div>
        ${T.img?`<button class="btn" style="padding:2px 8px;font-size:9px" onclick="teams[${ti}].img='';teams[${ti}]._img=null;renderTB(${ti});syncHUD()">✕ Supprimer</button>`:''}
      </div>
    </div>
    <div class="plist">
    ${T.players.map((p,pi)=>mkProw(p,pi,'player')).join('')}
    ${sep('🪑','Banc — Remplaçants')}
    ${T.bench.map((p,bi)=>mkProw(p,bi,'bench')).join('')}
    ${T.reserves&&T.reserves.length?sep('📋','Réservistes')+T.reserves.map((p,ri)=>mkProw(p,ri,'reserve')).join(''):''}
    </div>
  </div>`;
}


function updateCompoPitch(){
  [0,1].forEach(ti=>{
    const el=document.getElementById('compo-rows-'+ti);
    if(!el) return;
    const T=teams[ti];
    const col=T.color;
    const pOvr=p=>{const s=p.s||{};const v=Object.values(s);return v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length):50;};
    const dot=(p)=>{
      const ovr=pOvr(p);
      const ovrCol=ovr>=75?'#18c860':ovr>=60?'#f0c028':'#e06060';
      const shortName=(p.name||'?').split(' ').map((w,i)=>i===0?w[0]+'.':w).join(' ');
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;width:46px">
        <div style="position:relative">
          <div style="width:36px;height:36px;border-radius:50%;border:2px solid ${col};overflow:hidden;background:${col}22;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.5)">
            ${p.img?`<img src="${p.img}" style="width:100%;height:100%;object-fit:cover">`:`<span style="font-size:11px;font-weight:900;color:${col}">${(p.ini||p.name||'?').slice(0,2).toUpperCase()}</span>`}
          </div>
          <div style="position:absolute;bottom:-2px;right:-2px;background:${ovrCol};border-radius:3px;padding:0 2px;font-size:7px;font-weight:900;color:#000;line-height:14px">${ovr}</div>
        </div>
        <div style="background:rgba(0,0,0,.65);border-radius:3px;padding:1px 3px;text-align:center;max-width:46px">
          <div style="font-size:7px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:44px">${shortName}</div>
          <div style="font-size:6px;color:${col};font-weight:700">${p.pos||''}</div>
        </div>
      </div>`;
    };
    const lines={GB:[],DEF:[],MID:[],ATT:[]};
    (T.players||[]).slice(0,7).forEach(p=>{
      const pos=p.pos||'MC';
      if(pos==='GB') lines.GB.push(p);
      else if(['DC','DD','DG'].includes(pos)) lines.DEF.push(p);
      else if(['MC','MDC','MO','MOG','MOD','AD','AG'].includes(pos)) lines.MID.push(p);
      else lines.ATT.push(p);
    });
    const row=(ps)=>ps.length?`<div style="display:flex;justify-content:space-evenly;align-items:flex-start;padding:4px 0;min-height:52px">${ps.map(p=>dot(p)).join('')}</div>`:'';
    if(ti===0){
      el.innerHTML=row(lines.GB)+row(lines.DEF)+row(lines.MID)+row(lines.ATT);
    } else {
      el.innerHTML=row(lines.ATT)+row(lines.MID)+row(lines.DEF)+row(lines.GB);
    }
  });
}

function renderTactics(){
  [0,1].forEach(ti=>{
    const T=teams[ti];
    document.getElementById(`tac${ti}`).innerHTML=`
    <div class="team-blk" style="margin-bottom:8px">
      <div class="team-hd"><div class="tdot2" style="background:${T.color}"></div>
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;letter-spacing:.8px;text-transform:uppercase">${T.name}</div>
      </div>
      <div style="padding:6px">
        <div style="font-size:9px;color:var(--muted);background:var(--panel);border:1px solid var(--b1);border-radius:6px;padding:5px 7px;margin-bottom:6px;line-height:1.4">ℹ️ La stratégie règle le pressing/largeur/profondeur d'équipe. Le <b>placement sur le terrain</b> de chaque joueur vient de son <b>Poste</b> individuel (fiche joueur) — modifiable librement, plusieurs joueurs au même poste se répartissent automatiquement.</div>
        ${STRATS.map(s=>`
        <div class="sc${T.strat===s.id?' sel':''}" onclick="teams[${ti}].strat='${s.id}';applyFormationRoles(${ti});renderTactics();updateCompoPitch();syncHUD()">
          <div style="display:flex;align-items:center;gap:5px"><div style="width:7px;height:7px;border-radius:50%;background:${s.col}"></div><div class="st">${s.n}</div></div>
          <div class="sd">${s.d}</div>
          <div class="sbar-row">
            <div class="sbar-w"><div class="sbar-lbl">ATK</div><div class="sbar-track"><div class="sbar-fill" style="width:${Math.round(s.atk/1.22*100)}%;background:var(--red)"></div></div></div>
            <div class="sbar-w"><div class="sbar-lbl">DEF</div><div class="sbar-track"><div class="sbar-fill" style="width:${Math.round(s.def/1.30*100)}%;background:var(--blue)"></div></div></div>
          </div>
        </div>`).join('')}
      </div>
    </div>`;
  });
}

let editTi=0,editPi=0,editSource='player',editCtx='main',editCupId=null;
let _copiedStats=null;

function openM(ti,pi,source='player'){
  editCtx='main';editCupId=null;editTi=ti;editPi=pi;editSource=source;
  const arr=_resolveEditArr();
  const p=arr[pi],T=teams[ti];
  _renderPlayerEditor(p,T,source);
}

// Ouvre le même éditeur de joueur riche (stats + recherche de sorts) pour un
// joueur d'une équipe de la coupe (PNJ, sauvegardée, ou IA par défaut) ou
// d'une équipe du roster éditée directement (ref = "saved:IDX").
function openCupPlayerEditor(ref,pi,source='player'){
  editCtx='cup';editCupId=ref;editTi=null;editPi=pi;editSource=source;
  const r=_cteRef(ref);if(!r)return;
  const arr=source==='bench'?(r.ref.bench||[]):source==='reserve'?(r.ref.reserves||[]):(r.ref.players||[]);
  const p=arr[pi];if(!p)return;
  _renderPlayerEditor(p,r.ref,source);
}

// Résout le tableau de joueurs actif selon le contexte d'édition (jeu principal ou coupe)
function _resolveEditArr(){
  if(editCtx==='cup'){
    const r=_cteRef(editCupId);if(!r)return[];
    if(editSource==='bench'){if(!r.ref.bench)r.ref.bench=[];return r.ref.bench;}
    if(editSource==='reserve'){if(!r.ref.reserves)r.ref.reserves=[];return r.ref.reserves;}
    if(!r.ref.players)r.ref.players=[];return r.ref.players;
  }
  return editSource==='bench'?teams[editTi].bench:editSource==='reserve'?teams[editTi].reserves:teams[editTi].players;
}

function _renderPlayerEditor(p,T,source){
  const label={player:'',bench:' (Banc)',reserve:' (Réserviste)'}[source]||'';
  document.getElementById('mttl').textContent=p.name+' · '+p.pos+label;
  document.getElementById('mcnt').innerHTML=`
  <div style="display:flex;gap:11px;align-items:flex-start;margin-bottom:12px">
    <div>
      <div class="av" id="mav" style="width:52px;height:52px;font-size:15px;font-weight:800;cursor:pointer;border-color:${T.color}60;background:${T.color}22" onclick="document.getElementById('fup').click()" title="Cliquer pour changer la photo">
        ${p.img?`<img src="${p.img}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`:`<span style="color:${T.color}">${p.ini}</span>`}
      </div>
      <input type="file" id="fup" accept="image/*" style="display:none" onchange="handleImg(event)">
      <div style="font-size:8px;color:var(--muted);text-align:center;margin-top:2px;letter-spacing:.5px;cursor:pointer" onclick="document.getElementById('fup').click()">PHOTO</div>
    </div>
    <div style="flex:1">
      <div class="frow"><span class="lbl">Nom</span><input class="inp" id="pn" value="${p.name}"></div>
      <div class="frow"><span class="lbl">Poste</span>
        <select class="inp" id="ppos" style="cursor:pointer">
          ${['GB','DD','DC','DG','MDC','MC','MO','ATT','AG','AD'].map(po=>`<option${po===p.pos?' selected':''}>${po}</option>`).join('')}
        </select>
      </div>
    </div>
  </div>
  <div class="slbl" style="display:flex;align-items:center;justify-content:space-between;gap:6px">
    <span>Statistiques</span>
    <span style="display:flex;gap:4px">
      <button type="button" class="btn" style="padding:2px 8px;font-size:9px;text-transform:none;letter-spacing:0" onclick="copyPlayerStats()" title="Copier les statistiques de ce joueur">📋 Copier</button>
      <button type="button" class="btn" id="paste-stats-btn" style="padding:2px 8px;font-size:9px;text-transform:none;letter-spacing:0${_copiedStats?'':';opacity:.4;cursor:not-allowed'}" onclick="pastePlayerStats()" title="Coller les statistiques copiées"${_copiedStats?'':' disabled'}>📥 Coller${_copiedStats?'':''}</button>
    </span>
  </div>
  <div id="paste-stats-hint" style="font-size:9px;color:var(--muted);margin:-3px 0 6px;display:${_copiedStats?'block':'none'}">Copié : ${_copiedStats?Object.entries(_copiedStats).map(([k,v])=>k.toUpperCase()+' '+v).join(' · '):''}</div>
  ${[['spd','Vitesse'],['sht','Tir'],['def','Défense'],['stam','Endurance'],['tec','Technique'],['res','Résistance bless.']].map(([k,l])=>`
  <div class="frow"><span class="lbl">${l}</span>
    <div class="rrow">
      <input type="range" min="1" max="99" step="1" value="${p.s[k]||50}" id="s_${k}" oninput="document.getElementById('v_${k}').textContent=this.value">
      <span class="rv" id="v_${k}">${p.s[k]||50}</span>
    </div>
  </div>`).join('')}
  <div class="slbl">Sorts & Techniques <span id="sg-count" style="color:var(--gold);font-weight:800">(${(p.spells||[]).length}/3)</span></div>
  <input type="text" id="sg-search" class="inp" placeholder="🔍 Rechercher un sort (nom)…" style="margin-bottom:6px;font-size:11px" oninput="filterSpells(this.value)">
  <div style="display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap">
    ${[['all','Tous'],['tir','⚔️ Tir'],['soutien','💚 Soutien'],['malus','🔴 Malus']].map(([k,l])=>`<span class="btn" style="font-size:9px;padding:3px 8px" data-catf="${k}" onclick="filterSpellCat('${k}',this)">${l}</span>`).join('')}
  </div>
  <div id="spell-desc" style="min-height:32px;font-size:9px;color:var(--muted);background:var(--panel);border:1px solid var(--b1);border-radius:5px;padding:5px 8px;margin-bottom:6px;line-height:1.5;transition:opacity .15s">Touchez un sort pour voir sa description.</div>
  <div id="sg" style="max-height:280px;overflow-y:auto;padding-right:2px">
    ${(()=>{
      const spellCat=s=>s.pow>0?'tir':SUPPORT_SPELLS.has(s.id)?'soutien':'malus';
      const CAT_LABELS={tir:'⚔️ Sorts de Tir',soutien:'💚 Soutien & Buffs',malus:'🔴 Malus & Contrôle'};
      const grouped={tir:[],soutien:[],malus:[]};
      SPELLS.forEach(s=>grouped[spellCat(s)].push(s));
      return Object.keys(grouped).map(catKey=>{
        const list=grouped[catKey];
        return `<div class="spell-group" data-cat="${catKey}">
          <div style="font-size:9px;font-weight:800;letter-spacing:1px;color:var(--muted);text-transform:uppercase;margin:6px 0 4px;padding-top:4px;border-top:1px solid var(--b1)">${CAT_LABELS[catKey]} <span style="font-weight:600">(${list.length})</span></div>
          <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:4px">
            ${list.map(s=>{
              const active=(p.spells||[]).includes(s.id);
              const cat=s.pow>0?'⚔️ Tir':SUPPORT_SPELLS.has(s.id)?'💚 Soutien':'🔴 Debuff';
              return `<span class="chip spell-chip" style="padding:5px 8px 5px 7px;cursor:pointer;font-size:10px;display:inline-flex;align-items:center;gap:3px;border-radius:6px;transition:all .12s;opacity:${active?1:.5};border:1px solid ${active?s.col:'var(--b2)'};background:${active?s.col+'26':'transparent'}" data-id="${s.id}" data-name="${s.n.toLowerCase()}" data-label="${s.n}" data-col="${s.col}" data-desc="${s.desc||''}" data-cat="${cat}" data-mp="${s.mp}" data-pow="${s.pow}" onclick="tgS('${s.id}',this)" onmouseenter="showSpellDesc(this)" onmouseleave="hideSpellDesc()"><span class="spell-chk" style="display:${active?'inline':'none'};color:${s.col}">✓</span>${s.n} <span style="opacity:.65;font-size:8px">${s.mp}PM${s.pow>0?' · '+s.pow:''}</span></span>`;
            }).join('')}
          </div>
        </div>`;
      }).join('');
    })()}
    <div id="sg-empty" style="display:none;text-align:center;color:var(--muted);font-size:10px;padding:14px 0">Aucun sort ne correspond à la recherche.</div>
  </div>
  <div style="display:flex;justify-content:flex-end;gap:7px;margin-top:14px">
    <button class="btn" onclick="closeM()">Annuler</button>
    <button class="btn btng" onclick="saveP()">✓ Sauvegarder</button>
  </div>`;
  document.getElementById('pmodal').classList.add('on');
}
function tgS(id,el){
  const all=[...document.querySelectorAll('#sg .chip')];
  const a=all.filter(b=>parseFloat(b.style.opacity)>=1).map(b=>b.dataset.id);
  const isActive=a.includes(id);
  const chk=el.querySelector('.spell-chk');
  if(isActive){
    el.style.opacity='.5';
    el.style.border='1px solid var(--b2)';
    el.style.background='transparent';
    if(chk)chk.style.display='none';
  } else if(a.length<3){
    el.style.opacity='1';
    const col=el.dataset.col||'#888';
    el.style.border='1px solid '+col;
    el.style.background=col+'26';
    if(chk)chk.style.display='inline';
  } else {
    if(el.animate)el.animate([{transform:'translateX(0)'},{transform:'translateX(-3px)'},{transform:'translateX(3px)'},{transform:'translateX(0)'}],{duration:180});
    showSpellDesc(el);
    return;
  }
  showSpellDesc(el);
  updateSpellCount();
}
function updateSpellCount(){
  const n=[...document.querySelectorAll('#sg .chip')].filter(b=>parseFloat(b.style.opacity)>=1).length;
  const c=document.getElementById('sg-count');
  if(c)c.textContent='('+n+'/3)';
}
function filterSpells(q){
  const norm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  q=norm(q);
  let anyVisible=false;
  document.querySelectorAll('#sg .spell-group').forEach(g=>{
    const activeCat=document.querySelector('[data-catf].on-filter')?.dataset.catf||'all';
    let any=false;
    g.querySelectorAll('.spell-chip').forEach(chip=>{
      const name=norm(chip.dataset.name);
      const catOk=activeCat==='all'||g.dataset.cat===activeCat;
      const match=catOk&&(!q||name.includes(q));
      chip.style.display=match?'inline-flex':'none';
      if(match){any=true;anyVisible=true;}
    });
    g.style.display=any?'':'none';
  });
  const empty=document.getElementById('sg-empty');
  if(empty)empty.style.display=anyVisible?'none':'block';
}
function filterSpellCat(cat,el){
  document.querySelectorAll('[data-catf]').forEach(b=>{b.classList.remove('on-filter');b.style.background='';b.style.color='';b.style.borderColor='';});
  el.classList.add('on-filter');
  el.style.background='var(--gold)';el.style.color='#05101c';el.style.borderColor='var(--gold)';
  filterSpells(document.getElementById('sg-search')?.value||'');
}
function showSpellDesc(el){
  const d=document.getElementById('spell-desc');if(!d)return;
  const desc=el.dataset.desc||'';
  const cat=el.dataset.cat||'';
  const mp=el.dataset.mp||'?';
  const pow=parseInt(el.dataset.pow||0);
  const label=el.dataset.label||el.textContent.trim();
  const active=parseFloat(el.style.opacity)>=1;
  d.innerHTML=`<b style="color:var(--fg)">${label}</b> <span style="color:var(--muted);font-size:8px">${cat} · ${mp}PM${pow>0?' · Puissance '+pow:''}</span>${active?' <span style="color:var(--green);font-size:8px">✓ Équipé</span>':''}<br><span style="color:var(--muted)">${desc}</span>`;
}
function hideSpellDesc(){
  const d=document.getElementById('spell-desc');
  if(d)d.innerHTML='Touchez un sort pour voir sa description.';
}
function handleTeamImg(e,ti){
  const f=e.target.files[0];if(!f)return;
  _compressImage(f,160,0.72,dataUrl=>{
    teams[ti].img=dataUrl;
    teams[ti]._img=null;
    renderTB(ti);syncHUD();
  });
}

function handleImg(e){
  const f=e.target.files[0];if(!f)return;
  _compressImage(f,120,0.72,dataUrl=>{
    const arr=_resolveEditArr();
    if(arr[editPi])arr[editPi].img=dataUrl;
    const mav=document.getElementById('mav');
    if(mav)mav.innerHTML=`<img src="${dataUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  });
}

function saveP(){
  const arr=_resolveEditArr();
  const p=arr[editPi];
  const newPos=document.getElementById('ppos').value;
  const wasGB=p.pos==='GB';
  const preMatch=_isPreMatch();
  p.name=document.getElementById('pn').value;
  p.ini=p.name.slice(0,2).toUpperCase();
  ['spd','sht','def','stam','tec','res'].forEach(k=>{
    const el=document.getElementById(`s_${k}`);
    if(el)p.s[k]=parseInt(el.value);
  });
  // Poste : même règle que partout ailleurs pour le gardien de fortune.
  // On ne l'applique que pour l'équipe en match réel (pas l'édition d'une
  // équipe de coupe hors contexte, éditée sans lien avec un match en cours).
  if(editCtx==='cup'){
    p.pos=newPos;
  } else if(wasGB&&newPos!=='GB'&&p._emergencyGK){
    delete p._origPos;delete p._origStatsGK;delete p._emergencyGK;
    p.pos=newPos;
  } else if(newPos==='GB'&&!wasGB&&!preMatch&&!p._emergencyGK){
    applyEmergencyGKMalus(p); // fixe p.pos='GB' + applique le malus sur les stats qu'on vient de sauver
    logEvent(`🧤⚠️ ${p.name} n'est pas gardien de formation — il prend les gants avec un malus !`,'#f0c028');
  } else {
    p.pos=newPos;
  }
  p.spells=[...document.querySelectorAll('#sg .chip')].filter(b=>parseFloat(b.style.opacity)>=1).map(b=>b.dataset.id);
  p._img=null;
  if(editCtx==='cup'){
    _cteCommit(editCupId);
    const cid=editCupId;
    editCtx='main';editCupId=null;
    openCupTeamRoster(cid);
  } else {
    closeM();renderTB(editTi);
  }
}
function closeM(){
  if(editCtx==='cup'&&editCupId!==null){
    const cid=editCupId;
    editCtx='main';editCupId=null;
    openCupTeamRoster(cid);
    return;
  }
  document.getElementById('pmodal').classList.remove('on');
}

// ── Copier / coller les statistiques d'un joueur ────────────────────
function _readStatsFromInputs(inPfx){
  const s={};
  ['spd','sht','def','stam','tec','res'].forEach(k=>{
    const el=document.getElementById(`${inPfx}${k}`);
    s[k]=el?parseInt(el.value):50;
  });
  return s;
}
function _writeStatsToInputs(inPfx,valPfx,stats){
  Object.entries(stats).forEach(([k,v])=>{
    const el=document.getElementById(`${inPfx}${k}`);
    const sp=document.getElementById(`${valPfx}${k}`);
    if(el)el.value=v;
    if(sp)sp.textContent=v;
  });
}
function _updatePasteUI(btnId,hintId){
  const btn=document.getElementById(btnId);
  if(btn){btn.disabled=false;btn.style.opacity='';btn.style.cursor='';}
  const hint=document.getElementById(hintId);
  if(hint&&_copiedStats){
    hint.style.display='block';
    hint.textContent='Copié : '+Object.entries(_copiedStats).map(([k,v])=>k.toUpperCase()+' '+v).join(' · ');
  }
}
function copyPlayerStats(){
  _copiedStats=_readStatsFromInputs('s_');
  _updatePasteUI('paste-stats-btn','paste-stats-hint');
}
function pastePlayerStats(){
  if(!_copiedStats)return;
  _writeStatsToInputs('s_','v_',_copiedStats);
}
function copyLeaguePlayerStats(){
  _copiedStats=_readStatsFromInputs('ls_');
  _updatePasteUI('lpaste-stats-btn','lpaste-stats-hint');
}
function pasteLeaguePlayerStats(){
  if(!_copiedStats)return;
  _writeStatsToInputs('ls_','lv_',_copiedStats);
}

function renderStats(){
  const t=G.possT[0]+G.possT[1]||1;
  let html=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
  ${[0,1].map(ti=>`
    <div style="background:var(--card);border:1px solid var(--b1);border-radius:9px;padding:12px;text-align:center">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:9px;font-weight:700;letter-spacing:2px;color:var(--muted);text-transform:uppercase">${teams[ti].name}</div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:46px;font-weight:900;color:${teams[ti].color};line-height:1">${G.scores[ti]}</div>
      <div style="font-size:10px;color:var(--muted)">Possession <b style="color:${teams[ti].color}">${Math.round(G.possT[ti]/t*100)}%</b></div>
      <div style="font-size:10px;color:var(--muted)">Tirs <b style="color:var(--text)">${G.shots[ti]}</b> · Corners <b>${G.corners[ti]}</b></div>
    </div>`).join('')}
  </div>`;
  [0,1].forEach(ti=>{
    html+=`<div class="stat-section-title" style="color:${teams[ti].color}">${teams[ti].name}</div>`;
    teams[ti].players.forEach(p=>{
      html+=`<div class="pstat-card">
        <div class="pstat-top">
          <div class="av" style="width:24px;height:24px;font-size:8px;font-weight:800;border-color:${teams[ti].color}50;background:${teams[ti].color}22;flex-shrink:0">
            ${p.img?`<img src="${p.img}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`:`<span style="color:${teams[ti].color}">${p.ini}</span>`}
          </div>
          <div><div class="pstat-name">${p.name}${p.red?' 🟥':''}</div><div class="pstat-pos">${p.pos}</div></div>
        </div>
        ${[['V',p.s.spd,'#1878e8'],['T',p.s.sht,'#e02030'],['D',p.s.def,'#18c860'],['E',p.s.stam,'#f0c028'],['Te',p.s.tec,'#8840e0']].map(([l,v,c])=>`
        <div class="pstat-bar-row"><span class="pstat-bar-lbl">${l}</span><div class="pstat-bar-track"><div class="pstat-bar-fill" style="width:${v}%;background:${c}"></div></div><span class="pstat-val">${v}</span></div>`).join('')}
        <div class="pstat-badges">
          ${p.mG>0?`<span class="mbdg mg">⚽ ${p.mG} but${p.mG>1?'s':''}</span>`:''}
          ${p.mSh>0?`<span class="mbdg ms">${p.mSh} tirs</span>`:''}
          ${p.mTk>0?`<span class="mbdg ms" style="background:rgba(64,112,160,.18);color:#90a8c8">⚡ ${p.mTk} tacle${p.mTk>1?'s':''}</span>`:''}
          ${p.mSp>0?`<span class="mbdg msp">${p.mSp} sorts</span>`:''}
        </div>
      </div>`;
    });
  });
  document.getElementById('stats-out').innerHTML=html;
}

// ═══════════════════════════════════════════════════════════
// DRAW / EXTRA TIME / PENALTIES
// ═══════════════════════════════════════════════════════════
function onFinalWhistle(){
  G.running=false;
  if(_gifRec.active)stopGifRecord(true);
  document.getElementById('hphase').textContent='SIFFLET FINAL';
  const[s0,s1]=G.scores;
  if(s0===s1){
    const el=document.getElementById('draw-score');
    el.innerHTML=`<span style="color:${teams[0].color}">${s0}</span> <span style="color:var(--muted)">—</span> <span style="color:${teams[1].color}">${s1}</span>`;
    document.getElementById('draw-modal').classList.add('on');
  } else {endMatch();}
}
function acceptDraw(){document.getElementById('draw-modal').classList.remove('on');endMatch();}
function chooseExtraTime(){
  document.getElementById('draw-modal').classList.remove('on');
  _restituerAideDivine(2);
  G.half=3;G._paused=true;G.running=false;
  document.getElementById('hphase').textContent='1re PROLONGATION';
  logEvent('⏱ Prolongations ! 2 × 15 min','#f0c028');
  placeKickoff(Math.random()<.5?0:1);setPhase('KICKOFF');
  setTimeout(()=>openHalftime(false,'prolong1'),400);
}
function choosePenalties(){
  document.getElementById('draw-modal').classList.remove('on');
  // Pause avant les tirs au but
  setTimeout(()=>openHalftime(false,'penalties'),400);
}

// ── PENALTY SHOOTOUT ─────────────────────────────────────
let psState={round:0,maxRounds:5,scores:[0,0],kicks:[],done:false,currentTeam:0,awaitingKick:true};
function startPenaltyShootout(){
  psState={round:0,maxRounds:5,scores:[0,0],kicks:[],done:false,currentTeam:0,awaitingKick:true};
  G.phase='PENALTIES';
  document.getElementById('hphase').textContent='TIRS AU BUT';
  document.getElementById('ps-n0').textContent=teams[0].name.toUpperCase();
  document.getElementById('ps-n1').textContent=teams[1].name.toUpperCase();
  document.getElementById('ps-n0').style.color=teams[0].color;
  document.getElementById('ps-n1').style.color=teams[1].color;
  document.getElementById('ps-overlay').classList.add('on');
  logEvent('⚽ Tirs au but !','#f0c028');
  renderPSOverlay();
}
function psBestKicker(ti){
  const n=psState.kicks.filter(k=>k.ti===ti).length%6;
  const field=teams[ti].players.filter(p=>p&&p.pos!=='GB').sort((a,b)=>b.s.sht-a.s.sht);
  return field[n]||field[0]||teams[ti].players.find(p=>p)||{name:'Joueur',s:{sht:50,def:50}};
}
function psGK(ti){return teams[ti].players.find(p=>p&&p.pos==='GB')||teams[ti].players.find(p=>p)||{name:'Gardien',s:{def:50}};}
function takePenaltyKick(){
  if(psState.done||!psState.awaitingKick)return;
  psState.awaitingKick=false;
  const ti=psState.currentTeam;
  const kicker=psBestKicker(ti),gk=psGK(1-ti);
  const scored=Math.random()<Math.min(0.97,Math.max(0.20,(0.55+((kicker.s.sht+(kicker._hm||0))/99)*.35-((gk.s.def+(gk._hm||0))/99)*.20)));
  psState.kicks.push({ti,kName:kicker.name,scored});
  if(scored)psState.scores[ti]++;
  document.getElementById('ps-kicker').textContent=kicker.name+' tire…';
  document.getElementById('ps-result').textContent='';
  renderPSScores();
  setTimeout(()=>{
    const res=document.getElementById('ps-result');
    res.textContent=scored?'⚽ BUT !':'🧤 ARRÊTÉ !';
    res.style.color=scored?'#18c860':'#e02030';
    logEvent((scored?'⚽ BUT — ':'🧤 Arrêté — ')+kicker.name,scored?'#18c860':'#e02030');
    renderPSScores();
    setTimeout(()=>{
      psState.currentTeam=1-ti;
      if(psState.currentTeam===0)psState.round++;
      if(checkPSDone()){
        psState.done=true;
        const[ps0,ps1]=psState.scores;const w=ps0>ps1?0:1;
        G.penaltyWinner=w;
        document.getElementById('ps-kicker').textContent='';
        res.textContent='🏆 '+teams[w].name+' gagne !';res.style.color=teams[w].color;
        logEvent('🏆 '+teams[w].name+' remporte les tirs au but !',teams[w].color);
        document.getElementById('ps-kick-btn').style.display='none';
        document.getElementById('ps-close-btn').style.display='block';
      } else {psState.awaitingKick=true;renderPSOverlay();}
    },1400);
  },900);
}
function checkPSDone(){
  const[s0,s1]=psState.scores;
  const k0=psState.kicks.filter(k=>k.ti===0).length;
  const k1=psState.kicks.filter(k=>k.ti===1).length;
  const max=psState.maxRounds;

  // Phase régulière: au moins une équipe n'a pas encore tiré ses max tirs
  if(k0<max||k1<max){
    const rem0=max-k0,rem1=max-k1;
    if(s0>s1+rem1&&k1<=k0) return true;  // T0 imbattable
    if(s1>s0+rem0&&k0<=k1) return true;  // T1 imbattable
    return false;
  }
  // Les deux ont exactement tiré max → résultat régulier
  if(k0===max&&k1===max&&s0!==s1) return true;
  // Mort subite: k0>max et k1>max, même nombre de tirs
  if(k0>max&&k1>max&&k0===k1&&s0!==s1) return true;
  return false;
}
function renderPSScores(){
  document.getElementById('ps-s0').textContent=psState.scores[0];
  document.getElementById('ps-s1').textContent=psState.scores[1];
  const mkK=k=>`<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:${k.scored?'#18c860':'#e02030'};font-size:9px">${k.scored?'⚽':'✕'}</span>`;
  document.getElementById('ps-kicks0').innerHTML=psState.kicks.filter(k=>k.ti===0).map(mkK).join('');
  document.getElementById('ps-kicks1').innerHTML=psState.kicks.filter(k=>k.ti===1).map(mkK).join('');
}
function renderPSOverlay(){
  renderPSScores();
  if(!psState.awaitingKick||psState.done)return;
  const ti=psState.currentTeam,k=psBestKicker(ti);
  const k0=psState.kicks.filter(x=>x.ti===0).length;
  const k1=psState.kicks.filter(x=>x.ti===1).length;
  const inSuddenDeath=k0>=psState.maxRounds&&k1>=psState.maxRounds;
  const kickNum=psState.kicks.filter(x=>x.ti===ti).length+1;
  const rd=inSuddenDeath?'💀 Mort subite':`Tir ${kickNum}/${psState.maxRounds}`;
  document.getElementById('ps-kicker').textContent=teams[ti].name+' · '+k.name+' — '+rd;
  document.getElementById('ps-kicker').style.color=teams[ti].color;
  document.getElementById('ps-result').textContent='';
  const btn=document.getElementById('ps-kick-btn');
  btn.textContent='⚽ Tirer';btn.style.background=teams[ti].color;btn.style.display='block';
  document.getElementById('ps-close-btn').style.display='none';
}
function closePSAndEnd(){document.getElementById('ps-overlay').classList.remove('on');endMatch();}

// ═══════════════════════════════════════════════════════════
// ROSTER (saved teams)
// ═══════════════════════════════════════════════════════════
let savedTeams=[];
function serializePlayer(p){
  return{id:p.id,name:p.name,pos:p.pos,img:p.img||'',ini:p.ini||p.name.slice(0,2).toUpperCase(),
    s:{...p.s},spells:[...(p.spells||[])],
    x:0,y:0,vx:0,vy:0,tx:0,ty:0,hp:100,mp:100,yc:0,red:false,stunT:0,hasBall:false,
    injLevel:0,injT:0,mG:0,mSh:0,mTk:0,mSp:0,_img:null,onBench:!!p.onBench,
    _spdDebuff:0,_charmed:0,_atkBuff:0,_pacified:0,_invis:0,_folie:0,_aile:0,_sixsens:0,_sylvestre:0,_dominated:0,
    bobPhase:Math.random()*Math.PI*2,
    wPhaseX:Math.random()*Math.PI*2,wPhaseY:Math.random()*Math.PI*2,wSpeed:1.4+Math.random()*1.2,
    runT:0,runTx:0,runTy:0,runCool:Math.random()*2,dribCurve:0,tackleCool:0};
}
function serializeTeam(T){
  return{name:T.name,color:T.color,img:T.img||'',strat:T.strat||'321',
    players:T.players.map(serializePlayer),
    bench:T.bench.map(serializePlayer),
    reserves:(T.reserves||[]).map(serializePlayer)};
}
function loadSavedTeams(){try{savedTeams=JSON.parse(localStorage.getItem('footsim7v7_roster')||'[]');}catch(e){savedTeams=[];}}
function persistSavedTeams(){
  if(_safeLSSet('footsim7v7_roster',savedTeams))return true;
  // Échec (quota dépassé, souvent à cause des logos/photos en base64).
  // Tentative de secours : on retire les images pour préserver au moins les
  // équipes et leurs joueurs, plutôt que de tout perdre au rechargement.
  try{
    const stripped=savedTeams.map(t=>({
      ...t,
      img:'',
      players:(t.players||[]).map(p=>({...p,img:''})),
      bench:(t.bench||[]).map(p=>({...p,img:''})),
      reserves:(t.reserves||[]).map(p=>({...p,img:''})),
    }));
    if(_safeLSSet('footsim7v7_roster',stripped)){
      savedTeams=stripped;
      logEvent('⚠️ Stockage plein : les équipes ont été sauvegardées SANS leurs logos/photos pour éviter de tout perdre.','#e0a020');
      return true;
    }
  }catch(e){}
  logEvent('❌ Impossible de sauvegarder les équipes (stockage plein). Supprimez des équipes PNJ, logos ou photos.','#e02030');
  return false;
}

// ── Résolution stable d'une équipe sauvegardée référencée par une coupe/ligue ──
// PROBLÈME CORRIGÉ : les coupes/ligues stockaient un simple index numérique
// (savedIdx) dans savedTeams. Supprimer ou réorganiser une équipe du roster
// décalait cet index, faisant pointer les coupes en cours vers la MAUVAISE
// équipe (ou une équipe inexistante) — les modifications semblaient "ne pas
// s'appliquer" car elles touchaient un autre objet que celui réellement
// utilisé en match. On identifie désormais chaque équipe sauvegardée par un
// UID stable, résolu dynamiquement vers son index courant dans savedTeams.
function _ensureSavedUid(idx){
  const st=savedTeams[idx];if(!st)return null;
  if(!st._uid){st._uid='st_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);persistSavedTeams();}
  return st._uid;
}
function _resolveSavedIdx(t){
  if(!t)return -1;
  if(t.savedUid!=null){
    const idx=savedTeams.findIndex(s=>s._uid===t.savedUid);
    if(idx>=0)return idx;
    return -1; // UID connu mais équipe supprimée du roster → référence cassée, pas de repli sur un ancien index
  }
  // Anciennes coupes/ligues créées avant l'introduction des UID stables
  if(t.savedIdx!=null&&savedTeams[t.savedIdx])return t.savedIdx;
  return -1;
}
function saveTeamToRoster(ti){
  const s=serializeTeam(teams[ti]);
  const idx=savedTeams.findIndex(t=>t.name===s.name);
  if(idx>=0){const prev=savedTeams[idx];savedTeams[idx]={...s,isHuman:prev.isHuman};}
  else{savedTeams.push({...s,isHuman:true});}  // new saves default to human
  persistSavedTeams();
  logEvent(`💾 ${teams[ti].name} sauvegardée dans le registre !`,teams[ti].color);
}
function toggleHumanFlag(idx){
  if(!savedTeams[idx])return;
  savedTeams[idx].isHuman=!savedTeams[idx].isHuman;
  persistSavedTeams();
  // Re-render wherever we are
  renderLeague();
}
function deleteFromRoster(idx){savedTeams.splice(idx,1);persistSavedTeams();renderLeague();}

// ═══════════════════════════════════════════════════════════
// LEAGUE MODE
// ═══════════════════════════════════════════════════════════
const AI_NAMES=['Dupont','Martin','Lebrun','Girard','Chevalier','Morel','Fournier','Lambert',
  'Perrin','Laurent','Garcia','Torres','Romero','Silva','Costa','Ferreira','Diaz','Santos'];
const AI_TEAM_DEFS=[
  {name:'FC Verdun',       color:'#18c860'},{name:'AS Lumière',      color:'#f0c028'},
  {name:'SC Mystère',      color:'#8840e0'},{name:'RC Tonnerre',     color:'#f07020'},
  {name:'US Phoenix',      color:'#00b8d4'},{name:'AC Étoile',       color:'#ff4081'},
  {name:'CS Vaillance',    color:'#64dd17'},{name:'FC Horizon',      color:'#40c4ff'},
  {name:'AS Bouclier',     color:'#ea80fc'},{name:'SC Tempête',      color:'#ffab40'},
  {name:'RC Victoire',     color:'#ff1744'},{name:'FC Olympe',       color:'#2979ff'},
  {name:'AS Falcons',      color:'#00e5ff'},{name:'SC Aurore',       color:'#ffd740'},
  {name:'US Aigle',        color:'#69f0ae'},{name:'AC Raptor',       color:'#ff6d00'},
  {name:'CS Titan',        color:'#d500f9'},{name:'RC Marée',        color:'#00bcd4'},
  {name:'FC Stade Nord',   color:'#c6ff00'},{name:'AS Delta',        color:'#ff5252'},
  {name:'US Renards',      color:'#e040fb'},{name:'SC Citadelle',    color:'#1de9b6'},
  {name:'AC Forge',        color:'#ff6e40'},{name:'FC Zéphyr',       color:'#40c4ff'},
  {name:'CS Loups Gris',   color:'#90a4ae'},{name:'RC Flèche',       color:'#f06292'},
  {name:'AS Cosmos',       color:'#7986cb'},{name:'SC Navire',       color:'#4db6ac'},
  {name:'FC Guerriers',    color:'#dce775'},{name:'US Gladiateurs',  color:'#ff8a65'},
  {name:'AC Dragons',      color:'#ef5350'},{name:'CS Panthères',    color:'#ab47bc'},
];
function mkAIPlayers(tid){
  const names=[...AI_NAMES].sort(()=>Math.random()-.5).slice(0,7);
  return names.map((name,i)=>({
    id:`ta${tid}p${i}`,name,pos:ROLE[i],img:'',ini:name.slice(0,2).toUpperCase(),
    s:{spd:32+~~(Math.random()*36),sht:30+~~(Math.random()*36),def:30+~~(Math.random()*36),stam:45+~~(Math.random()*30),tec:32+~~(Math.random()*36),res:28+~~(Math.random()*38)},
    spells:['tech'],x:0,y:0,vx:0,vy:0,tx:0,ty:0,hp:100,mp:100,yc:0,red:false,stunT:0,hasBall:false,
    injLevel:0,injT:0,mG:0,mSh:0,mTk:0,mSp:0,_img:null,
    _hm:(()=>{const r=(Math.random()+Math.random()-1)*10;return Math.round(Math.max(-10,Math.min(10,r)));})(),
    _hm:(()=>{const r=(Math.random()+Math.random()-1)*10;return Math.round(Math.max(-10,Math.min(10,r)));})(),
    _fm:(()=>{const r=(Math.random()+Math.random()-1)*10;return Math.round(Math.max(-10,Math.min(10,r)));})(),
    _spdDebuff:0,_charmed:0,_atkBuff:0,_pacified:0,_invis:0,_folie:0,_aile:0,_sixsens:0,_sylvestre:0,_dragon:0,
    bobPhase:Math.random()*Math.PI*2,wPhaseX:Math.random()*Math.PI*2,wPhaseY:Math.random()*Math.PI*2,wSpeed:1.4+Math.random()*1.2,
    runT:0,runTx:0,runTy:0,runCool:Math.random()*2,dribCurve:0,tackleCool:0}));
}
function mkAIBench(tid){
  const names=[...AI_NAMES].sort(()=>Math.random()-.5).slice(7,12);
  return names.map((name,i)=>({
    id:`ta${tid}b${i}`,name,pos:['MC','ATT','DC','DD','MC'][i],img:'',ini:name.slice(0,2).toUpperCase(),
    s:{spd:35+~~(Math.random()*48),sht:35+~~(Math.random()*48),def:35+~~(Math.random()*48),stam:55+~~(Math.random()*38),tec:35+~~(Math.random()*48),res:35+~~(Math.random()*50)},
    spells:['tech'],x:-10,y:PCY,vx:0,vy:0,tx:-10,ty:PCY,hp:100,mp:100,yc:0,red:false,stunT:0,hasBall:false,
    injLevel:0,injT:0,mG:0,mSh:0,mTk:0,mSp:0,_img:null,onBench:true,
    _spdDebuff:0,_charmed:0,_atkBuff:0,_pacified:0,_invis:0,_folie:0,_aile:0,_sixsens:0,_sylvestre:0,_dragon:0,
    bobPhase:Math.random()*Math.PI*2,wPhaseX:Math.random()*Math.PI*2,wPhaseY:Math.random()*Math.PI*2,wSpeed:1.4+Math.random()*1.2,
    runT:0,runTx:0,runTy:0,runCool:Math.random()*2,dribCurve:0,tackleCool:0}));
}
function mkAIReserves(tid){
  const names=[...AI_NAMES].sort(()=>Math.random()-.5).slice(12,15);
  return names.map((name,i)=>({
    id:`ta${tid}r${i}`,name,pos:['GB','DC','ATT'][i]||'MC',img:'',ini:name.slice(0,2).toUpperCase(),
    s:{spd:30+~~(Math.random()*45),sht:30+~~(Math.random()*45),def:30+~~(Math.random()*45),stam:50+~~(Math.random()*35),tec:30+~~(Math.random()*45),res:30+~~(Math.random()*45)},
    spells:['tech'],x:-10,y:PCY,vx:0,vy:0,tx:-10,ty:PCY,hp:100,mp:100,yc:0,red:false,stunT:0,hasBall:false,
    injLevel:0,injT:0,mG:0,mSh:0,mTk:0,mSp:0,_img:null,
    _hm:(()=>{const r=(Math.random()+Math.random()-1)*10;return Math.round(Math.max(-10,Math.min(10,r)));})(),
    _fm:(()=>{const r=(Math.random()+Math.random()-1)*10;return Math.round(Math.max(-10,Math.min(10,r)));})(),
    _spdDebuff:0,_charmed:0,_atkBuff:0,_pacified:0,_invis:0,_folie:0,_aile:0,_sixsens:0,_sylvestre:0,_dragon:0,
    bobPhase:Math.random()*Math.PI*2,wPhaseX:Math.random()*Math.PI*2,wPhaseY:Math.random()*Math.PI*2,wSpeed:1.4+Math.random()*1.2,
    runT:0,runTx:0,runTy:0,runCool:Math.random()*2,dribCurve:0,tackleCool:0}));
}

let leagueState=null,leagueAIData=[],leagueSetupMode=false;
function ensureAIData(){
  if(!leagueAIData.length)
    leagueAIData=AI_TEAM_DEFS.map((def,i)=>({
      ...def,img:'',strat:'321',
      players:mkAIPlayers(i),bench:mkAIBench(i),reserves:mkAIReserves(i)
    }));
}
function saveLeague(){_safeLSSet('footsim7v7_league',leagueState);}
function loadLeague(){try{const d=localStorage.getItem('footsim7v7_league');if(d)leagueState=JSON.parse(d);}catch(e){}}
function clearLeague(){leagueState=null;leagueSetupMode=false;localStorage.removeItem('footsim7v7_league');renderLeague();}
function openLeagueSetup(){leagueSetupMode=true;renderLeague();}

function getLeagueTeamData(lid){
  const lt=leagueState?.teams.find(t=>t.id===lid);if(!lt)return null;
  if(lt.isUser){
    return _leagueUserTeamBackup?_leagueUserTeamBackup[lt.uIdx]:teams[lt.uIdx];
  }
  if(lt.isSaved){
    const st=savedTeams[lt.savedIdx];if(!st)return null;
    return{...st,name:lt.name||st.name,color:lt.color||st.color};
  }
  ensureAIData();return leagueAIData[lt.aIdx]||null;
}

// Returns true if a league fixture involves any human-controlled team
function isLeagueHumanFix(fix){
  if(!fix||!leagueState)return false;
  const ht=leagueState.teams.find(t=>t.id===fix.home);
  const at=leagueState.teams.find(t=>t.id===fix.away);
  const isHuman=t=>t?.isUser||(t?.isSaved&&savedTeams[t.savedIdx]?.isHuman);
  return !!(isHuman(ht)||isHuman(at));
}

function genFixtures(teams){
  const ids=teams.map(t=>t.id);
  return mkFix(ids,1); // Berger: balanced schedule, no team plays consecutive matches
}

function createLeague(teamCount,savedIdxs){
  ensureAIData();
  const allT=[
    {id:0,name:teams[0].name,color:teams[0].color,isUser:true,uIdx:0},
    {id:1,name:teams[1].name,color:teams[1].color,isUser:true,uIdx:1},
  ];
  (savedIdxs||[]).forEach(si=>{
    if(allT.length>=teamCount)return;
    const st=savedTeams[si];if(!st)return;
    allT.push({id:allT.length,name:st.name,color:st.color,img:st.img||'',isSaved:true,savedIdx:si,isHuman:!!st.isHuman});
  });
  let ai=0;
  while(allT.length<teamCount&&ai<AI_TEAM_DEFS.length){
    allT.push({id:allT.length,name:AI_TEAM_DEFS[ai].name,color:AI_TEAM_DEFS[ai].color,isUser:false,aIdx:ai});ai++;
  }
  leagueState={teams:allT,playerStats:{},standings:allT.map(t=>({id:t.id,P:0,W:0,D:0,L:0,GF:0,GA:0,Pts:0})),
    fixtures:genFixtures(allT),currentFix:null};
  leagueSetupMode=false;saveLeague();renderLeague();
}

let _leagueUserTeamBackup=null;

function playLeagueMatch(){
  if(!leagueState)return;
  // Find the next HUMAN fixture (skip NPC matches)
  const fix=leagueState.fixtures.find(f=>!f.played&&isLeagueHumanFix(f));
  if(!fix){renderLeague();return;}
  leagueState.currentFix=leagueState.fixtures.indexOf(fix);
  ensureAIData();
  if(_leagueUserTeamBackup){
    teams[0]=_leagueUserTeamBackup[0];teams[1]=_leagueUserTeamBackup[1];
    _leagueUserTeamBackup=null;
  }
  const hD=getLeagueTeamData(fix.home),aD=getLeagueTeamData(fix.away);
  if(!hD||!aD){logEvent('Données équipe manquantes !','#e02030');return;}
  _leagueUserTeamBackup=[teams[0],teams[1]];
  teams[0]=deepCloneTeam(hD);
  teams[1]=deepCloneTeam(aD);
  _lastNav='league';resetMatch();G.leagueMode=true;
  nav('match');syncHUD();renderTB(0);renderTB(1);
  const hN=leagueState.teams.find(t=>t.id===fix.home)?.name||hD.name;
  const aN=leagueState.teams.find(t=>t.id===fix.away)?.name||aD.name;
  logEvent('🏆 Ligue : '+hN+' ⬡ '+aN,'#f0c028');
  showPreMatch();
}

function recordLeagueResult(s0,s1){
  if(!leagueState||leagueState.currentFix===null)return;
  const fix=leagueState.fixtures[leagueState.currentFix];
  fix.played=true;fix.sh=s0;fix.sa=s1;
  const hS=leagueState.standings.find(s=>s.id===fix.home),aS=leagueState.standings.find(s=>s.id===fix.away);
  if(!hS||!aS){leagueState.currentFix=null;saveLeague();return;}
  hS.P++;hS.GF+=s0;hS.GA+=s1;aS.P++;aS.GF+=s1;aS.GA+=s0;
  if(s0>s1){hS.W++;hS.Pts+=3;aS.L++;}else if(s1>s0){aS.W++;aS.Pts+=3;hS.L++;}
  else{hS.D++;hS.Pts++;aS.D++;aS.Pts++;}
  leagueState.currentFix=null;saveLeague();renderLeague();
}

// ── Simulation engine ──────────────────────────────────────────────
// teamStrength: inclut sht, spd, tec, def, stam + bonus sorts + bonus tactique + bonus infra career
function teamStrength(T, infraBonus){
  if(!T?.players?.length) return 50;
  const ps = T.players.slice(0,7);
  const raw = ps.reduce((s,p)=>{
    const st = p.s||{};
    // Pondération par poste
    const pos = p.pos||'';
    const isAtk = ['ATT','MO','AG','AD'].includes(pos);
    const isDef = ['GB','DC','DD','DG'].includes(pos);
    const shtW  = isAtk?0.50:isDef?0.15:0.30;
    const defW  = isDef?0.50:isAtk?0.10:0.30;
    const spdW  = 0.20; const tecW=0.15; const stamW=0.15;
    const hm    = p._hm||0;
    const fm    = Math.max(0,p._fm||0); // forme: bonus pur (0 à 10)
    // Normaliser les poids pour que leur somme fasse EXACTEMENT 1 : sinon un
    // joueur à 99 était compté ~110 (poids totaux >1), ce qui sur-évaluait les
    // stars et faisait qu'une équipe avec quelques joueurs à 99 atteignait 99
    // malgré des coéquipiers faibles.
    const wSum  = shtW+defW+spdW+tecW+stamW;
    const nSht=shtW/wSum, nDef=defW/wSum, nSpd=spdW/wSum, nTec=tecW/wSum, nStam=stamW/wSum;
    const base  = ((st.sht||50)+hm*nSht*10)*nSht+((st.def||50)+hm*nDef*10)*nDef+(st.spd||50)*nSpd+(st.tec||50)*nTec+(st.stam||50)*nStam + fm*0.4;
    // Bonus sorts équipés (chaque sort donne +1 à +4 selon puissance)
    // Sorts : bonus plafonné à 8 points par joueur max (évite inflation sur équipes générateur)
    const spellBonus = Math.min(8, (p.spells||[]).reduce((sb,sid)=>{
      const sp=SPELLS.find(x=>x.id===sid); return sb+(sp?Math.min(2.5,sp.pow/15):0.5);
    },0));
    return s + base + spellBonus;
  },0);
  const avg = raw / ps.length;
  // Bonus tactique
  const stratId = T.strat||'321';
  const stratObj = STRATS.find(s=>s.id===stratId)||STRATS[0];
  const tactBonus = ((stratObj.atk+stratObj.def)/2 - 1) * 8;
  // Bonus infra (uniquement pour les équipes carrière)
  const infraB = infraBonus||0;
  return Math.min(99, Math.max(20, avg + tactBonus + infraB));
}

// OVR "effectif" d'un joueur = exactement la contribution individuelle utilisée
// par teamStrength() (pondération par poste + bonus moral/forme + bonus sorts),
// AVANT le bonus tactique global de l'équipe (qui n'est pas propre à un joueur).
// Sert à afficher, à côté de l'OVR "de base" (moyenne brute des stats), la
// valeur qui explique pourquoi l'OVR d'équipe diffère de la simple moyenne.
function playerMatchOvr(p){
  const st=p.s||{};
  const pos=p.pos||'';
  const isAtk = ['ATT','MO','AG','AD'].includes(pos);
  const isDef = ['GB','DC','DD','DG'].includes(pos);
  const shtW  = isAtk?0.50:isDef?0.15:0.30;
  const defW  = isDef?0.50:isAtk?0.10:0.30;
  const spdW  = 0.20, tecW=0.15, stamW=0.15;
  const hm    = p._hm||0;
  const fm    = Math.max(0,p._fm||0);
  const wSum  = shtW+defW+spdW+tecW+stamW;
  const nSht=shtW/wSum, nDef=defW/wSum, nSpd=spdW/wSum, nTec=tecW/wSum, nStam=stamW/wSum;
  const base  = ((st.sht||50)+hm*nSht*10)*nSht+((st.def||50)+hm*nDef*10)*nDef+(st.spd||50)*nSpd+(st.tec||50)*nTec+(st.stam||50)*nStam;
  const spellBonus = Math.min(8, (p.spells||[]).reduce((sb,sid)=>{
    const sp=SPELLS.find(x=>x.id===sid); return sb+(sp?Math.min(2.5,sp.pow/15):0.5);
  },0));
  return Math.round(base + fm*0.4 + spellBonus);
}

// rGoals: distribution réaliste basée sur la force relative (0..1)
function rGoals(strength){
  // Plus forte l'équipe, plus elle marque en moyenne
  const mu = 0.35 + (strength||0.5)*1.8; // entre 0.7 et ~2.2 buts en moyenne
  // Distribution de Poisson approximée
  const L = Math.exp(-mu);
  let k=0, p=1;
  do { k++; p *= Math.random(); } while(p>L);
  return Math.max(0, k-1);
}

// Applique l'effet des sorts en simulation (bonus buts probabiliste)
function simSpellBonus(T){
  if(!T?.players?.length) return 0;
  let bonus = 0;
  T.players.slice(0,7).forEach(p=>{
    const fmMult = 4 + Math.max(0,p._fm||0)*0.15; // forme boost prob en sim aussi
    (p.spells||[]).forEach(sid=>{
      const sp = SPELLS.find(x=>x.id===sid); if(!sp) return;
      if(Math.random() < sp.prob*fmMult){
        if(ATTACK_SPELLS.has(sid))  bonus += (sp.pow/99)*1.5;
        if(SUPPORT_SPELLS.has(sid)) bonus += 0.3;
      }
    });
  });
  return bonus;
}

function simulateMatch(homeId,awayId){
  const hD=getLeagueTeamData(homeId), aD=getLeagueTeamData(awayId);
  const hs = teamStrength(hD)/99 + 0.08; // +8% avantage domicile
  const as_ = teamStrength(aD)/99;
  const hp = hs/(hs+as_);
  // Générer les buts basés sur la force relative
  const hGoals = rGoals(hp)   + (Math.random()<hp*0.35?1:0);
  const aGoals = rGoals(1-hp) + (Math.random()<(1-hp)*0.35?1:0);
  // Bonus sorts
  const hSpell = simSpellBonus(hD), aSpell = simSpellBonus(aD);
  let sh = Math.max(0, Math.round(hGoals + hSpell));
  let sa = Math.max(0, Math.round(aGoals + aSpell));
  // Cohérence: le favori (hp>.62) gagne plus souvent qu'il ne perd
  if(hp > 0.62 && sa > sh && Math.random() < 0.45){ const t=sh; sh=sa; sa=t; }
  if(hp < 0.38 && sh > sa && Math.random() < 0.45){ const t=sh; sh=sa; sa=t; }
  return{_hm:(()=>{const r=(Math.random()+Math.random()-1)*10;return Math.round(Math.max(-10,Math.min(10,r)));})(),_fm:(()=>{const r=(Math.random()+Math.random()-1)*10;return Math.round(Math.max(-10,Math.min(10,r)));})(),sh, sa};
}

function getCupTeamData(id){
  const lt=cupState?.teams.find(t=>t.id===id);if(!lt)return null;
  if(lt.isUser)return teams[lt.uIdx];
  if(lt.isSaved){
    const idx=_resolveSavedIdx(lt);if(idx<0)return null;
    if(lt.savedIdx!==idx)lt.savedIdx=idx; // auto-réparation de l'index mis en cache
    if(lt.savedUid==null)lt.savedUid=_ensureSavedUid(idx); // migration douce des anciennes coupes
    return savedTeams[idx]||null;
  }
  if(lt.cupNPCIdx!==undefined){
    const npc=_npcById(lt.cupNPCIdx);if(!npc)return null;
    // Generate players on-demand if they haven't been edited yet
    if(!npc.players?.length){const t=mkCupNPCTeamData(npc,lt.cupNPCIdx);npc.players=t.players;npc.bench=t.bench;npc.reserves=t.reserves;saveCupNPCPool();}
    return{...npc,name:lt.name||npc.name,color:lt.color||npc.color};
  }
  ensureAIData();return leagueAIData[lt.aIdx]||null;
}

function simulateCupMatch(homeId,awayId){
  const hD=getCupTeamData(homeId), aD=getCupTeamData(awayId);
  if(!hD&&!aD) return{sh:Math.floor(Math.random()*4),sa:Math.floor(Math.random()*4)};
  const hs = (hD?teamStrength(hD):50)/99 + 0.08;
  const as_ = (aD?teamStrength(aD):50)/99;
  const hp = hs/(hs+as_);
  const hGoals = rGoals(hp)   + (Math.random()<hp*0.30?1:0);
  const aGoals = rGoals(1-hp) + (Math.random()<(1-hp)*0.30?1:0);
  const hSpell = simSpellBonus(hD), aSpell = simSpellBonus(aD);
  let sh = Math.max(0, Math.round(hGoals + hSpell));
  let sa = Math.max(0, Math.round(aGoals + aSpell));
  if(hp > 0.62 && sa > sh && Math.random() < 0.45){ const t=sh; sh=sa; sa=t; }
  if(hp < 0.38 && sh > sa && Math.random() < 0.45){ const t=sh; sh=sa; sa=t; }
  return{sh, sa};
}
function skipLeagueFixture(idx){
  if(!leagueState)return;
  const fix=leagueState.fixtures[idx];if(!fix||fix.played)return;
  if(isLeagueHumanFix(fix)){
    // Match joueur: demander confirmation via modal
    showLeagueSimConfirm(idx);return;
  }
  leagueState.currentFix=idx;const{sh,sa}=simulateMatch(fix.home,fix.away);recordLeagueResult(sh,sa);
}
function showLeagueSimConfirm(idx){
  const fix=leagueState.fixtures[idx];
  const hT=leagueState.teams.find(t=>t.id===fix.home);
  const aT=leagueState.teams.find(t=>t.id===fix.away);
  const msg='Simuler '+( hT?.name||'?')+' vs '+(aT?.name||'?')+' ? (résultat aléatoire)';
  // Créer modal rapide
  let modal=document.getElementById('league-sim-modal');
  if(!modal){modal=document.createElement('div');modal.id='league-sim-modal';modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';document.body.appendChild(modal);}
  modal.innerHTML='';
  const box=document.createElement('div');box.style.cssText='background:var(--dark,#050e1a);border:1px solid var(--b1,#1a2a3a);border-radius:12px;padding:20px;max-width:300px;width:100%;text-align:center';
  const txt=document.createElement('div');txt.style.cssText='font-size:12px;margin-bottom:16px;color:var(--fg,#e0e8f0)';txt.textContent=msg;
  const row=document.createElement('div');row.style.display='flex';row.style.gap='8px';
  const btnY=document.createElement('button');btnY.className='btn';btnY.style.cssText='flex:1;justify-content:center;color:#8840e0;border-color:#8840e066';btnY.textContent='⚡ Simuler';
  btnY.onclick=()=>{modal.style.display='none';leagueState.currentFix=idx;const{sh,sa}=simulateMatch(fix.home,fix.away);recordLeagueResult(sh,sa);};
  const btnN=document.createElement('button');btnN.className='btn btng';btnN.style.cssText='flex:1;justify-content:center';btnN.textContent='Annuler';
  btnN.onclick=()=>{modal.style.display='none';};
  row.appendChild(btnY);row.appendChild(btnN);box.appendChild(txt);box.appendChild(row);modal.appendChild(box);
  modal.style.display='flex';
}
function skipAllLeagueForce(){
  // Simule TOUS les matchs y compris joueur (sans confirmation)
  if(!leagueState)return;
  leagueState.fixtures.forEach((fix,i)=>{
    if(!fix.played){
      leagueState.currentFix=i;
      const{sh,sa}=simulateMatch(fix.home,fix.away);
      recordLeagueResult(sh,sa);
    }
  });
  leagueState.currentFix=null; saveLeague(); renderLeague();
}

function skipAllNPCFixtures(){
  if(!leagueState)return;
  leagueState.fixtures.forEach((fix,i)=>{
    if(!fix.played&&!isLeagueHumanFix(fix)){
      leagueState.currentFix=i;const{sh,sa}=simulateMatch(fix.home,fix.away);recordLeagueResult(sh,sa);
    }
  });
  leagueState.currentFix=null;saveLeague();renderLeague();
}

function renderLeague(){
  const el=document.getElementById('league-out');if(!el)return;
  // ── SETUP WIZARD ─────────────────────────────────────────
  if(leagueSetupMode||!leagueState){
    let roHTML='';
    if(savedTeams.length){
      roHTML='<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:9px;font-weight:700;letter-spacing:1.2px;color:var(--muted);text-transform:uppercase;margin:8px 0 4px">📋 Registre</div>';
      roHTML+=savedTeams.map((t,i)=>'<label style="display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:5px;cursor:pointer;background:var(--panel);border:1px solid var(--b1);margin-bottom:3px">'+
        '<input type="checkbox" id="lsc'+i+'" style="accent-color:'+t.color+'"'+'>'+
        '<span style="width:8px;height:8px;border-radius:50%;background:'+t.color+';flex-shrink:0"></span>'+
        '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;font-weight:700;flex:1">'+t.name+'</span>'+
        '<button class="btn" style="padding:1px 5px;font-size:9px;color:'+(t.isHuman?'var(--gold)':'var(--muted)')+';border-color:'+(t.isHuman?'var(--gold)44':'var(--b1)')+'" onclick="event.preventDefault();toggleHumanFlag('+i+');renderLeague()" title="'+(t.isHuman?'Équipe joueur (cliquer pour passer en PNJ)':'Équipe PNJ (cliquer pour passer en joueur)')+'">'+( t.isHuman?'👤':'🤖')+'</button>'+
        '<button class="btn" style="padding:1px 5px;font-size:8px;color:var(--muted)" onclick="event.preventDefault();deleteFromRoster('+i+')">✕</button>'+
        '</label>').join('');
    }
    el.innerHTML='<div style="padding:2px">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'+
      '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:15px;font-weight:900;letter-spacing:2px;color:var(--gold)">🏆 NOUVELLE SAISON</div>'+
      '<div style="display:flex;gap:3px">'+
      '<button class="btn" style="padding:2px 7px;font-size:9px" onclick="exportData()" title="Exporter JSON">⬇ JSON</button>'+
      '<label class="btn" style="padding:2px 7px;font-size:9px;cursor:pointer" title="Importer JSON">⬆ Import<input type="file" accept=".json" style="display:none" onchange="importData(this)"></label>'+
      '</div></div>'+
      '<div style="font-size:10px;color:var(--muted);line-height:1.6;margin-bottom:10px">Championnat aller-simple · max 12 équipes.<br>Sauvegarde tes équipes (onglet Équipes) pour les ajouter.</div>'+
      '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:9px;font-weight:700;letter-spacing:1.2px;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Nombre d\'équipes</div>'+
      '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px" id="tc-btns">'+
      [4,6,8,10,12].map(n=>'<button class="btn'+(n===6?' btng':'')+'" id="tc'+n+'" style="flex:1;justify-content:center;min-width:32px;padding:5px 0;font-size:11px" onclick="selectTC('+n+')">'+n+'</button>').join('')+
      '</div>'+
      '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:9px;font-weight:700;letter-spacing:1.2px;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Équipes joueur</div>'+
      [0,1].map(i=>'<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:5px;background:rgba(255,255,255,.04);border:1px solid var(--b2);margin-bottom:3px">'+
        '<span style="width:8px;height:8px;border-radius:50%;background:'+teams[i].color+'"></span>'+
        '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;font-weight:700;color:'+teams[i].color+'">'+teams[i].name+'</span>'+
        '<span style="font-size:9px;color:var(--gold);margin-left:auto">⭐ Toi</span></div>').join('')+
      roHTML+
      '<button class="btn btng" style="width:100%;justify-content:center;margin-top:10px" onclick="confirmCreateLeague()">▶ Créer la ligue</button>'+
      (leagueState?'<button class="btn" style="width:100%;justify-content:center;margin-top:4px;color:var(--muted);font-size:10px" onclick="leagueSetupMode=false;renderLeague()">← Retour</button>':'')+
      '</div>';
    window._selectedTC=window._selectedTC||6;return;
  }
  // ── ACTIVE LEAGUE ────────────────────────────────────────
  const sorted=[...leagueState.standings].sort((a,b)=>b.Pts-a.Pts||(b.GF-b.GA)-(a.GF-a.GA)||b.GF-a.GF);
  const pending=leagueState.fixtures.filter(f=>!f.played);
  const played=leagueState.fixtures.filter(f=>f.played);
  const hasNPC=pending.some(f=>!isLeagueHumanFix(f));
  let h='<div>';
  if(!pending.length){
    const champ=leagueState.teams.find(t=>t.id===sorted[0].id);
    h+='<div style="background:rgba(240,192,40,.1);border:1px solid rgba(240,192,40,.28);border-radius:8px;padding:10px;text-align:center;margin-bottom:8px">'+
      '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:10px;letter-spacing:2px;color:var(--gold)">🏆 CHAMPION</div>'+
      '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:900;color:'+champ.color+'">'+champ.name+'</div></div>';
  }
  h+='<div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap">'+
    '<button class="btn btng" style="flex:2;justify-content:center;font-size:10px" onclick="openLeagueSetup()">⚙ Nouvelle saison</button>'+
    (hasNPC?'<button class="btn" style="flex:1;justify-content:center;font-size:10px;color:#8840e0;border-color:#8840e055" onclick="skipAllNPCFixtures()" title="Simuler tous les matchs PNJ">⚡ PNJ</button>':'')+
    '<button class="btn" style="flex:1;justify-content:center;font-size:10px;color:#e04040;border-color:#e0404055" onclick="skipAllLeagueForce()" title="Simuler TOUS les matchs (y compris joueur)">⚡⚡</button>'+
    '<button class="btn" style="flex:1;justify-content:center;font-size:10px" onclick="exportData()" title="Exporter">⬇</button>'+
    '<label class="btn" style="flex:1;justify-content:center;font-size:10px;cursor:pointer" title="Importer">⬆<input type="file" accept=".json" style="display:none" onchange="importData(this)"></label>'+
    '</div>';
  // Standings
  h+='<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:9px;font-weight:700;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;margin-bottom:3px">Classement</div>'+
    '<div style="background:var(--card);border:1px solid var(--b1);border-radius:8px;overflow:hidden;margin-bottom:8px">'+
    '<div style="display:grid;grid-template-columns:14px 1fr 18px 18px 18px 18px 22px 24px 22px;gap:0 2px;padding:3px 6px;border-bottom:1px solid var(--b1)">'+
    ['#','Équipe','J','V','N','D','Dif','Pts',''].map((l,i)=>'<span style="font-size:8px;color:var(--muted);text-align:'+(i>1?'center':'left')+'">'+(i===7?'<b style="color:var(--gold)">'+l+'</b>':l)+'</span>').join('')+
    '</div>'+
    sorted.map((s,rank)=>{
      const t=leagueState.teams.find(x=>x.id===s.id),gd=s.GF-s.GA,isTop=rank===0&&s.P>0;
      return '<div style="display:grid;grid-template-columns:14px 1fr 18px 18px 18px 18px 22px 24px 22px;gap:0 2px;padding:3px 6px;border-bottom:1px solid var(--b1);align-items:center;cursor:pointer;background:'+(isTop?'rgba(240,192,40,.04)':'transparent')+'" onclick="showStandingDetail(\'league\','+s.id+')" title="Voir les détails">'+
        '<span style="font-size:9px;color:var(--muted);font-family:\'Barlow Condensed\',sans-serif;font-weight:700">'+(rank+1)+'</span>'+
        '<span style="display:flex;align-items:center;gap:3px;min-width:0"><span style="width:5px;height:5px;border-radius:50%;background:'+t.color+';flex-shrink:0"></span>'+
        '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:10px;font-weight:700;color:'+(isTop?'var(--gold)':'var(--text)')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+t.name+'</span></span>'+
        [s.P,s.W,s.D,s.L].map(v=>'<span style="font-size:9px;text-align:center">'+v+'</span>').join('')+
        '<span style="font-size:9px;text-align:center;color:'+(gd>0?'var(--green)':gd<0?'var(--red)':'var(--muted)')+'">'+( gd>0?'+':'')+gd+'</span>'+
        '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:12px;font-weight:900;text-align:center;color:'+(isTop?'var(--gold)':'var(--text)')+'">'+s.Pts+'</span>'+
        '<span style="text-align:center"><button onclick="event.stopPropagation();openLeagueTeamEdit('+s.id+')" style="background:transparent;border:1px solid var(--b1);border-radius:3px;padding:1px 3px;cursor:pointer;font-size:9px;color:var(--muted)" title="Modifier l\'équipe">✏️</button></span>'+
        '</div>';
    }).join('')+'</div>';
  // Top Scorers / Assists / Cards
  const ps=leagueState.playerStats||{};
  const allPS=Object.values(ps);
  if(allPS.some(p=>p.G>0||p.A>0||p.YC>0)){
    const topG=[...allPS].filter(p=>p.G>0).sort((a,b)=>b.G-a.G).slice(0,5);
    const topA=[...allPS].filter(p=>p.A>0).sort((a,b)=>b.A-a.A).slice(0,5);
    const topC=[...allPS].filter(p=>p.YC>0||p.RC>0).sort((a,b)=>(b.RC*2+b.YC)-(a.RC*2+a.YC)).slice(0,5);
    const statCol=(items,icon,valFn)=>items.length?items.map((p,i)=>
      `<div style="display:flex;align-items:center;gap:5px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.04)">
        <span style="font-size:9px;color:var(--muted);min-width:12px;font-weight:700">${i+1}</span>
        <span style="width:5px;height:5px;border-radius:50%;background:${p.col||'#888'};flex-shrink:0"></span>
        <span style="font-size:10px;font-weight:700;flex:1;color:var(--text)">${p.name}</span>
        <span style="font-size:11px;font-weight:900;color:${p.col||'#888'}">${icon} ${valFn(p)}</span>
      </div>`).join(''):'<div style="font-size:9px;color:var(--muted);padding:4px 0">—</div>';
    h+=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px">
      <div style="background:var(--card);border:1px solid var(--b1);border-radius:8px;padding:7px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:9px;font-weight:700;letter-spacing:1px;color:var(--muted);text-transform:uppercase;margin-bottom:5px">⚽ Buteurs</div>
        ${statCol(topG,'',p=>p.G)}
      </div>
      <div style="background:var(--card);border:1px solid var(--b1);border-radius:8px;padding:7px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:9px;font-weight:700;letter-spacing:1px;color:var(--muted);text-transform:uppercase;margin-bottom:5px">🎯 Passes</div>
        ${statCol(topA,'',p=>p.A)}
      </div>
      <div style="background:var(--card);border:1px solid var(--b1);border-radius:8px;padding:7px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:9px;font-weight:700;letter-spacing:1px;color:var(--muted);text-transform:uppercase;margin-bottom:5px">🟨 Cartons</div>
        ${statCol(topC,'',p=>(p.RC?'🟥':'')+(p.YC?p.YC+'🟨':''))}
      </div>
    </div>`;
  }
  // Pending fixtures
  if(pending.length){
    h+='<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:9px;font-weight:700;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;margin-bottom:3px">Matchs à jouer ('+pending.length+')</div>'+
      '<div style="background:var(--card);border:1px solid var(--b1);border-radius:8px;overflow:hidden;margin-bottom:8px">';
    // Find index of next human match in pending list
    const nextHumanIdx=pending.findIndex(f=>isLeagueHumanFix(f));
    pending.slice(0,18).forEach((fix,i)=>{
      const hT=leagueState.teams.find(t=>t.id===fix.home),aT=leagueState.teams.find(t=>t.id===fix.away);
      if(!hT||!aT)return;
      const fi=leagueState.fixtures.indexOf(fix);
      const isHuman=isLeagueHumanFix(fix),isNPC=!isHuman;
      const isNextHuman=i===nextHumanIdx;// highlight the upcoming human match
      h+='<div style="display:grid;grid-template-columns:1fr auto 1fr auto;gap:2px;padding:4px 6px;border-bottom:1px solid var(--b1);align-items:center;background:'+(isNextHuman?'rgba(255,255,255,.03)':'transparent')+'">'+
        '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:10px;font-weight:700;color:'+hT.color+';text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+hT.name+'</span>'+
        '<span style="font-size:9px;color:var(--muted);padding:0 3px">vs</span>'+
        '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:10px;font-weight:700;color:'+aT.color+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+aT.name+'</span>'+
        '<span style="display:flex;gap:2px">'+
        (isNextHuman&&isHuman?'<button class="btn btng" style="padding:2px 6px;font-size:9px" onclick="playLeagueMatch()">▶</button>':'')+
        (isNPC?'<button class="btn" style="padding:2px 5px;font-size:9px;color:#8840e0;border-color:#8840e044" onclick="skipLeagueFixture('+fi+')" title="Simuler PNJ">⚡</button>':
               '<button class="btn" style="padding:2px 5px;font-size:9px;color:#e04040;border-color:#e0404044" onclick="skipLeagueFixture('+fi+')" title="Simuler (match joueur)">⚡</button>')+
        '</span></div>';
    });
    if(pending.length>18)h+='<div style="padding:4px 6px;font-size:9px;color:var(--muted);text-align:center">… et '+(pending.length-18)+' autres</div>';
    h+='</div>';
  }
  // Recent results
  const rec=played.slice(-6).reverse();
  if(rec.length){
    h+='<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:9px;font-weight:700;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;margin-bottom:3px">Derniers résultats</div>'+
      '<div style="background:var(--card);border:1px solid var(--b1);border-radius:8px;overflow:hidden;margin-bottom:8px">'+
      rec.map(f=>{const hT=leagueState.teams.find(t=>t.id===f.home),aT=leagueState.teams.find(t=>t.id===f.away);
        if(!hT||!aT)return '';
        return '<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:3px;padding:3px 7px;border-bottom:1px solid var(--b1);align-items:center">'+
          '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:10px;font-weight:700;color:'+(f.sh>f.sa?hT.color:'var(--muted)')+';text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+hT.name+'</span>'+
          '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;font-weight:900;padding:0 6px">'+f.sh+'–'+f.sa+'</span>'+
          '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:10px;font-weight:700;color:'+(f.sa>f.sh?aT.color:'var(--muted)')+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+aT.name+'</span></div>';
      }).join('')+'</div>';
  }
  h+='</div>';el.innerHTML=h;
}
function selectTC(n){
  window._selectedTC=n;
  document.querySelectorAll('#tc-btns .btn').forEach(b=>b.classList.remove('btng'));
  const btn=document.getElementById('tc'+n);if(btn)btn.classList.add('btng');
}
function confirmCreateLeague(){
  const tc=window._selectedTC||6;
  const sel=savedTeams.map((_,i)=>i).filter(i=>{const cb=document.getElementById('lsc'+i);return cb?.checked;});
  createLeague(tc,sel);
}

// ═══════════════════════════════════════════════════════════
// LEAGUE TEAM EDITOR
// ═══════════════════════════════════════════════════════════
let leagueEditId=null,leagueEditTeam=null;

function openLeagueTeamEdit(lid){
  leagueEditId=lid;
  const T=getLeagueTeamData(lid);
  if(!T){logEvent('Équipe introuvable','#e02030');return;}
  leagueEditTeam=deepCloneTeam(T);
  const lt=leagueState?.teams.find(t=>t.id===lid);
  document.getElementById('mttl').textContent='✏️ '+(lt?.name||leagueEditTeam.name);
  renderLeagueTmContent();
  document.getElementById('pmodal').classList.add('on');
}

function renderLeagueTmContent(){
  const T=leagueEditTeam;
  const spellCls={
    fire:'cf',fireball:'cf',eldritch:'cf',illusion:'ct',thunder:'ct',
    ice:'ci',ice2:'ci',pass:'ci',tornado:'ci',
    tech:'cte',suggest:'cte',pacif:'cte',
    heal:'ch',soin:'ch',amitie:'ch',
    shield:'cs',mouton:'cs',charm:'cf',
    cyclon:'ci',telekib:'cte',deluge:'ci',terreur:'cf',folie:'cte',
    divine:'ch',plaisir:'ch',sylvestre:'ch',fleurs:'ci',sixsens:'cte',
    aile:'ci',esprit:'ci',epuise:'cf',maledic:'cf',chance:'cte',
    hoquet:'cs',invis:'cs',peaupierre:'cs',transe:'ch',
    // Nouveaux
    spindash:'ci',dragon:'cf',aura_divine:'ch',aide_divine:'ch',cailloux:'cs',simulation:'cf',tacle_mauvais:'ce',tacle_malefique:'ce',atk_demo:'cf',subtilisation:'ci',vol:'ci',main:'cs',main_discrete:'cs',comedia:'cf',blizzard:'ci',seisme:'cf',domination:'cs',stase:'cs',maledic2:'cs',epuise2:'cs',laser_oculaire:'cf',
  };
  const mkRow=(p,pi,src)=>`
    <div class="prow" onclick="leagueEditPlayer(${pi},'${src}')" style="cursor:pointer">
      <div class="av" style="width:24px;height:24px;border-color:${T.color}50;background:${T.color}22;flex-shrink:0">
        ${p.img?`<img src="${p.img}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`:`<span style="font-size:8px;font-weight:700;color:${T.color}">${p.ini}</span>`}
      </div>
      <div class="pi"><div class="pn">${p.name}</div>
        <div class="pp">${p.pos} · ${p.s.spd}v ${p.s.sht}t ${p.s.def}d ${p.s.stam}e</div>
      </div>
      <span style="font-size:9px;color:var(--muted)">✏️</span>
    </div>`;
  document.getElementById('mcnt').innerHTML=`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <div>
        <div id="ledit-badge" onclick="document.getElementById('ledit-img-up').click()" style="width:42px;height:42px;border-radius:50%;border:2px solid ${T.color}66;background:${T.color}22;cursor:pointer;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:${T.color}" title="Logo équipe">
          ${T.img?`<img src="${T.img}" style="width:100%;height:100%;object-fit:cover">`:`${teamIni(T.name)}`}
        </div>
        <input type="file" id="ledit-img-up" accept="image/*" style="display:none" onchange="handleLeagueTeamImg(event)">
        <div style="font-size:7px;color:var(--muted);text-align:center;margin-top:2px;cursor:pointer" onclick="document.getElementById('ledit-img-up').click()">LOGO</div>
      </div>
      <div style="flex:1">
        <div class="frow"><span class="lbl">Nom</span><input class="inp" id="ledit-name" value="${T.name}"></div>
        <div class="frow"><span class="lbl">Couleur</span><input type="color" class="inp" value="${T.color}" id="ledit-color"></div>
        <div class="frow"><span class="lbl">Formation</span>
          <select class="inp" id="ledit-strat">
            ${STRATS.map(s=>`<option value="${s.id}"${(T.strat||'321')===s.id?' selected':''}>${s.n}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
    <div class="slbl">Titulaires</div>
    ${T.players.map((p,pi)=>mkRow(p,pi,'player')).join('')}
    <div class="slbl">Banc</div>
    ${T.bench.map((p,bi)=>mkRow(p,bi,'bench')).join('')}
    ${T.reserves&&T.reserves.length?`<div class="slbl">Réservistes</div>${T.reserves.map((p,ri)=>mkRow(p,ri,'reserve')).join('')}`:''}
    <div style="display:flex;justify-content:space-between;gap:7px;margin-top:14px">
      <button class="btn" style="color:#69f0ae;border-color:#69f0ae55" onclick="exportTeamData(leagueEditTeam, document.getElementById('ledit-name')?.value||leagueEditTeam.name)" title="Exporter cette équipe en fichier JSON">📤 Export JSON</button>
      <div style="display:flex;gap:7px">
        <button class="btn" onclick="closeLeagueEdit()">Annuler</button>
        <button class="btn btng" onclick="saveLeagueTeamEdit()">✓ Sauvegarder</button>
      </div>
    </div>`;
}

function handleLeagueTeamImg(e){
  const f=e.target.files[0];if(!f)return;
  _compressImage(f,160,0.72,dataUrl=>{
    leagueEditTeam.img=dataUrl;
    const b=document.getElementById('ledit-badge');
    if(b)b.innerHTML=`<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover">`;
  });
}

function leagueEditPlayer(pi,src){
  const T=leagueEditTeam;
  const p=src==='bench'?T.bench[pi]:src==='reserve'?T.reserves[pi]:T.players[pi];
  if(!p)return;
  document.getElementById('mttl').innerHTML=
    `<button class="btn" onclick="renderLeagueTmContent();document.getElementById('mttl').textContent='✏️ '+leagueEditTeam.name" style="padding:1px 6px;font-size:10px;margin-right:6px">← Retour</button>${p.name}`;
  document.getElementById('mcnt').innerHTML=`
    <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px">
      <div>
        <div id="ledit-pav" onclick="document.getElementById('ledit-pfup').click()" style="width:48px;height:48px;border-radius:50%;border:2px solid ${T.color}66;background:${T.color}22;cursor:pointer;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:${T.color}" title="Photo joueur">
          ${p.img?`<img src="${p.img}" style="width:100%;height:100%;object-fit:cover">`:`${p.ini}`}
        </div>
        <input type="file" id="ledit-pfup" accept="image/*" style="display:none" onchange="handleLeaguePlayerImg(event,${pi},'${src}')">
        <div style="font-size:7px;color:var(--muted);text-align:center;margin-top:2px;cursor:pointer" onclick="document.getElementById('ledit-pfup').click()">PHOTO</div>
      </div>
      <div style="flex:1">
        <div class="frow"><span class="lbl">Nom</span><input class="inp" id="pn" value="${p.name}"></div>
        <div class="frow"><span class="lbl">Poste</span>
          <select class="inp" id="ppos">
            ${['GB','DD','DC','DG','MDC','MC','MO','ATT','AG','AD'].map(po=>`<option${po===p.pos?' selected':''}>${po}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
    <div class="slbl" style="display:flex;align-items:center;justify-content:space-between;gap:6px">
      <span>Statistiques</span>
      <span style="display:flex;gap:4px">
        <button type="button" class="btn" style="padding:2px 8px;font-size:9px;text-transform:none;letter-spacing:0" onclick="copyLeaguePlayerStats()" title="Copier les statistiques de ce joueur">📋 Copier</button>
        <button type="button" class="btn" id="lpaste-stats-btn" style="padding:2px 8px;font-size:9px;text-transform:none;letter-spacing:0${_copiedStats?'':';opacity:.4;cursor:not-allowed'}" onclick="pasteLeaguePlayerStats()" title="Coller les statistiques copiées"${_copiedStats?'':' disabled'}>📥 Coller</button>
      </span>
    </div>
    <div id="lpaste-stats-hint" style="font-size:9px;color:var(--muted);margin:-3px 0 6px;display:${_copiedStats?'block':'none'}">Copié : ${_copiedStats?Object.entries(_copiedStats).map(([k,v])=>k.toUpperCase()+' '+v).join(' · '):''}</div>
    ${[['spd','Vitesse'],['sht','Tir'],['def','Défense'],['stam','Endurance'],['tec','Technique'],['res','Résistance']].map(([k,l])=>`
    <div class="frow"><span class="lbl">${l}</span>
      <div class="rrow">
        <input type="range" min="1" max="99" value="${p.s[k]||50}" id="ls_${k}" oninput="document.getElementById('lv_${k}').textContent=this.value">
        <span class="rv" id="lv_${k}">${p.s[k]||50}</span>
      </div>
    </div>`).join('')}
    <div style="display:flex;justify-content:flex-end;gap:7px;margin-top:14px">
      <button class="btn" onclick="renderLeagueTmContent();document.getElementById('mttl').textContent='✏️ '+leagueEditTeam.name">← Retour</button>
      <button class="btn btng" onclick="saveLeaguePlayerEdit(${pi},'${src}')">✓ Sauvegarder</button>
    </div>`;
}

function handleLeaguePlayerImg(e,pi,src){
  const f=e.target.files[0];if(!f)return;
  _compressImage(f,120,0.72,dataUrl=>{
    const T=leagueEditTeam;
    const p=src==='bench'?T.bench[pi]:src==='reserve'?T.reserves[pi]:T.players[pi];
    if(p)p.img=dataUrl;
    const av=document.getElementById('ledit-pav');
    if(av)av.innerHTML=`<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover">`;
  });
}

function saveLeaguePlayerEdit(pi,src){
  const T=leagueEditTeam;
  const p=src==='bench'?T.bench[pi]:src==='reserve'?T.reserves[pi]:T.players[pi];
  if(!p)return;
  p.name=document.getElementById('pn').value;
  p.pos=document.getElementById('ppos').value;
  p.ini=p.name.slice(0,2).toUpperCase();
  ['spd','sht','def','stam','tec','res'].forEach(k=>{
    const el=document.getElementById(`ls_${k}`);if(el)p.s[k]=parseInt(el.value);
  });
  document.getElementById('mttl').textContent='✏️ '+leagueEditTeam.name;
  renderLeagueTmContent();
}

function saveLeagueTeamEdit(){
  if(!leagueEditTeam||!leagueState)return;
  leagueEditTeam.name=document.getElementById('ledit-name')?.value||leagueEditTeam.name;
  leagueEditTeam.color=document.getElementById('ledit-color')?.value||leagueEditTeam.color;
  leagueEditTeam.strat=document.getElementById('ledit-strat')?.value||leagueEditTeam.strat||'321';
  const lt=leagueState.teams.find(t=>t.id===leagueEditId);
  if(lt){lt.name=leagueEditTeam.name;lt.color=leagueEditTeam.color;}
  if(lt?.isUser){
    const uTeam=teams[lt.uIdx];
    uTeam.name=leagueEditTeam.name;uTeam.color=leagueEditTeam.color;
    uTeam.strat=leagueEditTeam.strat;
    uTeam.players=leagueEditTeam.players;uTeam.bench=leagueEditTeam.bench;
    renderTB(lt.uIdx);syncHUD();
  } else if(lt?.isSaved&&savedTeams[lt.savedIdx]){
    savedTeams[lt.savedIdx]=serializeTeam(leagueEditTeam);persistSavedTeams();
  } else if(lt?.aIdx!==undefined){
    ensureAIData();leagueAIData[lt.aIdx]=leagueEditTeam;
  }
  leagueEditId=null;leagueEditTeam=null;
  closeM();saveLeague();renderLeague();
}

function closeLeagueEdit(){leagueEditId=null;leagueEditTeam=null;closeM();}

// ═══════════════════════════════════════════════════════════
// CUP MODE
// ═══════════════════════════════════════════════════════════
const CUP_FORMATS=[
  {id:'elim',    name:'Élimination directe',              desc:"Tu perds, tu rentres chez toi. Un seul match par tour, sans filet de sécurité. Le format le plus brutal qui soit.",                                               type:'knockout',    legs:1, thirdPlace:false},
  {id:'elim_3e', name:'Élim. directe + match de bronze',  desc:"Comme le format classique, mais les deux perdants des demies se retrouvent pour décider du troisième et quatrième place.",                                         type:'knockout',    legs:1, thirdPlace:true},
  {id:'ar',      name:'Aller-retour',                     desc:"Match aller, match retour. C'est le score cumulé sur les deux matchs qui compte. En cas d'égalité parfaite, tirs au but pour désigner le vainqueur.",              type:'knockout',    legs:2, thirdPlace:false},
  {id:'ar_fin',  name:'Aller-retour, finale sur un match',desc:"Aller-retour jusqu'en demi-finales, puis une grande finale disputée sur un seul match. Ce format a été longtemps utilisé en Copa Libertadores.",                  type:'knockout',    legs:2, singleFinal:true, thirdPlace:false},
  {id:'gr_elim', name:'Phase de groupes + K.O. direct',   desc:"D'abord tout le monde joue en poule pour se jauger, puis les meilleurs s'éliminent directement. C'est le format de la Coupe du Monde et de l'Euro.",             type:'groups_ko',   legs:1, thirdPlace:true},
  {id:'gr_ar',   name:'Phase de groupes + aller-retour',  desc:"Une poule pour commencer, puis chaque confrontation en phase éliminatoire se joue sur deux matchs. C'est le vrai format de la Ligue des Champions.",             type:'groups_ko',   legs:2, thirdPlace:false},
  {id:'double',  name:'Double élimination',               desc:"Une défaite ne t'élimine pas tout de suite — tu passes dans le tableau des perdants et tu peux encore remporter le titre. Deux défaites et c'est terminé.",       type:'double_elim', legs:1, thirdPlace:false},
];

let cupState=null,cupCurrentMatch=null;
let _cupFmt='elim',_cupCount=8;
// Group phase options (used for formats with groups)
let _cupGC=2,_cupPG=4,_cupGroupLegs=1,_cupAdvance=2; // nb poules, équipes/poule, matchs A/R en poule, qualifiés/poule

function saveCup(){_safeLSSet('footsim7v7_cup',cupState);}
function loadCup(){
  try{
    const d=localStorage.getItem('footsim7v7_cup');
    if(d){
      const p=JSON.parse(d);
      // Validate: must have new 'format' schema (not old 'template')
      if(p?.format?.type){cupState=p;}
      else{localStorage.removeItem('footsim7v7_cup');console.log('Cup: stale state cleared');}
    }
  }catch(e){cupState=null;}
}
function clearCup(){cupState=null;cupCurrentMatch=null;localStorage.removeItem('footsim7v7_cup');renderCup();}

/* getCupTeamData and buildCupTeams are defined later with NPC pool support */

// ── Fixture helpers ───────────────────────────────────────
// ── Berger round-robin scheduler ─────────────────────────
// Fix LAST element, rotate the others. Each team plays exactly
// once per round. No team ever plays two consecutive matches.
function mkFix(ids,legs){
  legs=legs||1;
  const n=ids.length;
  if(n<2)return[];

  // Odd teams: add null BYE so every round has n pairs (BYEs filtered out)
  const list=n%2===0?[...ids]:[...ids,null];
  const m=list.length;
  const fixed=list[m-1];        // last stays fixed
  let rotating=list.slice(0,m-1); // others rotate

  const rrRounds=[];
  for(let r=0;r<m-1;r++){
    const round=[];
    const full=[...rotating,fixed];
    for(let i=0;i<m/2;i++){
      const h=full[i],a=full[m-1-i];
      if(h!==null&&a!==null){
        if(r%2===0)round.push({home:h,away:a});
        else        round.push({home:a,away:h});
      }
    }
    rrRounds.push(round);
    // Rotate: last of rotating moves to front
    rotating=[rotating[rotating.length-1],...rotating.slice(0,-1)];
  }

  // legs=2: add return matches (home/away swapped) after all first-leg rounds
  const allRounds=legs===2
    ?[...rrRounds,...rrRounds.map(round=>round.map(m=>({home:m.away,away:m.home})))]
    :rrRounds;

  const f=[];
  allRounds.forEach(round=>round.forEach(({home,away})=>
    f.push({home,away,played:false,sh:null,sa:null})
  ));
  return f;
}
function mkStd(ids){return ids.map(id=>({id,P:0,W:0,D:0,L:0,GF:0,GA:0,Pts:0}));}
function sortStd(s){return[...s].sort((a,b)=>b.Pts-a.Pts||(b.GF-b.GA)-(a.GF-a.GA)||b.GF-a.GF);}
function updateStd(std,fix,s0,s1){
  const h=std.find(x=>x.id===fix.home),a=std.find(x=>x.id===fix.away);
  if(!h||!a)return;
  h.P++;h.GF+=s0;h.GA+=s1;a.P++;a.GF+=s1;a.GA+=s0;
  if(s0>s1){h.W++;h.Pts+=3;a.L++;}else if(s1>s0){a.W++;a.Pts+=3;h.L++;}else{h.D++;h.Pts++;a.D++;a.Pts++;}
}
function mkTie(home,away,legs){
  return{id:0,home,away,legs,
    leg1:{played:false,sh:null,sa:null},
    leg2:legs===2?{played:false,sh:null,sa:null}:null,
    played:false,sh:null,sa:null,winner:null,loser:null};
}
function mkBracketRound(id,label,n,legs){
  legs=legs||1;
  return{id,label,matches:Array.from({length:n},(_,i)=>mkTie(null,null,legs))};
}
function isUserFix(fix){
  if(!fix||fix.home===null||fix.away===null)return false;
  const h=cupState.teams.find(t=>t.id===fix.home),a=cupState.teams.find(t=>t.id===fix.away);
  const isHuman=t=>t?.isUser||(t?.isSaved&&savedTeams[t.savedIdx]?.isHuman);
  return !!(isHuman(h)||isHuman(a));
}

// ── Auto group config from team count ────────────────────
function autoGroupCfg(n){
  if(n<=4) return{gc:1,pg:n};
  if(n<=6) return{gc:2,pg:3};
  if(n<=8) return{gc:2,pg:4};
  if(n<=9) return{gc:3,pg:3};
  if(n<=12)return{gc:3,pg:4};
  if(n<=16)return{gc:4,pg:4};
  if(n<=18)return{gc:3,pg:6};
  if(n<=20)return{gc:4,pg:5};
  if(n<=24)return{gc:4,pg:6};
  return{gc:4,pg:Math.ceil(n/4)};
}

// ── KO bracket for any N (handles non-power-of-2 with byes) ──
function nextPow2(n){let p=1;while(p<n)p*=2;return p;}
const KO_ROUND_NAMES=['Trente-deuxièmes','Seizièmes','Huitièmes','Quarts','Demi-finales','Finale'];
function buildKOBracketForN(ids,legs,singleFinal){
  const n=ids.length;
  const p=nextPow2(n);
  const depth=Math.log2(p); // total rounds in a standard p-team bracket

  // Round labels (from deepest to shallowest)
  const labels=[];
  for(let d=0;d<depth;d++){
    labels.push(KO_ROUND_NAMES[Math.max(0,KO_ROUND_NAMES.length-1-d)]);
  }
  labels.reverse(); // now [R1_label, R2_label, ..., Finale]
  labels[labels.length-1]='Finale';
  if(depth>=2)labels[labels.length-2]='Demi-finales';
  if(depth>=3)labels[labels.length-3]='Quarts';
  if(depth>=4)labels[labels.length-4]='Huitièmes';
  if(depth>=5)labels[labels.length-5]='Seizièmes';
  if(depth>=6)labels[labels.length-6]='Trente-deuxièmes';

  // Add "Tour préliminaire" label if there are byes
  if(p>n) labels[0]='Tour préliminaire';

  const rounds=labels.map((lbl,ri)=>({id:'R'+ri,label:lbl,matches:[]}));

  // Pad ids with nulls for byes
  const padded=[...ids];
  while(padded.length<p)padded.push(null);

  // Round 0: p/2 matches, auto-advance byes immediately
  for(let i=0;i<p/2;i++){
    const home=padded[i*2],away=padded[i*2+1];
    const m=mkTie(home,away,legs);
    m.id=i;
    if(home===null||away===null){
      // Bye: auto-win
      m.played=true;m.winner=home||away;m.loser=null;
      m.sh=0;m.sa=0;
      if(m.legs===2&&m.leg1){m.leg1.played=true;m.leg1.sh=0;m.leg1.sa=0;}
    }
    rounds[0].matches.push(m);
  }

  // Fill remaining rounds with empty slots
  for(let r=1;r<rounds.length;r++){
    const mc=rounds[r-1].matches.length/2;
    for(let i=0;i<mc;i++){const m=mkTie(null,null,legs);m.id=i;rounds[r].matches.push(m);}
  }

  // Apply singleFinal to last round
  if(singleFinal){
    rounds[rounds.length-1].matches.forEach(m=>{m.legs=1;m.leg2=null;});
  }

  // Advance auto-won byes into round 1 (cupState not set yet — advance directly)
  rounds[0].matches.forEach((m,mi)=>{
    if(m.played&&m.winner!==null&&rounds[1]){
      const nm=rounds[1].matches[Math.floor(mi/2)];
      if(nm){if(mi%2===0)nm.home=m.winner;else nm.away=m.winner;}
    }
  });

  // If p===n (no byes) and only auto-wins exist, remove the preliminary round
  // Actually: if p===n, round 0 has zero auto-wins → no change needed

  return rounds;
}

// ── Create cup ────────────────────────────────────────────
function createCup(formatId,count,savedIdxs,npcSel){
  const fmt=CUP_FORMATS.find(f=>f.id===formatId);if(!fmt)return;
  const hasGroups=fmt.type==='groups_ko'||fmt.type==='round_robin';
  // For group formats: use custom config; for others: use count normally
  let n,cfg,groupLegs=1;
  if(hasGroups){
    // Total teams = groupes × équipes/groupe (indépendant de _cupCount)
    cfg={gc:_cupGC,pg:_cupPG};
    n=cfg.gc*cfg.pg;
    groupLegs=_cupGroupLegs;
  } else {
    n=Math.max(4,Math.min(24,count));
    cfg=autoGroupCfg(n);
  }
  const tList=buildCupTeams(n,savedIdxs,npcSel);
  const shuffled=[...tList].sort(()=>Math.random()-.5);
  const ids=shuffled.map(t=>t.id);

  let state={formatId,format:fmt,teams:tList,phase:'start',champion:null,thirdPlaceMatch:null};

  if(fmt.type==='knockout'){
    state.phase='knockout';
    state.bracket=buildKOBracketForN(ids,fmt.legs,fmt.singleFinal);
    if(fmt.thirdPlace)state.thirdPlaceMatch=mkTie(null,null,1);
  } else if(fmt.type==='groups_ko'){
    state.phase='groups';
    const adv=Math.max(1,Math.min(_cupAdvance,cfg.pg-1)); // clamp: at least 1, at most pg-1
    state.groupCfg={...cfg,advance:adv};
    state.groups=buildGroupsAuto(ids,cfg,groupLegs);
    state.bracket=null;
    if(fmt.thirdPlace)state.thirdPlaceMatch=mkTie(null,null,1);
  } else if(fmt.type==='double_elim'){
    state.phase='knockout';
    state.doubleElim=buildDE(ids,n);
  } else if(fmt.type==='round_robin'){
    state.phase='groups';
    state.groups=[{id:0,name:'Poule unique',teamIds:ids,fixtures:mkFix(ids,groupLegs),standings:mkStd(ids),legs:groupLegs}];
    state.groupCfg={gc:1,pg:n,advance:2};
    state.bracket=null;
  }

  state.playerStats={};cupState=state;cupCurrentMatch=null;saveCup();renderCup();
}

function buildGroupsAuto(ids,cfg,legs){
  legs=legs||1;
  const sh=[...ids];const gs=[];
  for(let g=0;g<cfg.gc;g++){
    const gIds=sh.splice(0,cfg.pg);
    if(gIds.length<2)break;
    gs.push({id:g,name:'Groupe '+String.fromCharCode(65+g),teamIds:gIds,fixtures:mkFix(gIds,legs),standings:mkStd(gIds),legs});
  }
  return gs;
}
function buildDE(ids,n){
  if(n===4){
    return{
      wb:[
        {id:'WB SF',label:'WB Demi-finales',matches:[
          {id:0,home:ids[0],away:ids[1],played:false,sh:null,sa:null,winner:null,loser:null},
          {id:1,home:ids[2],away:ids[3],played:false,sh:null,sa:null,winner:null,loser:null}]},
        {id:'WB F',label:'WB Finale',matches:[mkBracketRound('WB F','',1).matches[0]]},
      ],
      lb:[
        {id:'LB R1',label:'LB 1er tour',matches:[mkBracketRound('LB R1','',1).matches[0]]},
        {id:'LB F',label:'LB Finale',matches:[mkBracketRound('LB F','',1).matches[0]]},
      ],
      grand:{id:'GF',label:'Grande Finale',match:{home:null,away:null,played:false,sh:null,sa:null,winner:null,loser:null}},
    };
  }
  // 8 teams
  return{
    wb:[
      {id:'WB QF',label:'WB Quarts',matches:Array.from({length:4},(_,i)=>({id:i,home:ids[i*2],away:ids[i*2+1],played:false,sh:null,sa:null,winner:null,loser:null}))},
      {id:'WB SF',label:'WB Demi-finales',matches:[mkBracketRound('',''  ,1).matches[0],mkBracketRound('','',1).matches[0]]},
      {id:'WB F',label:'WB Finale',matches:[mkBracketRound('','',1).matches[0]]},
    ],
    lb:[
      {id:'LB R1',label:'LB 1er tour',matches:[mkBracketRound('','',1).matches[0],mkBracketRound('','',1).matches[0]]},
      {id:'LB R2',label:'LB 2e tour',matches:[mkBracketRound('','',1).matches[0],mkBracketRound('','',1).matches[0]]},
      {id:'LB SF',label:'LB Demi-finales',matches:[mkBracketRound('','',1).matches[0]]},
      {id:'LB F',label:'LB Finale',matches:[mkBracketRound('','',1).matches[0]]},
    ],
    grand:{id:'GF',label:'Grande Finale',match:{home:null,away:null,played:false,sh:null,sa:null,winner:null,loser:null}},
  };
}

// ── Record results ────────────────────────────────────────
function recordCupResult(s0,s1){
  if(!cupState||!cupCurrentMatch)return;
  const cm=cupCurrentMatch;cupCurrentMatch=null;
  // If leg 2 was played with teams swapped (away plays "home" on pitch),
  // invert scores back to original home/away perspective before recording
  if(cm.swapped){const tmp=s0;s0=s1;s1=tmp;}

  if(cm.phase==='groups'){
    const g=cupState.groups?.[cm.groupIdx];
    const fix=g?.fixtures?.[cm.fixtureIdx];
    if(!g||!fix)return;
    fix.played=true;fix.sh=s0;fix.sa=s1;
    updateStd(g.standings,fix,s0,s1);
    checkGroupsDone();
  } else if(cm.phase==='knockout'||cm.phase==='third_place'){
    const m=cm.phase==='third_place'?cupState.thirdPlaceMatch:cupState.bracket[cm.roundIdx].matches[cm.matchIdx];
    applyLegResult(m,s0,s1,cm.leg||1);
    if(m.played){
      if(cm.phase==='knockout'){advanceKO(cm.roundIdx,cm.matchIdx);}
      checkCupDone();
    }
  } else if(cm.phase==='double_elim'){
    const de=cupState.doubleElim;
    const m=cm.dePhase==='grand'?de.grand.match:(cm.dePhase==='wb'?de.wb:de.lb)[cm.roundIdx].matches[cm.matchIdx];
    applyLegResult(m,s0,s1,cm.leg||1);
    if(m.played)advanceDE(cm.dePhase,cm.roundIdx,cm.matchIdx,m.winner,m.loser);
  }

  if(_leagueUserTeamBackup){
    teams[0]=_leagueUserTeamBackup[0];teams[1]=_leagueUserTeamBackup[1];_leagueUserTeamBackup=null;
  }
  renderTB(0);renderTB(1);syncHUD();
  saveCup();nav('cup');
}

function applyLegResult(m,s0,s1,leg){
  // s0 = buts de m.home, s1 = buts de m.away (après inversion swap dans recordCupResult)
  if(m.legs===2){
    const legKey=leg===1?'leg1':'leg2';
    m[legKey]={played:true,sh:s0,sa:s1};
    recomputeTwoLegAggregate(m);
  } else {
    applyKOResult(m,s0,s1);
  }
}

function recomputeTwoLegAggregate(m){
  const leg1Done=m.leg1?.played, leg2Done=m.leg2?.played;
  if(leg1Done&&leg2Done){
    // Agrégat : home_total = buts_home_leg1 + buts_home_leg2
    const agg0=(m.leg1.sh||0)+(m.leg2.sh||0); // total buts m.home
    const agg1=(m.leg1.sa||0)+(m.leg2.sa||0); // total buts m.away
    m.sh=agg0; m.sa=agg1; m.played=true;
    if(agg0>agg1){m.winner=m.home;m.loser=m.away;}
    else if(agg1>agg0){m.winner=m.away;m.loser=m.home;}
    else{
      // Buts à l'extérieur en avantage : away a marqué au leg1 (terrain de home)
      const awayGoalsAway=m.leg1.sa||0; // buts de away au leg1 (terrain de home)
      const homeGoalsAway=m.leg2.sa||0; // buts de home au leg2 (terrain de away)
      if(awayGoalsAway>homeGoalsAway){m.winner=m.away;m.loser=m.home;}
      else if(homeGoalsAway>awayGoalsAway){m.winner=m.home;m.loser=m.away;}
      else{
        // Toujours égal → tirs au but simulés
        m.winner=Math.random()<.5?m.home:m.away;
        m.loser=m.winner===m.home?m.away:m.home;
        logEvent('Égalité — '+(getCupTeamData(m.winner)?.name||'?')+' aux tirs au but !','#f0c028');
      }
    }
  } else {
    m.played=false;m.sh=null;m.sa=null;m.winner=null;m.loser=null;
  }
}

function undoStd(std,fix,s0,s1){
  const h=std.find(x=>x.id===fix.home),a=std.find(x=>x.id===fix.away);
  if(!h||!a)return;
  h.P--;h.GF-=s0;h.GA-=s1;a.P--;a.GF-=s1;a.GA-=s0;
  if(s0>s1){h.W--;h.Pts-=3;a.L--;}else if(s1>s0){a.W--;a.Pts-=3;h.L--;}else{h.D--;h.Pts--;a.D--;a.Pts--;}
}

// ── Édition manuelle des résultats (mode coupe) ───────────
// Un match est verrouillé dès que la suite du tournoi dépend déjà de son résultat.
function cupDownstreamPlayed(cm){
  if(!cupState)return false;
  if(cm.phase==='groups')return cupState.phase!=='groups';
  if(cm.phase==='knockout'){
    const b=cupState.bracket;const nr=b[cm.roundIdx+1];
    if(nr){const nm=nr.matches[Math.floor(cm.matchIdx/2)];if(nm&&nm.played)return true;}
    const isSF=cm.roundIdx===b.length-2;
    if(isSF&&cupState.format?.thirdPlace&&cupState.thirdPlaceMatch?.played)return true;
    return false;
  }
  if(cm.phase==='third_place')return false;
  if(cm.phase==='double_elim'){
    const de=cupState.doubleElim;
    const n=cupState.teams.length;
    const{dePhase,roundIdx:ri,matchIdx:mi}=cm;
    const played=x=>!!x&&!!x.played;
    if(n===4){
      if(dePhase==='wb'&&ri===0)return played(de.wb[1]?.matches?.[0])||played(de.lb[0]?.matches?.[0]);
      if(dePhase==='wb'&&ri===1)return played(de.grand.match)||played(de.lb[1]?.matches?.[0]);
      if(dePhase==='lb'&&ri===0)return played(de.lb[1]?.matches?.[0]);
      if(dePhase==='lb'&&ri===1)return played(de.grand.match);
    } else { // 8 teams
      if(dePhase==='wb'&&ri===0){const gi=Math.floor(mi/2);return played(de.wb[1]?.matches?.[gi])||played(de.lb[0]?.matches?.[gi]);}
      if(dePhase==='wb'&&ri===1)return played(de.wb[2]?.matches?.[0])||played(de.lb[1]?.matches?.[mi]);
      if(dePhase==='wb'&&ri===2)return played(de.grand.match)||played(de.lb[3]?.matches?.[0]);
      if(dePhase==='lb'&&ri===0)return played(de.lb[1]?.matches?.[mi]);
      if(dePhase==='lb'&&ri===1)return played(de.lb[2]?.matches?.[0]);
      if(dePhase==='lb'&&ri===2)return played(de.lb[3]?.matches?.[0]);
      if(dePhase==='lb'&&ri===3)return played(de.grand.match);
    }
    if(dePhase==='grand')return false;
    return false;
  }
  return false;
}

function isCupEditLocked(cm){
  if(!cupState)return true;
  if(cupState.phase==='done')return true;
  return cupDownstreamPlayed(cm);
}

function showCupEditLockedMsg(){
  let modal=document.getElementById('cup-edit-modal');
  if(!modal){modal=document.createElement('div');modal.id='cup-edit-modal';modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';document.body.appendChild(modal);}
  modal.innerHTML=`<div style="background:var(--dark,#050e1a);border:1px solid var(--b1,#1a2a3a);border-radius:12px;padding:20px;max-width:280px;width:100%;text-align:center">
    <div style="font-size:12px;color:var(--muted);margin-bottom:14px">🔒 Ce résultat ne peut plus être modifié : la suite du tournoi en dépend déjà.</div>
    <button class="btn btng" style="width:100%;justify-content:center" id="cup-edit-locked-ok">OK</button>
  </div>`;
  modal.style.display='flex';
  document.getElementById('cup-edit-locked-ok').onclick=()=>{modal.style.display='none';};
}

function cupEditRowHtml(key,hT,aT,sh,sa){
  return `<div style="display:grid;grid-template-columns:1fr 46px 12px 46px 1fr;gap:4px;align-items:center;margin-bottom:6px">
    <span style="font-size:10px;font-weight:700;color:${hT?.color||'#fff'};text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${hT?.name||'?'}</span>
    <input type="number" min="0" max="99" id="cup-edit-${key}-h" value="${sh}" style="width:46px;text-align:center;background:var(--panel);border:1px solid var(--b1);border-radius:4px;color:var(--text);font-size:13px;padding:3px">
    <span style="text-align:center;font-size:10px;color:var(--muted)">–</span>
    <input type="number" min="0" max="99" id="cup-edit-${key}-a" value="${sa}" style="width:46px;text-align:center;background:var(--panel);border:1px solid var(--b1);border-radius:4px;color:var(--text);font-size:13px;padding:3px">
    <span style="font-size:10px;font-weight:700;color:${aT?.color||'#fff'};text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${aT?.name||'?'}</span>
  </div>`;
}

function openCupEditModal(cm){
  if(!cupState)return;
  const fix=getCupMatchFix(cm);if(!fix||fix.home===null||fix.away===null)return;
  if(isCupEditLocked(cm)){showCupEditLockedMsg();return;}
  const hT=cupState.teams.find(t=>t.id===fix.home),aT=cupState.teams.find(t=>t.id===fix.away);
  const twoLeg=fix.legs===2;
  let modal=document.getElementById('cup-edit-modal');
  if(!modal){modal=document.createElement('div');modal.id='cup-edit-modal';modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';document.body.appendChild(modal);}
  modal.innerHTML='';
  const box=document.createElement('div');
  box.style.cssText='background:var(--dark,#050e1a);border:1px solid var(--b1,#1a2a3a);border-radius:12px;padding:18px;max-width:320px;width:100%';
  let bodyHtml=`<div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;margin-bottom:12px;text-align:center">✎ Modifier le résultat</div>`;
  let legsToEdit=[];
  if(!twoLeg){
    const cur=fix.played?{sh:fix.sh,sa:fix.sa}:{sh:0,sa:0};
    legsToEdit=['single'];
    bodyHtml+=cupEditRowHtml('single',hT,aT,cur.sh,cur.sa);
  } else {
    const l1=fix.leg1,l2=fix.leg2;
    // On n'affiche que les manches jouables : la manche aller (toujours), et la manche
    // retour seulement si elle est déjà jouée ou si la manche aller l'est (sinon prématuré).
    legsToEdit.push('leg1');
    bodyHtml+=`<div style="font-size:9px;color:var(--muted);margin-bottom:2px">Match aller</div>`+cupEditRowHtml('leg1',hT,aT,l1?.sh??0,l1?.sa??0);
    if(l2?.played||l1?.played){
      legsToEdit.push('leg2');
      bodyHtml+=`<div style="font-size:9px;color:var(--muted);margin:8px 0 2px">Match retour</div>`+cupEditRowHtml('leg2',hT,aT,l2?.sh??0,l2?.sa??0);
    }
  }
  bodyHtml+=`<div style="display:flex;gap:8px;margin-top:10px">
    <button class="btn" style="flex:1;justify-content:center;color:var(--green)" id="cup-edit-save">✓ Enregistrer</button>
    <button class="btn btng" style="flex:1;justify-content:center" id="cup-edit-cancel">Annuler</button>
  </div>`;
  box.innerHTML=bodyHtml;modal.appendChild(box);modal.style.display='flex';
  document.getElementById('cup-edit-cancel').onclick=()=>{modal.style.display='none';};
  document.getElementById('cup-edit-save').onclick=()=>{
    const data={};
    legsToEdit.forEach(key=>{
      const sh=parseInt(document.getElementById(`cup-edit-${key}-h`).value)||0;
      const sa=parseInt(document.getElementById(`cup-edit-${key}-a`).value)||0;
      data[key]={sh,sa};
    });
    applyCupManualEdit(cm,data,twoLeg);
    modal.style.display='none';
    renderCup();
  };
}

function applyCupManualEdit(cm,data,twoLeg){
  if(!cupState||isCupEditLocked(cm))return;
  if(cm.phase==='groups'){
    const g=cupState.groups?.[cm.groupIdx];const fix=g?.fixtures?.[cm.fixtureIdx];
    if(!fix||fix.home===null||fix.away===null)return;
    if(fix.played)undoStd(g.standings,fix,fix.sh,fix.sa);
    fix.played=true;fix.sh=data.single.sh;fix.sa=data.single.sa;
    updateStd(g.standings,fix,data.single.sh,data.single.sa);
    checkGroupsDone();
  } else if(cm.phase==='knockout'||cm.phase==='third_place'||cm.phase==='double_elim'){
    const m=getCupMatchFix(cm);
    if(!m||m.home===null||m.away===null)return;
    if(twoLeg){
      if(data.leg1)m.leg1={played:true,sh:data.leg1.sh,sa:data.leg1.sa};
      if(data.leg2)m.leg2={played:true,sh:data.leg2.sh,sa:data.leg2.sa};
      recomputeTwoLegAggregate(m);
    } else {
      applyKOResult(m,data.single.sh,data.single.sa);
    }
    if(m.played){
      if(cm.phase==='knockout'){advanceKO(cm.roundIdx,cm.matchIdx);checkCupDone();}
      else if(cm.phase==='third_place'){checkCupDone();}
      else if(cm.phase==='double_elim'){advanceDE(cm.dePhase,cm.roundIdx,cm.matchIdx,m.winner,m.loser);}
    }
  }
  saveCup();
}

function applyKOResult(m,s0,s1){
  m.played=true;m.sh=s0;m.sa=s1;
  if(s0>s1){m.winner=m.home;m.loser=m.away;}
  else if(s1>s0){m.winner=m.away;m.loser=m.home;}
  else{// Draw → random winner (simulate penalties)
    m.winner=Math.random()<.5?m.home:m.away;m.loser=m.winner===m.home?m.away:m.home;
    logEvent(`Égalité — ${getCupTeamData(m.winner)?.name||''} gagne aux tirs !`,'#f0c028');
  }
}

function advanceKO(ri,mi){
  const b=cupState.bracket,nr=b[ri+1];
  if(nr){const nm=nr.matches[Math.floor(mi/2)];if(nm){if(mi%2===0)nm.home=b[ri].matches[mi].winner;else nm.away=b[ri].matches[mi].winner;}}
  // Third place: penultimate round losers (SF = 2nd-to-last round)
  const fmt=cupState.format;
  const isSF=ri===b.length-2;
  if(fmt.thirdPlace&&isSF){
    const sfLosers=b[ri].matches.filter(m=>m.loser!==null).map(m=>m.loser);
    if(sfLosers.length===2&&cupState.thirdPlaceMatch){
      cupState.thirdPlaceMatch.home=sfLosers[0];cupState.thirdPlaceMatch.away=sfLosers[1];
    }
  }
}

function checkGroupsDone(){
  if(!cupState.groups?.every(g=>g.fixtures.every(f=>f.played)))return;
  if(cupState.format.type==='round_robin'){
    const std=sortStd(cupState.groups[0].standings);
    cupState.champion=std[0].id;cupState.phase='done';
    logEvent('🏆 '+(getCupTeamData(cupState.champion)?.name||'')+' remporte la coupe !','#f0c028');
    saveCup();return;
  }
  cupState.bracket=generateKOFromGroups();cupState.phase='knockout';saveCup();
}

function generateKOFromGroups(){
  const advance=cupState.groupCfg?.advance||2;
  const gc=cupState.groups.length;

  // ── Qualifiés directs (1ers, 2es, ...) ────────────────────
  const directQualifiers=[];
  cupState.groups.forEach((g,gi)=>{
    const s=sortStd(g.standings);
    for(let r=0;r<Math.min(advance,s.length);r++)
      directQualifiers.push({id:s[r].id,rank:r,group:gi,pts:s[r].Pts,gd:s[r].GF-s[r].GA,gf:s[r].GF});
  });

  // ── Meilleurs Xes si besoin pour puissance de 2 ───────────
  const directCount=directQualifiers.length;
  let target=1;while(target<directCount)target*=2;
  const need3=target-directCount;

  const potentialThirds=[];
  cupState.groups.forEach((g,gi)=>{
    const s=sortStd(g.standings);
    if(s.length>advance){
      const third=s[advance];// (advance+1)ème
      potentialThirds.push({id:third.id,rank:advance,group:gi,pts:third.Pts,gd:third.GF-third.GA,gf:third.GF});
    }
  });

  // Sélectionne les N meilleurs (pts > gd > gf)
  const qualifiedThirds=need3>0&&need3<=potentialThirds.length
    ?[...potentialThirds].sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf).slice(0,need3)
    :[];

  const qualifiers=[...directQualifiers,...qualifiedThirds];

  // ── Log si meilleurs 3es ───────────────────────────────────
  if(qualifiedThirds.length>0){
    const names=qualifiedThirds.map(q=>getCupTeamData(q.id)?.name||'?').join(', ');
    logEvent(`🏅 Meilleurs 3es qualifiés : ${names}`,'#f0c028');
    const elim=potentialThirds.filter(t=>!qualifiedThirds.find(q=>q.id===t.id));
    if(elim.length)logEvent(`❌ 3es éliminés : ${elim.map(q=>getCupTeamData(q.id)?.name||'?').join(', ')}`,'#e02030');
  }

  // ── Seeding snake ──────────────────────────────────────────
  const ranked=[];
  const maxRank=Math.max(...qualifiers.map(q=>q.rank),0);
  for(let r=0;r<=maxRank;r++)
    ranked.push(...qualifiers.filter(q=>q.rank===r));

  const n=ranked.length;
  const pairs=[];
  const top=ranked.slice(0,Math.floor(n/2));
  const bot=ranked.slice(Math.floor(n/2)).reverse();
  for(let i=0;i<top.length&&i<bot.length;i++){
    // Avoid same-group clash if possible
    if(top[i].group===bot[i].group&&i+1<bot.length)
      [bot[i],bot[i+1]]=[bot[i+1],bot[i]];
    pairs.push({home:top[i].id,away:bot[i].id});
  }
  const used=new Set(pairs.flatMap(p=>[p.home,p.away]));
  const leftover=ranked.filter(q=>!used.has(q.id));
  for(let i=0;i+1<leftover.length;i+=2)
    pairs.push({home:leftover[i].id,away:leftover[i+1].id});

  return buildKOBracketFromPairs(pairs);
}

function buildKOBracketFromPairs(pairs){
  const fmt=cupState.format;
  const legs=fmt.legs||1;
  // Build ids in seeding order: pairs already correctly seeded (1st vs last, etc.)
  // Interleave home/away so buildKOBracketForN places them correctly:
  // pair[0]=(h0,a0), pair[1]=(h1,a1) → ids=[h0,a0,h1,a1,...]
  // buildKOBracketForN then matches [0]vs[1], [2]vs[3] etc. = h0 vs a0, h1 vs a1 ✓
  const ids=pairs.flatMap(p=>[p.home,p.away]);
  return buildKOBracketForN(ids,legs,fmt.singleFinal);
}

function checkCupDone(){
  if(!cupState.bracket)return;
  const last=cupState.bracket[cupState.bracket.length-1];
  const fin=last.matches[0];if(!fin?.played)return;
  const fmt=cupState.format;
  if(fmt.thirdPlace&&cupState.thirdPlaceMatch?.home!==null&&!cupState.thirdPlaceMatch?.played)return;
  cupState.phase='done';cupState.champion=fin.winner;
  logEvent('🏆 '+(getCupTeamData(fin.winner)?.name||'')+' remporte la coupe !','#f0c028');
}

// ── Double elimination advancement ───────────────────────
function advanceDE(phase,ri,mi,winner,loser){
  const de=cupState.doubleElim;
  if(cupState.teams.length===4){
    if(phase==='wb'&&ri===0){
      const allDone=de.wb[0].matches.every(m=>m.played);
      if(allDone){
        de.wb[1].matches[0].home=de.wb[0].matches[0].winner;
        de.wb[1].matches[0].away=de.wb[0].matches[1].winner;
        de.lb[0].matches[0].home=de.wb[0].matches[0].loser;
        de.lb[0].matches[0].away=de.wb[0].matches[1].loser;
      }
    } else if(phase==='wb'&&ri===1){
      de.grand.match.home=winner;
      const lbF=de.lb[1].matches[0];if(!lbF.home)lbF.home=loser;else lbF.away=loser;
    } else if(phase==='lb'&&ri===0){de.lb[1].matches[0].away=winner;}
    else if(phase==='lb'&&ri===1){de.grand.match.away=winner;}
  } else { // 8 teams
    if(phase==='wb'&&ri===0){
      const wbQF=de.wb[0].matches;
      if(wbQF.every(m=>m.played)){
        de.wb[1].matches[0].home=wbQF[0].winner;de.wb[1].matches[0].away=wbQF[1].winner;
        de.wb[1].matches[1].home=wbQF[2].winner;de.wb[1].matches[1].away=wbQF[3].winner;
        de.lb[0].matches[0].home=wbQF[0].loser;de.lb[0].matches[0].away=wbQF[1].loser;
        de.lb[0].matches[1].home=wbQF[2].loser;de.lb[0].matches[1].away=wbQF[3].loser;
      }
    } else if(phase==='wb'&&ri===1){
      const wbSF=de.wb[1].matches;
      if(wbSF.every(m=>m.played)){
        de.wb[2].matches[0].home=wbSF[0].winner;de.wb[2].matches[0].away=wbSF[1].winner;
        // Fill LB R2 home slots with WB SF losers (away slots filled when LB R1 finishes)
        if(!de.lb[1].matches[0].home)de.lb[1].matches[0].home=wbSF[0].loser;
        if(!de.lb[1].matches[1].home)de.lb[1].matches[1].home=wbSF[1].loser;
      }
    } else if(phase==='wb'&&ri===2){
      de.grand.match.home=winner;
      const lbF=de.lb[3]?.matches?.[0];
      if(lbF){if(!lbF.home)lbF.home=loser;else lbF.away=loser;}
    }
    else if(phase==='lb'&&ri===0){
      // LB R1 winner goes into LB R2 away slot
      if(de.lb[1]?.matches[mi]){
        de.lb[1].matches[mi].away=winner;
        // Also fill home if WB SF loser is known
        const wbSFdone=de.wb[1]?.matches.every(m=>m.played);
        if(wbSFdone&&!de.lb[1].matches[mi].home)
          de.lb[1].matches[mi].home=de.wb[1].matches[mi].loser;
      }
    }
    else if(phase==='lb'&&ri===1){
      const r2=de.lb[1]?.matches;
      if(r2&&r2.every(m=>m.played)){
        if(de.lb[2]?.matches?.[0]){
          de.lb[2].matches[0].home=r2[0].winner;
          de.lb[2].matches[0].away=r2[1].winner;
        }
      }
    }
    else if(phase==='lb'&&ri===2){if(de.lb[3]?.matches?.[0])de.lb[3].matches[0].away=winner;}
    else if(phase==='lb'&&ri===3){de.grand.match.away=winner;}
  }
  if(phase==='grand'||de.grand.match.played){
    if(de.grand.match.played){cupState.phase='done';cupState.champion=de.grand.match.winner;logEvent('🏆 '+(getCupTeamData(de.grand.match.winner)?.name||'')+' remporte la coupe !','#f0c028');}
  }
}

// ── Get next match ────────────────────────────────────────
function nextLegForMatch(m){
  // Returns leg number (1 or 2) for the next unplayed leg, or null if both played
  if(!m||m.home===null||m.away===null)return null;
  if(m.legs===2){
    if(!m.leg1.played)return 1;
    if(m.leg2&&!m.leg2.played)return 2;
    return null; // both played
  }
  return m.played?null:1;
}

function getNextCupMatch(){
  if(!cupState||cupState.phase==='done')return null;
  const{groups,bracket,thirdPlaceMatch,doubleElim}=cupState;
  if(groups){
    for(let gi=0;gi<groups.length;gi++){
      const g=groups[gi];
      for(let fi=0;fi<g.fixtures.length;fi++){
        const fix=g.fixtures[fi];
        if(fix.home===null||fix.away===null)continue;
        if(!fix.played)return{phase:'groups',groupIdx:gi,fixtureIdx:fi,leg:1};
      }
    }
  }
  if(bracket){
    for(let ri=0;ri<bracket.length;ri++)
      for(let mi=0;mi<bracket[ri].matches.length;mi++){
        const m=bracket[ri].matches[mi];
        const leg=nextLegForMatch(m);
        if(leg!==null)return{phase:'knockout',roundIdx:ri,matchIdx:mi,leg};
      }
    if(thirdPlaceMatch){
      const leg=nextLegForMatch(thirdPlaceMatch);
      if(leg!==null)return{phase:'third_place',leg};
    }
  }
  if(doubleElim){
    const de=doubleElim;
    for(let ri=0;ri<de.wb.length;ri++)
      for(let mi=0;mi<de.wb[ri].matches.length;mi++){
        const m=de.wb[ri].matches[mi];const leg=nextLegForMatch(m);
        if(leg!==null)return{phase:'double_elim',dePhase:'wb',roundIdx:ri,matchIdx:mi,leg};
      }
    for(let ri=0;ri<de.lb.length;ri++)
      for(let mi=0;mi<de.lb[ri].matches.length;mi++){
        const m=de.lb[ri].matches[mi];const leg=nextLegForMatch(m);
        if(leg!==null)return{phase:'double_elim',dePhase:'lb',roundIdx:ri,matchIdx:mi,leg};
      }
    const gf=de.grand.match;const leg=nextLegForMatch(gf);
    if(leg!==null)return{phase:'double_elim',dePhase:'grand',roundIdx:0,matchIdx:0,leg};
  }
  return null;
}

function getCupMatchFix(cm){
  if(!cm)return null;
  const{groups,bracket,thirdPlaceMatch,doubleElim}=cupState;
  if(cm.phase==='groups'){
    const g=cupState.groups?.[cm.groupIdx];
    return g?.fixtures?.[cm.fixtureIdx]||null;
  }
  if(cm.phase==='knockout')return bracket[cm.roundIdx].matches[cm.matchIdx];
  if(cm.phase==='third_place')return thirdPlaceMatch;
  if(cm.phase==='double_elim'){
    const de=doubleElim;
    if(cm.dePhase==='grand')return de.grand.match;
    return(cm.dePhase==='wb'?de.wb:de.lb)[cm.roundIdx].matches[cm.matchIdx];
  }
  return null;
}

// ── Play / simulate ───────────────────────────────────────
function playCupMatch(){
  if(!cupState)return;
  // Restore backup FIRST so getCupTeamData returns real user teams, not stale clones
  if(_leagueUserTeamBackup){
    teams[0]=_leagueUserTeamBackup[0];
    teams[1]=_leagueUserTeamBackup[1];
    _leagueUserTeamBackup=null;
  }
  const cm=getNextCupMatch();if(!cm){renderCup();return;}
  const fix=getCupMatchFix(cm);if(!fix)return;
  const leg=cm.leg||1;
  // For leg 2: the original "away" team plays at home → swap teams on the pitch
  // We record a `swapped` flag so recordCupResult can invert s0/s1 back to home/away perspective
  const swapped=leg===2;
  const hId=swapped?fix.away:fix.home;
  const aId=swapped?fix.home:fix.away;
  const hD=getCupTeamData(hId),aD=getCupTeamData(aId);
  if(!hD||!aD){logEvent('Données équipe manquantes !','#e02030');return;}
  cupCurrentMatch={...cm,leg,swapped};
  _leagueUserTeamBackup=[teams[0],teams[1]];
  teams[0]=deepCloneTeam(hD);teams[1]=deepCloneTeam(aD);
  _lastNav='cup';resetMatch();G.leagueMode=true;
  nav('match');syncHUD();renderTB(0);renderTB(1);
  const hN=cupState.teams.find(t=>t.id===fix.home)?.name||hD.name;
  const aN=cupState.teams.find(t=>t.id===fix.away)?.name||aD.name;
  const legLbl=leg===2?' (Retour — terrain adverse)':fix?.legs===2?' (Aller)':'';
  logEvent('Coupe : '+hN+' ⬡ '+aN+legLbl,'#f0c028');
  showPreMatch();
}

// simulateCupMatch is defined earlier near simulateMatch

// Play any specific cup match (not just the "next" one)
function playCupFixDirectly(cm){
  if(!cupState||!cm)return;
  if(_leagueUserTeamBackup){
    teams[0]=_leagueUserTeamBackup[0];teams[1]=_leagueUserTeamBackup[1];_leagueUserTeamBackup=null;
  }
  const fix=getCupMatchFix(cm);if(!fix||fix.played)return;
  // Déterminer le bon leg (comme forceSimCupFix) — cm.leg n'est pas toujours fourni par les boutons du bracket
  let leg=cm.leg||1;
  if(fix.legs===2){
    leg=(!fix.leg1?.played)?1:(!fix.leg2?.played)?2:leg;
    if(leg===1&&fix.leg1?.played)return;
    if(leg===2&&fix.leg2?.played)return;
  }
  const swapped=leg===2;
  const hId=swapped?fix.away:fix.home,aId=swapped?fix.home:fix.away;
  const hD=getCupTeamData(hId),aD=getCupTeamData(aId);
  if(!hD||!aD){logEvent('Données équipe manquantes !','#e02030');return;}
  cupCurrentMatch={...cm,leg,swapped};
  _leagueUserTeamBackup=[teams[0],teams[1]];
  teams[0]=deepCloneTeam(hD);teams[1]=deepCloneTeam(aD);
  _lastNav='cup';resetMatch();G.leagueMode=true;
  nav('match');syncHUD();renderTB(0);renderTB(1);
  const hN=cupState.teams.find(t=>t.id===fix.home)?.name||hD.name;
  const aN=cupState.teams.find(t=>t.id===fix.away)?.name||aD.name;
  const legLbl=leg===2?' (Retour — terrain adverse)':fix?.legs===2?' (Aller)':'';
  logEvent('Coupe : '+hN+' ⬡ '+aN+legLbl,'#f0c028');
  showPreMatch();
}

// Force-simulate a human match (with red warning)
function forceSimCupFix(cm){
  if(!cupState||!cm)return;
  const fix=getCupMatchFix(cm);if(!fix||fix.played)return;
  // Déterminer le bon leg
  let leg=cm.leg||1;
  if(fix.legs===2){
    leg=(!fix.leg1?.played)?1:(!fix.leg2?.played)?2:leg;
    if(leg===1&&fix.leg1?.played)return;
    if(leg===2&&fix.leg2?.played)return;
  }
  const hN=cupState.teams.find(t=>t.id===fix.home)?.name||'?';
  const aN=cupState.teams.find(t=>t.id===fix.away)?.name||'?';
  const legLbl=fix.legs===2?(leg===2?' (Retour)':' (Aller)'):'';
  let modal=document.getElementById('cup-sim-modal');
  if(!modal){modal=document.createElement('div');modal.id='cup-sim-modal';modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';document.body.appendChild(modal);}
  modal.innerHTML='';
  const box=document.createElement('div');box.style.cssText='background:var(--dark,#050e1a);border:1px solid var(--b1,#1a2a3a);border-radius:12px;padding:20px;max-width:300px;width:100%;text-align:center';
  const txt=document.createElement('div');txt.style.cssText='font-size:12px;margin-bottom:16px;color:var(--fg,#e0e8f0)';
  txt.textContent='Simuler '+hN+' vs '+aN+legLbl+' ? (résultat aléatoire)';
  const row=document.createElement('div');row.style.display='flex';row.style.gap='8px';
  const btnY=document.createElement('button');btnY.className='btn';btnY.style.cssText='flex:1;justify-content:center;color:#e04040;border-color:#e0404066';btnY.textContent='⚡ Simuler';
  btnY.onclick=()=>{
    modal.style.display='none';
    // Simuler du point de vue home=fix.home toujours
    const{sh,sa}=simulateCupMatch(fix.home,fix.away);
    cupCurrentMatch={...cm,leg,swapped:false};
    recordCupResult(sh,sa);
    logEvent('⚡ Simulé : '+hN+' '+sh+'–'+sa+' '+aN+legLbl,'#e04040');
    renderCup();
  };
  const btnN=document.createElement('button');btnN.className='btn btng';btnN.style.cssText='flex:1;justify-content:center';btnN.textContent='Annuler';
  btnN.onclick=()=>{modal.style.display='none';};
  row.appendChild(btnY);row.appendChild(btnN);box.appendChild(txt);box.appendChild(row);modal.appendChild(box);
  modal.style.display='flex';
}

function simulateCupFix(cm, force){
  if(!cm)return;
  const fix=getCupMatchFix(cm);if(!fix)return;
  if(fix.played)return;
  // Match joueur: forcer directement si force=true, sinon ouvrir la modal
  if(isUserFix(fix)){
    if(force){
      // Simulation directe sans confirmation (appelée depuis skipAllCupNPC par ex)
      const{sh,sa}=simulateCupMatch(fix.home,fix.away);
      cupCurrentMatch={...cm,leg:cm.leg||1};
      recordCupResult(sh,sa);
      logEvent('⚡ Simulé (joueur): '+sh+'–'+sa,'#e04040');
    } else {
      forceSimCupFix(cm);
    }
    return;
  }
  // Match NPC: simuler directement
  let leg=cm.leg||1;
  if(fix.legs===2){
    leg=fix.leg1&&!fix.leg1.played?1:fix.leg1?.played&&fix.leg2&&!fix.leg2.played?2:1;
    if(leg===1&&fix.leg1?.played)return;
    if(leg===2&&fix.leg2?.played)return;
  }
  const{sh,sa}=simulateCupMatch(fix.home,fix.away);
  cupCurrentMatch={...cm,leg};recordCupResult(sh,sa);
  logEvent('⚡ Simulé'+(fix.legs===2?(leg===2?' (retour)':' (aller)'):''),'#8840e0');
}

function skipAllCupForce(){
  if(!cupState)return;
  let itr=0;
  while(itr++<400){
    const cm=getNextCupMatch(); if(!cm)break;
    const fix=getCupMatchFix(cm);
    if(!fix) break;
    if(fix.played) continue; // sauter sans casser la boucle
    simulateCupFix(cm, true);
  }
  renderCup();
}

function skipAllCupNPC(){
  if(!cupState)return;
  // Simulate ALL NPC fixtures, skipping human ones (don't break on first human)
  let itr=0;
  while(itr++<400){
    const cm=getNextNPCCupMatch();if(!cm)break;
    const fix=getCupMatchFix(cm);if(!fix)continue; // trou dans bracket, continuer
    simulateCupFix(cm);
  }
  renderCup();
}

// Like getNextCupMatch but skips human fixtures to find next NPC one
function getNextNPCCupMatch(){
  if(!cupState||cupState.phase==='done')return null;
  const{groups,bracket,thirdPlaceMatch,doubleElim}=cupState;
  // Search groups
  if(groups){
    for(let gi=0;gi<groups.length;gi++){
      const g=groups[gi];
      for(let fi=0;fi<g.fixtures.length;fi++){
        const fix=g.fixtures[fi];
        if(fix.home===null||fix.away===null||fix.played)continue;
        if(!isUserFix(fix))return{phase:'groups',groupIdx:gi,fixtureIdx:fi,leg:1};
      }
    }
  }
  // Search bracket
  if(bracket){
    for(let ri=0;ri<bracket.length;ri++)
      for(let mi=0;mi<bracket[ri].matches.length;mi++){
        const m=bracket[ri].matches[mi];
        const leg=nextLegForMatch(m);
        if(leg!==null&&!isUserFix(m))return{phase:'knockout',roundIdx:ri,matchIdx:mi,leg};
      }
    if(thirdPlaceMatch){
      const leg=nextLegForMatch(thirdPlaceMatch);
      if(leg!==null&&!isUserFix(thirdPlaceMatch))return{phase:'third_place',leg};
    }
  }
  if(doubleElim){
    const de=doubleElim;
    for(let ri=0;ri<de.wb.length;ri++)
      for(let mi=0;mi<de.wb[ri].matches.length;mi++){
        const m=de.wb[ri].matches[mi];const leg=nextLegForMatch(m);
        if(leg!==null&&!isUserFix(m))return{phase:'double_elim',dePhase:'wb',roundIdx:ri,matchIdx:mi,leg};
      }
    for(let ri=0;ri<de.lb.length;ri++)
      for(let mi=0;mi<de.lb[ri].matches.length;mi++){
        const m=de.lb[ri].matches[mi];const leg=nextLegForMatch(m);
        if(leg!==null&&!isUserFix(m))return{phase:'double_elim',dePhase:'lb',roundIdx:ri,matchIdx:mi,leg};
      }
    const gf=de.grand.match;const leg=nextLegForMatch(gf);
    if(leg!==null&&!isUserFix(gf))return{phase:'double_elim',dePhase:'grand',roundIdx:0,matchIdx:0,leg};
  }
  return null;
}

// ── Cup team editor (in-progress) ────────────────────────
let _editingCupTeamId=null;

function openCupTeamEditor(){
  if(!cupState)return;
  document.getElementById('mttl').textContent='✏️ Équipes de la coupe';
  document.getElementById('mcnt').innerHTML=`<div id="cup-team-list"></div>`;
  document.getElementById('pmodal').classList.add('on');
  renderCupTeamList();
}

function renderCup(){
  const el=document.getElementById('cup-out');if(!el)return;
  if(!cupState){renderCupSetup(el);return;}
  if(!cupState.format?.type){cupState=null;localStorage.removeItem('footsim7v7_cup');renderCupSetup(el);return;}

  let h='<div style="padding:4px">';
  if(cupState.phase!=='done') h+=`<button class="btn" style="font-size:10px;margin-bottom:6px;width:100%;justify-content:center" onclick="openCupTeamEditor()">✏️ Modifier les équipes</button>`;
  if(cupState.phase==='done'&&cupState.champion!==null){
    const ct=cupState.teams.find(t=>t.id===cupState.champion);
    h+=`<div style="background:rgba(240,192,40,.12);border:1px solid rgba(240,192,40,.3);border-radius:8px;padding:10px;text-align:center;margin-bottom:8px">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:10px;letter-spacing:2px;color:var(--gold)">🏆 VAINQUEUR</div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900;color:${ct?.color||'#fff'}">${ct?.name||'?'}</div>
    </div>`;
  }
  const nextCm=getNextCupMatch();
  const nextFix=nextCm?getCupMatchFix(nextCm):null;
  const hasNPC=nextFix&&!isUserFix(nextFix);
  h+=`<div style="display:flex;gap:4px;margin-bottom:4px">
    <button class="btn btng" style="flex:2;justify-content:center;font-size:10px" onclick="clearCup()">⚙ Nouvelle coupe</button>
    <button class="btn" style="flex:1;justify-content:center;font-size:10px" onclick="openCupNPCEditor()">✏️ Équipes</button>
  </div>
  <div style="display:flex;gap:4px;margin-bottom:6px">
    ${hasNPC?`<button class="btn" style="flex:1;justify-content:center;font-size:10px;color:#8840e0;border-color:#8840e055" onclick="skipAllCupNPC()">⚡ PNJ</button>`:'<div style="flex:1"></div>'}
    <button class="btn" style="flex:1;justify-content:center;font-size:10px" onclick="skipAllCupForce()">⚡ ⚡ Tout sim.</button>
  </div>`;
  h+=`<div style="font-size:10px;color:var(--muted);font-family:'Barlow Condensed',sans-serif;margin-bottom:8px">${cupState.format.name}</div>`;

  if(cupState.groups){
    cupState.groups.forEach(g=>{ h+=renderCupGroupHTML(g); });
  }
  if(cupState.bracket){
    cupState.bracket.forEach((round,ri)=>{ h+=renderCupRoundHTML(round,nextCm,'knockout',ri); });
    if(cupState.thirdPlaceMatch&&cupState.thirdPlaceMatch.home!==null){
      h+=renderCupRoundHTML({id:'3P',label:'3e / 4e place',matches:[cupState.thirdPlaceMatch]},nextCm,'third_place',-1);
    }
  }
  if(cupState.doubleElim){
    const de=cupState.doubleElim;
    h+=`<div style="font-size:9px;font-weight:700;color:var(--green);font-family:'Barlow Condensed',sans-serif;letter-spacing:1px;margin:4px 0 2px">BRACKET WINNERS</div>`;
    de.wb.forEach((r,ri)=>{ h+=renderCupRoundHTML(r,nextCm,'wb',ri); });
    h+=`<div style="font-size:9px;font-weight:700;color:var(--red);font-family:'Barlow Condensed',sans-serif;letter-spacing:1px;margin:6px 0 2px">BRACKET LOSERS</div>`;
    de.lb.forEach((r,ri)=>{ h+=renderCupRoundHTML(r,nextCm,'lb',ri); });
    h+=`<div style="font-size:9px;font-weight:700;color:var(--gold);font-family:'Barlow Condensed',sans-serif;letter-spacing:1px;margin:6px 0 2px">GRANDE FINALE</div>`;
    h+=renderCupRoundHTML({id:'GF',label:'Grande Finale',matches:[de.grand.match]},nextCm,'grand',0);
  }
  h+='</div>';el.innerHTML=h;
}

function renderCupGroupHTML(g){
  const allPlayed=g.fixtures.every(f=>f.played);
  const sorted=sortStd(g.standings);
  const adv=cupState.groupCfg?.advance||2;
  const gi=cupState.groups.indexOf(g);
  let h=`<div style="margin-bottom:10px">
  <div style="font-family:'Barlow Condensed',sans-serif;font-size:9px;font-weight:700;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;margin-bottom:3px">${g.name}</div>
  <div style="background:var(--card);border:1px solid var(--b1);border-radius:8px;overflow:hidden;margin-bottom:5px">
    <div style="display:grid;grid-template-columns:1fr 18px 18px 18px 18px 22px;gap:0 2px;padding:3px 6px;border-bottom:1px solid var(--b1)">
      ${['Équipe','J','V','N','D','Pts'].map((l,i)=>`<span style="font-size:8px;color:var(--muted);text-align:${i>0?'center':'left'}">${l}</span>`).join('')}
    </div>
    ${sorted.map((s,rank)=>{
      const t=cupState.teams.find(x=>x.id===s.id),q=rank<adv&&allPlayed;
      return `<div style="display:grid;grid-template-columns:1fr 18px 18px 18px 18px 22px;gap:0 2px;padding:3px 6px;border-bottom:1px solid var(--b1);align-items:center;cursor:pointer;background:${q?'rgba(24,200,96,.05)':'transparent'}" onclick='showStandingDetail("cup",${s.id},${gi})' title="Voir les détails">
        <span style="display:flex;align-items:center;gap:3px"><span style="width:5px;height:5px;border-radius:50%;background:${t?.color||'#888'};flex-shrink:0"></span>
        <span style="font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:${q?'var(--green)':'var(--text)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t?.name||'?'}${q?'<span style="font-size:8px;color:var(--green);margin-left:2px">✓</span>':''}</span></span>
        ${[s.P,s.W,s.D,s.L].map(v=>`<span style="font-size:9px;text-align:center">${v}</span>`).join('')}
        <span style="font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:900;text-align:center">${s.Pts}</span>
      </div>`;
    }).join('')}
  </div>`;

  const pending=g.fixtures.filter(f=>!f.played);
  const played=g.fixtures.filter(f=>f.played);
  const nextGlobalCm=getNextCupMatch();
  pending.slice(0,6).forEach((fix,i)=>{
    const hT=cupState.teams.find(t=>t.id===fix.home),aT=cupState.teams.find(t=>t.id===fix.away);
    const fi=g.fixtures.indexOf(fix),isNPC=!isUserFix(fix);
    const isNext=nextGlobalCm?.phase==='groups'&&nextGlobalCm?.groupIdx===gi&&nextGlobalCm?.fixtureIdx===fi;
    const cmRef=JSON.stringify({phase:'groups',groupIdx:gi,fixtureIdx:fi});
    h+=`<div style="display:grid;grid-template-columns:1fr auto 1fr auto;gap:2px;padding:3px 6px;align-items:center;background:${isNext?'var(--panel)':'transparent'};border-radius:4px;margin-bottom:2px">
      <span style="font-size:10px;font-weight:700;color:${hT?.color||'#fff'};text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${hT?.name||'?'}</span>
      <span style="font-size:9px;color:var(--muted);padding:0 3px">vs</span>
      <span style="font-size:10px;font-weight:700;color:${aT?.color||'#fff'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${aT?.name||'?'}</span>
      <span style="display:flex;gap:2px">
        ${isNext?`<button class="btn btng" style="padding:2px 6px;font-size:9px" onclick="playCupMatch()">▶</button>`
                :isNPC?`<button class="btn" style="padding:2px 6px;font-size:9px;color:#18c860;border-color:#18c86044" onclick='playCupFixDirectly(${cmRef})' title='Regarder ce match PNJ vs PNJ'>▶</button>`
                :`<button class="btn" style="padding:2px 6px;font-size:9px;color:var(--gold);border-color:#f0c02844" onclick='playCupFixDirectly(${cmRef})' title='Jouer ce match'>▶</button>`}
        ${isNPC?`<button class="btn" style="padding:2px 4px;font-size:9px;color:#8840e0;border-color:#8840e044" onclick='simulateCupFix(${cmRef})' title='Simuler'>⚡</button>`:''}
        <button class="btn" style="padding:2px 4px;font-size:9px;color:var(--muted);border-color:var(--b1)" onclick='openCupEditModal(${cmRef})' title='Modifier manuellement'>✎</button>
      </span>
    </div>`;
  });
  if(played.length){
    h+=`<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:3px">`;
    played.slice(-4).forEach(f=>{
      const hT=cupState.teams.find(t=>t.id===f.home),aT=cupState.teams.find(t=>t.id===f.away);
      const fi=g.fixtures.indexOf(f);
      const cmRefP=JSON.stringify({phase:'groups',groupIdx:gi,fixtureIdx:fi});
      h+=`<div style="font-size:9px;background:var(--panel);border:1px solid var(--b1);border-radius:4px;padding:2px 5px;color:var(--muted);display:flex;align-items:center;gap:4px;cursor:pointer" onclick='openCupEditModal(${cmRefP})' title="Modifier ce résultat">
        <span><span style="color:${f.sh>f.sa?hT?.color:'inherit'}">${hT?.name?.slice(0,6)||'?'}</span> ${f.sh}–${f.sa} <span style="color:${f.sa>f.sh?aT?.color:'inherit'}">${aT?.name?.slice(0,6)||'?'}</span></span>
        <span style="opacity:.6">✎</span>
      </div>`;
    });
    h+=`</div>`;
  }
  h+=`</div>`;return h;
}

function renderCupRoundHTML(round,nextCm,phase,roundIdx){
  let h=`<div style="margin-bottom:8px">
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:9px;font-weight:700;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;margin-bottom:3px">${round.label||round.id}</div>
    <div style="background:var(--card);border:1px solid var(--b1);border-radius:8px;overflow:hidden">`;
  round.matches.forEach((m,mi)=>{
    if(m.home===null&&m.away===null){h+=`<div style="padding:5px 8px;border-bottom:1px solid var(--b1);color:var(--muted);font-size:9px;font-style:italic">En attente…</div>`;return;}
    const hT=cupState.teams.find(t=>t.id===m.home),aT=cupState.teams.find(t=>t.id===m.away);
    const inPhase=(nextCm?.phase===phase)||(phase==='third_place'&&nextCm?.phase==='third_place')||(['wb','lb','grand'].includes(phase)&&nextCm?.dePhase===phase);
    const isNext=inPhase&&(phase==='third_place'||nextCm?.roundIdx===roundIdx&&nextCm?.matchIdx===mi);
    const isNPC=!isUserFix(m);
    const cmRefObj={phase:phase==='knockout'?'knockout':phase==='third_place'?'third_place':['wb','lb','grand'].includes(phase)?'double_elim':phase};
    if(['wb','lb','grand'].includes(phase))cmRefObj.dePhase=phase;
    if(roundIdx>=0)cmRefObj.roundIdx=roundIdx;
    cmRefObj.matchIdx=mi;
    const cmRef=JSON.stringify(cmRefObj);
    // Two-leg display
    const twoLeg=m.legs===2;
    const l1=m.leg1,l2=m.leg2;
    const legDetail=twoLeg&&(l1?.played||l2?.played)?`<div style="display:flex;gap:6px;font-size:8px;color:var(--muted);padding:0 8px 3px">
      ${l1?.played?`<span>A: ${l1.sh}–${l1.sa}</span>`:'<span style="opacity:.4">A: ?</span>'}
      ${l2?.played?`<span>R: ${l2.sh}–${l2.sa}</span>`:'<span style="opacity:.4">R: ?</span>'}
      ${m.played&&m.sh!==null?`<span style="color:var(--text);font-weight:700">(${m.sh}–${m.sa})</span>`:''}
    </div>`:'';
    if(m.played){
      const hw=m.winner===m.home;
      h+=`<div style="border-bottom:1px solid var(--b1)">
        <div style="display:grid;grid-template-columns:1fr auto 1fr auto;gap:4px;padding:5px 8px ${legDetail?'2px':'5px'} 8px;align-items:center">
          <span style="font-size:10px;font-weight:700;color:${hw?hT?.color:'var(--muted)'};text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${hT?.name||'?'}</span>
          <span style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:900;padding:0 6px;color:var(--text)">${m.sh}–${m.sa}</span>
          <span style="font-size:10px;font-weight:700;color:${!hw?aT?.color:'var(--muted)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${aT?.name||'?'}</span>
          <button class="btn" style="padding:2px 4px;font-size:9px;color:var(--muted);border-color:var(--b1)" onclick='openCupEditModal(${cmRef})' title='Modifier manuellement'>✎</button>
        </div>${legDetail}</div>`;
    } else {
      const legLbl=twoLeg?(l1?.played?' (Retour)':' (Aller)'):'';
      h+=`<div style="border-bottom:1px solid var(--b1)">
        <div style="display:grid;grid-template-columns:1fr auto 1fr auto;gap:2px;padding:5px 8px ${legDetail?'2px':'5px'} 8px;align-items:center;background:${isNext?'rgba(255,255,255,.03)':'transparent'}">
          <span style="font-size:10px;font-weight:700;color:${hT?.color||'#fff'};text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${hT?.name||'?'}</span>
          <span style="font-size:9px;color:var(--muted);padding:0 3px">${legLbl||'vs'}</span>
          <span style="font-size:10px;font-weight:700;color:${aT?.color||'#fff'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${aT?.name||'?'}</span>
          <span style="display:flex;gap:2px">
            ${isNext?`<button class="btn btng" style="padding:2px 7px;font-size:9px" onclick="playCupMatch()">▶</button>`
                    :isNPC?`<button class="btn" style="padding:2px 6px;font-size:9px;color:#18c860;border-color:#18c86044" onclick='playCupFixDirectly(${cmRef})' title='Regarder ce match PNJ vs PNJ'>▶</button>`
                    :`<button class="btn" style="padding:2px 6px;font-size:9px;color:var(--gold);border-color:#f0c02844" onclick='playCupFixDirectly(${cmRef})' title='Jouer ce match'>▶</button>`}
            ${isNPC?`<button class="btn" style="padding:2px 4px;font-size:9px;color:#8840e0;border-color:#8840e044" onclick='simulateCupFix(${cmRef})' title='Simuler NPC'>⚡</button>`:`<button class="btn" style="padding:2px 4px;font-size:9px;color:#e04040;border-color:#e0404044" onclick='simulateCupFix(${cmRef},true)' title='Simuler ce match joueur'>⚡</button>`}
            <button class="btn" style="padding:2px 4px;font-size:9px;color:var(--muted);border-color:var(--b1)" onclick='openCupEditModal(${cmRef})' title='Modifier manuellement'>✎</button>
          </span>
        </div>${legDetail}</div>`;
    }
  });
  h+=`</div></div>`;return h;
}

function renderCupTeamList(){
  const el=document.getElementById('cup-team-list');if(!el)return;
  el.innerHTML=`
    <input type="text" id="cte-search" class="inp" placeholder="🔍 Rechercher une équipe…" style="margin-bottom:8px;font-size:12px" oninput="_renderCupTeamListBody(this.value)">
    <div id="cte-list-body"></div>`;
  _renderCupTeamListBody('');
}

function _renderCupTeamListBody(filter){
  const body=document.getElementById('cte-list-body');if(!body)return;
  const q=(filter||'').toLowerCase().trim();
  const list=cupState.teams.filter(t=>!q||t.name.toLowerCase().includes(q));
  let h='';
  if(!list.length) h='<div style="font-size:10px;color:var(--muted);text-align:center;padding:14px 0">Aucune équipe ne correspond.</div>';
  list.forEach(t=>{
    const isUser=t.isUser;
    const isSaved=t.isSaved;
    const isNPC=t.cupNPCIdx!==undefined;
    const brokenNPC=isNPC&&!_npcById(t.cupNPCIdx);
    const brokenSaved=isSaved&&_resolveSavedIdx(t)<0;
    const broken=brokenNPC||brokenSaved;
    const badge=isUser?'<span style="font-size:8px;color:var(--gold);margin-left:4px">👤</span>':
                isSaved?'<span style="font-size:8px;color:#8888ff;margin-left:4px">💾</span>':
                isNPC?'<span style="font-size:8px;color:#8840e0;margin-left:4px">🤖</span>':'';
    const ovr=broken?null:_cupTeamListOvr(t);
    const ovrCol=ovr==null?'var(--muted)':ovr>=75?'#18c860':ovr>=60?'#f0c028':'#e06060';
    h+=`<div style="display:flex;align-items:center;gap:6px;padding:5px 6px;border-radius:6px;border:1px solid ${broken?'#e0606055':'var(--b1)'};margin-bottom:4px;background:var(--panel)">
      <span style="width:10px;height:10px;border-radius:50%;background:${t.color};flex-shrink:0;border:1px solid rgba(255,255,255,.15)"></span>
      <span style="font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;flex:1;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.name}${badge}</span>
      ${broken?`<span style="font-size:9px;font-weight:800;color:#e06060;background:#e0606022;border-radius:3px;padding:1px 5px" title="${brokenSaved?'Équipe sauvegardée introuvable (supprimée du roster depuis la création de la coupe).':'Référence PNJ perdue (pool modifié depuis la création de la coupe).'} Utilisez 🔁 pour la réparer.">⚠️ Introuvable</span>`
             :ovr!=null?`<span style="font-size:9px;font-weight:800;color:${ovrCol};background:${ovrCol}22;border-radius:3px;padding:1px 5px">OVR ${ovr}</span>`:''}
      ${isUser?`<span style="font-size:8px;color:var(--muted)" title="Équipe principale (Rouges/Bleus). Éditez ses joueurs dans l'onglet Effectif, ou remplacez-la ici par une équipe du roster / un PNJ.">principale</span>
                <button class="btn" style="padding:1px 6px;font-size:10px" title="Remplacer cette équipe principale par une équipe du roster, un PNJ ou un JSON" onclick="openCupTeamReplace(${t.id})">🔁</button>`
              :`${broken?'':`<button class="btn" style="padding:1px 7px;font-size:10px" onclick="openCupTeamRoster(${t.id})">✏️ Joueurs</button>`}
                <button class="btn${broken?' btnr':''}" style="padding:1px 6px;font-size:10px" title="${broken?'Réparer en remplaçant cette équipe':'Remplacer toute l’équipe'}" onclick="openCupTeamReplace(${t.id})">${broken?'🔁 Réparer':'🔁'}</button>`}
    </div>`;
  });
  body.innerHTML=h;
}

// Moyenne OVR rapide pour l'affichage dans la liste (sans forcer la génération des PNJ non encore ouverts)
function _cupTeamListOvr(t){
  let src=null;
  if(t.isUser) return null;
  if(t.cupNPCIdx!==undefined){ src=_npcById(t.cupNPCIdx); if(!src?.players?.length) return src?.ovr||null; }
  else if(t.isSaved){ const idx=_resolveSavedIdx(t); src=idx>=0?savedTeams[idx]:null; }
  else { ensureAIData(); src=leagueAIData[t.aIdx]; }
  if(!src?.players?.length) return null;
  return _playerOvr({s:_avgStats([...src.players,...(src.bench||[])])});
}
function _avgStats(arr){
  const keys=['spd','sht','def','stam','tec','res'];const out={};
  keys.forEach(k=>{const vals=arr.map(p=>p.s?.[k]).filter(v=>v!=null);out[k]=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:60;});
  return out;
}
function _playerOvr(p){const v=Object.values(p.s||{});return v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length):50;}

// ── Éditeur d'équipe de coupe "en profondeur" (joueurs, stats, sorts) ──────
// Fonctionne pour toute équipe éditable : PNJ, équipe sauvegardée, ou équipe
// IA par défaut (matérialisée dans le roster au premier accès).
// `ref` peut être soit un id d'équipe de coupe en cours (nombre, cupState.teams),
// soit une référence directe "saved:IDX" vers une équipe du roster (savedTeams),
// ce qui permet d'éditer une équipe sauvegardée AVANT même de créer une coupe.
function _cteMaterialize(ref){
  if(typeof ref==='string'&&ref.startsWith('saved:'))return true; // déjà complet
  const t=cupState?.teams.find(x=>x.id===ref);if(!t)return null;
  if(t.isUser)return null;
  if(t.cupNPCIdx!==undefined){
    const npc=_npcById(t.cupNPCIdx);if(!npc)return null;
    if(!npc.players?.length){const gen=mkCupNPCTeamData(npc,t.cupNPCIdx);npc.players=gen.players;npc.bench=gen.bench;npc.reserves=gen.reserves;saveCupNPCPool();}
    return t;
  }
  if(t.isSaved)return t;
  // Équipe IA par défaut → matérialiser dans le roster pour la rendre éditable durablement
  ensureAIData();
  const src=leagueAIData[t.aIdx];if(!src)return null;
  const clone={
    name:t.name||src.name, color:t.color||src.color, img:src.img||'', strat:src.strat||'321',
    players:(src.players||[]).map(serializePlayer),
    bench:(src.bench||[]).map(serializePlayer),
    reserves:(src.reserves||[]).map(serializePlayer),
    isHuman:false
  };
  savedTeams.push(clone);persistSavedTeams();
  t.isSaved=true;t.savedIdx=savedTeams.length-1;t.savedUid=_ensureSavedUid(t.savedIdx);delete t.aIdx;
  saveCup();
  return t;
}
function _cteRef(ref){
  if(typeof ref==='string'&&ref.startsWith('saved:')){
    const idx=parseInt(ref.slice(6),10);
    const st=savedTeams[idx];
    return st?{ref:st,kind:'saved',savedIdx:idx}:null;
  }
  const t=cupState?.teams.find(x=>x.id===ref);if(!t)return null;
  if(t.cupNPCIdx!==undefined){const npc=_npcById(t.cupNPCIdx);return npc?{ref:npc,kind:'npc'}:null;}
  if(t.isSaved){
    const idx=_resolveSavedIdx(t);if(idx<0)return null;
    if(t.savedIdx!==idx)t.savedIdx=idx; // auto-réparation
    if(t.savedUid==null)t.savedUid=_ensureSavedUid(idx); // migration douce des anciennes coupes
    const st=savedTeams[idx];
    return st?{ref:st,kind:'saved',savedIdx:idx}:null;
  }
  return null;
}
function _cteCommit(ref){
  const r=_cteRef(ref);if(!r?.ref)return;
  if(r.kind==='npc')saveCupNPCPool();else persistSavedTeams();
  if(typeof ref==='number'){
    const t=cupState?.teams.find(x=>x.id===ref);
    if(t){t.name=r.ref.name;t.color=r.ref.color;saveCup();}
  }
}

function openSavedTeamRoster(savedIdx){ openCupTeamRoster('saved:'+savedIdx); }

function cteDeleteSavedTeam(savedIdx){
  const st=savedTeams[savedIdx];if(!st)return;
  const uid=st._uid;
  const inUse=uid&&cupState?.teams?.some(t=>t.isSaved&&t.savedUid===uid);
  const warn=inUse?' ⚠️ Cette équipe est utilisée dans la coupe en cours — elle deviendra "Introuvable" et pourra être remplacée via 🔁.':'';
  _confirmDialog('Supprimer définitivement « '+st.name+' » du roster ?'+warn,()=>{
    savedTeams.splice(savedIdx,1);
    persistSavedTeams();
    logEvent('🗑 '+st.name+' supprimée du roster.','#e06060');
    // Rafraîchir la vue courante (setup de coupe ou liste d'équipes de coupe)
    if(document.getElementById('cup-setup-main'))renderCupSetup(document.getElementById('cup-out'));
    else if(document.getElementById('cte-list-body'))renderCupTeamList();
  });
}

function openCupTeamRoster(ref){
  const isDirect=typeof ref==='string'&&ref.startsWith('saved:');
  if(!isDirect){
    const t=cupState?.teams.find(x=>x.id===ref);if(!t)return;
    if(t.isUser){logEvent('Cette équipe se modifie via l\'éditeur principal (onglet Effectif).','#888');return;}
  }
  _cteMaterialize(ref);
  const r=_cteRef(ref);if(!r){logEvent('❌ Impossible de charger cette équipe.','#e02030');return;}
  const T=r.ref;
  T.bench=T.bench||[];T.reserves=T.reserves||[];
  const refJS=JSON.stringify(ref);
  const backCall=isDirect?"renderCupSetup(document.getElementById('cup-out'))":"renderCupTeamList()";
  document.getElementById('mttl').textContent='✏️ '+T.name;
  const mcnt=document.getElementById('mcnt');if(!mcnt)return;
  mcnt.innerHTML=`
    <div style="display:flex;gap:6px;margin-bottom:8px">
      <button class="btn" style="font-size:10px;flex:1" onclick="${backCall}">← Retour</button>
      <button class="btn" style="font-size:10px;color:#69f0ae;border-color:#69f0ae55" onclick='exportCurrentCupEditTeam(${refJS})' title="Exporter cette équipe en fichier JSON">📤 Export JSON</button>
    </div>
    <div style="background:var(--panel);border-radius:10px;padding:10px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div>
          <div id="cte-badge" onclick="document.getElementById('cte-team-img').click()" style="width:52px;height:52px;border-radius:50%;border:3px solid ${T.color};background:${T.color}22;cursor:pointer;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:${T.color}">
            ${T.img?`<img src="${T.img}" style="width:100%;height:100%;object-fit:cover">`:teamIni(T.name)}
          </div>
          <input type="file" id="cte-team-img" accept="image/*" style="display:none" onchange="cteTeamImg(event,${refJS})">
          <div style="font-size:7px;color:var(--muted);text-align:center;margin-top:2px">📷 Logo</div>
        </div>
        <div style="flex:1">
          <input class="inp" value="${T.name}" placeholder="Nom équipe" style="font-size:13px;font-weight:800;margin-bottom:5px;width:100%;box-sizing:border-box" onchange="cteFieldLive(${refJS},'name',this.value)">
          <div style="display:flex;gap:6px;align-items:center">
            <input type="color" value="${T.color}" style="width:30px;height:26px;border:none;background:none;cursor:pointer;border-radius:4px" oninput="cteColorLive(${refJS},this.value)">
            <select class="inp" style="flex:1" onchange="cteFieldLive(${refJS},'strat',this.value)">
              ${STRATS.map(s=>`<option value="${s.id}"${(T.strat||'321')===s.id?' selected':''}>${s.n}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:6px 8px;background:var(--card);border-radius:6px">
        <span style="font-size:10px;color:var(--muted);white-space:nowrap">Niveau global</span>
        <input type="range" min="1" max="99" value="60" id="cte-ovr-sl" oninput="document.getElementById('cte-ovr-val').textContent=this.value" style="flex:1">
        <span id="cte-ovr-val" style="font-size:12px;font-weight:900;color:#f0c028;min-width:24px;text-align:center">60</span>
        <button onclick="cteApplyOVR(${refJS})" style="background:#f0c02820;border:1px solid #f0c02844;color:#f0c028;border-radius:5px;padding:2px 8px;cursor:pointer;font-size:10px">Appliquer</button>
      </div>
      <div style="font-size:9px;font-weight:700;letter-spacing:1px;color:${T.color};text-transform:uppercase;margin-bottom:4px">⚽ Titulaires (${T.players.length})</div>
      ${T.players.map((p,pi)=>_cteCard(p,'players',pi,ref,T.color)).join('')}
      <div style="display:flex;justify-content:space-between;align-items:center;margin:10px 0 4px">
        <div style="font-size:9px;font-weight:700;letter-spacing:1px;color:var(--muted);text-transform:uppercase">🔄 Remplaçants (${T.bench.length})</div>
        <button class="btn" style="padding:2px 8px;font-size:10px" onclick="cteAddPlayer(${refJS},'bench')">＋ Ajouter</button>
      </div>
      ${T.bench.map((p,pi)=>_cteCard(p,'bench',pi,ref,T.color)).join('')||'<div style="font-size:10px;color:var(--muted);padding:4px 0 6px">Aucun remplaçant.</div>'}
      <div style="display:flex;justify-content:space-between;align-items:center;margin:10px 0 4px">
        <div style="font-size:9px;font-weight:700;letter-spacing:1px;color:var(--muted);text-transform:uppercase">📋 Réservistes (${T.reserves.length})</div>
        <button class="btn" style="padding:2px 8px;font-size:10px" onclick="cteAddPlayer(${refJS},'reserves')">＋ Ajouter</button>
      </div>
      ${T.reserves.map((p,pi)=>_cteCard(p,'reserves',pi,ref,T.color)).join('')||'<div style="font-size:10px;color:var(--muted);padding:4px 0 6px">Aucun réserviste.</div>'}
    </div>
    ${isDirect
      ?`<button class="btn btnr" style="width:100%;justify-content:center;margin-top:10px;font-size:10px" onclick="cteDeleteSavedTeam(${r.savedIdx})">🗑 Supprimer cette équipe du roster</button>`
      :`<button class="btn" style="width:100%;justify-content:center;margin-top:10px;font-size:10px" onclick="openCupTeamReplace(${refJS})">🔁 Remplacer toute l'équipe (roster / JSON)</button>`}`;
}

function _cteCard(p,src,pi,ref,color){
  const ovr=_playerOvr(p);
  const ovrCol=ovr>=75?'#18c860':ovr>=60?'#f0c028':'#e06060';
  const srcArg=src==='players'?'player':src==='bench'?'bench':'reserve';
  const refJS=JSON.stringify(ref);
  return `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;background:var(--card);border:1px solid var(--b1);margin-bottom:5px">
    <div style="width:34px;height:34px;border-radius:50%;border:2px solid ${color}66;background:${color}18;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:${color};flex-shrink:0">
      ${p.img?`<img src="${p.img}" style="width:100%;height:100%;object-fit:cover">`:(p.ini||'?')}
    </div>
    <div style="flex:1;min-width:0">
      <div style="font-size:12px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
      <div style="font-size:9px;color:var(--muted)">${p.pos} · <span style="color:${ovrCol};font-weight:700">OVR ${ovr}</span> · ${(p.spells||[]).length} sort(s)</div>
    </div>
    <button class="btn" style="padding:3px 8px;font-size:10px" onclick="openCupPlayerEditor(${refJS},${pi},'${srcArg}')">✏️</button>
    ${src!=='players'?`<button class="btn btnr" style="padding:3px 6px;font-size:10px" onclick="cteRemovePlayer(${refJS},'${src}',${pi})">✕</button>`:''}
  </div>`;
}

function cteFieldLive(ref,field,v){
  const r=_cteRef(ref);if(!r)return;
  r.ref[field]=v;
  _cteCommit(ref);
}
function cteColorLive(ref,v){
  cteFieldLive(ref,'color',v);
  const b=document.getElementById('cte-badge');
  if(b){b.style.borderColor=v;b.style.color=v;b.style.background=v+'22';}
}
function cteTeamImg(e,ref){
  const f=e.target.files[0];if(!f)return;
  _compressImage(f,160,0.72,dataUrl=>{
    cteFieldLive(ref,'img',dataUrl);
    const b=document.getElementById('cte-badge');
    if(b)b.innerHTML=`<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover">`;
  });
}
function cteApplyOVR(ref){
  const r=_cteRef(ref);if(!r)return;
  const ovr=parseInt(document.getElementById('cte-ovr-sl')?.value||60);
  [...(r.ref.players||[]),...(r.ref.bench||[]),...(r.ref.reserves||[])].forEach(p=>{
    if(p.s)Object.keys(p.s).forEach(k=>p.s[k]=Math.max(1,Math.min(99,ovr+Math.round((Math.random()-.5)*20))));
  });
  _cteCommit(ref);
  openCupTeamRoster(ref);
}
function cteAddPlayer(ref,src){
  const r=_cteRef(ref);if(!r)return;
  const arr=src==='bench'?(r.ref.bench=r.ref.bench||[]):(r.ref.reserves=r.ref.reserves||[]);
  const name=AI_NAMES[Math.floor(Math.random()*AI_NAMES.length)]||'Joueur';
  const p=serializePlayer({id:'cte_'+Date.now()+'_'+Math.floor(Math.random()*9999),name,pos:'MC',
    s:{spd:55,sht:55,def:55,stam:55,tec:55,res:55},spells:['tech'],ini:name.slice(0,2).toUpperCase(),onBench:src==='bench'});
  arr.push(p);
  _cteCommit(ref);
  openCupTeamRoster(ref);
}
function cteRemovePlayer(ref,src,pi){
  const r=_cteRef(ref);if(!r)return;
  const arr=src==='bench'?r.ref.bench:r.ref.reserves;
  if(!arr?.[pi])return;
  _confirmDialog('Retirer « '+(arr[pi].name||'ce joueur')+' » de l\'équipe ?',()=>{
    arr.splice(pi,1);
    _cteCommit(ref);
    openCupTeamRoster(ref);
  });
}

// ── Remplacement complet d'une équipe (roster / JSON) ───────────────────────
function openCupTeamReplace(id){
  _editingCupTeamId=id;
  const t=cupState.teams.find(x=>x.id===id);if(!t)return;
  const el=document.getElementById('cup-team-list');
  if(!el)return;

  const teamData=getCupTeamData(id);
  const name=teamData?.name||t.name;
  const color=teamData?.color||t.color;

  el.innerHTML=`
    <button class="btn" style="margin-bottom:8px;font-size:10px" onclick="renderCupTeamList()">← Retour</button>
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:900;color:${color};margin-bottom:8px">${name}</div>
    ${t.isUser?`<div style="font-size:9px;color:var(--muted);background:var(--card);border:1px solid var(--b1);border-radius:5px;padding:5px 7px;margin-bottom:8px">ℹ️ Remplacer une équipe principale ici ne touche que cette coupe — ton effectif Rouges/Bleus d'origine n'est pas modifié.</div>`:''}

    <div style="display:flex;flex-direction:column;gap:6px">
      <div style="font-size:10px;color:var(--muted);margin-bottom:2px">Remplacer par une équipe :</div>

      <button class="btn btng" style="font-size:11px;justify-content:center"
        onclick="importCupTeamJSON(${id})">
        ⬆ Importer un fichier JSON
      </button>

      ${_cupNPCPool.length?`
      <div style="font-size:10px;color:var(--muted);margin:4px 0 2px">Ou choisir un PNJ :</div>
      <div style="max-height:160px;overflow-y:auto">
      ${_cupNPCPool.map((npc,ni)=>`
        <div style="display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:5px;border:1px solid var(--b1);margin-bottom:3px;background:var(--panel);cursor:pointer"
          onclick="replaceCupTeamWithNPC(${id},${ni})">
          <span style="width:8px;height:8px;border-radius:50%;background:${npc.color};flex-shrink:0"></span>
          <span style="font-size:11px;font-weight:700;color:#fff;flex:1">${npc.name} <span style="font-size:8px;color:#8840e0">🤖</span></span>
          <span style="font-size:9px;color:var(--muted)">${(npc.players||[]).length||'~'} joueurs${npc.ovr?' · OVR '+npc.ovr:''}</span>
        </div>`).join('')}
      </div>`:''}

      <div style="font-size:10px;color:var(--muted);margin:4px 0 2px">Ou choisir dans le roster :</div>
      <div style="max-height:200px;overflow-y:auto">
      ${savedTeams.map((s,si)=>`
        <div style="display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:5px;border:1px solid var(--b1);margin-bottom:3px;background:var(--panel);cursor:pointer"
          onclick="replaceCupTeamFromRoster(${id},${si})">
          <span style="width:8px;height:8px;border-radius:50%;background:${s.color};flex-shrink:0"></span>
          <span style="font-size:11px;font-weight:700;color:#fff;flex:1">${s.name}${s.isHuman?' <span style="font-size:8px;color:var(--gold)">👤</span>':''}</span>
          <span style="font-size:9px;color:var(--muted)">${(s.players||[]).length} joueurs · OVR ${_playerOvr({s:_avgStats([...(s.players||[]),...(s.bench||[])])})}</span>
        </div>`).join('')||'<div style="font-size:10px;color:var(--muted)">Aucune équipe dans le roster.</div>'}
      </div>
    </div>`;
}

function importCupTeamJSON(cupId){
  const inp=document.createElement('input');
  inp.type='file'; inp.accept='.json';
  inp.onchange=e=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const d=JSON.parse(ev.target.result);
        const raw=Array.isArray(d)?d[0]:d;
        if(!raw||!raw.name||!raw.players){ logEvent('❌ JSON invalide.','#ef5350'); return; }
        // Compresser les images de l'équipe importée avant de l'enregistrer,
        // pour éviter de saturer le stockage avec des photos non optimisées.
        _compressTeamImages(raw,()=>replaceCupTeamWithData(cupId, raw));
      }catch(err){ logEvent('❌ Erreur JSON : '+err.message,'#ef5350'); }
    };
    reader.readAsText(file);
  };
  inp.click();
}

function replaceCupTeamFromRoster(cupId, rosterIdx){
  const raw=savedTeams[rosterIdx]; if(!raw) return;
  replaceCupTeamWithData(cupId, raw);
}

// Remplace un créneau de coupe par une équipe PNJ du pool, en le LIANT au pool
// (cupNPCIdx) plutôt qu'en copiant les données — ainsi l'équipe reste
// synchronisée avec le gestionnaire "✏️ Équipes PNJ".
function replaceCupTeamWithNPC(cupId, npcPos){
  const t=cupState?.teams.find(x=>x.id===cupId); if(!t) return;
  _ensureNPCIds();
  const npc=_cupNPCPool[npcPos]; if(!npc) return;
  // Générer les joueurs si le PNJ n'a pas encore été matérialisé
  if(!npc.players?.length){const gen=mkCupNPCTeamData(npc,npcPos);npc.players=gen.players;npc.bench=gen.bench;npc.reserves=gen.reserves;saveCupNPCPool();}
  // Nettoyer les anciennes références de ce créneau
  delete t.isUser; delete t.uIdx; delete t.isSaved; delete t.savedIdx; delete t.savedUid; delete t.aIdx;
  t.cupNPCIdx=npc.id;
  t.name=npc.name; t.color=npc.color;
  saveCup();
  logEvent('✅ '+npc.name+' (PNJ) remplace l\'équipe dans la coupe.',npc.color);
  renderCupTeamList();
}

function replaceCupTeamWithData(cupId, raw){
  const t=cupState?.teams.find(x=>x.id===cupId); if(!t) return;
  const normPos=pos=>({'GB':'GB','DC':'DC','DEF':'DC','DD':'DD','DG':'DG','MC':'MC','MDC':'MDC','MID':'MC','MO':'MO','MOG':'MOG','MOD':'MOD','ATT':'ATT','AG':'AG','AD':'AD'}[pos]||'MC');
  const posGrp=pos=>(pos==='GB'?0:['DC','DD','DG'].includes(pos)?1:pos==='ATT'?3:2);
  const rebuild=arr=>(arr||[])
    .map(p=>({...p,pos:normPos(p.pos||'MC')}))
    .sort((a,b)=>posGrp(a.pos)-posGrp(b.pos))
    .map(p=>serializePlayer({...p,s:p.s||{spd:60,sht:60,def:60,stam:60,tec:60,res:60},spells:p.spells||[],ini:p.ini||(p.name||'?').slice(0,2).toUpperCase()}));
  const team={
    name:raw.name, color:raw.color||t.color, img:raw.img||'',
    strat:raw.strat||'321',
    players:rebuild(raw.players), bench:rebuild(raw.bench||[]), reserves:rebuild(raw.reserves||[]),
    isHuman:true
  };
  // Mettre à jour le nom/couleur dans cupState.teams
  t.name=team.name; t.color=team.color;
  // Mettre à jour la source de données
  if(t.isUser){
    // Remplacer une équipe principale (Rouges/Bleus) DANS CETTE COUPE uniquement :
    // on convertit le créneau en équipe sauvegardée dédiée, sans toucher à
    // l'effectif principal teams[uIdx] que le joueur utilise en match normal.
    savedTeams.push(team);
    const idx=savedTeams.length-1;
    persistSavedTeams();
    delete t.isUser; delete t.uIdx;
    t.isSaved=true; t.savedIdx=idx; t.savedUid=_ensureSavedUid(idx);
  }
  else if(t.cupNPCIdx!==undefined){
    // Équipe du pool PNJ de la coupe : mettre à jour l'entrée EN PLACE (même
    // objet référencé par le gestionnaire "✏️ Équipes") pour que les deux
    // icônes d'édition restent parfaitement synchronisées après un import JSON.
    const pos=_npcIdxById(t.cupNPCIdx);
    const prevOvr=pos>=0?_cupNPCPool[pos]?.ovr:null;
    const updated={...team, id:t.cupNPCIdx, ovr:prevOvr!=null?prevOvr:60};
    if(pos>=0)_cupNPCPool[pos]=updated; else _cupNPCPool.push(updated);
    saveCupNPCPool();
  }
  else if(t.isSaved){
    const idx=_resolveSavedIdx(t);
    if(idx>=0){
      team._uid=savedTeams[idx]._uid; // conserve l'identité stable de cette équipe
      savedTeams[idx]=team;
      t.savedIdx=idx;t.savedUid=_ensureSavedUid(idx);
    } else {
      // Référence cassée (équipe supprimée du roster entretemps) : on recrée une entrée
      savedTeams.push(team);
      t.savedIdx=savedTeams.length-1;t.savedUid=_ensureSavedUid(t.savedIdx);
    }
    persistSavedTeams();
  } else {
    // Équipe IA par défaut (aIdx) sans pool — la sauver dans le roster et la lier
    const ri=savedTeams.findIndex(s=>s.name===team.name);
    const idx=ri>=0?(savedTeams[ri]=team,ri):(savedTeams.push(team),savedTeams.length-1);
    persistSavedTeams();
    t.isSaved=true; t.savedIdx=idx; t.savedUid=_ensureSavedUid(idx); t.isUser=false;
    delete t.aIdx;
  }
  saveCup();
  // Vérifier que la nouvelle équipe est bien retrouvable après un rechargement.
  if((t.isSaved||t.savedUid!=null) && _resolveSavedIdx(t)<0){
    logEvent('⚠️ L\'équipe n\'a pas pu être enregistrée durablement (stockage plein ?). Elle risque de disparaître au rechargement.','#e02030');
  }
  logEvent('✅ '+team.name+' remplace l\'équipe dans la coupe.',team.color);
  openCupTeamRoster(cupId); // retour direct à l'édition en profondeur de la nouvelle équipe
}

let _cupNPCPool=[];
// Génère un identifiant stable et unique pour une équipe du pool PNJ.
function _genNPCId(){return 'npc_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
// S'assure que chaque équipe du pool a un identifiant stable. Pour les
// équipes déjà existantes sans id (anciennes sauvegardes), on utilise leur
// position actuelle comme id afin de ne pas casser les références déjà
// stockées dans une coupe en cours ; les futures équipes reçoivent un id
// unique qui ne bougera plus jamais, même si le pool est réordonné/réduit.
function _ensureNPCIds(){
  let changed=false;
  _cupNPCPool.forEach((n,i)=>{ if(n&&n.id===undefined){ n.id=i; changed=true; } });
  if(changed)saveCupNPCPool();
}
function _npcById(id){ return _cupNPCPool.find(n=>n&&n.id===id); }
function _npcIdxById(id){ return _cupNPCPool.findIndex(n=>n&&n.id===id); }
function loadCupNPCPool(){try{_cupNPCPool=JSON.parse(localStorage.getItem('footsim7v7_cupnpc')||'[]');}catch(e){_cupNPCPool=[];}_ensureNPCIds();}
function saveCupNPCPool(){_safeLSSet('footsim7v7_cupnpc',_cupNPCPool);}

// Normalise un code de poste venant d'un import externe
function _normPos(pos){
  return({'GB':'GB','DC':'DC','DEF':'DC','DD':'DD','DG':'DG','MC':'MC','MDC':'MDC','MID':'MC','MO':'MO','MOG':'MOG','MOD':'MOD','ATT':'ATT','AG':'AG','AD':'AD'}[pos]||'MC');
}
function _importedPlayer(p,defStat){
  return serializePlayer({...p,pos:_normPos(p.pos||'MC'),
    s:p.s||{spd:defStat,sht:defStat,def:defStat,stam:defStat,tec:defStat,res:defStat},
    spells:p.spells||[], ini:p.ini||(p.name||'?').slice(0,2).toUpperCase()});
}

// Exporte tout le pool d'équipes PNJ de la coupe dans un seul fichier JSON
function exportNPCPool(){
  if(!_cupNPCPool.length){ logEvent('Aucune équipe PNJ à exporter.','#888'); return; }
  // S'assurer que chaque PNJ a des joueurs générés avant l'export
  _cupNPCPool.forEach((npc,i)=>{
    if(!npc.players?.length){
      const t=mkCupNPCTeamData(npc,i);
      npc.players=t.players;npc.bench=t.bench;npc.reserves=t.reserves;
    }
  });
  saveCupNPCPool();
  const payload=_cupNPCPool.map(npc=>({
    name:npc.name, color:npc.color||'#4fc3f7', img:npc.img||'', strat:npc.strat||'321', ovr:npc.ovr||60,
    players:(npc.players||[]).map(serializePlayer),
    bench:(npc.bench||[]).map(serializePlayer),
    reserves:(npc.reserves||[]).map(serializePlayer)
  }));
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='footsim_pnj_coupe_'+(new Date().toISOString().slice(0,10))+'.json';
  a.click();URL.revokeObjectURL(url);
  logEvent('💾 '+payload.length+' équipe(s) PNJ exportée(s) !','#18c860');
}

// Importe un ou plusieurs PNJ depuis un fichier JSON (accepte un objet seul,
// un tableau d'équipes, ou un export complet contenant cupNPCPool)
function importNPCPool(input){
  const file=input.files?.[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const d=JSON.parse(e.target.result);
      const arr=Array.isArray(d)?d:(Array.isArray(d?.cupNPCPool)?d.cupNPCPool:[d]);
      const valid=arr.filter(raw=>raw&&raw.name&&Array.isArray(raw.players));
      if(!valid.length){ logEvent('❌ JSON invalide : aucune équipe PNJ trouvée.','#e02030'); input.value=''; return; }
      valid.forEach(raw=>{
        const idx=_cupNPCPool.findIndex(n=>n.name===raw.name);
        const npc={
          id:idx>=0?_cupNPCPool[idx].id:_genNPCId(),
          name:raw.name, color:raw.color||'#4fc3f7', img:raw.img||'', strat:raw.strat||'321', ovr:raw.ovr||60,
          players:(raw.players||[]).map(p=>_importedPlayer(p,60)),
          bench:(raw.bench||[]).map(p=>_importedPlayer(p,55)),
          reserves:(raw.reserves||[]).map(p=>_importedPlayer(p,50))
        };
        if(idx>=0)_cupNPCPool[idx]=npc;else _cupNPCPool.push(npc);
      });
      saveCupNPCPool();
      logEvent('✅ '+valid.length+' équipe(s) PNJ importée(s) !','#18c860');
      _renderNPCPage();
    }catch(err){
      logEvent('❌ Erreur JSON : '+err.message,'#e02030');
    }
    input.value=''; // permet de réimporter le même fichier
  };
  reader.readAsText(file);
}

let _editingNPCIdx=null;

function openCupNPCEdit(idx){
  openCupNPCEditor();
  if(idx!==undefined&&idx!==null) npcEdit(idx);
}
function openCupNPCEditor(){
  document.getElementById('mttl').textContent='⚙️ Équipes PNJ Coupe';
  _editingNPCIdx=null;
  _renderNPCPage();
  document.getElementById('pmodal').classList.add('on');
}

// Rendu de la page selon le contexte (_editingNPCIdx null = liste, sinon éditeur)
function _renderNPCPage(){
  const mcnt=document.getElementById('mcnt');
  if(!mcnt)return;
  if(_editingNPCIdx===null) _renderNPCList(mcnt);
  else _renderNPCEditor(mcnt);
}

// ─── PAGE LISTE ──────────────────────────────────────────────────────────────
function _renderNPCList(mcnt){
  const getOvr=npc=>{
    if(!npc.players?.length) return npc.ovr||60;
    const all=[...npc.players,...(npc.bench||[])];
    const avg=all.reduce((s,p)=>{const v=Object.values(p.s||{});return s+(v.length?v.reduce((a,b)=>a+b,0)/v.length:60);},0)/all.length;
    return Math.round(avg);
  };
  const cards=_cupNPCPool.map((npc,i)=>{
    const ovr=getOvr(npc);
    const ovrCol=ovr>=75?'#18c860':ovr>=60?'#f0c028':'#e06060';
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:8px;border:1px solid ${npc.color}33;background:linear-gradient(90deg,${npc.color}15,var(--panel));margin-bottom:5px">
      <div onclick="npcEdit(${i})" style="width:38px;height:38px;border-radius:50%;border:2px solid ${npc.color};background:${npc.color}22;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;color:${npc.color};cursor:pointer;flex-shrink:0">
        ${npc.img?`<img src="${npc.img}" style="width:100%;height:100%;object-fit:cover">`:`${teamIni(npc.name)}`}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${npc.name}</div>
        <div style="font-size:9px;color:var(--muted)">${npc.strat||'321'} · <span style="color:${ovrCol};font-weight:700">OVR ${ovr}</span> · ${npc.players?.length||0}j</div>
      </div>
      <button onclick="npcEdit(${i})" style="background:${npc.color}22;border:1px solid ${npc.color}55;color:#fff;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:11px">✏️</button>
      <button onclick="npcSaveToTeams(${i})" style="background:var(--card);border:1px solid var(--b2);color:#69f0ae;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:11px" title="→ Mes Équipes">💾</button>
      <button onclick="npcDuplicate(${i})" style="background:var(--card);border:1px solid var(--b2);color:var(--muted);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:11px" title="Dupliquer">⧉</button>
      <button onclick="npcDelete(${i})" style="background:transparent;border:1px solid #e0606044;color:#e06060;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:11px">✕</button>
    </div>`;
  }).join('');

  mcnt.innerHTML=`
    ${_cupNPCPool.length?cards:`<div style="text-align:center;color:var(--muted);font-size:11px;padding:20px 12px;border:1px dashed var(--b1);border-radius:8px;margin-bottom:8px">Aucune équipe PNJ.<br><span style="font-size:9px">Les équipes par défaut seront utilisées.</span></div>`}
    <button class="btn btng" style="width:100%;justify-content:center;margin-top:4px" onclick="npcAdd()">＋ Nouvelle équipe PNJ</button>
    <div style="margin-top:6px;display:flex;gap:6px">
      <button class="btn" style="flex:1;justify-content:center;font-size:10px" onclick="exportNPCPool()">⬇ Export JSON</button>
      <label class="btn" style="flex:1;justify-content:center;font-size:10px;cursor:pointer">⬆ Import JSON<input type="file" accept=".json" style="display:none" onchange="importNPCPool(this)"></label>
    </div>`;
}

function mkCupNPCTeamData(npc, i){
  const base = npc.ovr || 60;
  const tid = `npc${i}`;
  const names = [...AI_NAMES].sort(()=>Math.random()-.5);
  const sc = () => Math.max(20, Math.min(99, base + ~~((Math.random()-.5)*20)));
  const mkP = (pos, idx, suffix) => ({
    id:`${tid}_${suffix}_${idx}`, name:names[idx%AI_NAMES.length]||'PNJ', pos,
    ini:(names[idx%AI_NAMES.length]||'PJ').slice(0,2).toUpperCase(), img:'',
    s:{spd:sc(),sht:sc(),def:sc(),stam:sc(),tec:sc(),res:sc()},
    spells:['tech'],
    x:0,y:0,vx:0,vy:0,tx:0,ty:0,hp:100,mp:100,yc:0,red:false,stunT:0,hasBall:false,
    injLevel:0,injT:0,mG:0,mSh:0,mTk:0,mSp:0,_img:null,
    _hm:(()=>{const r=(Math.random()+Math.random()-1)*10;return Math.round(Math.max(-10,Math.min(10,r)));})(),
    _fm:(()=>{const r=(Math.random()+Math.random()-1)*10;return Math.round(Math.max(-10,Math.min(10,r)));})(),
    _spdDebuff:0,_charmed:0,_atkBuff:0,_pacified:0,_invis:0,_folie:0,_aile:0,_sixsens:0,_sylvestre:0,_dragon:0,
    bobPhase:Math.random()*Math.PI*2,wPhaseX:Math.random()*Math.PI*2,wPhaseY:Math.random()*Math.PI*2,wSpeed:1.4+Math.random()*1.2,
    runT:0,runTx:0,runTy:0,runCool:Math.random()*2,dribCurve:0,tackleCool:0
  });
  const players = ROLE.map((pos,idx)=>mkP(pos,idx,'p'));
  const bench = ['MC','ATT','DC','DD','MC'].map((pos,idx)=>({...mkP(pos,idx+7,'b'),onBench:true}));
  const reserves = ['GB','DC','ATT'].map((pos,idx)=>mkP(pos,idx+12,'r'));
  return {players, bench, reserves};
}
function npcEdit(i){_editingNPCIdx=i;const npc=_cupNPCPool[i];if(!npc.players?.length){const t=mkCupNPCTeamData(npc,i);npc.players=t.players;npc.bench=t.bench;npc.reserves=t.reserves;saveCupNPCPool();}document.getElementById('mttl').textContent='✏️ '+npc.name;_renderNPCPage();}
function npcAdd(){_cupNPCPool.push({id:_genNPCId(),name:'Nouveau Club',color:'#4fc3f7',strat:'321',ovr:60,players:[],bench:[],reserves:[]});saveCupNPCPool();npcEdit(_cupNPCPool.length-1);}
// Détails d'une équipe du classement (ligue ou coupe) : buts marqués/pris,
// moyennes, forme récente, position. scope = 'league' | 'cup'.
function showStandingDetail(scope, teamId, groupIdx){
  let std, teamObj, fixtures, rankArr, groupName='';
  if(scope==='league'){
    std=leagueState?.standings.find(s=>s.id===teamId);
    teamObj=leagueState?.teams.find(t=>t.id===teamId);
    fixtures=leagueState?.fixtures||[];
    rankArr=[...(leagueState?.standings||[])].sort((a,b)=>b.Pts-a.Pts||(b.GF-b.GA)-(a.GF-a.GA)||b.GF-a.GF);
  } else {
    const g=cupState?.groups?.[groupIdx];
    std=g?.standings.find(s=>s.id===teamId);
    teamObj=cupState?.teams.find(t=>t.id===teamId);
    fixtures=g?.fixtures||[];
    rankArr=sortStd(g?.standings||[]);
    groupName=g?.name||'';
  }
  if(!std||!teamObj)return;
  const rank=rankArr.findIndex(s=>s.id===teamId)+1;
  const gd=std.GF-std.GA;
  const avgGF=std.P?(std.GF/std.P):0, avgGA=std.P?(std.GA/std.P):0;
  const winPct=std.P?Math.round(std.W/std.P*100):0;
  // Forme récente (5 derniers matchs joués)
  const teamFix=fixtures.filter(f=>f.played&&(f.home===teamId||f.away===teamId)).slice(-5);
  const form=teamFix.map(f=>{
    const isHome=f.home===teamId;const gs=isHome?f.sh:f.sa,gc=isHome?f.sa:f.sh;
    if(gs>gc)return '<span style="color:var(--green);font-weight:900">V</span>';
    if(gs<gc)return '<span style="color:var(--red);font-weight:900">D</span>';
    return '<span style="color:var(--muted);font-weight:900">N</span>';
  }).join(' ')||'<span style="color:var(--muted)">—</span>';

  const old=document.getElementById('_standDetail');if(old)old.remove();
  const ov=document.createElement('div');
  ov.id='_standDetail';
  ov.style.cssText='position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.65);backdrop-filter:blur(3px)';
  const stat=(label,val,col)=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06)">
    <span style="font-size:11px;color:var(--muted)">${label}</span>
    <span style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:900;color:${col||'#fff'}">${val}</span></div>`;
  ov.innerHTML=`<div style="background:#0d1e2e;border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:0;max-width:320px;width:92%;box-shadow:0 8px 40px #000b;overflow:hidden">
    <div style="background:linear-gradient(135deg,${teamObj.color}33,transparent);padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.1);display:flex;align-items:center;gap:10px">
      <span style="width:14px;height:14px;border-radius:50%;background:${teamObj.color};flex-shrink:0;box-shadow:0 0 10px ${teamObj.color}88"></span>
      <div style="flex:1;min-width:0">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${teamObj.name}</div>
        <div style="font-size:9px;color:var(--muted)">${rank}${rank===1?'ᵉʳ':'ᵉ'} ${groupName?'· '+groupName:'au classement'}</div>
      </div>
      <div style="text-align:center">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:900;color:var(--gold);line-height:1">${std.Pts}</div>
        <div style="font-size:8px;color:var(--muted);letter-spacing:1px">POINTS</div>
      </div>
    </div>
    <div style="padding:12px 18px 8px">
      <div style="display:flex;gap:6px;margin-bottom:10px">
        <div style="flex:1;text-align:center;background:rgba(24,200,96,.1);border-radius:7px;padding:6px"><div style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;color:var(--green)">${std.W}</div><div style="font-size:8px;color:var(--muted)">VICTOIRES</div></div>
        <div style="flex:1;text-align:center;background:rgba(255,255,255,.05);border-radius:7px;padding:6px"><div style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;color:var(--muted)">${std.D}</div><div style="font-size:8px;color:var(--muted)">NULS</div></div>
        <div style="flex:1;text-align:center;background:rgba(224,64,64,.1);border-radius:7px;padding:6px"><div style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;color:var(--red)">${std.L}</div><div style="font-size:8px;color:var(--muted)">DÉFAITES</div></div>
      </div>
      ${stat('Matchs joués', std.P)}
      ${stat('⚽ Buts marqués', std.GF, 'var(--green)')}
      ${stat('🥅 Buts encaissés', std.GA, 'var(--red)')}
      ${stat('Différence de buts', (gd>0?'+':'')+gd, gd>0?'var(--green)':gd<0?'var(--red)':'#fff')}
      ${stat('Moyenne buts marqués', avgGF.toFixed(2))}
      ${stat('Moyenne buts encaissés', avgGA.toFixed(2))}
      ${stat('% de victoires', winPct+'%')}
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0 4px">
        <span style="font-size:11px;color:var(--muted)">Forme (5 derniers)</span>
        <span style="font-size:13px;letter-spacing:2px">${form}</span>
      </div>
    </div>
    <div style="padding:0 18px 14px">
      <button id="_standClose" style="width:100%;padding:9px;border-radius:8px;border:none;background:${teamObj.color};color:#fff;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;letter-spacing:1px;cursor:pointer">Fermer</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  const close=()=>ov.remove();
  ov.onclick=e=>{if(e.target===ov)close();};
  document.getElementById('_standClose').onclick=close;
}

function _confirmDialog(msg, onYes){
  // Remove any existing confirm overlay
  const old=document.getElementById('_confirmOverlay');if(old)old.remove();
  const ov=document.createElement('div');
  ov.id='_confirmOverlay';
  ov.style.cssText='position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);backdrop-filter:blur(2px)';
  ov.innerHTML=`<div style="background:#0d1e2e;border:1px solid rgba(255,255,255,.18);border-radius:12px;padding:20px 22px;max-width:300px;width:90%;box-shadow:0 8px 32px #000a">
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;color:#c8dff5;margin-bottom:16px;line-height:1.4">${msg}</div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button id="_confirmNo" style="padding:6px 16px;border-radius:6px;border:1px solid rgba(255,255,255,.14);background:transparent;color:#c8dff5;font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;letter-spacing:.5px;cursor:pointer">Annuler</button>
      <button id="_confirmYes" style="padding:6px 16px;border-radius:6px;border:none;background:#e02030;color:#fff;font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;letter-spacing:.5px;cursor:pointer">Supprimer</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  const close=()=>ov.remove();
  const _cn=document.getElementById('_confirmNo');if(_cn)_cn.onclick=close;
  ov.onclick=e=>{if(e.target===ov)close();};
  const _cy=document.getElementById('_confirmYes');if(_cy)_cy.onclick=()=>{close();onYes();};
}
function npcDelete(i){_confirmDialog(`Supprimer « ${_cupNPCPool[i]?.name||'cette équipe'} » ?`,()=>{_cupNPCPool.splice(i,1);saveCupNPCPool();_renderNPCPage();});}
function npcDuplicate(i){const clone=JSON.parse(JSON.stringify(_cupNPCPool[i]));clone.id=_genNPCId();clone.name+=' (copie)';_cupNPCPool.push(clone);saveCupNPCPool();_renderNPCPage();}
function exportNPCasSaved(i){
  const npc=_cupNPCPool[i];
  if(!npc)return;
  // Ensure the NPC has players generated
  if(!npc.players?.length){
    const t=mkCupNPCTeamData(npc,i);
    npc.players=t.players;npc.bench=t.bench;npc.reserves=t.reserves;
    saveCupNPCPool();
  }
  const s={
    name:npc.name,
    color:npc.color||'#4fc3f7',
    img:npc.img||'',
    strat:npc.strat||'321',
    players:(npc.players||[]).map(serializePlayer),
    bench:(npc.bench||[]).map(serializePlayer),
    reserves:(npc.reserves||[]).map(serializePlayer),
    isHuman:false
  };
  const idx=savedTeams.findIndex(t=>t.name===s.name);
  if(idx>=0){savedTeams[idx]={...s,isHuman:savedTeams[idx].isHuman};}
  else{savedTeams.push(s);}
  persistSavedTeams();
  logEvent(`💾 PNJ "${npc.name}" ajouté au registre !`,npc.color||'#69f0ae');
}
function npcSaveToTeams(i){exportNPCasSaved(i);}
function npcBack(){_editingNPCIdx=null;document.getElementById('mttl').textContent='⚙️ Équipes PNJ Coupe';_renderNPCPage();}

// ─── PAGE ÉDITEUR ─────────────────────────────────────────────────────────────
function _renderNPCEditor(mcnt){
  const i=_editingNPCIdx;
  const npc=_cupNPCPool[i];
  if(!npc){npcBack();return;}
  const getOvr=p=>{const v=Object.values(p.s||{});return v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length):50;};

  const mkPCard=(p,src,pi)=>{
    const ovr=getOvr(p);
    const ovrCol=ovr>=75?'#18c860':ovr>=60?'#f0c028':'#e06060';
    const imgId=`npci-${src}-${pi}`;
    const statLabels={sht:'⚽ Tir',def:'🛡 Déf',spd:'💨 Vit',tec:'🎯 Tec',stam:'❤️ End'};
    const statsHTML=Object.entries(statLabels).map(([k,lbl])=>{
      const v=p.s?.[k]||50;
      const col=v>=75?'#18c860':v>=55?'#f0c028':'#e06060';
      return `<div style="display:flex;align-items:center;gap:5px;margin-bottom:3px">
        <span style="font-size:8px;color:var(--muted);width:46px;flex-shrink:0">${lbl}</span>
        <input type="range" min="1" max="99" value="${v}" style="flex:1;accent-color:${col}" oninput="npcStatLive(${i},'${src}',${pi},'${k}',+this.value,this)">
        <span style="font-size:9px;font-weight:700;color:${col};width:22px;text-align:right">${v}</span>
      </div>`;
    }).join('');
    const spellsHTML=SPELLS.map(sp=>{
      const has=(p.spells||[]).includes(sp.id);
      return `<span onclick="npcSpellLive(${i},'${src}',${pi},'${sp.id}',this)" style="display:inline-block;padding:1px 5px;border-radius:4px;font-size:8px;font-weight:700;cursor:pointer;margin:1px;background:${has?sp.col+'33':'var(--dark)'};border:1px solid ${has?sp.col+'88':'var(--b2)'};color:${has?sp.col:'var(--muted)'}">${sp.n}</span>`;
    }).join('');
    return `<div style="border-radius:8px;background:var(--card);border:1px solid var(--b1);margin-bottom:5px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:8px;padding:6px 8px">
        <div onclick="document.getElementById('${imgId}').click()" style="width:32px;height:32px;border-radius:50%;border:2px solid ${npc.color}66;background:${npc.color}18;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:${npc.color};cursor:pointer;flex-shrink:0">
          ${p.img?`<img src="${p.img}" style="width:100%;height:100%;object-fit:cover">`:`${p.ini||'?'}`}
        </div>
        <input type="file" id="${imgId}" accept="image/*" style="display:none" onchange="npcPlayerImg(event,${i},'${src}',${pi})">
        <input value="${p.name||''}" style="flex:1;background:var(--dark);border:1px solid var(--b2);border-radius:4px;color:#fff;font-size:11px;font-weight:700;padding:2px 5px" onchange="npcNameLive(${i},'${src}',${pi},this.value)">
        <select style="background:var(--dark);border:1px solid var(--b2);border-radius:4px;color:var(--muted);font-size:9px;padding:1px" onchange="npcPosLive(${i},'${src}',${pi},this.value)">
          ${['GB','DC','DD','DG','MDC','MC','MO','ATT','AG','AD'].map(pos=>`<option${p.pos===pos?' selected':''}>${pos}</option>`).join('')}
        </select>
        <span style="font-size:9px;font-weight:900;color:${ovrCol};background:${ovrCol}22;border-radius:3px;padding:0 4px">${ovr}</span>
        <button onclick="npcCopyStats(${i},'${src}',${pi})" title="Copier les stats" style="background:none;border:1px solid var(--b2);color:var(--muted);border-radius:4px;padding:1px 5px;cursor:pointer;font-size:10px;flex-shrink:0">📋</button>
        <button onclick="npcPasteStats(${i},'${src}',${pi})" title="Coller les stats copiées" class="npc-paste-btn" ${_copiedStats?'':'disabled'} style="background:none;border:1px solid var(--b2);color:${_copiedStats?'var(--muted)':'#334'};border-radius:4px;padding:1px 5px;cursor:${_copiedStats?'pointer':'not-allowed'};font-size:10px;flex-shrink:0;opacity:${_copiedStats?'1':'.4'}">📥</button>
        <button onclick="const d=this.parentElement.nextElementSibling;d.style.display=d.style.display==='none'?'block':'none';this.textContent=this.textContent==='▼'?'▲':'▼'" style="background:none;border:1px solid var(--b2);color:var(--muted);border-radius:4px;padding:1px 5px;cursor:pointer;font-size:10px;flex-shrink:0">▼</button>
      </div>
      <div style="display:none;padding:8px;border-top:1px solid var(--b1)">
        ${statsHTML}
        <div style="font-size:8px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin:6px 0 3px">Sorts</div>
        <div style="display:flex;flex-wrap:wrap;gap:1px">${spellsHTML}</div>
      </div>
    </div>`;
  };

  const mkSection=(label,arr,src)=>arr.length?`
    <div style="font-size:9px;font-weight:700;letter-spacing:1px;color:var(--muted);text-transform:uppercase;margin:10px 0 4px">${label} (${arr.length})</div>
    ${arr.map((p,pi)=>mkPCard(p,src,pi)).join('')}`:'';

  mcnt.innerHTML=`<div style="background:var(--panel);border-radius:10px;padding:10px">
    <!-- Bouton retour -->
    <button onclick="npcBack()" style="background:var(--card);border:1px solid var(--b2);color:var(--muted);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px;margin-bottom:10px">← Retour</button>
    <!-- Logo + nom + couleur + tactique -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <div>
        <div id="npc-badge" onclick="document.getElementById('npc-team-img').click()" style="width:52px;height:52px;border-radius:50%;border:3px solid ${npc.color};background:${npc.color}22;cursor:pointer;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:${npc.color}">
          ${npc.img?`<img src="${npc.img}" style="width:100%;height:100%;object-fit:cover">`:`${teamIni(npc.name)}`}
        </div>
        <input type="file" id="npc-team-img" accept="image/*" style="display:none" onchange="npcTeamImg(event,${i})">
        <div style="font-size:7px;color:var(--muted);text-align:center;margin-top:2px">📷 Logo</div>
      </div>
      <div style="flex:1">
        <input id="npc-name" class="inp" value="${npc.name}" placeholder="Nom équipe" style="font-size:13px;font-weight:800;margin-bottom:5px;width:100%;box-sizing:border-box" oninput="npcFieldLive(${i},'name',this.value)">
        <div style="display:flex;gap:6px;align-items:center">
          <input type="color" value="${npc.color}" style="width:30px;height:26px;border:none;background:none;cursor:pointer;border-radius:4px" oninput="npcColorLive(${i},this.value)">
          <select class="inp" style="flex:1" onchange="npcFieldLive(${i},'strat',this.value)">
            ${STRATS.map(s=>`<option value="${s.id}"${(npc.strat||'321')===s.id?' selected':''}>${s.n}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
    <!-- OVR global -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:6px 8px;background:var(--card);border-radius:6px">
      <span style="font-size:10px;color:var(--muted);white-space:nowrap">Niveau global</span>
      <input type="range" min="1" max="99" value="${npc.ovr||60}" id="npc-ovr-sl" oninput="document.getElementById('npc-ovr-val').textContent=this.value" style="flex:1">
      <span id="npc-ovr-val" style="font-size:12px;font-weight:900;color:#f0c028;min-width:24px;text-align:center">${npc.ovr||60}</span>
      <button onclick="npcApplyOVR(${i})" style="background:#f0c02820;border:1px solid #f0c02844;color:#f0c028;border-radius:5px;padding:2px 8px;cursor:pointer;font-size:10px">Appliquer</button>
    </div>
    <!-- Actions -->
    <div style="display:flex;gap:5px;margin-bottom:10px">
      <button onclick="npcSave(${i})" style="flex:1;background:var(--green,#18c860);border:none;color:#000;border-radius:6px;padding:7px;cursor:pointer;font-size:11px;font-weight:800">✓ Sauvegarder</button>
      <button onclick="npcSaveToTeams(${i})" style="flex:1;background:var(--card);border:1px solid #69f0ae44;color:#69f0ae;border-radius:6px;padding:7px;cursor:pointer;font-size:11px">💾 → Mes équipes</button>
    </div>
    <!-- Joueurs -->
    <div style="font-size:9px;font-weight:700;letter-spacing:1px;color:${npc.color};text-transform:uppercase;margin-bottom:4px">⚽ Titulaires (${npc.players.length})</div>
    ${npc.players.map((p,pi)=>mkPCard(p,'players',pi)).join('')}
    ${mkSection('🔄 Remplaçants',npc.bench||[],'bench')}
    ${mkSection('📋 Réservistes',npc.reserves||[],'reserves')}
  </div>`;
}

// ─── LIVE UPDATES (modifient _cupNPCPool directement et sauvegardent) ─────────
function _npcArr(i,src){
  const n=_cupNPCPool[i];if(!n)return null;
  if(src==='bench'){if(!n.bench)n.bench=[];return n.bench;}
  if(src==='reserves'){if(!n.reserves)n.reserves=[];return n.reserves;}
  if(!n.players)n.players=[];return n.players;
}
function npcStatLive(i,src,pi,k,v,slider){
  const arr=_npcArr(i,src);if(!arr?.[pi]?.s)return;
  arr[pi].s[k]=Math.max(1,Math.min(99,v));
  saveCupNPCPool();
  if(!slider)return;
  const col=v>=75?'#18c860':v>=55?'#f0c028':'#e06060';
  try{slider.style.setProperty('accent-color',col);}catch(e){}
  const span=slider.nextElementSibling;if(span){span.textContent=v;span.style.color=col;}
}
function npcSpellLive(i,src,pi,spId,el){
  const arr=_npcArr(i,src);const p=arr?.[pi];if(!p)return;
  if(!p.spells)p.spells=[];
  const idx=p.spells.indexOf(spId);const sp=SPELLS.find(s=>s.id===spId);
  if(idx>=0){p.spells.splice(idx,1);el.style.background='var(--dark)';el.style.borderColor='var(--b2)';el.style.color='var(--muted)';}
  else{p.spells.push(spId);if(sp){el.style.background=sp.col+'33';el.style.borderColor=sp.col+'88';el.style.color=sp.col;}}
  saveCupNPCPool();
}
function npcNameLive(i,src,pi,v){const arr=_npcArr(i,src);if(arr?.[pi])arr[pi].name=v;saveCupNPCPool();}
function npcPosLive(i,src,pi,v){const arr=_npcArr(i,src);if(arr?.[pi])arr[pi].pos=v;saveCupNPCPool();}
function npcCopyStats(i,src,pi){
  const arr=_npcArr(i,src);const p=arr?.[pi];if(!p?.s)return;
  _copiedStats={...p.s};
  document.querySelectorAll('.npc-paste-btn').forEach(btn=>{
    btn.disabled=false;btn.style.opacity='1';btn.style.cursor='pointer';btn.style.color='var(--muted)';
  });
}
function npcPasteStats(i,src,pi){
  if(!_copiedStats)return;
  const arr=_npcArr(i,src);const p=arr?.[pi];if(!p)return;
  if(!p.s)p.s={};
  Object.entries(_copiedStats).forEach(([k,v])=>{p.s[k]=v;});
  saveCupNPCPool();
  _renderNPCEditor(document.getElementById('mcnt'));
}
function npcFieldLive(i,field,v){if(_cupNPCPool[i])_cupNPCPool[i][field]=v;saveCupNPCPool();}
function npcColorLive(i,col){
  if(!_cupNPCPool[i])return;
  _cupNPCPool[i].color=col;saveCupNPCPool();
  const b=document.getElementById('npc-badge');
  if(b){b.style.borderColor=col;b.style.color=col;b.style.background=col+'22';}
}
function npcTeamImg(e,i){
  const f=e.target.files[0];if(!f)return;
  _compressImage(f,160,0.72,dataUrl=>{
    _cupNPCPool[i].img=dataUrl;saveCupNPCPool();
    const b=document.getElementById('npc-badge');if(b)b.innerHTML=`<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover">`;
  });
}
function npcPlayerImg(e,i,src,pi){
  const f=e.target.files[0];if(!f)return;
  _compressImage(f,120,0.72,dataUrl=>{
    const arr=_npcArr(i,src);if(arr?.[pi])arr[pi].img=dataUrl;saveCupNPCPool();
    const imgId=`npci-${src}-${pi}`;const el=document.getElementById(imgId);
    if(el?.previousElementSibling)el.previousElementSibling.innerHTML=`<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover">`;
  });
}
function npcApplyOVR(i){
  const npc=_cupNPCPool[i];if(!npc)return;
  const ovr=parseInt(document.getElementById('npc-ovr-sl')?.value||60);
  npc.ovr=ovr;
  [...(npc.players||[]),...(npc.bench||[]),...(npc.reserves||[])].forEach(p=>{
    if(p.s)Object.keys(p.s).forEach(k=>p.s[k]=Math.max(1,Math.min(99,ovr+Math.round((Math.random()-.5)*20))));
  });
  saveCupNPCPool();
  _renderNPCPage();// refresh l'affichage avec nouvelles valeurs
}
function npcSave(i){
  // Lit les champs header et sauvegarde tout
  const npc=_cupNPCPool[i];if(!npc)return;
  const nameEl=document.getElementById('npc-name');
  if(nameEl)npc.name=nameEl.value;
  const ovrEl=document.getElementById('npc-ovr-sl');
  if(ovrEl)npc.ovr=parseInt(ovrEl.value);
  saveCupNPCPool();
  // Flash de confirmation
  const btn=document.querySelector('button[onclick*="npcSave("]');
  if(btn){const t=btn.textContent;btn.textContent='✓ Sauvegardé !';setTimeout(()=>btn.textContent=t,1200);}
}

// Compat aliases pour les anciennes refs dans le code
function renderNPCList(){_renderNPCPage();}
function editCupNPC(i){npcEdit(i);}
function addCupNPC(){npcAdd();}
function deleteCupNPC(i){npcDelete(i);}
function duplicateCupNPC(i){npcDuplicate(i);}
function saveEditNPC(){npcBack();}
function handleNPCTeamImg(e){npcTeamImg(e,_editingNPCIdx);}
function handleNPCPlayerImg(e,pi,src){npcPlayerImg(e,_editingNPCIdx,src,pi);}
function npcSetStat(pi,src,k,v){npcStatLive(_editingNPCIdx,src,pi,k,v,null);}
function npcToggleSpell(pi,src,spId,el){npcSpellLive(_editingNPCIdx,src,pi,spId,el);}
function npcUpdateColor(col){npcColorLive(_editingNPCIdx,col);}
function npcSetPlayerName(pi,src,v){npcNameLive(_editingNPCIdx,src,pi,v);}
function npcSetPlayerPos(pi,src,v){npcPosLive(_editingNPCIdx,src,pi,v);}
// npcApplyOVR(i) est la vraie fonction - alias supprimé


function buildCupTeams(count,savedIdxs,npcSel){
  ensureAIData();
  _ensureNPCIds();
  const allT=[
    {id:0,name:teams[0].name,color:teams[0].color,isUser:true,uIdx:0},
    {id:1,name:teams[1].name,color:teams[1].color,isUser:true,uIdx:1},
  ];
  (savedIdxs||[]).forEach(si=>{
    if(allT.length>=count)return;
    const st=savedTeams[si];if(!st)return;
    allT.push({id:allT.length,name:st.name,color:st.color,img:st.img||'',isSaved:true,savedIdx:si,savedUid:_ensureSavedUid(si),isHuman:!!st.isHuman});
  });
  const npcIndices=npcSel!==undefined?npcSel:_cupNPCPool.map((_,i)=>i);
  let ci=0;
  while(allT.length<count){
    if(ci<npcIndices.length){
      const npcIdx=npcIndices[ci];
      const npc=_cupNPCPool[npcIdx];
      if(npc) allT.push({id:allT.length,name:npc.name,color:npc.color,cupNPCIdx:npc.id});
      ci++;
    } else {
      const ai=allT.length-2-(savedIdxs?.length||0)-npcIndices.length;
      if(ai>=AI_TEAM_DEFS.length)break;
      allT.push({id:allT.length,name:AI_TEAM_DEFS[ai].name,color:AI_TEAM_DEFS[ai].color,isUser:false,aIdx:ai});
    }
  }
  return allT;
}

// ═══════════════════════════════════════════════════════════
// EXPORT / IMPORT
// ═══════════════════════════════════════════════════════════