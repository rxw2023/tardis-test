// ============================================================
// player.js — 预览页用的音频播放器（以 AudioContext 时钟为准）
// 画面时间跟音频走，做到音画不漂
// ============================================================

export const player = {
  ctx: null,
  buf: null,
  node: null,
  ready: false,
  playing: false,
  startedAt: 0,
  offset: 0,
  url: 'audio/film.wav',

  async load(url = this.url) {
    this.url = url;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arr = await res.arrayBuffer();
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
      // 这里不 resume：suspended 状态下 decodeAudioData 照样能用，
      // 而真正的 resume 必须发生在用户手势里（见 play）。
      this.buf = await this.ctx.decodeAudioData(arr);
      this.ready = true;
      return this.buf.duration;
    } catch (e) {
      this.ready = false;
      throw e;
    }
  },

  // 返回 true 表示声音真的排上了。浏览器自动播放策略下，
  // AudioContext 在首次手势前是 suspended，此时 start() 会排在一个被冻结的时钟上，
  // 表现就是「画面在走、一声不响」，所以必须等 resume() 兑现成 running 再 start()。
  async play(offset = 0) {
    if (!this.ready) return false;
    this.stop();
    const c = this.ctx;
    if (c.state !== 'running') {
      try { await c.resume(); } catch { /* 用户还没给手势 */ }
    }
    if (c.state !== 'running') return false;
    const n = c.createBufferSource();
    n.buffer = this.buf;
    n.connect(c.destination);
    n.start(0, Math.max(0, Math.min(offset, this.buf.duration - 0.02)));
    this.node = n;
    this.offset = Math.max(0, offset);
    this.startedAt = c.currentTime;
    this.playing = true;
    return true;
  },

  stop() {
    if (this.node) {
      try { this.node.stop(); } catch { /* already stopped */ }
      try { this.node.disconnect(); } catch { /* noop */ }
      this.node = null;
    }
    this.playing = false;
  },

  pause() {
    if (!this.playing) return;
    const t = this.time();
    this.stop();
    this.offset = t;
  },

  seek(t) {
    this.offset = Math.max(0, t);
    if (this.playing) this.play(this.offset);
  },

  time() {
    if (!this.ready) return this.offset;
    if (!this.playing) return this.offset;
    return Math.min(this.buf.duration, this.offset + (this.ctx.currentTime - this.startedAt));
  },

  duration() { return this.ready ? this.buf.duration : 0; },
};

// 排障用：控制台可直接查 __player.ctx.state / __player.ready
if (typeof window !== 'undefined') window.__player = player;
