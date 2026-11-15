/**
 * Resonance Production-Ready 5-Person WebRTC Audio Calling Mesh Manager
 * Strict STUN-only, No TURN, No Media Servers, Perfect Negotiation Collision-Safe Mesh.
 */

export const AUDIO_STUN_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
};

export const MAX_AUDIO_PARTICIPANTS = 5;
export const AUDIO_CONNECT_TIMEOUT_MS = 15000;
export const DIRECT_AUDIO_ERROR_MSG =
  'Direct audio connection unavailable. Participants may be behind incompatible network restrictions.';

export interface PeerAudioStats {
  bitrateKbps: number;
  packetsLost: number;
  roundTripTimeMs: number;
  jitterMs: number;
  candidateType: 'host' | 'srflx' | 'prflx' | 'unknown';
}

export interface AudioParticipantInfo {
  id: string;
  name: string;
  isHost?: boolean;
  isLocal?: boolean;
  isMuted?: boolean;
  isSpeaking?: boolean;
  connectionState: RTCPeerConnectionState;
  stats?: PeerAudioStats;
}

export interface AudioRoomCallbacks {
  onEmitSignal: (targetParticipantId: string, type: string, payload: any) => void;
  onEmitMuteState: (isMuted: boolean) => void;
  onParticipantsUpdated: (participants: AudioParticipantInfo[]) => void;
  onSpeakingChanged: (speakingSet: Set<string>) => void;
  onError: (errorMsg: string) => void;
  onConnectionFailed?: (peerId: string) => void;
}

interface PeerEntry {
  peerId: string;
  peerName: string;
  pc: RTCPeerConnection;
  audioElement: HTMLAudioElement;
  pendingCandidates: RTCIceCandidateInit[];
  makingOffer: boolean;
  ignoreOffer: boolean;
  isPolite: boolean;
  connectionState: RTCPeerConnectionState;
  connectTimeout: ReturnType<typeof setTimeout> | null;
  statsInterval: ReturnType<typeof setInterval> | null;
  stats: PeerAudioStats;
  prevBytes: number;
  prevTimestamp: number;
}

export class AudioRoomManager {
  private myUserId: string;
  private myUserName: string;
  private isHost: boolean;
  private callbacks: AudioRoomCallbacks;

  private localMicStream: MediaStream | null = null;
  private isMicMuted: boolean = false;
  private peers: Map<string, PeerEntry> = new Map();

  // Web Audio API Speaking Detection
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private speechDetectionTimer: ReturnType<typeof setInterval> | null = null;
  private isLocalSpeaking: boolean = false;
  private speakingParticipants: Set<string> = new Set();

  constructor(
    myUserId: string,
    myUserName: string,
    isHost: boolean,
    callbacks: AudioRoomCallbacks
  ) {
    this.myUserId = myUserId;
    this.myUserName = myUserName;
    this.isHost = isHost;
    this.callbacks = callbacks;
  }

  /**
   * Acquire local microphone with echo cancellation, noise suppression, auto-gain
   */
  public async acquireMicrophone(): Promise<MediaStream> {
    if (this.localMicStream) {
      return this.localMicStream;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = 'Your browser does not support WebRTC audio capture.';
      this.callbacks.onError(err);
      throw new Error(err);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1, // Mono audio for high efficiency
        },
        video: false, // Strict: Never request camera or video tracks
      });

      this.localMicStream = stream;
      this.isMicMuted = false;

      // Handle microphone track ended event (e.g., unplugged)
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          this.callbacks.onError('Microphone disconnected.');
          this.setMuted(true);
        };
      });

      this.initSpeakingDetection(stream);
      return stream;
    } catch (err: any) {
      let friendlyError = 'Could not access microphone.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        friendlyError = 'Microphone permission was denied. Please allow microphone access in your browser.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        friendlyError = 'No microphone device was detected on your computer.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        friendlyError = 'Microphone is already in use by another application.';
      }
      this.callbacks.onError(friendlyError);
      throw new Error(friendlyError);
    }
  }

  /**
   * Initialize Web Audio API AnalyserNode for accurate speech detection
   */
  private initSpeakingDetection(stream: MediaStream): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      this.micSourceNode = this.audioContext.createMediaStreamSource(stream);
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.3;

      // Connect source only to analyser. NEVER connect to destination (prevents local feedback)
      this.micSourceNode.connect(this.analyserNode);

      const bufferLength = this.analyserNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      this.speechDetectionTimer = setInterval(() => {
        if (!this.analyserNode || this.isMicMuted) {
          if (this.isLocalSpeaking) {
            this.isLocalSpeaking = false;
            this.speakingParticipants.delete(this.myUserId);
            this.callbacks.onSpeakingChanged(new Set(this.speakingParticipants));
          }
          return;
        }

        this.analyserNode.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const speakingNow = average > 16; // Threshold for vocal activity

        if (speakingNow !== this.isLocalSpeaking) {
          this.isLocalSpeaking = speakingNow;
          if (speakingNow) {
            this.speakingParticipants.add(this.myUserId);
          } else {
            this.speakingParticipants.delete(this.myUserId);
          }
          this.callbacks.onSpeakingChanged(new Set(this.speakingParticipants));
        }
      }, 120);
    } catch (e) {
      console.warn('[AudioRoomManager] Web Audio speech detection unavailable:', e);
    }
  }

  /**
   * Add a peer to the full mesh topology using Perfect Negotiation Pattern
   */
  public addPeer(peerId: string, peerName: string): RTCPeerConnection {
    if (this.peers.has(peerId)) {
      return this.peers.get(peerId)!.pc;
    }

    if (this.peers.size >= MAX_AUDIO_PARTICIPANTS - 1) {
      console.warn(`[AudioRoomManager] Room mesh capacity reached (Max ${MAX_AUDIO_PARTICIPANTS} peers).`);
    }

    // Deterministic Politeness: Lexicographic tie-breaker avoids glare/collision
    const isPolite = this.myUserId < peerId;

    const pc = new RTCPeerConnection(AUDIO_STUN_CONFIG);

    // Dedicated HTML5 audio element for this remote peer (prevents duplicate playback)
    const audioElement = new Audio();
    audioElement.autoplay = true;
    (audioElement as any).playsInline = true;

    const peerEntry: PeerEntry = {
      peerId,
      peerName,
      pc,
      audioElement,
      pendingCandidates: [],
      makingOffer: false,
      ignoreOffer: false,
      isPolite,
      connectionState: 'connecting',
      connectTimeout: null,
      statsInterval: null,
      stats: {
        bitrateKbps: 0,
        packetsLost: 0,
        roundTripTimeMs: 0,
        jitterMs: 0,
        candidateType: 'unknown',
      },
      prevBytes: 0,
      prevTimestamp: Date.now(),
    };

    this.peers.set(peerId, peerEntry);

    // Attach local microphone audio track to peer connection
    if (this.localMicStream) {
      this.localMicStream.getAudioTracks().forEach((track) => {
        const sender = pc.addTrack(track, this.localMicStream!);
        // Apply 32 kbps target bitrate for speech optimization
        this.applyBitrateConstraint(sender);
      });
    }

    // Direct connection timeout detection (15s)
    peerEntry.connectTimeout = setTimeout(() => {
      if (pc.connectionState !== 'connected') {
        console.warn(`[AudioRoomManager] Peer ${peerId} timed out without direct STUN connection.`);
        peerEntry.connectionState = 'failed';
        this.callbacks.onError(DIRECT_AUDIO_ERROR_MSG);
        this.callbacks.onConnectionFailed?.(peerId);
        this.notifyParticipantsUpdated();
      }
    }, AUDIO_CONNECT_TIMEOUT_MS);

    // 1. Negotiation Needed (Perfect Negotiation)
    pc.onnegotiationneeded = async () => {
      try {
        peerEntry.makingOffer = true;
        await pc.setLocalDescription();
        this.callbacks.onEmitSignal(peerId, 'audio.offer', {
          sdp: pc.localDescription?.sdp,
          targetParticipantId: peerId,
        });
      } catch (err) {
        console.error(`[AudioRoomManager] Negotiation error with ${peerId}:`, err);
      } finally {
        peerEntry.makingOffer = false;
      }
    };

    // 2. ICE Candidates (STUN-only filtering: drop relay)
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // Enforce strict NO-TURN rule: filter out any relay candidate
        if (event.candidate.type === 'relay' || event.candidate.candidate.includes('typ relay')) {
          return;
        }
        this.callbacks.onEmitSignal(peerId, 'audio.ice_candidate', {
          candidate: event.candidate.toJSON(),
          targetParticipantId: peerId,
        });
      }
    };

    // 3. Remote Audio Track Receiver
    pc.ontrack = (event) => {
      if (event.track.kind === 'audio') {
        const remoteStream = new MediaStream([event.track]);
        audioElement.srcObject = remoteStream;
        audioElement.play().catch((playErr) => {
          console.warn(`[AudioRoomManager] Autoplay unmuted audio blocked for ${peerId}:`, playErr);
        });
      }
    };

    // 4. Connection State Monitor
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      peerEntry.connectionState = state;

      if (state === 'connected') {
        if (peerEntry.connectTimeout) {
          clearTimeout(peerEntry.connectTimeout);
          peerEntry.connectTimeout = null;
        }
        this.startPeerStatsMonitoring(peerEntry);
      } else if (state === 'failed') {
        if (peerEntry.connectTimeout) {
          clearTimeout(peerEntry.connectTimeout);
          peerEntry.connectTimeout = null;
        }
        this.callbacks.onError(DIRECT_AUDIO_ERROR_MSG);
        this.callbacks.onConnectionFailed?.(peerId);
      }

      this.notifyParticipantsUpdated();
    };

    this.notifyParticipantsUpdated();
    return pc;
  }

  /**
   * Process incoming WebRTC signaling message for this mesh peer
   */
  public async handleSignal(
    senderId: string,
    senderName: string,
    type: string,
    payload: any
  ): Promise<void> {
    let peer = this.peers.get(senderId);
    if (!peer) {
      this.addPeer(senderId, senderName || 'Guest');
      peer = this.peers.get(senderId)!;
    }

    const pc = peer.pc;

    if (type === 'audio.offer') {
      try {
        const offerCollision = peer.makingOffer || pc.signalingState !== 'stable';
        peer.ignoreOffer = !peer.isPolite && offerCollision;

        if (peer.ignoreOffer) {
          return; // Impolite peer ignores colliding offer
        }

        if (offerCollision) {
          await Promise.all([
            pc.setLocalDescription({ type: 'rollback' }),
            pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: payload.sdp })),
          ]);
        } else {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: payload.sdp }));
        }

        // Drain buffered candidates
        while (peer.pendingCandidates.length > 0) {
          const candidate = peer.pendingCandidates.shift();
          if (candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.callbacks.onEmitSignal(senderId, 'audio.answer', {
          sdp: answer.sdp,
          targetParticipantId: senderId,
        });
      } catch (err) {
        console.error(`[AudioRoomManager] Failed processing audio.offer from ${senderId}:`, err);
      }
    } else if (type === 'audio.answer') {
      try {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: payload.sdp }));

          // Drain buffered candidates
          while (peer.pendingCandidates.length > 0) {
            const candidate = peer.pendingCandidates.shift();
            if (candidate) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.error(`[AudioRoomManager] Failed processing audio.answer from ${senderId}:`, err);
      }
    } else if (type === 'audio.ice_candidate') {
      const cand = payload.candidate;
      if (!cand || cand.type === 'relay' || String(cand.candidate || '').includes('typ relay')) {
        return; // Filter out relay candidates
      }

      if (!pc.remoteDescription) {
        peer.pendingCandidates.push(cand);
      } else {
        await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
      }
    }
  }

  /**
   * Monitor peer connection stats: bitrate, RTT, packet loss, candidate type
   */
  private startPeerStatsMonitoring(peer: PeerEntry): void {
    if (peer.statsInterval) clearInterval(peer.statsInterval);
    peer.prevBytes = 0;
    peer.prevTimestamp = Date.now();

    peer.statsInterval = setInterval(async () => {
      if (peer.pc.connectionState !== 'connected') return;

      try {
        const report = await peer.pc.getStats();
        let bytesNow = 0;
        let packetsLostNow = 0;
        let rttNow = 0;
        let jitterNow = 0;
        let candidateType: PeerAudioStats['candidateType'] = 'unknown';

        report.forEach((stat) => {
          if (stat.type === 'inbound-rtp' && stat.kind === 'audio') {
            bytesNow = stat.bytesReceived || 0;
            packetsLostNow = stat.packetsLost || 0;
            jitterNow = Math.round((stat.jitter || 0) * 1000);
          } else if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
            rttNow = Math.round((stat.currentRoundTripTime || 0) * 1000);
            const localCandidate = report.get(stat.localCandidateId);
            if (localCandidate) {
              candidateType = localCandidate.candidateType || 'unknown';
            }
          }
        });

        const now = Date.now();
        const durationSec = (now - peer.prevTimestamp) / 1000;
        let bitrate = 0;
        if (durationSec > 0 && peer.prevBytes > 0 && bytesNow >= peer.prevBytes) {
          bitrate = Math.round(((bytesNow - peer.prevBytes) * 8) / durationSec / 1000);
        }
        peer.prevBytes = bytesNow;
        peer.prevTimestamp = now;

        peer.stats = {
          bitrateKbps: bitrate,
          packetsLost: packetsLostNow,
          roundTripTimeMs: rttNow,
          jitterMs: jitterNow,
          candidateType,
        };
      } catch {}
    }, 2500);
  }

  /**
   * Apply 32 kbps maxBitrate constraint via RTCRtpSender.setParameters()
   */
  private applyBitrateConstraint(sender: RTCRtpSender): void {
    if (sender && sender.getParameters) {
      try {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        params.encodings[0].maxBitrate = 32000; // 32 kbps
        sender.setParameters(params).catch(() => {});
      } catch {}
    }
  }

  /**
   * Toggle local microphone mute
   */
  public setMuted(muted: boolean): void {
    this.isMicMuted = muted;
    if (this.localMicStream) {
      this.localMicStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }

    if (muted && this.isLocalSpeaking) {
      this.isLocalSpeaking = false;
      this.speakingParticipants.delete(this.myUserId);
      this.callbacks.onSpeakingChanged(new Set(this.speakingParticipants));
    }

    this.callbacks.onEmitMuteState(muted);
    this.notifyParticipantsUpdated();
  }

  public getIsMuted(): boolean {
    return this.isMicMuted;
  }

  /**
   * Remove a single peer and release its audio resources
   */
  public removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    if (peer.connectTimeout) {
      clearTimeout(peer.connectTimeout);
      peer.connectTimeout = null;
    }
    if (peer.statsInterval) {
      clearInterval(peer.statsInterval);
      peer.statsInterval = null;
    }

    peer.pc.ontrack = null;
    peer.pc.onicecandidate = null;
    peer.pc.onnegotiationneeded = null;
    peer.pc.onconnectionstatechange = null;
    peer.pc.close();

    peer.audioElement.pause();
    peer.audioElement.srcObject = null;

    this.speakingParticipants.delete(peerId);
    this.peers.delete(peerId);
    this.notifyParticipantsUpdated();
    this.callbacks.onSpeakingChanged(new Set(this.speakingParticipants));
  }

  /**
   * Complete teardown: stop mic tracks, close AudioContext, close all peers
   */
  public leaveCall(): void {
    if (this.speechDetectionTimer) {
      clearInterval(this.speechDetectionTimer);
      this.speechDetectionTimer = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    if (this.localMicStream) {
      this.localMicStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.localMicStream = null;
    }

    this.peers.forEach((peer, peerId) => {
      this.removePeer(peerId);
    });

    this.peers.clear();
    this.speakingParticipants.clear();
    this.isLocalSpeaking = false;
    this.callbacks.onSpeakingChanged(new Set());
    this.notifyParticipantsUpdated();
  }

  /**
   * Reconnect all active peer connections
   */
  public retryConnections(): void {
    const currentPeers = Array.from(this.peers.values()).map((p) => ({
      id: p.peerId,
      name: p.peerName,
    }));
    currentPeers.forEach((p) => {
      this.removePeer(p.id);
      this.addPeer(p.id, p.name);
    });
  }

  /**
   * Publish snapshot of current audio participants
   */
  private notifyParticipantsUpdated(): void {
    const list: AudioParticipantInfo[] = [
      {
        id: this.myUserId,
        name: this.myUserName,
        isHost: this.isHost,
        isLocal: true,
        isMuted: this.isMicMuted,
        isSpeaking: this.isLocalSpeaking,
        connectionState: 'connected',
      },
    ];

    this.peers.forEach((peer) => {
      list.push({
        id: peer.peerId,
        name: peer.peerName,
        isHost: false,
        isLocal: false,
        isMuted: false,
        isSpeaking: this.speakingParticipants.has(peer.peerId),
        connectionState: peer.connectionState,
        stats: peer.stats,
      });
    });

    this.callbacks.onParticipantsUpdated(list);
  }
}
