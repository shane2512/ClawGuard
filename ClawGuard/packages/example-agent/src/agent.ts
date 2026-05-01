import * as fs from 'fs';
import * as path from 'path';
import { wrapWithClawGuard, addViolationHandler, parseSkillManifest } from '@clawguard/core';
import type { SkillContext, ViolationEvent } from '@clawguard/core';
import { baseToolDispatch } from './tools';

/**
 * Minimal agent class wrapping ClawGuard-protected tool dispatch.
 * Simulates the OpenClaw agent runtime for the Phase 1 demo.
 */
export class DeFiMonitorAgent {
  private readonly agentId = 'defi-monitor-agent';
  private readonly skillsDir: string;
  private readonly violations: ViolationEvent[] = [];
  private dispatch: ReturnType<typeof wrapWithClawGuard>;

  constructor(skillsDir: string) {
    this.skillsDir = skillsDir;

    // ── Load all skill manifests from SKILL.md files ──────────────────────
    const localManifestStore = this.loadManifestStore();

    // ── Wire ClawGuard (the 3-line integration, per NFR-08) ───────────────
    this.dispatch = wrapWithClawGuard(
      (toolName: string, params: Record<string, unknown>, _context?: SkillContext) =>
        baseToolDispatch(toolName, params),
      {
        agentId: this.agentId,
        failOpen: false, // fail-closed (Rule A-02)
        localManifestStore,
      },
    );

    // Register violation handler (Phase 2: this will be 0G Storage Log)
    addViolationHandler(this.dispatch, (event) => {
      this.violations.push(event);
    });
  }

  /**
   * Reads all skill directories and parses their SKILL.md into manifests.
   * Returns a map of skillId → CapabilityManifest for use as localManifestStore.
   */
  private loadManifestStore(): Record<string, unknown> {
    const store: Record<string, unknown> = {};
    const skillDirs = fs.readdirSync(this.skillsDir);

    for (const skillDir of skillDirs) {
      const skillMdPath = path.join(this.skillsDir, skillDir, 'SKILL.md');
      if (!fs.existsSync(skillMdPath)) continue;

      const content = fs.readFileSync(skillMdPath, 'utf-8');
      try {
        const manifest = parseSkillManifest(skillDir, content);
        store[skillDir] = manifest;
        console.log(`  [agent] Loaded manifest for skill: "${skillDir}"`);
      } catch (err) {
        console.warn(`  [agent] Failed to load manifest for "${skillDir}": ${err}`);
      }
    }

    return store;
  }

  /**
   * Executes a tool call on behalf of a skill.
   * All calls are intercepted by ClawGuard before reaching the tool layer.
   *
   * @param skillId  - The skill making the call (set by the runtime, not the skill)
   * @param toolName - The tool to call
   * @param params   - Tool parameters
   * @param sessionId - Session identifier
   */
  async callTool(
    skillId: string,
    toolName: string,
    params: Record<string, unknown> = {},
    sessionId = 'demo-session',
  ): Promise<unknown> {
    const context: SkillContext = { skillId, sessionId };
    return this.dispatch(toolName, params, context);
  }

  /** Returns all violation events captured so far */
  getViolations(): ViolationEvent[] {
    return [...this.violations];
  }

  /** Clears captured violations (for multi-scenario demos) */
  clearViolations(): void {
    this.violations.length = 0;
  }
}
