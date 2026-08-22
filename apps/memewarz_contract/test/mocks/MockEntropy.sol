// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IEntropy} from "../../src/interfaces/IEntropy.sol";
import {IEntropyConsumer} from "../../src/interfaces/IEntropyConsumer.sol";

/**
 * @title MockEntropy
 * @notice Mock implementation of Pyth Entropy for Foundry unit and integration tests.
 */
contract MockEntropy is IEntropy {
    struct Request {
        address consumer;
        address provider;
        bytes32 userRandomNumber;
    }

    uint256 public fee = 0.001 ether;
    address public defaultProvider = address(0xEEeeeee);
    uint64 public nextSequenceNumber = 1;
    uint256 public accruedPythFees;

    mapping(uint64 => Request) public requests;

    event EntropyRequested(uint64 indexed sequenceNumber, address indexed consumer, address provider);
    event EntropyFulfilled(uint64 indexed sequenceNumber, bytes32 randomNumber);

    function setFee(uint256 _fee) external {
        fee = _fee;
    }

    function setDefaultProvider(address _provider) external {
        defaultProvider = _provider;
    }

    function requestWithCallback(
        address provider,
        bytes32 userRandomNumber
    ) external payable override returns (uint64 assignedSequenceNumber) {
        require(msg.value >= fee, "Insufficient fee");
        accruedPythFees += msg.value;

        assignedSequenceNumber = nextSequenceNumber++;
        requests[assignedSequenceNumber] = Request({
            consumer: msg.sender,
            provider: provider != address(0) ? provider : defaultProvider,
            userRandomNumber: userRandomNumber
        });

        emit EntropyRequested(assignedSequenceNumber, msg.sender, provider);
    }

    function fulfill(uint64 sequenceNumber, bytes32 randomNumber) external {
        Request memory req = requests[sequenceNumber];
        require(req.consumer != address(0), "Request not found");

        delete requests[sequenceNumber];
        IEntropyConsumer(req.consumer).entropyCallback(sequenceNumber, req.provider, randomNumber);
        emit EntropyFulfilled(sequenceNumber, randomNumber);
    }

    function getFee(address /* provider */) external view override returns (uint256) {
        return fee;
    }

    function getDefaultProvider() external view override returns (address) {
        return defaultProvider;
    }

    function getAccruedPythFees() external view override returns (uint256) {
        return accruedPythFees;
    }
}
