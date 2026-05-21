import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { aiDescribeSchema } from "@/lib/schemas";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles, Loader2, CheckCircle2, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { Seo } from "@/components/Seo";

const AMENITY_OPTIONS = [
  { value: "wifi", label: "WiFi" },
  { value: "aircon", label: "Air conditioning" },
  { value: "kitchen", label: "Kitchen" },
  { value: "parking", label: "Parking" },
  { value: "pool", label: "Pool" },
  { value: "beach_access", label: "Beach access" },
  { value: "outdoor_shower", label: "Outdoor shower" },
  { value: "hammock", label: "Hammock" },
  { value: "generator", label: "Generator" },
  { value: "fan", label: "Fan" },
  { value: "hot_water", label: "Hot water" },
  { value: "tv", label: "TV" },
];

const LISTING_TYPES: { value: string; label: string }[] = [
  { value: "entire_place", label: "Entire place" },
  { value: "private_room", label: "Private room" },
  { value: "villa",        label: "Villa" },
  { value: "glamping",     label: "Glamping" },
  { value: "resort",       label: "Resort" },
];

type VerificationStatus = "pending" | "approved" | "rejected" | null;

export default function Host() {
  const { user, roles } = useAuth();
  const isHost = roles.includes("host");

  // Host profile state
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>(null);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");

  // Listing form state
  const [listingTitle, setListingTitle] = useState("");
  const [listingType, setListingType] = useState("");
  const [listingCity, setListingCity] = useState("");
  const [listingProvince, setListingProvince] = useState("");
  const [bedrooms, setBedrooms] = useState(1);
  const [bathrooms, setBathrooms] = useState(1);
  const [maxGuests, setMaxGuests] = useState(2);
  const [nightlyPhp, setNightlyPhp] = useState(1500);
  const [minNights, setMinNights] = useState(1);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [instantBook, setInstantBook] = useState(false);
  const [listingSubmitting, setListingSubmitting] = useState(false);

  // AI description state
  const [aiTitle, setAiTitle] = useState("");
  const [aiBullets, setAiBullets] = useState("");
  const [aiOut, setAiOut] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  function toggleAmenity(value: string) {
    setSelectedAmenities((prev) =>
      prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value]
    );
  }

  async function submitProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!displayName.trim() || !phone.trim() || !city.trim()) {
      toast({ title: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    setProfileSubmitting(true);
    try {
      const { error } = await supabase.from("host_profiles").upsert({
        user_id: user.id,
        display_name: displayName.trim(),
        phone: phone.trim(),
        location: city.trim(),
        bio: bio.trim(),
        verification_status: "pending",
      });
      if (error) throw error;
      setVerificationStatus("pending");
      toast({ title: "Application submitted!", description: "We will review your profile within 24 hours." });
    } catch (err) {
      toast({ title: "Submission failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setProfileSubmitting(false);
    }
  }

  async function saveListing(isDraft: boolean) {
    if (!user) return;
    if (!isDraft && !isHost) {
      toast({
        title: "Host verification required",
        description: "Complete your host profile and wait for approval before publishing listings.",
        variant: "destructive",
      });
      return;
    }
    if (!listingTitle.trim() || !listingType || !listingCity.trim() || !listingProvince.trim()) {
      toast({ title: "Please fill in all required listing fields.", variant: "destructive" });
      return;
    }
    if (nightlyPhp < 500) {
      toast({ title: "Nightly rate must be at least ₱500.", variant: "destructive" });
      return;
    }
    setListingSubmitting(true);
    try {
      const { error } = await supabase.from("listings").insert({
        host_id: user.id,
        title: listingTitle.trim(),
        type: listingType,
        city: listingCity.trim(),
        province: listingProvince.trim(),
        bedrooms,
        bathrooms,
        max_guests: maxGuests,
        nightly_php: nightlyPhp,
        min_nights: minNights,
        amenities: selectedAmenities,
        description: description.trim(),
        instant_book: instantBook,
        status: isDraft ? "draft" : "active",
        is_owner_direct: true,
      });
      if (error) throw error;
      toast({
        title: isDraft ? "Listing saved as draft." : "Listing published!",
        description: isDraft
          ? "You can edit and publish it anytime."
          : "Travelers can now find and book your place.",
      });
      if (!isDraft) {
        setListingTitle("");
        setListingType("");
        setListingCity("");
        setListingProvince("");
        setBedrooms(1);
        setBathrooms(1);
        setMaxGuests(2);
        setNightlyPhp(1500);
        setMinNights(1);
        setSelectedAmenities([]);
        setDescription("");
        setInstantBook(false);
      }
    } catch (err) {
      toast({ title: "Could not save listing", description: (err as Error).message, variant: "destructive" });
    } finally {
      setListingSubmitting(false);
    }
  }

  async function generateDescription() {
    const parsed = aiDescribeSchema.safeParse({
      title: aiTitle,
      bullets: aiBullets.split("\n").map((b) => b.trim()).filter(Boolean),
      tone: "confident",
    });
    if (!parsed.success) {
      toast({ title: "Add a title and at least one bullet point.", variant: "destructive" });
      return;
    }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-describe", { body: parsed.data });
      if (error) throw error;
      setAiOut(data?.description ?? "");
    } catch (err) {
      toast({ title: "AI error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }

  if (!user) {
    return (
      <div>
        <Seo title="Host on CheapStays" description="List your property on CheapStays and reach verified travelers directly." path="/host" />
        <div className="container py-24 max-w-lg text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Become a host</h1>
          <p className="mt-3 text-muted-foreground">
            Sign in to set up your host profile and start listing your place on CheapStays.
          </p>
          <Button asChild className="mt-6">
            <Link to="/auth">Sign in to get started</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Seo title="Host on CheapStays" description="List your property on CheapStays and reach verified travelers directly." path="/host" />
      <div className="container py-12 max-w-3xl space-y-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Host tools</h1>
          <p className="mt-2 text-muted-foreground">
            Set up your host profile, create a listing, and let CheapStays travelers find your place.
          </p>
        </div>

        {/* Section 1: Host Profile */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Become a verified host</h2>
          {verificationStatus === "pending" ? (
            <Card className="p-6 flex items-center gap-4">
              <Clock className="h-6 w-6 text-amber-500 shrink-0" />
              <div>
                <p className="font-medium">Verification in progress</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  We received your application and will review it within 24 hours. You will get an email once approved.
                </p>
                <Badge variant="secondary" className="mt-2">Status: Pending</Badge>
              </div>
            </Card>
          ) : verificationStatus === "approved" ? (
            <Card className="p-6 flex items-center gap-4">
              <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
              <div>
                <p className="font-medium text-green-700">You are a verified host!</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Your profile is live. Travelers can now see your host badge.
                </p>
              </div>
            </Card>
          ) : (
            <Card className="p-6">
              <p className="text-sm text-muted-foreground mb-5">
                Verified hosts get a trust badge, higher search ranking, and direct contact with travelers.
                Verification usually takes less than 24 hours.
              </p>
              <form onSubmit={submitProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="display-name">Full name *</Label>
                    <Input
                      id="display-name"
                      placeholder="Maria Santos"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone / GCash number *</Label>
                    <Input
                      id="phone"
                      placeholder="+63 9XX XXX XXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="host-city">City / Location *</Label>
                  <Input
                    id="host-city"
                    placeholder="Cebu City, Cebu"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bio">Short bio</Label>
                  <Textarea
                    id="bio"
                    rows={3}
                    placeholder="Tell travelers a bit about yourself and your place..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="id-photo">Upload ID photo</Label>
                    <Input id="id-photo" type="file" accept="image/*" />
                    <p className="text-xs text-muted-foreground">Government-issued ID (front)</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="selfie">Upload selfie with ID</Label>
                    <Input id="selfie" type="file" accept="image/*" />
                    <p className="text-xs text-muted-foreground">Hold your ID next to your face</p>
                  </div>
                </div>
                <Button type="submit" disabled={profileSubmitting}>
                  {profileSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Submit for verification
                </Button>
              </form>
            </Card>
          )}
        </section>

        <Separator />

        {/* Section 2: Create Listing */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Create a listing</h2>
          <Card className="p-6 space-y-5">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="listing-title">Title *</Label>
              <Input
                id="listing-title"
                placeholder="Cozy beachfront cottage in El Nido"
                value={listingTitle}
                onChange={(e) => setListingTitle(e.target.value)}
              />
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <Select value={listingType} onValueChange={setListingType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {LISTING_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="listing-city">City *</Label>
                <Input
                  id="listing-city"
                  placeholder="El Nido"
                  value={listingCity}
                  onChange={(e) => setListingCity(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="listing-province">Province *</Label>
                <Input
                  id="listing-province"
                  placeholder="Palawan"
                  value={listingProvince}
                  onChange={(e) => setListingProvince(e.target.value)}
                />
              </div>
            </div>

            {/* Rooms and guests */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="bedrooms">Bedrooms</Label>
                <Input
                  id="bedrooms"
                  type="number"
                  min={0}
                  max={10}
                  value={bedrooms}
                  onChange={(e) => setBedrooms(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bathrooms">Bathrooms</Label>
                <Input
                  id="bathrooms"
                  type="number"
                  min={0}
                  max={10}
                  value={bathrooms}
                  onChange={(e) => setBathrooms(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max-guests">Max guests</Label>
                <Input
                  id="max-guests"
                  type="number"
                  min={1}
                  max={20}
                  value={maxGuests}
                  onChange={(e) => setMaxGuests(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="min-nights">Min nights</Label>
                <Input
                  id="min-nights"
                  type="number"
                  min={1}
                  max={30}
                  value={minNights}
                  onChange={(e) => setMinNights(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-1.5">
              <Label htmlFor="nightly-rate">Nightly rate (₱) *</Label>
              <Input
                id="nightly-rate"
                type="number"
                min={500}
                step={100}
                value={nightlyPhp}
                onChange={(e) => setNightlyPhp(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Minimum ₱500/night. Travelers pay you directly via GCash, Maya, or card.</p>
            </div>

            {/* Amenities */}
            <div className="space-y-2">
              <Label>Amenities</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {AMENITY_OPTIONS.map((a) => (
                  <label
                    key={a.value}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer select-none transition-colors ${
                      selectedAmenities.includes(a.value)
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-muted-foreground/20 hover:border-primary/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={selectedAmenities.includes(a.value)}
                      onChange={() => toggleAmenity(a.value)}
                    />
                    <span
                      className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                        selectedAmenities.includes(a.value)
                          ? "bg-primary border-primary"
                          : "border-muted-foreground/40"
                      }`}
                    >
                      {selectedAmenities.includes(a.value) && (
                        <svg className="h-2.5 w-2.5 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    {a.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={5}
                placeholder="Describe your place honestly. Mention what makes it special and what guests should know before booking."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Instant book */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={instantBook}
                onChange={(e) => setInstantBook(e.target.checked)}
                className="h-4 w-4 rounded border-muted-foreground/40"
              />
              <div>
                <span className="text-sm font-medium">Enable instant book</span>
                <p className="text-xs text-muted-foreground">
                  Guests can book without waiting for your approval. Great for attracting more bookings.
                </p>
              </div>
            </label>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => saveListing(true)}
                disabled={listingSubmitting}
              >
                {listingSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save as draft
              </Button>
              <Button
                onClick={() => saveListing(false)}
                disabled={listingSubmitting}
              >
                {listingSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Publish listing
              </Button>
            </div>
          </Card>
        </section>

        <Separator />

        {/* Section 3: AI Description Generator (collapsible) */}
        <section>
          <button
            type="button"
            className="flex items-center justify-between w-full text-left group"
            onClick={() => setAiOpen((v) => !v)}
          >
            <div>
              <h2 className="text-xl font-semibold group-hover:text-primary transition-colors">
                AI description generator
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Paste bullet points, get a clean honest description instantly.
              </p>
            </div>
            {aiOpen ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0 ml-4" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0 ml-4" />
            )}
          </button>

          {aiOpen && (
            <Card className="p-6 mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ai-title">Listing title</Label>
                <Input
                  id="ai-title"
                  value={aiTitle}
                  onChange={(e) => setAiTitle(e.target.value)}
                  placeholder="Hilltop glamping tent in Batangas with sea view"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ai-bullets">Bullet points (one per line)</Label>
                <Textarea
                  id="ai-bullets"
                  rows={6}
                  value={aiBullets}
                  onChange={(e) => setAiBullets(e.target.value)}
                  placeholder={"2 queen beds · sleeps 4\nPrivate outdoor shower\nFast wifi · 100 Mbps\n20 min from Anilao dive sites\nBreakfast included"}
                />
              </div>
              <Button onClick={generateDescription} disabled={aiLoading}>
                <Sparkles className="h-4 w-4 mr-2" />
                {aiLoading ? "Writing..." : "Generate description"}
              </Button>
              {aiOut && (
                <div className="border-t pt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {aiOut}
                </div>
              )}
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
