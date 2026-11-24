import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { textosPortugueses, temPortugues } from './helpers/detectorPortugues';

/* Guarda contra texto portugues escrito directamente no codigo do painel do operador. Os ficheiros desta
   lista ja passaram todos os textos para i18n (useT / getT); se alguem voltar a escrever "Guardar" ou
   "Sem resultados" no JSX, o teste falha. As fases seguintes acrescentam ficheiros a lista.
   Caminhos relativos a frontend/src. O painel do fundador (pages/admin/*, AdminLayout.jsx) fica de fora.
   Limites por desenho do detector (ver helpers/detectorPortugues.js): uma palavra so, em minusculas, entre
   aspas e tratada como id e nao e vista; uma palavra com maiuscula, sem acento e fora de PALAVRAS_PORTUGUESAS
   passa. A guarda apanha o grosso; a revisao continua a ser precisa para o resto. */
export const FICHEIROS_CONVERTIDOS = [
  /* Moldura do painel: menu, barra de topo, pesquisa, navegacao movel */
  'components/layout/navConfig.js',
  'components/layout/Topbar.jsx',
  'components/layout/Sidebar.jsx',
  'components/layout/BottomNav.jsx',
  'components/layout/MoreDrawer.jsx',
  'components/layout/CommandPalette.jsx',
  'components/layout/Layout.jsx',
  'components/layout/PageHeader.jsx',
  /* Planos */
  'hooks/usePlan.js',
  'components/PlanGuard.jsx',
  /* Dashboard */
  'components/dashboard/AttentionPanel.jsx',
  'components/dashboard/DashboardHeader.jsx',
  'components/dashboard/DayAgenda.jsx',
  'components/dashboard/HeroCard.jsx',
  'components/dashboard/NextDaysStrip.jsx',
  'components/dashboard/Shortcuts.jsx',
  'components/dashboard/StatTiles.jsx',
  'components/dashboard/TrialStrip.jsx',
  'pages/dashboard/ActivityDashboard.jsx',
  'pages/dashboard/GenericDashboard.jsx',
  'pages/dashboard/HotelDashboard.jsx',
  'pages/dashboard/RentacarDashboard.jsx',
  'pages/dashboard/RestaurantDashboard.jsx',
  'pages/dashboard/ResumoView.jsx',
  'pages/dashboard/shared.jsx',
  'pages/dashboard/agendaLogic.js',
  'pages/dashboard/agendaTipos.js',
  'pages/dashboard/dashboardLogic.js',
  'pages/dashboard/useMolduraComum.js',
  /* Restos da moldura ja em i18n */
  'components/tour/WelcomeTour.jsx',
  'components/shared/LanguageToggle.jsx',
  'components/shared/Logo.jsx',
  /* Ja convertidos nas tarefas 1 a 3 */
  'utils/formatoLingua.js',
  'utils/mensagemErro.js',
  'components/ui/ConfirmDialog.jsx',
  'components/ui/Modal.jsx',
  'components/ui/Toast.jsx',
  'components/financial/KpiCard.jsx',
  'components/messaging/TemplatesEditor.jsx',
  'pages/settings/ContaTab.jsx',
  'pages/settings/SegurancaTab.jsx',
  /* Fase 4, tarefa 1: pessoal, RH, guias e portal do pessoal */
  'pages/staff/shared.jsx',
  'pages/staff/StaffForm.jsx',
  'pages/staff/KanbanBoard.jsx',
  'pages/staff/ChatTab.jsx',
  'pages/staff/ChecklistTab.jsx',
  'pages/staff/StaffCard.jsx',
  'pages/staff/SellerCard.jsx',
  'pages/Staff.jsx',
  'pages/StaffDetail.jsx',
  'pages/RH.jsx',
  'pages/Guides.jsx',
  'pages/StaffPortal.jsx',
  'components/shared/ExpiryBadge.jsx',
  'services/uploadService.js',
  /* Fase 4, tarefa 2: frota, manutencao, ocorrencias, meteorologia e limpezas */
  'pages/Fleet.jsx',
  'components/fleet/FleetSelector.jsx',
  'pages/Maintenance.jsx',
  'pages/Occurrences.jsx',
  'pages/Weather.jsx',
  'services/weatherService.js',
  'pages/Housekeeping.jsx',
  /* Fase 4, tarefa 3: financas, analises, previsao de procura e relatorio em PDF */
  'utils/rotuloMes.js',
  'pages/Financial.jsx',
  'pages/financial/shared.jsx',
  'pages/financial/CaixaTab.jsx',
  'pages/financial/ComissoesTab.jsx',
  'pages/financial/Comparativo.jsx',
  'pages/financial/CostEditModal.jsx',
  'pages/financial/DespesasTab.jsx',
  'pages/financial/ObrigacoesTab.jsx',
  'pages/financial/PorTourTab.jsx',
  'pages/financial/PrevisaoTab.jsx',
  'pages/financial/ReceitasManuaisTab.jsx',
  'pages/financial/ResultadoTab.jsx',
  'pages/financial/SalariosTab.jsx',
  'pages/financial/TransacoesTable.jsx',
  'components/financial/ChannelChart.jsx',
  'components/financial/MetricCard.jsx',
  'components/financial/PdfReport.jsx',
  'components/financial/RevenueChart.jsx',
  'components/financial/ServiceBarChart.jsx',
  'components/financial/SimpleChart.jsx',
  'components/financial/TopCustomersList.jsx',
  'components/financial/UnitTable.jsx',
  'pages/Analytics.jsx',
  'pages/Demand.jsx',
  /* Fase 4, tarefa 4: perfil, facturacao, registo e boas-vindas */
  'pages/Profile.jsx',
  'pages/BillingSuccess.jsx',
  'pages/BillingCancel.jsx',
  'pages/Register.jsx',
  'pages/Onboarding.jsx',
  'components/onboarding/OnboardingWizard.jsx',
  'components/onboarding/Step3Complete.jsx',
  /* Fase 2, tarefa 1: reservas, modais e manifesto */
  'pages/Reservations.jsx',
  'pages/reservations/shared.jsx',
  'pages/reservations/ActivityTable.jsx',
  'pages/reservations/RestaurantTable.jsx',
  'pages/reservations/RentacarTable.jsx',
  'pages/reservations/ColumnCards.jsx',
  'pages/reservations/DevolucaoModal.jsx',
  'pages/reservations/LevantamentoModal.jsx',
  'pages/reservations/NoShowModal.jsx',
  'pages/reservations/RescheduleModal.jsx',
  'pages/reservations/RestaurantCreateModal.jsx',
  'pages/reservations/ManifestoModal.jsx',
  'components/reservations/ReservationForm.jsx',
  'components/reservations/ReservationCard.jsx',
  'components/reservations/ReservationDetailModal.jsx',
  'components/reservations/StatusBadge.jsx',
  'components/assignments/AssignCompositeModal.jsx',
  /* Fase 2, tarefa 2: calendario */
  'pages/Calendar.jsx',
  'components/calendar/CalendarView.jsx',
  'components/calendar/rotulosCalendario.js',
  /* Fase 2, tarefa 3: formulario de actividade, editores, opcoes e ponto de encontro */
  'components/units/forms/TourForm.jsx',
  'components/units/forms/editors.jsx',
  'components/units/forms/OpcoesActividade.jsx',
  'components/units/forms/LocalizacaoPontoEncontro.jsx',
  /* Fase 2, tarefa 4: pagina de unidades, lista e formularios de quarto, viatura e mesa */
  'components/shared/ConectRow.jsx',
  'pages/Units.jsx',
  'components/units/UnitList.jsx',
  'components/units/UnitForm.jsx',
  'components/units/forms/HotelRoomForm.jsx',
  'components/units/forms/RentacarVehicleForm.jsx',
  'components/units/forms/RestaurantTableForm.jsx',
  'components/units/forms/GenericUnitForm.jsx',
  /* Fase 2, tarefa 5: vendedor de praia */
  'pages/BeachSeller.jsx',
  'pages/BeachSale.jsx',
  'pages/VendedorPerfil.jsx',
  'utils/formatoVendedor.js',
  /* Fase 3, tarefa 1: automacoes, feedback e avaliacoes */
  'pages/Automations.jsx',
  'components/automations/AutomationCard.jsx',
  'components/automations/AutomationForm.jsx',
  'components/automations/rotulosAutomacoes.js',
  'pages/Feedback.jsx',
  'pages/Reviews.jsx',
  'utils/formatoNota.js',
];

/* Textos escritos ao cliente: ficam em portugues em qualquer lingua do painel */
const MOTIVO_TEXTO_CLIENTE = 'mensagem enviada ao cliente, fica em portugues (nao-objectivo da especificacao)';
const MOTIVO_EXEMPLO = 'dados de exemplo do preview da mensagem ao cliente, que e escrita em portugues';

/* Valores portugueses que ficam no codigo de proposito, por ficheiro, com o motivo. */
export const PERMITIDOS = {
  'components/dashboard/NextDaysStrip.jsx': [
    { valor: 'Sáb', motivo: 'abreviatura do sabado na tabela DIA_SEMANA, que ja tem uma linha por lingua (pt/en/de/nl)' },
  ],
  'pages/staff/shared.jsx': [
    { valor: 'Vendedor de Praia', motivo: 'cargo gravado em staff.role e comparado no codigo (CARGO_VENDEDOR); o rotulo vem de staff.roles' },
    { valor: 'Empregado de Limpeza', motivo: 'cargo gravado em staff.role (ROLES_BY_TYPE); o rotulo vem de staff.roles' },
    { valor: 'Praia de Santa Maria', motivo: 'zona gravada em staff.seller_zone (SELLER_ZONES); o rotulo vem de staff.zones' },
    { valor: 'Confirmar reservas do dia', motivo: 'tarefa por omissao da checklist, guardada como texto no localStorage; o rotulo vem de staff.defaultTasks' },
    { valor: 'Briefing com a equipa', motivo: 'tarefa por omissao da checklist, guardada como texto no localStorage; o rotulo vem de staff.defaultTasks' },
    { valor: 'Verificar segurança e primeiros socorros', motivo: 'tarefa por omissao da checklist, guardada como texto no localStorage; o rotulo vem de staff.defaultTasks' },
    { valor: 'Comunicar horário de início ao grupo', motivo: 'tarefa por omissao da checklist, guardada como texto no localStorage; o rotulo vem de staff.defaultTasks' },
  ],
  'pages/financial/shared.jsx': [
    { valor: 'Venda ao balcao', motivo: 'categoria gravada em cada receita manual (MANUAL_REVENUE_CATEGORIES); o rotulo vem de financial.revenueCategories' },
    { valor: 'Comissao de parceiro', motivo: 'categoria gravada em cada receita manual (MANUAL_REVENUE_CATEGORIES); o rotulo vem de financial.revenueCategories' },
    { valor: 'Aluguer de equipamento', motivo: 'categoria gravada em cada receita manual (MANUAL_REVENUE_CATEGORIES); o rotulo vem de financial.revenueCategories' },
  ],
  'components/units/forms/TourForm.jsx': [
    { valor: 'Equipamento incluído', motivo: 'comodidade fixa de actividade gravada em portugues nos metadados da unidade (ACTIVITY_AMENS); o rotulo vem de unitForm.amenity' },
    { valor: 'Fotografias/Vídeo', motivo: 'comodidade fixa de actividade gravada em portugues nos metadados da unidade (ACTIVITY_AMENS); o rotulo vem de unitForm.amenity' },
    { valor: 'Snacks e água', motivo: 'comodidade fixa de actividade gravada em portugues nos metadados da unidade (ACTIVITY_AMENS); o rotulo vem de unitForm.amenity' },
    { valor: 'Vestiário', motivo: 'comodidade fixa de actividade gravada em portugues nos metadados da unidade (ACTIVITY_AMENS); o rotulo vem de unitForm.amenity' },
  ],
  'components/units/forms/HotelRoomForm.jsx': [
    { valor: 'Sem vista', motivo: 'vista do quarto gravada em portugues em meta.view (ROOM_VIEWS); o rotulo vem de unitForm.roomView' },
  ],
  'components/units/forms/RestaurantTableForm.jsx': [
    { valor: 'Terraço', motivo: 'comodidade gravada em portugues nos metadados da unidade e mostrada nas paginas publicas (RESTAURANT_AMENS); o rotulo vem de unitForm.amenities' },
    { valor: 'Acesso cadeira de rodas', motivo: 'comodidade gravada em portugues nos metadados da unidade e mostrada nas paginas publicas (RESTAURANT_AMENS); o rotulo vem de unitForm.amenities' },
    { valor: 'Música ao vivo', motivo: 'comodidade gravada em portugues nos metadados da unidade e mostrada nas paginas publicas (RESTAURANT_AMENS); o rotulo vem de unitForm.amenities' },
    { valor: 'Ambiente para crianças', motivo: 'comodidade gravada em portugues nos metadados da unidade e mostrada nas paginas publicas (RESTAURANT_AMENS); o rotulo vem de unitForm.amenities' },
  ],
  'components/units/forms/editors.jsx': [
    { valor: 'Passeio de Barco', motivo: 'categoria de actividade gravada em units.unit_type (UNIT_TYPES_BY_OPERATOR); o rotulo vem de unitForm.unitType' },
  ],
  'pages/Automations.jsx': [
    { valor: 'Confirmação de reserva', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'A sua reserva foi confirmada — {nome_tour}', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Olá {nome_cliente},\\n\\nA sua reserva de {nome_tour} em {data} às {hora} foi confirmada.\\n\\nPonto de encontro: {ponto_encontro}\\nGuia: {guia}\\n\\nLembre-se de trazer protector solar e vestuário confortável.\\n\\nObrigado por escolher a nossa empresa!', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Olá {nome_cliente}! Confirmamos a sua reserva de *{nome_tour}* em {data} às {hora}. Ponto de encontro: {ponto_encontro}. Guia: {guia}. Qualquer questão, estamos disponíveis!', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'O seu tour é em 7 dias — {nome_tour}', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Olá {nome_cliente},\\n\\nO seu tour {nome_tour} é em 7 dias, em {data} às {hora}.\\n\\nPonto de encontro: {ponto_encontro}\\nGuia: {guia}\\n\\nO que trazer:\\n- Vestuário confortável\\n- Protector solar e oculos de sol\\n- Água e snack leve\\n- Documento de identidade\\n\\nAte breve!', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Instruções D-3', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Instruções finais para o seu tour — {nome_tour}', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Olá {nome_cliente},\\n\\nO seu tour {nome_tour} é em apenas 3 dias!\\n\\n- Data: {data} às {hora}\\n- Ponto de encontro: {ponto_encontro}\\n- Guia: {guia}\\n\\nEm caso de cancelamento por mau tempo, entraremos em contacto com 24h de antecedência.\\n\\nAte breve!', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Olá {nome_cliente}! Lembrete: o seu tour *{nome_tour}* é amanhã em {data} às {hora}. Ponto de encontro: {ponto_encontro}. Guia: {guia}. Até amanhã!', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Pedido de avaliação', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Olá {nome_cliente},\\n\\nEsperamos que tenha tido uma experiência incrível no tour {nome_tour}!\\n\\nA sua opinião é muito importante para nós. Clique no link abaixo para deixar a sua avaliação:\\n\\n→ Avaliar o meu tour\\n\\nObrigado pela sua confiança!', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Um presente especial para si — {nome_tour}', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Olá {nome_cliente},\\n\\nObrigado por ter escolhido o tour {nome_tour}!\\n\\nComo agradecimento, temos um desconto especial de 10% para a sua próxima reserva. Use o código: VOLTA10\\n\\nValido por 30 dias. Reserve em: saldesk.cv\\n\\nEsperamos ve-lo em breve!', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Novidades e novos tours para si', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Olá {nome_cliente},\\n\\nJá passou um mês desde o seu tour {nome_tour}! Temos novidades incríveis:\\n\\n- Novos tours disponíveis para esta epoca\\n- Pacotes especiais de fim de semana\\n- Experiências exclusivas em Cabo Verde\\n\\nVeja todas as novidades e reserve em: saldesk.cv\\n\\nAte breve!', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'João Silva', motivo: MOTIVO_EXEMPLO },
    { valor: 'Praia de Santa Maria, Sal', motivo: MOTIVO_EXEMPLO },
  ],
  'pages/Feedback.jsx': [
    { valor: 'Como correu? Deixe a sua avaliação', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Olá {nome_cliente},\\n\\nObrigado por ter escolhido {nome_tour}. Esperamos que tenha corrido bem!\\n\\nA sua opinião ajuda-nos e ajuda outros viajantes a escolher. Demora menos de um minuto:\\n\\n{link_avaliacao}\\n\\nObrigado!', motivo: MOTIVO_TEXTO_CLIENTE },
  ],
  'components/automations/AutomationForm.jsx': [
    { valor: 'Olá {{nome}},\\n\\nA sua reserva em {{unidade}} está confirmada.\\n\\nCheck-in: {{check_in}}\\nCheck-out: {{check_out}}\\n\\nObrigado!', motivo: MOTIVO_TEXTO_CLIENTE },
  ],
};

const SRC = path.join(__dirname, '..');
const ler = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');
const permitidos = (rel) => (PERMITIDOS[rel] || []).map((p) => p.valor);

describe('o detector de portugues fixo', () => {
  it('apanha texto portugues em JSX', () => {
    expect(textosPortugueses('<p>Guardar alterações</p>')).toEqual(['Guardar alterações']);
  });

  it('ignora chaves de i18n', () => {
    expect(textosPortugueses("t('nav.dashboard')")).toEqual([]);
    expect(textosPortugueses('<p>{t(`plan.features.${f}`)}</p>')).toEqual([]);
  });

  it('ignora classes CSS', () => {
    expect(textosPortugueses("className='bg-ocean-50'")).toEqual([]);
    expect(textosPortugueses('<a className="no-underline text-n-500 md:block">{x}</a>')).toEqual([]);
  });

  it('ignora nomes de marcas', () => {
    expect(textosPortugueses("'SalDesk'")).toEqual([]);
    expect(textosPortugueses("const m = ['Booking.com', 'GetYourGuide e Viator'];")).toEqual([]);
  });

  it('ignora um valor da lista de permitidos, mas so esse', () => {
    const codigo = "const d = ['Dom', 'Sáb']; const x = 'Sábado';";
    expect(textosPortugueses(codigo, ['Sáb'])).toEqual(['Sábado']);
  });

  it('apanha atributos, palavras soltas com maiuscula e templates', () => {
    const codigo = [
      '<button aria-label="Fechar" />',
      '<input placeholder="Pesquisar…" />',
      'const s = `${n} reservas de hoje`;',
      "toast('Sem resultados');",
    ].join('\n');
    expect(textosPortugueses(codigo)).toEqual(['Fechar', 'Pesquisar…', 'reservas de hoje', 'Sem resultados']);
  });

  it('nao conta comentarios, ids em minusculas nem texto ingles', () => {
    const codigo = [
      '/* Sem resultados: mostra o vazio */',
      "// Guardar alterações",
      "setTab('reservas'); navigate('/reservas');",
      "const s = 'No results'; const k = 'Do this';",
    ].join('\n');
    expect(textosPortugueses(codigo)).toEqual([]);
  });

  it('um ficheiro so com chaves t() nao tem nada a apontar', () => {
    const codigo = "export default function X() { const t = useT(); return <p title={t('a.b')}>{t('c.d', { n })}</p>; }";
    expect(textosPortugueses(codigo)).toEqual([]);
  });

  it('apanha portugues que comeca com uma palavra pequena em maiuscula ou com verbos comuns sem acento', () => {
    const codigo = [
      '<p>Por favor aguarde</p>',
      '<p>Em breve</p>',
      '<p>Para continuar, inicie</p>',
      "toast('Bloquear dia');",
      '<p>Total pago</p>',
      '<button>Remover</button>',
      '<span>Carregar</span>',
      "const e = { label: 'Ativo' };",
    ].join('\n');
    expect(textosPortugueses(codigo)).toEqual([
      'Por favor aguarde', 'Em breve', 'Para continuar, inicie', 'Bloquear dia', 'Total pago', 'Remover', 'Carregar', 'Ativo',
    ]);
  });

  it('as palavras com maiuscula nao apanham ingles comum', () => {
    const codigo = "const a = ['No results', 'Do this', 'Coming soon', 'Total paid', 'On hold', 'Remove', 'Load more'];";
    expect(textosPortugueses(codigo)).toEqual([]);
  });

  it('palavras pequenas portuguesas e acentos', () => {
    expect(temPortugues('Plano Pro a partir de')).toBe(true);
    expect(temPortugues('Ecrãs')).toBe(true);
    expect(temPortugues('Search screens')).toBe(false);
  });
});

/* Locale escrito directamente: so os mapas LOCALES (um por lingua) o podem ter. */
export const PT_PT_PERMITIDO = {
  'utils/formatoLingua.js': 'mapa LOCALES: o locale de cada lingua do painel',
  'pages/dashboard/agendaLogic.js': 'mapa LOCALES das datas: o locale de cada lingua do painel',
};

describe('painel sem portugues fixo', () => {
  FICHEIROS_CONVERTIDOS.forEach((rel) => {
    it(`${rel} nao fixa o locale pt-PT`, () => {
      /* sem comentarios: so conta codigo */
      const codigo = ler(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      if (PT_PT_PERMITIDO[rel]) {
        /* so a linha do mapa LOCALES pode ter pt-PT */
        const fora = codigo.split(/\r?\n/).filter((l) => /pt-PT/.test(l) && !/\bpt:\s*'pt-PT'/.test(l));
        expect(fora).toEqual([]);
      } else {
        expect(codigo).not.toMatch(/pt-PT/);
      }
    });
  });

  FICHEIROS_CONVERTIDOS.forEach((rel) => {
    it(rel, () => {
      expect(textosPortugueses(ler(rel), permitidos(rel))).toEqual([]);
    });
  });

  it('o ingles segue o glossario: Booking, nunca Reservation', () => {
    const en = JSON.parse(ler('i18n/en.json'));
    const valores = (obj, p = '') => Object.entries(obj).flatMap(([k, v]) => (
      typeof v === 'string' ? [[`${p}${k}`, v]] : valores(v, `${p}${k}.`)
    ));
    expect(valores(en).filter(([, v]) => /reservation/i.test(v)).map(([k]) => k)).toEqual([]);
  });

  it('a lista nao tem ficheiros repetidos nem o painel do fundador', () => {
    expect(new Set(FICHEIROS_CONVERTIDOS).size).toBe(FICHEIROS_CONVERTIDOS.length);
    expect(FICHEIROS_CONVERTIDOS.filter((rel) => rel.startsWith('pages/admin/') || rel.endsWith('AdminLayout.jsx'))).toEqual([]);
  });

  it('os ficheiros da lista existem e os permitidos continuam no codigo, com motivo', () => {
    FICHEIROS_CONVERTIDOS.forEach((rel) => expect(fs.existsSync(path.join(SRC, rel))).toBe(true));
    Object.entries(PERMITIDOS).forEach(([rel, lista]) => {
      expect(FICHEIROS_CONVERTIDOS).toContain(rel);
      lista.forEach(({ valor, motivo }) => {
        expect(ler(rel).includes(valor)).toBe(true);
        expect(String(motivo || '').length).toBeGreaterThan(10);
      });
    });
  });
});
