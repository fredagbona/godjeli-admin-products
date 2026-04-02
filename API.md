# Godjeli Admin Core — API Integration Guide

Base URL locale: `http://localhost:3000`

## Conventions

- `GET /health` est public
- toutes les autres routes documentees ici demandent `x-admin-pin`
- reponses:

```json
{ "success": true, "data": {} }
```

```json
{ "success": false, "error": { "code": "CODE", "message": "..." } }
```

## Verification admin

### `GET /api/admin/verify`

Retour:

```json
{
  "success": true,
  "data": { "verified": true }
}
```

## Upload images

### `POST /api/admin/uploads/images`

- `Content-Type: multipart/form-data`
- champ: `images`
- accepte jusqu'a 10 images

Retour:

```json
{
  "success": true,
  "data": [
    {
      "url": "https://res.cloudinary.com/...",
      "publicId": "godjeli/admin/123-my-file",
      "width": 1200,
      "height": 1200,
      "format": "webp"
    }
  ]
}
```

## Categories

### `GET /api/admin/categories`

Query:
- `search`
- `isActive=true|false`

### `POST /api/admin/categories`

```json
{
  "name": "Robes",
  "description": "Selection femme",
  "image": "https://res.cloudinary.com/...",
  "isActive": true
}
```

### `PATCH /api/admin/categories/:id`

Meme body que create, tous les champs optionnels.

### `DELETE /api/admin/categories/:id`

Suppression logique: la categorie est desactivee puis marquee supprimee.

## Produits

### `GET /api/admin/products`

Query:
- `search`
- `categoryId`
- `isActive=true|false`

### `GET /api/admin/products/:id`

Accepte un ObjectId Mongo ou un slug produit.

### `POST /api/admin/products`

```json
{
  "name": "Robe ete fleurie",
  "description": "Robe legere a imprime floral",
  "categoryId": "6612f3c9e6a5d8e44bb9a001",
  "images": [
    "https://res.cloudinary.com/..."
  ],
  "costPriceEur": 10,
  "weightGrams": 200,
  "origin": "EUROPE",
  "isActive": true
}
```

### `PATCH /api/admin/products/:id`

Meme structure que create, tous les champs optionnels.
Le backend recalcule toujours `pricing` a partir des valeurs finales.

### `DELETE /api/admin/products/:id`

Suppression logique: le produit est desactive puis marque supprime.

## Structure produit

Exemple de retour:

```json
{
  "_id": "6612f3c9e6a5d8e44bb9a099",
  "name": "Robe ete fleurie",
  "slug": "robe-ete-fleurie",
  "description": "Robe legere a imprime floral",
  "images": ["https://res.cloudinary.com/..."],
  "categoryId": {
    "_id": "6612f3c9e6a5d8e44bb9a001",
    "name": "Robes",
    "slug": "robes"
  },
  "pricing": {
    "costPriceEur": 10,
    "weightGrams": 200,
    "origin": "EUROPE",
    "ratePerKgEur": 15.24,
    "logisticsCostEur": 3.05,
    "customsFeeEur": 0.5,
    "paymentFeeEur": 0.51,
    "marginAmountEur": 3.51,
    "netMarginEur": 3.51,
    "displayProductPriceEur": 14.73,
    "displayShippingAndCustomsBaseEur": 2.33,
    "displayAdjustmentEur": 0.51,
    "displayShippingAndCustomsEur": 2.84,
    "totalPriceEur": 17.57,
    "totalRealCostEur": 14.06
  },
  "isActive": true
}
```

## Pricing

Constantes:
- Europe -> Benin: `15.24 EUR/kg`
- Chine -> Benin: `13.72 EUR/kg`
- douanes: `0.50 EUR`
- marge cible: `20%`
- frais de paiement: `2.9%`
- split d'affichage logistique: `40 / 60`

Formules:
- `logisticsCost = (weightGrams / 1000) * ratePerKg`
- `realCost = costPriceEur + logisticsCost + customsFee`
- `totalPrice = realCost / 0.771`
- `marginAmount = totalPrice * 0.20`
- `paymentFee = totalPrice * 0.029`
- `displayProductPrice = costPriceEur + (logisticsCost * 0.40) + marginAmount`
- `displayShippingAndCustomsBase = (logisticsCost * 0.60) + customsFee`
- `displayAdjustment = totalPrice - displayProductPrice - displayShippingAndCustomsBase`
- `displayShippingAndCustoms = displayShippingAndCustomsBase + displayAdjustment`

Regles:
- tous les montants sont arrondis a 2 decimales
- `costPriceEur` doit etre `>= 5`
- le split 40/60 reste la base d'affichage, puis le backend applique `displayAdjustmentEur` pour reconciler exactement le total panier
- le backend garantit que `displayProductPriceEur + displayShippingAndCustomsEur = totalPriceEur`
