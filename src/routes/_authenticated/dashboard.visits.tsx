import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { visits as visitsApi, type ApiVisit, type VisitStatus } from "@/lib/api";
import {
  Calendar, CheckCircle2, Clock, XCircle, Video, MapPin, Loader2,
  RotateCcw, Phone,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchProfile } from "@/lib/auth-cache";

export const Route = createFileRoute("/_authenticated/dashboard/visits")({
  head: () => ({ meta: [{ title: "Visit Management — Nivaas" }] }),
  component: Visits,
});

const statusConfig: Record<VisitStatus, { label: string; cls: string; icon: any }> = {
  pending:     { label: "Pending",     cls: "bg-yellow-100 text-yellow-800",   icon: Clock },
  confirmed:   { label: "Confirmed",   cls: "bg-primary/10 text-primary",      icon: CheckCircle2 },
  completed:   { label: "Completed",   cls: "bg-muted text-muted-foreground",  icon: CheckCircle2 },
  cancelled:   { label: "Cancelled",   cls: "bg-destructive/10 text-destructive", icon: XCircle },
  rescheduled: { label: "Rescheduled", cls: "bg-blue-100 text-blue-800",       icon: RotateCcw },
};

// 24h "HH:MM" values (what the API stores) paired with a proper 12-hour AM/PM label.
// Full half-hour coverage 09:00 -> 18:30, no gap around noon.
function buildTimeSlots() {
  const slots: { value: string; label: string }[] = [];
  for (let h = 9; h <= 18; h++) {
    for (const m of [0, 30]) {
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const period = h < 12 ? "AM" : "PM";
      const hour12 = h % 12 === 0 ? 12 : h % 12;
      const label = `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
      slots.push({ value, label });
    }
  }
  return slots;
}
const TIME_SLOTS = buildTimeSlots();

function formatSlotLabel(value: string) {
  return TIME_SLOTS.find(s => s.value === value)?.label ?? value;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function RescheduleDialog({
  visit, onDone,
}: { visit: ApiVisit; onDone: () => void }) {
  const [open, setOpen]     = useState(false);
  const [saving, setSaving] = useState(false);
  const [date, setDate]     = useState(visit.visit_date?.slice(0, 10) ?? "");
  const [time, setTime]     = useState(visit.visit_time?.slice(0, 5) ?? "");

  const handleSave = async () => {
    if (!date || !time) {
      toast.error("Please select both a date and a time");
      return;
    }
    setSaving(true);
    try {
      await visitsApi.update(visit.id, { status: "rescheduled", visit_date: date, visit_time: time });
      toast.success("Visit rescheduled");
      setOpen(false);
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <RotateCcw className="h-3 w-3 mr-1" /> Reschedule
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)] max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Reschedule Visit</DialogTitle></DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="reschedule-date">New Date</Label>
              <Input
                id="reschedule-date"
                type="date"
                min={todayISO()}
                value={date}
                onChange={e => setDate(e.target.value)}
              />
              {date && (
                <p className="text-xs text-muted-foreground">Selected: {formatDate(date)}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>New Time</Label>
              {/* Contained, scrollable grid instead of a dropdown so it can never
                  overflow above/behind the modal on small screens. */}
              <div className="max-h-48 overflow-y-auto rounded-md border border-input p-2">
                <div className="grid grid-cols-3 gap-2">
                  {TIME_SLOTS.map(slot => (
                    <button
                      key={slot.value}
                      type="button"
                      onClick={() => setTime(slot.value)}
                      className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                        time === slot.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              </div>
              {time && (
                <p className="text-xs text-muted-foreground">Selected: {formatSlotLabel(time)}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="hero" onClick={handleSave} disabled={saving || !date || !time}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function VisitCard({ visit, myId, onRefresh }: { visit: ApiVisit; myId: string; onRefresh: () => void }) {
  const declinedByOwner = visit.status === "cancelled" && visit.cancel_reason === "Declined by owner";
  const s = declinedByOwner
    ? { ...statusConfig.cancelled, label: "Declined" }
    : statusConfig[visit.status] ?? statusConfig.pending;
  const isOwner = visit.owner_id === myId;
  const [acting, setActing] = useState(false);

  const act = async (status: VisitStatus, cancel_reason?: string) => {
    setActing(true);
    try {
      await visitsApi.update(visit.id, { status, ...(cancel_reason ? { cancel_reason } : {}) });
      toast.success(
        status === "cancelled" && cancel_reason
          ? "Visit request declined"
          : `Visit marked as ${status}`
      );
      onRefresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setActing(false); }
  };

  return (
    <Card className="p-5 border-border/60 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold truncate">{visit.property_title}</h3>
            <Badge className={`${s.cls} gap-1 shrink-0`}>
              <s.icon className="h-3 w-3" />{s.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {visit.locality && `${visit.locality}, `}{visit.city}
          </p>
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            <span className="flex items-center gap-1 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {formatDate(visit.visit_date)}
            </span>
            <span className="flex items-center gap-1 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {formatSlotLabel(visit.visit_time?.slice(0, 5))}
            </span>
            <span className="flex items-center gap-1 text-sm">
              {visit.visit_type === "video_call"
                ? <Video className="h-4 w-4 text-muted-foreground" />
                : <MapPin className="h-4 w-4 text-muted-foreground" />}
              {visit.visit_type === "video_call" ? "Video Call" : "In Person"}
            </span>
          </div>
          {isOwner && visit.customer_name && (
            <p className="text-xs text-muted-foreground mt-2">
              <Phone className="h-3 w-3 inline mr-1" />
              {visit.customer_name} · {visit.customer_phone}
            </p>
          )}
          {!isOwner && visit.owner_name && (
            <p className="text-xs text-muted-foreground mt-2">
              Owner: {visit.owner_name} · {visit.owner_phone}
            </p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {visit.status !== "completed" && (visit.status as string) !== "cancelled" && (
        <div className="flex gap-2 flex-wrap mt-4 pt-4 border-t border-border/60">
          {isOwner && visit.status === "pending" && (
            <>
              <Button size="sm" variant="hero" disabled={acting}
                onClick={() => act("confirmed")}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Confirm
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                disabled={acting}
                onClick={() => act("cancelled", "Declined by owner")}>
                <XCircle className="h-3 w-3 mr-1" /> Decline
              </Button>
            </>
          )}
          {isOwner && visit.status === "confirmed" && (
            <Button size="sm" variant="outline" disabled={acting}
              onClick={() => act("completed")}>
              <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Completed
            </Button>
          )}
          {!isOwner && visit.status !== "cancelled" && (
            <RescheduleDialog visit={visit} onDone={onRefresh} />
          )}
          {/* Generic cancel — customer can cancel their own request/booking at
              any stage; owner can cancel an already-confirmed booking (pending
              requests use the explicit Decline action above instead). */}
          {!(isOwner && visit.status === "pending") && (
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
              disabled={acting}
              onClick={() => act("cancelled")}>
              <XCircle className="h-3 w-3 mr-1" /> Cancel
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

// Statuses that count as an actual confirmed booking for the customer.
const BOOKED_STATUSES: VisitStatus[] = ["confirmed", "completed", "rescheduled"];
// Statuses that mean "still a request" — either awaiting the owner, or
// declined/cancelled before ever being confirmed.
const REQUEST_STATUSES: VisitStatus[] = ["pending", "cancelled"];

function EmptyState({ text }: { text: string }) {
  return (
    <Card className="p-12 border-border/60 text-center">
      <Calendar className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </Card>
  );
}

function VisitGrid({ visits, myId, onRefresh }: { visits: ApiVisit[]; myId: string; onRefresh: () => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {visits.map(v => (
        <VisitCard key={v.id} visit={v} myId={myId} onRefresh={onRefresh} />
      ))}
    </div>
  );
}

function Visits() {
  const [asCustomer, setAsCustomer] = useState<ApiVisit[]>([]);
  const [asOwner, setAsOwner]       = useState<ApiVisit[]>([]);
  const [myId, setMyId]             = useState("");
  const [loading, setLoading]       = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [profile, cust, owner] = await Promise.all([
        fetchProfile(),
        visitsApi.list("customer"),
        visitsApi.list("owner"),
      ]);
      setMyId(profile?.id ?? "");
      setAsCustomer(cust);
      setAsOwner(owner);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Split the customer's own visits: only owner-confirmed ones are real
  // "bookings" — everything still pending, or declined before confirmation,
  // stays in "My Visit Requests" instead of showing up as a booking.
  const myBookings = asCustomer.filter(v => BOOKED_STATUSES.includes(v.status));
  const myRequests = asCustomer.filter(v => REQUEST_STATUSES.includes(v.status));

  const statCards = [
    { label: "Total Visits",     value: asCustomer.length + asOwner.length },
    { label: "Pending",          value: [...asCustomer, ...asOwner].filter(v => v.status === "pending").length,  cls: "text-yellow-600" },
    { label: "Confirmed",        value: [...asCustomer, ...asOwner].filter(v => v.status === "confirmed").length, cls: "text-primary" },
    { label: "Completed",        value: [...asCustomer, ...asOwner].filter(v => v.status === "completed").length },
  ];

  return (
    <DashboardShell title="Visit Management" subtitle="Schedule, confirm and track property visits">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {statCards.map(s => (
          <Card key={s.label} className="p-5 border-border/60">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className={`mt-2 text-3xl font-bold ${s.cls ?? ""}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="bookings" className="mt-6">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="bookings">My Bookings ({myBookings.length})</TabsTrigger>
            <TabsTrigger value="myrequests">My Visit Requests ({myRequests.length})</TabsTrigger>
            <TabsTrigger value="owner">Visit Requests Received ({asOwner.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="bookings" className="mt-4">
            {myBookings.length === 0 ? (
              <EmptyState text="No confirmed bookings yet. Once an owner confirms your visit request, it'll show up here." />
            ) : (
              <VisitGrid visits={myBookings} myId={myId} onRefresh={load} />
            )}
          </TabsContent>

          <TabsContent value="myrequests" className="mt-4">
            {myRequests.length === 0 ? (
              <EmptyState text="No pending visit requests. Browse properties to raise a visit request." />
            ) : (
              <VisitGrid visits={myRequests} myId={myId} onRefresh={load} />
            )}
          </TabsContent>

          <TabsContent value="owner" className="mt-4">
            {asOwner.length === 0 ? (
              <EmptyState text="No visit requests received yet." />
            ) : (
              <VisitGrid visits={asOwner} myId={myId} onRefresh={load} />
            )}
          </TabsContent>
        </Tabs>
      )}
    </DashboardShell>
  );
}
