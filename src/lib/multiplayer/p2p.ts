/**
 * Full-mesh WebRTC rooms: one RTCPeerConnection per remote peer, signaled
 * through /api/rtc (see signaling.server.ts), game data flowing directly
 * browser-to-browser afterwards. Client-authoritative by construction — see
 * the multiplayer-p2p skill for when NOT to use this.
 *
 * Negotiation follows the "perfect negotiation" pattern: on a glare (both
 * sides offering at once) the polite peer — the lexicographically smaller id —
 * rolls back and accepts, so pairs converge without wedging.
 */

export type SignalKind = "offer" | "answer" | "ice" | "pcm" | "nudge";

/**
 * Wire contract between this client and the signaling relay the app provides
 * at /api/rtc (see signaling.server.ts). The client only needs these shapes.
 */
export interface PeerRow { id: string; name: string; }
export interface SignalRow { id: number; from: string; kind: SignalKind; payload: unknown; }
export interface RtcPollResponse { peers: PeerRow[]; signals: SignalRow[]; }

export interface PeerInfo {
  id: string;
  name: string;
  connectionState: RTCPeerConnectionState;
  candidateType: string | null;
  rttMs: number | null;
  voice: boolean;
}

export interface P2PRoomOptions {
  room: string;
  selfId: string;
  name?: string;
  iceServers?: RTCIceServer[];
  onPeersChanged?: (peers: PeerInfo[]) => void;
  onMessage?: (from: string, data: unknown, channel: "state" | "reliable") => void;
  onConnected?: () => void;
  mediaStream?: MediaStream;
  allowVideo?: boolean;
  onRemoteStream?: (peerId: string, stream: MediaStream) => void;
  onMediaData?: (peerId: string, data: ArrayBuffer) => void;
  onNudge?: () => void;
}

interface PeerSlot {
  pc: RTCPeerConnection;
  state?: RTCDataChannel;
  reliable?: RTCDataChannel;
  media?: RTCDataChannel;
  makingOffer: boolean;
  ignoreOffer: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  lastProgressAt: number;
  recoveryAttempts: number;
  terminal?: boolean;
  recreatedForOffer?: boolean;
  info: PeerInfo;
  pingSentAt?: number;
  remote: MediaStream;
}

const FAST_POLL_MS = 50;
const IDLE_POLL_MS = 250;
const PING_INTERVAL_MS = 2000;
const STALL_MS = 20_000;
const MAX_RECOVERY_ATTEMPTS = 4;
const SIGNAL_RETRY_DELAYS_MS = [250, 750];

function bufToB64(buf: ArrayBuffer) { const bytes = new Uint8Array(buf); let s = ""; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] ?? 0); return btoa(s); }
function b64ToBuf(b64: string) { const bin = atob(b64); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out.buffer; }
function asSignalPayload(payload: unknown) { if (typeof payload === "string") { try { return JSON.parse(payload) as Record<string, unknown>; } catch { return {}; } } if (payload && typeof payload === "object") return payload as Record<string, unknown>; return {}; }

export function defaultIceServers(): RTCIceServer[] {
  return [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun.cloudflare.com:3478", "stun:stun.relay.metered.ca:80"] },
    { urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:80?transport=tcp", "turn:openrelay.metered.ca:443", "turns:openrelay.metered.ca:443?transport=tcp"], username: "openrelayproject", credential: "openrelayproject" },
  ];
}
export async function loadIceServers(): Promise<RTCIceServer[]> {
  const base = defaultIceServers();
  try {
    const ttl = 86_400;
    const username = `${Math.floor(Date.now() / 1000) + ttl}:buddy`;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("openrelayprojectsecret"), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(username));
    const credential = btoa(String.fromCharCode(...new Uint8Array(sig)));
    base.push({ urls: ["turn:staticauth.openrelay.metered.ca:80", "turn:staticauth.openrelay.metered.ca:80?transport=tcp", "turn:staticauth.openrelay.metered.ca:443", "turns:staticauth.openrelay.metered.ca:443?transport=tcp"], username, credential });
  } catch {}
  return base;
}

function senderFor(pc: RTCPeerConnection, kind: string) { const live = pc.getSenders().find((s) => s.track?.kind === kind); if (live) return live; const tr = pc.getTransceivers().find((t) => (t.receiver.track?.kind ?? t.sender.track?.kind) === kind); return tr?.sender; }
function bumpVideo(sender: RTCRtpSender, track: MediaStreamTrack) {
  if (track.kind !== "video") return;
  if ("contentHint" in track) (track as MediaStreamTrack & { contentHint: string }).contentHint = "motion";
  try {
    const params = sender.getParameters();
    if (!params.encodings?.length) return;
    for (const enc of params.encodings) { enc.maxFramerate = 30; enc.scaleResolutionDownBy = 1; }
    if ("degradationPreference" in params) (params as RTCRtpSendParameters & { degradationPreference?: string }).degradationPreference = "maintain-framerate";
    void sender.setParameters(params);
  } catch {}
}

export class P2PRoom {
  private readonly opts: P2PRoomOptions;
  private readonly peers = new Map<string, PeerSlot>();
  private readonly signalQueues = new Map<string, Promise<void>>();
  private cursor = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;
  private everPolled = false;
  private lastPeersFingerprint = "";
  private sendAudio = true;

  constructor(opts: P2PRoomOptions) { this.opts = opts; }
  async join(): Promise<void> { try { await this.pollOnce(); } catch {} if (this.closed) return; this.schedulePoll(this.anyPairConnecting() ? FAST_POLL_MS : IDLE_POLL_MS); this.pingTimer = setInterval(() => { this.pingAll(); this.watchdog(); }, PING_INTERVAL_MS); }
  close(leave = true): void {
    this.closed = true; if (this.pollTimer) clearTimeout(this.pollTimer); if (this.pingTimer) clearInterval(this.pingTimer);
    for (const slot of this.peers.values()) slot.pc.close(); this.peers.clear();
    if (!leave) return;
    void fetch("/api/rtc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "leave", room: this.opts.room, peer: this.opts.selfId }), keepalive: true }).catch(() => {});
  }
  attachMedia(stream: MediaStream): void {
    this.opts.mediaStream = stream;
    for (const [peerId, slot] of this.peers) {
      this.wireLocal(slot, peerId);
      if (this.opts.selfId > peerId && slot.pc.signalingState === "stable") void this.kickOffer(slot, peerId);
    }
  }
  setSendAudio(on: boolean): void {
    this.sendAudio = on;
    for (const slot of this.peers.values()) this.wireLocal(slot, slot.info.id);
  }
  private wireLocal(slot: PeerSlot, peerId: string) {
    const stream = this.opts.mediaStream;
    if (!stream) return;
    const audio = this.sendAudio ? stream.getAudioTracks().find((t) => t.readyState === "live") ?? null : null;
    const video = this.opts.allowVideo ? stream.getVideoTracks().find((t) => t.readyState === "live") ?? null : null;
    const put = (kind: "audio" | "video", track: MediaStreamTrack | null) => {
      const sender = senderFor(slot.pc, kind);
      if (sender) {
        if (sender.track !== track) {
          void sender.replaceTrack(track).then(() => {
            if (track && kind === "video") bumpVideo(sender, track);
          });
        }
        return;
      }
      if (track) {
        slot.pc.addTransceiver(track, { direction: "sendrecv", streams: [stream] });
        if (kind === "video") void this.kickOffer(slot, peerId);
        return;
      }
      if (kind === "audio" || this.opts.allowVideo) slot.pc.addTransceiver(kind, { direction: "sendrecv" });
    };
    put("audio", audio);
    if (this.opts.allowVideo) put("video", video);
  }
  sendMedia(data: ArrayBuffer): void {
    const jpeg = data.byteLength > 0 && new DataView(data).getUint8(0) === 1;
    let viaDc = false;
    for (const slot of this.peers.values()) {
      const ch = jpeg
        ? slot.reliable?.readyState === "open"
          ? slot.reliable
          : slot.media?.readyState === "open"
            ? slot.media
            : null
        : slot.media?.readyState === "open"
          ? slot.media
          : slot.reliable?.readyState === "open"
            ? slot.reliable
            : null;
      if (!ch || ch.bufferedAmount > (jpeg ? 80_000 : 24_000)) continue;
      try {
        ch.send(data);
        viaDc = true;
      } catch {
        // closed
      }
    }
    if (viaDc) return;
    const now = Date.now();
    if (jpeg) {
      if (now - this.lastJpegAt < 120) return;
      this.lastJpegAt = now;
    } else {
      if (now - this.lastPcmAt < 50) return;
      this.lastPcmAt = now;
    }
    const payload = { a: bufToB64(data) };
    for (const id of this.peers.keys()) if (id !== this.opts.selfId) void this.sendSignal(id, "pcm", payload);
  }
  private lastPcmAt = 0; private lastJpegAt = 0;
  nudge(): void {
    this.broadcast({ t: "nudge" });
    this.send({ t: "nudge" });
    for (const id of this.peers.keys()) {
      if (id === this.opts.selfId) continue;
      void this.sendSignal(id, "nudge", { t: "nudge" });
    }
  }
  private async pushLocalTracks(slot: PeerSlot): Promise<void> {
    this.wireLocal(slot, slot.info.id);
    const stream = this.opts.mediaStream;
    const audio = this.sendAudio ? stream?.getAudioTracks().find((t) => t.readyState === "live") ?? null : null;
    const video = this.opts.allowVideo ? stream?.getVideoTracks().find((t) => t.readyState === "live") ?? null : null;
    const a = senderFor(slot.pc, "audio");
    const v = senderFor(slot.pc, "video");
    await Promise.all([
      a && a.track !== audio ? a.replaceTrack(audio) : Promise.resolve(),
      v && v.track !== video
        ? v.replaceTrack(video).then(() => {
            if (video) bumpVideo(v, video);
          })
        : Promise.resolve(),
    ]);
  }
  broadcast(data: unknown): void { const wire = JSON.stringify({ t: "d", d: data }); for (const slot of this.peers.values()) if (slot.state?.readyState === "open") slot.state.send(wire); }
  send(data: unknown, peerId?: string): void { const wire = JSON.stringify({ t: "d", d: data }); const targets = peerId ? [this.peers.get(peerId)] : [...this.peers.values()]; for (const slot of targets) if (slot?.reliable?.readyState === "open") slot.reliable.send(wire); }
  peerList(): PeerInfo[] { return [...this.peers.values()].map((s) => ({ ...s.info })); }

  private schedulePoll(delay: number): void { if (this.closed) return; if (this.pollTimer) clearTimeout(this.pollTimer); this.pollTimer = setTimeout(() => void this.poll(), delay); }
  private anyPairConnecting(): boolean { if (!this.peers.size) return false; for (const s of this.peers.values()) { if (s.terminal) continue; if (s.info.connectionState !== "connected") return true; } return false; }
  private async pollOnce(): Promise<void> {
    const params = new URLSearchParams({ room: this.opts.room, peer: this.opts.selfId, name: this.opts.name ?? "", since: String(this.cursor) });
    const res = await fetch(`/api/rtc?${params}`); if (this.closed) return; if (!res.ok) throw new Error(`signaling poll failed: ${res.status}`); const body = (await res.json()) as RtcPollResponse; if (this.closed) return;
    if (!this.everPolled) { this.everPolled = true; this.opts.onConnected?.(); }
    this.reconcileRoster(body.peers); const roster = new Set(body.peers.map((p) => p.id));
    for (const sig of body.signals) { this.cursor = Math.max(this.cursor, sig.id); await this.onSignal(sig.from, sig.kind, sig.payload, roster); if (this.closed) return; }
  }
  private async poll(): Promise<void> { if (this.closed) return; try { await this.pollOnce(); } catch {} this.schedulePoll(this.anyPairConnecting() ? FAST_POLL_MS : IDLE_POLL_MS); }
  private reconcileRoster(peers: { id: string; name: string }[]): void {
    const alive = new Set(peers.map((p) => p.id));
    for (const p of peers) { if (p.id === this.opts.selfId) continue; const existing = this.peers.get(p.id); if (existing) existing.info.name = p.name; else this.connectTo(p.id, p.name, this.opts.selfId > p.id); }
    for (const [id, slot] of this.peers) if (!alive.has(id)) { slot.pc.close(); this.peers.delete(id); }
    this.emitPeers();
  }
  private connectTo(peerId: string, name: string, initiator: boolean): PeerSlot | null {
    if (this.closed) return null;
    const pc = new RTCPeerConnection({ iceServers: this.opts.iceServers ?? defaultIceServers(), bundlePolicy: "max-bundle", iceCandidatePoolSize: 4 });
    const slot: PeerSlot = { pc, makingOffer: false, ignoreOffer: false, pendingCandidates: [], lastProgressAt: Date.now(), recoveryAttempts: 0, remote: new MediaStream(), info: { id: peerId, name, connectionState: pc.connectionState, candidateType: null, rttMs: null, voice: false } };
    this.peers.set(peerId, slot);
    pc.onicecandidate = (e) => void this.sendSignal(peerId, "ice", e.candidate ? e.candidate.toJSON() : { candidate: "" });
    pc.onconnectionstatechange = () => this.syncPair(slot); pc.oniceconnectionstatechange = () => this.syncPair(slot); pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === "gathering") slot.lastProgressAt = Date.now(); };
    pc.onnegotiationneeded = async () => {
      if (this.closed || slot.makingOffer || pc.signalingState !== "stable") return; if (!initiator && !pc.currentRemoteDescription) return;
      try { slot.makingOffer = true; const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: Boolean(this.opts.allowVideo) }); if (this.closed || pc.signalingState !== "stable") return; await pc.setLocalDescription(offer); await this.sendSignal(peerId, "offer", pc.localDescription!.toJSON()); } catch {} finally { slot.makingOffer = false; }
    };
    pc.ondatachannel = (e) => { if (e.channel.label === "media") this.attachMediaChannel(slot, e.channel); else this.attachChannel(slot, e.channel); };
    pc.ontrack = (ev) => { ev.track.enabled = true; if (!slot.remote.getTracks().some((t) => t.id === ev.track.id)) slot.remote.addTrack(ev.track); const fire = () => this.opts.onRemoteStream?.(peerId, slot.remote); fire(); ev.track.onunmute = fire; ev.track.onended = fire; };
    if (initiator) {
      this.attachChannel(slot, pc.createDataChannel("state", { ordered: false, maxRetransmits: 0 }));
      this.attachChannel(slot, pc.createDataChannel("reliable", { ordered: true }));
      this.attachMediaChannel(slot, pc.createDataChannel("media", { ordered: false, maxPacketLifeTime: 180 }));
    }
    this.wireLocal(slot, peerId);
    if (initiator) void this.kickOffer(slot, peerId);
    return slot;
  }
  private async kickOffer(slot: PeerSlot, peerId: string): Promise<void> { if (this.closed || slot.makingOffer || slot.pc.signalingState !== "stable") return; try { slot.makingOffer = true; const offer = await slot.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: Boolean(this.opts.allowVideo) }); if (this.closed || slot.pc.signalingState !== "stable") return; await slot.pc.setLocalDescription(offer); await this.sendSignal(peerId, "offer", slot.pc.localDescription!.toJSON()); } catch {} finally { slot.makingOffer = false; } }
  private attachMediaChannel(slot: PeerSlot, channel: RTCDataChannel): void { slot.media = channel; channel.binaryType = "arraybuffer"; channel.onopen = () => this.syncPair(slot); channel.onmessage = (e) => { const data = e.data; if (data instanceof ArrayBuffer) { this.opts.onMediaData?.(slot.info.id, data); return; } if (data instanceof Blob) void data.arrayBuffer().then((buf) => this.opts.onMediaData?.(slot.info.id, buf)); }; }
  private attachChannel(slot: PeerSlot, channel: RTCDataChannel): void {
    channel.binaryType = "arraybuffer"; if (channel.label === "state") slot.state = channel; else slot.reliable = channel; channel.onopen = () => this.syncPair(slot);
    channel.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) { this.opts.onMediaData?.(slot.info.id, e.data); return; }
      if (e.data instanceof Blob) { void e.data.arrayBuffer().then((buf) => this.opts.onMediaData?.(slot.info.id, buf)); return; }
      let msg: { t: string; d?: unknown }; try { msg = JSON.parse(e.data as string) as { t: string; d?: unknown }; } catch { return; }
      if (msg.t === "ping") { if (slot.state?.readyState === "open") slot.state.send(JSON.stringify({ t: "pong" })); } else if (msg.t === "pong") { if (slot.pingSentAt) { slot.info.rttMs = Math.round(performance.now() - slot.pingSentAt); slot.pingSentAt = undefined; this.emitPeers(); } } else if (msg.t === "nudge") this.opts.onNudge?.(); else this.opts.onMessage?.(slot.info.id, msg.d, channel.label === "state" ? "state" : "reliable");
    };
  }
  private async flushPendingCandidates(slot: PeerSlot): Promise<void> { while (slot.pendingCandidates.length > 0) { const candidate = slot.pendingCandidates.shift()!; try { await slot.pc.addIceCandidate(candidate); } catch (err) { if (!slot.ignoreOffer) console.warn("[p2p] addIceCandidate failed:", err); } if (this.closed) return; } }
  private async onSignal(from: string, kind: SignalKind, payload: unknown, roster: Set<string>): Promise<void> {
    if (this.closed) return; let slot = this.peers.get(from); if (!slot) { if (!roster.has(from)) return; const created = this.connectTo(from, "", false); if (!created) return; slot = created; }
    const polite = this.opts.selfId < from;
    try {
      if (kind === "pcm") { const raw = asSignalPayload(payload); const a = typeof raw.a === "string" ? raw.a : ""; if (a) { slot.info.voice = true; this.opts.onMediaData?.(from, b64ToBuf(a)); this.emitPeers(); } return; }
      if (kind === "nudge") { this.opts.onNudge?.(); return; }
      if (kind === "offer" || kind === "answer") {
        const description = asSignalPayload(payload) as unknown as RTCSessionDescriptionInit; const collision = kind === "offer" && (slot.makingOffer || slot.pc.signalingState !== "stable"); slot.ignoreOffer = !polite && collision; if (slot.ignoreOffer) return;
        try { await slot.pc.setRemoteDescription(description); } catch (err) { if (kind !== "offer" || slot.recreatedForOffer) throw err; const attempts = slot.recoveryAttempts; const name = slot.info.name; slot.pc.close(); this.peers.delete(from); const fresh = this.connectTo(from, name, false); if (!fresh) return; fresh.recoveryAttempts = attempts; fresh.recreatedForOffer = true; slot = fresh; await slot.pc.setRemoteDescription(description); }
        if (this.closed) return; await this.flushPendingCandidates(slot); if (this.closed) return;
        if (kind === "offer") { await this.pushLocalTracks(slot); const answer = await slot.pc.createAnswer(); await slot.pc.setLocalDescription(answer); if (this.closed) return; await this.sendSignal(from, "answer", slot.pc.localDescription!.toJSON()); }
      } else if (kind === "ice") {
        const candidate = asSignalPayload(payload) as unknown as RTCIceCandidateInit; if (!slot.pc.remoteDescription) { slot.pendingCandidates.push(candidate); return; } try { await slot.pc.addIceCandidate(candidate); } catch (err) { if (!slot.ignoreOffer) console.warn("[p2p] addIceCandidate failed:", err); }
      }
    } catch {}
  }
  private sendSignal(to: string, kind: SignalKind, payload: unknown): Promise<void> { const prev = this.signalQueues.get(to) ?? Promise.resolve(); const next = prev.then(() => this.postSignal(to, kind, payload)); this.signalQueues.set(to, next.catch(() => {})); return next; }
  private async postSignal(to: string, kind: SignalKind, payload: unknown): Promise<void> { for (let attempt = 0;; attempt++) { if (this.closed) return; try { const res = await fetch("/api/rtc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "signal", room: this.opts.room, from: this.opts.selfId, to, kind, payload }) }); if (res.ok) return; throw new Error(`signal POST failed: ${res.status}`); } catch (err) { if (attempt >= SIGNAL_RETRY_DELAYS_MS.length) { console.warn(`[p2p] signal ${kind} to ${to} failed after retries`, err); return; } await new Promise((r) => setTimeout(r, SIGNAL_RETRY_DELAYS_MS[attempt])); } } }
  private pingAll(): void { const wire = JSON.stringify({ t: "ping" }); for (const slot of this.peers.values()) { if (slot.state?.readyState !== "open") continue; const stale = slot.pingSentAt !== undefined && performance.now() - slot.pingSentAt > 2 * PING_INTERVAL_MS; if (slot.pingSentAt === undefined || stale) { slot.pingSentAt = performance.now(); slot.state.send(wire); } } }
  private pairIsUp(slot: PeerSlot): boolean { const ice = slot.pc.iceConnectionState; return slot.pc.connectionState === "connected" || ice === "connected" || ice === "completed"; }
  private markLive(slot: PeerSlot): void {
    slot.lastProgressAt = Date.now(); if (slot.info.connectionState === "connected") return; slot.info.connectionState = "connected";
    slot.recoveryAttempts = 0; slot.terminal = false; this.emitPeers(); void this.readCandidateType(slot); void this.pushLocalTracks(slot);
  }
  private syncPair(slot: PeerSlot): void {
    const live = slot.pc.connectionState; const ice = slot.pc.iceConnectionState;
    if (this.pairIsUp(slot)) { this.markLive(slot); return; }
    if (live === "connecting" || ice === "checking" || ice === "connected") slot.lastProgressAt = Date.now();
    if (live !== slot.info.connectionState && slot.info.connectionState !== "connected") { slot.info.connectionState = live; this.emitPeers(); }
    if (live === "failed") { try { slot.pc.restartIce(); } catch {} }
    if (live === "failed" || live === "disconnected") this.schedulePoll(FAST_POLL_MS);
  }
  private watchdog(): void {
    if (this.closed) return; const now = Date.now();
    for (const [peerId, slot] of this.peers) {
      const live = slot.pc.connectionState;
      if (this.pairIsUp(slot)) { this.markLive(slot); continue; }
      if (live !== slot.info.connectionState && slot.info.connectionState !== "connected") { slot.info.connectionState = live; this.emitPeers(); }
      if (slot.terminal || now - slot.lastProgressAt <= STALL_MS) continue;
      if (slot.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) { slot.terminal = true; this.emitPeers(); continue; }
      slot.recoveryAttempts += 1; slot.lastProgressAt = now;
      if (this.opts.selfId > peerId) { const { name } = slot.info; const attempts = slot.recoveryAttempts; slot.pc.close(); this.peers.delete(peerId); const fresh = this.connectTo(peerId, name, true); if (fresh) fresh.recoveryAttempts = attempts; this.schedulePoll(FAST_POLL_MS); }
    }
  }
  private async readCandidateType(slot: PeerSlot): Promise<void> { try { const stats = await slot.pc.getStats(); let selected: RTCIceCandidatePairStats | undefined; stats.forEach((s) => { if (s.type === "candidate-pair" && (s as RTCIceCandidatePairStats).nominated) selected = s as RTCIceCandidatePairStats; }); const localId = selected?.localCandidateId; if (localId) { const local = stats.get(localId) as { candidateType?: string } | undefined; slot.info.candidateType = local?.candidateType ?? null; this.emitPeers(); } } catch {} }
  private emitPeers(): void { const list = this.peerList(); const fingerprint = JSON.stringify(list.map((p) => [p.id, p.name, p.connectionState, p.candidateType, p.rttMs, p.voice])); if (fingerprint === this.lastPeersFingerprint) return; this.lastPeersFingerprint = fingerprint; this.opts.onPeersChanged?.(list); }
}
