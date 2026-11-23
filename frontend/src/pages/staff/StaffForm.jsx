import { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Upload,
  X,
  Tag,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Input, { Select } from '../../components/ui/Input';
import { SELLER_ZONES, DAYS, CARGO_VENDEDOR, rotuloCargo, rotuloZona, rotuloDia } from './shared';
import Toggle from '../../components/ui/Toggle';
import { useT } from '../../i18n';
import { useLingua } from '../../utils/formatoLingua';

/* ── StaffForm ── */
/* As opcoes de cargo, zona e dia gravam sempre o valor da lista (portugues); so o texto mostrado muda com a lingua. */
function StaffForm({ member, onSave, onCancel, loading, error, roles }) {
  const t = useT();
  const lang = useLingua();
  const [form, setForm] = useState({
    name:           member?.name          || '',
    role:           member?.role          || roles[0],
    phone:          member?.phone         || '',
    email:          member?.email         || '',
    whatsapp:       member?.whatsapp      || '',
    photo_url:      member?.photo_url     || '',
    hire_date:      member?.hire_date     || '',
    status:         member?.status        || 'active',
    commission_pct: member?.commission_pct || '',
    seller_zone:    member?.seller_zone    || '',
  });
  const [sellerTourIds, setSellerTourIds] = useState(member?.seller_tour_ids || []);
  const [availUnits, setAvailUnits] = useState([]);
  const [photoPreview, setPhotoPreview] = useState(member?.photo_url || null);
  const [createAccess, setCreateAccess]  = useState(false);
  const [skillInput, setSkillInput]      = useState('');
  /* Ao editar, arrancam com o que o colaborador ja tem (antes arrancavam vazios e guardar apagava-os). */
  const [skills,  setSkills]   = useState(() => (Array.isArray(member?.skills) ? member.skills : []));
  const [schedule, setSchedule] = useState(() => (Array.isArray(member?.schedule) ? member.schedule : []));
  const fileRef = useRef(null);

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  useEffect(() => {
    if (form.role === CARGO_VENDEDOR) {
      import('../../services/unitsService').then(m => m.listUnits()).then(d => setAvailUnits(d || [])).catch(() => {});
    }
  }, [form.role]);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
      setForm(p => ({ ...p, photo_url: reader.result }));
    };
    reader.readAsDataURL(file);
  }

  function addSkill(e) {
    if (e.key === 'Enter' && skillInput.trim()) {
      e.preventDefault();
      if (!skills.includes(skillInput.trim())) setSkills(s => [...s, skillInput.trim()]);
      setSkillInput('');
    }
  }

  function toggleDay(d) {
    setSchedule(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave({
      ...form,
      skills,
      schedule,
      create_access:  createAccess,
      seller_tour_ids: sellerTourIds,
      commission_pct:  form.commission_pct ? Number(form.commission_pct) : null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Photo */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-n-100 border-2 border-n-200 flex items-center justify-center overflow-hidden">
            {photoPreview
              ? <img src={photoPreview} alt="" className="w-full h-full object-cover" />
              : <Camera size={20} strokeWidth={1.75} className="text-n-400" />}
          </div>
          <button type="button" aria-label={t('staff.form.uploadPhoto')} onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 w-6 h-6 bg-ocean-700 text-white rounded-full flex items-center justify-center hover:bg-ocean-500 transition-colors">
            <Upload size={10} strokeWidth={2} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </div>
        <div>
          <p className="text-sm font-display font-semibold text-n-800">{t('staff.form.profilePhoto')}</p>
          <p className="text-xs font-body text-n-500">{t('staff.form.photoHint')}</p>
        </div>
      </div>

      <Input label={t('staff.form.fullName')} aria-label={t('staff.form.fullName')} value={form.name} onChange={set('name')} required placeholder={t('staff.form.namePlaceholder')} />

      <div className="grid grid-cols-2 gap-3">
        <Select label={t('staff.form.role')} aria-label={t('staff.form.role')} value={form.role} onChange={set('role')} required>
          {member?.role && !roles.includes(member.role) && (
            <option value={member.role}>{t('staff.form.previousRole', { role: rotuloCargo(member.role, t, lang) })}</option>
          )}
          {roles.map(r => <option key={r} value={r}>{rotuloCargo(r, t, lang)}</option>)}
        </Select>
        {member && (
          <Select label={t('staff.form.status')} aria-label={t('staff.form.status')} value={form.status} onChange={set('status')}>
            <option value="active">{t('staff.status.active')}</option>
            <option value="inactive">{t('staff.status.inactive')}</option>
          </Select>
        )}
      </div>

      <Input label={t('staff.form.phone')} aria-label={t('staff.form.phone')} value={form.phone} onChange={set('phone')} type="tel" placeholder="+238 900 0000" />
      <div className="grid grid-cols-2 gap-3">
        <Input label={t('staff.form.email')} aria-label={t('staff.form.email')} value={form.email} onChange={set('email')} type="email" placeholder={t('staff.form.emailPlaceholder')} />
        <Input label={t('staff.form.whatsapp')} aria-label={t('staff.form.whatsapp')} value={form.whatsapp} onChange={set('whatsapp')} type="tel" placeholder="+238 900 0000" />
      </div>
      <Input
        label={t('staff.form.hireDate')} aria-label={t('staff.form.hireDate')} type="date" value={form.hire_date} onChange={set('hire_date')}
        hint={t('staff.form.hireDateHint')}
      />

      {/* Schedule */}
      <div>
        <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2 block">
          {t('staff.form.schedule')}
        </label>
        <div className="flex gap-1.5 flex-wrap">
          {DAYS.map(d => (
            <button key={d} type="button" onClick={() => toggleDay(d)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${schedule.includes(d) ? 'bg-ocean-700 text-white' : 'bg-n-100 text-n-600 hover:bg-n-200'}`}>
              {rotuloDia(d, t)}
            </button>
          ))}
        </div>
      </div>

      {/* Skills */}
      <div>
        <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2 block">
          {t('staff.form.skills')}
        </label>
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {skills.map(s => (
              <span key={s} className="flex items-center gap-1 px-2 py-0.5 bg-ocean-50 text-ocean-700 rounded text-xs font-body">
                <Tag size={9} strokeWidth={1.75} />{s}
                <button type="button" aria-label={t('staff.form.removeSkill', { skill: s })} onClick={() => setSkills(p => p.filter(x => x !== s))}>
                  <X size={10} strokeWidth={2} />
                </button>
              </span>
            ))}
          </div>
        )}
        <Input
          aria-label={t('staff.form.skills')}
          type="text" value={skillInput}
          onChange={e => setSkillInput(e.target.value)} onKeyDown={addSkill}
          placeholder={t('staff.form.skillPlaceholder')}
        />
      </div>

      {/* Vendor-specific fields */}
      {form.role === CARGO_VENDEDOR && (
        <div className="border border-[var(--sand-300)] bg-[var(--sand-50)] rounded-sm p-4 space-y-3">
          <p className="text-xs font-body font-bold uppercase tracking-wide text-[var(--sand-600)]">
            {t('staff.form.sellerSettings')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('staff.form.commission')} aria-label={t('staff.form.commission')} type="number" min="0" max="50" step="0.5"
              value={form.commission_pct}
              onChange={set('commission_pct')}
              placeholder={t('staff.form.commissionPlaceholder')}
              className="font-mono"
            />
            <Select label={t('staff.form.zone')} aria-label={t('staff.form.zone')} value={form.seller_zone} onChange={set('seller_zone')}>
              <option value="">{t('staff.form.allZones')}</option>
              {SELLER_ZONES.map(z => <option key={z} value={z}>{rotuloZona(z, t, lang)}</option>)}
            </Select>
          </div>
          {availUnits.length > 0 && (
            <div>
              <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-2">
                {t('staff.form.toursCanSell', {
                  sel: sellerTourIds.length === 0 ? t('staff.form.toursAll') : t('staff.form.toursSelected', { n: sellerTourIds.length }),
                })}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {availUnits.map(u => (
                  <button key={u.id} type="button"
                    onClick={() => setSellerTourIds(p => p.includes(u.id) ? p.filter(x => x !== u.id) : [...p, u.id])}
                    className={`text-xs px-2.5 py-1 rounded-sm border font-body transition-colors ${
                      sellerTourIds.includes(u.id)
                        ? 'bg-ocean-700 text-white border-ocean-700'
                        : 'bg-white text-n-600 border-n-200 hover:border-ocean-300'
                    }`}>
                    {u.name}
                  </button>
                ))}
              </div>
              <p className="text-[10px] font-mono text-n-400 mt-1">
                {t('staff.form.toursHint')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Create access account */}
      {!member && (
        <div className="border border-n-200 rounded-sm p-3 space-y-2">
          <Toggle checked={createAccess} onChange={setCreateAccess} label={t('staff.form.createAccess')} />
          {createAccess && (
            <p className="text-xs font-body text-n-500 bg-n-50 rounded p-2">
              {t('staff.form.createAccessHint')}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm font-body px-3 py-2 rounded-sm bg-[var(--error-light)] text-[var(--error)]">{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">{t('common.cancel')}</Button>
        <Button type="submit" loading={loading} className="flex-1">
          {member ? t('staff.form.saveChanges') : t('staff.form.create')}
        </Button>
      </div>
    </form>
  );
}

export default StaffForm;
