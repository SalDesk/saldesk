export default function SimpleChart({ dados, altura = 180 }) {
  if (!dados || dados.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-300 text-sm" style={{ height: altura }}>
        Sem dados para o período seleccionado
      </div>
    );
  }

  const max = Math.max(...dados.map((d) => d.receita), 1);
  const barWidth = Math.max(10, Math.min(48, Math.floor(700 / dados.length) - 6));
  const gap = 4;
  const paddingLeft = 50;
  const paddingBottom = 28;
  const chartWidth = paddingLeft + dados.length * (barWidth + gap);
  const chartHeight = altura + paddingBottom;

  // Linhas de referência (0%, 25%, 50%, 75%, 100%)
  const linhas = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="overflow-x-auto">
      <svg width={Math.max(chartWidth, 400)} height={chartHeight} className="block">
        {/* Linhas de referência + valores eixo Y */}
        {linhas.map((frac) => {
          const y = altura - frac * altura;
          return (
            <g key={frac}>
              <line x1={paddingLeft} y1={y} x2={chartWidth} y2={y} stroke="#f3f4f6" strokeWidth={1} />
              <text x={paddingLeft - 6} y={y + 3} textAnchor="end" fontSize={9} fill="#9ca3af">
                {Math.round(max * frac)}
              </text>
            </g>
          );
        })}

        {/* Barras */}
        {dados.map((d, i) => {
          const x = paddingLeft + i * (barWidth + gap);
          const h = Math.max(2, (d.receita / max) * altura);
          const y = altura - h;
          const label = dados.length <= 15 ? d.periodo.slice(5) : d.periodo.slice(2, 7);

          return (
            <g key={d.periodo}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={h}
                rx={3}
                fill="#0F4C81"
                opacity={0.8}
                className="hover:opacity-100 transition-opacity"
              >
                <title>{d.periodo}: {Number(d.receita).toFixed(2)} € ({d.num_reservas} res.)</title>
              </rect>
              {barWidth >= 20 && (
                <text
                  x={x + barWidth / 2}
                  y={altura + 16}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#9ca3af"
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}

        {/* Eixo X */}
        <line x1={paddingLeft} y1={altura} x2={chartWidth} y2={altura} stroke="#e5e7eb" strokeWidth={1} />
      </svg>
    </div>
  );
}
