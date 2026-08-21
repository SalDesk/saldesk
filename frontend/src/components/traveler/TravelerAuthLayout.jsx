import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LanguageToggle from '../shared/LanguageToggle';
import Logo from '../shared/Logo';

/* Layout de autenticacao do VIAJANTE -- deliberadamente distinto do
   AuthLayout dos operadores (fundo escuro, tom "painel de negocio a
   funcionar de noite"). Aqui o tom e o de uma app de viagens: fundo claro,
   foto grande em split-screen, formas arredondadas, sem o footer
   corporativo "WANDR — Travel Technology Company" (esse e para quem gere
   um negocio, nao para quem reserva umas ferias). Mesma paleta ocean/sand
   da marca, composicao diferente. */
const HERO_IMAGES = [
  '/images/hero-santa-maria.jpg',
  '/images/hero-blue-cave.jpg',
  '/images/hero-buracona.jpg',
];

export default function TravelerAuthLayout({ children }) {
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setImgIdx((i) => (i + 1) % HERO_IMAGES.length), 6000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-sand-50">
      {/* Painel de imagem -- topo em mobile, coluna esquerda em desktop */}
      <div className="relative h-48 sm:h-64 lg:h-auto lg:w-[44%] shrink-0 overflow-hidden">
        {HERO_IMAGES.map((src, i) => (
          <div
            key={src}
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
            style={{ backgroundImage: `url(${src})`, opacity: i === imgIdx ? 1 : 0 }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-ocean-900/60 via-ocean-900/5 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-ocean-900/10" />
        <div className="absolute inset-x-0 bottom-0 p-6 lg:p-10 lg:bottom-10">
          <p className="font-display font-extrabold text-white text-2xl lg:text-4xl leading-tight max-w-xs drop-shadow">
            A sua próxima aventura em Cabo Verde
          </p>
          <p className="hidden lg:block text-white/80 text-sm font-body mt-3 max-w-xs">
            Reservas directas com quem conhece a ilha — sem intermediários.
          </p>
        </div>
      </div>

      {/* Painel de conteudo */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 lg:px-10 lg:py-6">
          <Link to="/" className="lg:hidden"><Logo size="sm" dark /></Link>
          <span className="hidden lg:block" />
          <LanguageToggle authMode />
        </div>

        <div className="flex-1 flex items-center justify-center px-5 pb-10 lg:px-10">
          <div className="w-full max-w-sm">
            <div className="hidden lg:flex justify-start mb-8">
              <Logo size="lg" dark />
            </div>
            {children}
          </div>
        </div>

        <div className="px-5 pb-6 lg:px-10">
          <p className="text-center lg:text-left text-[11px] font-body text-n-400">
            © {new Date().getFullYear()} SalDesk — Cabo Verde
          </p>
        </div>
      </div>
    </div>
  );
}
