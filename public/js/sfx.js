// Sound effects: real samples (Kenney audio packs, CC0) decoded through
// WebAudio, with the old procedural beeps as a fallback while samples load
// or if loading fails.

let ctx = null;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
  window.addEventListener(ev, () => ac(), { once: true }));

// ------------------------------------------------------------- samples

const SAMPLES = [
  'shot', 'rocket', 'minigun', 'boom', 'death', 'shield',
  'pickup', 'tick', 'go', 'hitmark', 'hurt', 'drift',
];
const buffers = {};

(async () => {
  for (const name of SAMPLES) {
    try {
      const res = await fetch(`/assets/sfx/${name}.ogg`);
      if (!res.ok) continue;
      const raw = await res.arrayBuffer();
      // decodeAudioData needs a context; create lazily but don't resume
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      buffers[name] = await ctx.decodeAudioData(raw);
    } catch { /* fallback beeps cover it */ }
  }
})();

function play(name, { vol = 0.5, rate = 1 } = {}) {
  const buf = buffers[name];
  if (!buf) return false;
  try {
    const a = ac();
    const src = a.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate * (0.94 + Math.random() * 0.12); // tiny variety
    const gain = a.createGain();
    gain.gain.value = vol;
    src.connect(gain).connect(a.destination);
    src.start();
    return true;
  } catch { return false; }
}

// ------------------------------------------------------- beep fallbacks

function tone({ type = 'square', from = 440, to = 220, dur = 0.15, vol = 0.12 }) {
  try {
    const a = ac();
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, a.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), a.currentTime + dur);
    gain.gain.setValueAtTime(vol, a.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    osc.connect(gain).connect(a.destination);
    osc.start();
    osc.stop(a.currentTime + dur);
  } catch { /* audio blocked — fine */ }
}

export const sfx = {
  fire(weapon) {
    if (weapon === 'rocket') { if (!play('rocket', { vol: 0.4 })) tone({ type: 'sawtooth', from: 200, to: 60, dur: 0.3 }); }
    else if (weapon === 'minigun') { if (!play('minigun', { vol: 0.16, rate: 1.4 })) tone({ type: 'square', from: 900, to: 500, dur: 0.05, vol: 0.06 }); }
    else if (weapon === 'mine') { if (!play('tick', { vol: 0.4, rate: 0.7 })) tone({ type: 'sine', from: 300, to: 150, dur: 0.15 }); }
    else { if (!play('shot', { vol: 0.3 })) tone({ type: 'triangle', from: 1200, to: 500, dur: 0.1 }); }
  },
  boom() { if (!play('boom', { vol: 0.55 })) tone({ type: 'sine', from: 120, to: 30, dur: 0.4, vol: 0.25 }); },
  hit() { if (!play('hurt', { vol: 0.5 })) tone({ type: 'square', from: 300, to: 120, dur: 0.08 }); },
  hitConfirm() { if (!play('hitmark', { vol: 0.42, rate: 1.25 })) tone({ type: 'sine', from: 1400, to: 1200, dur: 0.05, vol: 0.1 }); },
  shield() { if (!play('shield', { vol: 0.35 })) tone({ type: 'sine', from: 700, to: 900, dur: 0.1, vol: 0.08 }); },
  pickup() { if (!play('pickup', { vol: 0.5 })) tone({ type: 'sine', from: 500, to: 1100, dur: 0.18 }); },
  death() { if (!play('death', { vol: 0.6 })) tone({ type: 'sawtooth', from: 400, to: 40, dur: 0.6, vol: 0.2 }); },
  drift() { if (!play('drift', { vol: 0.45, rate: 1.3 })) tone({ type: 'triangle', from: 400, to: 900, dur: 0.2, vol: 0.12 }); },
  countdownTick() { if (!play('tick', { vol: 0.45 })) tone({ type: 'sine', from: 660, to: 660, dur: 0.1, vol: 0.12 }); },
  countdownEnd() { if (!play('go', { vol: 0.55 })) tone({ type: 'sine', from: 880, to: 880, dur: 0.3, vol: 0.15 }); },
};
