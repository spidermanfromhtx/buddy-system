let stream: MediaStream | null = null;
let output: AudioContext | null = null;
let speaker: HTMLVideoElement | null = null;
let keep: HTMLVideoElement | null = null;
let micMuted = false;

export function isMicMuted() {
  return micMuted;
}

export function setMicMuted(muted: boolean) {
  micMuted = muted;
  for (const t of stream?.getAudioTracks() ?? []) t.enabled = !muted;
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

function applyMute() {
  for (const t of stream?.getAudioTracks() ?? []) t.enabled = !micMuted;
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
    "position:fixed;left:8px;bottom:8px;width:32px;height:32px;opacity:0.03;pointer-events:none;z-index:80";
  document.body.appendChild(speaker);
  return speaker;
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

export async function unlockOutput() {
  try {
    output ??= new AudioContext();
    if (output.state === "suspended") await output.resume();
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
      await el.play();
    } catch {
      // Answer / Call already used the gesture
    }
  }
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
    let last: unknown;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
    } catch (e) {
      last = e;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch (e2) {
        throw e2 instanceof Error ? e2 : last instanceof Error ? last : new Error("mic blocked");
      }
    }
    for (const t of stream.getAudioTracks()) t.enabled = true;
  }
  const liveVideo = stream.getVideoTracks().filter(isRealVideo);
  if (wantCamera && liveVideo.length === 0) {
    try {
      const cam = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
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
  applyMute();
  keepLocalAlive(stream);
  return stream;
}

export async function playRemote(remote: MediaStream) {
  for (const t of remote.getAudioTracks()) t.enabled = true;
  const el = getSpeaker();
  if (el) {
    wireSpeaker(el);
    if (el.srcObject !== remote) el.srcObject = remote;
    const go = () => {
      void el.play().catch(() => {});
    };
    go();
    el.onloadedmetadata = go;
    el.oncanplay = go;
  }
  if (output && output.state === "suspended") await output.resume();
}

export function stopLocalStream() {
  micMuted = false;
  if (stream) {
    for (const t of stream.getTracks()) t.stop();
  }
  stream = null;
  if (keep) {
    keep.srcObject = null;
    keep.pause();
  }
  if (speaker) {
    speaker.srcObject = null;
    speaker.pause();
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
