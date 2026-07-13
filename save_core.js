// ═══════════════════════════════════════════════════════════════════════
// SAVE_CORE.JS — Couche de sauvegarde robuste (production / Steam-ready)
// ───────────────────────────────────────────────────────────────────────
// Objectif : rendre la sauvegarde fiable pour une distribution commerciale.
// Une partie perdue = remboursement + mauvaise note. Ce module apporte :
//
//   1. VERSIONING       — chaque sauvegarde porte un numéro de schéma.
//   2. MIGRATIONS        — mise à jour transparente d'un ancien format au format courant.
//   3. BACKUP            — double écriture (slot principal + slot de secours).
//   4. RÉCUPÉRATION       — si la sauvegarde principale est corrompue, on
//                          restaure automatiquement depuis le secours.
//   5. QUOTA              — détection de quota plein + purge assistée, jamais
//                          une écriture silencieusement perdue.
//
// Ce module n'REMPLACE PAS le stockage existant : il l'enveloppe. Les appels
// existants à _safeLSSet continuent de fonctionner ; les données critiques
// (profils, carrière V2) passent en plus par safeStore() pour bénéficier du
// backup et du versioning.
// ═══════════════════════════════════════════════════════════════════════

var SaveCore = (function(){
  'use strict';

  // Version de schéma courante. À incrémenter à chaque changement de structure
  // de données qui nécessite une migration (voir MIGRATIONS ci-dessous).
  var SCHEMA_VERSION = 1;

  var BACKUP_SUFFIX = '__bak';
  var META_KEY = 'footsim_save_meta';

  // ── MIGRATIONS ──────────────────────────────────────────────────────────
  // Chaque entrée migre les données d'une version N vers N+1. Elles sont
  // appliquées en cascade au chargement si la sauvegarde est plus ancienne
  // que SCHEMA_VERSION. Exemple d'utilisation future :
  //
  //   2: function(data){ data.newField = data.newField || []; return data; },
  //
  // La clé est la version SOURCE. Une migration doit être idempotente et ne
  // jamais lever : en cas de doute, elle renvoie les données inchangées.
  var MIGRATIONS = {
    // 1 → 2 : exemple (désactivé tant que SCHEMA_VERSION vaut 1).
    // 1: function(data){ return data; },
  };

  // Enveloppe une valeur métier dans une enveloppe versionnée.
  function wrap(payload){
    return { _v: SCHEMA_VERSION, _t: Date.now(), data: payload };
  }

  // Applique les migrations nécessaires pour amener `env` (enveloppe) à la
  // version courante. Renvoie la charge utile migrée (data).
  function migrate(env){
    if(!env || typeof env !== 'object') return env;
    // Ancien format sans enveloppe (données brutes) → considéré version 1.
    if(env._v == null){
      return env; // données legacy brutes : renvoyées telles quelles.
    }
    var v = env._v;
    var data = env.data;
    while(v < SCHEMA_VERSION){
      var step = MIGRATIONS[v];
      if(typeof step === 'function'){
        try{ data = step(data); }
        catch(e){ console.warn('Migration '+v+'→'+(v+1)+' échouée:', e); }
      }
      v++;
    }
    return data;
  }

  // Écriture brute avec gestion de quota. Renvoie true/false.
  function rawSet(key, str){
    try{
      localStorage.setItem(key, str);
      return true;
    }catch(e){
      if(e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014)){
        _onQuotaExceeded(key);
      }else{
        console.warn('SaveCore write failed', key, e);
      }
      return false;
    }
  }

  function rawGet(key){
    try{ return localStorage.getItem(key); }
    catch(e){ return null; }
  }

  // ── ÉCRITURE SÛRE ───────────────────────────────────────────────────────
  // Écrit la valeur versionnée dans le slot principal ET dans le slot backup.
  // Le backup n'est mis à jour que si le principal a réussi, garantissant qu'on
  // conserve toujours au moins une copie valide.
  function safeStore(key, payload){
    var str;
    try{ str = JSON.stringify(wrap(payload)); }
    catch(e){ console.error('SaveCore serialize failed', key, e); return false; }

    var okMain = rawSet(key, str);
    if(okMain){
      // Backup best-effort : une échec de backup n'invalide pas la sauvegarde.
      rawSet(key + BACKUP_SUFFIX, str);
      _touchMeta();
    }
    return okMain;
  }

  // ── LECTURE SÛRE (avec récupération) ─────────────────────────────────────
  // Tente de lire le slot principal. Si absent/corrompu, bascule sur le backup.
  // Renvoie la charge utile migrée, ou `fallback` si rien de valide.
  function safeLoad(key, fallback){
    var main = _tryParse(rawGet(key));
    if(main.ok) return migrate(main.value);

    // Principal illisible → tentative de restauration depuis le backup.
    var bak = _tryParse(rawGet(key + BACKUP_SUFFIX));
    if(bak.ok){
      console.warn('SaveCore: sauvegarde principale corrompue pour "'+key+'", restauration depuis le backup.');
      // Réécrire le principal à partir du backup valide.
      try{ localStorage.setItem(key, rawGet(key + BACKUP_SUFFIX)); }catch(e){}
      _notify('⚠️ Sauvegarde récupérée depuis une copie de secours.', '#f0c028');
      return migrate(bak.value);
    }

    return (fallback !== undefined ? fallback : null);
  }

  // Existence d'une sauvegarde (principale ou backup) pour une clé donnée.
  function has(key){
    return rawGet(key) != null || rawGet(key + BACKUP_SUFFIX) != null;
  }

  // Supprime une sauvegarde et son backup.
  function remove(key){
    try{ localStorage.removeItem(key); }catch(e){}
    try{ localStorage.removeItem(key + BACKUP_SUFFIX); }catch(e){}
  }

  // ── EXPORT / IMPORT (fichier) ────────────────────────────────────────────
  // Pour Steam Cloud ou sauvegarde manuelle : sérialise une ou plusieurs clés
  // dans un blob JSON téléchargeable, et réimporte depuis un tel blob.
  function exportKeys(keys){
    var bundle = { _export: true, _v: SCHEMA_VERSION, _t: Date.now(), keys: {} };
    keys.forEach(function(k){
      var raw = rawGet(k);
      if(raw != null) bundle.keys[k] = raw;
    });
    return JSON.stringify(bundle);
  }

  function importBundle(jsonStr){
    var parsed = _tryParse(jsonStr);
    if(!parsed.ok || !parsed.value || !parsed.value.keys) return false;
    var keys = parsed.value.keys;
    var restored = 0;
    Object.keys(keys).forEach(function(k){
      if(rawSet(k, keys[k])){
        rawSet(k + BACKUP_SUFFIX, keys[k]);
        restored++;
      }
    });
    return restored > 0;
  }

  // ── Internes ─────────────────────────────────────────────────────────────
  function _tryParse(str){
    if(str == null) return { ok:false };
    try{ return { ok:true, value: JSON.parse(str) }; }
    catch(e){ return { ok:false }; }
  }

  function _touchMeta(){
    try{
      localStorage.setItem(META_KEY, JSON.stringify({ version: SCHEMA_VERSION, lastSave: Date.now() }));
    }catch(e){}
  }

  function _notify(msg, color){
    if(typeof logEvent === 'function'){ try{ logEvent(msg, color || '#888'); }catch(e){} }
  }

  // Quota plein : on tente de libérer de la place en supprimant les backups
  // (les moins critiques), puis on alerte le joueur. On ne supprime jamais une
  // sauvegarde principale automatiquement.
  function _onQuotaExceeded(failedKey){
    var freed = false;
    try{
      for(var i = localStorage.length - 1; i >= 0; i--){
        var k = localStorage.key(i);
        if(k && k.indexOf(BACKUP_SUFFIX) !== -1 && k !== failedKey + BACKUP_SUFFIX){
          localStorage.removeItem(k);
          freed = true;
        }
      }
    }catch(e){}
    _notify('⚠️ Stockage plein. ' + (freed ? 'Copies de secours purgées — réessayez.' : 'Exportez puis supprimez d\'anciennes données.'), '#e02030');
  }

  // API publique.
  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    store: safeStore,
    load: safeLoad,
    has: has,
    remove: remove,
    exportKeys: exportKeys,
    importBundle: importBundle,
  };
})();

if(typeof window !== 'undefined'){ window.SaveCore = SaveCore; }
