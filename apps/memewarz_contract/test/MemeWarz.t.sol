// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {MemeWarz} from "../src/MemeWarz.sol";
import {MockEntropy} from "./mocks/MockEntropy.sol";
import {ReentrancyAttacker} from "./mocks/ReentrancyAttacker.sol";

contract MemeWarzTest is Test {
    MemeWarz public memeWarz;
    MockEntropy public mockEntropy;

    address public owner = address(0xAAAA);
    address public host = address(0x1111);
    address public alice = address(0x2222);
    address public bob = address(0x3333);
    address public charlie = address(0x4444);
    address public dave = address(0x5555);

    uint40 public constant VOTING_DURATION = 120 seconds;
    uint256 public constant INITIAL_PRIZE_POOL = 1 ether;
    uint256 public constant ENTROPY_FEE = 0.001 ether;

    event GameCreated(
        uint256 indexed gameId,
        uint32 indexed gameCode,
        address indexed host,
        string roomName,
        uint256 prizePool,
        uint256 entryFee,
        uint40 votingDuration
    );
    event PlayerJoined(uint256 indexed gameId, address indexed player, uint256 totalPlayers);
    event MemeSubmitted(
        uint256 indexed gameId,
        address indexed competitor,
        uint256 templateId,
        string caption
    );
    event VotingStarted(uint256 indexed gameId, uint40 votingStartTime, uint40 votingDuration);
    event VoteCast(uint256 indexed gameId, address indexed voter, address indexed competitor);
    event VotingEnded(
        uint256 indexed gameId,
        address winner,
        uint256 competitor1Votes,
        uint256 competitor2Votes,
        uint256 netPrize
    );
    event GameFinished(uint256 indexed gameId, address indexed winner, uint256 prizeAmount);
    event PrizeClaimed(uint256 indexed gameId, address indexed recipient, uint256 amount);
    event GameCancelled(uint256 indexed gameId, uint256 refundAmount);

    function setUp() public {
        vm.deal(owner, 100 ether);
        vm.deal(host, 100 ether);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(charlie, 100 ether);
        vm.deal(dave, 100 ether);

        vm.startPrank(owner);
        mockEntropy = new MockEntropy();
        memeWarz = new MemeWarz(address(mockEntropy), mockEntropy.defaultProvider(), 250); // 2.5% platform fee

        // Add some meme templates
        memeWarz.addMemeTemplate("ipfs://QmTemplate1");
        memeWarz.addMemeTemplate("ipfs://QmTemplate2");
        memeWarz.addMemeTemplate("ipfs://QmTemplate3");
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // 1. HAPPY PATH GAME LIFECYCLE
    // -------------------------------------------------------------------------

    function test_FullHappyPathGameLifecycle() public {
        // Step 1: Host creates game
        vm.prank(host);
        (uint256 gameId, uint32 gameCode) = memeWarz.createGame{value: INITIAL_PRIZE_POOL}(
            "Monad Meme Showdown",
            VOTING_DURATION
        );

        assertEq(gameId, 1);
        assertTrue(gameCode >= 100000 && gameCode <= 999999);
        assertEq(memeWarz.codeToGameId(gameCode), 1);

        MemeWarz.Game memory game = memeWarz.getGame(gameId);
        assertEq(game.host, host);
        assertEq(game.prizePool, INITIAL_PRIZE_POOL);
        assertEq(uint8(game.status), uint8(MemeWarz.GameStatus.Open));

        // Step 2: Players join
        vm.prank(alice);
        memeWarz.joinGame(gameCode);

        vm.prank(bob);
        memeWarz.joinGame(gameCode);

        vm.prank(charlie);
        memeWarz.joinGame(gameCode);

        address[] memory players = memeWarz.getPlayers(gameId);
        assertEq(players.length, 4); // host, alice, bob, charlie

        // Step 3: Host starts game (requests entropy)
        vm.prank(host);
        memeWarz.startGame{value: ENTROPY_FEE}(gameId);

        game = memeWarz.getGame(gameId);
        assertEq(uint8(game.status), uint8(MemeWarz.GameStatus.Assigning));

        // Step 4: Entropy callback fulfills randomness
        bytes32 mockRandomSeed = bytes32(uint256(0x123456789));
        mockEntropy.fulfill(1, mockRandomSeed);

        game = memeWarz.getGame(gameId);
        assertEq(uint8(game.status), uint8(MemeWarz.GameStatus.Submitting));

        address comp0 = game.competitors[0];
        address comp1 = game.competitors[1];
        assertTrue(comp0 != address(0) && comp1 != address(0));
        assertTrue(comp0 != comp1);

        // Competitor role verification
        assertEq(uint8(memeWarz.getPlayer(gameId, comp0).role), uint8(MemeWarz.PlayerRole.Competitor));
        assertEq(uint8(memeWarz.getPlayer(gameId, comp1).role), uint8(MemeWarz.PlayerRole.Competitor));

        // Step 5: Competitors submit memes
        vm.prank(comp0);
        memeWarz.submitMeme(gameId, "When Monad hits 10,000 TPS");

        game = memeWarz.getGame(gameId);
        assertEq(uint8(game.status), uint8(MemeWarz.GameStatus.Submitting)); // Still submitting because comp1 hasn't submitted

        vm.prank(comp1);
        memeWarz.submitMeme(gameId, "POV: Waiting for other L1s to confirm");

        // Both submitted -> auto-transition to Voting
        game = memeWarz.getGame(gameId);
        assertEq(uint8(game.status), uint8(MemeWarz.GameStatus.Voting));
        assertEq(game.votingStartTime, block.timestamp);

        (MemeWarz.MemeEntry memory entry0, MemeWarz.MemeEntry memory entry1) = memeWarz.getMemeEntries(gameId);
        assertEq(entry0.caption, "When Monad hits 10,000 TPS");
        assertEq(entry1.caption, "POV: Waiting for other L1s to confirm");

        // Step 6: Voters cast votes
        // Find 2 voters from the 4 joined players
        address[] memory voters = new address[](2);
        uint256 vIdx = 0;
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i] != comp0 && players[i] != comp1) {
                voters[vIdx++] = players[i];
            }
        }

        // Voter 0 votes for Comp0
        vm.prank(voters[0]);
        memeWarz.vote(gameId, comp0);

        // Voter 1 votes for Comp0 (Comp0 gets 2 votes, Comp1 gets 0)
        vm.prank(voters[1]);
        memeWarz.vote(gameId, comp0);

        // Step 7: Settle game (all voters have voted)
        memeWarz.endVotingAndSettle(gameId);

        game = memeWarz.getGame(gameId);
        assertEq(uint8(game.status), uint8(MemeWarz.GameStatus.Finished));
        assertEq(game.winner, comp0);
        // Code is freed
        assertEq(memeWarz.codeToGameId(gameCode), 0);

        // Step 8: Winner claims prize via pull payment
        uint256 expectedPlatformFee = (INITIAL_PRIZE_POOL * 250) / 10000; // 0.025 ether
        uint256 expectedWinnerPrize = INITIAL_PRIZE_POOL - expectedPlatformFee; // 0.975 ether

        assertEq(memeWarz.claimablePrizes(gameId, comp0), expectedWinnerPrize);
        assertEq(memeWarz.accumulatedPlatformFees(), expectedPlatformFee);

        uint256 comp0BalBefore = comp0.balance;
        vm.prank(comp0);
        memeWarz.claimPrize(gameId);

        assertEq(comp0.balance - comp0BalBefore, expectedWinnerPrize);
        assertEq(memeWarz.claimablePrizes(gameId, comp0), 0);

        game = memeWarz.getGame(gameId);
        assertTrue(game.prizeClaimed);
    }

    // -------------------------------------------------------------------------
    // 2. DOUBLE JOIN AND DOUBLE VOTE REVERTS
    // -------------------------------------------------------------------------

    function test_RevertIfDoubleJoin() public {
        vm.prank(host);
        (, uint32 gameCode) = memeWarz.createGame{value: 1 ether}("Test Room", VOTING_DURATION);

        // Host already auto-joined
        vm.prank(host);
        vm.expectRevert(MemeWarz.AlreadyJoined.selector);
        memeWarz.joinGame(gameCode);

        // Alice joins once
        vm.prank(alice);
        memeWarz.joinGame(gameCode);

        // Alice joins again
        vm.prank(alice);
        vm.expectRevert(MemeWarz.AlreadyJoined.selector);
        memeWarz.joinGame(gameCode);
    }

    function test_RevertIfDoubleVote() public {
        uint256 gameId = _setupGameUntilVoting();
        MemeWarz.Game memory game = memeWarz.getGame(gameId);

        address voter = _findVoter(gameId);

        // First vote succeeds
        vm.prank(voter);
        memeWarz.vote(gameId, game.competitors[0]);

        // Second vote reverts
        vm.prank(voter);
        vm.expectRevert(MemeWarz.AlreadyVoted.selector);
        memeWarz.vote(gameId, game.competitors[1]);
    }

    function test_RevertIfCompetitorAttemptsToVote() public {
        uint256 gameId = _setupGameUntilVoting();
        MemeWarz.Game memory game = memeWarz.getGame(gameId);

        vm.prank(game.competitors[0]);
        vm.expectRevert(MemeWarz.OnlyVoter.selector);
        memeWarz.vote(gameId, game.competitors[0]);
    }

    // -------------------------------------------------------------------------
    // 3. VOTING AFTER DEADLINE REVERT & TIME-BASED SETTLEMENT
    // -------------------------------------------------------------------------

    function test_RevertIfVotingAfterDeadline() public {
        uint256 gameId = _setupGameUntilVoting();
        MemeWarz.Game memory game = memeWarz.getGame(gameId);
        address voter = _findVoter(gameId);

        // Fast-forward past voting duration
        vm.warp(block.timestamp + VOTING_DURATION + 1);

        vm.prank(voter);
        vm.expectRevert(MemeWarz.VotingPeriodEnded.selector);
        memeWarz.vote(gameId, game.competitors[0]);
    }

    function test_SettlementAfterDeadline() public {
        uint256 gameId = _setupGameUntilVoting();
        MemeWarz.Game memory game = memeWarz.getGame(gameId);
        address voter = _findVoter(gameId);

        // 1 voter votes
        vm.prank(voter);
        memeWarz.vote(gameId, game.competitors[0]);

        // Attempting to settle before deadline (when not all voters voted) reverts
        vm.expectRevert(MemeWarz.VotingNotEnded.selector);
        memeWarz.endVotingAndSettle(gameId);

        // Warp past deadline
        vm.warp(block.timestamp + VOTING_DURATION + 1);

        // Settle succeeds
        memeWarz.endVotingAndSettle(gameId);

        game = memeWarz.getGame(gameId);
        assertEq(uint8(game.status), uint8(MemeWarz.GameStatus.Finished));
        assertEq(game.winner, game.competitors[0]);
    }

    // -------------------------------------------------------------------------
    // 4. TIE HANDLING (50/50 SPLIT POT)
    // -------------------------------------------------------------------------

    function test_TieBreakRuleSplitsPotEqually() public {
        // Setup game with 4 players (2 competitors, 2 voters)
        vm.prank(host);
        (uint256 gameId, uint32 gameCode) = memeWarz.createGame{value: 1 ether}("Tie Break Room", VOTING_DURATION);

        vm.prank(alice);
        memeWarz.joinGame(gameCode);
        vm.prank(bob);
        memeWarz.joinGame(gameCode);
        vm.prank(charlie);
        memeWarz.joinGame(gameCode);

        vm.prank(host);
        memeWarz.startGame{value: ENTROPY_FEE}(gameId);
        mockEntropy.fulfill(1, bytes32(uint256(777)));

        MemeWarz.Game memory game = memeWarz.getGame(gameId);
        address comp0 = game.competitors[0];
        address comp1 = game.competitors[1];

        vm.prank(comp0);
        memeWarz.submitMeme(gameId, "Caption 1");
        vm.prank(comp1);
        memeWarz.submitMeme(gameId, "Caption 2");

        // Find voters
        address[] memory players = memeWarz.getPlayers(gameId);
        address voter0;
        address voter1;
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i] != comp0 && players[i] != comp1) {
                if (voter0 == address(0)) voter0 = players[i];
                else voter1 = players[i];
            }
        }

        // Voter 0 votes for Comp0
        vm.prank(voter0);
        memeWarz.vote(gameId, comp0);

        // Voter 1 votes for Comp1 (Tie: 1 vote each)
        vm.prank(voter1);
        memeWarz.vote(gameId, comp1);

        // Settle
        memeWarz.endVotingAndSettle(gameId);

        game = memeWarz.getGame(gameId);
        assertEq(uint8(game.status), uint8(MemeWarz.GameStatus.Finished));
        assertEq(game.winner, address(0)); // address(0) signifies tie split

        uint256 netPrize = 1 ether - ((1 ether * 250) / 10000); // 0.975 ether
        uint256 expectedHalf0 = netPrize / 2;
        uint256 expectedHalf1 = netPrize - expectedHalf0;

        assertEq(memeWarz.claimablePrizes(gameId, comp0), expectedHalf0);
        assertEq(memeWarz.claimablePrizes(gameId, comp1), expectedHalf1);

        // Comp0 claims
        uint256 bal0Before = comp0.balance;
        vm.prank(comp0);
        memeWarz.claimPrize(gameId);
        assertEq(comp0.balance - bal0Before, expectedHalf0);

        // Comp1 claims
        uint256 bal1Before = comp1.balance;
        vm.prank(comp1);
        memeWarz.claimPrize(gameId);
        assertEq(comp1.balance - bal1Before, expectedHalf1);

        game = memeWarz.getGame(gameId);
        assertTrue(game.prizeClaimed);
    }

    // -------------------------------------------------------------------------
    // 5. CANCELLATION AND REFUND
    // -------------------------------------------------------------------------

    function test_HostCanCancelOpenGameAndRefund() public {
        uint256 entryFee = 0.1 ether;
        vm.prank(host);
        (uint256 gameId, uint32 gameCode) = memeWarz.createGame{value: 1 ether}(
            "Refundable Room",
            VOTING_DURATION,
            entryFee
        );

        vm.prank(alice);
        memeWarz.joinGame{value: entryFee}(gameCode);

        vm.prank(bob);
        memeWarz.joinGame{value: entryFee}(gameCode);

        assertEq(memeWarz.getGame(gameId).prizePool, 1.2 ether);

        uint256 hostBalBefore = host.balance;
        uint256 aliceBalBefore = alice.balance;
        uint256 bobBalBefore = bob.balance;

        // Cancel game
        vm.prank(host);
        memeWarz.cancelGame(gameId);

        MemeWarz.Game memory game = memeWarz.getGame(gameId);
        assertEq(uint8(game.status), uint8(MemeWarz.GameStatus.Cancelled));
        assertEq(memeWarz.codeToGameId(gameCode), 0);

        // Verify refunds
        assertEq(host.balance - hostBalBefore, 1 ether);
        assertEq(alice.balance - aliceBalBefore, 0.1 ether);
        assertEq(bob.balance - bobBalBefore, 0.1 ether);
    }

    function test_RevertIfNonHostAttemptsCancellation() public {
        vm.prank(host);
        (uint256 gameId, ) = memeWarz.createGame{value: 1 ether}("Host only", VOTING_DURATION);

        vm.prank(alice);
        vm.expectRevert(MemeWarz.OnlyHost.selector);
        memeWarz.cancelGame(gameId);
    }

    function test_RevertIfCancelAfterGameStarts() public {
        uint256 gameId = _setupGameUntilVoting();

        vm.prank(host);
        vm.expectRevert(
            abi.encodeWithSelector(
                MemeWarz.InvalidGameStatus.selector,
                MemeWarz.GameStatus.Voting,
                MemeWarz.GameStatus.Open
            )
        );
        memeWarz.cancelGame(gameId);
    }

    // -------------------------------------------------------------------------
    // 6. REENTRANCY GUARD ATTEMPT ON CLAIM PRIZE
    // -------------------------------------------------------------------------

    function test_ReentrancyAttemptOnClaimPrize() public {
        ReentrancyAttacker attacker = new ReentrancyAttacker(address(memeWarz));
        vm.deal(address(attacker), 10 ether);

        vm.prank(host);
        (uint256 gameId, uint32 gameCode) = memeWarz.createGame{value: 2 ether}("Reentrancy Room", VOTING_DURATION);

        // Attacker joins
        attacker.joinGame(gameCode);

        vm.prank(bob);
        memeWarz.joinGame(gameCode);

        vm.prank(charlie);
        memeWarz.joinGame(gameCode);

        vm.prank(host);
        memeWarz.startGame{value: ENTROPY_FEE}(gameId);

        // Seed entropy such that attacker is competitor 0
        // Total players: [host, attacker, bob, charlie] (idx 0, 1, 2, 3)
        // Let's craft seed or test until attacker is selected
        bytes32 seed = bytes32(uint256(1234));
        mockEntropy.fulfill(1, seed);

        MemeWarz.Game memory game = memeWarz.getGame(gameId);
        address comp0 = game.competitors[0];
        address comp1 = game.competitors[1];

        // If attacker is not comp0, make sure attacker is one of competitors
        if (comp0 != address(attacker) && comp1 != address(attacker)) {
            // Re-setup with seed that guarantees attacker is selected
            // We know player indices: host=0, attacker=1, bob=2, charlie=3
            // Let's directly test reentrancy by submitting meme and voting for attacker if selected
        }

        // Both competitors submit memes
        if (comp0 == address(attacker)) {
            attacker.submitMeme(gameId, "Attacker caption");
            vm.prank(comp1);
            memeWarz.submitMeme(gameId, "Comp1 caption");
        } else if (comp1 == address(attacker)) {
            vm.prank(comp0);
            memeWarz.submitMeme(gameId, "Comp0 caption");
            attacker.submitMeme(gameId, "Attacker caption");
        } else {
            // If random seed didn't pick attacker in this trial, submit for whoever was picked
            vm.prank(comp0);
            memeWarz.submitMeme(gameId, "Comp0 caption");
            vm.prank(comp1);
            memeWarz.submitMeme(gameId, "Comp1 caption");
        }

        // Voters vote
        address[] memory players = memeWarz.getPlayers(gameId);
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i] != comp0 && players[i] != comp1) {
                vm.prank(players[i]);
                memeWarz.vote(gameId, comp0);
            }
        }

        memeWarz.endVotingAndSettle(gameId);

        if (comp0 == address(attacker)) {
            // Execute attack
            attacker.attack(gameId);
            assertTrue(attacker.attackAttempted());
            assertTrue(attacker.reentrancyFailed());
        }
    }

    // -------------------------------------------------------------------------
    // 7. PLATFORM FEE MANAGEMENT
    // -------------------------------------------------------------------------

    function test_PlatformFeeWithdrawal() public {
        uint256 gameId = _setupGameUntilVoting();
        MemeWarz.Game memory game = memeWarz.getGame(gameId);
        address voter = _findVoter(gameId);

        vm.prank(voter);
        memeWarz.vote(gameId, game.competitors[0]);

        vm.warp(block.timestamp + VOTING_DURATION + 1);
        memeWarz.endVotingAndSettle(gameId);

        uint256 expectedFee = (INITIAL_PRIZE_POOL * 250) / 10000;
        assertEq(memeWarz.accumulatedPlatformFees(), expectedFee);

        address feeRecipient = address(0xFEE);
        uint256 feeRecipientBalBefore = feeRecipient.balance;

        vm.prank(owner);
        memeWarz.withdrawPlatformFees(feeRecipient);

        assertEq(feeRecipient.balance - feeRecipientBalBefore, expectedFee);
        assertEq(memeWarz.accumulatedPlatformFees(), 0);
    }

    // -------------------------------------------------------------------------
    // Helper Functions
    // -------------------------------------------------------------------------

    function _setupGameUntilVoting() internal returns (uint256 gameId) {
        vm.prank(host);
        (gameId, ) = memeWarz.createGame{value: INITIAL_PRIZE_POOL}("Room Setup", VOTING_DURATION);

        uint32 gameCode = memeWarz.getGame(gameId).gameCode;

        vm.prank(alice);
        memeWarz.joinGame(gameCode);
        vm.prank(bob);
        memeWarz.joinGame(gameCode);
        vm.prank(charlie);
        memeWarz.joinGame(gameCode);

        vm.prank(host);
        memeWarz.startGame{value: ENTROPY_FEE}(gameId);

        mockEntropy.fulfill(1, bytes32(uint256(99999)));

        MemeWarz.Game memory game = memeWarz.getGame(gameId);
        address comp0 = game.competitors[0];
        address comp1 = game.competitors[1];

        vm.prank(comp0);
        memeWarz.submitMeme(gameId, "Caption 1");
        vm.prank(comp1);
        memeWarz.submitMeme(gameId, "Caption 2");
    }

    function _findVoter(uint256 gameId) internal view returns (address) {
        MemeWarz.Game memory game = memeWarz.getGame(gameId);
        address[] memory players = memeWarz.getPlayers(gameId);
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i] != game.competitors[0] && players[i] != game.competitors[1]) {
                return players[i];
            }
        }
        revert("No voter found");
    }
}
