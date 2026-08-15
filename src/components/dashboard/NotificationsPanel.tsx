/**
 * NotificationsPanel — bell button with dropdown showing real notification data.
 * Drop-in replacement for the static bell in DashboardShell.
 */
import {
  notifications as notificationsApi, type ApiNotification,
} from "@/lib/api";
import { Bell, Check, Trash2, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

export function NotificationsPanel() {
  const [open, setOpen]         = useState(false);
  const [items, setItems]       = useState<ApiNotification[]>([]);
  const [unread, setUnread]     = useState(0);
  const [loading, setLoading]   = useState(false);
  const panelRef                = useRef<HTMLDivElement>(null);
  const navigate                = useNavigate();

  const load = useCallback(async () => {
    try {
      const { data, unread: u } = await notificationsApi.list(20);
      setItems(data);
      setUnread(u);
    } catch { /* ignore — user may be logged out */ }
  }, []);

  // Poll every 30 s for new notifications
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAllRead = async () => {
    await notificationsApi.markAllRead().catch(() => {});
    setItems(prev => prev.map(n => ({ ...n, is_read: 1 })));
    setUnread(0);
  };

  const handleClick = async (n: ApiNotification) => {
    if (!n.is_read) {
      await notificationsApi.markRead(n.id).catch(() => {});
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, is_read: 1 } : x));
      setUnread(prev => Math.max(0, prev - 1));
    }
    setOpen(false);
    if (n.link) navigate({ to: n.link as any }).catch(() => {});
  };

  const deleteItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await notificationsApi.delete(id).catch(() => {});
    setItems(prev => prev.filter(n => n.id !== id));
  };

  const typeIcon: Record<string, string> = {
    rent_reminder:        "⏰",
    rent_overdue:         "🚨",
    rent_received:        "✅",
    rent_paid:            "✅",
    visit_request:        "📅",
    visit_confirmed:      "🎉",
    visit_cancelled:      "❌",
    visit_rescheduled:    "🔄",
    complaint_new:        "⚠️",
    complaint_update:     "📋",
    review_new:           "⭐",
    property_status_change: "🏠",
    verification_pending: "🔍",
    verification_approved: "✅",
    verification_rejected: "❌",
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        aria-label="Notifications"
        className="relative h-9 w-9 rounded-full bg-secondary hover:bg-accent flex items-center justify-center transition-colors"
        onClick={() => { setOpen(o => !o); if (!open) load(); }}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4.5 w-4.5 min-w-[1.1rem] px-0.5 text-[10px] font-bold rounded-full bg-primary text-white flex items-center justify-center leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 bg-popover border border-border rounded-xl shadow-elegant overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold text-sm">Notifications</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Check className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">All caught up!</p>
              </div>
            ) : (
              items.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50 ${!n.is_read ? "bg-primary/5" : ""}`}
                >
                  <span className="text-lg mt-0.5 shrink-0">
                    {typeIcon[n.type] ?? "🔔"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.is_read ? "font-semibold" : "font-medium"} leading-tight`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {new Date(n.created_at).toLocaleString("en-IN", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <button
                    onClick={e => deleteItem(e, n.id)}
                    className="mt-0.5 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          {items.length > 0 && (
            <div className="px-4 py-2 border-t border-border text-center">
              <button
                onClick={() => { setOpen(false); navigate({ to: "/dashboard" as any }); }}
                className="text-xs text-primary hover:underline"
              >
                View all in dashboard →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
