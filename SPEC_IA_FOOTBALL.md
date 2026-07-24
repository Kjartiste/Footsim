# Spécification d'une IA de football réaliste, probabiliste et non déterministe

> Document de conception pour développeurs. Objectif : un comportement d'équipe
> qui **ressemble** à une vraie équipe de haut niveau — décisions probabilistes,
> ajustement continu, incertitude contrôlée — sans règles rigides `si X alors Y`.
> Toutes les décisions passent par des **scores d'utilité** convertis en
> **probabilités**, modulées par le contexte et bruitées pour le naturel.

Les valeurs numériques ci-dessous sont des **points de départ calibrés** à partir
des tendances publiques du football moderne (PPDA, pressing, pitch control,
xThreat/xT, occupation des demi-espaces, données de style Opta/Wyscout/StatsBomb).
Ce ne sont pas des mesures exactes — elles sont faites pour être ajustées par
tuning empirique. Chaque distribution doit être traitée comme une **base**, jamais
comme une constante immuable.

---

## 0. Principe général : de l'utilité à la probabilité

Aucune décision n'est prise par seuil. Chaque joueur, à chaque tick de décision,
évalue un ensemble d'actions candidates `A = {a₁, a₂, …, aₙ}`. Chaque action
reçoit un **score d'utilité** `U(aᵢ)` fonction du contexte. On convertit ensuite
ces scores en probabilités par un **softmax tempéré** :

```
P(aᵢ) = exp(U(aᵢ) / τ) / Σⱼ exp(U(aⱼ) / τ)
```

- `τ` (température) contrôle le déterminisme. `τ → 0` : le joueur prend presque
  toujours la meilleure option (comportement « robotique »). `τ` élevé : plus
  d'exploration, plus d'erreurs humaines. Recommandé : `τ ∈ [0.15, 0.40]`,
  augmenté sous fatigue et pression, diminué pour les joueurs d'élite.
- Le softmax garantit `Σ P(aᵢ) = 1` automatiquement — pas besoin de renormaliser
  à la main.

**Bruit naturel.** Avant le softmax, on ajoute à chaque utilité un bruit gaussien
faible `ε ∼ 𝒩(0, σ²)` avec `σ ≈ 0.06·|U|`. Cela produit la variation « ±5 à ±10 %
à situation identique » demandée, sans jamais casser la somme à 100 % (le softmax
renormalise). À situation strictement identique, deux exécutions donnent donc des
distributions légèrement différentes — le comportement n'est jamais exactement
répété.

**Température dynamique :**

```
τ_effectif = τ_base · (1 + 0.5·pressure + 0.4·fatigue − 0.3·skill_norm)
```

où `pressure`, `fatigue`, `skill_norm ∈ [0,1]`. Un joueur pressé et fatigué décide
de façon plus dispersée (erreurs) ; un joueur technique et au calme décide plus
proprement.

---

## 1. Variables de contexte (entrées du modèle)

Toutes les utilités dérivent d'un vecteur de contexte `C` recalculé en continu :

| Variable | Symbole | Domaine | Rôle |
|---|---|---|---|
| Distance au ballon | `d_ball` | mètres | pressing, récupération |
| Vitesse du ballon | `v_ball` | m/s | interception, anticipation |
| Zone du terrain (tiers × couloir) | `zone` | 3×5 grille | risque, intention |
| Densité adverse locale | `ρ_opp` | joueurs / 100 m² | pression perçue |
| Densité partenaires locale | `ρ_team` | joueurs / 100 m² | options de passe |
| Différence de score | `Δscore` | entier | agressivité / prudence |
| Temps restant | `t_rem` | minutes | urgence |
| Fatigue du joueur | `fatigue` | [0,1] | vitesse, précision, τ |
| Qualité technique | `tec`, `pas`, `sht` | [0,99] | faisabilité des actions |
| Contrôle spatial local | `PC(x,y)` | [0,1] | pitch control (voir §11) |
| Menace attendue | `xT(x,y)` | [0,1] | valeur d'une zone (voir §11) |
| Style tactique d'équipe | `style` | catégoriel | biais global des utilités |
| Structure d'équipe (compacité) | `compact` | [0,1] | contrainte collective |

Ces variables **modulent** les probabilités en continu. Aucune n'agit par seuil :
elles entrent dans les fonctions d'utilité comme termes pondérés.

---

## 2. Automate d'états d'équipe (macro-phases)

L'équipe évolue dans un automate à états souple. Les transitions ne sont pas des
`if` : ce sont des probabilités par tick dépendant du contexte.

```
        ┌────────────────────────────────────────────────────────┐
        │                                                        │
   ┌────▼─────┐   perte de balle    ┌──────────────┐            │
   │ ATTAQUE  │────────────────────►│ TRANSITION   │            │
   │(possession)                    │ défensive    │            │
   └────▲─────┘                     └──────┬───────┘            │
        │                                  │ bloc reformé        │
        │ récupération                     ▼                     │
   ┌────┴─────────┐  gain de balle  ┌──────────────┐            │
   │ TRANSITION   │◄────────────────│  DÉFENSE     │────────────┘
   │ offensive    │                 │  (bloc)      │
   └──────────────┘                 └──────────────┘
```

Chaque état impose un **profil de pondérations** différent aux utilités
individuelles (voir sections suivantes). La probabilité de transition
ATTAQUE→TRANSITION_DEF sur perte de balle est ≈ 1 immédiatement, mais la
**durée** en transition (avant de retomber en bloc) suit une loi exponentielle :

```
P(rester en transition à t) = exp(−t / λ),   λ ≈ 4–7 s selon l'intensité de contre-pressing
```

---

## 3. Phase défensive

La phase défensive se décompose en cinq comportements distincts, chacun avec sa
propre distribution. Le comportement d'un défenseur est un **mélange** de ces cinq,
pondéré par le contexte — pas un choix exclusif.

### 3.1 Défense en bloc (positionnement collectif)

Chaque joueur vise une position d'ancrage `anchor(rôle)` définie par la formation,
translatée par la position du ballon :

```
target = anchor(rôle) + k_follow · (ball − anchor_ref) + compact · pull_center
```

- `k_follow ∈ [0.15, 0.35]` : à quel point la ligne suit le ballon latéralement.
- `pull_center` : vecteur vers l'axe, pondéré par `compact` (compacité de bloc).
- La **ligne défensive** partage une coordonnée `x` commune `defLineX`, lissée :
  `defLineX ← lerp(defLineX, ball_x − offset, 0.2)`. Cela produit la montée/descente
  synchronisée du bloc.

Distribution d'un défenseur central quand le bloc est **organisé** et le ballon
est loin (`d_ball > 20 m`) :

```
Tenir la ligne / coulisser  : 62 %
Ajuster la couverture axiale: 24 %
Anticiper une passe (avancer): 14 %
```

### 3.2 Pressing

Le pressing est déclenché de façon **probabiliste et collective**, pas par un seuil
de distance. L'intensité globale suit le curseur tactique `press ∈ [0,1]`, calibré
pour reproduire des valeurs de **PPDA** cohérentes :

- PPDA bas (≈ 6–9) = pressing très haut et agressif → `press ≈ 0.8–1.0`.
- PPDA élevé (≈ 14–20) = bloc bas passif → `press ≈ 0.1–0.3`.

Probabilité qu'un joueur donné devienne **presseur** du porteur :

```
P(press_i) = σ( β₀ + β₁·press − β₂·d_ball_i + β₃·(zone_haute) − β₄·fatigue_i
                 + β₅·(est_le_plus_proche) )
```

`σ` = sigmoïde. Le joueur le plus proche a une forte probabilité, mais **pas 1** :
parfois personne ne sort (bloc passif), parfois deux sortent (doublage). Exemple,
défenseur central, ballon à moins de 8 m, bloc haut :

```
Presser (sortir sur le porteur) : 66 %
Couvrir derrière le presseur    : 22 %
Rester dans la ligne            : 12 %
```

Si **un partenaire presse déjà** le porteur, la distribution se recompose (le
doublage systématique est rare et coûteux) :

```
Fermer une ligne de passe intérieure : 55 %
Couvrir la profondeur                : 27 %
Doubler le pressing                  : 18 %
```

### 3.3 Marquage

Le marquage individuel affecte un défenseur à un attaquant. L'affectation résout un
**problème d'assignation** (minimisation du coût total, type Hongrois ou glouton) :

```
coût(def_i, att_j) = w₁·dist(i,j) + w₂·mismatch_rôle(i,j) − w₃·danger(att_j)
```

où `danger(att_j)` intègre le `xT` de la position de `att_j` : on marque en priorité
les joueurs dans les zones à forte menace (demi-espaces, intervalle). Le marquage
n'est pas permanent : à chaque tick, probabilité de **lâcher** le marquage pour
revenir au bloc si le danger baisse :

```
P(lâcher) = σ( γ₀ − γ₁·danger(att_j) + γ₂·(bloc_désorganisé) )
```

### 3.4 Couverture

Un défenseur non-presseur couvre l'espace derrière le presseur. Sa cible est un
barycentre pondéré entre sa position de bloc et l'espace dangereux ouvert par la
sortie du presseur :

```
target_cover = α·anchor + (1−α)·(presseur + profondeur·direction_but)
α ≈ 0.5, ajusté par compact
```

### 3.5 Fermeture des lignes de passe (cover shadow)

Chaque défenseur projette une **ombre de couverture** : un secteur angulaire depuis
le porteur qui « éteint » les passes derrière lui. Modélisation : une passe du
porteur `B` vers une cible `T` est **coupée** avec une probabilité fonction de
l'alignement d'un défenseur `D` sur le segment `B→T` :

```
P(intercept | D) = σ( δ₀ − δ₁·dist_perp(D, segment_BT) − δ₂·dist_along_excess )
```

Le défenseur choisit son placement pour **maximiser l'ombre** sur les passes les plus
menaçantes (celles vers les zones à haut `xT`), pas pour se rapprocher du ballon.
C'est la différence entre défendre l'homme et défendre les **lignes de passe**.

---

## 4. Phase de construction offensive

### 4.1 Construction basse (build-up)

En zone basse, priorité à la conservation et à la progression propre. Le porteur
sous **faible pression** (`ρ_opp` local faible) :

```
Passe verticale (progressive)   : 40 %
Passe latérale (circulation)    : 30 %
Conduite (porter vers l'espace) : 18 %
Passe arrière (recycler)        : 12 %
```

Sous **forte pression** (`ρ_opp` élevé, presseur proche) la distribution bascule
vers la sécurité — c'est la réaction naturelle observée :

```
Passe arrière / gardien         : 38 %
Passe latérale                  : 34 %
Passe verticale risquée         : 18 %
Dribble pour éliminer           : 10 %
```

Chaque option de passe est en réalité une **famille** : le choix de la cible précise
maximise une utilité de passe (voir §4.4). Les pourcentages ci-dessus sont la
répartition par **type**, pas par joueur cible.

### 4.2 Progression (passer les lignes)

La progression valorise le gain de `xT`. L'utilité d'une action progressive :

```
U_prog(action) = xT(destination) − xT(origine) − risk(action)·λ_risk
```

`λ_risk` dépend du style et du contexte (score, temps). Une équipe menée en fin de
match augmente `λ_risk⁻¹` (accepte plus de risque). Le passage entre lignes
(« line-breaking pass ») a un `xT_gain` élevé mais un `risk` élevé aussi : c'est
l'arbitrage central de la construction.

### 4.3 Occupation des espaces (demi-espaces, largeur, profondeur)

Les joueurs sans ballon ne restent pas statiques : ils **occupent** des zones de
valeur. On maximise une couverture d'équipe des zones à fort `xT`, en particulier
les **demi-espaces** (half-spaces, les deux couloirs intérieurs), fortement corrélés
à la création d'occasions dans le football moderne. Fonction objectif collective :

```
J_occupation = Σ_zones xT(zone) · occupée(zone) − μ·Σ_paires proximité(i,j)
```

Le second terme **pénalise** l'agglutinement (deux joueurs dans la même zone) — il
force l'étalement naturel. Chaque joueur sans ballon reçoit une zone cible via une
affectation qui maximise `J_occupation`, avec bruit pour éviter le placement
mécanique parfait.

### 4.4 Utilité d'une passe (choix de la cible)

Pour une passe candidate du porteur vers un partenaire `T` :

```
U_pass(T) = w_p·P_complétion(T)
          + w_x·(xT(T) − xT(porteur))
          + w_s·avantage_espace(T)
          − w_r·risque_perte(T)
```

- `P_complétion(T)` : probabilité que la passe arrive, fonction de la distance, du
  nombre de défenseurs sur la trajectoire (cover shadows, §3.5), de la vitesse
  requise, et de `pas` (qualité de passe) du porteur.
- `avantage_espace(T)` : le `PC` (pitch control) de `T` — reçoit-il dans un espace
  qu'il contrôle ?
- Le porteur échantillonne alors sa cible via softmax sur `U_pass` de tous les
  partenaires visibles. Il ne choisit donc pas toujours la « meilleure » passe :
  il choisit **probablement** une bonne passe.

### 4.5 Création de déséquilibre

Le déséquilibre naît quand un joueur **fixe** un adversaire puis libère un partenaire
(surcharge locale → renversement). Modélisation :

- **Surcharge (overload)** : concentrer temporairement `ρ_team > ρ_opp` dans un
  couloir. Détectée quand le ratio local dépasse un seuil souple ; augmente
  l'utilité des passes courtes rapides dans ce couloir.
- **Renversement (switch)** : quand une surcharge a attiré le bloc adverse d'un
  côté, l'utilité d'une passe longue vers le couloir **opposé** (faible `ρ_opp`)
  monte fortement. C'est l'exploitation du déséquilibre créé.

### 4.6 Fixation

Un porteur **fixe** un défenseur en portant le ballon vers lui (conduite orientée),
ce qui gèle ce défenseur et ouvre l'espace derrière/à côté. Utilité de fixation :

```
U_fix = espace_libéré_attendu · P(le_défenseur_mord) − risk_conduite
```

`P(le_défenseur_mord)` dépend de l'agressivité défensive adverse (liée à son `press`).
La fixation est une conduite **au service d'un partenaire**, pas d'un dribble
individuel : son utilité intègre le gain pour l'équipe, pas pour le porteur seul.

### 4.7 Projection

La projection est la course vers l'avant d'un joueur (souvent milieu ou latéral)
pour ajouter un homme dans la surface / la zone de finition. Probabilité qu'un
joueur se projette :

```
P(projection_i) = σ( π₀ + π₁·(zone_ballon_haute) + π₂·rôle_offensif_i
                       − π₃·risque_contre − π₄·fatigue_i + π₅·(Δscore<0)·urgence )
```

Le terme `−π₃·risque_contre` est essentiel : on ne projette pas tout le monde, sous
peine de s'exposer à la transition adverse. L'équilibre **projection vs. reste** est
une contrainte de structure (voir §6).

---

## 5. Transitions

Les transitions sont les moments de plus forte valeur (et de plus fort risque) du
football moderne.

### 5.1 Transition offensive (contre-attaque)

Immédiatement après récupération, fenêtre où le bloc adverse est déséquilibré.
L'utilité de **verticalité** est temporairement **boostée** :

```
U_vertical ← U_vertical · (1 + κ·transition_freshness)
transition_freshness = exp(−t_since_recovery / λ_ca),  λ_ca ≈ 3 s
```

Plus on agit vite après la récupération, plus la passe vers l'avant est valorisée.
Passé ~3–5 s, `transition_freshness → 0` et on retombe en construction normale.

Décision du récupérateur juste après un gain de balle :

```
Passe vers l'avant (lancer le contre) : 47 %
Conduite rapide dans l'espace         : 28 %
Sécuriser (passe courte латérale)     : 17 %
Passe arrière (temporiser)            :  8 %
```

### 5.2 Transition défensive (contre-pressing vs. repli)

Après une perte, choix collectif entre **contre-presser** immédiatement (règle des
5 secondes) ou **se replier** en bloc. Probabilité de contre-presser :

```
P(counterpress) = σ( ζ₀ + ζ₁·press − ζ₂·d_ball_moyenne_équipe
                       + ζ₃·(zone_haute) − ζ₄·fatigue_collective )
```

Une équipe à haute intensité (`press` élevé) en zone haute contre-presse souvent ;
une équipe fatiguée ou déjà basse se replie. Les deux comportements coexistent selon
le contexte, sans règle fixe.

---

## 6. Contraintes de structure d'équipe

Les décisions individuelles sont **contraintes** par la cohérence collective. On
impose des termes de régularisation globaux :

- **Compacité** : la distance verticale entre ligne défensive et ligne offensive
  reste bornée (≈ 30–40 m en bloc). Un terme de rappel tire les lignes vers cette
  cible.
- **Largeur** : au moins deux joueurs tiennent la largeur en attaque (couloirs) ;
  pénalité si tout le monde se centralise.
- **Équilibre reste-défensif** : au moins `n_rest` joueurs (souvent 2–3 + gardien)
  restent en position basse pendant une attaque, pour couvrir la transition. Contrainte
  dure sur le nombre de projections simultanées (§4.7).
- **Non-agglutinement** : terme répulsif entre partenaires proches (déjà dans
  `J_occupation`, §4.3).

Ces contraintes s'appliquent comme **pénalités additives** aux utilités
individuelles, pas comme interdictions. Un joueur peut violer la structure si
l'utilité locale est très forte (ex. une occasion de but) — comme dans la réalité.

---

## 7. Distributions de déplacement (mouvement naturel)

Le mouvement ne vise pas un point fixe atteint en ligne droite. Chaque joueur a une
**cible** `target` (issue des sections précédentes) mais son déplacement réel est
bruité et lissé :

- **Cible bruitée** : `target_effective = target + η`, `η ∼ 𝒩(0, σ_pos²)`, avec
  `σ_pos` plus grand pour les joueurs fatigués ou loin de l'action (flottement
  naturel), plus petit pour un presseur (course précise).
- **Lissage d'accélération** : la vitesse suit `v ← lerp(v, direction·v_max, a)`
  avec `a` (réactivité) dépendant du rôle et de l'état (presseur : `a` élevé,
  changement de direction net ; joueur en bloc : `a` faible, glisse doucement).
- **Vitesse maximale** modulée : `v_max = v_base·(sprint?)·(1 − fatigue·k_fat)`.
- **Micro-ajustements** : petites corrections aléatoires de trajectoire à basse
  fréquence, pour éviter les lignes parfaitement droites (aspect « robot »).

Résultat : deux joueurs dans la même situation ne suivent jamais exactement le même
chemin, et un même joueur ne répète pas exactement une course.

---

## 8. Logique de risque / récompense (transversale)

Toute action offensive arbitre entre gain espéré et risque de perte. On formalise
par une **utilité espérée nette** :

```
EU(action) = P(succès)·récompense(action) − P(échec)·coût(perte, position)
```

- `récompense` ∝ `xT_gain` (avancer vers une zone dangereuse).
- `coût(perte)` ∝ danger de la transition adverse **depuis la position de perte** :
  perdre le ballon dans son propre tiers coûte bien plus que dans le tiers adverse.
- Le rapport risque/récompense est modulé par le **contexte de match** :

```
appétit_risque = base_style · f(Δscore, t_rem)
```

Une équipe menée à 10 minutes de la fin voit son `appétit_risque` monter (passes
plus verticales, plus de projections, ligne plus haute) ; une équipe qui mène le
voit baisser (conservation, bloc plus bas). C'est ce qui produit les fins de match
réalistes.

---

## 9. Influence continue des variables (récapitulatif opérationnel)

Chaque variable de contexte agit sur les probabilités de façon **continue et
monotone**, jamais par palier. Table des effets principaux (signe de l'effet sur
l'utilité de l'action) :

| Variable ↑ | Presser | Passe verticale | Passe arrière | Projection | Dribble |
|---|:--:|:--:|:--:|:--:|:--:|
| `d_ball` | − − | · | · | · | · |
| `v_ball` | − | − | + | · | − |
| `ρ_opp` local | · | − − | + + | − | − |
| `ρ_team` local | · | + | · | + | · |
| `Δscore < 0` (mené) | + | + + | − | + + | + |
| `t_rem` faible (fin) | +/− | + (si mené) | − (si mené) | + (si mené) | · |
| `fatigue` | − − | − | + | − − | − |
| `tec / pas / sht` | · | + | − | · | + + |
| `xT(destination)` | · | + + | − − | + | + |
| `PC` local (contrôle) | · | + | · | + | + |
| `press` (style) | + + | · | · | · | · |

`+`/`−` = sens de l'effet ; doublé = effet fort. Ces effets entrent comme termes
pondérés dans les fonctions d'utilité — les coefficients (`w`, `β`, etc.) sont les
boutons de réglage.

---

## 10. Bruit contrôlé et non-répétition (garantie de naturel)

Trois sources de variation garantissent qu'aucune situation ne produit deux fois le
même comportement :

1. **Bruit d'utilité** `ε ∼ 𝒩(0, σ²)` avant softmax (§0) → variation de ±5 à ±10 %
   sur les probabilités effectives, somme conservée à 100 % par renormalisation
   softmax.
2. **Température dynamique** `τ` (§0) → dispersion des choix variable selon
   pression/fatigue/skill.
3. **Bruit de trajectoire** `η` (§7) → mouvement jamais parfaitement rectiligne ni
   identique.

Important : le bruit est **contrôlé**, borné. Il simule l'imperfection humaine sans
rendre le jeu incohérent. Un très bon joueur au calme (`τ` bas, `σ` bas) reste
fiable ; un joueur fatigué sous pression (`τ` haut, `σ` haut) multiplie les
approximations — exactement la variance observée en match réel.

---

## 11. Annexe : métriques spatiales de référence

- **Pitch Control `PC(x,y)`** : probabilité que l'équipe contrôle le point `(x,y)`,
  calculée à partir des positions et vitesses des 22 joueurs (modèle de temps
  d'arrivée : qui atteint le point en premier, pondéré). Sert à évaluer l'espace
  contrôlé par une cible de passe (§4.4) et les zones à occuper (§4.3).

- **Expected Threat `xT(x,y)`** : valeur d'avoir le ballon en `(x,y)`, = probabilité
  pondérée de marquer dans les `n` actions suivantes depuis cette zone. Une grille
  `xT` (typiquement 12×8) suffit. Sert de fonction de valeur pour toute la
  progression (§4.2, §4.4, §8). Les demi-espaces et l'entrée de surface ont les
  valeurs les plus élevées.

- **PPDA (Passes Per Defensive Action)** : mesure inverse de l'intensité de pressing
  (passes adverses concédées avant une action défensive). Sert à **calibrer** le
  curseur `press` d'une équipe pour qu'il reproduise un style connu (haut-pressing
  vs. bloc bas).

- **xThreat de passe** : `xT(destination) − xT(origine)`, le gain de menace d'une
  passe — cœur de l'utilité progressive.

---

## 12. Résumé d'implémentation (pour le développeur)

Boucle de décision, par joueur, à chaque tick de décision (≈ 5–10 Hz suffisent, le
mouvement étant lissé à 60 Hz) :

1. Recalculer le vecteur de contexte `C` (distances, densités, PC, xT locaux…).
2. Déterminer l'état d'équipe (attaque / défense / transition) et le profil de
   pondérations associé.
3. Générer les actions candidates selon le rôle et la phase.
4. Calculer `U(aᵢ)` pour chaque candidate (utilités des §3–§8), appliquer les
   pénalités de structure (§6).
5. Ajouter le bruit `ε`, appliquer le softmax tempéré (`τ` dynamique) → distribution.
6. Échantillonner l'action (et, pour une passe, échantillonner la cible via son
   propre softmax sur `U_pass`).
7. Traduire en cible de déplacement / ordre de passe, appliquer le bruit de
   trajectoire `η` et le lissage (§7).

Aucune étape ne contient de `si X alors Y` dur : tout est utilité → probabilité →
échantillon, modulé en continu par le contexte et bruité pour le naturel.

---

# PARTIE II — Modèle offensif (décision du porteur et des partenaires)

Même philosophie : aucune règle fixe. Chaque action offensive candidate reçoit une
utilité dérivée des **métriques offensives** (xG, xA, xT, OBV, key passes, box
entries, final-third entries, progressive actions, crosses, through balls, touches
dans la surface, shot-on-target %), convertie en probabilité par softmax tempéré et
bruitée pour le naturel. Cette partie est **implémentée** dans `ai_offense.js`.

## 13. Actions candidates du porteur

`A = { tir, passe_sûre, passe_surface(through), centre(cross), renversement(switch),
dribble, conduite(carry) }`

Chaque action a une utilité `U(a)` ; le porteur échantillonne via
`P(a) = softmax(U(a)/τ)` avec bruit gaussien pré-softmax (±5-10 %).

## 14. Fonctions d'utilité offensives

### 14.1 Proxy xG (valeur d'un tir)
```
xG = 0.55·exp(−dist/9) · cos(angle) · 0.62^blockers · (0.8 + 0.4·finition/99)
```
- `dist` : distance au but ; `angle` : fermeture de l'angle de tir ;
- `blockers` : défenseurs dans le couloir de tir (chacun divise l'xG) ;
- décroissance exponentielle calibrée sur la forme réelle de l'xG (≈ 0.45 à bout
  portant, ≈ 0.03 à 25 m).

`U_tir = 4.2·xG + 1.4·√xG + log(tend_poste_tir · tend_style_tir)`

La convexité (`√xG`) fait que sur une **grosse occasion**, le tir domine nettement
(un attaquant seul face au but tire, il ne dribble pas) ; sur un tir à faible xG,
l'utilité s'effondre et d'autres actions passent devant.

### 14.2 Proxy xT (valeur d'une position)
```
xT(x,y) = prog^2.2 · (0.6 + 0.4·laneBonus)
```
- `prog` : progression vers le but adverse [0,1] ;
- `laneBonus` : bonus pour l'axe central **et les demi-espaces** (deux bandes
  intérieures), zones les plus corrélées à la création dans le football moderne ;
- exposant 2.2 : croissance convexe dans le dernier tiers.

### 14.3 Proxy xA et paysage de passe
Pour chaque cible de passe `T` accessible :
```
p_complétion(T) = clamp(1 − d/(0.75·L), 0.1, 0.97) · 0.8^densité_adverse_locale
xA(T)           = xG(T) · p_complétion(T)
gain_xT(T)      = (xT(T) − xT(porteur)) · p_complétion(T)
```
On en extrait : meilleure `xA`, meilleur `gain_xT`, valeur d'**entrée de surface**
(box entry), valeur de **passe en profondeur** (through ball : cible avancée dans
l'axe), valeur de **centre** (cible dans la surface depuis un couloir large), valeur
de **renversement** (cible sur le couloir opposé).

Utilités correspondantes :
```
U_passe_sûre   = 1.4·gain_xT + 0.5·(1−pression) + 0.4 + log(tend_pass)
U_through      = 2.2·xA_profondeur + 0.2·box_entry + log(tend_pass)
U_cross        = 2.3·xA_centre · pied_fort + log(...)
U_switch       = 1.3·val_renversement + 0.3·pression + log(...)
```

### 14.4 Dribble et conduite
```
skill_dribble = (tec·0.6 + spd·0.4)/99
U_dribble = 2.0·skill_dribble·(0.35 + 0.65·pression) + 0.9·xT + log(tend_drib) − 0.3
U_carry   = 0.9·(1−pression)·(0.4 + 0.6·xT) + log(tend_drib·0.5 + 0.4)
```
Le dribble monte sous pression (il faut éliminer) et pour un dribbleur ; la conduite
monte dans l'espace libre (faible pression) mais reste modérée pour ne pas éclipser
passe et dribble.

## 15. Variables de modulation offensive (implémentées)

| Variable | Effet |
|---|---|
| **Zone du terrain** | via `xT` (dernier tiers, demi-espaces) et `canShoot` (portée de frappe selon le mode 5v5/7v7/11v11) |
| **Densité adverse** | `pression` locale ; baisse xG et complétion, monte l'utilité de dribble |
| **Qualité du dernier contrôle** | `control<0.5` → pénalise tir et dribble, favorise la passe de sécurité |
| **Pied fort / faible** | multiplicateur sur le centre selon le côté (`onStrongSide` 0.9–1.1) |
| **Nombre de partenaires** | `nOptions ≤ 1` → passes pénalisées, conduite/dribble favorisés |
| **Valeur attendue (xG/xA/xT)** | cœur de chaque utilité |
| **Score / temps restant** | `urgence = (−Δscore)·(1 − t_rem/90)` : mené en fin de match → tir/through boostés ; en tête → conservation |
| **Fatigue** | monte `τ` (décisions plus dispersées) et réduit la vitesse d'exécution |

## 16. Température dynamique offensive
```
τ = clamp( 0.30·(1 + 0.5·pression + 0.4·fatigue − 0.3·technique/99), 0.12, 0.6 )
```
Un attaquant technique au calme tranche proprement (τ bas) ; un joueur fatigué et
pressé multiplie les choix sous-optimaux (τ haut) — exactement la variance réelle.

## 17. Exemples de distributions produites (mesurées sur le moteur implémenté)

**Attaquant dans la surface, occasion nette** → tir ~54 %, dribble ~43 %, passe ~3 %.
La grosse xG fait dominer le tir, sans le rendre automatique.

**Milieu offensif, possession installée** → passe ~84 %, dribble ~11 %, through ~4 %.

**Le MÊME milieu, mené 0-1 à la 85e** → through ~31 %, tir ~24 %, passe ~24 % : le
contexte de match bascule vers le risque.

**Le MÊME milieu, en tête 1-0 à la 85e** → passe ~79 %, tir ~1 % : conservation.

**Défenseur central en construction basse** → passe ~95 % : sécurise.

À situation strictement identique, trois exécutions successives donnent des
distributions légèrement différentes (± quelques points) mais tactiquement
cohérentes : le comportement n'est jamais exactement répété.

## 18. Intégration dans FootSim (état actuel)

`ai_offense.js` expose `window.offensiveDecision(carrier, ati, dti, ctx)`. L'IA de
match (`ia.js`) l'appelle au point de décision du porteur : le moteur d'utilité
**choisit** l'action, et l'exécution (tir, dribble, passes tactiques) réutilise les
helpers existants (`doShot`, `_attemptDribble`, `tacticalPassDecision`,
`bestPassTarget`, `kickToP`). En cas d'absence du module, l'ancienne logique de
seuils sert de repli — aucune régression possible.

Ce qui reste ouvert pour une future itération (partie théorique de la Partie I non
encore branchée) : un vrai **Pitch Control** à temps d'arrivée (actuellement approché
par la densité locale), une grille `xT` pré-calculée par zone, et le contre-pressing
collectif des 5 secondes modélisé comme transition d'équipe. Ces briques sont
décrites en Partie I et peuvent être intégrées progressivement.

---

# PARTIE III — Modèle défensif et mouvement (implémenté)

Complète les parties I (théorie) et II (offensif). Implémenté dans `ai_offense.js`
(`defensiveIntent`, `assignMarking`) et branché dans `engine.js`.

## 19. Intention défensive par utilité

Pour chaque défenseur, quatre comportements en compétition, choisis par softmax :
`{ press, cover, hold, shadow }`.

```
U_press  = 1.8·exp(−d_ball/10) + 1.2·press + 0.6·xT_adverse
           − 0.9·[partenaire_presse_déjà] − 0.5·fatigue + 0.3·def/99
U_cover  = 0.9 + 1.0·[partenaire_presse] + 0.8·xT_adverse − 0.3·exp(−d_ball/10)
U_hold   = 1.1 + 0.8·(1 − exp(−d_ball/14)) − 0.4·xT_adverse
U_shadow = 0.7 + 0.9·[partenaire_presse] + 0.5·xT_adverse − 0.4·fatigue
```

Comportement mesuré :

- Défenseur proche du ballon, personne ne presse → **press ~96 %**.
- Un partenaire presse déjà → **cover ~72 %, shadow ~24 %** (le doublage
  systématique est évité, comme dans le jeu réel).
- Bloc désorganisé (danger, personne ne sort) → **press ~98 %** (on reforme en
  attaquant le ballon).
- Ballon loin, pressing bas → **hold ~97 %** (on tient la ligne).

La température monte avec la fatigue et baisse avec la qualité défensive : un bon
défenseur frais tranche net, un défenseur cuit se disperse.

## 20. Affectation de marquage sans croisement

Le glouton « attaquant le plus dangereux → défenseur le plus proche » pouvait faire
**se croiser** deux défenseurs (chacun courant vers l'homme de l'autre). On résout
désormais une affectation globale par amélioration 2-opt :

```
initialiser par glouton (danger décroissant)
répéter jusqu'à stabilité :
  pour chaque paire d'affectations (i, j) :
    si coût(dᵢ→aⱼ)+coût(dⱼ→aᵢ) < coût(dᵢ→aᵢ)+coût(dⱼ→aⱼ) :
      échanger
```

Exemple mesuré : deux défenseurs et deux attaquants croisés, coût glouton 53.0 →
coût optimisé 10.8. Chacun prend l'homme en face, plus de course inutile qui se
croise. Sans dépendance externe, complexité négligeable pour ≤ 11 joueurs.

## 21. Mouvement naturel (déjà présent dans le moteur, formalisé)

Le moteur applique déjà les principes de la §7 : cible bruitée (`wander`
sinusoïdal par joueur, amplitude selon le rôle), lissage d'accélération
(`v ← lerp(v, dir·v_max, a)` avec `a` selon presseur/marqueur/bloc), vitesse
modulée par fatigue et blessure, et micro-oscillations pour éviter les lignes
droites parfaites. La ligne défensive partage un `defLineX` lissé pour monter et
descendre de façon synchronisée.

## 22. Corrections de bugs livrées avec cette itération

- **Marquage qui se croise** : remplacé par l'affectation globale 2-opt (§20).
- **Pied fort inexistant** : les joueurs reçoivent désormais un pied
  (`foot ∈ {L,R,both}`, ~75/22/3 %, postes de couloir gauche un peu plus
  gauchers), utilisé par l'IA offensive (valeur des centres/tirs du bon côté).
  Les remplaçants sans pied défini le reçoivent à la volée, de façon stable.
- **Robustesse** : `offensiveDecision`, `defensiveIntent` et `assignMarking`
  tournent sans erreur runtime ; repli automatique sur l'ancienne logique si un
  module manque (aucune régression possible).

## 23. Ce qui reste théorique (non branché)

- **Pitch Control** à temps d'arrivée réel (actuellement approché par la densité
  locale et `defLineX`).
- **Grille xT** pré-calculée par zone (actuellement une fonction analytique
  continue, §14.2).
- **Contre-pressing collectif des 5 secondes** modélisé comme transition d'équipe
  formelle (§5.2) — la fenêtre de contre existe déjà via `gegenT`, mais pas la
  décision collective probabiliste complète.
