import { useT } from '../../i18n';

export default function ConfirmDialog({ mensagem, onConfirmar, onCancelar, labelConfirmar, danger = true }) {
  const t = useT();
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[150] p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full app:rounded-[18px] app:border app:border-mare-card">
        <p className="text-gray-800 mb-5 text-sm leading-relaxed">{mensagem}</p>
        <div className="flex gap-3">
          <button onClick={onCancelar} className="btn-secondary flex-1">
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirmar}
            className={danger ? 'btn-danger flex-1' : 'btn-primary flex-1'}
          >
            {labelConfirmar ?? t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
