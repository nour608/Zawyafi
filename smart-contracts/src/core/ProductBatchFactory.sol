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

    ICurrencyManager public immutable currencyManager;
    address public compliance;
    address public settlementVault;

    uint256 public nextBatchId;
    mapping(uint256 => InventoryTypes.Batch) private _batches;

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
        bytes32 merchantIdHash, // unique identifier for the merchant (comes from offchain)
        bytes32 productIdHash,
        address purchaseToken,
        uint256 unitCost,
        uint256 unitPayout,
        uint256 unitsForSale,
        string calldata tokenName,
        string calldata tokenSymbol,
        address issuer,
        address founder
    ) external whenNotPaused returns (uint256 batchId) {
        require(settlementVault != address(0), "ProductBatchFactory: settlement vault not set");
        require(merchantIdHash != bytes32(0), "ProductBatchFactory: invalid merchant");
        require(productIdHash != bytes32(0), "ProductBatchFactory: invalid product");
        require(founder != address(0), "ProductBatchFactory: invalid founder");
        require(
            currencyManager.isCurrencyWhitelisted(purchaseToken), "ProductBatchFactory: purchase token not whitelisted"
        );
        require(unitCost > 0, "ProductBatchFactory: invalid unit cost");
        require(unitPayout >= unitCost, "ProductBatchFactory: payout must be >= cost");
        require(unitsForSale > 0, "ProductBatchFactory: invalid units");

        UnitToken token =
            new UnitToken(tokenName, tokenSymbol, compliance, address(this), settlementVault, address(this));

        batchId = nextBatchId;
        nextBatchId++;

        _batches[batchId] = InventoryTypes.Batch({
            id: batchId,
            merchantIdHash: merchantIdHash,
            productIdHash: productIdHash,
            issuer: issuer,
            founder: founder,
            purchaseToken: purchaseToken,
            unitToken: address(token),
            unitCost: unitCost,
            unitPayout: unitPayout,
            unitsForSale: unitsForSale,
            unitsSoldToInvestors: 0,
            fundsRaised: 0,
            active: true
        });

        emit BatchCreated(batchId, merchantIdHash, productIdHash, address(token));
    }

    function buyUnits(uint256 batchId, uint256 units) external whenNotPaused nonReentrant {
        InventoryTypes.Batch storage batch = _batches[batchId];
        require(batch.id != 0, "ProductBatchFactory: unknown batch");
        require(batch.active, "ProductBatchFactory: batch inactive");
        require(units > 0, "ProductBatchFactory: invalid units");

        uint256 remaining = batch.unitsForSale - batch.unitsSoldToInvestors;
        require(units <= remaining, "ProductBatchFactory: not enough units");

        uint256 cost = units * batch.unitCost;
        batch.unitsSoldToInvestors += units;
        batch.fundsRaised += cost;

        IERC20(batch.purchaseToken).safeTransferFrom(msg.sender, address(this), cost);
        UnitToken(batch.unitToken).mint(msg.sender, units * UNIT);

        emit UnitsPurchased(batchId, msg.sender, units, cost);
    }

    function withdrawProceeds(uint256 batchId, uint256 amount, address to) external nonReentrant {
        InventoryTypes.Batch storage batch = _batches[batchId];
        require(batch.id != 0, "ProductBatchFactory: unknown batch");
        require(to != address(0), "ProductBatchFactory: invalid recipient");
        require(amount > 0, "ProductBatchFactory: invalid amount");
        require(amount <= batch.fundsRaised, "ProductBatchFactory: insufficient funds");
        require(
            msg.sender == batch.founder || msg.sender == batch.issuer || hasRole(ADMIN_ROLE, msg.sender),
            "ProductBatchFactory: not authorized"
        );

        batch.fundsRaised -= amount;
        IERC20(batch.purchaseToken).safeTransfer(to, amount);
        emit ProceedsWithdrawn(batchId, to, amount, msg.sender);
    }

    function getBatch(uint256 batchId) external view returns (InventoryTypes.Batch memory) {
        return _batches[batchId];
    }

    ////////////////////////////////
    /////// ADMIN FUNCTIONS////////
    //////////////////////////////
    function setBatchActive(uint256 batchId, bool active) external onlyRole(ADMIN_ROLE) {
        InventoryTypes.Batch storage batch = _batches[batchId];
        require(batch.id != 0, "ProductBatchFactory: unknown batch");

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

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
