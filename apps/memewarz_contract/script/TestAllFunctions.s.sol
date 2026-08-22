// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MemeWarz} from "../src/MemeWarz.sol";
import {MockEntropy} from "../test/mocks/MockEntropy.sol";

/**
 * @title TestAllFunctions
 * @notice Foundry script to systematically execute and test all functions of MemeWarz.
 * @dev Run with: `forge script script/TestAllFunctions.s.sol:TestAllFunctions -vvv`
 */
contract TestAllFunctions is Script {
    MemeWarz public memeWarz;
    MockEntropy public mockEntropy;

    uint256 internal deployerPk = 0xA11CE;
    address internal deployer = vm.addr(deployerPk);

    uint256 internal hostPk = 0xB0B;
    address internal host = vm.addr(hostPk);

    uint256 internal player1Pk = 0xC001;
    address internal player1 = vm.addr(player1Pk);

    uint256 internal player2Pk = 0xC002;
    address internal player2 = vm.addr(player2Pk);

    uint256 internal player3Pk = 0xC003;
    address internal player3 = vm.addr(player3Pk);

    uint256 internal newOwnerPk = 0xD00D;
    address internal newOwner = vm.addr(newOwnerPk);

    function run() external {
        console2.log("=================================================");
        console2.log("       STARTING MEMEWARZ FULL FUNCTION TEST      ");
        console2.log("=================================================");

        // Fund test accounts
        vm.deal(deployer, 100 ether);
        vm.deal(host, 100 ether);
        vm.deal(player1, 100 ether);
        vm.deal(player2, 100 ether);
        vm.deal(player3, 100 ether);
        vm.deal(newOwner, 100 ether);

        // 1. Deploy MemeWarz & MockEntropy
        vm.startBroadcast(deployerPk);
        mockEntropy = new MockEntropy();
        memeWarz = new MemeWarz(address(mockEntropy), mockEntropy.defaultProvider(), 250); // 2.5% platform fee
        console2.log("[1] Contract Deployment");
        console2.log("    MemeWarz deployed at:", address(memeWarz));
        console2.log("    MockEntropy deployed at:", address(mockEntropy));

        // 2. Test Meme Template Functions (addMemeTemplate, batchAddMemeTemplates, getTemplate, getTemplates)
        console2.log("\n[2] Testing Meme Template Functions...");
        uint256 t1 = memeWarz.addMemeTemplate("ipfs://bafy-pepe");
        console2.log("    addMemeTemplate() -> Template ID:", t1);
        require(t1 == 1, "Template ID mismatch");

        string[] memory batchURIs = new string[](3);
        batchURIs[0] = "ipfs://bafy-doge";
        batchURIs[1] = "ipfs://bafy-chad";
        batchURIs[2] = "ipfs://bafy-wojak";
        memeWarz.batchAddMemeTemplates(batchURIs);
        console2.log("    batchAddMemeTemplates() added 3 templates in batch");
        require(memeWarz.templateCounter() == 4, "Template counter mismatch");

        MemeWarz.MemeTemplate memory tmpl = memeWarz.getTemplate(1);
        console2.log("    getTemplate(1):", tmpl.imageURI);
        require(keccak256(bytes(tmpl.imageURI)) == keccak256(bytes("ipfs://bafy-pepe")), "URI mismatch");

        MemeWarz.MemeTemplate[] memory allTemplates = memeWarz.getTemplates();
        console2.log("    getTemplates() -> Total retrieved:", allTemplates.length);
        require(allTemplates.length == 4, "All templates length mismatch");

        // 3. Test Admin & Config Functions (setPlatformFeeBps, setEntropyConfig, getEntropy)
        console2.log("\n[3] Testing Admin & Configuration Setters...");
        memeWarz.setPlatformFeeBps(500); // 5%
        console2.log("    setPlatformFeeBps(500) -> Fee Bps:", memeWarz.platformFeeBps());
        require(memeWarz.platformFeeBps() == 500, "Fee bps mismatch");

        memeWarz.setPlatformFeeBps(250); // Restore to 2.5%

        address entropyAddr = memeWarz.getEntropy();
        console2.log("    getEntropy() returned:", entropyAddr);
        memeWarz.setEntropyConfig(address(mockEntropy), mockEntropy.defaultProvider());
        console2.log("    setEntropyConfig() successfully updated");

        vm.stopBroadcast();

        // 4. Test Game Creation (createGame with entry fee, getGame, getGameByCode)
        console2.log("\n[4] Testing Game Creation...");
        vm.startBroadcast(hostPk);
        uint256 hostPrize = 1 ether;
        uint256 entryFee = 0.1 ether;
        uint40 votingDuration = 60 seconds;

        (uint256 gameId, uint32 gameCode) = memeWarz.createGame{value: hostPrize}(
            "Monad Alpha Arena",
            votingDuration,
            entryFee
        );
        console2.log("    createGame(with entryFee) -> Game ID:", gameId);
        console2.log("    6-Digit Code:", uint256(gameCode));
        require(gameId == 1, "GameId should be 1");
        require(gameCode >= 100000 && gameCode <= 999999, "Invalid room code");
        require(memeWarz.codeToGameId(gameCode) == 1, "Code mapping mismatch");

        MemeWarz.Game memory game = memeWarz.getGame(gameId);
        console2.log("    getGame() -> Host:", game.host);
        console2.log("    PrizePool:", game.prizePool);
        console2.log("    EntryFee:", game.entryFee);
        require(game.host == host, "Host mismatch");
        require(game.prizePool == hostPrize, "Prize pool mismatch");
        require(uint8(game.status) == uint8(MemeWarz.GameStatus.Open), "Status should be Open");

        MemeWarz.Game memory gameByCode = memeWarz.getGameByCode(gameCode);
        require(gameByCode.id == gameId, "getGameByCode mismatch");
        console2.log("    getGameByCode() verified successfully");
        vm.stopBroadcast();

        // 5. Test Player Joining (joinGame, getPlayers, getPlayer)
        console2.log("\n[5] Testing Player Joining...");
        vm.startBroadcast(player1Pk);
        memeWarz.joinGame{value: entryFee}(gameCode);
        console2.log("    Player 1 joined room:", player1);
        vm.stopBroadcast();

        vm.startBroadcast(player2Pk);
        memeWarz.joinGame{value: entryFee}(gameCode);
        console2.log("    Player 2 joined room:", player2);
        vm.stopBroadcast();

        vm.startBroadcast(player3Pk);
        memeWarz.joinGame{value: entryFee}(gameCode);
        console2.log("    Player 3 joined room:", player3);
        vm.stopBroadcast();

        address[] memory players = memeWarz.getPlayers(gameId);
        console2.log("    getPlayers() -> Total players (incl. host):", players.length);
        require(players.length == 4, "Expected 4 players in game");

        MemeWarz.Player memory p1 = memeWarz.getPlayer(gameId, player1);
        require(p1.hasJoined, "Player 1 hasJoined should be true");
        console2.log("    getPlayer(player1) verified hasJoined = true");

        // 6. Test Start Game & Pyth Entropy Callback (startGame & entropyCallback)
        console2.log("\n[6] Testing Start Game & Randomness Assignment...");
        uint256 entropyFee = mockEntropy.getFee(mockEntropy.defaultProvider());
        vm.startBroadcast(hostPk);
        memeWarz.startGame{value: entropyFee}(gameId);
        console2.log("    startGame() called with entropy fee. Randomness requested!");
        vm.stopBroadcast();

        // Simulate Pyth Entropy callback fulfillment
        vm.startBroadcast(deployerPk);
        mockEntropy.fulfill(1, keccak256("MONAD_VRF_ENTROPY_TEST_SEED"));
        console2.log("    mockEntropy.fulfill() invoked entropyCallback with verifiable VRF seed!");
        vm.stopBroadcast();

        game = memeWarz.getGame(gameId);
        console2.log("    Status after start:", uint8(game.status));
        console2.log("    Competitor 0 assigned:", game.competitors[0]);
        console2.log("    Competitor 1 assigned:", game.competitors[1]);
        require(uint8(game.status) == uint8(MemeWarz.GameStatus.Submitting), "Expected Submitting status");
        require(game.competitors[0] != address(0) && game.competitors[1] != address(0), "Competitors empty");
        require(game.competitors[0] != game.competitors[1], "Competitors must be distinct");

        // 7. Test Caption Submissions (submitMeme, getMemeEntries)
        console2.log("\n[7] Testing Competitor Caption Submissions...");
        address comp0 = game.competitors[0];
        address comp1 = game.competitors[1];

        uint256 comp0Pk = (comp0 == host) ? hostPk : (comp0 == player1) ? player1Pk : (comp0 == player2) ? player2Pk : player3Pk;
        uint256 comp1Pk = (comp1 == host) ? hostPk : (comp1 == player1) ? player1Pk : (comp1 == player2) ? player2Pk : player3Pk;

        vm.startBroadcast(comp0Pk);
        memeWarz.submitMeme(gameId, "When you deploy to Monad Testnet at 10,000 TPS");
        console2.log("    Competitor 0 submitted meme caption");
        vm.stopBroadcast();

        vm.startBroadcast(comp1Pk);
        memeWarz.submitMeme(gameId, "Monad fast, gas cheap, vibes high");
        console2.log("    Competitor 1 submitted meme caption");
        vm.stopBroadcast();

        game = memeWarz.getGame(gameId);
        console2.log("    Status after both submissions:", uint8(game.status));
        require(uint8(game.status) == uint8(MemeWarz.GameStatus.Voting), "Expected Voting status");

        (MemeWarz.MemeEntry memory entry0, MemeWarz.MemeEntry memory entry1) = memeWarz.getMemeEntries(gameId);
        console2.log("    getMemeEntries() -> Entry 0 Caption:", entry0.caption);
        console2.log("    getMemeEntries() -> Entry 1 Caption:", entry1.caption);

        // 8. Test Voting Phase (vote)
        console2.log("\n[8] Testing Voting by Non-Competitor Voters...");
        address voter;
        uint256 voterPk;
        if (players[0] != comp0 && players[0] != comp1) { voter = players[0]; voterPk = hostPk; }
        else if (players[1] != comp0 && players[1] != comp1) { voter = players[1]; voterPk = player1Pk; }
        else if (players[2] != comp0 && players[2] != comp1) { voter = players[2]; voterPk = player2Pk; }
        else { voter = players[3]; voterPk = player3Pk; }

        vm.startBroadcast(voterPk);
        memeWarz.vote(gameId, comp0);
        console2.log("    Voter voted for Competitor 0:", comp0);
        MemeWarz.Player memory voterPlayer = memeWarz.getPlayer(gameId, voter);
        require(voterPlayer.hasVoted, "Player should be marked as voted");
        console2.log("    getPlayer(voter) verified hasVoted = true");
        vm.stopBroadcast();

        // 9. Test Settlement & Prize Claiming (settleGame, claimPrize)
        console2.log("\n[9] Testing Settlement & Prize Claiming...");
        // Fast-forward time past voting duration
        vm.warp(block.timestamp + votingDuration + 1);

        vm.startBroadcast(hostPk);
        memeWarz.endVotingAndSettle(gameId);
        console2.log("    endVotingAndSettle() executed successfully");
        vm.stopBroadcast();

        game = memeWarz.getGame(gameId);
        console2.log("    Status after settlement:", uint8(game.status));
        console2.log("    Winner:", game.winner);
        require(uint8(game.status) == uint8(MemeWarz.GameStatus.Finished), "Expected Finished status");
        require(game.winner == comp0, "Competitor 0 should be winner");

        uint256 claimable = memeWarz.claimablePrizes(gameId, comp0);
        console2.log("    claimablePrizes() for winner:", claimable);
        require(claimable > 0, "Claimable prize should be > 0");

        uint256 winnerBalBefore = comp0.balance;
        vm.startBroadcast(comp0Pk);
        memeWarz.claimPrize(gameId);
        uint256 winnerBalAfter = comp0.balance;
        console2.log("    claimPrize() succeeded! Winner received wei:", winnerBalAfter - winnerBalBefore);
        vm.stopBroadcast();

        // 10. Test Room Cancellation & Refunds (cancelGame)
        console2.log("\n[10] Testing Game Cancellation & Refund Flow...");
        vm.startBroadcast(hostPk);
        (uint256 cancelGameId, uint32 cancelGameCode) = memeWarz.createGame{value: 0.5 ether}(
            "Refundable Room",
            120 seconds,
            0.05 ether
        );
        vm.stopBroadcast();

        vm.startBroadcast(player1Pk);
        memeWarz.joinGame{value: 0.05 ether}(cancelGameCode);
        vm.stopBroadcast();

        uint256 hostBalBefore = host.balance;
        uint256 p1BalBefore = player1.balance;

        vm.startBroadcast(hostPk);
        memeWarz.cancelGame(cancelGameId);
        console2.log("    cancelGame() successfully executed by host");
        vm.stopBroadcast();

        require(host.balance == hostBalBefore + 0.5 ether, "Host refund mismatch");
        require(player1.balance == p1BalBefore + 0.05 ether, "Player refund mismatch");
        console2.log("    All refunds (host pool + player entry fees) verified");

        // 11. Test Platform Fee Withdrawal (withdrawPlatformFees)
        console2.log("\n[11] Testing Platform Fee Withdrawal...");
        uint256 fees = memeWarz.accumulatedPlatformFees();
        console2.log("    Accumulated Platform Fees:", fees);
        require(fees > 0, "Platform fees should be > 0");

        address treasury = address(0x9999);
        vm.startBroadcast(deployerPk);
        memeWarz.withdrawPlatformFees(treasury);
        console2.log("    withdrawPlatformFees() sent fees to treasury:", treasury);
        require(treasury.balance == fees, "Treasury balance mismatch");
        require(memeWarz.accumulatedPlatformFees() == 0, "Accumulated fees should be 0");
        vm.stopBroadcast();

        // 12. Test 2-Step Ownership Transfer (transferOwnership, acceptOwnership)
        console2.log("\n[12] Testing Ownable2Step Transfer & Acceptance...");
        vm.startBroadcast(deployerPk);
        memeWarz.transferOwnership(newOwner);
        console2.log("    transferOwnership() initiated to:", newOwner);
        require(memeWarz.pendingOwner() == newOwner, "Pending owner mismatch");
        vm.stopBroadcast();

        vm.startBroadcast(newOwnerPk);
        memeWarz.acceptOwnership();
        console2.log("    acceptOwnership() accepted. New contract owner:", memeWarz.owner());
        require(memeWarz.owner() == newOwner, "Owner mismatch after transfer");
        vm.stopBroadcast();

        console2.log("\n=================================================");
        console2.log("  ALL MEMEWARZ FUNCTIONS TESTED & VERIFIED 100%  ");
        console2.log("=================================================");
    }
}
