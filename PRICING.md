# Godjeli Pricing Model

Ce document explique uniquement la logique de pricing.


## 1. Source de verite

Le prix public d'un produit est calcule cote backend a partir de:

- `costPriceEur` : prix fournisseur
- `weightGrams` : poids du produit
- `origin` : origine logistique du produit
- la politique de pricing active

La logique actuelle vit dans `src/services/pricing.service.js`.

## 2. Constantes utilisees

Les valeurs fixes actuelles sont:

- `EUROPE_RATE_EUR_PER_KG = 15.24`
- `CHINA_RATE_EUR_PER_KG = 13.72`
- `CUSTOMS_FEE_EUR = 0.5`
- `TARGET_MARGIN_RATE = 0.2`
- `PAYMENT_FEE_RATE = 0.029`

La conversion d'affichage utilise:

- `EUR_TO_XOF = 700`

## 3. Cout reel

Le moteur calcule d'abord le cout reel d'approvisionnement:

```text
logisticsCostEur = round2((weightGrams / 1000) * ratePerKg)
customsFeeEur = 0.5
realCostEur = round2(costPriceEur + logisticsCostEur + customsFeeEur)
```

Interpretation:

- `costPriceEur` = prix facture par le fournisseur
- `logisticsCostEur` = cout logistique estime selon le poids et l'origine
- `customsFeeEur` = frais de douane fixes
- `realCostEur` = cout total de revient avant marge et frais de paiement

## 4. Prix public

Le prix de vente public du produit est ensuite calcule a partir du cout reel:

```text
PRICE_DENOMINATOR = 1 - TARGET_MARGIN_RATE - PAYMENT_FEE_RATE
totalPriceEur = round2(realCostEur / PRICE_DENOMINATOR)
marginAmountEur = round2(totalPriceEur * TARGET_MARGIN_RATE)
paymentFeeEur = round2(totalPriceEur * PAYMENT_FEE_RATE)
totalRealCostEur = round2(costPriceEur + logisticsCostEur + customsFeeEur + paymentFeeEur)
netMarginEur = round2(totalPriceEur - totalRealCostEur)
```

Lecture simple:

- on part du cout reel
- on ajoute la marge cible
- on reserve aussi la part estimee de frais de paiement
- le resultat devient le prix public du produit

## 5. Differents prix exposes

Le systeme distingue plusieurs prix:

### Prix fournisseur

- `costPriceEur`
- c'est le prix d'achat de base
- il reste interne

### Cout logistique

- `logisticsCostEur`
- il depend du poids et de l'origine
- il reste une composante interne du calcul

### Frais de douane

- `customsFeeEur`
- frais fixes
- ils restent une composante interne du calcul

### Cout reel

- `realCostEur`
- c'est le cout total avant marge et frais de paiement

### Prix public

- `totalPriceEur`
- c'est le prix de vente affichable au client
- c'est la valeur de reference du produit

### Conversion locale

Pour l'affichage local:

```text
priceXof = round(totalPriceEur * 700)
```

Le prix public expose est donc:

```json
{ "eur": 23.5, "xof": 16450 }
```

## 6. Ce qu'on renvoie comme prix produit

Le prix visible dans le catalogue est le prix public, pas le prix fournisseur.

On renvoie donc:

- `price` base sur `totalPriceEur`
- `costPrice` pour reference interne ou debug
- `logisticsCost`
- `customsFee`
- `realCost`

Le client ne doit pas raisonner sur `costPriceEur`.

## 7. Rôle des frais de livraison et de service

Etat actuel:

- les frais de livraison et de service existent au niveau commande
- ils ne sont pas encore integres au prix unitaire produit
- ils peuvent etre ajoutés ensuite au total de commande

Principe cible:

```text
totalCommande = subtotalProduits + fraisLivraison + fraisService
```

Dans ce modele:

- le prix du produit reste son prix public
- les frais de livraison et de service sont des couches additionnelles au niveau commande

## 8. Exemples exacts

### Exemple 1: produit europeen

Entree:

- `costPriceEur = 10`
- `weightGrams = 500`
- `origin = EUROPE`

Calcul:

```text
ratePerKg = 15.24
logisticsCostEur = round2(0.5 * 15.24) = 7.62
customsFeeEur = 0.5
realCostEur = round2(10 + 7.62 + 0.5) = 18.12
PRICE_DENOMINATOR = 1 - 0.2 - 0.029 = 0.771
totalPriceEur = round2(18.12 / 0.771) = 23.50
marginAmountEur = round2(23.50 * 0.2) = 4.70
paymentFeeEur = round2(23.50 * 0.029) = 0.68
netMarginEur = round2(23.50 - (10 + 7.62 + 0.5 + 0.68)) = 4.70
```

Prix expose:

```json
{
  "price": { "eur": 23.5, "xof": 16450 },
  "costPrice": { "eur": 10, "xof": 7000 },
  "logisticsCost": { "eur": 7.62, "xof": 5334 },
  "customsFee": { "eur": 0.5, "xof": 350 },
  "realCost": { "eur": 18.12, "xof": 12684 }
}
```

### Exemple 2: produit chine

Entree:

- `costPriceEur = 18.5`
- `weightGrams = 1200`
- `origin = CHINA`

Calcul:

```text
ratePerKg = 13.72
logisticsCostEur = round2(1.2 * 13.72) = 16.46
customsFeeEur = 0.5
realCostEur = round2(18.5 + 16.46 + 0.5) = 35.46
PRICE_DENOMINATOR = 0.771
totalPriceEur = round2(35.46 / 0.771) = 45.99
marginAmountEur = round2(45.99 * 0.2) = 9.20
paymentFeeEur = round2(45.99 * 0.029) = 1.33
netMarginEur = round2(45.99 - (18.5 + 16.46 + 0.5 + 1.33)) = 9.20
```

Prix expose:

```json
{
  "price": { "eur": 45.99, "xof": 32193 },
  "costPrice": { "eur": 18.5, "xof": 12950 },
  "logisticsCost": { "eur": 16.46, "xof": 11522 },
  "customsFee": { "eur": 0.5, "xof": 350 },
  "realCost": { "eur": 35.46, "xof": 24822 }
}
```

## 9. Resume operationnel

- le produit a un prix fournisseur interne
- le poids et l'origine ajoutent le cout logistique
- la douane ajoute un cout fixe
- la marge et les frais de paiement determinent le prix public
- le catalogue expose le prix public, pas le cout interne
- les frais de livraison et de service sont au niveau commande

