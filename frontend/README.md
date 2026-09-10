# 🌍 MboaTrip — Frontend (React + Google Maps)

Interface React/TypeScript/Vite/Tailwind avec carte interactive Google Maps + Places pour explorer le Cameroun (toutes les régions, avec un accent Centre/Ouest : Yaoundé, Douala, Bafoussam, Bandjoun).

---

## 🎨 Identité visuelle

Palette inspirée du tissu **Ndop** (indigo traditionnel Bamiléké) et du **bronze/laiton** des régalia royales Bamoun — pas un thème générique. Fond indigo profond, accents dorés, carte Google Maps re-stylée pour matcher.

---

## 🚀 Installation

```bash
npm install
cp .env.example .env
```

Édite `.env` :
```
VITE_API_URL=http://localhost:8000
VITE_GOOGLE_MAPS_API_KEY=ta_clé_ici
```

`VITE_API_URL` = l'URL de ton **Gateway** (Phase 2 microservices sur le port 8000, ou adapte si tu utilises le monolithe Phase 1).

```bash
npm run dev
```
Ouvre `http://localhost:5173`

---

## 🔑 Obtenir une clé Google Maps + Places (gratuit)

1. Va sur **https://console.cloud.google.com/**
2. Crée un nouveau projet (ou utilise un existant)
3. Dans le menu, va sur **"APIs & Services" → "Library"**
4. Active ces 2 API :
   - **Maps JavaScript API**
   - **Places API**
5. Va sur **"APIs & Services" → "Credentials"** → **"Create Credentials" → "API Key"**
6. Copie la clé générée dans ton `.env`

### Facturation
Google exige une carte bancaire liée au projet (même pour l'usage gratuit), mais offre **200$ de crédit gratuit par mois**, largement suffisant pour un usage étudiant/démo (des dizaines de milliers de chargements de carte). Tu ne seras pas facturé tant que tu restes sous ce quota.

### Sécuriser ta clé (important avant de push sur GitHub)
Dans "Credentials", clique sur ta clé → **"Application restrictions"** → **"HTTP referrers"** → ajoute `http://localhost:5173/*` (et l'URL de ton déploiement final). Ça empêche n'importe qui de voler ta clé et de l'utiliser ailleurs.

⚠️ **Ne commit jamais ton `.env` sur GitHub** (déjà exclu par `.gitignore`). Vérifie toujours avant de push.

---

## 🗺️ Comment fonctionne la carte

- **Sélection d'une destination** (liste latérale ou marqueur doré sur la carte) → la carte centre dessus
- **Boutons dans l'InfoWindow** : "Sites touristiques", "Hôtels", "Restaurants" → déclenchent une recherche **Google Places Nearby Search en temps réel** (rayon 5km autour de la destination), donc toujours à jour, pas une liste figée
- **Barre de recherche en haut** : Autocomplete Google Places, restreint au Cameroun (`componentRestrictions: { country: 'cm' }`), pour trouver n'importe quel lieu précis (quartier, hôtel, monument) et y centrer la carte
- **Filtre par région** : Centre et Ouest sont mis en avant en premier dans la liste (marqués ★), conformément à la consigne

## 📁 Structure

```
src/
├── main.tsx / App.tsx        # Point d'entrée, routing
├── lib/
│   ├── api.ts                 # Client HTTP vers le Gateway
│   ├── auth.tsx                # Contexte d'authentification (JWT)
│   └── mapStyle.ts             # Style Google Maps custom (thème indigo)
├── types/index.ts              # Types partagés (User, Destination, Itinerary)
├── components/
│   ├── Navbar.tsx
│   ├── RegionFilter.tsx        # Filtre régions, Centre/Ouest en avant
│   └── ProtectedRoute.tsx
└── pages/
    ├── ExploreMap.tsx          # ★ Page principale : la carte interactive
    ├── Login.tsx / Register.tsx
    └── Itineraries.tsx
```

---

## ✅ Statut des vérifications

- Les 14 fichiers `.ts`/`.tsx` ont été vérifiés **syntaxiquement valides** avec le vrai compilateur TypeScript (`tsc`), en isolant les erreurs de syntaxe des erreurs de typage.
- Le **typage complet** (imports de `react-router-dom`, `@react-google-maps/api`, etc.) n'a **pas** pu être vérifié dans le sandbox car ces paquets nécessitent une installation réseau — fais `npm install` puis `npm run build` chez toi pour un contrôle de type complet avant de déployer. Si `tsc` remonte des erreurs à ce moment (souvent liées à des versions de libs légèrement différentes), envoie-moi le message exact et je corrige immédiatement.
- Le rendu visuel réel (mise en page, carte Google Maps fonctionnelle) n'a pas pu être capturé en image dans cet environnement — lance `npm run dev` et dis-moi ce que tu vois, je peux ajuster le design à partir de tes retours.

## 🔌 Connexion avec le backend

Ce frontend attend un backend qui répond sur `VITE_API_URL` avec exactement les routes suivantes (celles du Gateway Phase 2, ou du monolithe Phase 1 si tu retires le préfixe `/api` déjà fait) :
`POST /register`, `POST /login`, `GET /me`, `GET /destinations`, `GET /recommendations`, `POST /itineraries`, `GET /itineraries`, `POST /itineraries/:id/share`.

Lance ton backend (`docker-compose up` dans le dossier microservices, ou `python run.py` pour le monolithe Flask) **avant** `npm run dev`, sinon les appels API échoueront (message d'erreur affiché proprement dans l'UI, pas de crash).
