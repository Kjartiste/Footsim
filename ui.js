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
    {id:'5v5',   n:'5 contre 5',   sub:'Foot à 5 · Futsal',       col:'#8840e0', field:'1 gardien + 4 joueurs', desc:'Format nerveux et rapide. Petits effectifs, beaucoup de duels, scores élevés.', icon:'⚡'},
    {id:'7v7',   n:'7 contre 7',   sub:'Format classique',        col:'#f0c028', field:'1 gardien + 6 joueurs', desc:'Le mode historique de FootSim. Équilibre parfait entre tactique et action.', icon:'⚽'},
    {id:'11v11', n:'11 contre 11', sub:'Football à 11',           col:'#18c860', field:'1 gardien + 10 joueurs', desc:'Le vrai football. Grandes équipes, formations profondes, 3 changements max.', icon:'🏟️'},
  ];
  const cur = window.gameMode || '7v7';
  let h = '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:15px;font-weight:900;letter-spacing:2px;color:var(--gold);text-transform:uppercase;padding:8px 4px 2px">Choisis ton mode</div>'
    + '<div style="font-size:10px;color:var(--muted);padding:0 4px 10px;line-height:1.4">Le mode détermine le nombre de joueurs sur le terrain, les formations disponibles et la taille des effectifs. L\'onglet <b>Équipes</b> s\'adapte automatiquement.</div>';
  modes.forEach(m=>{
    const active = cur===m.id;
    h += '<div onclick="selectGameMode(\''+m.id+'\')" style="cursor:pointer;background:'+(active?m.col+'18':'var(--card)')+';border:2px solid '+(active?m.col:'var(--b1)')+';border-radius:12px;padding:12px;margin-bottom:10px;transition:all .12s">'
      + '<div style="display:flex;align-items:center;gap:10px">'
      + '<div style="width:44px;height:44px;border-radius:10px;background:'+m.col+'22;border:1px solid '+m.col+'55;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">'+m.icon+'</div>'
      + '<div style="flex:1;min-width:0">'
      + '<div style="display:flex;align-items:center;gap:8px"><div style="font-family:\'Barlow Condensed\',sans-serif;font-size:17px;font-weight:900;color:'+(active?m.col:'#fff')+';letter-spacing:.5px">'+m.n+'</div>'
      + (active?'<span style="font-size:8px;font-weight:900;letter-spacing:1px;color:#05101c;background:'+m.col+';padding:2px 6px;border-radius:10px">ACTIF</span>':'')+'</div>'
      + '<div style="font-size:10px;color:'+m.col+';font-weight:700;letter-spacing:.5px">'+m.sub+'</div>'
      + '</div></div>'
      + '<div style="font-size:11px;color:var(--text);margin-top:8px;line-height:1.4">'+m.desc+'</div>'
      + '<div style="font-size:9px;color:var(--muted);margin-top:6px;letter-spacing:.5px">👥 '+m.field+'</div>'
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
  const themeNow = document.documentElement.getAttribute('data-theme') || 'dark';
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
  out.innerHTML = `
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:900;letter-spacing:2px;color:#fff;text-transform:uppercase;padding:6px 4px 10px">⚙️ Paramètres</div>
    ${themeCard}
    ${modeCard}
    ${camCard}
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
          <button onclick="confirmDeleteProfile('${p.id}','${p.name.replace(/'/g,"\\'")}')"
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

function showPreMatch(onStart){
  try{
    _prepareTeamsForMode();
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
      const inner=(typeof teamBadgeHTML==='function')?teamBadgeHTML(T,52):
        (T.img?`<img src="${T.img}" style="width:52px;height:52px;border-radius:50%;object-fit:cover">`:`<div style="width:52px;height:52px;border-radius:50%;background:${T.color};display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:900;color:#fff">${teamIni(T.name)}</div>`);
      return `<div style="width:52px;height:52px;margin:0 auto 8px;display:flex;align-items:center;justify-content:center">${inner}</div>`;
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

    // ── Sélecteur de mode 5v5 / 7v7 / 11v11 ────────────────────────────
    h+='<div style="display:flex;gap:6px;margin:4px 14px 8px">'
      +'<button onclick="setGameMode(\'5v5\');showPreMatch(window._prematchOnStart)" '
      +'style="flex:1;padding:6px;border-radius:8px;border:2px solid '+(window.gameMode==='5v5'?'#8840e0':'var(--b1)')+';'
      +'background:'+(window.gameMode==='5v5'?'rgba(136,64,224,.15)':'var(--dark)')+';'
      +'color:'+(window.gameMode==='5v5'?'#8840e0':'var(--muted)')+';font-size:11px;font-weight:900;cursor:pointer">'
      +'⚽ 5v5</button>'
      +'<button onclick="setGameMode(\'7v7\');showPreMatch(window._prematchOnStart)" '
      +'style="flex:1;padding:6px;border-radius:8px;border:2px solid '+(window.gameMode==='7v7'?'var(--gold)':'var(--b1)')+';'
      +'background:'+(window.gameMode==='7v7'?'rgba(240,192,40,.15)':'var(--dark)')+';'
      +'color:'+(window.gameMode==='7v7'?'var(--gold)':'var(--muted)')+';font-size:11px;font-weight:900;cursor:pointer">'
      +'⚽ 7v7</button>'
      +'<button onclick="setGameMode(\'11v11\');showPreMatch(window._prematchOnStart)" '
      +'style="flex:1;padding:6px;border-radius:8px;border:2px solid '+(window.gameMode==='11v11'?'#18c860':'var(--b1)')+';'
      +'background:'+(window.gameMode==='11v11'?'rgba(24,200,96,.15)':'var(--dark)')+';'
      +'color:'+(window.gameMode==='11v11'?'#18c860':'var(--muted)')+';font-size:11px;font-weight:900;cursor:pointer">'
      +'⚽ 11v11</button>'
      +'</div>';

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
  G._everStarted=true;

  _prepareTeamsForMode();

  // Appliquer un score de départ personnalisé
  if(G._customScore&&(G._customScore[0]||G._customScore[1])){
    G.scores=[G._customScore[0]||0, G._customScore[1]||0];
    const e0=document.getElementById('hs0'),e1=document.getElementById('hs1');
    if(e0)e0.textContent=G.scores[0];
    if(e1)e1.textContent=G.scores[1];
    syncHUD();
  }
  if(G._singleHalf){
    G.half=2; G.minute=45; G._firstHalfKickoffTi=G.atkTi;
    const hc=document.getElementById('hclock');if(hc)hc.textContent="45'";
  }
  _gifArmIfNeeded();
  _triggerConcert();
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

// Compléter une équipe jusqu'à 11 joueurs pour le mode 11v11

// ── S'assurer que les équipes sont prêtes pour le mode actif ─────────
function _prepareTeamsForMode(){
  if(window.gameMode === '11v11'){
    [0,1].forEach(function(ti){
      _ensureTeamSize11v11(ti);
      if(!teams[ti].strat11) teams[ti].strat11 = '442';
      applyFormationRoles(ti);
    });
    resetSubs11v11();
  } else if(window.gameMode === '5v5'){
    [0,1].forEach(function(ti){
      _ensureTeamSize5v5(ti);
      if(!teams[ti].strat5) teams[ti].strat5 = '121';
      applyFormationRoles(ti);
    });
  } else {
    // 7v7 : garantir 7 titulaires (utile après un passage par le 5v5)
    [0,1].forEach(function(ti){ _ensureTeamSize7v7(ti); });
  }
  // Verser les RÉSERVISTES sur le banc pour qu'ils puissent entrer en jeu.
  // Sans ça, un petit club (banc quasi vide) pouvait se retrouver en
  // sous-nombre après quelques blessures/expulsions alors qu'il avait des
  // réservistes disponibles. On garantit un banc suffisamment fourni.
  [0,1].forEach(function(ti){ _topUpBenchFromReserves(ti); });
  // Générer les stats détaillées (mode Complet) et garantir les champs de
  // mouvement sur tous les joueurs (y compris ceux générés en complément).
  if(typeof ensureAllS2==='function'){ try{ ensureAllS2(); }catch(e){} }
  if(typeof ensureAllProfiles==='function'){ try{ ensureAllProfiles(); }catch(e){} }
  if(typeof ensureTeamRaces==='function'){ try{ [0,1].forEach(function(ti){ if(teams[ti]) ensureTeamRaces(teams[ti]); }); }catch(e){} }
  [0,1].forEach(function(ti){ (teams[ti].players||[]).forEach(_ensureMotionFields); });
}

// Complète le banc d'une équipe jusqu'à une taille CIBLE, identique pour les
// deux équipes (sinon le joueur, qui a des réservistes en carrière, se
// retrouvait avec un banc plus fourni que l'IA générée sans réserve).
// Priorité : on puise d'abord dans les RÉSERVISTES du club (T.reserves) — ça
// les rend utilisables sur le terrain, ce qui évite de finir en sous-nombre —
// puis, si ça ne suffit pas, on GÉNÈRE des remplaçants au niveau de l'équipe
// pour égaliser les bancs.
function _topUpBenchFromReserves(ti){
  const T = teams[ti];
  if(!T) return;
  T.players = T.players || [];
  T.bench = T.bench || [];
  T.reserves = T.reserves || [];
  // Cible de banc selon le format (assez de rechange pour ne pas manquer de
  // joueurs même après plusieurs sorties), commune aux DEUX équipes.
  const target = window.gameMode==='11v11' ? 7 : window.gameMode==='5v5' ? 5 : 5;
  // 1) Monter les réservistes existants sur le banc.
  while(T.bench.length < target && T.reserves.length > 0){
    const p = T.reserves.shift();
    if(!p) break;
    p.onBench = true;
    p.subbedOut = false;
    if(p.hp==null) p.hp = 100;
    if(p.mp==null) p.mp = 100;
    if(p.injLevel==null) p.injLevel = 0;
    T.bench.push(p);
  }
  // 2) Compléter par génération si le banc n'atteint toujours pas la cible, pour
  //    que les deux équipes aient EXACTEMENT le même nombre de remplaçants.
  if(T.bench.length < target && window.WORLDS && WORLDS.generatePlayer){
    const nation = T.nation || (window.careerV2 && careerV2.nation) || 'panthalassa';
    const region = T.region || (window.careerV2 && careerV2.club && careerV2.club.region) || 'solgrath';
    const level  = (typeof fillLevelForTeam==='function') ? fillLevelForTeam(T) : 'r1';
    const benchPos = window.gameMode==='11v11'
      ? ['GB','DC','DD','DG','MC','MC','ATT','MO','DC']
      : window.gameMode==='5v5'
      ? ['GB','DC','MC','ATT','DC']
      : ['GB','MC','ATT','DC','DD'];
    let gi = 0;
    while(T.bench.length < target){
      const pos = benchPos[gi % benchPos.length] || 'MC';
      gi++;
      let p = null;
      try{ p = WORLDS.generatePlayer(nation, region, pos, (typeof randPlayerName==='function'?randPlayerName():'Remplaçant'), level, 'bench'); }catch(e){ p=null; }
      if(!p) break;
      p.onBench = true;
      p.subbedOut = false;
      if(p.hp==null) p.hp = 100;
      if(p.mp==null) p.mp = 100;
      if(p.injLevel==null) p.injLevel = 0;
      T.bench.push(p);
    }
  }
}

// Garantit qu'un joueur possède tous les champs de position/mouvement, pour
// qu'il ne reste jamais figé (x/y/vx… undefined → NaN → immobile).
function _ensureMotionFields(p){
  if(!p) return;
  const num=(k,def)=>{ if(typeof p[k]!=='number'||isNaN(p[k])) p[k]=def; };
  num('x',0); num('y',0); num('vx',0); num('vy',0); num('tx',0); num('ty',0);
  num('stunT',0); num('runT',0); num('runCool',0); num('tackleCool',0);
  if(typeof p.wPhaseX!=='number') p.wPhaseX=Math.random();
  if(typeof p.wPhaseY!=='number') p.wPhaseY=Math.random();
  if(typeof p.wSpeed!=='number') p.wSpeed=1.2+Math.random()*0.6;
  if(typeof p.bobPhase!=='number') p.bobPhase=Math.random()*Math.PI*2;
  if(typeof p.hp!=='number'||isNaN(p.hp)) p.hp=100;
  if(typeof p.mp!=='number'||isNaN(p.mp)) p.mp=100;
  if(typeof p.injLevel!=='number') p.injLevel=0;
}
window._ensureMotionFields=_ensureMotionFields;

// Ramène l'effectif de terrain à 7 titulaires (complète depuis le banc si besoin)
function _ensureTeamSize7v7(ti){
  const T = teams[ti];
  if(!T) return;
  T.players = T.players || [];
  T.bench = T.bench || [];
  const fillPos = ['DC','DD','DG','MC','MC','ATT'];
  while(T.players.length < 7){
    if(T.bench.length > 0){
      const p = T.bench.shift();
      p.onBench = false;
      T.players.push(p);
    } else if(window.WORLDS && WORLDS.generatePlayer){
      const pos = fillPos[(T.players.length-1) % fillPos.length] || 'MC';
      const p = WORLDS.generatePlayer('panthalassa','solgrath',pos,randPlayerName(),fillLevelForTeam(T));
      if(p) T.players.push(p); else break;
    } else break;
  }
  const gbCount = T.players.filter(p=>p && p.pos==='GB').length;
  if(gbCount === 0 && T.players[0]) T.players[0].pos = 'GB';
}

// Niveau WORLDS (LEVEL_STAT_RANGES) correspondant au tier d'un club preset.
function _levelForPresetTier(tier){
  return {pro:'d1', national_team:'d1', regional:'r2', district:'dh'}[tier] || 'd2';
}

// Adapte l'effectif au format 5v5 : 5 titulaires (dont 1 GB), le reste au banc.
function _ensureTeamSize5v5(ti){
  const T = teams[ti];
  if(!T) return;
  T.players = T.players || [];
  T.bench = T.bench || [];
  T.reserves = T.reserves || [];

  // Équipe preset (effectif fixe fourni par le jeu) : on génère un effectif
  // futsal DÉDIÉ (vrais noms de la région du club, niveau du club) plutôt que
  // de trafiquer le noyau 7v7 — pour que 5v5/11v11/7v7 aient des joueurs
  // vraiment différents, comme des sections distinctes du même club.
  if(T._preset && T.nation && window.WORLDS && WORLDS.generateSquad){
    // Les ids WORLDS sont en minuscules (ex: 'valoria') alors que T.nation
    // vient du champ d'affichage des presets (ex: 'Valoria') — normaliser,
    // sinon WORLDS.get() ne trouve rien et renvoie un effectif vide.
    const nationId = String(T.nation).toLowerCase();
    const region = T.region || (WORLDS.getRegions(nationId)[0]||{}).id;
    if(region){
      const level = _levelForPresetTier(T.tier);
      const squad = WORLDS.generateSquad(nationId, region, {
        positions: ['GB','DC','MOG','MOD','ATT'],
        bench: ['GB','DC','MOG','MOD','ATT'],
        reserves: [],
        level,
      });
      if(squad.players.length){
        T.players = squad.players;
        T.bench = squad.bench;
        const gbCount = T.players.filter(p=>p && p.pos==='GB').length;
        if(gbCount === 0 && T.players[0]) T.players[0].pos = 'GB';
        return;
      }
    }
  }

  // Si trop de titulaires : renvoyer les surnuméraires au banc
  if(T.players.length > 5){
    // Garder de préférence 1 gardien + 4 joueurs de champ
    const gk = T.players.find(p=>p && p.pos==='GB');
    const rest = T.players.filter(p=>p && p!==gk);
    const starters = [];
    if(gk) starters.push(gk);
    for(const p of rest){
      if(starters.length >= 5) break;
      starters.push(p);
    }
    // Les autres vont au banc (en tête pour rester accessibles)
    const extras = T.players.filter(p=>p && starters.indexOf(p)<0);
    extras.forEach(p=>{ p.onBench=true; });
    T.bench = extras.concat(T.bench);
    T.players = starters;
  }

  // Si pas assez de titulaires : compléter depuis le banc, puis les réservistes,
  // et seulement en dernier recours générer un joueur (nation/région du CLUB,
  // pas une nation en dur — évite des inconnus hors-lore dans une équipe preset).
  const nation = T.nation || 'panthalassa', region = T.region || 'solgrath';
  const fillPos = ['DC','MOG','MOD','ATT'];
  while(T.players.length < 5){
    if(T.bench.length > 0){
      const p = T.bench.shift();
      p.onBench = false;
      T.players.push(p);
    } else if(T.reserves.length > 0){
      const p = T.reserves.shift();
      p.onBench = false;
      T.players.push(p);
    } else if(window.WORLDS && WORLDS.generatePlayer){
      const pos = fillPos[(T.players.length-1) % fillPos.length] || 'MC';
      const p = WORLDS.generatePlayer(nation, region, pos, randPlayerName(), fillLevelForTeam(T));
      if(p) T.players.push(p); else break;
    } else break;
  }

  // Garantir exactement un gardien
  const gbCount = T.players.filter(p=>p && p.pos==='GB').length;
  if(gbCount === 0 && T.players[0]) T.players[0].pos = 'GB';
}

function _ensureTeamSize11v11(ti){
  const T = teams[ti];
  if(!T) return;
  T.bench = T.bench || [];
  T.reserves = T.reserves || [];

  // Équipe preset : effectif 11v11 DÉDIÉ (vrais noms de la région du club,
  // niveau du club), généré via le même système que les ligues de carrière —
  // au lieu de padder le noyau 7v7 avec des inconnus hors-lore.
  if(T._preset && T.nation && window.WORLDS && WORLDS.generateSquad){
    // Les ids WORLDS sont en minuscules (ex: 'valoria') alors que T.nation
    // vient du champ d'affichage des presets (ex: 'Valoria') — normaliser,
    // sinon WORLDS.get() ne trouve rien et renvoie un effectif vide.
    const nationId = String(T.nation).toLowerCase();
    const region = T.region || (WORLDS.getRegions(nationId)[0]||{}).id;
    if(region){
      const level = _levelForPresetTier(T.tier);
      const squad = WORLDS.generateSquad(nationId, region, {
        positions: ['GB','DD','DC','DC','DG','MC','MC','MC','MC','ATT','ATT'],
        bench: ['GB','DC','MC','MC','ATT','DD','DG'],
        reserves: [],
        level,
      });
      if(squad.players.length){
        T.players = squad.players;
        T.bench = squad.bench;
        return;
      }
    }
  }

  // Nation/région du CLUB si connues, sinon repli générique. Avant, ces deux
  // valeurs étaient codées en dur (panthalassa/solgrath) : une équipe preset
  // Valoria récupérait des inconnus hors-lore dès qu'il manquait un joueur.
  const nation = T.nation || 'panthalassa';
  const region = T.region || 'solgrath';

  // AVANT de générer qui que ce soit, on rapatrie les réservistes vers le banc
  // (les équipes preset ont typiquement 7 titulaires + 5 banc + 3 réservistes =
  // 15 joueurs déjà conçus — largement de quoi remplir un 11v11 sans random).
  if(T.reserves.length){
    T.reserves.forEach(p=>{ if(p) p.onBench = true; });
    T.bench = T.bench.concat(T.reserves);
    T.reserves = [];
  }

  // Postes pour chaque slot de la formation 4-4-2 (défaut)
  // Slot 0=GB, 1=DD, 2=DC, 3=DC, 4=DG, 5=MC, 6=MC, 7=MC, 8=MC, 9=ATT, 10=ATT
  const slots442 = ['GB','DD','DC','DC','DG','MC','MC','MC','MC','ATT','ATT'];

  // Si l'équipe a moins de 11 joueurs, compléter en respectant les slots
  if(T.players.length < 11){
    // On complète l'effectif jusqu'à 11 SANS écraser le poste réel des joueurs
    // existants (sinon un attaquant/milieu recruté devenait défenseur par
    // simple remplissage de slots). Les joueurs existants gardent LEUR poste ;
    // on ne fixe un poste que sur les remplaçants GÉNÉRÉS pour combler un trou.
    const existing = [...T.players];
    T.players = [];

    // Slot 0 : GB — on prend un vrai gardien s'il existe, sinon on en génère un
    // (on NE convertit PAS un joueur de champ en gardien de force ici).
    let gb = existing.find(p=>p.pos==='GB');
    if(gb){ T.players.push(gb); existing.splice(existing.indexOf(gb),1); }
    else {
      const p = WORLDS.generatePlayer(nation, region, 'GB', randPlayerName(), fillLevelForTeam(T));
      if(p) T.players.push(p);
    }

    // On garde d'abord TOUS les joueurs existants avec leur poste d'origine.
    existing.forEach(function(p){ if(p) T.players.push(p); });

    // Puis on comble jusqu'à 11 avec des joueurs générés, en visant les postes
    // manquants de la 442 (les slots déjà couverts par un vrai joueur du poste
    // sont ignorés pour éviter les doublons inutiles).
    const need = ['DD','DC','DC','DG','MC','MC','MC','MC','ATT','ATT'];
    const have = {};
    T.players.forEach(function(p){ if(p) have[p.pos]=(have[p.pos]||0)+1; });
    for(let k=0; k<need.length && T.players.length<11; k++){
      const pos = need[k];
      if((have[pos]||0)>0){ have[pos]--; continue; } // déjà couvert par un vrai joueur
      const p = WORLDS.generatePlayer(nation, region, pos, randPlayerName(), fillLevelForTeam(T));
      if(p) T.players.push(p);
    }
    // Filet de sécurité : compléter si besoin (positions par défaut).
    while(T.players.length < 11){
      const slotPos = slots442[T.players.length] || 'MC';
      const p = WORLDS.generatePlayer(nation, region, slotPos, randPlayerName(), fillLevelForTeam(T));
      if(p) T.players.push(p);
    }
  }
  if(false){
    const existing = [...T.players];

    // Vider et reconstruire l'effectif dans l'ordre des slots
    T.players = [];

    // Slot 0 : GB
    const gb = existing.find(p=>p.pos==='GB') || existing[0];
    if(gb){ gb.pos='GB'; T.players.push(gb); existing.splice(existing.indexOf(gb),1); }
    else {
      const p = WORLDS.generatePlayer(nation, region, 'GB', randPlayerName(), fillLevelForTeam(T));
      if(p) T.players.push(p);
    }

    // Slots 1-4 : défenseurs
    const defPositions = ['DD','DC','DC','DG'];
    defPositions.forEach(pos => {
      const found = existing.find(p=>p.pos===pos||p.pos==='DC'||p.pos==='DD'||p.pos==='DG');
      if(found){ found.pos=pos; T.players.push(found); existing.splice(existing.indexOf(found),1); }
      else {
        const p = WORLDS.generatePlayer(nation, region, pos, randPlayerName(), fillLevelForTeam(T));
        if(p) T.players.push(p);
      }
    });

    // Slots 5-8 : milieux
    const midPositions = ['MC','MC','MC','MC'];
    midPositions.forEach(pos => {
      const found = existing.find(p=>p.pos==='MC'||p.pos==='MDC'||p.pos==='MO'||p.pos==='MOG'||p.pos==='MOD');
      if(found){ found.pos=pos; T.players.push(found); existing.splice(existing.indexOf(found),1); }
      else {
        const p = WORLDS.generatePlayer(nation, region, pos, randPlayerName(), fillLevelForTeam(T));
        if(p) T.players.push(p);
      }
    });

    // Slots 9-10 : attaquants
    const attPositions = ['ATT','ATT'];
    attPositions.forEach(pos => {
      const found = existing.find(p=>p.pos==='ATT'||p.pos==='MO'||p.pos==='AG'||p.pos==='AD');
      if(found){ found.pos=pos; T.players.push(found); existing.splice(existing.indexOf(found),1); }
      else {
        const p = WORLDS.generatePlayer(nation, region, pos, randPlayerName(), fillLevelForTeam(T));
        if(p) T.players.push(p);
      }
    });

    // Placer les joueurs restants non assignés dans les slots manquants
    while(T.players.length < 11 && existing.length > 0){
      const p = existing.shift();
      const slotPos = slots442[T.players.length] || 'MC';
      p.pos = slotPos;
      T.players.push(p);
    }
    // Compléter si toujours pas 11
    while(T.players.length < 11){
      const slotPos = slots442[T.players.length] || 'MC';
      const p = WORLDS.generatePlayer(nation, region, slotPos, randPlayerName(), fillLevelForTeam(T));
      if(p) T.players.push(p);
    }
  }

  // S'assurer que le banc a au moins 7 joueurs pour le 11v11
  const benchSlots = ['GB','MC','ATT','DC','MO','DD','DG'];
  while(T.bench.length < 7){
    const pos = benchSlots[T.bench.length % benchSlots.length];
    const p = WORLDS.generatePlayer(nation, region, pos, randPlayerName(), fillLevelForTeam(T));
    if(p){ p.onBench=true; T.bench.push(p); }
  }
}

function goMatch(){
  _lastNav='setup';
  _prepareTeamsForMode();
  nav('match');
  // Exhibition : par défaut tu diriges l'équipe A et le coach IA gère l'équipe
  // B (plus naturel que de devoir gérer les deux). Un bouton en match permet de
  // basculer chaque équipe entre 👤 joueur et 🤖 IA à tout moment.
  G._humanTeams = [true, false];
  try{ if(typeof resetManagerAi==='function') resetManagerAi(); }catch(e){}
  resetMatch();
  syncHUD();renderTB(0);renderTB(1);
  showPreMatch();
}

// Mettre à jour l'apparence des boutons de mode selon le mode actif
function updateModeBtns(){
  const set=(id,active,col)=>{
    const b=document.getElementById(id);
    if(!b) return;
    b.style.borderColor = active ? col : 'var(--b1)';
    b.style.background  = active ? (col==='var(--gold)'?'rgba(240,192,40,.15)':col==='#18c860'?'rgba(24,200,96,.15)':'rgba(136,64,224,.15)') : 'var(--dark)';
    b.style.color       = active ? col : 'var(--muted)';
  };
  set('mode-btn-5v5',  window.gameMode==='5v5',  '#8840e0');
  set('mode-btn-7v7',  window.gameMode==='7v7',  'var(--gold)');
  set('mode-btn-11v11',window.gameMode==='11v11','#18c860');
  // Rafraîchir l'écran de sélection des modes s'il est visible
  if(typeof renderModeScreen === 'function' && document.getElementById('sp-mode')?.classList.contains('on')){
    renderModeScreen();
  }
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
      // Suffixe « 🤖 IA » si cette équipe est pilotée par le coach IA (adversaire).
      const aiManaged = Array.isArray(G._humanTeams) && G._humanTeams[+i]===false;
      const suffix = aiManaged ? ' 🤖' : '';
      const span=nameEl.querySelector('span');
      if(span){[...nameEl.childNodes].forEach(n=>{if(n.nodeType===3)n.remove();});nameEl.appendChild(document.createTextNode(T.name+suffix));}
      else nameEl.textContent=T.name+suffix;
      if(aiManaged) nameEl.title='Équipe gérée par le coach IA (mentalité et changements automatiques)';
      else nameEl.removeAttribute('title');
    }
    const scoreEl=document.getElementById('hs'+i);
    if(scoreEl)scoreEl.style.color=T.color;
  });
  const f0=document.getElementById('ftag0'),f1=document.getElementById('ftag1');
  // Mettre à jour les étiquettes de formation selon le mode et la stratégie choisie
  (function(){
    const is11=window.gameMode==='11v11', is5=window.gameMode==='5v5';
    const list = is11 ? (window.STRATS_11V11||[]) : is5 ? (window.STRATS_5V5||[]) : (window.STRATS||[]);
    const attr = is11 ? 'strat11' : is5 ? 'strat5' : 'strat';
    const def  = is11 ? '442' : is5 ? '121' : '321';
    [ [f0,0], [f1,1] ].forEach(([el,ti])=>{
      if(!el) return;
      const T=teams[ti]; if(!T) return;
      const id=T[attr]||def;
      const s=list.find(x=>x.id===id);
      el.textContent = s ? s.n : def;
    });
  })();
  // Logo latéral : refléter le mode courant
  const logo=document.querySelector('.slogo');
  if(logo){ const m=window.gameMode||'7v7'; logo.textContent='⚽ FootSim '+m; }
  // Barre de contrôle IA des équipes (afficher/mettre à jour en match).
  try{ if(typeof _syncAiCtrlBar==='function') _syncAiCtrlBar(); }catch(e){}
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
    const miss=p._missNextMatch?`<span style="font-size:9px;color:#e02030" title="Blessé${p._injWeeks>0?' - indisponible '+p._injWeeks+' semaine'+(p._injWeeks>1?'s':''):' - indisponible prochain match'}"> 🚫${p._injWeeks>0?'<span style="font-size:8px;color:#e06060">'+p._injWeeks+'sem</span>':''}</span>`:'';
    const inj=p.injLevel>0?`<span style="font-size:9px;color:${INJ_COLORS[p.injLevel]}">${['','🤕','🚑','🆘'][p.injLevel]}</span>`:'';
    return `
    <div class="prow" style="display:flex;align-items:center;gap:4px">
      <div class="av" style="width:26px;height:26px;border-color:${T.color}50;background:${T.color}22;flex-shrink:0;cursor:pointer" onclick="openM(${ti},${pi},'${source}')">
        ${p.img?`<img src="${p.img}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`:`<span style="font-size:9px;font-weight:700;color:${T.color}">${p.ini}</span>`}
      </div>
      <div class="pi" style="flex:1;cursor:pointer" onclick="openM(${ti},${pi},'${source}')">
        <div class="pn">${p.name}${(()=>{
          if(!p.race||p.race==='human'||typeof raceMeta!=='function')return '';
          const m=raceMeta(p.race);
          return ` <span title="${m.name}" style="font-size:10px;vertical-align:baseline">${m.emoji}</span>`;
        })()}${inj}${miss}</div>
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
        <div id="tbadge${ti}" onclick="openBadgeEditor(${ti})" style="width:52px;height:52px;border-radius:${T.badge?'8px':'50%'};border:2px solid ${T.color}66;background:${T.badge?'transparent':T.color+'22'};cursor:pointer;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:22px" title="Cliquer pour ouvrir l'éditeur de blason">
          ${(typeof teamBadgeHTML==='function')?teamBadgeHTML(T,48):(T.img?`<img src="${T.img}" style="width:100%;height:100%;object-fit:cover">`:`<span style="color:${T.color};font-size:17px;font-weight:900">${teamIni(T.name)}</span>`)}
        </div>
        <input type="file" id="tfup${ti}" accept="image/*" style="display:none" onchange="handleTeamImg(event,${ti})">
        <div style="font-size:8px;color:var(--muted);text-align:center;margin-top:3px;letter-spacing:.5px;cursor:pointer" onclick="openBadgeEditor(${ti})">BLASON</div>
      </div>
      <div style="flex:1">
        <div style="font-size:9px;color:var(--muted);margin-bottom:4px">Logo / blason de l'équipe<br><span style="color:#333">Affiché partout : pré-match, calendrier, classement…</span></div>
        <button class="btn" style="padding:3px 9px;font-size:9px;margin-top:2px" onclick="openBadgeEditor(${ti})" title="Créer un blason vectoriel">🛡️ Éditeur de blason</button>
        <button class="btn" style="padding:3px 9px;font-size:9px;margin-top:2px" onclick="document.getElementById('tfup${ti}').click()" title="Importer une image">🖼️ Importer</button>
        ${(T.img||T.badge)?`<button class="btn" style="padding:2px 8px;font-size:9px;margin-top:2px" onclick="teams[${ti}].img='';teams[${ti}]._img=null;teams[${ti}].badge=null;renderTB(${ti});syncHUD()">✕ Retirer</button>`:''}
        <button class="btn" style="padding:3px 9px;font-size:9px;margin-top:2px" onclick="openPresetPicker(${ti})" title="Choisir une équipe préenregistrée (clubs, sélections)">📚 Préfaites</button>
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
    const _fsz = window.gameMode==='11v11'?11:(window.gameMode==='5v5'?5:7);
    const lines={GB:[],DEF:[],MID:[],ATT:[]};
    (T.players||[]).slice(0,_fsz).forEach(p=>{
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

// Phase de formation éditée dans l'onglet Tactique par équipe :
// 'def' = sans ballon (formation de base) / 'atk' = avec ballon.
const _tacFormPhase = {0:'def', 1:'def'};
function tacSetFormPhase(ti, phase){
  _tacFormPhase[ti] = phase;
  try{ renderTactics(); }catch(e){}
}
// Applique le choix de formation dans l'onglet Tactique en tenant compte
// de la phase (avec / sans ballon). Réutilise la même logique de double
// formation que l'écran de mi-temps : remettre la formation "avec ballon"
// identique à "sans ballon" désactive la double formation.
function tacSetStrat(ti, sid){
  const is11 = window.gameMode==='11v11', is5 = window.gameMode==='5v5';
  const defAttr = is11 ? 'strat11' : is5 ? 'strat5' : 'strat';
  const atkAttr = is11 ? 'strat11Atk' : is5 ? 'strat5Atk' : 'stratAtk';
  const phase = _tacFormPhase[ti] || 'def';
  if(phase==='atk'){
    teams[ti][atkAttr] = (sid===teams[ti][defAttr]) ? null : sid;
  } else {
    teams[ti][defAttr] = sid;
  }
  _afterFormationChange(ti);
  try{ renderTactics(); }catch(e){}
}

function renderTactics(){
  const is11 = window.gameMode === '11v11';
  const is5 = window.gameMode === '5v5';
  const stratList = is11 ? STRATS_11V11 : (is5 ? STRATS_5V5 : STRATS);
  const modeLbl = is11 ? '11v11' : (is5 ? '5v5' : '7v7');
  const modeCol = is11 ? '#18c860' : (is5 ? '#8840e0' : 'var(--gold)');

  [0,1].forEach(ti=>{
    const T=teams[ti];
    const defAttr = is11 ? 'strat11' : (is5 ? 'strat5' : 'strat');
    const atkAttr = is11 ? 'strat11Atk' : (is5 ? 'strat5Atk' : 'stratAtk');
    const defId = is11 ? (T.strat11||'442') : (is5 ? (T.strat5||'121') : (T.strat||'321'));
    const atkId = T[atkAttr];
    const phase = _tacFormPhase[ti] || 'def';
    // Formation "sélectionnée" pour l'affichage selon la phase éditée.
    const curStrat = phase==='atk' ? (atkId||defId) : defId;
    const hasDual = atkId && atkId!==defId;

    const stratItems = stratList.map(s=>`
      <div class="sc${curStrat===s.id?' sel':''}" onclick="tacSetStrat(${ti},'${s.id}')">
        <div style="display:flex;align-items:center;gap:5px">
          <div style="width:7px;height:7px;border-radius:50%;background:${s.col}"></div>
          <div class="st">${s.n}</div>
        </div>
        <div class="sd">${s.d}</div>
        <div class="sbar-row">
          <div class="sbar-w"><div class="sbar-lbl">ATK</div><div class="sbar-track"><div class="sbar-fill" style="width:${Math.round(s.atk/1.22*100)}%;background:var(--red)"></div></div></div>
          <div class="sbar-w"><div class="sbar-lbl">DEF</div><div class="sbar-track"><div class="sbar-fill" style="width:${Math.round(s.def/1.30*100)}%;background:var(--blue)"></div></div></div>
        </div>
      </div>`).join('');

    const defName = (stratList.find(s=>s.id===defId)||{}).n || defId;
    const atkName = (stratList.find(s=>s.id===(atkId||defId))||{}).n || defName;

    const phaseToggle = `
      <div style="display:flex;gap:5px;margin-bottom:6px">
        <button onclick="tacSetFormPhase(${ti},'def')" style="flex:1;font-size:9px;padding:4px 6px;border-radius:6px;border:1px solid var(--b1);cursor:pointer;font-weight:700;background:${phase==='def'?'var(--gold)':'var(--dark)'};color:${phase==='def'?'#000':'var(--muted)'}">🛡️ Sans ballon<br><span style="font-size:8px;font-weight:600">${defName}</span></button>
        <button onclick="tacSetFormPhase(${ti},'atk')" style="flex:1;font-size:9px;padding:4px 6px;border-radius:6px;border:1px solid var(--b1);cursor:pointer;font-weight:700;background:${phase==='atk'?'#e02030':'var(--dark)'};color:${phase==='atk'?'#fff':'var(--muted)'}">⚽ Avec ballon<br><span style="font-size:8px;font-weight:600">${hasDual?atkName:'= sans ballon'}</span></button>
      </div>`;

    document.getElementById(`tac${ti}`).innerHTML=`
    <div class="team-blk" style="margin-bottom:8px">
      <div class="team-hd"><div class="tdot2" style="background:${T.color}"></div>
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;letter-spacing:.8px;text-transform:uppercase">${T.name}</div>
        <div style="font-size:9px;color:${modeCol};margin-left:auto;font-weight:700">${modeLbl}</div>
      </div>
      <div style="padding:6px">
        ${phaseToggle}
        <div style="font-size:9px;color:var(--muted);background:var(--panel);border:1px solid var(--b1);border-radius:6px;padding:5px 7px;margin-bottom:6px;line-height:1.4">
          ${phase==='atk'
            ? '⚽ Dispositif adopté quand ton équipe a le ballon. Choisis la <b>même</b> formation que « sans ballon » pour désactiver la double formation.'
            : is11
            ? 'ℹ️ Dispositif 11v11 par défaut (sans ballon). Tu peux définir un dispositif différent <b>avec ballon</b> via l\'onglet ci-dessus.'
            : is5
            ? 'ℹ️ Dispositif 5v5 (foot à 5) — 1 gardien + 4 joueurs de champ. Formation avec/sans ballon disponible.'
            : 'ℹ️ La stratégie règle le pressing/largeur/profondeur. Formation avec/sans ballon disponible.'}
        </div>
        ${stratItems}
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

// Renvoie le joueur actuellement édité dans la fiche (contexte principal ou coupe)
function editP(){
  try{
    if(editCtx==='cup'){ const r=_cteRef(editCupId); if(!r)return null; const arr=editSource==='bench'?(r.ref.bench||[]):editSource==='reserve'?(r.ref.reserves||[]):(r.ref.players||[]); return arr[editPi]||null; }
    const arr=_resolveEditArr(); return arr[editPi]||null;
  }catch(e){ return null; }
}

function _renderPlayerEditor(p,T,source){
  const label={player:'',bench:' (Banc)',reserve:' (Réserviste)'}[source]||'';
  document.getElementById('mttl').textContent=p.name+' · '+p.pos+label;
  document.getElementById('mcnt').innerHTML=`
  <div style="display:flex;gap:11px;align-items:flex-start;margin-bottom:12px">
    <div style="position:relative">
      <div class="av" id="mav" style="width:52px;height:52px;font-size:15px;font-weight:800;cursor:pointer;border-color:${T.color}60;background:${T.color}22" onclick="document.getElementById('fup').click()" title="Cliquer pour changer la photo">
        ${p.img?`<img src="${p.img}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`:`<span style="color:${T.color}">${p.ini}</span>`}
      </div>
      ${(()=>{
        if(!p.race||p.race==='human'||typeof raceMeta!=='function')return '';
        const m=raceMeta(p.race);
        return `<div title="${m.name}" style="position:absolute;bottom:14px;right:-4px;width:20px;height:20px;border-radius:50%;background:#0c0e14;border:1.5px solid rgba(255,255,255,.6);display:flex;align-items:center;justify-content:center;font-size:12px">${m.emoji}</div>`;
      })()}
      <input type="file" id="fup" accept="image/*" style="display:none" onchange="handleImg(event)">
      <div style="font-size:8px;color:var(--muted);text-align:center;margin-top:2px;letter-spacing:.5px;cursor:pointer" onclick="document.getElementById('fup').click()">PHOTO</div>
    </div>
    <div style="flex:1">
      <div class="frow"><span class="lbl">Nom</span><input class="inp" id="pn" value="${p.name}"></div>
      <div class="frow"><span class="lbl">Poste</span>
        <select class="inp" id="ppos" style="cursor:pointer">
          ${(window.gameMode==='11v11'
            ? ['GB','DD','DC','DG','DCD','DCG','LB','RB','MDC','MDC2','MC','MCD','MCG','MO','MOG','MOD','AG','AD','ATT','ATT2']
            : ['GB','DD','DC','DG','MDC','MC','MO','ATT','AG','AD']
          ).map(po=>`<option${po===p.pos?' selected':''}>${po}</option>`).join('')}
        </select>
      </div>
      <div class="frow"><span class="lbl">Race</span>
        <select class="inp" id="prace" style="cursor:pointer" onchange="if(editP()){editP().race=this.value; if(typeof _reRenderOpenPlayerEditor==='function')_reRenderOpenPlayerEditor();}">
          ${(window.RACE_IDS||['human']).map(rid=>{
            const m=(typeof raceMeta==='function')?raceMeta(rid):{name:rid,emoji:''};
            const sel=((p.race||'human')===rid)?' selected':'';
            return `<option value="${rid}"${sel}>${m.emoji} ${m.name}</option>`;
          }).join('')}
        </select>
      </div>
      ${(()=>{
        const m=(typeof raceMeta==='function')?raceMeta(p.race):null;
        if(!m||(p.race||'human')==='human') return '<div style="font-size:9px;color:var(--muted);margin-top:-2px">Aucun modificateur physiologique (humain).</div>';
        const keys=[['spd','VIT'],['sht','TIR'],['def','DEF'],['stam','END'],['res','RÉS'],['tec','TEC'],['magic','MAG']];
        const chips=keys.filter(([k])=>m[k]!=null&&m[k]!==1).map(([k,l])=>{
          const pct=Math.round((m[k]-1)*100);
          const pos=pct>0;
          return `<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;background:${pos?'#18c86022':'#e0203022'};color:${pos?'#18c860':'#e02030'}">${l} ${pos?'+':''}${pct}%</span>`;
        }).join(' ');
        return `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:2px">${chips}</div>`;
      })()}
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
  ${(()=>{
    // MODE LITE : les 6 sliders de base (jeu classique)
    if(!(window.isComplet && window.isComplet())){
      return [['spd','Vitesse'],['sht','Tir'],['def','Défense'],['stam','Endurance'],['tec','Technique'],['res','Résistance bless.']].map(([k,l])=>`
      <div class="frow"><span class="lbl">${l}</span>
        <div class="rrow">
          <input type="range" min="1" max="99" step="1" value="${p.s[k]||50}" id="s_${k}" oninput="document.getElementById('v_${k}').textContent=this.value">
          <span class="rv" id="v_${k}">${p.s[k]||50}</span>
        </div>
      </div>`).join('');
    }
    // MODE COMPLET : attributs détaillés par catégorie
    if(typeof ensurePlayerS2==='function') ensurePlayerS2(p);
    const defs = statDefsFor(p);
    // Garder les 6 sliders de base présents (cachés) pour ne pas casser la
    // sauvegarde/lecture des stats socle par le reste du code.
    const hiddenBase = [['spd'],['sht'],['def'],['stam'],['tec'],['res']].map(([k])=>
      `<input type="hidden" id="s_${k}" value="${p.s[k]||50}"><span id="v_${k}" style="display:none">${p.s[k]||50}</span>`).join('');
    const catBlocks = Object.keys(defs).map(catKey=>{
      const cat = defs[catKey];
      const avg = (typeof catAverage==='function') ? catAverage(p,catKey) : null;
      const rows = cat.stats.map(st=>{
        const v = (p.s2 && p.s2[st.key]!=null) ? p.s2[st.key] : 50;
        const col = (typeof statColor==='function') ? statColor(v) : '#f0c028';
        return `<div class="frow" style="padding:2px 0">
          <span class="lbl" style="font-size:10px">${st.label}</span>
          <div class="rrow">
            <input type="range" min="1" max="99" step="1" value="${v}" id="s2_${st.key}"
              oninput="if(!editP()) return; var pp=editP(); pp.s2=pp.s2||{}; pp.s2['${st.key}']=+this.value; document.getElementById('v2_${st.key}').textContent=this.value; document.getElementById('v2_${st.key}').style.color='${'' }';">
            <span class="rv" id="v2_${st.key}" style="color:${col}">${v}</span>
          </div>
        </div>`;
      }).join('');
      return `<div style="margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:6px;margin:6px 0 3px">
          <span style="width:8px;height:8px;border-radius:2px;background:${cat.color};display:inline-block"></span>
          <span style="font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:${cat.color}">${cat.label}</span>
          ${avg!=null?`<span style="margin-left:auto;font-size:10px;font-weight:800;color:${statColor(avg)}">moy. ${avg}</span>`:''}
        </div>
        ${rows}
      </div>`;
    }).join('');
    return hiddenBase + catBlocks;
  })()}
  ${(()=>{
    // MODE COMPLET : afficher personnalité + traits
    if(!(window.isComplet && window.isComplet())) return '';
    if(typeof ensurePlayerProfile==='function') ensurePlayerProfile(p);
    const perso = (typeof personaOf==='function') ? personaOf(p) : null;
    const activeTraits = Array.isArray(p.traits) ? p.traits.slice() : [];
    const CAT_LABELS={off:'⚔️ Offensif',def:'🛡️ Défensif',tech:'✨ Technique',ment:'🧠 Mental',magie:'🔮 Magie'};
    const allTraits = (window.TRAITS||[]);
    const byCat={};
    allTraits.forEach(t=>{ (byCat[t.cat]=byCat[t.cat]||[]).push(t); });
    const traitsGrid = Object.keys(byCat).map(cat=>`
      <div style="margin-top:5px">
        <div style="font-size:8px;font-weight:800;letter-spacing:1px;color:var(--muted);text-transform:uppercase;margin:4px 0 3px">${CAT_LABELS[cat]||cat}</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${byCat[cat].map(t=>{
            const on=activeTraits.includes(t.id);
            return `<span title="${t.d}" onclick="tgTrait('${t.id}')" style="cursor:pointer;display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;border-radius:12px;padding:3px 9px;transition:all .12s;border:1px solid ${on?'var(--gold)':'var(--b2)'};background:${on?'#f0c02826':'transparent'};opacity:${on?1:.55};color:var(--text)">${t.icon} ${t.n}</span>`;
          }).join('')}
        </div>
      </div>`).join('');
    const traitsHtml = `<div id="traits-grid">${traitsGrid}</div>`;
    const persoHtml = perso ? `
      <div style="display:flex;align-items:center;gap:8px;background:${perso.col}18;border:1px solid ${perso.col}55;border-radius:8px;padding:7px 9px;margin-bottom:6px">
        <span style="font-size:20px">${perso.icon}</span>
        <div style="flex:1">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:900;color:${perso.col};letter-spacing:.5px">${perso.n}</div>
          <div style="font-size:9px;color:var(--muted);line-height:1.3">${perso.d}</div>
        </div>
      </div>` : '';
    return `
      <div class="slbl">Personnalité & Traits <span style="color:var(--muted);font-weight:600;font-size:9px">(cliquez pour activer/désactiver)</span></div>
      ${persoHtml}
      ${traitsHtml}
    `;
  })()}
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
// Active/désactive un trait sur le joueur en cours d'édition.
function tgTrait(id){
  const p=editP(); if(!p) return;
  p.traits=Array.isArray(p.traits)?p.traits:[];
  const i=p.traits.indexOf(id);
  if(i>=0)p.traits.splice(i,1); else p.traits.push(id);
  if(typeof _reRenderOpenPlayerEditor==='function')_reRenderOpenPlayerEditor();
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
  // Stats détaillées (mode Complet) : lire tous les sliders s2_ présents
  if(window.isComplet && window.isComplet()){
    p.s2 = p.s2 || {};
    document.querySelectorAll('[id^="s2_"]').forEach(el=>{
      const key = el.id.slice(3);
      const v = parseInt(el.value);
      if(!isNaN(v)) p.s2[key]=v;
    });
  }
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
      <div style="font-size:10px;color:var(--muted)">Tirs <b style="color:var(--text)">${G.shots[ti]}</b> · Corners <b>${G.corners[ti]}</b> · Touches <b>${(G.throwins&&G.throwins[ti])||0}</b></div>
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
  return{name:T.name,color:T.color,img:T.img||'',badge:T.badge||null,strat:T.strat||'321',
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
// ═══════════════════════════════════════════════════════════
// ÉDITEUR DE BLASON (modale interactive)
// Édite teams[ti].badge (JSON). Aperçu live, aléatoire, préréglages, sauvegarde.
// S'appuie entièrement sur badges.js (BadgeRenderer, libraries, generator).
// ═══════════════════════════════════════════════════════════
let _badgeEdit = { ti:0, badge:null };

function openBadgeEditor(ti){
  if(typeof BadgeSerializer==='undefined'){ alert('Module blason indisponible.'); return; }
  _badgeEdit.ti = ti;
  // Part du blason existant, sinon un défaut aux couleurs de l'équipe.
  const T=teams[ti];
  _badgeEdit.badge = T.badge ? BadgeSerializer.normalize(T.badge)
    : Object.assign(BadgeSerializer.defaults(), { colors:[T.color||'#0b3d91','#ffffff','#ffd700'], text:teamIni(T.name) });
  let modal=document.getElementById('badge-modal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='badge-modal';
    modal.style.cssText='position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:14px';
    modal.addEventListener('click',e=>{ if(e.target===modal) closeBadgeEditor(); });
    document.body.appendChild(modal);
  }
  modal.style.display='flex';
  renderBadgeEditor();
}
function closeBadgeEditor(){ const m=document.getElementById('badge-modal'); if(m) m.style.display='none'; }

function _badgeSet(key,val){ _badgeEdit.badge[key]=val; renderBadgeEditor(); }
function _badgeSetColor(idx,val){ _badgeEdit.badge.colors[idx]=val; renderBadgeEditor(); }
function _badgeRandom(){ _badgeEdit.badge = BadgeGenerator.random({ text:_badgeEdit.badge.text }); renderBadgeEditor(); }
function _badgePreset(id){
  const p=BADGE_PRESETS[id]; if(!p) return;
  _badgeEdit.badge = BadgeSerializer.normalize(Object.assign({}, _badgeEdit.badge, p, { colors:_badgeEdit.badge.colors }));
  renderBadgeEditor();
}
function _badgeReset(){
  const T=teams[_badgeEdit.ti];
  _badgeEdit.badge = Object.assign(BadgeSerializer.defaults(), { colors:[T.color||'#0b3d91','#ffffff','#ffd700'], text:teamIni(T.name) });
  renderBadgeEditor();
}
function _badgeImportFile(ev){
  const f=ev.target.files&&ev.target.files[0]; if(!f) return;
  BadgeImporter.fromFile(f,(badge)=>{
    if(badge){ _badgeEdit.badge=badge; renderBadgeEditor(); if(typeof logEvent==='function') logEvent('⬆ Blason importé !','#40c4ff'); }
    else { try{ alert('Fichier de blason non reconnu (SVG exporté ou JSON attendu).'); }catch(e){} }
  });
  ev.target.value='';
}
function saveBadge(){
  const ti=_badgeEdit.ti;
  teams[ti].badge = BadgeSerializer.normalize(_badgeEdit.badge);
  teams[ti].img=''; teams[ti]._img=null; // le blason prime sur une image importée
  if(typeof BadgeCache!=='undefined') BadgeCache.invalidate(teams[ti].badge);
  try{ renderTB(ti); }catch(e){}
  try{ syncHUD(); }catch(e){}
  logEvent('🛡️ Blason enregistré !', teams[ti].color);
  closeBadgeEditor();
}

function renderBadgeEditor(){
  const modal=document.getElementById('badge-modal'); if(!modal) return;
  const b=_badgeEdit.badge;
  const preview=BadgeRenderer.render(b,{size:150});

  // Générateur de rangée d'options (chips) pour une clé donnée.
  const chips=(key,dict,order)=>order.map(id=>{
    const on=b[key]===id;
    return `<button onclick="_badgeSet('${key}','${id}')" style="padding:4px 9px;border-radius:14px;cursor:pointer;font-size:10px;font-weight:${on?'800':'500'};border:1.5px solid ${on?'var(--gold)':'var(--b1)'};background:${on?'rgba(240,192,40,.16)':'transparent'};color:${on?'var(--gold)':'var(--muted)'};margin:2px">${dict[id]||id}</button>`;
  }).join('');

  const colorRow=(idx,label)=>`
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
      <span style="font-size:10px;color:var(--muted);width:64px">${label}</span>
      <input type="color" value="${b.colors[idx]||'#000000'}" oninput="_badgeSetColor(${idx},this.value)" style="width:34px;height:26px;border:none;border-radius:5px;cursor:pointer;background:none">
      <div style="display:flex;gap:3px;flex-wrap:wrap">${PaletteManager.quick.slice(0,8).map(c=>`<span onclick="_badgeSetColor(${idx},'${c}')" style="width:16px;height:16px;border-radius:4px;background:${c};cursor:pointer;border:1px solid #0006"></span>`).join('')}</div>
    </div>`;

  const section=(title,content)=>`<div style="margin-bottom:12px"><div style="font-size:10px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">${title}</div><div style="display:flex;flex-wrap:wrap">${content}</div></div>`;

  const presetChips=Object.keys(BADGE_PRESETS).map(id=>`<button onclick="_badgePreset('${id}')" style="padding:4px 9px;border-radius:14px;cursor:pointer;font-size:10px;border:1.5px solid var(--b1);background:transparent;color:var(--muted);margin:2px">${id.replace(/_/g,' ')}</button>`).join('');

  const starRow=`<div style="display:flex;align-items:center;gap:8px">
      <input type="range" min="0" max="10" value="${b.stars}" oninput="_badgeSet('stars',+this.value)" style="flex:1">
      <span style="font-size:12px;font-weight:800;color:var(--gold);width:20px;text-align:center">${b.stars}</span>
    </div>`;

  const iconScaleRow=`<div style="display:flex;align-items:center;gap:8px;margin-top:4px">
      <span style="font-size:10px;color:var(--muted);width:64px">Taille icône</span>
      <input type="range" min="0.5" max="1.8" step="0.05" value="${b.iconScale}" oninput="_badgeSet('iconScale',+this.value)" style="flex:1">
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
      <span style="font-size:10px;color:var(--muted);width:64px">Rotation</span>
      <input type="range" min="0" max="360" value="${b.iconRot}" oninput="_badgeSet('iconRot',+this.value)" style="flex:1">
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
      <span style="font-size:10px;color:var(--muted);width:64px">Position Y</span>
      <input type="range" min="-30" max="20" value="${b.iconY}" oninput="_badgeSet('iconY',+this.value)" style="flex:1">
    </div>`;

  modal.innerHTML=`
    <div style="background:var(--panel,#0f0f0f);border:1px solid var(--b1);border-radius:16px;width:min(720px,96vw);max-height:92vh;display:flex;flex-direction:column;overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--b1)">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;letter-spacing:1px;color:var(--gold);text-transform:uppercase">🛡️ Éditeur de blason — ${_esc(teams[_badgeEdit.ti]?.name||'')}</div>
        <button onclick="closeBadgeEditor()" style="background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer">×</button>
      </div>
      <div style="display:flex;gap:14px;padding:14px 16px;overflow:hidden;flex:1;min-height:0">
        <!-- Aperçu -->
        <div style="flex-shrink:0;width:180px;display:flex;flex-direction:column;align-items:center;gap:10px">
          <div style="background:var(--dark,#0a0a0a);border-radius:12px;padding:10px;border:1px solid var(--b1)">${preview}</div>
          <div style="display:flex;gap:6px;align-items:center">
            <div style="background:var(--dark);border-radius:8px;padding:4px">${BadgeRenderer.render(b,{size:32})}</div>
            <span style="font-size:9px;color:var(--muted)">petit aperçu<br>(classement, calendrier)</span>
          </div>
          <button class="btn btng" style="width:100%;justify-content:center;font-size:12px;padding:8px" onclick="_badgeRandom()">🎲 Générer</button>
          <button class="btn btng" style="width:100%;justify-content:center;font-size:13px;padding:9px;font-weight:900" onclick="saveBadge()">✓ Enregistrer</button>
        </div>
        <!-- Contrôles -->
        <div style="flex:1;overflow-y:auto;padding-right:6px">
          ${section('Forme', chips('shape', SvgLibrary.labels, SvgLibrary.order))}
          ${section('Bordure', chips('border', BadgeRenderer.borderLabels, Object.keys(BadgeRenderer.borders)))}
          ${section('Motif de fond', chips('background', PatternLibrary.labels, PatternLibrary.order))}
          ${section('Icône', chips('icon', Object.assign({none:'Aucune'},IconLibrary.labels), ['none'].concat(IconLibrary.order)))}
          <div style="margin-bottom:12px"><div style="font-size:10px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Réglages icône</div>${iconScaleRow}</div>
          <div style="margin-bottom:12px"><div style="font-size:10px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Couleurs</div>${colorRow(0,'Principale')}${colorRow(1,'Secondaire')}${colorRow(2,'Accent')}
            <div style="display:flex;align-items:center;gap:6px;margin-top:5px"><span style="font-size:10px;color:var(--muted);width:64px">Couleur icône</span><input type="color" value="${b.iconColor||'#ffd700'}" oninput="_badgeSet('iconColor',this.value)" style="width:34px;height:26px;border:none;border-radius:5px;cursor:pointer;background:none"></div>
          </div>
          <div style="margin-bottom:12px"><div style="font-size:10px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Texte & année</div>
            <div style="display:flex;gap:6px;margin-bottom:5px">
              <input type="text" maxlength="5" value="${_esc(b.text||'')}" oninput="_badgeSet('text',this.value)" placeholder="Sigle (ex: RCV)" style="flex:1;font-size:11px;padding:5px 7px;border-radius:6px;background:var(--dark);color:#eee;border:1px solid var(--b1)">
              <input type="text" maxlength="4" value="${_esc(String(b.year||''))}" oninput="_badgeSet('year',this.value)" placeholder="Année" style="width:70px;font-size:11px;padding:5px 7px;border-radius:6px;background:var(--dark);color:#eee;border:1px solid var(--b1)">
            </div>
            <input type="text" maxlength="24" value="${_esc(b.motto||'')}" oninput="_badgeSet('motto',this.value)" placeholder="Devise (optionnel)" style="width:100%;font-size:11px;padding:5px 7px;border-radius:6px;background:var(--dark);color:#eee;border:1px solid var(--b1);margin-bottom:5px">
            <label style="font-size:10px;color:var(--muted);display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" ${b.textArc?'checked':''} onchange="_badgeSet('textArc',this.checked)"> Texte en arc</label>
          </div>
          ${section('Icône secondaire', chips('icon2', Object.assign({none:'Aucune'},IconLibrary.labels), ['none'].concat(IconLibrary.order)))}
          <div style="margin-bottom:12px"><div style="font-size:10px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Étoiles</div>${starRow}</div>
          <div style="margin-bottom:10px"><div style="font-size:10px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Préréglages</div><div style="display:flex;flex-wrap:wrap">${presetChips}</div></div>
          <div style="margin-bottom:6px;padding-top:8px;border-top:1px solid var(--b1)"><div style="font-size:10px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Fichier</div>
            <div style="display:flex;gap:5px;flex-wrap:wrap">
              <button class="btn" style="padding:4px 9px;font-size:10px" onclick="BadgeExporter.exportSVG(_badgeEdit.badge, teams[_badgeEdit.ti]?.name||'blason')">⬇ SVG</button>
              <button class="btn" style="padding:4px 9px;font-size:10px" onclick="BadgeExporter.exportPNG(_badgeEdit.badge, teams[_badgeEdit.ti]?.name||'blason')">⬇ PNG</button>
              <button class="btn" style="padding:4px 9px;font-size:10px" onclick="document.getElementById('badge-import-file').click()">⬆ Importer</button>
              <button class="btn" style="padding:4px 9px;font-size:10px" onclick="BadgeExporter.share(_badgeEdit.badge)">🔗 Partager</button>
              <button class="btn" style="padding:4px 9px;font-size:10px" onclick="_badgeReset()">↺ Réinit.</button>
              <input type="file" id="badge-import-file" accept=".svg,.json,image/svg+xml,application/json" style="display:none" onchange="_badgeImportFile(event)">
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

if(typeof window!=='undefined'){
  Object.assign(window,{openBadgeEditor,closeBadgeEditor,renderBadgeEditor,saveBadge,_badgeSet,_badgeSetColor,_badgeRandom,_badgePreset,_badgeReset,_badgeImportFile});
}

// ═══════════════════════════════════════════════════════════
// PAGE SÉLECTION D'ÉQUIPES (navigation en cascade, onglet dédié)
// Flux : Type (Club/Sélection) → Pays → Niveau (Ligue pro / Régional par
// région / District) → Équipe. La cible (Rouges/Bleus) est choisie en haut.
// La hiérarchie suit le lore : la Ligue pro est nationale ; le Régional est
// séparé par région ; le District n'existe que pour certaines régions.
// ═══════════════════════════════════════════════════════════
const TIER_LABELS = {
  pro:          'Ligue professionnelle',
  regional:     'Régional',
  district:     'District',
  national_team:'Sélection nationale',
};
// Quelles régions possèdent un étage District (structure du lore Valoria).
const REGION_HAS_DISTRICT = { 'Valcourt': true, 'Brumefer': false, 'Le Pilier': true };

let _teamSel = { ti:0, step:'kind', kind:null, country:null, tier:null, region:null, division:null };

// Renvoie les données d'équipes de division pour un PAYS donné, quelle que soit
// la nation. Évite le câblage en dur « Valoria uniquement ». Ajout d'une nation
// = enregistrer ici son (TEAMS, DIVISIONS, byDivision).
function nationTeamsData(country){
  if(country==='Valoria' && window.VALORIA_TEAMS){
    return { teams:window.VALORIA_TEAMS, divisions:window.VALORIA_DIVISIONS||{}, byDivision:window.valoriaTeamsByDivision, loader:'teamSelLoadValoria' };
  }
  if((country==='Le Pilier Céleste'||country==='pilier') && window.PILIER_TEAMS){
    return { teams:window.PILIER_TEAMS, divisions:window.PILIER_DIVISIONS||{}, byDivision:window.pilierTeamsByDivision, loader:'teamSelLoadValoria' };
  }
  return null;
}

function renderTeamSelectPage(){
  const el=document.getElementById('teamsel-out'); if(!el) return;
  const cat=(typeof presetCatalog==='function')?presetCatalog():[];

  const tCol0 = teams[0]?.color||'#e53935';
  const tCol1 = teams[1]?.color||'#2f7fe0';
  const targetBar = `
    <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-3)">
      <span class="fm-label" style="flex-shrink:0">Charger dans</span>
      <button class="fm-btn${_teamSel.ti===0?' fm-btn--primary':''}" style="flex:1${_teamSel.ti===0?';background:'+tCol0+';border-color:var(--ink)':''}" onclick="teamSelTarget(0)">${teams[0]?.name||'Rouges'}</button>
      <button class="fm-btn${_teamSel.ti===1?' fm-btn--primary':''}" style="flex:1${_teamSel.ti===1?';background:'+tCol1+';border-color:var(--ink)':''}" onclick="teamSelTarget(1)">${teams[1]?.name||'Bleus'}</button>
    </div>`;

  const crumb = (label,step)=>`<a onclick="teamSelGoto('${step}')">${label}</a>`;
  const here  = (label)=>`<span class="is-here">${label}</span>`;
  const parts=[];
  parts.push(_teamSel.step==='kind'?here('Type'):crumb('Type','kind'));
  if(_teamSel.kind){ parts.push(_teamSel.step==='country'?here('Pays'):crumb(_teamSel.country||'Pays','country')); }
  if(_teamSel.country && _teamSel.kind==='club'){ parts.push(_teamSel.step==='tier'?here('Niveau'):crumb(_teamSel.tier?(TIER_LABELS[_teamSel.tier]||_teamSel.tier):'Niveau','tier')); }
  if(_teamSel.tier==='regional' || _teamSel.tier==='district'){ parts.push(_teamSel.step==='region'?here('Région'):crumb(_teamSel.region||'Région','region')); }
  if((_teamSel.tier==='regional'||_teamSel.tier==='district') && _teamSel.region){ const _ntdB=nationTeamsData(_teamSel.country); const _dmB=(_ntdB&&_ntdB.divisions)||{}; const dn=(_teamSel.division&&_dmB[_teamSel.division])?_dmB[_teamSel.division].name:'Division'; parts.push(_teamSel.step==='division'?here('Division'):crumb(dn,'division')); }
  if(_teamSel.tier==='pro' && (_teamSel.step==='division' || _teamSel.division)){ const _ntdP=nationTeamsData(_teamSel.country); const _dmP=(_ntdP&&_ntdP.divisions)||{}; const dnP=(_teamSel.division&&_dmP[_teamSel.division])?_dmP[_teamSel.division].name:'Division'; parts.push(_teamSel.step==='division'?here('Division'):crumb(dnP,'division')); }
  const breadcrumb = `<div class="fm-crumbs">${parts.join('<span class="sep">›</span>')}</div>`;

  const title = `<div class="ts-fs__head">
      <div class="fm-title">📚 Sélection d'équipes</div>
      <button class="fm-btn fm-btn--sm" onclick="nav('setup')" title="Retour">✕ Fermer</button>
    </div>`;

  const bigBtn=(label,sub,onclick,col)=>`
    <button class="fm-row" style="width:100%;text-align:left;cursor:pointer;margin-bottom:var(--sp-2)${col?';border-color:'+col:''}" onclick="${onclick}">
      <div class="fm-row__grow">
        <div class="fm-row__title" style="${col?'color:'+col:''}">${label}</div>
        ${sub?`<div class="fm-row__sub">${sub}</div>`:''}
      </div>
      <span style="font-size:18px;color:var(--fg-muted)">›</span>
    </button>`;

  const soon=(label)=>`<div class="fm-row" style="border-style:dashed;opacity:.55;margin-bottom:var(--sp-2)">
      <div class="fm-row__grow"><div class="fm-row__title">${label} <span class="fm-row__sub">— à venir</span></div></div></div>`;

  let body='';

  if(_teamSel.step==='kind'){
    body += bigBtn('⚽ Clubs','Équipes de club, par pays et par niveau',`teamSelPick('kind','club')`,'#2e8b8b');
    body += bigBtn('🏳️ Sélections nationales','Équipes nationales',`teamSelPick('kind','nation')`,'var(--accent)');
  }
  else if(_teamSel.step==='country'){
    const pool=cat.filter(t=> _teamSel.kind==='nation' ? t.kind==='nation' : t.kind==='club');
    let countries=[...new Set(pool.map(t=>t.nation))];
    if(_teamSel.kind!=='nation' && window.PILIER_TEAMS && window.PILIER_TEAMS.length){
      if(!countries.includes('Le Pilier Céleste')) countries.push('Le Pilier Céleste');
    }
    countries=countries.sort();
    if(!countries.length) body='<div class="fm-muted" style="font-size:12px;padding:20px;text-align:center">Aucun pays disponible.</div>';
    countries.forEach(c=>{
      const _ntdC=nationTeamsData(c);
      const n=pool.filter(t=>t.nation===c).length + (_ntdC?_ntdC.teams.length:0);
      body += bigBtn(c, n+' équipe'+(n>1?'s':''), `teamSelPick('country','${c.replace(/'/g,"\\'")}')`);
    });
  }
  else if(_teamSel.step==='tier'){
    const pool=cat.filter(t=>t.kind==='club' && t.nation===_teamSel.country);
    const _ntd=nationTeamsData(_teamSel.country);
    const vteams=_ntd?_ntd.teams:[];
    const countTier=(tr)=> pool.filter(t=>t.tier===tr).length + vteams.filter(t=>t.tier===tr).length;
    const order=['pro','regional','district'];
    order.forEach(tr=>{
      const n=countTier(tr);
      if(n===0){
        if(tr==='district' && !Object.values(REGION_HAS_DISTRICT).some(Boolean)) return;
        body += soon(TIER_LABELS[tr]);
        return;
      }
      const sub = tr==='pro' ? 'Ligue nationale — toutes régions' : tr==='regional' ? 'Championnats régionaux, par région' : 'Divisions de district';
      body += bigBtn(TIER_LABELS[tr]||tr, sub+' · '+n+' équipe'+(n>1?'s':''), `teamSelPick('tier','${tr}')`);
    });
  }
  else if(_teamSel.step==='region'){
    const pool=cat.filter(t=>t.kind==='club' && t.nation===_teamSel.country && t.tier===_teamSel.tier);
    const _ntdR=nationTeamsData(_teamSel.country);
    const vteams=_ntdR?_ntdR.teams.filter(t=>t.tier===_teamSel.tier):[];
    let regions=[...new Set(pool.map(t=>t.region).concat(vteams.map(t=>t.region)).filter(Boolean))];
    if(_teamSel.tier==='district') regions=regions.filter(r=>REGION_HAS_DISTRICT[r]);
    if(!regions.length){
      const known=Object.keys(REGION_HAS_DISTRICT).filter(r=>_teamSel.tier!=='district'||REGION_HAS_DISTRICT[r]);
      known.forEach(r=>{ body += soon(r); });
      if(!known.length) body='<div class="fm-muted" style="font-size:12px;padding:20px;text-align:center">Aucune région disponible.</div>';
    }
    regions.sort().forEach(r=>{
      const n=pool.filter(t=>t.region===r).length + vteams.filter(t=>t.region===r).length;
      body += bigBtn('Région de '+r, n+' équipe'+(n>1?'s':''), `teamSelPick('region','${r.replace(/'/g,"\\'")}')`);
    });
  }
  else if(_teamSel.step==='division'){
    const _ntdD=nationTeamsData(_teamSel.country);
    const _divMap=_ntdD?_ntdD.divisions:{};
    const _byDiv=_ntdD?_ntdD.byDivision:null;
    const divs=Object.entries(_divMap)
      .filter(([id,d])=>{
        if(d.tier!==_teamSel.tier) return false;
        if(_teamSel.tier==='pro') return true;
        return d.region===_teamSel.region;
      })
      .sort((a,b)=>a[1].order-b[1].order);
    if(!divs.length) body='<div class="fm-muted" style="font-size:12px;padding:20px;text-align:center">Aucune division.</div>';
    divs.forEach(([id,d])=>{
      const n=(_byDiv?_byDiv(id):[]).length;
      body += bigBtn(d.name, n+' équipe'+(n>1?'s':''), `teamSelPick('division','${id}')`);
    });
  }
  else if(_teamSel.step==='teams'){
    let pool=cat.filter(t=>{
      if(_teamSel.kind==='nation') return t.kind==='nation' && t.nation===_teamSel.country;
      if(t.kind!=='club' || t.nation!==_teamSel.country) return false;
      if(_teamSel.tier && t.tier!==_teamSel.tier) return false;
      if((_teamSel.tier==='regional'||_teamSel.tier==='district') && _teamSel.region && t.region!==_teamSel.region) return false;
      return true;
    });
    let vpool=[];
    const _ntdT=nationTeamsData(_teamSel.country);
    if(_teamSel.kind!=='nation' && _ntdT){
      vpool=_ntdT.teams.filter(t=>{
        if(_teamSel.tier && t.tier!==_teamSel.tier) return false;
        if(_teamSel.division) return t.division===_teamSel.division;
        if(_teamSel.tier==='district' && _teamSel.region) return t.region===_teamSel.region;
        if(_teamSel.tier==='pro') return true;
        return false;
      });
    }
    if(!pool.length && !vpool.length) body='<div class="fm-muted" style="font-size:12px;padding:20px;text-align:center">Aucune équipe ici.</div>';
    const crestOf=(t)=> (t.badge&&typeof BadgeCache!=='undefined')
      ? `<img src="${BadgeCache.dataURI(t.badge,60)}" alt="">`
      : `<div class="fallback" style="color:${t.color};background:${t.color}18">${(t.name||'?').slice(0,2).toUpperCase()}</div>`;
    // Carte façon FUT : OVR (haut-gauche), blason, nom, mini-stats att/mil/déf.
    const teamCard=(t,sub,onclick)=>{
      const st = (typeof teamCardStats==='function') ? teamCardStats(t) : null;
      const ovr = st ? st.ovr : null;
      const ovrCol = ovr!=null ? _ovrColor(ovr) : 'var(--fg-dim)';
      const cell=(v,lbl)=>`<div class="ts-card__stat"><b>${v!=null?v:'—'}</b><span>${lbl}</span></div>`;
      const statsRow = st
        ? `<div class="ts-card__stats">${cell(st.att,'ATT')}${cell(st.mid,'MIL')}${cell(st.def,'DÉF')}</div>`
        : `<div class="ts-card__sub" style="margin-top:auto;padding-top:var(--sp-2)">${sub}</div>`;
      return `<div class="ts-card" style="--ovr:${ovrCol}" onclick="${onclick}">
          ${ovr!=null?`<div class="ts-card__ovr" style="background:${ovrCol}"><b>${ovr}</b><span>OVR</span></div>`:''}
          <div class="ts-card__crest">${crestOf(t)}</div>
          <div class="ts-card__name">${t.name}</div>
          ${statsRow}
        </div>`;
    };
    let cards='';
    pool.forEach(t=>{
      const gm = window.gameMode || '7v7';
      const fixedLbl = gm==='7v7' ? '⭐ Effectif fixe' : (gm==='5v5' ? '🔄 Futsal' : '🔄 11v11');
      const sub = t.kind==='nation' ? '🏳️ '+t.nation : fixedLbl;
      cards += teamCard(t, sub, `teamSelLoad('${t.presetId}')`);
    });
    vpool.forEach(t=>{
      const _dm=(_ntdT&&_ntdT.divisions)||{};
      const divName=(_dm[t.division])?_dm[t.division].name:'';
      const subLbl = t.parentClub ? `🔗 ${t.parentClub}` : `🏟️ ${divName}`;
      cards += teamCard(t, subLbl, `teamSelLoadValoria('${(t.name||'').replace(/'/g,"\\'")}')`);
    });
    if(cards) body += `<div class="ts-grid">${cards}</div>`;
  }

  let toast='';
  if(_presetToast && Date.now()-_presetToast.t < 4000){
    const slot=_presetToast.into===0?(teams[0]?.name||'Rouges'):(teams[1]?.name||'Bleus');
    toast=`<div class="fm-toast" style="border-color:${_presetToast.col};background:color-mix(in srgb,${_presetToast.col} 15%,transparent)">
      <span style="font-size:15px">✅</span><span><b style="color:${_presetToast.col}">${_presetToast.name}</b> chargée dans <b>${slot}</b>.</span></div>`;
  }

  // Plein écran : conteneur large pour la grille de cartes (étape "teams"),
  // colonne centrée plus étroite pour les étapes de navigation.
  const isGrid = (_teamSel.step==='teams');
  const inner = isGrid
    ? `${title}${targetBar}${toast}${breadcrumb}${body}`
    : `<div style="max-width:560px;margin:0 auto">${title}${targetBar}${toast}${breadcrumb}${body}</div>`;
  el.innerHTML=`<div class="ts-fs">${inner}</div>`;
}


// ── OVR + mini-stats (att/mil/déf) par équipe, façon FIFA ────────────────
// On calcule la moyenne globale (OVR) et par ligne à partir de l'effectif réel
// stocké dans savedTeams (retrouvé par _presetId). Coûteux si répété, donc on
// met en cache par presetId/nom. Le cache se vide si l'effectif change de taille.
const _teamOvrCache = {};
function _statAvg(p){
  const s=p&&p.s||{};
  return ((s.sht||50)+(s.spd||50)+(s.def||50)+(s.stam||50)+(s.tec||50)+(s.res||50))/6;
}
function _posLine(pos){
  pos=(pos||'').toUpperCase();
  if(pos==='GB') return 'gk';
  if(pos[0]==='D') return 'def';
  if(pos[0]==='M') return 'mid';
  if(pos[0]==='A') return 'att';   // ATT, AD, AG
  return 'mid';
}
// Hash stable d'une chaîne (pour une variation déterministe par équipe).
function _seedFromName(str){
  let h=0; str=String(str||'');
  for(let i=0;i<str.length;i++){ h=(h*31 + str.charCodeAt(i))|0; }
  return Math.abs(h);
}
// OVR de base attendu par palier/division, pour les équipes générées à la volée
// (championnats Valoria/Pilier) qui n'ont pas d'effectif détaillé. Donne des
// notes cohérentes et STABLES (mêmes valeurs à chaque affichage).
function _tierBaseOvr(teamRef){
  const tier=(teamRef&&teamRef.tier)||'regional';
  // Fourchette centrale par palier.
  const base = tier==='pro' ? 78 : tier==='regional' ? 64 : tier==='district' ? 52 : 60;
  // Ajustement selon le "niveau" de division si disponible (D1>D2>…).
  let divAdj = 0;
  const div = String((teamRef&&teamRef.division)||'');
  const m = div.match(/(\d+)/);
  if(m){ divAdj = -(parseInt(m[1],10)-1)*3; } // chaque cran de division ≈ -3
  // Variation stable par équipe : ±6.
  const seed = _seedFromName((teamRef&&teamRef.name)||'');
  const jitter = (seed % 13) - 6;
  const ovr = Math.max(38, Math.min(90, base + divAdj + jitter));
  // Répartition att/mil/déf autour de l'OVR, variée mais déterministe.
  const a = Math.max(35, Math.min(93, ovr + ((seed>>3)%7) - 3));
  const md= Math.max(35, Math.min(93, ovr + ((seed>>6)%7) - 3));
  const d = Math.max(35, Math.min(93, ovr + ((seed>>9)%7) - 3));
  return { ovr:ovr, att:a, mid:md, def:d, approx:true };
}
// Renvoie {ovr, att, mid, def} pour une équipe (0-99). Utilise l'effectif réel
// s'il existe, sinon une estimation stable basée sur le palier/division.
function teamCardStats(teamRef){
  const key = (teamRef && (teamRef.presetId || teamRef._presetId || teamRef.name)) || null;
  // Retrouver l'effectif complet.
  let squad = null;
  if(teamRef && Array.isArray(teamRef.players) && teamRef.players.length){
    squad = teamRef;
  } else if(key && typeof savedTeams!=='undefined'){
    squad = savedTeams.find(t=>t && (t._presetId===key || t._presetId===teamRef.presetId || t.name===teamRef.name));
  }
  // Pas d'effectif détaillé (équipe générée à la volée) → estimation par palier.
  if(!squad || !Array.isArray(squad.players) || !squad.players.length){
    return _tierBaseOvr(teamRef);
  }

  const all=[...squad.players, ...(squad.bench||[])];
  const cacheKey = key + ':' + all.length;
  if(_teamOvrCache[cacheKey]) return _teamOvrCache[cacheKey];

  const lines={def:[],mid:[],att:[]};
  let sum=0;
  all.forEach(p=>{
    const v=_statAvg(p); sum+=v;
    const ln=_posLine(p.pos);
    if(ln!=='gk') lines[ln].push(v);
  });
  const avg=arr=>arr.length?Math.round(arr.reduce((a,b)=>a+b,0)/arr.length):null;
  const res={
    ovr: Math.round(sum/all.length),
    att: avg(lines.att), mid: avg(lines.mid), def: avg(lines.def),
  };
  _teamOvrCache[cacheKey]=res;
  return res;
}
// Couleur d'un OVR (échelle FIFA : or / argent / bronze-ish adaptée au thème).
function _ovrColor(ovr){
  if(ovr>=82) return '#f0c028';   // or
  if(ovr>=72) return '#25d366';   // vert
  if(ovr>=60) return '#3aa0ff';   // bleu
  if(ovr>=48) return '#c8c8d0';   // argent
  return '#a87a4a';               // bronze
}

function teamSelTarget(ti){ _teamSel.ti=ti; renderTeamSelectPage(); }
function teamSelGoto(step){
  _teamSel.step=step;
  if(step==='kind'){ _teamSel.kind=null; _teamSel.country=null; _teamSel.tier=null; _teamSel.region=null; _teamSel.division=null; }
  else if(step==='country'){ _teamSel.country=null; _teamSel.tier=null; _teamSel.region=null; _teamSel.division=null; }
  else if(step==='tier'){ _teamSel.tier=null; _teamSel.region=null; _teamSel.division=null; }
  else if(step==='region'){ _teamSel.region=null; _teamSel.division=null; }
  else if(step==='division'){ _teamSel.division=null; }
  renderTeamSelectPage();
}
function teamSelPick(key,val){
  _teamSel[key]=val;
  if(key==='kind'){ _teamSel.step='country'; }
  else if(key==='country'){ _teamSel.step = _teamSel.kind==='nation' ? 'teams' : 'tier'; }
  else if(key==='tier'){
    if(val==='regional'||val==='district'){ _teamSel.step='region'; }
    else {
      // Tier pro : s'il existe plusieurs ligues pro (ex : Pilier = GTD + Zénith),
      // on insère une étape de choix de division ; sinon on va direct aux équipes.
      const _ntd=nationTeamsData(_teamSel.country);
      const proDivs=_ntd?Object.entries(_ntd.divisions).filter(([id,d])=>d.tier==='pro'):[];
      _teamSel.step = proDivs.length>1 ? 'division' : 'teams';
    }
  }
  else if(key==='region'){ _teamSel.step = (_teamSel.tier==='regional'||_teamSel.tier==='district') ? 'division' : 'teams'; }
  else if(key==='division'){ _teamSel.step='teams'; }
  renderTeamSelectPage();
}
function teamSelLoad(presetId){
  _presetPick.ti = _teamSel.ti;
  const loadedInto = _teamSel.ti;
  loadPresetIntoTeam(presetId);
  // Confort : bascule sur l'autre créneau pour choisir l'adversaire ensuite.
  _teamSel.ti = loadedInto===0 ? 1 : 0;
  renderTeamSelectPage();
}

// Charge une équipe de division Valoria (VALORIA_TEAMS) dans un créneau. Son
// effectif est généré à la volée, avec un niveau (OVR) échelonné selon le
// palier : pro > régional > district. Le blason (déterministe) est appliqué.
function loadValoriaTeamIntoSlot(name, ti){
  const vt=(window.VALORIA_TEAMS||[]).find(t=>t.name===name)
        || (window.PILIER_TEAMS||[]).find(t=>t.name===name);
  if(!vt){ logEvent('❌ Équipe introuvable','#e02030'); return; }
  const tierOvr = vt.tier==='pro'?70 : vt.tier==='regional'?60 : 52; // district plus faible
  const gen = mkCupNPCTeamData({name:vt.name,color:vt.color,ovr:tierOvr}, Math.abs(_hashStr(vt.name))%9999);
  teams[ti].name = vt.name;
  teams[ti].color = vt.color;
  teams[ti].img = '';
  teams[ti]._img = null;
  teams[ti].badge = vt.badge || (typeof BadgeGenerator!=='undefined'? BadgeGenerator.fromSeed(vt.name):null);
  teams[ti].strat = '321';
  teams[ti].players = gen.players;
  teams[ti].bench = gen.bench;
  teams[ti].reserves = gen.reserves;
  try{ renderTB(ti); }catch(e){}
  try{ syncHUD(); }catch(e){}
  try{ if(typeof applyFormationRoles==='function') applyFormationRoles(ti); }catch(e){}
  try{ if(typeof placeKickoff==='function') placeKickoff(G._kickoffTi!==undefined?G._kickoffTi:0); }catch(e){}
  _presetToast = { name:vt.name, col:vt.color, into:ti, t:Date.now() };
  logEvent(`📚 ${vt.name} chargée !`, vt.color);
}
function _hashStr(s){ let h=0; for(let i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))|0; } return h; }
function teamSelLoadValoria(name){
  const into=_teamSel.ti;
  loadValoriaTeamIntoSlot(name, into);
  _teamSel.ti = into===0?1:0;
  renderTeamSelectPage();
}
if(typeof window!=='undefined'){
  Object.assign(window,{renderTeamSelectPage,teamSelTarget,teamSelGoto,teamSelPick,teamSelLoad,teamSelLoadValoria,loadValoriaTeamIntoSlot});
}

// ═══════════════════════════════════════════════════════════
// SÉLECTEUR D'ÉQUIPES PRÉENREGISTRÉES (façon FIFA/PES)
// Modale filtrable par type (club / sélection), pays et ligue. Charge
// l'effectif fixe choisi dans le créneau d'équipe ti. Autonome : ne dépend
// que de presetCatalog()/PRESET_TEAMS (presets.js) et du format savedTeams.
// ═══════════════════════════════════════════════════════════
let _presetPick = { ti:0, kind:'all', country:'all', league:'all' };
let _presetToast = null; // bandeau de confirmation éphémère après un chargement

function openPresetPicker(ti){
  _presetPick = { ti, kind:'all', country:'all', league:'all' };
  _presetToast = null;
  let modal=document.getElementById('preset-modal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='preset-modal';
    modal.style.cssText='position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px';
    modal.addEventListener('click',e=>{ if(e.target===modal) closePresetPicker(); });
    document.body.appendChild(modal);
  }
  modal.style.display='flex';
  renderPresetPicker();
}
function closePresetPicker(){ const m=document.getElementById('preset-modal'); if(m) m.style.display='none'; }
function setPresetFilter(key,val){ _presetPick[key]=val; renderPresetPicker(); }

function renderPresetPicker(){
  const modal=document.getElementById('preset-modal'); if(!modal) return;
  const cat = (typeof presetCatalog==='function') ? presetCatalog() : [];
  // Valeurs de filtres disponibles
  const countries=[...new Set(cat.map(t=>t.country))].sort();
  const leagues=[...new Set(cat.filter(t=>_presetPick.country==='all'||t.country===_presetPick.country).map(t=>t.league))].sort();
  // Application des filtres
  const filtered=cat.filter(t=>
    (_presetPick.kind==='all'||t.kind===_presetPick.kind) &&
    (_presetPick.country==='all'||t.country===_presetPick.country) &&
    (_presetPick.league==='all'||t.league===_presetPick.league)
  );
  const chip=(active,label,onclick)=>`<button onclick="${onclick}" style="padding:5px 11px;border-radius:20px;cursor:pointer;font-size:11px;font-weight:700;border:1.5px solid ${active?'var(--gold,#f0c028)':'var(--b1,#333)'};background:${active?'rgba(240,192,40,.16)':'transparent'};color:${active?'var(--gold,#f0c028)':'var(--muted,#888)'}">${label}</button>`;
  const kindRow=[
    chip(_presetPick.kind==='all','Tous',`setPresetFilter('kind','all')`),
    chip(_presetPick.kind==='club','⚽ Clubs',`setPresetFilter('kind','club')`),
    chip(_presetPick.kind==='nation','🏳️ Sélections',`setPresetFilter('kind','nation')`),
  ].join('');
  const countryRow=[chip(_presetPick.country==='all','Tous pays',`setPresetFilter('country','all')`)]
    .concat(countries.map(c=>chip(_presetPick.country===c,c,`setPresetFilter('country','${c}')`))).join('');
  const leagueRow=[chip(_presetPick.league==='all','Toutes ligues',`setPresetFilter('league','all')`)]
    .concat(leagues.map(l=>chip(_presetPick.league===l,l,`setPresetFilter('league','${l.replace(/'/g,"\\'")}')`))).join('');

  const cards=filtered.map(t=>`
    <div style="display:flex;align-items:center;gap:10px;padding:9px 11px;border:1px solid var(--b1,#2a2a2a);border-radius:10px;background:var(--dark,#141414);margin-bottom:7px">
      <div style="width:34px;height:34px;border-radius:50%;flex-shrink:0;background:${t.color}22;border:2px solid ${t.color}77;display:flex;align-items:center;justify-content:center;font-weight:900;color:${t.color};font-size:12px">${(t.name||'?').slice(0,2).toUpperCase()}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:800;font-size:13px;color:var(--text,#eee)">${t.name}</div>
        <div style="font-size:10px;color:var(--muted,#888)">${t.kind==='nation'?'🏳️ Sélection':'⚽ Club'} · ${t.country} · ${t.league}</div>
      </div>
      <button onclick="loadPresetIntoTeam('${t.presetId}')" style="padding:6px 13px;border-radius:8px;cursor:pointer;font-weight:800;font-size:11px;border:none;background:${t.color};color:#fff;flex-shrink:0">Choisir</button>
    </div>`).join('') || '<div style="color:var(--muted,#888);font-size:12px;text-align:center;padding:24px">Aucune équipe pour ces filtres.</div>';

  modal.innerHTML=`
    <div style="background:var(--panel,#0f0f0f);border:1px solid var(--b1,#2a2a2a);border-radius:16px;width:min(560px,94vw);max-height:88vh;display:flex;flex-direction:column;overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--b1,#2a2a2a)">
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;letter-spacing:1px;color:#fff;text-transform:uppercase">📚 Équipes préenregistrées</div>
        <button onclick="closePresetPicker()" style="background:none;border:none;color:var(--muted,#888);font-size:22px;cursor:pointer;line-height:1">×</button>
      </div>
      <div style="padding:12px 16px;border-bottom:1px solid var(--b1,#2a2a2a);display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;gap:6px;flex-wrap:wrap">${kindRow}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${countryRow}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${leagueRow}</div>
      </div>
      <div style="padding:12px 16px;overflow-y:auto;flex:1">
        ${(()=>{
          if(_presetToast && Date.now()-_presetToast.t < 4000){
            const slot = _presetToast.into===0 ? (teams[0]?.name||'Rouges') : (teams[1]?.name||'Bleus');
            return `<div style="display:flex;align-items:center;gap:8px;padding:8px 11px;border-radius:8px;background:${_presetToast.col}22;border:1px solid ${_presetToast.col}66;margin-bottom:10px;font-size:11px;color:var(--text,#eee)">
              <span style="font-size:14px">✅</span><span><b style="color:${_presetToast.col}">${_presetToast.name}</b> chargée dans <b>${slot}</b>. Choisis l'adversaire ci-dessous.</span></div>`;
          }
          return '';
        })()}
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <span style="font-size:10px;color:var(--muted,#888);flex-shrink:0">Charger dans :</span>
          <button onclick="setPresetTarget(0)" style="flex:1;padding:5px 8px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:800;border:1.5px solid ${_presetPick.ti===0?(teams[0]?.color||'#e53935'):'var(--b1,#333)'};background:${_presetPick.ti===0?(teams[0]?.color||'#e53935')+'22':'transparent'};color:${_presetPick.ti===0?(teams[0]?.color||'#ff8a80'):'var(--muted,#888)'}">${teams[0]?.name||'Rouges'}</button>
          <button onclick="setPresetTarget(1)" style="flex:1;padding:5px 8px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:800;border:1.5px solid ${_presetPick.ti===1?(teams[1]?.color||'#2f7fe0'):'var(--b1,#333)'};background:${_presetPick.ti===1?(teams[1]?.color||'#2f7fe0')+'22':'transparent'};color:${_presetPick.ti===1?(teams[1]?.color||'#82b1ff'):'var(--muted,#888)'}">${teams[1]?.name||'Bleus'}</button>
        </div>
        ${cards}
      </div>
    </div>`;
}

// Change le créneau cible (Rouges/Bleus) sans fermer la modale.
function setPresetTarget(ti){ _presetPick.ti=ti; renderPresetPicker(); }

// Charge l'effectif fixe d'un preset dans le créneau d'équipe courant.
function loadPresetIntoTeam(presetId){
  const preset=(window.PRESET_TEAMS||[]).find(p=>p.presetId===presetId);
  if(!preset){ logEvent('❌ Équipe préenregistrée introuvable','#e02030'); return; }
  const ti=_presetPick.ti;
  // On passe par le même convertisseur que l'injection au registre pour garantir
  // un effectif au format runtime complet, puis on le dépose dans teams[ti].
  const saved = (typeof _presetToSavedTeam==='function')
    ? _presetToSavedTeam(preset)
    : null;
  const src = saved || (window.savedTeams||[]).find(t=>t&&t._presetId===presetId);
  if(!src){ logEvent('❌ Impossible de charger cette équipe','#e02030'); return; }
  // Deep clone pour ne pas partager de références avec le registre.
  const clone=JSON.parse(JSON.stringify(src));
  teams[ti].name = clone.name;
  teams[ti].color = clone.color;
  teams[ti].img = clone.img||'';
  teams[ti]._img = null;
  teams[ti].badge = clone.badge||null;
  teams[ti].strat = clone.strat||'321';
  teams[ti].players = clone.players||[];
  teams[ti].bench = clone.bench||[];
  teams[ti].reserves = clone.reserves||[];
  // Rafraîchir l'UI comme après tout changement d'effectif.
  try{ renderTB(ti); }catch(e){}
  try{ syncHUD(); }catch(e){}
  try{ if(typeof applyFormationRoles==='function') applyFormationRoles(ti); }catch(e){}
  try{ if(typeof updateCompoPitch==='function') updateCompoPitch(); }catch(e){}
  // IMPORTANT : replacer les joueurs sur le terrain. Sans ça, les joueurs
  // fraîchement chargés gardent x:0,y:0 et s'empilent en haut à gauche.
  try{ if(typeof placeKickoff==='function') placeKickoff(G._kickoffTi!==undefined?G._kickoffTi:0); }catch(e){}
  logEvent(`📚 ${clone.name} chargée !`, clone.color);
  // On garde la modale ouverte et on bascule automatiquement sur l'AUTRE
  // créneau : flux naturel « je choisis Rouges puis Bleus » sans rouvrir.
  const other = ti===0 ? 1 : 0;
  _presetPick.ti = other;
  _presetToast = { name:clone.name, col:clone.color, into:ti, t:Date.now() };
  renderPresetPicker();
}

if(typeof window!=='undefined'){
  Object.assign(window,{openPresetPicker,closePresetPicker,setPresetFilter,renderPresetPicker,loadPresetIntoTeam,setPresetTarget});
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
  'Perrin','Laurent','Garcia','Torres','Romero','Silva','Costa','Ferreira','Diaz','Santos',
  'Moreau','Simon','Michel','Leroy','Roux','David','Bertrand','Robert','Richard','Petit',
  'Durand','Dubois','Moreno','Fernandez','Lopez','Gomez','Marino','Bianchi','Rossi','Greco',
  'Meyer','Weber','Schmitt','Bauer','Wagner','Muller','Klein','Hansen','Nielsen','Larsen',
  'Novak','Horvat','Kovac','Petrov','Ivanov','Popa','Adeyemi','Okafor','Traore','Diallo',
  'Nakamura','Tanaka','Kim','Park','Chen','Wang','Ali','Hassan','Aziz','Haddad'];
// Renvoie un nom aléatoire (utilisé pour les joueurs générés en complément
// d'effectif). Évite les doublons via un set optionnel.
function randPlayerName(used){
  const pool = AI_NAMES;
  for(let tries=0; tries<12; tries++){
    const n = pool[Math.floor(Math.random()*pool.length)];
    if(!used || !used.has(n)){ if(used) used.add(n); return n; }
  }
  return pool[Math.floor(Math.random()*pool.length)];
}
window.randPlayerName = randPlayerName;

// Estime un "niveau" de génération (dh…d1) à partir de l'OVR moyen d'une
// équipe, pour que les joueurs de complément aient des stats cohérentes avec
// le reste de l'effectif (plus de joueurs "district" ridicules dans une bonne
// équipe).
function fillLevelForTeam(T){
  try{
    const ps=(T&&T.players?T.players:[]).filter(p=>p&&p.s);
    if(!ps.length) return 'r1';
    const ovr=ps.reduce((a,p)=>{const v=Object.values(p.s);return a+(v.reduce((x,y)=>x+y,0)/v.length);},0)/ps.length;
    if(ovr>=78) return 'd1';
    if(ovr>=66) return 'd2';
    if(ovr>=55) return 'd3';
    if(ovr>=44) return 'r1';
    if(ovr>=33) return 'r2';
    if(ovr>=22) return 'r3';
    return 'dh';
  }catch(e){ return 'r1'; }
}
window.fillLevelForTeam = fillLevelForTeam;
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
    spells:spellForPos(ROLE[i],name),race:pickRaceForRegion('',name+tid+i),x:0,y:0,vx:0,vy:0,tx:0,ty:0,hp:100,mp:100,yc:0,red:false,stunT:0,hasBall:false,
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
    spells:spellForPos(['MC','ATT','DC','DD','MC'][i],name),race:pickRaceForRegion('',name+tid+i),x:-10,y:PCY,vx:0,vy:0,tx:-10,ty:PCY,hp:100,mp:100,yc:0,red:false,stunT:0,hasBall:false,
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
    spells:spellForPos(['GB','DC','ATT'][i]||'MC',name),race:pickRaceForRegion('',name+tid+i),x:-10,y:PCY,vx:0,vy:0,tx:-10,ty:PCY,hp:100,mp:100,yc:0,red:false,stunT:0,hasBall:false,
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
function saveLeague(){
  _safeLSSet('footsim7v7_league',leagueState);
  // Sauvegarder aussi dans le profil actif si possible
  if(activeProfile() && leagueState){
    const id = activeProfile()?._lastActiveLeague || null;
    saveCompetition('league', id, leagueState,
      leagueState.name || `Ligue S${leagueState.season||1}`);
  }
}
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
    fixtures:genFixtures(allT),currentFix:null,
    gameMode: window.gameMode}; // sauvegarder le mode
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
  // Marquer quelles équipes sont humaines (pour le coach IA de l'adversaire).
  // team0 = home, team1 = away.
  (function(){
    const ht=leagueState.teams.find(t=>t.id===fix.home);
    const at=leagueState.teams.find(t=>t.id===fix.away);
    const isHuman=t=>!!(t&&(t.isUser||(t.isSaved&&savedTeams[t.savedIdx]&&savedTeams[t.savedIdx].isHuman)));
    G._humanTeams=[isHuman(ht), isHuman(at)];
  })();
  _lastNav='league';_prepareTeamsForMode();resetMatch();G.leagueMode=true;
  // Restaurer le mode de jeu de la ligue
  if(leagueState.window.gameMode && leagueState.window.gameMode !== window.gameMode){
    setGameMode(leagueState.window.gameMode);
  }
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
  if(lt.valoriaName){
    // Équipe de division Valoria : effectif généré à la volée (mis en cache sur
    // la référence de coupe), niveau selon le palier, blason déterministe.
    if(!lt._gen){
      const vt=(window.VALORIA_TEAMS||[]).find(t=>t.name===lt.valoriaName);
      const ovr = lt.tier==='pro'?70 : lt.tier==='regional'?60 : 52;
      const g = mkCupNPCTeamData({name:lt.name,color:lt.color,ovr}, Math.abs(_hashStr(lt.valoriaName))%9999);
      lt._gen = { name:lt.name, color:lt.color, strat:'321',
        badge:(vt&&vt.badge)||null, players:g.players, bench:g.bench, reserves:g.reserves };
    }
    return lt._gen;
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
      // ── Sélecteur de mode ──────────────────────────────────
      '<div style="display:flex;gap:6px;margin-bottom:10px">'+
      '<button onclick="setGameMode(\'5v5\');renderLeague()" style="flex:1;padding:7px;border-radius:8px;border:2px solid '+(window.gameMode==='5v5'?'#8840e0':'var(--b1)')+';background:'+(window.gameMode==='5v5'?'rgba(136,64,224,.15)':'var(--dark)')+';color:'+(window.gameMode==='5v5'?'#8840e0':'var(--muted)')+';font-size:12px;font-weight:900;cursor:pointer">⚡ 5v5</button>'+
      '<button onclick="setGameMode(\'7v7\');renderLeague()" style="flex:1;padding:7px;border-radius:8px;border:2px solid '+(window.gameMode==='7v7'?'var(--gold)':'var(--b1)')+';background:'+(window.gameMode==='7v7'?'rgba(240,192,40,.15)':'var(--dark)')+';color:'+(window.gameMode==='7v7'?'var(--gold)':'var(--muted)')+';font-size:12px;font-weight:900;cursor:pointer">⚽ 7v7</button>'+
      '<button onclick="setGameMode(\'11v11\');renderLeague()" style="flex:1;padding:7px;border-radius:8px;border:2px solid '+(window.gameMode==='11v11'?'#18c860':'var(--b1)')+';background:'+(window.gameMode==='11v11'?'rgba(24,200,96,.15)':'var(--dark)')+';color:'+(window.gameMode==='11v11'?'#18c860':'var(--muted)')+';font-size:12px;font-weight:900;cursor:pointer">⚽ 11v11</button>'+
      '</div>'+
      // ─────────────────────────────────────────────────────
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'+
      '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:15px;font-weight:900;letter-spacing:2px;color:var(--gold)">🏆 NOUVELLE SAISON '+(window.gameMode==='11v11'?'<span style="color:#18c860;font-size:11px">11v11</span>':'<span style="color:var(--gold);font-size:11px">7v7</span>')+'</div>'+
      '<div style="display:flex;gap:3px">'+
      '<button class="btn" style="padding:2px 7px;font-size:9px" onclick="exportData()" title="Exporter JSON">⬇ JSON</button>'+
      '<label class="btn" style="padding:2px 7px;font-size:9px;cursor:pointer" title="Importer JSON">⬆ Import<input type="file" accept=".json" style="display:none" onchange="importData(this)"></label>'+
      '</div></div>'+
      '<div style="font-size:10px;color:var(--muted);line-height:1.6;margin-bottom:10px">Championnat aller-simple · max '+(window.gameMode==='11v11'?'12':'12')+' équipes.<br>Sauvegarde tes équipes (onglet Équipes) pour les ajouter.</div>'+
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
      '<button class="btn btng" style="width:100%;justify-content:center;margin-top:10px" onclick="confirmCreateLeague()">▶ Créer la ligue '+(window.gameMode==='11v11'?'11v11':'7v7')+'</button>'+
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
  // ── Sélecteur de mode ──────────────────────────────────────────────
  h+='<div style="display:flex;gap:6px;margin-bottom:8px">'+
    '<button onclick="setGameMode(\'5v5\');renderLeague()" style="flex:1;padding:6px;border-radius:8px;border:2px solid '+(window.gameMode==='5v5'?'#8840e0':'var(--b1)')+';background:'+(window.gameMode==='5v5'?'rgba(136,64,224,.15)':'var(--dark)')+';color:'+(window.gameMode==='5v5'?'#8840e0':'var(--muted)')+';font-size:11px;font-weight:900;cursor:pointer">⚡ 5v5</button>'+
    '<button onclick="setGameMode(\'7v7\');renderLeague()" style="flex:1;padding:6px;border-radius:8px;border:2px solid '+(window.gameMode==='7v7'?'var(--gold)':'var(--b1)')+';background:'+(window.gameMode==='7v7'?'rgba(240,192,40,.15)':'var(--dark)')+';color:'+(window.gameMode==='7v7'?'var(--gold)':'var(--muted)')+';font-size:11px;font-weight:900;cursor:pointer">⚽ 7v7</button>'+
    '<button onclick="setGameMode(\'11v11\');renderLeague()" style="flex:1;padding:6px;border-radius:8px;border:2px solid '+(window.gameMode==='11v11'?'#18c860':'var(--b1)')+';background:'+(window.gameMode==='11v11'?'rgba(24,200,96,.15)':'var(--dark)')+';color:'+(window.gameMode==='11v11'?'#18c860':'var(--muted)')+';font-size:11px;font-weight:900;cursor:pointer">⚽ 11v11</button>'+
    '</div>';
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
        '<span style="display:flex;align-items:center;gap:4px;min-width:0"><span style="width:18px;height:18px;flex-shrink:0;display:flex;align-items:center;justify-content:center">'+((typeof teamBadgeRefHTML==='function')?teamBadgeRefHTML(t,18):'<span style="width:5px;height:5px;border-radius:50%;background:'+t.color+'"></span>')+'</span>'+
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
        '<span style="display:flex;align-items:center;justify-content:flex-end;gap:4px;min-width:0"><span style="font-family:\'Barlow Condensed\',sans-serif;font-size:10px;font-weight:700;color:'+hT.color+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+hT.name+'</span><span style="width:16px;height:16px;flex-shrink:0;display:flex;align-items:center;justify-content:center">'+((typeof teamBadgeRefHTML==='function')?teamBadgeRefHTML(hT,16):'')+'</span></span>'+
        '<span style="font-size:9px;color:var(--muted);padding:0 3px">vs</span>'+
        '<span style="display:flex;align-items:center;gap:4px;min-width:0"><span style="width:16px;height:16px;flex-shrink:0;display:flex;align-items:center;justify-content:center">'+((typeof teamBadgeRefHTML==='function')?teamBadgeRefHTML(aT,16):'')+'</span><span style="font-family:\'Barlow Condensed\',sans-serif;font-size:10px;font-weight:700;color:'+aT.color+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+aT.name+'</span></span>'+
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
  {id:'gr_final',name:'Play-offs (poule finale)',          desc:"Deux poules initiales, puis les deux premiers de chaque groupe se retrouvent dans une poule finale de 4. Le classement de cette poule décide du vainqueur et de l'ordre des montées.",  type:'groups_final', legs:1, thirdPlace:false},
];

let cupState=null,cupCurrentMatch=null;
let _cupFmt='elim',_cupCount=8;
// Group phase options (used for formats with groups)
let _cupGC=2,_cupPG=4,_cupGroupLegs=1,_cupAdvance=2; // nb poules, équipes/poule, matchs A/R en poule, qualifiés/poule

function saveCup(){
  _safeLSSet('footsim7v7_cup',cupState);
  if(activeProfile() && cupState){
    const id = activeProfile()?._lastActiveCup || null;
    saveCompetition('cup', id, cupState,
      cupState.name || `Coupe ${cupState.formatId||''}`);
  }
}
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
  const hasGroups=fmt.type==='groups_ko'||fmt.type==='round_robin'||fmt.type==='groups_final';
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
  } else if(fmt.type==='groups_final'){
    // Play-offs : 2 poules initiales → poule finale des 2 premiers de chaque groupe.
    state.phase='groups';
    const gfCfg={gc:2,pg:cfg.pg,advance:2};
    state.groupCfg=gfCfg;
    state.groups=buildGroupsAuto(ids,{gc:2,pg:cfg.pg},groupLegs).map(g=>({...g,phase:'initial'}));
    state.finalGroupLegs=groupLegs;
    state.bracket=null;
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
  if(cupState.format.type==='groups_final'){ checkGroupsFinalDone(); return; }
  if(!cupState.groups?.every(g=>g.fixtures.every(f=>f.played)))return;
  if(cupState.format.type==='round_robin'){
    const std=sortStd(cupState.groups[0].standings);
    cupState.champion=std[0].id;cupState.phase='done';
    logEvent('🏆 '+(getCupTeamData(cupState.champion)?.name||'')+' remporte la coupe !','#f0c028');
    saveCup();return;
  }
  cupState.bracket=generateKOFromGroups();cupState.phase='knockout';saveCup();
}

// ── Play-offs : poule finale des 2 premiers de chaque groupe initial ──
function checkGroupsFinalDone(){
  const groups=cupState.groups||[];
  const finalGroup=groups.find(g=>g.phase==='final');
  if(!finalGroup){
    // Étape 1 : tous les groupes initiaux terminés → construire la poule finale.
    const initials=groups.filter(g=>g.phase==='initial');
    if(!initials.length||!initials.every(g=>g.fixtures.every(f=>f.played)))return;
    const qualified=[];
    initials.forEach(g=>{
      const s=sortStd(g.standings);
      for(let r=0;r<Math.min(2,s.length);r++)qualified.push(s[r].id);
    });
    if(qualified.length<2)return;
    const legs=cupState.finalGroupLegs||1;
    cupState.groups.push({
      id:groups.length,name:'Poule finale',teamIds:qualified,
      fixtures:mkFix(qualified,legs),standings:mkStd(qualified),legs,phase:'final'
    });
    logEvent('⚽ Poule finale : '+qualified.map(id=>getCupTeamData(id)?.name||'?').join(', '),'#f0c028');
    saveCup();return;
  }
  // Étape 2 : poule finale terminée → vainqueur + ordre des montées.
  if(!finalGroup.fixtures.every(f=>f.played))return;
  const std=sortStd(finalGroup.standings);
  cupState.champion=std[0].id;
  cupState.finalRanking=std.map(s=>s.id); // ordre des promotions (1er = mieux placé)
  cupState.phase='done';
  logEvent('🏆 '+(getCupTeamData(cupState.champion)?.name||'')+' remporte les play-offs !','#f0c028');
  saveCup();
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
  _setCupHumanTeams(hId,aId);
  _lastNav='cup';_prepareTeamsForMode();resetMatch();G.leagueMode=true;
  nav('match');syncHUD();renderTB(0);renderTB(1);
  const hN=cupState.teams.find(t=>t.id===fix.home)?.name||hD.name;
  const aN=cupState.teams.find(t=>t.id===fix.away)?.name||aD.name;
  const legLbl=leg===2?' (Retour — terrain adverse)':fix?.legs===2?' (Aller)':'';
  logEvent('Coupe : '+hN+' ⬡ '+aN+legLbl,'#f0c028');
  showPreMatch();
}

// Détermine quelles équipes d'un match de coupe (standalone) sont humaines,
// pour que le coach IA ne pilote QUE les équipes PNJ. hId/aId = ids des
// équipes home/away déjà résolus (après swap éventuel du match retour).
function _setCupHumanTeams(hId,aId){
  try{
    const lt=id=>cupState&&cupState.teams.find(t=>t.id===id);
    const isHuman=t=>!!(t&&(t.isUser||(t.isSaved&&savedTeams[_resolveSavedIdx(t)]&&savedTeams[_resolveSavedIdx(t)].isHuman)));
    G._humanTeams=[isHuman(lt(hId)), isHuman(lt(aId))];
  }catch(e){ G._humanTeams=[true,true]; }
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
  _setCupHumanTeams(hId,aId);
  _lastNav='cup';_prepareTeamsForMode();resetMatch();G.leagueMode=true;
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
  // ── Sélecteur de mode ────────────────────────────────────────────
  h+='<div style="display:flex;gap:6px;margin-bottom:8px">'+
    '<button onclick="setGameMode(\'7v7\');renderCup()" style="flex:1;padding:6px;border-radius:8px;border:2px solid '+(window.gameMode==='7v7'?'var(--gold)':'var(--b1)')+';background:'+(window.gameMode==='7v7'?'rgba(240,192,40,.15)':'var(--dark)')+';color:'+(window.gameMode==='7v7'?'var(--gold)':'var(--muted)')+';font-size:11px;font-weight:900;cursor:pointer">⚽ 7v7</button>'+
    '<button onclick="setGameMode(\'11v11\');renderCup()" style="flex:1;padding:6px;border-radius:8px;border:2px solid '+(window.gameMode==='11v11'?'#18c860':'var(--b1)')+';background:'+(window.gameMode==='11v11'?'rgba(24,200,96,.15)':'var(--dark)')+';color:'+(window.gameMode==='11v11'?'#18c860':'var(--muted)')+';font-size:11px;font-weight:900;cursor:pointer">⚽ 11v11</button>'+
    '</div>';
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
    s:{spd:55,sht:55,def:55,stam:55,tec:55,res:55},spells:spellForPos('MC',name),race:pickRaceForRegion('',name),ini:name.slice(0,2).toUpperCase(),onBench:src==='bench'});
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
    spells:spellForPos(pos,names[idx%AI_NAMES.length]),race:pickRaceForRegion('',names[idx%AI_NAMES.length]+pos+idx),
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


// ── COUPES STRUCTURÉES DE VALORIA ────────────────────────────────────────
// Construit la liste d'équipes d'une coupe à partir des équipes de Valoria.
//  • 'national' : toutes les équipes du pays.
//  • 'division' : uniquement les équipes de la division donnée.
// L'équipe du joueur (Rouges) est incluse en tête pour qu'elle participe.
function buildValoriaCupTeams(scope, divisionId){
  const src = window.VALORIA_TEAMS || [];
  const pool = scope==='division' ? src.filter(t=>t.division===divisionId) : src.slice();
  const allT=[{id:0,name:teams[0].name,color:teams[0].color,isUser:true,uIdx:0}];
  pool.forEach(vt=>{
    allT.push({ id:allT.length, name:vt.name, color:vt.color,
      valoriaName:vt.name, tier:vt.tier, division:vt.division });
  });
  return allT;
}

// Lance une coupe Valoria (nationale ou de division) via le moteur KO existant
// (buildKOBracketForN gère n'importe quel N grâce aux byes).
function startValoriaCup(scope, divisionId){
  if(typeof teams==='undefined' || !teams[0]){ return; }
  const tList = buildValoriaCupTeams(scope, divisionId);
  if(tList.length<4){ if(typeof logEvent==='function') logEvent('❌ Pas assez d\'équipes pour une coupe.','#e02030'); return; }
  const fmt = (typeof CUP_FORMATS!=='undefined') ? (CUP_FORMATS.find(f=>f.id==='knockout')||CUP_FORMATS.find(f=>f.type==='knockout')||CUP_FORMATS[0]) : {id:'knockout',type:'knockout',legs:1,singleFinal:true};
  const ids = [...tList].sort(()=>Math.random()-.5).map(t=>t.id);
  const divName = (scope==='division' && window.VALORIA_DIVISIONS && window.VALORIA_DIVISIONS[divisionId]) ? window.VALORIA_DIVISIONS[divisionId].name : '';
  cupState = {
    formatId:fmt.id, format:fmt, teams:tList, phase:'knockout',
    champion:null, thirdPlaceMatch:null, playerStats:{},
    name: scope==='national' ? 'Coupe de Valoria' : ('Coupe — '+divName),
    valoriaScope: scope, valoriaDivision: divisionId||null,
  };
  cupState.bracket = buildKOBracketForN(ids, fmt.legs, fmt.singleFinal);
  if(fmt.thirdPlace) cupState.thirdPlaceMatch = (typeof mkTie==='function')?mkTie(null,null,1):null;
  cupCurrentMatch=null;
  saveCup();
  renderCup();
  if(typeof logEvent==='function') logEvent('🏆 '+cupState.name+' — '+tList.length+' équipes !', '#f0c028');
}
if(typeof window!=='undefined'){ Object.assign(window,{startValoriaCup,buildValoriaCupTeams}); }

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
// CARRIÈRE V2 — Interface
// ═══════════════════════════════════════════════════════════

function renderCareerV2(){
  const el = document.getElementById('career-out'); if(!el) return;
  if(!careerV2){ renderCareerV2Choice(); return; }
  // Générer les données manquantes (carrière ancienne ou migration)
  if(careerV2.type === 'director'){
    let needSave = false;
    if(!careerV2.fixtures || careerV2.fixtures.length === 0){ _generateSeasonFixtures(); needSave=true; }
    if(!careerV2.freeAgents || careerV2.freeAgents.length === 0){ _generateFreeAgents(); needSave=true; }
    if(!careerV2.youthPool){ careerV2.youthPool = []; _generateYouthIntake(); needSave=true; }
    // Rattrapage : simuler en fond tous les matchs PNJ dont la date est déjà
    // passée (migration d'anciennes carrières, ou fixtures fraîchement générées
    // pour une saison en cours). Garantit un classement à jour à l'ouverture.
    try{
      if(typeof _simulateBackgroundNpcFixtures==='function'){
        if(_simulateBackgroundNpcFixtures(careerV2.date) > 0) needSave = true;
      }
    }catch(e){ console.error('npc bg sim:',e); }
    if(needSave) saveCareerV2();
  }
  if(careerV2.type === 'director') renderCareerDirector(el);
  else renderCareerManager(el);
  try{ _updateSeasonFooter(); }catch(e){}
}

// ── Écran de choix : Manager ou Dirigeant ────────────────────────────
function renderCareerV2Choice(){
  const el = document.getElementById('career-out'); if(!el) return;
  const hasOldCareer = !!careerState;

  let h = '<div style="padding:12px;max-width:600px;margin:0 auto">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">';
  h += '<div style="font-size:20px;font-weight:900;color:var(--gold);letter-spacing:2px">⚽ CARRIÈRE</div>';
  h += '<button class="btn" onclick="nav(\'setup\')" style="font-size:9px;padding:3px 10px">&larr; Retour au jeu</button>';
  h += '</div>';
  h += '<div style="font-size:11px;color:var(--muted);margin-bottom:16px">Choisissez votre rôle, puis votre pays et votre club.</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">';
  // Manager
  h += '<div onclick="renderCareerManagerSetup()" style="background:var(--panel);border:2px solid #8840e0;border-radius:12px;padding:16px;cursor:pointer">';
  h += '<div style="font-size:28px;text-align:center;margin-bottom:8px">🧑</div>';
  h += '<div style="font-size:14px;font-weight:900;color:#b070ff;text-align:center;margin-bottom:6px">MANAGER</div>';
  h += '<div style="font-size:10px;color:var(--muted);line-height:1.5">Tu es l\'entraineur. Tu diriges les matchs, geres la tactique, peux etre embauche ou vire.</div>';
  h += '<div style="margin-top:10px;font-size:9px;color:#8840e0">⚡ Tactique · Matchs · Reputation coach</div>';
  h += '</div>';
  // Dirigeant
  h += '<div onclick="renderCareerDirectorSetup()" style="background:var(--panel);border:2px solid var(--gold);border-radius:12px;padding:16px;cursor:pointer">';
  h += '<div style="font-size:28px;text-align:center;margin-bottom:8px">🏛</div>';
  h += '<div style="font-size:14px;font-weight:900;color:var(--gold);text-align:center;margin-bottom:6px">DIRIGEANT</div>';
  h += '<div style="font-size:10px;color:var(--muted);line-height:1.5">Tu es president / directeur sportif. Tu geres le budget, le mercato, l\'infrastructure.</div>';
  h += '<div style="margin-top:10px;font-size:9px;color:var(--gold)">💰 Mercato · Finances · Infrastructure</div>';
  h += '</div>';
  h += '</div>';
  if(hasOldCareer){
    h += '<div style="background:var(--panel);border:1px solid rgba(240,192,40,0.25);border-radius:10px;padding:12px;margin-bottom:12px">';
    h += '<div style="font-size:11px;font-weight:800;color:var(--gold);letter-spacing:.5px;margin-bottom:4px">📂 Ancienne carriere detectee</div>';
    h += '<div style="font-size:10px;color:var(--muted);line-height:1.5;margin-bottom:8px">Ce mode classique n\'est plus mis a jour. Vous pouvez terminer votre partie en cours, mais les nouvelles carrieres utilisent le moteur ameliore ci-dessus (calendrier jour par jour, matchs PNJ simules en fond, coupes).</div>';
    h += '<button class="btn btng" onclick="renderCareer()" style="font-size:10px;width:100%">Reprendre l\'ancienne carriere</button>';
    h += '</div>';
  }
  h += '</div>';
  el.innerHTML = h;
}


// ── Setup Carrière Dirigeant : choix de la région et du club ─────────
// ── Flow : Pays → Région → Club ─────────────────────────────────────

function renderCareerDirectorSetup(){
  const el = document.getElementById('career-out'); if(!el) return;
  _renderCountryStep(el, 'director');
}

function _renderCountryStep(el, mode){
  const nations = WORLDS.nations;
  let h = '<div style="padding:12px;max-width:600px;margin:0 auto">';
  h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">';
  h += '<button class="btn" onclick="renderCareerV2Choice()" style="font-size:10px;padding:2px 8px">&larr; Retour</button>';
  h += '<div style="font-size:15px;font-weight:900;color:var(--gold)">🌍 Choisissez votre pays</div>';
  h += '</div>';
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px">';
  nations.forEach(function(n){
    h += '<div class="nation-card" data-nation="' + n.id + '" data-mode="' + mode + '"'
      + ' style="background:var(--panel);border:2px solid ' + n.color + ';border-radius:12px;padding:14px;cursor:pointer">';
    h += '<div style="font-size:28px;text-align:center;margin-bottom:6px">' + n.flag + '</div>';
    h += '<div style="font-size:14px;font-weight:900;color:' + n.color + ';text-align:center">' + n.name + '</div>';
    h += '<div style="font-size:9px;color:var(--muted);text-align:center;margin-top:4px">' + n.subtitle + '</div>';
    h += '<div style="font-size:9px;color:var(--muted);margin-top:8px;line-height:1.4">' + n.philosophy.slice(0,80) + '...</div>';
    h += '<div style="margin-top:8px;font-size:9px;color:' + n.color + '">' + n.regions.length + ' régions · ' + n.pyramid.length + ' niveaux</div>';
    h += '</div>';
  });
  h += '</div></div>';
  el.innerHTML = h;
  document.querySelectorAll('.nation-card').forEach(function(card){
    card.addEventListener('click', function(){
      var nid = card.dataset.nation;
      var m   = card.dataset.mode;
      window._careerNation = nid;
      window._careerMode   = m;
      _renderRegionStep(el, nid, m);
    });
  });
}

function _renderRegionStep(el, nationId, mode){
  const nation = WORLDS.get(nationId);
  if(!el || !nation) return;
  let h = '<div style="padding:12px;max-width:700px;margin:0 auto">';
  h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
  h += '<button class="btn" id="back-to-nations" style="font-size:10px;padding:2px 8px">&larr; Retour</button>';
  h += '<div style="font-size:14px;font-weight:900;color:' + nation.color + '">' + nation.flag + ' ' + nation.name + ' — Région</div>';
  h += '</div>';
  h += '<div style="font-size:10px;color:var(--muted);margin-bottom:12px">Vous commencerez tout en bas de la pyramide locale.</div>';
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:8px">';
  nation.regions.forEach(function(r){
    var startLevel = _getStartLevel(r);
    var pyramid = nation.pyramid.find(function(p){return p.id===startLevel;});
    h += '<div class="region-card" data-region="' + r.id + '"'
      + ' style="background:var(--panel);border:2px solid var(--b1);border-radius:10px;padding:10px;cursor:pointer;transition:border .15s">';
    h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">';
    h += '<div style="width:10px;height:10px;border-radius:50%;background:' + r.color + ';flex-shrink:0"></div>';
    h += '<div style="font-size:11px;font-weight:900;color:var(--fg)">' + r.name + '</div>';
    h += '</div>';
    h += '<div style="font-size:8px;color:var(--muted);margin-bottom:4px">' + r.type + '</div>';
    h += '<div style="font-size:8px;color:var(--muted);line-height:1.3;margin-bottom:6px">' + r.desc.slice(0,70) + '...</div>';
    h += '<div style="font-size:8px;color:' + r.color + ';font-weight:700">Départ : ' + (pyramid ? pyramid.name : startLevel) + '</div>';
    h += '<div style="font-size:8px;margin-top:4px">' + '💰'.repeat(r.wealth) + ' ' + '⭐'.repeat(r.talent) + '</div>';
    h += '</div>';
  });
  h += '</div></div>';
  el.innerHTML = h;
  document.getElementById('back-to-nations').addEventListener('click', function(){
    _renderCountryStep(el, mode);
  });
  document.querySelectorAll('.region-card').forEach(function(card){
    var rid = card.dataset.region;
    var region = WORLDS.getRegion(nationId, rid);
    card.addEventListener('mouseover', function(){ card.style.borderColor = region ? region.color : ''; });
    card.addEventListener('mouseout',  function(){ if(window._careerRegion !== rid) card.style.borderColor = ''; });
    card.addEventListener('click', function(){
      window._careerRegion = rid;
      if(mode === 'manager'){
        // Le manager n'a pas de club à créer : on démarre directement la
        // recherche de poste, dans la nation choisie.
        window._selectedManagerRegion = rid;
        startCareerManager(rid, nationId);
      } else {
        _renderClubStep(el, nationId, rid, mode);
      }
    });
  });
}

// Fiche détaillée d'un club Valoria façon "Choose Team" (ton fun/manga).
// Grand blason + nom, puis une grille de stats générées déterministe­ment.
function _valoriaClubCard(t, divName){
  if(!t) return '';
  const d = (typeof valoriaClubDetails==='function') ? valoriaClubDetails(t) : null;
  const col = t.color || '#888';
  const bigBadge = (t.badge && typeof BadgeCache!=='undefined')
    ? '<img src="'+BadgeCache.dataURI(t.badge,64)+'" width="64" height="64" style="object-fit:contain">'
    : '<div style="width:64px;height:64px;border-radius:50%;background:'+col+'33;border:3px solid '+col+';display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:'+col+'">'+teamIni(t.name)+'</div>';

  // Barre de réputation en ★ (sur 5, dérivée du /100)
  const repStars = d ? Math.max(1,Math.round(d.reputation/20)) : 3;
  const stars = function(n){ return '★★★★★'.slice(0,n)+'☆☆☆☆☆'.slice(0,5-n); };

  let c = '<div style="background:linear-gradient(135deg,'+col+'22,transparent);border:2px solid '+col+';border-radius:12px;padding:14px;margin-bottom:6px">';
  // En-tête : blason + nom + division
  c += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">';
  c += '<div style="flex-shrink:0">'+bigBadge+'</div>';
  c += '<div style="min-width:0">';
  c += '<div style="font-size:18px;font-weight:900;color:'+col+';line-height:1.1">'+t.name+'</div>';
  if(d) c += '<div style="font-size:11px;font-style:italic;color:var(--text);opacity:.85">« '+d.nickname+' »</div>';
  c += '<div style="font-size:9px;color:var(--muted);margin-top:2px">🏟️ '+(divName||'')+'</div>';
  c += '</div></div>';

  if(d){
    // Objectif du board mis en avant (comme "Board Expectation")
    c += '<div style="background:var(--dark);border-radius:8px;padding:8px 10px;margin-bottom:10px;display:flex;align-items:center;gap:8px">';
    c += '<span style="font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Objectif</span>';
    c += '<span style="font-size:12px;font-weight:800;color:'+col+'">'+d.boardGoal+'</span>';
    c += '</div>';
    // Grille de détails
    const cell = function(label,val){
      return '<div style="background:var(--dark);border-radius:7px;padding:7px 9px">'
        +'<div style="font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">'+label+'</div>'
        +'<div style="font-size:11px;font-weight:700;color:var(--text)">'+val+'</div></div>';
    };
    c += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
    c += cell('📅 Fondé en', d.founded);
    c += cell('⭐ Réputation', stars(repStars)+' <span style="color:var(--muted);font-size:9px">('+d.reputation+')</span>');
    c += cell('🏟️ Stade', d.stadium+'<br><span style="color:var(--muted);font-size:9px">'+d.capacity.toLocaleString('fr-FR')+' places</span>');
    c += cell('📊 Statut', d.status);
    c += cell('💰 Finances', d.finances);
    c += cell('🏋️ Entraînement', stars(d.training));
    c += cell('🌱 Centre jeunes', stars(d.youth));
    c += '</div>';
  }
  // Bouton reprendre
  c += '<button id="career-take-club" class="btn btng" style="width:100%;margin-top:12px;font-size:13px;padding:9px;background:'+col+'">✅ Reprendre '+t.name+'</button>';
  c += '</div>';
  return c;
}

function _careerPickPilierDiv(divId){
  window._careerPilierDiv = divId;
  window._careerClubPreview = null; // forcer la re-sélection du 1er club de la nouvelle division
  const el = document.getElementById('career-out') || document.getElementById('career-director-content');
  if(el) _renderClubStep(el, window._careerNation||'pilier', window._careerRegion, window._careerMode||'director');
}
function _careerPickValoriaDiv(divId){
  window._careerValoriaDiv = divId;
  window._careerClubPreview = null; // forcer la re-sélection du 1er club de la nouvelle division
  const el = document.getElementById('career-out') || document.getElementById('career-director-content');
  if(el) _renderClubStep(el, window._careerNation||'valoria', window._careerRegion, window._careerMode||'director');
}
// Divisions Valoria proposables au choix pour une région donnée : la Ligue
// pro (nationale, commune aux deux régions) + toutes les divisions régionales
// de la région du joueur, triées par ordre hiérarchique.
function _valoriaSelectableDivs(regionId){
  const divMap = window.VALORIA_DIVISIONS || {};
  const regName = (typeof _valRegionName==='function') ? _valRegionName(regionId) : 'Valcourt';
  const prefix = regName==='Brumefer' ? 'brumefer_' : 'valcourt_';
  return Object.entries(divMap)
    .filter(([id,d]) => id==='pro' || id.indexOf(prefix)===0)
    .sort((a,b) => (a[1].order||0) - (b[1].order||0))
    .map(([id]) => id);
}

function _renderClubStep(el, nationId, regionId, mode){
  const nation = WORLDS.get(nationId);
  const region = WORLDS.getRegion(nationId, regionId);
  if(!el || !nation || !region) return;
  const startLevel = _getStartLevel(region);
  const pyramid = nation.pyramid.find(function(p){return p.id===startLevel;});

  // Onglet actif : 'create' (créer son équipe) ou 'existing' (reprendre une
  // équipe existante de la division). Par défaut : créer.
  window._careerClubTab = window._careerClubTab || 'create';
  const tab = window._careerClubTab;

  let h = '<div style="padding:12px;max-width:500px;margin:0 auto">';
  h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">';
  h += '<button class="btn" id="back-to-regions" style="font-size:10px;padding:2px 8px">&larr; Retour</button>';
  h += '<div style="font-size:13px;font-weight:900;color:' + region.color + '">' + region.name + ' — Votre club</div>';
  h += '</div>';

  // Récap niveau départ
  h += '<div style="background:var(--dark);border:1px solid ' + region.color + '44;border-radius:8px;padding:10px;margin-bottom:14px">';
  h += '<div style="font-size:10px;color:var(--gold);font-weight:700;margin-bottom:6px">📍 Niveau de départ : ' + (pyramid ? pyramid.name : startLevel) + '</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;color:var(--muted)">';
  h += '<div>🪙 Budget : <b>' + _fmtMoney(WORLDS.startBudget(nationId, regionId)) + '</b></div>';
  h += '<div>⭐ Réputation : <b>' + WORLDS.startReputation(startLevel, region) + '/100</b></div>';
  h += '<div>👥 Effectif : <b>7–12 joueurs</b></div>';
  h += '<div>🏟 Capacité stade : <b>500 places</b></div>';
  h += '</div></div>';

  // ── Onglets : Créer / Reprendre ────────────────────────────────────────
  // Généralisé : disponible pour toute nation ayant un pool d'équipes de
  // division (Valoria via VALORIA_TEAMS, Pilier via PILIER_TEAMS…).
  const _career_isValoria = (nationId==='valoria' && typeof valoriaTeamsByDivision==='function');
  const _career_isPilier  = (nationId==='pilier' && typeof pilierTeamsByDivision==='function');
  const hasExisting = _career_isValoria || _career_isPilier;
  if(hasExisting){
    h += '<div style="display:flex;gap:6px;margin-bottom:12px">';
    h += '<button class="career-club-tab" data-tab="create" style="flex:1;padding:8px;border-radius:8px;cursor:pointer;font-size:11px;font-weight:800;border:2px solid '+(tab==='create'?region.color:'var(--b1)')+';background:'+(tab==='create'?region.color+'22':'var(--dark)')+';color:'+(tab==='create'?'#fff':'var(--muted)')+'">✏️ Créer mon équipe</button>';
    h += '<button class="career-club-tab" data-tab="existing" style="flex:1;padding:8px;border-radius:8px;cursor:pointer;font-size:11px;font-weight:800;border:2px solid '+(tab==='existing'?region.color:'var(--b1)')+';background:'+(tab==='existing'?region.color+'22':'var(--dark)')+';color:'+(tab==='existing'?'#fff':'var(--muted)')+'">📋 Reprendre une équipe</button>';
    h += '</div>';
  }

  if(hasExisting && tab==='existing'){
    // ── REPRENDRE : liste des équipes + FICHE DÉTAILLÉE au clic ────────────
    // Division de départ + pool d'équipes, selon la nation.
    let divId, divTeams, divName, divMap;
    let _pilierDivSelector = '';
    if(_career_isPilier){
      divMap = window.PILIER_DIVISIONS || {};
      // Le joueur peut choisir SA division de départ parmi les 10 du Pilier
      // (window._careerPilierDiv). Par défaut : la 1re Fondation (bas de la
      // pyramide), mais on peut viser plus haut.
      const allDivs = Object.entries(divMap).sort((a,b)=>a[1].order-b[1].order).map(([id])=>id);
      if(!allDivs.includes(window._careerPilierDiv)){
        const fond = Object.entries(divMap).filter(([id,d])=>d.tier==='district').sort((a,b)=>a[1].order-b[1].order).map(([id])=>id);
        window._careerPilierDiv = fond[0] || allDivs[0];
      }
      divId = window._careerPilierDiv;
      divTeams = pilierTeamsByDivision(divId);
      divName = (divMap[divId] ? divMap[divId].name : '');
      // Sélecteur de division (puces cliquables).
      _pilierDivSelector = '<div style="font-size:9px;color:var(--muted);margin-bottom:6px">Division :</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px">';
      allDivs.forEach(function(id){
        const d=divMap[id]; const on=(id===divId);
        _pilierDivSelector += '<button onclick="_careerPickPilierDiv(\''+id+'\')" style="padding:4px 9px;border-radius:14px;cursor:pointer;font-size:9px;font-weight:800;border:1.5px solid '+(on?'var(--gold)':'var(--b1)')+';background:'+(on?'rgba(240,192,40,.16)':'transparent')+';color:'+(on?'var(--gold)':'var(--muted)')+'">'+d.name.replace('Ligue ','').replace('Ligue du ','').replace('Ligue des ','')+'</button>';
      });
      _pilierDivSelector += '</div>';
    } else {
      // VALORIA : même logique de CHOIX de division que le Pilier. Le joueur
      // peut reprendre un club dans n'importe quelle division de sa région
      // (+ la Ligue pro nationale), au lieu d'être coincé sur le seul niveau
      // de départ de la région.
      divMap = window.VALORIA_DIVISIONS || {};
      const allDivs = _valoriaSelectableDivs(regionId);
      // Division par défaut : le niveau de départ normalisé de la région.
      if(!allDivs.includes(window._careerValoriaDiv)){
        const def = (typeof valoriaNormalizeLevel==='function') ? valoriaNormalizeLevel(startLevel, regionId) : null;
        window._careerValoriaDiv = (def && allDivs.includes(def)) ? def : allDivs[allDivs.length-1];
      }
      divId = window._careerValoriaDiv;
      divTeams = divId ? valoriaTeamsByDivision(divId) : [];
      divName = (divId&&divMap[divId]?divMap[divId].name:'');
      // Sélecteur de division (puces cliquables), identique au Pilier.
      _pilierDivSelector = '<div style="font-size:9px;color:var(--muted);margin-bottom:6px">Division :</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px">';
      allDivs.forEach(function(id){
        const d=divMap[id]; if(!d) return; const on=(id===divId);
        _pilierDivSelector += '<button onclick="_careerPickValoriaDiv(\''+id+'\')" style="padding:4px 9px;border-radius:14px;cursor:pointer;font-size:9px;font-weight:800;border:1.5px solid '+(on?'var(--gold)':'var(--b1)')+';background:'+(on?'rgba(240,192,40,.16)':'transparent')+';color:'+(on?'var(--gold)':'var(--muted)')+'">'+d.name.replace('Ligue ','').replace('District ','D').replace(' de Valcourt','').replace(' de Brumefer','')+'</button>';
      });
      _pilierDivSelector += '</div>';
    }
    // Club actuellement déployé (fiche ouverte). Par défaut : le premier.
    if(divTeams.length && !divTeams.some(t=>t.name===window._careerClubPreview)){
      window._careerClubPreview = divTeams[0].name;
    }
    h += '<div style="background:var(--panel);border:1px solid var(--b1);border-radius:8px;padding:12px;margin-bottom:12px">';
    h += '<div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:8px">📋 Choisis ton club</div>';
    h += _pilierDivSelector;
    h += '<div style="font-size:9px;color:var(--muted);margin-bottom:10px">'+divName+' — '+divTeams.length+' clubs</div>';
    if(!divTeams.length){
      h += '<div style="font-size:10px;color:var(--muted)">Aucune équipe existante dans cette division.</div>';
      h += '</div></div>';
      el.innerHTML = h;
      el.querySelectorAll('.career-club-tab').forEach(function(b){ b.addEventListener('click', function(){ window._careerClubTab=b.dataset.tab; _renderClubStep(el, nationId, regionId, mode); }); });
      document.getElementById('back-to-regions').addEventListener('click', function(){ _renderRegionStep(el, nationId, mode); });
      return;
    }
    // FICHE DÉTAILLÉE du club déployé (façon FM, ton fun)
    const sel = divTeams.find(t=>t.name===window._careerClubPreview) || divTeams[0];
    h += _valoriaClubCard(sel, divName);
    // LISTE compacte cliquable
    h += '<div style="font-size:9px;color:var(--muted);margin:12px 0 6px">Autres clubs de la division :</div>';
    h += '<div style="display:flex;flex-direction:column;gap:5px;max-height:240px;overflow-y:auto">';
    divTeams.forEach(function(t){
      const isSel = t.name===sel.name;
      const bHTML = (t.badge && typeof BadgeCache!=='undefined')
        ? '<img src="'+BadgeCache.dataURI(t.badge,26)+'" width="26" height="26" style="object-fit:contain">'
        : '<div style="width:26px;height:26px;border-radius:50%;background:'+t.color+'33;border:2px solid '+t.color+';display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;color:'+t.color+'">'+teamIni(t.name)+'</div>';
      const d = (typeof valoriaClubDetails==='function') ? valoriaClubDetails(t) : null;
      h += '<div class="career-preview-team" data-name="'+t.name.replace(/"/g,'&quot;')+'" style="display:flex;align-items:center;gap:9px;padding:7px 9px;border:1px solid '+(isSel?t.color:'var(--b1)')+';border-radius:8px;cursor:pointer;background:'+(isSel?t.color+'18':'var(--dark)')+'">';
      h += '<span style="width:26px;height:26px;flex-shrink:0;display:flex;align-items:center;justify-content:center">'+bHTML+'</span>';
      h += '<span style="flex:1;min-width:0"><span style="font-size:12px;font-weight:700;color:'+t.color+'">'+t.name+'</span>';
      if(d) h += '<span style="display:block;font-size:8px;color:var(--muted)">'+d.boardGoal+'</span>';
      h += '</span>';
      h += '<span style="font-size:9px;color:var(--muted)">'+(isSel?'👁️':'voir')+'</span>';
      h += '</div>';
    });
    h += '</div>';
    h += '</div>';
    h += '</div>';
    el.innerHTML = h;
    // Onglets
    el.querySelectorAll('.career-club-tab').forEach(function(b){ b.addEventListener('click', function(){ window._careerClubTab=b.dataset.tab; _renderClubStep(el, nationId, regionId, mode); }); });
    document.getElementById('back-to-regions').addEventListener('click', function(){ _renderRegionStep(el, nationId, mode); });
    // Déployer la fiche d'un autre club
    el.querySelectorAll('.career-preview-team').forEach(function(row){
      row.addEventListener('click', function(){
        window._careerClubPreview = row.dataset.name;
        _renderClubStep(el, nationId, regionId, mode);
      });
    });
    // Reprendre le club affiché
    const takeBtn = document.getElementById('career-take-club');
    if(takeBtn){
      takeBtn.addEventListener('click', function(){
        window._careerClub = sel.name;
        window._careerColor = sel.color;
        confirmStartCareer();
      });
    }
    return;
  }

  // ── CRÉER (écran par défaut) ───────────────────────────────────────────

  // Nom du club
  h += '<div style="background:var(--panel);border:1px solid var(--b1);border-radius:8px;padding:12px;margin-bottom:12px">';
  h += '<div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:10px">⚽ Créez votre club</div>';

  h += '<div style="margin-bottom:8px">';
  h += '<label style="font-size:9px;color:var(--muted);display:block;margin-bottom:3px">Nom du club *</label>';
  h += '<input id="club-name-input" type="text" maxlength="30" placeholder="Ex: FC Sirène, AS Profondeurs..."'
    + ' style="width:100%;background:var(--dark);border:1px solid ' + region.color + ';border-radius:6px;'
    + 'color:var(--fg);padding:7px 10px;font-size:12px;font-weight:700;box-sizing:border-box">';
  h += '</div>';

  // Couleur du club
  h += '<div style="margin-bottom:10px">';
  h += '<label style="font-size:9px;color:var(--muted);display:block;margin-bottom:6px">Couleur du club</label>';
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
  var colors = ['#e02030','#1878e8','#18c860','#f0c028','#8840e0','#ff6b00','#00bcd4','#e91e63','#607d8b','#ffffff'];
  colors.forEach(function(col){
    h += '<div class="color-pick" data-color="' + col + '"'
      + ' style="width:28px;height:28px;border-radius:50%;background:' + col + ';cursor:pointer;border:3px solid transparent;transition:border .15s"></div>';
  });
  h += '</div></div>';

  // Suggestions de noms depuis la région
  h += '<div style="margin-bottom:8px">';
  h += '<div style="font-size:9px;color:var(--muted);margin-bottom:4px">Suggestions :</div>';
  h += '<div style="display:flex;gap:4px;flex-wrap:wrap">';
  (region.clubNames || []).slice(0, 6).forEach(function(name){
    h += '<button class="btn club-suggest" data-name="' + name.replace(/"/g,'&quot;') + '"'
      + ' style="font-size:8px;padding:2px 6px">' + name + '</button>';
  });
  h += '</div></div></div>';

  h += '<button class="btn btng" id="career-start-btn" style="width:100%;font-size:12px">&#x25B6; Commencer la carrière</button>';
  h += '</div>';
  el.innerHTML = h;

  // Couleur sélectionnée par défaut = couleur de la région
  window._careerColor = region.color;
  var defaultCol = el.querySelector('[data-color="' + region.color + '"]')
    || el.querySelector('.color-pick');
  if(defaultCol){ defaultCol.style.border = '3px solid white'; window._careerColor = defaultCol.dataset.color; }

  // Events couleurs
  el.querySelectorAll('.color-pick').forEach(function(c){
    c.addEventListener('click', function(){
      el.querySelectorAll('.color-pick').forEach(function(x){ x.style.border='3px solid transparent'; });
      c.style.border = '3px solid white';
      window._careerColor = c.dataset.color;
    });
  });

  // Suggestions noms
  el.querySelectorAll('.club-suggest').forEach(function(btn){
    btn.addEventListener('click', function(){
      var input = document.getElementById('club-name-input');
      if(input) input.value = btn.dataset.name;
    });
  });

  // Retour
  document.getElementById('back-to-regions').addEventListener('click', function(){
    _renderRegionStep(el, nationId, mode);
  });
  // Onglets Créer / Reprendre
  el.querySelectorAll('.career-club-tab').forEach(function(b){
    b.addEventListener('click', function(){ window._careerClubTab=b.dataset.tab; _renderClubStep(el, nationId, regionId, mode); });
  });

  // Démarrer
  document.getElementById('career-start-btn').addEventListener('click', function(){
    var name = (document.getElementById('club-name-input')||{}).value || '';
    name = name.trim();
    if(!name){ logEvent('❌ Entrez un nom de club !','#e02030'); return; }
    window._careerClub = name;
    window._careerColor = window._careerColor || region.color;
    confirmStartCareer();
  });
}


function _getStartLevel(region){
  if(!region || !region.pyramid) return 'dh';
  var p = region.pyramid;
  if(p.district_groups > 0) return 'dh';
  if(p.has_dh)              return 'dh';
  if(p.has_r3)              return 'r3';
  if(p.has_r2)              return 'r2';
  return 'r1';
}

function confirmStartCareer(){
  var nation = window._careerNation || 'panthalassa';
  var region = window._careerRegion;
  var club   = window._careerClub;
  var mode   = window._careerMode || 'director';
  if(!region || !club){ logEvent('Choisissez une région et un club !', '#e02030'); return; }
  if(mode === 'director') startCareerDirector(region, club, nation);
  else startCareerManager(region, nation);
}

// Compatibilité anciens appels
function selectDirectorRegion(rid){ _renderRegionStep(document.getElementById('career-out'), window._careerNation||'panthalassa', rid, 'director'); }
function selectDirectorClub(name){ window._careerClub = name; }
function confirmStartDirector(){ confirmStartCareer(); }



// ── Setup Carrière Manager ────────────────────────────────────────────
function renderCareerManagerSetup(){
  const el = document.getElementById('career-out'); if(!el) return;
  // Le Manager passe désormais par le MÊME choix de pays que le Dirigeant
  // (au lieu d'être codé en dur sur Panthalassa). La cascade pays → région
  // appelle ensuite _renderManagerRegionStep pour ce mode.
  window._careerMode = 'manager';
  _renderCountryStep(el, 'manager');
}

let _selectedManagerRegion = null;

function selectManagerRegion(regionId){
  _selectedManagerRegion = regionId;
  window._selectedManagerRegion = regionId;

  document.querySelectorAll('[id^="mreg-"]').forEach(el=>{
    el.style.borderColor='var(--b1)';
  });
  const region = WORLDS.getRegion('panthalassa',regionId);
  const sel = document.getElementById('mreg-'+regionId);
  if(sel && region) sel.style.borderColor = region.color;

  document.getElementById('manager-start-btn').style.display = 'block';
}

function confirmStartManager(){
  if(!_selectedManagerRegion){ logEvent('❌ Choisissez une région','#e02030'); return; }
  startCareerManager(_selectedManagerRegion);
}

// ── Rendu principal Dirigeant ─────────────────────────────────────────
function renderCareerDirector(el){
  const C = careerV2;
  const club = C.club;
  const region = WORLDS.getRegion(C.nation||'panthalassa', club.region);
  const _nat = WORLDS.get(C.nation) || PANTHALASSA;
  const pyramid = (_nat.pyramid||PANTHALASSA.pyramid).find(function(p){return p.id===club.level;});
  const ss = C.season_stats;
  const budget = club.budget;
  const budgetCol = budget < 0 ? '#e06060' : budget < 500 ? '#f0c028' : '#18c860';

  const tabs = ['overview','squad','mercato','finances','sponsors','infra','staff','calendar'];
  // Onglet Réserves : seulement si le club a des équipes affiliées.
  if(C.affiliates && C.affiliates.length) tabs.push('affiliates');
  const tabLabels = {
    overview:'🏠 Vue', squad:'👥 Effectif', mercato:'🔄 Mercato',
    finances:'💰 Finances', sponsors:'🤝 Sponsors', infra:'🏗 Infra', staff:'👔 Staff', calendar:'📅 Calendrier',
    affiliates:'🏛 Réserves'
  };

  let tabBtns = '';
  tabs.forEach(function(tab){
    tabBtns += '<button id="cdtab-'+tab+'" onclick="renderCareerDirectorTab(\''+tab+'\')"'
      + ' style="flex:1;padding:11px 4px 10px;background:var(--dark);border:none;border-bottom:2px solid transparent;'
      + 'color:var(--muted);font-size:11px;font-weight:800;letter-spacing:.3px;cursor:pointer;transition:color .15s,background .15s,border-color .15s;white-space:nowrap">'
      + tabLabels[tab]+'</button>';
  });

  let html = '<div style="min-height:100vh;background:var(--bg,#060e1a);display:flex;flex-direction:column">';

  // ── Header ──────────────────────────────────────────────────────────
  html += '<div style="background:linear-gradient(135deg,var(--dark) 0%,'+(region?region.color+'22':'#1a2a3a')+' 100%);'
    + 'border-bottom:2px solid '+(region?region.color:'var(--b1)')+';padding:16px 20px">';
  html += '<div style="display:flex;align-items:center;gap:14px">';
  // Logo club
  html += '<div style="width:52px;height:52px;border-radius:12px;background:'
    + club.color+';display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;'
    + 'box-shadow:0 4px 12px '+club.color+'44">🏟</div>';
  // Infos club
  html += '<div style="flex:1;min-width:0">';
  html += '<div style="font-size:22px;font-weight:900;color:var(--fg);letter-spacing:.5px">'+club.name+'</div>';
  html += '<div style="font-size:11px;color:var(--muted);margin-top:2px">';
  html += (region?region.name:'?')+' · '+(club.divisionName || (pyramid?pyramid.name:club.level))+' · Saison '+C.season;
  // Indicateur de PRÉSAISON : tant que la 1re journée n'est pas atteinte, on
  // affiche « Présaison » plutôt qu'un numéro de semaine de championnat.
  const _inPreseason = (C.seasonStartDate && typeof _daysBetween==='function' && _daysBetween(C.date, C.seasonStartDate) > 0);
  if(_inPreseason){
    html += ' · <span style="color:var(--gold);font-weight:700">🌱 Présaison</span> · '+_fmtDateFrLong(C.date);
  } else {
    html += ' · Semaine '+C.week+' · '+_fmtDateFrLong(C.date);
  }
  html += '</div></div>';
  // Budget
  html += '<div style="text-align:right;flex-shrink:0">';
  html += '<div style="font-size:24px;font-weight:900;color:'+budgetCol+'">🪙 '+_fmtMoney(budget)+'</div>';
  html += '<div style="font-size:10px;color:var(--muted)">Mercato : '+_fmtMoney(club.transferBudget)+'</div>';
  html += '</div>';
  html += '</div>';

  // Stats rapides sous le header
  html += '<div style="display:flex;gap:16px;margin-top:12px;flex-wrap:wrap">';
  const statItems = [
    {label:'Points', val:ss.points, col:'#18c860'},
    {label:'Victoires', val:ss.wins, col:'#18c860'},
    {label:'Nuls', val:ss.draws, col:'#f0c028'},
    {label:'Défaites', val:ss.losses, col:'#e06060'},
    {label:'Buts +/-', val:(ss.goals_for-ss.goals_against>0?'+':'')+(ss.goals_for-ss.goals_against), col:ss.goals_for>=ss.goals_against?'#18c860':'#e06060'},
    {label:'Réputation', val:club.reputation+'/100', col:(region?region.color:'var(--gold)')},
  ];
  statItems.forEach(function(s){
    html += '<div style="text-align:center">';
    html += '<div style="font-size:18px;font-weight:900;color:'+s.col+'">'+s.val+'</div>';
    html += '<div style="font-size:9px;color:var(--muted)">'+s.label+'</div>';
    html += '</div>';
  });
  html += '</div>';
  html += '</div>';

  // ── Onglets ──────────────────────────────────────────────────────────
  html += '<div style="display:flex;border-bottom:1px solid var(--b1);background:var(--dark);overflow-x:auto">'+tabBtns+'</div>';

  // ── Contenu ──────────────────────────────────────────────────────────
  html += '<div id="career-director-content" style="flex:1;padding:16px 20px;overflow-y:auto"></div>';

  // ── Footer ──────────────────────────────────────────────────────────
  html += '<div style="padding:12px 20px;border-top:1px solid var(--b1);background:var(--dark);display:flex;gap:8px;align-items:center">';
  html += '<button class="btn" onclick="nav(\'setup\')" style="font-size:11px;padding:6px 14px">← Jeu</button>';
  html += '<button class="btn btng" onclick="_advanceOneDay()" style="flex:1;font-size:13px;padding:10px;font-weight:900">▶ Jour suivant</button>';
  html += '<button class="btn" onclick="abandonCareerV2()" style="font-size:11px;padding:6px 12px;color:#e06060;border-color:#e06060">✕</button>';
  html += '</div>';
  html += '</div>';

  el.innerHTML = html;

  // Activer onglet Vue par défaut
  renderCareerDirectorTab('overview');

  // Style onglet actif (après injection DOM)
  function setActiveTab(tab){
    const accent = (region && region.color) ? region.color : 'var(--gold)';
    document.querySelectorAll('[id^="cdtab-"]').forEach(function(b){
      b.style.borderBottomColor='transparent';
      b.style.color='var(--muted)';
      b.style.background='var(--dark)';
      b.style.boxShadow='none';
    });
    const active = document.getElementById('cdtab-'+tab);
    if(active){
      active.style.borderBottomColor=accent;
      active.style.color='#fff';
      active.style.background='linear-gradient(180deg,rgba(255,255,255,0.04),transparent)';
      active.style.boxShadow='inset 0 -6px 10px -8px '+accent;
    }
  }

  // Réassigner onclick avec highlight
  tabs.forEach(function(tab){
    const btn = document.getElementById('cdtab-'+tab);
    if(btn) btn.addEventListener('click', function(){ setActiveTab(tab); });
  });
  setActiveTab('overview');
}




function renderCareerDirectorTab(tab){
  const el = document.getElementById('career-director-content'); if(!el) return;
  const C = careerV2; const club = C.club;
  document.querySelectorAll('[id^="cdtab-"]').forEach(function(b){b.classList.remove('btng');});
  const activeBtn = document.getElementById('cdtab-'+tab);
  if(activeBtn) activeBtn.classList.add('btng');
  if(tab==='overview') el.innerHTML = _renderDirectorOverview();
  else if(tab==='squad') el.innerHTML = _renderDirectorSquad();
  else if(tab==='mercato') el.innerHTML = _renderDirectorMercato();
  else if(tab==='finances') el.innerHTML = _renderDirectorFinances();
  else if(tab==='sponsors') el.innerHTML = _renderDirectorSponsors();
  else if(tab==='infra') el.innerHTML = _renderDirectorInfra();
  else if(tab==='staff') el.innerHTML = _renderDirectorStaff();
  else if(tab==='calendar') el.innerHTML = _renderDirectorCalendar();
  else if(tab==='affiliates') el.innerHTML = _renderDirectorAffiliates();
  else el.innerHTML = '<div style="color:var(--muted);font-size:10px;padding:10px">A venir...</div>';
}

// ── ONGLET RÉSERVES (équipes affiliées) — étape 1 : affichage ─────────────
function _affOvr(aff){
  const all=[...(aff.players||[]),...(aff.bench||[])];
  if(!all.length) return null;
  let sum=0,n=0;
  all.forEach(function(p){ const v=Object.values(p.s||{}); if(v.length){ sum+=v.reduce((a,b)=>a+b,0)/v.length; n++; } });
  return n?Math.round(sum/n):null;
}
// ── Coupe de Maison — carte de statut (choix du format, classement/bracket) ─
function _houseCupHTML(hc, club){
  const accent = '#c060e0';
  let h = '<div style="background:var(--panel);border:1px solid '+accent+'55;border-left:4px solid '+accent+';border-radius:10px;padding:14px;margin-bottom:14px">';
  h += '<div style="font-size:12px;font-weight:900;color:'+accent+';margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">🏵️ Coupe de la Maison '+hc.house+'</div>';

  if(!hc.started){
    h += '<div style="font-size:11px;color:var(--muted);margin-bottom:10px">Choisissez le format de la petite compétition interne entre les '+hc.teams.length+' équipes de votre Maison :</div>';
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
    h += '<button class="btn btng" onclick="_pickHouseCupFormat(\'roundrobin\')" style="flex:1;min-width:140px;font-size:11px;padding:9px;font-weight:800">🏆 Championnat interne<div style="font-size:8px;font-weight:500;opacity:.8;margin-top:2px">Tous contre tous, une manche</div></button>';
    h += '<button class="btn btng" onclick="_pickHouseCupFormat(\'knockout\')" style="flex:1;min-width:140px;font-size:11px;padding:9px;font-weight:800">⚔️ Élimination directe<div style="font-size:8px;font-weight:500;opacity:.8;margin-top:2px">Tirage au sort, tours secs</div></button>';
    h += '</div>';
    h += '</div>';
    return h;
  }

  // Liste des équipes participantes.
  h += '<div style="font-size:9px;color:var(--muted);margin-bottom:8px">'+hc.teams.length+' équipes · Format : '+(hc.format==='roundrobin'?'Championnat interne':'Élimination directe')+'</div>';

  if(hc.winner){
    h += '<div style="font-size:13px;font-weight:800;color:'+(hc.winner.isPlayer?'#f0c028':'var(--muted)')+'">'+(hc.winner.isPlayer?'👑 Vous avez remporté la coupe de Maison !':('Remportée par '+hc.winner.name))+'</div>';
  } else if(hc.playerOut){
    h += '<div style="font-size:12px;color:#e06060">Éliminé. La coupe se poursuit sans vous.</div>';
  }

  if(hc.format==='roundrobin' && hc.rrStandings){
    const sorted = hc.rrStandings.slice().sort(function(a,b){ return b.Pts-a.Pts || (b.GF-b.GA)-(a.GF-a.GA); });
    h += '<div style="margin-top:6px">';
    sorted.forEach(function(s,i){
      const isMe = hc.teams[s.idx].isPlayer;
      h += '<div style="display:flex;align-items:center;gap:6px;font-size:10px;padding:3px 0;color:'+(isMe?accent:'var(--fg)')+';font-weight:'+(isMe?800:500)+'">';
      h += '<span style="width:14px;color:var(--muted)">'+(i+1)+'</span><span style="flex:1">'+(isMe?'▸ ':'')+s.name+'</span>';
      h += '<span style="color:var(--muted)">'+s.P+'j</span><span style="width:26px;text-align:right">'+s.Pts+'pts</span>';
      h += '</div>';
    });
    h += '</div>';
  } else if(hc.format==='knockout' && hc.bracket){
    const rn = hc.roundNames[hc.round] || (hc.winner?'Terminée':'Tour');
    if(!hc.winner) h += '<div style="font-size:11px;font-weight:700;color:var(--fg);margin-top:4px">Tour actuel : '+rn+'</div>';
    let oppName=null;
    (hc.bracket||[]).forEach(function(m){
      if(m.a&&m.a.isPlayer) oppName = m.b?m.b.name:'(exempt)';
      else if(m.b&&m.b.isPlayer) oppName = m.a?m.a.name:'(exempt)';
    });
    if(oppName && !hc.winner && !hc.playerOut) h += '<div style="font-size:10px;color:var(--muted);margin-top:2px">Prochain adversaire : <b style="color:var(--fg)">'+oppName+'</b></div>';
  }
  h += '</div>';
  return h;
}
function _pickHouseCupFormat(format){
  const C = careerV2; if(!C || !C.houseCup) return;
  _startHouseCup(format);
  try{ saveCareerV2(); }catch(e){}
  const el=document.getElementById('career-director-content'); if(el) el.innerHTML=_renderDirectorAffiliates();
}

function _renderDirectorAffiliates(){
  const C = careerV2;
  const affs = C.affiliates || [];
  if(C.house && affs.length && !C.houseCup && typeof _setupHouseCup==='function'){
    try{ _setupHouseCup(); saveCareerV2(); }catch(e){ console.error('housecup lazy setup:',e); }
  }
  let h = '<div style="padding:14px">';
  h += '<div style="font-size:15px;font-weight:900;color:var(--gold);margin-bottom:4px">🏛 '+(C.house?('Maison '+C.house):'Équipes réserves')+'</div>';
  h += '<div style="font-size:10px;color:var(--muted);margin-bottom:6px">Vos équipes réserves jouent leur propre championnat. Vous pouvez les gérer vous-même ou déléguer.</div>';
  h += '<div style="font-size:9px;color:var(--muted);margin-bottom:14px;padding:7px 9px;border-radius:7px;background:var(--dark);border:1px solid var(--b1)">🏦 Réserves et équipe première partagent le <b>même budget</b> et les <b>mêmes infrastructures</b> (stade, centre de formation, etc.). Vous pouvez faire circuler les joueurs dans les deux sens : <b>↑ promouvoir</b> une pépite ou <b>⬇ envoyer</b> un joueur prendre du temps de jeu.</div>';
  if(C.houseCup) h += _houseCupHTML(C.houseCup, C.club);
  if(!affs.length){
    h += '<div style="font-size:11px;color:var(--muted);text-align:center;padding:24px">Aucune équipe réserve pour le moment.</div>';
    h += '</div>'; return h;
  }
  affs.forEach(function(aff,i){
    const ovr = _affOvr(aff);
    const nb = (aff.players||[]).length + (aff.bench||[]).length;
    const badgeHTML = (aff.badge && typeof BadgeCache!=='undefined')
      ? '<img src="'+BadgeCache.dataURI(aff.badge,40)+'" width="40" height="40" style="object-fit:contain">'
      : '<div style="width:40px;height:40px;border-radius:50%;background:'+aff.color+'33;border:2px solid '+aff.color+';display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:'+aff.color+'">'+(typeof teamIni==='function'?teamIni(aff.name):'?')+'</div>';
    h += '<div style="background:var(--panel);border:1px solid '+aff.color+'55;border-radius:12px;padding:12px;margin-bottom:10px">';
    h += '<div style="display:flex;align-items:center;gap:12px">';
    h += '<div style="flex-shrink:0">'+badgeHTML+'</div>';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-size:14px;font-weight:800;color:'+aff.color+'">'+aff.name+'</div>';
    h += '<div style="font-size:9px;color:var(--muted)">'+(aff.branch?('🔹 '+aff.branch+' · '):'')+(aff.role||'réserve')+'</div>';
    h += '<div style="font-size:9px;color:var(--muted)">🏟️ '+(aff.division||'')+'</div>';
    h += '</div>';
    h += '<div style="text-align:right;flex-shrink:0">';
    if(ovr!=null) h += '<div style="font-size:16px;font-weight:900;color:'+aff.color+'">'+ovr+'</div><div style="font-size:8px;color:var(--muted)">OVR moyen</div>';
    h += '<div style="font-size:9px;color:var(--muted);margin-top:2px">👥 '+nb+' joueurs</div>';
    h += '</div></div>';
    // Boutons : voir l'effectif + gérer/déléguer
    const isOpen = (window._affOpenIdx===i);
    h += '<div style="display:flex;gap:6px;margin-top:10px">';
    h += '<button onclick="_toggleAffiliateSquad('+i+')" style="flex:1;padding:6px;border-radius:7px;cursor:pointer;font-size:10px;font-weight:800;border:1.5px solid '+aff.color+';background:'+aff.color+'18;color:'+aff.color+'">'+(isOpen?'▲ Masquer l\'effectif':'👁 Voir l\'effectif')+'</button>';
    h += '<button onclick="_toggleAffiliateDelegate('+i+')" style="flex:1;padding:6px;border-radius:7px;cursor:pointer;font-size:10px;font-weight:800;border:1.5px solid '+(aff.delegated?'var(--b1)':aff.color)+';background:'+(aff.delegated?'var(--dark)':aff.color+'22')+';color:'+(aff.delegated?'var(--muted)':aff.color)+'">'+(aff.delegated?'🤖 Déléguée':'🎮 Gérée')+'</button>';
    h += '</div>';
    // Bouton : envoyer un joueur de l'équipe première vers cette réserve.
    const sendOpen = (window._affSendIdx===i);
    h += '<div style="margin-top:6px">';
    h += '<button onclick="_toggleSendPanel('+i+')" style="width:100%;padding:6px;border-radius:7px;cursor:pointer;font-size:10px;font-weight:800;border:1.5px dashed '+aff.color+';background:'+(sendOpen?aff.color+'22':'transparent')+';color:'+aff.color+'">'+(sendOpen?'▲ Fermer':'⬇ Envoyer un joueur en réserve')+'</button>';
    h += '</div>';
    if(sendOpen) h += _sendToAffiliateHTML(i);
    // Effectif déplié (avec repérage des pépites)
    if(isOpen){
      h += _affiliateSquadHTML(aff, i);
    }
    h += '</div>';
  });
  h += '</div>';
  return h;
}
function _toggleAffiliateDelegate(i){
  const C=careerV2; if(!C||!C.affiliates||!C.affiliates[i]) return;
  C.affiliates[i].delegated = !C.affiliates[i].delegated;
  try{ saveCareerV2(); }catch(e){}
  const el=document.getElementById('career-director-content'); if(el) el.innerHTML=_renderDirectorAffiliates();
}
function _toggleAffiliateSquad(i){
  window._affOpenIdx = (window._affOpenIdx===i) ? null : i;
  const el=document.getElementById('career-director-content'); if(el) el.innerHTML=_renderDirectorAffiliates();
}
// OVR d'un joueur (réutilise careerOvr si dispo).
function _pOvr(p){ if(typeof careerOvr==='function') return careerOvr(p); const s=p.s||{}; return Math.round(((s.sht||50)+(s.spd||50)+(s.def||50)+(s.stam||50)+(s.tec||50)+(s.res||50))/6); }
// Détecte une "pépite" : jeune (≤ 21 ans) avec un OVR déjà correct pour son âge,
// ou fort potentiel — candidat à promouvoir en équipe première.
function _isPepite(p, teamAvgOvr){
  if(p._isGem) return true; // joueur exceptionnel (sorts rares, stats boostées)
  const age = p.age||24;
  const ovr = _pOvr(p);
  // Pépite = jeune (≤21) nettement au-dessus de la moyenne de SON équipe
  // (potentiel de progression), ou déjà très bon dans l'absolu.
  if(age>21) return false;
  if(ovr>=72) return true;
  if(teamAvgOvr!=null && ovr >= teamAvgOvr+4) return true; // surdoué local
  return false;
}
function _affiliateSquadHTML(aff, affIdx){
  const all = [...(aff.players||[]).map(p=>({p,grp:'Titulaires'})), ...(aff.bench||[]).map(p=>({p,grp:'Banc'}))];
  if(!all.length) return '<div style="font-size:9px;color:var(--muted);padding:8px">Effectif vide.</div>';
  // Trier par OVR décroissant pour voir les meilleurs en premier.
  all.sort((a,b)=>_pOvr(b.p)-_pOvr(a.p));
  const teamAvg = Math.round(all.reduce((s,o)=>s+_pOvr(o.p),0)/all.length);
  let h = '<div style="margin-top:10px;border-top:1px solid var(--b1);padding-top:8px">';
  h += '<div style="font-size:9px;color:var(--muted);margin-bottom:6px">Effectif ('+all.length+') — 🌟 = pépite à promouvoir</div>';
  all.forEach(function(o){
    const p=o.p; const ovr=_pOvr(p); const pep=_isPepite(p, teamAvg);
    const age=p.age||'?'; const nbSp=(p.spells||[]).length;
    h += '<div style="display:flex;align-items:center;gap:8px;padding:5px 7px;border-radius:6px;margin-bottom:3px;background:'+(pep?'rgba(240,192,40,.10)':'var(--dark)')+';border:1px solid '+(pep?'var(--gold)':'transparent')+'">';
    h += '<span style="font-size:8px;color:var(--muted);width:24px">'+(p.pos||'?')+'</span>';
    h += '<span style="flex:1;font-size:11px;font-weight:700;color:var(--text)">'+(pep?'🌟 ':'')+p.name+'</span>';
    h += '<span style="font-size:8px;color:var(--muted)">'+age+'a</span>';
    if(nbSp>0) h += '<span style="font-size:8px;color:#a080e0">✦'+nbSp+'</span>';
    h += '<span style="font-size:12px;font-weight:900;color:'+(ovr>=80?'#18c860':ovr>=70?'#f0c028':'var(--muted)')+'">'+ovr+'</span>';
    // Bouton promouvoir en équipe première
    h += '<button onclick="_promoteFromAffiliate('+affIdx+',\''+(p.id||'')+'\')" style="font-size:8px;padding:2px 6px;border-radius:5px;cursor:pointer;border:1px solid '+aff.color+';background:transparent;color:'+aff.color+'">↑ Promouvoir</button>';
    h += '</div>';
  });
  h += '</div>';
  return h;
}
// Promeut un joueur d'une réserve vers l'effectif première (le retire de la
// réserve, l'ajoute au banc de l'équipe principale).
function _promoteFromAffiliate(affIdx, playerId){
  const C=careerV2; if(!C||!C.affiliates||!C.affiliates[affIdx]) return;
  const aff=C.affiliates[affIdx];
  let p=null, from=null;
  ['players','bench'].forEach(function(k){
    const idx=(aff[k]||[]).findIndex(x=>x.id===playerId);
    if(idx>=0 && !p){ p=aff[k][idx]; from=k; aff[k].splice(idx,1); }
  });
  if(!p){ return; }
  p.onBench=true;
  C.bench = C.bench || [];
  C.bench.push(p);
  if(typeof careerLog==='function') careerLog('⬆ '+p.name+' promu de '+aff.name+' vers l\'équipe première !', C.club.color||'#18c860');
  try{ saveCareerV2(); }catch(e){}
  const el=document.getElementById('career-director-content'); if(el) el.innerHTML=_renderDirectorAffiliates();
}

// Envoie un joueur de l'équipe PREMIÈRE (players/bench/reserves) vers une
// équipe réserve affiliée (dans son banc). Réciproque de _promoteFromAffiliate :
// permet de faire redescendre un joueur pour lui donner du temps de jeu.
function _demoteToAffiliate(affIdx, playerId){
  const C=careerV2; if(!C||!C.affiliates||!C.affiliates[affIdx]) return;
  const aff=C.affiliates[affIdx];
  let p=null;
  ['players','bench','reserves'].forEach(function(k){
    const arr=C[k]||[]; const idx=arr.findIndex(x=>x&&x.id===playerId);
    if(idx>=0 && !p){ p=arr[idx]; arr.splice(idx,1); }
  });
  if(!p){ return; }
  // Garde-fou : ne pas vider l'équipe première sous le minimum jouable.
  const remaining=(C.players||[]).length;
  const minXI = (window.gameMode==='11v11')?11:(window.gameMode==='5v5')?5:7;
  if(remaining < minXI){
    // remettre le joueur et avertir
    (C.bench=C.bench||[]).push(p);
    if(typeof careerLog==='function') careerLog('⚠️ Impossible : l\'équipe première doit garder au moins '+minXI+' titulaires.', '#e0a020');
    const el0=document.getElementById('career-director-content'); if(el0) el0.innerHTML=_renderDirectorAffiliates();
    return;
  }
  p.onBench=true;
  aff.bench = aff.bench || [];
  aff.bench.push(p);
  if(typeof careerLog==='function') careerLog('⬇ '+p.name+' envoyé en réserve à '+aff.name+'.', aff.color||'#8090a0');
  try{ saveCareerV2(); }catch(e){}
  const el=document.getElementById('career-director-content'); if(el) el.innerHTML=_renderDirectorAffiliates();
}
// Bascule l'affichage du panneau "envoyer un joueur en réserve" pour une
// affiliée donnée (panneau inline déplié sous la carte de la réserve).
function _toggleSendPanel(affIdx){
  window._affSendIdx = (window._affSendIdx===affIdx) ? null : affIdx;
  window._affOpenIdx = affIdx; // garde l'effectif visible
  const el=document.getElementById('career-director-content'); if(el) el.innerHTML=_renderDirectorAffiliates();
}
// HTML du sélecteur listant les joueurs de l'équipe première envoyables vers
// une réserve donnée.
function _sendToAffiliateHTML(affIdx){
  const C=careerV2; if(!C||!C.affiliates||!C.affiliates[affIdx]) return '';
  const aff=C.affiliates[affIdx];
  const pool=[].concat(
    (C.players||[]).map(p=>({p,grp:'XI'})),
    (C.bench||[]).map(p=>({p,grp:'Banc'})),
    (C.reserves||[]).map(p=>({p,grp:'Rés.'}))
  ).filter(o=>o.p);
  let h='<div style="margin-top:8px;border-top:1px dashed '+aff.color+'55;padding-top:8px">';
  h+='<div style="font-size:9px;color:var(--muted);margin-bottom:6px">⬇ Envoyer un joueur de l\'équipe première vers <b style="color:'+aff.color+'">'+aff.name+'</b> :</div>';
  if(!pool.length){ h+='<div style="font-size:9px;color:var(--muted);padding:6px">Aucun joueur disponible.</div></div>'; return h; }
  pool.sort((a,b)=>_pOvr(a.p)-_pOvr(b.p)); // plus faibles d'abord (candidats au prêt)
  pool.forEach(function(o){
    const p=o.p, ovr=_pOvr(p);
    h+='<div style="display:flex;align-items:center;gap:8px;padding:5px 7px;border-radius:6px;margin-bottom:3px;background:var(--dark)">';
    h+='<span style="font-size:8px;color:var(--muted);width:26px">'+o.grp+'</span>';
    h+='<span style="font-size:8px;color:var(--muted);width:22px">'+(p.pos||'?')+'</span>';
    h+='<span style="flex:1;font-size:11px;font-weight:700">'+p.name+'</span>';
    h+='<span style="font-size:12px;font-weight:900;color:'+(ovr>=80?'#18c860':ovr>=70?'#f0c028':'var(--muted)')+'">'+ovr+'</span>';
    h+='<button onclick="_demoteToAffiliate('+affIdx+',\''+(p.id||'')+'\')" style="font-size:8px;padding:2px 6px;border-radius:5px;cursor:pointer;border:1px solid '+aff.color+';background:transparent;color:'+aff.color+'">⬇ Envoyer</button>';
    h+='</div>';
  });
  h+='</div>';
  return h;
}

function _renderDirectorOverview(){
  const C = careerV2; const club = C.club;
  const region = WORLDS.getRegion(C.nation||'panthalassa', club.region);
  const ss = C.season_stats;
  const obj = club.board_objectives && club.board_objectives[0];

  // Générer fixtures si manquantes
  if(!C.fixtures || C.fixtures.length === 0){
    _generateSeasonFixtures(); saveCareerV2();
  }

  const nextFix = (C.fixtures||[]).find(function(f){ return !f.played; });
  const standings = (C.standings||[]).slice().sort(function(a,b){
    return b.Pts-a.Pts || (b.GF-b.GA)-(a.GF-a.GA);
  });
  const myPos = standings.findIndex(function(s){return s.isPlayer;}) + 1;
  const accentCol = region ? region.color : 'var(--gold)';

  let h = '';

  // ── Bandeau match du jour en attente ─────────────────────────────────
  if(C._pendingMatch){
    if(C._pendingMatch.cup){
      let cupOpp = null;
      if(C.cup && Array.isArray(C.cup.bracket)){
        const mm = C.cup.bracket.find(function(x){ return !x.played && ((x.a&&x.a.isPlayer)||(x.b&&x.b.isPlayer)); });
        if(mm){ const o=(mm.a&&mm.a.isPlayer)?mm.b:mm.a; cupOpp = o?o.name:'(exempt)'; }
      }
      h += '<div style="background:linear-gradient(135deg,#f0c02822,var(--panel));border:2px solid #f0c028;border-radius:10px;padding:14px;margin-bottom:12px">';
      h += '<div style="font-size:12px;font-weight:900;color:#f0c028;margin-bottom:6px">🏆 Tour de coupe aujourd\'hui !</div>';
      h += '<div style="font-size:12px;color:var(--fg);margin-bottom:4px">'+(C.cup?C.cup.name:'Coupe')+(cupOpp?(' — vs <b>'+cupOpp+'</b>'):'')+'</div>';
      h += '<div style="font-size:10px;color:var(--muted);margin-bottom:10px">Jouez le match sur le terrain ou simulez le tour.</div>';
      h += '<div style="display:flex;gap:8px">';
      h += '<button class="btn btng" onclick="playCareerCupMatch()" style="flex:1;font-size:12px;padding:10px;font-weight:900">▶ Jouer le match</button>';
      h += '<button class="btn" onclick="simCareerMatchDirector()" style="flex:1;font-size:12px;padding:10px;font-weight:900">⚡ Simuler</button>';
      h += '</div>';
      h += '</div>';
    } else if(C._pendingMatch.playoff){
      const po = C.playoffs;
      const pm = po && Array.isArray(po.matches) ? po.matches[po.idx] : null;
      const opp = pm ? pm.oppName : '(adversaire)';
      const leg = po ? (po.idx+1) : 1;
      h += '<div style="background:linear-gradient(135deg,#f0c02822,var(--panel));border:2px solid #f0c028;border-radius:10px;padding:14px;margin-bottom:12px">';
      h += '<div style="font-size:12px;font-weight:900;color:#f0c028;margin-bottom:6px">🏟️ Barrage de district — match '+leg+'/3 !</div>';
      h += '<div style="font-size:14px;font-weight:700;color:var(--fg);margin-bottom:6px">'+(pm&&pm.isHome?club.name+' <span style="color:var(--muted)">vs</span> '+opp:opp+' <span style="color:var(--muted)">vs</span> '+club.name)+'</div>';
      h += '<div style="font-size:10px;color:var(--muted);margin-bottom:10px">'+(po?po.poolLabel:'')+' — les 2 premiers de la poule montent en '+_valDivName('valcourt_r3')+'.</div>';
      h += '<div style="display:flex;gap:8px">';
      h += '<button class="btn btng" onclick="playCareerPlayoffMatch()" style="flex:1;font-size:12px;padding:10px;font-weight:900">▶ Jouer le match</button>';
      h += '<button class="btn" onclick="simCareerPlayoffMatch()" style="flex:1;font-size:12px;padding:10px;font-weight:900">⚡ Simuler</button>';
      h += '</div>';
      h += '</div>';
    } else if(C._pendingMatch.friendly){
      const plan = C.dayPlans && C.dayPlans[C._pendingMatch.dateKey];
      const opp = plan && plan.oppName ? plan.oppName : '(adversaire)';
      h += '<div style="background:linear-gradient(135deg,#00bcd422,var(--panel));border:2px solid #00bcd4;border-radius:10px;padding:14px;margin-bottom:12px">';
      h += '<div style="font-size:12px;font-weight:900;color:#00bcd4;margin-bottom:6px">🤝 Match amical aujourd\'hui !</div>';
      h += '<div style="font-size:14px;font-weight:700;color:var(--fg);margin-bottom:6px">'+club.name+' <span style="color:var(--muted)">vs</span> <b>'+opp+'</b></div>';
      h += '<div style="font-size:10px;color:var(--muted);margin-bottom:10px">Match sans enjeu de classement — entretient forme et moral.</div>';
      h += '<div style="display:flex;gap:8px">';
      h += '<button class="btn btng" onclick="playCareerFriendlyMatch()" style="flex:1;font-size:12px;padding:10px;font-weight:900">▶ Jouer le match</button>';
      h += '<button class="btn" onclick="simCareerFriendlyMatch()" style="flex:1;font-size:12px;padding:10px;font-weight:900">⚡ Simuler</button>';
      h += '</div>';
      h += '</div>';
    } else {
      if(nextFix){
        const isHome = nextFix.homeIsPlayer;
        const opp = isHome ? nextFix.awayName : nextFix.homeName;
        h += '<div style="background:linear-gradient(135deg,'+accentCol+'22,var(--panel));border:2px solid '+accentCol+';border-radius:10px;padding:14px;margin-bottom:12px">';
        h += '<div style="font-size:12px;font-weight:900;color:'+accentCol+';margin-bottom:6px">⚽ Match aujourd\'hui — J'+nextFix.week+'</div>';
        h += '<div style="font-size:14px;font-weight:700;color:var(--fg);margin-bottom:10px">'+(isHome?club.name+' <span style="color:var(--muted)">vs</span> '+opp:opp+' <span style="color:var(--muted)">vs</span> '+club.name)+' '+(isHome?'🏠':'✈️')+'</div>';
        h += '<div style="display:flex;gap:8px">';
        h += '<button class="btn btng" onclick="playCareerMatchV2()" style="flex:1;font-size:12px;padding:10px;font-weight:900">▶ Jouer le match</button>';
        h += '<button class="btn" onclick="simCareerMatchDirector()" style="flex:1;font-size:12px;padding:10px;font-weight:900">⚡ Simuler</button>';
        h += '</div></div>';
      }
    }
  }

  // ── Rangée 1 : Objectif + Prochain match ────────────────────────────
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">';

  // Objectif
  h += '<div style="background:var(--panel);border:1px solid var(--b1);border-left:4px solid '+(obj?'#f0c028':'var(--b1)')+';border-radius:10px;padding:14px">';
  h += '<div style="font-size:11px;font-weight:900;color:var(--gold);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">🎯 Objectif</div>';
  if(obj){
    h += '<div style="font-size:14px;font-weight:700;color:var(--fg);margin-bottom:6px">'+obj.desc+'</div>';
    h += '<div style="font-size:11px;color:#18c860">🪙 Récompense : '+_fmtMoney(obj.reward)+'</div>';
  } else {
    h += '<div style="color:var(--muted);font-size:12px">Aucun objectif</div>';
  }
  // Position actuelle
  if(myPos > 0){
    const posCol = myPos<=2?'#18c860':myPos<=4?'#f0c028':'#e06060';
    h += '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--b1);font-size:12px">';
    h += 'Position actuelle : <span style="font-size:18px;font-weight:900;color:'+posCol+'">'+myPos+'e</span>';
    h += '</div>';
  }
  h += '</div>';

  // Prochain match
  h += '<div style="background:var(--panel);border:1px solid var(--b1);border-left:4px solid '+accentCol+';border-radius:10px;padding:14px">';
  h += '<div style="font-size:11px;font-weight:900;color:'+accentCol+';margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">⚽ Prochain match</div>';
  if(nextFix){
    const isHome = nextFix.homeIsPlayer;
    const opp = isHome ? nextFix.awayName : nextFix.homeName;
    const isPendingToday = C._pendingMatch && !C._pendingMatch.cup && C._pendingMatch.fixtureId===nextFix.id;
    const doubleWeek = typeof _hasCupClashThisWeek==='function' && _hasCupClashThisWeek(nextFix.week);
    h += '<div style="font-size:13px;font-weight:700;color:var(--fg);margin-bottom:4px">J'+nextFix.week+' · '+(nextFix.date?_fmtDateFrLong(nextFix.date):'?')+'</div>';
    h += '<div style="font-size:15px;font-weight:900;margin-bottom:6px">';
    h += isHome ? '<span style="color:'+accentCol+'">'+club.name+'</span> vs '+opp
               : opp+' vs <span style="color:'+accentCol+'">'+club.name+'</span>';
    h += '</div>';
    h += '<div style="font-size:11px;color:var(--muted);margin-bottom:10px">'+(isHome?'🏠 Domicile':'✈️ Extérieur')+'</div>';
    if(doubleWeek){
      h += '<div style="margin-bottom:10px;padding:6px 8px;border-radius:6px;background:#f0c02822;border:1px solid #f0c028;font-size:10px;color:#f0c028;font-weight:700">⚠️ Double match cette semaine — un tour de coupe tombe aussi cette semaine.</div>';
    }
    if(isPendingToday){
      h += '<div style="display:flex;gap:6px">';
      h += '<button class="btn btng" onclick="playCareerMatchV2()" style="flex:1;font-size:12px;padding:8px;font-weight:900">▶ Jouer</button>';
      h += '<button class="btn" onclick="simCareerMatchDirector()" style="font-size:11px;padding:8px 12px">⚡ Simuler</button>';
      h += '</div>';
    } else {
      h += '<div style="font-size:9px;color:var(--muted)">Avancez jour par jour jusqu\'au match (📅 onglet Calendrier).</div>';
    }
    // Voir l'effectif complet du prochain adversaire.
    const oppId = isHome ? nextFix.away : nextFix.home;
    h += '<button onclick="_viewOpponentSquad(\''+oppId+'\')" style="width:100%;margin-top:8px;font-size:10px;padding:7px;border-radius:7px;cursor:pointer;border:1px solid var(--b1);background:var(--dark);color:var(--muted)">🔍 Voir l\'effectif de '+opp+'</button>';
  } else if(C.playoffs && C.playoffs.active && !C.playoffs.done){
    const po = C.playoffs;
    const nm = po.matches[po.idx];
    h += '<div style="font-size:13px;color:var(--muted);margin-bottom:6px">🏟️ Barrages de district en cours ('+po.poolLabel+') — match '+(po.idx+1)+'/3.</div>';
    if(nm) h += '<div style="font-size:11px;color:var(--muted);margin-bottom:10px">Prochain : vs '+nm.oppName+' — '+_fmtDateFrLong(nm.date)+'</div>';
    h += '<div style="font-size:9px;color:var(--muted)">Avancez jour par jour jusqu\'au match (📅 onglet Calendrier).</div>';
  } else {
    h += '<div style="font-size:13px;color:var(--muted);margin-bottom:10px">🏁 Saison terminée !</div>';
    h += '<button class="btn btng" onclick="endCareerSeasonDirector()" style="width:100%;font-size:12px;padding:8px">Saison suivante →</button>';
  }
  h += '</div>';
  h += '</div>';

  // ── Coupe du Pilier (parcours) ────────────────────────────────────────
  if(C.cup){
    const cup=C.cup;
    h += '<div style="background:var(--panel);border:1px solid var(--b1);border-left:4px solid #f0c028;border-radius:10px;padding:14px;margin-bottom:12px">';
    h += '<div style="font-size:11px;font-weight:900;color:#f0c028;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">🏆 '+cup.name+'</div>';
    if(cup.winner){
      h += '<div style="font-size:13px;font-weight:800;color:'+(cup.winner.isPlayer?'#f0c028':'var(--muted)')+'">'+(cup.winner.isPlayer?'👑 Vous avez remporté la coupe !':('Remportée par '+cup.winner.name))+'</div>';
    } else if(cup.playerOut){
      h += '<div style="font-size:12px;color:#e06060">Éliminé. La coupe se poursuit sans vous.</div>';
    } else {
      const rn = cup.roundNames[cup.round] || 'Tour';
      const nextWk = cup.weeks[cup.round];
      // Trouver le prochain adversaire du joueur dans le bracket courant.
      let oppName=null;
      (cup.bracket||[]).forEach(function(m){
        if(m.a&&m.a.isPlayer) oppName=m.b?m.b.name:'(exempt)';
        else if(m.b&&m.b.isPlayer) oppName=m.a?m.a.name:'(exempt)';
      });
      const cupDateStr = typeof _cupWeekDate==='function' ? _fmtDateFrLong(_cupWeekDate(nextWk)) : ('semaine '+nextWk);
      h += '<div style="font-size:13px;font-weight:700;color:var(--fg);margin-bottom:4px">Tour : '+rn+'</div>';
      if(oppName) h += '<div style="font-size:12px;color:var(--muted)">Prochain adversaire : <b style="color:var(--fg)">'+oppName+'</b></div>';
      h += '<div style="font-size:10px;color:var(--muted);margin-top:6px">🗓️ '+cupDateStr+' — à cette date, vous pourrez jouer ou simuler le tour.</div>';
    }
    h += '</div>';
  }

  // ── Coupe de la ligue (4 poules → play-offs) ──────────────────────────
  if(C.leagueCup){
    const lc=C.leagueCup;
    h += '<div style="background:var(--panel);border:1px solid var(--b1);border-left:4px solid #c060e0;border-radius:10px;padding:14px;margin-bottom:12px">';
    h += '<div style="font-size:11px;font-weight:900;color:#c060e0;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">🏵️ '+lc.name+'</div>';
    if(lc.winner){
      h += '<div style="font-size:13px;font-weight:800;color:'+(lc.winner.isPlayer?'#c060e0':'var(--muted)')+'">'+(lc.winner.isPlayer?'🏆 Vous avez remporté la coupe de la ligue !':('Remportée par '+lc.winner.name))+'</div>';
    } else if(lc.playerOut){
      h += '<div style="font-size:12px;color:#e06060">Éliminé. La coupe se poursuit sans vous.</div>';
    } else if(lc.phase==='pools'){
      // Afficher la poule du joueur.
      const myPool = (lc.pools||[]).find(pool=>pool.some(c=>c.isPlayer));
      h += '<div style="font-size:12px;font-weight:700;color:var(--fg);margin-bottom:6px">Phase de poules</div>';
      if(myPool){
        h += '<div style="font-size:9px;color:var(--muted);margin-bottom:4px">Votre poule :</div>';
        myPool.forEach(function(c){
          h += '<div style="font-size:11px;color:'+(c.isPlayer?'#c060e0':'var(--muted)')+';padding:1px 0">'+(c.isPlayer?'▸ ':'  ')+c.name+'</div>';
        });
      }
      h += '<div style="font-size:9px;color:var(--muted);margin-top:6px">Les 2 premiers se qualifient pour les play-offs.</div>';
    } else {
      const rn = lc.roundNames[lc.round] || 'Play-offs';
      const lcWk = lc.playoffWeeks && lc.playoffWeeks[lc.round];
      const lcDateStr = (lcWk!=null && typeof _cupWeekDate==='function') ? _fmtDateFrLong(_cupWeekDate(lcWk)) : null;
      h += '<div style="font-size:13px;font-weight:700;color:var(--fg)">Play-offs : '+rn+'</div>';
      h += '<div style="font-size:9px;color:var(--muted);margin-top:6px">'+(lcDateStr?'🗓️ '+lcDateStr+' — ':'')+'Qualifié pour les play-offs — matchs à élimination directe.</div>';
    }
    h += '</div>';
  }

  if(standings.length > 0){
    h += '<div style="background:var(--panel);border:1px solid var(--b1);border-radius:10px;padding:14px;margin-bottom:12px">';
    h += '<div style="font-size:11px;font-weight:900;color:var(--gold);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">🏆 Classement</div>';
    h += '<div style="display:grid;grid-template-columns:24px 1fr 40px 40px 40px;gap:0;font-size:10px;color:var(--muted);padding:0 4px 6px;border-bottom:1px solid var(--b1);font-weight:700">';
    h += '<div>#</div><div>Club</div><div style="text-align:center">J</div><div style="text-align:center">+/-</div><div style="text-align:center">Pts</div>';
    h += '</div>';
    standings.forEach(function(s, i){
      const isMe = s.isPlayer;
      const gd = s.GF-s.GA;
      const gdCol = gd>0?'#18c860':gd<0?'#e06060':'var(--muted)';
      const posEmoji = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
      const rowBg = isMe ? 'background:'+accentCol+'18;border-radius:6px;' : '';
      h += '<div style="display:grid;grid-template-columns:24px 1fr 40px 40px 40px;gap:0;align-items:center;padding:7px 4px;border-bottom:1px solid var(--b1)10;'+rowBg+'">';
      h += '<div style="font-size:11px;color:var(--muted)">'+(posEmoji||(i+1))+'</div>';
      const cBadge = (s.badge && typeof BadgeCache!=='undefined')
        ? '<span style="width:18px;height:18px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center"><img src="'+BadgeCache.dataURI(s.badge,18)+'" width="18" height="18" style="object-fit:contain"></span>'
        : '<span style="width:9px;height:9px;border-radius:50%;flex-shrink:0;background:'+(s.color||'#888')+'"></span>';
      h += '<div style="display:flex;align-items:center;gap:6px;min-width:0">'+cBadge+'<span style="font-size:12px;font-weight:'+(isMe?'900':'600')+';color:'+(isMe?accentCol:'var(--fg)')+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+s.name+'</span></div>';
      h += '<div style="font-size:11px;text-align:center;color:var(--muted)">'+s.P+'</div>';
      h += '<div style="font-size:11px;text-align:center;color:'+gdCol+'">'+(gd>0?'+':'')+gd+'</div>';
      h += '<div style="font-size:13px;font-weight:900;text-align:center;color:'+(isMe?accentCol:'var(--fg)')+'">'+s.Pts+'</div>';
      h += '</div>';
    });
    h += '</div>';
  }

  // ── Events récents ────────────────────────────────────────────────────
  const recentLog = (C.finances&&C.finances.log||[]).slice(-3).reverse();
  if(recentLog.length > 0){
    h += '<div style="background:var(--panel);border:1px solid var(--b1);border-radius:10px;padding:14px">';
    h += '<div style="font-size:11px;font-weight:900;color:var(--muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">📋 Activité récente</div>';
    recentLog.forEach(function(e){
      h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--b1)10;font-size:11px">';
      h += '<span style="color:var(--muted)">'+e.desc+'</span>';
      h += '<span style="font-weight:700;color:'+(e.amount>=0?'#18c860':'#e06060')+'">'+(e.amount>=0?'+':'')+_fmtMoney(e.amount)+'</span>';
      h += '</div>';
    });
    h += '</div>';
  }

  return h;
}



// Métadonnées d'affichage d'un joueur (drapeau/emoji nationalité, rôle, valeur).
function _playerNatTag(p){
  // Étranger : petit globe + code nat ; natif : emoji de race + code pays.
  const raceE = (typeof raceMeta==='function' && p.race && p.race!=='human') ? raceMeta(p.race).emoji : '';
  if(p.foreign){
    const code = (p.nationality||'ETR').slice(0,3).toUpperCase();
    return '🌍 '+code;
  }
  const natCode = (p.nationality||'').slice(0,3).toUpperCase() || '—';
  const sexE = p.sex==='F'?'♀':p.sex==='M'?'♂':p.sex==='X'?'⚧':'';
  return (raceE||sexE)+' '+natCode;
}
function _playerRole(p, squadTier){
  const ovr=_pOvr(p); const age=p.age||24;
  if(typeof _isPepite==='function' && _isPepite(p)) return {txt:'Grand espoir', col:'#f0c028'};
  if(squadTier==='starter') return ovr>=82?{txt:'Titulaire clé',col:'#18c860'}:{txt:'Titulaire',col:'#18c860'};
  if(squadTier==='bench') return {txt:'Remplaçante', col:'#8fa0b5'};
  return {txt:'Réserviste', col:'#8fa0b5'};
}
function _playerValue(p){ return (typeof careerValue==='function')?careerValue(p):_pOvr(p)*100; }

function _renderDirectorSquad(){
  const C = careerV2;
  // Quelle équipe afficher : 'main' (première) ou l'index d'une affiliée.
  const view = window._squadView || 'main';
  // Construire la liste des équipes navigables : première + réserves.
  const teams = [{ key:'main', label:'Équipe première', players:C.players||[], bench:C.bench||[] }];
  (C.affiliates||[]).forEach(function(aff,i){
    teams.push({ key:'aff'+i, label:(aff.role==='U23 / académie'?'U23 · ':'Réserve · ')+aff.name, players:aff.players||[], bench:aff.bench||[], color:aff.color });
  });
  const cur = teams.find(t=>t.key===view) || teams[0];

  let h = '<div style="background:var(--dark);border:1px solid var(--b1);border-radius:10px;overflow:hidden">';
  // ── Onglets de navigation entre équipes ────────────────────────────────
  h += '<div style="display:flex;gap:4px;flex-wrap:wrap;padding:9px 10px 7px;border-bottom:1px solid var(--b1)">';
  teams.forEach(function(t){
    const on = t.key===cur.key;
    h += '<button onclick="_squadSetView(\''+t.key+'\')" style="padding:5px 11px;border-radius:7px;font-size:10px;font-weight:800;cursor:pointer;border:1.5px solid '+(on?'var(--gold)':'var(--b1)')+';background:'+(on?'rgba(240,192,40,.14)':'transparent')+';color:'+(on?'var(--gold)':'var(--muted)')+'">'+t.label+'</button>';
  });
  h += '</div>';
  // ── En-tête de colonnes ────────────────────────────────────────────────
  const grid = 'grid-template-columns:24px 1fr 68px 56px 30px 92px 66px;';
  h += '<div style="display:grid;'+grid+'gap:0;padding:7px 12px;font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--b1)">';
  h += '<div>N°</div><div>Joueuse</div><div>Poste</div><div>Nat.</div><div style="text-align:center">Âge</div><div>Statut</div><div style="text-align:right">Valeur</div>';
  h += '</div>';
  // ── Lignes ─────────────────────────────────────────────────────────────
  h += '<div style="padding:0 4px 6px">';
  let num = 1;
  function rows(list, tier){
    list.forEach(function(p){
      const ovr=_pOvr(p);
      const ovrCol = ovr>=80?'#18c860':ovr>=68?'#f0c028':'#e06060';
      const role=_playerRole(p,tier);
      const pep = (typeof _isPepite==='function' && _isPepite(p));
      const val=_playerValue(p);
      const pid = p.id || (p.name+'_'+num);
      h += '<div onclick="_openPlayerCard(\''+cur.key+'\',\''+String(pid).replace(/'/g,"")+'\')" style="display:grid;'+grid+'gap:0;align-items:center;padding:7px 8px;border-bottom:1px solid var(--panel);cursor:pointer;'+(pep?'background:rgba(240,192,40,.06);border:1px solid rgba(240,192,40,.25);border-radius:6px;':'')+'">';
      h += '<div style="font-size:10px;color:var(--muted)">'+(num++)+'</div>';
      h += '<div style="font-size:11px;font-weight:700;color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(pep?'🌟 ':'')+p.name+'</div>';
      h += '<div style="font-size:10px;color:var(--muted)">'+(p.pos||'?')+'</div>';
      h += '<div style="font-size:9px;color:var(--muted)" title="'+(p.nationality||'')+'">'+_playerNatTag(p)+'</div>';
      h += '<div style="font-size:10px;color:var(--muted);text-align:center">'+(p.age||'?')+'</div>';
      h += '<div style="font-size:9px;color:'+role.col+'">'+role.txt+'</div>';
      h += '<div style="font-size:11px;font-weight:900;color:'+ovrCol+';text-align:right">'+_fmtMoney(val)+'</div>';
      h += '</div>';
    });
  }
  rows(cur.players, 'starter');
  if(cur.bench && cur.bench.length){
    h += '<div style="font-size:9px;font-weight:700;color:var(--muted);padding:8px 8px 4px">🪑 Banc</div>';
    rows(cur.bench, 'bench');
  }
  h += '</div>';
  h += '<div style="padding:7px 12px;font-size:8px;color:var(--muted);border-top:1px solid var(--b1)">Clique sur une joueuse pour ses stats détaillées · 🌟 pépite</div>';
  h += '</div>';
  return h;
}
function _squadSetView(key){
  window._squadView = key;
  const el=document.getElementById('career-director-content'); if(el) el.innerHTML=_renderDirectorSquad();
}
// Affiche l'effectif complet d'un club adverse (depuis les standings).
function _viewOpponentSquad(oppId){
  const C=careerV2; if(!C) return;
  const st=(C.standings||[]).find(s=>s.id===oppId);
  if(!st || !st.squad){ if(typeof careerLog==='function') careerLog('Effectif adverse indisponible.','#e06060'); return; }
  window._oppSquadView = { id:oppId, group:'players' };
  _renderOpponentSquadOverlay(st);
}
function _renderOpponentSquadOverlay(st){
  const sq=st.squad;
  const view=(window._oppSquadView&&window._oppSquadView.group)||'players';
  const groups=[
    {key:'players', label:'Titulaires', list:sq.players||[]},
    {key:'bench', label:'Banc', list:sq.bench||[]},
    {key:'reserves', label:'Réserves', list:sq.reserves||[]},
  ].filter(g=>g.list.length);
  const cur=groups.find(g=>g.key===view)||groups[0];
  const badge=(st.badge&&typeof BadgeCache!=='undefined')?'<img src="'+BadgeCache.dataURI(st.badge,32)+'" width="32" height="32" style="object-fit:contain">':'';
  const grid='grid-template-columns:24px 1fr 60px 52px 30px 60px;';
  let h='<div style="background:var(--panel);border:2px solid '+(st.color||'#888')+';border-radius:14px;padding:14px;margin-bottom:12px">';
  h+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">';
  h+='<button onclick="_closeOpponentSquad()" style="background:var(--dark);border:1px solid var(--b1);border-radius:6px;color:var(--muted);font-size:12px;cursor:pointer;padding:2px 8px">← Retour</button>';
  if(badge) h+='<span>'+badge+'</span>';
  h+='<div style="font-size:15px;font-weight:900;color:'+(st.color||'var(--fg)')+'">'+st.name+'</div>';
  h+='</div>';
  // Onglets titulaires/banc/réserves
  h+='<div style="display:flex;gap:4px;margin-bottom:10px">';
  groups.forEach(function(g){ const on=g.key===cur.key; h+='<button onclick="_oppSquadTab(\''+g.key+'\')" style="padding:4px 10px;border-radius:7px;font-size:10px;font-weight:800;cursor:pointer;border:1.5px solid '+(on?st.color:'var(--b1)')+';background:'+(on?st.color+'22':'transparent')+';color:'+(on?st.color:'var(--muted)')+'">'+g.label+' ('+g.list.length+')</button>'; });
  h+='</div>';
  // En-tête colonnes
  h+='<div style="display:grid;'+grid+'gap:0;padding:6px 8px;font-size:8px;color:var(--muted);text-transform:uppercase;border-bottom:1px solid var(--b1)"><div>N°</div><div>Joueuse</div><div>Poste</div><div>Nat.</div><div style="text-align:center">Âge</div><div style="text-align:right">Note</div></div>';
  let num=1;
  cur.list.forEach(function(p){
    const ovr=_pOvr(p); const ovrCol=ovr>=80?'#18c860':ovr>=68?'#f0c028':'#e06060';
    const pep=(typeof _isPepite==='function'&&_isPepite(p));
    h+='<div style="display:grid;'+grid+'gap:0;align-items:center;padding:6px 8px;border-bottom:1px solid var(--panel)">';
    h+='<div style="font-size:10px;color:var(--muted)">'+(num++)+'</div>';
    h+='<div style="font-size:11px;font-weight:700;color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(pep?'🌟 ':'')+p.name+'</div>';
    h+='<div style="font-size:10px;color:var(--muted)">'+(p.pos||'?')+'</div>';
    h+='<div style="font-size:9px;color:var(--muted)">'+_playerNatTag(p)+'</div>';
    h+='<div style="font-size:10px;color:var(--muted);text-align:center">'+(p.age||'?')+'</div>';
    h+='<div style="font-size:11px;font-weight:900;color:'+ovrCol+';text-align:right">'+ovr+'</div>';
    h+='</div>';
  });
  h+='<div style="font-size:8px;color:var(--muted);margin-top:8px">Effectif de votre prochain adversaire · 🌟 pépite</div>';
  h+='</div>';
  const el=document.getElementById('career-director-content');
  if(el){ el.innerHTML = h + _renderDirectorOverview(); }
}
function _oppSquadTab(g){ if(window._oppSquadView) window._oppSquadView.group=g; const C=careerV2; const st=(C.standings||[]).find(s=>s.id===window._oppSquadView.id); if(st) _renderOpponentSquadOverlay(st); }
function _closeOpponentSquad(){ window._oppSquadView=null; const el=document.getElementById('career-director-content'); if(el) el.innerHTML=_renderDirectorOverview(); }
// Fiche joueur détaillée (overlay in-flow).
function _openPlayerCard(teamKey, pid){
  const C=careerV2; if(!C) return;
  let list=[];
  if(teamKey==='main') list=[...(C.players||[]),...(C.bench||[])];
  else { const aff=(C.affiliates||[])[parseInt(teamKey.replace('aff',''),10)]; if(aff) list=[...(aff.players||[]),...(aff.bench||[])]; }
  const p = list.find(x=>String(x.id||'')===pid) || list.find(x=>(x.name)===pid) || list.find((x,i)=>String(x.name+'_'+(i+1))===pid);
  if(!p){ return; }
  window._playerCardData = { p, teamKey };
  _renderPlayerCardOverlay(p);
}
function _renderPlayerCardOverlay(p){
  const ovr=_pOvr(p);
  const statNames={tec:'Technique',spd:'Vitesse',sht:'Tir',def:'Défense',stam:'Endurance',res:'Résistance'};
  const s=p.s||{};
  const bar=(k)=>{
    const v=s[k]||0; const c=v>=80?'#18c860':v>=60?'#f0c028':'#e06060';
    return '<div style="margin-bottom:7px"><div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px"><span style="color:var(--muted)">'+statNames[k]+'</span><span style="font-weight:800;color:'+c+'">'+v+'</span></div>'
      +'<div style="height:6px;background:var(--b1);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+Math.min(100,v)+'%;background:'+c+'"></div></div></div>';
  };
  const spells=(p.spells||[]);
  let h='<div style="position:relative;background:var(--panel);border:2px solid var(--gold);border-radius:14px;padding:16px;margin-bottom:12px">';
  h+='<button onclick="_closePlayerCard()" style="position:absolute;top:10px;right:10px;background:var(--dark);border:1px solid var(--b1);border-radius:6px;color:var(--muted);font-size:12px;cursor:pointer;padding:2px 8px">✕</button>';
  // En-tête
  h+='<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">';
  h+='<div style="width:52px;height:52px;border-radius:50%;background:var(--gold)22;border:2px solid var(--gold);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:var(--gold)">'+ovr+'</div>';
  h+='<div><div style="font-size:16px;font-weight:900;color:var(--fg)">'+p.name+'</div>';
  const sexLbl=p.sex==='F'?'♀ Féminin':p.sex==='M'?'♂ Masculin':'⚧ Autre';
  h+='<div style="font-size:10px;color:var(--muted)">'+(p.pos||'?')+' · '+(p.age||'?')+' ans · '+sexLbl+'</div>';
  h+='<div style="font-size:10px;color:var(--muted)">'+(p.foreign?'🌍 ':'')+(p.nationality||'—')+(p.foreign?' (étrangère)':'')+'</div>';
  h+='</div></div>';
  // Stats
  h+='<div style="font-size:10px;font-weight:800;color:var(--gold);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">Statistiques</div>';
  ['tec','spd','sht','def','stam','res'].forEach(k=>h+=bar(k));
  // Sorts
  h+='<div style="font-size:10px;font-weight:800;color:var(--gold);margin:12px 0 6px;text-transform:uppercase;letter-spacing:.5px">Sorts ('+spells.length+')</div>';
  if(spells.length){ h+='<div style="display:flex;flex-wrap:wrap;gap:5px">'; spells.forEach(sp=>h+='<span style="font-size:10px;padding:3px 9px;border-radius:12px;background:rgba(160,128,224,.15);border:1px solid #a080e0;color:#c0a0e0">✦ '+sp+'</span>'); h+='</div>'; }
  else h+='<div style="font-size:10px;color:var(--muted)">Aucun sort.</div>';
  // Valeur
  h+='<div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--b1);display:flex;justify-content:space-between;font-size:11px"><span style="color:var(--muted)">Valeur estimée</span><span style="font-weight:900;color:#18c860">'+_fmtMoney(_playerValue(p))+'</span></div>';
  // ── Gestion d'effectif : monter dans le 11 / mettre sur le banc ────────
  (function(){
    const data = window._playerCardData || {};
    const teamKey = data.teamKey || 'main';
    const arr = _squadArraysFor(teamKey);
    if(!arr) return;
    const pid = String(p.id!=null ? p.id : p.name);
    const inBench = arr.bench.some(x=>_sameP(x,p));
    const inStart = arr.players.some(x=>_sameP(x,p));
    h+='<div style="margin-top:12px;display:flex;gap:8px">';
    if(inBench){
      h+='<button onclick="_squadPromote(\''+teamKey+'\',\''+pid.replace(/\'/g,"")+'\')" style="flex:1;padding:8px;border:none;border-radius:8px;background:#18c860;color:#fff;font-size:11px;font-weight:800;cursor:pointer">⬆️ Intégrer à l\'effectif</button>';
    } else if(inStart){
      h+='<button onclick="_squadDemote(\''+teamKey+'\',\''+pid.replace(/\'/g,"")+'\')" style="flex:1;padding:8px;border:1px solid var(--b2);border-radius:8px;background:transparent;color:var(--muted);font-size:11px;font-weight:800;cursor:pointer">⬇️ Mettre sur le banc</button>';
    }
    h+='</div>';
  })();
  h+='</div>';
  // Injecter en tête du contenu
  const el=document.getElementById('career-director-content');
  if(el){ el.innerHTML = h + _renderDirectorSquad(); }
}
function _closePlayerCard(){
  window._playerCardData=null;
  const el=document.getElementById('career-director-content'); if(el) el.innerHTML=_renderDirectorSquad();
}

// ── Déplacer un joueur entre l'effectif (titulaires) et le banc ──────────
// Résout les tableaux réels (équipe première ou affiliée) à partir de teamKey.
function _squadArraysFor(teamKey){
  const C = careerV2; if(!C) return null;
  if(teamKey==='main') return { players:(C.players||(C.players=[])), bench:(C.bench||(C.bench=[])) };
  const aff=(C.affiliates||[])[parseInt(String(teamKey).replace('aff',''),10)];
  if(!aff) return null;
  return { players:(aff.players||(aff.players=[])), bench:(aff.bench||(aff.bench=[])) };
}
function _sameP(a,b){
  if(!a||!b) return false;
  if(a.id!=null && b.id!=null) return String(a.id)===String(b.id);
  return a===b;
}
// Fait monter un joueur du banc dans l'effectif de départ.
function _squadPromote(teamKey, pid){
  const arr=_squadArraysFor(teamKey); if(!arr) return;
  const i=arr.bench.findIndex(x=>String(x&&x.id||'')===pid || (x&&x.name)===pid);
  if(i<0){ logEvent('Joueur introuvable sur le banc.','#e02030'); return; }
  const p=arr.bench[i];
  arr.bench.splice(i,1);
  p.onBench=false;
  arr.players.push(p);
  logEvent('⬆️ '+p.name+' intègre l\'effectif de départ.','#18c860');
  saveCareerV2();
  const el=document.getElementById('career-director-content'); if(el) el.innerHTML=_renderDirectorSquad();
}
// Renvoie un titulaire sur le banc (garde au moins un gardien dans l'effectif).
function _squadDemote(teamKey, pid){
  const arr=_squadArraysFor(teamKey); if(!arr) return;
  const i=arr.players.findIndex(x=>String(x&&x.id||'')===pid || (x&&x.name)===pid);
  if(i<0){ logEvent('Joueur introuvable dans l\'effectif.','#e02030'); return; }
  const p=arr.players[i];
  // Empêcher de laisser l'effectif sans aucun gardien.
  if(p.pos==='GB'){
    const otherGK=arr.players.some((x,j)=>j!==i && x && x.pos==='GB');
    if(!otherGK){ logEvent('⚠️ Impossible : ce serait le seul gardien de l\'effectif.','#e06060'); return; }
  }
  arr.players.splice(i,1);
  p.onBench=true;
  arr.bench.push(p);
  logEvent('⬇️ '+p.name+' est envoyé sur le banc.','#f0c028');
  saveCareerV2();
  const el=document.getElementById('career-director-content'); if(el) el.innerHTML=_renderDirectorSquad();
}

function _renderDirectorMercato(){
  const C = careerV2; const club = C.club;
  const level = club.level;
  const isPro = ['d1','d2','d3'].includes(level);
  const isSemiPro = ['r1','r2'].includes(level);
  // District/R3 = amateur, pas de mercato classique

  let h = '<div style="padding:4px">';

  if(!isPro && !isSemiPro){
    // ── MODE AMATEUR (DH / R3) ──────────────────────────────────────
    h += '<div style="background:var(--dark);border:1px solid var(--b1);border-radius:8px;padding:10px;margin-bottom:8px">';
    h += '<div style="font-size:10px;font-weight:700;color:var(--gold);margin-bottom:4px">ℹ️ Club Amateur</div>';
    h += '<div style="font-size:9px;color:var(--muted);line-height:1.5">En District et R3, il n\'y a pas de marché des transferts. Les joueurs s\'engagent librement et jouent bénévolement. Vos revenus viennent des <b>licences</b> et de la <b>municipalité</b>.</div>';
    h += '</div>';

    // Joueurs libres locaux
    h += '<div style="background:var(--dark);border:1px solid var(--b1);border-radius:8px;padding:10px;margin-bottom:8px">';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
    h += '<div style="font-size:10px;font-weight:700;color:var(--gold)">🆓 Joueurs libres locaux</div>';
    h += '<button class="btn" onclick="refreshFreeAgents()" style="font-size:8px;padding:2px 8px">🔄 Actualiser</button>';
    h += '</div>';

    const freeAgents = C.freeAgents || [];
    if(freeAgents.length === 0){
      h += '<div style="font-size:9px;color:var(--muted)">Aucun joueur disponible. Avancez d\'une semaine ou actualisez.</div>';
    } else {
      freeAgents.forEach(function(p, i){
        const vals = Object.values(p.s||{});
        const ovr = vals.length ? Math.round(vals.reduce(function(a,b){return a+b;},0)/vals.length) : 10;
        const ovrCol = ovr>=20?'#f0c028':ovr>=15?'#e06060':'#888';
        const canSign = (C.players||[]).length + (C.bench||[]).length < 16;
        h += '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--b1)">';
        h += '<div style="width:24px;font-size:8px;color:var(--muted)">' + p.pos + '</div>';
        h += '<div style="flex:1"><div style="font-size:10px;font-weight:700">' + p.name + '</div>';
        h += '<div style="font-size:8px;color:var(--muted)">' + ((typeof raceMeta==='function'?raceMeta(p.race).emoji+' '+raceMeta(p.race).name:'👤') ) + ' · ' + (p.region||'?') + '</div></div>';
        h += '<div style="font-size:11px;font-weight:900;color:' + ovrCol + ';width:24px;text-align:center">' + ovr + '</div>';
        if(p._isPotentialPro){
          h += '<div style="font-size:8px;color:#9c27b0" title="Potentiel pro détecté !">💎</div>';
        }
        h += '<button class="btn btng" onclick="signFreeAgent(' + i + ')" style="font-size:8px;padding:2px 6px;' + (!canSign?'opacity:.4;pointer-events:none':'') + '">' + (canSign?'Signer':'Plein') + '</button>';
        h += '</div>';
      });
    }
    h += '</div>';

    // Académie jeunes
    h += '<div style="background:var(--dark);border:1px solid var(--b1);border-radius:8px;padding:10px;margin-bottom:8px">';
    h += '<div style="font-size:10px;font-weight:700;color:var(--gold);margin-bottom:6px">🎓 Jeunes du club</div>';
    const youth = C.youthPool || [];
    if(youth.length === 0){
      h += '<div style="font-size:9px;color:var(--muted)">Pas encore de jeunes. Ils arrivent en début de saison.</div>';
    } else {
      youth.forEach(function(p, i){
        const vals = Object.values(p.s||{});
        const ovr = vals.length ? Math.round(vals.reduce(function(a,b){return a+b;},0)/vals.length) : 10;
        const pot = p._potential || ovr;
        const potCol = pot >= 70 ? '#9c27b0' : pot >= 50 ? '#f0c028' : pot >= 35 ? '#18c860' : '#888';
        h += '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--b1)">';
        h += '<div style="width:24px;font-size:8px;color:var(--muted)">' + p.pos + '</div>';
        h += '<div style="flex:1"><div style="font-size:10px;font-weight:700">' + p.name + (p._isPotentialPro?' <span style="color:#9c27b0">💎 PÉPITE</span>':'') + '</div>';
        h += '<div style="font-size:8px;color:var(--muted)">OVR actuel : ' + ovr + ' · Potentiel : <span style="color:' + potCol + '">' + pot + '</span></div></div>';
        h += '<button class="btn btng" onclick="promoteYouth(' + i + ')" style="font-size:8px;padding:2px 6px">↑ Promouvoir</button>';
        if(p._isPotentialPro){
          h += '<button class="btn" onclick="sellYouthPro(' + i + ')" style="font-size:8px;padding:2px 6px;color:#9c27b0;border-color:#9c27b0">💰 Vendre</button>';
        }
        h += '</div>';
      });
    }
    h += '</div>';

  } else if(isSemiPro){
    // ── MODE SEMI-PRO (R1 / R2) ────────────────────────────────────
    h += '<div style="background:var(--dark);border:1px solid var(--b1);border-radius:8px;padding:10px;margin-bottom:8px">';
    h += '<div style="font-size:10px;font-weight:700;color:var(--gold);margin-bottom:4px">⚽ Recrutement Semi-Pro</div>';
    h += '<div style="font-size:9px;color:var(--muted)">Budget mercato : <b>🪙 ' + _fmtMoney(club.transferBudget) + '</b> · Indemnités de transfert faibles possibles.</div>';
    h += '</div>';
    h += '<div style="font-size:9px;color:var(--muted);padding:8px">Marché semi-pro — à développer prochainement.</div>';

  } else {
    // ── MODE PRO (D1/D2/D3) ────────────────────────────────────────
    const wopen = C.mercato && C.mercato.window_open;
    h += '<div style="background:var(--dark);border:1px solid var(--b1);border-radius:8px;padding:10px;margin-bottom:8px">';
    h += '<div style="font-size:10px;color:' + (wopen?'#18c860':'#e06060') + ';font-weight:700">' + (wopen?'🟢 Fenêtre ouverte':'🔴 Fenêtre fermée') + '</div>';
    h += '<div style="font-size:9px;color:var(--muted);margin-top:4px">Budget transferts : 🪙 ' + _fmtMoney(club.transferBudget) + '</div>';
    h += '</div>';
    h += '<div style="font-size:9px;color:var(--muted);padding:8px">Marché pro — à développer prochainement.</div>';
  }

  h += '</div>';
  return h;
}

// Taille d'effectif maximale autorisée selon le niveau du club (titulaires +
// banc). Aligne le plafond du mercato sur les vrais profils de division au lieu
// d'un 16 en dur qui bloquait les clubs pros (D3-D1 → 23-25 joueurs).
function _careerSquadMax(){
  const C = careerV2; if(!C || !C.club) return 16;
  const MAX = { d1:25, d2:24, d3:23, r1:21, r2:20, r3:18, dh:16,
    'dh_1':16, 'dh_2':16, 'dh_3':15, 'dh_4':15 };
  return MAX[C.club.level] || 18;
}

function signFreeAgent(idx){
  if(!careerV2) return;
  const p = (careerV2.freeAgents||[])[idx];
  if(!p){ logEvent('Joueur introuvable','#e02030'); return; }
  const total = (careerV2.players||[]).length + (careerV2.bench||[]).length;
  const _maxSquad = _careerSquadMax();
  if(total >= _maxSquad){ logEvent('Effectif plein ! (max '+_maxSquad+')','#e02030'); return; }

  p.onBench = true;
  if(!careerV2.bench) careerV2.bench = [];
  careerV2.bench.push(p);
  careerV2.freeAgents.splice(idx, 1);
  logEvent('✅ ' + p.name + ' rejoint le club !', '#18c860');
  saveCareerV2();
  renderCareerDirectorTab('mercato');
}

function promoteYouth(idx){
  if(!careerV2) return;
  const p = (careerV2.youthPool||[])[idx];
  if(!p){ logEvent('Joueur introuvable','#e02030'); return; }
  const total = (careerV2.players||[]).length + (careerV2.bench||[]).length;
  const _maxSquad = _careerSquadMax();
  if(total >= _maxSquad){ logEvent('Effectif plein ! (max '+_maxSquad+')','#e02030'); return; }

  p.onBench = true;
  if(!careerV2.bench) careerV2.bench = [];
  careerV2.bench.push(p);
  careerV2.youthPool.splice(idx, 1);
  logEvent('🎓 ' + p.name + ' intègre l\'équipe première !', '#18c860');
  saveCareerV2();
  renderCareerDirectorTab('mercato');
}

function sellYouthPro(idx){
  if(!careerV2) return;
  const p = (careerV2.youthPool||[])[idx];
  if(!p || !p._isPotentialPro){ return; }
  // Vente d\'un jeune pépite à un club pro — revenu conséquent
  const fee = Math.round(50000 + Math.random() * 150000);
  careerV2.club.budget += fee;
  _addFinanceLog('Vente de ' + p.name + ' à un club pro', fee);
  careerV2.youthPool.splice(idx, 1);
  logEvent('💰 ' + p.name + ' vendu à un club professionnel pour 🪙 ' + _fmtMoney(fee) + ' !', '#9c27b0');
  saveCareerV2();
  renderCareerDirectorTab('mercato');
}

function refreshFreeAgents(){
  if(!careerV2) return;
  _generateFreeAgents();
  saveCareerV2();
  renderCareerDirectorTab('mercato');
}


function _renderDirectorFinances(){
  const C = careerV2; const club = C.club;
  const log = (C.finances.log||[]).slice(-10).reverse();
  let h = '<div style="background:var(--dark);border:1px solid var(--b1);border-radius:8px;padding:10px">';
  h += '<div style="font-size:10px;font-weight:700;color:var(--gold);margin-bottom:10px">💰 Finances</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">';
  h += '<div style="background:var(--panel);border-radius:6px;padding:8px;text-align:center"><div style="font-size:9px;color:var(--muted)">Budget total</div><div style="font-size:14px;font-weight:900;color:#18c860">'+_fmtMoney(club.budget)+'</div></div>';
  h += '<div style="background:var(--panel);border-radius:6px;padding:8px;text-align:center"><div style="font-size:9px;color:var(--muted)">Budget mercato</div><div style="font-size:14px;font-weight:900;color:#f0c028">'+_fmtMoney(club.transferBudget)+'</div></div>';
  h += '</div>';
  // Revenu sponsors hebdomadaire (raccourci vers l'onglet dédié).
  if(typeof SPONSORS!=='undefined'){
    try{
      SPONSORS.ensure(club);
      const sw = SPONSORS.weeklyIncome(club);
      const nb = SPONSORS.active(club).length;
      h += '<div style="display:flex;align-items:center;justify-content:space-between;background:var(--panel);border-radius:6px;padding:8px;margin-bottom:10px">';
      h += '<div style="font-size:9px;color:var(--muted)">🤝 Sponsors ('+nb+') <b style="color:#18c860">'+_fmtMoney(sw)+'</b>/sem.</div>';
      h += '<button class="btn" onclick="renderCareerDirectorTab(\'sponsors\')" style="font-size:8px;padding:2px 8px">Gérer</button>';
      h += '</div>';
    }catch(e){}
  }
  if(log.length){
    h += '<div style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:6px">Historique :</div>';
    log.forEach(function(e){
      h += '<div style="display:flex;justify-content:space-between;font-size:9px;padding:3px 0;border-bottom:1px solid var(--b1)">';
      h += '<span style="color:var(--muted)">'+e.desc+'</span>';
      h += '<span style="color:'+(e.amount>=0?'#18c860':'#e06060')+';font-weight:700">'+(e.amount>=0?'+':'')+_fmtMoney(e.amount)+'</span></div>';
    });
  }
  h += '</div>';
  return h;
}

// ── ONGLET SPONSORS ─────────────────────────────────────────────────────
function _renderDirectorSponsors(){
  const C = careerV2; const club = C.club;
  if(typeof SPONSORS==='undefined'){ return '<div style="padding:12px;font-size:10px;color:var(--muted)">Module sponsors indisponible.</div>'; }
  SPONSORS.ensure(club);
  const slots = SPONSORS.SLOTS;
  const weekly = SPONSORS.weeklyIncome(club);

  let h = '<div style="padding:4px">';
  // Bandeau synthèse
  h += '<div style="background:var(--dark);border:1px solid var(--b1);border-radius:8px;padding:10px;margin-bottom:8px">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between">';
  h += '<div style="font-size:11px;font-weight:900;color:var(--gold)">🤝 Sponsors</div>';
  h += '<div style="font-size:9px;color:var(--muted)">Revenu sponsors : <b style="color:#18c860">'+_fmtMoney(weekly)+'</b>/sem.</div>';
  h += '</div>';
  h += '<div style="font-size:8px;color:var(--muted);margin-top:5px;line-height:1.4">Signe un contrat par emplacement. Les paiements hebdomadaires alimentent ton budget ; certains contrats offrent une prime de fin de saison si un objectif sportif est atteint.</div>';
  // Contexte : les offres dépendent de la division, de la nation et de la
  // richesse de la région du club.
  try{
    const reg = WORLDS.getRegion(club.nation || C.nation, club.region);
    if(reg){
      const wLbl = (reg.wealth>=3) ? 'région riche — grandes marques nationales'
                 : (reg.wealth===2) ? 'région intermédiaire — marques mixtes'
                 : 'région modeste — surtout des sponsors locaux';
      h += '<div style="font-size:8px;color:var(--muted);margin-top:6px;padding-top:6px;border-top:1px solid var(--b1)">📍 '+reg.name+' · '+wLbl+' · division <b>'+String(club.level).toUpperCase()+'</b></div>';
    }
  }catch(e){}
  h += '</div>';

  slots.forEach(function(sd){
    const cur = club.sponsors[sd.key];
    h += '<div style="background:var(--dark);border:1px solid var(--b1);border-radius:8px;padding:10px;margin-bottom:8px">';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">';
    h += '<div style="font-size:10px;font-weight:800">'+sd.icon+' '+sd.label+'</div>';
    if(cur){
      h += '<button class="btn" onclick="terminateSponsorV2(\''+sd.key+'\')" style="font-size:8px;padding:2px 8px;background:transparent;border:1px solid #e06060;color:#e06060">Résilier</button>';
    }
    h += '</div>';
    if(cur){
      const objTxt = cur.objective ? (' · 🎯 '+cur.objective.label+' → prime '+_fmtMoney(cur.objective.bonus)) : '';
      h += '<div style="background:var(--panel);border-radius:6px;padding:8px">';
      h += '<div style="font-size:11px;font-weight:800;color:var(--fg)">'+cur.name+'</div>';
      h += '<div style="font-size:9px;color:#18c860;font-weight:700">'+_fmtMoney(cur.weekly)+'/sem.</div>';
      h += '<div style="font-size:8px;color:var(--muted);margin-top:2px">'+(cur.weeksLeft!=null?cur.weeksLeft:cur.weeks)+' sem. restantes'+objTxt+'</div>';
      h += '</div>';
    } else {
      // Offres déterministes (dérivées d'une graine) : identiques à chaque
      // rendu et après un rechargement, donc l'index du bouton reste valide.
      const offers = SPONSORS.offersFor(club, sd.key);
      offers.forEach(function(o, i){
        const objTxt = o.objective ? ('🎯 '+o.objective.label+' (+'+_fmtMoney(o.objective.bonus)+')') : 'Sans objectif';
        h += '<div style="display:flex;align-items:center;gap:8px;padding:7px;background:var(--panel);border:1px solid var(--b1);border-radius:6px;margin-bottom:5px">';
        h += '<div style="flex:1;min-width:0"><div style="font-size:10px;font-weight:700">'+o.name+'</div>';
        h += '<div style="font-size:8px;color:var(--muted)">'+_fmtMoney(o.weekly)+'/sem · '+o.weeks+' sem · prime signature '+_fmtMoney(o.signBonus)+'</div>';
        h += '<div style="font-size:8px;color:'+(o.objective?'#f0c028':'var(--muted)')+'">'+objTxt+'</div></div>';
        h += '<button class="btn btng" onclick="signSponsorV2(\''+sd.key+'\','+i+')" style="font-size:9px;padding:3px 10px">Signer</button>';
        h += '</div>';
      });
      h += '<button class="btn" onclick="refreshSponsorOffersV2(\''+sd.key+'\')" style="font-size:8px;padding:2px 8px;margin-top:2px">🔄 Nouvelles offres</button>';
    }
    h += '</div>';
  });

  h += '</div>';
  return h;
}

function signSponsorV2(slot, idx){
  if(!careerV2 || typeof SPONSORS==='undefined') return;
  const C = careerV2; const club = C.club;
  SPONSORS.ensure(club);
  // Les offres sont régénérées à l'identique depuis la graine du club.
  const offers = SPONSORS.offersFor(club, slot);
  const deal = offers[idx];
  if(!deal){ logEvent('Offre introuvable.','#e02030'); return; }
  const res = SPONSORS.sign(club, deal);
  if(!res.ok){ logEvent('Signature impossible.','#e02030'); return; }
  if(res.bonus > 0){
    club.budget += res.bonus;
    try{ _addFinanceLog('Prime signature sponsor : '+deal.name, res.bonus); }catch(e){}
  }
  logEvent('✅ Contrat signé avec '+deal.name+' ('+SPONSORS.slotDef(slot).label+') — '+_fmtMoney(deal.weekly)+'/sem.','#18c860');
  saveCareerV2();
  renderCareerDirectorTab('sponsors');
}

function terminateSponsorV2(slot){
  if(!careerV2 || typeof SPONSORS==='undefined') return;
  const C = careerV2; const club = C.club;
  const cur = club.sponsors && club.sponsors[slot];
  if(!cur) return;
  const fee = SPONSORS.terminationFee(cur);
  if(club.budget < fee){ logEvent('❌ Budget insuffisant pour la pénalité de résiliation ('+_fmtMoney(fee)+').','#e02030'); return; }
  club.budget -= fee;
  try{ _addFinanceLog('Résiliation sponsor : '+cur.name, -fee); }catch(e){}
  club.sponsors[slot] = null;
  logEvent('📄 Contrat « '+cur.name+' » résilié (pénalité '+_fmtMoney(fee)+').','#f0c028');
  saveCareerV2();
  renderCareerDirectorTab('sponsors');
}

function refreshSponsorOffersV2(slot){
  if(!careerV2 || typeof SPONSORS==='undefined') return;
  SPONSORS.refresh(careerV2.club, slot); // change la graine → nouvelles offres
  saveCareerV2();
  renderCareerDirectorTab('sponsors');
}

function _renderDirectorInfra(){
  const C = careerV2; const club = C.club;
  const infra = club.infra || {};
  const works = club.works || [];
  const defs = (typeof INFRA_V2_DEFS!=='undefined') ? INFRA_V2_DEFS : null;
  // Fallback : ancien écran si les nouvelles défs ne sont pas chargées.
  if(!defs){ return _renderDirectorInfraLegacy(); }

  const col = club.color || '#f0c028';
  let h = '<div style="padding:12px">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">';
  h += '<div style="font-size:15px;font-weight:900;color:var(--gold)">🏗 Infrastructures</div>';
  h += '<div style="font-size:10px;color:var(--muted)">Budget : <b style="color:'+(club.budget<0?'#e06060':'#18c860')+'">'+_fmtMoney(club.budget)+'</b></div>';
  h += '</div>';
  h += '<div style="font-size:9px;color:var(--muted);margin-bottom:14px">Les travaux prennent du temps : permis, construction, paiement en tranches. Un chantier peut être retardé ou dépasser son budget.</div>';

  Object.keys(defs).forEach(function(key){
    const def = defs[key];
    const lvl = infra[key]||0;
    const work = works.find(w=>w.key===key);
    // Qualité 0-100 dérivée du niveau (pour l'état visuel).
    const pct = Math.round((lvl/def.max)*100);
    const state = infraStateLabel(pct);
    const stars = '★'.repeat(lvl)+'☆'.repeat(def.max-lvl);

    h += '<div style="background:var(--panel);border:1px solid '+col+'44;border-radius:12px;padding:12px;margin-bottom:10px">';
    h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">';
    h += '<div style="width:38px;height:38px;border-radius:9px;background:'+col+'22;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">'+def.icon+'</div>';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-size:13px;font-weight:800;color:var(--text)">'+def.name+'</div>';
    h += '<div style="font-size:9px;color:var(--muted)">Niveau '+lvl+'/'+def.max+' · qualité '+pct+'/100</div>';
    h += '</div>';
    h += '<div style="text-align:right;flex-shrink:0"><div style="font-size:9px;color:var(--gold)">'+stars+'</div>';
    h += '<div style="font-size:8px;color:'+state.col+';margin-top:2px">'+state.txt+'</div></div>';
    h += '</div>';
    // ── Données concrètes par installation (déterministes + niveau) ──────
    const cell=(label,val,vcol)=>'<div style="background:var(--dark);border-radius:6px;padding:6px 8px"><div style="font-size:8px;color:var(--muted)">'+label+'</div><div style="font-size:11px;font-weight:700;color:'+(vcol||'var(--text)')+'">'+val+'</div></div>';
    let stats='';
    if(key==='stadium'){
      const cap = 500 + lvl*2500 + (club.stadium_capacity? 0 : 0);
      const fill = Math.min(98, 40 + lvl*12 + (pct>50?8:0));
      const matchRev = Math.round(cap*fill/100*0.8);
      const pelouse = lvl>=4?'Excellente':lvl>=2?'Correcte':'Usée';
      stats = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">'
        + cell('Capacité', cap.toLocaleString('fr-FR')+' places')
        + cell('Affluence moyenne', fill+'%', fill>=70?'#18c860':fill>=50?'#f0c028':'#e06060')
        + cell('Revenus matchday', _fmtMoney(matchRev)+'/match')
        + cell('État pelouse', pelouse, lvl>=4?'#18c860':lvl>=2?'#f0c028':'#e06060')
        + '</div>';
    } else if(key==='training'){
      stats = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">'
        + cell('Gain stats/séance', '+'+(lvl*4)+'%', lvl>=3?'#18c860':'#f0c028')
        + cell('Terrains', String(Math.max(1,lvl)))
        + '</div>';
    } else if(key==='formation'){
      stats = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">'
        + cell('Jeunes/saison', String(lvl))
        + cell('Qualité jeunes', (30+lvl*14)+'/100', lvl>=3?'#18c860':'#f0c028')
        + '</div>';
    } else if(key==='medical'){
      stats = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">'
        + cell('Blessures', '-'+(lvl*12)+'%', lvl>=3?'#18c860':'#f0c028')
        + cell('Récupération', '+'+(lvl*10)+'%', lvl>=3?'#18c860':'#f0c028')
        + '</div>';
    } else if(key==='scout'){
      stats = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">'
        + cell('Portée réseau', (lvl*20)+'%', lvl>=3?'#18c860':'#f0c028')
        + cell('Pépites détectées', String(lvl))
        + '</div>';
    }
    h += stats;
    h += '<div style="font-size:8px;color:var(--muted);margin-bottom:8px">Effet : '+def.effect+'</div>';

    if(work){
      // Chantier en cours : barre de progression + phase.
      const done = work.weeksTotal - work.weeksLeft;
      const prog = Math.round((done/Math.max(1,work.weeksTotal))*100);
      const phaseLbl = work.delayed ? '⏸ Suspendu (trésorerie)' : (work.phase==='permit' ? '📋 Autorisation en cours' : '🚧 Construction');
      const phaseCol = work.delayed ? '#e06060' : (work.phase==='permit' ? '#f0c028' : '#00bcd4');
      h += '<div style="background:var(--dark);border-radius:8px;padding:8px 10px">';
      h += '<div style="display:flex;justify-content:space-between;font-size:9px;margin-bottom:5px"><span style="color:'+phaseCol+';font-weight:700">'+phaseLbl+' → niv '+work.target+'</span><span style="color:var(--muted)">'+work.weeksLeft+' sem. restantes</span></div>';
      h += '<div style="height:7px;background:var(--b1);border-radius:4px;overflow:hidden"><div style="height:100%;width:'+prog+'%;background:'+phaseCol+'"></div></div>';
      h += '<div style="font-size:8px;color:var(--muted);margin-top:5px">Tranche : '+_fmtMoney(work.weeklyInstalment)+'/sem · payé '+_fmtMoney(work.paid)+' / '+_fmtMoney(work.totalCost)+'</div>';
      h += '</div>';
    } else if(lvl>=def.max){
      h += '<div style="font-size:10px;color:#18c860;text-align:center;padding:4px">✅ Niveau maximum atteint</div>';
    } else {
      const nextCost = def.baseCost[lvl+1]||0;
      const nextWeeks = (def.permitWeeks[lvl+1]||0)+(def.buildWeeks[lvl+1]||0);
      const deposit = Math.round(nextCost*0.10);
      const canStart = (club.budget||0) >= deposit;
      h += '<button onclick="_infraStartWork(\''+key+'\')" style="width:100%;padding:8px;border-radius:8px;cursor:pointer;font-size:11px;font-weight:800;border:none;background:'+(canStart?col:'var(--b1)')+';color:'+(canStart?'#1a1a1a':'var(--muted)')+';'+(canStart?'':'opacity:.6;cursor:not-allowed')+'">🔨 Lancer les travaux → niv '+(lvl+1)+' · '+_fmtMoney(nextCost)+' · '+nextWeeks+' sem.</button>';
      if(!canStart) h += '<div style="font-size:8px;color:#e06060;text-align:center;margin-top:4px">Acompte requis : '+_fmtMoney(deposit)+'</div>';
    }
    h += '</div>';
  });
  h += '</div>';
  return h;
}
function _infraStartWork(key){
  if(typeof startInfraWork==='function') startInfraWork(key);
  const el=document.getElementById('career-director-content'); if(el) el.innerHTML=_renderDirectorInfra();
}

function _renderDirectorInfraLegacy(){
  const C = careerV2; const club = C.club;
  const infra = club.infra || {};
  const items = [
    {key:'stadium', label:'🏟 Stade', max:5},
    {key:'training', label:'⚽ Entrainement', max:5},
    {key:'formation', label:'🎓 Academie jeunes', max:5},
    {key:'medical', label:'🏥 Centre medical', max:5},
    {key:'scout', label:'🔭 Scouts', max:5},
  ];
  let h = '<div style="background:var(--dark);border:1px solid var(--b1);border-radius:8px;padding:10px">';
  h += '<div style="font-size:10px;font-weight:700;color:var(--gold);margin-bottom:10px">🏗 Infrastructure</div>';
  items.forEach(function(item){
    const lvl = infra[item.key]||0;
    const cost = Math.round(1000*Math.pow(3,lvl));
    const canAfford = club.budget >= cost;
    const maxed = lvl >= item.max;
    h += '<div style="background:var(--panel);border-radius:6px;padding:8px;margin-bottom:6px">';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">';
    h += '<div style="font-size:10px;font-weight:700">'+item.label+'</div>';
    h += '<div style="font-size:9px;color:var(--gold)">'+'★'.repeat(lvl)+'☆'.repeat(item.max-lvl)+'</div></div>';
    if(maxed){
      h += '<div style="font-size:9px;color:#18c860">✅ Niveau maximum</div>';
    } else {
      h += '<button class="btn'+(canAfford?'':' disabled')+'" onclick="upgradeInfraV2(\''+item.key+'\')"'
        + ' style="font-size:9px;padding:2px 8px;'+(canAfford?'':'opacity:.5;cursor:not-allowed')+'">'
        + 'Ameliorer — 🪙 '+_fmtMoney(cost)+'</button>';
    }
    h += '</div>';
  });
  h += '</div>';
  return h;
}

function _stars(n){ return '★★★★★'.slice(0,n) + '☆☆☆☆☆'.slice(0,5-n); }

function _renderDirectorStaff(){
  const C = careerV2; const club = C.club;
  if(typeof STAFF!=='undefined') STAFF.ensureStaff(club);
  const staff = club.staff || {};
  const R = (typeof STAFF!=='undefined') ? STAFF.ROLES : {};
  const depts = (typeof STAFF!=='undefined' && STAFF.DEPARTMENTS) ? STAFF.DEPARTMENTS : [
    { key:'all', label:'Staff', icon:'👔', roles:Object.keys(R) }
  ];

  const totalWage = (typeof STAFF!=='undefined') ? STAFF.weeklyWages(club) : 0;
  const filled = (typeof STAFF!=='undefined') ? STAFF.filledCount(club) : 0;
  const totalPosts = (typeof STAFF!=='undefined') ? STAFF.ROLE_ORDER.length : Object.keys(R).length;

  let h = '';
  // ── Bandeau synthèse ────────────────────────────────────────────
  h += '<div style="background:var(--dark);border:1px solid var(--b1);border-radius:8px;padding:10px;margin-bottom:8px">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between">';
  h += '<div style="font-size:11px;font-weight:900;color:var(--gold)">👔 Organigramme du club</div>';
  h += '<div style="font-size:9px;color:var(--muted)">'+filled+'/'+totalPosts+' postes · <b style="color:#f0c028">'+_fmtMoney(totalWage)+'</b>/sem.</div>';
  h += '</div>';
  h += '<div style="font-size:8px;color:var(--muted);margin-top:5px;line-height:1.4">Chaque membre a un niveau (★). Les entraîneurs spécialisés accélèrent la progression dans leur domaine, l\'analyste vidéo prépare les matchs, le staff médical gère forme et blessures.</div>';
  h += '</div>';

  depts.forEach(function(dept){
    h += '<div style="background:var(--dark);border:1px solid var(--b1);border-radius:8px;padding:10px;margin-bottom:8px">';
    h += '<div style="font-size:10px;font-weight:800;color:var(--fg);margin-bottom:8px;letter-spacing:.4px">'+(dept.icon||'')+' '+dept.label.toUpperCase()+'</div>';
    (dept.roles||[]).forEach(function(key){
      const role = R[key] || {label:key, icon:'👤', desc:''};
      const s = staff[key];
      h += '<div style="padding:8px;background:var(--panel);border-radius:6px;margin-bottom:6px">';
      h += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">';
      h += '<div style="min-width:0"><div style="font-size:10px;font-weight:700">'+role.icon+' '+role.label+'</div>';
      if(s){
        const tier = (typeof STAFF!=='undefined') ? STAFF.tierOf(s.rating) : {label:'',colorHi:'#18c860'};
        h += '<div style="font-size:9px;color:var(--fg)">'+s.name+' — <span style="color:'+tier.colorHi+';font-weight:700">'+_stars(s.rating)+'</span> <span style="color:var(--muted)">'+(s.tier||tier.label)+'</span></div>';
        h += '<div style="font-size:8px;color:var(--muted)">Salaire '+_fmtMoney(s.wage||0)+'/sem.</div>';
      } else {
        h += '<div style="font-size:9px;color:#e06060">⚠️ Poste vacant</div>';
      }
      h += '</div>';
      h += '<div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">';
      h += '<button class="btn" onclick="hireStaff(\''+key+'\')" style="font-size:9px;padding:2px 8px">'+(s?'Remplacer':'Recruter')+'</button>';
      if(s) h += '<button class="btn" onclick="fireStaff(\''+key+'\')" style="font-size:9px;padding:2px 8px;background:transparent;border:1px solid #e06060;color:#e06060">Licencier</button>';
      h += '</div>';
      h += '</div>';
      h += '<div style="font-size:8px;color:var(--muted);margin-top:5px;line-height:1.35">'+role.desc+'</div>';
      h += '</div>';
    });
    h += '</div>';
  });
  return h;
}

// ── Panneau de recrutement : liste de candidats pour un poste ───────────
function hireStaff(role){
  if(typeof STAFF==='undefined' || !careerV2){ logEvent('Staff indisponible.','#e02030'); return; }
  const club = careerV2.club;
  const cands = STAFF.candidatesFor(club, role);
  const roleInfo = STAFF.ROLES[role] || {label:role, icon:'👤'};
  let h = '<div style="max-width:420px">';
  h += '<div style="font-size:12px;font-weight:900;color:var(--gold);margin-bottom:4px">'+roleInfo.icon+' Recruter — '+roleInfo.label+'</div>';
  h += '<div style="font-size:9px;color:var(--muted);margin-bottom:10px">Budget : <b style="color:'+(club.budget<0?'#e06060':'#18c860')+'">'+_fmtMoney(club.budget)+'</b> · une prime de recrutement est prélevée à la signature, puis un salaire hebdomadaire.</div>';
  cands.forEach(function(c, i){
    const tier = STAFF.tierOf(c.rating);
    const canAfford = club.budget >= c.hireFee;
    h += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px;background:var(--panel);border:1px solid var(--b1);border-radius:6px;margin-bottom:6px">';
    h += '<div><div style="font-size:10px;font-weight:700">'+c.name+' <span style="color:'+tier.colorHi+'">'+_stars(c.rating)+'</span></div>';
    h += '<div style="font-size:8px;color:var(--muted)">'+tier.label+' · Prime '+_fmtMoney(c.hireFee)+' · Salaire '+_fmtMoney(c.wage)+'/sem.</div></div>';
    h += '<button class="btn" '+(canAfford?'':'disabled')+' onclick="_confirmHireStaff(\''+role+'\','+i+')" style="font-size:9px;padding:3px 10px;'+(canAfford?'':'opacity:.4;cursor:not-allowed')+'">Signer</button>';
    h += '</div>';
  });
  h += '<button class="btn" onclick="closeModal()" style="font-size:9px;padding:3px 10px;margin-top:4px;width:100%">Annuler</button>';
  h += '</div>';
  // Stocke les candidats pour la confirmation.
  window._staffCands = { role:role, list:cands };
  _openStaffModal(h);
}

// Ouvre une modale légère (réutilise l'overlay générique si présent, sinon
// crée un overlay minimal). On reste défensif pour ne dépendre d'aucune UI.
function _openStaffModal(inner){
  let ov = document.getElementById('_staffModal');
  if(!ov){
    ov = document.createElement('div');
    ov.id = '_staffModal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px';
    ov.onclick = function(e){ if(e.target===ov) closeModal(); };
    document.body.appendChild(ov);
  }
  ov.innerHTML = '<div style="background:var(--dark);border:1px solid var(--b1);border-radius:10px;padding:16px;max-height:80vh;overflow:auto">'+inner+'</div>';
  ov.style.display = 'flex';
}
function closeModal(){
  const ov = document.getElementById('_staffModal');
  if(ov) ov.style.display = 'none';
}

function _confirmHireStaff(role, idx){
  if(typeof STAFF==='undefined' || !careerV2) return;
  const club = careerV2.club;
  const data = window._staffCands;
  if(!data || data.role!==role || !data.list[idx]){ closeModal(); return; }
  const c = data.list[idx];
  if(club.budget < c.hireFee){ logEvent('❌ Budget insuffisant pour la prime de recrutement.','#e02030'); return; }
  const prev = club.staff && club.staff[role];
  STAFF.ensureStaff(club);
  club.budget -= c.hireFee;
  club.staff[role] = { role:role, name:c.name, rating:c.rating, tier:STAFF.tierOf(c.rating).label, wage:c.wage };
  try{ _addFinanceLog('Recrutement staff : '+c.name+' ('+(STAFF.ROLES[role]||{}).label+')', -c.hireFee); }catch(e){}
  club.weekly_costs = (typeof _weeklyCareerCosts==='function') ? _weeklyCareerCosts() : club.weekly_costs;
  logEvent('✅ '+c.name+' rejoint le staff ('+STAFF.tierOf(c.rating).label+') — prime '+_fmtMoney(c.hireFee)+(prev?', l\'ancien titulaire est remercié.':'.'),'#18c860');
  closeModal();
  saveCareerV2();
  renderCareerDirectorTab('staff');
}

function fireStaff(role){
  if(typeof STAFF==='undefined' || !careerV2) return;
  const club = careerV2.club;
  if(!club.staff || !club.staff[role]){ return; }
  const name = club.staff[role].name;
  club.staff[role] = null;
  club.weekly_costs = (typeof _weeklyCareerCosts==='function') ? _weeklyCareerCosts() : club.weekly_costs;
  logEvent('👋 '+name+' a été remercié. Poste vacant.','#f0c028');
  saveCareerV2();
  renderCareerDirectorTab('staff');
}

// ── Calendrier mensuel jour par jour ────────────────────────────────────
const _MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function _calMatchOnDate(C, dateKey){
  return (C.fixtures||[]).find(function(f){
    return f.date && _dateKey(f.date)===dateKey && (f.homeIsPlayer||f.awayIsPlayer);
  }) || null;
}
function _calCupOnDate(C, dateKey){
  if(C.cup && Array.isArray(C.cup.weeks)){
    for(let i=0;i<C.cup.weeks.length;i++){
      if(_dateKey(_cupWeekDate(C.cup.weeks[i]))===dateKey) return {round:i, name:C.cup.name};
    }
  }
  if(C.leagueCup && Array.isArray(C.leagueCup.playoffWeeks)){
    for(let i=0;i<C.leagueCup.playoffWeeks.length;i++){
      if(_dateKey(_cupWeekDate(C.leagueCup.playoffWeeks[i]))===dateKey) return {round:i, name:C.leagueCup.name};
    }
  }
  return null;
}

function _renderDirectorCalendar(){
  const C = careerV2;
  const club = C.club;
  // Filet de sécurité : garantir que le système d'entraînement est initialisé
  // pour cette carrière (statut, planning hebdo, cohésion…), même si la save a
  // été restaurée par un chemin qui n'a pas déclenché la migration.
  try{
    if(typeof TRAINING!=='undefined' && (!club.status || !C.weekPlan)){
      TRAINING.migrateCareer(C);
    }
  }catch(e){ console.error('calendar migrate:', e); }
  // Mois affiché : celui de la date courante, sauf navigation manuelle.
  const viewDate = window._calViewDate || Object.assign({}, C.date);
  window._calViewDate = viewDate;
  const todayKey = _dateKey(C.date);

  let h = '<div style="background:var(--dark);border:1px solid var(--b1);border-radius:8px;padding:10px">';

  // ── En-tête + navigation mois ─────────────────────────────────────
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
  h += '<button class="btn" onclick="_calNavMonth(-1)" style="font-size:10px;padding:3px 8px">◀</button>';
  h += '<div style="font-size:11px;font-weight:900;color:var(--gold)">📅 '+_MOIS_FR[(viewDate.month-1)%12]+' — An '+viewDate.year+'</div>';
  h += '<button class="btn" onclick="_calNavMonth(1)" style="font-size:10px;padding:3px 8px">▶</button>';
  h += '</div>';
  h += '<div style="font-size:9px;color:var(--muted);margin-bottom:8px">Semaine '+C.week+' · Saison '+C.season+' · <span onclick="_calGoToday()" style="text-decoration:underline;cursor:pointer">revenir à aujourd\'hui</span></div>';

  // ── Forme / moral moyens de l'effectif ──────────────────────────────
  const _squadAll = (C.players||[]).concat(C.bench||[]);
  if(_squadAll.length){
    const avgFm = _squadAll.reduce(function(s,p){return s+(p._fm||0);},0)/_squadAll.length;
    const avgHm = _squadAll.reduce(function(s,p){return s+(p._hm||0);},0)/_squadAll.length;
    const fmCol = avgFm>=3?'#18c860':avgFm>=0?'#f0c028':'#e06060';
    const hmCol = avgHm>=3?'#18c860':avgHm>=0?'#f0c028':'#e06060';
    const avgCoh = _squadAll.reduce(function(s,p){return s+(p._coh!=null?p._coh:50);},0)/_squadAll.length;
    const cohCol = avgCoh>=65?'#18c860':avgCoh>=45?'#f0c028':'#e06060';
    h += '<div style="display:flex;gap:14px;margin-bottom:8px;font-size:9px">';
    h += '<div>💪 Forme moy. <b style="color:'+fmCol+'">'+avgFm.toFixed(1)+'</b>/10</div>';
    h += '<div>🙂 Moral moy. <b style="color:'+hmCol+'">'+avgHm.toFixed(1)+'</b>/10</div>';
    h += '<div>🤝 Cohésion <b style="color:'+cohCol+'">'+Math.round(avgCoh)+'</b>/100</div>';
    h += '</div>';
  }
  // ── Style du coach (influence le planning auto-généré par l'IA) ──────────
  if(typeof TRAINING_CONFIG!=='undefined' && TRAINING_CONFIG.coachStyles){
    const cur = (club && club.coachStyle) || 'equilibre';
    h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;font-size:9px">';
    h += '<span style="color:var(--muted)">🎓 Style du coach :</span>';
    h += '<select onchange="_calSetCoachStyle(this.value)" style="background:var(--dark);border:1px solid var(--b1);border-radius:6px;color:var(--fg);font-size:9px;padding:3px 6px">';
    Object.keys(TRAINING_CONFIG.coachStyles).forEach(function(k){
      h += '<option value="'+k+'"'+(k===cur?' selected':'')+'>'+TRAINING_CONFIG.coachStyles[k].label+'</option>';
    });
    h += '</select>';
    h += '<span style="color:var(--muted);font-size:8px">(oriente les séances auto)</span>';
    h += '</div>';
  }

  // ── Grille du mois (30 jours), alignée sur de vrais jours de semaine ────
  // En-tête Lun→Dim, puis cases vides avant le 1er du mois pour que les
  // samedis (matchs de ligue) et mercredis (coupe) tombent bien dans leurs
  // colonnes respectives, comme un vrai calendrier.
  const _WD_ABBR = ['L','M','M','J','V','S','D'];
  h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:3px">';
  _WD_ABBR.forEach(function(w,i){
    h += '<div style="text-align:center;font-size:8px;font-weight:900;color:'+(i===5?'#f0c028':i===2?'#00bcd4':'var(--muted)')+'">'+w+'</div>';
  });
  h += '</div>';
  h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">';
  const leadBlanks = _dayOfWeek({year:viewDate.year, month:viewDate.month, day:1});
  for(let i=0;i<leadBlanks;i++){ h += '<div></div>'; }
  for(let day=1; day<=30; day++){
    const d = {year:viewDate.year, month:viewDate.month, day:day};
    const dk = _dateKey(d);
    const isToday = dk===todayKey;
    const isPast = _dateToOrdinal(d) < _dateToOrdinal(C.date);
    const fix = _calMatchOnDate(C, dk);
    const cup = _calCupOnDate(C, dk);
    let plan = C.dayPlans && C.dayPlans[dk];
    // Si aucun override, dériver la journée du planning hebdo (aperçu).
    let planFromWeek = false;
    if(!plan && C.weekPlan && typeof _dayOfWeek==='function' && !isPast){
      const dow = _dayOfWeek(d);
      if(C.weekPlan[dow] && C.weekPlan[dow].slots){ plan = C.weekPlan[dow]; planFromWeek = true; }
    }

    let bg = 'var(--panel)', border = 'var(--b1)', icon = '', label='';
    if(fix){
      const isHome = fix.homeIsPlayer;
      const opp = (isHome ? fix.awayName : fix.homeName)||'?';
      icon = '⚽'; label = opp.slice(0,8);
      bg = fix.played ? 'rgba(24,200,96,.10)' : 'rgba(240,192,40,.12)';
      border = fix.played ? '#18c860' : '#f0c028';
    } else if(cup){
      icon = '🏆'; label = 'Coupe';
      bg = 'rgba(240,192,40,.12)'; border='#f0c028';
    } else if(plan){
      const planIcons = {training:'🏃', recovery:'🩹', rest:'😴', friendly:'🤝', video:'📹', matchprep:'📋', social:'🍻', magie:'✨'};
      if(plan.slots && typeof TRAINING_CONFIG!=='undefined'){
        // Journée à slots : icône = famille du 1er créneau actif, label = nb séances.
        const order = TRAINING_CONFIG.slots.order;
        let firstFam = null, nSess = 0;
        order.forEach(function(sk){
          const sl = plan.slots[sk];
          if(sl && sl.type && sl.type!=='rest'){ if(!firstFam) firstFam = sl.family||sl.type; nSess++; }
        });
        if(firstFam && TRAINING_CONFIG.families[firstFam]){ icon = TRAINING_CONFIG.families[firstFam].icon; }
        else if(firstFam){ icon = planIcons[firstFam]||'📌'; }
        else { icon = '😴'; }
        label = nSess>1 ? (nSess+' séances') : nSess===1 ? (TRAINING_CONFIG.families[firstFam]?TRAINING_CONFIG.families[firstFam].label:'séance') : 'repos';
      } else if((plan.type==='training'||plan.type==='recovery') && plan.family && typeof TRAINING_CONFIG!=='undefined' && TRAINING_CONFIG.families[plan.family]){
        icon = TRAINING_CONFIG.families[plan.family].icon;
        const s = (typeof TRAINING!=='undefined') ? TRAINING.getSession(plan.family, plan.session) : null;
        label = s ? s.label : (TRAINING_CONFIG.families[plan.family].label);
      } else {
        icon = planIcons[plan.type]||'📌';
        label = plan.type==='training' ? (plan.focus||'entraîn.') : plan.type==='friendly' ? (plan.oppName ? plan.oppName.slice(0,8) : 'amical') : plan.type==='rest' ? 'repos' : (planIcons[plan.type]?plan.type:'repos');
      }
      bg = planFromWeek ? 'rgba(0,188,212,.05)' : 'rgba(0,188,212,.10)';
      border = planFromWeek ? 'var(--b1)' : '#00bcd4';
    }
    if(isToday){ border = club.color || '#e02030'; }

    const clickable = !isPast && !fix && !cup;
    const onclick = clickable ? ' onclick="_calOpenPlanner(\''+dk+'\')" style="cursor:pointer"' : '';
    h += '<div'+onclick+' style="background:'+bg+';border:1.5px solid '+border+';border-radius:6px;padding:4px 2px;text-align:center;'+(isPast&&!fix?'opacity:.45;':'')+(clickable?'cursor:pointer;':'')+'min-height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center">';
    h += '<div style="font-size:9px;font-weight:'+(isToday?'900':'700')+';color:'+(isToday?(club.color||'#e02030'):'var(--fg)')+'">'+day+'</div>';
    if(icon) h += '<div style="font-size:11px;line-height:1">'+icon+'</div>';
    if(label) h += '<div style="font-size:6.5px;color:var(--muted);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+label+'</div>';
    h += '</div>';
  }
  h += '</div>';

  // ── Légende ──────────────────────────────────────────────────────
  h += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;font-size:8px;color:var(--muted)">';
  h += '<span>⚽ Match</span><span>🏆 Coupe</span><span>🏃 Entraîn.</span><span>🩹 Récup.</span><span>📹 Vidéo</span><span>🍻 Vie de groupe</span><span>✨ Magie</span><span>😴 Repos</span><span>🤝 Amical</span>';
  h += '</div>';

  // ── Panneau de planification (si un jour a été cliqué) ─────────────
  const pk = window._calPlannerKey;
  if(pk){
    const existing = C.dayPlans && C.dayPlans[pk];
    h += '<div style="margin-top:12px;background:var(--panel);border:1px solid #00bcd4;border-radius:8px;padding:10px">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
    h += '<div style="font-size:10px;font-weight:900;color:#00bcd4">📌 Planifier le '+pk.split('-').reverse().join('/')+'</div>';
    h += '<span onclick="_calClosePlanner()" style="cursor:pointer;color:var(--muted);font-size:12px">✕</span>';
    h += '</div>';
    // ── Sélecteur riche piloté par TRAINING (familles → séances) ──────────
    if(typeof TRAINING!=='undefined'){
      const club = C.club;
      const stLabel = TRAINING.statusLabel(club);
      const cap = TRAINING.maxSessions(club);
      const minS = TRAINING.minSessions(club);
      // Compte des séances d'effort déjà posées cette semaine (plafond).
      let weekSess = 0;
      try{ weekSess = _calCountWeekEffort(pk); }catch(e){}
      h += '<div style="font-size:8px;color:var(--muted);margin-bottom:6px">Statut : <b style="color:var(--gold)">'+stLabel+'</b> · séances cette semaine : <b style="color:'+(weekSess>=cap?'#e06060':'#18c860')+'">'+weekSess+'/'+cap+'</b> (min '+minS+')</div>';

      // ── Barre de créneaux (matin / après-midi / soir) ───────────────────
      const slotCfg = TRAINING_CONFIG.slots;
      const curSlot = window._calPlannerSlot || _calFirstOpenSlot(club);
      const dayObj = (existing && existing.slots) ? existing : null;
      h += '<div style="font-size:8px;font-weight:700;color:var(--muted);margin-bottom:3px">Créneau du jour</div>';
      h += '<div style="display:flex;gap:5px;margin-bottom:8px">';
      (slotCfg.order).forEach(function(sk){
        const open = TRAINING.slotOpen(club, sk);
        const on = sk===curSlot;
        const filled = dayObj && dayObj.slots && dayObj.slots[sk] && dayObj.slots[sk].type && dayObj.slots[sk].type!=='rest';
        let lbl = slotCfg.icons[sk]+' '+slotCfg.labels[sk];
        if(filled){ const fs=TRAINING.getSession(dayObj.slots[sk].family, dayObj.slots[sk].session); lbl += fs?' · '+fs.label.slice(0,10):''; }
        h += '<button '+(open?'onclick="_calSetSlot(\''+pk+'\',\''+sk+'\')"':'')+' style="flex:1;font-size:8.5px;padding:5px 4px;border-radius:6px;cursor:'+(open?'pointer':'not-allowed')+';opacity:'+(open?1:.4)+';border:1px solid '+(on?'#00bcd4':filled?'#18c860':'var(--b1)')+';background:'+(on?'rgba(0,188,212,.15)':filled?'rgba(24,200,96,.10)':'var(--dark)')+';color:var(--fg);font-weight:700">'+lbl+(open?'':' 🔒')+'</button>';
      });
      h += '</div>';

      const famKey = window._calPlannerFamily || (dayObj&&dayObj.slots&&dayObj.slots[curSlot]&&dayObj.slots[curSlot].family) || 'physique';
      // Onglets de familles.
      h += '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px">';
      const magicOK = TRAINING.magicUnlocked(club);
      Object.keys(TRAINING_CONFIG.families).forEach(function(fk){
        const fam = TRAINING_CONFIG.families[fk];
        // Masquer la famille magie tant que la Tour de Magie n'est pas construite.
        if(fam.requiresBuilding && !magicOK) return;
        const on = fk===famKey;
        h += '<button onclick="_calSetFamily(\''+pk+'\',\''+fk+'\')" style="font-size:9px;padding:4px 7px;border-radius:6px;cursor:pointer;border:1px solid '+(on?fam.color:'var(--b1)')+';background:'+(on?fam.color+'22':'var(--dark)')+';color:'+(on?fam.color:'var(--fg)')+';font-weight:700">'+fam.icon+' '+fam.label+'</button>';
      });
      h += '</div>';
      if(!magicOK){ h += '<div style="font-size:7.5px;color:var(--muted);margin-bottom:6px">🔮 Construis la <b>Tour de Magie</b> (onglet Infrastructures) pour débloquer l\'entraînement magique.</div>'; }
      // Séances de la famille active, avec métadonnées.
      const famDef = TRAINING_CONFIG.families[famKey];
      const dtype = famDef.recovery?'recovery':famDef.social?'social':famDef.requiresBuilding?'magie':'training';
      const isFree = (TRAINING_CONFIG.slots.freeTypes||[]).indexOf(dtype)>=0;
      h += '<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px">';
      TRAINING.familySessions(famKey).forEach(function(s){
        const cur = dayObj&&dayObj.slots&&dayObj.slots[curSlot];
        const on = cur&&cur.family===famKey&&cur.session===s.key;
        const intPct = Math.round((s.intensity||0)*100);
        const injPct = ((s.injury||0)*100).toFixed(1);
        const attrs = (s.attrs||[]).map(function(a){return a.toUpperCase();}).join('/');
        // Libellé d'effet spécifique magie / social.
        let effLbl = attrs;
        if(s.magic){ const m=[]; if(s.magic.precision)m.push('précision'); if(s.magic.manaMax)m.push('mana'); if(s.magic.learnSpell)m.push('nouveau sort'); effLbl = m.join('/'); }
        if(famDef.social){ effLbl = 'cohésion +'+(s.cohesion||0)+' · moral +'+(s.morale||0); }
        h += '<div onclick="_calPlanSlotSession(\''+pk+'\',\''+curSlot+'\',\''+dtype+'\',\''+famKey+'\',\''+s.key+'\')" style="cursor:pointer;background:'+(on?'rgba(0,188,212,.12)':'var(--dark)')+';border:1px solid '+(on?'#00bcd4':'var(--b1)')+';border-radius:6px;padding:6px 8px">';
        h += '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:10px;font-weight:800">'+s.label+(isFree?' <span style=\"font-size:7px;color:#18c860\">(hors plafond)</span>':'')+'</span><span style="font-size:8px;color:var(--muted)">'+(s.dur||0)+' min</span></div>';
        h += '<div style="display:flex;gap:8px;flex-wrap:wrap;font-size:7.5px;color:var(--muted);margin-top:2px">';
        h += '<span>⚡ '+intPct+'%</span>';
        h += '<span>😓 '+(s.fatigue>0?'+':'')+(s.fatigue||0)+'</span>';
        if(effLbl) h += '<span>📈 '+effLbl+'</span>';
        h += '<span>🤕 '+injPct+'%</span>';
        h += '</div></div>';
      });
      h += '</div>';
    } else {
      h += '<div style="font-size:9px;font-weight:700;color:var(--muted);margin-bottom:4px">Entraînement</div>';
      h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">';
      [['physique','💪 Physique'],['technique','🎯 Technique'],['tactique','🧠 Tactique'],['recuperation','🩹 Récup.']].forEach(function(f){
        h += '<button class="btn'+(existing&&existing.type==='training'&&existing.focus===f[0]?' btng':'')+'" onclick="_calPlanDay(\''+pk+'\',\'training\',\''+f[0]+'\')" style="font-size:9px;padding:5px 8px">'+f[1]+'</button>';
      });
      h += '</div>';
    }
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
    h += '<button class="btn'+(existing&&existing.type==='friendly'?' btng':'')+'" onclick="_calToggleFriendlyPicker(\''+pk+'\')" style="font-size:9px;padding:5px 8px">🤝 Match amical</button>';
    h += '<button class="btn" onclick="_calRestDay(\''+pk+'\')" style="font-size:9px;padding:5px 8px">😴 Journée repos</button>';
    if(typeof TRAINING!=='undefined'){
      h += '<button class="btn" onclick="_calAutoDay(\''+pk+'\')" style="font-size:9px;padding:5px 8px">🤖 Auto (IA)</button>';
    }
    if(existing) h += '<button class="btn" onclick="_calPlanDay(\''+pk+'\',null,null)" style="font-size:9px;padding:5px 8px;color:#e06060;border-color:#e06060">✕ Réinit.</button>';
    h += '</div>';
    if(C.weekPlanLockedByUser){
      h += '<div style="margin-top:6px;font-size:8px;color:var(--muted)">✋ Planning verrouillé (tes modifications priment). <span onclick="_calUnlockWeek()" style="text-decoration:underline;cursor:pointer;color:#00bcd4">Rendre la main à l\'IA</span></div>';
    }
    // Sélecteur d'adversaire pour l'amical (déplié au clic sur le bouton).
    if(window._calFriendlyPickerKey===pk){
      h += _calFriendlyPickerHTML(pk);
    }
    h += '</div>';
  }

  h += '</div>';
  return h;
}

function _calNavMonth(delta){
  const v = window._calViewDate || Object.assign({}, careerV2.date);
  let m = v.month + delta, y = v.year;
  if(m<1){ m=12; y--; } else if(m>12){ m=1; y++; }
  window._calViewDate = {year:y, month:m, day:1};
  window._calPlannerKey = null;
  renderCareerDirectorTab('calendar');
}
function _calGoToday(){
  window._calViewDate = Object.assign({}, careerV2.date);
  window._calPlannerKey = null;
  renderCareerDirectorTab('calendar');
}
function _calOpenPlanner(dateKey){
  window._calPlannerKey = dateKey;
  renderCareerDirectorTab('calendar');
}
function _calClosePlanner(){
  window._calPlannerKey = null;
  renderCareerDirectorTab('calendar');
}
function _calPlanDay(dateKey, type, focus){
  if(!careerV2) return;
  if(type===null){ _unplanDay(dateKey); }
  else {
    const ok = _planDay(dateKey, type, focus);
    if(!ok){ logEvent('❌ Un match est déjà prévu ce jour-là.','#e02030'); return; }
  }
  saveCareerV2();
  window._calPlannerKey = null;
  window._calFriendlyPickerKey = null;
  renderCareerDirectorTab('calendar');
}

// Change la famille de séances affichée dans le planificateur (sans planifier).
function _calSetFamily(dateKey, familyKey){
  window._calPlannerFamily = familyKey;
  renderCareerDirectorTab('calendar');
}

// Change le style du coach (réoriente les prochains plannings auto de l'IA).
function _calSetCoachStyle(style){
  if(!careerV2 || !careerV2.club) return;
  careerV2.club.coachStyle = style;
  // Régénérer le planning hebdo par défaut si le joueur n'a rien verrouillé.
  if(!careerV2.weekPlanLockedByUser && typeof TRAINING!=='undefined'){
    careerV2.weekPlan = TRAINING.generateWeekPlan(careerV2.club, {});
  }
  saveCareerV2();
  renderCareerDirectorTab('calendar');
}

// Met toute la journée au repos (créneaux ouverts → repos).
function _calRestDay(dateKey){
  if(!careerV2) return;
  const C = careerV2;
  if(!C.dayPlans) C.dayPlans = {};
  const slots = {};
  (TRAINING_CONFIG.slots.order||['evening']).forEach(function(sk){
    slots[sk] = TRAINING.slotOpen(C.club, sk) ? { type:'rest' } : null;
  });
  C.dayPlans[dateKey] = { type:'day', slots:slots };
  C.weekPlanLockedByUser = true;
  saveCareerV2();
  window._calPlannerKey = null;
  renderCareerDirectorTab('calendar');
}

// Laisse l'IA générer la journée (copie la journée hebdo correspondante).
function _calAutoDay(dateKey){
  if(!careerV2 || typeof TRAINING==='undefined') return;
  const C = careerV2;
  const parts = String(dateKey).split('-');
  const d = { year:+parts[0], month:+parts[1], day:+parts[2] };
  const dow = (typeof _dayOfWeek==='function') ? _dayOfWeek(d) : 0;
  // Régénère un planning frais et prend la journée voulue.
  const fresh = TRAINING.generateWeekPlan(C.club, {});
  if(C.dayPlans) delete C.dayPlans[dateKey]; // retire l'override → suit l'hebdo
  if(!C.weekPlan) C.weekPlan = fresh;
  C.weekPlan[dow] = fresh[dow];
  saveCareerV2();
  window._calPlannerKey = null;
  renderCareerDirectorTab('calendar');
}

// Rend la main à l'IA : supprime les overrides et déverrouille le planning.
function _calUnlockWeek(){
  if(!careerV2 || typeof TRAINING==='undefined') return;
  const C = careerV2;
  C.weekPlanLockedByUser = false;
  C.dayPlans = C.dayPlans || {};
  // Ne retire que les overrides d'entraînement (garde amicaux/matchs).
  Object.keys(C.dayPlans).forEach(function(k){
    const p = C.dayPlans[k];
    if(p && (p.slots || p.type==='training' || p.type==='recovery' || p.type==='social' || p.type==='magie' || p.type==='rest' || p.type==='video' || p.type==='matchprep')){
      if(!(p.type==='friendly')) delete C.dayPlans[k];
    }
  });
  C.weekPlan = TRAINING.generateWeekPlan(C.club, {});
  saveCareerV2();
  window._calPlannerKey = null;
  renderCareerDirectorTab('calendar');
}

// Sélectionne le créneau (matin/après-midi/soir) en cours d'édition.
function _calSetSlot(dateKey, slotKey){
  window._calPlannerSlot = slotKey;
  window._calPlannerFamily = null; // réinitialise l'onglet famille
  renderCareerDirectorTab('calendar');
}
// Premier créneau ouvert pour le statut du club (défaut d'édition).
function _calFirstOpenSlot(club){
  const order = (TRAINING_CONFIG.slots&&TRAINING_CONFIG.slots.order)||['evening'];
  for(const sk of order){ if(TRAINING.slotOpen(club, sk)) return sk; }
  return 'evening';
}
// Compte les séances d'effort de la semaine contenant dateKey (override + hebdo).
function _calCountWeekEffort(dateKey){
  const C = careerV2; if(!C) return 0;
  const wk = _weekOfDateKey(dateKey);
  const freeTypes = (TRAINING_CONFIG.slots.freeTypes||[]);
  let n = 0;
  // Overrides posés par le joueur sur des dates de cette semaine.
  const seen = {};
  Object.keys(C.dayPlans||{}).forEach(function(k){
    if(_weekOfDateKey(k)!==wk) return;
    const d = C.dayPlans[k];
    seen[k] = true;
    if(d && d.slots){
      Object.keys(d.slots).forEach(function(s){
        const sl=d.slots[s];
        if(sl&&sl.type&&sl.type!=='rest'&&sl.type!=='match'&&freeTypes.indexOf(sl.type)<0) n++;
      });
    } else if(d && d.type==='training'){ n++; }
  });
  return n;
}

// Assigne une séance à un créneau précis du jour (crée un dayPlan à slots).
// Respecte le plafond hebdo : refuse un créneau d'effort au-delà de la limite.
function _calPlanSlotSession(dateKey, slotKey, dtype, family, session){
  if(!careerV2) return;
  const C = careerV2;
  const freeTypes = (TRAINING_CONFIG.slots.freeTypes||[]);
  const isEffort = freeTypes.indexOf(dtype) < 0;

  // Récupère (ou initialise depuis le planning hebdo) la journée à slots.
  if(!C.dayPlans) C.dayPlans = {};
  let day = C.dayPlans[dateKey];
  if(!day || !day.slots){
    // Repartir de la journée hebdo correspondante si elle existe.
    const parts = String(dateKey).split('-');
    const d = { year:+parts[0], month:+parts[1], day:+parts[2] };
    const dow = (typeof _dayOfWeek==='function') ? _dayOfWeek(d) : 0;
    const base = (C.weekPlan && C.weekPlan[dow] && C.weekPlan[dow].slots) ? C.weekPlan[dow] : null;
    day = { type:'day', slots: base ? JSON.parse(JSON.stringify(base.slots)) : {} };
  }

  // Contrôle du plafond si on ajoute une séance d'effort sur un créneau vide.
  const already = day.slots[slotKey] && day.slots[slotKey].type && day.slots[slotKey].type!=='rest';
  if(isEffort && !already){
    const cap = TRAINING.maxSessions(C.club);
    const wkCount = _calCountWeekEffort(dateKey);
    if(wkCount >= cap){
      logEvent('❌ Plafond atteint : club '+TRAINING.statusLabel(C.club).toLowerCase()+' → '+cap+' séance(s)/semaine max.','#e02030');
      return;
    }
  }
  // Toggle : recliquer la même séance = vider le créneau.
  const c = day.slots[slotKey];
  if(c && c.family===family && c.session===session){ day.slots[slotKey] = { type:'rest' }; }
  else { day.slots[slotKey] = { type:dtype, family:family, session:session }; }

  C.dayPlans[dateKey] = day;
  C.weekPlanLockedByUser = true;
  saveCareerV2();
  renderCareerDirectorTab('calendar');
}

// Planifie une séance précise (famille + type) sur un jour, en respectant le
// plafond de séances du statut du club (empêche p.ex. un amateur d'en abuser).
function _calPlanSession(dateKey, type, family, session){
  if(!careerV2) return;
  const C = careerV2;
  // Contrôle du plafond hebdo : compte les séances déjà planifiées cette semaine.
  if(type==='training' && typeof TRAINING!=='undefined'){
    const cap = TRAINING.maxSessions(C.club);
    const wk = _weekOfDateKey(dateKey);
    let count = 0;
    Object.keys(C.dayPlans||{}).forEach(function(k){
      const p = C.dayPlans[k];
      if(p && p.type==='training' && _weekOfDateKey(k)===wk && k!==dateKey) count++;
    });
    if(count >= cap){
      logEvent('❌ Plafond atteint : un club '+TRAINING.statusLabel(C.club).toLowerCase()+' ne peut programmer que '+cap+' séance(s)/semaine.','#e02030');
      return;
    }
  }
  const ok = _planDay(dateKey, type, null, { family:family, session:session });
  if(!ok){ logEvent('❌ Un match est déjà prévu ce jour-là.','#e02030'); return; }
  C.weekPlanLockedByUser = true; // l'IA ne réécrase plus le planning cette semaine
  saveCareerV2();
  window._calPlannerKey = null;
  window._calFriendlyPickerKey = null;
  renderCareerDirectorTab('calendar');
}

// Numéro de semaine ISO-approché d'un dateKey 'Y-MM-DD', pour compter les séances.
function _weekOfDateKey(dateKey){
  const parts = String(dateKey).split('-');
  const d = { year:+parts[0], month:+parts[1], day:+parts[2] };
  if(typeof _dateToOrdinal==='function') return Math.floor(_dateToOrdinal(d)/7);
  return d.year*52 + d.month*4 + Math.floor(d.day/7);
}

// Ouvre / ferme le sélecteur d'adversaire d'amical pour une date donnée.
function _calToggleFriendlyPicker(dateKey){
  window._calFriendlyPickerKey = (window._calFriendlyPickerKey===dateKey) ? null : dateKey;
  window._calFriendlyOppFilter = window._calFriendlyOppFilter || '';
  renderCareerDirectorTab('calendar');
}
function _calSetFriendlyFilter(v){
  window._calFriendlyOppFilter = v||'';
  renderCareerDirectorTab('calendar');
  // Redonner le focus au champ après re-render.
  setTimeout(function(){ const el=document.getElementById('friendly-opp-filter'); if(el){ el.focus(); el.value=window._calFriendlyOppFilter; } },0);
}
// HTML du sélecteur d'adversaire : recherche + liste cliquable des clubs.
function _calFriendlyPickerHTML(dateKey){
  const C = careerV2;
  const all = (typeof _friendlyOpponents==='function') ? _friendlyOpponents() : [];
  const filter = (window._calFriendlyOppFilter||'').toLowerCase();
  const list = (filter ? all.filter(function(t){ return t.name.toLowerCase().indexOf(filter)>=0; }) : all).slice(0, 40);
  let h = '<div style="margin-top:8px;border-top:1px dashed #00bcd4;padding-top:8px">';
  h += '<div style="font-size:9px;color:var(--muted);margin-bottom:6px">Choisis l\'adversaire de l\'amical :</div>';
  h += '<input id="friendly-opp-filter" type="text" placeholder="Rechercher un club..." value="'+(window._calFriendlyOppFilter||'').replace(/"/g,'&quot;')+'" oninput="_calSetFriendlyFilter(this.value)" style="width:100%;box-sizing:border-box;background:var(--dark);border:1px solid var(--b1);border-radius:6px;color:var(--fg);padding:6px 8px;font-size:11px;margin-bottom:6px">';
  if(!list.length){
    h += '<div style="font-size:9px;color:var(--muted);padding:6px">Aucun club trouvé.</div>';
  } else {
    h += '<div style="display:flex;flex-direction:column;gap:3px;max-height:200px;overflow-y:auto">';
    list.forEach(function(t){
      const lvlLabel = t.level ? String(t.level).replace('valcourt_','V-').replace('brumefer_','B-').replace('district','D').toUpperCase() : '';
      h += '<div onclick="_calPlanFriendly(\''+dateKey+'\',\''+t.name.replace(/'/g,"\\\\'").replace(/"/g,'&quot;')+'\')" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;background:var(--dark);border:1px solid var(--b1)">';
      h += '<span style="width:18px;height:18px;border-radius:50%;background:'+(t.color||'#888')+'33;border:2px solid '+(t.color||'#888')+';flex-shrink:0"></span>';
      h += '<span style="flex:1;font-size:11px;font-weight:700;color:'+(t.color||'var(--fg)')+'">'+t.name+'</span>';
      if(lvlLabel) h += '<span style="font-size:8px;color:var(--muted)">'+lvlLabel+'</span>';
      h += '</div>';
    });
    h += '</div>';
  }
  h += '</div>';
  return h;
}
// Planifie un amical avec l'adversaire choisi, à la date donnée.
function _calPlanFriendly(dateKey, oppName){
  if(!careerV2) return;
  const all = (typeof _friendlyOpponents==='function') ? _friendlyOpponents() : [];
  const opp = all.find(function(t){ return t.name===oppName; });
  if(!opp){ logEvent('Adversaire introuvable.','#e02030'); return; }
  const ok = _planDay(dateKey, 'friendly', null, {
    oppName: opp.name, oppLevel: opp.level, oppColor: opp.color||null, oppBadge: opp.badge||null,
  });
  if(!ok){ logEvent('❌ Un match est déjà prévu ce jour-là.','#e02030'); return; }
  careerLog('🤝 Amical programmé le '+dateKey.split('-').reverse().join('/')+' contre '+opp.name+'.', '#00bcd4');
  saveCareerV2();
  window._calFriendlyPickerKey = null;
  window._calPlannerKey = null;
  window._calFriendlyOppFilter = '';
  renderCareerDirectorTab('calendar');
}



// ── Rendu principal Manager ───────────────────────────────────────────
function renderCareerManager(el){
  const C = careerV2;
  const mgr = C.manager;
  let h = '<div style="padding:8px;max-width:600px;margin:0 auto">';
  h += '<div style="background:var(--panel);border:2px solid #8840e0;border-radius:10px;padding:10px;margin-bottom:10px">';
  h += '<div style="display:flex;align-items:center;gap:10px">';
  h += '<div style="font-size:28px">🧑</div>';
  h += '<div><div style="font-size:14px;font-weight:900">'+mgr.name+'</div>';
  h += '<div style="font-size:9px;color:var(--muted)">Licence '+mgr.license+' · Reputation '+mgr.reputation+'/100</div>';
  h += '<div style="font-size:9px;color:'+(mgr.unemployed?'#e06060':'#18c860')+'">'+(mgr.unemployed?'🔴 Sans club':'🟢 '+( C.club ? C.club.name : ''))+'</div>';
  h += '</div></div></div>';
  if(mgr.unemployed){
    h += '<div style="background:var(--dark);border:1px solid var(--b1);border-radius:8px;padding:10px;margin-bottom:10px">';
    h += '<div style="font-size:10px;font-weight:700;color:var(--gold);margin-bottom:8px">📬 Offres d\'emploi</div>';
    if(!C.job_offers || C.job_offers.length === 0){
      h += '<div style="color:var(--muted);font-size:9px">Aucune offre. Avancez d\'une semaine.</div>';
    } else {
      C.job_offers.forEach(function(offer, i){
        h += '<div style="background:var(--panel);border-radius:6px;padding:8px;margin-bottom:6px">';
        h += '<div style="font-size:11px;font-weight:700;color:var(--fg)">'+offer.club+'</div>';
        h += '<div style="font-size:9px;color:var(--muted)">'+offer.region+' · '+offer.level.toUpperCase()+'</div>';
        h += '<div style="font-size:9px;color:#18c860">Salaire : 🪙 '+_fmtMoney(offer.salary)+'/semaine</div>';
        h += '<div style="font-size:9px;color:#f0c028">Objectif : '+(offer.objectives[0] ? offer.objectives[0].desc : '?')+'</div>';
        h += '<div style="display:flex;gap:6px;margin-top:6px">';
        h += '<button class="btn btng" onclick="acceptManagerJob('+i+')" style="font-size:9px;flex:1">✅ Accepter</button>';
        h += '<button class="btn" onclick="rejectManagerJob('+i+')" style="font-size:9px;padding:2px 8px">❌</button>';
        h += '</div></div>';
      });
    }
    h += '</div>';
  }
  h += '<div style="display:flex;gap:6px;margin-top:8px">';
  h += '<button class="btn btng" onclick="advanceCareerWeek()" style="flex:1;font-size:10px">⏩ Semaine suivante</button>';
  h += '<button class="btn" onclick="abandonCareerV2()" style="font-size:9px;color:#e06060;border-color:#e06060">✕ Abandonner</button>';
  h += '</div></div>';
  el.innerHTML = h;
}


// ── Actions carrière ──────────────────────────────────────────────────
// Exécute tous les systèmes à cadence hebdomadaire (économie, infra, coupe,
// mercato, événements...). Appelé soit par le saut rapide de semaine, soit
// automatiquement par _advanceOneDay() dès qu'on franchit une frontière de
// semaine calendaire.
function _runWeeklySystems(){
  if(!careerV2) return;
  const C = careerV2;

  if(!C.freeAgents || C.freeAgents.length === 0){
    _generateFreeAgents();
  }

  _applyWeeklyEconomy();

  // ── Simulation automatique en fond de TOUS les matchs PNJ échus ──────────
  // Le classement reste vivant journée après journée sans action du joueur.
  try{ if(typeof _runBackgroundNpcSim==='function') _runBackgroundNpcSim(); }catch(e){ console.error('npc bg sim:',e); }

  try{ if(typeof _advanceInfraWorks==='function') _advanceInfraWorks(); }catch(e){ console.error('works:',e); }
  try{ if(typeof _advanceNationalCup==='function') _advanceNationalCup(); }catch(e){ console.error('cup:',e); }
  try{ if(typeof _advanceLeagueCup==='function') _advanceLeagueCup(); }catch(e){ console.error('leaguecup:',e); }
  try{ if(typeof _advanceHouseCup==='function') _advanceHouseCup(); }catch(e){ console.error('housecup:',e); }

  if(C.week % 4 === 0){
    _generateFreeAgents();
    logEvent('🔄 Nouveaux joueurs libres disponibles !','#00bcd4');
  }

  const isPro = C.club && ['d1','d2','d3'].includes(C.club.level);
  if(isPro){
    _checkMercatoWindow();
  }

  _triggerRegionEvent();
  _triggerWeeklyEvent();

  // ── Planning d'entraînement hebdomadaire (IA) ───────────────────────────
  // L'IA régénère un planning respectant le statut du club et le style du
  // coach. Le joueur reste libre de déplacer/écraser les séances via l'UI.
  try{
    if(typeof TRAINING!=='undefined' && C.club){
      const congested = !!(C.fixtures||[]).find(function(f){
        return !f.played && (f.homeIsPlayer||f.awayIsPlayer) && f.week===C.week;
      });
      const squadAll = (C.players||[]).concat(C.bench||[]);
      const avgForm = squadAll.length ? squadAll.reduce(function(s,p){return s+(p._fm||0);},0)/squadAll.length : 0;
      if(!C.weekPlanLockedByUser){
        C.weekPlan = TRAINING.generateWeekPlan(C.club, { congested:congested, avgForm:avgForm });
      }
    }
  }catch(e){ console.error('weekly training plan:', e); }
}

// Saut rapide d'une semaine entière (conservé pour compatibilité / usage
// ponctuel — ex. carrière manager sans effectif à entraîner). Fait avancer
// C.date de 7 jours d'un coup sans résoudre les plans jour par jour.
function advanceCareerWeek(){
  if(!careerV2) return;
  const C = careerV2;

  if(!C.fixtures || C.fixtures.length === 0){
    _generateSeasonFixtures();
  }

  C.week++;
  C.date = _addDays(C.date, 7);
  _runWeeklySystems();

  saveCareerV2();
  renderCareerV2();
}

// ── Avancement jour par jour ────────────────────────────────────────────
// Cœur du nouveau calendrier : fait avancer la carrière d'UNE journée.
// - Si un match du club joueur (championnat ou coupe) tombe aujourd'hui, on
//   ne fait PAS avancer la date : on signale le match en attente et le
//   joueur doit explicitement Jouer ou Simuler avant de pouvoir continuer.
// - Sinon, on résout le plan du jour (entraînement / repos / amical), on
//   avance la date d'un jour, on recalcule la semaine, et si on vient de
//   franchir une nouvelle semaine on déclenche les systèmes hebdomadaires.
function _advanceOneDay(){
  if(!careerV2) return;
  const C = careerV2;
  if(!C.fixtures || C.fixtures.length === 0) _generateSeasonFixtures();
  if(!C.seasonStartDate) C.seasonStartDate = Object.assign({}, C.date);

  // Résoudre en fond tous les matchs PNJ échus jusqu'à aujourd'hui, pour que
  // le classement reflète les résultats du jour même avant tout affichage.
  try{ if(typeof _simulateBackgroundNpcFixtures==='function') _simulateBackgroundNpcFixtures(C.date); }catch(e){ console.error('npc bg sim:',e); }

  const todayKey = _dateKey(C.date);
  const pending = _matchOnDateKey(todayKey);
  if(pending){
    if(pending.cup) C._pendingMatch = {cup:true};
    else if(pending.playoff) C._pendingMatch = {playoff:true};
    else if(pending.friendly) C._pendingMatch = {friendly:true, dateKey:pending.dateKey};
    else C._pendingMatch = {fixtureId:pending.id};
    saveCareerV2();
    renderCareerV2();
    return;
  }

  // Résoudre le plan du jour (entraînement/repos/amical) puis avancer.
  if(C.type==='director'){
    const msg = _resolveDayPlan(todayKey);
    if(msg) careerLog(msg, '#00bcd4');
  }
  if(C.dayPlans) delete C.dayPlans[todayKey];

  C.date = _addDays(C.date, 1);
  const elapsedDays = _daysBetween(C.seasonStartDate, C.date);
  const newWeek = Math.max(1, Math.floor(elapsedDays/7) + 1);
  if(newWeek !== C.week){
    C.week = newWeek;
    _runWeeklySystems();
  }

  saveCareerV2();
  renderCareerV2();
}


function _checkMercatoWindow(){
  if(!careerV2) return;
  const month = careerV2.date.month;
  const wasOpen = careerV2.mercato.window_open;

  // Été : mois 6-7 / Hiver : mois 12-1
  const isOpen = [6,7,12,1].includes(month);
  const type = [6,7].includes(month) ? 'summer' : 'winter';

  if(isOpen && !wasOpen){
    careerV2.mercato.window_open = true;
    careerV2.mercato.window_type = type;
    logEvent('Fenetre de transferts '+(type==='summer'?'estivale':'hivernale')+' ouverte !','#f0c028');
  } else if(!isOpen && wasOpen){
    careerV2.mercato.window_open = false;
    careerV2.mercato.window_type = null;
    logEvent('🔒 Fenêtre de transferts fermée.','#e06060');
  }
}


function _triggerWeeklyEvent(){
  if(!careerV2 || careerV2.type !== 'director') return;
  const C = careerV2;
  const level = C.club.level;
  const isPro = ['d1','d2','d3'].includes(level);

  // Blessure aléatoire d'un joueur (5%)
  if(Math.random() < 0.05){
    const allP = (C.players||[]).concat(C.bench||[]).filter(function(p){ return !p._missNextMatch && p.injLevel < 2; });
    if(allP.length > 0){
      const p = allP[Math.floor(Math.random()*allP.length)];
      p.injLevel = 1;
      p.injT = (2 + Math.floor(Math.random()*3)) * 7; // 2-4 semaines
      logEvent('🤕 ' + p.name + ' est blessé pour ' + Math.ceil(p.injT/7) + ' semaine(s) !','#f0c028');
    }
  }

  // Récupération blessures
  (C.players||[]).concat(C.bench||[]).forEach(function(p){
    if(p.injLevel > 0 && p.injT > 0){
      p.injT = Math.max(0, p.injT - 7);
      if(p.injT === 0){
        p.injLevel = 0;
        logEvent('💪 ' + p.name + ' est remis de sa blessure !','#18c860');
      }
    }
  });

  // Amateur : un joueur part (2%) — il a trouvé autre chose
  if(!isPro && Math.random() < 0.02 && (C.players||[]).length > 7){
    const arr = C.players || [];
    const idx = 1 + Math.floor(Math.random()*(arr.length-1)); // pas le GB
    const p = arr[idx];
    if(p){
      arr.splice(idx, 1);
      logEvent('😢 ' + p.name + ' quitte le club (raisons personnelles).','#e06060');
    }
  }
}

function _triggerRegionEvent(){
  if(!careerV2 || careerV2.type !== 'director') return;
  const region = WORLDS.getRegion('panthalassa',careerV2.club.region);
  if(!region) return;

  // Événements positifs (Les Mers Bénies)
  if(region.traits?.positive_events && Math.random() < 0.15){
    const events = [
      '🌊 Une vague de bonne fortune — un joueur récupère plus vite de sa blessure !',
      '🌊 Les dieux marins sourient — moral de l\'équipe au maximum cette semaine !',
      '🌊 Journée bénie — un sponsor offre un bonus inattendu !',
    ];
    logEvent(events[Math.floor(Math.random()*events.length)],'#18c860');
    if(Math.random() < 0.3) _addFinanceLog('Bonus surprise (Les Mers Bénies)', 500);
  }

  // Risque de corruption (Maï)
  if(region.traits?.corruption_risk && Math.random() < 0.08){
    careerV2.pending_events.push({
      type: 'corruption_offer',
      desc: 'Une proposition douteuse vous est soumise...',
      deadline: careerV2.week + 2,
    });
    logEvent('⚠️ Une proposition suspecte est arrivée dans votre bureau...','#e06020');
  }

  // Pépite (Nérïa) — un bon recruteur (staff.js) multiplie les chances.
  const _gemMul = (typeof STAFF!=='undefined' && careerV2) ? STAFF.gemChanceMul(careerV2.club) : 1;
  if(region.traits?.gem_chance && Math.random() < 0.03 * _gemMul){
    const gemName = ['Mystara','Arcania','Crystana','Runalia','Sigilia'][Math.floor(Math.random()*5)];
    const gem = mkGemPlayer(gemName, 'ATT');
    careerV2.pending_events.push({
      type: 'gem_discovered',
      desc: 'Le scout a decouvert une pepite : '+gemName+' !',
      player: gem,
    });
    logEvent('💎 Pepite decouverte : '+gemName,'#9c27b0');
  }
}

function _addFinanceLog(desc, amount){
  if(!careerV2) return;
  careerV2.finances.log.push({desc, amount, week: careerV2.week});
  if(amount < 0) careerV2.finances.total_spent += Math.abs(amount);
  else careerV2.finances.total_earned += amount;
}

function upgradeInfraV2(key){
  if(!careerV2 || careerV2.type !== 'director') return;
  const club = careerV2.club;
  const lvl = (club.infra[key]||0);
  const cost = Math.round(1000 * Math.pow(3, lvl));
  if(club.budget < cost){ logEvent('❌ Budget insuffisant','#e02030'); return; }
  club.budget -= cost;
  club.infra[key] = lvl + 1;
  _addFinanceLog('Amelioration '+key+' niv.'+(lvl+1), -cost);
  logEvent('Infrastructure amelioree niveau '+(lvl+1)+'!','#18c860');
  saveCareerV2();
  renderCareerDirectorTab('infra');
}

function openTransferMarket(){
  logEvent('🔄 Marché des transferts — fonctionnalité à venir !','#f0c028');
}

function acceptManagerJob(i){
  if(!careerV2 || careerV2.type !== 'manager') return;
  const offer = careerV2.job_offers[i];
  if(!offer) return;
  careerV2.manager.unemployed = false;
  careerV2.manager.contract = offer;
  careerV2.club = {
    id: 'mgr_club',
    name: offer.club,
    region: offer.region,
    level: offer.level,
    color: WORLDS.getRegion('panthalassa',offer.region)?.color || '#888',
  };
  careerV2.job_offers = [];
  logEvent('✅ Contrat signe avec '+offer.club+'!','#18c860');
  saveCareerV2();
  renderCareerV2();
}

function rejectManagerJob(i){
  if(!careerV2) return;
  careerV2.job_offers.splice(i, 1);
  saveCareerV2();
  renderCareerV2();
}


// Applique le bonus staff (staff.js) au moral/cohésion/concentration des
// joueurs alignés au coup d'envoi : manager + adjoint (moral/cohésion) et
// analyste vidéo (petit boost de forme = concentration de 1re mi-temps).
function _applyStaffMatchdayBonus(club, starters, matchBench){
  if(typeof STAFF==='undefined' || !club) return;
  // Coups de pied arrêtés : le coach spécialisé règle l'efficacité offensive
  // (>1) et défensive (<1) de l'équipe du joueur (team 0). Lu par ia.js.
  try{
    if(teams && teams[0]){
      teams[0]._setpAtk = STAFF.setPieceAttackMul(club);
      teams[0]._setpDef = STAFF.setPieceDefenseMul(club);
    }
  }catch(e){}
  const mB = STAFF.matchMoraleBonus(club);
  const cB = STAFF.matchCohesionBonus(club);
  const aB = STAFF.analystMatchBonus(club);
  if(mB<=0 && cB<=0 && aB<=0) return;
  (starters||[]).concat(matchBench||[]).forEach(function(p){
    if(!p) return;
    p._hm  = Math.max(-10, Math.min(10, (p._hm||0) + mB));
    p._coh = Math.max(0,  Math.min(100,(p._coh!=null?p._coh:50) + cB));
    if(aB>0) p._fm = Math.max(-10, Math.min(10, (p._fm||0) + aB));
  });
}

// ── Match en carrière Dirigeant ───────────────────────────────────────
function playCareerMatchV2(){
  if(!careerV2) return;
  const C = careerV2;
  const fix = C._pendingMatch && C._pendingMatch.fixtureId
    ? (C.fixtures||[]).find(function(f){ return f.id===C._pendingMatch.fixtureId; })
    : (C.fixtures||[]).find(function(f){ return !f.played; });
  if(!fix){ logEvent('Aucun match à jouer !','#e02030'); return; }

  const isHome = fix.homeIsPlayer;
  const oppName = isHome ? fix.awayName : fix.homeName;
  const level   = C.club.level;
  const nation  = C.nation || 'panthalassa';
  const region  = C.club.region;

  // ── Format de match actif (5v5 / 7v7 / 11v11) ───────────────────────
  // AVANT : le joueur envoyait TOUT son effectif de carrière sur le
  // terrain (jusqu'à 18 joueurs en D1) alors que l'adversaire IA était
  // toujours généré en 7v7 fixe (7 titulaires) → un joueur en mode 11v11
  // se retrouvait à jouer 18 (ou 11) contre 7. On aligne maintenant les
  // deux équipes sur le format réellement actif (window.gameMode).
  const mode = window.gameMode || '7v7';
  const XI_POS = mode==='11v11' ? ['GB','DD','DC','DC','DG','MC','MC','MC','MC','ATT','ATT']
               : mode==='5v5'   ? ['GB','DC','MOG','MOD','ATT']
               :                  ['GB','DC','DD','DG','MC','MC','ATT'];
  const BENCH_POS = mode==='11v11' ? ['GB','DC','MC','MC','ATT','DD','DG']
                  : mode==='5v5'   ? ['GB','DC','MC','ATT','DC']
                  :                  ['GB','MC','ATT','DC','MC'];
  const xiSize = XI_POS.length;

  // ── Équipe du joueur (team 0) : on compose une XI + un banc de la bonne
  // taille (celle du format actif) à partir des MEILLEURS joueurs de
  // l'effectif complet de carrière. AVANT : tout le reste de l'effectif
  // (jusqu'à 18 joueurs) finissait sur le banc du match → banc énorme et
  // déséquilibré face à l'adversaire IA (banc normal). Maintenant, le banc
  // du match a la même taille que celui de l'IA (BENCH_POS) ; le surplus
  // part en réservistes (pas utilisé ce match, mais toujours dans le club).
  const benchSize = BENCH_POS.length;
  const fullSquad = (C.players||[]).map(function(p){ return Object.assign({}, p); })
    .concat((C.bench||[]).map(function(p){ return Object.assign({}, p); }));
  const gkPool = fullSquad.filter(function(p){ return p && p.pos==='GB'; })
    .sort(function(a,b){ return _playerOvr(b)-_playerOvr(a); });
  const outfieldPool = fullSquad.filter(function(p){ return p && p.pos!=='GB'; })
    .sort(function(a,b){ return _playerOvr(b)-_playerOvr(a); });

  const starters = [];
  if(gkPool[0]) starters.push(gkPool[0]);
  outfieldPool.forEach(function(p){ if(starters.length < xiSize) starters.push(p); });

  const leftoverGk  = gkPool.slice(1); // gardiens non titulaires (remplaçant prioritaire)
  const leftoverOut = outfieldPool.filter(function(p){ return starters.indexOf(p) < 0; });
  const matchBench = [];
  if(leftoverGk[0]) matchBench.push(leftoverGk[0]);
  leftoverGk.slice(1).concat(leftoverOut).forEach(function(p){ if(matchBench.length < benchSize) matchBench.push(p); });

  const usedIds = starters.concat(matchBench);
  const surplus = fullSquad.filter(function(p){ return usedIds.indexOf(p) < 0; });

  // IMPORTANT : (ré)initialiser onBench/subbedOut sur les joueurs qu'on vient
  // de répartir. Sans ça, un joueur venant du pool "titulaires" (C.players,
  // jamais marqué onBench) qui atterrit sur le banc du match gardait
  // onBench=false → l'écran d'avant-match l'affichait "Indispo" et
  // empêchait tout changement manuel avec lui.
  starters.forEach(function(p){ if(p){ p.onBench=false; p.subbedOut=false; } });
  matchBench.forEach(function(p){ if(p){ p.onBench=true; p.subbedOut=false; } });
  try{ _applyStaffMatchdayBonus(C.club, starters, matchBench); }catch(e){}

  teams[0] = {
    name:    C.club.name,
    color:   C.club.color || '#e02030',
    img:     C.club.img   || '',
    strat:   C.club.strat || '321',
    players: starters,
    bench:   matchBench,
    reserves: surplus.concat((C.reserves||[]).map(function(p){ return Object.assign({}, p); })),
  };

  // ── Équipe adversaire IA (team 1) — générée au même format et niveau ─
  const aiSquad = WORLDS.generateSquad(nation, region, {
    positions: XI_POS,
    bench: BENCH_POS,
    reserves: [],
    level: level,
  });
  // Noms depuis la région ou génériques
  const regionObj = WORLDS.getRegion(nation, region);
  let aiColor   = regionObj ? regionObj.color : '#1878e8';
  let aiBadge   = null;
  // Si l'adversaire est une équipe Valoria (au classement), on récupère sa
  // couleur et son blason propres pour un rendu fidèle.
  const oppStanding = (C.standings||[]).find(function(s){ return s.name===oppName && !s.isPlayer; });
  if(oppStanding){ if(oppStanding.color) aiColor=oppStanding.color; if(oppStanding.badge) aiBadge=oppStanding.badge; }

  teams[1] = {
    name:    oppName,
    color:   aiColor,
    img:     '',
    badge:   aiBadge,
    strat:   '321',
    players: aiSquad.players,
    bench:   aiSquad.bench,
    reserves: [],
  };

  // Appliquer les formations
  applyFormationRoles(0);
  applyFormationRoles(1);

  // Mémoriser le fix en cours pour enregistrer le résultat après match
  window._careerFixPlaying = fix;

  // Réinitialiser l'état moteur AVANT le pré-match, sinon un match précédent
  // laissé en phase 'END' bloque le lancement suivant (le bouton semble inerte).
  nav('match');
  resetMatch();
  // resetMatch() remet leagueMode=false : on (re)pose donc les flags APRÈS.
  G.leagueMode = true; // pour que endMatch sache qu'il faut enregistrer
  G._humanTeams = [true, false]; // le joueur dirige team0 ; l'IA coache team1
  try{ if(typeof resetManagerAi==='function') resetManagerAi(); }catch(e){}
  syncHUD(); renderTB(0); renderTB(1);
  // Lancer le pré-match normal
  showPreMatch(null);
}

function _recordCareerV2MatchResult(){
  if(!careerV2 || !window._careerFixPlaying) return;
  const fix  = window._careerFixPlaying;
  const s0   = G.scores[0]; // notre score (team 0)
  const s1   = G.scores[1]; // adversaire (team 1)
  const C    = careerV2;

  fix.played = true;
  fix.sh = fix.homeIsPlayer ? s0 : s1;
  fix.sa = fix.homeIsPlayer ? s1 : s0;

  const myG = fix.homeIsPlayer ? s0 : s1;
  const aiG = fix.homeIsPlayer ? s1 : s0;

  C.season_stats.goals_for     += myG;
  C.season_stats.goals_against += aiG;
  if(myG > aiG){ C.season_stats.wins++;   C.season_stats.points += 3; }
  else if(myG === aiG){ C.season_stats.draws++; C.season_stats.points++; }
  else { C.season_stats.losses++; }

  _updateCareerStandings(fix);

  const opp = fix.homeIsPlayer ? fix.awayName : fix.homeName;
  const res = myG > aiG ? '✅ Victoire' : myG === aiG ? '🟡 Nul' : '❌ Défaite';
  const col = myG > aiG ? '#18c860' : myG === aiG ? '#f0c028' : '#e06060';
  logEvent(res+' ! '+C.club.name+' '+myG+'-'+aiG+' '+opp, col);

  const rev = fix.homeIsPlayer ? Math.round(50 + C.club.fanbase * 0.05) : 10;
  C.club.budget += rev;
  _addFinanceLog('Recettes match vs '+opp, rev);

  window._careerFixPlaying = null;
  // Le match du jour est réglé : on peut désormais avancer au jour suivant.
  if(C._pendingMatch) C._pendingMatch = null;
  saveCareerV2();
}

// ── MATCH AMICAL (planifié librement par le dirigeant) ─────────────────────
// Construit l'équipe du joueur + l'adversaire choisi (à SON niveau), lance le
// match jouable, et n'affecte que le moral/la forme (jamais le classement).
function playCareerFriendlyMatch(){
  if(!careerV2) return;
  const C = careerV2;
  const pm = C._pendingMatch;
  const dk = (pm && pm.friendly) ? pm.dateKey : _dateKey(C.date);
  const plan = C.dayPlans && C.dayPlans[dk];
  if(!plan || plan.type!=='friendly' || !plan.oppName){ logEvent('Aucun amical prévu aujourd\'hui.','#e02030'); return; }

  const nation = C.nation || 'panthalassa';
  const region = C.club.region;
  const oppLevel = (typeof _friendlyOppEngineLevel==='function') ? _friendlyOppEngineLevel(plan) : (plan.oppLevel||'r2');

  const mode = window.gameMode || '7v7';
  const XI_POS = mode==='11v11' ? ['GB','DD','DC','DC','DG','MC','MC','MC','MC','ATT','ATT']
               : mode==='5v5'   ? ['GB','DC','MOG','MOD','ATT']
               :                  ['GB','DC','DD','DG','MC','MC','ATT'];
  const BENCH_POS = mode==='11v11' ? ['GB','DC','MC','MC','ATT','DD','DG']
                  : mode==='5v5'   ? ['GB','DC','MC','ATT','DC']
                  :                  ['GB','MC','ATT','DC','MC'];
  const xiSize = XI_POS.length, benchSize = BENCH_POS.length;

  // Équipe du joueur (mêmes règles que le championnat).
  const fullSquad = (C.players||[]).map(function(p){ return Object.assign({}, p); })
    .concat((C.bench||[]).map(function(p){ return Object.assign({}, p); }));
  const gkPool = fullSquad.filter(function(p){ return p && p.pos==='GB'; }).sort(function(a,b){ return _playerOvr(b)-_playerOvr(a); });
  const outfieldPool = fullSquad.filter(function(p){ return p && p.pos!=='GB'; }).sort(function(a,b){ return _playerOvr(b)-_playerOvr(a); });
  const starters = [];
  if(gkPool[0]) starters.push(gkPool[0]);
  outfieldPool.forEach(function(p){ if(starters.length < xiSize) starters.push(p); });
  const leftoverGk  = gkPool.slice(1);
  const leftoverOut = outfieldPool.filter(function(p){ return starters.indexOf(p) < 0; });
  const matchBench = [];
  if(leftoverGk[0]) matchBench.push(leftoverGk[0]);
  leftoverGk.slice(1).concat(leftoverOut).forEach(function(p){ if(matchBench.length < benchSize) matchBench.push(p); });
  const usedIds = starters.concat(matchBench);
  const surplus = fullSquad.filter(function(p){ return usedIds.indexOf(p) < 0; });
  starters.forEach(function(p){ if(p){ p.onBench=false; p.subbedOut=false; } });
  matchBench.forEach(function(p){ if(p){ p.onBench=true; p.subbedOut=false; } });
  try{ _applyStaffMatchdayBonus(C.club, starters, matchBench); }catch(e){}

  teams[0] = {
    name: C.club.name, color: C.club.color||'#e02030', img: C.club.img||'',
    strat: C.club.strat||'321',
    players: starters, bench: matchBench,
    reserves: surplus.concat((C.reserves||[]).map(function(p){ return Object.assign({}, p); })),
  };

  let aiSquad;
  try{
    aiSquad = WORLDS.generateSquad(nation, region, { positions: XI_POS, bench: BENCH_POS, reserves: [], level: oppLevel });
  }catch(e){
    console.error('friendly ai squad:', e);
    logEvent('⚠️ Impossible de générer l\'adversaire amical. Match simulé à la place.','#e0a020');
    simCareerFriendlyMatch(); return;
  }
  if(!aiSquad || !(aiSquad.players||[]).length){ simCareerFriendlyMatch(); return; }

  teams[1] = {
    name: plan.oppName, color: plan.oppColor||'#1878e8', img:'', badge: plan.oppBadge||null,
    strat:'321', players: aiSquad.players, bench: aiSquad.bench, reserves: [],
  };

  applyFormationRoles(0);
  applyFormationRoles(1);

  window._careerFriendlyPlaying = { dateKey: dk, oppName: plan.oppName };

  nav('match');
  resetMatch();
  G.leagueMode = true; // pour router endMatch() vers l'enregistrement carrière
  G._humanTeams = [true, false];
  try{ if(typeof resetManagerAi==='function') resetManagerAi(); }catch(e){}
  syncHUD(); renderTB(0); renderTB(1);
  showPreMatch(null);
}

// Simule un amical sans le jouer (résultat rapide, effets moral/forme).
function simCareerFriendlyMatch(){
  if(!careerV2) return;
  const C = careerV2;
  const pm = C._pendingMatch;
  const dk = (pm && pm.friendly) ? pm.dateKey : _dateKey(C.date);
  const plan = C.dayPlans && C.dayPlans[dk];
  if(!plan || plan.type!=='friendly'){ return; }
  // Force du joueur = OVR moyen de l'effectif ramené sur 0..1.
  const _sq = (C.players||[]).concat(C.bench||[]);
  const myStr = _sq.length
    ? Math.min(0.95, Math.max(0.2, (_sq.reduce(function(a,p){ return a+_playerOvr(p); },0)/_sq.length)/100))
    : 0.6;
  const oppLvl = (typeof _friendlyOppEngineLevel==='function') ? _friendlyOppEngineLevel(plan) : 'r2';
  const oppStr = ({d1:0.9,d2:0.8,d3:0.7,r1:0.6,r2:0.5,r3:0.4,dh:0.3})[oppLvl] || 0.5;
  const gf = Math.max(0, Math.round(myStr*3 + Math.random()*1.6 - 1));
  const ga = Math.max(0, Math.round(oppStr*3 + Math.random()*1.6 - 1));
  _applyFriendlyOutcome(gf, ga, plan.oppName);
  if(C.dayPlans) delete C.dayPlans[dk];
  if(C._pendingMatch) C._pendingMatch = null;
  saveCareerV2();
  renderCareerV2();
}

// Effets d'un amical (moral + forme + petites blessures), SANS toucher au
// classement ni aux finances de championnat.
function _applyFriendlyOutcome(gf, ga, oppName){
  const C = careerV2; if(!C) return;
  const win = gf>ga, draw = gf===ga;
  const _mDrop = (typeof STAFF!=='undefined') ? STAFF.moraleDropMul(C.club) : 1;
  const squad = (C.players||[]).concat(C.bench||[]).concat(C.reserves||[]);
  squad.forEach(function(p){
    if(!p) return;
    let dm = win?1.0:draw?0.3:-0.4;
    if(dm < 0) dm *= _mDrop; // préparateur mental : atténue les baisses de moral
    p._hm = Math.max(-10, Math.min(10, (p._hm||0) + dm));
    p._fm = Math.min(10, (p._fm||0) + 0.4); // un match entretient la forme
    if(Math.random()<0.008 && (p.injLevel||0)===0){ p.injLevel=1; p.injT=1+Math.floor(Math.random()*2); }
  });
  const res = win?'✅ victoire':draw?'🟡 nul':'❌ défaite';
  const col = win?'#18c860':draw?'#f0c028':'#e06060';
  careerLog('🤝 Amical : '+C.club.name+' '+gf+'-'+ga+' '+(oppName||'')+' — '+res+' (moral & forme ajustés).', col);
}

function _recordCareerV2FriendlyResult(){
  if(!careerV2 || !window._careerFriendlyPlaying) return;
  const ref = window._careerFriendlyPlaying;
  window._careerFriendlyPlaying = null;
  const C = careerV2;
  try{ _applyFriendlyOutcome(G.scores[0], G.scores[1], ref.oppName); }catch(e){ console.error('friendly record:', e); }
  if(C.dayPlans && ref.dateKey) delete C.dayPlans[ref.dateKey];
  if(C._pendingMatch) C._pendingMatch = null;
  saveCareerV2();
}
// Charge l'adversaire de coupe (potentiellement d'une AUTRE division que le
// club joueur) au bon niveau, lance le match interactif, et mémorise la paire
// du bracket à résoudre à la fin. Corrige deux bugs :
//   1) la coupe n'était jamais jouable (seul « Simuler » existait) ;
//   2) l'adversaire était généré au niveau du joueur → incohérences/plantages
//      silencieux quand il venait d'une autre division. On lit son vrai level.
function playCareerCupMatch(){
  if(!careerV2) return;
  const C = careerV2;
  const cup = C.cup;
  if(!cup || cup.winner || cup.playerOut){ logEvent('Aucun tour de coupe à jouer.','#e02030'); return; }
  const bracket = cup.bracket || [];
  // Trouver la confrontation du joueur, encore à jouer, dans le tour courant.
  const m = bracket.find(function(x){ return !x.played && ((x.a&&x.a.isPlayer)||(x.b&&x.b.isPlayer)); });
  if(!m){ logEvent('Aucun match de coupe en attente pour votre club.','#e02030'); return; }

  const me  = (m.a&&m.a.isPlayer) ? m.a : m.b;
  const opp = (m.a&&m.a.isPlayer) ? m.b : m.a;

  // Tour exempt (bye) : pas d'adversaire → on résout directement sans terrain.
  if(!opp){
    _resolveCareerCupPlayerPair(m, null, null);
    if(C._pendingMatch) C._pendingMatch = null;
    saveCareerV2();
    renderCareerV2();
    return;
  }

  const nation = C.nation || 'panthalassa';
  const region = C.club.region;
  // Niveau RÉEL de l'adversaire : celui stocké dans le bracket (sa division),
  // pas celui du club joueur. Fallback prudent sur le niveau du joueur.
  const oppLevel = opp.level || C.club.level || 'dh';

  const mode = window.gameMode || '7v7';
  const XI_POS = mode==='11v11' ? ['GB','DD','DC','DC','DG','MC','MC','MC','MC','ATT','ATT']
               : mode==='5v5'   ? ['GB','DC','MOG','MOD','ATT']
               :                  ['GB','DC','DD','DG','MC','MC','ATT'];
  const BENCH_POS = mode==='11v11' ? ['GB','DC','MC','MC','ATT','DD','DG']
                  : mode==='5v5'   ? ['GB','DC','MC','ATT','DC']
                  :                  ['GB','MC','ATT','DC','MC'];
  const xiSize = XI_POS.length, benchSize = BENCH_POS.length;

  // Équipe du joueur (mêmes règles que le championnat).
  const fullSquad = (C.players||[]).map(function(p){ return Object.assign({}, p); })
    .concat((C.bench||[]).map(function(p){ return Object.assign({}, p); }));
  const gkPool = fullSquad.filter(function(p){ return p && p.pos==='GB'; }).sort(function(a,b){ return _playerOvr(b)-_playerOvr(a); });
  const outfieldPool = fullSquad.filter(function(p){ return p && p.pos!=='GB'; }).sort(function(a,b){ return _playerOvr(b)-_playerOvr(a); });
  const starters = [];
  if(gkPool[0]) starters.push(gkPool[0]);
  outfieldPool.forEach(function(p){ if(starters.length < xiSize) starters.push(p); });
  const leftoverGk  = gkPool.slice(1);
  const leftoverOut = outfieldPool.filter(function(p){ return starters.indexOf(p) < 0; });
  const matchBench = [];
  if(leftoverGk[0]) matchBench.push(leftoverGk[0]);
  leftoverGk.slice(1).concat(leftoverOut).forEach(function(p){ if(matchBench.length < benchSize) matchBench.push(p); });
  const usedIds = starters.concat(matchBench);
  const surplus = fullSquad.filter(function(p){ return usedIds.indexOf(p) < 0; });
  starters.forEach(function(p){ if(p){ p.onBench=false; p.subbedOut=false; } });
  matchBench.forEach(function(p){ if(p){ p.onBench=true; p.subbedOut=false; } });
  try{ _applyStaffMatchdayBonus(C.club, starters, matchBench); }catch(e){}

  const isHome = !!(m.a && m.a.isPlayer); // convention : m.a joue à domicile
  teams[0] = {
    name: C.club.name, color: C.club.color || '#e02030', img: C.club.img || '',
    strat: C.club.strat || '321',
    players: starters, bench: matchBench,
    reserves: surplus.concat((C.reserves||[]).map(function(p){ return Object.assign({}, p); })),
  };

  // Adversaire généré à SON niveau de division (fix bug 2).
  let aiSquad;
  try{
    aiSquad = WORLDS.generateSquad(nation, region, {
      positions: XI_POS, bench: BENCH_POS, reserves: [], level: oppLevel,
    });
  }catch(e){
    console.error('cup ai squad:', e);
    logEvent('⚠️ Impossible de générer l\'adversaire de coupe. Match simulé à la place.','#e0a020');
    // Repli sûr : on simule ce tour plutôt que de planter silencieusement.
    try{ _advanceNationalCup(true); }catch(e2){ console.error('cup fallback:',e2); }
    if(C._pendingMatch) C._pendingMatch = null;
    saveCareerV2(); renderCareerV2();
    return;
  }
  if(!aiSquad || !(aiSquad.players||[]).length){
    logEvent('⚠️ Adversaire de coupe invalide. Match simulé à la place.','#e0a020');
    try{ _advanceNationalCup(true); }catch(e2){ console.error('cup fallback:',e2); }
    if(C._pendingMatch) C._pendingMatch = null;
    saveCareerV2(); renderCareerV2();
    return;
  }

  teams[1] = {
    name: opp.name, color: opp.color || '#1878e8', img: '', badge: opp.badge || null,
    strat: '321', players: aiSquad.players, bench: aiSquad.bench, reserves: [],
  };

  applyFormationRoles(0);
  applyFormationRoles(1);

  // Mémoriser la paire de coupe à résoudre après le match.
  window._careerCupPlaying = { match: m, isHome: isHome };

  // Réinitialiser l'état moteur AVANT le pré-match (sinon un match précédent en
  // phase 'END' bloque le lancement).
  nav('match');
  resetMatch();
  // resetMatch() remet leagueMode=false : on (re)pose donc les flags APRÈS.
  G.leagueMode = true; // route endMatch() vers _recordCareerV2CupMatchResult
  G._humanTeams = [true, false]; // le joueur dirige team0 ; l'IA coache team1
  try{ if(typeof resetManagerAi==='function') resetManagerAi(); }catch(e){}
  syncHUD(); renderTB(0); renderTB(1);
  showPreMatch(null);
}

// Résout la paire de coupe du joueur (scores myG/oppG déjà connus), applique
// primes/élimination puis fait avancer le reste du tour et le bracket.
function _resolveCareerCupPlayerPair(m, myG, oppG){
  const C = careerV2; const cup = C.cup; if(!cup) return;
  const roundIdx = cup.round;
  const me  = (m.a&&m.a.isPlayer) ? m.a : m.b;
  const opp = (m.a&&m.a.isPlayer) ? m.b : m.a;

  if(!opp){
    // Bye : qualification directe.
    m.played = true; m.winner = me;
    const prime = 4000 + roundIdx*3000;
    C.club.budget += prime;
    careerLog('🏆 '+cup.name+' ('+cup.roundNames[roundIdx]+') — exempt, qualification directe ! Prime '+fmtG(prime), '#18c860');
  } else {
    // Renseigner le score dans le bon sens (m.a = home).
    const aIsPlayer = !!(m.a && m.a.isPlayer);
    let ga = aIsPlayer ? myG : oppG;
    let gb = aIsPlayer ? oppG : myG;
    if(ga===gb){ // pas de nul en coupe : léger avantage au joueur pour la séance de tirs
      if(Math.random() < 0.5) { aIsPlayer?ga++:gb++; } else { aIsPlayer?gb++:ga++; }
    }
    m.ga = ga; m.gb = gb; m.played = true;
    m.winner = (ga>gb) ? m.a : m.b;
    const playerWon = m.winner && m.winner.isPlayer;
    if(playerWon){
      const prime = 4000 + roundIdx*3000;
      C.club.budget += prime;
      careerLog('🏆 '+cup.name+' ('+cup.roundNames[roundIdx]+') — VICTOIRE '+myG+'-'+oppG+' vs '+opp.name+' ! Prime '+fmtG(prime), '#18c860');
    } else {
      cup.playerOut = true;
      careerLog('🏆 '+cup.name+' ('+cup.roundNames[roundIdx]+') — élimination '+myG+'-'+oppG+' vs '+opp.name+'.', '#e06060');
    }
  }

  // Résoudre les AUTRES matchs du tour (simulés) puis avancer le bracket.
  const survivors = [];
  cup.bracket.forEach(function(x){
    if(x.played){ if(x.winner) survivors.push(x.winner); return; }
    const res = _cupSimMatch(x.a, x.b);
    if(res.winner){ x.winner=res.winner; x.ga=res.ga; x.gb=res.gb; x.played=true; survivors.push(res.winner); }
  });
  cup.round++;
  _finalizeCupRound(C, cup, survivors);
}

function _recordCareerV2CupMatchResult(){
  if(!careerV2 || !window._careerCupPlaying) return;
  const ref = window._careerCupPlaying;
  window._careerCupPlaying = null;
  const s0 = G.scores[0]; // joueur (team 0)
  const s1 = G.scores[1]; // adversaire (team 1)
  try{
    _resolveCareerCupPlayerPair(ref.match, s0, s1);
  }catch(e){ console.error('cup record:', e); }
  if(careerV2._pendingMatch) careerV2._pendingMatch = null;
  saveCareerV2();
}

function simCareerMatchDirector(){
  if(!careerV2) return;
  const C = careerV2;
  if(C._pendingMatch && C._pendingMatch.cup){
    try{ _advanceNationalCup(); }catch(e){ console.error('cup:',e); }
    C._pendingMatch = null;
    saveCareerV2();
    renderCareerV2();
    return;
  }
  const fix = C._pendingMatch && C._pendingMatch.fixtureId
    ? (C.fixtures||[]).find(function(f){ return f.id===C._pendingMatch.fixtureId; })
    : (C.fixtures||[]).find(function(f){ return !f.played; });
  if(!fix){ logEvent('Aucun match a simuler !','#e02030'); return; }

  const myPlayers = C.players || [];
  const myStr = myPlayers.reduce(function(s,p){
    return s + ((p.s&&p.s.sht||10)+(p.s&&p.s.spd||10)+(p.s&&p.s.tec||10))/3;
  }, 0) / Math.max(1, myPlayers.length);

  const aiStr = myStr * (0.7 + Math.random() * 0.6);
  const isHome = fix.homeIsPlayer;
  const myGoals = _poissonGoals((myStr/Math.max(1,aiStr)) * (isHome?1.1:0.9) * 0.8);
  const aiGoals = _poissonGoals((aiStr/Math.max(1,myStr)) * (isHome?0.9:1.1) * 0.8);

  fix.played = true;
  fix.sh = isHome ? myGoals : aiGoals;
  fix.sa = isHome ? aiGoals : myGoals;

  const myG = isHome ? fix.sh : fix.sa;
  const aiG = isHome ? fix.sa : fix.sh;
  C.season_stats.goals_for  += myG;
  C.season_stats.goals_against += aiG;
  if(myG > aiG){ C.season_stats.wins++;   C.season_stats.points += 3; }
  else if(myG === aiG){ C.season_stats.draws++; C.season_stats.points++; }
  else { C.season_stats.losses++; }

  _updateCareerStandings(fix);

  const opp = isHome ? fix.awayName : fix.homeName;
  const res = myG > aiG ? 'Victoire' : myG === aiG ? 'Nul' : 'Defaite';
  const col = myG > aiG ? '#18c860' : myG === aiG ? '#f0c028' : '#e06060';
  logEvent(res+' ! '+C.club.name+' '+myG+'-'+aiG+' '+opp, col);

  const rev = isHome ? Math.round(50 + C.club.fanbase * 0.1) : 20;
  C.club.budget += rev;
  _addFinanceLog('Recettes match vs '+opp, rev);

  if(C._pendingMatch) C._pendingMatch = null;
  saveCareerV2();
  renderCareerV2();
}

function _poissonGoals(lambda){
  lambda = Math.max(0.2, Math.min(4, lambda));
  var L = Math.exp(-lambda), k = 0, p = 1;
  do { k++; p *= Math.random(); } while(p > L);
  return k - 1;
}

function _updateCareerStandings(fix){
  if(!careerV2 || !careerV2.standings) return;
  function upd(id, gf, ga){
    var s = careerV2.standings.find(function(x){ return x.id === id; });
    if(!s) return;
    s.P++; s.GF += gf; s.GA += ga;
    if(gf > ga){ s.W++; s.Pts += 3; }
    else if(gf === ga){ s.D++; s.Pts++; }
    else s.L++;
  }
  upd(fix.home, fix.sh, fix.sa);
  upd(fix.away, fix.sa, fix.sh);
  // Les autres matchs PNJ de la journée (et tous ceux en retard) sont résolus
  // par la simulation de fond, basée sur la force réelle des équipes.
  try{
    if(typeof _simulateBackgroundNpcFixtures==='function'){
      const upTo = fix.date || careerV2.date;
      _simulateBackgroundNpcFixtures(upTo);
    }
  }catch(e){ console.error('npc bg sim:',e); }
}

// Compare deux niveaux de la pyramide : renvoie true si `a` est un échelon
// SUPÉRIEUR (meilleur) que `b`. Sert à détecter promotion vs relégation.
function _levelRankBetter(a, b){
  try{
    const C = careerV2;
    const pyramid = WORLDS.getPyramid((C&&C.nation)||'panthalassa') || [];
    const levels = pyramid.map(function(p){ return p.id; });
    const ia = levels.indexOf(a), ib = levels.indexOf(b);
    if(ia<0 || ib<0) return false;
    return ia < ib; // index plus petit = division plus haute
  }catch(e){ return false; }
}

// ── BARRAGE DE DISTRICT (Valoria) — match JOUABLE ───────────────────────────
// Construit l'équipe du joueur + l'adversaire réel de la poule (à SON niveau
// de division) et lance le match sur le terrain, exactement comme un tour de
// coupe. Le résultat est ensuite enregistré par _recordCareerV2PlayoffMatchResult.
function playCareerPlayoffMatch(){
  if(!careerV2) return;
  const C = careerV2;
  const po = C.playoffs;
  if(!po || !po.active || po.done){ logEvent('Aucun barrage à jouer.','#e02030'); return; }
  const m = po.matches[po.idx];
  if(!m || m.played){ logEvent('Aucun barrage en attente.','#e02030'); return; }

  const nation = C.nation || 'valoria';
  const region = C.club.region;
  const oppLevel = m.oppLevel || C.club.level || 'dh';

  const mode = window.gameMode || '7v7';
  const XI_POS = mode==='11v11' ? ['GB','DD','DC','DC','DG','MC','MC','MC','MC','ATT','ATT']
               : mode==='5v5'   ? ['GB','DC','MOG','MOD','ATT']
               :                  ['GB','DC','DD','DG','MC','MC','ATT'];
  const BENCH_POS = mode==='11v11' ? ['GB','DC','MC','MC','ATT','DD','DG']
                  : mode==='5v5'   ? ['GB','DC','MC','ATT','DC']
                  :                  ['GB','MC','ATT','DC','MC'];
  const xiSize = XI_POS.length, benchSize = BENCH_POS.length;

  const fullSquad = (C.players||[]).map(function(p){ return Object.assign({}, p); })
    .concat((C.bench||[]).map(function(p){ return Object.assign({}, p); }));
  const gkPool = fullSquad.filter(function(p){ return p && p.pos==='GB'; }).sort(function(a,b){ return _playerOvr(b)-_playerOvr(a); });
  const outfieldPool = fullSquad.filter(function(p){ return p && p.pos!=='GB'; }).sort(function(a,b){ return _playerOvr(b)-_playerOvr(a); });
  const starters = [];
  if(gkPool[0]) starters.push(gkPool[0]);
  outfieldPool.forEach(function(p){ if(starters.length < xiSize) starters.push(p); });
  const leftoverGk  = gkPool.slice(1);
  const leftoverOut = outfieldPool.filter(function(p){ return starters.indexOf(p) < 0; });
  const matchBench = [];
  if(leftoverGk[0]) matchBench.push(leftoverGk[0]);
  leftoverGk.slice(1).concat(leftoverOut).forEach(function(p){ if(matchBench.length < benchSize) matchBench.push(p); });
  const usedIds = starters.concat(matchBench);
  const surplus = fullSquad.filter(function(p){ return usedIds.indexOf(p) < 0; });
  starters.forEach(function(p){ if(p){ p.onBench=false; p.subbedOut=false; } });
  matchBench.forEach(function(p){ if(p){ p.onBench=true; p.subbedOut=false; } });
  try{ _applyStaffMatchdayBonus(C.club, starters, matchBench); }catch(e){}

  teams[0] = {
    name: C.club.name, color: C.club.color || '#e02030', img: C.club.img || '',
    strat: C.club.strat || '321',
    players: starters, bench: matchBench,
    reserves: surplus.concat((C.reserves||[]).map(function(p){ return Object.assign({}, p); })),
  };

  let aiSquad;
  try{
    aiSquad = WORLDS.generateSquad(nation, region, {
      positions: XI_POS, bench: BENCH_POS, reserves: [], level: oppLevel,
    });
  }catch(e){
    console.error('playoff ai squad:', e);
    logEvent('⚠️ Impossible de générer l\'adversaire du barrage. Match simulé à la place.','#e0a020');
    simCareerPlayoffMatch();
    return;
  }
  if(!aiSquad || !(aiSquad.players||[]).length){
    logEvent('⚠️ Adversaire du barrage invalide. Match simulé à la place.','#e0a020');
    simCareerPlayoffMatch();
    return;
  }

  teams[1] = {
    name: m.oppName, color: '#1878e8', img: '', badge: null,
    strat: '321', players: aiSquad.players, bench: aiSquad.bench, reserves: [],
  };

  applyFormationRoles(0);
  applyFormationRoles(1);

  window._careerPlayoffPlaying = { matchIndex: po.idx };

  nav('match');
  resetMatch();
  G.leagueMode = true; // route endMatch() vers _recordCareerV2PlayoffMatchResult
  G._humanTeams = [true, false];
  try{ if(typeof resetManagerAi==='function') resetManagerAi(); }catch(e){}
  syncHUD(); renderTB(0); renderTB(1);
  showPreMatch(null);
}

// Version rapide (bouton "⚡ Simuler") : résout le match du joueur par force
// + aléa au lieu de le jouer sur le terrain, puis enregistre le résultat par
// le même chemin que le match joué.
function simCareerPlayoffMatch(){
  if(!careerV2) return;
  const C = careerV2;
  const po = C.playoffs;
  if(!po || !po.active || po.done){ logEvent('Aucun barrage à simuler.','#e02030'); return; }
  const m = po.matches[po.idx];
  if(!m || m.played){ logEvent('Aucun barrage en attente.','#e02030'); return; }

  const myPlayers = C.players || [];
  const myStr = myPlayers.reduce(function(s,p){
    return s + ((p.s&&p.s.sht||10)+(p.s&&p.s.spd||10)+(p.s&&p.s.tec||10))/3;
  }, 0) / Math.max(1, myPlayers.length);
  const oppStr = m.oppStrength || myStr;
  const isHome = !!m.isHome;
  const myGoals = _poissonGoals((myStr/Math.max(1,oppStr)) * (isHome?1.1:0.9) * 0.8);
  const oppGoals = _poissonGoals((oppStr/Math.max(1,myStr)) * (isHome?0.9:1.1) * 0.8);

  _recordPlayoffLegResult(myGoals, oppGoals);
  saveCareerV2();
  renderCareerV2();
}

// Cœur commun : enregistre le score d'un match de barrage (joué ou simulé),
// avance au match suivant, et finalise la poule au bout des 3 matchs.
function _recordPlayoffLegResult(myG, oppG){
  const C = careerV2; if(!C || !C.playoffs) return;
  const po = C.playoffs;
  const m = po.matches[po.idx];
  if(!m) return;
  m.played = true; m.scoreMe = myG; m.scoreOpp = oppG;

  const res = myG > oppG ? '✅ Victoire' : myG === oppG ? '🟡 Nul' : '❌ Défaite';
  const col = myG > oppG ? '#18c860' : myG === oppG ? '#f0c028' : '#e06060';
  logEvent(res+' (barrage) ! '+C.club.name+' '+myG+'-'+oppG+' '+m.oppName, col);

  po.idx++;
  if(po.idx >= po.matches.length){
    try{ _valoriaFinalizeDistrictPlayoffs(C); }catch(e){ console.error('finalize playoffs:',e); }
    if(po.promoted){ logEvent('🎉 Barrages de district remportés ! ('+po.detail+')', C.club.color||'#f0c028'); }
    else { logEvent('⚔️ Barrages de district terminés : '+po.detail+'.', C.club.color||'#f0c028'); }
  }
  if(C._pendingMatch) C._pendingMatch = null;
}

// Appelé par endMatch() (visual.js) quand le match joué était un barrage.
function _recordCareerV2PlayoffMatchResult(){
  if(!careerV2 || !window._careerPlayoffPlaying) return;
  const s0 = G.scores[0]; // notre score (team 0 = toujours le joueur ici)
  const s1 = G.scores[1]; // adversaire
  _recordPlayoffLegResult(s0, s1);
  window._careerPlayoffPlaying = null;
  saveCareerV2();
}

function endCareerSeasonDirector(){
  if(!careerV2) return;
  const C = careerV2;
  // Des barrages de district sont en cours et pas encore terminés : il faut
  // d'abord les jouer jusqu'au bout avant de pouvoir clôturer la saison.
  if(C.playoffs && C.playoffs.active && !C.playoffs.done){
    logEvent('Terminez d\'abord les barrages de district avant de continuer.','#e0a020');
    renderCareerV2();
    return;
  }
  // Mémorise le niveau AVANT résolution (promo/relégation le modifient) pour
  // évaluer les objectifs des sponsors en fin de fonction.
  window._levelBeforeSeasonEnd = C.club && C.club.level;
  const sorted = (C.standings||[]).slice().sort(function(a,b){
    return b.Pts - a.Pts || (b.GF-b.GA)-(a.GF-a.GA);
  });
  const myPos = sorted.findIndex(function(s){ return s.isPlayer; }) + 1;
  const total = sorted.length;
  // ── RÈGLES VALORIA (promo/relégation détaillées) ───────────────────────
  // Si la carrière se déroule en Valoria et que le moteur de saisons dédié est
  // chargé, on applique les règles complètes (R3, play-offs district, équité
  // R1→Pro). Sinon on garde la logique générique (top 2 = montée).
  if((C.nation==='valoria') && typeof valoriaResolvePlayerSeason==='function' && C.club && C.club.level){
    try{
      const res = valoriaResolvePlayerSeason(C, myPos, total);
      if(res && res.needsPlayoffs){
        // Qualifié pour les barrages de district : on les génère (JOUABLES,
        // moteur de match, dates réelles) et on suspend la fin de saison
        // jusqu'à ce qu'ils soient joués — plus de tirage au sort.
        const lvl = valoriaNormalizeLevel(C.club.level, _valRegionName(C.club.region));
        try{ valoriaSetupDistrictPlayoffs(C, lvl, myPos); }catch(e2){ console.error('valoriaSetupDistrictPlayoffs:',e2); }
        window._levelBeforeSeasonEnd = null;
        logEvent('🏟️ Qualifié pour les barrages de district ! Ils se joueront dans les prochaines semaines.', C.club.color||'#f0c028');
        saveCareerV2();
        renderCareerV2();
        return;
      }
      if(res){
        if(res.newLevel && res.newLevel!==C.club.level){ C.club.level = res.newLevel; }
        if(res.message) logEvent(res.message, C.club.color||'#f0c028');
      }
    }catch(e){ console.error('valoriaResolvePlayerSeason:',e); }
  } else if((C.nation==='pilier') && typeof pilierResolveSeason==='function' && C.club && C.club.level){
    // Système à 3 blocs fermés du Pilier (+ barrages inter-blocs).
    try{
      const res = pilierResolveSeason(C.club, myPos, total);
      if(res){
        if(res.playoff){
          // Barrage d'accession : simulé (le joueur affronte 3× le dernier du
          // bloc supérieur). Version auto pour l'instant.
          let wins=0;
          for(let g=0; g<res.playoff.winsNeeded+2 && wins<res.playoff.winsNeeded; g++){
            // Chance de gagner un match de barrage (avantage au 1er de son bloc).
            if(Math.random() < 0.5) wins++;
          }
          const br = pilierResolveBarrage(res.playoff, wins);
          if(br.promoted && br.newLevel){ C.club.level = br.newLevel; C.club.pilierDivId = br.newDivId; }
          logEvent(br.message, C.club.color||'#f0c028');
        } else {
          if(res.newLevel && res.newLevel!==C.club.level){ C.club.level = res.newLevel; C.club.pilierDivId = res.newDivId; }
          if(res.message) logEvent(res.message, C.club.color||'#f0c028');
        }
      }
    }catch(e){ console.error('pilierResolveSeason:',e); }
  } else if(myPos <= 2){
    const pyramid = WORLDS.getPyramid(C.nation||'panthalassa');
    const levels = pyramid.map(function(p){ return p.id; });
    const idx = levels.indexOf(C.club.level);
    if(idx > 0){
      C.club.level = levels[idx-1];
      logEvent('🎉 PROMOTION ! Vous montez en '+pyramid[idx-1].name+' !','#f0c028');
    }
  } else if(myPos >= total-1){
    logEvent('Saison difficile — attention la prochaine fois.','#e06060');
  }

  // ── Primes d'objectif des sponsors ─────────────────────────────────────
  // On évalue chaque contrat sponsor porteur d'un objectif sportif et on verse
  // la prime si l'objectif est atteint. `_levelBeforeSeasonEnd` est capturé au
  // début de la résolution ci-dessus (promotion/relégation modifient le level).
  if(typeof SPONSORS!=='undefined' && C.club && C.club.sponsors){
    try{
      const before = window._levelBeforeSeasonEnd;
      const promoted = before && C.club.level!==before && _levelRankBetter(C.club.level, before);
      const relegated = before && C.club.level!==before && !_levelRankBetter(C.club.level, before);
      const wins = (C.season_stats && C.season_stats.wins) || 0;
      const stats = { relegated:relegated, promoted:promoted, rank:myPos, wins:wins };
      SPONSORS.active(C.club).forEach(function(c){
        if(c.objective && SPONSORS.objectiveMet(c.objective.id, stats)){
          C.club.budget += c.objective.bonus;
          try{ _addFinanceLog('Prime objectif sponsor : '+c.name, c.objective.bonus); }catch(e){}
          logEvent('🎯 Objectif sponsor atteint ('+c.name+') — prime '+_fmtMoney(c.objective.bonus)+' !','#18c860');
        }
      });
    }catch(e){ console.error('sponsor objectives:', e); }
  }
  window._levelBeforeSeasonEnd = null;

  C.season++; C.week = 1;
  C.date = {year:(C.date&&C.date.year||1)+1, month:8, day:1};
  C.seasonStartDate = null; // ré-ancrée par _generateSeasonFixtures() ci-dessous
  C.dayPlans = {}; // planning de la saison écoulée purgé
  C.season_stats = {wins:0, draws:0, losses:0, goals_for:0, goals_against:0, points:0};
  logEvent('Saison '+C.season+' — Nouveau depart !', C.club.color||'#18c860');
  // IA de gestion : les clubs adverses vieillissent, progressent/déclinent et
  // font quelques mouvements de mercato avant que la nouvelle saison démarre.
  try{ _evolveOpponentSquads(); }catch(e){ console.error('evolve opponents:',e); }
  _generateSeasonFixtures();
  _generateFreeAgents();
  _generateYouthIntake();
  C.club.weekly_costs = _weeklyCareerCosts();
  saveCareerV2();
  renderCareerV2();
}

function abandonCareerV2(){
  if(!confirm('Abandonner cette carrière ? Cette action est irréversible.')) return;
  careerV2 = null;
  localStorage.removeItem('footsim_careerV2');
  renderCareerV2Choice();
}

// ── Helpers ───────────────────────────────────────────────────────────
function _fmtMoney(n){
  if(n === undefined || n === null) return '0';
  const abs = Math.abs(n);
  if(abs >= 1000000) return (n/1000000).toFixed(1)+'M';
  if(abs >= 1000) return (n/1000).toFixed(0)+'k';
  return String(Math.round(n));
}

function _reputationLabel(rep){
  if(rep >= 80) return 'Légendaire';
  if(rep >= 65) return 'Réputé';
  if(rep >= 50) return 'Connu';
  if(rep >= 35) return 'Modeste';
  if(rep >= 20) return 'Inconnu';
  return 'Amateur';
}

// ═══════════════════════════════════════════════════════════
// EXPORT / IMPORT
// ═══════════════════════════════════════════════════════════