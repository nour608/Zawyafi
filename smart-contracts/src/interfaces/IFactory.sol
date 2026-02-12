// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {DataTypes} from "../types/DataTypes.sol";

interface IFactory {
    event ProjectCreated(
        uint256 indexed projectId,
        address indexed founder,
        address issuer,
        string name,
        string symbol,
        address equityToken,
        address purchaseToken,
        uint256 valuationUSD,
        uint256 totalShares
    );
    event SharesPurchased(uint256 indexed projectId, address indexed buyer, uint256 shares, uint256 amountPaid);
    event FundsWithdrawn(uint256 indexed projectId, uint256 amount, address to, address from);
    event ProjectVerified(uint256 indexed projectId, bool verified);
    event ProjectExists(uint256 indexed projectId, bool exists);
    event SecondaryMarketEnabled(uint256 indexed projectId, address indexed orderBook, uint256 tradingFeeRate);
    event FeesWithdrawn(address indexed to, address indexed token, uint256 amount);

    function createProject(
        uint256 valuationUSD,
        uint256 sharesToSell,
        address _purchaseToken,
        string memory _name,
        string memory _symbol,
        address _issuer,
        address founder
    ) external returns (uint256 projectId);

    function buyShares(uint256 projectId, uint256 sharesAmount) external;

    function withdrawFunds(uint256 projectId, uint256 amount, address to) external;

    function projectCount() external view returns (uint256);

    function projectExists(uint256 projectId) external view returns (bool);

    function getProject(uint256 projectId) external view returns (DataTypes.Project memory);

    function pauseProject(uint256 projectId) external;

    function unpauseProject(uint256 projectId) external;

    function isProjectPaused(uint256 projectId) external view returns (bool);

    function pause() external;

    function unpause() external;

    function withdrawFees(address to, address token, uint256 amount) external;

    function setPlatformFee(uint256 _platformFee) external;

    function setProjectVerified(uint256 projectId, bool _verified) external;

    function setProjectExists(uint256 projectId, bool _exists) external;
}
