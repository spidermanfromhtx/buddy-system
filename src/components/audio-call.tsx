import { useEffect, useRef, useState } from "react";
import { Btn } from "@/components/btn";
import {
  currentStream,
  getAudioContext,
  getLocalStream,
  hasLiveMic,
  hearPcm,
  isMicMuted,
  isRealVideo,
  micHint,
  onPcmOut,
  playRemote,
  setMicMuted,
  unlockOutput,
} from "@/lib/media";
import { P2PRoom, loadIceServers, type PeerInfo } from "@/lib/multiplayer";

function MicMeter({ stream }: { stream: MediaStream | null }) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!stream) return;
    const audio = stream.getAudioTracks().find((t) => t.readyState === "live");
    if (!audio) return;
    let raf = 0;
    let src: MediaStreamAudioSourceNode | null = null;
    let own: AudioContext | null = null;
    (async () => {
      let ctx = getAudioContext();
      if (!ctx) {
        own = new AudioContext();
        ctx = own;
      }
      if (ctx.state === "suspended") await ctx.resume();
      src = ctx.createMediaStreamSource(new MediaStream([audio]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) {
          const n = (v - 128) / 128;
          sum += n * n;
        }
        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 6));
        raf = requestAnimationFrame(tick);
      };
      tick();
    })().catch(() => {});
    return () => {
      cancelAnimationFrame(raf);
      src?.disconnect();
      void own?.close();
    };
  }, [stream]);
  return (
    <div className="mt-3 flex h-8 items-end justify-center gap-1" aria-label="mic level">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-2 bg-rust"
          style={{
            height: `${8 + Math.max(0, level - i * 0.16) * 24}px`,
            opacity: level > i * 0.14 ? 1 : 0.2,
          }}
        />
      ))}
    </div>
  );
}

export function AudioCall({
  room,
  selfId,
  name,
  wantCamera,
  allowCamera = false,
  onCamera,
  loopback = false,
}: {
  room: string;
  selfId: string;
  name: string;
  wantCamera: boolean;
  allowCamera?: boolean;
  onCamera?: (on: boolean) => void;
  loopback?: boolean;
}) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const p2pRef = useRef<P2PRoom | null>(null);
  const [local, setLocal] = useState<MediaStream | null>(currentStream());
  const [status, setStatus] = useState(hasLiveMic() ? "joining" : "need-mic");
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [err, setErr] = useState("");
  const [remoteVideo, setRemoteVideo] = useState(false);
  const [localCam, setLocalCam] = useState(false);
  const [muted, setMuted] = useState(isMicMuted);

  function showLocal(media: MediaStream) {
    const video = media.getVideoTracks().some(isRealVideo);
    setLocalCam(video);
    const el = localVideoRef.current;
    if (!el) return;
    if (el.srcObject !== media) el.srcObject = media;
    el.muted = true;
    el.playsInline = true;
    if (video) void el.play().catch(() => {});
  }

  function showRemote(remote: MediaStream) {
    void playRemote(remote);
    const el = remoteVideoRef.current;
    if (el) {
      if (el.srcObject !== remote) el.srcObject = remote;
      el.muted = true;
      el.playsInline = true;
      el.autoplay = true;
      void el.play().catch(() => {});
      el.onloadedmetadata = () => {
        setRemoteVideo(el.videoWidth > 16);
      };
    }
    setRemoteVideo(remote.getVideoTracks().some((t) => t.readyState !== "ended"));
  }

  async function start() {
    setErr("");
    setStatus("joining");
    try {
      const media = await getLocalStream(Boolean(allowCamera && wantCamera), loopback);
      setLocal(media);
      showLocal(media);
      await unlockOutput();
      if (loopback) {
        setStatus("demo");
        const el = remoteVideoRef.current;
        if (el) {
          el.srcObject = media;
          el.muted = true;
          void el.play().catch(() => {});
        }
        setRemoteVideo(media.getVideoTracks().some(isRealVideo));
        return;
      }
      const iceServers = await loadIceServers();
      p2pRef.current?.close(false);
      const p2p = new P2PRoom({
        room,
        selfId,
        name,
        mediaStream: media,
        allowVideo: allowCamera,
        iceServers,
        onPeersChanged: (list) => {
          setPeers(list);
          const live = list.find((p) => p.connectionState === "connected" || p.voice);
          setStatus(live ? "connected" : list.length ? "connecting" : "waiting");
        },
        onRemoteStream: (_id, remote) => {
          showRemote(remote);
        },
        onMediaData: (_id, data) => {
          hearPcm(data);
        },
        onConnected: () => setStatus((s) => (s === "joining" ? "waiting" : s)),
      });
      p2pRef.current = p2p;
      await p2p.join();
    } catch (e) {
      setErr(micHint(e));
      setStatus("need-mic");
    }
  }

  useEffect(() => {
    void start();
    return () => {
      p2pRef.current?.close(false);
      p2pRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, selfId, loopback]);

  useEffect(() => {
    return onPcmOut((buf) => p2pRef.current?.sendMedia(buf));
  }, []);

  const lastCam = useRef(Boolean(allowCamera && wantCamera));
  useEffect(() => {
    if (!allowCamera) return;
    if (lastCam.current === wantCamera) return;
    lastCam.current = wantCamera;
    void (async () => {
      try {
        const media = await getLocalStream(wantCamera, loopback);
        setLocal(media);
        showLocal(media);
        p2pRef.current?.attachMedia(media);
      } catch {
        // stay on current stream
      }
    })();
  }, [wantCamera, allowCamera, loopback]);

  const showStage = Boolean(allowCamera);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={showStage ? "relative aspect-square w-full max-w-xs" : "contents"}>
        <video
          ref={remoteVideoRef}
          className={
            remoteVideo
              ? "size-full rounded-3xl bg-paper-2 object-cover"
              : "pointer-events-none absolute left-0 top-0 h-40 w-40 opacity-0"
          }
          autoPlay
          playsInline
        />
        {localCam && !remoteVideo && showStage ? (
          <p className="flex size-full items-center justify-center rounded-3xl bg-paper-2 text-sm text-muted">
            waiting for video
          </p>
        ) : null}
        <video
          ref={localVideoRef}
          className={
            localCam
              ? "absolute bottom-3 right-3 h-24 w-24 rounded-2xl bg-night object-cover"
              : "pointer-events-none absolute h-px w-px opacity-0"
          }
          autoPlay
          playsInline
          muted
        />
      </div>
      {allowCamera && status === "connected" ? (
        <div className="flex w-full gap-2">
          <Btn type="button" kind={!wantCamera ? "ink" : "line"} className="flex-1" onClick={() => onCamera?.(false)}>
            Camera off
          </Btn>
          <Btn type="button" kind={wantCamera ? "ink" : "line"} className="flex-1" onClick={() => onCamera?.(true)}>
            Camera on
          </Btn>
        </div>
      ) : null}
      <Btn
        type="button"
        kind={muted ? "line" : "ink"}
        className="w-full"
        onClick={() => {
          const next = !muted;
          setMicMuted(next);
          p2pRef.current?.setSendAudio(!next);
          setMuted(next);
        }}
      >
        {muted ? "Mic off" : "Mic on"}
      </Btn>
      <MicMeter stream={muted ? null : local} />
      <p className="text-sm text-muted">
        {err ||
          (status === "connected"
            ? `live · ${peers.length} other`
            : status === "need-mic"
              ? "mic needed"
              : status)}
      </p>
      {status === "need-mic" ? (
        <Btn kind="fill" className="mt-2" onClick={() => void start()}>
          Join the line
        </Btn>
      ) : (
        <p className="text-xs text-muted">speak. the bars should move.</p>
      )}
    </div>
  );
}
