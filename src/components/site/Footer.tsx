import { useNavigate } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="mt-16 border-t" style={{ backgroundColor: "#FFF7E6", borderColor: "#e8d9c0" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-10 sm:py-12">

        {/* 5-col on xl, 3-col on md, 2-col on sm, 1-col on mobile */}
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">

          {/* ── Brand column ── */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <p
              className="mb-3 text-xl font-extrabold tracking-tight"
              style={{ color: "#C9921A", fontFamily: "'Sora', 'Inter', system-ui, sans-serif" }}
            >
              Nivaas.
            </p>

            <p className="text-xs leading-relaxed mb-1" style={{ color: "#2d2310" }}>
              501, krishna complex op mocha, Bodakdev
            </p>
            <p className="text-xs mb-4" style={{ color: "#2d2310" }}>
              Africa&nbsp;<span style={{ color: "#bbb" }}>|</span>&nbsp;
              Dubai&nbsp;<span style={{ color: "#bbb" }}>|</span>&nbsp;
              Malaysia
            </p>

            {/* Social icons */}
            <div className="flex items-center gap-3">
              <a href="#" aria-label="Instagram" className="flex text-[#111] hover:opacity-70 transition-opacity">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5"/>
                  <circle cx="12" cy="12" r="4"/>
                  <circle cx="17.5" cy="6.5" r="0.8" fill="#111" stroke="none"/>
                </svg>
              </a>
              <a href="#" aria-label="Facebook" className="flex hover:opacity-70 transition-opacity">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#111">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                </svg>
              </a>
              <a href="#" aria-label="LinkedIn" className="flex hover:opacity-70 transition-opacity">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7H10v-7a6 6 0 0 1 6-6z"/>
                  <rect x="2" y="9" width="4" height="12"/>
                  <circle cx="4" cy="4" r="2"/>
                </svg>
              </a>
              <a href="#" aria-label="Twitter" className="flex hover:opacity-70 transition-opacity">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#111">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
            </div>
          </div>

          <Col title="Company" links={[
            ["About Us", "/"],
            ["Careers",  "/"],
            ["Blog",     "/"],
          ]} />
          <Col title="Support" links={[
            ["Help Center",          "/"],
            ["Safety Information",   "/"],
            ["Cancellation Options", "/"],
            ["Report a Concern",     "/"],
          ]} />
          <Col title="For Owners" links={[
            ["List Your Property", "/dashboard/properties/new"],
            ["Owner Resources",    "/dashboard"],
            ["Pricing",            "/"],
            ["Guidelines",         "/"],
          ]} />
          <Col title="Legal" links={[
            ["Terms & Conditions", "/"],
            ["Privacy Policy",     "/"],
            ["Cookie Policy",      "/"],
            ["RERA Compliance",    "/"],
          ]} />

        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-2"
          style={{ borderColor: "#e8d9c0" }}>
          <p className="text-xs text-center sm:text-left" style={{ color: "#a08858" }}>
            © {new Date().getFullYear()} Nivaas. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: "#c8b08a" }}>
            Made with ♥ in India
          </p>
        </div>
      </div>
    </footer>
  );
}

function Col({ title, links }: { title: string; links: [string, string][] }) {
  const navigate = useNavigate();

  return (
    <div>
      <p className="mb-3 text-sm font-black tracking-wide" style={{ color: "#111111", fontFamily: "'Inter', system-ui, sans-serif" }}>
        {title}
      </p>
      <div className="flex flex-col gap-2.5">
        {links.map(([label, to]) => (
          <button
            key={label}
            onClick={() => navigate({ to: to as "/" })}
            className="text-left text-xs transition-colors hover:text-[#C9921A]"
            style={{ color: "#2d2310", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "'Inter', system-ui, sans-serif" }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
