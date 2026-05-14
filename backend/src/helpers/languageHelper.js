const DE_COUNTRIES = new Set(['DE', 'AT']);
const NL_COUNTRIES = new Set(['NL', 'BE', 'LU', 'SR']);
const EN_COUNTRIES = new Set(['GB', 'US', 'AU', 'IE', 'NZ', 'ZA', 'CA', 'SE', 'NO', 'DK', 'FI', 'CH', 'IS', 'MT', 'CY', 'EE', 'LV', 'LT']);

function detectarIdioma(countryCode) {
  if (!countryCode) return 'pt';
  const cc = countryCode.toUpperCase();
  if (DE_COUNTRIES.has(cc)) return 'de';
  if (NL_COUNTRIES.has(cc)) return 'nl';
  if (EN_COUNTRIES.has(cc)) return 'en';
  return 'pt';
}

module.exports = { detectarIdioma };
