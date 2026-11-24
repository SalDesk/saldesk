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
];

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
