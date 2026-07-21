// ============================================================
// UI_EDITOR.JS — extrait de ui.js (scope global partagé)
// Lignes 2447–3255 de l'ui.js d'origine.
// ============================================================

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