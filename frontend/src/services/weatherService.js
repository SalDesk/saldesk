import { formatarData } from '../utils/formatoLingua';

/* Coordenadas por omissao (Ilha do Sal) -- usadas quando o operador ainda
   nao tem ilha definida (contas antigas, antes do onboarding gravar
   island_id). */
const DEFAULT_LAT = 16.7333;
const DEFAULT_LNG = -22.9333;

export async function getWeatherForecast(lat = DEFAULT_LAT, lng = DEFAULT_LNG) {
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${lat}&longitude=${lng}` +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode' +
    '&timezone=Atlantic/Cape_Verde';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Open-Meteo unavailable');
  const json = await res.json();
  const { time, temperature_2m_max, temperature_2m_min, precipitation_sum, weathercode } = json.daily;
  return time.map((date, i) => ({
    date,
    tempMax:       Math.round(temperature_2m_max[i]),
    tempMin:       Math.round(temperature_2m_min[i]),
    precipitation: Number((precipitation_sum[i] || 0).toFixed(1)),
    code:          weathercode[i],
  }));
}

/* WMO code → display info. chave: o estado do tempo em weather.conditions (o ecra Meteorologia
   e o dashboard traduzem por ela). */
export function weatherInfo(code) {
  if (code === 0)  return { chave: 'clear',        iconName: 'Sun',            color: 'var(--sand-500)', bg: '#FFF7E6' };
  if (code <= 2)   return { chave: 'mostlyClear',  iconName: 'Sun',            color: 'var(--sand-500)', bg: '#FFF7E6' };
  if (code === 3)  return { chave: 'cloudy',       iconName: 'Cloud',          color: 'var(--n500)', bg: '#F9FAFB' };
  if (code <= 48)  return { chave: 'fog',          iconName: 'CloudFog',       color: 'var(--n500)', bg: '#F1F5F9' };
  if (code <= 55)  return { chave: 'drizzle',      iconName: 'CloudDrizzle',   color: 'var(--ocean-500)', bg: '#EFF6FF' };
  if (code <= 65)  return { chave: 'rain',         iconName: 'CloudRain',      color: 'var(--ocean-700)', bg: '#DBEAFE' };
  if (code <= 75)  return { chave: 'snow',         iconName: 'Cloud',          color: 'var(--n400)', bg: '#F8FAFC' };
  if (code <= 82)  return { chave: 'showers',      iconName: 'CloudRain',      color: 'var(--ocean-700)', bg: '#DBEAFE' };
  return                  { chave: 'thunderstorm', iconName: 'CloudLightning', color: 'var(--error)', bg: '#FEF2F2' };
}

export function isBadWeather(day) {
  return day.precipitation > 5 || day.code >= 80;
}

/* Hoje, amanha ou o dia da semana com a data, na lingua do painel (t de useT / getT) */
export function dayLabel(dateStr, t, lang) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return t('weather.today');
  if (diff === 1) return t('weather.tomorrow');
  return formatarData(d, { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' }, lang);
}
