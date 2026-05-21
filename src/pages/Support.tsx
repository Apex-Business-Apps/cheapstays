import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { supportTicketSchema, supportMessageSchema } from "@/lib/schemas";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

type Ticket = { id: string; ticket_num: number; subject: string; status: string; priority: string; escalated: boolean; ai_response: string | null; created_at: string };
type Message = { id: string; sender: string; content: string; created_at: string };

export default function Support() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [active, setActive] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");

  async function loadTickets() {
    const { data } = await supabase.from("support_tickets").select("*").order("created_at", { ascending: false });
    setTickets((data as Ticket[]) ?? []);
  }

  useEffect(() => { if (user) loadTickets(); }, [user]);

  useEffect(() => {
    if (!active) return;
    supabase.from("support_messages").select("*").eq("ticket_id", active.id).order("created_at", { ascending: true })
      .then(({ data }) => setMessages((data as Message[]) ?? []));
  }, [active]);

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    const parsed = supportTicketSchema.safeParse({ subject, message });
    if (!parsed.success) {
      toast({ title: "Add a subject and message", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase.functions.invoke("support-ticket", { body: parsed.data });
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Ticket #${data.ticket_num} created`, description: data.escalated ? "Escalated to a human." : "AI responded." });
    setSubject(""); setMessage("");
    loadTickets();
  }

  async function sendReply() {
    if (!active) return;
    const parsed = supportMessageSchema.safeParse({ ticket_id: active.id, content: reply });
    if (!parsed.success) return;
    const { error } = await supabase.functions.invoke("support-message", { body: parsed.data });
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    setReply("");
    const { data } = await supabase.from("support_messages").select("*").eq("ticket_id", active.id).order("created_at", { ascending: true });
    setMessages((data as Message[]) ?? []);
  }

  if (!user) {
    return (
      <div className="container py-20 max-w-md text-center">
        <h1 className="text-2xl font-semibold">Support</h1>
        <p className="text-muted-foreground mt-2">Sign in to open a ticket.</p>
        <Button asChild className="mt-6"><Link to="/auth">Sign in</Link></Button>
      </div>
    );
  }

  return (
    <div className="container py-12 grid gap-8 md:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
        <Card className="p-4">
          <form onSubmit={createTicket} className="space-y-3">
            <div className="space-y-1">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Message</Label>
              <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <Button type="submit" className="w-full">New ticket</Button>
          </form>
        </Card>
        <div className="space-y-2">
          {tickets.map((t) => (
            <button key={t.id} onClick={() => setActive(t)}
              className={`w-full text-left rounded-md border p-3 transition-colors ${
                active?.id === t.id ? "border-accent bg-secondary/50" : "border-border hover:bg-muted/40"
              }`}>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">#{t.ticket_num}</span>
                <Badge variant={t.escalated ? "destructive" : "secondary"}>{t.status}</Badge>
              </div>
              <p className="text-sm font-medium mt-1 line-clamp-1">{t.subject}</p>
            </button>
          ))}
        </div>
      </div>
      <div>
        {active ? (
          <Card className="p-6">
            <div className="flex justify-between items-start gap-4">
              <div>
                <h2 className="text-xl font-medium">{active.subject}</h2>
                <p className="text-sm text-muted-foreground">Ticket #{active.ticket_num} · {active.status}</p>
              </div>
              {active.escalated && <Badge variant="destructive">Escalated</Badge>}
            </div>
            <div className="mt-6 space-y-3">
              {messages.map((m) => (
                <div key={m.id} className={`rounded-md p-3 text-sm ${
                  m.sender === "user" ? "bg-secondary/60" : m.sender === "ai" ? "bg-muted/60 border-l-2 border-accent" : "bg-card border"
                }`}>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{m.sender}</div>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply…" />
              <Button onClick={sendReply}>Send</Button>
            </div>
          </Card>
        ) : (
          <Card className="p-10 text-center text-muted-foreground">Select a ticket or open a new one.</Card>
        )}
      </div>
    </div>
  );
}
