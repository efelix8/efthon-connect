import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface RoomPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomName: string;
  roomSlug: string;
  onSuccess: () => void;
}

export const RoomPasswordDialog = ({
  open,
  onOpenChange,
  roomName,
  roomSlug,
  onSuccess,
}: RoomPasswordDialogProps) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { data, error: rpcError } = await supabase.rpc("verify_room_password", {
        room_slug: roomSlug,
        entered_password: password,
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      if (data === true) {
        setPassword("");
        onSuccess();
        onOpenChange(false);
      } else {
        setError("Yanlış şifre");
      }
    } catch (err) {
      console.error("Room password verification error:", err);
      setError("Doğrulama sırasında bir hata oluştu");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">{roomName}</DialogTitle>
          <DialogDescription className="text-center">
            Bu oda şifre korumalıdır. Devam etmek için şifreyi girin.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="room-password">Şifre</Label>
            <Input
              id="room-password"
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <Button className="w-full" type="submit" disabled={isLoading || !password.trim()}>
            {isLoading ? "Doğrulanıyor..." : "Giriş Yap"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
