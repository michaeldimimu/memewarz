// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IEntropyConsumer
 * @notice Standard interface for contracts receiving callbacks from Pyth Entropy.
 */
interface IEntropyConsumer {
    /**
     * @notice Callback invoked by the Pyth Entropy contract when randomness is ready.
     * @param sequenceNumber The sequence number returned when requestWithCallback was called.
     * @param provider The provider who generated the random number.
     * @param randomNumber The 32-byte verifiable random number.
     */
    function entropyCallback(
        uint64 sequenceNumber,
        address provider,
        bytes32 randomNumber
    ) external;

    /**
     * @notice Returns the address of the Pyth Entropy contract.
     */
    function getEntropy() external view returns (address);
}
