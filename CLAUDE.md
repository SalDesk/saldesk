# SalDesk — Plataforma Operacional Turistica
# Ilha do Sal, Cabo Verde · v2.0 · 2025
# CLAUDE.md Definitivo — Todos os modulos

---

## Visao do Produto

A SalDesk e a plataforma operacional completa para operadores turisticos da Ilha do Sal,
Cabo Verde. Vai muito alem de um sistema de reservas — e o sistema central onde o negocio
inteiro vive: reservas directas, gestao de colaboradores, atribuicao de trabalho,
comunicacao interna, financas, pagamentos e canal directo com o cliente.

Missao: Eliminar a dependencia de plataformas externas (Booking.com, WhatsApp, Excel)
e centralizar todas as operacoes turisticas numa unica plataforma local.

Publico-alvo:
- Operadores de actividades (kitesurf, mergulho, tours, passeios)
- Empresas de rent-a-car
- Hoteis e pensoes (modulos seleccionados)
- Restaurantes (modulos seleccionados)
- Ilha do Sal, Cabo Verde — expansao para outras ilhas no Ano 2

Tres tipos de utilizador:
- GESTOR: dono do negocio — acesso total em app.saldesk.cv/dashboard
- COLABORADOR: guias, motoristas, instrutores — acesso limitado em app.saldesk.cv/staff
- FUNDADOR: administrador da plataforma — acesso em app.saldesk.cv/admin

---

## Stack Tecnologico

Frontend:
- React 18 (Vite)
- Tailwind CSS 3 (tokens de design customizados)
- Zustand (estado global)
- React Router 6
- Axios + React Query
- Recharts (graficos)
- date-fns (datas)
- socket.io-client (comunicacao em tempo real)
- web-push (notificacoes push PWA)

Backend:
- Node.js 20 + Express 4
- Supabase (PostgreSQL + Auth + Storage)
- SendGrid (emails)
- Twilio (WhatsApp + SMS)
- Bull Queue + Redis (filas de jobs)
- Socket.io (mensagens em tempo real)
- Web Push API (notificacoes push)
- PayPal SDK (pagamentos internacionais online)
- SISP Vinti4 (pagamentos com cartao cabo-verdiano — credenciais via contrato SISP)
- Axios (APIs externas)
- crypto (HMAC webhooks)
- node-cron (tarefas agendadas)
- puppeteer (exportacao PDF)
- exceljs (exportacao Excel)

Hosting:
- Hostinger VPS KVM 2 (Ubuntu 22.04 LTS)
- Nginx (proxy reverso + ficheiros estaticos)
- PM2 (gestor de processos)
- SSL: Let's Encrypt via Certbot
- Redis (local no servidor)
- Supabase (base de dados externo)

Dominios:
- saldesk.cv       -> Website institucional + directorio publico
- app.saldesk.cv   -> Dashboard gestor + vista colaborador + admin
- api.saldesk.cv   -> API REST

---

## Sistema de Design — Identidade Visual v1

REGRA ABSOLUTA: Nunca usar emojis. Usar apenas icones SVG Lucide Icons.

Paleta (tokens.css):
--ocean-900: #062A38  --ocean-700: #0D5470 (accao primaria)
--ocean-500: #1480A8  --ocean-50:  #EBF7FB
--sand-500:  #D4A82A (acento)  --sand-300: #EAD08A
--n900: #1A2332  --n500: #6B7280  --n200: #E5E8EC  --n50: #F9FAFB
--success: #1A7A4A  --error: #B91C1C  --warning: #B45309

Tipografia:
- Display: Sora 800, 48-72px, tracking -2px
- Heading 1: Sora 700, 32px
- Heading 2: Sora 600, 22px
- Body: DM Sans 400, 14px
- Mono/Label: DM Mono 400-500, 10-13px, uppercase

Lucide Icons: stroke 1.75px, tamanho 20px (UI) / 16px (inline), cor ocean-700

Google Fonts:
https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap

---

## Tipos de Operador e Modulos

operator_type: hotel | activity | rentacar | restaurant

Modulo             | hotel | activity | rentacar | restaurant
Reservas           |  Sim  |   Sim    |   Sim    |    Sim
CRM                |  Sim  |   Sim    |   Sim    |    Sim
Financeiro         |  Sim  |   Sim    |   Sim    |    Sim
Colaboradores      |  Nao  |   Sim    |   Sim    |    Nao
Atribuicao trabalho|  Nao  |   Sim    |   Sim    |    Nao
Comunicacao interna|  Nao  |   Sim    |   Sim    |    Nao
Frota/Equipamento  |  Nao  |   Sim    |   Sim    |    Nao
Pagamentos online  |  Sim  |   Sim    |   Sim    |    Sim
Avaliacoes         |  Sim  |   Sim    |   Sim    |    Sim
Channel Manager    |  Nao  |   Sim    |   Nao    |    Nao

---

## Base de Dados — Todas as Tabelas

operators:
id, name, operator_type, email, phone, whatsapp, address, logo_url,
plan (starter|business|pro), plan_status, trial_ends_at,
language, currency, timezone, booking_link_slug (UNIQUE),
paypal_customer_id, sisp_merchant_id, push_subscription (JSONB), created_at, updated_at

units:
id, operator_id, name, unit_type, description, capacity,
base_price, price_unit (night|hour|day|session|person),
images (TEXT[]), is_active, sort_order, created_at

reservations:
id, operator_id, customer_id, unit_id,
status (pending|confirmed|checked_in|checked_out|cancelled|no_show),
source (direct|booking_com|airbnb|viator|getyourguide|manual),
check_in, check_out, guests, total_amount, amount_paid,
payment_status (pending|paid|partial|refunded),
payment_method (paypal|sisp|cash|transfer), paypal_order_id, sisp_transaction_id,
currency, notes_internal, notes_guest, external_ref,
confirmation_sent_at, reminder_sent_at, review_request_sent_at,
created_at, updated_at

customers:
id, operator_id, first_name, last_name, email, phone, whatsapp,
nationality, country_code, language (pt|en|de|nl|fr|es),
notes, tags (TEXT[]), total_visits, total_spent,
loyalty_points, first_visit_at, last_visit_at, created_at

pricing_rules:
id, operator_id, unit_id, name,
start_date, end_date, price_override, price_multiplier, created_at

blocked_dates:
id, operator_id, unit_id, start_date, end_date, reason, created_at

automations:
id, operator_id,
trigger (on_booking|pre_checkin|post_checkout|review_request),
channel (email|whatsapp|both), delay_hours,
subject_pt, subject_en, subject_de, subject_nl,
body_pt, body_en, body_de, body_nl, is_active, created_at

staff:
id, operator_id, name, role, phone, email, whatsapp, photo_url,
status (active|inactive), push_subscription (JSONB),
total_jobs_completed, average_rating, created_at, updated_at

staff_availability:
id, staff_id, operator_id, date, is_available, notes, created_at

job_assignments:
id, reservation_id, staff_id, operator_id,
status (pending|confirmed|in_progress|completed|cancelled),
assigned_at, confirmed_at, started_at, completed_at,
notes_staff, notes_manager,
earnings_amount, earnings_paid, earnings_paid_at,
created_at, updated_at

messages:
id, operator_id,
sender_id, sender_type (manager|staff|system),
recipient_id, recipient_type (manager|staff|group),
group_id, content,
message_type (direct|group|system_notification),
notification_type (new_assignment|cancellation|reminder|general),
is_read, read_at, created_at

message_groups:
id, operator_id, name, description,
created_by, members (UUID[]), created_at, updated_at

reviews:
id, operator_id, reservation_id, customer_id,
staff_id (nullable), rating (1-5), comment,
reply_text, replied_at, is_public, created_at

fleet:
id, operator_id, name, type (vehicle|equipment|gear),
description, status (available|in_use|maintenance|retired),
last_maintenance_at, next_maintenance_at,
images (TEXT[]), notes, created_at, updated_at

fleet_assignments:
id, fleet_id, reservation_id, staff_id (nullable),
assigned_at, returned_at, notes, created_at

operator_channels:
id, operator_id, channel (viator|getyourguide),
api_key (encriptado), supplier_id, product_ids (TEXT[]),
is_active, last_sync_at, created_at

integration_logs:
id, operator_id, channel, event_type, payload (JSONB),
status (received|processed|failed), error_message,
external_ref, created_at

leads:
id, email, operator_type, language, source,
is_contacted, contacted_at, converted_at, created_at

cms_featured:
id, operator_id, position, is_active, starts_at, ends_at, created_at

cms_banners:
id, title, advertiser, image_url, link_url,
position (main|grid|footer), is_active, starts_at, ends_at, created_at

cms_experiences:
id, title_pt, title_en, description_pt, description_en,
includes_pt, includes_en, price_from, duration_days,
theme, is_active, sort_order, created_at

cms_events:
id, name_pt, name_en, description_pt, description_en,
event_date, event_type (festival|sport|culture|high_season),
is_active, created_at

cms_articles:
id, title_pt, title_en, excerpt_pt, excerpt_en,
content_pt, content_en, category,
is_featured, is_published, published_at, created_at

---

## API REST — Endpoints Principais

Base URL dev:  http://localhost:3001/api/v1
Base URL prod: https://api.saldesk.cv/api/v1

Auth:
POST /auth/login | POST /auth/register | GET /auth/me
POST /auth/staff/login

Reservas: GET|POST|PUT|DELETE /reservations | GET /reservations/calendar

Motor Publico (sem auth):
GET /public/:slug | GET /public/:slug/units
GET /public/:slug/availability | POST /public/:slug/reservations
POST /public/:slug/payment-intent | GET /public/:slug/reviews
GET /public/:slug/widget
GET /public/:slug/qrcode
GET /sitemap.xml
GET /robots.txt

Colaboradores: GET|POST|PUT|DELETE /staff/:id
GET /staff/:id/jobs | GET /staff/:id/earnings
PUT /staff/:id/availability | POST /staff/:id/push-subscription

Atribuicao:
GET|POST /assignments | PUT /assignments/:id/confirm
PUT /assignments/:id/start | PUT /assignments/:id/complete
GET /assignments/available-staff

Mensagens:
GET|POST /messages | PUT /messages/:id/read
GET|POST /messages/groups | POST /messages/groups/:id/members
GET /messages/unread-count

Pagamentos:
POST /payments/create-intent | POST /payments/confirm
GET /payments/history | POST /payments/refund
POST /payments/webhook/paypal
POST /payments/webhook/sisp

Avaliacoes:
GET /reviews | POST /reviews/request
PUT /reviews/:id/reply | GET /reviews/stats

Frota:
GET|POST|PUT|DELETE /fleet
POST /fleet/:id/assign | PUT /fleet/:id/return | GET /fleet/available

Marketing:
GET  /marketing/booking-link
GET  /marketing/qrcode
GET  /marketing/widget-code
POST /marketing/share-review/:id
GET  /marketing/stats

Push: POST /notifications/subscribe | DELETE /notifications/unsubscribe

Integracoes:
POST /integrations/viator/webhook | POST /integrations/gyg/webhook
POST /integrations/viator/connect | GET /integrations/status
POST /integrations/sync | GET /integrations/logs

Admin (apenas fundador):
GET /admin/stats | GET|PUT /admin/operators/:id/status
GET /admin/leads | GET /admin/revenue | GET /admin/logs
CRUD /admin/cms/featured | CRUD /admin/cms/banners
CRUD /admin/cms/experiences | CRUD /admin/cms/events | CRUD /admin/cms/articles

---

## Regras de Negocio Criticas

Reservas:
- Confirmacao automatica email + WhatsApp apos criacao
- Apos pagamento: atribuir colaborador (se activity/rentacar)
- Pedido de avaliacao 24h apos checkout

Colaboradores:
- Apenas activity e rentacar tem este modulo
- Colaborador so ve as suas proprias atribuicoes
- Push notification imediata apos atribuicao
- Ganhos calculados automaticamente por servico concluido

Comunicacao:
- Tempo real via Socket.io
- Tipos: directa (1:1), grupo (1:N), sistema (automatica)
- Notificacoes de sistema nao podem ser apagadas
- Contador de nao lidas no nav

Pagamentos:
- PayPal para pagamentos com cartao internacional na pagina publica
- SISP Vinti4 para pagamentos com cartao cabo-verdiano na pagina publica
- Turista escolhe o metodo na pagina de reserva
- Webhooks PayPal e SISP actualizam status da reserva automaticamente
- Gestor regista pagamentos manuais (dinheiro, transferencia)
- SISP requer contrato formal com sisp.cv (2-6 semanas)

Avaliacoes:
- Rating 1-5 + comentario opcional
- Avaliacao do operador E do colaborador especifico
- Gestor pode responder publicamente
- Media actualizada em tempo real

Multi-lingua:
- PT, EN, DE, NL na interface e emails automaticos
- Email enviado no idioma do cliente (baseado em country_code)

Push Notifications:
- PWA com Service Worker
- Colaboradores: nova atribuicao, cancelamento, lembrete 2h antes
- Gestores: nova reserva, pagamento confirmado, avaliacao recebida

SEO — Paginas Publicas:
- Meta tags completas (title, description, keywords)
- Open Graph para Instagram, Facebook e WhatsApp
- Twitter Card
- JSON-LD por tipo de operador (TouristAttraction, LodgingBusiness, RentAction, Restaurant)
- sitemap.xml dinamico
- robots.txt
- URLs canonicas

Ferramentas de Marketing:
- Link de reserva directa unico: saldesk.cv/book/:slug
- QR Code PNG descarregavel
- Widget embebivel HTML
- Partilha de avaliacoes para Instagram
- Dashboard de origem de trafego

Planos:
Starter  — 29 EUR/mes | 23 EUR/mes anual
Business — 59 EUR/mes | 47 EUR/mes anual
Pro      — 99 EUR/mes | 79 EUR/mes anual
Trial: 30 dias gratuitos, sem cartao

---

## Variaveis de Ambiente

SUPABASE_URL= | SUPABASE_ANON_KEY= | SUPABASE_SERVICE_KEY=
SENDGRID_API_KEY= | SENDGRID_FROM_EMAIL=noreply@saldesk.cv
TWILIO_ACCOUNT_SID= | TWILIO_AUTH_TOKEN= | TWILIO_WHATSAPP_FROM=
PAYPAL_CLIENT_ID= | PAYPAL_CLIENT_SECRET= | PAYPAL_WEBHOOK_ID=
PAYPAL_MODE=sandbox
SISP_MERCHANT_ID= | SISP_API_KEY= | SISP_API_URL= | SISP_WEBHOOK_SECRET=
VAPID_PUBLIC_KEY= | VAPID_PRIVATE_KEY= | VAPID_SUBJECT=mailto:admin@saldesk.cv
REDIS_URL=redis://localhost:6379
VIATOR_API_KEY= | VIATOR_WEBHOOK_SECRET=
GYG_API_KEY= | GYG_WEBHOOK_SECRET=
PORT=3001 | NODE_ENV=development
FRONTEND_URL=https://app.saldesk.cv | API_URL=https://api.saldesk.cv
ENCRYPTION_KEY=

---

## Sequencia de Desenvolvimento — 9 Fases

FASE 1 — Fundacao e Design System
FASE 2 — Reservas + Motor Publico + SEO
FASE 3 — CRM + Automacoes + Marketing
FASE 4 — Painel Financeiro
FASE 5 — Colaboradores + Atribuicao + Comunicacao + Push + Frota
FASE 6 — Pagamentos + Avaliacoes + Fidelizacao + DE/NL
FASE 7 — Channel Manager Viator + GYG
FASE 8 — Admin + CMS + Website
FASE 9 — Deploy Producao

---

## Notas Criticas

1. NUNCA usar emojis — apenas icones SVG Lucide
2. NUNCA escrever logica de negocio no frontend
3. NUNCA expor chaves privadas no frontend
4. SEMPRE verificar HMAC antes de processar webhooks
5. SEMPRE apresentar plano antes de escrever codigo
6. SEMPRE fazer commit apos cada fase concluida
7. Identidade visual v1 desde o primeiro componente
8. Vista /staff e mobile-first — optimizada para telefone
9. Socket.io necessario desde Fase 5 — confirmar Redis activo
10. PayPal em modo sandbox durante dev — producao na Fase 9
11. SISP requer contrato com sisp.cv — iniciar processo antes da Fase 6 (2-6 semanas)
12. Push notifications requerem HTTPS — testar em producao
13. Ficheiros i18n DE e NL criados na Fase 1, populados na Fase 6
