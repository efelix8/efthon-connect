import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface VoiceRoom {
  id: string;
  name: string;
  slug: string;
}

interface VoiceParticipant {
  id: string;
  user_id: string;
  voice_room_id: string;
  is_muted: boolean;
  is_deafened: boolean;
  nickname?: string;
}

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
    {
      urls: "turn:openrelay.metered.ca:80",
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

export const useVoiceChat = (userId: string | undefined) => {
  const [voiceRooms, setVoiceRooms] = useState<VoiceRoom[]>([]);
  const [participants, setParticipants] = useState<Map<string, VoiceParticipant[]>>(new Map());
  const [currentRoom, setCurrentRoom] = useState<VoiceRoom | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const peersRef = useRef<Map<string, Peer>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const userIdRef = useRef<string | undefined>(userId);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // Fetch voice rooms
  const fetchRooms = useCallback(async () => {
    const { data, error } = await supabase
      .from("voice_rooms")
      .select("*")
      .order("created_at", { ascending: true });

    if (!error && data) {
      setVoiceRooms(data);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Subscribe to participants changes
  useEffect(() => {
    const channel = supabase
      .channel("voice-participants")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "voice_room_participants",
        },
        () => {
          fetchAllParticipants();
        }
      )
      .subscribe();

    fetchAllParticipants();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAllParticipants = async () => {
    const { data, error } = await supabase
      .from("voice_room_participants")
      .select(`
        id,
        user_id,
        voice_room_id,
        is_muted,
        is_deafened,
        users_public!inner(nickname)
      `);

    if (!error && data) {
      const participantMap = new Map<string, VoiceParticipant[]>();
      data.forEach((p: any) => {
        const roomId = p.voice_room_id;
        const participant: VoiceParticipant = {
          id: p.id,
          user_id: p.user_id,
          voice_room_id: p.voice_room_id,
          is_muted: p.is_muted,
          is_deafened: p.is_deafened,
          nickname: p.users_public?.nickname,
        };
        
        if (!participantMap.has(roomId)) {
          participantMap.set(roomId, []);
        }
        participantMap.get(roomId)!.push(participant);
      });
      setParticipants(participantMap);
    }
  };

  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
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
      const peer = peersRef.current.get(peerId);
      if (peer) {
        peer.stream = event.streams[0];
        peersRef.current.set(peerId, peer);
        setPeers(new Map(peersRef.current));
        
        // Play audio
        const audio = new Audio();
        audio.srcObject = event.streams[0];
        audio.play();
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        removePeer(peerId);
      }
    };

    return pc;
  }, []);

  const removePeer = useCallback((peerId: string) => {
    const peer = peersRef.current.get(peerId);
    if (peer) {
      peer.connection.close();
      peersRef.current.delete(peerId);
      setPeers(new Map(peersRef.current));
    }
  }, []);

  const handleSignal = useCallback(async (message: SignalMessage) => {
    const currentUserId = userIdRef.current;
    const currentLocalStream = localStreamRef.current;

    if (!currentUserId || message.from === currentUserId) return;
    if (message.to && message.to !== currentUserId) return;

    switch (message.type) {
      case "join": {
        let peer = peersRef.current.get(message.from);
        if (!peer) {
          const pc = createPeerConnection(message.from);
          peer = { id: message.from, connection: pc };
          peersRef.current.set(message.from, peer);
        }

        if (currentLocalStream) {
          currentLocalStream.getTracks().forEach((track) => {
            const senders = peer!.connection.getSenders();
            if (!senders.find((s) => s.track === track)) {
              peer!.connection.addTrack(track, currentLocalStream);
            }
          });
        }

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

        if (currentLocalStream) {
          currentLocalStream.getTracks().forEach((track) => {
            const senders = peer!.connection.getSenders();
            if (!senders.find((s) => s.track === track)) {
              peer!.connection.addTrack(track, currentLocalStream);
            }
          });
        }

        await peer.connection.setRemoteDescription(
          new RTCSessionDescription(message.payload as RTCSessionDescriptionInit)
        );
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
          await peer.connection.setRemoteDescription(
            new RTCSessionDescription(message.payload as RTCSessionDescriptionInit)
          );
        }
        break;
      }

      case "ice-candidate": {
        const peer = peersRef.current.get(message.from);
        if (peer && message.payload) {
          try {
            await peer.connection.addIceCandidate(
              new RTCIceCandidate(message.payload as RTCIceCandidateInit)
            );
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

  const joinRoom = useCallback(async (room: VoiceRoom) => {
    if (!userId) return;

    try {
      // Get audio only
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      localStreamRef.current = stream;

      // Add participant to database
      await supabase.from("voice_room_participants").insert({
        voice_room_id: room.id,
        user_id: userId,
      });

      // Set up signaling channel
      const channel = supabase.channel(`voice-${room.slug}`);
      channelRef.current = channel;

      channel
        .on("broadcast", { event: "signal" }, ({ payload }) => {
          handleSignal(payload as SignalMessage);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            setTimeout(() => {
              channel.send({
                type: "broadcast",
                event: "signal",
                payload: {
                  type: "join",
                  from: userId,
                } as SignalMessage,
              });
            }, 100);
          }
        });

      setCurrentRoom(room);
      setIsConnected(true);
    } catch (error) {
      console.error("Error joining voice room:", error);
    }
  }, [userId, handleSignal]);

  const leaveRoom = useCallback(async () => {
    if (!userId || !currentRoom) return;

    // Notify others
    if (channelRef.current) {
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
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Remove from channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Remove from database
    await supabase
      .from("voice_room_participants")
      .delete()
      .eq("user_id", userId)
      .eq("voice_room_id", currentRoom.id);

    setCurrentRoom(null);
    setIsConnected(false);
    setIsMuted(false);
    setIsDeafened(false);
  }, [userId, currentRoom]);

  const toggleMute = useCallback(async () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);

      if (userId && currentRoom) {
        await supabase
          .from("voice_room_participants")
          .update({ is_muted: !isMuted })
          .eq("user_id", userId)
          .eq("voice_room_id", currentRoom.id);
      }
    }
  }, [isMuted, userId, currentRoom]);

  const toggleDeafen = useCallback(async () => {
    // Mute all incoming audio
    peersRef.current.forEach((peer) => {
      if (peer.stream) {
        peer.stream.getAudioTracks().forEach((track) => {
          track.enabled = isDeafened;
        });
      }
    });
    setIsDeafened(!isDeafened);

    if (userId && currentRoom) {
      await supabase
        .from("voice_room_participants")
        .update({ is_deafened: !isDeafened })
        .eq("user_id", userId)
        .eq("voice_room_id", currentRoom.id);
    }
  }, [isDeafened, userId, currentRoom]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
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
    voiceRooms,
    participants,
    currentRoom,
    isConnected,
    isMuted,
    isDeafened,
    peers,
    joinRoom,
    leaveRoom,
    toggleMute,
    toggleDeafen,
    refetchRooms: fetchRooms,
  };
};