export default function ConfirmDialog({ mensagem, onConfirmar, onCancelar, labelConfirmar = 'Confirmar', danger = true }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[150] p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
        <p className="text-gray-800 mb-5 text-sm leading-relaxed">{mensagem}</p>
        <div className="flex gap-3">
          <button onClick={onCancelar} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            className={danger ? 'btn-danger flex-1' : 'btn-primary flex-1'}
          >
            {labelConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
