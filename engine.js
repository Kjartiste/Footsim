// ═══════════════════════════════════════════════════
// ENGINE.JS — Moteur physique, roleTarget, physStep
// ═══════════════════════════════════════════════════
function roleTarget(ti,p,pi){
  if(p.red)return{x:-5,y:PCY};
  const b=G.ball,isAtk=G.atkTi===ti;
  const myGoalX=ti===0?0:WW,oppGoalX=ti===0?WW:0,fwd=ti===0?1:-1;
  const fb=formBase(ti,pi);

  // ── Mode 11v11 : logique simplifiée comme la version épurée ──────────
  // Désactivée par défaut : le 11v11 utilise le placement riche du 7v7.
  if(window._legacy11v11 && window.gameMode === '11v11'){
    if(p.pos==='GB'){
      return{x:ti===0?1.5:WW-1.5, y:clamp(b.y, GY1+.8, GY2-.8)};
    }
    const isAtt = ['ATT','ATT2','AG','AD','MO'].includes(p.pos);
    const isMid = ['MC','MCD','MCG','MDC','MDC2','MOG','MOD'].includes(p.pos);
    const isDef = ['DC','DCD','DCG','DD','DG','LB','RB'].includes(p.pos);

    if(isAtk){
      switch(G.phase){
        case 'KICKOFF': return {x:clamp(fb.x, ti===0?0.5:PCX+0.3, ti===0?PCX-0.3:WW-0.5), y:fb.y};
        case 'BUILDUP':
          if(p.hasBall) return{x:clamp(b.x+fwd*rng(2,7),2,WW-2),y:clamp(b.y+rng(-4,4),1,WH-1)};
          return{x:clamp(fb.x+fwd*rng(0,5),2,WW-2),y:clamp(fb.y+rng(-4,4),1,WH-1)};
        case 'ATTACK':
          if(p.hasBall) return{x:clamp(b.x+fwd*rng(3,10),2,WW-2),y:clamp(b.y+rng(-5,5),1,WH-1)};
          if(isAtt) return{x:clamp(oppGoalX+(ti===0?rng(-25,-3):rng(3,25)),2,WW-2),y:clamp(PCY+(Math.random()-.5)*32,2,WH-2)};
          if(isMid) return{x:clamp(fb.x+fwd*rng(3,10),2,WW-2),y:clamp(fb.y+rng(-6,6),2,WH-2)};
          return{x:clamp(fb.x+fwd*rng(2,6),2,WW-2),y:clamp(fb.y+rng(-4,4),2,WH-2)};
        case 'TRANSITION':
          if(p.hasBall) return{x:clamp(b.x+fwd*rng(5,14),2,WW-2),y:clamp(PCY+rng(-14,14),2,WH-2)};
          if(isAtt) return{x:clamp(oppGoalX+(ti===0?rng(-30,-6):rng(6,30)),2,WW-2),y:clamp(PCY+(Math.random()-.5)*28,2,WH-2)};
          return{x:clamp(fb.x+fwd*rng(2,8),2,WW-2),y:clamp(fb.y+rng(-5,5),2,WH-2)};
        case 'CORNER':
          if(isDef) return{x:clamp(fb.x,2,WW-2),y:fb.y};
          return{x:clamp(oppGoalX+(ti===0?rng(-20,-2):rng(2,20)),2,WW-2),y:clamp(PCY+(Math.random()-.5)*22,2,WH-2)};
        case 'FREEKICK':
          if(isAtt||isMid) return{x:clamp(oppGoalX+(ti===0?rng(-18,-2):rng(2,18)),2,WW-2),y:clamp(PCY+(Math.random()-.5)*22,2,WH-2)};
          return{x:clamp(fb.x+fwd*rng(2,6),2,WW-2),y:clamp(fb.y+rng(-3,3),2,WH-2)};
        default: return fb;
      }
    } else {
      switch(G.phase){
        case 'ATTACK':case 'BUILDUP':case 'TRANSITION':{
          if(isDef){
            const bkX=clamp(lerp(myGoalX,b.x,.35)+rng(-5,5),ti===0?2:WW*.4,ti===0?WW*.6:WW-2);
            return{x:bkX,y:clamp(b.y+rng(-10,10),2,WH-2)};
          }
          if(isMid) return{x:clamp(lerp(myGoalX,b.x,.55)+rng(-6,6),2,WW-2),y:clamp(fb.y+rng(-7,7),2,WH-2)};
          return{x:clamp(fb.x+rng(-6,6),2,WW-2),y:clamp(fb.y+rng(-5,5),2,WH-2)};
        }
        case 'CORNER':
          return{x:clamp(myGoalX+(ti===0?rng(2,18):rng(-18,-2)),2,WW-2),y:clamp(PCY+(Math.random()-.5)*22,2,WH-2)};
        default:
          return{x:clamp(fb.x+rng(-4,4),2,WW-2),y:clamp(fb.y+rng(-4,4),2,WH-2)};
      }
    }
  }

  // ── Mode 7v7 : logique originale complète ────────────────────────────
  const now=Date.now()*.001;
  // Tactical parameters of the player's own team
  const myStrat=strat(ti);
  const press=myStrat.press||.5;
  const attDepth=myStrat.attDepth||0;
  const midPush=myStrat.midPush||1;
  const runFreq=myStrat.runFreq||1;

  // Organic wander — reduced amplitude to stop trembling, keep feeling alive
  const freedom=p.pos==='GB'?0:
    p.pos==='ATT'||p.pos==='ATT2'||p.pos==='MO'?1.0:
    p.pos==='AG'||p.pos==='AD'||p.pos==='MOG'||p.pos==='MOD'?0.9:
    p.pos==='MC'||p.pos==='MDC'||p.pos==='MDC2'||p.pos==='MCD'||p.pos==='MCG'?0.7:0.5;
  const wX=Math.sin(now*p.wSpeed*0.3+p.wPhaseX)*freedom;
  const wY=Math.cos(now*p.wSpeed*0.3*0.83+p.wPhaseY)*freedom;

  // GK — hug goal line, track predicted ball Y
  if(p.pos==='GB'){
    const pred=ballPredict(.4);
    const ballNear=ti===0?b.x<WW*0.33:b.x>WW*0.67;
    // High-pressing teams have a sweeper-keeper who steps off the line more
    // (BUG corrigé : G.teams[ti].form n'a jamais existé — form n'était jamais
    // assigné nulle part, donc is133/is322 étaient TOUJOURS false et le
    // gardien sweeur du 1-3-3/3-2-2 ne s'activait jamais. La bonne référence
    // est teams[ti].strat.)
    const is133=teams[ti]&&teams[ti].strat==='133';
    const is322=teams[ti]&&teams[ti].strat==='222';
    const gkMult=is133?2.2:is322?1.8:1;
    const gkMax=is133?4.0:is322?3.2:1.6;
    const offLine=ballNear?clamp(Math.abs(pred.x-myGoalX)*.04*(1+press*.6)*gkMult,0,gkMax+press*.8):0;
    return{x:(ti===0?1.2:WW-1.2)+(ti===0?offLine:-offLine),
           y:clamp(pred.y+rng(-.4,.4),GY1+.5,GY2-.5)};
  }

  // Off-the-ball runs — frequency modulated by tactic
  // Player role: 'atk' increases run frequency, 'def' suppresses it
  const pRole=(G.playerRoles[ti]||[])[pi]||'normal';
  const roleRunMod=pRole==='atk'?1.6:pRole==='def'?0.2:1.0;
  if(isAtk&&!p.hasBall&&p.runT<=0&&p.runCool<=0&&(
    p.pos==='ATT'||p.pos==='ATT2'||p.pos==='MO'||
    p.pos==='AG'||p.pos==='AD'||p.pos==='MOG'||p.pos==='MOD'||
    p.pos==='MC'||p.pos==='MCD'||p.pos==='MCG')){
    const ballAhead=ti===0?b.x>p.x-5:b.x<p.x+5;
    const phaseOK=G.phase==='ATTACK'||G.phase==='TRANSITION'||G.phase==='BUILDUP';
    if(phaseOK&&ballAhead&&Math.random()<0.35*runFreq*roleRunMod){
      p.runT=1.4+Math.random()*1.6;
      p.runCool=(2.0+Math.random()*2)/runFreq;  // pressing teams recover faster
      const myWidth=(strat(ti).width)||1.0;
      // Width: >1 = jeu sur les ailes, <1 = jeu dans l'axe
      const flankBias=myWidth>1?(myWidth-1)*2.5:0;       // pousse vers les flancs
      const axisBias=myWidth<1?(1-myWidth)*2.5:0;        // pousse vers le centre
      const baseSide=p.pos==='AG'?-1:p.pos==='AD'?1:(Math.random()-.5)*1.8;
      const sideBias=baseSide*(1+flankBias)-Math.sign(baseSide)*axisBias;
      const lateralSpread=rng(3,14)*(0.5+myWidth*0.6);   // amplitude latérale selon largeur
      p.runTx=clamp(oppGoalX+(ti===0?-rng(3,18):rng(3,18)),4,WW-4);
      p.runTy=clamp(PCY+sideBias*lateralSpread,3,WH-3);
    }
  }
  if(p.runT>0){
    return{x:p.runTx+wX*.6,y:p.runTy+wY*.6};
  }

  if(isAtk){
    switch(G.phase){
      case 'KICKOFF':{
        const kMin=ti===0?0.5:PCX+0.3;
        const kMax=ti===0?PCX-0.3:WW-0.5;
        return{x:clamp(fb.x,kMin,kMax),y:fb.y};
      }
      case 'GOALKICK':{
        // Équipe qui va dégager : se replacer, ne pas courir partout
        return{x:clamp(fb.x+wX*.2,1,WW-1),y:clamp(fb.y+wY*.2,1,WH-1)};
      }
      case 'BUILDUP':{
        if(p.hasBall){
          const curve=Math.sin(now*2.4+p.wPhaseX)*2.5;
          return{x:clamp(b.x+fwd*rng(2,5)+wX*.4,2,WW-2),y:clamp(b.y+curve+wY*.6,1,WH-1)};
        }
        // Off-ball: mids push up with midPush; attackers hold attDepth higher
        const isAttacker=p.pos==='ATT'||p.pos==='ATT2'||p.pos==='MO'||p.pos==='AG'||p.pos==='AD';
        const isMid=p.pos==='MC'||p.pos==='MDC'||p.pos==='MDC2'||p.pos==='MCD'||p.pos==='MCG';
        const depthBonus=isAttacker?attDepth:isMid?attDepth*midPush*.4:0;
        return{x:clamp(fb.x+fwd*(rng(0,4)+depthBonus)+wX,2,WW-2),y:clamp(fb.y+wY,1,WH-1)};
      }
      case 'ATTACK':{
        if(p.hasBall){
          const curve=Math.sin(now*3+p.wPhaseX)*3;
          const push=4+(p.s.tec/99)*4;
          return{x:clamp(b.x+fwd*push+wX*.5,2,WW-2),y:clamp(b.y+curve+wY*.6,1,WH-1)};
        }
        if(p.pos==='MOG'||p.pos==='MOD'){
          // Lateral midfielders hug the flanks
          const cycle=Math.sin(now*1.2+p.wPhaseX);
          const boxPush=ti===0?-rng(4,12)-attDepth*.6:rng(4,12)+attDepth*.6;
          const mogWidth=strat(ti).width||1.0;
          const sideY=p.pos==='MOG'
            ?clamp(PCY*(0.3-(mogWidth-1)*0.12)+cycle*2+wY*.5,1,PCY*.6)
            :clamp(PCY*(1.45+(mogWidth-1)*0.12)+cycle*2+wY*.5,PCY*1.4,WH-1);
          return{x:clamp(oppGoalX+boxPush+wX*.5,2,WW-2), y:sideY};
        }
        if(p.pos==='ATT'||p.pos==='ATT2'||p.pos==='MO'||p.pos==='AG'||p.pos==='AD'){
          // Strikers prowl in box — direct tactics push deeper into box
          const cycle=Math.sin(now*1.2+p.wPhaseX);
          const boxPush=ti===0?-rng(2,16)-attDepth:rng(2,16)+attDepth;
          return{x:clamp(oppGoalX+boxPush+wX*.7,2,WW-2),
                 y:clamp(PCY+cycle*9+wY*1.2,2,WH-2)};
        }
        // DD/DG en débordement: rester haut sur le côté
        if((p.pos==='DD'||p.pos==='DG')&&p.runT>0){
          const sideMul=p.pos==='DD'?1:-1;
          return{x:clamp(oppGoalX+(ti===0?-rng(4,14):rng(4,14))+wX*.5,2,WW-2),
                 y:clamp(PCY+sideMul*(WH*.33)+wY*1.2,2,WH-2)};
        }
        if(p.pos==='MC'||p.pos==='MDC'){
          // Mids support attack proportional to midPush
          return{x:clamp(fb.x+fwd*(rng(3,9)*midPush)+wX,2,WW-2),y:clamp(fb.y+wY*1.5,2,WH-2)};
        }
        // Defenders push up only modestly for high-press tactics
        return{x:clamp(fb.x+fwd*rng(3,9)*(.7+press*.6)+wX,2,WW-2),y:clamp(fb.y+wY*1.5,2,WH-2)};
      }
      case 'TRANSITION':{
        if(p.hasBall){
          return{x:clamp(b.x+fwd*rng(5,11)+wX*.4,2,WW-2),y:clamp(b.y+wY*1.2,2,WH-2)};
        }
        if(p.pos==='ATT'||p.pos==='ATT2'||p.pos==='MO'||p.pos==='AG'||p.pos==='AD'){
          // Counter-attack: depth-tactic attackers run further into space
          const counterDepth=ti===0?-rng(4,20)-attDepth*1.5:rng(4,20)+attDepth*1.5;
          return{x:clamp(oppGoalX+counterDepth+wX,2,WW-2),
                 y:clamp(PCY+rng(-WH*0.2,WH*0.2)+wY,2,WH-2)};
        }
        return{x:clamp(fb.x+fwd*(rng(2,7)*midPush)+wX,2,WW-2),y:clamp(fb.y+wY*1.2,2,WH-2)};
      }
      case 'CORNER':
        if(p.pos==='GB'||p.pos==='DD'||p.pos==='DG')return{x:fb.x,y:fb.y};
        return{x:clamp(oppGoalX+(ti===0?-rng(1,12):rng(1,12))+wX*.8,2,WW-2),
               y:clamp(PCY+rng(-WH*0.14,WH*0.14)+wY*1.2,2,WH-2)};
      case 'FREEKICK':
        if(p.pos==='ATT'||p.pos==='ATT2'||p.pos==='MO'||p.pos==='AG'||p.pos==='AD')
          return{x:clamp(oppGoalX+(ti===0?-rng(2,12):rng(2,12))+wX,2,WW-2),
                 y:clamp(PCY+rng(-WH*0.14,WH*0.14)+wY,2,WH-2)};
        return{x:clamp(fb.x+fwd*rng(2,5)+wX,2,WW-2),y:clamp(fb.y+wY,2,WH-2)};
      default:return{x:fb.x+wX*.7,y:fb.y+wY*.7};
    }
  } else {
    // DEFENDING TEAM — realistic coordinated pressing
    switch(G.phase){
      case 'KICKOFF':{
        const dMin=ti===0?0.5:PCX+0.3, dMax=ti===0?PCX-0.3:WW-0.5;
        return{x:clamp(fb.x,dMin,dMax),y:fb.y};
      }
      case 'GOALKICK':{
        const gkMin=ti===0?1:PCX+1, gkMax=ti===0?PCX-1:WW-1;
        return{x:clamp(fb.x,gkMin,gkMax),y:fb.y};
      }
      case 'FREEKICK':{
        // Mur défensif : 2-3 défenseurs s'alignent entre le ballon et le but,
        // à ~9 unités du ballon, perpendiculairement à l'axe ballon→but.
        const wallers=G._fkWall||[];
        const wi=wallers.indexOf(p.id);
        if(wi>=0){
          const gx=myGoalX, gy=PCY;
          const dirx=gx-G.ball.x, diry=gy-G.ball.y;
          const dl=Math.hypot(dirx,diry)||1;
          const ux=dirx/dl, uy=diry/dl;          // vers son propre but
          const px=-uy, py=ux;                     // perpendiculaire (pour étaler le mur)
          const dist=9;                            // distance réglementaire du ballon
          const bx=G.ball.x+ux*dist, by=G.ball.y+uy*dist;
          const spread=(wi-(wallers.length-1)/2)*1.6; // écart entre équipiers du mur
          return{x:clamp(bx+px*spread,2,WW-2),y:clamp(by+py*spread,2,WH-2)};
        }
        // Les autres défenseurs se replient devant leur but pour couvrir.
        return{x:clamp(lerp(fb.x,myGoalX,0.25)+wX*.3,2,WW-2),y:clamp(fb.y+wY*.3,2,WH-2)};
      }
      case 'ATTACK':case 'BUILDUP':case 'TRANSITION':{
        const pred   = ballPredict(.4);
        const myStr  = strat(ti);
        const pressLine = myStr.pressLine||0;
        // stratWidth: >1 = large/étiré, <1 = compact/resserré — utilisé plus bas
        // pour vraiment resserrer la LIGNE (Y), ce que "defWidth" ne faisait pas
        // avant (variable calculée puis jamais utilisée nulle part).
        const stratWidth = myStr.width||1.0;
        // compactPull: 0 = neutre (width=1), >0 = tire les joueurs vers l'axe
        // central (width<1, bloc resserré), <0 = laisse plus de liberté latérale
        // (width>1, bloc étiré). Plafonné pour rester lisible.
        const compactPull = clamp((1-stratWidth)*0.9, -0.35, 0.55);
        // lineDepth: valeur BRUTE du curseur "Ligne défensive" (-1 = bloc bas
        // profond, +1 = ligne haute/hors-jeu tendus), indépendante du pressing.
        const lineDepth = myStr.lineDepth||0;

        // ── Le porteur est-il le GB adverse ? → ne pas foncer dessus
        // Ne pas presser si : GB adverse a le ballon, phase GOALKICK, cooldown actif,
        // OU si le ballon est dans la surface du BUT ADVERSE (zone de dégagement)
        const ballNearOppGoal = ti===0
          ? G.ball.x > WW-PA_W && G.ball.y>GY1-PA_H/2 && G.ball.y<GY2+PA_H/2
          : G.ball.x < PA_W    && G.ball.y>GY1-PA_H/2 && G.ball.y<GY2+PA_H/2;
        const ballOwnerIsGB = (G.owner && G.owner.pos==='GB') || G.phase==='GOALKICK' || (G.gkCoolT||0)>0 || ballNearOppGoal;

        // ── Cache nearest (hors GB)
        const nearestToBall = G._pressNearest?.[ti] || null;
        const isNearest = p === nearestToBall && p.pos !== 'GB';
        const myDist    = Math.hypot(p.x-G.ball.x, p.y-G.ball.y);
        const nearDist  = nearestToBall ? Math.hypot(nearestToBall.x-G.ball.x,nearestToBall.y-G.ball.y) : 9999;
        const isClose   = myDist < nearDist*1.5 && myDist < 18;

        // Rôle individuel
        const roleOverride = (G.playerRoles[ti]||[])[pi] || 'normal';
        const rolePushFwd  = roleOverride==='atk' ? 5 : roleOverride==='def' ? -5 : 0;

        // ── Zone de danger (tiers défensif)
        const dangerThresh = ti===0 ? WW*0.55 : WW*0.45;
        const ballInDanger = ti===0 ? G.ball.x < dangerThresh : G.ball.x > dangerThresh;

        // ── Zone de press
        const pressZoneX     = ti===0 ? lerp(WW*0.28,WW*0.72,pressLine) : lerp(WW*0.28,WW*0.72,1-pressLine);
        // Séparation stricte des deux curseurs : "Zone de press" décide QUAND/OÙ
        // le pressing collectif peut se déclencher (uniquement géométrique),
        // "Pressing" décide seulement de son INTENSITÉ (combien de joueurs
        // convergent une fois dans la zone). Les deux ne doivent pas se
        // neutraliser ou se substituer l'un à l'autre.
        const ballInPressZone= ti===0 ? G.ball.x > pressZoneX : G.ball.x < pressZoneX;
        const effectivePress = ballInPressZone ? press : press*0.2;

        // ── Pressing collectif : plus le curseur de pressing est élevé, plus
        // de joueurs (au-delà du seul plus proche) foncent ensemble sur le
        // porteur — quand le ballon est dans la zone de press.
        // press va typiquement de ~0.05 (bloc bas) à ~1.5 (pressing extrême).
        const pressOrder    = G._pressOrder?.[ti] || [];
        const myPressRank   = pressOrder.indexOf(p);
        const pressJoinCount= press<0.4 ? 1 : press<0.8 ? 2 : press<1.2 ? 3 : 4;
        // ── Soutien de duel : si le plus proche défenseur est déjà au contact
        // direct du porteur (duel rapproché, distance de tacle), les autres
        // viennent aider MÊME hors zone de press — un coéquipier engagé dans
        // un duel doit toujours pouvoir compter sur du soutien, pas seulement
        // quand le ballon est dans la zone de pressing habituelle.
        const isDuelHappening = nearDist < 5;
        const duelHelpCount   = isDuelHappening ? Math.max(2,pressJoinCount) : 0;
        const isGangPressing  = p.pos!=='GB' && myPressRank>=0 &&
          ((ballInPressZone && myPressRank<pressJoinCount) || (isDuelHappening && myPressRank<duelHelpCount));

        // ── Ligne défensive anchor
        // AVANT : uniquement piloté par le pressing (press/pressLine) — le
        // curseur "Ligne défensive" ne bougeait jamais réellement la ligne.
        // Un premier correctif l'a rendu additif au pressing, MAIS un pressing
        // élevé pouvait alors quand même repousser la ligne vers l'avant même
        // avec un réglage "ligne défensive" au minimum (les défenseurs
        // sortaient de la surface). MAINTENANT : lineDepth fixe un PLAFOND
        // dominant que le pressing ne peut pas dépasser — en bloc bas extrême,
        // la ligne colle littéralement près du but (quelques mètres devant le
        // gardien), quel que soit le pressing.
        const pressContribution = (press+pressLine*0.2)*0.5;
        const lineDepthCap = lerp(0.02, 0.96, (lineDepth+1)/2); // -1→0.02 (colle au but), +1→0.96 (quasi libre)
        const lineT = clamp(Math.min(pressContribution + lineDepth*0.35, lineDepthCap), 0.02, 0.96);
        const lineAnchor = ti===0
          ? lerp(myGoalX+2, PCX*1.1, lineT)
          : lerp(myGoalX-2, PCX*0.9, lineT);

        // ══════════════════════════════════════════════════
        // GARDIEN ADVERSE : par défaut on ne presse pas, on tient la forme —
        // SAUF à pressing élevé, où un vrai pressing haut moderne va chercher
        // le gardien adverse jusque dans sa surface (nombre de presseurs
        // scalé sur le curseur "Pressing", comme le pressing collectif).
        // ══════════════════════════════════════════════════
        if(ballOwnerIsGB){
          const gkPressCount = press<0.9 ? 0 : press<1.2 ? 1 : press<1.4 ? 2 : 3;
          if(gkPressCount>0 && p.pos!=='GB' && myPressRank>=0 && myPressRank<gkPressCount){
            return{x:clamp(lerp(p.x,G.ball.x,0.7),1,WW-1),
                   y:clamp(lerp(p.y,G.ball.y,0.7),1,WH-1),
                   pressing:true};
          }
          // GB adverse a le ballon ou dégagement en cours → le reste de l'équipe
          // tient le bloc. Limiter TOUTE l'équipe à son côté du terrain (ne pas
          // monter vers le GB) sauf les presseurs désignés ci-dessus.
          const holdLimitX = ti===0
            ? Math.min(fb.x, PCX*0.85)   // Rouges : max à 40% du terrain
            : Math.max(fb.x, PCX*1.15);  // Bleus  : min à 60% du terrain
          return{x:clamp(holdLimitX+wX*.2,1,WW-1),
                 y:clamp(fb.y+wY*.2,1,WH-1)};
        }

        // ══════════════════════════════════════════════════
        // PRIORITÉ 1 : isNearest (toujours) OU isGangPressing (pressing
        // collectif selon le curseur, si le ballon est dans la zone de press)
        // → foncent TOUJOURS sur le porteur
        // pressing:true est lu plus loin (physStep) pour donner à TOUS ces
        // joueurs le même boost de vitesse que le presseur principal — sinon
        // ils visent bien le ballon mais avancent à vitesse normale et
        // n'arrivent jamais en pratique.
        // ══════════════════════════════════════════════════
        if(isNearest || isGangPressing){
          return{x:clamp(lerp(p.x,G.ball.x,0.7),1,WW-1),
                 y:clamp(lerp(p.y,G.ball.y,0.7),1,WH-1),
                 pressing:true};
        }

        // ══════════════════════════════════════════════════
        // PRIORITÉ 2 : DD/DG → rentrent TOUJOURS vers l'axe
        // pour aider le DC seul
        // ══════════════════════════════════════════════════
        if(p.pos==='DD'||p.pos==='DG'){
          // followBall : plus la ligne défensive est basse (lineDepth<0),
          // moins les latéraux suivent le ballon et plus ils restent ancrés
          // sur lineAnchor (donc dans/près de la surface en bloc bas extrême).
          const followBall = clamp(0.25 + lineDepth*0.18, 0.05, 0.50);
          const tx = lerp(lineAnchor, pred.x, followBall + effectivePress*0.18);
          // DD/DG rentrent franchement vers l'axe pour soutenir le DC
          // Plus le danger est grand ou le ballon est central, plus ils rentrent
          // + compactPull (curseur Largeur) : un bloc resserré (width<1) les
          // fait rentrer encore plus ; un bloc étiré (width>1) leur laisse
          // reprendre leur couloir.
          const ballCentrality = 1 - Math.abs(G.ball.y - PCY) / PCY; // 1=ballon centré
          const centralBias = clamp((ballInDanger
            ? 0.80                                              // danger → très à l'intérieur
            : 0.50 + ballCentrality*0.20)                       // sinon selon centralité du ballon
            + compactPull*0.5, 0.10, 0.95);
          // Rentrer vers PCY (centre vertical) progressivement
          const ty = lerp(p.y, PCY, centralBias*0.5);
          return{x:clamp(tx+rolePushFwd*fwd+wX*.25,2,WW-2),
                 y:clamp(ty+wY*.25,2,WH-2)};
        }

        // ══════════════════════════════════════════════════
        // PRIORITÉ 3 : joueurs proches → couvrir les lanes
        // (même sans pressing élevé, ET toujours si le ballon est dans son
        // propre tiers défensif — le marquage rapproché en zone dangereuse
        // ne doit pas dépendre de "Hauteur du pressing" : un pressing haut
        // qui ne se déclenche que très loin du but ne doit pas laisser
        // l'adversaire totalement libre de tout marquage une fois proche
        // de ses propres buts)
        // ══════════════════════════════════════════════════
        if(isClose && (ballInPressZone || effectivePress > 0.2 || ballInDanger)){
          // Se placer entre porteur et but, légèrement excentré en Y
          // Bloc bas (lineDepth<0) : on se replie beaucoup plus franchement
          // vers son propre but au lieu de rester collé au ballon.
          const goalPull = clamp(0.18 - lineDepth*0.45, 0.05, 0.82);
          const shX = lerp(G.ball.x, myGoalX, goalPull);
          const shY = lerp(G.ball.y, PCY,     0.12);
          return{x:clamp(shX+wX*.15,2,WW-2), y:clamp(shY+wY*.15,2,WH-2)};
        }

        // ══════════════════════════════════════════════════
        // FORME DÉFENSIVE selon position
        // ══════════════════════════════════════════════════
        if(p.pos==='DC'||p.pos==='DCD'||p.pos==='DCG'){
          const followBallDC = clamp(0.28 + lineDepth*0.20, 0.05, 0.55);
          const tx = lerp(lineAnchor, pred.x, followBallDC + effectivePress*0.18);
          const is222dc = teams[ti].strat==='222';
          const dcCentral = clamp(0.35+compactPull*0.7, 0.05, 0.95);
          const dcY = is222dc
            ? lerp(p.y, PCY, 0.25)
            : lerp(p.y, lerp(pred.y,PCY,dcCentral), 0.35);
          return{x:clamp(tx+rolePushFwd*fwd+wX*.3,2,WW-2),
                 y:clamp(dcY+wY*.25,2,WH-2)};
        }
        // LB/RB : comme DD/DG
        if(p.pos==='DD'||p.pos==='DG'||p.pos==='LB'||p.pos==='RB'){
          const followBall = clamp(0.25 + lineDepth*0.18, 0.05, 0.50);
          const tx = lerp(lineAnchor, pred.x, followBall + effectivePress*0.18);
          const ballCentrality = 1 - Math.abs(G.ball.y - PCY) / PCY;
          const centralBias = clamp((ballInDanger?0.80:0.50+ballCentrality*0.20)+compactPull*0.5, 0.10, 0.95);
          const ty = lerp(p.y, PCY, centralBias*0.5);
          return{x:clamp(tx+rolePushFwd*fwd+wX*.25,2,WW-2),
                 y:clamp(ty+wY*.25,2,WH-2)};
        }
        if(p.pos==='MC'||p.pos==='MDC'||p.pos==='MDC2'||p.pos==='MCD'||p.pos==='MCG'){
          if(ballInPressZone && press > 0.45){
            const af = 0.22+press*0.32;
            return{x:clamp(lerp(p.x,pred.x,af)+rolePushFwd*fwd+wX*.25,2,WW-2),
                   y:clamp(lerp(p.y,pred.y,af)+wY*.3,2,WH-2)};
          }
          const followBallMid = clamp(0.38 + lineDepth*0.12, 0.10, 0.55);
          const tx = lerp(lineAnchor, pred.x, followBallMid + effectivePress*0.18);
          const midY = lerp(pred.y, PCY, clamp(compactPull*0.6,0,0.6));
          return{x:clamp(tx+rolePushFwd*fwd+wX*.4,2,WW-2),
                 y:clamp(lerp(p.y,midY,.28)+wY*.5,2,WH-2)};
        }
        if(p.pos==='MOG'||p.pos==='MOD'||p.pos==='MO'||p.pos==='MCG'||p.pos==='MCD'){
          const is222=teams[ti].strat==='222';
          if(is222){
            const defX=lerp(lineAnchor,pred.x,0.3+effectivePress*0.15);
            const sideY=p.pos==='MOG'?PCY*0.55:PCY*1.45;
            return{x:clamp(defX+wX*.3,2,WW-2),y:clamp(lerp(p.y,sideY,0.3)+wY*.3,2,WH-2)};
          }
          if(ballInPressZone&&press>0.3){const af=0.25+press*0.45;return{x:clamp(lerp(p.x,pred.x,af)+wX*.15,2,WW-2),y:clamp(lerp(p.y,pred.y,af)+wY*.15,2,WH-2)};}
          if(effectivePress>0.2){return{x:clamp(lerp(fb.x,pred.x,0.35+effectivePress*0.25)+rolePushFwd*fwd+wX*.3,2,WW-2),y:clamp(lerp(p.y,pred.y,.3)+wY*.4,2,WH-2)};}
          return{x:clamp(fb.x+rolePushFwd*fwd+wX*.5,2,WW-2),y:clamp(fb.y+wY*.6,2,WH-2)};
        }
        if(p.pos==='ATT'||p.pos==='ATT2'||p.pos==='MO'||p.pos==='AG'||p.pos==='AD'){
          if(ballInPressZone&&press>0.3){const af=0.25+press*0.45;return{x:clamp(lerp(p.x,pred.x,af)+wX*.15,2,WW-2),y:clamp(lerp(p.y,pred.y,af)+wY*.15,2,WH-2)};}
          if(effectivePress>0.2){return{x:clamp(lerp(fb.x,pred.x,0.35+effectivePress*0.25)+rolePushFwd*fwd+wX*.3,2,WW-2),y:clamp(lerp(p.y,pred.y,.3)+wY*.4,2,WH-2)};}
          return{x:clamp(fb.x+rolePushFwd*fwd+wX*.5,2,WW-2),y:clamp(fb.y+wY*.6,2,WH-2)};
        }
        return{x:clamp(fb.x+rolePushFwd*fwd+wX*.5,2,WW-2),
               y:clamp(fb.y+wY*.6,2,WH-2)};
      }
      case 'CORNER':
        return{x:clamp(myGoalX+(ti===0?rng(2,12):-rng(2,12))+wX*.8,2,WW-2),
               y:clamp(PCY+rng(-8,8)+wY*1.2,2,WH-2)};
      default:return{x:fb.x+wX,y:fb.y+wY};
    }
  }
}

// ═══════════════════════════════════════════════════════════
// PHYSICS
// ═══════════════════════════════════════════════════════════
const MAX_SPD=8.5,MIN_SPD=2.5,BALL_FRIC=.965,SEP=2.2,PICK_R=1.9;

function physStep(dt,rawDt){
  const now=Date.now()*.001;

  // ── Mode 11v11 : physique complète avec fonctionnalités 7v7 ──────────
  // NOTE : le 11v11 utilise désormais le MÊME moteur riche que le 7v7
  // (mouvement organique, tirs spatiaux, tacles, marquage). L'ancienne
  // version « épurée » ci-dessous est conservée mais désactivée
  // (window._legacy11v11 = true pour la réactiver).
  if(window._legacy11v11 && window.gameMode === '11v11'){
    const SEP11=1.6, PICK11=1.4;
    if(!G._pressNearest)G._pressNearest=[null,null];
    if(!G._pressOrder)G._pressOrder=[[],[]];

    // Mise à jour cache pressing (même logique que 7v7)
    if(Math.random()<0.28){
      [0,1].forEach(ti=>{
        const mp=actP(ti).filter(q=>q.pos!=='GB');
        const sorted=mp.map(q=>({q,d:Math.hypot(q.x-G.ball.x,q.y-G.ball.y)})).sort((a,b)=>a.d-b.d).map(o=>o.q);
        G._pressOrder[ti]=sorted;
        G._pressNearest[ti]=sorted[0]||null;
      });
    }

    teams.forEach((T,ti)=>T.players.forEach((p,pi)=>{
      if(p.red||p.hp<=0){p.x=lerp(p.x,-6,.03);return;}
      if(p.stunT>0)p.stunT=Math.max(0,p.stunT-dt*60);
      p.bobPhase=(p.bobPhase||0)+dt*2.8;
      if(p.runT>0)p.runT=Math.max(0,p.runT-dt);
      if(p.runCool>0)p.runCool=Math.max(0,p.runCool-dt);
      if(p.tackleCool>0)p.tackleCool=Math.max(0,p.tackleCool-dt);

      // Buffs/debuffs (même système que 7v7)
      if(p._spdDebuff>0)p._spdDebuff=Math.max(0,p._spdDebuff-dt);
      if(p._charmed>0)p._charmed=Math.max(0,p._charmed-dt);
      if(p._atkBuff>0)p._atkBuff=Math.max(0,p._atkBuff-dt);
      if(p._pacified>0)p._pacified=Math.max(0,p._pacified-dt);
      if(p._invis>0)p._invis=Math.max(0,p._invis-dt);
      if(p._folie>0)p._folie=Math.max(0,p._folie-dt);
      if(p._aile>0)p._aile=Math.max(0,p._aile-dt);
      if(p._sixsens>0)p._sixsens=Math.max(0,p._sixsens-dt);
      if(p._sylvestre>0)p._sylvestre=Math.max(0,p._sylvestre-dt);

      const t=roleTarget(ti,p,pi);
      p.tx=lerp(p.tx||t.x,t.x,.10);
      p.ty=lerp(p.ty||t.y,t.y,.10);

      const spdBase=p.s.spd*(1-(p._spdDebuff||0)*0.4);
      const maxSpd=MIN_SPD+(MAX_SPD-MIN_SPD)*(spdBase/99);
      const aileBoost=p._aile>0?1.45:1;
      const eff=(p.stunT>0?maxSpd*.2:maxSpd)*aileBoost;
      const dx=p.tx-p.x,dy=p.ty-p.y,d=Math.hypot(dx,dy);
      if(d>0.15){
        const nx=dx/d,ny=dy/d;
        p.vx=lerp(p.vx||0,nx*eff,.20);
        p.vy=lerp(p.vy||0,ny*eff,.20);
      } else {p.vx=(p.vx||0)*.75;p.vy=(p.vy||0)*.75;}

      p.x=clamp((p.x||PCX)+(p.vx||0)*dt,0,WW);
      p.y=clamp((p.y||PCY)+(p.vy||0)*dt,0,WH);

      // Séparation
      teams.forEach((T2)=>T2.players.forEach(p2=>{
        if(p2===p||p2.red||p2.hp<=0)return;
        const dx2=p.x-p2.x,dy2=p.y-p2.y,d2=Math.hypot(dx2,dy2);
        if(d2<SEP11&&d2>.01){const push=(SEP11-d2)/SEP11*.12;p.x+=dx2/d2*push;p.y+=dy2/d2*push;}
      }));

      // Fatigue — même calcul que 7v7
      const stamFactor=1.1-p.s.stam/99;
      p.hp=Math.max(0,p.hp-0.003*dt*60*stamFactor);
      p.mp=Math.min(100,p.mp+0.018*dt*60);

      // Blessure de fatigue (même prob que 7v7)
      if(p.hp<15&&p.injLevel===0&&Math.random()<dt*0.008){
        if(typeof injurePlayer==='function') injurePlayer(ti,p,false);
      }
    }));

    // Substitutions automatiques (blessures)
    if(typeof processPendingSubs==='function') processPendingSubs();

    // Timers globaux
    if(G.gegenT){G.gegenT[0]=Math.max(0,(G.gegenT[0]||0)-dt);G.gegenT[1]=Math.max(0,(G.gegenT[1]||0)-dt);}
    if(G.gkCoolT>0)G.gkCoolT=Math.max(0,G.gkCoolT-dt);
    if(G._gkSpellCool){G._gkSpellCool[0]=Math.max(0,(G._gkSpellCool[0]||0)-dt);G._gkSpellCool[1]=Math.max(0,(G._gkSpellCool[1]||0)-dt);}

    // Balle — même logique que 7v7 avec corners auto
    const b=G.ball;
    const own=ownerP();
    if(own&&own.hasBall){
      b.x=lerp(b.x,own.x+(own.vx||0)*dt*.5,.26);
      b.y=lerp(b.y,own.y+(own.vy||0)*dt*.5,.26);
      b.vx=0;b.vy=0;b.spin=(b.spin||0)*.9;
      G.possT[G.atkTi]++;
    } else {
      b.x+=(b.vx||0)*dt*60;b.y+=(b.vy||0)*dt*60;
      b.vx=(b.vx||0)*Math.pow(BALL_FRIC,dt*60);
      b.vy=(b.vy||0)*Math.pow(BALL_FRIC,dt*60);
      b.spin=(b.spin||0)*Math.pow(.94,dt*60);
      if(Math.abs(b.vx)<.03&&Math.abs(b.vy)<.03){b.vx=0;b.vy=0;}
      if(b.y<0){b.y=0;b.vy=(b.vy||0)*-.6;b.spin=-(b.spin||0);}
      if(b.y>WH){b.y=WH;b.vy=(b.vy||0)*-.6;b.spin=-(b.spin||0);}
      // Corners automatiques (comme 7v7)
      if(b.x<=0&&!(b.y>GY1&&b.y<GY2)&&(b.vx||0)<0&&G.running
         &&G.phase!=='CORNER'&&G.phase!=='FREEKICK'&&G.phase!=='GOALKICK'&&G.phase!=='KICKOFF'){
        G.corners[1]++;b.x=.5;b.y=clamp(b.y,1,WH-1);b.vx=0;b.vy=0;
        G.atkTi=1;setPhase('CORNER');
        logEvent(`Corner pour ${teams[1].name}`,teams[1].color+'88');
      } else if(b.x<0){b.x=0;b.vx=(b.vx||0)*-.5;}
      if(b.x>=WW&&!(b.y>GY1&&b.y<GY2)&&(b.vx||0)>0&&G.running
         &&G.phase!=='CORNER'&&G.phase!=='FREEKICK'&&G.phase!=='GOALKICK'&&G.phase!=='KICKOFF'){
        G.corners[0]++;b.x=WW-.5;b.y=clamp(b.y,1,WH-1);b.vx=0;b.vy=0;
        G.atkTi=0;setPhase('CORNER');
        logEvent(`Corner pour ${teams[0].name}`,teams[0].color+'88');
      } else if(b.x>WW){b.x=WW;b.vx=(b.vx||0)*-.5;}
      // Auto pickup
      if(!G.owner){
        for(const T of teams) for(const p of T.players){
          if(p.red||p.hp<=0||p.stunT>0)continue;
          if(Math.hypot(p.x-b.x,p.y-b.y)<PICK11){giveB(p);break;}
        }
      }
    }
    b.trail=b.trail||[];
    b.trail.push({x:b.x,y:b.y});
    if(b.trail.length>22)b.trail.shift();
    if(G.flash>0)G.flash-=dt*60*.025;
    G.ptcl=(G.ptcl||[]).filter(p=>p.l>0);
    G.ptcl.forEach(p=>{
      p.x+=p.vx*dt*60;p.y+=p.vy*dt*60;
      p.vx*=Math.pow(.91,dt*60);p.vy*=Math.pow(.91,dt*60);
      if(p.t!=='r')p.vy+=.06*dt*60;
      if(p.t==='r')p.r+=p.vr*dt*60;
      p.l-=dt*60;
    });
    return;
  }
  // ── Fin mode 11v11 ────────────────────────────────────────────────

  const ballNearOppGoal = G.ball.x > WW-PA_W && G.ball.y>GY1-PA_H/2 && G.ball.y<GY2+PA_H/2
                       || G.ball.x < PA_W    && G.ball.y>GY1-PA_H/2 && G.ball.y<GY2+PA_H/2;
  const ballOwnerIsGB = (G.owner && G.owner.pos==='GB') || G.phase==='GOALKICK' || (G.gkCoolT||0)>0 || ballNearOppGoal;
  // Players
  teams.forEach((T,ti)=>T.players.forEach((p,pi)=>{
    // Seuls les joueurs EXPULSÉS quittent le terrain. Un joueur épuisé
    // (hp/énergie à 0) NE se fige plus : il continue de jouer, simplement
    // beaucoup plus lentement (voir staminaSpeed plus bas). Avant, hp<=0
    // renvoyait le joueur hors du terrain → « beaucoup de joueurs ne bougent
    // pas », surtout avec des effectifs à faible endurance.
    if(p.red){p.x=lerp(p.x,-6,.03);return;}
    if(p.stunT>0)p.stunT=Math.max(0,p.stunT-dt*60);
    if(p._dominated>0){
      p._dominated=Math.max(0,p._dominated-dt*60);
      if(p._dominated<=0){
        // Fin du contrôle : restitution des stats et retour à son équipe
        if(p._domDebuffApplied){
          if(p._domSavedSht!=null)p.s.sht=p._domSavedSht;
          if(p._domSavedSpd!=null)p.s.spd=p._domSavedSpd;
          p._domDebuffApplied=false;p._domSavedSht=null;p._domSavedSpd=null;
        }
        p._dominatedBy=null;
        if(p.hasBall){freeB();} // s'il tenait le ballon, il le lâche en reprenant ses esprits
        logEvent(`🧠 ${p.name} reprend ses esprits !`,'#6a1b9a');
      }
    }
    p.bobPhase+=dt*2.8;

    // Run/cooldown timers (off-the-ball runs)
    if(p.runT>0)p.runT=Math.max(0,p.runT-dt);
    if(p.runCool>0)p.runCool=Math.max(0,p.runCool-dt);
    if(p.tackleCool>0)p.tackleCool=Math.max(0,p.tackleCool-dt);

    // Smoothly update target — quite reactive so the wandering and jitter read visually
    // Un joueur dominé se positionne pour l'équipe qui le contrôle.
    const eti=(p._dominated>0&&p._dominatedBy!=null)?p._dominatedBy:ti;
    const t=roleTarget(eti,p,pi);
    // Pressing : calcul une seule fois, utilisé partout dans ce bloc
    const isDefending  = eti !== G.atkTi;
    const myPressStr   = isDefending ? (strat(eti).press||0.5) : 0;
    const _nearestP    = G._pressNearest?.[eti];
    const isPresser    = isDefending && p === _nearestP && p.pos !== 'GB';
    // isSupport regroupe maintenant TOUS les joueurs que roleTarget désigne
    // comme presseurs (pressing collectif selon le curseur + soutien de duel
    // rapproché), pas seulement les joueurs déjà proches par défaut — avant,
    // ces joueurs supplémentaires visaient bien le ballon (cible renvoyée par
    // roleTarget) mais n'avaient AUCUN boost de vitesse, donc n'arrivaient
    // jamais en pratique : un seul joueur (isPresser) semblait presser.
    const isSupport    = isDefending && !isPresser && p.pos !== 'GB' && !!t.pressing;
    // Presser principal : cible directement le ballon, sans lerp intermédiaire
    // ballOwnerIsGB → snap fort vers position de tenue (évite l'élan résiduel)
    const _gbHold = isDefending && ((G.owner&&G.owner.pos==='GB')||G.phase==='GOALKICK'||(G.gkCoolT||0)>0);
    const tLerp = _gbHold ? 0.7 : isPresser ? 0.9 : isSupport ? 0.35 : 0.22;
    const ballPred = ballPredict ? ballPredict(0.2) : G.ball;
    p.tx = isPresser ? lerp(p.tx, clamp(ballPred.x, 1, WW-1), 0.35) : lerp(p.tx, t.x, tLerp);
    p.ty = isPresser ? lerp(p.ty, clamp(ballPred.y, 1, WH-1), 0.35) : lerp(p.ty, t.y, tLerp);

    const _spdStat = (typeof statOf==='function') ? statOf(p,'spd') : (p.s.spd||50);
    const baseMax=MIN_SPD+(MAX_SPD-MIN_SPD)*(_spdStat/99);
    // Spell buffs/debuffs: timers en temps de JEU (dt = rawDt×speedMult)
    // → la durée reste constante en minutes de match quelle que soit la vitesse
    if(p._spdDebuff>0){p._spdDebuff=Math.max(0,p._spdDebuff-dt*60);}
    // Dragon: décrémentation + aura de flammes continue
    if(p._defBuff>0){ p._defBuff--; }
  if(p._dragon>0){
      p._dragon=Math.max(0,p._dragon-dt*60);
      // Aura de flammes toutes les 20 frames env.
      if(Math.random()<rawDt*3){
        const a=Math.random()*Math.PI*2;
        G.ptcl.push({t:'s',x:p.x+Math.cos(a)*rng(1,3),y:p.y+Math.sin(a)*rng(0.5,2),vx:Math.cos(a)*.3,vy:-rng(.2,.5),l:18,m:18,col:pick(['#e02030','#ff6d00','#ff9800','#ffd700']),sz:rng(.2,.55)});
      }
      if(p._dragon<=0){
        // Fin de transformation: restituer les stats
        p.s.sht=Math.max(20,p.s.sht-30);p.s.spd=Math.max(20,p.s.spd-20);
        p._dragonBoosted=false;
        G.ptcl.push({t:'lbl',x:p.x,y:p.y-3,tx:'Transformation terminée',col:'#888',l:40,m:40,sz:1.1});
      }
    }
    if(p._charmed>0){p._charmed=Math.max(0,p._charmed-dt*60);}
    if(p._atkBuff>0){p._atkBuff=Math.max(0,p._atkBuff-dt*60);}
    if(p._pacified>0){p._pacified=Math.max(0,p._pacified-dt*60);}
    if(p._invis>0){p._invis=Math.max(0,p._invis-dt*60);}
    if(p._folie>0){p._folie=Math.max(0,p._folie-dt*60);}
    if(p._flee>0){p._flee=Math.max(0,p._flee-dt*60);if(p._flee<=0)logEvent(`${p.name} retrouve ses esprits.`,'#1abc9c88');}
    if(p._aile>0){p._aile=Math.max(0,p._aile-dt*60);}
    if(p._sixsens>0){p._sixsens=Math.max(0,p._sixsens-dt*60);}
    if(p._sylvestre>0){p._sylvestre=Math.max(0,p._sylvestre-dt*60);}
    const spdMul=p._spdDebuff>0?0.38:p._aile>0||p._sylvestre>0?2.2:1.0;
    // Pressing : boost vitesse selon intensité
    const pressBonusMul = isPresser ? (1.0 + myPressStr*0.45) :
                          isSupport ? (1.0 + myPressStr*0.20) : 1.0;
    const sprintMul=(p.runT>0?1.35:1.0)*pressBonusMul;
    const injPenalty=[1,.80,.55,.22][p.injLevel||0];
    // Fatigue progressive : un joueur épuisé ralentit au lieu de se figer.
    // hp=100 → 1.0 (pleine vitesse) ; hp=0 → 0.45 (petit trot fatigué).
    const staminaSpeed = 0.45 + 0.55*clamp((p.hp||0)/100, 0, 1);
    // Folie : le joueur court vers une cible aléatoire sur le terrain
    if(p._folie>0&&Math.random()<.04){p.tx=rng(2,WW-2);p.ty=rng(2,WH-2);}
    // Suggestion Mentale : le joueur fuit — sa cible est à l'opposé du ballon.
    if(p._flee>0){
      const away=norm(p.x-G.ball.x, p.y-G.ball.y);
      p.tx=clamp(p.x+away.x*18,2,WW-2);
      p.ty=clamp(p.y+away.y*18,2,WH-2);
    }
    const eff=(p.stunT>0?baseMax*.2:baseMax*sprintMul*spdMul*staminaSpeed)*injPenalty;
    const dx=p.tx-p.x,dy=p.ty-p.y,d=Math.hypot(dx,dy);
    if(d>0.15){
      const n=norm(dx,dy);
      // Snappier acceleration so changes of direction read clearly
      const vLerp = isPresser ? 0.65 : isSupport ? 0.32 : 0.28;
      p.vx=lerp(p.vx,n.x*eff,vLerp);p.vy=lerp(p.vy,n.y*eff,vLerp);
    } else {p.vx*=.72;p.vy*=.72;}

    p.x=clamp(p.x+p.vx*dt,0,WW);
    p.y=clamp(p.y+p.vy*dt,0,WH);

    // Separation
    allP().forEach(p2=>{
      if(p2===p||p2.red)return;
      const dx2=p.x-p2.x,dy2=p.y-p2.y,d2=Math.hypot(dx2,dy2);
      if(d2<SEP&&d2>.01){const push=(SEP-d2)/SEP*.12;p.x+=dx2/d2*push;p.y+=dy2/d2*push;}
    });
    // Stamina drains faster under pressing
    const pressDrain=myPressStr||0.5;
    const isPressingNow=G.gegenT&&G.gegenT[ti]>0?1.4:pressDrain;
    p.hp=Math.max(0,p.hp-.009*dt*60*(1.1-p.s.stam/99)*(0.7+isPressingNow*0.5));
    p.mp=Math.min(100,p.mp+.009*dt*60); // regen
    // Produits dopants : timer + fin de buff
    if(p._dopeT>0){
      p._dopeT=Math.max(0,p._dopeT-dt*60);
      if(p._dopeT<=0){
        const stats=['sht','spd','tec','def'];
        stats.forEach(st=>{
          const gained=p['_dope_'+st]||0;
          if(gained>0){ p.s[st]=Math.max(1,p.s[st]-gained); p['_dope_'+st]=0; }
        });
        logEvent(`💉 Effet dopant terminé pour ${p.name}.`,'#888');
      }
    }
    // Risque de blessure aléatoire (fatigue + résistance) — VOLONTAIREMENT RARE.
    // La fatigue augmente légèrement le risque mais ne doit pas transformer un
    // joueur épuisé en blessé qui sort tout seul : l'épuisement pénalise surtout
    // les perfs (via fatMul), c'est au joueur de décider de remplacer.
    if(p.injLevel<3&&p.injT<=0){
      const fatigueBonus=p.hp<35?1.5:p.hp<60?1.15:1;
      const chance=0.000006*dt*60*(1-p.s.res/99)*fatigueBonus*(1-Math.max(0,p._fm||0)*0.04);
      if(Math.random()<chance){injurePlayer(ti,p,false);}
    }
    if(p.injT>0)p.injT=Math.max(0,p.injT-dt*60);
  }));

  // Gegen timer countdown + gkCoolT + press nearest cache (refresh every ~12 frames)
  if(G.gegenT){G.gegenT[0]=Math.max(0,(G.gegenT[0]||0)-dt);G.gegenT[1]=Math.max(0,(G.gegenT[1]||0)-dt);}
  if(G.gkCoolT>0) G.gkCoolT=Math.max(0,G.gkCoolT-dt);
  if(G._gkSpellCool){G._gkSpellCool[0]=Math.max(0,(G._gkSpellCool[0]||0)-dt);G._gkSpellCool[1]=Math.max(0,(G._gkSpellCool[1]||0)-dt);}
  if(!G._pressNearest) G._pressNearest=[null,null];
  if(!G._pressOrder) G._pressOrder=[[],[]];
  if(Math.random()<0.28){ // ~17fps refresh — pressing réactif
    [0,1].forEach(ti=>{
      const mp=actP(ti).filter(q=>q.pos!=='GB');
      // Trié du plus proche au plus loin : sert au pressing collectif — plus
      // le curseur de pressing est élevé, plus de joueurs de ce classement
      // foncent ensemble sur le porteur (pas seulement le plus proche).
      const sorted=mp.map(q=>({q,d:Math.hypot(q.x-G.ball.x,q.y-G.ball.y)})).sort((a,b)=>a.d-b.d).map(o=>o.q);
      G._pressOrder[ti]=sorted;
      G._pressNearest[ti]=sorted[0]||null;
    });
  }
  // Ball
  const b=G.ball;
  const own=ownerP();
  if(own&&own.hasBall){
    b.x=lerp(b.x,own.x+own.vx*dt*.5,.26);
    b.y=lerp(b.y,own.y+own.vy*dt*.5,.26);
    b.vx=0;b.vy=0;b.spin*=.9;
    G.possT[G.atkTi]++;
  } else {
    b.x+=b.vx*dt*60;b.y+=b.vy*dt*60;
    b.vx*=Math.pow(BALL_FRIC,dt*60);
    b.vy*=Math.pow(BALL_FRIC,dt*60);
    b.spin*=Math.pow(.94,dt*60);
    if(Math.abs(b.vx)<.03&&Math.abs(b.vy)<.03){b.vx=0;b.vy=0;}
    if(b.y<0){b.y=0;b.vy*=-.6;b.spin=-b.spin;}
    if(b.y>WH){b.y=WH;b.vy*=-.6;b.spin=-b.spin;}
    // Ball crossing goal line (outside goal frame) → corner for attacking team.
    // Only fire during active open play, never during set pieces or while frozen.
    if(b.x<=0 && !(b.y>GY1&&b.y<GY2) && b.vx<0 && G.running
       && G.phase!=='CORNER' && G.phase!=='FREEKICK' && G.phase!=='GOALKICK' && G.phase!=='KICKOFF' && G.phase!=='PENALTY_KICK'){
      // Out by team-0's goal line → corner for team 1 (attacking team)
      const ati=1,dti=0;
      G.corners[ati]++;
      b.x=.5;b.y=clamp(b.y,1,WH-1);b.vx=0;b.vy=0;
      G.atkTi=ati;setPhase('CORNER');
      logEvent(`Corner pour ${teams[ati].name}`,teams[ati].color+'88');
    } else if(b.x<0){b.x=0;b.vx*=-.5;}
    if(b.x>=WW && !(b.y>GY1&&b.y<GY2) && b.vx>0 && G.running
       && G.phase!=='CORNER' && G.phase!=='FREEKICK' && G.phase!=='GOALKICK' && G.phase!=='KICKOFF' && G.phase!=='PENALTY_KICK'){
      const ati=0,dti=1;
      G.corners[ati]++;
      b.x=WW-.5;b.y=clamp(b.y,1,WH-1);b.vx=0;b.vy=0;
      G.atkTi=ati;setPhase('CORNER');
      logEvent(`Corner pour ${teams[ati].name}`,teams[ati].color+'88');
    } else if(b.x>WW){b.x=WW;b.vx*=-.5;}
    // Auto pickup — pick the closest eligible player so neither team is favored by iteration order.
    if(!G.owner){
      let bestP=null,bestD=PICK_R;
      for(let _ti=0;_ti<teams.length;_ti++){
        // En phase GOALKICK, seule l'équipe qui dégage peut ramasser la balle
        if(G.phase==='GOALKICK'&&_ti!==G.atkTi)continue;
        for(const p of teams[_ti].players){
          if(p.red||p.stunT>0)continue;
          const d=Math.hypot(p.x-b.x,p.y-b.y);
          if(d<bestD){bestD=d;bestP=p;}
        }
      }
      if(bestP){
        giveB(bestP);
        // Si le gardien ramasse le ballon en jeu libre → dégagement immédiat
        if(bestP.pos==='GB' && G.phase!=='GOALKICK' && G.phase!=='PENALTY_KICK'){
          const ti=teams[0].players.some(q=>q===bestP||q.id===bestP.id)?0:1;
          G.atkTi=ti;
          setPhase('GOALKICK');
        }
      }
    }
  }
  b.trail.push({x:b.x,y:b.y});
  if(b.trail.length>22)b.trail.shift();

  // ═══ PHYSICAL TACKLES ═══
  // When a defender from the opposite team gets close enough to the ball carrier,
  // they may attempt a slide tackle. Resolved as a duel (def+spd vs tec+spd).
  // This is what produces visible tackle events between AI decisions.
  if(G.owner && G.running && G.phase!=='KICKOFF' && G.phase!=='CORNER' && G.phase!=='FREEKICK' && G.phase!=='GOALKICK' && G.phase!=='PENALTY_KICK'){
    const carrier=ownerP();
    if(carrier && carrier.stunT<=0 && carrier.pos!=='GB'){
      const carrierTi=teams[0].players.some(q=>q===carrier||q.id===carrier.id)?0:1;
      const defTi=1-carrierTi;
      const TACKLE_R=2.6;  // distance threshold for tackle attempt
      for(const def of teams[defTi].players){
        if(def.red||def.hp<=0||def.stunT>0)continue;
        if(def.tackleCool>0||def._flee>0)continue;
        const dd=Math.hypot(def.x-carrier.x,def.y-carrier.y);
        if(dd<TACKLE_R){
          // Per-frame chance — averages ~1 attempt per ~0.4s of close contact
          const baseTry=0.030*dt*60;
          // Defenders & mids try more often; attackers rarely
          const roleMul=def.pos==='DC'||def.pos==='DD'||def.pos==='DG'?1.3
                       :def.pos==='MDC'?1.4
                       :def.pos==='MC'?1.0
                       :def.pos==='MO'?.5
                       :.3;
          if(Math.random()<baseTry*roleMul){
            def.tackleCool=1.8+Math.random()*1.2;
            // Resolve the duel
            const atkPwr=(carrier.s.tec+carrier.s.spd*.5+irng(-8,8))*fatMul(carrier);
            const defPwr=(def.s.def+def.s.spd*.4+irng(-8,8))*fatMul(def);
            spawnTackle(carrier.x,carrier.y);
            // Risque de blessure pour LE TACLEUR quand il est fragile (def+res
            // faibles) face à un adversaire dur au duel (tec+res élevés) : plus
            // il s'expose au-dessus de son niveau, plus il peut se faire mal.
            const tacklerHurtChance=()=>{
              const tacklerSolidity=(def.s.def+def.s.res)/2;      // sa capacité à encaisser
              const carrierToughness=(carrier.s.tec+carrier.s.res)/2; // la dureté de l'adversaire
              const gap=carrierToughness-tacklerSolidity;          // >0 = tacleur en danger
              if(gap<=0)return 0;
              return Math.min(0.30, gap/99*0.55);                  // jusqu'à ~30% si énorme écart
            };
            if(defPwr>atkPwr){
              // Clean tackle — ball goes to defender
              G.tackles[defTi]++;def.mTk++;
              giveB(def);G.atkTi=defTi;
              carrier.stunT=irng(3,6);
              logEvent(`⚡ ${def.name} tacle ${carrier.name} !`,teams[defTi].color);
              // Gegen: losing team tries to press immediately to win ball back
              const losingTeamPress=strat(carrierTi).press||0.5;
              if(losingTeamPress>0.5) G.gegenT[carrierTi]=4*losingTeamPress;
              setPhase('TRANSITION');
              // Small injury chance on the tackled carrier
              if(Math.random()<0.06*(1-carrier.s.res/99)*2)injurePlayer(carrierTi,carrier,true);
              // Même sur un tacle réussi, un tacleur fragile peut se blesser (moindre)
              if(Math.random()<tacklerHurtChance()*0.5){injurePlayer(defTi,def,true);logEvent(`😖 ${def.name} se fait mal au tacle !`,'#e07030');}
            } else {
              // Failed tackle — possibly a foul
              const foulChance=.35;
              if(Math.random()<foulChance){
                G.fouls[defTi]++;
                def.stunT=irng(3,5);
                logEvent(`Faute de ${def.name} sur ${carrier.name}`,'#f0c028');
                // Yellow/red card chance
                if(Math.random()<.10){
                  def.yc++;
                  if(def.yc>=2&&!hasRed(defTi)){def.red=true;logEvent(`🟥 ${def.name} EXPULSÉ ! (équipe à 6)`,'#e02030');}else if(def.yc>=2){logEvent(`🟨 ${def.name} — 2e jaune (limite d'expulsion atteinte)`,'#f0c028');}
                  else logEvent(`🟨 Carton jaune — ${def.name}`,'#f0c028');
                }
                // Injury chance on the FOULED player (the carrier), not the tackler
                if(Math.random()<0.10*(1-carrier.s.res/99)*2)injurePlayer(carrierTi,carrier,true);
                // Tacle raté sur un joueur solide → le tacleur fragile peut se blesser
                if(Math.random()<tacklerHurtChance()){injurePlayer(defTi,def,true);logEvent(`😖 ${def.name} se blesse sur son tacle manqué !`,'#e07030');}
                setPhase('FREEKICK');
              } else {
                // Tackle missed, no foul — carrier slips past
                logEvent(`${carrier.name} échappe à ${def.name}`,teams[carrierTi].color+'aa');
                // Il s'est jeté et a raté un joueur techniquement supérieur : léger risque
                if(Math.random()<tacklerHurtChance()*0.4){injurePlayer(defTi,def,true);logEvent(`😖 ${def.name} se tord en ratant son tacle !`,'#e07030');}
              }
            }
            break;  // only one tackle attempt per frame per carrier
          }
        }
      }
    }
  }

  // Particles
  if(G.flash>0)G.flash-=dt*60*.025;
  G.ptcl=G.ptcl.filter(p=>p.l>0);
  G.ptcl.forEach(p=>{
    p.x+=p.vx*dt*60;p.y+=p.vy*dt*60;
    p.vx*=Math.pow(.91,dt*60);p.vy*=Math.pow(.91,dt*60);
    if(p.t!=='r')p.vy+=.06*dt*60;
    if(p.t==='r')p.r+=p.vr*dt*60;
    p.l-=rawDt*60;
  });
}

// ═══════════════════════════════════════════════════════════
// AI
// ═══════════════════════════════════════════════════════════
const SEC_PER_MIN=3.0,AI_INTERVAL=1.6;
