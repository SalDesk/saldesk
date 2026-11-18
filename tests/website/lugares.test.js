/* As paginas antigas de lugares/ redirecionam para a pagina do ponto turistico (ponto.html).
   Correr com: node --test "tests/website/*.test.js" */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', '..', 'website', 'discover', 'lugares');
const PAGINAS = fs.readdirSync(DIR).filter(f => f.endsWith('.html'));

test('existem_as_8_paginas_antigas', () => {
  assert.equal(PAGINAS.length, 8);
});

for (const f of PAGINAS) {
  const slug = f.replace(/\.html$/, '');
  test(`lugares_${slug}_redireciona_para_ponto`, () => {
    const html = fs.readFileSync(path.join(DIR, f), 'utf8');
    const destino = `../ponto.html?slug=${slug}`;
    assert.ok(html.includes(`<meta http-equiv="refresh" content="0; url=${destino}"`), 'meta refresh');
    assert.ok(html.includes(`<link rel="canonical" href="https://saldesk.cv/discover/ponto.html?slug=${slug}"`), 'canonical');
    assert.ok(html.includes(`location.replace('${destino}'`), 'redireccao por script');
    assert.ok(!html.includes('_lugares.js') && !html.includes('_booking-widget.js'), 'sem os scripts antigos');
  });
}
