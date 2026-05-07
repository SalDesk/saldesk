import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createOperator } from '../../services/authService';
import useAuthStore from '../../store/authStore';
import Step1OperatorType from './Step1OperatorType';
import Step2BusinessInfo from './Step2BusinessInfo';
import Step3Complete from './Step3Complete';

export default function OnboardingWizard() {
  const [passo, setPasso] = useState(1);
  const [dados, setDados] = useState({ operator_type: '', name: '', slug: '', phone: '', address: '' });
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const { token, setOperator } = useAuthStore();
  const navigate = useNavigate();

  function handleStep1(tipo) {
    setDados({ ...dados, operator_type: tipo });
    setPasso(2);
  }

  async function handleStep2(infos) {
    setErro('');
    setLoading(true);
    try {
      const payload = { ...dados, ...infos };
      const { data } = await createOperator(token, payload);
      setOperator(data);
      setPasso(3);
    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }

  const passos = [
    { num: 1, label: 'Tipo de negócio' },
    { num: 2, label: 'Informações' },
    { num: 3, label: 'Concluído' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary-500">SalDesk</h1>
          <p className="text-gray-500 mt-1">Configure o seu perfil de operador</p>
        </div>

        <div className="flex items-center justify-center mb-8 gap-2">
          {passos.map(({ num, label }) => (
            <div key={num} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 ${num < passo ? 'text-green-600' : num === passo ? 'text-primary-500' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                  num < passo ? 'bg-green-600 border-green-600 text-white' :
                  num === passo ? 'border-primary-500 text-primary-500' :
                  'border-gray-300 text-gray-400'
                }`}>
                  {num < passo ? '✓' : num}
                </div>
                <span className="text-sm font-medium hidden sm:block">{label}</span>
              </div>
              {num < passos.length && <div className={`w-8 h-0.5 ${num < passo ? 'bg-green-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <div className="card">
          {passo === 1 && <Step1OperatorType onNext={handleStep1} />}
          {passo === 2 && (
            <Step2BusinessInfo
              operatorType={dados.operator_type}
              onNext={handleStep2}
              onBack={() => setPasso(1)}
              loading={loading}
              erro={erro}
            />
          )}
          {passo === 3 && <Step3Complete onContinue={() => navigate('/')} />}
        </div>
      </div>
    </div>
  );
}
