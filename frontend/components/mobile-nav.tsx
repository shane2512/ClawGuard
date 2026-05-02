"use client"

import { useState } from "react"

const NAV_LINKS = [
  { label: "Security",      href: "#security" },
  { label: "Skills",        href: "#agents" },
  { label: "How It Works",  href: "#workflow" },
  { label: "Integrations",  href: "#integrations" },
  { label: "Docs",          href: "#devex" },
]

const NAV_STYLE = {
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  background: "rgba(10,10,10,0.75)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,85,0,0.08)",
} as const

export function MobileNav() {
  const [open, setOpen] = useState(false)

  const close = () => setOpen(false)

  return (
    <div className="fixed top-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-3xl">

        {/* Main bar */}
        <nav
          className="flex items-center justify-between px-5 py-3 rounded-2xl border border-white/[0.06]"
          style={NAV_STYLE}
        >
          <span className="font-pixel text-xs tracking-[0.25em]" style={{ color: "#ff5500" }}>CLAWGUARD</span>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-7" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
            {NAV_LINKS.map(l => (
              <a
                key={l.label}
                href={l.href}
                className="text-[11px] transition-colors duration-200 tracking-wide"
                style={{ color: "rgba(255,255,255,0.5)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#ff5500")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              className="text-[11px] px-4 py-2 rounded-xl border transition-all duration-200 tracking-wide hidden md:block"
              style={{
                borderColor: "rgba(255,85,0,0.3)",
                color: "#ff5500",
                background: "rgba(255,85,0,0.05)",
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(255,85,0,0.12)"
                e.currentTarget.style.borderColor = "rgba(255,85,0,0.6)"
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(255,85,0,0.05)"
                e.currentTarget.style.borderColor = "rgba(255,85,0,0.3)"
              }}
            >
              GET STARTED
            </button>

            {/* Burger — mobile only */}
            <button
              onClick={() => setOpen(v => !v)}
              className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-[5px] rounded-lg transition-colors"
              style={{ background: open ? "rgba(255,85,0,0.08)" : "transparent" }}
              aria-label={open ? "Close menu" : "Open menu"}
            >
              <span
                className="block h-px transition-all duration-300 origin-center"
                style={{
                  width: "18px",
                  background: "#ff5500",
                  transform: open ? "translateY(6px) rotate(45deg)" : "none",
                }}
              />
              <span
                className="block h-px transition-all duration-300"
                style={{
                  width: "18px",
                  background: "#ff5500",
                  opacity: open ? 0 : 1,
                  transform: open ? "scaleX(0)" : "none",
                }}
              />
              <span
                className="block h-px transition-all duration-300 origin-center"
                style={{
                  width: "18px",
                  background: "#ff5500",
                  transform: open ? "translateY(-6px) rotate(-45deg)" : "none",
                }}
              />
            </button>
          </div>
        </nav>

        {/* Mobile dropdown */}
        <div
          className="md:hidden mt-2 overflow-hidden transition-all duration-300 ease-in-out"
          style={{ maxHeight: open ? "320px" : "0px", opacity: open ? 1 : 0 }}
        >
          <div
            className="rounded-2xl border border-white/[0.06] px-2 py-2 flex flex-col"
            style={NAV_STYLE}
          >
            {NAV_LINKS.map(l => (
              <a
                key={l.label}
                href={l.href}
                onClick={close}
                className="px-4 py-3 text-sm rounded-xl transition-colors tracking-wide"
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = "#ff5500"
                  e.currentTarget.style.background = "rgba(255,85,0,0.06)"
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = "rgba(255,255,255,0.55)"
                  e.currentTarget.style.background = "transparent"
                }}
              >
                {l.label}
              </a>
            ))}
            <div className="mt-1 px-2 pb-1">
              <button
                className="w-full text-[11px] px-4 py-2.5 rounded-xl border transition-all duration-200 tracking-wide"
                style={{
                  borderColor: "rgba(255,85,0,0.3)",
                  color: "#ff5500",
                  background: "rgba(255,85,0,0.05)",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
              >
                GET STARTED
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
