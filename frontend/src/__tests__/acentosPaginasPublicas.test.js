import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { FICHEIROS_PUBLICOS, PALAVRAS_BASE, criarDetector, semComentarios, textosVisiveis } from './helpers/detectorAcentos';

/* Textos que o turista le nas paginas publicas de reserva (pagina do operador, detalhe do servico,
   avaliacao, retorno do pagamento, widget do restaurante, rodape de conformidade e politica de
   cancelamento gerada) escritos com acentos ("Código", "horário", "Serviços", "está incluído"...).
   Procura so dentro do texto mostrado (strings e texto JSX), fora dos comentarios. As strings que
   sao uma unica palavra sem espacos (ids de seccao 'servicos', estados 'invalido', propriedades),
   os caminhos com ${...} e os caminhos de modulos ('../components/servico/...') ficam de fora: sao
   valores do codigo, nao texto para o turista. */
const SEM_ACENTO = criarDetector(PALAVRAS_BASE);

describe('paginas publicas de reserva com acentos', () => {
  FICHEIROS_PUBLICOS.forEach((rel) => {
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
