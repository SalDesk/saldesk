import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

/* Textos que o turista le nas paginas publicas de reserva (pagina do operador, detalhe do servico,
   avaliacao, retorno do pagamento, widget do restaurante, rodape de conformidade e politica de
   cancelamento gerada) escritos com acentos ("Código", "horário", "Serviços", "está incluído"...).
   Procura so dentro do texto mostrado (strings e texto JSX), fora dos comentarios. As strings que
   sao uma unica palavra sem espacos (ids de seccao 'servicos', estados 'invalido', propriedades),
   os caminhos com ${...} e os caminhos de modulos ('../components/servico/...') ficam de fora: sao
   valores do codigo, nao texto para o turista. */
const FICHEIROS = [
  'pages/PublicBooking.jsx',
  'pages/ServiceDetail.jsx',
  'pages/ReviewPage.jsx',
  'pages/BookingSuccess.jsx',
  'pages/BookingCancel.jsx',
  'components/restaurant/RestaurantReservationWidget.jsx',
  'components/shared/SiteComplianceFooter.jsx',
  'utils/politicaCancelamento.js',
  'components/servico/CabecalhoActividade.jsx',
  'components/servico/GaleriaActividade.jsx',
  'components/servico/FactosActividade.jsx',
  'components/servico/MenuSeccoes.jsx',
  'components/servico/SeccoesActividade.jsx',
  'components/servico/ReservaActividade.jsx',
  'components/servico/CalendarioReserva.jsx',
  'components/servico/HorariosReserva.jsx',
  'components/servico/BarraReservaMovel.jsx',
  'components/servico/FalhaComRepetir.jsx',
];

const PALAVRAS = [
  'nao', 'Nao', 'ja', 'Ja', 'so', 'ate', 'Ate', 'apos', 'sao', 'Sao', 'esta incluido', 'esta incluida',
  'E adequado', 'e adequada', 'tambem', 'voce', 'Ola', 'Mes', 'Pais',
  'horario', 'Horario', 'horarios', 'codigo', 'Codigo', 'invalido', 'Invalido', 'valido', 'valida',
  'disponivel', 'disponiveis', 'Disponivel', 'indisponivel', 'possivel', 'impossivel',
  'servico', 'Servico', 'servicos', 'Servicos', 'pagina', 'Pagina', 'proximo', 'Proximo', 'proxima',
  'numero', 'Numero', 'preco', 'Preco', 'precos', 'opcao', 'opcoes', 'Opcoes', 'informacao', 'Informacao',
  'localizacao', 'Localizacao', 'duracao', 'Duracao', 'avaliacao', 'Avaliacao', 'avaliacoes', 'Avaliacoes',
  'experiencia', 'experiencias', 'Experiencia', 'media', 'facil', 'unico', 'unica', 'automatico',
  'automatica', 'historico', 'criancas', 'Criancas', 'almoco', 'seguranca', 'Seguranca',
  'confirmacao', 'Confirmacao', 'cartao', 'Cartao', 'credito', 'debito', 'deposito', 'metodo', 'metodos',
  'Recebera', 'recebera', 'confortavel', 'agua', 'camara', 'basico', 'incluido', 'Incluido', 'inclusao',
  'conducao', 'faco', 'familias', 'dieteticos', 'obrigatorio', 'obrigatorios', 'Obrigatorio', 'telemovel',
  'endereco', 'Endereco', 'minimo', 'maximo', 'politica', 'Politica', 'gratis', 'Gratis', 'inicio', 'Inicio',
  'Referencia', 'concluido', 'atras', 'pode nao', 'hospedes', 'Hospedes',
];
const SEM_ACENTO = new RegExp(`(^|[^\\p{L}\\d_])(${PALAVRAS.join('|')})(?![\\p{L}\\d_])`, 'u');

function semComentarios(codigo) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n').map((l) => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1')).join('\n');
}

/* Texto visivel: conteudo das strings ('...', "...", `...`) e texto JSX entre tags (depois de um ">"
   que nao seja "=>" nem ">="). */
function textosVisiveis(codigo) {
  const textos = [];
  const re = /'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`|(?<![=-])>(?!=)([^<>{}`'"]+)/g;
  let m;
  while ((m = re.exec(codigo))) {
    let s = m[1] ?? m[2] ?? m[3] ?? m[4];
    /* Num template, o codigo dentro de ${...} nao e texto; as strings la dentro sao vistas a parte. */
    if (m[3] !== undefined) {
      s = s.replace(/\$\{([^{}]*)\}/g, (_, expr) => { textos.push(...textosVisiveis(expr)); return ' '; });
    }
    if (!s || !s.trim()) continue;
    if (/^[\w-]+$/.test(s.trim())) continue;
    const limpo = s.split(/\s+/).filter((tok) => !(tok.includes('${') && tok.includes('/')) && !tok.startsWith('/') && !tok.startsWith('./') && !tok.startsWith('../') && !tok.startsWith('http')).join(' ');
    textos.push(limpo);
  }
  return textos;
}

describe('paginas publicas de reserva com acentos', () => {
  FICHEIROS.forEach((rel) => {
    it(rel, () => {
      const codigo = semComentarios(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n'));
      const errados = textosVisiveis(codigo).filter((t) => SEM_ACENTO.test(t)).map((t) => t.trim().slice(0, 120));
      expect(errados).toEqual([]);
    });
  });

  it('o detector apanha texto sem acento e ignora ids e caminhos', () => {
    const exemplo = [
      "const a = lang === 'en' ? 'Invalid code' : 'Codigo invalido';",
      "<p>{lang === 'en' ? ' services available' : ' servicos disponiveis'}</p>",
      "<h2>O seguro esta incluido?</h2>",
      "scrollTo('servicos'); navigate(`/book/${slug}/servico/${u.id}`); setFase('invalido');",
      "const ok = a?.disponivel === true;",
      "import Galeria from '../components/servico/GaleriaActividade';",
    ].join('\n');
    const achados = textosVisiveis(exemplo).filter((t) => SEM_ACENTO.test(t));
    expect(achados).toEqual(['Codigo invalido', ' servicos disponiveis', 'O seguro esta incluido?']);
  });
});
