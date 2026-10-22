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
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      this.buf = await this.ctx.decodeAudioData(arr);
      this.ready = true;
      return this.buf.duration;
    } catch (e) {
      this.ready = false;
      throw e;
    }
  },

  play(offset = 0) {
    if (!this.ready) return false;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.stop();
    const c = this.ctx;
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
