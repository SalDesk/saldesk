// Filtros de data de GET /reservations.
// Funcoes puras: sem acesso a base de dados, faceis de testar.

const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;

// Mapeia cada parametro de query para o nome da chave no objecto de filtros
const PARAMETROS = [
  ['check_in_from', 'checkInFrom'],
  ['check_in_to', 'checkInTo'],
  ['stay_from', 'stayFrom'],
  ['stay_to', 'stayTo'],
];

function erro400(message, code) {
  const err = new Error(message);
  err.status = 400;
  err.code = code;
  return err;
}

// Data valida: formato YYYY-MM-DD e existente no calendario (2026-02-30 nao existe)
function dataExiste(valor) {
  if (!FORMATO_DATA.test(valor)) return false;
  const [ano, mes, dia] = valor.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

// Le e valida os filtros de data da query. Ausente ou string vazia = sem filtro.
// Lanca erro com status 400 (code INVALID_DATE ou INVALID_RANGE) se algo for invalido.
function lerFiltrosDeData(query) {
  const q = query || {};
  const filtros = {};

  for (const [param, chave] of PARAMETROS) {
    const valor = q[param];
    if (valor === undefined || valor === null || valor === '') continue;
    if (typeof valor !== 'string' || !dataExiste(valor)) {
      throw erro400(`Data invalida em ${param}: ${valor}`, 'INVALID_DATE');
    }
    filtros[chave] = valor;
  }

  // Datas ISO comparam-se como strings
  if (filtros.stayFrom && filtros.stayTo && filtros.stayFrom > filtros.stayTo) {
    throw erro400('stay_from nao pode ser posterior a stay_to', 'INVALID_RANGE');
  }
  if (filtros.checkInFrom && filtros.checkInTo && filtros.checkInFrom > filtros.checkInTo) {
    throw erro400('check_in_from nao pode ser posterior a check_in_to', 'INVALID_RANGE');
  }

  return filtros;
}

// Aplica os filtros ao builder do PostgREST. Limites inclusivos.
// A estadia sobrepoe-se ao intervalo: check_in <= stayTo e check_out >= stayFrom.
function aplicarFiltrosDeData(q, filtros) {
  if (filtros.checkInFrom) q = q.gte('check_in', filtros.checkInFrom);
  if (filtros.checkInTo) q = q.lte('check_in', filtros.checkInTo);
  if (filtros.stayTo) q = q.lte('check_in', filtros.stayTo);
  if (filtros.stayFrom) q = q.gte('check_out', filtros.stayFrom);
  return q;
}

module.exports = { lerFiltrosDeData, aplicarFiltrosDeData };
