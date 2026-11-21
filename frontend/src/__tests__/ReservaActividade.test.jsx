/* Coluna de reserva da actividade: calendario (dias sem lugar riscados, mes vazio avanca uma vez),
   horarios (Restam N, Esgotado, um so fica escolhido), preco do servidor (/quote) e a seleccao
   entregue a onReservar. Mais a barra fixa do telemovel e a ligacao a pagina.
   Spec: docs/superpowers/specs/2026-11-21-pagina-servico-completa-design.md */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ReservaActividade from '../components/servico/ReservaActividade';
import ServiceDetail from '../pages/ServiceDetail';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="mapa">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }) => <div data-testid="marcador">{children}</div>,
  Popup: ({ children }) => <div>{children}</div>,
}));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };
const API = 'http://api.teste/api/v1';
/* 20 de novembro de 2026 ao meio-dia UTC: em Cabo Verde (UTC-1) o mes corrente e novembro de 2026 */
const AGORA = new Date('2026-11-20T12:00:00Z');

const UNIDADE = {
  id: 'u1', name: 'Passeio de buggy', description: '', unit_type: 'tour', base_price: 45, capacity: 8,
  images: [], pricing_rules: [], created_at: '2020-01-01T00:00:00Z', status: 'active',
};
const OPERADOR = {
  id: 'op1', name: 'Sal Aventura', slug: 'demo', operator_type: 'activity', currency: 'EUR',
  cover_images: [], page_config: {}, islands: { name: 'Sal', slug: 'sal' },
};
const COTACAO = { lines: [{ type: 'tour', description: 'Adultos', quantity: 2, total: 90 }], total: 90, before: null, error: null };

function resposta(corpo, ok = true) { return Promise.resolve({ ok, json: () => Promise.resolve(corpo) }); }

/* fetch por URL: meses { 'YYYY-MM': { dia: true } }, horarios { dia: [...] }, cotacao(params) */
/* falhar: { meses, horarios, cotacao } -- enquanto true, esse pedido falha (500, erro de rede ou
   429); o teste muda a flag para false antes de "Tentar de novo". */
function simularRede({ meses = { '2026-11': { '2026-11-25': true, '2026-11-27': true } }, horarios = {}, cotacao = () => COTACAO,
  unit = UNIDADE, op = OPERADOR, falhar = {} } = {}) {
  global.fetch = vi.fn((url) => {
    const u = String(url);
    const params = u.includes('?') ? new URLSearchParams(u.slice(u.indexOf('?') + 1)) : new URLSearchParams();
    if (u.includes('/availability-month')) {
      if (falhar.meses) return resposta({ error: 'Erro interno' }, false);
      const mes = params.get('month');
      return resposta({ data: { month: mes, days: meses[mes] || {} } });
    }
    if (u.includes('/slot-availability')) {
      if (falhar.horarios) return Promise.reject(new TypeError('Failed to fetch'));
      return resposta({ data: horarios[params.get('date')] || [] });
    }
    if (u.includes('/quote')) {
      if (falhar.cotacao) return resposta({ error: 'Demasiados pedidos' }, false);
      return resposta({ data: cotacao(params) });
    }
    if (u.includes('/traveler-auth/session')) return resposta({}, false);
    if (u.endsWith('/units/u1/reviews')) return resposta({ data: [] });
    if (u.endsWith('/units/u1')) return resposta({ data: { unit, operator: op, related: [], recent_bookings: 0 } });
    return resposta({ data: [] });
  });
}
const chamadas = (parte) => global.fetch.mock.calls.map(([u]) => String(u)).filter((u) => u.includes(parte));

const comMeta = (meta, extra = {}) => ({ ...UNIDADE, description: JSON.stringify(meta), ...extra });

function montarColuna(props = {}) {
  const unit = props.unit || UNIDADE;
  return render(
    <ReservaActividade api={API} slug="demo" unit={unit} meta={props.meta || {}} lang={props.lang || 'pt'}
      formatarPreco={(v) => `€${v}`} desde={props.desde || { valor: 45, porGrupo: false }} temPrivado={!!props.temPrivado}
      onReservar={props.onReservar || (() => {})}/>
  );
}

function montarPagina() {
  return render(
    <MemoryRouter initialEntries={['/book/demo/servico/u1']} future={FUTURE}>
      <Routes><Route path="/book/:slug/servico/:id" element={<ServiceDetail />} /></Routes>
    </MemoryRouter>
  );
}

const dia = (d) => document.querySelector(`[data-dia="${d}"]`);
const esperarCalendario = () => waitFor(() => expect(dia('2026-11-25') || dia('2026-12-03')).not.toBeNull());
async function esperarDiaLivre(d) {
  await waitFor(() => expect(dia(d)).not.toHaveAttribute('aria-disabled'));
  return dia(d);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(AGORA);
  localStorage.clear();
  localStorage.setItem('sd-lang', 'pt');
  Element.prototype.scrollTo = vi.fn();
  window.scrollTo = vi.fn();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Coluna de reserva da actividade', () => {
  it('calendario_risca_dias_sem_lugar', async () => {
    simularRede();
    montarColuna();
    const livre = await esperarDiaLivre('2026-11-25');
    expect(livre).not.toHaveClass('line-through');
    const riscado = dia('2026-11-26');
    expect(riscado).toHaveAttribute('aria-disabled', 'true');
    expect(riscado).toHaveClass('line-through');
    expect(dia('2026-11-01')).toHaveAttribute('aria-disabled', 'true');
    /* clicar num dia riscado nao escolhe nada */
    fireEvent.click(riscado);
    expect(riscado).toHaveAttribute('aria-pressed', 'false');
    expect(chamadas('/availability-month')[0]).toContain('month=2026-11&pax=2&mode=per_person');
    expect(screen.getByText('Novembro de 2026')).toBeInTheDocument();
  });

  it('mes_inicial_em_hora_de_cabo_verde', async () => {
    /* 1 de dezembro as 00:30 UTC ainda e 30 de novembro em Cabo Verde */
    vi.setSystemTime(new Date('2026-12-01T00:30:00Z'));
    simularRede();
    montarColuna();
    await esperarDiaLivre('2026-11-25');
    expect(chamadas('/availability-month')[0]).toContain('month=2026-11');
  });

  it('mes_vazio_avanca_uma_vez', async () => {
    simularRede({ meses: { '2026-12': { '2026-12-03': true } } });
    montarColuna();
    await esperarDiaLivre('2026-12-03');
    expect(screen.getByText('Dezembro de 2026')).toBeInTheDocument();
    expect(chamadas('/availability-month')).toHaveLength(2);
    cleanup();

    simularRede({ meses: {} });
    montarColuna();
    expect(await screen.findByText('Sem datas disponíveis neste mês')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    const meses = chamadas('/availability-month');
    expect(meses).toHaveLength(2);
    expect(meses[0]).toContain('month=2026-11');
    expect(meses[1]).toContain('month=2026-12');
  });

  it('restam_n_e_esgotado', async () => {
    simularRede({ horarios: { '2026-11-25': [
      { time: '09:00', capacity: 10, remaining: 3, privateAvailable: false },
      { time: '14:00', capacity: 10, remaining: 0, privateAvailable: false },
      { time: '16:00', capacity: 10, remaining: 0, privateAvailable: false, started: true },
      { time: '18:00', capacity: 10, remaining: 10, privateAvailable: true },
    ] } });
    montarColuna({ meta: { time_slots: [{ time: '09:00' }, { time: '14:00' }, { time: '16:00' }, { time: '18:00' }] } });
    fireEvent.click(await esperarDiaLivre('2026-11-25'));
    const horarios = await screen.findByTestId('horarios');
    await within(horarios).findByText('Restam 3');
    const h = (t) => horarios.querySelector(`[data-horario="${t}"]`);
    expect(h('09:00')).toBeEnabled();
    expect(within(h('14:00')).getByText('Esgotado')).toBeInTheDocument();
    expect(h('14:00')).toBeDisabled();
    expect(within(h('16:00')).getByText('Esgotado')).toBeInTheDocument();
    expect(h('16:00')).toBeDisabled();
    expect(within(h('18:00')).queryByText(/Restam|Esgotado/)).toBeNull();
    expect(horarios).toHaveAttribute('aria-live', 'polite');
  });

  it('um_so_horario_fica_escolhido', async () => {
    simularRede({ horarios: { '2026-11-25': [
      { time: '09:00', capacity: 10, remaining: 10, privateAvailable: true },
      { time: '14:00', capacity: 10, remaining: 0, privateAvailable: false },
    ] } });
    montarColuna({ meta: { time_slots: [{ time: '09:00' }, { time: '14:00' }] } });
    fireEvent.click(await esperarDiaLivre('2026-11-25'));
    await waitFor(() => expect(document.querySelector('[data-horario="09:00"]')).toHaveAttribute('aria-pressed', 'true'));
    await waitFor(() => expect(screen.getByRole('button', { name: /Reservar/ })).toBeEnabled());
  });

  it('mudar_pessoas_recarrega_calendario', async () => {
    simularRede();
    montarColuna();
    await esperarDiaLivre('2026-11-25');
    expect(chamadas('/availability-month')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Mais adultos' }));
    await waitFor(() => expect(chamadas('/availability-month')).toHaveLength(2));
    expect(chamadas('/availability-month')[1]).toContain('month=2026-11&pax=3&mode=per_person');
    fireEvent.click(screen.getByRole('button', { name: 'Mais crianças' }));
    await waitFor(() => expect(chamadas('/availability-month')).toHaveLength(3));
    expect(chamadas('/availability-month')[2]).toContain('pax=4');
  });

  it('preco_vem_da_cotacao', async () => {
    simularRede({
      unit: comMeta({ price_child: 20 }),
      cotacao: (p) => (p.get('children') === '1'
        ? { lines: [{ type: 'tour', description: 'Adultos', quantity: 2, total: 90 }, { type: 'children', description: 'Crianças', quantity: 1, total: 20 }], total: 110, before: null, error: null }
        : COTACAO),
    });
    montarPagina();
    const coluna = await screen.findByTestId('coluna-reserva');
    const preco = within(coluna).getByTestId('preco-reserva');
    expect(preco).toHaveAttribute('aria-live', 'polite');
    expect(await within(preco).findAllByText('€90')).toHaveLength(2); /* linha e total */
    fireEvent.click(within(coluna).getByRole('button', { name: 'Mais crianças' }));
    expect(await within(preco).findByText('€110')).toBeInTheDocument();
    expect(within(preco).getByText('Crianças × 1')).toBeInTheDocument();
    expect(within(preco).getByText('€20')).toBeInTheDocument();
    const cotacoes = chamadas('/quote');
    expect(cotacoes[cotacoes.length - 1]).toContain('/public/demo/units/u1/quote?adults=2&children=1&mode=per_person');
    /* o cabecalho mostra o preco "Desde" por pessoa com o mesmo formatador da pagina */
    expect(within(coluna).getByText('€45')).toBeInTheDocument();
    expect(within(coluna).getByText(/por pessoa/)).toBeInTheDocument();
  });

  it('cotacao_espera_300ms_entre_mudancas', async () => {
    simularRede();
    montarColuna();
    await waitFor(() => expect(chamadas('/quote')).toHaveLength(1));
    const mais = screen.getByRole('button', { name: 'Mais adultos' });
    fireEvent.click(mais);
    fireEvent.click(mais);
    fireEvent.click(mais);
    await waitFor(() => expect(chamadas('/quote')).toHaveLength(2));
    await new Promise((r) => setTimeout(r, 350));
    expect(chamadas('/quote')).toHaveLength(2);
    expect(chamadas('/quote')[1]).toContain('adults=5');
  });

  it('erro_da_cotacao_bloqueia_reservar', async () => {
    simularRede({ cotacao: () => ({
      lines: [{ type: 'tour', description: 'Adultos', quantity: 2, total: 90 }], total: 90, before: null,
      error: { code: 'CAPACITY_EXCEEDED', message_pt: 'Este grupo excede a lotação desta actividade', message_en: "This group exceeds this activity's capacity" },
    }) });
    montarColuna();
    fireEvent.click(await esperarDiaLivre('2026-11-25'));
    expect(await screen.findByText('Este grupo excede a lotação desta actividade')).toBeInTheDocument();
    expect(dia('2026-11-25')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Reservar/ })).toBeDisabled();
  });

  it('voucher_invalido_mostra_erro_sem_bloquear', async () => {
    simularRede({ cotacao: (p) => (p.get('voucher')
      ? { ...COTACAO, error: { code: 'INVALID_VOUCHER', message_pt: 'Código expirado', message_en: 'Invalid code' } }
      : COTACAO) });
    const onReservar = vi.fn();
    montarColuna({ onReservar });
    fireEvent.click(await esperarDiaLivre('2026-11-25'));
    fireEvent.change(screen.getByPlaceholderText('Código de desconto'), { target: { value: 'velho' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(await screen.findByText('Código expirado')).toBeInTheDocument();
    expect(chamadas('/quote').pop()).toContain('voucher=VELHO');
    const reservar = screen.getByRole('button', { name: /Reservar/ });
    await waitFor(() => expect(reservar).toBeEnabled());
    fireEvent.click(reservar);
    expect(onReservar.mock.calls[0][0].voucher).toBeNull();
  });

  it('reservar_entrega_a_seleccao', async () => {
    const COM_DESCONTO = {
      lines: [{ type: 'tour', description: 'Tour privado', quantity: 3, total: 300 }, { type: 'discount', description: 'Código VERAO', quantity: 1, total: -30 }],
      total: 270, before: 300, error: null,
    };
    simularRede({
      horarios: { '2026-11-25': [
        { time: '09:00', capacity: 10, remaining: 10, privateAvailable: true },
        { time: '14:00', capacity: 10, remaining: 4, privateAvailable: false },
      ] },
      cotacao: (p) => (p.get('voucher') === 'VERAO' && p.get('mode') === 'private' ? COM_DESCONTO : COTACAO),
    });
    const onReservar = vi.fn();
    montarColuna({
      onReservar, temPrivado: true,
      meta: { time_slots: [{ time: '09:00' }, { time: '14:00' }], languages: ['Português', 'English'], price_private: 300 },
    });
    expect(screen.getByRole('heading', { name: /Escolha a opção/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Quem vem\?/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Escolha a data e a hora/ })).toBeInTheDocument();
    const reservar = screen.getByRole('button', { name: /Reservar/ });
    expect(reservar).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Privado / grupo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mais crianças' }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'English' } });
    fireEvent.click(await esperarDiaLivre('2026-11-25'));
    /* privado: so 09:00 esta livre (14:00 ja tem gente), por isso fica escolhido sozinho */
    await waitFor(() => expect(document.querySelector('[data-horario="09:00"]')).toHaveAttribute('aria-pressed', 'true'));
    expect(within(document.querySelector('[data-horario="14:00"]')).getByText('Indisponível')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Código de desconto'), { target: { value: ' verao ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(await screen.findByText('Código VERAO')).toBeInTheDocument();
    await waitFor(() => expect(reservar).toBeEnabled());
    fireEvent.click(reservar);

    expect(onReservar).toHaveBeenCalledTimes(1);
    expect(onReservar).toHaveBeenCalledWith({
      date: '2026-11-25', time: '09:00', adults: 2, children: 1, mode: 'private', language: 'English', voucher: 'VERAO',
      quote: { lines: COM_DESCONTO.lines, total: 270, before: 300 },
    });
  });

  it('sem_os_dois_precos_nao_ha_passo_de_opcao', async () => {
    simularRede();
    montarColuna();
    expect(screen.queryByRole('heading', { name: /Escolha a opção/ })).toBeNull();
    /* o numero do passo e visual (aria-hidden): sem a opcao, os passos sao 1 e 2 */
    expect(screen.getByRole('heading', { name: 'Quem vem?' })).toHaveTextContent(/^1Quem vem\?$/);
    expect(screen.getByRole('heading', { name: 'Escolha a data e a hora' })).toHaveTextContent(/^2Escolha/);
    await esperarCalendario();
  });

  it('setas_movem_entre_os_dias', async () => {
    simularRede();
    montarColuna();
    const d25 = await esperarDiaLivre('2026-11-25');
    expect(d25).toHaveAttribute('tabindex', '0');
    d25.focus();
    fireEvent.keyDown(d25, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(dia('2026-11-26'));
    fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(dia('2026-11-30'));
    fireEvent.keyDown(document.activeElement, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(dia('2026-11-23'));
    fireEvent.keyDown(document.activeElement, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(dia('2026-11-22'));
    expect(dia('2026-11-22')).toHaveAttribute('tabindex', '0');
  });

  it('sem_preco_nenhum_reserva_por_pessoa_a_combinar', async () => {
    /* base_price 0 (preco em branco no TourForm) e sem preco privado: continua reservavel, como
       hoje, por pessoa e com o preco a combinar com o operador (nunca "Gratis" nem total 0) */
    const SEM_PRECO = { ...UNIDADE, base_price: 0 };
    simularRede({ unit: SEM_PRECO, cotacao: (p) => (p.get('mode') === 'private'
      ? { lines: [], total: 0, before: null, error: { code: 'INVALID_BOOKING_MODE', message_pt: 'Esta actividade não tem reserva privada disponível', message_en: 'x' } }
      : { lines: [{ type: 'tour', description: 'Adultos', quantity: 2, total: 0 }], total: 0, before: null, error: null }) });
    const onReservar = vi.fn();
    montarColuna({ unit: SEM_PRECO, desde: { valor: null, porGrupo: true }, onReservar });
    expect(screen.getByText('Consultar')).toBeInTheDocument();
    const preco = screen.getByTestId('preco-reserva');
    expect(await within(preco).findByText('Preço a combinar com o operador')).toBeInTheDocument();
    expect(within(preco).queryByText('Grátis')).toBeNull();
    expect(within(preco).queryByText('Total')).toBeNull();
    expect(chamadas('/quote')[0]).toContain('mode=per_person');
    const reservar = screen.getByRole('button', { name: /Reservar/ });
    expect(reservar).toBeDisabled();
    fireEvent.click(await esperarDiaLivre('2026-11-25'));
    expect(chamadas('/availability-month')[0]).toContain('mode=per_person');
    await waitFor(() => expect(reservar).toBeEnabled());
    fireEvent.click(reservar);
    expect(onReservar.mock.calls[0][0]).toMatchObject({ date: '2026-11-25', mode: 'per_person', adults: 2, quote: { total: 0 } });
    cleanup();

    simularRede({ unit: SEM_PRECO, cotacao: () => ({ lines: [{ type: 'tour', description: 'Adultos', quantity: 2, total: 0 }], total: 0, before: null, error: null }) });
    montarColuna({ unit: SEM_PRECO, desde: { valor: null, porGrupo: true }, lang: 'en' });
    expect(await within(screen.getByTestId('preco-reserva')).findByText('Price agreed with the operator')).toBeInTheDocument();
    await esperarCalendario();
  });

  it('em_ingles_rotula_as_linhas_pelo_tipo', async () => {
    simularRede({ cotacao: () => ({
      lines: [{ type: 'tour', description: 'Adultos', quantity: 2, total: 90 }, { type: 'children', description: 'Crianças', quantity: 1, total: 20 }],
      total: 110, before: null, error: null,
    }) });
    montarColuna({ lang: 'en' });
    const preco = screen.getByTestId('preco-reserva');
    expect(await within(preco).findByText('Adults × 2')).toBeInTheDocument();
    expect(within(preco).getByText('Children × 1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Who's coming\?/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Book/ })).toBeDisabled();
    await esperarCalendario();
  });
});

describe('Coluna de reserva quando a rede falha', () => {
  const SLOTS = [{ time: '09:00' }, { time: '14:00' }];
  const LIVRES = { '2026-11-25': [
    { time: '09:00', capacity: 10, remaining: 10, privateAvailable: true },
    { time: '14:00', capacity: 10, remaining: 10, privateAvailable: true },
  ] };

  it('falha_dos_horarios_mostra_erro_e_bloqueia_reservar', async () => {
    const falhar = { horarios: true };
    simularRede({ horarios: LIVRES, falhar });
    montarColuna({ meta: { time_slots: SLOTS } });
    fireEvent.click(await esperarDiaLivre('2026-11-25'));
    const horarios = await screen.findByTestId('horarios');
    expect(await within(horarios).findByText('Não foi possível carregar os horários')).toBeInTheDocument();
    /* a cotacao chega, mas sem horario a reserva continua bloqueada */
    await within(screen.getByTestId('preco-reserva')).findAllByText('€90');
    expect(screen.getByRole('button', { name: /Reservar/ })).toBeDisabled();
    expect(chamadas('/slot-availability')).toHaveLength(1);

    falhar.horarios = false;
    fireEvent.click(within(horarios).getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(horarios.querySelector('[data-horario="09:00"]')).not.toBeNull());
    expect(chamadas('/slot-availability')).toHaveLength(2);
    expect(within(horarios).queryByText('Não foi possível carregar os horários')).toBeNull();
    /* dois horarios livres: nenhum fica escolhido sozinho, Reservar so depois de escolher */
    expect(screen.getByRole('button', { name: /Reservar/ })).toBeDisabled();
    fireEvent.click(horarios.querySelector('[data-horario="14:00"]'));
    await waitFor(() => expect(screen.getByRole('button', { name: /Reservar/ })).toBeEnabled());
  });

  it('unidade_com_horarios_e_lista_vazia_continua_a_pedir_hora', async () => {
    simularRede({ horarios: {} });
    montarColuna({ meta: { time_slots: SLOTS } });
    fireEvent.click(await esperarDiaLivre('2026-11-25'));
    await waitFor(() => expect(chamadas('/slot-availability')).toHaveLength(1));
    await within(screen.getByTestId('preco-reserva')).findAllByText('€90');
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByRole('button', { name: /Reservar/ })).toBeDisabled();
  });

  it('falha_da_cotacao_mostra_erro_e_bloqueia_reservar', async () => {
    const falhar = { cotacao: true };
    simularRede({ falhar });
    montarColuna();
    fireEvent.click(await esperarDiaLivre('2026-11-25'));
    const preco = screen.getByTestId('preco-reserva');
    expect(await within(preco).findByText('Não foi possível calcular o preço')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reservar/ })).toBeDisabled();

    falhar.cotacao = false;
    fireEvent.click(within(preco).getByRole('button', { name: 'Tentar de novo' }));
    expect(await within(preco).findAllByText('€90')).toHaveLength(2);
    expect(within(preco).queryByText('Não foi possível calcular o preço')).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: /Reservar/ })).toBeEnabled());
  });

  it('falha_do_calendario_nao_diz_sem_datas', async () => {
    const falhar = { meses: true };
    simularRede({ falhar, meses: { '2026-11': { '2026-11-25': true } } });
    montarColuna();
    const calendario = screen.getByTestId('calendario');
    expect(await within(calendario).findByText('Não foi possível carregar as datas')).toBeInTheDocument();
    expect(within(calendario).queryByText('Sem datas disponíveis neste mês')).toBeNull();
    await new Promise((r) => setTimeout(r, 50));
    /* uma falha nao gasta o avanco automatico para o mes seguinte */
    expect(chamadas('/availability-month')).toHaveLength(1);
    expect(screen.getByText('Novembro de 2026')).toBeInTheDocument();
    expect(dia('2026-11-25')).toHaveAttribute('aria-disabled', 'true');
    expect(dia('2026-11-25')).not.toHaveClass('line-through');

    falhar.meses = false;
    fireEvent.click(within(calendario).getByRole('button', { name: 'Tentar de novo' }));
    await esperarDiaLivre('2026-11-25');
    expect(chamadas('/availability-month')).toHaveLength(2);
    expect(chamadas('/availability-month')[1]).toContain('month=2026-11');
    expect(within(calendario).queryByText('Não foi possível carregar as datas')).toBeNull();
  });

  it('falha_do_calendario_em_ingles', async () => {
    simularRede({ falhar: { meses: true } });
    montarColuna({ lang: 'en' });
    const calendario = screen.getByTestId('calendario');
    expect(await within(calendario).findByText('Could not load dates')).toBeInTheDocument();
    expect(within(calendario).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('mudar_pessoas_rapido_um_so_pedido_do_mes', async () => {
    simularRede();
    montarColuna();
    await esperarDiaLivre('2026-11-25');
    expect(chamadas('/availability-month')).toHaveLength(1);
    const mais = screen.getByRole('button', { name: 'Mais adultos' });
    fireEvent.click(mais);
    fireEvent.click(mais);
    fireEvent.click(mais);
    await waitFor(() => expect(chamadas('/availability-month')).toHaveLength(2));
    await new Promise((r) => setTimeout(r, 350));
    expect(chamadas('/availability-month')).toHaveLength(2);
    expect(chamadas('/availability-month')[1]).toContain('pax=5');
  });
});

describe('Pagina de actividade com a coluna de reserva', () => {
  it('barra_do_telemovel_leva_a_coluna', async () => {
    simularRede();
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    montarPagina();
    const barra = await screen.findByTestId('barra-reserva-movel');
    expect(barra).toHaveClass('lg:hidden');
    expect(within(barra).getByText('€45')).toBeInTheDocument();
    expect(barra).toHaveTextContent('Desde');
    fireEvent.click(within(barra).getByRole('button', { name: 'Ver disponibilidade' }));
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.instances[0]).toBe(document.getElementById('reserva'));
    expect(screen.queryByRole('button', { name: /Reservar Agora/ })).toBeNull();
    delete Element.prototype.scrollIntoView;
  });

  it('reservar_abre_o_modal_com_a_seleccao', async () => {
    simularRede({ unit: comMeta({ languages: ['Português', 'English'] }) });
    montarPagina();
    const coluna = await screen.findByTestId('coluna-reserva');
    fireEvent.click(within(coluna).getByRole('button', { name: 'Mais crianças' }));
    fireEvent.change(within(coluna).getByRole('combobox'), { target: { value: 'English' } });
    fireEvent.click(await esperarDiaLivre('2026-11-27'));
    const reservar = within(coluna).getByRole('button', { name: /Reservar/ });
    await waitFor(() => expect(reservar).toBeEnabled());
    fireEvent.click(reservar);
    /* a seleccao ja esta feita na coluna: o modal abre nos dados do cliente (passo 2) */
    expect(await screen.findByText('Passo 2 de 3')).toBeInTheDocument();
    expect(screen.getByText('Dados de contacto')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('João Silva'), { target: { value: 'Ana Lima' } });
    fireEvent.change(screen.getByPlaceholderText('joao@email.com'), { target: { value: 'ana@exemplo.cv' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    /* a data, as pessoas e o idioma escolhidos na coluna chegam a revisao do modal */
    const modal = (await screen.findByText('Resumo e pagamento')).closest('.fixed');
    expect(within(modal).getByText('2026-11-27')).toBeInTheDocument();
    expect(within(modal).getByText('2 adultos + 1 crianças')).toBeInTheDocument();
    expect(within(modal).getByText('English')).toBeInTheDocument();
  });

  it('servicedetail_sem_preco_revisao_a_combinar_e_so_pagamento_no_local', async () => {
    /* Actividade sem preco nenhum: a revisao do modal mostra "a combinar" (nunca total 0) e os
       pagamentos online (PayPal, Vinti4) nao aparecem -- nao ha nada para cobrar */
    simularRede({
      unit: { ...UNIDADE, base_price: 0 },
      cotacao: () => ({ lines: [{ type: 'tour', description: 'Adultos', quantity: 2, total: 0 }], total: 0, before: null, error: null }),
    });
    montarPagina();
    const coluna = await screen.findByTestId('coluna-reserva');
    fireEvent.click(await esperarDiaLivre('2026-11-25'));
    const reservar = within(coluna).getByRole('button', { name: /Reservar/ });
    await waitFor(() => expect(reservar).toBeEnabled());
    fireEvent.click(reservar);
    fireEvent.change(await screen.findByPlaceholderText('João Silva'), { target: { value: 'Ana Lima' } });
    fireEvent.change(screen.getByPlaceholderText('joao@email.com'), { target: { value: 'ana@exemplo.cv' } });
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    const modal = (await screen.findByText('Resumo e pagamento')).closest('.fixed');
    expect(within(modal).getByText('Preço a combinar com o operador')).toBeInTheDocument();
    expect(within(modal).queryByText('Grátis')).toBeNull();
    expect(within(modal).queryByText(/PayPal/)).toBeNull();
    expect(within(modal).queryByText(/Vinti4/)).toBeNull();
    expect(within(modal).getByText('Pagar presencialmente')).toBeInTheDocument();
  });
});
