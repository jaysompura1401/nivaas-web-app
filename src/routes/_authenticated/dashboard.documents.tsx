import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { documents as documentsApi, type ApiDocument, type DocType } from "@/lib/api";
import {
  FileText, Upload, Trash2, CheckCircle2, Eye, Plus, Loader2, FolderOpen,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/documents")({
  head: () => ({ meta: [{ title: "Document Vault — Nivaas" }] }),
  component: Documents,
});

const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: "sale_deed",              label: "Sale Deed" },
  { value: "tax_receipt",            label: "Tax Receipt" },
  { value: "electricity_bill",       label: "Electricity Bill" },
  { value: "noc",                    label: "NOC" },
  { value: "society_letter",         label: "Society Letter" },
  { value: "occupancy_certificate",  label: "Occupancy Certificate" },
  { value: "rental_agreement",       label: "Rental Agreement" },
  { value: "identity_proof",         label: "Identity Proof" },
  { value: "other",                  label: "Other" },
];

function UploadDialog({ onUploaded }: { onUploaded: () => void }) {
  const [open, setOpen]       = useState(false);
  const [saving, setSaving]   = useState(false);
  const fileRef               = useRef<HTMLInputElement>(null);
  const [form, setForm]       = useState({
    title: "", doc_type: "other" as DocType, property_id: "",
  });
  const [fileUrl, setFileUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);

  // For demo: allow either a URL paste or mock-upload from local
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setFileSize(f.size);
    // Create object URL for preview (replace with actual upload endpoint in production)
    const url = URL.createObjectURL(f);
    setFileUrl(url);
    if (!form.title) setForm(prev => ({ ...prev, title: f.name.replace(/\.[^.]+$/, "") }));
  };

  const handleSave = async () => {
    if (!form.title || !fileUrl) {
      toast.error("Title and file are required");
      return;
    }
    setSaving(true);
    try {
      await documentsApi.create({
        title: form.title,
        doc_type: form.doc_type,
        property_id: form.property_id || undefined,
        file_url: fileUrl,
        file_name: fileName || undefined,
        file_size: fileSize || undefined,
      });
      toast.success("Document saved to vault");
      setOpen(false);
      setForm({ title: "", doc_type: "other", property_id: "" });
      setFileUrl("");
      setFileName("");
      onUploaded();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="hero" size="sm"><Plus className="h-4 w-4 mr-1" /> Add Document</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Document Type</Label>
            <Select value={form.doc_type} onValueChange={v => setForm(f => ({ ...f, doc_type: v as DocType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Document Title</Label>
            <Input placeholder="e.g. Sale Deed 2024" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <Label>Property ID (optional)</Label>
            <Input placeholder="Link to a property" value={form.property_id}
              onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))} />
          </div>
          <div>
            <Label>File</Label>
            <div
              className="mt-1 border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {fileName ? (
                <p className="text-sm font-medium">{fileName}</p>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">Click to choose a PDF, image or document</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" onChange={handleFile} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="hero" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save Document
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DocCard({ doc, onDeleted }: { doc: ApiDocument; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await documentsApi.delete(doc.id);
      toast.success("Document deleted");
      onDeleted();
    } catch (e: any) { toast.error(e.message); }
    finally { setDeleting(false); }
  };

  const typeLabel = DOC_TYPES.find(d => d.value === doc.doc_type)?.label ?? doc.doc_type;
  const sizeMB    = doc.file_size ? (doc.file_size / 1048576).toFixed(2) : null;

  return (
    <Card className="p-5 border-border/60 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-sm truncate">{doc.title}</p>
              <p className="text-xs text-muted-foreground">{typeLabel}</p>
              {doc.property_title && (
                <p className="text-xs text-muted-foreground mt-0.5">📍 {doc.property_title}</p>
              )}
              {sizeMB && <p className="text-xs text-muted-foreground">{sizeMB} MB</p>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {doc.is_verified ? (
                <Badge className="bg-primary/10 text-primary gap-1 text-xs">
                  <CheckCircle2 className="h-3 w-3" /> Verified
                </Badge>
              ) : (
                <Badge className="bg-muted text-muted-foreground text-xs">Unverified</Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/60">
            <p className="text-xs text-muted-foreground flex-1">
              {new Date(doc.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </p>
            <Button size="sm" variant="ghost" asChild>
              <a href={doc.file_url} target="_blank" rel="noreferrer">
                <Eye className="h-3 w-3 mr-1" /> View
              </a>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={deleting}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Document?</AlertDialogTitle>
                  <AlertDialogDescription>
                    "{doc.title}" will be permanently removed from your vault.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Documents() {
  const [docs, setDocs]       = useState<ApiDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<DocType | "all">("all");

  const load = () => {
    setLoading(true);
    documentsApi.list()
      .then(setDocs)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = filter === "all" ? docs : docs.filter(d => d.doc_type === filter);

  return (
    <DashboardShell
      title="Document Vault"
      subtitle="Securely store and manage all your property documents"
      action={<UploadDialog onUploaded={load} />}
    >
      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[
          { label: "Total Documents", value: docs.length },
          { label: "Verified",        value: docs.filter(d => d.is_verified).length, cls: "text-primary" },
          { label: "Unverified",      value: docs.filter(d => !d.is_verified).length },
          { label: "Property Linked", value: docs.filter(d => d.property_id).length },
        ].map(s => (
          <Card key={s.label} className="p-5 border-border/60">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className={`mt-2 text-3xl font-bold ${s.cls ?? ""}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="mt-6 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">Filter:</span>
        {([{ value: "all", label: "All" }, ...DOC_TYPES] as any[]).map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === opt.value
                ? "bg-primary text-white"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="mt-6 p-12 border-border/60 text-center">
          <FolderOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            {docs.length === 0 ? "No documents uploaded yet. Use the button above to add your first document." : "No documents match the selected filter."}
          </p>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(d => <DocCard key={d.id} doc={d} onDeleted={load} />)}
        </div>
      )}
    </DashboardShell>
  );
}
