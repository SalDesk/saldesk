import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudLightning,
  AlertTriangle, RefreshCw, Users,
} from 'lucide-react';
import { getWeatherForecast, weatherInfo, isBadWeather, dayLabel } from '../services/weatherService';
import { listReservations } from '../services/reservationsService';
import { listIslands } from '../services/islandsService';
import useAuthStore from '../store/authStore';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { useT } from '../i18n';
import { formatarData, useLingua } from '../utils/formatoLingua';

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
      className={`rounded-md border px-3 py-4 flex flex-col items-center gap-2 transition-colors w-full text-left ${
        hasConflict
          ? 'bg-[var(--error-light)] border-[var(--error)] hover:brightness-95'
          : isBad
          ? 'bg-[var(--info-light)] border-ocean-100 hover:brightness-95'
          : 'bg-white border-n-200 hover:border-ocean-200 hover:bg-ocean-50'
      } ${isToday ? 'ring-2 ring-ocean-700' : ''}`}
    >
      <p className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${isToday ? 'text-ocean-700' : 'text-n-400'}`}>
        {dayLabel(day.date, t, lang)}
      </p>
      <p className="text-[10px] font-mono text-n-400">
        {formatarData(new Date(day.date + 'T00:00:00Z'), { day: '2-digit', month: 'short', timeZone: 'UTC' }, lang)}
      </p>

      <Icon size={26} strokeWidth={1.5} style={{ color: info.color }} />

      <p className="text-[10px] font-body text-n-600 text-center leading-tight">{rotuloTempo(day.code, t)}</p>

      <div className="text-center">
        <p className="font-display font-bold text-base text-n-900">{day.tempMax}°</p>
        <p className="text-xs font-body text-n-400">{day.tempMin}°</p>
      </div>

      {day.precipitation > 0 && (
        <div className="flex items-center gap-1">
          <CloudRain size={10} strokeWidth={1.75} className={isBad ? 'text-[var(--error)]' : 'text-ocean-500'} />
          <span className={`text-[10px] font-mono font-semibold ${isBad ? 'text-[var(--error)]' : 'text-ocean-600'}`}>
            {day.precipitation} mm
          </span>
        </div>
      )}

      {tours.length > 0 && (
        <div className={`w-full text-center px-2 py-0.5 rounded-xs text-[10px] font-mono font-semibold ${
          hasConflict ? 'bg-[var(--error)] text-white' : 'bg-ocean-100 text-ocean-700'
        }`}>
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
        actions={
          <Button variant="secondary" icon={RefreshCw} size="sm" onClick={carregar} loading={loading}>
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
              <div key={c.date} className="flex items-start gap-3 px-4 py-3 bg-[var(--error-light)] border border-[var(--error)] rounded-md">
                <AlertTriangle size={16} strokeWidth={1.75} className="text-[var(--error)] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-body font-semibold text-[var(--error)]">
                    {t('weather.badWeatherFor', { date: fmtDate(c.date, lang) })}
                  </p>
                  <p className="text-xs font-body text-[var(--error)] mt-0.5">
                    {rotuloTempo(c.code, t)} · {c.precipitation > 0 ? `${t('weather.precipShort', { mm: c.precipitation })} · ` : ''}
                    {t('weather.toursWithGuests', { n: tours.length, guests: tours.reduce((s, r) => s + (r.guests || 1), 0) })}
                  </p>
                </div>
                <Button size="sm" variant="secondary"
                  onClick={() => navigate(`/reservas?date=${c.date}`)}
                  className="shrink-0 text-[var(--error)] border-[var(--error)] hover:bg-[var(--error-light)]">
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
        <Card padding="p-0">
          <EmptyState
            icon={CloudRain}
            title={error}
            action={<Button variant="secondary" icon={RefreshCw} onClick={carregar}>{t('weather.retry')}</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {/* 7-day grid */}
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
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
            <Card padding="px-5 py-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-display font-semibold text-sm text-n-700">{fmtDate(selectedDay.date, lang)}</h3>
                  <p className="text-xs font-body text-n-500 mt-0.5">{rotuloTempo(selectedDay.code, t)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display font-bold text-xl text-n-900">{selectedDay.tempMax}° / {selectedDay.tempMin}°</p>
                  {selectedDay.precipitation > 0 && (
                    <p className="text-xs font-mono text-ocean-600 mt-0.5">{t('weather.precip', { mm: selectedDay.precipitation })}</p>
                  )}
                </div>
              </div>

              {selectedTours.length === 0 ? (
                <p className="text-xs font-body text-n-400">{t('weather.noTours')}</p>
              ) : (
                <div>
                  <p className="text-xs font-mono uppercase tracking-wider text-n-500 mb-3">
                    {t('weather.toursScheduled', { n: selectedTours.length })}
                  </p>
                  <div className="space-y-2">
                    {selectedTours.map(r => (
                      <div key={r.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-sm border ${
                        isBadWeather(selectedDay) ? 'bg-[var(--error-light)] border-[var(--error-light)]' : 'bg-n-50 border-n-200'
                      }`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-body font-semibold text-n-900 truncate">
                            {r.units?.name || r.unit_name || 'Tour'}
                          </p>
                          <p className="text-xs font-body text-n-500 mt-0.5">
                            {r.customers?.name || r.customer_name || '—'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Users size={12} strokeWidth={1.75} className="text-n-400" />
                          <span className="text-xs font-mono text-n-600">{r.guests || 1} pax</span>
                        </div>
                        {(r.customers?.phone || r.customers?.whatsapp) && (
                          <a
                            href={`https://wa.me/${(r.customers.whatsapp || r.customers.phone).replace(/\D/g, '')}`}
                            target="_blank" rel="noreferrer"
                            className="text-xs font-body px-2 py-1 bg-[var(--success)] text-white rounded-xs hover:opacity-90 transition-opacity shrink-0"
                          >
                            WhatsApp
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Summary row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card padding="px-4 py-3">
              <p className="font-display font-bold text-xl text-n-900">
                {forecast[0]?.tempMax ?? '—'}°
              </p>
              <p className="text-xs font-body text-n-500">{t('weather.maxToday')}</p>
            </Card>
            <Card padding="px-4 py-3">
              <p className="font-display font-bold text-xl text-n-900">
                {Math.round(forecast.reduce((s, d) => s + d.precipitation, 0) * 10) / 10} mm
              </p>
              <p className="text-xs font-body text-n-500">{t('weather.totalPrecip')}</p>
            </Card>
            <Card padding="px-4 py-3">
              <p className="font-display font-bold text-xl text-n-900">
                {forecast.filter(d => !isBadWeather(d)).length}
              </p>
              <p className="text-xs font-body text-n-500">{t('weather.goodDays')}</p>
            </Card>
            <div className={`border rounded-md px-4 py-3 ${conflicts.length > 0 ? 'bg-[var(--error-light)] border-[var(--error)]' : 'bg-[var(--success-light)] border-[var(--success)]'}`}>
              <p className={`font-display font-bold text-xl ${conflicts.length > 0 ? 'text-[var(--error)]' : 'text-[var(--success)]'}`}>
                {conflicts.length}
              </p>
              <p className={`text-xs font-body ${conflicts.length > 0 ? 'text-[var(--error)]' : 'text-[var(--success)]'}`}>
                {conflicts.length === 0 ? t('weather.noConflicts') : t('weather.conflicts')}
              </p>
            </div>
          </div>

          {/* Attribution */}
          <p className="text-[10px] font-mono text-n-400 text-right">
            {t('weather.attribution')}
          </p>
        </div>
      )}
    </div>
  );
}
