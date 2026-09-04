/* Som de notificacao (dois tons curtos, tipo "ding") gerado via Web Audio
   API -- sem precisar de nenhum ficheiro .mp3/.wav a embutir no build.
   Reaproveita um so AudioContext entre chamadas (criar um novo em cada
   notificacao acumulava contextos suspensos no browser). */
let ctx = null;

function getContext() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  return ctx;
}

export function playNotificationSound() {
  const audioCtx = getContext();
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});

  const now = audioCtx.currentTime;
  [{ freq: 880, start: 0 }, { freq: 1108, start: 0.09 }].forEach(({ freq, start }) => {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + start);
    gain.gain.exponentialRampToValueAtTime(0.18, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + 0.22);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now + start);
    osc.stop(now + start + 0.24);
  });
}
