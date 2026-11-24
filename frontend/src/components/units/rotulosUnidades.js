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
  'Mesa Interior': 'indoorTable', 'Mesa Exterior': 'outdoorTable', 'Mesa VIP': 'vipTable', Terraco: 'terrace',
};
export function rotuloTipoUnidade(valor, t, lang = linguaActual()) {
  if (lang === 'pt' || !tem(TIPO_UNIDADE_CHAVE, valor)) return valor;
  return t(`unitForm.unitType.${TIPO_UNIDADE_CHAVE[valor]}`);
}
