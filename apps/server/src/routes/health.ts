import express from 'express';
import { health } from '../controllers/healthController';

const router: express.Router = express.Router();

router.get('/', health);

export default router;
