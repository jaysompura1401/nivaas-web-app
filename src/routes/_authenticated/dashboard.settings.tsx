import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { auth as authApi } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  head: () => ({ meta: [{ title: "Settings — Nivaas" }] }),
  component: Settings,
});

function Settings() {
  const { profile, refresh } = useAuth();
  const [fullName,  setFullName]  = useState("");
  const [phone,     setPhone]     = useState("");
  const [city,      setCity]      = useState("");
  const [bio,       setBio]       = useState("");
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
      setCity(profile.city ?? "");
      setBio(profile.bio ?? "");
    }
  }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await authApi.updateProfile({ full_name: fullName, phone, city, bio });
      await refresh();
      toast.success("Profile updated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell title="Settings" subtitle="Manage your profile and preferences">
      <form onSubmit={save} className="max-w-2xl">
        <Card className="p-6 border-border/60 space-y-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={profile?.email ?? ""} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div className="space-y-1.5">
            <Label>Preferred city</Label>
            <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Ahmedabad" />
          </div>
          <div className="space-y-1.5">
            <Label>Bio</Label>
            <Input value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell others about yourself…" />
          </div>
          <Button type="submit" variant="hero" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </Card>
      </form>
    </DashboardShell>
  );
}
