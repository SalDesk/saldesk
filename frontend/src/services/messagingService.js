import api from './api';

/* Camada de mensagens (WhatsApp via wa.me): o backend devolve um link que a pessoa abre. */

// trigger: 'booking_confirmed' | 'reminder_d1' | 'review_request'
export const sendReservationMessage = (reservationId, trigger, opts = {}) =>
  api.post(`/messaging/reservations/${reservationId}/send`, { trigger, resend: opts.resend === true }).then((r) => r.data.data);

export const markMessageOpened = (id) => api.post(`/messaging/outbox/${id}/opened`).then((r) => r.data);

export const listOutbox = (params = {}) => api.get('/messaging/outbox', { params }).then((r) => r.data.data);

export const listMessageTemplates = () => api.get('/messaging/templates').then((r) => r.data.data);

export const saveMessageTemplate = (trigger, locale, body) =>
  api.put(`/messaging/templates/${trigger}/${locale}`, { body }).then((r) => r.data.data);

// Pre-visualizacao com dados de exemplo, gerada pelo servidor (a mesma logica das mensagens reais).
export const previewMessageTemplate = (body, locale) =>
  api.post('/messaging/templates/preview', { body, locale }).then((r) => r.data.data);
