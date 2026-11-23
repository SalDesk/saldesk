# Glossario ingles do painel do operador

Termos fixos para os textos ingleses (`frontend/src/i18n/en.json`) do painel do operador. Usar sempre
estes, em singular e plural, em todos os ecras; nao alternar com sinonimos. O portugues nao muda.

| Portugues | Ingles | Uso |
|---|---|---|
| Reserva / Reservas | Booking / Bookings | Qualquer reserva de um cliente (menu "Bookings", "New booking"); nunca "Reservation". |
| Unidade / Unidades | Unit / Units | Tour, quarto, viatura ou mesa que o operador vende; o menu mostra o nome do tipo (Tours & Activities, Rooms, Fleet, Tables). |
| Hospede / Pessoa | Guest / Guests | Quem participa ou fica alojado numa reserva (contagens de pessoas, chegadas). |
| Cliente / Clientes | Customer / Customers | A ficha de quem reserva no CRM (menu "Customers"); nao usar "Client". |
| Operador | Operator | A empresa que usa o SalDesk (outros operadores, parcerias entre operadores). |
| Voucher | Voucher | Codigo de desconto ou oferta emitido pelo operador; nao usar "Coupon". |
| Afiliado / Afiliados | Affiliate / Affiliates | Quem vende reservas em troca de comissao (programa de afiliados). |
| Colaboradores / Equipa | Staff | Pessoas que trabalham para o operador (menu "Staff", "staff member"); nao usar "Employees". |
| Dashboard | Dashboard | O ecra inicial do painel. |
| Definicoes | Settings | O ecra de configuracao da conta e do negocio (menu "Settings"). |
| Automacoes | Automations | Mensagens e tarefas automaticas (menu "Automations"). |
| Integracoes | Integrations | Ligacoes a plataformas externas; o item do menu chama-se "Channel Manager". |
| Frota | Fleet | As viaturas de um rent-a-car ou de um operador de actividades. |
| Plano | Plan | Subscricao do SalDesk (Starter, Pro, Business): "Pro plan", "Pro feature", "View subscription plans". |

## Regras

- Ingles britanico (`en-GB`): "programme", "optimise", "centralised"; datas e numeros pelo `en-GB`.
- Nomes de marcas e de planos nao se traduzem: SalDesk, Viator, GetYourGuide, WhatsApp, PayPal, SISP Vinti4,
  Booking.com, Airbnb, Starter, Pro, Business, Channel Manager.
- Valores guardados ou comparados no codigo (estados, categorias, cargos, metodos de pagamento) ficam em
  portugues; so o rotulo mostrado passa pela traducao.
- Alemao e holandes seguem os mesmos conceitos (Buchung / Boeking, Einheit / Eenheid, Kunde / Klant...).
