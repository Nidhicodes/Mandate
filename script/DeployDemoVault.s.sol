// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {MandateRegistry} from "../src/MandateRegistry.sol";
import {ComplianceProvider} from "../src/ComplianceProvider.sol";
import {ManagedVault} from "../src/ManagedVault.sol";
import {IAgentMandate} from "../src/interfaces/IAgentMandate.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Deploys a demo vault with mintable tokens, funds it, configures it, and grants
///         the mandate — all in one script. Result: a fully-operational demo vault ready
///         for the happy-path trade.
contract DeployDemoVault is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        address deployer = vm.addr(pk);

        // Existing registry + compliance from previous deploy
        MandateRegistry registry = MandateRegistry(0xc6d4A15CcCd924a66F959684E3D370e6B9dc8B2c);
        ComplianceProvider compliance = ComplianceProvider(0x4A465D355E6913BBC071388D0E0808160F60c02F);

        vm.startBroadcast(pk);

        // 1. Deploy demo tokens
        MockERC20 usdg = new MockERC20("Demo USDG", "dUSDG", 6);
        MockERC20 tsla = new MockERC20("Demo TSLA", "dTSLA", 18);
        MockERC20 amzn = new MockERC20("Demo AMZN", "dAMZN", 18);

        // 2. Mint to deployer
        usdg.mint(deployer, 100_000e6); // 100k USDG
        tsla.mint(address(1), 1); // router will mint on swaps

        // 3. Deploy vault: demo USDG base, 30%/60% caps, deployer is agent
        ManagedVault vault = new ManagedVault(
            registry, 2, deployer, IERC20(address(usdg)), deployer, 3_000, 6_000
        );

        // 4. Register vault with the registry for recordExecution
        registry.grantRole(registry.REGISTERED_TOKEN_ROLE(), address(vault));

        // 5. Configure permitted assets
        vault.setAssetPermission(address(tsla), true, 1); // cluster 1 = tech
        vault.setAssetPermission(address(amzn), true, 1);
        // NFLX intentionally absent

        // 6. Grant compliance eligibility for the new scope
        bytes32 scopeHash = keccak256("demo-equity-scope-v2");
        bytes32 identityRef = keccak256("did:example:demo-v2");
        compliance.grantPrincipal(deployer, identityRef, scopeHash);

        // 7. Grant mandate: agentId=2, 40k per-tx, 90k cumulative, 30 days
        registry.grantMandate(
            2,
            deployer,
            identityRef,
            scopeHash,
            IAgentMandate.MandateScopeParams({
                maxTransactionValue: 40_000e6,
                maxCumulativeValue: 90_000e6,
                assetAddress: address(0),
                jurisdictionHash: keccak256("US")
            }),
            address(compliance),
            uint48(block.timestamp),
            uint48(block.timestamp + 30 days),
            ""
        );

        // 8. Fund the vault with 100k USDG
        usdg.approve(address(vault), 100_000e6);
        vault.deposit(IERC20(address(usdg)), 100_000e6);

        // 9. Deploy a mock swap router that mints dTSLA on swap
        MockSwapRouterWithMint router = new MockSwapRouterWithMint(address(tsla));

        vm.stopBroadcast();

        console2.log("=== DEMO VAULT (v2) ===");
        console2.log("Demo USDG:    ", address(usdg));
        console2.log("Demo TSLA:    ", address(tsla));
        console2.log("Demo AMZN:    ", address(amzn));
        console2.log("Vault:        ", address(vault));
        console2.log("Router:       ", address(router));
        console2.log("Agent ID:      2");
        console2.log("Vault USDG:    100,000");
        console2.log("Mandate:       ACTIVE");
    }
}

/// @notice A swap router that mints the output token (for demo purposes).
contract MockSwapRouterWithMint {
    address public outputToken;

    constructor(address _outputToken) {
        outputToken = _outputToken;
    }

    function swapExactIn(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient)
        external
        returns (uint256 amountOut)
    {
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        amountOut = amountIn; // 1:1 for demo
        if (amountOut < minAmountOut) revert("slippage");
        MockERC20(tokenOut).mint(recipient, amountOut);
    }
}
