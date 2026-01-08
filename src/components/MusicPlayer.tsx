import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Music2, Shuffle, Repeat, Repeat1, Upload, Loader2, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Track {
  id: string;
  title: string;
  artist: string;
  url: string;
  coverUrl?: string;
}

const defaultTracks: Track[] = [
  { id: "1", title: "Move x Asrın Hatası", artist: "Adam Port x Serdar Ortaç (Mashup)", url: "/music/move-asrin-hatasi-mashup.mp3", coverUrl: "/covers/move-asrin-hatasi.png" },
  { id: "2", title: "Ex Aşkım", artist: "Kenan Doğulu", url: "/music/ex-askim.mp3", coverUrl: "/covers/ex-askim.png" },
  { id: "3", title: "Sopa (Dance Remix)", artist: "Hande Yener", url: "/music/sopa-dance-remix.mp3", coverUrl: "/covers/sopa-dance-remix.png" },
  { id: "4", title: "Kırmızı", artist: "Hande Yener", url: "/music/kirmizi.mp3" },
  { id: "5", title: "Uçurum x Derine Derine", artist: "Turker Mashup", url: "/music/ucurum-derine-mashup.mp3", coverUrl: "/covers/ucurum-derine.png" },
  { id: "6", title: "Ortam 2.0", artist: "Organize x Lvbel C5 x Demet Akalın", url: "/music/ortam-organize.mp3" },
  { id: "7", title: "Noluyo Lan!", artist: "Organize ft. Batuflex, Eray067, Mansur", url: "/music/noluyo-lan.mp3" },
  { id: "8", title: "Cry For Me", artist: "The Weeknd", url: "/music/cry-for-me.mp3" },
];

type RepeatMode = "off" | "all" | "one";

const MusicPlayer = () => {
  const [tracks, setTracks] = useState<Track[]>(defaultTracks);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // Fetch uploaded tracks from database
  useEffect(() => {
    const fetchUploadedTracks = async () => {
      const { data, error } = await supabase
        .from('music_tracks')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        const uploadedTracks: Track[] = data.map(t => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          url: t.file_url,
          coverUrl: t.cover_url || undefined
        }));
        setTracks([...defaultTracks, ...uploadedTracks]);
      }
    };

    fetchUploadedTracks();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('music-tracks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'music_tracks' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newTrack: Track = {
            id: payload.new.id,
            title: payload.new.title,
            artist: payload.new.artist,
            url: payload.new.file_url,
            coverUrl: payload.new.cover_url || undefined
          };
          setTracks(prev => [...prev, newTrack]);
        } else if (payload.eventType === 'UPDATE') {
          setTracks(prev => prev.map(t => 
            t.id === payload.new.id 
              ? { ...t, coverUrl: payload.new.cover_url || undefined }
              : t
          ));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('audio/')) {
      toast.error('Sadece MP3 dosyaları yüklenebilir');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error('Dosya boyutu 50MB\'dan küçük olmalı');
      return;
    }

    setIsUploading(true);

    try {
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      const { error: uploadError } = await supabase.storage
        .from('music')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('music')
        .getPublicUrl(fileName);

      // Extract title from filename
      const title = file.name.replace(/\.mp3$/i, '').replace(/_/g, ' ');

      const { error: dbError } = await supabase
        .from('music_tracks')
        .insert({
          title,
          artist: 'Yüklenen Şarkı',
          file_url: publicUrl
        });

      if (dbError) throw dbError;

      toast.success('Şarkı başarıyla yüklendi!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Şarkı yüklenirken hata oluştu');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

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

  const handleCoverUpload = async (trackId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Sadece resim dosyaları yüklenebilir');
      return;
    }

    try {
      const fileName = `covers/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      const { error: uploadError } = await supabase.storage
        .from('music')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('music')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('music_tracks')
        .update({ cover_url: publicUrl })
        .eq('id', trackId);

      if (dbError) throw dbError;

      setTracks(prev => prev.map(t => 
        t.id === trackId ? { ...t, coverUrl: publicUrl } : t
      ));

      toast.success('Kapak görseli eklendi!');
    } catch (error) {
      console.error('Cover upload error:', error);
      toast.error('Kapak görseli yüklenirken hata oluştu');
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-card to-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Music2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Müzik Çalar</h2>
        </div>
        <div>
          <input
            type="file"
            ref={fileInputRef}
            accept="audio/mpeg,audio/mp3"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="gap-1.5"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {isUploading ? 'Yükleniyor...' : 'Şarkı Yükle'}
          </Button>
        </div>
      </div>

      {/* Track List */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {tracks.map((track, index) => {
            const isDbTrack = !defaultTracks.some(dt => dt.id === track.id);
            return (
              <div
                key={track.id}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                  index === currentTrackIndex
                    ? "bg-primary/20 text-primary"
                    : "hover:bg-accent text-foreground"
                )}
              >
                <button
                  onClick={() => selectTrack(index)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  {/* Cover or Index */}
                  <div className="relative w-10 h-10 rounded-md bg-primary/10 flex-shrink-0 overflow-hidden">
                    {track.coverUrl ? (
                      <img 
                        src={track.coverUrl} 
                        alt={track.title}
                        className="w-full h-full object-cover"
                      />
                    ) : index === currentTrackIndex && isPlaying ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="flex items-center gap-0.5">
                          <span className="w-0.5 h-3 bg-primary animate-pulse" />
                          <span className="w-0.5 h-4 bg-primary animate-pulse delay-75" />
                          <span className="w-0.5 h-2 bg-primary animate-pulse delay-150" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music2 className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{track.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                  </div>
                </button>
                {/* Cover upload button - for all tracks */}
                <label className="cursor-pointer p-1.5 rounded-md hover:bg-accent/80 transition-colors" title="Kapak görseli ekle/değiştir">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleCoverUpload(track.id, file);
                      e.target.value = '';
                    }}
                  />
                  <ImagePlus className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {/* Player Controls */}
      <div className="border-t border-border bg-card/80 backdrop-blur-sm p-4 space-y-3">
        {/* Large Cover Preview */}
        <div className="flex items-center gap-4">
          <div className={cn(
            "relative rounded-xl overflow-hidden bg-primary/10 flex-shrink-0 transition-all duration-300 shadow-lg",
            isPlaying ? "w-28 h-28" : "w-24 h-24"
          )}>
            {currentTrack.coverUrl ? (
              <img 
                src={currentTrack.coverUrl} 
                alt={currentTrack.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                <Music2 className={cn(
                  "text-primary/60 transition-all",
                  isPlaying ? "w-12 h-12" : "w-10 h-10"
                )} />
              </div>
            )}
            {isPlaying && currentTrack.coverUrl && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{currentTrack.title}</p>
            <p className="text-sm text-muted-foreground truncate">{currentTrack.artist}</p>
          </div>
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
