/* Botoes de confirmar, cancelar e fechar dos componentes base seguem a lingua do painel.
   Em pt o texto fica exactamente como era. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Modal from '../components/ui/Modal';
import { ToastContainer } from '../components/ui/Toast';
import useToastStore from '../store/toastStore';
import useUiStore from '../store/uiStore';

const TEXTOS = {
  pt: { cancelar: 'Cancelar', confirmar: 'Confirmar', fechar: 'Fechar' },
  en: { cancelar: 'Cancel', confirmar: 'Confirm', fechar: 'Close' },
  de: { cancelar: 'Abbrechen', confirmar: 'Bestätigen', fechar: 'Schließen' },
  nl: { cancelar: 'Annuleren', confirmar: 'Bevestigen', fechar: 'Sluiten' },
};

beforeEach(() => { useToastStore.setState({ toasts: [] }); });
afterEach(() => { cleanup(); useUiStore.setState({ lang: 'pt' }); vi.restoreAllMocks(); });

describe.each(['pt', 'en', 'de', 'nl'])('componentes base em %s', (lang) => {
  beforeEach(() => { useUiStore.setState({ lang }); });

  it('ConfirmDialog mostra cancelar e confirmar na lingua', () => {
    render(<ConfirmDialog mensagem="Certeza?" onConfirmar={() => {}} onCancelar={() => {}} />);
    expect(screen.getByRole('button', { name: TEXTOS[lang].cancelar })).toBeTruthy();
    expect(screen.getByRole('button', { name: TEXTOS[lang].confirmar })).toBeTruthy();
  });

  it('labelConfirmar explicito continua a ganhar', () => {
    render(<ConfirmDialog mensagem="Certeza?" labelConfirmar="Eliminar" onConfirmar={() => {}} onCancelar={() => {}} />);
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: TEXTOS[lang].confirmar })).toBeNull();
  });

  it('Modal tem o botao de fechar na lingua', () => {
    render(<Modal open onClose={() => {}} title="Titulo">x</Modal>);
    expect(screen.getByRole('button', { name: TEXTOS[lang].fechar })).toBeTruthy();
  });

  it('Toast tem o botao de fechar na lingua', () => {
    render(<ToastContainer />);
    act(() => { useToastStore.setState({ toasts: [{ id: 1, type: 'success', message: 'ok' }] }); });
    expect(screen.getByRole('button', { name: TEXTOS[lang].fechar })).toBeTruthy();
  });
});
