# GoDjeli — Modèle de Pricing

Document interne — Confidentiel

---

## Objectif

Garantir une marge nette de **20%** sur chaque vente, tout en optimisant la perception du prix côté client.

---

## 1. Contexte

GoDjeli source des produits auprès de fournisseurs internationaux (AliExpress, Shein, Amazon, etc.) et les livre à des clients au Bénin. La logistique est externalisée et facturée au poids réel.

**Deux principes fondamentaux :**

- La marge se calcule sur le coût réel total, avant tout affichage client.
- L'affichage du prix (produit vs livraison) est une décision stratégique indépendante du calcul de rentabilité.

---

## 2. Données d'entrée

### 2.1 Variables par article

| Variable | Notation | Description |
|---|---|---|
| Prix fournisseur | `CP` | Prix d'achat sur le site fournisseur (en €) |
| Poids de l'article | `W` | Poids en grammes, converti en kg pour le calcul |
| Origine | `origin` | `EUROPE` ou `CHINA` |

### 2.2 Constantes fixes

| Paramètre | Valeur | Note |
|---|---|---|
| Tarif logistique Europe → Bénin | `15.24 €/kg` | 10 000 FCFA/kg — délai ~7 jours |
| Tarif logistique Chine → Bénin | `13.72 €/kg` | 9 000 FCFA/kg — délai ~21 jours |
| Frais de douane | `0.50 €` | Estimation mutualisée par article — à valider |
| Marge cible GoDjeli | `20%` | Appliquée sur le prix de vente final |
| Frais de paiement | `2.9%` | Mobile Money / carte — proportionnel au total |
| Part logistique intégrée au prix produit | `40%` | Décision d'affichage uniquement |
| Taux de conversion | `1 € = 700 XOF` | Pour affichage local |

---

## 3. Formules de calcul

### Étape 1 — Coût logistique (CL)

```
CL = round2((W / 1000) × tarif/kg)
```

### Étape 2 — Coût réel total

```
realCost = round2(CP + CL + 0.50)
```

### Étape 3 — Prix de vente total

La marge (20%) et les frais de paiement (2.9%) sont tous deux calculés sur le prix final.
On ne peut pas simplement ajouter 20% au coût — cela donnerait une marge sur coût, pas sur prix.

```
DENOMINATOR = 1 - 0.20 - 0.029 = 0.771

totalPrice = round2(realCost / 0.771)
```

### Étape 4 — Décomposition des montants

```
marginAmount  = round2(totalPrice × 0.20)
paymentFee    = round2(totalPrice × 0.029)
totalRealCost = round2(CP + CL + 0.50 + paymentFee)
netMargin     = round2(totalPrice - totalRealCost)
```

> `netMargin` doit être égal à `marginAmount` — c'est le contrôle de cohérence.

### Étape 5 — Affichage client (split psychologique)

Le prix total est fixé à l'étape 3. Cette étape décide uniquement **comment le ventiler** entre prix produit et frais de livraison affichés. Elle ne modifie ni le total, ni la marge.

```
displayedProductPrice  = round2(CP + (CL × 0.40) + marginAmount)
displayedShippingPrice = round2(totalPrice - displayedProductPrice)

displayedProductPrice + displayedShippingPrice = totalPrice  ✓
```

> `displayedShippingPrice` est calculé par soustraction (pas depuis CL directement) pour garantir que la somme affichée est toujours exactement égale au `totalPrice`, sans écart d'arrondi.

---

## 4. Ce qu'on expose

### Au niveau produit

```json
{
  "price": {
    "eur": <totalPrice>,
    "xof": <round(totalPrice × 700)>
  },
  "costPrice": {
    "eur": <CP>,
    "xof": <round(CP × 700)>
  },
  "logisticsCost": {
    "eur": <CL>,
    "xof": <round(CL × 700)>
  },
  "customsFee": {
    "eur": 0.5,
    "xof": 350
  },
  "realCost": {
    "eur": <realCost>,
    "xof": <round(realCost × 700)>
  }
}
```

> Le client ne voit pas `costPrice`, `logisticsCost`, `customsFee`, ni `realCost`. Ces champs sont internes / debug.

### Au niveau commande (panier)

```
totalCommande = subtotalProduits + fraisLivraisonAffiches + fraisServiceAffiches
```

- `subtotalProduits` = somme des `displayedProductPrice` de chaque article
- `fraisLivraisonAffiches` = somme des `displayedShippingPrice` de chaque article
- Le total final est identique au total calculé par la formule de pricing — le split ne crée pas d'écart

---

## 5. Exemples

### Exemple 1 — Produit Europe (robe, 200 g)

**Entrée :**

| Paramètre | Valeur |
|---|---|
| CP | 10.00 € |
| W | 200 g |
| Origine | EUROPE |

**Calcul :**

```
CL          = round2(0.2 × 15.24)    = 3.05 €
realCost    = round2(10 + 3.05 + 0.5) = 13.55 €
totalPrice  = round2(13.55 / 0.771)  = 17.57 €
margin      = round2(17.57 × 0.20)   = 3.51 €
paymentFee  = round2(17.57 × 0.029)  = 0.51 €
netMargin   = round2(17.57 - (10 + 3.05 + 0.5 + 0.51)) = 3.51 €  ✓
```

**Affichage client :**

```
displayedProductPrice  = round2(10 + (3.05 × 0.40) + 3.51) = 14.73 €
displayedShippingPrice = round2(17.57 - 14.73)              =  2.84 €
TOTAL                  = 14.73 + 2.84                       = 17.57 €  ✓
```

**Prix exposé :**

```json
{
  "price":        { "eur": 17.57, "xof": 12299 },
  "costPrice":    { "eur": 10.00, "xof": 7000  },
  "logisticsCost":{ "eur": 3.05,  "xof": 2135  },
  "customsFee":   { "eur": 0.50,  "xof": 350   },
  "realCost":     { "eur": 13.55, "xof": 9485  }
}
```

---

### Exemple 2 — Produit Chine (1 200 g)

**Entrée :**

| Paramètre | Valeur |
|---|---|
| CP | 18.50 € |
| W | 1 200 g |
| Origine | CHINA |

**Calcul :**

```
CL          = round2(1.2 × 13.72)       = 16.46 €
realCost    = round2(18.5 + 16.46 + 0.5) = 35.46 €
totalPrice  = round2(35.46 / 0.771)     = 45.99 €
margin      = round2(45.99 × 0.20)      = 9.20 €
paymentFee  = round2(45.99 × 0.029)     = 1.33 €
netMargin   = round2(45.99 - (18.5 + 16.46 + 0.5 + 1.33)) = 9.20 €  ✓
```

**Affichage client :**

```
displayedProductPrice  = round2(18.5 + (16.46 × 0.40) + 9.20) = 34.28 €
displayedShippingPrice = round2(45.99 - 34.28)                 = 11.71 €
TOTAL                  = 34.28 + 11.71                         = 45.99 €  ✓
```

**Prix exposé :**

```json
{
  "price":        { "eur": 45.99, "xof": 32193 },
  "costPrice":    { "eur": 18.50, "xof": 12950 },
  "logisticsCost":{ "eur": 16.46, "xof": 11522 },
  "customsFee":   { "eur": 0.50,  "xof": 350   },
  "realCost":     { "eur": 35.46, "xof": 24822 }
}
```

---

## 6. Gestion des articles < 5 € — Règle MOQ

Pour les articles dont le prix fournisseur est inférieur à **5 €**, le coût logistique (CL) dépasse souvent la valeur du produit. Ces articles ne peuvent pas être commandés à l'unité — un **MOQ (Minimum Order Quantity)** est appliqué automatiquement.

### Principe

Le MOQ est calculé pour que la charge logistique totale (CL + douanes) ramenée à l'unité reste inférieure à **60% du prix fournisseur** :

```
Si CP < 5 € :
  MOQ = min(ceil((CL + 0.50) / (CP × 0.60)), 5)
Sinon :
  MOQ = 1
```

- **Plafond fixé à 5 unités** — au-delà, l'article est écarté du catalogue.
- Le CL par unité **ne change pas** (chaque unité pèse pareil).
- Seules les **douanes (0.50 €)** sont mutualisées sur le nombre d'unités commandées.

### Impact sur le pricing

Avec un MOQ > 1, les douanes sont divisées par le nombre d'unités :

```
customsPerUnit = round2(0.50 / MOQ)
realCost       = round2(CP + CL + customsPerUnit)
totalPrice     = round2(realCost / 0.771)
```

Le reste du calcul (marge, frais paiement, split affichage) reste identique.

### Exemple — Article Europe, 200 g, CP = 2 €

```
CL    = round2(0.2 × 15.24) = 3.05 €
MOQ   = min(ceil((3.05 + 0.50) / (2 × 0.60)), 5)
      = min(ceil(3.55 / 1.20), 5)
      = min(ceil(2.96), 5)
      = 3 unités
```

| | MOQ = 1 (interdit) | MOQ = 3 (appliqué) |
|---|---|---|
| Douanes/unité | 0.50 € | 0.17 € |
| Coût réel/unité | 5.55 € | 5.22 € |
| Prix de vente/unité | 7.20 € | 6.77 € |
| Marge nette/unité | 1.44 € | 1.35 € |

> Le client achète 3 unités à 6.77 € — soit **20.31 € au total**. La marge reste garantie à 20%.

### Table de référence MOQ (Europe, 200 g)

| Prix fournisseur (CP) | CL | Calcul brut | MOQ final |
|---|---|---|---|
| 4.99 € | 3.05 € | ceil(3.55 / 2.99) = 1.19 | **2 unités** |
| 3.00 € | 3.05 € | ceil(3.55 / 1.80) = 1.97 | **2 unités** |
| 2.00 € | 3.05 € | ceil(3.55 / 1.20) = 2.96 | **3 unités** |
| 1.00 € | 3.05 € | ceil(3.55 / 0.60) = 5.92 → plafonné | **5 unités** |
| 0.50 € | 3.05 € | ceil(3.55 / 0.30) = 11.8 → plafonné | **5 unités** |

> Si le MOQ calculé dépasse 5, l'article **ne doit pas être référencé** dans le catalogue.

---

## 7. Règles de pricing

| # | Règle | Raison |
|---|---|---|
| 1 | La logistique est comptée **une seule fois** dans le calcul | Toute duplication fausse la marge réelle |
| 2 | Les frais paiement sont en **% (2.9%)**, jamais fixes | Les frais réels sont proportionnels au montant encaissé |
| 3 | Le split 40/60 est uniquement une **décision d'affichage** | Il ne modifie ni le total, ni la marge, ni aucun coût réel |
| 4 | Les articles < 5 € déclenchent un **MOQ automatique** | La logistique ne doit pas dépasser 60% du CP par unité |
| 5 | Si le MOQ calculé > 5, l'article est **écarté du catalogue** | Le prix de vente serait trop élevé par rapport à la valeur perçue |
| 6 | Afficher le **prix total dès la fiche produit** | Évite les abandons panier à l'affichage des frais de livraison |
| 7 | Tracer les marges par **origine séparément** | Europe et Chine ont des tarifs et délais différents |
| 8 | Valider les **douanes avec le partenaire logistique** | 0.50 € est une estimation — les droits varient selon la valeur déclarée |

---

## 8. Prochaines étapes

| # | Brique | Statut |
|---|---|---|
| 1 | Coûts opérationnels réels (hébergement, outils, temps) | À construire |
| 2 | Point mort mensuel (nombre de commandes minimum) | À calculer |
| 3 | Validation douanes avec partenaire logistique | En attente |
| 4 | Validation frais paiement Mobile Money exacts | En attente |
| 5 | Catalogue minimum viable (poids cible par catégorie) | À définir |
| 6 | Intégration MOQ dans le moteur de pricing (`pricing.service.js`) | À implémenter |

---

*GoDjeli — Document interne confidentiel — 2025*
