/* Acertos finais da fase Operacao do estilo Mare: botoes de icone a 44 px, nomes acessiveis, Badge no manifesto */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { IconBtn } from '../components/shared/IconBtn';
import ConectRow from '../components/shared/ConectRow';
import ReservationCard from '../components/reservations/ReservationCard';
import ActivityTable from '../pages/reservations/ActivityTable';
import RentacarTable from '../pages/reservations/RentacarTable';
import RestaurantTable from '../pages/reservations/RestaurantTable';
import ManifestoModal from '../pages/reservations/ManifestoModal';
import useUiStore from '../store/uiStore';

vi.mock('../services/reservationsService', () => ({ changeStatus: vi.fn(), deleteReservation: vi.fn() }));
vi.mock('../services/fleetService', () => ({ listFleet: vi.fn().mockResolvedValue([]) }));
vi.mock('../services/assignmentService', () => ({ createCompositeAssignment: vi.fn() }));

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

let movel;
function simularEcra(ehMovel) {
  movel = ehMovel;
  window.matchMedia = vi.fn((query) => ({
    get matches() { return query.includes('max-width') ? movel : !movel; },
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => { useUiStore.setState({ lang: 'pt' }); });
afterEach(() => { cleanup(); delete window.matchMedia; });

const temClasse = (el, c) => el.className.split(/\s+/).includes(c);
const porPrefixo = (raiz, nome) => within(raiz).getAllByRole('button').find(x => x.getAttribute('aria-label')?.startsWith(nome));

describe('IconBtn (unitario)', () => {
  it('o hover omisso nao escreve "undefined" na classe', () => {
    render(<IconBtn icon={Pencil} label="Editar" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Editar' }).className).not.toContain('undefined');
  });

  it('nome acessivel, title opcional, classe extra, disabled e clique', () => {
    const onClick = vi.fn();
    const { rerender } = render(<IconBtn icon={Pencil} label="Editar" onClick={onClick} hover="hover:text-ocean-700" />);
    const b = screen.getByRole('button', { name: 'Editar' });
    expect(b).not.toHaveAttribute('title');
    expect(b.className).toContain('hover:text-ocean-700');
    fireEvent.click(b);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<IconBtn icon={Pencil} label="Editar" title="Dica" className="text-[var(--success)]" disabled onClick={onClick} />);
    const d = screen.getByRole('button', { name: 'Editar' });
    expect(d).toHaveAttribute('title', 'Dica');
    expect(d).toBeDisabled();
    expect(temClasse(d, 'text-[var(--success)]')).toBe(true);
    expect(temClasse(d, 'min-h-11')).toBe(true);
  });
});

describe('IconBtn: cor do chamador substitui a cor base', () => {
  it('com className nao tem text-n-500; sem className tem', () => {
    const { rerender } = render(<IconBtn icon={Pencil} label="X" className="text-[var(--success)]" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'X' }).className.split(/\s+/)).not.toContain('text-n-500');
    rerender(<IconBtn icon={Pencil} label="X" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'X' }).className.split(/\s+/)).toContain('text-n-500');
  });
});

describe('ReservationCard: botoes de icone a 44 px', () => {
  it('ver, editar e eliminar tem min-h-11', () => {
    const r = { id: 'r1', status: 'pending', source: 'direct', total_price: 10, guests: 2, customer_name: 'Ana', units: { name: 'Quarto' } };
    const { container } = render(<ReservationCard reservation={r} onUpdate={() => {}} onEdit={() => {}} onView={() => {}} />);
    for (const nome of ['Ver', 'Editar', 'Eliminar']) {
      const b = porPrefixo(container, nome);
      expect(b, nome).toBeTruthy();
      expect(temClasse(b, 'min-h-11'), nome).toBe(true);
    }
  });
});

const ATIVIDADE = {
  id: 'aaaaaaaa-0001', unit_id: 'u1', status: 'confirmed', guests: 2, source: 'direct',
  check_in: '2026-11-20', check_out: '2026-11-21', customer_name: 'Cliente Alfa', total_price: 100,
  units: { name: 'Tour Pedra de Lume' },
};

function propsAtividade(over = {}) {
  return {
    reservations: [ATIVIDADE], units: [], guides: [], onEdit: vi.fn(), onDelete: vi.fn(), onUpdate: vi.fn(),
    onReschedule: vi.fn(), onNoShow: vi.fn(), onVoucher: vi.fn(), voucherLoading: null, onView: vi.fn(),
    ...over,
  };
}

describe('ActivityTable: cartoes do telemovel', () => {
  it('os botoes de icone tem nome acessivel, title e 44 px', () => {
    const props = propsAtividade();
    const { container } = render(<MemoryRouter future={FUTURE}><ActivityTable {...props} /></MemoryRouter>);
    const bloco = container.querySelector('.md\\:hidden');
    for (const nome of ['Reagendar', 'Enviar voucher', 'No-show', 'Atribuir equipa']) {
      const b = within(bloco).getByRole('button', { name: nome });
      expect(b).toHaveAttribute('aria-label', nome);
      expect(b).toHaveAttribute('title', nome);
      expect(temClasse(b, 'min-h-11'), nome).toBe(true);
    }
    for (const nome of ['Ver', 'Editar', 'Eliminar']) {
      expect(temClasse(porPrefixo(bloco, nome), 'min-h-11'), nome).toBe(true);
    }
    fireEvent.click(within(bloco).getByRole('button', { name: 'Reagendar' }));
    expect(props.onReschedule).toHaveBeenCalled();
  });

  it('o voucher fica desactivado enquanto envia', () => {
    const { container } = render(<MemoryRouter future={FUTURE}><ActivityTable {...propsAtividade({ voucherLoading: ATIVIDADE.id })} /></MemoryRouter>);
    expect(within(container.querySelector('.md\\:hidden')).getByRole('button', { name: 'Enviar voucher' })).toBeDisabled();
  });

  it('o botao de avancar estado usa o anel areia', () => {
    const { container } = render(<MemoryRouter future={FUTURE}><ActivityTable {...propsAtividade()} /></MemoryRouter>);
    const avancar = screen.getAllByRole('button', { name: /Check-in/ });
    expect(avancar.length).toBeGreaterThan(0);
    for (const b of avancar) {
      expect(b.className).toContain('focus-visible:ring-sand-500');
      expect(b.className).not.toContain('ring-ocean-300');
    }
  });
});

describe('Rent-a-car e restaurante no telemovel: botoes de icone a 44 px', () => {
  it('rent-a-car: ver, editar e eliminar, anel areia', () => {
    simularEcra(true);
    const r = { id: 'aaaaaaaa-1', unit_id: 'u1', status: 'confirmed', customer_name: 'Maria', check_in: '2026-11-20', check_out: '2026-11-25', total_price: 250 };
    const { container } = render(<RentacarTable reservations={[r]} units={[]} onEdit={() => {}} onDelete={() => {}} onLevantamento={() => {}} onDevolucao={() => {}} onUpdate={() => {}} onView={() => {}} />);
    for (const nome of ['Ver', 'Editar', 'Eliminar']) {
      expect(temClasse(porPrefixo(container, nome), 'min-h-11'), nome).toBe(true);
    }
    expect(container.innerHTML).not.toContain('ring-ocean-300');
  });

  it('restaurante: turno com nome acessivel e ver, editar, eliminar', () => {
    simularEcra(true);
    const r = { id: 'cccccccc-3', unit_id: 'm1', status: 'confirmed', customer_name: 'Ana', check_in: '2026-11-21', start_time: '20:30:00', guests: 4 };
    const onDetails = vi.fn();
    const { container } = render(<RestaurantTable reservations={[r]} units={[]} onEdit={() => {}} onDelete={() => {}} onDetails={onDetails} onUpdate={() => {}} onView={() => {}} />);
    const u = within(container).getByRole('button', { name: 'Turno / pedidos especiais' });
    expect(u).toHaveAttribute('aria-label', 'Turno / pedidos especiais');
    expect(u).toHaveAttribute('title', 'Turno / pedidos especiais');
    expect(temClasse(u, 'min-h-11')).toBe(true);
    fireEvent.click(u);
    expect(onDetails).toHaveBeenCalled();
    for (const nome of ['Ver', 'Editar', 'Eliminar']) {
      expect(temClasse(porPrefixo(container, nome), 'min-h-11'), nome).toBe(true);
    }
    expect(container.innerHTML).not.toContain('ring-ocean-300');
  });
});

describe('ManifestoModal: estado com o Badge do sistema', () => {
  it('confirmado usa o tom ocean do Badge', () => {
    const r = { id: 'a', unit_id: 't1', status: 'confirmed', check_in: '2026-11-20', guests: 2, customer_name: 'Zeca', total_price: 100 };
    render(<ManifestoModal open onClose={() => {}} reservations={[r]} units={[{ id: 't1', name: 'Tour Norte' }]} tourIdInicial="t1" />);
    const rotulo = within(screen.getByRole('table')).getByText('Confirmada');
    expect(rotulo.className).toContain('app:bg-ocean-100');
    expect(rotulo.className).not.toContain('turquoise');
  });
});

describe('ConectRow: botao com texto a 44 px no telemovel', () => {
  it('Submeter ao Conect tem min-h-11 md:min-h-0', () => {
    render(<ConectRow unit={{ id: 'x', conect_status: 'draft' }} onSubmitConect={() => {}} />);
    const b = screen.getByRole('button');
    expect(temClasse(b, 'min-h-11')).toBe(true);
    expect(temClasse(b, 'md:min-h-0')).toBe(true);
  });
});
