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

  // ── Nationalité & noms de lignée ──────────────────────────────────
  demonym: 'Céleste',              // gentilé des natifs du Pilier
  foreignChance: 0.04,             // ~4 % d'étrangers dans les ligues pro
  lineageChance: 0.55,             // ~55 % des natifs portent un nom de lignée
  // Répartition des sexes : le Pilier est très majoritairement féminin, avec
  // une part de joueurs non-genrés/autres. F=femme, M=homme, X=non-genré/autre.
  sexRatio: { F:0.80, M:0.12, X:0.08 },
  // Prénoms par sexe (le prénom colle au sexe du joueur). F/M/X.
  firstNamesBySex: {
    F: ["Séraphine","Raphaëlle","Gabrielle","Ambrielle","Murielle","Anaëlle","Célestine","Arielle","Uriélle","Camaëlle","Zéphirine","Auriane","Lucine","Séléné","Astrée","Aurore","Éloane","Ismérie","Angélie","Cassielle","Jophielle","Sariélle","Zadkielle","Barachielle","Israfelle","Ramielle","Haniélle","Nathaële","Raziélle","Sabrielle","Ithuriélle","Penemuelle","Chamuelle","Séléstiel","Aube","Clairlaine","Lumine","Étoile","Céleste","Aurélie","Soléane","Éthérie","Astralie","Nimbe","Lilith","Nyx","Morrigane","Hécate","Naamah","Lamia","Circé","Médée","Abyssa","Ishtar","Vespera","Nocturne","Malicia","Belladone","Ravenne","Ombreline","Sombra","Nyssa","Érèbe","Kali","Méphista","Astarté","Proserpine","Perséphone","Lilika","Draconia","Gorgone","Empusa","Carmilla","Séléna","Nocturna","Tenebra","Umbrella","Cendria","Suie","Braise","Écarlate","Vénéfica","Morgane","Nihila","Livia","Aurelia","Cornelia","Valeria","Octavia","Claudia","Julia","Flavia","Antonia","Drusilla","Marcella","Fabiola","Severina","Maximilla","Tullia","Aemilia","Cassia","Portia","Lucilla","Vibia","Domitia","Agrippina","Calpurnia","Hortensia","Servilia","Terentia","Fulvia","Aurélia","Sabina","Lépida","Junia","Pompeia","Metella","Vipsania","Antistia","Rubria","Caecilia","Plautia","Sempronia","Volusia"],
    M: ["Uriel","Gabriel","Michaël","Raphaël","Camaël","Zadkiel","Sariel","Israfel","Cassiel","Barachiel","Selaphiel","Jophiel","Raziel","Haniel","Nathaniel","Chamuel","Remiel","Ambriel","Ithuriel","Sabriel","Métatron","Sandalphon","Raguel","Jérahmeel","Zéphon","Puriel","Théliel","Anael","Séraphin","Ariel","Bael","Astaroth","Malphas","Naberius","Focalor","Andras","Abaddon","Belial","Dagon","Furfur","Marbas","Orias","Vassago","Amon","Stolas","Gremory","Valac","Gusion","Halphas","Zagan","Buer","Sitri","Crocell","Penemue","Vepar","Belphégor","Asmodée","Mammon","Léviathan","Baalzébuth","Moloch","Azazel","Béhémoth","Xaphan","Rimmon","Adramelech","Nergal","Paimon","Berith","Forneus","Marcus","Lucius","Gaius","Titus","Aulus","Quintus","Cassius","Aurelius","Cornelius","Fabius","Valerius","Octavius","Severus","Maximus","Tiberius","Decimus","Servius","Gnaeus","Publius","Vitellius","Claudius","Flavius","Antonius","Aemilius","Horatius","Tullius","Sempronius","Vibius","Marcellus","Drusus","Cassien","Aurélien","Valérien","Sévérin","Maximin","Octave","Tibère","Fabien","Julien","Adrien"],
    X: ["Ariel","Sael","Nael","Zephyr","Ombre","Aube","Astre","Séraph","Vesper","Nox","Ael","Iel","Sol","Aeon","Écho","Onyx","Ciel","Aster","Wren","Sable","Éther","Nimbe","Brume","Cendre","Crépuscule","Aurore","Zénith","Nadir","Éclat","Pénombre","Silel","Lior","Alix","Sacha","Camille","Ange","Éden","Séraphael","Nyel"],
  },
  // Noms de lignée (patronymes façon Maison/noblesse) — indépendants du club.
  lineageNames: [
    'Aetheris','Luxen','Ignaris','Umbrael','Ventaris','Terravox','Aquaris','Fulgaris',
    'Noctaris','Auralis','Seraphel','Abyssia','Caelor','Infernis','Astrael','Gehennis',
    'Gloriel','Tenebrae','Solarian','Lunaris','Feroxis','Sanctael','Mortis','Vitalis',
    'Corvaris','Aquilon','Draconis','Leonis','Phoenar','Serparis','Taurel','Luparis',
    'Cygnaris','Hydris','Pavonis','Vulparis','Ursalis','Lyraeth','Orionis','Stellaris',
    'de Aetheris','del Solarian','di Caelor','von Umbrael','de la Gloriel','della Astrael',
  ],
  // Joueurs étrangers (structure prête pour d'autres pays). Noms d'autres styles
  // + nationalité distincte. À enrichir quand les autres nations existeront.
  foreignNames: [
    {name:'Kaito Tanaka', nat:'Insulaire'}, {name:'Bjorn Halvarsson', nat:'Nordique'},
    {name:'Diego Vargas', nat:'Méridional'}, {name:'Kwame Osei', nat:'Sablier'},
    {name:'Ivan Petrov', nat:'Steppique'}, {name:'Liam O\'Brien', nat:'Brumeux'},
    {name:'Chen Wei', nat:'Oriental'}, {name:'Omar Haddad', nat:'Dunaire'},
    {name:'Sven Eriksson', nat:'Nordique'}, {name:'Rafael Costa', nat:'Méridional'},
    {name:'Yuki Nakamura', nat:'Insulaire'}, {name:'Dmitri Volkov', nat:'Steppique'},
    {name:'Amara Ndiaye', nat:'Sablier'}, {name:'Tarek Mansour', nat:'Dunaire'},
  ],

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
      names: ["Gnaeus d'Infernalis","Aulus Julius","Furfur del Cassius","Ithuriel Luminaris","Penemue Drusus","Buer Nocturnus","Valac Vibius","Arielle di Solaris","Vepar Caelestis","Valac Cassius","Andras Caelestis","Michaël Flavius","Anaëlle Solaris","Sabriel Luminaris","Valerius Igneus","Aurelius Flavius","Sariel d'Aemilius","Israfel Vibius","Titus d'Octavius","Decimus del Seraphis","Morrigane Abyssalis","Hécate Marcellus","Abaddon Marcellus","Zagan Marcellus","Aurelius Julius","Maximus del Aurelius","Gnaeus Igneus","Buer de la Vibius","Naamah della Fulguris","Penemue Caelestis","Decimus Luminaris","Maximus Abyssalis","Ariel Aurelius","Jophiel Vesperis","Arielle Valerius","Servius della Aemilius","Cassius Draconis","Penemue Severus","Octavius de Stellaris","Marcus Antonius","Tiberius Vesperis","Gnaeus Horatius","Vepar Aetherius","Naberius de la Luminaris","Naberius Mortalis","Anaëlle Vibius","Vepar Sanctus","Lucius del Nocturnus","Aulus di Infernalis","Séraphine Antonius","Israfel del Drusus","Dagon Claudius","Morrigane de Mortalis","Gabrielle d'Flavius","Nyx van Sempronius","Abaddon della Antonius","Raphaël Cassius","Aulus Gloriae","Ariel Cassius","Israfel Flavius","Severus Stellaris","Célestine de la Mortalis","Belial Caelestis","Jophiel d'Infernalis","Jophiel de Valerius","Gaius d'Drusus","Tiberius Cassius","Camaël di Vesperis","Gabriel Gloriae","Naamah Infernalis","Gaius d'Flavius","Remiel Luminaris","Raphaëlle Sempronius","Anaëlle de Sempronius","Penemue Tenebris","Séraphine de la Severus","Abaddon Sanctus","Morrigane Valerius","Uriel Abyssalis","Dagon van Horatius","Naberius Aemilius","Fabius Draconis","Cornelius von Severus","Focalor Drusus","Ambrielle Aurelius","Lilith Solaris","Aulus van Octavius","Selaphiel Antonius","Raziel del Umbralis","Jophiel del Antonius","Bael Igneus","Vassago Cornelius","Gnaeus de la Infernalis","Orias Aemilius","Célestine Nocturnus","Naamah Fulguris","Fabius Horatius","Dagon Umbralis","Buer Marcellus","Murielle del Aetherius","Raphaëlle del Abyssalis","Dagon Solaris","Cornelius Drusus","Vitellius Mortalis","Astaroth Umbralis","Servius d'Infernalis","Aurelius della Cornelius","Quintus Cornelius","Cassiel d'Marcellus","Anaëlle Fulguris"],
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
