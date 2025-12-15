import { useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const STICKERS = [
  "😀", "😂", "🤣", "😍", "🥰", "😎", "🤩", "😇",
  "🥳", "😏", "🤔", "🤯", "😱", "🥺", "😭", "😤",
  "👍", "👎", "👏", "🙌", "🤝", "💪", "✌️", "🤟",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "💔",
  "🔥", "⭐", "🌟", "✨", "💯", "💥", "💫", "🎉",
  "🎊", "🎁", "🏆", "🥇", "🎯", "🚀", "💡", "📌",
];

interface StickerPickerProps {
  onStickerSelect: (sticker: string) => void;
  disabled?: boolean;
}

const StickerPicker = ({ onStickerSelect, disabled }: StickerPickerProps) => {
  const [open, setOpen] = useState(false);

  const handleSelect = (sticker: string) => {
    onStickerSelect(sticker);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={disabled}
        >
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="grid grid-cols-8 gap-1">
          {STICKERS.map((sticker) => (
            <button
              key={sticker}
              type="button"
              onClick={() => handleSelect(sticker)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-accent transition-colors"
            >
              {sticker}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default StickerPicker;
