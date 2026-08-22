// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MemeWarz} from "../src/MemeWarz.sol";

/**
 * @title DeployMemeWarz
 * @notice Foundry deployment script for MemeWarz on Monad Testnet / Mainnet.
 */
contract DeployMemeWarz is Script {
    // Monad Testnet Pyth Entropy Configuration (Check official Pyth docs for updates)
    address public constant PYTH_ENTROPY_MONAD_TESTNET = 0x36825bf3Fbdf5a29E2d5148bfe7Dcf7B5639e320;
    address public constant PYTH_PROVIDER_MONAD_TESTNET = 0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344;
    uint256 public constant INITIAL_PLATFORM_FEE_BPS = 250; // 2.5%

    function run() external returns (MemeWarz memeWarz) {
        uint256 deployerPrivateKey;
        try vm.envUint("PRIVATE_KEY") returns (uint256 pk) {
            deployerPrivateKey = pk;
        } catch {
            try vm.envBytes32("PRIVATE_KEY") returns (bytes32 bpk) {
                deployerPrivateKey = uint256(bpk);
            } catch {
                deployerPrivateKey = 0;
            }
        }

        address entropyAddress = vm.envOr("PYTH_ENTROPY_ADDRESS", PYTH_ENTROPY_MONAD_TESTNET);
        address providerAddress = vm.envOr("PYTH_PROVIDER_ADDRESS", PYTH_PROVIDER_MONAD_TESTNET);

        if (deployerPrivateKey != 0) {
            vm.startBroadcast(deployerPrivateKey);
        } else {
            vm.startBroadcast();
        }

        memeWarz = new MemeWarz(entropyAddress, providerAddress, INITIAL_PLATFORM_FEE_BPS);

        // Seed initial meme templates
        memeWarz.addMemeTemplate("ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/monad_pepe.png");
        memeWarz.addMemeTemplate("ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/monad_doge.png");
        memeWarz.addMemeTemplate("ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/monad_chad.png");
        memeWarz.addMemeTemplate("ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/monad_wojak.png");

        vm.stopBroadcast();

        console2.log("MemeWarz deployed at:", address(memeWarz));
        console2.log("Entropy address:", entropyAddress);
        console2.log("Provider address:", providerAddress);
    }
}
