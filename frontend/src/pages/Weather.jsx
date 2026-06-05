import { useState, useEffect, useMemo } from 'react';
import PlanGuard from '../components/PlanGuard';
import { useNavigate } from 'react-router-dom';
import {
  Sun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudLightning,
  AlertTriangle, RefreshCw, Users, CalendarDays, MapPin,
} from 'lucide-react';
import { getWeatherForecast, weatherInfo, isBadWeather, dayLabel } from '../services/weatherService';
import { listReservations } from '../services/reservationsService';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const ICON_MAP = { Sun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudLightning };

const TODAY = new Date().toISOString().slice(0, 10);

function addDays(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function fmtDate(dateStr) {
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long' });
}

/* ── WeatherCard ── */
function WeatherCard({ day, isToday, tours, onClick }) {
  const info  = weatherInfo(day.code);
  const Icon  = ICON_MAP[info.iconName] || Cloud;
  const isBad = isBadWeather(day);
  const hasConflict = isBad && tours.length > 0;

  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-3 py-4 flex flex-col items-center gap-2 transition-colors w-full text-left ${
        hasConflict
          ? 'bg-red-50 border-red-300 hover:bg-red-100'
          : isBad
          ? 'bg-blue-50 border-blue-200 hover:bg-blue-100'
          : 'bg-white border-n-200 hover:border-ocean-200 hover:bg-ocean-50'
      } ${isToday ? 'ring-2 ring-ocean-700' : ''}`}
    >
      <p className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${isToday ? 'text-ocean-700' : 'text-n-400'}`}>
        {dayLabel(day.date)}
      </p>
      <p className="text-[10px] font-mono text-n-400">
        {new Date(day.date + 'T00:00:00Z').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
      </p>

      <Icon size={26} strokeWidth={1.5} style={{ color: info.color }} />

      <p className="text-[10px] font-body text-n-600 text-center leading-tight">{info.label}</p>

      <div className="text-center">
        <p className="font-display font-bold text-base text-n-900">{day.tempMax}°</p>
        <p className="text-xs font-body text-n-400">{day.tempMin}°</p>
      </div>

      {day.precipitation > 0 && (
        <div className="flex items-center gap-1">
          <CloudRain size={10} strokeWidth={1.75} className={isBad ? 'text-error' : 'text-ocean-500'} />
          <span className={`text-[10px] font-mono font-semibold ${isBad ? 'text-error' : 'text-ocean-600'}`}>
            {day.precipitation} mm
          </span>
        </div>
      )}

      {tours.length > 0 && (
        <div className={`w-full text-center px-2 py-0.5 rounded-xs text-[10px] font-mono font-semibold ${
          hasConflict ? 'bg-error text-white' : 'bg-ocean-100 text-ocean-700'
        }`}>
          {tours.length} tour(s)
        </div>
      )}
    </button>
  );
}

/* ─────────────────────── Main ─────────────────────── */
export default function Weather() {
  const navigate = useNavigate();
  const [forecast,    setForecast]    = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [selected,    setSelected]    = useState(null);

  const end7 = addDays(6);

  async function carregar() {
    setLoading(true);
    setError('');
    try {
      const [wx, res] = await Promise.all([
        getWeatherForecast(),
        listReservations({ from: TODAY, to: end7 }).catch(() => []),
      ]);
      setForecast(wx);
      setReservations(res || []);
    } catch {
      setError('Nao foi possivel carregar a previsao meteorologica. Verifique a ligacao a internet.');
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
        title="Meteorologia — Ilha do Sal"
        subtitle="Previsao a 7 dias · Open-Meteo · 16.7°N, 22.9°W"
        actions={
          <Button variant="secondary" icon={RefreshCw} size="sm" onClick={carregar} loading={loading}>
            Actualizar
          </Button>
        }
      />

      {/* Conflict alerts */}
      {conflicts.length > 0 && (
        <div className="mb-5 space-y-2">
          {conflicts.map(c => {
            const tours = resByDate[c.date] || [];
            return (
              <div key={c.date} className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-md">
                <AlertTriangle size={16} strokeWidth={1.75} className="text-error shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-body font-semibold text-error">
                    Mau tempo previsto para {fmtDate(c.date)}
                  </p>
                  <p className="text-xs font-body text-red-600 mt-0.5">
                    {weatherInfo(c.code).label} · {c.precipitation > 0 ? `${c.precipitation}mm precipitacao · ` : ''}
                    {tours.length} tour(s) agendado(s) com {tours.reduce((s, r) => s + (r.guests || 1), 0)} participante(s)
                  </p>
                </div>
                <Button size="sm" variant="secondary"
                  onClick={() => navigate(`/reservas?date=${c.date}`)}
                  className="shrink-0 text-error border-red-200 hover:bg-red-100">
                  Contactar clientes
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-24"><LoadingSpinner size={36} /></div>
      ) : error ? (
        <Card>
          <div className="text-center py-12">
            <CloudRain size={36} strokeWidth={1.25} className="mx-auto mb-3 text-n-300" />
            <p className="font-body text-n-500 mb-4">{error}</p>
            <Button variant="secondary" icon={RefreshCw} onClick={carregar}>Tentar novamente</Button>
          </div>
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
                  <h3 className="font-display font-semibold text-sm text-n-700">{fmtDate(selectedDay.date)}</h3>
                  <p className="text-xs font-body text-n-500 mt-0.5">{weatherInfo(selectedDay.code).label}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display font-bold text-xl text-n-900">{selectedDay.tempMax}° / {selectedDay.tempMin}°</p>
                  {selectedDay.precipitation > 0 && (
                    <p className="text-xs font-mono text-ocean-600 mt-0.5">{selectedDay.precipitation} mm precipitacao</p>
                  )}
                </div>
              </div>

              {selectedTours.length === 0 ? (
                <p className="text-xs font-body text-n-400">Sem tours agendados para este dia.</p>
              ) : (
                <div>
                  <p className="text-xs font-mono uppercase tracking-wider text-n-500 mb-3">
                    {selectedTours.length} tour(s) agendado(s)
                  </p>
                  <div className="space-y-2">
                    {selectedTours.map(r => (
                      <div key={r.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-sm border ${
                        isBadWeather(selectedDay) ? 'bg-red-50 border-red-100' : 'bg-n-50 border-n-200'
                      }`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-body font-semibold text-n-900 truncate">
                            {r.units?.name || r.unit_name || 'Tour'}
                          </p>
                          <p className="text-xs font-body text-n-500 mt-0.5">
                            {r.customers
                              ? `${r.customers.first_name} ${r.customers.last_name}`
                              : r.customer_name || '—'}
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
                            className="text-xs font-body px-2 py-1 bg-[#25D366] text-white rounded-xs hover:bg-[#1ebe5a] transition-colors shrink-0"
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
            <div className="bg-white border border-n-200 rounded-md px-4 py-3">
              <p className="font-display font-bold text-xl text-n-900">
                {forecast[0]?.tempMax ?? '—'}°
              </p>
              <p className="text-xs font-body text-n-500">Max. hoje</p>
            </div>
            <div className="bg-white border border-n-200 rounded-md px-4 py-3">
              <p className="font-display font-bold text-xl text-n-900">
                {Math.round(forecast.reduce((s, d) => s + d.precipitation, 0) * 10) / 10} mm
              </p>
              <p className="text-xs font-body text-n-500">Precipitacao total 7 dias</p>
            </div>
            <div className="bg-white border border-n-200 rounded-md px-4 py-3">
              <p className="font-display font-bold text-xl text-n-900">
                {forecast.filter(d => !isBadWeather(d)).length}
              </p>
              <p className="text-xs font-body text-n-500">Dias sem mau tempo</p>
            </div>
            <div className={`border rounded-md px-4 py-3 ${conflicts.length > 0 ? 'bg-red-50 border-red-200' : 'bg-[#ECFDF5] border-green-200'}`}>
              <p className={`font-display font-bold text-xl ${conflicts.length > 0 ? 'text-error' : 'text-[#1A7A4A]'}`}>
                {conflicts.length}
              </p>
              <p className={`text-xs font-body ${conflicts.length > 0 ? 'text-red-600' : 'text-[#1A7A4A]'}`}>
                {conflicts.length === 0 ? 'Sem conflitos meteorologicos' : 'Conflito(s) com tours'}
              </p>
            </div>
          </div>

          {/* Attribution */}
          <p className="text-[10px] font-mono text-n-400 text-right">
            Dados: Open-Meteo.com — Ilha do Sal, Cabo Verde (16.73°N, 22.93°W) · Actualizado automaticamente
          </p>
        </div>
      )}
    </div>
  );
}
