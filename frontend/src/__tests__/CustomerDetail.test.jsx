import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import CustomerDetail from '../components/crm/CustomerDetail';
import useUiStore from '../store/uiStore';
import api from '../services/api';
import { getCustomer, updateCustomer } from '../services/customersService';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

/* Sem rede: so os servicos da gaveta sao simulados */
vi.mock('../services/customersService', () => ({
  getCustomer: vi.fn(),
  updateCustomer: vi.fn(),
}));
vi.mock('../services/api', () => ({ default: { post: vi.fn() } }));

const ANA = {
  id: 'c1', name: 'Ana Silva', first_name: 'Ana', email: 'ana@x.cv', phone: '+238 991 22 33', whatsapp: '+238 991 22 33',
  language: 'pt', birthday: '1990-05-17', total_visits: 3, total_spent: '620.4', country_code: 'CV',
  tags: ['VIP', 'Custom'], notes: 'Gosta de mar',
  reservations: [
    { id: 'r1', units: { name: 'Buggy Tour' }, status: 'confirmed', check_in: '2026-03-10', check_out: '2026-03-12', total_price: 55 },
    { id: 'r2', units: null, status: 'pending', check_in: '2026-04-01', check_out: '2026-04-01', total_amount: 30 },
  ],
};
const SEM_DADOS = { id: 'c2', name: 'Sem Dados', email: 's@x.cv', total_visits: 0, total_spent: 0, tags: null, notes: '', reservations: [] };
const NUMERO = '2389912233';

describe('CustomerDetail', () => {
  let errSpy;
  let warnSpy;
  let esperaErros;
  let onClose;
  let onUpdate;

  beforeEach(() => {
    useUiStore.setState({ lang: 'pt' });
    esperaErros = false;
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    getCustomer.mockReset().mockResolvedValue(ANA);
    updateCustomer.mockReset().mockImplementation(async (id, dados) => ({ id, ...dados }));
    api.post.mockReset().mockResolvedValue({});
    onClose = vi.fn();
    onUpdate = vi.fn();
  });

  afterEach(() => {
    cleanup();
    /* a guarda conta ANTES de restaurar os espioes */
    const erros = errSpy.mock.calls.length;
    const avisos = warnSpy.mock.calls.length;
    vi.restoreAllMocks();
    expect(esperaErros ? erros > 0 : erros === 0).toBe(true);
    expect(avisos).toBe(0);
  });

  async function abre(cliente = ANA) {
    getCustomer.mockResolvedValue(cliente);
    const r = render(<CustomerDetail customerId={cliente.id} onClose={onClose} onUpdate={onUpdate} />);
    await screen.findByRole('heading', { name: cliente.name });
    return r;
  }
  /* o rotulo da linha de contacto e um <span>; "Email" e "WhatsApp" tambem existem como botoes */
  function valorDe(rotulo) {
    return screen.getAllByText(rotulo).find(e => e.tagName === 'SPAN').nextElementSibling.textContent;
  }
  function metrica(rotulo) {
    return screen.getByText(rotulo).previousElementSibling.textContent;
  }
  function seccao(nome) {
    fireEvent.click(screen.getByText(nome));
  }

  it('carrega o cliente, mostra o nome, as métricas e a coroa de VIP', async () => {
    const { container } = await abre();
    expect(getCustomer).toHaveBeenCalledWith('c1');
    expect(metrica('Visitas')).toBe('3');
    expect(metrica('LTV')).toBe('€620');
    expect(metrica('País')).toBe('CV');
    expect(container.querySelector('svg.lucide-crown')).toBeTruthy();
  });

  it('enquanto carrega mostra "A carregar..."', async () => {
    let resolve;
    getCustomer.mockReset().mockImplementation(() => new Promise((res) => { resolve = res; }));
    render(<CustomerDetail customerId="c1" onClose={onClose} onUpdate={onUpdate} />);
    expect(screen.getByText('A carregar...')).toBeInTheDocument();
    resolve(ANA);
    expect(await screen.findByRole('heading', { name: 'Ana Silva' })).toBeInTheDocument();
  });

  it('o perfil mostra o contacto e usa travessao nos campos vazios', async () => {
    await abre();
    expect(valorDe('Email')).toBe('ana@x.cv');
    expect(valorDe('Telefone')).toBe('+238 991 22 33');
    expect(valorDe('Idioma')).toBe('PT');
    expect(valorDe('Aniversário')).toBe('17/05/1990');
    cleanup();
    const { container } = await abre(SEM_DADOS);
    expect(valorDe('Telefone')).toBe('—');
    expect(valorDe('WhatsApp')).toBe('—');
    expect(valorDe('Aniversário')).toBe('—');
    expect(container.querySelector('svg.lucide-crown')).toBeNull();
    expect(screen.getByText('Sem notas')).toBeInTheDocument();
  });

  it('alternar uma etiqueta chama updateCustomer com a lista nova e avisa onUpdate', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'grupo' }));
    await waitFor(() => expect(updateCustomer).toHaveBeenCalledWith('c1', { tags: ['VIP', 'Custom', 'grupo'] }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith({ id: 'c1', tags: ['VIP', 'Custom', 'grupo'] }));
    fireEvent.click(screen.getByRole('button', { name: 'VIP' }));
    await waitFor(() => expect(updateCustomer).toHaveBeenLastCalledWith('c1', { tags: ['Custom', 'grupo'] }));
  });

  it('uma etiqueta própria adiciona-se com Enter, sem duplicar nem aceitar vazio, e remove-se', async () => {
    await abre();
    const campo = screen.getByPlaceholderText('Nova tag + Enter');
    fireEvent.change(campo, { target: { value: 'Praia' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    await waitFor(() => expect(updateCustomer).toHaveBeenCalledWith('c1', { tags: ['VIP', 'Custom', 'Praia'] }));
    await waitFor(() => expect(campo.value).toBe(''));

    updateCustomer.mockClear();
    fireEvent.change(campo, { target: { value: 'Custom' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    await waitFor(() => expect(campo.value).toBe(''));
    fireEvent.change(campo, { target: { value: '   ' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(updateCustomer).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Custom').closest('span').querySelector('button'));
    await waitFor(() => expect(updateCustomer).toHaveBeenCalledWith('c1', { tags: ['VIP', 'Praia'] }));
  });

  it('editar notas guarda com updateCustomer e cancelar restaura', async () => {
    const { container } = await abre();
    expect(screen.getByText('Gosta de mar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(container.querySelector('textarea'), { target: { value: 'Outra nota' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByText('Gosta de mar')).toBeInTheDocument();
    expect(container.querySelector('textarea')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(container.querySelector('textarea'), { target: { value: 'Outra nota' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(updateCustomer).toHaveBeenCalledWith('c1', { notes: 'Outra nota' }));
    expect(await screen.findByText('Outra nota')).toBeInTheDocument();
    expect(onUpdate).toHaveBeenCalledWith({ id: 'c1', notes: 'Outra nota' });
  });

  it('o histórico lista as reservas com estado, datas e total, ou "Sem reservas"', async () => {
    await abre();
    seccao('Histórico');
    expect(screen.getByText('Histórico (2)')).toBeInTheDocument();
    const cartao1 = screen.getByText('Buggy Tour').closest('div').parentElement;
    expect(within(cartao1).getByText('Confirmada')).toBeInTheDocument();
    expect(within(cartao1).getByText('10/03/2026')).toBeInTheDocument();
    expect(within(cartao1).getByText('12/03/2026')).toBeInTheDocument();
    expect(within(cartao1).getByText('€55.00')).toBeInTheDocument();
    expect(screen.getByText('Pendente')).toBeInTheDocument();
    expect(screen.getByText('€30.00')).toBeInTheDocument();
    cleanup();
    await abre(SEM_DADOS);
    seccao('Histórico');
    expect(screen.getByText('Histórico (0)')).toBeInTheDocument();
    expect(screen.getByText('Sem reservas')).toBeInTheDocument();
  });

  it('enviar email chama api.post com assunto e corpo e mostra a confirmação', async () => {
    await abre();
    seccao('Comunicação');
    expect(screen.getByText('Enviar Email')).toBeInTheDocument();
    const para = screen.getByDisplayValue('ana@x.cv');
    expect(para).toHaveAttribute('readonly');
    const form = para.closest('form');
    fireEvent.submit(form);
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.change(within(form).getByPlaceholderText('Assunto do email'), { target: { value: 'Olá' } });
    fireEvent.change(within(form).getByPlaceholderText('Corpo do email...'), { target: { value: 'Corpo' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Enviar email' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/customers/c1/email', { subject: 'Olá', body: 'Corpo' }));
    expect(await screen.findByText('Email enviado com sucesso')).toBeInTheDocument();
  });

  it('se o email falhar regista o erro e mantem o formulário', async () => {
    esperaErros = true;
    api.post.mockRejectedValueOnce(new Error('rede'));
    await abre();
    seccao('Comunicação');
    fireEvent.change(screen.getByPlaceholderText('Assunto do email'), { target: { value: 'Olá' } });
    fireEvent.change(screen.getByPlaceholderText('Corpo do email...'), { target: { value: 'Corpo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar email' }));
    await waitFor(() => expect(errSpy).toHaveBeenCalled());
    expect(screen.getByPlaceholderText('Assunto do email').value).toBe('Olá');
    expect(screen.queryByText('Email enviado com sucesso')).not.toBeInTheDocument();
  });

  it('o botão Email salta para a comunicação', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'Email' }));
    expect(screen.getByText('Enviar Email')).toBeInTheDocument();
  });

  it('WhatsApp abre o wa.me com o número só em digitos e a mensagem; os atalhos tem a mesma ligação', async () => {
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
    expect(abrir).toHaveBeenCalledWith(
      `https://wa.me/${NUMERO}?text=${encodeURIComponent('Olá Ana, obrigado pela sua preferência!')}`, '_blank',
    );
    seccao('Comunicação');
    for (const rotulo of ['Confirmação de reserva', 'Lembrete de tour', 'Pedido de avaliação']) {
      const ligacao = screen.getByText(rotulo).closest('a');
      expect(ligacao.getAttribute('href')).toMatch(new RegExp(`^https://wa\\.me/${NUMERO}\\?text=`));
      expect(ligacao).toHaveAttribute('target', '_blank');
    }
  });

  it('sem número de WhatsApp nem telefone mostra o aviso e o botão não abre nada', async () => {
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    await abre(SEM_DADOS);
    fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
    expect(abrir).not.toHaveBeenCalled();
    seccao('Comunicação');
    expect(screen.getByText('Sem número WhatsApp registado')).toBeInTheDocument();
  });

  it('as seccoes são separadores com aria-selected', async () => {
    await abre();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map(t => t.textContent)).toEqual(['Perfil', 'Histórico', 'Comunicação']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(tabs[2]);
    expect(screen.getAllByRole('tab')[2]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('Enviar Email')).toBeInTheDocument();
  });

  it('nenhuma cor em hexadecimal nem verde solta sobra no HTML (perfil, histórico, comunicação e confirmação)', async () => {
    await abre();
    const limpo = () => {
      expect(document.body.innerHTML).not.toContain('[#');
      expect(document.body.innerHTML).not.toMatch(/(?:bg|text|border)-green-/);
      expect(document.body.innerHTML).not.toMatch(/hover:(?:bg|border)-green-/);
    };
    limpo();
    seccao('Histórico');
    limpo();
    seccao('Comunicação');
    limpo();
    fireEvent.change(screen.getByPlaceholderText('Assunto do email'), { target: { value: 'Olá' } });
    fireEvent.change(screen.getByPlaceholderText('Corpo do email...'), { target: { value: 'Corpo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar email' }));
    await screen.findByText('Email enviado com sucesso');
    limpo();
  });

  it('o botão de fechar tem nome acessível', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fechar: o X e o fundo chamam onClose', async () => {
    const { container } = await abre();
    fireEvent.click(container.querySelector('h2').parentElement.parentElement.querySelector('button'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(container.querySelector('.fixed > .absolute'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('as secções do perfil são caixas interiores Maré', async () => {
    await abre();
    for (const titulo of ['Contacto', 'Tags']) {
      const caixa = screen.getByRole('heading', { name: new RegExp(titulo) }).closest('section');
      expect(caixa).toHaveClass('rounded-[14px]', 'border', 'border-mare-card', 'bg-mare-head');
    }
    const metricas = screen.getByText('Visitas').parentElement;
    expect(metricas).toHaveClass('rounded-[14px]', 'border-mare-card');
  });

  it('dinheiro, contagens e datas usam font-mono', async () => {
    await abre();
    expect(screen.getByText('€620')).toHaveClass('font-mono', 'tabular-nums');
    expect(screen.getByText('3')).toHaveClass('font-mono', 'tabular-nums');
    expect(screen.getByText('17/05/1990')).toHaveClass('font-mono');
    seccao('Histórico');
    for (const t of ['10/03/2026', '12/03/2026', '€55.00']) {
      expect(screen.getByText(t)).toHaveClass('font-mono', 'tabular-nums');
    }
    expect(screen.getByText('Buggy Tour').closest('div').parentElement).toHaveClass('rounded-[14px]', 'border-mare-card');
  });

  it('os botões pequenos de acção têm 44 px no telemóvel', async () => {
    await abre();
    expect(screen.getAllByRole('button', { name: 'Email' })[0]).toHaveClass('min-h-11', 'md:min-h-0');
    expect(screen.getByRole('button', { name: 'WhatsApp' })).toHaveClass('min-h-11', 'md:min-h-0');
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveClass('min-h-11', 'md:min-h-0');
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveClass('min-h-11', 'md:min-h-0');
  });

  it('o X da etiqueta própria tem nome acessível com a etiqueta', async () => {
    await abre();
    const remover = screen.getByRole('button', { name: 'Remover etiqueta Custom' });
    fireEvent.click(remover);
    await waitFor(() => expect(updateCustomer).toHaveBeenCalledWith('c1', { tags: ['VIP'] }));
  });

  it('o aviso de email enviado usa a borda Mare', async () => {
    await abre();
    seccao('Comunicação');
    const form = screen.getByDisplayValue('ana@x.cv').closest('form');
    fireEvent.change(within(form).getByPlaceholderText('Assunto do email'), { target: { value: 'Olá' } });
    fireEvent.change(within(form).getByPlaceholderText('Corpo do email...'), { target: { value: 'Corpo' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Enviar email' }));
    const aviso = (await screen.findByText('Email enviado com sucesso')).closest('div');
    expect(aviso).toHaveClass('border-mare-card');
    expect(aviso).not.toHaveClass('border-n-200');
  });

  it('as etiquetas são pílulas com o mesmo texto e a etiqueta própria também', async () => {
    await abre();
    expect(screen.getByRole('button', { name: 'grupo' })).toHaveClass('rounded-full', 'border');
    const ativa = screen.getByRole('button', { name: 'VIP' });
    expect(ativa).toHaveClass('rounded-full', 'border');
    expect(screen.getByText('Custom').closest('span')).toHaveClass('rounded-full');
  });
});

/* Painel em ingles: os rotulos mudam; as etiquetas gravadas e os textos para o cliente ficam como estavam */
describe('CustomerDetail em ingles', () => {
  /* nome, notas, etiqueta e unidade sao dados do cliente, nao texto do painel */
  const DADOS = ['Ana Silva', 'Gosta de mar', 'Buggy Tour', 'Custom'];
  let errSpy;
  let warnSpy;
  let onClose;
  let onUpdate;

  beforeEach(() => {
    useUiStore.setState({ lang: 'en' });
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    getCustomer.mockReset().mockResolvedValue(ANA);
    updateCustomer.mockReset().mockImplementation(async (id, dados) => ({ id, ...dados }));
    api.post.mockReset().mockResolvedValue({});
    onClose = vi.fn();
    onUpdate = vi.fn();
  });

  afterEach(() => {
    cleanup();
    useUiStore.setState({ lang: 'pt' });
    const erros = errSpy.mock.calls.length;
    const avisos = warnSpy.mock.calls.length;
    vi.restoreAllMocks();
    expect(erros).toBe(0);
    expect(avisos).toBe(0);
  });

  async function abreEn(cliente = ANA) {
    getCustomer.mockResolvedValue(cliente);
    render(<CustomerDetail customerId={cliente.id} onClose={onClose} onUpdate={onUpdate} />);
    await screen.findByRole('heading', { name: cliente.name });
  }
  function seccao(nome) {
    fireEvent.click(screen.getByText(nome));
  }
  function valorDe(rotulo) {
    return screen.getAllByText(rotulo).find(e => e.tagName === 'SPAN').nextElementSibling.textContent;
  }

  it('o_perfil_em_ingles_traduz_metricas_contacto_etiquetas_e_notas_sem_portugues', async () => {
    await abreEn();
    expect(screen.getByText('Visits').previousElementSibling.textContent).toBe('3');
    expect(screen.getByText('LTV').previousElementSibling.textContent).toBe('€620');
    expect(screen.getByText('Country').previousElementSibling.textContent).toBe('CV');
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['Profile', 'History', 'Communication']);
    expect(screen.getByText('Contact')).toBeInTheDocument();
    expect(valorDe('Phone')).toBe('+238 991 22 33');
    expect(valorDe('Language')).toBe('PT');
    expect(valorDe('Birthday')).toBe('17/05/1990');
    expect(screen.getByText('Internal notes')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('New tag + Enter')).toBeInTheDocument();
    ['VIP', 'group', 'corporate', 'loyal', 'new', 'returning'].forEach((etiqueta) => {
      expect(screen.getByRole('button', { name: etiqueta })).toBeInTheDocument();
    });
    expect(portuguesNoEcra(DADOS)).toEqual([]);
    expect(chavesCruas(['customerDetail', 'customersPage'])).toEqual([]);
  });

  it('alternar_uma_etiqueta_em_ingles_grava_o_valor_guardado', async () => {
    await abreEn();
    fireEvent.click(screen.getByRole('button', { name: 'group' }));
    await waitFor(() => expect(updateCustomer).toHaveBeenCalledWith('c1', { tags: ['VIP', 'Custom', 'grupo'] }));
  });

  it('as_notas_em_ingles_mostram_editar_guardar_e_o_vazio', async () => {
    await abreEn(SEM_DADOS);
    expect(screen.getByText('No notes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('o_historico_em_ingles_traduz_titulo_estado_data_e_valor', async () => {
    await abreEn();
    seccao('History');
    expect(screen.getByText('History (2)')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getAllByText('10/03/2026')).toHaveLength(1);
    expect(screen.getByText('€55.00')).toBeInTheDocument();
    expect(screen.getByText('€30.00')).toBeInTheDocument();
    expect(portuguesNoEcra(DADOS)).toEqual([]);
  });

  it('o_historico_vazio_em_ingles', async () => {
    await abreEn(SEM_DADOS);
    seccao('History');
    expect(screen.getByText('No bookings')).toBeInTheDocument();
  });

  it('a_comunicacao_em_ingles_traduz_o_formulario_e_envia_o_email_como_escrito', async () => {
    await abreEn();
    seccao('Communication');
    expect(screen.getByText('Send Email')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Email subject'), { target: { value: 'Olá' } });
    fireEvent.change(screen.getByPlaceholderText('Email body...'), { target: { value: 'Corpo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send email' }));
    await screen.findByText('Email sent successfully');
    expect(api.post).toHaveBeenCalledWith('/customers/c1/email', { subject: 'Olá', body: 'Corpo' });
    expect(portuguesNoEcra(DADOS)).toEqual([]);
  });

  it('os_botoes_de_WhatsApp_em_ingles_levam_o_mesmo_texto_em_portugues_que_o_painel_em_portugues', async () => {
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    await abreEn();
    fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
    expect(abrir).toHaveBeenCalledWith(
      `https://wa.me/${NUMERO}?text=${encodeURIComponent('Olá Ana, obrigado pela sua preferência!')}`, '_blank',
    );
    seccao('Communication');
    const textos = ['Booking confirmation', 'Tour reminder', 'Review request'].map((rotulo) => {
      const href = screen.getByText(rotulo).closest('a').getAttribute('href');
      return decodeURIComponent(href.split('?text=')[1]);
    });
    expect(textos).toEqual([
      'Olá Ana! A sua reserva foi confirmada. Aguardamos a sua visita!',
      'Olá! Lembrete do seu tour amanhã. Não se esqueça de trazer protector solar e água.',
      'Obrigado pela sua visita! Pode deixar a sua avaliação em: https://app.saldesk.cv',
    ]);
  });

  it('sem_numero_de_WhatsApp_em_ingles_mostra_o_aviso_traduzido', async () => {
    await abreEn(SEM_DADOS);
    seccao('Communication');
    expect(screen.getByText('No WhatsApp number on file')).toBeInTheDocument();
  });
});
