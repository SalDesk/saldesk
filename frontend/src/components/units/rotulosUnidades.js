import { linguaActual } from '../../utils/formatoLingua';

/* Rotulos dos valores gravados nas unidades (dificuldade, comodidades, tipos). O valor gravado nunca muda:
   so o texto mostrado passa pela traducao. Um valor que o mapa nao conhece (escrito a mao pelo operador)
   mostra-se tal e qual. */
const tem = (mapa, valor) => Object.prototype.hasOwnProperty.call(mapa, valor);

/* Dificuldade de um tour: Facil / Moderado / Dificil */
export const DIFICULDADE_CHAVE = { Facil: 'easy', Moderado: 'moderate', Dificil: 'hard' };
export function rotuloDificuldade(valor, t) {
  return tem(DIFICULDADE_CHAVE, valor) ? t(`unitForm.difficulty.${DIFICULDADE_CHAVE[valor]}`) : valor;
}

/* Comodidades fixas do formulario de actividade (ACTIVITY_AMENS) */
export const COMODIDADE_ACTIVIDADE_CHAVE = {
  'Equipamento incluído': 'equipment',
  'Instrutor certificado': 'instructor',
  'Seguro': 'insurance',
  'Fotografias/Vídeo': 'photos',
  'Transporte': 'transport',
  'Snacks e água': 'snacks',
  'Vestiário': 'changingRoom',
  'Toalhas': 'towels',
};
export function rotuloComodidadeActividade(valor, t) {
  return tem(COMODIDADE_ACTIVIDADE_CHAVE, valor) ? t(`unitForm.amenity.${COMODIDADE_ACTIVIDADE_CHAVE[valor]}`) : valor;
}

/* Categorias (unit_type) por tipo de operador. Alguns valores estao gravados sem acento ('Sessao',
   'Economico', 'Terraco') e o pt.json tem de os ter acentuados; por isso em pt mostra-se o proprio valor,
   tal como sempre se leu. */
export const TIPO_UNIDADE_CHAVE = {
  Mergulho: 'diving', Kitesurf: 'kitesurf', Snorkeling: 'snorkeling', 'Passeio de Barco': 'boatTrip',
  'Quad / Buggy': 'quadBuggy', Pesca: 'fishing', Surf: 'surf', Windsurf: 'windsurf', Tour: 'tour', Sessao: 'session',
  'Quarto Standard': 'standardRoom', 'Quarto Double': 'doubleRoom', Suite: 'suite', Apartamento: 'apartment',
  Villa: 'villa', Bungalow: 'bungalow',
  Economico: 'economy', Compacto: 'compact', SUV: 'suv', Pickup: 'pickup', Moto: 'motorbike', Van: 'van', Executivo: 'executive',
  Single: 'single', Double: 'double', Twin: 'twin', Outro: 'other',
  'Mesa Interior': 'indoorTable', 'Mesa Exterior': 'outdoorTable', 'Mesa VIP': 'vipTable', Terraco: 'terrace',
};
export function rotuloTipoUnidade(valor, t, lang = linguaActual()) {
  if (lang === 'pt') return valor;
  if (!tem(TIPO_UNIDADE_CHAVE, valor)) return rotuloZonaMesa(valor, t);
  return t(`unitForm.unitType.${TIPO_UNIDADE_CHAVE[valor]}`);
}

/* Comodidades dos quartos, das viaturas e das mesas (ROOM_AMENS, CAR_AMENS, RESTAURANT_AMENS). O valor
   gravado e o da chave e aparece nas paginas publicas; uma comodidade que o mapa nao conhece fica como esta. */
export const COMODIDADE_CHAVE = {
  AC: 'ac', TV: 'tv', WiFi: 'wifi', Cofre: 'safe', Minibar: 'minibar', Jacuzzi: 'jacuzzi', Varanda: 'balcony',
  Banheira: 'bathtub', Cozinha: 'kitchen',
  GPS: 'gps', Bluetooth: 'bluetooth', USB: 'usb', 'Cadeira bebe': 'babySeat', '4x4': 'fourByFour',
  'Teto solar': 'sunroof', 'Camera re': 'rearCamera',
  'Ar condicionado': 'airConditioning', 'Vista mar': 'seaView', 'Terraço': 'terrace',
  'Acesso cadeira de rodas': 'wheelchair', Estacionamento: 'parking', 'Música ao vivo': 'liveMusic',
  'Ambiente para crianças': 'kidsFriendly',
};
export function rotuloComodidade(valor, t) {
  return tem(COMODIDADE_CHAVE, valor) ? t(`unitForm.amenities.${COMODIDADE_CHAVE[valor]}`) : valor;
}

/* Vista do quarto (meta.view): Mar / Jardim / Piscina / Cidade / Sem vista */
export const VISTA_QUARTO_CHAVE = { Mar: 'sea', Jardim: 'garden', Piscina: 'pool', Cidade: 'city', 'Sem vista': 'none' };
export function rotuloVistaQuarto(valor, t) {
  return tem(VISTA_QUARTO_CHAVE, valor) ? t(`unitForm.roomView.${VISTA_QUARTO_CHAVE[valor]}`) : valor;
}

/* Zona da mesa. Aceita a chave de meta.zone ('terraco') e o unit_type gravado a partir dela ('Terraco'). */
export const ZONA_MESA_CHAVE = { interior: 'interior', esplanada: 'esplanada', terraco: 'terrace', vip: 'vip', privado: 'private' };
export function rotuloZonaMesa(valor, t) {
  const chave = typeof valor === 'string' ? valor.toLowerCase() : valor;
  return tem(ZONA_MESA_CHAVE, chave) ? t(`unitForm.zones.${ZONA_MESA_CHAVE[chave]}`) : valor;
}
