/* ChatWidget da pagina publica: idioma enviado ao backend e resposta automatica fora de horas. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatWidget } from '../pages/PublicBooking';

const ENVIADA = { id: 'm1', sender_type: 'guest', content: 'Ola, ha vagas?', created_at: '2026-11-14T12:00:00Z' };
const AUTO = { id: 'm2', sender_type: 'system', content: 'Estamos fora do horario.', created_at: '2026-11-14T12:00:01Z' };

let chamadas;

/* historico: 'pendente' = o pedido nunca responde (so o envio pode trazer mensagens);
   'servidor' = devolve o que o servidor ja guardou, como em producao. */
function simularRede({ autoReply, historico = 'pendente' } = {}) {
  chamadas = [];
  global.fetch = vi.fn((url, opts) => {
    chamadas.push({ url: String(url), opts });
    if (String(url).includes('/chat/send')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { message: ENVIADA, customer_id: 'c1', ...(autoReply ? { auto_reply: autoReply } : {}) } }) });
    }
    if (historico === 'pendente') return new Promise(() => {});
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [ENVIADA, ...(autoReply ? [autoReply] : [])] }) });
  });
}

async function abrirEEnviar(lang) {
  render(<ChatWidget slug="demo" opName="Sal Aventura" lang={lang} />);
  fireEvent.click(document.querySelector('button.rounded-full'));
  fireEvent.change(document.querySelector('input[type="email"]'), { target: { value: 'ana@example.com' } });
  fireEvent.change(document.querySelector('textarea'), { target: { value: 'Ola, ha vagas?' } });
  fireEvent.click(screen.getByRole('button', { name: lang === 'en' ? 'Send' : 'Enviar' }));
  await waitFor(() => expect(chamadas.some(c => c.url.includes('/chat/send'))).toBe(true));
}

const textosDasMensagens = () => Array.from(document.querySelectorAll('.whitespace-pre-wrap')).map(n => n.firstChild.textContent);

beforeEach(() => {
  localStorage.clear();
  /* o jsdom nao implementa scrollTo */
  Element.prototype.scrollTo = vi.fn();
});
afterEach(() => { vi.restoreAllMocks(); });

describe('ChatWidget: resposta automatica', () => {
  it('envia o idioma da pagina ao backend (en)', async () => {
    simularRede();
    await abrirEEnviar('en');
    const corpo = JSON.parse(chamadas.find(c => c.url.includes('/chat/send')).opts.body);
    expect(corpo.lang).toBe('en');
    expect(corpo.content).toBe('Ola, ha vagas?');
  });

  it('envia o idioma da pagina ao backend (pt)', async () => {
    simularRede();
    await abrirEEnviar('pt');
    const corpo = JSON.parse(chamadas.find(c => c.url.includes('/chat/send')).opts.body);
    expect(corpo.lang).toBe('pt');
  });

  it('mostra logo a resposta automatica devolvida pelo envio, depois da mensagem do visitante', async () => {
    simularRede({ autoReply: AUTO });
    await abrirEEnviar('pt');
    expect(await screen.findByText('Estamos fora do horario.')).toBeInTheDocument();
    expect(textosDasMensagens()).toEqual(['Ola, ha vagas?', 'Estamos fora do horario.']);
  });

  it('sem auto_reply na resposta so aparece a mensagem do visitante', async () => {
    simularRede();
    await abrirEEnviar('pt');
    expect(await screen.findByText('Ola, ha vagas?')).toBeInTheDocument();
    expect(screen.queryByText('Estamos fora do horario.')).not.toBeInTheDocument();
  });

  it('quando o historico do servidor ja traz a resposta automatica nao a duplica', async () => {
    simularRede({ autoReply: AUTO, historico: 'servidor' });
    await abrirEEnviar('pt');
    await waitFor(() => expect(chamadas.some(c => c.url.includes('/chat/history'))).toBe(true));
    await waitFor(() => expect(textosDasMensagens()).toEqual(['Ola, ha vagas?', 'Estamos fora do horario.']));
  });
});
