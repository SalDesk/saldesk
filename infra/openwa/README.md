# OpenWA (camada de mensagens, fase 2)

Gateway de WhatsApp **não oficial**, só para uso interno da Wandr. Corre no VPS, isolado, em `/opt/openwa`.
Um operador cliente **nunca** o usa: o router (`backend/src/messaging/router.js`) só o devolve ao operador
`wandr-interno` (`WANDR_INTERNAL_OPERATOR_ID`) e só com `OPENWA_ENABLED=true`. Qualquer outro cai no `wa.me`.

## O que há

| Peça | Onde |
| --- | --- |
| Contentor `openwa` (imagem fixada por digest, v0.25.0) | `/opt/openwa/docker-compose.yml` (cópia em `infra/openwa/`) |
| Porta | só `127.0.0.1:2785`, sem Nginx |
| Socket do Docker | **não** montado |
| Dados e sessão do WhatsApp | volume `openwa_openwa-data` (`/app/data`) |
| Sessão | `wandr-internal` (id em `/opt/openwa/session-id`), número dedicado e descartável |
| Webhook de entrada | `POST /webhooks/whatsapp/openwa` no backend (porta 3001), só IP interno + assinatura HMAC; o Nginx devolve 404 a quem vem da internet |
| Operador interno | "Wandr Interno" (sem login, não conta como cliente nem na sincronização com a Wandr) |

Variáveis no `backend/.env`: `OPENWA_ENABLED`, `OPENWA_BASE_URL`, `OPENWA_API_KEY`, `OPENWA_SESSION_ID`,
`OPENWA_WEBHOOK_SECRET`, `WANDR_INTERNAL_OPERATOR_ID` (opcional: `OPENWA_ALERT_EMAIL`, por omissão `BCC_EMAIL`).

## Operação

- **Reiniciar o contentor ou o servidor:** a sessão fica `disconnected`. O worker detecta-o (verifica a cada ~5 min) e
  chama `start` sozinho; volta a `ready` em cerca de 1 minuto, sem novo código nem QR.
- **Ver o estado:** o worker alerta (log + email ao fundador, no máximo 1 por hora) se a sessão não estiver `ready`.
- **Ligar o número (primeira vez, ou se o WhatsApp o desligar):** o QR de imagem estática costuma expirar antes de ser lido.
  Usar o código de 8 caracteres: `POST /api/sessions/{id}/pairing-code` com `{"phoneNumber":"<so digitos com indicativo>"}`,
  mostrar o código logo e escrevê-lo em WhatsApp > Dispositivos ligados > Ligar um dispositivo > Ligar com número de telefone.
- **Chave de API:** gerada no primeiro arranque e guardada em `/app/data/.api-key`. **Não imprimir os logs de arranque**
  (trazem a chave). Se se expuser, apagar o volume só serve antes de ligar o número; depois, rodar a chave pela API.
- **Atualizar a versão:** `docker pull`, escolher o novo digest, testar numa sessão descartável e só então mudar o compose.

## Segurança

- Número de WhatsApp dedicado e descartável, nunca o comercial da Wandr nem o do fundador.
- O guarda anti-SSRF do OpenWA está ligado; só `host.docker.internal` está autorizado (`SSRF_ALLOWED_HOSTS`), porque é aí
  que corre o webhook do SalDesk.
- Risco assumido: o OpenWA pode ser banido ou perder a sessão a qualquer momento. Nada de produção para clientes depende dele.
