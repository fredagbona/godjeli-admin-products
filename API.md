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

## Fournisseurs (Suppliers)

### `GET /api/admin/suppliers`

Query:
- `search`
- `type` — `DIRECT`, `MARKETPLACE`, `GROSSISTE`, `RETAIL`, `AGENT`
- `country`
- `isActive=true|false`

Retour:

```json
{
  "success": true,
  "data": [
    {
      "_id": "69d2956cefa817804bb8b838",
      "name": "Fashion Wholesale Paris",
      "slug": "fashion-wholesale-paris",
      "type": "GROSSISTE",
      "country": "France",
      "deliveryDelay": "5-7 jours",
      "rating": 4,
      "isActive": true,
      "deletedAt": null,
      "createdAt": "2026-04-05T17:01:32.558Z",
      "updatedAt": "2026-04-05T17:01:32.558Z",
      "__v": 0
    }
  ]
}
```

### `POST /api/admin/suppliers`

```json
{
  "name": "Fashion Wholesale Paris",
  "type": "GROSSISTE",
  "country": "France",
  "deliveryDelay": "5-7 jours",
  "rating": 4
}
```

**Notes:**
- `type` doit etre `"DIRECT"`, `"MARKETPLACE"`, `"GROSSISTE"`, `"RETAIL"` ou `"AGENT"` (majuscules)
- `rating` est un entier de 1 a 5 (optionnel)
- `deliveryDelay` est un string libre (ex: `"5-7 jours"`, `"2-3 semaines"`)

### `PATCH /api/admin/suppliers/:id`

Meme body que create, tous les champs optionnels.

### `DELETE /api/admin/suppliers/:id`

Suppression logique: `isActive` passe a `false` et `deletedAt` est defini.

## Produits

### `GET /api/admin/products`

Query:
- `search`
- `categoryId`
- `isActive=true|false`

Retour: liste de produits avec `categoryId` et `supplierId` peuples (objets complets).

### `GET /api/admin/products/:id`

Accepte un ObjectId Mongo ou un slug produit.

Retour: produit unique avec `categoryId` et `supplierId` peuples, `price` (alias de `totalPriceEur`).

### `POST /api/admin/products`

```json
{
  "name": "Robe ete fleurie",
  "description": "Robe legere a imprime floral",
  "categoryId": "6612f3c9e6a5d8e44bb9a001",
  "supplierId": "69d2956cefa817804bb8b838",
  "images": [
    "https://res.cloudinary.com/..."
  ],
  "productStock": 50,
  "productUrl": "https://fournisseur.com/product/123",
  "socialProof": {
    "stars": 4.5,
    "reviews": 120,
    "salesCount": 450
  },
  "variants": {
    "size": ["S", "M", "L", "XL"],
    "color": ["Rouge", "Bleu", "Blanc"]
  },
  "costPriceEur": 10,
  "weightGrams": 200,
  "origin": "EUROPE",
  "isActive": true
}
```

**Notes:**
- `supplierId` doit pointer vers un fournisseur existant et actif
- `productStock` est un entier >= 0 (stock actuel chez le fournisseur)
- `productUrl` est l'URL du produit chez le fournisseur
- `socialProof` est optionnel (default: `{ stars: 0, reviews: 0, salesCount: 0 }`)
- `variants` est optionnel (default: `{ size: [], color: [] }`)
- `origin` doit etre `"EUROPE"` ou `"CHINA"` (majuscules obligatoires)
- `costPriceEur` doit etre `>= 5`
- `images` doit contenir au moins 1 URL
- `categoryId` doit pointer vers une categorie existante et active
- le backend calcule automatiquement tout l'objet `pricing`

### `PATCH /api/admin/products/:id`

Meme structure que create, tous les champs optionnels.
Le backend recalcule toujours `pricing` a partir des valeurs finales.
Si `supplierId` est change, le nouveau fournisseur est valide.

### `DELETE /api/admin/products/:id`

Suppression logique: `isActive` passe a `false` et `deletedAt` est defini.

## Structure produit

Exemple de retour:

```json
{
  "_id": "69d29589efa817804bb8b840",
  "name": "Robe Ete Fleurie",
  "slug": "robe-ete-fleurie",
  "description": "Robe legere a imprime floral",
  "images": ["https://example.com/image.jpg"],
  "categoryId": {
    "_id": "69d2529b7d4e0e1136ef9595",
    "name": "Test Category",
    "slug": "test-category",
    "description": "A test category for API testing",
    "image": null,
    "isActive": true,
    "deletedAt": null,
    "createdAt": "...",
    "updatedAt": "...",
    "__v": 0
  },
  "supplierId": {
    "_id": "69d2956cefa817804bb8b838",
    "name": "Fashion Wholesale Paris",
    "slug": "fashion-wholesale-paris",
    "type": "GROSSISTE",
    "country": "France",
    "deliveryDelay": "5-7 jours",
    "rating": 4,
    "isActive": true,
    "deletedAt": null,
    "createdAt": "...",
    "updatedAt": "...",
    "__v": 0
  },
  "productStock": 50,
  "productUrl": "https://example.com/product/robe-ete",
  "socialProof": {
    "stars": 4.5,
    "reviews": 120,
    "salesCount": 450
  },
  "variants": {
    "size": ["S", "M", "L"],
    "color": ["Rouge", "Bleu"]
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
  "createdAt": "2026-04-05T17:02:01.193Z",
  "updatedAt": "2026-04-05T17:02:01.193Z",
  "slug": "robe-ete-fleurie",
  "__v": 0,
  "price": 17.57,
  "id": "69d29589efa817804bb8b840"
}
```

**Champs notables:**
- `price` — alias virtuel de `totalPriceEur` (prix total affiche au client)
- `id` — alias de `_id` (string)
- `categoryId` — objet categorie complet peuple automatiquement
- `supplierId` — objet fournisseur complet peuple automatiquement
- `productStock` — stock actuel chez le fournisseur
- `productUrl` — URL du produit chez le fournisseur
- `socialProof` — `{ stars, reviews, salesCount }`
- `variants` — `{ size[], color[] }`

## Migration

Synchronise les donnees du catalogue (categories, fournisseurs, produits, variantes) depuis MongoDB vers la base PostgreSQL du client backend.

### `POST /api/admin/migration/sync`

La migration est **idempotente** : un document deja migre n'est pas re-insere sauf si son `updatedAt` est plus recent que son `migratedAt`.

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `dryRun` | `true\|false` | Si `true`, retourne le compteur de ce qui serait migre sans ecrire en PostgreSQL |

### Dry run (preview)

```
POST /api/admin/migration/sync?dryRun=true
```

Retour:

```json
{
  "success": true,
  "data": {
    "dryRun": true,
    "categories": { "total": 6, "pending": 0, "synced": 6 },
    "suppliers": { "total": 2, "pending": 0, "synced": 2 },
    "products": { "total": 50, "pending": 0, "synced": 50, "skippedMissingRefs": 0 },
    "totalVariants": 0
  }
}
```

### Sync reelle

```
POST /api/admin/migration/sync
```

Retour:

```json
{
  "success": true,
  "data": {
    "dryRun": false,
    "categories": { "total": 6, "upserted": 2, "synced": 6 },
    "suppliers": { "total": 2, "upserted": 1, "synced": 2 },
    "products": { "total": 50, "upserted": 50, "synced": 50, "skippedMissingRefs": 0 },
    "variants": { "upserted": 608 }
  }
}
```

**Champs du retour:**

| Champ | Description |
|-------|-------------|
| `total` | Nombre total de documents dans MongoDB (non supprimes) |
| `pending` | En attente de migration (dry run uniquement) |
| `upserted` | Nombre de documents insere/mis a jour dans ce run (sync uniquement) |
| `synced` | Nombre de documents deja a jour dans PostgreSQL |
| `skippedMissingRefs` | Produits sans `supplierId` ou `categoryId` — non migrables (produits anciens) |
| `totalVariants` | Nombre de variantes associees aux produits pending (dry run) ou inserees (sync) |

**Notes:**
- Necessite `DATABASE_URL` configure dans l'environnement
- Toute la synchronisation s'execute dans une transaction PostgreSQL (rollback en cas d'erreur)
- Les categories et fournisseurs dont le produit depend sont migres automatiquement si necessaire
- Les variantes existantes du produit sont supprimees puis re-inserees pour garantir la coherence
- Le champ `migratedAt` est defini sur chaque document MongoDB apres succes
- Retourne `DB_UNAVAILABLE` (503) si PostgreSQL n'est pas joignable

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
