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
| RH | HR | Recursos humanos: o ecra "HR" com ferias, documentos e certificacoes da equipa. |
| Ferias / Licenca | Leave | Ausencias do colaborador ("Leave", "Leave request", "My leave"); o tipo "ferias" e "Annual leave", os outros "Sick leave", "Maternity leave"... |
| Direito a ferias | Leave entitlement | Dias de ferias a que o colaborador tem direito por ano ("Entitlement", "Set entitlement"). |
| Salario / Salarios | Salary / Salaries | O vencimento de um colaborador; a area de processamento em Financeiro e "Payroll" se aparecer. |
| Horario / Turno | Schedule / Shift | "Usual schedule" para os dias habituais de um colaborador; "Shift" para um turno com hora. |
| Documento | Document | Contratos e documentos de identificacao guardados na ficha do colaborador. |
| Certificacao | Certification | Formacao ou certificado de um colaborador ou guia ("Training and certifications"). |
| Checklist | Checklist | Lista de verificacao diaria do pessoal ("Today's checklist"). |
| Tarefa | Task | Tarefa do quadro do pessoal ("New task", "Tasks"). |
| Trabalho (atribuicao) | Job | Servico atribuido a um colaborador ou guia ("Next job", "12 jobs"); nao usar "Work". |
| Cargo / Funcao | Role | O cargo de um colaborador ("Role", "Maintenance", "Receptionist"). |
| Guia | Guide | Guia de actividades (menu "Guides"). |
| Vendedor de Praia | Beach Seller | O cargo e o modo de venda na praia ("Beach Sellers"). |
| Disponibilidade / Folga | Availability / Day off | Dias em que o colaborador pode trabalhar; "Day off" para folga. |
| Manutencao / Intervencao | Maintenance | Ecra "Maintenance" e cada registo feito numa viatura ("Record maintenance", "Maintenance history"); nao usar "Repair job". |
| Revisao (viatura) | Service | A revisao periodica de uma viatura ("Next service (km)"); o tipo gravado continua "Revisao". |
| Seguro / Inspecao / IUC | Insurance / Inspection / IUC | Documentos da viatura com validade; IUC e nome oficial e nao se traduz. |
| Ocorrencia / Ocorrencias | Incident / Incidents | Registo de algo que correu mal na operacao (menu "Incidents", "Log incident"); nao usar "Occurrence". |
| Severidade | Severity | Gravidade de uma ocorrencia: Low, Medium, High, Critical. |
| Frota e Equipamento | Fleet and equipment | Ecra da frota: viaturas (Vehicle), equipamento (Equipment) e material (Gear). |
| Meteorologia | Weather | Ecra da previsao do tempo ("7-day forecast", "Bad weather forecast for..."). |
| Limpeza de quartos | Housekeeping | Ecra "Housekeeping": estados Clean, Dirty, Being cleaned, Inspection, Blocked. |

## Regras

- Ingles britanico (`en-GB`): "programme", "optimise", "centralised"; datas e numeros pelo `en-GB`.
- Nomes de marcas e de planos nao se traduzem: SalDesk, Viator, GetYourGuide, WhatsApp, PayPal, SISP Vinti4,
  Booking.com, Airbnb, Starter, Pro, Business, Channel Manager.
- Valores guardados ou comparados no codigo (estados, categorias, cargos, metodos de pagamento) ficam em
  portugues; so o rotulo mostrado passa pela traducao.
- Alemao e holandes seguem os mesmos conceitos (Buchung / Boeking, Einheit / Eenheid, Kunde / Klant...).
