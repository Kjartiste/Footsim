// ============================================================
// UI_SETUP.JS — extrait de ui.js (scope global partagé)
// Lignes 1241–2446 de l'ui.js d'origine.
// ============================================================

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

    // ── Badge Domicile / Extérieur ───────────────────────────────────────
    // En carrière, un match sur deux se joue chez l'adversaire (calendrier
    // aller-retour). Sans indication claire, le joueur a l'impression de
    // toujours jouer à domicile puisque teams[0] reste toujours "son" équipe
    // en interne. On affiche donc ici le vrai statut du match (fixture
    // carrière) et on inverse l'ordre d'affichage à l'extérieur pour que
    // l'équipe qui reçoit soit toujours du côté gauche, comme à la TV.
    const _fix = window._careerFixPlaying;
    const isAway = !!(_fix && _fix.homeIsPlayer===false);
    const isCareerMatch = !!(_fix && (_fix.homeIsPlayer===true || _fix.homeIsPlayer===false));
    if(isCareerMatch){
      const awayTxt = isAway ? '✈️ MATCH À L\'EXTÉRIEUR' : '🏠 MATCH À DOMICILE';
      const awayCol = isAway ? '#f0c028' : '#18c860';
      const awaySub = isAway ? 'Vous jouez chez '+T1.name : 'Vous recevez '+T1.name;
      const diffI = (typeof difficultyInfo==='function') ? difficultyInfo() : null;
      h+='<div style="display:flex;align-items:center;justify-content:center;gap:6px;padding:6px 10px;background:'+awayCol+'18;border-bottom:1px solid '+awayCol+'33;flex-wrap:wrap">'
        +'<span style="font-size:10px;font-weight:900;letter-spacing:.5px;color:'+awayCol+'">'+awayTxt+'</span>'
        +'<span style="font-size:9px;color:var(--muted)">— '+awaySub+'</span>'
        +(diffI ? '<span style="font-size:9px;font-weight:700;color:var(--muted);border-left:1px solid '+awayCol+'44;padding-left:6px;margin-left:2px" title="'+diffI.desc.replace(/"/g,'&quot;')+'">'+diffI.label+'</span>' : '')
        +'</div>';
    }

    // Tabs
    h+='<div style="display:flex;border-bottom:1px solid #111">'
      +'<button id="pm-tab-match" onclick="pmTab(\'match\')" style="flex:1;background:var(--card);border:none;color:var(--text);font-size:10px;font-weight:700;padding:8px 4px;cursor:pointer;border-bottom:2px solid #18c860">📊 Match</button>'
      +'<button id="pm-tab-compo" onclick="pmTab(\'compo\')" style="flex:1;background:transparent;border:none;color:var(--muted);font-size:10px;font-weight:700;padding:8px 4px;cursor:pointer;border-bottom:2px solid transparent">⚽ Compo</button>'
      +'<button id="pm-tab-prono" onclick="pmTab(\'prono\')" style="flex:1;background:transparent;border:none;color:var(--muted);font-size:10px;font-weight:700;padding:8px 4px;cursor:pointer;border-bottom:2px solid transparent">🔮 Prono</button>'
      +'<button id="pm-tab-tac" onclick="pmTab(\'tac\')" style="flex:1;background:transparent;border:none;color:var(--muted);font-size:10px;font-weight:700;padding:8px 4px;cursor:pointer;border-bottom:2px solid transparent">⚙️ Tac</button>'
      +'</div>';

    // Tab match
    h+='<div id="pm-panel-match">';
    // Header — l'équipe qui REÇOIT s'affiche toujours à gauche (comme à la
    // TV), même si en interne teams[0] reste toujours l'équipe du joueur.
    h+='<div style="background:linear-gradient(135deg,'+T0.color+'22,transparent 40%,'+T1.color+'22);padding:20px 16px 14px;display:flex;align-items:center;gap:8px">';
    if(isAway){
      h+=col(T1,o1,hm1,fm1,b1);
      h+='<div style="flex-shrink:0;font-size:22px;font-weight:900;color:#444;letter-spacing:3px">VS</div>';
      h+=col(T0,o0,hm0,fm0,b0);
    } else {
      h+=col(T0,o0,hm0,fm0,b0);
      h+='<div style="flex-shrink:0;font-size:22px;font-weight:900;color:#444;letter-spacing:3px">VS</div>';
      h+=col(T1,o1,hm1,fm1,b1);
    }
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

    // Bandeau de rivalité entre nations (lore) — s'affiche seulement si les
    // deux équipes appartiennent à des peuples avec une relation notable.
    try{
      if(window.NATION_RIVALRY){
        const relInfo = NATION_RIVALRY.get(teams[0].nation, teams[1].nation);
        if(relInfo){
          const isAlly = relInfo.level < 0;
          const accent = isAlly ? '#18c860' : (relInfo.level === 2 ? '#e02030' : '#e08040');
          h+='<div style="margin:2px 14px 10px;padding:9px 11px;border-radius:9px;'
            +'background:linear-gradient(90deg,'+accent+'22,transparent);'
            +'border:1px solid '+accent+'55;border-left:3px solid '+accent+'">'
            +'<div style="font-size:11px;font-weight:900;letter-spacing:.5px;color:'+accent+'">'+relInfo.label+'</div>'
            +'<div style="font-size:9px;color:var(--muted);line-height:1.45;margin-top:3px">'+relInfo.blurb+'</div>'
            +'</div>';
        }
      }
    }catch(e){ console.error('rivalry banner:', e); }

    // Style de terrain (partagé avec Réglages et Carrière > Infra)
    h+='<div style="margin:2px 14px 8px">'
      +'<div style="font-size:9px;font-weight:700;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:5px">🏟 Style de terrain</div>'
      +_stadiumSelectorHTML()
      +'</div>';

    // Option GIF avant le coup d'envoi (pour ne pas louper les moments chauds)
    h+='<label style="display:flex;align-items:center;gap:7px;justify-content:center;padding:2px 14px 4px;font-size:11px;color:var(--muted);cursor:pointer">'
      +`<input type="checkbox" ${_gifArmNext?'checked':''} onchange="_gifArmNext=this.checked" style="accent-color:var(--gold);width:15px;height:15px">`
      +'🎬 Enregistrer la 1re mi-temps en GIF</label>';

    // Option VIDÉO : armée ici, elle démarre toute seule au coup d'envoi.
    // Sans ça il fallait cliquer REC après l'engagement — donc rater le début.
    const _recOk = (typeof matchRecordingSupported==='function') ? matchRecordingSupported() : true;
    h+='<label style="display:flex;align-items:center;gap:7px;justify-content:center;padding:0 14px 8px;font-size:11px;color:'+(_recOk?'var(--muted)':'#666')+';cursor:'+(_recOk?'pointer':'not-allowed')+'" '
      +(_recOk?'':'title="Enregistrement vidéo non pris en charge par ce navigateur"')+'>'
      +`<input type="checkbox" ${window._recArmNext?'checked':''} ${_recOk?'':'disabled'} onchange="armMatchRecording(this.checked)" style="accent-color:var(--gold);width:15px;height:15px">`
      +'🎥 Enregistrer le match en vidéo'+(_recOk?'':' (indisponible)')+'</label>'
      +'<div style="font-size:8px;color:#666;text-align:center;margin:-4px 14px 8px;font-style:italic">Démarre au coup d\'envoi. Les mi-temps et pauses sont automatiquement coupées.</div>';
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

  // ── Motivation de rivalité entre nations (transitoire) ──────────────────
  // Un choc entre peuples rivaux galvanise les deux camps : petit bonus de
  // moral (_hm) pour ce match. Le nettoyage d'un éventuel reliquat est fait
  // en amont par _prepareTeamsForMode (commun à tous les chemins de match).
  try{
    if(window.NATION_RIVALRY){
      const bonus = NATION_RIVALRY.motivationBonus(teams[0].nation, teams[1].nation);
      if(bonus > 0){
        [0,1].forEach(function(ti){
          const T = teams[ti];
          if(!T || !T.players) return;
          T.players.concat(T.bench||[]).forEach(function(p){
            if(!p) return;
            // Plafonné pour rester dans la plage _hm (-10..10).
            const applied = Math.min(bonus, 10 - (p._hm||0));
            if(applied > 0){ p._hm = (p._hm||0) + applied; p._rivalryBuff = applied; }
          });
        });
      }
    }
  }catch(e){ console.error('rivalry motivation:', e); }

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
  // Enregistrement vidéo armé depuis l'avant-match : on le lance ici, avant
  // l'engagement, pour que l'intro et les premières secondes soient dans la
  // vidéo. Sans effet si la case n'est pas cochée.
  try{ if(typeof startMatchRecordingIfArmed==='function') startMatchRecordingIfArmed(); }catch(e){}
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
  // Sécurité : purge tout bonus de rivalité transitoire d'un match précédent,
  // car TOUS les chemins de match passent par ici (pré-match, ligue, coupe,
  // carrière). Évite que le bonus de moral fuite d'un match à l'autre.
  try{
    if(window.NATION_RIVALRY && window.teams){
      [0,1].forEach(function(ti){
        const T = teams[ti]; if(!T) return;
        NATION_RIVALRY.clearBuffs((T.players||[]).concat(T.bench||[]));
      });
    }
  }catch(e){ console.error('clear rivalry buffs:', e); }
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
      // Petit repère 🏠/✈️ sur l'équipe du joueur (team 0) en carrière, pour
      // rappeler qu'un match sur deux se joue à l'extérieur.
      const _fix = window._careerFixPlaying;
      const homePrefix = (i==='0' && _fix && _fix.homeIsPlayer===false) ? '✈️ ' : '';
      const span=nameEl.querySelector('span');
      if(span){[...nameEl.childNodes].forEach(n=>{if(n.nodeType===3)n.remove();});nameEl.appendChild(document.createTextNode(homePrefix+T.name+suffix));}
      else nameEl.textContent=homePrefix+T.name+suffix;
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

function _cssColorToHex(col){
  // Convertit n'importe quelle couleur CSS en #rrggbb (requis par <input type="color">).
  if(!col) return '#888888';
  col=String(col).trim();
  if(/^#[0-9a-fA-F]{6}$/.test(col)) return col;
  if(/^#[0-9a-fA-F]{3}$/.test(col)) return'#'+col[1]+col[1]+col[2]+col[2]+col[3]+col[3];
  try{
    const c=document.createElement('canvas');c.width=1;c.height=1;
    const x=c.getContext('2d');x.fillStyle=col;x.fillRect(0,0,1,1);
    const d=x.getImageData(0,0,1,1).data;
    return'#'+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
  }catch(e){return'#888888';}
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
      <input type="color" value="${_cssColorToHex(T.color)}" onchange="teams[${ti}].color=this.value;document.getElementById('hs${ti}').style.color=this.value;renderTB(${ti})">
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
