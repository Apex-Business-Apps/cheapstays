import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { aiDescribeSchema } from "@/lib/schemas";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isHost } from "@/lib/rbac";
import { Sparkles, Loader2, CheckSquare, Square, PlusCircle, CalendarDays } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Link } from "react-router-dom";
import { ImageUploader } from "@/components/ImageUploader";
import { VideoUploader } from "@/components/VideoUploader";
import { HostBookings } from "@/components/HostBookings";
import { HostVouchers } from "@/components/HostVouchers";
import { HostDashboard } from "@/components/HostDashboard";
import { ListingPublishGate } from "@/components/ListingPublishGate";
import { HostCalendar } from "@/components/HostCalendar";
import { BlackoutDateEditor } from "@/components/BlackoutDateEditor";
import { LongTermRequestsInbox } from "@/components/LongTermRequestsInbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const LISTING_TYPES = [
  { value: "entire_place", label: "Entire place" },
  { value: "private_room", label: "Private room" },
  { value: "shared_room", label: "Shared room" },
  { value: "villa", label: "Villa" },
  { value: "glamping", label: "Glamping" },
];

const STAY_CATEGORIES = [
  { value: "quick_stay", label: "Quick Stay" },
  { value: "hourly_stay", label: "Hourly Stay" },
  { value: "overnight_stay", label: "Overnight Stay" },
  { value: "hostel", label: "Hostel" },
  { value: "private_pool", label: "Private Pool" },
  { value: "condo", label: "Condo" },
  { value: "apartment", label: "Apartment" },
  { value: "hotel_room", label: "Hotel Room" },
  { value: "motel_room", label: "Motel Room" },
];

function inferLegacyType(cat: string) {
  switch (cat) {
    case 'hostel': return 'shared_room';
    case 'hotel_room':
    case 'motel_room': return 'private_room';
    case 'private_pool': return 'villa';
    case 'hourly_stay':
    case 'quick_stay': return 'glamping';
    default: return 'entire_place';
  }
}

const AMENITY_OPTIONS = [
  "wifi", "aircon", "fan", "kitchen", "kitchenette", "kitchen_shared",
  "hot_water", "outdoor_shower", "parking", "pool", "private_pool",
  "rooftop_pool", "gym", "work_desk", "smart_tv", "tv",
  "breakfast_included", "pet_friendly", "beach_access", "hammock",
  "kayak", "snorkel_gear", "bike_rental", "bbq_grill", "fire_pit",
  "fireplace", "garden", "terrace", "board_rack", "electric_blankets",
];

const AMENITY_LABELS: Record<string, string> = {
  wifi: "WiFi", aircon: "Air conditioning", fan: "Fan",
  kitchen: "Full kitchen", kitchenette: "Kitchenette", kitchen_shared: "Shared kitchen",
  hot_water: "Hot water", outdoor_shower: "Outdoor shower", parking: "Parking",
  pool: "Pool", private_pool: "Private pool", rooftop_pool: "Rooftop pool",
  gym: "Gym", work_desk: "Work desk", smart_tv: "Smart TV", tv: "TV",
  breakfast_included: "Breakfast included", pet_friendly: "Pet friendly",
  beach_access: "Beach access", hammock: "Hammock", kayak: "Kayak",
  snorkel_gear: "Snorkel gear", bike_rental: "Bike rental", bbq_grill: "BBQ grill",
  fire_pit: "Fire pit", fireplace: "Fireplace", garden: "Garden", terrace: "Terrace",
  board_rack: "Board rack", electric_blankets: "Electric blankets",
};

function slugify(title: string, id: string) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim()
      .slice(0, 60) +
    "-" +
    id.slice(0, 8)
  );
}

type ExistingListing = {
  id: string;
  title: string;
  status: string;
  images: string[];
  video_url: string | null;
};

function MyListings({ userId }: { userId: string }) {
  const [listings, setListings] = useState<ExistingListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("listings")
      .select("id,title,status,images,video_url")
      .eq("host_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setListings((data ?? []) as ExistingListing[]);
        setLoading(false);
      });
  }, [userId]);

  async function saveMedia(id: string, images: string[], video_url: string | null) {
    setSaving(id);
    const { error } = await supabase
      .from("listings")
      .update({ images, video_url })
      .eq("id", id);
    setSaving(null);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Media saved" });
      setListings((prev) => prev.map((l) => (l.id === id ? { ...l, images, video_url } : l)));
    }
  }

  async function deleteListing(id: string) {
    setDeleting(id);
    const { error } = await supabase.from("listings").delete().eq("id", id).eq("host_id", userId);
    if (error?.code === "23503") {
      // FK violation means bookings reference this listing; safely deactivate instead of hard-delete.
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

      toast({
        title: "Listing deactivated",
        description: "This listing has booking history, so it was deactivated instead of deleted.",
      });
      setListings((prev) => prev.map((l) => (l.id === id ? { ...l, status: "inactive" } : l)));
      return;
    }

    setDeleting(null);
    setConfirmDelete(null);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Listing deleted" });
    setListings((prev) => prev.filter((l) => l.id !== id));
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-12 text-destructive">Failed to load listings: {error}</div>;
  }

  if (listings.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No listings yet. Create one on the New Listing tab.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {listings.map((listing) => (
        <Card key={listing.id} className="p-5 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{listing.title}</p>
              <Badge variant={listing.status === "active" ? "default" : "secondary"} className="text-[10px] mt-1">
                {listing.status}
              </Badge>
            </div>
            <Link to={`/listing/${listing.id}`} className="text-xs text-muted-foreground hover:text-foreground underline">
              View listing
            </Link>
          </div>

          <div className="space-y-2">
            <Label>Photos (max 10)</Label>
            <ImageUploader
              userId={userId}
              listingId={listing.id}
              value={listing.images ?? []}
              onChange={(imgs) => setListings((prev) => prev.map((l) => (l.id === listing.id ? { ...l, images: imgs } : l)))}
              maxFiles={10}
            />
          </div>

          <div className="space-y-2">
            <Label>Video tour <span className="text-muted-foreground text-xs">(max 30 s)</span></Label>
            <VideoUploader
              userId={userId}
              listingId={listing.id}
              value={listing.video_url ?? null}
              onChange={(url) => setListings((prev) => prev.map((l) => (l.id === listing.id ? { ...l, video_url: url } : l)))}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              disabled={saving === listing.id}
              onClick={() => saveMedia(listing.id, listing.images ?? [], listing.video_url ?? null)}
            >
              {saving === listing.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
              Save media
            </Button>
            {confirmDelete === listing.id ? (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={deleting === listing.id}
                  onClick={() => deleteListing(listing.id)}
                >
                  {deleting === listing.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
                  Confirm delete
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(listing.id)}
              >
                Delete listing
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function HostApplicationForm() {
  const { user } = useAuth();
  const [propertyType, setPropertyType] = useState("");
  const [location, setLocation] = useState("");
  const [message, setMessage] = useState("");
  const [idPhotoPath, setIdPhotoPath] = useState("");
  const [selfiePath, setSelfiePath] = useState("");
  const [idUploading, setIdUploading] = useState(false);
  const [selfieUploading, setSelfieUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!user) {
    return (
      <div className="container py-24 max-w-xl text-center">
        <Seo title="Become a Host · CheapStays" description="Apply to list your property on CheapStays." path="/host" />
        <h1 className="text-2xl font-semibold">Sign in to apply as a host</h1>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button asChild variant="outline"><Link to="/auth?mode=signin">Log in</Link></Button>
          <Button asChild><Link to="/auth?mode=signup">Sign up</Link></Button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="container py-24 max-w-xl text-center">
        <Seo title="Application submitted · CheapStays" description="Your host application is under review." path="/host" />
        <div className="text-4xl mb-4">✅</div>
        <h1 className="text-2xl font-semibold">Application submitted</h1>
        <p className="text-muted-foreground mt-2">An admin will review your documents and grant host access within 24 hours.</p>
        <Button asChild className="mt-6" variant="outline"><Link to="/search">Browse listings</Link></Button>
      </div>
    );
  }

  async function uploadPrivateDoc(file: File, prefix: "id-front" | "selfie", setUploading: (v: boolean) => void) {
    if (!user) throw new Error("Not authenticated");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${prefix}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("host-verification").upload(path, file, { upsert: true });
      if (error) throw error;
      return path;
    } finally {
      setUploading(false);
    }
  }

  async function handleDocUpload(file: File, type: "id" | "selfie") {
    try {
      if (type === "id") setIdPhotoPath(await uploadPrivateDoc(file, "id-front", setIdUploading));
      else setSelfiePath(await uploadPrivateDoc(file, "selfie", setSelfieUploading));
      toast({ title: "Document uploaded" });
    } catch (err) {
      toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!propertyType.trim() || !location.trim() || !idPhotoPath || !selfiePath) {
      toast({ title: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const [ticketResult, profileResult] = await Promise.all([
        supabase.functions.invoke("support-ticket", {
          body: {
            subject: "Host application",
            message: `Property type: ${propertyType}\nLocation: ${location}\nKYC ID path: ${idPhotoPath}\nKYC selfie path: ${selfiePath}\n\n${message.trim()}`,
            category: "host_verification",
            priority: "normal",
          },
        }),
        supabase.from("host_profiles").upsert(
          {
            user_id: user!.id,
            location: location.trim(),
            id_photo_url: null,
            selfie_url: null,
            verification_status: "pending",
          },
          { onConflict: "user_id" }
        ),
      ]);

      if (ticketResult.error) throw ticketResult.error;
      if (profileResult.error) throw profileResult.error;

      setSubmitted(true);
    } catch (err) {
      toast({ title: "Submission failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container py-16 max-w-lg">
      <Seo title="Become a Host · CheapStays" description="Apply to list your property on CheapStays." path="/host" />
      <h1 className="text-3xl font-semibold tracking-tight">Apply to become a host</h1>
      <p className="text-muted-foreground mt-2">
        Tell us about your property. An admin reviews every application — usually within 24 hours.
      </p>
      <Card className="mt-8 p-6">
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label>Property type *</Label>
            <Input
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              placeholder="Beachfront villa, condo, private room…"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Location *</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, Province"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Anything else you'd like us to know? <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Number of units, availability, pricing expectations…"
            />
          </div>

          <div className="space-y-4 pt-2 border-t border-border/60">
            <div>
              <Label className="text-sm font-medium">Identity verification</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Upload a government ID and a selfie holding it. Required for host approval.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Government-issued ID (passport, driver's license, UMID)</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleDocUpload(f, "id"); }}
                disabled={idUploading}
              />
              {idUploading && <p className="text-xs text-muted-foreground">Uploading ID…</p>}
              {!idUploading && idPhotoPath && <p className="text-xs text-muted-foreground">ID uploaded securely.</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Selfie holding your ID</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleDocUpload(f, "selfie"); }}
                disabled={selfieUploading}
              />
              {selfieUploading && <p className="text-xs text-muted-foreground">Uploading selfie…</p>}
              {!selfieUploading && selfiePath && <p className="text-xs text-muted-foreground">Selfie uploaded securely.</p>}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Submit application
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link to="/search">Browse listings</Link>
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function Host() {
  const { user, roles, rolesError, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Pre-generate listing ID so ImageUploader can use it before submit
  const [listingId] = useState(() => crypto.randomUUID());

  // AI description generator
  const [title, setTitle] = useState("");
  const [bullets, setBullets] = useState("");
  const [aiOut, setAiOut] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Listing form
  const [form, setForm] = useState({
    stay_availability_type: "overnight", // 'hourly', 'overnight', 'both'
    stay_category: "overnight_stay",
    booking_mode: "instant",
    city: "",
    province: "",
    address: "",
    bedrooms: 1,
    bathrooms: 1,
    max_guests: 2,
    hourly_php: 0,
    price_3h: 0,
    price_6h: 0,
    price_12h: 0,
    overnight_php: 1500,
    nightly_php: 1500, // Legacy sync
    promo_price: 0,
    min_nights: 1,
    description: "",
  });
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [publishGateOpen, setPublishGateOpen] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  async function generateDescription() {
    const parsed = aiDescribeSchema.safeParse({
      title,
      bullets: bullets.split("\n").map((b) => b.trim()).filter(Boolean),
      tone: "confident",
    });
    if (!parsed.success) {
      toast({ title: "Add a title and at least one bullet", variant: "destructive" });
      return;
    }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-describe", { body: parsed.data });
      if (error) throw error;
      const desc = data?.description ?? "";
      setAiOut(desc);
      setForm((f) => ({ ...f, description: desc }));
    } catch (err) {
      toast({ title: "AI error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }

  function toggleAmenity(a: string) {
    setSelectedAmenities((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  }

  async function submitListing(isDraft: boolean) {
    if (!user) return;
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (!form.city.trim() || !form.province.trim()) {
      toast({ title: "City and province are required", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const slug = slugify(title, listingId);

      // Always create the listing as draft first. Publishing requires the
      // ListingPublishGate (3-month availability, blackouts, house rules,
      // stay instructions, min/max nights, stay-length enablement) to pass.
      // The DB-level publish-gate trigger backstops any client bypass.
      // is_owner_direct and instant_book are legacy/marketing fields and are
      // no longer written from the listing setup flow.
      const { error } = await supabase.from("listings").insert({
        id: listingId,
        slug,
        host_id: user.id,
        title: title.trim(),
        description: form.description.trim(),
        type: inferLegacyType(form.stay_category) as any,
        stay_availability_type: form.stay_availability_type,
        stay_category: form.stay_category,
        booking_mode: form.booking_mode,
        city: form.city.trim(),
        province: form.province.trim(),
        address: form.address.trim() || null,
        bedrooms: form.bedrooms,
        bathrooms: form.bathrooms,
        max_guests: form.max_guests,
        hourly_php: form.hourly_php || null,
        price_3h: form.price_3h || null,
        price_6h: form.price_6h || null,
        price_12h: form.price_12h || null,
        overnight_php: form.overnight_php || null,
        promo_price: form.promo_price || null,
        nightly_php: form.overnight_php, // Legacy backfill
        min_nights: form.min_nights,
        amenities: selectedAmenities,
        images,
        video_url: videoUrl,
        status: "draft",
      });

      if (error) throw error;

      if (isDraft) {
        toast({
          title: "Saved as draft",
          description: "You can publish it anytime from your listings tab.",
        });
      } else {
        // Open the publish gate so the host can finish setup and flip status.
        setPublishingId(listingId);
        setPublishGateOpen(true);
      }
    } catch (err) {
      toast({ title: "Failed to save listing", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function finalizePublish() {
    if (!publishingId) return;
    const { error } = await supabase
      .from("listings")
      .update({ status: "active" })
      .eq("id", publishingId);
    if (error) {
      toast({
        title: "Cannot publish",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Listing published!", description: "Your listing is now live." });
    setPublishGateOpen(false);
    navigate(`/listing/${publishingId}`);
  }

  if (authLoading) {
    return (
      <div className="container py-24 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rolesError) {
    return (
      <div className="container py-24 max-w-xl text-center">
        <h1 className="text-2xl font-semibold">Unable to verify host access</h1>
        <p className="text-muted-foreground mt-2">{rolesError}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container py-24 max-w-xl text-center">
        <Seo title="Host on CheapStays" description="List your property and reach verified travelers directly." path="/host" />
        <h1 className="text-2xl font-semibold">Want to list your property?</h1>
        <p className="text-muted-foreground mt-2 mb-6">Create a free account first, then apply as a host.</p>
        <Link to="/auth?mode=signup&next=/host/apply">
          <Button>Create account to apply</Button>
        </Link>
      </div>
    );
  }

  if (!isHost(roles)) {
    return <HostApplicationForm />;
  }

  return (
    <div>
      <Seo title="Host tools · CheapStays" description="Create and manage your listings on CheapStays." path="/host" />
      <div className="container py-12 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Host tools</h1>
          <p className="text-muted-foreground mt-2">Create and manage your listings.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-8 flex-wrap h-auto">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <CalendarDays className="h-4 w-4" /> Calendar
            </TabsTrigger>
            <TabsTrigger value="requests">Long-term requests</TabsTrigger>
            <TabsTrigger value="blackouts">Blackouts</TabsTrigger>
            <TabsTrigger value="new" className="gap-2">
              <PlusCircle className="h-4 w-4" /> New listing
            </TabsTrigger>
            <TabsTrigger value="my">My listings</TabsTrigger>
            <TabsTrigger value="bookings" className="gap-2">
              <CalendarDays className="h-4 w-4" /> Bookings
            </TabsTrigger>
            <TabsTrigger value="vouchers">Vouchers</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <HostDashboard hostId={user.id} onTabChange={setActiveTab} />
          </TabsContent>

          <TabsContent value="calendar">
            <HostCalendar hostId={user.id} />
          </TabsContent>

          <TabsContent value="requests">
            <LongTermRequestsInbox hostId={user.id} />
          </TabsContent>

          <TabsContent value="blackouts">
            <BlackoutDateEditor hostId={user.id} />
          </TabsContent>

          {/* ── New listing tab ── */}
          <TabsContent value="new" className="space-y-8">
            {/* AI Description Generator */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="font-medium">AI description generator</h2>
                <Badge variant="secondary" className="text-[10px]">Optional</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Paste your listing's facts and we'll write a clean, honest description.</p>
              <div className="space-y-2">
                <Label>Listing title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Cozy 1BR Condo in Cubao, Quezon City"
                />
              </div>
              <div className="space-y-2">
                <Label>Bullet points (one per line)</Label>
                <Textarea
                  rows={5}
                  value={bullets}
                  onChange={(e) => setBullets(e.target.value)}
                  placeholder={"40m² · 1 bed\nQuezon City · near MRT\nFast WiFi · 100 Mbps\nAir-conditioned\nInstant book"}
                />
              </div>
              <Button onClick={generateDescription} disabled={aiLoading} variant="secondary">
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {aiLoading ? "Writing…" : "Generate description"}
              </Button>
              {aiOut && (
                <div className="mt-2 border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-2">Generated — copied into description field below:</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{aiOut}</p>
                </div>
              )}
            </Card>

            {/* Listing Form */}
            <Card className="p-6 space-y-6">
              <h2 className="font-medium text-lg">Listing details</h2>

              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Cozy 1BR Condo in Cubao, Quezon City"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>City *</Label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="Quezon City"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Province / Region *</Label>
                  <Input
                    value={form.province}
                    onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
                    placeholder="NCR"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Address <span className="text-muted-foreground text-xs">(optional — shown after booking)</span></Label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Unit 12, Tower A, Example St."
                />
              </div>

              <div className="space-y-2">
                <Label>Stay Category</Label>
                <div className="flex flex-wrap gap-2">
                  {STAY_CATEGORIES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, stay_category: t.value }))}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        form.stay_category === t.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border/60 hover:border-foreground/30"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Availability Type</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "overnight", label: "Overnight stays only" },
                    { value: "hourly", label: "Hourly stays only" },
                    { value: "both", label: "Both overnight & hourly" },
                  ].map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, stay_availability_type: t.value }))}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        form.stay_availability_type === t.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border/60 hover:border-foreground/30"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Booking Mode</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "instant", label: "Instant Book" },
                    { value: "manual_review", label: "Manual Review" },
                    { value: "voucher", label: "Voucher / Open Date" },
                  ].map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, booking_mode: t.value }))}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        form.booking_mode === t.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border/60 hover:border-foreground/30"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Bedrooms</Label>
                  <Input
                    type="number" min={0} max={20} value={form.bedrooms}
                    onChange={(e) => setForm((f) => ({ ...f, bedrooms: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bathrooms</Label>
                  <Input
                    type="number" min={1} max={20} step={0.5} value={form.bathrooms}
                    onChange={(e) => setForm((f) => ({ ...f, bathrooms: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max guests</Label>
                  <Input
                    type="number" min={1} max={50} value={form.max_guests}
                    onChange={(e) => setForm((f) => ({ ...f, max_guests: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Promo price (₱) <span className="text-muted-foreground text-xs">(optional slash price)</span></Label>
                  <Input
                    type="number" min={0} step={50} value={form.promo_price || ""}
                    onChange={(e) => setForm((f) => ({ ...f, promo_price: Number(e.target.value) }))}
                  />
                </div>
              </div>

              {(form.stay_availability_type === "overnight" || form.stay_availability_type === "both") && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/60">
                  <div className="space-y-2">
                    <Label>Overnight price (₱)</Label>
                    <Input
                      type="number" min={100} step={50} value={form.overnight_php}
                      onChange={(e) => setForm((f) => ({ ...f, overnight_php: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Minimum nights</Label>
                    <Input
                      type="number" min={1} max={30} value={form.min_nights}
                      onChange={(e) => setForm((f) => ({ ...f, min_nights: Number(e.target.value) }))}
                    />
                  </div>
                </div>
              )}

              {(form.stay_availability_type === "hourly" || form.stay_availability_type === "both") && (
                <div className="space-y-4 pt-2 border-t border-border/60">
                  <h3 className="font-medium text-sm">Hourly Pricing</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Base Hourly Rate (₱)</Label>
                      <Input
                        type="number" min={0} step={50} value={form.hourly_php || ""}
                        onChange={(e) => setForm((f) => ({ ...f, hourly_php: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>3-Hour Block (₱)</Label>
                      <Input
                        type="number" min={0} step={50} value={form.price_3h || ""}
                        onChange={(e) => setForm((f) => ({ ...f, price_3h: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>6-Hour Block (₱)</Label>
                      <Input
                        type="number" min={0} step={50} value={form.price_6h || ""}
                        onChange={(e) => setForm((f) => ({ ...f, price_6h: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>12-Hour Block (₱)</Label>
                      <Input
                        type="number" min={0} step={50} value={form.price_12h || ""}
                        onChange={(e) => setForm((f) => ({ ...f, price_12h: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  rows={6}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Describe your place — what makes it special, the neighbourhood, what guests can expect…"
                />
                <p className="text-xs text-muted-foreground">Use the AI generator above to write this for you.</p>
              </div>

              <div className="space-y-3">
                <Label>Amenities</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {AMENITY_OPTIONS.map((a) => {
                    const checked = selectedAmenities.includes(a);
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleAmenity(a)}
                        className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition-colors text-left ${
                          checked
                            ? "border-primary/60 bg-primary/5 text-foreground"
                            : "border-border/50 hover:border-foreground/20 text-muted-foreground"
                        }`}
                      >
                        {checked ? <CheckSquare className="h-4 w-4 text-primary shrink-0" /> : <Square className="h-4 w-4 shrink-0" />}
                        {AMENITY_LABELS[a] ?? a}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Booking options are derived: short-term stays (≤30 nights)
                  are always Instant Book; long-term stays (31+ nights) are
                  always Request Booking. Enable one or both in the publish
                  gate after saving as draft. */}

              {/* Photos */}
              <div className="space-y-3 pt-2 border-t border-border/60">
                <div>
                  <Label>Photos <span className="text-muted-foreground text-xs">(up to 10)</span></Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Upload photos now or add them later from My listings.</p>
                </div>
                <ImageUploader
                  userId={user.id}
                  listingId={listingId}
                  value={images}
                  onChange={setImages}
                  maxFiles={10}
                />
              </div>

              {/* Video */}
              <div className="space-y-3 pt-2 border-t border-border/60">
                <div>
                  <Label>Video tour <span className="text-muted-foreground text-xs">(optional · max 30 s)</span></Label>
                  <p className="text-xs text-muted-foreground mt-0.5">A short walkthrough video significantly increases bookings.</p>
                </div>
                <VideoUploader
                  userId={user.id}
                  listingId={listingId}
                  value={videoUrl}
                  onChange={setVideoUrl}
                />
              </div>

              <div className="flex flex-wrap gap-3 pt-2 border-t border-border/60">
                <Button onClick={() => submitListing(false)} disabled={submitting} className="gap-2">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Publish listing
                </Button>
                <Button variant="outline" onClick={() => submitListing(true)} disabled={submitting}>
                  Save as draft
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* ── My listings tab ── */}
          <TabsContent value="my">
            <MyListings userId={user.id} />
          </TabsContent>

          {/* ── Bookings tab ── */}
          <TabsContent value="bookings">
            <HostBookings hostId={user.id} />
          </TabsContent>

          <TabsContent value="vouchers">
            <HostVouchers hostId={user.id} />
          </TabsContent>
        </Tabs>
      </div>

      {publishingId && (
        <Dialog open={publishGateOpen} onOpenChange={setPublishGateOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Finish setup before publishing</DialogTitle>
              <DialogDescription>
                Your listing was saved as a draft. Complete every requirement below to
                publish it. Blackout dates can be edited later from the host calendar.
              </DialogDescription>
            </DialogHeader>
            <ListingPublishGate
              listingId={publishingId}
              userId={user.id}
              onAllPassed={finalizePublish}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
