import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  FICHEIROS_PUBLICOS, PALAVRAS_BASE, PALAVRAS_PAINEL, PALAVRAS_PAINEL_EXTRA,
  criarDetector, semComentarios, textosVisiveis,
} from './helpers/detectorAcentos';

/* Textos que o operador, o pessoal, o vendedor, o afiliado e o fundador leem no painel escritos com
   acentos ("Código inválido", "Período de avaliação", "Preço médio"...). Percorre todo o frontend/src
   menos as paginas publicas, a area do viajante, os componentes de servico (ja cobertos pelos outros
   testes), components/ui, os testes e os helpers. Procura so dentro do texto mostrado, fora dos
   comentarios; palavras soltas com maiuscula ('Titulo') e texto JSX contam, ids em minusculas nao.
   Tambem valida os valores portugueses de i18n/pt.json (as chaves e en/de/nl nao mudam). */
const SRC = path.join(__dirname, '..');
const SEM_ACENTO = criarDetector([...PALAVRAS_BASE, ...PALAVRAS_PAINEL, ...PALAVRAS_PAINEL_EXTRA]);
const OPCOES = { palavrasSoltas: true };

const EXCLUIDOS = new Set(FICHEIROS_PUBLICOS);
const PASTAS_EXCLUIDAS = ['pages/traveler/', 'components/traveler/', 'components/servico/', 'components/ui/', '__tests__/'];

/* Valores que o operador ve mas que tambem sao dados: gravados na base de dados ou comparados no codigo
   com o proprio texto (categorias de despesa e de receita, tipos de manutencao, tipos de unidade, cargos
   do pessoal, botoes do widget). Mudar-lhes o acento partia os registos que ja existem, por isso ficam
   como estao ate haver uma tabela de rotulos para mostrar. */
const VALORES_GUARDADOS = {
  'pages/financial/shared.jsx': ['Salarios', 'Comissoes vendedores', 'Seguro viatura', 'Manutencao', 'Combustivel', 'Subscricao SalDesk', 'Venda ao balcao', 'Comissao de parceiro', 'Patrocinio'],
  'pages/financial/DespesasTab.jsx': ['Salarios', 'Comissoes vendedores'],
  'pages/Maintenance.jsx': ['Revisao', 'Inspecao', 'Reparacao'],
  'components/units/forms/editors.jsx': ['Sessao', 'Terraco', 'Economico'],
  'pages/staff/shared.jsx': ['Mecanico', 'Administracao'],
  'pages/marketing/WidgetTab.jsx': ['Codigo'],
  'components/units/forms/RestaurantTableForm.jsx': ['Terraco'],
};

function listar(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listar(p) : [p];
  });
}

const ficheiros = listar(SRC)
  .map((p) => path.relative(SRC, p).split(path.sep).join('/'))
  .filter((rel) => /\.jsx?$/.test(rel))
  .filter((rel) => !EXCLUIDOS.has(rel) && !PASTAS_EXCLUIDAS.some((pasta) => rel.startsWith(pasta)))
  .sort();

function valoresDoJson(obj, prefixo = '') {
  return Object.entries(obj).flatMap(([k, v]) => (
    typeof v === 'string' ? [[`${prefixo}${k}`, v]] : (v && typeof v === 'object' ? valoresDoJson(v, `${prefixo}${k}.`) : [])
  ));
}

const achar = (codigo) => textosVisiveis(codigo, OPCOES).filter((t) => SEM_ACENTO.test(t));

describe('painel do operador com acentos', () => {
  ficheiros.forEach((rel) => {
    it(rel, () => {
      const codigo = semComentarios(fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r\n/g, '\n'));
      const guardados = new Set(VALORES_GUARDADOS[rel] || []);
      const errados = achar(codigo).filter((t) => !guardados.has(t.trim())).map((t) => t.trim().slice(0, 120));
      expect(errados).toEqual([]);
    });
  });

  it('i18n/pt.json tem os valores portugueses acentuados', () => {
    const pt = JSON.parse(fs.readFileSync(path.join(SRC, 'i18n/pt.json'), 'utf8'));
    const errados = valoresDoJson(pt).filter(([, v]) => SEM_ACENTO.test(v)).map(([k, v]) => `${k}: ${v.slice(0, 80)}`);
    expect(errados).toEqual([]);
  });

  it('os valores guardados continuam a existir no codigo (a lista nao fica com restos)', () => {
    Object.entries(VALORES_GUARDADOS).forEach(([rel, valores]) => {
      const codigo = fs.readFileSync(path.join(SRC, rel), 'utf8');
      valores.forEach((v) => expect(codigo.includes(`'${v}'`) || codigo.includes(`"${v}"`)).toBe(true));
    });
  });

  describe('o detector', () => {
    it('apanha palavras do painel sem acento', () => {
      const exemplo = [
        "const a = 'Periodo de avaliação expirado';",
        '<p>Ultimo dia do periodo</p>',
        "toast('Nao foi possivel carregar as configuracoes');",
        '<h2>Preco medio</h2>',
      ].join('\n');
      expect(achar(exemplo)).toEqual(['Periodo de avaliação expirado', 'Ultimo dia do periodo', 'Nao foi possivel carregar as configuracoes', 'Preco medio']);
    });

    it('apanha uma palavra solta com maiuscula e o texto JSX, mas nao ids em minusculas', () => {
      const exemplo = [
        '<Input label="Titulo" value={t} />',
        '<option value="Dificil">Dificil</option>',
        "setTab('periodo'); const estado = 'pendente'; <th>Descricao</th>",
      ].join('\n');
      expect(achar(exemplo)).toEqual(['Titulo', 'Dificil', 'Descricao']);
    });

    it('apanha o texto JSX que vem depois de uma expressao com chavetas', () => {
      const exemplo = '<p>{n} reserva(s) este mes · {total} avaliacoes</p>';
      expect(achar(exemplo)).toEqual([' reserva(s) este mes · ', ' avaliacoes']);
    });

    it('ignora chaves de i18n, mesmo montadas com ${...}', () => {
      const exemplo = [
        "t('settings.seguranca.errWeak'); t('dashboard.trial.periodo');",
        "setTab('configuracoes'); const k = 'notificacoes';",
        '<p>{t(`settings.notificacoes.items.${id}.label`)} {t(`settings.facturacao.status.${s}`)}</p>',
        "<p>{t('common.nao')}</p>",
      ].join('\n');
      expect(achar(exemplo)).toEqual([]);
    });

    it('ignora codigo que o texto JSX apanha depois de um ">" de comparacao', () => {
      const exemplo = [
        'if (opcoes.length > 0) tourMeta.options = opcoes; const suplementos = suplementosParaMeta(form.language_surcharges);',
        '<A x={n > 0) saida[l] = Math.round(v * 100) / 100;} />',
        'const r = a > 0 ? Math.min(...opcoes.map(o => o.preco)) : 0;',
        '}, [form.periodo]);',
      ].join('\n');
      expect(achar(exemplo)).toEqual([]);
    });

    it('ignora codigo e atributos que aparecem depois de uma chaveta', () => {
      const exemplo = [
        "<Kpi valor={a} variacao={b} serie={c} ocupacao={d} />",
        'const x = { anterior: { taxa: 0 }, variacao: 1 }; export function serieReceita(serie, inicio) {}',
        'if (x) { y(); } if(!avail?.disponivel) { z(); }',
      ].join('\n');
      expect(achar(exemplo)).toEqual([]);
    });

    it('ignora o valor de um atributo value e o nome de um ficheiro montado', () => {
      const exemplo = [
        '<option value="Dificil">Difícil</option>',
        'a.download = `saldesk-relatorio-${dados.inicio}-${dados.fim}.pdf`;',
      ].join('\n');
      expect(achar(exemplo)).toEqual([]);
    });

    it('nao confunde "image/*" nem um apostrofo no texto com o inicio de um comentario ou de uma string', () => {
      const exemplo = [
        '<input type="file" accept="image/*" onChange={f} />',
        "<p>O guia d'arvore</p>",
        '<Select label="Funcao" value={form.role} />',
        '/* Comentario com periodo e relatorio */ // outro comentario sem acentos: nao',
        "const url = 'https://saldesk.cv/x'; <b>Sessao</b>",
      ].join('\n');
      expect(achar(semComentarios(exemplo))).toEqual(['Funcao', 'Sessao']);
    });

    it('aceita texto acentuado', () => {
      const exemplo = "<p>Último dia do período</p> <b>Código inválido</b> {'Preço médio'} <th>Descrição</th>";
      expect(achar(exemplo)).toEqual([]);
    });
  });
});
