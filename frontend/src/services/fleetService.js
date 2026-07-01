import api from './api';

export const listFleet     = (p = {}) => api.get('/fleet', { params: p }).then(r => r.data.data);
export const getAvailable  = (date)   => api.get('/fleet/available', { params: { date } }).then(r => r.data.data);
export const createFleet   = (d)      => api.post('/fleet', d).then(r => r.data.data);
export const updateFleet   = (id, d)  => api.put(`/fleet/${id}`, d).then(r => r.data.data);
export const deleteFleet   = (id)     => api.delete(`/fleet/${id}`);
export const assignFleet   = (id, d)  => api.post(`/fleet/${id}/assign`, d).then(r => r.data.data);
export const returnFleet        = (id, d)           => api.put(`/fleet/${id}/return`, d).then(r => r.data.data);
export const getFleetAvailability = (unitId, date)  => api.get('/fleet/availability', { params: { unit_id: unitId, date } }).then(r => r.data.data);
