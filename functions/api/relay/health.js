export function onRequestGet() {
  return Response.json({ ok: true, service: 'misil-relay', messageTtlDays: 7 }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
