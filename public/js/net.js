// Thin WebSocket wrapper: JSON messages in/out, handler registry, ping loop.

export class Net {
  constructor() {
    this.ws = null;
    this.handlers = new Map();
    this.ping = 0;
    // ?fakelag=200 simulates 200ms round-trip for netcode testing
    this.fakeLag = Number(new URLSearchParams(location.search).get('fakelag') || 0) / 2;
  }

  on(type, fn) {
    this.handlers.set(type, fn);
  }

  connect(path) {
    return new Promise((resolve, reject) => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}${path}`);
      this.ws = ws;
      ws.onopen = () => {
        this._pingTimer = setInterval(() => {
          this.send({ t: 'ping', ts: performance.now() });
        }, 2000);
        resolve();
      };
      ws.onerror = () => reject(new Error('Could not reach the game server.'));
      ws.onclose = () => {
        clearInterval(this._pingTimer);
        const fn = this.handlers.get('close');
        if (fn) fn();
      };
      ws.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        const dispatch = () => {
          if (msg.t === 'pong') {
            this.ping = Math.round(performance.now() - msg.ts);
            return;
          }
          const fn = this.handlers.get(msg.t);
          if (fn) fn(msg);
        };
        if (this.fakeLag) setTimeout(dispatch, this.fakeLag);
        else dispatch();
      };
    });
  }

  send(obj) {
    if (!this.ws || this.ws.readyState !== 1) return;
    const data = JSON.stringify(obj);
    if (this.fakeLag) setTimeout(() => { if (this.ws.readyState === 1) this.ws.send(data); }, this.fakeLag);
    else this.ws.send(data);
  }
}
