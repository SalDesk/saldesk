import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import SocialPlanner from '../pages/marketing/SocialPlanner';
import PostModal from '../pages/marketing/PostModal';

/* O Planeador esta escondido na pagina (sem separador): estes testes renderizam os modulos directamente. */

const HEX = /#[0-9A-Fa-f]{3,8}(?![0-9A-Za-z])/;
const NOMEADAS = /(?:^|[\s"'])(?:[a-z-]+:)?(?:text|bg|border|fill|ring)-(?:green|yellow|blue|red|amber)-\d/;
const classes = (root) => [...root.querySelectorAll('[class]')].map(e => e.getAttribute('class')).join(' ');
const semCoresForaDosTokens = (html) => {
  expect(html).not.toMatch(HEX);
  expect(html).not.toMatch(NOMEADAS);
  expect(html.replace(/text-error ml-0[.]5/g, '')).not.toMatch(/(?:text|bg|border)-error/);
  expect(html).not.toMatch(/bg-red-/);
};
const norm = (t) => t.replace(/\s/g, ' ');

/* hoje fixo: 15 de Novembro de 2026 (domingo, o dia 1 e domingo) a meio do dia */
const HOJE = '2026-11-15';
let spyErr; let spyWarn;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 15, 12, 0, 0));
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  /* ler as contagens ANTES de restaurar os espioes */
  const erros = spyErr.mock.calls.map(c => String(c[0]).slice(0, 200));
  const avisos = spyWarn.mock.calls.map(c => String(c[0]).slice(0, 200));
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  expect(erros).toEqual([]);
  expect(avisos).toEqual([]);
});

const post = (id, quando, extra = {}) => ({ id, text_pt: `Texto do post ${id}`, scheduled_at: quando, status: 'agendado', platform: 'instagram', ...extra });

function planner(posts, handlers = {}) {
  const h = { onAdd: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(), onMarkPublished: vi.fn(), ...handlers };
  const r = render(<SocialPlanner posts={posts} {...h} />);
  return { ...r, h };
}
const celulas = (c) => [...c.querySelectorAll('.h-16')];
const vazias = (c) => celulas(c).filter(e => /(^|\s)bg-n-50(\s|$)/.test(e.className));
const dias = (c) => celulas(c).filter(e => !/(^|\s)bg-n-50(\s|$)/.test(e.className));
const proximos = () => screen.getByText('Proximos posts').parentElement;
/* o primeiro ascendente do texto que contem botoes: a linha com os icones de editar e eliminar */
const linhaDoPost = (raiz, texto) => {
  let e = within(raiz).getByText(texto);
  while (e && !e.querySelector('button')) e = e.parentElement;
  return e;
};
const titulo = () => screen.getByText(/^(Janeiro|Fevereiro|Marco|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro) \d{4}$/).textContent;

/* ───────────────────────── caracterizacao: SocialPlanner ───────────────────────── */

describe('Planeador: calendario', () => {
  it('o_calendario_comeca_na_segunda_com_celulas_vazias_antes_do_dia_1', () => {
    const { container } = planner([]);
    expect(screen.getByText('Planeador de Social Media')).toBeInTheDocument();
    expect(titulo()).toBe('Novembro 2026');
    ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'].forEach(d => expect(screen.getByText(d)).toBeInTheDocument());
    expect(vazias(container)).toHaveLength(6);
    expect(dias(container)).toHaveLength(30);
    expect(dias(container)[14].className).toContain('bg-ocean-50');
    expect(within(dias(container)[14]).getByText('15').className).toContain('bg-ocean-700');
  });

  it('mudar_de_mes_com_as_setas_e_o_titulo_e_as_celulas_acompanham', () => {
    const { container } = planner([]);
    const botoes = screen.getAllByRole('button');
    fireEvent.click(botoes[2]);
    expect(titulo()).toBe('Dezembro 2026');
    expect(vazias(container)).toHaveLength(1);
    expect(dias(container)).toHaveLength(31);
    fireEvent.click(screen.getAllByRole('button')[1]);
    fireEvent.click(screen.getAllByRole('button')[1]);
    expect(titulo()).toBe('Outubro 2026');
    expect(vazias(container)).toHaveLength(3);
    expect(dias(container)).toHaveLength(31);
  });

  it('clicar_num_dia_chama_onAdd_com_a_data_e_Novo_post_com_null', () => {
    const { container, h } = planner([]);
    fireEvent.click(dias(container)[14]);
    expect(h.onAdd).toHaveBeenCalledWith(HOJE);
    fireEvent.click(dias(container)[0]);
    expect(h.onAdd).toHaveBeenLastCalledWith('2026-11-01');
    fireEvent.click(screen.getByRole('button', { name: 'Novo post' }));
    expect(h.onAdd).toHaveBeenLastCalledWith(null);
  });

  it('pontos_do_dia_ate_3_e_mais_N_acima', () => {
    const { container } = planner([
      post('a', `${HOJE}T08:00`), post('b', `${HOJE}T09:00`, { status: 'publicado' }),
      post('c', `${HOJE}T10:00`, { status: 'cancelado' }), post('d', `${HOJE}T11:00`), post('e', `${HOJE}T12:00`),
    ]);
    const celula = dias(container)[14];
    expect(celula.querySelectorAll('span.w-2.h-2.rounded-full')).toHaveLength(3);
    expect(within(celula).getByText('+2')).toBeInTheDocument();
    expect(dias(container)[0].querySelectorAll('span.w-2')).toHaveLength(0);
  });
});

describe('Planeador: proximos posts', () => {
  it('so_agendados_de_hoje_em_diante_no_maximo_8_ordenados_e_o_texto_corta_aos_50', () => {
    const longo = 'x'.repeat(60);
    const posts = [
      post('p0', `${HOJE}T09:00`, { text_pt: longo }),
      ...Array.from({ length: 9 }, (_, i) => post(`f${i}`, `2026-11-${String(16 + i).padStart(2, '0')}T10:00`)),
      post('passado', '2026-11-10T10:00'),
      post('publ', '2026-11-20T10:00', { status: 'publicado' }),
    ];
    planner(posts);
    const sec = proximos();
    const textos = [...sec.querySelectorAll('p.truncate')].map(p => p.textContent);
    expect(textos).toHaveLength(8);
    expect(textos[0]).toBe('x'.repeat(50) + '…');
    expect(textos[1]).toBe('Texto do post f0');
    expect(textos[7]).toBe('Texto do post f6');
    expect(within(sec).queryByText('Texto do post passado')).not.toBeInTheDocument();
    expect(within(sec).queryByText('Texto do post publ')).not.toBeInTheDocument();
  });

  it('mostra_a_data_e_a_hora_de_cada_post', () => {
    planner([post('a', '2026-11-18T14:30')]);
    const dt = new Date('2026-11-18T14:30');
    const esperado = `${dt.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })} ${dt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`;
    expect(norm(proximos().textContent)).toContain(norm(esperado));
  });

  it('Publicado_so_nos_de_hoje_e_chama_onMarkPublished_com_o_id', () => {
    const { h } = planner([post('hoje', `${HOJE}T18:00`), post('amanha', '2026-11-16T10:00')]);
    const botoesPub = within(proximos()).getAllByRole('button', { name: 'Publicado' });
    expect(botoesPub).toHaveLength(1);
    fireEvent.click(botoesPub[0]);
    expect(h.onMarkPublished).toHaveBeenCalledWith('hoje');
  });

  it('editar_e_eliminar_chamam_onEdit_com_o_post_e_onDelete_com_o_id', () => {
    const p = post('a', '2026-11-18T10:00');
    const { h } = planner([p]);
    const [editar, eliminar] = within(linhaDoPost(proximos(), 'Texto do post a')).getAllByRole('button');
    fireEvent.click(editar);
    expect(h.onEdit).toHaveBeenCalledWith(p);
    fireEvent.click(eliminar);
    expect(h.onDelete).toHaveBeenCalledWith('a');
  });

  it('sem_proximos_mostra_Sem_posts_agendados', () => {
    planner([post('passado', '2026-11-01T10:00')]);
    expect(within(proximos()).getByText('Sem posts agendados')).toBeInTheDocument();
  });
});

describe('Planeador: historico', () => {
  it('sem_posts_nao_mostra_o_historico', () => {
    planner([]);
    expect(screen.queryByText(/^Historico/)).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('por_data_decrescente_com_texto_data_e_estado_e_estado_desconhecido_como_agendado', () => {
    planner([
      post('a', '2026-11-05T10:00'),
      post('b', '2026-11-25T10:00', { status: 'publicado' }),
      post('c', '2026-11-12T10:00', { status: 'cancelado' }),
      post('d', '2026-11-01T10:00', { status: 'xyz', platform: 'tiktok' }),
    ]);
    expect(screen.getByText('Historico (4)')).toBeInTheDocument();
    const linhas = screen.getAllByRole('row').slice(1);
    const textos = linhas.map(r => r.querySelector('td').textContent);
    expect(textos).toEqual(['Texto do post b', 'Texto do post c', 'Texto do post a', 'Texto do post d']);
    const celulasLinha = (r) => [...r.querySelectorAll('td')].map(td => td.textContent);
    expect(celulasLinha(linhas[0])[2]).toBe(new Date('2026-11-25T10:00').toLocaleDateString('pt-PT'));
    expect(celulasLinha(linhas[0])[3]).toBe('Publicado');
    expect(celulasLinha(linhas[1])[3]).toBe('Cancelado');
    expect(celulasLinha(linhas[2])[3]).toBe('Agendado');
    expect(celulasLinha(linhas[3])[3]).toBe('Agendado');
    expect(linhas[3].querySelector('svg')).toBeInTheDocument();
  });

  it('data_vazia_mostra_travessao_e_editar_eliminar_funcionam_na_linha', () => {
    const p = post('a', '', { status: 'publicado' });
    const { h } = planner([p]);
    const linha = screen.getAllByRole('row')[1];
    expect(linha.querySelectorAll('td')[2].textContent).toBe('—');
    const [editar, eliminar] = within(linha).getAllByRole('button');
    fireEvent.click(editar);
    expect(h.onEdit).toHaveBeenCalledWith(p);
    fireEvent.click(eliminar);
    expect(h.onDelete).toHaveBeenCalledWith('a');
  });
});

/* ───────────────────────── caracterizacao: PostModal ───────────────────────── */

function modal(post = null, extra = {}) {
  const h = { onSave: vi.fn(), onClose: vi.fn(), ...extra };
  const r = render(<PostModal post={post} operatorName="Sal Aventura" {...h} />);
  return { ...r, h };
}
const campo = (etiqueta, tag = 'input') => screen.getByText(etiqueta).parentElement.querySelector(tag);
const EXISTENTE = { id: 'p1', text_pt: 'Legenda PT', text_en: 'Text EN', photo_url: 'https://x.test/f.jpg', platform: 'facebook', scheduled_at: '2026-11-20T09:00', status: 'publicado' };

describe('Planeador: PostModal', () => {
  it('novo_mostra_titulo_botao_e_nao_mostra_o_estado_e_ignora_a_data_recebida', () => {
    modal({ _new: true, scheduled_at: '2026-11-20T09:00' });
    expect(screen.getByText('Novo post')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agendar post' })).toBeInTheDocument();
    /* existente: um post novo nao herda o scheduled_at do dia clicado (decisao 7i) */
    expect(campo('Data e hora')).toHaveValue('');
    expect(screen.queryByText('Estado')).not.toBeInTheDocument();
    expect(campo('Plataforma', 'select')).toHaveValue('instagram');
    expect([...campo('Plataforma', 'select').options].map(o => o.textContent)).toEqual(['Instagram', 'Facebook', 'Instagram + Facebook']);
  });

  it('o_post_null_tambem_e_novo', () => {
    modal(null);
    expect(screen.getByText('Novo post')).toBeInTheDocument();
    expect(campo('Data e hora')).toHaveValue('');
  });

  it('editar_mostra_os_valores_e_o_estado', () => {
    modal(EXISTENTE);
    expect(screen.getByText('Editar post')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
    expect(campo('Texto PT', 'textarea')).toHaveValue('Legenda PT');
    expect(campo('Texto EN', 'textarea')).toHaveValue('Text EN');
    expect(campo('Foto (URL)')).toHaveValue('https://x.test/f.jpg');
    expect(campo('Plataforma', 'select')).toHaveValue('facebook');
    expect(campo('Estado', 'select')).toHaveValue('publicado');
    expect([...campo('Estado', 'select').options].map(o => o.textContent)).toEqual(['Agendado', 'Publicado', 'Cancelado']);
  });

  it('escolher_template_preenche_PT_e_EN', () => {
    modal(null);
    fireEvent.click(screen.getByRole('button', { name: 'Ultimas vagas' }));
    expect(campo('Texto PT', 'textarea')).toHaveValue('Ultimas vagas para este tour! Nao perca a oportunidade de explorar a ilha connosco.');
    expect(campo('Texto EN', 'textarea')).toHaveValue('Last spots available for this tour! Do not miss the chance to explore the island with us.');
    expect([...document.querySelectorAll('button')].filter(b => ['Tour disponivel', 'Ultimas vagas', 'Avaliacao de cliente', 'Promocao especial', 'Foto do dia'].includes(b.textContent))).toHaveLength(5);
  });

  it('guardar_um_novo_chama_onSave_com_os_campos_e_um_id_novo', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const { h } = modal({ _new: true, scheduled_at: '2026-11-20T09:00' });
    fireEvent.change(campo('Texto PT', 'textarea'), { target: { value: 'Ola' } });
    fireEvent.change(campo('Data e hora'), { target: { value: '2026-11-20T09:00' } });
    fireEvent.change(campo('Foto (URL)'), { target: { value: 'https://x.test/a.png' } });
    fireEvent.change(campo('Plataforma', 'select'), { target: { value: 'ambos' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Agendar post' }).closest('form'));
    expect(h.onSave).toHaveBeenCalledWith({
      text_pt: 'Ola', text_en: '', photo_url: 'https://x.test/a.png', platform: 'ambos',
      scheduled_at: '2026-11-20T09:00', status: 'agendado', id: '1700000000000',
    });
  });

  it('guardar_um_existente_mantem_o_id_e_os_outros_campos_e_altera_o_estado', () => {
    const { h } = modal({ ...EXISTENTE, extra: 'x' });
    fireEvent.change(campo('Estado', 'select'), { target: { value: 'cancelado' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar' }).closest('form'));
    expect(h.onSave).toHaveBeenCalledWith({ ...EXISTENTE, extra: 'x', status: 'cancelado', id: 'p1' });
  });

  it('os_campos_obrigatorios_so_mostram_o_asterisco_e_nao_impedem_guardar_vazio', () => {
    const { h } = modal(null);
    expect(screen.getByText('Texto PT').textContent).toBe('Texto PT*');
    expect(screen.getByText('Data e hora').textContent).toBe('Data e hora*');
    expect(campo('Texto PT', 'textarea')).not.toBeRequired();
    fireEvent.submit(screen.getByRole('button', { name: 'Agendar post' }).closest('form'));
    expect(h.onSave).toHaveBeenCalledTimes(1);
  });

  it('o_preview_do_Instagram_mostra_nome_texto_e_foto_e_alterna_para_o_Facebook', () => {
    modal(EXISTENTE);
    expect(screen.getAllByText('Sal Aventura').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Legenda PT').length).toBeGreaterThanOrEqual(1);
    const fotoIg = document.querySelector('img[src="https://x.test/f.jpg"]');
    expect(fotoIg).toBeInTheDocument();
    fireEvent.error(fotoIg);
    expect(fotoIg.style.display).toBe('none');
    fireEvent.click(screen.getByRole('button', { name: 'Facebook' }));
    expect(screen.getByText('Agora')).toBeInTheDocument();
    expect(document.querySelector('img[src="https://x.test/f.jpg"]')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Instagram' }));
    expect(screen.queryByText('Agora')).not.toBeInTheDocument();
  });

  it('o_preview_sem_texto_ou_sem_operador_mostra_as_frases_por_omissao', () => {
    render(<PostModal post={null} onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getAllByText('o_seu_perfil')).toHaveLength(2);
    expect(screen.getByText('A legenda aparecera aqui...')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Facebook' }));
    expect(screen.getByText('Pagina')).toBeInTheDocument();
    expect(screen.getByText('O texto do post aparecera aqui...')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('cancelar_chama_onClose', () => {
    const { h } = modal(null);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(h.onClose).toHaveBeenCalledTimes(1);
  });
});

/* ───────────────────────── design system: Planeador ───────────────────────── */

const TODOS = [
  post('a', `${HOJE}T08:00`), post('b', `${HOJE}T09:00`, { status: 'publicado' }),
  post('c', `${HOJE}T10:00`, { status: 'cancelado' }), post('d', '2026-11-18T10:00', { platform: 'facebook' }),
];

describe('Planeador: design system', () => {
  it('o_historico_e_Table_com_as_cinco_colunas_e_o_estado_e_Badge', () => {
    planner(TODOS);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Texto', 'Plataforma', 'Data', 'Estado', '']);
    const tabela = within(screen.getByRole('table'));
    expect(tabela.getAllByText('Agendado')[0].className).toContain('var(--info-light)');
    expect(tabela.getByText('Publicado').className).toContain('var(--success-light)');
    expect(tabela.getByText('Cancelado').className).toContain('var(--error-light)');
  });

  it('os_dias_e_os_botoes_de_icone_tem_nome_acessivel', () => {
    const { container } = planner(TODOS);
    expect(screen.getByRole('button', { name: `Novo post em ${HOJE}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo post em 2026-11-01' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mes seguinte' })).toBeInTheDocument();
    expect(within(proximos()).getByRole('button', { name: 'Editar post Texto do post a' })).toBeInTheDocument();
    expect(within(proximos()).getByRole('button', { name: 'Eliminar post Texto do post a' })).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByRole('button', { name: 'Editar post Texto do post b' })).toBeInTheDocument();
    /* os dias vazios continuam divs inertes */
    expect(vazias(container).every(e => e.tagName === 'DIV')).toBe(true);
  });

  it('os_pontos_do_dia_e_o_cartao_de_hoje_usam_tokens', () => {
    const { container } = planner(TODOS);
    const pontos = [...dias(container)[14].querySelectorAll('span.w-2.h-2.rounded-full')].map(s => s.className);
    expect(pontos.some(c => c.includes('var(--success)'))).toBe(true);
    expect(pontos.some(c => c.includes('var(--error)'))).toBe(true);
    expect(pontos.some(c => c.includes('bg-ocean-500'))).toBe(true);
    const cartaoHoje = linhaDoPost(proximos(), 'Texto do post a').parentElement;
    expect(cartaoHoje.closest('[class*="bg-sand-50"]')).not.toBeNull();
    expect(within(proximos()).getByRole('button', { name: 'Publicado' }).className).toContain('var(--success)');
  });

  it('o_vazio_dos_proximos_e_EmptyState', () => {
    planner([]);
    expect(within(proximos()).getByText('Sem posts agendados')).toHaveClass('font-display');
  });

  it('o_modal_tem_campos_com_nome_acessivel_e_seletores_com_aria_pressed', () => {
    modal(EXISTENTE);
    ['Texto PT', 'Texto EN', 'Foto (URL)', 'Plataforma', 'Data e hora', 'Estado'].forEach(e => expect(screen.getByLabelText(e)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Tour disponivel', pressed: false })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tour disponivel' }));
    expect(screen.getByRole('button', { name: 'Tour disponivel', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Instagram', pressed: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Facebook' }));
    expect(screen.getByRole('button', { name: 'Facebook', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Instagram', pressed: false })).toBeInTheDocument();
  });

  it('o_avatar_do_preview_do_Facebook_usa_o_token_de_informacao', () => {
    modal(EXISTENTE);
    fireEvent.click(screen.getByRole('button', { name: 'Facebook' }));
    expect(screen.getByText('Agora').parentElement.previousSibling.className).toContain('var(--info)');
  });

  it('sem_hexadecimais_cores_nomeadas_text_error_ou_bg_red_em_classes_no_planeador_e_no_modal', () => {
    const { container } = planner(TODOS);
    let html = classes(container);
    cleanup();
    const m = modal(EXISTENTE);
    html += classes(m.container);
    fireEvent.click(screen.getByRole('button', { name: 'Facebook' }));
    html += classes(m.container);
    fireEvent.click(screen.getByRole('button', { name: 'Promocao especial' }));
    html += classes(m.container);
    semCoresForaDosTokens(html);
  });
});
