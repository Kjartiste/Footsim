// ═══════════════════════════════════════════════════════════
// PILIER_TEAMS.JS — 200 clubs du Pilier Céleste, en Maisons
// Généré : 10 divisions × 20 clubs. Chaque club appartient à une Maison ;
// deux clubs d'une même Maison ne partagent jamais une division.
// ═══════════════════════════════════════════════════════════

const PILIER_DIVISIONS = {
  gtd: {name:"Ligue du Grand Trône Divin", region:null, tier:"pro", order:0, level:"d1"},
  zenith: {name:"Ligue du Zénith", region:null, tier:"pro", order:1, level:"d2"},
  cel1: {name:"Première Ligue Céleste", region:'Le Pilier', tier:"regional", order:2, level:"d3"},
  cel2: {name:"Deuxième Ligue Céleste", region:'Le Pilier', tier:"regional", order:3, level:"r1"},
  cel3: {name:"Troisième Ligue Céleste", region:'Le Pilier', tier:"regional", order:4, level:"r2"},
  cel4: {name:"Quatrième Ligue Céleste", region:'Le Pilier', tier:"regional", order:5, level:"r3"},
  fond1: {name:"Première Ligue des Fondations", region:'Le Pilier', tier:"district", order:6, level:"dh"},
  fond2: {name:"Deuxième Ligue des Fondations", region:'Le Pilier', tier:"district", order:7, level:"dh"},
  fond3: {name:"Troisième Ligue des Fondations", region:'Le Pilier', tier:"district", order:8, level:"dh"},
  fond4: {name:"Quatrième Ligue des Fondations", region:'Le Pilier', tier:"district", order:9, level:"dh"},
};

const PILIER_TEAMS = [
  // ── Ligue du Grand Trône Divin (20 clubs) ──
  {name:"Lyra Vigilia",color:'#6a7a8a',division:'gtd',region:'Le Pilier',tier:'pro',house:"Lyra",houseColor:'#c0a0d0',branch:"Vigilia",level:'d1'},
  {name:"Ventus Primus",color:'#7ec8e3',division:'gtd',region:'Le Pilier',tier:'pro',house:"Ventus",houseColor:'#7ec8e3',branch:"Primus",level:'d1'},
  {name:"Aqua Primus",color:'#3a9ad0',division:'gtd',region:'Le Pilier',tier:'pro',house:"Aqua",houseColor:'#3a9ad0',branch:"Primus",level:'d1'},
  {name:"Fulgur Primus",color:'#e8d44a',division:'gtd',region:'Le Pilier',tier:'pro',house:"Fulgur",houseColor:'#e8d44a',branch:"Primus",level:'d1'},
  {name:"Terra Primus",color:'#8a7a4a',division:'gtd',region:'Le Pilier',tier:'pro',house:"Terra",houseColor:'#8a7a4a',branch:"Primus",level:'d1'},
  {name:"Aether Primus",color:'#d4af37',division:'gtd',region:'Le Pilier',tier:'pro',house:"Aether",houseColor:'#d4af37',branch:"Primus",level:'d1'},
  {name:"Umbra Primus",color:'#6a4a8a',division:'gtd',region:'Le Pilier',tier:'pro',house:"Umbra",houseColor:'#6a4a8a',branch:"Primus",level:'d1'},
  {name:"Ignis Primus",color:'#e0502f',division:'gtd',region:'Le Pilier',tier:'pro',house:"Ignis",houseColor:'#e0502f',branch:"Primus",level:'d1'},
  {name:"Caelum Primus",color:'#a0d0f0',division:'gtd',region:'Le Pilier',tier:'pro',house:"Caelum",houseColor:'#a0d0f0',branch:"Primus",level:'d1'},
  {name:"Astra Primus",color:'#c0a0e0',division:'gtd',region:'Le Pilier',tier:'pro',house:"Astra",houseColor:'#c0a0e0',branch:"Primus",level:'d1'},
  {name:"Aurora Primus",color:'#e88ab0',division:'gtd',region:'Le Pilier',tier:'pro',house:"Aurora",houseColor:'#e88ab0',branch:"Primus",level:'d1'},
  {name:"Seraph Primus",color:'#f0e0c0',division:'gtd',region:'Le Pilier',tier:'pro',house:"Seraph",houseColor:'#f0e0c0',branch:"Primus",level:'d1'},
  {name:"Nox Primus",color:'#4a4a6a',division:'gtd',region:'Le Pilier',tier:'pro',house:"Nox",houseColor:'#4a4a6a',branch:"Primus",level:'d1'},
  {name:"Abyssus Primus",color:'#3a2a4a',division:'gtd',region:'Le Pilier',tier:'pro',house:"Abyssus",houseColor:'#3a2a4a',branch:"Primus",level:'d1'},
  {name:"Gehenna Primus",color:'#7a2020',division:'gtd',region:'Le Pilier',tier:'pro',house:"Gehenna",houseColor:'#7a2020',branch:"Primus",level:'d1'},
  {name:"Infernus Primus",color:'#c03020',division:'gtd',region:'Le Pilier',tier:'pro',house:"Infernus",houseColor:'#c03020',branch:"Primus",level:'d1'},
  {name:"Pavo Secundus",color:'#3060a0',division:'gtd',region:'Le Pilier',tier:'pro',house:"Pavo",houseColor:'#3060a0',branch:"Secundus",level:'d1'},
  {name:"Orion Secundus",color:'#5070c0',division:'gtd',region:'Le Pilier',tier:'pro',house:"Orion",houseColor:'#5070c0',branch:"Secundus",level:'d1'},
  {name:"Draco Excelsior",color:'#e8d48a',division:'gtd',region:'Le Pilier',tier:'pro',house:"Draco",houseColor:'#307050',branch:"Excelsior",level:'d1'},
  {name:"Sanctus Primus",color:'#e8e0d0',division:'gtd',region:'Le Pilier',tier:'pro',house:"Sanctus",houseColor:'#e8e0d0',branch:"Primus",level:'d1'},
  // ── Ligue du Zénith (20 clubs) ──
  {name:"Fulgur Custodes",color:'#8a9ba8',division:'zenith',region:'Le Pilier',tier:'pro',house:"Fulgur",houseColor:'#e8d44a',branch:"Custodes",level:'d2'},
  {name:"Ignis Nova",color:'#9ad8b0',division:'zenith',region:'Le Pilier',tier:'pro',house:"Ignis",houseColor:'#e0502f',branch:"Nova",level:'d2'},
  {name:"Luna Primus",color:'#c0c0d8',division:'zenith',region:'Le Pilier',tier:'pro',house:"Luna",houseColor:'#c0c0d8',branch:"Primus",level:'d2'},
  {name:"Lyra Excelsior",color:'#e8d48a',division:'zenith',region:'Le Pilier',tier:'pro',house:"Lyra",houseColor:'#c0a0d0',branch:"Excelsior",level:'d2'},
  {name:"Gloria Primus",color:'#e0c040',division:'zenith',region:'Le Pilier',tier:'pro',house:"Gloria",houseColor:'#e0c040',branch:"Primus",level:'d2'},
  {name:"Ferox Primus",color:'#a04030',division:'zenith',region:'Le Pilier',tier:'pro',house:"Ferox",houseColor:'#a04030',branch:"Primus",level:'d2'},
  {name:"Mortis Primus",color:'#503050',division:'zenith',region:'Le Pilier',tier:'pro',house:"Mortis",houseColor:'#503050',branch:"Primus",level:'d2'},
  {name:"Abyssus Secundus",color:'#3a2a4a',division:'zenith',region:'Le Pilier',tier:'pro',house:"Abyssus",houseColor:'#3a2a4a',branch:"Secundus",level:'d2'},
  {name:"Grus Excelsior",color:'#e8d48a',division:'zenith',region:'Le Pilier',tier:'pro',house:"Grus",houseColor:'#b0a090',branch:"Excelsior",level:'d2'},
  {name:"Aquila Excelsior",color:'#e8d48a',division:'zenith',region:'Le Pilier',tier:'pro',house:"Aquila",houseColor:'#b08040',branch:"Excelsior",level:'d2'},
  {name:"Vulpes Excelsior",color:'#e8d48a',division:'zenith',region:'Le Pilier',tier:'pro',house:"Vulpes",houseColor:'#c07040',branch:"Excelsior",level:'d2'},
  {name:"Tenebris Primus",color:'#302040',division:'zenith',region:'Le Pilier',tier:'pro',house:"Tenebris",houseColor:'#302040',branch:"Primus",level:'d2'},
  {name:"Lupus Excelsior",color:'#e8d48a',division:'zenith',region:'Le Pilier',tier:'pro',house:"Lupus",houseColor:'#607080',branch:"Excelsior",level:'d2'},
  {name:"Aqua Excelsior",color:'#e8d48a',division:'zenith',region:'Le Pilier',tier:'pro',house:"Aqua",houseColor:'#3a9ad0',branch:"Excelsior",level:'d2'},
  {name:"Corvus Excelsior",color:'#e8d48a',division:'zenith',region:'Le Pilier',tier:'pro',house:"Corvus",houseColor:'#404050',branch:"Excelsior",level:'d2'},
  {name:"Sol Primus",color:'#f0a020',division:'zenith',region:'Le Pilier',tier:'pro',house:"Sol",houseColor:'#f0a020',branch:"Primus",level:'d2'},
  {name:"Seraph Excelsior",color:'#e8d48a',division:'zenith',region:'Le Pilier',tier:'pro',house:"Seraph",houseColor:'#f0e0c0',branch:"Excelsior",level:'d2'},
  {name:"Vita Primus",color:'#40a060',division:'zenith',region:'Le Pilier',tier:'pro',house:"Vita",houseColor:'#40a060',branch:"Primus",level:'d2'},
  {name:"Aurora Secundus",color:'#e88ab0',division:'zenith',region:'Le Pilier',tier:'pro',house:"Aurora",houseColor:'#e88ab0',branch:"Secundus",level:'d2'},
  {name:"Draco Secundus",color:'#307050',division:'zenith',region:'Le Pilier',tier:'pro',house:"Draco",houseColor:'#307050',branch:"Secundus",level:'d2'},
  // ── Première Ligue Céleste (20 clubs) ──
  {name:"Ferox Secundus",color:'#a04030',division:'cel1',region:'Le Pilier',tier:'regional',house:"Ferox",houseColor:'#a04030',branch:"Secundus",level:'d3'},
  {name:"Luna Secundus",color:'#c0c0d8',division:'cel1',region:'Le Pilier',tier:'regional',house:"Luna",houseColor:'#c0c0d8',branch:"Secundus",level:'d3'},
  {name:"Gloria Excelsior",color:'#e8d48a',division:'cel1',region:'Le Pilier',tier:'regional',house:"Gloria",houseColor:'#e0c040',branch:"Excelsior",level:'d3'},
  {name:"Ignis Secundus",color:'#e0502f',division:'cel1',region:'Le Pilier',tier:'regional',house:"Ignis",houseColor:'#e0502f',branch:"Secundus",level:'d3'},
  {name:"Vulpes Secundus",color:'#c07040',division:'cel1',region:'Le Pilier',tier:'regional',house:"Vulpes",houseColor:'#c07040',branch:"Secundus",level:'d3'},
  {name:"Seraph Secundus",color:'#f0e0c0',division:'cel1',region:'Le Pilier',tier:'regional',house:"Seraph",houseColor:'#f0e0c0',branch:"Secundus",level:'d3'},
  {name:"Aqua Secundus",color:'#3a9ad0',division:'cel1',region:'Le Pilier',tier:'regional',house:"Aqua",houseColor:'#3a9ad0',branch:"Secundus",level:'d3'},
  {name:"Aurora Excelsior",color:'#e8d48a',division:'cel1',region:'Le Pilier',tier:'regional',house:"Aurora",houseColor:'#e88ab0',branch:"Excelsior",level:'d3'},
  {name:"Corvus Primus",color:'#404050',division:'cel1',region:'Le Pilier',tier:'regional',house:"Corvus",houseColor:'#404050',branch:"Primus",level:'d3'},
  {name:"Draco Primus",color:'#307050',division:'cel1',region:'Le Pilier',tier:'regional',house:"Draco",houseColor:'#307050',branch:"Primus",level:'d3'},
  {name:"Taurus Primus",color:'#906040',division:'cel1',region:'Le Pilier',tier:'regional',house:"Taurus",houseColor:'#906040',branch:"Primus",level:'d3'},
  {name:"Phoenix Primus",color:'#e06020',division:'cel1',region:'Le Pilier',tier:'regional',house:"Phoenix",houseColor:'#e06020',branch:"Primus",level:'d3'},
  {name:"Leo Primus",color:'#d0a030',division:'cel1',region:'Le Pilier',tier:'regional',house:"Leo",houseColor:'#d0a030',branch:"Primus",level:'d3'},
  {name:"Fulgur Secundus",color:'#e8d44a',division:'cel1',region:'Le Pilier',tier:'regional',house:"Fulgur",houseColor:'#e8d44a',branch:"Secundus",level:'d3'},
  {name:"Lyra Custodes",color:'#8a9ba8',division:'cel1',region:'Le Pilier',tier:'regional',house:"Lyra",houseColor:'#c0a0d0',branch:"Custodes",level:'d3'},
  {name:"Lux Excelsior",color:'#e8d48a',division:'cel1',region:'Le Pilier',tier:'regional',house:"Lux",houseColor:'#f5e6a0',branch:"Excelsior",level:'d3'},
  {name:"Ventus Custodes",color:'#8a9ba8',division:'cel1',region:'Le Pilier',tier:'regional',house:"Ventus",houseColor:'#7ec8e3',branch:"Custodes",level:'d3'},
  {name:"Aquila Primus",color:'#b08040',division:'cel1',region:'Le Pilier',tier:'regional',house:"Aquila",houseColor:'#b08040',branch:"Primus",level:'d3'},
  {name:"Sol Excelsior",color:'#e8d48a',division:'cel1',region:'Le Pilier',tier:'regional',house:"Sol",houseColor:'#f0a020',branch:"Excelsior",level:'d3'},
  {name:"Serpens Ordo",color:'#c0a060',division:'cel1',region:'Le Pilier',tier:'regional',house:"Serpens",houseColor:'#409060',branch:"Ordo",level:'d3'},
  // ── Deuxième Ligue Céleste (20 clubs) ──
  {name:"Hydra Excelsior",color:'#e8d48a',division:'cel2',region:'Le Pilier',tier:'regional',house:"Hydra",houseColor:'#308070',branch:"Excelsior",level:'r1'},
  {name:"Lupus Primus",color:'#607080',division:'cel2',region:'Le Pilier',tier:'regional',house:"Lupus",houseColor:'#607080',branch:"Primus",level:'r1'},
  {name:"Serpens Primus",color:'#409060',division:'cel2',region:'Le Pilier',tier:'regional',house:"Serpens",houseColor:'#409060',branch:"Primus",level:'r1'},
  {name:"Leo Custodes",color:'#8a9ba8',division:'cel2',region:'Le Pilier',tier:'regional',house:"Leo",houseColor:'#d0a030',branch:"Custodes",level:'r1'},
  {name:"Umbra Secundus",color:'#6a4a8a',division:'cel2',region:'Le Pilier',tier:'regional',house:"Umbra",houseColor:'#6a4a8a',branch:"Secundus",level:'r1'},
  {name:"Terra Mercatoria",color:'#c8a84a',division:'cel2',region:'Le Pilier',tier:'regional',house:"Terra",houseColor:'#8a7a4a',branch:"Mercatoria",level:'r1'},
  {name:"Sanctus Mercatoria",color:'#c8a84a',division:'cel2',region:'Le Pilier',tier:'regional',house:"Sanctus",houseColor:'#e8e0d0',branch:"Mercatoria",level:'r1'},
  {name:"Gloria Nova",color:'#9ad8b0',division:'cel2',region:'Le Pilier',tier:'regional',house:"Gloria",houseColor:'#e0c040',branch:"Nova",level:'r1'},
  {name:"Aurora Nova",color:'#9ad8b0',division:'cel2',region:'Le Pilier',tier:'regional',house:"Aurora",houseColor:'#e88ab0',branch:"Nova",level:'r1'},
  {name:"Gehenna Ordo",color:'#c0a060',division:'cel2',region:'Le Pilier',tier:'regional',house:"Gehenna",houseColor:'#7a2020',branch:"Ordo",level:'r1'},
  {name:"Cygnus Primus",color:'#d0d0e0',division:'cel2',region:'Le Pilier',tier:'regional',house:"Cygnus",houseColor:'#d0d0e0',branch:"Primus",level:'r1'},
  {name:"Lyra Ordo",color:'#c0a060',division:'cel2',region:'Le Pilier',tier:'regional',house:"Lyra",houseColor:'#c0a0d0',branch:"Ordo",level:'r1'},
  {name:"Caelum Academia",color:'#7ec8e3',division:'cel2',region:'Le Pilier',tier:'regional',house:"Caelum",houseColor:'#a0d0f0',branch:"Academia",level:'r1'},
  {name:"Taurus Custodes",color:'#8a9ba8',division:'cel2',region:'Le Pilier',tier:'regional',house:"Taurus",houseColor:'#906040',branch:"Custodes",level:'r1'},
  {name:"Grus Primus",color:'#b0a090',division:'cel2',region:'Le Pilier',tier:'regional',house:"Grus",houseColor:'#b0a090',branch:"Primus",level:'r1'},
  {name:"Aquila Nova",color:'#9ad8b0',division:'cel2',region:'Le Pilier',tier:'regional',house:"Aquila",houseColor:'#b08040',branch:"Nova",level:'r1'},
  {name:"Pavo Primus",color:'#3060a0',division:'cel2',region:'Le Pilier',tier:'regional',house:"Pavo",houseColor:'#3060a0',branch:"Primus",level:'r1'},
  {name:"Orion Primus",color:'#5070c0',division:'cel2',region:'Le Pilier',tier:'regional',house:"Orion",houseColor:'#5070c0',branch:"Primus",level:'r1'},
  {name:"Ferox Excelsior",color:'#e8d48a',division:'cel2',region:'Le Pilier',tier:'regional',house:"Ferox",houseColor:'#a04030',branch:"Excelsior",level:'r1'},
  {name:"Vulpes Primus",color:'#c07040',division:'cel2',region:'Le Pilier',tier:'regional',house:"Vulpes",houseColor:'#c07040',branch:"Primus",level:'r1'},
  // ── Troisième Ligue Céleste (20 clubs) ──
  {name:"Sol Academia",color:'#7ec8e3',division:'cel3',region:'Le Pilier',tier:'regional',house:"Sol",houseColor:'#f0a020',branch:"Academia",level:'r2'},
  {name:"Tenebris Custodes",color:'#8a9ba8',division:'cel3',region:'Le Pilier',tier:'regional',house:"Tenebris",houseColor:'#302040',branch:"Custodes",level:'r2'},
  {name:"Lyra Academia",color:'#7ec8e3',division:'cel3',region:'Le Pilier',tier:'regional',house:"Lyra",houseColor:'#c0a0d0',branch:"Academia",level:'r2'},
  {name:"Aether Custodes",color:'#8a9ba8',division:'cel3',region:'Le Pilier',tier:'regional',house:"Aether",houseColor:'#d4af37',branch:"Custodes",level:'r2'},
  {name:"Pavo Nova",color:'#9ad8b0',division:'cel3',region:'Le Pilier',tier:'regional',house:"Pavo",houseColor:'#3060a0',branch:"Nova",level:'r2'},
  {name:"Lupus Secundus",color:'#607080',division:'cel3',region:'Le Pilier',tier:'regional',house:"Lupus",houseColor:'#607080',branch:"Secundus",level:'r2'},
  {name:"Terra Secundus",color:'#8a7a4a',division:'cel3',region:'Le Pilier',tier:'regional',house:"Terra",houseColor:'#8a7a4a',branch:"Secundus",level:'r2'},
  {name:"Gloria Academia",color:'#7ec8e3',division:'cel3',region:'Le Pilier',tier:'regional',house:"Gloria",houseColor:'#e0c040',branch:"Academia",level:'r2'},
  {name:"Taurus Academia",color:'#7ec8e3',division:'cel3',region:'Le Pilier',tier:'regional',house:"Taurus",houseColor:'#906040',branch:"Academia",level:'r2'},
  {name:"Hydra Secundus",color:'#308070',division:'cel3',region:'Le Pilier',tier:'regional',house:"Hydra",houseColor:'#308070',branch:"Secundus",level:'r2'},
  {name:"Ferox Academia",color:'#7ec8e3',division:'cel3',region:'Le Pilier',tier:'regional',house:"Ferox",houseColor:'#a04030',branch:"Academia",level:'r2'},
  {name:"Ursa Secundus",color:'#705040',division:'cel3',region:'Le Pilier',tier:'regional',house:"Ursa",houseColor:'#705040',branch:"Secundus",level:'r2'},
  {name:"Aquila Secundus",color:'#b08040',division:'cel3',region:'Le Pilier',tier:'regional',house:"Aquila",houseColor:'#b08040',branch:"Secundus",level:'r2'},
  {name:"Mortis Academia",color:'#7ec8e3',division:'cel3',region:'Le Pilier',tier:'regional',house:"Mortis",houseColor:'#503050',branch:"Academia",level:'r2'},
  {name:"Umbra Ordo",color:'#c0a060',division:'cel3',region:'Le Pilier',tier:'regional',house:"Umbra",houseColor:'#6a4a8a',branch:"Ordo",level:'r2'},
  {name:"Nox Custodes",color:'#8a9ba8',division:'cel3',region:'Le Pilier',tier:'regional',house:"Nox",houseColor:'#4a4a6a',branch:"Custodes",level:'r2'},
  {name:"Aurora Mercatoria",color:'#c8a84a',division:'cel3',region:'Le Pilier',tier:'regional',house:"Aurora",houseColor:'#e88ab0',branch:"Mercatoria",level:'r2'},
  {name:"Caelum Custodes",color:'#8a9ba8',division:'cel3',region:'Le Pilier',tier:'regional',house:"Caelum",houseColor:'#a0d0f0',branch:"Custodes",level:'r2'},
  {name:"Fulgur Vigilia",color:'#6a7a8a',division:'cel3',region:'Le Pilier',tier:'regional',house:"Fulgur",houseColor:'#e8d44a',branch:"Vigilia",level:'r2'},
  {name:"Leo Vigilia",color:'#6a7a8a',division:'cel3',region:'Le Pilier',tier:'regional',house:"Leo",houseColor:'#d0a030',branch:"Vigilia",level:'r2'},
  // ── Quatrième Ligue Céleste (20 clubs) ──
  {name:"Draco Ferrum",color:'#8a7a5a',division:'cel4',region:'Le Pilier',tier:'regional',house:"Draco",houseColor:'#307050',branch:"Ferrum",level:'r3'},
  {name:"Ventus Novus",color:'#9ad8b0',division:'cel4',region:'Le Pilier',tier:'regional',house:"Ventus",houseColor:'#7ec8e3',branch:"Nova",level:'r3'},
  {name:"Fulgur Sanctum",color:'#d8c8e8',division:'cel4',region:'Le Pilier',tier:'regional',house:"Fulgur",houseColor:'#e8d44a',branch:"Sanctum",level:'r3'},
  {name:"Sol Ordo",color:'#c0a060',division:'cel4',region:'Le Pilier',tier:'regional',house:"Sol",houseColor:'#f0a020',branch:"Ordo",level:'r3'},
  {name:"Pavo Ordo",color:'#c0a060',division:'cel4',region:'Le Pilier',tier:'regional',house:"Pavo",houseColor:'#3060a0',branch:"Ordo",level:'r3'},
  {name:"Ignis Tertius",color:'#9ad8b0',division:'cel4',region:'Le Pilier',tier:'regional',house:"Ignis",houseColor:'#e0502f',branch:"Nova",level:'r3'},
  {name:"Vita Custodes",color:'#8a9ba8',division:'cel4',region:'Le Pilier',tier:'regional',house:"Vita",houseColor:'#40a060',branch:"Custodes",level:'r3'},
  {name:"Gloria Mercatoria",color:'#c8a84a',division:'cel4',region:'Le Pilier',tier:'regional',house:"Gloria",houseColor:'#e0c040',branch:"Mercatoria",level:'r3'},
  {name:"Ursa Minor",color:'#9ad8b0',division:'cel4',region:'Le Pilier',tier:'regional',house:"Ursa",houseColor:'#705040',branch:"Nova",level:'r3'},
  {name:"Aquila Academia",color:'#7ec8e3',division:'cel4',region:'Le Pilier',tier:'regional',house:"Aquila",houseColor:'#b08040',branch:"Academia",level:'r3'},
  {name:"Lux Vigilia",color:'#6a7a8a',division:'cel4',region:'Le Pilier',tier:'regional',house:"Lux",houseColor:'#f5e6a0',branch:"Vigilia",level:'r3'},
  {name:"Serpens Sanctum",color:'#d8c8e8',division:'cel4',region:'Le Pilier',tier:'regional',house:"Serpens",houseColor:'#409060',branch:"Sanctum",level:'r3'},
  {name:"Vulpes Mercatoria",color:'#c8a84a',division:'cel4',region:'Le Pilier',tier:'regional',house:"Vulpes",houseColor:'#c07040',branch:"Mercatoria",level:'r3'},
  {name:"Phoenix Iuvenis",color:'#9ad8b0',division:'cel4',region:'Le Pilier',tier:'regional',house:"Phoenix",houseColor:'#e06020',branch:"Nova",level:'r3'},
  {name:"Corvus Vigilia",color:'#6a7a8a',division:'cel4',region:'Le Pilier',tier:'regional',house:"Corvus",houseColor:'#404050',branch:"Vigilia",level:'r3'},
  {name:"Astra Academia",color:'#7ec8e3',division:'cel4',region:'Le Pilier',tier:'regional',house:"Astra",houseColor:'#c0a0e0',branch:"Academia",level:'r3'},
  {name:"Nox Alba",color:'#9ad8b0',division:'cel4',region:'Le Pilier',tier:'regional',house:"Nox",houseColor:'#4a4a6a',branch:"Nova",level:'r3'},
  {name:"Cygnus Ordo",color:'#c0a060',division:'cel4',region:'Le Pilier',tier:'regional',house:"Cygnus",houseColor:'#d0d0e0',branch:"Ordo",level:'r3'},
  {name:"Lyra Reserva",color:'#9ad8b0',division:'cel4',region:'Le Pilier',tier:'regional',house:"Lyra",houseColor:'#c0a0d0',branch:"Nova",level:'r3'},
  {name:"Ferox Mercatoria",color:'#c8a84a',division:'cel4',region:'Le Pilier',tier:'regional',house:"Ferox",houseColor:'#a04030',branch:"Mercatoria",level:'r3'},
  // ── Première Ligue des Fondations (20 clubs) ──
  {name:"Astra Tertius",color:'#9ad8b0',division:'fond1',region:'Le Pilier',tier:'district',house:"Astra",houseColor:'#c0a0e0',branch:"Nova",level:'dh'},
  {name:"Fulgur Novus",color:'#9ad8b0',division:'fond1',region:'Le Pilier',tier:'district',house:"Fulgur",houseColor:'#e8d44a',branch:"Nova",level:'dh'},
  {name:"Umbra Sanctum",color:'#d8c8e8',division:'fond1',region:'Le Pilier',tier:'district',house:"Umbra",houseColor:'#6a4a8a',branch:"Sanctum",level:'dh'},
  {name:"Grus Academia",color:'#7ec8e3',division:'fond1',region:'Le Pilier',tier:'district',house:"Grus",houseColor:'#b0a090',branch:"Academia",level:'dh'},
  {name:"Pavo Mercatoria",color:'#c8a84a',division:'fond1',region:'Le Pilier',tier:'district',house:"Pavo",houseColor:'#3060a0',branch:"Mercatoria",level:'dh'},
  {name:"Infernus Ferrum",color:'#8a7a5a',division:'fond1',region:'Le Pilier',tier:'district',house:"Infernus",houseColor:'#c03020',branch:"Ferrum",level:'dh'},
  {name:"Seraph Vigilia",color:'#6a7a8a',division:'fond1',region:'Le Pilier',tier:'district',house:"Seraph",houseColor:'#f0e0c0',branch:"Vigilia",level:'dh'},
  {name:"Vita Nova",color:'#9ad8b0',division:'fond1',region:'Le Pilier',tier:'district',house:"Vita",houseColor:'#40a060',branch:"Nova",level:'dh'},
  {name:"Lupus Aurea",color:'#9ad8b0',division:'fond1',region:'Le Pilier',tier:'district',house:"Lupus",houseColor:'#607080',branch:"Nova",level:'dh'},
  {name:"Tenebris Ferrum",color:'#8a7a5a',division:'fond1',region:'Le Pilier',tier:'district',house:"Tenebris",houseColor:'#302040',branch:"Ferrum",level:'dh'},
  {name:"Ventus Nova",color:'#9ad8b0',division:'fond1',region:'Le Pilier',tier:'district',house:"Ventus",houseColor:'#7ec8e3',branch:"Nova",level:'dh'},
  {name:"Sanctus Vigilia",color:'#6a7a8a',division:'fond1',region:'Le Pilier',tier:'district',house:"Sanctus",houseColor:'#e8e0d0',branch:"Vigilia",level:'dh'},
  {name:"Draco Mercatoria",color:'#c8a84a',division:'fond1',region:'Le Pilier',tier:'district',house:"Draco",houseColor:'#307050',branch:"Mercatoria",level:'dh'},
  {name:"Sol Ferrum",color:'#8a7a5a',division:'fond1',region:'Le Pilier',tier:'district',house:"Sol",houseColor:'#f0a020',branch:"Ferrum",level:'dh'},
  {name:"Phoenix Ferrum",color:'#8a7a5a',division:'fond1',region:'Le Pilier',tier:'district',house:"Phoenix",houseColor:'#e06020',branch:"Ferrum",level:'dh'},
  {name:"Abyssus Vigilia",color:'#6a7a8a',division:'fond1',region:'Le Pilier',tier:'district',house:"Abyssus",houseColor:'#3a2a4a',branch:"Vigilia",level:'dh'},
  {name:"Ursa Vigilia",color:'#6a7a8a',division:'fond1',region:'Le Pilier',tier:'district',house:"Ursa",houseColor:'#705040',branch:"Vigilia",level:'dh'},
  {name:"Caelum Renatus",color:'#9ad8b0',division:'fond1',region:'Le Pilier',tier:'district',house:"Caelum",houseColor:'#a0d0f0',branch:"Nova",level:'dh'},
  {name:"Orion Cadet",color:'#9ad8b0',division:'fond1',region:'Le Pilier',tier:'district',house:"Orion",houseColor:'#5070c0',branch:"Nova",level:'dh'},
  {name:"Serpens Mercatoria",color:'#c8a84a',division:'fond1',region:'Le Pilier',tier:'district',house:"Serpens",houseColor:'#409060',branch:"Mercatoria",level:'dh'},
  // ── Deuxième Ligue des Fondations (20 clubs) ──
  {name:"Aether Vigilia",color:'#6a7a8a',division:'fond2',region:'Le Pilier',tier:'district',house:"Aether",houseColor:'#d4af37',branch:"Vigilia",level:'dh'},
  {name:"Ignis Vigilia",color:'#6a7a8a',division:'fond2',region:'Le Pilier',tier:'district',house:"Ignis",houseColor:'#e0502f',branch:"Vigilia",level:'dh'},
  {name:"Grus Ferrum",color:'#8a7a5a',division:'fond2',region:'Le Pilier',tier:'district',house:"Grus",houseColor:'#b0a090',branch:"Ferrum",level:'dh'},
  {name:"Nox Novus",color:'#9ad8b0',division:'fond2',region:'Le Pilier',tier:'district',house:"Nox",houseColor:'#4a4a6a',branch:"Nova",level:'dh'},
  {name:"Lux Sanctum",color:'#d8c8e8',division:'fond2',region:'Le Pilier',tier:'district',house:"Lux",houseColor:'#f5e6a0',branch:"Sanctum",level:'dh'},
  {name:"Pavo Iuvenis",color:'#9ad8b0',division:'fond2',region:'Le Pilier',tier:'district',house:"Pavo",houseColor:'#3060a0',branch:"Nova",level:'dh'},
  {name:"Luna Vigilia",color:'#6a7a8a',division:'fond2',region:'Le Pilier',tier:'district',house:"Luna",houseColor:'#c0c0d8',branch:"Vigilia",level:'dh'},
  {name:"Sanctus Renatus",color:'#9ad8b0',division:'fond2',region:'Le Pilier',tier:'district',house:"Sanctus",houseColor:'#e8e0d0',branch:"Nova",level:'dh'},
  {name:"Vulpes Sanctum",color:'#d8c8e8',division:'fond2',region:'Le Pilier',tier:'district',house:"Vulpes",houseColor:'#c07040',branch:"Sanctum",level:'dh'},
  {name:"Gehenna Alba",color:'#9ad8b0',division:'fond2',region:'Le Pilier',tier:'district',house:"Gehenna",houseColor:'#7a2020',branch:"Nova",level:'dh'},
  {name:"Astra Sanctum",color:'#d8c8e8',division:'fond2',region:'Le Pilier',tier:'district',house:"Astra",houseColor:'#c0a0e0',branch:"Sanctum",level:'dh'},
  {name:"Caelum Ferrum",color:'#8a7a5a',division:'fond2',region:'Le Pilier',tier:'district',house:"Caelum",houseColor:'#a0d0f0',branch:"Ferrum",level:'dh'},
  {name:"Hydra Ferrum",color:'#8a7a5a',division:'fond2',region:'Le Pilier',tier:'district',house:"Hydra",houseColor:'#308070',branch:"Ferrum",level:'dh'},
  {name:"Leo Sanctum",color:'#d8c8e8',division:'fond2',region:'Le Pilier',tier:'district',house:"Leo",houseColor:'#d0a030',branch:"Sanctum",level:'dh'},
  {name:"Mortis Vigilia",color:'#6a7a8a',division:'fond2',region:'Le Pilier',tier:'district',house:"Mortis",houseColor:'#503050',branch:"Vigilia",level:'dh'},
  {name:"Orion Renatus",color:'#9ad8b0',division:'fond2',region:'Le Pilier',tier:'district',house:"Orion",houseColor:'#5070c0',branch:"Nova",level:'dh'},
  {name:"Phoenix Vigilia",color:'#6a7a8a',division:'fond2',region:'Le Pilier',tier:'district',house:"Phoenix",houseColor:'#e06020',branch:"Vigilia",level:'dh'},
  {name:"Cygnus Vigilia",color:'#6a7a8a',division:'fond2',region:'Le Pilier',tier:'district',house:"Cygnus",houseColor:'#d0d0e0',branch:"Vigilia",level:'dh'},
  {name:"Corvus Tertius",color:'#9ad8b0',division:'fond2',region:'Le Pilier',tier:'district',house:"Corvus",houseColor:'#404050',branch:"Nova",level:'dh'},
  {name:"Ursa Sanctum",color:'#d8c8e8',division:'fond2',region:'Le Pilier',tier:'district',house:"Ursa",houseColor:'#705040',branch:"Sanctum",level:'dh'},
  // ── Troisième Ligue des Fondations (20 clubs) ──
  {name:"Nox Quartus",color:'#9ad8b0',division:'fond3',region:'Le Pilier',tier:'district',house:"Nox",houseColor:'#4a4a6a',branch:"Nova",level:'dh'},
  {name:"Tenebris Mercatoria",color:'#c8a84a',division:'fond3',region:'Le Pilier',tier:'district',house:"Tenebris",houseColor:'#302040',branch:"Mercatoria",level:'dh'},
  {name:"Astra Vigilia",color:'#6a7a8a',division:'fond3',region:'Le Pilier',tier:'district',house:"Astra",houseColor:'#c0a0e0',branch:"Vigilia",level:'dh'},
  {name:"Aqua Sanctum",color:'#d8c8e8',division:'fond3',region:'Le Pilier',tier:'district',house:"Aqua",houseColor:'#3a9ad0',branch:"Sanctum",level:'dh'},
  {name:"Fulgur Quartus",color:'#9ad8b0',division:'fond3',region:'Le Pilier',tier:'district',house:"Fulgur",houseColor:'#e8d44a',branch:"Nova",level:'dh'},
  {name:"Grus Alba",color:'#9ad8b0',division:'fond3',region:'Le Pilier',tier:'district',house:"Grus",houseColor:'#b0a090',branch:"Nova",level:'dh'},
  {name:"Seraph Legio",color:'#a05050',division:'fond3',region:'Le Pilier',tier:'district',house:"Seraph",houseColor:'#f0e0c0',branch:"Legio",level:'dh'},
  {name:"Umbra Reserva",color:'#9ad8b0',division:'fond3',region:'Le Pilier',tier:'district',house:"Umbra",houseColor:'#6a4a8a',branch:"Nova",level:'dh'},
  {name:"Abyssus Quartus",color:'#9ad8b0',division:'fond3',region:'Le Pilier',tier:'district',house:"Abyssus",houseColor:'#3a2a4a',branch:"Nova",level:'dh'},
  {name:"Sanctus Ferrum",color:'#8a7a5a',division:'fond3',region:'Le Pilier',tier:'district',house:"Sanctus",houseColor:'#e8e0d0',branch:"Ferrum",level:'dh'},
  {name:"Phoenix Mercatoria",color:'#c8a84a',division:'fond3',region:'Le Pilier',tier:'district',house:"Phoenix",houseColor:'#e06020',branch:"Mercatoria",level:'dh'},
  {name:"Orion Nova",color:'#9ad8b0',division:'fond3',region:'Le Pilier',tier:'district',house:"Orion",houseColor:'#5070c0',branch:"Nova",level:'dh'},
  {name:"Ferox Vigilia",color:'#6a7a8a',division:'fond3',region:'Le Pilier',tier:'district',house:"Ferox",houseColor:'#a04030',branch:"Vigilia",level:'dh'},
  {name:"Serpens Aurea",color:'#9ad8b0',division:'fond3',region:'Le Pilier',tier:'district',house:"Serpens",houseColor:'#409060',branch:"Nova",level:'dh'},
  {name:"Mortis Ordo",color:'#c0a060',division:'fond3',region:'Le Pilier',tier:'district',house:"Mortis",houseColor:'#503050',branch:"Ordo",level:'dh'},
  {name:"Luna Ordo",color:'#c0a060',division:'fond3',region:'Le Pilier',tier:'district',house:"Luna",houseColor:'#c0c0d8',branch:"Ordo",level:'dh'},
  {name:"Ignis Sanctum",color:'#d8c8e8',division:'fond3',region:'Le Pilier',tier:'district',house:"Ignis",houseColor:'#e0502f',branch:"Sanctum",level:'dh'},
  {name:"Infernus Minor",color:'#9ad8b0',division:'fond3',region:'Le Pilier',tier:'district',house:"Infernus",houseColor:'#c03020',branch:"Nova",level:'dh'},
  {name:"Draco Vigilia",color:'#6a7a8a',division:'fond3',region:'Le Pilier',tier:'district',house:"Draco",houseColor:'#307050',branch:"Vigilia",level:'dh'},
  {name:"Ursa Nova",color:'#9ad8b0',division:'fond3',region:'Le Pilier',tier:'district',house:"Ursa",houseColor:'#705040',branch:"Nova",level:'dh'},
  // ── Quatrième Ligue des Fondations (20 clubs) ──
  {name:"Nox Vigilia",color:'#6a7a8a',division:'fond4',region:'Le Pilier',tier:'district',house:"Nox",houseColor:'#4a4a6a',branch:"Vigilia",level:'dh'},
  {name:"Tenebris Cadet",color:'#9ad8b0',division:'fond4',region:'Le Pilier',tier:'district',house:"Tenebris",houseColor:'#302040',branch:"Nova",level:'dh'},
  {name:"Aqua Reserva",color:'#9ad8b0',division:'fond4',region:'Le Pilier',tier:'district',house:"Aqua",houseColor:'#3a9ad0',branch:"Nova",level:'dh'},
  {name:"Lux Primus",color:'#f5e6a0',division:'fond4',region:'Le Pilier',tier:'district',house:"Lux",houseColor:'#f5e6a0',branch:"Primus",level:'dh'},
  {name:"Infernus Excelsior",color:'#e8d48a',division:'fond4',region:'Le Pilier',tier:'district',house:"Infernus",houseColor:'#c03020',branch:"Excelsior",level:'dh'},
  {name:"Vulpes Legio",color:'#a05050',division:'fond4',region:'Le Pilier',tier:'district',house:"Vulpes",houseColor:'#c07040',branch:"Legio",level:'dh'},
  {name:"Orion Excelsior",color:'#e8d48a',division:'fond4',region:'Le Pilier',tier:'district',house:"Orion",houseColor:'#5070c0',branch:"Excelsior",level:'dh'},
  {name:"Sol Sanctum",color:'#d8c8e8',division:'fond4',region:'Le Pilier',tier:'district',house:"Sol",houseColor:'#f0a020',branch:"Sanctum",level:'dh'},
  {name:"Taurus Iuvenis",color:'#9ad8b0',division:'fond4',region:'Le Pilier',tier:'district',house:"Taurus",houseColor:'#906040',branch:"Nova",level:'dh'},
  {name:"Gehenna Nova",color:'#9ad8b0',division:'fond4',region:'Le Pilier',tier:'district',house:"Gehenna",houseColor:'#7a2020',branch:"Nova",level:'dh'},
  {name:"Ventus Academia",color:'#7ec8e3',division:'fond4',region:'Le Pilier',tier:'district',house:"Ventus",houseColor:'#7ec8e3',branch:"Academia",level:'dh'},
  {name:"Corvus Custodes",color:'#8a9ba8',division:'fond4',region:'Le Pilier',tier:'district',house:"Corvus",houseColor:'#404050',branch:"Custodes",level:'dh'},
  {name:"Aether Ordo",color:'#c0a060',division:'fond4',region:'Le Pilier',tier:'district',house:"Aether",houseColor:'#d4af37',branch:"Ordo",level:'dh'},
  {name:"Hydra Primus",color:'#308070',division:'fond4',region:'Le Pilier',tier:'district',house:"Hydra",houseColor:'#308070',branch:"Primus",level:'dh'},
  {name:"Gloria Secundus",color:'#e0c040',division:'fond4',region:'Le Pilier',tier:'district',house:"Gloria",houseColor:'#e0c040',branch:"Secundus",level:'dh'},
  {name:"Lupus Mercatoria",color:'#c8a84a',division:'fond4',region:'Le Pilier',tier:'district',house:"Lupus",houseColor:'#607080',branch:"Mercatoria",level:'dh'},
  {name:"Ursa Primus",color:'#705040',division:'fond4',region:'Le Pilier',tier:'district',house:"Ursa",houseColor:'#705040',branch:"Primus",level:'dh'},
  {name:"Fulgur Legio",color:'#a05050',division:'fond4',region:'Le Pilier',tier:'district',house:"Fulgur",houseColor:'#e8d44a',branch:"Legio",level:'dh'},
  {name:"Ignis Custodes",color:'#8a9ba8',division:'fond4',region:'Le Pilier',tier:'district',house:"Ignis",houseColor:'#e0502f',branch:"Custodes",level:'dh'},
  {name:"Lyra Primus",color:'#c0a0d0',division:'fond4',region:'Le Pilier',tier:'district',house:"Lyra",houseColor:'#c0a0d0',branch:"Primus",level:'dh'},
];

function pilierTeamsByDivision(divId){ const r=PILIER_TEAMS.filter(t=>t.division===divId); r.forEach(_pilierBadgeOnDemand); return r; }
function pilierHouseClubs(house){ const r=PILIER_TEAMS.filter(t=>t.house===house); r.forEach(_pilierBadgeOnDemand); return r; }
// Génère le badge d'un club à la demande s'il manque (badges.js désormais prêt).
function _pilierBadgeOnDemand(t){ if(t && !t.badge && typeof BadgeGenerator!=='undefined'){ const b=_pilierMakeBadge(t); if(b) t.badge=b; } }

// ═══════════════════════════════════════════════════════════
// BLASONS DU PILIER (déterministes, thème céleste/infernal)
// ───────────────────────────────────────────────────────────
// On génère un blason stable par club à partir de son nom (via
// BadgeGenerator.fromSeed), en forçant une icône selon la BRANCHE (Custodes →
// bouclier, Sanctum → étoile, Legio/Ferrum → épée, Primus → couronne/dragon…)
// et en teintant avec la couleur de la Maison. Généré une fois au chargement.
// ───────────────────────────────────────────────────────────
const _PILIER_BRANCH_ICON = {
  Primus:['crown','dragon','phoenix'], Secundus:['griffin','eagle'],
  Excelsior:['crown','star'], Academia:['leaf','star'],
  Custodes:['shield','tower'], Ordo:['sword','shield'],
  Legio:['sword','flame'], Ferrum:['sword','anchor'],
  Vigilia:['raven','tower'], Mercatoria:['anchor','star'],
  Sanctum:['star','laurel'], Nova:['bolt','flame'],
};
function _pilierMakeBadge(team){
  if(typeof BadgeGenerator==='undefined' || !BadgeGenerator.fromSeed) return null;
  const iconPool = _PILIER_BRANCH_ICON[team.branch] || ['star','flame','bolt'];
  // Choix d'icône déterministe (depuis le nom) dans le pool de la branche.
  let h=0; for(let i=0;i<team.name.length;i++){ h=(h*31+team.name.charCodeAt(i))>>>0; }
  const icon = iconPool[h % iconPool.length];
  // Couleur de Maison → teinte principale du blason.
  const mc = team.houseColor || team.color || '#d4af37';
  try{
    return BadgeGenerator.fromSeed(team.name, {
      icon: icon,
      colors: [mc, '#f5f0e0', _pilierAccent(mc)],
      iconColor: '#f5f0e0',
    });
  }catch(e){ return null; }
}
// Couleur d'accent (éclaircie) dérivée de la couleur de Maison.
function _pilierAccent(hex){
  hex=String(hex||'#d4af37'); if(/^#[0-9a-fA-F]{3}$/.test(hex)) hex='#'+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3];
  const r=Math.min(255,parseInt(hex.slice(1,3),16)+60), g=Math.min(255,parseInt(hex.slice(3,5),16)+60), b=Math.min(255,parseInt(hex.slice(5,7),16)+60);
  return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
}
// Générer et attacher les blasons à tous les clubs. Robuste à l'ordre de
// chargement : si badges.js n'est pas encore prêt, on réessaie un peu plus tard
// (au prochain tick, puis au load) plutôt que d'abandonner silencieusement.
function _pilierEnsureBadges(){
  if(typeof BadgeGenerator==='undefined' || !BadgeGenerator.fromSeed) return false;
  let done=0;
  PILIER_TEAMS.forEach(function(t){ if(!t.badge){ const b=_pilierMakeBadge(t); if(b){ t.badge=b; done++; } } });
  return true;
}
if(!_pilierEnsureBadges()){
  // badges.js pas encore chargé → réessais différés.
  if(typeof setTimeout!=='undefined') setTimeout(_pilierEnsureBadges, 0);
  if(typeof window!=='undefined' && window.addEventListener){
    window.addEventListener('DOMContentLoaded', _pilierEnsureBadges);
    window.addEventListener('load', _pilierEnsureBadges);
  }
}

if(typeof window!=='undefined'){
  window.PILIER_TEAMS = PILIER_TEAMS;
  window.PILIER_DIVISIONS = PILIER_DIVISIONS;
  window.pilierTeamsByDivision = pilierTeamsByDivision;
  window.pilierHouseClubs = pilierHouseClubs;
  window.pilierMakeBadge = _pilierMakeBadge;
  window._pilierEnsureBadges = _pilierEnsureBadges;
}

// ═══════════════════════════════════════════════════════════
// PROMOTION / RELÉGATION DU PILIER — 3 blocs fermés
// ───────────────────────────────────────────────────────────
// Trois blocs étanches : PRO (gtd,zenith), CÉLESTES (cel1..cel4),
// FONDATIONS (fond1..fond4). À l'intérieur d'un bloc : 2 montées / 2 descentes
// entre divisions adjacentes. Entre blocs : FERMÉ, sauf BARRAGE exceptionnel —
// le 1er de la 1re Fondation (fond1) peut monter en Céleste s'il bat 3× le
// dernier de la 4e Céleste (cel4) ; le 1er de la 1re Céleste (cel1) peut monter
// en Pro s'il bat 3× le dernier du Zénith (zenith).
const PILIER_BLOCKS = {
  pro: ['gtd','zenith'],
  celeste: ['cel1','cel2','cel3','cel4'],
  fondation: ['fond1','fond2','fond3','fond4'],
};
function _pilierBlockOf(divId){
  for(const b in PILIER_BLOCKS){ if(PILIER_BLOCKS[b].includes(divId)) return b; }
  return null;
}
function _pilierDivOfLevel(level){
  // Un club stocke un `level` moteur (d1,d2,r1,...). On retrouve sa division
  // Pilier via PILIER_DIVISIONS (chaque division a un `level`).
  const e = Object.entries(PILIER_DIVISIONS).find(([id,d])=>d.level===level);
  return e ? e[0] : null;
}
// Résout la fin de saison pour le club joueur au Pilier.
// pos = position finale (1 = premier), total = nb d'équipes.
// Retourne { newLevel, message, playoff } — playoff signale un barrage à jouer.
function pilierResolveSeason(club, pos, total){
  // Retrouver la division actuelle par son id stocké ou via le level.
  let divId = club.pilierDivId || _pilierDivOfLevel(club.level);
  if(!divId || !PILIER_DIVISIONS[divId]) return null;
  const block = _pilierBlockOf(divId);
  const order = PILIER_DIVISIONS[divId].order;
  const blockDivs = PILIER_BLOCKS[block];
  const idxInBlock = blockDivs.indexOf(divId);
  const isTopOfBlock = idxInBlock===0;
  const isBottomOfBlock = idxInBlock===blockDivs.length-1;

  let newDivId = divId, message = null, playoff = null;

  // MONTÉE (2 premiers) — vers la division au-dessus DANS le bloc.
  if(pos<=2 && !isTopOfBlock){
    newDivId = blockDivs[idxInBlock-1];
    message = '🎉 PROMOTION ! Vous montez en '+PILIER_DIVISIONS[newDivId].name+' !';
  }
  // DESCENTE (2 derniers) — vers la division en-dessous DANS le bloc.
  else if(pos>=total-1 && !isBottomOfBlock){
    newDivId = blockDivs[idxInBlock+1];
    message = '🔻 Relégation en '+PILIER_DIVISIONS[newDivId].name+'.';
  }
  // BARRAGE inter-blocs : 1er d'une tête de bloc inférieur → tente de monter.
  else if(pos===1 && isTopOfBlock && block!=='pro'){
    // fond1 (1er des Fondations) vise cel4 ; cel1 (1er des Célestes) vise zenith.
    const target = block==='fondation' ? 'cel4' : 'zenith';
    playoff = {
      type:'promotion_barrage',
      fromDiv: divId, targetDiv: target,
      desc: 'Barrage d\'accession : battez 3× le dernier de '+PILIER_DIVISIONS[target].name+' pour monter d\'un bloc !',
      winsNeeded: 3,
    };
    message = '⚔️ Vous êtes 1er ! Un barrage d\'accession vous attend contre le dernier de '+PILIER_DIVISIONS[target].name+'.';
  }
  else if(isTopOfBlock && pos<=2 && block==='pro' && divId==='gtd'){
    message = '👑 Champion du Grand Trône Divin — sommet du Pilier atteint !';
  }

  return {
    newLevel: PILIER_DIVISIONS[newDivId].level,
    newDivId,
    message,
    playoff,
  };
}
// Résout un barrage d'accession : le joueur doit gagner `winsNeeded` matchs.
// Retourne { promoted, newLevel, newDivId, message }.
function pilierResolveBarrage(playoff, playerWins){
  if(playerWins >= playoff.winsNeeded){
    return {
      promoted:true,
      newLevel: PILIER_DIVISIONS[playoff.targetDiv].level,
      newDivId: playoff.targetDiv,
      message:'🏆 BARRAGE RÉUSSI ! Vous accédez à '+PILIER_DIVISIONS[playoff.targetDiv].name+' — un exploit historique !',
    };
  }
  return { promoted:false, message:'⚔️ Barrage perdu ('+playerWins+'/'+playoff.winsNeeded+' victoires). Vous restez dans votre bloc.' };
}

if(typeof window!=='undefined'){
  window.PILIER_BLOCKS = PILIER_BLOCKS;
  window.pilierResolveSeason = pilierResolveSeason;
  window.pilierResolveBarrage = pilierResolveBarrage;
}
