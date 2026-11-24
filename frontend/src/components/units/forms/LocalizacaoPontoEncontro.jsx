import { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Input from '../../ui/Input';
import { useT } from '../../../i18n';
import { lerCoordenadas, dentroDeCaboVerde, eLinkCurto } from '../../../utils/coordenadas';

/* Localizacao do ponto de encontro de uma actividade (units.lat / units.lng): mapa onde se
   clica ou arrasta o marcador, campo para colar coordenadas ou um link do Google Maps, e os
   campos Latitude/Longitude. Fora de Cabo Verde so avisa (nunca bloqueia).
   Spec: docs/superpowers/specs/2026-11-20-ponto-encontro-mapa-design.md */

const SAL = [16.75, -22.93];

const ICONE = L.divIcon({
  className: '',
  html: '<div style="background:#0D5470;width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>',
  iconSize: [22, 22],
  /* quadrado rodado 45 graus: a ponta fica a 11 + 11*raiz(2) = 27 px do topo */
  iconAnchor: [11, 27],
});

const seis = (n) => String(Number(n.toFixed(6)));

function CliqueNoMapa({ onEscolher }) {
  useMapEvents({ click: (e) => onEscolher(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function LocalizacaoPontoEncontro({ lat, lng, onChange }) {
  const t = useT();
  const [colado, setColado] = useState('');
  const [erro, setErro] = useState('');
  /* o mapa recentra quando a localizacao muda por fora dele (colar, remover, sair dos campos);
     nunca a cada tecla nos campos (recarregava o mapa inteiro a cada numero) */
  const [chaveMapa, setChaveMapa] = useState(0);

  const latN = lat === '' || lat === null || lat === undefined ? NaN : Number(lat);
  const lngN = lng === '' || lng === null || lng === undefined ? NaN : Number(lng);
  const temPonto = Number.isFinite(latN) && Number.isFinite(lngN);

  function escolher(la, ln, recentrar) {
    onChange({ lat: seis(la), lng: seis(ln) });
    if (recentrar) setChaveMapa((k) => k + 1);
  }

  function lerColado(texto) {
    const lido = (texto ?? colado).trim();
    if (!lido) { setErro(''); return; }
    const r = lerCoordenadas(lido);
    if (!r) {
      setErro(eLinkCurto(lido) ? t('unitForm.meeting.errShortLink') : t('unitForm.meeting.errNotFound'));
      return;
    }
    setErro('');
    setColado('');
    escolher(r.lat, r.lng, true);
  }

  return (
    <div className="mt-4 space-y-3">
      <div>
        <p className="text-xs font-body font-bold uppercase tracking-wide text-n-600">{t('unitForm.meeting.title')}</p>
        <p className="text-xs font-body text-n-500 mt-0.5">{t('unitForm.meeting.hint')}</p>
      </div>

      <div className="h-56 rounded-md overflow-hidden border border-n-200">
        <MapContainer key={chaveMapa} center={temPonto ? [latN, lngN] : SAL} zoom={temPonto ? 14 : 11}
          style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <CliqueNoMapa onEscolher={(la, ln) => escolher(la, ln, false)} />
          {temPonto && (
            <Marker position={[latN, lngN]} icon={ICONE} draggable
              eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); escolher(p.lat, p.lng, false); } }} />
          )}
        </MapContainer>
      </div>

      <Input
        label={t('unitForm.meeting.paste')}
        value={colado}
        onChange={(e) => { setColado(e.target.value); if (erro) setErro(''); }}
        onPaste={(e) => { const colou = e.clipboardData?.getData('text'); if (colou) { e.preventDefault(); setColado(colou); lerColado(colou); } }}
        onBlur={() => lerColado()}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lerColado(); } }}
        placeholder={t('unitForm.meeting.pastePh')}
        hint={t('unitForm.meeting.pasteHint')}
        error={erro || undefined}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input label={t('unitForm.meeting.latitude')} type="number" step="0.000001" value={lat ?? ''} placeholder={t('unitForm.meeting.latPh')}
          onChange={(e) => onChange({ lat: e.target.value, lng: lng ?? '' })}
          onBlur={() => setChaveMapa((k) => k + 1)} />
        <Input label={t('unitForm.meeting.longitude')} type="number" step="0.000001" value={lng ?? ''} placeholder={t('unitForm.meeting.lngPh')}
          onChange={(e) => onChange({ lat: lat ?? '', lng: e.target.value })}
          onBlur={() => setChaveMapa((k) => k + 1)} />
      </div>

      {temPonto && !dentroDeCaboVerde(latN, lngN) && (
        <p role="alert" className="text-xs font-body text-amber-700">{t('unitForm.meeting.outside')}</p>
      )}
      {temPonto && (
        <button type="button" onClick={() => { onChange({ lat: '', lng: '' }); setChaveMapa((k) => k + 1); }}
          className="text-xs font-body font-semibold text-n-600 underline hover:text-n-800">
          {t('unitForm.meeting.remove')}
        </button>
      )}
    </div>
  );
}
