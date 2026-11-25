/* Logica pura da vista Resumo: periodos, series da receita, melhor ponto e ocupacao das actividades.
   Sem React e sem Date.now: as datas chegam como texto AAAA-MM-DD e a conta e feita em UTC. */
import { variacaoPercentual } from './agendaLogic';
import { ativa, pessoasDe, capacidadeDoDia } from './mareLogic';
import { rotuloMes } from '../../utils/rotuloMes';

const DIA_MS = 24 * 60 * 60 * 1000;

const paraData = (iso) => new Date(`${iso}T00:00:00Z`);
const paraIso = (d) => d.toISOString().slice(0, 10);
const lista = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);

function somarDias(iso, dias) {
  return paraIso(new Date(paraData(iso).getTime() + dias * DIA_MS));
}

/* Numero de dias de um intervalo, inclusive nos dois extremos */
function numeroDeDias(inicio, fim) {
  return Math.round((paraData(fim) - paraData(inicio)) / DIA_MS) + 1;
}

/* Periodo anterior pela mesma regra do backend (calcularPeriodoAnterior): acaba na vespera de
   `inicio` e tem a mesma duracao, para o grafico bater certo com os numeros do /financial/resumo */
function periodoAnterior(inicio, fim) {
  const duracao = paraData(fim).getTime() - paraData(inicio).getTime();
  const anteriorFim = new Date(paraData(inicio).getTime() - DIA_MS);
  const anteriorInicio = new Date(anteriorFim.getTime() - duracao);
  return { anteriorInicio: paraIso(anteriorInicio), anteriorFim: paraIso(anteriorFim) };
}

/* chave: '7d' | '30d' | '12m'; hoje: AAAA-MM-DD */
export function periodoResumo(chave, hoje) {
  if (chave === '12m') {
    const d = paraData(hoje);
    const inicio = paraIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 11, 1)));
    return { inicio, fim: hoje, ...periodoAnterior(inicio, hoje), granularidade: 'month' };
  }
  const dias = chave === '7d' ? 7 : 30;
  const inicio = somarDias(hoje, -(dias - 1));
  return { inicio, fim: hoje, ...periodoAnterior(inicio, hoje), granularidade: 'day' };
}

/* Os periodos (dia AAAA-MM-DD ou mes AAAA-MM) de um intervalo, sem falhas */
function periodosDoIntervalo(inicio, fim, granularidade) {
  const saida = [];
  if (granularidade === 'month') {
    const a = paraData(inicio);
    const b = paraData(fim);
    let ano = a.getUTCFullYear();
    let mes = a.getUTCMonth();
    while (ano < b.getUTCFullYear() || (ano === b.getUTCFullYear() && mes <= b.getUTCMonth())) {
      saida.push(`${ano}-${String(mes + 1).padStart(2, '0')}`);
      mes += 1;
      if (mes > 11) { mes = 0; ano += 1; }
    }
    return saida;
  }
  const n = numeroDeDias(inicio, fim);
  for (let i = 0; i < n; i += 1) saida.push(somarDias(inicio, i));
  return saida;
}

/* A API so devolve os periodos com receita: preenche os que faltam com 0, para as duas series
   terem uma posicao por dia (ou mes) e se poderem comparar por posicao.
   Devolve [{ periodo, valor }] */
export function preencherSerie(dados, inicio, fim, granularidade) {
  const porPeriodo = new Map();
  lista(dados).forEach((p) => {
    const valor = Number(p.receita);
    porPeriodo.set(p.periodo, (porPeriodo.get(p.periodo) || 0) + (Number.isFinite(valor) ? valor : 0));
  });
  return periodosDoIntervalo(inicio, fim, granularidade).map((periodo) => ({
    periodo,
    valor: porPeriodo.get(periodo) || 0,
  }));
}

/* Junta as duas series por posicao: [{ rotulo, actual, anterior }]. A mais curta fica com null.
   Cada serie e [{ rotulo, valor }]; o rotulo e o do periodo actual (ou do anterior, se faltar) */
export function alinharSeries(actual, anterior, alinharAoFim = false) {
  const a = lista(actual);
  const b = lista(anterior);
  const n = Math.max(a.length, b.length);
  /* Por mes, a regra do backend (mesmo numero de dias) pode dar ao periodo anterior 11 ou 13 meses:
     alinha-se pelo fim (ultimo mes com ultimo mes) e o inicio da mais curta fica com null */
  const de = (l, i) => l[alinharAoFim ? i - (n - l.length) : i];
  return Array.from({ length: n }, (_, i) => {
    const x = de(a, i);
    const y = de(b, i);
    return { rotulo: x?.rotulo ?? y?.rotulo ?? '', actual: x ? x.valor : null, anterior: y ? y.valor : null };
  });
}

/* O backend nao pagina /reservations e o PostgREST corta em 1000 linhas sem avisar (HTTP 200):
   uma lista com esse tamanho pode estar incompleta e nao serve para calcular numeros */
export const LIMITE_LINHAS = 1000;
export function listaPossivelmenteCortada(lista) {
  return Array.isArray(lista) && lista.length >= LIMITE_LINHAS;
}

/* O ponto mais alto do periodo actual; sem receita nenhuma, null */
export function melhorPonto(series) {
  let melhor = null;
  lista(series).forEach((p, indice) => {
    const v = Number(p.actual);
    if (!Number.isFinite(v) || v <= 0) return;
    if (melhor === null || v > melhor.valor) melhor = { indice, rotulo: p.rotulo, valor: v };
  });
  return melhor;
}

/* Soma de uma serie alinhada (so o periodo actual) */
export function totalActual(series) {
  return lista(series).reduce((s, p) => s + (Number.isFinite(Number(p.actual)) ? Number(p.actual) : 0), 0);
}

/* Variacao percentual inteira como texto com sinal ("+12%", "-8%", "0%"); sem base, null */
export function deltaPercentual(atual, anterior) {
  const pct = variacaoPercentual(atual, anterior);
  if (pct === null) return null;
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

/* Variacao da ocupacao em pontos percentuais inteiros; sem base (anterior 0 ou em falta), null */
export function deltaPontos(atual, anterior) {
  const a = Number(atual);
  const b = Number(anterior);
  if (atual === null || anterior === null || atual === undefined || anterior === undefined) return null;
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null;
  return Math.round(a - b);
}

/* Ocupacao das actividades num intervalo: pessoas das reservas validas a dividir pela capacidade
   de todos os tours activos com capacidade, ao longo dos dias. Sem capacidade, null */
export function ocupacaoActividades(reservas, tours, inicio, fim) {
  const dias = numeroDeDias(inicio, fim);
  const capacidades = lista(tours)
    .filter((t) => t.status !== 'inactive' && t.is_active !== false)
    .map((t) => ({ id: t.id, capacidade: capacidadeDoDia(t) }))
    .filter((t) => t.capacidade !== null);
  if (capacidades.length === 0 || !(dias > 0)) return null;
  const ids = new Set(capacidades.map((t) => t.id));
  const total = capacidades.reduce((s, t) => s + t.capacidade, 0) * dias;
  const pessoas = lista(reservas)
    .filter((r) => ativa(r) && ids.has(r.unit_id) && r.check_in >= inicio && r.check_in <= fim)
    .reduce((s, r) => s + pessoasDe(r), 0);
  return Math.min(100, Math.round((pessoas / total) * 100));
}

/* Rotulo curto de um periodo da API: dia AAAA-MM-DD -> "25 Nov"; mes AAAA-MM -> "Nov 2026",
   com o nome do mes na lingua do painel (t) */
export function rotuloPeriodo(periodo, granularidade, t) {
  const [ano, mes, dia] = String(periodo).split('-');
  const nome = rotuloMes(Number(mes) - 1, t);
  return granularidade === 'month' ? `${nome} ${ano}` : `${Number(dia)} ${nome}`;
}

/* Origens que contam como reservas directas (sem comissao a plataformas) */
const ORIGENS_DIRECTAS = ['direct', 'public', 'admin'];

/* Percentagem inteira de reservas directas, pelo numero de reservas de cada canal; sem reservas, null */
export function quotaDirectas(canais) {
  const total = lista(canais).reduce((s, c) => s + (Number(c.num_reservas) || 0), 0);
  if (total <= 0) return null;
  const directas = lista(canais)
    .filter((c) => ORIGENS_DIRECTAS.includes(c.source))
    .reduce((s, c) => s + (Number(c.num_reservas) || 0), 0);
  return Math.round((directas / total) * 100);
}

/* Percentagens inteiras que somam 100 (maior resto): arredondar uma a uma pode dar 99 ou 101 */
export function repartirPercentagens(valores) {
  const total = valores.reduce((s, v) => s + v, 0);
  if (total <= 0) return valores.map(() => 0);
  const exactos = valores.map((v) => (v / total) * 100);
  const base = exactos.map(Math.floor);
  let falta = 100 - base.reduce((s, v) => s + v, 0);
  exactos
    .map((e, i) => ({ i, resto: e - base[i] }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i)
    .forEach(({ i }) => { if (falta > 0) { base[i] += 1; falta -= 1; } });
  return base;
}

/* Fatias do donut: uma por origem, da maior para a mais pequena; passando de `max`, as mais pequenas
   juntam-se em { source: null, outros: true }. Devolve [{ source, num, pct }] */
export function fatiasCanais(canais, max = 5) {
  const validos = lista(canais)
    .map((c) => ({ source: c.source, num: Number(c.num_reservas) || 0 }))
    .filter((c) => c.num > 0)
    .sort((a, b) => b.num - a.num);
  if (validos.length === 0) return [];
  let fatias = validos;
  if (validos.length > max) {
    const resto = validos.slice(max - 1).reduce((s, c) => s + c.num, 0);
    fatias = [...validos.slice(0, max - 1), { source: null, outros: true, num: resto }];
  }
  const pcts = repartirPercentagens(fatias.map((f) => f.num));
  return fatias.map((f, i) => ({ ...f, pct: pcts[i] }));
}

/* Comparar nomes sem maiusculas nem acentos */
const chaveTexto = (v) => String(v).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/* Nome de pais (em pt e en, sem maiusculas nem acentos) -> codigo ISO; construido uma vez */
/* Codigos antigos ou especiais que o Intl ainda nomeia (DD, por exemplo, tambem diz "Alemanha") */
const CODIGOS_OBSOLETOS = new Set(['AN', 'BU', 'CS', 'DD', 'EU', 'EZ', 'FX', 'NT', 'QU', 'SU', 'TP', 'UK', 'UN', 'YD', 'YU', 'ZR']);
let nomesDePaises = null;
function codigoPorNome(texto) {
  if (!nomesDePaises) {
    nomesDePaises = new Map();
    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    ['pt', 'en'].forEach((lingua) => {
      let nomes;
      try { nomes = new Intl.DisplayNames([lingua], { type: 'region' }); } catch { return; }
      for (const a of letras) {
        for (const b of letras) {
          const codigo = a + b;
          if (CODIGOS_OBSOLETOS.has(codigo)) continue;
          try {
            const nome = nomes.of(codigo);
            if (nome && nome !== codigo && !nomesDePaises.has(chaveTexto(nome))) nomesDePaises.set(chaveTexto(nome), codigo);
          } catch { /* codigo invalido: ignora */ }
        }
      }
    });
  }
  return nomesDePaises.get(chaveTexto(texto)) || null;
}

/* Paises das reservas (texto livre): 2 letras e codigo ISO em maiusculas; um nome conhecido passa a
   codigo; o resto fica como foi escrito (1a ocorrencia), agrupado sem maiusculas nem acentos.
   Devolve os n maiores como [{ codigo, pct }] em percentagem das reservas com pais */
export function topPaises(reservas, n = 5) {
  const contagem = new Map();
  lista(reservas).forEach((r) => {
    /* o grafico dos canais (backend) exclui as canceladas: os paises descrevem as mesmas reservas */
    if (r.status === 'cancelled') return;
    const texto = String(r.customer_country || '').trim();
    if (!texto) return;
    const codigo = /^[A-Za-z]{2}$/.test(texto) ? texto.toUpperCase() : codigoPorNome(texto);
    const chave = codigo || `t:${chaveTexto(texto)}`;
    const atual = contagem.get(chave);
    if (atual) atual.n += 1;
    else contagem.set(chave, { codigo: codigo || texto, n: 1 });
  });
  const total = [...contagem.values()].reduce((s, v) => s + v.n, 0);
  return [...contagem.values()]
    .sort((a, b) => b.n - a.n || a.codigo.localeCompare(b.codigo))
    .slice(0, n)
    .map((v) => ({ codigo: v.codigo, pct: Math.round((v.n / total) * 100) }));
}
