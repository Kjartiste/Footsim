// ═══════════════════════════════════════════════════════════
// BADGES.JS — Éditeur & moteur de blasons (100% SVG, sans IA)
// ═══════════════════════════════════════════════════════════
// Système modulaire de blasons vectoriels. Un blason est décrit par un petit
// objet JSON (jamais une image) ; le SVG est régénéré à la demande et mis en
// cache. Modules exposés : SvgLibrary (formes), PatternLibrary (motifs),
// IconLibrary (icônes), PaletteManager (couleurs), BadgeRenderer (rendu),
// BadgeGenerator (aléatoire cohérent), BadgeSerializer, BadgeCache.
//
// Format JSON d'un blason :
//   { shape, border, background, colors:[c1,c2,c3], icon, iconColor,
//     iconScale, iconRot, iconX, iconY, text, textColor, year, stars,
//     starColor }
// Tous les champs sont optionnels ; des défauts sûrs s'appliquent.
// ═══════════════════════════════════════════════════════════

// Zone de dessin logique : tous les tracés visent un canevas 100×120.
const BADGE_W = 100, BADGE_H = 120, BCX = 50, BCY = 58;

// ── PaletteManager : palettes harmonieuses pour la génération ────────────
const PaletteManager = {
  // Combos (principale, secondaire, accent) volontairement cohérents.
  harmonies: [
    ['#0b3d91','#ffffff','#ffd700'], ['#7a0f0f','#f0e6d2','#c9a227'],
    ['#0d4d2b','#ffffff','#f0c028'], ['#1a1a2e','#e94560','#ffffff'],
    ['#2e2e2e','#e0e0e0','#d4af37'], ['#5b2a86','#f2d5ff','#ffd700'],
    ['#134e6f','#f5f5f5','#ff7f11'], ['#800020','#f8e9d6','#e8c547'],
    ['#004d40','#b2dfdb','#ffab00'], ['#1b1b3a','#4cc9f0','#f72585'],
    ['#3a2e12','#e8d8a0','#b08d2e'], ['#1d3557','#a8dadc','#e63946'],
  ],
  random(){ return this.harmonies[(Math.random()*this.harmonies.length)|0].slice(); },
  quick: ['#0b3d91','#7a0f0f','#0d4d2b','#1a1a2e','#5b2a86','#134e6f','#800020','#004d40','#2e2e2e','#c9a227','#ffffff','#e94560'],
};

// ── SvgLibrary : formes principales (path/element pour un canevas 100×120) ─
// Chaque forme renvoie un fragment SVG (le contour rempli de `fill`).
const SvgLibrary = {
  shapes: {
    shield_fr:   (f)=>`<path d="M12,14 H88 V64 Q88,104 50,116 Q12,104 12,64 Z" fill="${f}"/>`,
    shield_en:   (f)=>`<path d="M14,12 H86 V70 Q86,100 50,114 Q14,100 14,70 Z" fill="${f}"/>`,
    shield_es:   (f)=>`<path d="M12,12 H88 V72 Q88,108 50,116 Q12,108 12,72 Z" fill="${f}"/>`,
    shield_it:   (f)=>`<path d="M50,10 Q88,10 88,14 V66 Q88,104 50,116 Q12,104 12,66 V14 Q12,10 50,10 Z" fill="${f}"/>`,
    round:       (f)=>`<circle cx="50" cy="58" r="46" fill="${f}"/>`,
    oval:        (f)=>`<ellipse cx="50" cy="58" rx="40" ry="50" fill="${f}"/>`,
    hexagon:     (f)=>`<polygon points="50,10 90,34 90,82 50,110 10,82 10,34" fill="${f}"/>`,
    diamond:     (f)=>`<polygon points="50,8 92,58 50,112 8,58" fill="${f}"/>`,
    shield_mod:  (f)=>`<path d="M50,8 L90,20 V62 Q90,98 50,114 Q10,98 10,62 V20 Z" fill="${f}"/>`,
    shield_pt:   (f)=>`<path d="M12,14 H88 V58 L50,116 L12,58 Z" fill="${f}"/>`,
    circle_dbl:  (f)=>`<circle cx="50" cy="58" r="46" fill="${f}"/><circle cx="50" cy="58" r="38" fill="none" stroke="#00000022" stroke-width="1"/>`,
    banner:      (f)=>`<path d="M16,12 H84 V96 L50,114 L16,96 Z" fill="${f}"/>`,
    pentagon:    (f)=>`<polygon points="50,8 92,42 76,104 24,104 8,42" fill="${f}"/>`,
    octagon:     (f)=>`<polygon points="34,12 66,12 88,34 88,82 66,104 34,104 12,82 12,34" fill="${f}"/>`,
    minimal:     (f)=>`<rect x="14" y="16" width="72" height="84" rx="10" fill="${f}"/>`,
  },
  order: ['shield_fr','shield_en','shield_es','shield_it','round','oval','hexagon','diamond','shield_mod','shield_pt','circle_dbl','banner','pentagon','octagon','minimal'],
  labels: {
    shield_fr:'Écu français', shield_en:'Écu anglais', shield_es:'Écu espagnol', shield_it:'Écu italien',
    round:'Rond', oval:'Ovale', hexagon:'Hexagone', diamond:'Diamant', shield_mod:'Bouclier moderne',
    shield_pt:'Bouclier pointu', circle_dbl:'Cercle double', banner:'Bannière', pentagon:'Pentagone',
    octagon:'Octogone', minimal:'Minimaliste',
  },
  render(id,fill){ return (this.shapes[id]||this.shapes.shield_mod)(fill); },
  // Un contour approché pour la bordure (même silhouette, sans remplissage).
  outline(id,stroke,w){
    const s=this.shapes[id]||this.shapes.shield_mod;
    // On réutilise le path en le repeignant en "none" + stroke.
    return s('none').replace('fill="none"',`fill="none" stroke="${stroke}" stroke-width="${w}"`)
      .replace(/fill="[^"]*"/g,(m)=> m.includes('none')?m:`${m} stroke="${stroke}" stroke-width="${w}"`);
  },
};

// ── PatternLibrary : motifs de fond (clippés à la forme via clipPath) ─────
const PatternLibrary = {
  order: ['solid','vstripes','hstripes','diagonal','cross','chevron','checker','stripes','lozenge','half_l','half_r','quarters','gradient','circles','stars_bg','triangles','textile','sunburst','scales','wave'],
  labels: {
    solid:'Uni', vstripes:'Bandes verticales', hstripes:'Bandes horizontales', diagonal:'Diagonales',
    cross:'Croix', chevron:'Chevron', checker:'Échiquier', stripes:'Rayures', lozenge:'Losanges',
    half_l:'Moitié gauche', half_r:'Moitié droite', quarters:'Quartiers', gradient:'Dégradé',
    circles:'Cercles', stars_bg:'Étoiles', triangles:'Triangles', textile:'Motif textile',
    sunburst:'Soleil levant', scales:'Écailles', wave:'Vagues',
  },
  // Renvoie le contenu SVG du motif (sera clippé à la forme par le renderer).
  render(id, c1, c2, opacity){
    const o = (opacity==null?1:opacity);
    const g=(inner)=>`<g opacity="${o}">${inner}</g>`;
    switch(id){
      case 'vstripes': { let s=''; for(let x=0;x<100;x+=16) s+=`<rect x="${x}" y="0" width="8" height="120" fill="${c2}"/>`; return g(s); }
      case 'hstripes': { let s=''; for(let y=0;y<120;y+=16) s+=`<rect x="0" y="${y}" width="100" height="8" fill="${c2}"/>`; return g(s); }
      case 'diagonal': { let s=''; for(let i=-120;i<120;i+=18) s+=`<rect x="${i}" y="0" width="9" height="200" fill="${c2}" transform="rotate(30 50 58)"/>`; return g(s); }
      case 'cross':    return g(`<rect x="42" y="0" width="16" height="120" fill="${c2}"/><rect x="0" y="50" width="100" height="16" fill="${c2}"/>`);
      case 'chevron':  { let s=''; for(let y=-20;y<130;y+=22) s+=`<polygon points="0,${y} 50,${y+16} 100,${y} 100,${y+8} 50,${y+24} 0,${y+8}" fill="${c2}"/>`; return g(s); }
      case 'checker':  { let s=''; for(let y=0;y<120;y+=16)for(let x=0;x<100;x+=16) if(((x/16)+(y/16))%2===0) s+=`<rect x="${x}" y="${y}" width="16" height="16" fill="${c2}"/>`; return g(s); }
      case 'stripes':  { let s=''; for(let x=0;x<100;x+=8) s+=`<rect x="${x}" y="0" width="4" height="120" fill="${c2}"/>`; return g(s); }
      case 'lozenge':  { let s=''; for(let y=0;y<130;y+=20)for(let x=0;x<110;x+=20) s+=`<polygon points="${x},${y-10} ${x+10},${y} ${x},${y+10} ${x-10},${y}" fill="${c2}"/>`; return g(s); }
      case 'half_l':   return g(`<rect x="0" y="0" width="50" height="120" fill="${c2}"/>`);
      case 'half_r':   return g(`<rect x="50" y="0" width="50" height="120" fill="${c2}"/>`);
      case 'quarters': return g(`<rect x="0" y="0" width="50" height="60" fill="${c2}"/><rect x="50" y="60" width="50" height="60" fill="${c2}"/>`);
      case 'gradient': return `<defs><linearGradient id="bgrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c2}" stop-opacity="${o}"/><stop offset="1" stop-color="${c2}" stop-opacity="0"/></linearGradient></defs><rect x="0" y="0" width="100" height="120" fill="url(#bgrad)"/>`;
      case 'circles':  { let s=''; for(let y=10;y<120;y+=24)for(let x=10;x<100;x+=24) s+=`<circle cx="${x}" cy="${y}" r="6" fill="${c2}"/>`; return g(s); }
      case 'stars_bg': { let s=''; for(let y=14;y<120;y+=28)for(let x=14;x<100;x+=28) s+=_starPath(x,y,6,c2); return g(s); }
      case 'triangles':{ let s=''; for(let y=0;y<120;y+=20)for(let x=0;x<100;x+=20) s+=`<polygon points="${x},${y+18} ${x+10},${y} ${x+20},${y+18}" fill="${c2}"/>`; return g(s); }
      case 'textile':  { let s=''; for(let y=0;y<120;y+=6) s+=`<rect x="0" y="${y}" width="100" height="3" fill="${c2}" opacity="0.35"/>`; return g(s); }
      case 'sunburst': {
        let s=''; const rays=14;
        for(let i=0;i<rays;i++){
          const a1=(360/rays)*i*Math.PI/180, a2=((360/rays)*i+(360/rays)/2)*Math.PI/180;
          s+=`<polygon points="50,58 ${(50+80*Math.cos(a1)).toFixed(1)},${(58+80*Math.sin(a1)).toFixed(1)} ${(50+80*Math.cos(a2)).toFixed(1)},${(58+80*Math.sin(a2)).toFixed(1)}" fill="${c2}"/>`;
        }
        return g(s);
      }
      case 'scales': {
        let s=''; let row=0;
        for(let y=-6;y<126;y+=13){ const off=(row%2)?7:0;
          for(let x=off-7;x<108;x+=14) s+=`<path d="M${x},${y} a7,7 0 0,1 14,0" fill="none" stroke="${c2}" stroke-width="1.4" opacity="0.8"/>`;
          row++;
        }
        return g(s);
      }
      case 'wave': {
        let s=''; for(let y=8;y<120;y+=15){
          s+=`<path d="M-6,${y} Q12,${y-8} 25,${y} Q38,${y+8} 50,${y} Q62,${y-8} 75,${y} Q88,${y+8} 106,${y}" stroke="${c2}" stroke-width="2.4" fill="none" opacity="0.85"/>`;
        }
        return g(s);
      }
      case 'solid': default: return '';
    }
  },
};

// Petit helper étoile (utilisé par les motifs + la couche étoiles).
function _starPath(cx,cy,r,fill){
  let pts=''; for(let i=0;i<10;i++){ const a=Math.PI/5*i-Math.PI/2; const rr=i%2?r*0.45:r; pts+=`${(cx+Math.cos(a)*rr).toFixed(1)},${(cy+Math.sin(a)*rr).toFixed(1)} `; }
  return `<polygon points="${pts.trim()}" fill="${fill}"/>`;
}

// Éclaircit (pct>0) ou assombrit (pct<0) une couleur hex (#rrggbb) — utilisé
// pour donner du volume aux icônes (ombres/reflets) sans changer leur API.
function _shade(hex, pct){
  if(typeof hex!=='string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const f=parseInt(hex.slice(1),16), t=pct<0?0:255, p=Math.abs(pct);
  const R=f>>16, G=(f>>8)&0xFF, B=f&0xFF;
  const nr=Math.round((t-R)*p)+R, ng=Math.round((t-G)*p)+G, nb=Math.round((t-B)*p)+B;
  return '#'+(0x1000000+nr*0x10000+ng*0x100+nb).toString(16).slice(1);
}

// Petit anneau de laurier décoratif, utilisé par la bordure "laurel_ring".
// Les points suivent approximativement la silhouette d'un écu (indépendant
// de la forme exacte : c'est un ornement posé par-dessus, comme en héraldique).
function _laurelRing(color){
  const left =[[42,114],[30,110],[20,101],[13,89],[9,75],[8,59],[10,43],[15,29]];
  const right=[[58,114],[70,110],[80,101],[87,89],[91,75],[92,59],[90,43],[85,29]];
  let s='';
  const draw=(pts,flip)=>{
    for(let i=0;i<pts.length;i++){
      const [x,y]=pts[i];
      const nxt=pts[i+1]||pts[i], prv=pts[i-1]||pts[i];
      const tangent=Math.atan2(nxt[1]-prv[1], nxt[0]-prv[0])*180/Math.PI;
      const ang=tangent + (flip?-100:100);
      const sc=(0.85+(i%2?0.15:0))*(flip?-1:1);
      s+=`<g transform="translate(${x},${y}) rotate(${ang}) scale(${sc},${Math.abs(sc)})">`+
         `<path d="M0,0 Q5,-2.6 10,0 Q5,2.6 0,0 Z" fill="${color}"/>`+
         `<path d="M0.5,0 L9.5,0" stroke="${_shade(color,-0.3)}" stroke-width="0.5" opacity="0.6"/>`+
         `</g>`;
    }
  };
  draw(left,false); draw(right,true);
  return s;
}

// ── IconLibrary : icônes vectorielles (dessinées dans une boîte ~40×40) ───
// Chaque icône est stylisée/silhouette pour rester lisible en petit.
const IconLibrary = {
  order: ['lion','eagle','wolf','bear','fox','dragon','phoenix','deer','bull','raven','horse','panther',
          'griffin','falcon','boar','ball','cup','crown','sword','shield','star','mountain','forest','castle','tower',
          'anchor','bolt','flame','leaf','laurel'],
  labels: {
    lion:'Lion', eagle:'Aigle', wolf:'Loup', bear:'Ours', fox:'Renard', dragon:'Dragon', phoenix:'Phénix',
    deer:'Cerf', bull:'Taureau', raven:'Corbeau', horse:'Cheval', panther:'Panthère', griffin:'Griffon',
    falcon:'Faucon', boar:'Sanglier',
    ball:'Ballon', cup:'Coupe', crown:'Couronne', sword:'Épée', shield:'Bouclier', star:'Étoile',
    mountain:'Montagne', forest:'Forêt', castle:'Château', tower:'Tour', anchor:'Ancre', bolt:'Éclair',
    flame:'Flamme', leaf:'Feuille', laurel:'Laurier',
  },
  // Toutes les icônes dessinent dans un repère -20..20 (centré en 0,0).
  paths: {
    ball:    (c)=>{ const d=_shade(c,-0.4), h=_shade(c,0.5);
      return `<circle cx="0" cy="0" r="16" fill="${c}"/><circle cx="-4" cy="-5" r="9" fill="${h}" opacity="0.35"/>`+
        `<path d="M0,-16 L6,-4 L0,4 L-6,-4 Z" fill="${d}"/>`+
        `<path d="M6,-4 L16,-2 M-6,-4 L-16,-2 M0,4 L-8,14 M0,4 L8,14" stroke="${d}" stroke-width="1.5" fill="none"/>`+
        `<circle cx="0" cy="0" r="16" fill="none" stroke="#00000033" stroke-width="1"/>`; },
    star:    (c)=>{ const h=_shade(c,0.45);
      return _starPath(0,0,17,c)+`<polygon points="0,-17 5.1,-2.1 0,0" fill="${h}" opacity="0.5"/>`; },
    crown:   (c)=>{ const d=_shade(c,-0.35), h=_shade(c,0.4);
      return `<path d="M-16,8 L-16,-6 L-8,2 L0,-10 L8,2 L16,-6 L16,8 Z" fill="${c}"/>`+
        `<path d="M-16,8 L-16,-6 L-8,2 L-2,-8 L-2,8 Z" fill="${h}" opacity="0.35"/>`+
        `<rect x="-16" y="8" width="32" height="4" fill="${d}"/>`+
        `<circle cx="0" cy="-9" r="2" fill="#ffffff"/><circle cx="-8" cy="1" r="1.6" fill="#ffffff"/><circle cx="8" cy="1" r="1.6" fill="#ffffff"/>`; },
    shield:  (c)=>{ const d=_shade(c,-0.3), h=_shade(c,0.35);
      return `<path d="M-13,-14 H13 V2 Q13,14 0,18 Q-13,14 -13,2 Z" fill="${c}"/>`+
        `<path d="M-13,-14 H0 V18 Q-13,14 -13,2 Z" fill="${h}" opacity="0.25"/>`+
        `<path d="M-13,-14 H13 V2 Q13,14 0,18 Q-13,14 -13,2 Z" fill="none" stroke="${d}" stroke-width="1"/>`; },
    sword:   (c)=>{ const d=_shade(c,-0.3), h=_shade(c,0.4);
      return `<path d="M-2,-18 H2 V8 H6 L0,16 L-6,8 H-2 Z" fill="${c}"/>`+
        `<path d="M-2,-18 H0 V16 L-2,10 Z" fill="${h}" opacity="0.4"/>`+
        `<rect x="-8" y="6" width="16" height="3" fill="${d}"/><rect x="-1" y="6" width="2" height="10" fill="${d}" opacity="0.6"/>`; },
    cup:     (c)=>{ const d=_shade(c,-0.3), h=_shade(c,0.45);
      return `<path d="M-10,-12 H10 V-4 Q10,6 0,8 Q-10,6 -10,-4 Z" fill="${c}"/>`+
        `<path d="M-10,-12 H0 V8 Q-10,6 -10,-4 Z" fill="${h}" opacity="0.3"/>`+
        `<rect x="-3" y="8" width="6" height="6" fill="${d}"/><rect x="-9" y="14" width="18" height="4" fill="${d}"/>`+
        `<path d="M-10,-10 Q-18,-8 -14,2 M10,-10 Q18,-8 14,2" stroke="${c}" stroke-width="2.5" fill="none"/>`+
        `<path d="M-6,-9 H4" stroke="${h}" stroke-width="1.5" opacity="0.7"/>`; },
    bolt:    (c)=>{ const d=_shade(c,-0.35);
      return `<polygon points="2,-18 -8,2 -1,2 -4,18 10,-4 2,-4" fill="${c}"/><polygon points="2,-18 -3,0 -1,2 2,-4" fill="${d}" opacity="0.55"/>`; },
    flame:   (c)=>{ const d=_shade(c,-0.3), h=_shade(c,0.5);
      return `<path d="M0,-18 Q10,-6 6,4 Q14,2 8,14 Q4,20 0,18 Q-4,20 -8,14 Q-14,2 -6,4 Q-10,-6 0,-18 Z" fill="${d}"/>`+
        `<path d="M0,-12 Q6,-2 4,6 Q8,10 4,15 Q0,17 -2,14 Q-6,8 -2,4 Q-5,-2 0,-12 Z" fill="${c}"/>`+
        `<path d="M0,-4 Q2,4 0,10" stroke="${h}" stroke-width="2" fill="none" opacity="0.7"/>`; },
    leaf:    (c)=>{ const d=_shade(c,-0.25), h=_shade(c,0.4);
      return `<path d="M0,16 Q-14,4 -8,-10 Q0,-18 8,-10 Q14,4 0,16 Z" fill="${c}"/>`+
        `<path d="M0,16 Q-14,4 -8,-10 Q0,-18 0,-18 Z" fill="${h}" opacity="0.3"/>`+
        `<path d="M0,14 V-6 M0,2 L-5,-4 M0,2 L5,-4 M0,-4 L-4,-8 M0,-4 L4,-8" stroke="${d}" stroke-width="1" fill="none"/>`; },
    laurel:  (c)=>`<path d="M-4,16 Q-16,6 -12,-10 M-4,16 Q4,6 0,-12 M4,16 Q16,6 12,-10 M4,16 Q-4,6 0,-12" stroke="${c}" stroke-width="3" fill="none"/>`+
        `<path d="M-4,16 Q-16,6 -12,-10" stroke="${_shade(c,0.4)}" stroke-width="1" fill="none" opacity="0.5"/>`,
    anchor:  (c)=>{ const h=_shade(c,0.4);
      return `<circle cx="0" cy="-14" r="4" fill="none" stroke="${c}" stroke-width="3"/><rect x="-1.5" y="-10" width="3" height="22" fill="${c}"/>`+
        `<rect x="-8" y="-6" width="16" height="3" fill="${c}"/><path d="M-12,8 Q-12,16 0,16 Q12,16 12,8" stroke="${c}" stroke-width="3" fill="none"/>`+
        `<rect x="-0.5" y="-10" width="1" height="20" fill="${h}" opacity="0.6"/>`; },
    mountain:(c)=>{ const d=_shade(c,-0.3), h=_shade(c,0.5);
      return `<polygon points="-16,14 -4,-8 2,2 8,-12 16,14" fill="${d}"/>`+
        `<polygon points="-16,14 -4,-8 0,-4 -9,14" fill="${c}"/><polygon points="8,-12 16,14 3,14 4,0" fill="${c}"/>`+
        `<polygon points="-4,-8 -1,-3 1,-5 -2.5,-9" fill="${h}"/><polygon points="8,-12 10,-8 6,-6 5,-10" fill="${h}"/>`; },
    tower:   (c)=>{ const d=_shade(c,-0.3), h=_shade(c,0.35);
      return `<rect x="-8" y="-6" width="16" height="22" fill="${c}"/><rect x="-8" y="-6" width="6" height="22" fill="${h}" opacity="0.3"/>`+
        `<path d="M-10,-6 V-12 H-6 V-8 H-2 V-12 H2 V-8 H6 V-12 H10 V-6 Z" fill="${c}"/>`+
        `<rect x="-2.5" y="4" width="5" height="12" fill="${d}"/><rect x="-6" y="-2" width="3" height="3" fill="${d}"/><rect x="3" y="-2" width="3" height="3" fill="${d}"/>`; },
    castle:  (c)=>{ const d=_shade(c,-0.3), h=_shade(c,0.35);
      return `<rect x="-16" y="-2" width="32" height="18" fill="${c}"/><rect x="-16" y="-2" width="12" height="18" fill="${h}" opacity="0.25"/>`+
        `<path d="M-16,-2 V-8 H-11 V-4 H-6 V-8 H-1 V-4 H4 V-8 H9 V-4 H14 V-8 H16 V-2 Z" fill="${c}"/>`+
        `<rect x="-4" y="4" width="8" height="12" fill="#00000055"/><rect x="-13" y="2" width="4" height="4" fill="${d}"/><rect x="9" y="2" width="4" height="4" fill="${d}"/>`; },
    forest:  (c)=>{ const d=_shade(c,-0.3), h=_shade(c,0.4);
      return `<polygon points="-10,16 -18,16 -14,4 -16,4 -10,-14 -4,4 -6,4 -2,16" fill="${c}"/>`+
        `<polygon points="10,16 2,16 6,4 4,4 10,-14 16,4 14,4 18,16" fill="${d}"/>`+
        `<polygon points="-10,16 -14,4 -12,4 -10,-8" fill="${h}" opacity="0.4"/>`; },
    // Animaux (ombres/reflets pour donner du volume, quelques traits de détail)
    lion:    (c)=>{ const d=_shade(c,-0.35), h=_shade(c,0.35);
      return `<path d="M0,-16 L6,-11 L14,-14 L11,-6 L17,0 L11,6 L14,14 L6,11 L0,16 L-6,11 L-14,14 L-11,6 L-17,0 L-11,-6 L-14,-14 L-6,-11 Z" fill="${d}"/>`+
        `<path d="M0,-16 L6,-11 L14,-14 L11,-6 L17,0 L11,-3 L4,-9 Z" fill="${_shade(c,-0.1)}" opacity="0.5"/>`+
        `<circle cx="0" cy="0" r="10" fill="${c}"/><circle cx="-2" cy="-3" r="7" fill="${h}" opacity="0.3"/>`+
        `<path d="M-4,3 Q0,6 4,3" stroke="#00000077" stroke-width="1" fill="none"/>`+
        `<circle cx="-3.2" cy="-2" r="1.4" fill="#000000aa"/><circle cx="3.2" cy="-2" r="1.4" fill="#000000aa"/><path d="M0,0 L0,2.5" stroke="#00000077" stroke-width="1"/>`; },
    eagle:   (c)=>{ const d=_shade(c,-0.3);
      return `<path d="M0,-6 Q-4,-14 -2,-16 Q2,-14 4,-16 Q6,-14 2,-6 Z" fill="#e8c547"/>`+
        `<path d="M0,-4 Q-18,-10 -20,0 Q-10,-2 0,4 Q10,-2 20,0 Q18,-10 0,-4 Z" fill="${c}"/>`+
        `<path d="M-16,-6 Q-10,-4 -4,-2 M-12,-3 Q-7,-1 -2,0 M16,-6 Q10,-4 4,-2 M12,-3 Q7,-1 2,0" stroke="${d}" stroke-width="1" fill="none" opacity="0.6"/>`+
        `<polygon points="-2,4 2,4 0,14" fill="#e8c547"/><circle cx="-1.5" cy="-8" r="1" fill="#000"/>`; },
    wolf:    (c)=>{ const d=_shade(c,-0.35), h=_shade(c,0.35);
      return `<polygon points="-12,-14 -4,-6 0,-8 4,-6 12,-14 10,-2 6,10 0,16 -6,10 -10,-2" fill="${d}"/>`+
        `<polygon points="-12,-14 -4,-6 0,-8 -2,2 -10,-2" fill="${h}" opacity="0.35"/>`+
        `<circle cx="-3" cy="-2" r="1.3" fill="#00000088"/><circle cx="3" cy="-2" r="1.3" fill="#00000088"/>`+
        `<path d="M0,2 L0,7 M-3,9 L0,7 L3,9" stroke="#00000066" stroke-width="1" fill="none"/>`; },
    bear:    (c)=>{ const d=_shade(c,-0.3), h=_shade(c,0.35);
      return `<circle cx="-10" cy="-12" r="4" fill="${d}"/><circle cx="10" cy="-12" r="4" fill="${d}"/>`+
        `<circle cx="0" cy="0" r="14" fill="${c}"/><circle cx="-4" cy="-5" r="8" fill="${h}" opacity="0.3"/>`+
        `<circle cx="0" cy="4" r="4" fill="#00000055"/><circle cx="-5" cy="-2" r="1.4" fill="#000000aa"/><circle cx="5" cy="-2" r="1.4" fill="#000000aa"/>`; },
    fox:     (c)=>{ const d=_shade(c,-0.3);
      return `<polygon points="-12,-16 -6,-4 0,-8 6,-4 12,-16 8,2 0,16 -8,2" fill="${c}"/>`+
        `<polygon points="-6,-4 0,-8 6,-4 0,2" fill="#ffffff77"/>`+
        `<polygon points="-12,-16 -6,-4 -3,-5 -8,-13" fill="${d}" opacity="0.5"/>`+
        `<circle cx="-3" cy="-6" r="1" fill="#000"/><circle cx="3" cy="-6" r="1" fill="#000"/>`; },
    dragon:  (c)=>{ const d=_shade(c,-0.3), h=_shade(c,0.4);
      return `<path d="M-16,4 Q-8,-4 -6,-12 Q-2,-6 2,-12 Q6,-4 14,-6 Q8,4 14,10 Q4,8 0,16 Q-4,8 -14,10 Q-8,4 -16,4 Z" fill="${d}"/>`+
        `<path d="M-16,4 Q-8,-4 -6,-12 Q-2,-6 2,-12 Q0,-4 -6,2 Q-10,6 -16,4 Z" fill="${c}"/>`+
        `<path d="M-6,-12 Q-4,-14 -2,-13 M2,-12 Q4,-14 6,-13" stroke="${h}" stroke-width="1" fill="none"/><circle cx="-9" cy="-2" r="1" fill="#ffcc00"/>`; },
    phoenix: (c)=>{ const d=_shade(c,-0.25), h=_shade(c,0.45);
      return `<path d="M0,-16 Q6,-6 16,-8 Q10,0 18,6 Q6,6 0,16 Q-6,6 -18,6 Q-10,0 -16,-8 Q-6,-6 0,-16 Z" fill="${d}"/>`+
        `<path d="M0,-16 Q6,-6 16,-8 Q10,0 6,2 Q0,-2 0,-16 Z" fill="${h}" opacity="0.45"/>`+
        `<path d="M0,-16 Q6,-6 16,-8 Q10,0 18,6 Q6,6 0,16 Q-6,6 -18,6 Q-10,0 -16,-8 Q-6,-6 0,-16 Z" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.6"/>`; },
    deer:    (c)=>{ const d=_shade(c,-0.3), h=_shade(c,0.35);
      return `<path d="M-10,-16 Q-8,-8 -4,-10 M10,-16 Q8,-8 4,-10 M-6,-12 L-6,-18 M6,-12 L6,-18 M-6,-16 L-9,-17 M6,-16 L9,-17" stroke="${d}" stroke-width="2.2" fill="none"/>`+
        `<ellipse cx="0" cy="4" rx="7" ry="11" fill="${c}"/><ellipse cx="-2" cy="0" rx="3" ry="6" fill="${h}" opacity="0.4"/><circle cx="0" cy="-8" r="1" fill="#000"/>`; },
    bull:    (c)=>{ const h=_shade(c,0.35);
      return `<path d="M-16,-10 Q-20,-2 -12,-2 M16,-10 Q20,-2 12,-2" stroke="${_shade(c,-0.1)}" stroke-width="3" fill="none"/>`+
        `<ellipse cx="0" cy="2" rx="11" ry="13" fill="${c}"/><ellipse cx="-3" cy="-2" rx="5" ry="7" fill="${h}" opacity="0.35"/>`+
        `<circle cx="-4" cy="-2" r="1.5" fill="#00000088"/><circle cx="4" cy="-2" r="1.5" fill="#00000088"/><path d="M-3,7 Q0,9 3,7" stroke="#00000066" stroke-width="1" fill="none"/>`; },
    raven:   (c)=>{ const d=_shade(c,-0.3), h=_shade(c,0.4);
      return `<path d="M-18,2 Q-6,-2 0,-14 Q4,-4 18,-6 Q8,4 12,12 Q2,8 0,16 Q-4,8 -12,10 Q-8,4 -18,2 Z" fill="${d}"/>`+
        `<path d="M-18,2 Q-6,-2 0,-14 Q4,-4 6,-3 Q-6,0 -18,2 Z" fill="${h}" opacity="0.3"/>`+
        `<circle cx="2" cy="-8" r="1" fill="#ffcc00"/><path d="M4,-8 L10,-9" stroke="#e8c547" stroke-width="1.4"/>`; },
    horse:   (c)=>{ const d=_shade(c,-0.3), h=_shade(c,0.4);
      return `<path d="M-6,-16 Q4,-14 6,-4 L12,2 Q14,10 8,16 L4,10 Q0,4 -4,8 Q-10,6 -8,-4 Q-10,-12 -6,-16 Z" fill="${c}"/>`+
        `<path d="M-6,-16 Q4,-14 6,-4 L4,-2 Q-2,-8 -8,-4 Q-10,-12 -6,-16 Z" fill="${h}" opacity="0.35"/>`+
        `<path d="M-6,-16 Q-4,-13 -7,-10 M-4,-14 Q-2,-11 -5,-8" stroke="${d}" stroke-width="1" opacity="0.6"/><circle cx="0" cy="-6" r="1" fill="#000"/>`; },
    panther: (c)=>{ const h=_shade(c,0.3);
      return `<path d="M-14,-10 Q-6,-14 0,-10 Q6,-14 14,-10 Q10,0 14,10 Q4,6 0,16 Q-4,6 -14,10 Q-10,0 -14,-10 Z" fill="${c}"/>`+
        `<path d="M-14,-10 Q-6,-14 0,-10 Q-2,-2 -8,0 Q-12,-4 -14,-10 Z" fill="${h}" opacity="0.25"/>`+
        `<circle cx="-4" cy="-4" r="1.3" fill="#ffffff88"/><circle cx="4" cy="-4" r="1.3" fill="#ffffff88"/><path d="M-3,6 Q0,8 3,6" stroke="#00000055" stroke-width="1" fill="none"/>`; },
    griffin: (c)=>{ const d=_shade(c,-0.3), h=_shade(c,0.4);
      return `<path d="M0,-16 Q6,-10 4,-4 Q16,-8 16,2 Q8,4 8,12 Q0,8 -8,12 Q-8,4 -16,2 Q-16,-8 -4,-4 Q-6,-10 0,-16 Z" fill="${d}"/>`+
        `<path d="M0,-16 Q6,-10 4,-4 Q0,-2 -4,-4 Q-6,-10 0,-16 Z" fill="${c}"/>`+
        `<path d="M4,-4 Q16,-8 16,2 Q8,4 8,12" fill="none" stroke="${h}" stroke-width="0.8" opacity="0.6"/><circle cx="0" cy="-8" r="1" fill="#e8c547"/>`; },
    falcon:  (c)=>{ const d=_shade(c,-0.3), h=_shade(c,0.4);
      return `<path d="M0,-16 Q-2,-10 -6,-8 Q-16,-6 -18,2 Q-8,0 -2,4 Q0,10 -2,16 Q2,10 4,4 Q10,0 20,2 Q18,-6 8,-8 Q4,-10 0,-16 Z" fill="${d}"/>`+
        `<path d="M0,-16 Q-2,-10 -6,-8 Q-16,-6 -18,2 Q-8,0 -2,-1 Q-1,-8 0,-16 Z" fill="${h}" opacity="0.35"/>`+
        `<circle cx="0" cy="-8" r="1.1" fill="#000"/><path d="M0,-9 L3,-7 L0,-6 Z" fill="#e8c547"/>`; },
    boar:    (c)=>{ const d=_shade(c,-0.3), h=_shade(c,0.35);
      return `<ellipse cx="0" cy="2" rx="12" ry="10" fill="${d}"/><ellipse cx="-3" cy="-1" rx="6" ry="6" fill="${h}" opacity="0.3"/>`+
        `<polygon points="8,4 16,0 14,8 6,8" fill="#f0f0f0"/><polygon points="8,-2 16,-6 13,2 6,2" fill="#e8e8e8"/>`+
        `<circle cx="-6" cy="-2" r="1.3" fill="#000"/><path d="M-10,-8 L-6,-10 M-8,-9 L-4,-11" stroke="${d}" stroke-width="1.4"/>`; },
  },
  render(id,color){ return (this.paths[id]||this.paths.shield)(color); },
};

// ── BadgeSerializer : normalise / valide un blason JSON ──────────────────
const BadgeSerializer = {
  defaults(){
    return { shape:'shield_mod', border:'simple', background:'solid',
      colors:['#0b3d91','#ffffff','#ffd700'], icon:'shield', iconColor:'#ffd700',
      iconScale:1, iconRot:0, iconX:0, iconY:-6,
      icon2:'none', icon2Color:'#ffffff', icon2Scale:0.5, icon2X:0, icon2Y:22,
      text:'', textColor:'#ffffff', textArc:false, motto:'',
      year:'', stars:0, starColor:'#ffd700', bgOpacity:1 };
  },
  normalize(b){
    const d=this.defaults();
    if(!b || typeof b!=='object') return d;
    const out=Object.assign(d, b);
    if(!Array.isArray(out.colors)||out.colors.length<2) out.colors=d.colors.slice();
    out.stars=Math.max(0,Math.min(10, out.stars|0));
    return out;
  },
  toJSON(b){ return JSON.stringify(this.normalize(b)); },
  fromJSON(s){ try{ return this.normalize(JSON.parse(s)); }catch(e){ return this.defaults(); } },
};

// ── BadgeRenderer : JSON → chaîne SVG complète ───────────────────────────
const BadgeRenderer = {
  borders: {
    simple:{w:2.5,col:null}, double:{w:2,col:null,double:true}, triple:{w:1.6,col:null,triple:true},
    gold:{w:3,gradient:['#fff6d0','#e8c547','#a8791a']}, silver:{w:3,gradient:['#ffffff','#c8c8d0','#8a8a94']}, thick:{w:5,col:null},
    thin:{w:1,col:null}, cut:{w:2.5,col:null,dash:'6 4'}, modern:{w:2,col:'#ffffff'}, vintage:{w:2.5,col:'#7a5c3a',dash:'2 3'},
    beaded:{w:3.2,col:null,dash:'0.1 5.8',cap:'round'}, chain:{w:4.2,col:null,dash:'5 3',cap:'round'},
    embossed:{w:2,col:null,emboss:true}, ornate:{w:1.8,col:null,double:true,twoTone:true},
    laurel_ring:{w:1.4,col:null,laurel:true},
  },
  borderLabels:{simple:'Simple',double:'Double',triple:'Triple',gold:'Dorée',silver:'Argentée',thick:'Épaisse',thin:'Fine',cut:'Découpée',modern:'Moderne',vintage:'Vintage',
    beaded:'Perlée',chain:'Chaînée',embossed:'Gravée',ornate:'Ornementée',laurel_ring:'Couronne de laurier'},

  render(badge, opts){
    const b = BadgeSerializer.normalize(badge);
    opts = opts||{};
    const size = opts.size || 64;
    const [c1,c2,c3] = [b.colors[0], b.colors[1]||'#ffffff', b.colors[2]||'#ffd700'];
    const clipId = 'bc'+(Math.random()*1e9|0);

    // 1) Forme (sert aussi de clip pour le motif)
    const shapeFill = SvgLibrary.render(b.shape, c1);
    // 2) Motif de fond, clippé à la forme
    const pattern = PatternLibrary.render(b.background, c1, c2, b.bgOpacity);
    // 3) Bordure : on retrace la silhouette en stroke (dégradés + insets corrects)
    const bd = this.borders[b.border] || this.borders.simple;
    let borderDefs = '';
    let bcol = bd.col || c3;
    if(bd.gradient){
      const gid = 'bg'+(Math.random()*1e9|0);
      borderDefs += `<linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">`+
        `<stop offset="0" stop-color="${bd.gradient[0]}"/><stop offset="0.5" stop-color="${bd.gradient[1]}"/><stop offset="1" stop-color="${bd.gradient[2]}"/></linearGradient>`;
      bcol = `url(#${gid})`;
    }
    const capAttr = bd.cap ? ` stroke-linecap="${bd.cap}"` : '';
    let border = SvgLibrary.render(b.shape, 'none').replace(/fill="[^"]*"/,`fill="none" stroke="${bcol}" stroke-width="${bd.w}"${bd.dash?` stroke-dasharray="${bd.dash}"`:''}${capAttr}`);
    // Insets concentriques : on recentre l'échelle sur (50,58) au lieu d'utiliser
    // transform-origin (non fiable en SVG) — corrige le décalage de l'ancien double/triple.
    if(bd.double || bd.triple){
      const innerCol = bd.twoTone ? (b.colors[1]||'#ffffff') : bcol;
      const ins = SvgLibrary.render(b.shape,'none').replace(/fill="[^"]*"/,`fill="none" stroke="${innerCol}" stroke-width="${bd.w*0.55}"`);
      border += `<g transform="translate(50 58) scale(0.9) translate(-50 -58)">${ins}</g>`;
      if(bd.triple){
        const ins2 = SvgLibrary.render(b.shape,'none').replace(/fill="[^"]*"/,`fill="none" stroke="${bcol}" stroke-width="${bd.w*0.4}"`);
        border += `<g transform="translate(50 58) scale(0.81) translate(-50 -58)">${ins2}</g>`;
      }
    }
    if(bd.emboss){
      const light = SvgLibrary.render(b.shape,'none').replace(/fill="[^"]*"/,`fill="none" stroke="#ffffff99" stroke-width="${bd.w*0.6}"`);
      const dark  = SvgLibrary.render(b.shape,'none').replace(/fill="[^"]*"/,`fill="none" stroke="#00000066" stroke-width="${bd.w*0.6}"`);
      border += `<g transform="translate(0.7,0.7)">${dark}</g><g transform="translate(-0.7,-0.7)">${light}</g>`;
    }
    if(bd.laurel) border += _laurelRing(c3);
    // 4) Icône principale
    let icon='';
    if(b.icon && b.icon!=='none'){
      const ix=BCX+(b.iconX||0), iy=BCY+(b.iconY||0), sc=b.iconScale||1, rot=b.iconRot||0;
      icon=`<g transform="translate(${ix},${iy}) rotate(${rot}) scale(${sc})">${IconLibrary.render(b.icon,b.iconColor||c3)}</g>`;
    }
    // 4b) Icône secondaire (couche indépendante)
    let icon2='';
    if(b.icon2 && b.icon2!=='none'){
      const ix=BCX+(b.icon2X||0), iy=BCY+(b.icon2Y!=null?b.icon2Y:22), sc=b.icon2Scale||0.5;
      icon2=`<g transform="translate(${ix},${iy}) scale(${sc})">${IconLibrary.render(b.icon2,b.icon2Color||c2)}</g>`;
    }
    // 5) Texte principal (abréviation/sigle) — droit ou en arc
    let text='';
    if(b.text){
      if(b.textArc){
        // Texte le long d'un arc supérieur (textPath sur un cercle).
        const pid='ta'+(Math.random()*1e9|0);
        text=`<defs><path id="${pid}" d="M18,54 A34,34 0 0,1 82,54" fill="none"/></defs>
          <text font-family="'Barlow Condensed',sans-serif" font-weight="900" font-size="13" fill="${b.textColor||c2}" letter-spacing="1">
          <textPath href="#${pid}" startOffset="50%" text-anchor="middle">${_esc(b.text)}</textPath></text>`;
      } else {
        text=`<text x="50" y="102" text-anchor="middle" font-family="'Barlow Condensed',sans-serif" font-weight="900" font-size="15" fill="${b.textColor||c2}" letter-spacing="1">${_esc(b.text)}</text>`;
      }
    }
    // 5b) Devise (motto) en bas, petite
    let motto='';
    if(b.motto){
      motto=`<text x="50" y="110" text-anchor="middle" font-family="serif" font-style="italic" font-size="6" fill="${b.textColor||c2}" opacity="0.85">${_esc(b.motto)}</text>`;
    }
    // 6) Année
    let year='';
    if(b.year){ year=`<text x="50" y="90" text-anchor="middle" font-family="sans-serif" font-size="7" fill="${b.textColor||c2}" opacity="0.85">${_esc(String(b.year))}</text>`; }
    // 7) Étoiles (au-dessus)
    let stars='';
    if(b.stars>0){
      const n=b.stars, gap=11, totalW=(n-1)*gap, x0=50-totalW/2;
      for(let i=0;i<n;i++) stars+=`<g transform="translate(${x0+i*gap},20) scale(0.5)">${_starPath(0,0,7,b.starColor||'#ffd700')}</g>`;
    }

    const inner = `
      <defs><clipPath id="${clipId}">${SvgLibrary.render(b.shape,'#000')}</clipPath>${borderDefs}</defs>
      ${shapeFill}
      <g clip-path="url(#${clipId})">${pattern}</g>
      ${border}
      ${icon}${icon2}${stars}${year}${text}${motto}`;

    return `<svg width="${size}" height="${size*1.2}" viewBox="0 0 ${BADGE_W} ${BADGE_H}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  },

  // Renvoie une data-URI (utilisable directement dans <img src>).
  toDataURI(badge, opts){
    const svg=this.render(badge,opts);
    return 'data:image/svg+xml;utf8,'+encodeURIComponent(svg);
  },
};
function _esc(s){ return String(s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); }

// ── BadgeGenerator : blason aléatoire mais cohérent ──────────────────────
const BadgeGenerator = {
  random(opts){
    opts=opts||{};
    const pal = opts.colors || PaletteManager.random();
    const pick=a=>a[(Math.random()*a.length)|0];
    // Motifs "sûrs" (évite les plus chargés pour un rendu propre par défaut).
    const bgPool=['solid','solid','vstripes','hstripes','half_l','half_r','diagonal','chevron','cross','gradient','sunburst','scales','wave'];
    const b = {
      shape: opts.shape || pick(SvgLibrary.order),
      border: pick(['simple','double','gold','silver','modern','thick','beaded','chain','embossed','ornate','laurel_ring']),
      background: pick(bgPool),
      colors: pal,
      icon: opts.icon || pick(IconLibrary.order),
      iconColor: pal[2] || '#ffd700',
      iconScale: 0.9+Math.random()*0.3,
      iconRot: 0, iconX:0, iconY:-6,
      text: opts.text || '',
      textColor: pal[1] || '#ffffff',
      year: opts.year || '',
      stars: opts.stars!=null?opts.stars:0,
      starColor:'#ffd700', bgOpacity:1,
    };
    return BadgeSerializer.normalize(b);
  },
  // Blason déterministe à partir d'une graine (nom d'équipe) → stable.
  fromSeed(seed, opts){
    let h=0; for(let i=0;i<seed.length;i++){ h=(h*31+seed.charCodeAt(i))>>>0; }
    const R=()=>{ h=(h*1103515245+12345)>>>0; return h/4294967296; };
    const pick=a=>a[(R()*a.length)|0];
    const pal=PaletteManager.harmonies[(R()*PaletteManager.harmonies.length)|0].slice();
    return BadgeSerializer.normalize(Object.assign({
      shape:pick(SvgLibrary.order), border:pick(['simple','double','gold','silver','modern']),
      background:pick(['solid','vstripes','hstripes','half_l','diagonal','chevron','cross']),
      colors:pal, icon:pick(IconLibrary.order), iconColor:pal[2], iconScale:0.9+R()*0.3,
      iconX:0, iconY:-6, textColor:pal[1], starColor:'#ffd700', bgOpacity:1,
    }, opts||{}));
  },
};

// ── PRÉRÉGLAGES (styles nationaux / d'ambiance) ──────────────────────────
const BADGE_PRESETS = {
  classique_en:{shape:'shield_en',border:'simple',background:'half_l',icon:'lion'},
  italien:{shape:'shield_it',border:'gold',background:'vstripes',icon:'eagle'},
  espagnol:{shape:'shield_es',border:'double',background:'quarters',icon:'crown'},
  allemand:{shape:'shield_mod',border:'thick',background:'hstripes',icon:'eagle'},
  bresilien:{shape:'round',border:'simple',background:'diagonal',icon:'star'},
  japonais:{shape:'circle_dbl',border:'thin',background:'circles',icon:'phoenix'},
  amateur:{shape:'round',border:'simple',background:'solid',icon:'ball'},
  vintage:{shape:'shield_fr',border:'vintage',background:'solid',icon:'laurel'},
  moderne:{shape:'shield_mod',border:'modern',background:'gradient',icon:'bolt'},
  minimaliste:{shape:'minimal',border:'thin',background:'solid',icon:'star'},
  fantasy:{shape:'diamond',border:'gold',background:'stars_bg',icon:'dragon'},
};

// ── BadgeCache : évite de régénérer le SVG à chaque frame ─────────────────
const BadgeCache = {
  _c:{},
  _key(badge,size){ return (typeof badge==='string'?badge:JSON.stringify(badge))+'@'+(size||64); },
  dataURI(badge,size){
    const k=this._key(badge,size);
    if(this._c[k]) return this._c[k];
    const uri=BadgeRenderer.toDataURI(badge,{size:size||64});
    this._c[k]=uri; return uri;
  },
  svg(badge,size){
    const k='svg:'+this._key(badge,size);
    if(this._c[k]) return this._c[k];
    const s=BadgeRenderer.render(badge,{size:size||64});
    this._c[k]=s; return s;
  },
  invalidate(badge){ // purge les entrées d'un blason modifié
    const base=(typeof badge==='string'?badge:JSON.stringify(badge));
    Object.keys(this._c).forEach(k=>{ if(k.includes(base)) delete this._c[k]; });
  },
  clear(){ this._c={}; },
};

// ── BadgeExporter : export SVG / PNG, partage ────────────────────────────
const BadgeExporter = {
  // Télécharge le blason en fichier .svg (vectoriel, régénéré depuis le JSON).
  exportSVG(badge, filename){
    let svg=BadgeRenderer.render(badge,{size:512});
    // On embarque le JSON en commentaire pour un ré-import fidèle (le SVG reste
    // valide et affichable ailleurs ; le commentaire est ignoré au rendu).
    const json=BadgeSerializer.toJSON(badge);
    svg=svg.replace('>', '><!--BADGE:'+json+'-->');
    const blob=new Blob([svg],{type:'image/svg+xml'});
    _badgeDownload(blob,(filename||'blason')+'.svg');
  },
  // Rasterise le SVG dans un canvas puis télécharge un .png (taille au choix).
  exportPNG(badge, filename, size){
    size=size||512;
    const svg=BadgeRenderer.render(badge,{size});
    const img=new Image();
    const uri='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
    img.onload=()=>{
      const cv=document.createElement('canvas');
      cv.width=size; cv.height=Math.round(size*1.2);
      const cx=cv.getContext('2d');
      cx.drawImage(img,0,0,cv.width,cv.height);
      cv.toBlob(b=>{ if(b) _badgeDownload(b,(filename||'blason')+'.png'); },'image/png');
    };
    img.onerror=()=>{ try{ alert('Export PNG impossible sur ce navigateur.'); }catch(e){} };
    img.src=uri;
  },
  // Copie le JSON du blason dans le presse-papier (partage).
  share(badge){
    const json=BadgeSerializer.toJSON(badge);
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(json).then(()=>{ try{ if(typeof logEvent==='function') logEvent('🔗 Blason copié (JSON) !','#40c4ff'); }catch(e){} });
    }
    return json;
  },
};
function _badgeDownload(blob, name){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=name; document.body.appendChild(a); a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

// ── BadgeImporter : import SVG / JSON ────────────────────────────────────
const BadgeImporter = {
  // Importe depuis une chaîne JSON (partage) → objet blason normalisé.
  fromJSON(text){ return BadgeSerializer.fromJSON(text); },
  // Importe depuis un fichier (.svg exporté par nous contient le JSON en
  // commentaire ; sinon on tente un .json). Callback(badge|null).
  fromFile(file, cb){
    const r=new FileReader();
    r.onload=e=>{
      const txt=String(e.target.result||'');
      // 1) JSON pur
      try{ const b=JSON.parse(txt); return cb(BadgeSerializer.normalize(b)); }catch(_){}
      // 2) SVG contenant un commentaire <!--BADGE:{...}-->
      const m=txt.match(/<!--BADGE:(.*?)-->/s);
      if(m){ try{ return cb(BadgeSerializer.normalize(JSON.parse(m[1]))); }catch(_){}
      }
      cb(null);
    };
    r.onerror=()=>cb(null);
    r.readAsText(file);
  },
};

// ── Export global ────────────────────────────────────────────────────────
if(typeof window!=='undefined'){
  Object.assign(window,{
    SvgLibrary, PatternLibrary, IconLibrary, PaletteManager,
    BadgeRenderer, BadgeGenerator, BadgeSerializer, BadgeCache,
    BadgeExporter, BadgeImporter, BADGE_PRESETS, BADGE_W, BADGE_H,
  });
}
