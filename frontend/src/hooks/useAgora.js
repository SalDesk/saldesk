import { useEffect, useState } from 'react';

const MINUTO_MS = 60 * 1000;

/* Hora atual, atualizada a cada minuto (para a agenda saber o que esta a decorrer e o relogio do cabecalho) */
export default function useAgora() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), MINUTO_MS);
    return () => clearInterval(id);
  }, []);
  return agora;
}
