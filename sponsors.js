'use strict';
// ══════════════════════════════════════════════════════════════════════
//  SPONSORS.JS — Système de sponsors en carrière Dirigeant
//
//  Module ADDITIF et défensif : si careerV2 / le club n'existe pas, toutes
//  les fonctions renvoient des valeurs neutres et le jeu tourne comme avant.
//
//  Un club dispose de 4 EMPLACEMENTS de sponsoring, chacun pouvant accueillir
//  un contrat à la fois :
//    • maillot        (sponsor principal, face avant) — le plus lucratif
//    • manche         (sponsor de manche)
//    • equipementier  (fournisseur des maillots)
//    • stade          (naming / panneaux du stade)
//
//  Chaque contrat : { slot, name, weekly, signBonus, weeks, weeksLeft,
//                      objective|null }.
//  Un objectif optionnel verse une PRIME de fin de contrat s'il est atteint
//  (ex. « terminer dans le top 5 », « ne pas être relégué »).
//
//  Les paiements hebdomadaires s'ajoutent aux revenus (voir
//  _weeklyCareerRevenue) ; la prime de signature est créditée immédiatement.
// ══════════════════════════════════════════════════════════════════════

const SPONSORS = (function(){

  // ── Emplacements ───────────────────────────────────────────────────
  const SLOTS = [
    { key:'maillot',       label:'Sponsor maillot',   icon:'👕', weightMul:1.00 },
    { key:'manche',        label:'Sponsor manche',    icon:'🎽', weightMul:0.45 },
    { key:'equipementier', label:'Équipementier',     icon:'🥾', weightMul:0.60 },
    { key:'stade',         label:'Naming du stade',   icon:'🏟️', weightMul:0.70 },
  ];
  const SLOT_ORDER = SLOTS.map(function(s){ return s.key; });
  function slotDef(key){ return SLOTS.find(function(s){ return s.key===key; }) || SLOTS[0]; }

  // ── Marques par NATION ─────────────────────────────────────────────
  // Chaque nation a son propre tissu économique : les marques qui sponsorisent
  // un club de Panthalassa (empire océanique) n'ont rien à voir avec celles du
  // Pilier Céleste (verticalité, anges/démons) ou de Rorang (chaos/magie).
  const NATION_BRANDS = {
    panthalassa: {
      maillot: ['AbyssTel','Marega','NyxCola','CoralBank','TritonAir','PelagosPay','OndaMobile','KrakenEnergy'],
      manche:  ['SelKa','BrumeVive','AquaPur','Récif+','SonarPro','NacreCo'],
      equipementier: ['Squale','Méduse Sport','Nérite','Abysse Athletic','Vague9'],
      stade:   ['Arena Corail','Dôme Pélagique','Grand Bleu','Baie d\'Argent','Lagon Central'],
    },
    valoria: {
      maillot: ['Valor Banque','Aurum Tel','Rubis Mobile','Lys Assurances','ValorPay','Blason Énergie'],
      manche:  ['Cépage Royal','Forge & Fils','Écu+','Vigne d\'Or','Sablier'],
      equipementier: ['Cuirasse Sport','Lame Athletic','Heaume','Étendard Wear'],
      stade:   ['Arène du Blason','Grand Tournoi','Cour d\'Honneur','Donjon Central'],
    },
    pilier: {
      maillot: ['Zénith Corp','Ascension Bank','SolTel','Nimbus Énergie','Séraphin Pay','Abîme Industries'],
      manche:  ['Plume+','Encens','Palier Neuf','Chute Libre','Halo'],
      equipementier: ['Aile Sport','Griffe Athletic','Ascendant Wear','Sabot & Co'],
      stade:   ['Terrasse Céleste','Grand Palier','Vertige','Fosse Inférieure'],
    },
    rorang: {
      maillot: ['Chaos Tel','Mana Bank','Rune Mobile','Éclat Instable','GrimoirePay','Sortilège Énergie'],
      manche:  ['Fiole+','Cendre Vive','Arcane','Bézoard','Tempête'],
      equipementier: ['Totem Sport','Fétiche Athletic','Sortilège Wear','Écaille'],
      stade:   ['Cirque des Runes','Arène Instable','Cercle Magique','Faille Centrale'],
    },
  };
  function _nationBrands(nation){
    return NATION_BRANDS[nation] || NATION_BRANDS.panthalassa;
  }

  // Génère un nom de marque thématisé : la RÉGION peut préfixer/suffixer la
  // marque (une marque locale porte le nom de sa région), ce qui donne des
  // sponsors sensiblement différents d'une région à l'autre.
  function _brandFor(nation, region, slot, rnd){
    const bank = _nationBrands(nation);
    const arr = bank[slot] || bank.maillot;
    const base = arr[Math.floor(rnd()*arr.length)];
    const rInfo = _regionInfo(nation, region);
    const rName = rInfo.name;
    if(!rName) return base;
    // Régions pauvres/isolées → sponsors surtout LOCAUX (nom de la région).
    // Régions riches → grandes marques nationales, rarement localisées.
    const localChance = rInfo.wealth >= 3 ? 0.18 : rInfo.wealth === 2 ? 0.40 : 0.70;
    if(rnd() < localChance){
      const forms = [
        base+' '+rName,
        rName+' '+base,
        base+' de '+rName,
      ];
      return forms[Math.floor(rnd()*forms.length)];
    }
    return base;
  }

  // ── Valeur de base hebdomadaire par niveau de club ─────────────────
  // Sert de référence : chaque emplacement applique son weightMul, la
  // réputation et un facteur aléatoire d'offre.
  const LEVEL_BASE = {
    'dh_4':20,'dh_3':28,'dh_2':40,'dh_1':60, dh:40,
    r3:180, r2:420, r1:1100, d3:5000, d2:15000, d1:55000,
  };
  function levelBase(level){ return LEVEL_BASE[level] || LEVEL_BASE.dh; }

  // ── Objectifs de contrat possibles (prime si atteint en fin de contrat) ─
  // Chaque objectif référence une fonction d'évaluation lue à l'expiration.
  const OBJECTIVES = [
    { id:'no_releg', label:'Éviter la relégation',      bonusMul:6 },
    { id:'top5',     label:'Terminer dans le top 5',    bonusMul:10 },
    { id:'promo',    label:'Monter en division',        bonusMul:16 },
    { id:'win8',     label:'Gagner au moins 8 matchs',  bonusMul:8 },
  ];
  function objectiveById(id){ return OBJECTIVES.find(function(o){ return o.id===id; }) || null; }

  // ── RNG déterministe (seed) ────────────────────────────────────────
  // Les offres doivent rester IDENTIQUES entre deux rendus et survivre à un
  // rechargement de la sauvegarde : on les dérive d'une graine (club + slot +
  // compteur de rafraîchissement) plutôt que de les stocker dans careerV2.
  function _hash(str){
    let h = 2166136261 >>> 0;
    for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function _mulberry(seed){
    let a = seed >>> 0;
    return function(){
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Graine stable pour un club/slot donné (change si le club change de
  // division ou si le joueur demande de nouvelles offres).
  function seedFor(club, slot){
    const id   = (club && (club.id || club.name)) || 'club';
    const lvl  = (club && club.level) || 'dh';
    const nat  = (club && club.nation) || (typeof careerV2!=='undefined' && careerV2 && careerV2.nation) || 'x';
    const reg  = (club && club.region) || 'x';
    const bump = (club && club._sponsorRefresh && club._sponsorRefresh[slot]) || 0;
    return _hash([id,nat,reg,lvl,slot,bump].join('|'));
  }

  // ── Contexte régional : richesse, nom, couleur ──────────────────────
  // Une capitale riche attire des marques bien plus généreuses qu'une région
  // isolée, même à division égale.
  function _regionInfo(nation, region){
    try{
      if(typeof WORLDS!=='undefined' && WORLDS.getRegion){
        const r = WORLDS.getRegion(nation, region);
        if(r) return { wealth: r.wealth||2, name: r.name||'', type: r.type||'', traits: r.traits||{} };
      }
    }catch(e){}
    return { wealth:2, name:'', type:'', traits:{} };
  }

  // ── Objectifs plausibles selon le palier ───────────────────────────
  // Pas de « monter en division » si le club est déjà au sommet, pas de
  // « éviter la relégation » tout en bas de la pyramide.
  function _objectivesForLevel(level){
    const top = (level==='d1');
    const bottom = ['dh','dh_1','dh_2','dh_3','dh_4'].indexOf(level) >= 0;
    return OBJECTIVES.filter(function(o){
      if(o.id==='promo' && top) return false;
      if(o.id==='no_releg' && bottom) return false;
      return true;
    });
  }

  // ── Génère une liste d'offres pour un emplacement donné ────────────
  // Offres STABLES (RNG déterministe) et adaptées à la division, à la nation
  // et à la région du club.
  function offersFor(club, slot){
    const level = (club && club.level) || 'dh';
    const rep   = (club && typeof club.reputation==='number') ? club.reputation : 50;
    const nation = (club && club.nation) || (typeof careerV2!=='undefined' && careerV2 && careerV2.nation) || 'panthalassa';
    const region = (club && club.region) || null;

    // RNG déterministe : mêmes offres tant que le joueur ne rafraîchit pas.
    const rnd = _mulberry(seedFor(club, slot));

    const rInfo = _regionInfo(nation, region);
    const wealthMul = 0.6 + (rInfo.wealth||2) * 0.30;   // ~0.9 (pauvre) .. 1.5 (riche)

    const base  = levelBase(level) * slotDef(slot).weightMul;
    const repMul = 0.7 + Math.min(1.2, rep/120);

    // Les paliers amateurs n'attirent ni contrats longs ni gros objectifs.
    const amateur = ['dh','dh_1','dh_2','dh_3','dh_4','r3'].indexOf(level) >= 0;
    const templates = amateur
      ? [ { weeks:12, variance:0.85, objChance:0.0, bonusW:1 },
          { weeks:20, variance:1.00, objChance:0.3, bonusW:2 },
          { weeks:34, variance:1.15, objChance:0.5, bonusW:3 } ]
      : [ { weeks:20, variance:0.85, objChance:0.0, bonusW:2 },
          { weeks:34, variance:1.00, objChance:0.6, bonusW:4 },
          { weeks:52, variance:1.20, objChance:0.9, bonusW:6 } ];

    const objPool = _objectivesForLevel(level);
    const used = {};

    return templates.map(function(t){
      const weekly = Math.max(1, Math.round(base * t.variance * repMul * wealthMul * (0.9 + rnd()*0.25)));
      const signBonus = Math.round(weekly * (t.bonusW + rnd()*2));
      let objective = null;
      if(objPool.length && rnd() < t.objChance){
        const o = objPool[Math.floor(rnd()*objPool.length)];
        objective = { id:o.id, label:o.label, bonus: Math.round(weekly * o.bonusMul) };
      }
      // Marque thématisée nation/région, sans doublon dans la liste.
      let name = _brandFor(nation, region, slot, rnd);
      let guard = 0;
      while(used[name] && guard++ < 10) name = _brandFor(nation, region, slot, rnd);
      used[name] = true;
      return { slot:slot, name:name, weekly:weekly, signBonus:signBonus,
               weeks:t.weeks, weeksLeft:t.weeks, objective:objective };
    });
  }

  // Demande de nouvelles offres : incrémente le compteur de la graine.
  function refresh(club, slot){
    if(!club) return;
    if(!club._sponsorRefresh) club._sponsorRefresh = {};
    club._sponsorRefresh[slot] = (club._sponsorRefresh[slot]||0) + 1;
  }

  // ── Accès aux contrats actifs du club ──────────────────────────────
  function ensure(club){
    if(!club) return;
    if(!club.sponsors || typeof club.sponsors!=='object'){
      club.sponsors = { maillot:null, manche:null, equipementier:null, stade:null };
    }
    // Migration : ancien champ `sponsor` (unique) → emplacement maillot.
    if(club.sponsor && !club.sponsors.maillot){
      if(typeof club.sponsor==='object' && club.sponsor.weekly){
        club.sponsors.maillot = Object.assign({ slot:'maillot' }, club.sponsor);
      }
      club.sponsor = null;
    }
    SLOT_ORDER.forEach(function(k){ if(club.sponsors[k]===undefined) club.sponsors[k]=null; });
  }
  function active(club){
    if(!club || !club.sponsors) return [];
    return SLOT_ORDER.map(function(k){ return club.sponsors[k]; }).filter(Boolean);
  }

  // ── Revenu hebdomadaire total des sponsors ─────────────────────────
  function weeklyIncome(club){
    return active(club).reduce(function(sum,c){ return sum + (c.weekly||0); }, 0);
  }

  // ── Signature d'un contrat ─────────────────────────────────────────
  // Renvoie {ok, bonus} ; pose le contrat sur son emplacement (remplace
  // l'éventuel contrat existant) et crédite la prime de signature.
  function sign(club, deal){
    if(!club || !deal || !deal.slot) return { ok:false };
    ensure(club);
    club.sponsors[deal.slot] = {
      slot: deal.slot, name: deal.name, weekly: deal.weekly,
      signBonus: deal.signBonus, weeks: deal.weeks, weeksLeft: deal.weeks,
      objective: deal.objective || null,
    };
    return { ok:true, bonus: deal.signBonus||0 };
  }

  // Résiliation anticipée (avec pénalité = ~4 semaines de contrat).
  function terminationFee(deal){ return deal ? Math.round((deal.weekly||0) * 4) : 0; }

  // ── Évalue si l'objectif d'un contrat est atteint (fin de saison) ──
  // stats attendu : { relegated:bool, rank:int, promoted:bool, wins:int }.
  function objectiveMet(objId, stats){
    if(!objId || !stats) return false;
    switch(objId){
      case 'no_releg': return !stats.relegated;
      case 'top5':     return typeof stats.rank==='number' && stats.rank>0 && stats.rank<=5;
      case 'promo':    return !!stats.promoted;
      case 'win8':     return (stats.wins||0) >= 8;
      default: return false;
    }
  }

  // ── Décrément hebdomadaire + expiration ────────────────────────────
  // Renvoie la liste des contrats qui viennent d'expirer (pour notifier).
  function tickWeek(club){
    if(!club || !club.sponsors) return [];
    const expired = [];
    SLOT_ORDER.forEach(function(k){
      const c = club.sponsors[k];
      if(!c) return;
      c.weeksLeft = (typeof c.weeksLeft==='number' ? c.weeksLeft : c.weeks) - 1;
      if(c.weeksLeft <= 0){ expired.push(c); club.sponsors[k] = null; }
    });
    return expired;
  }

  return {
    SLOTS: SLOTS, SLOT_ORDER: SLOT_ORDER, slotDef: slotDef, OBJECTIVES: OBJECTIVES,
    offersFor: offersFor, refresh: refresh, ensure: ensure, active: active, weeklyIncome: weeklyIncome,
    sign: sign, terminationFee: terminationFee, objectiveMet: objectiveMet, tickWeek: tickWeek,
    objectiveById: objectiveById,
  };
})();

if(typeof window!=='undefined') window.SPONSORS = SPONSORS;
