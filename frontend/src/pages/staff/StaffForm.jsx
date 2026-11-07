import { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Upload,
  Shield,
  X,
  Tag,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Input, { Select } from '../../components/ui/Input';
import { SELLER_ZONES, DAYS } from './shared';

/* ── StaffForm ── */
function StaffForm({ member, onSave, onCancel, loading, error, roles }) {
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
  const [skills,  setSkills]   = useState([]);
  const [schedule, setSchedule] = useState([]);
  const fileRef = useRef(null);

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  useEffect(() => {
    if (form.role === 'Vendedor de Praia') {
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
          <button type="button" onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 w-6 h-6 bg-ocean-700 text-white rounded-full flex items-center justify-center hover:bg-ocean-500 transition-colors">
            <Upload size={10} strokeWidth={2} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </div>
        <div>
          <p className="text-sm font-display font-semibold text-n-800">Foto de perfil</p>
          <p className="text-xs font-body text-n-500">JPG, PNG ate 2MB</p>
        </div>
      </div>

      <Input label="Nome completo" value={form.name} onChange={set('name')} required placeholder="Nome e apelido" />

      <div className="grid grid-cols-2 gap-3">
        <Select label="Cargo" value={form.role} onChange={set('role')} required>
          {member?.role && !roles.includes(member.role) && (
            <option value={member.role}>{member.role} (cargo anterior)</option>
          )}
          {roles.map(r => <option key={r} value={r}>{r}</option>)}
        </Select>
        {member && (
          <Select label="Estado" value={form.status} onChange={set('status')}>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </Select>
        )}
      </div>

      <Input label="Telefone" value={form.phone} onChange={set('phone')} type="tel" placeholder="+238 900 0000" />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Email" value={form.email} onChange={set('email')} type="email" placeholder="nome@email.com" />
        <Input label="WhatsApp" value={form.whatsapp} onChange={set('whatsapp')} type="tel" placeholder="+238 900 0000" />
      </div>
      <Input
        label="Data de admissao" type="date" value={form.hire_date} onChange={set('hire_date')}
        hint="Opcional — usada para sugerir o direito a ferias proporcional em RH."
      />

      {/* Schedule */}
      <div>
        <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2 block">
          Horario habitual
        </label>
        <div className="flex gap-1.5 flex-wrap">
          {DAYS.map(d => (
            <button key={d} type="button" onClick={() => toggleDay(d)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${schedule.includes(d) ? 'bg-ocean-700 text-white' : 'bg-n-100 text-n-600 hover:bg-n-200'}`}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Skills */}
      <div>
        <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 mb-2 block">
          Competencias e certificacoes
        </label>
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {skills.map(s => (
              <span key={s} className="flex items-center gap-1 px-2 py-0.5 bg-ocean-50 text-ocean-700 rounded text-xs font-body">
                <Tag size={9} strokeWidth={1.75} />{s}
                <button type="button" onClick={() => setSkills(p => p.filter(x => x !== s))}>
                  <X size={10} strokeWidth={2} />
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          type="text" value={skillInput}
          onChange={e => setSkillInput(e.target.value)} onKeyDown={addSkill}
          placeholder="Escrever competencia + Enter"
          className="w-full h-9 px-3 rounded-sm border border-n-300 text-sm font-body bg-n-100 text-n-900 placeholder:text-n-400 focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white"
        />
      </div>

      {/* Vendor-specific fields */}
      {form.role === 'Vendedor de Praia' && (
        <div className="border border-sand-300 bg-[#FFF7E6] rounded-md p-4 space-y-3">
          <p className="text-xs font-body font-bold uppercase tracking-wide text-sand-700">
            Configuracao do Vendedor de Praia
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-1">
                Comissao (%)
              </label>
              <input type="number" min="0" max="50" step="0.5"
                value={form.commission_pct}
                onChange={set('commission_pct')}
                placeholder="Ex: 10"
                className="w-full h-9 px-3 rounded-sm border border-n-300 text-sm font-mono bg-white focus:outline-none focus:border-ocean-700"
              />
            </div>
            <div>
              <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-1">
                Zona de actuacao
              </label>
              <select value={form.seller_zone} onChange={set('seller_zone')}
                className="w-full h-9 px-3 rounded-sm border border-n-300 text-sm font-body bg-white focus:outline-none focus:border-ocean-700">
                <option value="">Todas as zonas</option>
                {SELLER_ZONES.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
          </div>
          {availUnits.length > 0 && (
            <div>
              <label className="text-xs font-body font-bold uppercase tracking-wide text-n-600 block mb-2">
                Tours que pode vender ({sellerTourIds.length === 0 ? 'todos' : `${sellerTourIds.length} seleccionado(s)`})
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
                Deixar sem seleccao = pode vender todos os tours activos.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Create access account */}
      {!member && (
        <div className="border border-n-200 rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={15} strokeWidth={1.75} className="text-ocean-700" />
              <span className="text-sm font-display font-semibold text-n-800">Criar conta /staff</span>
            </div>
            <button type="button" onClick={() => setCreateAccess(!createAccess)}
              className={`w-10 h-5 rounded-full transition-colors relative ${createAccess ? 'bg-ocean-700' : 'bg-n-300'}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${createAccess ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
          {createAccess && (
            <p className="text-xs font-body text-n-500 bg-n-50 rounded p-2">
              Sera criada uma conta de acesso e enviado um email ao colaborador com um link para definir a sua password.
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm font-body px-3 py-2 rounded-sm bg-red-50 text-error">{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button type="submit" loading={loading} className="flex-1">
          {member ? 'Guardar alteracoes' : 'Criar colaborador'}
        </Button>
      </div>
    </form>
  );
}

export default StaffForm;
