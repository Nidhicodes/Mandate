// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.28;

import {IAgentMandate} from "./interfaces/IAgentMandate.sol";
import {IComplianceProvider} from "./interfaces/IComplianceProvider.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title MandateRegistry — ERC-8226 (Regulated Agent Mandate) registry implementation.
/// @notice Manages the lifecycle of mandates that delegate scoped, time-bounded and
///         financially-capped authority from a verified principal to an on-chain agent,
///         and records agent-initiated executions atomically. This is the canonical
///         enforcement registry; RAMS-aware tokens/vaults call {recordExecution} inside
///         their pre-transfer compliance hook.
/// @dev One active mandate per agentId (regulated-market account segregation). Value
///      limits are denominated in token base units — oracle-free. `cumulativeUsed` never
///      resets on extend; a cap reset requires revoke + re-grant.
contract MandateRegistry is IAgentMandate, AccessControl {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    /// @notice Platform-tier enforcer: may execute jurisdiction-scoped freezes.
    bytes32 public constant PLATFORM_ENFORCER_ROLE = keccak256("PLATFORM_ENFORCER_ROLE");
    /// @notice Regulatory-tier enforcer: may execute jurisdiction-scoped AND global freezes.
    bytes32 public constant REGULATORY_ENFORCER_ROLE = keccak256("REGULATORY_ENFORCER_ROLE");
    /// @notice Role for contracts (e.g. managed vaults) authorised to call {recordExecution}
    ///         for asset-class mandates (assetAddress == address(0)).
    bytes32 public constant REGISTERED_TOKEN_ROLE = keccak256("REGISTERED_TOKEN_ROLE");

    uint128 internal constant NO_LIMIT = type(uint128).max;

    /// @dev (agentId, principal) => mandate.
    mapping(uint256 => mapping(address => Mandate)) private _mandates;
    /// @dev agentId => the principal of its single active mandate (address(0) if none).
    mapping(uint256 => address) private _activePrincipal;
    /// @dev (principal, operator) => approved.
    mapping(address => mapping(address => bool)) private _operators;
    /// @dev (agentId, jurisdictionHash) => frozen. bytes32(0) is the global freeze key.
    mapping(uint256 => mapping(bytes32 => bool)) private _frozen;

    error InvalidValidityWindow();
    error AgentHasActiveMandate();
    error MandateNotFound();
    error NotPrincipalOrOperator();
    error PrincipalNotEligible(IComplianceProvider.ReasonCode reason);
    error InvalidSignature();
    error SignatureRequiredForThirdParty();
    error NewValidUntilNotLater();
    error AmountExceedsUint128();
    error UnauthorizedRecorder();
    error TransactionValueExceeded();
    error CumulativeValueExceeded();
    error GlobalFreezeRequiresRegulatory();
    error NotAnEnforcer();
    error AdminCannotBeEnforcer();

    /// @param admin DEFAULT_ADMIN_ROLE holder governing enforcer permissions.
    /// @dev The admin MUST NOT also hold an enforcer role (self-escalation prevention,
    ///      per ERC-8226 Security Considerations). Enforce on grant via {grantRole} override.
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ---------------------------------------------------------------------
    // Mandate lifecycle
    // ---------------------------------------------------------------------

    /// @inheritdoc IAgentMandate
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
    ) external {
        if (validUntil <= validFrom) revert InvalidValidityWindow();
        if (_activePrincipal[agentId] != address(0)) revert AgentHasActiveMandate();

        // Authorisation: either the principal calls directly, or a third party submits a
        // signature authored by the principal over the mandate parameters.
        if (signature.length == 0) {
            if (msg.sender != principal) revert SignatureRequiredForThirdParty();
        } else {
            bytes32 digest = _mandateDigest(
                    agentId, principal, identityRef, scopeHash, onChainScope, complianceProvider, validFrom, validUntil
                ).toEthSignedMessageHash();
            if (digest.recover(signature) != principal) revert InvalidSignature();
        }

        // Compliance gate: a non-zero identityRef requires an eligible principal.
        if (identityRef != bytes32(0) && complianceProvider != address(0)) {
            (bool eligible, IComplianceProvider.ReasonCode reason,) =
                IComplianceProvider(complianceProvider).checkPrincipal(principal, identityRef, scopeHash);
            if (!eligible) revert PrincipalNotEligible(reason);
        }

        _mandates[agentId][principal] = Mandate({
            principal: principal,
            identityRef: identityRef,
            scopeHash: scopeHash,
            complianceProvider: complianceProvider,
            onChainScope: onChainScope,
            validFrom: validFrom,
            validUntil: validUntil,
            cumulativeUsed: 0,
            revoked: false
        });
        _activePrincipal[agentId] = principal;

        emit MandateGranted(agentId, principal, complianceProvider, scopeHash, validFrom, validUntil);
    }

    /// @inheritdoc IAgentMandate
    function revokeMandate(uint256 agentId, address principal) external {
        Mandate storage m = _mandates[agentId][principal];
        if (m.principal == address(0)) revert MandateNotFound();
        if (msg.sender != principal && !_operators[principal][msg.sender]) revert NotPrincipalOrOperator();

        m.revoked = true;
        if (_activePrincipal[agentId] == principal) _activePrincipal[agentId] = address(0);

        emit MandateRevoked(agentId, principal, msg.sender);
    }

    /// @inheritdoc IAgentMandate
    /// @dev Does NOT reset cumulativeUsed — a mandate is a single delegation agreement.
    function extendMandate(uint256 agentId, address principal, uint48 newValidUntil) external {
        Mandate storage m = _mandates[agentId][principal];
        if (m.principal == address(0)) revert MandateNotFound();
        if (msg.sender != principal && !_operators[principal][msg.sender]) revert NotPrincipalOrOperator();
        if (newValidUntil <= m.validUntil) revert NewValidUntilNotLater();

        m.validUntil = newValidUntil;
        emit MandateExtended(agentId, principal, newValidUntil);
    }

    /// @inheritdoc IAgentMandate
    function setOperator(address operator, bool approved) external {
        _operators[msg.sender][operator] = approved;
        emit OperatorSet(msg.sender, operator, approved);
    }

    // ---------------------------------------------------------------------
    // Execution recording
    // ---------------------------------------------------------------------

    /// @inheritdoc IAgentMandate
    /// @dev Callable by the asset token itself (asset-specific mandate) or by a contract
    ///      holding {REGISTERED_TOKEN_ROLE} or an enforcer role (asset-class mandate).
    ///      Reverts if the amount breaches the per-transaction or cumulative cap.
    function recordExecution(uint256 agentId, address principal, uint256 amount) external {
        Mandate storage m = _mandates[agentId][principal];
        if (m.principal == address(0)) revert MandateNotFound();
        if (amount > NO_LIMIT) revert AmountExceedsUint128();

        _authorizeRecorder(m.onChainScope.assetAddress);

        uint128 amt = uint128(amount);
        if (m.onChainScope.maxTransactionValue != NO_LIMIT && amt > m.onChainScope.maxTransactionValue) {
            revert TransactionValueExceeded();
        }
        if (
            m.onChainScope.maxCumulativeValue != NO_LIMIT
                && uint256(m.cumulativeUsed) + amt > m.onChainScope.maxCumulativeValue
        ) {
            revert CumulativeValueExceeded();
        }

        m.cumulativeUsed += amt;
        emit ExecutionRecorded(agentId, principal, amount, m.cumulativeUsed);
    }

    /// @dev Asset-specific mandates may only be recorded by the asset token. Asset-class
    ///      mandates (assetAddress == 0) may be recorded by a registered token/vault or an
    ///      enforcer. Arbitrary callers are rejected.
    function _authorizeRecorder(address assetAddress) internal view {
        if (assetAddress != address(0)) {
            if (msg.sender != assetAddress) revert UnauthorizedRecorder();
        } else {
            bool ok = hasRole(REGISTERED_TOKEN_ROLE, msg.sender) || hasRole(PLATFORM_ENFORCER_ROLE, msg.sender)
                || hasRole(REGULATORY_ENFORCER_ROLE, msg.sender);
            if (!ok) revert UnauthorizedRecorder();
        }
    }

    // ---------------------------------------------------------------------
    // Freeze (kill authority)
    // ---------------------------------------------------------------------

    /// @inheritdoc IAgentMandate
    /// @dev Global freeze (bytes32(0)) is restricted to REGULATORY tier. Jurisdiction-scoped
    ///      freeze may be executed by either tier.
    function freezeAgent(uint256 agentId, bytes32 jurisdictionHash) external {
        EnforcerTier tier = _enforcerTier(msg.sender);
        if (jurisdictionHash == bytes32(0) && tier != EnforcerTier.REGULATORY) {
            revert GlobalFreezeRequiresRegulatory();
        }
        _frozen[agentId][jurisdictionHash] = true;
        emit AgentFrozen(agentId, jurisdictionHash, msg.sender, tier);
    }

    /// @inheritdoc IAgentMandate
    function unfreezeAgent(uint256 agentId, bytes32 jurisdictionHash) external {
        EnforcerTier tier = _enforcerTier(msg.sender);
        if (jurisdictionHash == bytes32(0) && tier != EnforcerTier.REGULATORY) {
            revert GlobalFreezeRequiresRegulatory();
        }
        _frozen[agentId][jurisdictionHash] = false;
        emit AgentUnfrozen(agentId, jurisdictionHash, msg.sender);
    }

    /// @dev Returns the enforcer tier of `account`, preferring REGULATORY. Reverts if neither.
    function _enforcerTier(address account) internal view returns (EnforcerTier) {
        if (hasRole(REGULATORY_ENFORCER_ROLE, account)) return EnforcerTier.REGULATORY;
        if (hasRole(PLATFORM_ENFORCER_ROLE, account)) return EnforcerTier.PLATFORM;
        revert NotAnEnforcer();
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @inheritdoc IAgentMandate
    function getActivePrincipal(uint256 agentId) external view returns (address) {
        return _activePrincipal[agentId];
    }

    /// @inheritdoc IAgentMandate
    function isActive(uint256 agentId, address principal) public view returns (bool) {
        Mandate storage m = _mandates[agentId][principal];

        if (m.principal == address(0)) return false;
        if (block.timestamp < m.validFrom || block.timestamp > m.validUntil) return false;
        if (m.revoked) return false;
        if (_frozen[agentId][m.onChainScope.jurisdictionHash]) return false;
        if (_frozen[agentId][bytes32(0)]) return false;

        if (m.complianceProvider != address(0)) {
            (bool eligible,,) =
                IComplianceProvider(m.complianceProvider).checkPrincipal(principal, m.identityRef, m.scopeHash);
            if (!eligible) return false;
        }

        if (m.onChainScope.maxCumulativeValue != NO_LIMIT && m.cumulativeUsed >= m.onChainScope.maxCumulativeValue) {
            return false;
        }

        return true;
    }

    /// @inheritdoc IAgentMandate
    function isActiveForAmount(uint256 agentId, address principal, uint256 amount) external view returns (bool) {
        if (!isActive(agentId, principal)) return false;
        if (amount > NO_LIMIT) return false;

        Mandate storage m = _mandates[agentId][principal];
        uint128 amt = uint128(amount);

        if (m.onChainScope.maxTransactionValue != NO_LIMIT && amt > m.onChainScope.maxTransactionValue) {
            return false;
        }
        if (
            m.onChainScope.maxCumulativeValue != NO_LIMIT
                && uint256(m.cumulativeUsed) + amt > m.onChainScope.maxCumulativeValue
        ) {
            return false;
        }

        return true;
    }

    /// @inheritdoc IAgentMandate
    function getMandate(uint256 agentId, address principal) external view returns (Mandate memory) {
        return _mandates[agentId][principal];
    }

    /// @inheritdoc IAgentMandate
    function isOperator(address principal, address operator) external view returns (bool) {
        return _operators[principal][operator];
    }

    /// @inheritdoc IAgentMandate
    function isFrozen(uint256 agentId, bytes32 jurisdictionHash) external view returns (bool) {
        return _frozen[agentId][jurisdictionHash];
    }

    // ---------------------------------------------------------------------
    // Access control hardening
    // ---------------------------------------------------------------------

    /// @dev Prevents the admin from also holding an enforcer role (self-escalation guard,
    ///      ERC-8226 Security Considerations).
    function grantRole(bytes32 role, address account) public override {
        if (
            (role == PLATFORM_ENFORCER_ROLE || role == REGULATORY_ENFORCER_ROLE) && hasRole(DEFAULT_ADMIN_ROLE, account)
        ) {
            revert AdminCannotBeEnforcer();
        }
        super.grantRole(role, account);
    }

    /// @notice EIP-191 digest a principal signs to authorise a third-party mandate grant.
    function mandateDigest(
        uint256 agentId,
        address principal,
        bytes32 identityRef,
        bytes32 scopeHash,
        MandateScopeParams calldata onChainScope,
        address complianceProvider,
        uint48 validFrom,
        uint48 validUntil
    ) external view returns (bytes32) {
        return _mandateDigest(
            agentId, principal, identityRef, scopeHash, onChainScope, complianceProvider, validFrom, validUntil
        );
    }

    function _mandateDigest(
        uint256 agentId,
        address principal,
        bytes32 identityRef,
        bytes32 scopeHash,
        MandateScopeParams calldata onChainScope,
        address complianceProvider,
        uint48 validFrom,
        uint48 validUntil
    ) internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                block.chainid,
                address(this),
                agentId,
                principal,
                identityRef,
                scopeHash,
                onChainScope.maxTransactionValue,
                onChainScope.maxCumulativeValue,
                onChainScope.assetAddress,
                onChainScope.jurisdictionHash,
                complianceProvider,
                validFrom,
                validUntil
            )
        );
    }

    /// @notice ERC-165 interface detection including {IAgentMandate}.
    function supportsInterface(bytes4 interfaceId) public view override(AccessControl, IERC165) returns (bool) {
        return interfaceId == type(IAgentMandate).interfaceId || super.supportsInterface(interfaceId);
    }
}
