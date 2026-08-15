import { Link, useRouterState } from "@tanstack/react-router";
import React, { useState, useEffect } from "react";
import {
  Home, LayoutDashboard, Building2, Wallet, FileText, MessageSquare,
  BarChart3, Settings, Heart, Plus, ShieldAlert, Calendar, FolderOpen,
  Shield, Menu, X, Search, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationsPanel } from "./NotificationsPanel";
import type { ReactNode } from "react";
import { fetchProfile } from "@/lib/auth-cache";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<any>;
  exact?: boolean;
  roles?: string[];
};

const ALL_NAV: NavItem[] = [
  { to: "/dashboard",              label: "Overview",          icon: LayoutDashboard, exact: true },
  { to: "/dashboard/properties",   label: "My Properties",     icon: Building2,    roles: ["owner","admin","agent","verification_team"] },
  { to: "/dashboard/rentals",      label: "Rental Management", icon: Wallet,       roles: ["owner","admin"] },
  { to: "/dashboard/agreements",   label: "Agreements",        icon: FileText,     roles: ["owner","admin"] },
  { to: "/dashboard/documents",    label: "Document Vault",    icon: FolderOpen,   roles: ["owner","admin","agent"] },
  { to: "/dashboard/rentals",      label: "My Rent",           icon: Wallet,       roles: ["customer"] },
  { to: "/dashboard/saved",        label: "Saved",             icon: Heart,        roles: ["customer","owner","admin","agent"] },
  { to: "/dashboard/visits",       label: "Visits",            icon: Calendar },
  { to: "/dashboard/messages",     label: "Messages",          icon: MessageSquare },
  { to: "/dashboard/complaints",   label: "Complaints",        icon: ShieldAlert },
  { to: "/dashboard/analytics",    label: "Analytics",         icon: BarChart3 },
  { to: "/dashboard/settings",     label: "Settings",          icon: Settings },
  { to: "/dashboard/admin",        label: "Admin Console",     icon: Shield,       roles: ["admin","verification_team"] },
];

const OWNER_ROLES = ["owner", "admin", "agent", "verification_team"];

export function DashboardShell({
  children, title, subtitle, action,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const pathname   = useRouterState({ select: s => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userRole,   setUserRole]   = useState<string>("");

  useEffect(() => {
    fetchProfile()
      .then(p => setUserRole(p?.role ?? "customer"))
      .catch(() => setUserRole("customer"));
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const nav     = ALL_NAV.filter(n => !n.roles || n.roles.includes(userRole));
  const isOwner = OWNER_ROLES.includes(userRole);

  /* ── Sidebar nav list + CTA (shared between desktop & mobile drawer) ── */
  const SidebarContents = ({ onClose }: { onClose?: () => void }) => (
    <>
      {/* Back to Home */}
      <div className="px-3 pt-2 pb-1">
        <Link
          to="/"
          onClick={onClose}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          Back to Home
        </Link>
      </div>

      <div className="mx-3 border-t border-sidebar-border" />

      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {/* Role badge */}
        {userRole && (
          <div className="px-1 pb-2 pt-1">
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
              userRole === "admin" || userRole === "verification_team"
                ? "bg-purple-100 text-purple-700"
                : userRole === "owner" || userRole === "agent"
                  ? "bg-primary/10 text-primary"
                  : "bg-blue-100 text-blue-700"
            }`}>
              {userRole === "verification_team" ? "Verifier" : userRole}
            </span>
          </div>
        )}

        {nav.map(n => {
          const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
          return (
            <Link
              key={n.to + (n.roles?.[0] ?? "")}
              to={n.to}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-gradient-primary text-white shadow-sm"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <n.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{n.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom CTA */}
      <div className="p-4 border-t border-sidebar-border shrink-0">
        {isOwner ? (
          <Button asChild variant="hero" size="sm" className="w-full">
            <Link to="/dashboard/properties/new" onClick={onClose}>
              <Plus className="h-4 w-4 mr-1" /> Post Property
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to="/properties" onClick={onClose}>
              <Search className="h-4 w-4 mr-1" /> Browse Properties
            </Link>
          </Button>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen grid lg:grid-cols-[260px_1fr]">

      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border">
        <Link to="/" className="flex items-center gap-2 px-6 h-16 border-b border-sidebar-border shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow">
            <Home className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-xl font-bold">Nivaas.</span>
        </Link>
        <SidebarContents />
      </aside>

      {/* ── Mobile drawer ───────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 flex flex-col w-72 max-w-[85vw] bg-sidebar border-r border-sidebar-border h-full">
            <div className="flex items-center justify-between px-5 h-16 border-b border-sidebar-border shrink-0">
              <Link to="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-primary shadow">
                  <Home className="h-4 w-4 text-white" />
                </div>
                <span className="font-display text-lg font-bold">Nivaas.</span>
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContents onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* ── Main ────────────────────────────────────────────────────── */}
      <main className="min-w-0 flex flex-col">

        {/*
          Mobile header layout (≤ lg):
          ┌──────────────────────────────────────────────┐
          │ ☰  🏠  [Title ...............]  🔔  [action] │  ← single row
          └──────────────────────────────────────────────┘

          The action button is rendered compact (icon + short label) so it
          fits. The subtitle is dropped from the header on mobile and shown
          as small text below the title inside the page content area instead.
        *)*/}
        <header className="sticky top-0 z-30 shrink-0 bg-white/90 backdrop-blur border-b border-border/60">
          <div className="flex items-center gap-2 px-3 sm:px-6 h-14 sm:h-16">

            {/* Hamburger – mobile only */}
            <button
              className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg hover:bg-secondary transition-colors shrink-0"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Home shortcut icon – mobile only */}
            <Link
              to="/"
              className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg hover:bg-secondary transition-colors shrink-0"
              aria-label="Back to home"
            >
              <Home className="h-4 w-4 text-muted-foreground" />
            </Link>

            {/* Title – truncates gracefully */}
            <div className="flex-1 min-w-0 overflow-hidden">
              <h1 className="font-display font-bold text-sm sm:text-lg leading-tight truncate">{title}</h1>
              {/* Subtitle visible on sm+ in the header */}
              {subtitle && (
                <p className="hidden sm:block text-xs text-muted-foreground truncate">{subtitle}</p>
              )}
            </div>

            {/* Notifications bell */}
            <NotificationsPanel />

            {/* Action slot — always visible, wrapped so it never wraps text */}
            {action && (
              <div className="shrink-0 ml-1">
                {action}
              </div>
            )}
          </div>

          {/* Subtitle strip – mobile only, below the header row */}
          {subtitle && (
            <div className="sm:hidden px-3 pb-2">
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            </div>
          )}
        </header>

        {/* Page body */}
        <div className="flex-1 p-3 sm:p-5 lg:p-8 min-w-0 overflow-x-hidden">
          {children}
        </div>

      </main>
    </div>
  );
}
