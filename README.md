# SalDesk

Plataforma SaaS de gestão turística para operadores da Ilha do Sal, Cabo Verde.

## Módulos

| Módulo | Descrição |
|---|---|
| Reservas | Motor de reserva (admin + página pública) + calendário |
| CRM | Clientes criados automaticamente, histórico, notas |
| Automações | Emails/WhatsApp automáticos por gatilho (cron horário) |
| Financeiro | Receita, ocupação, comparativos, exportação PDF |

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Tailwind CSS + Zustand + React Router 6 |
| Backend | Node.js 20 + Express 4 |
| Base de dados | PostgreSQL via Supabase |
| Auth | Supabase Auth (JWT) |
| Email | SendGrid |
| WhatsApp | Twilio |
| Hosting | Vercel (frontend) + Railway (backend) |

## Pré-requisitos

- Node.js 20+
- Conta Supabase (gratuita)
- Conta SendGrid (gratuita até 100 emails/dia)
- Conta Twilio (sandbox gratuito para WhatsApp)

## Desenvolvimento local

### 1. Base de dados

Executar os ficheiros SQL no Supabase SQL Editor, por ordem:

```
database/001_fase1_schema.sql
database/002_fase2_schema.sql
database/003_fase3_schema.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env   # preencher com as suas keys
npm install
npm run dev            # http://localhost:3001
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

### 4. Testes

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test
```

## Estrutura de pastas

```
saldesk/
├── backend/
│   └── src/
│       ├── config/         # Supabase clients
│       ├── helpers/        # Lógica pura (booking, financeiro, customer, email, WhatsApp)
│       ├── middleware/     # Auth, requireOperator, errorHandler
│       ├── controllers/    # Toda a lógica de negócio
│       ├── routes/         # Express routers
│       ├── services/       # Cron de automações
│       └── __tests__/      # Testes unitários (Jest)
│
├── frontend/
│   └── src/
│       ├── components/     # auth, calendar, crm, financial, layout, reservations, ui, automations
│       ├── hooks/          # usePageTitle
│       ├── pages/          # Uma página por módulo
│       ├── services/       # Chamadas API
│       └── store/          # Zustand (auth, toast)
│
└── database/
    ├── 001_fase1_schema.sql
    ├── 002_fase2_schema.sql
    └── 003_fase3_schema.sql
```

## Deploy

Ver [DEPLOY.md](DEPLOY.md) para instruções completas.

## Página pública de reservas

Cada operador tem uma página pública acessível em:
```
https://SEU_DOMINIO.vercel.app/book/[slug-do-operador]
```
