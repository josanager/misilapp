import {
  capacitySnapshot,
  ensureNetworkSchema,
  handleError,
  networkDatabase,
  networkMethodNotAllowed,
} from './_shared.js';

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (context.request.method !== 'GET') return networkMethodNotAllowed('GET');
  try {
    const db = networkDatabase(context.env.RELAY_DB);
    await ensureNetworkSchema(db);
    return Response.json(await capacitySnapshot(db), {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'",
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
