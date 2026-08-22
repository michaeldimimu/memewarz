import express, { Request, Response } from 'express';
import cloudinary from 'cloudinary';

const router: express.Router = express.Router();

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

router.post('/render', async (req: Request, res: Response) => {
  const { templateId, templateUri, topText, bottomText, caption } = req.body;

  const imageUri = templateUri || 'https://picsum.photos/600/600';
  const finalCaption = caption || [topText, bottomText].filter(Boolean).join(' - ');

  res.json({
    templateId,
    imageUri,
    caption: finalCaption,
    status: 'rendered',
  });
});

export default router;
