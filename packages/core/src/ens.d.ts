/**
 * Phase 3: ENS Integration
 * ========================
 * Resolves ClawGuard skill names via ENS text records on Sepolia.
 *
 * Naming scheme:
 *   {skillId}.skills.clawhub.eth
 *
 * Text records stored per subname:
 *   clawguard.storageKey     → "skill:{skillId}:manifest"  (0G KV key)
 *   clawguard.manifestHash   → "0x..."                     (SHA-256 hash)
 *   clawguard.registryAddr   → "0x..."                     (SkillRegistry contract)
 *   clawguard.status         → "ACTIVE" | "REVOKED"
 *   description              → human-readable skill description
 *   url                      → link to skill documentation
 *
 * Read:  @ensdomains/ensjs v3 (viem-based) — auto-resolves via universal resolver
 * Write: ethers v6 direct contract calls — setText/setSubnodeOwner on ENS registry
 */
/** All ClawGuard text record keys */
export declare const ENS_KEYS: {
    readonly storageKey: "clawguard.storageKey";
    readonly manifestHash: "clawguard.manifestHash";
    readonly registryAddr: "clawguard.registryAddr";
    readonly status: "clawguard.status";
    readonly description: "description";
    readonly url: "url";
};
export interface SkillEnsRecord {
    ensName: string;
    storageKey: string;
    manifestHash: string;
    registryAddr: string;
    status: string;
    description?: string;
    url?: string;
}
export interface RegisterSkillEnsOptions {
    privateKey: string;
    skillId: string;
    storageKey: string;
    manifestHash: string;
    registryAddr: string;
    description?: string;
    url?: string;
}
/** Converts a skillId to its full ENS subname. */
export declare function skillToEnsName(skillId: string): string;
/**
 * Resolves all ClawGuard text records for a skill ENS name.
 * Uses ensjs universal resolver — auto-discovers the resolver.
 */
export declare function resolveSkillEns(skillId: string): Promise<SkillEnsRecord | null>;
/**
 * Fetches just the 0G KV storage key for a skill.
 * Lightweight path used by the middleware.
 */
export declare function getSkillStorageKey(skillId: string): Promise<string | null>;
/**
 * Creates skills.clawhub.eth subdomain under clawhub.eth.
 * Uses ENS registry setSubnodeOwner directly.
 */
export declare function bootstrapSkillsSubdomain(privateKey: string): Promise<void>;
/**
 * Registers a skill subname and sets all ClawGuard text records.
 * Uses ENS registry + resolver direct contract calls.
 */
export declare function registerSkillEns(opts: RegisterSkillEnsOptions): Promise<string>;
/**
 * Revokes a skill by setting its ENS status text record to REVOKED.
 */
export declare function revokeSkillEns(skillId: string, privateKey: string): Promise<string>;
export declare function getEnsConfigFromEnv(): {
    privateKey: string;
    registryAddr: string;
};
//# sourceMappingURL=ens.d.ts.map