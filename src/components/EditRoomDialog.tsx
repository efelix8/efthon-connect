import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, ImagePlus, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface EditRoomDialogProps {
  roomId: string;
  roomSlug: string;
  currentName: string;
  currentBackgroundUrl?: string | null;
  isCreator: boolean;
}

export const EditRoomDialog = ({ roomId, roomSlug, currentName, currentBackgroundUrl, isCreator }: EditRoomDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [backgroundUrl, setBackgroundUrl] = useState(currentBackgroundUrl || "");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async ({ newName, newBackgroundUrl }: { newName: string; newBackgroundUrl: string | null }) => {
      const { error } = await supabase
        .from("rooms")
        .update({ 
          name: newName,
          background_url: newBackgroundUrl 
        })
        .eq("id", roomId);
      
      if (error) throw error;
      return { newName, newBackgroundUrl };
    },
    onSuccess: ({ newName }) => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      toast({ title: "Başarılı", description: `Oda ayarları güncellendi.` });
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Hata",
        description: error?.message ?? "Oda ayarları güncellenemedi.",
      });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ variant: "destructive", title: "Hata", description: "Sadece resim dosyaları yüklenebilir" });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Hata", description: "Dosya boyutu 10MB'dan küçük olmalı" });
      return;
    }

    setIsUploading(true);

    try {
      const fileName = `room-backgrounds/${roomId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(fileName);

      setBackgroundUrl(publicUrl);
      toast({ title: "Başarılı", description: "Arka plan fotoğrafı yüklendi" });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ variant: "destructive", title: "Hata", description: "Fotoğraf yüklenirken hata oluştu" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveBackground = () => {
    setBackgroundUrl("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    updateMutation.mutate({ 
      newName: name.trim(), 
      newBackgroundUrl: backgroundUrl || null 
    });
  };

  if (!isCreator) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded hover:bg-accent/50 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Oda ayarlarını düzenle"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Oda Ayarlarını Düzenle</DialogTitle>
          <DialogDescription>
            Metin kanalının adını ve arka plan fotoğrafını düzenleyin.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="room-name">Oda Adı</Label>
              <Input
                id="room-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Oda adı"
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label>Arka Plan Fotoğrafı</Label>
              <p className="text-xs text-muted-foreground">
                Fotoğraf otomatik olarak %90 opaklık ile gösterilecektir.
              </p>
              
              {backgroundUrl ? (
                <div className="relative w-full h-32 rounded-lg overflow-hidden border border-border">
                  <img 
                    src={backgroundUrl} 
                    alt="Arka plan önizleme" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-background/90 flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">%90 opaklık önizlemesi</span>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={handleRemoveBackground}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="gap-2"
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                    {isUploading ? 'Yükleniyor...' : 'Fotoğraf Seç'}
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              İptal
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending || !name.trim()}
            >
              {updateMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
