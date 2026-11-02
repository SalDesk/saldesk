#!/usr/bin/env node
/* Emails que falharam (reenvio automatico). Uso, dentro de backend/:
     node scripts/email-failures.js list [--all]       por entregar e esgotados (--all: tambem enviados e permanentes)
     node scripts/email-failures.js retry <id|all>     volta a tentar agora (poe na fila para o worker, ja)
     node scripts/email-failures.js discard <id>       desiste desse email (fica como permanente)
   O conteudo dos emails nao e mostrado aqui. */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { supabaseAdmin: db } = require('../src/config/supabase');

/* Procura por inicio do id (o PostgREST nao filtra uuid por prefixo): devolve o id completo ou sai com erro. */
async function resolverId(prefixo) {
  const { data } = await db.from('email_failures').select('id').order('created_at', { ascending: false }).limit(1000);
  const achados = (data || []).filter((r) => r.id.startsWith(prefixo));
  if (achados.length !== 1) { console.error(achados.length ? 'Id ambiguo: usar mais caracteres.' : 'Id nao encontrado.'); process.exit(1); }
  return achados[0].id;
}

const hora = (d) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 16) : '-');

(async () => {
  const [comando, alvo] = process.argv.slice(2);
  if (comando === 'list') {
    const todos = process.argv.includes('--all');
    let q = db.from('email_failures')
      .select('id, status, kind, attempts, context, to_email, created_at, next_attempt_at, last_error')
      .neq('status', 'legacy').order('created_at', { ascending: false }).limit(60);
    if (!todos) q = q.in('status', ['pending', 'sending', 'abandoned']);
    const { data, error } = await q;
    if (error) throw error;
    if (!data.length) console.log('Nada por entregar.');
    for (const r of data) {
      console.log(`${r.id.slice(0, 8)}  ${r.status.padEnd(9)} ${r.kind === 'alert' ? '[alerta] ' : ''}tent.${r.attempts}  criado ${hora(r.created_at)}  prox ${hora(r.next_attempt_at)}`);
      console.log(`          "${String(r.context || '').slice(0, 70)}" -> ${r.to_email}`);
      if (r.last_error) console.log(`          erro: ${String(r.last_error).slice(0, 140)}`);
    }
  } else if (comando === 'retry' && alvo) {
    let q = db.from('email_failures').update({ status: 'pending', next_attempt_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .in('status', ['pending', 'abandoned', 'permanent']).not('payload', 'is', null);
    if (alvo !== 'all') q = q.eq('id', await resolverId(alvo));
    const { data, error } = await q.select('id');
    if (error) throw error;
    console.log(`${data.length} email(s) postos na fila: o worker tenta no proximo minuto.`);
  } else if (comando === 'discard' && alvo) {
    const id = await resolverId(alvo);
    await db.from('email_failures').update({ status: 'permanent', last_error: 'descartado manualmente', next_attempt_at: null, alerted_at: new Date().toISOString() }).eq('id', id);
    console.log('Descartado.');
  } else {
    console.log(require('fs').readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n/, '').replace(/^\/\*\s?/, ''));
    process.exit(1);
  }
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); }).finally(() => process.exit(process.exitCode || 0));
