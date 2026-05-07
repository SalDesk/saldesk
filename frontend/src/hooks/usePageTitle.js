import { useEffect } from 'react';

export function usePageTitle(titulo) {
  useEffect(() => {
    document.title = titulo ? `${titulo} — SalDesk` : 'SalDesk';
    return () => { document.title = 'SalDesk'; };
  }, [titulo]);
}
