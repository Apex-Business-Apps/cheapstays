import { useEffect, useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, Send, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import i18n, { setLang } from "@/i18n";

type Msg = { role: "user" | "assistant"; content: string };

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const CHAT_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/ai-chat`;

type SpeechRecognitionResult = { 0: { transcript: string } };
type SpeechRecognitionEvent = Event & { results: ArrayLike<SpeechRecognitionResult> };
interface SR extends EventTarget {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: (e: SpeechRecognitionEvent) => void;
  onend: () => void; onerror: () => void;
  start(): void; stop(): void;
}
type SRConstructor = new () => SR;

// Voice-command routing: intercept navigation and language-switch intents before
// sending to the LLM so responses are instant and fully local.
const VOICE_ROUTES: {
  pattern: RegExp;
  action: (nav: ReturnType<typeof useNavigate>) => void;
  response: string;
}[] = [
  { pattern: /\b(go to |open |show |take me to )?(search|listings?|browse|find stays?)\b/i,
    action: (nav) => nav("/search"),      response: "Opening the search page for you." },
  { pattern: /\b(go to |open |show )?(membership|become a member|join|subscribe)\b/i,
    action: (nav) => nav("/membership"),  response: "Opening the membership page." },
  { pattern: /\b(go to |open |show )?(host|list my (place|property|home)|become a host)\b/i,
    action: (nav) => nav("/host"),        response: "Taking you to the host page." },
  { pattern: /\b(go to |open |show )?(support|help|contact|ticket)\b/i,
    action: (nav) => nav("/support"),     response: "Opening the support page." },
  { pattern: /\b(go |take me )?(home|homepage|main page)\b/i,
    action: (nav) => nav("/"),            response: "Going back to the home page." },
  { pattern: /\b(sign in|log in|login)\b/i,
    action: (nav) => nav("/auth"),        response: "Opening the sign-in page." },
  { pattern: /\b(switch (to )?|change (to )?language |speak |use )?(filipino|tagalog)\b/i,
    action: () => setLang("fil"),         response: "Switched to Filipino." },
  { pattern: /\b(switch (to )?|change (to )?language |speak |use )?english\b/i,
    action: () => setLang("en"),          response: "Switched to English." },
  { pattern: /\b(switch (to )?|change (to )?language |speak |use )?(chinese|mandarin)\b/i,
    action: () => setLang("zh"),          response: "Switched to Chinese." },
  { pattern: /\b(switch (to )?|change (to )?language |speak |use )?(malay|bahasa melayu)\b/i,
    action: () => setLang("ms"),          response: "Switched to Malay." },
  { pattern: /\b(switch (to )?|change (to )?language |speak |use )?(indonesian|bahasa indonesia)\b/i,
    action: () => setLang("id"),          response: "Switched to Indonesian." },
  { pattern: /\b(switch (to )?|change (to )?language |speak |use )?korean\b/i,
    action: () => setLang("ko"),          response: "Switched to Korean." },
  { pattern: /\b(switch (to )?|change (to )?language |speak |use )?(vietnamese|viet)\b/i,
    action: () => setLang("vi"),          response: "Switched to Vietnamese." },
  { pattern: /\b(switch (to )?|change (to )?language |speak |use )?japanese\b/i,
    action: () => setLang("ja"),          response: "Switched to Japanese." },
  { pattern: /\b(switch (to )?|change (to )?language |speak |use )?thai\b/i,
    action: () => setLang("th"),          response: "Switched to Thai." },
];

export function AiChatBubble() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: t("pip.greeting") },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [tts, setTts] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recogRef = useRef<SR | null>(null);

  // Re-sync greeting when language changes.
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].role === "assistant") {
        return [{ role: "assistant", content: t("pip.greeting") }];
      }
      return prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  function speak(text: string) {
    if (!tts || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();

    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.93;
    u.pitch = 1.15;
    u.volume = 1;

    // Pick the most natural-sounding voice available for the active language.
    // Priority: Google > Neural/Natural/Premium remote > any remote > default.
    const voices = synth.getVoices();
    const lang = (i18n.language ?? "en").slice(0, 2);
    const pick = (fn: (v: SpeechSynthesisVoice) => boolean) => voices.find(fn);
    const voice =
      pick(v => v.lang.startsWith(lang) && /google/i.test(v.name)) ??
      pick(v => v.lang.startsWith(lang) && /natural|neural|premium/i.test(v.name)) ??
      pick(v => v.lang.startsWith(lang) && !v.localService) ??
      pick(v => v.lang.startsWith("en") && /google uk english female/i.test(v.name)) ??
      pick(v => v.lang.startsWith("en") && /google/i.test(v.name)) ??
      pick(v => v.lang.startsWith("en") && !v.localService) ??
      null;

    if (voice) u.voice = voice;
    synth.speak(u);
  }

  function toggleListen() {
    const w = window as Window & { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    if (listening) {
      recogRef.current?.stop();
      setListening(false);
      return;
    }
    const r: SR = new Ctor();
    r.lang = "en-US";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e: SpeechRecognitionEvent) => {
      const text = Array.from(e.results).map((res) => res[0].transcript).join("");
      setInput(text);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recogRef.current = r;
    r.start();
    setListening(true);
  }

  const tryVoiceRoute = useCallback(
    (text: string): string | null => {
      for (const route of VOICE_ROUTES) {
        if (route.pattern.test(text)) {
          route.action(navigate);
          return route.response;
        }
      }
      return null;
    },
    [navigate],
  );

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");

    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setBusy(true);

    const localResponse = tryVoiceRoute(content);
    if (localResponse) {
      setMessages([...next, { role: "assistant", content: localResponse }]);
      speak(localResponse);
      setBusy(false);
      return;
    }

    try {
      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON,
          Authorization: `Bearer ${ANON}`,
        },
        body: JSON.stringify({ messages: next.slice(-20) }),
      });
      if (!res.ok || !res.body) throw new Error(`Chat error ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = m.slice();
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
      speak(acc);
    } catch {
      setMessages((m) => {
        const copy = m.slice();
        copy[copy.length - 1] = { role: "assistant", content: t("pip.error") };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  const quickPrompts = [t("pip.q1"), t("pip.q2"), t("pip.q3")];

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
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/60 bg-gradient-to-b from-secondary/60 to-transparent">
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
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setTts((v) => !v);
                    if (tts) window.speechSynthesis?.cancel();
                  }}
                  aria-label={tts ? t("pip.mute") : t("pip.unmute")}
                >
                  {tts ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label={t("pip.close")}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-secondary text-secondary-foreground rounded-bl-sm",
                    )}
                  >
                    {m.content || (m.role === "assistant" && busy ? "…" : null)}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Input */}
            <div className="border-t border-border/60 p-3">
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
                  type="button"
                  size="icon"
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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
