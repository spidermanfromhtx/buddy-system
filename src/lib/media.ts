let stream: MediaStream | null = null;
let output: AudioContext | null = null;
let speaker: HTMLVideoElement | null = null;
let remoteNode: MediaStreamAudioSourceNode | null = null;

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
  if (track.readyState !== "live") return false;
  if (track.muted) return false;
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

export function setSpeaker(el: HTMLVideoElement | null) {
  speaker = el;
  if (el) wireSpeaker(el);
}

function getSpeaker() {
  if (typeof document === "undefined") return null;
  if (speaker && speaker.isConnected) return speaker;
  if (!speaker) {
    speaker = document.createElement("video");
    wireSpeaker(speaker);
    speaker.style.cssText =
      "position:fixed;left:0;bottom:0;width:8px;height:8px;opacity:0.02;pointer-events:none";
    document.body.appendChild(speaker);
  }
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
    keep.style.cssText = "position:fixed;right:0;bottom:0;width:8px;height:8px;opacity:0.02;pointer-events:none";
    document.body.appendChild(keep);
  }
  if (keep.srcObject !== media) keep.srcObject = media;
  void keep.play().catch(() => {});
}

function addHoldVideo(media: MediaStream) {
  return media;
}

export function getAudioContext() {
  return output;
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
  if (!el) return;
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
        addHoldVideo(stream);
      }
      for (const t of stream.getAudioTracks()) t.enabled = true;
      keepLocalAlive(stream);
      return stream;
    }
    if (!wantCamera && liveVideo.length) {
      for (const t of liveVideo) {
        t.enabled = false;
        t.stop();
        stream.removeTrack(t);
      }
      addHoldVideo(stream);
      keepLocalAlive(stream);
      return stream;
    }
    for (const t of stream.getAudioTracks()) t.enabled = true;
    keepLocalAlive(stream);
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
      if (wantCamera && !stream.getVideoTracks().some((t) => !isHoldVideo(t))) {
        addHoldVideo(stream);
      }
      keepLocalAlive(stream);
      return stream;
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error("mic blocked");
}

export function stopLocalStream() {
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
  if (speaker) {
    speaker.srcObject = null;
  }
  try {
    remoteNode?.disconnect();
  } catch {
    // already gone
  }
  remoteNode = null;
}

export async function playRemote(remote: MediaStream) {
  for (const t of remote.getTracks()) t.enabled = true;
  const audioTracks = remote.getAudioTracks().filter((t) => t.readyState === "live");
  const el = getSpeaker();
  if (el) {
    const mixed = new MediaStream([
      ...audioTracks,
      ...remote.getVideoTracks().filter((t) => t.readyState === "live"),
    ]);
    if (el.srcObject !== remote && el.srcObject !== mixed) {
      el.srcObject = audioTracks.length ? mixed : remote;
    }
    kickPlay(el);
  }
  try {
    output ??= new AudioContext();
    if (output.state === "suspended") await output.resume();
    if (remoteNode) {
      try {
        remoteNode.disconnect();
      } catch {
        // already gone
      }
    }
    if (!audioTracks.length) return;
    const audioOnly = new MediaStream(audioTracks);
    remoteNode = output.createMediaStreamSource(audioOnly);
    remoteNode.connect(output.destination);
  } catch {
    // element path is enough on most browsers
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
