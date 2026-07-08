// ═══════════════════════════════════════════════════════════
// PANTHALASSA.JS — Nation des Sirènes
// Héritières des Profondeurs
// ═══════════════════════════════════════════════════════════

const PANTHALASSA = {

  // ── Identité de la nation ──────────────────────────────────────────
  id: 'panthalassa',
  name: 'Panthalassa',
  subtitle: 'Héritières des Profondeurs',
  color: '#e040fb',
  flag: '✦',
  philosophy: 'Le Football de Panthalassa est aussi élégant qu\'imprévisible. Héritières des profondeurs, ses joueuses privilégient la fluidité, la technique et les enchaînements rapides plutôt que l\'impact physique. Chaque action semble couler de source, comme une vague qui contourne les obstacles avant de frapper au moment parfait.',

  // ── Profil joueur de base (sirène) ────────────────────────────────
  baseStats: {
    tec:  {min:55, max:90},  // technique naturellement haute
    spd:  {min:45, max:75},  // vitesse moyenne
    sht:  {min:40, max:70},  // tir moyen
    def:  {min:20, max:50},  // défense faible
    stam: {min:35, max:65},  // endurance faible
    res:  {min:20, max:45},  // résistance très faible
  },

  // ── Sorts de prédilection ─────────────────────────────────────────
  preferredSpells: ['ice','tech','pass','illusion','suggest','amitie','soin','pacif'],

  // ── Pyramide nationale ────────────────────────────────────────────
  pyramid: [
    {id:'d1',  name:'Division 1',  short:'D1', national:true,  teams:16, promoted:0,  relegated:3},
    {id:'d2',  name:'Division 2',  short:'D2', national:true,  teams:20, promoted:3,  relegated:4},
    {id:'d3',  name:'Division 3',  short:'D3', national:true,  teams:18, promoted:4,  relegated:4},
    {id:'r1',  name:'Régional 1',  short:'R1', national:false, teams:16, promoted:2,  relegated:3, groups_typical:4},
    {id:'r2',  name:'Régional 2',  short:'R2', national:false, teams:16, promoted:2,  relegated:3, groups_typical:8},
    {id:'r3',  name:'Régional 3',  short:'R3', national:false, teams:16, promoted:2,  relegated:3, groups_typical:16},
    {id:'dh',  name:'District',    short:'DH', national:false, teams:12, promoted:1,  relegated:0, groups_typical:32},
  ],

  // ── Compétitions nationales ───────────────────────────────────────
  cups: [
    {id:'coupe_panthalassa', name:'Coupe de Panthalassa', type:'knockout', open_to:'all'},
    {id:'coupe_ligue',       name:'Coupe de la Ligue',    type:'knockout', open_to:'d1_d2_d3'},
    {id:'supercoupe',        name:'Supercoupe Impériale', type:'single',   open_to:'d1_winner_cup_winner'},
  ],

  // ── Compétitions européennes / continentales ──────────────────────
  continental: [
    {id:'ligue_des_mers',   name:'Ligue des Mers',    slots:'d1_top4',   prestige:5},
    {id:'coupe_des_abysses',name:'Coupe des Abysses', slots:'d1_5_to_8', prestige:3},
  ],

  // ── Régions ───────────────────────────────────────────────────────
  regions: [
    {
      id: 'thalassyr',
      name: 'Thalassyr',
      type: 'Capitale Impériale',
      wealth: 3,
      talent: 3,
      population: 5,
      color: '#8840e0',
      desc: 'La capitale de l\'empire. Concurrence maximale, clubs historiques, formation d\'élite. Le plus dur à percer mais le plus prestigieux.',
      pyramid: { district_groups:4, has_r3:true, has_r2:true, has_r1:true },
      traits: { elite_formation:true, max_competition:true, historic_clubs:true },
      statMods: { tec:+10, spd:+5, sht:+5, def:0, stam:0, res:-5 },
      names: ['Nereis','Thaleia','Calypso','Amphitrite','Galatea','Sirena','Marinella','Ondine','Undine','Nixie','Lorelei','Melusine','Morgana','Nausicaa','Thessaly','Océane','Nérée','Mérella'],
      clubNames: ['SC Thalassyr','FC Impérial','AS Couronne','Olympe Thalassyr','RC des Abysses','FC Profondeurs','AS Marée Haute','SC Sirène Dorée','RC Impérial','FC Cour Royale','AS Vague Bleue','SC Neptune','FC Étoile des Mers','AS Thalassa','RC Fondateur','SC Ancienne Garde'],
      spellBonus: [],
    },
    {
      id: 'coraïrai',
      name: 'CoraÏraï',
      type: 'Principauté Insulaire',
      wealth: 5,
      talent: 1,
      population: 1,
      color: '#e91e63',
      desc: 'Principauté insulaire très riche. Achète ses stars, peu de joueurs locaux. Possède un District Honneur déconnecté de la pyramide nationale.',
      pyramid: { district_groups:0, has_dh:true, dh_disconnected:true, has_r3:true, has_r2:true, has_r1:true },
      traits: { buys_stars:true, few_locals:true, luxury_wages:true },
      statMods: { tec:+5, spd:0, sht:0, def:-5, stam:-5, res:+5 },
      names: ['Coralie','Iridessa','Aqualina','Crystelle','Perline','Saphira','Émera','Rubine','Topaze','Diamante','Coralis','Irina','Aqua','Crysta','Perla'],
      clubNames: ['AS Principauté','FC CoraÏraï','SC Île Dorée','RC des Coraux','AS Palais','FC Émeraude','SC Perle','RC Azur Profond','AS Diamant','FC Saphir'],
      spellBonus: [],
    },
    {
      id: 'mai',
      name: 'Principauté de Maï',
      type: 'Principauté',
      wealth: 3,
      talent: 2,
      population: 3,
      color: '#ff9800',
      desc: 'Principauté moyenne. Attention aux contrats douteux et propositions de trucage — la corruption y est plus présente.',
      pyramid: { district_groups:2, has_r3:true, has_r2:true, has_r1:true },
      traits: { corruption_risk:true, match_fixing:true },
      statMods: { tec:+5, spd:+5, sht:0, def:0, stam:0, res:0 },
      names: ['Maïa','Mairelle','Maïlys','Maïwenn','Maïna','Maïté','Maïlis','Maïka','Maïken','Maïlou','Maïra','Maïssa','Maïwen','Maïko','Maïell'],
      clubNames: ['FC Principauté Maï','AS Maïenne','SC du Port','RC Maï City','AS Brume','FC Tempête','SC Vague','RC Maï United','AS Corsaire','FC Capitaine'],
      spellBonus: [],
    },
    {
      id: 'neria',
      name: 'Principauté de Nérïa',
      type: 'Principauté',
      wealth: 3,
      talent: 2,
      population: 2,
      color: '#9c27b0',
      desc: 'Principauté mystique. Rare mais réel : tomber sur une pépite aux sorts exceptionnellement puissants. La magie y est plus intense.',
      pyramid: { district_groups:1, has_r3:true, has_r2:true, has_r1:true },
      traits: { gem_chance:true, high_magic:true },
      statMods: { tec:+8, spd:-5, sht:+5, def:-5, stam:0, res:+5, bonus_spell_power:+15 },
      names: ['Nérissa','Nereid','Mystara','Arcania','Runalia','Sigilia','Crystana','Opalina','Amethys','Saphirelle','Nérys','Runa','Mystia','Arcan','Sigil'],
      clubNames: ['AS Nérïa','FC Mystique','SC Enchantée','RC des Sorcières','AS Runic','FC Arcane','SC Sigil','RC Nérïa United','AS Cristal','FC Onyx'],
      spellBonus: ['eldritch','fireball','domination','transe'],
    },
    {
      id: 'mersbenie',
      name: 'Les Mers Bénies',
      type: 'Région Bénie',
      wealth: 3,
      talent: 2,
      population: 3,
      color: '#18c860',
      desc: 'Région protégée par les dieux marins. Événements positifs plus fréquents, blessures rares, moral naturellement élevé.',
      pyramid: { district_groups:3, has_r3:true, has_r2:true, has_r1:true },
      traits: { positive_events:true, low_injuries:true, high_morale:true },
      statMods: { tec:+5, spd:+5, sht:0, def:+5, stam:+10, res:+10 },
      names: ['Bénie','Grâcia','Lumina','Sérena','Harmonya','Pacifica','Tranquilla','Bénédice','Grâcielle','Lumielle','Béatrice','Sérénia','Harmona','Pacia','Tranqua'],
      clubNames: ['FC Mers Bénies','AS Bénie','SC Grâce Divine','RC Protégée','AS Lumière','FC Sérénité','SC Harmonie','RC Bénédiction','AS Paix','FC Flot Béni'],
      spellBonus: ['heal','soin','amitie'],
    },
    {
      id: 'velmara',
      name: 'Velmara',
      type: 'Région Chaotique',
      wealth: 2,
      talent: 2,
      population: 2,
      color: '#ff5722',
      desc: 'Région imprévisible. Beaucoup de sorts mais joueurs instables — un match à Velmara peut tout basculer dans un sens comme dans l\'autre.',
      pyramid: { district_groups:1, has_r3:true, has_r2:true, has_r1:true },
      traits: { chaotic_players:true, many_spells:true, volatile_morale:true, unpredictable_matches:true },
      statMods: { tec:+10, spd:0, sht:+5, def:-10, stam:-5, res:-5, extra_spells:1, stat_variance:+15 },
      names: ['Tempêta','Foudrine','Éclairia','Tornada','Chaosa','Délira','Foufella','Impréva','Turbula','Cyclona','Tempête','Foudra','Éclair','Torna','Chaos'],
      clubNames: ['FC Chaos','AS Tempête','SC Folie','RC Velmara','AS Tornade','FC Éclair','SC Foudre','RC Ouragan','AS Délire','FC Imprévu'],
      spellBonus: ['tornado','folie','charme','transe','deluge'],
    },
    {
      id: 'tydai',
      name: 'Tydaï',
      type: 'Immensité Déserte',
      wealth: 1,
      talent: 1,
      population: 1,
      color: '#795548',
      desc: 'Immense territoire presque vide. Beaucoup de groupes de District mais peu d\'équipes dedans. Les play-offs de montée y sont quasi fermés.',
      pyramid: { district_groups:6, few_teams_per_group:true, has_r3:true, has_r2:true, has_r1:true, closed_playoffs:true },
      traits: { sparse_population:true, hard_promotion:true, low_budget:true },
      statMods: { tec:-5, spd:+10, sht:0, def:+5, stam:+15, res:+10 },
      names: ['Duna','Miragea','Sabline','Ventara','Errantia','Horizona','Oasine','Désertine','Nomada','Vastine','Dune','Mirage','Sable','Vent','Errant'],
      clubNames: ['FC Désert','AS Sable','SC Vent Vide','RC Tydaï','AS Horizon','FC Errant','SC Mirage','RC Dune','AS Oasis','FC Lointain'],
      spellBonus: [],
    },
    {
      id: 'iledublob',
      name: 'L\'Île du Blob',
      type: 'Grande Île',
      wealth: 3,
      talent: 2,
      population: 4,
      color: '#4caf50',
      desc: 'Grande île disciplinée. Peu de mages mais ceux qui le sont maîtrisent parfaitement leurs sorts. Défense solide, jeu organisé.',
      pyramid: { district_groups:2, has_r3:true, has_r2:true, has_r1:true },
      traits: { disciplined:true, few_mages:true, solid_defense:true },
      statMods: { tec:0, spd:0, sht:-5, def:+10, stam:+5, res:+10, spell_accuracy:+20, fewer_spells:true },
      names: ['Solida','Défense','Rempartia','Bouclina','Fortessa','Discipla','Gardienne','Robusta','Solidine','Fermina','Solide','Rempart','Bouclier','Forte','Gardée'],
      clubNames: ['FC Blob','AS Île Verte','SC Disciplinée','RC du Blob','AS Forteresse','FC Rempart','SC Bouclier','RC Blob United','AS Défense','FC Solide'],
      spellBonus: ['shield','tornado'],
    },
    {
      id: 'iledazur',
      name: 'L\'Île d\'Azur',
      type: 'Métropole Insulaire',
      wealth: 5,
      talent: 1,
      population: 5,
      color: '#00bcd4',
      desc: 'Île très peuplée et très riche. Cosmopolite — profils non-sirènes possibles (humains, etc.). Jusqu\'à 8 groupes de DH. La Cité d\'Azur concentre les gros clubs — difficile de s\'y imposer mais très lucratif.',
      pyramid: { district_groups:8, has_r3:true, has_r2:true, has_r1:true, has_cite:true },
      traits: { cosmopolitan:true, non_siren_players:true, hard_to_break_in:true, very_lucrative:true, cite_dazur:true },
      statMods: { tec:+5, spd:+5, sht:+5, def:0, stam:0, res:0, non_siren_chance:0.25 },
      names: ['Azurina','Cosmina','Métropola','Lumina','Élégance','Prestiga','Cristallina','Céruléa','Turquoise','Saphira','Topazina','Amétrine','Opalia','Perline','Nacrine','Émera'],
      clubNames: ['FC Azur','AS Cité d\'Azur','SC Métropole','RC Île d\'Azur','AS Cosmopolite','FC Diamant Bleu','SC Azur Elite','RC Prestige','AS Élégance','FC Grand Bleu','SC Lumière Azur','RC Horizon','AS Mer Cristal','FC Ciel Bleu','SC Palais d\'Azur','RC Étoile Azur'],
      spellBonus: [],
    },
    {
      id: 'solgrath',
      name: 'Duché de Solgrath',
      type: 'Duché',
      wealth: 3,
      talent: 2,
      population: 3,
      color: '#607d8b',
      desc: 'Région équilibrée sans particularité extrême. Idéale pour débuter une carrière — compétitive sans être hostile.',
      pyramid: { district_groups:2, has_r3:true, has_r2:true, has_r1:true },
      traits: { vanilla:true, balanced:true, good_for_beginners:true },
      statMods: { tec:0, spd:0, sht:0, def:0, stam:0, res:0 },
      names: ['Solange','Grath','Équilia','Balancia','Normala','Stabina','Classica','Régula','Solide','Standard','Sola','Gratha','Équil','Balanc','Norma'],
      clubNames: ['FC Solgrath','AS Duché','SC Équilibre','RC Solgrath City','AS Classique','FC Standard','SC Régulier','RC Moyen','AS Stable','FC Solide'],
      spellBonus: [],
    },
    {
      id: 'peiryn',
      name: 'Comté de Peïryn',
      type: 'Petit Comté',
      wealth: 2,
      talent: 1,
      population: 1,
      color: '#ff9800',
      desc: 'Petit comté facile à dominer au niveau régional. Mais le mur national est réel : les clubs de Peïryn peinent à rivaliser en D3 et au-dessus.',
      pyramid: { district_groups:0, has_r3:true, has_r2:true, has_r1:false },
      traits: { easy_regional:true, national_wall:true, small_budgets:true },
      statMods: { tec:0, spd:+5, sht:-5, def:+5, stam:+5, res:0 },
      names: ['Peïra','Comtesse','Locale','Rurale','Campagne','Clocher','Village','Hameau','Bourg','Canton','Peïris','Comta','Locala','Rural','Campa'],
      clubNames: ['FC Peïryn','AS Comté','SC Local','RC Peïryn','AS Quartier','FC Village','SC Clocher','RC Campagne'],
      spellBonus: [],
    },
  ],

  // ── Races disponibles ─────────────────────────────────────────────
  races: {
    siren: {
      name: 'Sirène',
      emoji: '🧜',
      description: 'Race dominante de Panthalassa. Technique élevée, physique faible.',
      statOverride: null, // utilise baseStats
    },
    human: {
      name: 'Humaine',
      emoji: '👤',
      description: 'Rare à Panthalassa sauf à l\'Île d\'Azur. Plus physique, moins technique.',
      statOverride: {
        tec:  {min:35, max:65},
        spd:  {min:50, max:80},
        sht:  {min:45, max:75},
        def:  {min:45, max:75},
        stam: {min:55, max:85},
        res:  {min:55, max:85},
      },
    },
  },

  // ── Événements spéciaux par région ───────────────────────────────
  regionEvents: {
    mersbenie: [
      {id:'divine_luck',     prob:0.15, type:'positive', msg:'🌊 Une vague de bonne fortune — un joueur récupère plus vite de sa blessure !'},
      {id:'sea_blessing',    prob:0.10, type:'positive', msg:'🌊 Les dieux marins sourient — moral de l\'équipe au maximum cette semaine !'},
      {id:'sponsor_bonus',   prob:0.08, type:'finance',  msg:'🌊 Journée bénie — un sponsor offre un bonus inattendu !', amount:500},
    ],
    mai: [
      {id:'corruption_offer',prob:0.08, type:'warning',  msg:'⚠️ Une proposition suspecte est arrivée dans votre bureau...'},
      {id:'match_fix',       prob:0.04, type:'warning',  msg:'⚠️ On vous approche pour "arranger" le résultat du prochain match...'},
    ],
    neria: [
      {id:'gem_discovered',  prob:0.03, type:'gem',      msg:'💎 Le scout a découvert une pépite exceptionnelle !'},
      {id:'magic_surge',     prob:0.10, type:'positive', msg:'✨ Surge magique — les sorts de votre équipe sont plus puissants ce match !'},
    ],
    velmara: [
      {id:'chaos_boost',     prob:0.12, type:'random',   msg:'🌪️ Le chaos de Velmara — tout peut arriver ce match !'},
      {id:'spell_frenzy',    prob:0.08, type:'positive', msg:'⚡ Frénésie magique — vos joueuses ont 2x plus de MP ce match !'},
      {id:'implosion',       prob:0.06, type:'negative', msg:'💥 Implosion — une joueuse perd le contrôle de ses sorts !'},
    ],
    tydai: [
      {id:'isolation',       prob:0.10, type:'negative', msg:'🏜️ L\'isolement pèse — moral de l\'équipe en baisse cette semaine.'},
    ],
    iledazur: [
      {id:'cosmopolitan',    prob:0.08, type:'recruit',  msg:'🌍 Une joueuse non-sirène cherche un club — opportunité de recrutement !'},
      {id:'media_attention', prob:0.07, type:'positive', msg:'📺 La presse de la Cité d\'Azur couvre votre club — réputation +5 !'},
    ],
    thalassyr: [
      {id:'imperial_eye',    prob:0.05, type:'positive', msg:'👁️ L\'Impératrice suit vos progrès — réputation +10 en cas de victoire !'},
    ],
    coraïrai: [
      {id:'rich_sponsor',    prob:0.10, type:'finance',  msg:'💰 Un mécène de CoraÏraï propose un partenariat lucratif !', amount:2000},
      {id:'star_available',  prob:0.06, type:'recruit',  msg:'⭐ Une star étrangère cherche un club à CoraÏraï !'},
    ],
    iledublob: [
      {id:'discipline_bonus',prob:0.12, type:'positive', msg:'🛡️ Discipline exemplaire — aucun carton jaune cette semaine !'},
    ],
    mersbenie: [
      {id:'divine_luck', prob:0.15, type:'positive', msg:'🌊 Une vague de bonne fortune !'},
    ],
    peiryn: [
      {id:'underdog',        prob:0.10, type:'positive', msg:'💪 Effet Peïryn — en tant qu\'outsider, votre équipe est survoltée !'},
    ],
  },

};

// Freeze pour éviter les modifications accidentelles
Object.freeze(PANTHALASSA);
