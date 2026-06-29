// AI 마을 타일엔진 v2 — Kenney 시트를 인덱스로 직접 그리는 도시 렌더러 + 라이브 모드.
// data 에 미리계산된 ground/buildings/props/dashes/charBase 가 들어있고 엔진은 순수 렌더러.
class Village {
  constructor(canvas, data, imgs, opts = {}) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.data = data; this.sheet = imgs.tileset; this.opts = opts;
    this.T = 16; this.SCOLS = 27;
    this.COLS = data.map.w; this.ROWS = data.map.h;
    this.cv.width = this.COLS * 16; this.cv.height = this.ROWS * 16;
    this.ctx.imageSmoothingEnabled = false;
    this.charBase = data.charBase;
    this.hour = 9; this.fi = 0; this.playing = true; this.cur = {};
    this._initChars();
  }
  _tile(idx, dx, dy, flip) {
    const sx = (idx % this.SCOLS) * 16, sy = ((idx / this.SCOLS) | 0) * 16, c = this.ctx;
    if (flip) { c.save(); c.translate(dx + 16, dy); c.scale(-1, 1); c.drawImage(this.sheet, sx, sy, 16, 16, 0, 0, 16, 16); c.restore(); }
    else c.drawImage(this.sheet, sx, sy, 16, 16, dx, dy, 16, 16);
  }
  _initChars() {
    const T = 16;
    this.chars = this.data.frames[0].agents.map(a => ({ name: a.name, base: this.charBase[a.name], px: a.x * T + 8, py: a.y * T + 16, tx: a.x * T + 8, ty: a.y * T + 16, dir: 0, say: '', t: 0, walk: 0 }));
  }
  setFrame(i) {
    const f = this.data.frames[i]; this.cur = f;
    f.agents.forEach(a => { const c = this.chars.find(c => c.name === a.name); if (!c) return; c.tx = a.x * 16 + 8; c.ty = a.y * 16 + 16; c.say = a.say || ''; c.t = performance.now(); });
    if (this.opts.onFrame) this.opts.onFrame(f, i, this.data.frames.length);
  }
  _dir(dx, dy) { if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 1 : 2; return dy < 0 ? 3 : 0; }
  _bubble(c, now) {
    const age = now - c.t; if (!c.say || age > 4000) return; const ctx = this.ctx;
    const txt = c.say.length > 20 ? c.say.slice(0, 19) + '…' : c.say; ctx.font = '7px sans-serif';
    const w = ctx.measureText(txt).width + 8, bx = Math.max(2, Math.min(this.cv.width - w - 2, c.px - w / 2)), by = c.py - 30;
    ctx.fillStyle = 'rgba(255,255,255,.97)'; ctx.fillRect(bx, by, w, 11);
    ctx.fillStyle = '#1a1f29'; ctx.beginPath(); ctx.moveTo(c.px - 2, by + 11); ctx.lineTo(c.px + 2, by + 11); ctx.lineTo(c.px, by + 14); ctx.fill();
    ctx.fillStyle = '#1a1f29'; ctx.textAlign = 'center'; ctx.fillText(txt, bx + w / 2, by + 8);
  }
  _tint() {
    const h = this.hour, c = this.ctx; let col = null;
    if (h < 5 || h >= 21) col = 'rgba(18,26,70,0.5)';
    else if (h < 7) col = 'rgba(255,150,90,0.2)';
    else if (h >= 17 && h < 19) col = 'rgba(255,170,80,0.18)';
    else if (h >= 19) col = 'rgba(60,50,110,0.36)';
    if (col) { c.fillStyle = col; c.fillRect(0, 0, this.cv.width, this.cv.height); }
    if (h < 6 || h >= 19) { c.fillStyle = 'rgba(255,240,180,.9)'; for (const p of this.data.props) if (p.idx === 169) c.fillRect(p.x * 16 + 6, (p.y - 1) * 16 + 4, 4, 4); }
  }
  render(now) {
    const ctx = this.ctx, d = this.data, T = 16;
    for (let y = 0; y < this.ROWS; y++) for (let x = 0; x < this.COLS; x++) this._tile(d.ground[y][x], x * T, y * T);
    ctx.fillStyle = 'rgba(245,245,215,.85)';
    for (const z of d.dashes) { const x = z.x * T, y = z.y * T; if (z.d === 'h') ctx.fillRect(x + 6, y + 15, 4, 1); else ctx.fillRect(x + 15, y + 6, 1, 4); }
    for (const b of d.buildings) this._tile(b.idx, b.x * T, b.y * T);
    for (const p of d.props) this._tile(p.idx, p.x * T, p.y * T - (p.up ? T : 0));
    for (const c of this.chars) { const dx = c.tx - c.px, dy = c.ty - c.py; const moving = Math.abs(dx) + Math.abs(dy) > 0.6; if (moving) { c.dir = this._dir(dx, dy); c.walk++; } else c.walk = 0; c.px += dx * 0.12; c.py += dy * 0.12; }
    const sorted = [...this.chars].sort((a, b) => a.py - b.py);
    for (const c of sorted) {
      let idx, flip = false; const fr = c.walk > 0 && (Math.floor(c.walk / 6) % 2) ? 1 : 0;
      if (c.dir === 0) idx = c.base + fr; else if (c.dir === 3) idx = c.base + 2; else if (c.dir === 1) idx = c.base + 3; else { idx = c.base + 3; flip = true; }
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(c.px, c.py - 1, 6, 2, 0, 0, 7); ctx.fill();
      this._tile(idx, Math.round(c.px - 8), Math.round(c.py - 16), flip);
      ctx.fillStyle = 'rgba(15,19,25,.72)'; const nw = c.name.length * 7 + 4; ctx.fillRect(Math.round(c.px - nw / 2), Math.round(c.py - 27), nw, 9);
      ctx.fillStyle = '#fff'; ctx.font = '7px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(c.name, c.px, Math.round(c.py - 20));
    }
    for (const c of this.chars) this._bubble(c, now);
    if (this.cur && this.cur.event && this.cur.event.includes('비')) { ctx.strokeStyle = 'rgba(170,195,235,.55)'; ctx.lineWidth = 1; for (let i = 0; i < 150; i++) { const x = (i * 37 + now / 7) % this.cv.width, y = (i * 61 + now / 2.5) % this.cv.height; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 5); ctx.stroke(); } }
    this._tint();
  }
  setHour(h) { this.hour = h; }
  start(intervalMs = 4000) {
    this.setFrame(0);
    const loop = (now) => { this.render(now); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
    this._timer = setInterval(() => { if (!this.playing) return; this.fi++; if (this.fi >= this.data.frames.length) { this.playing = false; if (this.opts.onEnd) this.opts.onEnd(); return; } this.setFrame(this.fi); }, intervalMs);
  }
  restart() { this.fi = 0; this.playing = true; this.setFrame(0); }
  toggle() { this.playing = !this.playing; if (this.playing && this.fi >= this.data.frames.length - 1) this.restart(); return this.playing; }
  // ---------- 라이브 모드 (Supabase 폴링) ----------
  startRender() { const loop = (now) => { this.render(now); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  setEvent(ev) { this.cur = { event: ev || null }; }
  applyLive(rows) {
    for (const r of rows) {
      let c = this.chars.find(c => c.name === r.name);
      if (!c) { c = { name: r.name, base: this.charBase[r.name], px: r.x * 16 + 8, py: r.y * 16 + 16, tx: r.x * 16 + 8, ty: r.y * 16 + 16, dir: 0, say: '', t: 0, walk: 0 }; this.chars.push(c); }
      c.tx = r.x * 16 + 8; c.ty = r.y * 16 + 16; if (r.say !== undefined) { c.say = r.say || ''; c.t = performance.now(); }
    }
  }
}
const V_COLORS={"미나":'#e6a23c',"준호":'#5b8def',"옥자":'#e0568a',"동수":'#5fb87a',"서연":'#9b6dde',"가람":'#48c4c4'};
if(typeof window!=='undefined'){window.Village=Village;window.V_COLORS=V_COLORS;}
