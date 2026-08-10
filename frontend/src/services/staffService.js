import api from './api';

export const listStaff       = (p = {}) => api.get('/staff', { params: p }).then(r => r.data.data);
export const getStaff        = (id)     => api.get(`/staff/${id}`).then(r => r.data.data);
export const createStaff     = (d)      => api.post('/staff', d).then(r => r.data.data);
export const updateStaff     = (id, d)  => api.put(`/staff/${id}`, d).then(r => r.data.data);
export const deleteStaff     = (id)     => api.delete(`/staff/${id}`);
export const getStaffJobs    = (id)     => api.get(`/staff/${id}/jobs`).then(r => r.data.data);
export const getStaffEarnings= (id)     => api.get(`/staff/${id}/earnings`).then(r => r.data.data);
export const setAvailability = (id, d)  => api.put(`/staff/${id}/availability`, d).then(r => r.data.data);
export const createStaffAccount = (id)  => api.post(`/staff/${id}/create-account`).then(r => r.data.data);
export const getMyProfile    = ()       => api.get('/staff/me').then(r => r.data.data);
export const updateMyProfile = (d)      => api.put('/staff/me', d).then(r => r.data.data);

/* ── RH: ferias, documentos, certificacoes ── */
export const listLeave         = (id)          => api.get(`/staff/${id}/leave`).then(r => r.data.data);
export const createLeave       = (id, d)       => api.post(`/staff/${id}/leave`, d).then(r => r.data.data);
export const updateLeaveStatus = (id, leaveId, status) => api.put(`/staff/${id}/leave/${leaveId}`, { status }).then(r => r.data.data);
export const getLeaveBalance   = (id, year)    => api.get(`/staff/${id}/leave-balance`, { params: { year } }).then(r => r.data.data);
export const setLeaveBalance   = (id, d)       => api.put(`/staff/${id}/leave-balance`, d).then(r => r.data.data);

export const listDocuments   = (id)     => api.get(`/staff/${id}/documents`).then(r => r.data.data);
export const createDocument  = (id, d)  => api.post(`/staff/${id}/documents`, d).then(r => r.data.data);
export const deleteDocument  = (id, docId) => api.delete(`/staff/${id}/documents/${docId}`);

export const listCertifications  = (id)     => api.get(`/staff/${id}/certifications`).then(r => r.data.data);
export const createCertification = (id, d)  => api.post(`/staff/${id}/certifications`, d).then(r => r.data.data);
export const deleteCertification = (id, certId) => api.delete(`/staff/${id}/certifications/${certId}`);

export const getHrOverview = () => api.get('/staff/hr-overview').then(r => r.data.data);
