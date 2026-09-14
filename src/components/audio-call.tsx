import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Btn } from "@/components/btn";
import {
  currentStream,
  getLocalStream,
  hasLiveMic,
  hearPcm,
  isMicMuted,
  isRealVideo,
  micHint,
  micLevel,
  onPcmOut,
  setMicMuted,
  setNativeEar,
  startScreenShare,
  unlockOutput,
} from "@/lib/media";
import { P2PRoom, loadIceServers, type PeerInfo } from "@/lib/multiplayer";
import { startJpegSend } from "@/lib/wire-media";

function MicMeter({ active }: { active: boolean }) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!active) {
      setLevel(0);
      return;
    }
    let raf = 0;
    const tick = () => {
      setLevel(micLevel());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return (
    <div className="mt-3 flex h-10 items-end justify-center gap-1.5" aria-label="mic level">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-2.5 bg-rust"
          style={{
            height: `${10 + Math.max(0, level - i * 0.16) * 28}px`,
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
  onCallConnected,
  pingRef,
  canShare = false,
  onNudge,
}: {
  room: string;
  selfId: string;
  name: string;
  wantCamera: boolean;
  allowCamera?: boolean;
  onCamera?: (on: boolean) => void;
  loopback?: boolean;
  onCallConnected?: () => void;
  pingRef?: MutableRefObject<(() => void) | null>;
  canShare?: boolean;
  onNudge?: () => void;
}) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const jpegRef = useRef<HTMLImageElement>(null);
  const jpegUrl = useRef<string | null>(null);
  const p2pRef = useRef<P2PRoom | null>(null);
  const liveRef = useRef(false);
  const [local, setLocal] = useState<MediaStream | null>(currentStream());
  const [status, setStatus] = useState(hasLiveMic() ? "joining" : "need-mic");
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [err, setErr] = useState("");
  const [remoteVideo, setRemoteVideo] = useState(false);
  const [remoteJpeg, setRemoteJpeg] = useState(false);
  const [localCam, setLocalCam] = useState(false);
  const [muted, setMuted] = useState(isMicMuted);
  const [sharing, setSharing] = useState(false);

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

  function pumpSpeaker() {
    void unlockOutput();
    const audio = remoteAudioRef.current;
    if (audio) {
      audio.muted = false;
      audio.volume = 1;
      void audio.play().catch(() => {});
    }
    const video = remoteVideoRef.current;
    if (video) void video.play().catch(() => {});
  }

  function showRemote(remote: MediaStream) {
    const video = remoteVideoRef.current;
    if (video) {
      if (video.srcObject !== remote) video.srcObject = remote;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      void video.play().catch(() => {});
      const check = () => {
        if (video.videoWidth > 2) setRemoteVideo(true);
      };
      video.onloadedmetadata = check;
      video.onresize = check;
      video.ontimeupdate = check;
      const poll = window.setInterval(check, 200);
      video.addEventListener("ended", () => window.clearInterval(poll), { once: true });
      for (const t of remote.getVideoTracks()) {
        t.enabled = true;
        t.onunmute = check;
      }
    }
    const audio = remoteAudioRef.current;
    if (audio) {
      if (audio.srcObject !== remote) audio.srcObject = remote;
      audio.muted = false;
      audio.volume = 1;
      audio.autoplay = true;
      void audio.play().catch(() => {});
      audio.onplaying = () => {
        window.setTimeout(() => {
          if (!audio.paused && audio.currentTime > 0.35) setNativeEar(true);
        }, 700);
      };
    }
    for (const t of remote.getAudioTracks()) {
      t.enabled = true;
      t.onunmute = () => pumpSpeaker();
    }
  }

  function noteLive(list: PeerInfo[]) {
    if (liveRef.current) return;
    if (!list.length) return;
    liveRef.current = true;
    onCallConnected?.();
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
        setRemoteVideo(media.getVideoTracks().some(isRealVideo));
        onCallConnected?.();
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
          setStatus(list.length ? "connected" : "waiting");
          noteLive(list);
        },
        onRemoteStream: (_id, remote) => showRemote(remote),
        onNudge: () => onNudge?.(),
        onMediaData: (_id, data) => {
          const view = new DataView(data);
          if (view.byteLength > 2 && view.getUint8(0) === 1) {
            const blob = new Blob([data.slice(1)], { type: "image/jpeg" });
            const url = URL.createObjectURL(blob);
            if (jpegUrl.current) URL.revokeObjectURL(jpegUrl.current);
            jpegUrl.current = url;
            if (jpegRef.current) jpegRef.current.src = url;
            setRemoteJpeg(true);
            return;
          }
          hearPcm(data);
        },
      });
      p2pRef.current = p2p;
      if (pingRef) pingRef.current = () => p2p.nudge();
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

  useEffect(() => {
    const resume = () => pumpSpeaker();
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);
    return () => {
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
    };
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

  useEffect(() => {
    if (!localCam) return;
    const el = localVideoRef.current;
    if (!el) return;
    return startJpegSend(
      el,
      (buf) => p2pRef.current?.sendMedia(buf),
      sharing ? { wide: 640, quality: 0.55, ms: 120 } : undefined,
    );
  }, [localCam, sharing]);

  const showStage = Boolean(allowCamera || sharing || remoteJpeg || remoteVideo);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className={showStage ? "relative aspect-square w-full max-w-sm" : "contents"}>
        <video
          ref={remoteVideoRef}
          className="relative z-0 size-full rounded-3xl bg-paper-2 object-cover"
          autoPlay
          playsInline
          muted
        />
        <audio ref={remoteAudioRef} autoPlay playsInline className="pointer-events-none fixed bottom-2 left-12 h-8 w-8 opacity-[0.04]" />
        {remoteJpeg && !remoteVideo ? (
          <img ref={jpegRef} alt="" className="absolute inset-0 z-10 size-full rounded-3xl bg-paper-2 object-cover" />
        ) : (
          <img ref={jpegRef} alt="" className="pointer-events-none absolute h-px w-px opacity-0" />
        )}
        {localCam && !remoteVideo && !remoteJpeg && showStage ? (
          <p className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-paper-2 text-base text-muted">
            waiting for video
          </p>
        ) : null}
        <video
          ref={localVideoRef}
          className={
            localCam
              ? "absolute bottom-3 right-3 z-20 h-28 w-28 rounded-2xl bg-night object-cover"
              : "pointer-events-none absolute h-px w-px opacity-0"
          }
          autoPlay
          playsInline
          muted
        />
      </div>
      {allowCamera ? (
        <div className="flex w-full gap-2">
          <Btn type="button" kind={!wantCamera ? "ink" : "line"} className="h-12 flex-1 text-base" onClick={() => onCamera?.(false)}>
            Camera off
          </Btn>
          <Btn type="button" kind={wantCamera ? "ink" : "line"} className="h-12 flex-1 text-base" onClick={() => onCamera?.(true)}>
            Camera on
          </Btn>
        </div>
      ) : null}
      <button
        type="button"
        aria-pressed={muted}
        aria-label={muted ? "unmute" : "mute"}
        className={`h-14 w-full rounded-2xl border text-lg font-medium transition ${
          muted ? "border-paper/25 bg-paper/15 text-paper" : "border-transparent bg-paper text-ink"
        }`}
        onClick={() => {
          const next = !muted;
          setMicMuted(next);
          p2pRef.current?.setSendAudio(!next);
          setMuted(next);
        }}
      >
        Mute
      </button>
      {canShare ? (
        <Btn
          type="button"
          kind={sharing ? "ink" : "line"}
          className="h-12 w-full text-base"
          onClick={() => {
            void (async () => {
              try {
                if (sharing) {
                  const media = await getLocalStream(wantCamera, loopback);
                  setLocal(media);
                  showLocal(media);
                  p2pRef.current?.attachMedia(media);
                  setSharing(false);
                  return;
                }
                const media = await startScreenShare();
                const track = media.getVideoTracks()[0];
                if (track) {
                  track.onended = () => {
                    void getLocalStream(wantCamera, loopback).then((next) => {
                      setLocal(next);
                      showLocal(next);
                      p2pRef.current?.attachMedia(next);
                      setSharing(false);
                    });
                  };
                }
                setLocal(media);
                showLocal(media);
                p2pRef.current?.attachMedia(media);
                setSharing(true);
              } catch {
                setErr("could not share the window");
              }
            })();
          }}
        >
          {sharing ? "Stop sharing" : "Share window"}
        </Btn>
      ) : null}
      <MicMeter active={!muted && !!local} />
      <p className="text-base text-muted">
        {err ||
          (status === "connected"
            ? `live · ${peers.length} other`
            : status === "need-mic"
              ? "mic needed"
              : status)}
      </p>
      {status === "need-mic" ? (
        <Btn kind="fill" className="mt-1 h-12 w-full text-base" onClick={() => void start()}>
          Join the line
        </Btn>
      ) : (
        <p className="text-sm text-muted">speak. the bars should move.</p>
      )}
    </div>
  );
}
