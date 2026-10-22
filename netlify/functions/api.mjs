/**
 * Fresh Vegetable Shop: public-only proxy between a Netlify site and Google Apps Script.
 * This function accepts only customer operations; it cannot call the admin dashboard.
 */
const BACKEND = 'https://script.google.com/macros/s/AKfycbzl7o_SvWBe89G2coOCqZgVYFcQHCByCgVZimp7rjOHYoXi1hR0B_lb_fYOiyi5IZ4SqA/exec';
const ACTIONS = new Set(['publicStore', 'placeOrder', 'orderForEdit', 'changeOrder', 'cancelOrder']);
const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer'
};
const result = (value, status = 200) => new Response(JSON.stringify(value), {status, headers: HEADERS});

export default async function handler(request) {
  if (request.method !== 'POST') return result({ok:false,error:'Method not allowed.'},405);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return result({ok:false,error:'Origin not permitted.'},403);
  }
  if (Number(request.headers.get('content-length') || 0) > 18000) {
    return result({ok:false,error:'Request too large.'},413);
  }
  let payload;
  try {
    const raw = await request.text();
    if (raw.length > 18000) return result({ok:false,error:'Request too large.'},413);
    payload = JSON.parse(raw);
  } catch (_) {
    return result({ok:false,error:'Invalid JSON.'},400);
  }
  if (!payload || !ACTIONS.has(payload.action)) {
    return result({ok:false,error:'Unsupported action.'},400);
  }
  try {
    const upstream = await fetch(BACKEND, {
      method: 'POST',
      redirect: 'follow',
      headers: {'content-type': 'text/plain; charset=utf-8'},
      body: JSON.stringify({action: payload.action, payload: payload.payload}),
      signal: AbortSignal.timeout(25000)
    });
    const raw = await upstream.text();
    let data;
    try { data = JSON.parse(raw); }
    catch (_) { return result({ok:false,error:'Shop service returned an unexpected response. Check the Apps Script public deployment.'},502); }
    if (!data || typeof data.ok !== 'boolean') {
      return result({ok:false,error:'Unexpected response from the shop service.'},502);
    }
    return result(data, upstream.ok ? 200 : 502);
  } catch (_) {
    return result({ok:false,error:'Could not reach the shop service. Please retry.'},502);
  }
}

export const config = {path:'/api'};
