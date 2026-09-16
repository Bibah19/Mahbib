"use client";

import { useState } from "react";
import { WEDDING_DETAILS } from "@/lib/wedding-config";

const NAV_LINKS = [
  { href: "#invite", label: "Invite" },
  { href: "#details", label: "Details" },
  { href: "#secure-seat", label: "Secure a Seat" },
  { href: "#direction", label: "Direction" },
  { href: "#gift", label: "Gift" },
];

export default function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="site-nav" aria-label="Main navigation">
      <div className="shell flex items-center justify-between gap-4 py-4">
        <a
          href="#invite"
          className="text-[22px] font-bold italic whitespace-nowrap text-navy-deep"
          onClick={() => setOpen(false)}
        >
          {WEDDING_DETAILS.brideName} &amp; {WEDDING_DETAILS.groomName}
        </a>

        <div className="hidden items-center gap-6 font-sans md:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="nav-link">
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a href="#secure-seat" className="btn btn-primary hidden lg:inline-flex">
            Secure Your Seat
          </a>

          <button
            type="button"
            className="btn btn-secondary md:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((current) => !current)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      <div className="mobile-menu-panel md:hidden" data-open={open} id="mobile-menu">
        <div>
          <div className="shell grid gap-1 pb-4 pt-2 font-sans">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-xl px-3 py-3 font-bold text-navy-deep transition-colors hover:bg-navy-soft"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}