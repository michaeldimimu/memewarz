// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IEntropy
 * @notice Interface for the Pyth Entropy protocol on EVM networks (including Monad).
 * @dev See https://docs.pyth.network/entropy for official specification and provider addresses.
 */
interface IEntropy {
    /**
     * @notice Requests a random number with callback fulfillment.
     * @param provider The address of the entropy provider.
     * @param userRandomNumber A 32-byte user-provided commitment (seed).
     * @return assignedSequenceNumber The unique sequence number assigned to this request.
     */
    function requestWithCallback(
        address provider,
        bytes32 userRandomNumber
    ) external payable returns (uint64 assignedSequenceNumber);

    /**
     * @notice Gets the required fee for requesting entropy from a specific provider.
     * @param provider The address of the entropy provider.
     * @return fee The fee in wei (native token) required for the request.
     */
    function getFee(address provider) external view returns (uint256 fee);

    /**
     * @notice Returns the default entropy provider address.
     * @return provider The default provider address.
     */
    function getDefaultProvider() external view returns (address provider);

    /**
     * @notice Returns accrued Pyth fees.
     */
    function getAccruedPythFees() external view returns (uint256 accruedPythFees);
}
