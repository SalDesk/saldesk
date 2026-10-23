/* Preenche as variaveis das mensagens das automacoes (assunto e corpo).

   Ha dois vocabularios em uso e os dois tem de funcionar:
     - os modelos prontos do painel:  {nome_cliente} {nome_tour} {data} {hora} {guia} {ponto_encontro}
     - o formulario manual (legado):  {{nome}} {{unidade}} {{check_in}} {{check_out}} {{total}} {{operador}}
   Antes, o envio so conhecia o segundo, por isso as mensagens criadas a partir dos
   modelos prontos chegavam ao cliente com as chavetas por preencher. */

function formatarData(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (d || '');
}

function formatarHora(t) {
  const m = /^(\d{1,2}):(\d{2})/.exec(t || '');
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}

function construirVariaveis(d) {
  const total = d.total_price ? `${Number(d.total_price).toFixed(2)} €` : '';
  return {
    // modelos prontos
    nome_cliente: d.customer_name || '',
    nome_tour: d.unit_name || '',
    data: formatarData(d.check_in),
    hora: formatarHora(d.start_time),
    guia: d.guide_name || '',
    ponto_encontro: d.meeting_point || '',
    link_avaliacao: d.review_link || '',
    // formulario manual (legado: mantem a data em AAAA-MM-DD como ate aqui)
    nome: d.customer_name || '',
    unidade: d.unit_name || '',
    check_in: d.check_in || '',
    check_out: d.check_out || '',
    total,
    operador: d.operator_name || '',
  };
}

const TOKEN = /\{\{\s*([a-z_]+)\s*\}\}|\{([a-z_]+)\}/gi;

/* Variaveis que podem faltar sem estragar a mensagem: quando nao ha valor, sai a
   frase inteira ("Guia: {guia}."), em vez de ficar "Guia: " vazio. */
const OPCIONAIS = ['guia', 'ponto_encontro'];

function renderTemplate(template, dados) {
  if (!template) return '';
  const vars = construirVariaveis(dados || {});
  let out = String(template);

  // Sem hora conhecida, tira tambem o "as"/"às"/"at" que a antecede.
  if (!vars.hora) out = out.replace(/\s+(?:as|às|at)\s+(?:\{\{\s*hora\s*\}\}|\{hora\})/gi, '');

  for (const nome of OPCIONAIS) {
    if (vars[nome]) continue;
    const token = `(?:\\{\\{\\s*${nome}\\s*\\}\\}|\\{${nome}\\})`;
    // Leva o espaco que a antecede e o ponto final, mas deixa o espaco que a segue (separa da frase seguinte).
    out = out.replace(new RegExp(`[^\\n.]*${token}[^\\n.]*\\.?`, 'g'), '');
  }
  out = out.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n');

  // Variavel desconhecida fica como esta (nunca se apaga texto que nao percebemos).
  return out.replace(TOKEN, (match, a, b) => {
    const nome = (a || b).toLowerCase();
    return Object.prototype.hasOwnProperty.call(vars, nome) ? vars[nome] : match;
  }).trim();
}

module.exports = { renderTemplate, formatarData, formatarHora };
