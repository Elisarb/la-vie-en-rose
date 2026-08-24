const CATALOG = {
  r01:['Pasión Imperial',15000],r02:['Lirio Rosa',9000],r03:['Rosa Fruteto',5000],r04:['Sol de Toscana',5000],r05:['I Love You',10000],r06:['Jardín de Julieta',12000],r07:['Perla Blanca',9600],r08:['Corazón Eterno',21500],r09:['Treinta Latidos',12000],r10:['Luz de Provenza',15000],r11:['Fuego Dorado',9600],r12:['Dúo de Amor',11000],r13:['Belle Époque',10000],r14:['Cien Te Quiero',40000],r15:['Fête des Fleurs',5000],r16:['Primavera Pop',5000],r17:['Petit Rose',2500],r18:['Amour Bicolor',2500],r19:['Rubí Clásico',9600],r20:['Nube Blanca',4000],r21:['Rosée',8000],r22:['Jardín Fucsia',8000],r23:['Jardín de Colette',7000],r24:['Sol y Pasión',6000],r25:['Grand Soleil',10000],r26:['Cinco Soles',2000],r27:['Fruteto Grand',9600],r28:['Seis Besos',2500],r29:['Docena Pasión',4800],r30:['Corazón de Marfil',6000],r31:['Noche Estrellada',6000],r32:['Abrazo de Tulipanes',5000],r33:['Amanecer Tropical',6000],r34:['Jardín Majestuoso',20000],r35:['Sol Dorado',6000],r36:['Couture Rose',10000],r37:['Docena Rubí',6000],r38:['Carnaval Floral',5000],r39:['Rêverie',6000],r40:['Lilas de Ensueño',7000],r41:['Cincuenta Diamantes',20000],r42:['Caja Sol Radiante',10000]
};

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

async function stripe(path, env, init = {}) {
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Stripe todavía no está configurado.' }, 503);
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${env.STRIPE_SECRET_KEY}`);
  return fetch(`https://api.stripe.com${path}`, { ...init, headers });
}

async function createCheckout(request, env) {
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Stripe todavía no está configurado.' }, 503);
  let payload;
  try { payload = await request.json(); } catch { return json({ error: 'Solicitud no válida.' }, 400); }
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length || items.length > 42) return json({ error: 'La cesta está vacía o no es válida.' }, 400);

  const origin = new URL(request.url).origin;
  const form = new URLSearchParams({
    mode: 'payment', locale: 'es',
    success_url: `${origin}/api/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?checkout=cancelled`,
    'phone_number_collection[enabled]': 'true',
    'shipping_address_collection[allowed_countries][0]': 'ES',
    'custom_fields[0][key]': 'recipient_name',
    'custom_fields[0][label][type]': 'custom',
    'custom_fields[0][label][custom]': 'Nombre de quien recibe',
    'custom_fields[0][type]': 'text',
    'custom_fields[0][optional]': 'false',
    'custom_fields[1][key]': 'delivery_date',
    'custom_fields[1][label][type]': 'custom',
    'custom_fields[1][label][custom]': 'Fecha de entrega solicitada',
    'custom_fields[1][type]': 'text',
    'custom_fields[1][optional]': 'false',
    'custom_fields[2][key]': 'dedication',
    'custom_fields[2][label][type]': 'custom',
    'custom_fields[2][label][custom]': 'Dedicatoria (opcional)',
    'custom_fields[2][type]': 'text',
    'custom_fields[2][optional]': 'true'
  });

  items.forEach((item, index) => {
    const product = CATALOG[String(item.id || '')];
    const quantity = Number(item.quantity);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new Error('INVALID_CART');
    form.set(`line_items[${index}][price_data][currency]`, 'eur');
    form.set(`line_items[${index}][price_data][unit_amount]`, String(product[1]));
    form.set(`line_items[${index}][price_data][product_data][name]`, product[0]);
    form.set(`line_items[${index}][quantity]`, String(quantity));
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
  return Response.redirect(`${url.origin}/?checkout=${state}`, 303);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/checkout' && request.method === 'POST') return await createCheckout(request, env);
      if (url.pathname === '/api/checkout/success' && request.method === 'GET') return await confirmCheckout(url, env);
    } catch (error) {
      if (error?.message === 'INVALID_CART') return json({ error: 'La cesta contiene un producto no válido.' }, 400);
      return json({ error: 'No se pudo iniciar el pago.' }, 500);
    }
    return env.ASSETS.fetch(request);
  }
};
