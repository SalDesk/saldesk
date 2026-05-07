import { useState, useEffect } from 'react';
import { RefreshCw, Link2, Link2Off, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { getStatus, connectChannel, disconnectChannel, syncManual, getLogs } from '../services/integrationsService';
import { useT } from '../i18n';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import Table from '../components/ui/Table';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const CHANNEL_CONFIG = {
  viator: {
    name:        'Viator',
    description: 'Plataforma de experiencias da TripAdvisor',
    color:       'bg-[#FF6600]',
    fields: [
      { key: 'api_key',     label: 'API Key',      type: 'password', required: true },
      { key: 'supplier_id', label: 'Supplier ID',  type: 'text',     required: true },
    ],
  },
  getyourguide: {
    name:        'GetYourGuide',
    description: 'Plataforma global de actividades e tours',
    color:       'bg-[#FF5534]',
    fields: [
      { key: 'api_key',    label: 'API Key',     type: 'password', required: true },
      { key: 'product_ids', label: 'Product IDs (separados por virgula)', type: 'text', required: false },
    ],
  },
};

const STATUS_BADGE = {
  processed: 'confirmed',
  received:  'pending',
  failed:    'cancelled',
};

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });
}

function ChannelCard({ channel, onConnect, onDisconnect, onSync, syncing }) {
  const cfg = CHANNEL_CONFIG[channel.channel];
  const connected = channel.is_active && channel.configured !== false;

  return (
    <div className={`bg-white rounded-md border shadow-sm p-5 flex flex-col gap-4 ${connected ? 'border-n-200' : 'border-n-100 opacity-80'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-sm ${cfg?.color || 'bg-n-200'} flex items-center justify-center text-white font-display font-bold text-sm shrink-0`}>
            {cfg?.name?.[0] || '?'}
          </div>
          <div>
            <p className="font-display font-semibold text-n-900">{cfg?.name}</p>
            <p className="text-xs font-body text-n-500 mt-0.5">{cfg?.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {connected
            ? <CheckCircle size={16} strokeWidth={1.75} className="text-[var(--success)]" />
            : <XCircle    size={16} strokeWidth={1.75} className="text-n-300" />
          }
          <span className={`text-xs font-body font-semibold ${connected ? 'text-[var(--success)]' : 'text-n-400'}`}>
            {connected ? 'Ligado' : 'Desligado'}
          </span>
        </div>
      </div>

      {connected && (
        <div className="space-y-1 text-xs font-body">
          {channel.supplier_id && (
            <p className="text-n-600"><span className="text-n-400">Supplier ID:</span> {channel.supplier_id}</p>
          )}
          <p className="text-n-600 flex items-center gap-1">
            <Clock size={11} strokeWidth={1.75} className="text-n-400" />
            Ultimo sync: {formatDate(channel.last_sync_at)}
          </p>
          {channel.sync_error && (
            <p className="text-[var(--error)] flex items-center gap-1">
              <AlertTriangle size={11} strokeWidth={1.75} /> {channel.sync_error}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1 border-t border-n-100">
        {connected ? (
          <>
            <Button
              size="sm" variant="secondary" icon={RefreshCw}
              loading={syncing === channel.channel}
              onClick={() => onSync(channel.channel)}
              className="flex-1"
            >
              Sincronizar
            </Button>
            <Button
              size="sm" variant="ghost" icon={Link2Off}
              onClick={() => onDisconnect(channel.channel)}
              className="hover:text-error hover:bg-[var(--error-light)]"
            >
              Desligar
            </Button>
          </>
        ) : (
          <Button size="sm" icon={Link2} onClick={() => onConnect(channel.channel)} className="flex-1">
            Configurar
          </Button>
        )}
      </div>
    </div>
  );
}

const LOG_COLUMNS = [
  { key: 'created_at', label: 'Data',      render: (r) => <span className="font-mono text-xs text-n-600">{formatDate(r.created_at)}</span>, width: '140px' },
  { key: 'channel',    label: 'Canal',     render: (r) => <Badge variant="info">{r.channel}</Badge>,                                          width: '120px' },
  { key: 'event_type', label: 'Evento',    render: (r) => <span className="text-xs font-body text-n-700">{r.event_type}</span> },
  { key: 'status',     label: 'Estado',    render: (r) => <Badge variant={STATUS_BADGE[r.status] || 'default'}>{r.status}</Badge>,             width: '110px' },
  { key: 'external_ref', label: 'Ref. OTA', render: (r) => <span className="font-mono text-xs text-n-500">{r.external_ref || '—'}</span>,      width: '130px' },
  { key: 'error_message', label: 'Erro',   render: (r) => r.error_message ? <span className="text-xs text-[var(--error)] truncate max-w-[200px] block">{r.error_message}</span> : <span className="text-n-300">—</span> },
];

export default function Integrations() {
  const t = useT();
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
      setConnectError(err.response?.data?.error || t('errors.generic'));
    } finally {
      setConnectLoading(false);
    }
  }

  const cfg = connectModal ? CHANNEL_CONFIG[connectModal] : null;

  return (
    <div>
      <PageHeader
        title={t('nav.integrations')}
        subtitle="Channel Manager — Viator e GetYourGuide"
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={carregar} loading={loading}>
            Actualizar
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
          <div className="bg-ocean-50 border border-ocean-100 rounded-sm px-4 py-3">
            <p className="text-xs font-body text-ocean-700">
              <span className="font-semibold">URLs de webhook para configurar nas plataformas:</span>
            </p>
            <div className="mt-2 space-y-1">
              {['viator', 'getyourguide'].map((ch) => (
                <p key={ch} className="text-xs font-mono text-ocean-600">
                  {ch === 'viator' ? 'Viator' : 'GetYourGuide'}:{' '}
                  <span className="text-ocean-800">{window.location.origin.replace('5173', '3001')}/api/v1/integrations/webhooks/{ch}</span>
                </p>
              ))}
            </div>
          </div>

          {/* Logs */}
          <Card
            header={
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-sm text-n-700">Logs de integracao</h3>
                <span className="text-xs font-body text-n-400">{logsTotal} evento(s)</span>
              </div>
            }
            padding="p-0"
          >
            <Table columns={LOG_COLUMNS} rows={logs} loading={false} />
          </Card>
        </div>
      )}

      {/* Modal conectar canal */}
      <Modal
        open={!!connectModal}
        onClose={() => setConnectModal(null)}
        title={`Configurar ${cfg?.name || ''}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConnectModal(null)}>{t('common.cancel')}</Button>
            <Button form="connect-form" type="submit" loading={connectLoading} icon={Link2}>
              Ligar
            </Button>
          </>
        }
      >
        <form id="connect-form" onSubmit={handleConnectSubmit} className="space-y-4">
          <p className="text-xs font-body text-n-500">{cfg?.description}</p>
          {cfg?.fields.map((f) => (
            <Input
              key={f.key}
              label={f.label}
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
