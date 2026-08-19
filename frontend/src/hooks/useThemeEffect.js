import { useEffect } from 'react';
import useUiStore from '../store/uiStore';

/* Aplica o tema (claro/escuro/automatico) alternando a classe "dark" em
   <html> -- e o que os componentes com variantes dark: do Tailwind
   (darkMode:'class' em tailwind.config.js) reagem. So chamado dentro do
   Portal do Viajante por agora (ver plano -- resto da app ainda nao tem
   modo escuro). Quando theme==='system', segue prefers-color-scheme do
   sistema operativo e reage a mudancas em tempo real (ex: o SO muda de
   claro para escuro a meio da sessao). */
export function useThemeEffect() {
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    function aplicar() {
      const resolvido = theme === 'system' ? (mediaQuery.matches ? 'dark' : 'light') : theme;
      root.classList.toggle('dark', resolvido === 'dark');
    }

    aplicar();

    if (theme === 'system') {
      mediaQuery.addEventListener('change', aplicar);
      return () => mediaQuery.removeEventListener('change', aplicar);
    }
  }, [theme]);
}
