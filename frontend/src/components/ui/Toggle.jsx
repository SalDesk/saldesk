function Toggle({ checked, onChange, label, hint }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-n-100 last:border-0">
      <div>
        {label && <p className="text-sm font-display font-semibold text-n-800">{label}</p>}
        {hint && <p className="text-xs font-body text-n-500 mt-0.5">{hint}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className={`shrink-0 w-10 h-5 rounded-full transition-colors relative mt-0.5 ${checked ? 'bg-ocean-700' : 'bg-n-300'}`}>
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

export default Toggle;
