# Teste completo ao Painel do Fundador — relatório final

**Data:** 19 de Agosto de 2026
**Âmbito:** Dashboard, Operadores, Leads/Pipeline, CMS, Moderação Conect, Financeiro, Comunicação, Analytics, Impacto, Sistema.

---

## 🔴 Precisa da tua ação (não é um bug de código)

**A conta SendGrid excedeu a quota de envio** — erro real: `"Maximum credits exceeded"`.

Isto bloqueia **todos** os emails transaccionais em produção: recuperação de password, avisos de suspensão de conta, mensagens do admin para operadores, confirmações de reserva, o relatório mensal automático. A maioria destes falha silenciosamente (o erro é engolido no código); só apareceu visível porque testei especificamente o "Enviar mensagem" do admin, que é o único fluxo que não esconde o erro.

**Ação necessária:** resolver a quota/faturação no painel da SendGrid. Nenhuma correção de código resolve isto.

---

## Bugs reais corrigidos — 21 de Agosto de 2026 (Comunicação)

Retomei o teste ao painel do fundador pela secção **Comunicação**. Desta vez fui direto à base de
dados de produção verificar se as tabelas/colunas que o controller usa existem mesmo (ver
[[feedback-verify-schema-before-trusting]]), em vez de confiar na leitura do código — e encontrei
uma discrepância de esquema completa, não só um bug pontual:

1. **Chat directo — 100% partido.** O controller lê/escreve na tabela `admin_messages`, que
   **não existe** na base de dados. Todas as chamadas falhavam com "relation does not exist";
   o frontend engole o erro silenciosamente, então a aba parecia só "sem conversas" para sempre.
   Corrigido: criei a tabela (`operator_id`, `sender_type`, `content`, `is_read`, `read_at`,
   `created_at`), com RLS activo e sem policies (mesmo padrão de `admin_broadcasts`/`leads`).

2. **Broadcasts, Email marketing e Lançamento gravavam nas colunas erradas.** O código inseria
   `content`/`channel`/`subject`/`segment_plan`/`segment_type` em `admin_broadcasts`; a tabela real
   tem `message`/`type`/`target`/`target_filters`(jsonb)/`status` — nenhuma correspondência directa.
   Consequências reais antes da correcção:
   - **Broadcast in-app**: era mesmo enviado via websocket, mas o insert a seguir falhava sempre →
     admin via "Erro ao enviar" e o histórico nunca ficava gravado.
   - **Email marketing**: os emails eram mesmo enviados a todos os operadores-alvo **antes** do
     insert falhar → admin via erro e podia clicar "Enviar" outra vez, duplicando o envio a toda a
     audiência.
   - **Email de lançamento**: mesmo problema, mas sem `try/catch` no insert — o erro era engolido
     silenciosamente. Os emails à waitlist eram mesmo enviados, mas o histórico ficava sempre vazio.

   Corrigido: `admin_broadcasts` passou a receber as colunas certas para broadcasts in-app;
   `sendMarketingEmail` e `sendLaunchEmail` passaram a gravar em `admin_email_campaigns` (tabela já
   existente, vazia, com o esquema `subject`/`body`/`target`/`status` claramente feita para isto,
   mas nunca usada). Adicionei a coluna `target_filters` (jsonb) a essa tabela para não perder a
   segmentação por plano/tipo. `listBroadcasts` agora une as duas tabelas e normaliza para o
   formato que o frontend já espera, sem alterar nada no frontend.

3. **`sendLaunchEmail` também tinha um `select('email, nome, name')` na tabela `leads`**, mas a
   coluna `nome` não existe (só `name`) — a query falhava sempre, **antes** de qualquer email ser
   enviado. Ou seja, esta aba estava bloqueada por um erro imediato (o que, por acidente, evitava o
   problema de duplicação de envio acima até ser corrigido). Corrigido para `select('email, name')`.

Migração aplicada directamente à base de produção (Supabase project `qicqyqcnmlpynkuwkbpw`) e
verificada com um smoke test transaccional (insert + rollback nas 3 tabelas, confirmando que os
inserts do controller corrigido batem certo com o esquema real).

**Nota:** o envio real de emails (marketing/lançamento) continua sujeito ao bloqueio de quota da
SendGrid já reportado acima — a correcção de hoje garante que o histórico fica correcto e que não
há mais duplicação por retry, mas não desbloqueia o envio em si.

**Por confirmar ao vivo:** não consegui autenticar-me como fundador nesta ronda (mesmo bloqueio de
sessão expirada da ronda anterior). A correcção foi verificada por leitura de esquema + smoke test
SQL, não por clique no browser — falta o teste visual em como as 4 abas se comportam depois disto.

---

## Bugs reais corrigidos e já em produção

### Encontrados nesta ronda de testes ao painel do fundador

1. **Geografia do Analytics mostrava "1020 clientes" fictícios.** A query pedia uma coluna `nationality` que não existe em `customers` — falhava sempre, silenciosamente, caindo num fallback de dados simulados sem qualquer aviso ao fundador.
2. **Relatório mensal por email tinha sempre "Receita gerada: €0".** A mesma causa: seleccionava uma coluna `total_amount` que não existe em `reservations` (a real é `total_price`).
3. **Bug sistémico `total_amount` → `total_price` espalhado por 7 ficheiros.** Ao investigar o #2, encontrei a mesma coluna inexistente reutilizada por todo o código:
   - **Histórico de pagamentos** (Financeiro → Pagamentos): endpoint devolvia sempre erro 500.
   - **Registar pagamento manual**: devolvia sempre um falso "reserva não encontrada", mesmo com a reserva a existir — a funcionalidade nunca chegou a funcionar. Tinha também uma segunda coluna inexistente (`notes_internal`) que a impedia de gravar mesmo depois de corrigido o primeiro problema.
   - **Listagem de atribuições de equipa** (Reservas → Atribuição): endpoint devolvia erro 500.
   - **Calendário, Dashboard, Financeiro → Caixa, Portal do Vendedor**: todos mostravam sempre **€0** no valor da reserva, silenciosamente, sem erro visível.

   Todos corrigidos e reimplantados.

### Encontrados em rondas anteriores desta sessão (contexto)

- Nomes de quartos/mesas duplicavam-se a cada edição (`"101 — 101 — 101 — Nome"`).
- Página pública de detalhe de serviço estava partida para hotel/rent-a-car/restaurante (só funcionava por acaso para actividades) — mostrava "incluído" inventado e nunca mostrava Comodidades reais.
- Moderação Conect não permitia ver os detalhes de um item pendente antes de aprovar/rejeitar.
- Mudar o plano de um operador no admin não desbloqueava as funcionalidades numa sessão já aberta desse operador.
- "Último login" na lista de Operadores estava sempre vazio (lia uma tabela que nunca é escrita).

---

## Encontrado, fora de âmbito — apenas reportado

- **`GET /financial/transacoes` não existe no backend.** As abas "Transações" e "Caixa" do Financeiro chamam este endpoint, que nunca foi implementado — mostram sempre "Sem transacções", independentemente dos dados reais. Corrigi o nome do campo nessas duas abas (para quando o endpoint existir), mas construir o endpoint em si é uma funcionalidade nova com decisões de design próprias (que fontes agregar, que filtros), não uma correcção pontual — fica para decidires se e quando avançar.
- **Separador "Emails" do CMS admin** tem CRUD completo mas está desligado do envio real — os templates editados ali nunca são usados; os emails reais usam texto fixo no código.

---

## Por testar ao vivo (não confirmado no browser)

A sessão de teste do fundador expirou a meio da ronda e não consegui voltar a autenticar-me sem reset manual de password (bloqueado por segurança, correctamente). Fiz revisão de código em vez de teste ao vivo para:

- **Analytics → Relatório**: revisão confirma que usa dados já validados (Funil/Churn); sem bug de código encontrado, apenas o problema #2 já corrigido.
- **Impacto**: revisão confirma dados 100% reais (operadores, reservas, receita, crescimento) — sem bugs encontrados.
- **Sistema**: página extensa com controlos reais (reiniciar API via PM2, limpar cache Redis, bloquear IPs, logs, configurações) — revisão de código não encontrou bugs óbvios, mas não foi clicada ao vivo.

---

## Limpeza

Conta de teste `e2e.painelfundador.saldesk@gmail.com` eliminada da base de dados (sem registos órfãos noutras tabelas).
