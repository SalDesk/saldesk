import api from './api';

export const listMessages    = (p = {}) => api.get('/messages', { params: p }).then(r => r.data);
export const sendMessage     = (d)      => api.post('/messages', d).then(r => r.data.data);
export const markRead        = (id)     => api.put(`/messages/${id}/read`);
export const getUnreadCount  = ()       => api.get('/messages/unread-count').then(r => r.data.data.count);
export const listGroups      = ()       => api.get('/messages/groups').then(r => r.data.data);
export const createGroup     = (d)      => api.post('/messages/groups', d).then(r => r.data.data);
export const addGroupMember  = (id, d)  => api.post(`/messages/groups/${id}/members`, d).then(r => r.data.data);
