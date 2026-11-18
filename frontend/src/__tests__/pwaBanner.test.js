/* Aviso "Instalar SalDesk" (script em linha do index.html): so nas paginas dos operadores,
   nunca sozinho nas paginas dos turistas (reserva, avaliacao, portal do viajante). */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((s) => s.includes('beforeinstallprompt'));

function aviso() { return document.getElementById('pwa-banner'); }
function pedirInstalacao() {
  const ev = new Event('beforeinstallprompt', { cancelable: true });
  ev.prompt = vi.fn();
  window.dispatchEvent(ev);
}

describe('aviso Instalar SalDesk', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    document.body.insertAdjacentHTML('beforeend', '<div id="pwa-banner" style="display:none"></div>');
    // eslint-disable-next-line no-new-func
    new Function(script)();
  });
  afterAll(() => vi.useRealTimers());
  beforeEach(() => {
    aviso().style.display = 'none';
    localStorage.clear();
  });

  it('aparece_na_app_dos_operadores', () => {
    window.history.pushState({}, '', '/reservas');
    pedirInstalacao();
    vi.advanceTimersByTime(2000);
    expect(aviso().style.display).toBe('flex');
  });

  it.each(['/book/loganislandtours', '/book/loganislandtours/servico/u1?widget=1', '/review/abc', '/viajante/reservas'])(
    'nao_aparece_sozinho_em_%s', (rota) => {
      window.history.pushState({}, '', rota);
      pedirInstalacao();
      vi.advanceTimersByTime(2000);
      expect(aviso().style.display).toBe('none');
    },
  );

  it('nao_aparece_se_entretanto_passou_para_pagina_de_turista', () => {
    window.history.pushState({}, '', '/');
    pedirInstalacao();
    window.history.pushState({}, '', '/book/demo');
    vi.advanceTimersByTime(2000);
    expect(aviso().style.display).toBe('none');
  });

  it('quem_fechou_o_aviso_nao_o_volta_a_ver', () => {
    window.history.pushState({}, '', '/reservas');
    localStorage.setItem('pwa-dismissed', '1');
    pedirInstalacao();
    vi.advanceTimersByTime(2000);
    expect(aviso().style.display).toBe('none');
  });
});
