// ═══════════════════════════════════════════════════════════
//  RORANG.JS — Nation « Rorang » (équivalent Cambodge)
//  « Sous la mousson, le ballon danse »
//  ─────────────────────────────────────────────────────────────
//  Petit pays semi-professionnel : les clubs ne sont pas riches, le
//  niveau global est modeste. Peuplé en grande majorité d'humains, avec
//  une forte minorité de Leyaks (sirènes-démones féminines), quelques
//  fées, sirènes, et un mélange d'autres peuples d'Asie (elfes, nains,
//  vampires…) + une petite diaspora « chinoise » (noms d'ailleurs).
//
//  Le sexe des joueurs est déterminé par la RACE (cf. races.js →
//  RACE_SEX_RATIO), pas par la nation : Leyaks/Fées 100 % féminines,
//  sirènes ~90 % féminines, humains 50/50, elfes/nains à majorité
//  masculine, etc. La nation ne fixe donc PAS de sexRatio global.
//
//  HIÉRARCHIE (encodée en détail dans `pyramid[].phases`) :
//   • N1 🏆 Preah League — D1, 6 équipes (semi-pro).
//       Phase 1 (saison régulière) → phase finale en deux poules :
//         - Poule HAUTE (top ... voir phases) : titre + 2 places
//           continentales UEAF (réservées, non simulées pour l'instant).
//         - Poule BASSE : 5 équipes condamnées à la phase inférieure,
//           dont la dernière descend en D2.
//   • N2 🥈 Kram League — D2, 7 équipes (semi-pro/amateur).
//       Phase finale MONTANTE (5 équipes) → 1 seul promu en D1.
//       Les 2 dernières jouent les BARRAGES descendants vs Régional.
//   • Régional (amateur) — 4 ligues géographiques, nombre d'équipes
//     variable. Les 4 premiers de chaque région → play-offs régionaux,
//     dont les vainqueurs vont en play-off final tenter de « tabasser »
//     les 2 barragistes de D2 pour monter.
//         - Krong League (Rorang / capitale)
//         - Phsar League (Nord)
//         - Tonle League (Est)
//         - Prey  League (Ouest)
// ═══════════════════════════════════════════════════════════

const RORANG = {

  // ── Identité de la nation ──────────────────────────────────────────
  id: 'rorang',
  name: 'Rorang',
  subtitle: 'Sous la mousson, le ballon danse',
  color: '#e0a020',
  flag: '🛕',
  philosophy: "Le football du Rorang est joueur, malin et endurant plutôt que puissant. Sur des terrains gorgés de mousson, les équipes privilégient les passes courtes, la ruse et un pressing infatigable. Les moyens sont modestes, les stades bruyants, et la ferveur des supporters compense largement la pauvreté des clubs. On y gravit les échelons à la sueur, jamais à l'argent.",

  // ── Profil joueur de base (niveau modeste) ────────────────────────
  // Fourchettes volontairement basses : le Rorang n'est pas une nation
  // d'élite. L'endurance/agilité priment sur la puissance.
  baseStats: {
    tec:  {min:38, max:70},
    spd:  {min:40, max:72},
    sht:  {min:34, max:64},
    def:  {min:36, max:66},
    stam: {min:44, max:76},
    res:  {min:38, max:68},
  },

  // Races présentes (physiologie uniquement ; cf. races.js). Le détail de
  // la composition par région est dans races.js → RACE_WEIGHTS_BY_REGION.
  races: {
    human: { name:'Humain', emoji:'👤', description:'Majorité de la population du Rorang.', statOverride:null },
    leyak: { name:'Leyak',  emoji:'👺', description:'Grosse minorité. Esprits féminins agiles et rusés.', statOverride:null },
    fairy: { name:'Fée',    emoji:'🧚', description:'Rares. Très agiles, physiquement frêles.', statOverride:null },
    siren: { name:'Sirène', emoji:'🧜', description:'Présentes près du grand lac et des côtes.', statOverride:null },
  },

  // ── Sorts de prédilection (magie « moite », ruse, esprits) ────────
  preferredSpells: ['illusion','suggest','pass','tech','soin','pacif','amitie'],

  // ── Nationalité & noms ────────────────────────────────────────────
  demonym: 'Rorangais',
  foreignChance: 0.06,     // petite diaspora (surtout « chinoise ») en semi-pro
  lineageChance: 0.35,     // moins de noms de lignée qu'ailleurs
  // PAS de sexRatio de nation : le sexe est piloté par la race (races.js).
  // (Laisser absent = fallback race-only.)

  // Prénoms par sexe — majorité khmère, avec d'autres peuples d'Asie du
  // Sud-Est et quelques prénoms « chinois ». X = non-genré/rare.
  firstNamesBySex: {
    F: [
      // Khmers
      'Sophea','Chanthou','Bopha','Sreymom','Kanya','Devi','Sokha','Maly','Reaksmey','Chenda',
      'Kunthea','Nakry','Phalla','Rachana','Sokhom','Theary','Vanna','Sery','Champei','Dara',
      'Sovann','Mealea','Pich','Sanea','Leakhena','Chhaya','Nimol','Rasmey','Sothea','Veasna',
      // Autres peuples d'Asie du SE
      'Mali','Sunisa','Kanya','Ratana','Nupha','Thida','Lamai','Achara','Wanida','Siriporn',
      // Diaspora « chinoise »
      'Meiling','Xiulan','Yifei','Lihua','Jinghua','Qingzhao','Ruolan','Bidu',
    ],
    M: [
      // Khmers
      'Sokha','Vichea','Rithy','Sovann','Dara','Chan','Piseth','Kosal','Rithisak','Vanna',
      'Samnang','Sovannara','Chetra','Bunthoeun','Kimhan','Rotha','Sopheak','Vibol','Chhay','Kong',
      'Pheakdey','Ratana','Sereivuth','Thavrin','Visal','Bora','Chamroeun','Kimsan','Makara','Norak',
      // Autres peuples d'Asie du SE
      'Somchai','Anurak','Kittisak','Narong','Prasit','Wichai','Adisorn','Bunma','Khamla','Thongchai',
      // Diaspora « chinoise »
      'Wei','Jian','Hao','Feng','Bo','Cheng','Kun','Liang','Tao','Zhen',
    ],
    X: [
      'Sae','Dy','Sok','Sovan','Pou','Kea','Rith','Vy','Sim','Chan','Lin','Sing','An','Nou','Sil',
    ],
  },

  // Noms de lignée / familles (patronymes khmers et sino-khmers).
  lineageNames: [
    'Sok','Chea','Hun','Kem','Ly','Meas','Nou','Ouk','Pen','Prak','Ros','Sam','Sar','Sen','Suon',
    'Tep','Uch','Vong','Yos','Chan','Keo','Khieu','Long','Mao','Ngin','Pich','Rin','Say','Thap','Ung',
    // Sino-khmers
    'Tan','Lim','Heng','Chhun','Eng','Kong','Ma','Ngo','Oy','Taing',
  ],

  // Diaspora / étrangers (noms + nationalité affichée).
  foreignNames: [
    { name:'Li Wei',        nat:'Xin' },
    { name:'Zhang Hao',     nat:'Xin' },
    { name:'Chen Jian',     nat:'Xin' },
    { name:'Nguyen Minh',   nat:'Viêt' },
    { name:'Tran Long',     nat:'Viêt' },
    { name:'Somchai Pak',   nat:'Sayam' },
    { name:'Bounma Sisan',  nat:'Lann' },
    { name:'Aung Htet',     nat:'Bamar' },
  ],

  // ── Pyramide nationale ────────────────────────────────────────────
  // Les champs classiques `promoted`/`relegated` sont ce que le moteur de
  // saison actuel applique (version simplifiée). Le détail des phases
  // finales est dans `phases` (utilisé pour l'affichage et la simulation
  // future). Les places continentales UEAF sont RÉSERVÉES mais NON encore
  // simulées (continental laissé vide volontairement).
  pyramid: [
    {
      id:'d1', name:'Preah League', short:'N1', emoji:'🏆',
      national:true, status:'semiProfessional',
      teams:6, promoted:0, relegated:1,
      // Phase 1 (régulière) puis phase finale scindée en deux poules.
      phases: {
        regular: { name:'Phase 1', rounds:'double', teams:6 },
        final: {
          name:'Phase finale',
          // Les 6 clubs se répartissent après la phase 1 :
          //   HAUTE : jouent le titre + 2 places continentales (UEAF).
          //   BASSE : 5 clubs « condamnés » à la phase inférieure, dont le
          //           dernier descend en D2.
          groups: [
            { id:'championship', name:'Poule haute',   from:'top',    slots:1, continental:2, title:true },
            { id:'relegation',   name:'Poule basse',   from:'bottom', slots:5, relegate:1 },
          ],
        },
      },
      continentalReserved: { competition:'UEAF Asie', slots:2, simulated:false },
    },
    {
      id:'d2', name:'Kram League', short:'N2', emoji:'🥈',
      national:true, status:'semiProfessional',
      teams:7, promoted:1, relegated:2,
      phases: {
        regular: { name:'Phase 1', rounds:'double', teams:7 },
        final: {
          name:'Phase finale',
          groups: [
            // Phase finale MONTANTE : 5 équipes, 1 seul promu en D1.
            { id:'promotion', name:'Phase montante', from:'top', slots:5, promote:1 },
            // Les 2 dernières jouent les barrages descendants vs Régional.
            { id:'playout',   name:'Barrages descendants', from:'bottom', slots:2, relegatePlayoff:true },
          ],
        },
      },
    },
    {
      id:'r1', name:'Ligues Régionales', short:'RÉG', emoji:'🗺️',
      national:false, status:'amateur',
      teams:12, promoted:2, relegated:0, groups_typical:4,
      // Régional = 4 ligues géographiques à effectif variable. Les 4
      // premiers de chaque région vont en play-offs régionaux ; les
      // vainqueurs affrontent les 2 barragistes de D2 pour monter.
      phases: {
        regular: { name:'Saison régionale', rounds:'double', variableTeams:true },
        final: {
          name:'Play-offs de montée',
          groups: [
            { id:'regional_po', name:'Play-offs régionaux', from:'top', perGroup:4 },
            { id:'promotion_final', name:'Play-off final de montée', vs:'d2_playout', promote:'variable' },
          ],
        },
      },
      // Les 4 ligues régionales (contenu dans regions[].leagueName).
      regionalLeagues: ['Krong League','Phsar League','Tonle League','Prey League'],
    },
  ],

  // ── Coupes nationales ─────────────────────────────────────────────
  cups: [
    { id:'coupe_rorang', name:'Coupe du Rorang', type:'knockout', open_to:'all' },
    { id:'supercoupe_rorang', name:'Supercoupe du Rorang', type:'single', open_to:'d1_winner_cup_winner' },
  ],

  // ── Compétitions continentales ────────────────────────────────────
  // RÉSERVÉES mais NON simulées pour l'instant (à la demande). Les 2 places
  // de la poule haute de Preah League y mèneront quand l'UEAF existera.
  continental: [],

  // ── Régions (4 ligues régionales) ─────────────────────────────────
  regions: [
    {
      id: 'krong',
      name: 'Krong',
      leagueName: 'Krong League',
      type: 'Capitale',
      wealth: 2, talent: 3, population: 4,
      color: '#e0a020',
      desc: "La capitale et sa région. Le plus de clubs, le plus de talents, la meilleure formation du pays (ce qui reste modeste). Forte présence de Leyaks en ville.",
      pyramid: { district_groups:0, has_r3:false, has_r2:false, has_r1:true },
      traits: { best_formation:true, most_clubs:true },
      statMods: { tec:+6, spd:+3, sht:+2, def:0, stam:0, res:0, non_siren_chance:1.0, stat_variance:12 },
      names: ['Sophea','Vichea','Rithy','Chanthou','Bopha','Dara','Sokha','Kanya'],
      clubNames: [
        'Preah Krong FC','Angkor United','Royal Rorang','Krong City','Bassac FC','Phnom SC',
        'Leyak Krong','Naga Capitale','Wat Doré FC','Mekong Krong',
      ],
      spellBonus: ['illusion','suggest'],
    },
    {
      id: 'phsar',
      name: 'Phsar (Nord)',
      leagueName: 'Phsar League',
      type: 'Nord marchand',
      wealth: 2, talent: 2, population: 3,
      color: '#d4884c',
      desc: "Le Nord, terre de marchés et de collines. Économie de bazar, clubs frugaux mais bien soutenus. Diaspora sino-khmère notable.",
      pyramid: { district_groups:0, has_r3:false, has_r2:false, has_r1:true },
      traits: { market_town:true, chinese_diaspora:true },
      statMods: { tec:+2, spd:+2, sht:0, def:+2, stam:+2, res:0, non_siren_chance:1.0, stat_variance:14 },
      names: ['Meiling','Wei','Jian','Sokhom','Theary','Rotha','Kimhan'],
      clubNames: [
        'Phsar United','Nord Bazar FC','Collines SC','Marché FC','Sino Phsar','Bantéay Nord',
        'Kompong Phsar','Damrei FC','Hauts-Plateaux FC','Phsar Étoile',
      ],
      spellBonus: ['pass','tech'],
    },
    {
      id: 'tonle',
      name: 'Tonle (Est)',
      leagueName: 'Tonle League',
      type: 'Grand lac',
      wealth: 1, talent: 2, population: 3,
      color: '#2fa0c0',
      desc: "L'Est et son grand lac. Villages flottants, pêcheurs, humidité permanente. Présence de sirènes près des eaux. Clubs pauvres mais endurants.",
      pyramid: { district_groups:0, has_r3:false, has_r2:false, has_r1:true },
      traits: { great_lake:true, floating_villages:true, poor_clubs:true },
      statMods: { tec:0, spd:0, sht:0, def:+2, stam:+6, res:+4, non_siren_chance:0.85, stat_variance:16 },
      names: ['Reaksmey','Chenda','Sery','Champei','Veasna','Sothea'],
      clubNames: [
        'Tonle FC','Grand Lac SC','Pêcheurs United','Village Flottant FC','Naga des Eaux','Boeung FC',
        'Sirène Tonle','Mékong Est','Kompong Tonle','Prek FC',
      ],
      spellBonus: ['soin','pacif'],
    },
    {
      id: 'prey',
      name: 'Prey (Ouest)',
      leagueName: 'Prey League',
      type: 'Forêts & frontière',
      wealth: 1, talent: 1, population: 2,
      color: '#4a9c4a',
      desc: "L'Ouest forestier et frontalier. Le plus pauvre, le plus rude, le moins peuplé. Terres d'esprits : forte présence de Leyaks et quelques fées. Football de survie.",
      pyramid: { district_groups:0, has_r3:false, has_r2:false, has_r1:true },
      traits: { forest_frontier:true, poorest:true, spirits_land:true },
      statMods: { tec:+2, spd:+4, sht:-2, def:0, stam:+2, res:-2, non_siren_chance:1.0, stat_variance:18 },
      names: ['Sae','Dy','Sok','Kea','Rith','Vy','Sim'],
      clubNames: [
        'Prey FC','Forêt United','Frontière SC','Esprits de Prey','Leyak Prey','Bois Sombre FC',
        'Kravanh FC','Ouest Sauvage','Phnom Prey','Sylve FC',
      ],
      spellBonus: ['illusion','amitie'],
    },
  ],

  // ── Événements spéciaux par région ────────────────────────────────
  regionEvents: {
    krong: [
      { id:'city_sponsor', prob:0.10, type:'finance',  msg:'🛕 Un commerçant de la capitale sponsorise le club !', amount:300 },
      { id:'derby_fervor', prob:0.12, type:'positive', msg:'🛕 Ferveur de derby : moral au sommet cette semaine !' },
    ],
    phsar: [
      { id:'market_deal',  prob:0.10, type:'finance',  msg:'🪙 Bonne affaire au marché : recette exceptionnelle.', amount:250 },
    ],
    tonle: [
      { id:'monsoon_flood',prob:0.10, type:'warning',  msg:'🌧️ La mousson inonde le terrain : entraînement perturbé.' },
      { id:'lake_blessing',prob:0.08, type:'positive', msg:'🌊 Bénédiction du grand lac : un joueur récupère plus vite.' },
    ],
    prey: [
      { id:'forest_spirit',prob:0.08, type:'positive', msg:'🌿 Un esprit de la forêt veille : blessure évitée de justesse.' },
      { id:'remote_travel',prob:0.10, type:'warning',  msg:'🚌 Long déplacement en brousse : effectif fatigué au retour.' },
    ],
  },
};

// Exposer en global (chargé via <script> avant worlds_index.js).
if(typeof window !== 'undefined'){ window.RORANG = RORANG; }
