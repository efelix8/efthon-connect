import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";

interface Peer {
  id: string;
  stream?: MediaStream;
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

const VideoTile = ({ stream, label, isMuted }: { stream: MediaStream | null; label: string; isMuted?: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative bg-muted rounded-lg overflow-hidden aspect-video">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMuted}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-2xl text-primary">{label.charAt(0).toUpperCase()}</span>
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 bg-background/80 px-2 py-1 rounded text-xs">
        {label}
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
  const peerArray = Array.from(peers.values());
  const totalParticipants = peerArray.length + 1;

  const getGridCols = () => {
    if (totalParticipants <= 1) return "grid-cols-1";
    if (totalParticipants <= 2) return "grid-cols-2";
    if (totalParticipants <= 4) return "grid-cols-2";
    return "grid-cols-3";
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Video Grid */}
      <div className={`flex-1 p-4 grid ${getGridCols()} gap-4 auto-rows-fr`}>
        {/* Local Video */}
        <VideoTile stream={localStream} label="Sen" isMuted />
        
        {/* Remote Videos */}
        {peerArray.map((peer) => (
          <VideoTile
            key={peer.id}
            stream={peer.stream || null}
            label={`Kullanıcı ${peer.id.slice(0, 4)}`}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="p-4 bg-muted/50 flex items-center justify-center gap-4">
        <Button
          variant={isMuted ? "destructive" : "secondary"}
          size="lg"
          onClick={onToggleMute}
          className="rounded-full w-14 h-14"
        >
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>

        <Button
          variant={isVideoOff ? "destructive" : "secondary"}
          size="lg"
          onClick={onToggleVideo}
          className="rounded-full w-14 h-14"
        >
          {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
        </Button>

        <Button
          variant="destructive"
          size="lg"
          onClick={onLeave}
          className="rounded-full w-14 h-14"
        >
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
};
