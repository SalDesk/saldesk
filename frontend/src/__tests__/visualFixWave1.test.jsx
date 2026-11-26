import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Tabs from '../components/ui/Tabs';
import ConectRow from '../components/shared/ConectRow';
import RentacarTable from '../pages/reservations/RentacarTable';
import { PriceTiersEditor } from '../components/units/forms/editors';
import useUiStore from '../store/uiStore';

/* Sem rede: a tabela so importa o servico de reservas */
vi.mock('../services/reservationsService', () => ({
  changeStatus: vi.fn(),
}));

/* Ajustes visuais da verificacao no browser (Fase 3): so classes, nenhum comportamento */
describe('ajustes visuais (fix wave 1)', () => {
  afterEach(cleanup);

  it('Tabs: o contentor com scroll horizontal não mostra barra vertical', () => {
    render(<Tabs tabs={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]} value="a" onChange={() => {}} />);
    const lista = screen.getByRole('tablist');
    expect(lista.className).toContain('overflow-x-auto');
    expect(lista.className).toContain('overflow-y-hidden');
  });

  it('ConectRow: o badge não parte o texto, o botão quebra dentro do cartão e a linha pode quebrar', () => {
    render(<ConectRow unit={{ id: 'u1', conect_status: 'draft' }} onSubmitConect={() => {}} />);
    const badge = screen.getByText('Não submetido');
    const botao = screen.getByRole('button', { name: /Submeter ao Conect/ });
    expect(badge.className).toContain('whitespace-nowrap');
    expect(botao.className).toContain('max-w-full');
    expect(badge.parentElement.className).toContain('flex-wrap');
  });

  it('PriceTiersEditor: a linha quebra no telemóvel e o botão de remover e neutro com hover vermelho', () => {
    render(<PriceTiersEditor tiers={[{ pax_min: '1', pax_max: '2', price: '70' }]} onChange={() => {}} />);
    const preco = screen.getByLabelText('Preço do escalão 1');
    expect(preco.closest('div.flex.flex-wrap')).not.toBeNull();
    const remover = screen.getByRole('button', { name: 'Remover escalão 1' });
    /* botao nativo no estilo Mare: neutro, vermelho ao passar o rato, 44 px no telemovel */
    expect(remover.className).toContain('text-n-500');
    expect(remover.className).toContain('hover:text-error');
    expect(remover.className).toContain('hover:bg-[var(--error-light)]');
    expect(remover.className).toContain('min-h-11');
  });

  it('RentacarTable: o botão Levantamento usa o token de sucesso, sem cor hex fixa', () => {
    useUiStore.setState({ lang: 'pt' });
    const hoje = new Date().toLocaleDateString('en-CA');
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <RentacarTable
          reservations={[{
            id: 'aaaaaaaa-0001', unit_id: 'u1', status: 'confirmed', guests: 2,
            check_in: hoje, check_out: hoje, customer_name: 'Cliente Alfa', total_price: 100, notes_internal: '{}',
          }]}
          units={[{ id: 'u1', name: 'Carro 1', unit_type: 'vehicle', description: '{}' }]}
          onEdit={vi.fn()} onDelete={vi.fn()} onLevantamento={vi.fn()} onDevolucao={vi.fn()}
          onUpdate={vi.fn()} onView={vi.fn()}
        />
      </MemoryRouter>
    );
    const linha = within(screen.getByRole('table')).getAllByRole('row')[1];
    const botao = within(linha).getByRole('button', { name: /Levantamento/ });
    expect(botao.className).toContain('bg-[var(--success)]');
    expect(botao.className).not.toMatch(/#[0-9A-Fa-f]{3,6}/);
  });
});
