import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckSquare, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ImageUploader } from "@/components/ImageUploader";
import { VideoUploader } from "@/components/VideoUploader";
import { ListingPhotoCarousel } from "@/components/ListingPhotoCarousel";
import type { Listing } from "@/lib/listing-display";

// Kept in sync with NewListingPage.tsx:22-62. Duplicated intentionally to keep
// this refactor scoped; extract to a shared file when NewListingPage is
// refactored into the same stepper.
const STAY_CATEGORIES = [
  { value: "quick_stay",     label: "Quick Stay" },
  { value: "hourly_stay",    label: "Hourly Stay" },
  { value: "overnight_stay", label: "Overnight Stay" },
  { value: "hostel",         label: "Hostel" },
  { value: "private_pool",   label: "Private Pool" },
  { value: "condo",          label: "Condo" },
  { value: "apartment",      label: "Apartment" },
  { value: "hotel_room",     label: "Hotel Room" },
  { value: "motel_room",     label: "Motel Room" },
];

const AVAILABILITY_TYPES = [
  { value: "overnight", label: "Overnight only" },
  { value: "hourly",    label: "Hourly only" },
  { value: "both",      label: "Both" },
];

const BOOKING_MODES = [
  { value: "instant",        label: "Instant Book" },
  { value: "manual_review",  label: "Manual Review" },
  { value: "voucher",        label: "Voucher / Open Date" },
];

const AMENITY_OPTIONS = [
  "wifi","aircon","fan","kitchen","kitchenette","kitchen_shared",
  "hot_water","outdoor_shower","parking","pool","private_pool",
  "rooftop_pool","gym","work_desk","smart_tv","tv",
  "breakfast_included","pet_friendly","beach_access","hammock",
  "kayak","snorkel_gear","bike_rental","bbq_grill","fire_pit",
  "fireplace","garden","terrace","board_rack","electric_blankets",
];

const AMENITY_LABEL_MAP: Record<string, string> = {
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

const STEP_LABELS = ["Basics", "Location", "Type & booking", "Capacity & pricing", "Amenities", "Media"];
const STEP_COUNT = STEP_LABELS.length;

type FormState = {
  title: string;
  description: string;
  city: string;
  province: string;
  address: string;
  stay_category: string;
  stay_availability_type: "overnight" | "hourly" | "both";
  booking_mode: "instant" | "manual_review" | "voucher";
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  promo_price: number;
  overnight_php: number;
  min_nights: number;
  hourly_php: number;
  price_3h: number;
  price_6h: number;
  price_12h: number;
  amenities: string[];
  images: string[];
  video_url: string | null;
};

function fromListing(l: Listing): FormState {
  return {
    title: l.title ?? "",
    description: l.description ?? "",
    city: l.city ?? "",
    province: l.province ?? "",
    address: l.address ?? "",
    stay_category: l.stay_category ?? "overnight_stay",
    stay_availability_type: (l.stay_availability_type ?? "overnight") as FormState["stay_availability_type"],
    booking_mode: (l.booking_mode ?? "instant") as FormState["booking_mode"],
    bedrooms: l.bedrooms ?? 1,
    bathrooms: l.bathrooms ?? 1,
    max_guests: l.max_guests ?? 2,
    promo_price: l.promo_price ?? 0,
    overnight_php: l.overnight_php ?? l.nightly_php ?? 0,
    min_nights: l.min_nights ?? 1,
    hourly_php: l.hourly_php ?? 0,
    price_3h: l.price_3h ?? 0,
    price_6h: l.price_6h ?? 0,
    price_12h: l.price_12h ?? 0,
    amenities: l.amenities ?? [],
    images: l.images ?? [],
    video_url: l.video_url ?? null,
  };
}

type SavedPatch = Partial<Listing>;

type Props = {
  listing: Listing;
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (patch: SavedPatch) => void;
};

export function EditListingDialog({ listing, userId, open, onOpenChange, onSaved }: Props) {
  const initial = useMemo(() => fromListing(listing), [listing]);
  const [form, setForm] = useState<FormState>(initial);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [imagesUploading, setImagesUploading] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Reset when the target listing changes or the dialog re-opens.
  useEffect(() => {
    if (open) {
      setForm(initial);
      setStep(0);
    }
  }, [open, initial]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const toggleAmenity = useCallback((a: string) => {
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a],
    }));
  }, []);

  function validateStep(s: number): string | null {
    if (s === 0 && !form.title.trim()) return "Title is required.";
    if (s === 1 && (!form.city.trim() || !form.province.trim())) return "City and province are required.";
    if (s === 3) {
      if (form.bedrooms < 0 || form.bathrooms < 1 || form.max_guests < 1) return "Capacity values look wrong.";
      if ((form.stay_availability_type === "overnight" || form.stay_availability_type === "both") && form.overnight_php <= 0)
        return "Overnight price is required.";
    }
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) { toast({ title: err, variant: "destructive" }); return; }
    if (step < STEP_COUNT - 1) setStep((s) => s + 1);
  }
  function back() { if (step > 0) setStep((s) => s - 1); }

  async function save() {
    // Final-step validation across the whole form.
    for (let s = 0; s <= STEP_COUNT - 1; s++) {
      const err = validateStep(s);
      if (err) { setStep(s); toast({ title: err, variant: "destructive" }); return; }
    }
    if (imagesUploading) {
      toast({ title: "Photos are still uploading", description: "Wait for uploads to finish before saving.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      city: form.city.trim(),
      province: form.province.trim(),
      address: form.address.trim() || null,
      stay_category: form.stay_category,
      stay_availability_type: form.stay_availability_type,
      booking_mode: form.booking_mode,
      bedrooms: form.bedrooms,
      bathrooms: form.bathrooms,
      max_guests: form.max_guests,
      promo_price: form.promo_price || null,
      overnight_php: form.overnight_php || null,
      nightly_php: form.overnight_php || listing.nightly_php,
      min_nights: form.min_nights,
      hourly_php: form.hourly_php || null,
      price_3h: form.price_3h || null,
      price_6h: form.price_6h || null,
      price_12h: form.price_12h || null,
      amenities: form.amenities,
      images: form.images,
      video_url: form.video_url,
    };

    const { data, error } = await supabase
      .from("listings")
      .update(payload)
      .eq("id", listing.id)
      .eq("host_id", userId)
      .select("id")
      .maybeSingle();

    setSaving(false);

    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    if (!data) {
      toast({
        title: "Nothing was saved",
        description: "You may not own this listing, or a permission rule blocked the change.",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Listing updated" });
    onSaved(payload as SavedPatch);
    onOpenChange(false);
  }

  function requestClose(open: boolean) {
    if (!open && dirty) { setConfirmDiscard(true); return; }
    onOpenChange(open);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <DialogTitle>Edit listing</DialogTitle>
            <DialogDescription className="sr-only">
              Edit your listing across {STEP_COUNT} steps: basics, location, type, capacity, amenities, and media.
            </DialogDescription>
            <Stepper current={step} onSelect={setStep} />
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {step === 0 && (
              <>
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input value={form.title} onChange={(e) => update("title", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea rows={8} value={form.description} onChange={(e) => update("description", e.target.value)} />
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>City *</Label>
                    <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Province / Region *</Label>
                    <Input value={form.province} onChange={(e) => update("province", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Address <span className="text-muted-foreground text-xs">(shown after booking)</span></Label>
                  <Input value={form.address} onChange={(e) => update("address", e.target.value)} />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <PillGroup
                  label="Stay category"
                  value={form.stay_category}
                  options={STAY_CATEGORIES}
                  onChange={(v) => update("stay_category", v)}
                />
                <PillGroup
                  label="Availability"
                  value={form.stay_availability_type}
                  options={AVAILABILITY_TYPES}
                  onChange={(v) => update("stay_availability_type", v as FormState["stay_availability_type"])}
                />
                <PillGroup
                  label="Booking mode"
                  value={form.booking_mode}
                  options={BOOKING_MODES}
                  onChange={(v) => update("booking_mode", v as FormState["booking_mode"])}
                />
              </>
            )}

            {step === 3 && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Bedrooms</Label>
                    <Input type="number" min={0} max={20} value={form.bedrooms}
                      onChange={(e) => update("bedrooms", Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Bathrooms</Label>
                    <Input type="number" min={1} max={20} step={0.5} value={form.bathrooms}
                      onChange={(e) => update("bathrooms", Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Max guests</Label>
                    <Input type="number" min={1} max={50} value={form.max_guests}
                      onChange={(e) => update("max_guests", Number(e.target.value))} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Promo price (₱) <span className="text-muted-foreground text-xs">(optional slash price)</span></Label>
                  <Input type="number" min={0} step={50} value={form.promo_price || ""}
                    onChange={(e) => update("promo_price", Number(e.target.value))} />
                </div>

                {(form.stay_availability_type === "overnight" || form.stay_availability_type === "both") && (
                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
                    <div className="space-y-2">
                      <Label>Overnight price (₱)</Label>
                      <Input type="number" min={100} step={50} value={form.overnight_php}
                        onChange={(e) => update("overnight_php", Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Minimum nights</Label>
                      <Input type="number" min={1} max={30} value={form.min_nights}
                        onChange={(e) => update("min_nights", Number(e.target.value))} />
                    </div>
                  </div>
                )}

                {(form.stay_availability_type === "hourly" || form.stay_availability_type === "both") && (
                  <div className="pt-3 border-t border-border space-y-3">
                    <h3 className="text-sm font-medium">Hourly pricing</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Base hourly rate (₱)</Label>
                        <Input type="number" min={0} step={50} value={form.hourly_php || ""}
                          onChange={(e) => update("hourly_php", Number(e.target.value))} />
                      </div>
                      <div className="space-y-2">
                        <Label>3-hour block (₱)</Label>
                        <Input type="number" min={0} step={50} value={form.price_3h || ""}
                          onChange={(e) => update("price_3h", Number(e.target.value))} />
                      </div>
                      <div className="space-y-2">
                        <Label>6-hour block (₱)</Label>
                        <Input type="number" min={0} step={50} value={form.price_6h || ""}
                          onChange={(e) => update("price_6h", Number(e.target.value))} />
                      </div>
                      <div className="space-y-2">
                        <Label>12-hour block (₱)</Label>
                        <Input type="number" min={0} step={50} value={form.price_12h || ""}
                          onChange={(e) => update("price_12h", Number(e.target.value))} />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <Label>Amenities</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {AMENITY_OPTIONS.map((a) => {
                    const checked = form.amenities.includes(a);
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleAmenity(a)}
                        className={cn(
                          "flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition-colors text-left",
                          checked
                            ? "border-primary/60 bg-primary/5 text-foreground"
                            : "border-border hover:border-foreground/20 text-muted-foreground",
                        )}
                      >
                        {checked ? <CheckSquare className="h-4 w-4 text-primary shrink-0" /> : <Square className="h-4 w-4 shrink-0" />}
                        {AMENITY_LABEL_MAP[a] ?? a}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 5 && (
              <>
                {form.images.length > 0 && (
                  <div className="space-y-2">
                    <Label>Preview</Label>
                    <ListingPhotoCarousel images={form.images} title={form.title} variant="modal" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Photos <span className="text-muted-foreground text-xs">(up to 10)</span></Label>
                  <ImageUploader
                    userId={userId}
                    listingId={listing.id}
                    value={form.images}
                    onChange={(imgs) => update("images", imgs)}
                    onUploadingChange={setImagesUploading}
                    maxFiles={10}
                  />
                </div>
                <div className="space-y-2 pt-3 border-t border-border">
                  <Label>Video tour <span className="text-muted-foreground text-xs">(max 30 s)</span></Label>
                  <VideoUploader
                    userId={userId}
                    listingId={listing.id}
                    value={form.video_url}
                    onChange={(url) => update("video_url", url)}
                  />
                </div>
              </>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={back} disabled={step === 0}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <p className="text-xs text-muted-foreground tabular-nums">
              Step {step + 1} of {STEP_COUNT} · <span className="text-foreground">{STEP_LABELS[step]}</span>
            </p>
            {step < STEP_COUNT - 1 ? (
              <Button onClick={next}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={save} disabled={saving || imagesUploading}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {imagesUploading ? "Uploading photos…" : "Save changes"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved edits. Closing now will lose everything since you opened the editor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setConfirmDiscard(false); onOpenChange(false); }}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Stepper({ current, onSelect }: { current: number; onSelect: (i: number) => void }) {
  return (
    <div className="mt-4 flex items-center gap-1.5">
      {STEP_LABELS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const clickable = i <= current;
        return (
          <button
            key={label}
            type="button"
            disabled={!clickable}
            onClick={() => clickable && onSelect(i)}
            className={cn(
              "group flex-1 flex items-center gap-1.5",
              !clickable && "cursor-default",
            )}
            aria-current={active ? "step" : undefined}
          >
            <span
              className={cn(
                "grid place-items-center h-6 w-6 rounded-full text-[11px] font-semibold shrink-0 transition-colors",
                done ? "bg-primary text-primary-foreground" :
                active ? "bg-foreground text-background" :
                "bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span
              className={cn(
                "hidden sm:inline text-[11px] font-medium truncate transition-colors",
                active ? "text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/60",
              )}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PillGroup({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm border transition-colors",
              value === o.value
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:border-foreground/30",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
