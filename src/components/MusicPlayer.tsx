import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Music2, Shuffle, Repeat, Repeat1 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface Track {
  id: number;
  title: string;
  artist: string;
  url: string;
}

const tracks: Track[] = [
  { id: 1, title: "Move x Asrın Hatası", artist: "Adam Port x Serdar Ortaç (Mashup)", url: "/music/move-asrin-hatasi-mashup.mp3" },
  { id: 2, title: "Ex Aşkım", artist: "Unknown", url: "/music/ex-askim.mp3" },
  { id: 3, title: "Sopa (Dance Remix)", artist: "Hande Yener", url: "/music/sopa-dance-remix.mp3" },
  { id: 4, title: "Kırmızı", artist: "Hande Yener", url: "/music/kirmizi.mp3" },
  { id: 5, title: "Uçurum x Derine Derine", artist: "Turker Mashup", url: "/music/ucurum-derine-mashup.mp3" },
  { id: 6, title: "Ortam 2.0", artist: "Organize x Lvbel C5 x Demet Akalın", url: "/music/ortam-organize.mp3" },
  { id: 7, title: "Noluyo Lan!", artist: "Organize ft. Batuflex, Eray067, Mansur", url: "/music/noluyo-lan.mp3" },
  { id: 8, title: "Cry For Me", artist: "The Weeknd", url: "/music/cry-for-me.mp3" },
];

type RepeatMode = "off" | "all" | "one";

const MusicPlayer = () => {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffleOn, setIsShuffleOn] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [shuffleHistory, setShuffleHistory] = useState<number[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  const currentTrack = tracks[currentTrackIndex];

  const getRandomTrackIndex = useCallback((excludeIndex: number): number => {
    if (tracks.length <= 1) return 0;
    let randomIndex: number;
    do {
      randomIndex = Math.floor(Math.random() * tracks.length);
    } while (randomIndex === excludeIndex);
    return randomIndex;
  }, []);

  const handleNext = useCallback(() => {
    let newIndex: number;
    
    if (repeatMode === "one") {
      // Repeat current track
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
      return;
    }
    
    if (isShuffleOn) {
      newIndex = getRandomTrackIndex(currentTrackIndex);
      setShuffleHistory(prev => [...prev, currentTrackIndex]);
    } else {
      newIndex = currentTrackIndex === tracks.length - 1 ? 0 : currentTrackIndex + 1;
      // If repeat is off and we reached the end, stop
      if (repeatMode === "off" && currentTrackIndex === tracks.length - 1) {
        setIsPlaying(false);
        return;
      }
    }
    
    setCurrentTrackIndex(newIndex);
    setIsPlaying(true);
    setTimeout(() => audioRef.current?.play(), 100);
  }, [currentTrackIndex, isShuffleOn, repeatMode, getRandomTrackIndex]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => handleNext();

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [handleNext]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handlePrevious = () => {
    let newIndex: number;
    
    // If we're more than 3 seconds into the song, restart it
    if (currentTime > 3) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
      return;
    }
    
    if (isShuffleOn && shuffleHistory.length > 0) {
      // Go back in shuffle history
      newIndex = shuffleHistory[shuffleHistory.length - 1];
      setShuffleHistory(prev => prev.slice(0, -1));
    } else {
      newIndex = currentTrackIndex === 0 ? tracks.length - 1 : currentTrackIndex - 1;
    }
    
    setCurrentTrackIndex(newIndex);
    setIsPlaying(true);
    setTimeout(() => audioRef.current?.play(), 100);
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    setIsMuted(false);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleShuffle = () => {
    setIsShuffleOn(!isShuffleOn);
    if (!isShuffleOn) {
      setShuffleHistory([]);
    }
  };

  const toggleRepeat = () => {
    const modes: RepeatMode[] = ["off", "all", "one"];
    const currentIndex = modes.indexOf(repeatMode);
    setRepeatMode(modes[(currentIndex + 1) % modes.length]);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const selectTrack = (index: number) => {
    if (isShuffleOn) {
      setShuffleHistory(prev => [...prev, currentTrackIndex]);
    }
    setCurrentTrackIndex(index);
    setIsPlaying(true);
    setTimeout(() => audioRef.current?.play(), 100);
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-card to-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Music2 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Müzik Çalar</h2>
      </div>

      {/* Track List */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {tracks.map((track, index) => (
            <button
              key={track.id}
              onClick={() => selectTrack(index)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
                index === currentTrackIndex
                  ? "bg-primary/20 text-primary"
                  : "hover:bg-accent text-foreground"
              )}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                {index === currentTrackIndex && isPlaying ? (
                  <div className="flex items-center gap-0.5">
                    <span className="w-0.5 h-3 bg-primary animate-pulse" />
                    <span className="w-0.5 h-4 bg-primary animate-pulse delay-75" />
                    <span className="w-0.5 h-2 bg-primary animate-pulse delay-150" />
                  </div>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">{index + 1}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{track.title}</p>
                <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Player Controls */}
      <div className="border-t border-border bg-card/80 backdrop-blur-sm p-4 space-y-3">
        {/* Current Track Info */}
        <div className="text-center">
          <p className="text-sm font-semibold truncate">{currentTrack.title}</p>
          <p className="text-xs text-muted-foreground truncate">{currentTrack.artist}</p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={1}
            onValueChange={handleSeek}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleShuffle}
            className={cn("h-9 w-9", isShuffleOn && "text-primary")}
            title={isShuffleOn ? "Karıştır: Açık" : "Karıştır: Kapalı"}
          >
            <Shuffle className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handlePrevious}>
            <SkipBack className="h-5 w-5" />
          </Button>
          <Button 
            size="icon" 
            onClick={togglePlay}
            className="h-12 w-12 rounded-full"
          >
            {isPlaying ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="h-6 w-6 ml-0.5" />
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={handleNext}>
            <SkipForward className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleRepeat}
            className={cn("h-9 w-9", repeatMode !== "off" && "text-primary")}
            title={
              repeatMode === "off" ? "Tekrar: Kapalı" : 
              repeatMode === "all" ? "Tekrar: Tümü" : "Tekrar: Bir"
            }
          >
            {repeatMode === "one" ? (
              <Repeat1 className="h-4 w-4" />
            ) : (
              <Repeat className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleMute} className="h-8 w-8">
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            max={1}
            step={0.01}
            onValueChange={handleVolumeChange}
            className="flex-1 cursor-pointer"
          />
        </div>
      </div>

      <audio ref={audioRef} src={currentTrack.url} preload="metadata" />
    </div>
  );
};

export default MusicPlayer;
