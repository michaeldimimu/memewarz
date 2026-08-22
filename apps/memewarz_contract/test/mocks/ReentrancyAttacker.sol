// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MemeWarz} from "../../src/MemeWarz.sol";

/**
 * @title ReentrancyAttacker
 * @notice Malicious contract attempting to reenter claimPrize during payout.
 */
contract ReentrancyAttacker {
    MemeWarz public memeWarz;
    uint256 public targetGameId;
    uint256 public attackCount;
    bool public attackAttempted;
    bool public reentrancyFailed;

    constructor(address _memeWarz) {
        memeWarz = MemeWarz(payable(_memeWarz));
    }

    function joinGame(uint32 gameCode) external payable {
        memeWarz.joinGame{value: msg.value}(gameCode);
    }

    function submitMeme(uint256 gameId, string calldata caption) external {
        memeWarz.submitMeme(gameId, caption);
    }

    function attack(uint256 gameId) external {
        targetGameId = gameId;
        memeWarz.claimPrize(gameId);
    }

    receive() external payable {
        if (attackCount == 0) {
            attackCount++;
            attackAttempted = true;
            try memeWarz.claimPrize(targetGameId) {
                // If it succeeded, reentrancy defense failed
                reentrancyFailed = false;
            } catch {
                // Reentrancy guard successfully reverted
                reentrancyFailed = true;
            }
        }
    }
}
