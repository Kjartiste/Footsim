// ═══════════════════════════════════════════════════════════
// VALORIA_TEAMS.JS — Équipes de Valoria réparties par division
// Généré : 94 équipes. Blason déterministe par nom (fromSeed),
// calculé à la volée par ensureValoriaBadges() pour ne rien stocker en dur.
// ═══════════════════════════════════════════════════════════

// Divisions de Valoria (métadonnées d'affichage + hiérarchie).
const VALORIA_DIVISIONS = {
  pro:                {name:'Ligue Valorienne', region:null, tier:'pro', order:0},
  valcourt_r1:        {name:'Valcourt R1', region:'Valcourt', tier:'regional', order:1},
  valcourt_r2:        {name:'Valcourt R2', region:'Valcourt', tier:'regional', order:2},
  valcourt_district:  {name:'District de Valcourt', region:'Valcourt', tier:'district', order:3},
  brumefer_r1:        {name:'Brumefer R1', region:'Brumefer', tier:'regional', order:1},
  brumefer_r2:        {name:'Brumefer R2', region:'Brumefer', tier:'regional', order:2},
};

const VALORIA_TEAMS = [
  {name:"FC Verdun",color:'#18c860',division:'pro',region:null,tier:'pro'},
  {name:"AS Lumière",color:'#f0c028',division:'pro',region:null,tier:'pro'},
  {name:"SC Mystère",color:'#8840e0',division:'pro',region:null,tier:'pro'},
  {name:"RC Tonnerre",color:'#f07020',division:'pro',region:null,tier:'pro'},
  {name:"US Phoenix",color:'#00b8d4',division:'pro',region:null,tier:'pro'},
  {name:"AC Étoile",color:'#ff4081',division:'pro',region:null,tier:'pro'},
  {name:"CS Vaillance",color:'#64dd17',division:'pro',region:null,tier:'pro'},
  {name:"FC Horizon",color:'#40c4ff',division:'pro',region:null,tier:'pro'},
  {name:"AS Bouclier",color:'#ea80fc',division:'pro',region:null,tier:'pro'},
  {name:"SC Tempête",color:'#ffab40',division:'pro',region:null,tier:'pro'},
  {name:"RC Victoire",color:'#ff1744',division:'pro',region:null,tier:'pro'},
  {name:"FC Olympe",color:'#2979ff',division:'pro',region:null,tier:'pro'},
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
  {name:"FC Valcourt",color:'#18c860',division:'valcourt_r2',region:'Valcourt',tier:'regional'},
  {name:"AS Clairval",color:'#f0c028',division:'valcourt_r2',region:'Valcourt',tier:'regional'},
  {name:"US Solaris",color:'#8840e0',division:'valcourt_r2',region:'Valcourt',tier:'regional'},
  {name:"Olympique Céleste",color:'#f07020',division:'valcourt_r2',region:'Valcourt',tier:'regional'},
  {name:"AS de l'Orphelinat du Cœur",color:'#00b8d4',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"FC Vertvalon",color:'#ff4081',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"SC Verval",color:'#64dd17',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"AS 港",color:'#40c4ff',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"CS Clairval",color:'#ea80fc',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"US Nouveau Monde",color:'#ffab40',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"AS Carrefour",color:'#ff1744',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"FC Clairval",color:'#2979ff',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"Union Solaris",color:'#00e5ff',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"US Novaris",color:'#ffd740',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"CS Novaris",color:'#69f0ae',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"AC Carrefour",color:'#ff6d00',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"RC Concorde",color:'#d500f9',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"FC Métropole",color:'#00bcd4',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"Racing Riveraine",color:'#c6ff00',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"Union Liberté",color:'#ff5252',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"CS Havreux",color:'#e040fb',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"RC Montciel",color:'#1de9b6',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"Racing Cosmopolite",color:'#ff6e40',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"AC Rivage",color:'#90a4ae',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"Olympique Novaris",color:'#f06292',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"FC Riveraine",color:'#7986cb',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"RC Estival",color:'#4db6ac',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"US Cosmopolite",color:'#dce775',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"Union Riveraine",color:'#ff8a65',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"Union Grandmont",color:'#ef5350',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"AC Lumina",color:'#ab47bc',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"US Concorde",color:'#26a69a',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"AC Valcourt",color:'#18c860',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"SC Grandmont",color:'#f0c028',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"SC Riveraine",color:'#8840e0',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"AC Nouveau Monde",color:'#f07020',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"Racing Aurea",color:'#00b8d4',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"FC Estival",color:'#ff4081',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"CS Rivage",color:'#64dd17',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"AC Estival",color:'#40c4ff',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"AS Grandmont",color:'#ea80fc',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"SC Central",color:'#ffab40',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"US Aurea",color:'#ff1744',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"Olympique 港",color:'#2979ff',division:'valcourt_district',region:'Valcourt',tier:'district'},
  {name:"FC Brumefer",color:'#00e5ff',division:'brumefer_r1',region:'Brumefer',tier:'regional'},
  {name:"Union Durfer",color:'#ffd740',division:'brumefer_r1',region:'Brumefer',tier:'regional'},
  {name:"FC Minerai",color:'#69f0ae',division:'brumefer_r1',region:'Brumefer',tier:'regional'},
  {name:"US Rempart",color:'#ff6d00',division:'brumefer_r1',region:'Brumefer',tier:'regional'},
  {name:"AS Houillère",color:'#d500f9',division:'brumefer_r1',region:'Brumefer',tier:'regional'},
  {name:"US Forges",color:'#00bcd4',division:'brumefer_r1',region:'Brumefer',tier:'regional'},
  {name:"CS Acier",color:'#c6ff00',division:'brumefer_r1',region:'Brumefer',tier:'regional'},
  {name:"US Charbon",color:'#ff5252',division:'brumefer_r1',region:'Brumefer',tier:'regional'},
  {name:"CS Enclume",color:'#e040fb',division:'brumefer_r1',region:'Brumefer',tier:'regional'},
  {name:"US Enclume",color:'#1de9b6',division:'brumefer_r2',region:'Brumefer',tier:'regional'},
  {name:"CS Résistance",color:'#ff6e40',division:'brumefer_r2',region:'Brumefer',tier:'regional'},
  {name:"AS Vieux Stade",color:'#90a4ae',division:'brumefer_r2',region:'Brumefer',tier:'regional'},
  {name:"RC Charbon",color:'#f06292',division:'brumefer_r2',region:'Brumefer',tier:'regional'},
  {name:"FC Sombreforge",color:'#7986cb',division:'brumefer_r2',region:'Brumefer',tier:'regional'},
  {name:"FC Fonderie",color:'#4db6ac',division:'brumefer_r2',region:'Brumefer',tier:'regional'},
  {name:"Racing Acier",color:'#dce775',division:'brumefer_r2',region:'Brumefer',tier:'regional'},
  {name:"RC Âpremont",color:'#ff8a65',division:'brumefer_r2',region:'Brumefer',tier:'regional'},
  {name:"US Minerai",color:'#ef5350',division:'brumefer_r2',region:'Brumefer',tier:'regional'},

  // ── RÉSERVES DES CLUBS PRO NOMMÉS (équipes B/C) ────────────────────────
  // Un club riche (Valcourt) peut se permettre deux équipes de réserve (B en
  // Régional 1, C en Régional 2) ; un club pauvre (Brumefer) une seule (B).
  // Même identité visuelle que le club mère (couleurs/blason repris, juste
  // dépouillé — bordure simple, 0 étoile), effectif généré normalement comme
  // les autres équipes de division (pas d'effectif fixe, contrairement au
  // grand club dans presets.js). `parentClub` est une métadonnée d'affichage.
  {name:"RC Valcourt B", color:'#2e8b8b', division:'valcourt_r1', region:'Valcourt', tier:'regional', parentClub:'RC Valcourt',
    badge:{shape:'shield_mod',border:'simple',background:'half_l',colors:['#2e8b8b','#f5f5f5','#ffd700'],icon:'griffin',iconColor:'#ffd700',iconY:-8,text:'RCV B',year:'1922',stars:0,bgOpacity:1}},
  {name:"RC Valcourt C", color:'#2e8b8b', division:'valcourt_r2', region:'Valcourt', tier:'regional', parentClub:'RC Valcourt',
    badge:{shape:'shield_mod',border:'simple',background:'half_l',colors:['#2e8b8b','#f5f5f5','#ffd700'],icon:'griffin',iconColor:'#ffd700',iconY:-8,text:'RCV C',year:'1922',stars:0,bgOpacity:1}},
  {name:"AS Horizon B", color:'#c0392b', division:'valcourt_r1', region:'Valcourt', tier:'regional', parentClub:'AS Horizon',
    badge:{shape:'shield_fr',border:'simple',background:'solid',colors:['#c0392b','#f8e9d6','#e8c547'],icon:'phoenix',iconColor:'#e8c547',iconY:-6,text:'ASH B',year:'1901',stars:0,bgOpacity:1}},
  {name:"AS Horizon C", color:'#c0392b', division:'valcourt_r2', region:'Valcourt', tier:'regional', parentClub:'AS Horizon',
    badge:{shape:'shield_fr',border:'simple',background:'solid',colors:['#c0392b','#f8e9d6','#e8c547'],icon:'phoenix',iconColor:'#e8c547',iconY:-6,text:'ASH C',year:'1901',stars:0,bgOpacity:1}},
  {name:"FC Brumefer B", color:'#7a5c3a', division:'brumefer_r1', region:'Brumefer', tier:'regional', parentClub:'FC Brumefer',
    badge:{shape:'shield_en',border:'simple',background:'hstripes',colors:['#7a5c3a','#2e2e2e','#c9a227'],icon:'bear',iconColor:'#c9a227',iconY:-6,text:'FCB B',year:'1898',stars:0,bgOpacity:1}},
];

// Attribue à chaque équipe un blason stable dérivé de son nom (si badges.js
// est chargé). Idempotent. Appelé au chargement.
function ensureValoriaBadges(){
  if(typeof BadgeGenerator==='undefined') return;
  VALORIA_TEAMS.forEach(t=>{ if(!t.badge){ t.badge = BadgeGenerator.fromSeed(t.name, {text: (typeof teamIni==='function'?teamIni(t.name):'')}); } });
}

// Regroupe les équipes par division (pour l'affichage en cascade / calendriers).
function valoriaTeamsByDivision(divId){ return VALORIA_TEAMS.filter(t=>t.division===divId); }

if(typeof window!=='undefined'){
  window.VALORIA_TEAMS = VALORIA_TEAMS;
  window.VALORIA_DIVISIONS = VALORIA_DIVISIONS;
  window.ensureValoriaBadges = ensureValoriaBadges;
  window.valoriaTeamsByDivision = valoriaTeamsByDivision;
}
