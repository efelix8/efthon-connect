import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { usePresence } from "@/hooks/use-presence";
import { fetchRooms, fetchMessages, sendMessage, type Room, type ChatMessage } from "@/lib/chat-api";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import MessageItem from "@/components/MessageItem";
import CreateRoomDialog from "@/components/CreateRoomDialog";
import ImageUpload from "@/components/ImageUpload";
import logoWatermark from "@/assets/logo-watermark.png";

const MAX_ROOMS = 10;

const Index = () => {
  const { user, session, loading, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeRoomSlug, setActiveRoomSlug] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  
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
    setActiveRoomSlug((current) => current ?? defaultRoom.slug);
  }, [rooms]);

  const {
    data: messagesResponse,
    isLoading: messagesLoading,
  } = useQuery<{ room: Pick<Room, "id" | "slug" | "name">; messages: ChatMessage[]}>({
    queryKey: ["messages", activeRoomSlug],
    queryFn: () => fetchMessages(accessToken, activeRoomSlug!),
    enabled: !!accessToken && !!activeRoomSlug,
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

  const messages = useMemo(() => {
    if (!messagesResponse) return [] as ChatMessage[];
    return [...messagesResponse.messages].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [messagesResponse]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!messagesResponse?.room?.id) return;

    const channel = supabase
      .channel(`room-${messagesResponse.room.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${messagesResponse.room.id}`,
        },
        () => {
          // Refetch messages when any change happens
          queryClient.invalidateQueries({ queryKey: ["messages", activeRoomSlug] });
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

  

  const sendMessageMutation = useMutation({
    mutationFn: () => {
      if (!activeRoomSlug) throw new Error("Oda seçili değil");
      return sendMessage(activeRoomSlug, message, uploadedImageUrl || undefined);
    },
    onSuccess: () => {
      setMessage("");
      setUploadedImageUrl(null);
      if (activeRoomSlug) {
        queryClient.invalidateQueries({ queryKey: ["messages", activeRoomSlug] });
      }
    },
    onError: (error: any) => {
      const description =
        error?.message === "User mapping not found. Call /api/auth/nickname first."
          ? "Mesaj göndermeden önce lütfen takma adını kaydet."
          : error?.message ?? "Mesaj gönderilemedi.";
      toast({ variant: "destructive", title: "Hata", description });
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() && !uploadedImageUrl) return;
    sendMessageMutation.mutate();
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Yükleniyor...</p>
      </div>
    );
  }

  return (
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

      <aside className="relative z-10 hidden w-64 flex-shrink-0 border-r border-border bg-card/60 p-4 md:flex md:flex-col">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">Odalar</h2>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {roomsLoading && <p className="text-xs text-muted-foreground">Odalar yükleniyor...</p>}
          {roomsError && <p className="text-xs text-destructive">Odalar yüklenemedi.</p>}
          {rooms?.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => setActiveRoomSlug(room.slug)}
              className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors ${
                activeRoomSlug === room.slug
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <span className="truncate">{room.name}</span>
            </button>
          ))}
        </div>
        <div className="mt-2">
          <CreateRoomDialog roomCount={rooms?.length ?? 0} maxRooms={MAX_ROOMS} />
        </div>
        <Separator className="my-4" />
        <button
          type="button"
          onClick={() => signOut()}
          className="w-full rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          Çıkış yap
        </button>
      </aside>

      <main className="relative z-10 flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card/60 px-4 py-3">
          <div>
            <h1 className="text-base font-semibold">
              {messagesResponse?.room?.name ?? "Sohbet"}
            </h1>
            <p className="text-xs text-muted-foreground">Gerçek zamanlı sınıf sohbeti</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1">
              <Users className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium text-primary">{activeUsers} çevrimiçi</span>
            </div>
          </div>
        </header>


        <section className="flex flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messagesLoading && (
              <p className="text-xs text-muted-foreground">Mesajlar yükleniyor...</p>
            )}
            {!messagesLoading && messages.length === 0 && (
              <p className="text-xs text-muted-foreground">Bu odada henüz mesaj yok.</p>
            )}
            {messages.map((m) => (
              <MessageItem
                key={m.id}
                message={m}
                isOwn={m.user?.id === chatUserId}
                activeRoomSlug={activeRoomSlug ?? ""}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSend} className="border-t border-border bg-card/60 px-4 py-3">
            <div className="flex gap-2 items-center">
              {user?.id && (
                <ImageUpload
                  userId={user.id}
                  onImageUploaded={(url) => setUploadedImageUrl(url)}
                  onImageRemoved={() => setUploadedImageUrl(null)}
                  imagePreview={uploadedImageUrl}
                  disabled={sendMessageMutation.isPending}
                />
              )}
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Mesajını yaz..."
                disabled={sendMessageMutation.isPending}
                className="flex-1"
              />
              <Button 
                type="submit" 
                disabled={sendMessageMutation.isPending || (!message.trim() && !uploadedImageUrl)}
              >
                Gönder
              </Button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
};

export default Index;