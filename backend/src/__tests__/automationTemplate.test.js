const { renderTemplate } = require('../helpers/automationTemplate');

const dados = {
  customer_name: 'Ana', unit_name: 'Buggy Tour', check_in: '2026-10-20', check_out: '2026-10-20',
  start_time: '09:00:00', total_price: 45, operator_name: 'Logan Tours', guide_name: 'Joao',
};

describe('renderTemplate: modelos prontos do painel', () => {
  const email = 'Ola {nome_cliente},\n\nA sua reserva de {nome_tour} em {data} as {hora} foi confirmada.\n\nPonto de encontro: {ponto_encontro}\nGuia: {guia}\n\nLembre-se de trazer protector solar.\n\nObrigado!';

  test('preenche nome, tour, data, hora e guia', () => {
    const out = renderTemplate(email, dados);
    expect(out).toContain('Ola Ana,');
    expect(out).toContain('A sua reserva de Buggy Tour em 20/10/2026 as 09:00 foi confirmada.');
    expect(out).toContain('Guia: Joao');
    expect(out).not.toMatch(/[{}]/);
  });

  test('sem ponto de encontro a linha desaparece (nao fica "Ponto de encontro: " vazio)', () => {
    const out = renderTemplate(email, dados);
    expect(out).not.toContain('Ponto de encontro');
    expect(out).toContain('Lembre-se de trazer protector solar.');
    expect(out).not.toMatch(/\n{3,}/);
  });

  test('sem guia nem ponto de encontro a mensagem continua inteira e legivel', () => {
    const out = renderTemplate(email, { ...dados, guide_name: '' });
    expect(out).not.toMatch(/Guia|Ponto de encontro|[{}]/);
    expect(out).toContain('foi confirmada.');
    expect(out).toContain('Obrigado!');
  });

  test('sem hora tira tambem o "as"', () => {
    const out = renderTemplate('Reserva de {nome_tour} em {data} as {hora} confirmada.', { ...dados, start_time: null });
    expect(out).toBe('Reserva de Buggy Tour em 20/10/2026 confirmada.');
  });

  test('assunto tambem se preenche', () => {
    expect(renderTemplate('A sua reserva foi confirmada — {nome_tour}', dados)).toBe('A sua reserva foi confirmada — Buggy Tour');
  });

  test('versao curta de WhatsApp (tudo numa linha) nao perde a mensagem', () => {
    const wa = 'Ola {nome_cliente}! Confirmamos a sua reserva de *{nome_tour}* em {data} as {hora}. Ponto de encontro: {ponto_encontro}. Guia: {guia}. Qualquer questao, estamos disponiveis!';
    const out = renderTemplate(wa, { ...dados, guide_name: '' });
    expect(out).toBe('Ola Ana! Confirmamos a sua reserva de *Buggy Tour* em 20/10/2026 as 09:00. Qualquer questao, estamos disponiveis!');
    const comGuia = renderTemplate(wa, dados);
    expect(comGuia).toContain('Guia: Joao.');
    expect(comGuia).not.toContain('Ponto de encontro');
  });
});

describe('renderTemplate: formulario manual (legado)', () => {
  test('continua a funcionar como antes, com a data em AAAA-MM-DD', () => {
    const out = renderTemplate('Ola {{nome}}, {{unidade}}: {{check_in}} a {{check_out}}, {{total}} ({{operador}})', dados);
    expect(out).toBe('Ola Ana, Buggy Tour: 2026-10-20 a 2026-10-20, 45.00 € (Logan Tours)');
  });

  test('aceita espacos dentro das chavetas duplas', () => {
    expect(renderTemplate('{{ nome }}', dados)).toBe('Ana');
  });
});

describe('renderTemplate: seguranca', () => {
  test('variavel desconhecida fica como esta', () => {
    expect(renderTemplate('Ola {nome_cliente} {inventada}', dados)).toBe('Ola Ana {inventada}');
  });

  test('vazio ou nulo nao rebenta', () => {
    expect(renderTemplate('', dados)).toBe('');
    expect(renderTemplate(null, dados)).toBe('');
    expect(renderTemplate('{nome_cliente}', undefined)).toBe('');
  });
});
