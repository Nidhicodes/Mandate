// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ISwapRouter} from "../../src/ManagedVault.sol";
import {MockERC20} from "./MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Deterministic swap router for tests: pulls `tokenIn` from caller and mints
///         `tokenOut` to the recipient at a configurable rate (default 1:1 by raw units).
/// @dev Mints output so it does not need pre-funded liquidity. `tokenOut` must be a MockERC20.
contract MockSwapRouter is ISwapRouter {
    /// @dev rate in 1e18 fixed point: amountOut = amountIn * rate / 1e18. Default 1:1.
    uint256 public rate = 1e18;

    function setRate(uint256 r) external {
        rate = r;
    }

    function swapExactIn(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient)
        external
        returns (uint256 amountOut)
    {
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        amountOut = (amountIn * rate) / 1e18;
        require(amountOut >= minAmountOut, "slippage");
        MockERC20(tokenOut).mint(recipient, amountOut);
    }
}
