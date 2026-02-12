// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {DataTypes} from "../types/DataTypes.sol";
import {IdentityRegistry} from "../registry/IdentityRegistry.sol";
import {ICurrencyManager} from "../interfaces/ICurrencyManager.sol";
import {IFactory} from "../interfaces/IFactory.sol";
import {EquityToken} from "../tokens/EquityToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract Factory is AccessControl, ReentrancyGuard, Pausable, DataTypes, IFactory {
    using SafeERC20 for IERC20;

    IdentityRegistry public identityRegistry;
    ICurrencyManager public currencyManager;
    mapping(uint256 => Project) public projects;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // Counter for project IDs
    uint256 public projectCounter;

    uint256 public constant TOTAL_SHARES = 1_000_000 * 1e18; // 100% of the total shares
    uint256 public constant BASIS_POINTS = 10_000; // 10_000 is 100%
    uint256 public PLATFORM_FEE; // (e.g., 500 = 5%)

    address public compliance;

    modifier onlyFactoryAdmin() {
        _onlyFactoryAdmin();
        _;
    }

    modifier onlyProjectFounder(uint256 projectId) {
        _onlyProjectFounder(projectId);
        _;
    }

    modifier onlyProjectFounderOrAdmin(uint256 projectId) {
        _onlyProjectFounderOrAdmin(projectId);
        _;
    }

    constructor(address _userRegistry, address _currencyManager, uint256 _platformFee) {
        currencyManager = ICurrencyManager(_currencyManager);
        identityRegistry = IdentityRegistry(_userRegistry);
        PLATFORM_FEE = _platformFee;
        projectCounter = 1;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    /// @notice Create a new tokenized project
    /// @param valuationUSD Total valuation in USD (no decimals)
    /// @param sharesToSell Number of shares to issue (whole units)
    /// @param _purchaseToken Address of ERC20 stablecoin (e.g. USDC)
    function createProject(
        uint256 valuationUSD,
        uint256 sharesToSell,
        address _purchaseToken,
        string memory _name,
        string memory _symbol,
        address _issuer,
        address founder
    ) external whenNotPaused returns (uint256 projectId) {
        require(valuationUSD > 0, "Valuation must be greater than 0");
        require(sharesToSell > 0, "Shares must be greater than 0");
        require(sharesToSell <= TOTAL_SHARES, "Shares must be less than or equal to total shares");
        require(currencyManager.isCurrencyWhitelisted(_purchaseToken), "Purchase token not whitelisted");

        // platform fee is a percentage of the shares to sell
        uint256 platformFee = (sharesToSell * PLATFORM_FEE) / BASIS_POINTS;

        // Deploy new ERC20 token for this project
        EquityToken token = new EquityToken(
            string(abi.encodePacked(_name, " Equity Token")),
            _symbol,
            msg.sender,
            address(this),
            sharesToSell,
            platformFee,
            compliance
        );

        // Get next project ID
        projectId = projectCounter;
        projectCounter++;

        // Initialize project struct
        projects[projectId] = Project({
            name: _name,
            equityToken: address(token),
            purchaseToken: _purchaseToken,
            valuationUSD: valuationUSD,
            totalShares: TOTAL_SHARES,
            availableSharesToSell: sharesToSell - platformFee,
            sharesSold: 0,
            pricePerShare: (valuationUSD * (10 ** IERC20Metadata(_purchaseToken).decimals())) / TOTAL_SHARES,
            availableFunds: 0,
            issuer: _issuer,
            founder: founder,
            exists: true,
            verified: false,
            secondaryMarketEnabled: false
        });

        emit ProjectCreated(
            projectId, msg.sender, _issuer, _name, _symbol, address(token), _purchaseToken, valuationUSD, TOTAL_SHARES
        );
    }

    /// @notice Buy shares in a given project
    /// @param projectId ID of the project
    /// @param sharesAmount Number of shares to buy
    function buyShares(uint256 projectId, uint256 sharesAmount) external whenNotPaused {
        Project storage p = projects[projectId];
        require(p.exists, "Project does not exist");
        require(sharesAmount > 0, "Must buy at least 1 share");
        require(sharesAmount <= p.availableSharesToSell, "Not enough shares to sell"); // check if the project has enough shares to sell

        uint256 cost = (sharesAmount * p.pricePerShare) / 1e18;
        uint256 tokensToMint = sharesAmount; // Equity tokens have 18 decimals

        p.availableSharesToSell -= sharesAmount;
        p.sharesSold += sharesAmount;
        p.availableFunds += cost;

        // Pull stablecoins from buyer
        IERC20(p.purchaseToken).safeTransferFrom(msg.sender, address(this), cost);
        // Mint equity tokens to buyer
        EquityToken(p.equityToken).mint(msg.sender, tokensToMint);

        emit SharesPurchased(projectId, msg.sender, tokensToMint, cost);
    }

    /// @notice Developer withdraws all raised funds for their project
    /// @param projectId ID of the project
    function withdrawFunds(uint256 projectId, uint256 amount, address to) external nonReentrant {
        Project storage p = projects[projectId];
        require(p.exists, "Project does not exist");
        require(p.verified, "Project not verified");
        require(
            msg.sender == p.founder || msg.sender == p.issuer || hasRole(ADMIN_ROLE, msg.sender)
                || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Not authorized to withdraw"
        );
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= p.availableFunds, "Not enough funds to withdraw");

        p.availableFunds -= amount;
        IERC20(p.purchaseToken).safeTransfer(to, amount);

        emit FundsWithdrawn(projectId, amount, to, msg.sender);
    }

    // TODO: dividend distribution logic (e.g., snapshot + pro-rata payouts)
    // TODO: governance/voting integration (e.g., ERC20Votes)

    /// @notice Get number of projects created
    function projectCount() external view returns (uint256) {
        return projectCounter;
    }

    /// @notice Check if a project exists
    /// @param projectId ID of the project
    function projectExists(uint256 projectId) external view returns (bool) {
        return projects[projectId].exists;
    }

    function getProject(uint256 projectId) external view returns (Project memory) {
        return projects[projectId];
    }

    /*///////////////////////////////////////////////
                  Pause functions
    ///////////////////////////////////////////////*/

    /// @notice Pause a project's equity token (admin only)
    /// @param projectId Project ID to pause
    function pauseProject(uint256 projectId) external onlyRole(ADMIN_ROLE) {
        Project storage project = projects[projectId];
        require(project.exists, "Project does not exist");

        EquityToken token = EquityToken(project.equityToken);
        token.pause();
    }

    /// @notice Unpause a project's equity token (admin only)
    /// @param projectId Project ID to unpause
    function unpauseProject(uint256 projectId) external onlyRole(ADMIN_ROLE) {
        Project storage project = projects[projectId];
        require(project.exists, "Project does not exist");

        EquityToken token = EquityToken(project.equityToken);
        token.unpause();
    }

    /// @notice Check if a project is paused
    /// @param projectId Project ID to check
    /// @return True if paused
    function isProjectPaused(uint256 projectId) public view returns (bool) {
        Project storage project = projects[projectId];
        require(project.exists, "Project does not exist");

        EquityToken token = EquityToken(project.equityToken);
        return token.paused();
    }

    /// @notice Pause the factory
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /// @notice Unpause the factory
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /*///////////////////////////////////////////////
                  Admin functions
    ///////////////////////////////////////////////*/

    function withdrawFees(address to, address token, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(amount > 0, "Amount must be greater than 0");
        require(token != address(0), "Invalid token address");
        if (to == address(0)) {
            to = msg.sender;
            IERC20(token).safeTransfer(to, amount);
            emit FeesWithdrawn(to, token, amount);
        } else {
            IERC20(token).safeTransfer(to, amount);
            emit FeesWithdrawn(to, token, amount);
        }
    }

    function setPlatformFee(uint256 _platformFee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        PLATFORM_FEE = _platformFee;
    }

    function setProjectVerified(uint256 projectId, bool _verified) external onlyRole(DEFAULT_ADMIN_ROLE) {
        projects[projectId].verified = _verified;
        emit ProjectVerified(projectId, _verified);
    }

    function setProjectExists(uint256 projectId, bool _exists) external onlyRole(DEFAULT_ADMIN_ROLE) {
        projects[projectId].exists = _exists;
        emit ProjectExists(projectId, _exists);
    }

    /*///////////////////////////////////////////////
                  Internal functions
    ///////////////////////////////////////////////*/

    function _onlyFactoryAdmin() internal view {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Only factory admin can call this function"
        );
    }

    function _onlyProjectFounder(uint256 projectId) internal view {
        require(projects[projectId].founder == msg.sender, "Only project founder can call this function");
    }

    function _onlyProjectFounderOrAdmin(uint256 projectId) internal view {
        require(
            projects[projectId].founder == msg.sender || hasRole(ADMIN_ROLE, msg.sender)
                || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Only project founder or admin can call this function"
        );
    }
}
