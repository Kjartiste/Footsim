// ═══════════════════════════════════════════════════════════
// VALORIA_SEASONS.JS — Moteur de saisons & promo/relégation (Valoria)
// ═══════════════════════════════════════════════════════════
// Se branche sur le mode carrière existant (careerV2). Seule la division du
// joueur tourne en détail ; les autres divisions sont SIMULÉES en arrière-plan
// (classements plausibles générés à partir de la force des équipes) pour
// pouvoir appliquer les règles de montée/descente.
//
// RÈGLES (telles que décrites par le joueur) :
//  • R1 → Pro : la place de montée revient au champion de la RÉGION du DERNIER
//    de la Ligue pro (règle d'équité). Si Brumefer était dernier en Pro, c'est
//    le champion de Brumefer R1 qui monte ; sinon celui de Valcourt R1.
//  • R2 : les 2 derniers descendent, les 2 premiers montent en R1.
//  • R3 : les 2 premiers montent en R1, le dernier descend (vers district).
//  • District : top 2 de chacun des 4 districts → play-offs (2 poules) →
//    les 4 meilleurs montent en R3.
//  • Pro : le dernier est relégué (dans sa région d'origine, R1).
// ═══════════════════════════════════════════════════════════

const VALORIA_LEVELS = ['pro','valcourt_r1','valcourt_r2','valcourt_r3',
  'valcourt_district1','valcourt_district2','valcourt_district3','valcourt_district4',
  'brumefer_r1','brumefer_r2'];

// Force approximative d'une équipe Valoria selon son palier (pour simuler les
// classements des divisions où le joueur ne joue pas).
function _valTierStrength(tier){
  return tier==='pro'?72 : tier==='regional'?61 : 52;
}

// Simule un classement final pour une division (hors division du joueur).
// Renvoie un tableau trié [{name,region,strength,rank}] du 1er au dernier.
function simulateValoriaDivision(divId){
  const teams=(window.valoriaTeamsByDivision?window.valoriaTeamsByDivision(divId):[]);
  const ranked = teams.map(t=>{
    // Force = base du palier + petite variation stable par nom + aléa de saison.
    const seed=Math.abs(_valHash(t.name))%100;
    const base=_valTierStrength(t.tier)+ (seed/100*12-6);
    return { name:t.name, region:t.region, division:divId, strength: base + (Math.random()*10-5) };
  }).sort((a,b)=>b.strength-a.strength);
  ranked.forEach((r,i)=>r.rank=i+1);
  return ranked;
}
function _valHash(s){ let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))|0; return h; }

// Play-offs de district : top 2 de chaque district → 8 équipes → 2 poules →
// les 4 meilleures montent en R3. (Poules simulées par la force.)
function valoriaDistrictPlayoffs(){
  const qualified=[];
  ['valcourt_district1','valcourt_district2','valcourt_district3','valcourt_district4'].forEach(d=>{
    const s=simulateValoriaDivision(d);
    if(s[0]) qualified.push(s[0]);
    if(s[1]) qualified.push(s[1]);
  });
  // 2 poules de 4 : on répartit en serpentin puis on prend les 2 premiers de
  // chaque poule (approché par la force pour la simulation).
  const sorted=qualified.sort((a,b)=>b.strength-a.strength);
  const poolA=[sorted[0],sorted[3],sorted[4],sorted[7]].filter(Boolean);
  const poolB=[sorted[1],sorted[2],sorted[5],sorted[6]].filter(Boolean);
  const topA=poolA.sort((a,b)=>b.strength-a.strength).slice(0,2);
  const topB=poolB.sort((a,b)=>b.strength-a.strength).slice(0,2);
  return topA.concat(topB); // 4 équipes promues en R3
}

// Play-offs de district AVEC le club du joueur dans le tableau.
// Reproduit le vrai format : 8 qualifiés (top 2 des 4 districts) → 2 poules de
// 4 (répartition en serpentin par force) → les 2 premiers de chaque poule
// montent en R3. Le joueur remplace le qualifié de SON district à SA position.
// Renvoie { promoted:bool, detail:string }.
function valoriaSimulateDistrictPlayoffs(C, myDiv, myPos){
  // ── Force du club joueur, CALIBRÉE sur l'échelle de la simulation ──────
  // Les effectifs du joueur sont notés sur ~40-75 (moyenne de stats), alors que
  // la simulation situe un club de district autour de 52 (_valTierStrength).
  // Comparer les deux directement rendait le joueur quasi imbattable. On
  // convertit donc sa force en un ÉCART par rapport à la moyenne de son propre
  // district, ce qui garde les deux échelles cohérentes.
  const rivalsMine = simulateValoriaDivision(myDiv);
  const districtAvg = rivalsMine.length
    ? rivalsMine.reduce(function(s,t){ return s+t.strength; },0)/rivalsMine.length
    : _valTierStrength('district');

  let myRaw = null;
  try{
    const squad = (C.players||[]).concat(C.bench||[]);
    if(squad.length){
      let sum=0, n=0;
      squad.forEach(function(p){
        const s=p&&p.s; if(!s) return;
        sum += ((s.tec||50)+(s.spd||50)+(s.sht||50)+(s.def||50)+(s.stam||50)+(s.res||50))/6; n++;
      });
      if(n) myRaw = sum/n;
    }
  }catch(e){}

  // Sans effectif exploitable, on se cale sur la position obtenue : finir 1er
  // ou 2e d'un district implique d'être au-dessus de la moyenne locale.
  let myStrength;
  if(myRaw==null){
    myStrength = districtAvg + (myPos===1 ? 4 : 2.5);
  } else {
    // Qualifier au play-off prouve déjà que le club domine son district : on
    // part donc légèrement AU-DESSUS de la moyenne locale, puis la qualité de
    // l'effectif fait l'écart (bornée pour éviter les extrêmes).
    const delta = Math.max(-6, Math.min(9, (myRaw - 52) * 0.5));
    myStrength = districtAvg + 3.5 + delta;
  }
  // Bonus de dynamique : finir 1er de son district vaut mieux que 2e.
  myStrength += (myPos===1 ? 1.5 : 0);

  // Les 8 qualifiés : top 2 de chaque district (simulés), sauf le district du
  // joueur où l'on injecte le joueur à sa place réelle.
  const qualified = [];
  ['valcourt_district1','valcourt_district2','valcourt_district3','valcourt_district4'].forEach(function(d){
    const s = simulateValoriaDivision(d);
    for(let i=0;i<2;i++){
      if(d===myDiv && (i+1)===myPos){
        qualified.push({ name:(C.club&&C.club.name)||'Mon club', strength:myStrength, isPlayer:true });
      } else if(s[i]){
        qualified.push({ name:s[i].name, strength:s[i].strength, isPlayer:false });
      }
    }
  });
  // Filet : si le joueur n'a pas été injecté (district hors liste), on l'ajoute.
  if(!qualified.some(function(q){ return q.isPlayer; })){
    qualified.push({ name:(C.club&&C.club.name)||'Mon club', strength:myStrength, isPlayer:true });
  }

  // Répartition serpentin en 2 poules de 4 selon la force.
  const sorted = qualified.slice().sort(function(a,b){ return b.strength-a.strength; });
  const poolA = [sorted[0],sorted[3],sorted[4],sorted[7]].filter(Boolean);
  const poolB = [sorted[1],sorted[2],sorted[5],sorted[6]].filter(Boolean);
  const myPool = poolA.some(function(t){return t.isPlayer;}) ? poolA : poolB;
  const poolLbl = (myPool===poolA) ? 'poule A' : 'poule B';

  // Mini-championnat : chaque équipe affronte les autres de sa poule. Résultat
  // pondéré par la force + aléa (une poule n'est jamais jouée d'avance).
  const pts = {};
  myPool.forEach(function(t){ pts[t.name]=0; });
  for(let i=0;i<myPool.length;i++){
    for(let j=i+1;j<myPool.length;j++){
      const a=myPool[i], b=myPool[j];
      const diff=(a.strength-b.strength)/12;                 // avantage relatif
      const r=Math.random()*2-1 + diff;                      // aléa + force
      if(r>0.35)      pts[a.name]+=3;
      else if(r<-0.35) pts[b.name]+=3;
      else { pts[a.name]+=1; pts[b.name]+=1; }               // nul
    }
  }
  const table = myPool.slice().sort(function(a,b){
    return (pts[b.name]-pts[a.name]) || (b.strength-a.strength);
  });
  const rank = table.findIndex(function(t){ return t.isPlayer; }) + 1;
  const promoted = rank>0 && rank<=2;   // les 2 premiers de chaque poule montent
  const detail = poolLbl+', '+rank+(rank===1?'er':'e')+' avec '+(pts[(C.club&&C.club.name)||'Mon club']||0)+' pts';
  return { promoted:promoted, detail:detail, rank:rank, pool:poolLbl };
}
// ─────────────────────────────────────────────────────────────────────────
// BARRAGES DE DISTRICT — VERSION JOUABLE
// ─────────────────────────────────────────────────────────────────────────
// Construit C.playoffs : le joueur affrontera RÉELLEMENT (moteur de match,
// 3 dates programmées) les 3 autres équipes de sa poule. Les 3 matchs qui ne
// le concernent pas (entre les autres équipes de sa poule) sont réglés tout
// de suite par force + aléa, exactement comme les confrontations de coupe qui
// n'impliquent pas le joueur. Le classement final — et donc la promotion —
// dépend ainsi vraiment de ce que le joueur fait sur le terrain.
function valoriaSetupDistrictPlayoffs(C, myDiv, myPos){
  if(!C) return;
  const rivalsMine = simulateValoriaDivision(myDiv);
  const districtAvg = rivalsMine.length
    ? rivalsMine.reduce(function(s,t){ return s+t.strength; },0)/rivalsMine.length
    : _valTierStrength('district');

  let myRaw = null;
  try{
    const squad = (C.players||[]).concat(C.bench||[]);
    if(squad.length){
      let sum=0, n=0;
      squad.forEach(function(p){
        const s=p&&p.s; if(!s) return;
        sum += ((s.tec||50)+(s.spd||50)+(s.sht||50)+(s.def||50)+(s.stam||50)+(s.res||50))/6; n++;
      });
      if(n) myRaw = sum/n;
    }
  }catch(e){}

  let myStrength;
  if(myRaw==null){
    myStrength = districtAvg + (myPos===1 ? 4 : 2.5);
  } else {
    const delta = Math.max(-6, Math.min(9, (myRaw - 52) * 0.5));
    myStrength = districtAvg + 3.5 + delta;
  }
  myStrength += (myPos===1 ? 1.5 : 0);

  // Les 8 qualifiés : top 2 de chaque district (simulés), sauf le district du
  // joueur où l'on injecte le joueur à sa place réelle.
  const qualified = [];
  ['valcourt_district1','valcourt_district2','valcourt_district3','valcourt_district4'].forEach(function(d){
    const s = simulateValoriaDivision(d);
    for(let i=0;i<2;i++){
      if(d===myDiv && (i+1)===myPos){
        qualified.push({ name:(C.club&&C.club.name)||'Mon club', strength:myStrength, isPlayer:true, level:myDiv });
      } else if(s[i]){
        qualified.push({ name:s[i].name, strength:s[i].strength, isPlayer:false, level:d });
      }
    }
  });
  if(!qualified.some(function(q){ return q.isPlayer; })){
    qualified.push({ name:(C.club&&C.club.name)||'Mon club', strength:myStrength, isPlayer:true, level:myDiv });
  }

  // Répartition serpentin en 2 poules de 4 selon la force (même logique que
  // la version simulée, pour rester cohérent).
  const sorted = qualified.slice().sort(function(a,b){ return b.strength-a.strength; });
  const poolA = [sorted[0],sorted[3],sorted[4],sorted[7]].filter(Boolean);
  const poolB = [sorted[1],sorted[2],sorted[5],sorted[6]].filter(Boolean);
  const myPool = poolA.some(function(t){return t.isPlayer;}) ? poolA : poolB;
  const poolLbl = (myPool===poolA) ? 'poule A' : 'poule B';
  const others = myPool.filter(function(t){ return !t.isPlayer; }); // 3 adversaires réels du joueur

  // ── Résultats des matchs de l'AUTRE poule (le joueur n'y joue pas) :
  // réglés par force + aléa, pour produire un classement complet à afficher.
  const otherPool = (myPool===poolA) ? poolB : poolA;
  function _simPoolTable(pool){
    const tbl = {}; pool.forEach(function(t){ tbl[t.name]={name:t.name,pts:0,gf:0,ga:0,strength:t.strength,isPlayer:!!t.isPlayer,level:t.level}; });
    for(let i=0;i<pool.length;i++){
      for(let j=i+1;j<pool.length;j++){
        const a=pool[i], b=pool[j];
        const diff=(a.strength-b.strength)/12;
        const r=Math.random()*2-1 + diff;
        // buts approximatifs pour un classement crédible
        let ga=1+Math.round(Math.max(0,r+0.5)), gb=1+Math.round(Math.max(0,-r+0.5));
        tbl[a.name].gf+=ga; tbl[a.name].ga+=gb; tbl[b.name].gf+=gb; tbl[b.name].ga+=ga;
        if(ga>gb) tbl[a.name].pts+=3; else if(gb>ga) tbl[b.name].pts+=3; else { tbl[a.name].pts+=1; tbl[b.name].pts+=1; }
      }
    }
    return Object.keys(tbl).map(function(k){ return tbl[k]; }).sort(function(a,b){ return (b.pts-a.pts)||((b.gf-b.ga)-(a.gf-a.ga)); });
  }
  const otherPoolTable = _simPoolTable(otherPool);

  // ── Résultats des 3 matchs ENTRE LES AUTRES équipes de la poule (ils ne
  // concernent pas le joueur) : réglés immédiatement par force + aléa.
  const pts = {}; myPool.forEach(function(t){ pts[t.name]=0; });
  for(let i=0;i<others.length;i++){
    for(let j=i+1;j<others.length;j++){
      const a=others[i], b=others[j];
      const diff=(a.strength-b.strength)/12;
      const r=Math.random()*2-1 + diff;
      if(r>0.35)       pts[a.name]+=3;
      else if(r<-0.35) pts[b.name]+=3;
      else { pts[a.name]+=1; pts[b.name]+=1; }
    }
  }

  // ── Calendrier des 3 matchs JOUABLES du joueur : un mercredi toutes les
  // semaines à partir de la fin du championnat (C.date).
  const base = C.date || {year:1,month:8,day:1};
  const matches = others.map(function(opp, idx){
    const d = _addDays(base, (idx+1)*7);
    return {
      oppName: opp.name, oppStrength: opp.strength, oppLevel: opp.level,
      dateKey: _dateKey(d), date: d,
      isHome: (idx%2===0), // alterne domicile/extérieur
      played:false, scoreMe:null, scoreOpp:null,
    };
  });

  C.playoffs = {
    type:'district', active:true, done:false, promoted:false, detail:null,
    stage:'pools',                       // 'pools' → 'final'
    _levelAtStart: (C.club && C.club.level),  // pour détecter la promotion en fin de saison
    myDiv: myDiv, myPos: myPos, poolLabel: poolLbl,
    myName: (C.club&&C.club.name)||'Mon club',
    matches: matches, idx: 0,
    otherPts: pts, // points déjà acquis par les 3 autres équipes de la poule
    myPoolTeams: myPool.map(function(t){ return { name:t.name, strength:t.strength, isPlayer:!!t.isPlayer }; }),
    otherPoolLabel: (myPool===poolA)?'poule B':'poule A',
    otherPoolTable: otherPoolTable,      // classement complet de l'autre poule
  };
}

// Finalise l'étape de POULES : calcule le classement de la poule du joueur,
// puis — conformément au format District → R3 — enchaîne sur une POULE FINALE
// réunissant les 2 premiers de chaque poule. Seul le VAINQUEUR de la poule
// finale monte en R3.
function _valoriaFinalizeDistrictPlayoffs(C){
  const po = C.playoffs; if(!po) return;

  // ── Classement de la poule du joueur (ses 3 matchs joués) ──────────────
  let myPts=0, myGf=0, myGa=0;
  po.matches.forEach(function(m){
    if(!m.played) return;
    myGf += m.scoreMe||0; myGa += m.scoreOpp||0;
    if(m.scoreMe>m.scoreOpp) myPts+=3;
    else if(m.scoreMe===m.scoreOpp) myPts+=1;
  });
  const seen={}; const myPoolTable=[];
  po.matches.forEach(function(m){
    if(seen[m.oppName]) return; seen[m.oppName]=true;
    myPoolTable.push({ name:m.oppName, pts:po.otherPts[m.oppName]||0, gd:0 });
  });
  myPoolTable.push({ name:po.myName, pts:myPts, gd:myGf-myGa, isPlayer:true });
  myPoolTable.sort(function(a,b){ return (b.pts-a.pts) || ((b.gd||0)-(a.gd||0)); });
  po.myPoolTable = myPoolTable;                        // pour l'affichage complet
  const myRankPool = myPoolTable.findIndex(function(t){ return t.isPlayer; }) + 1;

  // ── Qualifiés pour la poule finale : top 2 de CHAQUE poule ─────────────
  const q1 = myPoolTable.slice(0,2).map(function(t){
    return { name:t.name, isPlayer:!!t.isPlayer,
             strength: t.isPlayer ? _valPlayerStrength(C) : _valNameStrength(po, t.name) };
  });
  const q2 = (po.otherPoolTable||[]).slice(0,2).map(function(t){
    return { name:t.name, isPlayer:false, strength:t.strength };
  });
  const finalists = q1.concat(q2);

  // Le joueur est-il qualifié pour la finale ?
  if(myRankPool > 2){
    po.promoted = false;
    po.detail = po.poolLabel+', '+myRankPool+'e — éliminé en poule.';
    po.done = true; po.active = false;
    return;
  }

  // ── Mise en place de la POULE FINALE (3 nouveaux matchs jouables) ───────
  const others = finalists.filter(function(t){ return !t.isPlayer; });
  const base = C.date || {year:1,month:8,day:1};
  const matches = others.map(function(opp, idx){
    const d = _addDays(base, (idx+1)*7);
    return { oppName:opp.name, oppStrength:opp.strength, dateKey:_dateKey(d), date:d,
             isHome:(idx%2===0), played:false, scoreMe:null, scoreOpp:null };
  });
  // Résultats entre les 3 autres finalistes (hors joueur).
  const fpts = {}; others.forEach(function(t){ fpts[t.name]=0; });
  for(let i=0;i<others.length;i++){ for(let j=i+1;j<others.length;j++){
    const a=others[i], b=others[j]; const diff=(a.strength-b.strength)/12; const r=Math.random()*2-1+diff;
    if(r>0.35) fpts[a.name]+=3; else if(r<-0.35) fpts[b.name]+=3; else { fpts[a.name]+=1; fpts[b.name]+=1; }
  }}

  po.stage = 'final';
  po.matches = matches;
  po.idx = 0;
  po.otherPts = fpts;
  po.finalists = finalists.map(function(t){ return { name:t.name, isPlayer:!!t.isPlayer }; });
  po.detail = 'Qualifié pour la poule finale ! Le 1er monte en R3.';
  po.active = true; po.done = false;
}

// Finalise la POULE FINALE : seul le 1er monte.
function _valoriaFinalizeDistrictFinal(C){
  const po = C.playoffs; if(!po) return;
  let myPts=0, myGf=0, myGa=0;
  po.matches.forEach(function(m){
    if(!m.played) return;
    myGf += m.scoreMe||0; myGa += m.scoreOpp||0;
    if(m.scoreMe>m.scoreOpp) myPts+=3; else if(m.scoreMe===m.scoreOpp) myPts+=1;
  });
  const seen={}; const table=[];
  po.matches.forEach(function(m){ if(seen[m.oppName])return; seen[m.oppName]=true;
    table.push({ name:m.oppName, pts:po.otherPts[m.oppName]||0, gd:0 }); });
  table.push({ name:po.myName, pts:myPts, gd:myGf-myGa, isPlayer:true });
  table.sort(function(a,b){ return (b.pts-a.pts)||((b.gd||0)-(a.gd||0)); });
  po.finalTable = table;
  const rank = table.findIndex(function(t){ return t.isPlayer; }) + 1;
  po.promoted = (rank === 1);                          // SEUL le 1er monte
  po.detail = 'Poule finale : '+rank+(rank===1?'er':'e')+' avec '+myPts+' pts'+(po.promoted?' — PROMU en R3 !':' — maintien.');
  po.done = true; po.active = false;
  // Applique RÉELLEMENT la montée en R3 : sans ça, on gagnait la poule finale
  // sans changer de division (et la promotion n'était pas reconnue par le
  // board → licenciement injuste malgré le titre).
  if(po.promoted && typeof C!=='undefined' && C && C.club){
    const target = (po.newLevel) || _valDistrictTargetR3(C);
    if(target){ C.club.level = target; po.newLevel = target; }
  }
}

// Détermine le niveau R3 cible pour une montée de district (selon la région).
function _valDistrictTargetR3(C){
  const region = (C.club && C.club.region) || '';
  // Divisions R3 connues par région ; repli générique sinon.
  const map = { valcourt:'valcourt_r3', brumefer:'brumefer_r3' };
  return map[region] || 'valcourt_r3';
}

// Force approximative d'une équipe nommée (pour la poule finale).
function _valNameStrength(po, name){
  const t = (po.otherPoolTable||[]).find(function(x){ return x.name===name; });
  if(t) return t.strength;
  const p = (po.myPoolTeams||[]).find(function(x){ return x.name===name; });
  return p ? p.strength : 55;
}
function _valPlayerStrength(C){
  const squad=(C.players||[]).concat(C.bench||[]); let sum=0,n=0;
  squad.forEach(function(p){ const s=p&&p.s; if(!s)return; sum+=((s.tec||50)+(s.spd||50)+(s.sht||50)+(s.def||50)+(s.stam||50)+(s.res||50))/6; n++; });
  return n?sum/n:55;
}

// proStandings : classement final de la Pro (trié, dernier = relégué).
function valoriaR1toPro(proStandings){
  const last=proStandings[proStandings.length-1];
  const region=last?last.region:'Valcourt';
  const r1Div = region==='Brumefer' ? 'brumefer_r1' : 'valcourt_r1';
  const champ = simulateValoriaDivision(r1Div)[0];
  return { champ, region, r1Div,
    note: region==='Brumefer'
      ? 'Brumefer récupère la place en Pro (son club était dernier).'
      : 'Valcourt récupère la place en Pro.' };
}

// Applique la fin de saison pour le joueur en fonction de son classement dans
// SA division. Renvoie {newLevel, message} ou null si pas de mouvement.
// C = careerV2, myPos = position du joueur (1..N), total = nb d'équipes.
function valoriaResolvePlayerSeason(C, myPos, total){
  const region=_valRegionName(C.club.region);
  const lvl=valoriaNormalizeLevel(C.club.level, region);
  // On aligne aussi le club sur l'id Valoria normalisé pour la suite.
  if(C.club.level!==lvl) C.club.level=lvl;
  let newLevel=lvl, msg=null;

  const proStandings = simulateValoriaDivision('pro');

  if(lvl==='pro'){
    // Dernier de la Pro → relégué dans sa région (R1 de sa région).
    if(myPos>=total){
      newLevel = region==='Brumefer' ? 'brumefer_r1' : 'valcourt_r1';
      msg='⬇️ Relégué de la Ligue Valorienne vers '+_valDivName(newLevel)+'.';
    } else {
      msg='🏆 Maintien en Ligue Valorienne (position '+myPos+').';
    }
  }
  else if(lvl==='valcourt_r1' || lvl==='brumefer_r1'){
    // Montée en Pro : SEULEMENT si le joueur est champion ET que sa région a la
    // place (règle d'équité : région du dernier de la Pro).
    const promo=valoriaR1toPro(proStandings);
    const myRegionEligible = (promo.region===region);
    if(myPos===1 && myRegionEligible){
      newLevel='pro';
      msg='🎉 CHAMPION et PROMU EN LIGUE VALORIENNE ! '+promo.note;
    } else if(myPos===1){
      msg='🏆 Champion de '+_valDivName(lvl)+' — mais la place en Pro revient à '+promo.region+' cette saison (règle d\'équité).';
    } else if(myPos>=total-1 && lvl==='valcourt_r1'){
      newLevel='valcourt_r2';
      msg='⬇️ Relégué en '+_valDivName('valcourt_r2')+'.';
    } else if(myPos>=total && lvl==='brumefer_r1'){
      newLevel='brumefer_r2';
      msg='⬇️ Relégué en '+_valDivName('brumefer_r2')+'.';
    } else {
      msg='Maintien en '+_valDivName(lvl)+' (position '+myPos+').';
    }
  }
  else if(lvl==='valcourt_r2'){
    // 2 premiers montent en R1, 2 derniers descendent en R3.
    if(myPos<=2){ newLevel='valcourt_r1'; msg='🎉 Promu en '+_valDivName('valcourt_r1')+' !'; }
    else if(myPos>=total-1){ newLevel='valcourt_r3'; msg='⬇️ Relégué en '+_valDivName('valcourt_r3')+'.'; }
    else msg='Maintien en R2 (position '+myPos+').';
  }
  else if(lvl==='valcourt_r3'){
    // 2 premiers montent en R1 (comme demandé), dernier descend en district.
    if(myPos<=2){ newLevel='valcourt_r1'; msg='🎉 Promu directement en '+_valDivName('valcourt_r1')+' !'; }
    else if(myPos>=total){ newLevel='valcourt_district1'; msg='⬇️ Relégué en District.'; }
    else msg='Maintien en R3 (position '+myPos+').';
  }
  else if(lvl==='brumefer_r2'){
    if(myPos<=2){ newLevel='brumefer_r1'; msg='🎉 Promu en '+_valDivName('brumefer_r1')+' !'; }
    else msg='Maintien en Brumefer R2 (position '+myPos+').';
  }
  else if(lvl && lvl.startsWith('valcourt_district')){
    // ── BARRAGES DE DISTRICT — VERSION JOUABLE ─────────────────────────
    // Format réel : top 2 de chacun des 4 districts → 8 qualifiés → 2 poules
    // de 4 → les 2 premiers de chaque poule montent en R3 (4 promus).
    // Le joueur qualifié doit désormais JOUER ses 3 matchs de poule (moteur
    // de match, dates réelles) : plus de tirage au sort. Si les barrages ont
    // déjà été joués (C.playoffs.done), on applique directement le résultat
    // acquis sur le terrain ; sinon on signale à l'appelant qu'il faut
    // d'abord les lancer (needsPlayoffs).
    if(myPos<=2){
      if(C.playoffs && C.playoffs.done){
        if(C.playoffs.promoted){
          newLevel = 'valcourt_r3';
          msg = '🎉 Barrages de district remportés (' + C.playoffs.detail + ') — PROMU en ' + _valDivName('valcourt_r3') + ' !';
        } else {
          msg = '⚔️ Barrages de district : ' + C.playoffs.detail + '. Maintien en ' + _valDivName(lvl) + '.';
        }
        C.playoffs = null;
      } else {
        return { needsPlayoffs:true };
      }
    } else {
      msg='Maintien en '+_valDivName(lvl)+' (position '+myPos+').';
    }
  }

  return { newLevel, message:msg, proStandings };
}

function _valDivName(id){
  return (window.VALORIA_DIVISIONS && window.VALORIA_DIVISIONS[id]) ? window.VALORIA_DIVISIONS[id].name : id;
}

// Normalise une région (id 'brumefer' ou nom 'Brumefer') vers le NOM d'affichage
// utilisé partout dans VALORIA_TEAMS ('Valcourt' / 'Brumefer').
function _valRegionName(r){
  if(!r) return 'Valcourt';
  const s=String(r).toLowerCase();
  if(s.indexOf('brum')>=0) return 'Brumefer';
  return 'Valcourt';
}

// Le mode carrière crée les clubs avec des niveaux GÉNÉRIQUES (d1/d2/d3/r1/r2/
// r3/dh). On les convertit en divisions VALORIA selon la région du club, pour
// que les règles s'appliquent. Idempotent : si déjà un id Valoria, on le garde.
function valoriaNormalizeLevel(level, region){
  const regName=_valRegionName(region);
  const isBrum = regName==='Brumefer';
  if(!level) return isBrum ? 'brumefer_r1' : 'valcourt_r3';
  if(VALORIA_LEVELS.indexOf(level)>=0) return level; // déjà normalisé
  const map = {
    d1:'pro', d2: isBrum?'brumefer_r1':'valcourt_r1', d3: isBrum?'brumefer_r2':'valcourt_r2',
    r1: isBrum?'brumefer_r1':'valcourt_r1', r2: isBrum?'brumefer_r2':'valcourt_r2',
    r3: isBrum?'brumefer_r2':'valcourt_r3',
    dh: 'valcourt_district1', // district (Brumefer n'a pas de district → R2)
  };
  let mapped = map[level] || (isBrum?'brumefer_r2':'valcourt_r3');
  if(isBrum && mapped.startsWith('valcourt_district')) mapped='brumefer_r2';
  return mapped;
}

if(typeof window!=='undefined'){
  Object.assign(window,{
    VALORIA_LEVELS, simulateValoriaDivision, valoriaDistrictPlayoffs,
    valoriaSimulateDistrictPlayoffs, valoriaSetupDistrictPlayoffs, _valoriaFinalizeDistrictPlayoffs,
    _valoriaFinalizeDistrictFinal, _valNameStrength, _valPlayerStrength,
    valoriaR1toPro, valoriaResolvePlayerSeason, valoriaNormalizeLevel, _valRegionName, _valDivName,
  });
}
