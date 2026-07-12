// ═══════════════════════════════════════════════════════════
// PILIER.JS — Nation « Le Pilier Céleste »
// « La hauteur est prestige ; le mérite, légende »
// ═══════════════════════════════════════════════════════════
// Une immense tour sacrée de 101 étages, jadis bâtie par une civilisation
// disparue pour atteindre les dieux, puis confiée aux anges. Devenue un pays
// vertical : plus on monte, plus c'est riche et prestigieux. Peuplé en très
// grande majorité d'anges (sommets) et de démons (fondations) ; à peine ~5 %
// d'autres peuples, cantonnés aux basses divisions.
//
// Répartition des races (gérée à la génération selon la division, cf.
// worlds_index.generatePlayer + RACE_WEIGHTS_BY_REGION['le_pilier_*']) :
//   Élite / haut (d1,d2)      → anges dominants
//   Milieu (r1,r2)            → mélange anges/démons
//   Fondations (r3,dh)        → démons dominants + ~5 % autres peuples
// ═══════════════════════════════════════════════════════════

const PILIER = {

  // ── Identité de la nation ──────────────────────────────────────────
  id: 'pilier',
  name: 'Le Pilier Céleste',
  subtitle: 'La hauteur est prestige ; le mérite, légende',
  color: '#d4af37',
  flag: '🗼',
  philosophy: "Le football du Pilier se joue à la verticale. Aux sommets, les anges cultivent un jeu aérien, léger et technique, hérité des académies dorées du Zénith. Aux fondations, les démons imposent un football rugueux, physique et frondeur, forgé dans les vieux ateliers de l'ancienne civilisation. Entre les deux, tout un pays s'affronte étage par étage — car ici, gravir la tour, c'est écrire sa légende.",

  // ── Profil joueur de base ─────────────────────────────────────────
  baseStats: {
    tec:  {min:42, max:76},
    spd:  {min:44, max:78},
    sht:  {min:42, max:76},
    def:  {min:42, max:76},
    stam: {min:46, max:78},
    res:  {min:44, max:78},
  },

  // Nation surnaturelle : anges et démons dominent, humains rares.
  races: {
    human: { statOverride: null },
  },

  // ── Sorts de prédilection (pays sacré : magie céleste/infernale) ──
  preferredSpells: ['tech','shield','soin','heal','aile','folie'],

  // ── Pyramide nationale (10 divisions de 20 clubs = 200 clubs) ──────
  // On mappe les 10 ligues du lore sur les paliers du moteur (d1…dh). Les
  // divisions au-dessus de d1 restent « nationales » ; en dessous, on garde
  // le fonctionnement régional du moteur mais avec une seule région.
  pyramid: [
    {id:'d1', name:'Ligue du Grand Trône Divin', short:'GTD', national:true,  teams:20, promoted:0, relegated:3},
    {id:'d2', name:'Ligue du Zénith',            short:'ZEN', national:true,  teams:20, promoted:3, relegated:3},
    {id:'d3', name:'Première Ligue Céleste',     short:'C1',  national:true,  teams:20, promoted:3, relegated:3},
    {id:'r1', name:'Deuxième Ligue Céleste',     short:'C2',  national:true,  teams:20, promoted:3, relegated:3},
    {id:'r2', name:'Troisième Ligue Céleste',    short:'C3',  national:true,  teams:20, promoted:3, relegated:3},
    {id:'r3', name:'Quatrième Ligue Céleste',    short:'C4',  national:true,  teams:20, promoted:3, relegated:3},
    {id:'dh', name:'Ligue des Fondations',       short:'FOND',national:false, teams:20, promoted:3, relegated:0, groups_typical:4},
  ],

  // ── Compétitions nationales ───────────────────────────────────────
  cups: [
    {id:'coupe_pilier', name:'Coupe du Pilier', type:'knockout', open_to:'all'},
    {id:'supercoupe_pilier', name:'Supercoupe du Pilier', type:'single', open_to:'d1_winner_cup_winner'},
  ],

  // ── Compétitions continentales ────────────────────────────────────
  continental: [
    {id:'couronne_celeste', name:'Couronne Céleste', slots:'d1_top3', prestige:5},
  ],

  // ── Région unique : tout le Pilier ────────────────────────────────
  regions: [
    {
      id: 'le_pilier',
      name: 'Le Pilier',
      type: 'Tour-nation verticale (101 étages)',
      wealth: 3,
      talent: 4,
      population: 5,
      color: '#d4af37',
      desc: "Une tour-monde de 101 étages. Les sommets dorés abritent les grandes Maisons angéliques et leurs académies ; les fondations, plus sombres, appartiennent aux clubs démoniaques nés dans les vieux ateliers. Le 101ᵉ étage — le Grand Trône Divin — n'accueille aucun club : on n'y joue que les finales et les cérémonies.",
      pyramid: { has_r2:true, has_r1:true, district_groups:4 },
      traits: { vertical_society:true, sacred:true, house_system:true },
      // non_siren_chance élevé : on ne veut quasiment jamais de sirène ici ; la
      // vraie répartition ange/démon/autre est gérée par division (voir races.js
      // + generatePlayer). Léger bonus technique (héritage des académies).
      statMods: { tec:+4, spd:+3, sht:+2, def:+1, stam:0, res:+2, non_siren_chance:0.98 },
      names: ['Uriel','Séraphine','Azraël','Lilith','Michaël','Nyx','Gabriel','Bael','Raphaëlle','Malphas','Camaël','Astaroth','Zadkiel','Naberius','Ariel','Focalor','Israfel','Vepar','Sariel','Andras','Cassiel','Abaddon','Ambriel','Belial','Haniel','Dagon','Jophiel','Furfur','Raziel','Marbas','Selaphiel','Orias','Barachiel','Vassago','Muriel','Amon','Remiel','Stolas','Nathaniel','Gremory','Zephon','Valac','Ithuriel','Gusion','Sabriel','Halphas','Penemue','Zagan','Chamuel','Buer','Anael','Sitri','Jehoel','Crocell'],
      clubNames: ['Aether Primus','Lux Primus','Aether Secundus','Lux Secundus','Ventus Primus','Aether Custodes','Lux Ordo','Aether Ferrum','Lux Aurora','Aether Nova','Lux Gloria','Aether Sanctum','Lux Excelsior','Ventus Academia','Aether Academia','Lux Academia','Aether Legio','Lux Vigilia','Ventus Sanctum','Aether Excelsior'],
      spellBonus: ['aile','folie'],
    },
  ],

  // ── Événements régionaux ──────────────────────────────────────────
  regionalEvents: {
    le_pilier: [
      {id:'ascension', prob:0.10, type:'positive', msg:"🪽 Un prodige des académies angéliques frappe à votre porte — un renfort aérien vous rejoint !"},
      {id:'trone_divin', prob:0.06, type:'positive', msg:"👑 Votre club est convié à jouer au Grand Trône Divin — réputation +8 !"},
      {id:'faille_infernale', prob:0.09, type:'warning', msg:"🔥 Une faille s'ouvre dans les fondations : un match sous haute tension cette semaine."},
    ],
  },
};

if(typeof window!=='undefined'){ window.PILIER = PILIER; }
