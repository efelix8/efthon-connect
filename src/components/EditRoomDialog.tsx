import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
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
  isCreator: boolean;
}

export const EditRoomDialog = ({ roomId, roomSlug, currentName, isCreator }: EditRoomDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (newName: string) => {
      const { error } = await supabase
        .from("rooms")
        .update({ name: newName })
        .eq("id", roomId);
      
      if (error) throw error;
      return newName;
    },
    onSuccess: (newName) => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      toast({ title: "Başarılı", description: `Oda adı "${newName}" olarak güncellendi.` });
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Hata",
        description: error?.message ?? "Oda adı güncellenemedi.",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === currentName) return;
    updateMutation.mutate(name.trim());
  };

  if (!isCreator) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded hover:bg-accent/50 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Oda adını düzenle"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Oda Adını Düzenle</DialogTitle>
          <DialogDescription>
            Metin kanalının yeni adını girin.
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
              disabled={updateMutation.isPending || !name.trim() || name.trim() === currentName}
            >
              {updateMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
