/* Detector partilhado dos testes de acentos: procura palavras portuguesas escritas sem acento
   dentro do texto mostrado (strings e texto JSX), fora dos comentarios. */

/* Paginas publicas de reserva (cobertas por acentosPaginasPublicas.test.js). */
export const FICHEIROS_PUBLICOS = [
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

export const PALAVRAS_BASE = [
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

/* Palavras do painel: so as que estao sempre erradas sem acento em portugues. */
export const PALAVRAS_PAINEL = [
  'periodo', 'Periodo', 'ultimo', 'Ultimo', 'ultima', 'ultimos', 'Ultimas', 'notificacao', 'notificacoes',
  'Notificacoes', 'configuracao', 'configuracoes', 'Configuracoes', 'informacoes', 'sessao', 'Sessao',
  'comissao', 'Comissao', 'descricao', 'Descricao', 'gestao', 'Gestao', 'promocao', 'estatisticas',
  'Estatisticas', 'relatorio', 'relatorios', 'Relatorio', 'calendario', 'Calendario', 'ferias', 'analise',
  'metricas', 'Metricas', 'saude', 'edicao', 'criacao', 'atualizacao', 'actualizacao', 'eliminacao',
  'atencao', 'Atencao', 'transferencia', 'faturacao', 'facturacao', 'cancelacao', 'validacao', 'uteis',
  'publico', 'publica', 'Publico', 'sincronizacao', 'integracao', 'integracoes', 'Integracoes',
  'automacao', 'automacoes', 'Automacoes', 'comunicacao', 'saida', 'ocupacao', 'manutencao', 'rececao',
  'recepcao', 'utilizacao', 'duvidas', 'faca', 'atraves', 'medio', 'Medio', 'tipico', 'negocio', 'Negocio',
  'sugestao', 'especifico', 'especifica', 'suspensao', 'conteudo', 'Conteudo', 'titulo', 'Titulo', 'mes',
  'Unico', 'possiveis', 'Senao', 'senao', 'entao', 'Entao', 'operacao', 'Operacao', 'situacao', 'Situacao',
  'aplicacao', 'Aplicacao', 'funcao', 'Funcao', 'permissao', 'permissoes', 'Permissoes',
];

/* Mais palavras do painel, sempre erradas sem acento (encontradas ao percorrer o frontend). */
export const PALAVRAS_PAINEL_EXTRA = [
  'mutua', 'medios', 'negocios', 'transacao',
  'acao', 'accao', 'accoes', 'acessivel', 'acoes', 'activacao', 'actuacao', 'acumulacao', 'administracao',
  'admissao', 'aerea', 'aereo', 'alem', 'alguem', 'alimentacao', 'alteracao', 'alteracoes', 'amanha',
  'analitica', 'analitico', 'analiticos', 'aniversario', 'antecedencia', 'anuncio', 'anuncios', 'apareca',
  'aparecerao', 'aplicaveis', 'aplicavel', 'aprovacao', 'ardosia', 'areas', 'atribuicao', 'atribuido',
  'audiencia', 'ausencia', 'ausencias', 'austria', 'autenticacao', 'automaticas', 'automaticos',
  'automatizacao', 'autorizacao', 'avancamos', 'avancar', 'avanco', 'balcao', 'belgica', 'beneficios',
  'botao', 'botoes', 'cabecalho', 'caes', 'cafe', 'cancelacoes', 'caracter', 'cardapio', 'cartoes',
  'catalogo', 'caucao', 'certificacao', 'certificacoes', 'cobranca', 'codigos', 'combinavel',
  'combustivel', 'comecar', 'comeco', 'comentario', 'comentarios', 'comissoes', 'competencia',
  'competencias', 'composicao', 'concluida', 'concorrencia', 'condicao', 'condicoes', 'conexao',
  'conexoes', 'confianca', 'confirmacoes', 'contrario', 'contratacao', 'contribuicao', 'contribuicoes',
  'conversao', 'cotacao', 'cotacoes', 'creditos', 'crianca', 'critica', 'criticas', 'critico', 'criticos',
  'debitos', 'declaracao', 'decomposicao', 'decoracao', 'definicoes', 'degustacao', 'demonstracao',
  'descricoes', 'devolucao', 'devolucoes', 'diarias', 'diario', 'diarios', 'diferenca', 'diferencas',
  'dificil', 'distribuicao', 'divulgacao', 'documentacao', 'dominio', 'dominios', 'duvida', 'economico',
  'ecra', 'ecras', 'electrico', 'electronico', 'eletrico', 'eletronico', 'embebivel', 'emergencia',
  'emissao', 'esforco', 'especie', 'especificacoes', 'estao', 'estatistica', 'estatistico', 'estrategica',
  'estrategico', 'excecao', 'excecoes', 'excepcao', 'excepcoes', 'excurcao', 'excursao', 'excursoes',
  'existencia', 'expiracao', 'exportacao', 'exportacoes', 'familia', 'fidelizacao', 'finlandia', 'fisica',
  'fisico', 'formacao', 'formulario', 'franca', 'frances', 'frequencia', 'funcionarios', 'generico',
  'genero', 'gluten', 'grafico', 'graficos', 'historia', 'historica', 'historicos', 'hospede', 'icone',
  'icones', 'identificacao', 'incriveis', 'incrivel', 'indicacao', 'indicacoes', 'indice', 'indisponiveis',
  'ingles', 'inscricao', 'inspecao', 'inspeccao', 'instrucoes', 'intermediarios', 'interrupcoes',
  'intervencao', 'intervencoes', 'italia', 'joao', 'lancamento', 'lancamentos', 'licenca', 'licencas',
  'ligacao', 'ligacoes', 'lingua', 'linguas', 'liquido', 'logistica', 'logistico', 'mae', 'maiuscula',
  'maritima', 'maritimo', 'maximos', 'mecanico', 'medica', 'medico', 'medicos', 'memoria', 'meteorologica',
  'meteorologicas', 'meteorologico', 'meteorologicos', 'metrica', 'minimos', 'ministerio', 'missoes',
  'monitorizacao', 'movel', 'necessaria', 'necessario', 'ninguem', 'niveis', 'nivel', 'numeros',
  'obrigacoes', 'obrigatoria', 'obrigatorias', 'observacao', 'observacoes', 'ocasiao', 'ocorrencia',
  'ocorrencias', 'operacoes', 'opiniao', 'orcamento', 'orcamentos', 'organizacao', 'padrao', 'paginacao',
  'paginas', 'paises', 'paragrafo', 'pendencia', 'pendencias', 'pensao', 'periodos', 'personalizacao',
  'personalizaveis', 'personalizavel', 'polonia', 'portugues', 'pos', 'posicao', 'pratico', 'precipitacao',
  'preferencia', 'preferencias', 'preparacao', 'presenca', 'previsao', 'previsoes', 'promocoes', 'propria',
  'proprio', 'proximas', 'proximos', 'publicacoes', 'publicas', 'questao', 'rapida', 'rapidas', 'rapido',
  'reactivacao', 'realizacao', 'reclamacao', 'recomendacao', 'recomendacoes', 'recuperacao', 'redefinicao',
  'refeicoes', 'referencias', 'regiao', 'reinicio', 'renovacao', 'reservacoes', 'responsaveis',
  'responsavel', 'reuniao', 'reunioes', 'revisao', 'rodape', 'rotulo', 'sabado', 'salario', 'salarios',
  'saudavel', 'selecao', 'seleccao', 'sequencia', 'sequencias', 'sera', 'serao', 'serie', 'sessoes',
  'sitio', 'socioeconomico', 'subscricao', 'subsidio', 'subsidios', 'subtitulo', 'suecia', 'sugestoes',
  'suica', 'tecnica', 'tecnico', 'telefonica', 'telefonico', 'telemoveis', 'temporaria', 'tendencias',
  'terca', 'terraco', 'traducao', 'traducoes', 'trafego', 'transacoes', 'transito', 'transmissao', 'tres',
  'tripulacao', 'turistica', 'turistico', 'turisticos', 'ultimas', 'urgencia', 'usuario', 'usuarios',
  'util', 'utilizacoes', 'variacao', 'variaveis', 'variavel', 'varios', 'verificacao', 'versao', 'versoes',
  'vestuario', 'vigencia', 'visao', 'visiveis', 'visivel', 'visualizacao',
];

/* Cada palavra tambem com a inicial em maiuscula ('periodo' -> 'Periodo'). */
export function comMaiusculas(palavras) {
  return [...new Set(palavras.flatMap((p) => [p, p[0].toUpperCase() + p.slice(1)]))];
}

export function criarDetector(palavras) {
  return new RegExp(`(^|[^\\p{L}\\d_])(${comMaiusculas(palavras).join('|')})(?![\\p{L}\\d_])`, 'u');
}

export function semComentarios(codigo) {
  /* Percorre o codigo a lembrar-se de quando esta dentro de uma string, para nao tomar "image/*" ou
     "http://" por inicio de comentario. Os comentarios ficam em branco com o mesmo comprimento, para os
     indices continuarem a bater. Aspas simples e duplas acabam no fim da linha (um apostrofo no texto JSX,
     como em "d'agua", nao pode estragar o resto do ficheiro). */
  const out = codigo.split('');
  const n = codigo.length;
  const branco = (de, ate) => { for (let k = de; k < ate; k++) if (out[k] !== '\n') out[k] = ' '; };
  let i = 0;
  while (i < n) {
    const c = codigo[i];
    const d = codigo[i + 1];
    if (c === '/' && d === '*') {
      let fim = codigo.indexOf('*/', i + 2);
      fim = fim < 0 ? n : fim + 2;
      branco(i, fim);
      i = fim;
    } else if (c === '/' && d === '/' && codigo[i - 1] !== ':') {
      let fim = codigo.indexOf('\n', i);
      if (fim < 0) fim = n;
      branco(i, fim);
      i = fim;
    } else if (c === "'" || c === '"') {
      let k = i + 1;
      while (k < n && codigo[k] !== c && codigo[k] !== '\n') k += codigo[k] === '\\' ? 2 : 1;
      i = k + 1;
    } else if (c === '`') {
      let k = i + 1;
      while (k < n && codigo[k] !== '`') k += codigo[k] === '\\' ? 2 : 1;
      i = k + 1;
    } else {
      i++;
    }
  }
  return out.join('');
}

/* Texto JSX que na verdade e codigo: um ">" de comparacao seguido de codigo ate ao proximo "<" ou "{"
   (por exemplo "0) tourMeta.options = opcoes; const x = ..."). */
export function pareceCodigo(s) {
  return /^\s*[)\]}]/.test(s)
    || /;\s*(?:\w+[.[(=]|else\b|if\b|const\b|let\b|return\b|\})/.test(s)
    || /(^|[\s(])[A-Za-z_$][\w$]*(?:\.[\w$]+|\[\w+\])*\s=(?:\s|$)/.test(s)
    || /!!|Math\.|\.map\(|\.length\b/.test(s);
}

/* Trechos de texto visivel: conteudo das strings ('...', "...", `...`) e texto JSX entre tags (depois de
   um ">" que nao seja "=>" nem ">="). Cada trecho tem o texto limpo (para detectar) e os intervalos
   [inicio, fim) no codigo (para corrigir). Num template, o codigo dentro de ${...} nao e texto; as
   strings la dentro sao vistas a parte. */
export function trechosVisiveis(codigo, base = 0, opcoes = {}) {
  const trechos = [];
  const re = /'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`|(?<![=-])>(?!=)([^<>{}`'"]+)|(?<=\})([^<>{}`'"]+)(?=[<{])/g;
  let m;
  while ((m = re.exec(codigo))) {
    const g = m[1] !== undefined ? 1 : m[2] !== undefined ? 2 : m[3] !== undefined ? 3 : m[4] !== undefined ? 4 : 5;
    const s = m[g];
    const ini = m.index + m[0].indexOf(s, g >= 4 ? 0 : 1);
    const segs = [];
    if (g === 3) {
      let pos = 0;
      const rx = /\$\{([^{}]*)\}/g;
      let e;
      while ((e = rx.exec(s))) {
        segs.push([ini + pos, ini + e.index]);
        trechos.push(...trechosVisiveis(e[1], base + ini + e.index + 2, opcoes));
        pos = e.index + e[0].length;
      }
      segs.push([ini + pos, ini + s.length]);
    } else {
      segs.push([ini, ini + s.length]);
    }
    const texto = segs.map(([a, b]) => codigo.slice(a, b)).join(' ');
    const seco = texto.trim();
    if (!seco) continue;
    /* O valor de um atributo value="..." e dado do formulario, nao o texto mostrado. */
    if (g <= 2 && /value=\s*$/.test(codigo.slice(Math.max(0, m.index - 12), m.index))) continue;
    /* Uma palavra so: por omissao e id/estado/propriedade; com palavrasSoltas, em JSX ou com maiuscula inicial
       ('Titulo', 'Nao') e texto. */
    if (/^[\w-]+$/.test(seco) && !(opcoes.palavrasSoltas && (g >= 4 || /^\p{Lu}\p{Ll}/u.test(seco)))) continue;
    /* Chaves de i18n ('settings.seguranca.errWeak', 'settings.facturacao.status.') nao sao texto. */
    if (/^[\w-]+(\.[\w-]+)+\.?$/.test(seco)) continue;
    /* O mesmo numa chave montada com ${...} ('settings.notificacoes.items.${id}.label'). */
    if (g === 3 && segs.length > 1 && seco.split(/\s+/).every((tok) => /^(?:[\w-]+\.[\w.-]*|\.[\w-][\w.-]*)$/.test(tok))) continue;
    /* Nome de ficheiro montado com ${...} ('saldesk-relatorio-${a}-${b}.pdf'): so ha pontuacao e a extensao. */
    if (g === 3 && segs.length > 1 && seco.split(/\s+/).every((tok) => /^[A-Za-z0-9_.-]*$/.test(tok)) && /\.[a-z]{2,4}$/.test(seco)) continue;
    if (g >= 4 && pareceCodigo(texto)) continue;
    /* Depois de um "}" tambem vem codigo ("; export function f(", ", variacao: ", " serie=") e nomes de props. */
    if (g === 5 && (/[=;]/.test(texto) || /^\s*[,:)]/.test(texto) || /\b(function|const|let|return|export|import|async|await|var)\b/.test(texto) || /\w\s*\((?!\w+\))/.test(texto) || /\?\./.test(texto))) continue;
    const limpo = texto.split(/\s+/).filter((tok) => !(tok.startsWith('/') || tok.startsWith('./') || tok.startsWith('../') || tok.startsWith('http'))).join(' ');
    trechos.push({ texto: limpo, segs: segs.map(([a, b]) => [a + base, b + base]) });
  }
  return trechos;
}

export function textosVisiveis(codigo, opcoes = {}) {
  return trechosVisiveis(codigo, 0, opcoes).map((t) => t.texto);
}
