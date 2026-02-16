// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IReceiver {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}

contract DailySalesRecorder is IReceiver {
    struct DailySales {
        uint256 date;
        uint256 totalGross;
        uint256 totalNet;
        uint256 totalTax;
        uint256 refunds;
        uint256 txCount;
        bytes32 dataHash;
    }

    mapping(uint256 => DailySales) public salesByDate;
    mapping(uint256 => bool) public dateRecorded;
    address public forwarder;
    address public owner;

    event DailySalesRecorded(
        uint256 indexed date,
        uint256 totalGross,
        uint256 totalNet,
        uint256 totalTax,
        uint256 refunds,
        uint256 txCount,
        bytes32 dataHash
    );

    constructor(address _forwarder) {
        forwarder = _forwarder;
        owner = msg.sender;
    }

    function setForwarder(address _forwarder) external {
        require(msg.sender == owner, "Only owner");
        forwarder = _forwarder;
    }

    function onReport(bytes calldata, bytes calldata report) external override {
        require(msg.sender == forwarder, "Only forwarder");

        (
            uint256 date,
            uint256 totalGross,
            uint256 totalNet,
            uint256 totalTax,
            uint256 refunds,
            uint256 txCount,
            bytes32 dataHash
        ) = abi.decode(report, (uint256, uint256, uint256, uint256, uint256, uint256, bytes32));

        require(!dateRecorded[date], "Date already recorded");

        salesByDate[date] = DailySales({
            date: date,
            totalGross: totalGross,
            totalNet: totalNet,
            totalTax: totalTax,
            refunds: refunds,
            txCount: txCount,
            dataHash: dataHash
        });

        dateRecorded[date] = true;

        emit DailySalesRecorded(date, totalGross, totalNet, totalTax, refunds, txCount, dataHash);
    }

    function getSalesByDate(uint256 date) external view returns (DailySales memory) {
        require(dateRecorded[date], "No record for this date");
        return salesByDate[date];
    }
}
