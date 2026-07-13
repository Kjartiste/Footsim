# Design system FootSim — theme.css

Une seule source de vérité pour l'apparence, façon FM/EA FC : au lieu de styles
`style="..."` répétés partout, on utilise des classes réutilisables. Change
l'apparence globale en éditant un seul fichier.

## Direction : manga / anime
Contours encrés marqués (`--ink`, ~2.5px near-black), aplats de couleur francs,
contrastes forts, ombres portées "dures" (effet planche de BD). Prépare aussi
l'identité du futur gacha.

## Thèmes
Sombre (défaut) et clair, via l'attribut `data-theme` sur `<html>`. Bascule
depuis Paramètres → Thème. Choix mémorisé (localStorage `footsim_theme`).

## Tokens (variables CSS)
- Espacement : `--sp-1..--sp-10` (base 4px).
- Rayons : `--r-sm/md/lg/xl/pill`.
- Typo : `--font-display` (Barlow Condensed), `--font-body` (Barlow), `--fs-*`.
- Couleurs sémantiques : `--accent`, `--pos` (victoire), `--neg` (défaite),
  `--neutral` (nul), `--info`, `--fg`, `--fg-muted`, `--surface`...

## Composants principaux
- Typo : `.fm-hero .fm-title .fm-h2 .fm-label .fm-value .fm-pos/.fm-neg/.fm-neu`
- Carte : `.fm-card` (+ `--flat --tight --accent`)
- Bouton : `.fm-btn` (+ `--primary --ghost --block --sm`)
- Onglets : `.fm-tabs > .fm-tab.is-active`
- Ligne de liste : `.fm-row > .fm-row__grow/.fm-row__title/.fm-row__sub`
- Pastille : `.fm-pill` (+ `--accent`)
- Fil d'Ariane : `.fm-crumbs > a / .is-here / .sep`
- Vignette équipe : `.fm-crest`
- Toast : `.fm-toast`

## Classes gacha (dormantes)
Prêtes pour le pivot, inutilisées au lancement : `.fm-unit` (carte perso avec
`data-rar="r|sr|ssr|ur"`), `.fm-unit__art/__frame/__name/__rar`, couleurs de
rareté `--rar-r/sr/ssr/ur`. Coût zéro aujourd'hui, gain énorme le jour du pivot.

## Migration
Écran par écran, sans toucher au moteur. Déjà migré : **Sélection d'équipe**.
Prochains candidats logiques : Carrière, Stats, écran de profils.
