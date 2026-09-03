import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './styles/global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    }
  }
});

/* Depois de um deploy, uma PWA ja instalada (fechar/reabrir nao chega --
   nao ha nenhum evento de navegacao que force o browser a verificar se o
   proprio ficheiro sw.js mudou) podia continuar presa ao JS antigo
   indefinidamente, mesmo com o servidor ja a servir o bundle novo --
   caso real: fundador e operadores a verem sempre a versao antiga do
   Login.jsx depois de um deploy, sem nenhuma forma de o corrigirem
   sozinhos a nao ser limpando a cache do browser a mao.
   updateViaCache:'none' impede o browser de reaproveitar uma copia em
   cache HTTP do proprio sw.js; registration.update() forca logo uma
   verificacao; e o reload automatico (uma unica vez, guardado por
   reloaded) quando um sw novo assume o controlo (skipWaiting+clients.claim
   ja fazem o sw novo assumir -- só faltava a pagina recarregar-se para
   usar o codigo novo em vez de ficar presa ao JS ja carregado em memoria). */
if ('serviceWorker' in navigator) {
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => reg.update().catch(() => {}))
      .catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>
);
