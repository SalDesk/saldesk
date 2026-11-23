import {
  NAV_SECTIONS,
  PLAN_BADGE,
  getNavSections,
  isLocked,
  filterNavItems,
  sectionIdOfPath,
} from '../components/layout/navConfig';
import { getT } from '../i18n';

/* Conjuntos de rotas copiados do TYPE_NAV antigo (Sidebar.jsx) */
const OLD_ROUTES = {
  activity: [
    '/', '/unidades', '/reservas', '/calendario', '/guias', '/frota', '/clientes',
    '/colaboradores', '/rh', '/financeiro', '/analytics', '/meteorologia', '/previsao',
    '/avaliacoes', '/ocorrencias', '/feedback', '/mensagens', '/mensagens-saldesk',
    '/integracoes', '/marketing', '/automacoes', '/fidelidade', '/vouchers', '/afiliados',
    '/grupos', '/pacotes', '/parcerias', '/editor-pagina', '/definicoes',
  ],
  hotel: [
    '/', '/unidades', '/reservas', '/calendario', '/housekeeping', '/clientes',
    '/colaboradores', '/rh', '/financeiro', '/avaliacoes', '/mensagens', '/mensagens-saldesk',
    '/marketing', '/analytics', '/vouchers', '/afiliados', '/automacoes', '/fidelidade',
    '/grupos', '/pacotes', '/parcerias', '/editor-pagina', '/definicoes',
  ],
  rentacar: [
    '/', '/unidades', '/reservas', '/calendario', '/manutencao', '/clientes',
    '/colaboradores', '/rh', '/financeiro', '/analytics', '/avaliacoes', '/ocorrencias',
    '/mensagens', '/mensagens-saldesk', '/marketing', '/automacoes', '/fidelidade',
    '/vouchers', '/afiliados', '/grupos', '/pacotes', '/parcerias', '/editor-pagina',
    '/definicoes',
  ],
  restaurant: [
    '/', '/unidades', '/menu-digital', '/pedidos', '/reservas', '/calendario', '/clientes',
    '/colaboradores', '/rh', '/financeiro', '/avaliacoes', '/mensagens', '/mensagens-saldesk',
    '/marketing', '/analytics', '/automacoes', '/fidelidade', '/vouchers', '/parcerias',
    '/editor-pagina', '/definicoes',
  ],
};

const COUNTS = { activity: 29, hotel: 23, rentacar: 24, restaurant: 21 };

function flat(tipo) {
  return getNavSections(tipo).flatMap((s) => s.items);
}

function find(tipo, to) {
  return flat(tipo).find((i) => i.to === to);
}

describe('navConfig', () => {
  it('rotas por tipo iguais as listas antigas', () => {
    Object.keys(OLD_ROUTES).forEach((tipo) => {
      const novas = flat(tipo).map((i) => i.to);
      expect([...novas].sort()).toEqual([...OLD_ROUTES[tipo]].sort());
      expect(novas).toHaveLength(COUNTS[tipo]);
    });
  });

  it('tipo desconhecido usa hotel', () => {
    const hotel = flat('hotel').map((i) => i.to);
    expect(flat('xyz').map((i) => i.to)).toEqual(hotel);
    expect(flat(undefined).map((i) => i.to)).toEqual(hotel);
  });

  it('ordem e seccoes', () => {
    expect(getNavSections('activity').map((s) => s.id)).toEqual([
      'operacao', 'clientes', 'gestao', 'crescimento', 'configuracao',
    ]);
    expect(NAV_SECTIONS.filter((s) => s.defaultCollapsed).map((s) => s.id)).toEqual([
      'crescimento', 'configuracao',
    ]);

    const secaoDe = (to) => getNavSections('activity').find((s) => s.items.some((i) => i.to === to)).id;
    expect(secaoDe('/definicoes')).toBe('configuracao');
    expect(secaoDe('/financeiro')).toBe('gestao');
    expect(secaoDe('/automacoes')).toBe('crescimento');

    const todos = flat('activity').map((i) => i.to);
    expect(new Set(todos).size).toBe(todos.length);
  });

  it('rotulo por tipo', () => {
    expect(find('activity', '/unidades').label).toBe('Tours & Atividades');
    expect(find('hotel', '/unidades').label).toBe('Quartos');
    expect(find('rentacar', '/unidades').label).toBe('Frota');
    expect(find('restaurant', '/unidades').label).toBe('Mesas');
    expect(find('hotel', '/').label).toBe('Dashboard');
    expect(find('hotel', '/').end).toBe(true);
  });

  it('planos preservados', () => {
    expect(find('activity', '/automacoes')).toMatchObject({ requiredPlan: 'pro', feature: 'automacoes' });
    expect(find('activity', '/guias').requiredPlan).toBe('business');
    expect(find('activity', '/guias').feature).toBe('guias');
    expect(find('hotel', '/rh').feature).toBe('colaboradores');
  });

  it('PLAN_BADGE identico ao antigo', () => {
    expect(PLAN_BADGE).toEqual({
      business: { label: 'Business', cls: 'bg-ocean-600 text-white' },
      pro:      { label: 'Pro',      cls: 'bg-sand-500 text-white' },
    });
  });

  it('isLocked', () => {
    const automacoes = find('hotel', '/automacoes');
    const reservas = find('hotel', '/reservas');
    expect(isLocked(automacoes, () => false)).toBe(true);
    expect(isLocked(reservas, () => false)).toBe(false);
    flat('activity').forEach((i) => expect(isLocked(i, () => true)).toBe(false));
  });

  it('filterNavItems', () => {
    const itens = flat('activity');
    expect(filterNavItems(itens, 'calendario').map((i) => i.label)).toContain('Calendário');
    expect(filterNavItems(itens, 'FINANCEIRO').map((i) => i.label)).toContain('Financeiro');
    expect(filterNavItems(itens, 'gestao')).toEqual([]);
    expect(filterNavItems(itens, '')).toEqual(itens);
    expect(filterNavItems(itens, 'zzz')).toEqual([]);
  });

  it('sectionIdOfPath', () => {
    const secs = getNavSections('activity');
    expect(sectionIdOfPath(secs, '/automacoes')).toBe('crescimento');
    expect(sectionIdOfPath(secs, '/colaboradores/abc')).toBe('gestao');
    expect(sectionIdOfPath(secs, '/')).toBe('operacao');
    expect(sectionIdOfPath(secs, '/nao-existe')).toBeNull();
  });
});

describe('navConfig por lingua', () => {
  it('sem t usa os rotulos portugueses; com getT(en) usa o glossario ingles', () => {
    const en = getT('en');
    const enItens = getNavSections('activity', en).flatMap((s) => s.items);
    const rotulo = (itens, to) => itens.find((i) => i.to === to).label;

    expect(getNavSections('activity')[0].label).toBe('Operação');
    expect(getNavSections('activity', en).map((s) => s.label)).toEqual([
      'Operations', 'Customers', 'Management', 'Growth', 'Configuration',
    ]);
    expect(rotulo(enItens, '/reservas')).toBe('Bookings');
    expect(rotulo(enItens, '/clientes')).toBe('Customers');
    expect(rotulo(enItens, '/definicoes')).toBe('Settings');
    expect(rotulo(enItens, '/unidades')).toBe('Tours & Activities');
    expect(rotulo(getNavSections('hotel', en).flatMap((s) => s.items), '/unidades')).toBe('Rooms');
    expect(filterNavItems(enItens, 'book').map((i) => i.to)).toEqual(['/reservas']);
  });

  it('cada item e seccao tem a chave do rotulo, e todas existem em pt', () => {
    const pt = getT('pt');
    ['activity', 'hotel', 'rentacar', 'restaurant'].forEach((tipo) => {
      getNavSections(tipo).forEach((s) => {
        expect(pt(s.labelKey)).toBe(s.label);
        expect(s.label).not.toBe(s.labelKey);
        s.items.forEach((i) => {
          expect(pt(i.labelKey)).toBe(i.label);
          expect(i.label).not.toBe(i.labelKey);
        });
      });
    });
  });
});
