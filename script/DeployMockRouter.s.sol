// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {MockSwapRouter} from "../test/mocks/MockSwapRouter.sol";

/// @notice Deploys a MockSwapRouter to Robinhood Chain testnet for the demo happy path.
/// @dev The mock router pulls tokenIn from the vault and mints tokenOut. For the demo,
///      we pre-fund it with stock tokens (or it can mint MockERC20s). On a real deployment
///      this would be a DEX aggregator address.
contract DeployMockRouter is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        vm.startBroadcast(pk);
        MockSwapRouter router = new MockSwapRouter();
        vm.stopBroadcast();
        console2.log("MockSwapRouter:", address(router));
    }
}
