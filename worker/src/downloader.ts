import { Hono } from 'hono';

const app = new Hono<{ Bindings: { SUPABASE_URL: string } }>();

const isDeezer = (url: string) => url.includes('deezer.com');
const isYouTube = (url: string) => url.includes('youtube.com') || url.includes('youtu.be') || url.includes('music.youtube.com');

// Helper to validate Supabase JWT
const validateSupabaseJwt = async (token: string, supabaseUrl: string) => {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.ok;
};

app.post('/analyze', async (c) => {
  if (!c.env.SUPABASE_URL) {
    return c.json({ error: 'Server misconfiguration: SUPABASE_URL not defined' }, 500);
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }
  const token = authHeader.replace('Bearer ', '');
  const isValid = await validateSupabaseJwt(token, c.env.SUPABASE_URL);

  if (!isValid) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { url } = await c.req.json();
  if (!url) return c.json({ error: 'Missing URL' }, 400);

  if (isDeezer(url)) {
    return c.json({
      platform: 'deezer',
      title: 'Deezer Track',
      thumbnail: '',
      formats: [
        { id: 'mp3_128', label: 'MP3 128kbps', ext: 'mp3', quality: '128' },
        { id: 'mp3_320', label: 'MP3 320kbps', ext: 'mp3', quality: '320' },
        { id: 'flac', label: 'FLAC', ext: 'flac', quality: 'flac' }
      ]
    });
  }

  if (isYouTube(url)) {
    try {
      const response = await fetch('https://cobalt.tools/api/json', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          vCodec: 'h264',
          vQuality: '1080',
          aFormat: 'mp3',
          filenamePattern: 'pretty',
          isAudioOnly: false
        })
      });

      if (!response.ok) {
        throw new Error('Cobalt API error');
      }

      const data: any = await response.json();

      return c.json({
        platform: url.includes('music.youtube.com') ? 'youtubemusic' : 'youtube',
        title: data.status === 'stream' || data.status === 'redirect' ? 'YouTube Media' : 'YouTube Media',
        thumbnail: '', // Cobalt doesn't reliably give thumbnails in the basic json response without extra work, but we can try if available
        formats: url.includes('music.youtube.com')
          ? [
              { id: 'mp3', label: 'Audio MP3', ext: 'mp3', quality: 'audio', isAudioOnly: true },
              { id: 'm4a', label: 'Audio M4A', ext: 'm4a', quality: 'audio', isAudioOnly: true },
              { id: 'opus', label: 'Audio OPUS', ext: 'opus', quality: 'audio', isAudioOnly: true }
            ]
          : [
              { id: 'mp4_360', label: 'Video 360p', ext: 'mp4', quality: '360', isAudioOnly: false },
              { id: 'mp4_720', label: 'Video 720p', ext: 'mp4', quality: '720', isAudioOnly: false },
              { id: 'mp4_1080', label: 'Video 1080p', ext: 'mp4', quality: '1080', isAudioOnly: false },
              { id: 'mp4_4k', label: 'Video 4K', ext: 'mp4', quality: 'max', isAudioOnly: false },
              { id: 'mp3', label: 'Audio MP3', ext: 'mp3', quality: 'audio', isAudioOnly: true },
              { id: 'm4a', label: 'Audio M4A', ext: 'm4a', quality: 'audio', isAudioOnly: true }
            ]
      });
    } catch (e) {
      console.error(e);
      return c.json({ error: 'Failed to analyze YouTube URL' }, 500);
    }
  }

  return c.json({ error: 'Unsupported URL platform' }, 400);
});

app.post('/download', async (c) => {
  if (!c.env.SUPABASE_URL) {
    return c.json({ error: 'Server misconfiguration: SUPABASE_URL not defined' }, 500);
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }
  const token = authHeader.replace('Bearer ', '');
  const isValid = await validateSupabaseJwt(token, c.env.SUPABASE_URL);

  if (!isValid) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { url, format, quality, audioOnly } = await c.req.json();
  if (!url) return c.json({ error: 'Missing URL' }, 400);

  if (isDeezer(url)) {
    return c.json({ error: 'Deezer requiere configuración de ARL token en variables de entorno. Próximamente.' }, 400);
  }

  if (isYouTube(url)) {
    try {
      const isAudio = audioOnly || format === 'mp3' || format === 'm4a';
      const aFormat = format === 'mp3' ? 'mp3' : format === 'm4a' ? 'm4a' : 'mp3';
      const vQuality = quality === '360' || quality === '720' || quality === '1080' ? quality : '1080';

      const response = await fetch('https://cobalt.tools/api/json', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          vCodec: 'h264',
          vQuality,
          aFormat,
          filenamePattern: 'pretty',
          isAudioOnly: isAudio
        })
      });

      if (!response.ok) {
        throw new Error('Cobalt API error');
      }

      const data: any = await response.json();

      if (data.status === 'error') {
         return c.json({ error: data.text || 'Error downloading media' }, 500);
      }

      // Normally Cobalt returns { status: 'redirect' | 'stream', url: '...' }
      return c.json({
        downloadUrl: data.url,
        filename: `download.${isAudio ? aFormat : 'mp4'}`,
        mimeType: isAudio ? `audio/${aFormat}` : 'video/mp4'
      });
    } catch (e) {
       console.error(e);
       return c.json({ error: 'Failed to process YouTube download' }, 500);
    }
  }

  return c.json({ error: 'Unsupported URL platform' }, 400);
});

export default app;
