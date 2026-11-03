// Nhạc nền đám cưới tự sáng tác bằng code: giai điệu chính (như hộp nhạc / sáo), piano rải hợp âm, bè trầm, chuông.
// Dựng sẵn thành 1 file WAV trong trình duyệt (OfflineAudioContext) rồi phát bằng <audio>, giống cách phát giọng MC:
// trình duyệt trong LIVE Studio có thể chặn Web Audio phát trực tiếp nhưng vẫn cho <audio> phát.
// Không dùng file nhạc ngoài nên không dính bản quyền. Chỉ phát trên trang stage; MC nói thì nhạc nhỏ xuống.
import { IS_STAGE } from '../live/page';
import { voice } from '../live/voice';

const LOUD = 0.7; // lúc MC im
const DUCK = 0.28; // lúc MC đang nói
const LEVEL_KEY = 'cuoi3d-music-level';
const BPM = 72;
const RATE = 32000;

// 16 ô nhịp Đô trưởng, mỗi ô 1 hợp âm (nốt MIDI): bè trầm + 3 nốt rải
const CHORDS: Record<string, number[]> = {
  C: [36, 60, 64, 67],
  G: [43, 59, 62, 67],
  Am: [45, 60, 64, 69],
  Em: [40, 59, 64, 67],
  F: [41, 60, 65, 69],
};
const PROG = ['C', 'G', 'Am', 'Em', 'F', 'C', 'F', 'G', 'C', 'G', 'Am', 'Em', 'F', 'C', 'G', 'C'];
// giai điệu chính: 4 phách mỗi ô, 0 = ngân tiếp nốt trước
const MELODY = [
  [72, 76, 79, 76],
  [74, 0, 71, 74],
  [72, 76, 81, 79],
  [79, 0, 76, 0],
  [77, 76, 74, 72],
  [76, 0, 72, 0],
  [74, 72, 69, 72],
  [74, 0, 0, 0],
  [72, 76, 79, 84],
  [83, 0, 79, 0],
  [81, 79, 76, 79],
  [79, 0, 0, 76],
  [77, 81, 79, 77],
  [76, 79, 72, 76],
  [74, 76, 74, 71],
  [72, 0, 0, 0],
];
const ARP = [0, 1, 2, 3, 2, 1, 2, 3]; // 8 móc đơn mỗi ô: rải hợp âm lên xuống

const freq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Dựng cả bài (16 ô nhịp, lặp được) thành AudioBuffer */
export async function render(): Promise<AudioBuffer> {
  const beat = 60 / BPM;
  const bar = beat * 4;
  const len = bar * PROG.length;
  const ctx = new OfflineAudioContext(1, Math.ceil((len + 0.01) * RATE), RATE);
  const out = ctx.createGain();
  out.gain.value = 1;
  // vang nhẹ cho êm, kiểu sảnh tiệc
  const rev = ctx.createConvolver();
  rev.buffer = impulse(ctx, 2.2);
  const wet = ctx.createGain();
  wet.gain.value = 0.3;
  out.connect(ctx.destination);
  out.connect(rev);
  rev.connect(wet);
  wet.connect(ctx.destination);

  const note = (f: number, at: number, dur: number, vol: number, type: OscillatorType, attack = 0.01, partial = 0) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    o.connect(g);
    g.connect(out);
    o.start(at);
    o.stop(at + dur + 0.05);
    if (partial) {
      // bồi âm cho tiếng chuông / hộp nhạc
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.frequency.value = f * partial;
      g2.gain.setValueAtTime(vol * 0.25, at);
      g2.gain.exponentialRampToValueAtTime(0.0008, at + dur * 0.4);
      o2.connect(g2);
      g2.connect(out);
      o2.start(at);
      o2.stop(at + dur);
    }
  };

  PROG.forEach((name, b) => {
    const t0 = b * bar;
    const ch = CHORDS[name];
    note(freq(ch[0]), t0, bar * 0.95, 0.22, 'sine', 0.02); // bè trầm
    note(freq(ch[0] + 12), t0 + beat * 2, bar * 0.5, 0.08, 'sine', 0.02);
    ARP.forEach((k, i) => note(freq(ch[1 + (k % 3)] + (k === 3 ? 12 : 0)), t0 + (i * beat) / 2, beat * 1.6, 0.07, 'triangle'));
    // giai điệu: ngân tới nốt kế tiếp
    const mel = MELODY[b];
    mel.forEach((m, i) => {
      if (!m) return;
      let hold = 1;
      while (i + hold < 4 && !mel[i + hold]) hold++;
      note(freq(m), t0 + i * beat, beat * hold + 0.35, 0.16, 'sine', 0.03, 3.01);
    });
    // chuông lấp lánh đầu mỗi 2 ô
    if (b % 2 === 0) note(freq(ch[3] + 24), t0, 2.2, 0.035, 'sine', 0.005, 2.76);
  });

  const buf = await ctx.startRendering();
  // nâng đỉnh lên 0,9 cho đủ to
  const d = buf.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  if (peak > 0) for (let i = 0; i < d.length; i++) d[i] *= 0.9 / peak;
  return buf;
}

/** AudioBuffer (mono) -> file WAV 16-bit */
function toWav(buf: AudioBuffer): Blob {
  const d = buf.getChannelData(0);
  const out = new DataView(new ArrayBuffer(44 + d.length * 2));
  const str = (o: number, s: string) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  out.setUint32(4, 36 + d.length * 2, true);
  str(8, 'WAVEfmt ');
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, 1, true);
  out.setUint32(24, buf.sampleRate, true);
  out.setUint32(28, buf.sampleRate * 2, true);
  out.setUint16(32, 2, true);
  out.setUint16(34, 16, true);
  str(36, 'data');
  out.setUint32(40, d.length * 2, true);
  for (let i = 0; i < d.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 0x7fff, true);
  return new Blob([out], { type: 'audio/wav' });
}

class Music {
  private el: HTMLAudioElement | null = null;
  on = true;
  // hệ số âm lượng chỉnh ở trang điều khiển: 1 = mặc định, 2 = gấp đôi (tối đa 100%)
  level = readLevel();
  ready = false;

  start() {
    if (!IS_STAGE || this.el) return;
    const el = new Audio();
    el.loop = true;
    el.volume = 0;
    this.el = el;
    render()
      .then((buf) => {
        el.src = URL.createObjectURL(toWav(buf));
        this.ready = true;
      })
      .catch((err) => console.warn('Không dựng được nhạc nền:', err));
    const tryPlay = () => this.ready && this.on && el.paused && el.play().catch(() => {});
    // trình duyệt chặn tự phát thì thử lại định kỳ / khi có tương tác
    setInterval(tryPlay, 2000);
    window.addEventListener('pointerdown', tryPlay);
    // âm lượng trượt mượt về mức đích
    setInterval(() => {
      const target = !this.on ? 0 : Math.min(1, (voice.busy ? DUCK : LOUD) * this.level);
      el.volume = Math.max(0, Math.min(1, el.volume + (target - el.volume) * 0.3));
      if (!this.on && el.volume < 0.01) el.pause();
    }, 100);
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
    if (on && this.ready) this.el?.play().catch(() => {});
  }

  /** cho DevTools / trang điều khiển hỏi: nhạc có đang phát thật không */
  get playing() {
    return !!this.el && !this.el.paused && this.el.volume > 0.01;
  }
}

function impulse(ctx: BaseAudioContext, secs: number) {
  const len = Math.floor(ctx.sampleRate * secs);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
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
// nghe thử ở trang điều khiển: window.cMusicPreview()
(window as unknown as { cMusicPreview: () => Promise<void> }).cMusicPreview = async () => {
  const a = new Audio(URL.createObjectURL(toWav(await render())));
  a.volume = 0.6;
  void a.play();
};
