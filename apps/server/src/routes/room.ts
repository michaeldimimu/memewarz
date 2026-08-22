import express, { NextFunction, Request, Response } from 'express';
import gameService from '../services/gameService';

const router: express.Router = express.Router();

function asyncRoute(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

function param(req: Request, name: string) {
  const value = req.params[name];
  if (typeof value !== 'string') {
    const error = new Error(`Missing route parameter: ${name}`) as Error & { status: number };
    error.status = 400;
    throw error;
  }
  return value;
}

router.get(
  '/',
  asyncRoute(async (_req, res) => {
    res.json({ games: await gameService.listGames() });
  }),
);

router.post(
  '/',
  asyncRoute(async (req, res) => {
    const game = await gameService.createGame(req.body);
    res.status(201).json({ game });
  }),
);

router.get(
  '/code/:roomCode',
  asyncRoute(async (req, res) => {
    res.json({ game: await gameService.getGameByCode(param(req, 'roomCode')) });
  }),
);

router.get(
  '/:gameId',
  asyncRoute(async (req, res) => {
    res.json({ game: await gameService.getGame(param(req, 'gameId')) });
  }),
);

router.post(
  '/:roomCode/join',
  asyncRoute(async (req, res) => {
    const game = await gameService.joinGame(param(req, 'roomCode'), req.body);
    res.status(201).json({ game });
  }),
);

router.patch(
  '/:gameId/ready',
  asyncRoute(async (req, res) => {
    const game = await gameService.setReady(
      param(req, 'gameId'),
      req.body.playerId,
      Boolean(req.body.isReady),
    );
    res.json({ game });
  }),
);

router.post(
  '/:gameId/rounds',
  asyncRoute(async (req, res) => {
    const round = await gameService.startRound(param(req, 'gameId'), req.body);
    res.status(201).json({ round });
  }),
);

router.post(
  '/rounds/:roundId/memes',
  asyncRoute(async (req, res) => {
    const meme = await gameService.submitMeme(param(req, 'roundId'), req.body);
    res.json({ meme });
  }),
);

router.post(
  '/rounds/:roundId/votes',
  asyncRoute(async (req, res) => {
    const vote = await gameService.castVote(param(req, 'roundId'), req.body);
    res.status(201).json({ vote });
  }),
);

router.post(
  '/rounds/:roundId/finish',
  asyncRoute(async (req, res) => {
    const game = await gameService.finishRound(param(req, 'roundId'));
    res.json({ game });
  }),
);

export default router;
