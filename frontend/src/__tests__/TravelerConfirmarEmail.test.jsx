import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import TravelerPortal from '../pages/traveler/TravelerPortal';
import TravelerConfirmEmail from '../pages/traveler/TravelerConfirmEmail';
import * as travelerService from '../services/travelerService';
import { sendVerificationEmail, confirmEmail } from '../services/travelerAuthService';
import { discoverUnits } from '../services/publicService';
import useTravelerAuthStore from '../store/travelerAuthStore';

vi.mock('../services/travelerService', () => ({
  getProfile: vi.fn(), updateProfile: vi.fn(), getBookings: vi.fn(), getWishlist: vi.fn(), addToWishlist: vi.fn(),
  removeFromWishlist: vi.fn(), downloadInvoice: vi.fn(), submitReview: vi.fn(), getRecommendations: vi.fn(),
  getNotifications: vi.fn(), markNotificationRead: vi.fn(), uploadAvatar: vi.fn(),
}));
vi.mock('../services/travelerAuthService', () => ({
  logout: vi.fn(), changePassword: vi.fn(), forgotPassword: vi.fn(), sendVerificationEmail: vi.fn(), confirmEmail: vi.fn(),
}));
vi.mock('../services/publicService', () => ({ discoverUnits: vi.fn() }));
vi.mock('../hooks/useThemeEffect', () => ({ useThemeEffect: () => {} }));

const VIAJANTE = { id: 't1', name: 'Ana', email: 'ana@exemplo.cv' };

beforeEach(() => {
  travelerService.getProfile.mockReset();
  travelerService.getBookings.mockReset().mockResolvedValue([]);
  travelerService.getWishlist.mockReset().mockResolvedValue([]);
  travelerService.getNotifications.mockReset().mockResolvedValue({ items: [], unreadCount: 0 });
  travelerService.getRecommendations.mockReset().mockResolvedValue({ items: [], personalized: false });
  discoverUnits.mockReset().mockResolvedValue([]);
  sendVerificationEmail.mockReset().mockResolvedValue({ enviado: true });
  confirmEmail.mockReset().mockResolvedValue({ confirmado: true });
  useTravelerAuthStore.setState({ token: 'tok', traveler: VIAJANTE });
});
afterEach(() => {
  cleanup();
  useTravelerAuthStore.setState({ token: null, traveler: null });
});

const rotas = (url) => render(
  <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/viajante/confirmar-email" element={<TravelerConfirmEmail />} />
      <Route path="/viajante/*" element={<TravelerPortal />} />
    </Routes>
  </MemoryRouter>,
);

describe('Portal: email por confirmar', () => {
  it('actualiza_o_perfil_e_mostra_o_aviso_em_vez_das_reservas', async () => {
    travelerService.getProfile.mockResolvedValue({ ...VIAJANTE, email_verificado: false });
    rotas('/viajante');
    expect(await screen.findByText('Confirme o seu email para ver as suas reservas')).toBeInTheDocument();
    expect(screen.getByText(/Enviámos um link para ana@exemplo.cv/)).toBeInTheDocument();
    expect(useTravelerAuthStore.getState().traveler.email_verificado).toBe(false);
    fireEvent.click(screen.getAllByText('Reservas').find(e => e.closest('button')).closest('button'));
    expect(await screen.findByText('Confirme o seu email para ver as suas reservas')).toBeInTheDocument();
    expect(travelerService.getBookings).not.toHaveBeenCalled();
  });

  it('reenviar_pede_um_novo_link_e_diz_para_onde_foi', async () => {
    travelerService.getProfile.mockResolvedValue({ ...VIAJANTE, email_verificado: false });
    rotas('/viajante');
    fireEvent.click(await screen.findByRole('button', { name: 'Reenviar email' }));
    await waitFor(() => expect(sendVerificationEmail).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Enviámos um novo link para ana@exemplo.cv.')).toBeInTheDocument();
  });

  it('falha_a_reenviar_avisa', async () => {
    travelerService.getProfile.mockResolvedValue({ ...VIAJANTE, email_verificado: false });
    sendVerificationEmail.mockRejectedValue(new Error('x'));
    rotas('/viajante');
    fireEvent.click(await screen.findByRole('button', { name: 'Reenviar email' }));
    expect(await screen.findByText('Não foi possível enviar o email. Tente daqui a pouco.')).toBeInTheDocument();
  });

  it('com_o_email_confirmado_carrega_as_reservas_sem_aviso', async () => {
    travelerService.getProfile.mockResolvedValue({ ...VIAJANTE, email_verificado: true });
    rotas('/viajante');
    await waitFor(() => expect(travelerService.getBookings).toHaveBeenCalled());
    expect(screen.queryByText('Confirme o seu email para ver as suas reservas')).toBeNull();
  });
});

describe('Pagina do link de confirmacao', () => {
  it('confirma_e_actualiza_a_sessao_aberta', async () => {
    useTravelerAuthStore.setState({ token: 'tok', traveler: { ...VIAJANTE, email_verificado: false } });
    rotas('/viajante/confirmar-email?u=u1&t=abc');
    expect(await screen.findByText('Email confirmado')).toBeInTheDocument();
    expect(confirmEmail).toHaveBeenCalledWith('u1', 'abc');
    expect(screen.getByRole('link', { name: 'Ver as minhas reservas' })).toHaveAttribute('href', '/viajante');
    expect(useTravelerAuthStore.getState().traveler.email_verificado).toBe(true);
  });

  it('link_expirado_mostra_a_mensagem_do_servidor', async () => {
    confirmEmail.mockRejectedValue({ response: { data: { code: 'TOKEN_EXPIRED', error: 'Este link ja expirou. Entre na sua conta e peca um novo.' } } });
    rotas('/viajante/confirmar-email?u=u1&t=abc');
    expect(await screen.findByText('Este link ja expirou. Entre na sua conta e peca um novo.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar na conta' })).toHaveAttribute('href', '/viajante/entrar');
  });

  it('sem_os_dados_do_link_nao_chama_o_servidor', async () => {
    rotas('/viajante/confirmar-email');
    expect(await screen.findByText('Este link não está completo. Abra-o outra vez a partir do email.')).toBeInTheDocument();
    expect(confirmEmail).not.toHaveBeenCalled();
  });
});
