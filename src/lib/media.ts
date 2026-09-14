import { packPcm, playWire } from "@/lib/wire-media";

let stream: MediaStream | null = null;
let output: AudioContext | null = null;
let keep: HTMLVideoElement | null = null;
let keepAliveOsc: OscillatorNode | null = null;
let workletReady = false;
let capture: { stop: () => void } | null = null;
let playBag: { ctx: AudioContext; next: number } | null = null;
const pcmSinks = new Set<(buf: ArrayBuffer) => void>();
const heardSeq = new Set<number>();
let micMuted = false;
let meter = 0;
let nativeEar = false;

const WORKLET = `
class BuddyCap extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(1024);
    this.i = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let n = 0; n < ch.length; n++) {
      this.buf[this.i++] = ch[n];
      if (this.i >= this.buf.length) {
        this.port.postMessage(this.buf.slice());
        this.i = 0;
      }
    }
    return true;
  }
}
registerProcessor("buddy-cap", BuddyCap);
`;

export function isMicMuted() {
  return micMuted;
}

export function setMicMuted(muted: boolean) {
  micMuted = muted;
}

export function micLevel() {
  return meter;
}

export function hasLiveMic() {
  return Boolean(stream?.getAudioTracks().some((t) => t.readyState === "live"));
}

export function currentStream() {
  return hasLiveMic() ? stream : null;
}

export function isRealVideo(track: MediaStreamTrack) {
  return track.kind === "video" && track.readyState !== "ended";
}

export function streamHasVideo(media: MediaStream | null | undefined) {
  return Boolean(media?.getVideoTracks().some(isRealVideo));
}

export function getAudioContext() {
  return output;
}

export function onPcmOut(cb: (buf: ArrayBuffer) => void) {
  pcmSinks.add(cb);
  return () => {
    pcmSinks.delete(cb);
  };
}

function keepLocalAlive(media: MediaStream) {
  if (typeof document === "undefined") return;
  if (!keep) {
    keep = document.createElement("video");
    keep.muted = true;
    keep.autoplay = true;
    keep.playsInline = true;
    keep.setAttribute("playsinline", "true");
    keep.style.cssText =
      "position:fixed;right:8px;bottom:8px;width:32px;height:32px;opacity:0.03;pointer-events:none;z-index:80";
    document.body.appendChild(keep);
  }
  if (keep.srcObject !== media) keep.srcObject = media;
  void keep.play().catch(() => {});
}

function emitPcm(samples: Float32Array) {
  let sum = 0;
  for (const v of samples) sum += v * v;
  meter = Math.min(1, Math.sqrt(sum / samples.length) * 8);
  if (!pcmSinks.size || micMuted || !output) return;
  const buf = packPcm(output.sampleRate, samples);
  for (const cb of pcmSinks) cb(buf);
}

function stopCapture() {
  capture?.stop();
  capture = null;
  meter = 0;
}

async function ensureWorklet(ctx: AudioContext) {
  if (workletReady) return true;
  try {
    const url = URL.createObjectURL(new Blob([WORKLET], { type: "text/javascript" }));
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    workletReady = true;
    return true;
  } catch {
    return false;
  }
}

async function startCapture() {
  if (!output || !stream) return;
  const audio = stream.getAudioTracks().find((t) => t.readyState === "live");
  if (!audio) return;
  stopCapture();
  audio.enabled = true;
  const src = output.createMediaStreamSource(new MediaStream([audio]));
  const silent = output.createGain();
  silent.gain.value = 0;

  if (await ensureWorklet(output)) {
    const node = new AudioWorkletNode(output, "buddy-cap");
    src.connect(node);
    node.connect(silent);
    silent.connect(output.destination);
    node.port.onmessage = (e) => emitPcm(new Float32Array(e.data as ArrayBufferLike));
    capture = {
      stop: () => {
        node.port.onmessage = null;
        try {
          src.disconnect();
          node.disconnect();
          silent.disconnect();
        } catch {
          // already gone
        }
      },
    };
    return;
  }

  const proc = output.createScriptProcessor(1024, 1, 1);
  src.connect(proc);
  proc.connect(silent);
  silent.connect(output.destination);
  proc.onaudioprocess = (ev) => emitPcm(ev.inputBuffer.getChannelData(0).slice());
  capture = {
    stop: () => {
      proc.onaudioprocess = null;
      try {
        src.disconnect();
        proc.disconnect();
        silent.disconnect();
      } catch {
        // already gone
      }
    },
  };
}

function startKeepAlive() {
  if (!output || keepAliveOsc) return;
  try {
    const osc = output.createOscillator();
    const g = output.createGain();
    g.gain.value = 0.00004;
    osc.frequency.value = 20;
    osc.connect(g);
    g.connect(output.destination);
    osc.start();
    keepAliveOsc = osc;
  } catch {
    // optional
  }
}

export async function unlockOutput() {
  try {
    output ??= new AudioContext();
    if (output.state === "suspended") await output.resume();
    startKeepAlive();
    playBag = { ctx: output, next: 0 };
    const buf = output.createBuffer(1, 8, output.sampleRate);
    const src = output.createBufferSource();
    src.buffer = buf;
    src.connect(output.destination);
    src.start();
  } catch {
    // call tap already unlocked audio
  }
  await startCapture();
}

export function setNativeEar(on: boolean) {
  nativeEar = on;
}

export function hearPcm(buf: ArrayBuffer) {
  if (nativeEar) return;
  if (!output) {
    try {
      output = new AudioContext();
    } catch {
      return;
    }
  }
  if (output.state === "suspended") void output.resume();
  const view = new DataView(buf);
  if (view.byteLength >= 4 && view.getUint8(0) === 0) {
    const seq = view.getUint16(1, true);
    if (heardSeq.has(seq)) return;
    heardSeq.add(seq);
    if (heardSeq.size > 400) heardSeq.clear();
  }
  playBag ??= { ctx: output, next: 0 };
  playBag.next = playWire(buf, playBag, () => {});
}

export async function getLocalStream(wantCamera: boolean, _monitor = false): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("insecure");
  }
  if (!stream || !hasLiveMic()) {
    const audio: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }
    for (const t of stream.getAudioTracks()) t.enabled = true;
  }
  const liveVideo = stream.getVideoTracks().filter(isRealVideo);
  if (wantCamera && liveVideo.length === 0) {
    try {
      const cam = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 480, max: 640 },
          height: { ideal: 360, max: 480 },
          frameRate: { ideal: 24, max: 30 },
        },
        audio: false,
      });
      for (const t of cam.getVideoTracks()) {
        t.enabled = true;
        stream.addTrack(t);
      }
    } catch {
      // stay audio-only
    }
  }
  if (!wantCamera && liveVideo.length) {
    for (const t of liveVideo) {
      t.stop();
      stream.removeTrack(t);
    }
  }
  keepLocalAlive(stream);
  await startCapture();
  return stream;
}

export async function startScreenShare(): Promise<MediaStream> {
  if (!stream || !hasLiveMic()) await getLocalStream(false);
  if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("share");
  const display = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 12 },
    audio: false,
  });
  const track = display.getVideoTracks()[0];
  if (!track || !stream) throw new Error("share");
  for (const t of stream.getVideoTracks()) {
    t.stop();
    stream.removeTrack(t);
  }
  if ("contentHint" in track) (track as MediaStreamTrack & { contentHint: string }).contentHint = "detail";
  track.enabled = true;
  stream.addTrack(track);
  keepLocalAlive(stream);
  return stream;
}

export function stopLocalStream() {
  micMuted = false;
  nativeEar = false;
  stopCapture();
  heardSeq.clear();
  if (stream) {
    for (const t of stream.getTracks()) t.stop();
  }
  stream = null;
  if (keep) {
    keep.srcObject = null;
    keep.pause();
  }
}

export function micHint(err: unknown) {
  if (typeof window !== "undefined" && window.self !== window.top) {
    return "open the share link in Safari or Chrome, not inside another app";
  }
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "open the share link in Safari or Chrome";
  }
  const name = err instanceof DOMException || err instanceof Error ? err.name : "";
  const msg = err instanceof Error ? err.message : "";
  if (name === "insecure" || msg === "insecure") {
    return "open the share link in Safari or Chrome";
  }
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "allow the microphone, then tap join the line";
  }
  if (name === "NotFoundError") return "no microphone found";
  if (name === "NotReadableError") return "mic is already in use";
  return "mic blocked. allow it, then tap join the line";
}
