import travelerApi from './travelerApi';

export async function getProfile() {
  const { data } = await travelerApi.get('/traveler/profile');
  return data.data;
}

export async function updateProfile(dados) {
  const { data } = await travelerApi.put('/traveler/profile', dados);
  return data.data;
}

export async function getBookings() {
  const { data } = await travelerApi.get('/traveler/bookings');
  return data.data;
}

export async function getWishlist() {
  const { data } = await travelerApi.get('/traveler/wishlist');
  return data.data;
}

export async function addToWishlist(unitId) {
  const { data } = await travelerApi.post('/traveler/wishlist', { unit_id: unitId });
  return data.data;
}

export async function removeFromWishlist(unitId) {
  await travelerApi.delete(`/traveler/wishlist/${unitId}`);
}

export async function submitReview(reservationId, rating, comment) {
  const { data } = await travelerApi.post(`/traveler/bookings/${reservationId}/review`, { rating, comment });
  return data.data;
}

export async function getRecommendations(limit = 6) {
  const { data } = await travelerApi.get(`/traveler/recommendations?limit=${limit}`);
  return { items: data.data, personalized: data.personalized };
}

export async function getNotifications() {
  const { data } = await travelerApi.get('/traveler/notifications');
  return { items: data.data, unreadCount: data.unread_count };
}

export async function markNotificationRead(id) {
  await travelerApi.put(`/traveler/notifications/${id}/read`);
}

export async function uploadAvatar(file, onProgress) {
  const formData = new FormData();
  formData.append('image', file);
  const { data } = await travelerApi.post('/upload/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) onProgress(Math.round((evt.loaded / evt.total) * 100));
    },
  });
  return data.data; // { url, thumbnail_url }
}
