// Âm thanh tự tạo bằng WebAudio (không dùng file ngoài): hiệu ứng + nhạc nền đêm, có âm lượng chung.
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private volume = 0.7;

  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
      } catch { this.ctx = null; }
    }
    void this.ctx?.resume();
  }
  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.08, slideTo?: number, dest?: AudioNode): void {
    if (!this.ctx || !this.master) return;
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(vol, c.currentTime + Math.min(0.02, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(dest ?? this.master);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  }
  private seq(notes: number[], gap: number, dur: number, type: OscillatorType = 'triangle', vol = 0.07) {
    notes.forEach((f, i) => setTimeout(() => this.tone(f, dur, type, vol), i * gap));
  }

  pick() { this.tone(880, 0.12, 'triangle', 0.05, 1320); }
  deposit() { this.tone(523, 0.2, 'sine', 0.06, 784); }
  lit() { this.seq([523, 659, 784, 1046], 90, 0.35); }
  pulse() { this.tone(300, 0.45, 'sine', 0.09, 900); }
  hit() { this.tone(180, 0.3, 'sawtooth', 0.06, 90); }
  jump() { this.tone(420, 0.12, 'sine', 0.05, 640); }
  dash() { this.tone(900, 0.15, 'sawtooth', 0.03, 300); }
  shadeSpawn() { this.tone(110, 0.6, 'sawtooth', 0.04, 70); }
  steal() { this.tone(700, 0.25, 'square', 0.03, 350); }
  charm() { this.seq([659, 880, 1175], 70, 0.2, 'sine', 0.06); }
  countdown() { this.tone(1000, 0.08, 'square', 0.04); }
  windWarn() { this.tone(200, 1.2, 'triangle', 0.03, 420); }
  win() { this.seq([523, 659, 784, 1046, 1318], 140, 0.5); }
  lose() { this.seq([392, 330, 262], 200, 0.5, 'sine'); }

  /** Nhạc nền đêm: hợp âm chậm lặp lại. */
  startMusic(): void {
    if (!this.ctx || !this.master || this.musicTimer !== null) return;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.35;
    this.musicGain.connect(this.master);
    const chords = [[220, 277, 330], [196, 247, 294], [175, 220, 262], [196, 247, 330]];
    let i = 0;
    const play = () => {
      for (const f of chords[i % chords.length]) this.tone(f, 3.8, 'sine', 0.025, undefined, this.musicGain!);
      this.tone(chords[i % chords.length][2] * 2, 0.6, 'triangle', 0.015, undefined, this.musicGain!);
      i++;
    };
    play();
    this.musicTimer = window.setInterval(play, 4000);
  }
  stopMusic(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.musicGain?.disconnect();
    this.musicGain = null;
  }
}
