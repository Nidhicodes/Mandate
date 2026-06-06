// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MandateRegistry} from "../src/MandateRegistry.sol";
import {ComplianceProvider} from "../src/ComplianceProvider.sol";
import {ManagedVault, ISwapRouter} from "../src/ManagedVault.sol";
import {IAgentMandate} from "../src/interfaces/IAgentMandate.sol";
import {IComplianceProvider} from "../src/interfaces/IComplianceProvider.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockSwapRouter} from "./mocks/MockSwapRouter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Exercises the four enforcement layers of the ManagedVault end-to-end against a
///         live MandateRegistry: allowlist, per-name cap, correlation-cluster cap, and the
///         RAMS mandate caps + kill switch. These are the reverts shown in the demo.
contract ManagedVaultTest is Test {
    MandateRegistry registry;
    ComplianceProvider compliance;
    ManagedVault vault;
    MockSwapRouter router;

    MockERC20 usdg; // base asset, 6 decimals like USDC/USDG
    MockERC20 tsla;
    MockERC20 amzn;
    MockERC20 nflx; // not permitted

    address admin = makeAddr("admin");
    address regulator = makeAddr("regulator");
    address principal = makeAddr("principal");
    address agent = makeAddr("agent");

    uint256 constant AGENT_ID = 7;
    bytes32 constant SCOPE_HASH = keccak256("equity-scope-v1");
    bytes32 constant IDENTITY_REF = keccak256("did:example:fund");
    bytes32 constant JURIS = keccak256("US");

    uint16 constant TECH_CLUSTER = 1;

    // 100k USDG of capital, 6 decimals
    uint256 constant CAPITAL = 100_000e6;

    function setUp() public {
        vm.startPrank(admin);
        registry = new MandateRegistry(admin);
        compliance = new ComplianceProvider(admin);
        registry.grantRole(registry.REGULATORY_ENFORCER_ROLE(), regulator);
        compliance.grantPrincipal(principal, IDENTITY_REF, SCOPE_HASH);
        vm.stopPrank();

        usdg = new MockERC20("USD Gateway", "USDG", 6);
        tsla = new MockERC20("Tesla", "TSLA", 18);
        amzn = new MockERC20("Amazon", "AMZN", 18);
        nflx = new MockERC20("Netflix", "NFLX", 18);
        router = new MockSwapRouter();

        // Vault: max 30% per name, max 60% per cluster.
        vault = new ManagedVault(registry, AGENT_ID, principal, IERC20(address(usdg)), agent, 3_000, 6_000);

        // Registry must authorise the vault to record asset-class executions.
        bytes32 tokenRole = registry.REGISTERED_TOKEN_ROLE();
        vm.prank(admin);
        registry.grantRole(tokenRole, address(vault));

        // Principal grants the mandate (asset-class, recorded by the vault).
        IAgentMandate.MandateScopeParams memory scope = IAgentMandate.MandateScopeParams({
            maxTransactionValue: 40_000e6,
            maxCumulativeValue: 90_000e6,
            assetAddress: address(0),
            jurisdictionHash: JURIS
        });
        vm.prank(principal);
        registry.grantMandate(
            AGENT_ID,
            principal,
            IDENTITY_REF,
            SCOPE_HASH,
            scope,
            address(compliance),
            uint48(block.timestamp),
            uint48(block.timestamp + 30 days),
            ""
        );

        // Principal configures the vault allowlist + clusters and funds it.
        vm.startPrank(principal);
        vault.setAssetPermission(address(tsla), true, TECH_CLUSTER);
        vault.setAssetPermission(address(amzn), true, TECH_CLUSTER);
        // NFLX intentionally NOT permitted.
        vm.stopPrank();

        usdg.mint(principal, CAPITAL);
        vm.startPrank(principal);
        usdg.approve(address(vault), CAPITAL);
        vault.deposit(IERC20(address(usdg)), CAPITAL);
        vm.stopPrank();

        // Router 1:1 by raw units; equity has 18 dp and usdg 6 dp, so set rate so that
        // 1 USDG-unit -> 1 equity-unit keeps value bookkeeping in base units simple for the
        // oracle-free cost-basis model (vault values equity balance as raw == base units).
        router.setRate(1e18);
    }

    // ----------------------------- valid path ------------------------------

    function test_Buy_WithinAllLimits() public {
        // 25k into TSLA: 25% of 100k, under 30% name cap and 60% cluster cap.
        vm.prank(agent);
        uint256 out = vault.buy(address(tsla), 25_000e6, 0, router);
        assertEq(out, 25_000e6);
        assertEq(registry.getMandate(AGENT_ID, principal).cumulativeUsed, 25_000e6);
    }

    // ----------------------------- layer 1: allowlist ----------------------

    function test_Buy_RevertWhen_AssetNotPermitted() public {
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(ManagedVault.AssetNotPermitted.selector, address(nflx)));
        vault.buy(address(nflx), 1_000e6, 0, router);
    }

    // ----------------------------- layer 2: per-name cap -------------------

    function test_Buy_RevertWhen_PositionLimitExceeded() public {
        // 40k into TSLA = 40% > 30% per-name cap. (Within the 40k mandate per-tx cap.)
        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(
                ManagedVault.PositionLimitExceeded.selector, address(tsla), uint256(4_000), uint256(3_000)
            )
        );
        vault.buy(address(tsla), 40_000e6, 0, router);
    }

    // ----------------------------- layer 3: cluster cap --------------------

    function test_Buy_RevertWhen_ClusterConcentrationExceeded() public {
        // Fresh vault: 50% per-name cap, 60% cluster cap. Lets us load two names high
        // enough to breach the cluster cap without tripping the per-name cap first.
        ManagedVault v2 = _freshVaultWithCaps(5_000, 6_000);
        _grantFor(v2, 8); // agentId 8
        _fund(v2, 100_000e6);

        // TSLA 35% (ok, <50% name, cluster 35%).
        vm.prank(agent);
        v2.buy(address(tsla), 35_000e6, 0, router);

        // AMZN 30% would make cluster 65% > 60% cap (AMZN alone 30% < 50% name cap).
        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(
                ManagedVault.ClusterConcentrationExceeded.selector, TECH_CLUSTER, uint256(6_500), uint256(6_000)
            )
        );
        v2.buy(address(amzn), 30_000e6, 0, router);
    }

    // ----------------------------- layer 5: mandate caps + freeze ----------

    function test_Buy_RevertWhen_OverMandatePerTx() public {
        // 45k exceeds the 40k mandate per-tx cap (and also name cap, but mandate checked first
        // for amount). Expect the vault's MandateNotActiveForAmount.
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(ManagedVault.MandateNotActiveForAmount.selector, uint256(45_000e6)));
        vault.buy(address(tsla), 45_000e6, 0, router);
    }

    function test_Buy_RevertWhen_Frozen() public {
        vm.prank(regulator);
        registry.freezeAgent(AGENT_ID, bytes32(0)); // global kill switch

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(ManagedVault.MandateNotActiveForAmount.selector, uint256(10_000e6)));
        vault.buy(address(tsla), 10_000e6, 0, router);
    }

    // ----------------------------- custody guarantees ----------------------

    function test_Agent_CannotRedeem() public {
        vm.prank(agent);
        vm.expectRevert(ManagedVault.OnlyPrincipal.selector);
        vault.redeem(IERC20(address(usdg)), 1, agent);
    }

    function test_NonAgent_CannotBuy() public {
        vm.prank(principal);
        vm.expectRevert(ManagedVault.OnlyAgent.selector);
        vault.buy(address(tsla), 1_000e6, 0, router);
    }

    function test_Principal_CanRedeem() public {
        vm.prank(principal);
        vault.redeem(IERC20(address(usdg)), 10_000e6, principal);
        assertEq(usdg.balanceOf(principal), 10_000e6);
    }

    // ----------------------------- sell reduces exposure -------------------

    function test_SellThenBuy_RebalanceWithinCluster() public {
        vm.prank(agent);
        vault.buy(address(tsla), 29_000e6, 0, router); // 29%
        vm.prank(agent);
        uint256 baseOut = vault.sell(address(tsla), 29_000e6, 0, router); // sell all back
        assertEq(baseOut, 29_000e6);
    }

    // ----------------------------- helpers ---------------------------------

    function _freshVaultWithCaps(uint256 nameBps, uint256 clusterBps) internal returns (ManagedVault v) {
        v = new ManagedVault(registry, 8, principal, IERC20(address(usdg)), agent, nameBps, clusterBps);
        bytes32 tokenRole = registry.REGISTERED_TOKEN_ROLE();
        vm.prank(admin);
        registry.grantRole(tokenRole, address(v));
        vm.startPrank(principal);
        v.setAssetPermission(address(tsla), true, TECH_CLUSTER);
        v.setAssetPermission(address(amzn), true, TECH_CLUSTER);
        vm.stopPrank();
    }

    function _grantFor(ManagedVault, uint256 agentId_) internal {
        IAgentMandate.MandateScopeParams memory scope = IAgentMandate.MandateScopeParams({
            maxTransactionValue: 80_000e6,
            maxCumulativeValue: 200_000e6,
            assetAddress: address(0),
            jurisdictionHash: JURIS
        });
        vm.prank(principal);
        registry.grantMandate(
            agentId_,
            principal,
            IDENTITY_REF,
            SCOPE_HASH,
            scope,
            address(compliance),
            uint48(block.timestamp),
            uint48(block.timestamp + 30 days),
            ""
        );
    }

    function _fund(ManagedVault v, uint256 amount) internal {
        usdg.mint(principal, amount);
        vm.startPrank(principal);
        usdg.approve(address(v), amount);
        v.deposit(IERC20(address(usdg)), amount);
        vm.stopPrank();
    }
}
