# Intégration du système de tribunes

**5 points de branchement.** La surface jouable (`WW`/`WH`) n'est jamais touchée.

---

## 1. `index.html` — charger le module

`stands.js` utilise `wx/ws` (data.js), `pick/rng` et `pal` (visual.js) → à charger **après** les deux.

```html
<script src="visual.js"></script>
<script src="stands.js"></script>   <!-- ← AJOUTER ICI -->
```

---

## 2. `visual.js:482` — `resize()` : réserver la marge

**C'est le seul changement structurel.** Marge fixe de 8px → marge proportionnelle.

```js
// REMPLACER :
  const margin=8;
  const sx=(cvs.width-margin*2)/WW,sy=(cvs.height-margin*2)/WH;

// PAR :
  const _sr = (typeof _standRatio==='function') ? _standRatio() : 0.12;
  const mx = Math.max(8, cvs.width  * _sr);
  const my = Math.max(8, cvs.height * _sr);
  const sx=(cvs.width-mx*2)/WW, sy=(cvs.height-my*2)/WH;
```

Les 3 lignes suivantes (`_s`, `_ox`, `_oy`) restent **inchangées** : le centrage
fonctionne toujours. Le terrain rétrécit à l'écran, WW/WH ne bougent pas → l'IA,
la physique et les collisions sont strictement identiques.

---

## 3. `visual.js:813` — remplacer `crowdBand` par `drawStands`

Dans l'IIFE `drawStadiumBorder`, supprimer la fonction `crowdBand` **et ses 4 appels** :

```js
// SUPPRIMER (le bloc `const crowdBand=(x,y,w,h)=>{...};` en entier)
// SUPPRIMER ces 4 lignes :
    crowdBand(0,0,leftM,oc.height);
    crowdBand(px1,0,rightM,oc.height);
    crowdBand(0,0,oc.width,topM);
    crowdBand(0,py1,oc.width,bottomM);

// AJOUTER à la place :
    if(typeof drawStands==='function') drawStands(c, oc, pal);
```

Garde `drawBoard` (panneaux LED) et les projecteurs : ils passent **par-dessus**
les gradins et les ancrent. Les variables `px0/py0/px1/py1/leftM/rightM/topM/bottomM`
en tête de l'IIFE sont conservées telles quelles.

---

## 4. `visual.js:871` — corriger le vignettage

⚠️ **Piège signalé** : le vignettage assombrit les bords à 28% — exactement là où
sont les tribunes. Sinon tu peins un décor que tu masques ensuite.

```js
// REMPLACER :
  vg.addColorStop(1,'rgba(0,0,0,.28)');
// PAR :
  vg.addColorStop(1,'rgba(0,0,0,.16)');
```

---

## 5. `visual.js:2096` — brancher les couches dynamiques

Dans `frame()`, juste **après** `drawPitch()` :

```js
  drawPitch();
  if(typeof drawCrowdWave==='function') drawCrowdWave(rawDt);   // ola
  if(typeof drawStandBurst==='function') drawStandBurst();      // flash de but
```

> Utilise le même `rawDt` que `drawSnow(rawDt)`. Si le nom diffère dans ta
> boucle, aligne-toi dessus.

---

## 6. `visual.js:4` — `spawnGoal()` : embraser le virage

Juste après `triggerFlash(col, 0.32, 420);` :

```js
  if(typeof triggerStandBurst==='function'){
    triggerStandBurst(ati!==undefined?ati:G.atkTi, col);
  }
```

---

## Optionnel — réglage utilisateur

`setStandsEnabled(false)` désactive les gradins (persisté en localStorage,
ratio retombe à 2% → quasi l'ancien rendu). À câbler dans `renderSettings()`
à côté du sélecteur de thème, sur le modèle de `G._shakeOff`.

---

## Vérification

1. **Le terrain n'a pas changé de taille en unités monde** — seulement à l'écran.
   Les positions des joueurs restent cohérentes (tout passe par `wx/wy/ws`).
2. **Thème `classic`** → aucune tribune (`pal.border` est `false`). Voulu.
3. **Mobile (<560px)** → ratio 5%, gradins sautés si marge <26px, LED conservées.
4. **Perf** → gradins dans `_pitchCache`, 1 blit/frame. Seule l'ola itère sur
   `_crowdCells` (quelques centaines d'entrées, filtrées par `if(d > span) continue`).

---

## Ce que le joueur voit

| Capacité | Rangées | Toit | Virages | Matériau |
|---|---|---|---|---|
| ≤ 1 500 (DH) | 2 | ✗ | ✗ | bois |
| ≤ 5 000 (R3/R2) | 3 | ✗ | ✗ | béton |
| ≤ 12 000 (R1/D3) | 4 | ✗ | ✓ | béton |
| ≤ 25 000 (D2) | 5 | ✓ | ✓ | sièges |
| > 25 000 (D1) | 6 | ✓ | ✓ | sièges |

Le remplissage suit `0.25 + reputation/120` — **la même formule que les finances**
(`save.js:765`), donc le stade que le joueur voit correspond aux recettes qu'il lit
dans son bilan. Les virages prennent les couleurs des deux équipes.
