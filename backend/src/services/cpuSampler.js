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

/* Sem seed de historico com valores inventados -- havia um preenchimento
   de 29 pontos aleatorios "so para o grafico nao aparecer vazio", mas sem
   nenhuma flag a distinguir do ponto real (ao contrario de getDiskInfo(),
   que ja marca simulated:true/false). Como o servidor reinicia com
   frequencia, o founder via quase sempre 29 valores fabricados sem aviso.
   Preferimos um grafico honesto que comeca com 1 ponto real e cresce a
   cada minuto, a inventar historico que nunca aconteceu. */
sample(); // ponto inicial real
setInterval(sample, 60000);

function getCpuPercent() { return cpuPercent; }
function getCpuHistory()  { return [...cpuHistory]; }

module.exports = { getCpuPercent, getCpuHistory };
