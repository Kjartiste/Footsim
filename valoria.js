// ═══════════════════════════════════════════════════════════
// VALORIA.JS — Nation humaine cosmopolite
// « Reconstruite, mais jamais tout à fait guérie »
// ═══════════════════════════════════════════════════════════
// Petite nation prise entre deux superpuissances (Panthalassyr et Skullung).
// Il y a 35 ans, une guerre qui n'était pas la sienne l'a ravagée : commerce
// interrompu, exils massifs, clubs ruinés. La paix revenue, Valoria s'est
// relevée — cosmopolite, métissée, résiliente — mais certains clubs ne s'en
// sont jamais remis. Deux régions, une seule ligue professionnelle.
// ═══════════════════════════════════════════════════════════

const VALORIA = {

  // ── Identité de la nation ──────────────────────────────────────────
  id: 'valoria',
  name: 'Valoria',
  subtitle: 'Reconstruite, jamais tout à fait guérie',
  color: '#2e8b8b',
  flag: '⚑',
  philosophy: "Le football valorien est le produit d'un pays meurtri puis rebâti par des mains venues d'ailleurs. Cosmopolite par nécessité, il mêle les écoles et les styles : la rigueur d'un bloc bas héritée des années de survie, et l'audace des nouvelles générations qui n'ont connu que la paix. On y joue avec le cœur autant qu'avec la tête — parce qu'ici, un club n'est jamais seulement un club.",

  // ── Profil joueur de base (humain, équilibré) ─────────────────────
  baseStats: {
    tec:  {min:40, max:72},
    spd:  {min:42, max:74},
    sht:  {min:40, max:72},
    def:  {min:42, max:74},
    stam: {min:48, max:80},
    res:  {min:45, max:78},
  },

  // Valoria étant cosmopolite, une grande part des joueurs vient d'ailleurs.
  races: {
    human: { statOverride: null },
  },

  // ── Sorts de prédilection (sobres : peu de magie, pays humain) ─────
  preferredSpells: ['tech','pass','shield','soin','heal'],

  // ── Pyramide nationale (compacte : 1 ligue pro + étages amateurs) ──
  pyramid: [
    {id:'d1',  name:'Ligue Valorienne', short:'LV', national:true,  teams:14, promoted:0, relegated:2},
    {id:'r1',  name:'Régional 1',        short:'R1', national:false, teams:16, promoted:2, relegated:3, groups_typical:2},
    {id:'r2',  name:'Régional 2',        short:'R2', national:false, teams:16, promoted:2, relegated:3, groups_typical:4},
    {id:'dh',  name:'District',          short:'DH', national:false, teams:12, promoted:1, relegated:0, groups_typical:8},
  ],

  // ── Compétitions nationales ───────────────────────────────────────
  cups: [
    {id:'coupe_valoria', name:'Coupe de Valoria', type:'knockout', open_to:'all'},
    {id:'supercoupe_val', name:'Supercoupe Valorienne', type:'single', open_to:'d1_winner_cup_winner'},
  ],

  // ── Compétitions continentales ────────────────────────────────────
  continental: [
    {id:'coupe_des_nations', name:'Coupe des Nations Libres', slots:'d1_top3', prestige:3},
  ],

  // ── Régions (deux, contrastées) ───────────────────────────────────
  regions: [
    {
      id: 'valcourt',
      name: 'Valcourt',
      type: 'Capitale cosmopolite',
      wealth: 4,
      talent: 3,
      population: 4,
      color: '#2e8b8b',
      desc: "La capitale reconstruite, carrefour de peuples et de styles. On y croise toutes les écoles de football du continent. Clubs ambitieux, formation moderne, forte concurrence.",
      pyramid: { has_r2:true, has_r1:true, district_groups:2 },
      traits: { cosmopolitan:true, modern_formation:true },
      statMods: { tec:+5, spd:+3, sht:+2, def:0, stam:0, res:0, non_siren_chance:0.85 },
      names: ['Lena','Marko','Sofia','Diego','Amir','Yuki','Nadia','Elias','Tariq','Ines','Kofi','Milan','Aïcha','Rui','Nina','Omar','Vera','Sami'],
      clubNames: ['AS Horizon','RC Valcourt','FC Cosmopolite','Olympique de Valcourt','SC Renaissance','FC Métropole','AS Concorde','RC Union','FC Carrefour','SC Espérance','AS Nouveau Monde','RC Central','FC Liberté','SC Avenir'],
      spellBonus: [],
    },
    {
      id: 'brumefer',
      name: 'Brumefer',
      type: 'Bassin industriel meurtri',
      wealth: 1,
      talent: 2,
      population: 3,
      color: '#7a5c3a',
      desc: "L'ancien cœur industriel, en première ligne pendant la guerre. Usines fermées, exils, clubs historiques ruinés. On y forme des joueurs durs au mal, forgés par l'adversité — et fidèles à leurs couleurs coûte que coûte.",
      pyramid: { has_r2:true, has_r1:true, district_groups:2 },
      traits: { hardened:true, loyal_locals:true, low_budget:true },
      statMods: { tec:-3, spd:0, sht:0, def:+5, stam:+6, res:+6, non_siren_chance:0.9 },
      names: ['Viktor','Mira','Dragan','Halima','Bruno','Petra','Kasimir','Yara','Stefan','Djamila','Anton','Lior','Grigor','Fatou','Radek','Selim','Bojan','Nora'],
      clubNames: ['FC Brumefer','AS Fonderie','SC Ouvrier','RC des Forges','AS Rempart','FC Charbon','SC Acier','RC Vieux Stade','AS Fidèle','FC Bastion','SC Résistance','RC Fumée'],
      spellBonus: [],
    },
  ],

  // ── Événements régionaux (optionnels, format Panthalassa) ──────────
  regionalEvents: {
    valcourt: [
      {id:'transfer_window', prob:0.10, type:'recruit', msg:"🌍 Valcourt attire : une joueuse étrangère cherche un club cosmopolite !"},
      {id:'media_spotlight', prob:0.08, type:'positive', msg:"📺 Les médias de la capitale braquent leurs projecteurs sur votre club — réputation +5 !"},
    ],
    brumefer: [
      {id:'loyal_crowd', prob:0.12, type:'positive', msg:"🖤 Les fidèles de Brumefer remplissent le vieux stade malgré tout — moral au maximum !"},
      {id:'budget_strain', prob:0.10, type:'warning', msg:"⚠️ Les caisses de Brumefer sont vides — attention aux dépenses cette semaine."},
    ],
  },
};

if(typeof window!=='undefined'){ window.VALORIA = VALORIA; }
