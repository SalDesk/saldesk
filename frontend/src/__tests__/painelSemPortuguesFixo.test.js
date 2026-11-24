import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { textosPortugueses, temPortugues } from './helpers/detectorPortugues';

/* Guarda contra texto portugues escrito directamente no codigo do painel do operador. Todos os ficheiros
   .js/.jsx de frontend/src sao vistos (menos __tests__ e ficheiros de teste) a nao ser que estejam em
   EXCLUIDOS, com o motivo: se alguem voltar a escrever "Guardar" ou "Sem resultados" no JSX, o teste falha.
   Um ficheiro novo do painel e apanhado sem ninguem o acrescentar a uma lista.
   Caminhos relativos a frontend/src; uma entrada que acaba em / vale para a pasta toda.
   Limites por desenho do detector (ver helpers/detectorPortugues.js): uma palavra so, em minusculas, entre
   aspas e tratada como id e nao e vista; uma palavra com maiuscula, sem acento e fora de PALAVRAS_PORTUGUESAS
   passa. A guarda apanha o grosso; a revisao continua a ser precisa para o resto. */
const MOTIVO_FUNDADOR = 'painel do fundador, fica em portugues (nao-objectivo da especificacao)';
const MOTIVO_PUBLICA = 'pagina publica ou do viajante, ja bilingue pelo seu proprio lang (nao-objectivo da especificacao)';
const MOTIVO_AJUDA_PUBLICA = 'auxiliar das paginas publicas e do viajante, que ja sao bilingues pelo seu proprio lang (nao-objectivo da especificacao)';
export const EXCLUIDOS = {
  /* Painel do fundador */
  'pages/admin/': MOTIVO_FUNDADOR,
  'components/layout/AdminLayout.jsx': MOTIVO_FUNDADOR,
  /* Paginas publicas e do viajante */
  'pages/PublicBooking.jsx': MOTIVO_PUBLICA,
  'pages/ServiceDetail.jsx': MOTIVO_PUBLICA,
  'pages/BookingSuccess.jsx': MOTIVO_PUBLICA,
  'pages/BookingCancel.jsx': MOTIVO_PUBLICA,
  'pages/ReviewPage.jsx': MOTIVO_PUBLICA,
  'components/servico/': MOTIVO_PUBLICA,
  'components/restaurant/RestaurantReservationWidget.jsx': MOTIVO_PUBLICA,
  'components/shared/SiteComplianceFooter.jsx': MOTIVO_PUBLICA,
  'pages/traveler/': MOTIVO_PUBLICA,
  'components/traveler/': MOTIVO_PUBLICA,
  /* Auxiliares dessas paginas */
  'utils/paginaActividade.js': MOTIVO_AJUDA_PUBLICA,
  'utils/politicaCancelamento.js': MOTIVO_AJUDA_PUBLICA,
  'utils/opcoesActividade.js': MOTIVO_AJUDA_PUBLICA,
  'utils/pessoas.js': MOTIVO_AJUDA_PUBLICA,
  /* Fora do painel por regra */
  'components/ui/': 'componentes de base que nunca mudam (regra do dono); os textos chegam por props',
  'i18n/': 'ficheiros de traducao: o portugues e o conteudo deles',
  'main.jsx': 'ponto de entrada da aplicacao, sem texto mostrado',
};

const SRC = path.join(__dirname, '..');
const ler = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

export const excluido = (rel) => Object.keys(EXCLUIDOS).some((e) => (e.endsWith('/') ? rel.startsWith(e) : rel === e));

/* Todos os .js/.jsx de frontend/src, sem __tests__ nem ficheiros de teste (caminhos com /) */
function ficheirosDeCodigo(dir = '') {
  return fs.readdirSync(path.join(SRC, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) return e.name === '__tests__' ? [] : ficheirosDeCodigo(rel);
    return /\.jsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [rel] : [];
  });
}

/* Os ficheiros que a guarda examina: o painel do operador inteiro */
export const FICHEIROS_CONVERTIDOS = ficheirosDeCodigo().filter((rel) => !excluido(rel)).sort();

/* Textos escritos ao cliente: ficam em portugues em qualquer lingua do painel */
const MOTIVO_TEXTO_CLIENTE = 'mensagem enviada ao cliente, fica em portugues (nao-objectivo da especificacao)';
const MOTIVO_POST = 'texto de post que o operador publica nas redes sociais, fica em portugues (nao-objectivo da especificacao: conteudo do operador)';
const MOTIVO_EXEMPLO = 'dados de exemplo do preview da mensagem ao cliente, que e escrita em portugues';

/* Valores portugueses que ficam no codigo de proposito, por ficheiro, com o motivo. */
export const PERMITIDOS = {
  'pages/Loyalty.jsx': [
    { valor: '5% desconto em todas as reservas', motivo: 'descricao da recompensa por omissao do nivel, gravada na configuracao do programa de fidelidade e editada pelo operador (o nome do nivel e o valor gravado; o rotulo vem de loyaltyPage.levels)' },
    { valor: '10% desconto + upgrade gratuito disponível', motivo: 'descricao da recompensa por omissao do nivel, gravada na configuracao do programa de fidelidade e editada pelo operador (o nome do nivel e o valor gravado; o rotulo vem de loyaltyPage.levels)' },
    { valor: '15% desconto + tour gratuito por ano', motivo: 'descricao da recompensa por omissao do nivel, gravada na configuracao do programa de fidelidade e editada pelo operador (o nome do nivel e o valor gravado; o rotulo vem de loyaltyPage.levels)' },
  ],
  'components/dashboard/NextDaysStrip.jsx': [
    { valor: 'Sáb', motivo: 'abreviatura do sabado na tabela DIA_SEMANA, que ja tem uma linha por lingua (pt/en/de/nl)' },
  ],
  'pages/staff/shared.jsx': [
    { valor: 'Vendedor de Praia', motivo: 'cargo gravado em staff.role e comparado no codigo (CARGO_VENDEDOR); o rotulo vem de staff.roles' },
    { valor: 'Empregado de Limpeza', motivo: 'cargo gravado em staff.role (ROLES_BY_TYPE); o rotulo vem de staff.roles' },
    { valor: 'Praia de Santa Maria', motivo: 'zona gravada em staff.seller_zone (SELLER_ZONES); o rotulo vem de staff.zones' },
    { valor: 'Confirmar reservas do dia', motivo: 'tarefa por omissao da checklist, guardada como texto no localStorage; o rotulo vem de staff.defaultTasks' },
    { valor: 'Briefing com a equipa', motivo: 'tarefa por omissao da checklist, guardada como texto no localStorage; o rotulo vem de staff.defaultTasks' },
    { valor: 'Verificar segurança e primeiros socorros', motivo: 'tarefa por omissao da checklist, guardada como texto no localStorage; o rotulo vem de staff.defaultTasks' },
    { valor: 'Comunicar horário de início ao grupo', motivo: 'tarefa por omissao da checklist, guardada como texto no localStorage; o rotulo vem de staff.defaultTasks' },
  ],
  'pages/financial/shared.jsx': [
    { valor: 'Venda ao balcao', motivo: 'categoria gravada em cada receita manual (MANUAL_REVENUE_CATEGORIES); o rotulo vem de financial.revenueCategories' },
    { valor: 'Comissao de parceiro', motivo: 'categoria gravada em cada receita manual (MANUAL_REVENUE_CATEGORIES); o rotulo vem de financial.revenueCategories' },
    { valor: 'Aluguer de equipamento', motivo: 'categoria gravada em cada receita manual (MANUAL_REVENUE_CATEGORIES); o rotulo vem de financial.revenueCategories' },
  ],
  'components/units/forms/TourForm.jsx': [
    { valor: 'Equipamento incluído', motivo: 'comodidade fixa de actividade gravada em portugues nos metadados da unidade (ACTIVITY_AMENS); o rotulo vem de unitForm.amenity' },
    { valor: 'Fotografias/Vídeo', motivo: 'comodidade fixa de actividade gravada em portugues nos metadados da unidade (ACTIVITY_AMENS); o rotulo vem de unitForm.amenity' },
    { valor: 'Snacks e água', motivo: 'comodidade fixa de actividade gravada em portugues nos metadados da unidade (ACTIVITY_AMENS); o rotulo vem de unitForm.amenity' },
    { valor: 'Vestiário', motivo: 'comodidade fixa de actividade gravada em portugues nos metadados da unidade (ACTIVITY_AMENS); o rotulo vem de unitForm.amenity' },
  ],
  'components/units/forms/HotelRoomForm.jsx': [
    { valor: 'Sem vista', motivo: 'vista do quarto gravada em portugues em meta.view (ROOM_VIEWS); o rotulo vem de unitForm.roomView' },
  ],
  'components/units/forms/RestaurantTableForm.jsx': [
    { valor: 'Terraço', motivo: 'comodidade gravada em portugues nos metadados da unidade e mostrada nas paginas publicas (RESTAURANT_AMENS); o rotulo vem de unitForm.amenities' },
    { valor: 'Acesso cadeira de rodas', motivo: 'comodidade gravada em portugues nos metadados da unidade e mostrada nas paginas publicas (RESTAURANT_AMENS); o rotulo vem de unitForm.amenities' },
    { valor: 'Música ao vivo', motivo: 'comodidade gravada em portugues nos metadados da unidade e mostrada nas paginas publicas (RESTAURANT_AMENS); o rotulo vem de unitForm.amenities' },
    { valor: 'Ambiente para crianças', motivo: 'comodidade gravada em portugues nos metadados da unidade e mostrada nas paginas publicas (RESTAURANT_AMENS); o rotulo vem de unitForm.amenities' },
  ],
  'components/units/forms/editors.jsx': [
    { valor: 'Passeio de Barco', motivo: 'categoria de actividade gravada em units.unit_type (UNIT_TYPES_BY_OPERATOR); o rotulo vem de unitForm.unitType' },
  ],
  'pages/Automations.jsx': [
    { valor: 'Confirmação de reserva', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'A sua reserva foi confirmada — {nome_tour}', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Olá {nome_cliente},\\n\\nA sua reserva de {nome_tour} em {data} às {hora} foi confirmada.\\n\\nPonto de encontro: {ponto_encontro}\\nGuia: {guia}\\n\\nLembre-se de trazer protector solar e vestuário confortável.\\n\\nObrigado por escolher a nossa empresa!', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Olá {nome_cliente}! Confirmamos a sua reserva de *{nome_tour}* em {data} às {hora}. Ponto de encontro: {ponto_encontro}. Guia: {guia}. Qualquer questão, estamos disponíveis!', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'O seu tour é em 7 dias — {nome_tour}', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Olá {nome_cliente},\\n\\nO seu tour {nome_tour} é em 7 dias, em {data} às {hora}.\\n\\nPonto de encontro: {ponto_encontro}\\nGuia: {guia}\\n\\nO que trazer:\\n- Vestuário confortável\\n- Protector solar e oculos de sol\\n- Água e snack leve\\n- Documento de identidade\\n\\nAte breve!', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Instruções D-3', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Instruções finais para o seu tour — {nome_tour}', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Olá {nome_cliente},\\n\\nO seu tour {nome_tour} é em apenas 3 dias!\\n\\n- Data: {data} às {hora}\\n- Ponto de encontro: {ponto_encontro}\\n- Guia: {guia}\\n\\nEm caso de cancelamento por mau tempo, entraremos em contacto com 24h de antecedência.\\n\\nAte breve!', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Olá {nome_cliente}! Lembrete: o seu tour *{nome_tour}* é amanhã em {data} às {hora}. Ponto de encontro: {ponto_encontro}. Guia: {guia}. Até amanhã!', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Pedido de avaliação', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Olá {nome_cliente},\\n\\nEsperamos que tenha tido uma experiência incrível no tour {nome_tour}!\\n\\nA sua opinião é muito importante para nós. Clique no link abaixo para deixar a sua avaliação:\\n\\n→ Avaliar o meu tour\\n\\nObrigado pela sua confiança!', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Um presente especial para si — {nome_tour}', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Olá {nome_cliente},\\n\\nObrigado por ter escolhido o tour {nome_tour}!\\n\\nComo agradecimento, temos um desconto especial de 10% para a sua próxima reserva. Use o código: VOLTA10\\n\\nValido por 30 dias. Reserve em: saldesk.cv\\n\\nEsperamos ve-lo em breve!', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Novidades e novos tours para si', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Olá {nome_cliente},\\n\\nJá passou um mês desde o seu tour {nome_tour}! Temos novidades incríveis:\\n\\n- Novos tours disponíveis para esta epoca\\n- Pacotes especiais de fim de semana\\n- Experiências exclusivas em Cabo Verde\\n\\nVeja todas as novidades e reserve em: saldesk.cv\\n\\nAte breve!', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'João Silva', motivo: MOTIVO_EXEMPLO },
    { valor: 'Praia de Santa Maria, Sal', motivo: MOTIVO_EXEMPLO },
  ],
  'pages/Feedback.jsx': [
    { valor: 'Como correu? Deixe a sua avaliação', motivo: MOTIVO_TEXTO_CLIENTE },
    { valor: 'Olá {nome_cliente},\\n\\nObrigado por ter escolhido {nome_tour}. Esperamos que tenha corrido bem!\\n\\nA sua opinião ajuda-nos e ajuda outros viajantes a escolher. Demora menos de um minuto:\\n\\n{link_avaliacao}\\n\\nObrigado!', motivo: MOTIVO_TEXTO_CLIENTE },
  ],
  'components/automations/AutomationForm.jsx': [
    { valor: 'Olá {{nome}},\\n\\nA sua reserva em {{unidade}} está confirmada.\\n\\nCheck-in: {{check_in}}\\nCheck-out: {{check_out}}\\n\\nObrigado!', motivo: MOTIVO_TEXTO_CLIENTE },
  ],
  'pages/MenuDigital.jsx': [
    { valor: 'Sem nome', motivo: 'nome do prato por omissao, gravado em units.name e mostrado no menu publico do operador (conteudo publicado, fica em portugues)' },
    { valor: 'Menu Degustação', motivo: 'nome do menu de degustacao por omissao, gravado em units.name e mostrado no menu publico do operador (conteudo publicado, fica em portugues)' },
  ],
  'pages/settings/PerfilPublicoTab.jsx': [
    { valor: 'Obrigado pela sua mensagem. De momento estamos fora do horário de atendimento; responderemos assim que possível.', motivo: 'texto por omissao da resposta automatica do chat do site, que o cliente le em portugues (mensagem enviada ao cliente, nao-objectivo da especificacao)' },
    { valor: 'Thank you for your message. We are currently outside our opening hours and will reply as soon as we can.', motivo: 'texto por omissao da resposta automatica do chat do site, que o cliente le em ingles (mensagem enviada ao cliente, nao-objectivo da especificacao)' },
  ],
  'services/api.js': [
    { valor: 'Sem refresh token disponível', motivo: 'erro interno apanhado no mesmo ficheiro (refreshAccessToken), nunca mostrado ao operador' },
  ],
  'services/travelerApi.js': [
    { valor: 'Sem refresh token disponível', motivo: 'erro interno apanhado no mesmo ficheiro (refreshAccessToken), nunca mostrado; cliente da API da area do viajante, fora do painel do operador mas importado so por servicos do viajante' },
  ],
  'utils/userRoles.js': [
    { valor: 'Vendedor de Praia', motivo: 'cargo gravado em staff.role e comparado no codigo (CARGO_VENDEDOR); nao e texto mostrado' },
  ],
  'components/units/rotulosUnidades.js': [
    { valor: 'Equipamento incluído', motivo: 'chaves do mapa sao valores guardados: gravado em portugues nos metadados da unidade, o rotulo vem de unitForm' },
    { valor: 'Fotografias/Vídeo', motivo: 'chaves do mapa sao valores guardados: gravado em portugues nos metadados da unidade, o rotulo vem de unitForm' },
    { valor: 'Snacks e água', motivo: 'chaves do mapa sao valores guardados: gravado em portugues nos metadados da unidade, o rotulo vem de unitForm' },
    { valor: 'Vestiário', motivo: 'chaves do mapa sao valores guardados: gravado em portugues nos metadados da unidade, o rotulo vem de unitForm' },
    { valor: 'Passeio de Barco', motivo: 'chaves do mapa sao valores guardados: gravado em portugues nos metadados da unidade, o rotulo vem de unitForm' },
    { valor: 'Terraço', motivo: 'chaves do mapa sao valores guardados: gravado em portugues nos metadados da unidade, o rotulo vem de unitForm' },
    { valor: 'Acesso cadeira de rodas', motivo: 'chaves do mapa sao valores guardados: gravado em portugues nos metadados da unidade, o rotulo vem de unitForm' },
    { valor: 'Música ao vivo', motivo: 'chaves do mapa sao valores guardados: gravado em portugues nos metadados da unidade, o rotulo vem de unitForm' },
    { valor: 'Ambiente para crianças', motivo: 'chaves do mapa sao valores guardados: gravado em portugues nos metadados da unidade, o rotulo vem de unitForm' },
    { valor: 'Sem vista', motivo: 'chaves do mapa sao valores guardados: gravado em portugues nos metadados da unidade, o rotulo vem de unitForm' },
  ],
  'pages/marketing/PostModal.jsx': [
    { valor: 'Novo tour disponível! Reserve já o seu lugar e viva uma experiência única em Cabo Verde.', motivo: MOTIVO_POST },
    { valor: 'Últimas vagas para este tour! Não perca a oportunidade de explorar a ilha connosco.', motivo: MOTIVO_POST },
    { valor: 'Os nossos clientes falam por nós. Obrigado pela sua confiança e avaliações incríveis!', motivo: MOTIVO_POST },
    { valor: 'Promoção especial disponível! Reserve agora e aproveite as nossas tarifas exclusivas.', motivo: MOTIVO_POST },
    { valor: 'Mais um dia incrível em Cabo Verde. Venha conhecer a nossa ilha e as nossas experiências!', motivo: MOTIVO_POST },
  ],
};

const permitidos = (rel) => (PERMITIDOS[rel] || []).map((p) => p.valor);

describe('o detector de portugues fixo', () => {
  it('apanha texto portugues em JSX', () => {
    expect(textosPortugueses('<p>Guardar alterações</p>')).toEqual(['Guardar alterações']);
  });

  it('ignora chaves de i18n', () => {
    expect(textosPortugueses("t('nav.dashboard')")).toEqual([]);
    expect(textosPortugueses('<p>{t(`plan.features.${f}`)}</p>')).toEqual([]);
  });

  it('ignora classes CSS', () => {
    expect(textosPortugueses("className='bg-ocean-50'")).toEqual([]);
    expect(textosPortugueses('<a className="no-underline text-n-500 md:block">{x}</a>')).toEqual([]);
  });

  it('ignora nomes de marcas', () => {
    expect(textosPortugueses("'SalDesk'")).toEqual([]);
    expect(textosPortugueses("const m = ['Booking.com', 'GetYourGuide e Viator'];")).toEqual([]);
  });

  it('ignora um valor da lista de permitidos, mas so esse', () => {
    const codigo = "const d = ['Dom', 'Sáb']; const x = 'Sábado';";
    expect(textosPortugueses(codigo, ['Sáb'])).toEqual(['Sábado']);
  });

  it('apanha atributos, palavras soltas com maiuscula e templates', () => {
    const codigo = [
      '<button aria-label="Fechar" />',
      '<input placeholder="Pesquisar…" />',
      'const s = `${n} reservas de hoje`;',
      "toast('Sem resultados');",
    ].join('\n');
    expect(textosPortugueses(codigo)).toEqual(['Fechar', 'Pesquisar…', 'reservas de hoje', 'Sem resultados']);
  });

  it('nao conta comentarios, ids em minusculas nem texto ingles', () => {
    const codigo = [
      '/* Sem resultados: mostra o vazio */',
      "// Guardar alterações",
      "setTab('reservas'); navigate('/reservas');",
      "const s = 'No results'; const k = 'Do this';",
    ].join('\n');
    expect(textosPortugueses(codigo)).toEqual([]);
  });

  it('um ficheiro so com chaves t() nao tem nada a apontar', () => {
    const codigo = "export default function X() { const t = useT(); return <p title={t('a.b')}>{t('c.d', { n })}</p>; }";
    expect(textosPortugueses(codigo)).toEqual([]);
  });

  it('apanha portugues que comeca com uma palavra pequena em maiuscula ou com verbos comuns sem acento', () => {
    const codigo = [
      '<p>Por favor aguarde</p>',
      '<p>Em breve</p>',
      '<p>Para continuar, inicie</p>',
      "toast('Bloquear dia');",
      '<p>Total pago</p>',
      '<button>Remover</button>',
      '<span>Carregar</span>',
      "const e = { label: 'Ativo' };",
    ].join('\n');
    expect(textosPortugueses(codigo)).toEqual([
      'Por favor aguarde', 'Em breve', 'Para continuar, inicie', 'Bloquear dia', 'Total pago', 'Remover', 'Carregar', 'Ativo',
    ]);
  });

  it('as palavras com maiuscula nao apanham ingles comum', () => {
    const codigo = "const a = ['No results', 'Do this', 'Coming soon', 'Total paid', 'On hold', 'Remove', 'Load more'];";
    expect(textosPortugueses(codigo)).toEqual([]);
  });

  it('palavras pequenas portuguesas e acentos', () => {
    expect(temPortugues('Plano Pro a partir de')).toBe(true);
    expect(temPortugues('Ecrãs')).toBe(true);
    expect(temPortugues('Search screens')).toBe(false);
  });
});

/* Locale escrito directamente: so os mapas LOCALES (um por lingua) o podem ter. */
export const PT_PT_PERMITIDO = {
  'utils/formatoLingua.js': 'mapa LOCALES: o locale de cada lingua do painel',
  'pages/dashboard/agendaLogic.js': 'mapa LOCALES das datas: o locale de cada lingua do painel',
};

/* Examina o codigo de um ficheiro do painel: textos portugueses e locale pt-PT fixo. Recebe o caminho e o
   codigo (nao le o disco), para o teste poder provar a guarda com codigo inventado. Um ficheiro excluido
   nao tem nada a apontar. */
export function analisar(rel, codigoFonte) {
  if (excluido(rel)) return { portugues: [], ptPT: [] };
  /* sem comentarios: so conta codigo */
  const codigo = codigoFonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  /* so a linha do mapa LOCALES pode ter pt-PT */
  const ptPT = codigo.split(/\r?\n/).filter((l) => /pt-PT/.test(l) && !(PT_PT_PERMITIDO[rel] && /\bpt:\s*'pt-PT'/.test(l)));
  return { portugues: textosPortugueses(codigoFonte, permitidos(rel)), ptPT };
}

describe('painel sem portugues fixo', () => {
  FICHEIROS_CONVERTIDOS.forEach((rel) => {
    it(`${rel} nao fixa o locale pt-PT`, () => {
      expect(analisar(rel, ler(rel)).ptPT).toEqual([]);
    });
  });

  FICHEIROS_CONVERTIDOS.forEach((rel) => {
    it(rel, () => {
      expect(analisar(rel, ler(rel)).portugues).toEqual([]);
    });
  });

  it('o ingles segue o glossario: Booking, nunca Reservation', () => {
    const en = JSON.parse(ler('i18n/en.json'));
    const valores = (obj, p = '') => Object.entries(obj).flatMap(([k, v]) => (
      typeof v === 'string' ? [[`${p}${k}`, v]] : valores(v, `${p}${k}.`)
    ));
    expect(valores(en).filter(([, v]) => /reservation/i.test(v)).map(([k]) => k)).toEqual([]);
  });

  it('a guarda apanha portugues novo num ficheiro que nao esta excluido (em memoria, sem escrever no disco)', () => {
    const inventado = 'export default () => <button>Guardar alterações</button>;';
    expect(analisar('pages/Dashboard.jsx', inventado).portugues).toEqual(['Guardar alterações']);
    expect(analisar('pages/UmaPaginaNova.jsx', inventado).portugues).toEqual(['Guardar alterações']);
    expect(analisar('pages/admin/AdminHome.jsx', inventado).portugues).toEqual([]);
    expect(analisar('components/ui/Modal.jsx', inventado).portugues).toEqual([]);
  });

  it('a guarda apanha um pt-PT escrito directamente em qualquer ficheiro, menos na linha do mapa LOCALES', () => {
    const fixo = "const f = (d) => d.toLocaleDateString('pt-PT');";
    const mapa = "const LOCALES = {\n  pt: 'pt-PT',\n};";
    expect(analisar('pages/Dashboard.jsx', fixo).ptPT).toHaveLength(1);
    expect(analisar('utils/formatoLingua.js', fixo).ptPT).toHaveLength(1);
    expect(analisar('utils/formatoLingua.js', mapa).ptPT).toEqual([]);
    expect(analisar('pages/Dashboard.jsx', mapa).ptPT).toHaveLength(1);
    expect(analisar('pages/admin/AdminHome.jsx', fixo).ptPT).toEqual([]);
  });

  it('o painel inteiro e examinado: nenhum ficheiro de pages/ ou components/ fora de EXCLUIDOS fica de fora', () => {
    ['pages/Dashboard.jsx', 'pages/Settings.jsx', 'pages/Login.jsx', 'components/layout/Sidebar.jsx'].forEach((rel) => {
      expect(FICHEIROS_CONVERTIDOS).toContain(rel);
    });
    const emDisco = ficheirosDeCodigo().filter((rel) => /^(pages|components)\//.test(rel) && !excluido(rel));
    expect(emDisco.length).toBeGreaterThan(100);
    emDisco.forEach((rel) => expect(FICHEIROS_CONVERTIDOS).toContain(rel));
    expect(FICHEIROS_CONVERTIDOS.filter((rel) => /__tests__|\.test\./.test(rel))).toEqual([]);
  });

  it('cada excluido tem motivo e aponta para um caminho que existe', () => {
    Object.entries(EXCLUIDOS).forEach(([rel, motivo]) => {
      expect(String(motivo || '').length).toBeGreaterThan(10);
      expect(fs.existsSync(path.join(SRC, rel))).toBe(true);
      const stat = fs.statSync(path.join(SRC, rel));
      expect(rel.endsWith('/') ? stat.isDirectory() : stat.isFile()).toBe(true);
    });
  });

  it('os ficheiros examinados nao incluem o painel do fundador', () => {
    expect(FICHEIROS_CONVERTIDOS.filter((rel) => rel.startsWith('pages/admin/') || rel.endsWith('AdminLayout.jsx'))).toEqual([]);
  });

  it('os permitidos e os pt-PT permitidos estao em ficheiros examinados, continuam no codigo e tem motivo', () => {
    Object.keys(PT_PT_PERMITIDO).forEach((rel) => expect(FICHEIROS_CONVERTIDOS).toContain(rel));
    Object.entries(PERMITIDOS).forEach(([rel, lista]) => {
      expect(FICHEIROS_CONVERTIDOS).toContain(rel);
      lista.forEach(({ valor, motivo }) => {
        expect(ler(rel).includes(valor)).toBe(true);
        expect(String(motivo || '').length).toBeGreaterThan(10);
      });
    });
  });
});
