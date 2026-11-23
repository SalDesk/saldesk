import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RelatorioPDF } from '../components/financial/PdfReport';
import useUiStore from '../store/uiStore';
import { portuguesNoEcra, chavesCruas } from './helpers/portuguesNoEcra';

/* O relatorio em PDF segue a lingua do painel: titulos, cabecalhos e "Gerado em" com a data no formato
   da lingua. O @react-pdf/renderer e simulado por elementos HTML para se ler o texto. */
vi.mock('@react-pdf/renderer', () => ({
  Document: ({ children }) => <div>{children}</div>,
  Page: ({ children }) => <div>{children}</div>,
  View: ({ children }) => <div>{children}</div>,
  Text: ({ children }) => <p>{children}</p>,
  StyleSheet: { create: (s) => s },
  pdf: vi.fn(),
}));

const DADOS = {
  operator: { name: 'Sal Tours' },
  periodo: { inicio: '2026-11-01', fim: '2026-11-30' },
  resumo: {
    atual: { receita: 1500, num_reservas: 12, taxa_ocupacao: 55, valor_medio: 125 },
    variacao: { receita: 12, num_reservas: 3, taxa_ocupacao: 5, valor_medio: -2 },
  },
  receitaDados: [{ periodo: '2026-11-01', num_reservas: 2, receita: 250 }],
  unidadesDados: [{ id: 'u1', name: 'Mergulho', num_reservas: 4, taxa_ocupacao: 40, receita: 600 }],
  topClientesDados: [{ customer_email: 'ana@x.cv', customer_name: 'Ana Silva', num_visitas: 2, total_gasto: 300 }],
};

afterEach(() => {
  cleanup();
  useUiStore.setState({ lang: 'pt' });
});

describe('relatório em PDF', () => {
  it('em_ingles_diz_Generated_on_com_a_data_inglesa_e_nao_tem_portugues', () => {
    useUiStore.setState({ lang: 'en' });
    render(<RelatorioPDF {...DADOS} />);
    expect(screen.getByText('Sal Tours — Financial report')).toBeInTheDocument();
    expect(screen.getByText(`Period: 2026-11-01 → 2026-11-30  ·  Generated on ${new Date().toLocaleDateString('en-GB')}`, { normalizer: s => s })).toBeInTheDocument();
    for (const r of ['Key metrics', 'Total revenue', 'No. of bookings', 'Occupancy rate', 'Average value',
      'Revenue by period', 'Performance by unit', 'Top customers in period', 'Unit', 'Customer', 'Visits',
      'SalDesk · Tourism management · Cape Verde']) {
      expect(screen.getByText(r)).toBeInTheDocument();
    }
    expect(screen.getByText('+12% vs previous')).toBeInTheDocument();
    expect(screen.getByText('-2% vs previous')).toBeInTheDocument();
    expect(portuguesNoEcra(['Sal Tours', 'Mergulho', 'Ana Silva'])).toEqual([]);
    expect(chavesCruas(['financial'])).toEqual([]);
  });

  it('em_portugues_diz_Gerado_em_com_a_data_portuguesa_como_sempre', () => {
    render(<RelatorioPDF {...DADOS} />);
    expect(screen.getByText('Sal Tours — Relatório Financeiro')).toBeInTheDocument();
    expect(screen.getByText(`Período: 2026-11-01 → 2026-11-30  ·  Gerado em ${new Date().toLocaleDateString('pt-PT')}`, { normalizer: s => s })).toBeInTheDocument();
    for (const r of ['Métricas Principais', 'Receita Total', 'Nº Reservas', 'Taxa Ocupação', 'Valor Médio',
      'Receita por Período', 'Performance por Unidade', 'Top Clientes no Período', 'SalDesk · Gestão Turística · Cabo Verde']) {
      expect(screen.getByText(r)).toBeInTheDocument();
    }
    expect(screen.getByText('+12% vs anterior')).toBeInTheDocument();
  });
});
