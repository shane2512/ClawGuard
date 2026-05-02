"use client"

import { useEffect, useRef, useState } from "react"

const SKILLS = [
  {
    label: "DEFI-READER",
    title: "Read-only DeFi monitoring",
    desc: "Monitors on-chain price feeds, liquidity pools, and market data without write permissions. All tool calls enforced by ClawGuard manifest.",
    stats: [{ v: "0 violations", l: "clean record" }, { v: "ENS verified", l: "defi-reader.skills.clawhub.eth" }],
    statusColor: "#00ff88",
    statusLabel: "ACTIVE",
  },
  {
    label: "ROGUE-DEFI",
    title: "Blocked wallet transfers",
    desc: "Attempted unauthorized wallet.transfer call — intercepted by ClawGuard middleware. Violation logged to 0G Storage, audit trail immutable.",
    stats: [{ v: "3 blocked", l: "violations logged" }, { v: "0G audit", l: "tamper-proof log" }],
    statusColor: "#ff4444",
    statusLabel: "BLOCKED",
  },
  {
    label: "CODE-REVIEWER",
    title: "Repository analysis agent",
    desc: "Reads source code, runs static analysis, and drafts PR comments. shell.exec permanently blocked. Manifest hash anchored on SkillRegistry.sol.",
    stats: [{ v: "SHA-256", l: "manifest verified" }, { v: "on-chain", l: "SkillRegistry badge" }],
    statusColor: "#ff5500",
    statusLabel: "VERIFIED",
  },
  {
    label: "DATA-PROCESSOR",
    title: "Structured data transformation",
    desc: "Parses inbound JSON payloads, transforms and routes to downstream APIs. Network calls scoped to allowlist. Revocable via ENS status field.",
    stats: [{ v: "ENS gate", l: "revocation ready" }, { v: "fail-closed", l: "rule S-01 enforced" }],
    statusColor: "#ffaa00",
    statusLabel: "MONITORED",
  },
]

const STICKY_TOP   = 80
const STICKY_STEP  = 16
const SCALE_STEP   = 0.04
const OFFSET_STEP  = 8

function Tag({ children, color = "rgba(255,255,255,0.08)" }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center px-3 py-1 rounded-full text-[11px] tracking-widest font-mono"
      style={{ color: "rgba(255,255,255,0.45)", background: color, border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {children}
    </span>
  )
}

export function StackingAgentCards() {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const [depth, setDepth] = useState<number[]>(SKILLS.map(() => 0))

  useEffect(() => {
    function onScroll() {
      const nextDepth = SKILLS.map((_, i) => {
        let count = 0
        for (let j = i + 1; j < SKILLS.length; j++) {
          const el = cardRefs.current[j]
          if (!el) continue
          const rect = el.getBoundingClientRect()
          const stickyTopJ = STICKY_TOP + j * STICKY_STEP
          if (rect.top <= stickyTopJ + 2) count++
        }
        return count
      })
      setDepth(nextDepth)
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div className="flex flex-col" style={{ perspective: "1400px", perspectiveOrigin: "50% 0%" }}>
      {SKILLS.map((skill, i) => {
        const d          = depth[i]
        const scale      = 1 - d * SCALE_STEP
        const translateY = d * OFFSET_STEP

        return (
          <div
            key={skill.label}
            ref={el => { cardRefs.current[i] = el }}
            className="sticky mb-4"
            style={{ top: `${STICKY_TOP + i * STICKY_STEP}px`, zIndex: 10 + i }}
          >
            <div
              style={{
                transform:       `scale(${scale}) translateY(${translateY}px)`,
                transformOrigin: "top center",
                transition:      "transform 0.3s cubic-bezier(0.16,1,0.3,1)",
                willChange:      "transform",
              }}
            >
              <div
                className="group relative rounded-2xl overflow-hidden cursor-pointer"
                style={{
                  background: "rgba(12,12,12,0.92)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  backdropFilter: "blur(12px)",
                }}
              >
                {/* Left accent glow line */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-0.5"
                  style={{ background: `linear-gradient(to bottom, transparent, ${skill.statusColor}, transparent)` }}
                />

                {/* Text content */}
                <div className="relative z-10 p-8">
                  <div className="md:max-w-[65%]">
                    <div className="flex items-center gap-3 mb-6">
                      <Tag>{skill.label}</Tag>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            background: skill.statusColor,
                            boxShadow: `0 0 6px ${skill.statusColor}`,
                            animation: skill.statusLabel === "ACTIVE" || skill.statusLabel === "MONITORED"
                              ? "statusPulse 2s ease-in-out infinite"
                              : "none",
                          }}
                        />
                        <span className="font-mono text-[10px] tracking-widest" style={{ color: skill.statusColor }}>
                          {skill.statusLabel}
                        </span>
                      </div>
                    </div>
                    <h3
                      className="text-xl font-light mb-3"
                      style={{ color: "rgba(255,255,255,0.9)" }}
                    >
                      {skill.title}
                    </h3>
                    <p
                      className="text-sm leading-relaxed mb-8"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      {skill.desc}
                    </p>
                  </div>
                  <div
                    className="flex gap-8 pt-6"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    {skill.stats.map(s => (
                      <div key={s.l}>
                        <div className="text-lg font-mono font-light" style={{ color: skill.statusColor }}>{s.v}</div>
                        <div className="text-[10px] tracking-widest mt-0.5 font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status badge — absolute top right on desktop */}
                <div className="hidden md:flex absolute top-8 right-8 items-center gap-2">
                  <div
                    className="font-mono text-[10px] px-3 py-1 rounded-full tracking-widest"
                    style={{
                      color: skill.statusColor,
                      background: `${skill.statusColor}14`,
                      border: `1px solid ${skill.statusColor}30`,
                    }}
                  >
                    {skill.statusLabel}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })}
      <style>{`
        @keyframes statusPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
