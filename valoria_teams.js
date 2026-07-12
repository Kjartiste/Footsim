// ═══════════════════════════════════════════════════════════
// VALORIA_TEAMS.JS — Équipes de Valoria réparties par division
// 106 équipes. Blason déterministe par nom (fromSeed).
// ═══════════════════════════════════════════════════════════

// Divisions de Valoria (métadonnées d'affichage + hiérarchie).
// La Ligue pro est nationale (2 clubs de Brumefer + 10 de Valcourt). Valcourt a
// 3 niveaux régionaux (R1/R2/R3) puis 4 districts ; Brumefer a R1/R2.
const VALORIA_DIVISIONS = {
  pro:                {name:'Ligue Valorienne', region:null, tier:'pro', order:0},
  valcourt_r1:        {name:'Valcourt R1', region:'Valcourt', tier:'regional', order:1},
  valcourt_r2:        {name:'Valcourt R2', region:'Valcourt', tier:'regional', order:2},
  valcourt_r3:        {name:'Valcourt R3', region:'Valcourt', tier:'regional', order:3},
  valcourt_district1: {name:'District 1 de Valcourt', region:'Valcourt', tier:'district', order:4},
  valcourt_district2: {name:'District 2 de Valcourt', region:'Valcourt', tier:'district', order:5},
  valcourt_district3: {name:'District 3 de Valcourt', region:'Valcourt', tier:'district', order:6},
  valcourt_district4: {name:'District 4 de Valcourt', region:'Valcourt', tier:'district', order:7},
  brumefer_r1:        {name:'Brumefer R1', region:'Brumefer', tier:'regional', order:1},
  brumefer_r2:        {name:'Brumefer R2', region:'Brumefer', tier:'regional', order:2},
};

const VALORIA_TEAMS = [
  {name:"FC Verdun",color:'#18c860',division:'pro',region:'Brumefer',tier:'pro'},
  {name:"AS Lumière",color:'#f0c028',division:'pro',region:'Brumefer',tier:'pro'},
  {name:"SC Mystère",color:'#8840e0',division:'pro',region:'Valcourt',tier:'pro'},
  {name:"RC Tonnerre",color:'#f07020',division:'pro',region:'Valcourt',tier:'pro'},
  {name:"US Phoenix",color:'#00b8d4',division:'pro',region:'Valcourt',tier:'pro'},
  {name:"AC Étoile",color:'#ff4081',division:'pro',region:'Valcourt',tier:'pro'},
  {name:"CS Vaillance",color:'#64dd17',division:'pro',region:'Valcourt',tier:'pro'},
  {name:"FC Horizon",color:'#40c4ff',division:'pro',region:'Valcourt',tier:'pro'},
  {name:"AS Bouclier",color:'#ea80fc',division:'pro',region:'Valcourt',tier:'pro'},
  {name:"SC Tempête",color:'#ffab40',division:'pro',region:'Valcourt',tier:'pro'},
  {name:"RC Victoire",color:'#ff1744',division:'pro',region:'Valcourt',tier:'pro'},
  {name:"FC Olympe",color:'#2979ff',division:'pro',region:'Valcourt',tier:'pro'},
  {name:"AS Falcons",color:'#00e5ff',division:'valcourt_r1',region:'Valcourt',tier:'regional'},
  {name:"SC Aurore",color:'#ffd740',division:'valcourt_r1',region:'Valcourt',tier:'regional'},
  {name:"US Aigle",color:'#69f0ae',division:'valcourt_r1',region:'Valcourt',tier:'regional'},
  {name:"AC Raptor",color:'#ff6d00',division:'valcourt_r1',region:'Valcourt',tier:'regional'},
  {name:"CS Titan",color:'#d500f9',division:'valcourt_r1',region:'Valcourt',tier:'regional'},
  {name:"RC Marée",color:'#00bcd4',division:'valcourt_r1',region:'Valcourt',tier:'regional'},
  {name:"FC Stade Nord",color:'#c6ff00',division:'valcourt_r1',region:'Valcourt',tier:'regional'},
  {name:"AS Delta",color:'#ff5252',division:'valcourt_r1',region:'Valcourt',tier:'regional'},
  {name:"US Renards",color:'#e040fb',division:'valcourt_r1',region:'Valcourt',tier:'regional'},
  {name:"SC Citadelle",color:'#1de9b6',division:'valcourt_r1',region:'Valcourt',tier:'regional'},
  {name:"AC Forge",color:'#ff6e40',division:'valcourt_r1',region:'Valcourt',tier:'regional'},
  {name:"FC Zéphyr",color:'#90a4ae',division:'valcourt_r1',region:'Valcourt',tier:'regional'},
  {name:"CS Loups Gris",color:'#f06292',division:'valcourt_r2',region:'Valcourt',tier:'regional'},
  {name:"RC Flèche",color:'#7986cb',division:'valcourt_r2',region:'Valcourt',tier:'regional'},
  {name:"AS Cosmos",color:'#4db6ac',division:'valcourt_r2',region:'Valcourt',tier:'regional'},
  {name:"SC Navire",color:'#dce775',division:'valcourt_r2',region:'Valcourt',tier:'regional'},
  {name:"FC Guerriers",color:'#ff8a65',division:'valcourt_r2',region:'Valcourt',tier:'regional'},
  {name:"US Gladiateurs",color:'#ef5350',division:'valcourt_r2',region:'Valcourt',tier:'regional'},
  {name:"AC Dragons",color:'#ab47bc',division:'valcourt_r2',region:'Valcourt',tier:'regional'},
  {name:"CS Panthères",color:'#26a69a',division:'valcourt_r2',region:'Valcourt',tier:'regional'},
  {name:"RC Mireval",color:'#18c860',division:'valcourt_r2',region:'Valcourt',tier:'regional'},
  {name:"CS Estival",color:'#f0c028',division:'valcourt_r2',region:'Valcourt',tier:'regional'},
  {name:"AS Estival",color:'#8840e0',division:'valcourt_r2',region:'Valcourt',tier:'regional'},
  {name:"SC Rivage",color:'#f07020',division:'valcourt_r2',region:'Valcourt',tier:'regional'},
  {name:"SC Cité",color:'#00b8d4',division:'valcourt_r3',region:'Valcourt',tier:'regional'},
  {name:"AC Concorde",color:'#ff4081',division:'valcourt_r3',region:'Valcourt',tier:'regional'},
  {name:"CS Clartois",color:'#64dd17',division:'valcourt_r3',region:'Valcourt',tier:'regional'},
  {name:"Union Concorde",color:'#40c4ff',division:'valcourt_r3',region:'Valcourt',tier:'regional'},
  {name:"Racing Cosmopolite",color:'#ea80fc',division:'valcourt_r3',region:'Valcourt',tier:'regional'},
  {name:"SC Novaris",color:'#ffab40',division:'valcourt_r3',region:'Valcourt',tier:'regional'},
  {name:"RC Portalis",color:'#ff1744',division:'valcourt_r3',region:'Valcourt',tier:'regional'},
  {name:"Olympique Portalis",color:'#2979ff',division:'valcourt_r3',region:'Valcourt',tier:'regional'},
  {name:"US Nouveau Monde",color:'#00e5ff',division:'valcourt_r3',region:'Valcourt',tier:'regional'},
  {name:"Olympique Solaris",color:'#ffd740',division:'valcourt_r3',region:'Valcourt',tier:'regional'},
  {name:"SC Cosmopolite",color:'#69f0ae',division:'valcourt_r3',region:'Valcourt',tier:'regional'},
  {name:"CS Belmont",color:'#ff6d00',division:'valcourt_r3',region:'Valcourt',tier:'regional'},
  {name:"AS de l'Orphelinat du Cœur",color:'#d500f9',division:'valcourt_district1',region:'Valcourt',tier:'district'},
  {name:"FC Vertvalon",color:'#00bcd4',division:'valcourt_district1',region:'Valcourt',tier:'district'},
  {name:"RC Amberac",color:'#c6ff00',division:'valcourt_district1',region:'Valcourt',tier:'district'},
  {name:"FC Espérance",color:'#ff5252',division:'valcourt_district1',region:'Valcourt',tier:'district'},
  {name:"RC Novaris",color:'#e040fb',division:'valcourt_district1',region:'Valcourt',tier:'district'},
  {name:"FC Havreux",color:'#1de9b6',division:'valcourt_district1',region:'Valcourt',tier:'district'},
  {name:"FC Cosmopolite",color:'#ff6e40',division:'valcourt_district1',region:'Valcourt',tier:'district'},
  {name:"Union Amberac",color:'#90a4ae',division:'valcourt_district1',region:'Valcourt',tier:'district'},
  {name:"US Montciel",color:'#f06292',division:'valcourt_district1',region:'Valcourt',tier:'district'},
  {name:"US Cosmopolite",color:'#7986cb',division:'valcourt_district1',region:'Valcourt',tier:'district'},
  {name:"Union Jardins",color:'#4db6ac',division:'valcourt_district2',region:'Valcourt',tier:'district'},
  {name:"Union Aurea",color:'#dce775',division:'valcourt_district2',region:'Valcourt',tier:'district'},
  {name:"Olympique Jardins",color:'#ff8a65',division:'valcourt_district2',region:'Valcourt',tier:'district'},
  {name:"SC Aurea",color:'#ef5350',division:'valcourt_district2',region:'Valcourt',tier:'district'},
  {name:"Olympique Rivage",color:'#ab47bc',division:'valcourt_district2',region:'Valcourt',tier:'district'},
  {name:"SC Lumina",color:'#26a69a',division:'valcourt_district2',region:'Valcourt',tier:'district'},
  {name:"RC Rivage",color:'#18c860',division:'valcourt_district2',region:'Valcourt',tier:'district'},
  {name:"FC Liberté",color:'#f0c028',division:'valcourt_district2',region:'Valcourt',tier:'district'},
  {name:"FC Cité",color:'#8840e0',division:'valcourt_district2',region:'Valcourt',tier:'district'},
  {name:"FC Concorde",color:'#f07020',division:'valcourt_district2',region:'Valcourt',tier:'district'},
  {name:"Olympique Estival",color:'#00b8d4',division:'valcourt_district3',region:'Valcourt',tier:'district'},
  {name:"Racing Nouveau Monde",color:'#ff4081',division:'valcourt_district3',region:'Valcourt',tier:'district'},
  {name:"FC Valmont",color:'#64dd17',division:'valcourt_district3',region:'Valcourt',tier:'district'},
  {name:"CS Havreux",color:'#40c4ff',division:'valcourt_district3',region:'Valcourt',tier:'district'},
  {name:"Union Estival",color:'#ea80fc',division:'valcourt_district3',region:'Valcourt',tier:'district'},
  {name:"Racing Valmont",color:'#ffab40',division:'valcourt_district3',region:'Valcourt',tier:'district'},
  {name:"Olympique Clartois",color:'#ff1744',division:'valcourt_district3',region:'Valcourt',tier:'district'},
  {name:"AS Clartois",color:'#2979ff',division:'valcourt_district3',region:'Valcourt',tier:'district'},
  {name:"AS Carrefour",color:'#00e5ff',division:'valcourt_district3',region:'Valcourt',tier:'district'},
  {name:"CS Central",color:'#ffd740',division:'valcourt_district3',region:'Valcourt',tier:'district'},
  {name:"CS Pontvieux",color:'#69f0ae',division:'valcourt_district4',region:'Valcourt',tier:'district'},
  {name:"RC Belmont",color:'#ff6d00',division:'valcourt_district4',region:'Valcourt',tier:'district'},
  {name:"SC Clartois",color:'#d500f9',division:'valcourt_district4',region:'Valcourt',tier:'district'},
  {name:"Racing Concorde",color:'#00bcd4',division:'valcourt_district4',region:'Valcourt',tier:'district'},
  {name:"RC Montciel",color:'#c6ff00',division:'valcourt_district4',region:'Valcourt',tier:'district'},
  {name:"CS Espérance",color:'#ff5252',division:'valcourt_district4',region:'Valcourt',tier:'district'},
  {name:"RC Liberté",color:'#e040fb',division:'valcourt_district4',region:'Valcourt',tier:'district'},
  {name:"AS Métropole",color:'#1de9b6',division:'valcourt_district4',region:'Valcourt',tier:'district'},
  {name:"Union Espérance",color:'#ff6e40',division:'valcourt_district4',region:'Valcourt',tier:'district'},
  {name:"AC Aurea",color:'#90a4ae',division:'valcourt_district4',region:'Valcourt',tier:'district'},
  {name:"Olympique Bastion",color:'#f06292',division:'brumefer_r1',region:'Brumefer',tier:'regional'},
  {name:"RC Résistance",color:'#7986cb',division:'brumefer_r1',region:'Brumefer',tier:'regional'},
  {name:"US Charbon",color:'#4db6ac',division:'brumefer_r1',region:'Brumefer',tier:'regional'},
  {name:"Union Minerai",color:'#dce775',division:'brumefer_r1',region:'Brumefer',tier:'regional'},
  {name:"Racing Charbon",color:'#ff8a65',division:'brumefer_r1',region:'Brumefer',tier:'regional'},
  {name:"SC Forges",color:'#ef5350',division:'brumefer_r1',region:'Brumefer',tier:'regional'},
  {name:"US Durfer",color:'#ab47bc',division:'brumefer_r1',region:'Brumefer',tier:'regional'},
  {name:"FC Fonderie",color:'#26a69a',division:'brumefer_r1',region:'Brumefer',tier:'regional'},
  {name:"AS Ouvrier",color:'#18c860',division:'brumefer_r1',region:'Brumefer',tier:'regional'},
  {name:"CS Rempart",color:'#f0c028',division:'brumefer_r2',region:'Brumefer',tier:'regional'},
  {name:"Union Houillère",color:'#8840e0',division:'brumefer_r2',region:'Brumefer',tier:'regional'},
  {name:"US Ouvrier",color:'#f07020',division:'brumefer_r2',region:'Brumefer',tier:'regional'},
  {name:"SC Griseval",color:'#00b8d4',division:'brumefer_r2',region:'Brumefer',tier:'regional'},
  {name:"AC Cendreux",color:'#ff4081',division:'brumefer_r2',region:'Brumefer',tier:'regional'},
  {name:"AS Vieux Stade",color:'#64dd17',division:'brumefer_r2',region:'Brumefer',tier:'regional'},
  {name:"RC Fonderie",color:'#40c4ff',division:'brumefer_r2',region:'Brumefer',tier:'regional'},
  {name:"Olympique Charbon",color:'#ea80fc',division:'brumefer_r2',region:'Brumefer',tier:'regional'},
  {name:"Union Acier",color:'#ffab40',division:'brumefer_r2',region:'Brumefer',tier:'regional'}
];

function ensureValoriaBadges(){
  if(typeof BadgeGenerator==='undefined') return;
  VALORIA_TEAMS.forEach(t=>{ if(!t.badge){ t.badge = BadgeGenerator.fromSeed(t.name, {text: (typeof teamIni==='function'?teamIni(t.name):'')}); } });
}
function valoriaTeamsByDivision(divId){ return VALORIA_TEAMS.filter(t=>t.division===divId); }

// ═══════════════════════════════════════════════════════════
// DÉTAILS DE CLUB (déterministes par nom, ton manga/fun)
// ───────────────────────────────────────────────────────────
// Chaque club Valoria n'a que name/color/division/tier. On génère à la volée
// une « fiche » crédible et stable (toujours la même pour un nom donné) : année
// de fondation, surnom épique, stade, réputation, statut, finances, objectif
// du board et infrastructures. Le TIER module l'échelle (un club pro est plus
// riche/réputé qu'un club de district). Le ton se veut fun, pas administratif.
// ═══════════════════════════════════════════════════════════
function _vclubHash(s){ let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
// Petit PRNG déterministe (mulberry32) amorcé par le nom → suite stable.
function _vclubRng(seed){ let a=seed>>>0; return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function _vpick(rng,arr){ return arr[Math.floor(rng()*arr.length)]; }

function valoriaClubDetails(team){
  if(!team) return null;
  if(team._details) return team._details; // cache
  const name = team.name || 'Club';
  const tier = team.tier || 'regional';
  const rng = _vclubRng(_vclubHash(name));

  // ── Année de fondation : les clubs pro sont plus anciens/prestigieux ──────
  const foundBase = tier==='pro' ? 1890 : tier==='regional' ? 1925 : 1955;
  const founded = foundBase + Math.floor(rng()*45);

  // ── Surnom épique (ton manga) ─────────────────────────────────────────────
  const nickA = ['Les','L\'Escadron','La Brigade','Le Clan','La Meute','L\'Ordre','La Légion','Les Chevaliers','La Garde','L\'Équipage'];
  const nickB = tier==='pro'
    ? ['Dragons Célestes','Foudres d\'Argent','Titans Écarlates','Lames du Destin','Phénix Éternels','Gardiens du Ciel','Étoiles Filantes','Croix de Feu','Ombres Royales','Fauves Dorés']
    : tier==='regional'
    ? ['Loups d\'Acier','Corbeaux Noirs','Vagues Furieuses','Griffes de Fer','Éclairs Bleus','Renards Rusés','Sabres Jumeaux','Vents Hurlants','Boucliers Fêlés','Tigres de Bronze']
    : ['Cœurs Vaillants','Petits Poucets','Gamins du Quartier','Rêveurs Têtus','Chats de Gouttière','Étincelles','Bleus Courageux','Poings Serrés','Sans-Peur','Va-Nu-Pieds'];
  const nickname = _vpick(rng,nickA)+' '+_vpick(rng,nickB);

  // ── Stade + capacité (échelle par tier) ───────────────────────────────────
  const stadPrefix = ['Stade','Arène','Colisée','Enceinte','Chaudron','Antre'];
  const stadName = ['de la Tempête','des Braves','du Vieux Chêne','de l\'Aurore','des Cent Lances','du Croissant','de Fer','des Murmures','du Levant','de la Dernière Chance'];
  const capBase = tier==='pro' ? 22000 : tier==='regional' ? 6000 : 900;
  const capacity = capBase + Math.floor(rng()*(tier==='pro'?28000:tier==='regional'?9000:2600));
  const stadium = _vpick(rng,stadPrefix)+' '+_vpick(rng,stadName);

  // ── Réputation 0-100 (par tier + variation) ───────────────────────────────
  const repBase = tier==='pro' ? 62 : tier==='regional' ? 38 : 16;
  const reputation = Math.max(1,Math.min(100, repBase + Math.floor(rng()*22) - 6));

  // ── Statut (ton manga) ────────────────────────────────────────────────────
  const status = tier==='pro'
    ? _vpick(rng,['⚔️ Écurie légendaire','🔥 Cadors du championnat','🏆 Habitué des sommets','💎 Grand club ambitieux'])
    : tier==='regional'
    ? _vpick(rng,['💪 Solide semi-pro','⚡ Outsider tenace','🌱 Club qui monte','🛡️ Valeur sûre du coin'])
    : _vpick(rng,['🍜 Bande de copains','✨ Petit club de cœur','🎒 Amateurs passionnés','🏮 Fierté du village']);

  // ── Finances (ton fun) ────────────────────────────────────────────────────
  const finances = tier==='pro'
    ? _vpick(rng,['💰 Coffres pleins','📈 Solides','🪙 Confortables','💵 Grand train de vie'])
    : tier==='regional'
    ? _vpick(rng,['⚖️ Équilibrées','😬 Serrées','📉 Fragiles','🧧 Ça passe… de justesse'])
    : _vpick(rng,['🥟 Tirelire du dimanche','🕳️ Fauchés mais heureux','🍥 Bouts de ficelle','🪹 Presque à sec']);

  // ── Objectif du board (Board Expectation, ton fun) ────────────────────────
  const boardGoal = tier==='pro'
    ? _vpick(rng,['🏆 Vainqueur','⭐ Titre ou rien','🥇 Podium exigé','🔝 Haut de tableau'])
    : tier==='regional'
    ? _vpick(rng,['📈 Jouer la montée','🎯 Milieu de tableau','✊ Se maintenir dignement','🌟 Créer la surprise'])
    : _vpick(rng,['❤️ Prendre du plaisir','🛟 Éviter la dernière place','🌱 Faire grandir les jeunes','🎉 Un exploit en coupe']);

  // ── Infrastructures (⭐ sur 5) ────────────────────────────────────────────
  const infraBase = tier==='pro' ? 3 : tier==='regional' ? 2 : 1;
  const training = Math.max(1,Math.min(5, infraBase + Math.floor(rng()*3) - 1));
  const youth    = Math.max(1,Math.min(5, infraBase + Math.floor(rng()*3) - 1));

  const d = { founded, nickname, stadium, capacity, reputation, status, finances, boardGoal, training, youth };
  try{ Object.defineProperty(team,'_details',{value:d,enumerable:false}); }catch(e){ team._details=d; }
  return d;
}

if(typeof window!=='undefined'){
  window.valoriaClubDetails = valoriaClubDetails;
}

if(typeof window!=='undefined'){
  window.VALORIA_TEAMS = VALORIA_TEAMS;
  window.VALORIA_DIVISIONS = VALORIA_DIVISIONS;
  window.ensureValoriaBadges = ensureValoriaBadges;
  window.valoriaTeamsByDivision = valoriaTeamsByDivision;
}
