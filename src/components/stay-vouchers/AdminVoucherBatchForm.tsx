import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Listing = { id: string; title: string; host_id: string };
type Host = { user_id: string; display_name: string };

export function AdminVoucherBatchForm({ onSaved }: { onSaved: () => void }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [hostsById, setHostsById] = useState<Record<string, Host>>({});
  const [loading, setLoading] = useState(true);

  const [host_id, setHostId] = useState("");
  const [listing_id, setListingId] = useState("");
  const [batch_name, setName] = useState("");
  const [nights, setNights] = useState(1);
  const [price_php, setPrice] = useState(1999);
  const [quantity, setQuantity] = useState(50);
  const [valid_days, setValidDays] = useState(14);
  const [terms, setTerms] = useState("");
  const [busy, setBusy] = useState(false);

  const [hostPickerOpen, setHostPickerOpen] = useState(false);
  const [listingPickerOpen, setListingPickerOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: listingRows } = await supabase
        .from("listings")
        .select("id,title,host_id")
        .eq("status", "active")
        .order("title");
      const rows = (listingRows ?? []) as Listing[];
      setListings(rows);

      const hostIds = Array.from(new Set(rows.map((l) => l.host_id)));
      if (hostIds.length) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("user_id,display_name")
          .in("user_id", hostIds);
        const map: Record<string, Host> = {};
        (profileRows ?? []).forEach((p) => {
          map[p.user_id] = {
            user_id: p.user_id,
            display_name: p.display_name ?? "",
          };
        });
        // Fill in hosts without a profile row so they still appear.
        hostIds.forEach((id) => {
          if (!map[id]) map[id] = { user_id: id, display_name: "" };
        });
        setHostsById(map);
      }
      setLoading(false);
    })();
  }, []);

  const hosts = useMemo(() => {
    return Object.values(hostsById).sort((a, b) => {
      const an = a.display_name || `host ${a.user_id.slice(0, 8)}`;
      const bn = b.display_name || `host ${b.user_id.slice(0, 8)}`;
      return an.localeCompare(bn);
    });
  }, [hostsById]);

  const hostListings = useMemo(
    () => (host_id ? listings.filter((l) => l.host_id === host_id) : []),
    [listings, host_id],
  );

  const selectedHost = host_id ? hostsById[host_id] : undefined;
  const selectedListing = listings.find((l) => l.id === listing_id);

  const hostLabel = (h: Host) =>
    h.display_name?.trim()
      ? `${h.display_name} · ${h.user_id.slice(0, 8)}`
      : `Host ${h.user_id.slice(0, 8)}`;

  const canSubmit =
    host_id &&
    listing_id &&
    batch_name &&
    nights > 0 &&
    price_php > 0 &&
    quantity > 0 &&
    valid_days >= 1 &&
    valid_days <= 14 &&
    !busy;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.functions.invoke("admin-stay-voucher-batch-create", {
      body: {
        listing_id,
        batch_name,
        nights,
        price_php,
        quantity,
        valid_days,
        terms: terms || undefined,
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Voucher batch created.");
    onSaved();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <Label>Host</Label>
        <Popover open={hostPickerOpen} onOpenChange={setHostPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={hostPickerOpen}
              className="w-full justify-between font-normal"
              disabled={loading}
            >
              {loading
                ? "Loading hosts…"
                : selectedHost
                ? hostLabel(selectedHost)
                : "Select a host…"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search by host name or ID…" />
              <CommandList>
                <CommandEmpty>No hosts found.</CommandEmpty>
                <CommandGroup>
                  {hosts.map((h) => {
                    const label = hostLabel(h);
                    return (
                      <CommandItem
                        key={h.user_id}
                        value={`${label} ${h.user_id}`}
                        onSelect={() => {
                          setHostId(h.user_id);
                          setListingId("");
                          setHostPickerOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            host_id === h.user_id ? "opacity-100" : "opacity-0",
                          )}
                        />
                        {label}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <p className="mt-1 text-xs text-muted-foreground">
          {host_id
            ? `${hostListings.length} listing${hostListings.length === 1 ? "" : "s"} for this host`
            : "Choose a host first to narrow the listings dropdown."}
        </p>
      </div>

      <div>
        <Label>Listing</Label>
        <Popover open={listingPickerOpen} onOpenChange={setListingPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={listingPickerOpen}
              className="w-full justify-between font-normal"
              disabled={!host_id || hostListings.length === 0}
            >
              {selectedListing
                ? selectedListing.title
                : host_id
                ? hostListings.length === 0
                  ? "This host has no active listings"
                  : "Select a listing…"
                : "Select a host first"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search listings…" />
              <CommandList>
                <CommandEmpty>No listings found.</CommandEmpty>
                <CommandGroup>
                  {hostListings.map((l) => (
                    <CommandItem
                      key={l.id}
                      value={l.title}
                      onSelect={() => {
                        setListingId(l.id);
                        setListingPickerOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          listing_id === l.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {l.title}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <Label htmlFor="b-name">Batch name</Label>
        <Input id="b-name" required value={batch_name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="b-nights">Nights</Label>
          <Input
            id="b-nights"
            type="number"
            min={1}
            max={30}
            value={nights}
            onChange={(e) => setNights(Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="b-price">Price (₱)</Label>
          <Input
            id="b-price"
            type="number"
            min={1}
            value={price_php}
            onChange={(e) => setPrice(Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="b-qty">Quantity</Label>
          <Input
            id="b-qty"
            type="number"
            min={1}
            max={500}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="b-valid">Valid days (1–14)</Label>
          <Input
            id="b-valid"
            type="number"
            min={1}
            max={14}
            value={valid_days}
            onChange={(e) => setValidDays(Number(e.target.value))}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="b-terms">Terms / inclusions (optional)</Label>
        <Textarea
          id="b-terms"
          rows={3}
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          placeholder="Free breakfast, late check-out, etc."
        />
      </div>
      <Button type="submit" disabled={!canSubmit} className="w-full min-h-[44px]">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create batch"}
      </Button>
    </form>
  );
}
