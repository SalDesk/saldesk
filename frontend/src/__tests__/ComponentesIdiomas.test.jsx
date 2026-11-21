/* Componentes partilhados que aparecem dentro das Definicoes (forca da password, fotos,
   erros de upload e editor de mensagens) seguem a lingua escolhida pelo operador:
   textos traduzidos em en, de e nl e nunca uma chave de i18n por traduzir. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import PasswordStrength from '../components/auth/PasswordStrength';
import ImageUploader from '../components/shared/ImageUploader';
import TemplatesEditor from '../components/messaging/TemplatesEditor';
import { validateImageFile } from '../services/uploadService';
import useUiStore from '../store/uiStore';
import {
  listMessageTemplates, previewMessageTemplate, getMessagingChannel,
} from '../services/messagingService';

vi.mock('../services/messagingService', () => ({
  listMessageTemplates: vi.fn(), saveMessageTemplate: vi.fn(), previewMessageTemplate: vi.fn(), getMessagingChannel: vi.fn(),
}));

const tpl = (trigger, locale, body) => ({ trigger, locale, body, default_body: body, custom: false });
const LISTA = [
  tpl('booking_confirmed', 'pt', 'Olá {nome_cliente}'), tpl('booking_confirmed', 'en', 'Hello {nome_cliente}'),
  tpl('reminder_d1', 'pt', 'Lembrete {data}'), tpl('reminder_d1', 'en', 'Reminder {data}'),
  tpl('review_request', 'pt', 'Avalie {link_avaliacao}'), tpl('review_request', 'en', 'Rate {link_avaliacao}'),
];
const CANAL_AUTO = {
  canal: 'cloud_api', quality_rating: 'GREEN', cloud_status: 'suspended',
  modelos: [
    { trigger: 'booking_confirmed', locale: 'pt', meta_status: 'approved' },
    { trigger: 'reminder_d1', locale: 'en', meta_status: 'pending' },
  ],
};
const FOTOS = ['https://x.test/a.jpg', 'https://x.test/b.jpg'];

beforeEach(() => {
  listMessageTemplates.mockReset().mockResolvedValue(LISTA);
  getMessagingChannel.mockReset().mockResolvedValue(CANAL_AUTO);
  previewMessageTemplate.mockReset().mockImplementation(async (body) => ({ text: `PREVIA: ${body}`, unknown_variables: [] }));
});

afterEach(() => {
  cleanup();
  useUiStore.setState({ lang: 'pt' });
});

/* Nenhuma chave crua no texto visivel nem nos atributos lidos pelo utilizador ou por leitores de ecra */
function chavesCruas() {
  const textos = [document.body.textContent];
  document.body.querySelectorAll('*').forEach((el) => {
    ['aria-label', 'placeholder', 'title', 'alt'].forEach((a) => { if (el.hasAttribute(a)) textos.push(el.getAttribute(a)); });
  });
  return textos.filter((t) => /\b(passwordStrength|imageUploader|upload|messaging)\.[a-z]/.test(t));
}

async function montarTudo() {
  render(
    <div>
      <PasswordStrength password="Abcdefg1!" />
      <PasswordStrength password="a" />
      <ImageUploader value={FOTOS} onChange={() => {}} />
      <TemplatesEditor />
    </div>,
  );
  await screen.findAllByText(/^PREVIA:/);
}

describe('Componentes das Definições em inglês', () => {
  it('forca da password, fotos e editor de mensagens em inglês, sem chaves cruas', async () => {
    useUiStore.setState({ lang: 'en' });
    await montarTudo();

    /* PasswordStrength */
    expect(screen.getByText('Strong')).toBeInTheDocument();
    expect(screen.getByText('Weak')).toBeInTheDocument();
    expect(screen.getAllByText('At least 8 characters')).toHaveLength(2);
    expect(screen.queryByText('Mínimo 8 caracteres')).not.toBeInTheDocument();

    /* ImageUploader */
    expect(screen.getByText('Photos')).toBeInTheDocument();
    expect(screen.getByText('Main')).toBeInTheDocument();
    expect(screen.getAllByTitle('Move up')).toHaveLength(2);
    expect(screen.getAllByTitle('Move down')).toHaveLength(2);
    expect(screen.getAllByTitle('Remove photo')).toHaveLength(2);
    expect(screen.getByText(/Click or drag/)).toBeInTheDocument();
    expect(screen.getByText(/first photo = main cover/)).toBeInTheDocument();
    expect(screen.queryByTitle('Remover foto')).not.toBeInTheDocument();

    /* TemplatesEditor */
    expect(screen.getByText('How messages are sent')).toBeInTheDocument();
    expect(screen.getByText('Automatic (WhatsApp Cloud API)')).toBeInTheDocument();
    expect(screen.getByText('Automatic sending suspended')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Under review by Meta')).toBeInTheDocument();
    ['Booking confirmation', 'Day-before reminder', 'Review request'].forEach((x) =>
      expect(screen.getByText(x, { selector: 'h3' })).toBeInTheDocument());
    expect(screen.getByLabelText('Booking confirmation (PT)')).toHaveValue('Olá {nome_cliente}');
    expect(screen.getAllByRole('button', { name: 'Save' })).toHaveLength(3);
    expect(screen.getAllByText('Original text')).toHaveLength(3);
    expect(screen.getAllByTitle('Customer name')).toHaveLength(3);
    expect(screen.queryByText('Como as mensagens são enviadas')).not.toBeInTheDocument();

    expect(chavesCruas()).toEqual([]);
  });

  it('validateImageFile devolve o erro em inglês', () => {
    useUiStore.setState({ lang: 'en' });
    expect(validateImageFile({ name: 'a.gif', type: 'image/gif', size: 1 })).toBe('Invalid format: a.gif. Use JPG, PNG or WebP.');
    expect(validateImageFile({ name: 'b.jpg', type: 'image/jpeg', size: 6 * 1024 * 1024 })).toBe('File too large: b.jpg. Maximum 5MB.');
    expect(validateImageFile({ name: 'c.jpg', type: 'image/jpeg', size: 1 })).toBeNull();
  });
});

describe.each(['de', 'nl'])('Componentes das Definições em %s', (lang) => {
  it('sem chaves cruas e sem o texto português', async () => {
    useUiStore.setState({ lang });
    await montarTudo();
    expect(screen.queryByText('Forte')).not.toBeInTheDocument();
    expect(screen.queryByText('Principal')).not.toBeInTheDocument();
    expect(screen.queryByText('Como as mensagens são enviadas')).not.toBeInTheDocument();
    expect(chavesCruas()).toEqual([]);
    const erro = validateImageFile({ name: 'a.gif', type: 'image/gif', size: 1 });
    expect(erro).toContain('a.gif');
    expect(erro).not.toMatch(/Formato inválido|upload\./);
  });
});

describe('Componentes das Definições em português (por omissao)', () => {
  it('continuam em português', async () => {
    await montarTudo();
    expect(screen.getByText('Forte')).toBeInTheDocument();
    expect(screen.getAllByTitle('Mover para cima')).toHaveLength(2);
    expect(screen.getByText('Como as mensagens são enviadas')).toBeInTheDocument();
    expect(validateImageFile({ name: 'a.gif', type: 'image/gif', size: 1 })).toBe('Formato inválido: a.gif. Usa JPG, PNG ou WebP.');
  });
});
