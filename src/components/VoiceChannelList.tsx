import { Volume2, Mic, MicOff, Headphones, HeadphoneOff, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface VoiceChannelListProps {
  voiceRooms: VoiceRoom[];
  participants: Map<string, VoiceParticipant[]>;
  currentRoom: VoiceRoom | null;
  currentUserId: string | null;
  onJoinRoom: (room: VoiceRoom) => void;
}

export const VoiceChannelList = ({
  voiceRooms,
  participants,
  currentRoom,
  currentUserId,
  onJoinRoom,
}: VoiceChannelListProps) => {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-2">
        Ses Kanalları
      </h3>
      {voiceRooms.map((room) => {
        const roomParticipants = participants.get(room.id) || [];
        const isCurrentRoom = currentRoom?.id === room.id;

        return (
          <div key={room.id} className="space-y-0.5">
            <button
              type="button"
              onClick={() => !isCurrentRoom && onJoinRoom(room)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                isCurrentRoom
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Volume2 className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{room.name}</span>
            </button>

            {/* Connected users */}
            {roomParticipants.length > 0 && (
              <div className="ml-4 space-y-0.5">
                {roomParticipants.map((participant) => (
                  <div
                    key={participant.id}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1 text-xs",
                      participant.user_id === currentUserId
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    <div className="relative">
                      <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-medium">
                        {participant.nickname?.charAt(0).toUpperCase() || "?"}
                      </div>
                      {/* Speaking indicator */}
                      <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 border border-background" />
                    </div>
                    <span className="truncate flex-1">
                      {participant.nickname || "Anonim"}
                    </span>
                    {participant.is_muted && (
                      <MicOff className="h-3 w-3 text-destructive" />
                    )}
                    {participant.is_deafened && (
                      <HeadphoneOff className="h-3 w-3 text-destructive" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

interface VoiceControlBarProps {
  currentRoom: VoiceRoom | null;
  isMuted: boolean;
  isDeafened: boolean;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onLeave: () => void;
}

export const VoiceControlBar = ({
  currentRoom,
  isMuted,
  isDeafened,
  onToggleMute,
  onToggleDeafen,
  onLeave,
}: VoiceControlBarProps) => {
  if (!currentRoom) return null;

  return (
    <div className="border-t border-border bg-card/80 p-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-green-500 truncate">
            {currentRoom.name}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleMute}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              isMuted
                ? "bg-destructive/20 text-destructive"
                : "hover:bg-accent text-muted-foreground"
            )}
            title={isMuted ? "Sesi aç" : "Sessize al"}
          >
            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onToggleDeafen}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              isDeafened
                ? "bg-destructive/20 text-destructive"
                : "hover:bg-accent text-muted-foreground"
            )}
            title={isDeafened ? "Kulaklığı aç" : "Sağır modu"}
          >
            {isDeafened ? (
              <HeadphoneOff className="h-4 w-4" />
            ) : (
              <Headphones className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="p-1.5 rounded-md bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors"
            title="Bağlantıyı kes"
          >
            <PhoneOff className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};