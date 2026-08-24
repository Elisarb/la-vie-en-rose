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

const products = rawProducts.map((p, index) => ({ id: `r${String(index + 1).padStart(2, '0')}`, name: p[0], description: p[1], price: p[2], category: p[3], badge: p[4], image: `images/productos/ramo-${String(index + 1).padStart(2, '0')}.jpg` })).filter(product => product.id !== 'r15');
let cart = JSON.parse(localStorage.getItem('lavie-cart') || '{}');
let activeFilter = 'todos';
const euro = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
const productGrid = document.querySelector('#product-grid'), toast = document.querySelector('#toast'), drawer = document.querySelector('#cart'), overlay = document.querySelector('#cart-overlay');
let toastTimer;
const DELIVERY_FEE = 7.90;
let fulfillment = 'pickup';

function earliestWorkingDelivery(from = new Date()) {
  const cursor = new Date(from);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);
  let remaining = 5 * 60;
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
  productGrid.innerHTML = visible.map(p => `<article class="productCard"><div class="productImage" style="background-image:url('${p.image}')"><span>${p.badge}</span><button class="quickAdd" data-add="${p.id}" aria-label="Añadir ${p.name}">＋</button></div><div class="productInfo"><small>${p.category}</small><div><h3>${p.name}</h3><strong>${euro(p.price)}</strong></div><p>${p.description}</p><button class="addButton" data-add="${p.id}">Añadir a la cesta <span>＋</span></button></div></article>`).join('');
}
function saveCart() { localStorage.setItem('lavie-cart', JSON.stringify(cart)); renderCart(); }
function add(id) { cart[id] = (cart[id] || 0) + 1; saveCart(); show('Añadido a tu cesta ♡'); }
function change(id, delta) { cart[id] = (cart[id] || 0) + delta; if (cart[id] <= 0) delete cart[id]; saveCart(); }
function cartLines() { return Object.entries(cart).map(([id, qty]) => ({ product: products.find(p => p.id === id), qty })).filter(x => x.product); }
function renderCart() { const lines = cartLines(), count = lines.reduce((n, x) => n + x.qty, 0), subtotal = lines.reduce((n, x) => n + x.product.price * x.qty, 0), total = subtotal + (fulfillment === 'delivery' ? DELIVERY_FEE : 0); document.querySelector('#cart-count').textContent = count; document.querySelector('#drawer-count').textContent = count; document.querySelector('#cart-total').textContent = euro(total); document.querySelector('#cart-empty').hidden = lines.length > 0; document.querySelector('#cart-items').innerHTML = lines.map(({ product: p, qty }) => `<div class="cartItem"><div class="cartThumb" style="background-image:url('${p.image}')"></div><div class="cartItemCopy"><h3>${p.name}</h3><p>${euro(p.price)}</p><div class="quantity"><button data-change="-1" data-id="${p.id}" aria-label="Quitar uno">−</button><span>${qty}</span><button data-change="1" data-id="${p.id}" aria-label="Añadir uno">＋</button></div></div><button class="remove" data-remove="${p.id}" aria-label="Eliminar ${p.name}">×</button></div>`).join(''); document.querySelector('.cartSummary').hidden = !lines.length; }
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
document.querySelectorAll('[name=fulfillment]').forEach(input => input.addEventListener('change', e => { fulfillment = e.target.value; const delivery = fulfillment === 'delivery'; document.querySelector('#delivery-time-wrap').hidden = !delivery; if (delivery) document.querySelector('#delivery-time').min = localDateTime(earliestWorkingDelivery()); document.querySelector('#delivery-note').textContent = delivery ? 'Entrega fija en toda la Comunidad de Madrid: 7,90 €.' : 'Recogida gratuita. Te avisaremos cuando esté preparado.'; renderCart(); }));
document.querySelector('#checkout').addEventListener('click', async () => { if (!CONFIG.stripeCheckoutEndpoint) { show('El pago seguro está disponible en nuestra web de Cloudflare'); return; } const emailInput = document.querySelector('#checkout-email'); const customerEmail = emailInput.value.trim(); if (!emailInput.checkValidity()) { emailInput.reportValidity(); return; } const deliveryValue = document.querySelector('#delivery-time').value; if (fulfillment === 'delivery' && !deliveryValue) { show('Elige la fecha y hora de entrega'); return; } const deliveryAt = deliveryValue ? new Date(deliveryValue).toISOString() : ''; try { const response = await fetch(CONFIG.stripeCheckoutEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: cartLines().map(x => ({ id: x.product.id, quantity: x.qty })), fulfillment, deliveryAt, customerEmail }) }); const data = await response.json(); if (!response.ok || !data.url) throw new Error(data.error || 'No se pudo iniciar el pago.'); location.href = data.url; } catch (error) { show(error.message || 'No se pudo iniciar el pago. Escríbenos por WhatsApp.'); } });
const menu = document.querySelector('.menu'), links = document.querySelector('.links');
menu.addEventListener('click', () => { links.classList.toggle('open'); menu.setAttribute('aria-expanded', links.classList.contains('open')); });
links.addEventListener('click', () => links.classList.remove('open'));
renderProducts();
renderCart();

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
