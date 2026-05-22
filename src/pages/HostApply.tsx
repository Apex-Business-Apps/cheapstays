import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isHost } from "@/lib/rbac";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Seo } from "@/components/Seo";
import { toast } from "@/hooks/use-toast";
import { Loader2, Upload, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";

const STEPS = ["Your details", "Your property", "Verify identity", "Review & submit"];

const PROPERTY_TYPES = [
  "Entire house", "Condo / Apartment", "Private room",
  "Villa", "Beach house", "Glamping", "Other",
];

const ID_TYPES = [
  "Philippine passport", "Driver's license", "National ID (PhilSys)",
  "SSS / UMID", "Voter's ID", "Other government ID",
];

function FileDropzone({
  label, hint, accepted, onFile, file, uploading,
}: {
  label: string; hint: string; accepted: string; capture?: string;
  onFile: (f: File) => void; file: File | null; uploading: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <label className={`flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${file ? "border-primary/60 bg-primary/5" : "border-border hover:border-primary/40"}`}>
        <input
          type="file" accept={accepted} className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        />
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        ) : file ? (
          <>
            <CheckCircle2 className="h-6 w-6 text-primary" />
            <p className="text-sm font-medium text-primary">{file.name}</p>
          </>
        ) : (
          <>
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{hint}</p>
            <p className="text-xs text-muted-foreground">JPG, PNG, HEIC · max 10 MB</p>
          </>
        )}
      </label>
    </div>
  );
}

export default function HostApply() {
  const { user, roles, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [propertyType, setPropertyType] = useState(PROPERTY_TYPES[0]);
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [propertyDesc, setPropertyDesc] = useState("");
  const [idType, setIdType] = useState(ID_TYPES[0]);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [idUploading, setIdUploading] = useState(false);
  const [selfieUploading, setSelfieUploading] = useState(false);
  const [idPath, setIdPath] = useState("");
  const [selfiePath, setSelfiePath] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedKyc, setAgreedKyc] = useState(false);

  async function uploadDoc(file: File, prefix: string, setUploading: (v: boolean) => void): Promise<string> {
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

  async function handleIdFile(file: File) {
    try {
      const path = await uploadDoc(file, "id-front", setIdUploading);
      setIdFile(file);
      setIdPath(path);
      toast({ title: "ID photo uploaded" });
    } catch (err) {
      toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
    }
  }

  async function handleSelfieFile(file: File) {
    try {
      const path = await uploadDoc(file, "selfie", setSelfieUploading);
      setSelfieFile(file);
      setSelfiePath(path);
      toast({ title: "Selfie uploaded" });
    } catch (err) {
      toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
    }
  }

  async function handleSubmit() {
    if (!user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("host_applications").insert({
        user_id:              user.id,
        full_legal_name:      fullName.trim(),
        phone:                phone.trim(),
        property_type:        propertyType,
        city:                 city.trim(),
        province:             province.trim(),
        property_description: propertyDesc.trim(),
        id_type:              idType,
        id_front_path:        idPath || null,
        selfie_path:          selfiePath || null,
      });
      if (error) throw error;
      setSubmitted(true);
    } catch (err) {
      toast({ title: "Submission failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  function stepValid() {
    if (step === 0) return fullName.trim().length > 2 && phone.trim().length > 6;
    if (step === 1) return city.trim().length > 0 && province.trim().length > 0 && propertyDesc.trim().length > 20;
    if (step === 2) return idFile !== null && selfieFile !== null;
    if (step === 3) return agreedTerms && agreedKyc;
    return false;
  }

  if (authLoading) return (
    <div className="container py-24 flex justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (!user) return (
    <div className="container py-24 max-w-md text-center space-y-4">
      <Seo title="Apply as Host · CheapStays" description="Become a CheapStays host." path="/host/apply" />
      <h1 className="text-2xl font-semibold">Create an account first</h1>
      <p className="text-muted-foreground">You need a CheapStays account before applying to host.</p>
      <Button asChild><Link to="/auth?mode=signup&next=/host/apply">Sign up — it's free</Link></Button>
    </div>
  );

  if (isHost(roles)) return (
    <div className="container py-24 max-w-md text-center space-y-4">
      <Seo title="Host tools · CheapStays" description="You're already a host." path="/host/apply" />
      <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
      <h1 className="text-2xl font-semibold">You're already a host</h1>
      <p className="text-muted-foreground">Head to your Host tools to create and manage listings.</p>
      <Button asChild><Link to="/host">Go to Host tools</Link></Button>
    </div>
  );

  if (submitted) return (
    <div className="container py-24 max-w-md text-center space-y-4">
      <Seo title="Application submitted · CheapStays" description="Under review." path="/host/apply" />
      <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
      <h1 className="text-2xl font-semibold">Application submitted!</h1>
      <p className="text-muted-foreground">
        Our team will review your documents within <strong>24–48 hours</strong> and email{" "}
        <strong>{user.email}</strong> with the decision.
      </p>
      <p className="text-sm text-muted-foreground">
        Questions?{" "}
        <a href="mailto:cheapstays.me@gmail.com" className="underline underline-offset-4">
          cheapstays.me@gmail.com
        </a>
      </p>
      <Button variant="outline" asChild><Link to="/">Back to home</Link></Button>
    </div>
  );

  return (
    <div className="container py-12 max-w-xl">
      <Seo title="Apply as Host · CheapStays" description="Apply to list your property on CheapStays." path="/host/apply" />

      {/* Step progress */}
      <div className="mb-8 space-y-2">
        <div className="flex items-center">
          {STEPS.map((_, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                i < step ? "bg-primary text-primary-foreground" :
                i === step ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                "bg-secondary text-muted-foreground"
              }`}>
                {i < step ? "✓" : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 transition-colors ${i < step ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Step {step + 1} of {STEPS.length} — <span className="font-medium text-foreground">{STEPS[step]}</span></p>
      </div>

      <Card className="p-6">
        {/* ── Step 1: Contact details ── */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Your contact details</h2>
              <p className="text-sm text-muted-foreground mt-1">We need your legal name and phone number to verify your identity and reach you about your application.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full legal name *</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Juan dela Cruz" autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Contact number *</Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+63 917 123 4567" autoComplete="tel" />
              <p className="text-xs text-muted-foreground">Your account email <strong>{user.email}</strong> is already confirmed via your account.</p>
            </div>
          </div>
        )}

        {/* ── Step 2: Property ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">About your property</h2>
              <p className="text-sm text-muted-foreground mt-1">Tell us what you're listing and where it is.</p>
            </div>
            <div className="space-y-2">
              <Label>Property type *</Label>
              <div className="flex flex-wrap gap-2">
                {PROPERTY_TYPES.map((t) => (
                  <button key={t} type="button" onClick={() => setPropertyType(t)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${propertyType === t ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:border-foreground/30"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cebu City" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="province">Province / Region *</Label>
                <Input id="province" value={province} onChange={(e) => setProvince(e.target.value)} placeholder="Cebu" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Describe your property *</Label>
              <Textarea id="desc" rows={4} value={propertyDesc} onChange={(e) => setPropertyDesc(e.target.value)}
                placeholder="2-bedroom beach house we own outright. 20 meters from the shore, private parking, sleeps 4. We've hosted informally for 2 years…" />
              <p className="text-xs text-muted-foreground">Be specific: ownership, proximity to landmarks, capacity, and what makes it special.</p>
            </div>
          </div>
        )}

        {/* ── Step 3: Identity verification ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Verify your identity</h2>
              <p className="text-sm text-muted-foreground mt-1">Upload a government-issued ID and a selfie holding it. These are stored privately and only reviewed by CheapStays staff — never shared.</p>
            </div>
            <div className="space-y-2">
              <Label>ID type *</Label>
              <div className="flex flex-wrap gap-2">
                {ID_TYPES.map((t) => (
                  <button key={t} type="button" onClick={() => setIdType(t)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${idType === t ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:border-foreground/30"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <FileDropzone
              label="Front of your ID *"
              hint="Tap to upload or take a photo of your ID"
              accepted="image/*"
              onFile={handleIdFile}
              file={idFile}
              uploading={idUploading}
            />
            <FileDropzone
              label="Selfie holding your ID *"
              hint="Hold your ID next to your face — both must be clearly visible"
              accepted="image/*"
              onFile={handleSelfieFile}
              file={selfieFile}
              uploading={selfieUploading}
            />
          </div>
        )}

        {/* ── Step 4: Review & submit ── */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold">Review & submit</h2>
            <div className="rounded-xl bg-secondary/50 p-4 text-sm space-y-2">
              {[
                ["Name",     fullName],
                ["Phone",    phone],
                ["Property", `${propertyType} · ${city}, ${province}`],
                ["ID type",  idType],
                ["ID photo", idFile ? "✅ Uploaded" : "⚠️ Not uploaded"],
                ["Selfie",   selfieFile ? "✅ Uploaded" : "⚠️ Not uploaded"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span className="text-muted-foreground shrink-0">{k}</span>
                  <span className="text-right font-medium">{v}</span>
                </div>
              ))}
            </div>
            <div className="space-y-3 pt-1">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox id="terms" checked={agreedTerms} onCheckedChange={(v) => setAgreedTerms(!!v)} className="mt-0.5" />
                <span className="text-sm leading-relaxed">
                  I agree to the{" "}
                  <Link to="/host-terms" target="_blank" className="underline underline-offset-4">Host Terms</Link>
                  {" "}and{" "}
                  <Link to="/terms" target="_blank" className="underline underline-offset-4">Terms of Service</Link>.
                  {" "}I confirm I am the legal owner or authorised representative of this property.
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox id="kyc" checked={agreedKyc} onCheckedChange={(v) => setAgreedKyc(!!v)} className="mt-0.5" />
                <span className="text-sm leading-relaxed">
                  I consent to CheapStays verifying my identity documents for host onboarding. My documents are stored securely and will not be shared with third parties.
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center mt-8 pt-5 border-t border-border/60">
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!stepValid()}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting || !stepValid()}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit application
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
