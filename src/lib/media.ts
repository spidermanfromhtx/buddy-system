import { packPcm, playWire } from "@/lib/wire-media";

let stream: MediaStream | null = null;
let output: AudioContext | null = null;
let speaker: HTMLVideoElement | null = null;
let remoteNode: MediaStreamAudioSourceNode | null = null;
let keepAliveOsc: OscillatorNode | null = null;
let capture: { src: MediaStreamAudioSourceNode; proc: ScriptProcessorNode; mute: GainNode } | null = null;
let playBag: { ctx: AudioContext; next: number } | null = null;
const pcmSinks = new Set<(buf: ArrayBuffer) => void>();
let micMuted = false;

export function isMicMuted() {
  return micMuted;
}

function applyMicMute() {
  for (const t of stream?.getAudioTracks() ?? []) t.enabled = !micMuted;
}

export function setMicMuted(muted: boolean) {
  micMuted = muted;
  applyMicMute();
}

export function hasLiveMic() {
  return Boolean(stream?.getAudioTracks().some((t) => t.readyState === "live"));
}

export function currentStream() {
  return hasLiveMic() ? stream : null;
}

export function isHoldVideo(track: MediaStreamTrack) {
  const w = track.getSettings().width;
  return track.kind === "video" && typeof w === "number" && w > 0 && w <= 32;
}

export function isRealVideo(track: MediaStreamTrack) {
  if (track.kind !== "video") return false;
  if (track.readyState === "ended") return false;
  if (isHoldVideo(track)) return false;
  return true;
}

export function streamHasVideo(media: MediaStream | null | undefined) {
  return Boolean(media?.getVideoTracks().some(isRealVideo));
}

function wireSpeaker(el: HTMLVideoElement) {
  el.autoplay = true;
  el.playsInline = true;
  el.muted = false;
  el.volume = 1;
  el.setAttribute("playsinline", "true");
  el.setAttribute("webkit-playsinline", "true");
  el.setAttribute("autoplay", "true");
}

function getSpeaker() {
  if (typeof document === "undefined") return null;
  if (speaker?.isConnected) return speaker;
  speaker = document.createElement("video");
  wireSpeaker(speaker);
  speaker.style.cssText =
    "position:fixed;left:4px;bottom:4px;width:12px;height:12px;opacity:0.04;pointer-events:none;z-index:99";
  document.body.appendChild(speaker);
  return speaker;
}

let keep: HTMLVideoElement | null = null;

function keepLocalAlive(media: MediaStream) {
  if (typeof document === "undefined") return;
  if (!keep) {
    keep = document.createElement("video");
    keep.muted = true;
    keep.autoplay = true;
    keep.playsInline = true;
    keep.setAttribute("playsinline", "true");
    keep.setAttribute("webkit-playsinline", "true");
    keep.style.cssText = "position:fixed;right:4px;bottom:4px;width:12px;height:12px;opacity:0.04;pointer-events:none";
    document.body.appendChild(keep);
  }
  if (keep.srcObject !== media) keep.srcObject = media;
  void keep.play().catch(() => {});
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

function stopCapture() {
  if (!capture) return;
  capture.proc.onaudioprocess = null;
  try {
    capture.src.disconnect();
    capture.proc.disconnect();
    capture.mute.disconnect();
  } catch {
    // already gone
  }
  capture = null;
}

function startCapture() {
  if (!output || !stream) return;
  const audio = stream.getAudioTracks().find((t) => t.readyState === "live");
  if (!audio) return;
  stopCapture();
  const src = output.createMediaStreamSource(new MediaStream([audio]));
  const proc = output.createScriptProcessor(1024, 1, 1);
  const mute = output.createGain();
  mute.gain.value = 0;
  src.connect(proc);
  proc.connect(mute);
  mute.connect(output.destination);
  proc.onaudioprocess = (ev) => {
    if (!pcmSinks.size || micMuted) return;
    const input = ev.inputBuffer.getChannelData(0);
    const buf = packPcm(output?.sampleRate || 48000, input);
    for (const cb of pcmSinks) cb(buf);
  };
  capture = { src, proc, mute };
}

function startKeepAlive() {
  if (!output || keepAliveOsc) return;
  try {
    const osc = output.createOscillator();
    const g = output.createGain();
    g.gain.value = 0.00005;
    osc.frequency.value = 30;
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
    // speaker play below is enough
  }
  const el = getSpeaker();
  if (el) {
    wireSpeaker(el);
    try {
      if (!el.srcObject && output) {
        el.srcObject = output.createMediaStreamDestination().stream;
      }
      void el.play().catch(() => {});
    } catch {
      // Call / Answer already used the gesture
    }
  }
  startCapture();
}

export function hearPcm(buf: ArrayBuffer) {
  if (!output) return;
  if (output.state === "suspended") void output.resume();
  playBag ??= { ctx: output, next: 0 };
  playBag.next = playWire(buf, playBag, () => {});
}

function kickPlay(el: HTMLMediaElement) {
  wireSpeaker(el as HTMLVideoElement);
  const go = () => {
    const p = el.play();
    if (p) void p.catch(() => {});
  };
  go();
  el.onloadedmetadata = go;
  el.oncanplay = go;
}

export async function getLocalStream(wantCamera: boolean, monitor = false): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("insecure");
  }
  if (stream && hasLiveMic()) {
    const liveVideo = stream.getVideoTracks().filter(isRealVideo);
    const hold = stream.getVideoTracks().filter((t) => t.readyState === "live" && isHoldVideo(t));
    if (wantCamera && liveVideo.length === 0) {
      try {
        const cam = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        });
        for (const t of hold) {
          t.stop();
          stream.removeTrack(t);
        }
        for (const t of cam.getVideoTracks()) {
          t.enabled = true;
          stream.addTrack(t);
        }
      } catch {
        // audio-only is fine
      }
      applyMicMute();
      keepLocalAlive(stream);
      startCapture();
      return stream;
    }
    if (!wantCamera && liveVideo.length) {
      for (const t of liveVideo) {
        t.enabled = false;
        t.stop();
        stream.removeTrack(t);
      }
    }
    applyMicMute();
    keepLocalAlive(stream);
    startCapture();
    return stream;
  }
  const audio: boolean | MediaTrackConstraints = monitor
    ? { echoCancellation: false, noiseSuppression: false, autoGainControl: true }
    : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  const video: boolean | MediaTrackConstraints = wantCamera
    ? { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } }
    : false;
  const tries: MediaStreamConstraints[] = [{ audio, video }];
  if (wantCamera) tries.push({ audio: true, video: true });
  tries.push({ audio: true, video: false });
  let last: unknown;
  for (const c of tries) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(c);
      for (const t of stream.getTracks()) t.enabled = true;
      applyMicMute();
      keepLocalAlive(stream);
      startCapture();
      return stream;
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error("mic blocked");
}

export function stopLocalStream() {
  stopCapture();
  micMuted = false;
  const extra: MediaStream[] = [];
  if (stream) extra.push(stream);
  if (keep?.srcObject instanceof MediaStream) extra.push(keep.srcObject);
  for (const media of extra) {
    for (const t of media.getTracks()) {
      t.enabled = false;
      t.stop();
    }
  }
  stream = null;
  if (keep) {
    keep.srcObject = null;
    keep.pause();
  }
  try {
    remoteNode?.disconnect();
  } catch {
    // already gone
  }
  remoteNode = null;
}

export async function playRemote(remote: MediaStream) {
  for (const t of remote.getAudioTracks()) t.enabled = true;
  const audioTracks = remote.getAudioTracks().filter((t) => t.readyState !== "ended");
  const el = getSpeaker();
  if (el) {
    el.srcObject = audioTracks.length ? new MediaStream(audioTracks) : null;
    if (audioTracks.length) kickPlay(el);
  }
  try {
    if (!output) return;
    if (output.state === "suspended") await output.resume();
    if (remoteNode) {
      try {
        remoteNode.disconnect();
      } catch {
        // already gone
      }
    }
    if (!audioTracks.length) return;
    remoteNode = output.createMediaStreamSource(new MediaStream(audioTracks));
    remoteNode.connect(output.destination);
  } catch {
    // PCM path is enough
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
