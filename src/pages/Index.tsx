import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Lock, Hash, Video, Pencil, Trash2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { usePresence } from "@/hooks/use-presence";
import { useVideoCall } from "@/hooks/use-video-call";
import { useVoiceChat } from "@/hooks/use-voice-chat";
import { fetchRooms, fetchMessages, sendMessage, markMessageAsRead, askAISinan, shouldTriggerAISinan, deleteRoom, type Room, type ChatMessage } from "@/lib/chat-api";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import MessageItem from "@/components/MessageItem";
import CreateRoomDialog from "@/components/CreateRoomDialog";
import FileUpload from "@/components/ImageUpload";
import { DrawingCanvas } from "@/components/DrawingCanvas";
import StickerPicker from "@/components/StickerPicker";
import { RoomPasswordDialog } from "@/components/RoomPasswordDialog";
import { EditRoomDialog } from "@/components/EditRoomDialog";
import { VideoCall } from "@/components/VideoCall";
import { VoiceChannelList, VoiceControlBar } from "@/components/VoiceChannelList";
import logoWatermark from "@/assets/logo-watermark.png";

const MAX_ROOMS = 10;

const Index = () => {
  const { user, session, loading, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeRoomSlug, setActiveRoomSlug] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{ url: string; type: "image" | "pdf" } | null>(null);
  const [unlockedRooms, setUnlockedRooms] = useState<Set<string>>(new Set());
  const [passwordDialog, setPasswordDialog] = useState<{ open: boolean; room: Room | null }>({
    open: false,
    room: null,
  });
  const [drawingOpen, setDrawingOpen] = useState(false);
  
  const { activeUsers } = usePresence(user?.id);

  useEffect(() => {
    document.title = "Sohbet | Uygulama";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute("content", "Odalar arasında mesajlaşabileceğin sohbet ekranı.");
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [loading, user, navigate]);

  const accessToken = session?.access_token ?? "";

  const {
    data: rooms,
    isLoading: roomsLoading,
    isError: roomsError,
  } = useQuery<Room[]>({
    queryKey: ["rooms"],
    queryFn: () => fetchRooms(accessToken),
    enabled: !!accessToken,
  });

  useEffect(() => {
    if (!rooms || rooms.length === 0) return;
    const defaultRoom = rooms.find((r) => r.is_default) ?? rooms[0];
    // Only auto-select if room doesn't require password or is already unlocked
    if (!defaultRoom.has_password || unlockedRooms.has(defaultRoom.slug)) {
      setActiveRoomSlug((current) => current ?? defaultRoom.slug);
    }
  }, [rooms, unlockedRooms]);

  const handleRoomSelect = (room: Room) => {
    if (room.has_password && !unlockedRooms.has(room.slug)) {
      setPasswordDialog({ open: true, room });
    } else {
      setActiveRoomSlug(room.slug);
    }
  };

  const handleRoomUnlocked = (roomSlug: string) => {
    setUnlockedRooms((prev) => new Set(prev).add(roomSlug));
    setActiveRoomSlug(roomSlug);
  };

  const deleteRoomMutation = useMutation({
    mutationFn: deleteRoom,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      toast({ title: "Başarılı", description: "Oda silindi" });
      // If the deleted room was active, reset to first available room
      if (rooms && rooms.length > 1) {
        const remainingRooms = rooms.filter(r => r.slug !== activeRoomSlug);
        const defaultRoom = remainingRooms.find(r => r.is_default) ?? remainingRooms[0];
        if (defaultRoom) {
          setActiveRoomSlug(defaultRoom.slug);
        }
      }
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Hata", description: error?.message ?? "Oda silinemedi" });
    },
  });

  const handleDeleteRoom = (roomId: string, roomName: string) => {
    if (confirm(`"${roomName}" odasını silmek istediğinizden emin misiniz? Tüm mesajlar da silinecek.`)) {
      deleteRoomMutation.mutate(roomId);
    }
  };

  const {
    data: messagesResponse,
    isLoading: messagesLoading,
  } = useQuery<{ room: Pick<Room, "id" | "slug" | "name">; messages: ChatMessage[]}>({
    queryKey: ["messages", activeRoomSlug],
    queryFn: () => fetchMessages(accessToken, activeRoomSlug!),
    enabled: !!accessToken && !!activeRoomSlug,
    staleTime: 1000 * 60 * 5, // 5 dakika cache
    gcTime: 1000 * 60 * 10, // 10 dakika bellekte tut
  });

  // Get current user's chat user ID
  const { data: chatUserData } = useQuery({
    queryKey: ["chatUser", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("id")
        .eq("auth_user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const chatUserId = chatUserData?.id ?? null;

  const {
    isInCall,
    localStream,
    screenStream,
    isScreenSharing,
    peers,
    isMuted: videoMuted,
    isVideoOff,
    connectionQuality,
    isReconnecting,
    joinCall,
    leaveCall,
    toggleMute: toggleVideoMute,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
  } = useVideoCall(activeRoomSlug ?? "", chatUserId ?? undefined, user?.user_metadata?.nickname);

  const {
    voiceRooms,
    participants: voiceParticipants,
    currentRoom: currentVoiceRoom,
    isConnected: isVoiceConnected,
    isMuted: voiceMuted,
    isDeafened,
    joinRoom: joinVoiceRoom,
    leaveRoom: leaveVoiceRoom,
    toggleMute: toggleVoiceMute,
    toggleDeafen,
    refetchRooms: refetchVoiceRooms,
  } = useVoiceChat(chatUserId ?? undefined);

  const messages = useMemo(() => {
    if (!messagesResponse) return [] as ChatMessage[];
    return [...messagesResponse.messages].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [messagesResponse]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Realtime subscription for new messages - direct cache update instead of refetch
  useEffect(() => {
    if (!messagesResponse?.room?.id) return;

    const channel = supabase
      .channel(`room-${messagesResponse.room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${messagesResponse.room.id}`,
        },
        async (payload) => {
          const newMessage = payload.new as any;
          // Fetch user info for the new message
          const { data: userData } = await supabase
            .from('users_public')
            .select('id, nickname')
            .eq('id', newMessage.user_id)
            .maybeSingle();
          
          const formattedMessage: ChatMessage = {
            id: newMessage.id,
            content: newMessage.content,
            imageUrl: newMessage.image_url,
            createdAt: newMessage.created_at,
            editedAt: newMessage.edited_at,
            roomId: newMessage.room_id,
            deliveredAt: newMessage.delivered_at,
            readCount: 0,
            user: userData ? { id: userData.id, nickname: userData.nickname } : null,
          };
          
          // Update cache directly
          queryClient.setQueryData(
            ["messages", activeRoomSlug],
            (old: any) => {
              if (!old) return old;
              // Check if message already exists
              if (old.messages.some((m: ChatMessage) => m.id === formattedMessage.id)) {
                return old;
              }
              return {
                ...old,
                messages: [...old.messages, formattedMessage],
              };
            }
          );

          // Check if message triggers AI Sinan (only for messages from other users)
          if (newMessage.user_id !== chatUserId && shouldTriggerAISinan(newMessage.content)) {
            try {
              // Get recent messages for context
              const currentMessages = queryClient.getQueryData(["messages", activeRoomSlug]) as any;
              const recentMessages = (currentMessages?.messages || []).slice(-10).map((m: ChatMessage) => ({
                content: m.content,
                isAI: m.content.startsWith('**Sinan Gür:**'),
              }));

              const aiResponse = await askAISinan(newMessage.content, recentMessages);
              
              // Send AI response as a message with Sinan Gür name
              await sendMessage(activeRoomSlug!, `**Sinan Gür:** ${aiResponse}`);
            } catch (error) {
              console.error('AI Sinan error:', error);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${messagesResponse.room.id}`,
        },
        (payload) => {
          const updated = payload.new as any;
          queryClient.setQueryData(
            ["messages", activeRoomSlug],
            (old: any) => {
              if (!old) return old;
              return {
                ...old,
                messages: old.messages.map((m: ChatMessage) =>
                  m.id === updated.id
                    ? {
                        ...m,
                        content: updated.content,
                        editedAt: updated.edited_at,
                        imageUrl: updated.image_url,
                        deliveredAt: updated.delivered_at || m.deliveredAt,
                      }
                    : m
                ),
              };
            }
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reads',
        },
        (payload) => {
          const read = payload.new as any;
          queryClient.setQueryData(
            ["messages", activeRoomSlug],
            (old: any) => {
              if (!old) return old;
              return {
                ...old,
                messages: old.messages.map((m: ChatMessage) =>
                  m.id === read.message_id
                    ? { ...m, readCount: (m.readCount || 0) + 1 }
                    : m
                ),
              };
            }
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${messagesResponse.room.id}`,
        },
        (payload) => {
          const deleted = payload.old as any;
          queryClient.setQueryData(
            ["messages", activeRoomSlug],
            (old: any) => {
              if (!old) return old;
              return {
                ...old,
                messages: old.messages.filter((m: ChatMessage) => m.id !== deleted.id),
              };
            }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [messagesResponse?.room?.id, activeRoomSlug, queryClient]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark messages as read when viewing
  useEffect(() => {
    if (!chatUserId || messages.length === 0) return;
    
    // Mark all messages from other users as read
    const unreadMessages = messages.filter(
      (m) => m.user?.id !== chatUserId && !m.id.startsWith('temp-')
    );
    
    unreadMessages.forEach((msg) => {
      markMessageAsRead(msg.id, chatUserId);
    });
  }, [messages, chatUserId]);

  // Mark messages as delivered when received via realtime
  useEffect(() => {
    if (!messagesResponse?.room?.id) return;

    const markDelivered = async (messageId: string) => {
      await supabase
        .from('messages')
        .update({ delivered_at: new Date().toISOString() })
        .eq('id', messageId)
        .is('delivered_at', null);
    };

    // Listen for new messages and mark them as delivered
    const deliveryChannel = supabase
      .channel(`delivery-${messagesResponse.room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${messagesResponse.room.id}`,
        },
        (payload) => {
          const newMessage = payload.new as any;
          // Mark as delivered if not our own message
          if (chatUserId && newMessage.user_id !== chatUserId) {
            markDelivered(newMessage.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(deliveryChannel);
    };
  }, [messagesResponse?.room?.id, chatUserId]);


  const sendMessageMutation = useMutation({
    mutationFn: (imageUrl?: string) => {
      if (!activeRoomSlug) throw new Error("Oda seçili değil");
      return sendMessage(activeRoomSlug, message, imageUrl || uploadedFile?.url || undefined);
    },
    onMutate: async (imageUrl?: string) => {
      // Optimistic update - add message immediately
      const optimisticMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        content: message,
        imageUrl: imageUrl || uploadedFile?.url || null,
        createdAt: new Date().toISOString(),
        editedAt: null,
        roomId: messagesResponse?.room?.id ?? "",
        user: chatUserId ? { id: chatUserId, nickname: user?.user_metadata?.nickname || "Sen" } : null,
      };
      
      queryClient.setQueryData(
        ["messages", activeRoomSlug],
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            messages: [...old.messages, optimisticMessage],
          };
        }
      );
      
      return { optimisticId: optimisticMessage.id };
    },
    onSuccess: (newMessage, _, context) => {
      setMessage("");
      setUploadedFile(null);
      // Replace optimistic message with real one
      if (context?.optimisticId) {
        queryClient.setQueryData(
          ["messages", activeRoomSlug],
          (old: any) => {
            if (!old) return old;
            return {
              ...old,
              messages: old.messages.map((m: ChatMessage) =>
                m.id === context.optimisticId ? newMessage : m
              ),
            };
          }
        );
      }
    },
    onError: (error: any, _, context) => {
      // Remove optimistic message on error
      if (context?.optimisticId) {
        queryClient.setQueryData(
          ["messages", activeRoomSlug],
          (old: any) => {
            if (!old) return old;
            return {
              ...old,
              messages: old.messages.filter((m: ChatMessage) => m.id !== context.optimisticId),
            };
          }
        );
      }
      const description =
        error?.message === "User mapping not found. Call /api/auth/nickname first."
          ? "Mesaj göndermeden önce lütfen takma adını kaydet."
          : error?.message ?? "Mesaj gönderilemedi.";
      toast({ variant: "destructive", title: "Hata", description });
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() && !uploadedFile) return;
    sendMessageMutation.mutate(undefined);
  };

  const handleImageStickerSelect = (imageUrl: string) => {
    sendMessageMutation.mutate(imageUrl);
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <>
      <div className="relative flex min-h-screen bg-background text-foreground">
        {/* Background logo watermark */}
        <div 
          className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <img 
            src={logoWatermark} 
            alt="" 
            className="h-[60vh] w-auto opacity-10"
          />
        </div>

        <aside className="fixed left-0 top-0 z-10 hidden h-screen w-64 flex-shrink-0 border-r border-border bg-card/60 md:flex md:flex-col">
          <div className="flex-1 overflow-y-auto p-4">
            {/* Text Channels */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-2">
                Metin Kanalları
              </h3>
              <div className="space-y-1">
                {roomsLoading && <p className="text-xs text-muted-foreground px-2">Yükleniyor...</p>}
                {roomsError && <p className="text-xs text-destructive px-2">Yüklenemedi.</p>}
                {rooms?.map((room) => (
                  <div
                    key={room.id}
                    className="group flex items-center gap-1"
                  >
                    <button
                      type="button"
                      onClick={() => handleRoomSelect(room)}
                      className={`flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                        activeRoomSlug === room.slug
                          ? "bg-primary/20 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      <Hash className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate flex-1">{room.name}</span>
                      {room.has_password && !unlockedRooms.has(room.slug) && (
                        <Lock className="h-3 w-3 flex-shrink-0 opacity-60" />
                      )}
                    </button>
                    <EditRoomDialog
                      roomId={room.id}
                      roomSlug={room.slug}
                      currentName={room.name}
                      isCreator={room.created_by === chatUserId}
                    />
                    {room.created_by === chatUserId && !room.is_default && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRoom(room.id, room.name)}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Odayı sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-2 px-2">
                <CreateRoomDialog roomCount={rooms?.length ?? 0} maxRooms={MAX_ROOMS} />
              </div>
            </div>

            {/* Voice Channels */}
            <VoiceChannelList
              voiceRooms={voiceRooms}
              participants={voiceParticipants}
              currentRoom={currentVoiceRoom}
              currentUserId={chatUserId}
              onJoinRoom={joinVoiceRoom}
              onRoomCreated={refetchVoiceRooms}
            />
          </div>

          {/* Voice Control Bar */}
          <VoiceControlBar
            currentRoom={currentVoiceRoom}
            isMuted={voiceMuted}
            isDeafened={isDeafened}
            onToggleMute={toggleVoiceMute}
            onToggleDeafen={toggleDeafen}
            onLeave={leaveVoiceRoom}
          />

          <Separator />
          <div className="p-2">
            <button
              type="button"
              onClick={() => signOut()}
              className="w-full rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              Çıkış yap
            </button>
          </div>
        </aside>

        <main className="relative z-10 ml-0 flex flex-1 flex-col md:ml-64">
          <header className="flex items-center justify-between border-b border-border bg-card/60 px-4 py-3">
            <div>
              <h1 className="text-base font-semibold">
                {messagesResponse?.room?.name ?? "Sohbet"}
              </h1>
              <p className="text-xs text-muted-foreground">Gerçek zamanlı sınıf sohbeti</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium text-primary">{activeUsers} çevrimiçi</span>
            </div>
          </header>

          <section className="flex flex-1 flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messagesLoading && (
                <p className="text-xs text-muted-foreground">Mesajlar yükleniyor...</p>
              )}
              {!messagesLoading && messages.length === 0 && (
                <p className="text-xs text-muted-foreground">Bu odada henüz mesaj yok.</p>
              )}
              {messages.map((m, index) => {
                const prevMessage = messages[index - 1];
                const nextMessage = messages[index + 1];
                const isFirstInGroup = !prevMessage || prevMessage.user?.id !== m.user?.id;
                const isLastInGroup = !nextMessage || nextMessage.user?.id !== m.user?.id;
                
                return (
                  <div key={m.id} className={!isLastInGroup ? "-mb-2" : ""}>
                    <MessageItem
                      message={m}
                      isOwn={m.user?.id === chatUserId}
                      activeRoomSlug={activeRoomSlug ?? ""}
                      isFirstInGroup={isFirstInGroup}
                      isLastInGroup={isLastInGroup}
                    />
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="border-t border-border bg-card/60 px-4 py-3">
              <div className="flex gap-2 items-center">
                {user?.id && (
                  <FileUpload
                    userId={user.id}
                    onFileUploaded={(url, type) => setUploadedFile({ url, type })}
                    onFileRemoved={() => setUploadedFile(null)}
                    filePreview={uploadedFile}
                    disabled={sendMessageMutation.isPending}
                  />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={joinCall}
                  disabled={!activeRoomSlug}
                  title="Görüntülü aramaya katıl"
                >
                  <Video className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setDrawingOpen(true)}
                  disabled={sendMessageMutation.isPending}
                  title="Çizim yap"
                >
                  <Pencil className="h-5 w-5" />
                </Button>
                <StickerPicker
                  onStickerSelect={(sticker) => setMessage((prev) => prev + sticker)}
                  onImageStickerSelect={handleImageStickerSelect}
                  disabled={sendMessageMutation.isPending}
                />
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Mesajını yaz..."
                  disabled={sendMessageMutation.isPending}
                  className="flex-1"
      />

      {user?.id && (
        <DrawingCanvas
          open={drawingOpen}
          onOpenChange={setDrawingOpen}
          userId={user.id}
          onImageSend={handleImageStickerSelect}
          disabled={sendMessageMutation.isPending}
        />
      )}
                <Button 
                  type="submit" 
                  disabled={sendMessageMutation.isPending || (!message.trim() && !uploadedFile)}
                >
                  Gönder
                </Button>
              </div>
            </form>
          </section>
        </main>
      </div>

      <RoomPasswordDialog
        open={passwordDialog.open}
        onOpenChange={(open) => setPasswordDialog({ open, room: open ? passwordDialog.room : null })}
        roomName={passwordDialog.room?.name ?? ""}
        roomSlug={passwordDialog.room?.slug ?? ""}
        onSuccess={() => passwordDialog.room && handleRoomUnlocked(passwordDialog.room.slug)}
      />

      {isInCall && (
        <VideoCall
          localStream={localStream}
          screenStream={screenStream}
          isScreenSharing={isScreenSharing}
          peers={peers}
          isMuted={videoMuted}
          isVideoOff={isVideoOff}
          connectionQuality={connectionQuality}
          isReconnecting={isReconnecting}
          onToggleMute={toggleVideoMute}
          onToggleVideo={toggleVideo}
          onLeave={leaveCall}
          onStartScreenShare={startScreenShare}
          onStopScreenShare={stopScreenShare}
          messages={messages.map(m => ({
            id: m.id,
            content: m.content,
            imageUrl: m.imageUrl,
            createdAt: m.createdAt,
            user: m.user,
          }))}
          currentUserId={chatUserId}
          currentUserNickname={user?.user_metadata?.nickname}
          onSendMessage={(content) => {
            if (!activeRoomSlug) return;
            sendMessage(activeRoomSlug, content);
          }}
          isSendingMessage={sendMessageMutation.isPending}
        />
      )}
    </>
  );
};

export default Index;