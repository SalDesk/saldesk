#!/bin/bash
# =============================================================
# SalDesk — Script de deploy
# Correr em cada nova versao a partir do VPS
# Caminho: /var/www/saldesk/
# =============================================================

set -e

DEPLOY_DIR="/var/www/saldesk"
LOG_FILE="/var/log/saldesk/deploy.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

log() {
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

log "=========================================="
log " SalDesk Deploy iniciado"
log "=========================================="

cd "$DEPLOY_DIR"

# --- 1. Actualizar codigo ---
log "[1/5] A fazer git pull..."
git pull origin main

# --- 2. Build do frontend ---
log "[2/5] A instalar dependencias frontend..."
cd "$DEPLOY_DIR/frontend"
npm install --omit=dev

log "[2/5] A compilar frontend..."
npm run build

log "[2/5] A copiar build para Nginx..."
# O Nginx serve directamente de frontend/dist — nao e preciso copiar

# --- 3. Instalar dependencias do backend ---
log "[3/5] A instalar dependencias backend..."
cd "$DEPLOY_DIR/backend"
npm install --omit=dev

# --- 4. Copiar website estatico ---
log "[4/5] A copiar website para Nginx..."
cp -r "$DEPLOY_DIR/website/." /var/www/saldesk/website/

# --- 5. Reiniciar API com PM2 ---
log "[5/5] A reiniciar API..."
cd "$DEPLOY_DIR"
pm2 restart ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production
pm2 save

# --- Verificar saude da API ---
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
