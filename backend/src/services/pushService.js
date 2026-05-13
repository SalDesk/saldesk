const webpush = require('web-push');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@saldesk.cv',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

async function sendPush(subscription, payload) {
  if (!subscription || !process.env.VAPID_PUBLIC_KEY) return;
  try {
    await webpush.sendNotification(
      typeof subscription === 'string' ? JSON.parse(subscription) : subscription,
      JSON.stringify(payload)
    );
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      return { expired: true };
    }
    console.error('[Push] Erro:', err.message);
  }
}

async function notifyStaff(staffRow, payload) {
  if (!staffRow?.push_subscription) return;
  return sendPush(staffRow.push_subscription, payload);
}

async function notifyOperator(operatorRow, payload) {
  if (!operatorRow?.push_subscription) return;
  return sendPush(operatorRow.push_subscription, payload);
}

module.exports = { sendPush, notifyStaff, notifyOperator };
