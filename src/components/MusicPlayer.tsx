import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Music2, Shuffle, Repeat, Repeat1, Upload, Loader2, ImagePlus, X, RotateCcw, RotateCw, Gauge } from "lucide-react";
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
  { id: "4", title: "Kırmızı", artist: "Hande Yener", url: "/music/kirmizi.mp3", coverUrl: "/covers/kirmizi.jpg" },
  { id: "5", title: "Uçurum x Derine Derine", artist: "Turker Mashup", url: "/music/ucurum-derine-mashup.mp3", coverUrl: "/covers/ucurum-derine.png" },
  { id: "6", title: "Ortam 2.0", artist: "Organize x Lvbel C5 x Demet Akalın", url: "/music/ortam-organize.mp3", coverUrl: "/covers/ortam-2.png" },
  { id: "7", title: "Noluyo Lan!", artist: "Organize ft. Batuflex, Eray067, Mansur", url: "/music/noluyo-lan.mp3", coverUrl: "/covers/noluyo-lan.png" },
  { id: "8", title: "Cry For Me", artist: "The Weeknd", url: "/music/cry-for-me.mp3" },
  { id: "9", title: "Positions", artist: "Ariana Grande", url: "/music/positions.mp3", coverUrl: "/covers/positions.png" },
  { id: "10", title: "Wacuka", artist: "Chris Avantgarde", url: "/music/wacuka.mp3", coverUrl: "/covers/wacuka.png" },
  { id: "11", title: "Anchor Point", artist: "Ahmed Spins", url: "/music/anchor-point.mp3", coverUrl: "/covers/anchor-point.png" },
  { id: "12", title: "Aya Benzer", artist: "Mustafa Sandal", url: "/music/aya-benzer.mp3", coverUrl: "/covers/aya-benzer.png" },
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
  const [playbackRate, setPlaybackRate] = useState(1);
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

      {/* Player Controls - Large Style */}
      <div className="border-t border-border bg-card/95 backdrop-blur-md p-6">
        {/* Giant Cover Image */}
        <div className="flex justify-center mb-6">
          <div className="relative w-64 h-64 rounded-2xl overflow-hidden bg-primary/10 flex-shrink-0 shadow-2xl ring-1 ring-white/10">
            {currentTrack.coverUrl ? (
              <img 
                src={currentTrack.coverUrl} 
                alt={currentTrack.title}
                className={cn(
                  "w-full h-full object-cover transition-transform duration-500",
                  isPlaying && "scale-105"
                )}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/30 to-primary/5">
                <Music2 className="w-24 h-24 text-primary/60" />
              </div>
            )}
            {isPlaying && (
              <div className="absolute bottom-2 right-2 w-4 h-4 bg-primary rounded-full animate-pulse" />
            )}
          </div>
        </div>

        {/* Track Info */}
        <div className="text-center mb-4">
          <p className="font-bold text-lg truncate">{currentTrack.title}</p>
          <p className="text-sm text-muted-foreground truncate">{currentTrack.artist}</p>
        </div>

        {/* Progress Bar */}
        <div className="group relative mb-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-10 text-right font-mono">{formatTime(currentTime)}</span>
            <div className="flex-1 relative h-6 flex items-center">
              <div className="absolute inset-x-0 h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 bg-primary/60 group-hover:bg-primary transition-colors rounded-full"
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={0.1}
                onValueChange={handleSeek}
                className="absolute inset-0 cursor-pointer [&_[data-slot=track]]:bg-transparent [&_[data-slot=range]]:bg-transparent [&_[data-slot=thumb]]:w-4 [&_[data-slot=thumb]]:h-4 [&_[data-slot=thumb]]:opacity-0 group-hover:[&_[data-slot=thumb]]:opacity-100 [&_[data-slot=thumb]]:transition-opacity [&_[data-slot=thumb]]:bg-foreground [&_[data-slot=thumb]]:border-0 [&_[data-slot=thumb]]:shadow-lg"
              />
            </div>
            <span className="text-xs text-muted-foreground w-10 font-mono">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleShuffle}
            className={cn("h-10 w-10", isShuffleOn && "text-primary")}
            title={isShuffleOn ? "Karıştır: Açık" : "Karıştır: Kapalı"}
          >
            <Shuffle className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handlePrevious} className="h-10 w-10" title="Önceki şarkı">
            <SkipBack className="h-6 w-6" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
              }
            }}
            className="h-10 w-10"
            title="10 saniye geri"
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
          <Button 
            size="icon" 
            onClick={togglePlay}
            className="h-14 w-14 rounded-full"
          >
            {isPlaying ? (
              <Pause className="h-7 w-7" />
            ) : (
              <Play className="h-7 w-7 ml-1" />
            )}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 10);
              }
            }}
            className="h-10 w-10"
            title="10 saniye ileri"
          >
            <RotateCw className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleNext} className="h-10 w-10" title="Sonraki şarkı">
            <SkipForward className="h-6 w-6" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleRepeat}
            className={cn("h-10 w-10", repeatMode !== "off" && "text-primary")}
            title={
              repeatMode === "off" ? "Tekrar: Kapalı" : 
              repeatMode === "all" ? "Tekrar: Tümü" : "Tekrar: Bir"
            }
          >
            {repeatMode === "one" ? (
              <Repeat1 className="h-5 w-5" />
            ) : (
              <Repeat className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Volume & Speed Controls */}
        <div className="flex items-center justify-center gap-6">
          {/* Volume */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleMute} className="h-9 w-9">
              {isMuted || volume === 0 ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
              max={1}
              step={0.01}
              onValueChange={handleVolumeChange}
              className="w-24 cursor-pointer"
            />
          </div>

          {/* Speed Control */}
          <div className="flex items-center gap-2 flex-1 max-w-xs">
            <Gauge className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground w-8 text-right">0.4x</span>
            <Slider
              value={[playbackRate]}
              min={0.4}
              max={1.5}
              step={0.01}
              onValueChange={(value) => {
                setPlaybackRate(value[0]);
                if (audioRef.current) {
                  audioRef.current.playbackRate = value[0];
                  audioRef.current.preservesPitch = false;
                }
              }}
              className="flex-1 cursor-pointer"
            />
            <span className="text-xs text-muted-foreground w-8">1.5x</span>
            <span className="text-sm font-mono font-bold text-primary w-12 text-center">{playbackRate.toFixed(2)}x</span>
          </div>
        </div>
      </div>


      <audio ref={audioRef} src={currentTrack.url} preload="metadata" />
    </div>
  );
};

export default MusicPlayer;
