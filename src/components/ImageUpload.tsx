import { useRef, useState } from "react";
import { Paperclip, X, Loader2, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { uploadChatFile } from "@/lib/chat-api";

interface FileUploadProps {
  userId: string;
  onFileUploaded: (fileUrl: string, fileType: "image" | "pdf") => void;
  onFileRemoved: () => void;
  filePreview: { url: string; type: "image" | "pdf" } | null;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ALLOWED_PDF_TYPE = "application/pdf";
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ALLOWED_PDF_TYPE];

const FileUpload = ({
  userId,
  onFileUploaded,
  onFileRemoved,
  filePreview,
  disabled,
}: FileUploadProps) => {
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
        description: "Sadece JPEG, PNG, GIF, WebP ve PDF dosyaları yükleyebilirsiniz.",
      });
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        variant: "destructive",
        title: "Dosya çok büyük",
        description: "Maksimum dosya boyutu 10MB olmalıdır.",
      });
      return;
    }

    setUploading(true);
    try {
      const fileUrl = await uploadChatFile(file, userId);
      const fileType = file.type === ALLOWED_PDF_TYPE ? "pdf" : "image";
      onFileUploaded(fileUrl, fileType);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Yükleme hatası",
        description: error.message || "Dosya yüklenirken bir hata oluştu.",
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

      {filePreview ? (
        <div className="relative">
          {filePreview.type === "image" ? (
            <img
              src={filePreview.url}
              alt="Önizleme"
              className="h-10 w-10 rounded-md object-cover border border-border"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted">
              <FileText className="h-5 w-5 text-primary" />
            </div>
          )}
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
            onClick={onFileRemoved}
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
          title="Dosya ekle (Fotoğraf veya PDF)"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
};

export default FileUpload;