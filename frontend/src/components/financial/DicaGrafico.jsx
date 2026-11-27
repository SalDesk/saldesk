/* Caixa da dica (tooltip) dos graficos do Financeiro no estilo Mare: branca, borda do cartao e 14 px de raio.
   Os numeros vao em mono pelos chamadores (font-mono tabular-nums). */
export default function DicaGrafico({ children }) {
  return (
    <div className="bg-white border border-mare-card rounded-[14px] shadow-md px-3 py-2 text-xs font-body">
      {children}
    </div>
  );
}
