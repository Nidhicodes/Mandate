// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.28;

import {IComplianceProvider} from "./interfaces/IComplianceProvider.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title ComplianceProvider — ERC-8226 reference compliance provider.
/// @notice Owner/operator-managed principal eligibility registry with structured reason
///         codes and per-record expiry. In production this would adapt an ERC-3643
///         identity registry or EAS attestations; here eligibility is administered by
///         accounts holding {COMPLIANCE_OFFICER_ROLE}, which is sufficient for a
///         conformant, auditable trail.
/// @dev Identity verification is treated as a subset of compliance: granting eligibility
///      implies the underlying identity (referenced by `identityRef`) is valid.
contract ComplianceProvider is IComplianceProvider, AccessControl {
    /// @notice Role permitted to grant and revoke principal eligibility.
    bytes32 public constant COMPLIANCE_OFFICER_ROLE = keccak256("COMPLIANCE_OFFICER_ROLE");

    struct Eligibility {
        bool eligible;
        ReasonCode reason;
        uint48 expiresAt;
        bytes32 identityRef;
    }

    /// @dev (principal, scopeHash) => eligibility record.
    mapping(address => mapping(bytes32 => Eligibility)) private _eligibility;

    error IdentityRefMismatch();
    error NotEligibleToRevoke();

    /// @param admin Address granted DEFAULT_ADMIN_ROLE and the initial compliance officer role.
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(COMPLIANCE_OFFICER_ROLE, admin);
    }

    /// @inheritdoc IComplianceProvider
    function grantPrincipal(address principal, bytes32 identityRef, bytes32 scopeHash)
        external
        onlyRole(COMPLIANCE_OFFICER_ROLE)
    {
        _eligibility[principal][scopeHash] =
            Eligibility({eligible: true, reason: ReasonCode.COMPLIANT, expiresAt: 0, identityRef: identityRef});
        emit PrincipalGranted(principal, scopeHash, identityRef);
    }

    /// @notice Grants eligibility with an explicit expiry timestamp.
    /// @dev Extension over the bare interface to support time-bounded KYC, while still
    ///      conforming: {checkPrincipal} re-evaluates expiry on every call.
    function grantPrincipalWithExpiry(address principal, bytes32 identityRef, bytes32 scopeHash, uint48 expiresAt)
        external
        onlyRole(COMPLIANCE_OFFICER_ROLE)
    {
        _eligibility[principal][scopeHash] =
            Eligibility({eligible: true, reason: ReasonCode.COMPLIANT, expiresAt: expiresAt, identityRef: identityRef});
        emit PrincipalGranted(principal, scopeHash, identityRef);
    }

    /// @inheritdoc IComplianceProvider
    function revokePrincipal(address principal, bytes32 scopeHash, ReasonCode reason)
        external
        onlyRole(COMPLIANCE_OFFICER_ROLE)
    {
        Eligibility storage e = _eligibility[principal][scopeHash];
        if (!e.eligible) revert NotEligibleToRevoke();
        e.eligible = false;
        e.reason = reason;
        emit PrincipalRevoked(principal, scopeHash, e.identityRef, reason);
    }

    /// @inheritdoc IComplianceProvider
    /// @dev Returns `eligible == false` with `KYC_EXPIRED` once an expiry has passed,
    ///      and verifies `identityRef` matches the recorded attestation reference.
    function checkPrincipal(address principal, bytes32 identityRef, bytes32 scopeHash)
        external
        view
        returns (bool eligible, ReasonCode reason, uint48 expiresAt)
    {
        Eligibility storage e = _eligibility[principal][scopeHash];

        if (!e.eligible) {
            // Distinguish "never granted" from "explicitly revoked" for a richer trail.
            ReasonCode r = e.reason == ReasonCode.COMPLIANT ? ReasonCode.IDENTITY_NOT_FOUND : e.reason;
            return (false, r, 0);
        }

        // identityRef must resolve to the attestation recorded at grant time.
        if (e.identityRef != identityRef) {
            return (false, ReasonCode.IDENTITY_NOT_FOUND, 0);
        }

        if (e.expiresAt != 0 && block.timestamp > e.expiresAt) {
            return (false, ReasonCode.KYC_EXPIRED, e.expiresAt);
        }

        return (true, ReasonCode.COMPLIANT, e.expiresAt);
    }

    /// @notice ERC-165 interface detection including {IComplianceProvider}.
    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return interfaceId == type(IComplianceProvider).interfaceId || super.supportsInterface(interfaceId);
    }
}
