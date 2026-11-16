/* index.html: o Google Tag Manager/Ads so carrega fora de localhost (verificar em local nao pode enviar
   eventos para a conta real) e o gtag() continua a existir para o codigo da app (ex: conversao no registo). */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf-8');

/* o script inline que trata do Google: o que menciona googletagmanager e nao tem atributo src */
const bloco = html.match(/<script>((?:(?!<\/script>)[\s\S])*googletagmanager(?:(?!<\/script>)[\s\S])*)<\/script>/);

function executar(hostname) {
  const adicionados = [];
  const falsoDocumento = {
    head: { appendChild: (el) => adicionados.push(el) },
    createElement: () => ({}),
  };
  const falsaJanela = {};
  const corre = new Function('window', 'document', 'location', `${bloco[1]}\n;return window;`);
  const janela = corre(falsaJanela, falsoDocumento, { hostname });
  return { janela, adicionados };
}

describe('index.html: analytics', () => {
  it('nao ha nenhuma etiqueta <script src> estatica do Google Tag Manager', () => {
    expect(html).not.toMatch(/<script[^>]*src="https:\/\/www\.googletagmanager\.com/);
  });

  it('existe um script inline que decide quando carregar o Google', () => {
    expect(bloco).not.toBeNull();
  });

  it.each(['localhost', '127.0.0.1', '[::1]', 'app.localhost'])('em %s nao carrega o Google mas gtag() existe e nao rebenta', (host) => {
    const { janela, adicionados } = executar(host);
    expect(adicionados).toHaveLength(0);
    expect(typeof janela.gtag).toBe('function');
    expect(() => janela.gtag('event', 'sign_up')).not.toThrow();
  });

  it.each(['app.saldesk.cv', 'saldesk.cv'])('em %s carrega o Google uma vez e configura GA e Ads', (host) => {
    const { janela, adicionados } = executar(host);
    expect(adicionados).toHaveLength(1);
    expect(adicionados[0].src).toBe('https://www.googletagmanager.com/gtag/js?id=AW-18425133239');
    expect(adicionados[0].async).toBe(true);
    const configs = janela.dataLayer.filter((a) => a[0] === 'config').map((a) => a[1]);
    expect(configs).toEqual(['G-SMH9BH7V1E', 'AW-18425133239']);
  });
});
