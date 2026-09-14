let ctx: AudioContext | null = null;
let pulse: ReturnType<typeof setInterval> | null = null;
let keep: OscillatorNode | null = null;
let bell: HTMLAudioElement | null = null;
let tap: HTMLAudioElement | null = null;
let ringing = false;

function writeWav(samples: Float32Array, rate: number) {
  const n = samples.length;
  const bytes = new ArrayBuffer(44 + n * 2);
  const view = new DataView(bytes);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, 36 + n * 2, true);
  str(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(44 + i * 2, s * 0x7fff, true);
  }
  return URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
}

function chimeWav() {
  const rate = 22050;
  const seconds = 2.8;
  const n = Math.floor(rate * seconds);
  const samples = new Float32Array(n);
  const notes = [
    { f: 523.25, at: 0, dur: 0.28 },
    { f: 659.25, at: 0.22, dur: 0.32 },
    { f: 783.99, at: 0.48, dur: 0.55 },
  ];
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    let s = 0;
    for (const note of notes) {
      const p = t - note.at;
      if (p < 0 || p > note.dur) continue;
      const env = Math.sin((Math.PI * p) / note.dur);
      s += Math.sin(2 * Math.PI * note.f * p) * env * 0.22;
    }
    samples[i] = s;
  }
  return writeWav(samples, rate);
}

function hangWav() {
  const rate = 22050;
  const n = Math.floor(rate * 0.55);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const a = t < 0.18 ? Math.sin(2 * Math.PI * 392 * t) * (1 - t / 0.18) * 0.28 : 0;
    const b = t > 0.16 && t < 0.5 ? Math.sin(2 * Math.PI * 247 * (t - 0.16)) * (1 - (t - 0.16) / 0.34) * 0.24 : 0;
    samples[i] = a + b;
  }
  return writeWav(samples, rate);
}

function keepAlive() {
  if (!ctx || keep) return;
  try {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0.00004;
    osc.frequency.value = 20;
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    keep = osc;
  } catch {
    // optional
  }
}

export async function armRing() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") await ctx.resume();
    keepAlive();
  } catch {
    // HTML audio below
  }
  if (typeof document === "undefined") return;
  if (!tap) {
    tap = new Audio(chimeWav());
    tap.volume = 0;
  }
  try {
    await tap.play();
    tap.pause();
    tap.currentTime = 0;
  } catch {
    // next tap retries
  }
  if (!bell) {
    bell = new Audio(chimeWav());
    bell.loop = true;
    bell.preload = "auto";
    bell.setAttribute("playsinline", "true");
  }
}

function burst() {
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const now = ctx.currentTime;
  const notes = [
    { f: 523.25, at: 0, dur: 0.28 },
    { f: 659.25, at: 0.2, dur: 0.32 },
    { f: 783.99, at: 0.42, dur: 0.5 },
  ];
  for (const note of notes) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = note.f;
    const t0 = now + note.at;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + note.dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + note.dur + 0.02);
  }
}

export function startRing() {
  if (ringing) return;
  ringing = true;
  void armRing().then(() => {
    if (!ringing) return;
    burst();
    pulse = setInterval(burst, 2800);
    if (bell) {
      bell.volume = 0.85;
      bell.currentTime = 0;
      void bell.play().catch(() => {});
    }
  });
}

export function stopRing() {
  ringing = false;
  if (pulse) clearInterval(pulse);
  pulse = null;
  if (bell) {
    bell.pause();
    bell.currentTime = 0;
  }
}

function tone(freq: number, when: number, dur: number, gain = 0.2) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(gain, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(when);
  o.stop(when + dur + 0.02);
}

export function pingBreak() {
  void armRing().then(() => {
    if (!ctx) return;
    const now = ctx.currentTime;
    tone(659.25, now, 0.18, 0.16);
    tone(783.99, now + 0.16, 0.28, 0.16);
  });
}

export function playHangup() {
  stopRing();
  void armRing().then(() => {
    if (ctx) {
      const now = ctx.currentTime;
      tone(392, now, 0.16, 0.18);
      tone(246.94, now + 0.14, 0.32, 0.16);
    }
    const clip = new Audio(hangWav());
    clip.volume = 0.8;
    void clip.play().catch(() => {});
  });
}
