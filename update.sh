#!/usr/bin/env bash
#
# update.sh — Mise à jour automatique de MboaTrip sur le VPS.
#
# Usage :
#   cd /opt/mboatrip && ./update.sh
#
# Ce que fait ce script, dans l'ordre :
#   1. Vérifie qu'on est bien dans le bon dossier et que rien d'anormal ne
#      traîne (modifications locales non commitées).
#   2. Sauvegarde la base PostgreSQL AVANT tout changement.
#   3. Récupère la dernière version depuis GitHub (git pull).
#   4. Reconstruit les images Docker qui ont changé.
#   5. Redémarre uniquement les conteneurs MboaTrip (jamais les autres
#      projets du VPS, jamais le volume PostgreSQL).
#   6. Vérifie que tout fonctionne (base, API, frontend) et échoue bruyamment
#      sinon, en te disant exactement quoi regarder.
#
# GARANTIES DE SÉCURITÉ (ne jamais retirer ces protections) :
#   - Ce script n'exécute JAMAIS : `docker compose down -v`,
#     `docker volume rm/prune`, ni `docker system prune`.
#   - Le volume PostgreSQL (postgres-data) n'est jamais supprimé ni recréé.
#   - Seuls les services définis dans backend/docker-compose.yml sont
#     touchés (tous préfixés "mboatrip-yann-"), jamais les conteneurs
#     d'autres projets sur le même VPS.
#   - Une sauvegarde SQL est toujours prise avant de toucher au code.
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_DIR="$PROJECT_DIR/backend"
COMPOSE_FILE="$COMPOSE_DIR/docker-compose.yml"
BACKUP_DIR="$PROJECT_DIR/backups"
BACKUP_RETENTION=15          # nombre de sauvegardes conservées (les plus anciennes sont supprimées, jamais les données en base)
HEALTH_URL="http://localhost:8000/health"
FRONTEND_URL="http://localhost:8081/"
HEALTH_RETRIES=15
HEALTH_DELAY=4                # secondes entre chaque tentative

# Couleurs (désactivées automatiquement si la sortie n'est pas un terminal)
if [ -t 1 ]; then
  C_BLUE="\033[1;34m"; C_GREEN="\033[1;32m"; C_RED="\033[1;31m"; C_YELLOW="\033[1;33m"; C_RESET="\033[0m"
else
  C_BLUE=""; C_GREEN=""; C_RED=""; C_YELLOW=""; C_RESET=""
fi

step()    { echo -e "\n${C_BLUE}==> $1${C_RESET}"; }
ok()      { echo -e "${C_GREEN}✓ $1${C_RESET}"; }
warn()    { echo -e "${C_YELLOW}! $1${C_RESET}"; }
fail()    { echo -e "${C_RED}✗ $1${C_RESET}"; exit 1; }

trap 'echo -e "\n${C_RED}✗ Mise à jour interrompue (ligne $LINENO). Rien de destructif n'\''a été exécuté : ta base de données et tes volumes sont intacts.${C_RESET}"' ERR

compose() {
  # Toujours lancé depuis backend/ pour que le contexte de build relatif du
  # frontend (../frontend) et les chemins des .env se résolvent correctement.
  (cd "$COMPOSE_DIR" && docker compose "$@")
}

# ---------------------------------------------------------------------------
# 0. Vérifications préalables
# ---------------------------------------------------------------------------
step "Vérifications préalables"

[ -f "$COMPOSE_FILE" ] || fail "docker-compose.yml introuvable à $COMPOSE_FILE — ce script doit être lancé depuis la racine du projet MboaTrip (/opt/mboatrip)."
command -v docker >/dev/null 2>&1 || fail "Docker n'est pas installé ou pas dans le PATH."
docker compose version >/dev/null 2>&1 || fail "Le plugin 'docker compose' (v2) est requis."
command -v git >/dev/null 2>&1 || fail "git n'est pas installé."
command -v curl >/dev/null 2>&1 || fail "curl n'est pas installé (nécessaire pour les vérifications post-déploiement)."

cd "$PROJECT_DIR"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fail "Ce dossier n'est pas un dépôt git. Vérifie que /opt/mboatrip a bien été cloné avec 'git clone', pas juste copié."
fi

# Modifications locales non commitées = on refuse de risquer un conflit ou
# d'écraser un correctif fait à la main directement sur le VPS. Les fichiers
# .env ne doivent normalement pas être suivis par git (voir .gitignore) donc
# ne devraient jamais apparaître ici.
if [ -n "$(git status --porcelain)" ]; then
  echo
  git status --short
  echo
  fail "Il y a des modifications locales non commitées (ci-dessus). Mets-les de côté ('git stash') ou commite-les avant de relancer ./update.sh."
fi

ok "Dossier projet : $PROJECT_DIR"

PREVIOUS_COMMIT="$(git rev-parse HEAD)"
PREVIOUS_COMMIT_SHORT="$(git rev-parse --short HEAD)"
ok "Version actuelle : $PREVIOUS_COMMIT_SHORT"

# ---------------------------------------------------------------------------
# 1. Sauvegarde PostgreSQL — AVANT tout changement de code
# ---------------------------------------------------------------------------
step "Sauvegarde de PostgreSQL"

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/mboatrip_${TIMESTAMP}.sql.gz"

POSTGRES_CID="$(compose ps -q postgres 2>/dev/null || true)"
if [ -n "$POSTGRES_CID" ] && [ "$(docker inspect -f '{{.State.Running}}' "$POSTGRES_CID" 2>/dev/null)" = "true" ]; then
  # pg_dump (pas pg_dumpall) : on sauvegarde la base "mboatrip" applicative.
  # -T (pas de TTY) est indispensable dans un script non-interactif.
  compose exec -T postgres pg_dump -U mboatrip mboatrip | gzip > "$BACKUP_FILE"
  BACKUP_SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
  ok "Sauvegarde créée : $BACKUP_FILE ($BACKUP_SIZE)"

  # Purge des sauvegardes les plus anciennes au-delà de BACKUP_RETENTION.
  # Ceci ne touche QUE des fichiers .sql.gz dans backups/, jamais le volume
  # Docker ni les données en base elles-mêmes.
  BACKUP_COUNT="$(find "$BACKUP_DIR" -maxdepth 1 -name 'mboatrip_*.sql.gz' | wc -l)"
  if [ "$BACKUP_COUNT" -gt "$BACKUP_RETENTION" ]; then
    find "$BACKUP_DIR" -maxdepth 1 -name 'mboatrip_*.sql.gz' -printf '%T@ %p\n' \
      | sort -n | head -n "$((BACKUP_COUNT - BACKUP_RETENTION))" | cut -d' ' -f2- \
      | xargs -r rm -f
    ok "Anciennes sauvegardes purgées (on garde les $BACKUP_RETENTION plus récentes)."
  fi
else
  warn "Le conteneur postgres n'est pas démarré — c'est probablement le tout premier déploiement. Sauvegarde ignorée."
fi

# ---------------------------------------------------------------------------
# 2. Récupération de la dernière version (GitHub)
# ---------------------------------------------------------------------------
step "Récupération de la dernière version depuis GitHub"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git fetch origin "$CURRENT_BRANCH"
git pull --ff-only origin "$CURRENT_BRANCH" \
  || fail "git pull a échoué (historique divergent ?). Résous ça manuellement sur le VPS avant de relancer ./update.sh."

NEW_COMMIT="$(git rev-parse HEAD)"
NEW_COMMIT_SHORT="$(git rev-parse --short HEAD)"

if [ "$PREVIOUS_COMMIT" = "$NEW_COMMIT" ]; then
  ok "Déjà à jour ($NEW_COMMIT_SHORT) — on relance quand même la reconstruction/redémarrage, au cas où des .env ou fichiers locaux aient changé."
else
  ok "Mis à jour : $PREVIOUS_COMMIT_SHORT → $NEW_COMMIT_SHORT"
fi

# ---------------------------------------------------------------------------
# 3. Construction des images
# ---------------------------------------------------------------------------
step "Construction des images Docker (cache réutilisé pour ce qui n'a pas changé)"

compose build
ok "Images construites."

# ---------------------------------------------------------------------------
# 4. Redémarrage — uniquement les services MboaTrip, jamais le volume postgres
# ---------------------------------------------------------------------------
step "Redémarrage des services MboaTrip"

# `up -d` recrée uniquement les conteneurs dont l'image/config a changé et
# laisse les autres intacts. Aucune suppression de volume n'a lieu ici :
# postgres-data n'est jamais recréé, seulement réutilisé par le conteneur
# postgres (qui redémarre lui aussi, mais garde ses données).
compose up -d --remove-orphans
ok "Conteneurs à jour et démarrés."

# ---------------------------------------------------------------------------
# 5. Vérifications post-déploiement
# ---------------------------------------------------------------------------
step "Vérification que tout fonctionne"

echo "Conteneurs MboaTrip :"
compose ps

# --- PostgreSQL ---
echo
echo -n "PostgreSQL... "
if compose exec -T postgres pg_isready -U mboatrip >/dev/null 2>&1; then
  echo -e "${C_GREEN}OK${C_RESET}"
else
  fail "PostgreSQL ne répond pas après la mise à jour. Tes données sont en sécurité (le volume n'a pas été touché) mais un service a un problème de démarrage — regarde 'docker compose logs postgres' dans $COMPOSE_DIR."
fi

# --- API (gateway agrégé, exposé par edge-proxy sur le port 8000) ---
echo -n "API (gateway + microservices)... "
API_OK=false
for i in $(seq 1 "$HEALTH_RETRIES"); do
  if RESPONSE="$(curl -sf --max-time 5 "$HEALTH_URL" 2>/dev/null)"; then
    if echo "$RESPONSE" | grep -q '"success":[[:space:]]*true'; then
      API_OK=true
      break
    fi
  fi
  sleep "$HEALTH_DELAY"
done
if [ "$API_OK" = true ]; then
  echo -e "${C_GREEN}OK${C_RESET}"
else
  echo -e "${C_RED}ÉCHEC${C_RESET}"
  echo "Dernière réponse de $HEALTH_URL :"
  echo "${RESPONSE:-<pas de réponse>}"
  fail "L'API ne répond pas correctement après $((HEALTH_RETRIES * HEALTH_DELAY))s. Regarde 'docker compose logs gateway' et 'docker compose logs <service>' dans $COMPOSE_DIR. Tes données restent intactes ; la sauvegarde $BACKUP_FILE est disponible si besoin de revenir en arrière."
fi

# --- Frontend ---
echo -n "Frontend... "
FRONTEND_OK=false
for i in $(seq 1 "$HEALTH_RETRIES"); do
  STATUS="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$FRONTEND_URL" 2>/dev/null || echo "000")"
  if [ "$STATUS" = "200" ]; then
    FRONTEND_OK=true
    break
  fi
  sleep "$HEALTH_DELAY"
done
if [ "$FRONTEND_OK" = true ]; then
  echo -e "${C_GREEN}OK${C_RESET}"
else
  echo -e "${C_RED}ÉCHEC${C_RESET} (code HTTP : $STATUS)"
  fail "Le frontend ne répond pas après $((HEALTH_RETRIES * HEALTH_DELAY))s. Regarde 'docker compose logs frontend' dans $COMPOSE_DIR."
fi

# ---------------------------------------------------------------------------
# Résumé
# ---------------------------------------------------------------------------
step "Mise à jour terminée avec succès 🎉"
echo "  Version précédente : $PREVIOUS_COMMIT_SHORT"
echo "  Nouvelle version   : $NEW_COMMIT_SHORT"
echo "  Sauvegarde SQL     : ${BACKUP_FILE:-aucune (premier déploiement)}"
echo "  Frontend           : http://<ton-domaine-ou-ip>:8081"
echo "  API                : http://<ton-domaine-ou-ip>:8000"
echo
echo "En cas de souci constaté après coup (pas détecté par les vérifications ci-dessus) :"
echo "  Revenir au code précédent : git checkout $PREVIOUS_COMMIT_SHORT && ./update.sh"
echo "  Restaurer la base depuis la sauvegarde :"
echo "    gunzip -c $BACKUP_FILE | docker compose -f $COMPOSE_FILE exec -T postgres psql -U mboatrip mboatrip"
