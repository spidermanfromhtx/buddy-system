import { useEffect, useRef, useState } from "react";
import { Btn } from "@/components/btn";
import {
  currentStream,
  getLocalStream,
  hasLiveMic,
  hearPcm,
  isRealVideo,
  micHint,
  onPcmOut,
  playRemote,
  unlockOutput,
} from "@/lib/media";
import { P2PRoom, loadIceServers, type PeerInfo } from "@/lib/multiplayer";
import { startJpegSend } from "@/lib/wire-media";

function MicMeter({ stream }: { stream: MediaStream | null }) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!stream) return;
    let raf = 0;
    let ctx: AudioContext | null = null;
    let src: MediaStreamAudioSourceNode | null = null;
    (async () => {
      ctx = new AudioContext();
      if (ctx.state === "suspended") await ctx.resume();
      src = ctx.createMediaStreamSource(stream);
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
      void ctx?.close();
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
  const jpegRef = useRef<HTMLImageElement>(null);
  const jpegUrl = useRef<string | null>(null);
  const [local, setLocal] = useState<MediaStream | null>(currentStream());
  const [status, setStatus] = useState(hasLiveMic() ? "joining" : "need-mic");
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [err, setErr] = useState("");
  const [remoteVideo, setRemoteVideo] = useState(false);
  const [remoteJpeg, setRemoteJpeg] = useState(false);
  const [localCam, setLocalCam] = useState(false);

  function showLocal(media: MediaStream) {
    const el = localVideoRef.current;
    const video = media.getVideoTracks().some(isRealVideo);
    setLocalCam(video);
    if (!el) return;
    el.srcObject = video ? media : null;
    if (video) void el.play().catch(() => {});
  }

  function showRemote(remote: MediaStream) {
    for (const t of remote.getTracks()) t.enabled = true;
    const real = remote.getVideoTracks().some(isRealVideo);
    setRemoteVideo(real);
    const el = remoteVideoRef.current;
    if (el) {
      el.srcObject = real ? remote : null;
      el.muted = true;
      if (real) void el.play().catch(() => {});
    }
    void playRemote(remote);
  }

  async function start() {
    setErr("");
    setStatus("joining");
    try {
      const media = await getLocalStream(false, loopback);
      setLocal(media);
      showLocal(media);
      await unlockOutput();
      if (loopback) {
        setStatus("demo");
        return;
      }
      const iceServers = await loadIceServers();
      p2pRef.current?.close(false);
      const p2p = new P2PRoom({
        room,
        selfId,
        name,
        mediaStream: media,
        iceServers,
        onPeersChanged: (list) => {
          setPeers(list);
          const live = list.find((p) => p.connectionState === "connected" || p.voice);
          setStatus(live ? "connected" : list.length ? "connecting" : "waiting");
        },
        onRemoteStream: (_id, remote) => {
          showRemote(remote);
          for (const t of remote.getTracks()) {
            t.onunmute = () => showRemote(remote);
            t.onmute = () => showRemote(remote);
            t.onended = () => showRemote(remote);
          }
        },
        onMediaData: (_id, data) => {
          hearPcm(data);
          const view = new DataView(data);
          if (view.byteLength > 2 && view.getUint8(0) === 1) {
            const blob = new Blob([data.slice(1)], { type: "image/jpeg" });
            const url = URL.createObjectURL(blob);
            if (jpegUrl.current) URL.revokeObjectURL(jpegUrl.current);
            jpegUrl.current = url;
            if (jpegRef.current) jpegRef.current.src = url;
            setRemoteJpeg(true);
          }
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

  const liveCam = wantCamera && (loopback || status === "connected");
  const lastCam = useRef(false);
  useEffect(() => {
    if (lastCam.current === liveCam) return;
    lastCam.current = liveCam;
    void (async () => {
      try {
        const media = await getLocalStream(liveCam, loopback);
        setLocal(media);
        showLocal(media);
        p2pRef.current?.attachMedia(media);
      } catch {
        // stay on current stream
      }
    })();
  }, [liveCam, loopback]);

  useEffect(() => {
    if (!liveCam) return;
    const el = localVideoRef.current;
    if (!el) return;
    const send = (buf: ArrayBuffer) => p2pRef.current?.sendMedia(buf);
    const stop = startJpegSend(el, send);
    return () => stop();
  }, [liveCam, local]);

  const showStage = localCam || remoteVideo || remoteJpeg;

  return (
    <div className="flex flex-col items-center gap-3">
      {showStage ? (
        <div className="relative aspect-square w-full max-w-xs">
          <video
            ref={remoteVideoRef}
            className={
              remoteVideo
                ? "size-full rounded-3xl bg-paper-2 object-cover"
                : "pointer-events-none absolute h-px w-px"
            }
            autoPlay
            playsInline
            muted
          />
          <img
            ref={jpegRef}
            alt=""
            className={
              remoteJpeg && !remoteVideo
                ? "size-full rounded-3xl bg-paper-2 object-cover"
                : "hidden"
            }
          />
          {localCam && !remoteVideo && !remoteJpeg ? (
            <p className="flex size-full items-center justify-center rounded-3xl bg-paper-2 text-sm text-muted">
              waiting for video
            </p>
          ) : null}
          <video
            ref={localVideoRef}
            className={
              localCam
                ? "absolute bottom-3 right-3 h-24 w-24 rounded-2xl bg-night object-cover"
                : "pointer-events-none absolute h-px w-px"
            }
            autoPlay
            playsInline
            muted
          />
        </div>
      ) : (
        <>
          <video ref={remoteVideoRef} className="pointer-events-none hidden" autoPlay playsInline muted />
          <video ref={localVideoRef} className="pointer-events-none hidden" autoPlay playsInline muted />
        </>
      )}
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
      <MicMeter stream={local} />
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
