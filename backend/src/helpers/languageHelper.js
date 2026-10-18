/* A plataforma so tem mensagens em portugues e ingles (e a base de dados so aceita
   'pt' e 'en' em customers.language). Hospedes de outros paises vao para ingles;
   so ficam em portugues os lusofonos e os paises que nao reconhecemos.
   Devolver 'de' ou 'nl' aqui fazia o INSERT falhar (customers_language_check) e o
   cliente nao era guardado. */
const EN_COUNTRIES = new Set([
  'GB', 'US', 'AU', 'IE', 'NZ', 'ZA', 'CA',
  // germanofonos e neerlandofonos
  'DE', 'AT', 'NL', 'BE', 'LU', 'SR',
  // nordicos, bálticos e outros
  'SE', 'NO', 'DK', 'FI', 'CH', 'IS', 'MT', 'CY', 'EE', 'LV', 'LT',
]);

function detectarIdioma(countryCode) {
  if (!countryCode) return 'pt';
  return EN_COUNTRIES.has(countryCode.toUpperCase()) ? 'en' : 'pt';
}

module.exports = { detectarIdioma };
