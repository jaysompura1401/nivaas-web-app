import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, LayoutDashboard, UserCircle2, Globe, AlignJustify, Map, Heart, X } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/AuthContext";
import { useState, useEffect } from "react";

const GOLD = "#C9921A";
const BG   = "#FAF6EE";

type NavTab = {
  label: string;
  homeLink?: boolean;
  mapLink?: boolean;
  property_type?: string;
  listing_type?: string;
};

const NAV_TABS: NavTab[] = [
  { label: "Homes",          homeLink: true                          },
  { label: "Villas",         property_type: "Villa"                  },
  { label: "PG / Co-living", listing_type:  "pg"                     },
  { label: "Apartment",      property_type: "Apartment"              },
  { label: "Commercial",     property_type: "Office Space"           },
  { label: "Map",            mapLink: true                           },
];

export function Navbar() {
  const { profile, signOut } = useAuth();
  const navigate   = useNavigate();
  const routerState = useRouterState();
  const pathname    = routerState.location.pathname;
  const searchStr   = routerState.location.searchStr ?? String(routerState.location.search ?? "");

  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, searchStr]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const handleSignOut = () => { signOut(); navigate({ to: "/" }); };

  const isTabActive = (tab: NavTab) => {
    if (tab.homeLink) return pathname === "/";
    if (tab.mapLink)  return pathname === "/properties/map";
    if (pathname !== "/properties") return false;
    if (tab.property_type) return searchStr.includes(`property_type=${encodeURIComponent(tab.property_type)}`);
    if (tab.listing_type)  return searchStr.includes(`listing_type=${encodeURIComponent(tab.listing_type)}`);
    return false;
  };

  const handleTabClick = (tab: NavTab) => {
    setMobileOpen(false);
    if (tab.homeLink) { window.location.href = "/"; return; }
    if (tab.mapLink)  { window.location.href = "/properties/map"; return; }
    let url = "/properties";
    if (tab.property_type) url += `?property_type=${encodeURIComponent(tab.property_type)}`;
    else if (tab.listing_type) url += `?listing_type=${encodeURIComponent(tab.listing_type)}`;
    window.location.href = url;
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b" style={{ backgroundColor: BG, borderColor: "#e8d9c0" }}>
        <nav className="w-full flex h-[60px] items-center px-4 sm:px-6 lg:px-10">

          {/* Logo */}
          <div className="flex-1 flex items-center">
            <Link to="/" className="flex-shrink-0">
              <span style={{ color: GOLD, fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
                Nivaas.
              </span>
            </Link>
          </div>

          {/* Center category tabs — desktop only */}
          <div
            className="hidden md:flex items-center divide-x divide-[#e8d9c0]"
            style={{ border: "1px solid #e8d9c0", borderRadius: 999, overflow: "hidden", backgroundColor: "#fff" }}
          >
            {NAV_TABS.map((tab) => {
              const active = isTabActive(tab);
              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => handleTabClick(tab)}
                  className="flex items-center gap-1.5 px-4 lg:px-5 py-2 text-sm font-medium transition-colors"
                  style={
                    active
                      ? { color: GOLD, backgroundColor: "#fef3d4", fontWeight: 700 }
                      : { color: "#836737", backgroundColor: "transparent" }
                  }
                >
                  {tab.mapLink && <Map className="h-3.5 w-3.5" />}
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Right icons */}
          <div className="flex-1 flex items-center justify-end gap-1">
            {profile ? (
              <>
                <button
                  onClick={() => navigate({ to: "/dashboard/properties/new" })}
                  className="hidden sm:flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition hover:bg-[#fef3d4]"
                  style={{ color: "#836737" }}
                >
                  + Post Property
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="rounded-full ml-1">
                      <Avatar className="h-9 w-9 border-2" style={{ borderColor: "#e8d9c0" }}>
                        <AvatarFallback style={{ backgroundColor: GOLD, color: "#fff", fontSize: 14 }}>
                          {(profile.full_name ?? profile.email ?? "U").slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="truncate">{profile.full_name || profile.email}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/dashboard"><LayoutDashboard className="mr-2 h-4 w-4" />Dashboard</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/dashboard/saved"><Heart className="mr-2 h-4 w-4" />Saved Properties</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Link
                  to="/auth"
                  className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#fef3d4]"
                  style={{ color: "#836737" }}
                  title="Sign in"
                >
                  <UserCircle2 className="h-5 w-5" />
                </Link>
                <button
                  className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#fef3d4]"
                  style={{ color: "#836737" }}
                >
                  <Globe className="h-5 w-5" />
                </button>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#fef3d4]"
              style={{ color: "#836737" }}
              aria-label="Open menu"
            >
              <AlignJustify className="h-5 w-5" />
            </button>
          </div>
        </nav>
      </header>

      {/* ── Mobile Drawer ─────────────────────────────────────────── */}
      {/* Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-72 flex flex-col md:hidden transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ backgroundColor: BG, borderLeft: "1px solid #e8d9c0", boxShadow: "-4px 0 24px rgba(0,0,0,0.12)" }}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 h-[60px] border-b" style={{ borderColor: "#e8d9c0" }}>
          <span style={{ color: GOLD, fontFamily: "'Sora',sans-serif", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Nivaas.
          </span>
          <button
            onClick={() => setMobileOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-[#fef3d4]"
            style={{ color: "#836737" }}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav tabs */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#a08858" }}>
            Browse
          </p>
          {NAV_TABS.map((tab) => {
            const active = isTabActive(tab);
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => handleTabClick(tab)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors mb-0.5"
                style={
                  active
                    ? { color: GOLD, backgroundColor: "#fef3d4", fontWeight: 700 }
                    : { color: "#836737", backgroundColor: "transparent" }
                }
              >
                {tab.mapLink && <Map className="h-4 w-4" />}
                {tab.label}
              </button>
            );
          })}

          {/* Divider */}
          <div className="my-3 border-t" style={{ borderColor: "#e8d9c0" }} />

          {/* Account links */}
          {profile ? (
            <>
              <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#a08858" }}>
                Account
              </p>
              <button
                onClick={() => { navigate({ to: "/dashboard/properties/new" }); setMobileOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors mb-0.5"
                style={{ color: "#836737" }}
              >
                + Post Property
              </button>
              <button
                onClick={() => { navigate({ to: "/dashboard" }); setMobileOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors mb-0.5"
                style={{ color: "#836737" }}
              >
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </button>
              <button
                onClick={() => { navigate({ to: "/dashboard/saved" }); setMobileOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors mb-0.5"
                style={{ color: "#836737" }}
              >
                <Heart className="h-4 w-4" /> Saved Properties
              </button>
              <div className="my-3 border-t" style={{ borderColor: "#e8d9c0" }} />
              <button
                onClick={() => { handleSignOut(); setMobileOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors"
                style={{ color: "#836737" }}
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </>
          ) : (
            <>
              <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#a08858" }}>
                Account
              </p>
              <button
                onClick={() => { navigate({ to: "/auth" }); setMobileOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors"
                style={{ color: "#836737" }}
              >
                <UserCircle2 className="h-4 w-4" /> Sign in
              </button>
            </>
          )}
        </nav>

        {/* Drawer footer — user info if logged in */}
        {profile && (
          <div className="px-5 py-4 border-t" style={{ borderColor: "#e8d9c0" }}>
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 border-2 shrink-0" style={{ borderColor: "#e8d9c0" }}>
                <AvatarFallback style={{ backgroundColor: GOLD, color: "#fff", fontSize: 14 }}>
                  {(profile.full_name ?? profile.email ?? "U").slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "#1a1209" }}>
                  {profile.full_name || "Account"}
                </p>
                <p className="text-xs truncate" style={{ color: "#a08858" }}>{profile.email}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
