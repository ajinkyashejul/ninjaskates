// Keyboard + touch input. Sends the held-input state to the server whenever
// it changes (plus a low-rate keepalive so a dropped packet can't stick keys).

export class Input {
  constructor(net) {
    this.net = net;
    this.state = { u: false, d: false, l: false, r: false, f: false };
    this._last = '';
  }

  start() {
    const keymap = {
      KeyW: 'u', ArrowUp: 'u',
      KeyS: 'd', ArrowDown: 'd',
      KeyA: 'l', ArrowLeft: 'l',
      KeyD: 'r', ArrowRight: 'r',
      Space: 'f',
    };
    window.addEventListener('keydown', (e) => {
      const k = keymap[e.code];
      if (!k) return;
      e.preventDefault();
      this.state[k] = true;
      this._push();
    });
    window.addEventListener('keyup', (e) => {
      const k = keymap[e.code];
      if (!k) return;
      this.state[k] = false;
      this._push();
    });
    window.addEventListener('blur', () => {
      Object.keys(this.state).forEach((k) => { this.state[k] = false; });
      this._push();
    });

    const canvas = document.getElementById('game');
    canvas.addEventListener('mousedown', () => { this.state.f = true; this._push(); });
    window.addEventListener('mouseup', () => { this.state.f = false; this._push(); });

    this._touch();
    setInterval(() => this._push(true), 250); // keepalive
  }

  _push(force = false) {
    const s = this.state;
    const key = `${s.u}${s.d}${s.l}${s.r}${s.f}`;
    if (!force && key === this._last) return;
    this._last = key;
    this.net.send({ t: 'input', u: s.u, d: s.d, l: s.l, r: s.r, f: s.f });
  }

  _touch() {
    const stick = document.getElementById('touch-stick');
    const knob = document.getElementById('touch-knob');
    const fire = document.getElementById('touch-fire');
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
      this._push();
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
        this._push();
      }
    });

    fire.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.state.f = true;
      this._push();
    });
    fire.addEventListener('touchend', () => {
      this.state.f = false;
      this._push();
    });
  }
}
