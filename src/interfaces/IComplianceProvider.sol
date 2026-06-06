// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.28;

/// @title IComplianceProvider — ERC-8226 (Regulated Agent Mandate) compliance layer.
/// @notice Verifies principal eligibility (identity + compliance) for a given scope.
///         Implemented by a compliance operator or platform (e.g. a KYC provider or
///         an on-chain identity registry adapter) and deployed independently of the
///         RAMS registry.
/// @dev Identity verification is a subset of compliance checking: a provider that
///      declares a principal eligible has implicitly verified the underlying identity.
///      A binary oracle is NOT conformant — reason codes and expiry timestamps are
///      required for a credible compliance trail.
interface IComplianceProvider {
    /// @notice Structured reason codes returned by {checkPrincipal} for audit.
    enum ReasonCode {
        COMPLIANT, //            0
        KYC_EXPIRED, //          1
        AML_FLAG, //             2
        NOT_ACCREDITED, //       3
        NOT_QUALIFIED, //        4
        JURISDICTION_BLOCKED, // 5
        IDENTITY_NOT_FOUND, //   6
        ATTESTATION_REVOKED, //  7
        OTHER //                 8
    }

    /// @notice Emitted when a principal is granted eligibility for a scope.
    event PrincipalGranted(address indexed principal, bytes32 indexed scopeHash, bytes32 identityRef);

    /// @notice Emitted when a previously eligible principal is revoked.
    event PrincipalRevoked(
        address indexed principal, bytes32 indexed scopeHash, bytes32 identityRef, ReasonCode reason
    );

    /// @notice Grants eligibility to a principal for a given scope.
    /// @param principal The on-chain address of the principal.
    /// @param identityRef An off-chain identity reference (e.g. keccak256 of a DID or attestation ID).
    /// @param scopeHash The keccak256 hash of the off-chain scope document.
    function grantPrincipal(address principal, bytes32 identityRef, bytes32 scopeHash) external;

    /// @notice Revokes a principal's eligibility for a given scope.
    /// @param principal The on-chain address of the principal.
    /// @param scopeHash The keccak256 hash of the off-chain scope document.
    /// @param reason The reason for revocation.
    function revokePrincipal(address principal, bytes32 scopeHash, ReasonCode reason) external;

    /// @notice Returns eligibility of a principal for a given scope.
    /// @param principal The on-chain address of the principal.
    /// @param identityRef An off-chain identity reference (e.g. keccak256 of a DID or attestation ID).
    /// @param scopeHash The keccak256 hash of the off-chain scope document.
    /// @return eligible True if the principal is compliant for this scope.
    /// @return reason Reason code. MUST be COMPLIANT when eligible is true.
    /// @return expiresAt Unix timestamp after which this result MUST be re-checked. 0 means no expiry.
    function checkPrincipal(address principal, bytes32 identityRef, bytes32 scopeHash)
        external
        view
        returns (bool eligible, ReasonCode reason, uint48 expiresAt);
}
