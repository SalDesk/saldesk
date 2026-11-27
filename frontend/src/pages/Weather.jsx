import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudLightning,
  AlertTriangle, RefreshCw, Users, Thermometer, CheckCircle2,
} from 'lucide-react';
import { getWeatherForecast, weatherInfo, isBadWeather, dayLabel } from '../services/weatherService';
import { listReservations } from '../services/reservationsService';
import { listIslands } from '../services/islandsService';
import useAuthStore from '../store/authStore';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import MareStat from '../components/shared/MareStat';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { useT } from '../i18n';
import { formatarData, useLingua } from '../utils/formatoLingua';

/* Estilo Mare: cartao de pagina, titulo de cartao e algarismos alinhados */
const CARTAO = 'bg-white rounded-[18px] border border-mare-card p-[22px] min-w-0';
const TITULO = 'font-display text-lg font-semibold text-ocean-900';
const NUM = 'font-mono tabular-nums';
const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand-500';

const ICON_MAP = { Sun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudLightning };

/* Data local do dispositivo, nao UTC -- ver nota em BeachSeller.jsx */
const TODAY = new Date().toLocaleDateString('en-CA');

function addDays(n) {
  /* Data local do dispositivo, nao UTC -- ver nota junto de TODAY. */
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
}

function fmtDate(dateStr, lang) {
  return formatarData(new Date(dateStr + 'T00:00:00Z'), { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' }, lang);
}

/* Estado do tempo pela chave do servico (o pt de weather.conditions e o texto de sempre) */
function rotuloTempo(code, t) {
  return t(`weather.conditions.${weatherInfo(code).chave}`);
}

/* ── WeatherCard ── */
function WeatherCard({ day, isToday, tours, onClick }) {
  const t = useT();
  const lang = useLingua();
  const info  = weatherInfo(day.code);
  const Icon  = ICON_MAP[info.iconName] || Cloud;
  const isBad = isBadWeather(day);
  const hasConflict = isBad && tours.length > 0;

  return (
    <button
      onClick={onClick}
      className={`rounded-[18px] border px-2 py-4 sm:px-3 flex flex-col items-center gap-2 transition-colors w-full min-w-0 text-left ${FOCO} ${
        hasConflict
          ? 'bg-[var(--error-light)] border-[var(--error)] hover:brightness-95'
          : isBad
          ? 'bg-[var(--info-light)] border-ocean-100 hover:brightness-95'
          : 'bg-white border-mare-card hover:border-ocean-200 hover:bg-ocean-50'
      } ${isToday ? 'ring-2 ring-ocean-700' : ''}`}
    >
      <p className={`text-[11px] uppercase tracking-wider font-semibold ${NUM} ${isToday ? 'text-ocean-700' : 'text-n-600'}`}>
        {dayLabel(day.date, t, lang)}
      </p>
      <p className={`text-[11px] text-n-500 ${NUM}`}>
        {formatarData(new Date(day.date + 'T00:00:00Z'), { day: '2-digit', month: 'short', timeZone: 'UTC' }, lang)}
      </p>

      <Icon size={26} strokeWidth={1.5} style={{ color: info.color }} />

      <p className="text-[11px] font-body text-n-600 text-center leading-tight break-words hyphens-auto">{rotuloTempo(day.code, t)}</p>

      <div className="text-center">
        <p className={`font-bold text-base text-ocean-900 ${NUM}`}>{day.tempMax}°</p>
        <p className={`text-xs text-n-500 ${NUM}`}>{day.tempMin}°</p>
      </div>

      {day.precipitation > 0 && (
        <div className="flex items-center gap-1">
          <CloudRain size={10} strokeWidth={1.75} className={isBad ? 'text-[var(--error)]' : 'text-ocean-500'} />
          <span className={`text-[11px] font-semibold ${NUM} ${isBad ? 'text-[var(--error)]' : 'text-ocean-700'}`}>
            {day.precipitation} mm
          </span>
        </div>
      )}

      {tours.length > 0 && (
        <div className={`w-full flex items-center justify-center gap-1 text-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${NUM} ${
          hasConflict ? 'bg-[var(--error)] text-white' : 'bg-ocean-100 text-ocean-700'
        }`}>
          {hasConflict && <AlertTriangle size={10} strokeWidth={2} aria-hidden="true" className="hidden sm:inline shrink-0" />}
          {t('weather.toursCount', { n: tours.length })}
        </div>
      )}
    </button>
  );
}

/* ─────────────────────── Main ─────────────────────── */
export default function Weather() {
  const t = useT();
  const lang = useLingua();
  const navigate = useNavigate();
  const { operator } = useAuthStore();
  const [forecast,    setForecast]    = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [selected,    setSelected]    = useState(null);
  const [island,      setIsland]      = useState(null);

  const end7 = addDays(6);

  async function carregar() {
    setLoading(true);
    setError('');
    try {
      const islands = await listIslands().catch(() => []);
      const ilha = islands.find(i => i.id === operator?.island_id) || null;
      setIsland(ilha);
      const [wx, res] = await Promise.all([
        getWeatherForecast(ilha?.lat, ilha?.lng),
        /* o backend filtra por check_in_from/check_in_to (nao conhece from/to) */
        listReservations({ check_in_from: TODAY, check_in_to: end7 }).catch(() => []),
      ]);
      setForecast(wx);
      setReservations(res || []);
    } catch {
      /* sem previsao nova nao se mantem a antiga (os alertas de conflito vivem fora do ecra de erro) */
      setForecast([]);
      setReservations([]);
      setError(t('weather.error'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  /* Group reservations by date */
  const resByDate = useMemo(() => {
    const map = {};
    (reservations || [])
      .filter(r => ['pending', 'confirmed', 'checked_in'].includes(r.status))
      .forEach(r => {
        const k = r.check_in;
        if (!map[k]) map[k] = [];
        map[k].push(r);
      });
    return map;
  }, [reservations]);

  /* Bad-weather + tours conflicts */
  const conflicts = useMemo(() =>
    forecast.filter(d => isBadWeather(d) && (resByDate[d.date] || []).length > 0),
    [forecast, resByDate],
  );

  /* Selected day details */
  const selectedDay  = selected ? forecast.find(d => d.date === selected) : null;
  const selectedTours = selected ? (resByDate[selected] || []) : [];

  return (
    <div>
      <PageHeader
        title={`${t('weather.title')}${island ? ` — ${island.name}` : ''}`}
        subtitle={t('weather.subtitle')}
        eyebrow={t('nav.sections.gestao')}
        actions={
          <Button variant="secondary" icon={RefreshCw} size="sm" onClick={carregar} loading={loading} className="min-h-11 md:min-h-0">
            {t('weather.refresh')}
          </Button>
        }
      />

      {/* Conflict alerts */}
      {conflicts.length > 0 && (
        <div className="mb-5 space-y-2">
          {conflicts.map(c => {
            const tours = resByDate[c.date] || [];
            return (
              <div key={c.date} className="flex flex-wrap items-start gap-3 px-4 py-3 bg-[var(--error-light)] border border-[var(--error)] rounded-[14px]">
                <AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" className="text-[var(--error)] shrink-0 mt-0.5" />
                <div className="flex-1 min-w-[180px]">
                  <p className="text-sm font-body font-semibold text-n-900">
                    {t('weather.badWeatherFor', { date: fmtDate(c.date, lang) })}
                  </p>
                  <p className="text-[13px] font-body text-n-700 mt-0.5">
                    {rotuloTempo(c.code, t)} · {c.precipitation > 0 ? `${t('weather.precipShort', { mm: c.precipitation })} · ` : ''}
                    {t('weather.toursWithGuests', { n: tours.length, guests: tours.reduce((s, r) => s + (r.guests || 1), 0) })}
                  </p>
                </div>
                <Button size="sm" variant="secondary"
                  onClick={() => navigate(`/reservas?date=${c.date}`)}
                  className="shrink-0 min-h-11 md:min-h-0">
                  {t('weather.contact')}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-24"><LoadingSpinner size={36} /></div>
      ) : error ? (
        <section className="bg-white rounded-[18px] border border-mare-card min-w-0">
          <EmptyState
            icon={CloudRain}
            title={error}
            action={<Button variant="secondary" icon={RefreshCw} onClick={carregar}>{t('weather.retry')}</Button>}
          />
        </section>
      ) : (
        <div className="space-y-5">
          {/* 7-day grid */}
          <div className="grid grid-cols-3 min-[420px]:grid-cols-4 sm:grid-cols-7 gap-2">
            {forecast.map(day => (
              <WeatherCard
                key={day.date}
                day={day}
                isToday={day.date === TODAY}
                tours={resByDate[day.date] || []}
                onClick={() => setSelected(selected === day.date ? null : day.date)}
              />
            ))}
          </div>

          {/* Selected day detail */}
          {selectedDay && (
            <section className={CARTAO}>
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <h3 className={TITULO}>{fmtDate(selectedDay.date, lang)}</h3>
                  <p className="text-[13px] font-body text-n-600 mt-0.5">{rotuloTempo(selectedDay.code, t)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-bold text-xl text-ocean-900 ${NUM}`}>{selectedDay.tempMax}° / {selectedDay.tempMin}°</p>
                  {selectedDay.precipitation > 0 && (
                    <p className={`text-xs text-ocean-700 mt-0.5 ${NUM}`}>{t('weather.precip', { mm: selectedDay.precipitation })}</p>
                  )}
                </div>
              </div>

              {selectedTours.length === 0 ? (
                <p className="text-[13px] font-body text-n-600">{t('weather.noTours')}</p>
              ) : (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-n-600 mb-3">
                    {t('weather.toursScheduled', { n: selectedTours.length })}
                  </p>
                  <div className="space-y-2">
                    {selectedTours.map(r => (
                      <div key={r.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-[14px] border ${
                        isBadWeather(selectedDay) ? 'bg-[var(--error-light)] border-[var(--error)]' : 'bg-mare-head border-mare-card'
                      }`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-body font-semibold text-n-900 truncate">
                            {r.units?.name || r.unit_name || 'Tour'}
                          </p>
                          <p className="text-xs font-body text-n-600 mt-0.5 truncate">
                            {r.customers?.name || r.customer_name || '—'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Users size={12} strokeWidth={1.75} aria-hidden="true" className="text-n-500" />
                          <span className={`text-xs text-n-700 ${NUM}`}>{r.guests || 1} pax</span>
                        </div>
                        {(r.customers?.phone || r.customers?.whatsapp) && (
                          <a
                            href={`https://wa.me/${(r.customers.whatsapp || r.customers.phone).replace(/\D/g, '')}`}
                            target="_blank" rel="noreferrer"
                            className={`inline-flex items-center min-h-11 md:min-h-9 text-xs font-body font-semibold px-3 bg-[var(--success)] text-white rounded-lg hover:opacity-90 transition-opacity shrink-0 ${FOCO}`}
                          >
                            WhatsApp
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Summary row */}
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3">
            <MareStat
              icon={Thermometer}
              label={t('weather.maxToday')}
              value={`${forecast[0]?.tempMax ?? '—'}°`}
            />
            <MareStat
              icon={CloudRain}
              label={t('weather.totalPrecip')}
              value={`${Math.round(forecast.reduce((s, d) => s + d.precipitation, 0) * 10) / 10} mm`}
            />
            <MareStat
              icon={Sun}
              label={t('weather.goodDays')}
              value={forecast.filter(d => !isBadWeather(d)).length}
            />
            <MareStat
              icon={conflicts.length > 0 ? AlertTriangle : CheckCircle2}
              tone={conflicts.length > 0 ? 'aviso' : 'bom'}
              label={conflicts.length === 0 ? t('weather.noConflicts') : t('weather.conflicts')}
              value={conflicts.length}
            />
          </div>

          {/* Attribution */}
          <p className="text-xs font-body text-n-500 text-right">
            {t('weather.attribution')}
          </p>
        </div>
      )}
    </div>
  );
}
