import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

/* Textos que o turista le na area do viajante escritos com acentos ("Não", "Avaliações", "Próxima"...).
   Procura so fora dos comentarios; os identificadores internos ('avaliacoes', 'notificacoes') ficam de fora
   porque estao em minusculas e nao fazem parte da lista. */
const PASTAS = ['pages/traveler', 'components/traveler'];
const SEM_ACENTO = /\b(nao|Nao|ja|Ja|Ola|Proxima|Proximas|Avaliacoes|Avaliacao|avaliacao|experiencias|experiencia|possivel|recuperacao|tambem|Seguranca|Definicoes|Notificacoes|Concluida|catalogo|disponivel|maiuscula|numero|Obrigatorio|aplicacao|instalacao|pagina|ecra|Automatico|Pais|sessao|valido)\b/;

function semComentarios(codigo) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .split('\n').map((l) => l.replace(/(^|[^:'"`])\/\/.*$/, '$1')).join('\n');
}

const ficheiros = PASTAS.flatMap((p) => {
  const dir = path.join(__dirname, '..', p);
  return fs.readdirSync(dir).filter((f) => f.endsWith('.jsx')).map((f) => path.join(dir, f));
});

describe('area do viajante com acentos', () => {
  ficheiros.forEach((f) => {
    it(path.basename(f), () => {
      const linhas = semComentarios(fs.readFileSync(f, 'utf8')).split('\n');
      const erradas = linhas.map((l) => l.trim()).filter((l) => SEM_ACENTO.test(l));
      expect(erradas).toEqual([]);
    });
  });
});
