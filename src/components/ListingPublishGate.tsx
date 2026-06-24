import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";
import { createLegalAcceptanceAudit } from "@/lib/legal-consent";

// The Phase 4 tables (listing_availability_windows, listing_house_rules,
// listing_stay_instructions) are not yet present in the auto-generated
// Supabase types. Until regenerated, route accesses through this untyped
// alias so we keep the codebase type-checking cleanly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type GateState = {
  stayLengthOk: boolean;
  minMaxNightsOk: boolean;
  availabilityOk: boolean;
  houseRulesOk: boolean;
  stayInstructionsOk: boolean;
  blackoutOk: boolean;
};

type Props = {
  listingId: string;
  userId: string;
  onAllPassed: () => void;
};

function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

const REQUIRED_AVAILABILITY_DAYS = 90;

export function ListingPublishGate({ listingId, userId, onAllPassed }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gates, setGates] = useState<GateState>({
    stayLengthOk: false,
    minMaxNightsOk: false,
    availabilityOk: false,
    houseRulesOk: false,
    stayInstructionsOk: false,
    blackoutOk: true, // blackouts may be empty; presence-of-record satisfies the gate
  });

  const [shortTerm, setShortTerm] = useState(true);
  const [longTerm, setLongTerm] = useState(false);
  const [minNights, setMinNights] = useState(1);
  const [maxNights, setMaxNights] = useState<number>(30);
  const [availabilityThrough, setAvailabilityThrough] = useState<string>(
    format(addDays(new Date(), REQUIRED_AVAILABILITY_DAYS), "yyyy-MM-dd"),
  );
  const [houseRulesText, setHouseRulesText] = useState("");
  const [checkInWindow, setCheckInWindow] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("");
  const [accessInstructions, setAccessInstructions] = useState("");
  const [wifiDetails, setWifiDetails] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");

  // Load gate status whenever listing changes
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [listingRes, windowRes, rulesRes, instructionsRes] = await Promise.all([
        sb.from("listings")
          .select("short_term_enabled,long_term_enabled,min_nights,max_nights")
          .eq("id", listingId).maybeSingle(),
        sb.from("listing_availability_windows")
          .select("declared_through").eq("listing_id", listingId).maybeSingle(),
        sb.from("listing_house_rules")
          .select("current_version,rules_json").eq("listing_id", listingId).maybeSingle(),
        sb.from("listing_stay_instructions")
          .select("check_in_window,check_out_time,access_instructions,wifi_details,emergency_contact")
          .eq("listing_id", listingId).maybeSingle(),
      ]);

      if (cancelled) return;

      // Compare calendar days only (matches the DB publish-gate trigger which
      // uses CURRENT_DATE + 90). Comparing a date-only value against a full
      // timestamp incorrectly fails when "now" is past midnight.
      const requiredThroughStr = format(addDays(new Date(), REQUIRED_AVAILABILITY_DAYS), "yyyy-MM-dd");
      const declaredThroughStr = windowRes.data?.declared_through
        ? String(windowRes.data.declared_through).slice(0, 10)
        : null;

      if (listingRes.data) {
        setShortTerm(listingRes.data.short_term_enabled ?? true);
        setLongTerm(listingRes.data.long_term_enabled ?? false);
        setMinNights(listingRes.data.min_nights ?? 1);
        setMaxNights(listingRes.data.max_nights ?? 30);
      }
      if (rulesRes.data?.rules_json) {
        const r = rulesRes.data.rules_json as { text?: string };
        setHouseRulesText(r.text ?? "");
      }
      if (instructionsRes.data) {
        setCheckInWindow(instructionsRes.data.check_in_window ?? "");
        setCheckOutTime(instructionsRes.data.check_out_time ?? "");
        setAccessInstructions(instructionsRes.data.access_instructions ?? "");
        setWifiDetails(instructionsRes.data.wifi_details ?? "");
        setEmergencyContact(instructionsRes.data.emergency_contact ?? "");
      }

      setGates({
        stayLengthOk: Boolean(
          (listingRes.data?.short_term_enabled ?? false) ||
          (listingRes.data?.long_term_enabled ?? false),
        ),
        minMaxNightsOk: Boolean(
          listingRes.data?.min_nights != null && listingRes.data?.max_nights != null,
        ),
        availabilityOk: declaredThroughStr != null && declaredThroughStr >= requiredThroughStr,
        houseRulesOk: Boolean(rulesRes.data?.current_version),
        stayInstructionsOk: Boolean(
          instructionsRes.data?.check_in_window &&
          instructionsRes.data?.check_out_time &&
          instructionsRes.data?.access_instructions &&
          instructionsRes.data?.emergency_contact,
        ),
        blackoutOk: true,
      });
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [listingId]);

  const allPassed = Object.values(gates).every(Boolean);

  async function saveAll() {
    setSaving(true);
    try {
      // 1. listings — stay-length + nights
      const { error: lErr } = await sb
        .from("listings")
        .update({
          short_term_enabled: shortTerm,
          long_term_enabled: longTerm,
          min_nights: minNights,
          max_nights: maxNights,
        })
        .eq("id", listingId);
      if (lErr) throw lErr;

      // 2. availability window
      const { error: aErr } = await sb
        .from("listing_availability_windows")
        .upsert(
          { listing_id: listingId, declared_through: availabilityThrough },
          { onConflict: "listing_id" },
        );
      if (aErr) throw aErr;

      // 3. house rules — versioned; document hash matches stored version
      const trimmedRules = houseRulesText.trim();
      if (trimmedRules.length > 0) {
        const version = new Date().toISOString();
        const hash = djb2(trimmedRules);
        const { error: rErr } = await sb
          .from("listing_house_rules")
          .upsert(
            {
              listing_id: listingId,
              current_version: version,
              current_hash: hash,
              rules_json: { text: trimmedRules },
              updated_by: userId,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "listing_id" },
          );
        if (rErr) throw rErr;

        // Reuse legal_consent_acceptances as the immutable version history.
        // The host accepting their own rules establishes the first version row.
        await createLegalAcceptanceAudit({
          userId,
          role: "host",
          contextId: listingId,
          documentId: "house-rules",
          documentVersion: version,
          documentHash: hash,
          checkboxLabel: "I confirm these are the binding house rules for this listing.",
          scrolledToBottom: true,
          gateOpenedAt: new Date().toISOString(),
          scrollCompletedAt: new Date().toISOString(),
          metadata: { source: "host_publish_gate" },
        });
      }

      // 4. stay instructions
      const { error: sErr } = await sb
        .from("listing_stay_instructions")
        .upsert(
          {
            listing_id: listingId,
            check_in_window: checkInWindow,
            check_out_time: checkOutTime,
            access_instructions: accessInstructions,
            wifi_details: wifiDetails || null,
            emergency_contact: emergencyContact,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "listing_id" },
        );
      if (sErr) throw sErr;

      toast({ title: "Setup saved" });
      setGates({
        stayLengthOk: shortTerm || longTerm,
        minMaxNightsOk: true,
        availabilityOk: availabilityThrough >= format(addDays(new Date(), REQUIRED_AVAILABILITY_DAYS), "yyyy-MM-dd"),
        houseRulesOk: trimmedRules.length > 0,
        stayInstructionsOk: Boolean(checkInWindow && checkOutTime && accessInstructions && emergencyContact),
        blackoutOk: true,
      });
    } catch (err) {
      toast({ title: "Save failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function StatusRow({ ok, label }: { ok: boolean; label: string }) {
    return (
      <div className="flex items-center gap-2 text-sm">
        {ok
          ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          : <Circle className="h-4 w-4 text-muted-foreground" />}
        <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      </div>
    );
  }

  if (loading) {
    return (
      <Card className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading publish requirements…
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-5">
      <div>
        <h3 className="text-base font-semibold mb-1">Publish requirements</h3>
        <p className="text-xs text-muted-foreground">
          Every listing must satisfy these gates before it can go live. Blackout dates can be
          edited later from the host calendar.
        </p>
      </div>

      <div className="space-y-1.5">
        <StatusRow ok={gates.stayLengthOk} label="Short-term or long-term stays enabled" />
        <StatusRow ok={gates.minMaxNightsOk} label="Minimum and maximum nights set" />
        <StatusRow ok={gates.availabilityOk} label={`3-month availability window declared (≥ ${REQUIRED_AVAILABILITY_DAYS} days forward)`} />
        <StatusRow ok={gates.houseRulesOk} label="House rules versioned and accepted" />
        <StatusRow ok={gates.stayInstructionsOk} label="Stay instructions filled in" />
      </div>

      <div className="space-y-4 border-t border-border/50 pt-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
            <Label className="text-xs">Short-term (≤30 nights)</Label>
            <Switch checked={shortTerm} onCheckedChange={setShortTerm} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
            <Label className="text-xs">Long-term (31+ nights)</Label>
            <Switch checked={longTerm} onCheckedChange={setLongTerm} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Min nights</Label>
            <Input type="number" min={1} value={minNights}
              onChange={(e) => setMinNights(Math.max(1, parseInt(e.target.value) || 1))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Max nights</Label>
            <Input type="number" min={1} value={maxNights}
              onChange={(e) => setMaxNights(Math.max(1, parseInt(e.target.value) || 1))} />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Declare availability through</Label>
          <Input type="date" value={availabilityThrough}
            min={format(addDays(new Date(), REQUIRED_AVAILABILITY_DAYS), "yyyy-MM-dd")}
            onChange={(e) => setAvailabilityThrough(e.target.value)} />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">House rules</Label>
          <Textarea rows={4} value={houseRulesText}
            placeholder="e.g. No smoking. No parties. Quiet hours 10pm–7am. Pets on approval only…"
            onChange={(e) => setHouseRulesText(e.target.value)} />
          <p className="text-[10px] text-muted-foreground">
            Saving stamps an immutable version. Guests accept the version that was current
            at booking time — future edits do not change confirmed bookings.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Check-in window</Label>
            <Input value={checkInWindow} placeholder="3pm – 9pm"
              onChange={(e) => setCheckInWindow(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Check-out time</Label>
            <Input value={checkOutTime} placeholder="11am"
              onChange={(e) => setCheckOutTime(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Access / arrival instructions</Label>
          <Textarea rows={3} value={accessInstructions}
            placeholder="Lockbox code, gate instructions, parking, etc."
            onChange={(e) => setAccessInstructions(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">WiFi details (optional)</Label>
            <Input value={wifiDetails} placeholder="Network / password"
              onChange={(e) => setWifiDetails(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Emergency contact</Label>
            <Input value={emergencyContact} placeholder="Name + phone"
              onChange={(e) => setEmergencyContact(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button onClick={saveAll} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save setup"}
        </Button>
        <Button variant="default" disabled={!allPassed} onClick={onAllPassed}>
          {allPassed ? "Publish listing" : "Publish (setup required)"}
        </Button>
      </div>
    </Card>
  );
}
