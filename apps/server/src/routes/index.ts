import express from 'express';
import healthRouter from './health';
import roomRouter from './room';

const router: express.Router = express.Router();

router.use('/health', healthRouter);
router.use('/rooms', roomRouter);

export default router;
