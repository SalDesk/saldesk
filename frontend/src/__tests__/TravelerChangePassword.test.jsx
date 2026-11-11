import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChangePasswordTab } from '../pages/traveler/TravelerPortal';
import { changePassword, forgotPassword } from '../services/travelerAuthService';
import useTravelerAuthStore from '../store/travelerAuthStore';

vi.mock('../services/travelerAuthService', () => ({ logout: vi.fn(), changePassword: vi.fn(), forgotPassword: vi.fn() }));

let spyErr; let spyWarn;
beforeEach(() => {
  spyErr = vi.spyOn(console, 'error').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  changePassword.mockReset().mockResolvedValue({});
  forgotPassword.mockReset().mockResolvedValue({});
  useTravelerAuthStore.setState({ token: 'tok', traveler: { id: 't1', name: 'Viajante', email: 'v@x.test' } });
});
afterEach(() => {
  /* ler as contagens ANTES de restaurar os espioes */
  const erros = spyErr.mock.calls.map(c => String(c[0]).slice(0, 200));
  const avisos = spyWarn.mock.calls.map(c => String(c[0]).slice(0, 200));
  cleanup();
  vi.restoreAllMocks();
  useTravelerAuthStore.setState({ token: null, traveler: null });
  expect(erros).toEqual([]);
  expect(avisos).toEqual([]);
});

const montar = () => render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ChangePasswordTab /></MemoryRouter>);
const campo = (etiqueta) => screen.getByText(etiqueta).parentElement.querySelector('input');
const preencher = (actual, nova, confirmar) => {
  fireEvent.change(campo('Password actual'), { target: { value: actual } });
  fireEvent.change(campo('Nova password'), { target: { value: nova } });
  fireEvent.change(campo('Confirmar nova password'), { target: { value: confirmar } });
};
const enviar = () => fireEvent.submit(campo('Nova password').closest('form'));

describe('Portal do viajante: alterar password', () => {
  it('pede a password actual, a nova e a confirmacao', () => {
    montar();
    expect(campo('Password actual')).toHaveAttribute('autocomplete', 'current-password');
    expect(campo('Password actual')).toBeRequired();
    expect(campo('Nova password')).toHaveAttribute('autocomplete', 'new-password');
    expect(campo('Confirmar nova password')).toHaveAttribute('autocomplete', 'new-password');
  });

  it('envia a actual e a nova, limpa os campos e mostra Password alterada', async () => {
    montar();
    preencher('Actual1!x', 'Abcdef1!', 'Abcdef1!');
    enviar();
    await waitFor(() => expect(changePassword).toHaveBeenCalledWith('Actual1!x', 'Abcdef1!'));
    expect(await screen.findByRole('button', { name: 'Password alterada' })).toBeInTheDocument();
    expect(campo('Password actual')).toHaveValue('');
    expect(campo('Nova password')).toHaveValue('');
  });

  it('valida a forca e a confirmacao antes de pedir', () => {
    montar();
    preencher('Actual1!x', 'abc', 'abc');
    enviar();
    expect(screen.getByText('A password deve ser forte: 8+ caracteres, maiuscula, numero e especial.')).toBeInTheDocument();
    preencher('Actual1!x', 'Abcdef1!', 'outra');
    enviar();
    expect(screen.getByText('As passwords nao coincidem.')).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('password actual incorrecta mostra a mensagem do servidor e mantem os campos', async () => {
    changePassword.mockRejectedValueOnce({ response: { status: 403, data: { error: 'Password actual incorrecta', code: 'INVALID_CURRENT_PASSWORD' } } });
    montar();
    preencher('errada', 'Abcdef1!', 'Abcdef1!');
    enviar();
    expect(await screen.findByText('Password actual incorrecta')).toBeInTheDocument();
    expect(campo('Password actual')).toHaveValue('errada');
    changePassword.mockRejectedValueOnce(new Error('x'));
    enviar();
    expect(await screen.findByText('Nao foi possivel alterar a password.')).toBeInTheDocument();
  });

  it('mostrar e esconder funciona nos tres campos', () => {
    montar();
    for (const etiqueta of ['Password actual', 'Nova password', 'Confirmar nova password']) {
      const input = campo(etiqueta);
      expect(input).toHaveAttribute('type', 'password');
      fireEvent.click(input.parentElement.querySelector('button'));
      expect(input).toHaveAttribute('type', 'text');
    }
  });

  it('contas sem password (Google ou Apple) tem o caminho de definir a password por email', async () => {
    montar();
    expect(screen.getByText(/Entrou com Google ou Apple/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link para definir a password' }));
    await waitFor(() => expect(forgotPassword).toHaveBeenCalledWith('v@x.test'));
    expect(await screen.findByText(/Enviamos um email para v@x\.test/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar link para definir a password' })).not.toBeInTheDocument();
  });

  it('falha ao enviar o email mostra o erro e permite tentar de novo', async () => {
    forgotPassword.mockRejectedValueOnce(new Error('x'));
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link para definir a password' }));
    expect(await screen.findByText('Nao foi possivel enviar o email. Tente novamente.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link para definir a password' }));
    await waitFor(() => expect(forgotPassword).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Enviamos um email para v@x\.test/)).toBeInTheDocument();
  });

  it('sem email do viajante nao mostra o botao', () => {
    useTravelerAuthStore.setState({ traveler: { id: 't1', name: 'Viajante' } });
    montar();
    expect(screen.queryByRole('button', { name: 'Enviar link para definir a password' })).not.toBeInTheDocument();
  });
});
