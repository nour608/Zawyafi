// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ICurrencyManager} from "../interfaces/ICurrencyManager.sol";
import {UnitToken} from "../tokens/UnitToken.sol";
import {InventoryTypes} from "../types/InventoryTypes.sol";
import {IProductBatchFactory} from "../interfaces/IProductBatchFactory.sol";

contract ProductBatchFactory is AccessControl, Pausable, ReentrancyGuard, IProductBatchFactory {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    uint256 public constant UNIT = 1e18;
    uint16 public constant BPS_DENOMINATOR = 10_000;
    uint8 public constant MAX_CATEGORIES = 3;

    ICurrencyManager public immutable currencyManager;
    address public compliance;
    address public settlementVault;

    uint256 public nextBatchId;
    mapping(uint256 => InventoryTypes.Batch) private _batches;
    mapping(uint256 => bytes32[]) private _batchCategoryHashes;
    mapping(uint256 => mapping(bytes32 => InventoryTypes.CategoryState)) private _categoryStates;

    constructor(address currencyManager_, address compliance_, address admin_) {
        require(currencyManager_ != address(0), "ProductBatchFactory: invalid currency manager");
        require(compliance_ != address(0), "ProductBatchFactory: invalid compliance");
        require(admin_ != address(0), "ProductBatchFactory: invalid admin");

        currencyManager = ICurrencyManager(currencyManager_);
        compliance = compliance_;
        nextBatchId = 1;

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ADMIN_ROLE, admin_);
    }

    function createBatch(
        bytes32 merchantIdHash,
        InventoryTypes.CategoryConfigInput[] calldata categories,
        address purchaseToken,
        uint16 profitBps,
        string calldata tokenName,
        string calldata tokenSymbol,
        address issuer,
        address founder
    ) external whenNotPaused returns (uint256 batchId) {
        require(settlementVault != address(0), "ProductBatchFactory: settlement vault not set");
        require(merchantIdHash != bytes32(0), "ProductBatchFactory: invalid merchant");
        require(founder != address(0), "ProductBatchFactory: invalid founder");
        require(
            currencyManager.isCurrencyWhitelisted(purchaseToken), "ProductBatchFactory: purchase token not whitelisted"
        );
        require(profitBps > 0 && profitBps <= BPS_DENOMINATOR, "ProductBatchFactory: invalid profit bps");
        require(categories.length > 0 && categories.length <= MAX_CATEGORIES, "ProductBatchFactory: invalid categories");

        UnitToken token =
            new UnitToken(tokenName, tokenSymbol, compliance, address(this), settlementVault, address(this));

        batchId = nextBatchId;
        nextBatchId++;

        InventoryTypes.Batch storage batch = _batches[batchId];
        batch.id = batchId;
        batch.merchantIdHash = merchantIdHash;
        batch.issuer = issuer;
        batch.founder = founder;
        batch.purchaseToken = purchaseToken;
        batch.unitToken = address(token);
        batch.profitBps = profitBps;
        batch.active = true;

        uint256 totalUnitsForSale = 0;
        for (uint256 i = 0; i < categories.length; i++) {
            InventoryTypes.CategoryConfigInput calldata category = categories[i];
            require(category.categoryIdHash != bytes32(0), "ProductBatchFactory: invalid category");
            require(category.unitsForSale > 0, "ProductBatchFactory: invalid category units");
            require(category.unitCost > 0, "ProductBatchFactory: invalid category unit cost");
            require(
                !_categoryStates[batchId][category.categoryIdHash].tokenized, "ProductBatchFactory: duplicate category"
            );

            _categoryStates[batchId][category.categoryIdHash] = InventoryTypes.CategoryState({
                categoryIdHash: category.categoryIdHash,
                unitsForSale: category.unitsForSale,
                unitsSold: 0,
                unitCost: category.unitCost,
                principalSold: 0,
                tokenized: true
            });

            _batchCategoryHashes[batchId].push(category.categoryIdHash);
            totalUnitsForSale += category.unitsForSale;

            emit BatchCategoryConfigured(batchId, category.categoryIdHash, category.unitsForSale, category.unitCost);
        }

        batch.totalUnitsForSale = totalUnitsForSale;

        emit BatchCreated(batchId, merchantIdHash, address(token), profitBps);
    }

    function buyUnits(uint256 batchId, bytes32 categoryIdHash, uint256 units) external whenNotPaused nonReentrant {
        InventoryTypes.Batch storage batch = _batches[batchId];
        require(batch.id != 0, "ProductBatchFactory: unknown batch");
        require(batch.active, "ProductBatchFactory: batch inactive");
        require(!batch.closed, "ProductBatchFactory: batch closed");
        require(units > 0, "ProductBatchFactory: invalid units");

        InventoryTypes.CategoryState storage category = _categoryStates[batchId][categoryIdHash];
        require(category.tokenized, "ProductBatchFactory: category not tokenized");

        uint256 remaining = category.unitsForSale - category.unitsSold;
        require(units <= remaining, "ProductBatchFactory: not enough category units");

        uint256 cost = units * category.unitCost;
        category.unitsSold += units;
        category.principalSold += cost;

        batch.totalUnitsSold += units;
        batch.principalSoldTotal += cost;
        batch.targetPayoutTotal = _computeTargetPayout(batch.principalSoldTotal, batch.profitBps);

        if (batch.totalUnitsSold == batch.totalUnitsForSale) {
            batch.closed = true;
            batch.active = false;
            emit BatchClosed(batchId, address(this));
        }

        IERC20(batch.purchaseToken).safeTransferFrom(msg.sender, address(this), cost);
        UnitToken(batch.unitToken).mint(msg.sender, cost * UNIT);

        emit UnitsPurchased(batchId, categoryIdHash, msg.sender, units, cost);
    }

    function withdrawProceeds(uint256 batchId, uint256 amount, address to) external nonReentrant {
        InventoryTypes.Batch storage batch = _batches[batchId];
        require(batch.id != 0, "ProductBatchFactory: unknown batch");
        require(to != address(0), "ProductBatchFactory: invalid recipient");
        require(amount > 0, "ProductBatchFactory: invalid amount");
        require(
            msg.sender == batch.founder || msg.sender == batch.issuer || hasRole(ADMIN_ROLE, msg.sender),
            "ProductBatchFactory: not authorized"
        );

        uint256 available = batch.principalSoldTotal - batch.proceedsWithdrawn;
        require(amount <= available, "ProductBatchFactory: insufficient withdrawable proceeds");

        batch.proceedsWithdrawn += amount;
        IERC20(batch.purchaseToken).safeTransfer(to, amount);
        emit ProceedsWithdrawn(batchId, to, amount, msg.sender);
    }

    function closeBatch(uint256 batchId) external onlyRole(ADMIN_ROLE) {
        InventoryTypes.Batch storage batch = _batches[batchId];
        require(batch.id != 0, "ProductBatchFactory: unknown batch");
        require(!batch.closed, "ProductBatchFactory: batch already closed");

        batch.closed = true;
        batch.active = false;
        emit BatchClosed(batchId, msg.sender);
    }

    function setBatchActive(uint256 batchId, bool active) external onlyRole(ADMIN_ROLE) {
        InventoryTypes.Batch storage batch = _batches[batchId];
        require(batch.id != 0, "ProductBatchFactory: unknown batch");
        if (active) {
            require(!batch.closed, "ProductBatchFactory: batch closed");
        }

        batch.active = active;
        emit BatchStatusUpdated(batchId, active);
    }

    function setSettlementVault(address settlementVault_) external onlyRole(ADMIN_ROLE) {
        require(settlementVault_ != address(0), "ProductBatchFactory: invalid vault");
        require(nextBatchId == 1, "ProductBatchFactory: vault already locked");

        settlementVault = settlementVault_;
        emit SettlementVaultUpdated(settlementVault_);
    }

    function setCompliance(address compliance_) external onlyRole(ADMIN_ROLE) {
        require(compliance_ != address(0), "ProductBatchFactory: invalid compliance");
        compliance = compliance_;
        emit ComplianceUpdated(compliance_);
    }

    function getBatchCategoryHashes(uint256 batchId) external view returns (bytes32[] memory) {
        return _batchCategoryHashes[batchId];
    }

    function getCategoryState(uint256 batchId, bytes32 categoryIdHash)
        external
        view
        returns (InventoryTypes.CategoryState memory)
    {
        return _categoryStates[batchId][categoryIdHash];
    }

    function isCategoryTokenized(uint256 batchId, bytes32 categoryIdHash) external view returns (bool) {
        return _categoryStates[batchId][categoryIdHash].tokenized;
    }

    function isBatchClosed(uint256 batchId) external view returns (bool) {
        return _batches[batchId].closed;
    }

    function recordSettledRevenue(bytes32 periodId, uint256 batchId, bytes32 categoryIdHash, uint256 settledAmount)
        external
    {
        require(msg.sender == settlementVault, "ProductBatchFactory: only settlement vault");
        require(_batches[batchId].id != 0, "ProductBatchFactory: unknown batch");
        require(_categoryStates[batchId][categoryIdHash].tokenized, "ProductBatchFactory: category not tokenized");

        if (settledAmount == 0) {
            return;
        }

        InventoryTypes.Batch storage batch = _batches[batchId];
        batch.settledRevenueTotal += settledAmount;
        emit SettledRevenueRecorded(batchId, periodId, categoryIdHash, settledAmount, batch.settledRevenueTotal);
    }

    function getBatch(uint256 batchId) external view returns (InventoryTypes.Batch memory) {
        return _batches[batchId];
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function _computeTargetPayout(uint256 principalSold, uint16 profitBps) internal pure returns (uint256) {
        if (principalSold == 0) {
            return 0;
        }
        uint256 profit = (principalSold * profitBps + BPS_DENOMINATOR - 1) / BPS_DENOMINATOR;
        return principalSold + profit;
    }
}
