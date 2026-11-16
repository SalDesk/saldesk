/* Vista de cartoes de uma tabela, para o telemovel: um cartao por linha, gerado a partir das MESMAS colunas
   da tabela (etiqueta + conteudo), com a coluna de accoes (etiqueta vazia) no fundo. Assim os dois formatos
   nunca divergem. */
export default function ColumnCards({ columns, rows }) {
  const dados = columns.filter((c) => c.label !== '');
  const acoes = columns.find((c) => c.label === '');

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.id} className="bg-white rounded-md border border-n-200 shadow-sm p-4 space-y-2">
          {dados.map((c) => (
            <div key={c.key} className="flex items-start justify-between gap-3">
              <span className="text-xs font-body text-n-400 shrink-0 pt-0.5">{c.label}</span>
              <div className="min-w-0 text-right">{c.render(row)}</div>
            </div>
          ))}
          {acoes && <div className="pt-2 border-t border-n-100">{acoes.render(row)}</div>}
        </li>
      ))}
    </ul>
  );
}
