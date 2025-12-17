import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, PencilBrush } from "fabric";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eraser, Pencil, Trash2, Send } from "lucide-react";
import { uploadChatImage } from "@/lib/chat-api";
import { toast } from "@/hooks/use-toast";

interface DrawingCanvasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onImageSend: (imageUrl: string) => void;
  disabled?: boolean;
}

const COLORS = [
  "#000000", "#ffffff", "#ef4444", "#f97316", "#eab308", 
  "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"
];

export const DrawingCanvas = ({
  open,
  onOpenChange,
  userId,
  onImageSend,
  disabled,
}: DrawingCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [activeColor, setActiveColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(4);
  const [isEraser, setIsEraser] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!open || !canvasRef.current) return;

    // Small delay to ensure dialog is rendered
    const timer = setTimeout(() => {
      if (!canvasRef.current) return;
      
      const canvas = new FabricCanvas(canvasRef.current, {
        width: 400,
        height: 300,
        backgroundColor: "#ffffff",
        isDrawingMode: true,
      });

      const brush = new PencilBrush(canvas);
      brush.color = activeColor;
      brush.width = brushSize;
      canvas.freeDrawingBrush = brush;

      setFabricCanvas(canvas);
    }, 100);

    return () => {
      clearTimeout(timer);
      fabricCanvas?.dispose();
      setFabricCanvas(null);
    };
  }, [open]);

  useEffect(() => {
    if (!fabricCanvas?.freeDrawingBrush) return;
    
    if (isEraser) {
      fabricCanvas.freeDrawingBrush.color = "#ffffff";
      fabricCanvas.freeDrawingBrush.width = brushSize * 3;
    } else {
      fabricCanvas.freeDrawingBrush.color = activeColor;
      fabricCanvas.freeDrawingBrush.width = brushSize;
    }
  }, [activeColor, brushSize, isEraser, fabricCanvas]);

  const handleClear = () => {
    if (!fabricCanvas) return;
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = "#ffffff";
    fabricCanvas.renderAll();
  };

  const handleSend = async () => {
    if (!fabricCanvas) return;
    
    setIsSending(true);
    try {
      const dataUrl = fabricCanvas.toDataURL({
        format: "png",
        quality: 1,
        multiplier: 2,
      });

      // Convert data URL to Blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `drawing-${Date.now()}.png`, { type: "image/png" });

      // Upload to storage
      const imageUrl = await uploadChatImage(file, userId);
      
      onImageSend(imageUrl);
      onOpenChange(false);
      handleClear();
    } catch (error) {
      console.error("Failed to send drawing:", error);
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Çizim gönderilemedi.",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Çizim Yap</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3">
          {/* Color picker */}
          <div className="flex items-center gap-2 flex-wrap">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  setActiveColor(color);
                  setIsEraser(false);
                }}
                className={`h-7 w-7 rounded-full border-2 transition-transform ${
                  activeColor === color && !isEraser
                    ? "border-primary scale-110"
                    : "border-border"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          {/* Tools */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={!isEraser ? "default" : "outline"}
              size="sm"
              onClick={() => setIsEraser(false)}
            >
              <Pencil className="h-4 w-4 mr-1" />
              Kalem
            </Button>
            <Button
              type="button"
              variant={isEraser ? "default" : "outline"}
              size="sm"
              onClick={() => setIsEraser(true)}
            >
              <Eraser className="h-4 w-4 mr-1" />
              Silgi
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClear}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Temizle
            </Button>
            
            {/* Brush size */}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground">Boyut:</span>
              <input
                type="range"
                min="1"
                max="20"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-20 h-2"
              />
            </div>
          </div>

          {/* Canvas */}
          <div className="border border-border rounded-lg overflow-hidden bg-white">
            <canvas ref={canvasRef} />
          </div>

          {/* Send button */}
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleSend}
              disabled={isSending || disabled}
            >
              <Send className="h-4 w-4 mr-1" />
              {isSending ? "Gönderiliyor..." : "Gönder"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
