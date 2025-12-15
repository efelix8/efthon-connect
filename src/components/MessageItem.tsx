import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, X, Check, FileText, ExternalLink } from "lucide-react";

import { editMessage, deleteMessage, type ChatMessage } from "@/lib/chat-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface MessageItemProps {
  message: ChatMessage;
  isOwn: boolean;
  activeRoomSlug: string;
}

const isPdfUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  return url.toLowerCase().endsWith(".pdf");
};

const MessageItem = ({ message, isOwn, activeRoomSlug }: MessageItemProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [imageExpanded, setImageExpanded] = useState(false);

  const editMutation = useMutation({
    mutationFn: () => editMessage(message.id, editContent),
    onSuccess: () => {
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["messages", activeRoomSlug] });
      toast({ title: "Başarılı", description: "Mesaj düzenlendi." });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Hata", description: error?.message ?? "Mesaj düzenlenemedi." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteMessage(message.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", activeRoomSlug] });
      toast({ title: "Başarılı", description: "Mesaj silindi." });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Hata", description: error?.message ?? "Mesaj silinemedi." });
    },
  });

  const handleEdit = () => {
    if (!editContent.trim()) return;
    editMutation.mutate();
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(message.content);
  };

  const isPdf = isPdfUrl(message.imageUrl);

  return (
    <div className="group space-y-1 rounded-md bg-card/60 p-3 text-sm shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{message.user?.nickname ?? "Bilinmeyen"}</span>
          {message.editedAt && (
            <span className="text-[10px] text-muted-foreground">(düzenlendi)</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">
            {new Date(message.createdAt).toLocaleTimeString("tr-TR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {isOwn && !isEditing && (
            <div className="ml-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsEditing(true)}
                disabled={editMutation.isPending || deleteMutation.isPending}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={() => deleteMutation.mutate()}
                disabled={editMutation.isPending || deleteMutation.isPending}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
      
      {isEditing ? (
        <div className="flex gap-2">
          <Input
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="h-8 text-sm"
            disabled={editMutation.isPending}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleEdit}
            disabled={editMutation.isPending || !editContent.trim()}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleCancelEdit}
            disabled={editMutation.isPending}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {message.content && (
            <p className="text-sm leading-snug text-foreground">{message.content}</p>
          )}
          {message.imageUrl && (
            isPdf ? (
              <a
                href={message.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-3 hover:bg-muted transition-colors"
              >
                <FileText className="h-8 w-8 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">PDF Dosyası</p>
                  <p className="text-xs text-muted-foreground">Görüntülemek için tıklayın</p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
            ) : (
              <div className="relative">
                <img
                  src={message.imageUrl}
                  alt="Paylaşılan fotoğraf"
                  className={`rounded-md border border-border cursor-pointer transition-all ${
                    imageExpanded ? "max-w-full" : "max-w-xs max-h-48 object-cover"
                  }`}
                  onClick={() => setImageExpanded(!imageExpanded)}
                  loading="lazy"
                />
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default MessageItem;