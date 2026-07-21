// ============================================================
// UI_MATCH.JS — extrait de ui.js (scope global partagé)
// Lignes 1–1240 de l'ui.js d'origine.
// ============================================================

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
  _renderHtTeams();
}

// Rend (ou re-rend) le contenu de l'écran mi-temps / pré-match. Extrait pour
// pouvoir le rafraîchir quand on change la formation (les postes des joueurs
// doivent se mettre à jour immédiatement à l'écran).
function _renderHtTeams(){
  const cont=document.getElementById('ht-teams');
  if(!cont) return;
  cont.innerHTML=teams.slice(0,2).map((T,ti)=>`
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
        ${(()=>{
          const phase=_htFormPhase[ti]||'def';
          return `<div class="ht-strat-lbl">Formation
          <span style="float:right;font-weight:400">
            <button onclick="event.stopPropagation();htSetFormPhase(${ti},'def')" id="ffp-def-${ti}" style="font-size:8px;padding:1px 6px;border-radius:6px;border:1px solid var(--b1);cursor:pointer;background:${phase==='def'?'var(--gold)':'var(--dark)'};color:${phase==='def'?'#000':'var(--muted)'};font-weight:700">🛡️ Sans ballon</button>
            <button onclick="event.stopPropagation();htSetFormPhase(${ti},'atk')" id="ffp-atk-${ti}" style="font-size:8px;padding:1px 6px;border-radius:6px;border:1px solid var(--b1);cursor:pointer;background:${phase==='atk'?'#e02030':'var(--dark)'};color:${phase==='atk'?'#fff':'var(--muted)'};font-weight:700">⚽ Avec ballon</button>
          </span>
        </div>
        ${phase==='atk'?`<div style="font-size:8px;color:var(--muted);margin-bottom:4px">Forme adoptée quand ton équipe a le ballon. Laisse identique à "sans ballon" pour désactiver.</div>`:''}`;
        })()}
        ${(()=>{
          const is11=window.gameMode==='11v11', is5=window.gameMode==='5v5';
          const stratList = is11 ? (window.STRATS_11V11||[]) : is5 ? (window.STRATS_5V5||[]) : STRATS;
          const phase = _htFormPhase[ti]||'def';
          const defId = is11 ? (T.strat11||'442') : is5 ? (T.strat5||'121') : (T.strat||'321');
          const atkId = is11 ? T.strat11Atk : is5 ? T.strat5Atk : T.stratAtk;
          const cur = phase==='atk' ? (atkId||defId) : defId;
          return stratList.map(s=>`
          <div class="ht-sc${cur===s.id?' sel':''}" onclick="htSetStrat(${ti},'${s.id}',this)">
            <div style="width:6px;height:6px;border-radius:50%;background:${s.col};flex-shrink:0"></div>
            <span class="ht-sc-n">${s.n}</span>
            <span class="ht-sc-d"> — ${s.d}</span>
          </div>`).join('');
        })()}
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

// Phase de formation en cours d'édition par équipe : 'def' (sans ballon) ou
// 'atk' (avec ballon). Permet d'éditer les deux formations séparément.
const _htFormPhase = {0:'def', 1:'def'};
function htSetFormPhase(ti, phase){
  _htFormPhase[ti] = phase;
  try{ renderHtTeams(); }catch(e){}
}

function htSetStrat(ti,sid,el){
  const phase = _htFormPhase[ti] || 'def';
  const is11 = window.gameMode==='11v11', is5 = window.gameMode==='5v5';
  const defAttr = is11 ? 'strat11' : is5 ? 'strat5' : 'strat';
  const atkAttr = is11 ? 'strat11Atk' : is5 ? 'strat5Atk' : 'stratAtk';
  if(phase==='atk'){
    // Formation AVEC ballon. Si on remet la même que "sans ballon", on
    // désactive la double formation (retour au comportement simple).
    teams[ti][atkAttr] = (sid===teams[ti][defAttr]) ? null : sid;
  } else {
    teams[ti][defAttr] = sid;
  }
  applyFormationRoles(ti); // met à jour posDef/posAtk selon les deux formations
  try{ renderHtTeams(); }catch(e){}
  syncHUD();renderTactics();updateCompoPitch();try{renderTB(0);renderTB(1);}catch(e){}
}

// Rafraîchit toutes les vues après un changement de formation d'une équipe
// principale (postes des joueurs, mini-terrain compo, liste d'équipe, HUD).
function _afterFormationChange(ti){
  try{ applyFormationRoles(ti); }catch(e){}
  try{ if(typeof renderTactics==='function') renderTactics(); }catch(e){}
  try{ if(typeof updateCompoPitch==='function') updateCompoPitch(); }catch(e){}
  try{ if(typeof renderTB==='function'){ renderTB(0); renderTB(1); } }catch(e){}
  try{ if(typeof syncHUD==='function') syncHUD(); }catch(e){}
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
  // Plein écran carrière : cacher le canvas, sidebar = 100%
  const app = document.getElementById('app');
  if(app){
    if(p === 'career'){
      app.classList.add('career-mode');
    } else {
      app.classList.remove('career-mode');
    }
    // Sélection d'équipe en plein écran (masque le canvas, sidebar = 100%).
    if(p === 'teamsel'){ app.classList.add('teamsel-mode'); }
    else { app.classList.remove('teamsel-mode'); }
  }
  // Si aucun profil actif → afficher l'écran de sélection de profil
  if(!activeProfileId && p !== 'profiles'){
    renderProfileScreen();
    return;
  }
  // Close prematch modal if navigating away
  document.getElementById('prematch-modal')?.classList.remove('on');
  if(_leagueUserTeamBackup&&(p==='setup'||p==='tactic')){
    teams[0]=_leagueUserTeamBackup[0];
    teams[1]=_leagueUserTeamBackup[1];
    renderTB(0);renderTB(1);syncHUD();
  }
  document.querySelectorAll('.ntab').forEach((el,i)=>el.classList.toggle('on',['mode','setup','teamsel','tactic','match','stats','league','cup','career','settings'][i]===p));
  document.querySelectorAll('.spage').forEach(el=>el.classList.remove('on'));
  const sp=document.getElementById(`sp-${p}`);if(sp)sp.classList.add('on');
  if(p==='mode')renderModeScreen();
  if(p==='setup'){ renderTB(0); renderTB(1); updateModeBtns(); }
  if(p==='teamsel'){ if(typeof renderTeamSelectPage==='function') renderTeamSelectPage(); }
  if(p==='settings')renderSettings();
  if(p==='stats')renderStats();
  if(p==='tactic'){renderTactics();renderTacSliders(0);renderTacSliders(1);renderPlayerRoles(0);renderPlayerRoles(1);}
  if(p==='league')renderLeague();
  if(p==='cup')renderCup();
  if(p==='career'){ renderCareerV2(); }
  try{ _updateSeasonFooter(); }catch(e){}
}

// ── Pied de sidebar : progression de la saison de carrière ──────────────
// Affiche « SAISON · J<courante>/<total> » + barre de progression. Se base sur
// le nombre de journées de championnat du club joueur dans careerV2.
function _updateSeasonFooter(){
  const foot = document.getElementById('nav-season-footer');
  if(!foot) return;
  const txt  = document.getElementById('nav-season-txt');
  const fill = document.getElementById('nav-season-fill');
  const C = (typeof careerV2!=='undefined') ? careerV2 : null;
  if(!C || !Array.isArray(C.fixtures) || !C.fixtures.length){
    foot.style.display = 'none';
    return;
  }
  // Journées du joueur (championnat) = matchs impliquant le club joueur.
  const mine = C.fixtures.filter(function(f){ return f.homeIsPlayer || f.awayIsPlayer; });
  const total = mine.length || C.fixtures.length;
  const played = mine.filter(function(f){ return f.played; }).length;
  const current = Math.min(total, played + 1);
  const pct = total ? Math.round((played / total) * 100) : 0;
  if(txt)  txt.textContent = 'Saison · J' + current + '/' + total;
  if(fill) fill.style.width = pct + '%';
  foot.style.display = 'block';
}

// ══════════════════════════════════════════════════════════
// ÉCRAN DE SÉLECTION DES MODES DE JEU
// ══════════════════════════════════════════════════════════
function renderModeScreen(){
  const out = document.getElementById('mode-out');
  if(!out) return;
  const modes = [
    {id:'5v5',   n:'5 contre 5',   sub:'Foot à 5 · Futsal',       col:'#8840e0', field:'1 gardien + 4 joueurs', desc:'Format nerveux et rapide. Petits effectifs, beaucoup de duels, scores élevés. Le cœur du jeu en futsal.', icon:'⚡', featured:true, badge:'⚡ RAPIDE', tags:['⏱️ Matchs courts','🔥 Rythme intense','😎 Facile à prendre en main']},
    {id:'7v7',   n:'7 contre 7',   sub:'Format classique',        col:'#f0c028', field:'1 gardien + 6 joueurs', desc:'Le mode historique de FootSim. Équilibre parfait entre tactique et action.', icon:'⚽', featured:true, badge:'⭐ POPULAIRE', tags:['⏱️ Durée moyenne','⚖️ Rythme équilibré','🎯 Le plus joué']},
    {id:'11v11', n:'11 contre 11', sub:'Football à 11',           col:'#18c860', field:'1 gardien + 10 joueurs', desc:'Le vrai football à 11 dans toute sa profondeur. Grandes équipes, formations complètes, jeu de position et 3 changements max.', icon:'🏟️', tags:['⏱️ Matchs longs','🧠 Rythme posé','📈 Plus exigeant']},
  ];
  const cur = window.gameMode || '7v7';
  let h = '<div class="mode-head">Choisis ton mode</div>'
    + '<div class="mode-intro">FootSim se joue avant tout en <b style="color:#8840e0">Futsal 5 contre 5</b> et en <b style="color:#f0c028">7 contre 7</b> — les deux formats phares du jeu, rapides et spectaculaires. Le mode détermine le nombre de joueurs, les formations disponibles et la taille des effectifs ; l\'onglet <b>Équipes</b> s\'adapte automatiquement.</div>';
  modes.forEach(m=>{
    const active = cur===m.id;
    const cls = 'mode-card' + (m.featured?' feat':'') + (active?' sel':'');
    const tags = (m.tags||[]).map(t=>'<span class="mode-tag">'+t+'</span>').join('');
    h += '<div class="'+cls+'" style="--mc:'+m.col+'" onclick="selectGameMode(\''+m.id+'\')">'
      + (m.badge ? '<div class="mode-badge">'+m.badge+'</div>' : '')
      + (active ? '<div class="mode-check">✓</div>' : '')
      + '<div class="mode-row">'
      + '<div class="mode-ico">'+m.icon+'</div>'
      + '<div style="flex:1;min-width:0">'
      + '<div class="mode-title">'+m.n+'</div>'
      + '<div class="mode-sub">'+m.sub+'</div>'
      + '</div></div>'
      + '<div class="mode-desc">'+m.desc+'</div>'
      + '<div class="mode-meta"><span class="mode-tag">👥 '+m.field+'</span>'+tags+'</div>'
      + '</div>';
  });
  h += '<button class="btn btng" style="width:100%;justify-content:center;margin-top:4px;padding:10px;font-size:13px" onclick="nav(\'setup\')">✓ Continuer → Équipes</button>';
  out.innerHTML = h;
}

// Sélectionne un mode depuis l'écran des modes et rafraîchit tout ce qui dépend de la taille des équipes
function selectGameMode(mode){
  setGameMode(mode);
  // Adapter immédiatement les effectifs à la taille du mode, pour que
  // l'onglet Équipes reflète tout de suite le bon nombre de joueurs.
  try{ _prepareTeamsForMode(); }catch(e){ console.error('prepareTeams failed:',e); }
  renderModeScreen();
  // Rafraîchir les autres écrans dépendants (sans quitter l'onglet Modes)
  if(typeof renderTB==='function'){ try{ renderTB(0); renderTB(1); }catch(e){} }
  if(typeof renderTactics==='function'){ try{ renderTactics(); }catch(e){} }
  if(typeof updateCompoPitch==='function'){ try{ updateCompoPitch(); }catch(e){} }
}

// ══════════════════════════════════════════════════════════
// PARAMÈTRES
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
// STYLE DE TERRAIN (partagé : réglages / avant-match / carrière > infra)
// ══════════════════════════════════════════════════════════
function _stadiumSelectorHTML(){
  const cur = (typeof stadiumTheme==='function') ? stadiumTheme() : 'modern';
  const opts=[
    {id:'classic',   label:'🏟 CLASSIQUE',       sub:'terrain sobre',        col:'var(--gold)'},
    {id:'modern',    label:'✨ MODERNE',          sub:'tribunes & LED',       col:'#18c860'},
    {id:'synthetic', label:'🟩 SYNTHÉTIQUE',     sub:'pelouse artificielle', col:'#2a9d8f'},
    {id:'snow',      label:'❄️ NEIGE',           sub:'hiver & vent',         col:'#8ecae6'},
    {id:'greek',     label:'🏛 GRÈCE ANTIQUE',   sub:'sol en marbre',        col:'#c9a05a'},
    {id:'forest',    label:'🌲 FORÊT',           sub:'clairière boisée',     col:'#2e7d32'},
    {id:'bamboo',    label:'🎋 BAMBOU',          sub:'bambouseraie',         col:'#8fbf3f'},
    {id:'handball',  label:'🤾 HANDBALL',        sub:'parquet de salle',     col:'#c9975f'},
    {id:'city',      label:'🏙 CITY-STADE',      sub:'bitume urbain',        col:'#5a6068'},
  ];
  let h='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
  opts.forEach(o=>{
    const on = cur===o.id;
    h+='<button onclick="setStadiumTheme(\''+o.id+'\')" style="padding:8px 6px;border-radius:9px;cursor:pointer;border:2px solid '+(on?o.col:'var(--b1)')+';background:'+(on?o.col+'22':'var(--dark)')+';color:'+(on?o.col:'var(--muted)')+';text-align:center">'
      +'<div style="font-size:12px;font-weight:900;font-family:\'Barlow Condensed\',sans-serif;letter-spacing:.5px">'+o.label+'</div>'
      +'<div style="font-size:8px;margin-top:2px;opacity:.85">'+o.sub+'</div>'
      +'</button>';
  });
  h+='</div>';
  // ── Toggle tribunes / pourtour ──────────────────────────────────────
  const standsOn = (typeof stadiumStands==='function') ? stadiumStands() : true;
  const isClassic = cur==='classic';
  h+='<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid var(--b1)">'
    +'<div>'
      +'<div style="font-size:11px;font-weight:800;color:var(--text)">Tribunes &amp; infrastructures</div>'
      +'<div style="font-size:8px;color:var(--muted);margin-top:1px">'+(isClassic?'Déjà masquées en style Classique.':'Gradins, cages et décor autour du terrain (vue aérienne, à l\'échelle des joueurs).')+'</div>'
    +'</div>'
    +'<button onclick="setStadiumStands('+(!standsOn)+')" '+(isClassic?'disabled':'')+' style="flex-shrink:0;padding:8px 12px;border-radius:9px;cursor:'+(isClassic?'default':'pointer')+';border:2px solid '+(standsOn&&!isClassic?'var(--gold)':'var(--b1)')+';background:'+(standsOn&&!isClassic?'rgba(240,192,40,.14)':'var(--dark)')+';color:'+(standsOn&&!isClassic?'var(--gold)':'var(--muted)')+';opacity:'+(isClassic?'.55':'1')+'">'
      +'<div style="font-size:11px;font-weight:900;font-family:\'Barlow Condensed\',sans-serif;letter-spacing:.5px;white-space:nowrap">'+(standsOn?'✅ ACTIVÉES':'🚫 DÉSACTIVÉES')+'</div>'
    +'</button>'
  +'</div>';
  return h;
}

function renderSettings(){
  const out=document.getElementById('settings-out');
  if(!out) return;
  const complet = window.isComplet && window.isComplet();
  const card=(inner)=>`<div style="background:var(--card);border:1px solid var(--b1);border-radius:12px;padding:14px;margin-bottom:12px">${inner}</div>`;
  const modeCard = card(`
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:900;letter-spacing:2px;color:var(--gold);text-transform:uppercase;margin-bottom:4px">Mode de statistiques</div>
    <div style="font-size:10px;color:var(--muted);line-height:1.5;margin-bottom:10px">
      Choisis la profondeur du jeu. <b>Lite</b> : 6 statistiques simples, prise en main rapide — c'est le jeu classique.
      <b>Complet</b> : des dizaines d'attributs détaillés (physique, technique, mental) façon manager. En Lite, les stats détaillées sont ignorées.
    </div>
    <div style="display:flex;gap:8px">
      <button onclick="setStatMode('lite')" style="flex:1;padding:12px 8px;border-radius:10px;cursor:pointer;border:2px solid ${!complet?'var(--gold)':'var(--b1)'};background:${!complet?'rgba(240,192,40,.14)':'var(--dark)'};color:${!complet?'var(--gold)':'var(--muted)'}">
        <div style="font-size:15px;font-weight:900;font-family:'Barlow Condensed',sans-serif;letter-spacing:1px">⚡ LITE</div>
        <div style="font-size:9px;margin-top:2px;opacity:.85">6 stats · simple & rapide</div>
      </button>
      <button onclick="setStatMode('complet')" style="flex:1;padding:12px 8px;border-radius:10px;cursor:pointer;border:2px solid ${complet?'#8840e0':'var(--b1)'};background:${complet?'rgba(136,64,224,.16)':'var(--dark)'};color:${complet?'#b98cf0':'var(--muted)'}">
        <div style="font-size:15px;font-weight:900;font-family:'Barlow Condensed',sans-serif;letter-spacing:1px">📊 COMPLET</div>
        <div style="font-size:9px;margin-top:2px;opacity:.85">stats détaillées · profondeur</div>
      </button>
    </div>
    <div style="font-size:9px;color:var(--muted);margin-top:10px;padding:7px 9px;background:var(--panel);border:1px solid var(--b1);border-radius:6px">
      Mode actuel : <b style="color:${complet?'#b98cf0':'var(--gold)'}">${complet?'COMPLET':'LITE'}</b>${complet?' — les fiches joueurs affichent tous les attributs détaillés.':' — les fiches joueurs affichent les 6 statistiques de base.'}
    </div>
  `);
  const camOn = !window.GS || window.GS.cameraFx!==false;
  const camCard = card(`
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:900;letter-spacing:2px;color:var(--gold);text-transform:uppercase;margin-bottom:4px">Effets de caméra</div>
    <div style="font-size:10px;color:var(--muted);line-height:1.5;margin-bottom:10px">
      Secousses d'écran et zoom cinématique sur les temps forts (buts, gros sorts). Purement visuel. Désactive si tu préfères une vue stable ou sur un appareil moins puissant.
    </div>
    <div style="display:flex;gap:8px">
      <button onclick="setCameraFx(true)" style="flex:1;padding:10px 8px;border-radius:10px;cursor:pointer;border:2px solid ${camOn?'var(--gold)':'var(--b1)'};background:${camOn?'rgba(240,192,40,.14)':'var(--dark)'};color:${camOn?'var(--gold)':'var(--muted)'}">
        <div style="font-size:14px;font-weight:900;font-family:'Barlow Condensed',sans-serif;letter-spacing:1px">🎬 ACTIVÉS</div>
      </button>
      <button onclick="setCameraFx(false)" style="flex:1;padding:10px 8px;border-radius:10px;cursor:pointer;border:2px solid ${!camOn?'#8840e0':'var(--b1)'};background:${!camOn?'rgba(136,64,224,.16)':'var(--dark)'};color:${!camOn?'#b98cf0':'var(--muted)'}">
        <div style="font-size:14px;font-weight:900;font-family:'Barlow Condensed',sans-serif;letter-spacing:1px">⏸ DÉSACTIVÉS</div>
      </button>
    </div>
  `);
  const saveCard = card(`
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:900;letter-spacing:2px;color:var(--gold);text-transform:uppercase;margin-bottom:4px">Sauvegarde</div>
    <div style="font-size:10px;color:var(--muted);line-height:1.5;margin-bottom:10px">
      Exportez vos profils et carrières dans un fichier de secours, ou restaurez une sauvegarde. Utile pour changer d'appareil ou en cas de problème.
    </div>
    <div style="display:flex;gap:8px">
      <button onclick="exportSaveFile()" style="flex:1;padding:11px 8px;border-radius:10px;cursor:pointer;border:2px solid var(--gold);background:rgba(240,192,40,.14);color:var(--gold);font-weight:900;font-family:'Barlow Condensed',sans-serif;letter-spacing:1px;font-size:13px">⬇ EXPORTER</button>
      <button onclick="document.getElementById('save-import-input').click()" style="flex:1;padding:11px 8px;border-radius:10px;cursor:pointer;border:2px solid var(--b2);background:var(--dark);color:var(--text);font-weight:900;font-family:'Barlow Condensed',sans-serif;letter-spacing:1px;font-size:13px">⬆ IMPORTER</button>
    </div>
    <input id="save-import-input" type="file" accept="application/json,.json" style="display:none" onchange="importSaveFile(this)">
  `);
  const textSizeNow = document.documentElement.getAttribute('data-textsize') || 'normal';
  // Même correctif que les boutons de difficulté : « Très grand » est bien plus
  // long que « Normal », donc largeurs égales = débordement. Aggravé ici par le
  // réglage lui-même, qui grossit le texte des boutons.
  const tsBtn = (val, label) => `<button onclick="setTextSize('${val}')" style="flex:1 1 auto;min-width:0;padding:11px 6px;border-radius:10px;cursor:pointer;border:2px solid ${textSizeNow===val?'var(--gold)':'var(--b1)'};background:${textSizeNow===val?'rgba(240,192,40,.14)':'var(--dark)'};color:${textSizeNow===val?'var(--gold)':'var(--muted)'};font-weight:900;font-family:'Barlow Condensed',sans-serif;letter-spacing:.5px;font-size:12px">${label}</button>`;
  const textSizeCard = card(`
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:900;letter-spacing:2px;color:var(--gold);text-transform:uppercase;margin-bottom:4px">Taille du texte</div>
    <div style="font-size:10px;color:var(--muted);line-height:1.5;margin-bottom:10px">
      Grossit toute l'interface (texte, boutons, icônes) si c'est trop petit à ton goût.
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      ${tsBtn('normal','Normal')}
      ${tsBtn('grand','Grand')}
      ${tsBtn('tresgrand','Très grand')}
    </div>
  `);
  const themeNow = document.documentElement.getAttribute('data-theme') || 'dark';
  const stadeCard = card(`
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:900;letter-spacing:2px;color:var(--gold);text-transform:uppercase;margin-bottom:4px">Style de terrain</div>
    <div style="font-size:10px;color:var(--muted);line-height:1.5;margin-bottom:10px">
      L'ambiance du terrain pendant les matchs : sobre, avec tribunes et panneaux LED, pelouse synthétique, hiver enneigé (avec vent), sol en marbre façon Grèce antique, clairière boisée, bambouseraie, parquet de handball, ou city-stade en bitume.
    </div>
    ${_stadiumSelectorHTML()}
  `);
  const themeCard = card(`
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:900;letter-spacing:2px;color:var(--gold);text-transform:uppercase;margin-bottom:4px">Thème</div>
    <div style="font-size:10px;color:var(--muted);line-height:1.5;margin-bottom:10px">
      Ambiance manga sombre (par défaut) ou claire, façon planche noir & blanc à fort contraste.
    </div>
    <div style="display:flex;gap:8px">
      <button onclick="setTheme('dark')" style="flex:1;padding:11px 8px;border-radius:10px;cursor:pointer;border:2px solid ${themeNow==='dark'?'var(--gold)':'var(--b1)'};background:${themeNow==='dark'?'rgba(240,192,40,.14)':'var(--dark)'};color:${themeNow==='dark'?'var(--gold)':'var(--muted)'};font-weight:900;font-family:'Barlow Condensed',sans-serif;letter-spacing:1px;font-size:13px">🌙 SOMBRE</button>
      <button onclick="setTheme('light')" style="flex:1;padding:11px 8px;border-radius:10px;cursor:pointer;border:2px solid ${themeNow==='light'?'var(--gold)':'var(--b1)'};background:${themeNow==='light'?'rgba(240,192,40,.14)':'var(--dark)'};color:${themeNow==='light'?'var(--gold)':'var(--muted)'};font-weight:900;font-family:'Barlow Condensed',sans-serif;letter-spacing:1px;font-size:13px">☀️ CLAIR</button>
    </div>
  `);
  const diffNow = difficultyLevel();
  const diffBtn = (id) => {
    const d = DIFFICULTY_LEVELS[id];
    const on = diffNow===id;
    // Grille 2×2 (voir le conteneur) plutôt qu'une rangée de 4.
    // Avant : `display:flex` + `flex:1` imposait 4 largeurs IDENTIQUES (~73 px)
    // à des libellés de longueurs très différentes. « Légendaire » (~101 px)
    // débordait de 36 px, « Difficile » de 11 px : le texte visible tombait
    // HORS du bouton, donc hors de la zone cliquable — d'où l'impossibilité de
    // sélectionner la difficulté maximale.
    // Une rangée de 4 ne peut PAS marcher ici : les 4 libellés réclament
    // ~304 px pour ~294 px disponibles dans la sidebar. En 2×2 chaque cellule
    // fait ~153 px et le plus long libellé garde ~42 px de marge.
    return `<button onclick="setDifficultyLevel('${id}')" title="${d.label.replace(/^\S+\s/,'')}" style="width:100%;min-width:0;padding:10px 6px;border-radius:10px;cursor:pointer;border:2px solid ${on?'var(--gold)':'var(--b1)'};background:${on?'rgba(240,192,40,.14)':'var(--dark)'};color:${on?'var(--gold)':'var(--muted)'}">
      <div style="font-size:12px;font-weight:900;font-family:'Barlow Condensed',sans-serif;letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.label}</div>
    </button>`;
  };
  const diffCard = card(`
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:900;letter-spacing:2px;color:var(--gold);text-transform:uppercase;margin-bottom:4px">Difficulté IA</div>
    <div style="font-size:10px;color:var(--muted);line-height:1.5;margin-bottom:10px">
      Règle directement la force des adversaires en carrière (championnat, coupes, amicaux, barrages). L'effet est appliqué aux stats adverses — tu le vois tout de suite dans l'OVR affiché à l'avant-match.
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
      ${diffBtn('easy')}${diffBtn('normal')}${diffBtn('hard')}${diffBtn('legend')}
    </div>
    <div style="font-size:9px;color:var(--muted);margin-top:10px;padding:7px 9px;background:var(--panel);border:1px solid var(--b1);border-radius:6px">
      ${DIFFICULTY_LEVELS[diffNow].desc}
    </div>
  `);
  const fsOn = !!(document.fullscreenElement || document.webkitFullscreenElement);
  const fsSupported = (typeof _fullscreenSupported==='function') ? _fullscreenSupported() : true;
  const fsCard = card(`
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:900;letter-spacing:2px;color:var(--gold);text-transform:uppercase;margin-bottom:4px">Affichage</div>
    <div style="font-size:10px;color:var(--muted);line-height:1.5;margin-bottom:10px">
      Le plein écran masque le menu et l'interface du navigateur. L'image garde ses proportions
      quelle que soit la résolution ou le format d'écran.
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
      <div>
        <div style="font-size:11px;font-weight:800;color:var(--text)">Mode plein écran</div>
        <div style="font-size:8px;color:var(--muted);margin-top:1px">${fsSupported?'Échap pour quitter.':'Non pris en charge par ce navigateur (iOS Safari) : le menu sera simplement masqué.'}</div>
      </div>
      <button onclick="toggleTheaterMode()" style="flex-shrink:0;padding:8px 12px;border-radius:9px;cursor:pointer;border:2px solid ${fsOn?'var(--gold)':'var(--b1)'};background:${fsOn?'rgba(240,192,40,.14)':'var(--dark)'};color:${fsOn?'var(--gold)':'var(--muted)'}">
        <div style="font-size:11px;font-weight:900;font-family:'Barlow Condensed',sans-serif;letter-spacing:.5px;white-space:nowrap">${fsOn?'⛶ QUITTER':'⛶ ACTIVER'}</div>
      </button>
    </div>
  `);
  const tutoCard = card(`
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:900;letter-spacing:2px;color:var(--gold);text-transform:uppercase;margin-bottom:4px">Visite guidée</div>
    <div style="font-size:10px;color:var(--muted);line-height:1.5;margin-bottom:10px">
      Un rappel des bases de FootSim : modes, équipes, tactique, sorts et carrière. Idéal pour se rafraîchir la mémoire ou découvrir le jeu.
    </div>
    <button onclick="if(typeof startTutorial==='function')startTutorial()" style="width:100%;padding:11px 8px;border-radius:10px;cursor:pointer;border:2px solid var(--gold);background:rgba(240,192,40,.14);color:var(--gold);font-weight:900;font-family:'Barlow Condensed',sans-serif;letter-spacing:1px;font-size:13px">🎓 REVOIR LA VISITE GUIDÉE</button>
  `);
  out.innerHTML = `
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:900;letter-spacing:2px;color:#fff;text-transform:uppercase;padding:6px 4px 10px">⚙️ Paramètres</div>
    ${tutoCard}
    ${themeCard}
    ${fsCard}
    ${stadeCard}
    ${diffCard}
    ${textSizeCard}
    ${modeCard}
    ${camCard}
    ${(function(){
      const on = !window._enhCinemaOff;
      return card(`
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:900;letter-spacing:2px;color:var(--gold);text-transform:uppercase;margin-bottom:4px">Ambiance cinéma</div>
        <div style="font-size:10px;color:var(--muted);line-height:1.5;margin-bottom:10px">
          Vignette douce et halos de projecteurs pour une ambiance de match en nocturne. Purement esthétique — désactive pour une image plus plate ou sur un appareil moins puissant.
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="toggleCinemaFx();renderSettings()" style="flex:1;padding:10px 8px;border-radius:10px;cursor:pointer;border:2px solid ${on?'var(--gold)':'var(--b1)'};background:${on?'rgba(240,192,40,.14)':'var(--dark)'};color:${on?'var(--gold)':'var(--muted)'}">
            <div style="font-size:14px;font-weight:900;font-family:'Barlow Condensed',sans-serif;letter-spacing:1px">🌆 ACTIVÉE</div>
          </button>
          <button onclick="if(!window._enhCinemaOff)toggleCinemaFx();renderSettings()" style="flex:1;padding:10px 8px;border-radius:10px;cursor:pointer;border:2px solid ${!on?'#8840e0':'var(--b1)'};background:${!on?'rgba(136,64,224,.16)':'var(--dark)'};color:${!on?'#b98cf0':'var(--muted)'}">
            <div style="font-size:14px;font-weight:900;font-family:'Barlow Condensed',sans-serif;letter-spacing:1px">⏸ DÉSACTIVÉE</div>
          </button>
        </div>
      `);
    })()}
    ${saveCard}
  `;
}

// Bascule le thème visuel (manga sombre / clair) et le mémorise.
function setTheme(t){
  t = (t==='light') ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  try{ localStorage.setItem('footsim_theme', t); }catch(e){}
  if(typeof renderSettings==='function') renderSettings();
}
// Restaure le thème choisi au démarrage.
(function _restoreTheme(){
  try{
    const t = localStorage.getItem('footsim_theme');
    if(t==='light' || t==='dark') document.documentElement.setAttribute('data-theme', t);
  }catch(e){}
})();

// ── MODE PLEIN ÉCRAN (masque la sidebar) ─────────────────────────────────
// Astuce pour filmer des shorts YouTube : le terrain occupe alors tout
// l'écran. Purement visuel (classe CSS sur #app, voir index.html) + tentative
// de vrai plein écran navigateur en plus (masque aussi la barre d'adresse
// sur mobile) — non bloquant si l'API est indisponible ou refusée (courant
// sur iOS Safari, qui n'implémente pas requestFullscreen).
function _fullscreenSupported(){
  const e=document.documentElement;
  return !!(e.requestFullscreen || e.webkitRequestFullscreen || e.msRequestFullscreen);
}
function _enterFullscreen(){
  const e=document.documentElement;
  const fn = e.requestFullscreen || e.webkitRequestFullscreen || e.msRequestFullscreen;
  if(!fn) return;                       // iOS Safari : on garde le mode "sidebar masquée"
  try{ const r=fn.call(e); if(r&&r.catch) r.catch(()=>{}); }catch(err){}
}
function _exitFullscreen(){
  const fn = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
  if(!fn) return;
  try{ const r=fn.call(document); if(r&&r.catch) r.catch(()=>{}); }catch(err){}
}
function _isFullscreen(){ return !!(document.fullscreenElement || document.webkitFullscreenElement); }

function toggleTheaterMode(){
  const app=document.getElementById('app');
  if(!app) return;
  const on=app.classList.toggle('theater-mode');
  _syncTheaterBtn(on);
  if(on) _enterFullscreen();
  else if(_isFullscreen()) _exitFullscreen();
  // Le panneau Paramètres affiche l'état du plein écran : le resynchroniser.
  if(typeof renderSettings==='function' && document.getElementById('settings-out')){
    setTimeout(()=>{ try{ renderSettings(); }catch(e){} }, 80);
  }
  // La taille du canvas dépend de #canvas-wrap, qui vient de changer de
  // taille (sidebar masquée/réaffichée) : on force un resize après le
  // reflow plutôt que d'attendre le prochain redimensionnement fenêtre.
  setTimeout(()=>{ if(typeof resize==='function') resize(); }, 60);
}
function _syncTheaterBtn(on){
  const btn=document.getElementById('theater-btn');
  if(!btn) return;
  btn.classList.toggle('theater-active', on);
  btn.textContent = on ? '⛶ Quitter' : '⛶ Plein écran';
  btn.title = on
    ? 'Réafficher le menu'
    : 'Masquer le menu de gauche (plein écran, pratique pour filmer un short YouTube)';
}
// Si l'utilisateur quitte le plein écran natif autrement (touche Échap,
// bouton du navigateur…), on resynchronise la sidebar et le bouton pour ne
// pas rester dans un état incohérent.
function _onFsChange(){
  if(_isFullscreen()) return;
  const app=document.getElementById('app');
  if(app && app.classList.contains('theater-mode')){
    app.classList.remove('theater-mode');
    _syncTheaterBtn(false);
    setTimeout(()=>{ if(typeof resize==='function') resize(); }, 60);
  }
  if(typeof renderSettings==='function' && document.getElementById('settings-out')){
    try{ renderSettings(); }catch(e){}
  }
}
document.addEventListener('fullscreenchange', _onFsChange);
document.addEventListener('webkitfullscreenchange', _onFsChange);
// Un changement de résolution/format (rotation, écran externe, entrée en
// plein écran) doit re-caler le canvas : sans ça l'image resterait à
// l'ancienne taille jusqu'au prochain resize fenêtre.
window.addEventListener('orientationchange',()=>{
  setTimeout(()=>{ if(typeof resize==='function') resize(); }, 120);
});

// Bascule la taille de l'interface (normal / grand / très grand) et la mémorise.
// S'applique via un zoom CSS sur <html> (voir index.html) : tout grossit
// proportionnellement (texte, boutons, icônes) sans casser la mise en page.
function setTextSize(sz){
  sz = (sz==='grand' || sz==='tresgrand') ? sz : 'normal';
  if(sz==='normal') document.documentElement.removeAttribute('data-textsize');
  else document.documentElement.setAttribute('data-textsize', sz);
  try{ localStorage.setItem('footsim_textsize', sz); }catch(e){}
  if(typeof renderSettings==='function') renderSettings();
}
// Restaure la taille choisie au démarrage (le HTML a "grand" par défaut).
(function _restoreTextSize(){
  try{
    const sz = localStorage.getItem('footsim_textsize');
    if(sz==='grand' || sz==='tresgrand') document.documentElement.setAttribute('data-textsize', sz);
    else if(sz==='normal') document.documentElement.removeAttribute('data-textsize');
    // sinon (aucune préférence enregistrée) : on garde le "grand" par défaut du HTML.
  }catch(e){}
})();

// ── Export / Import de sauvegarde (fichier) ─────────────────────────────
// Sérialise toutes les clés critiques dans un fichier JSON téléchargeable.
function exportSaveFile(){
  if(typeof SaveCore === 'undefined'){ if(typeof logEvent==='function') logEvent('Export indisponible.','#e02030'); return; }
  const keys = ['footsim_profiles','footsim_activeProfile'];
  const bundle = SaveCore.exportKeys(keys);
  const blob = new Blob([bundle], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0,10);
  a.href = url; a.download = 'footsim_save_' + stamp + '.json';
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 100);
  if(typeof logEvent==='function') logEvent('💾 Sauvegarde exportée.','#18c860');
}

function importSaveFile(input){
  const file = input && input.files && input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    try{
      const ok = (typeof SaveCore !== 'undefined') && SaveCore.importBundle(String(e.target.result));
      if(ok){
        if(typeof loadProfiles==='function') loadProfiles();
        if(typeof logEvent==='function') logEvent('✅ Sauvegarde importée. Rechargement…','#18c860');
        setTimeout(function(){ location.reload(); }, 800);
      } else {
        if(typeof logEvent==='function') logEvent('❌ Fichier de sauvegarde invalide.','#e02030');
      }
    }catch(err){
      if(typeof logEvent==='function') logEvent('❌ Import échoué.','#e02030');
    }
  };
  reader.readAsText(file);
  input.value = '';
}

// Ré-affiche la fiche joueur actuellement ouverte (si l'éditeur est visible),
// utilisé quand on change de mode de stats pour rafraîchir l'affichage.
function _reRenderOpenPlayerEditor(){
  const modal=document.getElementById('pmodal')||document.getElementById('player-modal');
  const cnt=document.getElementById('mcnt');
  if(!cnt) return;
  if(typeof editTi==='undefined') return;
  try{
    if(editCtx==='cup'){ const r=_cteRef(editCupId); if(r){ const arr=editSource==='bench'?(r.ref.bench||[]):editSource==='reserve'?(r.ref.reserves||[]):(r.ref.players||[]); const p=arr[editPi]; if(p)_renderPlayerEditor(p,r.ref,editSource); } }
    else if(editTi!=null){ const arr=_resolveEditArr(); const p=arr[editPi]; if(p&&teams[editTi])_renderPlayerEditor(p,teams[editTi],editSource); }
  }catch(e){}
}

function renderProfileScreen(){
  // Overlay plein écran par-dessus tout
  let ov = document.getElementById('profile-screen');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'profile-screen';
    ov.style.cssText = 'position:fixed;inset:0;background:#050e1a;z-index:99999;overflow-y:auto;display:flex;align-items:center;justify-content:center;';
    document.body.appendChild(ov);
  }

  const profileList = Object.values(profiles);
  const hasProfiles = profileList.length > 0;

  ov.innerHTML = `
  <div style="width:100%;max-width:500px;padding:20px">

    <!-- Logo -->
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:32px;margin-bottom:6px">⚽</div>
      <div style="font-size:24px;font-weight:900;color:var(--gold,#f0c028);letter-spacing:3px">FOOTSIM 7V7</div>
      <div style="font-size:10px;color:var(--muted,#8899aa);margin-top:4px">Choisissez votre profil</div>
    </div>

    <!-- Profils existants -->
    ${hasProfiles ? `
    <div style="margin-bottom:16px">
      ${profileList.sort((a,b)=>b.lastPlayed>a.lastPlayed?1:-1).map(p=>`
        <div style="background:var(--panel,#0d1f35);border:2px solid var(--b1,#1a3050);border-radius:12px;padding:12px;margin-bottom:8px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:12px"
             onclick="selectProfileAndEnter('${p.id}')"
             onmouseover="this.style.borderColor='var(--gold,#f0c028)';this.style.background='rgba(240,192,40,.08)'"
             onmouseout="this.style.borderColor='var(--b1,#1a3050)';this.style.background='var(--panel,#0d1f35)'">
          <div style="font-size:28px;width:44px;height:44px;background:var(--dark,#060f1c);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            ${p.avatar||'⚽'}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:900;color:var(--fg,#e8f0f8)">${p.name}</div>
            <div style="font-size:9px;color:var(--muted,#8899aa);margin-top:2px">
              ${_profileSummary(p)}
            </div>
            <div style="font-size:9px;color:var(--muted,#8899aa)">
              Dernière session : ${_timeAgo(p.lastPlayed)}
            </div>
          </div>
          <div style="font-size:18px;color:var(--gold,#f0c028)">▶</div>
        </div>
      `).join('')}
    </div>
    ` : `
    <div style="text-align:center;padding:24px;color:var(--muted,#8899aa);font-size:11px;margin-bottom:16px">
      Aucun profil existant.<br>Créez votre premier profil pour commencer !
    </div>
    `}

    <!-- Créer un nouveau profil -->
    <div style="background:var(--panel,#0d1f35);border:2px dashed var(--b1,#1a3050);border-radius:12px;padding:14px">
      <div style="font-size:11px;font-weight:700;color:var(--gold,#f0c028);margin-bottom:10px">➕ Nouveau profil</div>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        ${['⚽','🏆','🌊','⚡','🐉','🧜','🌟','🔥'].map(em=>`
          <div onclick="selectProfileAvatar('${em}')" id="av-${em}"
               style="width:32px;height:32px;border-radius:50%;background:var(--dark,#060f1c);border:2px solid var(--b1,#1a3050);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;transition:all .15s"
               onmouseover="this.style.borderColor='var(--gold,#f0c028)'"
               onmouseout="if(window._selAvatar!=='${em}')this.style.borderColor='var(--b1,#1a3050)'">
            ${em}
          </div>
        `).join('')}
      </div>
      <input id="profile-name-input" type="text" placeholder="Nom du profil…"
             style="width:100%;background:var(--dark,#060f1c);border:1px solid var(--b1,#1a3050);border-radius:6px;color:var(--fg,#e8f0f8);padding:6px 10px;font-size:11px;box-sizing:border-box;margin-bottom:8px"
             maxlength="24" onkeydown="if(event.key==='Enter')confirmCreateProfile()">
      <button onclick="confirmCreateProfile()"
              style="width:100%;background:var(--gold,#f0c028);color:#050e1a;border:none;border-radius:8px;padding:8px;font-size:12px;font-weight:900;cursor:pointer">
        Créer et jouer
      </button>
    </div>

    <!-- Gestion profils -->
    ${hasProfiles ? `
    <div style="text-align:center;margin-top:12px">
      <button onclick="renderProfileManage()"
              style="background:none;border:1px solid var(--b1,#1a3050);border-radius:6px;color:var(--muted,#8899aa);font-size:9px;padding:4px 12px;cursor:pointer">
        ⚙️ Gérer les profils
      </button>
    </div>
    ` : ''}
  </div>`;

  // Sélectionner ⚽ par défaut
  window._selAvatar = '⚽';
  setTimeout(()=>{
    const el = document.getElementById('av-⚽');
    if(el){ el.style.borderColor='var(--gold,#f0c028)'; el.style.background='rgba(240,192,40,.15)'; }
  }, 50);
}

function selectProfileAvatar(em){
  window._selAvatar = em;
  document.querySelectorAll('[id^="av-"]').forEach(el=>{
    el.style.borderColor='var(--b1,#1a3050)';
    el.style.background='var(--dark,#060f1c)';
  });
  const sel = document.getElementById('av-'+em);
  if(sel){ sel.style.borderColor='var(--gold,#f0c028)'; sel.style.background='rgba(240,192,40,.15)'; }
}

function confirmCreateProfile(){
  const name = document.getElementById('profile-name-input')?.value?.trim();
  if(!name){ logEvent('❌ Entrez un nom de profil','#e02030'); return; }
  const id = createProfile(name, window._selAvatar||'⚽');
  selectProfileAndEnter(id);
}

function selectProfileAndEnter(pid){
  selectProfile(pid);
  const ov = document.getElementById('profile-screen');
  if(ov) ov.remove();
  nav('mode');
  // Visite guidée au tout premier passage de ce profil (ne se lance qu'une fois).
  if(typeof maybeStartTutorial === 'function'){ try{ maybeStartTutorial(); }catch(e){} }
}

// ── Écran de gestion des profils ─────────────────────────────────────
function renderProfileManage(){
  const ov = document.getElementById('profile-screen');
  if(!ov) return;

  const profileList = Object.values(profiles);

  ov.innerHTML = `
  <div style="width:100%;max-width:500px;padding:20px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
      <button onclick="renderProfileScreen()"
              style="background:none;border:1px solid var(--b1,#1a3050);border-radius:6px;color:var(--muted);font-size:10px;padding:3px 10px;cursor:pointer">
        ← Retour
      </button>
      <div style="font-size:14px;font-weight:900;color:var(--gold,#f0c028)">⚙️ Gérer les profils</div>
    </div>

    ${profileList.map(p=>`
    <div style="background:var(--panel,#0d1f35);border:1px solid var(--b1,#1a3050);border-radius:10px;padding:10px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="font-size:22px">${p.avatar||'⚽'}</div>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:900">${p.name}</div>
          <div style="font-size:9px;color:var(--muted)">${_profileSummary(p)}</div>
          <div style="font-size:9px;color:var(--muted)">Taille : ${_fmtSize(_profileSize(p.id))}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          <button onclick="selectProfileAndEnter('${p.id}')"
                  style="background:#18c860;border:none;border-radius:4px;color:#050e1a;font-size:9px;padding:3px 8px;cursor:pointer;font-weight:700">
            ▶ Jouer
          </button>
          <button onclick="confirmDeleteProfile('${p.id}','${p.name.replace(/'/g,"\'")}')"
                  style="background:none;border:1px solid #e06060;border-radius:4px;color:#e06060;font-size:9px;padding:3px 8px;cursor:pointer">
            🗑️ Supprimer
          </button>
        </div>
      </div>

      <!-- Compétitions du profil -->
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--b1,#1a3050)">
        ${_renderProfileCompetitions(p)}
      </div>
    </div>
    `).join('')}
  </div>`;
}

function _renderProfileCompetitions(p){
  const cups    = Object.values(p.cups||{});
  const leagues = Object.values(p.leagues||{});
  const careers = Object.values(p.careers||{});
  const total   = cups.length + leagues.length + careers.length;

  if(total === 0) return '<div style="font-size:9px;color:var(--muted)">Aucune compétition sauvegardée</div>';

  const row = (icon, name, savedAt, type, id) => `
    <div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:9px">
      <span>${icon}</span>
      <span style="flex:1;color:var(--fg)">${name}</span>
      <span style="color:var(--muted)">${_timeAgo(savedAt)}</span>
      <button onclick="loadCompetitionFromProfile('${type}','${id}','${p.id}')"
              style="background:none;border:1px solid var(--gold);border-radius:3px;color:var(--gold);font-size:8px;padding:1px 5px;cursor:pointer">
        Charger
      </button>
      <button onclick="deleteCompetitionFromProfile('${type}','${id}','${p.id}')"
              style="background:none;border:1px solid #e06060;border-radius:3px;color:#e06060;font-size:8px;padding:1px 5px;cursor:pointer">
        ✕
      </button>
    </div>`;

  return [
    ...cups.map(c    => row('🏆', c.name, c.savedAt, 'cup',    c.id)),
    ...leagues.map(l => row('🥇', l.name, l.savedAt, 'league', l.id)),
    ...careers.map(c => row('🎯', c.name, c.savedAt, 'career', c.id)),
  ].join('');
}

function loadCompetitionFromProfile(type, id, pid){
  const p = profiles[pid]; if(!p) return;
  const entry = p[type+'s']?.[id]; if(!entry) return;

  if(type==='cup'){    cupState    = entry.state; saveCup();    }
  if(type==='league'){ leagueState = entry.state; saveLeague(); }
  if(type==='career'){ careerV2    = entry.state; saveCareerV2(); }

  selectProfileAndEnter(pid);
  logEvent(`✅ ${entry.name} chargée !`,'#18c860');
}

function deleteCompetitionFromProfile(type, id, pid){
  if(!confirm('Supprimer cette sauvegarde ?')) return;
  deleteCompetition(type, id);
  renderProfileManage();
}

function confirmDeleteProfile(pid, name){
  if(!confirm(`Supprimer le profil "${name}" et toutes ses sauvegardes ? Cette action est irréversible.`)) return;
  deleteProfile(pid);
  if(Object.keys(profiles).length === 0) renderProfileScreen();
  else renderProfileManage();
}

// ── Helpers d'affichage ───────────────────────────────────────────────
function _profileSummary(p){
  const nc = Object.keys(p.cups||{}).length;
  const nl = Object.keys(p.leagues||{}).length;
  const nca = Object.keys(p.careers||{}).length;
  const parts = [];
  if(nc)  parts.push(`${nc} coupe${nc>1?'s':''}`);
  if(nl)  parts.push(`${nl} ligue${nl>1?'s':''}`);
  if(nca) parts.push(`${nca} carrière${nca>1?'s':''}`);
  return parts.length ? parts.join(' · ') : 'Aucune compétition';
}

function _timeAgo(iso){
  if(!iso) return '–';
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff/60000);
  const h    = Math.floor(diff/3600000);
  const d    = Math.floor(diff/86400000);
  if(min < 1)  return 'à l\'instant';
  if(min < 60) return `il y a ${min} min`;
  if(h < 24)   return `il y a ${h}h`;
  if(d < 7)    return `il y a ${d}j`;
  return new Date(iso).toLocaleDateString('fr-FR');
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
