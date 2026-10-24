#!/usr/bin/env node
/* Ligacao assistida de um operador a WhatsApp Cloud API (camada de mensagens, fase 3).

   Uso (no servidor, dentro de backend/):
     node scripts/messaging-cloud.js connect <slug|id> --phone-id <phone_number_id> --waba-id <waba_id> [--pending]
     node scripts/messaging-cloud.js status <slug|id>
     node scripts/messaging-cloud.js templates <slug|id> submit|sync
     node scripts/messaging-cloud.js activate|suspend <slug|id>
     node scripts/messaging-cloud.js disconnect <slug|id>

   O token de sistema da Meta nunca se passa na linha de comandos nem fica no historico: e pedido sem eco
   (ou lido do stdin se nao houver terminal), validado na Meta e guardado cifrado (AES-256-GCM).
   Precisa de MESSAGING_ENCRYPTION_KEY no .env do backend. */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { supabaseAdmin: db } = require('../src/config/supabase');
const cloudApi = require('../src/messaging/providers/cloudApi');
const { guardarSegredo, lerSegredo, apagarSegredo } = require('../src/messaging/secrets');
const { DEFINICOES, paraSubmeter } = require('../src/messaging/metaTemplates');

const provider = cloudApi.criarCloudApiProvider({
  graphVersion: process.env.META_GRAPH_VERSION || cloudApi.VERSAO_POR_OMISSAO,
  obterCredenciais: async () => null, janelaAberta: async () => false, obterTemplate: async () => null,
});

function argumento(nome) {
  const i = process.argv.indexOf(`--${nome}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

/* Le o token sem o mostrar. Sem terminal (pipe), le a primeira linha do stdin. */
function lerSegredoOculto(pergunta) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      let d = '';
      process.stdin.on('data', (c) => { d += c; }).on('end', () => resolve(d.split('\n')[0].trim()));
      return;
    }
    process.stdout.write(pergunta);
    let valor = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const fim = () => { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.removeListener('data', aoReceber); process.stdout.write('\n'); resolve(valor.trim()); };
    const aoReceber = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') return fim();
        if (ch === '\u0003') { process.stdout.write('\n'); process.exit(130); } // Ctrl+C
        if (ch === '\u007f' || ch === '\b') valor = valor.slice(0, -1);
        else valor += ch;
      }
    };
    process.stdin.on('data', aoReceber);
  });
}

async function operador(ref) {
  const porId = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(ref);
  const { data } = await db.from('operators').select('id, name, slug').eq(porId ? 'id' : 'slug', ref).maybeSingle();
  if (!data) { console.error(`Operador "${ref}" nao encontrado.`); process.exit(1); }
  return data;
}

async function config(operatorId) {
  const { data } = await db.from('messaging_config').select('*').eq('operator_id', operatorId).maybeSingle();
  return data;
}

async function credenciais(op) {
  const c = await config(op.id);
  if (!c?.cloud_phone_id || !c?.cloud_token_ref) { console.error('Este operador nao tem a Cloud API ligada (usar "connect").'); process.exit(1); }
  const token = await lerSegredo(c.cloud_token_ref);
  if (!token) { console.error('Nao foi possivel ler o token guardado.'); process.exit(1); }
  return { cfg: c, phoneNumberId: c.cloud_phone_id, wabaId: c.cloud_waba_id, token };
}

function mostrarNumero(n) {
  console.log(`  numero:      ${n.display_phone_number || '-'} (${n.verified_name || 'sem nome verificado'})`);
  console.log(`  estado:      ${n.status || '-'}  |  qualidade: ${n.quality_rating || '-'}  |  limite: ${n.messaging_limit_tier || '-'}`);
}

async function ligar(op) {
  const phoneId = argumento('phone-id');
  const wabaId = argumento('waba-id');
  if (!phoneId || !wabaId) { console.error('Faltam --phone-id e --waba-id.'); process.exit(1); }
  const token = await lerSegredoOculto('Token de sistema da Meta (nao aparece no ecra): ');
  if (!token) { console.error('Sem token.'); process.exit(1); }

  const n = await provider.estadoNumero({ phoneNumberId: phoneId, token });
  if (!n.ok) {
    console.error(`A Meta recusou estas credenciais (HTTP ${n.httpStatus}${n.codigo ? `, codigo ${n.codigo}` : ''}): ${n.erro || 'sem detalhe'}`);
    console.error('Nada foi guardado.');
    process.exit(1);
  }
  const anterior = await config(op.id);
  const ref = await guardarSegredo(op.id, token);
  const activar = !process.argv.includes('--pending');
  const { error } = await db.from('messaging_config').upsert({
    operator_id: op.id, provider: 'cloud_api', cloud_phone_id: phoneId, cloud_waba_id: wabaId, cloud_token_ref: ref,
    cloud_status: activar ? 'active' : 'pending', quality_rating: n.quality_rating || null,
    wa_number: anterior?.wa_number || (n.display_phone_number ? `+${String(n.display_phone_number).replace(/\D/g, '')}` : null),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'operator_id' });
  if (error) { console.error('Erro a guardar a configuracao:', error.message); process.exit(1); }

  console.log(`Operador "${op.name}" ligado a Cloud API (${activar ? 'activa' : 'pendente'}). Token guardado cifrado.`);
  mostrarNumero(n);
  const sub = await provider.subscreverApp({ wabaId, token });
  console.log(`  subscricao de eventos da WABA: ${sub.ok ? 'ok' : `FALHOU (HTTP ${sub.httpStatus}${sub.erro ? `, ${sub.erro}` : ''})`}`);
  console.log('Proximo passo: node scripts/messaging-cloud.js templates ' + (op.slug || op.id) + ' submit');
}

async function estado(op) {
  const c = await config(op.id);
  console.log(`Operador: ${op.name} (${op.slug})`);
  if (!c) { console.log('  sem configuracao de mensagens (usa wa.me)'); return; }
  console.log(`  canal: ${c.provider}  |  cloud_status: ${c.cloud_status}  |  phone_number_id: ${c.cloud_phone_id || '-'}  |  waba: ${c.cloud_waba_id || '-'}`);
  const { data: tpls } = await db.from('message_meta_templates').select('trigger, locale, meta_name, meta_language, meta_status, meta_reason').eq('operator_id', op.id).order('trigger');
  console.log('  templates:');
  if (!tpls?.length) console.log('    (nenhum submetido)');
  for (const t of tpls || []) console.log(`    ${t.trigger.padEnd(18)} ${t.locale}  ${t.meta_name}/${t.meta_language}  -> ${t.meta_status}${t.meta_reason ? ` (${t.meta_reason})` : ''}`);
  if (c.cloud_phone_id && c.cloud_token_ref) {
    const { phoneNumberId, token } = await credenciais(op);
    const n = await provider.estadoNumero({ phoneNumberId, token });
    console.log(n.ok ? 'Meta (agora):' : `Meta: nao foi possivel consultar (HTTP ${n.httpStatus}${n.erro ? `, ${n.erro}` : ''})`);
    if (n.ok) mostrarNumero(n);
  }
}

async function templates(op, accao) {
  const { wabaId, token } = await credenciais(op);
  if (accao === 'submit') {
    for (const def of DEFINICOES) {
      for (const locale of Object.keys(def.locales)) {
        const corpo = paraSubmeter(def, locale);
        const r = await provider.submeterTemplate({ wabaId, token }, corpo);
        const erro = r.corpo?.error;
        // codigo 100 / subcodigo 2388023 = ja existe nesse idioma: so sincronizar o estado
        const jaExiste = erro && Number(erro.error_subcode) === 2388023;
        if (r.ok || jaExiste) {
          await db.from('message_meta_templates').upsert({
            operator_id: op.id, trigger: def.trigger, locale, meta_name: def.name, meta_language: corpo.language,
            meta_status: 'pending', meta_template_id: r.corpo?.id ? String(r.corpo.id) : null, updated_at: new Date().toISOString(),
          }, { onConflict: 'operator_id,trigger,locale' });
        }
        console.log(`  ${def.name}/${corpo.language}: ${r.ok ? `submetido (${r.corpo?.status || 'PENDING'})` : jaExiste ? 'ja existia' : `ERRO ${r.httpStatus}: ${erro?.error_user_msg || erro?.message || 'sem detalhe'}`}`);
      }
    }
    console.log('A Meta aprova em minutos ou horas. Para ver o estado: templates <operador> sync');
  }
  if (accao === 'sync' || accao === 'submit') {
    const l = await provider.listarTemplates({ wabaId, token });
    if (!l.ok) { console.error(`Nao foi possivel listar os templates (HTTP ${l.httpStatus}${l.erro ? `, ${l.erro}` : ''}).`); process.exit(1); }
    let n = 0;
    for (const t of l.templates) {
      const estadoLocal = cloudApi.estadoDoTemplate(t.status);
      if (!estadoLocal) continue;
      const { data } = await db.from('message_meta_templates').update({
        meta_status: estadoLocal, meta_template_id: String(t.id), meta_reason: t.rejected_reason && t.rejected_reason !== 'NONE' ? t.rejected_reason : null, updated_at: new Date().toISOString(),
      }).eq('operator_id', op.id).eq('meta_name', t.name).eq('meta_language', t.language).select('id');
      n += (data || []).length;
    }
    console.log(`Estados sincronizados: ${n} template(s) nossos actualizados (${l.templates.length} na conta).`);
  }
}

async function mudarEstado(op, novo) {
  const c = await config(op.id);
  if (!c?.cloud_phone_id) { console.error('Sem Cloud API ligada.'); process.exit(1); }
  await db.from('messaging_config').update({ cloud_status: novo, updated_at: new Date().toISOString() }).eq('operator_id', op.id);
  console.log(`cloud_status de "${op.name}": ${novo}${novo === 'active' ? '' : ' (as mensagens passam ao wa.me)'}`);
}

async function desligar(op) {
  const c = await config(op.id);
  if (c?.cloud_token_ref) await apagarSegredo(c.cloud_token_ref);
  await db.from('messaging_config').update({
    provider: 'wame', cloud_phone_id: null, cloud_waba_id: null, cloud_token_ref: null, cloud_status: 'none', quality_rating: null, updated_at: new Date().toISOString(),
  }).eq('operator_id', op.id);
  console.log(`Cloud API desligada para "${op.name}": token apagado, canal passa ao wa.me.`);
}

(async () => {
  const [comando, ref, sub] = process.argv.slice(2);
  if (!comando || !ref) {
    console.log(require('fs').readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n/, '').replace(/^\/\*\s?/, ''));
    process.exit(1);
  }
  const op = await operador(ref);
  if (comando === 'connect') await ligar(op);
  else if (comando === 'status') await estado(op);
  else if (comando === 'templates') await templates(op, sub);
  else if (comando === 'activate') await mudarEstado(op, 'active');
  else if (comando === 'suspend') await mudarEstado(op, 'suspended');
  else if (comando === 'disconnect') await desligar(op);
  else { console.error(`Comando desconhecido: ${comando}`); process.exit(1); }
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); }).finally(() => process.exit(process.exitCode || 0));
