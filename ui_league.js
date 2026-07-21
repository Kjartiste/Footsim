// ============================================================
// UI_LEAGUE.JS — extrait de ui.js (scope global partagé)
// Lignes 3870–9510 de l'ui.js d'origine.
// ============================================================

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
        <div class="frow"><span class="lbl">Couleur</span><input type="color" class="inp" value="${_cssColorToHex(T.color)}" id="ledit-color"></div>
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
            <input type="color" value="${_cssColorToHex(T.color)}" style="width:30px;height:26px;border:none;background:none;cursor:pointer;border-radius:4px" oninput="cteColorLive(${refJS},this.value)">
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
          <input type="color" value="${_cssColorToHex(npc.color)}" style="width:30px;height:26px;border:none;background:none;cursor:pointer;border-radius:4px" oninput="npcColorLive(${i},this.value)">
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
  // Licencié par le board : écran de fin, plus rien d'autre n'est jouable.
  if(careerV2.sacked && typeof _renderSackedScreen==='function'){ _renderSackedScreen(el); return; }
  // Générer les données manquantes (carrière ancienne ou migration)
  if(careerV2.type === 'director'){
    let needSave = false;
    // Migration : `_potential` n'existait que sur les jeunes du centre. Sans
    // plafond, l'entraînement montait n'importe qui à 99. On backfille les
    // carrières existantes (idempotent : ne touche jamais un potentiel posé).
    try{
      if(typeof _backfillPotentials==='function' && _backfillPotentials() > 0) needSave = true;
    }catch(e){ console.error('backfill potentials:',e); }
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
  // Présenter les éventuels événements de carrière en attente (pépite,
  // proposition douteuse…) une fois l'écran rendu.
  try{ if(typeof _processPendingEvents==='function') _processPendingEvents(); }catch(e){ console.error('pending events:', e); }
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

  let tabs = ['overview','squad','mercato','academy','finances','sponsors','infra','staff','calendar','competitions','futsal','scorers','social'];
  // Onglet Réserves : seulement si le club a des équipes affiliées.
  if(C.affiliates && C.affiliates.length) tabs.push('affiliates');
  // Onglet Historique : seulement une fois qu'au moins une saison est archivée.
  if(C.history && C.history.length) tabs.push('history');
  // Un MANAGER (entraîneur) n'a pas accès aux leviers de club (infra, sponsors,
  // finances d'investissement) : on filtre selon le rôle de carrière.
  if(typeof _tabAllowed === 'function') tabs = tabs.filter(function(t){ return _tabAllowed(t); });
  const tabLabels = {
    overview:'🏠 Vue', squad:'👥 Effectif', mercato:'🔄 Mercato', academy:'🌱 Académie',
    finances:'💰 Finances', sponsors:'🤝 Sponsors', infra:'🏗 Infra', staff:'👔 Staff', calendar:'📅 Calendrier',
    affiliates:'🏛 Réserves', history:'📜 Historique', scorers:'⚽ Buteurs', competitions:'🏆 Compétitions', social:'💬 Z', futsal:'⚽ Futsal'
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
  html += '<div style="font-size:22px;font-weight:900;color:var(--fg);letter-spacing:.5px">'+club.name+(typeof _teamScopeLabel==='function'?_teamScopeLabel():'')+'</div>';
  html += '<div style="font-size:11px;color:var(--muted);margin-top:2px">';
  // Rôle : Entraîneur (manager) ou Dirigeant (contrôle total).
  const _roleLbl = (typeof _isManager==='function' && _isManager()) ? '👔 Entraîneur' : '🧑\u200d💼 Dirigeant';
  html += _roleLbl + ' · ' + (region?region.name:'?')+' · '+(club.divisionName || (pyramid?pyramid.name:club.level))+' · Saison '+C.season;
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
  // Un manager ne peut pas ouvrir un onglet réservé aux dirigeants (infra,
  // sponsors, finances) — on le renvoie vers la Vue.
  if(typeof _tabAllowed === 'function' && !_tabAllowed(tab)) tab = 'overview';
  document.querySelectorAll('[id^="cdtab-"]').forEach(function(b){b.classList.remove('btng');});
  const activeBtn = document.getElementById('cdtab-'+tab);
  if(activeBtn) activeBtn.classList.add('btng');
  if(tab==='overview') el.innerHTML = _renderDirectorOverview();
  else if(tab==='squad') el.innerHTML = _renderDirectorSquad();
  else if(tab==='mercato') el.innerHTML = _renderDirectorMercato();
  else if(tab==='academy') el.innerHTML = _renderDirectorAcademy();
  else if(tab==='finances') el.innerHTML = _renderDirectorFinances();
  else if(tab==='sponsors') el.innerHTML = _renderDirectorSponsors();
  else if(tab==='infra') el.innerHTML = _renderDirectorInfra();
  else if(tab==='staff') el.innerHTML = _renderDirectorStaff();
  else if(tab==='calendar') el.innerHTML = _renderDirectorCalendar();
  else if(tab==='scorers') el.innerHTML = _renderDirectorScorers();
  else if(tab==='competitions') el.innerHTML = _renderDirectorCompetitions();
  else if(tab==='social') el.innerHTML = _renderDirectorSocial();
  else if(tab==='futsal') el.innerHTML = _renderDirectorFutsal();
  else if(tab==='affiliates') el.innerHTML = _renderDirectorAffiliates();
  else if(tab==='history') el.innerHTML = _renderDirectorHistory();
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

function _renderDirectorHistory(){
  const C = careerV2;
  const hist = C.history || [];
  let h = '<div style="padding:14px">';
  h += '<div style="font-size:15px;font-weight:900;color:var(--gold);margin-bottom:4px">📜 Historique de carrière</div>';
  h += '<div style="font-size:10px;color:var(--muted);margin-bottom:14px">Le résumé de chaque saison jouée, de la plus récente à la plus ancienne.</div>';
  if(!hist.length){
    h += '<div style="font-size:11px;color:var(--muted);text-align:center;padding:24px">Aucune saison archivée pour le moment — terminez votre première saison !</div>';
    h += '</div>'; return h;
  }

  // ── Palmarès rapide : titres, montées, buteurs-maison ──────────────────
  const promos = hist.filter(function(e){ return e.levelEnd!==e.levelStart && e.pos<=2; }).length;
  const titles = hist.filter(function(e){ return e.pos===1; }).length;
  const cupsWon = hist.filter(function(e){ return e.cup && e.cup.indexOf('Vainqueur')>=0; }).length;
  h += '<div style="display:flex;gap:16px;margin-bottom:14px;flex-wrap:wrap">';
  [
    {label:'Saisons jouées', val:hist.length, col:'var(--fg)'},
    {label:'Titres (1er)', val:titles, col:'#f0c028'},
    {label:'Montées', val:promos, col:'#18c860'},
    {label:'Coupes remportées', val:cupsWon, col:'#f0c028'},
  ].forEach(function(s){
    h += '<div style="text-align:center">';
    h += '<div style="font-size:18px;font-weight:900;color:'+s.col+'">'+s.val+'</div>';
    h += '<div style="font-size:9px;color:var(--muted)">'+s.label+'</div>';
    h += '</div>';
  });
  h += '</div>';

  hist.forEach(function(e){
    const changed = e.levelEnd!==e.levelStart;
    const promoted = changed && typeof _levelRankBetter==='function' && _levelRankBetter(e.levelEnd, e.levelStart);
    const arrowCol = !changed ? 'var(--muted)' : (promoted ? '#18c860' : '#e06060');
    const gd = e.gf - e.ga;
    h += '<div style="background:var(--panel);border:1px solid var(--b1);border-radius:12px;padding:12px;margin-bottom:10px">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
    h += '<div style="font-size:13px;font-weight:900;color:var(--gold)">Saison '+e.season+'</div>';
    h += '<div style="font-size:11px;font-weight:800;color:'+(e.pos<=2?'#18c860':e.pos>=e.total-1?'#e06060':'var(--muted)')+'">'+e.pos+'ᵉ / '+e.total+'</div>';
    h += '</div>';
    h += '<div style="font-size:10px;color:'+arrowCol+';margin-bottom:8px">'+e.divisionStart+(changed?(' → '+e.divisionEnd):'')+'</div>';
    h += '<div style="display:flex;gap:14px;margin-bottom:8px;flex-wrap:wrap">';
    h += '<div style="font-size:10px;color:var(--muted)">'+e.wins+'V '+e.draws+'N '+e.losses+'D</div>';
    h += '<div style="font-size:10px;color:var(--muted)">⚽ '+e.gf+'-'+e.ga+' ('+(gd>=0?'+':'')+gd+')</div>';
    h += '<div style="font-size:10px;color:var(--muted)">🏆 '+e.pts+' pts</div>';
    h += '</div>';
    if(e.topScorer) h += '<div style="font-size:10px;color:var(--fg);margin-bottom:4px">⚽ Meilleur buteur : <b>'+e.topScorer.name+'</b> ('+e.topScorer.goals+' buts)</div>';
    if(e.cup) h += '<div style="font-size:10px;color:var(--fg);margin-bottom:4px">'+e.cup+'</div>';
    if(e.outcome) h += '<div style="font-size:10px;color:var(--muted);margin-top:4px;padding-top:6px;border-top:1px solid var(--b1)">'+e.outcome+'</div>';
    h += '</div>';
  });

  h += '</div>';
  return h;
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

  // ── Offre d'un autre club (prioritaire : décision à prendre) ─────────
  try{ if(typeof _renderInterviewCard==='function') h += _renderInterviewCard(); }catch(e){ console.error('interview card:',e); }
  try{ if(typeof _renderSeasonEventCard==='function') h += _renderSeasonEventCard(); }catch(e){ console.error('event card:',e); }
  try{ if(typeof _renderRivalCard==='function') h += _renderRivalCard(); }catch(e){ console.error('rival card:',e); }
  try{ if(typeof _renderPressCard==='function') h += _renderPressCard(); }catch(e){ console.error('press card:',e); }
  // Le fil social complet vit désormais dans l'onglet « Z ». On garde en Vue
  // un aperçu compact cliquable plutôt que la liste entière.
  try{ if(typeof _renderSocialTeaser==='function') h += _renderSocialTeaser(); }catch(e){ console.error('social teaser:',e); }
  try{ if(typeof _renderJobOfferCard==='function') h += _renderJobOfferCard(); }catch(e){ console.error('job offer card:',e); }
  try{ if(typeof _renderManagerCard==='function') h += _renderManagerCard(); }catch(e){ console.error('manager card:',e); }
  try{ if(typeof _renderBoardRequestsCard==='function') h += _renderBoardRequestsCard(); }catch(e){ console.error('board requests:',e); }
  // ── Pépite en attente à l'académie (visibilité — facile à manquer) ──
  try{
    const _gem = (C.youthPool||[]).find(function(p){ return p && p._isPotentialPro; });
    if(_gem){
      h += '<div style="background:rgba(156,39,176,.12);border:1px solid #9c27b0;border-radius:10px;padding:10px 12px;margin-bottom:10px;display:flex;align-items:center;gap:10px;cursor:pointer" onclick="renderCareerDirectorTab(\'academy\')">';
      h += '<div style="font-size:20px">💎</div>';
      h += '<div style="flex:1"><div style="font-size:11px;font-weight:900;color:#c99cf0">Pépite à l\'académie !</div>';
      h += '<div style="font-size:9px;color:var(--muted)">' + _gem.name + ' (' + _gem.pos + ') a un potentiel professionnel — à promouvoir ou vendre dans l\'onglet 🌱 Académie.</div></div>';
      h += '</div>';
    }
  }catch(e){}
  // ── Bilan d'intersaison (retraites, progressions, jeunes) ────────────
  try{ if(typeof _renderSquadReportCard==='function') h += _renderSquadReportCard(); }catch(e){ console.error('squad report:',e); }
  // ── Confiance du board ───────────────────────────────────────────────
  try{ if(typeof _renderBoardCard==='function') h += _renderBoardCard(); }catch(e){ console.error('board card:',e); }

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
    } else if(C._pendingMatch.barrage){
      const br = C.barrage;
      const bg = br && Array.isArray(br.games) ? br.games[br.idx] : null;
      const opp = br ? br.oppName : '(adversaire)';
      h += '<div style="background:linear-gradient(135deg,#d4af3722,var(--panel));border:2px solid #d4af37;border-radius:10px;padding:14px;margin-bottom:12px">';
      h += '<div style="font-size:12px;font-weight:900;color:#d4af37;margin-bottom:6px">⚔️ Barrage d\'accession — manche '+(br?br.idx+1:1)+' (score '+(br?br.wins:0)+'-'+(br?br.losses:0)+')</div>';
      h += '<div style="font-size:14px;font-weight:700;color:var(--fg);margin-bottom:6px">'+(bg&&bg.isHome?club.name+' <span style="color:var(--muted)">vs</span> '+opp:opp+' <span style="color:var(--muted)">vs</span> '+club.name)+'</div>';
      h += '<div style="font-size:10px;color:var(--muted);margin-bottom:10px">Le premier à '+(br?br.winsNeeded:3)+' victoires monte en '+(br?br.targetDivName:'?')+'.</div>';
      h += '<div style="display:flex;gap:8px">';
      h += '<button class="btn btng" onclick="playCareerBarrageMatch()" style="flex:1;font-size:12px;padding:10px;font-weight:900">▶ Jouer le match</button>';
      h += '<button class="btn" onclick="simCareerBarrageMatch()" style="flex:1;font-size:12px;padding:10px;font-weight:900">⚡ Simuler</button>';
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
        // ── PRÉPARATION : choix de l'approche tactique ─────────────────────
        // Avant, le joueur cliquait « Jouer » et sa stratégie était figée à
        // 3-2-1 (équilibré). Il choisit désormais une approche, qui pose une
        // vraie formation (STRATS) avec un effet réel sur le match. On stocke
        // le choix dans C.club.strat, lu par playCareerMatchV2 (team 0).
        h += _renderMatchTacticPicker(club);
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
  } else if(C.barrage && C.barrage.active && !C.barrage.done){
    const br = C.barrage;
    const ng = br.games[br.idx];
    h += '<div style="font-size:13px;color:var(--muted);margin-bottom:6px">⚔️ Barrage d\'accession en cours vs '+br.oppName+' — score '+br.wins+'-'+br.losses+'.</div>';
    if(ng) h += '<div style="font-size:11px;color:var(--muted);margin-bottom:10px">Prochaine manche : '+_fmtDateFrLong(ng.date)+'</div>';
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
    h += '<div style="display:grid;grid-template-columns:22px 1fr 22px 22px 22px 22px 34px 30px;gap:0;font-size:9px;color:var(--muted);padding:0 4px 6px;border-bottom:1px solid var(--b1);font-weight:700">';
    h += '<div>#</div><div>Club</div><div style="text-align:center">J</div><div style="text-align:center;color:#18c860">V</div><div style="text-align:center;color:#f0c028">N</div><div style="text-align:center;color:#e06060">D</div><div style="text-align:center" title="Buts pour / contre">BP:BC</div><div style="text-align:center">Pts</div>';
    h += '</div>';
    standings.forEach(function(s, i){
      const isMe = s.isPlayer;
      const gd = s.GF-s.GA;
      const gdCol = gd>0?'#18c860':gd<0?'#e06060':'var(--muted)';
      const posEmoji = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
      const total = standings.length;
      // Zones : montée directe (1-2), barrages (3-6), relégation (2 derniers).
      let zoneBar = 'transparent';
      if(i < 2) zoneBar = '#18c860';                       // montée directe (vert)
      else if(i >= 2 && i < 6) zoneBar = '#f0c028';        // barrages (or)
      else if(i >= total-2) zoneBar = '#e06060';           // relégation (rouge)
      // Zébrure : fond alterné léger, sauf pour ta ligne (surlignée en accent).
      const zebra = (i % 2 === 1) ? 'background:rgba(255,255,255,0.022);' : '';
      const rowBg = isMe ? 'background:'+accentCol+'22;' : zebra;
      h += '<div style="display:grid;grid-template-columns:22px 1fr 22px 22px 22px 22px 34px 30px;gap:0;align-items:center;padding:7px 4px 7px 7px;border-bottom:1px solid var(--b1)10;border-left:3px solid '+zoneBar+';border-radius:'+(isMe?'6px':'0')+';'+rowBg+'">';
      h += '<div style="font-size:11px;color:var(--muted)">'+(posEmoji||(i+1))+'</div>';
      const cBadge = (s.badge && typeof BadgeCache!=='undefined')
        ? '<span style="width:16px;height:16px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center"><img src="'+BadgeCache.dataURI(s.badge,16)+'" width="16" height="16" style="object-fit:contain"></span>'
        : _clubCrest(s.name, s.color, 16);
      h += '<div style="display:flex;align-items:center;gap:6px;min-width:0">'+cBadge+'<span style="font-size:11px;font-weight:'+(isMe?'900':'600')+';color:'+(isMe?accentCol:'var(--fg)')+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+s.name+'</span></div>';
      h += '<div style="font-size:10px;text-align:center;color:var(--muted)">'+s.P+'</div>';
      h += '<div style="font-size:10px;text-align:center;color:#18c860">'+(s.W||0)+'</div>';
      h += '<div style="font-size:10px;text-align:center;color:#f0c028">'+(s.D||0)+'</div>';
      h += '<div style="font-size:10px;text-align:center;color:#e06060">'+(s.L||0)+'</div>';
      h += '<div style="font-size:9px;text-align:center;color:'+gdCol+'">'+(s.GF||0)+':'+(s.GA||0)+'</div>';
      h += '<div style="font-size:13px;font-weight:900;text-align:center;color:'+(isMe?accentCol:'var(--fg)')+'">'+s.Pts+'</div>';
      h += '</div>';
    });
    // Légende des zones.
    h += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;font-size:8px;color:var(--muted)">';
    h += '<span><span style="display:inline-block;width:8px;height:8px;background:#18c860;border-radius:2px;vertical-align:middle;margin-right:3px"></span>Montée</span>';
    h += '<span><span style="display:inline-block;width:8px;height:8px;background:#f0c028;border-radius:2px;vertical-align:middle;margin-right:3px"></span>Barrages</span>';
    h += '<span><span style="display:inline-block;width:8px;height:8px;background:#e06060;border-radius:2px;vertical-align:middle;margin-right:3px"></span>Relégation</span>';
    h += '</div>';
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
  const teams = [{ key:'main', label:'Équipe première', players:C.players||[], bench:C.bench||[], reserves:C.reserves||[] }];
  (C.affiliates||[]).forEach(function(aff,i){
    teams.push({ key:'aff'+i, label:(aff.role==='U23 / académie'?'U23 · ':'Réserve · ')+aff.name, players:aff.players||[], bench:aff.bench||[], reserves:aff.reserves||[], color:aff.color });
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
  if(cur.reserves && cur.reserves.length){
    h += '<div style="font-size:9px;font-weight:700;color:var(--purple);padding:8px 8px 4px">📥 Réserve</div>';
    rows(cur.reserves, 'reserve');
  }
  // Équipe futsal 5v5 (seulement pour l'équipe première).
  if(cur.key==='main' && (careerV2.futsalSquad||[]).length){
    h += '<div style="font-size:9px;font-weight:700;color:#1878e8;padding:8px 8px 4px">⚽ Futsal 5v5</div>';
    rows(careerV2.futsalSquad, 'futsal');
  }
  h += '</div>';
  h += '<div style="padding:7px 12px;font-size:8px;color:var(--muted);border-top:1px solid var(--b1)">Clique sur une joueuse pour ses stats et pour la déplacer (effectif · banc · réserve) · 🌟 pépite</div>';

  // ── INFIRMERIE / ABSENCES ──────────────────────────────────────────────
  // Récap clair des indisponibles (blessés + suspendus) avec leur durée, plutôt
  // que de devoir repérer les badges joueur par joueur.
  try{
    const all = (C.players||[]).concat(C.bench||[], C.reserves||[]);
    const absents = all.filter(function(p){ return p && ((p._injWeeks||0)>0 || (p._suspMatches||0)>0); });
    if(absents.length){
      h += '<div class="ccard ccard-red" style="margin-top:10px">';
      h += '<div class="ccard-title">🏥 Infirmerie & suspensions <span style="font-size:9px;color:var(--muted);font-weight:400">'+absents.length+'</span></div>';
      absents.sort(function(a,b){ return ((b._injWeeks||0)+(b._suspMatches||0)) - ((a._injWeeks||0)+(a._suspMatches||0)); });
      absents.forEach(function(p){
        let reason='', dur='', icon='';
        if((p._injWeeks||0)>0){
          const lvl = p._injLevelCareer||p.injLevel||1;
          icon = ['','🤕','🚑','🆘'][lvl] || '🤕';
          reason = {1:'Blessure légère',2:'Blessure sérieuse',3:'Blessure grave'}[lvl] || 'Blessure';
          dur = p._injWeeks+' sem.';
        } else {
          icon = '🟥';
          reason = 'Suspension';
          dur = p._suspMatches+' match'+(p._suspMatches>1?'s':'');
        }
        h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 4px;border-bottom:1px solid var(--b1);font-size:10px">';
        h += '<div style="display:flex;align-items:center;gap:6px;min-width:0"><span>'+icon+'</span><span style="font-weight:700;color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+p.name+'</span><span style="color:var(--muted);font-size:9px">'+(p.pos||'')+'</span></div>';
        h += '<div style="text-align:right;flex-shrink:0"><div style="color:'+((p._injWeeks||0)>0?'#e06060':'#f0c028')+';font-weight:700">'+dur+'</div><div style="font-size:8px;color:var(--muted)">'+reason+'</div></div>';
        h += '</div>';
      });
      h += '</div>';
    }
  }catch(e){ console.error('infirmerie:', e); }
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
  if(teamKey==='main') list=[...(C.players||[]),...(C.bench||[]),...(C.reserves||[]),...(C.futsalSquad||[])];
  else { const aff=(C.affiliates||[])[parseInt(teamKey.replace('aff',''),10)]; if(aff) list=[...(aff.players||[]),...(aff.bench||[]),...(aff.reserves||[])]; }
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
  // Focus d'entraînement individuel (board.js) : oriente la progression de ce
  // joueur en particulier, en complément du style de coach (global à l'équipe).
  try{ if(typeof _renderFocusSelector==='function') h+=_renderFocusSelector(p); }catch(e){ console.error('focus selector:',e); }
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
    const inReserve = (arr.reserves||[]).some(x=>_sameP(x,p));
    const inFutsal = teamKey==='main' && (careerV2.futsalSquad||[]).some(x=>_sameP(x,p));
    const pidEsc = pid.replace(/'/g,"");
    h+='<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">';
    if(inFutsal){
      // Dans l'équipe futsal : le rappeler vers l'effectif principal.
      h+='<button onclick="_squadFromFutsal(\''+pidEsc+'\')" style="flex:1;padding:8px;border:none;border-radius:8px;background:#18c860;color:#fff;font-size:11px;font-weight:800;cursor:pointer">⚽ Rappeler du futsal</button>';
    } else if(inReserve){
      // En réserve : le rappeler.
      h+='<button onclick="_squadFromReserve(\''+teamKey+'\',\''+pidEsc+'\')" style="flex:1;padding:8px;border:none;border-radius:8px;background:#18c860;color:#fff;font-size:11px;font-weight:800;cursor:pointer">📤 Rappeler de la réserve</button>';
    } else {
      if(inBench){
        h+='<button onclick="_squadPromote(\''+teamKey+'\',\''+pidEsc+'\')" style="flex:1;padding:8px;border:none;border-radius:8px;background:#18c860;color:#fff;font-size:11px;font-weight:800;cursor:pointer">⬆️ Intégrer à l\'effectif</button>';
      } else if(inStart){
        h+='<button onclick="_squadDemote(\''+teamKey+'\',\''+pidEsc+'\')" style="flex:1;padding:8px;border:1px solid var(--b2);border-radius:8px;background:transparent;color:var(--muted);font-size:11px;font-weight:800;cursor:pointer">⬇️ Mettre sur le banc</button>';
      }
      // Depuis titulaire ou banc, on peut aussi envoyer en réserve.
      h+='<button onclick="_squadToReserve(\''+teamKey+'\',\''+pidEsc+'\')" style="flex:1;padding:8px;border:1px solid var(--purple);border-radius:8px;background:transparent;color:var(--purple);font-size:11px;font-weight:800;cursor:pointer">📥 Mettre en réserve</button>';
      // Équipe futsal 5v5 du club (uniquement pour l'équipe première).
      if(teamKey==='main'){
        h+='<button onclick="_squadToFutsal(\''+pidEsc+'\')" style="flex:1;padding:8px;border:1px solid #1878e8;border-radius:8px;background:transparent;color:#1878e8;font-size:11px;font-weight:800;cursor:pointer">⚽ Envoyer au futsal 5v5</button>';
      }
    }
    // Libérer le joueur (le sortir définitivement du club) — toujours possible.
    h+='<button onclick="_squadRelease(\''+teamKey+'\',\''+pidEsc+'\')" style="flex:1;padding:8px;border:1px solid #e02030;border-radius:8px;background:transparent;color:#e06060;font-size:11px;font-weight:800;cursor:pointer">🚪 Libérer</button>';
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
  if(teamKey==='main') return { players:(C.players||(C.players=[])), bench:(C.bench||(C.bench=[])), reserves:(C.reserves||(C.reserves=[])) };
  const aff=(C.affiliates||[])[parseInt(String(teamKey).replace('aff',''),10)];
  if(!aff) return null;
  return { players:(aff.players||(aff.players=[])), bench:(aff.bench||(aff.bench=[])), reserves:(aff.reserves||(aff.reserves=[])) };
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

// Envoie un joueur (titulaire ou banc) vers la RÉSERVE.
function _squadToReserve(teamKey, pid){
  const arr=_squadArraysFor(teamKey); if(!arr) return;
  if(!arr.reserves) arr.reserves=[];
  // Cherche le joueur dans l'effectif ou sur le banc.
  let src=null, idx=-1;
  idx=arr.players.findIndex(x=>String(x&&x.id||'')===pid || (x&&x.name)===pid);
  if(idx>=0) src=arr.players;
  else { idx=arr.bench.findIndex(x=>String(x&&x.id||'')===pid || (x&&x.name)===pid); if(idx>=0) src=arr.bench; }
  if(!src){ logEvent('Joueur introuvable.','#e02030'); return; }
  const p=src[idx];
  // Ne pas vider l'effectif de son dernier gardien.
  if(p.pos==='GB'){
    const otherGK=arr.players.concat(arr.bench).some(x=>x!==p && x && x.pos==='GB');
    if(!otherGK){ logEvent('⚠️ Impossible : c\'est le seul gardien de l\'effectif.','#e06060'); return; }
  }
  // Un effectif de départ doit garder assez de joueurs pour aligner une équipe.
  if(src===arr.players && arr.players.length<=7){
    logEvent('⚠️ Effectif de départ trop réduit pour retirer ce joueur.','#e06060'); return;
  }
  src.splice(idx,1);
  p.onBench=false;
  arr.reserves.push(p);
  logEvent('📥 '+p.name+' est envoyé en réserve.','#8840e0');
  saveCareerV2();
  const el=document.getElementById('career-director-content'); if(el) el.innerHTML=_renderDirectorSquad();
}

// Rappelle un joueur de la réserve vers le banc de l'équipe.
function _squadFromReserve(teamKey, pid){
  const arr=_squadArraysFor(teamKey); if(!arr || !arr.reserves) return;
  const i=arr.reserves.findIndex(x=>String(x&&x.id||'')===pid || (x&&x.name)===pid);
  if(i<0){ logEvent('Joueur introuvable en réserve.','#e02030'); return; }
  const p=arr.reserves[i];
  arr.reserves.splice(i,1);
  p.onBench=true;
  arr.bench.push(p);
  logEvent('📤 '+p.name+' est rappelé de la réserve (sur le banc).','#18c860');
  saveCareerV2();
  const el=document.getElementById('career-director-content'); if(el) el.innerHTML=_renderDirectorSquad();
}

// ── ÉQUIPE FUTSAL 5v5 DU CLUB ────────────────────────────────────────────
// Beaucoup de clubs ont une section futsal. On la modélise comme un groupe
// distinct (careerV2.futsalSquad) où l'on peut « prêter » des joueurs de
// l'équipe première. Ils n'apparaissent plus dans la compo à 11/7, mais
// gardent leur place dans le club (récupérables à tout moment).
function _findAndRemove(pid){
  const C=careerV2; if(!C) return null;
  const pools=[C.players, C.bench, C.reserves];
  for(const pool of pools){
    if(!Array.isArray(pool)) continue;
    const i=pool.findIndex(x=>String(x&&x.id||'')===pid || (x&&x.name)===pid);
    if(i>=0){ return pool.splice(i,1)[0]; }
  }
  return null;
}
function _squadToFutsal(pid){
  const C=careerV2; if(!C) return;
  if(!C.futsalSquad) C.futsalSquad=[];
  // Garde-fous : ne pas vider l'effectif de départ ni son dernier gardien.
  const target=(C.players||[]).concat(C.bench||[]).find(x=>String(x&&x.id||'')===pid||(x&&x.name)===pid)
             || (C.reserves||[]).find(x=>String(x&&x.id||'')===pid||(x&&x.name)===pid);
  if(!target){ logEvent('Joueur introuvable.','#e02030'); return; }
  if(target.pos==='GB'){
    const otherGK=(C.players||[]).concat(C.bench||[]).some(x=>x!==target&&x&&x.pos==='GB');
    if(!otherGK){ logEvent('⚠️ Impossible : c\'est le seul gardien de l\'effectif.','#e06060'); return; }
  }
  if((C.players||[]).some(x=>x===target) && (C.players||[]).length<=7){
    logEvent('⚠️ Effectif de départ trop réduit.','#e06060'); return;
  }
  const p=_findAndRemove(pid);
  if(!p){ logEvent('Joueur introuvable.','#e02030'); return; }
  p.onBench=false; p._inFutsal=true;
  C.futsalSquad.push(p);
  logEvent('⚽ '+p.name+' rejoint l\'équipe futsal 5v5 du club.','#1878e8');
  saveCareerV2();
  const el=document.getElementById('career-director-content'); if(el) el.innerHTML=_renderDirectorSquad();
}
function _squadFromFutsal(pid){
  const C=careerV2; if(!C || !C.futsalSquad) return;
  const i=C.futsalSquad.findIndex(x=>String(x&&x.id||'')===pid||(x&&x.name)===pid);
  if(i<0){ logEvent('Joueur introuvable au futsal.','#e02030'); return; }
  const p=C.futsalSquad.splice(i,1)[0];
  p._inFutsal=false; p.onBench=true;
  (C.bench||(C.bench=[])).push(p);
  logEvent('⚽ '+p.name+' revient du futsal (sur le banc).','#18c860');
  saveCareerV2();
  const el=document.getElementById('career-director-content'); if(el) el.innerHTML=_renderDirectorSquad();
}

// ── LIBÉRER UN JOUEUR ────────────────────────────────────────────────────
// Sort définitivement le joueur du club (résiliation). Avec confirmation et
// garde-fous (dernier gardien, effectif minimal).
function _squadRelease(teamKey, pid){
  const C=careerV2; if(!C) return;
  const arr=_squadArraysFor(teamKey); if(!arr) return;
  // Localiser le joueur dans l'un des groupes (y compris futsal pour l'équipe principale).
  const groups = teamKey==='main'
    ? [C.players, C.bench, C.reserves, C.futsalSquad]
    : [arr.players, arr.bench, arr.reserves];
  let p=null, grp=null, idx=-1;
  for(const g of groups){
    if(!Array.isArray(g)) continue;
    const i=g.findIndex(x=>String(x&&x.id||'')===pid||(x&&x.name)===pid);
    if(i>=0){ p=g[i]; grp=g; idx=i; break; }
  }
  if(!p){ logEvent('Joueur introuvable.','#e02030'); return; }
  // Garde-fous.
  if(p.pos==='GB'){
    const otherGK=(C.players||[]).concat(C.bench||[]).some(x=>x!==p&&x&&x.pos==='GB');
    if(!otherGK){ logEvent('⚠️ Impossible de libérer votre seul gardien.','#e06060'); return; }
  }
  if(grp===C.players && C.players.length<=7){
    logEvent('⚠️ Effectif de départ trop réduit pour libérer ce joueur.','#e06060'); return;
  }
  if(typeof confirm==='function' && !confirm('Libérer '+p.name+' ? Il quittera définitivement le club (sans indemnité de transfert).')) return;
  grp.splice(idx,1);
  logEvent('🚪 '+p.name+' a été libéré du club.','#e06060');
  // Petit écho social : un départ fait réagir.
  try{ if(typeof _socialAdd==='function') _socialAdd(p.name+' quitte le club. Fin d\'une histoire ou bon débarras ? 🤔','neutral'); }catch(e){}
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

  // ── Offres reçues pour vos joueurs (pro/semi-pro uniquement) ────────
  if(isPro || isSemiPro){
    try{ if(typeof _renderIncomingOffersCard==='function') h += _renderIncomingOffersCard(); }catch(e){ console.error('offers card:',e); }
  }

  if(!isPro && !isSemiPro){
    // ── MODE AMATEUR (DH / R3) ──────────────────────────────────────
    h += '<div class="ccard">';
    h += '<div style="font-size:10px;font-weight:700;color:var(--gold);margin-bottom:4px">ℹ️ Club Amateur</div>';
    h += '<div style="font-size:9px;color:var(--muted);line-height:1.5">En District et R3, il n\'y a pas de marché des transferts. Les joueurs s\'engagent librement et jouent bénévolement. Vos revenus viennent des <b>licences</b> et de la <b>municipalité</b>.</div>';
    h += '</div>';

    // Joueurs libres locaux
    h += '<div class="ccard">';
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
        const _fee = (typeof _freeAgentFee==='function') ? _freeAgentFee(p) : 0;
        const _afford = _fee <= (club.transferBudget || 0);
        const canSign = ((C.players||[]).length + (C.bench||[]).length < 16) && _afford;
        h += '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--b1)">';
        h += '<div style="width:24px;font-size:8px;color:var(--muted)">' + p.pos + '</div>';
        h += '<div style="flex:1"><div style="font-size:10px;font-weight:700">' + p.name + '</div>';
        h += '<div style="font-size:8px;color:var(--muted)">' + ((typeof raceMeta==='function'?raceMeta(p.race).emoji+' '+raceMeta(p.race).name:'👤') ) + ' · ' + (p.region||'?') + '</div></div>';
        h += '<div style="font-size:11px;font-weight:900;color:' + ovrCol + ';width:24px;text-align:center">' + ovr + '</div>';
        if(p._isPotentialPro){
          h += '<div style="font-size:8px;color:#9c27b0" title="Potentiel pro détecté !">💎</div>';
        }
        h += '<div style="width:52px;text-align:right;font-size:8px;font-weight:900;color:' + (_afford?'#f0c028':'#e06060') + '">' + _fmtMoney(_fee) + '</div>';
        h += '<button class="btn btng" onclick="signFreeAgent(' + i + ')" style="font-size:8px;padding:2px 6px;' + (!canSign?'opacity:.4;pointer-events:none':'') + '">' + (canSign?'Signer':(!_afford?'💸':'Plein')) + '</button>';
        h += '</div>';
      });
    }
    h += '</div>';

  } else if(isSemiPro){
    // ── MODE SEMI-PRO (R1 / R2) ────────────────────────────────────
    h += '<div class="ccard">';
    h += '<div style="font-size:10px;font-weight:700;color:var(--gold);margin-bottom:4px">⚽ Recrutement Semi-Pro</div>';
    h += '<div style="font-size:9px;color:var(--muted)">Budget mercato : <b>🪙 ' + _fmtMoney(club.transferBudget) + '</b> · Indemnités de transfert faibles possibles.</div>';
    h += '</div>';
    h += _contractsHTML(C, club);
    h += _transferMarketHTML(C, club, true);

  } else {
    // ── MODE PRO (D1/D2/D3) ────────────────────────────────────────
    const wopen = C.mercato && C.mercato.window_open;
    h += '<div class="ccard">';
    h += '<div style="font-size:10px;color:' + (wopen?'#18c860':'#e06060') + ';font-weight:700">' + (wopen?'🟢 Fenêtre ouverte':'🔴 Fenêtre fermée') + '</div>';
    h += '<div style="font-size:9px;color:var(--muted);margin-top:4px">Budget transferts : 🪙 ' + _fmtMoney(club.transferBudget) + '</div>';
    h += '</div>';
    h += _transferMarketHTML(C, club, wopen !== false);
  }

  h += '</div>';
  return h;
}

// ── Contrats (semi-pro) ──────────────────────────────────────────────────
// En R1/R2 le club n'a pas les moyens d'indemnités : il recrute en NÉGOCIANT
// un contrat (salaire + durée). Chaque joueur libre a une exigence salariale ;
// proposer moins fait chuter les chances, proposer plus les garantit mais
// pèse chaque semaine sur la masse salariale.
function _contractsHTML(C, club){
  const list = C.freeAgents || [];
  let h = '<div class="ccard">';
  h += '<div style="font-size:10px;font-weight:700;color:var(--gold);margin-bottom:2px">📝 Proposer un contrat</div>';
  h += '<div style="font-size:8px;color:var(--muted);margin-bottom:8px">Salaire hebdomadaire + durée. Prime à la signature = 4 semaines de salaire.</div>';

  if(!list.length){
    h += '<div style="font-size:9px;color:var(--muted)">Aucun joueur libre. Avancez d\'une semaine.</div></div>';
    return h;
  }

  list.forEach(function(p, i){
    const ovr = (typeof _pOvr==='function') ? _pOvr(p) : 50;
    const ask = (typeof contractAskingWage==='function') ? contractAskingWage(p) : 1;
    const ovrCol = ovr>=60?'#f0c028':ovr>=45?'#18c860':'#888';
    h += '<div style="padding:6px 0;border-bottom:1px solid var(--b1)">';
    h += '<div style="display:flex;align-items:center;gap:8px">';
    h += '<div style="width:24px;font-size:8px;color:var(--muted)">' + (p.pos||'?') + '</div>';
    h += '<div style="flex:1;min-width:0"><div style="font-size:10px;font-weight:700">' + p.name + '</div>';
    h += '<div style="font-size:8px;color:var(--muted)">' + (p.age?p.age+' ans · ':'') + 'demande ~' + _fmtMoney(ask) + '/sem</div></div>';
    h += '<div style="font-size:11px;font-weight:900;color:' + ovrCol + ';width:24px;text-align:center">' + ovr + '</div>';
    h += '</div>';
    // Trois offres pré-calculées : le joueur voit tout de suite l'arbitrage
    // entre coût hebdomadaire et probabilité de signature.
    h += '<div style="display:flex;gap:4px;margin-top:4px">';
    [['Ric.', Math.round(ask*1.25), 3], ['Juste', Math.round(ask*1.0), 2], ['Serré', Math.round(ask*0.78), 1]].forEach(function(o){
      const ch = (typeof contractAcceptChance==='function') ? contractAcceptChance(p, o[1], o[2]) : 0.5;
      const col = ch>=0.7?'#18c860':ch>=0.4?'#f0c028':'#e06060';
      h += '<button class="btn" onclick="offerContract(' + i + ',' + o[1] + ',' + o[2] + ')" style="flex:1;font-size:7px;padding:3px 2px;border-color:' + col + '">';
      h += '<div style="font-weight:900;color:' + col + '">' + o[0] + ' ' + Math.round(ch*100) + '%</div>';
      h += '<div style="color:var(--muted)">' + _fmtMoney(o[1]) + '/sem · ' + o[2] + 'a</div>';
      h += '</button>';
    });
    h += '</div></div>';
  });
  h += '</div>';
  return h;
}

// ── Liste des transferts (achats) ────────────────────────────────────────
// Remplace les deux « Marché — à développer prochainement » (semi-pro et pro).
// `windowOpen` : en pro, hors fenêtre de mercato on affiche mais on bloque.
function _transferMarketHTML(C, club, windowOpen){
  if(!C.mercato) C.mercato = {};
  // Première visite : on peuple le marché.
  if(!Array.isArray(C.mercato.transfer_list)){
    try{ generateTransferList(); }catch(e){ C.mercato.transfer_list = []; }
  }
  const list = C.mercato.transfer_list || [];
  const budget = club.transferBudget || 0;
  const total = (C.players||[]).length + (C.bench||[]).length;
  const max = _careerSquadMax();
  const squadFull = total >= max;

  let h = '<div class="ccard">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
  h += '<div style="font-size:10px;font-weight:700;color:var(--gold)">🔁 Joueurs à vendre</div>';
  h += '<button class="btn" onclick="refreshTransferList()" style="font-size:8px;padding:2px 8px">🔄 Actualiser</button>';
  h += '</div>';

  if(!list.length){
    h += '<div style="font-size:9px;color:var(--muted)">Aucun joueur sur le marché pour l\'instant. Les clubs adverses mettent des joueurs en vente au fil des semaines.</div>';
    h += '</div>';
    return h;
  }

  list.forEach(function(t){
    const p = t.player || {};
    const ovr = (typeof _pOvr==='function') ? _pOvr(p) : 50;
    const ovrCol = ovr>=75?'#f0c028':ovr>=60?'#18c860':ovr>=45?'#e06060':'#888';
    const tooPricey = t.fee > budget;
    const blocked = tooPricey || squadFull || !windowOpen;
    // Une bonne affaire est signalée : le prix demandé est sous la valeur.
    const bargain = t.fee < t.value * 0.9;

    h += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--b1)">';
    h += '<div style="width:24px;font-size:8px;color:var(--muted)">' + (p.pos||'?') + '</div>';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-size:10px;font-weight:700">' + (p.name||'?') + (p._potential && p._potential > ovr+12 ? ' <span title="Fort potentiel">💎</span>' : '') + '</div>';
    // 💰 = richesse de la région du vendeur : c'est elle qui explique qu'un
    // joueur d'une petite division riche coûte plus qu'une star d'une grande
    // division pauvre.
    const _w = t.sellerWealth || 2;
    h += '<div style="font-size:8px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (p.age?p.age+' ans · ':'') + '<span style="color:' + t.sellerColor + '">' + t.sellerName + '</span> · ' + t.sellerLevel + ' <span title="Richesse de la région du club vendeur">' + '💰'.repeat(_w) + '</span></div>';
    h += '</div>';
    h += '<div style="font-size:11px;font-weight:900;color:' + ovrCol + ';width:24px;text-align:center">' + ovr + '</div>';
    h += '<div style="width:64px;text-align:right">';
    h += '<div style="font-size:9px;font-weight:900;color:' + (tooPricey?'#e06060':'#f0c028') + '">' + _fmtMoney(t.fee) + '</div>';
    if(bargain) h += '<div style="font-size:7px;color:#18c860">bonne affaire</div>';
    h += '</div>';
    h += '<div style="display:flex;flex-direction:column;gap:2px">';
    h += '<button class="btn btng" onclick="buyTransferTarget(\'' + t.id + '\')" style="font-size:8px;padding:2px 6px;' + (blocked?'opacity:.4;pointer-events:none':'') + '">' + (squadFull?'Plein':(!windowOpen?'Fermé':(tooPricey?'Trop cher':'Recruter'))) + '</button>';
    if(!t.negotiated && windowOpen && !squadFull){
      h += '<button class="btn" onclick="negotiateTransferBuy(\'' + t.id + '\')" style="font-size:7px;padding:1px 6px">Négocier</button>';
    }
    h += '</div>';
    h += '</div>';
  });

  h += '<div style="font-size:8px;color:#666;margin-top:6px;font-style:italic">Négocier fait baisser le prix, mais le club peut retirer le joueur.</div>';
  h += '</div>';
  return h;
}

function refreshTransferList(){
  if(!careerV2) return;
  try{ generateTransferList(); }catch(e){}
  saveCareerV2();
  renderCareerDirectorTab('mercato');
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

// Prime à la signature d'un agent libre. Un joueur libre n'a pas d'indemnité
// de transfert (c'est tout l'intérêt), mais il ne signe pas pour rien : on
// paie une prime, bien moins chère que sa valeur marchande.
function _freeAgentFee(p){
  let v = (typeof _boardPlayerValue==='function') ? _boardPlayerValue(p) : 1000;
  // Même échelle que le marché des transferts (cf. _marketScale dans board.js),
  // sinon la prime serait hors de prix en bas de pyramide alors que les
  // transferts, eux, seraient ajustés.
  if(typeof _marketScale==='function') v *= _marketScale();
  return Math.max(100, Math.round(v * 0.18 / 100) * 100);
}

function signFreeAgent(idx){
  if(!careerV2) return;
  const p = (careerV2.freeAgents||[])[idx];
  if(!p){ logEvent('Joueur introuvable','#e02030'); return; }
  const total = (careerV2.players||[]).length + (careerV2.bench||[]).length;
  const _maxSquad = _careerSquadMax();
  if(total >= _maxSquad){ logEvent('Effectif plein ! (max '+_maxSquad+')','#e02030'); return; }

  // Prime de signature : signer était jusqu'ici entièrement GRATUIT, ce qui
  // rendait le budget mercato décoratif et les agents libres toujours
  // préférables à un transfert. Une prime modeste rétablit l'arbitrage.
  const fee = _freeAgentFee(p);
  const budget = careerV2.club.transferBudget || 0;
  if(fee > budget){
    logEvent('💸 Prime de signature : ' + _fmtMoney(fee) + ' demandés, ' + _fmtMoney(budget) + ' disponibles.', '#e02030');
    return;
  }
  if(!confirm('Signer ' + p.name + ' ?\n\nPrime de signature : ' + _fmtMoney(fee) + '\nBudget restant après : ' + _fmtMoney(budget - fee))) return;
  careerV2.club.transferBudget = budget - fee;
  try{ _addFinanceLog('Prime de signature — ' + p.name, -fee); }catch(e){}

  p.onBench = true;
  if(!careerV2.bench) careerV2.bench = [];
  careerV2.bench.push(p);
  careerV2.freeAgents.splice(idx, 1);
  logEvent('✅ ' + p.name + ' rejoint le club (' + _fmtMoney(fee) + ') !', '#18c860');
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
  careerV2._youthPromotedThisSeason = (careerV2._youthPromotedThisSeason || 0) + 1;
  logEvent('🎓 ' + p.name + ' intègre l\'équipe première !', '#18c860');
  saveCareerV2();
  renderCareerDirectorTab('academy');
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
  renderCareerDirectorTab('academy');
}

function refreshFreeAgents(){
  if(!careerV2) return;
  _generateFreeAgents();
  saveCareerV2();
  renderCareerDirectorTab('mercato');
}


// ── ONGLET ACADÉMIE DE JEUNES ─────────────────────────────────────────
// Auparavant, les jeunes générés en début de saison n'étaient visibles QUE
// pour les clubs amateurs (DH/R3), noyés en bas de l'onglet Mercato — un
// club pro/semi-pro recevait bien des jeunes (la génération ne dépend pas du
// niveau) mais ne les voyait JAMAIS nulle part. Onglet dédié, visible à tous
// les niveaux, avec une vraie vitrine : progression vers le potentiel,
// niveau du centre de formation, et son effet concret expliqué en clair.
function _renderDirectorAcademy(){
  const C = careerV2; const club = C.club;
  const acadLvl = (club.infra && club.infra.formation) || 0;
  const quality = Math.min(100, 30 + acadLvl*14); // même formule que l'affichage infra (cohérence)
  const youth = C.youthPool || [];

  let h = '<div style="padding:4px">';

  // ── Bandeau centre de formation : niveau + effet concret ────────────
  h += '<div style="background:var(--dark);border:1px solid var(--b1);border-radius:8px;padding:12px;margin-bottom:10px">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">';
  h += '<div style="font-size:11px;font-weight:900;color:var(--gold);font-family:\'Barlow Condensed\',sans-serif;letter-spacing:1px">🌱 CENTRE DE FORMATION</div>';
  h += '<div style="font-size:10px;font-weight:700;color:var(--muted)">Niveau ' + acadLvl + '/5</div>';
  h += '</div>';
  h += '<div style="height:6px;background:#111;border-radius:3px;overflow:hidden;margin-bottom:8px">';
  h += '<div style="height:100%;width:' + quality + '%;background:linear-gradient(90deg,#18c860,#f0c028);border-radius:3px"></div></div>';
  h += '<div style="font-size:9px;color:var(--muted);line-height:1.5">';
  if(acadLvl <= 0){
    h += 'Pas encore de centre de formation construit — vos jeunes arrivent quand même (bénévolat local), mais en petit nombre et avec un potentiel limité. <b style="color:var(--gold)">Construisez-en un depuis Infrastructures</b> pour en accueillir plus, et de meilleure qualité.';
  } else {
    h += 'Chaque niveau améliore <b>la quantité</b> (+1 jeune tous les 2 niveaux) <b>et la qualité</b> (+4 de potentiel de base par niveau) des jeunes recrutés, ainsi que vos chances de tomber sur un talent régional ou une <b>pépite</b> professionnelle.';
  }
  h += '</div></div>';

  // ── Liste des jeunes ──────────────────────────────────────────────
  h += '<div class="ccard ccard-flush">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
  h += '<div style="font-size:10px;font-weight:700;color:var(--gold)">🎓 Jeunes du club (' + youth.length + ')</div>';
  h += '</div>';

  if(youth.length === 0){
    h += '<div style="font-size:9px;color:var(--muted);padding:6px 0">Pas encore de jeunes cette saison. Une nouvelle vague arrive au début de la prochaine saison.</div>';
  } else {
    youth.forEach(function(p, i){
      const vals = Object.values(p.s||{});
      const ovr = vals.length ? Math.round(vals.reduce(function(a,b){return a+b;},0)/vals.length) : 10;
      const pot = p._potential || ovr;
      const potCol = pot >= 70 ? '#9c27b0' : pot >= 50 ? '#f0c028' : pot >= 35 ? '#18c860' : '#888';
      const prog = Math.max(2, Math.min(100, Math.round(ovr/Math.max(1,pot)*100)));
      const raceI = (typeof raceMeta==='function') ? raceMeta(p.race) : {emoji:'👤',name:''};
      h += '<div style="padding:8px 0;border-bottom:1px solid var(--b1)">';
      h += '<div style="display:flex;align-items:center;gap:8px">';
      h += '<div style="width:26px;font-size:8px;color:var(--muted);text-align:center">' + p.pos + '</div>';
      h += '<div style="flex:1;min-width:0">';
      h += '<div style="font-size:10px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + p.name + (p._isPotentialPro?' <span style="color:#9c27b0">💎 PÉPITE</span>':'') + '</div>';
      h += '<div style="font-size:8px;color:var(--muted)">' + raceI.emoji + ' ' + raceI.name + ' · ' + (p._age||16) + ' ans</div>';
      h += '</div>';
      h += '<button class="btn btng" onclick="promoteYouth(' + i + ')" style="font-size:8px;padding:2px 6px;white-space:nowrap">↑ Promouvoir</button>';
      if(p._isPotentialPro){
        h += '<button class="btn" onclick="sellYouthPro(' + i + ')" style="font-size:8px;padding:2px 6px;color:#9c27b0;border-color:#9c27b0;white-space:nowrap">💰 Vendre</button>';
      }
      h += '</div>';
      // Barre de progression OVR actuel → potentiel
      h += '<div style="display:flex;align-items:center;gap:6px;margin-top:5px">';
      h += '<span style="font-size:8px;color:var(--muted);width:20px">' + ovr + '</span>';
      h += '<div style="flex:1;height:5px;background:#111;border-radius:3px;overflow:hidden">';
      h += '<div style="height:100%;width:' + prog + '%;background:' + potCol + ';border-radius:3px"></div></div>';
      h += '<span style="font-size:8px;font-weight:700;color:' + potCol + ';width:20px;text-align:right">' + pot + '</span>';
      h += '</div>';
      h += '</div>';
    });
  }
  h += '</div>';
  h += '</div>';
  return h;
}

function _renderDirectorFinances(){
  const C = careerV2; const club = C.club;
  const log = (C.finances.log||[]).slice(-10).reverse();
  let h = '<div class="ccard ccard-flush">';
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
  // Dotations (primes de classement / subvention / coupe) — rend le système
  // lisible avant la fin de saison plutôt qu'après coup.
  try{ if(typeof _renderPrizesCard==='function') h += _renderPrizesCard(); }catch(e){ console.error('prizes card:',e); }
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
  h += '<div class="ccard">';
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
    h += '<div class="ccard">';
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
        + '</div>'
        + '<div style="font-size:8px;font-weight:700;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin:8px 0 5px">🏟 Ambiance le jour du match</div>'
        + (typeof _stadiumSelectorHTML==='function' ? _stadiumSelectorHTML() : '');
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
  let h = '<div class="ccard ccard-flush">';
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
  h += '<div class="ccard">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between">';
  h += '<div style="font-size:11px;font-weight:900;color:var(--gold)">👔 Organigramme du club</div>';
  h += '<div style="font-size:9px;color:var(--muted)">'+filled+'/'+totalPosts+' postes · <b style="color:#f0c028">'+_fmtMoney(totalWage)+'</b>/sem.</div>';
  h += '</div>';
  h += '<div style="font-size:8px;color:var(--muted);margin-top:5px;line-height:1.4">Chaque membre a un niveau (★). Les entraîneurs spécialisés accélèrent la progression dans leur domaine, l\'analyste vidéo prépare les matchs, le staff médical gère forme et blessures.</div>';
  h += '</div>';

  depts.forEach(function(dept){
    h += '<div class="ccard">';
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

  let h = '<div class="ccard ccard-flush">';

  // ── En-tête + navigation mois ─────────────────────────────────────
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
  h += '<button class="btn" onclick="_calNavMonth(-1)" style="font-size:10px;padding:3px 8px">◀</button>';
  h += '<div style="font-size:11px;font-weight:900;color:var(--gold)">📅 '+_MOIS_FR[(viewDate.month-1)%12]+' — An '+viewDate.year+'</div>';
  h += '<button class="btn" onclick="_calNavMonth(1)" style="font-size:10px;padding:3px 8px">▶</button>';
  h += '</div>';
  h += '<div style="font-size:9px;color:var(--muted);margin-bottom:8px">Semaine '+C.week+' · Saison '+C.season+' · <span onclick="_calGoToday()" style="text-decoration:underline;cursor:pointer">revenir à aujourd\'hui</span></div>';

  // ── Forme / moral moyens de l'effectif ──────────────────────────────
  // _fm (forme) et _hm (moral) vont de -10 à +10, centrés sur 0. Les afficher
  // « X/10 » donnait l'impression d'un moral au minimum alors que 0 = neutre.
  // On mappe -10..+10 sur 0..100 pour une lecture claire : 50 = neutre.
  const _squadAll = (C.players||[]).concat(C.bench||[]);
  if(_squadAll.length){
    const avgFmRaw = _squadAll.reduce(function(s,p){return s+(p._fm||0);},0)/_squadAll.length;
    const avgHmRaw = _squadAll.reduce(function(s,p){return s+(p._hm||0);},0)/_squadAll.length;
    const to100 = function(v){ return Math.round((v+10)/20*100); };
    const avgFm = to100(avgFmRaw), avgHm = to100(avgHmRaw);
    const scaleCol = function(v){ return v>=60?'#18c860':v>=40?'#f0c028':'#e06060'; };
    const fmCol = scaleCol(avgFm);
    const hmCol = scaleCol(avgHm);
    const avgCoh = _squadAll.reduce(function(s,p){return s+(p._coh!=null?p._coh:50);},0)/_squadAll.length;
    const cohCol = avgCoh>=65?'#18c860':avgCoh>=45?'#f0c028':'#e06060';
    h += '<div style="display:flex;gap:14px;margin-bottom:8px;font-size:9px">';
    h += '<div>💪 Forme moy. <b style="color:'+fmCol+'">'+avgFm+'</b>/100</div>';
    h += '<div>🙂 Moral moy. <b style="color:'+hmCol+'">'+avgHm+'</b>/100</div>';
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