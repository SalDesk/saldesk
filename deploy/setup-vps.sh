#!/bin/bash
# =============================================================
# SalDesk — Setup inicial do VPS (Ubuntu 22.04 LTS)
# Hostinger KVM 2 ou equivalente
# Correr UMA vez como root apos primeiro acesso SSH
# =============================================================

set -e

echo "=============================================="
echo " SalDesk VPS Setup — Ubuntu 22.04"
echo "=============================================="

# --- 1. Actualizar sistema ---
echo "[1/10] A actualizar pacotes..."
apt-get update -y && apt-get upgrade -y
apt-get install -y curl wget git unzip build-essential ufw fail2ban

# --- 2. Node.js 20 via NodeSource ---
echo "[2/10] A instalar Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node --version
npm --version

# --- 3. PM2 ---
echo "[3/10] A instalar PM2..."
npm install -g pm2
pm2 startup systemd -u root --hp /root
# Activar auto-start apos reboot
systemctl enable pm2-root

# --- 4. Redis ---
echo "[4/10] A instalar Redis..."
apt-get install -y redis-server
# Configurar Redis para arrancar automaticamente
systemctl enable redis-server
systemctl start redis-server
# Verificar
redis-cli ping

# --- 5. Nginx ---
echo "[5/10] A instalar Nginx..."
apt-get install -y nginx
systemctl enable nginx
systemctl start nginx

# --- 6. Certbot (SSL Let's Encrypt) ---
echo "[6/10] A instalar Certbot..."
apt-get install -y certbot python3-certbot-nginx

# --- 7. Firewall (ufw) ---
echo "[7/10] A configurar firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable
ufw status

# --- 8. fail2ban (proteccao SSH brute force) ---
echo "[8/10] A configurar fail2ban..."
systemctl enable fail2ban
systemctl start fail2ban

# --- 9. Estrutura de diretorios ---
# repo/    - checkout git (branch main); o backend corre directo daqui via PM2
# app/     - build do frontend, servido por app.saldesk.cv
# website/ - site estatico, servido por saldesk.cv
# uploads/ - ficheiros enviados, servido por api.saldesk.cv/uploads/
# app/ e website/ NAO sao o mesmo directorio que repo/frontend/dist e
# repo/website -- deploy/deploy.sh publica explicitamente para aqui.
echo "[9/10] A criar estrutura de diretorios..."
mkdir -p /var/www/saldesk/repo
mkdir -p /var/www/saldesk/app
mkdir -p /var/www/saldesk/website/discover
mkdir -p /var/www/saldesk/uploads
mkdir -p /var/log/saldesk

# Permissoes
chown -R saldesk:saldesk /var/www/saldesk
chmod -R 755 /var/www/saldesk

# --- 10. Clonar repositorio ---
echo "[10/10] Estrutura pronta."
echo ""
echo "=============================================="
echo " Setup concluido!"
echo " Proximos passos:"
echo " 1. cd /var/www/saldesk/repo"
echo " 2. git clone <URL_DO_REPO> ."
echo " 3. Criar /var/www/saldesk/repo/backend/.env"
echo " 4. cp deploy/nginx/saldesk.conf /etc/nginx/sites-available/saldesk"
echo " 5. ln -s /etc/nginx/sites-available/saldesk /etc/nginx/sites-enabled/"
echo " 6. nginx -t && systemctl reload nginx"
echo " 7. certbot --nginx -d saldesk.cv -d www.saldesk.cv -d app.saldesk.cv -d api.saldesk.cv"
echo " 8. bash deploy/deploy.sh"
echo "=============================================="
