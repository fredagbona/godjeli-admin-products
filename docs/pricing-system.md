# Documentation — Système de prix catalogue (GoDjeli Admin)

**Objet de ce document :** décrire comment le prix affiché et le prix total payé par le client sont calculés à partir des données saisies en admin, afin de faciliter la **validation métier** (direction, finance, produit).

**Périmètre :** backend `admin-product`, service `buildPricing` (`src/services/pricing.service.js`). Les montants sont en **euros (EUR)** sauf mention contraire.

---

## 1. Résumé exécutif

- Le **prix marketplace (total TTC logique)** n’est **pas saisi** tel quel : il est **recalculé** à partir du **prix fournisseur**, du **poids** et de l’**origine logistique** (Europe ou Chine).
- Le moteur applique des **constant**es figées dans le code : taux transport au kg, forfait douanes, **marge cible 20 %** et **frais de paiement 2,9 %** calculés sur le **prix total**.
- Le total payé est ensuite **réparti à l’affichage** entre une ligne « produit » et une ligne « frais de port et douanes », avec un **petit ajustement** pour que la somme des deux lignes soit **exactement** égale au total (cohérence panier).

---

## 2. Données saisies en admin (entrées)

| Champ | Description | Contrainte métier (code actuel) |
|--------|-------------|----------------------------------|
| `costPriceEur` | Prix d’achat / coût produit côté fournisseur | Doit être **≥ 5 EUR** (sinon rejet au calcul) |
| `weightGrams` | Poids utilisé pour estimer le coût logistique | Entier ≥ 0 |
| `origin` | Origine d’expédition pour le barème au kg | `EUROPE` ou `CHINA` |

---

## 3. Constantes du modèle

| Constante | Valeur | Rôle |
|-----------|--------|------|
| Taux Europe → Bénin | **15,24 EUR / kg** | Coût logistique proportionnel au poids |
| Taux Chine → Bénin | **13,72 EUR / kg** | Idem, origine Chine |
| Forfait douanes | **0,50 EUR** | Ajouté au coût « réel » avant marge |
| Marge cible | **20 %** | Appliquée sur le **prix total** (`totalPriceEur`) |
| Frais de paiement | **2,9 %** | Appliqués sur le **prix total** |
| Dénominateur prix total | **0,771** | Égal à `1 − 0,20 − 0,029` ; sert à déduire le total à partir du coût réel |
| Répartition affichage logistique | **40 % / 60 %** | Part de la logistique affectée à la ligne « produit » vs la base « port + douanes » |

Toutes les valeurs monétaires intermédiaires sont **arrondies à 2 décimales** (centimes).

---

## 4. Chaîne de calcul (vue synthétique)

| Étape | Formule (conceptuelle) |
|-------|-------------------------|
| 1. Logistique | `logisticsCost = (poids_kg) × taux_origine` |
| 2. Coût réel (hors marge et hors frais paiement) | `realCost = costPrice + logisticsCost + douanes` |
| 3. Prix total client | `totalPrice = realCost / 0,771` |
| 4. Marge et frais paiement (sur le total) | `marge = total × 20 %` ; `paiement = total × 2,9 %` |
| 5. Ligne « produit » (affichage) | `prix_fournisseur + 40 % logistique + marge` |
| 6. Base « port + douanes » (affichage) | `60 % logistique + douanes` |
| 7. Ajustement affichage | `total − ligne_produit − base_port_douanes` (peut être positif ou négatif après arrondis ; garantit l’égalité stricte) |
| 8. Ligne « port + douanes » finale | `base + ajustement` |

**Propriété garantie par le code :**  
`displayProductPriceEur + displayShippingAndCustomsEur = totalPriceEur` (après arrondis).

---

## 5. Exemple chiffré — Produit « Robe » (Europe)

**Hypothèses :** `costPriceEur = 10,00` · `weightGrams = 200` · `origin = EUROPE`

### 5.1 Calculs intermédiaires

| Libellé | Calcul | Montant (EUR) |
|---------|--------|----------------|
| Poids | 200 g = 0,200 kg | — |
| Logistique | 0,200 × 15,24 | **3,05** |
| Douanes | Forfait | **0,50** |
| Coût réel (1+2+3) | 10 + 3,05 + 0,50 | **13,55** |
| **Prix total client** | 13,55 ÷ 0,771 | **17,57** |
| Marge (20 % du total) | 17,57 × 0,20 | **3,51** |
| Frais paiement (2,9 % du total) | 17,57 × 0,029 | **0,51** |

### 5.2 Décomposition affichée (marketplace)

| Ligne affichée | Détail | Montant (EUR) |
|----------------|--------|----------------|
| Part « produit » | 10 + (40 % × 3,05) + 3,51 | **14,73** |
| Base « port + douanes » | (60 % × 3,05) + 0,50 | **2,33** |
| Ajustement | 17,57 − 14,73 − 2,33 | **0,51** |
| **« Port + douanes » affiché** | 2,33 + 0,51 | **2,84** |

**Contrôle :** 14,73 + 2,84 = **17,57** (total payé).

### 5.3 Synthèse « ce que paie le client »

| Concept | EUR |
|---------|-----|
| Prix total (référence panier) | **17,57** |
| Dont présenté comme prix produit | 14,73 |
| Dont présenté comme port + douanes | 2,84 |

---

## 6. Exemple secondaire — Origine Chine (extrait test automatisé)

**Hypothèses :** `costPriceEur = 20` · `weightGrams = 500` · `origin = CHINA`

| Étape | Résultat (EUR) |
|-------|----------------|
| Taux appliqué | 13,72 / kg |
| Logistique | **6,86** |
| Prix total client (calcul moteur) | **35,49** |

(Les lignes d’affichage détaillées suivent la même logique qu’à la section 4.)

---

## 7. Points d’attention pour la validation métier

| Sujet | Détail |
|-------|--------|
| **« Frais de port »** | Ce n’est pas un tarif transport saisi manuellement : c’est un **modèle au kg + douane**, puis une **répartition d’affichage** 40/60 avec ajustement pour coller au total. |
| **Marge et paiement** | Ils sont définis comme des **pourcentages du prix total**, pas du prix fournisseur seul. |
| **Plancher prix fournisseur** | Refus du calcul si `costPriceEur < 5` ; à valider si des produits réels peuvent être en dessous. |
| **Taux et forfaits** | Les valeurs 15,24 / 13,72 / 0,50 / 20 % / 2,9 % sont **dans le code** : toute évolution contractuelle ou financière impose une **mise à jour explicite** et une communication aux équipes. |
| **XOF** | Le backend peut exposer un équivalent **XOF** pour l’affichage (taux fixe dans le modèle produit) : à distinguer du cœur du calcul en EUR. |

---

## 8. Référence technique (pour les équipes)

- Implémentation : `src/services/pricing.service.js` (`buildPricing`).
- Tests de non-régression : `test/pricing.service.test.js` (exemple Europe 10 € / 200 g).
- API : l’objet détaillé `pricing` peut être masqué dans certaines réponses ; le **total** utilisé côté client est aligné sur **`totalPriceEur`** (souvent exposé via un champ virtuel `price` en EUR / XOF selon la version de l’API — à synchroniser avec la doc d’intégration `API.md`).

---

## 9. Proposition de cases à cocher (validation CEO)

- [ ] Le **prix total** dérivé du coût fournisseur + logistique + douanes + règles de marge/paiement est conforme à la politique commerciale.
- [ ] La **répartition d’affichage** (produit vs port/douanes) est acceptable pour le marketing et le juridique (transparence client).
- [ ] Les **constantes** (taux kg, douanes, % marge, % paiement) reflètent la réalité 2026 ou le scénario cible.
- [ ] Le **minimum 5 EUR** sur le prix fournisseur est assumé pour tout le catalogue.

---

*Document généré pour appui à la décision — ne remplace pas les validations légales, fiscales ou comptables.*
