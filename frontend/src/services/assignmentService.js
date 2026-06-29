import api from './api';

export const listAssignments    = (p = {}) => api.get('/assignments', { params: p }).then(r => r.data.data);
export const createAssignment   = (d)      => api.post('/assignments', d).then(r => r.data.data);
export const createCompositeAssignment = (d) => api.post('/assignments/composta', d).then(r => r.data.data);
export const updateAssignmentNotes = (id, d) => api.put(`/assignments/${id}/notes`, d).then(r => r.data.data);
export const confirmAssignment  = (id, d)  => api.put(`/assignments/${id}/confirm`, d).then(r => r.data.data);
export const startAssignment    = (id, d)  => api.put(`/assignments/${id}/start`, d).then(r => r.data.data);
export const completeAssignment = (id, d)  => api.put(`/assignments/${id}/complete`, d).then(r => r.data.data);
export const cancelAssignment   = (id, d)  => api.put(`/assignments/${id}/cancel`, d).then(r => r.data.data);
export const getAvailableStaff  = (date)   => api.get('/assignments/available-staff', { params: { date } }).then(r => r.data.data);
