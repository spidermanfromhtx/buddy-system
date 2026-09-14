/** PCM + JPEG over a data channel when RTP media does not show up. */

const AUDIO = 0;
const JPEG = 1;
let pcmSeq = 1;

export function packPcm(sampleRate: number, samples: Float32Array): ArrayBuffer {
  const target = 16000;
  const data = sampleRate === target ? samples : resample(samples, sampleRate, target);
  const bytes = new Uint8Array(8 + data.length * 2);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, AUDIO);
  view.setUint16(1, pcmSeq & 0xffff, true);
  pcmSeq += 1;
  view.setUint32(4, target, true);
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i] ?? 0));
    view.setInt16(8 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return bytes.buffer;
}

export function packJpeg(bytes: ArrayBuffer): ArrayBuffer {
  const out = new Uint8Array(1 + bytes.byteLength);
  out[0] = JPEG;
  out.set(new Uint8Array(bytes), 1);
  return out.buffer;
}

export function startJpegSend(
  video: HTMLVideoElement,
  send: (buf: ArrayBuffer) => void,
  opts?: { wide?: number; quality?: number; ms?: number },
): () => void {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const wide = opts?.wide ?? 200;
  const quality = opts?.quality ?? 0.4;
  const tick = () => {
    if (!video.videoWidth) return;
    canvas.width = wide;
    canvas.height = Math.max(Math.round(wide * 0.56), Math.round((wide * video.videoHeight) / video.videoWidth));
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        void blob.arrayBuffer().then((buf) => send(packJpeg(buf)));
      },
      "image/jpeg",
      quality,
    );
  };
  tick();
  const id = window.setInterval(tick, opts?.ms ?? 90);
  return () => window.clearInterval(id);
}

function resample(input: Float32Array, from: number, to: number) {
  if (!from || from === to) return input;
  const outLen = Math.max(1, Math.round((input.length * to) / from));
  const out = new Float32Array(outLen);
  const step = from / to;
  for (let i = 0; i < outLen; i++) {
    const x = i * step;
    const i0 = Math.floor(x);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const f = x - i0;
    out[i] = (input[i0] ?? 0) * (1 - f) + (input[i1] ?? 0) * f;
  }
  return out;
}

export function playWire(
  buf: ArrayBuffer,
  audio: { ctx: AudioContext; next: number },
  onJpeg: (url: string) => void,
): number {
  const view = new DataView(buf);
  if (view.byteLength < 2) return audio.next;
  const kind = view.getUint8(0);
  if (kind === JPEG) {
    const blob = new Blob([buf.slice(1)], { type: "image/jpeg" });
    onJpeg(URL.createObjectURL(blob));
    return audio.next;
  }
  if (kind !== AUDIO || view.byteLength < 10) return audio.next;
  const rate = view.getUint32(4, true) || 16000;
  const pcm = new Int16Array(buf.slice(8));
  const f32 = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) f32[i] = (pcm[i] ?? 0) / 0x8000;
  const samples = resample(f32, rate, audio.ctx.sampleRate);
  try {
    const node = audio.ctx.createBufferSource();
    const buffer = audio.ctx.createBuffer(1, Math.max(1, samples.length), audio.ctx.sampleRate);
    buffer.getChannelData(0).set(samples);
    node.buffer = buffer;
    node.connect(audio.ctx.destination);
    const now = audio.ctx.currentTime;
    let start = Math.max(now + 0.02, audio.next);
    if (start - now > 0.08) start = now + 0.02;
    node.start(start);
    return start + buffer.duration;
  } catch {
    return audio.next;
  }
}
