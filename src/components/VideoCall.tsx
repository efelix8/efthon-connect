import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, Users, Maximize2, Minimize2, 
  Wifi, Globe, Server, MessageSquare, X, Send, Monitor, MonitorOff,
  Signal, SignalHigh, SignalLow, SignalMedium, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConnectionType } from "@/hooks/use-video-call";

interface ChatMessage {
  id: string;
  content: string;
  imageUrl?: string | null;
  createdAt: string;
  user: { id: string; nickname: string } | null;
}

interface Peer {
  id: string;
  stream?: MediaStream;
  connectionType?: ConnectionType;
  nickname?: string;
}

interface VideoCallProps {
  localStream: MediaStream | null;
  screenStream?: MediaStream | null;
  isScreenSharing?: boolean;
  peers: Map<string, Peer>;
  isMuted: boolean;
  isVideoOff: boolean;
  connectionQuality?: "excellent" | "good" | "poor" | "unknown";
  isReconnecting?: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onLeave: () => void;
  onStartScreenShare?: () => void;
  onStopScreenShare?: () => void;
  // Chat props
  messages?: ChatMessage[];
  currentUserId?: string | null;
  currentUserNickname?: string;
  onSendMessage?: (content: string) => void;
  isSendingMessage?: boolean;
}

const ConnectionBadge = ({ type }: { type?: ConnectionType }) => {
  const config = {
    direct: { icon: Wifi, label: "Doğrudan", color: "text-green-400", bg: "bg-green-500/20" },
    stun: { icon: Globe, label: "STUN", color: "text-blue-400", bg: "bg-blue-500/20" },
    turn: { icon: Server, label: "TURN", color: "text-yellow-400", bg: "bg-yellow-500/20" },
    unknown: { icon: Wifi, label: "Bağlanıyor", color: "text-white/60", bg: "bg-white/10" },
  };
  
  const { icon: Icon, label, color, bg } = config[type || "unknown"];
  
  return (
    <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full", bg)}>
      <Icon className={cn("h-3 w-3", color)} />
      <span className={cn("text-[10px] font-medium", color)}>{label}</span>
    </div>
  );
};

const QualityIndicator = ({ quality }: { quality?: "excellent" | "good" | "poor" | "unknown" }) => {
  const config = {
    excellent: { icon: SignalHigh, label: "Mükemmel", color: "text-green-400" },
    good: { icon: SignalMedium, label: "İyi", color: "text-yellow-400" },
    poor: { icon: SignalLow, label: "Zayıf", color: "text-red-400" },
    unknown: { icon: Signal, label: "Bağlanıyor", color: "text-white/40" },
  };

  const { icon: Icon, label, color } = config[quality || "unknown"];

  return (
    <div className="flex items-center gap-1.5" title={label}>
      <Icon className={cn("h-4 w-4", color)} />
    </div>
  );
};

const VideoTile = ({ 
  stream, 
  label, 
  isMuted,
  isLocal = false,
  isLarge = false,
  isScreenShare = false,
  connectionType,
}: { 
  stream: MediaStream | null; 
  label: string; 
  isMuted?: boolean;
  isLocal?: boolean;
  isLarge?: boolean;
  isScreenShare?: boolean;
  connectionType?: ConnectionType;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      
      // Check for video tracks
      const videoTracks = stream.getVideoTracks();
      setHasVideo(videoTracks.length > 0 && videoTracks[0].enabled);
      
      // Listen for track changes
      const handleTrackChange = () => {
        const tracks = stream.getVideoTracks();
        setHasVideo(tracks.length > 0 && tracks[0].enabled);
      };
      
      stream.addEventListener('addtrack', handleTrackChange);
      stream.addEventListener('removetrack', handleTrackChange);
      
      return () => {
        stream.removeEventListener('addtrack', handleTrackChange);
        stream.removeEventListener('removetrack', handleTrackChange);
      };
    }
  }, [stream]);

  return (
    <div 
      className={cn(
        "relative overflow-hidden transition-all duration-300 group",
        isLarge 
          ? "rounded-2xl shadow-2xl ring-1 ring-white/10" 
          : "rounded-xl shadow-lg ring-1 ring-white/5",
        isLocal && !isLarge && "absolute bottom-24 right-6 w-48 h-36 z-10 hover:scale-105 cursor-move",
        isScreenShare && "ring-2 ring-primary/50"
      )}
    >
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
      
      {/* Video element - always render if stream exists */}
      {stream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMuted}
          className={cn(
            "absolute inset-0 w-full h-full z-10",
            isScreenShare ? "object-contain bg-black" : "object-cover",
            !hasVideo && "hidden"
          )}
        />
      )}

      {/* Avatar fallback - show when no stream OR when video is disabled */}
      {(!stream || !hasVideo) && (
        <div className="relative w-full h-full flex items-center justify-center aspect-video">
          {/* Animated background rings */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full bg-primary/5 animate-pulse" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-primary/10 animate-pulse delay-75" />
          </div>
          
          {/* Avatar */}
          <div className={cn(
            "relative flex items-center justify-center rounded-full",
            "bg-gradient-to-br from-primary/30 to-primary/10",
            "ring-2 ring-primary/20 shadow-lg",
            isLarge ? "w-24 h-24" : "w-16 h-16"
          )}>
            <span className={cn(
              "font-semibold text-primary",
              isLarge ? "text-4xl" : "text-2xl"
            )}>
              {label.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Screen share indicator */}
      {isScreenShare && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-primary/80 backdrop-blur-sm px-2 py-1 rounded-full">
          <Monitor className="h-3 w-3 text-white" />
          <span className="text-[10px] font-medium text-white">Ekran Paylaşımı</span>
        </div>
      )}

      {/* Name badge */}
      <div className={cn(
        "absolute bottom-3 left-3 flex items-center gap-2",
        "bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full",
        "border border-white/10 shadow-lg",
        "transition-opacity duration-200",
        isLarge ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      )}>
        {isMuted && <MicOff className="h-3 w-3 text-red-400" />}
        <span className="text-xs font-medium text-white">{label}</span>
      </div>

      {/* Connection indicator */}
      <div className="absolute top-3 right-3">
        {isLocal ? (
          <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-white/70">Sen</span>
          </div>
        ) : (
          <ConnectionBadge type={connectionType} />
        )}
      </div>
    </div>
  );
};

export const VideoCall = ({
  localStream,
  screenStream,
  isScreenSharing = false,
  peers,
  isMuted,
  isVideoOff,
  connectionQuality = "unknown",
  isReconnecting = false,
  onToggleMute,
  onToggleVideo,
  onLeave,
  onStartScreenShare,
  onStopScreenShare,
  messages = [],
  currentUserId,
  currentUserNickname,
  onSendMessage,
  isSendingMessage = false,
}: VideoCallProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatMessage, setChatMessage] = useState("");
  const [showParticipants, setShowParticipants] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const peerArray = Array.from(peers.values());
  const totalParticipants = peerArray.length + 1;

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !onSendMessage) return;
    onSendMessage(chatMessage);
    setChatMessage("");
  };
  const hasMultipleParticipants = peerArray.length > 0;

  // ESC key to leave call
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onLeave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onLeave]);

  const getGridCols = () => {
    if (totalParticipants <= 1) return "grid-cols-1 max-w-3xl mx-auto";
    if (totalParticipants === 2) return "grid-cols-2 max-w-5xl mx-auto";
    if (totalParticipants <= 4) return "grid-cols-2 max-w-5xl mx-auto";
    if (totalParticipants <= 6) return "grid-cols-3 max-w-6xl mx-auto";
    return "grid-cols-4 max-w-7xl mx-auto";
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in">
      {/* Background with gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" />
      
      {/* Subtle pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Reconnecting overlay */}
      {isReconnecting && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 text-white">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm font-medium">Yeniden bağlanılıyor...</span>
          </div>
        </div>
      )}

      {/* Main video area */}
      <div className={cn("relative flex-1 flex flex-col transition-all duration-300", chatOpen ? "mr-80" : "mr-0")}>
        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowParticipants(!showParticipants)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full",
                showParticipants ? "bg-white/10" : "bg-white/5",
                "hover:bg-white/10"
              )}
            >
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-white">{totalParticipants} katılımcı</span>
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-white/60">Canlı</span>
            </div>
            <QualityIndicator quality={connectionQuality} />
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setChatOpen(!chatOpen)}
              className={cn(
                "text-white/60 hover:text-white hover:bg-white/10",
                chatOpen && "bg-white/10 text-white"
              )}
            >
              <MessageSquare className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </Button>
          </div>
        </header>

        {/* Participants Panel */}
        {showParticipants && (
          <div className="absolute left-6 top-20 z-20 w-64 bg-slate-900/95 backdrop-blur-sm rounded-xl border border-white/10 shadow-xl">
            <div className="p-3 border-b border-white/10">
              <h4 className="text-sm font-medium text-white">Katılımcılar</h4>
            </div>
            <div className="p-2 max-h-64 overflow-y-auto">
              {/* You */}
              <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-medium text-primary">
                    {(currentUserNickname || "Sen").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-white">{currentUserNickname || "Sen"}</p>
                  <p className="text-xs text-white/40">Sen</p>
                </div>
                {isMuted && <MicOff className="h-4 w-4 text-red-400" />}
              </div>
              {/* Other participants */}
              {peerArray.map((peer) => (
                <div key={peer.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    <span className="text-xs font-medium text-white">
                      {(peer.nickname || peer.id.slice(0, 2)).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-white">{peer.nickname || `Kullanıcı ${peer.id.slice(0, 4)}`}</p>
                    <p className="text-xs text-white/40">{peer.connectionType || "Bağlanıyor"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Video Grid */}
        <div className="relative flex-1 p-6 overflow-hidden">
          {hasMultipleParticipants ? (
            <>
              {/* Remote videos in grid */}
              <div className={cn("grid gap-4 h-full", getGridCols())}>
                {peerArray.map((peer) => (
                  <VideoTile
                    key={peer.id}
                    stream={peer.stream || null}
                    label={peer.nickname || `Kullanıcı ${peer.id.slice(0, 4)}`}
                    isLarge
                    connectionType={peer.connectionType}
                  />
                ))}
              </div>
              
              {/* Local video as floating PiP */}
              <VideoTile 
                stream={isScreenSharing ? screenStream : localStream} 
                label={currentUserNickname || "Sen"} 
                isMuted 
                isLocal
                isScreenShare={isScreenSharing}
              />
            </>
          ) : (
            /* Single participant - show local video large */
            <div className={cn("grid gap-4 h-full", getGridCols())}>
              <VideoTile 
                stream={isScreenSharing ? screenStream : localStream} 
                label={currentUserNickname || "Sen"} 
                isMuted 
                isLarge
                isScreenShare={isScreenSharing}
              />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="relative z-10 p-6">
          <div className="flex items-center justify-center gap-3">
            {/* Mute button */}
            <Button
              variant="ghost"
              size="lg"
              onClick={onToggleMute}
              className={cn(
                "rounded-full w-14 h-14 transition-all duration-200",
                "hover:scale-105 active:scale-95",
                isMuted 
                  ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 ring-2 ring-red-500/30" 
                  : "bg-white/10 hover:bg-white/20 text-white"
              )}
              title={isMuted ? "Mikrofonu aç" : "Mikrofonu kapat"}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>

            {/* Video button */}
            <Button
              variant="ghost"
              size="lg"
              onClick={onToggleVideo}
              className={cn(
                "rounded-full w-14 h-14 transition-all duration-200",
                "hover:scale-105 active:scale-95",
                isVideoOff 
                  ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 ring-2 ring-red-500/30" 
                  : "bg-white/10 hover:bg-white/20 text-white"
              )}
              title={isVideoOff ? "Kamerayı aç" : "Kamerayı kapat"}
            >
              {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </Button>

            {/* Screen share button */}
            {onStartScreenShare && onStopScreenShare && (
              <Button
                variant="ghost"
                size="lg"
                onClick={isScreenSharing ? onStopScreenShare : onStartScreenShare}
                className={cn(
                  "rounded-full w-14 h-14 transition-all duration-200",
                  "hover:scale-105 active:scale-95",
                  isScreenSharing 
                    ? "bg-primary/20 hover:bg-primary/30 text-primary ring-2 ring-primary/30" 
                    : "bg-white/10 hover:bg-white/20 text-white"
                )}
                title={isScreenSharing ? "Ekran paylaşımını durdur" : "Ekran paylaş"}
              >
                {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
              </Button>
            )}

            {/* Leave button */}
            <Button
              variant="ghost"
              size="lg"
              onClick={onLeave}
              className={cn(
                "rounded-full w-14 h-14 transition-all duration-200",
                "bg-red-500 hover:bg-red-600 text-white",
                "hover:scale-105 active:scale-95",
                "shadow-lg shadow-red-500/30"
              )}
              title="Aramadan ayrıl"
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>

          {/* Hint text */}
          <p className="text-center text-xs text-white/40 mt-4">
            ESC tuşuna basarak aramadan çıkabilirsiniz
          </p>
        </div>
      </div>

      {/* Chat Panel */}
      <div 
        className={cn(
          "fixed right-0 top-0 h-full w-80 bg-slate-900/95 backdrop-blur-sm border-l border-white/10 flex flex-col z-20 transition-transform duration-300",
          chatOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Chat Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-medium text-white">Sohbet</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setChatOpen(false)}
            className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Chat Messages */}
        <ScrollArea className="flex-1 px-4 py-3">
          <div className="space-y-3">
            {messages.length === 0 && (
              <p className="text-xs text-white/40 text-center py-4">Henüz mesaj yok</p>
            )}
            {messages.map((msg) => {
              const isOwn = msg.user?.id === currentUserId;
              const isSinan = msg.content.startsWith('**Sinan Gür:**');
              const displayName = isSinan ? 'Sinan Gür' : (isOwn ? 'Sen' : msg.user?.nickname || 'Bilinmeyen');
              const displayContent = isSinan ? msg.content.replace('**Sinan Gür:** ', '') : msg.content;
              
              return (
                <div key={msg.id} className={cn("flex flex-col gap-1", isOwn && "items-end")}>
                  <span className={cn(
                    "text-[10px] font-medium",
                    isSinan ? "text-yellow-400" : isOwn ? "text-primary" : "text-white/50"
                  )}>
                    {displayName}
                  </span>
                  <div className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    isOwn 
                      ? "bg-primary text-primary-foreground" 
                      : isSinan 
                        ? "bg-yellow-500/20 text-yellow-200"
                        : "bg-white/10 text-white"
                  )}>
                    {msg.imageUrl && (
                      <img 
                        src={msg.imageUrl} 
                        alt="" 
                        className="max-w-full rounded mb-1 max-h-32 object-contain"
                      />
                    )}
                    {displayContent}
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
        </ScrollArea>

        {/* Chat Input */}
        <form onSubmit={handleSendChat} className="p-3 border-t border-white/10">
          <div className="flex gap-2">
            <Input
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder="Mesaj yaz..."
              disabled={isSendingMessage}
              className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/40"
            />
            <Button 
              type="submit" 
              size="icon"
              disabled={isSendingMessage || !chatMessage.trim()}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
