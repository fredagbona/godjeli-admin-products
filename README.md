# Godjeli Admin Core

Backend d'administration du catalogue GoDjeli.

Le service gere un catalogue 100% manuel:
- categories
- produits
- upload d'images vers Cloudinary
- calcul automatique du pricing cote backend

## Stack

- Node.js
- Express
- MongoDB / Mongoose
- Cloudinary
- Zod
- Multer

## Variables d'environnement

- `PORT`
- `ADMIN_ACCESS_PIN`
- `MONGODB_URI`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

## Scripts

- `npm run dev`
- `npm start`
- `npm run seed`
- `npm test`

## Flux admin

1. L'admin uploade une ou plusieurs images via `POST /api/admin/uploads/images`
2. Le backend retourne les URLs Cloudinary
3. L'admin cree ou modifie categories et produits via les endpoints admin
4. Le backend recalcule toujours le pricing produit a partir de `costPriceEur`, `weightGrams` et `origin`

## Pricing

Le backend persiste:
- le prix total client
- le split d'affichage produit / livraison
- l'ajustement de reconciliation si le split theorique ne retombe pas exactement sur le total
- les couts internes de rentabilite

Le detail de la formule est documente dans `API.md`.
