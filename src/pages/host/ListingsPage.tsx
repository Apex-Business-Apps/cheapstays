// src/pages/host/ListingsPage.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ImageUploader } from "@/components/ImageUploader";
import { VideoUploader } from "@/components/VideoUploader";
import { Seo } from "@/components/Seo";

type ExistingListing = {
  id: string; title: string; status: string; images: string[]; video_url: string | null;
};

export default function ListingsPage() {
  const { user } = useAuth();
  const [listings, setListings] = useState<ExistingListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    supabase.from("listings").select("id,title,status,images,video_url")
      .eq("host_id", userId).order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        setListings((data ?? []) as ExistingListing[]);
        setLoading(false);
      });
  }, [userId]);

  async function saveMedia(id: string, images: string[], video_url: string | null) {
    if (!userId) return;
    setSaving(id);
    const { data, error: err } = await supabase.from("listings")
      .update({ images, video_url }).eq("id", id).eq("host_id", userId)
      .select("id, images, video_url");
    setSaving(null);
    if (err) { toast({ title: "Save failed", description: err.message, variant: "destructive" }); return; }
    if (!data || data.length === 0) {
      toast({ title: "Nothing was saved", description: "The listing couldn't be updated — you may not own it or a permission rule blocked the change.", variant: "destructive" });
      return;
    }
    const saved = data[0] as { images: string[] | null; video_url: string | null };
    toast({ title: "Media saved" });
    setListings((prev) => prev.map((l) => l.id === id ? { ...l, images: saved.images ?? [], video_url: saved.video_url ?? null } : l));
  }

  async function deleteListing(id: string) {
    if (!userId) return;
    setDeleting(id);
    const { error: err } = await supabase.from("listings").delete().eq("id", id).eq("host_id", userId);
    if (err?.code === "23503") {
      const { error: deactivateError } = await supabase.from("listings")
        .update({ status: "inactive" }).eq("id", id).eq("host_id", userId);
      setDeleting(null); setConfirmDelete(null);
      if (deactivateError) { toast({ title: "Delete failed", description: deactivateError.message, variant: "destructive" }); return; }
      toast({ title: "Listing deactivated", description: "This listing has booking history, so it was deactivated instead of deleted." });
      setListings((prev) => prev.map((l) => l.id === id ? { ...l, status: "inactive" } : l));
      return;
    }
    setDeleting(null); setConfirmDelete(null);
    if (err) { toast({ title: "Delete failed", description: err.message, variant: "destructive" }); return; }
    toast({ title: "Listing deleted" });
    setListings((prev) => prev.filter((l) => l.id !== id));
  }

  if (!userId) return null;

  return (
    <>
      <Seo title="My Listings · CheapStays Host" description="Manage your listings." path="/host/listings" />
      <h1 className="text-2xl font-semibold tracking-tight mb-6">My Listings</h1>

      {loading && <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
      {error && <div className="text-center py-12 text-destructive">Failed to load listings: {error}</div>}
      {!loading && !error && listings.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No listings yet.</p>
          <Link to="/host/new-listing" className="mt-4 inline-block text-sm underline underline-offset-4">Create your first listing</Link>
        </div>
      )}

      <div className="space-y-6">
        {listings.map((listing) => (
          <Card key={listing.id} className="p-5 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{listing.title}</p>
                <Badge variant={listing.status === "active" ? "default" : "secondary"} className="text-[10px] mt-1">{listing.status}</Badge>
              </div>
              <Link to={`/listing/${listing.id}`} className="text-xs text-muted-foreground hover:text-foreground underline">View listing</Link>
            </div>

            <div className="space-y-2">
              <Label>Photos (max 10)</Label>
              <ImageUploader userId={userId} listingId={listing.id} value={listing.images ?? []}
                onChange={(imgs) => setListings((prev) => prev.map((l) => l.id === listing.id ? { ...l, images: imgs } : l))}
                onUploadingChange={(up) => setUploadingId(up ? listing.id : null)} maxFiles={10} />
            </div>

            <div className="space-y-2">
              <Label>Video tour <span className="text-muted-foreground text-xs">(max 30 s)</span></Label>
              <VideoUploader userId={userId} listingId={listing.id} value={listing.video_url ?? null}
                onChange={(url) => setListings((prev) => prev.map((l) => l.id === listing.id ? { ...l, video_url: url } : l))} />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" disabled={saving === listing.id || uploadingId === listing.id}
                onClick={() => saveMedia(listing.id, listing.images ?? [], listing.video_url ?? null)}>
                {saving === listing.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
                {uploadingId === listing.id ? "Uploading…" : "Save media"}
              </Button>
              {confirmDelete === listing.id ? (
                <>
                  <Button size="sm" variant="destructive" disabled={deleting === listing.id} onClick={() => deleteListing(listing.id)}>
                    {deleting === listing.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
                    Confirm delete
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                </>
              ) : (
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(listing.id)}>
                  Delete listing
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
