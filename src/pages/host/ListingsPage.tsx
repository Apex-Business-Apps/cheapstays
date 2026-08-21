// src/pages/host/ListingsPage.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Loader2, MapPin, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Seo } from "@/components/Seo";
import { ListingPhotoCarousel } from "@/components/ListingPhotoCarousel";
import { EditListingDialog } from "@/components/host/EditListingDialog";
import type { Listing } from "@/lib/listing-display";

const STATUS_STYLE: Record<string, string> = {
  active:   "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  draft:    "bg-amber-500/10  text-amber-700  dark:text-amber-400",
  inactive: "bg-muted         text-muted-foreground",
};

function displayPrice(l: Listing): string {
  const nightly = l.promo_price || l.overnight_php || l.nightly_php || 0;
  if (nightly > 0) return `₱${nightly.toLocaleString()} / night`;
  if (l.hourly_php) return `₱${l.hourly_php.toLocaleString()} / hr`;
  return "Price not set";
}

export default function ListingsPage() {
  const { user } = useAuth();
  const userId = user?.id;

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editing, setEditing] = useState<Listing | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("listings")
      .select("*")
      .eq("host_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        setListings((data ?? []) as unknown as Listing[]);
        setLoading(false);
      });
  }, [userId]);

  async function deleteListing(id: string) {
    if (!userId) return;
    setDeleting(id);
    const { error: err } = await supabase.from("listings").delete().eq("id", id).eq("host_id", userId);

    // Foreign-key violation → listing has bookings — fall back to soft deactivate.
    if (err?.code === "23503") {
      const { error: deactivateError } = await supabase
        .from("listings")
        .update({ status: "inactive" })
        .eq("id", id)
        .eq("host_id", userId);
      setDeleting(null);
      setConfirmDelete(null);
      if (deactivateError) {
        toast({ title: "Delete failed", description: deactivateError.message, variant: "destructive" });
        return;
      }
      toast({ title: "Listing deactivated", description: "This listing has booking history, so it was deactivated instead of deleted." });
      setListings((prev) => prev.map((l) => (l.id === id ? { ...l, status: "inactive" } : l)));
      return;
    }

    setDeleting(null);
    setConfirmDelete(null);
    if (err) { toast({ title: "Delete failed", description: err.message, variant: "destructive" }); return; }
    toast({ title: "Listing deleted" });
    setListings((prev) => prev.filter((l) => l.id !== id));
  }

  function applyPatch(id: string, patch: Partial<Listing>) {
    setListings((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  if (!userId) return null;

  return (
    <>
      <Seo title="My Listings · CheapStays Host" description="Manage your listings." path="/host/listings" />

      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My listings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? "Loading…" : `${listings.length} ${listings.length === 1 ? "listing" : "listings"}`}
          </p>
        </div>
        <Link to="/host/new-listing">
          <Button size="sm">+ New listing</Button>
        </Link>
      </header>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && <div className="text-center py-12 text-destructive">Failed to load listings: {error}</div>}
      {!loading && !error && listings.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p>No listings yet.</p>
          <Link to="/host/new-listing" className="mt-4 inline-block text-sm underline underline-offset-4">
            Create your first listing
          </Link>
        </div>
      )}

      <ul className="space-y-3">
        {listings.map((listing) => {
          const hasImages = (listing.images?.length ?? 0) > 0;
          return (
            <li key={listing.id}>
              <Card className="p-3 sm:p-4">
                <div className="flex gap-4">
                  <div className="w-28 sm:w-40 shrink-0">
                    {hasImages ? (
                      <ListingPhotoCarousel images={listing.images} title={listing.title} variant="row" />
                    ) : (
                      <div className="aspect-[4/3] rounded-lg bg-muted grid place-items-center text-xs text-muted-foreground">
                        No photo
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-medium text-foreground truncate">{listing.title}</h2>
                        <span
                          className={`text-[10px] font-medium capitalize px-1.5 py-0.5 rounded-full ${STATUS_STYLE[listing.status] ?? STATUS_STYLE.draft}`}
                        >
                          {listing.status}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {listing.city}
                          {listing.province ? `, ${listing.province}` : ""}
                        </span>
                        <span className="tabular-nums">{displayPrice(listing)}</span>
                        <span>
                          {listing.bedrooms} bd · {listing.bathrooms} ba · {listing.max_guests} guests
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      <a
                        href={`/listing/${listing.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-input text-xs font-medium hover:bg-muted transition-colors"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => setEditing(listing)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>

                      {confirmDelete === listing.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-8"
                            disabled={deleting === listing.id}
                            onClick={() => deleteListing(listing.id)}
                          >
                            {deleting === listing.id && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                            Confirm
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8" onClick={() => setConfirmDelete(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-destructive hover:text-destructive"
                          onClick={() => setConfirmDelete(listing.id)}
                          aria-label="Delete listing"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      {editing && (
        <EditListingDialog
          listing={editing}
          userId={userId}
          open={Boolean(editing)}
          onOpenChange={(o) => { if (!o) setEditing(null); }}
          onSaved={(patch) => applyPatch(editing.id, patch)}
        />
      )}
    </>
  );
}
