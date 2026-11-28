import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import PageEditor from '../pages/PageEditor';
import useAuthStore from '../store/authStore';
import { updateOperator } from '../services/authService';
import useUiStore from '../store/uiStore';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

vi.mock('../services/authService', () => ({ updateOperator: vi.fn() }));

const HEX = /#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/;
const NOMEADAS = /(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border|fill|ring)-(?:green|yellow|blue|red|amber)-\d/;
const classes = (root) => [...root.querySelectorAll('[class]')].map(e => e.getAttribute('class')).join(' ');

const SECCOES_POR_OMISSAO = [
  ['featured', true], ['services', true], ['about', true], ['timeline', true], ['gallery', true], ['reviews', true],
  ['comparison', true], ['availability', true], ['contact', true], ['faq', true],
  ['partners', false], ['video_testimonials', false], ['google_reviews', false], ['instagram', false],
].map(([key, enabled]) => ({ key, enabled }));
const ROTULOS = ['Destaques', 'Serviços', 'Sobre Nós', 'Como Funciona', 'Galeria', 'Avaliações', 'Comparação de Serviços', 'Disponibilidade ao Vivo', 'Localização & Contacto', 'Perguntas Frequentes', 'Parceiros', 'Testemunhos em Vídeo', 'Avaliações Google', 'Instagram'];
const HORARIO_POR_OMISSAO = {
  seg: { open: true, start: '09:00', end: '18:00' }, ter: { open: true, start: '09:00', end: '18:00' }, qua: { open: true, start: '09:00', end: '18:00' },
  qui: { open: true, start: '09:00', end: '18:00' }, sex: { open: true, start: '09:00', end: '18:00' }, sab: { open: true, start: '09:00', end: '18:00' },
  dom: { open: false, start: '09:00', end: '18:00' },
};
const SOCIAL_VAZIO = { instagram: '', facebook: '', tripadvisor: '', google_maps: '', linkedin: '' };

let spyErr; let spyWarn;
beforeEach(() => {
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  updateOperator.mockReset().mockImplementation(async (dados) => ({ ...useAuthStore.getState().operator, ...dados }));
});
afterEach(() => {
  /* ler as contagens ANTES de restaurar os espioes */
  const erros = spyErr.mock.calls.map(c => String(c[0]).slice(0, 200));
  const avisos = spyWarn.mock.calls.map(c => String(c[0]).slice(0, 200));
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
  useAuthStore.setState({ token: null, operator: null });
  expect(erros).toEqual([]);
  expect(avisos).toEqual([]);
});

function montar(operador = { id: 'op1', slug: 'demo' }) {
  useAuthStore.setState({ token: 'tok', operator: operador });
  return render(<PageEditor />);
}
const cartao = (titulo) => screen.getByText(titulo, { selector: 'h2' }).parentElement;
const etiquetas = () => [...cartao('Secções da página').querySelectorAll('p.flex-1')].map(p => p.textContent);
const linhaSeccao = (rotulo) => within(cartao('Secções da página')).getByText(rotulo, { selector: 'p' }).parentElement;
const interruptorSeccao = (rotulo) => linhaSeccao(rotulo).querySelector('button[role="switch"]');
const setasSeccao = (rotulo) => [...linhaSeccao(rotulo).querySelectorAll('button')].slice(0, 2);
const ativo = (btn) => btn.className.includes('bg-ocean-700');
const bloco = (titulo) => screen.getByText(titulo).parentElement.parentElement;
const botoesBloco = (titulo) => [...bloco(titulo).firstChild.querySelectorAll('button')];
const campoEm = (b, etiqueta) => within(b).getByText(etiqueta).parentElement.querySelector('input');
const campo = (etiqueta) => screen.getByText(etiqueta, { selector: 'label' }).parentElement.querySelector('input');
const linhaDia = (rotulo) => screen.getByText(rotulo, { selector: 'span' }).parentElement;
const botaoGuardar = () => screen.getByRole('button', { name: 'Guardar alterações' });
const ultimoPageConfig = () => updateOperator.mock.calls[updateOperator.mock.calls.length - 1][0].page_config;

/* ───────────────────────── caracterizacao ───────────────────────── */

describe('Editor da pagina: seccoes e esquema', () => {
  it('mostra_as_14_seccoes_por_omissao_com_as_10_primeiras_activas', () => {
    montar();
    expect(screen.getByText('Editor da Página Pública')).toBeInTheDocument();
    expect(etiquetas()).toEqual(ROTULOS);
    ROTULOS.forEach((r, i) => expect(ativo(interruptorSeccao(r))).toBe(i < 10));
  });

  it('usa_as_seccoes_guardadas_e_uma_chave_desconhecida_mostra_a_chave', () => {
    montar({ id: 'o', page_config: { sections: [{ key: 'faq', enabled: true }, { key: 'about', enabled: false }, { key: 'nova', enabled: true }] } });
    expect(etiquetas()).toEqual(['Perguntas Frequentes', 'Sobre Nós', 'nova']);
    expect(ativo(interruptorSeccao('Sobre Nós'))).toBe(false);
  });

  it('activar_e_mover_seccoes_com_as_setas_desactivadas_nos_extremos', () => {
    montar();
    expect(setasSeccao('Destaques')[0]).toBeDisabled();
    expect(setasSeccao('Instagram')[1]).toBeDisabled();
    fireEvent.click(setasSeccao('Destaques')[1]);
    expect(etiquetas().slice(0, 2)).toEqual(['Serviços', 'Destaques']);
    fireEvent.click(setasSeccao('Destaques')[0]);
    expect(etiquetas().slice(0, 2)).toEqual(['Destaques', 'Serviços']);
    fireEvent.click(interruptorSeccao('Galeria'));
    expect(ativo(interruptorSeccao('Galeria'))).toBe(false);
  });

  it('o_esquema_mostra_so_as_activas_pela_ordem_e_as_desactivadas_em_baixo', () => {
    montar();
    const esquema = within(cartao('Pré-visualização (esquema)'));
    expect(esquema.getByText('Navbar')).toBeInTheDocument();
    expect(esquema.getByText('Hero')).toBeInTheDocument();
    expect(esquema.getByText('Footer')).toBeInTheDocument();
    expect(esquema.getByText('Destaques')).toBeInTheDocument();
    expect(esquema.queryByText('Parceiros', { selector: 'div' })).not.toBeInTheDocument();
    expect(esquema.getByText('Desactivadas')).toBeInTheDocument();
    expect(esquema.getByText('Parceiros', { selector: 'span' })).toBeInTheDocument();
    fireEvent.click(interruptorSeccao('Destaques'));
    expect(esquema.queryByText('Destaques', { selector: 'div' })).not.toBeInTheDocument();
    expect(esquema.getByText('Destaques', { selector: 'span' })).toBeInTheDocument();
  });
});

describe('Editor da pagina: listas', () => {
  it('parceiros_adicionar_editar_mover_e_remover', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar parceiro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar parceiro' }));
    expect(screen.getByText('Parceiro 2')).toBeInTheDocument();
    expect(campoEm(bloco('Parceiro 1'), 'Nome')).toHaveValue('');
    fireEvent.change(campoEm(bloco('Parceiro 1'), 'Nome'), { target: { value: 'Hotel A' } });
    fireEvent.change(campoEm(bloco('Parceiro 1'), 'URL do logótipo'), { target: { value: 'https://l.test/a.png' } });
    fireEvent.change(campoEm(bloco('Parceiro 2'), 'Nome'), { target: { value: 'Hotel B' } });
    expect(botoesBloco('Parceiro 1')[0]).toBeDisabled();
    expect(botoesBloco('Parceiro 2')[1]).toBeDisabled();
    fireEvent.click(botoesBloco('Parceiro 1')[1]);
    expect(campoEm(bloco('Parceiro 1'), 'Nome')).toHaveValue('Hotel B');
    expect(campoEm(bloco('Parceiro 2'), 'Link (opcional)')).toHaveValue('');
    fireEvent.click(botoesBloco('Parceiro 1')[2]);
    expect(screen.queryByText('Parceiro 2')).not.toBeInTheDocument();
    expect(campoEm(bloco('Parceiro 1'), 'Nome')).toHaveValue('Hotel A');
  });

  it('videos_e_avaliacoes_adicionar_editar_e_remover', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar vídeo' }));
    fireEvent.change(campoEm(bloco('Vídeo 1'), 'URL do vídeo'), { target: { value: 'https://v.test/1' } });
    expect(campoEm(bloco('Vídeo 1'), 'URL da miniatura (opcional)')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar avaliação' }));
    fireEvent.change(campoEm(bloco('Avaliação 1'), 'Nome do autor'), { target: { value: 'Ana' } });
    fireEvent.change(campoEm(bloco('Avaliação 1'), 'Texto da avaliação'), { target: { value: 'Excelente' } });
    expect(campoEm(bloco('Avaliação 1'), 'URL da foto (opcional)')).toHaveValue('');
    fireEvent.click(botoesBloco('Vídeo 1')[2]);
    expect(screen.queryByText('Vídeo 1')).not.toBeInTheDocument();
    fireEvent.click(botoesBloco('Avaliação 1')[2]);
    expect(screen.queryByText('Avaliação 1')).not.toBeInTheDocument();
  });

  it('listas_guardadas_aparecem_com_os_valores', () => {
    montar({ id: 'o', page_config: { partners: [{ name: 'P', logo_url: 'l', url: 'u' }], video_testimonials: [{ url: 'v', thumbnail_url: 't' }], google_reviews: [{ author_name: 'A', author_photo: 'f', text: 'T' }] } });
    expect(campoEm(bloco('Parceiro 1'), 'URL do logótipo')).toHaveValue('l');
    expect(campoEm(bloco('Vídeo 1'), 'URL da miniatura (opcional)')).toHaveValue('t');
    expect(campoEm(bloco('Avaliação 1'), 'Nome do autor')).toHaveValue('A');
  });
});

describe('Editor da pagina: redes, horario, idiomas e GPS', () => {
  it('redes_sociais_mostram_os_valores_guardados_e_aceitam_edicao', () => {
    montar({ id: 'o', page_config: { social: { instagram: 'https://i.test', facebook: 'https://f.test' } } });
    expect(campo('Instagram')).toHaveValue('https://i.test');
    expect(campo('Facebook')).toHaveValue('https://f.test');
    expect(campo('TripAdvisor')).toHaveValue('');
    expect(campo('LinkedIn (opcional)')).toHaveAttribute('placeholder', 'https://linkedin.com/company/...');
    fireEvent.change(campo('Google Maps'), { target: { value: 'https://g.test' } });
    expect(campo('Google Maps')).toHaveValue('https://g.test');
  });

  it('horario_domingo_fechado_por_omissao_alternar_e_editar_as_horas', () => {
    montar();
    expect(linhaDia('Domingo')).toHaveTextContent('Fechado');
    expect(linhaDia('Domingo').querySelectorAll('input[type="time"]')).toHaveLength(0);
    const seg = linhaDia('Segunda');
    const [ini, fim] = seg.querySelectorAll('input[type="time"]');
    expect(ini).toHaveValue('09:00');
    expect(fim).toHaveValue('18:00');
    fireEvent.change(ini, { target: { value: '08:30' } });
    expect(linhaDia('Segunda').querySelectorAll('input[type="time"]')[0]).toHaveValue('08:30');
    fireEvent.click(linhaDia('Segunda').querySelector('button'));
    expect(linhaDia('Segunda')).toHaveTextContent('Fechado');
    fireEvent.click(linhaDia('Domingo').querySelector('button'));
    expect(linhaDia('Domingo').querySelectorAll('input[type="time"]')).toHaveLength(2);
  });

  it('idiomas_falados_PT_EN_por_omissao_e_alternar', () => {
    montar();
    const card = within(cartao('Idiomas falados'));
    const marcado = (l) => card.getByRole('button', { name: l }).className.includes('bg-ocean-700');
    expect(marcado('PT')).toBe(true);
    expect(marcado('EN')).toBe(true);
    expect(marcado('FR')).toBe(false);
    fireEvent.click(card.getByRole('button', { name: 'FR' }));
    expect(marcado('FR')).toBe(true);
    fireEvent.click(card.getByRole('button', { name: 'PT' }));
    expect(marcado('PT')).toBe(false);
  });

  it('lat_e_lng_por_omissao_e_editar', () => {
    montar();
    expect(campo('Latitude')).toHaveValue('16.8948');
    expect(campo('Longitude')).toHaveValue('-22.9144');
    fireEvent.change(campo('Latitude'), { target: { value: '16.5' } });
    expect(campo('Latitude')).toHaveValue('16.5');
    cleanup();
    montar({ id: 'o', page_config: { lat: 0, lng: 1.5 } });
    expect(campo('Latitude')).toHaveValue('0');
    expect(campo('Longitude')).toHaveValue('1.5');
  });
});

describe('Editor da pagina: guardar', () => {
  it('guardar_chama_updateOperator_com_page_config_exacto_por_omissao_e_setOperator', async () => {
    montar();
    fireEvent.click(botaoGuardar());
    await waitFor(() => expect(updateOperator).toHaveBeenCalledTimes(1));
    expect(ultimoPageConfig()).toEqual({
      sections: SECCOES_POR_OMISSAO, partners: [], video_testimonials: [], google_reviews: [], social: SOCIAL_VAZIO,
      opening_hours: HORARIO_POR_OMISSAO, spoken_languages: ['PT', 'EN'], lat: 16.8948, lng: -22.9144,
    });
    expect(Object.keys(updateOperator.mock.calls[0][0])).toEqual(['page_config']);
    expect(await screen.findByText('Guardado com sucesso')).toBeInTheDocument();
    expect(useAuthStore.getState().operator.page_config.spoken_languages).toEqual(['PT', 'EN']);
  });

  it('guardar_envia_as_alteracoes_e_lat_lng_invalidos_ou_zero_viram_null', async () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar parceiro' }));
    fireEvent.change(campoEm(bloco('Parceiro 1'), 'Nome'), { target: { value: 'Hotel A' } });
    fireEvent.click(interruptorSeccao('Destaques'));
    fireEvent.change(campo('Instagram'), { target: { value: 'https://i.test' } });
    fireEvent.click(within(cartao('Idiomas falados')).getByRole('button', { name: 'DE' }));
    fireEvent.change(campo('Latitude'), { target: { value: '0' } });
    fireEvent.change(campo('Longitude'), { target: { value: 'abc' } });
    fireEvent.click(botaoGuardar());
    await waitFor(() => expect(updateOperator).toHaveBeenCalled());
    const pc = ultimoPageConfig();
    expect(pc.partners).toEqual([{ name: 'Hotel A', logo_url: '', url: '' }]);
    expect(pc.sections[0]).toEqual({ key: 'featured', enabled: false });
    expect(pc.social.instagram).toBe('https://i.test');
    expect(pc.spoken_languages).toEqual(['PT', 'EN', 'DE']);
    expect(pc.lat).toBeNull();
    expect(pc.lng).toBeNull();
  });

  it('o_aviso_de_guardado_desaparece_apos_3s', async () => {
    montar();
    vi.useFakeTimers();
    fireEvent.click(botaoGuardar());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText('Guardado com sucesso')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(2999); });
    expect(screen.getByText('Guardado com sucesso')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.queryByText('Guardado com sucesso')).not.toBeInTheDocument();
  });

  it('falha_regista_console.error_e_nao_mostra_o_aviso', async () => {
    updateOperator.mockRejectedValue(new Error('x'));
    montar();
    fireEvent.click(botaoGuardar());
    await waitFor(() => expect(spyErr).toHaveBeenCalled());
    spyErr.mockClear();
    expect(screen.queryByText('Guardado com sucesso')).not.toBeInTheDocument();
  });

  it('ver_a_minha_pagina_so_com_slug', () => {
    montar();
    const a = screen.getByRole('link', { name: 'Ver a minha página' });
    expect(a).toHaveAttribute('href', '/book/demo');
    expect(a).toHaveAttribute('target', '_blank');
    cleanup();
    montar({ id: 'op2' });
    expect(screen.queryByRole('link', { name: 'Ver a minha página' })).not.toBeInTheDocument();
  });

  it('operador_sem_page_config_ou_nulo_nao_rebenta', () => {
    montar({ id: 'op2' });
    expect(etiquetas()).toEqual(ROTULOS);
    cleanup();
    montar(null);
    expect(etiquetas()).toEqual(ROTULOS);
  });
});

/* ───────────────────────── design system ───────────────────────── */

const semCoresForaDosTokens = (html) => {
  /* o hover vermelho do IconBtn (DELETE_HOVER) e o unico text-error permitido */
  html = html.replace(/hover:text-error/g, '');
  expect(html).not.toMatch(HEX);
  expect(html).not.toMatch(NOMEADAS);
  expect(html).not.toMatch(/(?:text|bg|border)-error/);
  expect(html).not.toMatch(/bg-red-/);
  expect(html).not.toMatch(/left-4\.5/);
};

describe('Editor da pagina: design system', () => {
  it('os_botoes_de_icone_das_seccoes_e_das_listas_tem_nome_acessivel', () => {
    montar();
    expect(screen.getByRole('button', { name: 'Mover Destaques para baixo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mover Serviços para cima' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar parceiro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar vídeo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar avaliação' }));
    ['Mover parceiro 1 para cima', 'Mover parceiro 1 para baixo', 'Remover parceiro 1', 'Mover vídeo 1 para baixo', 'Remover vídeo 1', 'Mover avaliação 1 para cima', 'Remover avaliação 1']
      .forEach(n => expect(screen.getByRole('button', { name: n })).toBeInTheDocument());
  });

  it('os_campos_das_listas_e_das_redes_tem_nome_acessivel', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar parceiro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar vídeo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar avaliação' }));
    ['Nome do parceiro 1', 'URL do logótipo do parceiro 1', 'Link do parceiro 1', 'URL do vídeo 1', 'URL da miniatura do vídeo 1',
      'Nome do autor da avaliação 1', 'URL da foto da avaliação 1', 'Texto da avaliação 1',
      'Instagram', 'Facebook', 'TripAdvisor', 'Google Maps', 'LinkedIn (opcional)', 'Latitude', 'Longitude'].forEach(n => expect(screen.getByLabelText(n)).toBeInTheDocument());
  });

  it('cada_seccao_tem_um_interruptor_com_nome_e_estado', () => {
    montar();
    ROTULOS.forEach((r, i) => {
      const sw = screen.getByRole('switch', { name: `Mostrar ${r}` });
      expect(sw).toHaveAttribute('aria-checked', i < 10 ? 'true' : 'false');
    });
    fireEvent.click(screen.getByRole('switch', { name: 'Mostrar Galeria' }));
    expect(screen.getByRole('switch', { name: 'Mostrar Galeria' })).toHaveAttribute('aria-checked', 'false');
  });

  it('o_interruptor_do_horario_e_um_switch_com_a_bola_na_posicao_certa_e_as_horas_tem_nome', () => {
    montar();
    const seg = screen.getByRole('switch', { name: 'Aberto Segunda' });
    expect(seg).toHaveAttribute('aria-checked', 'true');
    expect(seg.firstChild.className).toContain('left-[18px]');
    expect(screen.getByRole('switch', { name: 'Aberto Domingo' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch', { name: 'Aberto Domingo' }).firstChild.className).toContain('left-0.5');
    expect(screen.getByLabelText('Abertura de Segunda')).toHaveValue('09:00');
    expect(screen.getByLabelText('Fecho de Segunda')).toHaveValue('18:00');
    fireEvent.click(seg);
    expect(screen.getByRole('switch', { name: 'Aberto Segunda' })).toHaveAttribute('aria-checked', 'false');
  });

  it('os_idiomas_falados_tem_aria_pressed_e_o_aviso_role_status_com_tokens', async () => {
    montar();
    expect(screen.getByRole('button', { name: 'PT', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'FR', pressed: false })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'FR' }));
    expect(screen.getByRole('button', { name: 'FR', pressed: true })).toBeInTheDocument();
    fireEvent.click(botaoGuardar());
    const aviso = await screen.findByRole('status');
    expect(aviso.className).toContain('var(--success-light)');
    expect(aviso.className).toContain('var(--success)');
  });

  it('sem_cores_nomeadas_text_error_bg_error_bg_red_hexadecimais_ou_left_4_5_em_classes', async () => {
    const { container } = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar parceiro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar vídeo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar avaliação' }));
    fireEvent.click(botaoGuardar());
    await screen.findByRole('status');
    semCoresForaDosTokens(classes(container));
  });
});

/* ───────────────────────── estilo Mare ───────────────────────── */

const fichas = (el) => el.className.split(/\s+/);
const TITULOS_PT = ['Secções da página', 'Parceiros', 'Testemunhos em vídeo', 'Avaliações Google', 'Redes sociais',
  'Horário de funcionamento', 'Idiomas falados', 'Localização (coordenadas GPS)', 'Pré-visualização (esquema)'];

describe('Editor da pagina: estilo Mare', () => {
  it('mostra_o_eyebrow_da_area_Configuracao', () => {
    const { container } = montar();
    expect(container.querySelector('[data-eyebrow]')).toHaveTextContent('Configuração');
  });

  it('cada_bloco_e_um_cartao_Mare_com_titulo_h2', () => {
    montar();
    TITULOS_PT.forEach(t => {
      const h2 = screen.getByText(t, { selector: 'h2' });
      const cartaoEl = h2.parentElement;
      expect(cartaoEl.tagName).toBe('SECTION');
      ['bg-white', 'rounded-[18px]', 'border', 'border-mare-card', 'min-w-0'].forEach(c => expect(fichas(cartaoEl)).toContain(c));
      ['font-display', 'text-lg', 'font-semibold', 'text-ocean-900'].forEach(c => expect(fichas(h2)).toContain(c));
    });
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
  });

  it('as_setas_das_seccoes_tem_44px_no_telemovel_e_o_interruptor_do_horario_tambem', () => {
    montar();
    setasSeccao('Serviços').forEach(b => expect(fichas(b)).toContain('min-h-11'));
    const sw = screen.getByRole('switch', { name: 'Aberto Segunda' });
    expect(fichas(sw)).toContain('before:-inset-y-3.5');
    expect(fichas(sw)).toContain('focus-visible:ring-sand-500');
    ['Abertura de Segunda', 'Fecho de Segunda'].forEach(n => expect(fichas(screen.getByLabelText(n))).toContain('h-11'));
    expect(fichas(screen.getByRole('button', { name: 'FR' }))).toContain('min-h-11');
  });

  it('os_botoes_pequenos_avulsos_tem_44px_no_telemovel', () => {
    montar();
    ['Adicionar parceiro', 'Adicionar vídeo', 'Adicionar avaliação'].forEach(n => {
      expect(fichas(screen.getByRole('button', { name: n }))).toEqual(expect.arrayContaining(['min-h-11', 'md:min-h-0']));
    });
    expect(fichas(screen.getByRole('link', { name: 'Ver a minha página' }).querySelector('button'))).toContain('min-h-11');
  });

  it('remover_um_item_mantem_o_sinal_vermelho_e_os_botoes_de_item_tem_44px', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar parceiro' }));
    const remover = screen.getByRole('button', { name: 'Remover parceiro 1' });
    expect(fichas(remover)).toEqual(expect.arrayContaining(['hover:text-error', 'min-h-11', 'focus-visible:ring-sand-500']));
    expect(fichas(screen.getByRole('button', { name: 'Mover parceiro 1 para cima' }))).toContain('min-h-11');
    fireEvent.click(remover);
    expect(screen.queryByText('Parceiro 1')).not.toBeInTheDocument();
  });

  it('o_item_de_lista_e_a_pre_visualizacao_sao_caixas_internas_Mare', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar parceiro' }));
    ['rounded-[14px]', 'bg-mare-head', 'min-w-0'].forEach(c => expect(fichas(bloco('Parceiro 1'))).toContain(c));
    const caixa = screen.getByText('Navbar').parentElement;
    ['rounded-[14px]', 'bg-mare-head', 'overflow-hidden'].forEach(c => expect(fichas(caixa)).toContain(c));
  });

  it('nomes_longos_de_seccao_quebram_linha', () => {
    montar({ id: 'o', page_config: { sections: [{ key: 'uma-chave-muito-comprida-sem-espacos-nenhuns', enabled: true }] } });
    const p = screen.getAllByText('uma-chave-muito-comprida-sem-espacos-nenhuns', { selector: 'p' })[0];
    expect(fichas(p)).toEqual(expect.arrayContaining(['min-w-0', 'break-words']));
  });
});

/* ───────────────────────── lingua do painel ───────────────────────── */

describe('Editor da pagina: em ingles', () => {
  const CONTEUDO = {
    partners: [{ name: 'Câmara Municipal do Sal', logo_url: '', url: '' }],
    google_reviews: [{ author_name: 'João Silva', author_photo: '', text: 'Excelente passeio, recomendo!' }],
  };
  const DADOS_DO_OPERADOR = ['Câmara Municipal do Sal', 'João Silva', 'Excelente passeio, recomendo!'];

  /* desmonta antes de repor a lingua, para nao haver actualizacoes fora de act */
  afterEach(() => { cleanup(); useUiStore.setState({ lang: 'pt' }); });

  it('os_rotulos_do_editor_ficam_em_ingles_sem_portugues_nem_chaves_cruas', () => {
    useUiStore.setState({ lang: 'en' });
    montar({ id: 'o', slug: 'demo', page_config: CONTEUDO });
    expect(screen.getByText('Public page editor')).toBeInTheDocument();
    expect([...cartao('Page sections').querySelectorAll('p.flex-1')].map(p => p.textContent)).toEqual(['Highlights', 'Services', 'About Us', 'How It Works', 'Gallery', 'Reviews', 'Service Comparison', 'Live Availability', 'Location & Contact', 'Frequently Asked Questions', 'Partners', 'Video Testimonials', 'Google Reviews', 'Instagram']);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Open on Monday' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move Highlights up' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove partner 1' })).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();
    expect(portuguesNoEcra(DADOS_DO_OPERADOR)).toEqual([]);
    expect(chavesCruas(['pageEditor'])).toEqual([]);
  });

  it('o_que_o_operador_escreveu_mostra_se_tal_e_qual', () => {
    useUiStore.setState({ lang: 'en' });
    montar({ id: 'o', slug: 'demo', page_config: CONTEUDO });
    expect(screen.getByDisplayValue('Câmara Municipal do Sal')).toBeInTheDocument();
    expect(screen.getByDisplayValue('João Silva')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Excelente passeio, recomendo!')).toBeInTheDocument();
  });

  it('o_que_se_grava_e_igual_em_ingles_e_em_portugues', async () => {
    const gravado = {};
    for (const lang of ['pt', 'en']) {
      useUiStore.setState({ lang });
      updateOperator.mockClear();
      const { unmount } = montar({ id: 'o', slug: 'demo', page_config: CONTEUDO });
      fireEvent.click(screen.getByRole('switch', { name: lang === 'en' ? 'Open on Sunday' : 'Aberto Domingo' }));
      fireEvent.click(screen.getByRole('button', { name: lang === 'en' ? 'Save changes' : 'Guardar alterações' }));
      await waitFor(() => expect(updateOperator).toHaveBeenCalledTimes(1));
      gravado[lang] = ultimoPageConfig();
      unmount();
    }
    expect(gravado.en).toEqual(gravado.pt);
    expect(gravado.en.opening_hours.dom.open).toBe(true);
    expect(gravado.en.partners[0].name).toBe('Câmara Municipal do Sal');
    expect(gravado.en.sections.map(s => s.key)[0]).toBe('featured');
  });

  it('em_portugues_continua_igual', () => {
    montar();
    expect(screen.getByText('Editor da Página Pública')).toBeInTheDocument();
    expect(screen.getByText('Fechado')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Aberto Segunda' })).toBeInTheDocument();
  });
});
