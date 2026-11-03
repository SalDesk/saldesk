/* Logica pura do painel "Requer atencao" do Dashboard.
   Sem React e sem imports de servicos: recebe dados ja carregados e devolve itens. */

const PAID_STATUSES = ['confirmed', 'checked_in', 'checked_out'];
const UNPAID_PAYMENT_STATUSES = ['pending', 'partial'];
const MAX_DOC_WARNINGS = 3;
const SEVERITY_ORDER = ['critical', 'warning', 'info'];

/* Garante sempre uma lista (campos em falta contam como lista vazia) */
function asList(value) {
  return Array.isArray(value) ? value : [];
}

/* Entrada valida = objeto nao nulo */
function isObject(value) {
  return value !== null && typeof value === 'object';
}

/* Texto nao vazio ou '' */
function textOf(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/* Numero finito ou NaN (null, '' e undefined contam como em falta) */
function numberOf(value) {
  if (value === null || value === undefined || value === '') return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

/* Reservas ja iniciadas (check_in <= hoje) com pagamento por regularizar */
export function unpaidReservations(reservations, today) {
  return asList(reservations).filter(
    (r) =>
      r &&
      PAID_STATUSES.includes(r.status) &&
      r.check_in <= today &&
      UNPAID_PAYMENT_STATUSES.includes(r.payment_status)
  );
}

/* Constroi a lista ordenada de itens de atencao (critical, warning, info) */
export function buildAttentionItems(input, t) {
  const src = input || {};
  const weather = asList(src.weather).filter(isObject);
  const docAlerts = asList(src.docAlerts);
  const maintenance = asList(src.maintenance);
  const unconfirmed = asList(src.unconfirmed);
  const pendingToday = asList(src.pendingToday);
  const unpaid = asList(src.unpaid);
  /* Datas quase cheias: so entradas com nome e capacidade; guests em falta conta como 0 */
  const nearlyFull = asList(src.nearlyFull)
    .filter((n) => isObject(n) && textOf(n.name) && !Number.isNaN(numberOf(n.capacity)))
    .map((n) => ({
      name: textOf(n.name),
      guests: Number.isNaN(numberOf(n.guests)) ? 0 : numberOf(n.guests),
      capacity: numberOf(n.capacity),
    }));
  const cleaning = Number(src.cleaning) || 0;

  const items = [];

  /* Meteorologia: tours afectados.
     n e a soma dos toursCount validos (negativos e NaN contam 0); sem nenhum
     toursCount valido, cai para o numero de entradas */
  if (weather.length > 0) {
    const first = weather[0];
    const counts = weather.map((w) => numberOf(w.toursCount)).filter((c) => !Number.isNaN(c));
    const toursAffected = counts.length > 0
      ? counts.reduce((sum, c) => sum + Math.max(0, c), 0)
      : weather.length;
    const detail = [textOf(first.date), textOf(first.label)].filter(Boolean).join(' ');
    const item = {
      id: 'weather',
      severity: 'critical',
      title: t('dashboard.attention.weather', { n: toursAffected }),
      to: '/meteorologia',
    };
    if (detail) item.detail = detail;
    items.push(item);
  }

  /* Documentos expirados: um item por alerta */
  docAlerts.forEach((a, i) => {
    if (a && a.type === 'expired') {
      items.push({ id: `doc-expired-${i}`, severity: 'critical', title: a.msg, to: '/unidades' });
    }
  });

  /* Documentos a expirar: no maximo 3 avisos */
  let warnings = 0;
  docAlerts.forEach((a, i) => {
    if (a && a.type === 'warning' && warnings < MAX_DOC_WARNINGS) {
      warnings += 1;
      items.push({ id: `doc-warning-${i}`, severity: 'warning', title: a.msg, to: '/unidades' });
    }
  });

  /* Unidades em manutencao */
  if (maintenance.length > 0) {
    const names = maintenance.map((m) => textOf(m && m.name)).filter(Boolean).join(', ');
    const item = {
      id: 'maintenance',
      severity: 'warning',
      title: t('dashboard.attention.maintenance', { n: maintenance.length }),
      to: '/unidades',
    };
    if (names) item.detail = names;
    items.push(item);
  }

  /* Reservas por confirmar */
  if (unconfirmed.length > 0) {
    items.push({
      id: 'unconfirmed',
      severity: 'warning',
      title: t('dashboard.attention.unconfirmed', { n: unconfirmed.length }),
      to: '/reservas',
    });
  }

  /* Reservas pendentes de hoje */
  if (pendingToday.length > 0) {
    items.push({
      id: 'pending',
      severity: 'warning',
      title: t('dashboard.attention.pending', { n: pendingToday.length }),
      to: '/reservas',
    });
  }

  /* Pagamentos em aberto */
  if (unpaid.length > 0) {
    items.push({
      id: 'unpaid',
      severity: 'warning',
      title: t('dashboard.attention.unpaid', { n: unpaid.length }),
      to: '/reservas',
    });
  }

  /* Limpezas por fazer */
  if (cleaning > 0) {
    items.push({
      id: 'cleaning',
      severity: 'warning',
      title: t('dashboard.attention.cleaning', { n: cleaning }),
      to: '/housekeeping',
    });
  }

  /* Datas quase cheias (so entradas validas, ver acima) */
  if (nearlyFull.length > 0) {
    items.push({
      id: 'nearly-full',
      severity: 'info',
      title: t('dashboard.attention.nearlyFull', { n: nearlyFull.length }),
      detail: nearlyFull.map((n) => `${n.name} ${n.guests}/${n.capacity}`).join('; '),
      to: '/calendario',
    });
  }

  /* Agrupa por gravidade mantendo a ordem das regras dentro de cada grupo */
  return SEVERITY_ORDER.flatMap((s) => items.filter((item) => item.severity === s));
}
