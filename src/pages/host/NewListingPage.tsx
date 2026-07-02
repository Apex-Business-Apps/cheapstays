// src/pages/host/NewListingPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, CheckSquare, Square } from "lucide-react";
import { Seo } from "@/components/Seo";
import { ImageUploader } from "@/components/ImageUploader";
import { VideoUploader } from "@/components/VideoUploader";
import { ListingPublishGate } from "@/components/ListingPublishGate";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { aiDescribeSchema } from "@/lib/schemas";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const STAY_CATEGORIES = [
  { value: "quick_stay",    label: "Quick Stay" },
  { value: "hourly_stay",   label: "Hourly Stay" },
  { value: "overnight_stay",label: "Overnight Stay" },
  { value: "hostel",        label: "Hostel" },
  { value: "private_pool",  label: "Private Pool" },
  { value: "condo",         label: "Condo" },
  { value: "apartment",     label: "Apartment" },
  { value: "hotel_room",    label: "Hotel Room" },
  { value: "motel_room",    label: "Motel Room" },
];

const AMENITY_OPTIONS = [
  "wifi","aircon","fan","kitchen","kitchenette","kitchen_shared",
  "hot_water","outdoor_shower","parking","pool","private_pool",
  "rooftop_pool","gym","work_desk","smart_tv","tv",
  "breakfast_included","pet_friendly","beach_access","hammock",
  "kayak","snorkel_gear","bike_rental","bbq_grill","fire_pit",
  "fireplace","garden","terrace","board_rack","electric_blankets",
];

const AMENITY_LABELS: Record<string, string> = {
  wifi:"WiFi",aircon:"Air conditioning",fan:"Fan",
  kitchen:"Full kitchen",kitchenette:"Kitchenette",kitchen_shared:"Shared kitchen",
  hot_water:"Hot water",outdoor_shower:"Outdoor shower",parking:"Parking",
  pool:"Pool",private_pool:"Private pool",rooftop_pool:"Rooftop pool",
  gym:"Gym",work_desk:"Work desk",smart_tv:"Smart TV",tv:"TV",
  breakfast_included:"Breakfast included",pet_friendly:"Pet friendly",
  beach_access:"Beach access",hammock:"Hammock",kayak:"Kayak",
  snorkel_gear:"Snorkel gear",bike_rental:"Bike rental",bbq_grill:"BBQ grill",
  fire_pit:"Fire pit",fireplace:"Fireplace",garden:"Garden",terrace:"Terrace",
  board_rack:"Board rack",electric_blankets:"Electric blankets",
};

function inferLegacyType(cat: string) {
  switch (cat) {
    case "hostel":      return "shared_room";
    case "hotel_room":
    case "motel_room":  return "private_room";
    case "private_pool":return "villa";
    case "hourly_stay":
    case "quick_stay":  return "glamping";
    default:            return "entire_place";
  }
}

function slugify(title: string, id: string) {
  return (
    title.toLowerCase().replace(/[^a-z0-9\s-]/g,"").replace(/\s+/g,"-").replace(/-+/g,"-").trim().slice(0,60) +
    "-" + id.slice(0,8)
  );
}

export default function NewListingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [listingId, setListingId] = useState(() => crypto.randomUUID());
  const [title, setTitle] = useState("");
  const [bullets, setBullets] = useState("");
  const [aiOut, setAiOut] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [form, setForm] = useState({
    stay_availability_type: "overnight",
    stay_category: "overnight_stay",
    booking_mode: "instant",
    city: "", province: "", address: "",
    bedrooms: 1, bathrooms: 1, max_guests: 2,
    hourly_php: 0, price_3h: 0, price_6h: 0, price_12h: 0,
    overnight_php: 1500, nightly_php: 1500,
    promo_price: 0, min_nights: 1, description: "",
  });
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imagesUploading, setImagesUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [publishGateOpen, setPublishGateOpen] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  if (!user) return null;

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
    setSelectedAmenities((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  }

  async function submitListing(isDraft: boolean) {
    if (!title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    if (!form.city.trim() || !form.province.trim()) { toast({ title: "City and province are required", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const slug = slugify(title, listingId);
      const { error } = await supabase.from("listings").upsert({
        id: listingId, slug, host_id: user!.id,
        title: title.trim(), description: form.description.trim(),
        type: inferLegacyType(form.stay_category) as never,
        stay_availability_type: form.stay_availability_type,
        stay_category: form.stay_category, booking_mode: form.booking_mode,
        city: form.city.trim(), province: form.province.trim(),
        address: form.address.trim() || null,
        bedrooms: form.bedrooms, bathrooms: form.bathrooms, max_guests: form.max_guests,
        hourly_php: form.hourly_php || null, price_3h: form.price_3h || null,
        price_6h: form.price_6h || null, price_12h: form.price_12h || null,
        overnight_php: form.overnight_php || null,
        promo_price: form.promo_price || null,
        nightly_php: form.overnight_php,
        min_nights: form.min_nights, amenities: selectedAmenities,
        images, video_url: videoUrl, status: "draft",
      }, { onConflict: "id" });
      if (error) throw error;
      if (isDraft) {
        toast({ title: "Saved as draft", description: "You can publish it anytime from My Listings." });
      } else {
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
    const { error } = await supabase.from("listings")
      .update({ status: "active", images, video_url: videoUrl })
      .eq("id", publishingId);
    if (error) {
      toast({ title: "Cannot publish", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Listing published!", description: "Your listing is now live." });
    setPublishGateOpen(false);
    setPublishingId(null);
    setListingId(crypto.randomUUID());
    navigate(`/listing/${publishingId}`);
  }

  return (
    <>
      <Seo title="New Listing · CheapStays Host" description="Create a new listing." path="/host/new-listing" />
      <div className="max-w-3xl space-y-8">
        <h1 className="text-2xl font-semibold tracking-tight">New listing</h1>

        {/* AI description generator */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="font-medium">AI description generator</h2>
            <Badge variant="secondary" className="text-[10px]">Optional</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Paste your listing's facts and we'll write a clean, honest description.</p>
          <div className="space-y-2">
            <Label>Listing title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cozy 1BR Condo in Cubao, Quezon City" />
          </div>
          <div className="space-y-2">
            <Label>Bullet points (one per line)</Label>
            <Textarea rows={5} value={bullets} onChange={(e) => setBullets(e.target.value)} placeholder={"40m² · 1 bed\nQuezon City · near MRT\nFast WiFi"} />
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

        {/* Listing form */}
        <Card className="p-6 space-y-6">
          <h2 className="font-medium text-lg">Listing details</h2>

          <div className="space-y-2">
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cozy 1BR Condo in Cubao, Quezon City" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>City *</Label>
              <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Quezon City" />
            </div>
            <div className="space-y-2">
              <Label>Province / Region *</Label>
              <Input value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))} placeholder="NCR" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Address <span className="text-muted-foreground text-xs">(optional — shown after booking)</span></Label>
            <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Unit 12, Tower A, Example St." />
          </div>

          <div className="space-y-2">
            <Label>Stay Category</Label>
            <div className="flex flex-wrap gap-2">
              {STAY_CATEGORIES.map((t) => (
                <button key={t.value} type="button" onClick={() => setForm((f) => ({ ...f, stay_category: t.value }))}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${form.stay_category === t.value ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:border-foreground/30"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Availability Type</Label>
            <div className="flex flex-wrap gap-2">
              {[{value:"overnight",label:"Overnight stays only"},{value:"hourly",label:"Hourly stays only"},{value:"both",label:"Both overnight & hourly"}].map((t) => (
                <button key={t.value} type="button" onClick={() => setForm((f) => ({ ...f, stay_availability_type: t.value }))}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${form.stay_availability_type === t.value ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:border-foreground/30"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Booking Mode</Label>
            <div className="flex flex-wrap gap-2">
              {[{value:"instant",label:"Instant Book"},{value:"manual_review",label:"Manual Review"},{value:"voucher",label:"Voucher / Open Date"}].map((t) => (
                <button key={t.value} type="button" onClick={() => setForm((f) => ({ ...f, booking_mode: t.value }))}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${form.booking_mode === t.value ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:border-foreground/30"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2"><Label>Bedrooms</Label><Input type="number" min={0} max={20} value={form.bedrooms} onChange={(e) => setForm((f) => ({ ...f, bedrooms: Number(e.target.value) }))} /></div>
            <div className="space-y-2"><Label>Bathrooms</Label><Input type="number" min={1} max={20} step={0.5} value={form.bathrooms} onChange={(e) => setForm((f) => ({ ...f, bathrooms: Number(e.target.value) }))} /></div>
            <div className="space-y-2"><Label>Max guests</Label><Input type="number" min={1} max={50} value={form.max_guests} onChange={(e) => setForm((f) => ({ ...f, max_guests: Number(e.target.value) }))} /></div>
          </div>

          <div className="space-y-2">
            <Label>Promo price (₱) <span className="text-muted-foreground text-xs">(optional slash price)</span></Label>
            <Input type="number" min={0} step={50} value={form.promo_price || ""} onChange={(e) => setForm((f) => ({ ...f, promo_price: Number(e.target.value) }))} />
          </div>

          {(form.stay_availability_type === "overnight" || form.stay_availability_type === "both") && (
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/60">
              <div className="space-y-2"><Label>Overnight price (₱)</Label><Input type="number" min={100} step={50} value={form.overnight_php} onChange={(e) => setForm((f) => ({ ...f, overnight_php: Number(e.target.value) }))} /></div>
              <div className="space-y-2"><Label>Minimum nights</Label><Input type="number" min={1} max={30} value={form.min_nights} onChange={(e) => setForm((f) => ({ ...f, min_nights: Number(e.target.value) }))} /></div>
            </div>
          )}

          {(form.stay_availability_type === "hourly" || form.stay_availability_type === "both") && (
            <div className="space-y-4 pt-2 border-t border-border/60">
              <h3 className="font-medium text-sm">Hourly Pricing</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Base Hourly Rate (₱)</Label><Input type="number" min={0} step={50} value={form.hourly_php || ""} onChange={(e) => setForm((f) => ({ ...f, hourly_php: Number(e.target.value) }))} /></div>
                <div className="space-y-2"><Label>3-Hour Block (₱)</Label><Input type="number" min={0} step={50} value={form.price_3h || ""} onChange={(e) => setForm((f) => ({ ...f, price_3h: Number(e.target.value) }))} /></div>
                <div className="space-y-2"><Label>6-Hour Block (₱)</Label><Input type="number" min={0} step={50} value={form.price_6h || ""} onChange={(e) => setForm((f) => ({ ...f, price_6h: Number(e.target.value) }))} /></div>
                <div className="space-y-2"><Label>12-Hour Block (₱)</Label><Input type="number" min={0} step={50} value={form.price_12h || ""} onChange={(e) => setForm((f) => ({ ...f, price_12h: Number(e.target.value) }))} /></div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea rows={6} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Describe your place…" />
            <p className="text-xs text-muted-foreground">Use the AI generator above to write this for you.</p>
          </div>

          <div className="space-y-3">
            <Label>Amenities</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AMENITY_OPTIONS.map((a) => {
                const checked = selectedAmenities.includes(a);
                return (
                  <button key={a} type="button" onClick={() => toggleAmenity(a)}
                    className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition-colors text-left ${checked ? "border-primary/60 bg-primary/5 text-foreground" : "border-border/50 hover:border-foreground/20 text-muted-foreground"}`}>
                    {checked ? <CheckSquare className="h-4 w-4 text-primary shrink-0" /> : <Square className="h-4 w-4 shrink-0" />}
                    {AMENITY_LABELS[a] ?? a}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-border/60">
            <div>
              <Label>Photos <span className="text-muted-foreground text-xs">(up to 10)</span></Label>
              <p className="text-xs text-muted-foreground mt-0.5">Upload photos now or add them later from My Listings.</p>
            </div>
            <ImageUploader userId={user.id} listingId={listingId} value={images} onChange={setImages} onUploadingChange={setImagesUploading} maxFiles={10} />
          </div>

          <div className="space-y-3 pt-2 border-t border-border/60">
            <div>
              <Label>Video tour <span className="text-muted-foreground text-xs">(optional · max 30 s)</span></Label>
              <p className="text-xs text-muted-foreground mt-0.5">A short walkthrough video significantly increases bookings.</p>
            </div>
            <VideoUploader userId={user.id} listingId={listingId} value={videoUrl} onChange={setVideoUrl} />
          </div>

          <div className="flex flex-wrap gap-3 pt-2 border-t border-border/60">
            <Button onClick={() => submitListing(false)} disabled={submitting || imagesUploading} className="gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {imagesUploading ? "Uploading photos…" : "Publish listing"}
            </Button>
            <Button variant="outline" onClick={() => submitListing(true)} disabled={submitting || imagesUploading}>
              Save as draft
            </Button>
          </div>
        </Card>
      </div>

      {publishingId && (
        <Dialog open={publishGateOpen} onOpenChange={setPublishGateOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Finish setup before publishing</DialogTitle>
              <DialogDescription>
                Your listing was saved as a draft. Complete every requirement below to publish it.
              </DialogDescription>
            </DialogHeader>
            <ListingPublishGate listingId={publishingId} userId={user.id} onAllPassed={finalizePublish} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
