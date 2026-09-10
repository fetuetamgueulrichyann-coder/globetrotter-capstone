# Journal des modifications — MboaTrip

Suivi de toutes les décisions de design/UX prises librement (conformément au
3e mini-prompt), avec justification brève de chaque choix.

## Round 3 (en cours)
- **Renommage complet du projet** : `globe-trotter-*` → `mboatrip` partout (dossier racine, `package.json`, READMEs, tâche VS Code). *Justification : cohérence de marque totale, plus aucune trace de l'ancien nom.*
- **Refonte visuelle Explorer, Itinéraires, Inscription** *(voir sections dédiées ci-dessous)*

## Round 2
- **Géolocalisation** ajoutée sur `/explorer` (`navigator.geolocation` + marqueur "Vous êtes ici"). *Justification : explicitement demandé dans le prompt OSM, améliore l'utilité pratique sur le terrain.*
- **Clustering des marqueurs** (`react-leaflet-cluster`) pour les résultats Overpass (hôtels/restaurants/hôpitaux). *Justification : évite la surcharge visuelle quand une recherche renvoie 15-20 points.*
- **PWA** installable (`vite-plugin-pwa`, manifest, icônes, cache offline des tuiles/images). *Justification : non demandé explicitement mais cohérent avec "application professionnelle" — permet un usage terrain avec réseau instable, fréquent en zone rurale camerounaise.*
- **Gastronomie illustrée** avec vraies photos Wikimedia Commons (Poulet DG, Koki, Ndolé, vin de palme). *Justification : demande explicite "mets culturels".*
- **Section Artisanat** ajoutée (absente du prompt initial mais mentionnée dans "Données" → sculpture, Ndop, vannerie). *Justification : complète la couverture culturelle demandée.*

## Round 1
- **Rebranding MboaTrip** : palette vert forêt / or / blanc cassé / gris clair / noir élégant, appliquée via un système de tokens Tailwind partagé (`ndop`/`bronze`/`ivory` alias sur les nouvelles valeurs) pour propager la couleur à toute page existante sans réécrire chaque fichier. *Justification : cohérence immédiate + maintenabilité (un seul point de vérité pour la palette).*
- **Login refondu** en glassmorphism avec photo réelle fournie par l'utilisateur (stockée en local, `frontend/public/images/`). *Justification : fidélité à la référence visuelle fournie.*
- **Icônes lucide-react** remplacent les emoji. *Justification : rendu plus proche d'Airbnb/Google Travel qu'une interface à base d'émojis.*
- **Home reconstruite** avec Hero, recherche, cartes villes, galerie, culture, gastronomie, teasers restaurants/hôtels, événements (placeholder honnête), CTA carte. *Justification : couvre l'intégralité des sections demandées dans le prompt.*
- **Carte déplacée sur `/explorer`**, Home ne fait qu'un CTA vers elle plutôt que de dupliquer la logique carte. *Justification : principe DRY/SOLID demandé explicitement — éviter deux implémentations de la même fonctionnalité.*
- **Bouton Google désactivé visuellement** (pas fonctionnel). *Justification : l'OAuth réel nécessite une config backend Flask non demandée à ce stade — mieux vaut un bouton honnêtement inactif qu'une fausse promesse.*

## Décisions volontairement non prises (et pourquoi)
- **Pas de fausses données restaurants/hôtels avec noms d'établissements inventés** — uniquement des résultats live OpenStreetMap, quitte à avoir une couverture parfois incomplète sur Bafoussam/Bandjoun. *Justification : le prompt exige "informations réelles", inventer des noms d'établissements serait une désinformation touristique.*
- **Pas de fausse liste d'événements** — section "Bientôt disponible" plutôt que des festivals inventés. *Justification : même principe d'honnêteté.*
- **Pas d'implémentation Google OAuth réelle** malgré le bouton visuel — nécessiterait une décision produit (créer un compte Google Cloud, gérer les secrets) qui dépasse le cadre d'une itération de design. *À valider avec le porteur de projet avant implémentation.*
