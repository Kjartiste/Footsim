// ═══════════════════════════════════════════════════
// IA.JS — IA, décisions, sorts, buts
// ═══════════════════════════════════════════════════
function setPhase(ph){
  G.phase=ph;G.phTick=0;
  if(ph!=='FREEKICK')G._fkWall=null; // le mur ne subsiste jamais hors coup franc
  // Au GOALKICK, annuler les courses hors-ballon des attaquants adverses
  // pour qu'ils ne restent pas dans la surface du gardien
  if(ph==='GOALKICK'){
    const dti=1-G.atkTi;
    (teams[dti]?.players||[]).forEach(p=>{p.runT=0;p.runCool=2+Math.random()*2;});
  }
  const el=document.getElementById('hphase');
  if(el)el.textContent=PHASE_LABELS[ph]||ph;
}

function copyMatchLog(source){
  let lines;
  if(source==='half1' && G._halfLog?.length){
    const s0=G.scores?.[0]??0, s1=G.scores?.[1]??1;
    const header=`⚽ MI-TEMPS — ${teams[0].name} ${s0}-${s1} ${teams[1].name}`;
    lines=header+'\n'+G._halfLog.map(e=>`${e.min}' ${e.msg}`).join('\n');
  } else {
    const box=document.getElementById('logbox');if(!box)return;
    const s0=G.scores?.[0]??0, s1=G.scores?.[1]??1;
    const half=G.half===1?'1RE MI-TEMPS':'2E MI-TEMPS';
    const header=`⚽ ${half} — ${teams[0].name} ${s0}-${s1} ${teams[1].name}`;
    lines=header+'\n'+[...box.querySelectorAll('div')].map(d=>d.textContent).join('\n');
  }
  if(!lines.trim()) return;
  const doFeedback=()=>{
    const btn=document.getElementById('log-copy-btn');
    if(btn){btn.textContent='✓ Copié !';setTimeout(()=>btn.textContent='📋 Copier',1500);}
    document.querySelectorAll('.ht-copy-btn').forEach(b=>{b.textContent='✓ Copié !';setTimeout(()=>b.textContent='📋 Copier ce journal',1500);});
  };
  navigator.clipboard?.writeText(lines).then(doFeedback).catch(()=>{
    const ta=document.createElement('textarea');
    ta.value=lines;ta.style.cssText='position:fixed;top:-9999px';
    document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
    doFeedback();
  });
}

function logEvent(msg,col='#18c860'){
  const safe=String(msg||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const tmsg=document.getElementById('tmsg');if(tmsg)tmsg.textContent=msg||'';
  const tdot=document.getElementById('tdot');if(tdot)tdot.style.background=col;
  const box=document.getElementById('logbox');if(!box)return;
  const div=document.createElement('div');
  div.className='log-entry';
  div.innerHTML=`<span style="color:${col};font-size:10px;font-family:'Barlow Condensed',sans-serif;font-weight:700">${G.minute}'</span> ${safe}`;
  box.appendChild(div);
  box.scrollTop=box.scrollHeight;
  if(box.children.length>120)box.removeChild(box.firstChild);
  G.log.push({msg:safe,col,min:G.minute});
}

// La mentalité (setTacMode) influence désormais aussi la fréquence de
// déclenchement des sorts, pas seulement les stats atk/def brutes :
//  • Attaque  → sorts offensifs (tirs) beaucoup plus fréquents, sorts
//    défensifs/soutien un peu moins.
//  • Pressing → un boost modéré et équilibré des deux types (équipe qui
//    joue vite, qui tente sa chance partout).
//  • Défense  → sorts de soutien/réactifs beaucoup plus fréquents (l'équipe
//    joue la carte prudente/technique), sorts offensifs moins fréquents.

// Normaliser les postes 11v11 vers catégories IA

// ── Tir simplifié pour le mode 11v11 ─────────────────────────────────
function _doShot11(sh, ati, dti, def2, gk, goalX){
  G.shots[ati]++; if(sh) sh.mSh++;
  const ast=strat(ati)||{atk:1}; const dst=strat(dti)||{def:1};
  const atkS = ((sh?sh.s.sht:40)+irng(-12,12))*ast.atk;
  const defS = ((gk?gk.s.def+28:30)+(def2?def2.s.def*.3:0)+irng(-10,10))*dst.def;
  const gy = clamp(PCY+rng(-5.5,5.5), GY1-1.5, GY2+1.5);
  kickTo(goalX, gy, 2.6); freeB();
  logEvent(`Tir de ${sh?sh.name:'?'} !`, teams[ati].color+'cc');
  setTimeout(()=>{
    if(!G.running)return;
    if(atkS>defS){
      goalScored(sh, ati, goalX);
    } else {
      const saved = Math.random()<.62;
      if(saved){
        logEvent(`Arrêt de ${gk&&gk.name||'GB'} !`, teams[dti].color);
        if(Math.random()<.38){
          G.corners[ati]++; G.ball.x=goalX+(ati===0?-.5:.5); G.ball.y=gy; G.ball.vx=0; G.ball.vy=0;
          G.atkTi=ati; setPhase('CORNER'); logEvent(`Corner pour ${teams[ati].name}`, teams[ati].color+'88');
        } else { if(gk) giveB(gk); G.atkTi=dti; setPhase('GOALKICK'); }
      } else {
        logEvent(`Tir hors cadre`, teams[ati].color+'77'); G.atkTi=dti; setPhase('GOALKICK');
      }
    }
  }, 400/speedMult);
}

function _posCategory(pos){
  if(!pos) return 'mid';
  if(pos==='GB') return 'gk';
  if(['DC','DCD','DCG','DD','DG','LB','RB'].includes(pos)) return 'def';
  if(['MDC','MDC2'].includes(pos)) return 'dmc';
  if(['MC','MCD','MCG'].includes(pos)) return 'mid';
  if(['MO','MOG','MOD','MCD','MCG'].includes(pos)) return 'mo';
  if(['ATT','ATT2','AG','AD'].includes(pos)) return 'att';
  return 'mid';
}

function mentalitySpellMult(ti,isAtkSpell){
  const mode=G.tacMode?G.tacMode[ti]:null;
  if(mode==='attack') return isAtkSpell?1.55:0.75;
  if(mode==='press')  return isAtkSpell?1.20:1.15;
  if(mode==='defend') return isAtkSpell?0.65:1.45;
  return 1;
}
function aiDecide(dt=0.016){
  if(G.phase==='HALFTIME'||G.phase==='END'||G._celebrating)return;
  G.phTick++;
  const ati=G.atkTi,dti=1-ati;
  const ap=actP(ati),dp=actP(dti);
  if(!ap.length||!dp.length)return;

  // ── IA 11v11 simplifiée (version épurée) ─────────────────────────
  // Désactivée par défaut : le 11v11 utilise l'IA spatiale complète du 7v7.
  if(window._legacy11v11 && window.gameMode === '11v11'){
    const ast11=strat(ati)||{atk:1,def:1};
    const dst11=strat(dti)||{atk:1,def:1};
    const allPlayers = teams.flatMap(T=>T.players);
    const carrier11 = G.owner ? allPlayers.find(p=>p.id===G.owner) : null;
    const carrier = carrier11 || pick(byR(ati,'ATT','MO','MC','AG','AD')) || pick(ap);
    const opp = pick(byR(dti,'DD','DC','DG','MDC','DCD','DCG','LB','RB')) || pick(dp);
    const gk = byR(dti,'GB')[0];
    const oppGoalX = ati===0 ? WW : 0;
    const fwd = ati===0 ? 1 : -1;

    // Sort — même logique que le 7v7
    let spell11=null;
    if(carrier && (G.phase==='ATTACK'||G.phase==='BUILDUP') && carrier.mp>10){
      for(const sid of (carrier.spells||[])){
        const sp=SPELLS.find(x=>x.id===sid);
        if(!sp||carrier.mp<sp.mp)continue;
        const mult=mentalitySpellMult(ati,ATTACK_SPELLS&&ATTACK_SPELLS.has(sid));
        if(Math.random()<sp.prob*mult){ spell11=sp; break; }
      }
    }

    switch(G.phase){
      case 'KICKOFF':{
        if(G.phTick<2)return;
        const kicker=pick(byR(ati,'ATT','MO','MC','AG','AD'))||pick(ap);
        if(kicker){kicker.x=PCX+(Math.random()-.5)*1.5;kicker.y=PCY+(Math.random()-.5)*1.5;giveB(kicker);}
        logEvent(`Coup d\'envoi — ${teams[ati].name} !`,teams[ati].color);
        setPhase('BUILDUP');return;
      }
      case 'BUILDUP':{
        if(!carrier)return;
        const r=Math.random();
        if(r<.20){
          const mid=pick(byR(ati,'MC','MDC','MDC2','MCD','MCG','MO').filter(p=>!p.hasBall&&!p.stunT));
          if(mid){kickToP(carrier,mid,1.5);logEvent(`${carrier.name} → ${mid.name}`,teams[ati].color+'aa');}
        } else if(r<.36){
          const fwdP=pick(byR(ati,'ATT','ATT2','MO','AG','AD'));
          if(fwdP){kickToP(carrier,fwdP,2.0);logEvent(`Long ballon pour ${fwdP.name} !`,teams[ati].color+'cc');setPhase('ATTACK');}
        } else if(r<.50){
          setPhase('ATTACK');
        } else if(r<.64){
          const inter=pick(byR(dti,'MC','MDC','DD','DC','DG','LB','RB').filter(p=>!p.stunT));
          if(inter){
            freeB();
            setTimeout(()=>{if(!inter.red){giveB(inter);G.atkTi=dti;setPhase('TRANSITION');}},180/speedMult);
            logEvent(`Interception de ${inter.name} !`,teams[dti].color);
          }
        } else {
          const p2=pick(ap.filter(p=>!p.hasBall));
          if(p2){kickToP(carrier,p2,1.2);logEvent(`${teams[ati].name} fait circuler`,teams[ati].color+'55');}
        }
        return;
      }
      case 'ATTACK':{
        if(!carrier){setPhase('BUILDUP');return;}
        if(spell11){_doSpellRaw(carrier,ati,dti,spell11,oppGoalX);return;}
        const r=Math.random();
        if(r<.22){
          doShot(carrier,ati,dti,opp,gk,oppGoalX);
        } else if(r<.36){
          const atkD=(carrier.s.tec+carrier.s.spd*.3+irng(-10,10))*ast11.atk;
          const defD=(opp?opp.s.def+opp.s.spd*.2:20+irng(-10,10))*dst11.def;
          spawnTackle(G.ball.x,G.ball.y);
          if(atkD>defD){
            logEvent(`${carrier.name} élimine ${opp&&opp.name||''} !`,'#8840e0');
            // Blessure légère possible sur le défenseur
            if(opp&&Math.random()<0.08*(1-(opp.s.res||50)/99)){injurePlayer(dti,opp,true);}
          } else {
            G.tackles[dti]++;
            if(opp){giveB(opp);G.atkTi=dti;}
            logEvent(`${opp&&opp.name||''} tacle ${carrier.name} !`,teams[dti].color);
            // Blessure possible sur le porteur taclé
            if(Math.random()<0.10*(1-(carrier.s.res||50)/99)){injurePlayer(ati,carrier,true);}
            setPhase('TRANSITION');
          }
        } else if(r<.50){
          const wing=pick(byR(ati,'ATT','ATT2','AG','AD','MO').filter(p=>!p.hasBall));
          if(wing){kickToP(carrier,wing,1.7);logEvent(`Centre de ${carrier.name} → ${wing.name}`,teams[ati].color+'bb');}
        } else if(r<.63){
          const mid=pick(byR(ati,'MC','MDC','MCG','MCD').filter(p=>!p.hasBall));
          if(mid){kickToP(carrier,mid,.9);logEvent(`${carrier.name} recycle`,teams[ati].color+'55');setPhase('BUILDUP');}
        } else if(r<.76){
          if(opp){
            freeB();
            setTimeout(()=>{if(opp&&!opp.red){giveB(opp);G.atkTi=dti;setPhase('TRANSITION');}},160/speedMult);
            logEvent(`${opp.name} récupère !`,teams[dti].color);
          }
        } else {
          G.fouls[dti]++;if(opp)opp.stunT=irng(4,7)*60;
          spawnTackle(G.ball.x,G.ball.y);
          const cr=Math.random();
          if(opp&&cr<.14){
            opp.yc++;
            if(opp.yc>=2){opp.red=true;logEvent(`🟥 ${opp.name} EXPULSÉ !`,'#e02030');}
            else logEvent(`🟨 Carton jaune — ${opp.name}`,'#f0c028');
            if(Math.random()<0.12*(1-(carrier.s.res||50)/99)){injurePlayer(ati,carrier,true);}
          } else { logEvent(`Faute sur ${carrier.name}`,'#f0c028'); }
          setPhase('FREEKICK');
        }
        return;
      }
      case 'TRANSITION':{
        if(G.phTick<3)return;
        const car2=G.owner?allPlayers.find(p=>p.id===G.owner):pick(byR(ati,'MC','MDC','DD','DC','DG'));
        if(!car2){setPhase('BUILDUP');return;}
        logEvent(`${teams[ati].name} en contre !`,teams[ati].color);
        setPhase(Math.random()<.6?'ATTACK':'BUILDUP');
        return;
      }
      case 'CORNER':{
        if(G.phTick<5)return;
        const kicker=pick(byR(ati,'MC','MO','ATT','AG','AD'));
        const header=pick(byR(ati,'ATT','ATT2','DC','DCD','DCG').filter(p=>!p.hasBall));
        if(!kicker||!header){setPhase('BUILDUP');return;}
        const cx=oppGoalX+(ati===0?rng(-16,-1):rng(1,16));
        const cy=PCY+rng(-10,10);
        kickTo(cx,cy,1.5);
        logEvent(`Corner de ${kicker.name}...`,teams[ati].color+'bb');
        setTimeout(()=>{
          if(!G.running)return;
          if(Math.random()<.45){giveB(header);setTimeout(()=>{if(G.running)doShot(header,ati,dti,opp,gk,oppGoalX);},280/speedMult);}
          else{if(gk){giveB(gk);G.atkTi=dti;}setPhase('GOALKICK');}
        },650/speedMult);
        return;
      }
      case 'FREEKICK':{
        if(G.phTick<5)return;
        const sh=pick(byR(ati,'ATT','ATT2','MC','MO','AG','AD'));
        if(!sh){setPhase('BUILDUP');return;}
        giveB(sh);
        const atkS=(sh.s.sht+sh.s.tec*.5+irng(-10,10))*ast11.atk;
        const defS=(gk?gk.s.def+22:28+irng(-8,8))*dst11.def;
        kickTo(oppGoalX,PCY+rng(-6,6),2.2);
        logEvent(`Coup franc de ${sh.name}...`,teams[ati].color+'bb');
        setTimeout(()=>{
          if(!G.running)return;
          G.shots[ati]++;sh.mSh++;
          if(atkS>defS+8){goalScored(sh,ati,oppGoalX);}
          else{logEvent(`Coup franc repoussé !`,teams[dti].color+'88');if(gk)giveB(gk);G.atkTi=dti;setPhase('GOALKICK');}
        },580/speedMult);
        return;
      }
      case 'GOALKICK':{
        if(G.phTick<4)return;
        let gkp=byR(ati,'GB')[0];
        // Gardien de fortune si le vrai GB est hors jeu
        if(!gkp){
          gkp=actP(ati).find(p=>p.pos==='DC'||p.pos==='DCD'||p.pos==='DCG');
          if(gkp){
            if(typeof applyEmergencyGKMalus==='function') applyEmergencyGKMalus(gkp);
            logEvent(`🧤 ${gkp.name} en gardien de fortune !`,'#f0c028');
          }
        }
        const recv=pick(byR(ati,'MC','MDC','ATT','MO','AG','AD'));
        if(recv){kickToP(gkp||recv,recv,2.2);logEvent(`Dégagement pour ${recv.name}`,teams[ati].color+'66');}
        setPhase('BUILDUP');return;
      }
    }
    return; // fin IA 11v11
  }
  // ── Fin IA 11v11 ─────────────────────────────────────────────────

  const ast=strat(ati),dst=strat(dti);
  const carrier=ownerP()||pick(byR(ati,'ATT','MO','MC'))||pick(ap);

  // Gardien porteur en jeu ouvert → dégagement immédiat
  if(carrier&&carrier.pos==='GB'&&G.phase!=='GOALKICK'&&G.phase!=='PENALTY_KICK'&&G.phase!=='KICKOFF'){
    // Le gardien peut TENTER un sort de tir légendaire (ex : Tir Céleste) au
    // lieu de simplement dégager — mais c'est un événement RARE, encadré :
    //  • uniquement des sorts de tir puissants (pas les buffs/malus),
    //  • assez de MP,
    //  • cooldown dédié par équipe (≈25 s) pour éviter tout spam,
    //  • faible probabilité même quand tout est réuni.
    if(!G._gkSpellCool)G._gkSpellCool=[0,0];
    const gkShotSpells=(carrier.spells||[]).filter(sid=>{
      const sp=SPELLS.find(x=>x.id===sid);
      return sp&&ATTACK_SPELLS.has(sid)&&sp.pow>=40&&carrier.mp>=sp.mp;
    });
    if(gkShotSpells.length && G._gkSpellCool[ati]<=0 && Math.random()<0.09){
      const sp=SPELLS.find(x=>x.id===pick(gkShotSpells));
      G._gkSpellCool[ati]=9; // cooldown court façon Inazuma : ~9 s entre deux tentatives
      logEvent(`🧤✨ Le gardien ${carrier.name} tente l'impensable...`,teams[ati].color);
      doSpell(carrier,ati,dti,sp,ati===0?WW:0);
      return;
    }
    G.atkTi=ati;
    setPhase('GOALKICK');
    return;
  }
  // En 11v11, inclure les postes supplémentaires dans les sélections
  const defRoles = window.gameMode==='11v11'
    ? ['DD','DC','DG','MDC','MDC2','DCD','DCG','LB','RB']
    : ['DD','DC','DG','MDC'];
  const midRoles = window.gameMode==='11v11'
    ? ['MC','MDC','MO','MCD','MCG','MOG','MOD']
    : ['MC','MDC','MO','MOG','MOD'];
  const attRoles = window.gameMode==='11v11'
    ? ['ATT','MO','AG','AD','ATT2']
    : ['ATT','MO','MOG','MOD'];
  const opp=pick(byR(dti,...defRoles))||pick(dp);
  const gk=byR(dti,'GB')[0];
  const oppGoalX=ati===0?WW:0;
  const fwd=ati===0?1:-1;

  // Spell?
  let spell=null;
  if(carrier&&carrier.mp>10){
    const inAttack=G.phase==='ATTACK';
    const inBuildup=G.phase==='BUILDUP';
    if(inAttack||inBuildup){
      for(const sid of (carrier.spells||[])){
        const sp=SPELLS.find(x=>x.id===sid);
        if(!sp||carrier.mp<sp.mp)continue;
        const canFire=(inAttack&&ATTACK_SPELLS.has(sp.id))
                    ||(SUPPORT_SPELLS.has(sp.id)&&(inAttack||inBuildup));
        // La technique du lanceur influence la fréquence de déclenchement :
        // un technicien (tec 90) déclenche ~+30% plus souvent, un maladroit
        // (tec 20) ~-15%. Neutre à tec 50.
        const tecTrig=Math.max(0.8,Math.min(1.4,1+((carrier.s?.tec??50)-50)/130));
        // Les sorts PEU IMPACTANTS (faible coût MP) se lancent plus souvent :
        // ils sont mineurs, autant qu'ils sortent régulièrement. Les gros sorts
        // (dragon, invocations...) restent rares. mp 10 → ×1.6, mp 25 → ×1.0,
        // mp 45+ → ×0.7.
        const costMul=Math.max(0.7,Math.min(1.8,1+(25-(sp.mp||20))/28));
        const mentaMul=mentalitySpellMult(ati,ATTACK_SPELLS.has(sp.id));
        if(canFire&&Math.random()<sp.prob*(5.0+Math.max(0,carrier._fm||0)*0.20)*tecTrig*costMul*mentaMul){spell=sp;break;}
      }
    }
  }

  // ── Dragon : tir de feu AUTOMATIQUE quand le porteur transformé attaque ──
  // Un joueur sous Transformation Dragon déclenche périodiquement un tir de feu
  // dès qu'il a le ballon dans le camp adverse — sans consommer de MP.
  if(!spell && carrier && carrier.hasBall && carrier._dragon>0){
    const inOppHalf = ati===0 ? carrier.x>PCX : carrier.x<PCX;
    if(inOppHalf){
      if(!G._dragonFireCool)G._dragonFireCool={};
      const cd=G._dragonFireCool[carrier.id]||0;
      if(cd<=0 && Math.random()<0.05){
        G._dragonFireCool[carrier.id]=1.4; // ~1.4s entre deux tirs de feu auto
        const fireSp=SPELLS.find(x=>x.id==='fire');
        if(fireSp){const mpBefore=carrier.mp;doSpell(carrier,ati,dti,fireSp,oppGoalX);carrier.mp=mpBefore;return;} // tir gratuit (transformation)
      }
    }
  }
  if(G._dragonFireCool){for(const k in G._dragonFireCool){G._dragonFireCool[k]=Math.max(0,G._dragonFireCool[k]-dt);}}


  // Un buff (soigner les siens) ou un debuff (ralentir l'adversaire) ne
  // nécessite pas de porter le ballon : n'importe quel joueur des DEUX équipes
  // peut le lancer, y compris en défendant. Seuls les sorts de TIR restent
  // liés à la possession (il faut le ballon pour tirer).
  if(!G._offBallCastCool)G._offBallCastCool=[0,0];
  G._offBallCastCool[0]=Math.max(0,G._offBallCastCool[0]-dt);
  G._offBallCastCool[1]=Math.max(0,G._offBallCastCool[1]-dt);
  if(G.phase==='ATTACK'||G.phase==='BUILDUP'||G.phase==='TRANSITION'){
    [0,1].forEach(ti2=>{
      if(G._offBallCastCool[ti2]>0)return;
      const dti2=1-ti2;
      // Candidats : joueurs actifs, hors porteur du ballon (déjà géré ailleurs),
      // avec assez de MP et au moins un sort de soutien/malus (non-tir).
      const casters=actP(ti2).filter(p=>!p.hasBall&&p.mp>10&&p.stunT<=0&&!(p._dominated>0)&&(p.spells||[]).some(sid=>{
        const sp=SPELLS.find(x=>x.id===sid);
        return sp&&!ATTACK_SPELLS.has(sid)&&p.mp>=sp.mp;
      }));
      if(!casters.length)return;
      const caster=pick(casters);
      const castable=(caster.spells||[]).map(sid=>SPELLS.find(x=>x.id===sid)).filter(sp=>sp&&!ATTACK_SPELLS.has(sp.id)&&caster.mp>=sp.mp);
      for(const sp of castable){
        const tecTrig2=Math.max(0.8,Math.min(1.4,1+((caster.s?.tec??50)-50)/130));
        const costMul2=Math.max(0.7,Math.min(1.8,1+(25-(sp.mp||20))/28));
        const mentaMul2=mentalitySpellMult(ti2,false); // sorts hors-ballon = toujours soutien/malus
        if(Math.random()<sp.prob*0.15*tecTrig2*costMul2*mentaMul2*dt*60){
          G._offBallCastCool[ti2]=7; // ~7 s entre deux sorts hors ballon par équipe
          // Si l'équipe qui lance ne possède PAS le ballon, on protège l'état de
          // jeu (possession + phase) : un buff/malus défensif ne doit pas voler
          // le ballon ni forcer une phase d'attaque via les effets de bord du sort.
          const casterHasPossession=(G.atkTi===ti2);
          const savedOwner=G.owner, savedPhase=G.phase, savedAtk=G.atkTi;
          doSpell(caster,ti2,dti2,sp,ti2===0?WW:0);
          if(!casterHasPossession){
            if(G.owner!==savedOwner){ // le sort a touché à la possession → on restaure
              allP().forEach(q=>q.hasBall=false);
              G.owner=savedOwner;
              const ow=ownerP(); if(ow)ow.hasBall=true;
            }
            G.atkTi=savedAtk;
            if(G.phase!==savedPhase)setPhase(savedPhase);
          }
          break;
        }
      }
    });
  }

  // ── Substitutions IA en 11v11 ────────────────────────────────────────
  // L'IA gère ses 3 changements intelligemment : sort les joueurs épuisés
  // ou blessés si elle a encore des changements disponibles
  if(window.gameMode==='11v11' && G.phase !== 'KICKOFF' && G.half >= 1 && G.minute > 20){
    [0,1].forEach(function(ti){
      // IA seulement (pas l'équipe du joueur humain en mode carrière)
      if(!canSub11v11(ti)) return;
      // Chercher un joueur très fatigué ou légèrement blessé
      const outIdx = teams[ti].players.findIndex(function(p, i){
        if(!p || p.pos==='GB' || p.subbedOut) return false;
        const tired = p.hp < 20; // très fatigué
        const lightInj = p.injLevel === 1 && G.minute > 60; // blessé léger en 2e mi
        return tired || lightInj;
      });
      if(outIdx < 0) return;
      const freshBi = teams[ti].bench.findIndex(function(b){
        return b && b.onBench && !b.subbedOut && (b.injLevel||0) === 0 && b.hp > 60;
      });
      if(freshBi < 0) return;
      // Probabilité faible pour éviter spam (1 substitution max toutes les ~30 secondes)
      if(Math.random() < dt * 0.03){
        doSub(ti, outIdx, freshBi, 'bench');
      }
    });
  }

  // DD/DG — montées latérales (1x par frame max via dt pour éviter le spam)
  if(G.phase==='ATTACK'||G.phase==='BUILDUP'){
    [0,1].forEach(t=>{
      const myS=strat(t);
      if(G.atkTi!==t) return;
      actP(t).forEach(p=>{
        if((p.pos==='DD'||p.pos==='DG')&&!p.hasBall&&p.runT<=0&&p.runCool<=0){
          const ballAhead=t===0?G.ball.x>p.x-4:G.ball.x<p.x+4;
          const overlapProb=dt*0.8*(1+(myS.press||.5)*1.5)*(myS.runFreq||1);
          if(ballAhead&&Math.random()<overlapProb){
            p.runT=2.0+Math.random()*1.5;
            p.runCool=(5+Math.random()*4)/(myS.runFreq||1);
            const oppGX=t===0?WW:0;
            const sideMul=p.pos==='DD'?1:-1;
            p.runTx=clamp(oppGX+(t===0?-rng(8,22):rng(8,22)),4,WW-4);
            p.runTy=clamp(PCY+sideMul*(WH*.35+rng(0,4)),3,WH-3);
            logEvent(`🏃 ${p.name} déborde !`,teams[t].color+'99');
          }
        }
      });
    });
  }

  switch(G.phase){
    case 'KICKOFF':{
      if(G.phTick<2)return;
      const kicker=pick(byR(ati,'ATT','MO','MC'));
      if(kicker){kicker.x=PCX+(Math.random()-.5)*1.5;kicker.y=PCY+(Math.random()-.5)*1.5;giveB(kicker);}
      logEvent(`Coup d'envoi — ${teams[ati].name} !`,teams[ati].color);
      G._kickoffBuild=0; // compteur de phases BUILDUP forcées après le coup d'envoi
      setPhase('BUILDUP');break;
    }
    case 'BUILDUP':{
      if(!carrier)return;
      // Forcer au moins 3 passes de construction après le coup d'envoi
      if(G._kickoffBuild!==undefined&&G._kickoffBuild<3){
        G._kickoffBuild++;
        const mid=pick(byR(ati,'MC','MDC','MO','DC').filter(p=>!p.hasBall&&!p.stunT));
        if(mid){kickToP(carrier,mid,1.4);logEvent(`${carrier.name} → ${mid.name}`,teams[ati].color+'55');}
        return;
      }
      // Support spells can fire from buildup
      if(spell&&SUPPORT_SPELLS.has(spell.id)){doSpell(carrier,ati,dti,spell,oppGoalX);return;}
      const r=Math.random();
      if(r<.22){
        const midPool = window.gameMode==='11v11'
          ? byR(ati,'MC','MDC','MO','MCD','MCG','MDC2').filter(p=>!p.hasBall&&!p.stunT)
          : byR(ati,'MC','MDC','MO','MOG','MOD').filter(p=>!p.hasBall&&!p.stunT);
        const mid=(typeof pickTactical==='function')?pickTactical(carrier,ati,midPool):pick(midPool);
        if(mid){kickToP(carrier,mid,1.5);logEvent(`${carrier.name} → ${mid.name}`,teams[ati].color+'aa');}
      } else if(r<.38){
        const fwdPool = window.gameMode==='11v11'
          ? byR(ati,'ATT','ATT2','MO','AG','AD')
          : byR(ati,'ATT','MO','MOG','MOD');
        const fwdP=(typeof pickTactical==='function')?pickTactical(carrier,ati,fwdPool):pick(fwdPool);
        if(fwdP){kickToP(carrier,fwdP,2.0);logEvent(`Long ballon pour ${fwdP.name} !`,teams[ati].color+'cc');setPhase('ATTACK');}
      } else if(r<.52){
        setPhase('ATTACK');
      } else if(r<.66){
        const inter=pick(byR(dti,'MC','MDC','DD').filter(p=>!p.stunT));
        if(inter){
          freeB();
          setTimeout(()=>{if(G.running&&!inter.red&&inter.hp>0){giveB(inter);G.atkTi=dti;setPhase('TRANSITION');}},180/speedMult);
          logEvent(`Interception de ${inter.name} !`,teams[dti].color);
        }
      } else {
        const circPool=ap.filter(p=>!p.hasBall);
        const p2=(typeof pickTactical==='function')?pickTactical(carrier,ati,circPool):pick(circPool);
        if(p2){kickToP(carrier,p2,1.2);logEvent(`${teams[ati].name} fait circuler`,teams[ati].color+'55');}
      }
      break;
    }
    case 'ATTACK':{
      if(!carrier){setPhase('BUILDUP');return;}
      // DD/DG en débordement avec la balle → centrer ou tirer
      if((carrier.pos==='DD'||carrier.pos==='DG')&&carrier.runT>0){
        const distToGoal=Math.abs(carrier.x-oppGoalX);
        if(distToGoal<22){
          // Assez près pour centrer/tirer
          const target=pick(byR(ati,'ATT','MO','MOG','MOD'));
          if(target&&Math.random()<0.55){
            kickToP(carrier,target,2.2);
            logEvent(`↪ Centre de ${carrier.name} !`,teams[ati].color+'cc');
            setPhase('ATTACK');
          } else {
            doShot(carrier,ati,dti,opp,gk,oppGoalX);
            logEvent(`${carrier.name} tire depuis le côté !`,teams[ati].color);
          }
          carrier.runT=0; return;
        }
      }
      if(spell){doSpell(carrier,ati,dti,spell,oppGoalX);return;}
      const r=Math.random();
      // Fréquence de tir modulée par le rapport de force : une équipe nettement
      // supérieure se crée PLUS d'occasions (elle arrive mieux à se mettre en
      // position de frappe), pas seulement une meilleure conversion par tir.
      // GARDE-FOU : on ne tire que depuis une distance crédible du but adverse.
      // Avant, un porteur pouvait déclencher une frappe depuis sa propre moitié
      // (surtout sur le grand terrain 11v11) et marquer — désormais interdit.
      const _distGoal=Math.abs(carrier.x-oppGoalX);
      // TRAITS : "Tire de loin" élargit la zone de frappe ; "Renard" resserre
      // (ne tire que près du but) ; "Ne tire jamais" annule la frappe.
      const _HT=(tid)=>(typeof hasTrait==='function'&&hasTrait(carrier,tid));

      // ── TENDANCE PAR POSTE ───────────────────────────────────────────
      // Chaque poste a une propension différente à tirer / dribbler / passer.
      // Un défenseur central sécurise (passe++, tir/dribble--) ; un milieu
      // récupérateur/relayeur distribue énormément ; un attaquant tente sa
      // chance (tir/dribble++). Valeurs = multiplicateurs.
      const _POS_TEND = {
        GB:  {shoot:0.02, drib:0.05, pass:1.7},
        DC:  {shoot:0.25, drib:0.35, pass:1.6},  DCD:{shoot:0.25,drib:0.35,pass:1.6}, DCG:{shoot:0.25,drib:0.35,pass:1.6},
        DD:  {shoot:0.45, drib:0.80, pass:1.4},  DG:{shoot:0.45,drib:0.80,pass:1.4}, LB:{shoot:0.45,drib:0.80,pass:1.4}, RB:{shoot:0.45,drib:0.80,pass:1.4},
        MDC: {shoot:0.55, drib:0.60, pass:1.7},  MDC2:{shoot:0.55,drib:0.60,pass:1.7},
        MC:  {shoot:0.85, drib:0.90, pass:1.5},  MCD:{shoot:0.85,drib:0.90,pass:1.5}, MCG:{shoot:0.85,drib:0.90,pass:1.5},
        MO:  {shoot:1.15, drib:1.25, pass:1.25}, MOG:{shoot:1.0,drib:1.35,pass:1.2}, MOD:{shoot:1.0,drib:1.35,pass:1.2},
        AG:  {shoot:1.15, drib:1.5,  pass:1.05}, AD:{shoot:1.15,drib:1.5,pass:1.05},
        ATT: {shoot:1.5,  drib:1.2,  pass:0.9},  ATT2:{shoot:1.5,drib:1.2,pass:0.9},
      };
      const _tend = _POS_TEND[carrier.pos] || {shoot:1, drib:1, pass:1.2};

      // ── STYLE TACTIQUE ───────────────────────────────────────────────
      // possession = beaucoup de passes courtes (conservation) ; direct = plus
      // de tirs/verticalité ; counter = vertical rapide ; normal = neutre.
      const _style = (strat(ati).style)||'normal';
      const _STYLE_TEND = {
        possession: {shoot:0.75, drib:0.85, pass:1.55},
        direct:     {shoot:1.30, drib:1.05, pass:0.80},
        counter:    {shoot:1.20, drib:1.15, pass:0.85},
        normal:     {shoot:1.00, drib:1.00, pass:1.00},
      }[_style] || {shoot:1,drib:1,pass:1};

      // TRAITS : "Tire de loin" élargit la zone de frappe ; "Renard" resserre ;
      // "Ne tire jamais" annule la frappe.
      let _rangeMul = 0.42;
      if(_HT('tire_loin')) _rangeMul = 0.58;
      if(_HT('renard'))    _rangeMul = 0.30;
      const _shootRange=WW*_rangeMul;
      const canShoot=_distGoal<_shootRange && !_HT('ne_tire_jamais');

      let _shootFreq = 0.22 * _tend.shoot * _STYLE_TEND.shoot;
      if(_HT('renard')||_HT('sang_froid')) _shootFreq += 0.06;
      if(_HT('ne_tire_jamais')) _shootFreq = 0;
      const shootBase=(canShoot?_shootFreq:0)*_attackEdge(ati,dti);
      // Fenêtre de dribble selon poste + style + trait
      let _dribWindow = 0.14 * _tend.drib * _STYLE_TEND.drib;
      if(_HT('dribbleur')) _dribWindow = Math.max(_dribWindow, 0.26);
      // Fenêtre de PASSE : base 0.42 modulée par le poste et le style. Un MDC en
      // possession passe énormément ; un ATT en jeu direct passe peu.
      let _passWindow = 0.42 * _tend.pass * _STYLE_TEND.pass;
      _passWindow = Math.max(0.15, Math.min(0.75, _passWindow));
      if(r<shootBase){
        doShot(carrier,ati,dti,opp,gk,oppGoalX);
      } else if(r<shootBase+_dribWindow){
        // Dribble — speed matters significantly (winger blowing past defender), fatigue penalizes both
        // Confrontation : Technique+Vitesse du porteur vs Défense+Vitesse du défenseur
        // Large écart de randomisation = parfois le faible passe, parfois le fort rate
        const _Sd=(p,k)=>(typeof statOf==='function'?statOf(p,k):(p&&p.s&&p.s[k]!=null?p.s[k]:50));
        const atkSpd  = _Sd(carrier,'spd');
        const atkTec  = _Sd(carrier,'tec');
        const defDef  = opp ? _Sd(opp,'def') : 30;
        const defSpd  = opp ? _Sd(opp,'spd') : 30;
        // Score dribble : combinaison tec+vitesse avec bruit élevé (football ≠ maths)
        const atkD=(atkTec*0.6+atkSpd*0.4+irng(-15,15))*ast.atk*fatMul(carrier)*(carrier._invis>0?3.5:1);
        // Score défense : def+vitesse pour couper la trajectoire
        const defD=(opp?(defDef*0.55+defSpd*0.45+irng(-15,15))*fatMul(opp):25+irng(-15,15))*dst.def;
        // Probabilité de succès basée sur le ratio (pas juste atkD>defD)
        const dribProb=(()=>{
          const r=Math.max(0.1,atkD)/Math.max(0.1,defD);
          return Math.min(0.82,Math.max(0.12, 0.35+Math.log(r)*0.28));
        })();
        spawnTackle(G.ball.x,G.ball.y);
        if(Math.random()<dribProb){
          carrier.mTk++; // reuse mTk as dribble-success counter
          // Spawn skill move particles — purple trail burst
          const MOVES=['Roulette','Elastico','Crochet','Step-over','Feinte','Sombrero','Rabona'];
          const moveName=MOVES[~~(Math.random()*MOVES.length)];
          for(let i=0;i<20;i++){
            const a=Math.random()*Math.PI*2,s=rng(.5,1.8);
            G.ptcl.push({t:'s',x:carrier.x,y:carrier.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
              l:35,m:35,col:pick(['#8840e0','#d090ff','#f0c028','#fff']),sz:rng(.2,.55)});
          }
          G.ptcl.push({t:'ring_expand',x:carrier.x,y:carrier.y,col:'#8840e0',maxR:4,l:22,m:22});
          G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-3,tx:'⚡ '+moveName,col:'#d090ff',l:52,m:52,sz:1.5});
          logEvent(`🌀 ${carrier.name} — ${moveName} sur ${opp?.name||'défenseur'} !`,'#d090ff');
        } else {
          G.tackles[dti]++;
          if(opp){giveB(opp);G.atkTi=dti;}
          // Tackle injury chance for the carrier
          if(carrier&&Math.random()<0.12*(1-carrier.s.res/99))injurePlayer(ati,carrier,true);
          logEvent(`${opp?.name||''} tacle ${carrier.name} !`,teams[dti].color);
          setPhase('TRANSITION');
        }
      } else if(r<shootBase+_dribWindow+_passWindow){
        // ── PASSE (dominante) : le porteur cherche le meilleur relais ────────
        // Grosse fenêtre (42%) pour un jeu de passes fluide. On vise en priorité
        // un coéquipier démarqué vers l'avant ; sinon on recycle en sécurité.
        const _tacDec = (typeof tacticalPassDecision==='function') ? tacticalPassDecision(carrier,ati) : null;
        const tgt = _tacDec ? _tacDec.target : ((typeof bestPassTarget==='function') ? bestPassTarget(carrier,ati,{forward:true}) : null);
        // Traits : "Passes en profondeur" cherche loin devant ; "Une-deux" joue vite/court.
        const _HT2=(tid)=>(typeof hasTrait==='function'&&hasTrait(carrier,tid));
        if(tgt){
          const prog = ati===0 ? (tgt.x-carrier.x) : (carrier.x-tgt.x);
          const deep = _HT2('passe_prof') && prog>WW*0.12;
          const spd = deep ? 2.2 : (prog>WW*0.08 ? 1.7 : 1.1);
          kickToP(carrier,tgt,spd);
          if(_tacDec && _tacDec.kind==='third_man_setup'){
            logEvent(`${carrier.name} → ${tgt.name}, en une touche pour ${_tacDec.follow.name} !`,teams[ati].color+'cc');
            setPhase('ATTACK');
          } else if(_tacDec && _tacDec.kind==='switch'){
            logEvent(`↔ Renversement de ${carrier.name} → ${tgt.name} !`,teams[ati].color+'cc');
            setPhase('ATTACK');
          } else if(prog>WW*0.10){ logEvent(`${carrier.name} → ${tgt.name}`,teams[ati].color+'aa'); setPhase('ATTACK'); }
          else { logEvent(`${carrier.name} temporise → ${tgt.name}`,teams[ati].color+'55'); setPhase('BUILDUP'); }
        } else {
          // Personne de démarqué : passe de sécurité vers un milieu/défenseur
          const safe=pick(byR(ati,'MC','MDC','DC','DD','DG').filter(p=>!p.hasBall));
          if(safe){ kickToP(carrier,safe,1.0); setPhase('BUILDUP'); }
          else setPhase('BUILDUP');
        }
      } else if(r<shootBase+_dribWindow+_passWindow+0.12){
        // ── DUEL PERDU : le porteur se fait presser et perd le ballon ────────
        // (nettement réduit vs avant, et seulement si un adversaire est proche)
        // Le trigger tactique (dos au but, ligne de touche, technique faible,
        // endurance/agressivité du défenseur…) élargit légèrement la portée
        // d'un pressing qui "paie" sans changer le comportement par défaut.
        const _pTrig=(typeof shouldPress==='function')?shouldPress(opp,carrier,dti,ati):null;
        const _oppDist=opp?Math.hypot(opp.x-carrier.x,opp.y-carrier.y):1e9;
        if(opp && (_oppDist<6 || (_pTrig && _pTrig.press && _oppDist<9))){
          G.tackles[dti]++;
          freeB();
          setTimeout(()=>{if(G.running&&opp&&!opp.red&&opp.hp>0){giveB(opp);G.atkTi=dti;setPhase('TRANSITION');}},160/speedMult);
          logEvent(`${opp.name} récupère le ballon !`,teams[dti].color);
        } else {
          // Pas de pressing proche → on garde et on avance
          setPhase('ATTACK');
        }
      } else {
        // ── FAUTE SUBIE (rare) : coup franc pour l'équipe en possession ──────
        G.fouls[dti]++;
        if(opp)opp.stunT=irng(4,7);
        spawnTackle(G.ball.x,G.ball.y);
        if(carrier&&Math.random()<0.10*(1-carrier.s.res/99))injurePlayer(ati,carrier,true);
        const cr=Math.random();
        if(cr<.08&&opp){
          opp.yc++;
          if(opp.yc>=2&&!hasRed(dti)){opp.red=true;logEvent(`🟥 ${opp.name} EXPULSÉ ! (équipe à 6)`,'#e02030');}else if(opp.yc>=2){logEvent(`🟨 ${opp.name} — 2e jaune (limite atteinte)`,'#f0c028');}
          else logEvent(`🟨 Carton jaune — ${opp.name}`,'#f0c028');
        } else logEvent(`Faute sur ${carrier.name}`,'#f0c028');
        setPhase('FREEKICK');
      }
      break;
    }
    case 'TRANSITION':{
      if(G.phTick<3)return;
      const car2=ownerP()||pick(byR(ati,'MC','MDC','DD','DC'));
      if(!car2){setPhase('BUILDUP');return;}
      logEvent(`${teams[ati].name} en contre-attaque !`,teams[ati].color);
      setPhase(Math.random()<.6?'ATTACK':'BUILDUP');
      break;
    }
    case 'CORNER':{
      if(G.phTick<5)return;
      const kicker=pick(byR(ati,'MC','MO','ATT'));
      const header=pick(byR(ati,'ATT','DC').filter(p=>!p.hasBall));
      if(!kicker||!header){setPhase('BUILDUP');return;}
      const cx=oppGoalX+(ati===0?rng(-14,-1):rng(1,14));
      const cy=PCY+rng(-8,8);
      kickTo(cx,cy,1.5);
      logEvent(`Corner de ${kicker.name}...`,teams[ati].color+'bb');
      setTimeout(()=>{
        if(!G.running||G.phase==='HALFTIME'||G.phase==='END')return;
        if(Math.random()<.45){giveB(header);setTimeout(()=>{if(G.running&&G.phase!=='HALFTIME'&&G.phase!=='END')doShot(header,ati,dti,opp,gk,oppGoalX);},280/speedMult);}
        else{if(gk){giveB(gk);G.atkTi=dti;}setPhase('GOALKICK');}
      },650/speedMult);
      break;
    }
    case 'PENALTY_KICK':{
      if(G.phTick<8)return;
      const kicker=ownerP()||pick(byR(ati,'ATT','MO','MC'));
      if(!kicker){setPhase('BUILDUP');return;}
      if(kicker.stunT>0) kicker.stunT=0; // un pénalty force le tireur à se relever
      const scored=Math.random()<Math.min(0.97,Math.max(0.20,(0.55+((kicker.s.sht+(kicker._hm||0))/99)*.35-((gk?(gk.s.def+(gk._hm||0)):50)/99)*.20)));
      G.shots[ati]++;kicker.mSh++;
      kickTo(oppGoalX,PCY+rng(-3,3),3.0);
      logEvent(`⚡ Pénalty de ${kicker.name}...`,teams[ati].color);
      setTimeout(()=>{
        if(!G.running)return;
        if(scored){goalScored(kicker,ati,oppGoalX,null);}
        else{logEvent(`🧤 Arrêt de ${gk?.name||'GB'} !`,teams[dti].color);if(gk)giveB(gk);G.atkTi=dti;setPhase('GOALKICK');}
      },500/speedMult);
      break;
    }
    case 'FREEKICK':{
      if(G.phTick<5)return;
      // Constituer le mur au tout début de la phase : les 2-3 défenseurs les
      // plus proches de l'axe ballon→but du camp défenseur s'alignent.
      if(!G._fkWall){
        const cand=teams[dti].players.filter(d=>!d.red&&d.hp>0&&d.pos!=='GB');
        cand.sort((a,b)=>Math.hypot(a.x-G.ball.x,a.y-G.ball.y)-Math.hypot(b.x-G.ball.x,b.y-G.ball.y));
        const n=Math.min(3,Math.max(2,cand.length>=4?3:2));
        G._fkWall=cand.slice(0,n).map(d=>d.id);
      }
      // Le meilleur tireur de coup franc s'en charge (technique + tir), pas un
      // joueur au hasard — ainsi avoir un spécialiste dans l'équipe compte.
      const fkCand=byR(ati,'ATT','MC','MO','MOG','MOD','MDC');
      const sh=fkCand.length?fkCand.reduce((b,p)=>((p.s.tec*1.2+p.s.sht)>(b.s.tec*1.2+b.s.sht)?p:b)):null;
      if(!sh){setPhase('BUILDUP');G._fkWall=null;return;}
      giveB(sh);
      // Le tir arrêté est techniquement aidé (placement) mais fait face au MUR
      // (les défenseurs réellement alignés) et au gardien : un peu plus dur
      // qu'un tir en action, comme dans la réalité.
      const wallPl=(G._fkWall||[]).map(id=>teams[dti].players.find(d=>d.id===id)).filter(Boolean);
      const wallDef=wallPl.reduce((s,d)=>s+d.s.def*fatMul(d),0)*0.22; // contribution du mur
      // La technique du tireur est DÉTERMINANTE sur coup franc : un spécialiste
      // passe le mur et marque souvent, un mauvais tireur n'a quasi aucune
      // chance. Le tir (sht) et surtout la technique (tec) pèsent lourd.
      const atkS=((sh.s.sht+(sh._hm||0))+sh.s.tec*.70+irng(-10,10))*ast.atk*fatMul(sh);
      const defS=((gk?gk.s.def*fatMul(gk):50+irng(-8,8))+wallDef)*dst.def*1.08;
      kickTo(oppGoalX,PCY+rng(-5.5,5.5),2.2);
      logEvent(`Coup franc de ${sh.name}...`,teams[ati].color+'bb');
      setTimeout(()=>{
        if(!G.running)return;
        G.shots[ati]++;sh.mSh++;
        G._fkWall=null; // le mur se dissout une fois le coup franc tiré
        // Courbe raide (exposant 2.0) : creuse fortement l'écart entre bons et
        // mauvais tireurs. Plancher très bas, plafond généreux pour les élites.
        if(Math.random()<(()=>{const _a=Math.max(1,atkS),_d=Math.max(1,defS),_r=Math.pow(_a/_d,2.0);return Math.min(0.78,Math.max(0.004,0.09+(_r-1)*0.14));})()){goalScored(sh,ati,oppGoalX,G._lastPasser?.[ati]);}
        else{logEvent(`Coup franc repoussé par ${gk?.name||'GB'}`,teams[dti].color+'88');if(gk)giveB(gk);G.atkTi=dti;setPhase('GOALKICK');}
      },580/speedMult);
      break;
    }
    case 'GOALKICK':{
      if(G.phTick<4)return;
      const gkp=byR(ati,'GB')[0];
      // Placer la balle sur le gardien avant le dégagement
      if(gkp){G.ball.x=gkp.x;G.ball.y=gkp.y;G.ball.vx=0;G.ball.vy=0;G.ball.spin=0;}
      // BUG corrigé : G.teams[ati].form n'existait jamais → toujours false,
      // donc le dégagement construit du 3-2-2 ne se déclenchait jamais.
      const is322gk=teams[ati]&&teams[ati].strat==='222';
      // 3-2-2: keeper prefers short pass to defenders, then builds up
      const recv=is322gk
        ? (Math.random()<0.55
            ? pick(byR(ati,'DC','DD','DG','MC','MDC'))  // short pass
            : pick(byR(ati,'MC','MDC','MO','MOG','MOD','ATT')))       // long ball
        : pick(byR(ati,'MC','MDC','ATT'));
      const kickSpd=is322gk?2.0:2.8;
      // Style de jeu direct → long dégagement
      const myStyle=strat(ati).style||'normal';
      const finalSpd=myStyle==='direct'?3.5:myStyle==='counter'?3.2:kickSpd;
      if(recv){kickToP(gkp||recv,recv,finalSpd);G.gkCoolT=1.5;logEvent(`${is322gk?'Relance':'Dégagement'} de ${gkp?.name||'GB'} pour ${recv.name}`,teams[ati].color+'66');}
      setPhase('BUILDUP');break;
    }
  }
}

function doShot(sh,ati,dti,def2,gk,goalX){
  G.shots[ati]++;sh.mSh++;
  const ast2=strat(ati),dst2=strat(dti);
  // QUALITÉ DU TIR : puissance (sht) + finition technique (tec) + angle (spd).
  // La technique est déterminante — un joueur technique trouve la lucarne.
  const _S=(p,k)=>(typeof statOf==='function'?statOf(p,k):(p.s&&p.s[k]!=null?p.s[k]:50));
  const atkS=((_S(sh,'sht')+(sh._hm||0))*.7+(_S(sh,'tec'))*.55+(_S(sh,'spd'))*.15+irng(-10,10))*ast2.atk*fatMul(sh);
  // QUALITÉ DE L'ARRÊT : positionnement du gardien (def) + réflexes (spd) +
  // gêne d'un défenseur qui revient (def + un peu de tec pour bien se placer).
  const gkPart = gk ? ((_S(gk,'def'))*.62 + (_S(gk,'spd'))*.55)*fatMul(gk) : 50;
  const defHelp = def2 ? (( (_S(def2,'def')) + (_S(def2,'tec'))*.4 )*.15)*fatMul(def2) : 0;
  const defS=(gkPart+defHelp+irng(-8,8))*dst2.def;
  // TRAITS de finition : "Sang-froid" et "Renard" (près du but) augmentent la
  // conversion. "Homme des grands soirs" booste dans le money-time.
  let _traitShotMul=1;
  if(typeof hasTrait==='function'){
    if(hasTrait(sh,'sang_froid')) _traitShotMul*=1.15;
    if(hasTrait(sh,'renard') && Math.abs(sh.x-goalX)<WW*0.18) _traitShotMul*=1.20;
    if(hasTrait(sh,'clutch') && (G.minute||0)>=75) _traitShotMul*=1.15;
    if(hasTrait(sh,'guerrier') && (G.minute||0)>=75) _traitShotMul*=1.08;
  }
  const gy=clamp(PCY+rng(-5,5),GY1-1.5,GY2+1.5);
  // Facteur distance : plus le tireur est loin du but visé, plus la frappe est
  // difficile à cadrer/convertir. Un tir depuis sa propre moitié devient quasi
  // impossible (évite les buts absurdes de très loin, surtout en 11v11).
  const _dGoal=Math.abs(sh.x-goalX);
  const _distFactor=clamp(1 - Math.max(0,_dGoal-WW*0.18)/(WW*0.5), 0.05, 1);
  kickTo(goalX,gy,2.6);freeB();
  setTimeout(()=>{
    if(!G.running)return;
    const prob_normal=(()=>{const _a=Math.max(1,atkS),_d=Math.max(1,defS),_r=Math.pow(_a/_d,1.3);return Math.min(0.75,Math.max(0.04,(0.17+(_r-1)*0.13)*_traitShotMul))*_distFactor;})();
    if(Math.random()<prob_normal){
      goalScored(sh,ati,goalX,G._lastPasser?.[ati]);
    } else {
      const saved=Math.random()<.62;
      if(saved){
        logEvent(`Arrêt de ${gk?.name||'GB'} !`,teams[dti].color);
        if(Math.random()<.50){
          G.corners[ati]++;G.ball.x=goalX+(ati===0?-.5:.5);G.ball.y=gy;G.ball.vx=0;G.ball.vy=0;
          G.atkTi=ati;setPhase('CORNER');logEvent(`Corner pour ${teams[ati].name}`,teams[ati].color+'88');
        } else {if(gk)giveB(gk);G.atkTi=dti;setPhase('GOALKICK');}
      } else {
        logEvent(`Tir de ${sh.name} — hors cadre`,teams[ati].color+'77');G.atkTi=dti;setPhase('GOALKICK');
      }
    }
  },400/speedMult);
}

// Champs de durée (en frames) posés par les sorts, susceptibles d'être
// rallongés/raccourcis selon la technique du lanceur.
const _SPELL_DUR_FIELDS=['_spdDebuff','_atkBuff','_pacified','_sixsens','_sylvestre','_charmed','_dominated','_dragon','_auraDivine','stunT'];
function _spellDurMult(caster){
  // Technique 50 = neutre (×1). Chaque point au-dessus/en-dessous ajuste la
  // durée des effets. Un technicien (tec 90) → ~+30% ; un maladroit (tec 20)
  // → ~-15%. Borné pour rester raisonnable.
  const tec=(caster?.s?.tec)??50;
  return Math.max(0.75, Math.min(1.5, 1+(tec-50)/130));
}
function doSpell(carrier,ati,dti,sp,goalX){
  const mult=_spellDurMult(carrier);
  const complet = window.GS && window.GS.statMode==='complet';
  // En Lite sans modif de durée : chemin direct (comportement actuel).
  if(!complet && Math.abs(mult-1)<0.001){ return _doSpellRaw(carrier,ati,dti,sp,goalX); }
  // Snapshot des timers d'effet AVANT le sort, sur tous les joueurs concernés.
  const everyone=[...actP(0),...actP(1)];
  const before=new Map();
  everyone.forEach(p=>{const rec={};_SPELL_DUR_FIELDS.forEach(f=>{rec[f]=p[f]||0;});before.set(p,rec);});
  const ret=_doSpellRaw(carrier,ati,dti,sp,goalX);
  // Applique :
  //  • le multiplicateur de durée du lanceur (technique) à toute augmentation ;
  //  • la RÉSISTANCE MAGIQUE de la cible (mode Complet) : un joueur résistant
  //    subit des malus (debuffs) écourtés. On considère comme "malus" tout
  //    champ d'effet sauf les buffs positifs du lanceur.
  const POSITIVE_FIELDS = new Set(['_atkBuff','_defBuff','_aile','_sylvestre','_sixsens','_auraDivine']);
  everyone.forEach(p=>{
    const rec=before.get(p);if(!rec)return;
    const isEnemyOfCaster = (actP(dti).indexOf(p)>=0);
    let resMul = (complet && isEnemyOfCaster && typeof magResistMult==='function') ? magResistMult(p) : 1;
    // Trait "Anti-magie" : forte résistance supplémentaire aux sorts subis
    if(complet && isEnemyOfCaster && typeof hasTrait==='function' && hasTrait(p,'anti_magie')) resMul*=0.6;
    _SPELL_DUR_FIELDS.forEach(f=>{
      const now=p[f]||0, prev=rec[f]||0;
      if(now>prev){
        let inc=(now-prev)*mult;
        // Réduire seulement les malus subis par un adversaire résistant
        if(resMul!==1 && !POSITIVE_FIELDS.has(f)) inc*=resMul;
        p[f]=prev+inc;
      }
    });
  });
  return ret;
}
function _doSpellRaw(carrier,ati,dti,sp,goalX){
  // ── Attributs magiques (mode Complet, sinon neutres) ─────────────────
  // Coût en mana modulé par le "Contrôle du mana" + trait "Mage-né".
  let _mCost = (typeof magCostMult==='function') ? magCostMult(carrier) : 1;
  if(typeof hasTrait==='function' && hasTrait(carrier,'mage_ne')) _mCost*=0.75;
  carrier.mp=Math.max(0,carrier.mp-sp.mp*_mCost);carrier.mSp++;
  // Instabilité : un sort peut RATER (fizzle) — l'énergie est dépensée mais
  // le sort échoue. La maîtrise réduit ce risque ; le trait "Magie instable"
  // l'augmente.
  let _fizzle = (typeof magFizzleChance==='function') ? magFizzleChance(carrier) : 0;
  if(typeof hasTrait==='function' && hasTrait(carrier,'instable')) _fizzle=Math.max(_fizzle,0.12)+0.06;
  if(_fizzle>0 && Math.random()<_fizzle){
    if(typeof spawnSpell==='function'){ try{ spawnSpell(carrier.x,carrier.y,sp); }catch(e){} }
    if(typeof logEvent==='function') logEvent(`✨ Le sort de ${carrier.name} se dissipe… (instabilité)`, '#8840e0aa');
    if(G.ptcl) G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-4,tx:'raté !',col:'#8840e0',l:45,m:45,sz:1.0});
    // Le sort échoue : on rend la main sans effet (l'attaque continue)
    if(G.phase==='ATTACK'||G.phase==='BUILDUP'){ /* garde la possession */ }
    return;
  }
  // Puissance des sorts offensifs modulée par l'"Affinité magique".
  const _mPow = (typeof magPowerMult==='function') ? magPowerMult(carrier) : 1;

  // ── Sorts offensifs (tirs) ──────────────────────────────
  if(['fire','ice','thunder','eldritch','fireball','illusion','tech','serre'].includes(sp.id)){
    // Spawn l'animation dédiée avant le tir
    if(sp.id==='fire')spawnFire(carrier.x,carrier.y,goalX);
    else if(sp.id==='fireball')spawnFireball(carrier.x,carrier.y,goalX);
    else if(sp.id==='ice')spawnIce(carrier.x,carrier.y,goalX);
    else if(sp.id==='thunder')spawnThunder(carrier.x,carrier.y,goalX);
    else if(sp.id==='eldritch')spawnEldritch(carrier.x,carrier.y,goalX);
    else if(sp.id==='illusion')spawnIllusion(carrier.x,carrier.y,goalX);
    else if(sp.id==='tech')spawnTech(carrier.x,carrier.y,goalX);
    else spawnSpell(carrier.x,carrier.y,sp);
    const def2=pick(byR(dti,'DD','DC','DG'));
    const gk2=byR(dti,'GB')[0];
    G.shots[ati]++;carrier.mSh++;
    let atkS=((carrier.s.sht+(carrier._hm||0))+sp.pow*_mPow+irng(-8,8))*strat(ati).atk*fatMul(carrier);
    let defS=((gk2?(gk2.s.def)*fatMul(gk2):28)+(def2?def2.s.def*.2*fatMul(def2):0)+irng(-8,8))*strat(dti).def;

    // ── RÉACTION : Souffle du Dragon (Aurelthar) — 25% coupe le tir de moitié
    teams[dti].players.forEach(dp=>{
      if((dp.spells||[]).includes('souffle_dragon')&&dp.mp>=60&&Math.random()<0.25*mentalitySpellMult(dti,false)){
        dp.mp=Math.max(0,dp.mp-60);
        atkS*=0.5;
        spawnSpell(dp.x,dp.y,SPELLS.find(x=>x.id==='souffle_dragon'));
        G.ptcl.push({t:'lbl',x:dp.x,y:dp.y-5,tx:'🐉 SOUFFLE !',col:'#ff6600',l:70,m:70,sz:1.3});
        logEvent(`🐉 ${dp.name} — Souffle du Dragon ! La frappe est réduite de moitié !`,'#ff6600');
      }
    });
    // ── RÉACTION : Main Céleste (Mystique Sibéria) — 50% réduit le tir de 10%
    teams[dti].players.forEach(dp=>{
      if((dp.spells||[]).includes('main_celeste')&&dp.mp>=15&&Math.random()<0.5*mentalitySpellMult(dti,false)){
        dp.mp=Math.max(0,dp.mp-15);
        atkS*=0.9;
        spawnSpell(dp.x,dp.y,SPELLS.find(x=>x.id==='main_celeste'));
        G.ptcl.push({t:'lbl',x:dp.x,y:dp.y-5,tx:'☁️ Main Céleste',col:'#87ceeb',l:50,m:50,sz:1.1});
        logEvent(`☁️ ${dp.name} — Main Céleste ! -10% sur le tir adverse.`,'#87ceeb');
      }
    });

    // ── CONTRE SPECTACULAIRE : clash de techniques ──────────────────────
    // N'importe quel défenseur (ou le gardien) qui possède un sort de tir
    // (ATTACK_SPELLS) ou un sort réactif/bouclier peut tenter de CONTRER le
    // tir adverse en lançant sa propre technique face à celle de l'attaquant.
    // C'est volontairement RARE et purement pour le spectacle façon
    // "clash de techniques" : que ça réussisse ou non, ça s'affiche et se
    // commente en jeu. Un seul contre par tir (pas de spam).
    (function(){
      const contreCandidats=[...byR(dti,'DD','DC','DG'),...(gk2?[gk2]:[])]
        .filter(dp=>dp!==carrier)
        .sort(()=>Math.random()-.5);
      for(const dp of contreCandidats){
        const contreSpells=(dp.spells||[]).filter(sid=>{
          const s2=SPELLS.find(x=>x.id===sid);
          return s2 && (ATTACK_SPELLS.has(sid)||s2.t==='react'||s2.t==='shield') && dp.mp>=s2.mp;
        });
        if(!contreSpells.length)continue;
        const tecTrigD=Math.max(0.8,Math.min(1.4,1+((dp.s?.tec??50)-50)/130));
        const contreChance=0.06*tecTrigD*mentalitySpellMult(dti,false);
        if(Math.random()<contreChance){
          const cSp=SPELLS.find(x=>x.id===pick(contreSpells));
          dp.mp=Math.max(0,dp.mp-cSp.mp);
          // Duel de techniques : plus le contre est puissant (et le défenseur
          // solide), plus il a de chances de repousser le tir adverse.
          const contrePow=cSp.pow||8;
          const successChance=Math.min(0.75,Math.max(0.15,0.35+(contrePow-(sp.pow||10))/120+((dp.s?.def??50)-50)/200));
          const success=Math.random()<successChance;
          spawnSpell(dp.x,dp.y,cSp);
          G.ptcl.push({t:'lbl',x:dp.x,y:dp.y-7,tx:`⚔️ ${cSp.n} !`,col:cSp.col,l:75,m:75,sz:1.35});
          if(success){
            atkS*=0.30;
            logEvent(`⚔️ ${dp.name} contre avec ${cSp.n} — la technique adverse est repoussée !`,cSp.col);
          }else{
            atkS*=0.88;
            logEvent(`⚔️ ${dp.name} tente ${cSp.n} pour contrer... mais la technique adverse est trop forte !`,cSp.col+'88');
          }
          break;
        }
      }
    })();

    if(sp.id==='eldritch'){
      // Stun defenders nearby - no direct velocity override to avoid teleporting
      byR(dti,'DD','DC','DG','MC').forEach(d=>{
        if(Math.hypot(d.x-carrier.x,d.y-carrier.y)<12){
          d.stunT=irng(6,10);
          spawnSpell(d.x,d.y,sp);
        }
      });
      defS*=0.5;
    }
    if(sp.id==='illusion'){
      // Le gardien se trompe de côté — sa défense est quasi nulle
      if(gk2){gk2.ty=gk2.y+(Math.random()<.5?6:-6);}// il part du mauvais côté
      defS=Math.max(defS*0.18,1);
    }
    if(sp.id==='fireball'){
      // Zone de feu — défenseurs proches sont aussi stunés
      byR(dti,'DD','DC','DG').forEach(d=>{
        if(Math.hypot(d.x-goalX,d.y-PCY)<8){d.stunT=irng(4,7);spawnSpell(d.x,d.y,{col:'#ff4000',pc:'#ffaa00',n:'🔥'});}
      });
      atkS*=1.25;
    }
    if(sp.id==='serre'){
      // Tir tranchant très difficile à lire pour le gardien → défense réduite
      defS*=0.55;
      for(let i=0;i<10;i++)G.ptcl.push({t:'s',x:carrier.x,y:carrier.y,vx:(goalX-carrier.x)*.03+rng(-.3,.3),vy:rng(-.4,.4),l:30,m:30,col:'#ffd700',sz:.15+Math.random()*.3});
    }

    const gy=clamp(PCY+rng(-5,5),GY1-1.5,GY2+1.5);
    const scorer=carrier; // capture reference before async gap
    kickTo(goalX,gy,3.0);freeB();
    logEvent(`${scorer.name} tire — ${sp.n} !`,sp.col);
    setTimeout(()=>{
      if(!G.running)return;
      if(Math.random()<(()=>{const _a=Math.max(1,atkS),_d=Math.max(1,defS),_r=Math.pow(_a/_d,1.3);return Math.min(0.68,Math.max(0.04,0.17+(_r-1)*0.13));})()){goalScored(scorer,ati,goalX,G._lastPasser?.[ati]);}
      else{logEvent(`${sp.n} stoppé !`,teams[dti].color+'88');if(gk2)giveB(gk2);G.atkTi=dti;setPhase('GOALKICK');}
    },380/speedMult);

  // ── Mouton Ball ────────────────────────────────────────
  } else if(sp.id==='mouton'){
    spawnMouton(carrier.x,carrier.y);
    G.shots[ati]++;carrier.mSh++;
    const gk2=byR(dti,'GB')[0];
    // La balle rebondit sur 2-3 joueurs adverses avant de tenter le but
    const targets=[...byR(dti,'DD','DC','DG','MC')].sort(()=>Math.random()-.5).slice(0,irng(1,3));
    let delay=0;
    targets.forEach((t,i)=>{
      delay+=220/speedMult;
      setTimeout(()=>{
        if(!G.running)return;
        kickTo(t.x+rng(-2,2),t.y+rng(-2,2),2.5);
        t.stunT=irng(2,4);
        spawnSpell(t.x,t.y,{col:'#a0522d',pc:'#d7ccc8',n:'Rebond'});
        logEvent(`🐑 Mouton Ball rebondit sur ${t.name} !`,sp.col);
      },delay);
    });
    // Tir final après les rebonds
    const finalDelay=delay+240/speedMult;
    const moutonScorer=carrier; // capture before async
    setTimeout(()=>{
      if(!G.running)return;
      kickTo(goalX,clamp(PCY+rng(-6,6),GY1-1,GY2+1),3.2);
      const chaos=irng(-15,15);
      const atkS=(moutonScorer.s.sht+sp.pow+chaos)*strat(ati).atk;
      const defS=(gk2?(gk2.s.def)*fatMul(gk2):28)*strat(dti).def;
      logEvent(`🐑 Mouton Ball fonce vers le but !`,sp.col);
      setTimeout(()=>{
        if(!G.running)return;
        if(Math.random()<(()=>{const _a=Math.max(1,atkS),_d=Math.max(1,defS),_r=Math.pow(_a/_d,1.3);return Math.min(0.68,Math.max(0.04,0.17+(_r-1)*0.13));})()){goalScored(moutonScorer,ati,goalX);}
        else{logEvent(`🐑 Gardien attrape le mouton !`,teams[dti].color+'88');if(gk2)giveB(gk2);G.atkTi=dti;setPhase('GOALKICK');}
      },320/speedMult);
    },finalDelay);

  // ── Passe Précise ──────────────────────────────────────
  } else if(sp.id==='pass'){
    // Trouve l'attaquant le mieux placé (le plus proche du but)
    const fwd=byR(ati,'ATT','MO','MC').filter(p=>!p.hasBall);
    const best=fwd.sort((a,b)=>(Math.abs(a.x-goalX)-Math.abs(b.x-goalX)))[0]||pick(fwd)||carrier;
    if(best&&best!==carrier){
      const destX=clamp(goalX+(ati===0?-8:8),2,WW-2);
      const destY=PCY+rng(-4,4);
      spawnPass(carrier.x,carrier.y,destX,destY);
      // Move ball to destination then give possession
      kickTo(destX,destY,5.0);
      best.x=destX;best.y=destY;
      setTimeout(()=>{if(G.running)giveB(best);},60/speedMult);
      logEvent(`✨ ${carrier.name} — ${sp.n} → ${best.name} seul au but !`,sp.col);
      setPhase('ATTACK');
    } else {
      logEvent(`${carrier.name} — ${sp.n}`,sp.col);setPhase('ATTACK');
    }

  // ── Sol Glissant ───────────────────────────────────────
  } else if(sp.id==='ice2'){
    spawnIce2(ati);
    const dur=irng(8,14);
    actP(dti).forEach(p=>{
      p._spdDebuff=(p._spdDebuff||0)+dur*60;
    });
    logEvent(`🧊 ${carrier.name} — ${sp.n} ! Tous glissent !`,sp.col);
    setPhase('BUILDUP');

  // ── Suggestion Mentale — l'adversaire fuit loin du ballon ──
  } else if(sp.id==='suggest'){
    // La cible doit être un ADVERSAIRE. On prend le porteur du ballon seulement
    // s'il joue pour l'équipe adverse (sinon on ciblerait son propre camp / soi-même).
    const owner=ownerP();
    const ownerIsOpp=owner&&owner!==carrier&&actP(dti).includes(owner);
    const oTarget=(ownerIsOpp?owner:null)||pick(byR(dti,'ATT','MC','MO').filter(p=>p!==carrier));
    if(oTarget&&oTarget!==carrier){
      spawnSuggest(carrier.x,carrier.y,oTarget.x,oTarget.y);
      // Il ne comprend pas pourquoi, mais il s'éloigne du ballon (fuite) au lieu
      // d'être simplement figé : fidèle à la description du sort.
      oTarget._flee=irng(2,6)*60;
      oTarget.stunT=irng(1,2); // court instant de confusion avant de fuir
      if(oTarget.hasBall){freeB();G.atkTi=ati;const ally=pick(byR(ati,'MC','ATT').filter(p=>!p.hasBall));if(ally)giveB(ally);}
      logEvent(`🌀 ${carrier.name} — ${sp.n} → ${oTarget.name} fuit loin du ballon !`,sp.col);
      setPhase(oTarget===owner?'TRANSITION':'BUILDUP');
    } else {
      logEvent(`${carrier.name} — ${sp.n} (raté)`,sp.col);setPhase('BUILDUP');
    }

  // ── Charme ─────────────────────────────────────────────
  } else if(sp.id==='charm'){
    const tgt=pick(byR(dti,'DD','DC','DG','MC'));
    if(tgt){
      spawnCharm(carrier.x,carrier.y,tgt.x,tgt.y);
      tgt.stunT=irng(15,25);
      tgt._charmed=irng(20,35)*60;
      logEvent(`💕 ${carrier.name} — ${sp.n} → ${tgt.name} est charmé !`,sp.col);
    }
    setPhase('BUILDUP');

  // ── Tornade ────────────────────────────────────────────
  } else if(sp.id==='tornado'){
    const tornadoCarrier=carrier;
    spawnTornade(carrier.x,carrier.y);
    freeB();
    // Kick ball toward carrier, then give possession after brief delay
    kickTo(tornadoCarrier.x,tornadoCarrier.y,4.0);
    setTimeout(()=>{if(G.running){giveB(tornadoCarrier);G.atkTi=ati;}},100/speedMult);
    const affected=actP(dti).filter(p=>Math.hypot(p.x-tornadoCarrier.x,p.y-tornadoCarrier.y)<8);
    affected.forEach(p=>{ p.stunT=irng(5,9); });
    logEvent(`🌪️ ${tornadoCarrier.name} — ${sp.n} ! ${affected.length} joueur(s) emportés !`,sp.col);
    setPhase('ATTACK');

  // ── Amitié ─────────────────────────────────────────────
  } else if(sp.id==='amitie'){
    spawnAmitie(carrier.x,carrier.y);
    actP(ati).forEach(p=>{
      p._atkBuff=(p._atkBuff||0)+30*60; // 30s de temps de jeu
      p.hp=Math.min(100,p.hp+10);
    });
    logEvent(`💖 ${carrier.name} — ${sp.n} ! Toute l'équipe est galvanisée !`,sp.col);
    setPhase('BUILDUP');

  // ── Soin ───────────────────────────────────────────────
  } else if(sp.id==='soin'){
    const injured=actP(ati).filter(p=>p.injLevel>0).sort((a,b)=>b.injLevel-a.injLevel);
    const target=injured[0]||pick(actP(ati).filter(p=>p.hp<60))||pick(actP(ati));
    if(target){
      spawnSoin(target.x,target.y);
      const prevInj=target.injLevel;
      if(target.injLevel>0)target.injLevel=Math.max(0,target.injLevel-1);
      target.hp=Math.min(100,target.hp+45);
      target.injT=0;
      const msg=prevInj>0?` blessure soignée !`:` +HP !`;
      logEvent(`💚 ${carrier.name} → ${target.name}${msg}`,sp.col);
    }
    setPhase('BUILDUP');

  // ── Pacification ───────────────────────────────────────
  } else if(sp.id==='pacif'){
    const tgt=pick(byR(dti,'ATT','MC','MO','DD','DC'));
    if(tgt){
      spawnPacif(carrier.x,carrier.y,tgt.x,tgt.y);
      tgt._pacified=(tgt._pacified||0)+irng(20,40)*60;
      tgt.stunT=irng(3,6);
      logEvent(`😴 ${carrier.name} — ${sp.n} → ${tgt.name} est pacifié !`,sp.col);
    }
    setPhase('BUILDUP');

  // ── Cyclone (Élémentalisme Air) — tir + disperse défenseurs ─
  } else if(sp.id==='cyclon'){
    const gk2=byR(dti,'GB')[0];const def2=pick(byR(dti,'DD','DC','DG'));
    G.shots[ati]++;carrier.mSh++;
    // Stun tous les défenseurs proches (vent violent)
    actP(dti).forEach(p=>{if(Math.hypot(p.x-carrier.x,p.y-carrier.y)<14){p.stunT=irng(4,8);}});
    spawnCyclon(carrier.x,carrier.y,goalX);
    const scorer2=carrier;
    const atkS=((scorer2.s.sht+(scorer2._hm||0))+sp.pow+irng(-8,8))*strat(ati).atk*fatMul(scorer2);
    const defS=(gk2?(gk2.s.def)*fatMul(gk2):28)*strat(dti).def*.7;// défenseurs éparpillés
    kickTo(goalX,clamp(PCY+rng(-5,5),GY1-1,GY2+1),3.2);freeB();
    logEvent(`🌀 ${scorer2.name} — ${sp.n} !`,sp.col);
    setTimeout(()=>{if(!G.running)return;if(Math.random()<(()=>{const _a=Math.max(1,atkS),_d=Math.max(1,defS),_r=Math.pow(_a/_d,1.3);return Math.min(0.68,Math.max(0.04,0.17+(_r-1)*0.13));})())goalScored(scorer2,ati,goalX,G._lastPasser?.[ati]);else{if(gk2)giveB(gk2);G.atkTi=dti;setPhase('GOALKICK');}},350/speedMult);

  // ── Coup Télékinésique — tir invisible, gardien réagit tard ─
  } else if(sp.id==='telekib'){
    const gk2=byR(dti,'GB')[0];
    G.shots[ati]++;carrier.mSh++;
    const scorer3=carrier;
    // Balle invisible : le gardien voit la balle trop tard (-60% défense)
    const atkS=((scorer3.s.sht+(scorer3._hm||0))+sp.pow+irng(-5,5))*strat(ati).atk*fatMul(scorer3);
    const defS=(gk2?(gk2.s.def)*fatMul(gk2):28)*strat(dti).def*.6;
    freeB();
    // Pas de kickTo visible — la balle téléporte
    setTimeout(()=>{
      if(!G.running)return;
      G.ball.x=goalX;G.ball.y=clamp(PCY+rng(-4,4),GY1-1,GY2+1);
      G.ball.vx=0;G.ball.vy=0;
      spawnTelekib(goalX,PCY);
      if(Math.random()<(()=>{const _a=Math.max(1,atkS),_d=Math.max(1,defS),_r=Math.pow(_a/_d,1.3);return Math.min(0.68,Math.max(0.04,0.17+(_r-1)*0.13));})())goalScored(scorer3,ati,goalX,G._lastPasser?.[ati]);
      else{logEvent(`${sp.n} dévié !`,teams[dti].color+'88');if(gk2)giveB(gk2);G.atkTi=dti;setPhase('GOALKICK');}
    },300/speedMult);
    logEvent(`👁 ${scorer3.name} — ${sp.n} — la balle disparaît !`,sp.col);

  // ── Déluge (Élémentalisme Eau) — terrain boueux, tir ralenti ─
  } else if(sp.id==='deluge'){
    // Applique _spdDebuff à TOUT le monde (terrain détrempé) mais moins fort pour l'équipe du lanceur
    actP(dti).forEach(p=>{p._spdDebuff=(p._spdDebuff||0)+irng(6,10)*60;});
    actP(ati).forEach(p=>{p._spdDebuff=(p._spdDebuff||0)+irng(2,4)*60;});// propre équipe moins affectée
    // Tir en prime
    const gk2=byR(dti,'GB')[0];const scorer4=carrier;
    G.shots[ati]++;carrier.mSh++;
    const atkS2=((scorer4.s.sht+(scorer4._hm||0))+sp.pow+irng(-8,8))*strat(ati).atk*fatMul(scorer4);
    const defS2=(gk2?(gk2.s.def)*fatMul(gk2):28)*strat(dti).def;
    spawnDeluge(carrier.x,carrier.y);
    kickTo(goalX,clamp(PCY+rng(-5,5),GY1-1,GY2+1),2.2);freeB();
    logEvent(`🌊 ${scorer4.name} — ${sp.n} ! Terrain détrempé !`,sp.col);
    setTimeout(()=>{if(!G.running)return;if(Math.random()<(()=>{const _a=Math.max(1,atkS2),_d=Math.max(1,defS2),_r=Math.pow(_a/_d,1.3);return Math.min(0.68,Math.max(0.04,0.17+(_r-1)*0.13));})())goalScored(scorer4,ati,goalX,G._lastPasser?.[ati]);else{if(gk2)giveB(gk2);G.atkTi=dti;setPhase('GOALKICK');}},420/speedMult);

  // ── Terreur (Démonologie) — panique : l'adversaire rate son prochain tir ─
  } else if(sp.id==='terreur'){
    actP(dti).forEach(p=>{p._pacified=(p._pacified||0)+irng(12,20)*60;p.stunT=irng(2,4);});
    spawnTerreur(carrier.x,carrier.y);
    logEvent(`💀 ${carrier.name} — ${sp.n} ! L'adversaire panique !`,sp.col);
    setPhase('BUILDUP');

  // ── Épuisement (Nécromancie) — draine HP de tout l'adversaire ─
  } else if(sp.id==='epuise'){
    const casterX=carrier.x,casterY=carrier.y;
    actP(dti).forEach(p=>{
      const drain=irng(12,22);p.hp=Math.max(5,p.hp-drain);
      G.ptcl.push({t:'s',x:p.x,y:p.y,vx:(casterX-p.x)*.05,vy:(casterY-p.y)*.05,l:40,m:40,col:'#546e7a',sz:rng(.2,.5)});
    });
    // Soigne partiellement le lanceur
    carrier.hp=Math.min(100,carrier.hp+irng(8,15));
    spawnEpuise(casterX,casterY);
    logEvent(`🩸 ${carrier.name} — ${sp.n} ! Énergie aspirée !`,sp.col);
    setPhase('BUILDUP');

  // ── Malédiction (Démonologie) — malus cumulatif tec/def adversaire ─
  } else if(sp.id==='maledic'){
    const tgt=pick(byR(dti,'ATT','MC','DD','DC'));
    if(tgt){
      tgt._pacified=(tgt._pacified||0)+irng(25,45)*60;
      tgt._spdDebuff=(tgt._spdDebuff||0)+irng(8,15)*60;
      tgt.stunT=irng(3,5);
      spawnMaledic(carrier.x,carrier.y,tgt.x,tgt.y);
      logEvent(`☠️ ${carrier.name} — ${sp.n} sur ${tgt.name} !`,sp.col);
    }
    setPhase('BUILDUP');

  // ── Blizzard — version améliorée de Frappe Glacée ───────────────────
  } else if(sp.id==='blizzard'){
    const gkB=byR(dti,'GB')[0];
    G.shots[ati]++;carrier.mSh++;
    // Gèle la surface de réparation : tous les défenseurs stun
    actP(dti).forEach(p=>{if(p.x>(WW*.55)){p.stunT=irng(3,6);p._spdDebuff=(p._spdDebuff||0)+irng(6,10)*60;}});
    for(let i=0;i<28;i++) G.ptcl.push({t:'s',x:goalX+irng(-18,18),y:PCY+irng(-10,10),vx:(Math.random()-.5)*.4,vy:-Math.random()*.3,l:50,m:50,col:'#e1f5fe',sz:Math.random()*.3+.1});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-5,tx:'❄️ BLIZZARD !',col:sp.col,l:60,m:60,sz:1.5});
    const atkSB=((carrier.s.sht+(carrier._hm||0))+sp.pow+irng(-6,6))*strat(ati).atk*fatMul(carrier);
    const defSB=(gkB?(gkB.s.def)*fatMul(gkB):28)*strat(dti).def*.5;// défense gelée
    kickTo(goalX,clamp(PCY+rng(-4,4),GY1-1,GY2+1),3.5);freeB();
    logEvent(`❄️ ${carrier.name} — BLIZZARD ! Surface gelée !`,sp.col);
    setTimeout(()=>{if(!G.running)return;if(Math.random()<(()=>{const _a=Math.max(1,atkSB),_d=Math.max(1,defSB),_r=Math.pow(_a/_d,1.3);return Math.min(0.68,Math.max(0.04,0.17+(_r-1)*0.13));})())goalScored(carrier,ati,goalX,G._lastPasser?.[ati]);else{if(gkB)giveB(gkB);G.atkTi=dti;setPhase('GOALKICK');}},350/speedMult);

  // ── Séisme — version supérieure du Cyclone ───────────────────────────
  } else if(sp.id==='seisme'){
    const gkS=byR(dti,'GB')[0];
    G.shots[ati]++;carrier.mSh++;
    // Renverse TOUS les défenseurs, pas seulement les proches
    actP(dti).forEach(p=>{p.stunT=irng(5,10);p._spdDebuff=(p._spdDebuff||0)+irng(4,8)*60;});
    // Particules séisme
    for(let i=0;i<35;i++) G.ptcl.push({t:'s',x:PCX+rng(-WW*.4,WW*.4),y:PCY+rng(-WH*.4,WH*.4),vx:(Math.random()-.5)*.6,vy:(Math.random()-.5)*.6,l:45,m:45,col:pick(['#795548','#8d6e63','#a1887f','#bcaaa4']),sz:Math.random()*.4+.15});
    G.ptcl.push({t:'ring_expand',x:PCX,y:PCY,col:'#795548',maxR:WW*.5,l:50,m:50});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-5,tx:'🌍 SÉISME !',col:sp.col,l:65,m:65,sz:1.6});
    const atkSS=((carrier.s.sht+(carrier._hm||0))+sp.pow+irng(-6,6))*strat(ati).atk*fatMul(carrier);
    const defSS=(gkS?(gkS.s.def)*fatMul(gkS):28)*strat(dti).def*.4;
    kickTo(goalX,clamp(PCY+rng(-6,6),GY1-1,GY2+1),3.8);freeB();
    logEvent(`🌍 ${carrier.name} — SÉISME ! Tous à terre !`,sp.col);
    setTimeout(()=>{if(!G.running)return;if(Math.random()<(()=>{const _a=Math.max(1,atkSS),_d=Math.max(1,defSS),_r=Math.pow(_a/_d,1.3);return Math.min(0.68,Math.max(0.04,0.17+(_r-1)*0.13));})()){goalScored(carrier,ati,goalX,G._lastPasser?.[ati]);maybeInjureGKOnBigShot(dti,gkS,sp,carrier);}else{if(gkS)giveB(gkS);G.atkTi=dti;setPhase('GOALKICK');}},400/speedMult);

  // ── Domination Mentale — le joueur passe VRAIMENT sous ton contrôle ──
  } else if(sp.id==='domination'){
    const tgtD=pick(byR(dti,'ATT','MC','MO').filter(p=>!p.red));
    if(tgtD){
      spawnPacif(carrier.x,carrier.y,tgtD.x,tgtD.y);
      tgtD._pacified=(tgtD._pacified||0)+4*60;        // 4 s de flottement au moment de la prise de contrôle
      tgtD.stunT=irng(1,2);
      const dur=irng(6,10)*60;                         // 6-10 s de contrôle
      tgtD._dominated=dur;
      tgtD._dominatedBy=ati;                            // joue POUR l'équipe du lanceur
      // Il joue à contrecœur : légèrement diminué le temps du contrôle
      if(!tgtD._domDebuffApplied){
        tgtD._domSavedSht=tgtD.s.sht; tgtD._domSavedSpd=tgtD.s.spd;
        tgtD.s.sht=Math.max(15,Math.round(tgtD.s.sht*0.8));
        tgtD.s.spd=Math.max(15,Math.round(tgtD.s.spd*0.85));
        tgtD._domDebuffApplied=true;
      }
      for(let i=0;i<14;i++) G.ptcl.push({t:'s',x:tgtD.x+irng(-4,4),y:tgtD.y+irng(-3,3),vx:(Math.random()-.5)*.4,vy:-Math.random()*.5,l:40,m:40,col:sp.col,sz:.18});
      G.ptcl.push({t:'lbl',x:tgtD.x,y:tgtD.y-5,tx:'🧠 DOMINÉ !',col:sp.col,l:60,m:60,sz:1.4});
      logEvent(`🧠 ${carrier.name} — Domination Mentale ! ${tgtD.name} joue pour ${teams[ati].name} !`,sp.col);
    }
    setPhase('BUILDUP');

  // ── Stase — fige toute l'équipe adverse ──────────────────────────────
  } else if(sp.id==='stase'){
    const dur=irng(3,5)*60;
    actP(dti).forEach(p=>{p.stunT=dur;p._spdDebuff=(p._spdDebuff||0)+dur;});
    for(let i=0;i<20;i++) G.ptcl.push({t:'s',x:irng(4,WW-4),y:irng(4,WH-4),vx:0,vy:0,l:dur,m:dur,col:'#90a4ae',sz:.15});
    G.ptcl.push({t:'ring_expand',x:PCX,y:PCY,col:'#37474f',maxR:WW*.6,l:50,m:50});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-5,tx:'⏸ STASE !',col:sp.col,l:70,m:70,sz:1.5});
    logEvent(`⏸ ${carrier.name} — STASE ! Temps figé !`,sp.col);
    setPhase('ATTACK');// on profite de l'immobilité pour attaquer

  // ── Grande Malédiction — toute l'équipe adverse affaiblie ────────────
  } else if(sp.id==='maledic2'){
    actP(dti).forEach(p=>{
      p._pacified=(p._pacified||0)+irng(30,50)*60;
      p._spdDebuff=(p._spdDebuff||0)+irng(10,18)*60;
      p.stunT=irng(2,4);
      spawnMaledic(carrier.x,carrier.y,p.x,p.y);
    });
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-5,tx:'💀 GRANDE MALÉDICTION !',col:sp.col,l:70,m:70,sz:1.4});
    logEvent(`💀 ${carrier.name} — Grande Malédiction ! Toute l'équipe maudite !`,sp.col);
    setPhase('BUILDUP');

  // ── Drain Total — vide HP+MP de tous les adversaires proches ─────────
  } else if(sp.id==='epuise2'){
    const cX=carrier.x,cY=carrier.y;
    let totalDrain=0;
    actP(dti).forEach(p=>{
      const drain=irng(20,35);p.hp=Math.max(2,p.hp-drain);
      p.mp=Math.max(0,(p.mp||0)-irng(15,30));
      totalDrain+=drain;
      for(let i=0;i<6;i++) G.ptcl.push({t:'s',x:p.x,y:p.y,vx:(cX-p.x)*.06,vy:(cY-p.y)*.06,l:45,m:45,col:'#263238',sz:rng(.2,.45)});
    });
    // Soigne généreusement le lanceur
    carrier.hp=Math.min(100,carrier.hp+Math.round(totalDrain*.4));
    carrier.mp=Math.min(100,(carrier.mp||0)+Math.round(totalDrain*.2));
    spawnEpuise(cX,cY);
    G.ptcl.push({t:'lbl',x:cX,y:cY-5,tx:'🩸 DRAIN TOTAL !',col:sp.col,l:65,m:65,sz:1.4});
    logEvent(`🩸 ${carrier.name} — Drain Total ! Énergie vitale aspirée !`,sp.col);
    setPhase('BUILDUP');

  // ── Transe Chamanique — buff ATK toute l'équipe + vitesse ──
  } else if(sp.id==='transe'){
    actP(ati).forEach(p=>{
      p._atkBuff=(p._atkBuff||0)+irng(15,28)*60;
      // Légère récup endurance
      p.hp=Math.min(100,p.hp+10);
    });
    spawnTranse(carrier.x,carrier.y);
    logEvent(`🔥 ${carrier.name} — ${sp.n} ! L'équipe est en transe !`,sp.col);
    setPhase('BUILDUP');

  // ── Invisibilité (Illusion) — prochain dribble impossible à lire ─
  } else if(sp.id==='invis'){
    // Le porteur a une très haute chance de dribble sur sa prochaine action
    // On marque via un flag temporaire
    carrier._invis=(irng(2,4))*60;// frames d'invisibilité
    for(let i=0;i<20;i++){
      const a=Math.random()*Math.PI*2;
      G.ptcl.push({t:'s',x:carrier.x,y:carrier.y,vx:Math.cos(a)*rng(.2,.8),vy:Math.sin(a)*rng(.2,.8),l:35,m:35,col:'#b0bec5',sz:rng(.15,.45)});
    }
    G.ptcl.push({t:'ring_expand',x:carrier.x,y:carrier.y,col:'#eceff1',maxR:5,l:22,m:22});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-3,tx:'INVISIBLE',col:'#b0bec5',l:45,m:45,sz:1.5});
    logEvent(`👻 ${carrier.name} — ${sp.n} ! Prochain dribble imparable !`,sp.col);
    setPhase('ATTACK');

  // ── Peau de Pierre (Élémentalisme Terre) — défense renforcée ─
  } else if(sp.id==='peaupierre'){
    // Peau de Pierre : uniquement sur le lanceur, +10 résistance pendant 10-15s
    const dur_pp = irng(10,15)*60;
    carrier._atkBuff=(carrier._atkBuff||0)+dur_pp;
    carrier.s.res = Math.min(99, (carrier.s.res||0) + 10);
    setTimeout(()=>{ carrier.s.res = Math.max(0, (carrier.s.res||0) - 10); }, dur_pp/60*1000/speedMult);
    // Spawn mur de terre
    for(let i=0;i<12;i++){
      const a=i/12*Math.PI*2;
      G.ptcl.push({t:'s',x:carrier.x+Math.cos(a)*rng(1,4),y:carrier.y+Math.sin(a)*rng(.5,2.5),vx:0,vy:-.3,l:50,m:50,col:pick(['#8d6e63','#a1887f','#d7ccc8']),sz:rng(.3,.7)});
    }
    G.ptcl.push({t:'ring_expand',x:carrier.x,y:carrier.y,col:'#8d6e63',maxR:6,l:28,m:28});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-3,tx:'PEAU DE PIERRE',col:'#8d6e63',l:50,m:50,sz:1.4});
    logEvent(`🪨 ${carrier.name} — ${sp.n} ! Défense renforcée !`,sp.col);
    setPhase('BUILDUP');

  // ── Chance (Hasard) — effet aléatoire parmi tous les sorts ──
  } else if(sp.id==='chance'){
    const pool=['fire','fireball','thunder','eldritch','soin','amitie','tornado','suggest','epuise','transe','spindash','dragon','cyclon','divine','aile'];
    const pickedId=pick(pool);
    const random=SPELLS.find(x=>x.id===pickedId);
    if(random&&random.id!=='chance'&&random.id!==sp.id){
      G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-4,tx:'CHANCE: '+random.n,col:'#f9a825',l:55,m:55,sz:1.4});
      G.ptcl.push({t:'ring_expand',x:carrier.x,y:carrier.y,col:'#f9a825',maxR:7,l:28,m:28});
      logEvent(`🎲 ${carrier.name} — ${sp.n} → ${random.n} !`,'#f9a825');
      doSpell(carrier,ati,dti,random,goalX);return;// lance le sort pigé
    }
    setPhase('BUILDUP');

  // ── Hoquet (Bouletitude) — le porteur adverse rate son prochain tir ─
  } else if(sp.id==='hoquet'){
    const tgt=ownerP()&&teams[G.atkTi===dti?dti:ati]?pick(byR(dti,'ATT','MC')):pick(byR(dti,'ATT','MC'));
    if(tgt){
      tgt._pacified=(tgt._pacified||0)+irng(4,8)*60;// court debuff = 1 action
      tgt.stunT=irng(2,3);
      for(let i=0;i<8;i++)G.ptcl.push({t:'s',x:tgt.x+rng(-2,2),y:tgt.y,vx:rng(-.3,.3),vy:rng(-.5,.1),l:30,m:30,col:'#a5d6a7',sz:rng(.2,.5)});
      G.ptcl.push({t:'lbl',x:tgt.x,y:tgt.y-3,tx:'HIC!',col:'#a5d6a7',l:38,m:38,sz:1.8});
      logEvent(`🤢 ${carrier.name} — ${sp.n} sur ${tgt.name} ! Hic !`,sp.col);
    }
    setPhase('BUILDUP');
  // ── Folie (Enchantement) ─────────────────────────────────
  } else if(sp.id==='folie'){
    const tgt=pick(byR(dti,'ATT','MC','MO','DD','DC'));
    if(tgt){tgt._folie=(tgt._folie||0)+irng(8,14)*60;tgt.stunT=irng(2,3);spawnFolie(carrier.x,carrier.y,tgt.x,tgt.y);logEvent(`🌀 ${carrier.name} — ${sp.n} ! ${tgt.name} perd la raison !`,sp.col);}
    setPhase('BUILDUP');

  // ── Puissance Divine (Divination) ────────────────────────
  } else if(sp.id==='divine'){
    const tgt2=pick(actP(ati).filter(p=>!p.hasBall))||carrier;
    tgt2._atkBuff=(tgt2._atkBuff||0)+irng(35,55)*60;
    tgt2._invis=(tgt2._invis||0)+irng(4,7)*60;
    tgt2.hp=Math.min(100,tgt2.hp+35);tgt2.mp=Math.min(100,tgt2.mp+40);
    spawnDivine(carrier.x,carrier.y,tgt2.x,tgt2.y);
    logEvent(`✨ ${carrier.name} — ${sp.n} sur ${tgt2.name} ! Transcendé !`,sp.col);
    setPhase('BUILDUP');

  // ── Plaisir & Beauté (Charme) ────────────────────────────
  } else if(sp.id==='plaisir'){
    actP(ati).forEach(p=>{p._atkBuff=(p._atkBuff||0)+irng(8,16)*60;p.hp=Math.min(100,p.hp+18);p.mp=Math.min(100,p.mp+20);});
    const oAdm=pick(byR(dti,'DD','DC','DG','MC'));if(oAdm)oAdm.stunT=irng(4,7);
    spawnPlaisir(carrier.x,carrier.y);
    logEvent(`💄 ${carrier.name} — ${sp.n} ! L'équipe resplendit !`,sp.col);setPhase('BUILDUP');

  // ── Marche Sylvestre (Druidisme) ─────────────────────────
  } else if(sp.id==='sylvestre'){
    actP(ati).forEach(p=>{p._sylvestre=(p._sylvestre||0)+irng(8,14)*60;});// vitesse sylvestre
    actP(dti).forEach(p=>{p._spdDebuff=(p._spdDebuff||0)+irng(3,6)*60;});
    spawnSylvestre(carrier.x,carrier.y);
    logEvent(`🌿 ${carrier.name} — ${sp.n} ! La forêt est avec nous !`,sp.col);setPhase('BUILDUP');

  // ── Parterre de Fleurs (Druidisme) ───────────────────────
  } else if(sp.id==='fleurs'){
    const zoneX=goalX;
    actP(dti).forEach(p=>{if(Math.hypot(p.x-zoneX,p.y-PCY)<16)p._spdDebuff=(p._spdDebuff||0)+irng(14,22)*60;});
    spawnFleurs(zoneX,PCY);
    logEvent(`🌸 ${carrier.name} — ${sp.n} ! Le terrain fleurit !`,sp.col);setPhase('BUILDUP');

  // ── Sixième Sens (Télépathie) ─────────────────────────────
  } else if(sp.id==='sixsens'){
    actP(ati).filter(p=>['GB','DC','DD','DG'].includes(p.pos)).forEach(p=>{p._sixsens=(p._sixsens||0)+irng(10,18)*60;});
    spawnSixsens(carrier.x,carrier.y);
    logEvent(`👁 ${carrier.name} — ${sp.n} ! Le gardien anticipe tout !`,sp.col);setPhase('BUILDUP');

  // ── Ailes (Métamorphose) ──────────────────────────────────
  } else if(sp.id==='aile'){
    const tgt3=pick(byR(ati,'ATT','MO','MOG','MOD').filter(p=>!p.hasBall))||carrier;
    tgt3._aile=(tgt3._aile||0)+irng(14,22)*60;tgt3._atkBuff=(tgt3._atkBuff||0)+irng(10,18)*60;
    spawnAile(carrier.x,carrier.y,tgt3.x,tgt3.y);
    logEvent(`🦅 ${carrier.name} — ${sp.n} sur ${tgt3.name} ! Il s'envole !`,sp.col);setPhase('ATTACK');

  // ── Esprit-Oiseau (Chamanisme) ───────────────────────────
  } else if(sp.id==='esprit'){
    actP(ati).forEach(p=>{p._aile=(p._aile||0)+irng(6,12)*60;});
    spawnEsprit(carrier.x,carrier.y);
    logEvent(`🦜 ${carrier.name} — ${sp.n} ! L'équipe vole sur le terrain !`,sp.col);setPhase('BUILDUP');

  } else if(sp.id==='heal'){
    const h=pick(actP(ati));
    if(h){h.hp=Math.min(100,h.hp+32);spawnSoin(h.x,h.y);}
    logEvent(`${carrier.name} — ${sp.n} → +HP !`,sp.col);setPhase('BUILDUP');

  // ── Shield (legacy) ──────────────────────────────────────
  } else if(sp.id==='shield'){
    // Mur Défensif : réduit les chances de marquer pendant 6-10s (défense gardien +40%)
    const dur_sh = irng(6,10)*60;
    const gkD = byR(ati,'GB')[0];
    if(gkD){ gkD._sixsens=(gkD._sixsens||0)+dur_sh; gkD._atkBuff=(gkD._atkBuff||0)+dur_sh; }
    spawnSpell(carrier.x, carrier.y, sp);
    logEvent(`${carrier.name} — ${sp.n} ! Le but est protégé !`,sp.col);setPhase('BUILDUP');

  // ── Spin Dash ─────────────────────────────────────────────────
  } else if(sp.id==='spindash'){
    spawnSpinDash(carrier.x,carrier.y,goalX);
    byR(dti,'DD','DC','DG','MC').forEach(d=>{
      d.stunT=irng(5,9); d._spdDebuff=(d._spdDebuff||0)+irng(6,10)*60;
      for(let i=0;i<8;i++)G.ptcl.push({t:'s',x:d.x+rng(-2,2),y:d.y+rng(-1,1),vx:rng(-1.5,1.5),vy:rng(-1,0),l:25,m:25,col:'#82b1ff',sz:rng(.2,.5)});
    });
    G.shots[ati]++;carrier.mSh++;
    const gk3=byR(dti,'GB')[0];
    const atkSpin=((carrier.s.sht+(carrier._hm||0))+sp.pow+carrier.s.spd*.3+irng(-6,6))*strat(ati).atk*fatMul(carrier);
    const defSpin=((gk3?gk3.s.def*.8*fatMul(gk3):15)+irng(-5,5))*strat(dti).def;
    const gySpin=clamp(PCY+rng(-4,4),GY1-1.5,GY2+1.5);
    const spinScorer=carrier;
    kickTo(goalX,gySpin,3.5);freeB();
    logEvent(`💨 ${carrier.name} — SPIN DASH !`,sp.col);
    setTimeout(()=>{
      if(!G.running)return;
      if(Math.random()<(()=>{const _a=Math.max(1,atkSpin),_d=Math.max(1,defSpin),_r=Math.pow(_a/_d,1.3);return Math.min(0.68,Math.max(0.04,0.17+(_r-1)*0.13));})()){goalScored(spinScorer,ati,goalX);}
      else{logEvent(`Spin Dash bloqué !`,teams[dti].color+'88');if(gk3)giveB(gk3);G.atkTi=dti;setPhase('GOALKICK');}
    },350/speedMult);

  // ── Transformation Dragon ─────────────────────────────────────
  } else if(sp.id==='aura_divine'){
    // Se déclenche uniquement à la mi-temps via closeHalftime, pas en match
    actP(ati).forEach(p=>{p._auraDivine=(p._auraDivine||0)+irng(5,8)*60;});
    logEvent(`✨ ${carrier.name} — Aura Divine ! L'équipe resplendit !`,'#ffd700');
    setPhase('BUILDUP');

  } else if(sp.id==='tacle_mauvais'||sp.id==='tacle_malefique'){
    const isMal=sp.id==='tacle_malefique';
    const tgt=pick(byR(dti,'ATT','MO','MC','DC').filter(p=>Math.hypot(p.x-carrier.x,p.y-carrier.y)<12));
    if(tgt){
      carrier.yc=(carrier.yc||0)+1;
      if(carrier.yc>=2&&!hasRed(ati)){carrier.red=true;logEvent(`🟥 ${carrier.name} EXPULSÉ !`,'#e02030');}
      else logEvent(`🟨 Carton jaune — ${carrier.name}`,'#f0c028');
      if(isMal){tgt.injLevel=3;tgt.injT=irng(8,15)*60;tgt.hp=Math.max(0,tgt.hp-25);G.ptcl.push({t:'lbl',x:tgt.x,y:tgt.y-5,tx:'💀 MALÉFIQUE !',col:sp.col,l:60,m:60,sz:1.4});logEvent(`💀 ${carrier.name} — Tacle Maléfique ! ${tgt.name} hors match !`,sp.col);}
      else{injurePlayer(dti,tgt,true);G.ptcl.push({t:'lbl',x:tgt.x,y:tgt.y-5,tx:'💢 TACLE !',col:sp.col,l:50,m:50,sz:1.3});logEvent(`💢 ${carrier.name} — Tacle malveillant sur ${tgt.name} !`,sp.col);}
      tgt.stunT=irng(isMal?5:2,isMal?8:4);
      for(let i=0;i<14;i++)G.ptcl.push({t:'s',x:tgt.x+irng(-4,4),y:tgt.y+irng(-4,4),vx:(Math.random()-.5)*.8,vy:-Math.random()*.6,l:28,m:28,col:sp.col,sz:.2});
      freeB();G.atkTi=dti;setPhase('FREEKICK');
    }else{
      carrier.yc=(carrier.yc||0)+1;
      if(carrier.yc>=2&&!hasRed(ati)){carrier.red=true;logEvent(`🟥 ${carrier.name} EXPULSÉ !`,'#e02030');}
      else logEvent(`🟨 Carton jaune — ${carrier.name} (tacle dans le vide)`,'#f0c028');
      setPhase('BUILDUP');
    }

  } else if(sp.id==='atk_demo'){
    // Attaque Démoniaque — frappe surpuissante qui ignore en partie la défense
    const gk=byR(dti,'GB')[0];
    G.shots[ati]++;carrier.mSh++;
    const atkS=((carrier.s.sht+(carrier._hm||0))*1.5+sp.pow+irng(-5,5))*strat(ati).atk*fatMul(carrier);
    const defS=(gk?gk.s.def*fatMul(gk):50)*strat(dti).def*0.5; // défense réduite de 50%
    // Particules infernales
    for(let i=0;i<22;i++) G.ptcl.push({t:'s',x:carrier.x+(Math.random()*8-4),y:carrier.y-Math.random()*5,vx:(Math.random()-.5)*1.2,vy:-Math.random()*1.1,l:45,m:45,col:pick(['#e02030','#ff6d00','#b71c1c','#ff9800']),sz:Math.random()*.5+.15});
    G.ptcl.push({t:'ring_expand',x:carrier.x,y:carrier.y,col:'#e02030',maxR:10,l:35,m:35});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-6,tx:'😈 DÉMO !',col:'#e02030',l:60,m:60,sz:1.6});
    logEvent(`😈 ${carrier.name} — ATTAQUE DÉMONIAQUE !`,sp.col);
    kickTo(oppGoalX,PCY+rng(-6,6),3.5);
    const prob_demo=Math.min(0.82,Math.max(0.04,0.17+(Math.pow(Math.max(1,atkS)/Math.max(1,defS),1.3)-1)*0.13));
    setTimeout(()=>{
      if(!G.running)return;
      if(Math.random()<prob_demo){goalScored(carrier,ati,oppGoalX,null);maybeInjureGKOnBigShot(dti,gk,sp,carrier);}
      else{logEvent(`🧤 Arrêt miraculeux !`,teams[dti].color);if(gk)giveB(gk);G.atkTi=dti;setPhase('GOALKICK');}
    },400/speedMult);

  } else if(sp.id==='subtilisation'||sp.id==='vol'){
    const isVol=sp.id==='vol';
    const ballOwner=ownerP();
    const ennemi=ballOwner&&teams[dti].players.some(q=>q===ballOwner||q.id===ballOwner.id)?ballOwner:pick(byR(dti,'ATT','MO','MC').filter(p=>Math.hypot(p.x-carrier.x,p.y-carrier.y)<(isVol?40:25)));
    if(ennemi){
      ennemi.stunT=irng(isVol?6:2,isVol?12:4);
      if(isVol){carrier.x=ennemi.x+rng(-3,3);carrier.y=ennemi.y+rng(-2,2);}
      freeB();giveB(carrier);G.atkTi=ati;
      for(let i=0;i<(isVol?18:12);i++)G.ptcl.push({t:'s',x:ennemi.x+irng(-3,3),y:ennemi.y+irng(-3,3),vx:(Math.random()-.5)*.6,vy:-Math.random()*.7,l:30,m:30,col:sp.col,sz:.2});
      G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-5,tx:isVol?'🕵️ VOL !':'⚡ SUBTILISATION !',col:sp.col,l:55,m:55,sz:1.2});
      logEvent(`${isVol?'🕵️':'⚡'} ${carrier.name} ${isVol?'vole':'subtilise'} le ballon à ${ennemi.name} !`,sp.col);
      setPhase('ATTACK');
    }else{logEvent(`${carrier.name} — Aucune cible.`,sp.col);setPhase('BUILDUP');}

  } else if(sp.id==='main'||sp.id==='main_discrete'){
    const isDisc=sp.id==='main_discrete';
    const caughtP=isDisc?0.40:0.85;
    const inBox=carrier.x>(WW*.68)&&carrier.y>GY1-4&&carrier.y<GY2+4;
    G.shots[ati]++;carrier.mSh++;
    kickTo(oppGoalX,PCY+rng(-8,8),3.2);
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-5,tx:isDisc?'🤫 MAIN...':'✋ MAIN !',col:sp.col,l:65,m:65,sz:1.4});
    logEvent(`${isDisc?'🤫':'✋'} ${carrier.name} — ${isDisc?'Main discrète...':'Main !'}`,sp.col);
    setTimeout(()=>{
      if(!G.running)return;
      if(Math.random()<caughtP){
        logEvent(`🚨 Sifflé ! Main de ${carrier.name}`,'#e02030');
        carrier.yc=(carrier.yc||0)+1;
        if(carrier.yc>=2&&!hasRed(ati)){carrier.red=true;logEvent(`🟥 ${carrier.name} EXPULSÉ !`,'#e02030');}
        else logEvent(`🟨 Carton jaune — ${carrier.name}`,'#f0c028');
        G.atkTi=dti;
        if(inBox){const kicker=pick(byR(dti,'ATT','MO','MC'))||pick(actP(dti));if(kicker){giveB(kicker);setPhase('PENALTY_KICK');}logEvent(`⚡ PENALTY ${teams[dti].name} !`,teams[dti].color);}
        else setPhase('FREEKICK');
      }else{logEvent(`😱 ${carrier.name} — Main ${isDisc?'parfaitement dissimulée':'inaperçue'} !`,sp.col);goalScored(carrier,ati,oppGoalX,null);}
    },350/speedMult);

  } else if(sp.id==='cailloux'){    // Ne fait absolument rien — c'est le principe
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-4,tx:'🪨 Aïe...',col:'#8d6e63',l:50,m:50,sz:1.2});
    logEvent(`🪨 ${carrier.name} — Cailloux dans la chaussure... (ça ne sert à rien)`,sp.col);
    setPhase('BUILDUP');

  } else if(sp.id==='comedia'){
    const inBox=carrier.x>(WW*.72)&&carrier.y>GY1-3&&carrier.y<GY2+3;
    carrier.stunT=irng(2,3);
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-4,tx:'🎭 COMÉDIA !',col:sp.col,l:70,m:70,sz:1.5});
    logEvent(`🎭 ${carrier.name} — COMÉDIA DEL ARTE ! Chute spectaculaire !`,sp.col);
    const r=Math.random();
    if(inBox&&r<0.25){logEvent(`🎭 PENALTY !`,teams[dti].color);G.atkTi=ati;setTimeout(()=>{const k=pick(byR(ati,'ATT','MO','MC'))||carrier;if(k){giveB(k);setPhase('PENALTY_KICK');}},600/speedMult);}
    else if(r<0.75){logEvent(`🎭 Coup franc !`,'#ff7043');G.atkTi=ati;setPhase('FREEKICK');}
    else{carrier.yc=(carrier.yc||0)+1;if(carrier.yc>=2&&!hasRed(ati)){carrier.red=true;logEvent(`🟥 ${carrier.name} EXPULSÉ !`,'#e02030');}else logEvent(`🟨 Carton jaune — ${carrier.name}`,'#f0c028');const o=pick(byR(dti,'DC','MC'));if(o){giveB(o);G.atkTi=dti;}setPhase('BUILDUP');}

  } else if(sp.id==='simulation'){
    // Chute théâtrale
    const inBox=carrier.x>(WW*.72)&&carrier.y>GY1-3&&carrier.y<GY2+3; // dans la surface adverse
    const r=Math.random();
    carrier.stunT=irng(2,4); // le simulateur reste au sol
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-4,tx:'🎭 SIMULATION !',col:'#ff7043',l:65,m:65,sz:1.3});
    if(inBox&&r<0.10){
      // Pénalty !
      logEvent(`🎭 ${carrier.name} — SIMULATION ! L'arbitre siffle... PÉNALTY !`,'#ff7043');
      G.atkTi=ati;
      setTimeout(()=>{
        if(!G.running)return;
        const kicker=pick(byR(ati,'ATT','MO','MC'))||carrier;
        giveB(kicker);
        setPhase('PENALTY_KICK');
      },600/speedMult);
    } else if(r<0.25){
      // Coup franc
      logEvent(`🎭 ${carrier.name} — Simulation ! Coup franc accordé !`,'#ff7043');
      G.atkTi=ati;
      setPhase('FREEKICK');
    } else {
      logEvent(`🎭 ${carrier.name} — Simulation ! L'arbitre n'est pas dupe.`,'#ff7043');
      // L'adversaire récupère la balle
      const opp=pick(byR(dti,'DC','MC','MDC'));
      if(opp){giveB(opp);G.atkTi=dti;}
      setPhase('BUILDUP');
    }

  } else if(sp.id==='aide_divine'){
    // Self-buff : +5 dans 2 stats aléatoires jusqu'à la fin de la mi-temps
    const allStats=['sht','spd','def','tec','stam'];
    const shuffled=[...allStats].sort(()=>Math.random()-.5);
    const chosen=shuffled.slice(0,2);
    const boost=5;
    chosen.forEach(k=>{ carrier.s[k]+=boost; });
    carrier._aideDivine=(carrier._aideDivine||[]); // stocker pour restitution
    carrier._aideDivine.push({keys:chosen,boost,half:G.half});
    // Visuel
    for(let i=0;i<18;i++) G.ptcl.push({t:'s',x:carrier.x+(Math.random()*6-3),y:carrier.y-(Math.random()*4),vx:(Math.random()-.5)*.6,vy:-Math.random()*.9,l:50,m:50,col:'#ffd700',sz:Math.random()*.35+.15});
    G.ptcl.push({t:'ring_expand',x:carrier.x,y:carrier.y,col:'#ffd700',maxR:6,l:40,m:40});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-5,tx:'💛 +5 '+chosen.join('/').toUpperCase(),col:'#ffd700',l:55,m:55,sz:1.2});
    logEvent('💛 '+carrier.name+' — Aide Divine ! +5 '+chosen.join('/').toUpperCase(),'#ffd700');
    setPhase('BUILDUP');

  // ── Chaos (Pacifista) — au hasard, déstabilise un adversaire ou transcende un allié ─
  } else if(sp.id==='chaos'){
    if(Math.random()<0.5){
      const tgt=pick(byR(dti,'ATT','MC','MO','DD','DC'));
      if(tgt){tgt._pacified=(tgt._pacified||0)+irng(8,16)*60;tgt._spdDebuff=(tgt._spdDebuff||0)+irng(5,10)*60;tgt.stunT=irng(2,4);}
      for(let i=0;i<16;i++)G.ptcl.push({t:'s',x:carrier.x+rng(-6,6),y:carrier.y+rng(-4,4),vx:rng(-.6,.6),vy:rng(-.6,.6),l:35,m:35,col:pick(['#ff1744','#f9a825','#00e5ff','#76ff03','#7c4dff']),sz:rng(.2,.5)});
      G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-4,tx:'🌀 CHAOS !',col:sp.col,l:45,m:45,sz:1.6});
      logEvent(`🌀 ${carrier.name} — ${sp.n} ! Le chaos frappe ${tgt?tgt.name:'ladversaire'} !`,sp.col);
    } else {
      const ally=pick(actP(ati));
      if(ally){ally._atkBuff=(ally._atkBuff||0)+irng(12,22)*60;ally.hp=Math.min(100,ally.hp+18);ally.mp=Math.min(100,(ally.mp||0)+15);}
      for(let i=0;i<16;i++)G.ptcl.push({t:'s',x:carrier.x+rng(-6,6),y:carrier.y+rng(-4,4),vx:rng(-.6,.6),vy:rng(-.6,.6),l:35,m:35,col:pick(['#ff1744','#f9a825','#00e5ff','#76ff03','#7c4dff']),sz:rng(.2,.5)});
      G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-4,tx:'🌀 CHAOS !',col:sp.col,l:45,m:45,sz:1.6});
      logEvent(`🌀 ${carrier.name} — ${sp.n} ! Le chaos favorise ${ally?ally.name:'léquipe'} !`,sp.col);
    }
    setPhase('BUILDUP');

  // ── Coup de Théâtre (Pacifista) — une faute est toujours sifflée ─
  } else if(sp.id==='theatre'){
    const inBox=carrier.x>(WW*.72)&&carrier.y>GY1-3&&carrier.y<GY2+3;
    carrier.stunT=irng(1,2);
    const opp2=pick(byR(dti,'DD','DC','DG','MDC'));if(opp2)opp2.stunT=irng(2,4);
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-4,tx:'🎭 COUP DE THÉÂTRE !',col:sp.col,l:60,m:60,sz:1.4});
    if(inBox&&Math.random()<0.30){
      logEvent(`🎭 ${carrier.name} — ${sp.n} ! Larbitre ne peut que siffler... PÉNALTY !`,sp.col);
      G.atkTi=ati;
      setTimeout(()=>{if(!G.running)return;const kicker=pick(byR(ati,'ATT','MO','MC'))||carrier;giveB(kicker);setPhase('PENALTY_KICK');},600/speedMult);
    } else {
      logEvent(`🎭 ${carrier.name} — ${sp.n} ! Coup franc accordé, le stade est en émoi !`,sp.col);
      G.atkTi=ati;setPhase('FREEKICK');
    }

  // ── Désordre Tactique (Pacifista) — toute la défense adverse perd ses repères ─
  } else if(sp.id==='tactique'){
    actP(dti).forEach(p=>{p._pacified=(p._pacified||0)+irng(10,18)*60;p._spdDebuff=(p._spdDebuff||0)+irng(6,12)*60;});
    for(let i=0;i<24;i++)G.ptcl.push({t:'s',x:PCX+rng(-WW*.3,WW*.3),y:PCY+rng(-WH*.3,WH*.3),vx:rng(-.3,.3),vy:rng(-.3,.3),l:45,m:45,col:'#5d4037',sz:rng(.2,.45)});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-5,tx:'🧭 DÉSORDRE TACTIQUE !',col:sp.col,l:60,m:60,sz:1.4});
    logEvent(`🧭 ${carrier.name} — ${sp.n} ! Toute la défense adverse est perdue !`,sp.col);
    setPhase('BUILDUP');

  // ── Intimidation (Empire Brun) — un défenseur adverse recule ─
  } else if(sp.id==='intimid'){
    const tgt=pick(byR(dti,'DD','DC','DG','MDC'));
    if(tgt){
      tgt._pacified=(tgt._pacified||0)+irng(6,12)*60;tgt.stunT=irng(2,3);
      G.ptcl.push({t:'lbl',x:tgt.x,y:tgt.y-4,tx:'😨 INTIMIDÉ !',col:sp.col,l:45,m:45,sz:1.2});
      for(let i=0;i<8;i++)G.ptcl.push({t:'s',x:tgt.x,y:tgt.y,vx:(Math.random()-.5)*.6,vy:-Math.random()*.4,l:30,m:30,col:'#3e2723',sz:.15+Math.random()*.3});
      logEvent(`😤 ${carrier.name} — ${sp.n} ! ${tgt.name} recule impressionné !`,sp.col);
    }
    setPhase('BUILDUP');

  // ── Pierre Sacrée (Cailloumancie) — bénédiction protectrice ─
  } else if(sp.id==='pierre_sacree'){
    actP(ati).forEach(p=>{p.hp=Math.min(100,p.hp+14);});
    carrier._atkBuff=(carrier._atkBuff||0)+irng(15,25)*60;
    carrier.mp=Math.min(100,(carrier.mp||0)+20);
    for(let i=0;i<14;i++)G.ptcl.push({t:'s',x:carrier.x+rng(-4,4),y:carrier.y+rng(-3,3),vx:0,vy:-rng(.2,.5),l:45,m:45,col:'#fbc02d',sz:rng(.2,.5)});
    G.ptcl.push({t:'ring_expand',x:carrier.x,y:carrier.y,col:'#fbc02d',maxR:9,l:35,m:35});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-5,tx:'🪨 PIERRE SACRÉE !',col:sp.col,l:55,m:55,sz:1.4});
    logEvent(`🪨 ${carrier.name} — ${sp.n} ! Léquipe est bénie et revigorée !`,sp.col);
    setPhase('BUILDUP');

  // ── Réveil de la Nature (Druidisme) — version supérieure de Marche Sylvestre ─
  } else if(sp.id==='reveil_nature'){
    actP(ati).forEach(p=>{p._sylvestre=(p._sylvestre||0)+irng(14,20)*60;p.hp=Math.min(100,p.hp+10);});
    actP(dti).forEach(p=>{p._spdDebuff=(p._spdDebuff||0)+irng(5,9)*60;});
    for(let i=0;i<22;i++)G.ptcl.push({t:'s',x:carrier.x+rng(-8,8),y:carrier.y+rng(-6,6),vx:0,vy:-rng(.2,.5),l:55,m:55,col:pick(['#43a047','#2e7d32','#81c784']),sz:rng(.2,.5)});
    G.ptcl.push({t:'ring_expand',x:carrier.x,y:carrier.y,col:'#2e7d32',maxR:12,l:45,m:45});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-6,tx:'🌳 RÉVEIL DE LA NATURE !',col:sp.col,l:60,m:60,sz:1.5});
    logEvent(`🌳 ${carrier.name} — ${sp.n} ! La forêt tout entière se réveille !`,sp.col);
    setPhase('BUILDUP');

  // ── Rot Cosmique (Bouletitude) — déstabilise deux adversaires d'un coup ─
  } else if(sp.id==='rot_cosmique'){
    const tgts=byR(dti,'ATT','MC','MO','DD').sort(()=>Math.random()-.5).slice(0,2);
    tgts.forEach(tgt=>{
      tgt._pacified=(tgt._pacified||0)+irng(5,9)*60;
      tgt.stunT=irng(2,3);
      G.ptcl.push({t:'lbl',x:tgt.x,y:tgt.y-4,tx:'🤢 BURP!',col:sp.col,l:35,m:35,sz:1.4});
    });
    for(let i=0;i<10;i++)G.ptcl.push({t:'s',x:carrier.x,y:carrier.y,vx:rng(-.5,.5),vy:-rng(.2,.6),l:30,m:30,col:'#9ccc65',sz:.2+Math.random()*.3});
    logEvent(`🤢 ${carrier.name} — ${sp.n} ! Un rot cosmique déstabilise ladversaire !`,sp.col);
    setPhase('BUILDUP');

  } else {
    const def2=pick(byR(dti,'DD','DC','DG'));
    const gk2=byR(dti,'GB')[0];
    G.shots[ati]++;carrier.mSh++;
    const scorer=carrier; // capture before async gap
    const atkS=((scorer.s.sht+(scorer._hm||0))+(sp.pow||20)+irng(-8,8))*strat(ati).atk*fatMul(scorer);
    const defS=((gk2?(gk2.s.def)*fatMul(gk2):28)+(def2?def2.s.def*.2*fatMul(def2):0)+irng(-8,8))*strat(dti).def;
    const gy=clamp(PCY+rng(-5,5),GY1-1.5,GY2+1.5);
    kickTo(goalX,gy,3.0);freeB();
    logEvent(`${scorer.name} tire — ${sp.n} !`,sp.col);
    setTimeout(()=>{
      if(!G.running)return;
      if(Math.random()<(()=>{const _a=Math.max(1,atkS),_d=Math.max(1,defS),_r=Math.pow(_a/_d,1.3);return Math.min(0.68,Math.max(0.04,0.17+(_r-1)*0.13));})()){goalScored(scorer,ati,goalX,G._lastPasser?.[ati]);}
      else{logEvent(`Stoppé !`,teams[dti].color+'88');if(gk2)giveB(gk2);G.atkTi=dti;setPhase('GOALKICK');}
    },380/speedMult);
  }

  // ── Concert de Lumière — buff d'équipe (confiance + précision) ──
  if(sp.id==='concert_lumiere'){
    const dur=irng(10,15)*60;
    actP(ati).forEach(p=>{
      p._atkBuff=(p._atkBuff||0)+dur;   // +30% attaque
      p._sixsens=(p._sixsens||0)+dur;   // +45% précision/défense
      p.mp=Math.min(100,(p.mp||0)+8);
    });
    // Spectacle de lumières sur tout le terrain
    for(let i=0;i<40;i++){
      G.ptcl.push({t:'s',x:PCX+rng(-WW*.4,WW*.4),y:PCY+rng(-WH*.4,WH*.4),vx:rng(-.4,.4),vy:-rng(.2,.7),l:rng(40,65),m:65,col:pick(['#ffe066','#fff59d','#4fc3f7','#ff8a80','#b39ddb','#81c784']),sz:rng(.2,.55)});
    }
    G.ptcl.push({t:'ring_expand',x:carrier.x,y:carrier.y,col:'#ffe066',maxR:16,l:45,m:45});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-6,tx:'🎆 CONCERT DE LUMIÈRE !',col:sp.col,l:70,m:70,sz:1.6});
    logEvent(`🎆 ${carrier.name} — ${sp.n} ! Toute l'équipe est galvanisée !`,sp.col);
    setPhase('BUILDUP');
    return;
  }

  // ── Trébuchement — l'adversaire trébuche et perd le ballon ──
  if(sp.id==='trebuchement'){
    const tgt=pick(byR(dti,'ATT','MC','MO'));
    if(tgt){
      tgt.stunT=irng(25,45);
      tgt._spdDebuff=(tgt._spdDebuff||0)+irng(15,25)*60;
      if(tgt.hasBall){freeB();giveB(carrier);}
      G.ptcl.push({t:'lbl',x:tgt.x,y:tgt.y-4,tx:'😵 TRÉBUCHEMENT !',col:sp.col,l:50,m:50,sz:1.2});
      logEvent(`🦶 ${carrier.name} — ${tgt.name} trébuche et perd le ballon !`,sp.col);
      setPhase('ATTACK');
    }
    return;
  }

  // ── Caillou dans l'Oeil — aveugle brièvement un adversaire ──
  if(sp.id==='caillou_oeil'){
    const tgt=pick(byR(dti,'DD','DC','DG','ATT','MC'));
    if(tgt){
      tgt.stunT=irng(20,35);
      tgt._pacified=(tgt._pacified||0)+irng(10,20)*60;
      G.ptcl.push({t:'lbl',x:tgt.x,y:tgt.y-4,tx:'👁 AVEUGLÉ !',col:sp.col,l:50,m:50,sz:1.2});
      for(let i=0;i<8;i++) G.ptcl.push({t:'s',x:tgt.x,y:tgt.y,vx:(Math.random()-.5)*1.2,vy:(Math.random()-.5)*1.2,l:30,m:30,col:'#8d6e63',sz:.2+Math.random()*.25});
      logEvent(`🪨 ${carrier.name} — Caillou dans l'Oeil de ${tgt.name} !`,sp.col);
    }
    return;
  }

  // ── Télékinésie Absolue — tir télékinétique puissance max ──
  if(sp.id==='telekinesie_abs'){
    const gk2=byR(dti,'GB')[0];
    G.shots[ati]++;carrier.mSh++;
    const scorer=carrier;
    const atkS=((scorer.s.sht+(scorer._hm||0))+sp.pow+irng(-5,5))*strat(ati).atk*fatMul(scorer);
    const defS=(gk2?(gk2.s.def)*fatMul(gk2):28)*strat(dti).def*0.4; // défense à 40%
    freeB();
    // Particules télékinétiques
    for(let i=0;i<16;i++) G.ptcl.push({t:'s',x:carrier.x,y:carrier.y,vx:(Math.random()-.5)*1.5,vy:(Math.random()-.5)*1.5,l:40,m:40,col:'#00838f',sz:.2+Math.random()*.35});
    G.ptcl.push({t:'ring_expand',x:carrier.x,y:carrier.y,col:'#00838f',maxR:12,l:30,m:30});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-6,tx:'🤌 TÉLÉKINÉSIE ABSOLUE !',col:'#00838f',l:60,m:60,sz:1.4});
    const gy=clamp(PCY+rng(-3,3),GY1-1,GY2+1);
    kickTo(goalX,gy,4.5);
    logEvent(`🤌 ${scorer.name} — Télékinésie Absolue !`,'#00838f');
    setTimeout(()=>{
      if(!G.running)return;
      if(Math.random()<(()=>{const _a=Math.max(1,atkS),_d=Math.max(1,defS),_r=Math.pow(_a/_d,1.3);return Math.min(0.82,Math.max(0.06,0.22+(_r-1)*0.15));})()){goalScored(scorer,ati,goalX,G._lastPasser?.[ati]);}
      else{logEvent('Stoppé !',teams[dti].color+'88');if(gk2)giveB(gk2);G.atkTi=dti;setPhase('GOALKICK');}
    },320/speedMult);
    return;
  }

  // ── Récolte Forcée — gazon invasif, ralentit la défense ──
  if(sp.id==='vandalisme'){
    actP(dti).forEach(p=>{
      const dx=p.x-goalX, dy=p.y-PCY;
      if(Math.abs(dx)<25){ p._spdDebuff=(p._spdDebuff||0)+irng(18,28)*60; p.stunT=irng(5,10); }
    });
    for(let i=0;i<20;i++) G.ptcl.push({t:'s',x:goalX+rng(-12,12),y:PCY+rng(-8,8),vx:0,vy:-.2,l:50,m:50,col:pick(['#558b2f','#33691e','#aed581']),sz:.3+Math.random()*.5});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-5,tx:'⛏️ VANDALISME !',col:'#558b2f',l:55,m:55,sz:1.3});
    logEvent(`⛏️ ${carrier.name} — Vandalisme de Terrain ! Le sol est détruit !`,'#558b2f');
    setPhase('ATTACK'); return;
  }

  // ── Hack — pirate les stats d'un adversaire ──
  if(sp.id==='hack'){
    const tgt=pick(byR(dti,'ATT','MC','MO'));
    const ally=pick(byR(ati,'ATT','MC','MO'));
    if(tgt && ally){
      const dur=irng(6,10)*60;
      tgt._spdDebuff=(tgt._spdDebuff||0)+dur;
      tgt._pacified=(tgt._pacified||0)+dur;
      ally._atkBuff=(ally._atkBuff||0)+dur;
      G.ptcl.push({t:'lbl',x:tgt.x,y:tgt.y-5,tx:'💻 HACKÉ !',col:'#0288d1',l:50,m:50,sz:1.2});
      G.ptcl.push({t:'lbl',x:ally.x,y:ally.y-5,tx:'⚡ BOOST !',col:'#0288d1',l:50,m:50,sz:1.2});
      logEvent(`💻 ${carrier.name} — Hack ! ${tgt.name} piraté, ${ally.name} boosté !`,'#0288d1');
    }
    setPhase('ATTACK'); return;
  }

  // ── Maztikal Rush — sprint collectif, défense à zéro ──
  if(sp.id==='maztikal_rush'){
    const dur=irng(5,7)*60;
    actP(ati).forEach(p=>{ p._aile=(p._aile||0)+dur; });
    actP(dti).forEach(p=>{ p._pacified=(p._pacified||0)+irng(3,5)*60; });
    for(let i=0;i<16;i++) G.ptcl.push({t:'s',x:carrier.x+rng(-5,5),y:carrier.y+rng(-5,5),vx:(Math.random()-.5)*1.5,vy:-Math.random()*1.5,l:40,m:40,col:'#ff6a00',sz:.2+Math.random()*.4});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-6,tx:'🏃 MAZTIKAL RUSH !',col:'#ff6a00',l:60,m:60,sz:1.4});
    logEvent(`🏃 ${carrier.name} — Maztikal Rush ! Toute l'équipe en sprint !`,'#ff6a00');
    setPhase('ATTACK'); return;
  }

  // ── Transformation Maztikal Girlz — auto en prolongation ──
  if(sp.id==='maztikal_girlz'){
    const dur=irng(20,30)*60;
    carrier._atkBuff=(carrier._atkBuff||0)+dur;
    carrier._aile=(carrier._aile||0)+dur;
    carrier._sixsens=(carrier._sixsens||0)+dur;
    for(let i=0;i<24;i++){const a=i/24*Math.PI*2;G.ptcl.push({t:'s',x:carrier.x+Math.cos(a)*6,y:carrier.y+Math.sin(a)*6,vx:Math.cos(a)*.8,vy:Math.sin(a)*.8,l:50,m:50,col:i%2===0?'#ff00ff':'#ff6a00',sz:.2+Math.random()*.4});}
    G.ptcl.push({t:'ring_expand',x:carrier.x,y:carrier.y,col:'#ff00ff',maxR:16,l:40,m:40});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-7,tx:'✨ MAZTIKAL GIRLZ !',col:'#ff00ff',l:70,m:70,sz:1.6});
    logEvent(`✨ ${carrier.name} — Transformation Maztikal Girlz !`,'#ff00ff');
    setPhase('ATTACK'); return;
  }

  // ── Frappe de Gaïa — PV + Vol5+ + Force5+ ──
  if(sp.id==='gaia'){
    const gk2=byR(dti,'GB')[0];
    G.shots[ati]++;carrier.mSh++;
    const scorer=carrier;
    const atkS=((scorer.s.sht+(scorer._hm||0))+65+irng(-3,3))*strat(ati).atk*fatMul(scorer);
    const defS=(gk2?(gk2.s.def)*fatMul(gk2):28)*strat(dti).def*0.3; // défense à 30%
    // Stun all defenders
    actP(dti).forEach(p=>{ p.stunT=irng(30,60); });
    // Epic particles - earth cracking
    for(let i=0;i<35;i++){const a=i/35*Math.PI*2;G.ptcl.push({t:'s',x:carrier.x+Math.cos(a)*10,y:carrier.y+Math.sin(a)*10,vx:Math.cos(a)*1.8,vy:Math.sin(a)*1.8-1,l:70,m:70,col:i%3===0?'#33691e':i%3===1?'#8d6e63':'#a5d6a7',sz:.3+Math.random()*.6});}
    G.ptcl.push({t:'ring_expand',x:carrier.x,y:carrier.y,col:'#33691e',maxR:22,l:45,m:45});
    G.ptcl.push({t:'ring_expand',x:carrier.x,y:carrier.y,col:'#8d6e63',maxR:16,l:35,m:35});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-9,tx:'🌍 FRAPPE UNIVERSELLE !!',col:'#a5d6a7',l:75,m:75,sz:1.8});
    freeB();
    const gy=clamp(PCY+rng(-2,2),GY1-1,GY2+1);
    kickTo(goalX,gy,5.0);
    logEvent(`🌍 ${scorer.name} — FRAPPE DE GAÏA ! La terre tremble !`,'#33691e');
    setTimeout(()=>{
      if(!G.running)return;
      if(Math.random()<(()=>{const _a=Math.max(1,atkS),_d=Math.max(1,defS),_r=Math.pow(_a/_d,1.3);return Math.min(0.90,Math.max(0.08,0.25+(_r-1)*0.18));})()){goalScored(scorer,ati,goalX,G._lastPasser?.[ati]);maybeInjureGKOnBigShot(dti,gk2,sp,scorer);}
      else{logEvent('Stoppé de justesse !',teams[dti].color+'88');if(gk2)giveB(gk2);G.atkTi=dti;setPhase('GOALKICK');}
    },300/speedMult);
    return;
  }

  // ── Piège Électrique ──
  if(sp.id==='piege_elec'){
    const tgt=pick(byR(dti,'ATT','MC','MO').filter(p=>Math.hypot(p.x-carrier.x,p.y-carrier.y)<22));
    if(tgt){tgt.stunT=irng(8,12)*60;giveB(carrier);}
    for(let i=0;i<12;i++)G.ptcl.push({t:'s',x:tgt?tgt.x:carrier.x+irng(-5,5),y:tgt?tgt.y:carrier.y+irng(-5,5),vx:(Math.random()-.5)*1.2,vy:(Math.random()-.5)*1.2,l:40,m:40,col:'#ffd600',sz:.2+Math.random()*.4});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-6,tx:'⚡ PIÈGE ÉLECTRIQUE !',col:'#ffd600',l:55,m:55,sz:1.3});
    logEvent(`⚡ ${carrier.name} — Piège Électrique !${tgt?' '+tgt.name+' stun !':''}`,'#ffd600');
    setPhase('ATTACK'); return;
  }

  // ── Flamme Noire ──
  if(sp.id==='flamme_noire'){
    actP(dti).forEach(p=>{p._spdDebuff=(p._spdDebuff||0)+irng(10,16)*60;p.stunT=irng(3,5);});
    for(let i=0;i<18;i++)G.ptcl.push({t:'s',x:carrier.x+irng(-8,8),y:carrier.y+irng(-8,8),vx:(Math.random()-.5)*.8,vy:-Math.random()*.8,l:50,m:50,col:i%2===0?'#4a148c':'#7b1fa2',sz:.2+Math.random()*.5});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-7,tx:'🔥 FLAMME NOIRE !',col:'#7c3aed',l:60,m:60,sz:1.3});
    logEvent(`🔥 ${carrier.name} — Flamme Noire ! Les adversaires ralentissent !`,'#4a148c');
    setPhase('ATTACK'); return;
  }

  // ── The Explosion ──
  if(sp.id==='explosion_sort'){
    freeB();const gy=clamp(PCY+rng(-2,2),GY1-1,GY2+1);kickTo(goalX,gy,5.0);
    const gk=byR(dti,'GB')[0];
    const atkS=(carrier.s.sht+55)*strat(ati).atk*fatMul(carrier);
    const defS=(gk?gk.s.def*fatMul(gk):28)*strat(dti).def;
    if(gk)gk.stunT=irng(4,7)*60;
    for(let i=0;i<25;i++){const a=i/25*Math.PI*2;G.ptcl.push({t:'s',x:goalX+Math.cos(a)*8,y:PCY+Math.sin(a)*8,vx:Math.cos(a)*1.2,vy:Math.sin(a)*1.2,l:55,m:55,col:'#d32f2f',sz:.3+Math.random()*.5});}
    G.ptcl.push({t:'ring_expand',x:goalX,y:PCY,col:'#d32f2f',maxR:20,l:40,m:40});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-8,tx:'💣 THE EXPLOSION !!',col:'#ef5350',l:70,m:70,sz:1.7});
    G.shots[ati]++;carrier.mSh++;
    logEvent(`💣 ${carrier.name} — THE EXPLOSION !!`,'#d32f2f');
    setTimeout(()=>{if(!G.running)return;const r=Math.pow(atkS/Math.max(1,defS),1.3);const p=Math.min(0.78,Math.max(0.08,0.25+(r-1)*0.18));if(Math.random()<p){goalScored(carrier,ati,goalX,null);maybeInjureGKOnBigShot(dti,gk,sp,carrier);}else{logEvent('Arrêté mais le gardien est sonné !',teams[dti].color+'88');if(gk)giveB(gk);G.atkTi=dti;setPhase('GOALKICK');}},300/speedMult);
    return;
  }

  // ── Lance des Ténèbres ──
  if(sp.id==='lance_tenebres'){
    freeB();const gy=clamp(PCY+rng(-1,1),GY1-1,GY2+1);kickTo(goalX,gy,5.5);
    const gk=byR(dti,'GB')[0];
    const atkS=(carrier.s.sht+45)*strat(ati).atk*fatMul(carrier);
    const defS=(gk?gk.s.def*fatMul(gk):28)*strat(dti).def*0.8;
    for(let i=0;i<20;i++){const t2=i/20;G.ptcl.push({t:'s',x:carrier.x+t2*(goalX-carrier.x),y:carrier.y-t2*20,vx:0,vy:.5,l:35,m:35,col:'#311b92',sz:.3+Math.random()*.4});}
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-8,tx:'🌑 LANCE DES TÉNÈBRES !',col:'#7c3aed',l:65,m:65,sz:1.5});
    G.shots[ati]++;carrier.mSh++;
    logEvent(`🌑 ${carrier.name} — Lance des Ténèbres !!`,'#311b92');
    setTimeout(()=>{if(!G.running)return;const r=Math.pow(atkS/Math.max(1,defS),1.3);const p=Math.min(0.82,Math.max(0.08,0.25+(r-1)*0.18));if(Math.random()<p){goalScored(carrier,ati,goalX,null);}else{logEvent('Dévié !',teams[dti].color+'88');if(gk)giveB(gk);G.atkTi=dti;setPhase('GOALKICK');}},300/speedMult);
    return;
  }

  // ── Laser Oculaire — Pigeon Ronronldo (Pacifistas) ──
  // Si le lanceur porte le ballon : tir laser puissance 40.
  // Sinon : faisceau qui tacle et stun l'adversaire le plus proche.
  if(sp.id==='laser_oculaire'){
    if(carrier.hasBall){
      const gk=byR(dti,'GB')[0];
      G.shots[ati]++;carrier.mSh++;
      const atkS=((carrier.s.sht+(carrier._hm||0))+sp.pow+irng(-5,5))*strat(ati).atk*fatMul(carrier);
      const defS=(gk?gk.s.def*fatMul(gk):28)*strat(dti).def*0.6;
      freeB();
      G.ptcl.push({t:'beam',x:carrier.x,y:carrier.y,tx:goalX,ty:PCY,col:'#00e5ff',w:.6,l:16,m:16});
      for(let i=0;i<14;i++)G.ptcl.push({t:'s',x:carrier.x,y:carrier.y,vx:(goalX-carrier.x)*.02+rng(-.3,.3),vy:rng(-.3,.3),l:35,m:35,col:'#00e5ff',sz:.2+Math.random()*.3});
      G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-6,tx:'👁️ LASER OCULAIRE !',col:'#00e5ff',l:60,m:60,sz:1.5});
      const gy=clamp(PCY+rng(-3,3),GY1-1,GY2+1);
      kickTo(goalX,gy,4.2);
      logEvent(`👁️ ${carrier.name} — Laser Oculaire !`,'#00e5ff');
      setTimeout(()=>{if(!G.running)return;const r=Math.pow(atkS/Math.max(1,defS),1.3);const p=Math.min(0.78,Math.max(0.06,0.22+(r-1)*0.15));if(Math.random()<p){goalScored(carrier,ati,goalX,G._lastPasser?.[ati]);}else{logEvent('Laser dévié !',teams[dti].color+'88');if(gk)giveB(gk);G.atkTi=dti;setPhase('GOALKICK');}},320/speedMult);
    } else {
      const tgt=actP(dti).filter(p=>!p.red).sort((a,b)=>Math.hypot(a.x-carrier.x,a.y-carrier.y)-Math.hypot(b.x-carrier.x,b.y-carrier.y))[0];
      if(tgt){
        tgt.stunT=irng(4,7);
        tgt._spdDebuff=(tgt._spdDebuff||0)+irng(5,9)*60;
        if(tgt.hasBall){freeB();giveB(carrier);}
        G.ptcl.push({t:'beam',x:carrier.x,y:carrier.y,tx:tgt.x,ty:tgt.y,col:'#00e5ff',w:.6,l:16,m:16});
        for(let i=0;i<10;i++)G.ptcl.push({t:'s',x:tgt.x,y:tgt.y,vx:rng(-.5,.5),vy:rng(-.5,.5),l:32,m:32,col:'#00e5ff',sz:.2+Math.random()*.3});
        G.ptcl.push({t:'lbl',x:tgt.x,y:tgt.y-4,tx:'👁️ LASER !',col:'#00e5ff',l:50,m:50,sz:1.3});
        logEvent(`👁️ ${carrier.name} — Laser Oculaire tacle ${tgt.name} !`,'#00e5ff');
      }
      setPhase('BUILDUP');
    }
    return;
  }

  // ── Attentat — Cheik Evara ──
  if(sp.id==='attentat'){
    freeB();const gy=clamp(PCY,GY1-1,GY2+1);kickTo(goalX,gy,6.0);
    actP(dti).forEach(p=>{p.stunT=irng(15,25);});
    const gk=byR(dti,'GB')[0];
    const atkS=(carrier.s.sht+70)*strat(ati).atk*fatMul(carrier);
    const defS=(gk?gk.s.def*fatMul(gk):28)*strat(dti).def*0.4;
    for(let i=0;i<35;i++){const a=i/35*Math.PI*2;const r2=4+Math.random()*14;G.ptcl.push({t:'s',x:carrier.x+Math.cos(a)*r2,y:carrier.y+Math.sin(a)*r2,vx:Math.cos(a)*1.5,vy:Math.sin(a)*1.5-1,l:70,m:70,col:i%3===0?'#b71c1c':i%3===1?'#ef5350':'#ff8a80',sz:.3+Math.random()*.6});}
    G.ptcl.push({t:'ring_expand',x:carrier.x,y:carrier.y,col:'#b71c1c',maxR:22,l:45,m:45});
    G.ptcl.push({t:'lbl',x:50,y:PCY-10,tx:'💥 ATTENTAT !!',col:'#ef5350',l:85,m:85,sz:2.0});
    G.shots[ati]++;carrier.mSh++;
    logEvent(`💥 ${carrier.name} — ATTENTAT ! Les canons surgissent du sol !!`,'#b71c1c');
    setTimeout(()=>{if(!G.running)return;const r3=Math.pow(atkS/Math.max(1,defS),1.3);const p=Math.min(0.72,Math.max(0.08,0.25+(r3-1)*0.18));if(Math.random()<p){goalScored(carrier,ati,goalX,null);maybeInjureGKOnBigShot(dti,gk,sp,carrier);}else{logEvent('Miracle défensif !',teams[dti].color+'88');if(gk)giveB(gk);G.atkTi=dti;setPhase('GOALKICK');}},500/speedMult);
    return;
  }

  // ── Coup Bas — vol + stun 10s ──
  if(sp.id==='coup_bas'){
    const tgt=pick(byR(dti,'ATT','MC','MO','DC').filter(p=>Math.hypot(p.x-carrier.x,p.y-carrier.y)<18));
    if(tgt){
      giveB(carrier);
      tgt.stunT=irng(9,11)*60;
      G.ptcl.push({t:'lbl',x:tgt.x,y:tgt.y-5,tx:'🤫 COUP BAS !',col:'#8d6e63',l:55,m:55,sz:1.3});
      logEvent(`🤫 ${carrier.name} — Coup Bas ! ${tgt.name} au sol 10s !`,'#8d6e63');
    } else {
      logEvent(`🤫 ${carrier.name} — Coup Bas dans le vide...`,'#8d6e63');
    }
    setPhase('ATTACK'); return;
  }

  // ── Haramball — Sultan Omar Al Khaïd ──
  if(sp.id==='haramball'){
    const dur=15*60;
    actP(ati).forEach(p=>{ p._defBuff=(p._defBuff||0)+dur; });
    for(let i=0;i<20;i++){const a=i/20*Math.PI*2;G.ptcl.push({t:'s',x:carrier.x+Math.cos(a)*8,y:carrier.y+Math.sin(a)*8,vx:Math.cos(a)*.6,vy:Math.sin(a)*.6,l:55,m:55,col:i%2===0?'#c8a400':'#f0d060',sz:.3+Math.random()*.4});}
    G.ptcl.push({t:'ring_expand',x:carrier.x,y:carrier.y,col:'#c8a400',maxR:18,l:40,m:40});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-7,tx:'🕌 HARAMBALL !',col:'#f0d060',l:70,m:70,sz:1.6});
    logEvent(`🕌 ${carrier.name} — HARAMBALL ! +15 Défense pour toute l'équipe !`,'#c8a400');
    setPhase('BUILDUP'); return;
  }

  // ── Tir Pégase ──
  if(sp.id==='tir_pegase'){
    freeB();
    const gy=clamp(PCY+rng(-2,2),GY1-1,GY2+1);kickTo(goalX,gy,4.5);
    for(let i=0;i<20;i++){const a=i/20*Math.PI*2;G.ptcl.push({t:'s',x:carrier.x+Math.cos(a)*6,y:carrier.y+Math.sin(a)*6,vx:Math.cos(a)*.8,vy:Math.sin(a)*.8-0.5,l:50,m:50,col:'#87ceeb',sz:.3+Math.random()*.4});}
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-7,tx:'🦄 TIR PÉGASE !',col:'#87ceeb',l:60,m:60,sz:1.3});
    const gk=byR(dti,'GB')[0]; const atkS=(carrier.s.sht+35)*strat(ati).atk*fatMul(carrier); const defS=(gk?gk.s.def*fatMul(gk):28)*strat(dti).def*(gk&&gk._defBuff>0?1.15:1);
    G.shots[ati]++;carrier.mSh++;
    logEvent(`🦄 ${carrier.name} — Tir Pégase !`,'#87ceeb');
    setTimeout(()=>{if(!G.running)return;const r=Math.pow(atkS/Math.max(1,defS),1.3);const p=Math.min(0.82,Math.max(0.08,0.25+(r-1)*0.18));if(Math.random()<p){goalScored(carrier,ati,goalX,null);}else{logEvent('Arrêté !',teams[dti].color+'88');if(gk)giveB(gk);G.atkTi=dti;setPhase('GOALKICK');}},300/speedMult);
    return;
  }

  // ── Ballon Angélique — défensif ──
  if(sp.id==='ballon_angelique'){
    const tgt=pick(byR(dti,'ATT','MO').filter(p=>Math.hypot(p.x-carrier.x,p.y-carrier.y)<25));
    if(tgt){tgt.stunT=irng(8,14);tgt._spdDebuff=(tgt._spdDebuff||0)+irng(10,16)*60;}
    for(let i=0;i<15;i++)G.ptcl.push({t:'s',x:carrier.x+irng(-5,5),y:carrier.y-irng(2,8),vx:(Math.random()-.5)*.5,vy:-Math.random()*.8,l:50,m:50,col:'#fffde7',sz:.2+Math.random()*.4});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-6,tx:'😇 BALLON ANGÉLIQUE !',col:'#ffd54f',l:55,m:55,sz:1.2});
    logEvent(`😇 ${carrier.name} — Ballon Angélique ! L'adversaire contourné !`,'#ffd54f');
    setPhase('ATTACK'); return;
  }

  // ── Monté Céleste — passe + boost ──
  if(sp.id==='monte_celeste'){
    const ally=pick(byR(ati,'ATT','MO','MOG','MOD').filter(p=>p!==carrier));
    if(ally){giveB(ally);ally._aile=(ally._aile||0)+irng(8,14)*60;}
    for(let i=0;i<18;i++)G.ptcl.push({t:'s',x:carrier.x,y:carrier.y-i*2,vx:(Math.random()-.5)*.3,vy:-1.2,l:40,m:40,col:'#e1f5fe',sz:.2+Math.random()*.3});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-8,tx:'☁️ MONTÉ CÉLESTE !',col:'#81d4fa',l:55,m:55,sz:1.2});
    logEvent(`☁️ ${carrier.name} — Monté Céleste ! Passe céleste !`,'#81d4fa');
    setPhase('ATTACK'); return;
  }

  // ── Tir de la Licorne — duo ──
  if(sp.id==='tir_licorne'){
    freeB();const gy=clamp(PCY+rng(-2,2),GY1-1,GY2+1);kickTo(goalX,gy,5.0);
    const ally=pick(byR(ati,'ATT','MO','MOG','MOD').filter(p=>p!==carrier));
    for(let i=0;i<25;i++){const a=i/25*Math.PI*2;G.ptcl.push({t:'s',x:carrier.x+Math.cos(a)*8,y:carrier.y+Math.sin(a)*8,vx:Math.cos(a)*1.2,vy:Math.sin(a)*1.2,l:55,m:55,col:i%2===0?'#9c27b0':'#ce93d8',sz:.3+Math.random()*.5});}
    G.ptcl.push({t:'ring_expand',x:carrier.x,y:carrier.y,col:'#9c27b0',maxR:18,l:40,m:40});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-8,tx:'🦄 TIR DE LA LICORNE !',col:'#ce93d8',l:70,m:70,sz:1.6});
    const gk=byR(dti,'GB')[0]; const atkS=(carrier.s.sht+50+(ally?10:0))*strat(ati).atk*fatMul(carrier); const defS=(gk?gk.s.def*fatMul(gk):28)*strat(dti).def*(gk&&gk._defBuff>0?1.15:1);
    G.shots[ati]++;carrier.mSh++;
    logEvent(`🦄 ${carrier.name}${ally?' & '+ally.name:''} — Tir de la Licorne !`,'#9c27b0');
    setTimeout(()=>{if(!G.running)return;const r=Math.pow(atkS/Math.max(1,defS),1.3);const p=Math.min(0.85,Math.max(0.08,0.25+(r-1)*0.18));if(Math.random()<p){goalScored(carrier,ati,goalX,null);maybeInjureGKOnBigShot(dti,gk,sp,carrier);}else{logEvent('Arrêté !',teams[dti].color+'88');if(gk)giveB(gk);G.atkTi=dti;setPhase('GOALKICK');}},300/speedMult);
    return;
  }

  // ── Tri-Pégase — trio ──
  if(sp.id==='tri_pegase'){
    freeB();const gy=clamp(PCY+rng(-1,1),GY1-1,GY2+1);kickTo(goalX,gy,5.5);
    actP(dti).slice(0,3).forEach(p=>{p.stunT=irng(4,8);});
    for(let i=0;i<30;i++){const a=i/30*Math.PI*2;G.ptcl.push({t:'s',x:carrier.x+Math.cos(a)*10,y:carrier.y+Math.sin(a)*10,vx:Math.cos(a)*1.5,vy:Math.sin(a)*1.5,l:65,m:65,col:'#1565c0',sz:.3+Math.random()*.5});}
    G.ptcl.push({t:'ring_expand',x:carrier.x,y:carrier.y,col:'#42a5f5',maxR:20,l:45,m:45});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-9,tx:'🔵 TRI-PÉGASE !!',col:'#42a5f5',l:75,m:75,sz:1.8});
    const gk=byR(dti,'GB')[0]; const atkS=(carrier.s.sht+60)*strat(ati).atk*fatMul(carrier); const defS=(gk?gk.s.def*fatMul(gk):28)*strat(dti).def*0.7;
    G.shots[ati]++;carrier.mSh++;
    logEvent(`🔵 TRI-PÉGASE ! ${carrier.name} et ses alliés — pégase bleu !!`,'#1565c0');
    setTimeout(()=>{if(!G.running)return;const r=Math.pow(atkS/Math.max(1,defS),1.3);const p=Math.min(0.88,Math.max(0.08,0.25+(r-1)*0.18));if(Math.random()<p){goalScored(carrier,ati,goalX,null);maybeInjureGKOnBigShot(dti,gk,sp,carrier);}else{logEvent('Arrêté !',teams[dti].color+'88');if(gk)giveB(gk);G.atkTi=dti;setPhase('GOALKICK');}},300/speedMult);
    return;
  }

  // ── Tir Céleste / Éclat Divin — légendaire ──
  if(sp.id==='tir_celeste'){
    freeB();const gy=clamp(PCY,GY1-1,GY2+1);kickTo(goalX,gy,6.0);
    [...actP(0),...actP(1)].filter(p=>p!==carrier).forEach(p=>{p.stunT=irng(20,30);});
    for(let i=0;i<40;i++){const a=i/40*Math.PI*2;G.ptcl.push({t:'s',x:50+Math.cos(a)*20,y:PCY/2+Math.sin(a)*10,vx:Math.cos(a)*.5,vy:Math.sin(a)*.5,l:80,m:80,col:i%3===0?'#ffd700':i%3===1?'#fff9c4':'#ffffff',sz:.3+Math.random()*.6});}
    G.ptcl.push({t:'ring_expand',x:goalX,y:PCY,col:'#ffd700',maxR:25,l:50,m:50});
    G.ptcl.push({t:'lbl',x:50,y:PCY/3,tx:'⚡ TIR CÉLESTE !',col:'#ffd700',l:90,m:90,sz:2.2});
    G.ptcl.push({t:'lbl',x:50,y:PCY/3+8,tx:'✨ ÉCLAT DIVIN !!',col:'#fff9c4',l:80,m:80,sz:1.6});
    const gk=byR(dti,'GB')[0]; let atkS=(carrier.s.sht+50)*strat(ati).atk*fatMul(carrier); const defS=(gk?gk.s.def*fatMul(gk):28)*strat(dti).def*0.5;
    // Façon Inazuma Eleven : quand un GARDIEN lance ce tir légendaire, c'est un
    // super-tir surpuissant. On lui donne un gros bonus de frappe et seulement
    // un léger malus de distance — il peut vraiment marquer de loin.
    if(carrier.pos==='GB'){const dist=Math.abs(carrier.x-goalX);atkS*=1.6*Math.max(0.8,1-dist/WW*0.2);}
    G.shots[ati]++;carrier.mSh++;
    logEvent(`⚡ ${carrier.name} — TIR CÉLESTE ! ÉCLAT DIVIN ! Le jugement final !!`,'#ffd700');
    setTimeout(()=>{if(!G.running)return;const r=Math.pow(atkS/Math.max(1,defS),1.3);const p=Math.min(0.95,Math.max(0.08,0.25+(r-1)*0.18));const cap=carrier.pos==='GB'?0.80:0.60;if(Math.random()<Math.min(cap,p)){goalScored(carrier,ati,goalX,null);maybeInjureGKOnBigShot(dti,gk,sp,carrier);}else{logEvent('Miracle défensif !',teams[dti].color+'88');if(gk)giveB(gk);G.atkTi=dti;setPhase('GOALKICK');}},500/speedMult);
    return;
  }

  // ── Vœux — effet aléatoire bénéfique ──
  if(sp.id==='voeux'){
    const roll=Math.random();
    if(roll<0.33){actP(ati).forEach(p=>{p.hp=Math.min(p.maxHp||100,p.hp+irng(15,25));});G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-6,tx:'🌟 VŒU EXAUCÉ : SOIN !',col:'#ce93d8',l:55,m:55,sz:1.2});}
    else if(roll<0.66){actP(ati).forEach(p=>{p._aile=(p._aile||0)+irng(8,12)*60;});G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-6,tx:'🌟 VŒU EXAUCÉ : VITESSE !',col:'#ce93d8',l:55,m:55,sz:1.2});}
    else{actP(ati).forEach(p=>{p._atkBuff=(p._atkBuff||0)+irng(8,12)*60;});G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-6,tx:'🌟 VŒU EXAUCÉ : ATTAQUE !',col:'#ce93d8',l:55,m:55,sz:1.2});}
    logEvent(`🌟 ${carrier.name} — Vœux ! Le mystère exauce...`,'#ce93d8');
    setPhase('ATTACK'); return;
  }

  // ── Vision — boost gardien ──
  if(sp.id==='vision'){
    const gk=byR(ati,'GB')[0];
    if(gk){gk._vision=(gk._vision||0)+irng(12,18)*60;}
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-6,tx:'🔮 VISION !',col:'#b39ddb',l:55,m:55,sz:1.2});
    logEvent(`🔮 ${carrier.name} — Vision ! Le gardien prévoit le prochain tir !`,'#b39ddb');
    setPhase('ATTACK'); return;
  }

  // ── Éclipse — désoriente toute la défense ──
  if(sp.id==='eclipse'){
    actP(dti).forEach(p=>{p.stunT=irng(8,12)*60;p._spdDebuff=(p._spdDebuff||0)+irng(8,12)*60;});
    for(let i=0;i<20;i++)G.ptcl.push({t:'s',x:50+irng(-20,20),y:PCY+irng(-15,15),vx:0,vy:0,l:60,m:60,col:'#37474f',sz:.3+Math.random()*.5});
    G.ptcl.push({t:'lbl',x:50,y:PCY-8,tx:'🌑 ÉCLIPSE !',col:'#78909c',l:60,m:60,sz:1.4});
    logEvent(`🌑 ${carrier.name} — Éclipse ! Le terrain s'obscurcit !`,'#546e7a');
    setPhase('ATTACK'); return;
  }

  // ── Prophétie — annule prochain sort ──
  if(sp.id==='prophetie'){
    G._contresort=G._contresort||{};G._contresort[dti]=(G._contresort[dti]||0)+1;
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-6,tx:'📜 PROPHÉTIE !',col:'#7e57c2',l:55,m:55,sz:1.2});
    logEvent(`📜 ${carrier.name} — Prophétie ! Le prochain sort adverse est annulé.`,'#7e57c2');
    setPhase('ATTACK'); return;
  }

  // ── Invocation Céleste — joueur fantôme ──
  if(sp.id==='invoc_celeste'){
    const dur=irng(8,12)*60;
    const ally=pick(byR(ati,'ATT','MO','MOG','MOD'));
    if(ally){ally._atkBuff=(ally._atkBuff||0)+dur;ally._aile=(ally._aile||0)+dur;ally._ghost=true;}
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-7,tx:'👼 INVOCATION CÉLESTE !',col:'#4a148c',l:65,m:65,sz:1.4});
    logEvent(`👼 ${carrier.name} — Invocation Céleste ! Un esprit allié descend !`,'#7b1fa2');
    setPhase('ATTACK'); return;
  }

  // ── Manifestation Écolo — Diplomate/Avocat + Paradigme Vert + Vol4+ ──
  if(sp.id==='manif_ecolo'){
    const dur = irng(15,20)*60;
    // Stun tout le monde sauf le lanceur
    [...actP(0), ...actP(1)].forEach(p=>{ if(p!==carrier) p.stunT=dur; });
    freeB();
    // Particules - foule verte
    for(let i=0;i<25;i++) G.ptcl.push({t:'s',x:rng(5,95),y:rng(10,90),vx:0,vy:0,l:dur,m:dur,col:i%3===0?'#4caf50':i%3===1?'#ffeb3b':'#ffffff',sz:.3+Math.random()*.4});
    G.ptcl.push({t:'lbl',x:50,y:PCY-12,tx:'📢 MANIFESTATION ÉCOLO !',col:'#4caf50',l:80,m:80,sz:1.5});
    G.ptcl.push({t:'lbl',x:50,y:PCY,tx:'⏸ MATCH INTERROMPU',col:'#ffeb3b',l:70,m:70,sz:1.2});
    logEvent(`📢 ${carrier.name} — Manifestation Écolo ! Le match est interrompu !`,'#4caf50');
    setPhase('BUILDUP');
    return;
  }

  // ── Boing Boing — Ruby/Saphyr uniquement ──
  if(sp.id==='boing_boing'){
    // Max 1 fois par joueur
    if((carrier._boingCount||0)>=1){ setPhase('ATTACK'); return; }
    carrier._boingCount=(carrier._boingCount||0)+1;
    // Autobut garanti
    const gk=byR(ati,'GB')[0];
    const scorer=actP(dti)[0]||actP(dti,'ATT')[0];
    for(let i=0;i<30;i++){const a=i/30*Math.PI*2;G.ptcl.push({t:'s',x:carrier.x+Math.cos(a)*10,y:carrier.y+Math.sin(a)*10,vx:Math.cos(a)*.8,vy:Math.sin(a)*.8,l:60,m:60,col:i%2===0?'#ff69b4':'#ff1493',sz:.3+Math.random()*.5});}
    G.ptcl.push({t:'ring_expand',x:carrier.x,y:carrier.y,col:'#ff69b4',maxR:18,l:40,m:40});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-8,tx:'🍑 BOING BOING !!',col:'#ff69b4',l:80,m:80,sz:2.0});
    logEvent(`🍑 ${carrier.name} — BOING BOING ! L'équipe adverse est... déconcentrée.`,'#ff69b4');
    setTimeout(()=>{
      if(!G.running)return;
      const ownGoalX = dti===0 ? G.goalX1 : G.goalX2;
      G.ptcl.push({t:'lbl',x:ownGoalX,y:PCY-8,tx:'😳 AUTOBUT !!',col:'#ff0000',l:80,m:80,sz:1.8});
      goalScored(scorer||carrier, dti, ownGoalX, null);
    }, 800/speedMult);
    return;
  }

  // ── Transformation Dragon — Tear uniquement ──
  if(sp.id==='dragon'){
    const dur=15*60;
    carrier._atkBuff=(carrier._atkBuff||0)+dur;
    carrier._aile=(carrier._aile||0)+dur;
    carrier._sixsens=(carrier._sixsens||0)+dur;
    carrier._dragon=dur; // flag: auto fire on possession
    // Boost de stats de la transformation (retiré à la fin, ligne ~1444).
    // Sans cet ajout, la fin de transformation retirait un bonus jamais donné
    // et affaiblissait le joueur de façon permanente.
    if(!carrier._dragonBoosted){
      carrier.s.sht=carrier.s.sht+30;
      carrier.s.spd=carrier.s.spd+20;
      carrier._dragonBoosted=true;
    }
    // Explosion visuelle
    for(let i=0;i<30;i++){const a=i/30*Math.PI*2;G.ptcl.push({t:'s',x:carrier.x+Math.cos(a)*8,y:carrier.y+Math.sin(a)*8,vx:Math.cos(a)*1.2,vy:Math.sin(a)*1.2,l:60,m:60,col:i%2===0?'#ff4500':'#ffd700',sz:.3+Math.random()*.5});}
    G.ptcl.push({t:'ring_expand',x:carrier.x,y:carrier.y,col:'#ff4500',maxR:20,l:40,m:40});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-8,tx:'🐉 TRANSFORMATION DRAGON !',col:'#ff4500',l:80,m:80,sz:1.8});
    logEvent(`🐉 ${carrier.name} — Transformation Dragon ! Tear est déchaînée !`,'#ff4500');
    setPhase('ATTACK'); return;
  }

  // ── Contresort — annule le prochain sort adverse ──
  if(sp.id==='contresort'){
    actP(ati).forEach(p=>{ p._contresort=(p._contresort||0)+1; });
    G.ptcl.push({t:'ring_expand',x:carrier.x,y:carrier.y,col:'#5c6bc0',maxR:18,l:40,m:40});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-6,tx:'🛡 CONTRESORT !',col:'#5c6bc0',l:55,m:55,sz:1.3});
    logEvent(`🛡 ${carrier.name} — Contresort ! Prochain sort annulé !`,'#5c6bc0');
    setPhase('BUILDUP'); return;
  }

  // ── Bannissement — exile temporairement un adversaire ──
  if(sp.id==='bannissement'){
    const tgt=pick(byR(dti,'ATT','MC','MO'));
    if(tgt){
      const ox=tgt.x, oy=tgt.y;
      tgt.x=-50; tgt.y=-50; tgt.tx=-50; tgt.ty=-50;
      tgt.stunT=600;
      G.ptcl.push({t:'ring_expand',x:ox,y:oy,col:'#4a148c',maxR:12,l:35,m:35});
      G.ptcl.push({t:'lbl',x:ox,y:oy-5,tx:'💫 BANNI !',col:'#4a148c',l:60,m:60,sz:1.4});
      logEvent(`💫 ${carrier.name} — ${tgt.name} banni du terrain !`,'#4a148c');
      setTimeout(()=>{ tgt.x=ox; tgt.y=oy; tgt.stunT=0; }, 10000/speedMult);
    }
    setPhase('ATTACK'); return;
  }

  // ── Carapace — bouclier défensif temporaire ──
  if(sp.id==='carapace'){
    carrier._atkBuff=(carrier._atkBuff||0)+irng(12,20)*60;
    carrier.hp=Math.min(100,carrier.hp+20);
    for(let i=0;i<16;i++){const a=i/16*Math.PI*2;G.ptcl.push({t:'s',x:carrier.x+Math.cos(a)*5,y:carrier.y+Math.sin(a)*5,vx:Math.cos(a)*.3,vy:Math.sin(a)*.3,l:60,m:60,col:'#78909c',sz:.3+Math.random()*.3});}
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-5,tx:'🪨 CARAPACE !',col:'#78909c',l:55,m:55,sz:1.3});
    logEvent(`🪨 ${carrier.name} — Carapace ! Armure activée !`,'#78909c');
    setPhase('BUILDUP'); return;
  }

  // ── Forme Bestiale — vitesse et force décuplées ──
  if(sp.id==='forme_bestiale'){
    const dur=irng(7,10)*60;
    carrier._atkBuff=(carrier._atkBuff||0)+dur*2;
    carrier._spdDebuff=Math.max(0,(carrier._spdDebuff||0)-dur);
    for(let i=0;i<20;i++){const a=Math.random()*Math.PI*2;G.ptcl.push({t:'s',x:carrier.x,y:carrier.y,vx:Math.cos(a)*rng(.5,1.5),vy:Math.sin(a)*rng(.5,1.5),l:45,m:45,col:'#bf360c',sz:.2+Math.random()*.4});}
    G.ptcl.push({t:'ring_expand',x:carrier.x,y:carrier.y,col:'#bf360c',maxR:15,l:30,m:30});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-6,tx:'🐺 FORME BESTIALE !',col:'#bf360c',l:65,m:65,sz:1.5});
    logEvent(`🐺 ${carrier.name} — Forme Bestiale ! Instinct animal déchaîné !`,'#bf360c');
    setPhase('ATTACK'); return;
  }

  // ── Champ de Force — ralentit les adversaires proches ──
  if(sp.id==='champ_force'){
    actP(dti).forEach(p=>{
      const dx=p.x-carrier.x, dy=p.y-carrier.y;
      if(Math.sqrt(dx*dx+dy*dy)<20){ p._spdDebuff=(p._spdDebuff||0)+irng(15,25)*60; p.stunT=irng(5,12); }
    });
    G.ptcl.push({t:'ring_expand',x:carrier.x,y:carrier.y,col:'#0288d1',maxR:20,l:35,m:35});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-5,tx:'💠 CHAMP DE FORCE !',col:'#0288d1',l:55,m:55,sz:1.3});
    logEvent(`💠 ${carrier.name} — Champ de Force ! Adversaires freinés !`,'#0288d1');
    setPhase('BUILDUP'); return;
  }

  // ── Désintégration — annule toutes les stats d'un adversaire ──
  if(sp.id==='desintegration'){
    const tgt=pick(byR(dti,'ATT','MC','DD','DC'));
    if(tgt){
      const dur=irng(5,8)*60;
      tgt._spdDebuff=(tgt._spdDebuff||0)+dur*3;
      tgt._pacified=(tgt._pacified||0)+dur*2;
      tgt.stunT=irng(30,50);
      spawnMaledic(carrier.x,carrier.y,tgt.x,tgt.y);
      G.ptcl.push({t:'lbl',x:tgt.x,y:tgt.y-5,tx:'💀 DÉSINTÉGRÉ !',col:'#37474f',l:60,m:60,sz:1.4});
      logEvent(`💀 ${carrier.name} — ${tgt.name} désintégré ! Stats anéanties !`,'#37474f');
    }
    setPhase('BUILDUP'); return;
  }

  // ── Drain Vital — vole la vie d'un adversaire ──
  if(sp.id==='drain_vital'){
    const tgt=pick(byR(dti,'ATT','MC','MO'));
    if(tgt){
      const drain=irng(25,40);
      tgt.hp=Math.max(1,tgt.hp-drain);
      carrier.hp=Math.min(100,carrier.hp+drain);
      for(let i=0;i<12;i++) G.ptcl.push({t:'s',x:tgt.x,y:tgt.y,vx:(carrier.x-tgt.x)*.05+rng(-.3,.3),vy:(carrier.y-tgt.y)*.05,l:40,m:40,col:'#880e4f',sz:.2+Math.random()*.3});
      G.ptcl.push({t:'lbl',x:tgt.x,y:tgt.y-4,tx:'🩸 DRAIN !',col:'#880e4f',l:50,m:50,sz:1.2});
      logEvent(`🩸 ${carrier.name} — Drain Vital sur ${tgt.name} ! +${drain} HP aspirés !`,'#880e4f');
    }
    setPhase('BUILDUP'); return;
  }

  // ── Résurrection — ramène un coéquipier KO ──
  if(sp.id==='resurrection'){
    const ko=actP(ati).find(p=>p.hp<=5 && p!==carrier) || actP(ati).sort((a,b)=>a.hp-b.hp)[0];
    if(ko){
      ko.hp=50; ko.mp=30; ko.stunT=0;
      for(let i=0;i<24;i++){const a=i/24*Math.PI*2;G.ptcl.push({t:'s',x:ko.x+Math.cos(a)*6,y:ko.y+Math.sin(a)*6,vx:Math.cos(a)*.5,vy:Math.sin(a)*.5,l:55,m:55,col:'#f9a825',sz:.2+Math.random()*.4});}
      G.ptcl.push({t:'ring_expand',x:ko.x,y:ko.y,col:'#f9a825',maxR:14,l:40,m:40});
      G.ptcl.push({t:'lbl',x:ko.x,y:ko.y-6,tx:'✨ RESURRECTION !',col:'#f9a825',l:70,m:70,sz:1.5});
      logEvent(`✨ ${carrier.name} — ${ko.name} ressuscité à 50% HP !`,'#f9a825');
    }
    setPhase('BUILDUP'); return;
  }

  // ── Invocation Aléatoire — pioche un sort avancé au hasard ──
  if(sp.id==='invoc_aleatoire'){
    const pool=['fire','fireball','ice','thunder','eldritch','illusion','tech','heal',
      'shield','tornado','suggest','ice2','pacif','cyclon','telekib','deluge',
      'terreur','folie','invis','peaupierre','sixsens','spindash','stase','maledic',
      'domination','puissance_divine','lien_chamanique','trebuchement'];
    const picked = pool[Math.floor(Math.random()*pool.length)];
    const pickedSp = SPELLS.find(s=>s.id===picked);
    G.ptcl.push({t:'ring_expand',x:carrier.x,y:carrier.y,col:'#ab47bc',maxR:14,l:30,m:30});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-6,tx:`🎲 ${pickedSp?pickedSp.n:'???'} !`,col:'#ab47bc',l:65,m:65,sz:1.4});
    logEvent(`🎲 ${carrier.name} — Invocation Aléatoire : ${pickedSp?pickedSp.n:'???'} !`,'#ab47bc');
    if(pickedSp) doSpell(carrier,ati,dti,pickedSp,goalX);
    return;
  }

  // ── Puissance Divine — gros boost individuel sur soi-même ──
  if(sp.id==='puissance_divine'){
    const dur = irng(8,14)*60;
    carrier._atkBuff  = (carrier._atkBuff||0)  + dur;
    carrier._sixsens  = (carrier._sixsens||0)  + dur;
    carrier.hp = Math.min(100, carrier.hp + 30);
    carrier.mp = Math.min(100, (carrier.mp||0) + 25);
    // Halo doré
    for(let i=0;i<24;i++){
      const a=i/24*Math.PI*2;
      G.ptcl.push({t:'s',x:carrier.x+Math.cos(a)*4,y:carrier.y+Math.sin(a)*4,
        vx:Math.cos(a)*.6,vy:Math.sin(a)*.6,l:55,m:55,col:'#ffd54f',sz:.25+Math.random()*.3});
    }
    G.ptcl.push({t:'ring_expand',x:carrier.x,y:carrier.y,col:'#ffd54f',maxR:12,l:35,m:35});
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-6,tx:'✨ PUISSANCE DIVINE !',col:'#ffd54f',l:70,m:70,sz:1.5});
    logEvent(`✨ ${carrier.name} — Puissance Divine ! Béni des dieux !`,'#ffd54f');
    setPhase('ATTACK');
    return;
  }

  // ── Lien Chamanique — restaure l'endurance de deux coéquipiers ──
  if(sp.id==='lien_chamanique'){
    const allies=[...actP(ati)].filter(p=>p!==carrier).sort((a,b)=>a.hp-b.hp).slice(0,2);
    allies.forEach(p=>{
      p.hp=100; p.mp=Math.min(100,(p.mp||0)+30);
      G.ptcl.push({t:'lbl',x:p.x,y:p.y-4,tx:'🔗 LIEN !',col:sp.col,l:50,m:50,sz:1.2});
      for(let i=0;i<10;i++) G.ptcl.push({t:'s',x:p.x,y:p.y,vx:(Math.random()-.5)*.8,vy:-Math.random()*.8,l:35,m:35,col:'#ff6f00',sz:.15+Math.random()*.3});
    });
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-5,tx:'🔗 LIEN CHAMANIQUE !',col:sp.col,l:60,m:60,sz:1.3});
    logEvent(`🔗 ${carrier.name} — Lien Chamanique ! Endurance restaurée !`,sp.col);
    return;
  }

  // ── PRODUITS DOPANTS ─────────────────────────────────────────────────────
  if(sp.id==='produits_dopants'){
    const stats=['sht','spd','tec','def'];
    const boosted=stats[Math.floor(Math.random()*stats.length)];
    const amount=irng(12,22);
    carrier['_dope_'+boosted]=(carrier['_dope_'+boosted]||0)+amount;
    carrier.s[boosted]=Math.min(99,carrier.s[boosted]+amount);
    // Endurance chute sévère
    carrier.s.stam=Math.max(1,carrier.s.stam-irng(18,28));
    carrier._dopeT=600; // ~10s
    spawnSpell(carrier.x,carrier.y,sp);
    G.ptcl.push({t:'lbl',x:carrier.x,y:carrier.y-4,tx:'💉 DOPING !',col:sp.col,l:60,m:60,sz:1.2});
    logEvent(`💉 ${carrier.name} — Produits Dopants ! +${amount} ${boosted.toUpperCase()} mais endurance en chute.`,sp.col);
    return;
  }

  // ── CORRUPTION ────────────────────────────────────────────────────────────
  if(sp.id==='corruption'){
    // Force le porteur adverse à faire une passe vers un membre de la PC (équipe du caster)
    const victim=G.owner;
    if(victim&&G.atkTi===dti){
      // Trouver un allié (team ati) proche
      const ally=pick(byR(ati,'MC','MO','ATT','MDC'));
      if(ally){
        freeB();
        giveB(ally);
        G.atkTi=ati;
        spawnSpell(victim.x,victim.y,sp);
        spawnSpell(ally.x,ally.y,sp);
        G.ptcl.push({t:'lbl',x:victim.x,y:victim.y-5,tx:'🌀 CORROMPU !',col:sp.col,l:70,m:70,sz:1.3});
        logEvent(`🌀 ${carrier.name} — Corruption ! ${victim.name} passe involontairement le ballon !`,sp.col);
        setPhase('TRANSITION');
      }
    }
    return;
  }
}

function goalScored(scorer,ati,goalX,assister){
  if(!scorer)return;
  // L'équipe qui marque est celle pour laquelle le scoreur joue VRAIMENT
  // (peut être différente si dominé)
  const scoringTeam=effTeam(scorer);
  G.scores[scoringTeam]++;scorer.mG++;
  if(assister&&assister!==scorer){assister.mA=(assister.mA||0)+1;}
  // Stocker l'événement pour le récap de fin
  if(!G._lastPasser) G._lastPasser=[null,null];
  G._lastPasser[scoringTeam]=null; // reset après but
  if(!G.matchEvents) G.matchEvents=[];
  G.matchEvents.push({type:'goal',min:G.minute,scorer:scorer.name,assister:assister&&assister!==scorer?assister.name:null,team:scoringTeam,col:teams[scoringTeam].color});
  const el=document.getElementById(`hs${scoringTeam}`);
  if(el)el.textContent=G.scores[scoringTeam];
  spawnGoal(goalX,PCY,teams[scoringTeam].color,scoringTeam);
  G.flash=1;G.flashCol=teams[scoringTeam].color;
  const assistTxt=assister&&assister!==scorer?` (assist: ${assister.name})`:'';
  logEvent(`⚽ BUT ! ${scorer.name} marque pour ${teams[scoringTeam].name}${assistTxt}`,teams[scoringTeam].color);
  freeB();
  G.running=false;
  G._celebrating=true;
  setTimeout(()=>{
    G._celebrating=false;
    if(G._paused||G.phase==='HALFTIME'||G.phase==='END')return;
    showTacBtns(true);G.running=true;placeKickoff(1-scoringTeam);setPhase('KICKOFF');
  },2200/speedMult);
}

// ═══════════════════════════════════════════════════════════
// PARTICLES
// ═══════════════════════════════════════════════════════════