# Godjeli Admin Core — API Integration Guide

Base URL: `http://localhost:3000`

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

## Health

### `GET /health`

Retour:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-04-05T12:14:53.190Z",
    "checks": { "mongodb": "ok" }
  }
}
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

Retour:

```json
{
  "success": true,
  "data": [
    {
      "_id": "69d2529b7d4e0e1136ef9595",
      "name": "Test Category",
      "slug": "test-category",
      "description": "A test category for API testing",
      "image": null,
      "isActive": true,
      "deletedAt": null,
      "createdAt": "2026-04-05T12:16:27.297Z",
      "updatedAt": "2026-04-05T12:16:27.297Z",
      "__v": 0
    }
  ]
}
```

### `POST /api/admin/categories`

```json
{
  "name": "Robes",
  "description": "Selection femme",
  "image": "https://res.cloudinary.com/...",
  "isActive": true
}
```

Retour:

```json
{
  "success": true,
  "data": {
    "_id": "69d2529b7d4e0e1136ef9595",
    "name": "Robes",
    "slug": "robes",
    "description": "Selection femme",
    "image": null,
    "isActive": true,
    "deletedAt": null,
    "createdAt": "2026-04-05T12:16:27.297Z",
    "updatedAt": "2026-04-05T12:16:27.297Z",
    "__v": 0
  }
}
```

### `PATCH /api/admin/categories/:id`

Meme body que create, tous les champs optionnels.

### `DELETE /api/admin/categories/:id`

Suppression logique: `isActive` passe a `false` et `deletedAt` est defini.

## Produits

### `GET /api/admin/products`

Query:
- `search`
- `categoryId`
- `isActive=true|false`

Retour: liste de produits avec `categoryId` peuple (objet categorie complet).

### `GET /api/admin/products/:id`

Accepte un ObjectId Mongo ou un slug produit.

Retour: produit unique avec `categoryId` peuple et `price` (alias de `totalPriceEur`).

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

**Notes:**
- `origin` doit etre `"EUROPE"` ou `"CHINA"` (majuscules obligatoires)
- `costPriceEur` doit etre `>= 5`
- `images` doit contenir au moins 1 URL
- `categoryId` doit pointer vers une categorie existante et active
- le backend calcule automatiquement tout l'objet `pricing`

### `PATCH /api/admin/products/:id`

Meme structure que create, tous les champs optionnels.
Le backend recalcule toujours `pricing` a partir des valeurs finales.

### `DELETE /api/admin/products/:id`

Suppression logique: `isActive` passe a `false` et `deletedAt` est defini.

## Structure produit

Exemple de retour:

```json
{
  "_id": "69d252c97d4e0e1136ef959c",
  "name": "Robe ete fleurie",
  "slug": "robe-ete-fleurie",
  "description": "Robe legere a imprime floral",
  "images": ["https://res.cloudinary.com/..."],
  "categoryId": {
    "_id": "6612f3c9e6a5d8e44bb9a001",
    "name": "Robes",
    "slug": "robes",
    "description": "Selection femme",
    "image": null,
    "isActive": true,
    "deletedAt": null,
    "createdAt": "...",
    "updatedAt": "...",
    "__v": 0
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
  "isActive": true,
  "deletedAt": null,
  "createdAt": "2026-04-05T12:17:13.171Z",
  "updatedAt": "2026-04-05T12:17:13.171Z",
  "slug": "robe-ete-fleurie",
  "__v": 0,
  "price": 17.57,
  "id": "69d252c97d4e0e1136ef959c"
}
```

**Champs notables:**
- `price` — alias virtuel de `totalPriceEur` (prix total affiché au client)
- `id` — alias de `_id` (string)
- `categoryId` — objet categorie complet peuple automatiquement

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
