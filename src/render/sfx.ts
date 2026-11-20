// Âm thanh nhỏ tự tạo bằng WebAudio (không dùng file âm thanh ngoài).
export class Sfx {
  private ctx: AudioContext | null = null;
  private on = true;

  unlock(): void {
    if (!this.ctx) {
      try { this.ctx = new AudioContext(); } catch { this.ctx = null; }
    }
    void this.ctx?.resume();
  }
  toggle(): void { this.on = !this.on; }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.08, slideTo?: number): void {
    if (!this.on || !this.ctx) return;
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur);
  }

  pick() { this.tone(880, 0.12, 'triangle', 0.06, 1320); }
  deposit() { this.tone(523, 0.2, 'sine', 0.07, 784); }
  lit() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.35, 'triangle', 0.07), i * 90)); }
  pulse() { this.tone(300, 0.4, 'sine', 0.09, 900); }
  hit() { this.tone(180, 0.3, 'sawtooth', 0.06, 90); }
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => this.tone(f, 0.5, 'triangle', 0.07), i * 140)); }
  lose() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.tone(f, 0.5, 'sine', 0.07), i * 200)); }
}
