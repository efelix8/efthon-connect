import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { createRoom } from "@/lib/chat-api";

interface CreateRoomDialogProps {
  roomCount: number;
  maxRooms: number;
}

const CreateRoomDialog = ({ roomCount, maxRooms }: CreateRoomDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createRoomMutation = useMutation({
    mutationFn: () => createRoom(name),
    onSuccess: (room) => {
      setOpen(false);
      setName("");
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      toast({
        title: "Başarılı",
        description: `"${room.name}" odası oluşturuldu.`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Hata",
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createRoomMutation.mutate();
  };

  const isDisabled = roomCount >= maxRooms;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={isDisabled}
          title={isDisabled ? `Maksimum ${maxRooms} oda oluşturulabilir` : "Yeni oda oluştur"}
        >
          <Plus className="h-4 w-4 mr-1" />
          Yeni Oda
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Yeni Oda Oluştur</DialogTitle>
            <DialogDescription>
              Yeni bir sohbet odası oluşturun. ({roomCount}/{maxRooms} oda kullanılıyor)
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Input
                id="name"
                placeholder="Oda adı..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                minLength={2}
                required
              />
              <p className="text-xs text-muted-foreground">
                2-50 karakter arası olmalıdır.
              </p>
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
              disabled={createRoomMutation.isPending || !name.trim()}
            >
              {createRoomMutation.isPending ? "Oluşturuluyor..." : "Oluştur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRoomDialog;