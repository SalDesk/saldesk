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
  const weather = asList(src.weather);
  const docAlerts = asList(src.docAlerts);
  const maintenance = asList(src.maintenance);
  const unconfirmed = asList(src.unconfirmed);
  const pendingToday = asList(src.pendingToday);
  const unpaid = asList(src.unpaid);
  const nearlyFull = asList(src.nearlyFull);
  const cleaning = Number(src.cleaning) || 0;

  const items = [];

  /* Meteorologia: tours afectados */
  if (weather.length > 0) {
    const first = weather[0] || {};
    items.push({
      id: 'weather',
      severity: 'critical',
      title: t('dashboard.attention.weather', { n: weather.length }),
      detail: `${first.date} ${first.label}`,
      to: '/meteorologia',
    });
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
    items.push({
      id: 'maintenance',
      severity: 'warning',
      title: t('dashboard.attention.maintenance', { n: maintenance.length }),
      detail: maintenance.map((m) => (m && m.name) || '').join(', '),
      to: '/unidades',
    });
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

  /* Datas quase cheias */
  if (nearlyFull.length > 0) {
    items.push({
      id: 'nearly-full',
      severity: 'info',
      title: t('dashboard.attention.nearlyFull', { n: nearlyFull.length }),
      detail: nearlyFull.map((n) => `${(n && n.name) || ''} ${n ? n.guests : ''}/${n ? n.capacity : ''}`).join('; '),
      to: '/calendario',
    });
  }

  /* Agrupa por gravidade mantendo a ordem das regras dentro de cada grupo */
  return SEVERITY_ORDER.flatMap((s) => items.filter((item) => item.severity === s));
}
