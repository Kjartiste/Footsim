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

// Résout la promotion R1 → Pro selon la règle d'équité.
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
  const region=C.club.region;
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
    // Play-offs : top 2 du district → play-offs → 4 montent en R3.
    if(myPos<=2){
      // Le joueur atteint les play-offs ; on simule sa réussite avec une chance
      // proportionnelle à sa position (1er a plus de chances que 2e).
      const win = Math.random() < (myPos===1?0.6:0.4);
      if(win){ newLevel='valcourt_r3'; msg='🎉 Play-offs remportés — PROMU en '+_valDivName('valcourt_r3')+' !'; }
      else msg='Play-offs de district atteints, mais éliminé. Maintien.';
    } else {
      msg='Maintien en '+_valDivName(lvl)+' (position '+myPos+').';
    }
  }

  return { newLevel, message:msg, proStandings };
}

function _valDivName(id){
  return (window.VALORIA_DIVISIONS && window.VALORIA_DIVISIONS[id]) ? window.VALORIA_DIVISIONS[id].name : id;
}

// Le mode carrière crée les clubs avec des niveaux GÉNÉRIQUES (d1/d2/d3/r1/r2/
// r3/dh). On les convertit en divisions VALORIA selon la région du club, pour
// que les règles s'appliquent. Idempotent : si déjà un id Valoria, on le garde.
function valoriaNormalizeLevel(level, region){
  if(!level) return region==='Brumefer' ? 'brumefer_r1' : 'valcourt_r3';
  if(VALORIA_LEVELS.indexOf(level)>=0) return level; // déjà normalisé
  const isBrum = region==='Brumefer';
  const map = {
    d1:'pro', d2: isBrum?'brumefer_r1':'valcourt_r1', d3: isBrum?'brumefer_r2':'valcourt_r2',
    r1: isBrum?'brumefer_r1':'valcourt_r1', r2: isBrum?'brumefer_r2':'valcourt_r2',
    r3: isBrum?'brumefer_r2':'valcourt_r3',
    dh: 'valcourt_district1', // district (Brumefer n'a pas de district → R2)
  };
  let mapped = map[level] || (isBrum?'brumefer_r2':'valcourt_r3');
  // Brumefer n'a pas de district : replier vers R2.
  if(isBrum && mapped.startsWith('valcourt_district')) mapped='brumefer_r2';
  return mapped;
}

if(typeof window!=='undefined'){
  Object.assign(window,{
    VALORIA_LEVELS, simulateValoriaDivision, valoriaDistrictPlayoffs,
    valoriaR1toPro, valoriaResolvePlayerSeason, valoriaNormalizeLevel, _valDivName,
  });
}
