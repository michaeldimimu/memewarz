import express from 'express';
import healthRouter from './health';

const router: express.Router = express.Router();

router.use('/health', healthRouter);

export default router;
