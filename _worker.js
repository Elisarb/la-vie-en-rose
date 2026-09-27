const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra }
});
const encoder = new TextEncoder();
const safeText = (value, max = 160) => String(value ?? '').trim().slice(0, max);
const allowedCategories = new Set(['flores', 'detalles', 'plantas']);

function base64url(bytes) {
  let binary = '';
  new Uint8Array(bytes).forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
async function hmac(value, secret) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64url(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}
function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
async function createSession(env) {
  const payload = base64url(encoder.encode(JSON.stringify({ exp: Date.now() + 8 * 60 * 60 * 1000 })));
  return `${payload}.${await hmac(payload, env.ADMIN_SESSION_SECRET)}`;
}
async function isAdmin(request, env) {
  if (!env.ADMIN_SESSION_SECRET) return false;
  const match = (request.headers.get('cookie') || '').match(/(?:^|;\s*)lvr_admin=([^;]+)/);
  if (!match) return false;
  const [payload, signature] = match[1].split('.');
  if (!payload || !signature || !constantTimeEqual(signature, await hmac(payload, env.ADMIN_SESSION_SECRET))) return false;
  try {
    const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return Number(data.exp) > Date.now();
  } catch { return false; }
}
async function requireAdmin(request, env) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Solicitud no autorizada.' }, 403);
  if (!await isAdmin(request, env)) return json({ error: 'Inicia sesión de nuevo.' }, 401);
  return null;
}
function publicProduct(row) {
  return { id: row.id, name: row.name, description: row.description, price: row.price_cents / 100, category: row.category, badge: row.badge, image: row.image_url, active: Boolean(row.active), sortOrder: row.sort_order };
}
async function listProducts(env, includeInactive = false) {
  const where = includeInactive ? '' : 'WHERE active = 1';
  const { results } = await env.DB.prepare(`SELECT id, name, description, price_cents, category, badge, image_url, active, sort_order FROM products ${where} ORDER BY sort_order, created_at`).all();
  return results.map(publicProduct);
}
async function login(request, env) {
  if (!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) return json({ error: 'El acceso del panel todavía no está configurado.' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Solicitud no válida.' }, 400); }
  const supplied = String(body.password || '');
  if (supplied.length > 200 || !constantTimeEqual(supplied, env.ADMIN_PASSWORD)) return json({ error: 'Contraseña incorrecta.' }, 401);
  const token = await createSession(env);
  return json({ ok: true }, 200, { 'set-cookie': `lvr_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800` });
}
async function saveProduct(request, env, id) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Revisa los datos del producto.' }, 400); }
  const name = safeText(body.name, 90), description = safeText(body.description, 220), badge = safeText(body.badge, 40);
  const category = safeText(body.category, 20).toLowerCase(), imageUrl = safeText(body.image, 500);
  const priceCents = Math.round(Number(body.price) * 100), active = body.active ? 1 : 0;
  const sortOrder = Math.max(0, Math.min(9999, Number.parseInt(body.sortOrder, 10) || 0));
  const safeImage = /^(?:images\/[a-zA-Z0-9_./-]+|\/media\/products\/[a-zA-Z0-9_.-]+|https:\/\/[^\s]+)$/.test(imageUrl);
  if (!name || !description || !allowedCategories.has(category) || !Number.isInteger(priceCents) || priceCents < 100 || priceCents > 1000000 || !safeImage) return json({ error: 'Completa nombre, descripción, categoría, imagen y un precio válido.' }, 400);
  if (request.method === 'POST') {
    const productId = `p_${crypto.randomUUID()}`;
    await env.DB.prepare('INSERT INTO products (id, name, description, price_cents, category, badge, image_url, active, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').bind(productId, name, description, priceCents, category, badge, imageUrl, active, sortOrder).run();
    return json({ ok: true, id: productId }, 201);
  }
  const result = await env.DB.prepare('UPDATE products SET name = ?, description = ?, price_cents = ?, category = ?, badge = ?, image_url = ?, active = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(name, description, priceCents, category, badge, imageUrl, active, sortOrder, id).run();
  if (!result.meta.changes) return json({ error: 'Producto no encontrado.' }, 404);
  return json({ ok: true });
}
async function uploadImage(request, env) {
  const file = (await request.formData()).get('image');
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!(file instanceof File) || !allowed.has(file.type) || file.size < 1 || file.size > 1.5 * 1024 * 1024) return json({ error: 'La foto debe ser JPG, PNG o WebP y ocupar menos de 1,5 MB.' }, 400);
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const key = `products/${crypto.randomUUID()}.${extension}`;
  await env.DB.prepare('INSERT INTO product_images (image_key, content_type, image_data) VALUES (?, ?, ?)').bind(key, file.type, await file.arrayBuffer()).run();
  return json({ url: `/media/${key}` }, 201);
}
async function serveImage(pathname, env) {
  const key = pathname.slice('/media/'.length);
  if (!key || key.includes('..')) return new Response('No encontrado', { status: 404 });
  const row = await env.DB.prepare('SELECT content_type, image_data FROM product_images WHERE image_key = ?').bind(key).first();
  if (!row) return new Response('No encontrado', { status: 404 });
  return new Response(row.image_data, { headers: { 'content-type': row.content_type, 'cache-control': 'public, max-age=31536000, immutable', etag: `"${key}"` } });
}
async function stripe(path, env, init = {}) {
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Stripe todavía no está configurado.' }, 503);
  const headers = new Headers(init.headers); headers.set('authorization', `Bearer ${env.STRIPE_SECRET_KEY}`);
  return fetch(`https://api.stripe.com${path}`, { ...init, headers });
}
const madridClockMinutes = date => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date);
  return Number(parts.find(part => part.type === 'hour')?.value) * 60 + Number(parts.find(part => part.type === 'minute')?.value);
};
function earliestWorkingDelivery(from = new Date()) {
  const cursor = new Date(Math.ceil(from.getTime() / 60000) * 60000); let remaining = 300;
  while (remaining > 0) { const clock = madridClockMinutes(cursor); if (clock >= 600 && clock < 1230) remaining -= 1; cursor.setTime(cursor.getTime() + 60000); }
  return cursor;
}
async function createCheckout(request, env) {
  let payload;
  try { payload = await request.json(); } catch { return json({ error: 'Solicitud no válida.' }, 400); }
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length || items.length > 42) return json({ error: 'La cesta está vacía o no es válida.' }, 400);
  const fulfillment = payload.fulfillment === 'delivery' ? 'delivery' : 'pickup';
  const customerEmail = String(payload.customerEmail || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) || customerEmail.length > 254) return json({ error: 'Introduce un email válido para recibir el comprobante.' }, 400);
  let deliveryAt = '';
  if (fulfillment === 'delivery') {
    const requested = new Date(payload.deliveryAt);
    if (Number.isNaN(requested.getTime()) || requested.getTime() < earliestWorkingDelivery().getTime()) return json({ error: 'La entrega debe solicitarse con al menos 5 horas laborables de antelación.' }, 400);
    const clock = madridClockMinutes(requested);
    if (clock < 600 || clock > 1230) return json({ error: 'La hora de entrega debe estar entre las 10:00 y las 20:30.' }, 400);
    deliveryAt = requested.toISOString();
  }
  const rows = await env.DB.batch(items.map(item => env.DB.prepare('SELECT id, name, price_cents FROM products WHERE id = ? AND active = 1').bind(String(item.id || ''))));
  const products = new Map(rows.map(result => result.results?.[0]).filter(Boolean).map(product => [product.id, product]));
  const origin = new URL(request.url).origin, orderRef = `LVR-${Date.now().toString(36).toUpperCase()}`;
  const form = new URLSearchParams({ mode: 'payment', locale: 'es', success_url: `${origin}/api/checkout/success?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}/?checkout=cancelled`, 'phone_number_collection[enabled]': 'true', 'payment_method_types[0]': 'card', customer_email: customerEmail, 'payment_intent_data[receipt_email]': customerEmail, 'invoice_creation[enabled]': 'true', client_reference_id: orderRef, 'metadata[order_ref]': orderRef, 'metadata[fulfillment]': fulfillment, 'metadata[delivery_at]': deliveryAt, 'custom_fields[0][key]': 'recipient_name', 'custom_fields[0][label][type]': 'custom', 'custom_fields[0][label][custom]': 'Nombre de quien recibe', 'custom_fields[0][type]': 'text', 'custom_fields[0][optional]': 'false', 'custom_fields[1][key]': 'dedication', 'custom_fields[1][label][type]': 'custom', 'custom_fields[1][label][custom]': 'Dedicatoria (opcional)', 'custom_fields[1][type]': 'text', 'custom_fields[1][optional]': 'true' });
  if (fulfillment === 'delivery') {
    form.set('shipping_address_collection[allowed_countries][0]', 'ES'); form.set('shipping_options[0][shipping_rate_data][type]', 'fixed_amount'); form.set('shipping_options[0][shipping_rate_data][fixed_amount][amount]', '790'); form.set('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'eur'); form.set('shipping_options[0][shipping_rate_data][display_name]', 'Entrega Comunidad de Madrid');
  }
  items.forEach((item, index) => {
    const product = products.get(String(item.id || '')), quantity = Number(item.quantity);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new Error('INVALID_CART');
    form.set(`line_items[${index}][price_data][currency]`, 'eur'); form.set(`line_items[${index}][price_data][unit_amount]`, String(product.price_cents)); form.set(`line_items[${index}][price_data][product_data][name]`, product.name); form.set(`line_items[${index}][quantity]`, String(quantity));
  });
  const response = await stripe('/v1/checkout/sessions', env, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form });
  const result = await response.json();
  if (!response.ok || !result.url) return json({ error: result.error?.message || 'No se pudo iniciar el pago.' }, 502);
  return json({ url: result.url });
}
async function confirmCheckout(url, env) {
  const sessionId = url.searchParams.get('session_id');
  if (!sessionId || !/^cs_(test_|live_)[A-Za-z0-9]+$/.test(sessionId)) return Response.redirect(`${url.origin}/?checkout=cancelled`, 303);
  const response = await stripe(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, env);
  if (!response.ok) return Response.redirect(`${url.origin}/?checkout=cancelled`, 303);
  const session = await response.json();
  const state = session.status === 'complete' && session.payment_status === 'paid' ? 'success' : 'cancelled';
  return Response.redirect(`${url.origin}/?checkout=${state}&ref=${encodeURIComponent(session.client_reference_id || 'Confirmado')}`, 303);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/products' && request.method === 'GET') return json(await listProducts(env));
      if (url.pathname === '/api/admin/session' && request.method === 'GET') return json({ authenticated: await isAdmin(request, env) });
      if (url.pathname === '/api/admin/login' && request.method === 'POST') return login(request, env);
      if (url.pathname === '/api/admin/logout' && request.method === 'POST') return json({ ok: true }, 200, { 'set-cookie': 'lvr_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' });
      if (url.pathname === '/api/admin/products' && request.method === 'GET') { const denied = await requireAdmin(request, env); if (denied) return denied; return json(await listProducts(env, true)); }
      if (url.pathname === '/api/admin/products' && request.method === 'POST') { const denied = await requireAdmin(request, env); if (denied) return denied; return saveProduct(request, env); }
      if (url.pathname.startsWith('/api/admin/products/') && ['PUT', 'DELETE'].includes(request.method)) {
        const denied = await requireAdmin(request, env); if (denied) return denied;
        const id = decodeURIComponent(url.pathname.slice('/api/admin/products/'.length));
        if (request.method === 'DELETE') {
          const product = await env.DB.prepare('SELECT image_url FROM products WHERE id = ?').bind(id).first();
          await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
          if (product?.image_url?.startsWith('/media/')) await env.DB.prepare('DELETE FROM product_images WHERE image_key = ?').bind(product.image_url.slice('/media/'.length)).run();
          return json({ ok: true });
        }
        return saveProduct(request, env, id);
      }
      if (url.pathname === '/api/admin/upload' && request.method === 'POST') { const denied = await requireAdmin(request, env); if (denied) return denied; return uploadImage(request, env); }
      if (url.pathname.startsWith('/media/') && request.method === 'GET') return serveImage(url.pathname, env);
      if (url.pathname === '/api/checkout' && request.method === 'POST') return createCheckout(request, env);
      if (url.pathname === '/api/checkout/success' && request.method === 'GET') return confirmCheckout(url, env);
    } catch (error) {
      console.error(error);
      if (error?.message === 'INVALID_CART') return json({ error: 'Algún producto ya no está disponible. Actualiza la página y revisa la cesta.' }, 400);
      return json({ error: 'No se pudo completar la operación. Inténtalo de nuevo.' }, 500);
    }
    return env.ASSETS.fetch(request);
  }
};
