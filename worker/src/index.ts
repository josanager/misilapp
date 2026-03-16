import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

type Bindings = {
  BUCKET: R2Bucket;
  S3_ENDPOINT: string;
  S3_ACCESS_KEY_ID: string;
  S3_SECRET_ACCESS_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors({
  origin: '*', // En producción debería limitarse al dominio de Pages
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

app.get('/', (c) => c.text('Chat Latino R2 Worker API is running!'));

app.post('/generate-upload-url', async (c) => {
  // Simple auth check via Authorization header
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  // TODO: Verify JWT with Supabase using edge-compatible verify logic
  // For now, we trust the token presence. In a strict setup, verify it.

  try {
    const body = await c.req.json();
    const { fileName, contentType } = body;

    if (!fileName || !contentType) {
      return c.json({ error: 'Missing fileName or contentType' }, 400);
    }

    const s3 = new S3Client({
      region: 'auto',
      endpoint: c.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: c.env.S3_ACCESS_KEY_ID,
        secretAccessKey: c.env.S3_SECRET_ACCESS_KEY,
      },
    });

    const command = new PutObjectCommand({
      Bucket: 'chat-latino', // Debe coincidir con el nombre de tu bucket
      Key: fileName,
      ContentType: contentType,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    
    // The public URL where this file will be accessible.
    // For R2, this is the custom domain or the workers.dev domain connected to the bucket.
    // We'll return just the uploadUrl for now, and the client will know the public R2 domain.
    return c.json({ uploadUrl: url, key: fileName });
  } catch (error) {
    console.error('Error generating pre-signed URL:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

app.delete('/delete-file', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  try {
    const body = await c.req.json();
    const { fileName } = body;

    if (!fileName) {
      return c.json({ error: 'Missing fileName' }, 400);
    }

    const s3 = new S3Client({
      region: 'auto',
      endpoint: c.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: c.env.S3_ACCESS_KEY_ID,
        secretAccessKey: c.env.S3_SECRET_ACCESS_KEY,
      },
    });

    const command = new DeleteObjectCommand({
      Bucket: 'chat-latino',
      Key: fileName,
    });

    await s3.send(command);
    
    return c.json({ success: true, key: fileName });
  } catch (error) {
    console.error('Error deleting file:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

export default app;
