let ctx: AudioContext | null = null;
let pulse: ReturnType<typeof setInterval> | null = null;
let keep: OscillatorNode | null = null;
let bell: HTMLAudioElement | null = null;
let ringing = false;

function wavUri() {
  const rate = 8000;
  const seconds = 2;
  const n = rate * seconds;
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
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const env = t < 1.5 ? 1 : Math.max(0, (2 - t) / 0.5);
    const s = (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 480 * t)) * 0.32 * env;
    view.setInt16(44 + i * 2, s * 0x7fff, true);
  }
  const blob = new Blob([bytes], { type: "audio/wav" });
  return URL.createObjectURL(blob);
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
  if (!bell) {
    bell = new Audio(wavUri());
    bell.loop = true;
    bell.preload = "auto";
    bell.setAttribute("playsinline", "true");
  }
  try {
    const prev = bell.volume;
    bell.volume = 0.001;
    await bell.play();
    bell.pause();
    bell.currentTime = 0;
    bell.volume = prev || 1;
  } catch {
    // next user tap retries
  }
}

function burst() {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const freq of [440, 480]) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.28, now + 0.02);
    g.gain.setValueAtTime(0.28, now + 1.7);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(now);
    o.stop(now + 2.05);
  }
}

export function startRing() {
  if (ringing) return;
  ringing = true;
  void armRing().then(() => {
    if (!ringing) return;
    burst();
    pulse = setInterval(burst, 3500);
    if (bell) {
      bell.volume = 1;
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

function tone(freq: number, when: number, dur: number) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "triangle";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.22, when + 0.02);
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
    tone(784, now, 0.22);
    tone(988, now + 0.18, 0.28);
    tone(1174, now + 0.4, 0.35);
  });
}

