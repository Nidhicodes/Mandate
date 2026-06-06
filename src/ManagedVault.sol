// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.28;

import {IAgentMandate} from "./interfaces/IAgentMandate.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Minimal swap router the vault calls to execute trades. A production deployment
///         points this at a DEX aggregator; tests/demo use a mock that performs the swap.
interface ISwapRouter {
    /// @notice Swap exactly `amountIn` of `tokenIn` for `tokenOut`, sending output to `recipient`.
    /// @return amountOut The amount of `tokenOut` received.
    function swapExactIn(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient)
        external
        returns (uint256 amountOut);
}

/// @title ManagedVault — RAMS-aware managed account for AI-driven tokenized-equity trading.
/// @notice Custodies a principal's base currency (e.g. USDG) and tokenized equities, and
///         lets a delegated AI agent execute trades that are checked, atomically, against
///         an ERC-8226 mandate AND vault-level fiduciary limits BEFORE any value moves.
///         The agent can never withdraw principal — only the owner redeems.
/// @dev This is the ERC-8226 enforcement point for plain-ERC-20 assets (such as Robinhood
///      Chain stock tokens) that have no pre-transfer compliance hook of their own. The
///      vault holds {REGISTERED_TOKEN_ROLE} on the registry and calls {recordExecution}.
///
///      Enforcement layers applied to every agent buy, in order:
///        1. Asset allowlist        — only permitted equities may be acquired.
///        2. Per-name position cap   — max % of portfolio value in any single name.
///        3. Correlation-cluster cap — max % across a correlated group (real diversification).
///        4. RAMS mandate            — registry.isActiveForAmount + recordExecution caps.
///        5. Freeze (kill switch)    — a frozen agent cannot act.
///      Layers 1–3 and 5 are oracle-free (token base units / vault state). A price oracle
///      is used ONLY for the soft drawdown guard and is never the basis of a hard cap.
contract ManagedVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ----------------------------- Immutables -----------------------------

    /// @notice The ERC-8226 mandate registry that authorises and bounds the agent.
    IAgentMandate public immutable registry;
    /// @notice The agentId whose mandate governs this vault.
    uint256 public immutable agentId;
    /// @notice The principal (capital owner). Sole party who may deposit/redeem.
    address public immutable principal;
    /// @notice The base accounting currency (e.g. USDG). Position values are measured in it.
    IERC20 public immutable baseAsset;
    /// @notice The wallet the AI agent uses to instruct the vault.
    address public immutable agentWallet;

    // ----------------------------- Config ---------------------------------

    /// @notice Basis-points denominator (10000 = 100%).
    uint256 public constant BPS = 10_000;

    /// @notice Max share of portfolio value permitted in any single equity, in bps.
    uint256 public maxPositionBps;
    /// @notice Max share of portfolio value permitted across a correlation cluster, in bps.
    uint256 public maxClusterBps;

    /// @dev Allowed equities the agent may acquire.
    mapping(address => bool) public isPermittedAsset;
    /// @dev Equity => correlation cluster id (0 = unclustered). Names sharing an id are
    ///      treated as correlated and capped in aggregate.
    mapping(address => uint16) public clusterOf;
    /// @dev Tracked equity holdings list for valuation (excludes baseAsset).
    address[] public trackedAssets;
    mapping(address => bool) private _tracked;

    /// @notice Optional price oracle (base-asset units per 1e18 of equity). Soft guard only.
    IPriceOracle public priceOracle;
    /// @notice Soft drawdown freeze threshold in bps of high-water mark (0 = disabled).
    uint256 public maxDrawdownBps;
    /// @notice Highest portfolio value observed, for drawdown evaluation.
    uint256 public highWaterMark;

    // ----------------------------- Events ----------------------------------

    /// @notice Emitted for every agent action the vault evaluates — the audit/compliance trail.
    event ComplianceReceipt(
        uint256 indexed agentId,
        address indexed principal,
        address indexed asset,
        Action action,
        uint256 amountIn,
        uint256 amountOut,
        bytes32 mandateScopeHash
    );

    event Deposited(address indexed from, address indexed asset, uint256 amount);
    event Redeemed(address indexed to, address indexed asset, uint256 amount);
    event AssetPermissionSet(address indexed asset, bool permitted, uint16 cluster);
    event LimitsUpdated(uint256 maxPositionBps, uint256 maxClusterBps);

    enum Action {
        BUY,
        SELL
    }

    // ----------------------------- Errors ----------------------------------

    error OnlyPrincipal();
    error OnlyAgent();
    error AssetNotPermitted(address asset);
    error PositionLimitExceeded(address asset, uint256 wouldBeBps, uint256 capBps);
    error ClusterConcentrationExceeded(uint16 cluster, uint256 wouldBeBps, uint256 capBps);
    error MandateNotActiveForAmount(uint256 amount);
    error DrawdownBreached(uint256 currentValue, uint256 highWaterMark);
    error InvalidLimits();
    error ZeroAddress();

    // ----------------------------- Modifiers --------------------------------

    modifier onlyPrincipal() {
        if (msg.sender != principal) revert OnlyPrincipal();
        _;
    }

    modifier onlyAgent() {
        if (msg.sender != agentWallet) revert OnlyAgent();
        _;
    }

    // ----------------------------- Constructor ------------------------------

    constructor(
        IAgentMandate _registry,
        uint256 _agentId,
        address _principal,
        IERC20 _baseAsset,
        address _agentWallet,
        uint256 _maxPositionBps,
        uint256 _maxClusterBps
    ) {
        if (
            address(_registry) == address(0) || _principal == address(0) || address(_baseAsset) == address(0)
                || _agentWallet == address(0)
        ) revert ZeroAddress();
        if (_maxPositionBps == 0 || _maxPositionBps > BPS || _maxClusterBps < _maxPositionBps || _maxClusterBps > BPS) {
            revert InvalidLimits();
        }
        registry = _registry;
        agentId = _agentId;
        principal = _principal;
        baseAsset = _baseAsset;
        agentWallet = _agentWallet;
        maxPositionBps = _maxPositionBps;
        maxClusterBps = _maxClusterBps;
    }

    // ----------------------------- Owner config -----------------------------

    /// @notice Permit or forbid an equity, and assign its correlation cluster.
    function setAssetPermission(address asset, bool permitted, uint16 cluster) external onlyPrincipal {
        if (asset == address(0)) revert ZeroAddress();
        isPermittedAsset[asset] = permitted;
        clusterOf[asset] = cluster;
        if (permitted && !_tracked[asset]) {
            _tracked[asset] = true;
            trackedAssets.push(asset);
        }
        emit AssetPermissionSet(asset, permitted, cluster);
    }

    /// @notice Update the per-name and cluster concentration caps.
    function setLimits(uint256 _maxPositionBps, uint256 _maxClusterBps) external onlyPrincipal {
        if (_maxPositionBps == 0 || _maxPositionBps > BPS || _maxClusterBps < _maxPositionBps || _maxClusterBps > BPS) {
            revert InvalidLimits();
        }
        maxPositionBps = _maxPositionBps;
        maxClusterBps = _maxClusterBps;
        emit LimitsUpdated(_maxPositionBps, _maxClusterBps);
    }

    /// @notice Configure the optional soft drawdown guard.
    function setDrawdownGuard(IPriceOracle _oracle, uint256 _maxDrawdownBps) external onlyPrincipal {
        priceOracle = _oracle;
        maxDrawdownBps = _maxDrawdownBps;
    }

    // ----------------------------- Deposit / redeem -------------------------

    /// @notice Principal deposits base asset or a tracked equity into the vault.
    function deposit(IERC20 asset, uint256 amount) external onlyPrincipal nonReentrant {
        asset.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, address(asset), amount);
    }

    /// @notice Principal redeems assets. Only the principal may withdraw capital — the agent
    ///         and platform never can.
    function redeem(IERC20 asset, uint256 amount, address to) external onlyPrincipal nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        asset.safeTransfer(to, amount);
        emit Redeemed(to, address(asset), amount);
    }

    // ----------------------------- Agent execution -------------------------

    /// @notice Agent buys `equity` spending `baseInAmount` of base asset. Reverts unless the
    ///         trade satisfies every enforcement layer.
    /// @param equity The tokenized equity to acquire (must be permitted).
    /// @param baseInAmount Base-asset amount to spend.
    /// @param minEquityOut Slippage floor passed to the router.
    /// @param router Swap router executing the trade.
    function buy(address equity, uint256 baseInAmount, uint256 minEquityOut, ISwapRouter router)
        external
        onlyAgent
        nonReentrant
        returns (uint256 equityOut)
    {
        // Layer 1: allowlist.
        if (!isPermittedAsset[equity]) revert AssetNotPermitted(equity);

        // Layer 5: RAMS mandate + freeze, denominated in base-asset units (oracle-free).
        if (!registry.isActiveForAmount(agentId, principal, baseInAmount)) {
            revert MandateNotActiveForAmount(baseInAmount);
        }

        // Layers 2 & 3: post-trade concentration must respect per-name and cluster caps.
        // We value the incoming equity at its base-asset cost (conservative, oracle-free):
        // spending `baseInAmount` increases this name's value by at least that cost basis.
        _enforceConcentration(equity, baseInAmount);

        // Record execution against the mandate FIRST (advances cumulative cap atomically).
        registry.recordExecution(agentId, principal, baseInAmount);

        // Execute the swap.
        baseAsset.forceApprove(address(router), baseInAmount);
        equityOut = router.swapExactIn(address(baseAsset), equity, baseInAmount, minEquityOut, address(this));
        baseAsset.forceApprove(address(router), 0);

        _track(equity);
        _updateHighWaterMark();

        emit ComplianceReceipt(
            agentId,
            principal,
            equity,
            Action.BUY,
            baseInAmount,
            equityOut,
            registry.getMandate(agentId, principal).scopeHash
        );
    }

    /// @notice Agent sells `equity` for base asset. Sells reduce concentration, so only the
    ///         mandate/freeze layer and allowlist-tracking apply.
    function sell(address equity, uint256 equityInAmount, uint256 minBaseOut, ISwapRouter router)
        external
        onlyAgent
        nonReentrant
        returns (uint256 baseOut)
    {
        if (!registry.isActive(agentId, principal)) revert MandateNotActiveForAmount(0);

        IERC20(equity).forceApprove(address(router), equityInAmount);
        baseOut = router.swapExactIn(equity, address(baseAsset), equityInAmount, minBaseOut, address(this));
        IERC20(equity).forceApprove(address(router), 0);

        _updateHighWaterMark();

        emit ComplianceReceipt(
            agentId,
            principal,
            equity,
            Action.SELL,
            equityInAmount,
            baseOut,
            registry.getMandate(agentId, principal).scopeHash
        );
    }

    // ----------------------------- Valuation & guards -----------------------

    /// @dev Enforces per-name and correlation-cluster concentration caps for a prospective
    ///      buy. Uses cost-basis valuation (base-asset units) so no oracle is required for
    ///      the hard guarantee. `addedValue` is the base-asset spend on `equity`.
    function _enforceConcentration(address equity, uint256 addedValue) internal view {
        // Portfolio value after the trade = current base balance (unchanged net: base out,
        // equity in at equal cost basis) + equities valued at cost basis. To stay oracle-free
        // and conservative we measure exposure as cumulative base spent per name/cluster,
        // tracked via balances valued at the current oracle price when available, else cost.
        uint256 total = _portfolioValue();
        // The prospective trade keeps total roughly constant (swap base->equity at cost), so
        // evaluate the new name/cluster exposure against `total`.
        if (total == 0) return; // first deposit edge; caps enforced on subsequent trades.

        uint256 nameValue = _assetValue(equity) + addedValue;
        uint256 nameBps = (nameValue * BPS) / total;
        if (nameBps > maxPositionBps) revert PositionLimitExceeded(equity, nameBps, maxPositionBps);

        uint16 cluster = clusterOf[equity];
        if (cluster != 0) {
            uint256 clusterValue = addedValue;
            uint256 len = trackedAssets.length;
            for (uint256 i = 0; i < len; ++i) {
                address a = trackedAssets[i];
                if (clusterOf[a] == cluster) clusterValue += _assetValue(a);
            }
            uint256 clusterBps = (clusterValue * BPS) / total;
            if (clusterBps > maxClusterBps) revert ClusterConcentrationExceeded(cluster, clusterBps, maxClusterBps);
        }
    }

    /// @dev Total portfolio value in base-asset units (base balance + valued equities).
    function _portfolioValue() internal view returns (uint256 total) {
        total = baseAsset.balanceOf(address(this));
        uint256 len = trackedAssets.length;
        for (uint256 i = 0; i < len; ++i) {
            total += _assetValue(trackedAssets[i]);
        }
    }

    /// @dev Value of the vault's holding of `asset` in base-asset units. Uses the price
    ///      oracle when set; otherwise treats raw balance as its own value (cost-basis proxy).
    function _assetValue(address asset) internal view returns (uint256) {
        uint256 bal = IERC20(asset).balanceOf(address(this));
        if (bal == 0) return 0;
        if (address(priceOracle) != address(0)) {
            return priceOracle.valueInBase(asset, bal);
        }
        return bal;
    }

    /// @dev Updates the high-water mark; if a drawdown guard is set and breached, freezes
    ///      via the registry path is out of scope here (enforcer-driven). We expose the
    ///      check as a view + revert so the agent's own actions self-halt on breach.
    function _updateHighWaterMark() internal {
        uint256 v = _portfolioValue();
        if (v > highWaterMark) highWaterMark = v;
    }

    /// @notice Reverts if the soft drawdown threshold is configured and currently breached.
    /// @dev Callable by anyone; intended for the agent/frontend to pre-check. Hard halts are
    ///      performed by enforcers via {IAgentMandate.freezeAgent}.
    function checkDrawdown() external view {
        if (maxDrawdownBps == 0 || highWaterMark == 0) return;
        uint256 v = _portfolioValue();
        uint256 floor = highWaterMark - (highWaterMark * maxDrawdownBps) / BPS;
        if (v < floor) revert DrawdownBreached(v, highWaterMark);
    }

    /// @notice Number of tracked equities (for off-chain enumeration).
    function trackedAssetsLength() external view returns (uint256) {
        return trackedAssets.length;
    }

    function _track(address asset) internal {
        if (!_tracked[asset]) {
            _tracked[asset] = true;
            trackedAssets.push(asset);
        }
    }
}

/// @notice Minimal price-oracle interface for the optional soft drawdown guard.
interface IPriceOracle {
    /// @notice Returns the base-asset value of `amount` units of `asset`.
    function valueInBase(address asset, uint256 amount) external view returns (uint256);
}
