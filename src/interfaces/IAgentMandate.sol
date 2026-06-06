// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.28;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @title IAgentMandate — ERC-8226 (Regulated Agent Mandate) registry interface.
/// @notice Mandate lifecycle, execution recording, freeze (kill authority), principal
///         resolution and views. Implemented by the RAMS registry — a single contract
///         deployed by a registry operator.
/// @dev Each `agentId` has at most one active mandate at any time (regulated-market
///      account segregation). Value limits are denominated in the base unit of the
///      token at `assetAddress` — oracle-free by design.
interface IAgentMandate is IERC165 {
    /// @notice Enforceable on-chain subset of the off-chain scope document.
    struct MandateScopeParams {
        uint128 maxTransactionValue;
        uint128 maxCumulativeValue;
        address assetAddress;
        bytes32 jurisdictionHash;
    }

    /// @notice Full mandate record stored per (agentId, principal).
    struct Mandate {
        address principal;
        bytes32 identityRef;
        bytes32 scopeHash;
        address complianceProvider;
        MandateScopeParams onChainScope;
        uint48 validFrom;
        uint48 validUntil;
        uint128 cumulativeUsed;
        bool revoked;
    }

    /// @notice Distinguishes platform-initiated from regulator-initiated enforcement.
    enum EnforcerTier {
        PLATFORM,
        REGULATORY
    }

    /// @notice Emitted when a mandate is granted to an agent.
    event MandateGranted(
        uint256 indexed agentId,
        address indexed principal,
        address indexed complianceProvider,
        bytes32 scopeHash,
        uint48 validFrom,
        uint48 validUntil
    );

    /// @notice Emitted when a mandate is revoked.
    event MandateRevoked(uint256 indexed agentId, address indexed principal, address indexed revokedBy);

    /// @notice Emitted when a mandate's validity is extended.
    event MandateExtended(uint256 indexed agentId, address indexed principal, uint48 newValidUntil);

    /// @notice Emitted when an operator approval is set or revoked.
    event OperatorSet(address indexed principal, address indexed operator, bool approved);

    /// @notice Emitted when an agent executes a transfer recorded by a RAMS-aware token/vault.
    event ExecutionRecorded(uint256 indexed agentId, address indexed principal, uint256 amount, uint128 cumulativeUsed);

    /// @notice Emitted when an agent is frozen for a jurisdiction or globally.
    /// @dev jurisdictionHash of bytes32(0) indicates a global freeze (REGULATORY tier only).
    event AgentFrozen(
        uint256 indexed agentId, bytes32 indexed jurisdictionHash, address indexed enforcer, EnforcerTier tier
    );

    /// @notice Emitted when a freeze is lifted.
    event AgentUnfrozen(uint256 indexed agentId, bytes32 indexed jurisdictionHash, address indexed enforcer);

    /// @notice Grants a mandate to the specified agent on behalf of a principal.
    function grantMandate(
        uint256 agentId,
        address principal,
        bytes32 identityRef,
        bytes32 scopeHash,
        MandateScopeParams calldata onChainScope,
        address complianceProvider,
        uint48 validFrom,
        uint48 validUntil,
        bytes calldata signature
    ) external;

    /// @notice Revokes the active mandate for the given agent and principal.
    function revokeMandate(uint256 agentId, address principal) external;

    /// @notice Extends the validity of an existing mandate without resetting cumulativeUsed.
    function extendMandate(uint256 agentId, address principal, uint48 newValidUntil) external;

    /// @notice Freezes an agent for a given jurisdiction, or globally if jurisdictionHash is bytes32(0).
    function freezeAgent(uint256 agentId, bytes32 jurisdictionHash) external;

    /// @notice Lifts a freeze for a given agent and jurisdiction.
    function unfreezeAgent(uint256 agentId, bytes32 jurisdictionHash) external;

    /// @notice Sets or revokes operator approval for msg.sender.
    function setOperator(address operator, bool approved) external;

    /// @notice Records an agent-initiated execution. Called by RAMS-aware regulated tokens/vaults.
    function recordExecution(uint256 agentId, address principal, uint256 amount) external;

    /// @notice Returns the principal address of the sole active mandate for the given agent.
    function getActivePrincipal(uint256 agentId) external view returns (address);

    /// @notice Returns true if the mandate for the given agent and principal is currently active.
    function isActive(uint256 agentId, address principal) external view returns (bool);

    /// @notice Returns true if the mandate is active and the given amount is within all defined limits.
    function isActiveForAmount(uint256 agentId, address principal, uint256 amount) external view returns (bool);

    /// @notice Returns the full Mandate struct for the given agent and principal.
    function getMandate(uint256 agentId, address principal) external view returns (Mandate memory);

    /// @notice Returns true if the operator is approved for the given principal.
    function isOperator(address principal, address operator) external view returns (bool);

    /// @notice Returns true if the agent is frozen for the given jurisdiction (or globally if bytes32(0)).
    function isFrozen(uint256 agentId, bytes32 jurisdictionHash) external view returns (bool);
}
