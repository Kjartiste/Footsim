// ═══════════════════════════════════════════════════════════════════════
// ICONS.JS — Bibliothèque d'icônes SVG inline, cohérente (style ligne FM).
// ───────────────────────────────────────────────────────────────────────
// Objectif : remplacer les emojis dans le CHROME de l'UI (onglets, boutons,
// en-têtes de section) par un jeu d'icônes vectorielles homogène — trait
// régulier, grille 24, currentColor. On NE touche PAS aux emojis de contenu
// (logs de match, flavor text, données d'équipes) : ce sont des caractères
// dans des phrases, pas des éléments d'interface.
//
// Usage :  ICON('squad')            → SVG 1em, hérite color du parent
//          ICON('squad', {size:18}) → taille fixée
//          ICON('squad', {cls:'x'}) → classe CSS ajoutée
// Repli : ICON('inconnu') renvoie '' (aucun rendu), jamais d'erreur.
// ═══════════════════════════════════════════════════════════════════════
(function(){
  // Chaque entrée = contenu INTÉRIEUR du <svg> (paths en fill=none/stroke).
  const P = {
    // Navigation / sections carrière
    home:      '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    squad:     '<circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 6a3 3 0 0 1 0 6"/><path d="M17.5 20a5.5 5.5 0 0 0-3-4.9"/>',
    transfer:  '<path d="M4 8h13"/><path d="M14 5l3 3-3 3"/><path d="M20 16H7"/><path d="M10 13l-3 3 3 3"/>',
    academy:   '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M6 10.5V15c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5"/>',
    finances:  '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5a2.5 2 0 0 1 5 0c0 2.5-5 1.5-5 4a2.5 2 0 0 0 5 0"/>',
    sponsors:  '<path d="M8 11a4 4 0 0 1 0-6h8a4 4 0 0 1 0 6"/><path d="M8 5v9a4 4 0 0 0 8 0V5"/><path d="M9 20h6"/>',
    infra:     '<path d="M3 21h18"/><path d="M5 21V8l7-4 7 4v13"/><path d="M9 21v-5h6v5"/>',
    staff:     '<circle cx="12" cy="7" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/>',
    calendar:  '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/>',
    reserves:  '<path d="M4 21V9l8-5 8 5v12"/><path d="M4 13h16"/><path d="M12 4v17"/>',
    history:   '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 4v4h4"/><path d="M12 8v4l3 2"/>',
    scorers:   '<circle cx="12" cy="12" r="9"/><path d="M12 6l1.8 3.7 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z"/>',
    trophy:    '<path d="M7 4h10v4a5 5 0 0 1-10 0V4z"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3"/><path d="M9 15h6M8 20h8M12 15v5"/>',
    social:    '<path d="M20 12a8 8 0 1 1-3.4-6.5"/><path d="M21 4l-9 9-3-3"/>',
    ball:      '<circle cx="12" cy="12" r="9"/><path d="M12 7l3 2.2-1.1 3.5h-3.8L9 9.2z"/><path d="M12 3v4M4.5 9.5l3 1.3M19.5 9.5l-3 1.3M7.5 20l1.5-3.5M16.5 20L15 16.5"/>',
    // Actions / boutons
    play:      '<path d="M7 4.5v15l12-7.5z"/>',
    pause:     '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    fast:      '<path d="M4 5l8 7-8 7zM13 5l8 7-8 7z"/>',
    edit:      '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    check:     '<path d="M4 12.5l5 5 11-11"/>',
    close:     '<path d="M5 5l14 14M19 5L5 19"/>',
    arrowUp:   '<path d="M12 20V5M6 11l6-6 6 6"/>',
    arrowDown: '<path d="M12 5v15M6 13l6 6 6-6"/>',
    arrowLeft: '<path d="M20 12H5M11 6l-6 6 6 6"/>',
    arrowRight:'<path d="M4 12h15M13 6l6 6-6 6"/>',
    up:        '<path d="M12 20V5M6 11l6-6 6 6"/>',
    down:      '<path d="M12 5v15M6 13l6 6 6-6"/>',
    coin:      '<ellipse cx="12" cy="12" rx="9" ry="9"/><path d="M12 7v10M9.6 9.4a2.4 2 0 0 1 4.8 0c0 2.4-4.8 1.4-4.8 3.8a2.4 2 0 0 0 4.8 0"/>',
    doc:       '<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v4h4M9 13h6M9 17h6"/>',
    plus:      '<path d="M12 5v14M5 12h14"/>',
    warn:      '<path d="M12 3l9 16H3z"/><path d="M12 9v5M12 17h.01"/>',
    fire:      '<path d="M12 3c1 3-2 4-2 7a4 4 0 0 0 8 0c0-2-1-3-2-4 .5 2-1 3-1 3 .5-4-1-6-1-6z"/><path d="M9 13a3 3 0 1 0 6 0"/>',
  };
  const ALIAS = { mercato:'transfer', compet:'trophy', competitions:'trophy',
    effectif:'squad', buteurs:'scorers', reglages:'edit', save:'check' };

  window.ICON = function(name, opts){
    opts = opts || {};
    const key = ALIAS[name] || name;
    const body = P[key];
    if(!body) return '';
    const sz = opts.size ? (opts.size+'px') : '1em';
    const sw = opts.stroke || 2;
    const cls = opts.cls ? ' class="'+opts.cls+'"' : '';
    const va = opts.va || '-0.14em';
    return '<svg'+cls+' width="'+sz+'" height="'+sz+'" viewBox="0 0 24 24" fill="none" '
      + 'stroke="currentColor" stroke-width="'+sw+'" stroke-linecap="round" stroke-linejoin="round" '
      + 'style="display:inline-block;vertical-align:'+va+';flex-shrink:0">'+body+'</svg>';
  };
  window.ICON.has = function(name){ return !!P[ALIAS[name]||name]; };
})();
