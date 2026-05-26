import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CreditCard, Mic, MicOff, Send, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { setLang } from "@/i18n";
import { LANG_BCP47, LANG_TTS_PREFIXES } from "@/i18n/bcp47";
import { useAuth } from "@/hooks/useAuth";
import { PipListingCard } from "@/components/PipListingCard";
import { PipBookingPanel } from "@/components/PipBookingPanel";
import type { PipMsg, BookFlow, SearchListing, TextMsg } from "@/types/pip";

// ─── Edge function endpoints ──────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON        = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const CHAT_URL     = `${SUPABASE_URL}/functions/v1/ai-chat`;
const SEARCH_URL   = `${SUPABASE_URL}/functions/v1/ai-search`;
const BOOK_URL     = `${SUPABASE_URL}/functions/v1/book-listing`;
const CHECKOUT_URL = `${SUPABASE_URL}/functions/v1/booking-checkout`;

// ─── Search intent detection ──────────────────────────────────────────────────
// Fires when the user's message looks like an accommodation search request.
// Deliberately excludes bare "any" and booking-management terms so conversational
// messages ("what's my booking status?") still route to ai-chat.
const SEARCH_INTENT_RE =
  /\b(find|search|show me|look(ing)?( for)?|i (need|want)|recommend|suggest|cheap(est)?|affordable|best deal|listing|room|villa|condo|cabin|resort|hotel|accommodation|night(s)?|stay(s)?)\b|₱\d/i;

// ─── Member-gated free search limit ──────────────────────────────────────────
const SEARCH_LIMIT_KEY  = "pip-searches";
const FREE_DAILY_LIMIT  = 5;

function getTodaySearchCount(): number {
  try {
    const raw = localStorage.getItem(SEARCH_LIMIT_KEY);
    if (!raw) return 0;
    const { date, count } = JSON.parse(raw) as { date: string; count: number };
    return date === new Date().toISOString().slice(0, 10) ? (count ?? 0) : 0;
  } catch { return 0; }
}

function bumpSearchCount() {
  const today = new Date().toISOString().slice(0, 10);
  let count = 0;
  try {
    const parsed = JSON.parse(localStorage.getItem(SEARCH_LIMIT_KEY) ?? "{}") as { date?: string; count?: number };
    if (parsed.date === today) count = parsed.count ?? 0;
  } catch { /* ignore malformed localStorage */ }
  localStorage.setItem(SEARCH_LIMIT_KEY, JSON.stringify({ date: today, count: count + 1 }));
}

// ─── Speech recognition types ─────────────────────────────────────────────────
type SpeechRecognitionResult  = { 0: { transcript: string } };
type SpeechRecognitionEvent   = Event & { results: ArrayLike<SpeechRecognitionResult> };
type SpeechRecognitionErrorEvent = Event & { error: string };
interface SR extends EventTarget {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: (e: SpeechRecognitionEvent) => void;
  onend: () => void;
  onerror: (e: SpeechRecognitionErrorEvent) => void;
  start(): void; stop(): void;
}
type SRConstructor = new () => SR;

// ─── Language-switch routes (module-level — no dependency on t()) ─────────────
const LANG_SWITCH_ROUTES: { pattern: RegExp; code: string }[] = [
  { pattern: /\b(switch (to )?|change (to )?language |speak |use )?(filipino|tagalog)\b/i, code: "fil" },
  { pattern: /\b(switch (to )?|change (to )?language |speak |use )?english\b/i,           code: "en"  },
  { pattern: /\b(switch (to )?|change (to )?language |speak |use )?(chinese|mandarin)\b/i, code: "zh" },
  { pattern: /\b(switch (to )?|change (to )?language |speak |use )?(malay|bahasa melayu)\b/i, code: "ms" },
  { pattern: /\b(switch (to )?|change (to )?language |speak |use )?(indonesian|bahasa indonesia)\b/i, code: "id" },
  { pattern: /\b(switch (to )?|change (to )?language |speak |use )?korean\b/i,            code: "ko"  },
  { pattern: /\b(switch (to )?|change (to )?language |speak |use )?(vietnamese|viet)\b/i, code: "vi"  },
  { pattern: /\b(switch (to )?|change (to )?language |speak |use )?japanese\b/i,          code: "ja"  },
  { pattern: /\b(switch (to )?|change (to )?language |speak |use )?thai\b/i,              code: "th"  },
];

// ─── Payment method labels ────────────────────────────────────────────────────
const PAY_LABELS: Record<"gcash" | "maya" | "card", string> = {
  gcash: "GCash",
  maya:  "Maya",
  card:  "Card",
};

// ─── Component ────────────────────────────────────────────────────────────────
export function AiChatBubble() {
  const { t, i18n } = useTranslation();
  const navigate    = useNavigate();
  useLocation(); // consumed for future route-aware responses (Day 4)
  const { session, roles } = useAuth();
  const userIsMember = roles.includes("member") || roles.includes("admin");

  const [open,           setOpen]           = useState(false);
  const [messages,       setMessages]       = useState<PipMsg[]>([
    { kind: "text", role: "assistant", content: t("pip.greeting") },
  ]);
  const [input,          setInput]          = useState("");
  const [busy,           setBusy]           = useState(false);
  const [listening,      setListening]      = useState(false);
  const [tts,            setTts]            = useState(true);
  const [flow,           setFlow]           = useState<BookFlow>({ step: "idle" });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [payLoading,     setPayLoading]     = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const recogRef  = useRef<SR | null>(null);

  // Navigation voice routes — built inside the component so response() calls t()
  // at the moment the route fires, evaluating the current language immediately.
  const NAV_VOICE_ROUTES = useMemo(() => [
    { pattern: /\b(go to |open |show |take me to )the search( page)?\b/i,
      action: () => navigate("/search"),     response: () => t("pip.voice.search") },
    { pattern: /\b(go to |open |show )?(membership|become a member|join|subscribe)\b/i,
      action: () => navigate("/membership"), response: () => t("pip.voice.membership") },
    { pattern: /\b(go to |open |show )?(host|list my (place|property|home)|become a host)\b/i,
      action: () => navigate("/host"),       response: () => t("pip.voice.host") },
    { pattern: /\b(go to |open |show )?(support|help|contact|ticket)\b/i,
      action: () => navigate("/support"),    response: () => t("pip.voice.support") },
    { pattern: /\b(go |take me )?(home|homepage|main page)\b/i,
      action: () => navigate("/"),           response: () => t("pip.voice.home") },
    { pattern: /\b(sign in|log in|login)\b/i,
      action: () => navigate("/auth"),       response: () => t("pip.voice.auth") },
    { pattern: /\b(my bookings?|view bookings?|manage bookings?|booking (tab|dashboard|list))\b/i,
      action: () => navigate("/host"),       response: () => t("pip.voice.bookings") },
    { pattern: /\b(confirm (a )?booking|decline (a )?booking|approve booking|reject booking)\b/i,
      action: () => navigate("/host"),       response: () => t("pip.voice.confirmBooking") },
    { pattern: /\b(rate (a )?guest|review (a )?guest|guest review)\b/i,
      action: () => navigate("/host"),       response: () => t("pip.voice.rateGuest") },
    { pattern: /\b(filter (listings?|results?|search)|sort (by|listings?|results?)|cheapest (listings?|places?|stays?)|highest rated|best rated|search filters?)\b/i,
      action: () => navigate("/search"),     response: () => t("pip.voice.filters") },
    { pattern: /\b(instant book|book instantly)\b/i,
      action: () => navigate("/search"),     response: () => t("pip.voice.instantBook") },
    { pattern: /\b(check (my |the )?(ratings?|reviews?|stars?)|how.*(rated|rating|stars?))\b/i,
      action: () => navigate("/search"),     response: () => t("pip.voice.ratings") },
  ], [navigate, t]);

  // Sync greeting text when language changes (only replaces the initial single greeting).
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].kind === "text" && prev[0].role === "assistant") {
        return [{ kind: "text", role: "assistant", content: t("pip.greeting") }];
      }
      return prev;
    });
  }, [t]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, flow]);

  // ── TTS ─────────────────────────────────────────────────────────────────────
  function speak(text: string) {
    if (!tts || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const attemptSpeak = (voices: SpeechSynthesisVoice[]) => {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.93; u.pitch = 1.15; u.volume = 1;
      const prefixes = LANG_TTS_PREFIXES[i18n.language] ?? ["en"];
      const matchesLang = (v: SpeechSynthesisVoice) =>
        prefixes.some((p) => v.lang.toLowerCase().startsWith(p));
      const pick = (fn: (v: SpeechSynthesisVoice) => boolean) => voices.find(fn);
      const voice =
        pick((v) => matchesLang(v) && /google/i.test(v.name))                            ??
        pick((v) => matchesLang(v) && /natural|neural|premium/i.test(v.name))             ??
        pick((v) => matchesLang(v) && !v.localService)                                    ??
        pick((v) => matchesLang(v))                                                       ??
        pick((v) => v.lang.startsWith("en") && /google uk english female/i.test(v.name)) ??
        pick((v) => v.lang.startsWith("en") && /google/i.test(v.name))                   ??
        pick((v) => v.lang.startsWith("en") && !v.localService)                          ??
        null;
      if (voice) u.voice = voice;
      synth.speak(u);
    };
    const voices = synth.getVoices();
    if (voices.length > 0) { attemptSpeak(voices); }
    else { synth.onvoiceschanged = () => { synth.onvoiceschanged = null; attemptSpeak(synth.getVoices()); }; }
  }

  // ── STT ─────────────────────────────────────────────────────────────────────
  function startRecognition(langCode: string, isRetry = false) {
    const w = window as Window & { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r: SR = new Ctor();
    r.lang = langCode; r.interimResults = true; r.continuous = false;
    r.onresult = (e: SpeechRecognitionEvent) => {
      const text = Array.from(e.results).map((res) => res[0].transcript).join("");
      setInput(text);
    };
    r.onend = () => setListening(false);
    r.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "language-not-supported" && !isRetry) {
        recogRef.current = null;
        startRecognition("en-US", true);
        return;
      }
      setListening(false);
    };
    recogRef.current = r;
    r.start();
    setListening(true);
  }

  function toggleListen() {
    if (listening) { recogRef.current?.stop(); setListening(false); return; }
    startRecognition(LANG_BCP47[i18n.language] ?? "en-US");
  }

  // ── Language switch ──────────────────────────────────────────────────────────
  const handleLangSwitch = useCallback((code: string) => {
    setLang(code);
    const langName = t("lang." + code);
    return t("pip.voice.langSwitch", { language: langName });
  }, [t]);

  const tryVoiceRoute = useCallback((text: string): string | null => {
    for (const route of NAV_VOICE_ROUTES) {
      if (route.pattern.test(text)) { route.action(); return route.response(); }
    }
    for (const route of LANG_SWITCH_ROUTES) {
      if (route.pattern.test(text)) return handleLangSwitch(route.code);
    }
    return null;
  }, [NAV_VOICE_ROUTES, handleLangSwitch]);

  // ── Main send handler ────────────────────────────────────────────────────────
  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    setBusy(true);

    // Build chat history snapshot BEFORE the state update (React state is async).
    const chatHistory = [
      ...messages.filter((m): m is TextMsg => m.kind === "text").slice(-19),
      { role: "user" as const, content },
    ];

    setMessages((prev) => [...prev, { kind: "text", role: "user", content }]);

    // 1 — Local voice / navigation routes
    const localResponse = tryVoiceRoute(content);
    if (localResponse) {
      setMessages((prev) => [...prev, { kind: "text", role: "assistant", content: localResponse }]);
      speak(localResponse);
      setBusy(false);
      return;
    }

    // 1b — "Search for X" explicit navigation: pre-seeds /search?q=X and navigates.
    // Only fires on the explicit "search for …" or "look up …" prefix so that
    // natural queries like "find a villa in Palawan" still show listing cards.
    const searchForMatch = /^(?:search for|look up)\s+(.+)/i.exec(content);
    if (searchForMatch) {
      const query = encodeURIComponent(searchForMatch[1].trim());
      navigate(`/search?q=${query}`);
      const resp = t("pip.voice.search");
      setMessages((prev) => [...prev, { kind: "text", role: "assistant", content: resp }]);
      speak(resp);
      setBusy(false);
      return;
    }

    // 2 — AI Search intent: show rich listing cards
    if (SEARCH_INTENT_RE.test(content)) {
      if (!userIsMember && getTodaySearchCount() >= FREE_DAILY_LIMIT) {
        const msg = t("pip.memberOnly");
        setMessages((prev) => [...prev, { kind: "text", role: "assistant", content: msg }]);
        speak(msg);
        setBusy(false);
        return;
      }

      try {
        bumpSearchCount();
        const res = await fetch(SEARCH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
          body: JSON.stringify({ query: content, lang: i18n.language }),
        });

        if (res.ok) {
          const data = await res.json() as { summary: string; results: SearchListing[] };
          if (data.results && data.results.length > 0) {
            setMessages((prev) => [
              ...prev,
              { kind: "results", summary: data.summary, listings: data.results },
            ]);
            speak(data.summary);
            setBusy(false);
            return;
          }
          // Zero results — show summary/fallback text and stop
          const msg = data.summary || t("pip.noResults");
          setMessages((prev) => [...prev, { kind: "text", role: "assistant", content: msg }]);
          speak(msg);
          setBusy(false);
          return;
        }
        throw new Error("Edge function search response not OK");
      } catch (err) {
        console.warn("Supabase Edge Function search failed, using local database search fallback:", err);
        const { localSearchFallback } = await import("@/lib/search-fallback");
        const fallbackData = await localSearchFallback(content);
        if (fallbackData.results && fallbackData.results.length > 0) {
          setMessages((prev) => [
            ...prev,
            { kind: "results", summary: fallbackData.summary, listings: fallbackData.results as unknown as SearchListing[] },
          ]);
          speak(fallbackData.summary);
          setBusy(false);
          return;
        }
        // If local fallback also has zero results, show a friendly fallback message
        const msg = fallbackData.summary || t("pip.noResults");
        setMessages((prev) => [...prev, { kind: "text", role: "assistant", content: msg }]);
        speak(msg);
        setBusy(false);
        return;
      }
    }

    // 3 — Conversational ai-chat (streaming)
    setMessages((prev) => [...prev, { kind: "text", role: "assistant", content: "" }]);
    try {
      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON,
          Authorization: `Bearer ${session?.access_token ?? ANON}`,
        },
        body: JSON.stringify({ messages: chatHistory.slice(-20), lang: i18n.language }),
      });
      if (!res.ok || !res.body) throw new Error(`Chat error ${res.status}`);
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { kind: "text", role: "assistant", content: acc };
          return copy;
        });
      }
      speak(acc);
    } catch (err) {
      console.warn("Supabase Edge Function chat failed, using local conversational fallback:", err);
      const fallbackReplies = [
        "I'm experiencing a temporary network hiccup reaching my main concierge engine, but I can still help you navigate! You can find fantastic deals on /search, view our paid plans at /membership, or manage properties at /host.",
        "Apologies for the brief connection interruption! While my full chat agent is reconnecting, you can explore active stays under /search or view our support helpdesk at /support.",
        "It looks like our concierge server is super busy right now. Rest assured you can still search all active listings at /search or sign in at /auth to manage your bookings."
      ];
      const selectedReply = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { kind: "text", role: "assistant", content: selectedReply };
        return copy;
      });
      speak(selectedReply);
    } finally {
      setBusy(false);
    }
  }

  // ── Booking confirmation ──────────────────────────────────────────────────────
  async function handleBookConfirm(params: {
    listing_id: string; check_in: string; check_out: string; guests: number;
  }) {
    if (flow.step !== "form") return;
    const listing = flow.listing;

    // Auth gate — user must be logged in
    if (!session) {
      const msg = t("pip.authRequired");
      setMessages((prev) => [...prev, { kind: "text", role: "assistant", content: msg }]);
      speak(msg);
      setFlow({ step: "idle" });
      setTimeout(() => navigate("/auth"), 1400);
      return;
    }

    setBookingLoading(true);
    try {
      const res = await fetch(BOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(params),
      });

      const data = await res.json() as {
        booking_id?: string; nights?: number; total_php?: number; status?: string;
        booking_flow?: string; flow_state?: string; error?: string;
      };

      if (!res.ok || !data.booking_id) {
        const errMsg = data.error?.includes("not available")
          ? t("pip.notAvailable")
          : data.error ?? t("pip.error");
        setMessages((prev) => [...prev, { kind: "text", role: "assistant", content: errMsg }]);
        speak(errMsg);
        setFlow({ step: "idle" });
        return;
      }

      // Route by booking_flow: instant_book → payment; request_booking → done.
      const isInstantBook = data.booking_flow === "instant_book";
      const confirmedStatus = isInstantBook ? "confirmed" : "pending";
      setMessages((prev) => [
        ...prev,
        {
          kind: "booking",
          booking_id:    data.booking_id!,
          listing_title: listing.title,
          check_in:      params.check_in,
          check_out:     params.check_out,
          nights:        data.nights ?? 1,
          total_php:     data.total_php ?? 0,
          status:        confirmedStatus,
        },
      ]);

      const successMsg = isInstantBook ? t("pip.bookingCreated") : t("pip.bookingPending");
      speak(successMsg);
      if (isInstantBook) {
        setFlow({ step: "paying", booking_id: data.booking_id!, total_php: data.total_php ?? 0, listing_title: listing.title });
      } else {
        setFlow({ step: "idle" });
      }
    } catch {
      setMessages((prev) => [...prev, { kind: "text", role: "assistant", content: t("pip.error") }]);
      setFlow({ step: "idle" });
    } finally {
      setBookingLoading(false);
    }
  }

  // ── Payment ───────────────────────────────────────────────────────────────────
  async function handlePay(method: "gcash" | "maya" | "card") {
    if (flow.step !== "paying" || !session) return;
    setPayLoading(true);
    try {
      const res = await fetch(CHECKOUT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ booking_id: flow.booking_id, payment_method: method }),
      });
      const data = await res.json() as { checkout_url?: string | null; error?: string };

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return; // navigates away — no further state update needed
      }
      // PayMongo not configured: booking still persists, tell the user
      const msg = t("pip.bookingSuccess");
      setMessages((prev) => [...prev, { kind: "text", role: "assistant", content: msg }]);
      speak(msg);
      setFlow({ step: "idle" });
    } catch {
      setMessages((prev) => [...prev, { kind: "text", role: "assistant", content: t("pip.error") }]);
      setFlow({ step: "idle" });
    } finally {
      setPayLoading(false);
    }
  }

  const quickPrompts = [t("pip.q1"), t("pip.q2"), t("pip.q3")];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Floating bubble */}
      <div className="fixed bottom-5 right-5 z-50">
        <AnimatePresence>
          {!open && (
            <motion.button
              key="bubble"
              onClick={() => setOpen(true)}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
              className="relative grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_18px_40px_-12px_hsl(150_60%_15%/0.55)] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
              aria-label={t("pip.open")}
            >
              <span className="absolute inset-0 rounded-full bg-primary/40 animate-pulse-ring" />
              <span className="absolute inset-0 rounded-full bg-primary animate-breathe" />
              <Sparkles className="relative h-5 w-5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-5 right-5 z-50 w-[min(92vw,380px)] h-[min(70vh,560px)] flex flex-col rounded-3xl border border-border/70 bg-card/95 backdrop-blur-xl shadow-[0_30px_80px_-20px_hsl(150_40%_10%/0.45)] overflow-hidden"
            role="dialog"
            aria-label={t("pip.open")}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/60 bg-gradient-to-b from-secondary/60 to-transparent shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="relative grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-medium">Pip</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("pip.role", { defaultValue: "Concierge" })} · {busy ? t("pip.thinking") : t("pip.online")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost" size="icon"
                  onClick={() => { setTts((v) => !v); if (tts) window.speechSynthesis?.cancel(); }}
                  aria-label={tts ? t("pip.mute") : t("pip.unmute")}
                >
                  {tts ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label={t("pip.close")}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Body — swaps between chat view and booking form */}
            <AnimatePresence mode="wait">
              {flow.step === "form" ? (

                /* ── Booking form overlay ── */
                <motion.div
                  key="booking-form"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.22 }}
                  className="flex flex-col flex-1 min-h-0"
                >
                  <PipBookingPanel
                    listing={flow.listing}
                    onCancel={() => setFlow({ step: "idle" })}
                    onConfirm={handleBookConfirm}
                    loading={bookingLoading}
                  />
                </motion.div>

              ) : (

                /* ── Chat view ── */
                <motion.div
                  key="chat"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex flex-col flex-1 min-h-0"
                >
                  {/* Messages scroll area */}
                  <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                    {messages.map((m, i) => {
                      // ── Text bubble ──
                      if (m.kind === "text") {
                        const isMemberOnly = m.role === "assistant" && m.content === t("pip.memberOnly");
                        return (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                            className={cn("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}
                          >
                            <div className={cn(
                              "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                              m.role === "user"
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-secondary text-secondary-foreground rounded-bl-sm",
                            )}>
                              {m.content || (m.role === "assistant" && busy ? "…" : null)}
                            </div>
                            {isMemberOnly && (
                              <Button
                                size="sm"
                                className="ml-1 text-xs"
                                onClick={() => {
                                  setOpen(false);
                                  navigate("/membership");
                                }}
                              >
                                {t("hero.ctaMembership")}
                              </Button>
                            )}
                          </motion.div>
                        );
                      }

                      // ── Listing cards ──
                      if (m.kind === "results") {
                        return (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.32 }}
                            className="space-y-2"
                          >
                            {m.summary && (
                              <div className="flex justify-start">
                                <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm leading-relaxed bg-secondary text-secondary-foreground">
                                  {m.summary}
                                </div>
                              </div>
                            )}
                            {m.listings.map((listing) => (
                              <PipListingCard
                                key={listing.id}
                                listing={listing}
                                onBook={(l) => setFlow({ step: "form", listing: l })}
                              />
                            ))}
                          </motion.div>
                        );
                      }

                      // ── Booking confirmation card ──
                      if (m.kind === "booking") {
                        return (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.28 }}
                            className="flex justify-start"
                          >
                            <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-primary/20 bg-primary/5 px-3.5 py-3 space-y-1">
                              <p className="text-xs font-semibold text-primary">
                                {m.status === "confirmed" ? t("pip.bookingCreated") : t("pip.bookingPending")}
                              </p>
                              <p className="text-sm font-medium leading-tight line-clamp-2">{m.listing_title}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {m.check_in} → {m.check_out} · {t("pip.nights", { count: m.nights })}
                              </p>
                              <p className="text-sm font-bold text-primary">₱{m.total_php.toLocaleString()}</p>
                            </div>
                          </motion.div>
                        );
                      }

                      return null;
                    })}
                  </div>

                  {/* Payment method bar — shown when booking confirmed, awaiting payment */}
                  {flow.step === "paying" && (
                    <div className="px-4 pb-3 pt-2 border-t border-border/60 space-y-2 shrink-0">
                      <p className="text-xs font-medium text-muted-foreground">{t("pip.paymentTitle")}</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(["gcash", "maya", "card"] as const).map((method) => (
                          <button
                            key={method}
                            onClick={() => handlePay(method)}
                            disabled={payLoading}
                            className={cn(
                              "flex items-center justify-center gap-1 rounded-lg border border-border/70",
                              "bg-background/60 px-2 py-2 text-[11px] font-medium",
                              "hover:bg-secondary hover:border-primary/30 transition-colors",
                              "disabled:opacity-50 disabled:cursor-not-allowed",
                            )}
                          >
                            {method === "card" && <CreditCard className="h-3 w-3 shrink-0" />}
                            {t("pip.payWith", { method: PAY_LABELS[method] })}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Input bar — hidden while payment step is active */}
                  {flow.step === "idle" && (
                    <div className="border-t border-border/60 p-3 shrink-0">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {quickPrompts.map((q) => (
                          <button
                            key={q}
                            onClick={() => send(q)}
                            disabled={busy}
                            className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                      <form
                        onSubmit={(e) => { e.preventDefault(); send(); }}
                        className="flex items-center gap-1.5"
                      >
                        <Button
                          type="button" size="icon"
                          variant={listening ? "default" : "ghost"}
                          onClick={toggleListen}
                          aria-label={listening ? t("pip.stopListen") : t("pip.listen")}
                          className={cn(listening && "animate-breathe")}
                        >
                          {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                        </Button>
                        <Input
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          placeholder={t("pip.placeholder")}
                          className="flex-1 h-9"
                          disabled={busy}
                        />
                        <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send">
                          <Send className="h-4 w-4" />
                        </Button>
                      </form>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
