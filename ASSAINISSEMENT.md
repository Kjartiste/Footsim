# Assainissement des fondations — journal des changements

Objectif : rendre le projet fiable et prêt à être empaqueté pour Steam (Q4),
sans casser l'existant. Trois axes : **sauvegarde robuste**, **suppression du
doublon de carrière**, **préparation desktop**.

---

## 1. Sauvegarde robuste (le risque n°1 pour un jeu vendu)

**Nouveau fichier : `save_core.js`** — une couche de sauvegarde de qualité
production, chargée en premier. Elle apporte :

- **Versioning de schéma** : chaque sauvegarde porte un numéro de version, ce qui
  permet de faire évoluer la structure des données sans casser les parties
  existantes.
- **Migrations** : mécanisme prêt à l'emploi pour convertir une ancienne
  sauvegarde au format courant, de façon transparente et en cascade.
- **Backup automatique** : chaque écriture est dupliquée dans un slot de secours.
- **Récupération de corruption** : si la sauvegarde principale est illisible, le
  jeu restaure automatiquement depuis le backup et réécrit le slot principal.
- **Gestion du quota** : si le stockage est plein, purge assistée des copies de
  secours + alerte claire, au lieu d'une sauvegarde silencieusement perdue.
- **Export / Import fichier** : base pour Steam Cloud et le transfert entre
  machines.

**Branchement** (`save.js`) : `saveProfiles()` / `loadProfiles()` passent
désormais par `SaveCore` (avec repli automatique sur l'ancien format pour ne
pas perdre les parties déjà existantes). Le profil contenant toutes les
carrières V2, c'est bien la sauvegarde maîtresse qui est protégée.

**UI** (`ui.js`, écran Paramètres) : nouvelle carte **Sauvegarde** avec boutons
**Exporter** (télécharge un `.json` daté) et **Importer** (restaure depuis un
fichier). Testé : export → suppression → import → partie restaurée.

---

## 2. Suppression du doublon de carrière

Le projet contenait **deux systèmes de carrière** coexistants :
- `careerState` (ancien, « mode classique »),
- `careerV2` (le moteur actuel : calendrier jour par jour, coupes, matchs PNJ
  simulés en fond).

Constats après analyse :
- Toute **nouvelle** carrière utilise déjà `careerV2` (les points d'entrée
  `startCareerManager` / `startCareerDirector` construisent V2).
- L'ancien créateur `startCareer()` n'était **plus branché** à aucun bouton.
- Le seul accès vivant au legacy était un bouton « Continuer l'ancienne
  carrière » — un piège silencieux.

**Action** : ce point d'entrée est transformé en **encart de dépréciation
clair** : le joueur qui a une ancienne partie peut la terminer, mais comprend
que le mode n'est plus mis à jour et que les nouvelles carrières utilisent le
moteur amélioré. On ne supprime pas les 4 800 lignes legacy d'un coup (risqué) :
elles restent en place mais **inaccessibles à la création**, donc inertes. Elles
pourront être retirées proprement dans une passe ultérieure une fois qu'on est
sûr qu'aucune sauvegarde active ne s'en sert.

---

## 3. Simulation des matchs PNJ (rappel de la passe précédente)

`career_sim.js` simule automatiquement, en fond, tous les matchs PNJ vs PNJ dès
que leur date est atteinte — classement toujours à jour sans action du joueur,
basé sur la force réelle des équipes.

---

## 4. Préparation desktop / Steam

Voir le dossier **`footsim-steam/`** (séparé) : projet Tauri complet (config,
icônes, scripts de build) + `GUIDE_STEAM.md` détaillant la compilation et la
publication. Polices : fallback système ajouté partout pour un rendu correct
hors-ligne.

---

## Fichiers modifiés / ajoutés

- `save_core.js` — **nouveau** (couche sauvegarde robuste)
- `career_sim.js` — nouveau (passe précédente, simulation PNJ)
- `save.js` — `saveProfiles` / `loadProfiles` via SaveCore
- `ui.js` — carte Sauvegarde (export/import), encart legacy déprécié, footer saison, sim PNJ
- `index.html` — chargement `save_core.js` en premier, nav restructurée, styles

## Reste à faire (hors périmètre de cette passe)

- Retirer définitivement le code legacy `careerState` (passe dédiée, après
  vérification qu'aucune save active ne l'utilise).
- Bundler les polices en local (voir GUIDE_STEAM §6).
- Onboarding / tutoriel court, sons & feedback (finition « perçue »).
- Tests par des joueurs externes.
