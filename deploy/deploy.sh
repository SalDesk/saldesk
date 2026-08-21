#!/bin/bash
# =============================================================
# SalDesk — Script de deploy
# Correr em cada nova versao a partir do VPS
#
# Layout real do servidor (confirmado ao vivo em 2026-08-21 --
# diferente do que uma leitura ingenua do DEPLOY.md sugere):
#   /var/www/saldesk/repo     - checkout git (branch main), onde o
#                               backend corre directamente via PM2
#   /var/www/saldesk/app      - build do frontend, servido por
#                               app.saldesk.cv (Nginx root)
#   /var/www/saldesk/website  - site estatico, servido por
#                               saldesk.cv (Nginx root)
#   /var/www/saldesk/uploads  - ficheiros enviados, servido por
#                               api.saldesk.cv/uploads/ (Nginx alias)
# app/ e website/ NAO sao o mesmo directorio que repo/frontend/dist
# e repo/website -- por isso o build/copia tem de publicar explicitamente.
# =============================================================

set -e

REPO_DIR="/var/www/saldesk/repo"
APP_DIR="/var/www/saldesk/app"
WEBSITE_DIR="/var/www/saldesk/website"
LOG_FILE="/var/log/saldesk/deploy.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Sem sudo, /var/log/saldesk pode nao existir ou nao ser escrevivel --
# nesse caso usa um log local em vez de abortar o deploy inteiro.
if ! mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || ! touch "$LOG_FILE" 2>/dev/null; then
    LOG_FILE="$REPO_DIR/deploy.log"
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
fi

log() {
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

log "=========================================="
log " SalDesk Deploy iniciado"
log "=========================================="

cd "$REPO_DIR"

# --- 1. Actualizar codigo ---
log "[1/6] A fazer git pull..."
git pull origin main

# --- 2. Build do frontend ---
# npm install SEM --omit=dev: vite (a ferramenta de build) e uma
# devDependency -- com --omit=dev o "npm run build" falha com
# "vite: not found". So o backend (passo 3) deve omitir dev deps.
log "[2/6] A instalar dependencias frontend (incl. devDependencies)..."
cd "$REPO_DIR/frontend"
npm install

log "[2/6] A compilar frontend..."
npm run build

log "[2/6] A publicar build em $APP_DIR..."
rsync -a --delete "$REPO_DIR/frontend/dist/" "$APP_DIR/"

# --- 3. Instalar dependencias do backend ---
log "[3/6] A instalar dependencias backend..."
cd "$REPO_DIR/backend"
npm install --omit=dev

# --- 4. Copiar website estatico ---
log "[4/6] A publicar website em $WEBSITE_DIR..."
cp -r "$REPO_DIR/website/." "$WEBSITE_DIR/"

# --- 5. Reiniciar API com PM2 ---
log "[5/6] A reiniciar API..."
cd "$REPO_DIR"
pm2 restart ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production
pm2 save

# --- 6. Verificar saude da API ---
log "[6/6] A verificar saude da API..."
sleep 3
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health)
if [ "$HEALTH" = "200" ]; then
    log "API saudavel (HTTP 200)"
else
    log "AVISO: API respondeu HTTP $HEALTH — verificar logs: pm2 logs saldesk-api"
fi

log "=========================================="
log " Deploy concluido com sucesso!"
log "=========================================="
