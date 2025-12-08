import { useRef, useState } from "react";
import { Image, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { uploadChatImage } from "@/lib/chat-api";

interface ImageUploadProps {
  userId: string;
  onImageUploaded: (imageUrl: string) => void;
  onImageRemoved: () => void;
  imagePreview: string | null;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const ImageUpload = ({
  userId,
  onImageUploaded,
  onImageRemoved,
  imagePreview,
  disabled,
}: ImageUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Geçersiz dosya türü",
        description: "Sadece JPEG, PNG, GIF ve WebP dosyaları yükleyebilirsiniz.",
      });
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        variant: "destructive",
        title: "Dosya çok büyük",
        description: "Maksimum dosya boyutu 5MB olmalıdır.",
      });
      return;
    }

    setUploading(true);
    try {
      const imageUrl = await uploadChatImage(file, userId);
      onImageUploaded(imageUrl);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Yükleme hatası",
        description: error.message || "Fotoğraf yüklenirken bir hata oluştu.",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || uploading}
      />

      {imagePreview ? (
        <div className="relative">
          <img
            src={imagePreview}
            alt="Önizleme"
            className="h-10 w-10 rounded-md object-cover border border-border"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
            onClick={onImageRemoved}
            disabled={disabled}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          title="Fotoğraf ekle"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Image className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
};

export default ImageUpload;