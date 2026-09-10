# 🌍 MboaTrip Travel Assistant — Phase 2 (Microservices)

Le monolithe de la Phase 1 est découpé en **3 microservices indépendants**, chacun avec sa propre base de données JSON, orchestrés derrière une **API Gateway** unique, avec communication **synchrone (REST)** et **asynchrone (RabbitMQ)**.

---

## 🏗️ Architecture

```
                         ┌─────────────┐
        Client (front)──▶│   Gateway   │  (port 8000) — point d'entrée UNIQUE
                         └──────┬──────┘
              ┌─────────────────┼──────────────────┐
              ▼                 ▼                   ▼
      ┌───────────────┐ ┌────────────────┐ ┌────────────────────┐
      │ User Service  │ │Itinerary Service│ │Recommendation Service│
      │  (port 5001)  │ │  (port 5002)    │ │    (port 5003)      │
      │  users.json   │ │ destinations+   │ │  (pas de DB propre, │
      │               │ │ itineraries.json│ │   lit les 2 autres) │
      └───────┬───────┘ └────────┬────────┘ └──────────┬──────────┘
              │                  │                       │
              │   publie events  │   publie events       │ s'abonne aux events
              └──────────►  RabbitMQ (topic exchange)  ◄─┘  (invalidation cache)
                          "globetrotter.events"
```

- **User Service** : inscription, login, JWT, profils, préférences. Publie `user.registered`.
- **Itinerary Service** : catalogue de destinations + gestion des itinéraires/partages. Publie `itinerary.created`.
- **Recommendation Service** : ne stocke rien — appelle en **REST synchrone** le User Service (préférences) et l'Itinerary Service (destinations + historique), calcule un score, et **cache** le résultat par utilisateur. Un **consumer RabbitMQ asynchrone** invalide ce cache dès qu'un événement pertinent arrive (nouvel utilisateur, nouvel itinéraire), sans appel bloquant sur le chemin de la requête.
- **API Gateway** : reverse proxy Flask, seul point d'entrée public. Route par préfixe de chemin, gère CORS + rate limiting centralisés, expose un health check agrégé (`/health`) qui interroge les 3 services.

## 📁 Structure

```
globe-trotter-microservices/
├── docker-compose.yml       # Orchestration complète (RabbitMQ + 4 services)
├── gateway/
│   ├── app.py                # Reverse proxy (fichier unique, volontairement simple)
│   ├── requirements.txt
│   └── .env.example
├── user-service/
│   ├── app/ (config, logger, errors, validators, models, auth, events)
│   ├── data/users.json
│   ├── run.py / requirements.txt / .env.example
├── itinerary-service/
│   ├── app/ (config, logger, errors, validators, models, destinations,
│   │         itineraries, auth_middleware, events)
│   ├── data/destinations.json (18 destinations, dont 10 au Cameroun —
│   │         accent Centre/Ouest : Yaoundé, Douala, Bafoussam, Bandjoun...)
│   ├── data/itineraries.json
│   └── run.py / requirements.txt / .env.example
└── recommendation-service/
    ├── app/ (config, logger, errors, clients, cache, consumer,
    │         recommendations, auth_middleware)
    └── run.py / requirements.txt / .env.example
```

---

## 🚀 Lancer avec Docker Compose (recommandé)

```bash
# Créer les .env de chaque service à partir des .example
cp user-service/.env.example user-service/.env
cp itinerary-service/.env.example itinerary-service/.env
cp recommendation-service/.env.example recommendation-service/.env
cp gateway/.env.example gateway/.env
```

⚠️ **Important** : ouvre chacun de ces 4 fichiers `.env` et mets **exactement le même** `JWT_SECRET` partout (le Gateway n'en a pas besoin, il ne fait que router) — sinon un token émis par le User Service sera rejeté par les autres services. Génère-en un avec :
```bash
python3 -c "import secrets; print(secrets.token_hex(64))"
```
Fais pareil pour `INTERNAL_API_KEY` (doit être identique dans user-service, itinerary-service, recommendation-service).

```bash
docker-compose up --build
```

- Gateway : `http://localhost:8000`
- RabbitMQ Management UI : `http://localhost:15672` (guest/guest) — utile pour **voir en direct** les événements passer sur l'exchange `globetrotter.events`
- Health check agrégé : `http://localhost:8000/health`

---

## 📡 Routes exposées via le Gateway

| Méthode | Route | Service cible | Auth |
|---|---|---|---|
| GET | `/health` | Gateway (agrège les 3 services) | non |
| POST | `/register` | User Service | non |
| POST | `/login` | User Service | non |
| GET | `/me` | User Service | oui |
| POST | `/logout` | User Service | oui |
| GET | `/destinations` | Itinerary Service | non |
| GET | `/destinations/:id` | Itinerary Service | non |
| POST | `/itineraries` | Itinerary Service | oui |
| GET | `/itineraries` | Itinerary Service | oui |
| GET | `/itineraries/:id` | Itinerary Service | oui |
| POST | `/itineraries/:id/share` | Itinerary Service | oui |
| GET | `/recommendations` | Recommendation Service | oui |

Le client (frontend) ne parle **qu'au Gateway** — il ne connaît jamais `user-service:5001` etc.

---

## 🔄 Communication entre services

**Synchrone (REST)** — routes `/internal/*`, protégées par un header `X-Internal-Key` (jamais exposées via le Gateway) :
- `GET /internal/users/<id>` — le Recommendation Service lit les préférences
- `GET /internal/users/by-email` — l'Itinerary Service résout un email en userId lors d'un partage
- `GET /internal/destinations` — le Recommendation Service lit le catalogue complet
- `GET /internal/itineraries?userId=` — le Recommendation Service lit l'historique d'un utilisateur

**Asynchrone (RabbitMQ, exchange topic `globetrotter.events`)** :
- `user.registered` publié par le User Service
- `itinerary.created` publié par l'Itinerary Service
- Le Recommendation Service consomme les deux pour **invalider son cache** par utilisateur — découplage total : si RabbitMQ tombe, les autres services continuent de fonctionner (publication non bloquante, voir `events.py`), seul le cache se rafraîchit moins vite.

---

## ✅ Statut des tests

Testé service par service avec de vrais appels HTTP (test client Flask + serveurs réels lancés en local) :

- **User Service** (6 tests) : register, login, `/me` protégé, route interne avec/sans bonne clé
- **Itinerary Service** (8 tests) : recherche/filtre par région (`Ouest` → Bafoussam/Dschang/Foumban/Bandjoun), création d'itinéraire, routes internes
- **Recommendation Service** (4 tests) : scoring vérifié (un profil "culture+artisanat" fait remonter Bafoussam/Bandjoun en tête), **cache + invalidation** fonctionnels
- **Gateway** : bug réel trouvé et corrigé (init Flask-Limiter), **health check agrégé confirmé fonctionnel** interrogeant réellement les 3 services démarrés en parallèle

⚠️ Le flux bout-en-bout complet à travers le Gateway (register → login → destinations → itinéraire → recommandations, les 4 services qui se parlent vraiment entre eux) a été lancé avec succès sur les health checks, mais n'a pas pu être confirmé jusqu'au bout à cause d'une limite du sandbox (les process en arrière-plan sont tués entre deux commandes). **À valider chez toi avec `docker-compose up`**, où cette limite n'existe pas.

RabbitMQ n'a pas pu être testé avec un vrai broker (pas de réseau dans le sandbox) — la logique de publication/consommation a été validée avec un shim, mais teste absolument le flux réel via l'interface RabbitMQ Management (`localhost:15672`) après `docker-compose up`, tu dois voir les messages `user.registered` et `itinerary.created` transiter en direct.

## 🇨🇲 Rappel données Cameroun

10 villes camerounaises dans `itinerary-service/data/destinations.json`, toutes régions représentées, avec accent Centre (Yaoundé, Mbalmayo, Obala) et Ouest (Bafoussam, Bandjoun, Dschang, Foumban). Coordonnées `lat`/`lng` approximatives pour l'instant — **à vérifier/affiner** avant de les utiliser sur la carte interactive du frontend (Phase suivante).
