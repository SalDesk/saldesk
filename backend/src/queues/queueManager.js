const Bull = require('bull');

let webhookQueue = null;
let syncQueue    = null;
let redisAvailable = false;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function createQueue(name) {
  const q = new Bull(name, REDIS_URL, {
    redis: { enableOfflineQueue: false, connectTimeout: 3000, lazyConnect: true },
  });

  q.on('error', (err) => {
    if (!redisAvailable) return;
    console.error(`[Queue:${name}] Redis error:`, err.message);
  });

  return q;
}

async function initQueues() {
  try {
    webhookQueue = createQueue('saldesk-webhooks');
    syncQueue    = createQueue('saldesk-sync');

    await webhookQueue.isReady();
    redisAvailable = true;

    const { processWebhookJob } = require('./webhookWorker');
    const { processSyncJob }    = require('./syncWorker');

    webhookQueue.process(3, async (job) => processWebhookJob(job));
    syncQueue.process(2,    async (job) => processSyncJob(job));

    console.log('[Queue] Redis ligado — queues activas (webhooks: 3, sync: 2 workers)');
  } catch (err) {
    redisAvailable = false;
    console.warn('[Queue] Redis indisponivel — jobs processados sincronamente');
  }
}

async function addWebhookJob(data) {
  if (redisAvailable && webhookQueue) {
    return webhookQueue.add(data, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
  }
  const { processWebhookJob } = require('./webhookWorker');
  return processWebhookJob({ data });
}

async function addSyncJob(data) {
  if (redisAvailable && syncQueue) {
    return syncQueue.add(data, { attempts: 2, backoff: { type: 'fixed', delay: 5000 } });
  }
  const { processSyncJob } = require('./syncWorker');
  return processSyncJob({ data });
}

function getWebhookQueue() { return webhookQueue; }
function getSyncQueue()    { return syncQueue; }
function isRedisAvailable() { return redisAvailable; }

module.exports = { initQueues, addWebhookJob, addSyncJob, getWebhookQueue, getSyncQueue, isRedisAvailable };
