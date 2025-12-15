import { useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Sticker categories with emojis
const STICKERS = {
  "İfadeler": ["😀", "😂", "🥹", "😍", "🥰", "😎", "🤔", "😅", "😢", "😭", "😤", "🤯"],
  "Jestler": ["👍", "👎", "👏", "🙌", "🤝", "✌️", "🤞", "👋", "💪", "🙏", "❤️", "💯"],
  "Hayvanlar": ["🐶", "🐱", "🐻", "🦊", "🐸", "🐵", "🦁", "🐯", "🐮", "🐷", "🐔", "🦄"],
  "Yiyecekler": ["🍕", "🍔", "🍟", "🌭", "🍿", "🧁", "🍩", "🍪", "☕", "🍦", "🍫", "🎂"],
};

interface StickerPickerProps {
  onStickerSelect: (sticker: string) => void;
  disabled?: boolean;
}

const StickerPicker = ({ onStickerSelect, disabled }: StickerPickerProps) => {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(Object.keys(STICKERS)[0]);

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
          className="h-10 w-10"
          disabled={disabled}
        >
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="flex gap-1 mb-2 border-b border-border pb-2">
          {Object.keys(STICKERS).map((category) => (
            <Button
              key={category}
              type="button"
              variant={activeCategory === category ? "secondary" : "ghost"}
              size="sm"
              className="text-xs px-2 py-1 h-7"
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-6 gap-1">
          {STICKERS[activeCategory as keyof typeof STICKERS].map((sticker) => (
            <button
              key={sticker}
              type="button"
              className="p-2 text-xl hover:bg-accent rounded-md transition-colors"
              onClick={() => handleSelect(sticker)}
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
