// Nhạc nền tự tạo bằng Web Audio: piano rải hợp âm nhẹ + chuông, không dùng file nên không dính bản quyền.
// Chỉ phát trên trang stage. MC nói thì nhạc nhỏ xuống (ducking) để giọng luôn to hơn nhạc.
import { IS_STAGE } from '../live/page';
import { voice } from '../live/voice';

const LOUD = 0.5;
const DUCK = 0.2;
const LEVEL_KEY = 'cuoi3d-music-level';
const BPM = 76;

// Đô trưởng: C - G - Am - F, F - G - Em - Am (vòng hợp âm đám cưới quen tai)
const CHORDS = [
  [48, 55, 60, 64, 67],
  [43, 55, 59, 62, 67],
  [45, 57, 60, 64, 69],
  [41, 53, 57, 60, 65],
  [41, 53, 57, 60, 65],
  [43, 55, 59, 62, 67],
  [40, 52, 55, 59, 64],
  [45, 57, 60, 64, 69],
];
const ARP = [1, 2, 3, 4, 3, 2, 3, 2]; // thứ tự nốt rải trong 1 ô nhịp (8 móc đơn)
const MELODY = [76, 74, 72, 74, 76, 79, 77, 76]; // nốt chuông, mỗi ô nhịp 1-2 nốt

const freq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class Music {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private nextTime = 0;
  private step = 0;
  on = true;
  level = readLevel();

  start() {
    if (!IS_STAGE || this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0;
    this.master = master;
    // tiếng vang nhẹ cho êm
    const rev = ctx.createConvolver();
    rev.buffer = impulse(ctx, 2.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    master.connect(ctx.destination);
    master.connect(rev);
    rev.connect(wet);
    wet.connect(ctx.destination);

    const resume = () => this.on && ctx.state !== 'running' && ctx.resume().catch(() => {});
    resume();
    // trình duyệt chặn tự phát thì thử lại định kỳ / khi có tương tác
    setInterval(resume, 3000);
    window.addEventListener('pointerdown', resume);

    this.nextTime = ctx.currentTime + 0.2;
    setInterval(() => this.schedule(), 100);
    setInterval(() => {
      const target = !this.on ? 0 : Math.min(1, (voice.busy ? DUCK : LOUD) * this.level);
      master.gain.setTargetAtTime(target, ctx.currentTime, 0.15);
    }, 100);
  }

  /** xếp lịch nốt trước ~0,5 giây */
  private schedule() {
    const ctx = this.ctx!;
    const eighth = 60 / BPM / 2;
    while (this.nextTime < ctx.currentTime + 0.5) {
      const bar = Math.floor(this.step / 8) % CHORDS.length;
      const i = this.step % 8;
      const chord = CHORDS[bar];
      if (i === 0) this.note(freq(chord[0]), this.nextTime, 3.2, 0.22, 'sine'); // bè trầm
      this.note(freq(chord[ARP[i]]), this.nextTime, 1.6, 0.12, 'triangle');
      if (i === 0 || (i === 4 && bar % 2 === 1)) this.note(freq(MELODY[(bar + (i ? 1 : 0)) % MELODY.length]), this.nextTime, 2.5, 0.07, 'sine', true);
      this.nextTime += eighth;
      this.step++;
    }
  }

  private note(f: number, at: number, dur: number, vol: number, type: OscillatorType, bell = false) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g);
    g.connect(this.master!);
    o.start(at);
    o.stop(at + dur + 0.05);
    if (bell) {
      // bồi âm cho ra tiếng chuông
      const o2 = ctx.createOscillator();
      o2.frequency.value = f * 2.76;
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(vol * 0.3, at);
      g2.gain.exponentialRampToValueAtTime(0.0001, at + dur * 0.5);
      o2.connect(g2);
      g2.connect(this.master!);
      o2.start(at);
      o2.stop(at + dur);
    }
  }

  setLevel(level: number) {
    this.level = Math.max(0, Math.min(2, level));
    try {
      localStorage.setItem(LEVEL_KEY, String(this.level));
    } catch {
      // bỏ qua
    }
  }

  set(on: boolean) {
    this.on = on;
    if (on) this.ctx?.resume().catch(() => {});
  }

  get playing() {
    return !!this.ctx && this.ctx.state === 'running' && this.on;
  }
}

function impulse(ctx: AudioContext, secs: number) {
  const len = Math.floor(ctx.sampleRate * secs);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return buf;
}

function readLevel() {
  try {
    const v = Number(localStorage.getItem(LEVEL_KEY));
    return Number.isFinite(v) && v > 0 ? v : 1;
  } catch {
    return 1;
  }
}

export const music = new Music();
(window as unknown as { cMusic: Music }).cMusic = music;
