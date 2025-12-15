import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/lib/chat-api";

interface ReplyPreviewProps {
  replyTo: ChatMessage;
  onCancel: () => void;
}

const ReplyPreview = ({ replyTo, onCancel }: ReplyPreviewProps) => {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-t border-border">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">
          Yanıtlanıyor: <span className="font-medium text-foreground">{replyTo.user?.nickname ?? "Bilinmeyen"}</span>
        </p>
        <p className="text-sm truncate text-muted-foreground">
          {replyTo.content || (replyTo.imageUrl ? "📎 Dosya" : "")}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={onCancel}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default ReplyPreview;
