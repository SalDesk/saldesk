/* Mensagens que chegam aos turistas (conta de viajante, avaliacao por link, pagamento online,
   limites de tentativas) escritas em portugues correcto: sem "nao", "ja", "sessao"... */
const fs = require('fs');
const path = require('path');

const FICHEIROS = [
  'controllers/travelerAuthController.js',
  'controllers/travelerController.js',
  'controllers/reviewController.js',
  'controllers/paymentController.js',
  'middleware/rateLimiters.js',
  'middleware/requireTraveler.js',
];

/* palavras que em portugues levam acento (formas sem acento que aparecem nas mensagens) */
const SEM_ACENTO = /\b(nao|ja|so|sao|esta reserva ja|sessao|avaliacao|avaliacoes|invalido|invalida|invalidas|recuperacao|maximo|comentario|peca|substituido|valido|autenticacao|demonstracao|ira|obrigatorios|obrigatorio|enviamos|faca|historico|definicao|notificacao|notificacoes|concluidas)\b/i;

function mensagens(conteudo) {
  const out = [];
  const re = /\b(error|message):\s*(['`])((?:\\.|(?!\2).)*)\2/g;
  let m;
  while ((m = re.exec(conteudo))) out.push(m[3]);
  return out;
}

describe('mensagens para turistas com acentos', () => {
  FICHEIROS.forEach((f) => {
    it(f, () => {
      const conteudo = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
      const erradas = mensagens(conteudo).filter((t) => SEM_ACENTO.test(t));
      expect(erradas).toEqual([]);
    });
  });
});
