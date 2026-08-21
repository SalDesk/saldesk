import axios from 'axios';

const publicApi = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1') + '/public',
  timeout: 15_000,
});

export async function getOperador(slug) {
  const { data } = await publicApi.get(`/${slug}`);
  return data.data;
}

export async function checkAvailability(slug, unitId, checkIn, checkOut) {
  const { data } = await publicApi.get(`/${slug}/availability`, {
    params: { unitId, checkIn, checkOut },
  });
  return data.data;
}

export async function criarReservaPublica(slug, dados) {
  const { data } = await publicApi.post(`/${slug}/reservations`, dados);
  return data.data;
}

/* Sem auth -- usado pelo separador "Explorar" do TravelerPortal para listar
   o catalogo Conect e permitir guardar itens na wishlist. */
export async function discoverUnits(params) {
  const { data } = await publicApi.get('/discover-units', { params });
  return data.data;
}

/* Modo manutencao + registo por convite (Sistema -> Definicoes do fundador).
   Sem auth -- consultado pelo Register.jsx ao carregar (o site estatico em
   website/index.html chama o mesmo endpoint /public/site-status directo,
   fora da SPA). */
export async function getSiteStatus() {
  const { data } = await publicApi.get('/site-status');
  return data.data;
}
