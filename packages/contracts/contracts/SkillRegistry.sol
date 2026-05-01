// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SkillRegistry
 * @notice Immutable on-chain registry for OpenClaw skill capability manifests.
 *
 * Each skill registers:
 *  - manifestHash   : SHA-256 of its CapabilityManifest JSON (authoritative)
 *  - storageAddress : 0G Storage KV key where the full manifest lives
 *  - ensSubname     : The skill's ENS subname (e.g. "defi-reader.skills.clawhub.eth")
 *
 * Verification status (PENDING → VERIFIED / CAPABILITY_MISMATCH) is updated
 * by the owner after 0G Compute sealed inference analysis (Phase 2).
 *
 * Security: Once registered, the manifestHash is immutable (FR-05).
 *           The contract is non-upgradeable (NFR-04).
 *
 * @dev Phase 2: deployed on 0G Chain Testnet (Galileo, chainId 80087)
 */
contract SkillRegistry {

    // ─────────────────────────────────────────────────────────────────────────
    // Enums & Structs
    // ─────────────────────────────────────────────────────────────────────────

    enum VerificationStatus {
        PENDING,              // Submitted but not yet analyzed
        VERIFIED,             // 0G Compute confirmed fingerprint matches manifest
        CAPABILITY_MISMATCH   // Fingerprint contains undeclared tool calls
    }

    struct SkillRecord {
        bytes32 manifestHash;       // SHA-256 of the CapabilityManifest
        string  storageAddress;     // 0G Storage KV key: "skill:{skillId}:manifest"
        VerificationStatus status;  // PENDING | VERIFIED | CAPABILITY_MISMATCH
        string  ensSubname;         // e.g. "defi-reader.skills.clawhub.eth"
        uint256 registeredAt;       // Block timestamp of registration
        address registrant;         // Wallet that registered the skill
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    address public owner;

    /// @dev skillId (bytes32 hash of the skill slug) → SkillRecord
    mapping(bytes32 => SkillRecord) private _skills;

    /// @dev Track all registered skillIds for enumeration
    bytes32[] private _skillIds;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event SkillRegistered(
        bytes32 indexed skillId,
        bytes32 manifestHash,
        string  storageAddress,
        address indexed registrant
    );

    event SkillVerified(
        bytes32 indexed skillId,
        VerificationStatus status
    );

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "SkillRegistry: caller is not the owner");
        _;
    }

    modifier skillExists(bytes32 skillId) {
        require(_skills[skillId].registeredAt != 0, "SkillRegistry: skill not registered");
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Write functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Register a new skill with its capability manifest hash.
     * @dev The manifestHash is immutable once set (FR-05).
     *      Reverts if a skill with the same ID is already registered.
     *
     * @param skillId        keccak256 of the skill slug (computed off-chain)
     * @param manifestHash   SHA-256 of the CapabilityManifest JSON (as bytes32)
     * @param storageAddress 0G Storage KV key where the full manifest lives
     * @param ensSubname     ENS subname for this skill (e.g. "defi-reader.skills.clawhub.eth")
     */
    function registerSkill(
        bytes32 skillId,
        bytes32 manifestHash,
        string calldata storageAddress,
        string calldata ensSubname
    ) external {
        require(_skills[skillId].registeredAt == 0, "SkillRegistry: skill already registered");
        require(manifestHash != bytes32(0), "SkillRegistry: manifestHash cannot be zero");
        require(bytes(storageAddress).length > 0, "SkillRegistry: storageAddress cannot be empty");

        _skills[skillId] = SkillRecord({
            manifestHash:   manifestHash,
            storageAddress: storageAddress,
            status:         VerificationStatus.PENDING,
            ensSubname:     ensSubname,
            registeredAt:   block.timestamp,
            registrant:     msg.sender
        });

        _skillIds.push(skillId);

        emit SkillRegistered(skillId, manifestHash, storageAddress, msg.sender);
    }

    /**
     * @notice Update the verification status of a registered skill.
     * @dev Only callable by owner (the ClawGuard verification service).
     *      Called after 0G Compute sealed inference analysis completes (Phase 2).
     *
     * @param skillId ID of the skill to update
     * @param status  New verification status (VERIFIED or CAPABILITY_MISMATCH)
     */
    function updateVerificationStatus(
        bytes32 skillId,
        VerificationStatus status
    ) external onlyOwner skillExists(skillId) {
        _skills[skillId].status = status;
        emit SkillVerified(skillId, status);
    }

    /**
     * @notice Transfer contract ownership to a new address.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "SkillRegistry: new owner cannot be zero address");
        address old = owner;
        owner = newOwner;
        emit OwnershipTransferred(old, newOwner);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Retrieve the full SkillRecord for a registered skill.
     * @param skillId The skill's bytes32 ID
     * @return record The SkillRecord struct
     */
    function getSkillRecord(bytes32 skillId)
        external
        view
        skillExists(skillId)
        returns (SkillRecord memory record)
    {
        return _skills[skillId];
    }

    /**
     * @notice Check whether a skill is registered.
     * @param skillId The skill's bytes32 ID
     */
    function isRegistered(bytes32 skillId) external view returns (bool) {
        return _skills[skillId].registeredAt != 0;
    }

    /**
     * @notice Get the manifest hash for a skill (for on-chain hash verification).
     * @param skillId The skill's bytes32 ID
     */
    function getManifestHash(bytes32 skillId)
        external
        view
        skillExists(skillId)
        returns (bytes32)
    {
        return _skills[skillId].manifestHash;
    }

    /**
     * @notice Get total number of registered skills.
     */
    function totalSkills() external view returns (uint256) {
        return _skillIds.length;
    }

    /**
     * @notice Enumerate all registered skill IDs.
     */
    function getAllSkillIds() external view returns (bytes32[] memory) {
        return _skillIds;
    }
}
