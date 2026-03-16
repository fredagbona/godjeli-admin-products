# Godjeli Admin Core — API Integration Guide

Documentation complète pour l'équipe frontend.
Base URL locale : `http://localhost:3000`

---

## Table des matières

1. [Conventions générales](#1-conventions-générales)
2. [Authentification](#2-authentification)
3. [Structure des réponses](#3-structure-des-réponses)
4. [Codes d'erreur](#4-codes-derreur)
5. [Endpoints publics](#5-endpoints-publics)
6. [Endpoints admin](#6-endpoints-admin)
7. [Endpoints produits](#7-endpoints-produits)
8. [Modèle de données — Product](#8-modèle-de-données--product)
9. [Workflow complet d'ajout d'un produit](#9-workflow-complet-dajout-dun-produit)
10. [Exemples de code (fetch)](#10-exemples-de-code-fetch)

---

## 1. Conventions générales

| Propriété | Valeur |
|---|---|
| Format | JSON uniquement |
| Encodage | UTF-8 |
| Content-Type | `application/json` |
| Authentification | Header `x-admin-pin` |
| Source supportée | AliExpress uniquement |

Toutes les requêtes avec un body doivent inclure :
```
Content-Type: application/json
```

---

## 2. Authentification

Toutes les routes **sauf** `GET /health` requièrent le header suivant :

```
x-admin-pin: <votre_pin>
```

Le PIN est configuré côté serveur via la variable d'environnement `ADMIN_ACCESS_PIN`.
Ne jamais l'exposer dans le code source frontend — le stocker en session ou en mémoire après saisie.

**En cas d'échec :**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "PIN invalide ou manquant."
  }
}
```

---

## 3. Structure des réponses

**Toutes** les réponses de l'API respectent cette enveloppe unique. Le champ `success` permet de brancher immédiatement sur le bon cas.

### Succès

```json
{
  "success": true,
  "data": <payload>
}
```

`data` peut être :
- un **objet** (ex: produit unique, résultat de scraping)
- un **tableau** (ex: liste de produits)
- un **objet simple** (ex: `{ "verified": true }`)

### Erreur

```json
{
  "success": false,
  "error": {
    "code": "CODE_ERREUR",
    "message": "Description lisible",
    "details": [...]
  }
}
```

> `details` n'est présent que pour les erreurs de validation (`VALIDATION_ERROR`).
> Dans tous les autres cas, `message` suffit.

---

## 4. Codes d'erreur

| Code | HTTP | Situation |
|---|---|---|
| `UNAUTHORIZED` | 401 | PIN absent ou incorrect |
| `VALIDATION_ERROR` | 400 | Body invalide (champ manquant, type incorrect…) |
| `NOT_FOUND` | 404 | Ressource introuvable |
| `SCRAPE_ERROR` | 400 / 422 | URL non supportée ou page produit illisible |
| `INTERNAL_ERROR` | 500 | Erreur serveur inattendue |

### Exemple `VALIDATION_ERROR`

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "code": "invalid_type",
        "expected": "number",
        "received": "string",
        "path": ["sourcePrice"],
        "message": "Expected number, received string"
      }
    ]
  }
}
```

---

## 5. Endpoints publics

### `GET /health`

Vérifie que le serveur est opérationnel. Aucun header requis.

**Réponse `200` :**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

---

## 6. Endpoints admin

Tous requièrent `x-admin-pin`.

---

### `GET /api/admin/verify`

Valide que le PIN fourni est correct. À appeler au chargement du formulaire admin pour décider d'afficher ou non l'interface.

**Headers :**
```
x-admin-pin: 1234
```

**Réponse `200` :**
```json
{
  "success": true,
  "data": {
    "verified": true
  }
}
```

**Réponse `401` :**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "PIN invalide ou manquant."
  }
}
```

---

### `POST /api/admin/fetch-external-data`

**Cœur du workflow.** Envoie une URL AliExpress. Le serveur :
1. Lance un navigateur headless (Puppeteer + mode stealth)
2. Navigue sur la page (~4-8 secondes)
3. Extrait le titre, le prix et toutes les images depuis `window.runParams` (JSON injecté par AliExpress)
4. Uploade `mainImage` + `gallery[]` sur Cloudinary (WebP, max 800px)
5. Ferme le navigateur
6. Retourne des données prêtes à pré-remplir le formulaire

**Headers :**
```
x-admin-pin: 1234
Content-Type: application/json
```

**Body :**
```json
{
  "url": "https://fr.aliexpress.com/item/1005008515393439.html"
}
```

| Champ | Type | Requis | Description |
|---|---|---|---|
| `url` | string (URL) | Oui | URL complète d'une page produit AliExpress, **doit se terminer par `.html`** |

#### Format d'URL attendu

L'URL doit obligatoirement pointer vers une page produit AliExpress et se terminer par `.html`.

**Format :**
```
https://<locale>.aliexpress.com/item/<product_id>.html
```

**Exemples valides :**
```
https://fr.aliexpress.com/item/1005008515393439.html
https://www.aliexpress.com/item/1005010526960919.html
https://fr.aliexpress.com/item/4001270751647.html
```

**Exemples invalides (rejetés avec `SCRAPE_ERROR`) :**
```
https://fr.aliexpress.com/category/shoes       ← page catégorie, pas un produit
https://fr.aliexpress.com/item/123456789        ← manque le .html
https://www.amazon.fr/dp/B08XYZ                ← domaine non supporté
```

> **Astuce :** Sur AliExpress, l'URL de la page produit dans la barre d'adresse se termine toujours par `.html`. Si ce n'est pas le cas, attendre que la page finisse de charger ou copier le lien depuis "Partager ce produit".

**Réponse `200` :**
```json
{
  "success": true,
  "data": {
    "title": "Chaussettes blanches en coton pour hommes, 10 paires",
    "originalPrice": 6.939,
    "currency": "EUR",
    "mainImage": "https://res.cloudinary.com/godjeli/image/upload/v1/godjeli/products/abc123.webp",
    "gallery": [
      "https://res.cloudinary.com/godjeli/image/upload/v1/godjeli/products/def456.webp",
      "https://res.cloudinary.com/godjeli/image/upload/v1/godjeli/products/ghi789.webp"
    ],
    "sourceUrl": "https://fr.aliexpress.com/item/1005008515393439.html",
    "sourceSite": "aliexpress"
  }
}
```

> Toutes les URLs d'images retournées sont déjà hébergées sur Cloudinary. Ne jamais utiliser les URLs AliExpress directement dans l'app — elles sont éphémères.

**Erreur `400` — URL non supportée :**
```json
{
  "success": false,
  "error": {
    "code": "SCRAPE_ERROR",
    "message": "URL non supportée. Seul AliExpress est accepté."
  }
}
```

**Erreur `422` — Page illisible :**
```json
{
  "success": false,
  "error": {
    "code": "SCRAPE_ERROR",
    "message": "Impossible de lire ce produit. Il est peut-être protégé ou inexistant."
  }
}
```

---

### `POST /api/admin/products`

Crée un produit en base après validation et correction par l'admin. Le serveur calcule automatiquement le prix de vente et la conversion FCFA.

**Ne jamais envoyer de `price` dans ce body** — il est toujours calculé côté serveur.

**Headers :**
```
x-admin-pin: 1234
Content-Type: application/json
```

**Body :**
```json
{
  "title": "Chaussettes blanches en coton, 10 paires",
  "sourceUrl": "https://fr.aliexpress.com/item/1005008515393439.html",
  "sourceSite": "aliexpress",
  "sourcePrice": 6.939,
  "currency": "EUR",
  "hostedImageUrl": "https://res.cloudinary.com/godjeli/image/upload/...",
  "gallery": [
    "https://res.cloudinary.com/godjeli/image/upload/...2.webp",
    "https://res.cloudinary.com/godjeli/image/upload/...3.webp"
  ],
  "description": "Lot de 10 paires de chaussettes en coton, haute qualité.",
  "category": "Chaussettes",
  "sizes": "S, M, L, XL",
  "weightKg": 0.35
}
```

| Champ | Type | Requis | Description |
|---|---|---|---|
| `title` | string | Oui | Nom du produit (corrigé/validé par l'admin) |
| `sourceUrl` | string (URL) | Oui | URL d'origine AliExpress |
| `sourceSite` | `"aliexpress"` \| `"other"` | Oui | Marketplace source |
| `sourcePrice` | number > 0 | Oui | Prix d'achat en EUR (sert à calculer le prix de vente) |
| `currency` | string | Non | Devise (défaut : `"EUR"`) |
| `hostedImageUrl` | string | Non | URL Cloudinary de l'image principale (issue de `fetch-external-data`) |
| `remoteImageUrl` | string | Non | URL externe brute à uploader si pas encore sur Cloudinary |
| `gallery` | string[] | Non | URLs Cloudinary des images secondaires (issues de `fetch-external-data`) |
| `description` | string | Non | Description produit |
| `category` | string | Non | Catégorie (ex: `"Robes"`, `"Chaussures"`) |
| `sizes` | string | Non | Tailles séparées par virgule : `"S, M, L, XL"` |
| `weightKg` | number ≥ 0 | Non | Poids en kg (permet le calcul logistique) |

> Utiliser `hostedImageUrl` + `gallery` si les images viennent de `fetch-external-data`.
> Utiliser `remoteImageUrl` si l'admin a récupéré manuellement une URL brute (le serveur l'uploadera).

**Réponse `201` :**
```json
{
  "success": true,
  "data": {
    "_id": "6697a1f2b3c4d5e6f7a8b9c0",
    "title": "Chaussettes blanches en coton, 10 paires",
    "slug": "chaussettes-blanches-en-coton-10-paires",
    "price": 15.99,
    "priceFCFA": 11993,
    "sourcePrice": 6.939,
    "currency": "EUR",
    "mainImage": "https://res.cloudinary.com/godjeli/image/upload/...1.webp",
    "gallery": [
      "https://res.cloudinary.com/godjeli/image/upload/...2.webp",
      "https://res.cloudinary.com/godjeli/image/upload/...3.webp"
    ],
    "sourceUrl": "https://fr.aliexpress.com/item/1005008515393439.html",
    "sourceSite": "aliexpress",
    "category": "Chaussettes",
    "variants": ["S", "M", "L", "XL"],
    "description": "Lot de 10 paires de chaussettes en coton.",
    "weightKg": 0.35,
    "logisticsCostEur": 5.25,
    "logisticsCostFCFA": 3938,
    "isVisible": true,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

---

### `POST /api/admin/scrape`

Route alternative : parsing HTML côté serveur quand le frontend a déjà récupéré le HTML brut de la page AliExpress (ex: extension navigateur). Moins utilisée que `fetch-external-data` — pas d'upload Cloudinary automatique.

**Body :**
```json
{
  "url": "https://fr.aliexpress.com/item/1005008515393439.html",
  "html": "<html>...</html>"
}
```

| Champ | Type | Requis | Description |
|---|---|---|---|
| `url` | string (URL) | Oui | URL source AliExpress |
| `html` | string | Oui | HTML brut de la page produit |

**Réponse `200` :** même structure que `fetch-external-data` (sans upload Cloudinary).

---

## 7. Endpoints produits

Ces routes exposent le catalogue au frontend client (app Godjeli). Requièrent `x-admin-pin`.

---

### `GET /products`

Liste tous les produits visibles, triés du plus récent au plus ancien.

**Query params optionnels :**

| Param | Type | Description |
|---|---|---|
| `category` | string | Filtrer par catégorie (ex: `?category=Chaussettes`) |
| `search` | string | Recherche textuelle sur titre et catégorie (ex: `?search=coton`) |

**Réponse `200` :**
```json
{
  "success": true,
  "data": [
    {
      "_id": "6697a1f2b3c4d5e6f7a8b9c0",
      "title": "Chaussettes blanches en coton, 10 paires",
      "slug": "chaussettes-blanches-en-coton-10-paires",
      "price": 15.99,
      "priceFCFA": 11993,
      "mainImage": "https://res.cloudinary.com/godjeli/...",
      "category": "Chaussettes",
      "variants": ["S", "M", "L", "XL"],
      "isVisible": true,
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### `GET /products/:id`

Récupère un produit par son `_id` MongoDB ou son `slug`.

**Exemples :**
```
GET /products/6697a1f2b3c4d5e6f7a8b9c0
GET /products/chaussettes-blanches-en-coton-10-paires
```

**Réponse `200` :** objet produit complet (même structure que la création).

**Réponse `404` :**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Product not found"
  }
}
```

---

### `POST /products`

Création manuelle directe (sans pipeline de calcul automatique). Le `price` est fourni explicitement.

**Body :**
```json
{
  "title": "Sac à main tendance",
  "price": 34.99,
  "sourcePrice": 14.00,
  "sourceSite": "aliexpress",
  "sourceUrl": "https://fr.aliexpress.com/item/...",
  "category": "Sacs",
  "mainImage": "https://res.cloudinary.com/godjeli/...",
  "variants": ["Noir", "Beige"]
}
```

**Réponse `201` :** objet produit complet.

---

### `PATCH /products/:id`

Mise à jour partielle. Seuls les champs envoyés sont modifiés.

**Body (tous les champs sont optionnels) :**
```json
{
  "title": "Nouveau titre",
  "category": "Accessoires",
  "isVisible": false
}
```

**Réponse `200` :** objet produit mis à jour.

---

### `DELETE /products/:id`

Soft delete — le produit n'est pas supprimé en base mais `isVisible` passe à `false`. Il disparaît du catalogue sans perdre les données.

**Réponse `200` :**
```json
{
  "success": true,
  "data": {
    "id": "6697a1f2b3c4d5e6f7a8b9c0"
  }
}
```

---

## 8. Modèle de données — Product

Structure complète d'un document produit tel que retourné par l'API.

```ts
{
  _id:              string          // ID MongoDB
  title:            string          // Nom du produit
  slug:             string          // URL-friendly unique, auto-généré (ex: "chaussettes-coton-10-paires")

  // Prix EUR
  price:            number          // Prix de vente (calculé serveur-side)
  sourcePrice:      number          // Prix d'achat original (AliExpress)
  currency:         string          // "EUR" par défaut

  // Prix FCFA (1 EUR = 750 FCFA, taux fixe interne)
  priceFCFA:        number          // price × 750

  // Logistique (si weightKg fourni)
  weightKg:         number | null   // Poids en kg
  logisticsCostEur: number | null   // weightKg × 15 €
  logisticsCostFCFA:number | null   // logisticsCostEur × 750

  // Médias (toutes les URLs sont hébergées sur Cloudinary)
  mainImage:        string | null   // Image principale (WebP 800px)
  gallery:          string[]        // Images secondaires

  // Source
  sourceUrl:        string          // URL d'origine AliExpress
  sourceSite:       "aliexpress" | "other"

  // Catalogue
  category:         string | null   // Catégorie
  variants:         string[]        // Ex: ["S", "M", "L"] ou ["Rouge", "Bleu"]
  description:      string | null   // Description produit

  // Meta
  isVisible:        boolean         // false = soft deleted
  createdAt:        string (ISO 8601)
  updatedAt:        string (ISO 8601)
}
```

### Calcul du prix de vente

Le `price` n'est **jamais** envoyé par le frontend dans `POST /api/admin/products`. Il est toujours calculé par le serveur :

```
price = ceil((sourcePrice × MARGIN_MULTIPLIER) + FIXED_FEES) - 0.01
```

Avec les valeurs par défaut (`MARGIN_MULTIPLIER=2`, `FIXED_FEES=2`) :

| sourcePrice | price calculé | priceFCFA |
|---|---|---|
| 1.07 € | 4.99 € | 3 743 FCFA |
| 5.00 € | 11.99 € | 8 993 FCFA |
| 6.94 € | 15.99 € | 11 993 FCFA |
| 12.50 € | 26.99 € | 20 243 FCFA |
| 20.00 € | 41.99 € | 31 493 FCFA |

### Calcul logistique

```
logisticsCostEur  = weightKg × 15
logisticsCostFCFA = logisticsCostEur × 750
```

Exemple pour 0.35 kg :
- `logisticsCostEur` = 5.25 €
- `logisticsCostFCFA` = 3 938 FCFA

---

## 9. Workflow complet d'ajout d'un produit

```
┌─────────────────────────────────────────────────────────────────┐
│  1. L'admin ouvre le formulaire                                 │
│     → GET /api/admin/verify                                     │
│        Si 200 → afficher le formulaire                          │
│        Si 401 → afficher l'écran de saisie PIN                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. L'admin colle une URL AliExpress                            │
│     → POST /api/admin/fetch-external-data  { url }              │
│        Puppeteer charge la page (~4-8s)                         │
│        Extrait titre, prix, images depuis window.runParams      │
│        Upload mainImage + gallery[] sur Cloudinary              │
│        Reçoit : title, originalPrice, mainImage, gallery[]      │
│        → Pré-remplir les champs du formulaire                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. L'admin corrige / complète                                  │
│     - Vérifie le titre                                          │
│     - Saisit la catégorie, les tailles, le poids, description   │
│     - Le prix de vente est calculé et affiché en preview        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. L'admin soumet le formulaire                                │
│     → POST /api/admin/products  { title, sourcePrice,          │
│                                   hostedImageUrl, gallery, ... }│
│        Calcule price = ceil(sourcePrice×2 + 2) - 0.01          │
│        Calcule priceFCFA = price × 750                          │
│        Calcule logisticsCost si weightKg fourni                 │
│        Génère le slug depuis le titre                           │
│        Sauvegarde dans MongoDB Atlas                            │
│     ← 201 { produit complet }                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  5. Produit disponible sur l'app Godjeli                        │
│     → GET /products                                             │
│     → GET /products/:slug                                       │
│     → GET /products?category=Chaussettes                        │
│     → GET /products?search=coton                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Exemples de code (fetch)

### Helper de base

```js
const API_URL = 'http://localhost:3000';
const PIN = sessionStorage.getItem('adminPin'); // stocker après saisie

async function api(method, path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pin': PIN,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();

  if (!json.success) {
    throw Object.assign(new Error(json.error.message), {
      code: json.error.code,
      details: json.error.details,
    });
  }

  return json.data;
}
```

### Vérifier le PIN

```js
async function verifyPin(pin) {
  const res = await fetch(`${API_URL}/api/admin/verify`, {
    headers: { 'x-admin-pin': pin },
  });
  const json = await res.json();
  return json.success; // true ou false
}
```

### Scraper une URL AliExpress

```js
async function fetchProductData(url) {
  try {
    const data = await api('POST', '/api/admin/fetch-external-data', { url });
    // data.title         → titre du produit
    // data.originalPrice → prix d'achat en EUR
    // data.mainImage     → URL Cloudinary image principale
    // data.gallery       → tableau d'URLs Cloudinary images secondaires
    return data;
  } catch (err) {
    if (err.code === 'SCRAPE_ERROR') {
      alert('Ce produit ne peut pas être lu : ' + err.message);
    }
    throw err;
  }
}
```

### Créer un produit (pipeline complet)

```js
async function createProduct(formData, scrapedData) {
  const product = await api('POST', '/api/admin/products', {
    title:          formData.title,
    sourceUrl:      scrapedData.sourceUrl,
    sourceSite:     'aliexpress',
    sourcePrice:    parseFloat(scrapedData.originalPrice),
    hostedImageUrl: scrapedData.mainImage,   // URL Cloudinary issue du scraping
    gallery:        scrapedData.gallery,     // tableau Cloudinary issue du scraping
    category:       formData.category,
    sizes:          formData.sizes,          // "S, M, L, XL"
    weightKg:       parseFloat(formData.weight) || undefined,
    description:    formData.description,
  });

  // product.price      → prix de vente EUR (calculé serveur-side)
  // product.priceFCFA  → prix en FCFA
  // product.slug       → utilisable comme URL dans l'app Godjeli
  // product.gallery    → images secondaires hébergées sur Cloudinary
  return product;
}
```

### Lister les produits

```js
// Tous les produits
const products = await api('GET', '/products');

// Filtrer par catégorie
const chaussettes = await api('GET', '/products?category=Chaussettes');

// Recherche texte
const results = await api('GET', '/products?search=coton');
```

### Récupérer un produit par slug

```js
const product = await api('GET', '/products/chaussettes-blanches-en-coton-10-paires');
```

### Supprimer un produit (soft delete)

```js
async function deleteProduct(id) {
  const result = await api('DELETE', `/products/${id}`);
  console.log('Produit désactivé :', result.id);
}
```

---

> **Note :** Toutes les images retournées par l'API sont hébergées sur Cloudinary en WebP optimisé (max 800px). Ne jamais stocker ou afficher les URLs AliExpress directement dans l'app — elles sont éphémères et peuvent casser à tout moment.
