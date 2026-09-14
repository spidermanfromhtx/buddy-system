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
  const h = track.getSettings().height;
  return track.kind === "video" && typeof w === "number" && w > 0 && w <= 32;
}

function getSpeaker() {
  if (typeof document === "undefined") return null;
  if (!speaker) {
    speaker = document.createElement("video");
    speaker.autoplay = true;
    speaker.setAttribute("playsinline", "true");
    speaker.setAttribute("webkit-playsinline", "true");
    speaker.setAttribute("autoplay", "true");
    speaker.muted = false;
    speaker.volume = 1;
    speaker.style.position = "fixed";
    speaker.style.left = "0";
    speaker.style.bottom = "0";
    speaker.style.width = "2px";
    speaker.style.height = "2px";
    speaker.style.opacity = "0.02";
    speaker.style.pointerEvents = "none";
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
    keep.setAttribute("playsinline", "true");
    keep.setAttribute("webkit-playsinline", "true");
    keep.style.cssText = "position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0;pointer-events:none";
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
  el.muted = false;
  el.volume = 1;
  try {
    if (!el.srcObject && output) {
      el.srcObject = output.createMediaStreamDestination().stream;
    }
    void el.play().catch(() => {});
  } catch {
    // Call / Answer already used the gesture
  }
}

export async function getLocalStream(wantCamera: boolean, monitor = false): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("insecure");
  }
  if (stream && hasLiveMic()) {
    const liveVideo = stream.getVideoTracks().filter((t) => t.readyState === "live" && !isHoldVideo(t));
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
        for (const t of cam.getVideoTracks()) stream.addTrack(t);
      } catch {
        addHoldVideo(stream);
      }
      keepLocalAlive(stream);
      return stream;
    }
    if (!wantCamera && liveVideo.length) {
      for (const t of liveVideo) {
        t.stop();
        stream.removeTrack(t);
      }
      addHoldVideo(stream);
      keepLocalAlive(stream);
      return stream;
    }
    if (!wantCamera) {
      addHoldVideo(stream);
      keepLocalAlive(stream);
      return stream;
    }
    if (liveVideo.length) {
      keepLocalAlive(stream);
      return stream;
    }
  }
  const audio: boolean | MediaTrackConstraints = monitor
    ? { echoCancellation: false, noiseSuppression: false, autoGainControl: true }
    : true;
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
      if (wantCamera && !stream.getVideoTracks().some((t) => !isHoldVideo(t))) {
        addHoldVideo(stream);
      }
      if (!wantCamera) addHoldVideo(stream);
      keepLocalAlive(stream);
      return stream;
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error("mic blocked");
}

export function stopLocalStream() {
  stream?.getTracks().forEach((t) => {
    t.enabled = false;
    t.stop();
  });
  stream = null;
  if (keep) {
    keep.srcObject = null;
    keep.pause();
  }
  if (speaker) {
    speaker.srcObject = null;
    speaker.pause();
  }
  try {
    remoteNode?.disconnect();
  } catch {
    // already gone
  }
  remoteNode = null;
}

export async function playRemote(remote: MediaStream) {
  const audioTracks = remote.getAudioTracks().filter((t) => t.readyState === "live");
  const audioOnly = audioTracks.length ? new MediaStream(audioTracks) : remote;
  const el = getSpeaker();
  if (el) {
    el.srcObject = audioOnly;
    el.muted = false;
    el.volume = 1;
    void el.play().catch(() => {});
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
