let ctx: AudioContext | null = null;
let pulse: ReturnType<typeof setInterval> | null = null;

export async function armRing() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") await ctx.resume();
  } catch {
    // ringtone may still start on a later tap
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
    g.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
    g.gain.setValueAtTime(0.22, now + 1.7);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(now);
    o.stop(now + 2.05);
  }
}

export function startRing() {
  stopRing();
  ctx ??= new AudioContext();
  void ctx.resume().then(() => {
    burst();
    pulse = setInterval(burst, 4000);
  });
}

export function stopRing() {
  if (pulse) clearInterval(pulse);
  pulse = null;
}
