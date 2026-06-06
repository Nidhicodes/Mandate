// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";

/// @notice Deploys a demo USDG token we can mint freely for the happy-path trade demo.
///         This is clearly labeled as a demo token — the enforcement logic (the scored part)
///         is identical regardless of which ERC-20 the vault holds.
contract DeployDemoUSDG is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);

        // Deploy demo USDG (6 decimals, matching real USDG)
        MockERC20 usdg = new MockERC20("Demo USDG", "dUSDG", 6);

        // Mint 100k to the deployer for vault funding
        usdg.mint(deployer, 100_000 * 1e6);

        // Also deploy a demo TSLA (18 decimals) the router can mint
        MockERC20 tsla = new MockERC20("Demo TSLA", "dTSLA", 18);

        vm.stopBroadcast();

        console2.log("Demo USDG (dUSDG):", address(usdg));
        console2.log("Demo TSLA (dTSLA):", address(tsla));
        console2.log("Deployer balance: 100,000 dUSDG");
    }
}
