/* Linha de tendencia em miniatura (112x36). O ultimo ponto fica marcado a areia.
   valores: numeros do mais antigo ao mais recente; rotulo: texto para leitores de ecra. */
const LARGURA = 112;
const ALTURA = 36;
const MARGEM = 5;

export function pontosDaSerie(valores) {
  const lista = (Array.isArray(valores) ? valores : []).map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));
  if (lista.length === 0) return [];
  const minimo = Math.min(...lista);
  const maximo = Math.max(...lista);
  const util = ALTURA - 2 * MARGEM;
  const passo = lista.length === 1 ? 0 : (LARGURA - 2 * MARGEM) / (lista.length - 1);
  const escala = maximo === minimo ? 0 : util / (maximo - minimo);
  return lista.map((v, i) => ({
    x: lista.length === 1 ? LARGURA * 0.5 : MARGEM + i * passo,
    /* serie constante: linha a meia altura */
    y: maximo === minimo ? ALTURA * 0.5 : MARGEM + util - (v - minimo) * escala,
  }));
}

export default function Sparkline({ valores, rotulo }) {
  const pontos = pontosDaSerie(valores);
  if (pontos.length === 0) return null;
  const caminho = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const ultimo = pontos[pontos.length - 1];
  return (
    <svg
      width={LARGURA}
      height={ALTURA}
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      role="img"
      aria-label={rotulo}
      className="shrink-0"
    >
      <path d={caminho} fill="none" className="stroke-ocean-500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={ultimo.x} cy={ultimo.y} r="3.5" className="fill-sand-500" />
    </svg>
  );
}
