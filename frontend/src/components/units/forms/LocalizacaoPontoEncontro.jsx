import { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Input from '../../ui/Input';
import { lerCoordenadas, dentroDeCaboVerde, eLinkCurto } from '../../../utils/coordenadas';

/* Localizacao do ponto de encontro de uma actividade (units.lat / units.lng): mapa onde se
   clica ou arrasta o marcador, campo para colar coordenadas ou um link do Google Maps, e os
   campos Latitude/Longitude. Fora de Cabo Verde so avisa (nunca bloqueia).
   Spec: docs/superpowers/specs/2026-11-20-ponto-encontro-mapa-design.md */

const SAL = [16.75, -22.93];
const COLAR = 'Colar coordenadas ou link do Google Maps';

const ICONE = L.divIcon({
  className: '',
  html: '<div style="background:#0D5470;width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

const seis = (n) => String(Number(n.toFixed(6)));

function CliqueNoMapa({ onEscolher }) {
  useMapEvents({ click: (e) => onEscolher(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function LocalizacaoPontoEncontro({ lat, lng, onChange }) {
  const [colado, setColado] = useState('');
  const [erro, setErro] = useState('');
  /* o mapa recentra quando a localizacao muda por fora dele (colar, remover, campos) */
  const [chaveMapa, setChaveMapa] = useState(0);

  const latN = lat === '' || lat === null || lat === undefined ? NaN : Number(lat);
  const lngN = lng === '' || lng === null || lng === undefined ? NaN : Number(lng);
  const temPonto = Number.isFinite(latN) && Number.isFinite(lngN);

  function escolher(la, ln, recentrar) {
    onChange({ lat: seis(la), lng: seis(ln) });
    if (recentrar) setChaveMapa((k) => k + 1);
  }

  function lerColado(texto) {
    const t = (texto ?? colado).trim();
    if (!t) { setErro(''); return; }
    const r = lerCoordenadas(t);
    if (!r) {
      setErro(eLinkCurto(t)
        ? 'Links curtos não trazem coordenadas. Abra o link e copie o endereço completo do browser, ou copie as coordenadas no Google Maps.'
        : 'Não encontrei coordenadas neste texto.');
      return;
    }
    setErro('');
    setColado('');
    escolher(r.lat, r.lng, true);
  }

  return (
    <div className="mt-4 space-y-3">
      <div>
        <p className="text-xs font-body font-bold uppercase tracking-wide text-n-600">Localização do ponto de encontro</p>
        <p className="text-xs font-body text-n-500 mt-0.5">Clique no mapa para marcar o ponto de encontro. Pode arrastar o marcador.</p>
      </div>

      <div className="h-56 rounded-md overflow-hidden border border-n-200">
        <MapContainer key={chaveMapa} center={temPonto ? [latN, lngN] : SAL} zoom={temPonto ? 14 : 11}
          style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <CliqueNoMapa onEscolher={(la, ln) => escolher(la, ln, false)} />
          {temPonto && (
            <Marker position={[latN, lngN]} icon={ICONE} draggable
              eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); escolher(p.lat, p.lng, false); } }} />
          )}
        </MapContainer>
      </div>

      <Input
        label={COLAR}
        value={colado}
        onChange={(e) => { setColado(e.target.value); if (erro) setErro(''); }}
        onPaste={(e) => { const t = e.clipboardData?.getData('text'); if (t) { e.preventDefault(); setColado(t); lerColado(t); } }}
        onBlur={() => lerColado()}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lerColado(); } }}
        placeholder="Ex: 16.7631, -22.8950"
        hint="No Google Maps: clique com o botão direito no local e escolha as coordenadas para as copiar."
        error={erro || undefined}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Latitude" type="number" step="0.000001" value={lat ?? ''} placeholder="Ex: 16.7631"
          onChange={(e) => { onChange({ lat: e.target.value, lng: lng ?? '' }); setChaveMapa((k) => k + 1); }} />
        <Input label="Longitude" type="number" step="0.000001" value={lng ?? ''} placeholder="Ex: -22.8950"
          onChange={(e) => { onChange({ lat: lat ?? '', lng: e.target.value }); setChaveMapa((k) => k + 1); }} />
      </div>

      {temPonto && !dentroDeCaboVerde(latN, lngN) && (
        <p role="alert" className="text-xs font-body text-amber-700">Este ponto fica fora de Cabo Verde. Confirme a localização.</p>
      )}
      {temPonto && (
        <button type="button" onClick={() => { onChange({ lat: '', lng: '' }); setChaveMapa((k) => k + 1); }}
          className="text-xs font-body font-semibold text-n-600 underline hover:text-n-800">
          Remover localização
        </button>
      )}
    </div>
  );
}
