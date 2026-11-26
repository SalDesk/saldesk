/* Tokens Mare: o modo escuro esta fora do ambito, por isso o bloco :root.dark nao redefine estas variaveis. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('tokens.css modo escuro', () => {
  it('nao redefine os tokens Mare em :root.dark', () => {
    const css = readFileSync('src/styles/tokens.css', 'utf-8');
    const bloco = css.slice(css.indexOf(':root.dark'));
    for (const v of ['--surface-app', '--card-border', '--field-border', '--table-head']) {
      expect(bloco).not.toContain(v + ':');
    }
  });
});
