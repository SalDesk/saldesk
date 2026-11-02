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
