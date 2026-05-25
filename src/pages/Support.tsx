import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { supportTicketSchema, supportMessageSchema, supportCategories } from "@/lib/schemas";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Seo } from "@/components/Seo";
import { Loader2, SendHorizonal } from "lucide-react";

type Ticket = {
  id: string;
  ticket_num: number;
  subject: string;
  status: string;
  priority: string;
  category: string;
  escalated: boolean;
  ai_response: string | null;
  created_at: string;
};
type Message = { id: string; sender: string; content: string; created_at: string };

const CATEGORY_LABELS: Record<string, string> = {
  booking: "Booking",
  payment_refund: "Payment / Refund",
  host_verification: "Host Verification",
  property_condition: "Property Condition",
  incidentals_damage: "Incidentals / Damage",
  safety_privacy_surveillance: "Safety / Privacy / Surveillance",
  account_access: "Account / Access",
  technical_bug: "Technical Bug",
};

function TypingIndicator() {
  return (
    <div className="rounded-md p-3 text-sm bg-muted/60 border-l-2 border-accent">
      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">AI Support</div>
      <div className="flex gap-1 items-center">
        <span className="inline-block h-2 w-2 rounded-full bg-accent/60 animate-bounce [animation-delay:0ms]" />
        <span className="inline-block h-2 w-2 rounded-full bg-accent/60 animate-bounce [animation-delay:150ms]" />
        <span className="inline-block h-2 w-2 rounded-full bg-accent/60 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

export default function Support() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [active, setActive] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<(typeof supportCategories)[number]>("booking");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [creating, setCreating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function loadTickets() {
    const { data } = await supabase
      .from("support_tickets")
      .select("id,ticket_num,subject,status,priority,category,escalated,ai_response,created_at")
      .order("created_at", { ascending: false });
    setTickets((data as Ticket[]) ?? []);
  }

  useEffect(() => { if (user) void loadTickets(); }, [user]);

  // Load messages + subscribe to realtime when active ticket changes
  useEffect(() => {
    if (!active) return;

    supabase
      .from("support_messages")
      .select("id,sender,content,created_at")
      .eq("ticket_id", active.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setMessages((data as Message[]) ?? []);
        setTimeout(scrollToBottom, 50);
      });

    const channel = supabase
      .channel(`support_messages:${active.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${active.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            // Deduplicate by id in case optimistic message was already added
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          if (newMsg.sender === "ai" || newMsg.sender === "admin") {
            setAiTyping(false);
          }
          setTimeout(scrollToBottom, 50);
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [active?.id]);

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    const parsed = supportTicketSchema.safeParse({ subject, message, category });
    if (!parsed.success) {
      toast({ title: "Add a subject and message", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("support-ticket", { body: parsed.data });
      if (error) throw error;
      toast({
        title: `Ticket #${data.ticket_num} created`,
        description: data.escalated ? "Escalated to our team — we'll follow up soon." : "AI has responded to your ticket.",
      });
      setSubject(""); setMessage(""); setCategory("booking");
      await loadTickets();
    } catch (err) {
      toast({ title: "Failed to create ticket", description: (err as Error).message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  async function sendReply() {
    if (!active || !reply.trim()) return;
    const parsed = supportMessageSchema.safeParse({ ticket_id: active.id, content: reply });
    if (!parsed.success) return;

    const optimisticMsg: Message = {
      id: `optimistic-${Date.now()}`,
      sender: "user",
      content: reply,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setReply("");
    setAiTyping(true);
    setTimeout(scrollToBottom, 50);

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("support-message", { body: parsed.data });
      if (error) throw error;
      // Realtime subscription will add the AI response automatically
    } catch (err) {
      toast({ title: "Failed to send", description: (err as Error).message, variant: "destructive" });
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setAiTyping(false);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey && !sending) {
      e.preventDefault();
      void sendReply();
    }
  }

  if (!user) {
    return (
      <div>
        <Seo title="CheapStays Support" description="Contact CheapStays support and concierge for bookings and account help." path="/support" />
        <div className="container py-20 max-w-md text-center">
          <h1 className="text-2xl font-semibold">Support</h1>
          <p className="text-muted-foreground mt-2">Sign in to open a ticket.</p>
          <Button asChild className="mt-6"><Link to="/auth">Sign in</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Seo title="CheapStays Support" description="Contact CheapStays support and concierge for bookings and account help." path="/support" />
      <div className="container py-12 grid gap-8 md:grid-cols-[360px_1fr]">

        {/* ── Left panel: new ticket form + ticket list ── */}
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
          <Card className="p-4">
            <form onSubmit={createTicket} className="space-y-3">
              <div className="space-y-1">
                <Label>Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief description of your issue" />
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as (typeof supportCategories)[number])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {supportCategories.map((c) => (
                      <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Message</Label>
                <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe the issue in detail…" />
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "New ticket"}
              </Button>
            </form>
          </Card>

          <div className="space-y-2">
            {tickets.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No tickets yet.</p>
            )}
            {tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => setActive(t)}
                className={`w-full text-left rounded-md border p-3 transition-colors ${
                  active?.id === t.id ? "border-accent bg-secondary/50" : "border-border hover:bg-muted/40"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    #{t.ticket_num} · {CATEGORY_LABELS[t.category] ?? t.category}
                  </span>
                  <Badge variant={t.escalated ? "destructive" : "secondary"} className="text-[10px]">
                    {t.status}
                  </Badge>
                </div>
                <p className="text-sm font-medium mt-1 line-clamp-1">{t.subject}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ── Right panel: message thread ── */}
        <div>
          {active ? (
            <Card className="p-6 flex flex-col" style={{ minHeight: "520px" }}>
              <div className="flex justify-between items-start gap-4 pb-4 border-b border-border/60">
                <div>
                  <h2 className="text-xl font-medium">{active.subject}</h2>
                  <p className="text-sm text-muted-foreground">
                    Ticket #{active.ticket_num} · {CATEGORY_LABELS[active.category] ?? active.category} · {active.status}
                  </p>
                </div>
                {active.escalated && <Badge variant="destructive">Escalated</Badge>}
              </div>

              <div className="flex-1 overflow-y-auto mt-4 space-y-3 pr-1" style={{ maxHeight: "380px" }}>
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-md p-3 text-sm ${
                      m.sender === "user"
                        ? "bg-secondary/60"
                        : m.sender === "ai"
                        ? "bg-muted/60 border-l-2 border-accent"
                        : "bg-card border"
                    }`}
                  >
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      {m.sender === "ai" ? "AI Support" : m.sender === "admin" ? "Team" : "You"}
                    </div>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>
                ))}
                {aiTyping && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>

              <div className="mt-4 flex gap-2 pt-4 border-t border-border/60">
                <Input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Write a reply… (Enter to send)"
                  disabled={sending}
                />
                <Button onClick={sendReply} disabled={sending || !reply.trim()} size="icon" aria-label="Send">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-10 text-center text-muted-foreground">
              Select a ticket or create a new one.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
