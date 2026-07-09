// ═══════════════════════════════════════════════════
// DATA.JS — Constantes, sorts, formations, équipes
// ═══════════════════════════════════════════════════

window.onerror=function(msg,src,line,col,err){
  if(msg&&msg.includes('not defined')){
    console.error('GLOBAL ERROR:',msg,'at',src+':'+line+':'+col);
    console.error('Stack:',err?.stack);
  }
  return false;
};
'use strict';
// ═══════════════════════════════════════════════════════════
// WORLD: 75m × 50m (7-a-side)
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// WORLD: dimensions terrain (modifiables selon le mode)
// Valeurs par défaut : 7v7 (75×50)
// ═══════════════════════════════════════════════════════════
let WW=75,WH=50;
let PCX=WW/2,PCY=WH/2;
let GY1=PCY-3.0,GY2=PCY+3.0;
let PSX=9;
let PA_W=12,PA_H=26;

// Recalculer toutes les constantes dérivées après changement de mode
function _recalcTerrainConstants(){
  PCX=WW/2; PCY=WH/2;
  GY1=PCY-3.0; GY2=PCY+3.0;
}

function _applyMode5v5(){
  WW=60; WH=40; PSX=7; PA_W=10; PA_H=20;
  GY1=PCY-2.5; GY2=PCY+2.5; // but plus étroit en futsal/5v5
  _recalcTerrainConstants();
}

function _applyMode7v7(){
  WW=75; WH=50; PSX=9; PA_W=12; PA_H=26;
  GY1=PCY-3.0; GY2=PCY+3.0;
  _recalcTerrainConstants();
}

function _applyMode11v11(){
  WW=105; WH=68; PSX=11; PA_W=16.5; PA_H=40.3;
  GY1=PCY-3.66; GY2=PCY+3.66; // but 7.32m
  _recalcTerrainConstants();
}

// Canvas scale helpers (set on resize)
let _s=1,_ox=0,_oy=0;
const wx=x=>x*_s+_ox, wy=y=>y*_s+_oy, ws=v=>v*_s;

// ═══════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════
const SPELLS=[
  // Tirs offensifs
  {id:'fire',    n:'Tir de Feu',        t:'fire',     pow:32, mp:20, prob:.12, col:'#e02030', pc:'#ff6060', desc:'Frappe enveloppée de flammes. Modérée en puissance mais fiable et précise.'},
  {id:'fireball',n:'Boule de Feu',      t:'fire',     pow:48, mp:35, prob:.07, col:'#ff4500', pc:'#ffaa00', desc:'Boule de feu dévstatrice. Rare - mais quand elle part, le gardien ne peut rien faire.'},
  {id:'ice',     n:'Frappe Glacée',     t:'ice',      pow:18, mp:15, prob:.09, col:'#1878e8', pc:'#80c0ff', desc:'Tir qui laisse une trainée de givre. Peu puissant mais ralentit les defenseurs.'},
  {id:'thunder', n:'Frappe Éclair',     t:'thunder',  pow:26, mp:18, prob:.10, col:'#f0c028', pc:'#ffe060', desc:'Tir foudroyant a vitesse supersonique. Le gardien voit a peine la balle partir.'},
  {id:'eldritch',n:'Eldritch Blast',    t:'eldritch', pow:40, mp:30, prob:.08, col:'#9b59b6', pc:'#d7aefb', desc:'Energie mystique concentree en tir. Puissant a courte portee avec onde de choc.'},
  {id:'illusion',n:'Tir Illusoire',     t:'illusion', pow:28, mp:22, prob:.09, col:'#ff9800', pc:'#ffe0b2', desc:'La balle cree un double. Le gardien est trompe sur la vraie trajectoire.'},
  {id:'mouton',  n:'Mouton Ball',       t:'mouton',   pow:20, mp:18, prob:.10, col:'#795548', pc:'#d7ccc8', desc:'Le ballon se couvre de laine et roule vers le but adverse. Simple mais deroutant.'},
  {id:'tech',    n:'Dribble Magique',   t:'tech',     pow:22, mp:12, prob:.11, col:'#8840e0', pc:'#d090ff', desc:'Dribble enchanté - le porteur devient insaisissable le temps dun éclair.'},
  // Soutien
  {id:'pass',    n:'Passe Précise',     t:'pass',     pow:0,  mp:14, prob:.12, col:'#00bcd4', pc:'#b2ebf2', desc:'Passe télépathique vers le coéquipier le mieux placé, même à travers la défense.'},
  {id:'heal',    n:'Soin Collectif',    t:'heal',     pow:0,  mp:22, prob:.07, col:'#18c860', pc:'#80ffb0', desc:'Soin collectif qui restaure les forces de toute léquipe en même temps.'},
  {id:'soin',    n:'Soin',             t:'soin',     pow:0,  mp:28, prob:.07, col:'#69f0ae', pc:'#ccff90', desc:'Soin profond du porteur - endurance et PV entièrement restaurés.'},
  {id:'amitie',  n:'Amitié',           t:'amitie',   pow:0,  mp:30, prob:.06, col:'#ff80ab', pc:'#fce4ec', desc:'Aura de camaraderie - toute léquipe joue au-dessus de son niveau 20 secondes.'},
  {id:'shield',  n:'Mur Défensif',     t:'shield',   pow:0,  mp:10, prob:.08, col:'#4878a0', pc:'#a0c0e0', desc:'Un mur de force se matérialise devant le but - presque infranchissable.'},
  {id:'tornado', n:'Tornade',          t:'tornado',  pow:0,  mp:26, prob:.07, col:'#80cbc4', pc:'#e0f2f1', desc:'Une mini-tornade surgit et éparpille les adversaires qui rodaient trop près.'},
  // Debuffs
  {id:'suggest', n:'Suggestion Mentale',t:'suggest',  pow:0,  mp:25, prob:.07, col:'#1abc9c', pc:'#aefde8', desc:'Suggere a un adversaire de fuir. Il se deplace loin du ballon sans savoir pourquoi.'},
  {id:'charm',   n:'Charme',           t:'charm',    pow:0,  mp:20, prob:.08, col:'#e91e63', pc:'#f8bbd0', desc:'Un charme irrésistible - un adversaire reste cloué sur place quelques secondes.'},
  {id:'ice2',    n:'Sol Glissant',     t:'ice2',     pow:0,  mp:28, prob:.06, col:'#4fc3f7', pc:'#e1f5fe', desc:'Le sol adverse devient une patinoire. Personne ne sprinte sur la glace.'},
  {id:'pacif',   n:'Pacification',     t:'pacif',    pow:0,  mp:24, prob:.07, col:'#ce93d8', pc:'#f3e5f5', desc:'Pacification mentale - un adversaire joue à mi-régime pendant plusieurs secondes.'},
  // Kraland offensif
  {id:'cyclon',  n:'Cyclone',          t:'cyclon',   pow:38, mp:32, prob:.07, col:'#80deea', pc:'#e0f7fa', desc:'Un cyclone balaie les défenseurs, puis tir à pleine puissance dans lespace libéré.'},
  {id:'telekib', n:'Coup Télékin.',    t:'telekib',  pow:45, mp:38, prob:.06, col:'#7e57c2', pc:'#ede7f6', desc:'La balle disparaît et réapparaît dans le but - le gardien réagit trop tard.'},
  {id:'deluge',  n:'Déluge',           t:'deluge',   pow:30, mp:26, prob:.08, col:'#1565c0', pc:'#bbdefb', desc:'Déluge soudain - terrain en bourbier, adversaires ralentis, puis tir dans la foulée.'},
  {id:'terreur', n:'Terreur',          t:'terreur',  pow:0,  mp:22, prob:.08, col:'#b71c1c', pc:'#ffcdd2', desc:'Terreur absolue - toute léquipe adverse est figée de peur quelques secondes.'},
  {id:'folie',   n:'Folie',            t:'folie',    pow:0,  mp:28, prob:.07, col:'#e040fb', pc:'#f3e5f5', desc:'Folie pure - un adversaire perd le contrôle et court dans tous les sens.'},
  // Kraland soutien
  {id:'transe',  n:'Transe Chamanique',t:'transe',   pow:0,  mp:24, prob:.07, col:'#ff6f00', pc:'#fff3e0', desc:'Transe chamanique - toute léquipe entre en état second et dépasse ses limites.'},
  {id:'invis',   n:'Invisibilité',     t:'invis',    pow:0,  mp:20, prob:.09, col:'#b0bec5', pc:'#eceff1', desc:'Le porteur disparaît aux yeux de tous - son prochain dribble est imparable.'},
  {id:'peaupierre',n:'Peau de Pierre', t:'peaupierre',pow:0, mp:18, prob:.09, col:'#8d6e63', pc:'#d7ccc8', desc:'Peau dure comme la pierre - toute léquipe résiste bien mieux aux chocs.'},
  {id:'divine',  n:'Puissance Divine', t:'divine',   pow:0,  mp:40, prob:.05, col:'#ffd700', pc:'#fffde7', desc:'Grâce divine - un coéquipier est transcendé : vitesse, tir, tout booste au max.'},
  {id:'aura_divine', n:'Aura Divine', t:'aura_divine', pow:0, mp:0, prob:0, col:'#ffe066', pc:'#fffde7', desc:'Se déclenche automatiquement à la mi-temps ET aux prolongations : +12 sht/spd/def/tec pour toute la période.'},
  {id:'aide_divine', n:'Aide Divine',  t:'aide_divine',  pow:0, mp:25, prob:.08, col:'#ffd700', pc:'#fff8e1', desc:'Self-buff : +5 dans 2 stats aléatoires jusqu\'à la fin de la mi-temps en cours.'},
  {id:'cailloux',   n:'Cailloux dans la chaussure', t:'cailloux', pow:0, mp:5,  prob:.06, col:'#8d6e63', pc:'#efebe9', desc:'Ne fait absolument rien. Juste pour la vanne.'},
  {id:'simulation', n:'Simulation',   t:'simulation', pow:0, mp:20, prob:.07, col:'#ff7043', pc:'#fbe9e7', desc:'Chute théâtrale : 25% coup franc, 10% pénalty si dans la surface.'},
  {id:'plaisir', n:'Plaisir & Beauté', t:'plaisir',  pow:0,  mp:22, prob:.08, col:'#f48fb1', pc:'#fce4ec', desc:'Beauté époustouflante - un défenseur adverse est subjugué, léquipe récupère.'},
  {id:'sylvestre',n:'Marche Sylvestre',t:'sylvestre',pow:0,  mp:20, prob:.09, col:'#43a047', pc:'#e8f5e9', desc:'La forêt prête ses forces - toute léquipe court comme si elle volait 12 secondes.'},
  {id:'fleurs',  n:'Parterre de Fleurs',t:'fleurs',  pow:0,  mp:26, prob:.07, col:'#ab47bc', pc:'#f3e5f5', desc:'Fleurs magiques dans la zone adverse - jolies mais redoutables, personne navance vite.'},
  {id:'sixsens', n:'Sixième Sens',     t:'sixsens',  pow:0,  mp:18, prob:.09, col:'#00acc1', pc:'#e0f7fa', desc:'Sixième sens - le gardien et les défenseurs voient chaque tir venir à lavance.'},
  {id:'aile',    n:'Ailes',            t:'aile',     pow:0,  mp:32, prob:.06, col:'#29b6f6', pc:'#e1f5fe', desc:'Ailes de lumière - un attaquant file vers le but à une vitesse que personne ne suit.'},
  {id:'esprit',  n:'Esprit-Oiseau',    t:'esprit',   pow:0,  mp:28, prob:.07, col:'#66bb6a', pc:'#e8f5e9', desc:'Lesprit de loiseau libre - toute léquipe devient insaisissable 8 secondes.'},
  // Kraland malédictions
  {id:'epuise',  n:'Épuisement',       t:'epuise',   pow:0,  mp:20, prob:.09, col:'#546e7a', pc:'#cfd8dc', desc:'Drain dénergie - les adversaires saffaiblissent, le lanceur se régénère.'},
  {id:'maledic', n:'Malédiction',      t:'maledic',  pow:0,  mp:26, prob:.07, col:'#4a148c', pc:'#e1bee7', desc:'Malédiction ancienne - un adversaire est ralenti et affaibli pour toute laction.'},
  {id:'chance',  n:'Chance',           t:'chance',   pow:0,  mp:16, prob:.10, col:'#f9a825', pc:'#fff9c4', desc:'Coup de dé - une petite frappe tentée au hasard vers le but adverse. Faible, mais qui sait…'},
  {id:'hoquet',  n:'Hoquet',           t:'hoquet',   pow:0,  mp:14, prob:.11, col:'#a5d6a7', pc:'#e8f5e9', desc:'Hic ! Un adversaire a le hoquet - son prochain tir part complètement à côté.'},
  // ── Nouveaux sorts ───────────────────────────────────────────────
  {id:'spindash', n:'Spin Dash',            t:'spindash', pow:35, mp:22, prob:.10, col:'#2979ff', pc:'#82b1ff', desc:'Vrille fulgurante a travers la defense. Traverse tous les defenseurs et tire en sortie de roulade.'},
  {id:'dragon',   n:'Dragon',               t:'dragon',   pow:0,  mp:45, prob:.05, col:'#e02030', pc:'#ff6060', desc:'Le joueur se transforme en dragon 15 secondes. Stats doublees, tirs enflammes, aura devastatrice.'},
  {id:'tacle_mauvais',  n:'Tacle Malveillant',  t:'tacle_mauvais', pow:0, mp:15, prob:.08, col:'#e64a19', pc:'#fbe9e7', desc:'Tacle brutal : forte chance de blesser l\'adversaire, carton jaune automatique pour le lanceur.'},
  {id:'tacle_malefique',n:'Tacle Maléfique',    t:'tacle_mauvais', pow:0, mp:28, prob:.06, col:'#bf360c', pc:'#fbe9e7', desc:'Version supérieure : blessure grave garantie, adversaire hors match.'},
  {id:'atk_demo',       n:'Attaque Démoniaque', t:'atk_demo',      pow:55, mp:40, prob:.05, col:'#b71c1c', pc:'#ffebee', desc:'Frappe dévastatrice. Ignore en partie la défense, particules infernales.'},
  {id:'subtilisation',  n:'Subtilisation',      t:'subtilisation', pow:0, mp:18, prob:.09, col:'#00897b', pc:'#e0f2f1', desc:'Vole instantanément le ballon au porteur adverse.'},
  {id:'vol',            n:'Vol',                t:'subtilisation', pow:0, mp:30, prob:.06, col:'#004d40', pc:'#e0f2f1', desc:'Version supérieure : vol + stun prolongé + téléportation quasi instantanée.'},
  {id:'main',           n:'Main',               t:'main',          pow:0, mp:10, prob:.10, col:'#7b1fa2', pc:'#f3e5f5', desc:'Frappe de la main. 85% d\'être sifflé — penalty ou coup franc adverse.'},
  {id:'main_discrete',  n:'Main Discrète',      t:'main',          pow:0, mp:22, prob:.07, col:'#4a148c', pc:'#f3e5f5', desc:'Version subtile : seulement 40% de chances d\'être sifflé.'},
  {id:'comedia',        n:'Comédia del Arte',   t:'simulation',    pow:0, mp:35, prob:.05, col:'#e64a19', pc:'#fbe9e7', desc:'Version supérieure de Simulation : 50% coup franc, 25% pénalty si dans la surface. L\'arbitre y croit toujours.'},
  // ── Versions améliorées ──────────────────────────────────────────────
  {id:'blizzard',       n:'Blizzard',           t:'ice',           pow:38, mp:32, prob:.07, col:'#0288d1', pc:'#e1f5fe', desc:'Version améliorée de Frappe Glacée : tir bien plus puissant qui gèle la surface de réparation entière.'},
  {id:'seisme',         n:'Séisme',             t:'cyclon',        pow:50, mp:38, prob:.06, col:'#795548', pc:'#efebe9', desc:'Version supérieure du Cyclone : tremblement de terre qui renverse tous les défenseurs et ouvre une brèche béante.'},
  {id:'domination',     n:'Domination Mentale', t:'pacif',         pow:0,  mp:36, prob:.05, col:'#6a1b9a', pc:'#f3e5f5', desc:'Version supérieure de Pacification : contrôle total d\'un adversaire qui joue pour ton équipe pendant 8 secondes.'},
  {id:'stase',          n:'Stase',              t:'terreur',       pow:0,  mp:32, prob:.06, col:'#37474f', pc:'#eceff1', desc:'Version supérieure de Terreur : fige toute l\'équipe adverse dans le temps pendant 4 secondes. Personne ne bouge.'},
  {id:'maledic2',       n:'Grande Malédiction', t:'maledic',       pow:0,  mp:38, prob:.05, col:'#1a0033', pc:'#e1bee7', desc:'Version supérieure de Malédiction : toute l\'équipe adverse est affaiblie et ralentie pour l\'action en cours.'},
  {id:'epuise2',        n:'Drain Total',        t:'epuise',        pow:0,  mp:34, prob:.06, col:'#263238', pc:'#cfd8dc', desc:'Version supérieure d\'Épuisement : vide complètement les HP et MP de tous les adversaires proches.'},
  {id:'trebuchement',   n:'Trébuchement',       t:'hoquet',        pow:0,  mp:14, prob:.10, col:'#a5d6a7', pc:'#e8f5e9', desc:'L\'adversaire trébuche sur rien et perd le ballon. Mystérieux mais efficace.'},
  {id:'caillou_oeil',   n:'Caillou dans l\'Oeil',t:'cailloux',     pow:0,  mp:16, prob:.09, col:'#8d6e63', pc:'#efebe9', desc:'Un caillou magique aveugle brièvement un adversaire — il perd sa cible 2 secondes.'},
  {id:'lien_chamanique', n:'Lien Chamanique',    t:'soin',          pow:0,  mp:28, prob:.07, col:'#ff6f00', pc:'#fff3e0', desc:'Lien spirituel entre deux coéquipiers — leur endurance est entièrement restaurée.'},
  {id:'puissance_divine',n:'Puissance Divine',   t:'divine',        pow:0,  mp:35, prob:.06, col:'#ffd54f', pc:'#fffde7', desc:'Le joueur canalise la grâce divine — ses stats sont massivement boostées pendant une courte durée.'},
  {id:'invoc_aleatoire', n:'Invocation Aléatoire',t:'chance',       pow:0,  mp:30, prob:.06, col:'#ab47bc', pc:'#f3e5f5', desc:'Pioche et déclenche un sort avancé au hasard parmi toutes les vocations.'},
  {id:'contresort',     n:'Contresort',          t:'shield',        pow:0,  mp:20, prob:.09, col:'#5c6bc0', pc:'#e8eaf6', desc:'Annule le prochain sort adverse avant qu\'il ne prenne effet.'},
  {id:'bannissement',   n:'Bannissement',         t:'terreur',       pow:0,  mp:38, prob:.05, col:'#4a148c', pc:'#f3e5f5', desc:'Exile temporairement un adversaire hors du terrain pendant 10 secondes.'},
  {id:'carapace',       n:'Carapace',             t:'shield',        pow:0,  mp:18, prob:.10, col:'#78909c', pc:'#eceff1', desc:'Enveloppe le joueur d\'une armure temporaire — réduit massivement les dégâts reçus.'},
  {id:'forme_bestiale', n:'Forme Bestiale',        t:'spindash',      pow:0,  mp:40, prob:.05, col:'#bf360c', pc:'#fbe9e7', desc:'Le joueur se transforme en bête — vitesse et force décuplées pendant 8 secondes.'},
  {id:'champ_force',    n:'Champ de Force',        t:'shield',        pow:0,  mp:22, prob:.08, col:'#0288d1', pc:'#e1f5fe', desc:'Zone de ralentissement autour du lanceur — les adversaires proches sont freinés.'},
  {id:'desintegration', n:'Désintégration',        t:'maledic',       pow:0,  mp:42, prob:.04, col:'#37474f', pc:'#eceff1', desc:'Réduit temporairement toutes les stats d\'un adversaire à zéro pendant 6 secondes.'},
  {id:'drain_vital',    n:'Drain Vital',           t:'epuise',        pow:0,  mp:24, prob:.08, col:'#880e4f', pc:'#fce4ec', desc:'Aspire la vie d\'un adversaire pour se soigner soi-même.'},
  {id:'resurrection',   n:'Résurrection',          t:'soin',          pow:0,  mp:45, prob:.04, col:'#f9a825', pc:'#fffde7', desc:'Ramène un coéquipier KO sur le terrain avec 50% de ses HP.'},
  {id:'telekinesie_abs', n:'Télékinésie Absolue',  t:'telekib',       pow:60, mp:45, prob:.05, col:'#00838f', pc:'#e0f7fa', desc:'Tir télékinétique à puissance maximale. La défense du gardien est réduite à 40%. Difficile à arrêter.'},
  {id:'vandalisme',      n:'Vandalisme de Terrain', t:'fleurs',        pow:0,  mp:22, prob:.08, col:'#558b2f', pc:'#f1f8e9', desc:'Détruit une portion du terrain : la zone devient impraticable, les défenseurs dans la zone sont stun et ne peuvent plus se repositionner.'},
  {id:'hack',            n:'Hack',                  t:'suggest',       pow:0,  mp:28, prob:.07, col:'#0288d1', pc:'#e1f5fe', desc:'Pirate les stats d\'un adversaire et les redirige vers un allié pendant 8 secondes.'},
  {id:'maztikal_rush',   n:'Maztikal Rush',         t:'spindash',      pow:0,  mp:32, prob:.07, col:'#ff6a00', pc:'#fbe9e7', desc:'Toute l\'équipe sprint vers le but à vitesse maximale pendant 6 secondes. Défense réduite à zéro.'},
  {id:'maztikal_girlz',  n:'Transformation Maztikal Girlz', t:'spindash', pow:0, mp:0, prob:0, col:'#ff00ff', pc:'#fce4ec', desc:'Transformation automatique en prolongation : boost massif vitesse, attaque et technique.'},
  {id:'dragon',          n:'Transformation Dragon',        t:'fire',      pow:0, mp:0, prob:0, col:'#ff4500', pc:'#fff3e0', desc:'Sort légendaire de Tear : toutes les stats doublées 15s, tir de feu automatique à chaque possession.'},
  {id:'boing_boing',     n:'Boing Boing',                   t:'charm',     pow:0, mp:0, prob:.03, col:'#ff69b4', pc:'#fce4ec', desc:'Sort légendaire de Ruby/Saphyr : l\'équipe adverse, déconcentrée, marque un autobut garanti.'},
  {id:'manif_ecolo',     n:'Manifestation Écolo',           t:'pacif',     pow:0,  mp:32, prob:.06, col:'#2e7d32', pc:'#e8f5e9', desc:'Des supporters envahissent le terrain. Match interrompu 15-20s. Le chrono tourne. Idéal pour gâcher le temps.'},
  {id:'piege_elec',     n:'Piège Électrique',              t:'telekib',   pow:0,  mp:18, prob:.09, col:'#ffd600', pc:'#fffde7', desc:'Piège électrique stun + vol de balle sur le premier adversaire qui marche dessus.'},
  {id:'flamme_noire',   n:'Flamme Noire',                  t:'fire',      pow:0,  mp:20, prob:.09, col:'#4a148c', pc:'#f3e5f5', desc:'Flamme sombre : ralentissement fort sur tous les défenseurs dans la zone.'},
  {id:'explosion_sort', n:'The Explosion',                  t:'tirspe',    pow:55, mp:35, prob:.06, col:'#d32f2f', pc:'#ffebee', desc:'Tir explosif dévastateur. Gardien sonné même s\'il arrête.'},
  {id:'lance_tenebres', n:'Lance des Ténèbres',             t:'tirspe',    pow:45, mp:30, prob:.07, col:'#311b92', pc:'#ede7f6', desc:'Aura sombre en forme de lance qui plonge vers le but depuis les airs.'},
  {id:'attentat',       n:'Attentat',                       t:'tirspe',    pow:70, mp:0,  prob:0,   col:'#b71c1c', pc:'#ffebee', desc:'Légendaire Cheik Evara : canons d\'énergie surgissent du sol et fusent vers le but.'},
  {id:'coup_bas',       n:'Coup Bas',                      t:'telekib',   pow:0,  mp:22, prob:.07, col:'#8d6e63', pc:'#efebe9', desc:'Feinte et frappe sournoise. Vol de balle garanti + stun 10 secondes.'},
  {id:'haramball',      n:'Haramball',                     t:'defend',    pow:0,  mp:0,  prob:0,   col:'#c8a400', pc:'#fff8e1', desc:'Sort légendaire du Sultan : +15 Défense à toute l\'équipe pendant 15 secondes.'},
  {id:'gaia',            n:'Frappe Universelle',            t:'seisme',    pow:65, mp:50, prob:.05, col:'#33691e', pc:'#f1f8e9', desc:'La terre propulse le ballon. Puissance 70, défense gardien à 30%, stun tous les défenseurs.'},
  {id:'tir_pegase',      n:'Tir Pégase',                   t:'tirspe',    pow:35, mp:20, prob:.09, col:'#87ceeb', pc:'#e3f2fd', desc:'Saut retourné, énergie concentrée dans le pied, un pégase accompagne le ballon vers le but.'},
  {id:'ballon_angelique',n:'Ballon Angélique',              t:'defend',    pow:0,  mp:10, prob:.09, col:'#fffde7', pc:'#fff9c4', desc:'Ballon envoyé en l\'air avec auréole et ailes, tourne autour de l\'adversaire et le contourne. Sort défensif.'},
  {id:'monte_celeste',   n:'Monté Céleste',                 t:'pacif',     pow:0,  mp:9, prob:.09, col:'#e1f5fe', pc:'#b3e5fc', desc:'Colonne de lumière, le joueur monte au ciel et renvoie la balle à son utilisateur.'},
  {id:'tir_licorne',     n:'Tir de la Licorne',             t:'tirspe',    pow:50, mp:35, prob:.07, col:'#9c27b0', pc:'#f3e5f5', desc:'Deux joueurs sautent et frappent simultanément. Licorne violette fonce vers le but.'},
  {id:'tri_pegase',      n:'Tri-Pégase',                    t:'tirspe',    pow:60, mp:45, prob:.05, col:'#1565c0', pc:'#e3f2fd', desc:'Trois joueurs croisent leurs trajectoires, frappent à tour de rôle, pégase bleu accompagne le ballon.'},
  {id:'tir_celeste',     n:'Tir Céleste / Éclat Divin',     t:'tirspe',    pow:50, mp:0,  prob:0,   col:'#ffd700', pc:'#fff8e1', desc:'Légendaire : nuages invoqués, escalier d\'or, le ballon descend en flèche. Tous les joueurs aveuglés.'},
  {id:'voeux',           n:'Vœux',                          t:'charm',     pow:0,  mp:15, prob:.09, col:'#ce93d8', pc:'#f3e5f5', desc:'Exauce un vœu mystique : effet aléatoire bénéfique sur l\'équipe alliée.'},
  {id:'vision',          n:'Vision',                        t:'suggest',   pow:0,  mp:18, prob:.09, col:'#b39ddb', pc:'#ede7f6', desc:'Prémonition du prochain tir adverse : +30% chance d\'arrêt du gardien pendant 15s.'},
  {id:'eclipse',         n:'Éclipse',                       t:'pacif',     pow:0,  mp:20, prob:.08, col:'#37474f', pc:'#eceff1', desc:'Obscurcit le terrain, tous les adversaires sont désorientés 8-12s.'},
  {id:'prophetie',       n:'Prophétie',                     t:'suggest',   pow:0,  mp:30, prob:.06, col:'#7e57c2', pc:'#ede7f6', desc:'Annule le prochain sort adverse. Le lanceur reçoit une vision de la prochaine action adverse.'},
  // ── PALLADIUM CORPORATION ──────────────────────────────────
  {id:'souffle_dragon',  n:'Souffle du Dragon',  t:'react',   pow:0,  mp:60, prob:0,   col:'#ff6600', pc:'#fff3e0', desc:'Légendaire Aurelthar : quand un adversaire lance un sort de tir, 25% de chance de réduire sa puissance de moitié.'},
  {id:'produits_dopants',n:'Produits Dopants',   t:'support', pow:0,  mp:35, prob:.04,  col:'#00e5ff', pc:'#e0f7fa', desc:'Combo PC : stats aléatoires boostées pendant 10s, mais l\'endurance chute sévèrement.'},
  {id:'corruption',      n:'Corruption',         t:'support', pow:0,  mp:50, prob:.01,  col:'#7b1fa2', pc:'#f3e5f5', desc:'Avancé PC : le porteur adverse effectue involontairement une passe vers un membre de la PC.'},
  // ── SIBÉRIA ─────────────────────────────────────────────
  {id:'main_celeste',    n:'Main Céleste',        t:'react',   pow:0,  mp:15, prob:0,   col:'#87ceeb', pc:'#e3f2fd', desc:'Base Mystique Sibéria : 50% de chance de réduire de 10% la puissance d\'un sort de tir adverse.'},
  {id:'invoc_celeste',   n:'Invocation Céleste',             t:'charm',     pow:0,  mp:40, prob:.05, col:'#4a148c', pc:'#f3e5f5', desc:'Convoque un joueur fantôme allié pendant 10s. Joue comme un ATT supplémentaire.'},
  // ── PACIFISTAS ──────────────────────────────────────────────
  {id:'laser_oculaire',  n:'Laser Oculaire',      t:'tirspe',  pow:40, mp:30, prob:.07, col:'#00e5ff', pc:'#e0f7fa', desc:'Légendaire Pigeon Ronronldo : si le lanceur a le ballon, tir laser puissance 40 ; sinon, faisceau qui tacle et stun l\'adversaire le plus proche.'},
  // ── THÉOCRATIE SEELIENNE ──────────────────────────────────
  {id:'serre',           n:'Serre',                          t:'serre',     pow:22, mp:16, prob:.10, col:'#ffd700', pc:'#fff8e1', desc:'Le tireur utilise ses serres pour gripper le ballon et le propulser. Tir tranchant mais peu puissant — très difficile à lire pour le gardien.'},
  {id:'concert_lumiere', n:'Concert de Lumière',             t:'concert_lumiere', pow:0, mp:0, prob:0, col:'#ffe066', pc:'#fffde7', desc:'Automatique a chaque periode : toutes les 15s, un allie au hasard gagne +5 a +20 dans une stat pendant 10s. Puise fortement dans lendurance du porteur.'},
  // ── FIKRA — Sorts manquants ────────────────────────────────
  {id:'chaos',        n:'Chaos',               t:'chaos',        pow:0, mp:20, prob:.08, col:'#7c4dff', pc:'#ede7f6', desc:'Effet imprévisible — selon lhumeur du hasard, déstabilise un adversaire ou transcende un allié.'},
  {id:'theatre',      n:'Coup de Théâtre',     t:'theatre',      pow:0, mp:24, prob:.07, col:'#ff4081', pc:'#fce4ec', desc:'Rebondissement spectaculaire — une faute est toujours sifflée, et ladversaire le plus proche en reste bouche bée.'},
  {id:'tactique',     n:'Désordre Tactique',   t:'tactique',     pow:0, mp:30, prob:.06, col:'#5d4037', pc:'#efebe9', desc:'Brouille les repères de toute léquipe adverse — plus personne ne sait où se placer.'},
  {id:'intimid',      n:'Intimidation',        t:'intimid',      pow:0, mp:16, prob:.09, col:'#3e2723', pc:'#d7ccc8', desc:'Un regard noir suffit — un défenseur adverse recule, impressionné.'},
  {id:'pierre_sacree',n:'Pierre Sacrée',       t:'pierre_sacree',pow:0, mp:26, prob:.07, col:'#fbc02d', pc:'#fff9c4', desc:'Bénédiction minérale — le lanceur et son équipe sont revigorés et protégés.'},
  {id:'reveil_nature',n:'Réveil de la Nature', t:'sylvestre',    pow:0, mp:34, prob:.06, col:'#2e7d32', pc:'#e8f5e9', desc:'Version supérieure de Marche Sylvestre — toute la forêt sanime pour porter léquipe.'},
  {id:'rot_cosmique', n:'Rot Cosmique',        t:'hoquet',       pow:0, mp:18, prob:.08, col:'#9ccc65', pc:'#f1f8e9', desc:'Un rot venu dun autre univers déstabilise deux adversaires dun coup.'},
];

// Spell classification — defined once at module scope
const SUPPORT_SPELLS=new Set(['produits_dopants','corruption','heal','soin','amitie','shield','tornado','pass','transe','invis','peaupierre','chance','divine','plaisir','sylvestre','aile','esprit','sixsens','dragon','aura_divine','aide_divine','cailloux','simulation','comedia','subtilisation','vol','stase','domination','maledic2','epuise2','trebuchement','caillou_oeil','lien_chamanique','puissance_divine','invoc_aleatoire','vandalisme','hack','maztikal_rush','maztikal_girlz','contresort','bannissement','carapace','forme_bestiale','champ_force','drain_vital','resurrection','boing_boing','manif_ecolo','piege_elec','flamme_noire','coup_bas','haramball','ballon_angelique','monte_celeste','voeux','vision','eclipse','prophetie','invoc_celeste','concert_lumiere','chaos','theatre','pierre_sacree','reveil_nature']);
const ATTACK_SPELLS=new Set(['desintegration','telekinesie_abs','gaia','tir_pegase','tir_licorne','tri_pegase','tir_celeste','explosion_sort','lance_tenebres','attentat','fire','fireball','ice','thunder','eldritch','illusion','mouton','suggest','charm','ice2','pacif','tech','cyclon','telekib','deluge','terreur','epuise','maledic','hoquet','folie','fleurs','spindash','tacle_mauvais','tacle_malefique','atk_demo','main','main_discrete','blizzard','seisme','serre','chaos','tactique','intimid','rot_cosmique','laser_oculaire']);

const STRATS=[
  // atk/def: combat multipliers for shots/duels
  // press: where the defensive line sits (0=deep block, 1=high pressing)
  // width: lateral spread of the block (0.7=narrow/compact, 1.3=wide)
  // attDepth: how far forward attackers push when off the ball (-2 to +6 meters)
  // midPush: how aggressively mids support the attack
  // runFreq: how often off-the-ball runs trigger (multiplier)
  {id:'321',  n:'3-2-1',          d:'Équilibré — le standard',       atk:1.00,def:1.00, press:.50, width:1.00, attDepth:0,  midPush:1.00, runFreq:1.00, col:'#1878e8'},
  {id:'231',  n:'2-3-1',          d:'Possession, milieu renforcé',   atk:1.12,def:.92,  press:.72, width:1.12, attDepth:2,  midPush:1.30, runFreq:1.25, col:'#f0c028'},
  {id:'1212', n:'2-1-2-1',        d:'Technique, losange au milieu',  atk:1.10,def:.98,  press:.62, width:.90,  attDepth:1,  midPush:1.20, runFreq:1.15, col:'#8840e0'},
  {id:'312',  n:'3-1-2',          d:'Direct, bloc + 2 pointes',      atk:1.15,def:1.05, press:.45, width:.90,  attDepth:2,  midPush:.95,  runFreq:1.25, col:'#00bcd4'},
  {id:'123',  n:'1-2-3',          d:'Tout pour l\'attaque',          atk:1.42,def:.60,  press:.95, width:1.28, attDepth:6,  midPush:1.55, runFreq:1.75, col:'#e91e63'},
  {id:'411',  n:'4-1-1',          d:'Bloc bas défensif',             atk:.82, def:1.28,  press:.24, width:.85,  attDepth:-2, midPush:.65,  runFreq:.75, col:'#607d8b'},
  {id:'402',  n:'4-0-2',          d:'Contre — 4 déf, 2 pointes',     atk:.95, def:1.22,  press:.20, width:.82,  attDepth:2,  midPush:.70,  runFreq:1.10, col:'#455a64'},
  {id:'51',   n:'5-1',            d:'Ultra défensif — bus devant le but', atk:.65,def:1.50, press:.12, width:.95, attDepth:-4, midPush:.40, runFreq:.50, col:'#18c860'},
  {id:'141',  n:'1-4-1',          d:'Domination du milieu',          atk:1.14,def:.90,  press:.78, width:1.15, attDepth:2,  midPush:1.40, runFreq:1.30, col:'#ff9800'},
  {id:'33',   n:'3-3',            d:'Pressing total — 3 déf, 3 devant', atk:1.22,def:.88, press:.92, width:1.22, attDepth:4,  midPush:1.45, runFreq:1.55, col:'#ff6d00'},
  {id:'24',   n:'2-4',            d:'Désespérée — 2 déf, 4 attaquants', atk:1.48,def:.55, press:.98, width:1.30, attDepth:7,  midPush:1.60, runFreq:1.85, col:'#d500f9'},
  {id:'600',  n:'6-0-0',          d:'Défendre à tout prix',          atk:.40, def:1.70,  press:.08, width:1.00, attDepth:-6, midPush:.25,  runFreq:.35, col:'#37474f'},
  // Formations conservées (compat parties existantes) + variantes
  {id:'222',  n:'2-2-2',          d:'Équilibré compact, deux lignes de 2', atk:1.02,def:1.05, press:.55, width:.95, attDepth:0, midPush:1.05, runFreq:1.05, col:'#26a69a'},
  {id:'133',  n:'1-3-3',          d:'Milieu bas — 3 déf, 3 relayeurs', atk:.85, def:1.25, press:.30, width:.90, attDepth:0, midPush:.80, runFreq:.85, col:'#5c6bc0'},
  {id:'1332', n:'1-3-3 Offensif', d:'3 déf, 3 milieux hauts très projetés', atk:1.20,def:.95, press:.85, width:1.18, attDepth:4, midPush:1.45, runFreq:1.50, col:'#ab47bc'},
];

// formations: [pct_forward, pct_side] — 0=own goal, 1=opp goal
// Ne servent plus qu'en DERNIER RECOURS (fallback) si un joueur n'a pas de
// poste valide — voir POS_COORDS ci-dessous, qui pilote désormais le
// placement RÉEL de chaque joueur selon SON PROPRE poste individuel, quelle
// que soit la stratégie choisie (321/231/222/133 = juste des "bases").
const FORMS={
  '321': [[.08,.50],[.26,.20],[.26,.50],[.26,.80],[.52,.33],[.52,.67],[.76,.50]],
  '231': [[.08,.50],[.26,.30],[.26,.70],[.48,.22],[.48,.50],[.48,.78],[.76,.50]],
  // 2-1-2-1 losange : 2 déf, 1 sentinelle, 2 relayeurs, 1 pointe
  '1212':[[.08,.50],[.24,.32],[.24,.68],[.42,.50],[.60,.30],[.60,.70],[.80,.50]],
  // 3-1-2 : 3 déf, 1 sentinelle, 2 pointes
  '312': [[.08,.50],[.25,.22],[.25,.50],[.25,.78],[.46,.50],[.72,.34],[.72,.66]],
  // 1-2-3 : 1 déf, 2 milieux, 3 attaquants
  '123': [[.08,.50],[.26,.50],[.46,.32],[.46,.68],[.72,.20],[.72,.50],[.72,.80]],
  // 4-1-1 : 4 déf, 1 milieu, 1 pointe
  '411': [[.08,.50],[.24,.16],[.24,.39],[.24,.61],[.24,.84],[.50,.50],[.76,.50]],
  // 4-0-2 : 4 déf, 0 milieu, 2 pointes
  '402': [[.08,.50],[.24,.16],[.24,.39],[.24,.61],[.24,.84],[.72,.34],[.72,.66]],
  // 5-1 : 5 déf, 1 pointe (bus)
  '51':  [[.08,.50],[.22,.12],[.22,.31],[.22,.50],[.22,.69],[.22,.88],[.74,.50]],
  // 1-4-1 : 1 déf, 4 milieux, 1 pointe (domination du milieu)
  '141': [[.08,.50],[.26,.50],[.50,.16],[.50,.39],[.50,.61],[.50,.84],[.78,.50]],
  // 3-3 : 3 déf, 3 devant (2 ailiers + 1 att) — pressing total
  '33':  [[.08,.50],[.26,.22],[.26,.50],[.26,.78],[.68,.22],[.68,.78],[.72,.50]],
  // 2-4 : 2 déf, 4 attaquants — désespérée
  '24':  [[.08,.50],[.26,.34],[.26,.66],[.62,.16],[.62,.39],[.62,.61],[.62,.84]],
  // 6-0-0 : 6 défenseurs — défendre à tout prix
  '600': [[.08,.50],[.22,.10],[.22,.28],[.22,.44],[.22,.56],[.22,.72],[.22,.90]],
  // Conservées
  '222': [[.14,.50],[.27,.35],[.27,.65],[.50,.28],[.50,.72],[.72,.28],[.72,.72]],
  '133': [[.10,.50],[.28,.20],[.28,.50],[.28,.80],[.48,.30],[.48,.70],[.65,.50]],
  '1332':[[.08,.50],[.26,.22],[.26,.50],[.26,.78],[.58,.26],[.58,.50],[.58,.74]],
};
// Coordonnées de base PAR POSTE INDIVIDUEL (indépendantes de la formation) :
// [profondeur 0..1 (0=but propre, 1=but adverse), côté 0..1 (0=gauche,1=droite)]
// C'est la fiche joueur ("Poste" dans l'éditeur) qui détermine où le joueur
// se tient sur le terrain — modifier le poste d'UN joueur a maintenant un
// effet réel et direct, au lieu d'être écrasé par la stratégie d'équipe.
const POS_COORDS={
  GB:  [.08,.50],
  DC:  [.24,.50],
  DD:  [.24,.82],
  DG:  [.24,.18],
  MDC: [.42,.50],
  MC:  [.50,.50],
  MOG: [.60,.20],
  MOD: [.60,.80],
  MO:  [.60,.50],
  AG:  [.72,.16],
  AD:  [.72,.84],
  ATT: [.78,.50],
};
// ── Utilitaires image & stockage ────────────────────────────────────────────
// Redimensionne/compresse une image uploadée (logo ou photo joueur) avant de
// la convertir en base64, pour éviter de saturer le quota de localStorage
// (~5-10 Mo) quand il y a beaucoup de logos/photos (surtout dans le pool PNJ).
function _compressImage(file,maxDim,quality,cb){
  const reader=new FileReader();
  reader.onload=e=>{ _compressDataUrl(e.target.result,maxDim,quality,cb,()=>cb(e.target.result)); };
  reader.onerror=()=>{};
  reader.readAsDataURL(file);
}
// Recompresse une dataURL (ou URL d'image) déjà en mémoire — utile pour les
// équipes importées depuis un JSON dont les images peuvent être énormes.
function _compressDataUrl(dataUrl,maxDim,quality,cb,onFail){
  if(!dataUrl||typeof dataUrl!=='string'||!dataUrl.startsWith('data:image')){cb(dataUrl||'');return;}
  const img=new Image();
  img.onload=()=>{
    let w=img.width,h=img.height;
    if(w>h){ if(w>maxDim){h=Math.round(h*maxDim/w);w=maxDim;} }
    else { if(h>maxDim){w=Math.round(w*maxDim/h);h=maxDim;} }
    try{
      const canvas=document.createElement('canvas');
      canvas.width=w;canvas.height=h;
      const c2=canvas.getContext('2d');
      c2.drawImage(img,0,0,w,h);
      cb(canvas.toDataURL('image/jpeg',quality));
    }catch(err){ (onFail||(()=>cb(dataUrl)))(); }
  };
  img.onerror=()=>{ (onFail||(()=>cb(dataUrl)))(); };
  img.src=dataUrl;
}
// Compresse (de façon synchrone-optimiste) toutes les images d'une équipe
// importée. Comme la compression via <canvas> est asynchrone, on lance les
// compressions en parallèle et on appelle `done` quand tout est terminé.
function _compressTeamImages(team,done){
  const jobs=[];
  const queue=(obj,maxDim)=>{
    if(obj&&typeof obj.img==='string'&&obj.img.startsWith('data:image')){
      jobs.push(new Promise(res=>{_compressDataUrl(obj.img,maxDim,0.72,u=>{obj.img=u;res();},()=>{obj.img='';res();});}));
    }
  };
  queue(team,160);
  [...(team.players||[]),...(team.bench||[]),...(team.reserves||[])].forEach(p=>queue(p,120));
  if(!jobs.length){done();return;}
  Promise.all(jobs).then(done).catch(done);
}
// Sauvegarde sécurisée dans localStorage : avertit visiblement l'utilisateur
// (au lieu d'un simple warning console silencieux) si le quota est dépassé.
function _safeLSSet(key,valueObj){
  try{
    localStorage.setItem(key,JSON.stringify(valueObj));
    return true;
  }catch(e){
    if(e&&(e.name==='QuotaExceededError'||e.code===22||e.code===1014)){
      logEvent('⚠️ Stockage plein : sauvegarde impossible. Supprimez quelques photos/logos ou équipes PNJ pour libérer de la place.','#e02030');
    }else{
      console.warn('LocalStorage save failed',e);
    }
    return false;
  }
}
function teamIni(name){
  name=String(name||'?').trim();
  const stop=['le','la','les','de','du','des','l','d','fc','sc','as','club','olympique','union'];
  const words=name.split(/\s+/).filter(w=>w&&!stop.includes(w.toLowerCase()));
  if(words.length>=2) return (words[0][0]+words[1][0]).toUpperCase();
  if(words.length===1) return words[0].slice(0,2).toUpperCase();
  return name.slice(0,2).toUpperCase()||'??';
}
const ROLE=['GB','DC','DD','DG','MC','MC','ATT'];
// Postes assignés par formation (7 joueurs, index 0-6)
const FORM_ROLES={
  '321': ['GB','DC','DD','DG','MC','MC','ATT'],
  '231': ['GB','DD','DG','MC','MC','MO','ATT'],
  '1212':['GB','DD','DG','MDC','MC','MC','ATT'],        // losange
  '312': ['GB','DG','DC','DD','MDC','ATT','ATT'],
  '123': ['GB','DC','MC','MC','AG','ATT','AD'],
  '411': ['GB','DG','DC','DC','DD','MC','ATT'],
  '402': ['GB','DG','DC','DC','DD','ATT','ATT'],
  '51':  ['GB','DG','DC','DC','DC','DD','ATT'],
  '141': ['GB','DC','MOG','MC','MC','MOD','ATT'],
  '33':  ['GB','DC','DD','DG','AG','AD','ATT'],
  '24':  ['GB','DG','DD','AG','ATT','ATT','AD'],
  '600': ['GB','DG','DC','DC','DC','DC','DD'],
  '222': ['GB','DC','DC','MOG','MOD','ATT','ATT'],
  '133': ['GB','DC','DD','DG','MDC','MDC','MO'],
  '1332':['GB','DC','DD','DG','MOG','MO','MOD'],
};

function mkPlayers(ti){
  const na=ti===0
    ?['Renard','Moreau','Leblanc','Dupuis','Garnier','Martin','Gauthier']
    :['Velasquez','Romero','Castro','Medina','Herrera','Suarez','Delgado'];
  const pools=[
    ['fire','eldritch'],['shield','ice'],['thunder','tornado'],
    ['ice','soin'],['thunder','tech'],['tech','fireball'],['amitie','pass'],
    ['cyclon','transe'],['telekib','invis'],['deluge','peaupierre'],
    ['terreur','maledic'],['epuise','chance'],['hoquet','suggest'],
    ['cyclon','eldritch']
  ];
  return na.map((name,i)=>({
    id:`t${ti}p${i}`,name,pos:ROLE[i],img:'',ini:name.slice(0,2).toUpperCase(),
    s:{spd:42+~~(Math.random()*52),sht:38+~~(Math.random()*58),def:38+~~(Math.random()*58),stam:55+~~(Math.random()*40),tec:42+~~(Math.random()*52),res:35+~~(Math.random()*60)},
    spells:pools[i]||['tech'],
    x:0,y:0,vx:0,vy:0,tx:0,ty:0,
    hp:100,mp:100,yc:0,red:false,stunT:0,hasBall:false,
    injLevel:0,injT:0,  // 0=sain 1=légère 2=sérieuse 3=grave
    mG:0,mSh:0,mTk:0,mSp:0,_img:null,
    _spdDebuff:0,_charmed:0,_atkBuff:0,_pacified:0,_invis:0,_folie:0,_aile:0,_sixsens:0,_sylvestre:0,
    bobPhase:Math.random()*Math.PI*2,
    // Movement realism: independent phases for organic wandering and timed runs
    wPhaseX:Math.random()*Math.PI*2,
    wPhaseY:Math.random()*Math.PI*2,
    wSpeed:1.4+Math.random()*1.2,         // faster wandering = more visible motion
    runT:0,runTx:0,runTy:0,runCool:Math.random()*2,  // off-the-ball run state
    dribCurve:0,                          // dribbling carrier zig-zag bias
    tackleCool:0,                         // cooldown between physical tackle attempts
  }));
}

function mkBench(ti){
  const na=ti===0
    ?['Bertrand','Lefebvre','Fontaine','Renaud','Peltier']
    :['Mendoza','Vargas','Ibarra','Salinas','Reyes'];
  const pools=[['fireball','soin'],['shield','thunder'],['ice2','tech'],['mouton','fire'],['amitie','tech']];
  const pos=['MC','ATT','DC','DD','MC'];
  return na.map((name,i)=>({
    id:`t${ti}b${i}`,name,pos:pos[i],img:'',ini:name.slice(0,2).toUpperCase(),
    s:{spd:38+~~(Math.random()*52),sht:36+~~(Math.random()*55),def:36+~~(Math.random()*55),stam:62+~~(Math.random()*34),tec:38+~~(Math.random()*52),res:40+~~(Math.random()*55)},
    spells:pools[i]||['tech'],
    x:-10,y:PCY,vx:0,vy:0,tx:-10,ty:PCY,
    hp:100,mp:100,yc:0,red:false,stunT:0,hasBall:false,
    injLevel:0,injT:0,
    mG:0,mSh:0,mTk:0,mSp:0,_img:null,onBench:true,
    _spdDebuff:0,_charmed:0,_atkBuff:0,_pacified:0,_invis:0,_folie:0,_aile:0,_sixsens:0,_sylvestre:0,
    bobPhase:Math.random()*Math.PI*2,
    wPhaseX:Math.random()*Math.PI*2,
    wPhaseY:Math.random()*Math.PI*2,
    wSpeed:1.4+Math.random()*1.2,
    runT:0,runTx:0,runTy:0,runCool:Math.random()*2,
    dribCurve:0,
    tackleCool:0,
  }));
}

function mkReserves(ti){
  const na=ti===0?['Blondel','Dupond','Marchand']:['Alvarado','Gimenez','Fuentes'];
  const pos=['DC','ATT','MC'];
  return na.map((name,i)=>({
    id:`t${ti}r${i}`,name,pos:pos[i],img:'',ini:name.slice(0,2).toUpperCase(),
    s:{spd:30+~~(Math.random()*45),sht:28+~~(Math.random()*45),def:28+~~(Math.random()*45),stam:55+~~(Math.random()*40),tec:30+~~(Math.random()*45),res:35+~~(Math.random()*50)},
    spells:['tech'],
    hp:100,mp:100,injLevel:0,
    _img:null,isReserve:true,
  }));
}

let teams=[
  {name:'Les Rouges',color:'#e02030',strat:'321',players:mkPlayers(0),bench:mkBench(0),reserves:mkReserves(0)},
  {name:'Les Bleus', color:'#1878e8',strat:'321',players:mkPlayers(1),bench:mkBench(1),reserves:mkReserves(1)},
];

// ═══════════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════════
let G={
  running:false,minute:0,half:1,
  scores:[0,0],shots:[0,0],tackles:[0,0],corners:[0,0],fouls:[0,0],possT:[0,0],
  ball:{x:PCX,y:PCY,vx:0,vy:0,trail:[],spin:0},
  owner:null,atkTi:0,
  phase:'KICKOFF',phTick:0,
  minTick:0,aiTick:0,
  ptcl:[],flash:0,flashCol:'#fff',
  log:[],
  leagueMode:false,careerMode:false,careerCupMode:false,_paused:false,_celebrating:false,penaltyWinner:undefined,
  _kickoffTi:0,_firstHalfKickoffTi:0,matchEvents:[],_lastPasser:[null,null],
  tacMode:[null,null],
  tacSliders:[
    {press:0.5,line:0,width:0,aggr:0,pressLine:0.5,style:'normal'},
    {press:0.5,line:0,width:0,aggr:0,pressLine:0.5,style:'normal'}
  ],
  playerRoles:[[],[]], // per-player: 'def'|'normal'|'atk'
  gegenT:[0,0],       // gegenpressing timer per team
  gkCoolT:0,          // cooldown après dégagement — empêche le pressing immédiat (seconds after losing ball)
  _pressNearest:[null,null], // cached nearest player per team for pressing
};

const PHASE_LABELS={
  KICKOFF:"COUP D'ENVOI",BUILDUP:'CONSTRUCTION',ATTACK:'ATTAQUE',
  TRANSITION:'CONTRE-ATTAQUE',CORNER:'CORNER',FREEKICK:'COUP FRANC',
  GOALKICK:'DÉGAGEMENT',HALFTIME:'MI-TEMPS',END:'FIN DU MATCH',
};

let speedMult=3;
let cvs,ctx,raf,lastTs=0;

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist2=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const rng=(a,b)=>a+Math.random()*(b-a);
const irng=(a,b)=>Math.floor(rng(a,b+1));
const pick=a=>a[~~(Math.random()*a.length)];
const norm=(dx,dy)=>{const m=Math.hypot(dx,dy)||1;return{x:dx/m,y:dy/m};};
const allP=()=>[teams[0],teams[1]].flatMap(T=>T.players);
const actP=ti=>{
  // Joueurs actifs de l'équipe ti : ses propres joueurs (hors dominés partis
  // ailleurs) PLUS les adversaires actuellement dominés qui jouent pour elle.
  const own=teams[ti].players.filter(p=>!p.red&&p.hp>0&&p.injLevel<3&&!(p._dominated>0));
  const oti=1-ti;
  const borrowed=teams[oti].players.filter(p=>!p.red&&p.hp>0&&p.injLevel<3&&p._dominated>0&&p._dominatedBy===ti);
  return borrowed.length?own.concat(borrowed):own;
};
// Équipe pour laquelle un joueur joue actuellement (tient compte de la domination).
const effTeam=p=>(p._dominated>0&&p._dominatedBy!=null)?p._dominatedBy:(teams[0].players.includes(p)?0:1);
const hasRed=ti=>(teams[ti]?.players||[]).some(p=>p.red); // une équipe a-t-elle déjà un expulsé?

// ── Deep-clone utilities (used by league to avoid reference sharing) ──
function clonePlayer(p){
  return Object.assign({},p,{
    s:{...p.s},
    spells:[...(p.spells||[])],
    _img:null,
    // Spell debuffs
    _hm:p._hm!==undefined?p._hm:(()=>{const r=(Math.random()+Math.random()-1)*10;return Math.round(Math.max(-10,Math.min(10,r)));})(),
    _fm:p._fm!==undefined?p._fm:(()=>{const r=(Math.random()+Math.random()-1)*10;return Math.round(Math.max(-10,Math.min(10,r)));})(),
    _auraDivine:0, _auraDivineActive:false, _aideDivine:[],
    _spdDebuff:p._spdDebuff||0,_charmed:p._charmed||0,_atkBuff:p._atkBuff||0,
    _pacified:p._pacified||0,_invis:p._invis||0,_folie:p._folie||0,
    _aile:p._aile||0,_sixsens:p._sixsens||0,_sylvestre:p._sylvestre||0,_dragon:p._dragon||0,
    // Movement fields - ensure they exist (old saves may lack them)
    bobPhase:p.bobPhase??Math.random()*Math.PI*2,
    wPhaseX:p.wPhaseX??Math.random()*Math.PI*2,
    wPhaseY:p.wPhaseY??Math.random()*Math.PI*2,
    wSpeed:p.wSpeed??(1.4+Math.random()*1.2),
    runT:p.runT||0,runTx:p.runTx||0,runTy:p.runTy||0,
    runCool:p.runCool??Math.random()*2,
    dribCurve:p.dribCurve||0,
    tackleCool:p.tackleCool||0,
  });
}
function deepCloneTeam(T){
  if(!T)return null;
  return{name:T.name,color:T.color,img:T.img||'',strat:T.strat||'321',
    players:(T.players||[]).map(p=>p?clonePlayer(p):null).filter(Boolean),
    bench:(T.bench||[]).map(p=>p?clonePlayer(p):null).filter(Boolean),
    reserves:(T.reserves||[]).map(p=>({...p,s:{...p.s}}))};
}
function byR(ti,...r){const a=actP(ti);const f=a.filter(p=>r.includes(p.pos));return f.length?f:a;}
const strat=ti=>{
  const base={...(STRATS.find(s=>s.id===teams[ti].strat)||STRATS[0])};
  const sl=G.tacSliders[ti];
  if(sl){
    // press slider: 0=bloc bas, 1=pressing maximal — overrides formation default
    if(sl.press!==undefined&&sl.press!==0) base.press=Math.min(1.5,Math.max(0.05,sl.press*1.4));
    if(sl.pressLine!==undefined&&sl.pressLine!==0) base.pressLine=sl.pressLine;
    base.atk      =Math.min(2.0,Math.max(0.4, base.atk    +(sl.line||0)*0.15));
    base.def      =Math.min(2.0,Math.max(0.4, base.def    -(sl.line||0)*0.12));
    // lineDepth: valeur BRUTE du curseur "Ligne défensive" (-1..+1), conservée
    // à part pour piloter la PROFONDEUR RÉELLE de la ligne défensive sur le
    // terrain (roleTarget/lineAnchor) — avant, seul le pressing (press/pressLine)
    // influençait la position géométrique, donc ce curseur ne faisait presque
    // rien voir sur le terrain, seulement du atk/def "invisible".
    base.lineDepth=(sl.line||0);
    base.width    =Math.min(1.6,Math.max(0.4, (base.width||1)+(sl.width||0)*0.4));
    base.runFreq  =Math.min(2.5,Math.max(0.3, (base.runFreq||1)+(sl.aggr||0)*0.5));
    // pressLine: where on pitch pressing triggers. -1=own half, 0=halfway, +1=opponent third
    base.pressLine=(sl.pressLine||0);
    // style: 'normal'|'direct'|'possession'|'counter'
    base.style    =sl.style||'normal';
    // Style presets modify motor params directly
    if(base.style==='possession'){ base.runFreq=Math.max(0.3,base.runFreq*.7); base.atk*=0.95; base.def*=1.05; }
    if(base.style==='direct')    { base.runFreq=Math.min(2.5,base.runFreq*1.4); base.atk*=1.18; }
    if(base.style==='counter')   { base.press=Math.max(0.05,base.press*.4); base.attDepth=(base.attDepth||0)+10; base.runFreq=Math.min(2.5,base.runFreq*1.6); base.atk*=1.25; base.def*=1.15; }

    // ── SYNERGIES TACTIQUES : récompenser les réglages cohérents ────────
    const lineSl=sl.line||0, widthSl=sl.width||0, pressSl=(sl.press!==undefined?sl.press:0.5);
    const defRating=STRATS.find(s=>s.id===teams[ti].strat)?.def||1;

    // BÉTONNAGE : bloc bas (line<0) + compact (width<0) + pressing bas.
    // Plus la formation est déjà défensive (def élevé), plus le bonus est marqué.
    // Un vrai bunker discipliné et resserré défend mieux qu'un bloc bas mal réglé.
    if(lineSl<0 && widthSl<0){
      const compactness=Math.min(1,(-lineSl)*(-widthSl)*1.6);   // 0..1 selon à quel point c'est bas ET serré
      const lowPressBonus=pressSl<0.35?1:pressSl<0.55?0.5:0;    // récompense un vrai bloc bas (pas de pressing haut incohérent)
      const defBonus=0.10+compactness*0.20+lowPressBonus*0.10;  // jusqu'à +40% def
      base.def*=(1+defBonus*Math.min(1.2,defRating));           // amplifié pour une formation défensive (1-3-3)
      base._bunker=true;
    }

    // JEU DE POSSESSION ÉTALÉ : bloc haut (line>0) + large (width>0) + style possession.
    // Récompense un 3-2-2 gardien volant qui combine et étire le terrain :
    // supériorité au milieu, circulation → plus d'occasions de qualité.
    if(lineSl>0 && widthSl>0 && base.style==='possession'){
      const spread=Math.min(1,lineSl*widthSl*1.6);
      base.atk*=(1+0.12+spread*0.22);   // jusqu'à ~+34% atk
      base.midPush=Math.min(2,(base.midPush||1)*(1+spread*0.35));
      base.runFreq=Math.min(2.5,(base.runFreq||1)*(1+spread*0.2));
      base._tikitaka=true;
    }
    // Variante sans le style possession : bloc haut + large tout court donne
    // un bonus offensif plus modeste (étirer le terrain crée des espaces).
    else if(lineSl>0 && widthSl>0){
      const spread=Math.min(1,lineSl*widthSl*1.6);
      base.atk*=(1+spread*0.14);
    }

    // ── 3-2-1 ÉQUILIBRÉ : récompense la POLYVALENCE ─────────────────────
    // Le classique brille quand on ne force aucun extrême : réglages centrés
    // (ligne, largeur, pressing médians) → petit bonus à la fois atk ET def.
    // C'est le couteau suisse : solide partout tant qu'on reste équilibré.
    if(teams[ti].strat==='321'){
      const centered=(1-Math.min(1,Math.abs(lineSl)))*(1-Math.min(1,Math.abs(widthSl)))*(1-Math.min(1,Math.abs(pressSl-0.5)*2));
      if(centered>0.3){
        const bal=0.06+centered*0.12;   // jusqu'à ~+18%
        base.atk*=(1+bal); base.def*=(1+bal);
        base._balanced=true;
      }
    }

    // ── 2-3-1 GEGENPRESSING : récompense le PRESSING HAUT ───────────────
    // Formation de domination du milieu : pressing haut (press>0.6) + ligne
    // haute (line>0) → étouffe l'adversaire, récupère haut, plus d'occasions.
    if(teams[ti].strat==='231' && pressSl>0.6 && lineSl>0){
      const intensity=Math.min(1,(pressSl-0.6)/0.4 * Math.min(1,lineSl*1.4));
      base.atk*=(1+0.08+intensity*0.20);           // jusqu'à ~+28% atk
      base.runFreq=Math.min(2.5,(base.runFreq||1)*(1+intensity*0.3));
      base.press=Math.min(1.5,base.press+intensity*0.2); // pressing encore plus mordant
      base._gegen=true;
    }
  }
  // Gegen: if team just lost ball, boost pressing for 4s
  if(G.gegenT&&G.gegenT[ti]>0){
    base.press=Math.min(1.5,base.press+0.5);
    base.runFreq=Math.min(2.5,(base.runFreq||1)+0.6);
  }
  const mode=G.tacMode[ti];
  if(mode==='press') { base.press=Math.min(1.5,base.press+0.6); base.atk*=1.15; base.def*=0.85; }
  if(mode==='defend'){ base.press=Math.max(0.1,base.press-0.4); base.def*=1.35; base.atk*=0.70; base.attDepth=(base.attDepth||0)-6; }
  if(mode==='attack'){ base.atk*=1.40; base.def*=0.65; base.press=Math.min(1.5,base.press+0.3); base.attDepth=(base.attDepth||0)+8; base.runFreq=Math.min(2.5,(base.runFreq||1)+0.8); }
  return base;
};
const ownerP=()=>G.owner?allP().find(p=>p.id===G.owner):null;
// Fatigue multiplier: tired players (low HP) AND injured players perform worse in duels and shots.
// Range: 0.55 (exhausted+seriously injured) → 1.00 (fresh and healthy).
const fatMul=p=>{
  if(!p)return 1;
  const hpFactor=.65+.35*(p.hp/100);
  const injFactor=[1,.92,.78,.55][p.injLevel||0];
  const buffMul=p._atkBuff>0?1.30:1.0;
  const debuffMul=p._pacified>0?0.50:p._charmed>0?0.40:p._folie>0?0.30:1.0;
  const sixsensMul=p._sixsens>0?1.45:1.0;// sixième sens = meilleure défense
  return hpFactor*injFactor*buffMul*debuffMul*sixsensMul;
};

// Rapport de force pour la CRÉATION d'occasions : la capacité de l'attaque à
// se mettre en position (technique + vitesse + tir) contre la capacité de la
// défense à l'en empêcher (défense + technique de placement). Une équipe qui
// domine ce duel se crée plus d'occasions (et de meilleure qualité).
function _attackEdge(ati,dti){
  const aps=(teams[ati]?.players||[]);
  const dps=(teams[dti]?.players||[]);
  if(!aps.length||!dps.length)return 1;
  // Attaque : pondère surtout les joueurs offensifs
  const atkRaw=aps.reduce((s,p)=>{const st=p.s||{};const w=(p.pos==='ATT'||p.pos==='MO'||p.pos==='MOG'||p.pos==='MOD')?1.5:1;
    return s+w*((st.tec||50)*1.1+(st.spd||50)*0.8+(st.sht||50)*0.6)/2.5;},0)/aps.reduce((s,p)=>s+((p.pos==='ATT'||p.pos==='MO'||p.pos==='MOG'||p.pos==='MOD')?1.5:1),0);
  // Défense : pondère surtout les défenseurs
  const defRaw=dps.reduce((s,p)=>{const st=p.s||{};const w=(p.pos==='DC'||p.pos==='DD'||p.pos==='DG'||p.pos==='MDC'||p.pos==='GB')?1.5:1;
    return s+w*((st.def||50)*1.2+(st.tec||50)*0.6+(st.spd||50)*0.4)/2.2;},0)/dps.reduce((s,p)=>s+((p.pos==='DC'||p.pos==='DD'||p.pos==='DG'||p.pos==='MDC'||p.pos==='GB')?1.5:1),0);
  const atkPow=atkRaw*(strat(ati).atk||1);
  const defPow=defRaw*(strat(dti).def||1);
  const ratio=atkPow/Math.max(1,defPow);
  return Math.max(0.55,Math.min(1.9,Math.pow(ratio,1.4)));
}

// AVANT : réassignait le poste de CHAQUE joueur d'après un gabarit fixe par
// stratégie (FORM_ROLES), en écrasant tout choix individuel fait dans la
// fiche joueur (ex: "3 DC, 1 DD, 1 DG, 1 MDC" était systématiquement
// retapé en DC/DD/DG/MC/MC/ATT du 3-2-1). Les formations ne sont que des
// BASES tactiques (pressing/largeur/etc, voir strat()) : le placement réel
// de chaque joueur doit venir de SON poste, choisi individuellement.
// MAINTENANT : on ne touche plus aux postes choisis — on s'assure juste
// qu'il existe UN SEUL gardien (sinon dégagements/arrêts n'ont plus de sens).
function applyFormationRoles(ti){
  const T=teams[ti];
  if(!T||!T.players?.length) return;

  const is11v11 = gameMode === '11v11';
  const is5v5 = gameMode === '5v5';
  const expectedSize = is11v11 ? 11 : (is5v5 ? 5 : 7);

  // Assigner les postes selon la formation si l'équipe a le bon nombre de joueurs
  const strat11 = is11v11 ? (T.strat11||'442') : null;
  if(is11v11 && strat11 && FORMS_11V11[strat11] && T.players.length === 11){
    const positions = FORMS_11V11[strat11];
    T.players.forEach((p, i) => {
      if(p && positions[i]) p.pos = positions[i];
    });
  }
  // 5v5 : appliquer les postes de la formation aux 5 titulaires pour éviter
  // que des joueurs générés/importés (souvent tous "DC") ne se collent tous
  // dans la même zone. On respecte quand même un gardien unique.
  const strat5 = is5v5 ? (T.strat5||'121') : null;
  if(is5v5 && strat5 && FORMS_5V5[strat5] && T.players.length >= 5){
    const positions = FORMS_5V5[strat5];
    T.players.slice(0,5).forEach((p, i) => {
      if(p && positions[i]) p.pos = positions[i];
    });
  }
  // 7v7 : appliquer les postes de la formation choisie (FORM_ROLES). Sans ça,
  // choisir 6-0-0 ou 2-4 ne changeait pas les postes des joueurs → placement
  // incohérent (défenseurs éparpillés, etc.). On applique aux 7 titulaires.
  if(!is11v11 && !is5v5){
    const strat7 = T.strat || '321';
    const strat7Atk = T.stratAtk || null;
    if(FORM_ROLES[strat7] && T.players.length >= 7){
      const posDef = FORM_ROLES[strat7];
      const posAtk = (strat7Atk && FORM_ROLES[strat7Atk]) ? FORM_ROLES[strat7Atk] : null;
      T.players.slice(0,7).forEach((p, i) => {
        if(!p) return;
        if(posDef[i]) p.pos = posDef[i];
        // Deux formations : mémoriser le poste dans chaque phase
        p.posDef = posDef[i] || p.pos;
        p.posAtk = posAtk ? (posAtk[i] || p.posDef) : p.posDef;
      });
    }
  }

  // S'assurer qu'il y a exactement 1 gardien
  const gbCount=T.players.filter(p=>p&&p.pos==='GB').length;
  if(gbCount===0){
    T.players[0].pos='GB';
  } else if(gbCount>1){
    let seen=false;
    T.players.forEach(p=>{
      if(p&&p.pos==='GB'){
        if(seen) p.pos = is11v11 ? 'DC' : 'DC';
        seen=true;
      }
    });
  }
}

function formBase(ti,pi){
  const T = teams[ti];
  // ── DEUX FORMATIONS (avec / sans ballon) ──────────────────────────────
  // Si l'équipe a une formation d'attaque distincte (T.stratAtk) et qu'un
  // facteur de possession lissé existe (T._possBias : 0=repli défensif,
  // 1=phase offensive), on INTERPOLE la position du joueur entre sa place
  // "sans ballon" (posDef) et "avec ballon" (posAtk). Sinon, comportement
  // classique à une seule formation.
  const hasDual = T && T.stratAtk && T.stratAtk !== T.strat &&
                  gameMode !== '11v11'; // 7v7 / 5v5 pour l'instant
  if(hasDual){
    const bias = clamp((T._possBias!=null ? T._possBias : (G && G.atkTi===ti ? 1 : 0)), 0, 1);
    const pDef = (players_of(T)[pi] && players_of(T)[pi].posDef) || (players_of(T)[pi] && players_of(T)[pi].pos);
    const pAtk = (players_of(T)[pi] && players_of(T)[pi].posAtk) || pDef;
    const dPos = _formBaseForPos(ti, pi, pDef);
    const aPos = _formBaseForPos(ti, pi, pAtk);
    return { x: lerp(dPos.x, aPos.x, bias), y: lerp(dPos.y, aPos.y, bias) };
  }
  return _formBaseForPos(ti, pi, null);
}
function players_of(T){ return T && T.players ? T.players : []; }

// Calcule la position de formation d'un joueur, en substituant éventuellement
// son poste (posOverride) — utilisé pour les deux formations avec/sans ballon.
function _formBaseForPos(ti,pi,posOverride){
  const T = teams[ti];

  const posMap = window.gameMode === '5v5'   ? (window.POS_COORDS_5V5   || POS_COORDS)
               : window.gameMode === '11v11' ? (window.POS_COORDS_11V11 || POS_COORDS)
               : POS_COORDS;
  const fallbackForms = window.gameMode === '11v11'
    ? (window.FORMS_COORDS_11V11 && window.FORMS_COORDS_11V11[(T&&T.strat11)||'442'])
    : null;
  const players = T && T.players ? T.players : [];
  const p = players[pi];
  const myPos = posOverride || (p && p.pos);
  let f;
  if(p && myPos && posMap[myPos]){
    const base = posMap[myPos];
    const _lineOf = (pos)=>{
      if(['DC','DCD','DCG','DD','DG','LB','RB','FIXO'].includes(pos)) return 'DEF';
      if(['MDC','MDC2','MC','MCD','MCG'].includes(pos)) return 'MID';
      if(['MO','MOG','MOD','AG','AD','ALA_L','ALA_R'].includes(pos)) return 'ATT_MID';
      if(['ATT','ATT2','PIVOT'].includes(pos)) return 'FWD';
      return pos;
    };
    // Poste "actif" de chaque joueur pour le calcul de ligne : si on est en
    // train de calculer une formation donnée (override), on utilise le poste
    // correspondant de CHAQUE joueur (posDef/posAtk) pour rester cohérent.
    const _activePosOf = (q)=>{
      if(!posOverride) return q.pos;
      // déterminer si on calcule la formation d'attaque ou de défense
      // en comparant l'override au poste d'attaque du joueur courant
      const wantAtk = (p.posAtk && posOverride===p.posAtk);
      return wantAtk ? (q.posAtk||q.pos) : (q.posDef||q.pos);
    };
    const myLine = _lineOf(myPos);
    if(myLine==='DEF' || myLine==='MID'){
      const lineMates = [];
      for(let i=0;i<players.length;i++){
        const q=players[i];
        const qp=_activePosOf(q);
        if(q && qp && posMap[qp] && _lineOf(qp)===myLine){
          lineMates.push({i, y: posMap[qp][1]});
        }
      }
      lineMates.sort((a,b)=> a.y - b.y || a.i - b.i);
      const n = lineMates.length;
      const k = lineMates.findIndex(o=>o.i===pi);
      let sumX=0; lineMates.forEach(o=>sumX+=posMap[_activePosOf(players[o.i])][0]);
      const lineX = sumX/n;
      if(n>1 && k>=0){
        const spreadHalf = 0.39;
        const t = (k-(n-1)/2)/((n-1)/2||1);
        const fy = clamp(0.5 + t*spreadHalf, 0.08, 0.92);
        f = [lineX, fy];
      } else {
        f = [base[0], base[1]];
      }
    } else {
      const sameIdx = [];
      for(let i=0;i<players.length;i++){if(players[i]&&_activePosOf(players[i])===myPos)sameIdx.push(i);}
      const n = sameIdx.length;
      let fy = base[1];
      if(n>1){
        const k = sameIdx.indexOf(pi);
        const maxSpread = window.gameMode==='11v11' ? 0.60 : 0.34;
        const perPlayer = window.gameMode==='11v11' ? 0.16 : 0.10;
        const spread = Math.min(maxSpread, perPlayer*n);
        const t = (k-(n-1)/2)/Math.max(1,(n-1));
        fy = Math.max(.06, Math.min(.94, base[1]+t*spread*2));
      }
      f = [base[0], fy];
    }
    return _finishFormBase(ti, f);
  } else if(fallbackForms && fallbackForms[pi]){
    return _finishFormBase(ti, fallbackForms[pi]);
  } else {
    const f = (FORMS[T && T.strat ? T.strat : '321'] || FORMS['321'])[pi] || [.5,.5];
    return _finishFormBase(ti, f);
  }
}

// Applique l'orientation d'équipe + largeur tactique à une coordonnée normalisée
function _finishFormBase(ti, f){
  const fx = ti===0 ? f[0] : 1-f[0];
  const _st = (typeof strat === 'function') ? strat(ti) : null;
  const w = _st && _st.width ? _st.width : 1;
  const fy2 = PCY + (f[1]-.5)*WH*w;
  return {x: fx*WW, y: clamp(fy2, 2, WH-2)};
}


// ═══════════════════════════════════════════════════════════
// BALL CONTROL
// ═══════════════════════════════════════════════════════════
function giveB(p){
  if(!p)return;
  // Tracker le dernier porteur par équipe (pour les passes décisives)
  const inTeam=(T,pl)=>T.players.some(q=>q===pl||q.id===pl.id)||T.bench?.some(q=>q===pl||q.id===pl.id);
  // Équipe effective : un joueur dominé joue pour l'équipe qui le contrôle.
  const teamOf=pl=>(pl._dominated>0&&pl._dominatedBy!=null)?pl._dominatedBy:(inTeam(teams[0],pl)?0:1);
  const ti=teamOf(p);
  const prev=ownerP();
  if(prev&&prev!==p){
    if(!G._lastPasser) G._lastPasser=[null,null];
    const prevTi=teamOf(prev);
    if(prevTi===ti) G._lastPasser[ti]=prev; // passe dans la même équipe
  }
  allP().forEach(q=>q.hasBall=false);
  G.owner=p.id;p.hasBall=true;
  G.atkTi=ti;
}
function freeB(){allP().forEach(p=>p.hasBall=false);G.owner=null;}
function kickTo(tx,ty,spd=2.2){
  freeB();
  const dx=tx-G.ball.x,dy=ty-G.ball.y,d=Math.hypot(dx,dy)||1;
  G.ball.vx=(dx/d)*spd;G.ball.vy=(dy/d)*spd;
  G.ball.spin=spd*3;
}
function kickToP(from,to,spd=1.8){
  freeB();
  const dx=to.x-G.ball.x,dy=to.y-G.ball.y,d=Math.hypot(dx,dy)||1;
  G.ball.vx=(dx/d)*spd;G.ball.vy=(dy/d)*spd;
  G.ball.spin=spd*2;
}

// Trouve une position d'ESPACE LIBRE près du joueur pour se démarquer et
// offrir une option de passe : on échantillonne quelques points autour de lui
// (biaisés vers l'avant) et on garde celui le plus éloigné des adversaires
// tout en restant à portée de passe du porteur. Rend les appels de balle
// naturels au lieu de foncer bêtement vers le but.
function openSpaceTarget(p, ti, ballX, ballY){
  const fwd = ti===0 ? 1 : -1;
  const opps = actP(1-ti);
  let best=null, bestScore=-1e9;
  for(let k=0;k<8;k++){
    const ang = (k/8)*Math.PI*2;
    const rad = 6 + Math.random()*10;
    let cx = Math.max(3, Math.min(WW-3, p.x + Math.cos(ang)*rad));
    let cy = Math.max(3, Math.min(WH-3, p.y + Math.sin(ang)*rad));
    let nearOpp=1e9;
    for(const o of opps){ const d=Math.hypot(o.x-cx,o.y-cy); if(d<nearOpp)nearOpp=d; }
    const prog = (cx - p.x)*fwd;
    const distBall = Math.hypot(cx-ballX, cy-ballY);
    if(distBall > WW*0.5) continue;
    const tooClose = distBall < 5 ? -20 : 0;
    const score = nearOpp*1.6 + prog*0.7 - Math.abs(distBall-WW*0.22)*0.3 + tooClose;
    if(score>bestScore){ bestScore=score; best={x:cx,y:cy}; }
  }
  return best;
}

// Choisit le MEILLEUR destinataire de passe pour le porteur : un coéquipier
// démarqué, de préférence vers l'avant et pas trop loin. Renvoie null si
// personne de correct (le porteur gardera/dribblera). Rend le jeu bien plus
// fluide : les joueurs se cherchent au lieu de perdre le ballon.
function bestPassTarget(carrier, ati, opts){
  opts = opts || {};
  const forward = opts.forward!==false;   // privilégier l'avant par défaut
  const maxDist = opts.maxDist || (WW*0.55);
  const goalX = ati===0 ? WW : 0;          // but adverse
  const mates = actP(ati).filter(p=>p && p!==carrier && !p.hasBall && p.pos!=='GB');
  if(!mates.length) return null;
  const opps = actP(1-ati);
  let best=null, bestScore=-1e9;
  for(const m of mates){
    const dx=m.x-carrier.x, dy=m.y-carrier.y;
    const dist=Math.hypot(dx,dy)||1;
    if(dist>maxDist) continue;
    if(dist<3) continue; // trop proche, inutile
    // Progression vers le but adverse (positive = passe vers l'avant)
    const prog = ati===0 ? (m.x-carrier.x) : (carrier.x-m.x);
    // Démarquage : distance au défenseur le plus proche du destinataire
    let nearOpp=1e9;
    for(const o of opps){ const dd=Math.hypot(o.x-m.x,o.y-m.y); if(dd<nearOpp)nearOpp=dd; }
    // Ligne de passe dégagée ? pénaliser un défenseur entre le porteur et la cible
    let blocked=0;
    for(const o of opps){
      // projection du défenseur sur le segment carrier→m
      const t=((o.x-carrier.x)*dx+(o.y-carrier.y)*dy)/(dist*dist);
      if(t>0.1 && t<0.95){
        const px=carrier.x+dx*t, py=carrier.y+dy*t;
        const perp=Math.hypot(o.x-px,o.y-py);
        if(perp<2.2){ blocked+=1; }
      }
    }
    // Score : démarquage + progression - distance - lignes bloquées
    let score = nearOpp*1.4 + (forward?prog*0.9:0) - dist*0.35 - blocked*22;
    // Un destinataire bien placé devant le but est très intéressant
    const mToGoal=Math.abs(m.x-goalX);
    if(mToGoal<WW*0.28) score += 12;
    if(score>bestScore){ bestScore=score; best=m; }
  }
  return best;
}

// ═══════════════════════════════════════════════════════════
// ROLE TARGETS
// ═══════════════════════════════════════════════════════════
// Predict where the ball will be ~timeAhead seconds from now (used by all players for anticipation)
function ballPredict(timeAhead){
  const b=G.ball;
  if(G.owner){
    // Carrier-controlled: predict from carrier velocity
    const o=ownerP();
    if(o)return{x:b.x+o.vx*timeAhead*.6,y:b.y+o.vy*timeAhead*.6};
  }
  // Free ball: integrate with friction decay
  const decay=Math.pow(BALL_FRIC,timeAhead*60);
  const meanV=(1-decay)/(1-BALL_FRIC)/60; // closed-form-ish integral approximation
  return{x:b.x+b.vx*meanV,y:b.y+b.vy*meanV};
}

// ═══════════════════════════════════════════════════════════
// MODE DE JEU — Sélecteur global
// ═══════════════════════════════════════════════════════════

// Exposé sur window pour être accessible depuis index.html et tous les scripts
// ── Coordonnées normalisées 11v11 — exposées sur window ──────────────
window.FORMS_COORDS_11V11 = {
  '442':  [[.07,.50],[.22,.15],[.22,.40],[.22,.60],[.22,.85],
           [.47,.15],[.47,.40],[.47,.60],[.47,.85],
           [.73,.33],[.73,.67]],
  '433':  [[.07,.50],[.22,.13],[.22,.38],[.22,.62],[.22,.87],
           [.44,.25],[.44,.50],[.44,.75],
           [.70,.16],[.70,.50],[.70,.84]],
  '4231': [[.07,.50],[.22,.13],[.22,.38],[.22,.62],[.22,.87],
           [.38,.30],[.38,.70],
           [.55,.18],[.55,.50],[.55,.82],
           [.76,.50]],
  '352':  [[.07,.50],[.20,.25],[.20,.50],[.20,.75],
           [.44,.10],[.44,.32],[.44,.50],[.44,.68],[.44,.90],
           [.72,.33],[.72,.67]],
  '4141': [[.07,.50],[.22,.13],[.22,.38],[.22,.62],[.22,.87],
           [.38,.50],
           [.52,.15],[.52,.40],[.52,.60],[.52,.85],
           [.76,.50]],
  '532':  [[.07,.50],[.19,.12],[.19,.31],[.19,.50],[.19,.69],[.19,.88],
           [.44,.25],[.44,.50],[.44,.75],
           [.70,.33],[.70,.67]],
  '4312': [[.07,.50],[.22,.13],[.22,.38],[.22,.62],[.22,.87],
           [.42,.25],[.42,.50],[.42,.75],
           [.60,.50],
           [.75,.33],[.75,.67]],
  '343':  [[.07,.50],[.20,.25],[.20,.50],[.20,.75],
           [.44,.12],[.44,.35],[.44,.65],[.44,.88],
           [.70,.16],[.70,.50],[.70,.84]],
  '4411': [[.07,.50],[.22,.13],[.22,.38],[.22,.62],[.22,.87],
           [.44,.15],[.44,.40],[.44,.60],[.44,.85],
           [.60,.50],
           [.77,.50]],
  '541':  [[.07,.50],[.18,.10],[.18,.28],[.18,.50],[.18,.72],[.18,.90],
           [.46,.18],[.46,.40],[.46,.60],[.46,.82],
           [.74,.50]],
};

// ── Coordonnées normalisées 5v5 (futsal) — GB + 4 joueurs de champ ────
// [profondeur 0→1 (0=but propre, 1=but adverse), côté 0→1]
window.FORMS_COORDS_5V5 = {
  // Diamant : 1 déf, 2 milieux (gauche/droite), 1 pivot/attaquant
  '121':  [[.08,.50],[.28,.50],[.52,.24],[.52,.76],[.80,.50]],
  // Carré : 2 défenseurs, 2 attaquants
  '22':   [[.10,.50],[.30,.30],[.30,.70],[.72,.30],[.72,.70]],
  // Offensif : 1 déf, 1 milieu, 2 attaquants
  '112':  [[.08,.50],[.26,.50],[.50,.50],[.76,.28],[.76,.72]],
  // Défensif : 3 défenseurs, 1 pointe
  '31':   [[.08,.50],[.26,.25],[.26,.50],[.26,.75],[.74,.50]],
  // Y inversé ultra-offensif : 1 déf, 3 attaquants
  '13':   [[.09,.50],[.28,.50],[.66,.20],[.66,.50],[.66,.80]],
};

// Formations 5v5 : liste ordonnée des postes [GB, ...4 joueurs de champ]
const FORMS_5V5 = {
  '121': ['GB','DC','MOG','MOD','ATT'],
  '22':  ['GB','DD','DG','AG','AD'],
  '112': ['GB','DC','MC','AG','AD'],
  '31':  ['GB','DD','DC','DG','ATT'],
  '13':  ['GB','DC','AG','MO','AD'],
};

window.FORMS_5V5 = FORMS_5V5;

// Stratégies 5v5 (bases tactiques : pressing / largeur / profondeur)
const STRATS_5V5 = [
  {id:'121', n:'1-2-1',  d:'Diamant équilibré',                atk:1.00,def:1.00,press:.55,width:1.00,attDepth:0,  midPush:1.05,runFreq:1.10,col:'#1878e8'},
  {id:'22',  n:'2-2',    d:'Carré compact, deux blocs',        atk:1.05,def:1.05,press:.50,width:1.05,attDepth:0,  midPush:1.00,runFreq:1.05,col:'#f0c028'},
  {id:'112', n:'1-1-2',  d:'Deux pointes, pressing haut',      atk:1.22,def:.85, press:.85,width:1.10,attDepth:3,  midPush:1.35,runFreq:1.45,col:'#e02030'},
  {id:'31',  n:'3-1',    d:'Bloc bas, un pivot',               atk:.80, def:1.30,press:.22,width:.82, attDepth:-2, midPush:.60, runFreq:.70, col:'#18c860'},
  {id:'13',  n:'1-3',    d:'Ultra offensif, trois devant',     atk:1.32,def:.78, press:.90,width:1.18,attDepth:4,  midPush:1.45,runFreq:1.60,col:'#e91e63'},
];

// Positions de base 5v5 par poste individuel
const POS_COORDS_5V5 = {
  GB:  [.08,.50],
  DC:  [.26,.50],
  DD:  [.28,.78],
  DG:  [.28,.22],
  MDC: [.40,.50],
  MC:  [.48,.50],
  MOG: [.54,.24],
  MOD: [.54,.76],
  MO:  [.60,.50],
  AG:  [.74,.22],
  AD:  [.74,.78],
  ATT: [.80,.50],
};
window.POS_COORDS_5V5 = POS_COORDS_5V5;
window.STRATS_5V5 = STRATS_5V5;

window.gameMode = '7v7';


function setGameMode(mode){
  window.gameMode = mode;
  gameMode = mode;
  if(mode === '11v11'){
    _applyMode11v11();
  } else if(mode === '5v5'){
    _applyMode5v5();
  } else {
    _applyMode7v7();
  }
  if(typeof resize === 'function') resize();
  if(typeof updateModeBtns === 'function') updateModeBtns();
}

// Applique les VRAIES dimensions de terrain (variables module WW/WH/…) pour
// un mode donné, puis recalcule les constantes dérivées. Sans ça, le 11v11
// se jouait sur un terrain 75×50 avec 22 joueurs entassés.
function _setFieldDims(w,h,psx,paw,pah,goalHalf){
  WW=w; WH=h;
  PCX=WW/2; PCY=WH/2;
  PSX=psx; PA_W=paw; PA_H=pah;
  GY1=PCY-goalHalf; GY2=PCY+goalHalf;
}

function _applyMode5v5(){
  Object.assign(window, CONSTANTS_5V5);
  _setFieldDims(60, 40, 7, 10, 20, 2.5);
}

function _applyMode7v7(){
  Object.assign(window, CONSTANTS_7V7);
  _setFieldDims(75, 50, 9, 12, 26, 3.0);
}

function _applyMode11v11(){
  Object.assign(window, CONSTANTS_11V11);
  _setFieldDims(105, 68, 11, 16.5, 40.3, 3.66);
}

// ── Constantes 5v5 (futsal / foot à 5) ───────────────────────────────
const CONSTANTS_5V5 = {
  FIELD_W: 75, FIELD_H: 50,
  GOAL_W: 6, PS_X: 9,
  PA_W: 12, PA_H: 26,
  TEAM_SIZE: 5, BENCH_SIZE: 3,
  MAX_SUBS: 99, MATCH_DURATION: 90,
};

// ── Constantes 7v7 (originales) ──────────────────────────────────────
const CONSTANTS_7V7 = {
  FIELD_W: 75, FIELD_H: 50,
  GOAL_W: 6, PS_X: 9,
  PA_W: 12, PA_H: 26,
  TEAM_SIZE: 7, BENCH_SIZE: 5,
  MAX_SUBS: 99, MATCH_DURATION: 90,
};

// ── Constantes 11v11 ──────────────────────────────────────────────────
const CONSTANTS_11V11 = {
  FIELD_W: 105, FIELD_H: 68,
  GOAL_W: 7.32, PS_X: 11,
  PA_W: 16.5, PA_H: 40.3,
  TEAM_SIZE: 11, BENCH_SIZE: 7,
  MAX_SUBS: 3, MATCH_DURATION: 90,
};

// ── Formations 11v11 ─────────────────────────────────────────────────
// Format : liste de positions pour les 11 joueurs [GB, DEF×n, MID×n, ATT×n]

const STRATS_11V11 = [
  {id:'442',   n:'4-4-2',         d:'Classique équilibré',             atk:1.00,def:1.00,press:.50,width:1.00,attDepth:0,  midPush:1.00,runFreq:1.00,col:'#1878e8'},
  {id:'433',   n:'4-3-3',         d:'Possession et pressing haut',     atk:1.15,def:.90, press:.70,width:1.15,attDepth:2,  midPush:1.20,runFreq:1.25,col:'#f0c028'},
  {id:'4231',  n:'4-2-3-1',       d:'Double pivot, MO créatif',        atk:1.10,def:1.05,press:.55,width:1.05,attDepth:1,  midPush:1.30,runFreq:1.15,col:'#e02030'},
  {id:'352',   n:'3-5-2',         d:'3 défenseurs, milieu dense',      atk:1.05,def:1.10,press:.45,width:.90, attDepth:0,  midPush:1.25,runFreq:1.10,col:'#18c860'},
  {id:'4141',  n:'4-1-4-1',       d:'Pivot défensif, bloc compact',    atk:.90, def:1.20,press:.35,width:.85, attDepth:-2, midPush:.80, runFreq:.90, col:'#9c27b0'},
  {id:'532',   n:'5-3-2',         d:'Bloc bas défensif',               atk:.85, def:1.35,press:.20,width:.80, attDepth:-3, midPush:.70, runFreq:.75, col:'#607d8b'},
  {id:'4312',  n:'4-3-1-2',       d:'Trident offensif',                atk:1.20,def:.88, press:.65,width:1.10,attDepth:3,  midPush:1.40,runFreq:1.40,col:'#ff5722'},
  {id:'343',   n:'3-4-3',         d:'Ultra offensif, risqué',          atk:1.30,def:.80, press:.80,width:1.20,attDepth:4,  midPush:1.50,runFreq:1.60,col:'#e91e63'},
  {id:'4411',  n:'4-4-1-1',       d:'Milieu box-to-box, 1 attaquant',  atk:.95, def:1.08,press:.50,width:.95, attDepth:0,  midPush:1.10,runFreq:1.05,col:'#00bcd4'},
  {id:'541',   n:'5-4-1',         d:'Bunker défensif',                 atk:.75, def:1.45,press:.15,width:.75, attDepth:-4, midPush:.60, runFreq:.70, col:'#795548'},
];

// ── Positions 11v11 par poste ────────────────────────────────────────
// [profondeur 0→1 (0=but propre, 1=but adverse), côté 0→1]
const POS_COORDS_11V11 = {
  GB:   [.06,.50],
  DC:   [.22,.50],
  DCD:  [.22,.63],
  DCG:  [.22,.37],
  DD:   [.22,.85],
  DG:   [.22,.15],
  LB:   [.22,.85], // latéral bas (synonyme DD)
  RB:   [.22,.15], // latéral bas (synonyme DG)
  MDC:  [.40,.50],
  MDC2: [.40,.38],
  MC:   [.50,.50],
  MCD:  [.50,.65],
  MCG:  [.50,.35],
  MOG:  [.62,.18],
  MOD:  [.62,.82],
  MO:   [.62,.50],
  AG:   [.78,.15],
  AD:   [.78,.85],
  ATT:  [.80,.50],
  ATT2: [.80,.40],
};
window.POS_COORDS_11V11 = POS_COORDS_11V11;

// ── Positions de base pour chaque formation 11v11 ─────────────────────
// Liste ordonnée : [GB, puis tous les autres dans l'ordre formation]
const FORMS_11V11 = {
  '442':  ['GB','DD','DC','DC','DG','MC','MC','MC','MC','ATT','ATT'],
  '433':  ['GB','DD','DC','DC','DG','MC','MC','MC','AG','ATT','AD'],
  '4231': ['GB','DD','DC','DC','DG','MDC','MDC','MO','MOG','MOD','ATT'],
  '352':  ['GB','DC','DC','DC','MC','MC','MC','MOG','MOD','ATT','ATT'],
  '4141': ['GB','DD','DC','DC','DG','MDC','MC','MC','MO','MC','ATT'],
  '532':  ['GB','DD','DC','DC','DC','DG','MC','MC','MC','ATT','ATT'],
  '4312': ['GB','DD','DC','DC','DG','MC','MC','MC','MO','ATT','ATT'],
  '343':  ['GB','DC','DC','DC','MC','MC','MC','MC','AG','ATT','AD'],
  '4411': ['GB','DD','DC','DC','DG','MC','MC','MC','MC','MO','ATT'],
  '541':  ['GB','DD','DC','DC','DC','DG','MC','MC','MC','MC','ATT'],
};

// ── Stats niveau 11v11 District (très bas) ────────────────────────────
// Les potes du dimanche ont des stats entre 0 et 10
const LEVEL_STAT_RANGES_11V11 = {
  'dh_4': {min:0,  max:8},    // Dimanche matin, chaussures de ville
  'dh_3': {min:2,  max:12},
  'dh_2': {min:5,  max:16},
  'dh_1': {min:8,  max:20},
  dh:     {min:3,  max:12},
  r3:     {min:12, max:28},
  r2:     {min:22, max:40},
  r1:     {min:32, max:52},
  d3:     {min:45, max:62},
  d2:     {min:55, max:72},
  d1:     {min:68, max:88},
};

// ── État global du mode de substitution 11v11 ─────────────────────────
const G_11V11 = {
  subs_used: [0, 0],  // changements utilisés par équipe
  max_subs: 3,
};

function resetSubs11v11(){
  G_11V11.subs_used = [0, 0];
}

function canSub11v11(ti){
  return G_11V11.subs_used[ti] < G_11V11.max_subs;
}

function doSub11v11(ti){
  if(!canSub11v11(ti)) return false;
  G_11V11.subs_used[ti]++;
  return true;
}
