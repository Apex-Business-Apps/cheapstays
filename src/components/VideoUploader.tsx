import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Video, X, Loader2 } from "lucide-react";

type Props = {
  userId: string;
  listingId: string;
  value: string | null;
  onChange: (url: string | null) => void;
};

const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB
const MAX_DURATION_SECONDS = 30;

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const el = document.createElement("video");
    const url = URL.createObjectURL(file);
    el.preload = "metadata";
    el.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(el.duration); };
    el.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read video")); };
    el.src = url;
  });
}

export function VideoUploader({ userId, listingId, value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    if (!VIDEO_TYPES.includes(file.type)) {
      toast({ title: "Unsupported format", description: "Upload MP4, MOV, or WebM video.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      toast({ title: "Video too large", description: "Max 100 MB.", variant: "destructive" });
      return;
    }

    let duration: number;
    try {
      duration = await getVideoDuration(file);
    } catch {
      toast({ title: "Could not read video duration", variant: "destructive" });
      return;
    }

    if (duration > MAX_DURATION_SECONDS) {
      toast({
        title: `Video too long (${Math.ceil(duration)}s)`,
        description: `Maximum is ${MAX_DURATION_SECONDS} seconds.`,
        variant: "destructive",
      });
      return;
    }

    const ext = file.name.split(".").pop() ?? "mp4";
    const path = `${userId}/${listingId}/video-${Date.now()}.${ext}`;

    setUploading(true);
    setProgress(0);

    const tick = setInterval(() => setProgress((p) => Math.min(p + 8, 80)), 200);

    try {
      const { error } = await supabase.storage
        .from("listing-images")
        .upload(path, file, { cacheControl: "3600", upsert: true });

      clearInterval(tick);
      if (error) throw error;

      setProgress(100);
      const { data: { publicUrl } } = supabase.storage.from("listing-images").getPublicUrl(path);
      onChange(publicUrl);
    } catch (err) {
      clearInterval(tick);
      toast({ title: "Video upload failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  function remove() {
    if (!value) return;
    onChange(null);
    const segment = value.split("/object/public/listing-images/")[1];
    if (segment) supabase.storage.from("listing-images").remove([segment]);
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    upload(e.dataTransfer.files);
  };

  if (value) {
    return (
      <div className="relative rounded-xl overflow-hidden border border-border/60 bg-black aspect-video max-h-52">
        <video src={value} controls className="w-full h-full object-contain" />
        <button
          type="button"
          onClick={remove}
          className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black/90 transition-colors"
          aria-label="Remove video"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      className={cn(
        "border-2 border-dashed rounded-xl p-7 text-center transition-colors select-none",
        uploading ? "cursor-wait" : "cursor-pointer",
        dragging ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/40 hover:bg-muted/20"
      )}
    >
      {uploading ? (
        <>
          <Loader2 className="h-7 w-7 mx-auto mb-2 text-primary animate-spin" />
          <p className="text-sm font-medium">Uploading video…</p>
          <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden max-w-xs mx-auto">
            <div className="h-full bg-primary transition-all duration-200" style={{ width: `${progress}%` }} />
          </div>
        </>
      ) : (
        <>
          <Video className="h-7 w-7 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a video here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">
            MP4 · MOV · WebM &nbsp;·&nbsp; max 30 seconds &nbsp;·&nbsp; max 100 MB
          </p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={VIDEO_TYPES.join(",")}
        className="hidden"
        onChange={(e) => upload(e.target.files)}
      />
    </div>
  );
}
