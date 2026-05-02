"use client"

import { useEffect, useState } from "react"

const STEPS = [
  {
    num: "01",
    title: "Install ClawGuard",
    desc: "One npm install to add the middleware",
    file: "terminal",
    lang: "bash",
    code: [
      { type: "comment", text: "# Install ClawGuard middleware" },
      { type: "command", text: "npm install @shanejoans/clawguard" },
      { type: "gap" },
      { type: "comment", text: "# Run preflight checks" },
      { type: "command", text: "npm run preflight" },
      { type: "gap" },
      { type: "output", text: "✓ 0G Chain RPC reachable (16602)" },
      { type: "output", text: "✓ ENS resolution active" },
      { type: "success", text: "✓ ClawGuard ready" },
    ],
  },
  {
    num: "02",
    title: "Wrap your agent",
    desc: "3 lines of code to enforce capabilities",
    file: "agent/index.ts",
    lang: "typescript",
    code: [
      { type: "comment", text: "// Wrap your OpenClaw agent's tool_dispatch" },
      { type: "keyword", text: "import", after: " { wrapWithClawGuard } ", keyword2: "from", string: " '@shanejoans/clawguard'" },
      { type: "gap" },
      { type: "keyword", text: "const", after: " dispatch ", keyword2: "=", keyword3: " wrapWithClawGuard", args: "(agent.tool_dispatch, {" },
      { type: "prop", key: "  ensName", val: "'defi-reader.skills.clawhub.eth'" },
      { type: "prop", key: "  auditLog", val: "true" },
      { type: "prop", key: "  failOpen", val: "false" },
      { type: "plain", text: "});" },
    ],
  },
  {
    num: "03",
    title: "Publish SKILL.md",
    desc: "Upload manifest → 0G Storage → ENS → Chain",
    file: "terminal",
    lang: "bash",
    code: [
      { type: "comment", text: "# Publish skill to 0G Storage + ENS" },
      { type: "command", text: "npx clawguard publish skills/defi-reader" },
      { type: "gap" },
      { type: "output", text: "  [0G] Manifest uploaded..." },
      { type: "output", text: "  [ENS] Registering subname..." },
      { type: "output", text: "  [Chain] Anchoring on SkillRegistry..." },
      { type: "gap" },
      { type: "success", text: "✓ defi-reader.skills.clawhub.eth" },
      { type: "url", text: "  → storagescan-galileo.0g.ai" },
    ],
  },
  {
    num: "04",
    title: "Violations auto-logged",
    desc: "Immutable audit trail on 0G Storage",
    file: "audit-log.json",
    lang: "typescript",
    code: [
      { type: "comment", text: "// ClawGuard blocks + logs violations" },
      { type: "plain", text: "{" },
      { type: "prop", key: '  "skill"', val: '"rogue-defi-skill"' },
      { type: "prop", key: '  "blockedTool"', val: '"wallet.transfer"' },
      { type: "prop", key: '  "rule"', val: '"S-01 fail-closed"' },
      { type: "prop", key: '  "storage"', val: '"0G immutable log"' },
      { type: "plain", text: "}" },
      { type: "gap" },
      { type: "success", text: "✓ Violation uploaded to 0G" },
    ],
  },
]

function CodeLine({ line }: { line: (typeof STEPS)[0]["code"][0] }) {
  if (line.type === "gap") return <div className="h-3" />
  if (line.type === "comment") return <div style={{ color: "#4b5563" }}>{line.text}</div>
  if (line.type === "output") return <div style={{ color: "#6b7280" }}>{line.text}</div>
  if (line.type === "success") return <div style={{ color: "#00ff88" }}>{line.text}</div>
  if (line.type === "url") return <div style={{ color: "#ff5500", textDecoration: "underline" }}>{line.text}</div>
  if (line.type === "command") return (
    <div>
      <span style={{ color: "#00ff88" }}>$ </span>
      <span style={{ color: "rgba(255,255,255,0.85)" }}>{line.text}</span>
    </div>
  )
  if (line.type === "plain") return <div style={{ color: "rgba(255,255,255,0.7)" }}>{line.text}</div>
  if (line.type === "prop") return (
    <div>
      <span style={{ color: "#60a5fa" }}>{line.key}</span>
      <span style={{ color: "rgba(255,255,255,0.5)" }}>: </span>
      <span style={{ color: "#00ff88" }}>{line.val}</span>
      <span style={{ color: "rgba(255,255,255,0.3)" }}>,</span>
    </div>
  )
  if (line.type === "keyword") return (
    <div>
      <span style={{ color: "#a78bfa" }}>{line.text}</span>
      <span style={{ color: "rgba(255,255,255,0.7)" }}>{line.after}</span>
      <span style={{ color: "#a78bfa" }}>{line.keyword2}</span>
      {line.keyword3 && <span style={{ color: "#ff5500" }}>{line.keyword3}</span>}
      {line.fn && <span style={{ color: "#fbbf24" }}>{line.fn}</span>}
      {line.args && <span style={{ color: "rgba(255,255,255,0.7)" }}>{line.args}</span>}
      {line.string && <span style={{ color: "#00ff88" }}>{line.string}</span>}
    </div>
  )
  return null
}

export function DevExSection() {
  const [active, setActive] = useState(0)
  const [visible, setVisible] = useState(true)

  function selectStep(i: number) {
    if (i === active) return
    setVisible(false)
    setTimeout(() => {
      setActive(i)
      setVisible(true)
    }, 180)
  }

  // Auto-advance every 3s
  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setActive(prev => (prev + 1) % STEPS.length)
        setVisible(true)
      }, 180)
    }, 3200)
    return () => clearInterval(t)
  }, [])

  const step = STEPS[active]

  return (
    <section id="devex" className="py-32 px-6 md:px-12 lg:px-20" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-16">
          <div
            className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] tracking-widest uppercase"
            style={{
              background: "rgba(255,85,0,0.08)",
              border: "1px solid rgba(255,85,0,0.15)",
              color: "#ff5500",
            }}
          >
            Developer Experience
          </div>
          <h2
            className="mt-5 text-4xl md:text-5xl font-light tracking-tight leading-[1.05]"
            style={{ color: "rgba(255,255,255,0.92)" }}
          >
            3 lines of code.<br />Enterprise-grade security.
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
          {/* Left — 4 clickable step cards */}
          <div className="flex flex-col gap-3">
            {STEPS.map((s, i) => (
              <button
                key={s.num}
                onClick={() => selectStep(i)}
                className="flex-1 text-left rounded-2xl border transition-all duration-200 p-6 group"
                style={{
                  background: active === i ? "rgba(255,85,0,0.06)" : "rgba(255,255,255,0.03)",
                  borderColor: active === i ? "rgba(255,85,0,0.25)" : "rgba(255,255,255,0.07)",
                  boxShadow: active === i
                    ? "0 0 20px rgba(255,85,0,0.08)"
                    : "0 1px 2px rgba(0,0,0,0.2)",
                }}
              >
                <div className="flex gap-4 items-start">
                  <div
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-xs font-mono shrink-0 transition-colors duration-200"
                    style={{
                      background: active === i ? "rgba(255,85,0,0.15)" : "rgba(255,255,255,0.05)",
                      color: active === i ? "#ff5500" : "rgba(255,255,255,0.3)",
                    }}
                  >
                    {s.num}
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-sm font-light transition-colors duration-200"
                      style={{ color: active === i ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)" }}
                    >
                      {s.title}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.22)" }}>{s.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Right — code panel */}
          <div
            className="lg:col-span-2 rounded-2xl border flex flex-col"
            style={{
              background: "rgba(8,8,8,0.95)",
              borderColor: "rgba(255,255,255,0.08)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.03)",
              minHeight: "360px",
              padding: "2rem",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5 shrink-0">
              <div
                className="text-[10px] tracking-widest uppercase font-mono transition-all duration-200"
                style={{
                  opacity: visible ? 1 : 0,
                  filter: visible ? "blur(0px)" : "blur(4px)",
                  transition: "opacity 200ms ease, filter 200ms ease",
                  color: "rgba(255,85,0,0.6)",
                }}
              >
                {step.file}
              </div>
              {/* Window dots */}
              <div className="flex gap-1.5">
                {["#ff5f57", "#febc2e", "#28c840"].map((c, d) => (
                  <div
                    key={d}
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: d === active % 3 ? c : `${c}55` }}
                  />
                ))}
              </div>
            </div>

            {/* Code block */}
            <div
              className="flex-1 rounded-xl p-6 overflow-hidden"
              style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div
                className="font-mono text-[12px] leading-6"
                style={{
                  opacity: visible ? 1 : 0,
                  filter: visible ? "blur(0px)" : "blur(6px)",
                  transform: visible ? "translateY(0)" : "translateY(6px)",
                  transition: "opacity 220ms cubic-bezier(0.16,1,0.3,1), filter 220ms cubic-bezier(0.16,1,0.3,1), transform 220ms cubic-bezier(0.16,1,0.3,1)",
                }}
              >
                {step.code.map((line, i) => (
                  <CodeLine key={i} line={line} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
