import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas as FabricCanvas, PencilBrush, Rect, Circle, Line, IText, FabricObject, Triangle } from "fabric";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Eraser, Pencil, Trash2, Send, Square, CircleIcon, 
  Minus, Type, Undo2, Redo2, Download, MousePointer,
  Triangle as TriangleIcon, ArrowRight
} from "lucide-react";
import { uploadChatImage } from "@/lib/chat-api";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface DrawingCanvasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onImageSend: (imageUrl: string) => void;
  disabled?: boolean;
}

const COLORS = [
  "#000000", "#ffffff", "#94a3b8", "#ef4444", "#f97316", 
  "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", 
  "#ec4899", "#f43f5e"
];

type Tool = "select" | "pencil" | "eraser" | "rectangle" | "circle" | "triangle" | "line" | "arrow" | "text";

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
  const [fillColor, setFillColor] = useState("transparent");
  const [brushSize, setBrushSize] = useState(4);
  const [activeTool, setActiveTool] = useState<Tool>("pencil");
  const [isSending, setIsSending] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedo = useRef(false);

  // Save state to history
  const saveToHistory = useCallback(() => {
    if (!fabricCanvas || isUndoRedo.current) return;
    
    const json = JSON.stringify(fabricCanvas.toJSON());
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      return [...newHistory, json];
    });
    setHistoryIndex(prev => prev + 1);
  }, [fabricCanvas, historyIndex]);

  useEffect(() => {
    if (!open || !canvasRef.current) return;

    const timer = setTimeout(() => {
      if (!canvasRef.current) return;
      
      const canvas = new FabricCanvas(canvasRef.current, {
        width: 500,
        height: 400,
        backgroundColor: "#ffffff",
        isDrawingMode: true,
        selection: true,
      });

      const brush = new PencilBrush(canvas);
      brush.color = activeColor;
      brush.width = brushSize;
      canvas.freeDrawingBrush = brush;

      // Save initial state
      const initialJson = JSON.stringify(canvas.toJSON());
      setHistory([initialJson]);
      setHistoryIndex(0);

      // Listen for object modifications
      canvas.on('object:added', () => saveToHistory());
      canvas.on('object:modified', () => saveToHistory());
      canvas.on('object:removed', () => saveToHistory());

      setFabricCanvas(canvas);
    }, 100);

    return () => {
      clearTimeout(timer);
      fabricCanvas?.dispose();
      setFabricCanvas(null);
      setHistory([]);
      setHistoryIndex(-1);
    };
  }, [open]);

  // Update brush when tool or color changes
  useEffect(() => {
    if (!fabricCanvas) return;

    if (activeTool === "pencil") {
      fabricCanvas.isDrawingMode = true;
      if (fabricCanvas.freeDrawingBrush) {
        fabricCanvas.freeDrawingBrush.color = activeColor;
        fabricCanvas.freeDrawingBrush.width = brushSize;
      }
    } else if (activeTool === "eraser") {
      fabricCanvas.isDrawingMode = true;
      if (fabricCanvas.freeDrawingBrush) {
        fabricCanvas.freeDrawingBrush.color = "#ffffff";
        fabricCanvas.freeDrawingBrush.width = brushSize * 3;
      }
    } else {
      fabricCanvas.isDrawingMode = false;
    }
  }, [activeTool, activeColor, brushSize, fabricCanvas]);

  // Handle shape creation
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!fabricCanvas || activeTool === "pencil" || activeTool === "eraser" || activeTool === "select") return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let shape: FabricObject | null = null;

    switch (activeTool) {
      case "rectangle":
        shape = new Rect({
          left: x - 40,
          top: y - 30,
          fill: fillColor === "transparent" ? "transparent" : fillColor,
          stroke: activeColor,
          strokeWidth: brushSize,
          width: 80,
          height: 60,
        });
        break;
      case "circle":
        shape = new Circle({
          left: x - 30,
          top: y - 30,
          fill: fillColor === "transparent" ? "transparent" : fillColor,
          stroke: activeColor,
          strokeWidth: brushSize,
          radius: 30,
        });
        break;
      case "triangle":
        shape = new Triangle({
          left: x - 35,
          top: y - 30,
          fill: fillColor === "transparent" ? "transparent" : fillColor,
          stroke: activeColor,
          strokeWidth: brushSize,
          width: 70,
          height: 60,
        });
        break;
      case "line":
        shape = new Line([x - 40, y, x + 40, y], {
          stroke: activeColor,
          strokeWidth: brushSize,
        });
        break;
      case "arrow":
        // Create arrow with line and triangle head
        const arrowLine = new Line([x - 40, y, x + 30, y], {
          stroke: activeColor,
          strokeWidth: brushSize,
        });
        const arrowHead = new Triangle({
          left: x + 25,
          top: y - 8,
          fill: activeColor,
          width: 16,
          height: 16,
          angle: 90,
        });
        fabricCanvas.add(arrowLine);
        fabricCanvas.add(arrowHead);
        return;
      case "text":
        shape = new IText("Metin", {
          left: x - 20,
          top: y - 10,
          fill: activeColor,
          fontSize: 20,
          fontFamily: "sans-serif",
        });
        break;
    }

    if (shape) {
      fabricCanvas.add(shape);
      fabricCanvas.setActiveObject(shape);
      fabricCanvas.renderAll();
    }
  }, [fabricCanvas, activeTool, activeColor, fillColor, brushSize]);

  const handleClear = () => {
    if (!fabricCanvas) return;
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = "#ffffff";
    fabricCanvas.renderAll();
    saveToHistory();
  };

  const handleUndo = () => {
    if (!fabricCanvas || historyIndex <= 0) return;
    
    isUndoRedo.current = true;
    const newIndex = historyIndex - 1;
    fabricCanvas.loadFromJSON(JSON.parse(history[newIndex])).then(() => {
      fabricCanvas.renderAll();
      setHistoryIndex(newIndex);
      isUndoRedo.current = false;
    });
  };

  const handleRedo = () => {
    if (!fabricCanvas || historyIndex >= history.length - 1) return;
    
    isUndoRedo.current = true;
    const newIndex = historyIndex + 1;
    fabricCanvas.loadFromJSON(JSON.parse(history[newIndex])).then(() => {
      fabricCanvas.renderAll();
      setHistoryIndex(newIndex);
      isUndoRedo.current = false;
    });
  };

  const handleDownload = () => {
    if (!fabricCanvas) return;
    
    const dataUrl = fabricCanvas.toDataURL({
      format: "png",
      quality: 1,
      multiplier: 2,
    });
    
    const link = document.createElement("a");
    link.download = `cizim-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
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

      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `drawing-${Date.now()}.png`, { type: "image/png" });

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

  const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: "select", icon: <MousePointer className="h-4 w-4" />, label: "Seç" },
    { id: "pencil", icon: <Pencil className="h-4 w-4" />, label: "Kalem" },
    { id: "eraser", icon: <Eraser className="h-4 w-4" />, label: "Silgi" },
    { id: "line", icon: <Minus className="h-4 w-4" />, label: "Çizgi" },
    { id: "arrow", icon: <ArrowRight className="h-4 w-4" />, label: "Ok" },
    { id: "rectangle", icon: <Square className="h-4 w-4" />, label: "Dikdörtgen" },
    { id: "circle", icon: <CircleIcon className="h-4 w-4" />, label: "Daire" },
    { id: "triangle", icon: <TriangleIcon className="h-4 w-4" />, label: "Üçgen" },
    { id: "text", icon: <Type className="h-4 w-4" />, label: "Metin" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Çizim Yap</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3">
          {/* Tools */}
          <div className="flex flex-wrap gap-1 p-1 bg-muted/50 rounded-lg">
            {tools.map((tool) => (
              <Button
                key={tool.id}
                type="button"
                variant={activeTool === tool.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTool(tool.id)}
                title={tool.label}
                className="h-8 w-8 p-0"
              >
                {tool.icon}
              </Button>
            ))}
            
            <div className="w-px bg-border mx-1" />
            
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              title="Geri Al"
              className="h-8 w-8 p-0"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              title="İleri Al"
              className="h-8 w-8 p-0"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
            
            <div className="w-px bg-border mx-1" />
            
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              title="Temizle"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Color pickers */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1.5">Çizgi Rengi</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setActiveColor(color)}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-all",
                      activeColor === color
                        ? "border-primary scale-110 ring-2 ring-primary/30"
                        : "border-border hover:scale-105"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Fill color for shapes */}
          {(activeTool === "rectangle" || activeTool === "circle" || activeTool === "triangle") && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Dolgu Rengi</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setFillColor("transparent")}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition-all relative overflow-hidden",
                    fillColor === "transparent"
                      ? "border-primary scale-110 ring-2 ring-primary/30"
                      : "border-border hover:scale-105"
                  )}
                  style={{ backgroundColor: "#fff" }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full h-0.5 bg-red-500 rotate-45" />
                  </div>
                </button>
                {COLORS.map((color) => (
                  <button
                    key={`fill-${color}`}
                    type="button"
                    onClick={() => setFillColor(color)}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-all",
                      fillColor === color
                        ? "border-primary scale-110 ring-2 ring-primary/30"
                        : "border-border hover:scale-105"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Brush size */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-12">Boyut:</span>
            <Slider
              value={[brushSize]}
              onValueChange={(v) => setBrushSize(v[0])}
              min={1}
              max={30}
              step={1}
              className="flex-1"
            />
            <span className="text-xs font-mono w-6 text-right">{brushSize}</span>
          </div>

          {/* Canvas */}
          <div 
            className="border border-border rounded-lg overflow-hidden bg-white cursor-crosshair"
            onClick={handleCanvasClick}
          >
            <canvas ref={canvasRef} />
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4 mr-1" />
              İndir
            </Button>
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
