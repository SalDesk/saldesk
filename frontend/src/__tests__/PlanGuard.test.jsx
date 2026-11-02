import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PlanGuard, { UpgradeModal } from '../components/PlanGuard';
import useAuthStore from '../store/authStore';

const navigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => navigate };
});

function renderComRouter(ui) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {ui}
    </MemoryRouter>
  );
}

describe('UpgradeModal', () => {
  beforeEach(() => {
    navigate.mockClear();
  });

  it('o botao Ver planos navega e fecha o modal', () => {
    const onClose = vi.fn();
    renderComRouter(<UpgradeModal plan="pro" feature="automacoes" onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /Ver planos de subscricao/ }));

    expect(navigate).toHaveBeenCalledWith('/definicoes?tab=facturacao');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape no documento fecha o modal', () => {
    const onClose = vi.fn();
    renderComRouter(<UpgradeModal plan="pro" feature="automacoes" onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('remove o ouvinte de Escape ao desmontar', () => {
    const onClose = vi.fn();
    const { unmount } = renderComRouter(<UpgradeModal plan="pro" feature="automacoes" onClose={onClose} />);

    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('PlanGuard (guarda de rota)', () => {
  beforeEach(() => {
    navigate.mockClear();
    useAuthStore.setState({ operator: { operator_type: 'activity', plan: 'starter' } });
  });

  it('Ver planos so navega, sem fechar nada', () => {
    renderComRouter(
      <PlanGuard feature="automacoes">
        <p>Conteudo</p>
      </PlanGuard>
    );

    fireEvent.click(screen.getByRole('button', { name: /Ver planos de subscricao/ }));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/definicoes?tab=facturacao');
  });

  it('Fechar volta atras na historia', () => {
    renderComRouter(
      <PlanGuard feature="automacoes">
        <p>Conteudo</p>
      </PlanGuard>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(navigate).toHaveBeenCalledWith(-1);
  });

  it('com acesso mostra o conteudo', () => {
    useAuthStore.setState({ operator: { operator_type: 'activity', plan: 'pro' } });
    renderComRouter(
      <PlanGuard feature="automacoes">
        <p>Conteudo</p>
      </PlanGuard>
    );
    expect(screen.getByText('Conteudo')).toBeInTheDocument();
    expect(screen.queryByText('Funcionalidade Pro')).not.toBeInTheDocument();
  });
});
