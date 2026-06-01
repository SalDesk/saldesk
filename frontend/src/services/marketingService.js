import api from './api';

export const getBookingLink  = ()     => api.get('/marketing/booking-link').then(r => r.data.data);
export const getMarketingStats = ()   => api.get('/marketing/stats').then(r => r.data.data);
export const getWidgetCode   = ()     => api.get('/marketing/widget-code').then(r => r.data.data);
export const getQrCode       = ()     => api.get('/marketing/qrcode', { responseType: 'blob' }).then(r => r.data);
