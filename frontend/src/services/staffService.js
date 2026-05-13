import api from './api';

export const listStaff       = (p = {}) => api.get('/staff', { params: p }).then(r => r.data.data);
export const getStaff        = (id)     => api.get(`/staff/${id}`).then(r => r.data.data);
export const createStaff     = (d)      => api.post('/staff', d).then(r => r.data.data);
export const updateStaff     = (id, d)  => api.put(`/staff/${id}`, d).then(r => r.data.data);
export const deleteStaff     = (id)     => api.delete(`/staff/${id}`);
export const getStaffJobs    = (id)     => api.get(`/staff/${id}/jobs`).then(r => r.data.data);
export const getStaffEarnings= (id)     => api.get(`/staff/${id}/earnings`).then(r => r.data.data);
export const setAvailability = (id, d)  => api.put(`/staff/${id}/availability`, d).then(r => r.data.data);
