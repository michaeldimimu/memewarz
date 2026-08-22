import express, { Request, Response } from 'express';
import { publicClient, MEME_WARZ_ABI, MEME_WARZ_ADDRESS } from '../config/contract';

const router: express.Router = express.Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const templateCount = (await publicClient.readContract({
      address: MEME_WARZ_ADDRESS,
      abi: MEME_WARZ_ABI,
      functionName: 'templateCounter',
    })) as bigint;

    const templates = [];
    for (let i = 1n; i <= templateCount; i++) {
      const template = (await publicClient.readContract({
        address: MEME_WARZ_ADDRESS,
        abi: MEME_WARZ_ABI,
        functionName: 'memeTemplates',
        args: [i],
      })) as any;

      templates.push({
        id: Number(template.id || i),
        imageURI: template.imageURI,
      });
    }

    res.json({ templates });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch templates', details: err.message });
  }
});

export default router;
