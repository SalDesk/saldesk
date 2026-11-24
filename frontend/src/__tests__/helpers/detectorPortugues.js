/* Detector do teste contra portugues fixo no painel (painelSemPortuguesFixo.test.js): procura, no texto
   mostrado fora dos comentarios, letras acentuadas ou palavras que so podem ser portuguesas. Reaproveita
   o recorte de texto visivel do detector de acentos (chaves de i18n, ids, caminhos e codigo ficam de fora).
   Limites por desenho:
   - uma palavra so, em minusculas, entre aspas ('pendente', 'reservas') e tratada como id e nao e vista;
   - uma palavra com maiuscula sem acento que nao esteja em PALAVRAS_PORTUGUESAS ('Total', 'Bloqueio') passa;
   - as palavras pequenas em minusculas ('as', 'do', 'no') tambem apanham ingles a meio de uma frase; texto
     visivel nao deve estar no codigo em lingua nenhuma, por isso isso e aceite. */
import { semComentarios, trechosVisiveis } from './detectorAcentos';

/* Nomes de marcas que aparecem tal e qual em qualquer lingua. */
export const MARCAS = ['Booking.com', 'GetYourGuide', 'SalDesk', 'PayPal', 'SISP', 'Vinti4', 'Viator', 'WhatsApp', 'Airbnb'];

/* Palavras portuguesas inconfundiveis (com maiuscula e minuscula como escritas: 'No results' em ingles
   nao conta, 'no' minusculo sim). As primeiras sao as do plano; as seguintes sao rotulos do painel que
   so existem em portugues e escapariam por nao terem acento ('Sair', 'Ver todas', '3 reservas'). */
export const PALAVRAS_PORTUGUESAS = [
  'de', 'do', 'da', 'para', 'com', 'não', 'sem', 'uma', 'os', 'as', 'ao', 'em', 'no', 'na', 'por', 'que', 'ou',
  'Guardar', 'Cancelar', 'Eliminar', 'Editar', 'Novo', 'Nova', 'Adicionar', 'Fechar', 'Pesquisar', 'Reservas',
  'Clientes', 'Unidades',
  'Sair', 'Perfil', 'Ver', 'Mais', 'Sem', 'Mensagens', 'Mensagem', 'Pedidos', 'Pedido', 'Quartos', 'Mesas',
  'Frota', 'Guias', 'Funcionalidade', 'Plano', 'Modo', 'Parceria', 'Parcerias', 'Grupos', 'Pacotes',
  'Afiliados', 'Fidelidade', 'Colaboradores', 'Financeiro', 'Meteorologia', 'Crescimento', 'Hoje', 'Todas',
  'reserva', 'reservas', 'hoje', 'mais', 'todas', 'todos', 'lida', 'lidas',
  /* Palavras pequenas com maiuscula no inicio de uma frase ('Por favor', 'Em breve'), so as que nao sao
     palavras inglesas (ficam de fora 'Do', 'No', 'As'), e verbos e rotulos comuns sem acento. */
  'Para', 'Por', 'Com', 'Uma', 'Em', 'Da', 'Ao', 'Ou', 'Na', 'Que', 'De', 'Os',
  'Carregar', 'carregar', 'Remover', 'Criar', 'Voltar', 'Confirmar', 'Enviar', 'Bloquear', 'Ativo', 'Activo', 'Ativa',
  'Activa', 'Nenhum', 'Nenhuma', 'Pessoas', 'pessoas', 'Pago', 'pago',
  'Oferta', 'Ofertas', 'duplo',
];

/* Letras latinas acentuadas (sem o x e o / de multiplicar e dividir). */
const ACENTO = /[À-ÖØ-öø-ÿ]/;

/* Hifen e ponto contam como parte da palavra: 'no-underline' e 'nav.do' nao sao texto portugues. */
const PALAVRA = new RegExp(`(?<![\\p{L}\\d_.-])(?:${PALAVRAS_PORTUGUESAS.join('|')})(?![\\p{L}\\d_-])`, 'u');

function semMarcas(texto) {
  return MARCAS.reduce((acc, marca) => acc.split(marca).join(' '), texto);
}

/* O texto (ja recortado) tem portugues? */
export function temPortugues(texto) {
  const s = semMarcas(texto);
  return ACENTO.test(s) || PALAVRA.test(s);
}

/* Textos visiveis com portugues num ficheiro; os valores de `permitidos` (dados guardados ou comparados,
   com o motivo na lista do teste) nao contam. */
export function textosPortugueses(codigo, permitidos = []) {
  const limpo = semComentarios(String(codigo).replace(/\r\n/g, '\n'));
  const aceites = new Set(permitidos);
  return trechosVisiveis(limpo, 0, { palavrasSoltas: true })
    .map((t) => t.texto.trim())
    .filter((t) => t && !aceites.has(t))
    .filter(temPortugues);
}
