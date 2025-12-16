import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users, Maximize2, Minimize2, Wifi, Globe, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConnectionType } from "@/hooks/use-video-call";

interface Peer {
  id: string;
  stream?: MediaStream;
  connectionType?: ConnectionType;
}

interface VideoCallProps {
  localStream: MediaStream | null;
  peers: Map<string, Peer>;
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onLeave: () => void;
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

const VideoTile = ({ 
  stream, 
  label, 
  isMuted,
  isLocal = false,
  isLarge = false,
  connectionType,
}: { 
  stream: MediaStream | null; 
  label: string; 
  isMuted?: boolean;
  isLocal?: boolean;
  isLarge?: boolean;
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
        isLocal && !isLarge && "absolute bottom-24 right-6 w-40 h-28 z-10 hover:scale-105"
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
            "absolute inset-0 w-full h-full object-cover z-10",
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
  peers,
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onLeave,
}: VideoCallProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const peerArray = Array.from(peers.values());
  const totalParticipants = peerArray.length + 1;
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
    <div className="fixed inset-0 z-50 flex flex-col animate-fade-in">
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

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white/5 backdrop-blur-sm px-3 py-1.5 rounded-full">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-white">{totalParticipants} katılımcı</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-white/60">Canlı</span>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleFullscreen}
          className="text-white/60 hover:text-white hover:bg-white/10"
        >
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </Button>
      </header>

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
                  label={`Kullanıcı ${peer.id.slice(0, 4)}`}
                  isLarge
                  connectionType={peer.connectionType}
                />
              ))}
            </div>
            
            {/* Local video as floating PiP */}
            <VideoTile 
              stream={localStream} 
              label="Sen" 
              isMuted 
              isLocal
            />
          </>
        ) : (
          /* Single participant - show local video large */
          <div className={cn("grid gap-4 h-full", getGridCols())}>
            <VideoTile 
              stream={localStream} 
              label="Sen" 
              isMuted 
              isLarge
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
              "rounded-full w-16 h-16 transition-all duration-200",
              "hover:scale-105 active:scale-95",
              isMuted 
                ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 ring-2 ring-red-500/30" 
                : "bg-white/10 hover:bg-white/20 text-white"
            )}
          >
            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>

          {/* Video button */}
          <Button
            variant="ghost"
            size="lg"
            onClick={onToggleVideo}
            className={cn(
              "rounded-full w-16 h-16 transition-all duration-200",
              "hover:scale-105 active:scale-95",
              isVideoOff 
                ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 ring-2 ring-red-500/30" 
                : "bg-white/10 hover:bg-white/20 text-white"
            )}
          >
            {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
          </Button>

          {/* Leave button */}
          <Button
            variant="ghost"
            size="lg"
            onClick={onLeave}
            className={cn(
              "rounded-full w-16 h-16 transition-all duration-200",
              "bg-red-500 hover:bg-red-600 text-white",
              "hover:scale-105 active:scale-95",
              "shadow-lg shadow-red-500/30"
            )}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>

        {/* Hint text */}
        <p className="text-center text-xs text-white/40 mt-4">
          ESC tuşuna basarak aramadan çıkabilirsiniz
        </p>
      </div>
    </div>
  );
};
