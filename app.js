const CONFIG = { whatsapp: '34667406351', stripeCheckoutEndpoint: window.STRIPE_CHECKOUT_ENDPOINT || '' };

const rawProducts = [
  ['Pasión Imperial','Ramo de 30 rosas rojas y 4 lirios',150,'flores','Imponente'],
  ['Lirio Rosa','Ramo de 10 lirios y 6 rosas',90,'flores','Elegante'],
  ['Rosa Fruteto','Ramo de 12 rosas Fruteto',50,'flores','Delicado'],
  ['Sol de Toscana','Ramo de 12 girasoles',50,'flores','Luminoso'],
  ['I Love You','Caja de rosas rojas con mensaje',100,'detalles','Romántico'],
  ['Jardín de Julieta','Ramo de 24 rosas y 3 lirios',120,'flores','Generoso'],
  ['Perla Blanca','Ramo de 24 rosas blancas',96,'flores','Sereno'],
  ['Corazón Eterno','Caja corazón con 50 rosas rojas',215,'detalles','Gran gesto'],
  ['Treinta Latidos','Ramo de 30 rosas rojas',120,'flores','Pasión'],
  ['Luz de Provenza','Gran ramo variado en tonos amarillos',150,'flores','Exclusivo'],
  ['Fuego Dorado','Ramo de 24 rosas rojas y amarillas',96,'flores','Vibrante'],
  ['Dúo de Amor','Ramo de 25 rosas rojas y rosas',110,'flores','Bicolor'],
  ['Belle Époque','Ramo variado con tulipanes e hortensias',100,'flores','Sofisticado'],
  ['Cien Te Quiero','Ramo de 100 rosas rojas',400,'flores','Extraordinario'],
  ['Fête des Fleurs','Ramo de tulipanes y gerberas',50,'flores','Alegre'],
  ['Primavera Pop','Ramo de tulipanes y gerberas',50,'flores','Colorido'],
  ['Petit Rose','Ramo de 6 rosas rosadas',25,'flores','Pequeño gesto'],
  ['Amour Bicolor','Ramo de 6 rosas rojas y blancas',25,'flores','Dulce'],
  ['Rubí Clásico','Ramo de 24 rosas rojas',96,'flores','Clásico'],
  ['Nube Blanca','Ramo variado en tonos blancos',40,'flores','Puro'],
  ['Rosée','Ramo variado en tonos rosa',80,'flores','Romántico'],
  ['Jardín Fucsia','Ramo variado en fucsia y rosa',80,'flores','Vibrante'],
  ['Jardín de Colette','Ramo variado en tonos empolvados',70,'flores','Artesanal'],
  ['Sol y Pasión','Ramo de girasoles y rosas rojas',60,'flores','Contraste'],
  ['Grand Soleil','Ramo de 20 girasoles',100,'flores','Espectacular'],
  ['Cinco Soles','Ramo de 5 girasoles',20,'flores','Luminoso'],
  ['Fruteto Grand','Ramo de 24 rosas Fruteto',96,'flores','Exclusivo'],
  ['Seis Besos','Ramo de 6 rosas rojas',25,'flores','Detalle'],
  ['Docena Pasión','Ramo de 12 rosas rojas',48,'flores','Favorito'],
  ['Corazón de Marfil','Caja corazón con 12 rosas rojas y blancas',60,'detalles','Romántico'],
  ['Noche Estrellada','Ramo azul, blanco y amarillo',60,'flores','Original'],
  ['Abrazo de Tulipanes','Caja con tulipanes y osito',50,'detalles','Tierno'],
  ['Amanecer Tropical','Ramo con orquídeas, girasoles y rosas',60,'flores','Exótico'],
  ['Jardín Majestuoso','Gran composición floral variada',200,'flores','Gran formato'],
  ['Sol Dorado','Ramo amarillo con girasoles y tulipanes',60,'flores','Solar'],
  ['Couture Rose','Sombrerera de rosas rosadas',100,'detalles','Premium'],
  ['Docena Rubí','Ramo de 12 rosas rojas',60,'flores','Intenso'],
  ['Carnaval Floral','Ramo variado de gran formato',50,'flores','Festivo'],
  ['Rêverie','Ramo variado en rosa y blanco',60,'flores','Soñador'],
  ['Lilas de Ensueño','Ramo variado en tonos lilas',70,'flores','Delicado'],
  ['Cincuenta Diamantes','Ramo de 50 rosas rojas con brillo',200,'flores','Deslumbrante'],
  ['Caja Sol Radiante','Caja de 20 girasoles',100,'detalles','Luminoso']
];

let products = rawProducts.map((p, index) => ({ id: `r${String(index + 1).padStart(2, '0')}`, name: p[0], description: p[1], price: p[2], category: p[3], badge: p[4], image: `images/productos/ramo-${String(index + 1).padStart(2, '0')}.jpg` })).filter(product => product.id !== 'r15');
let cart = JSON.parse(localStorage.getItem('lavie-cart') || '{}');
let activeFilter = 'todos';
const euro = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const productGrid = document.querySelector('#product-grid'), toast = document.querySelector('#toast'), drawer = document.querySelector('#cart'), overlay = document.querySelector('#cart-overlay');
document.querySelector('#delivery-quote-status').insertAdjacentHTML('afterend', '<small class="map-credit">Ubicación con datos de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>.</small>');
document.querySelector('[name="fulfillment"][value="pickup"]').closest('label').insertAdjacentHTML('afterend', '<p id="pickup-ready" class="pickupReady">Disponible para recoger aproximadamente en <strong>2 horas laborables</strong>.</p>');
let toastTimer;
let shopSettings = { pickupLeadMinutes: 60, deliveryLeadMinutes: 300 };
let deliveryQuote = null;
let fulfillment = 'pickup';

function earliestWorkingDelivery(from = new Date(), leadMinutes = shopSettings.deliveryLeadMinutes) {
  const cursor = new Date(from);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);
  let remaining = leadMinutes;
  while (remaining > 0) {
    const minutes = cursor.getHours() * 60 + cursor.getMinutes();
    if (minutes < 10 * 60) cursor.setHours(10, 0, 0, 0);
    else if (minutes >= 20 * 60 + 30) { cursor.setDate(cursor.getDate() + 1); cursor.setHours(10, 0, 0, 0); }
    else { cursor.setMinutes(cursor.getMinutes() + 1); remaining -= 1; }
  }
  cursor.setMinutes(Math.ceil(cursor.getMinutes() / 30) * 30, 0, 0);
  if (cursor.getHours() * 60 + cursor.getMinutes() > 20 * 60 + 30) { cursor.setDate(cursor.getDate() + 1); cursor.setHours(10, 0, 0, 0); }
  return cursor;
}

function localDateTime(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`; }

function renderProducts() {
  const visible = products.filter(p => activeFilter === 'todos' || p.category === activeFilter);
  if (!visible.length) { productGrid.innerHTML = '<div class="emptyCategory"><span>❀</span><h3>Muy pronto</h3><p>Estamos preparando esta colección. Escríbenos por WhatsApp si buscas algo especial.</p></div>'; return; }
  productGrid.innerHTML = visible.map(p => `<article class="productCard"><div class="productImage" style="background-image:url(&quot;${escapeHtml(p.image)}&quot;)"><span>${escapeHtml(p.badge)}</span><button class="quickAdd" data-add="${escapeHtml(p.id)}" aria-label="Añadir ${escapeHtml(p.name)}">＋</button></div><div class="productInfo"><small>${escapeHtml(p.category)}</small><div><h3>${escapeHtml(p.name)}</h3><strong>${euro(p.price)}</strong></div><p>${escapeHtml(p.description)}</p><button class="addButton" data-add="${escapeHtml(p.id)}">Añadir a la cesta <span>＋</span></button></div></article>`).join('');
}
async function loadCatalog() {
  try {
    const response = await fetch('/api/products', { headers: { accept: 'application/json' } });
    const catalog = await response.json();
    if (!response.ok || !Array.isArray(catalog)) throw new Error('CATALOG_UNAVAILABLE');
    products = catalog;
    Object.keys(cart).forEach(id => { if (!products.some(product => product.id === id)) delete cart[id]; });
    localStorage.setItem('lavie-cart', JSON.stringify(cart));
    renderProducts();
    renderCart();
  } catch {
    // El catálogo incluido mantiene la tienda visible si la conexión falla puntualmente.
  }
}
async function loadShopSettings() {
  try {
    const response = await fetch('/api/settings', { headers: { accept: 'application/json' } });
    if (!response.ok) return;
    shopSettings = await response.json();
    document.querySelector('#delivery-time-help').textContent = `Mínimo ${formatDuration(shopSettings.deliveryLeadMinutes)} laborables · Horario 10:00–20:30`;
    document.querySelector('#urgent-delivery-note').firstChild.textContent = `¿Lo necesitas antes de ${formatDuration(shopSettings.deliveryLeadMinutes)}? `;
    document.querySelector('#pickup-ready strong').textContent = `${formatDuration(shopSettings.pickupLeadMinutes)} laborables`;
    updateFulfillmentNote();
  } catch { /* Se mantienen valores seguros si el servicio no responde. */ }
}
function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} minutos`;
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
}
function updateFulfillmentNote() {
  const note = document.querySelector('#delivery-note');
  if (fulfillment === 'pickup') note.textContent = `Recogida gratuita. Preparado aproximadamente en ${formatDuration(shopSettings.pickupLeadMinutes)} laborables.`;
  else if (deliveryQuote) note.textContent = `Delivery ${euro(deliveryQuote.fee)} · distancia estimada ${deliveryQuote.distanceKm} km.`;
  else note.textContent = 'Introduce la dirección para calcular el delivery.';
}
function saveCart() { localStorage.setItem('lavie-cart', JSON.stringify(cart)); renderCart(); }
function add(id) { cart[id] = (cart[id] || 0) + 1; saveCart(); show('Añadido a tu cesta ♡'); }
function change(id, delta) { cart[id] = (cart[id] || 0) + delta; if (cart[id] <= 0) delete cart[id]; saveCart(); }
function cartLines() { return Object.entries(cart).map(([id, qty]) => ({ product: products.find(p => p.id === id), qty })).filter(x => x.product); }
function renderCart() { const lines = cartLines(), count = lines.reduce((n, x) => n + x.qty, 0), subtotal = lines.reduce((n, x) => n + x.product.price * x.qty, 0), total = subtotal + (fulfillment === 'delivery' && deliveryQuote ? deliveryQuote.fee : 0); document.querySelector('#cart-count').textContent = count; document.querySelector('#drawer-count').textContent = count; document.querySelector('#cart-total').textContent = euro(total); document.querySelector('#cart-empty').hidden = lines.length > 0; document.querySelector('#cart-items').innerHTML = lines.map(({ product: p, qty }) => `<div class="cartItem"><div class="cartThumb" style="background-image:url(&quot;${escapeHtml(p.image)}&quot;)"></div><div class="cartItemCopy"><h3>${escapeHtml(p.name)}</h3><p>${euro(p.price)}</p><div class="quantity"><button data-change="-1" data-id="${escapeHtml(p.id)}" aria-label="Quitar uno">−</button><span>${qty}</span><button data-change="1" data-id="${escapeHtml(p.id)}" aria-label="Añadir uno">＋</button></div></div><button class="remove" data-remove="${escapeHtml(p.id)}" aria-label="Eliminar ${escapeHtml(p.name)}">×</button></div>`).join(''); document.querySelector('.cartSummary').hidden = !lines.length; }
function openCart() { drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); overlay.hidden = false; document.body.classList.add('noScroll'); }
function closeCart() { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); overlay.hidden = true; document.body.classList.remove('noScroll'); }
function show(message) { toast.textContent = message; toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.hidden = true, 2600); }
function whatsapp(message) { window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(message)}`, '_blank', 'noopener'); }
function orderMessage() { const lines = cartLines(); return `Hola, me interesa esta cesta de La Vie en Rose:\n${lines.map(x => `• ${x.qty} × ${x.product.name} — ${euro(x.product.price * x.qty)}`).join('\n')}\nTotal productos: ${euro(lines.reduce((n, x) => n + x.product.price * x.qty, 0))}\n¿Podemos confirmar entrega y disponibilidad?`; }

productGrid.addEventListener('click', e => { const button = e.target.closest('[data-add]'); if (button) add(button.dataset.add); });
document.querySelector('.categoryTabs').addEventListener('click', e => { const button = e.target.closest('[data-filter]'); if (!button) return; activeFilter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b === button)); renderProducts(); });
document.addEventListener('click', e => { const category = e.target.closest('[data-category]'); if (category) { activeFilter = category.dataset.category; document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === activeFilter)); renderProducts(); } const wa = e.target.closest('.whatsapp-link'); if (wa) { e.preventDefault(); whatsapp(wa.dataset.message); } });
document.querySelector('#cart-items').addEventListener('click', e => { const c = e.target.closest('[data-change]'), r = e.target.closest('[data-remove]'); if (c) change(c.dataset.id, Number(c.dataset.change)); if (r) { delete cart[r.dataset.remove]; saveCart(); } });
document.querySelector('#open-cart').addEventListener('click', openCart);
document.querySelector('#close-cart').addEventListener('click', closeCart);
overlay.addEventListener('click', closeCart);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCart(); });
document.querySelector('#whatsapp-order').addEventListener('click', () => whatsapp(orderMessage()));
document.querySelectorAll('[name=fulfillment]').forEach(input => input.addEventListener('change', e => { fulfillment = e.target.value; const delivery = fulfillment === 'delivery'; document.querySelector('#delivery-time-wrap').hidden = !delivery; document.querySelector('#pickup-ready').hidden = delivery; if (delivery) document.querySelector('#delivery-time').min = localDateTime(earliestWorkingDelivery()); updateFulfillmentNote(); renderCart(); }));
function resetDeliveryQuote() { deliveryQuote = null; document.querySelector('#delivery-choice-price').textContent = 'Según distancia'; document.querySelector('#delivery-price-preview').hidden = true; document.querySelector('#delivery-quote-status').textContent = 'Pulsa “Calcular precio del delivery” para obtener el importe.'; updateFulfillmentNote(); renderCart(); }
document.querySelectorAll('#delivery-street, #delivery-locality, #delivery-postcode').forEach(input => input.addEventListener('input', resetDeliveryQuote));
document.querySelector('#calculate-delivery').addEventListener('click', async () => {
  const street=document.querySelector('#delivery-street').value.trim(), locality=document.querySelector('#delivery-locality').value.trim(), postcode=document.querySelector('#delivery-postcode').value.trim(), button=document.querySelector('#calculate-delivery'), status=document.querySelector('#delivery-quote-status'), preview=document.querySelector('#delivery-price-preview');
  if(street.length<5){ show('Escribe la calle, el número y, si corresponde, piso y puerta'); return; }
  if(locality.length<2){ show('Indica la localidad de entrega'); return; }
  if(!/^\d{5}$/.test(postcode)){ show('Introduce un código postal de 5 cifras'); return; }
  const address=`${street}, ${postcode} ${locality}`;
  button.disabled=true; button.textContent='Calculando el precio…'; status.textContent='Estamos calculando cuánto cuesta llevarte el pedido…'; preview.hidden=true;
  try { const response=await fetch('/api/delivery/quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address})}); const data=await response.json(); if(!response.ok) throw new Error(data.error||'No pudimos calcular el delivery.'); deliveryQuote=data; document.querySelector('#delivery-price-result').textContent=euro(data.fee); preview.hidden=false; status.textContent=`Calculado para ${data.distanceKm} km desde la floristería.`; document.querySelector('#delivery-choice-price').textContent=euro(data.fee); updateFulfillmentNote(); renderCart(); }
  catch(error){ deliveryQuote=null; preview.hidden=true; status.textContent=error.message; show(error.message); updateFulfillmentNote(); renderCart(); }
  finally { button.disabled=false; button.textContent='Calcular precio del delivery'; }
});
document.querySelector('#checkout').addEventListener('click', async () => { if (!CONFIG.stripeCheckoutEndpoint) { show('El pago seguro está disponible en nuestra web de Cloudflare'); return; } const deliveryValue = document.querySelector('#delivery-time').value; if (fulfillment === 'delivery' && !deliveryQuote) { show('Calcula el precio del delivery antes de pagar'); return; } if (fulfillment === 'delivery' && !deliveryValue) { show('Elige la fecha y hora aproximada de entrega'); return; } const deliveryAt = deliveryValue ? new Date(deliveryValue).toISOString() : ''; try { const response = await fetch(CONFIG.stripeCheckoutEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: cartLines().map(x => ({ id: x.product.id, quantity: x.qty })), fulfillment, deliveryAt, deliveryQuoteToken: deliveryQuote?.token || '' }) }); const data = await response.json(); if (!response.ok || !data.url) throw new Error(data.error || 'No se pudo iniciar el pago.'); location.href = data.url; } catch (error) { show(error.message || 'No se pudo iniciar el pago. Escríbenos por WhatsApp.'); } });
const menu = document.querySelector('.menu'), links = document.querySelector('.links');
menu.addEventListener('click', () => { links.classList.toggle('open'); menu.setAttribute('aria-expanded', links.classList.contains('open')); });
links.addEventListener('click', () => links.classList.remove('open'));
renderProducts();
renderCart();
loadCatalog();
loadShopSettings();

const reviewRail = document.querySelector('#review-rail');
document.querySelector('#review-prev')?.addEventListener('click', () => reviewRail.scrollBy({ left: -Math.min(reviewRail.clientWidth * .9, 620), behavior: 'smooth' }));
document.querySelector('#review-next')?.addEventListener('click', () => reviewRail.scrollBy({ left: Math.min(reviewRail.clientWidth * .9, 620), behavior: 'smooth' }));

const checkoutState = new URLSearchParams(location.search).get('checkout');
if (checkoutState === 'success') {
  cart = {};
  saveCart();
  const ref = new URLSearchParams(location.search).get('ref') || 'Confirmado';
  document.querySelector('#order-reference').textContent = ref;
  document.querySelector('#order-modal').hidden = false;
  document.querySelector('#confirm-whatsapp').addEventListener('click', () => whatsapp(`Hola, acabo de pagar mi pedido ${ref} en la web de La Vie en Rose. ¿Podéis confirmarme la preparación?`));
  document.querySelector('#close-order').addEventListener('click', () => { document.querySelector('#order-modal').hidden = true; history.replaceState({}, '', location.pathname); });
} else if (checkoutState === 'cancelled') {
  show('Pago cancelado. Tu cesta sigue guardada.');
  history.replaceState({}, '', location.pathname);
}
