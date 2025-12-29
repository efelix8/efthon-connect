import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ConnectionType = "direct" | "stun" | "turn" | "unknown";

interface Peer {
  id: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
  connectionType?: ConnectionType;
  nickname?: string;
}

interface SignalMessage {
  type: "offer" | "answer" | "ice-candidate" | "join" | "leave" | "screen-share-start" | "screen-share-stop";
  from: string;
  to?: string;
  payload?: RTCSessionDescriptionInit | RTCIceCandidateInit;
  nickname?: string;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    // STUN servers
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun.relay.metered.ca:80" },
    // Free TURN servers from Open Relay Project
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
  iceCandidatePoolSize: 10,
};

export const useVideoCall = (roomSlug: string, userId: string | undefined, userNickname?: string) => {
  const [isInCall, setIsInCall] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<"excellent" | "good" | "poor" | "unknown">("unknown");
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const peersRef = useRef<Map<string, Peer>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const userIdRef = useRef<string | undefined>(userId);
  const userNicknameRef = useRef<string | undefined>(userNickname);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Keep refs in sync
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    screenStreamRef.current = screenStream;
  }, [screenStream]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    userNicknameRef.current = userNickname;
  }, [userNickname]);

  // Monitor connection quality
  const updateConnectionQuality = useCallback(() => {
    peersRef.current.forEach((peer) => {
      peer.connection.getStats().then((stats) => {
        stats.forEach((report) => {
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            const rtt = report.currentRoundTripTime;
            if (rtt !== undefined) {
              if (rtt < 0.1) {
                setConnectionQuality("excellent");
              } else if (rtt < 0.3) {
                setConnectionQuality("good");
              } else {
                setConnectionQuality("poor");
              }
            }
          }
        });
      });
    });
  }, []);

  const detectConnectionType = useCallback((pc: RTCPeerConnection, peerId: string) => {
    pc.getStats().then((stats) => {
      stats.forEach((report) => {
        if (report.type === "candidate-pair" && report.state === "succeeded") {
          const localCandidateId = report.localCandidateId;
          const remoteCandidateId = report.remoteCandidateId;
          
          stats.forEach((candidateReport) => {
            if (candidateReport.id === localCandidateId || candidateReport.id === remoteCandidateId) {
              let connectionType: ConnectionType = "unknown";
              const candidateType = candidateReport.candidateType;
              
              if (candidateType === "host") {
                connectionType = "direct";
              } else if (candidateType === "srflx" || candidateType === "prflx") {
                connectionType = "stun";
              } else if (candidateType === "relay") {
                connectionType = "turn";
              }
              
              console.log(`Connection type for ${peerId}: ${connectionType} (${candidateType})`);
              
              const peer = peersRef.current.get(peerId);
              if (peer && peer.connectionType !== connectionType) {
                peer.connectionType = connectionType;
                peersRef.current.set(peerId, peer);
                setPeers(new Map(peersRef.current));
              }
            }
          });
        }
      });
    });
  }, []);

  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    console.log(`Creating peer connection for ${peerId}`);
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        console.log(`Sending ICE candidate to ${peerId}`);
        channelRef.current.send({
          type: "broadcast",
          event: "signal",
          payload: {
            type: "ice-candidate",
            from: userIdRef.current,
            to: peerId,
            payload: event.candidate.toJSON(),
          } as SignalMessage,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log(`Received track from ${peerId}`, event.streams);
      const peer = peersRef.current.get(peerId);
      if (peer) {
        peer.stream = event.streams[0];
        peersRef.current.set(peerId, peer);
        setPeers(new Map(peersRef.current));
        console.log(`Updated peer ${peerId} with stream`, peer.stream);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state for ${peerId}: ${pc.connectionState}`);
      if (pc.connectionState === "connected") {
        // Check connection type after connection is established
        setTimeout(() => detectConnectionType(pc, peerId), 1000);
        toast.success(`${peerId.slice(0, 4)} bağlandı`);
      }
      if (pc.connectionState === "failed") {
        toast.error(`${peerId.slice(0, 4)} ile bağlantı başarısız`);
        // Try to reconnect
        handleReconnect(peerId);
      }
      if (pc.connectionState === "disconnected") {
        toast.warning(`${peerId.slice(0, 4)} bağlantısı kesildi`);
        // Give it a moment to recover before removing
        setTimeout(() => {
          const currentPeer = peersRef.current.get(peerId);
          if (currentPeer && currentPeer.connection.connectionState === "disconnected") {
            removePeer(peerId);
          }
        }, 5000);
      }
    };

    pc.onnegotiationneeded = () => {
      console.log(`Negotiation needed for ${peerId}`);
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state for ${peerId}: ${pc.iceConnectionState}`);
    };

    return pc;
  }, []);

  const removePeer = useCallback((peerId: string) => {
    console.log(`Removing peer ${peerId}`);
    const peer = peersRef.current.get(peerId);
    if (peer) {
      peer.connection.close();
      peersRef.current.delete(peerId);
      setPeers(new Map(peersRef.current));
      toast.info(`${peerId.slice(0, 4)} ayrıldı`);
    }
  }, []);

  const handleReconnect = useCallback(async (peerId: string) => {
    console.log(`Attempting to reconnect with ${peerId}`);
    setIsReconnecting(true);
    
    // Remove old connection
    const oldPeer = peersRef.current.get(peerId);
    if (oldPeer) {
      oldPeer.connection.close();
      peersRef.current.delete(peerId);
    }
    
    // Create new connection after a short delay
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (channelRef.current && userIdRef.current) {
        // Re-announce presence to trigger new connection
        channelRef.current.send({
          type: "broadcast",
          event: "signal",
          payload: {
            type: "join",
            from: userIdRef.current,
            nickname: userNicknameRef.current,
          } as SignalMessage,
        });
      }
      setIsReconnecting(false);
    }, 2000);
  }, []);

  const handleSignal = useCallback(async (message: SignalMessage) => {
    const currentUserId = userIdRef.current;
    const currentLocalStream = localStreamRef.current;
    
    if (!currentUserId || message.from === currentUserId) return;
    if (message.to && message.to !== currentUserId) return;

    console.log(`Handling signal: ${message.type} from ${message.from}`);

    switch (message.type) {
      case "join": {
        // New peer joined, create offer
        let peer = peersRef.current.get(message.from);
        if (!peer) {
          const pc = createPeerConnection(message.from);
          peer = { id: message.from, connection: pc };
          peersRef.current.set(message.from, peer);
        }

        // Add local tracks
        if (currentLocalStream) {
          console.log("Adding local tracks to peer connection for join");
          currentLocalStream.getTracks().forEach((track) => {
            const senders = peer!.connection.getSenders();
            if (!senders.find(s => s.track === track)) {
              peer!.connection.addTrack(track, currentLocalStream);
            }
          });
        } else {
          console.warn("No local stream available when handling join");
        }

        // Create and send offer
        const offer = await peer.connection.createOffer();
        await peer.connection.setLocalDescription(offer);

        channelRef.current?.send({
          type: "broadcast",
          event: "signal",
          payload: {
            type: "offer",
            from: currentUserId,
            to: message.from,
            payload: offer,
          } as SignalMessage,
        });
        setPeers(new Map(peersRef.current));
        break;
      }

      case "offer": {
        let peer = peersRef.current.get(message.from);
        if (!peer) {
          const pc = createPeerConnection(message.from);
          peer = { id: message.from, connection: pc };
          peersRef.current.set(message.from, peer);
        }

        // Add local tracks before setting remote description
        if (currentLocalStream) {
          console.log("Adding local tracks to peer connection for offer");
          currentLocalStream.getTracks().forEach((track) => {
            const senders = peer!.connection.getSenders();
            if (!senders.find(s => s.track === track)) {
              peer!.connection.addTrack(track, currentLocalStream);
            }
          });
        } else {
          console.warn("No local stream available when handling offer");
        }

        await peer.connection.setRemoteDescription(new RTCSessionDescription(message.payload as RTCSessionDescriptionInit));
        const answer = await peer.connection.createAnswer();
        await peer.connection.setLocalDescription(answer);

        channelRef.current?.send({
          type: "broadcast",
          event: "signal",
          payload: {
            type: "answer",
            from: currentUserId,
            to: message.from,
            payload: answer,
          } as SignalMessage,
        });
        setPeers(new Map(peersRef.current));
        break;
      }

      case "answer": {
        const peer = peersRef.current.get(message.from);
        if (peer && peer.connection.signalingState !== "stable") {
          console.log("Setting remote description from answer");
          await peer.connection.setRemoteDescription(new RTCSessionDescription(message.payload as RTCSessionDescriptionInit));
        }
        break;
      }

      case "ice-candidate": {
        const peer = peersRef.current.get(message.from);
        if (peer && message.payload) {
          try {
            console.log("Adding ICE candidate");
            await peer.connection.addIceCandidate(new RTCIceCandidate(message.payload as RTCIceCandidateInit));
          } catch (e) {
            console.error("Error adding ICE candidate:", e);
          }
        }
        break;
      }

      case "leave": {
        removePeer(message.from);
        break;
      }
    }
  }, [createPeerConnection, removePeer]);

  const joinCall = useCallback(async () => {
    if (!userId || !roomSlug) return;

    try {
      console.log("Joining call...");
      toast.loading("Kamera ve mikrofon açılıyor...", { id: "join-call" });
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      
      // Set both state and ref immediately
      localStreamRef.current = stream;
      setLocalStream(stream);
      console.log("Local stream obtained:", stream.getTracks());

      // Set up signaling channel
      const channel = supabase.channel(`video-call-${roomSlug}`);
      channelRef.current = channel;

      channel
        .on("broadcast", { event: "signal" }, ({ payload }) => {
          handleSignal(payload as SignalMessage);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            console.log("Subscribed to video call channel");
            toast.success("Görüntülü aramaya katıldın!", { id: "join-call" });
            // Small delay to ensure everything is set up
            setTimeout(() => {
              channel.send({
                type: "broadcast",
                event: "signal",
                payload: {
                  type: "join",
                  from: userId,
                  nickname: userNickname,
                } as SignalMessage,
              });
            }, 100);
          }
        });

      // Start connection quality monitoring
      statsIntervalRef.current = setInterval(updateConnectionQuality, 5000);

      setIsInCall(true);
    } catch (error) {
      console.error("Error joining call:", error);
      toast.error("Kamera veya mikrofon erişimi başarısız. Lütfen izinleri kontrol edin.", { id: "join-call" });
    }
  }, [userId, roomSlug, handleSignal, userNickname, updateConnectionQuality]);

  const startScreenShare = useCallback(async () => {
    if (!channelRef.current || !userIdRef.current) return;

    try {
      toast.loading("Ekran paylaşımı başlatılıyor...", { id: "screen-share" });
      
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      });

      screenStreamRef.current = screen;
      setScreenStream(screen);
      setIsScreenSharing(true);

      // Replace video track in all peer connections
      const videoTrack = screen.getVideoTracks()[0];
      
      peersRef.current.forEach((peer) => {
        const sender = peer.connection.getSenders().find(s => s.track?.kind === "video");
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });

      // Listen for screen share end
      videoTrack.onended = () => {
        stopScreenShare();
      };

      // Notify others
      channelRef.current.send({
        type: "broadcast",
        event: "signal",
        payload: {
          type: "screen-share-start",
          from: userIdRef.current,
        } as SignalMessage,
      });

      toast.success("Ekran paylaşımı başlatıldı!", { id: "screen-share" });
    } catch (error) {
      console.error("Error starting screen share:", error);
      toast.error("Ekran paylaşımı başlatılamadı.", { id: "screen-share" });
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
    }

    // Replace with camera video track
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      peersRef.current.forEach((peer) => {
        const sender = peer.connection.getSenders().find(s => s.track?.kind === "video");
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack);
        }
      });
    }

    setIsScreenSharing(false);

    if (channelRef.current && userIdRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "signal",
        payload: {
          type: "screen-share-stop",
          from: userIdRef.current,
        } as SignalMessage,
      });
    }

    toast.info("Ekran paylaşımı durduruldu.");
  }, []);

  const leaveCall = useCallback(() => {
    console.log("Leaving call...");

    // Clear intervals
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Notify others
    if (channelRef.current && userIdRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "signal",
        payload: {
          type: "leave",
          from: userIdRef.current,
        } as SignalMessage,
      });
    }

    // Clean up peers
    peersRef.current.forEach((peer) => {
      peer.connection.close();
    });
    peersRef.current.clear();
    setPeers(new Map());

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Stop screen share
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
    }

    // Unsubscribe from channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setIsInCall(false);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setConnectionQuality("unknown");
    setIsReconnecting(false);
    
    toast.info("Görüntülü aramadan ayrıldın.");
  }, []);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  }, [isVideoOff]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      peersRef.current.forEach((peer) => {
        peer.connection.close();
      });
    };
  }, []);

  return {
    isInCall,
    localStream,
    screenStream,
    isScreenSharing,
    peers,
    isMuted,
    isVideoOff,
    connectionQuality,
    isReconnecting,
    joinCall,
    leaveCall,
    toggleMute,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
  };
};
