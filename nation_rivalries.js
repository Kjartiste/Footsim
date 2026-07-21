// ═══════════════════════════════════════════════════════════════
// NATION_RIVALRIES.JS — Affinités & rivalités entre nations (lore).
//
// Distinct du "derby de club" (board.js), qui oppose deux CLUBS d'une
// même carrière. Ici on modélise les tensions entre PEUPLES : un match
// entre nations rivales devient un « choc ancestral » qui galvanise les
// équipes (petit bonus de motivation) et s'annonce au pré-match.
//
// Volontairement léger : le bonus est faible pour ne pas déséquilibrer.
// Chargé en <script> classique. API globale :
//   NATION_RIVALRY.get(nationA, nationB) → { level, label, blurb } | null
//   NATION_RIVALRY.motivationBonus(a, b) → petit nombre (0..~3)
// ═══════════════════════════════════════════════════════════════
(function(){
  'use strict';

  // Normalise un identifiant de nation (les objets équipe peuvent porter
  // 'Valoria', 'valoria', etc.). On compare toujours en minuscules.
  function norm(n){ return String(n||'').trim().toLowerCase(); }

  // Table symétrique de relations. `level` :
  //   2 = rivalité ardente (choc ancestral, gros bonus d'intensité)
  //   1 = tension/méfiance (bonus léger)
  //  -1 = affinité/alliance (pas de bonus de haine ; ambiance différente)
  // Clé = paire triée "a|b" pour rester symétrique sans doublon.
  var REL = {
    // Sirènes des Profondeurs vs Pilier Céleste : la mer contre le ciel.
    'panthalassa|pilier': {
      level: 2,
      label: '⚔️ Choc ancestral — Abysses contre Cieux',
      blurb: "Les Sirènes des profondeurs et les hauteurs du Pilier Céleste "
           + "se toisent depuis toujours. Rien n'attise plus les deux peuples."
    },
    // Valoria (humains meurtris) vs Pilier (mérite & prestige) : orgueil blessé.
    'pilier|valoria': {
      level: 1,
      label: '🔥 Vieilles tensions',
      blurb: "La superbe du Pilier Céleste irrite Valoria, encore marquée par "
           + "son passé. Un match sous tension."
    },
    // Valoria vs Sirènes : méfiance des terres envers les profondeurs.
    'panthalassa|valoria': {
      level: 1,
      label: '🌊 Méfiance des rivages',
      blurb: "Entre les cités humaines et le peuple des abysses, la confiance "
           + "n'a jamais vraiment pris."
    },
    // Rorang (mousson, jeu dansant) & Panthalassa : deux cultures de l'eau,
    // plutôt une affinité qu'une haine.
    'panthalassa|rorang': {
      level: -1,
      label: '🤝 Cousins des eaux',
      blurb: "Peuples de la mer et de la mousson partagent un respect mutuel "
           + "pour le jeu fluide."
    },
    // Rorang vs Pilier : le jeu du peuple contre le prestige des hauteurs.
    'pilier|rorang': {
      level: 1,
      label: '🔥 Le peuple contre le prestige',
      blurb: "La ferveur populaire de Rorang défie volontiers la superbe "
           + "aristocratique du Pilier."
    },
  };

  function key(a, b){
    a = norm(a); b = norm(b);
    if(!a || !b || a === b) return null;
    return (a < b) ? (a + '|' + b) : (b + '|' + a);
  }

  // Relation entre deux nations, ou null si aucune / même nation.
  function get(a, b){
    var k = key(a, b);
    if(!k) return null;
    return REL[k] || null;
  }

  // Bonus de motivation appliqué EN MATCH (jamais dans teamStrength/OVR).
  // Une vraie rivalité galvanise : +2.5 pour un choc ardent, +1.2 pour une
  // tension. Une affinité (level -1) ne donne pas de bonus de haine → 0.
  function motivationBonus(a, b){
    var r = get(a, b);
    if(!r) return 0;
    if(r.level === 2) return 2.5;
    if(r.level === 1) return 1.2;
    return 0;
  }

  // Y a-t-il une relation notable (rivalité OU affinité) à annoncer ?
  function isNotable(a, b){
    var r = get(a, b);
    return !!r; // toute entrée de la table mérite un bandeau
  }

  window.NATION_RIVALRY = {
    get: get,
    motivationBonus: motivationBonus,
    isNotable: isNotable,
    norm: norm,
    // Retire tout bonus de rivalité résiduel (_rivalryBuff) d'une liste de
    // joueurs, en rendant le _hm à sa valeur d'avant-match. Idempotent.
    clearBuffs: function(players){
      if(!Array.isArray(players)) return;
      players.forEach(function(p){
        if(p && p._rivalryBuff){ p._hm = (p._hm||0) - p._rivalryBuff; p._rivalryBuff = 0; }
      });
    },
  };
})();
