const OPEN_METEO_URL =
  'https://api.open-meteo.com/v1/forecast' +
  '?latitude=16.7333&longitude=-22.9333' +
  '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode' +
  '&timezone=Atlantic/Cape_Verde';

export async function getWeatherForecast() {
  const res = await fetch(OPEN_METEO_URL);
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

/* WMO code → display info */
export function weatherInfo(code) {
  if (code === 0)  return { label: 'Ceu limpo',             iconName: 'Sun',            color: '#D4A82A', bg: '#FFF7E6' };
  if (code <= 2)   return { label: 'Maioritariamente limpo', iconName: 'Sun',            color: '#D4A82A', bg: '#FFF7E6' };
  if (code === 3)  return { label: 'Nublado',                iconName: 'Cloud',          color: '#6B7280', bg: '#F9FAFB' };
  if (code <= 48)  return { label: 'Nevoeiro',               iconName: 'CloudFog',       color: '#64748B', bg: '#F1F5F9' };
  if (code <= 55)  return { label: 'Garoa',                  iconName: 'CloudDrizzle',   color: '#1480A8', bg: '#EFF6FF' };
  if (code <= 65)  return { label: 'Chuva',                  iconName: 'CloudRain',      color: '#0D5470', bg: '#DBEAFE' };
  if (code <= 75)  return { label: 'Neve',                   iconName: 'Cloud',          color: '#9BA3AF', bg: '#F8FAFC' };
  if (code <= 82)  return { label: 'Aguaceiros',             iconName: 'CloudRain',      color: '#0D5470', bg: '#DBEAFE' };
  return                  { label: 'Trovoada',               iconName: 'CloudLightning', color: '#B91C1C', bg: '#FEF2F2' };
}

export function isBadWeather(day) {
  return day.precipitation > 5 || day.code >= 80;
}

export function dayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanha';
  return d.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short' });
}
