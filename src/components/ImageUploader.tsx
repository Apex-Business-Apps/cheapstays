import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { ImagePlus, X } from "lucide-react";

type UploadItem = {
  id: string;
  file: File;
  preview: string;
  progress: number;
  url: string | null;
  error: string | null;
};

type Props = {
  userId: string;
  listingId: string;
  value: string[];
  onChange: (urls: string[]) => void;
  maxFiles?: number;
  onUploadingChange?: (uploading: boolean) => void;
};

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function ImageUploader({ userId, listingId, value, onChange, maxFiles = 10, onUploadingChange }: Props) {
  const [pending, setPending] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Surface in-flight uploads so parents can block "Save"/"Publish" until the
  // photo URLs actually exist — otherwise an empty images array gets saved.
  useEffect(() => {
    onUploadingChange?.(pending.some((p) => !p.url && !p.error));
  }, [pending, onUploadingChange]);

  const upload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const valid = Array.from(files).filter((f) => {
        if (!IMAGE_TYPES.includes(f.type)) {
          toast({ title: `${f.name}: unsupported format`, description: "Upload JPEG, PNG, or WebP only.", variant: "destructive" });
          return false;
        }
        if (f.size > MAX_IMAGE_BYTES) {
          toast({ title: `${f.name}: too large`, description: "Max 5 MB per image.", variant: "destructive" });
          return false;
        }
        return true;
      });

      if (value.length + valid.length > maxFiles) {
        toast({ title: `Max ${maxFiles} images allowed`, variant: "destructive" });
        return;
      }

      const items: UploadItem[] = valid.map((f) => ({
        id: crypto.randomUUID(),
        file: f,
        preview: URL.createObjectURL(f),
        progress: 0,
        url: null,
        error: null,
      }));

      setPending((prev) => [...prev, ...items]);

      const newUrls: string[] = [];

      for (const item of items) {
        const ext = item.file.name.split(".").pop() ?? "jpg";
        const path = `${userId}/${listingId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const tick = setInterval(() => {
          setPending((prev) =>
            prev.map((p) => (p.id === item.id ? { ...p, progress: Math.min(p.progress + 12, 80) } : p))
          );
        }, 120);

        try {
          const { error } = await supabase.storage
            .from("listing-images")
            .upload(path, item.file, { cacheControl: "3600", upsert: false });

          clearInterval(tick);
          if (error) throw error;

          const { data: { publicUrl } } = supabase.storage.from("listing-images").getPublicUrl(path);
          newUrls.push(publicUrl);

          setPending((prev) =>
            prev.map((p) => (p.id === item.id ? { ...p, progress: 100, url: publicUrl } : p))
          );
        } catch (err) {
          clearInterval(tick);
          setPending((prev) =>
            prev.map((p) => (p.id === item.id ? { ...p, error: (err as Error).message, progress: 0 } : p))
          );
        }
      }

      if (newUrls.length > 0) {
        onChange([...value, ...newUrls]);
        setTimeout(() => setPending((prev) => prev.filter((p) => !p.url)), 1200);
      }
    },
    [userId, listingId, value, onChange, maxFiles]
  );

  function removeUploaded(url: string) {
    onChange(value.filter((u) => u !== url));
    const segment = url.split("/object/public/listing-images/")[1];
    if (segment) supabase.storage.from("listing-images").remove([segment]);
  }

  function removePending(item: UploadItem) {
    URL.revokeObjectURL(item.preview);
    setPending((prev) => prev.filter((p) => p.id !== item.id));
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    upload(e.dataTransfer.files);
  };

  const remaining = maxFiles - value.length;

  return (
    <div className="space-y-3">
      {remaining > 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-colors select-none",
            dragging ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/40 hover:bg-muted/20"
          )}
        >
          <ImagePlus className="h-7 w-7 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">Drop photos here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">
            JPEG · PNG · WebP &nbsp;·&nbsp; max 5 MB each &nbsp;·&nbsp; {remaining} slot{remaining !== 1 ? "s" : ""} left
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={IMAGE_TYPES.join(",")}
            multiple
            className="hidden"
            onChange={(e) => upload(e.target.files)}
          />
        </div>
      )}

      {(value.length > 0 || pending.length > 0) && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {value.map((url, i) => (
            <div key={url} className="relative group aspect-square rounded-lg overflow-hidden border border-border/60 bg-muted">
              <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
              {i === 0 && (
                <span className="absolute bottom-1 left-1 text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded-full leading-none">
                  Cover
                </span>
              )}
              <button
                type="button"
                onClick={() => removeUploaded(url)}
                className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                aria-label="Remove photo"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {pending.map((item) => (
            <div key={item.id} className="relative aspect-square rounded-lg overflow-hidden border border-border/60 bg-muted">
              <img src={item.preview} alt="Uploading" className="w-full h-full object-cover opacity-60" />
              {item.error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-destructive/70 gap-1 p-1">
                  <p className="text-[9px] text-white text-center leading-tight line-clamp-2">{item.error}</p>
                  <button type="button" onClick={() => removePending(item)}>
                    <X className="h-3.5 w-3.5 text-white" />
                  </button>
                </div>
              ) : (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                  <div
                    className="h-full bg-primary transition-all duration-150"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {value.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {value.length} / {maxFiles} photos &nbsp;·&nbsp; First photo is the cover image
        </p>
      )}
    </div>
  );
}
