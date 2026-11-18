import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ReviewPage from '../pages/ReviewPage';

/* Pagina publica /review/:token: so a rede e simulada */
const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };
const OK = {
  estado: 'ok', operador: { name: 'Logan Tours', slug: 'loganislandtours', brand_color: null },
  unidade: 'Turtle Watch', data: '2026-11-17', cliente: 'Ana', lingua: 'pt',
};

function resposta(body, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
}

function abrir() {
  return render(
    <MemoryRouter initialEntries={['/review/abc']} future={FUTURE}>
      <Routes><Route path="/review/:token" element={<ReviewPage />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => { global.fetch = vi.fn(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ReviewPage', () => {
  it('mostra_operador_unidade_e_formulario', async () => {
    fetch.mockReturnValueOnce(resposta({ data: OK }));
    abrir();
    expect(await screen.findByText('Logan Tours')).toBeInTheDocument();
    expect(screen.getByText(/Turtle Watch/)).toBeInTheDocument();
    for (let n = 1; n <= 5; n += 1) {
      expect(screen.getByRole('radio', { name: n === 1 ? '1 estrela' : `${n} estrelas` })).toBeInTheDocument();
    }
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar avaliação' })).toBeInTheDocument();
    expect(fetch.mock.calls[0][0]).toMatch(/\/reviews\/token\/abc$/);
  });

  it('sem_estrelas_nao_envia', async () => {
    fetch.mockReturnValueOnce(resposta({ data: OK }));
    abrir();
    const enviar = await screen.findByRole('button', { name: 'Enviar avaliação' });
    expect(enviar).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: '4 estrelas' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Muito bom' } });
    fetch.mockReturnValueOnce(resposta({ data: { id: 'x' } }));
    expect(enviar).not.toBeDisabled();
    fireEvent.click(enviar);
    await screen.findByText(/Obrigado/);
    const [url, opcoes] = fetch.mock.calls[1];
    expect(url).toMatch(/\/reviews\/submit$/);
    expect(opcoes.method).toBe('POST');
    expect(JSON.parse(opcoes.body)).toEqual({ token: 'abc', rating: 4, comment: 'Muito bom' });
    expect(screen.getByRole('link', { name: /Logan Tours/ })).toHaveAttribute('href', expect.stringContaining('/book/loganislandtours'));
  });

  it('link_expirado_e_inactivo_sem_formulario', async () => {
    fetch.mockReturnValueOnce(resposta({ data: { estado: 'expirado', operador: OK.operador } }));
    abrir();
    expect(await screen.findByText(/expirou/)).toBeInTheDocument();
    expect(screen.queryByRole('radio')).toBeNull();
    cleanup();

    fetch.mockReturnValueOnce(resposta({ data: { estado: 'invalido' } }));
    abrir();
    expect(await screen.findByText('Este link já não está activo. Se já deixou a sua avaliação, obrigado!')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('erro_de_rede_mostra_tentar_de_novo', async () => {
    fetch.mockReturnValueOnce(Promise.reject(new Error('rede')));
    abrir();
    const tentar = await screen.findByRole('button', { name: 'Tentar de novo' });
    fetch.mockReturnValueOnce(resposta({ data: OK }));
    fireEvent.click(tentar);
    expect(await screen.findByText('Logan Tours')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('cliente_em_ingles_ve_a_pagina_em_ingles', async () => {
    fetch.mockReturnValueOnce(resposta({ data: { ...OK, lingua: 'en' } }));
    abrir();
    expect(await screen.findByRole('button', { name: 'Send review' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '1 star' })).toBeInTheDocument();
  });

  it('submit_com_link_expirado_entretanto_mostra_o_estado', async () => {
    fetch.mockReturnValueOnce(resposta({ data: OK }));
    abrir();
    fireEvent.click(await screen.findByRole('radio', { name: '5 estrelas' }));
    fetch.mockReturnValueOnce(resposta({ error: 'Link expirado', code: 'EXPIRED' }, 410));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar avaliação' }));
    await waitFor(() => expect(screen.getByText(/expirou/)).toBeInTheDocument());
    expect(screen.queryByRole('radio')).toBeNull();
  });
});
