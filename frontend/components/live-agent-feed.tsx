"use client"

import { useEffect, useState, useRef } from "react"

const SKILL_NAMES = [
  "defi-reader", "code-reviewer", "data-processor", "web-monitor",
  "tx-validator", "log-auditor", "price-oracle", "rogue-defi",
  "api-gateway", "report-gen",
]

const TOOLS = [
  "wallet.read_balance → ALLOWED",
  "wallet.transfer → BLOCKED ⛔",
  "web.fetch → ALLOWED",
  "shell.exec → BLOCKED ⛔",
  "data.parse_json → ALLOWED",
  "wallet.sign_tx → BLOCKED ⛔",
  "data.query_db → ALLOWED",
  "fs.write → BLOCKED ⛔",
  "api.call → ALLOWED",
  "wallet.approve → BLOCKED ⛔",
  "manifest verified → SHA-256 ✓",
  "ENS resolved → storageKey ✓",
  "0G audit log → uploaded ✓",
  "SkillRegistry → badge ✓",
]

const REGIONS = ["0g-galileo", "sepolia-ens", "clawhub.eth", "us-east", "eu-west"]
const STATUSES = [
  { label: "enforcing", color: "#ff5500" },
  { label: "enforcing", color: "#ff5500" },
  { label: "enforcing", color: "#ff5500" },
  { label: "blocked",   color: "#ff4444" },
  { label: "verified",  color: "#00ff88" },
]

type SkillRow = {
  id: string
  name: string
  tool: string
  region: string
  status: typeof STATUSES[number]
  progress: number
  elapsed: string
  key: number
}

function randomRow(key: number): SkillRow {
  return {
    id: Math.random().toString(36).slice(2, 8).toUpperCase(),
    name: SKILL_NAMES[Math.floor(Math.random() * SKILL_NAMES.length)],
    tool: TOOLS[Math.floor(Math.random() * TOOLS.length)],
    region: REGIONS[Math.floor(Math.random() * REGIONS.length)],
    status: STATUSES[Math.floor(Math.random() * STATUSES.length)],
    progress: Math.floor(Math.random() * 85 + 10),
    elapsed: `${Math.floor(Math.random() * 14 + 1)}m ${Math.floor(Math.random() * 59)}s`,
    key,
  }
}

function ProgressBar({ initial, color }: { initial: number; color: string }) {
  const [pct, setPct] = useState(initial)
  const rafRef = useRef<number>(0)
  const pctRef = useRef(initial)

  useEffect(() => {
    const tick = () => {
      pctRef.current = Math.min(99, pctRef.current + 0.015)
      setPct(Math.round(pctRef.current))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div style={{ width: "100%", height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 9 }}>
      <div style={{
        height: "100%", borderRadius: 9,
        width: `${pct}%`,
        background: color,
        transition: "width 0.5s linear",
        boxShadow: `0 0 4px ${color}`,
      }} />
    </div>
  )
}

const SEED_ROWS: SkillRow[] = [
  { id: "A1B2C3", name: "defi-reader",    tool: "wallet.read_balance → ALLOWED",   region: "0g-galileo",  status: STATUSES[0], progress: 42, elapsed: "3m 12s", key: 0 },
  { id: "D4E5F6", name: "rogue-defi",     tool: "wallet.transfer → BLOCKED ⛔",    region: "sepolia-ens", status: STATUSES[3], progress: 0,  elapsed: "0m 02s", key: 1 },
  { id: "G7H8I9", name: "code-reviewer",  tool: "shell.exec → BLOCKED ⛔",         region: "clawhub.eth", status: STATUSES[3], progress: 0,  elapsed: "0m 01s", key: 2 },
  { id: "J0K1L2", name: "data-processor", tool: "data.parse_json → ALLOWED",       region: "eu-west",     status: STATUSES[0], progress: 55, elapsed: "5m 30s", key: 3 },
  { id: "M3N4O5", name: "log-auditor",    tool: "0G audit log → uploaded ✓",       region: "0g-galileo",  status: STATUSES[4], progress: 99, elapsed: "1m 22s", key: 4 },
  { id: "P6Q7R8", name: "tx-validator",   tool: "manifest verified → SHA-256 ✓",   region: "clawhub.eth", status: STATUSES[4], progress: 100, elapsed: "0m 48s", key: 5 },
]

export function LiveAgentFeed() {
  const [rows, setRows] = useState<SkillRow[]>(SEED_ROWS)
  const [mounted, setMounted] = useState(false)
  const keyRef = useRef(100)

  useEffect(() => {
    setMounted(true)
    setRows(Array.from({ length: 6 }, (_, i) => randomRow(i)))

    const t = setInterval(() => {
      keyRef.current++
      setRows(prev => [...prev.slice(1), randomRow(keyRef.current)])
    }, 2800)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16,
      overflow: "hidden",
      background: "rgba(8,8,8,0.9)",
      backdropFilter: "blur(12px)",
    }}>
      {/* Table header */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "90px 1fr 90px 70px",
        padding: "8px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,85,0,0.04)",
      }}>
        {["SKILL", "TOOL CALL", "NETWORK", "STATUS"].map(h => (
          <span key={h} style={{ fontSize: 8, letterSpacing: "0.16em", color: "rgba(255,85,0,0.5)", fontFamily: "monospace" }}>{h}</span>
        ))}
      </div>

      {/* Rows */}
      <div style={{ overflow: "hidden" }}>
        {rows.map((row, i) => (
          <div
            key={row.key}
            style={{
              display: "grid",
              gridTemplateColumns: "90px 1fr 90px 70px",
              padding: "10px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              gap: 8,
              alignItems: "center",
              animation: i === rows.length - 1 ? "rowSlideIn 0.4s cubic-bezier(0.16,1,0.3,1) both" : "none",
              background: row.status.label === "blocked" ? "rgba(255,68,68,0.04)" : "transparent",
            }}
          >
            {/* Skill */}
            <div>
              <div style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(255,255,255,0.65)", marginBottom: 1 }}>{row.name}</div>
              <div style={{ fontSize: 7.5, fontFamily: "monospace", color: "rgba(255,255,255,0.2)" }}>#{row.id}</div>
            </div>

            {/* Tool + progress */}
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 9, color: row.status.label === "blocked" ? "rgba(255,68,68,0.8)" : "rgba(255,255,255,0.45)",
                lineHeight: 1.35, marginBottom: 5,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{row.tool}</div>
              {row.status.label !== "blocked" && (
                <ProgressBar initial={row.progress} color={row.status.color} />
              )}
            </div>

            {/* Region */}
            <div style={{ fontSize: 8, fontFamily: "monospace", color: "rgba(255,255,255,0.25)" }}>{row.region}</div>

            {/* Status */}
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{
                width: 5, height: 5, borderRadius: "50%",
                background: row.status.color,
                boxShadow: `0 0 6px ${row.status.color}`,
                animation: row.status.label === "enforcing" ? "statusPulse 2s ease-in-out infinite" : "none",
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 8, fontFamily: "monospace", color: row.status.color }}>{row.status.label}</span>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes rowSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes statusPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}

export function LiveAgentCounter() {
  const [count, setCount] = useState(3847)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const t = setInterval(() => {
      setCount(v => v + Math.floor(Math.random() * 3 - 1))
    }, 1200)
    return () => clearInterval(t)
  }, [])

  return (
    <span style={{
      fontFamily: "monospace",
      fontSize: "clamp(3rem, 6vw, 5rem)",
      fontWeight: 300,
      color: "#ff5500",
      lineHeight: 1,
      letterSpacing: "-0.02em",
      textShadow: "0 0 32px rgba(255,85,0,0.4)",
      transition: "color 0.3s ease",
    }}>
      {mounted ? count.toLocaleString("en-US") : "3,847"}
    </span>
  )
}
