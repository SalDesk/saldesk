export default function Step3Complete({ onContinue }) {
  return (
    <div className="text-center py-4">
      <div className="text-6xl mb-4">🎉</div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Tudo pronto!</h2>
      <p className="text-gray-500 mb-6">
        O seu perfil de operador foi criado com sucesso. Comece por adicionar as suas unidades.
      </p>
      <button onClick={onContinue} className="btn-primary px-8">
        Ir para o dashboard
      </button>
    </div>
  );
}
