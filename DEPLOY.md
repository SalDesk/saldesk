# Guia de Deploy — SalDesk

## 1. Supabase (base de dados + auth)

1. Criar projeto em [supabase.com](https://supabase.com)
2. Em **SQL Editor**, executar por ordem:
   - `database/001_fase1_schema.sql`
   - `database/002_fase2_schema.sql`
   - `database/003_fase3_schema.sql`
3. Em **Project Settings → API**, copiar:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (public)
   - `SUPABASE_SERVICE_KEY` (service_role — manter secreto)

---

## 2. Railway (backend)

1. Criar conta em [railway.app](https://railway.app)
2. **New Project → Deploy from GitHub repo**
3. Seleccionar o repositório, definir **Root Directory** como `backend/`
4. Em **Variables**, adicionar todas as variáveis de ambiente:

```
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://SEU_APP.vercel.app

SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

SENDGRID_API_KEY=SG.xxx
SENDGRID_FROM_EMAIL=noreply@seudominio.com

TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

5. Railway detecta `railway.toml` automaticamente — start command e health check já configurados
6. Após deploy, copiar o URL público do Railway (ex: `https://saldesk-backend.up.railway.app`)

---

## 3. Vercel (frontend)

1. Criar conta em [vercel.com](https://vercel.com)
2. **New Project → Import Git Repository**
3. Seleccionar o repositório, definir **Root Directory** como `frontend/`
4. **Framework Preset**: Vite
5. Editar `frontend/vercel.json` — substituir `SEU_APP.railway.app` pelo URL real do Railway:
```json
{
  "rewrites": [
    { "source": "/api/:path*",    "destination": "https://saldesk-backend.up.railway.app/api/:path*" },
    { "source": "/public/:path*", "destination": "https://saldesk-backend.up.railway.app/public/:path*" },
    { "source": "/:path*",        "destination": "/index.html" }
  ]
}
```
6. Deploy — sem variáveis de ambiente necessárias no frontend (tudo vai pelo proxy do vercel.json)

---

## 4. Actualizar CORS no Railway

Depois do deploy Vercel, voltar ao Railway e actualizar:
```
FRONTEND_URL=https://SEU_APP.vercel.app
```

---

## 5. SendGrid — configuração

1. Criar conta em [sendgrid.com](https://sendgrid.com)
2. **Settings → API Keys → Create API Key** (Full Access)
3. **Settings → Sender Authentication** — verificar o domínio de envio
4. Activar o remetente com o email em `SENDGRID_FROM_EMAIL`

---

## 6. Twilio WhatsApp — configuração

1. Criar conta em [twilio.com](https://twilio.com)
2. Em **Messaging → Try it out → Send a WhatsApp message**, activar o sandbox
3. Copiar `Account SID`, `Auth Token`, e o número sandbox (`whatsapp:+14155238886`)
4. Para produção, submeter template de mensagem para aprovação da Meta

---

## Checklist pós-deploy

- [ ] `/api/health` responde `{ status: "ok" }` no Railway
- [ ] Login funciona no Vercel
- [ ] Onboarding cria operador na BD
- [ ] Reserva pública cria registo com `source: "public"`
- [ ] Email de recepção chegou após reserva pública (verificar spam)
- [ ] Cron de automações regista em `automation_logs` após 1 hora

---

## Domínio personalizado (opcional)

**Vercel:** Project Settings → Domains → Add Domain

**Railway:** Service → Settings → Networking → Custom Domain

Actualizar `FRONTEND_URL` no Railway depois de adicionar o domínio Vercel.
