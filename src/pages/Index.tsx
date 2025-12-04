import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { fetchRooms, fetchMessages, sendMessage, type Room, type ChatMessage } from "@/lib/chat-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

const Index = () => {
  const { user, session, loading, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeRoomSlug, setActiveRoomSlug] = useState<string | null>(null);
  const [message, setMessage] = useState("");

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

  const messages = useMemo(() => {
    if (!messagesResponse) return [] as ChatMessage[];
    return [...messagesResponse.messages].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [messagesResponse]);

  

  const sendMessageMutation = useMutation({
    mutationFn: () => {
      if (!activeRoomSlug) throw new Error("Oda seçili değil");
      return sendMessage(activeRoomSlug, message);
    },
    onSuccess: () => {
      setMessage("");
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
    if (!message.trim()) return;
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
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-64 flex-shrink-0 border-r border-border bg-card/60 p-4 md:flex md:flex-col">
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
        <Separator className="my-4" />
        <button
          type="button"
          onClick={() => signOut()}
          className="w-full rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          Çıkış yap
        </button>
      </aside>

      <main className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card/60 px-4 py-3">
          <div>
            <h1 className="text-base font-semibold">
              {messagesResponse?.room?.name ?? "Sohbet"}
            </h1>
            <p className="text-xs text-muted-foreground">Gerçek zamanlı sınıf sohbeti</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="max-w-[200px] truncate">
              Takma adınla anonim olarak bağlısın.
            </span>
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
              <div key={m.id} className="space-y-1 rounded-md bg-card/60 p-3 text-sm shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{m.user?.nickname ?? "Bilinmeyen"}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(m.createdAt).toLocaleTimeString("tr-TR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm leading-snug text-foreground">{m.content}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleSend} className="border-t border-border bg-card/60 px-4 py-3">
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Mesajını yaz..."
                disabled={sendMessageMutation.isPending}
              />
              <Button type="submit" disabled={sendMessageMutation.isPending || !message.trim()}>
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

