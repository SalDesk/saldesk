import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import CustomerDetail from '../components/crm/CustomerDetail';
import useUiStore from '../store/uiStore';
import api from '../services/api';
import { getCustomer, updateCustomer } from '../services/customersService';

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

  it('carrega o cliente, mostra o nome, as metricas e a coroa de VIP', async () => {
    const { container } = await abre();
    expect(getCustomer).toHaveBeenCalledWith('c1');
    expect(metrica('Visitas')).toBe('3');
    expect(metrica('LTV')).toBe('€620');
    expect(metrica('Pais')).toBe('CV');
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
    expect(valorDe('Aniversario')).toBe('17/05/1990');
    cleanup();
    const { container } = await abre(SEM_DADOS);
    expect(valorDe('Telefone')).toBe('—');
    expect(valorDe('WhatsApp')).toBe('—');
    expect(valorDe('Aniversario')).toBe('—');
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

  it('uma etiqueta propria adiciona-se com Enter, sem duplicar nem aceitar vazio, e remove-se', async () => {
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

  it('o historico lista as reservas com estado, datas e total, ou "Sem reservas"', async () => {
    await abre();
    seccao('Historico');
    expect(screen.getByText('Historico (2)')).toBeInTheDocument();
    const cartao1 = screen.getByText('Buggy Tour').closest('div').parentElement;
    expect(within(cartao1).getByText('Confirmada')).toBeInTheDocument();
    expect(within(cartao1).getByText('10/03/2026')).toBeInTheDocument();
    expect(within(cartao1).getByText('12/03/2026')).toBeInTheDocument();
    expect(within(cartao1).getByText('€55.00')).toBeInTheDocument();
    expect(screen.getByText('Pendente')).toBeInTheDocument();
    expect(screen.getByText('€30.00')).toBeInTheDocument();
    cleanup();
    await abre(SEM_DADOS);
    seccao('Historico');
    expect(screen.getByText('Historico (0)')).toBeInTheDocument();
    expect(screen.getByText('Sem reservas')).toBeInTheDocument();
  });

  it('enviar email chama api.post com assunto e corpo e mostra a confirmacao', async () => {
    await abre();
    seccao('Comunicacao');
    expect(screen.getByText('Enviar Email')).toBeInTheDocument();
    const para = screen.getByDisplayValue('ana@x.cv');
    expect(para).toHaveAttribute('readonly');
    const form = para.closest('form');
    fireEvent.submit(form);
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.change(within(form).getByPlaceholderText('Assunto do email'), { target: { value: 'Ola' } });
    fireEvent.change(within(form).getByPlaceholderText('Corpo do email...'), { target: { value: 'Corpo' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Enviar email' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/customers/c1/email', { subject: 'Ola', body: 'Corpo' }));
    expect(await screen.findByText('Email enviado com sucesso')).toBeInTheDocument();
  });

  it('se o email falhar regista o erro e mantem o formulario', async () => {
    esperaErros = true;
    api.post.mockRejectedValueOnce(new Error('rede'));
    await abre();
    seccao('Comunicacao');
    fireEvent.change(screen.getByPlaceholderText('Assunto do email'), { target: { value: 'Ola' } });
    fireEvent.change(screen.getByPlaceholderText('Corpo do email...'), { target: { value: 'Corpo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar email' }));
    await waitFor(() => expect(errSpy).toHaveBeenCalled());
    expect(screen.getByPlaceholderText('Assunto do email').value).toBe('Ola');
    expect(screen.queryByText('Email enviado com sucesso')).not.toBeInTheDocument();
  });

  it('o botao Email salta para a comunicacao', async () => {
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'Email' }));
    expect(screen.getByText('Enviar Email')).toBeInTheDocument();
  });

  it('WhatsApp abre o wa.me com o numero so em digitos e a mensagem; os atalhos tem a mesma ligacao', async () => {
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    await abre();
    fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
    expect(abrir).toHaveBeenCalledWith(
      `https://wa.me/${NUMERO}?text=${encodeURIComponent('Ola Ana, obrigado pela sua preferencia!')}`, '_blank',
    );
    seccao('Comunicacao');
    for (const rotulo of ['Confirmacao de reserva', 'Lembrete de tour', 'Pedido de avaliacao']) {
      const ligacao = screen.getByText(rotulo).closest('a');
      expect(ligacao.getAttribute('href')).toMatch(new RegExp(`^https://wa\\.me/${NUMERO}\\?text=`));
      expect(ligacao).toHaveAttribute('target', '_blank');
    }
  });

  it('sem numero de WhatsApp nem telefone mostra o aviso e o botao nao abre nada', async () => {
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    await abre(SEM_DADOS);
    fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
    expect(abrir).not.toHaveBeenCalled();
    seccao('Comunicacao');
    expect(screen.getByText('Sem numero WhatsApp registado')).toBeInTheDocument();
  });

  it('as seccoes sao separadores com aria-selected', async () => {
    await abre();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map(t => t.textContent)).toEqual(['Perfil', 'Historico', 'Comunicacao']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(tabs[2]);
    expect(screen.getAllByRole('tab')[2]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('Enviar Email')).toBeInTheDocument();
  });

  it('nenhuma cor em hexadecimal nem verde solta sobra no HTML (perfil, historico, comunicacao e confirmacao)', async () => {
    await abre();
    const limpo = () => {
      expect(document.body.innerHTML).not.toContain('[#');
      expect(document.body.innerHTML).not.toMatch(/(?:bg|text|border)-green-/);
      expect(document.body.innerHTML).not.toMatch(/hover:(?:bg|border)-green-/);
    };
    limpo();
    seccao('Historico');
    limpo();
    seccao('Comunicacao');
    limpo();
    fireEvent.change(screen.getByPlaceholderText('Assunto do email'), { target: { value: 'Ola' } });
    fireEvent.change(screen.getByPlaceholderText('Corpo do email...'), { target: { value: 'Corpo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar email' }));
    await screen.findByText('Email enviado com sucesso');
    limpo();
  });

  it('o botao de fechar tem nome acessivel', async () => {
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
});
