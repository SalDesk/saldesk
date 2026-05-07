import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';

const C = {
  primary: '#0F4C81',
  gray900: '#111827',
  gray500: '#6b7280',
  gray400: '#9ca3af',
  gray100: '#f3f4f6',
  gray50:  '#f9fafb',
  green:   '#16a34a',
  yellow:  '#ca8a04',
  red:     '#dc2626'
};

const s = StyleSheet.create({
  page:      { padding: 40, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  header:    { marginBottom: 24, paddingBottom: 16, borderBottom: `2px solid ${C.primary}` },
  titulo:    { fontSize: 22, fontWeight: 'bold', color: C.primary },
  subtitulo: { fontSize: 10, color: C.gray500, marginTop: 4 },

  seccao:       { marginBottom: 20 },
  seccaoTitulo: { fontSize: 11, fontWeight: 'bold', color: C.gray900, marginBottom: 8,
                  paddingBottom: 4, borderBottom: `1px solid ${C.gray100}` },

  metricsRow: { flexDirection: 'row', gap: 8 },
  metricBox:  { flex: 1, backgroundColor: C.gray50, padding: 10, borderRadius: 4, borderLeft: `3px solid ${C.primary}` },
  metricLabel:{ fontSize: 7, color: C.gray400, textTransform: 'uppercase', letterSpacing: 0.5 },
  metricVal:  { fontSize: 16, fontWeight: 'bold', color: C.primary, marginTop: 3 },
  metricSub:  { fontSize: 8, color: C.gray500, marginTop: 2 },

  tHead: { flexDirection: 'row', backgroundColor: C.gray100, padding: '6 8', borderRadius: 2 },
  tRow:  { flexDirection: 'row', padding: '5 8', borderBottom: `1px solid ${C.gray50}` },
  tCell: { fontSize: 9, color: C.gray500 },
  tBold: { fontSize: 9, color: C.gray900, fontWeight: 'bold' },
  cNome: { flex: 3 },
  cNum:  { flex: 1, textAlign: 'right' },
  cBar:  { flex: 2 },

  footer: { position: 'absolute', bottom: 28, left: 40, right: 40,
            textAlign: 'center', fontSize: 8, color: C.gray400 }
});

function fmt(v) { return `${Number(v).toFixed(2)} €`; }

function RelatorioPDF({ operator, periodo, resumo, receitaDados, unidadesDados, topClientesDados }) {
  const { atual, variacao } = resumo;
  const metricas = [
    { label: 'Receita Total',  value: fmt(atual.receita),      sub: variacao.receita >= 0 ? `+${variacao.receita}% vs anterior` : `${variacao.receita}% vs anterior` },
    { label: 'Nº Reservas',    value: String(atual.num_reservas), sub: `${variacao.num_reservas >= 0 ? '+' : ''}${variacao.num_reservas} vs anterior` },
    { label: 'Taxa Ocupação',  value: `${atual.taxa_ocupacao}%`,  sub: `${variacao.taxa_ocupacao >= 0 ? '+' : ''}${variacao.taxa_ocupacao}pp vs anterior` },
    { label: 'Valor Médio',    value: fmt(atual.valor_medio),   sub: `${variacao.valor_medio >= 0 ? '+' : ''}${variacao.valor_medio}% vs anterior` }
  ];

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Cabeçalho */}
        <View style={s.header}>
          <Text style={s.titulo}>{operator.name} — Relatório Financeiro</Text>
          <Text style={s.subtitulo}>
            Período: {periodo.inicio} → {periodo.fim}  ·  Gerado em {new Date().toLocaleDateString('pt-PT')}
          </Text>
        </View>

        {/* Métricas */}
        <View style={s.seccao}>
          <Text style={s.seccaoTitulo}>Métricas Principais</Text>
          <View style={s.metricsRow}>
            {metricas.map((m) => (
              <View key={m.label} style={s.metricBox}>
                <Text style={s.metricLabel}>{m.label}</Text>
                <Text style={s.metricVal}>{m.value}</Text>
                <Text style={s.metricSub}>{m.sub}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Receita por período */}
        {receitaDados.length > 0 && (
          <View style={s.seccao}>
            <Text style={s.seccaoTitulo}>Receita por Período</Text>
            <View style={s.tHead}>
              <Text style={[s.tCell, s.cNome]}>Período</Text>
              <Text style={[s.tCell, s.cNum]}>Reservas</Text>
              <Text style={[s.tCell, s.cNum]}>Receita</Text>
            </View>
            {receitaDados.slice(0, 20).map((d) => (
              <View key={d.periodo} style={s.tRow}>
                <Text style={[s.tCell, s.cNome]}>{d.periodo}</Text>
                <Text style={[s.tCell, s.cNum]}>{d.num_reservas}</Text>
                <Text style={[s.tBold, s.cNum]}>{fmt(d.receita)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Performance por unidade */}
        {unidadesDados.length > 0 && (
          <View style={s.seccao}>
            <Text style={s.seccaoTitulo}>Performance por Unidade</Text>
            <View style={s.tHead}>
              <Text style={[s.tCell, s.cNome]}>Unidade</Text>
              <Text style={[s.tCell, s.cNum]}>Res.</Text>
              <Text style={[s.tCell, s.cNum]}>Ocup.</Text>
              <Text style={[s.tCell, s.cNum]}>Receita</Text>
            </View>
            {unidadesDados.map((u) => (
              <View key={u.id} style={s.tRow}>
                <Text style={[s.tCell, s.cNome]}>{u.name}</Text>
                <Text style={[s.tCell, s.cNum]}>{u.num_reservas}</Text>
                <Text style={[s.tCell, s.cNum]}>{u.taxa_ocupacao}%</Text>
                <Text style={[s.tBold, s.cNum]}>{fmt(u.receita)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Top clientes */}
        {topClientesDados.length > 0 && (
          <View style={s.seccao}>
            <Text style={s.seccaoTitulo}>Top Clientes no Período</Text>
            <View style={s.tHead}>
              <Text style={[s.tCell, s.cNome]}>Cliente</Text>
              <Text style={[s.tCell, s.cNum]}>Visitas</Text>
              <Text style={[s.tCell, s.cNum]}>Total</Text>
            </View>
            {topClientesDados.map((c, i) => (
              <View key={c.customer_email} style={s.tRow}>
                <Text style={[s.tCell, s.cNome]}>{i + 1}. {c.customer_name}</Text>
                <Text style={[s.tCell, s.cNum]}>{c.num_visitas}</Text>
                <Text style={[s.tBold, s.cNum]}>{fmt(c.total_gasto)}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={s.footer}>
          SalDesk · Gestão Turística · Ilha do Sal, Cabo Verde
        </Text>
      </Page>
    </Document>
  );
}

export async function exportarPDF(dados) {
  const blob = await pdf(<RelatorioPDF {...dados} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `saldesk-relatorio-${dados.periodo.inicio}-${dados.periodo.fim}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
