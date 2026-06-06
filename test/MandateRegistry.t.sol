// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MandateRegistry} from "../src/MandateRegistry.sol";
import {ComplianceProvider} from "../src/ComplianceProvider.sol";
import {IAgentMandate} from "../src/interfaces/IAgentMandate.sol";
import {IComplianceProvider} from "../src/interfaces/IComplianceProvider.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

contract MandateRegistryTest is Test {
    MandateRegistry registry;
    ComplianceProvider compliance;

    address admin = makeAddr("admin");
    address platformEnforcer = makeAddr("platformEnforcer");
    address regulatoryEnforcer = makeAddr("regulatoryEnforcer");
    address vault = makeAddr("vault"); // registered token/vault recorder
    address operator = makeAddr("operator");

    // principal with a known private key for signature tests
    uint256 principalPk = 0xA11CE;
    address principal;

    uint256 constant AGENT_ID = 1;
    bytes32 constant SCOPE_HASH = keccak256("scope-v1");
    bytes32 constant IDENTITY_REF = keccak256("did:example:alice");
    bytes32 constant JURIS = keccak256("US");

    uint128 constant MAX_TX = 10_000e6;
    uint128 constant MAX_CUM = 50_000e6;

    function setUp() public {
        principal = vm.addr(principalPk);

        vm.startPrank(admin);
        registry = new MandateRegistry(admin);
        compliance = new ComplianceProvider(admin);

        registry.grantRole(registry.PLATFORM_ENFORCER_ROLE(), platformEnforcer);
        registry.grantRole(registry.REGULATORY_ENFORCER_ROLE(), regulatoryEnforcer);
        registry.grantRole(registry.REGISTERED_TOKEN_ROLE(), vault);

        compliance.grantPrincipal(principal, IDENTITY_REF, SCOPE_HASH);
        vm.stopPrank();
    }

    function _scope() internal pure returns (IAgentMandate.MandateScopeParams memory) {
        return IAgentMandate.MandateScopeParams({
            maxTransactionValue: MAX_TX,
            maxCumulativeValue: MAX_CUM,
            assetAddress: address(0), // asset-class mandate, recorded by the vault
            jurisdictionHash: JURIS
        });
    }

    function _grantDirect() internal {
        vm.prank(principal);
        registry.grantMandate(
            AGENT_ID,
            principal,
            IDENTITY_REF,
            SCOPE_HASH,
            _scope(),
            address(compliance),
            uint48(block.timestamp),
            uint48(block.timestamp + 30 days),
            ""
        );
    }

    // ----------------------------- Grant -----------------------------------

    function test_GrantMandate_Direct() public {
        _grantDirect();
        assertEq(registry.getActivePrincipal(AGENT_ID), principal);
        assertTrue(registry.isActive(AGENT_ID, principal));
    }

    function test_GrantMandate_RevertWhen_ThirdPartyNoSignature() public {
        vm.prank(operator);
        vm.expectRevert(MandateRegistry.SignatureRequiredForThirdParty.selector);
        registry.grantMandate(
            AGENT_ID,
            principal,
            IDENTITY_REF,
            SCOPE_HASH,
            _scope(),
            address(compliance),
            uint48(block.timestamp),
            uint48(block.timestamp + 1 days),
            ""
        );
    }

    function test_GrantMandate_WithSignature() public {
        IAgentMandate.MandateScopeParams memory s = _scope();
        uint48 vf = uint48(block.timestamp);
        uint48 vu = uint48(block.timestamp + 1 days);
        bytes32 digest =
            registry.mandateDigest(AGENT_ID, principal, IDENTITY_REF, SCOPE_HASH, s, address(compliance), vf, vu);
        bytes32 ethDigest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        (uint8 v, bytes32 r, bytes32 sig) = vm.sign(principalPk, ethDigest);

        vm.prank(operator);
        registry.grantMandate(
            AGENT_ID, principal, IDENTITY_REF, SCOPE_HASH, s, address(compliance), vf, vu, abi.encodePacked(r, sig, v)
        );
        assertTrue(registry.isActive(AGENT_ID, principal));
    }

    function test_GrantMandate_RevertWhen_BadSignature() public {
        IAgentMandate.MandateScopeParams memory s = _scope();
        uint48 vf = uint48(block.timestamp);
        uint48 vu = uint48(block.timestamp + 1 days);
        (uint8 v, bytes32 r, bytes32 sig) = vm.sign(0xBADBAD, keccak256("wrong"));

        vm.prank(operator);
        vm.expectRevert(MandateRegistry.InvalidSignature.selector);
        registry.grantMandate(
            AGENT_ID, principal, IDENTITY_REF, SCOPE_HASH, s, address(compliance), vf, vu, abi.encodePacked(r, sig, v)
        );
    }

    function test_GrantMandate_RevertWhen_InvalidWindow() public {
        vm.prank(principal);
        vm.expectRevert(MandateRegistry.InvalidValidityWindow.selector);
        registry.grantMandate(
            AGENT_ID,
            principal,
            IDENTITY_REF,
            SCOPE_HASH,
            _scope(),
            address(compliance),
            uint48(block.timestamp + 1 days),
            uint48(block.timestamp),
            ""
        );
    }

    function test_GrantMandate_RevertWhen_AlreadyActive() public {
        _grantDirect();
        vm.prank(principal);
        vm.expectRevert(MandateRegistry.AgentHasActiveMandate.selector);
        registry.grantMandate(
            AGENT_ID,
            principal,
            IDENTITY_REF,
            SCOPE_HASH,
            _scope(),
            address(compliance),
            uint48(block.timestamp),
            uint48(block.timestamp + 1 days),
            ""
        );
    }

    function test_GrantMandate_RevertWhen_PrincipalNotEligible() public {
        vm.prank(admin);
        compliance.revokePrincipal(principal, SCOPE_HASH, IComplianceProvider.ReasonCode.AML_FLAG);

        vm.prank(principal);
        vm.expectRevert(
            abi.encodeWithSelector(
                MandateRegistry.PrincipalNotEligible.selector, IComplianceProvider.ReasonCode.AML_FLAG
            )
        );
        registry.grantMandate(
            AGENT_ID,
            principal,
            IDENTITY_REF,
            SCOPE_HASH,
            _scope(),
            address(compliance),
            uint48(block.timestamp),
            uint48(block.timestamp + 1 days),
            ""
        );
    }

    // ----------------------------- recordExecution -------------------------

    function test_RecordExecution_WithinCaps() public {
        _grantDirect();
        vm.prank(vault);
        registry.recordExecution(AGENT_ID, principal, 1_000e6);
        assertEq(registry.getMandate(AGENT_ID, principal).cumulativeUsed, 1_000e6);
    }

    function test_RecordExecution_RevertWhen_OverPerTx() public {
        _grantDirect();
        vm.prank(vault);
        vm.expectRevert(MandateRegistry.TransactionValueExceeded.selector);
        registry.recordExecution(AGENT_ID, principal, MAX_TX + 1);
    }

    function test_RecordExecution_RevertWhen_OverCumulative() public {
        _grantDirect();
        // 5 x 10k = 50k (cap). 6th of any size should exceed.
        for (uint256 i = 0; i < 5; ++i) {
            vm.prank(vault);
            registry.recordExecution(AGENT_ID, principal, MAX_TX);
        }
        vm.prank(vault);
        vm.expectRevert(MandateRegistry.CumulativeValueExceeded.selector);
        registry.recordExecution(AGENT_ID, principal, 1);
    }

    function test_RecordExecution_RevertWhen_UnauthorizedCaller() public {
        _grantDirect();
        vm.prank(operator);
        vm.expectRevert(MandateRegistry.UnauthorizedRecorder.selector);
        registry.recordExecution(AGENT_ID, principal, 1e6);
    }

    // ----------------------------- extend / cumulative no-reset ------------

    function test_ExtendMandate_DoesNotResetCumulative() public {
        _grantDirect();
        vm.prank(vault);
        registry.recordExecution(AGENT_ID, principal, 5_000e6);

        vm.prank(principal);
        registry.extendMandate(AGENT_ID, principal, uint48(block.timestamp + 60 days));

        assertEq(registry.getMandate(AGENT_ID, principal).cumulativeUsed, 5_000e6, "cumulative must persist");
    }

    function test_ExtendMandate_RevertWhen_NotLater() public {
        _grantDirect();
        uint48 current = registry.getMandate(AGENT_ID, principal).validUntil;
        vm.prank(principal);
        vm.expectRevert(MandateRegistry.NewValidUntilNotLater.selector);
        registry.extendMandate(AGENT_ID, principal, current);
    }

    // ----------------------------- operator asymmetry ----------------------

    function test_Operator_CanRevokeAndExtend_CannotGrant() public {
        _grantDirect();
        vm.prank(principal);
        registry.setOperator(operator, true);

        // can extend
        vm.prank(operator);
        registry.extendMandate(AGENT_ID, principal, uint48(block.timestamp + 90 days));

        // can revoke
        vm.prank(operator);
        registry.revokeMandate(AGENT_ID, principal);
        assertFalse(registry.isActive(AGENT_ID, principal));

        // cannot grant a NEW mandate on the principal's behalf without signature
        vm.prank(operator);
        vm.expectRevert(MandateRegistry.SignatureRequiredForThirdParty.selector);
        registry.grantMandate(
            2,
            principal,
            IDENTITY_REF,
            SCOPE_HASH,
            _scope(),
            address(compliance),
            uint48(block.timestamp),
            uint48(block.timestamp + 1 days),
            ""
        );
    }

    function test_Revoke_RevertWhen_NotPrincipalOrOperator() public {
        _grantDirect();
        vm.prank(operator);
        vm.expectRevert(MandateRegistry.NotPrincipalOrOperator.selector);
        registry.revokeMandate(AGENT_ID, principal);
    }

    // ----------------------------- freeze tiers ----------------------------

    function test_Freeze_GlobalRequiresRegulatory() public {
        _grantDirect();
        vm.prank(platformEnforcer);
        vm.expectRevert(MandateRegistry.GlobalFreezeRequiresRegulatory.selector);
        registry.freezeAgent(AGENT_ID, bytes32(0));
    }

    function test_Freeze_GlobalByRegulatory_HaltsAgent() public {
        _grantDirect();
        vm.prank(regulatoryEnforcer);
        registry.freezeAgent(AGENT_ID, bytes32(0));
        assertFalse(registry.isActive(AGENT_ID, principal), "global freeze must halt");
    }

    function test_Freeze_JurisdictionByPlatform() public {
        _grantDirect();
        vm.prank(platformEnforcer);
        registry.freezeAgent(AGENT_ID, JURIS);
        assertFalse(registry.isActive(AGENT_ID, principal), "jurisdiction freeze halts matching mandate");

        vm.prank(platformEnforcer);
        registry.unfreezeAgent(AGENT_ID, JURIS);
        assertTrue(registry.isActive(AGENT_ID, principal));
    }

    function test_Freeze_RevertWhen_NotEnforcer() public {
        _grantDirect();
        vm.prank(operator);
        vm.expectRevert(MandateRegistry.NotAnEnforcer.selector);
        registry.freezeAgent(AGENT_ID, JURIS);
    }

    // ----------------------------- access hardening ------------------------

    function test_AdminCannotBeEnforcer() public {
        bytes32 role = registry.REGULATORY_ENFORCER_ROLE();
        vm.prank(admin);
        vm.expectRevert(MandateRegistry.AdminCannotBeEnforcer.selector);
        registry.grantRole(role, admin);
    }

    // ----------------------------- validity window ------------------------

    function test_IsActive_FalseOutsideWindow() public {
        vm.prank(principal);
        registry.grantMandate(
            AGENT_ID,
            principal,
            IDENTITY_REF,
            SCOPE_HASH,
            _scope(),
            address(compliance),
            uint48(block.timestamp + 1 days),
            uint48(block.timestamp + 2 days),
            ""
        );
        assertFalse(registry.isActive(AGENT_ID, principal), "not yet started");
        vm.warp(block.timestamp + 3 days);
        assertFalse(registry.isActive(AGENT_ID, principal), "expired");
    }

    function test_IsActive_FalseWhenComplianceExpires() public {
        // grant with expiry-based eligibility
        vm.prank(admin);
        compliance.grantPrincipalWithExpiry(principal, IDENTITY_REF, SCOPE_HASH, uint48(block.timestamp + 10 days));
        _grantDirect();
        assertTrue(registry.isActive(AGENT_ID, principal));
        vm.warp(block.timestamp + 11 days);
        assertFalse(registry.isActive(AGENT_ID, principal), "KYC expired halts mandate");
    }

    // ----------------------------- ERC165 ----------------------------------

    function test_SupportsInterface() public view {
        assertTrue(registry.supportsInterface(type(IAgentMandate).interfaceId));
        assertTrue(registry.supportsInterface(type(IERC165).interfaceId));
        assertTrue(compliance.supportsInterface(type(IComplianceProvider).interfaceId));
    }
}
