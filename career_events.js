// ═══════════════════════════════════════════════════════════════
// CAREER_EVENTS.JS — Traitement des événements de carrière à choix.
//
// Le moteur (_triggerRegionEvent dans ui_career.js) empile des événements
// dans careerV2.pending_events, mais rien ne les affichait ni ne les
// résolvait. Ce module complète la boucle :
//   • expire les événements dont la deadline est passée,
//   • présente le premier événement en attente dans une modale de choix,
//   • applique des conséquences concrètes (effectif, budget, réputation).
//
// Chargé en <script> classique (scope global). API :
//   _processPendingEvents()  → appelé après renderCareerV2()
// ═══════════════════════════════════════════════════════════════
(function(){
  'use strict';

  // Un seul modal à la fois. Verrou pour éviter les ré-entrées pendant qu'un
  // choix est affiché (renderCareerV2 peut être rappelé par des sous-systèmes).
  var _open = false;

  function _fmtMoney(n){
    try{ if(typeof window._fmtMoney==='function') return window._fmtMoney(n); }catch(e){}
    return (n||0).toLocaleString('fr-FR') + ' €';
  }
  function _log(msg, col){ try{ if(typeof logEvent==='function') logEvent(msg, col); }catch(e){} }
  function _save(){ try{ if(typeof saveCareerV2==='function') saveCareerV2(); }catch(e){} }
  function _rerender(){ try{ if(typeof renderCareerV2==='function') renderCareerV2(); }catch(e){} }

  // ── Expiration des événements échus (deadline dépassée) ───────────
  function _expireStale(C){
    if(!Array.isArray(C.pending_events) || !C.pending_events.length) return false;
    var wk = C.week || 0;
    var before = C.pending_events.length;
    C.pending_events = C.pending_events.filter(function(ev){
      if(ev && typeof ev.deadline === 'number' && wk > ev.deadline){
        // Événement laissé sans réponse : conséquence douce selon le type.
        if(ev.type === 'corruption_offer'){
          _log('⏳ La proposition douteuse a expiré — vous n\'y avez pas donné suite.','#888');
        } else if(ev.type === 'gem_discovered'){
          _log('⏳ La pépite '+(ev.player&&ev.player.name?ev.player.name:'')+' a signé ailleurs faute de réponse.','#888');
        }
        return false;
      }
      return true;
    });
    return C.pending_events.length !== before;
  }

  // ── Rendu de la modale pour un événement donné ───────────────────
  function _buildModal(ev){
    var title, body, choices;

    if(ev.type === 'gem_discovered'){
      var p = ev.player || {};
      var ovr = (typeof teamOvr==='function' && p) ? '' : '';
      var stats = p.s ? ('Tec '+(p.s.tec||'?')+' · Tir '+(p.s.sht||'?')) : '';
      title = '💎 Pépite découverte';
      body = 'Votre recruteur a repéré <b>'+(p.name||'un jeune talent')+'</b>'
           + (p.pos?(' ('+p.pos+')'):'') + '. '
           + (stats?('Profil prometteur — <span style="color:#9c27b0">'+stats+'</span>. '):'')
           + 'Vous pouvez l\'intégrer à votre effectif, ou passer votre tour.';
      choices = [
        { label:'✔ Recruter la pépite', primary:true, act:function(){
            var C = careerV2;
            (C.players = C.players || []).push(p);
            _log('💎 '+(p.name||'La pépite')+' rejoint l\'effectif !','#9c27b0');
          }},
        { label:'Laisser filer', act:function(){
            _log('Vous laissez passer la pépite.','#888');
          }},
      ];
    }
    else if(ev.type === 'corruption_offer'){
      title = '⚠️ Proposition douteuse';
      body = 'Un intermédiaire vous propose une <b>enveloppe</b> en échange d\'un petit arrangement. '
           + 'L\'argent est tentant, mais si cela se sait, le board vous le fera payer. Que faites-vous ?';
      choices = [
        { label:'💰 Accepter l\'enveloppe', primary:true, danger:true, act:function(){
            var C = careerV2;
            var gain = 3000 + Math.floor(Math.random()*4000);
            if(C.club){ C.club.budget = (C.club.budget||0) + gain; }
            try{ if(typeof _addFinanceLog==='function') _addFinanceLog('Arrangement douteux', gain); }catch(e){}
            // Risque : 40% que ça se sache → grosse perte de réputation.
            if(Math.random() < 0.4){
              C.director_reputation = Math.max(0, (C.director_reputation||30) - 15);
              _log('🔴 L\'affaire a fuité ! Le board vous sanctionne (-15 réputation). Gain : '+_fmtMoney(gain),'#e02030');
            } else {
              _log('🤫 L\'arrangement passe inaperçu. Gain : '+_fmtMoney(gain),'#e08040');
            }
          }},
        { label:'🚫 Refuser (intègre)', act:function(){
            var C = careerV2;
            C.director_reputation = Math.min(100, (C.director_reputation||30) + 5);
            _log('✅ Vous refusez fermement. Le board apprécie votre intégrité (+5 réputation).','#18c860');
          }},
      ];
    }
    else {
      // Type inconnu : on l'affiche en info simple et on le retire.
      title = 'ℹ️ Événement';
      body = ev.desc || 'Un événement est survenu.';
      choices = [ { label:'OK', primary:true, act:function(){} } ];
    }

    return { title:title, body:body, choices:choices };
  }

  function _renderModal(ev){
    // Retirer un éventuel modal résiduel.
    var old = document.getElementById('cev-modal'); if(old) old.remove();

    var m = _buildModal(ev);
    var wrap = document.createElement('div');
    wrap.id = 'cev-modal';
    wrap.className = 'cev-overlay';

    var btns = m.choices.map(function(c, i){
      var cls = 'cev-btn' + (c.primary?' primary':'') + (c.danger?' danger':'');
      return '<button class="'+cls+'" data-i="'+i+'">'+c.label+'</button>';
    }).join('');

    wrap.innerHTML =
      '<div class="cev-box">'
      + '<div class="cev-title">'+m.title+'</div>'
      + '<div class="cev-body">'+m.body+'</div>'
      + '<div class="cev-choices">'+btns+'</div>'
      + '</div>';

    document.body.appendChild(wrap);
    requestAnimationFrame(function(){ wrap.classList.add('on'); });

    // Brancher les boutons.
    m.choices.forEach(function(c, i){
      var b = wrap.querySelector('.cev-btn[data-i="'+i+'"]');
      if(b) b.onclick = function(){
        try{ c.act(); }catch(e){ console.error('event choice:', e); }
        // Retirer l'événement traité de la file.
        var C = careerV2;
        if(C && Array.isArray(C.pending_events)){
          var idx = C.pending_events.indexOf(ev);
          if(idx >= 0) C.pending_events.splice(idx, 1);
        }
        wrap.classList.remove('on');
        setTimeout(function(){ wrap.remove(); }, 180);
        _open = false;
        _save();
        _rerender();
      };
    });
  }

  // ── Point d'entrée : traite le premier événement en attente ──────
  function processPendingEvents(){
    if(_open) return;
    if(typeof careerV2 === 'undefined' || !careerV2) return;
    if(careerV2.type !== 'director') return;
    var C = careerV2;
    if(!Array.isArray(C.pending_events)) return;

    // Expirer d'abord (peut vider la file).
    if(_expireStale(C)) _save();
    if(!C.pending_events.length) return;

    // Présenter le premier événement.
    _open = true;
    _renderModal(C.pending_events[0]);
  }

  window._processPendingEvents = processPendingEvents;
})();
