import { useState, useEffect } from 'react';
import { RefreshCw, Link2, Link2Off, Clock, AlertTriangle } from 'lucide-react';
import { getStatus, connectChannel, disconnectChannel, syncManual, getLogs } from '../services/integrationsService';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import Table from '../components/ui/Table';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { mensagemErro } from '../utils/mensagemErro';
import { localeDe, useLingua } from '../utils/formatoLingua';

const CHANNEL_CONFIG = {
  viator: {
    name:        'Viator',
    descriptionKey: 'integrationsPage.viatorDescription',
    color:       'bg-ocean-700',
    fields: [
      { key: 'api_key',     label: 'API Key',      type: 'password', required: true },
      { key: 'supplier_id', label: 'Supplier ID',  type: 'text',     required: true },
    ],
  },
  getyourguide: {
    name:        'GetYourGuide',
    descriptionKey: 'integrationsPage.getyourguideDescription',
    color:       'bg-sand-600',
    fields: [
      { key: 'api_key',    label: 'API Key',     type: 'password', required: true },
      { key: 'product_ids', labelKey: 'integrationsPage.productIds', type: 'text', required: false },
    ],
  },
};

/* Estilo Mare: cartao de pagina, titulo de cartao e figuras (datas, contagens, codigos) */
const CARTAO = 'bg-white rounded-[18px] border border-mare-card p-[22px] min-w-0';
const TITULO = 'font-display text-lg font-semibold text-ocean-900';
const NUM = 'font-mono tabular-nums';

const STATUS_BADGE = {
  processed: 'confirmed',
  received:  'pending',
  failed:    'cancelled',
};

/* Base da API (a mesma que o cliente HTTP usa): os webhooks das plataformas chegam ao backend, nao a esta app. */
function apiBaseUrl() {
  return (import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1').replace(/\/+$/, '');
}

function formatDate(d, lang) {
  if (!d) return '—';
  return new Date(d).toLocaleString(localeDe(lang), { dateStyle: 'short', timeStyle: 'short' });
}

function ChannelCard({ channel, onConnect, onDisconnect, onSync, syncing }) {
  const t = useT();
  const lang = useLingua();
  const cfg = CHANNEL_CONFIG[channel.channel];
  const connected = channel.is_active && channel.configured !== false;
  /* a data entra na frase traduzida: parte-se a frase num marcador para dar a data a fonte mono */
  const [antesData, depoisData] = t('integrationsPage.lastSync', { date: '\u0000' }).split('\u0000');

  return (
    <article className={`${CARTAO} flex flex-col gap-4 ${connected ? '' : 'opacity-80'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-[12px] ${cfg?.color || 'bg-n-200'} flex items-center justify-center text-white font-display font-bold text-sm shrink-0`}>
            {cfg?.name?.[0] || '?'}
          </div>
          <div className="min-w-0">
            <h2 className={`${TITULO} break-words`}>{cfg?.name}</h2>
            <p className="text-xs font-body text-n-600 mt-0.5">{cfg ? t(cfg.descriptionKey) : undefined}</p>
          </div>
        </div>
        <div className="shrink-0">
          <Badge variant={connected ? 'confirmed' : 'default'}>
            {connected ? t('integrationsPage.connected') : t('integrationsPage.disconnected')}
          </Badge>
        </div>
      </div>

      {connected && (
        <div className="space-y-1 text-xs font-body">
          {channel.supplier_id && (
            <p className="text-n-700 break-all"><span className="text-n-600">Supplier ID:</span> <span className={NUM}>{channel.supplier_id}</span></p>
          )}
          <p className="text-n-700 flex items-center gap-1 flex-wrap">
            <Clock size={11} strokeWidth={1.75} className="text-n-500" />
            <span>{antesData}<span className={NUM}>{formatDate(channel.last_sync_at, lang)}</span>{depoisData}</span>
          </p>
          {channel.sync_error && (
            <p className="text-[var(--error)] flex items-center gap-1 break-words">
              <AlertTriangle size={11} strokeWidth={1.75} /> {channel.sync_error}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-3 border-t border-mare-card">
        {connected ? (
          <>
            <Button
              size="sm" variant="secondary" icon={RefreshCw}
              loading={syncing === channel.channel}
              onClick={() => onSync(channel.channel)}
              className="flex-1 min-h-11 md:min-h-0"
            >
              {t('integrationsPage.sync')}
            </Button>
            <Button
              size="sm" variant="ghost" icon={Link2Off}
              onClick={() => onDisconnect(channel.channel)}
              className="min-h-11 md:min-h-0"
            >
              {t('integrationsPage.disconnect')}
            </Button>
          </>
        ) : (
          <Button size="sm" icon={Link2} onClick={() => onConnect(channel.channel)} className="flex-1 min-h-11 md:min-h-0">
            {t('integrationsPage.configure')}
          </Button>
        )}
      </div>
    </article>
  );
}

/* colunas dos logs; precisam do t e da lingua do painel */
const colunasLogs = (t, lang) => [
  { key: 'created_at', label: t('integrationsPage.cols.date'),      render: (r) => <span className={`${NUM} text-xs text-n-600`}>{formatDate(r.created_at, lang)}</span>, width: '140px' },
  { key: 'channel',    label: t('integrationsPage.cols.channel'),     render: (r) => <Badge variant="info">{r.channel}</Badge>,                                          width: '120px' },
  { key: 'event_type', label: t('integrationsPage.cols.event'),    render: (r) => <span className="text-xs font-body text-n-700">{r.event_type}</span> },
  { key: 'status',     label: t('integrationsPage.cols.status'),    render: (r) => <Badge variant={STATUS_BADGE[r.status] || 'default'}>{r.status}</Badge>,             width: '110px' },
  { key: 'external_ref', label: t('integrationsPage.cols.ref'), render: (r) => <span className={`${NUM} text-xs text-n-600 break-all`}>{r.external_ref || '—'}</span>,      width: '130px' },
  { key: 'error_message', label: t('integrationsPage.cols.error'),   render: (r) => r.error_message ? <span className="text-xs text-[var(--error)] truncate max-w-[200px] block">{r.error_message}</span> : <span className="text-n-500">—</span> },
];

export default function Integrations() {
  const t = useT();
  const lang = useLingua();
  const [channels, setChannels] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(null);
  const [connectModal, setConnectModal] = useState(null);
  const [connectForm, setConnectForm] = useState({});
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState('');

  async function carregar() {
    setLoading(true);
    try {
      const [status, logsData] = await Promise.all([
        getStatus(),
        getLogs({ limit: 20 }),
      ]);
      setChannels(status);
      setLogs(logsData.data || []);
      setLogsTotal(logsData.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function handleSync(channel) {
    setSyncing(channel);
    try {
      await syncManual(channel);
      setTimeout(carregar, 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(null);
    }
  }

  async function handleDisconnect(channel) {
    try {
      await disconnectChannel(channel);
      carregar();
    } catch (err) {
      console.error(err);
    }
  }

  function handleConnect(channel) {
    setConnectError('');
    setConnectForm({});
    setConnectModal(channel);
  }

  async function handleConnectSubmit(e) {
    e.preventDefault();
    setConnectError('');
    setConnectLoading(true);
    try {
      const dados = { ...connectForm };
      if (dados.product_ids) {
        dados.product_ids = dados.product_ids.split(',').map((s) => s.trim()).filter(Boolean);
      }
      await connectChannel(connectModal, dados);
      setConnectModal(null);
      carregar();
    } catch (err) {
      setConnectError(mensagemErro(err, t, t('errors.generic')));
    } finally {
      setConnectLoading(false);
    }
  }

  const cfg = connectModal ? CHANNEL_CONFIG[connectModal] : null;

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.sections.crescimento')}
        title={t('nav.integrations')}
        subtitle={t('integrationsPage.subtitle')}
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={carregar} loading={loading}>
            {t('integrationsPage.refresh')}
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size={32} /></div>
      ) : (
        <div className="space-y-6">
          {/* Cards dos canais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {channels.map((ch) => (
              <ChannelCard
                key={ch.channel}
                channel={ch}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onSync={handleSync}
                syncing={syncing}
              />
            ))}
          </div>

          {/* Info sobre webhooks */}
          <div className="bg-mare-head rounded-[14px] px-4 py-3">
            <p className="text-xs font-body text-ocean-700">
              <span className="font-semibold">{t('integrationsPage.webhookUrls')}</span>
            </p>
            <div className="mt-2 space-y-1">
              {['viator', 'getyourguide'].map((ch) => (
                <p key={ch} className="text-xs font-mono text-ocean-700">
                  {ch === 'viator' ? 'Viator' : 'GetYourGuide'}:{' '}
                  <span className="text-ocean-800 break-all">{`${apiBaseUrl()}/integrations/webhooks/${ch}`}</span>
                </p>
              ))}
            </div>
          </div>

          {/* Logs */}
          <section className={CARTAO}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className={TITULO}>{t('integrationsPage.logsTitle')}</h2>
              <span className={`${NUM} text-xs text-n-600`}>{t('integrationsPage.events', { n: logsTotal })}</span>
            </div>
            <Table columns={colunasLogs(t, lang)} rows={logs} loading={false} />
          </section>
        </div>
      )}

      {/* Modal conectar canal */}
      <Modal
        open={!!connectModal}
        onClose={() => setConnectModal(null)}
        title={t('integrationsPage.configureTitle', { name: cfg?.name || '' })}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConnectModal(null)}>{t('common.cancel')}</Button>
            <Button form="connect-form" type="submit" loading={connectLoading} icon={Link2}>
              {t('integrationsPage.connect')}
            </Button>
          </>
        }
      >
        <form id="connect-form" onSubmit={handleConnectSubmit} className="space-y-4">
          <p className="text-xs font-body text-n-500">{cfg ? t(cfg.descriptionKey) : undefined}</p>
          {cfg?.fields.map((f) => (
            <Input
              key={f.key}
              label={f.labelKey ? t(f.labelKey) : f.label}
              aria-label={f.labelKey ? t(f.labelKey) : f.label}
              type={f.type}
              value={connectForm[f.key] || ''}
              onChange={(e) => setConnectForm({ ...connectForm, [f.key]: e.target.value })}
              required={f.required}
            />
          ))}
          {connectError && (
            <p className="text-sm font-body px-3 py-2 rounded-sm bg-[var(--error-light)] text-[var(--error)]">
              {connectError}
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
}
