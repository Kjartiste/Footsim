// ═══════════════════════════════════════════════════════════════
// TUTORIAL.JS — Visite guidée pas-à-pas (onboarding), réactivable.
//
// Autonome : ne dépend que de nav() et de l'existence des écrans/onglets
// déjà présents dans le DOM. Chargé en <script> classique (scope global).
//
// API publique :
//   startTutorial()        → lance la visite depuis le début
//   maybeStartTutorial()   → lance UNE fois au tout premier passage (appelé au boot)
//   isTutorialDone()       → bool
// ═══════════════════════════════════════════════════════════════
(function(){
  'use strict';

  // Clé de persistance. On la lie au profil actif s'il existe, sinon globale.
  function _seenKey(){
    var pid = (typeof activeProfileId !== 'undefined' && activeProfileId) ? activeProfileId : 'global';
    return 'footsim_tuto_seen_' + pid;
  }
  function isTutorialDone(){
    try{ return localStorage.getItem(_seenKey()) === '1'; }catch(e){ return false; }
  }
  function _markDone(){
    try{ localStorage.setItem(_seenKey(), '1'); }catch(e){}
  }

  // ── Définition des étapes ─────────────────────────────────────
  // target   : sélecteur CSS de l'élément à mettre en avant (null = centré).
  // nav      : onglet à ouvrir avant d'afficher l'étape (optionnel).
  // title/body : contenu de la bulle.
  var STEPS = [
    {
      target: null, nav: 'mode',
      title: 'Bienvenue dans FootSim !',
      body: "Un simulateur de football fantasy où nations, sorts et tactiques se mêlent. Cette courte visite te montre l'essentiel. Tu peux la passer à tout moment et la relancer depuis les Paramètres."
    },
    {
      target: ".ntab[onclick*=\"'mode'\"]", nav: 'mode',
      title: 'Choisir un mode',
      body: "Tout commence ici. FootSim se joue surtout en <b>Futsal 5v5</b> et en <b>7v7</b> — rapides et spectaculaires. Le 11v11 existe aussi pour le football classique."
    },
    {
      target: ".ntab[onclick*=\"'setup'\"]", nav: 'setup',
      title: 'Composer les équipes',
      body: "L'onglet <b>Équipes</b> s'adapte au mode choisi. Tu y règles tes effectifs : titulaires, banc, réserves."
    },
    {
      target: ".ntab[onclick*=\"'teamsel'\"]", nav: 'teamsel',
      title: 'Sélectionner des équipes',
      body: "Charge des équipes toutes faites : chaque <b>nation</b> (Sirènes, Valoria, le Pilier Céleste, Rorang…) a son identité et ses forces. À toi de bâtir ton affiche."
    },
    {
      target: ".ntab[onclick*=\"'tactic'\"]", nav: 'tactic',
      title: 'Régler la tactique',
      body: "Formation, pressing, style de jeu et <b>sorts</b> se paramètrent ici. Les sorts sont la signature de FootSim : ils peuvent renverser un match."
    },
    {
      target: ".ntab[onclick*=\"navMatch\"]", nav: null,
      title: 'Jouer le match',
      body: "Quand tout est prêt, lance le match. Tu pourras intervenir à la mi-temps : changements, ajustements tactiques, et déclencher tes effets spéciaux."
    },
    {
      target: ".ntab[onclick*=\"'league'\"]", nav: 'league',
      title: 'Ligue & calendrier',
      body: "Enchaîne les journées, suis le classement et gère ton calendrier de saison sur la durée."
    },
    {
      target: ".ntab[onclick*=\"'career'\"]", nav: 'career',
      title: 'Le mode Carrière',
      body: "Le cœur du jeu sur le long terme : dirige un club, gère budget, staff, transferts et objectifs du board saison après saison."
    },
    {
      target: ".ntab[onclick*=\"'settings'\"]", nav: 'settings',
      title: "C'est parti !",
      body: "Tu connais l'essentiel. Besoin de revoir cette visite ? Elle est toujours disponible ici, dans les <b>Paramètres</b>. Bon jeu !"
    }
  ];

  var idx = 0;
  var active = false;
  var _lastHighlight = null;

  // ── Éléments d'overlay (créés une fois) ───────────────────────
  var overlay, ring, bubble, skipBtn;
  function _ensureDom(){
    if(overlay) return;
    overlay = document.createElement('div'); overlay.id = 'tuto-overlay';
    ring    = document.createElement('div'); ring.id = 'tuto-ring';
    bubble  = document.createElement('div'); bubble.id = 'tuto-bubble';
    skipBtn = document.createElement('div'); skipBtn.className = 'tuto-skip';
    skipBtn.textContent = 'Passer ✕';
    skipBtn.onclick = end;
    overlay.appendChild(ring);
    overlay.appendChild(bubble);
    overlay.appendChild(skipBtn);
    document.body.appendChild(overlay);
    // Repositionner si la fenêtre change
    window.addEventListener('resize', function(){ if(active) _position(); });
  }

  function _clearHighlight(){
    if(_lastHighlight){ _lastHighlight.classList.remove('tuto-highlight'); _lastHighlight = null; }
  }

  // ── Positionne l'anneau + la bulle sur la cible de l'étape ─────
  function _position(){
    var step = STEPS[idx];
    var el = step.target ? document.querySelector(step.target) : null;

    _clearHighlight();

    if(el){
      var r = el.getBoundingClientRect();
      // Anneau autour de la cible (avec un petit padding)
      var pad = 6;
      ring.style.display = 'block';
      ring.style.left   = (r.left - pad) + 'px';
      ring.style.top    = (r.top - pad) + 'px';
      ring.style.width  = (r.width + pad*2) + 'px';
      ring.style.height = (r.height + pad*2) + 'px';
      el.classList.add('tuto-highlight');
      _lastHighlight = el;

      // Placer la bulle : à droite si la place le permet, sinon en dessous/au-dessus.
      var bw = 280, bh = bubble.offsetHeight || 160;
      var vw = window.innerWidth, vh = window.innerHeight;
      var left, top;
      if(r.right + bw + 20 < vw){            // à droite de la cible
        left = r.right + 16; top = Math.max(12, r.top);
      } else if(r.bottom + bh + 20 < vh){    // en dessous
        left = Math.min(Math.max(12, r.left), vw - bw - 12); top = r.bottom + 16;
      } else {                                // au-dessus
        left = Math.min(Math.max(12, r.left), vw - bw - 12); top = Math.max(12, r.top - bh - 16);
      }
      bubble.style.left = left + 'px';
      bubble.style.top  = top + 'px';
    } else {
      // Étape centrée (pas de cible)
      ring.style.display = 'none';
      bubble.style.left = '50%';
      bubble.style.top  = '50%';
      bubble.style.transform = 'translate(-50%,-50%)';
      return;
    }
    bubble.style.transform = 'none';
  }

  // ── Rend le contenu de l'étape courante ───────────────────────
  function _render(){
    var step = STEPS[idx];
    var dots = STEPS.map(function(_,i){
      return '<span class="tuto-dot'+(i===idx?' on':'')+'"></span>';
    }).join('');
    var isFirst = idx === 0, isLast = idx === STEPS.length - 1;
    bubble.innerHTML =
      '<div class="tuto-step-count">Étape '+(idx+1)+' / '+STEPS.length+'</div>'
      + '<div class="tuto-title">'+step.title+'</div>'
      + '<div class="tuto-body">'+step.body+'</div>'
      + '<div class="tuto-nav">'
      +   '<div class="tuto-dots">'+dots+'</div>'
      +   (isFirst ? '' : '<button class="tuto-btn" id="tuto-prev">Précédent</button>')
      +   '<button class="tuto-btn primary" id="tuto-next">'+(isLast ? 'Terminer' : 'Suivant')+'</button>'
      + '</div>';
    var p = document.getElementById('tuto-prev');
    var n = document.getElementById('tuto-next');
    if(p) p.onclick = prev;
    if(n) n.onclick = next;
  }

  // ── Va à l'étape courante : ouvre l'onglet, attend le rendu, place ──
  function _goto(){
    var step = STEPS[idx];
    if(step.nav && typeof nav === 'function'){
      try{ nav(step.nav); }catch(e){}
    }
    _render();
    // Laisser le temps à l'écran de se rendre avant de mesurer les positions.
    setTimeout(_position, 60);
  }

  function next(){
    if(idx >= STEPS.length - 1){ end(); return; }
    idx++; _goto();
  }
  function prev(){
    if(idx <= 0) return;
    idx--; _goto();
  }

  function start(){
    _ensureDom();
    idx = 0; active = true;
    overlay.classList.add('on');
    _goto();
  }

  function end(){
    active = false;
    _clearHighlight();
    if(overlay) overlay.classList.remove('on');
    _markDone();
  }

  // Lancement automatique au premier passage seulement.
  function maybeStart(){
    if(isTutorialDone()) return false;
    // On attend un tick pour être sûr que la barre de nav est rendue.
    setTimeout(start, 400);
    return true;
  }

  // Exposition globale
  window.startTutorial      = start;
  window.maybeStartTutorial = maybeStart;
  window.isTutorialDone     = isTutorialDone;
  window.endTutorial        = end;
})();
