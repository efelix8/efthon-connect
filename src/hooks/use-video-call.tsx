import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Peer {
  id: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
}

interface SignalMessage {
  type: "offer" | "answer" | "ice-candidate" | "join" | "leave";
  from: string;
  to?: string;
  payload?: RTCSessionDescriptionInit | RTCIceCandidateInit;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export const useVideoCall = (roomSlug: string, userId: string | undefined) => {
  const [isInCall, setIsInCall] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const peersRef = useRef<Map<string, Peer>>(new Map());

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
            from: userId,
            to: peerId,
            payload: event.candidate.toJSON(),
          } as SignalMessage,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log(`Received track from ${peerId}`);
      const peer = peersRef.current.get(peerId);
      if (peer) {
        peer.stream = event.streams[0];
        peersRef.current.set(peerId, peer);
        setPeers(new Map(peersRef.current));
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state for ${peerId}: ${pc.connectionState}`);
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        removePeer(peerId);
      }
    };

    return pc;
  }, [userId]);

  const removePeer = useCallback((peerId: string) => {
    console.log(`Removing peer ${peerId}`);
    const peer = peersRef.current.get(peerId);
    if (peer) {
      peer.connection.close();
      peersRef.current.delete(peerId);
      setPeers(new Map(peersRef.current));
    }
  }, []);

  const handleSignal = useCallback(async (message: SignalMessage) => {
    if (!userId || message.from === userId) return;
    if (message.to && message.to !== userId) return;

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
        if (localStream) {
          localStream.getTracks().forEach((track) => {
            peer!.connection.addTrack(track, localStream);
          });
        }

        // Create and send offer
        const offer = await peer.connection.createOffer();
        await peer.connection.setLocalDescription(offer);

        channelRef.current?.send({
          type: "broadcast",
          event: "signal",
          payload: {
            type: "offer",
            from: userId,
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

        // Add local tracks
        if (localStream) {
          localStream.getTracks().forEach((track) => {
            if (!peer!.connection.getSenders().find(s => s.track === track)) {
              peer!.connection.addTrack(track, localStream);
            }
          });
        }

        await peer.connection.setRemoteDescription(new RTCSessionDescription(message.payload as RTCSessionDescriptionInit));
        const answer = await peer.connection.createAnswer();
        await peer.connection.setLocalDescription(answer);

        channelRef.current?.send({
          type: "broadcast",
          event: "signal",
          payload: {
            type: "answer",
            from: userId,
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
          await peer.connection.setRemoteDescription(new RTCSessionDescription(message.payload as RTCSessionDescriptionInit));
        }
        break;
      }

      case "ice-candidate": {
        const peer = peersRef.current.get(message.from);
        if (peer && message.payload) {
          try {
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
  }, [userId, localStream, createPeerConnection, removePeer]);

  const joinCall = useCallback(async () => {
    if (!userId || !roomSlug) return;

    try {
      console.log("Joining call...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);

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
            // Announce joining
            channel.send({
              type: "broadcast",
              event: "signal",
              payload: {
                type: "join",
                from: userId,
              } as SignalMessage,
            });
          }
        });

      setIsInCall(true);
    } catch (error) {
      console.error("Error joining call:", error);
    }
  }, [userId, roomSlug, handleSignal]);

  const leaveCall = useCallback(() => {
    console.log("Leaving call...");

    // Notify others
    if (channelRef.current && userId) {
      channelRef.current.send({
        type: "broadcast",
        event: "signal",
        payload: {
          type: "leave",
          from: userId,
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
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    // Unsubscribe from channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setIsInCall(false);
    setIsMuted(false);
    setIsVideoOff(false);
  }, [userId, localStream]);

  const toggleMute = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  }, [localStream, isMuted]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  }, [localStream, isVideoOff]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isInCall) {
        leaveCall();
      }
    };
  }, []);

  return {
    isInCall,
    localStream,
    peers,
    isMuted,
    isVideoOff,
    joinCall,
    leaveCall,
    toggleMute,
    toggleVideo,
  };
};
