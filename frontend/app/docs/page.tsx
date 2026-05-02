"use client"

import React, { useState } from "react"
import { MobileNav } from "@/components/mobile-nav"
import { PixelIcon } from "@/components/pixel-icon"

const DOC_SECTIONS = [
  { id: "intro", title: "Introduction" },
  { id: "getting-started", title: "Getting Started" },
  { id: "sdk-reference", title: "SDK Reference" },
  { id: "cli-toolchain", title: "CLI Toolchain" },
  { id: "manifest-format", title: "SKILL.md Format" },
  { id: "architecture", title: "Architecture" },
]

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("intro")

  const scrollTo = (id: string) => {
    setActiveSection(id)
    const el = document.getElementById(id)
    if (el) {
      window.scrollTo({ top: el.offsetTop - 120, behavior: "smooth" })
    }
  }

  return (
    <div className="bg-[#050505] text-[#ededed] min-h-screen font-sans antialiased selection:bg-[#ff5500]/30 selection:text-white">
      {/* Background ambient glow */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,85,0,0.05),transparent_50%)] pointer-events-none z-0" />
      
      <MobileNav />

      {/* Spacer for nav */}
      <div className="h-24" />

      <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col md:flex-row gap-12 relative z-10 pb-32">
        
        {/* ── SIDEBAR NAV ── */}
        <aside className="w-full md:w-64 shrink-0 mt-8 md:sticky top-28 h-fit">
          <div className="mb-8 flex items-center gap-3">
            <PixelIcon type="workflow" size={24} />
            <span className="font-mono tracking-widest text-[#ff5500] text-sm">DOCS</span>
          </div>
          <nav className="flex flex-col gap-2 font-mono text-sm">
            {DOC_SECTIONS.map((sec) => (
              <button
                key={sec.id}
                onClick={() => scrollTo(sec.id)}
                className="text-left py-2 px-4 rounded-lg transition-all duration-200"
                style={{
                  background: activeSection === sec.id ? "rgba(255,85,0,0.1)" : "transparent",
                  color: activeSection === sec.id ? "#ff5500" : "rgba(255,255,255,0.5)",
                  borderLeft: `2px solid ${activeSection === sec.id ? "#ff5500" : "transparent"}`
                }}
              >
                {sec.title}
              </button>
            ))}
          </nav>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 max-w-3xl space-y-24 mt-8">
          
          {/* INTRODUCTION */}
          <section id="intro" className="scroll-mt-32">
            <h1 className="text-4xl md:text-5xl font-light tracking-tight mb-6 text-white text-shadow-glow">
              ClawGuard Documentation
            </h1>
            <p className="text-lg text-white/60 leading-relaxed font-mono mb-6">
              ClawGuard is a Layer 2.5 security middleware that wraps any OpenClaw agent's <code className="text-[#ff5500]">tool_dispatch</code> function to enforce declarative capabilities, stop unauthorized actions, and anchor identities to ENS and 0G Storage.
            </p>
            <div className="p-6 rounded-xl border border-[#ff5500]/20 bg-[#ff5500]/5 font-mono text-sm leading-relaxed text-white/70">
              <strong>Core Concept:</strong> Every agent has a <code className="text-white">SKILL.md</code> manifest. ClawGuard hashes it, anchors it on-chain, and uses it at runtime to gate tool access. Violations are pushed to an append-only 0G File Storage audit trail.
            </div>
          </section>

          {/* GETTING STARTED */}
          <section id="getting-started" className="scroll-mt-32">
            <h2 className="text-3xl font-light tracking-tight mb-8 text-white border-b border-white/10 pb-4">Getting Started</h2>
            
            <p className="text-white/60 font-mono text-sm mb-8 leading-relaxed">Follow these steps to integrate ClawGuard into a new or existing OpenClaw project from scratch.</p>

            <div className="space-y-12">
              <div>
                <h3 className="text-xl font-light mb-3 text-white/90">Step 1: Installation</h3>
                <p className="text-white/60 font-mono text-sm mb-4">Install the core middleware and CLI directly into your project:</p>
                <div className="bg-[#0c0c0c] border border-white/10 rounded-xl p-4 font-mono text-sm shadow-inner">
                  <span className="text-[#00ff88]">$ </span>
                  <span className="text-white">npm install @shanejoans/clawguard</span>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-light mb-3 text-white/90">Step 2: Environment Configuration</h3>
                <p className="text-white/60 font-mono text-sm mb-4">Create a <code className="text-[#ff5500]">.env</code> file in your project root. You must provide a funded wallet for the 0G Galileo and Sepolia ENS testnets:</p>
                <div className="bg-[#0c0c0c] border border-white/10 rounded-xl p-4 font-mono text-sm overflow-x-auto text-white/80 leading-relaxed">
                  <span className="text-white/40"># 0G Testnet Config</span><br/>
                  ZG_PRIVATE_KEY=your_hex_private_key_here<br/>
                  ZG_CHAIN_RPC=https://rpc-testnet.0g.ai<br/>
                  ZG_INDEXER_RPC=https://indexer-storage-testnet-turbo.0g.ai<br/><br/>
                  <span className="text-white/40"># Ethereum Sepolia Config</span><br/>
                  ETH_SEPOLIA_RPC=https://sepolia.infura.io/v3/your_project_id<br/>
                  REGISTRY_ADDRESS=0x2205AC38725F42d9da0ffaDD94166B5E5b83010A
                </div>
              </div>

              <div>
                <h3 className="text-xl font-light mb-3 text-white/90">Step 3: Define Capabilities (SKILL.md)</h3>
                <p className="text-white/60 font-mono text-sm mb-4">Create a <code className="text-[#ff5500]">SKILL.md</code> file in your agent's directory to declare what it's allowed to do:</p>
                <div className="bg-[#0c0c0c] border border-white/10 rounded-xl p-4 font-mono text-sm overflow-x-auto text-white/80 leading-relaxed">
                  # Example Agent<br/>
                  ## Allowed Tools<br/>
                  - web.fetch<br/>
                  - data.parse_json
                </div>
              </div>

              <div>
                <h3 className="text-xl font-light mb-3 text-white/90">Step 4: Publish Manifest</h3>
                <p className="text-white/60 font-mono text-sm mb-4">Use the CLI to publish your SKILL.md. This computes the cryptographic hash, stores the JSON to 0G, and registers it to ENS.</p>
                <div className="bg-[#0c0c0c] border border-white/10 rounded-xl p-4 font-mono text-sm overflow-x-auto text-white/80 leading-relaxed">
                  <span className="text-[#00ff88]">$ </span>
                  <span className="text-white">npx clawguard publish ./path/to/directory --description "My Agent"</span>
                </div>
                <p className="text-white/40 font-mono text-xs mt-3">The CLI will output an ENS name like <code className="text-white">my-agent.skills.clawhub.eth</code>. Use this in the next step.</p>
              </div>
            </div>
          </section>

          {/* SDK REFERENCE */}
          <section id="sdk-reference" className="scroll-mt-32">
            <h2 className="text-3xl font-light tracking-tight mb-8 text-white border-b border-white/10 pb-4">SDK Reference</h2>
            
            <h3 className="text-xl font-mono text-[#ff5500] mb-4">wrapWithClawGuard()</h3>
            <p className="text-white/60 font-mono text-sm mb-6">The primary entry point. Wraps your agent's execution layer.</p>
            
            <div className="bg-[#0c0c0c] border border-white/10 rounded-xl p-6 font-mono text-sm leading-relaxed overflow-x-auto">
              <span className="text-[#a78bfa]">import</span> {'{ wrapWithClawGuard, addViolationHandler }'} <span className="text-[#a78bfa]">from</span> <span className="text-[#00ff88]">'@shanejoans/clawguard'</span>;<br/><br/>
              
              <span className="text-[#a78bfa]">const</span> safeDispatch = wrapWithClawGuard(agent.tool_dispatch, {'{'}<br/>
              &nbsp;&nbsp;<span className="text-[#60a5fa]">agentId</span>: <span className="text-[#00ff88]">'defi-monitor-agent'</span>,<br/>
              &nbsp;&nbsp;<span className="text-[#60a5fa]">ensName</span>: <span className="text-[#00ff88]">'defi-reader.skills.clawhub.eth'</span>,<br/>
              &nbsp;&nbsp;<span className="text-[#60a5fa]">auditLog</span>: <span className="text-[#fbbf24]">true</span>,<br/>
              &nbsp;&nbsp;<span className="text-[#60a5fa]">failOpen</span>: <span className="text-[#fbbf24]">false</span>, <span className="text-white/40">// Rule S-01: block all calls if manifest fetch fails</span><br/>
              {'}'});<br/><br/>
              
              <span className="text-white/40">// Optional: intercept violations</span><br/>
              addViolationHandler(safeDispatch, (event) =&gt; {'{'}<br/>
              &nbsp;&nbsp;console.error(<span className="text-[#00ff88]">'[SECURITY]'</span>, event.blockedTool, <span className="text-[#00ff88]">'blocked'</span>);<br/>
              {'}'});
            </div>

            <div className="mt-8 space-y-4 font-mono text-sm">
              <div className="flex gap-4 p-4 border border-white/5 rounded-lg bg-white/[0.02]">
                <div className="text-[#ff5500] font-bold w-32">ensName</div>
                <div className="text-white/60 flex-1">Auto-resolves ENS to 0G storage hash to fetch the manifest.</div>
              </div>
              <div className="flex gap-4 p-4 border border-white/5 rounded-lg bg-white/[0.02]">
                <div className="text-[#ff5500] font-bold w-32">auditLog</div>
                <div className="text-white/60 flex-1">If true, automatically uploads immutable violation logs to 0G File Storage.</div>
              </div>
            </div>
          </section>

          {/* CLI TOOLCHAIN */}
          <section id="cli-toolchain" className="scroll-mt-32">
            <h2 className="text-3xl font-light tracking-tight mb-8 text-white border-b border-white/10 pb-4">CLI Toolchain</h2>
            <p className="text-white/60 font-mono text-sm mb-6">The CLI manages the lifecycle of your agent manifests.</p>
            
            <div className="space-y-8">
              <div className="group">
                <h4 className="text-[#ff5500] font-mono mb-2 group-hover:text-white transition-colors">clawguard publish &lt;path&gt;</h4>
                <p className="text-white/50 text-sm font-mono mb-3">Parses SKILL.md, hashes it, uploads to 0G, and registers on ENS.</p>
                <div className="bg-[#0c0c0c] border border-white/5 rounded-lg p-4 font-mono text-xs text-white/70">
                  $ npx clawguard publish packages/example-agent/skills/defi-reader --description "DeFi Monitor"
                </div>
              </div>
              
              <div className="group">
                <h4 className="text-[#ff5500] font-mono mb-2 group-hover:text-white transition-colors">clawguard inspect &lt;ens-name&gt;</h4>
                <p className="text-white/50 text-sm font-mono mb-3">Reads and verifies the manifest live from the network.</p>
                <div className="bg-[#0c0c0c] border border-white/5 rounded-lg p-4 font-mono text-xs text-white/70">
                  $ npx clawguard inspect defi-reader.skills.clawhub.eth --check-tool wallet.transfer<br/>
                  <span className="text-[#ff4444] mt-2 block">⛔ DENIED: "wallet.transfer" is explicitly blocked for "defi-reader"</span>
                </div>
              </div>

              <div className="group">
                <h4 className="text-[#ff5500] font-mono mb-2 group-hover:text-white transition-colors">clawguard verify &lt;path&gt;</h4>
                <p className="text-white/50 text-sm font-mono mb-3">Runs 0G Compute sealed inference to verify code behavior matches manifest.</p>
                <div className="bg-[#0c0c0c] border border-white/5 rounded-lg p-4 font-mono text-xs text-white/70">
                  $ npx clawguard verify packages/example-agent/skills/defi-reader
                </div>
              </div>
            </div>
          </section>

          {/* MANIFEST FORMAT */}
          <section id="manifest-format" className="scroll-mt-32">
            <h2 className="text-3xl font-light tracking-tight mb-8 text-white border-b border-white/10 pb-4">SKILL.md Format</h2>
            <p className="text-white/60 font-mono text-sm mb-6">Capabilities are defined declaratively in Markdown.</p>
            
            <div className="bg-[#0c0c0c] border border-white/10 rounded-xl p-6 font-mono text-sm text-white/80">
              <span className="text-white/40"># DeFi Reader</span><br/><br/>
              Read-only DeFi market data agent.<br/><br/>
              <span className="text-[#ff5500]">## Allowed Tools</span><br/>
              - wallet.read_balance<br/>
              - web.fetch<br/>
              - data.parse_json<br/><br/>
              <span className="text-[#ff4444]">## Blocked Tools</span><br/>
              - wallet.transfer<br/>
              - shell.exec<br/><br/>
              <span className="text-[#ffaa00]">## Constraints</span><br/>
              - max_external_calls: 10
            </div>
          </section>

          {/* ARCHITECTURE */}
          <section id="architecture" className="scroll-mt-32">
            <h2 className="text-3xl font-light tracking-tight mb-8 text-white border-b border-white/10 pb-4">Architecture</h2>
            
            <div className="p-8 border border-white/10 rounded-2xl bg-gradient-to-b from-[#0c0c0c] to-black relative overflow-hidden">
              <div className="absolute top-0 right-0 p-32 opacity-10 blur-3xl rounded-full bg-[#ff5500] pointer-events-none" />
              
              <ol className="relative border-l border-white/10 space-y-12 ml-4">                  
                <li className="pl-8 relative">
                  <div className="absolute w-4 h-4 bg-[#ff5500] rounded-full -left-2 top-1 shadow-[0_0_10px_#ff5500]" />
                  <h3 className="text-lg font-bold text-white font-mono mb-2">1. ENS Resolution</h3>
                  <p className="text-white/50 font-mono text-sm">ClawGuard looks up <code className="text-white">skill.clawhub.eth</code> on Sepolia to retrieve the 0G <code className="text-[#ff5500]">storageKey</code> (Merkle Root) and <code className="text-white">manifestHash</code>.</p>
                </li>
                
                <li className="pl-8 relative">
                  <div className="absolute w-4 h-4 bg-[#00ff88] rounded-full -left-2 top-1 shadow-[0_0_10px_#00ff88]" />
                  <h3 className="text-lg font-bold text-white font-mono mb-2">2. Zero-Trust Fetch</h3>
                  <p className="text-white/50 font-mono text-sm">The JSON manifest is fetched from the 0G File Storage Indexer REST API.</p>
                </li>

                <li className="pl-8 relative">
                  <div className="absolute w-4 h-4 bg-[#ff5500] rounded-full -left-2 top-1 shadow-[0_0_10px_#ff5500]" />
                  <h3 className="text-lg font-bold text-white font-mono mb-2">3. Cryptographic Verification</h3>
                  <p className="text-white/50 font-mono text-sm">The downloaded manifest is hashed via SHA-256. If it doesn't match the ENS anchor, execution fails closed (Rule S-03).</p>
                </li>

                <li className="pl-8 relative">
                  <div className="absolute w-4 h-4 bg-[#ff4444] rounded-full -left-2 top-1 shadow-[0_0_10px_#ff4444]" />
                  <h3 className="text-lg font-bold text-white font-mono mb-2">4. Interception & Audit</h3>
                  <p className="text-white/50 font-mono text-sm">Any attempt to call a tool in the blocked list results in a thrown exception and an immutable audit event uploaded back to 0G Storage.</p>
                </li>
              </ol>
            </div>
          </section>

        </main>
      </div>
      
      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="py-10 px-6 md:px-12 lg:px-20 border-t border-white/[0.06] bg-[#020202]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <span className="font-pixel text-xs tracking-[0.25em] text-[#ff5500]">CLAWGUARD</span>
          <div className="flex items-center gap-6 font-mono">
            <a href="/" className="text-xs text-white/30 hover:text-white/70 transition-colors tracking-widest">Back to Home</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
