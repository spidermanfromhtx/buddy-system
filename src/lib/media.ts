let stream: MediaStream | null = null;
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

function applyMute() {
  for (const t of stream?.getAudioTracks() ?? []) t.enabled = !micMuted;
}

export async function unlockOutput() {
  try {
    const ctx = new AudioContext();
    if (ctx.state === "suspended") await ctx.resume();
    const buf = ctx.createBuffer(1, 8, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start();
    void ctx.close();
  } catch {
    // call tap already unlocked audio
  }
}

export async function getLocalStream(wantCamera: boolean, _monitor = false): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("insecure");
  }
  if (stream && hasLiveMic()) {
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
      applyMute();
      return stream;
    }
    if (!wantCamera && liveVideo.length) {
      for (const t of liveVideo) {
        t.stop();
        stream.removeTrack(t);
      }
    }
    applyMute();
    return stream;
  }
  const audio: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
  const video: boolean | MediaTrackConstraints = wantCamera
    ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } }
    : false;
  const tries: MediaStreamConstraints[] = [{ audio, video }];
  if (wantCamera) tries.push({ audio: true, video: true });
  tries.push({ audio: true, video: false });
  let last: unknown;
  for (const c of tries) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(c);
      applyMute();
      return stream;
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error("mic blocked");
}

export function stopLocalStream() {
  micMuted = false;
  if (stream) {
    for (const t of stream.getTracks()) {
      t.stop();
    }
  }
  stream = null;
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
