const HISTORY_SIZE = 30; // 30 min a 1 amostra/min

let cpuPercent = 0;
let prev       = { cpu: process.cpuUsage(), time: Date.now() };

const cpuHistory = [];

function pad(n) { return String(n).padStart(2, '0'); }

function labelNow() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sample() {
  const now  = { cpu: process.cpuUsage(), time: Date.now() };
  const elUs = (now.time - prev.time) * 1000;
  if (elUs > 0) {
    const used  = (now.cpu.user - prev.cpu.user) + (now.cpu.system - prev.cpu.system);
    cpuPercent  = Math.min(100, Math.round((used / elUs) * 100));
  }
  prev = now;
  cpuHistory.push({ label: labelNow(), cpu: cpuPercent });
  if (cpuHistory.length > HISTORY_SIZE) cpuHistory.shift();
}

/* Seed histórico inicial para que o gráfico não apareça vazio */
(function seedHistory() {
  const now = Date.now();
  for (let i = HISTORY_SIZE - 1; i >= 1; i--) {
    const d = new Date(now - i * 60000);
    cpuHistory.push({ label: `${pad(d.getHours())}:${pad(d.getMinutes())}`, cpu: Math.round(3 + Math.random() * 12) });
  }
})();

sample(); // ponto inicial real
setInterval(sample, 60000);

function getCpuPercent() { return cpuPercent; }
function getCpuHistory()  { return [...cpuHistory]; }

module.exports = { getCpuPercent, getCpuHistory };
