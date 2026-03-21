import { Hono } from 'hono';
import { cors } from 'hono/cors';
import downloaderApp from './downloader';

type Bindings = {
  BUCKET: R2Bucket;
  R2_PUBLIC_DOMAIN: string;
  SUPABASE_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors({
  origin: '*', // En producción debería limitarse al dominio de Pages
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Authorization middleware
app.use('*', async (c, next) => {
  if (c.req.method === 'OPTIONS' || (c.req.method === 'GET' && new URL(c.req.url).pathname === '/')) {
    return next();
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  // En un setup estricto, verificaríamos el token de Supabase aquí.
  await next();
});

app.get('/', (c) => c.text('Chat Latino R2 Worker API is running!'));

app.post('/upload/create', async (c) => {
  try {
    const { filename, contentType } = await c.req.json();

    if (!filename || !contentType) {
      return c.json({ error: 'Missing filename or contentType' }, 400);
    }

    const multipartUpload = await c.env.BUCKET.createMultipartUpload(filename, {
      httpMetadata: { contentType },
    });

    return c.json({ uploadId: multipartUpload.uploadId, key: multipartUpload.key });
  } catch (error) {
    console.error('Error creating multipart upload:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

app.put('/upload/part', async (c) => {
  try {
    const url = new URL(c.req.url);
    const uploadId = url.searchParams.get('uploadId');
    const key = url.searchParams.get('key');
    const partNumberStr = url.searchParams.get('partNumber');

    if (!uploadId || !key || !partNumberStr) {
      return c.json({ error: 'Missing query parameters' }, 400);
    }

    const partNumber = parseInt(partNumberStr, 10);
    const multipartUpload = c.env.BUCKET.resumeMultipartUpload(key, uploadId);
    
    // c.req.raw.body is a ReadableStream which can be passed directly
    const uploadedPart = await multipartUpload.uploadPart(partNumber, c.req.raw.body);

    return c.json({ etag: uploadedPart.etag, partNumber: uploadedPart.partNumber });
  } catch (error) {
    console.error('Error uploading part:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

app.post('/upload/complete', async (c) => {
  try {
    const { uploadId, key, parts } = await c.req.json();

    if (!uploadId || !key || !parts || !Array.isArray(parts)) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const multipartUpload = c.env.BUCKET.resumeMultipartUpload(key, uploadId);
    await multipartUpload.complete(parts);

    const r2Domain = c.env.R2_PUBLIC_DOMAIN || 'https://pub-f850fd1c1eb6463dbba2a7c8c94f6267.r2.dev';
    const publicUrl = `${r2Domain}/${key}`;

    return c.json({ url: publicUrl, key });
  } catch (error) {
    console.error('Error completing upload:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

app.delete('/upload/abort', async (c) => {
  try {
    const { uploadId, key } = await c.req.json();

    if (!uploadId || !key) {
      return c.json({ error: 'Missing uploadId or key' }, 400);
    }

    const multipartUpload = c.env.BUCKET.resumeMultipartUpload(key, uploadId);
    await multipartUpload.abort();

    return c.json({ success: true });
  } catch (error) {
    console.error('Error aborting upload:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

app.route('/api/downloader', downloaderApp as any);

export default app;