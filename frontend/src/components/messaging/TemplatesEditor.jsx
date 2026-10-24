import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, RotateCcw, Check } from 'lucide-react';
import {
  listMessageTemplates, saveMessageTemplate, previewMessageTemplate, getMessagingChannel,
} from '../../services/messagingService';
import { useToast } from '../../store/toastStore';
import Card from '../ui/Card';
import Button from '../ui/Button';
import LoadingSpinner from '../shared/LoadingSpinner';

/* Editor dos textos das mensagens de WhatsApp (confirmação, lembrete, pedido de avaliação).
   O operador escreve o texto com variáveis ({nome_cliente}, {data}...) e vê, ao lado,
   exactamente o que o cliente recebe: a pré-visualização vem do servidor, a mesma lógica
   que gera as mensagens reais. O servidor recusa variáveis que não existem. */

const GATILHOS = [
  {
    id: 'booking_confirmed',
    titulo: 'Confirmação da reserva',
    quando: 'Enviada para reservas confirmadas.',
  },
  {
    id: 'reminder_d1',
    titulo: 'Lembrete da véspera',
    quando: 'Enviada no dia anterior, para reservas confirmadas.',
  },
  {
    id: 'review_request',
    titulo: 'Pedido de avaliação',
    quando: 'Enviado depois do check-out. Tem de incluir {link_avaliacao}.',
  },
];

const IDIOMAS = [
  { id: 'pt', label: 'Português' },
  { id: 'en', label: 'English' },
];

const VARIAVEIS = [
  { nome: 'nome_cliente', ajuda: 'Nome do cliente' },
  { nome: 'nome_tour', ajuda: 'Tour ou actividade' },
  { nome: 'data', ajuda: 'Data da reserva' },
  { nome: 'hora', ajuda: 'Hora de início' },
  { nome: 'guia', ajuda: 'Guia atribuído (a linha some se não houver)' },
  { nome: 'ponto_encontro', ajuda: 'Ponto de encontro (a linha some se não houver)' },
  { nome: 'operador', ajuda: 'O nome da sua empresa' },
  { nome: 'link_avaliacao', ajuda: 'Link para o cliente avaliar' },
];

const MAX = 1000;

function TemplateCard({ gatilho, dados, onGuardado }) {
  const toast = useToast();
  const textareaRef = useRef(null);
  const pedidoRef = useRef(0);

  const [idioma, setIdioma] = useState('pt');
  const [rascunhos, setRascunhos] = useState(() => ({
    pt: dados.pt.body, en: dados.en.body,
  }));
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState('');
  const [previa, setPrevia] = useState({ text: '', unknown: [] });

  const servidor = dados[idioma];
  const texto = rascunhos[idioma];
  const alterado = texto !== servidor.body;
  const igualAoPadrao = texto === servidor.default_body;
  const desconhecidas = previa.unknown;

  // Pré-visualização com pequena espera, ignorando respostas antigas.
  useEffect(() => {
    const id = ++pedidoRef.current;
    const t = setTimeout(() => {
      previewMessageTemplate(texto, idioma)
        .then((r) => {
          if (id === pedidoRef.current) setPrevia({ text: r.text, unknown: r.unknown_variables || [] });
        })
        .catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [texto, idioma]);

  const editar = useCallback((valor) => {
    setErro('');
    setRascunhos((r) => ({ ...r, [idioma]: valor }));
  }, [idioma]);

  function inserirVariavel(nome) {
    const el = textareaRef.current;
    const marca = `{${nome}}`;
    if (!el) { editar(texto + marca); return; }
    const ini = el.selectionStart ?? texto.length;
    const fim = el.selectionEnd ?? texto.length;
    const novo = texto.slice(0, ini) + marca + texto.slice(fim);
    editar(novo);
    // devolve o foco e põe o cursor a seguir à variável
    requestAnimationFrame(() => {
      el.focus();
      const pos = ini + marca.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function guardar() {
    setAGuardar(true);
    setErro('');
    try {
      const r = await saveMessageTemplate(gatilho.id, idioma, texto);
      onGuardado(gatilho.id, idioma, { body: r.body, custom: r.custom });
      toast.success('Mensagem guardada');
    } catch (err) {
      setErro(err.response?.data?.error || 'Não foi possível guardar');
    } finally {
      setAGuardar(false);
    }
  }

  async function repor() {
    setAGuardar(true);
    setErro('');
    try {
      const r = await saveMessageTemplate(gatilho.id, idioma, '');
      onGuardado(gatilho.id, idioma, { body: r.body, custom: false });
      setRascunhos((x) => ({ ...x, [idioma]: r.body }));
      toast.success('Texto original reposto');
    } catch (err) {
      setErro(err.response?.data?.error || 'Não foi possível repor');
    } finally {
      setAGuardar(false);
    }
  }

  const estado = alterado
    ? { texto: 'Alterações por guardar', classe: 'bg-sand-100 text-sand-700' }
    : servidor.custom
      ? { texto: 'Personalizado', classe: 'bg-ocean-50 text-ocean-700' }
      : { texto: 'Texto original', classe: 'bg-n-100 text-n-600' };

  const vazio = texto.trim() === '';
  const semLink = gatilho.id === 'review_request' && !/\{\{?\s*link_avaliacao\s*\}?\}/i.test(texto);
  const bloqueado = vazio || desconhecidas.length > 0 || semLink || texto.length > MAX;

  return (
    <Card padding="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-display font-bold text-base text-n-900 dark:text-n-100">{gatilho.titulo}</h3>
          <p className="text-xs font-body text-n-500 mt-0.5">{gatilho.quando}</p>
        </div>
        <span className={`text-[11px] font-body font-semibold px-2 py-1 rounded-full ${estado.classe}`}>{estado.texto}</span>
      </div>

      <div className="flex gap-1 mb-3 bg-n-100 p-1 rounded-md w-fit">
        {IDIOMAS.map((i) => (
          <button
            key={i.id} type="button" onClick={() => { setIdioma(i.id); setErro(''); }}
            className={`px-3 py-1.5 rounded text-xs font-display font-medium transition-colors ${idioma === i.id ? 'bg-white text-ocean-700 shadow-sm' : 'text-n-500 hover:text-n-700'}`}
          >
            {i.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={(e) => editar(e.target.value)}
            rows={9}
            aria-label={`${gatilho.titulo} (${idioma.toUpperCase()})`}
            className="w-full px-3 py-2 rounded-sm border border-n-300 text-sm font-body bg-n-100 text-n-900 resize-y focus:outline-none focus:ring-2 focus:ring-ocean-300 focus:border-ocean-700 focus:bg-white"
          />
          <div className="flex items-center justify-between text-xs font-body text-n-500">
            <span>Clique numa variável para a inserir no cursor</span>
            <span className={texto.length > MAX ? 'text-error font-semibold' : ''}>{texto.length}/{MAX}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {VARIAVEIS.map((v) => (
              <button
                key={v.nome} type="button" title={v.ajuda} onClick={() => inserirVariavel(v.nome)}
                className="px-2 py-1 rounded-md bg-ocean-50 hover:bg-ocean-100 text-ocean-700 text-[11px] font-mono transition-colors"
              >
                {`{${v.nome}}`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-body font-semibold uppercase tracking-wide text-n-400 flex items-center gap-1.5">
            <MessageCircle size={12} strokeWidth={1.75} /> O que o cliente recebe (exemplo)
          </p>
          <div className="rounded-2xl rounded-tl-sm bg-turquoise-50 border border-turquoise-100 px-4 py-3 text-sm font-body text-n-900 whitespace-pre-wrap min-h-[8rem] break-words">
            {previa.text || <span className="text-n-400">A mensagem aparece aqui.</span>}
          </div>
        </div>
      </div>

      {desconhecidas.length > 0 && (
        <p className="text-xs font-body text-error mt-3">
          Variável desconhecida: {desconhecidas.join(', ')}. Use as variáveis da lista, senão o cliente recebe o texto por preencher.
        </p>
      )}
      {semLink && !vazio && (
        <p className="text-xs font-body text-error mt-3">O pedido de avaliação tem de incluir {'{link_avaliacao}'}, senão o cliente não tem como avaliar.</p>
      )}
      {erro && <p className="text-xs font-body text-error mt-3">{erro}</p>}

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <Button icon={Check} loading={aGuardar} disabled={!alterado || bloqueado} onClick={guardar}>
          Guardar
        </Button>
        {(servidor.custom || !igualAoPadrao) && (
          <Button variant="secondary" icon={RotateCcw} disabled={aGuardar} onClick={repor}>
            Repor texto original
          </Button>
        )}
      </div>
    </Card>
  );
}

const ESTADO_MODELO = {
  approved: { texto: 'Aprovado', classe: 'bg-turquoise-50 text-turquoise-700' },
  pending: { texto: 'Em análise na Meta', classe: 'bg-sand-100 text-sand-700' },
  rejected: { texto: 'Rejeitado', classe: 'bg-red-50 text-error' },
  paused: { texto: 'Em pausa', classe: 'bg-red-50 text-error' },
  disabled: { texto: 'Desactivado', classe: 'bg-red-50 text-error' },
};
const NOME_GATILHO = { booking_confirmed: 'Confirmação', reminder_d1: 'Lembrete', review_request: 'Pedido de avaliação' };

/* Que canal esta a enviar as mensagens (wa.me manual ou Cloud API automatica) e como estao os modelos da Meta. */
function CanalCartao() {
  const [canal, setCanal] = useState(null);
  useEffect(() => { getMessagingChannel().then(setCanal).catch(() => setCanal(null)); }, []);
  if (!canal) return null;
  const automatico = canal.canal === 'cloud_api';
  return (
    <Card padding="p-5">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h3 className="font-display font-bold text-base text-n-900 dark:text-n-100">Como as mensagens são enviadas</h3>
        <span className={`text-[11px] font-body font-semibold px-2 py-1 rounded-full ${automatico ? 'bg-turquoise-50 text-turquoise-700' : 'bg-n-100 text-n-600'}`}>
          {automatico ? 'Automático (WhatsApp Cloud API)' : 'Manual (WhatsApp no telemóvel)'}
        </span>
        {automatico && canal.quality_rating && (
          <span className="text-[11px] font-body text-n-500">Qualidade do número: <strong>{canal.quality_rating}</strong></span>
        )}
        {canal.cloud_status === 'suspended' && (
          <span className="text-[11px] font-body font-semibold px-2 py-1 rounded-full bg-red-50 text-error">Envio automático suspenso</span>
        )}
      </div>
      <p className="text-sm font-body text-n-600">
        {automatico
          ? 'Para clientes que aceitaram receber mensagens, o SalDesk envia sozinho. Fora das 24 horas a seguir à última mensagem do cliente, o WhatsApp só permite modelos pré-aprovados pela Meta: esses são fixos e não mudam com os textos abaixo. Os textos abaixo valem quando o cliente escreveu há menos de 24 horas e no envio manual.'
          : 'O SalDesk prepara o texto e o WhatsApp abre no telemóvel, pronto a enviar com um toque. Para o envio automático é preciso ligar a conta WhatsApp Business do operador (a Wandr faz esta ligação).'}
      </p>
      {canal.modelos.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {canal.modelos.map((m) => {
            const e = ESTADO_MODELO[m.meta_status] || ESTADO_MODELO.pending;
            return (
              <li key={`${m.trigger}:${m.locale}`} className="flex flex-wrap items-center gap-2 text-sm font-body text-n-700">
                <span>{NOME_GATILHO[m.trigger] || m.trigger} ({m.locale.toUpperCase()})</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${e.classe}`}>{e.texto}</span>
                {m.meta_reason && <span className="text-xs text-n-500">{m.meta_reason}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export default function TemplatesEditor() {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    listMessageTemplates()
      .then(setLista)
      .catch((err) => setErro(err.response?.data?.error || 'Não foi possível carregar as mensagens'));
  }, []);

  function aoGuardar(trigger, locale, novo) {
    setLista((atual) => atual.map((t) => (t.trigger === trigger && t.locale === locale ? { ...t, ...novo } : t)));
  }

  if (erro) return <p className="text-sm font-body text-error">{erro}</p>;
  if (!lista) return <div className="flex justify-center py-12"><LoadingSpinner size={24} /></div>;

  return (
    <div className="space-y-4 max-w-5xl">
      <CanalCartao />
      <div className="text-sm font-body text-n-600">
        <p>
          Estes são os textos que o SalDesk prepara quando carrega em <strong>WhatsApp</strong> numa reserva.
          O WhatsApp abre com a mensagem pronta e só falta enviar. O cliente recebe a versão do seu idioma
          (português ou inglês).
        </p>
        <p className="mt-1 text-n-500">
          Se não houver guia atribuído ou ponto de encontro, a frase correspondente desaparece sozinha.
        </p>
      </div>
      {GATILHOS.map((g) => {
        const pt = lista.find((t) => t.trigger === g.id && t.locale === 'pt');
        const en = lista.find((t) => t.trigger === g.id && t.locale === 'en');
        if (!pt || !en) return null;
        // key com o texto guardado: ao repor/guardar o cartao recomeça com o estado do servidor
        return <TemplateCard key={g.id} gatilho={g} dados={{ pt, en }} onGuardado={aoGuardar} />;
      })}
    </div>
  );
}
