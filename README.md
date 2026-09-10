# 🏔️ MboaTrip — Bafoussam & Bandjoun

Projet complet : backend microservices (Phase 2) + frontend React avec carte interactive OpenStreetMap (gratuite, sans clé), entièrement recentré sur **Bafoussam** et **Bandjoun**, deux villes du pays Bamiléké (région de l'Ouest, Cameroun).

```
mboatrip/
├── backend/     ← Phase 2 : User Service, Itinerary Service, Recommendation Service, Gateway
└── frontend/    ← React + Leaflet + OpenStreetMap, carte interactive Bafoussam/Bandjoun
```

**Voir le fichier `guide-demarrage.docx` fourni séparément pour les instructions détaillées pas à pas.**

## 🚀 Lancer sans jamais taper de commande (recommandé)

Ce projet contient des **tâches VS Code préconfigurées** (`.vscode/tasks.json`) qui font tout à ta place — installation des dépendances, génération des `.env`, lancement des 5 services. Tu ne touches jamais au terminal pour taper une commande.

### La toute première fois seulement

1. Ouvre le dossier `mboatrip` dans VS Code (`File > Open Folder`)
2. Menu **Terminal → Run Task...** (ou `Ctrl+Shift+P` → tape "Run Task")
3. Choisis **"⚙️ Installation complète (à faire UNE SEULE FOIS)"**
4. Regarde les panneaux de terminal qui s'ouvrent tout seuls (tu n'as rien à taper) — ça installe tout, ça prend 2-3 minutes

### À chaque fois que tu veux lancer l'app

1. `Ctrl+Shift+B` (raccourci "Run Build Task", déjà configuré sur le bon bouton) **ou** Menu **Terminal → Run Task... → "🚀 Lancer MboaTrip"**
2. 5 panneaux de terminal s'ouvrent automatiquement (un par service + le frontend), tout démarre en parallèle
3. Ouvre **http://localhost:5173** dans ton navigateur

Pour arrêter : ferme simplement les panneaux de terminal, ou `Ctrl+C` dans chacun.

---

## Démarrage manuel (alternatif, si tu préfères comprendre chaque étape)

```powershell
# Backend — 4 terminaux, un par service
cd backend/user-service && python -m venv venv && venv\Scripts\activate && pip install -r requirements.txt
cd backend/itinerary-service && python -m venv venv && venv\Scripts\activate && pip install -r requirements.txt
cd backend/recommendation-service && python -m venv venv && venv\Scripts\activate && pip install -r requirements.txt
cd backend/gateway && python -m venv venv && venv\Scripts\activate && pip install -r requirements.txt

# Puis dans chaque terminal (venv activé) : python run.py (ou python app.py pour gateway)

# Frontend — 5ème terminal
cd frontend
npm install
copy .env.example .env
npm run dev
# Aucune clé API à configurer : la carte utilise OpenStreetMap (gratuit)
```

Résultat sur **http://localhost:5173**

## 🆕 Dernières mises à jour

- **Carte : passage à OpenStreetMap (Leaflet)** — plus besoin de clé Google Maps ni de compte Google Cloud. La carte, la recherche de lieux (Nominatim) et la recherche d'hôtels/restaurants/hôpitaux à proximité (Overpass API) sont **100% gratuites et fonctionnent immédiatement**, sans aucune configuration.
- **Thème visuel** : fond blanc + accent bleu clair.
- **Galerie photo interactive** : clique sur l'image d'un site pour ouvrir une galerie plein écran avec plusieurs photos (navigable aux flèches, aux vignettes, ou au clavier ← →).
- **Marqueurs recolorés** : sites touristiques et villes en bleu accent, hôtels en violet, restaurants en corail, hôpitaux en vert.

⚠️ **Différence avec la version Google Maps précédente** : OpenStreetMap ne fournit pas d'avis visiteurs (contrairement à Google Places) — la galerie se concentre donc sur les photos. Un lien "Voir sur OpenStreetMap" est disponible dans chaque fiche pour vérifier le lieu.

⚠️ **Couverture des données** : Overpass API (recherche d'hôtels/restaurants/hôpitaux en direct) dépend des contributions de la communauté OpenStreetMap, qui peut être incomplète pour de petites villes comme Bafoussam/Bandjoun comparé à Google Places. C'est un compromis du "100% gratuit, sans clé".

## Sources des images de la galerie

- **Bandjoun** : 4 photos réelles de la Chefferie (Wikimedia Commons : cour du palais, esplanade, case traditionnelle, paysage), 3 photos réelles pour le Musée (portrait d'un chef, statue du roi Kamga Joseph II)
- **Bafoussam** : 1 photo réelle vérifiée pour la Chefferie (chronologie des chefs). Le Marché A et la Colline de Banengo utilisent des photos génériques (marché africain / paysage de colline) faute de photo libre de droit spécifique trouvée — remplace-les si tu as de vraies photos
- **Bandjoun Station** : photos génériques (centre d'art) — aucune photo Wikimedia spécifique trouvée pour ce lieu



- Le catalogue de destinations ne contient plus que **Bafoussam** et **Bandjoun** (toutes les autres villes/régions ont été retirées, comme demandé).
- Chaque ville a **3 sites touristiques curatés et vérifiés** (chefferies royales, musées, marché, centre d'art) avec photos et descriptions réelles (sources : Wikipedia, Wikimedia Commons, Wikivoyage — voir section Sources).
- La carte affiche en plus, **en temps réel via Overpass API (OpenStreetMap)**, les hôtels, restaurants et **hôpitaux** à proximité de la ville sélectionnée.
- Coordonnées GPS vérifiées via recherche web (Bafoussam : 5.4778, 10.4176 · Bandjoun : 5.3667, 10.4167 — cette dernière moins précisément documentée, à affiner si besoin par géocodage réel).

## Sources des informations touristiques

- Wikipedia (FR) : articles "Bafoussam" et "Bandjoun"
- Wikivoyage : page "Bafoussam" (section À voir)
- Musée Communautaire de Bandjoun / Bandjoun Station (Barthélemy Toguo)

## ⚠️ Limites connues

- Les photos de la Chefferie de Bafoussam et de la Chefferie/Musée de Bandjoun proviennent de Wikimedia Commons (fichiers réels vérifiés). Les photos du Marché A et de la Colline de Banengo sont des images génériques (marché africain / colline) faute de photo libre de droit spécifique trouvée — à remplacer par de vraies photos si tu en as.
- Le rendu visuel final (carte, mise en page) n'a pas pu être vérifié dans le sandbox de génération (pas d'accès npm/réseau) — teste avec `npm run dev` et fais-moi un retour précis si quelque chose ne s'affiche pas comme attendu.

## 🆕 Dernières mises à jour (round 2)

- **Géolocalisation** : bouton "Me localiser" sur `/explorer` (icône `LocateFixed`), utilise `navigator.geolocation`, affiche un marqueur bleu "Vous êtes ici" et centre la carte dessus. Gère les refus d'autorisation avec un message clair.
- **Clustering des marqueurs** : les résultats hôtels/restaurants/hôpitaux (potentiellement nombreux via Overpass) sont désormais regroupés visuellement (`react-leaflet-cluster` + `leaflet.markercluster`) pour rester lisibles.
- **PWA** : l'app est installable (manifest + service worker via `vite-plugin-pwa`), fonctionne hors-ligne pour le shell de l'app, met en cache les tuiles OSM et les images Wikimedia déjà vues. Icônes générées (192/512px, vert forêt + montagne dorée).
- **Gastronomie illustrée** : Poulet DG, Koki, Ndolé et vin de palme ont maintenant de vraies photos Wikimedia Commons vérifiées. Nkui et Kondrè utilisent des photos génériques (aucune photo libre spécifique trouvée), clairement indiqué dans l'app.
- **Nouvelle section Artisanat** : sculpture sur bois, tissu Ndop, vannerie/raphia — avec photos génériques illustratives (transparence affichée dans l'app).
- **Teasers Restaurants/Hôtels illustrés** avec photos.

⚠️ **À installer avant de lancer** : `npm install` doit maintenant récupérer `react-leaflet-cluster`, `leaflet.markercluster`, `vite-plugin-pwa` et leurs types — pas testé en conditions réelles dans mon environnement (pas de réseau npm), donc si `npm install` ou `npm run dev` remonte une erreur liée à ces paquets, colle-la-moi et je corrige immédiatement.
