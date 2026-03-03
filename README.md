

# Godjeli Admin Core (Manual Product Engine)

## Pourquoi ce projet ?

**Godjeli** est une application e-commerce ambitieuse qui propose les meilleurs produits des marketplaces mondiales (Shein, AliExpress, etc.) avec une sélection curatée.

Le scraping automatisé à grande échelle étant instable par nature (blocages IP, changements de structure HTML), nous avons pivoté vers une approche **"Manual First, Tech Assisted"**. Ce projet est le moteur backend qui permet d'alimenter l'application client **Godjeli** de manière fiable, propre et rapide.

## Impact sur le produit final (Godjeli)

Ce micro-service est le cœur de notre chaîne d'approvisionnement de données. Son impact est direct :

1. **Qualité de la Data :** Contrairement aux bots, l'ajout manuel assisté garantit des titres et des catégories impeccables pour nos clients.
2. **Stabilité des Images :** En rapatriant les visuels sur notre propre stockage, nous évitons les liens morts (broken images) sur l'app Godjeli.
3. **Maitrise des Marges :** Le calcul automatique des prix assure la rentabilité de chaque produit listé sans erreur humaine.
4. **Time-to-Market :** Un produit repéré sur Shein peut être disponible sur Godjeli en moins de 30 secondes.

---

## 🛠 Stack Technique

* **Runtime :** Node.js
* **Framework :** Express.js
* **Scraping :** Puppeteer (Headless navigation)
* **Stockage Images :** Cloudinary API (Anti-hotlinking)
* **Base de Données :** MongoDB via Mongoose
* **Sécurité :** Authentification par Header Custom (`x-admin-pin`)

---

##  Structure du Projet

```text
/src
  /config          # Configuration (DB, Cloudinary, Env)
  /middlewares     # Protection PIN, Error Handling
  /services        # Logique Scraper & Image Processing
  /models          # Schémas Mongoose (Godjeli Product Schema)
  /controllers     # Logique des Endpoints Admin
  app.js           # Entry point

```

---

##  Variables d'Environnement (.env)

Le développeur doit configurer les éléments suivants :

* `PORT` : Port du serveur (ex: 3000)
* `ADMIN_ACCESS_PIN` : Le code secret pour autoriser l'ajout de produits.
* `MONGODB_URI` : Lien de connexion à la base Godjeli.
* `CLOUDINARY_URL` : Pour l'hébergement des assets.
* `MARGIN_MULTIPLIER` : Facteur de multiplication pour le prix de vente.

---

##  Workflow d'ajout d'un produit

1. **Fetch :** L'admin envoie une URL (Shein/Ali). Le backend utilise Puppeteer pour extraire `titre`, `prix_source` et `image_url`.
2. **Transform :** Le backend calcule le `prix_final` et génère un `slug`.
3. **Persist :** L'image est envoyée sur Cloudinary, et le document est créé dans MongoDB.
4. **Sync :** Le produit est instantanément disponible pour les utilisateurs de l'app Godjeli.

---

> **Note aux développeurs :** La simplicité est la priorité. Ce module doit être ultra-rapide et les erreurs de scraping doivent être gérées avec élégance pour ne pas bloquer l'utilisateur.
