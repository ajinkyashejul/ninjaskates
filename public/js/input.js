// Keyboard + touch input. This module only tracks the held-input state —
// the main loop samples it at the fixed simulation rate, predicts locally,
// and sends it to the server with a sequence number.

export class Input {
  constructor() {
    this.state = { u: false, d: false, l: false, r: false, f: false, dr: false };
  }

  start() {
    const keymap = {
      KeyW: 'u', ArrowUp: 'u',
      KeyS: 'd', ArrowDown: 'd',
      KeyA: 'l', ArrowLeft: 'l',
      KeyD: 'r', ArrowRight: 'r',
      Space: 'f',
      ShiftLeft: 'dr', ShiftRight: 'dr',
    };
    window.addEventListener('keydown', (e) => {
      const k = keymap[e.code];
      if (!k) return;
      e.preventDefault();
      this.state[k] = true;
    });
    window.addEventListener('keyup', (e) => {
      const k = keymap[e.code];
      if (!k) return;
      this.state[k] = false;
    });
    window.addEventListener('blur', () => {
      Object.keys(this.state).forEach((k) => { this.state[k] = false; });
    });

    const canvas = document.getElementById('game');
    canvas.addEventListener('mousedown', () => { this.state.f = true; });
    window.addEventListener('mouseup', () => { this.state.f = false; });

    this._touch();
  }

  _touch() {
    const stick = document.getElementById('touch-stick');
    const knob = document.getElementById('touch-knob');
    const fire = document.getElementById('touch-fire');
    const drift = document.getElementById('touch-drift');
    if (!stick) return;

    let stickTouch = null;
    const RADIUS = 65;

    const setStick = (dx, dz) => {
      const len = Math.hypot(dx, dz) || 1;
      const cx = Math.min(len, RADIUS - 25) * (dx / len);
      const cz = Math.min(len, RADIUS - 25) * (dz / len);
      knob.style.left = `${40 + cx}px`;
      knob.style.top = `${40 + cz}px`;
      const nx = dx / RADIUS;
      const nz = dz / RADIUS;
      this.state.u = nz < -0.25;
      this.state.d = nz > 0.45;
      this.state.l = nx < -0.3;
      this.state.r = nx > 0.3;
    };

    stick.addEventListener('touchstart', (e) => {
      e.preventDefault();
      stickTouch = e.changedTouches[0].identifier;
    });
    window.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== stickTouch) continue;
        const r = stick.getBoundingClientRect();
        setStick(t.clientX - (r.left + r.width / 2), t.clientY - (r.top + r.height / 2));
      }
    }, { passive: false });
    window.addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== stickTouch) continue;
        stickTouch = null;
        knob.style.left = '40px';
        knob.style.top = '40px';
        this.state.u = this.state.d = this.state.l = this.state.r = false;
      }
    });

    const bindButton = (el, key) => {
      if (!el) return;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); this.state[key] = true; });
      el.addEventListener('touchend', () => { this.state[key] = false; });
    };
    bindButton(fire, 'f');
    bindButton(drift, 'dr');
  }
}
