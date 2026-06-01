import api from './api';

export async function getAnalyticsStats() {
  try {
    const { data } = await api.get('/financial/stats');
    return data.data || null;
  } catch { return null; }
}

export async function getReviewsStats() {
  try {
    const { data } = await api.get('/reviews/stats');
    return data.data || null;
  } catch { return null; }
}

export async function getMarketingStats() {
  try {
    const { data } = await api.get('/marketing/stats');
    return data.data || null;
  } catch { return null; }
}
