import express from 'express';
import healthRouter from './health';
import roomRouter from './room';
import templateRouter from './templates';
import memeRouter from './memes';

const router: express.Router = express.Router();

router.use('/health', healthRouter);
router.use('/rooms', roomRouter);
router.use('/templates', templateRouter);
router.use('/memes', memeRouter);

export default router;
