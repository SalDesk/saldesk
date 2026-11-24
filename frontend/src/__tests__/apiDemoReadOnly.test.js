/* O aviso da conta de demonstracao (so leitura) segue a lingua do painel; em pt o texto e o de sempre. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import api from '../services/api';
import useUiStore from '../store/uiStore';
import useToastStore from '../store/toastStore';

/* o interceptor de respostas registado em services/api.js */
const respostaComErro = (err) => api.interceptors.response.handlers[0].rejected(err);
const erroDemo = () => ({ config: { url: '/units' }, response: { status: 403, data: { code: 'DEMO_READ_ONLY' } } });

beforeEach(() => { useToastStore.setState({ toasts: [] }); });
afterEach(() => {
  useUiStore.setState({ lang: 'pt' });
  useToastStore.setState({ toasts: [] });
});

describe('aviso da conta de demonstracao', () => {
  it('em pt mostra o texto de sempre', async () => {
    useUiStore.setState({ lang: 'pt' });
    await expect(respostaComErro(erroDemo())).rejects.toBeTruthy();
    const [aviso] = useToastStore.getState().toasts;
    expect(aviso.type).toBe('info');
    expect(aviso.message).toBe('Conta de demonstração — apenas leitura, esta alteração não foi guardada.');
  });

  it('em ingles mostra o aviso em ingles', async () => {
    useUiStore.setState({ lang: 'en' });
    await expect(respostaComErro(erroDemo())).rejects.toBeTruthy();
    expect(useToastStore.getState().toasts[0].message).toBe('Demo account — read-only, this change was not saved.');
  });
});
