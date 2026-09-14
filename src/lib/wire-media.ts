/** PCM + JPEG over a data channel when RTP media does not show up. */

const AUDIO = 0;
const JPEG = 1;

export function packPcm(sampleRate: number, samples: Float32Array): ArrayBuffer {
  const out = new ArrayBuffer(8 + samples.length * 2);
  const view = new DataView(out);
  view.setUint8(0, AUDIO);
  view.setUint32(4, sampleRate, true);
  const pcm = new Int16Array(out, 8);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export function packJpeg(bytes: ArrayBuffer): ArrayBuffer {
  const out = new Uint8Array(1 + bytes.byteLength);
  out[0] = JPEG;
  out.set(new Uint8Array(bytes), 1);
  return out.buffer;
}

export function startPcmSend(
  stream: MediaStream,
  send: (buf: ArrayBuffer) => void,
  ctx: AudioContext,
): () => void {
  const audio = stream.getAudioTracks().find((t) => t.readyState === "live");
  if (!audio) return () => {};
  const src = ctx.createMediaStreamSource(new MediaStream([audio]));
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  src.connect(analyser);
  const data = new Float32Array(analyser.fftSize);
  const bytes = new Uint8Array(analyser.fftSize);
  void ctx.resume();
  const id = window.setInterval(() => {
    if (typeof analyser.getFloatTimeDomainData === "function") {
      analyser.getFloatTimeDomainData(data);
      send(packPcm(ctx.sampleRate, data));
      return;
    }
    analyser.getByteTimeDomainData(bytes);
    for (let i = 0; i < bytes.length; i++) data[i] = ((bytes[i] ?? 128) - 128) / 128;
    send(packPcm(ctx.sampleRate, data));
  }, 40);
  return () => {
    window.clearInterval(id);
    src.disconnect();
  };
}

export function startJpegSend(
  video: HTMLVideoElement,
  send: (buf: ArrayBuffer) => void,
): () => void {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const tick = () => {
    if (!video.videoWidth) return;
    canvas.width = 240;
    canvas.height = Math.max(180, Math.round((240 * video.videoHeight) / video.videoWidth));
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        void blob.arrayBuffer().then((buf) => send(packJpeg(buf)));
      },
      "image/jpeg",
      0.45,
    );
  };
  const id = window.setInterval(tick, 250);
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
  const rate = view.getUint32(4, true) || 48000;
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
    const start = Math.max(audio.ctx.currentTime + 0.04, audio.next);
    node.start(start);
    return start + buffer.duration;
  } catch {
    return audio.next;
  }
}
