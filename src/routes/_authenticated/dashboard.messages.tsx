import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { messages as messagesApi, type ApiMessage } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { Send, Search, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/messages")({
  head: () => ({ meta: [{ title: "Messages — Nivaas" }] }),
  component: Messages,
});

function Messages() {
  const { profile }                 = useAuth();
  const [threads, setThreads]       = useState<ApiMessage[]>([]);
  const [convo, setConvo]           = useState<ApiMessage[]>([]);
  const [activeThread, setActive]   = useState<ApiMessage | null>(null);
  const [text, setText]             = useState("");
  const [sending, setSending]       = useState(false);
  const [loading, setLoading]       = useState(true);
  const bottomRef                   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesApi.threads()
      .then(t => { setThreads(t); if (t.length > 0) openThread(t[0]); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [convo]);

  const openThread = async (thread: ApiMessage) => {
    setActive(thread);
    try {
      const msgs = await messagesApi.conversation(
        thread.other_user_id!,
        thread.property_id ?? undefined,
      );
      setConvo(msgs);
    } catch { setConvo([]); }
  };

  const sendMessage = async () => {
    if (!text.trim() || !activeThread) return;
    setSending(true);
    try {
      const msg = await messagesApi.send({
        receiver_id: activeThread.other_user_id!,
        content: text.trim(),
        property_id: activeThread.property_id ?? undefined,
      });
      setConvo(prev => [...prev, msg]);
      setText("");
    } catch { toast.error("Failed to send message"); }
    finally { setSending(false); }
  };

  return (
    <DashboardShell title="Messages" subtitle="Chat with tenants, owners and agents">
      <Card className="border-border/60 overflow-hidden grid md:grid-cols-[320px_1fr] h-[70vh]">

        {/* Threads panel */}
        <div className="border-r border-border/60 flex flex-col">
          <div className="p-4 border-b border-border/60">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search conversations…" className="pl-9" />
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : threads.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No conversations yet.</p>
            ) : (
              threads.map(t => (
                <div key={`${t.other_user_id}-${t.property_id}`}
                  onClick={() => openThread(t)}
                  className={`flex items-center gap-3 p-4 border-b border-border/60 cursor-pointer hover:bg-secondary/40 ${activeThread?.other_user_id === t.other_user_id ? "bg-secondary/60" : ""}`}>
                  <div className="h-10 w-10 rounded-full bg-gradient-primary text-white flex items-center justify-center font-semibold shrink-0">
                    {(t.other_user_name || "U").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium truncate">{t.other_user_name || "User"}</p>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{t.content}</p>
                  </div>
                  {!t.is_read && t.receiver_id === profile?.id && (
                    <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat panel */}
        {!activeThread ? (
          <div className="flex items-center justify-center text-sm text-muted-foreground">
            Select a conversation
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="h-16 border-b border-border/60 flex items-center gap-3 px-5">
              <div className="h-9 w-9 rounded-full bg-gradient-primary text-white flex items-center justify-center font-semibold">
                {(activeThread.other_user_name || "U")[0].toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-sm">{activeThread.other_user_name || "User"}</p>
                {activeThread.property_title && (
                  <p className="text-xs text-muted-foreground">{activeThread.property_title}</p>
                )}
              </div>
            </div>

            <div className="flex-1 p-6 space-y-3 overflow-auto">
              {convo.map(msg => (
                <Bubble key={msg.id} mine={msg.sender_id === profile?.id} text={msg.content} />
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="p-4 border-t border-border/60 flex gap-2">
              <Input
                placeholder="Type a message…"
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              />
              <Button variant="hero" onClick={sendMessage} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </DashboardShell>
  );
}

function Bubble({ mine, text }: { mine: boolean; text: string }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${mine ? "bg-gradient-primary text-white" : "bg-secondary text-secondary-foreground"}`}>
        {text}
      </div>
    </div>
  );
}
