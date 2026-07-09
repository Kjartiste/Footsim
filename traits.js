'use strict';
// ══════════════════════════════════════════════════════════════════════
//  TRAITS & PERSONNALITÉS  (Couche 2)
//  - Traits : comportements individuels qui modifient les décisions de l'IA.
//  - Personnalités : profil global qui colore le joueur (moral, progression…).
//  Actifs uniquement en mode Complet (neutres en Lite, comme les stats s2).
// ══════════════════════════════════════════════════════════════════════

// ── DÉFINITION DES TRAITS ─────────────────────────────────────────────
// {id, n (nom), d (desc), icon, cat}
// cat : 'off' (offensif) | 'def' (défensif) | 'tech' | 'ment' (mental) | 'magie'
// Les effets sont appliqués par des hooks dans le moteur (voir plus bas).
const TRAITS = [
  // ── Offensif ──
  {id:'tire_loin',    n:'Tire de loin',        d:'Tente sa chance de plus loin que la normale.',            icon:'🎯', cat:'off'},
  {id:'ne_tire_jamais',n:'Ne tire jamais',     d:'Cherche toujours la passe plutôt que la frappe.',        icon:'🚫', cat:'off'},
  {id:'renard',       n:'Renard des surfaces', d:'Redoutable près du but, se démarque dans la surface.',   icon:'🦊', cat:'off'},
  {id:'dribbleur',    n:'Dribbleur',           d:'Tente beaucoup plus de dribbles.',                       icon:'🌀', cat:'off'},
  {id:'passe_prof',   n:'Passes en profondeur',d:'Cherche les passes qui cassent les lignes.',             icon:'🗡️', cat:'off'},
  {id:'monte',        n:'Monte sans arrêt',    d:'Se projette vers l\'avant dès que possible.',            icon:'⬆️', cat:'off'},
  {id:'une_deux',     n:'Cherche les une-deux',d:'Multiplie les combinaisons rapides.',                    icon:'🔁', cat:'off'},
  {id:'sang_froid',   n:'Sang-froid glacial',  d:'Marque plus souvent les occasions franches.',            icon:'🧊', cat:'off'},
  // ── Défensif ──
  {id:'tacle_agressif',n:'Tacle agressivement', d:'Tacle beaucoup — récupère plus, mais prend des cartons.',icon:'⚔️', cat:'def'},
  {id:'presseur',     n:'Presse constamment',  d:'Harcèle le porteur sans relâche.',                       icon:'🏃', cat:'def'},
  {id:'muraille',     n:'Muraille',            d:'Excelle dans les duels défensifs près de son but.',      icon:'🧱', cat:'def'},
  {id:'lecture',      n:'Lecture du jeu',      d:'Intercepte et anticipe mieux que la moyenne.',           icon:'👁️', cat:'def'},
  // ── Technique ──
  {id:'geste_tech',   n:'Gestes techniques',   d:'Tente des gestes rares (roulettes, sombreros…).',        icon:'✨', cat:'tech'},
  {id:'evite_mauvais',n:'Évite son mauvais pied',d:'Repositionne le ballon sur son bon pied.',             icon:'🦶', cat:'tech'},
  {id:'exterieurs',   n:'Utilise les extérieurs',d:'Passes et frappes de l\'extérieur du pied.',            icon:'🎽', cat:'tech'},
  {id:'cf_specialist',n:'Spécialiste coups de pied arrêtés',d:'Redoutable sur corners et coups francs.',    icon:'🎪', cat:'tech'},
  // ── Mental ──
  {id:'guerrier',     n:'Guerrier',            d:'Ne baisse jamais les bras, boost en fin de match.',      icon:'🛡️', cat:'ment'},
  {id:'clutch',       n:'Homme des grands soirs',d:'Se transcende dans les moments décisifs.',              icon:'🌟', cat:'ment'},
  {id:'inconstant',   n:'Inconstant',          d:'Performances imprévisibles d\'un match à l\'autre.',     icon:'🎲', cat:'ment'},
  {id:'capitaine',    n:'Meneur d\'hommes',    d:'Galvanise ses coéquipiers autour de lui.',               icon:'©️', cat:'ment'},
  // ── Magie ──
  {id:'mage_ne',      n:'Mage-né',             d:'Lance ses sorts plus souvent et à moindre coût.',        icon:'🔮', cat:'magie'},
  {id:'instable',     n:'Magie instable',      d:'Sorts puissants mais qui ratent parfois.',               icon:'⚡', cat:'magie'},
  {id:'anti_magie',   n:'Anti-magie',          d:'Résiste fortement aux sorts adverses.',                  icon:'🛑', cat:'magie'},
];
const TRAIT_BY_ID = {}; TRAITS.forEach(t=>TRAIT_BY_ID[t.id]=t);

// ── DÉFINITION DES PERSONNALITÉS ──────────────────────────────────────
// Chaque personnalité colore le joueur : progression, moral, et éventuels
// traits "de naissance" suggérés. {id, n, d, icon, col, growth, moral}
//  growth : multiplicateur de progression (futur système d'évolution)
//  moral  : tendance de moral (+/-)
const PERSONALITIES = [
  {id:'leader',    n:'Leader',      d:'Boost le moral de l\'équipe. Naturellement capitaine.',        icon:'👑', col:'#f0c028', growth:1.05, moral:+1, traits:['capitaine']},
  {id:'genie',     n:'Génie',       d:'Immense talent créatif, mais irrégulier.',                     icon:'🎭', col:'#8840e0', growth:1.15, moral:0,  traits:['geste_tech','inconstant']},
  {id:'guerrier',  n:'Guerrier',    d:'Ne lâche jamais rien, se bat jusqu\'au bout.',                  icon:'⚔️', col:'#e02030', growth:1.00, moral:+1, traits:['guerrier','tacle_agressif']},
  {id:'bosseur',   n:'Bosseur',     d:'Travailleur acharné : progresse très vite.',                   icon:'🔨', col:'#18c860', growth:1.25, moral:0,  traits:['presseur','monte']},
  {id:'diva',      n:'Diva',        d:'Talentueux mais se démotive vite.',                            icon:'💅', col:'#ff4081', growth:0.95, moral:-1, traits:['dribbleur']},
  {id:'mercenaire',n:'Mercenaire',  d:'Efficace, mais sans attache — part facilement.',               icon:'💰', col:'#607d8b', growth:1.00, moral:0,  traits:['sang_froid']},
  {id:'timide',    n:'Timide',      d:'Joue moins bien devant un grand public.',                      icon:'😶', col:'#90a4ae', growth:1.00, moral:-1, traits:[]},
  {id:'showman',   n:'Showman',     d:'Adore les grands matchs, se sublime sous les projecteurs.',    icon:'🎤', col:'#00b8d4', growth:1.05, moral:0,  traits:['clutch','geste_tech']},
  {id:'sage',      n:'Sage',        d:'Calme et régulier, une valeur sûre.',                          icon:'🧘', col:'#4db6ac', growth:1.00, moral:0,  traits:['lecture']},
  {id:'feu_follet',n:'Feu follet',  d:'Explosif et imprévisible, magie débridée.',                    icon:'🔥', col:'#ff6d00', growth:1.05, moral:0,  traits:['mage_ne','instable']},
];
const PERSO_BY_ID = {}; PERSONALITIES.forEach(p=>PERSO_BY_ID[p.id]=p);

// ── GÉNÉRATION / ATTRIBUTION ──────────────────────────────────────────
function _pickWeighted(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

// Attribue une personnalité + traits à un joueur s'il n'en a pas encore.
// Cohérent avec ses stats (un bon tireur a plus de chances d'avoir "sang-froid").
function ensurePlayerProfile(p){
  if(!p || !p.s) return;
  if(p._profileV===1) return; // déjà généré
  // Personnalité
  if(!p.perso){
    const perso=_pickWeighted(PERSONALITIES);
    p.perso=perso.id;
  }
  // Traits : ceux suggérés par la personnalité + éventuellement 0-2 selon stats
  if(!Array.isArray(p.traits)) p.traits=[];
  const perso=PERSO_BY_ID[p.perso];
  if(perso && perso.traits){
    perso.traits.forEach(tid=>{ if(p.traits.length<4 && !p.traits.includes(tid)) p.traits.push(tid); });
  }
  // Traits liés aux stats détaillées (si dispo)
  const s2=p.s2||{};
  const maybe=(cond,tid,chance)=>{ if(cond && p.traits.length<4 && !p.traits.includes(tid) && Math.random()<chance) p.traits.push(tid); };
  maybe((s2.finition||p.s.sht||0)>=78,'renard',0.5);
  maybe((s2.tir||p.s.sht||0)>=80,'tire_loin',0.4);
  maybe((s2.dribble||p.s.tec||0)>=80,'dribbleur',0.45);
  maybe((s2.tacle||p.s.def||0)>=78,'tacle_agressif',0.4);
  maybe((s2.vision||p.s.tec||0)>=80,'passe_prof',0.4);
  maybe((s2.affinite||0)>=80,'mage_ne',0.5);
  maybe((s2.instabilite||0)>=80,'instable',0.5);
  maybe((s2.resMagie||0)>=80,'anti_magie',0.4);
  p._profileV=1;
}
function ensureAllProfiles(){
  try{
    (window.teams||[]).forEach(T=>{
      if(!T) return;
      ['players','bench','reserves'].forEach(k=>(T[k]||[]).forEach(ensurePlayerProfile));
    });
  }catch(e){}
}

// ── HELPERS (utilisés par le moteur, neutres en Lite) ─────────────────
function _traitsActive(){ return window.GS && window.GS.statMode==='complet'; }
function hasTrait(p, tid){
  if(!_traitsActive()) return false;
  return !!(p && Array.isArray(p.traits) && p.traits.includes(tid));
}
function personaOf(p){
  if(!p) return null;
  return PERSO_BY_ID[p && p.perso] || null;
}

// Exposer
Object.assign(window, {
  TRAITS, TRAIT_BY_ID, PERSONALITIES, PERSO_BY_ID,
  ensurePlayerProfile, ensureAllProfiles, hasTrait, personaOf,
});
