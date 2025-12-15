import { useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Import custom stickers
import divanSticker from "@/assets/stickers/divan.png";
import herseySticker from "@/assets/stickers/hersey.png";
import imagesSticker from "@/assets/stickers/images.jpg";
import cinemaSticker from "@/assets/stickers/cinema.png";
import omerSticker from "@/assets/stickers/omer.png";
import chatgptSticker from "@/assets/stickers/chatgpt.png";
import galoisSticker from "@/assets/stickers/galois.jpg";
import shhSticker from "@/assets/stickers/shh.jpg";

const EMOJI_STICKERS = [
  "😀", "😂", "🤣", "😍", "🥰", "😎", "🤩", "😇",
  "🥳", "😏", "🤔", "🤯", "😱", "🥺", "😭", "😤",
  "👍", "👎", "👏", "🙌", "🤝", "💪", "✌️", "🤟",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "💔",
  "🔥", "⭐", "🌟", "✨", "💯", "💥", "💫", "🎉",
  "🎊", "🎁", "🏆", "🥇", "🎯", "🚀", "💡", "📌",
];

const CUSTOM_STICKERS = [
  { id: "divan", src: divanSticker, alt: "Divan" },
  { id: "hersey", src: herseySticker, alt: "Her şeyi bilen biri" },
  { id: "images", src: imagesSticker, alt: "Images" },
  { id: "cinema", src: cinemaSticker, alt: "Absolute Cinema" },
  { id: "omer", src: omerSticker, alt: "Ömer" },
  { id: "chatgpt", src: chatgptSticker, alt: "ChatGPT" },
  { id: "galois", src: galoisSticker, alt: "Galois" },
  { id: "shh", src: shhSticker, alt: "Shh" },
];

interface StickerPickerProps {
  onStickerSelect: (sticker: string) => void;
  onImageStickerSelect?: (imageUrl: string) => void;
  disabled?: boolean;
}

const StickerPicker = ({ onStickerSelect, onImageStickerSelect, disabled }: StickerPickerProps) => {
  const [open, setOpen] = useState(false);

  const handleEmojiSelect = (sticker: string) => {
    onStickerSelect(sticker);
    setOpen(false);
  };

  const handleImageSelect = (imageUrl: string) => {
    if (onImageStickerSelect) {
      onImageStickerSelect(imageUrl);
    }
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
      <PopoverContent className="w-80 p-2" align="start">
        <Tabs defaultValue="custom" className="w-full">
          <TabsList className="w-full mb-2">
            <TabsTrigger value="custom" className="flex-1">Özel</TabsTrigger>
            <TabsTrigger value="emoji" className="flex-1">Emoji</TabsTrigger>
          </TabsList>
          <TabsContent value="custom" className="mt-0">
            <div className="grid grid-cols-4 gap-2">
              {CUSTOM_STICKERS.map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  onClick={() => handleImageSelect(sticker.src)}
                  className="flex items-center justify-center rounded-md p-1 hover:bg-accent transition-colors aspect-square overflow-hidden"
                >
                  <img
                    src={sticker.src}
                    alt={sticker.alt}
                    className="w-full h-full object-cover rounded"
                  />
                </button>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="emoji" className="mt-0">
            <div className="grid grid-cols-8 gap-1">
              {EMOJI_STICKERS.map((sticker) => (
                <button
                  key={sticker}
                  type="button"
                  onClick={() => handleEmojiSelect(sticker)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-accent transition-colors"
                >
                  {sticker}
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
};

export default StickerPicker;
