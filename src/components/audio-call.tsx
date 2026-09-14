import { useEffect, useRef, useState } from "react";
import { Btn } from "@/components/btn";
import { currentStream, getLocalStream, hasLiveMic, isMicMuted, isRealVideo, micHint, micLevel, onPcmOut, setMicMuted, unlockOutput } from "@/lib/media";
import { P2PRoom, loadIceServers, type PeerInfo } from "@/lib/multiplayer";

function MicMeter({ active }: { active: boolean }) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!active) { setLevel(0); return; }
    let raf = 0;
    const tick = () => { setLevel(micLevel()); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return <div className="mt-3 flex h-8 items-end justify-center gap-1" aria-label="mic level">{[0,1,2,3,4].map((i) => <span key={i} className="w-2 bg-rust" style={{ height: `${8 + Math.max(0, level - i * 0.16) * 24}px`, opacity: level > i * 0.14 ? 1 : 0.2 }} />)}</div>;
}

export function AudioCall({ room, selfId, name, wantCamera, allowCamera = false, onCamera, loopback = false, onCallConnected }: { room: string; selfId: string; name: string; wantCamera: boolean; allowCamera?: boolean; onCamera?: (on: boolean) => void; loopback?: boolean; onCallConnected?: () => void; }) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const p2pRef = useRef<P2PRoom | null>(null);
  const mediaStartedRef = useRef(false);
  const startingMediaRef = useRef(false);
  const callConnectedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const pcmNextRef = useRef(0);
  const [local, setLocal] = useState<MediaStream | null>(currentStream());
  const [status, setStatus] = useState(hasLiveMic() ? "joining" : "waiting");
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [err, setErr] = useState("");
  const [remoteAudioState, setRemoteAudioState] = useState<"none" | "track" | "playing">("none");
  const [remoteVideo, setRemoteVideo] = useState(false);
  const [localCam, setLocalCam] = useState(false);
  const [muted, setMuted] = useState(isMicMuted);

  async function ensureAudioContext() {
    try {
      audioCtxRef.current ??= new AudioContext();
      if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();
      return audioCtxRef.current.state === "running" ? audioCtxRef.current : null;
    } catch { return null; }
  }

  function playPcm(data: ArrayBuffer) {
    const view = new DataView(data);
    if (view.byteLength < 10 || view.getUint8(0) !== 0) return;
    void ensureAudioContext().then((ctx) => {
      if (!ctx) return;
      const rate = view.getUint32(4, true) || 16000;
      const pcm = new Int16Array(data.slice(8));
      if (!pcm.length) return;
      const buffer = ctx.createBuffer(1, pcm.length, rate);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < pcm.length; i++) channel[i] = (pcm[i] ?? 0) / 32768;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      const now = ctx.currentTime;
      const start = Math.max(now + 0.01, pcmNextRef.current);
      source.start(start);
      pcmNextRef.current = start + buffer.duration;
      setRemoteAudioState("playing");
    });
  }

  function showLocal(media: MediaStream) {
    const video = media.getVideoTracks().some(isRealVideo);
    setLocalCam(video);
    const el = localVideoRef.current;
    if (!el) return;
    if (el.srcObject !== media) el.srcObject = media;
    el.muted = true; el.playsInline = true;
    if (video) void el.play().catch(() => {});
  }

  function showRemote(remote: MediaStream) {
    const video = remoteVideoRef.current;
    if (video) {
      const tracks = remote.getVideoTracks();
      if (tracks.length) {
        const next = new MediaStream(tracks);
        video.srcObject = next;
        video.muted = true; video.playsInline = true; video.autoplay = true;
        void video.play().catch(() => {});
        video.onloadedmetadata = () => { if (video.videoWidth > 16) setRemoteVideo(true); };
      }
    }
    if (remote.getAudioTracks().length) {
      setRemoteAudioState("track");
      void ensureAudioContext();
    }
  }

  async function activateMedia() {
    if (mediaStartedRef.current || startingMediaRef.current || !p2pRef.current) return;
    startingMediaRef.current = true;
    try {
      const media = await getLocalStream(Boolean(allowCamera && wantCamera), loopback);
      mediaStartedRef.current = true;
      setLocal(media); showLocal(media);
      await unlockOutput();
      p2pRef.current.attachMedia(media);
    } catch (e) {
      setErr(micHint(e)); setStatus("need-mic");
    } finally { startingMediaRef.current = false; }
  }

  async function start() {
    setErr(""); setStatus("waiting");
    try {
      const iceServers = await loadIceServers();
      p2pRef.current?.close(false);
      const p2p = new P2PRoom({
        room, selfId, name, allowVideo: allowCamera, iceServers,
        onPeersChanged: (list) => {
          setPeers(list);
          const connected = list.some((p) => p.connectionState === "connected");
          setStatus(connected ? "connected" : list.length ? "connecting" : "waiting");
          if (list.length && !mediaStartedRef.current) void activateMedia();
          if (!callConnectedRef.current && connected) {
            callConnectedRef.current = true;
            onCallConnected?.();
          }
        },
        onRemoteStream: (_id, remote) => showRemote(remote),
        onMediaData: (_id, data) => {
          const view = new DataView(data);
          if (view.byteLength >= 10 && view.getUint8(0) === 0) { playPcm(data); return; }
        },
        onConnected: () => setStatus((s) => (s === "waiting" ? "waiting" : s)),
      });
      p2pRef.current = p2p;
      await p2p.join();
    } catch (e) { setErr(micHint(e)); setStatus("need-mic"); }
  }

  useEffect(() => onPcmOut((buf) => p2pRef.current?.sendMedia(buf)), []);

  useEffect(() => {
    if (loopback) {
      void (async () => {
        try {
          const media = await getLocalStream(Boolean(allowCamera && wantCamera), true);
          mediaStartedRef.current = true; setLocal(media); showLocal(media); await unlockOutput();
          const el = remoteVideoRef.current; if (el) { el.srcObject = media; el.muted = true; void el.play().catch(() => {}); }
          setRemoteVideo(media.getVideoTracks().some(isRealVideo)); setStatus("demo");
        } catch (e) { setErr(micHint(e)); setStatus("need-mic"); }
      })();
    } else void start();
    return () => { p2pRef.current?.close(false); p2pRef.current = null; if (audioCtxRef.current) { void audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, selfId, loopback]);

  useEffect(() => {
    const retry = () => { void unlockOutput(); void ensureAudioContext(); };
    window.addEventListener("pointerdown", retry, { passive: true });
    window.addEventListener("keydown", retry);
    return () => { window.removeEventListener("pointerdown", retry); window.removeEventListener("keydown", retry); };
  }, []);

  const lastCam = useRef(Boolean(allowCamera && wantCamera));
  useEffect(() => {
    if (!allowCamera || lastCam.current === wantCamera || !mediaStartedRef.current) return;
    lastCam.current = wantCamera;
    void (async () => {
      try { const media = await getLocalStream(wantCamera, loopback); setLocal(media); showLocal(media); p2pRef.current?.attachMedia(media); } catch {}
    })();
  }, [wantCamera, allowCamera, loopback]);

  const showStage = Boolean(allowCamera);
  return <div className="flex flex-col items-center gap-3">
    <div className={showStage ? "relative aspect-square w-full max-w-xs" : "contents"}>
      <video ref={remoteVideoRef} className={remoteVideo ? "size-full rounded-3xl bg-paper-2 object-cover" : "pointer-events-none fixed bottom-2 left-2 h-8 w-8 opacity-[0.04]"} autoPlay playsInline muted />
      {localCam && !remoteVideo && showStage ? <p className="flex size-full items-center justify-center rounded-3xl bg-paper-2 text-sm text-muted">waiting for video</p> : null}
      <video ref={localVideoRef} className={localCam ? "absolute bottom-3 right-3 h-24 w-24 rounded-2xl bg-night object-cover" : "pointer-events-none absolute h-px w-px opacity-0"} autoPlay playsInline muted />
    </div>
    {allowCamera && (status === "connected" || status === "connecting") ? <div className="flex w-full gap-2"><Btn type="button" kind={!wantCamera ? "ink" : "line"} className="flex-1" onClick={() => onCamera?.(false)}>Camera off</Btn><Btn type="button" kind={wantCamera ? "ink" : "line"} className="flex-1" onClick={() => onCamera?.(true)}>Camera on</Btn></div> : null}
    <button type="button" aria-pressed={muted} aria-label={muted ? "unmute microphone" : "mute microphone"} className={`h-12 w-full rounded-2xl border text-sm font-medium transition ${muted ? "border-paper/30 bg-paper/10 text-paper" : "border-paper/10 bg-paper text-ink"}`} onClick={() => { const next = !muted; setMicMuted(next); p2pRef.current?.setSendAudio(!next); setMuted(next); }}>{muted ? "muted" : "mute"}</button>
    <MicMeter active={!muted && !!local} />
    {remoteAudioState === "track" ? <p className="text-xs text-muted">remote mic connected · audio output starting</p> : null}
    {remoteAudioState === "playing" ? <p className="text-xs text-muted">hearing remote audio</p> : null}
    <p className="text-sm text-muted">{err || (status === "connected" ? `live · ${peers.length} other` : status === "need-mic" ? "mic needed" : status)}</p>
    {status === "need-mic" ? <Btn kind="fill" className="mt-2" onClick={() => void start()}>Join the line</Btn> : <p className="text-xs text-muted">speak. the bars should move.</p>}
  </div>;
}
