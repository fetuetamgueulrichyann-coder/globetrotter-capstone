# Génère automatiquement tous les fichiers .env nécessaires, avec un
# JWT_SECRET et un INTERNAL_API_KEY générés une seule fois et partagés
# entre les services (comme requis). Aucune saisie manuelle nécessaire.
# Ce script est lancé via une tâche VS Code — jamais à la main.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function New-Secret {
    -join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
}

$jwtSecret = New-Secret
$internalKey = New-Secret

Write-Host "Génération des .env avec des secrets partagés (JWT + clé interne)..." -ForegroundColor Cyan

# ---------- user-service ----------
@"
FLASK_ENV=development
PORT=5001
JWT_SECRET=$jwtSecret
JWT_EXPIRES_IN_HOURS=168
CORS_ORIGIN=http://localhost:5173
RABBITMQ_URL=amqp://guest:guest@localhost:5672/
INTERNAL_API_KEY=$internalKey
"@ | Set-Content "$root\backend\user-service\.env" -Encoding UTF8

# ---------- itinerary-service ----------
@"
FLASK_ENV=development
PORT=5002
JWT_SECRET=$jwtSecret
CORS_ORIGIN=http://localhost:5173
RABBITMQ_URL=amqp://guest:guest@localhost:5672/
INTERNAL_API_KEY=$internalKey
USER_SERVICE_URL=http://localhost:5001
"@ | Set-Content "$root\backend\itinerary-service\.env" -Encoding UTF8

# ---------- recommendation-service ----------
@"
FLASK_ENV=development
PORT=5003
JWT_SECRET=$jwtSecret
CORS_ORIGIN=http://localhost:5173
RABBITMQ_URL=amqp://guest:guest@localhost:5672/
INTERNAL_API_KEY=$internalKey
USER_SERVICE_URL=http://localhost:5001
ITINERARY_SERVICE_URL=http://localhost:5002
"@ | Set-Content "$root\backend\recommendation-service\.env" -Encoding UTF8

# ---------- gateway ----------
@"
FLASK_ENV=development
PORT=8000
CORS_ORIGIN=http://localhost:5173
USER_SERVICE_URL=http://localhost:5001
ITINERARY_SERVICE_URL=http://localhost:5002
RECOMMENDATION_SERVICE_URL=http://localhost:5003
"@ | Set-Content "$root\backend\gateway\.env" -Encoding UTF8

# ---------- frontend ----------
if (-not (Test-Path "$root\frontend\.env")) {
    Copy-Item "$root\frontend\.env.example" "$root\frontend\.env"
    Write-Host ""
    Write-Host "⚠ N'oublie pas d'ouvrir frontend\.env et d'ajouter ta clé Google Maps (VITE_GOOGLE_MAPS_API_KEY)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Tous les .env ont été générés avec succès." -ForegroundColor Green
