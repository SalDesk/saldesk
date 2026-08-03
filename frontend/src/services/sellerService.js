import api from './api';

/* ── localStorage (fallback when backend not available) ── */
const COMM_KEY        = 'saldesk_seller_commissions_v1';
const SELLER_META_KEY = id => `saldesk_seller_meta_${id}`;

function loadLocal()     { try { return JSON.parse(localStorage.getItem(COMM_KEY) || '[]'); } catch { return []; } }
function saveLocal(list) { localStorage.setItem(COMM_KEY, JSON.stringify(list)); }

/* ── Commission CRUD ── */

export async function listSellerCommissions(sellerId) {
  try {
    const { data } = await api.get(`/seller-commissions?seller_id=${sellerId}`);
    return data.data || [];
  } catch {
    return loadLocal().filter(c => c.seller_id === sellerId);
  }
}

export async function markCommissionPaid(commissionId, notes = '') {
  try {
    const { data } = await api.put(`/seller-commissions/${commissionId}`, {
      status: 'paid', paid_at: new Date().toISOString(), notes,
    });
    return data.data;
  } catch {
    const updated = loadLocal().map(c =>
      c.id === commissionId
        ? { ...c, status: 'paid', paid_at: new Date().toISOString(), notes }
        : c,
    );
    saveLocal(updated);
    return updated.find(c => c.id === commissionId);
  }
}

/* ── Seller metadata (commission %, zone, tour_ids) ── */

export function getSellerMeta(sellerId) {
  try { return JSON.parse(localStorage.getItem(SELLER_META_KEY(sellerId)) || '{}'); }
  catch { return {}; }
}

export function saveSellerMeta(sellerId, meta) {
  localStorage.setItem(SELLER_META_KEY(sellerId), JSON.stringify(meta));
}

export function getSellerCommissionPct(sellerId, globalDefault = 10) {
  const meta = getSellerMeta(sellerId);
  return meta.commission_pct ?? globalDefault;
}
