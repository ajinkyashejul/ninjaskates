// Tiny procedural sound effects via WebAudio — no audio assets needed.

let ctx = null;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// unlock audio on first user gesture
['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
  window.addEventListener(ev, () => ac(), { once: true }));

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

function noise(dur = 0.35, vol = 0.25) {
  try {
    const a = ac();
    const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
    }
    const src = a.createBufferSource();
    src.buffer = buf;
    const gain = a.createGain();
    gain.gain.value = vol;
    const filter = a.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    src.connect(filter).connect(gain).connect(a.destination);
    src.start();
  } catch { /* ignore */ }
}

export const sfx = {
  fire(weapon) {
    if (weapon === 'rocket') tone({ type: 'sawtooth', from: 200, to: 60, dur: 0.3, vol: 0.15 });
    else if (weapon === 'minigun') tone({ type: 'square', from: 900, to: 500, dur: 0.05, vol: 0.06 });
    else if (weapon === 'mine') tone({ type: 'sine', from: 300, to: 150, dur: 0.15 });
    else tone({ type: 'triangle', from: 1200, to: 500, dur: 0.1, vol: 0.1 }); // shuriken whoosh
  },
  boom() { noise(0.4, 0.3); tone({ type: 'sine', from: 120, to: 30, dur: 0.4, vol: 0.25 }); },
  hit() { tone({ type: 'square', from: 300, to: 120, dur: 0.08, vol: 0.12 }); },
  shield() { tone({ type: 'sine', from: 700, to: 900, dur: 0.1, vol: 0.08 }); },
  pickup() { tone({ type: 'sine', from: 500, to: 1100, dur: 0.18, vol: 0.12 }); },
  death() { tone({ type: 'sawtooth', from: 400, to: 40, dur: 0.6, vol: 0.2 }); noise(0.5, 0.2); },
  countdownEnd() { tone({ type: 'sine', from: 880, to: 880, dur: 0.3, vol: 0.15 }); },
};
