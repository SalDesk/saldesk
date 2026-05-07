// Países onde o idioma padrão das comunicações é inglês
const EN_COUNTRIES = new Set([
  'GB', 'US', 'AU', 'IE', 'NZ', 'ZA', 'CA',
  'DE', 'NL', 'SE', 'NO', 'DK', 'FI', 'AT', 'BE', 'CH',
  'LU', 'IS', 'MT', 'CY', 'EE', 'LV', 'LT'
]);

function detectarIdioma(countryCode) {
  if (!countryCode) return 'pt';
  return EN_COUNTRIES.has(countryCode.toUpperCase()) ? 'en' : 'pt';
}

module.exports = { detectarIdioma };
