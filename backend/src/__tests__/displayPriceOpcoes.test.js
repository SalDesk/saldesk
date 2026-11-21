jest.mock('../config/supabase', () => ({ supabaseAdmin: {}, supabaseAnon: {}, supabase: {} }));
const { displayPrice } = require('../controllers/catalogImageController');

const desc = (meta) => JSON.stringify(meta);

describe('displayPrice com opcoes', () => {
  test('usa a opcao valida mais barata antes do base_price', () => {
    const unit = { base_price: 99, description: desc({ options: [
      { type: 'per_group', price: 120 }, { type: 'per_person', price: 40 },
    ] }) };
    expect(displayPrice(unit)).toBe(40);
  });

  test('ignora opcoes invalidas e mantem o comportamento antigo', () => {
    const unit = { base_price: 35, description: desc({ options: [{ type: 'per_vehicle', price: 5, seats: 0 }] }) };
    expect(displayPrice(unit)).toBe(35);
    expect(displayPrice({ base_price: 0, description: desc({ price_private: 95 }) })).toBe(95);
    expect(displayPrice({ base_price: 0, description: 'texto' })).toBeNull();
  });
});
