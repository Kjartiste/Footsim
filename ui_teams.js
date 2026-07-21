// ============================================================
// UI_TEAMS.JS — extrait de ui.js (scope global partagé)
// Lignes 3256–3869 de l'ui.js d'origine.
// ============================================================

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
      body += bigBtn(c, n+' équipe'+(n>1?'s':''), `teamSelPick('country','${c.replace(/'/g,"\'")}')`);
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
      body += bigBtn('Région de '+r, n+' équipe'+(n>1?'s':''), `teamSelPick('region','${r.replace(/'/g,"\'")}')`);
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
      cards += teamCard(t, subLbl, `teamSelLoadValoria('${(t.name||'').replace(/'/g,"\'")}')`);
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
    .concat(leagues.map(l=>chip(_presetPick.league===l,l,`setPresetFilter('league','${l.replace(/'/g,"\'")}')`))).join('');

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