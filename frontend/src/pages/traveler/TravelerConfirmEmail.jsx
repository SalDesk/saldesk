import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, MailCheck } from 'lucide-react';
import { confirmEmail } from '../../services/travelerAuthService';
import useTravelerAuthStore from '../../store/travelerAuthStore';
import TravelerAuthLayout from '../../components/traveler/TravelerAuthLayout';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

/* Destino do link do email de confirmacao (/viajante/confirmar-email?u=&t=). Publico: o link pode ser
   aberto noutro browser. Se houver uma sessao aberta neste browser, passa logo a ver as reservas. */
export default function TravelerConfirmEmail() {
  const [params] = useSearchParams();
  const [estado, setEstado] = useState('a_confirmar'); // a_confirmar | ok | erro
  const [erro, setErro] = useState('');
  const pedido = useRef(false);

  useEffect(() => {
    if (pedido.current) return;
    pedido.current = true;
    const u = params.get('u');
    const t = params.get('t');
    if (!u || !t) {
      setErro('Este link não está completo. Abra-o outra vez a partir do email.');
      setEstado('erro');
      return;
    }
    confirmEmail(u, t)
      .then(() => {
        const { traveler, setTraveler } = useTravelerAuthStore.getState();
        if (traveler) setTraveler({ ...traveler, email_verificado: true });
        setEstado('ok');
      })
      .catch((err) => {
        setErro(err?.response?.data?.error || 'Não foi possível confirmar o email. Tente abrir o link outra vez.');
        setEstado('erro');
      });
  }, [params]);

  return (
    <TravelerAuthLayout>
      <div className="bg-white rounded-3xl shadow-xl shadow-ocean-900/10 p-7 text-center space-y-4">
        {estado === 'a_confirmar' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <LoadingSpinner />
            <p className="text-sm font-body text-n-500">A confirmar o seu email...</p>
          </div>
        )}
        {estado === 'ok' && (
          <>
            <div className="w-12 h-12 bg-ocean-50 rounded-full flex items-center justify-center mx-auto">
              <MailCheck size={22} strokeWidth={1.75} className="text-ocean-700" />
            </div>
            <div>
              <p className="font-display font-bold text-base text-n-900">Email confirmado</p>
              <p className="text-sm font-body text-n-500 mt-1">
                Já pode ver as suas reservas, descarregar os recibos e deixar avaliações.
              </p>
            </div>
            <Link to="/viajante" className="inline-block text-sm font-body font-semibold text-ocean-700 hover:underline">
              Ver as minhas reservas
            </Link>
          </>
        )}
        {estado === 'erro' && (
          <>
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={22} strokeWidth={1.75} className="text-error" />
            </div>
            <div>
              <p className="font-display font-bold text-base text-n-900">Não foi possível confirmar</p>
              <p className="text-sm font-body text-n-500 mt-1">{erro}</p>
            </div>
            <Link to="/viajante/entrar" className="inline-block text-sm font-body font-semibold text-ocean-700 hover:underline">
              Entrar na conta
            </Link>
          </>
        )}
      </div>
    </TravelerAuthLayout>
  );
}
