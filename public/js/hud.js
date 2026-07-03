// DOM heads-up display: timer, leaderboard, health, weapon, kill feed,
// respawn + results overlays.

const $ = (id) => document.getElementById(id);

const WEAPON_LABELS = {
  shuriken: '🌀 Shurikens',
  rocket: '🚀 Rocket',
  minigun: '🔫 Minigun',
  mine: '💣 Smoke Mines',
};

export class Hud {
  constructor() {
    this.lastStandings = null;
    this._fpsFrames = 0;
    this._fpsAt = performance.now();
  }

  show(roomCode) {
    $('hud').classList.remove('hidden');
    $('room-code').textContent = roomCode;
    $('btn-copy').onclick = () => {
      const url = `${location.origin}/?room=${roomCode}`;
      navigator.clipboard?.writeText(url).catch(() => {});
      this.toast(`Invite link copied: ${url}`);
    };
  }

  toast(text, ms = 2600) {
    const t = $('toast');
    t.textContent = text;
    t.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
  }

  killFeed(killerName, victimName, weapon) {
    const el = document.createElement('div');
    el.className = 'kf-item';
    const w = WEAPON_LABELS[weapon] ? WEAPON_LABELS[weapon].split(' ')[0] : '💥';
    el.innerHTML = `<b></b> ${w} <i></i>`;
    el.querySelector('b').textContent = killerName;
    el.querySelector('i').textContent = victimName;
    const feed = $('killfeed');
    feed.appendChild(el);
    while (feed.children.length > 5) feed.removeChild(feed.firstChild);
    setTimeout(() => el.remove(), 4500);
  }

  pickupBanner(label) {
    const b = $('pickup-banner');
    b.textContent = `+ ${label}`;
    b.classList.remove('hidden');
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => b.classList.add('hidden'), 1500);
  }

  damageFlash() {
    const f = $('damage-flash');
    f.classList.add('show');
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => f.classList.remove('show'), 120);
  }

  setStandings(standings) {
    this.lastStandings = standings;
  }

  update(view, myId, ping) {
    // timer
    const t = Math.max(0, view.timeLeft);
    const mm = Math.floor(t / 60);
    const ss = String(Math.floor(t % 60)).padStart(2, '0');
    const timer = $('match-timer');
    if (view.state === 'playing') {
      timer.textContent = `${mm}:${ss}`;
      timer.classList.toggle('low', t <= 30);
    } else {
      timer.textContent = '0:00';
    }

    // leaderboard
    const sorted = [...view.players].sort((a, b) => b.k - a.k || a.d - b.d);
    $('leaderboard').innerHTML = sorted.slice(0, 8).map((p, i) => `
      <div class="lb-row${p.id === myId ? ' me' : ''}">
        <span>${i + 1}. ${esc(p.n)}${p.bot ? ' 🤖' : ''}</span>
        <span class="k">${p.k}</span>
      </div>`).join('');

    const me = view.players.find((p) => p.id === myId);
    if (me) {
      $('health-bar').style.width = `${me.hp}%`;
      $('health-num').textContent = me.hp;
      if (me.w) {
        $('weapon-name').textContent = WEAPON_LABELS[me.w] || me.w;
        $('weapon-ammo').textContent = `×${me.am}`;
      } else {
        $('weapon-name').textContent = 'Grab a crate!';
        $('weapon-ammo').textContent = '';
      }

      const respawn = $('respawn-overlay');
      if (!me.al && view.state === 'playing') {
        respawn.classList.remove('hidden');
        $('respawn-secs').textContent = Math.ceil(me.rs);
      } else {
        respawn.classList.add('hidden');
      }
    }

    // results
    const results = $('results-overlay');
    if (view.state === 'results') {
      results.classList.remove('hidden');
      $('respawn-overlay').classList.add('hidden');
      $('results-secs').textContent = Math.ceil(t);
      if (this.lastStandings && !this._resultsRendered) {
        this._resultsRendered = true;
        $('results-table').innerHTML =
          '<tr><th>#</th><th style="text-align:left">Ninja</th><th>Smashes</th><th>Wipeouts</th></tr>'
          + this.lastStandings.map((s, i) => `
            <tr class="${i === 0 ? 'first' : ''}">
              <td class="num">${i === 0 ? '👑' : i + 1}</td>
              <td style="text-align:left">${esc(s.n)}${s.bot ? ' 🤖' : ''}</td>
              <td class="num">${s.k}</td>
              <td class="num">${s.d}</td>
            </tr>`).join('');
      }
    } else {
      results.classList.add('hidden');
      this._resultsRendered = false;
    }

    // net stats
    this._fpsFrames++;
    const now = performance.now();
    if (now - this._fpsAt > 1000) {
      $('fps').textContent = `${this._fpsFrames}fps`;
      $('ping').textContent = `${ping}ms`;
      this._fpsFrames = 0;
      this._fpsAt = now;
    }
  }
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
