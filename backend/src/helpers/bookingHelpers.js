// Verifica se uma unidade está disponível num período
async function verificarDisponibilidade(supabase, unitId, checkIn, checkOut, excluirReservaId = null) {
  let query = supabase
    .from('reservations')
    .select('id')
    .eq('unit_id', unitId)
    .in('status', ['pending', 'confirmed', 'checked_in'])
    .lt('check_in', checkOut)
    .gt('check_out', checkIn);

  if (excluirReservaId) {
    query = query.neq('id', excluirReservaId);
  }

  const { data: conflitos } = await query;
  if (conflitos?.length > 0) return false;

  const { data: bloqueadas } = await supabase
    .from('blocked_dates')
    .select('id')
    .eq('unit_id', unitId)
    .gte('date', checkIn)
    .lt('date', checkOut);

  return !(bloqueadas?.length > 0);
}

// Calcula o preço total dia a dia aplicando pricing_rules activas
function calcularPreco(unit, checkIn, checkOut) {
  const dtIn = new Date(checkIn);
  const dtOut = new Date(checkOut);
  const regras = (unit.pricing_rules || []).filter((r) => r.active);

  let total = 0;
  const cur = new Date(dtIn);

  while (cur < dtOut) {
    let precoDia = Number(unit.base_price);
    const diaSemana = cur.getDay();
    const dataStr = cur.toISOString().split('T')[0];

    for (const r of regras) {
      const dentroPeriodo =
        (!r.start_date || dataStr >= r.start_date) &&
        (!r.end_date || dataStr <= r.end_date);
      const diaValido = !r.days_of_week || r.days_of_week.includes(diaSemana);

      if (dentroPeriodo && diaValido) {
        if (r.modifier_type === 'percentage') {
          precoDia = precoDia * (1 + Number(r.price_modifier) / 100);
        } else {
          precoDia = precoDia + Number(r.price_modifier);
        }
      }
    }

    total += Math.max(0, precoDia);
    cur.setDate(cur.getDate() + 1);
  }

  const dias = Math.ceil((dtOut - dtIn) / (1000 * 60 * 60 * 24));
  return { total: Math.round(total * 100) / 100, dias };
}

module.exports = { verificarDisponibilidade, calcularPreco };
