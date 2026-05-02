"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createManifestCache = createManifestCache;
const lru_cache_1 = require("lru-cache");
/**
 * Creates an LRU in-memory cache for CapabilityManifest objects.
 *
 * Cache semantics:
 * - Max 500 entries (covers large skill ecosystems)
 * - TTL-based expiry — entries are automatically evicted after `ttlMs` ms
 * - After TTL, the next access triggers a fresh 0G Storage KV fetch (Phase 2)
 *
 * Per NFR-01: cache hit must resolve in <5ms (in-memory lookup).
 *
 * @param ttlMs - Time-to-live in milliseconds (default: 60,000 = 60s)
 * @returns LRUCache instance keyed by skillId
 */
function createManifestCache(ttlMs = 60_000) {
    return new lru_cache_1.LRUCache({
        max: 500,
        ttl: ttlMs,
        // Allow stale reads while fresh value is being fetched (improves latency)
        allowStale: false,
        // Update TTL on each get() call
        updateAgeOnGet: false,
    });
}
//# sourceMappingURL=cache.js.map