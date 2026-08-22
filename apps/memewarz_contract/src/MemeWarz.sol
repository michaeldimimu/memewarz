// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IEntropy} from "./interfaces/IEntropy.sol";
import {IEntropyConsumer} from "./interfaces/IEntropyConsumer.sol";

/**
 * @title MemeWarz
 * @notice Production-grade on-chain party game contract built for Monad.
 *
 * @dev RANDOMNESS TRUST MODEL & ARCHITECTURE:
 * 1. Monad L1 Block Variables (`prevrandao`, `blockhash`, `timestamp`) are pseudo-random and
 *    can be influenced or anticipated by validators/sequencers, making them unsafe for financial stakes.
 * 2. This contract integrates Pyth Entropy (a verifiable two-phase commit-reveal randomness protocol).
 * 3. When `startGame` is called, the contract requests entropy via `IEntropy.requestWithCallback`.
 * 4. The Pyth network calls back into `entropyCallback` with verifiable randomness to assign 2 distinct
 *    competitors and random meme templates, advancing the game state to `Submitting`.
 * 5. Room codes (6 digits: 100000..999999) are generated pseudo-randomly at creation with active-collision
 *    checks and freed on game settlement/cancellation so codes can be safely recycled.
 * 6. Prize payouts follow the Checks-Effects-Interactions pattern using pull payments (`claimPrize`),
 *    preventing reentrancy and griefing vectors.
 * 7. TIE-BREAKER RULE: In the event of a tied vote tally, the net prize pool is split 50/50 equally
 *    between both competitors, with any odd remainder wei allocated to the first competitor.
 */
contract MemeWarz is IEntropyConsumer, Ownable2Step, ReentrancyGuard {
    // -------------------------------------------------------------------------
    // Constants & Limits
    // -------------------------------------------------------------------------

    /// @notice Minimum number of joined players needed to start a game (2 competitors + 1 voter).
    uint256 public constant MIN_PLAYERS_TO_START = 3;

    /// @notice Maximum allowed players in a single room to bound gas consumption.
    uint256 public constant MAX_PLAYERS_PER_GAME = 50;

    /// @notice Minimum allowed voting duration (30 seconds).
    uint40 public constant MIN_VOTING_DURATION = 30 seconds;

    /// @notice Maximum allowed voting duration (7 days).
    uint40 public constant MAX_VOTING_DURATION = 7 days;

    /// @notice Maximum platform fee basis points (1000 = 10%).
    uint256 public constant MAX_PLATFORM_FEE_BPS = 1000;

    /// @notice Maximum caption length in bytes (280 characters).
    uint256 public constant MAX_CAPTION_LENGTH = 280;

    // -------------------------------------------------------------------------
    // Enums & Structs
    // -------------------------------------------------------------------------

    enum GameStatus {
        Open,
        Assigning,
        Submitting,
        Voting,
        Finished,
        Cancelled
    }

    enum PlayerRole {
        None,
        Competitor,
        Voter
    }

    struct Game {
        uint256 id;
        string roomName;
        uint32 gameCode; // 6-digit room code (100000..999999)
        address host;
        uint256 prizePool; // in wei, escrowed by contract
        uint256 entryFee; // optional entry fee per joining player (0 = free)
        uint40 votingDuration; // duration in seconds
        uint40 votingStartTime; // timestamp when voting phase started
        GameStatus status;
        address[2] competitors;
        address winner; // outright winner, or address(0) if split tie
        bool prizeClaimed; // true once all prize claims are complete
        uint256 totalVotersCount; // count of eligible voters
        uint256 totalVotesCast; // count of votes submitted
    }

    struct Player {
        address wallet;
        PlayerRole role;
        bool hasJoined;
        bool hasVoted;
        bool hasSubmitted;
    }

    struct MemeEntry {
        uint256 gameId;
        address competitor;
        uint256 memeTemplateId;
        string caption;
        uint256 voteCount;
        uint40 submissionTime;
    }

    struct MemeTemplate {
        uint256 id;
        string imageURI; // ipfs:// or https:// URI pointer
    }

    // -------------------------------------------------------------------------
    // State Variables
    // -------------------------------------------------------------------------

    /// @notice Pyth Entropy contract instance.
    IEntropy public entropy;

    /// @notice Pyth Entropy provider address.
    address public entropyProvider;

    /// @notice Total games created.
    uint256 public gameCounter;

    /// @notice Total meme templates registered.
    uint256 public templateCounter;

    /// @notice Platform fee in basis points (e.g., 250 = 2.5%).
    uint256 public platformFeeBps;

    /// @notice Accumulated platform fees available for withdrawal.
    uint256 public accumulatedPlatformFees;

    /// @notice Internal nonce for room code generation.
    uint256 private _codeNonce;

    // -------------------------------------------------------------------------
    // Mappings
    // -------------------------------------------------------------------------

    /// @notice gameId => Game struct
    mapping(uint256 => Game) public games;

    /// @notice 6-digit active gameCode => gameId (0 if inactive/available)
    mapping(uint32 => uint256) public codeToGameId;

    /// @notice gameId => player address => Player struct
    mapping(uint256 => mapping(address => Player)) public players;

    /// @notice gameId => array of player addresses
    mapping(uint256 => address[]) internal _gamePlayerLists;

    /// @notice gameId => competitor address => MemeEntry
    mapping(uint256 => mapping(address => MemeEntry)) public memeEntries;

    /// @notice gameId => voter address => whether voter has cast vote
    mapping(uint256 => mapping(address => bool)) public hasVotedFor;

    /// @notice templateId (1-indexed) => MemeTemplate struct
    mapping(uint256 => MemeTemplate) public memeTemplates;

    /// @notice Entropy sequenceNumber => gameId
    mapping(uint64 => uint256) public sequenceToGameId;

    /// @notice gameId => recipient address => claimable prize amount (pull payments)
    mapping(uint256 => mapping(address => uint256)) public claimablePrizes;

    // -------------------------------------------------------------------------
    // Custom Errors
    // -------------------------------------------------------------------------

    error InvalidPrizePool();
    error InvalidVotingDuration();
    error InvalidEntryFee();
    error InvalidFeeBps();
    error InvalidCaption();
    error InvalidAddress();
    error InvalidCompetitor();
    error RoomCodeGenerationFailed();
    error GameNotFound();
    error InvalidGameStatus(GameStatus current, GameStatus expected);
    error OnlyHost();
    error OnlyEntropy();
    error OnlyCompetitor();
    error OnlyVoter();
    error AlreadyJoined();
    error AlreadyVoted();
    error AlreadySubmitted();
    error RoomFull();
    error NotEnoughPlayers();
    error VotingPeriodActive();
    error VotingPeriodEnded();
    error VotingNotEnded();
    error NoPrizeToClaim();
    error TransferFailed();
    error InsufficientEntropyFee();

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

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
    event RandomnessRequested(uint256 indexed gameId, uint64 indexed sequenceNumber);
    event CompetitorsAssigned(
        uint256 indexed gameId,
        address indexed competitor1,
        address indexed competitor2,
        uint256 templateId1,
        uint256 templateId2
    );
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
    event GameCancelled(uint256 indexed gameId, uint256 refundAmount);
    event PrizeClaimed(uint256 indexed gameId, address indexed recipient, uint256 amount);
    event TemplateAdded(uint256 indexed templateId, string imageURI);
    event PlatformFeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event PlatformFeesWithdrawn(address indexed recipient, uint256 amount);
    event EntropyConfigUpdated(address indexed entropyContract, address indexed provider);

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyStatus(uint256 gameId, GameStatus expectedStatus) {
        GameStatus current = games[gameId].status;
        if (current != expectedStatus) {
            revert InvalidGameStatus(current, expectedStatus);
        }
        _;
    }

    modifier onlyHost(uint256 gameId) {
        if (msg.sender != games[gameId].host) {
            revert OnlyHost();
        }
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @notice Initializes the MemeWarz contract.
     * @param entropyAddress Address of the Pyth Entropy contract (can be address(0) initially if configured later).
     * @param initialProvider Address of the Pyth Entropy provider.
     * @param initialFeeBps Initial platform fee in basis points (max 1000 = 10%).
     */
    constructor(
        address entropyAddress,
        address initialProvider,
        uint256 initialFeeBps
    ) Ownable(msg.sender) {
        if (initialFeeBps > MAX_PLATFORM_FEE_BPS) revert InvalidFeeBps();
        if (entropyAddress != address(0)) {
            entropy = IEntropy(entropyAddress);
            entropyProvider = initialProvider != address(0)
                ? initialProvider
                : IEntropy(entropyAddress).getDefaultProvider();
        }
        platformFeeBps = initialFeeBps;
    }

    // -------------------------------------------------------------------------
    // Core Game Functions
    // -------------------------------------------------------------------------

    /**
     * @notice Creates a new Meme Warz game room with an escrowed prize pool.
     * @param roomName Human-readable name for the room.
     * @param votingDuration Duration of voting phase in seconds (between 30s and 7 days).
     * @param entryFee Optional fee in wei required for subsequent players to join (0 = free).
     * @return gameId The unique ID of the created game.
     * @return gameCode The 6-digit join code for players.
     */
    function createGame(
        string memory roomName,
        uint40 votingDuration,
        uint256 entryFee
    ) public payable returns (uint256 gameId, uint32 gameCode) {
        if (msg.value == 0) revert InvalidPrizePool();
        if (votingDuration < MIN_VOTING_DURATION || votingDuration > MAX_VOTING_DURATION) {
            revert InvalidVotingDuration();
        }

        unchecked {
            gameId = ++gameCounter;
        }

        gameCode = _generateUniqueGameCode(gameId);
        codeToGameId[gameCode] = gameId;

        Game storage newGame = games[gameId];
        newGame.id = gameId;
        newGame.roomName = roomName;
        newGame.gameCode = gameCode;
        newGame.host = msg.sender;
        newGame.prizePool = msg.value;
        newGame.entryFee = entryFee;
        newGame.votingDuration = votingDuration;
        newGame.status = GameStatus.Open;

        // Auto-enroll host as first player (at zero additional entry fee since host funded the prize pool)
        players[gameId][msg.sender] = Player({
            wallet: msg.sender,
            role: PlayerRole.None,
            hasJoined: true,
            hasVoted: false,
            hasSubmitted: false
        });
        _gamePlayerLists[gameId].push(msg.sender);

        emit GameCreated(
            gameId,
            gameCode,
            msg.sender,
            roomName,
            msg.value,
            entryFee,
            votingDuration
        );
        emit PlayerJoined(gameId, msg.sender, 1);
    }

    /**
     * @notice Convenience overload for creating a free-to-join room.
     */
    function createGame(
        string memory roomName,
        uint40 votingDuration
    ) public payable returns (uint256 gameId, uint32 gameCode) {
        return createGame(roomName, votingDuration, 0);
    }

    /**
     * @notice Joins an open game room using its 6-digit room code.
     * @param gameCode The 6-digit code of the target room.
     */
    function joinGame(uint32 gameCode) external payable {
        uint256 gameId = codeToGameId[gameCode];
        if (gameId == 0) revert GameNotFound();

        Game storage game = games[gameId];
        if (game.status != GameStatus.Open) revert InvalidGameStatus(game.status, GameStatus.Open);
        if (players[gameId][msg.sender].hasJoined) revert AlreadyJoined();
        if (msg.value != game.entryFee) revert InvalidEntryFee();

        uint256 currentCount = _gamePlayerLists[gameId].length;
        if (currentCount >= MAX_PLAYERS_PER_GAME) revert RoomFull();

        players[gameId][msg.sender] = Player({
            wallet: msg.sender,
            role: PlayerRole.None,
            hasJoined: true,
            hasVoted: false,
            hasSubmitted: false
        });
        _gamePlayerLists[gameId].push(msg.sender);

        if (msg.value > 0) {
            game.prizePool += msg.value;
        }

        emit PlayerJoined(gameId, msg.sender, currentCount + 1);
    }

    /**
     * @notice Starts the game, initiating randomness to select 2 competitors and assign meme templates.
     * @dev Only the room host can start the game. Requires at least 3 players.
     *      Pass msg.value >= entropy fee if Pyth Entropy fee is required.
     * @param gameId The ID of the game to start.
     */
    function startGame(uint256 gameId) external payable onlyHost(gameId) onlyStatus(gameId, GameStatus.Open) {
        address[] storage playerList = _gamePlayerLists[gameId];
        if (playerList.length < MIN_PLAYERS_TO_START) revert NotEnoughPlayers();

        Game storage game = games[gameId];
        game.status = GameStatus.Assigning;

        // Pyth Entropy Randomness Integration
        if (address(entropy) != address(0)) {
            uint256 fee = entropy.getFee(entropyProvider);
            if (msg.value < fee) revert InsufficientEntropyFee();

            bytes32 userSeed = keccak256(
                abi.encodePacked(block.timestamp, block.prevrandao, msg.sender, gameId)
            );

            uint64 sequenceNumber = entropy.requestWithCallback{value: fee}(
                entropyProvider,
                userSeed
            );
            sequenceToGameId[sequenceNumber] = gameId;

            // Refund any excess entropy fee sent
            if (msg.value > fee) {
                (bool refundSuccess, ) = msg.sender.call{value: msg.value - fee}("");
                if (!refundSuccess) revert TransferFailed();
            }

            emit RandomnessRequested(gameId, sequenceNumber);
        } else {
            // Fallback for mock/local testing environments without live Pyth Entropy oracle
            bytes32 mockRandom = keccak256(
                abi.encodePacked(block.timestamp, block.prevrandao, msg.sender, gameId)
            );
            _assignCompetitorsAndTemplates(gameId, mockRandom);
        }
    }

    /**
     * @notice Pyth Entropy callback to fulfill randomness, pick 2 competitors, and allocate meme templates.
     * @dev Only callable by the configured Pyth Entropy contract.
     * @param sequenceNumber Sequence number assigned to the request.
     * @param provider Provider who fulfilled the entropy request.
     * @param randomNumber Verifiable random bytes32 from Pyth.
     */
    function entropyCallback(
        uint64 sequenceNumber,
        address provider,
        bytes32 randomNumber
    ) external override {
        if (msg.sender != address(entropy)) revert OnlyEntropy();

        uint256 gameId = sequenceToGameId[sequenceNumber];
        if (gameId == 0) revert GameNotFound();

        delete sequenceToGameId[sequenceNumber];

        if (games[gameId].status != GameStatus.Assigning) {
            revert InvalidGameStatus(games[gameId].status, GameStatus.Assigning);
        }

        _assignCompetitorsAndTemplates(gameId, randomNumber);
    }

    /**
     * @notice Submits a caption for the caller's assigned meme template.
     * @dev Competitor-only. When both competitors submit, status auto-transitions to Voting.
     * @param gameId ID of the game.
     * @param caption The meme caption text (max 280 bytes).
     */
    function submitMeme(
        uint256 gameId,
        string calldata caption
    ) external onlyStatus(gameId, GameStatus.Submitting) {
        bytes memory captionBytes = bytes(caption);
        if (captionBytes.length == 0 || captionBytes.length > MAX_CAPTION_LENGTH) {
            revert InvalidCaption();
        }

        Player storage player = players[gameId][msg.sender];
        if (player.role != PlayerRole.Competitor) revert OnlyCompetitor();
        if (player.hasSubmitted) revert AlreadySubmitted();

        player.hasSubmitted = true;
        MemeEntry storage entry = memeEntries[gameId][msg.sender];
        entry.caption = caption;
        entry.submissionTime = uint40(block.timestamp);

        emit MemeSubmitted(gameId, msg.sender, entry.memeTemplateId, caption);

        // Check if both competitors have completed their submissions
        Game storage game = games[gameId];
        address comp0 = game.competitors[0];
        address comp1 = game.competitors[1];

        if (players[gameId][comp0].hasSubmitted && players[gameId][comp1].hasSubmitted) {
            game.status = GameStatus.Voting;
            game.votingStartTime = uint40(block.timestamp);
            emit VotingStarted(gameId, game.votingStartTime, game.votingDuration);
        }
    }

    /**
     * @notice Casts a vote for one of the two Meme Creators.
     * @dev Voter-only, single vote per voter, only during the voting period.
     * @param gameId ID of the game.
     * @param competitor The address of the competitor being voted for.
     */
    function vote(
        uint256 gameId,
        address competitor
    ) external onlyStatus(gameId, GameStatus.Voting) {
        Game storage game = games[gameId];
        if (block.timestamp >= uint256(game.votingStartTime) + uint256(game.votingDuration)) {
            revert VotingPeriodEnded();
        }

        Player storage voterPlayer = players[gameId][msg.sender];
        if (!voterPlayer.hasJoined || voterPlayer.role != PlayerRole.Voter) {
            revert OnlyVoter();
        }
        if (voterPlayer.hasVoted) revert AlreadyVoted();

        if (competitor != game.competitors[0] && competitor != game.competitors[1]) {
            revert InvalidCompetitor();
        }

        voterPlayer.hasVoted = true;
        hasVotedFor[gameId][msg.sender] = true;
        memeEntries[gameId][competitor].voteCount++;
        game.totalVotesCast++;

        emit VoteCast(gameId, msg.sender, competitor);
    }

    /**
     * @notice Concludes voting, tallies the votes, resolves ties, and escrows the prize for pull-payment claim.
     * @dev Callable by anyone once voting duration ends or all eligible voters have voted.
     * @param gameId ID of the game.
     */
    function endVotingAndSettle(uint256 gameId) external onlyStatus(gameId, GameStatus.Voting) {
        Game storage game = games[gameId];

        bool timeElapsed = block.timestamp >= uint256(game.votingStartTime) + uint256(game.votingDuration);
        bool allVoted = (game.totalVotersCount > 0 && game.totalVotesCast == game.totalVotersCount);

        if (!timeElapsed && !allVoted) revert VotingNotEnded();

        address comp0 = game.competitors[0];
        address comp1 = game.competitors[1];
        uint256 votes0 = memeEntries[gameId][comp0].voteCount;
        uint256 votes1 = memeEntries[gameId][comp1].voteCount;

        // Calculate platform fee and net prize
        uint256 platformFee = (game.prizePool * platformFeeBps) / 10000;
        uint256 netPrize = game.prizePool - platformFee;
        if (platformFee > 0) {
            accumulatedPlatformFees += platformFee;
        }

        address winner;
        if (votes0 > votes1) {
            winner = comp0;
            claimablePrizes[gameId][comp0] = netPrize;
        } else if (votes1 > votes0) {
            winner = comp1;
            claimablePrizes[gameId][comp1] = netPrize;
        } else {
            // TIE-BREAKER: Split net prize 50/50 between both competitors
            winner = address(0); // address(0) indicates a tie split
            uint256 halfPrize0 = netPrize / 2;
            uint256 halfPrize1 = netPrize - halfPrize0; // accounts for any odd wei
            claimablePrizes[gameId][comp0] = halfPrize0;
            claimablePrizes[gameId][comp1] = halfPrize1;
        }

        game.winner = winner;
        game.status = GameStatus.Finished;

        // Free room code for reuse
        delete codeToGameId[game.gameCode];

        emit VotingEnded(gameId, winner, votes0, votes1, netPrize);
        emit GameFinished(gameId, winner, netPrize);
    }

    /**
     * @notice Pull-payment claim for winning competitor(s).
     * @dev Guarded against reentrancy with checks-effects-interactions.
     * @param gameId ID of the finished game.
     */
    function claimPrize(uint256 gameId) external nonReentrant {
        if (games[gameId].status != GameStatus.Finished) {
            revert InvalidGameStatus(games[gameId].status, GameStatus.Finished);
        }

        uint256 amount = claimablePrizes[gameId][msg.sender];
        if (amount == 0) revert NoPrizeToClaim();

        // Effect
        claimablePrizes[gameId][msg.sender] = 0;

        Game storage game = games[gameId];
        address comp0 = game.competitors[0];
        address comp1 = game.competitors[1];
        if (claimablePrizes[gameId][comp0] == 0 && claimablePrizes[gameId][comp1] == 0) {
            game.prizeClaimed = true;
        }

        // Interaction
        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit PrizeClaimed(gameId, msg.sender, amount);
    }

    /**
     * @notice Cancels an open game room and refunds all escrowed funds (host prize pool + joined entry fees).
     * @dev Only callable by host before the game transitions out of Open.
     * @param gameId ID of the game to cancel.
     */
    function cancelGame(uint256 gameId) external nonReentrant onlyHost(gameId) onlyStatus(gameId, GameStatus.Open) {
        Game storage game = games[gameId];
        game.status = GameStatus.Cancelled;

        // Free room code
        delete codeToGameId[game.gameCode];

        address[] storage playerList = _gamePlayerLists[gameId];
        uint256 entryFee = game.entryFee;
        address hostAddr = game.host;

        // Refund joined players (excluding host who gets initial prize pool refund)
        if (entryFee > 0) {
            uint256 len = playerList.length;
            for (uint256 i = 0; i < len; ) {
                address playerAddr = playerList[i];
                if (playerAddr != hostAddr) {
                    (bool playerSent, ) = playerAddr.call{value: entryFee}("");
                    if (!playerSent) revert TransferFailed();
                }
                unchecked {
                    ++i;
                }
            }
        }

        // Refund host remaining prize pool (initial deposit)
        uint256 refundHost = game.prizePool - ((playerList.length > 1 ? playerList.length - 1 : 0) * entryFee);
        (bool hostSent, ) = hostAddr.call{value: refundHost}("");
        if (!hostSent) revert TransferFailed();

        emit GameCancelled(gameId, game.prizePool);
    }

    // -------------------------------------------------------------------------
    // Internal & Helper Functions
    // -------------------------------------------------------------------------

    /**
     * @notice Internal logic to select 2 competitors and allocate meme templates using verifiable randomness.
     */
    function _assignCompetitorsAndTemplates(uint256 gameId, bytes32 randomSeed) internal {
        Game storage game = games[gameId];
        address[] storage playerList = _gamePlayerLists[gameId];
        uint256 playerCount = playerList.length;

        // Sample 2 distinct random competitor indices
        uint256 randWord0 = uint256(keccak256(abi.encodePacked(randomSeed, uint256(1))));
        uint256 randWord1 = uint256(keccak256(abi.encodePacked(randomSeed, uint256(2))));
        uint256 randT0 = uint256(keccak256(abi.encodePacked(randomSeed, uint256(3))));
        uint256 randT1 = uint256(keccak256(abi.encodePacked(randomSeed, uint256(4))));

        uint256 idx0 = randWord0 % playerCount;
        uint256 idx1 = randWord1 % (playerCount - 1);
        if (idx1 >= idx0) {
            unchecked {
                idx1 += 1;
            }
        }

        address comp0 = playerList[idx0];
        address comp1 = playerList[idx1];

        game.competitors[0] = comp0;
        game.competitors[1] = comp1;

        // Assign roles: chosen 2 become Competitors, all others become Voters
        for (uint256 i = 0; i < playerCount; ) {
            address p = playerList[i];
            if (p == comp0 || p == comp1) {
                players[gameId][p].role = PlayerRole.Competitor;
            } else {
                players[gameId][p].role = PlayerRole.Voter;
            }
            unchecked {
                ++i;
            }
        }
        game.totalVotersCount = playerCount - 2;

        // Assign Meme Templates (from registry or default 1 & 2)
        uint256 tCount = templateCounter;
        uint256 templateId0 = tCount > 0 ? (randT0 % tCount) + 1 : 1;
        uint256 templateId1 = tCount > 0 ? (randT1 % tCount) + 1 : 2;
        if (tCount >= 2 && templateId1 == templateId0) {
            templateId1 = (templateId0 % tCount) + 1;
        }

        memeEntries[gameId][comp0] = MemeEntry({
            gameId: gameId,
            competitor: comp0,
            memeTemplateId: templateId0,
            caption: "",
            voteCount: 0,
            submissionTime: 0
        });

        memeEntries[gameId][comp1] = MemeEntry({
            gameId: gameId,
            competitor: comp1,
            memeTemplateId: templateId1,
            caption: "",
            voteCount: 0,
            submissionTime: 0
        });

        game.status = GameStatus.Submitting;

        emit CompetitorsAssigned(gameId, comp0, comp1, templateId0, templateId1);
    }

    /**
     * @notice Generates a unique 6-digit room code (100000..999999) without active collisions.
     */
    function _generateUniqueGameCode(uint256 gameId) internal returns (uint32) {
        uint32 code;
        uint256 attempts = 0;

        do {
            unchecked {
                ++_codeNonce;
                ++attempts;
            }
            if (attempts > 100) revert RoomCodeGenerationFailed();

            uint256 rand = uint256(
                keccak256(
                    abi.encodePacked(
                        block.timestamp,
                        block.prevrandao,
                        msg.sender,
                        gameId,
                        _codeNonce
                    )
                )
            );
            code = uint32(100_000 + (rand % 900_000));
        } while (codeToGameId[code] != 0);

        return code;
    }

    // -------------------------------------------------------------------------
    // View Functions
    // -------------------------------------------------------------------------

    /**
     * @notice Returns complete Game details by gameId.
     */
    function getGame(uint256 gameId) external view returns (Game memory) {
        return games[gameId];
    }

    /**
     * @notice Returns complete Game details by 6-digit gameCode.
     */
    function getGameByCode(uint32 gameCode) external view returns (Game memory) {
        uint256 gameId = codeToGameId[gameCode];
        if (gameId == 0) revert GameNotFound();
        return games[gameId];
    }

    /**
     * @notice Returns array of all joined player addresses for a game.
     */
    function getPlayers(uint256 gameId) external view returns (address[] memory) {
        return _gamePlayerLists[gameId];
    }

    /**
     * @notice Returns Player struct for a specific wallet in a game.
     */
    function getPlayer(uint256 gameId, address playerAddr) external view returns (Player memory) {
        return players[gameId][playerAddr];
    }

    /**
     * @notice Returns both MemeEntry structs for the game's two competitors.
     */
    function getMemeEntries(
        uint256 gameId
    ) external view returns (MemeEntry memory comp0Entry, MemeEntry memory comp1Entry) {
        Game storage game = games[gameId];
        comp0Entry = memeEntries[gameId][game.competitors[0]];
        comp1Entry = memeEntries[gameId][game.competitors[1]];
    }

    /**
     * @notice Returns a registered meme template by ID.
     */
    function getTemplate(uint256 templateId) external view returns (MemeTemplate memory) {
        return memeTemplates[templateId];
    }

    /**
     * @notice Returns all registered meme templates.
     */
    function getTemplates() external view returns (MemeTemplate[] memory) {
        uint256 count = templateCounter;
        MemeTemplate[] memory list = new MemeTemplate[](count);
        for (uint256 i = 1; i <= count; ) {
            list[i - 1] = memeTemplates[i];
            unchecked {
                ++i;
            }
        }
        return list;
    }

    /**
     * @notice Returns the address of the Pyth Entropy contract (IEntropyConsumer requirement).
     */
    function getEntropy() external view override returns (address) {
        return address(entropy);
    }

    // -------------------------------------------------------------------------
    // Admin & Configuration
    // -------------------------------------------------------------------------

    /**
     * @notice Registers a new meme template pointer.
     * @param imageURI IPFS URI or HTTPS pointer for the meme template image.
     */
    function addMemeTemplate(string calldata imageURI) external onlyOwner returns (uint256 templateId) {
        unchecked {
            templateId = ++templateCounter;
        }
        memeTemplates[templateId] = MemeTemplate({id: templateId, imageURI: imageURI});
        emit TemplateAdded(templateId, imageURI);
    }

    /**
     * @notice Batch registers multiple meme templates.
     * @param imageURIs Array of IPFS/HTTPS image pointers.
     */
    function batchAddMemeTemplates(string[] calldata imageURIs) external onlyOwner {
        uint256 len = imageURIs.length;
        for (uint256 i = 0; i < len; ) {
            unchecked {
                uint256 templateId = ++templateCounter;
                memeTemplates[templateId] = MemeTemplate({id: templateId, imageURI: imageURIs[i]});
                emit TemplateAdded(templateId, imageURIs[i]);
                ++i;
            }
        }
    }

    /**
     * @notice Updates the platform fee basis points (capped at 10%).
     */
    function setPlatformFeeBps(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_PLATFORM_FEE_BPS) revert InvalidFeeBps();
        emit PlatformFeeUpdated(platformFeeBps, newFeeBps);
        platformFeeBps = newFeeBps;
    }

    /**
     * @notice Updates the Pyth Entropy configuration.
     */
    function setEntropyConfig(address newEntropy, address newProvider) external onlyOwner {
        entropy = IEntropy(newEntropy);
        entropyProvider = newProvider;
        emit EntropyConfigUpdated(newEntropy, newProvider);
    }

    /**
     * @notice Withdraws accumulated platform fees to the specified recipient.
     */
    function withdrawPlatformFees(address recipient) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert InvalidAddress();
        uint256 amount = accumulatedPlatformFees;
        if (amount == 0) revert NoPrizeToClaim();

        accumulatedPlatformFees = 0;

        (bool sent, ) = recipient.call{value: amount}("");
        if (!sent) revert TransferFailed();

        emit PlatformFeesWithdrawn(recipient, amount);
    }
}
