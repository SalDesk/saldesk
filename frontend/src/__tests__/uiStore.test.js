import { beforeEach, describe, expect, it } from 'vitest';
import useUiStore from '../store/uiStore';

/* Estado inicial do store capturado uma vez, para repor entre testes */
const INITIAL = useUiStore.getState();

describe('uiStore - seccoes recolhidas da navegacao', () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.setState(INITIAL, true);
  });

  it('comeca vazio', () => {
    expect(useUiStore.getState().navCollapsed).toEqual({});
  });

  it('guarda a substituicao', () => {
    useUiStore.getState().setNavSectionCollapsed('crescimento', false);
    expect(useUiStore.getState().navCollapsed.crescimento).toBe(false);
  });

  it('persiste', () => {
    useUiStore.getState().setNavSectionCollapsed('crescimento', false);
    const stored = JSON.parse(localStorage.getItem('saldesk-ui'));
    expect(stored.state.navCollapsed.crescimento).toBe(false);
  });

  it('nao apaga outras chaves', () => {
    useUiStore.getState().setNavSectionCollapsed('crescimento', true);
    const stored = JSON.parse(localStorage.getItem('saldesk-ui'));
    expect(stored.state.lang).toBe('pt');
    expect(stored.state.navCollapsed.crescimento).toBe(true);
  });
});

describe('uiStore - vista do dashboard', () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.setState(INITIAL, true);
  });

  it('vista por omissao e hoje', () => {
    expect(useUiStore.getState().dashboardView).toBe('hoje');
  });

  it('guarda resumo', () => {
    useUiStore.getState().setDashboardView('resumo');
    expect(useUiStore.getState().dashboardView).toBe('resumo');
    const stored = JSON.parse(localStorage.getItem('saldesk-ui'));
    expect(stored.state.dashboardView).toBe('resumo');
  });

  it('ignora valor invalido', () => {
    useUiStore.getState().setDashboardView('resumo');
    useUiStore.getState().setDashboardView('outro');
    expect(useUiStore.getState().dashboardView).toBe('resumo');
  });

  it('valor persistido invalido volta a hoje', async () => {
    localStorage.setItem(
      'saldesk-ui',
      JSON.stringify({ state: { dashboardView: 'outro' }, version: 0 })
    );
    await useUiStore.persist.rehydrate();
    expect(useUiStore.getState().dashboardView).toBe('hoje');
  });

  it('valor persistido valido sobrevive e outras chaves ficam intactas', async () => {
    localStorage.setItem(
      'saldesk-ui',
      JSON.stringify({
        state: { dashboardView: 'resumo', lang: 'en', theme: 'dark', navCollapsed: { x: true } },
        version: 0,
      })
    );
    await useUiStore.persist.rehydrate();
    const s = useUiStore.getState();
    expect(s.dashboardView).toBe('resumo');
    expect(s.lang).toBe('en');
    expect(s.theme).toBe('dark');
    expect(s.navCollapsed).toEqual({ x: true });
  });
});
