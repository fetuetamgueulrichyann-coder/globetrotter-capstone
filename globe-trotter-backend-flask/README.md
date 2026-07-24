# 🌍 Globe Trotter Travel Assistant — Phase 1 (Flask)

API REST monolithique en **Python/Flask**. Stockage : fichier JSON (`data/db.json`). Auth : JWT.
Conteneurisée avec **Docker**.

---

## 🚀 Démarrage — sans Docker

```powershell
python -m venv venv
venv\Scripts\activate              # PowerShell : .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env             # puis change JWT_SECRET dans .env
python run.py
```

API sur `http://localhost:4000`. Test : `http://localhost:4000/api/health`

## 🐳 Démarrage — avec Docker

```bash
cp .env.example .env    # change JWT_SECRET
docker-compose up --build
```

> Le volume `./data:/app/data` dans `docker-compose.yml` garde `db.json` persistant sur ta machine entre les redémarrages du conteneur.

---

## 🏗️ Structure du projet

```
globe-trotter-backend-flask/
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── .env.example
├── run.py                 # Point d'entrée (utilisé aussi par Gunicorn : run:app)
├── data/
│   └── db.json             # Base de données JSON (users, destinations, itineraries)
└── app/
    ├── __init__.py         # Application factory (sécurité, blueprints, erreurs)
    ├── config.py            # Configuration centralisée (variables d'environnement)
    ├── logger.py            # Logger structuré JSON
    ├── errors.py            # ApiError + gestion centralisée des erreurs
    ├── validators.py        # Validation manuelle des payloads
    ├── models.py             # Accès aux données : data_store + User + Destination + Itinerary
    ├── auth.py               # JWT + décorateurs + routes register/login/me/logout
    ├── destinations.py       # Routes destinations
    ├── recommendations.py    # Routes recommandations
    └── itineraries.py        # Routes itinéraires
```

**Pourquoi cette structure ?** Chaque fichier a une responsabilité claire (SRP). `models.py` est le seul point d'accès à `db.json` — aucune route n'écrit directement dedans, ce qui facilite la migration vers une vraie base de données en Phase 2.

---

## 📡 Documentation des API

Format uniforme :
```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "message": "...", "details": [...] } }
```

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | non | Health check |
| POST | `/api/auth/register` | non | Inscription |
| POST | `/api/auth/login` | non | Connexion |
| GET | `/api/auth/me` | oui | Profil connecté |
| POST | `/api/auth/logout` | oui | Déconnexion |
| GET | `/api/destinations` | non | Recherche/filtre/tri/pagination |
| GET | `/api/destinations/:id` | non | Détail destination |
| GET | `/api/recommendations` | oui | Recommandations personnalisées |
| POST | `/api/itineraries` | oui | Créer un itinéraire |
| GET | `/api/itineraries` | oui | Lister mes itinéraires |
| GET | `/api/itineraries/:id` | oui | Détail d'un itinéraire |
| POST | `/api/itineraries/:id/share` | oui | Partager (par email) |

### Exemples

**POST /api/auth/register**
```json
{ "name": "Alice", "email": "alice@test.com", "password": "password123", "preferences": ["plage","culture"] }
```

**GET /api/destinations?search=Douala&tag=culture&sortBy=popularity&order=desc&page=1&limit=10**

**POST /api/itineraries**
```json
{ "title": "Vacances", "destinationId": "d11", "startDate": "2026-09-01", "endDate": "2026-09-10", "notes": "..." }
```
Header requis pour toutes les routes protégées : `Authorization: Bearer <token>`

---

## 🇨🇲 Données Cameroun

Douala (`d9`), Yaoundé (`d10`) et Kribi (`d11`) sont incluses dans le jeu de données, avec coordonnées GPS (`lat`/`lng`) sur **toutes** les destinations — prêt pour une future carte interactive (Leaflet/Mapbox) côté frontend.

---

## 🔒 Sécurité implémentée

- Mots de passe hachés via `werkzeug.security` (pbkdf2/scrypt)
- JWT (PyJWT), expiration configurable
- Headers de sécurité HTTP (X-Content-Type-Options, X-Frame-Options, etc.)
- Rate limiting : 300 req/15min global, 20 req/15min sur `/api/auth/*`
- CORS restreint aux origines listées dans `.env`
- Validation stricte de toutes les entrées → 422 avec détails structurés
- Messages d'erreur génériques sur le login (n'expose pas si l'email existe)
- `passwordHash` jamais renvoyé au client (`sanitize_user`)

## 🧪 Statut des tests

✅ Syntaxe validée sur tous les fichiers Python
✅ **13 tests end-to-end passés** via le test client Flask intégré :
register, login (succès + échec), profil protégé, accès refusé sans token, recherche/filtre destinations, recherche par pays (Douala), recommandations personnalisées (scoring vérifié), création/listing d'itinéraires, validations d'erreurs (422), dates invalides, destination 404, partage d'itinéraire.

⚠️ Deux bugs trouvés et corrigés pendant les tests :
1. Collision de nom entre le paramètre `message` du logger et un kwarg `message=` → renommé en `detail=`.
2. Routes Blueprint avec `/` causant une redirection 308 sur `/api/destinations`, `/api/itineraries`, `/api/recommendations` (sans slash final) → routes changées en chaîne vide `""`.

Test HTTP réel via `docker-compose up` ou `python run.py` à faire chez toi (le sandbox n'a pas d'accès réseau pour installer flask-cors/flask-limiter, mais toute la logique métier a été testée directement avec ces dépendances shimées).
