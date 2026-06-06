// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {MandateRegistry} from "../src/MandateRegistry.sol";
import {ComplianceProvider} from "../src/ComplianceProvider.sol";
import {ManagedVault} from "../src/ManagedVault.sol";
import {IAgentMandate} from "../src/interfaces/IAgentMandate.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Deploys the ERC-8226 stack to Robinhood Chain testnet and wires a demo vault
///         over the real USDG + tokenized-equity addresses.
/// @dev Run with:
///      forge script script/Deploy.s.sol --rpc-url $ROBINHOOD_TESTNET_RPC \
///        --private-key $DEPLOYER_PK --broadcast
contract Deploy is Script {
    // Robinhood Chain testnet token addresses (docs.robinhood.com/chain/contracts).
    address constant USDG = 0x7E955252E15c84f5768B83c41a71F9eba181802F;
    address constant TSLA = 0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E;
    address constant AMZN = 0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02;
    address constant PLTR = 0x1FBE1a0e43594b3455993B5dE5Fd0A7A266298d0;
    address constant NFLX = 0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93;
    address constant AMD = 0x71178BAc73cBeb415514eB542a8995b82669778d;

    uint16 constant TECH_CLUSTER = 1;
    bytes32 constant JURIS_US = keccak256("US");

    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PK");
        address deployer = vm.addr(deployerPk);

        // Separate admin and enforcer addresses (admin MUST NOT be an enforcer).
        address regulator = vm.envOr("REGULATOR_ADDRESS", deployer);
        address agentWallet = vm.envAddress("AGENT_WALLET");
        uint256 agentId = vm.envOr("AGENT_ID", uint256(1));

        vm.startBroadcast(deployerPk);

        // 1. Compliance provider (deployer is the initial compliance officer).
        ComplianceProvider compliance = new ComplianceProvider(deployer);

        // 2. Mandate registry.
        MandateRegistry registry = new MandateRegistry(deployer);

        // 3. Wire enforcer roles. Regulator gets REGULATORY tier (kill switch).
        //    If regulator == deployer (admin), the self-escalation guard would revert, so
        //    only grant when distinct.
        if (regulator != deployer) {
            registry.grantRole(registry.REGULATORY_ENFORCER_ROLE(), regulator);
        }

        // 4. Deploy a demo vault: USDG base, 30% per-name cap, 60% cluster cap.
        // Using deployer as agentWallet for simplicity (same key controls both roles in demo).
        ManagedVault vault = new ManagedVault(registry, agentId, deployer, IERC20(USDG), deployer, 3_000, 6_000);

        // 5. Authorise the vault to record asset-class executions.
        registry.grantRole(registry.REGISTERED_TOKEN_ROLE(), address(vault));

        // 6. Configure the vault allowlist + tech correlation cluster.
        vault.setAssetPermission(TSLA, true, TECH_CLUSTER);
        vault.setAssetPermission(AMZN, true, TECH_CLUSTER);
        vault.setAssetPermission(PLTR, true, TECH_CLUSTER);
        vault.setAssetPermission(AMD, true, TECH_CLUSTER);
        // NFLX left unpermitted to demo the AssetNotPermitted revert.

        vm.stopBroadcast();

        console2.log("ComplianceProvider:", address(compliance));
        console2.log("MandateRegistry:   ", address(registry));
        console2.log("ManagedVault:      ", address(vault));
        console2.log("Deployer/admin:    ", deployer);
        console2.log("Regulator:         ", regulator);
        console2.log("Agent wallet:      ", agentWallet);
        console2.log("Agent id:          ", agentId);
    }
}
