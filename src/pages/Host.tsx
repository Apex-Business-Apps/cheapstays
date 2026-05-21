import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { aiDescribeSchema } from "@/lib/schemas";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isHost } from "@/lib/rbac";
import { Sparkles, Loader2, CheckSquare, Square } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Link } from "react-router-dom";

const LISTING_TYPES = [
  { value: "entire_place", label: "Entire place" },
  { value: "private_room", label: "Private room" },
  { value: "shared_room", label: "Shared room" },
  { value: "villa", label: "Villa" },
  { value: "glamping", label: "Glamping" },
];

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


export default function Host() {
  const { user, roles, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // AI description generator state
  const [title, setTitle] = useState("");
  const [bullets, setBullets] = useState("");
  const [aiOut, setAiOut] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Listing form state
  const [form, setForm] = useState({
    type: "entire_place",
    city: "",
    province: "",
    address: "",
    bedrooms: 1,
    bathrooms: 1,
    max_guests: 2,
    nightly_php: 1500,
    min_nights: 1,
    is_owner_direct: true,
    instant_book: false,
    description: "",
  });
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

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
      setAiLoading(false); }
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
      const id = crypto.randomUUID();
      const slug = slugify(title, id);

      const { error } = await supabase.from("listings").insert({
        id,
        slug,
        host_id: user.id,
        title: title.trim(),
        description: form.description.trim(),
        type: form.type,
        city: form.city.trim(),
        province: form.province.trim(),
        address: form.address.trim() || null,
        bedrooms: form.bedrooms,
        bathrooms: form.bathrooms,
        max_guests: form.max_guests,
        nightly_php: form.nightly_php,
        min_nights: form.min_nights,
        amenities: selectedAmenities,
        images: [],
        is_owner_direct: form.is_owner_direct,
        instant_book: form.instant_book,
        status: isDraft ? "draft" : "active",
      });

      if (error) throw error;

      toast({
        title: isDraft ? "Saved as draft" : "Listing published!",
        description: isDraft
          ? "You can publish it anytime from this page."
          : "Your listing is now live and searchable.",
      });

      if (!isDraft) navigate(`/listing/${id}`);
    } catch (err) {
      toast({ title: "Failed to save listing", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <div className="container py-24 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container py-24 max-w-xl text-center">
        <Seo title="Host on CheapStays" description="List your property and reach verified travelers directly." path="/host" />
        <h1 className="text-2xl font-semibold">Sign in to host</h1>
        <p className="text-muted-foreground mt-2">You need an account to list your property on CheapStays.</p>
        <Link to="/auth">
          <Button className="mt-6">Sign in or create account</Button>
        </Link>
      </div>
    );
  }

  if (!isHost(roles)) {
    return (
      <div className="container py-24 max-w-xl text-center">
        <Seo title="Become a Host · CheapStays" description="Apply to list your property on CheapStays." path="/host" />
        <h1 className="text-2xl font-semibold">Apply to become a host</h1>
        <p className="text-muted-foreground mt-3">
          Your account doesn't have host access yet. Contact support and an admin will review your application — usually within 24 hours.
        </p>
        <div className="flex gap-3 justify-center mt-6">
          <Link to="/support">
            <Button>Contact support</Button>
          </Link>
          <Link to="/search">
            <Button variant="outline">Browse listings</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Seo title="Host tools · CheapStays" description="Create and manage your listings on CheapStays." path="/host" />
      <div className="container py-12 max-w-3xl space-y-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Host tools</h1>
          <p className="text-muted-foreground mt-2">Create a listing and reach verified travelers directly.</p>
        </div>

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
            <Label>Property type</Label>
            <div className="flex flex-wrap gap-2">
              {LISTING_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: t.value }))}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    form.type === t.value
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
                type="number"
                min={0}
                max={20}
                value={form.bedrooms}
                onChange={(e) => setForm((f) => ({ ...f, bedrooms: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Bathrooms</Label>
              <Input
                type="number"
                min={1}
                max={20}
                step={0.5}
                value={form.bathrooms}
                onChange={(e) => setForm((f) => ({ ...f, bathrooms: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Max guests</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={form.max_guests}
                onChange={(e) => setForm((f) => ({ ...f, max_guests: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nightly price (₱)</Label>
              <Input
                type="number"
                min={100}
                step={50}
                value={form.nightly_php}
                onChange={(e) => setForm((f) => ({ ...f, nightly_php: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Minimum nights</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={form.min_nights}
                onChange={(e) => setForm((f) => ({ ...f, min_nights: Number(e.target.value) }))}
              />
            </div>
          </div>

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
                    {checked
                      ? <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                      : <Square className="h-4 w-4 shrink-0" />}
                    {AMENITY_LABELS[a] ?? a}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Booking options</Label>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, is_owner_direct: !f.is_owner_direct }))}
                className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition-colors ${
                  form.is_owner_direct
                    ? "border-primary/60 bg-primary/5"
                    : "border-border/50 text-muted-foreground"
                }`}
              >
                {form.is_owner_direct ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                Owner direct
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, instant_book: !f.instant_book }))}
                className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition-colors ${
                  form.instant_book
                    ? "border-primary/60 bg-primary/5"
                    : "border-border/50 text-muted-foreground"
                }`}
              >
                {form.instant_book ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                Instant book
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2 border-t border-border/60">
            <Button
              onClick={() => submitListing(false)}
              disabled={submitting}
              className="gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Publish listing
            </Button>
            <Button
              variant="outline"
              onClick={() => submitListing(true)}
              disabled={submitting}
            >
              Save as draft
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
