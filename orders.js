const encode = new TextEncoder();
export async function verifySignature(raw, header, secret, now = Date.now()) {
  if (!secret) return false;
  const fields = String(header || '').split(',').map(v => v.split('='));
  const timestamp = fields.find(([k]) => k === 't')?.[1];
  if (!/^\d+$/.test(timestamp || '') || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', encode.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, encode.encode(`${timestamp}.${raw}`)));
  const expected = [...digest].map(v => v.toString(16).padStart(2,'0')).join('');
  return fields.some(([k,v]) => { if(k !== 'v1' || v?.length !== expected.length) return false; let diff=0; for(let i=0;i<v.length;i++) diff |= v.charCodeAt(i)^expected.charCodeAt(i); return diff===0; });
}
export async function ensureOrders(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS orders (session_id TEXT PRIMARY KEY, order_ref TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', paid_at INTEGER NOT NULL, details TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
}
export async function recordOrder(id, env, stripe) {
  if (!/^cs_(test_|live_)[A-Za-z0-9]+$/.test(id || '')) throw new Error('INVALID_SESSION');
  const response = await stripe(`/v1/checkout/sessions/${id}?expand[]=line_items`, env);
  if (!response.ok) throw new Error('STRIPE_ORDER_UNAVAILABLE');
  const session = await response.json();
  if (session.status !== 'complete' || session.payment_status !== 'paid') return false;
  if (!session.client_reference_id?.startsWith('LVR-')) return false;
  let lines = session.line_items?.data || [];
  if (session.line_items?.has_more) {
    const result = await stripe(`/v1/checkout/sessions/${id}/line_items?limit=100`, env);
    if (!result.ok) throw new Error('STRIPE_ORDER_UNAVAILABLE');
    lines = (await result.json()).data;
  }
  const field = key => session.custom_fields?.find(f => f.key === key)?.text?.value || '';
  const details = {items:lines.map(l=>({name:l.description,quantity:l.quantity,total:l.amount_total})), total:session.amount_total,currency:session.currency, customer:session.customer_details || {}, recipient:field('recipient_name'),dedication:field('dedication'), fulfillment:session.metadata?.fulfillment || 'pickup',deliveryAt:session.metadata?.delivery_at || '',address:session.metadata?.delivery_address_quoted || '',shipping:session.collected_information?.shipping_details || session.shipping_details || null,pickupLeadMinutes:Number(session.metadata?.pickup_lead_minutes || 120),paymentId:session.payment_intent, live:session.livemode};
  await ensureOrders(env);
  Object.assign(details,{senderName:session.metadata?.sender_name||details.customer.name,senderPhone:session.metadata?.sender_phone||details.customer.phone,recipient:session.metadata?.recipient_name||details.recipient,recipientPhone:session.metadata?.recipient_phone||'',courierNote:session.metadata?.courier_note||'',pickupAt:session.metadata?.pickup_at||'',deliveryWindow:session.metadata?.delivery_window||''});
  await env.DB.prepare('INSERT INTO orders (session_id,order_ref,paid_at,details) VALUES (?,?,?,?) ON CONFLICT(session_id) DO NOTHING').bind(id,session.client_reference_id,session.created,JSON.stringify(details)).run();
  return true;
}
export async function orderWebhook(request, env, stripe) {
  if (!env.STRIPE_WEBHOOK_SECRET) return new Response('Webhook no configurado',{status:503});
  const raw = await request.text();
  if (!await verifySignature(raw,request.headers.get('stripe-signature'),env.STRIPE_WEBHOOK_SECRET)) return new Response('Firma no válida',{status:400});
  let event; try {event=JSON.parse(raw);} catch {return new Response('JSON no válido',{status:400});}
  if (['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)) await recordOrder(event.data.object.id,env,stripe);
  return new Response('ok');
}
export async function listOrders(env) {
  await ensureOrders(env);
  const {results} = await env.DB.prepare('SELECT * FROM orders ORDER BY paid_at DESC LIMIT 500').all();
  return results.map(r=>({...JSON.parse(r.details),id:r.session_id,ref:r.order_ref,status:r.status,created:r.paid_at}));
}
