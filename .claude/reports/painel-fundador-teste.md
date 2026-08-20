# Teste completo ao Painel do Fundador — relatório final

**Data:** 19 de Agosto de 2026
**Âmbito:** Dashboard, Operadores, Leads/Pipeline, CMS, Moderação Conect, Financeiro, Comunicação, Analytics, Impacto, Sistema.

---

## 🔴 Precisa da tua ação (não é um bug de código)

**A conta SendGrid excedeu a quota de envio** — erro real: `"Maximum credits exceeded"`.

Isto bloqueia **todos** os emails transaccionais em produção: recuperação de password, avisos de suspensão de conta, mensagens do admin para operadores, confirmações de reserva, o relatório mensal automático. A maioria destes falha silenciosamente (o erro é engolido no código); só apareceu visível porque testei especificamente o "Enviar mensagem" do admin, que é o único fluxo que não esconde o erro.

**Ação necessária:** resolver a quota/faturação no painel da SendGrid. Nenhuma correção de código resolve isto.

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
