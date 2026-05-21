# SalDesk v2 — Guia de Deploy Completo

**Infraestrutura:** Hostinger VPS KVM 2 (Ubuntu 22.04 LTS) + Supabase + SendGrid + Twilio

---

## Indice

1. [Supabase — Base de dados](#1-supabase)
2. [Hostinger VPS — Comprar e aceder](#2-hostinger-vps)
3. [Setup do servidor](#3-setup-do-servidor)
4. [Clonar repositorio](#4-clonar-repositorio)
5. [Variaveis de ambiente](#5-variaveis-de-ambiente)
6. [Nginx — Configurar dominios](#6-nginx)
7. [SSL — Let's Encrypt](#7-ssl)
8. [Primeiro deploy](#8-primeiro-deploy)
9. [Verificar todos os fluxos](#9-verificacao)
10. [DNS — Apontar dominios](#10-dns)
11. [Actualizacoes futuras](#11-actualizacoes)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Supabase

### 1.1 Criar projecto

1. Aceder a [supabase.com](https://supabase.com) e criar conta
2. **New Project** — nome: `saldesk-prod`, regiao: EU West
3. Guardar a password da base de dados num local seguro

### 1.2 Executar migrations (por ordem)

No **SQL Editor** do Supabase, executar cada ficheiro por ordem:

```
database/001_fase1_schema.sql        — operators, units, pricing_rules, blocked_dates
database/002_fase2_schema.sql        — reservations, customers
database/003_fase3_schema.sql        — automations, automation_logs, leads
database/004_fase2_v2_operators.sql  — campos adicionais em operators (slug, plano)
database/005_fase5_channels.sql      — operator_channels, integration_logs
database/006_fase5_staff.sql         — staff, staff_availability, job_assignments
database/007_fase5_messages.sql      — messages, message_groups
database/008_fase5_fleet.sql         — fleet, fleet_assignments
database/009_fase6_reviews.sql       — reviews
database/010_fase8_cms.sql           — cms_featured, cms_banners, cms_experiences, cms_events, cms_articles
```

> Copiar o conteudo de cada ficheiro e colar no SQL Editor, depois clicar **Run**.

### 1.3 Obter credenciais

Em **Project Settings > API**:
- `SUPABASE_URL` — URL do projecto
- `SUPABASE_ANON_KEY` — chave publica (anon)
- `SUPABASE_SERVICE_KEY` — chave privada (service_role) — **manter secreta**

### 1.4 Storage (opcional — para logos dos operadores)

1. **Storage > New bucket** — nome: `logos`, visibilidade: **Public**
2. **Policies > New policy** — permitir INSERT/SELECT para utilizadores autenticados

---

## 2. Hostinger VPS

### 2.1 Comprar VPS

1. Aceder a [hostinger.com](https://hostinger.com)
2. **VPS Hosting > KVM 2** (2 vCPU, 8GB RAM, 100GB SSD)
3. Sistema operativo: **Ubuntu 22.04 LTS**
4. Regiao: Europe (mais proximo dos utilizadores europeus)

### 2.2 Primeiro acesso SSH

```bash
ssh root@IP_DO_SERVIDOR
```

O IP e fornecido no painel da Hostinger apos o VPS ficar activo.

---

## 3. Setup do servidor

### 3.1 Correr o script de setup

Copiar o script para o servidor e executar:

```bash
# No servidor, como root:
curl -o setup-vps.sh https://raw.githubusercontent.com/SEU_USER/saldesk/main/deploy/setup-vps.sh
chmod +x setup-vps.sh
./setup-vps.sh
```

Ou copiar manualmente via `scp`:

```bash
# No computador local:
scp deploy/setup-vps.sh root@IP_DO_SERVIDOR:/root/
ssh root@IP_DO_SERVIDOR
chmod +x /root/setup-vps.sh && /root/setup-vps.sh
```

O script instala automaticamente: Node.js 20, PM2, Redis, Nginx, Certbot, ufw, fail2ban.

### 3.2 Verificar instalacoes

```bash
node --version     # v20.x.x
npm --version      # 10.x.x
pm2 --version      # 5.x.x
redis-cli ping     # PONG
nginx -v           # nginx/1.18.x
certbot --version  # certbot 2.x.x
```

---

## 4. Clonar repositorio

```bash
cd /var/www/saldesk
git init
git remote add origin https://github.com/SEU_USER/saldesk.git
git pull origin main
```

Ou clonar directamente:

```bash
git clone https://github.com/SEU_USER/saldesk.git /var/www/saldesk
```

---

## 5. Variaveis de ambiente

### 5.1 Criar o ficheiro .env de producao

```bash
cp /var/www/saldesk/deploy/.env.production /var/www/saldesk/backend/.env
nano /var/www/saldesk/backend/.env
```

Preencher todos os valores (ver [deploy/.env.production](deploy/.env.production)).

### 5.2 Gerar chaves VAPID (push notifications)

```bash
cd /var/www/saldesk/backend
node -e "
  const wp = require('web-push');
  const k = wp.generateVAPIDKeys();
  console.log('VAPID_PUBLIC_KEY=' + k.publicKey);
  console.log('VAPID_PRIVATE_KEY=' + k.privateKey);
"
# Copiar os valores para o .env
```

Copiar o `VAPID_PUBLIC_KEY` tambem para o frontend:
```bash
# frontend/.env (criar se nao existir)
VITE_VAPID_PUBLIC_KEY=<valor_gerado>
```

### 5.3 Gerar ENCRYPTION_KEY

```bash
openssl rand -hex 32
# Copiar o output para ENCRYPTION_KEY no .env
```

### 5.4 Verificar que o .env nao e commitable

```bash
cat /var/www/saldesk/.gitignore | grep .env
# Deve aparecer: .env
```

---

## 6. Nginx

### 6.1 Activar a configuracao

```bash
# Copiar configuracao
cp /var/www/saldesk/deploy/nginx/saldesk.conf /etc/nginx/sites-available/saldesk

# Activar (symlink)
ln -s /etc/nginx/sites-available/saldesk /etc/nginx/sites-enabled/saldesk

# Remover configuracao default (opcional)
rm -f /etc/nginx/sites-enabled/default

# Testar configuracao
nginx -t

# Se OK, recarregar
systemctl reload nginx
```

### 6.2 Verificar

```bash
curl -I http://SEU_IP
# Deve responder 301 (redirect para HTTPS, mesmo sem SSL ainda)
```

---

## 7. SSL (Let's Encrypt)

### 7.1 Pre-requisito: DNS ja apontado

Os dominios devem resolver para o IP do VPS **antes** de correr o Certbot.
Ver [Secção 10 — DNS](#10-dns).

### 7.2 Emitir certificados

```bash
certbot --nginx \
  -d saldesk.cv \
  -d www.saldesk.cv \
  -d app.saldesk.cv \
  -d api.saldesk.cv \
  --email hello@saldesk.cv \
  --agree-tos \
  --no-eff-email
```

O Certbot actualiza automaticamente o `saldesk.conf` com os blocos SSL.

### 7.3 Renovacao automatica

```bash
# Testar renovacao
certbot renew --dry-run

# O cron de renovacao e instalado automaticamente pelo Certbot
# Verificar:
systemctl status certbot.timer
```

---

## 8. Primeiro deploy

```bash
cd /var/www/saldesk
chmod +x deploy/deploy.sh
bash deploy/deploy.sh
```

O script faz:
1. `git pull` — actualizar codigo
2. `npm install + npm run build` — compilar frontend
3. `npm install` — instalar dependencias backend
4. Copiar website estatico
5. `pm2 restart` — reiniciar API
6. Verificar health endpoint

### 8.1 Verificar PM2

```bash
pm2 status
pm2 logs saldesk-api
```

### 8.2 Definir role FUNDADOR

Apos o primeiro registo com o email do fundador, correr no Supabase SQL Editor:

```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "FUNDADOR"}'::jsonb
WHERE email = 'ritsdelgado@gmail.com';
```

Verificar que o acesso a `https://app.saldesk.cv/admin` funciona.

---

## 9. Verificacao

### 9.1 Checklist de fluxos criticos

Testar **manualmente** cada um:

```
[ ] https://saldesk.cv              — Landing page carrega
[ ] https://saldesk.cv/discover/    — Directorio carrega
[ ] https://app.saldesk.cv          — Dashboard redireciona para /login
[ ] https://app.saldesk.cv/register — Formulario de registo funciona
[ ] Registo de novo operador        — Email recebido (SendGrid)
[ ] Onboarding 5 passos             — Dados guardados no Supabase
[ ] Criar unidade                   — Aparece na lista
[ ] Criar reserva manual            — Status muda (pending → confirmed)
[ ] Motor publico                   — https://app.saldesk.cv/book/SLUG
[ ] Calendario                      — Grid carrega, bloqueio de datas
[ ] CRM — exportar CSV              — Ficheiro descarregado
[ ] Financeiro — export Excel       — Ficheiro descarregado
[ ] https://api.saldesk.cv/api/health — {"status":"ok","version":"2.0.0"}
```

### 9.2 Testar webhooks (Fase 5)

```bash
# Simular webhook Viator (sem HMAC em dev — nao chegara a processar)
curl -X POST https://api.saldesk.cv/api/v1/integrations/webhooks/viator \
  -H "Content-Type: application/json" \
  -d '{"event":"booking_new","booking":{"bookingRef":"TEST-001"}}'
# Deve responder: {"received":true}
```

### 9.3 Verificar logs

```bash
pm2 logs saldesk-api --lines 50
tail -f /var/log/nginx/error.log
tail -f /var/log/saldesk/api-error.log
```

---

## 10. DNS

### 10.1 Registos a criar no painel do dominio

| Tipo | Nome | Valor | TTL |
|------|------|-------|-----|
| A | `@` (saldesk.cv) | IP_DO_SERVIDOR | 300 |
| A | `www` | IP_DO_SERVIDOR | 300 |
| A | `app` | IP_DO_SERVIDOR | 300 |
| A | `api` | IP_DO_SERVIDOR | 300 |

### 10.2 Verificar propagacao DNS

```bash
# No computador local:
nslookup saldesk.cv
nslookup app.saldesk.cv
nslookup api.saldesk.cv

# Ou online: https://dnschecker.org
```

A propagacao pode demorar ate 24-48 horas (normalmente < 1h com TTL 300).

---

## 11. Actualizacoes futuras

Para cada nova versao do codigo:

```bash
ssh root@IP_DO_SERVIDOR
cd /var/www/saldesk
bash deploy/deploy.sh
```

O script faz git pull, rebuild e restart automaticamente.

### 11.1 Novas migrations de BD

Se houver novos ficheiros em `database/`, executar manualmente no SQL Editor do Supabase antes de fazer deploy.

### 11.2 Rollback de emergencia

```bash
cd /var/www/saldesk
git log --oneline -5          # Ver commits recentes
git checkout HASH_DO_COMMIT   # Voltar a versao anterior
bash deploy/deploy.sh         # Redeploy
```

---

## 12. Troubleshooting

### API nao responde

```bash
pm2 status                    # Ver estado dos processos
pm2 logs saldesk-api          # Ver logs de erro
pm2 restart saldesk-api       # Reiniciar
curl http://localhost:3001/api/health  # Testar localmente
```

### Nginx 502 Bad Gateway

```bash
# A API nao esta a correr
pm2 start ecosystem.config.js --env production
```

### Certificado SSL expirado

```bash
certbot renew
systemctl reload nginx
```

### Redis nao disponivel

```bash
systemctl status redis-server
systemctl start redis-server
redis-cli ping
```

### Espaco em disco

```bash
df -h
# Limpar logs antigos:
pm2 flush
journalctl --vacuum-size=100M
```

### Ver logs em tempo real

```bash
pm2 logs saldesk-api --lines 100 --raw
tail -f /var/log/nginx/access.log
tail -f /var/log/saldesk/deploy.log
```

---

## 13. Activar PayPal em modo Live

1. Criar app em [developer.paypal.com](https://developer.paypal.com) com modo **Live**
2. Copiar `Client ID` e `Secret`
3. Criar webhook apontando para `https://api.saldesk.cv/api/v1/payments/webhook/paypal`
4. Actualizar no `.env`:
   ```
   PAYPAL_CLIENT_ID=<live_client_id>
   PAYPAL_CLIENT_SECRET=<live_secret>
   PAYPAL_WEBHOOK_ID=<id_do_webhook>
   PAYPAL_MODE=live
   ```
5. `pm2 restart saldesk-api`

---

## 14. Activar SISP Vinti4

1. Contactar [sisp.cv](https://www.sisp.cv) para contrato de gateway de pagamento (processo: 2-6 semanas)
2. Apos aprovacao, preencher no `.env`:
   ```
   SISP_MERCHANT_ID=<id_real>
   SISP_API_KEY=<chave_real>
   SISP_API_URL=https://mc.vinti4net.cv/
   SISP_WEBHOOK_SECRET=<segredo_do_webhook>
   ```
3. `pm2 restart saldesk-api`

O sistema detecta automaticamente credenciais reais e desactiva o DEV_MODE de simulacao.

---

## Contacto

- Email: hello@saldesk.cv
- Deploy issues: verificar `/var/log/saldesk/` e `pm2 logs`
